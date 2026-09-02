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
  const [lookingFor, setLookingFor] = useState("");
  const [idType, setIdType] = useState<"ghana-card" | "passport">("ghana-card");
  const [idNumber, setIdNumber] = useState("");
  const [policyAgreed, setPolicyAgreed] = useState(false);
  const [ghanaCardUrl, setGhanaCardUrl] = useState("");
  const [passportUrl, setPassportUrl] = useState("");
  // Local preview of the ID photo — shown straight from the user's device.
  // The server copy is PRIVATE (owner + admin only), so it can't be loaded
  // back before the account exists (no session yet) — without this the
  // preview shows a broken image.
  const [idPreview, setIdPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const params = useSearchParams();

  useEffect(() => {
    const r = params.get("role");
    if (r === "farmer" || r === "buyer") setRole(r);
  }, [params]);

  // Auto-format Ghana Card number: GHA-123456789-0 as the user types digits
  const formatGhanaCard = (raw: string) => {
    // strip everything except digits, cap at 10 (9 + check digit)
    const digits = raw.replace(/\D/g, "").slice(0, 10);
    let out = "GHA";
    if (digits.length > 0) out += "-" + digits.slice(0, 9);
    if (digits.length === 10) out += "-" + digits[9];
    return out;
  };

  const handleIdUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    // instant local preview from the device
    if (idPreview) URL.revokeObjectURL(idPreview);
    setIdPreview(URL.createObjectURL(file));
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", idType === "ghana-card" ? "ghana-card" : "passport"); // private — owner + verified admin only
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.url) {
      if (idType === "ghana-card") setGhanaCardUrl(data.url);
      else setPassportUrl(data.url);
    } else {
      setError(data.error || "Upload failed. Please try again.");
      URL.revokeObjectURL(idPreview);
      setIdPreview("");
    }
    setUploading(false);
    e.target.value = "";
  };

  const submit = async () => {
    setLoading(true);
    setError("");
    const profile =
      role === "farmer"
        ? { region, town, farmSize: parseFloat(farmSize) || 0, mainCrops }
        : { businessType, region, town, lookingFor };
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Profile fields ride in the register payload — there is no session
      // cookie yet (pending accounts), so a separate /api/profile PATCH
      // would 401 and lose them.
      body: JSON.stringify({ name, phone, password, role, ghanaCardUrl, idType, idNumber, passportUrl, profile }),
    });
    const data = await res.json();
    if (res.ok) {
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
          <h1 className="text-2xl font-bold text-[#1b5e20] mb-2">Registration Submitted!</h1>
          <p className="text-gray-600 mb-4">Thank you, <strong>{name}</strong>. Your account has been created and is now under review.</p>
          <div className="bg-[#e8f5e9] border border-[#43a047] rounded-xl p-5 mb-6 text-left">
            <div className="flex items-start gap-3">
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

  // ─── Step 2: Identity Verification Upload ────────────────────────────────────
  const idFileUrl = idType === "ghana-card" ? ghanaCardUrl : passportUrl;
  const idNumberValid =
    idType === "ghana-card" ? /^GHA-\d{9}-\d$/.test(idNumber) : idNumber.trim().length >= 5;

  if (step === 2) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1b5e20] to-[#0d3818] p-4">
        <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-lg max-h-[92vh] overflow-y-auto">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-6">
            <div className="flex-1 h-1 rounded-full bg-[#1b5e20]" />
            <div className="flex-1 h-1 rounded-full bg-[#1b5e20]" />
            <div className="flex-1 h-1 rounded-full bg-gray-200" />
          </div>
          <h1 className="text-xl font-bold text-[#1b5e20] mb-1">Identity Verification</h1>
          <p className="text-sm text-gray-500 mb-4">
            We verify every member&apos;s identity before they can trade. Choose your ID type.
          </p>

          {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}

          {/* ID type toggle */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <button
              type="button"
              onClick={() => { setIdType("ghana-card"); setError(""); }}
              className={`p-3 rounded-lg border-2 font-semibold text-sm ${idType === "ghana-card" ? "border-[#1b5e20] bg-[#e8f5e9] text-[#1b5e20]" : "border-gray-200 text-gray-500"}`}
            > Ghana Card</button>
            <button
              type="button"
              onClick={() => { setIdType("passport"); setError(""); }}
              className={`p-3 rounded-lg border-2 font-semibold text-sm ${idType === "passport" ? "border-[#e65100] bg-[#fff3e0] text-[#e65100]" : "border-gray-200 text-gray-500"}`}
            > No Ghana Card? Use Passport</button>
          </div>

          {/* ID number */}
          <div className="mb-5">
            <label className="text-xs font-semibold uppercase text-gray-500">
              {idType === "ghana-card" ? "Ghana Card Number" : "Passport Number"}
            </label>
            {idType === "ghana-card" ? (
              <>
                <input
                  type="text"
                  value={idNumber}
                  onChange={(e) => setIdNumber(formatGhanaCard(e.target.value))}
                  placeholder="GHA-123456789-0"
                  className="w-full p-3 border-2 border-gray-200 rounded-lg mt-1 focus:border-[#43a047] outline-none font-mono tracking-wide"
                />
                <div className="text-xs text-gray-400 mt-1">Format: GHA-123456789-0 — as printed on your card</div>
              </>
            ) : (
              <input
                type="text"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value.toUpperCase())}
                placeholder="e.g. A1234567"
                className="w-full p-3 border-2 border-gray-200 rounded-lg mt-1 focus:border-[#43a047] outline-none font-mono tracking-wide"
              />
            )}
          </div>

          {/* Upload */}
          <div className="mb-5">
            <label className="text-xs font-semibold uppercase text-gray-500">
              {idType === "ghana-card" ? "Ghana Card Photo (front side required)" : "Passport Photo Page (required)"}
            </label>
            <div className="mt-2">
              {idFileUrl && idPreview ? (
                <div className="relative">
                  <img src={idPreview} alt={idType === "ghana-card" ? "Ghana Card" : "Passport"} className="w-full h-48 object-cover rounded-xl border-2 border-[#43a047]" />
                  <button
                    type="button"
                    onClick={() => { idType === "ghana-card" ? setGhanaCardUrl("") : setPassportUrl(""); URL.revokeObjectURL(idPreview); setIdPreview(""); }}
                    className="absolute top-2 right-2 bg-red-600 text-white w-7 h-7 rounded-full text-sm font-bold"
                  >✕</button>
                  <div className="absolute bottom-2 left-2 bg-[#1b5e20] text-white text-xs px-2 py-1 rounded-lg">✓ Uploaded</div>
                </div>
              ) : (
                <label className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-[#43a047] block transition-colors">
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleIdUpload} className="hidden" />
                  {uploading ? (
                    <div className="text-gray-500">
                      <div className="text-3xl mb-2">⏳</div>
                      <div className="text-sm font-semibold">Uploading...</div>
                    </div>
                  ) : (
                    <div className="text-gray-400">
                      <div className="font-semibold text-gray-600 mb-1">
                        Click to upload {idType === "ghana-card" ? "Ghana Card" : "Passport photo page"}
                      </div>
                      <div className="text-xs">JPEG, PNG or WebP • Max 5MB</div>
                    </div>
                  )}
                </label>
              )}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-xs text-amber-700">
            <strong>Admin will verify:</strong> the {idType === "ghana-card" ? "card number" : "passport number"} you entered must match the document in the photo exactly. Mismatches are rejected.
          </div>

          {/* Farmer policy agreement — must be ticked to submit */}
          {role === "farmer" && (
            <div className={`border-2 rounded-xl p-4 mb-5 ${policyAgreed ? "border-[#43a047] bg-[#f6fbf6]" : "border-gray-200 bg-gray-50"}`}>
              <div className="text-xs font-bold uppercase text-gray-500 mb-2"> Farmer Agreement — please read</div>
              <ul className="text-xs text-gray-700 space-y-1.5 list-disc list-inside mb-3">
                <li><strong>5% commission:</strong> FarmLink charges 5% on each completed sale (plus the payment processor fee). This is because the buyer receives the product and confirms it on the site — the escrow that protects both sides.</li>
                <li><strong>Buyer confirmation:</strong> Your payment is released only after the buyer confirms on the site that they received the product. <strong>If the buyer delays confirmation, you (the farmer) can call or email the admin</strong> — 0595726252 / info.rametechconsultancy@gmail.com — and the admin will contact the buyer to confirm product received.</li>
                <li><strong>2-3 day payout:</strong> After the buyer confirms, your money is sent to you within 2-3 days.</li>
                <li><strong>Refunds:</strong> If a buyer is not satisfied with your product, they may request a refund; the admin reviews and settles it within 2-3 days.</li>
              </ul>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={policyAgreed}
                  onChange={(e) => setPolicyAgreed(e.target.checked)}
                  className="mt-0.5 w-5 h-5 accent-[#1b5e20]"
                />
                <span className="text-sm font-semibold text-gray-700">
                  I have read and accept the FarmLink farmer agreement (5% commission, buyer confirmation before payment, 2-3 day payout).
                </span>
              </label>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 border-2 border-gray-200 py-3 rounded-lg font-semibold text-gray-600 hover:bg-gray-50"
            >← Back</button>
            <button
              type="button"
              onClick={submit}
              disabled={!idFileUrl || !idNumberValid || loading || (role === "farmer" && !policyAgreed)}
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
            <button type="button" onClick={() => setRole("farmer")} className={`p-3 rounded-lg border-2 font-semibold ${role === "farmer" ? "border-[#1b5e20] bg-[#e8f5e9] text-[#1b5e20]" : "border-gray-200 text-gray-500"}`}>Farmer</button>
            <button type="button" onClick={() => setRole("buyer")} className={`p-3 rounded-lg border-2 font-semibold ${role === "buyer" ? "border-[#e65100] bg-[#fff3e0] text-[#e65100]" : "border-gray-200 text-gray-500"}`}>Buyer</button>
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
                  <label className="text-xs font-semibold uppercase text-gray-500">Region</label>
                  <select value={region} onChange={(e) => { setRegion(e.target.value); setTown(""); }} className="w-full p-3 border-2 border-gray-200 rounded-lg mt-1 focus:border-[#43a047] outline-none">
                    {regions.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Town</label>
                  <input type="text" list="buyer-town-list" value={town} onChange={(e) => setTown(e.target.value)} placeholder="Select or type your town" className="w-full p-3 border-2 border-gray-200 rounded-lg mt-1 focus:border-[#43a047] outline-none" />
                  <datalist id="buyer-town-list">{(ghanaTowns[region] || []).map((t) => <option key={t} value={t} />)}</datalist>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Looking For (crops)</label>
                  <input type="text" value={lookingFor} onChange={(e) => setLookingFor(e.target.value)} placeholder="Tomatoes, Pepper, Maize" className="w-full p-3 border-2 border-gray-200 rounded-lg mt-1 focus:border-[#43a047] outline-none" />
                </div>
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
