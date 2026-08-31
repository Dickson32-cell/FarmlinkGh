import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [farmers, buyers, listings] = await Promise.all([
      prisma.farmer.count(),
      prisma.buyer.count(),
      prisma.listing.count(),
    ]);
    return NextResponse.json({ farmers, buyers, listings });
  } catch {
    return NextResponse.json({ farmers: 0, buyers: 0, listings: 0 });
  }
}