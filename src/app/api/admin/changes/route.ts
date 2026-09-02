import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";

// Admin review of pending name/password change requests.
//
// GET    — list pending change requests (with user info)
// PATCH  — { requestId, action: "approve" | "reject" }
//          approve: applies the change (updates User.name or User.password),
//                   syncs the Farmer/Buyer profile name, SMSes the user.

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requests = await prisma.profileChangeRequest.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { name: true, phone: true, role: true } },
    },
  });
  return NextResponse.json(requests);
}

export async function PATCH(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { requestId, action } = await req.json();
  if (!requestId || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const request = await prisma.profileChangeRequest.findUnique({
    where: { id: requestId },
    include: { user: true },
  });
  if (!request || request.status !== "pending") {
    return NextResponse.json({ error: "Request not found or already resolved" }, { status: 404 });
  }

  if (action === "approve") {
    if (request.kind === "name" && request.newName) {
      const oldName = request.user.name;
      await prisma.user.update({
        where: { id: request.userId },
        data: { name: request.newName },
      });
      // keep the denormalized profile names in sync
      await prisma.farmer.updateMany({ where: { userId: request.userId }, data: { name: request.newName } }).catch(() => {});
      await prisma.buyer.updateMany({ where: { userId: request.userId }, data: { name: request.newName } }).catch(() => {});

      await prisma.profileChangeRequest.update({
        where: { id: request.id },
        data: { status: "approved", resolvedAt: new Date(), resolvedBy: session.userId },
      });
      await prisma.auditLog.create({
        data: {
          actorId: session.userId, actorName: "admin",
          action: "namechange.approve", targetId: request.userId,
          details: `${oldName} (${request.user.phone}) -> ${request.newName}`,
        },
      });

      // SMS the user their new name is live
      const { sendSms } = await import("@/lib/otp");
      await sendSms(
        request.user.phone,
        `FarmLink: Your name change to ${request.newName} has been approved.`,
      ).catch(() => {});

      return NextResponse.json({ ok: true, applied: "name", newName: request.newName });
    }

    if (request.kind === "password" && request.newPassHash) {
      await prisma.user.update({
        where: { id: request.userId },
        data: { password: request.newPassHash, failedLogins: 0, lockedUntil: null },
      });
      await prisma.profileChangeRequest.update({
        where: { id: request.id },
        data: { status: "approved", resolvedAt: new Date(), resolvedBy: session.userId },
      });
      await prisma.auditLog.create({
        data: {
          actorId: session.userId, actorName: "admin",
          action: "passwordchange.approve", targetId: request.userId,
          details: `${request.user.name} (${request.user.phone}) password changed by admin approval`,
        },
      });

      const { sendSms } = await import("@/lib/otp");
      await sendSms(
        request.user.phone,
        `FarmLink: Your new password has been approved. Use it next time you log in.`,
      ).catch(() => {});

      return NextResponse.json({ ok: true, applied: "password" });
    }
  }

  // reject (or unknown kind)
  await prisma.profileChangeRequest.update({
    where: { id: request.id },
    data: { status: "rejected", resolvedAt: new Date(), resolvedBy: session.userId },
  });
  await prisma.auditLog.create({
    data: {
      actorId: session.userId, actorName: "admin",
      action: `change.reject`, targetId: request.userId,
      details: `${request.user.name} (${request.user.phone}) ${request.kind} change rejected`,
    },
  });

  const { sendSms } = await import("@/lib/otp");
  await sendSms(
    request.user.phone,
    `FarmLink: Your ${request.kind === "name" ? "name" : "password"} change request was not approved. Contact 0595726252 if you need help.`,
  ).catch(() => {});

  return NextResponse.json({ ok: true, applied: "rejected" });
}