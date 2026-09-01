import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public platform stats — count APPROVED users only.
// Rejected/pending signups must not appear as platform members
// (Joseph's rejected registration was inflating the farmer count).
export async function GET() {
  try {
    const [farmers, buyers, listings] = await Promise.all([
      prisma.user.count({ where: { role: "farmer", status: "approved" } }),
      prisma.user.count({ where: { role: "buyer", status: "approved" } }),
      prisma.listing.count({ where: { status: "available" } }),
    ]);
    return NextResponse.json({ farmers, buyers, listings });
  } catch {
    return NextResponse.json({ farmers: 0, buyers: 0, listings: 0 });
  }
}