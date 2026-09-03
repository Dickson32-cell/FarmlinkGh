"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import HeaderBanner from "@/components/headerBanner";
import NotificationBell from "@/components/notificationBell";

// Unified responsive header — every page uses this.
// Desktop/tablet (md+): logo + full colored nav bar.
// Mobile (<md): logo + bell + hamburger; nav slides down as a panel.
//
// Same color identity as before:
//   Market orange · Prices blue · Profile/Wishlist purple · Orders gold
// (the colors users already know), with role-aware links.

export interface HeaderLink {
  href: string;
  label: string;
  color?: "orange" | "blue" | "purple" | "gold" | "neutral";
}

const colorClasses: Record<string, string> = {
  orange: "bg-[#ef6c00] hover:bg-[#e65100] text-white",
  blue: "bg-[#1565c0] hover:bg-[#0d47a1] text-white",
  purple: "bg-[#7b1fa2] hover:bg-[#6a1b9a] text-white",
  gold: "bg-[#f9a825] hover:bg-[#f57f17] text-[#3e2723]",
  neutral: "bg-white/15 hover:bg-white/25 text-white",
};

function linksForRole(role: string | undefined): HeaderLink[] {
  if (role === "admin") {
    return [
      { href: "/admin", label: "Admin Panel", color: "orange" },
      { href: "/", label: "Home", color: "neutral" },
    ];
  }
  if (role === "farmer") {
    return [
      { href: "/orders", label: "Orders to Deliver", color: "gold" },
      { href: "/prices", label: "Prices", color: "blue" },
      { href: "/profile", label: "Profile", color: "purple" },
      { href: "/dashboard", label: "Dashboard", color: "neutral" },
    ];
  }
  if (role === "buyer") {
    return [
      { href: "/market", label: "Market", color: "orange" },
      { href: "/wishlist", label: "Wishlist", color: "purple" },
      { href: "/orders", label: "My Orders", color: "gold" },
      { href: "/prices", label: "Prices", color: "blue" },
      { href: "/profile", label: "Profile", color: "purple" },
      { href: "/dashboard", label: "Dashboard", color: "neutral" },
    ];
  }
  // anonymous / public pages
  return [
    { href: "/", label: "Home", color: "neutral" },
    { href: "/faq", label: "FAQ", color: "neutral" },
    { href: "/support", label: "Support", color: "neutral" },
  ];
}

export default function SiteHeader({
  title,
  user,
  links,
  hideBell,
}: {
  title?: string;
  user?: { role?: string; name?: string } | null;
  links?: HeaderLink[];
  hideBell?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const nav = links || linksForRole(user?.role);
  const showBell = !hideBell && !!user;

  // Logout: clears the session cookie and returns to the homepage.
  // One button here serves EVERY logged-in page (desktop bar + mobile menu).
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  return (
    <header className="bg-[#1b5e20] text-white sticky top-0 z-50 shadow-md">
      <HeaderBanner />
      <div className="px-3 md:px-6 py-2.5 md:py-3 flex items-center justify-between gap-2">
        {/* Logo + page label */}
        <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2 min-w-0 shrink">
          <img src="/logo.jpg" alt="FarmLink" className="w-8 h-8 md:w-9 md:h-9 rounded-full ring-2 ring-white/30 shrink-0" />
          <span className="text-lg md:text-xl font-bold truncate">
            FarmLink {title ? <span className="opacity-70 text-xs md:text-sm font-normal">{title}</span> : <span className="opacity-70 text-xs md:text-sm font-normal hidden sm:inline">Ghana</span>}
          </span>
        </Link>

        {/* Desktop nav (md and up) */}
        <nav className="hidden md:flex items-center gap-2 flex-wrap justify-end">
          {showBell && <NotificationBell />}
          {nav.map((l) => (
            <Link key={l.href + l.label} href={l.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm transition-colors ${colorClasses[l.color || "neutral"]}`}>
              {l.label}
            </Link>
          ))}
          {user && (
            <button
              type="button"
              onClick={logout}
              title={`Sign out${user?.name ? ` (${user.name})` : ""}`}
              className="ml-1 px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm transition-colors bg-red-700 hover:bg-red-800 text-white"
            >
              Logout
            </button>
          )}
        </nav>

        {/* Mobile: bell + hamburger */}
        <div className="flex md:hidden items-center gap-1.5 shrink-0">
          {showBell && <NotificationBell />}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 transition-colors"
          >
            {open ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="5" y1="5" x2="19" y2="19" /><line x1="19" y1="5" x2="5" y2="19" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile slide-down menu */}
      {open && (
        <nav className="md:hidden border-t border-white/10 bg-[#0d3818]">
          <div className="px-3 py-3 flex flex-col gap-1.5">
            {user?.name && (
              <div className="px-3 py-2 text-xs uppercase tracking-wide text-white/50">Signed in as {user.name}</div>
            )}
            {nav.map((l) => (
              <Link key={l.href + l.label} href={l.href} onClick={() => setOpen(false)}
                className={`px-4 py-3 rounded-lg text-sm font-semibold shadow-sm transition-colors ${colorClasses[l.color || "neutral"]}`}>
                {l.label}
              </Link>
            ))}
            {user && (
              <button
                type="button"
                onClick={() => { setOpen(false); logout(); }}
                className="px-4 py-3 rounded-lg text-sm font-semibold shadow-sm transition-colors bg-red-700 hover:bg-red-800 text-white text-left"
              >
                Logout{user?.name ? ` — ${user.name}` : ""}
              </button>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}