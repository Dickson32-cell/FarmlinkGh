import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/auth";

// GET /api/profile — the logged-in user's profile (farmer or buyer rows)
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, name: true, phone: true, role: true, profileImageUrl: true },
    });
    if (session.role === "farmer") {
      const farmer = await prisma.farmer.findUnique({ where: { userId: session.userId } });
      return NextResponse.json({ user, farmer: farmer || {} });
    } else {
      const buyer = await prisma.buyer.findUnique({ where: { userId: session.userId } });
      return NextResponse.json({ user, buyer: buyer || {} });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH /api/profile — several independently-gated sections:
//   profileImageUrl            → instant (avatar, public image)
//   region/town/location/...   → instant (farm/business details)
//   name change                → creates a PENDING request for admin approval
//   password change            → creates a PENDING request for admin approval
//   changeRequest: {kind, id}  → (admin only) approve/reject a pending change
export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();

    // ---- instant updates: avatar + farm/business details ----
    if (session.role === "farmer") {
      const farmer = await prisma.farmer.update({
        where: { userId: session.userId },
        data: {
          region: body.region ?? undefined,
          town: body.town ?? undefined,
          farmSize: body.farmSize ?? undefined,
          mainCrops: body.mainCrops ?? undefined,
        },
      });
    } else {
      const buyer = await prisma.buyer.update({
        where: { userId: session.userId },
        data: {
          businessType: body.businessType ?? undefined,
          region: body.region ?? undefined,
          location: body.location ?? undefined,
          lookingFor: body.lookingFor ?? undefined,
        },
      });
    }

    if (typeof body.profileImageUrl === "string") {
      await prisma.user.update({
        where: { id: session.userId },
        data: { profileImageUrl: body.profileImageUrl },
      });
    }

    // ---- name change → pending admin approval ----
    if (typeof body.newName === "string" && body.newName.trim()) {
      const newName = body.newName.trim();
      if (newName.length < 2 || newName.length > 60) {
        return NextResponse.json({ error: "Name must be 2-60 characters" }, { status: 400 });
      }
      // one pending name request at a time
      const existingPending = await prisma.profileChangeRequest.findFirst({
        where: { userId: session.userId, kind: "name", status: "pending" },
      });
      if (existingPending) {
        await prisma.profileChangeRequest.update({
          where: { id: existingPending.id },
          data: { newName },
        });
      } else {
        await prisma.profileChangeRequest.create({
          data: { userId: session.userId, kind: "name", newName },
        });
      }
      return NextResponse.json({
        ok: true,
        pendingApproval: "name",
        message: "Name change submitted. The admin will approve it shortly.",
      });
    }

    // ---- password change → pending admin approval ----
    if (typeof body.newPassword === "string" && body.newPassword) {
      const user = await prisma.user.findUnique({ where: { id: session.userId } });
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
      // verify the CURRENT password first — only the account owner can request this
      const ok = await verifyPassword(body.currentPassword || "", user.password);
      if (!ok) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
      }
      if (String(body.newPassword).length < 8) {
        return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
      }
      const newHash = await hashPassword(body.newPassword);
      const existingPending = await prisma.profileChangeRequest.findFirst({
        where: { userId: session.userId, kind: "password", status: "pending" },
      });
      if (existingPending) {
        await prisma.profileChangeRequest.update({
          where: { id: existingPending.id },
          data: { newPassHash: newHash },
        });
      } else {
        await prisma.profileChangeRequest.create({
          data: { userId: session.userId, kind: "password", newPassHash: newHash },
        });
      }
      return NextResponse.json({
        ok: true,
        pendingApproval: "password",
        message: "Password change submitted. The admin will approve it shortly. Keep using your current password until then.",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}