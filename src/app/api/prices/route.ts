import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";

// GET: today's market prices, assembled AUTOMATICALLY from what farmers
// actually listed — buyers always see a live board even before any admin
// publishes manual rows. Admin-published rows (authoritative market data)
// take precedence for their crop; listing-derived rows fill the rest.
//
// The board reflects real FarmLink prices: each available listing IS a
// price a farmer is offering today. Aggregated per crop with low/high
// across regions and a trend vs the previous day.
export async function GET() {
  const [adminPrices, availableListings] = await Promise.all([
    prisma.price.findMany({ orderBy: { date: "desc" } }),
    prisma.listing.findMany({
      where: { status: "available" },
      select: { crop: true, price: true, region: true, location: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Keep only the newest admin row per crop
  const adminByCrop = new Map<string, any>();
  for (const p of adminPrices) {
    if (!adminByCrop.has(p.crop)) adminByCrop.set(p.crop, p);
  }

  // Aggregate listings per crop: low/high price, regions covered, cheapest source
  const today = new Date().toISOString().slice(0, 10);
  const byCrop = new Map<string, { prices: number[]; regions: Set<string>; source: string; date: string }>();
  for (const l of availableListings) {
    const key = l.crop.trim();
    if (!key) continue;
    const entry = byCrop.get(key) || { prices: [], regions: new Set<string>(), source: "", date: today };
    entry.prices.push(l.price);
    entry.regions.add(l.region || "Ghana");
    if (!entry.source) entry.source = `${l.location || l.region}, ${l.region}`;
    byCrop.set(key, entry);
  }

  const rows: any[] = [];

  // 1. Listing-derived rows (today's real farmgate prices)
  for (const [crop, agg] of byCrop) {
    const low = Math.min(...agg.prices);
    const high = Math.max(...agg.prices);
    // trend vs admin's most recent published low for the same crop
    const adminRow = adminByCrop.get(crop);
    let trend = "stable";
    if (adminRow && adminRow.date !== today) {
      if (low < adminRow.lowPrice) trend = "down";
      else if (low > adminRow.lowPrice) trend = "up";
    }
    rows.push({
      id: `listing-${crop.toLowerCase().replace(/\s+/g, "-")}`,
      crop,
      market: `FarmLink farmgate (${[...agg.regions].join(", ")})`,
      region: [...agg.regions].join(", "),
      lowPrice: low,
      highPrice: high,
      trend,
      date: agg.date,
      sources: agg.prices.length,
    });
  }

  // 2. Admin-published rows for crops no farmer currently lists (still useful info)
  for (const [crop, p] of adminByCrop) {
    if (!byCrop.has(crop.trim())) {
      rows.push({ ...p, sources: 0 });
    }
  }

  rows.sort((a, b) => b.date.localeCompare(a.date) || a.crop.localeCompare(b.crop));
  return NextResponse.json(rows);
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