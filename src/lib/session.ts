import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

export async function getSession(req: NextRequest) {
  const token = req.cookies.get("farmlink_token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function withAuth(handler: (req: NextRequest, session: any) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handler(req, session);
  };
}