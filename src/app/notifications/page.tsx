"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SiteHeader from "@/components/siteHeader";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
}

const typeStyles: Record<string, { bg: string; label: string }> = {
  order: { bg: "bg-blue-50 text-blue-700 border-blue-200", label: "Order" },
  payment: { bg: "bg-green-50 text-green-700 border-green-200", label: "Payment" },
  refund: { bg: "bg-amber-50 text-amber-700 border-amber-200", label: "Refund" },
  system: { bg: "bg-gray-50 text-gray-600 border-gray-200", label: "System" },
  approval: { bg: "bg-green-50 text-green-700 border-green-200", label: "Approval" },
  price: { bg: "bg-orange-50 text-orange-700 border-orange-200", label: "Price" },
};

export default function Notifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      if (!d.user) { router.push("/login"); return; }
      if (d.user.role === "admin") { router.push("/admin"); return; }
      setRole(d.user.role);
      fetch("/api/notifications").then((r) => r.json()).then(setItems).finally(() => setLoading(false));
    });
  }, [router]);

  const markAllRead = async () => {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = async () => {
    if (!confirm("Clear all notifications? This cannot be undone.")) return;
    await fetch("/api/notifications", { method: "DELETE" });
    setItems([]);
  };

  const openOne = async (n: Notification) => {
    if (!n.read) {
      await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: n.id }) });
    }
    if (n.link) router.push(n.link);
  };

  const isFarmer = role === "farmer";

  return (
    <div className="min-h-screen bg-[#f8faf7]">
      <SiteHeader user={{ role }} />

      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <h1 className="text-2xl font-bold text-[#1b5e20]">Notifications</h1>
          <div className="flex gap-2">
            {items.some((n) => !n.read) && (
              <button onClick={markAllRead} className="bg-white border border-gray-200 text-gray-600 px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-gray-50 shadow-sm">
                Mark all read
              </button>
            )}
            {items.length > 0 && (
              <button onClick={clearAll} className="bg-white border border-red-200 text-red-600 px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-red-50 shadow-sm">
                Clear all
              </button>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Order updates, payments, refunds and platform news — the same events you receive by SMS, in one place.
        </p>

        {loading && <div className="text-center text-gray-400 py-10">Loading...</div>}

        {!loading && items.length === 0 && (
          <div className="bg-white rounded-xl shadow border border-gray-200 p-10 text-center text-gray-400">
            <div className="font-semibold mb-1">No notifications yet</div>
            <div className="text-sm">When orders, payments or refunds happen, updates appear here.</div>
          </div>
        )}

        <div className="space-y-3">
          {items.map((n) => {
            const st = typeStyles[n.type] || typeStyles.system;
            return (
              <button
                key={n.id}
                onClick={() => openOne(n)}
                className={`w-full text-left bg-white rounded-xl shadow border p-4 flex gap-3 items-start transition-colors hover:bg-gray-50 ${n.read ? "border-gray-200" : "border-[#43a047] ring-1 ring-[#43a047]/30"}`}
              >
                <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${st.bg}`}>{st.label}</span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className={`font-semibold ${n.read ? "text-gray-700" : "text-[#1b5e20]"}`}>{n.title}</span>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                  </span>
                  <span className="block text-sm text-gray-500 mt-0.5">{n.body}</span>
                  <span className="block text-xs text-gray-400 mt-1">
                    {new Date(n.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}