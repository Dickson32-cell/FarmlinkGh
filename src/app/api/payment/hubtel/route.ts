import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// POST: Initiate Hubtel payment for an order
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { orderId } = await req.json();
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.status !== "pending")
      return NextResponse.json({ error: "Order is not pending payment" }, { status: 400 });

    const clientId = process.env.HUBTEL_CLIENT_ID;
    const clientSecret = process.env.HUBTEL_CLIENT_SECRET;
    const merchantNo = process.env.HUBTEL_MERCHANT_NO;

    // If Hubtel keys are not configured, return manual payment instructions
    if (!clientId || !clientSecret || !merchantNo || clientId === "your_client_id_here") {
      const adminMomo = process.env.ADMIN_MOMO || "0244000000";
      return NextResponse.json({
        mode: "manual",
        message: "Pay via MoMo to the admin number below, then click 'I've Paid'.",
        adminMomo,
        amount: order.totalAmount,
        reference: `FarmLink-${order.id.slice(-8).toUpperCase()}`,
      });
    }

    // Hubtel Send Money API — initiate mobile money charge
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const hubtelPayload = {
      CustomerName: order.buyerName,
      CustomerMsisdn: order.buyerPhone.replace(/^0/, "233"),
      ClientReference: `FarmLink-${order.id.slice(-8).toUpperCase()}`,
      Description: `Payment for ${order.crop} (${order.quantity} bags)`,
      Amount: order.totalAmount,
      CallbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/api/payment/hubtel/callback`,
      merchantAccountNumber: merchantNo,
    };

    const hubtelRes = await fetch(
      "https://api.hubtel.com/v1/merchantaccount/merchants/${merchantNo}/receive/mobilemoney",
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(hubtelPayload),
      }
    );

    const hubtelData = await hubtelRes.json();

    if (!hubtelRes.ok) {
      return NextResponse.json({ error: "Hubtel payment initiation failed", details: hubtelData }, { status: 502 });
    }

    // Update order with Hubtel transaction ID
    await prisma.order.update({
      where: { id: orderId },
      data: { hubtelTxId: hubtelData.TransactionId || hubtelData.Data?.TransactionId || null },
    });

    return NextResponse.json({
      mode: "hubtel",
      hubtelData,
      message: "Payment initiated. Follow the prompt on your phone to complete payment.",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET: Handle Hubtel callback (webhook after payment completes)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const transactionId = searchParams.get("TransactionId") || searchParams.get("transactionId");
  const clientReference = searchParams.get("ClientReference");

  if (status === "Success" || status === "success") {
    // Find order by reference
    if (clientReference) {
      const shortId = clientReference.replace("FARMLINK-", "").toLowerCase();
      const orders = await prisma.order.findMany();
      const order = orders.find((o) => o.id.slice(-8).toUpperCase() === shortId.toUpperCase());
      if (order) {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: "paid", hubtelTxId: transactionId || order.hubtelTxId },
        });
      }
    }
  }

  return NextResponse.redirect(new URL("/orders?payment=success", req.url));
}