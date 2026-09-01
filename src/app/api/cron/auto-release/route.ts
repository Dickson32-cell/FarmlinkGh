import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET/POST: 48-hour auto-release job.
// Orders in "delivered" state for 48+ hours with no dispute are auto-released:
// status → "released", listing → sold.
//
// Two ways to fire it — BOTH must present the CRON_SECRET:
//   1. Vercel Cron (see vercel.json, daily). When CRON_SECRET is set on the
//      project, Vercel automatically sends Authorization: Bearer ${CRON_SECRET}.
//   2. Any external scheduler (cron-job.org, GitHub Actions) hitting this route
//      with header x-cron-secret: ${CRON_SECRET}.
//
// NOTE: x-vercel-cron headers are spoofable by external callers and are NOT
// used as a trust boundary here — only the shared secret authorizes a run.
//
// The job itself is idempotent and only releases orders already 48h past
// delivery, so triggering it (even repeatedly) can never release money early.

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
    // Mark listing sold (non-fatal — legacy orders may reference removed listings)
    try {
      await prisma.listing.update({
        where: { id: order.listingId },
        data: { status: "sold" },
      });
    } catch (e) {
      console.error(`listing update failed for ${order.listingId}:`, e);
    }
    console.log(`[AUTO-RELEASE] order ${order.id} → released. Farmer payout GH₵${order.farmerPayout} to ${order.farmerName} (${order.farmerPhone})`);
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
  // Vercel Cron sends Authorization: Bearer ${CRON_SECRET} automatically;
  // external schedulers send x-cron-secret. Either proves knowledge of the secret.
  const bearer = req.headers.get("authorization");
  const provided = req.headers.get("x-cron-secret");
  const authorized =
    (bearer && bearer === `Bearer ${secret}`) || (provided && provided === secret);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runJob();
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  return GET(req);
}