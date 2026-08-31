import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const prices = await prisma.price.findMany({ orderBy: { date: "desc" } });
  return NextResponse.json(prices);
}

export async function POST(req: NextRequest) {
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