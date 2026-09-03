import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// POST /api/listings/contact-check { listingIds: [...] }
// → { unlocked: { [listingId]: true } } — POLICY (2026-09): only admins
// (and farmers viewing their own listings client-side) ever see farmer
// contact. Buyers NEVER unlock it, paid or not — the farmer receives
// the buyer's details and initiates delivery (Jumia-style).
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ unlocked: {} });

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.listingIds) ? body.listingIds.filter((x: unknown) => typeof x === "string") : [];
  if (ids.length === 0) return NextResponse.json({ unlocked: {} });

  // admins see all contact
  if (session.role === "admin") {
    const unlocked: Record<string, boolean> = {};
    ids.forEach((id) => { unlocked[id] = true; });
    return NextResponse.json({ unlocked });
  }

  // buyers (and any other role): nothing unlocks
  const unlocked: Record<string, boolean> = {};
  ids.forEach((id) => { unlocked[id] = false; });
  return NextResponse.json({ unlocked });
}