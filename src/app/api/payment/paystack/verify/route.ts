import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Paystack callback handler.
// Paystack redirects the buyer here after payment with ?reference=...&trxref=...
// We VERIFY server-side (never trust the redirect alone) then mark the order paid.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reference =
    searchParams.get("reference") || searchParams.get("trxref") || "";
  const orderId = searchParams.get("orderId");

  if (!reference) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/orders?payment=missing_reference`
    );
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/orders?payment=unconfigured`
    );
  }

  try {
    const psRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
      }
    );
    const psData = await psRes.json();

    if (psData.status && psData.data?.status === "success") {
      // Find the order: by paystackRef, or by the orderId param
      let order = await prisma.order.findFirst({
        where: { paystackRef: reference },
      });
      if (!order && orderId) {
        order = await prisma.order.findUnique({ where: { id: orderId } });
      }

      if (order && order.status === "pending") {
        // Verify amount matches (defence against tampered references)
        const paidPesewas = psData.data.amount as number;
        const expectedPesewas = Math.round(order.totalAmount * 100);
        if (paidPesewas !== expectedPesewas) {
          console.error(
            `Paystack amount mismatch for order ${order.id}: expected ${expectedPesewas}, got ${paidPesewas}`
          );
          return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/orders?payment=amount_mismatch&order=${order.id}`
          );
        }

        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: "paid",
            paystackRef: reference,
            paymentProvider: "paystack",
            paymentMethod: psData.data.channel || "paystack",
            hubtelTxId: psData.data.id ? String(psData.data.id) : null,
          },
        });

        // RELAYED-ORDER: farmer must know payment landed — start delivery
        try {
          const { sendSms } = await import("@/lib/otp");
          const ref = order.id.slice(-8).toUpperCase();
          const deliveryLine = order.deliveryAddress
            ? ` Deliver to: ${order.deliveryAddress}${order.deliveryLat ? ` (GPS ${order.deliveryLat.toFixed(5)},${order.deliveryLng?.toFixed(5)})` : ""}.`
            : "";
          await sendSms(
            order.farmerPhone,
            `FarmLink: Payment received for order ${ref} - ${order.buyerName} (${order.buyerPhone}) paid GHS${order.totalAmount.toFixed(2)} for ${order.crop} x${order.quantity}. START DELIVERY.${deliveryLine}`,
          );
          await sendSms(
            order.buyerPhone,
            `FarmLink: Order ${ref} paid (${order.crop} x${order.quantity}). ${order.farmerName} has your delivery details and will call you. farmlinkghana.vercel.app`,
          );
        } catch (err) {
          console.error("[PAYMENT-RELAY] verify-path paid SMS failed:", String(err).slice(0, 120));
        }

        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/orders?payment=success&order=${order.id}`
        );
      }

      // Already processed or not found — land on orders page
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/orders?payment=${order ? "already" : "notfound"}`
      );
    }

    // Payment not successful (abandoned/failed/pending)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/orders?payment=failed&ref=${reference}`
    );
  } catch (e: any) {
    console.error("Paystack verify error:", e.message);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/orders?payment=error`
    );
  }
}