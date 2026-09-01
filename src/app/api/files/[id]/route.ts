import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, getAdminSession } from "@/lib/session";

// GET /api/files/<id> — serve a stored file from the database.
//
// Access rules:
//   kind = "listing"    → public (market page images)
//   kind = "ghana-card" → PRIVATE. Only:
//                            1. a verified admin session (adminVerified cookie), or
//                            2. the owner (same user session cookie)
//                         may view it. Everyone else gets 404.
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  let file = null;
  try {
    file = await prisma.storedFile.findUnique({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (file.kind === "ghana-card") {
    const admin = await getAdminSession(req);
    if (!admin) {
      const session = await getSession(req);
      if (!session || session.userId !== file.ownerId) {
        // Do not reveal existence — Ghana cards are sensitive PII
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }
  }

  const data = Buffer.from(file.data);
  return new NextResponse(data as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(data.length),
      "Cache-Control": file.kind === "ghana-card" ? "private, no-store" : "public, max-age=31536000, immutable",
    },
  });
}