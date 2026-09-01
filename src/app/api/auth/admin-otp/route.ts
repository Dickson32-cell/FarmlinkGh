import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { createAdminOtp, verifyAdminOtp, sendAdminCodeEmail } from "@/lib/adminOtp";
import { createAdminActionToken } from "@/lib/auth";

// ADMIN STEP-UP AUTH (money-movement actions):
// POST without body.code → send an admin-action EMAIL code to ADMIN_EMAIL.
// POST with { code }      → verify the code, return a short-lived action
//                           token (10 min TTL) used by admin PATCH endpoints.
// Requires an already-verified admin session (adminVerified cookie) — the
// step-up exists so a stolen session cookie cannot release money alone.

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!me || me.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { code } = body;

    // ---- Step 2: verify the code and mint an action token ----
    if (code) {
      const result = await verifyAdminOtp(String(code).trim(), "admin_action");
      if (!result.ok) {
        const messages: Record<string, string> = {
          expired: "Code expired. Request a new one.",
          locked: "Too many wrong attempts. Request a new code.",
          wrong: "Incorrect code. Please try again.",
        };
        return NextResponse.json(
          { error: messages[result.reason || ""] || "Invalid or expired code" },
          { status: 401 }
        );
      }
      const actionToken = await createAdminActionToken(me.id);
      return NextResponse.json({ actionToken, expiresIn: 600 });
    }

    // ---- Step 1: send the code by email ----
    let ip = req.headers.get("x-forwarded-for") || "";
    if (ip.includes(",")) ip = ip.split(",")[0].trim();

    const { code: emailCode } = await createAdminOtp("admin_action", ip);
    const { sent, provider } = await sendAdminCodeEmail(emailCode, "Payment release");

    return NextResponse.json({
      otpSent: true,
      provider,
      sent,
      message: "Enter the code sent to the admin email to approve this action.",
    });
  } catch (e: any) {
    const msg = e.message || "Admin OTP error";
    return NextResponse.json({ error: msg }, { status: e.message?.includes("Too many") ? 429 : 500 });
  }
}