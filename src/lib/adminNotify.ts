import { prisma } from "@/lib/prisma";

// In-app notification for the ADMIN — mirrors the admin SMS alerts.
// Creates a Notification row for the admin account so the header bell
// flags pending work (badge count) the moment the admin opens any page,
// instead of only finding out via SMS or by opening the admin panel.
//
// Non-fatal by design: notification failure must never break the
// transaction that triggered it.
export async function notifyAdminEvent(
  type: "system" | "order" | "payment" | "refund" | "approval" | "report",
  title: string,
  body: string,
  link = "/admin"
): Promise<void> {
  try {
    const admin = await prisma.user.findFirst({ where: { role: "admin" }, select: { id: true } });
    if (!admin) return;
    await prisma.notification.create({
      data: { userId: admin.id, type, title, body, link },
    });
  } catch (e) {
    console.error("[ADMIN-NOTIFY] failed:", String(e).slice(0, 120));
  }
}