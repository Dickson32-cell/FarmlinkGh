"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const [stats, setStats] = useState({ farmers: 0, buyers: 0, listings: 0 });

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => { });
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <header className="bg-[#1b5e20] text-white px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="text-xl font-bold"><img src="/logo.jpg" alt="Logo" className="w-8 h-8 inline-block mr-2 rounded-full" /> FarmLink <span className="opacity-70 text-sm">Ghana</span></div>
        <div className="flex gap-3">
          <Link href="/login" className="bg-white/15 px-4 py-2 rounded-lg text-sm hover:bg-white/25">Login</Link>
          <Link href="/register" className="bg-[#e65100] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#ff6f00]">Sign Up</Link>
        </div>
      </header>

      <section className="bg-gradient-to-b from-[#1b5e20] to-[#0d3818] text-white py-20 px-6 text-center">
        <h1 className="text-4xl font-bold mb-4">Farm Produce Market Link</h1>
        <p className="text-lg opacity-90 mb-2">Connect farmers directly with buyers. No middlemen.</p>
        <p className="text-sm opacity-70 mb-8">Real prices. Real produce. Real connections.</p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/register?role=farmer" className="bg-[#e65100] px-6 py-3 rounded-lg font-semibold hover:bg-[#ff6f00]">👨‍🌾 Register as Farmer</Link>
          <Link href="/register?role=buyer" className="bg-white text-[#1b5e20] px-6 py-3 rounded-lg font-semibold hover:bg-gray-100">🏪 Register as Buyer</Link>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-4xl mx-auto -mt-10 bg-white rounded-xl shadow-lg p-6 grid grid-cols-3 gap-4 text-center relative z-10">
        <div><div className="text-3xl font-bold text-[#1b5e20]">{stats.farmers}</div><div className="text-xs text-gray-500 uppercase">Farmers</div></div>
        <div><div className="text-3xl font-bold text-[#e65100]">{stats.buyers}</div><div className="text-xs text-gray-500 uppercase">Buyers</div></div>
        <div><div className="text-3xl font-bold text-[#43a047]">{stats.listings}</div><div className="text-xs text-gray-500 uppercase">Listings</div></div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto py-16 px-6">
        <h2 className="text-2xl font-bold text-[#1b5e20] mb-8 text-center">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 shadow border border-gray-200">
            <div className="text-3xl mb-3">👨‍🌾</div>
            <h3 className="font-semibold mb-2">Farmers List Produce</h3>
            <p className="text-sm text-gray-600">Post your crops, quantity, and price. Buyers find you directly.</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow border border-gray-200">
            <div className="text-3xl mb-3">🔍</div>
            <h3 className="font-semibold mb-2">Buyers Search</h3>
            <p className="text-sm text-gray-600">Browse available produce by crop, region, or price. No middlemen.</p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow border border-gray-200">
            <div className="text-3xl mb-3">💬</div>
            <h3 className="font-semibold mb-2">Connect Directly</h3>
            <p className="text-sm text-gray-600">WhatsApp or call the farmer directly. Negotiate and deal.</p>
          </div>
        </div>
      </section>

      {/* Price Board Link */}
      <section className="bg-[#e8f5e9] py-16 px-6 text-center">
        <h2 className="text-2xl font-bold text-[#1b5e20] mb-4">Check Today's Market Prices</h2>
        <p className="text-gray-600 mb-6">See what crops are selling for across Ghana markets</p>
        <Link href="/prices" className="inline-block bg-[#e65100] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#ff6f00]">View Price Board</Link>
      </section>

      <footer className="bg-[#0d3818] text-white text-center py-6 text-sm opacity-70">
        FarmLink Ghana &copy; 2026 — Connecting farmers with buyers
      </footer>
    </div>
  );
}
