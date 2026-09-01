import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { sendSms } from "@/lib/otp";

// Admin user-verification endpoints — gated to verified admin sessions
// (the adminVerified cookie minted after the email-code check).
export async function GET(req: NextRequest) {
    const session = await getAdminSession(req);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const users = await prisma.user.findMany({
        where: { status: "pending", role: { not: "admin" } },
        orderBy: { createdAt: "asc" },
        select: {
            id: true, name: true, phone: true, role: true,
            status: true, ghanaCardUrl: true, createdAt: true,
            idType: true, idNumber: true, passportUrl: true,
        },
    });
    return NextResponse.json(users);
}

export async function PATCH(req: NextRequest) {
    const session = await getAdminSession(req);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { userId, action } = await req.json();
    if (!userId || !["approve", "reject"].includes(action)) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const user = await prisma.user.update({
        where: { id: userId },
        data: { status: action === "approve" ? "approved" : "rejected" },
    });

    await prisma.auditLog.create({
        data: {
            actorId: session.userId,
            actorName: "admin",
            action: `user.${action}`,
            targetId: userId,
            details: `${user.name} (${user.phone}) → ${action === "approve" ? "approved" : "rejected"}`,
        },
    });

    // Notify the user by SMS so they know their verification outcome.
    // (console provider logs it in dev — real SMS via Arkesel in production.)
    const sms =
        action === "approve"
            ? `FarmLink: ${user.name}, your ${user.role} account is now active. Log in at framlinkgh.vercel.app to start.`
            : `FarmLink: ${user.name}, your account was not approved. Re-register with a valid Ghana Card or call 0595726252.`;
    const { sent } = await sendSms(user.phone, sms).catch(() => ({ sent: false }));

    return NextResponse.json({ id: user.id, status: user.status, smsSent: sent });
}