"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ghanaRegions, ghanaTowns, ghanaCrops } from "@/lib/ghana-data";
import { PriceInput, ProductInput } from "@/components/produceInputs";

interface Listing { id: string; crop: string; quantity: number; price: number; grade: string; region: string; location: string; status: string; postedDate: string; harvestDate: string; notes?: string; farmer?: { id?: string; name: string; phone: string; }; }

import SiteHeader from "@/components/siteHeader";
import NotificationBell from "@/components/notificationBell";

export default function Market() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [search, setSearch] = useState("");
  const [crop, setCrop] = useState("");
  const [region, setRegion] = useState("");
  const [status, setStatus] = useState("available");
  const [showForm, setShowForm] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [form, setForm] = useState({ crop: "", quantity: "", price: "", region: "", location: "", harvestDate: "", notes: "", images: [] as string[] });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [farmerProducts, setFarmerProducts] = useState<string[]>([]);
  const [ratings, setRatings] = useState<Record<string, { avg: number; count: number }>>({});
  // Buyer wishlist — which of the visible listings are saved
  const [wishlisted, setWishlisted] = useState<Record<string, boolean>>({});

  const toggleWishlist = async (listingId: string) => {
    if (wishlisted[listingId]) {
      await fetch("/api/wishlist", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId }) });
      setWishlisted((p) => ({ ...p, [listingId]: false }));
    } else {
      const res = await fetch("/api/wishlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId }) });
      if (res.ok) setWishlisted((p) => ({ ...p, [listingId]: true }));
      else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Could not save");
      }
    }
  };
  const regions = ghanaRegions;

  useEffect(() => {
    fetch("/api/products").then((r) => r.json()).then((names) => { if (Array.isArray(names)) setFarmerProducts(names); }).catch(() => { });
  }, []);
  const crops = Array.from(new Set([...ghanaCrops, ...farmerProducts])).sort((a, b) => a.localeCompare(b));

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      const u = d.user || null;
      setUser(u);
      // Buyers: preload which listings are already wishlisted
      if (u?.role === "buyer") {
        fetch("/api/wishlist")
          .then((r) => r.json())
          .then((items: any[]) => {
            const map: Record<string, boolean> = {};
            (items || []).forEach((i) => { map[i.listingId] = true; });
            setWishlisted(map);
          })
          .catch(() => {});
      }
    });
    loadListings();
  }, []);

  const loadListings = async () => {
    const params = new URLSearchParams();
    if (crop) params.set("crop", crop);
    if (region) params.set("region", region);
    if (status) params.set("status", status);
    const r = await fetch(`/api/listings?${params}`);
    const data = await r.json();
    setListings(data);
    // fetch star ratings for the farmers behind these listings
    const ids = Array.from(new Set((data as any[]).map((l: any) => l.farmer?.id).filter(Boolean))) as string[];
    if (ids.length > 0) {
      fetch(`/api/ratings?farmerIds=${ids.join(",")}`)
        .then((r) => r.json())
        .then((r: Record<string, { avg: number; count: number }>) => setRatings(r))
        .catch(() => { });
    }
  };

  useEffect(() => { loadListings(); }, [crop, region, status]);

  const filtered = listings.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return l.crop.toLowerCase().includes(q) || l.farmer?.name.toLowerCase().includes(q) || l.location.toLowerCase().includes(q) || l.region.toLowerCase().includes(q);
  });

  const reserve = async (id: string) => {
    if (!confirm("Reserve this listing?")) return;
    await fetch("/api/listings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "reserved" }) });
    loadListings();
  };

  const submitListing = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok || data.error) {
      setSubmitError(data.error || "Failed to post listing. Please try again.");
      return;
    }
    setShowForm(false);
    setSubmitError(null);
    setForm({ crop: "", quantity: "", price: "", region: "", location: "", harvestDate: "", notes: "", images: [] });
    loadListings();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    const newImages: string[] = [];
    for (const file of Array.from(files)) {
      if (form.images.length + newImages.length >= 5) break;
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) newImages.push(data.url);
    }
    setForm({ ...form, images: [...form.images, ...newImages] });
    setUploading(false);
  };

  const removeImage = (idx: number) => {
    setForm({ ...form, images: form.images.filter((_, i) => i !== idx) });
  };

  return (
    <div className="min-h-screen">
      <SiteHeader title="Market" user={user} />

      <div className="max-w-6xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-[#1b5e20]">{user?.role === "farmer" ? "My Listings" : "Browse Produce"}</h1>
          {user?.role === "farmer" && <button onClick={() => setShowForm(!showForm)} className="bg-[#1b5e20] text-white px-4 py-2 rounded-lg font-semibold text-sm">+ List Produce</button>}
        </div>

        {user?.role === "farmer" && (
          <div className="bg-[#e8f5e9] border border-[#43a047] text-[#1b5e20] text-sm rounded-lg p-3 mb-6">
            You are viewing your own listings only. Buyers can see all listings from all farmers. Check the <a href="/prices" className="font-semibold underline">Price Board</a> for general market prices.
          </div>
        )}

        {/* List Produce Form */}
        {showForm && (
          <form onSubmit={submitListing} className="bg-white rounded-xl shadow border border-gray-200 p-6 mb-6 grid md:grid-cols-2 gap-4">
            {submitError && (
              <div className="md:col-span-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm">
                 {submitError}
                {submitError.includes("profile") && (
                  <span> — <a href="/profile" className="underline font-semibold">Complete your profile</a></span>
                )}
              </div>
            )}
            <div>
              <label className="text-xs font-semibold uppercase text-gray-500">Product</label>
              <ProductInput id="market" value={form.crop} onChange={(v) => setForm({ ...form, crop: v })} builtinCrops={ghanaCrops} required />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-gray-500">Quantity (bags)</label>
              <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="w-full p-2.5 border-2 border-gray-200 rounded-lg mt-1 outline-none focus:border-[#43a047]" required />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-gray-500">Price per bag</label>
              <PriceInput value={form.price} onChange={(v) => setForm({ ...form, price: v })} required />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-gray-500">Region</label>
              <select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="w-full p-2.5 border-2 border-gray-200 rounded-lg mt-1 outline-none">
                <option value="">Auto (from profile)</option>
                {regions.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-gray-500">Location (town)</label>
              <input type="text" list="town-list" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Select or type your town" className="w-full p-2.5 border-2 border-gray-200 rounded-lg mt-1 outline-none focus:border-[#43a047]" />
              <datalist id="town-list">
                {(ghanaTowns[form.region] || []).map((t) => <option key={t} value={t} />)}
              </datalist>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-gray-500">Harvest Date</label>
              <input type="date" value={form.harvestDate} onChange={(e) => setForm({ ...form, harvestDate: e.target.value })} className="w-full p-2.5 border-2 border-gray-200 rounded-lg mt-1 outline-none" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold uppercase text-gray-500">Notes (optional)</label>
              <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. Freshly harvested, ready for pickup" className="w-full p-2.5 border-2 border-gray-200 rounded-lg mt-1 outline-none focus:border-[#43a047]" />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold uppercase text-gray-500">Product Photos (up to 5)</label>
              <div className="mt-1">
                {form.images.length > 0 && (
                  <div className="flex gap-2 flex-wrap mb-3">
                    {form.images.map((img, i) => (
                      <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border-2 border-gray-200">
                        <img src={img} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => removeImage(i)} className="absolute top-0 right-0 bg-red-600 text-white w-6 h-6 rounded-bl-lg text-xs">✕</button>
                      </div>
                    ))}
                  </div>
                )}
                {form.images.length < 5 && (
                  <label className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-[#43a047] block">
                    <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleImageUpload} className="hidden" />
                    {uploading ? <span className="text-gray-500 text-sm">Uploading...</span> : <span className="text-gray-500 text-sm"> Click to upload photos ({form.images.length}/5)</span>}
                  </label>
                )}
              </div>
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" disabled={submitting} className="bg-[#1b5e20] text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-[#0d3818] disabled:opacity-50">{submitting ? "Posting..." : "Post Listing"}</button>
              <button type="button" onClick={() => setShowForm(false)} className="border-2 border-gray-200 px-6 py-2.5 rounded-lg font-semibold text-gray-600">Cancel</button>
            </div>
          </form>
        )}

        {/* Filters */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="p-2 border-2 border-gray-200 rounded-lg outline-none focus:border-[#43a047] w-64" />
          <select value={crop} onChange={(e) => setCrop(e.target.value)} className="p-2 border-2 border-gray-200 rounded-lg outline-none"><option value="">All Crops</option>{crops.map((c) => <option key={c}>{c}</option>)}</select>
          <select value={region} onChange={(e) => setRegion(e.target.value)} className="p-2 border-2 border-gray-200 rounded-lg outline-none"><option value="">All Regions</option>{regions.map((r) => <option key={r}>{r}</option>)}</select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="p-2 border-2 border-gray-200 rounded-lg outline-none"><option value="">All Status</option><option value="available">Available</option><option value="reserved">Reserved</option><option value="sold">Sold Out</option></select>
        </div>

        {/* Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((l) => {
            const imgs: string[] = (() => { try { return JSON.parse((l as any).images || "[]"); } catch { return []; } })();
            return (
              <div key={l.id} className="bg-white rounded-xl p-4 shadow border border-gray-200">
                {imgs.length > 0 && (
                  <div className="mb-3 rounded-lg overflow-hidden">
                    <img src={imgs[0]} alt={l.crop} className="w-full h-40 object-cover" />
                  </div>
                )}
                <div className="flex justify-between items-start mb-2">
                  <div className="font-bold text-lg">{l.crop}</div>
                  <div className="flex items-center gap-1.5">
                    {/* Wishlist heart — buyers only */}
                    {user?.role === "buyer" && (
                      <button
                        onClick={() => toggleWishlist(l.id)}
                        title={wishlisted[l.id] ? "Remove from wishlist" : "Save to wishlist"}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${wishlisted[l.id] ? "bg-red-50 text-red-500" : "bg-gray-50 text-gray-300 hover:text-red-400"}`}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill={wishlisted[l.id] ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                      </button>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${l.status === "available" ? "bg-green-50 text-green-600" : l.status === "reserved" ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"}`}>{l.status}</span>
                  </div>
                </div>
                <div className="text-sm text-gray-500 mb-2">{user?.role === "farmer" ? `${l.location}, ${l.region}` : `${l.farmer?.name || "Unknown"} · ${l.location}, ${l.region}`}</div>
                {/* Farmer trust rating — stars from verified-buyer reviews */}
                {(() => {
                  const fid = l.farmer?.id;
                  const r = fid ? ratings[fid] : undefined;
                  if (l.farmer && fid && r && r.count > 0) {
                    return (
                      <Link href={`/farmer/${fid}`} className="inline-flex items-center gap-1.5 mb-2 group">
                        <span className="text-[#e65100]">
                          {"★".repeat(Math.round(r.avg))}{"☆".repeat(5 - Math.round(r.avg))}
                        </span>
                        <span className="text-xs font-semibold text-gray-700 group-hover:text-[#1b5e20]">
                          {r.avg.toFixed(1)} ({r.count})
                        </span>
                        <span className="text-xs text-[#1b5e20] font-semibold opacity-0 group-hover:opacity-100">View profile</span>
                      </Link>
                    );
                  }
                  if (l.farmer && fid && user?.role !== "farmer") {
                    return (
                      <Link href={`/farmer/${fid}`} className="inline-block text-xs text-gray-400 hover:text-[#1b5e20] mb-2">Farmer profile</Link>
                    );
                  }
                  return null;
                })()}
                <div className="text-xl font-bold text-[#1b5e20] mb-2">GH₵{l.price.toLocaleString()} <span className="text-xs text-gray-400">/ bag</span></div>
                <div className="flex gap-3 text-xs text-gray-500 flex-wrap mb-2">
                  <span>{l.quantity} bags</span><span> · {l.harvestDate}</span>
                </div>
                {l.notes && <div className="text-xs text-gray-400 mb-2"> {l.notes}</div>}
                <Link href={`/market/${l.id}`} className="block text-center bg-[#1b5e20] text-white py-2 rounded-lg font-semibold text-sm hover:bg-[#0d3818] mt-2">View Details</Link>
                {l.status === "available" && l.farmer && user?.role !== "farmer" && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
                <div className="text-xs font-semibold text-amber-700 mb-0.5">Order & pay — the farmer is then SMSed your delivery details and calls you</div>
                <div className="text-xs text-gray-500">FarmLink relays your order and GPS location to the farmer the moment you pay. Support: 0595726252.</div>
              </div>
            )}
              </div>
            );
          })}
          {filtered.length === 0 && <div className="col-span-full text-center text-gray-400 py-8">No produce found</div>}
        </div>
      </div>
    </div>
  );
}
