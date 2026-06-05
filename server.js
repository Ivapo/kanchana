// Kanchana dev server.
// @capability: dev-server
// @verifies: VER-13
//
// Why a hand-rolled server instead of `bun --hot`?
// We need to serve a real PWA: a root index.html, a same-origin service worker
// (sw.js) with the right Content-Type, and a webmanifest. Bun.serve() is the
// smallest dependency-free way to do that with correct MIME types. It also
// lets the dev experience match production: same paths, same caching story.

import { file } from "bun";
import { extname, join, normalize, resolve } from "node:path";

const ROOT = resolve(import.meta.dir);
const PORT = Number(process.env.PORT ?? 5173);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".mjs":  "text/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".ico":  "image/x-icon",
  ".txt":  "text/plain; charset=utf-8",
  ".md":   "text/markdown; charset=utf-8",
};

function safeResolve(urlPath) {
  // Prevent path traversal: normalize and ensure result stays under ROOT.
  const clean = normalize(decodeURIComponent(urlPath)).replace(/^\/+/, "");
  const full = resolve(join(ROOT, clean));
  if (!full.startsWith(ROOT)) return null;
  return full;
}

const server = Bun.serve({
  port: PORT,
  development: true,
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname === "/" ? "/index.html" : url.pathname;
    const full = safeResolve(path);
    if (!full) return new Response("forbidden", { status: 403 });

    const f = file(full);
    if (!(await f.exists())) {
      return new Response("not found", { status: 404 });
    }
    const ext = extname(full).toLowerCase();
    const headers = new Headers({
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      // Make service-worker iteration painless in dev.
      "Cache-Control": "no-store",
    });
    // Service workers must be served same-origin; nothing special needed beyond CT.
    return new Response(f, { headers });
  },
});

console.log(`Kanchana dev server: http://localhost:${server.port}`);
console.log(`Open on iPad: http://<your-mac-LAN-ip>:${server.port}`);
