import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, getAdminSession } from "@/lib/session";

// ADMIN PUSH SUBSCRIPTIONS — the admin's browser registers here so alerts
// reach the phone even with the site closed (offline notifications).
// POST   { endpoint, keys: { p256dh, auth } }  → save (admin only)
// DELETE { endpoint }                           → unsubscribe (admin only)

async function requireAdmin(req: NextRequest) {
  // The admin session is the strongest claim, but the admin also has a
  // regular session right after login — accept either, then verify role.
  const session = (await getAdminSession(req)) || (await getSession(req));
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.role !== "admin") return null;
  return user;
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admin session required" }, { status: 401 });
  try {
    const body = await req.json();
    const { endpoint, keys } = body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }
    // upsert by endpoint — one row per browser/device, refreshed tokens overwrite
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId: admin.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      update: { userId: admin.id, p256dh: keys.p256dh, auth: keys.auth },
    });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admin session required" }, { status: 401 });
  try {
    const { endpoint } = await req.json();
    if (!endpoint) return NextResponse.json({ error: "endpoint required" }, { status: 400 });
    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}