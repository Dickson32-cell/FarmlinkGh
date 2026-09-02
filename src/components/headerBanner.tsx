"use client";
import { useEffect, useState } from "react";

// Slideshow of landscape images the admin uploads — crossfades behind the
// green logged-in header bar (behind the logo, user name and colored nav
// buttons). Falls back to the solid green bar when no images are set.
// The setting value is a JSON array of URLs (or a single URL string, legacy).
const SLIDE_MS = 5000;

function parseImages(value: unknown): string[] {
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      const arr = JSON.parse(value);
      if (Array.isArray(arr)) return arr.filter((v) => typeof v === "string" && v);
    } catch { /* fall through */ }
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

export default function HeaderBanner() {
  const [images, setImages] = useState<string[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch("/api/settings?key=headerImage")
      .then((r) => r.json())
      .then((d) => {
        if (alive) setImages(parseImages((d as any)?.value));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (images.length < 2) return;
    const t = setInterval(() => {
      setCurrent((c) => (c + 1) % images.length);
    }, SLIDE_MS);
    return () => clearInterval(t);
  }, [images]);

  if (images.length === 0) return null;
  // clamp — if slides were removed, current may point past the end
  const active = Math.min(current, images.length - 1);

  return (
    <>
      {/* Every layer is -z-10: the banner paints BEHIND the header content
          (logo, name, buttons) but above the header's green background.
          All slides render stacked; the visible one fades in via opacity. */}
      <div aria-hidden className="absolute inset-0 pointer-events-none -z-10">
        {images.map((img, i) => (
          <div
            key={img}
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
            style={{ backgroundImage: `url(${img})`, opacity: i === active ? 1 : 0 }}
          />
        ))}
      </div>
      <div aria-hidden className="absolute inset-0 bg-[#0d3818]/70 pointer-events-none -z-10" />
    </>
  );
}