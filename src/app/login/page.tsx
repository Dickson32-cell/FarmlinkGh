"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Login() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
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
      router.push("/dashboard");
    } else {
      setError(data.error || "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1b5e20] to-[#0d3818] p-4">
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-[#1b5e20] text-center mb-1"><img src="/logo.jpg" alt="Logo" className="w-8 h-8 inline-block mr-2 rounded-full" /> FarmLink Ghana</h1>
        <p className="text-sm text-gray-500 text-center mb-6">Welcome back</p>
        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase text-gray-500">Phone Number</label>
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0244..." className="w-full p-3 border-2 border-gray-200 rounded-lg mt-1 focus:border-[#43a047] outline-none" required />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-gray-500">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 border-2 border-gray-200 rounded-lg mt-1 focus:border-[#43a047] outline-none" required />
          </div>
          <button type="submit" disabled={loading} className="w-full p-3 bg-[#1b5e20] text-white rounded-lg font-semibold hover:bg-[#0d3818] disabled:opacity-50">{loading ? "Signing in..." : "Sign In"}</button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">No account? <Link href="/register" className="text-[#e65100] font-semibold">Sign up</Link></p>
        <Link href="/" className="block text-center text-sm text-gray-400 mt-2">← Back home</Link>
      </div>
    </div>
  );
}
