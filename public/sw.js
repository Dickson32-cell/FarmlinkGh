// FarmLink service worker — hand-rolled for Next.js 16 (Turbopack).
// Strategy:
//   - App shell + pages: NetworkFirst (fresh when online, cached copy when offline)
//   - Static assets (_next/static, images): CacheFirst (fast repeat loads)
//   - NEVER cache /api/* — orders, payments and auth must always hit the server
const VERSION = "farmlink-v1";
const SHELL_CACHE = `${VERSION}-pages`;
const ASSET_CACHE = `${VERSION}-assets`;

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // API: always live — money and auth must never come from a cache
  if (url.pathname.startsWith("/api/")) return;

  // Static build assets + images: CacheFirst
  if (url.pathname.startsWith("/_next/static/") || /\.(png|jpg|jpeg|svg|gif|webp|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        try {
          const res = await fetch(request);
          if (res.ok) cache.put(request, res.clone());
          return res;
        } catch {
          return hit || Response.error();
        }
      })
    );
    return;
  }

  // Pages: NetworkFirst with offline fallback
  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      } catch {
        const cached = await cache.match(request, { ignoreSearch: true });
        if (cached) return cached;
        if (request.mode === "navigate") {
          return new Response(
            `<!doctype html><html><head><meta charset="utf-8"><title>FarmLink — Offline</title>` +
            `<meta name="viewport" content="width=device-width, initial-scale=1">` +
            `<style>body{font-family:system-ui;background:#1b5e20;color:#fff;display:flex;min-height:100vh;` +
            `align-items:center;justify-content:center;margin:0}div{text-align:center;padding:2rem;max-width:24rem}` +
            `h1{font-size:1.4rem;margin:0 0 .5rem}p{color:#c8e6c9;font-size:.9rem;line-height:1.5}</style></head>` +
            `<body><div><h1>You are offline</h1><p>FarmLink needs a connection to show live market prices and listings.` +
            ` Your saved pages will reload once you are back online.</p></div></body></html>`,
            { headers: { "Content-Type": "text/html" } }
          );
        }
        return Response.error();
      }
    })()
  );
});