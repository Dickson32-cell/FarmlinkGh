"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Login() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 2FA state
  const [stage, setStage] = useState<"credentials" | "otp" | "admin-email">("credentials");
  const [otp, setOtp] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [network, setNetwork] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone.trim(), password }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      if (data.otpRequired && data.adminLogin) {
        // Admin path — email code to the admin email address
        setMaskedEmail(data.email || "di•••••@gmail.com");
        setStage("admin-email");
      } else if (data.otpRequired) {
        // 2FA path — show the SMS OTP screen
        setMaskedPhone(data.phone || phone.replace(/\d(?=\d{3})/g, "*"));
        setNetwork(data.network || "");
        setDevCode(data.devCode || null);
        setStage("otp");
      } else {
        // 2FA disabled — straight in (legacy)
        router.push("/dashboard");
      }
    } else {
      setError(data.error || "Login failed");
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone.trim(), code: otp.trim() }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      router.push("/dashboard");
    } else {
      setError(data.error || "Verification failed");
      setOtp("");
    }
  };

  const verifyAdminCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/admin/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone.trim(), password, code: otp.trim() }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      router.push("/admin");
    } else {
      setError(data.error || "Verification failed");
      setOtp("");
    }
  };

  const resend = async () => {
    setResending(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phone.trim(), password }),
    });
    const data = await res.json();
    setResending(false);
    if (res.ok && data.otpRequired) {
      setDevCode(data.devCode || null);
      setError("");
    } else {
      setError(data.error || "Could not resend code");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1b5e20] to-[#0d3818] p-4">
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-[#1b5e20] text-center mb-1"><img src="/logo.jpg" alt="Logo" className="w-8 h-8 inline-block mr-2 rounded-full" /> FarmLink Ghana</h1>

        {stage === "credentials" && (
          <>
            <p className="text-sm text-gray-500 text-center mb-6">Welcome back</p>
            {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase text-gray-500">Phone Number</label>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0244..." className="w-full p-3 border-2 border-gray-200 rounded-lg mt-1 focus:border-[#43a047] outline-none" required />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-gray-500">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full p-3 border-2 border-gray-200 rounded-lg mt-1 focus:border-[#43a047] outline-none" required />
              </div>
              <div className="text-right">
                <Link href="/forgot-password" className="text-xs text-[#1b5e20] font-semibold hover:underline">Forgot password?</Link>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-[#1b5e20] text-white py-3 rounded-lg font-bold hover:bg-[#0d3818] disabled:opacity-60">
                {loading ? "Checking..." : "Login"}
              </button>
            </form>
            <p className="text-sm text-center mt-5 text-gray-500">New to FarmLink? <Link href="/register" className="text-[#1b5e20] font-semibold">Create account</Link></p>
          </>
        )}

        {stage === "otp" && (
          <>
            <p className="text-sm text-gray-600 text-center mb-1">Enter the 6-digit code we sent to</p>
            <p className="text-lg font-bold text-center text-[#1b5e20] mb-1">{maskedPhone}</p>
            <p className="text-xs text-center text-gray-400 mb-2">
              {network && network !== "Unknown" ? `📱 ${network} network · ` : ""}Code valid for 10 minutes
            </p>
            <p className="text-xs text-center text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              SMS can take up to 5 minutes to arrive. Please wait before resending — requesting again cancels the previous code.
            </p>
            {devCode && (
              <div className="bg-blue-50 text-blue-700 text-xs p-3 rounded-lg mb-4 text-center">
                🔧 Dev mode — your code is <strong className="text-base tracking-widest">{devCode}</strong>
              </div>
            )}
            {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}
            <form onSubmit={verifyOtp} className="space-y-4">
              <input
                type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoComplete="one-time-code"
                value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="••••••"
                className="w-full p-4 border-2 border-gray-200 rounded-lg text-center text-3xl tracking-[0.5em] font-bold outline-none focus:border-[#43a047]"
                required
              />
              <button type="submit" disabled={loading || otp.length < 6} className="w-full bg-[#1b5e20] text-white py-3 rounded-lg font-bold hover:bg-[#0d3818] disabled:opacity-60">
                {loading ? "Verifying..." : "Verify & Login"}
              </button>
            </form>
            <div className="flex justify-between mt-5 text-sm">
              <button onClick={() => { setStage("credentials"); setError(""); setOtp(""); }} className="text-gray-500 hover:text-gray-700">← Change number</button>
              <button onClick={resend} disabled={resending} className="text-[#1b5e20] font-semibold hover:underline disabled:opacity-50">
                {resending ? "Sending..." : "Resend code"}
              </button>
            </div>
          </>
        )}

        {stage === "admin-email" && (
          <>
            <div className="bg-[#e8f5e9] border border-[#43a047] rounded-lg p-4 mb-5 text-center">
              <div className="text-3xl mb-2">🔐</div>
              <p className="text-sm font-bold text-[#1b5e20] mb-1">Admin Verification Required</p>
              <p className="text-xs text-[#2e7d32]">
                A verification code has been sent to
              </p>
              <p className="text-sm font-bold text-[#1b5e20] mt-1">{maskedEmail}</p>
              <p className="text-xs text-gray-400 mt-2">Code valid for 10 minutes · 8 digits</p>
            </div>
            {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}
            <form onSubmit={verifyAdminCode} className="space-y-4">
              <input
                type="text" inputMode="numeric" pattern="[0-9]*" maxLength={8} autoComplete="one-time-code" autoFocus
                value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="••••••••"
                className="w-full p-4 border-2 border-gray-200 rounded-lg text-center text-3xl tracking-[0.4em] font-bold outline-none focus:border-[#43a047]"
                required
              />
              <button type="submit" disabled={loading || otp.length < 8} className="w-full bg-[#1b5e20] text-white py-3 rounded-lg font-bold hover:bg-[#0d3818] disabled:opacity-60">
                {loading ? "Verifying..." : "Verify & Enter Admin"}
              </button>
            </form>
            <div className="flex justify-between mt-5 text-sm">
              <button onClick={() => { setStage("credentials"); setError(""); setOtp(""); }} className="text-gray-500 hover:text-gray-700">← Back to login</button>
              <button onClick={resend} disabled={resending} className="text-[#1b5e20] font-semibold hover:underline disabled:opacity-50">
                {resending ? "Sending..." : "Resend code"}
              </button>
            </div>
            <p className="text-xs text-center text-gray-400 mt-4">
              Admin sessions expire after 12 hours for security.
            </p>
          </>
        )}
      </div>
    </div>
  );
}