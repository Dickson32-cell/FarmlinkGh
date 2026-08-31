import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// POST: Initiate Paystack payment for an order
// Paystack flow: create transaction → redirect buyer to authorization_url →
// Paystack redirects back with ?reference= → /api/payment/paystack/verify confirms.
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { orderId } = await req.json();
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.status !== "pending")
      return NextResponse.json({ error: "Order is not pending payment" }, { status: 400 });

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    const reference = `FARMLINK-${order.id.slice(-8).toUpperCase()}`;

    // If Paystack keys are not configured, return manual payment instructions
    if (!secretKey || secretKey.startsWith("sk_test_your") || secretKey.length < 20) {
      const adminMomo = process.env.ADMIN_MOMO || "0244000000";
      return NextResponse.json({
        mode: "manual",
        message: "Pay via MoMo to the admin number below, then click 'I've Paid'.",
        adminMomo,
        amount: order.totalAmount,
        reference,
      });
    }

    // Paystack amount is in the SUBUNIT of the currency (pesewas for GHS) — multiply by 100
    const amountInPesewas = Math.round(order.totalAmount * 100);

    // Buyer email: use buyer's account email if available, else synthesized
    let buyerEmail = `buyer${session.userId.slice(-6)}@farmlink.gh`;
    const buyerUser = await prisma.user.findUnique({ where: { id: order.buyerId } });
    if (buyerUser?.role === "buyer" && (buyerUser as any).email) {
      buyerEmail = (buyerUser as any).email;
    }

    const payload = {
      email: buyerEmail,
      amount: amountInPesewas,
      currency: "GHS",
      reference,
      callback_url: `${appUrl}/api/payment/paystack/verify?orderId=${order.id}`,
      metadata: {
        orderId: order.id,
        crop: order.crop,
        quantity: order.quantity,
        buyerName: order.buyerName,
        buyerPhone: order.buyerPhone,
        custom_fields: [
          { display_name: "Order", variable_name: "order_id", value: order.id },
          { display_name: "Crop", variable_name: "crop", value: order.crop },
        ],
      },
    };

    const psRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const psData = await psRes.json();

    if (!psData.status) {
      return NextResponse.json(
        { error: "Paystack initialization failed", details: psData.message },
        { status: 502 }
      );
    }

    // Persist the reference against the order
    await prisma.order.update({
      where: { id: orderId },
      data: { paystackRef: reference, paymentProvider: "paystack" },
    });

    return NextResponse.json({
      mode: "paystack",
      authorizationUrl: psData.data.authorization_url,
      reference,
      message: "Redirecting you to Paystack to complete payment...",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}