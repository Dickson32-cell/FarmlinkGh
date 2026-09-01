import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/products — all crop suggestions (built-in + farmer-added)
export async function GET() {
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return NextResponse.json(products.map((p) => p.name));
}

// POST /api/products — register a new product (farmer adds a crop not in the system)
export async function POST(req: NextRequest) {
  const session = await import("@/lib/session").then((m) => m.getSession(req));
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { name } = await req.json();
    const clean = String(name || "").trim();
    if (clean.length < 2 || clean.length > 60)
      return NextResponse.json({ error: "Product name must be 2-60 characters" }, { status: 400 });

    const product = await prisma.product.upsert({
      where: { name: clean },
      update: {},
      create: { name: clean, createdBy: session.userId },
    });
    return NextResponse.json({ success: true, name: product.name });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}