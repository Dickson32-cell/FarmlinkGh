import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOtp, sendSms, detectNetwork } from "@/lib/otp";

// POST: Forgot-password step 1 — user submits their phone.
// Sends an OTP (purpose="reset") ONLY if the account exists.
// Response is UNIFORM either way — never reveal whether a phone is registered.
export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();
    if (!phone) {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 });
    }

    const normalized = phone.trim();
    const user = await prisma.user.findUnique({ where: { phone: normalized } });

    // Uniform response regardless of account existence (no user enumeration)
    const genericMessage = "If this number is registered, a reset code has been sent.";

    if (!user || user.status !== "approved") {
      return NextResponse.json({ success: true, message: genericMessage });
    }

    try {
      const { code, network } = await createOtp(normalized, "reset");
      const smsText = `FarmLink: Your password reset code is ${code}. Valid for 10 minutes. Do not share this code with anyone.`;
      const { sent, provider } = await sendSms(normalized, smsText);

      return NextResponse.json({
        success: true,
        message: genericMessage,
        // dev convenience only (console provider)
        devCode: provider === "console" ? code : undefined,
        network,
      });
    } catch (e: any) {
      if (e.message?.includes("Too many")) {
        return NextResponse.json({ error: e.message }, { status: 429 });
      }
      throw e;
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}