"use client";
import { useEffect, useState } from "react";

interface Price { id: string; crop: string; market: string; region: string; lowPrice: number; highPrice: number; trend: string; date: string; }

import HeaderBanner from "@/components/headerBanner";

export default function Prices() {
  const [prices, setPrices] = useState<Price[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/prices").then((r) => r.json()).then(setPrices).catch(() => { });
  }, []);

  const filtered = prices.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.crop.toLowerCase().includes(q) || p.market.toLowerCase().includes(q) || p.region.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen">
      <header className="bg-[#1b5e20] text-white px-6 py-3 flex items-center justify-between sticky top-0 z-50">
          <HeaderBanner />
        <div className="text-lg font-bold"><img src="/logo.jpg" alt="Logo" className="w-8 h-8 inline-block mr-2 rounded-full" /> FarmLink <span className="opacity-70 text-sm">Price Board</span></div>
        <div className="flex gap-2">
          <a href="/dashboard" className="bg-white/15 px-3 py-1.5 rounded-lg text-sm hover:bg-white/25">Dashboard</a>
          <a href="/market" className="px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm transition-colors bg-[#ef6c00] hover:bg-[#e65100] text-white">Market</a>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-[#1b5e20] mb-2">Today's Market Prices</h1>
        <p className="text-gray-500 text-sm mb-6">Daily average prices across Ghana markets</p>

        <input type="text" placeholder="Search crop, market, region..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full p-2.5 border-2 border-gray-200 rounded-lg outline-none focus:border-[#43a047] mb-4" />

        <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left text-xs uppercase text-gray-500">Crop</th>
                <th className="p-3 text-left text-xs uppercase text-gray-500">Market</th>
                <th className="p-3 text-left text-xs uppercase text-gray-500">Region</th>
                <th className="p-3 text-left text-xs uppercase text-gray-500">Low (GH₵)</th>
                <th className="p-3 text-left text-xs uppercase text-gray-500">High (GH₵)</th>
                <th className="p-3 text-left text-xs uppercase text-gray-500">Average</th>
                <th className="p-3 text-left text-xs uppercase text-gray-500">Trend</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const avg = Math.round((p.lowPrice + p.highPrice) / 2);
                return (
                  <tr key={p.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-semibold">{p.crop}</td>
                    <td className="p-3">{p.market}</td>
                    <td className="p-3">{p.region}</td>
                    <td className="p-3">GH₵{p.lowPrice.toLocaleString()}</td>
                    <td className="p-3">GH₵{p.highPrice.toLocaleString()}</td>
                    <td className="p-3 font-bold">GH₵{avg.toLocaleString()}</td>
                    <td className="p-3">{p.trend === "up" ? " Rising" : p.trend === "down" ? " Falling" : " Stable"}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-gray-400">No prices found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
