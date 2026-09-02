import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// GET reviews for a farmer
export async function GET(req: NextRequest) {
  const farmerId = new URL(req.url).searchParams.get("farmerId");
  if (!farmerId) return NextResponse.json([]);
  const reviews = await prisma.review.findMany({
    where: { farmerId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(reviews);
}

// POST a new review
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "buyer")
    return NextResponse.json({ error: "Only buyers can leave reviews" }, { status: 403 });

  try {
    const { farmerId, rating, comment } = await req.json();
    if (!farmerId || !rating || rating < 1 || rating > 5)
      return NextResponse.json({ error: "farmerId and rating (1-5) required" }, { status: 400 });

    // Review integrity: only buyers who COMPLETED an order with this farmer
    // may review them. This stops fake/retaliation reviews from arbitrary users.
    const completed = await prisma.order.findFirst({
      where: {
        buyerId: session.userId,
        farmerId,
        status: { in: ["delivered", "released"] },
      },
    });
    if (!completed) {
      return NextResponse.json(
        { error: "You can only review farmers you have completed an order with" },
        { status: 403 }
      );
    }

    const buyer = await prisma.buyer.findUnique({ where: { userId: session.userId } });

    // One review per buyer-farmer pair: if the buyer already reviewed this
    // farmer, UPDATE their review instead of creating a duplicate (stops
    // multi-order buyers from inflating a farmer's rating).
    const existing = await prisma.review.findFirst({
      where: { farmerId, buyerId: session.userId },
    });
    const review = existing
      ? await prisma.review.update({
          where: { id: existing.id },
          data: {
            rating: parseInt(rating),
            comment: comment || "",
            createdAt: new Date(), // bump to top of "most recent"
          },
        })
      : await prisma.review.create({
          data: {
            farmerId,
            buyerId: session.userId,
            buyerName: buyer?.name || "Anonymous",
            rating: parseInt(rating),
            comment: comment || "",
          },
        });
    return NextResponse.json(review);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}