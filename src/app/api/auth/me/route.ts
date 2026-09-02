import { NextRequest, NextResponse } from "next/server";
import { verifyToken, verifyAdminToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/auth/me — current session info.
// For admins this reports adminVerified: true only when the cookie is a
// 12h admin session minted after the email-code check. role=admin without
// adminVerified means "credentials OK, email code still required".
export async function GET(req: NextRequest) {
  const token = req.cookies.get("farmlink_token")?.value;
  if (!token) return NextResponse.json({ user: null });
  const adminSession = await verifyAdminToken(token);
  if (adminSession) {
    const user = await prisma.user.findUnique({
      where: { id: adminSession.userId },
      select: { id: true, name: true, phone: true, role: true },
    });
    if (user) return NextResponse.json({ user: { ...user, adminVerified: true } });
    return NextResponse.json({ user: null });
  }
  const session = await verifyToken(token);
  if (!session) return NextResponse.json({ user: null });
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, phone: true, role: true, profileImageUrl: true },
  });
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: {
      ...user,
      adminVerified: false, // admin whose session is not email-verified yet
    },
  });
}