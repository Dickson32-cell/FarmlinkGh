import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Clickjacking: never allow this site in a frame
          { key: "X-Frame-Options", value: "DENY" },
          // Stop browsers guessing (executing) non-script content as scripts
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Force HTTPS for 2 years (incl. subdomains) — safe: the whole app is HTTPS
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          // Sensible referrer privacy: full URL same-origin, origin-only cross-origin
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Block old browsers' XSS heuristics auditor (better handled by CSP)
          { key: "X-XSS-Protection", value: "0" },
        ],
      },
      {
        // Ghana cards + ID documents are served from here — never cache them in shared caches
        source: "/api/files/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;