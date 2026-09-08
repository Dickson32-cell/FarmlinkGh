import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, getAdminSession } from "@/lib/session";

// GET /api/farmers — public directory of verified farmers.
// SECURITY (contact-masking policy): farmer phone numbers are NEVER exposed
// through this endpoint. Buyers unlock a farmer's contact only through the
// order flow (Jumia-style masking). Admins see everything.
export async function GET(req: NextRequest) {
  const [admin, farmers] = await Promise.all([
    getAdminSession(req),
    prisma.farmer.findMany({
      include: { listings: { where: { status: "available" } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const safe = farmers.map((f: any) => ({
    id: f.id,
    userId: f.userId,
    name: f.name,
    region: f.region,
    town: f.town,
    farmSize: f.farmSize,
    mainCrops: f.mainCrops,
    createdAt: f.createdAt,
    // Phone is masked for everyone except a verified admin session
    phone: admin ? f.phone : "0" + "X".repeat(9),
    listings: f.listings,
  }));
  return NextResponse.json(safe);
}

// POST /api/farmers — create the farmer profile. SECURITY:
//   1. Requires a logged-in session — no anonymous writes.
//   2. The profile must belong to the CALLER (userId from the session, not the body)
//      — an attacker cannot create profiles for other users.
//   3. Caller's account must actually be a FARMER role — buyers cannot
//      mint farmer profiles (bypasses Ghana Card verification otherwise).
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  // Load the caller's real account — never trust the body's userId
  const caller = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true, status: true, name: true, phone: true },
  });
  if (!caller || caller.role !== "farmer") {
    return NextResponse.json({ error: "Only farmer accounts can create farmer profiles" }, { status: 403 });
  }

  // One profile per farmer
  const existing = await prisma.farmer.findUnique({ where: { userId: caller.id } });
  if (existing) {
    return NextResponse.json({ error: "Farmer profile already exists" }, { status: 409 });
  }

  try {
    const body = await req.json();
    const region = String(body.region || "").trim();
    const town = String(body.town || "").trim();
    const mainCrops = String(body.mainCrops || "").trim();
    const farmSize = parseFloat(body.farmSize) || 0;
    if (!region || !town || !mainCrops) {
      return NextResponse.json({ error: "Region, town and main crops are required" }, { status: 400 });
    }
    if (farmSize < 0 || farmSize > 100000) {
      return NextResponse.json({ error: "Invalid farm size" }, { status: 400 });
    }

    const farmer = await prisma.farmer.create({
      data: {
        userId: caller.id,
        name: caller.name,     // profile name from the verified account
        phone: caller.phone,   // phone from the verified account
        region,
        town,
        farmSize,
        mainCrops,
      },
    });
    return NextResponse.json(farmer);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}