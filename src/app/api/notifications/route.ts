import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// In-app notifications for buyers + farmers.
// GET  ?count=1  → just the unread count (for the header bell)
// GET  (default) → latest 50 notifications
// PATCH { id? }   → mark one/all as read
// DELETE          → clear ALL notifications for the caller

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  if (searchParams.get("count") === "1") {
    const unread = await prisma.notification.count({
      where: { userId: session.userId, read: false },
    });
    return NextResponse.json({ unread });
  }

  const items = await prisma.notification.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(items);
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json().catch(() => ({ id: undefined }));
  if (id) {
    // mark one as read (ownership enforced by the userId filter)
    await prisma.notification.updateMany({
      where: { id, userId: session.userId },
      data: { read: true },
    });
  } else {
    // mark all as read
    await prisma.notification.updateMany({
      where: { userId: session.userId, read: false },
      data: { read: true },
    });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.notification.deleteMany({ where: { userId: session.userId } });
  return NextResponse.json({ cleared: true });
}