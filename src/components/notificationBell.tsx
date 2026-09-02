"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

// Header notification bell — polls the unread count every 30s and shows a
// red badge. Renders nothing when the user is not logged in.
export default function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = () => {
      fetch("/api/notifications?count=1")
        .then((r) => (r.status === 401 ? null : r.json()))
        .then((d) => {
          if (!mounted) return;
          if (d && typeof d.unread === "number") {
            setUnread(d.unread);
            setVisible(true);
          } else {
            setVisible(false);
          }
        })
        .catch(() => {});
    };

    load();
    const timer = setInterval(load, 30000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  if (!visible) return null;

  return (
    <Link
      href="/notifications"
      aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
      className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/15 hover:bg-white/25 transition-colors"
      title="Notifications"
    >
      {/* bell icon (inline SVG — no emoji) */}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}