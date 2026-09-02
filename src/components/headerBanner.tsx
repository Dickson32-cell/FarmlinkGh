"use client";
import { useEffect, useState } from "react";

// Landscape image the admin uploads — shows behind the green logged-in
// header bar (behind the logo, user name and the colored nav buttons).
// Falls back to the solid green bar when no image is set.
let cached: string | null = null;
let fetchStarted = false;

export default function HeaderBanner() {
  const [img, setImg] = useState<string>(cached || "");
  useEffect(() => {
    if (fetchStarted) return;
    fetchStarted = true;
    fetch("/api/settings?key=headerImage")
      .then((r) => r.json())
      .then((d) => {
        cached = (d?.value as string) || "";
        setImg(cached);
      })
      .catch(() => {});
  }, []);
  if (!img) return null;
  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: `url(${img})` }}
      />
      <div aria-hidden className="absolute inset-0 bg-[#0d3818]/70 pointer-events-none" />
    </>
  );
}