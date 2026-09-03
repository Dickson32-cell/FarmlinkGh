import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOtp } from "@/lib/otp";
import { createToken } from "@/lib/auth";
import { normalizeGhanaPhone } from "@/lib/phone";

// POST: Step 2 of 2FA login — verify the SMS code, then issue the session cookie.
export async function POST(req: NextRequest) {
  try {
    const { phone, code } = await req.json();
    if (!phone || !code) {
      return NextResponse.json({ error: "Phone and code required" }, { status: 400 });
    }

    // normalize like the login step does, so the OTP lookup always matches
    const normalizedPhone = normalizeGhanaPhone(phone);
    const result = await verifyOtp(normalizedPhone, code, "login");
    if (!result.ok) {
      const reason = result.reason ?? "failed";
      const messages: Record<string, string> = {
        expired: "Code expired. Request a new one.",
        locked: "Too many wrong attempts. Request a new code.",
        wrong: "Incorrect code. Please try again.",
      };
      return NextResponse.json(
        { error: messages[reason] || "Verification failed" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
    if (!user || user.status !== "approved") {
      return NextResponse.json({ error: "Account not available" }, { status: 403 });
    }

    const token = await createToken({ userId: user.id, role: user.role });
    const res = NextResponse.json({ id: user.id, name: user.name, role: user.role });
    res.cookies.set("farmlink_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}