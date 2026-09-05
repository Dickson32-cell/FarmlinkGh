import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { detectNetwork } from "@/lib/otp";
import { normalizeGhanaPhone, isValidGhanaPhone } from "@/lib/phone";

export async function POST(req: NextRequest) {
  try {
    const { name, phone, password, role, ghanaCardUrl, idType, idNumber, passportUrl, profile } = await req.json();
    if (!name || !phone || !password || !role) {
      return NextResponse.json({ error: "All fields required" }, { status: 400 });
    }
    // store phones in ONE canonical local format (0…)
    const normalizedPhone = normalizeGhanaPhone(phone);
    if (!isValidGhanaPhone(normalizedPhone)) {
      return NextResponse.json({ error: "Enter a valid Ghana mobile number (e.g. 0244123456)" }, { status: 400 });
    }
    if (!["farmer", "buyer"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // ===== BUYERS: no ID document required. =====
    // Escrow protects the seller: the buyer pays BEFORE the farmer delivers,
    // and the platform holds the money. A phone number (verified by OTP at
    // login) is all the identity a buyer needs — same policy as Jumia/
    // Amazon/Tonaton. Buyers are approved instantly; the admin still gets
    // an SMS alert on every signup and can delete bad actors any time.
    // ===== FARMERS: full Ghana Card / passport verification stays. =====
    let ID = "none";
    if (role === "farmer") {
      ID = String(idType || "ghana-card");
      if (!["ghana-card", "passport"].includes(ID)) {
        return NextResponse.json({ error: "Invalid ID type" }, { status: 400 });
      }
      if (ID === "ghana-card") {
        if (!ghanaCardUrl) {
          return NextResponse.json({ error: "Ghana Card photo is required for verification" }, { status: 400 });
        }
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
      }
    }

    // Rejected users get a fresh start: their old account is replaced so
    // they can re-register with a better photo/number as the rejection
    // message instructs. Pending/approved accounts still block the phone.
    const existing = await prisma.user.findUnique({ where: { phone: normalizedPhone } });
    if (existing) {
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
        phone: normalizedPhone,
        password: hashed,
        role,
        // Buyers are approved instantly (no ID to review); farmers stay
        // pending until the admin verifies their Ghana Card / passport.
        status: role === "buyer" ? "approved" : "pending",
        ghanaCardUrl: role === "farmer" && ID === "ghana-card" ? ghanaCardUrl : "",
        passportUrl: role === "farmer" && ID === "passport" ? passportUrl : "",
        idType: role === "farmer" ? ID : "none",
        idNumber: role === "farmer" ? String(idNumber || "").toUpperCase().trim() : "",
        lastNetwork: detectNetwork(normalizedPhone),
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
          userId: user.id, name, phone: normalizedPhone,
          region: p.region || "", town: p.town || "",
          farmSize: p.farmSize || 0, mainCrops: p.mainCrops || "",
        },
      });
    } else if (role === "buyer") {
      await prisma.buyer.create({
        data: {
          userId: user.id, name, phone: normalizedPhone,
          businessType: p.businessType || "",
          region: p.region || "",
          location: p.town || p.location || "",
          lookingFor: p.lookingFor || "",
        },
      });
    }
    // No session cookie for farmers — they must be admin-approved first.
    // Buyers are approved instantly, but still get no cookie here; they log
    // in with phone + password + SMS OTP like everyone else.
    // ADMIN ALERT: instant SMS to the admin on every signup (buyers included)
    try {
      const { sendSms } = await import("@/lib/otp");
      const { notifyAdminEvent } = await import("@/lib/adminNotify");
      await notifyAdminEvent(
        "approval",
        role === "buyer" ? "New buyer signup" : "New farmer registration",
        role === "buyer"
          ? `${name} (${normalizedPhone}) signed up — auto-approved, no action needed.`
          : `${name} (${normalizedPhone}) registered as a farmer — approval needed in the admin panel.`,
        "/admin"
      );
      await sendSms(
        process.env.ADMIN_MOMO || "0248847819",
        role === "buyer"
          ? `FarmLink: New buyer signup - ${name} (${normalizedPhone}). Auto-approved (no ID needed for buyers).`
          : `FarmLink: New ${role} registration - ${name} (${normalizedPhone}). Approve in admin panel.`,
      );
    } catch (err) {
      console.error("[ADMIN-ALERT-SMS] registration alert failed:", String(err).slice(0, 120));
    }

    // In-app welcome notification
    try {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: "system",
          title: "Welcome to FarmLink",
          body:
            role === "buyer"
              ? "Your buyer account is active. Browse the market and order produce — farmer contacts unlock after payment."
              : "Your farmer registration was received. Verification takes 2-3 working days; you can log in once approved.",
          link: role === "buyer" ? "/market" : "/dashboard",
        },
      });
    } catch {
      // non-fatal
    }

    return NextResponse.json({
      success: true,
      message:
        role === "buyer"
          ? "Registration complete. You can log in now with your phone and password."
          : "Registration submitted. Verification takes 2-3 working days.",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}