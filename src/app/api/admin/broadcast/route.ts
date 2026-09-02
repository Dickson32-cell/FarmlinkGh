import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";

// ADMIN BROADCAST / PROMO SMS.
//
// POST /api/admin/broadcast
//   { message: string,
//     audience: "all" | "buyers" | "farmers" | "region" | "crop",
//     region?: string,      // when audience === "region"
//     crop?: string,        // when audience === "crop" (buyers whose lookingFor matches)
//   }
//   → sends the SAME sanitized GSM-7 single-page SMS to every matching
//     APPROVED user, records an audit entry, returns per-recipient results.
//
// GET /api/admin/broadcast
//   → audience preview: how many users each audience option would reach.
//
// GET /api/admin/broadcast?estimate=1&message=...
//   → length + page check for the composer UI.

// ── audience resolution ─────────────────────────────────────────────────────
async function resolveAudience(audience: string, region?: string, crop?: string) {
  const base = { status: "approved", role: { not: "admin" } } as any;

  if (audience === "buyers") {
    const rows = await prisma.buyer.findMany({
      where: { user: { status: "approved" } },
      select: { user: { select: { id: true, name: true, phone: true, role: true } }, region: true, lookingFor: true },
    });
    if (region) return rows.filter((r) => (r.region || "").toLowerCase() === region.toLowerCase());
    if (crop) {
      const key = crop.trim().toLowerCase();
      return rows.filter((r) => {
        const wants = String(r.lookingFor || "").toLowerCase();
        return wants.includes(key) || wants.split(/[,;/]/).some((w) => w.trim() && key.includes(w.trim()));
      });
    }
    return rows;
  }

  if (audience === "farmers") {
    const rows = await prisma.farmer.findMany({
      where: { user: { status: "approved" } },
      select: { user: { select: { id: true, name: true, phone: true, role: true } }, region: true },
    });
    if (region) return rows.filter((r) => (r.region || "").toLowerCase() === region.toLowerCase());
    return rows;
  }

  if (audience === "region") {
    // Region lives on the Buyer/Farmer profiles, not on User — resolve both.
    if (!region) return [];
    const [buyersInRegion, farmersInRegion] = await Promise.all([
      prisma.buyer.findMany({
        where: { region: { equals: region, mode: "insensitive" }, user: { status: "approved" } },
        select: { user: { select: { id: true, name: true, phone: true, role: true } } },
      }),
      prisma.farmer.findMany({
        where: { region: { equals: region, mode: "insensitive" }, user: { status: "approved" } },
        select: { user: { select: { id: true, name: true, phone: true, role: true } } },
      }),
    ]);
    const seen = new Set<string>();
    const merged: any[] = [];
    for (const r of [...buyersInRegion, ...farmersInRegion]) {
      if (!r.user || seen.has(r.user.id)) continue;
      seen.add(r.user.id);
      merged.push({ user: r.user });
    }
    return merged;
  }

  // "all" — every approved non-admin user
  const users = await prisma.user.findMany({
    where: base,
    select: { id: true, name: true, phone: true, role: true },
  });
  return users.map((u) => ({ user: u, region: "", lookingFor: "" }));
}

type Recipient = { user: { id: string; name: string; phone: string; role: string }; region?: string };

export async function GET(req: NextRequest) {
  const admin = await getAdminSession(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const message = searchParams.get("message");
  if (message !== null) {
    // length check for the composer (GSM-7 single page)
    const sanitized = message
      .replace(/GH₵/gi, "GHS")
      .replace(/₵/g, "GHS ")
      .replace(/[→…–—]/g, "-")
      .replace(/[^\x20-\x7E]/g, "");
    const clean = sanitized.replace(/ {2,}/g, " ").trim();
    return NextResponse.json({
      raw: message.length,
      sanitized: clean.length,
      overLimit: clean.length > 160,
      remaining: Math.max(0, 160 - clean.length),
    });
  }

  // audience size preview
  const [all, buyers, farmers] = await Promise.all([
    resolveAudience("all"),
    resolveAudience("buyers"),
    resolveAudience("farmers"),
  ]);
  // Regions live on Buyer/Farmer profiles — count each side and merge.
  const [buyerRegions, farmerRegions] = await Promise.all([
    prisma.buyer.groupBy({ by: ["region"], where: { user: { status: "approved" } }, _count: { region: true } }),
    prisma.farmer.groupBy({ by: ["region"], where: { user: { status: "approved" } }, _count: { region: true } }),
  ]);
  const regionMap: Record<string, number> = {};
  for (const r of [...(buyerRegions as any[]), ...(farmerRegions as any[])]) {
    if (!r.region) continue;
    regionMap[r.region] = (regionMap[r.region] || 0) + r._count.region;
  }
  return NextResponse.json({
    all: all.length,
    buyers: buyers.length,
    farmers: farmers.length,
    regions: Object.entries(regionMap).map(([region, count]) => ({ region, count })),
  });
}

export async function POST(req: NextRequest) {
  const admin = await getAdminSession(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { message, audience, region, crop } = await req.json();
    if (!message || !String(message).trim())
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    if (!["all", "buyers", "farmers", "region", "crop"].includes(audience))
      return NextResponse.json({ error: "Invalid audience" }, { status: 400 });
    if (audience === "region" && !region)
      return NextResponse.json({ error: "Region required for a region broadcast" }, { status: 400 });
    if (audience === "crop" && !crop)
      return NextResponse.json({ error: "Crop required for a crop broadcast" }, { status: 400 });

    // The sendSms helper sanitizes every message (GHS for GH₵, GSM-7, 160 cap)
    const { sendSms } = await import("@/lib/otp");

    const recipients = (await resolveAudience(audience, region, crop)) as Recipient[];
    if (recipients.length === 0)
      return NextResponse.json({ error: "No approved users match this audience" }, { status: 400 });

    // "FarmLink:" prefix is enforced so recipients always know who is talking,
    // and the whole message stays inside one GSM-7 page after sanitize.
    const body = message.startsWith("FarmLink:") ? message : `FarmLink: ${String(message).trim()}`;

    const results: { phone: string; sent: boolean }[] = [];
    let smsBalance: number | null = null;

    for (const r of recipients) {
      if (!r.user?.phone) continue;
      try {
        const { sent } = await sendSms(r.user.phone, body);
        results.push({ phone: r.user.phone, sent });
      } catch {
        results.push({ phone: r.user.phone, sent: false });
      }
      // gentle pacing so we do not hammer the gateway on a big blast
      await new Promise((res) => setTimeout(res, 60));
    }

    const sentCount = results.filter((r) => r.sent).length;

    // audit trail — one entry per blast with the audience summary
    await prisma.auditLog.create({
      data: {
        actorId: admin.userId,
        actorName: "admin",
        action: "broadcast.sms",
        targetId: `audience:${audience}${region ? `:${region}` : ""}${crop ? `:crop:${crop}` : ""}`,
        details: `${sentCount}/${recipients.length} sent :: ${body.slice(0, 120)}`,
      },
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      audience: { type: audience, region: region || null, crop: crop || null },
      total: recipients.length,
      sent: sentCount,
      failed: recipients.length - sentCount,
      results,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}