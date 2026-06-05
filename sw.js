// Kanchana service worker.
//
// @capability: offline-cache
// @verifies: VER-06
//
// Strategy: precache the small fixed asset list on install, serve cache-first
// at fetch time, fall back to network and update the cache opportunistically.
// We bump CACHE_VERSION whenever any cached file changes; old caches are
// cleared on activate so users do not get stale code after a deploy.
//
// Paths are RELATIVE (./foo) so the same SW works both at the dev server
// root and under a GitHub Pages project subpath (/kanchana/). The Cache API
// resolves relative URLs against the SW's own URL, which is exactly the
// scope we want to cache.

const CACHE_VERSION = "kanchana-v1";
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./styles/main.css",
  "./src/app.js",
  "./src/color.js",
  "./src/ui.js",
  "./src/wakelock.js",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

// Resolve a relative URL against the SW's location once, up front.
const OFFLINE_FALLBACK = new URL("./index.html", self.location).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // addAll is atomic — if any single asset 404s the SW install fails and
      // we keep the previous SW. That's intentional: a broken precache is
      // worse than no install.
      cache.addAll(PRECACHE)
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Refresh in the background so the next load gets the new file.
        event.waitUntil(refresh(req));
        return cached;
      }
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(OFFLINE_FALLBACK));
    })
  );
});

async function refresh(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(CACHE_VERSION);
      await cache.put(req, res.clone());
    }
  } catch { /* offline — ignore */ }
}
