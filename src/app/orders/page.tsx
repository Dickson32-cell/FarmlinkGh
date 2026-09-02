"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Order {
  id: string;
  crop: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  commissionAmount: number;
  farmerPayout: number;
  refundAmount?: number | null;
  damageDeduction?: number | null;
  farmerName: string;
  farmerPhone: string;
  buyerName: string;
  buyerPhone: string;
  status: string;
  adminNote: string | null;
  refundReason?: string | null;
  farmerComplaint?: string | null;
  deliveryAddress?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  deliveredAt?: string | null;
  createdAt: string;
}

import HeaderBanner from "@/components/headerBanner";
import NotificationBell from "@/components/notificationBell";

const statusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  paid: "bg-blue-50 text-blue-700",
  delivered: "bg-indigo-50 text-indigo-700",
  released: "bg-[#e8f5e9] text-[#1b5e20]",
  cancelled: "bg-red-50 text-red-500",
  refund_requested: "bg-amber-50 text-amber-700",
  refunded: "bg-[#e8f5e9] text-[#1b5e20]",
};

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [payingFor, setPayingFor] = useState<string | null>(null);
  const [role, setRole] = useState<string>("");
  const router = useRouter();
  // Order History: Active = in-flight trades; History = closed (released/refunded/cancelled)
  const [orderTab, setOrderTab] = useState<"active" | "history">("active");

  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pay = params.get("payment");
    if (pay) {
      setPaymentStatus(pay);
      // clean the URL so refresh doesn't re-show the banner
      window.history.replaceState({}, "", "/orders");
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      if (!d.user) { router.push("/login"); return; }
      // BOTH buyers and farmers use this page — buyers see their purchases,
      // farmers see the orders they must deliver.
      if (d.user.role !== "buyer" && d.user.role !== "farmer") { router.push("/dashboard"); return; }
      setRole(d.user.role);
      loadOrders();
    });
  }, [router]);

  const loadOrders = () => {
    fetch("/api/orders").then((r) => r.json()).then(setOrders).finally(() => setLoading(false));
  };

  const initiatePayment = async (orderId: string) => {
    setPayingFor(orderId);
    const res = await fetch("/api/payment/paystack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    const data = await res.json();
    setPayingFor(null);
    if (data.mode === "paystack" && data.authorizationUrl) {
      // Send the buyer to Paystack's secure checkout (MoMo/card)
      window.location.href = data.authorizationUrl;
      return;
    }
    setPaymentInfo(data);
  };

  const confirmDelivery = async (orderId: string) => {
    if (!confirm("Confirm you have received the product?\n\nYou then have 3 DAYS to request a refund if the product falls short — after that the farmer is paid.")) return;
    await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: orderId, status: "delivered" }),
    });
    loadOrders();
  };

  const requestRefund = async (orderId: string, crop: string) => {
    const reason = prompt(`Why are you requesting a refund for ${crop}?\n(optional, helps the admin review)`) ?? "";
    if (!confirm("Request a refund?\n\nThe FULL amount you paid is sent back within 2-3 days — unless the farmer files a damage complaint, in which case the admin measures the damage and it may be subtracted from the refund.")) return;
    const res = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: orderId, status: "refund_requested", reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Could not request refund");
      return;
    }
    loadOrders();
  };

  const fileComplaint = async (orderId: string, crop: string) => {
    const complaint = prompt(`Describe the damage or issue with the returned ${crop}:\n(e.g. "3 out of 10 bags were torn open and spilled")`) ?? "";
    if (!complaint.trim()) { alert("Please describe the damage so the admin can assess it."); return; }
    if (!confirm("File this complaint?\n\nThe admin reviews the damage against the buyer's refund and subtracts the measured amount.")) return;
    const res = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: orderId, status: "farmer_complaint", complaint }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Could not file complaint");
      return;
    }
    loadOrders();
  };

  const hoursLeft = (deliveredAt: string | null) => {
    if (!deliveredAt) return null;
    const elapsed = (Date.now() - new Date(deliveredAt).getTime()) / (1000 * 60 * 60);
    return Math.max(0, Math.round(72 - elapsed));
  };

  const isFarmer = role === "farmer";

  // Order History split: closed statuses go to History, everything else stays Active
  const closedStatuses = ["released", "refunded", "cancelled"];
  const activeOrders = orders.filter((o) => !closedStatuses.includes(o.status));
  const historyOrders = orders.filter((o) => closedStatuses.includes(o.status));
  const visibleOrders = orderTab === "active" ? activeOrders : historyOrders;

  return (
    <div className="min-h-screen bg-[#f8faf7]">
      <header className="bg-[#1b5e20] text-white px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <HeaderBanner />
        <div className="text-lg font-bold"><img src="/logo.jpg" alt="Logo" className="w-8 h-8 inline-block mr-2 rounded-full" /> FarmLink</div>
        <div className="flex gap-2">
          {!isFarmer && <Link href="/market" className="px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm transition-colors bg-[#ef6c00] hover:bg-[#e65100] text-white">Market</Link>}
          {!isFarmer && <Link href="/wishlist" className="px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm transition-colors bg-[#7b1fa2] hover:bg-[#6a1b9a] text-white">Wishlist</Link>}
          <Link href="/prices" className="px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm transition-colors bg-[#1565c0] hover:bg-[#0d47a1] text-white">Prices</Link>
          <NotificationBell />
          <Link href="/dashboard" className="bg-white/15 px-3 py-1.5 rounded-lg text-sm hover:bg-white/25">Dashboard</Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-[#1b5e20] mb-1">{isFarmer ? "Orders to Deliver" : "My Orders"}</h1>
        <p className="text-sm text-gray-500 mb-4">
          {isFarmer
            ? "Orders buyers placed with you — delivery details included. You are SMSed the moment payment lands."
            : "Your purchases. Confirm delivery when the product arrives — you then have 3 days to request a refund."}
        </p>

        {/* Active / History tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setOrderTab("active")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${orderTab === "active" ? "bg-[#1b5e20] text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}
          >
            Active {activeOrders.length > 0 && <span className="opacity-80">({activeOrders.length})</span>}
          </button>
          <button
            onClick={() => setOrderTab("history")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${orderTab === "history" ? "bg-[#1b5e20] text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}
          >
            Order History {historyOrders.length > 0 && <span className="opacity-80">({historyOrders.length})</span>}
          </button>
        </div>

        {paymentStatus && (
          <div className={`p-4 rounded-xl mb-6 text-sm font-semibold ${paymentStatus === "success" ? "bg-green-50 border border-green-200 text-green-800" : "bg-amber-50 border border-amber-200 text-amber-700"}`}>
            {paymentStatus === "success" && "Payment successful! Your farmer has been SMSed to start delivery."}
            {paymentStatus === "already" && "This payment was already processed."}
            {paymentStatus === "failed" && "Payment failed or was cancelled. Try again from this page."}
            {paymentStatus === "amount_mismatch" && "Payment amount did not match the order. Contact support 0595726252."}
            {paymentStatus === "missing_reference" && "Payment reference missing. If you paid, contact support 0595726252."}
            {paymentStatus === "unconfigured" && "Online payment is not configured — pay via MoMo to the admin number."}
            {paymentStatus === "notfound" && "Order not found."}
            {paymentStatus === "error" && "Something went wrong verifying the payment. Contact support 0595726252."}
          </div>
        )}

        {loading && <div className="text-center text-gray-400 py-10">Loading...</div>}

        {!loading && visibleOrders.length === 0 && (
          <div className="bg-white rounded-xl shadow border border-gray-200 p-10 text-center text-gray-400">
            <div className="font-semibold mb-1">
              {orderTab === "active"
                ? isFarmer ? "No active orders" : "No active orders"
                : "No order history yet"}
            </div>
            <div className="text-sm">
              {orderTab === "active"
                ? isFarmer
                  ? "When buyers order your produce, they appear here with delivery details."
                  : <>Browse the <Link href="/market" className="text-[#1b5e20] font-semibold">market →</Link></>
                : "Completed, refunded and cancelled orders appear here for your records."}
            </div>
          </div>
        )}

        {paymentInfo && (
          <div className="bg-[#e8f5e9] rounded-xl p-5 mb-6 border border-[#c8e6c9]">
            <p className="text-sm font-semibold mb-1">Pay via MoMo (manual mode):</p>
            <p className="text-2xl font-bold text-[#1b5e20]">{paymentInfo.adminMomo}</p>
            <p className="text-sm">Amount: <strong>GH₵{paymentInfo.amount}</strong> · Reference: <strong>{paymentInfo.reference}</strong></p>
            <p className="text-xs text-gray-500 mt-1">After paying, the admin confirms receipt — then your order is marked paid and the farmer starts delivery.</p>
          </div>
        )}

        <div className="space-y-4">
          {visibleOrders.map((o) => {
            const refundWindowLeft = o.status === "delivered" && o.deliveredAt ? hoursLeft(o.deliveredAt) : null;
            return (
              <div key={o.id} className="bg-white rounded-xl shadow border border-gray-200 p-5">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-[#1b5e20]">{o.crop} × {o.quantity}</span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusColors[o.status] || "bg-gray-100 text-gray-600"}`}>{o.status.replace("_", " ")}</span>
                    {isFarmer && o.status === "paid" && <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700">PAID — DELIVER NOW</span>}
                  </div>
                  <div className="text-xs text-gray-400">Order {o.id.slice(-8).toUpperCase()} · {new Date(o.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
                </div>

                <div className="grid md:grid-cols-2 gap-3 text-sm mb-3">
                  <div className="space-y-1">
                    <div className="text-xs font-bold uppercase text-gray-400">{isFarmer ? "Buyer" : "Farmer"}</div>
                    <div>{isFarmer ? o.buyerName : o.farmerName} · {isFarmer ? o.buyerPhone : o.farmerPhone}</div>
                    {!isFarmer && <div className="text-xs text-gray-400">Contact details unlocked after payment</div>}
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-bold uppercase text-gray-400">Money</div>
                    <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-semibold">GH₵{o.totalAmount.toFixed(2)}</span></div>
                    {isFarmer && <div className="flex justify-between text-xs text-gray-500"><span>Your payout</span><span>GH₵{o.farmerPayout.toFixed(2)}</span></div>}
                    {!isFarmer && o.status === "refunded" && (
                      <>
                        <div className="flex justify-between text-xs"><span className="text-gray-500">Refund sent</span><span className="font-semibold text-[#1b5e20]">GH₵{(o.refundAmount ?? o.totalAmount).toFixed(2)}</span></div>
                        {(o.damageDeduction ?? 0) > 0 && <div className="flex justify-between text-xs text-amber-600"><span>Damage deduction</span><span>-GH₵{(o.damageDeduction ?? 0).toFixed(2)}</span></div>}
                      </>
                    )}
                  </div>
                </div>

                {/* Delivery location — the farmer's roadmap */}
                {isFarmer && (o.deliveryAddress || (o.deliveryLat && o.deliveryLng)) && (
                  <div className="bg-[#f6fbf6] border border-[#c8e6c9] rounded-lg p-3 mb-3 text-sm">
                    <div className="text-xs font-bold uppercase text-[#1b5e20] mb-1">Deliver To</div>
                    {o.deliveryAddress && <div className="text-gray-700">{o.deliveryAddress}</div>}
                    {o.deliveryLat && o.deliveryLng && (
                      <a
                        href={`https://maps.google.com/?q=${o.deliveryLat},${o.deliveryLng}`}
                        target="_blank"
                        className="inline-block mt-1 bg-[#1565c0] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#0d47a1]"
                      >
                        Open in Google Maps →
                      </a>
                    )}
                  </div>
                )}

                {/* Refund case details */}
                {o.status === "refund_requested" && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 text-sm">
                    <div className="font-semibold text-amber-700 mb-1">Refund case under review</div>
                    {o.refundReason && <div className="text-xs text-gray-600 mb-1">Buyer's reason: {o.refundReason}</div>}
                    {o.farmerComplaint && <div className="text-xs text-red-600">Farmer's complaint: {o.farmerComplaint}</div>}
                    {isFarmer && !o.farmerComplaint && (
                      <button onClick={() => fileComplaint(o.id, o.crop)} className="mt-2 bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-red-700">
                        File damage complaint
                      </button>
                    )}
                  </div>
                )}
                {o.status === "refunded" && o.farmerComplaint && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3 text-xs text-gray-600">
                    Your complaint was reviewed: {o.farmerComplaint}
                  </div>
                )}

                {/* Buyer action buttons */}
                <div className="flex gap-2 flex-wrap">
                  {!isFarmer && o.status === "pending" && (
                    <button onClick={() => initiatePayment(o.id)} disabled={payingFor === o.id} className="bg-[#1b5e20] text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-[#0d3818] disabled:opacity-50">
                      {payingFor === o.id ? "Initiating..." : "Pay Now"}
                    </button>
                  )}
                  {!isFarmer && o.status === "paid" && (
                    <button onClick={() => confirmDelivery(o.id)} className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-green-700">
                      ✓ Confirm Delivery
                    </button>
                  )}
                  {!isFarmer && (o.status === "paid" || o.status === "delivered") && (
                    <button onClick={() => requestRefund(o.id, o.crop)} className="bg-red-50 border-2 border-red-200 text-red-600 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-red-100">
                      ↩ Request Refund (full GH₵{o.totalAmount.toFixed(2)})
                    </button>
                  )}
                  {!isFarmer && refundWindowLeft !== null && refundWindowLeft > 0 && (
                    <span className="text-xs text-amber-600 font-semibold self-center">
                      {refundWindowLeft}h left in your 3-day refund window
                    </span>
                  )}
                  {!isFarmer && refundWindowLeft === 0 && (
                    <span className="text-xs text-gray-400 self-center">Refund window closed — sale final</span>
                  )}
                  {!isFarmer && o.status === "delivered" && (
                    <span className="text-sm text-gray-500 italic self-center">Waiting for the 3-day refund window to close; then the farmer is paid</span>
                  )}
                  {!isFarmer && o.status === "refund_requested" && (
                    <span className="text-sm text-amber-600 font-semibold">↩ Refund requested — the admin reviews and sends your money within 2-3 days</span>
                  )}
                  {!isFarmer && o.status === "refunded" && (
                    <span className="text-sm text-[#1b5e20] font-semibold">✓ Refund sent — GH₵{(o.refundAmount ?? o.totalAmount).toFixed(2)} returned</span>
                  )}
                  {!isFarmer && o.status === "released" && (
                    <span className="text-sm text-[#1b5e20] font-semibold">✓ Payment released to farmer</span>
                  )}
                  {!isFarmer && o.status === "cancelled" && (
                    <span className="text-sm text-red-500">Order cancelled</span>
                  )}
                  {isFarmer && o.status === "pending" && (
                    <span className="text-sm text-gray-500 italic self-center">Waiting for the buyer to pay — do not deliver yet</span>
                  )}
                  {isFarmer && o.status === "delivered" && (
                    <span className="text-sm text-gray-500 italic self-center">Buyer confirmed delivery — payout after the 3-day refund window (unless a refund case opens)</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}