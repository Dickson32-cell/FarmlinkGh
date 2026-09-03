import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOtp } from "@/lib/otp";
import { hashPassword } from "@/lib/auth";
import { normalizeGhanaPhone } from "@/lib/phone";

// POST: Forgot-password step 2 — verify OTP + set the new password.
// Rules:
//  - OTP must be purpose="reset" and valid
//  - new password min 8 chars
//  - on success: all existing sessions are still valid (JWT 7d) — acceptable for
//    farmers (shared-device risk is low); the password change takes effect at next login.
export async function POST(req: NextRequest) {
  try {
    const { phone, code, newPassword } = await req.json();
    if (!phone || !code || !newPassword) {
      return NextResponse.json(
        { error: "Phone, code and new password are required" },
        { status: 400 }
      );
    }
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // normalize the same way step 1 does — or the OTP lookup fails here too
    const normalizedPhone = normalizeGhanaPhone(phone);

    // Account must still be active
    const user = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
    if (!user || user.status !== "approved") {
      return NextResponse.json({ error: "Verification failed" }, { status: 401 });
    }

    // Verify the reset OTP
    const result = await verifyOtp(normalizedPhone, code, "reset");
    if (!result.ok) {
      const messages: Record<string, string> = {
        expired: "Reset code expired. Request a new one.",
        locked: "Too many wrong attempts. Request a new code.",
        wrong: "Incorrect code. Please try again.",
      };
      const reason = result.reason ?? "failed";
      return NextResponse.json(
        { error: messages[reason] || "Verification failed" },
        { status: 401 }
      );
    }

    // Update the password
    const hashed = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, failedLogins: 0, lockedUntil: null },
    });

    // Audit
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorName: user.name,
        action: "password.reset",
        targetId: user.id,
        details: `Password reset via SMS OTP for ${user.phone}`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Password changed. You can now log in with your new password.",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}