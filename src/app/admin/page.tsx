"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface PendingUser {
  id: string; name: string; phone: string; role: string;
  status: string; ghanaCardUrl: string; createdAt: string;
  idType: string; idNumber: string; passportUrl: string;
}

interface Order {
  id: string; crop: string; quantity: number; unitPrice: number;
  totalAmount: number; commissionAmount: number; farmerPayout: number;
  refundAmount?: number | null; damageDeduction?: number | null;
  refundReason?: string | null; farmerComplaint?: string | null;
  farmerName: string; farmerPhone: string; buyerName: string; buyerPhone: string;
  status: string; adminNote: string | null; hubtelTxId: string | null; createdAt: string;
}

import HeaderBanner from "@/components/headerBanner";
import RefundControls from "@/components/refundControls";

// headerImage setting holds a JSON array of URLs (slideshow) or a single
// URL string (legacy) — normalize both to an array.
function parseHeaderImages(value: unknown): string[] {
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      const arr = JSON.parse(value);
      if (Array.isArray(arr)) return arr.filter((v) => typeof v === "string" && v);
    } catch { /* fall through */ }
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

export default function Admin() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [allUsers, setAllUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({ total: 0, pending: 0, paid: 0, delivered: 0, released: 0, revenue: 0 });
  const [activeTab, setActiveTab] = useState<"verifications" | "orders" | "users" | "changes" | "reports" | "broadcast">("verifications");
  const [cardModal, setCardModal] = useState<string | null>(null);
  const [otpModal, setOtpModal] = useState<{ orderId: string; label: string; status?: string } | null>(null);
  const [otpCode, setOtpCode] = useState("");

  // ── Broadcast SMS state ──
  const [bcMessage, setBcMessage] = useState("");
  const [bcAudience, setBcAudience] = useState<"all" | "buyers" | "farmers" | "region" | "crop">("all");
  const [bcRegion, setBcRegion] = useState("");
  const [bcCrop, setBcCrop] = useState("");
  const [bcPreview, setBcPreview] = useState<{ all: number; buyers: number; farmers: number; regions: { region: string; count: number }[] } | null>(null);
  const [bcLength, setBcLength] = useState({ sanitized: 0, overLimit: false, remaining: 160 });
  const [bcSending, setBcSending] = useState(false);
  const [bcResult, setBcResult] = useState<any>(null);

  // load audience preview when the Broadcast tab opens
  useEffect(() => {
    if (activeTab === "broadcast" && !bcPreview) {
      fetch("/api/admin/broadcast")
        .then((r) => r.json())
        .then((d) => { if (!d.error) setBcPreview(d); })
        .catch(() => {});
    }
  }, [activeTab]);

  // live length check while typing
  useEffect(() => {
    if (!bcMessage) { setBcLength({ sanitized: 0, overLimit: false, remaining: 160 }); return; }
    const t = setTimeout(() => {
      fetch(`/api/admin/broadcast?message=${encodeURIComponent(bcMessage)}`)
        .then((r) => r.json())
        .then((d) => { if (!d.error) setBcLength(d); })
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [bcMessage]);

  const bcAudienceCount = () => {
    if (!bcPreview) return "…";
    if (bcAudience === "all") return bcPreview.all;
    if (bcAudience === "buyers") return bcPreview.buyers;
    if (bcAudience === "farmers") return bcPreview.farmers;
    if (bcAudience === "region") {
      const r = bcPreview.regions.find((x) => x.region === bcRegion);
      return r ? r.count : 0;
    }
    if (bcAudience === "crop") return "buyers looking for this crop";
    return "…";
  };

  const sendBroadcast = async () => {
    if (!bcMessage.trim()) { alert("Write the message first."); return; }
    if (bcLength.overLimit) { alert("Message is too long — it must fit one SMS page (160 characters after cleanup)."); return; }
    const count = typeof bcAudienceCount() === "number" ? bcAudienceCount() : "the matching";
    if (!confirm(`Send this SMS to ${count} approved user(s)?\n\n"${bcMessage}"\n\nThis uses your Arkesel SMS balance. It cannot be undone.`)) return;
    setBcSending(true);
    setBcResult(null);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: bcMessage, audience: bcAudience, region: bcRegion || undefined, crop: bcCrop || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Broadcast failed"); return; }
      setBcResult(data);
      // refresh preview counts
      fetch("/api/admin/broadcast").then((r) => r.json()).then((d) => { if (!d.error) setBcPreview(d); }).catch(() => {});
    } finally {
      setBcSending(false);
    }
  };
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [heroImage, setHeroImage] = useState("");
  const [heroUploading, setHeroUploading] = useState(false);
  const [heroError, setHeroError] = useState("");
  const [headerImages, setHeaderImages] = useState<string[]>([]);
  const [headerUploading, setHeaderUploading] = useState(false);
  const [headerError, setHeaderError] = useState("");
  const [changeRequests, setChangeRequests] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      if (!d.user) { router.push("/login"); return; }
      // Admin surfaces require the email-code-verified session (12h cookie).
      // role=admin without adminVerified means the email code step is missing.
      if (d.user.role !== "admin" || d.user.adminVerified !== true) { router.push("/login"); return; }
      setUser(d.user);
      loadAll();
    });
    // Auto-refresh: new registrations, orders, reports and change requests
    // appear without a manual reload while the admin watches the panel.
    const timer = setInterval(() => { loadAll(); }, 20000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const loadAll = () => {
    Promise.all([
      fetch("/api/orders").then((r) => r.json()),
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/admin/users?status=all").then((r) => r.json()),
      fetch("/api/settings?key=heroImage").then((r) => r.json()).catch(() => ({})),
      fetch("/api/settings?key=headerImage").then((r) => r.json()).catch(() => ({})),
      fetch("/api/admin/changes").then((r) => r.json()).catch(() => []),
      fetch("/api/reports").then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([ordersData, usersData, allUsersData, heroData, headerImageData, changesData, reportsData]) => {
      setOrders(ordersData);
      setPendingUsers(Array.isArray(usersData) ? usersData : []);
      setAllUsers(Array.isArray(allUsersData) ? allUsersData : []);
      setHeroImage((heroData as any).value || "");
      setHeaderImages(parseHeaderImages((headerImageData as any).value));
      setChangeRequests(Array.isArray(changesData) ? changesData : []);
      setReports(Array.isArray(reportsData) ? reportsData : []);
      const s = {
        total: ordersData.length,
        pending: ordersData.filter((o: Order) => o.status === "pending").length,
        paid: ordersData.filter((o: Order) => o.status === "paid").length,
        delivered: ordersData.filter((o: Order) => o.status === "delivered").length,
        released: ordersData.filter((o: Order) => o.status === "released").length,
        revenue: ordersData.filter((o: Order) => o.status === "released").reduce((sum: number, o: Order) => sum + o.commissionAmount, 0),
      };
      setStats(s);
      setLoading(false);
    });
  };

  const updateOrderStatus = async (id: string, status: string, note?: string, actionToken?: string) => {
    const moneyActions: Record<string, string> = {
      released: "release payment to farmer",
      refunded: "send the refund to the buyer",
    };
    const action = moneyActions[status] || (status === "paid" ? "confirm payment received" : status === "cancelled" ? "cancel this order" : "update");
    if (!actionToken && (status === "released" || status === "refunded")) {
      // Money-movement — require admin email code first
      setOtpModal({ orderId: id, label: action });
      // trigger the email code
      await fetch("/api/auth/admin-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      return;
    }
    if (actionToken && status !== "released") actionToken = undefined;
    if (!confirm(`Are you sure you want to ${action}?`)) return;
    const res = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(actionToken ? { "x-admin-action-token": actionToken } : {}) },
      body: JSON.stringify({ id, status, adminNote: note }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (err.requireOtp) {
      setOtpModal({ orderId: id, label: action, status });
        await fetch("/api/auth/admin-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        return;
      }
      alert(err.error || "Action failed");
      return;
    }
    loadAll();
  };

  const submitReleaseOtp = async () => {
    if (!otpModal) return;
    setOtpLoading(true);
    setOtpError("");
    try {
      const otpRes = await fetch("/api/auth/admin-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: otpCode.trim() }),
      });
      const otpData = await otpRes.json();
      if (!otpRes.ok || !otpData.actionToken) {
        setOtpError(otpData.error || "Invalid code");
        setOtpLoading(false);
        return;
      }
      setOtpLoading(false);
      setOtpModal(null);
      setOtpCode("");
      await updateOtpVerified(otpModal.orderId, otpData.actionToken);
    } catch {
      setOtpError("Verification failed. Try again.");
      setOtpLoading(false);
    }
  };

  const updateOtpVerified = async (id: string, actionToken: string) => {
    // The step-up modal tells us which money action this token is for
    const targetStatus = otpModal?.status || "released";
    await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-action-token": actionToken },
      body: JSON.stringify({
        id,
        status: targetStatus,
        adminNote: targetStatus === "refunded" ? "Refund sent to buyer after admin confirmation" : "Payment released after admin OTP confirmation",
      }),
    });
    setOtpModal(null);
    loadAll();
  };

  const handleVerification = async (userId: string, action: "approve" | "reject") => {
    const label = action === "approve" ? "approve" : "reject";
    if (!confirm(`Are you sure you want to ${label} this user?`)) return;
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action }),
    });
    loadAll();
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    if (!confirm(`Delete ${name} permanently?\n\nThis removes their account, listings, ID documents and reviews. Orders they took part in keep the records for money accounting. This cannot be undone.`)) return;
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Delete failed");
      return;
    }
    loadAll();
  };

  const uploadHero = async (file: File) => {
    setHeroUploading(true);
    setHeroError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "hero");
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      const upData = await up.json();
      if (!up.ok) throw new Error(upData.error || "Upload failed");
      const save = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "heroImage", value: upData.url }),
      });
      if (!save.ok) throw new Error("Could not save setting");
      setHeroImage(upData.url);
    } catch (e: any) {
      setHeroError(e.message || "Upload failed");
    } finally {
      setHeroUploading(false);
    }
  };

  const removeHero = async () => {
    if (!confirm("Remove the homepage hero image? The green gradient returns.")) return;
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "heroImage", value: "" }),
    });
    setHeroImage("");
  };

  const uploadHeaderImage = async (files: File[]) => {
    if (files.length === 0) return;
    setHeaderUploading(true);
    setHeaderError("");
    try {
      // upload each file sequentially, collecting URLs — avoids the stale
      // state race of parallel uploads each reading the same headerImages
      const urls: string[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("kind", "hero");
        const up = await fetch("/api/upload", { method: "POST", body: fd });
        const upData = await up.json();
        if (!up.ok) throw new Error(upData.error || "Upload failed");
        urls.push(upData.url);
      }
      // save the whole updated slideshow in ONE settings write
      const next = [...headerImages, ...urls];
      const save = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "headerImage", value: JSON.stringify(next) }),
      });
      if (!save.ok) throw new Error("Could not save setting");
      setHeaderImages(next);
    } catch (e: any) {
      setHeaderError(e.message || "Upload failed");
    } finally {
      setHeaderUploading(false);
    }
  };

  const removeHeaderImage = async (url: string) => {
    if (!confirm("Remove this slide image? The others stay.")) return;
    const next = headerImages.filter((u) => u !== url);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "headerImage", value: JSON.stringify(next) }),
    });
    setHeaderImages(next);
  };

  const removeHeaderImageAll = async () => {
    if (!confirm("Remove ALL header banner images? The solid green bar returns.")) return;
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "headerImage", value: "[]" }),
    });
    setHeaderImages([]);
  };

  const handleChangeRequest = async (requestId: string, action: "approve" | "reject") => {
    const label = action === "approve" ? "approve" : "reject";
    if (!confirm(`Are you sure you want to ${label} this change request?`)) return;
    const res = await fetch("/api/admin/changes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, action }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Action failed");
      return;
    }
    loadAll();
  };

  const purgeRejected = async () => {
    if (!confirm("Remove ALL rejected registrations permanently?\n\nThey can always re-register. Their ID photos are deleted too. This cannot be undone.")) return;
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purgeRejected: true }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Purge failed");
      return;
    }
    const data = await res.json();
    alert(`Removed ${data.purged} rejected registration(s).`);
    loadAll();
  };

  const handleReportStatus = async (id: string, status: string) => {
    const res = await fetch("/api/reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed");
      return;
    }
    loadAll();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;
  if (!user) return null;

  const statusColors: any = {
    pending: "bg-amber-50 text-amber-600", paid: "bg-blue-50 text-blue-600",
    delivered: "bg-green-50 text-green-600", released: "bg-[#1b5e20] text-white",
    cancelled: "bg-red-50 text-red-600",
    refund_requested: "bg-amber-50 text-amber-700 border border-amber-300",
    refunded: "bg-[#e8f5e9] text-[#1b5e20]",
  };

  return (
    <div className="min-h-screen">
      {/* Ghana Card Modal */}
      {cardModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setCardModal(null)}>
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <img src={cardModal} alt="Ghana Card" className="w-full rounded-xl shadow-2xl" />
            <button onClick={() => setCardModal(null)} className="absolute top-2 right-2 bg-white text-gray-800 w-9 h-9 rounded-full font-bold text-lg hover:bg-gray-100">✕</button>
          </div>
        </div>
      )}

      <header className="bg-[#1b5e20] text-white px-6 py-3 flex items-center justify-between sticky top-0 z-40">
          <HeaderBanner />
        <div className="text-lg font-bold"><img src="/logo.jpg" alt="Logo" className="w-8 h-8 inline-block mr-2 rounded-full" /> FarmLink <span className="opacity-70 text-sm">Admin</span></div>
        <div className="flex gap-2">
          <Link href="/dashboard" className="bg-white/15 px-3 py-1.5 rounded-lg text-sm hover:bg-white/25">Dashboard</Link>
          <Link href="/prices" className="px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm transition-colors bg-[#1565c0] hover:bg-[#0d47a1] text-white">Prices</Link>
          <button onClick={() => { fetch("/api/auth/logout", { method: "POST" }).then(() => router.push("/")); }} className="bg-red-600/70 px-3 py-1.5 rounded-lg text-sm hover:bg-red-600">Logout</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-[#1b5e20] mb-6">Admin Dashboard</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 shadow border border-gray-200">
            <div className="text-xs uppercase text-gray-500">Total Orders</div>
            <div className="text-xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow border border-gray-200">
            <div className="text-xs uppercase text-gray-500">Pending</div>
            <div className="text-xl font-bold text-amber-600">{stats.pending}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow border border-gray-200">
            <div className="text-xs uppercase text-gray-500">Paid</div>
            <div className="text-xl font-bold text-blue-600">{stats.paid}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow border border-gray-200">
            <div className="text-xs uppercase text-gray-500">Delivered</div>
            <div className="text-xl font-bold text-green-600">{stats.delivered}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow border border-gray-200">
            <div className="text-xs uppercase text-gray-500">Released</div>
            <div className="text-xl font-bold text-[#1b5e20]">{stats.released}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow border-2 border-[#e65100]">
            <div className="text-xs uppercase text-gray-500">Commission</div>
            <div className="text-xl font-bold text-[#e65100]">GH₵{stats.revenue.toFixed(2)}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setActiveTab("verifications")}
            className={`px-5 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 ${activeTab === "verifications" ? "bg-[#1b5e20] text-white" : "bg-white border-2 border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
             Pending Verifications
            {pendingUsers.length > 0 && (
              <span className={`rounded-full text-xs font-bold px-2 py-0.5 ${activeTab === "verifications" ? "bg-white text-[#1b5e20]" : "bg-red-500 text-white"}`}>
                {pendingUsers.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-5 py-2.5 rounded-lg font-semibold text-sm ${activeTab === "orders" ? "bg-[#1b5e20] text-white" : "bg-white border-2 border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
             Orders ({stats.total})
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-5 py-2.5 rounded-lg font-semibold text-sm ${activeTab === "users" ? "bg-[#1b5e20] text-white" : "bg-white border-2 border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            Users ({allUsers.length})
          </button>
          {changeRequests.length > 0 && (
            <button
              onClick={() => setActiveTab("changes")}
              className={`px-5 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 ${activeTab === "changes" ? "bg-[#1b5e20] text-white" : "bg-white border-2 border-red-300 text-red-600 hover:bg-red-50"}`}
            >
              Change Requests
              <span className="rounded-full text-xs font-bold px-2 py-0.5 bg-red-500 text-white">
                {changeRequests.length}
              </span>
            </button>
          )}
          <button
            onClick={() => setActiveTab("broadcast")}
            className={`px-5 py-2.5 rounded-lg font-semibold text-sm ${activeTab === "broadcast" ? "bg-[#1b5e20] text-white" : "bg-white border-2 border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            Broadcast SMS
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`px-5 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 ${activeTab === "reports" ? "bg-[#1b5e20] text-white" : "bg-white border-2 border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            Reports
            {reports.filter((r: any) => r.status === "new").length > 0 && (
              <span className="rounded-full text-xs font-bold px-2 py-0.5 bg-red-500 text-white">
                {reports.filter((r: any) => r.status === "new").length}
              </span>
            )}
          </button>
        </div>

        {/* Broadcast Tab — promo/alert SMS to approved users */}
        {activeTab === "broadcast" && (
          <div>
            <h2 className="text-lg font-bold text-[#1b5e20] mb-1">Broadcast / Promo SMS</h2>
            <p className="text-sm text-gray-500 mb-4">
              Send one SMS to a chosen audience — new listings, price drops, promos, platform news.
              Every message is auto-prefixed "FarmLink:" and cleaned to a single SMS page (160 GSM-7 characters).
            </p>

            <div className="bg-white rounded-xl shadow border border-gray-200 p-5 mb-4">
              {/* Audience picker */}
              <div className="text-xs font-bold uppercase text-gray-500 mb-2">Audience</div>
              <div className="flex gap-2 flex-wrap mb-4">
                {([
                  ["all", "Everyone"],
                  ["buyers", "All Buyers"],
                  ["farmers", "All Farmers"],
                  ["region", "By Region"],
                  ["crop", "By Crop (buyers looking for it)"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => { setBcAudience(key as any); setBcResult(null); }}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold ${bcAudience === key ? "bg-[#1b5e20] text-white" : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {bcAudience === "region" && (
                <div className="mb-4">
                  <label className="text-xs font-semibold uppercase text-gray-500">Region</label>
                  <select value={bcRegion} onChange={(e) => setBcRegion(e.target.value)} className="w-full md:w-80 p-2.5 border-2 border-gray-200 rounded-lg mt-1 focus:border-[#43a047] outline-none">
                    <option value="">Select a region…</option>
                    {(bcPreview?.regions || []).map((r) => (
                      <option key={r.region} value={r.region}>{r.region} ({r.count} user{r.count === 1 ? "" : "s"})</option>
                    ))}
                  </select>
                </div>
              )}
              {bcAudience === "crop" && (
                <div className="mb-4">
                  <label className="text-xs font-semibold uppercase text-gray-500">Crop</label>
                  <input
                    type="text"
                    value={bcCrop}
                    onChange={(e) => setBcCrop(e.target.value)}
                    placeholder="e.g. Maize — buyers whose 'Looking For' includes it"
                    className="w-full md:w-96 p-2.5 border-2 border-gray-200 rounded-lg mt-1 focus:border-[#43a047] outline-none"
                  />
                </div>
              )}

              {/* Recipient count */}
              <div className="bg-[#e8f5e9] border border-[#c8e6c9] rounded-lg p-3 mb-4 text-sm">
                <strong className="text-[#1b5e20]">{bcAudienceCount()}</strong>
                <span className="text-gray-600"> approved user(s) will receive this SMS.</span>
              </div>

              {/* Message composer */}
              <label className="text-xs font-bold uppercase text-gray-500">Message</label>
              <textarea
                value={bcMessage}
                onChange={(e) => setBcMessage(e.target.value)}
                rows={3}
                maxLength={220}
                placeholder="e.g. Fresh maize now on FarmLink from GHS 100/bag in Koforidua. Order today: framlinkgh.vercel.app"
                className="w-full p-3 border-2 border-gray-200 rounded-lg mt-1 focus:border-[#43a047] outline-none"
              />
              <div className={`text-xs mt-1 font-semibold ${bcLength.overLimit ? "text-red-600" : "text-gray-500"}`}>
                {bcLength.overLimit
                  ? `Over the 160-character SMS limit by ${bcLength.sanitized - 160} — shorten it (GH₵ auto-becomes GHS, emojis are stripped).`
                  : `${bcLength.sanitized}/160 characters used (${bcLength.remaining} left after cleanup).`}
              </div>

              <div className="flex items-center gap-3 mt-4 flex-wrap">
                <button
                  onClick={sendBroadcast}
                  disabled={bcSending || !bcMessage.trim() || bcLength.overLimit || (bcAudience === "region" && !bcRegion) || (bcAudience === "crop" && !bcCrop.trim())}
                  className="bg-[#1b5e20] text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-[#0d3818] disabled:opacity-50"
                >
                  {bcSending ? "Sending..." : "Send Broadcast SMS"}
                </button>
                <span className="text-xs text-gray-400">Uses your Arkesel SMS balance · Cannot be undone</span>
              </div>
            </div>

            {/* Result */}
            {bcResult && (
              <div className={`rounded-xl shadow border p-5 ${bcResult.failed > 0 ? "bg-amber-50 border-amber-200" : "bg-[#e8f5e9] border-[#c8e6c9]"}`}>
                <div className="font-bold text-[#1b5e20] mb-1">
                  Broadcast sent — {bcResult.sent} of {bcResult.total} delivered to the gateway
                </div>
                {bcResult.failed > 0 && (
                  <div className="text-sm text-amber-700 mb-1">
                    {bcResult.failed} message(s) failed. Check the Arkesel balance or the recipient numbers.
                  </div>
                )}
                <div className="text-xs text-gray-500">
                  Audience: {bcResult.audience.type}{bcResult.audience.region ? ` (${bcResult.audience.region})` : ""}{bcResult.audience.crop ? ` — crop: ${bcResult.audience.crop}` : ""}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reports Tab — user complaints, scams, payment problems */}
        {activeTab === "reports" && (
          <div>
            <h2 className="text-lg font-bold text-[#1b5e20] mb-3">User Reports &amp; Complaints</h2>
            {reports.length === 0 ? (
              <div className="bg-white rounded-xl shadow border border-gray-200 p-10 text-center text-gray-400">
                <div className="font-semibold">No reports yet</div>
                <div className="text-sm">Scam reports, payment complaints and other user reports appear here.</div>
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((r: any) => (
                  <div key={r.id} className={`bg-white rounded-xl shadow border-2 p-5 ${r.status === "new" ? "border-amber-300" : r.status === "resolved" ? "border-green-200" : "border-gray-200"}`}>
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold uppercase px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">{r.category}</span>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${r.status === "new" ? "bg-amber-100 text-amber-700" : r.status === "resolved" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                          {r.status === "new" ? "NEW" : r.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="text-sm text-gray-500 mb-2">
                      From: <strong>{r.reporterName}</strong>{r.reporterPhone ? ` (${r.reporterPhone})` : ""}
                      {r.listingUrl && <span> · about <a href={r.listingUrl} target="_blank" className="text-[#1b5e20] underline">a listing</a></span>}
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 mb-3 whitespace-pre-wrap">{r.message}</div>
                    <div className="flex gap-2 flex-wrap">
                      {r.status === "new" && (
                        <button onClick={() => handleReportStatus(r.id, "reviewing")} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-blue-700">
                          Mark Reviewing
                        </button>
                      )}
                      {r.status !== "resolved" && (
                        <button onClick={() => handleReportStatus(r.id, "resolved")} className="bg-[#1b5e20] text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-[#0d3818]">
                          Resolve {r.reporterPhone ? "(SMSes reporter)" : ""}
                        </button>
                      )}
                      {r.status === "resolved" && <span className="text-sm text-[#1b5e20] font-semibold self-center">Resolved</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pending name/password change requests */}
        {activeTab === "changes" && (
          <div>
            <h2 className="text-lg font-bold text-[#1b5e20] mb-3">Pending Account Changes</h2>
            {changeRequests.length === 0 ? (
              <div className="bg-white rounded-xl shadow border border-gray-200 p-10 text-center text-gray-400">
                <div className="font-semibold">No pending change requests</div>
                <div className="text-sm">Name and password changes users request will appear here.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {changeRequests.map((cr: any) => (
                  <div key={cr.id} className="bg-white rounded-xl shadow border-2 border-amber-200 p-5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full mr-2 ${cr.kind === "name" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-purple-50 text-purple-700 border border-purple-200"}`}>
                          {cr.kind === "name" ? "Name Change" : "Password Change"}
                        </span>
                        <span className="font-bold">{cr.user?.name}</span>
                        <span className="text-sm text-gray-500 ml-2">{cr.user?.phone} · {cr.user?.role}</span>
                      </div>
                      <div className="text-xs text-gray-400">Requested {new Date(cr.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="mt-3 bg-gray-50 rounded-lg p-3 text-sm">
                      {cr.kind === "name" ? (
                        <div>
                          Current name: <strong>{cr.user?.name}</strong>
                          <span className="mx-2 text-gray-400">→</span>
                          New name: <strong className="text-[#1b5e20]">{cr.newName}</strong>
                        </div>
                      ) : (
                        <div>New password requested (hidden for security). Approving replaces the current password.</div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleChangeRequest(cr.id, "approve")}
                        className="flex-1 bg-[#1b5e20] text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-[#0d3818]"
                      >Approve</button>
                      <button
                        onClick={() => handleChangeRequest(cr.id, "reject")}
                        className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-red-700"
                      >Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Homepage Hero Image Manager */}
        <div className="bg-white rounded-xl shadow border border-gray-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-[#1b5e20]">Homepage Hero Image</h3>
              <p className="text-xs text-gray-500">A landscape photo covers the homepage banner behind the text</p>
            </div>
            {heroImage && (
              <button onClick={removeHero} className="text-xs text-red-600 font-semibold hover:underline">Remove</button>
            )}
          </div>
          {heroError && <div className="bg-red-50 text-red-600 text-xs p-2 rounded mb-3">{heroError}</div>}
          <div className="flex items-center gap-4">
            <div className="w-40 h-20 rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-50 flex items-center justify-center shrink-0">
              {heroImage ? <img src={heroImage} alt="Hero" className="w-full h-full object-cover" /> : <span className="text-gray-400 text-xs">No image</span>}
            </div>
            <label className={`cursor-pointer px-5 py-2.5 rounded-lg font-semibold text-sm ${heroUploading ? "bg-gray-200 text-gray-500" : "bg-[#1b5e20] text-white hover:bg-[#0d3818]"}`}>
              {heroUploading ? "Uploading..." : heroImage ? "Replace Image" : "Upload Landscape Image"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={heroUploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadHero(f); e.currentTarget.value = ""; }}
              />
            </label>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow border border-gray-200 p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-[#1b5e20]">Logged-in Header Slideshow</h3>
              <p className="text-xs text-gray-500">
                {headerImages.length === 0
                  ? "Landscape photos rotate behind the green bar where the user's name shows after login"
                  : `${headerImages.length} slide${headerImages.length > 1 ? "s" : ""} — they crossfade behind the green bar (logo, name, Market, Prices, Profile, My Orders)`}
              </p>
            </div>
            {headerImages.length > 0 && (
              <button onClick={removeHeaderImageAll} className="text-xs text-red-600 font-semibold hover:underline shrink-0">Remove All</button>
            )}
          </div>
          {headerError && <div className="bg-red-50 text-red-600 text-xs p-2 rounded mb-3">{headerError}</div>}
          <div className="flex items-center gap-3 flex-wrap">
            {headerImages.map((url, i) => (
              <div key={url} className="relative w-36 h-16 rounded-lg overflow-hidden border-2 border-gray-200 group">
                <img src={url} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" />
                <span className="absolute top-1 left-1 bg-[#1b5e20] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">{i + 1}</span>
                <button
                  onClick={() => removeHeaderImage(url)}
                  className="absolute top-1 right-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded hover:bg-red-700"
                >✕</button>
              </div>
            ))}
            <label className={`cursor-pointer px-5 py-2.5 rounded-lg font-semibold text-sm shrink-0 ${headerUploading ? "bg-gray-200 text-gray-500" : "bg-[#1b5e20] text-white hover:bg-[#0d3818]"}`}>
              {headerUploading ? "Uploading..." : headerImages.length === 0 ? "Upload Landscape Image" : "Add Slide"}
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={headerUploading}
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  uploadHeaderImage(files);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </div>

        {/* Pending Verifications Tab */}
        {activeTab === "verifications" && (
          <div>
            <h2 className="text-lg font-bold text-[#1b5e20] mb-3">Pending Account Verifications</h2>
            {pendingUsers.length === 0 ? (
              <div className="bg-white rounded-xl shadow border border-gray-200 p-10 text-center text-gray-400">
                <div className="font-semibold">No pending verifications</div>
                <div className="text-sm">All registered users have been reviewed.</div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {pendingUsers.map((u) => (
                  <div key={u.id} className="bg-white rounded-xl shadow border-2 border-amber-200 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="font-bold text-lg">{u.name}</div>
                        <div className="text-sm text-gray-500">{u.phone} · <span className={`capitalize font-semibold ${u.role === "farmer" ? "text-[#1b5e20]" : "text-[#e65100]"}`}>{u.role}</span></div>
                        <div className="text-xs text-gray-400 mt-0.5">Registered: {new Date(u.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
                      </div>
                      <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full">Pending</span>
                    </div>

                    {/* ID document preview + number to verify against photo */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-semibold uppercase text-gray-500">
                          {u.idType === "passport" ? "Passport" : "Ghana Card"}
                        </div>
                        <div className="font-mono text-xs font-bold text-[#1b5e20] bg-[#e8f5e9] border border-[#43a047] px-2.5 py-1 rounded-lg">
                          {u.idNumber || "— no number —"}
                        </div>
                      </div>
                      {(u.idType === "passport" ? u.passportUrl : u.ghanaCardUrl) ? (
                        <button
                          onClick={() => setCardModal(u.idType === "passport" ? u.passportUrl : u.ghanaCardUrl)}
                          className="relative w-full h-36 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-[#1b5e20] transition-colors group"
                        >
                          <img src={u.idType === "passport" ? u.passportUrl : u.ghanaCardUrl} alt={u.idType === "passport" ? "Passport" : "Ghana Card"} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <span className="opacity-0 group-hover:opacity-100 bg-white text-gray-800 text-xs font-semibold px-3 py-1 rounded-full transition-opacity"> Click to enlarge</span>
                          </div>
                        </button>
                      ) : (
                        <div className="w-full h-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-sm">
                          No document uploaded
                        </div>
                      )}
                    </div>

                    {/* Verify checklist */}
                    <div className="bg-gray-50 rounded-lg p-3 mb-4 text-xs text-gray-600">
                      <div className="font-semibold mb-1">Verify before approving:</div>
                      <ul className="space-y-0.5 list-disc list-inside">
                        <li>Number above matches the document photo exactly</li>
                        <li>Name on document matches: <strong>{u.name}</strong></li>
                        <li>Document appears clear and genuine</li>
                      </ul>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleVerification(u.id, "approve")}
                        className="flex-1 bg-[#1b5e20] text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-[#0d3818]"
                      >Approve</button>
                      <button
                        onClick={() => handleVerification(u.id, "reject")}
                        className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-red-700"
                      >Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Users Tab — manage every registered account */}
        {activeTab === "users" && (
          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="text-lg font-bold text-[#1b5e20]">All Users</h2>
              {allUsers.filter((u: any) => u.status === "rejected").length > 0 && (
                <button
                  onClick={purgeRejected}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-red-700"
                >
                  Remove All Rejected ({allUsers.filter((u: any) => u.status === "rejected").length})
                </button>
              )}
            </div>
            {allUsers.length === 0 ? (
              <div className="bg-white rounded-xl shadow border border-gray-200 p-10 text-center text-gray-400">
                <div className="font-semibold">No registered users yet</div>
                <div className="text-sm">Farmers and buyers will appear here when they sign up.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {allUsers.map((u) => (
                  <div key={u.id} className="bg-white rounded-xl shadow border border-gray-200 p-4 flex items-center gap-4 flex-wrap">
                    <div className="w-12 h-12 rounded-full bg-[#e8f5e9] flex items-center justify-center text-xl shrink-0">
                      {u.role === "farmer" ? " " : ""}
                    </div>
                    <div className="flex-1 min-w-[180px]">
                      <div className="font-bold">{u.name}</div>
                      <div className="text-sm text-gray-500">
                        {u.phone} · <span className={`font-semibold ${u.role === "farmer" ? "text-[#1b5e20]" : "text-[#e65100]"}`}>{u.role}</span>
                        {u.idNumber && <span className="ml-2 font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{u.idNumber}</span>}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">Joined {new Date(u.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {u.status === "pending" && <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full">Pending</span>}
                      {u.status === "approved" && <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">Approved</span>}
                      {u.status === "rejected" && <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full">Rejected</span>}
                      {(u.ghanaCardUrl || u.passportUrl) && (
                        <button
                          onClick={() => setCardModal(u.idType === "passport" ? u.passportUrl : u.ghanaCardUrl)}
                          className="text-xs text-[#1b5e20] font-semibold hover:underline"
                        >
                          View ID
                        </button>
                      )}
                      {u.status === "pending" && (
                        <>
                          <button
                            onClick={() => handleVerification(u.id, "approve")}
                            className="bg-[#1b5e20] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#0d3818]"
                          >Approve</button>
                          <button
                            onClick={() => handleVerification(u.id, "reject")}
                            className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-700"
                          >Reject</button>
                        </>
                      )}
                      <button
                        onClick={() => handleDeleteUser(u.id, u.name)}
                        className="border-2 border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-50"
                      >Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div>
            <h2 className="text-lg font-bold text-[#1b5e20] mb-3">All Orders</h2>
            {orders.length === 0 ? (
              <div className="bg-white rounded-xl shadow border border-gray-200 p-8 text-center text-gray-400">No orders yet</div>
            ) : (
              <div className="space-y-4">
                {orders.map((o) => (
                  <div key={o.id} className="bg-white rounded-xl shadow border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="font-bold text-lg">{o.crop}</span>
                        <span className={`ml-3 px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[o.status]}`}>{o.status}</span>
                      </div>
                      <span className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3 text-sm mb-3">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs uppercase text-gray-500 mb-1">Buyer</div>
                        <div className="font-semibold">{o.buyerName}</div>
                        <div className="text-gray-600">{o.buyerPhone}</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs uppercase text-gray-500 mb-1">Farmer</div>
                        <div className="font-semibold">{o.farmerName}</div>
                        <div className="text-gray-600">{o.farmerPhone}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                      <div><span className="text-gray-500">Qty:</span> <strong>{o.quantity} bags</strong></div>
                      <div><span className="text-gray-500">Total:</span> <strong className="text-[#e65100]">GH₵{o.totalAmount.toLocaleString()}</strong></div>
                      <div><span className="text-gray-500">Farmer Payout:</span> <strong className="text-[#1b5e20]">GH₵{o.farmerPayout.toFixed(2)}</strong></div>
                      <div><span className="text-gray-500">Commission:</span> <strong>GH₵{o.commissionAmount.toFixed(2)}</strong></div>
                    </div>
                    {o.hubtelTxId && <div className="text-xs text-gray-400 mb-2">Hubtel Tx: {o.hubtelTxId}</div>}
                    {o.adminNote && <div className="bg-amber-50 rounded-lg p-2 text-xs text-amber-700 mb-3">Note: {o.adminNote}</div>}
                    <div className="flex gap-2 flex-wrap">
                      {o.status === "pending" && (
                        <>
                          <button onClick={() => updateOrderStatus(o.id, "paid", "Payment confirmed by admin")} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-blue-700">✓ Confirm Payment</button>
                          <button onClick={() => updateOrderStatus(o.id, "cancelled", "Order cancelled by admin")} className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-red-700">Cancel</button>
                        </>
                      )}
                      {o.status === "paid" && <span className="text-sm text-gray-500 italic">Waiting for buyer to confirm delivery</span>}
                      {o.status === "delivered" && (
                        <button onClick={() => updateOrderStatus(o.id, "released", "Payment released to farmer")} className="bg-[#1b5e20] text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-[#0d3818]">Release Payment to Farmer (GH₵{o.farmerPayout.toFixed(2)})
                        </button>
                      )}
                      {o.status === "refund_requested" && (
                        <>
                          {/* Refund case: reason + farmer complaint + damage adjustment */}
                          <div className="w-full bg-amber-50 border border-amber-200 rounded-lg p-3 mb-1 text-xs space-y-1">
                            {o.refundReason && <div className="text-gray-700"><strong>Buyer's reason:</strong> {o.refundReason}</div>}
                            {o.farmerComplaint
                              ? <div className="text-red-600"><strong>Farmer's complaint:</strong> {o.farmerComplaint}</div>
                              : <div className="text-gray-400">No farmer complaint on file</div>}
                            <div className="text-gray-500">Measure any damage and subtract it below — the buyer receives the adjusted amount.</div>
                          </div>
                          <RefundControls order={o} onDone={loadAll} />
                          <button onClick={() => updateOrderStatus(o.id, "delivered", "Refund request declined — buyer contacted")} className="border-2 border-gray-200 text-gray-600 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-gray-50">
                            Decline Refund
                          </button>
                        </>
                      )}
                      {o.status === "refunded" && (
                        <span className="text-sm text-[#1b5e20] font-semibold">
                          ✓ Refund sent — GH₵{(o.refundAmount ?? o.totalAmount).toFixed(2)}
                          {(o.damageDeduction ?? 0) > 0 && ` (damage -GH₵${(o.damageDeduction ?? 0).toFixed(2)})`}
                        </span>
                      )}
                      {o.status === "released" && <span className="text-sm text-[#1b5e20] font-semibold">✓ Payment released — Commission: GH₵{o.commissionAmount.toFixed(2)}</span>}
                      {o.status === "cancelled" && <span className="text-sm text-red-500">Order cancelled</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
  {otpModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-sm">
            <h2 className="text-xl font-bold text-[#1b5e20] text-center mb-1">Confirm Admin Action</h2>
            <p className="text-sm text-gray-500 text-center mb-5">
              Enter the code sent to the admin email to {otpModal.label}.
            </p>
            {otpError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4 text-center">{otpError}</div>}
            <input
              type="text" inputMode="numeric" maxLength={8}
              value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="••••••••" autoFocus
              className="w-full p-4 border-2 border-gray-200 rounded-lg text-center text-3xl tracking-[0.4em] font-bold outline-none focus:border-[#43a047] mb-4"
            />
            <button onClick={submitReleaseOtp} disabled={otpLoading || otpCode.length < 8}
              className="w-full bg-[#1b5e20] text-white py-3 rounded-lg font-bold hover:bg-[#0d3818] disabled:opacity-60 mb-2">
              {otpLoading ? "Confirming..." : "Confirm"}
            </button>
            <button onClick={() => { setOtpModal(null); setOtpCode(""); }}
              className="w-full text-sm text-gray-500 py-2 hover:text-gray-700">Cancel</button>
          </div>
        </div>
      )}
        </div>
    </div>

  );
}
