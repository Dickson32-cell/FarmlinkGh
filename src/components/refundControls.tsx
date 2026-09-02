"use client";
import { useState } from "react";

// Admin-side refund controls for a refund_requested order.
// The default refund is the FULL totalAmount; if the farmer filed a damage
// complaint, the admin measures it and the deduction is subtracted.
// Sending the refund requires the email step-up token (money action).
export default function RefundControls({
  order,
  onDone,
}: {
  order: {
    id: string;
    crop: string;
    quantity: number;
    totalAmount: number;
    buyerName: string;
    farmerComplaint?: string | null;
  };
  onDone: () => void;
}) {
  const full = order.totalAmount;
  const [deduction, setDeduction] = useState<string>("");
  const [otp, setOtp] = useState("");
  const [needsOtp, setNeedsOtp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const ded = Math.max(0, Math.min(parseFloat(deduction) || 0, full));
  const payout = Math.max(0, full - ded);

  const send = async () => {
    setBusy(true);
    setError("");
    // step 1: request the action token via email code (if not yet done)
    let actionToken = "";
    if (needsOtp && otp.trim()) {
      const otpRes = await fetch("/api/auth/admin-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: otp.trim(), purpose: "admin_action" }),
      });
      const otpData = await otpRes.json();
      if (!otpRes.ok) {
        setError(otpData.error || "Wrong code");
        setBusy(false);
        return;
      }
      actionToken = otpData.actionToken;
    }

    const res = await fetch("/api/orders", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(actionToken ? { "x-admin-action-token": actionToken } : {}),
      },
      body: JSON.stringify({
        id: order.id,
        status: "refunded",
        refundAmount: payout,
        damageDeduction: ded,
        adminNote:
          ded > 0
            ? `Refund of GH₵${payout.toFixed(2)} sent to ${order.buyerName} (damage -GH₵${ded.toFixed(2)} after farmer complaint)`
            : `Full refund of GH₵${payout.toFixed(2)} sent to ${order.buyerName}`,
      }),
    });

    if (res.status === 401) {
      const data = await res.json().catch(() => ({}));
      if (data.requireOtp) {
        setNeedsOtp(true);
        setError("Enter the code emailed to the admin to move this money.");
        setBusy(false);
        return;
      }
      setError(data.error || "Not authorized");
      setBusy(false);
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Refund failed");
      setBusy(false);
      return;
    }
    setBusy(false);
    onDone();
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {order.farmerComplaint && (
        <label className="flex items-center gap-2 text-xs text-gray-600">
          Damage deduction (GH₵):
          <input
            type="number"
            min={0}
            max={full}
            step="0.01"
            value={deduction}
            onChange={(e) => setDeduction(e.target.value)}
            placeholder="0.00"
            className="w-24 p-2 border-2 border-gray-200 rounded-lg outline-none focus:border-[#43a047]"
          />
        </label>
      )}
      {needsOtp && (
        <input
          type="text"
          inputMode="numeric"
          maxLength={8}
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          placeholder="Email code"
          className="w-28 p-2 border-2 border-amber-300 rounded-lg outline-none focus:border-[#43a047] text-center font-mono"
        />
      )}
      <button
        onClick={send}
        disabled={busy}
        className="bg-[#e65100] text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-[#bf5000] disabled:opacity-50"
      >
        {busy ? "Sending..." : `↩ Send ${ded > 0 ? "Adjusted" : "FULL"} Refund — GH₵${payout.toFixed(2)}`}
      </button>
      {error && <span className="text-xs text-amber-600 font-semibold">{error}</span>}
    </div>
  );
}