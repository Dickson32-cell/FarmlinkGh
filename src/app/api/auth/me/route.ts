import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("farmlink_token")?.value;
  console.log("Auth/me - Token present:", !!token);
  if (!token) return NextResponse.json({ user: null });
  const session = await verifyToken(token);
  console.log("Auth/me - Session verified:", !!session);
  if (!session) return NextResponse.json({ user: null });
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, phone: true, role: true },
  });
  console.log("Auth/me - User found in DB:", !!user);
  return NextResponse.json({ user });
}