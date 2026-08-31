import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
    const session = await getSession(req);
    if (!session || session.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const users = await prisma.user.findMany({
        where: { status: "pending", role: { not: "admin" } },
        orderBy: { createdAt: "asc" },
        select: {
            id: true, name: true, phone: true, role: true,
            status: true, ghanaCardUrl: true, createdAt: true,
        },
    });
    return NextResponse.json(users);
}

export async function PATCH(req: NextRequest) {
    const session = await getSession(req);
    if (!session || session.role !== "admin") {
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
    return NextResponse.json({ id: user.id, status: user.status });
}
