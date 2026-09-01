"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ghanaRegions, ghanaTowns } from "@/lib/ghana-data";

export default function Profile() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const regions = ghanaRegions;

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((data) => {
      if (!data.user) { router.push("/login"); return; }
      setUser(data.user);
      // Fetch profile via the profile API GET
      fetch("/api/profile").then((r) => r.json()).then((p) => {
        setProfile(p);
        setLoading(false);
      });
    });
  }, [router]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;
  if (!user) return null;

  return (
    <div className="min-h-screen">
      <header className="bg-[#1b5e20] text-white px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="text-lg font-bold"><img src="/logo.jpg" alt="Logo" className="w-8 h-8 inline-block mr-2 rounded-full" /> FarmLink <span className="opacity-70 text-sm">Profile</span></div>
        <div className="flex gap-2">
          {user?.role !== "farmer" && user && (<a href="/orders" className="bg-white/15 px-3 py-1.5 rounded-lg text-sm hover:bg-white/25">My Orders</a>)}
          
          <Link href="/dashboard" className="bg-white/15 px-3 py-1.5 rounded-lg text-sm hover:bg-white/25">Dashboard</Link>
          <Link href="/market" className="bg-white/15 px-3 py-1.5 rounded-lg text-sm hover:bg-white/25">Market</Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-[#1b5e20] mb-6">Edit Profile</h1>

        {saved && <div className="bg-green-50 text-green-700 p-3 rounded-lg mb-4 text-sm font-semibold">✓ Profile saved successfully</div>}

        <form onSubmit={save} className="space-y-4">
          <div className="bg-white rounded-xl shadow border border-gray-200 p-5">
            <h2 className="font-bold text-[#1b5e20] mb-4">Account Info</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase text-gray-500">Full Name</label>
                <input type="text" value={user.name || ""} disabled className="w-full p-2.5 border-2 border-gray-200 rounded-lg mt-1 bg-gray-50 text-gray-500" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-gray-500">Phone</label>
                <input type="text" value={user.phone || ""} disabled className="w-full p-2.5 border-2 border-gray-200 rounded-lg mt-1 bg-gray-50 text-gray-500" />
              </div>
            </div>
          </div>

          {user.role === "farmer" && profile && (
            <div className="bg-white rounded-xl shadow border border-gray-200 p-5 space-y-4">
              <h2 className="font-bold text-[#1b5e20]">Farm Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Region</label>
                  <select value={profile.region || ""} onChange={(e) => setProfile({ ...profile, region: e.target.value })} className="w-full p-2.5 border-2 border-gray-200 rounded-lg mt-1 outline-none focus:border-[#43a047]">
                    <option value="">Select region</option>
                    {regions.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Town</label>
                  <input type="text" list="profile-town-list" value={profile.town || ""} onChange={(e) => setProfile({ ...profile, town: e.target.value })} placeholder="Select or type your town" className="w-full p-2.5 border-2 border-gray-200 rounded-lg mt-1 outline-none focus:border-[#43a047]" />
                  <datalist id="profile-town-list">
                    {(ghanaTowns[profile.region || ""] || []).map((t) => <option key={t} value={t} />)}
                  </datalist>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Farm Size (acres)</label>
                  <input type="number" step="0.1" value={profile.farmSize || 0} onChange={(e) => setProfile({ ...profile, farmSize: parseFloat(e.target.value) || 0 })} className="w-full p-2.5 border-2 border-gray-200 rounded-lg mt-1 outline-none focus:border-[#43a047]" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Main Crops</label>
                  <input type="text" value={profile.mainCrops || ""} onChange={(e) => setProfile({ ...profile, mainCrops: e.target.value })} placeholder="e.g. Maize, Cassava" className="w-full p-2.5 border-2 border-gray-200 rounded-lg mt-1 outline-none focus:border-[#43a047]" />
                </div>
              </div>
            </div>
          )}

          {user.role === "buyer" && profile && (
            <div className="bg-white rounded-xl shadow border border-gray-200 p-5 space-y-4">
              <h2 className="font-bold text-[#1b5e20]">Business Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Business Type</label>
                  <select value={profile.businessType || ""} onChange={(e) => setProfile({ ...profile, businessType: e.target.value })} className="w-full p-2.5 border-2 border-gray-200 rounded-lg mt-1 outline-none focus:border-[#43a047]">
                    <option>Market Trader</option><option>Restaurant</option><option>Exporter</option><option>Supermarket</option><option>Food Processor</option><option>Hotel</option><option>Boarding School</option><option>Hospital/Clinic</option><option>Individual Buyer</option><option>NGO/Govt</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Region</label>
                  <select value={profile.region || ""} onChange={(e) => setProfile({ ...profile, region: e.target.value, location: "" })} className="w-full p-2.5 border-2 border-gray-200 rounded-lg mt-1 outline-none focus:border-[#43a047]">
                    <option value="">Select region</option>
                    {regions.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Town</label>
                  <input type="text" list="buyer-profile-town-list" value={profile.location || ""} onChange={(e) => setProfile({ ...profile, location: e.target.value })} placeholder="Select or type your town" className="w-full p-2.5 border-2 border-gray-200 rounded-lg mt-1 outline-none focus:border-[#43a047]" />
                  <datalist id="buyer-profile-town-list">
                    {(ghanaTowns[profile.region || ""] || []).map((t) => <option key={t} value={t} />)}
                  </datalist>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Looking For (crops)</label>
                  <input type="text" value={profile.lookingFor || ""} onChange={(e) => setProfile({ ...profile, lookingFor: e.target.value })} placeholder="e.g. Tomatoes, Pepper, Maize" className="w-full p-2.5 border-2 border-gray-200 rounded-lg mt-1 outline-none focus:border-[#43a047]" />
                </div>
              </div>
            </div>
          )}

          <button type="submit" disabled={saving} className="w-full p-3 bg-[#1b5e20] text-white rounded-lg font-semibold hover:bg-[#0d3818] disabled:opacity-50">{saving ? "Saving..." : "Save Profile"}</button>
        </form>
      </div>
    </div>
  );
}
