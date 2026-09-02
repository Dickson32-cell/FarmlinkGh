import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/farmers/[id] — public farmer profile for the marketplace.
// Returns the farmer's info, their active listings, and their rating
// summary (average 1-5 stars + review count) from completed-order buyers.
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

    return NextResponse.json({
      farmer: {
        ...farmer,
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