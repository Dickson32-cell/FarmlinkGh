import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const COMMISSION_RATE = parseFloat(process.env.COMMISSION_RATE || "0.10");
const HUBTEL_FEE_RATE = parseFloat(process.env.HUBTEL_FEE_RATE || "0.015");

// GET orders — buyer sees own, farmer sees own, admin sees all
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let where: any = {};
  if (session.role === "buyer") where.buyerId = session.userId;
  else if (session.role === "farmer") where.farmerId = session.userId;
  // admin sees all (no filter)

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(orders);
}

// POST create a new order (buyer initiates purchase)
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "buyer")
    return NextResponse.json({ error: "Only buyers can place orders" }, { status: 403 });

  try {
    const { listingId, quantity } = await req.json();
    if (!listingId || !quantity)
      return NextResponse.json({ error: "listingId and quantity required" }, { status: 400 });

    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: { farmer: true },
    });
    if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    if (listing.status !== "available")
      return NextResponse.json({ error: "This listing is no longer available" }, { status: 400 });

    const buyer = await prisma.buyer.findUnique({ where: { userId: session.userId } });

    const totalAmount = listing.price * quantity;
    const commissionAmount = totalAmount * COMMISSION_RATE;
    const hubtelFeeAmount = totalAmount * HUBTEL_FEE_RATE;
    const farmerPayout = totalAmount - commissionAmount - hubtelFeeAmount;

    const order = await prisma.order.create({
      data: {
        listingId: listing.id,
        crop: listing.crop,
        quantity,
        unitPrice: listing.price,
        totalAmount,
        commissionRate: COMMISSION_RATE,
        hubtelFeeRate: HUBTEL_FEE_RATE,
        commissionAmount,
        hubtelFeeAmount,
        farmerPayout,
        farmerId: listing.farmer.userId,
        farmerName: listing.farmer.name,
        farmerPhone: listing.farmer.phone,
        buyerId: session.userId,
        buyerName: buyer?.name || "Unknown",
        buyerPhone: buyer?.phone || session.userId,
        status: "pending",
      },
    });

    return NextResponse.json(order);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH update order status (admin: paid→delivered→released→cancelled; buyer: confirm delivery)
export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id, status, adminNote } = await req.json();

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // Role-based status transitions
    if (session.role === "admin") {
      // Admin can: mark as paid, mark as delivered, release payment, cancel
      const validStatuses = ["pending", "paid", "delivered", "released", "cancelled"];
      if (!validStatuses.includes(status))
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });

      const updated = await prisma.order.update({
        where: { id },
        data: { status, adminNote: adminNote || order.adminNote },
      });

      // If released, mark the listing as sold
      if (status === "released") {
        await prisma.listing.update({
          where: { id: order.listingId },
          data: { status: "sold" },
        });
      }

      return NextResponse.json(updated);
    }

    if (session.role === "buyer") {
      // Buyer can only: confirm delivery (pending→delivered, paid→delivered)
      if (status !== "delivered")
        return NextResponse.json({ error: "Buyers can only confirm delivery" }, { status: 403 });
      if (order.status !== "pending" && order.status !== "paid")
        return NextResponse.json({ error: "Cannot confirm delivery at this stage" }, { status: 400 });

      const updated = await prisma.order.update({ where: { id }, data: { status: "delivered" } });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Not authorized to update orders" }, { status: 403 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}