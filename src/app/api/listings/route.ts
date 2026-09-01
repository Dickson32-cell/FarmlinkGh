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
  return NextResponse.json(listings);
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