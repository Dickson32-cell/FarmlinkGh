import type { MetadataRoute } from "next";

// Sitemap for Google — the pages worth indexing.
// Authenticated/admin areas are excluded (robots.txt also blocks them).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.farmlinkgh.app";
  const now = new Date();

  return [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${base}/market`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/prices`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/support`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/report`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}