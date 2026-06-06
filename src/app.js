// Kanchana main app wiring. Pure logic lives in color.js, slots.js, fade.js,
// and flicker.js; this file is the "glue" between DOM controls and that logic.
//
// Animation source-of-truth: when the timer or candle-flicker is active, the
// surface color comes from that source — sliders still exist but their value
// is treated as the *base* that the animation orbits, not the live color. On
// stop, control returns to the sliders. This keeps each module a pure driver
// rather than a special case in render().
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
import {
  setSlot,
  removeSlot,
  getSlot,
  listSlots,
  isValidSlotName,
} from "./slots.js";
import { fadeCurve, FADE_MODE } from "./fade.js";
import { flickerStep, makeRng } from "./flicker.js";

const STORAGE_KEY = "kanchana.state.v1";
const SLOTS_KEY   = "kanchana.slots.v1";

const surface = document.getElementById("surface");
const panel   = document.getElementById("panel");
const warmth  = document.getElementById("warmth");
const bright  = document.getElementById("brightness");
const warmthLabel = document.getElementById("warmth-label");
const brightLabel = document.getElementById("brightness-label");
const presetButtons = document.querySelectorAll("[data-preset]");
const wakeToggle = document.getElementById("wake-toggle");
const wakeStatus = document.getElementById("wake-status");
const slotName   = document.getElementById("slot-name");
const slotSave   = document.getElementById("slot-save");
const slotList   = document.getElementById("slot-list");
const timerMin   = document.getElementById("timer-minutes");
const timerFade  = document.getElementById("timer-fade");
const timerOut   = document.getElementById("timer-out");
const timerIn    = document.getElementById("timer-in");
const timerCancel = document.getElementById("timer-cancel");
const timerStatus = document.getElementById("timer-status");
const flickerToggle = document.getElementById("flicker-toggle");
const flickerStatus = document.getElementById("flicker-status");

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

// Active animation source. When non-null, render() uses these numbers and
// suppresses the slider→storage save (so a fade-out doesn't overwrite the
// user's saved "evening" brightness with 3% on the way down).
let liveOverride = null;     // { kelvin, brightness } | null
let timerHandle = null;      // setInterval id for fade
let flickerHandle = null;    // setInterval id for flicker
let flickerState = null;     // mutable state for the flicker step

// Paint helper. Driven from sliders by default, or from liveOverride when an
// animation owns the surface.
//
// @capability: surface-color
// @verifies: VER-01
function render() {
  const k = liveOverride ? liveOverride.kelvin     : Number(warmth.value);
  const b = liveOverride ? liveOverride.brightness : Number(bright.value) / 100;
  const dimmed = applyBrightness(kelvinToRGB(k), b);
  surface.style.backgroundColor = rgbToCss(dimmed);
  warmthLabel.textContent = `${Math.round(k)} K`;
  brightLabel.textContent = `${Math.round(b * 100)}%`;
  // Persist slider state, never override-driven state — see liveOverride note.
  if (!liveOverride) saveState({ kelvin: k, brightness: b });
}

warmth.addEventListener("input", () => {
  // Touching a slider while an animation runs cancels the animation — the
  // user clearly wants direct control back.
  if (liveOverride) cancelAnimations("slider override");
  render();
});
bright.addEventListener("input", () => {
  if (liveOverride) cancelAnimations("slider override");
  render();
});

// @capability: presets
// @verifies: VER-04
for (const btn of presetButtons) {
  btn.addEventListener("click", () => {
    const p = PRESETS[btn.dataset.preset];
    if (!p) return;
    if (liveOverride) cancelAnimations("preset chosen");
    warmth.value = String(p.kelvin);
    bright.value = String(Math.round(p.brightness * 100));
    render();
  });
}

// --- Custom slots (VER-08) -------------------------------------------------
//
// The pure save/recall/delete logic is in slots.js. This block is DOM glue:
// load the map, mutate via the pure functions, persist, re-render the list.
//
// @capability: custom-slots
// @verifies: VER-08
let slots = loadSlots();
renderSlotList();

slotSave.addEventListener("click", () => {
  const name = slotName.value;
  if (!isValidSlotName(name)) {
    slotName.focus();
    return;
  }
  const value = { kelvin: Number(warmth.value), brightness: Number(bright.value) / 100 };
  slots = setSlot(slots, name, value);
  saveSlots(slots);
  slotName.value = "";
  renderSlotList();
});

slotName.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); slotSave.click(); }
});

function renderSlotList() {
  slotList.innerHTML = "";
  for (const s of listSlots(slots)) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "slot-chip";
    chip.dataset.slotName = s.name;
    chip.textContent = `${s.name} · ${s.kelvin}K · ${Math.round(s.brightness * 100)}%`;
    chip.addEventListener("click", () => {
      const got = getSlot(slots, s.name);
      if (!got) return;
      if (liveOverride) cancelAnimations("slot recalled");
      warmth.value = String(clamp(got.kelvin, Number(warmth.min), Number(warmth.max)));
      bright.value = String(Math.round(got.brightness * 100));
      render();
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "slot-del";
    del.setAttribute("aria-label", `Delete slot ${s.name}`);
    del.textContent = "×";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      slots = removeSlot(slots, s.name);
      saveSlots(slots);
      renderSlotList();
    });

    const wrap = document.createElement("span");
    wrap.className = "slot-wrap";
    wrap.append(chip, del);
    slotList.append(wrap);
  }
}

