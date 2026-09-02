import Link from "next/link";

// Shared site footer — appears on every page so Support / FAQ / Report
// are always one tap away.
export default function SiteFooter({ dark = true }: { dark?: boolean }) {
  const base = dark
    ? "bg-[#0d3818] text-white"
    : "bg-white text-gray-600 border-t border-gray-100";
  return (
    <footer className={`${base} py-8 px-6`}>
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="text-lg font-bold flex items-center gap-2">
            <img src="/logo.jpg" alt="FarmLink" className="w-8 h-8 rounded-full" />
            FarmLink Ghana
          </div>
          <div className="flex gap-5 text-sm font-medium flex-wrap">
            <Link href="/support" className="hover:underline opacity-90 hover:opacity-100">Support</Link>
            <Link href="/faq" className="hover:underline opacity-90 hover:opacity-100">FAQ</Link>
            <Link href="/report" className="hover:underline opacity-90 hover:opacity-100">Report a Problem</Link>
          </div>
        </div>
        <div className="text-xs opacity-70 space-y-1">
          <div>Support: 0595726252 · info.rametechconsultancy@gmail.com</div>
          <div>framlinkgh.vercel.app</div>
          <div>FarmLink Ghana © 2026 — Connecting farmers with buyers</div>
        </div>
      </div>
    </footer>
  );
}