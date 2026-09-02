import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// Buyer wishlist — add / remove / list saved listings.
// GET    → the caller's wishlist with live listing data
// POST   { listingId }       → save a listing
// DELETE { listingId }       → remove a listing

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.wishlist.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
  });

  // Attach live listing data (a wishlisted listing may be sold or deleted)
  const listingIds = rows.map((r) => r.listingId);
  const listings = listingIds.length
    ? await prisma.listing.findMany({ where: { id: { in: listingIds } }, include: { farmer: true } })
    : [];
  const byId = Object.fromEntries(listings.map((l) => [l.id, l]));

  // Reuse the same contact-masking rule as the market: farmer phone only
  // visible to the farmer themself or the admin (buyers unlock by paying).
  const isFarmerOrAdmin = session.role === "admin" || session.role === "farmer";

  const items = rows.map((r) => {
    const l: any = byId[r.listingId] || null;
    return {
      id: r.id,
      listingId: r.listingId,
      crop: r.crop,
      savedAt: r.createdAt,
      listing: l
        ? {
            id: l.id,
            crop: l.crop,
            quantity: l.quantity,
            price: l.price,
            unit: l.unit,
            location: l.location,
            region: l.region,
            status: l.status,
            images: l.images,
            farmerName: l.farmer?.name || "",
            farmerPhone: isFarmerOrAdmin ? l.farmer?.phone || "" : "",
            farmerId: l.farmer?.id || "",
          }
        : null,
    };
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "buyer")
    return NextResponse.json({ error: "Only buyers can save listings to a wishlist" }, { status: 403 });

  const { listingId } = await req.json();
  if (!listingId) return NextResponse.json({ error: "listingId required" }, { status: 400 });

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  // upsert — one row per buyer per listing
  const saved = await prisma.wishlist.upsert({
    where: { userId_listingId: { userId: session.userId, listingId } },
    update: {},
    create: { userId: session.userId, listingId, crop: listing.crop },
  });

  return NextResponse.json({ saved: true, id: saved.id });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { listingId } = await req.json();
  if (!listingId) return NextResponse.json({ error: "listingId required" }, { status: 400 });

  await prisma.wishlist.deleteMany({ where: { userId: session.userId, listingId } });
  return NextResponse.json({ removed: true });
}