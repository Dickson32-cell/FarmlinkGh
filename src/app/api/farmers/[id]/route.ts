import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// GET /api/farmers/[id] — public farmer profile for the marketplace.
// Returns the farmer's info, their active listings, and their rating
// summary (average 1-5 stars + review count) from completed-order buyers.
//
// RELAYED-ORDER MODEL: the farmer's PHONE is masked unless the viewer is
// the farmer themselves, an admin, or a buyer with a PAID order for one of
// their listings. Devtools-snooping does not reveal the number either.
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const farmer = await prisma.farmer.findUnique({
      where: { id },
      select: {
        id: true, name: true, phone: true, region: true, town: true,
        farmSize: true, mainCrops: true, userId: true,
      },
    });
    if (!farmer) return NextResponse.json({ error: "Farmer not found" }, { status: 404 });

    const [listings, reviews, agg] = await Promise.all([
      prisma.listing.findMany({
        where: { farmerId: id, status: "available" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.review.findMany({
        where: { farmerId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.review.aggregate({
        where: { farmerId: id },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

    const avgRating = agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : 0;
    const reviewCount = agg._count.rating || 0;

    // PARTIAL STOCK: live remaining counts on the farmer's shop listings
    const { remainingMap } = await import("@/lib/stock");
    const stockMap = await remainingMap(listings.map((l: any) => ({ id: l.id, quantity: l.quantity })));
    const listingsWithStock = listings.map((l: any) => ({ ...l, remaining: stockMap[l.id] ?? l.quantity }));

    // Contact unlock — POLICY (2026-09): farmer self + admin only.
    // Buyers never see the farmer's phone, paid or not (Jumia-style);
    // the farmer receives the buyer's details and initiates delivery.
    let contactUnlocked = false;
    const session = await getSession(req);
    if (session) {
      if (session.role === "admin" || session.userId === farmer.userId) {
        contactUnlocked = true;
      }
    }

    return NextResponse.json({
      farmer: {
        ...farmer,
        // mask the phone in the API payload unless contact is unlocked
        phone: contactUnlocked ? farmer.phone : "",
        contactUnlocked,
        avgRating,
        reviewCount,
      },
      listings: listingsWithStock,
      reviews,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}