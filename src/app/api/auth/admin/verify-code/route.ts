import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminOtp } from "@/lib/adminOtp";
import { createAdminToken } from "@/lib/auth";

// POST /api/auth/admin/verify-code
// Step 2 of ADMIN login — verify the EMAIL code sent to ADMIN_EMAIL
// (dicksonapam@gmail.com) and mint a 12-hour admin session cookie.
// The cookie carries adminVerified=true — admin API surfaces require it.
export async function POST(req: NextRequest) {
  try {
    const { phone, password, code } = await req.json();
    if (!phone || !code) {
      return NextResponse.json({ error: "Phone and code required" }, { status: 400 });
    }

    // Re-check credentials — the code alone must never be enough
    const { verifyPassword } = await import("@/lib/auth");
    const user = await prisma.user.findUnique({ where: { phone: phone.trim() } });
    if (!user || user.role !== "admin" || user.status !== "approved") {
      return NextResponse.json({ error: "Verification failed" }, { status: 401 });
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return NextResponse.json({ error: "Account temporarily locked. Try again later." }, { status: 423 });
    }
    const valid = password ? await verifyPassword(password, user.password) : false;
    if (!valid) {
      const fails = user.failedLogins + 1;
      await prisma.user.update({ where: { id: user.id }, data: { failedLogins: fails } });
      if (fails >= 5) {
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLogins: 0, lockedUntil: new Date(Date.now() + 15 * 60 * 1000) },
        });
      }
      return NextResponse.json({ error: "Verification failed" }, { status: 401 });
    }

    const result = await verifyAdminOtp(String(code).trim(), "admin_login");
    if (!result.ok) {
      const messages: Record<string, string> = {
        expired: "Code expired. Request a new one.",
        locked: "Too many wrong attempts. Request a new code.",
        wrong: "Incorrect code. Please try again.",
      };
      return NextResponse.json(
        { error: messages[result.reason || ""] || "Verification failed" },
        { status: 401 }
      );
    }

    // Success → mint the 12h admin session
    const token = await createAdminToken(user.id);
    const res = NextResponse.json({ id: user.id, name: user.name, role: user.role });
    res.cookies.set("farmlink_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 12 * 60 * 60, // 12 hours
      path: "/",
    });

    // Audit trail
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        actorName: user.name,
        action: "admin.login",
        targetId: user.id,
        details: `Admin email-code login verified (12h session minted)`,
      },
    });

    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}