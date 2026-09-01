import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { createOtp, sendSms, detectNetwork } from "@/lib/otp";
import { createAdminOtp, sendAdminCodeEmail, ADMIN_EMAIL } from "@/lib/adminOtp";

// POST: Step 1 of 2FA login — verify phone+password, then send an OTP.
// A session is NOT issued here. Client must complete:
//   farmer/buyer → /api/auth/verify-otp        (SMS code)
//   admin        → /api/auth/admin/verify-code (EMAIL code to ADMIN_EMAIL)
export async function POST(req: NextRequest) {
  try {
    const { phone, password } = await req.json();
    if (!phone || !password) {
      return NextResponse.json({ error: "Phone and password required" }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Brute-force lockout: 5 consecutive fails = 15 min lock
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Account temporarily locked after failed attempts. Try again in ${mins} min.` },
        { status: 423 }
      );
    }

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      const fails = user.failedLogins + 1;
      if (fails >= 5) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLogins: 0,
            lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
          },
        });
        return NextResponse.json(
          { error: "Too many failed attempts. Account locked for 15 minutes." },
          { status: 423 }
        );
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: fails },
      });
      // uniform error — never reveal whether the phone exists
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // success → reset failure counter
    if (user.failedLogins > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: 0, lockedUntil: null },
      });
    }
    if (user.status === "pending") {
      return NextResponse.json(
        {
          error: "Your account is pending verification. This takes 2–3 working days. You will be able to log in once approved.",
          status: "pending",
        },
        { status: 403 }
      );
    }
    if (user.status === "rejected") {
      return NextResponse.json(
        {
          error: "Your account was not approved. Please contact support — 0595726252 / info.rametechconsultancy@gmail.com — or re-register with a valid Ghana Card.",
          status: "rejected",
        },
        { status: 403 }
      );
    }

    if (user.role === "admin") {
      // ─── ADMIN PATH: email code to ADMIN_EMAIL ───
      console.log(` ADMIN LOGIN attempt: ${user.name} (${phone}) at ${new Date().toISOString()}`);

      let ip = req.headers.get("x-forwarded-for") || "";
      if (ip.includes(",")) ip = ip.split(",")[0].trim();

      const { code } = await createAdminOtp("admin_login", ip);
      const { sent, provider } = await sendAdminCodeEmail(code, "Admin login");

      const masked = ADMIN_EMAIL.replace(/^(.{3}).*(@.*)$/, "$1•••••$2");
      return NextResponse.json({
        otpRequired: true,
        adminLogin: true,
        email: masked,
        emailSent: sent,
        provider,
        message: sent
          ? `Verification code sent to ${masked}. FarmLink admin access requires email verification.`
          : `Email delivery to ${masked} failed (${provider}). The code is saved in the server function logs — Vercel → Deployments → Functions → Logs, search ADMIN-EMAIL-FALLBACK.`,
      });
    }

    // ─── FARMER / BUYER PATH: SMS code ───
    // Record the network this user's phone belongs to (visible on the OTP screen)
    const network = detectNetwork(phone);
    if (user.lastNetwork !== network) {
      await prisma.user.update({ where: { id: user.id }, data: { lastNetwork: network } });
    }

    if (!user.twoFactorEnabled) {
      // 2FA disabled for this account → issue session directly (legacy behaviour)
      const { createToken } = await import("@/lib/auth");
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
    }

    // ---- 2FA path ----
    const OTP_TTL_MINUTES = 10;
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await prisma.otpCode.count({
      where: { phone, createdAt: { gte: hourAgo } },
    });
    if (recent >= 5) {
      return NextResponse.json(
        { error: "Too many verification codes requested. Please wait a few minutes." },
        { status: 429 }
      );
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    const bcrypt = (await import("bcryptjs")).default;
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    // invalidate previous unused codes
    await prisma.otpCode.updateMany({ where: { phone, used: false }, data: { used: true } });
    await prisma.otpCode.create({ data: { phone, codeHash, purpose: "login", expiresAt } });

    const masked = phone.slice(0, 4) + "****" + phone.slice(-3);
    const smsText = `FarmLink: Your login code is ${code}. Valid for 10 minutes. Do not share this code with anyone.`;
    const { sent, provider } = await sendSms(phone, smsText);

    if (provider === "console") {
      // Dev mode: the code is in the server console — tell the user it's simulated
      return NextResponse.json({
        otpRequired: true,
        phone: masked,
        network,
        devCode: process.env.NODE_ENV !== "production" ? code : undefined,
        message: `Verification code sent to ${masked} (${network}).`,
        simulated: !sent,
      });
    }

    return NextResponse.json({
      otpRequired: true,
      phone: masked,
      network,
      smsSent: sent,
      message: `Verification code sent to ${masked} (${network}).`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}