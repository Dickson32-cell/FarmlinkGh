import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, getAdminSession, getAdminActionToken } from "@/lib/session";

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
    const adminSession = await getAdminSession(req);
    if (adminSession) {
      const validStatuses = ["pending", "paid", "delivered", "released", "cancelled", "refund_requested", "refunded"];
      if (!validStatuses.includes(status))
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });

      // Step-up auth: moving money (releasing to farmer OR refunding the buyer)
      // requires a fresh admin-action token (minted only after an EMAIL code
      // to ADMIN_EMAIL — see /api/auth/admin-otp)
      if (status === "released" || status === "refunded") {
        const actionPayload = await getAdminActionToken(req);
        if (!actionPayload) {
          return NextResponse.json(
            { error: "Confirm with the admin email code first", requireOtp: true },
            { status: 401 }
          );
        }
      }

      const updated = await prisma.order.update({
        where: { id },
        data: {
          status,
          adminNote: adminNote || order.adminNote,
          refundedAt: status === "refunded" ? new Date() : order.refundedAt,
        },
      });

      // Audit trail — who changed what
      await prisma.auditLog.create({
        data: {
          actorId: adminSession.userId,
          actorName: "admin",
          action: `order.${status}`,
          targetId: id,
          details: `${order.crop} x${order.quantity} | GHS ${order.totalAmount} | ${order.buyerName} -> ${order.farmerName}`,
        },
      });

      // SMS notifications on refund events
      if (status === "refund_requested") {
        // tell the farmer someone disputed their product
        const { sendSms } = await import("@/lib/otp");
        await sendSms(order.farmerPhone,
          `FarmLink: A refund was requested by ${order.buyerName} for order of ${order.crop} (${order.quantity} bags). Admin will review within 2-3 days.`)
          .catch(() => { });
      }
      if (status === "refunded") {
        // confirm to the buyer
        const { sendSms } = await import("@/lib/otp");
        await sendSms(order.buyerPhone,
          `FarmLink: Your refund of GH₵${order.totalAmount.toFixed(2)} for ${order.crop} has been sent. If you don't receive it within 24h, contact 0595726252 / info.rametechconsultancy@gmail.com.`)
          .catch(() => { });
        try {
          await prisma.listing.update({
            where: { id: order.listingId },
            data: { status: "available" },
          });
        } catch (e) {
          console.error(`listing restore skipped for order ${id}:`, String(e).slice(0, 100));
        }
      }

      // If released, mark the listing as sold (non-fatal — legacy orders may
      // reference listings that no longer exist; the money event is the order)
      if (status === "released") {
        try {
          await prisma.listing.update({
            where: { id: order.listingId },
            data: { status: "sold" },
          });
        } catch (e) {
          console.error(`listing mark-sold skipped for order ${id}:`, String(e).slice(0, 120));
        }
      }

      return NextResponse.json(updated);
    }

    if (session.role === "buyer") {
      // Buyer can only: confirm delivery (pending→delivered, paid→delivered)
      //                  or request a refund (paid→refund_requested, delivered→refund_requested)
      if (status === "delivered") {
        if (order.buyerId !== session.userId)
          return NextResponse.json({ error: "You can only confirm delivery on your own orders" }, { status: 403 });
        if (order.status !== "pending" && order.status !== "paid")
          return NextResponse.json({ error: "Cannot confirm delivery at this stage" }, { status: 400 });

        const updated = await prisma.order.update({
          where: { id },
          data: { status: "delivered", deliveredAt: new Date() },
        });
        return NextResponse.json(updated);
      }

      if (status === "refund_requested") {
        if (order.buyerId !== session.userId)
          return NextResponse.json({ error: "You can only request refunds on your own orders" }, { status: 403 });
        if (order.status !== "paid" && order.status !== "delivered")
          return NextResponse.json({ error: "Refunds can only be requested after payment" }, { status: 400 });

        const updated = await prisma.order.update({
          where: { id },
          data: { status: "refund_requested", refundRequestedAt: new Date() },
        });

        // Notify farmer + admin
        const { sendSms } = await import("@/lib/otp");
        await sendSms(order.farmerPhone,
          `FarmLink: ${order.buyerName} requested a refund for ${order.crop} (${order.quantity} bags). Admin will review within 2-3 days.`)
          .catch(() => { });
        await sendSms(process.env.ADMIN_MOMO || "0248847819",
          `FarmLink ADMIN: Refund requested — order ${order.id.slice(-8).toUpperCase()} (${order.crop}, GH₵${order.totalAmount.toFixed(2)}). Review in admin panel.`)
          .catch(() => { });

        return NextResponse.json(updated);
      }

      return NextResponse.json({ error: "Buyers can only confirm delivery or request refunds" }, { status: 403 });
    }

    return NextResponse.json({ error: "Not authorized to update orders" }, { status: 403 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}