"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const [stats, setStats] = useState({ farmers: 0, buyers: 0, listings: 0 });
  const [hero, setHero] = useState("");

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => { });
    // Admin-uploaded homepage hero image (kind=hero in SiteSetting "heroImage")
    fetch("/api/settings?key=heroImage")
      .then((r) => r.json())
      .then((d) => setHero(d.value || ""))
      .catch(() => { });
  }, []);

  return (
    <div className="min-h-screen bg-[#f8faf7]">
      {/* Header */}
      <header className="bg-[#1b5e20] text-white px-6 py-3.5 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="text-xl font-bold flex items-center gap-2">
          <img src="/logo.jpg" alt="FarmLink" className="w-9 h-9 rounded-full ring-2 ring-white/30" />
          FarmLink <span className="opacity-70 text-sm font-normal">Ghana</span>
        </div>
        <div className="flex gap-2.5 items-center">
          <Link
            href="/login"
            className="px-5 py-2 rounded-full text-sm font-medium border border-white/40 text-white hover:bg-white hover:text-[#1b5e20] transition-colors"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="px-5 py-2 rounded-full text-sm font-semibold bg-[#e65100] text-white shadow-sm hover:bg-[#ff6f00] hover:shadow-md transition-all"
          >
            Sign Up
          </Link>
        </div>
      </header>

      {/* Hero — admin's landscape image covers this section behind the text */}
      <section className="relative text-white py-24 px-6 text-center overflow-hidden">
        {/* default gradient when no hero image is uploaded yet */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1b5e20] to-[#0d3818]" />
        {hero && (
          <>
            {/* the admin-uploaded landscape image, covering the whole section */}
            <img
              src={hero}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* dark overlay so the text stays readable on any photo */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#0d3818]/75 via-[#0d3818]/55 to-[#0d3818]/80" />
          </>
        )}
        <div className="relative z-10 max-w-3xl mx-auto">
          <p className="text-[#a5d6a7] text-sm font-semibold tracking-widest uppercase mb-3">Farm Produce Market Link</p>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 drop-shadow-lg leading-tight">
            Connect farmers directly<br className="hidden md:block" /> with buyers
          </h1>
          <p className="text-lg opacity-95 mb-1">No middlemen.</p>
          <p className="text-sm opacity-80 mb-8">Real prices. Real produce. Real connections.</p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/register?role=farmer"
              className="group px-7 py-3.5 rounded-full font-semibold bg-[#e65100] text-white shadow-lg hover:bg-[#ff6f00] hover:shadow-xl hover:-translate-y-0.5 transition-all"
            >
              <span className="mr-2">👨‍🌾</span> Register as Farmer
              <span className="inline-block ml-1 group-hover:translate-x-0.5 transition-transform">→</span>
            </Link>
            <Link
              href="/register?role=buyer"
              className="group px-7 py-3.5 rounded-full font-semibold bg-white text-[#1b5e20] shadow-lg hover:bg-gray-100 hover:shadow-xl hover:-translate-y-0.5 transition-all"
            >
              <span className="mr-2">🏪</span> Register as Buyer
              <span className="inline-block ml-1 group-hover:translate-x-0.5 transition-transform">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-4xl mx-auto -mt-10 bg-white rounded-2xl shadow-xl p-6 grid grid-cols-3 gap-4 text-center relative z-10 border border-gray-100">
        <div>
          <div className="text-3xl font-extrabold text-[#1b5e20]">{stats.farmers}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Farmers</div>
        </div>
        <div className="border-x border-gray-100">
          <div className="text-3xl font-extrabold text-[#e65100]">{stats.buyers}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Buyers</div>
        </div>
        <div>
          <div className="text-3xl font-extrabold text-[#43a047]">{stats.listings}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Listings</div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto py-16 px-6">
        <h2 className="text-2xl font-bold text-[#1b5e20] mb-2 text-center">How It Works</h2>
        <p className="text-center text-gray-500 text-sm mb-10">Three steps from farm to market</p>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all">
            <div className="w-12 h-12 rounded-xl bg-[#e8f5e9] flex items-center justify-center text-2xl mb-4">👨‍🌾</div>
            <h3 className="font-bold mb-2 text-gray-800">1. Farmers List Produce</h3>
            <p className="text-sm text-gray-600 leading-relaxed">Post your crops, quantity, and price. Buyers find you directly.</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all">
            <div className="w-12 h-12 rounded-xl bg-[#fff3e0] flex items-center justify-center text-2xl mb-4">🔍</div>
            <h3 className="font-bold mb-2 text-gray-800">2. Buyers Search</h3>
            <p className="text-sm text-gray-600 leading-relaxed">Browse available produce by crop, region, or price. No middlemen.</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all">
            <div className="w-12 h-12 rounded-xl bg-[#e8f5e9] flex items-center justify-center text-2xl mb-4">💬</div>
            <h3 className="font-bold mb-2 text-gray-800">3. Connect Directly</h3>
            <p className="text-sm text-gray-600 leading-relaxed">WhatsApp or call the farmer directly. Negotiate and deal.</p>
          </div>
        </div>
      </section>

      {/* Price Board Link */}
      <section className="bg-[#e8f5e9] py-16 px-6 text-center">
        <h2 className="text-2xl font-bold text-[#1b5e20] mb-3">Check Today&apos;s Market Prices</h2>
        <p className="text-gray-600 mb-7">See what crops are selling for across Ghana markets</p>
        <Link
          href="/prices"
          className="inline-block px-8 py-3.5 rounded-full font-semibold bg-[#e65100] text-white shadow-md hover:bg-[#ff6f00] hover:shadow-lg hover:-translate-y-0.5 transition-all"
        >
          View Price Board →
        </Link>
      </section>

      <footer className="bg-[#0d3818] text-white text-center py-8 text-sm opacity-80">
        FarmLink Ghana &copy; 2026 — Connecting farmers with buyers
        <div className="text-xs opacity-60 mt-2">Support: 0595726252 · info.rametechconsultancy@gmail.com</div>
        <div className="text-xs opacity-60 mt-1">framlinkgh.vercel.app</div>
      </footer>
    </div>
  );
}