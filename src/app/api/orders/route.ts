import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, getAdminSession, getAdminActionToken } from "@/lib/session";

const COMMISSION_RATE = parseFloat(process.env.COMMISSION_RATE || "0.05");
const HUBTEL_FEE_RATE = parseFloat(process.env.HUBTEL_FEE_RATE || "0.015");

// GET orders — buyer sees own, farmer sees own, admin sees all
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let where: any = {};
  if (session.role === "buyer") where.buyerId = session.userId;
  else if (session.role === "farmer") {
    // orders store the Farmer PROFILE row id (reviews match on it)
    const farmer = await prisma.farmer.findUnique({ where: { userId: session.userId } });
    where.farmerId = farmer?.id || "none";
  }
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
    const { listingId, quantity, deliveryAddress, deliveryLat, deliveryLng, saveLocation } = await req.json();
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

    // Delivery location: checkout value wins; else the buyer's saved default
    const address = (deliveryAddress || buyer?.deliveryAddress || "").toString().trim().slice(0, 300);
    const lat = typeof deliveryLat === "number" ? deliveryLat : buyer?.deliveryLat ?? null;
    const lng = typeof deliveryLng === "number" ? deliveryLng : buyer?.deliveryLng ?? null;

    // "Save as my default delivery location" — remembered for next checkout
    if (saveLocation === true && address) {
      await prisma.buyer.update({
        where: { userId: session.userId },
        data: { deliveryAddress: address, deliveryLat: lat, deliveryLng: lng },
      }).catch(() => { /* non-fatal */ });
    }

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
        farmerId: listing.farmer.id, // Farmer PROFILE row id — reviews match on this
        farmerName: listing.farmer.name,
        farmerPhone: listing.farmer.phone,
        buyerId: session.userId,
        buyerName: buyer?.name || "Unknown",
        buyerPhone: buyer?.phone || session.userId,
        status: "pending",
        // Delivery location for the farmer
        deliveryAddress: address || null,
        deliveryLat: lat,
        deliveryLng: lng,
      },
    });

    // RELAYED-ORDER MODEL: the farmer is notified by SMS through the system.
    // The buyer pays FarmLink first; direct contact details are unlocked only
    // after payment — keeping the sale (and the 5% commission) on-platform.
    try {
      const { sendSms } = await import("@/lib/otp");
      const ref = order.id.slice(-8).toUpperCase();
      await sendSms(
        listing.farmer.phone,
        `FarmLink: New order ${ref} - ${buyer?.name || "a buyer"} wants ${quantity} bag(s) of ${listing.crop} at GHS${listing.price}/bag (GHS${totalAmount.toFixed(2)} total). They will pay now via FarmLink.`,
      );
      console.log(`[ORDER-RELAY] SMS sent to farmer ${listing.farmer.phone} for order ${ref}`);
    } catch (err) {
      console.error("[ORDER-RELAY] farmer SMS failed (order still created):", String(err).slice(0, 120));
    }

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
    const { id, status, adminNote, reason, complaint, refundAmount, damageDeduction } = await req.json();

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
          // Damage-adjusted refund: what the buyer actually receives.
          // Default = full totalAmount; the admin may deduct measured damage
          // after reviewing the farmer's complaint.
          refundAmount: status === "refunded"
            ? Math.max(0, Math.min(
                typeof refundAmount === "number" ? refundAmount : order.totalAmount,
                order.totalAmount,
              ))
            : order.refundAmount,
          damageDeduction: status === "refunded"
            ? Math.max(0, typeof damageDeduction === "number" ? damageDeduction : 0)
            : order.damageDeduction,
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

      // SMS notifications on payment confirmation
      if (status === "paid") {
        // RELAYED-ORDER: tell the FARMER payment landed — start delivery
        try {
          const { sendSms } = await import("@/lib/otp");
          const ref = updated.id.slice(-8).toUpperCase();
          const deliveryLine = updated.deliveryAddress
            ? ` Deliver to: ${updated.deliveryAddress}${updated.deliveryLat ? ` (GPS ${updated.deliveryLat.toFixed(5)},${updated.deliveryLng?.toFixed(5)})` : ""}.`
            : "";
          await sendSms(
            updated.farmerPhone,
            `FarmLink: Payment received for order ${ref} - ${updated.buyerName} (${updated.buyerPhone}) paid GHS${updated.totalAmount.toFixed(2)} for ${updated.crop} x${updated.quantity}. START DELIVERY.${deliveryLine}`,
          );
          await sendSms(
            updated.buyerPhone,
            `FarmLink: Payment received for order ${ref} (${updated.crop} x${updated.quantity}). Your farmer: ${updated.farmerName} - ${updated.farmerPhone}. Contact them for delivery.`,
          );
        } catch (err) {
          console.error("[PAYMENT-RELAY] paid SMS failed:", String(err).slice(0, 120));
        }
      }

      // SMS notifications on refund events
      if (status === "refund_requested") {
        // tell the farmer someone disputed their product
        const { sendSms } = await import("@/lib/otp");
        await sendSms(order.farmerPhone,
          `FarmLink: A refund was requested by ${order.buyerName} for order of ${order.crop} (${order.quantity} bags). Admin will review within 2-3 days.`)
          .catch(() => { });
      }
      if (status === "refunded") {
        // confirm to the buyer — full purchase amount unless the admin
        // deducted measured damage after the farmer's complaint
        const actual = updated.refundAmount ?? updated.totalAmount;
        const deduction = updated.damageDeduction || 0;
        const { sendSms } = await import("@/lib/otp");
        await sendSms(order.buyerPhone,
          deduction > 0
            ? `FarmLink: Refund of GHS${actual.toFixed(2)} sent for ${order.crop} (GHS${deduction.toFixed(2)} damage deduction applied). Arrives within 24h.`
            : `FarmLink: Your full refund of GHS${actual.toFixed(2)} for ${order.crop} has been sent. It arrives within 24h.`)
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

        // Remind the buyer of the refund window: 3 days from now
        try {
          const { sendSms } = await import("@/lib/otp");
          await sendSms(order.buyerPhone,
            `FarmLink: Delivery confirmed for ${order.crop} x${order.quantity}. You have 3 days to request a refund if the product falls short. After that the farmer is paid.`)
            .catch(() => { });
        } catch { /* non-fatal */ }

        return NextResponse.json(updated);
      }

      if (status === "refund_requested") {
        if (order.buyerId !== session.userId)
          return NextResponse.json({ error: "You can only request refunds on your own orders" }, { status: 403 });
        if (order.status !== "paid" && order.status !== "delivered")
          return NextResponse.json({ error: "Refunds can only be requested after payment" }, { status: 400 });

        // REFUND WINDOW: once delivery is confirmed the buyer has 72 HOURS
        // (the 2-3 day policy) to request a refund. After that the sale is
        // final and the farmer's payout is released.
        if (order.status === "delivered" && order.deliveredAt) {
          const hoursSinceDelivery = (Date.now() - new Date(order.deliveredAt).getTime()) / (1000 * 60 * 60);
          if (hoursSinceDelivery > 72) {
            return NextResponse.json(
              { error: "The 3-day refund window after delivery has closed. This sale is final." },
              { status: 400 },
            );
          }
        }

        const updated = await prisma.order.update({
          where: { id },
          data: {
            status: "refund_requested",
            refundRequestedAt: new Date(),
            refundReason: (reason || "").toString().trim().slice(0, 500) || order.refundReason,
          },
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

      // FARMER COMPLAINT on a refund case: the farmer claims the buyer
      // damaged/mishandled the product. The admin measures the damage and
      // subtracts it from the refund money.
      if (status === "farmer_complaint") {
        const farmer = await prisma.farmer.findUnique({ where: { userId: session.userId } });
        if (!farmer || order.farmerId !== farmer.id)
          return NextResponse.json({ error: "You can only file complaints on your own orders" }, { status: 403 });
        if (order.status !== "refund_requested" && order.status !== "paid" && order.status !== "delivered")
          return NextResponse.json({ error: "Complaints apply to refund cases and active orders" }, { status: 400 });

        const updated = await prisma.order.update({
          where: { id },
          data: {
            farmerComplaint: (complaint || "").toString().trim().slice(0, 500),
            farmerComplaintAt: new Date(),
          },
        });

        // alert the admin
        const { sendSms } = await import("@/lib/otp");
        await sendSms(process.env.ADMIN_MOMO || "0248847819",
          `FarmLink ADMIN: Farmer complaint on order ${order.id.slice(-8).toUpperCase()} (${order.crop}, GHS${order.totalAmount.toFixed(2)}) - refund under review. Check admin panel.`)
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