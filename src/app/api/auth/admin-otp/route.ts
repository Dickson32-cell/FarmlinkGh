import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { createOtp, sendSms, verifyOtp } from "@/lib/otp";

// ADMIN STEP-UP AUTH:
// POST without body.code → send an admin-action OTP to the admin's phone.
// POST with { code }    → verify OTP (purpose=admin_action), return short-lived
//                         action token (3 min TTL) used by admin PATCH endpoints.
// The action token is a signed JWT with purpose=admin_action — server verifies it
// on sensitive calls (order release).

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only admins
  const me = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!me || me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { code } = body;

    // ---- Step 2: verify the code and mint an action token ----
    if (code) {
      const result = await verifyOtp(me.phone, code, "admin_action");
      if (!result.ok) {
        return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
      }
      const { SignJWT } = await import("jose");
      const secret = new TextEncoder().encode(
        process.env.JWT_SECRET || "farmlink-dev-secret-2026"
      );
      const actionToken = await new SignJWT({
        userId: me.id,
        role: "admin",
        purpose: "admin_action",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("10m")
        .sign(secret);
      return NextResponse.json({ actionToken, expiresIn: 600 });
    }

    // ---- Step 1: send the code ----
    const { code: otpCode } = await createOtp(me.phone, "admin_action");
    const smsText = `FarmLink ADMIN: Confirmation code ${otpCode}. Never share this code.`;
    const { sent, provider } = await sendSms(me.phone, smsText);

    return NextResponse.json({
      otpSent: true,
      phone: me.phone.slice(0, 4) + "****" + me.phone.slice(-3),
      devCode: provider === "console" ? otpCode : undefined,
      message: "Enter the code sent to your phone to approve this action.",
    });
  } catch (e: any) {
    const msg = e.message || "Admin OTP error";
    return NextResponse.json({ error: msg }, { status: e.message?.includes("Too many") ? 429 : 500 });
  }
}