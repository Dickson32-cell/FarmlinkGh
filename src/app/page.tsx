"use client";
import Link from "next/link";
import SiteHeader from "@/components/siteHeader";
import { useEffect, useState } from "react";

import SiteFooter from "@/components/siteFooter";

function IconLeaf() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-[#1b5e20]">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.83-3.92 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-[#e65100]">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function IconChat() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-[#1b5e20]">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}

export default function Home() {
  const [stats, setStats] = useState({ farmers: 0, buyers: 0, listings: 0 });
  const [hero, setHero] = useState("");

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => { });
    // Admin-uploaded homepage hero image (SiteSetting "heroImage")
    fetch("/api/settings?key=heroImage")
      .then((r) => r.json())
      .then((d) => setHero(d.value || ""))
      .catch(() => { });
    // Auto-refresh: keep counts + hero current without a manual reload
    const statsTimer = setInterval(() => {
      fetch("/api/stats").then((r) => r.json()).then(setStats).catch(() => { });
    }, 30000);
    const heroTimer = setInterval(() => {
      fetch("/api/settings?key=heroImage").then((r) => r.json()).then((d) => setHero(d.value || "")).catch(() => { });
    }, 60000);
    return () => { clearInterval(statsTimer); clearInterval(heroTimer); };
  }, []);

  return (
    <div className="min-h-screen bg-[#f8faf7]">
      {/* Header */}
      <SiteHeader />

      {/* Hero — admin's landscape image covers this section behind the text.
          Desktop uses a taller min-height so wide photos aren't cropped to a sliver. */}
      <section className="relative text-white py-24 md:py-36 lg:py-44 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1b5e20] to-[#0d3818]" />
        {hero && (
          <>
            <img
              src={hero}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
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
              className="px-7 py-3.5 rounded-full font-semibold bg-[#e65100] text-white shadow-lg hover:bg-[#ff6f00] hover:shadow-xl hover:-translate-y-0.5 transition-all"
            >
              Register as Farmer
            </Link>
            <Link
              href="/register?role=buyer"
              className="px-7 py-3.5 rounded-full font-semibold bg-white text-[#1b5e20] shadow-lg hover:bg-gray-100 hover:shadow-xl hover:-translate-y-0.5 transition-all"
            >
              Register as Buyer
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-4xl mx-auto -mt-10 bg-white rounded-2xl shadow-xl p-4 sm:p-6 grid grid-cols-3 gap-3 sm:gap-4 text-center relative z-10 border border-gray-100">
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
            <div className="w-12 h-12 rounded-xl bg-[#e8f5e9] flex items-center justify-center mb-4">
              <IconLeaf />
            </div>
            <h3 className="font-bold mb-2 text-gray-800">1. Farmers List Produce</h3>
            <p className="text-sm text-gray-600 leading-relaxed">Post your crops, quantity, and price. Buyers find you directly.</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all">
            <div className="w-12 h-12 rounded-xl bg-[#fff3e0] flex items-center justify-center mb-4">
              <IconSearch />
            </div>
            <h3 className="font-bold mb-2 text-gray-800">2. Buyers Search</h3>
            <p className="text-sm text-gray-600 leading-relaxed">Browse available produce by crop, region, or price. No middlemen.</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all">
            <div className="w-12 h-12 rounded-xl bg-[#e8f5e9] flex items-center justify-center mb-4">
              <IconChat />
            </div>
 <h3 className="font-bold mb-2 text-gray-800">3. Order & Pay Safe</h3>
             <p className="text-sm text-gray-600 leading-relaxed">Order and pay securely through FarmLink. The farmer gets your delivery details by SMS and calls you to arrange delivery.</p>
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
          View Price Board
        </Link>
      </section>

      <SiteFooter />
    </div>
  );
}