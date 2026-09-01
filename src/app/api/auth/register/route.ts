import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { detectNetwork } from "@/lib/otp";

export async function POST(req: NextRequest) {
  try {
    const { name, phone, password, role, ghanaCardUrl, idType, idNumber, passportUrl, profile } = await req.json();
    if (!name || !phone || !password || !role) {
      return NextResponse.json({ error: "All fields required" }, { status: 400 });
    }

    // Identity verification — Ghana Card (strict format) or Passport
    const ID = String(idType || "ghana-card");
    if (ID === "ghana-card") {
      if (!ghanaCardUrl) {
        return NextResponse.json({ error: "Ghana Card photo is required for verification" }, { status: 400 });
      }
      // Ghana Card number: GHA-123456789-0 (GHA + 9 digits + check digit)
      const num = String(idNumber || "").toUpperCase().trim();
      if (!/^GHA-\d{9}-\d$/.test(num)) {
        return NextResponse.json(
          { error: "Ghana Card number must look like GHA-123456789-0" },
          { status: 400 }
        );
      }
    } else if (ID === "passport") {
      if (!passportUrl) {
        return NextResponse.json({ error: "Passport photo page is required for verification" }, { status: 400 });
      }
      const num = String(idNumber || "").toUpperCase().trim();
      if (num.length < 5 || num.length > 15) {
        return NextResponse.json(
          { error: "Enter a valid passport number (5-15 characters)" },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json({ error: "Invalid ID type" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) {
      // Rejected users get a fresh start: their old account is replaced so
      // they can re-register with a better photo/number as the rejection
      // message instructs. Pending/approved accounts still block the phone.
      if (existing.status === "rejected") {
        await prisma.farmer.deleteMany({ where: { userId: existing.id } }).catch(() => {});
        await prisma.buyer.deleteMany({ where: { userId: existing.id } }).catch(() => {});
        await prisma.storedFile.deleteMany({ where: { ownerId: existing.id } }).catch(() => {});
        await prisma.user.delete({ where: { id: existing.id } });
      } else {
        return NextResponse.json({ error: "Phone number already registered" }, { status: 409 });
      }
    }
    const hashed = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name,
        phone,
        password: hashed,
        role,
        status: "pending",
        ghanaCardUrl: ID === "ghana-card" ? ghanaCardUrl : "",
        passportUrl: ID === "passport" ? passportUrl : "",
        idType: ID,
        idNumber: String(idNumber || "").toUpperCase().trim(),
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