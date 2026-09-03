import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, getAdminSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const crop = searchParams.get("crop");
  const region = searchParams.get("region");
  const status = searchParams.get("status");
  const where: any = {};
  if (crop) where.crop = crop;
  if (region) where.region = region;
  if (status) where.status = status;

  // Option B: Farmers only see their own listings. Buyers/admin see all.
  const session = await getSession(req);
  if (session && session.role === "farmer") {
    const farmer = await prisma.farmer.findUnique({ where: { userId: session.userId } });
    if (farmer) where.farmerId = farmer.id;
  }

  const listings = await prisma.listing.findMany({
    where,
    include: { farmer: true },
    orderBy: { createdAt: "desc" },
  });

  // RELAYED-ORDER MODEL: mask the farmer's phone in listing payloads unless
  // the viewer is a farmer (their own), an admin, or a buyer with a PAID
  // order for that specific listing.
  let paidListingIds = new Set<string>();
  let isFarmerOrAdmin = false;
  if (!session) {
    // anonymous: mask everything
  } else if (session.role === "farmer" || session.role === "admin") {
    isFarmerOrAdmin = true;
  } else if (session.role === "buyer") {
    const paidOrders = await prisma.order.findMany({
      where: {
        buyerId: session.userId,
        status: { in: ["paid", "delivered", "released"] },
      },
      select: { listingId: true },
    });
    paidListingIds = new Set(paidOrders.map((o) => o.listingId));
  }

  const masked = listings.map((l: any) => {
    // Buyers never see farmer phones (farmer initiates contact after payment).
  const unlocked = isFarmerOrAdmin;
    return {
      ...l,
      farmer: l.farmer ? { ...l.farmer, phone: unlocked ? l.farmer.phone : "" } : l.farmer,
      contactUnlocked: unlocked,
    };
  });

  return NextResponse.json(masked);
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const farmer = await prisma.farmer.findUnique({ where: { userId: session.userId } });
    if (!farmer) return NextResponse.json({ error: "Farmer profile not found" }, { status: 404 });

    // Register the crop as a product if it's new — so it appears in
    // suggestions for every farmer from then on.
    const cropName = String(body.crop || "").trim();
    if (cropName) {
      await prisma.product.upsert({
        where: { name: cropName },
        update: {},
        create: { name: cropName, createdBy: session.userId },
      }).catch(() => { /* non-fatal */ });
    }

    const listing = await prisma.listing.create({
      data: {
        crop: body.crop,
        quantity: parseInt(body.quantity),
        price: parseFloat(body.price),
        grade: body.grade || "Grade B — Good",
        region: body.region || farmer.region,
        location: body.location || farmer.town,
        farmerId: farmer.id,
        harvestDate: body.harvestDate || new Date().toISOString().slice(0, 10),
        notes: body.notes || "",
        images: JSON.stringify(body.images || []),
        status: "available",
        postedDate: new Date().toISOString().slice(0, 10),
      },
    });

    // ---- Price-alert SMS to interested buyers (non-fatal) ----
    // Notify approved buyers who are "looking for" this crop when a NEW
    // listing is either the first of its crop or cheaper than the previous
    // lowest price. This brings buyers back to the site to purchase.
    try {
      const cropKey = String(body.crop || "").trim().toLowerCase();
      if (cropKey) {
        // previous lowest available price for this crop (excluding the new listing)
        const existing = await prisma.listing.findMany({
          where: { status: "available", id: { not: listing.id } },
          select: { crop: true, price: true },
        });
        const sameCrop = existing.filter((l) => l.crop.trim().toLowerCase() === cropKey);
        const prevLowest = sameCrop.length > 0 ? Math.min(...sameCrop.map((l) => l.price)) : null;
        const isFirst = prevLowest === null;
        const isCheaper = prevLowest !== null && listing.price < prevLowest;

        if (isFirst || isCheaper) {
          // approved buyers looking for this product
          const buyers = await prisma.buyer.findMany({
            where: { user: { status: "approved" } },
            select: { lookingFor: true, name: true, user: { select: { phone: true } } },
          });
          const { sendSms } = await import("@/lib/otp");

          for (const b of buyers) {
            const wants = String(b.lookingFor || "").toLowerCase();
            const matches = wants.includes(cropKey) || wants.split(/[,;\/]/).some((w) => w.trim() && cropKey.includes(w.trim()));
            if (!matches || !b.user?.phone) continue;

            const msg = isFirst
              ? `FarmLink: ${body.crop} is now on the market - GH₵${listing.price}/bag by ${farmer.name} in ${listing.region}. Login to buy: farmlinkghana.vercel.app`
              : `FarmLink: Price drop! ${body.crop} now GH₵${listing.price}/bag (was GH₵${prevLowest}). By ${farmer.name} in ${listing.region}. farmlinkghana.vercel.app`;
            await sendSms(b.user.phone, msg).catch(() => { });
            // throttle: tiny pause avoids hammering the SMS API
            await new Promise((r) => setTimeout(r, 50));
          }
        }

        // ── WISHLIST ALERT: buyers who saved this exact crop also get an
        // in-app notification (on top of the SMS above) ──
        if (isFirst || isCheaper) {
          const wishers = await prisma.wishlist.findMany({
            where: { crop: { equals: body.crop, mode: "insensitive" } },
            select: { userId: true },
            distinct: ["userId"],
          });
          for (const w of wishers) {
            await prisma.notification.create({
              data: {
                userId: w.userId,
                type: "price",
                title: isFirst ? `${body.crop} is now on the market` : `Price drop — ${body.crop}`,
                body: isFirst
                  ? `${body.crop} is now listed at GH₵${listing.price}/bag by ${farmer.name} in ${listing.region}.`
                  : `${body.crop} now costs GH₵${listing.price}/bag (was GH₵${prevLowest}). By ${farmer.name} in ${listing.region}.`,
                link: `/market/${listing.id}`,
              },
            }).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.error("[PRICE-ALERT] skipped:", String(err).slice(0, 120));
    }

    return NextResponse.json(listing);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id, status } = await req.json();

    const listing = await prisma.listing.findUnique({ where: { id } });
    if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

    // Ownership rules:
    //  - Admin (verified session) may set any status
    //  - The owning farmer may set their own listing's status (available/reserved/sold)
    //  - Any other logged-in user may ONLY reserve an available listing
    const adminSession = await getAdminSession(req);
    if (adminSession) {
      const valid = ["available", "reserved", "sold"];
      if (!valid.includes(status))
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    } else if (session.role === "farmer") {
      const farmer = await prisma.farmer.findUnique({ where: { userId: session.userId } });
      if (!farmer || listing.farmerId !== farmer.id)
        return NextResponse.json({ error: "You can only update your own listings" }, { status: 403 });
      const valid = ["available", "reserved", "sold"];
      if (!valid.includes(status))
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    } else {
      // buyer / other users: reserve only, and only if still available
      if (status !== "reserved")
        return NextResponse.json({ error: "You can only reserve listings" }, { status: 403 });
      if (listing.status !== "available")
        return NextResponse.json({ error: "This listing is no longer available" }, { status: 400 });
    }

    const updated = await prisma.listing.update({ where: { id }, data: { status } });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "farmer") return NextResponse.json({ error: "Only farmers can edit listings" }, { status: 403 });
  try {
    const body = await req.json();
    const farmer = await prisma.farmer.findUnique({ where: { userId: session.userId } });
    if (!farmer) return NextResponse.json({ error: "Farmer profile not found" }, { status: 404 });

    // Verify the listing belongs to this farmer
    const existing = await prisma.listing.findUnique({ where: { id: body.id } });
    if (!existing || existing.farmerId !== farmer.id)
      return NextResponse.json({ error: "You can only edit your own listings" }, { status: 403 });

    const listing = await prisma.listing.update({
      where: { id: body.id },
      data: {
        crop: body.crop,
        quantity: parseInt(body.quantity),
        price: parseFloat(body.price),
        region: body.region || farmer.region,
        location: body.location || farmer.town,
        harvestDate: body.harvestDate || existing.harvestDate,
        notes: body.notes ?? existing.notes,
        images: JSON.stringify(body.images || []),
        status: body.status || existing.status,
      },
    });
    return NextResponse.json(listing);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  // Ownership: the owning farmer or a verified admin may delete.
  const adminSession = await getAdminSession(req);
  if (!adminSession) {
    if (session.role !== "farmer")
      return NextResponse.json({ error: "Only the owner can delete this listing" }, { status: 403 });
    const farmer = await prisma.farmer.findUnique({ where: { userId: session.userId } });
    const listing = await prisma.listing.findUnique({ where: { id } });
    if (!farmer || !listing || listing.farmerId !== farmer.id)
      return NextResponse.json({ error: "You can only delete your own listings" }, { status: 403 });
  }

  await prisma.listing.delete({ where: { id } });
  return NextResponse.json({ success: true });
}