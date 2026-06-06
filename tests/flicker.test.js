// VER-10 — candle flicker step. Two things we care about:
//   1. Determinism: same seed → same trajectory (so a bug appears identically
//      twice and we can debug it).
//   2. Bounds: across many seeds and many steps, the output never escapes the
//      documented envelope. That is the safety property of "this is a lamp,
//      not a strobe".

import { describe, test, expect } from "bun:test";
import { flickerStep, makeRng, FLICKER_DEFAULTS } from "../src/flicker.js";

function makeState(opts = {}) {
  const base = { kelvin: 1900, brightness: 0.55 };
  return { base, current: { ...base }, opts };
}

describe("VER-10 flickerStep is deterministic", () => {
  test("same seed produces the same trajectory", () => {
    const rngA = makeRng(42);
    const rngB = makeRng(42);
    let sA = makeState();
    let sB = makeState();
    const aTrail = [];
    const bTrail = [];
    for (let i = 0; i < 50; i++) {
      sA = flickerStep(sA, rngA);
      sB = flickerStep(sB, rngB);
      aTrail.push({ ...sA.current });
      bTrail.push({ ...sB.current });
    }
    expect(aTrail).toEqual(bTrail);
  });

  test("different seeds produce different trajectories", () => {
    const rngA = makeRng(1);
    const rngB = makeRng(2);
    let sA = makeState();
    let sB = makeState();
    for (let i = 0; i < 20; i++) {
      sA = flickerStep(sA, rngA);
      sB = flickerStep(sB, rngB);
    }
    expect(sA.current).not.toEqual(sB.current);
  });
});

describe("VER-10 flickerStep bounds hold across many seeded steps", () => {
  test("kelvin and brightness stay within the documented envelope", () => {
    const seeds = [1, 7, 42, 1234, 99999, 2_147_483_647];
    for (const seed of seeds) {
      const rng = makeRng(seed);
      let s = makeState();
      const { kelvin: bK, brightness: bB } = s.base;
      const kLo = bK - FLICKER_DEFAULTS.kelvinJitter;
      const kHi = bK + FLICKER_DEFAULTS.kelvinJitter;
      const bLo = Math.max(0, bB - FLICKER_DEFAULTS.brightnessJitter);
      const bHi = Math.min(1, bB + FLICKER_DEFAULTS.brightnessJitter);
      for (let i = 0; i < 5000; i++) {
        s = flickerStep(s, rng);
        expect(s.current.kelvin).toBeGreaterThanOrEqual(kLo);
        expect(s.current.kelvin).toBeLessThanOrEqual(kHi);
        expect(s.current.brightness).toBeGreaterThanOrEqual(bLo);
        expect(s.current.brightness).toBeLessThanOrEqual(bHi);
      }
    }
  });

  test("brightness envelope is always inside [0,1] even at extremes of base", () => {
    // base.brightness near the ceiling — envelope must clamp to <=1.
    const high = { base: { kelvin: 2700, brightness: 0.95 }, current: { kelvin: 2700, brightness: 0.95 } };
    const low  = { base: { kelvin: 2700, brightness: 0.05 }, current: { kelvin: 2700, brightness: 0.05 } };
    const rng  = makeRng(123);
    let h = high, l = low;
    for (let i = 0; i < 2000; i++) {
      h = flickerStep(h, rng);
      l = flickerStep(l, rng);
      expect(h.current.brightness).toBeLessThanOrEqual(1);
      expect(h.current.brightness).toBeGreaterThanOrEqual(0);
      expect(l.current.brightness).toBeLessThanOrEqual(1);
      expect(l.current.brightness).toBeGreaterThanOrEqual(0);
    }
  });

  test("custom opts override defaults and bounds follow the override", () => {
    const opts = { kelvinJitter: 50, brightnessJitter: 0.02, stepKelvin: 200, stepBrightness: 0.5, reversion: 0.1 };
    let s = makeState(opts);
    const rng = makeRng(11);
    for (let i = 0; i < 2000; i++) {
      s = flickerStep(s, rng);
      expect(Math.abs(s.current.kelvin - s.base.kelvin)).toBeLessThanOrEqual(opts.kelvinJitter);
      expect(Math.abs(s.current.brightness - s.base.brightness)).toBeLessThanOrEqual(opts.brightnessJitter + 1e-9);
    }
  });
});

describe("VER-10 flickerStep purity and shape", () => {
  test("does not mutate the input state's current object", () => {
    const s = makeState();
    const snapshot = { ...s.current };
    flickerStep(s, makeRng(5));
    expect(s.current).toEqual(snapshot);
  });

  test("rejects malformed state", () => {
    expect(() => flickerStep(null, makeRng(1))).toThrow();
    expect(() => flickerStep({ base: { kelvin: 1, brightness: 0.5 } }, makeRng(1))).toThrow();
  });
});
