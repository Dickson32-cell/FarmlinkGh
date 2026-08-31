import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// POST: Paystack webhook — server-to-server payment confirmation.
// This is the authoritative signal (the browser redirect can be dropped/abused).
// Security: verify x-paystack-signature = HMAC-SHA512 of the raw body with the secret key.
export async function POST(req: NextRequest) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "Paystack not configured" }, { status: 503 });
  }

  // Read the RAW body (must verify signature against exact bytes)
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature") || "";

  const expected = crypto
    .createHmac("sha512", secretKey)
    .update(rawBody)
    .digest("hex");

  if (
    !signature ||
    expected.length !== signature.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only handle successful charges
  if (event.event === "charge.success") {
    const data = event.data || {};
    const reference: string = data.reference || "";
    const paidPesewas: number = data.amount || 0;
    const channel: string = data.channel || "paystack";

    if (!reference) {
      return NextResponse.json({ received: true, note: "no reference" });
    }

    const order = await prisma.order.findFirst({
      where: { paystackRef: reference },
    });

    if (order && order.status === "pending") {
      const expectedPesewas = Math.round(order.totalAmount * 100);
      if (paidPesewas === expectedPesewas) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: "paid",
            paymentProvider: "paystack",
            paymentMethod: channel,
            hubtelTxId: data.id ? String(data.id) : null,
          },
        });
        console.log(`Paystack webhook: order ${order.id} marked PAID (ref ${reference})`);
      } else {
        console.error(
          `Paystack webhook amount mismatch for ${order.id}: expected ${expectedPesewas}, got ${paidPesewas} — NOT marked paid`
        );
      }
    }
  }

  // Always 200 so Paystack doesn't retry forever
  return NextResponse.json({ received: true });
}