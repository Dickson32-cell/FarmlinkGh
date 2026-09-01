import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";

// Site settings (key-value content the admin manages, e.g. the homepage hero
// image). GET is public — the homepage needs the hero URL. Writes are
// admin-only.

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    if (key) {
      const row = await prisma.siteSetting.findUnique({ where: { key } });
      return NextResponse.json({ value: row?.value || "" });
    }
    const rows = await prisma.siteSetting.findMany();
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    return NextResponse.json(map);
  } catch {
    return NextResponse.json({});
  }
}

export async function PUT(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "Admin session required" }, { status: 401 });
  }
  try {
    const { key, value } = await req.json();
    if (!key || typeof value !== "string") {
      return NextResponse.json({ error: "key and value required" }, { status: 400 });
    }
    await prisma.siteSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
    return NextResponse.json({ ok: true, key, value });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}