"use client";
import Link from "next/link";
import SiteHeader from "@/components/siteHeader";
import { useState } from "react";

interface QA { q: string; a: React.ReactNode }
interface Category { name: string; items: QA[] }

import SiteFooter from "@/components/siteFooter";

const CATEGORIES: Category[] = [
  {
    name: "Registration",
    items: [
      {
        q: "How do I create an account?",
        a: <>Tap <strong>Sign Up</strong> on the homepage and choose <strong>Register as Farmer</strong> or <strong>Register as Buyer</strong>. Buyers just fill in their details and can log in immediately — no documents needed. Farmers upload their Ghana Card (or passport) for verification, which takes 2-3 working days.</>,
      },
      {
        q: "Why do farmers need a Ghana Card or passport?",
        a: <>Farmers are identity-verified before they can sell — this is what protects buyers from fraud. The ID is stored privately — only the farmer and the FarmLink admin can ever view it. Buyers don't upload any ID: their phone number is verified by SMS code at login, and every payment they make is held in escrow until delivery is confirmed.</>,
      },
      {
        q: "What is the Ghana Card number format?",
        a: <>Your card number looks like <strong>GHA-123456789-0</strong>. Type the digits and the field formats itself automatically. Make sure the number matches your card photo exactly — a mismatch leads to rejection.</>,
      },
      {
        q: "My registration was rejected. What do I do?",
        a: <>You receive an SMS explaining the decision. Re-register with a clear photo of your Ghana Card (or passport) and the correct number, or call support at <strong>0595726252</strong>.</>,
      },
      {
        q: "When can I log in after registering?",
        a: <>As soon as the admin approves your account you receive an SMS saying your account is active. Then you can log in with your phone number and password — a 6-digit code is SMSed to you each time.</>,
      },
      {
        q: "Can I change my name or password later?",
        a: <>Yes — in your Profile page. For your security, name and password changes are <strong>reviewed by the admin</strong> before they take effect. You keep using your current password until the change is approved.</>,
      },
    ],
  },
  {
    name: "Listing Products (Farmers)",
    items: [
      {
        q: "How do I list my produce?",
        a: <>Log in, open <strong>Market</strong> and tap <strong>List Produce</strong> (or use your Dashboard). Enter the product, quantity, price — the GH₵ sign appears automatically — region, town and up to 5 photos.</>,
      },
      {
        q: "What if my crop is not in the list?",
        a: <>Just type it. New products are added to the system automatically and appear in suggestions for every farmer afterwards.</>,
      },
      {
        q: "What is the farmer agreement I must accept?",
        a: <>Before registering you accept the platform terms: a <strong>5% commission</strong> on completed sales, payment released only after the buyer confirms delivery, and a 2-3 day payout window. If a buyer delays confirmation, call the admin at <strong>0595726252</strong> and we will contact them for you.</>,
      },
      {
        q: "How do buyers find my produce?",
        a: <>Buyers browsing the market see your listing with your location and price. Buyers who said they are &quot;looking for&quot; your product also receive an automatic SMS when you list it or when your price is the cheapest on the market.</>,
      },
      {
        q: "How do I get a good farmer rating?",
        a: <>After buyers receive their order they can rate you 1-5 stars. Deliver fresh produce on time and communicate clearly — your rating appears on your public farmer profile and helps you sell more.</>,
      },
    ],
  },
  {
    name: "Buying & Contacting Farmers",
    items: [
      {
        q: "How do I buy produce?",
        a: <>Open any listing and tap <strong>Buy Now</strong>. After payment the farmer is notified, and once you receive the goods you tap <strong>Confirm Delivery</strong> in your Orders page — that releases the farmer&apos;s payment.</>,
      },
      {
        q: "How do I contact a farmer?",
        a: <>You order and pay on FarmLink — the farmer is instantly SMSed your name, phone number, delivery address and GPS location, and calls you to arrange delivery. The farmer&apos;s direct number stays with FarmLink, which keeps every trade on the platform and your payments protected. If anything goes wrong, call support at 0595726252.</>,
      },
      {
        q: "What does a farmer's star rating mean?",
        a: <>Only buyers who <strong>completed an order</strong> with that farmer can rate them — so the stars reflect real transactions, not fake reviews. 5 stars means previous buyers were very satisfied.</>,
      },
      {
        q: "Why should I confirm delivery?",
        a: <>Confirming delivery starts your <strong>3-day refund window</strong> — inspect the produce, and if it falls short request a refund in that time. After 3 days without a claim the sale is final and the farmer is paid. Confirming honestly is what keeps farmers delivering good produce.</>,
      },
    ],
  },
  {
    name: "Payments",
    items: [
      {
        q: "How do payments work?",
        a: <>You pay for your order (mobile money or card). FarmLink holds the money in escrow. After you confirm delivery, the farmer is paid within 2-3 days — their payout is the sale price minus the 5% platform commission and the payment fee.</>,
      },
      {
        q: "What if I'm not satisfied with the product?",
        a: <>In your Orders page, tap <strong>Request Refund</strong>. After you confirm delivery you have <strong>3 days</strong> to request a refund — after that the sale is final and the farmer is paid. The admin reviews each case within 2-3 days and sends back <strong>the full amount you paid</strong> — the 5% commission is never deducted from your refund. <strong>If the farmer files a damage complaint</strong> (for example, goods you returned torn or spoiled after they left the farmer in good condition), the admin measures the damage and that value is <strong>subtracted from the refund</strong>. You receive an SMS stating the exact amount sent.</>,
      },
      {
        q: "Is my payment information safe?",
        a: <>Payments are processed by Paystack — a licensed payment provider. FarmLink never sees or stores your card or mobile money PIN.</>,
      },
    ],
  },
  {
    name: "Verification & Security",
    items: [
      {
        q: "Why do I receive an SMS code at login?",
        a: <>It is two-factor authentication: even if someone learns your password, they cannot enter your account without the code SMSed to your phone. The code is valid for 10 minutes and never expires silently — if it is slow, wait up to 5 minutes before requesting another (requesting again cancels the previous code).</>,
      },
      {
        q: "I think my account has been hacked. What do I do?",
        a: <>1) <Link href="/report" className="text-[#1b5e20] font-semibold underline">File a report</Link> selecting <strong>Hacked Account</strong> immediately — the admin is alerted instantly. 2) Request a password change from your Profile page (the admin approves it and the attacker&apos;s access ends). 3) Call <strong>0595726252</strong> if you need urgent help.</>,
      },
      {
        q: "How do you protect my Ghana Card photo?",
        a: <>ID documents are stored privately in our database. Only you (when logged in) and the verifying admin can view them — nobody else, ever. They are never shown on your profile or listings.</>,
      },
      {
        q: "Why did I get an SMS about a price drop?",
        a: <>You told us which crops you are &quot;looking for&quot; at registration. When one of those crops is newly listed or gets cheaper, we SMS you so you can log in and buy. You can change your &quot;Looking For&quot; list anytime in your Profile.</>,
      },
    ],
  },
  {
    name: "How FarmLink Works",
    items: [
      {
        q: "What is FarmLink?",
        a: <>FarmLink connects Ghanaian farmers directly with buyers — no middlemen. Farmers list produce with real prices; buyers search, contact and order with confidence because every member is ID-verified and payments are escrow-protected.</>,
      },
      {
        q: "What does FarmLink charge?",
        a: <>A <strong>5% commission</strong> on each completed sale (plus the payment processor&apos;s fee). Registration, browsing and contacting farmers are free.</>,
      },
      {
        q: "Who runs FarmLink?",
        a: <>FarmLink Ghana is operated by RAMEDIC Consultancy &amp; Creative Ltd. Support: <strong>0595726252</strong> · <strong>info.rametechconsultancy@gmail.com</strong>.</>,
      },
    ],
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<string | null>(null);
  const key = (c: number, i: number) => `${c}-${i}`;

  return (
    <div className="min-h-screen bg-[#f8faf7]">
      <SiteHeader  />

      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-extrabold text-[#1b5e20] mb-2">Frequently Asked Questions</h1>
        <p className="text-gray-500 mb-8">Answers to common questions about FarmLink — registration, listing, payments, verification and staying safe.</p>

        {CATEGORIES.map((cat, ci) => (
          <div key={cat.name} className="mb-8">
            <h2 className="text-lg font-bold text-[#1b5e20] mb-3">{cat.name}</h2>
            <div className="space-y-2">
              {cat.items.map((item, ii) => {
                const k = key(ci, ii);
                const isOpen = open === k;
                return (
                  <div key={k} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <button
                      onClick={() => setOpen(isOpen ? null : k)}
                      className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
                    >
                      <span className="font-semibold text-gray-800 text-sm md:text-base">{item.q}</span>
                      <span className={`text-[#1b5e20] font-bold text-lg shrink-0 transition-transform ${isOpen ? "rotate-45" : ""}`}>+</span>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 text-sm text-gray-600 leading-relaxed">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="bg-[#e8f5e9] rounded-2xl p-6 text-center mt-4">
          <p className="font-semibold text-[#1b5e20] mb-1">Still have a question?</p>
          <p className="text-sm text-gray-600 mb-4">Our support team replies within 24 hours.</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/support" className="px-6 py-2.5 rounded-full bg-[#1b5e20] text-white font-semibold text-sm hover:bg-[#0d3818]">Contact Support</Link>
            <Link href="/report" className="px-6 py-2.5 rounded-full border-2 border-[#1b5e20] text-[#1b5e20] font-semibold text-sm hover:bg-white">Report a Problem</Link>
          </div>
        </div>
      </div>
      <SiteFooter dark={false} />
    </div>
  );
}