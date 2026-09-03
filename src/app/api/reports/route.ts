import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, getAdminSession } from "@/lib/session";

// POST /api/reports — anyone (logged in or not) can file a report.
// The admin is SMS-alerted immediately so complaints are handled fast.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const category = String(body.category || "other");
    const message = String(body.message || "").trim();
    const validCategories = ["scam", "payment", "fake-listing", "behavior", "hacked-account", "other"];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    if (message.length < 10) {
      return NextResponse.json({ error: "Please describe the issue (at least 10 characters)" }, { status: 400 });
    }
    if (message.length > 2000) {
      return NextResponse.json({ error: "Message too long (max 2000 characters)" }, { status: 400 });
    }

    // attach the reporter's identity if they're logged in
    const session = await getSession(req);
    let reporterId: string | null = null;
    let reporterName = String(body.name || "").trim() || "Anonymous";
    let reporterPhone = String(body.phone || "").trim();
    if (session) {
      reporterId = session.userId;
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { name: true, phone: true },
      });
      if (user) {
        reporterName = user.name;
        reporterPhone = user.phone;
      }
    }

    const report = await prisma.report.create({
      data: {
        category,
        message,
        reporterId,
        reporterName,
        reporterPhone,
        listingUrl: String(body.listingUrl || ""),
      },
    });

    // SMS the admin instantly (non-fatal)
    try {
      const { sendSms } = await import("@/lib/otp");
      const catLabel: Record<string, string> = {
        scam: "Scam report", payment: "Payment issue", "fake-listing": "Fake listing",
        behavior: "User behavior", "hacked-account": "HACKED ACCOUNT", other: "Report",
      };
      await sendSms(
        process.env.ADMIN_MOMO || "0248847819",
        `FarmLink ALERT: New ${catLabel[category]} from ${reporterName}${reporterPhone ? " (" + reporterPhone + ")" : ""}. Check admin panel.`,
      );
    } catch (err) {
      console.error("[REPORT-ALERT-SMS] failed:", String(err).slice(0, 100));
    }

    return NextResponse.json({
      ok: true,
      id: report.id,
      message: "Report submitted. Our support team will contact you soon.",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET /api/reports — admin only: all reports, newest first
export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const reports = await prisma.report.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(reports);
}

// PATCH /api/reports — admin only: update status / add a note
export async function PATCH(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, status, adminNote } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const validStatuses = ["new", "reviewing", "resolved"];
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const existing = await prisma.report.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  const report = await prisma.report.update({
    where: { id },
    data: {
      status: status || existing.status,
      adminNote: adminNote !== undefined ? adminNote : existing.adminNote,
    },
  });

  // If the admin resolves it and the reporter has a phone, tell them
  if (status === "resolved" && existing.status !== "resolved" && report.reporterPhone) {
    try {
      const { sendSms } = await import("@/lib/otp");
      await sendSms(
        report.reporterPhone,
        `FarmLink: Your report has been reviewed and resolved. Thank you for keeping FarmLink safe. farmlinkgh.app`,
      );
    } catch { /* non-fatal */ }
  }

  return NextResponse.json(report);
}