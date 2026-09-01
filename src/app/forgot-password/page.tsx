"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Stage = "phone" | "reset" | "done";

export default function ForgotPassword() {
  const [stage, setStage] = useState<Stage>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const router = useRouter();

  // Stage 1: request reset code
  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone.trim() }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.success) {
      setStage("reset");
      setDevCode(data.devCode || null);
    } else {
      setError(data.error || "Could not send reset code");
    }
  };

  // Stage 2: verify OTP + set new password in one call
  const doReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone.trim(), code: code.trim(), newPassword }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setStage("done");
    } else {
      setError(data.error || "Reset failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1b5e20] to-[#0d3818] p-4">
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-[#1b5e20] text-center mb-1">
          <img src="/logo.jpg" alt="Logo" className="w-8 h-8 inline-block mr-2 rounded-full" /> Reset Password
        </h1>

        {stage === "phone" && (
          <>
            <p className="text-sm text-gray-500 text-center mb-6">
              Enter the phone number on your account. We'll text you a reset code.
            </p>
            {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}
            <form onSubmit={requestCode} className="space-y-4">
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="0244..." required
                className="w-full p-3 border-2 border-gray-200 rounded-lg mt-1 focus:border-[#43a047] outline-none" />
              <button type="submit" disabled={loading}
                className="w-full bg-[#1b5e20] text-white py-3 rounded-lg font-bold hover:bg-[#0d3818] disabled:opacity-60">
                {loading ? "Sending code..." : "Send Reset Code"}
              </button>
            </form>
            <p className="text-sm text-center mt-5 text-gray-500">
              Remembered it? <Link href="/login" className="text-[#1b5e20] font-semibold">Back to login</Link>
            </p>
          </>
        )}

        {stage === "reset" && (
          <>
            <p className="text-sm text-center text-gray-600 mb-1">Enter the code sent to</p>
            <p className="text-lg font-bold text-center text-[#1b5e20] mb-5">{phone}</p>
            {devCode && (
              <div className="bg-blue-50 text-blue-700 text-xs p-3 rounded-lg mb-4 text-center">
                Dev mode — code: <strong className="text-base tracking-widest">{devCode}</strong>
              </div>
            )}
            {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}
            <form onSubmit={doReset} className="space-y-4">
              <input type="text" inputMode="numeric" maxLength={6} value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="••••••" required
                className="w-full p-4 border-2 border-gray-200 rounded-lg text-center text-3xl tracking-[0.5em] font-bold outline-none focus:border-[#43a047]" />
              <input type="password" value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 8 characters)" required
                className="w-full p-3 border-2 border-gray-200 rounded-lg mt-1 focus:border-[#43a047] outline-none" />
              <button type="submit" disabled={loading || code.length < 6 || newPassword.length < 8}
                className="w-full bg-[#1b5e20] text-white py-3 rounded-lg font-bold hover:bg-[#0d3818] disabled:opacity-60">
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </form>
            <p className="text-sm text-center mt-5 text-gray-500">
              <Link href="/login" className="text-[#1b5e20] font-semibold">Back to login</Link>
            </p>
          </>
        )}

        {stage === "done" && (
          <>
            <div className="text-center mb-6">
              <p className="font-bold text-[#1b5e20] text-lg">Password changed!</p>
              <p className="text-sm text-gray-500 mt-1">You can now log in with your new password.</p>
            </div>
            <button onClick={() => router.push("/login")}
              className="w-full bg-[#1b5e20] text-white py-3 rounded-lg font-bold hover:bg-[#0d3818]">
              Go to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
