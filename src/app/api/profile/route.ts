import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    if (session.role === "farmer") {
      const farmer = await prisma.farmer.findUnique({ where: { userId: session.userId } });
      return NextResponse.json(farmer || {});
    } else {
      const buyer = await prisma.buyer.findUnique({ where: { userId: session.userId } });
      return NextResponse.json(buyer || {});
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    if (session.role === "farmer") {
      const farmer = await prisma.farmer.update({
        where: { userId: session.userId },
        data: { region: body.region, town: body.town, farmSize: body.farmSize, mainCrops: body.mainCrops },
      });
      return NextResponse.json(farmer);
    } else {
      const buyer = await prisma.buyer.update({
        where: { userId: session.userId },
        data: {
          businessType: body.businessType,
          region: body.region ?? undefined,
          location: body.location,
          lookingFor: body.lookingFor,
        },
      });
      return NextResponse.json(buyer);
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}