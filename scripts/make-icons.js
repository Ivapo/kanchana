// Generates icon PNGs (192, 512, and apple-touch 180) from a pure-JS encoder.
// Why hand-rolled? We need PNG icons for the manifest and iOS home screen,
// but we don't want to add image-processing deps for what is essentially a
// solid-color radial-gradient disc. Bun ships zlib (DEFLATE), so we can emit
// valid PNGs directly. Run with: bun run icons
//
// @capability: pwa-install
// @verifies: VER-06

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const OUT = new URL("../icons/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

function lerp(a, b, t) { return a + (b - a) * t; }
function mix(c1, c2, t) {
  return [Math.round(lerp(c1[0], c2[0], t)), Math.round(lerp(c1[1], c2[1], t)), Math.round(lerp(c1[2], c2[2], t))];
}

// Same gradient stops as icon.svg, sampled per pixel by radial distance.
const STOPS = [
  { pos: 0.00, col: [0xFF, 0xE8, 0xB6] },
  { pos: 0.35, col: [0xFF, 0xB4, 0x6B] },
  { pos: 0.75, col: [0x7A, 0x3A, 0x18] },
  { pos: 1.00, col: [0x0F, 0x12, 0x20] },
];
function sampleGradient(t) {
  if (t <= STOPS[0].pos) return STOPS[0].col;
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i].pos) {
      const a = STOPS[i - 1], b = STOPS[i];
      return mix(a.col, b.col, (t - a.pos) / (b.pos - a.pos));
    }
  }
  return STOPS[STOPS.length - 1].col;
}

function renderRGBA(size, { corner = 0.19 } = {}) {
  const buf = new Uint8Array(size * size * 4);
  const cx = size / 2, cy = size * 0.49;
  const r = size * 0.78 / 2; // disc radius extent (matches SVG visual)
  const bg = [0x0F, 0x12, 0x20];
  const cornerR = size * corner;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.hypot(dx, dy);
      const t = Math.min(1, dist / r);
      const c = sampleGradient(t);
      // Rounded-rect mask: outside corner → background.
      const ox = x < cornerR ? cornerR - x : x > size - cornerR ? x - (size - cornerR) : 0;
      const oy = y < cornerR ? cornerR - y : y > size - cornerR ? y - (size - cornerR) : 0;
      const outside = ox > 0 && oy > 0 && Math.hypot(ox, oy) > cornerR;
      const out = outside ? bg : c;
      const i = (y * size + x) * 4;
      buf[i] = out[0]; buf[i + 1] = out[1]; buf[i + 2] = out[2]; buf[i + 3] = 0xFF;
    }
  }
  return buf;
}

// Minimal PNG encoder (truecolor + alpha, no interlace).
function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    crc32.table = table;
  }
  c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = (table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)) >>> 0;
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const out = new Uint8Array(8 + data.length + 4);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set([type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3)], 4);
  out.set(data, 8);
  const crcInput = out.subarray(4, 8 + data.length);
  dv.setUint32(8 + data.length, crc32(crcInput));
  return out;
}
function encodePNG(rgba, w, h) {
  // Add per-row filter byte (0 = None).
  const raw = new Uint8Array(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
  }
  const idatData = deflateSync(Buffer.from(raw));
  const sig = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = new Uint8Array(13);
  new DataView(ihdr.buffer).setUint32(0, w);
  new DataView(ihdr.buffer).setUint32(4, h);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type (RGBA)
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const parts = [sig, chunk("IHDR", ihdr), chunk("IDAT", idatData), chunk("IEND", new Uint8Array())];
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

const targets = [
  { name: "icon-192.png",        size: 192 },
  { name: "icon-512.png",        size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];
for (const t of targets) {
  const rgba = renderRGBA(t.size);
  const png = encodePNG(rgba, t.size, t.size);
  writeFileSync(join(OUT, t.name), png);
  console.log(`wrote ${t.name} (${t.size}x${t.size}, ${png.length} bytes)`);
}
