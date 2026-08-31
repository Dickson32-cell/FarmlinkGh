import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET/POST: 48-hour auto-release job.
// Orders in "delivered" state for 48+ hours with no dispute are auto-released:
// status → "released", listing → sold, admin notified in the response (cron runner can alert).
//
// Security: requires header x-cron-secret matching CRON_SECRET in .env
// (so only the scheduler — cron-job.org / GitHub Actions / Render Cron — can fire it).
//
// Schedule: run every hour. With 48h grace, hourly runs are more than enough.

const GRACE_HOURS = 48;

async function runJob() {
  const cutoff = new Date(Date.now() - GRACE_HOURS * 60 * 60 * 1000);

  // Orders the buyer has confirmed delivered before the cutoff and not yet released
  const due = await prisma.order.findMany({
    where: {
      status: "delivered",
      deliveredAt: { not: null, lte: cutoff },
      autoReleased: false,
    },
  });

  const released = [];
  for (const order of due) {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "released", autoReleased: true },
    });
    // Mark listing sold
    try {
      await prisma.listing.update({
        where: { id: order.listingId },
        data: { status: "sold" },
      });
    } catch (e) {
      console.error(`listing update failed for ${order.listingId}:`, e);
    }
    released.push({
      orderId: order.id,
      farmerName: order.farmerName,
      farmerPhone: order.farmerPhone,
      payout: order.farmerPayout,
      reference: order.paystackRef || order.id,
    });
  }

  return {
    checked: due.length,
    released,
    releasedCount: released.length,
    message:
      released.length > 0
        ? `${released.length} order(s) auto-released. Send MoMo payouts to the farmers listed.`
        : "No orders due for auto-release.",
  };
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const provided = req.headers.get("x-cron-secret");
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runJob();
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  return GET(req);
}