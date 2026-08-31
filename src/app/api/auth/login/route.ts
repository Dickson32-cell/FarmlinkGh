import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { phone, password } = await req.json();
    if (!phone || !password) {
      return NextResponse.json({ error: "Phone and password required" }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { phone } });
    console.log("Login attempt for phone:", phone);
    if (!user) {
      console.log("User not found for phone:", phone);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    console.log("User found:", user.id, "Status:", user.status);
    const valid = await verifyPassword(password, user.password);
    console.log("Password valid:", valid);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    // Check verification status
    if (user.status === "pending") {
      return NextResponse.json({
        error: "Your account is pending verification. This takes 2–3 working days. You will be able to log in once approved.",
        status: "pending",
      }, { status: 403 });
    }
    if (user.status === "rejected") {
      return NextResponse.json({
        error: "Your account was not approved. Please contact support or re-register with a valid Ghana Card.",
        status: "rejected",
      }, { status: 403 });
    }
    const token = await createToken({ userId: user.id, role: user.role });
    const res = NextResponse.json({ id: user.id, name: user.name, role: user.role });
    res.cookies.set("farmlink_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}