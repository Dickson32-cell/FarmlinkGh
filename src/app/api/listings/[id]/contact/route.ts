import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// GET /api/listings/[id]/contact — is the farmer's direct contact UNLOCKED
// for this listing for the current user?
//
// RELAYED-ORDER MODEL: a buyer only gets the farmer's phone number AFTER
// paying for this listing through FarmLink. Farmers see their own contact
// (it's theirs); admins see everything; strangers/other buyers get locked.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await prisma.listing.findUnique({ where: { id }, select: { farmer: { select: { userId: true } } } });
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ unlocked: false, reason: "login" });
  }
  if (session.role === "admin" || session.userId === listing.farmer.userId) {
    return NextResponse.json({ unlocked: true, reason: "owner" });
  }

  // POLICY (Jumia-style, 2026-09): buyers NEVER see the farmer's direct
  // contact — even after payment. The farmer receives the buyer's full
  // details (name, phone, address, GPS) and initiates delivery contact.
  // This keeps every reorder on-platform and protects the commission.
  // Buyers with a paid order are told their farmer will call them.
  const paidOrder = await prisma.order.findFirst({
    where: {
      listingId: id,
      buyerId: session.userId,
      status: { in: ["paid", "delivered", "released"] },
    },
    select: { id: true },
  });

  return NextResponse.json({
    unlocked: false,
    farmerCalls: !!paidOrder,
    reason: paidOrder ? "farmer_will_call" : "unpaid",
  });
}