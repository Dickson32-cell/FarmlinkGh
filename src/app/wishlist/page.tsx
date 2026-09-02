"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import HeaderBanner from "@/components/headerBanner";

interface WishItem {
  id: string;
  listingId: string;
  crop: string;
  savedAt: string;
  listing: {
    id: string;
    crop: string;
    quantity: number;
    price: number;
    unit: string;
    location: string;
    region: string;
    status: string;
    images: string;
    farmerName: string;
    farmerPhone: string;
    farmerId: string;
  } | null;
}

export default function Wishlist() {
  const [items, setItems] = useState<WishItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      if (!d.user) { router.push("/login"); return; }
      if (d.user.role !== "buyer") { router.push(d.user.role === "farmer" ? "/dashboard" : "/admin"); return; }
      fetch("/api/wishlist").then((r) => r.json()).then(setItems).finally(() => setLoading(false));
    });
  }, [router]);

  const removeItem = async (listingId: string) => {
    await fetch("/api/wishlist", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId }) });
    setItems((prev) => prev.filter((i) => i.listingId !== listingId));
  };

  return (
    <div className="min-h-screen bg-[#f8faf7]">
      <header className="bg-[#1b5e20] text-white px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <HeaderBanner />
        <div className="text-lg font-bold"><img src="/logo.jpg" alt="Logo" className="w-8 h-8 inline-block mr-2 rounded-full" /> FarmLink</div>
        <div className="flex gap-2">
          <Link href="/market" className="px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm transition-colors bg-[#ef6c00] hover:bg-[#e65100] text-white">Market</Link>
          <Link href="/prices" className="px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm transition-colors bg-[#1565c0] hover:bg-[#0d47a1] text-white">Prices</Link>
          <Link href="/orders" className="px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm transition-colors bg-[#f9a825] hover:bg-[#f57f17] text-[#3e2723]">My Orders</Link>
          <Link href="/dashboard" className="bg-white/15 px-3 py-1.5 rounded-lg text-sm hover:bg-white/25">Dashboard</Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-[#1b5e20] mb-1">My Wishlist</h1>
        <p className="text-sm text-gray-500 mb-6">Produce you saved for later. We alert you when saved crops get newly listed or cheaper.</p>

        {loading && <div className="text-center text-gray-400 py-10">Loading...</div>}

        {!loading && items.length === 0 && (
          <div className="bg-white rounded-xl shadow border border-gray-200 p-10 text-center text-gray-400">
            <div className="font-semibold mb-1">Your wishlist is empty</div>
            <div className="text-sm">Tap the heart on any market listing to save it here. <Link href="/market" className="text-[#1b5e20] font-semibold">Browse the market →</Link></div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {items.map((w) => {
            const l = w.listing;
            const imgs: string[] = l ? (() => { try { return JSON.parse(l.images || "[]"); } catch { return []; } })() : [];
            const sold = l ? l.status !== "available" : false;
            const gone = !l;
            return (
              <div key={w.id} className={`bg-white rounded-xl p-4 shadow border ${gone ? "border-gray-200 opacity-75" : sold ? "border-amber-200" : "border-gray-200"}`}>
                <div className="flex gap-3">
                  {l && imgs[0] ? (
                    <Link href={`/market/${l.id}`} className="shrink-0">
                      <img src={imgs[0]} alt={l.crop} className="w-24 h-24 object-cover rounded-lg" />
                    </Link>
                  ) : (
                    <div className="w-24 h-24 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs shrink-0">{gone ? "Removed" : "No photo"}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      {l ? (
                        <Link href={`/market/${l.id}`} className="font-bold text-lg text-[#1b5e20] hover:underline">{l.crop}</Link>
                      ) : (
                        <span className="font-bold text-lg text-gray-500">{w.crop}</span>
                      )}
                      <button
                        onClick={() => removeItem(w.listingId)}
                        title="Remove from wishlist"
                        className="text-red-500 hover:text-red-700 text-sm font-bold shrink-0"
                      >✕ Remove</button>
                    </div>
                    {l && (
                      <>
                        <div className="text-sm text-gray-500">{l.farmerName ? `${l.farmerName} · ` : ""}{l.location}, {l.region}</div>
                        <div className="text-sm">
                          <span className="font-semibold text-[#1b5e20]">GH₵{l.price.toFixed(2)}</span>
                          <span className="text-gray-400"> / {l.unit || "bag"}</span>
                          {l.quantity > 1 && <span className="text-gray-400"> · {l.quantity} available</span>}
                        </div>
                        {sold && (
                          <div className="mt-1 inline-block text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            {l.status === "sold" ? "Sold" : "Not available"}
                          </div>
                        )}
                        {!sold && (
                          <Link
                            href={`/market/${l.id}`}
                            className="inline-block mt-2 bg-[#1b5e20] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#0d3818]"
                          >View & Order →</Link>
                        )}
                      </>
                    )}
                    {gone && <div className="text-xs text-gray-400 mt-1">This listing is no longer on the market.</div>}
                    <div className="text-[11px] text-gray-400 mt-1">Saved {new Date(w.savedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}