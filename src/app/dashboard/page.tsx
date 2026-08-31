"use client";
import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ghanaRegions, ghanaTowns, ghanaCrops } from "@/lib/ghana-data";

interface User { id: string; name: string; role: string; phone: string; }
interface Listing { id: string; crop: string; quantity: number; price: number; region: string; location: string; status: string; postedDate: string; harvestDate: string; notes: string | null; images: string; farmer?: { name: string; phone: string; }; }

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ crop: "", quantity: "", price: "", region: "", location: "", harvestDate: "", notes: "", images: [] as string[] });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addUploading, setAddUploading] = useState(false);
  const [editUploading, setEditUploading] = useState(false);
  const router = useRouter();

  const loadListings = () => {
    fetch("/api/listings").then((r) => r.json()).then(setListings);
  };

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((data) => {
      if (!data.user) { router.push("/login"); return; }
      setUser(data.user);
      loadListings();
      setLoading(false);
    });
  }, [router]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  const startEdit = (l: Listing) => {
    setEditingId(l.id);
    let imgs: string[] = [];
    try { imgs = JSON.parse(l.images || "[]"); } catch { }
    setEditForm({ id: l.id, crop: l.crop, quantity: l.quantity, price: l.price, region: l.region, location: l.location, harvestDate: l.harvestDate, notes: l.notes || "", status: l.status, images: imgs });
  };

  const cancelEdit = () => { setEditingId(null); setEditForm({}); };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/listings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setSaving(false);
    setEditingId(null);
    setEditForm({});
    loadListings();
  };

  const handleAddImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setAddUploading(true);
    const newImgs: string[] = [];
    for (const file of Array.from(files)) {
      if (addForm.images.length + newImgs.length >= 5) break;
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) newImgs.push(data.url);
    }
    setAddForm((prev: typeof addForm) => ({ ...prev, images: [...prev.images, ...newImgs] }));
    setAddUploading(false);
    e.target.value = "";
  };

  const removeAddImage = (idx: number) =>
    setAddForm((prev: typeof addForm) => ({ ...prev, images: prev.images.filter((_: string, i: number) => i !== idx) }));

  const handleEditImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setEditUploading(true);
    const newImgs: string[] = [];
    for (const file of Array.from(files)) {
      if ((editForm.images || []).length + newImgs.length >= 5) break;
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) newImgs.push(data.url);
    }
    setEditForm((prev: any) => ({ ...prev, images: [...(prev.images || []), ...newImgs] }));
    setEditUploading(false);
    e.target.value = "";
  };

  const removeEditImage = (idx: number) =>
    setEditForm((prev: any) => ({ ...prev, images: (prev.images || []).filter((_: string, i: number) => i !== idx) }));

  const submitListing = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setAddError(null);
    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addForm),
    });
    const data = await res.json();
    setAdding(false);
    if (!res.ok || data.error) {
      setAddError(data.error || "Failed to post listing. Please try again.");
      return;
    }
    setShowAddForm(false);
    setAddForm({ crop: "", quantity: "", price: "", region: "", location: "", harvestDate: "", notes: "", images: [] });
    loadListings();
  };

  const deleteListing = async (id: string) => {
    if (!confirm("Delete this listing? This cannot be undone.")) return;
    await fetch(`/api/listings?id=${id}`, { method: "DELETE" });
    loadListings();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;
  if (!user) return null;

  const available = listings.filter((l) => l.status === "available");
  const myListings = user.role === "farmer" ? listings : listings.filter((l) => l.farmer?.phone === user.phone);

  return (
    <div className="min-h-screen">
      <header className="bg-[#1b5e20] text-white px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="text-lg font-bold"><img src="/logo.jpg" alt="Logo" className="w-8 h-8 inline-block mr-2 rounded-full" /> FarmLink <span className="opacity-70 text-sm">{user.name}</span></div>
        <div className="flex gap-2">
          {user.role !== "farmer" && <Link href="/market" className="bg-white/15 px-3 py-1.5 rounded-lg text-sm hover:bg-white/25">Market</Link>}
          <Link href="/prices" className="bg-white/15 px-3 py-1.5 rounded-lg text-sm hover:bg-white/25">Prices</Link>
          <Link href="/profile" className="bg-white/15 px-3 py-1.5 rounded-lg text-sm hover:bg-white/25">Profile</Link>
          {user.role === "buyer" && <Link href="/orders" className="bg-white/15 px-3 py-1.5 rounded-lg text-sm hover:bg-white/25">My Orders</Link>}
          {user.role === "admin" && <Link href="/admin" className="bg-[#e65100] px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-[#ff6f00]">Admin Panel</Link>}
          <button onClick={logout} className="bg-red-600/70 px-3 py-1.5 rounded-lg text-sm hover:bg-red-600">Logout</button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-[#1b5e20] mb-6">Dashboard</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 shadow border border-gray-200">
            <div className="text-xs uppercase text-gray-500">Your Role</div>
            <div className="text-xl font-bold capitalize">{user.role}</div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow border border-gray-200">
            <div className="text-xs uppercase text-gray-500">{user.role === "farmer" ? "Your Available" : "Available"}</div>
            <div className="text-xl font-bold text-[#1b5e20]">{user.role === "farmer" ? myListings.filter(l => l.status === "available").length : available.length}</div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow border border-gray-200">
            <div className="text-xs uppercase text-gray-500">{user.role === "farmer" ? "Your Total" : "Total Listings"}</div>
            <div className="text-xl font-bold">{user.role === "farmer" ? myListings.length : listings.length}</div>
          </div>
          <div className="bg-white rounded-xl p-5 shadow border border-gray-200">
            <div className="text-xs uppercase text-gray-500">{user.role === "farmer" ? "Posted by You" : "Your Listings"}</div>
            <div className="text-xl font-bold text-[#e65100]">{myListings.length}</div>
          </div>
        </div>

        {user.role === "farmer" && (
          <div className="mb-6">
            <button
              onClick={() => { setShowAddForm(!showAddForm); setAddError(null); }}
              className="bg-[#1b5e20] text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-[#0d3818]"
            >
              {showAddForm ? "✕ Cancel" : "+ List Produce for Sale"}
            </button>

            {showAddForm && (
              <form onSubmit={submitListing} className="mt-4 bg-white rounded-xl shadow border border-gray-200 p-6 grid md:grid-cols-2 gap-4">
                <h3 className="md:col-span-2 text-base font-bold text-[#1b5e20]">New Produce Listing</h3>
                {addError && (
                  <div className="md:col-span-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm">
                    ⚠️ {addError}
                    {addError.includes("profile") && (
                      <span> — <Link href="/profile" className="underline font-semibold">Complete your profile</Link></span>
                    )}
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Crop</label>
                  <input type="text" list="add-crop-list" value={addForm.crop} onChange={(e) => setAddForm({ ...addForm, crop: e.target.value })} placeholder="Select or type crop" className="w-full p-2.5 border-2 border-gray-200 rounded-lg mt-1 outline-none focus:border-[#43a047]" required />
                  <datalist id="add-crop-list">{ghanaCrops.map((c) => <option key={c} value={c} />)}</datalist>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Quantity (bags)</label>
                  <input type="number" min="1" value={addForm.quantity} onChange={(e) => setAddForm({ ...addForm, quantity: e.target.value })} className="w-full p-2.5 border-2 border-gray-200 rounded-lg mt-1 outline-none focus:border-[#43a047]" required />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Price per bag (GH₵)</label>
                  <input type="number" min="0" step="0.01" value={addForm.price} onChange={(e) => setAddForm({ ...addForm, price: e.target.value })} className="w-full p-2.5 border-2 border-gray-200 rounded-lg mt-1 outline-none focus:border-[#43a047]" required />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Region</label>
                  <select value={addForm.region} onChange={(e) => setAddForm({ ...addForm, region: e.target.value, location: "" })} className="w-full p-2.5 border-2 border-gray-200 rounded-lg mt-1 outline-none">
                    <option value="">Auto (from profile)</option>
                    {ghanaRegions.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Location (town)</label>
                  <input type="text" list="add-town-list" value={addForm.location} onChange={(e) => setAddForm({ ...addForm, location: e.target.value })} placeholder="Select or type town" className="w-full p-2.5 border-2 border-gray-200 rounded-lg mt-1 outline-none focus:border-[#43a047]" />
                  <datalist id="add-town-list">{(ghanaTowns[addForm.region] || []).map((t) => <option key={t} value={t} />)}</datalist>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-gray-500">Harvest Date</label>
                  <input type="date" value={addForm.harvestDate} onChange={(e) => setAddForm({ ...addForm, harvestDate: e.target.value })} className="w-full p-2.5 border-2 border-gray-200 rounded-lg mt-1 outline-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold uppercase text-gray-500">Notes (optional)</label>
                  <input type="text" value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })} placeholder="e.g. Freshly harvested, ready for pickup" className="w-full p-2.5 border-2 border-gray-200 rounded-lg mt-1 outline-none focus:border-[#43a047]" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold uppercase text-gray-500">Product Photos (up to 5)</label>
                  <div className="mt-2">
                    {addForm.images.length > 0 && (
                      <div className="flex gap-2 flex-wrap mb-3">
                        {addForm.images.map((img: string, i: number) => (
                          <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-200">
                            <img src={img} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                            <button type="button" onClick={() => removeAddImage(i)} className="absolute top-0 right-0 bg-red-600 text-white w-5 h-5 rounded-bl-lg text-xs flex items-center justify-center">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {addForm.images.length < 5 && (
                      <label className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center cursor-pointer hover:border-[#43a047] block">
                        <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleAddImageUpload} className="hidden" />
                        {addUploading ? <span className="text-gray-500 text-sm">Uploading...</span> : <span className="text-gray-500 text-sm">📸 Click to upload photos ({addForm.images.length}/5)</span>}
                      </label>
                    )}
                  </div>
                </div>
                <div className="md:col-span-2 flex gap-3">
                  <button type="submit" disabled={adding} className="bg-[#1b5e20] text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-[#0d3818] disabled:opacity-50">
                    {adding ? "Posting..." : "Post Listing"}
                  </button>
                  <button type="button" onClick={() => { setShowAddForm(false); setAddError(null); }} className="border-2 border-gray-200 px-6 py-2.5 rounded-lg font-semibold text-gray-600">Cancel</button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Listings Table */}
        <h2 className="text-lg font-bold text-[#1b5e20] mb-3">{user.role === "farmer" ? "Your Listings" : "Latest Market Listings"}</h2>
        <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left text-xs uppercase text-gray-500">Crop</th>
                {user.role !== "farmer" && <th className="p-3 text-left text-xs uppercase text-gray-500">Farmer</th>}
                <th className="p-3 text-left text-xs uppercase text-gray-500">Location</th>
                <th className="p-3 text-left text-xs uppercase text-gray-500">Qty</th>
                <th className="p-3 text-left text-xs uppercase text-gray-500">Price (GH₵)</th>
                <th className="p-3 text-left text-xs uppercase text-gray-500">Status</th>
                {user.role === "farmer" && <th className="p-3 text-left text-xs uppercase text-gray-500">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {(user.role === "farmer" ? myListings : listings).slice(0, 10).map((l) => (
                <Fragment key={l.id}>
                  <tr className="border-t hover:bg-gray-50">
                    <td className="p-3 font-semibold">{l.crop}</td>
                    {user.role !== "farmer" && <td className="p-3">{l.farmer?.name || "—"}</td>}
                    <td className="p-3">{l.location}, {l.region}</td>
                    <td className="p-3">{l.quantity} bags</td>
                    <td className="p-3">GH₵{l.price.toLocaleString()}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${l.status === "available" ? "bg-green-50 text-green-600" : l.status === "reserved" ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"}`}>{l.status}</span>
                    </td>
                    {user.role === "farmer" && (
                      <td className="p-3 flex gap-2">
                        <button onClick={() => startEdit(l)} className="bg-[#1b5e20] text-white px-3 py-1 rounded-lg text-xs font-semibold hover:bg-[#0d3818]">Edit</button>
                        <button onClick={() => deleteListing(l.id)} className="bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-semibold hover:bg-red-700">Delete</button>
                      </td>
                    )}
                  </tr>
                  {editingId === l.id && (
                    <tr className="border-t bg-gray-50">
                      <td colSpan={7} className="p-4">
                        <form onSubmit={saveEdit} className="grid md:grid-cols-3 gap-3">
                          <div>
                            <label className="text-xs font-semibold uppercase text-gray-500">Crop</label>
                            <input type="text" value={editForm.crop} onChange={(e) => setEditForm({ ...editForm, crop: e.target.value })} className="w-full p-2 border-2 border-gray-200 rounded-lg mt-1 outline-none focus:border-[#43a047]" required />
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase text-gray-500">Quantity (bags)</label>
                            <input type="number" value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} className="w-full p-2 border-2 border-gray-200 rounded-lg mt-1 outline-none focus:border-[#43a047]" required />
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase text-gray-500">Price (GH₵)</label>
                            <input type="number" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} className="w-full p-2 border-2 border-gray-200 rounded-lg mt-1 outline-none focus:border-[#43a047]" required />
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase text-gray-500">Location (town)</label>
                            <input type="text" list="edit-town-list" value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} placeholder="Select or type town" className="w-full p-2 border-2 border-gray-200 rounded-lg mt-1 outline-none focus:border-[#43a047]" />
                            <datalist id="edit-town-list">
                              {(ghanaTowns[editForm.region || ""] || []).map((t) => <option key={t} value={t} />)}
                            </datalist>
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase text-gray-500">Harvest Date</label>
                            <input type="date" value={editForm.harvestDate} onChange={(e) => setEditForm({ ...editForm, harvestDate: e.target.value })} className="w-full p-2 border-2 border-gray-200 rounded-lg mt-1 outline-none" />
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase text-gray-500">Status</label>
                            <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="w-full p-2 border-2 border-gray-200 rounded-lg mt-1 outline-none">
                              <option value="available">Available</option>
                              <option value="reserved">Reserved</option>
                              <option value="sold">Sold Out</option>
                            </select>
                          </div>
                          <div className="md:col-span-3">
                            <label className="text-xs font-semibold uppercase text-gray-500">Notes</label>
                            <input type="text" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className="w-full p-2 border-2 border-gray-200 rounded-lg mt-1 outline-none focus:border-[#43a047]" />
                          </div>
                          <div className="md:col-span-3">
                            <label className="text-xs font-semibold uppercase text-gray-500">Product Photos (up to 5)</label>
                            <div className="mt-2">
                              {(editForm.images || []).length > 0 && (
                                <div className="flex gap-2 flex-wrap mb-3">
                                  {(editForm.images as string[]).map((img, i) => (
                                    <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-200">
                                      <img src={img} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                                      <button type="button" onClick={() => removeEditImage(i)} className="absolute top-0 right-0 bg-red-600 text-white w-5 h-5 rounded-bl-lg text-xs flex items-center justify-center">✕</button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {(editForm.images || []).length < 5 && (
                                <label className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center cursor-pointer hover:border-[#43a047] block">
                                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleEditImageUpload} className="hidden" />
                                  {editUploading ? <span className="text-gray-500 text-sm">Uploading...</span> : <span className="text-gray-500 text-sm">📸 Click to upload photos ({(editForm.images || []).length}/5)</span>}
                                </label>
                              )}
                            </div>
                          </div>
                          <div className="md:col-span-3 flex gap-3">
                            <button type="submit" disabled={saving} className="bg-[#1b5e20] text-white px-6 py-2 rounded-lg font-semibold hover:bg-[#0d3818] disabled:opacity-50">{saving ? "Saving..." : "Save Changes"}</button>
                            <button type="button" onClick={cancelEdit} className="border-2 border-gray-200 px-6 py-2 rounded-lg font-semibold text-gray-600">Cancel</button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {(user.role === "farmer" ? myListings : listings).length === 0 && <tr><td colSpan={user.role === "farmer" ? 7 : 6} className="p-4 text-center text-gray-400">No listings yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
