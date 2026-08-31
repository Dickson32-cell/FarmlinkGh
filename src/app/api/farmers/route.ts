import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const farmers = await prisma.farmer.findMany({ include: { listings: true } });
  return NextResponse.json(farmers);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const farmer = await prisma.farmer.create({
      data: {
        userId: body.userId,
        name: body.name,
        phone: body.phone,
        region: body.region,
        town: body.town,
        farmSize: parseFloat(body.farmSize) || 0,
        mainCrops: body.mainCrops,
      },
    });
    return NextResponse.json(farmer);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}