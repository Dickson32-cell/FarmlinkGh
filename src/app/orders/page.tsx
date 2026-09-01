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
  farmerName: string;
  farmerPhone: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [payingFor, setPayingFor] = useState<string | null>(null);
  const router = useRouter();

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
      if (d.user.role !== "buyer") { router.push("/dashboard"); return; }
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
    if (!confirm("Confirm you have received the product? This will notify the admin to release payment to the farmer.")) return;
    await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: orderId, status: "delivered" }),
    });
    loadOrders();
  };

  const requestRefund = async (orderId: string, crop: string) => {
    const reason = prompt(`Why are you requesting a refund for ${crop}? (optional, helps the admin review)`) ?? "";
    if (!confirm("Request a refund? The admin will review and send your money back within 2-3 days.")) return;
    await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: orderId, status: "refund_requested" }),
    });
    loadOrders();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;

  const statusColors: any = {
    pending: "bg-amber-50 text-amber-600",
    paid: "bg-blue-50 text-blue-600",
    delivered: "bg-green-50 text-green-600",
    released: "bg-[#1b5e20] text-white",
    cancelled: "bg-red-50 text-red-600",
    refund_requested: "bg-amber-50 text-amber-700",
    refunded: "bg-[#e8f5e9] text-[#1b5e20]",
  };

  return (
    <div className="min-h-screen">
      <header className="bg-[#1b5e20] text-white px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="text-lg font-bold"><img src="/logo.jpg" alt="Logo" className="w-8 h-8 inline-block mr-2 rounded-full" /> FarmLink <span className="opacity-70 text-sm">My Orders</span></div>
        <div className="flex gap-2">
          <Link href="/market" className="bg-white/15 px-3 py-1.5 rounded-lg text-sm hover:bg-white/25">Market</Link>
          <Link href="/prices" className="bg-white/15 px-3 py-1.5 rounded-lg text-sm hover:bg-white/25">Prices</Link>
          <Link href="/dashboard" className="bg-white/15 px-3 py-1.5 rounded-lg text-sm hover:bg-white/25">Dashboard</Link>
          <button onClick={() => { fetch("/api/auth/logout", { method: "POST" }).then(() => router.push("/")); }} className="bg-red-600/70 px-3 py-1.5 rounded-lg text-sm hover:bg-red-600">Logout</button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6">
        {paymentStatus && (
          <div className={`rounded-xl p-4 mb-6 text-sm font-semibold ${
            paymentStatus === "success" ? "bg-[#e8f5e9] text-[#1b5e20] border border-[#43a047]" :
            paymentStatus === "failed" ? "bg-red-50 text-red-600 border border-red-200" :
            paymentStatus === "amount_mismatch" ? "bg-red-50 text-red-700 border border-red-300" :
            "bg-amber-50 text-amber-700 border border-amber-200"
          }`}>
            {paymentStatus === "success" && "✅ Payment confirmed! The admin has been notified to release payment to the farmer."}
            {paymentStatus === "failed" && "❌ Payment was not completed. You can try paying again below."}
            {paymentStatus === "amount_mismatch" && "⚠️ Payment amount did not match the order. Contact support — do not retry payment."}
            {paymentStatus === "already" && "ℹ️ This order was already processed."}
            {paymentStatus === "notfound" && "⚠️ Order not found for this payment reference."}
            {paymentStatus === "error" && "⚠️ Something went wrong verifying your payment. If you were debited, contact support with your Paystack receipt."}
            {paymentStatus === "amount_mismatch" && ""}
          </div>
        )}
        <h1 className="text-2xl font-bold text-[#1b5e20] mb-6">My Orders</h1>

        {paymentInfo && (
          <div className="bg-[#e8f5e9] border border-[#43a047] rounded-xl p-5 mb-6">
            <h2 className="font-bold text-[#1b5e20] mb-2">Payment Instructions</h2>
            {paymentInfo.mode === "manual" ? (
              <div className="space-y-2 text-sm">
                <p>Send <strong>GH₵{paymentInfo.amount}</strong> via MoMo to:</p>
                <p className="text-2xl font-bold text-[#1b5e20]">📞 {paymentInfo.adminMomo}</p>
                <p>Reference: <strong>{paymentInfo.reference}</strong></p>
                <p className="text-gray-600">After sending, the admin will confirm receipt. Then you'll be notified to confirm delivery.</p>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <p>{paymentInfo.message}</p>
                <p className="text-gray-600">Transaction ID: {paymentInfo.hubtelData?.TransactionId || "Processing..."}</p>
              </div>
            )}
            <button onClick={() => setPaymentInfo(null)} className="mt-3 bg-[#1b5e20] text-white px-4 py-2 rounded-lg font-semibold text-sm">Got it</button>
          </div>
        )}

        {orders.length === 0 ? (
          <div className="bg-white rounded-xl shadow border border-gray-200 p-8 text-center text-gray-400">
            No orders yet. <Link href="/market" className="text-[#1b5e20] font-semibold">Browse market →</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => (
              <div key={o.id} className="bg-white rounded-xl shadow border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-bold text-lg">{o.crop}</span>
                    <span className={`ml-3 px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[o.status] || "bg-gray-50 text-gray-600"}`}>{o.status}</span>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                  <div><span className="text-gray-500">Quantity:</span> <strong>{o.quantity} bags</strong></div>
                  <div><span className="text-gray-500">Unit Price:</span> <strong>GH₵{o.unitPrice.toLocaleString()}</strong></div>
                  <div><span className="text-gray-500">Total:</span> <strong className="text-[#e65100]">GH₵{o.totalAmount.toLocaleString()}</strong></div>
                  <div><span className="text-gray-500">Farmer:</span> <strong>{o.farmerName}</strong></div>
                </div>

                {/* Payment breakdown */}
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 mb-3 grid grid-cols-3 gap-2">
                  <div>Farmer gets: <strong className="text-[#1b5e20]">GH₵{o.farmerPayout.toFixed(2)}</strong></div>
                  <div>Admin (10%): <strong>GH₵{o.commissionAmount.toFixed(2)}</strong></div>
                  <div>Payment fee: <strong>GH₵{(o.totalAmount - o.farmerPayout - o.commissionAmount).toFixed(2)}</strong></div>
                </div>

                {o.adminNote && (
                  <div className="bg-amber-50 rounded-lg p-2 text-xs text-amber-700 mb-3">Admin: {o.adminNote}</div>
                )}

                {/* Action buttons based on status */}
                <div className="flex gap-2">
                  {o.status === "pending" && (
                    <button onClick={() => initiatePayment(o.id)} disabled={payingFor === o.id} className="bg-[#1b5e20] text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-[#0d3818] disabled:opacity-50">
                      {payingFor === o.id ? "Initiating..." : "Pay Now"}
                    </button>
                  )}
                  {o.status === "paid" && (
                    <button onClick={() => confirmDelivery(o.id)} className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-green-700">
                      ✓ Confirm Delivery
                    </button>
                  )}
                  {(o.status === "paid" || o.status === "delivered") && (
                    <button onClick={() => requestRefund(o.id, o.crop)} className="bg-red-50 border-2 border-red-200 text-red-600 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-red-100">
                      ↩ Request Refund
                    </button>
                  )}
                  {o.status === "delivered" && (
                    <span className="text-sm text-gray-500 italic">Waiting for admin to release payment to farmer</span>
                  )}
                  {o.status === "refund_requested" && (
                    <span className="text-sm text-amber-600 font-semibold">↩ Refund requested — admin will send your money within 2-3 days</span>
                  )}
                  {o.status === "refunded" && (
                    <span className="text-sm text-[#1b5e20] font-semibold">✓ Refund sent by admin</span>
                  )}
                  {o.status === "released" && (
                    <span className="text-sm text-[#1b5e20] font-semibold">✓ Payment released to farmer</span>
                  )}
                  {o.status === "cancelled" && (
                    <span className="text-sm text-red-500">Order cancelled</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
