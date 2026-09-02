"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Review {
  id: string;
  rating: number;
  comment: string;
  buyerName: string;
  createdAt: string;
}
interface Listing {
  id: string;
  crop: string;
  quantity: number;
  price: number;
  status: string;
  region: string;
  location: string;
  harvestDate: string;
}
interface Farmer {
  id: string;
  name: string;
  phone: string;
  region: string;
  town: string;
  farmSize: number;
  mainCrops: string;
  avgRating: number;
  reviewCount: number;
}

export default function FarmerProfile() {
  const { id } = useParams();
  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/farmers/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setFarmer(data.farmer || null);
        setListings(data.listings || []);
        setReviews(data.reviews || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;
  if (!farmer)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500 mb-2">Farmer not found</div>
          <Link href="/market" className="text-[#1b5e20] font-semibold">Back to Market</Link>
        </div>
      </div>
    );

  const fullStars = Math.round(farmer.avgRating);

  return (
    <div className="min-h-screen bg-[#f8faf7]">
      <header className="bg-[#1b5e20] text-white px-6 py-3.5 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="text-xl font-bold flex items-center gap-2">
          <img src="/logo.jpg" alt="FarmLink" className="w-9 h-9 rounded-full ring-2 ring-white/30" />
          FarmLink <span className="opacity-70 text-sm font-normal">Ghana</span>
        </div>
        <Link href="/market" className="px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors bg-[#ef6c00] hover:bg-[#e65100] text-white">Market</Link>
      </header>

      <div className="max-w-4xl mx-auto p-6">
        {/* Farmer header card */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 mb-6">
          <div className="flex items-start gap-5 flex-wrap">
            <div className="w-20 h-20 rounded-full bg-[#e8f5e9] flex items-center justify-center text-3xl font-bold text-[#1b5e20] shrink-0">
              {farmer.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-[220px]">
              <h1 className="text-2xl font-bold text-gray-800">{farmer.name}</h1>
              <div className="text-sm text-gray-500 mb-2">
                {farmer.town}, {farmer.region} Region
                {farmer.farmSize > 0 && <span> · {farmer.farmSize} acres</span>}
              </div>
              {/* Rating summary — the trust signal */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-2xl tracking-wide text-[#e65100]">
                    {"★".repeat(fullStars)}{"☆".repeat(5 - fullStars)}
                  </span>
                  <span className="text-xl font-bold text-gray-800">{farmer.avgRating.toFixed(1)}</span>
                </div>
                <span className="text-xs text-gray-400">
                  {farmer.reviewCount} review{farmer.reviewCount === 1 ? "" : "s"} from verified buyers
                </span>
                {farmer.reviewCount === 0 && (
                  <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">New farmer — no reviews yet</span>
                )}
              </div>
              {farmer.mainCrops && (
                <div className="text-xs text-gray-400 mt-2">Main crops: {farmer.mainCrops}</div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <a href={`https://wa.me/233${farmer.phone.replace(/^0/, "")}`} target="_blank" className="bg-green-600 text-white text-center px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-green-700">WhatsApp</a>
              <a href={`tel:${farmer.phone}`} className="bg-[#1b5e20] text-white text-center px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-[#0d3818]">Call {farmer.phone}</a>
            </div>
          </div>
        </div>

        {/* Available produce */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 mb-6">
          <h2 className="text-lg font-bold text-[#1b5e20] mb-4">Available Produce ({listings.length})</h2>
          {listings.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-6">No produce currently listed</div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {listings.map((l) => (
                <Link key={l.id} href={`/market/${l.id}`} className="flex items-center justify-between border-2 border-gray-100 rounded-xl p-4 hover:border-[#43a047] transition-colors">
                  <div>
                    <div className="font-bold">{l.crop}</div>
                    <div className="text-xs text-gray-500">{l.quantity} bags · harvested {l.harvestDate}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-[#1b5e20]">GH₵{l.price.toLocaleString()}</div>
                    <div className="text-xs text-gray-400">per bag</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Reviews */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-[#1b5e20] mb-4">Buyer Reviews ({reviews.length})</h2>
          {reviews.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-6">No reviews yet. Buyers who complete an order with this farmer can rate them here.</div>
          ) : (
            <div className="space-y-4">
              {reviews.map((r) => (
                <div key={r.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-semibold text-sm">{r.buyerName}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                  </div>
                  <div className="text-[#e65100] mb-1">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>
                  {r.comment && <div className="text-sm text-gray-600">{r.comment}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-center mt-6">
          <Link href="/market" className="text-[#1b5e20] font-semibold text-sm hover:underline">Back to Market</Link>
        </div>
      </div>
    </div>
  );
}