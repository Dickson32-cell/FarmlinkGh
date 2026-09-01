import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { detectNetwork } from "@/lib/otp";

export async function POST(req: NextRequest) {
  try {
    const { name, phone, password, role, ghanaCardUrl, profile } = await req.json();
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

    // Persist the profile fields AT REGISTRATION. The old flow PATCHed
    // /api/profile after this response — but the user has no session yet
    // (pending accounts get no cookie), so that request 401'd silently and
    // the region/town/business details were lost. They travel in the
    // register payload instead.
    const p = profile || {};
    if (role === "farmer") {
      await prisma.farmer.create({
        data: {
          userId: user.id, name, phone,
          region: p.region || "", town: p.town || "",
          farmSize: p.farmSize || 0, mainCrops: p.mainCrops || "",
        },
      });
    } else if (role === "buyer") {
      await prisma.buyer.create({
        data: {
          userId: user.id, name, phone,
          businessType: p.businessType || "",
          region: p.region || "",
          location: p.town || p.location || "",
          lookingFor: p.lookingFor || "",
        },
      });
    }
    // No session cookie — user must be approved by admin before login
    return NextResponse.json({ success: true, message: "Registration submitted. Verification takes 2-3 working days." });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}