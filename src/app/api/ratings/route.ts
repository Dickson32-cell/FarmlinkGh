import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/ratings?farmerIds=a,b,c — public batch rating summary.
// Returns { [farmerId]: { avg: number, count: number } } so the market page
// can show stars on every listing card with a single request.
export async function GET(req: NextRequest) {
  const idsParam = new URL(req.url).searchParams.get("farmerIds") || "";
  const farmerIds = idsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50);
  if (farmerIds.length === 0) return NextResponse.json({});

  const grouped = await prisma.review.groupBy({
    by: ["farmerId"],
    where: { farmerId: { in: farmerIds } },
    _avg: { rating: true },
    _count: { rating: true },
  });

  const out: Record<string, { avg: number; count: number }> = {};
  for (const g of grouped) {
    out[g.farmerId] = {
      avg: g._avg.rating ? Math.round(g._avg.rating * 10) / 10 : 0,
      count: g._count.rating,
    };
  }
  return NextResponse.json(out);
}