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

    // In-app + push notification to the admin (opens straight to the reports tab)
    try {
      const { notifyAdminEvent } = await import("@/lib/adminNotify");
      const catLabel: Record<string, string> = {
        scam: "Scam report", payment: "Payment issue", "fake-listing": "Fake listing",
        behavior: "User behavior", "hacked-account": "HACKED ACCOUNT", other: "Report",
      };
      await notifyAdminEvent(
        "report",
        `New ${catLabel[category]} report`,
        `${reporterName}${reporterPhone ? " (" + reporterPhone + ")" : ""} submitted a report — review it in the admin panel.`,
        "/admin?tab=reports",
      );
    } catch {}

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

// GET /api/reports — admin only: all reports, newest first, enriched with the
// accused party (farmer + listing + order) resolved from the listing URL.
export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const reports = await prisma.report.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Resolve listing IDs referenced in report URLs (…/market/<listingId>)
  const listingIds: string[] = [];
  for (const r of reports) {
    const m = r.listingUrl.match(/\/market\/([a-z0-9]+)/i);
    if (m) listingIds.push(m[1]);
  }
  const listings = listingIds.length
    ? await prisma.listing.findMany({
        where: { id: { in: listingIds } },
        include: { farmer: true },
      })
    : [];
  const listingMap = new Map(listings.map((l) => [l.id, l]));

  const enriched = reports.map((r) => {
    const m = r.listingUrl.match(/\/market\/([a-z0-9]+)/i);
    const listing = m ? listingMap.get(m[1]) : undefined;
    return {
      ...r,
      listing: listing
        ? {
            id: listing.id,
            crop: listing.crop,
            quantity: listing.quantity,
            unit: listing.unit,
            price: listing.price,
            region: listing.region,
            location: listing.location,
            status: listing.status,
            postedDate: listing.postedDate,
          }
        : null,
      farmer: listing
        ? {
            id: listing.farmer.id,
            name: listing.farmer.name,
            phone: listing.farmer.phone,
            region: listing.farmer.region,
            town: listing.farmer.town,
            mainCrops: listing.farmer.mainCrops,
            farmSize: listing.farmer.farmSize,
          }
        : null,
      // The farmer's LOGIN user record (for account-level actions)
      farmerUserId: listing?.farmer?.userId ?? null,
    };
  });

  return NextResponse.json(enriched);
}

// PATCH /api/reports — admin only: update status / add a note.
// On resolve: SMS BOTH the reporter and the accused farmer (if any).
export async function PATCH(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, status, adminNote, resolution } = await req.json();
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
      resolution: resolution !== undefined ? resolution : (existing as any).resolution,
    },
  });

  // If the admin resolves it, notify BOTH sides (non-fatal)
  if (status === "resolved" && existing.status !== "resolved") {
    // Reporter SMS
    if (report.reporterPhone) {
      try {
        const { sendSms } = await import("@/lib/otp");
        const outcome = ((report as any).resolution || "reviewed")
          .replace(/-/g, " ")
          .replace(/^\w/, (c) => c.toUpperCase());
        await sendSms(
          report.reporterPhone,
          `FarmLink: Your report was resolved - ${outcome}. Thank you for keeping FarmLink safe. farmlinkgh.app`,
        );
      } catch { /* non-fatal */ }
    }
    // Accused farmer SMS — resolve the listing from the URL, then SMS the farmer
    const m = report.listingUrl.match(/\/market\/([a-z0-9]+)/i);
    if (m) {
      try {
        const listing = await prisma.listing.findUnique({
          where: { id: m[1] },
          include: { farmer: true },
        });
        if (listing) {
          const { sendSms } = await import("@/lib/otp");
          await sendSms(
            listing.farmer.phone,
            `FarmLink: A report was reviewed and closed by our team regarding your ${listing.crop} listing. No action needed if all is in order. farmlinkgh.app`,
          );
          // In-app notification for the farmer too
          await prisma.notification.create({
            data: {
              userId: listing.farmer.userId,
              type: "report",
              title: "Report about your listing was reviewed",
              body: `A report about your ${listing.crop} listing was reviewed and closed by the FarmLink team.`,
              link: "/dashboard",
            },
          }).catch(() => {});
        }
      } catch { /* non-fatal */ }
    }
  }

  return NextResponse.json(report);
}