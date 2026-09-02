"use client";
import Link from "next/link";

import SiteFooter from "@/components/siteFooter";

export default function Support() {
  return (
    <div className="min-h-screen bg-[#f8faf7]">
      <header className="bg-[#1b5e20] text-white px-6 py-3.5 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <Link href="/" className="text-xl font-bold flex items-center gap-2">
          <img src="/logo.jpg" alt="FarmLink" className="w-9 h-9 rounded-full ring-2 ring-white/30" />
          FarmLink <span className="opacity-70 text-sm font-normal">Ghana</span>
        </Link>
        <Link href="/faq" className="bg-white/15 px-4 py-2 rounded-lg text-sm hover:bg-white/25">FAQ</Link>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-extrabold text-[#1b5e20] mb-2">Support &amp; Help</h1>
        <p className="text-gray-500 mb-8">We&apos;re here to help. Reach us any way that suits you — a real person replies, not a bot.</p>

        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <a href="tel:0595726252" className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <div className="text-xs font-bold uppercase text-gray-400 mb-2">Call or WhatsApp</div>
            <div className="text-2xl font-extrabold text-[#1b5e20]">0595726252</div>
            <div className="text-sm text-gray-500 mt-2">Mon-Sat, 8am - 8pm</div>
          </a>
          <a href="mailto:info.rametechconsultancy@gmail.com" className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <div className="text-xs font-bold uppercase text-gray-400 mb-2">Email</div>
            <div className="text-lg font-bold text-[#1b5e20] break-all">info.rametechconsultancy@gmail.com</div>
            <div className="text-sm text-gray-500 mt-2">Replies within 24 hours</div>
          </a>
        </div>

        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 mb-8">
          <h2 className="font-bold text-[#1b5e20] mb-4">What can we help with?</h2>
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              <span className="w-1.5 rounded-full bg-[#43a047] shrink-0" />
              <div><strong>Registration &amp; verification</strong> — problems signing up, rejected accounts, Ghana Card issues</div>
            </div>
            <div className="flex gap-3">
              <span className="w-1.5 rounded-full bg-[#e65100] shrink-0" />
              <div><strong>Payments &amp; refunds</strong> — payment failures, delayed payouts, refund requests (2-3 day processing)</div>
            </div>
            <div className="flex gap-3">
              <span className="w-1.5 rounded-full bg-[#1b5e20] shrink-0" />
              <div><strong>Login &amp; SMS codes</strong> — not receiving your login code (wait up to 5 minutes before re-requesting), locked accounts</div>
            </div>
            <div className="flex gap-3">
              <span className="w-1.5 rounded-full bg-red-500 shrink-0" />
              <div><strong>Emergencies</strong> — suspected scam, hacked account, fraudulent listing. <Link href="/report" className="text-[#1b5e20] font-semibold underline">File a report</Link> so we&apos;re alerted instantly.</div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Link href="/faq" className="bg-[#e8f5e9] rounded-2xl p-6 hover:bg-[#d7ecd9] transition-colors">
            <div className="font-bold text-[#1b5e20] mb-1">Frequently Asked Questions</div>
            <div className="text-sm text-gray-600">Instant answers about registration, listing, payments, verification and safety.</div>
          </Link>
          <Link href="/report" className="bg-white rounded-2xl p-6 border-2 border-gray-100 hover:border-[#43a047] transition-colors">
            <div className="font-bold text-[#1b5e20] mb-1">Report a Problem</div>
            <div className="text-sm text-gray-600">Scam, fraud, fake listing or bad behaviour — tell us and we act on it.</div>
          </Link>
        </div>
      </div>
    <SiteFooter dark={false} />
    </div>
  );
}