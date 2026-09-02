import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// POST /api/upload — store the file IN THE DATABASE (BYTEA).
// Why not disk? Vercel's filesystem is read-only at runtime — writes to
// public/uploads are silently lost. Postgres BYTEA survives and works the
// same locally and in production.
//
// kind (form field, optional): "listing" (default, public) | "ghana-card" (private).
// Ghana-card files are only viewable by the owner and by verified admin
// sessions (see /api/files/[id]).
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const kindRaw = String(formData.get("kind") || "listing");
  // Private kinds: ghana-card + passport — only owner and verified admin may view.
  // hero (homepage cover), profile (avatars) and listing are public.
  const PRIVATE_KINDS = ["ghana-card", "passport"];
  const PUBLIC_KINDS = ["listing", "hero", "profile"];
  const kind = PRIVATE_KINDS.includes(kindRaw) ? kindRaw : (PUBLIC_KINDS.includes(kindRaw) ? kindRaw : "listing");
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  // Validate file type
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG, WebP, and GIF allowed" }, { status: 400 });
  }

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
  }

  const session = await getSession(req);
  const ownerId = session?.userId || null;

  const bytes = Buffer.from(await file.arrayBuffer());

  const stored = await prisma.storedFile.create({
    data: {
      filename: file.name || `upload.${file.type.split("/")[1] || "jpg"}`,
      mimeType: file.type,
      size: bytes.length,
      kind,
      ownerId,
      data: bytes,
    },
    select: { id: true },
  });

  return NextResponse.json({ url: `/api/files/${stored.id}` });
}