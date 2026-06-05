// Service worker sanity checks. We can't run the SW in `bun test` (no
// ServiceWorkerGlobalScope), but we CAN statically verify that the
// precache list matches the files we actually ship — a common foot-gun
// is shipping a SW that 404s during install.
//
// @capability: offline-cache
// @verifies: VER-06

import { describe, test, expect } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("VER-06 service worker precache integrity", () => {
  test("every PRECACHE entry exists on disk", () => {
    const src = readFileSync(join(ROOT, "sw.js"), "utf8");
    // Extract URLs from the PRECACHE array via a tolerant regex.
    const block = src.match(/PRECACHE\s*=\s*\[([\s\S]*?)\]/);
    expect(block).not.toBeNull();
    const urls = [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(0);

    for (const u of urls) {
      // Strip leading "./" or "/" — both forms alias the project root.
      const cleaned = u.replace(/^(\.\/|\/)/, "");
      if (cleaned === "" || cleaned === ".") continue; // root alias for /index.html
      const path = join(ROOT, cleaned);
      expect(existsSync(path), `missing precache asset: ${u}`).toBe(true);
    }
  });

  test("CACHE_VERSION is declared", () => {
    const src = readFileSync(join(ROOT, "sw.js"), "utf8");
    expect(src).toMatch(/CACHE_VERSION\s*=\s*"kanchana-v\d+"/);
  });
});

describe("VER-06 manifest is valid JSON with required fields", () => {
  test("parses and has name + start_url + display + icons", () => {
    const m = JSON.parse(readFileSync(join(ROOT, "manifest.webmanifest"), "utf8"));
    expect(m.name).toBe("Kanchana");
    // Relative start_url so a project-page deployment (under /kanchana/)
    // resolves it against the manifest URL, not the domain root.
    expect(m.start_url).toBe("./");
    // fullscreen removes the installed-PWA title bar on desktop browsers;
    // browsers that don't support it fall back through display_override.
    expect(m.display).toBe("fullscreen");
    expect(m.display_override).toEqual(["fullscreen", "standalone"]);
    expect(Array.isArray(m.icons)).toBe(true);
    expect(m.icons.length).toBeGreaterThanOrEqual(2);
    for (const icon of m.icons) {
      expect(typeof icon.src).toBe("string");
      const path = join(ROOT, icon.src.replace(/^(\.\/|\/)/, ""));
      expect(existsSync(path), `missing manifest icon: ${icon.src}`).toBe(true);
    }
  });
});
