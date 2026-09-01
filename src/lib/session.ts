import { NextRequest, NextResponse } from "next/server";
import { verifyToken, verifyAdminToken, verifyAdminActionToken } from "@/lib/auth";

export async function getSession(req: NextRequest) {
  const token = req.cookies.get("farmlink_token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

// Admin session = cookie token that carries adminVerified=true (email-code
// verified). Anything less is not an admin session — even role=admin JWTs
// minted by the plain login path are rejected for admin surfaces.
export async function getAdminSession(req: NextRequest) {
  const token = req.cookies.get("farmlink_token")?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export async function getAdminActionToken(req: NextRequest) {
  const token = req.headers.get("x-admin-action-token") || "";
  if (!token) return null;
  return verifyAdminActionToken(token);
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