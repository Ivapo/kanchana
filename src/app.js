// Kanchana main app wiring. Pure logic lives in color.js; this file is the
// "glue" between DOM controls and that logic.
//
// @capability: app-bootstrap
// @verifies: VER-01

import {
  kelvinToRGB,
  applyBrightness,
  rgbToCss,
  PRESETS,
  KELVIN_MIN,
  KELVIN_MAX,
} from "./color.js";
import { createWakeLock } from "./wakelock.js";
import { createAutoHider } from "./ui.js";

const STORAGE_KEY = "kanchana.state.v1";

const surface = document.getElementById("surface");
const panel   = document.getElementById("panel");
const warmth  = document.getElementById("warmth");
const bright  = document.getElementById("brightness");
const warmthLabel = document.getElementById("warmth-label");
const brightLabel = document.getElementById("brightness-label");
const presetButtons = document.querySelectorAll("[data-preset]");
const wakeToggle = document.getElementById("wake-toggle");
const wakeStatus = document.getElementById("wake-status");

// Restore last session, or fall back to a pleasant warm default. We persist
// so the lamp opens in the same state the user left it — a real lamp does.
const initial = loadState() ?? { kelvin: PRESETS.warm.kelvin, brightness: PRESETS.warm.brightness };

warmth.min = String(1800);   // hard floor for the visible UI range (candle)
warmth.max = String(6500);   // ceiling (cool daylight)
warmth.step = "50";
warmth.value = String(clamp(initial.kelvin, Number(warmth.min), Number(warmth.max)));

bright.min = "0";
bright.max = "100";
bright.step = "1";
bright.value = String(Math.round(initial.brightness * 100));

// @capability: surface-color
// @verifies: VER-01
function render() {
  const k = Number(warmth.value);
  const b = Number(bright.value) / 100;
  const dimmed = applyBrightness(kelvinToRGB(k), b);
  surface.style.backgroundColor = rgbToCss(dimmed);
  warmthLabel.textContent = `${k} K`;
  brightLabel.textContent = `${Math.round(b * 100)}%`;
  saveState({ kelvin: k, brightness: b });
}

warmth.addEventListener("input", render);
bright.addEventListener("input", render);

// @capability: presets
// @verifies: VER-04
for (const btn of presetButtons) {
  btn.addEventListener("click", () => {
    const p = PRESETS[btn.dataset.preset];
    if (!p) return;
    warmth.value = String(p.kelvin);
    bright.value = String(Math.round(p.brightness * 100));
    render();
  });
}

// Auto-hide. The surface is the tap target; the panel is the controls.
// @capability: controls-autohide
// @verifies: VER-07
const hider = createAutoHider(panel, { idleMs: 3500 });
hider.attach(surface);

// Wake lock.
// @capability: wake-lock
// @verifies: VER-05
const wake = createWakeLock((msg) => { wakeStatus.textContent = msg; });
if (!wake.supported) {
  wakeToggle.disabled = true;
  wakeStatus.textContent = "Wake Lock unsupported on this browser";
}
wakeToggle.addEventListener("change", async () => {
  if (wakeToggle.checked) await wake.enable();
  else await wake.disable();
});

// Service worker registration. We only register in https/localhost contexts
// (browsers reject SW over plain http on a LAN IP). Failing silently is fine
// in dev — the app still works, it just won't be offline-installable until
// you serve it over https or open via localhost.
// @capability: pwa-install
// @verifies: VER-06
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // Relative path so registration works under a Pages project subpath; the
    // SW's scope defaults to its containing directory, which is what we want.
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.warn("SW registration failed:", err);
    });
  });
}

render();

function clamp(n, lo, hi) { return n < lo ? lo : n > hi ? hi : n; }

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.kelvin !== "number" || typeof parsed?.brightness !== "number") return null;
    return parsed;
  } catch { return null; }
}
function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* quota or private mode */ }
}

// Re-export the public Kelvin range so a curious developer can grep for it.
export { KELVIN_MIN, KELVIN_MAX };
