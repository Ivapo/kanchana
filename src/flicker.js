// Candle flicker step. The visual goal is a slow, organic wobble around a
// base warmth/brightness — not noise — so we use a mean-reverting random walk
// (drift toward base proportional to distance) and hard-clamp the output to
// a documented envelope around the base point.
//
// The step function is the verifiable unit: given (state, rng) it returns
// the next state. No animation loop, no `requestAnimationFrame`, no `Math.
// random` — the caller supplies the RNG. Tests seed `makeRng` for full
// determinism and assert bounds hold across many seeded steps.
//
// @capability: candle-flicker
// @verifies: VER-10

export const FLICKER_DEFAULTS = Object.freeze({
  kelvinJitter:     250,   // hard ± around base.kelvin
  brightnessJitter: 0.18,  // hard ± around base.brightness (also clamped to [0,1])
  stepKelvin:       90,    // max per-step random kick on Kelvin
  stepBrightness:   0.04,  // max per-step random kick on brightness
  reversion:        0.20,  // pull toward base each step, in [0,1]
});

// state shape: { base: {kelvin,brightness}, current: {kelvin,brightness}, opts? }
// returns:     { base, current: <next>, opts }
//
// @capability: candle-flicker
// @verifies: VER-10
export function flickerStep(state, rng) {
  if (!state || !state.base || !state.current) {
    throw new Error("flickerStep: state must have {base, current}");
  }
  const opts = { ...FLICKER_DEFAULTS, ...(state.opts ?? {}) };
  const { base, current } = state;

  // Symmetric jitter in [-1, +1] scaled by the per-step kick. Two rng() calls
  // — one per dimension — so the RNG advances deterministically each step.
  const kKick = (rng() * 2 - 1) * opts.stepKelvin;
  const bKick = (rng() * 2 - 1) * opts.stepBrightness;

  // Mean reversion: a fraction `reversion` of the gap to base, added back.
  const kRevert = (base.kelvin     - current.kelvin)     * opts.reversion;
  const bRevert = (base.brightness - current.brightness) * opts.reversion;

  // Soft new position, then hard envelope clamp so the bound is a *guarantee*
  // not a probability. Brightness additionally clamped to [0,1].
  const nextK = clamp(
    current.kelvin + kKick + kRevert,
    base.kelvin - opts.kelvinJitter,
    base.kelvin + opts.kelvinJitter,
  );
  const nextB = clamp(
    current.brightness + bKick + bRevert,
    Math.max(0, base.brightness - opts.brightnessJitter),
    Math.min(1, base.brightness + opts.brightnessJitter),
  );

  return {
    base,
    current: { kelvin: nextK, brightness: nextB },
    opts: state.opts, // preserve caller-supplied overrides verbatim
  };
}

// Deterministic RNG for tests AND for "reproduce this flicker" if we ever
// want it. Mulberry32 — small, well-mixed, suitable for visual randomness.
//
// @capability: candle-flicker
// @verifies: VER-10
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n, lo, hi) {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}
