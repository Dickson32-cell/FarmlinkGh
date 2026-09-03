import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createOtp, sendSms, detectNetwork } from "@/lib/otp";
import { normalizeGhanaPhone, isValidGhanaPhone } from "@/lib/phone";

// POST: Forgot-password step 1 — user submits their phone.
// Sends an OTP (purpose="reset") ONLY if the account exists.
// Response is UNIFORM either way — never reveal whether a phone is registered.
export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();
    if (!phone) {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 });
    }

    // Normalize: accept 0…, +233…, 233…, spaced/dashed forms. The DB stores
    // the local 0… form — without this, a differently-typed number silently
    // matched no account and no OTP was ever created.
    const normalized = normalizeGhanaPhone(phone);
    if (!isValidGhanaPhone(normalized)) {
      return NextResponse.json(
        { error: "Enter a valid Ghana mobile number (e.g. 0244123456)" },
        { status: 400 },
      );
    }
    const user = await prisma.user.findUnique({ where: { phone: normalized } });

    // Uniform response regardless of account existence (no user enumeration)
    const genericMessage = "If this number is registered, a reset code has been sent.";

    if (!user || user.status !== "approved") {
      return NextResponse.json({ success: true, message: genericMessage });
    }

    try {
      const { code, network } = await createOtp(normalized, "reset");
      const smsText = `FarmLink: Your password reset code is ${code}. Valid for 10 minutes. Do not share it. farmlinkgh.app`;
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