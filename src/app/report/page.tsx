"use client";
import Link from "next/link";
import SiteHeader from "@/components/siteHeader";
import { useEffect, useState } from "react";

import SiteFooter from "@/components/siteFooter";

const CATEGORIES = [
  { id: "scam", label: "Suspected scam or fraud", desc: "Someone asked for money outside FarmLink, or deceived you" },
  { id: "payment", label: "Payment problem", desc: "Paid but order not confirmed, refund not received, wrong amount" },
  { id: "fake-listing", label: "Fake or misleading listing", desc: "Product doesn't exist, photos/quantity/price are false" },
  { id: "behavior", label: "User behaviour", desc: "Rude, threatening or harassing user" },
  { id: "hacked-account", label: "My account was hacked", desc: "Someone accessed your account without permission" },
  { id: "other", label: "Other", desc: "Anything else that needs our attention" },
];

export default function Report() {
  const [category, setCategory] = useState("scam");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [listingUrl, setListingUrl] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setLoggedIn(true);
          setName(d.user.name || "");
          setPhone(d.user.phone || "");
        }
      })
      .catch(() => {});
    // if launched from a listing page (?listing=...) keep that context
    const params = new URLSearchParams(window.location.search);
    const l = params.get("listing");
    if (l) setListingUrl(window.location.origin + l);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, message, name: loggedIn ? undefined : name, phone: loggedIn ? undefined : phone, listingUrl }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) {
      setResult({ ok: true, text: data.message || "Report submitted." });
      setMessage("");
    } else {
      setResult({ ok: false, text: data.error || "Could not submit report. Try again." });
    }
  };

  return (
    <div className="min-h-screen bg-[#f8faf7]">
      <SiteHeader  />

      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-extrabold text-[#1b5e20] mb-2">Report a Problem</h1>
        <p className="text-gray-500 mb-8">
          Tell us about scams, fraud, payment problems, fake listings or hacked accounts. The admin is alerted
          immediately. For urgent cases also call <strong className="text-[#1b5e20]">0595726252</strong>.
        </p>

        {result && (
          <div className={`p-4 rounded-xl mb-6 ${result.ok ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-700"}`}>
            {result.ok ? (
              <div>
                <div className="font-bold mb-1">Report submitted — thank you.</div>
                <div className="text-sm">{result.text} If you left your number, we&apos;ll SMS you when it&apos;s resolved.</div>
              </div>
            ) : (
              <div className="font-bold">{result.text}</div>
            )}
          </div>
        )}

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-3">What are you reporting?</label>
            <div className="space-y-2">
              {CATEGORIES.map((c) => (
                <label key={c.id} className={`flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer transition-colors ${category === c.id ? "border-[#43a047] bg-[#f6fbf6]" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                  <input
                    type="radio"
                    name="category"
                    checked={category === c.id}
                    onChange={() => setCategory(c.id)}
                    className="mt-1 accent-[#1b5e20]"
                  />
                  <div>
                    <div className="font-semibold text-sm text-gray-800">{c.label}</div>
                    <div className="text-xs text-gray-500">{c.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-gray-700 block mb-1">Describe what happened</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              required
              minLength={10}
              maxLength={2000}
              placeholder="Give as much detail as possible — who was involved, what happened, dates and amounts..."
              className="w-full p-4 border-2 border-gray-200 rounded-xl outline-none focus:border-[#43a047] text-sm"
            />
            <div className="text-xs text-gray-400 mt-1 text-right">{message.length}/2000</div>
          </div>

          {listingUrl && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-700">
              This report is attached to the listing: <span className="font-mono text-xs">{listingUrl}</span>
            </div>
          )}

          {!loggedIn && (
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase text-gray-500">Your name (optional)</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="So we can follow up" className="w-full p-2.5 border-2 border-gray-200 rounded-lg mt-1 outline-none focus:border-[#43a047] bg-white text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-gray-500">Your phone (optional)</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="We SMS you when resolved" className="w-full p-2.5 border-2 border-gray-200 rounded-lg mt-1 outline-none focus:border-[#43a047] bg-white text-sm" />
              </div>
            </div>
          )}

          {loggedIn && (
            <p className="text-xs text-gray-400">Submitting as <strong>{name}</strong> ({phone}) — the admin knows how to reach you.</p>
          )}

          <button
            type="submit"
            disabled={submitting || message.trim().length < 10}
            className="w-full py-3.5 rounded-xl bg-[#1b5e20] text-white font-bold hover:bg-[#0d3818] disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Report"}
          </button>
        </form>
      </div>
    <SiteFooter dark={false} />
    </div>
  );
}