// --- Timer with fade (VER-09) ----------------------------------------------
//
// Pure curve is in fade.js. Loop runs at TIMER_TICK ms — a hair under one
// frame — which is plenty for a 1-minute-plus fade and cheap on battery.
//
// @capability: timer-fade
// @verifies: VER-09
const TIMER_TICK_MS = 250;

function startTimer(mode) {
  cancelAnimations("timer restart");
  const minutes = clamp(Number(timerMin.value), 1, 180);
  const fadeMin = clamp(Number(timerFade.value), 0, minutes);
  const totalMs = minutes * 60_000;
  const fadeMs  = fadeMin * 60_000;
  const targetK = Number(warmth.value);
  const targetB = Number(bright.value) / 100;
  const startedAt = performance.now();

  liveOverride = { kelvin: targetK, brightness: mode === FADE_MODE.IN ? 0 : targetB };
  render();

  timerCancel.disabled = false;
  timerOut.disabled = true;
  timerIn.disabled = true;
  timerStatus.textContent = mode === FADE_MODE.IN ? "sunrise…" : "fading…";

  timerHandle = setInterval(() => {
    const elapsed = performance.now() - startedAt;
    const b = fadeCurve(elapsed, totalMs, fadeMs, targetB, mode);
    liveOverride = { kelvin: targetK, brightness: b };
    render();
    if (elapsed >= totalMs) {
      // Hold the end-state for the OUT case (lamp off); for IN, hand control
      // back to the sliders at full target.
      if (mode === FADE_MODE.IN) cancelAnimations("sunrise complete");
      else stopTimer("done");
    }
  }, TIMER_TICK_MS);
}

function stopTimer(reason) {
  if (timerHandle) {
    clearInterval(timerHandle);
    timerHandle = null;
  }
  timerCancel.disabled = true;
  timerOut.disabled = false;
  timerIn.disabled = false;
  timerStatus.textContent = reason ?? "";
}

timerOut.addEventListener("click", () => startTimer(FADE_MODE.OUT));
timerIn.addEventListener("click",  () => startTimer(FADE_MODE.IN));
timerCancel.addEventListener("click", () => cancelAnimations("timer cancelled"));

// --- Candle flicker (VER-10) -----------------------------------------------
//
// Pure step is in flicker.js. We tick at FLICKER_TICK_MS — slow enough to
// feel candle-like, fast enough not to look stuttery.
//
// @capability: candle-flicker
// @verifies: VER-10
const FLICKER_TICK_MS = 90;

function startFlicker() {
  cancelAnimations("flicker restart");
  const base = { kelvin: Number(warmth.value), brightness: Number(bright.value) / 100 };
  flickerState = { base, current: { ...base } };
  // Seed from the current millisecond — non-deterministic in the wild is fine;
  // the *step* is what we verify deterministically in tests.
  const rng = makeRng(performance.now() >>> 0 || 1);
  liveOverride = { ...base };
  render();
  flickerStatus.textContent = "flickering…";
  flickerHandle = setInterval(() => {
    flickerState = flickerStep(flickerState, rng);
    liveOverride = { ...flickerState.current };
    render();
  }, FLICKER_TICK_MS);
}

function stopFlicker() {
  if (flickerHandle) {
    clearInterval(flickerHandle);
    flickerHandle = null;
  }
  flickerState = null;
  flickerStatus.textContent = "";
}

flickerToggle.addEventListener("change", () => {
  if (flickerToggle.checked) startFlicker();
  else cancelAnimations("flicker off");
});

// Unified "stop everything that might be driving liveOverride" — called from
// any place that wants direct slider control back. Keeps the state-clear in
// one spot so the override never gets stuck on.
function cancelAnimations(reason) {
  stopTimer("");
  stopFlicker();
  if (flickerToggle.checked) flickerToggle.checked = false;
  liveOverride = null;
  if (reason) {
    // Surface a brief, useful breadcrumb so a user who tapped a slider mid-
    // fade understands why the fade stopped.
    timerStatus.textContent = reason;
  }
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

function loadSlots() {
  try {
    const raw = localStorage.getItem(SLOTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    // Drop any malformed entries on load — we never want a corrupt write to
    // crash the whole list later in renderSlotList.
    const ok = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v?.kelvin === "number" && typeof v?.brightness === "number") ok[k] = v;
    }
    return ok;
  } catch { return {}; }
}
function saveSlots(map) {
  try { localStorage.setItem(SLOTS_KEY, JSON.stringify(map)); } catch { /* quota or private mode */ }
}

// Re-export the public Kelvin range so a curious developer can grep for it.
export { KELVIN_MIN, KELVIN_MAX };
