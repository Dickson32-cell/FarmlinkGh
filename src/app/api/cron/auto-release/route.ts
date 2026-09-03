import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Orders the buyer has confirmed delivered are auto-released 72h later
// (after the refund window closes) if no dispute: status → "released",
// listing → sold.
//
// Two ways to fire it — BOTH must present the CRON_SECRET:
//   1. Vercel Cron (see vercel.json, daily). When CRON_SECRET is set on the
//      project, Vercel automatically sends Authorization: Bearer ***
//   2. Any external scheduler (cron-job.org, GitHub Actions) hitting this route
//      with header x-cron-secret: ${CRON_SECRET}.
//
// NOTE: x-vercel-cron headers are spoofable by external callers and are NOT
// used as a trust boundary here — only the shared secret authorizes a run.
//
// The job itself is idempotent and only releases orders already 72h past
// delivery (refund window closed), so triggering it repeatedly can never
// release money early.

const GRACE_HOURS = 72; // matches the buyer's 3-day refund window — never release before it closes
// Rejected registrations older than this are auto-removed (their ID photos
// deleted with them). They can always re-register fresh.
const REJECTED_RETENTION_DAYS = 30;

async function runJob() {
  const cutoff = new Date(Date.now() - GRACE_HOURS * 60 * 60 * 1000);
  let purgedRejected = 0;

  // ---- Auto-purge old rejected registrations ----
  try {
    const retentionCutoff = new Date(Date.now() - REJECTED_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const oldRejected = await prisma.user.findMany({
      where: {
        status: "rejected",
        role: { not: "admin" },
        createdAt: { lt: retentionCutoff },
      },
    });
    for (const user of oldRejected) {
      // change requests FK-block user deletion — clear them first
      await prisma.profileChangeRequest.deleteMany({ where: { userId: user.id } }).catch(() => { });
      await prisma.wishlist.deleteMany({ where: { userId: user.id } }).catch(() => { });
      await prisma.notification.deleteMany({ where: { userId: user.id } }).catch(() => { });
      const farmer = await prisma.farmer.findUnique({ where: { userId: user.id } });
      if (farmer) {
        await prisma.review.deleteMany({ where: { farmerId: farmer.id } });
        await prisma.listing.deleteMany({ where: { farmerId: farmer.id } });
      }
      await prisma.farmer.deleteMany({ where: { userId: user.id } }).catch(() => { });
      await prisma.buyer.deleteMany({ where: { userId: user.id } }).catch(() => { });
      await prisma.otpCode.deleteMany({ where: { phone: user.phone } });
      await prisma.storedFile.deleteMany({ where: { ownerId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
      purgedRejected++;
    }
    if (purgedRejected > 0) {
      console.log(`[AUTO-PURGE] removed ${purgedRejected} rejected registration(s) older than ${REJECTED_RETENTION_DAYS} days`);
    }
  } catch (e) {
    console.error("[AUTO-PURGE] failed (non-fatal):", String(e).slice(0, 120));
  }

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
    // Listing is sold only if the last bag went (partial stock — non-fatal)
    try {
      const { remainingFor, statusForRemaining } = await import("@/lib/stock");
      const listingRow = await prisma.listing.findUnique({ where: { id: order.listingId } });
      if (listingRow) {
        const remaining = await remainingFor(listingRow.id, listingRow.quantity);
        await prisma.listing.update({
          where: { id: order.listingId },
          data: { status: statusForRemaining(listingRow.status, remaining) },
        });
      }
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
    purgedRejected,
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