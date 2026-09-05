"use client";

import { useEffect, useState } from "react";

// Admin offline-alerts toggle — appears in the admin panel header area.
// When ON, the browser asks for Notification permission and registers a
// web-push subscription; alerts then reach the phone EVEN WHEN the site
// is closed (OS-level notification from the service worker).

const urlB64ToUint8Array = (b64: string) => {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export default function AdminPushToggle() {
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(true);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSupported(false);
      return;
    }
    // reflect current permission state
    if (typeof Notification !== "undefined") {
      setEnabled(Notification.permission === "granted");
    }
  }, []);

  const enable = async () => {
    setNote("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setNote("Permission denied — alerts cannot reach you. Enable notifications for this site in your browser settings.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        setNote("Push not configured.");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(key),
      });
      const json = sub.toJSON();
      const res = await fetch("/api/admin/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (res.ok) {
        setEnabled(true);
        setNote("Alerts are ON — approvals and payments will reach this device even when the site is closed.");
      } else {
        setNote("Could not save the subscription. Are you logged in as admin?");
      }
    } catch (e) {
      setNote("Could not enable alerts: " + String(e).slice(0, 80));
    }
  };

  const disable = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/admin/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setEnabled(false);
      setNote("Alerts are off for this device.");
    } catch {
      setNote("Could not disable alerts.");
    }
  };

  if (!supported) return null;

  return (
    <div className="bg-white rounded-xl shadow border border-gray-200 p-4 mb-4 flex items-center justify-between flex-wrap gap-3">
      <div className="min-w-0">
        <div className="font-semibold text-[#1b5e20] text-sm">Offline alerts on this device</div>
        <div className="text-xs text-gray-500">
          Get admin notifications on your phone even when FarmLink is closed — approvals, payments, refunds, complaints.
        </div>
        {note && <div className="text-xs mt-1 text-[#e65100]">{note}</div>}
      </div>
      <button
        type="button"
        onClick={enabled ? disable : enable}
        className={`px-4 py-2 rounded-lg text-sm font-semibold shrink-0 transition-colors ${
          enabled ? "bg-gray-100 text-gray-600 hover:bg-gray-200" : "bg-[#1b5e20] text-white hover:bg-[#0d3818]"
        }`}
      >
        {enabled ? "Turn off" : "Enable alerts"}
      </button>
    </div>
  );
}