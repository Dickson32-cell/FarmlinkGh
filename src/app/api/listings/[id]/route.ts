import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// GET /api/listings/[id] — single listing.
// RELAYED-ORDER MODEL: the farmer's phone is masked unless the viewer is
// the farmer themselves, an admin, or a buyer with a PAID order for THIS
// listing. (The /contact subroute reports the unlock state.)
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { farmer: true },
  });
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let contactUnlocked = false;
  const session = await getSession(req);
  if (session) {
    // POLICY (Jumia-style, 2026-09): only the owning farmer and the admin
    // ever see the farmer's phone. Buyers are served by the farmer (who
    // receives their full delivery details at payment) — the buyer's
    // contact field stays masked on every listing, paid or not.
    if (session.role === "admin" || (session.role === "farmer" && listing.farmer && listing.farmer.userId === session.userId)) {
      contactUnlocked = true;
    }
  }

  return NextResponse.json({
    ...listing,
    farmer: listing.farmer
      ? { ...listing.farmer, phone: contactUnlocked ? listing.farmer.phone : "" }
      : listing.farmer,
    contactUnlocked,
  });
}