import webpush from "web-push";
import { prisma } from "@/lib/prisma";

// Web Push sender — admin offline notifications.
// The admin opts in from the admin panel (browser asks permission); the
// subscription (one per browser/device) is stored in PushSubscription.
// notifyAdminPush() then reaches the admin's phone/desktop EVEN WHEN the
// site is closed — the browser/service worker shows the OS notification.

if (!process.env.VAPID_PRIVATE_KEY) {
  // No keys configured (e.g. a fresh dev environment) — pushes silently skip
} else {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:info.rametechconsultancy@gmail.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
    process.env.VAPID_PRIVATE_KEY
  );
}

export async function notifyAdminPush(title: string, body: string, url = "/admin"): Promise<void> {
  if (!process.env.VAPID_PRIVATE_KEY) return;
  try {
    const admin = await prisma.user.findFirst({ where: { role: "admin" }, select: { id: true } });
    if (!admin) return;
    const subs = await prisma.pushSubscription.findMany({ where: { userId: admin.id } });
    if (subs.length === 0) return;

    const payload = JSON.stringify({ title, body, url });
    await Promise.allSettled(
      subs.map((s) =>
        webpush
          .sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload
          )
          .catch(async (err: any) => {
            // 404/410 = subscription expired/gone — clean it up so the table stays healthy
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              await prisma.pushSubscription.deleteMany({ where: { endpoint: s.endpoint } }).catch(() => {});
            }
          })
      )
    );
  } catch (e) {
    console.error("[ADMIN-PUSH] failed:", String(e).slice(0, 120));
  }
}