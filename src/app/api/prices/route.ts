import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";

export async function GET() {
  const prices = await prisma.price.findMany({ orderBy: { date: "desc" } });
  return NextResponse.json(prices);
}

// POST: verified admin only — market prices are published data,
// nobody else may write them.
export async function POST(req: NextRequest) {
  const admin = await getAdminSession(req);
  if (!admin) return NextResponse.json({ error: "Admin session required" }, { status: 401 });
  try {
    const body = await req.json();
    const price = await prisma.price.create({
      data: {
        crop: body.crop,
        market: body.market,
        region: body.region,
        lowPrice: parseFloat(body.lowPrice),
        highPrice: parseFloat(body.highPrice),
        trend: body.trend || "stable",
        date: body.date || new Date().toISOString().slice(0, 10),
      },
    });
    return NextResponse.json(price);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}