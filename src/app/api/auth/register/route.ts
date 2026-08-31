import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { detectNetwork } from "@/lib/otp";

export async function POST(req: NextRequest) {
  try {
    const { name, phone, password, role, ghanaCardUrl } = await req.json();
    if (!name || !phone || !password || !role) {
      return NextResponse.json({ error: "All fields required" }, { status: 400 });
    }
    if (!ghanaCardUrl) {
      return NextResponse.json({ error: "Ghana Card photo is required for verification" }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) {
      return NextResponse.json({ error: "Phone number already registered" }, { status: 409 });
    }
    const hashed = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name,
        phone,
        password: hashed,
        role,
        status: "pending",
        ghanaCardUrl,
        lastNetwork: detectNetwork(phone),
      },
    });
    if (role === "farmer") {
      await prisma.farmer.create({
        data: { userId: user.id, name, phone, region: "", town: "", farmSize: 0, mainCrops: "" },
      });
    } else if (role === "buyer") {
      await prisma.buyer.create({
        data: { userId: user.id, name, phone, businessType: "", location: "", lookingFor: "" },
      });
    }
    // No session cookie — user must be approved by admin before login
    return NextResponse.json({ success: true, message: "Registration submitted. Verification takes 2-3 working days." });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}