"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ghanaRegions, ghanaTowns } from "@/lib/ghana-data";

const regions = ghanaRegions;

function RegisterForm() {
  const [step, setStep] = useState(1); // 1 = info, 2 = ghana card, 3 = pending
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("farmer");
  const [region, setRegion] = useState("Eastern");
  const [town, setTown] = useState("");
  const [farmSize, setFarmSize] = useState("");
  const [mainCrops, setMainCrops] = useState("");
  const [businessType, setBusinessType] = useState("Market Trader");
  const [location, setLocation] = useState("");
  const [lookingFor, setLookingFor] = useState("");
  const [ghanaCardUrl, setGhanaCardUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const params = useSearchParams();

  useEffect(() => {
    const r = params.get("role");
    if (r === "farmer" || r === "buyer") setRole(r);
  }, [params]);

  const handleCardUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", "ghana-card"); // private — visible only to owner + verified admin
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.url) {
      setGhanaCardUrl(data.url);
    } else {
      setError(data.error || "Upload failed. Please try again.");
    }
    setUploading(false);
    e.target.value = "";
  };

  const submit = async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, password, role, ghanaCardUrl }),
    });
    const data = await res.json();
    if (res.ok) {
      // Update profile info in the background
      if (role === "farmer") {
        await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ region, town, farmSize: parseFloat(farmSize) || 0, mainCrops }),
        }).catch(() => { });
      } else {
        await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessType, location, lookingFor }),
        }).catch(() => { });
      }
      setStep(3); // Show pending confirmation
    } else {
      setError(data.error || "Registration failed");
    }
    setLoading(false);
  };

  // ─── Step 3: Pending Confirmation ───────────────────────────────────────────
  if (step === 3) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1b5e20] to-[#0d3818] p-4">
        <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-[#1b5e20] mb-2">Registration Submitted!</h1>
          <p className="text-gray-600 mb-4">Thank you, <strong>{name}</strong>. Your account has been created and is now under review.</p>
          <div className="bg-[#e8f5e9] border border-[#43a047] rounded-xl p-5 mb-6 text-left">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🕐</span>
              <div>
                <div className="font-bold text-[#1b5e20] mb-1">Verification in Progress</div>
                <p className="text-sm text-[#2e7d32]">
                  Our team will verify your <strong>Ghana Card</strong> and account details.
                  This process takes <strong>2–3 working days</strong>.
                </p>
                <p className="text-sm text-[#2e7d32] mt-2">
                  You will be able to log in once your account is approved.
                </p>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 mb-6">
            <div className="font-semibold mb-1">What happens next?</div>
            <ol className="text-left space-y-1 list-decimal list-inside">
              <li>Admin reviews your Ghana Card photo</li>
              <li>Your name is verified against the card</li>
              <li>Account is approved (2–3 working days)</li>
              <li>You can then log in and start using FarmLink</li>
            </ol>
          </div>
          <Link href="/login" className="block w-full bg-[#1b5e20] text-white py-3 rounded-lg font-semibold hover:bg-[#0d3818]">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  // ─── Step 2: Ghana Card Upload ───────────────────────────────────────────────
  if (step === 2) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1b5e20] to-[#0d3818] p-4">
        <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-lg">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-6">
            <div className="flex-1 h-1 rounded-full bg-[#1b5e20]" />
            <div className="flex-1 h-1 rounded-full bg-[#1b5e20]" />
            <div className="flex-1 h-1 rounded-full bg-gray-200" />
          </div>
          <h1 className="text-xl font-bold text-[#1b5e20] mb-1">Upload Ghana Card</h1>
          <p className="text-sm text-gray-500 mb-6">We need a clear photo of your Ghana Card to verify your identity. This is required by FarmLink for all users.</p>

          {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}

          <div className="mb-6">
            <label className="text-xs font-semibold uppercase text-gray-500">Ghana Card Photo (front side required)</label>
            <div className="mt-2">
              {ghanaCardUrl ? (
                <div className="relative">
                  <img src={ghanaCardUrl} alt="Ghana Card" className="w-full h-48 object-cover rounded-xl border-2 border-[#43a047]" />
                  <button
                    type="button"
                    onClick={() => setGhanaCardUrl("")}
                    className="absolute top-2 right-2 bg-red-600 text-white w-7 h-7 rounded-full text-sm font-bold"
                  >✕</button>
                  <div className="absolute bottom-2 left-2 bg-[#1b5e20] text-white text-xs px-2 py-1 rounded-lg">✓ Card uploaded</div>
                </div>
              ) : (
                <label className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-[#43a047] block transition-colors">
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleCardUpload} className="hidden" />
                  {uploading ? (
                    <div className="text-gray-500">
                      <div className="text-3xl mb-2">⏳</div>
                      <div className="text-sm font-semibold">Uploading...</div>
                    </div>
                  ) : (
                    <div className="text-gray-400">
                      <div className="text-4xl mb-3">🪪</div>
                      <div className="font-semibold text-gray-600 mb-1">Click to upload Ghana Card</div>
                      <div className="text-xs">JPEG, PNG or WebP • Max 5MB</div>
                    </div>
                  )}
                </label>
              )}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-xs text-amber-700">
            <strong>Tips for a good photo:</strong> Ensure the card is well-lit, all text is clearly readable, and the photo is not blurry or cropped.
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 border-2 border-gray-200 py-3 rounded-lg font-semibold text-gray-600 hover:bg-gray-50"
            >← Back</button>
            <button
              type="button"
              onClick={submit}
              disabled={!ghanaCardUrl || loading}
              className="flex-1 bg-[#1b5e20] text-white py-3 rounded-lg font-semibold hover:bg-[#0d3818] disabled:opacity-50"
            >{loading ? "Submitting..." : "Submit Registration"}</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Step 1: Account Info ────────────────────────────────────────────────────
  const step1Valid = name.trim() && phone.trim() && password.trim();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1b5e20] to-[#0d3818] p-4">
      <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex-1 h-1 rounded-full bg-[#1b5e20]" />
          <div className="flex-1 h-1 rounded-full bg-gray-200" />
          <div className="flex-1 h-1 rounded-full bg-gray-200" />
        </div>
        <h1 className="text-2xl font-bold text-[#1b5e20] text-center mb-1"><img src="/logo.jpg" alt="Logo" className="w-8 h-8 inline-block mr-2 rounded-full" /> FarmLink Ghana</h1>
        <p className="text-sm text-gray-500 text-center mb-6">Create your account — Step 1 of 2</p>
        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setRole("farmer")} className={`p-3 rounded-lg border-2 font-semibold ${role === "farmer" ? "border-[#1b5e20] bg-[#e8f5e9] text-[#1b5e20]" : "border-gray-200 text-gray-500"}`}>👨‍🌾 Farmer</button>
            <button type="button" onClick={() => setRole("buyer")} className={`p-3 rounded-lg border-2 font-semibold ${role === "buyer" ? "border-[#e65100] bg-[#fff3e0] text-[#e65100]" : "border-gray-200 text-gray-500"}`}>🏪 Buyer</button>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-gray-500">Full Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="As shown on your Ghana Card" className="w-full p-3 border-2 border-gray-200 rounded-lg mt-1 focus:border-[#43a047] outline-none" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase text-gray-500">Phone</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0244..." className="w-full p-3 border-2 border-gray-200 rounded-lg mt-1 focus:border-[#43a047] outline-none" required />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-gray-500">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 border-2 border-gray-200 rounded-lg mt-1 focus:border-[#43a047] outline-none" required />
            </div>
          </div>
          {role === "farmer" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Region</label>
                  <select value={region} onChange={(e) => setRegion(e.target.value)} className="w-full p-3 border-2 border-gray-200 rounded-lg mt-1 focus:border-[#43a047] outline-none">
                    {regions.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Town</label>
                  <input type="text" list="reg-town-list" value={town} onChange={(e) => setTown(e.target.value)} placeholder="Select or type your town" className="w-full p-3 border-2 border-gray-200 rounded-lg mt-1 focus:border-[#43a047] outline-none" />
                  <datalist id="reg-town-list">{(ghanaTowns[region] || []).map((t) => <option key={t} value={t} />)}</datalist>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Farm Size (acres)</label>
                  <input type="number" value={farmSize} onChange={(e) => setFarmSize(e.target.value)} className="w-full p-3 border-2 border-gray-200 rounded-lg mt-1 focus:border-[#43a047] outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Main Crops</label>
                  <input type="text" value={mainCrops} onChange={(e) => setMainCrops(e.target.value)} placeholder="Maize, Cassava" className="w-full p-3 border-2 border-gray-200 rounded-lg mt-1 focus:border-[#43a047] outline-none" />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Business Type</label>
                  <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className="w-full p-3 border-2 border-gray-200 rounded-lg mt-1 focus:border-[#43a047] outline-none">
                    <option>Market Trader</option><option>Restaurant</option><option>Exporter</option><option>Supermarket</option><option>Food Processor</option><option>Hotel</option><option>Boarding School</option><option>Hospital/Clinic</option><option>Individual Buyer</option><option>NGO/Govt</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Location</label>
                  <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full p-3 border-2 border-gray-200 rounded-lg mt-1 focus:border-[#43a047] outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-gray-500">Looking For (crops)</label>
                <input type="text" value={lookingFor} onChange={(e) => setLookingFor(e.target.value)} placeholder="Tomatoes, Pepper, Maize" className="w-full p-3 border-2 border-gray-200 rounded-lg mt-1 focus:border-[#43a047] outline-none" />
              </div>
            </>
          )}
          <button
            type="button"
            onClick={() => { setError(""); setStep(2); }}
            disabled={!step1Valid}
            className="w-full p-3 bg-[#1b5e20] text-white rounded-lg font-semibold hover:bg-[#0d3818] disabled:opacity-50"
          >Next: Upload Ghana Card →</button>
        </div>
        <p className="text-center text-sm text-gray-500 mt-4">Have an account? <Link href="/login" className="text-[#e65100] font-semibold">Login</Link></p>
      </div>
    </div>
  );
}

export default function Register() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
