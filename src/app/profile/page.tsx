"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ghanaRegions, ghanaTowns } from "@/lib/ghana-data";

import HeaderBanner from "@/components/headerBanner";
import NotificationBell from "@/components/notificationBell";

export default function Profile() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // name/password change-request state
  const [showNameForm, setShowNameForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [showPassForm, setShowPassForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changeMsg, setChangeMsg] = useState("");
  const router = useRouter();

  const regions = ghanaRegions;

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((data) => {
      if (!data.user) { router.push("/login"); return; }
      setUser(data.user);
      fetch("/api/profile").then((r) => r.json()).then((p) => {
        // profile API returns { user, farmer | buyer }
        if (p.farmer || p.buyer) {
          setProfile(p.farmer || p.buyer);
          setUser({ ...data.user, ...p.user, ...(p.farmer || p.buyer) });
        } else {
          setProfile(p);
        }
        setLoading(false);
      });
    });
  }, [router]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setNotice("");
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // instant fields
        region: profile.region, town: profile.town,
        farmSize: profile.farmSize, mainCrops: profile.mainCrops,
        businessType: profile.businessType, location: profile.location,
        lookingFor: profile.lookingFor,
        deliveryAddress: profile.deliveryAddress,
        deliveryLat: typeof profile.deliveryLat === "number" ? profile.deliveryLat : undefined,
        deliveryLng: typeof profile.deliveryLng === "number" ? profile.deliveryLng : undefined,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const uploadAvatar = async (file: File) => {
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "profile");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      // save instantly to the user record
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileImageUrl: data.url }),
      });
      setUser((u: any) => ({ ...u, profileImageUrl: data.url }));
      setNotice("Profile photo updated.");
    } catch (e: any) {
      setNotice(e.message || "Upload failed");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const submitNameChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeMsg("");
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newName }),
    });
    const data = await res.json();
    if (res.ok) {
      setChangeMsg(data.message || "Name change submitted for admin approval.");
      setShowNameForm(false);
      setNewName("");
    } else {
      setChangeMsg(data.error || "Failed");
    }
  };

  const submitPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeMsg("");
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (res.ok) {
      setChangeMsg(data.message || "Password change submitted for admin approval.");
      setShowPassForm(false);
      setCurrentPassword("");
      setNewPassword("");
    } else {
      setChangeMsg(data.error || "Failed");
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#f8faf7]">
      <header className="bg-[#1b5e20] text-white px-6 py-3 flex items-center justify-between sticky top-0 z-50">
          <HeaderBanner />
        <div className="text-lg font-bold"><img src="/logo.jpg" alt="Logo" className="w-8 h-8 inline-block mr-2 rounded-full" /> FarmLink <span className="opacity-70 text-sm">Profile</span></div>
        <div className="flex gap-2">
          {user?.role !== "farmer" && user && (<a href="/orders" className="px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm transition-colors bg-[#f9a825] hover:bg-[#f57f17] text-[#3e2723]">My Orders</a>)}
          <NotificationBell />
          <Link href="/dashboard" className="bg-white/15 px-3 py-1.5 rounded-lg text-sm hover:bg-white/25">Dashboard</Link>
          <Link href="/market" className="px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm transition-colors bg-[#ef6c00] hover:bg-[#e65100] text-white">Market</Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-[#1b5e20] mb-6">Edit Profile</h1>

        {saved && <div className="bg-green-50 text-green-700 p-3 rounded-lg mb-4 text-sm font-semibold">Profile saved successfully</div>}
        {notice && <div className="bg-blue-50 text-blue-700 p-3 rounded-lg mb-4 text-sm font-semibold">{notice}</div>}
        {changeMsg && <div className="bg-amber-50 text-amber-800 border border-amber-200 p-3 rounded-lg mb-4 text-sm font-semibold">{changeMsg}</div>}

        <form onSubmit={save} className="space-y-4">
          {/* Profile photo */}
          <div className="bg-white rounded-xl shadow border border-gray-200 p-5">
            <h2 className="font-bold text-[#1b5e20] mb-4">Profile Photo</h2>
            <div className="flex items-center gap-4">
              {user.profileImageUrl ? (
                <img src={user.profileImageUrl} alt="Profile" className="w-20 h-20 rounded-full object-cover ring-2 ring-[#43a047]" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[#e8f5e9] flex items-center justify-center text-2xl font-bold text-[#1b5e20]">
                  {user.name?.charAt(0) || "?"}
                </div>
              )}
              <label className={`cursor-pointer px-4 py-2 rounded-lg font-semibold text-sm ${uploadingAvatar ? "bg-gray-200 text-gray-500" : "bg-[#1b5e20] text-white hover:bg-[#0d3818]"}`}>
                {uploadingAvatar ? "Uploading..." : user.profileImageUrl ? "Change Photo" : "Upload Photo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={uploadingAvatar}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.currentTarget.value = ""; }}
                />
              </label>
            </div>
          </div>

          {/* Account info — name/password changes need admin approval */}
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
            <div className="flex gap-2 mt-3 flex-wrap">
              <button type="button" onClick={() => { setShowNameForm(!showNameForm); setShowPassForm(false); }} className="text-xs font-semibold text-[#1b5e20] hover:underline">
                Request name change
              </button>
              <span className="text-gray-300">|</span>
              <button type="button" onClick={() => { setShowPassForm(!showPassForm); setShowNameForm(false); }} className="text-xs font-semibold text-[#1b5e20] hover:underline">
                Request password change
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">Name and password changes are reviewed by the admin before they take effect.</p>

            {showNameForm && (
              <div className="mt-3 border-2 border-gray-100 rounded-xl p-4 bg-gray-50">
                <label className="text-xs font-semibold uppercase text-gray-500">New Full Name</label>
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Enter your new name" className="w-full p-2.5 border-2 border-gray-200 rounded-lg mt-1 outline-none focus:border-[#43a047] bg-white" />
                <button type="button" onClick={submitNameChange} disabled={newName.trim().length < 2} className="mt-3 w-full bg-[#1b5e20] text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-[#0d3818] disabled:opacity-50">
                  Submit for Admin Approval
                </button>
              </div>
            )}

            {showPassForm && (
              <div className="mt-3 border-2 border-gray-100 rounded-xl p-4 bg-gray-50">
                <label className="text-xs font-semibold uppercase text-gray-500">Current Password</label>
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full p-2.5 border-2 border-gray-200 rounded-lg mt-1 outline-none focus:border-[#43a047] bg-white" />
                <label className="text-xs font-semibold uppercase text-gray-500 mt-3 block">New Password (min 8 characters)</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full p-2.5 border-2 border-gray-200 rounded-lg mt-1 outline-none focus:border-[#43a047] bg-white" />
                <button type="button" onClick={submitPasswordChange} disabled={!currentPassword || newPassword.length < 8} className="mt-3 w-full bg-[#1b5e20] text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-[#0d3818] disabled:opacity-50">
                  Submit for Admin Approval
                </button>
              </div>
            )}
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
                  <p className="text-xs text-gray-400 mt-1">We SMS you when these crops are newly listed or get cheaper.</p>
                </div>
              </div>

              {/* Default delivery location — prefilled at every checkout */}
              <div className="bg-[#f6fbf6] border border-[#c8e6c9] rounded-lg p-4 space-y-2">
                <div className="text-xs font-bold uppercase text-[#1b5e20]">Default Delivery Location</div>
                <p className="text-xs text-gray-500">Farmers deliver here. You can still change it per order at checkout.</p>
                <textarea
                  value={profile.deliveryAddress || ""}
                  onChange={(e) => setProfile({ ...profile, deliveryAddress: e.target.value })}
                  rows={2}
                  maxLength={300}
                  placeholder="Landmark / house / street — e.g. House 12, near Koforidua Polyclinic"
                  className="w-full p-2.5 border-2 border-gray-200 rounded-lg outline-none focus:border-[#43a047] text-sm"
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      if (!navigator.geolocation) { alert("GPS is not supported on this device"); return; }
                      navigator.geolocation.getCurrentPosition(
                        (pos) => setProfile({ ...profile, deliveryLat: pos.coords.latitude, deliveryLng: pos.coords.longitude }),
                        () => alert("Could not get your location. Check location permission."),
                        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
                      );
                    }}
                    className="bg-[#1565c0] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#0d47a1]"
                  >
                    {typeof profile.deliveryLat === "number" ? `GPS ✓ ${profile.deliveryLat.toFixed(4)}, ${profile.deliveryLng?.toFixed(4)}` : "Use My GPS Location"}
                  </button>
                  {typeof profile.deliveryLat === "number" && (
                    <button type="button" onClick={() => setProfile({ ...profile, deliveryLat: undefined, deliveryLng: undefined })} className="text-xs text-gray-500 hover:underline">clear GPS</button>
                  )}
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