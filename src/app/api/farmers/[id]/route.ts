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

    // Contact unlock check — farmer self, admin, or paid buyer
    let contactUnlocked = false;
    const session = await getSession(req);
    if (session) {
      if (session.role === "admin" || session.userId === farmer.userId) {
        contactUnlocked = true;
      } else if (session.role === "buyer") {
        // Orders store raw listingId (no FK relation) — resolve this farmer's
        // listings first, then check for a paid order on any of them
        const farmerListings = await prisma.listing.findMany({
          where: { farmerId: id },
          select: { id: true },
        });
        const paidOrder = farmerListings.length
          ? await prisma.order.findFirst({
              where: {
                buyerId: session.userId,
                status: { in: ["paid", "delivered", "released"] },
                listingId: { in: farmerListings.map((l) => l.id) },
              },
              select: { id: true },
            })
          : null;
        contactUnlocked = !!paidOrder;
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
      listings,
      reviews,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}