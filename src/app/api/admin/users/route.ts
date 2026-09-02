import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/session";
import { sendSms } from "@/lib/otp";

// Admin user-verification endpoints — gated to verified admin sessions
// (the adminVerified cookie minted after the email-code check).
//
// GET    ?status=pending (default) | all    — list users for the admin panel
// PATCH  { userId, action: approve|reject } — verify a signup (+SMS to user)
// DELETE { userId }                          — remove a user and all their data

export async function GET(req: NextRequest) {
    const session = await getAdminSession(req);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status") || "pending";

    const users = await prisma.user.findMany({
        where: statusFilter === "all"
            ? { role: { not: "admin" } }
            : { status: statusFilter, role: { not: "admin" } },
        orderBy: { createdAt: "desc" },
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

    // Rejected users lose their profile rows: they are not platform members.
    // (Their User row stays for audit; re-registration replaces it cleanly.)
    if (action === "reject") {
        await prisma.farmer.deleteMany({ where: { userId } }).catch(() => { });
        await prisma.buyer.deleteMany({ where: { userId } }).catch(() => { });
    }

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

export async function DELETE(req: NextRequest) {
    const session = await getAdminSession(req);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();

    // Single-user delete: { userId }
    // Bulk rejected-purge: { purgeRejected: true } — removes ALL rejected
    // registrations (rejected users can always re-register fresh).
    if (body.purgeRejected) {
        const rejected = await prisma.user.findMany({
            where: { status: "rejected", role: { not: "admin" } },
        });
        let removed = 0;
        for (const user of rejected) {
            const farmer = await prisma.farmer.findUnique({ where: { userId: user.id } });
            if (farmer) {
                await prisma.review.deleteMany({ where: { farmerId: farmer.id } });
                await prisma.listing.deleteMany({ where: { farmerId: farmer.id } });
            }
            await prisma.farmer.deleteMany({ where: { userId: user.id } }).catch(() => { });
            await prisma.buyer.deleteMany({ where: { userId: user.id } }).catch(() => { });
            await prisma.otpCode.deleteMany({ where: { phone: user.phone } });
            await prisma.storedFile.deleteMany({ where: { ownerId: user.id } });
            await prisma.user.delete({ where: { id: user.id } });
            removed++;
        }
        await prisma.auditLog.create({
            data: {
                actorId: session.userId,
                actorName: "admin",
                action: "user.purgeRejected",
                details: `${removed} rejected registration(s) removed`,
            },
        });
        return NextResponse.json({ ok: true, purged: removed });
    }

    const { userId } = body;
    if (!userId) {
        return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (user.role === "admin") {
        return NextResponse.json({ error: "Admin accounts cannot be deleted" }, { status: 403 });
    }

    // Clean up every dependent row so FK constraints don't block the delete.
    // Orders keep their denormalized names/phones (no FK) — sales history
    // survives for the audit trail, which matters for money accounting.
    const farmer = await prisma.farmer.findUnique({ where: { userId } });
    if (farmer) {
        await prisma.review.deleteMany({ where: { farmerId: farmer.id } });
        await prisma.listing.deleteMany({ where: { farmerId: farmer.id } });
    }
    await prisma.farmer.deleteMany({ where: { userId } }).catch(() => { });
    await prisma.buyer.deleteMany({ where: { userId } }).catch(() => { });
    await prisma.review.deleteMany({ where: { buyerId: userId } });
    await prisma.otpCode.deleteMany({ where: { phone: user.phone } });
    await prisma.storedFile.deleteMany({ where: { ownerId: userId } });
    await prisma.user.delete({ where: { id: userId } });

    await prisma.auditLog.create({
        data: {
            actorId: session.userId,
            actorName: "admin",
            action: "user.delete",
            targetId: userId,
            details: `${user.name} (${user.phone}, ${user.role}, ${user.status}) → deleted`,
        },
    });

    return NextResponse.json({ ok: true, deleted: user.name });
}