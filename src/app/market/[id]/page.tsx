"use client";
import { use, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Listing {
  id: string;
  crop: string;
  quantity: number;
  unit: string;
  price: number;
  region: string;
  location: string;
  harvestDate: string;
  notes: string | null;
  images: string;
  status: string;
  postedDate: string;
  farmer: {
    id: string;
    name: string;
    phone: string;
    region: string;
    town: string;
    farmSize: number;
    mainCrops: string;
  };
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  buyerName: string;
  createdAt: string;
}

function Stars({ rating, size = "text-sm" }: { rating: number; size?: string }) {
  return (
    <span className={size}>{"★".repeat(rating)}{"☆".repeat(5 - rating)}</span>
  );
}

export default function ListingDetail() {
  const { id } = useParams();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [user, setUser] = useState<any>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [buyQty, setBuyQty] = useState(1);
  const [buying, setBuying] = useState(false);
  const [orderCreated, setOrderCreated] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/listings/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setListing(data);
        setLoading(false);
        if (data.farmer?.id) {
          fetch(`/api/reviews?farmerId=${data.farmer.id}`)
            .then((r) => r.json())
            .then(setReviews)
            .catch(() => { });
        }
      })
      .catch(() => setLoading(false));
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setUser(d.user || null));
  }, [id]);

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReview(true);
    await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ farmerId: listing!.farmer.id, rating: reviewRating, comment: reviewComment }),
    });
    setSubmittingReview(false);
    setShowReviewForm(false);
    setReviewComment("");
    fetch(`/api/reviews?farmerId=${listing!.farmer.id}`).then((r) => r.json()).then(setReviews);
  };

  const buyNow = async () => {
    setBuying(true);
    // Create order
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: listing!.id, quantity: buyQty }),
    });
    const order = await res.json();
    if (res.ok) {
      // Initiate payment
      const payRes = await fetch("/api/payment/paystack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });
      const payData = await payRes.json();
      if (payData.mode === "paystack" && payData.authorizationUrl) {
        // Go straight to Paystack checkout (MoMo/card), then return to /orders
        window.location.href = payData.authorizationUrl;
        return;
      }
      setOrderCreated({ order, payData });
    }
    setBuying(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;
  if (!listing) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-500 mb-4">Listing not found</p>
        <Link href="/market" className="text-[#1b5e20] font-semibold">← Back to Market</Link>
      </div>
    </div>
  );

  const images: string[] = (() => { try { return JSON.parse(listing.images); } catch { return []; } })();
  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;

  return (
    <div className="min-h-screen">
      <header className="bg-[#1b5e20] text-white px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="text-lg font-bold"><img src="/logo.jpg" alt="Logo" className="w-8 h-8 inline-block mr-2 rounded-full" /> FarmLink <span className="opacity-70 text-sm">Listing</span></div>
        <div className="flex gap-2">
          <Link href="/market" className="bg-white/15 px-3 py-1.5 rounded-lg text-sm hover:bg-white/25">← Market</Link>
          <Link href="/prices" className="bg-white/15 px-3 py-1.5 rounded-lg text-sm hover:bg-white/25">Prices</Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6">
        <Link href="/market" className="text-[#1b5e20] text-sm font-semibold mb-4 inline-block">← Back to Market</Link>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Images */}
          <div>
            {images.length > 0 ? (
              <>
                <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden mb-3">
                  <img src={images[activeImage]} alt={listing.crop} className="w-full h-80 object-cover" />
                </div>
                {images.length > 1 && (
                  <div className="flex gap-2 flex-wrap">
                    {images.map((img, i) => (
                      <button key={i} onClick={() => setActiveImage(i)} className={`w-20 h-20 rounded-lg overflow-hidden border-2 ${activeImage === i ? "border-[#1b5e20]" : "border-gray-200"}`}>
                        <img src={img} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="bg-gray-100 rounded-xl h-80 flex items-center justify-center text-gray-400 text-sm">
                No photos uploaded
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-[#1b5e20]">{listing.crop}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${listing.status === "available" ? "bg-green-50 text-green-600" : listing.status === "reserved" ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"}`}>{listing.status}</span>
            </div>
            <div className="text-3xl font-bold text-[#e65100] mb-4">GH₵{listing.price.toLocaleString()} <span className="text-sm text-gray-400">/ {listing.unit}</span></div>

            <div className="bg-white rounded-xl shadow border border-gray-200 p-5 mb-4 space-y-3">
              <div className="flex justify-between"><span className="text-gray-500 text-sm">Quantity</span><span className="font-semibold">{listing.quantity} {listing.unit}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 text-sm">Harvest Date</span><span className="font-semibold">{listing.harvestDate}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 text-sm">Posted</span><span className="font-semibold">{listing.postedDate}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 text-sm">Location</span><span className="font-semibold">{listing.location}, {listing.region}</span></div>
            </div>

            {listing.notes && (
              <div className="bg-[#e8f5e9] rounded-lg p-4 mb-4">
                <div className="text-xs text-gray-500 uppercase mb-1">Farmer Notes</div>
                <p className="text-sm text-gray-700">{listing.notes}</p>
              </div>
            )}

            {/* Farmer Contact */}
            <div className="bg-white rounded-xl shadow border-2 border-[#43a047] p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-[#1b5e20]">👨‍🌾 Farmer Details</h2>
                {avgRating && (
                  <div className="text-sm text-[#e65100] font-bold">
                    <Stars rating={Math.round(parseFloat(avgRating))} /> <span className="text-gray-500 font-normal">{avgRating} ({reviews.length})</span>
                  </div>
                )}
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between"><span className="text-gray-500 text-sm">Name</span><span className="font-semibold">{listing.farmer.name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 text-sm">Phone</span><span className="font-semibold">{listing.farmer.phone}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 text-sm">Town</span><span className="font-semibold">{listing.farmer.town}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 text-sm">Region</span><span className="font-semibold">{listing.farmer.region}</span></div>
                <div className="flex justify-between"><span className="text-gray-500 text-sm">Farm Size</span><span className="font-semibold">{listing.farmer.farmSize} acres</span></div>
                <div className="flex justify-between"><span className="text-gray-500 text-sm">Main Crops</span><span className="font-semibold text-right">{listing.farmer.mainCrops}</span></div>
              </div>
              {listing.status === "available" && (
                <div className="flex gap-3">
                  <a href={`https://wa.me/233${listing.farmer.phone.replace(/^0/, "")}`} target="_blank" className="flex-1 bg-green-600 text-white text-center py-3 rounded-lg font-semibold hover:bg-green-700">💬 WhatsApp</a>
                  <a href={`tel:${listing.farmer.phone}`} className="flex-1 bg-[#1b5e20] text-white text-center py-3 rounded-lg font-semibold hover:bg-[#0d3818]">📞 Call</a>
                </div>
              )}
            </div>

            {/* Buy Now Section */}
            {user?.role === "buyer" && listing.status === "available" && (
              <div className="bg-white rounded-xl shadow border-2 border-[#e65100] p-5 mt-4">
                <h2 className="font-bold text-[#e65100] mb-3">🛒 Buy Now</h2>
                {orderCreated ? (
                  <div className="space-y-2 text-sm">
                    <div className="font-semibold text-[#1b5e20]">Order created! Order ID: {orderCreated.order.id.slice(-8).toUpperCase()}</div>
                    {orderCreated.payData.mode === "manual" ? (
                      <div className="bg-[#e8f5e9] rounded-lg p-3">
                        <p>Send <strong>GH₵{orderCreated.payData.amount}</strong> via MoMo to:</p>
                        <p className="text-2xl font-bold text-[#1b5e20]">📞 {orderCreated.payData.adminMomo}</p>
                        <p>Reference: <strong>{orderCreated.payData.reference}</strong></p>
                        <p className="text-gray-600 mt-1">After paying, go to your Orders page. Admin will confirm, then you confirm delivery.</p>
                        <Link href="/orders" className="inline-block mt-2 bg-[#1b5e20] text-white px-4 py-2 rounded-lg font-semibold text-sm">Go to My Orders →</Link>
                      </div>
                    ) : (
                      <div className="bg-[#e8f5e9] rounded-lg p-3">
                        <p>{orderCreated.payData.message}</p>
                        <Link href="/orders" className="inline-block mt-2 bg-[#1b5e20] text-white px-4 py-2 rounded-lg font-semibold text-sm">View Order Status →</Link>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-semibold">Quantity (bags):</label>
                      <input type="number" min={1} max={listing.quantity} value={buyQty} onChange={(e) => setBuyQty(Math.min(Math.max(1, parseInt(e.target.value) || 1), listing.quantity))} className="w-24 p-2 border-2 border-gray-200 rounded-lg outline-none focus:border-[#43a047]" />
                      <span className="text-sm text-gray-500">of {listing.quantity} available</span>
                    </div>
                    <div className="text-sm bg-gray-50 rounded-lg p-3 space-y-1">
                      <div className="flex justify-between"><span>Total:</span><strong>GH₵{(listing.price * buyQty).toLocaleString()}</strong></div>
                      <div className="flex justify-between text-xs text-gray-500"><span>Farmer gets (88.5%):</span><span>GH₵{(listing.price * buyQty * 0.885).toFixed(2)}</span></div>
                      <div className="flex justify-between text-xs text-gray-500"><span>Admin (10%):</span><span>GH₵{(listing.price * buyQty * 0.10).toFixed(2)}</span></div>
                      <div className="flex justify-between text-xs text-gray-500"><span>Hubtel (1.5%):</span><span>GH₵{(listing.price * buyQty * 0.015).toFixed(2)}</span></div>
                    </div>
                    <button onClick={buyNow} disabled={buying} className="w-full bg-[#e65100] text-white py-3 rounded-lg font-bold hover:bg-[#ff6f00] disabled:opacity-50">
                      {buying ? "Creating Order..." : `Buy Now — GH₵${(listing.price * buyQty).toLocaleString()}`}
                    </button>
                    <p className="text-xs text-gray-400 text-center">Payment goes to Admin (escrow). Farmer is paid after you confirm delivery.</p>
                  </div>
                )}
              </div>
            )}

            {!user && listing.status === "available" && (
              <Link href="/login" className="block text-center bg-[#e65100] text-white py-3 rounded-lg font-bold mt-4">Login to Buy</Link>
            )}
          </div>{/* end details column */}
        </div>{/* end grid */}

        {/* Reviews Section */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[#1b5e20]">⭐ Farmer Reviews</h2>
            {user?.role === "buyer" && (
              <button onClick={() => setShowReviewForm(!showReviewForm)} className="bg-[#1b5e20] text-white px-4 py-2 rounded-lg font-semibold text-sm">
                {showReviewForm ? "Cancel" : "+ Leave Review"}
              </button>
            )}
          </div>

          {showReviewForm && (
            <form onSubmit={submitReview} className="bg-white rounded-xl shadow border border-gray-200 p-5 mb-6 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase text-gray-500">Rating</label>
                <div className="flex gap-2 mt-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setReviewRating(n)} className={`text-3xl ${n <= reviewRating ? "text-[#e65100]" : "text-gray-300"}`}>★</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-gray-500">Comment (optional)</label>
                <textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder="Share your experience dealing with this farmer..." className="w-full p-3 border-2 border-gray-200 rounded-lg mt-1 outline-none focus:border-[#43a047]" rows={3} />
              </div>
              <button type="submit" disabled={submittingReview} className="bg-[#1b5e20] text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-[#0d3818] disabled:opacity-50">
                {submittingReview ? "Submitting..." : "Submit Review"}
              </button>
            </form>
          )}

          {reviews.length > 0 ? (
            <div className="space-y-3">
              {reviews.map((r) => (
                <div key={r.id} className="bg-white rounded-xl shadow border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">{r.buyerName}</span>
                    <span className="text-[#e65100] text-sm"><Stars rating={r.rating} /></span>
                  </div>
                  {r.comment && <p className="text-sm text-gray-600">{r.comment}</p>}
                  <div className="text-xs text-gray-400 mt-1">{new Date(r.createdAt).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow border border-gray-200 p-6 text-center text-gray-400">
              No reviews yet. {user?.role === "buyer" ? "Be the first to review this farmer!" : "Reviews appear after buyers deal with this farmer."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}