import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// POST /api/listings/contact-check { listingIds: [...] }
// → { unlocked: { [listingId]: true } } for listings the current buyer has
// PAID for. One request for the whole market grid.
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ unlocked: {} });

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.listingIds) ? body.listingIds.filter((x: unknown) => typeof x === "string") : [];
  if (ids.length === 0) return NextResponse.json({ unlocked: {} });

  // admins see all contact; farmers' own listings are handled client-side
  if (session.role === "admin") {
    const unlocked: Record<string, boolean> = {};
    ids.forEach((id) => { unlocked[id] = true; });
    return NextResponse.json({ unlocked });
  }

  const paidOrders = await prisma.order.findMany({
    where: {
      buyerId: session.userId,
      listingId: { in: ids },
      status: { in: ["paid", "delivered", "released"] },
    },
    select: { listingId: true },
  });

  const unlocked: Record<string, boolean> = {};
  paidOrders.forEach((o) => { unlocked[o.listingId] = true; });
  return NextResponse.json({ unlocked });
}