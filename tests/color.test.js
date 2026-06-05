// Pure-logic unit tests. Names reference VER-ids from VERIFICATION.md so an
// agent can grep either direction (capability → test, or test → capability).
//
// Run with: bun test

import { describe, test, expect } from "bun:test";
import {
  kelvinToRGB,
  applyBrightness,
  rgbToCss,
  PRESETS,
  KELVIN_MIN,
  KELVIN_MAX,
} from "../src/color.js";

describe("VER-02 kelvinToRGB", () => {
  test("candle (1900K) is red-dominant, low blue", () => {
    const c = kelvinToRGB(1900);
    expect(c.r).toBe(255);                 // low Kelvin saturates red
    expect(c.g).toBeLessThan(c.r);
    expect(c.b).toBeLessThan(c.g);
    expect(c.b).toBeLessThan(40);
  });

  test("daylight (5500K) is roughly balanced, slightly warm", () => {
    const c = kelvinToRGB(5500);
    expect(c.r).toBe(255);                 // still capped (t<=66)
    expect(c.g).toBeGreaterThan(200);
    expect(c.b).toBeGreaterThan(200);
    // 5500K should NOT have a green or blue cast stronger than red.
    expect(c.r).toBeGreaterThanOrEqual(c.g);
    expect(c.r).toBeGreaterThanOrEqual(c.b);
  });

  test("cool (6500K and above) pushes blue toward 255", () => {
    const c = kelvinToRGB(6500);
    expect(c.b).toBeGreaterThanOrEqual(240);
  });

  test("very high Kelvin saturates blue", () => {
    const c = kelvinToRGB(20000);
    expect(c.b).toBe(255);
    expect(c.r).toBeLessThan(c.b);
  });

  test("clamps below 1000K to the floor", () => {
    expect(kelvinToRGB(0)).toEqual(kelvinToRGB(KELVIN_MIN));
    expect(kelvinToRGB(-9999)).toEqual(kelvinToRGB(KELVIN_MIN));
  });

  test("clamps above 40000K to the ceiling", () => {
    expect(kelvinToRGB(99999)).toEqual(kelvinToRGB(KELVIN_MAX));
  });

  test("output channels are always 0..255 integers", () => {
    for (let k = 1000; k <= 40000; k += 250) {
      const c = kelvinToRGB(k);
      for (const v of [c.r, c.g, c.b]) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(255);
      }
    }
  });
});

describe("VER-03 applyBrightness", () => {
  test("brightness=1 is a no-op (within rounding)", () => {
    const orig = { r: 255, g: 200, b: 100 };
    expect(applyBrightness(orig, 1)).toEqual(orig);
  });

  test("brightness=0 collapses to black", () => {
    expect(applyBrightness({ r: 255, g: 200, b: 100 }, 0)).toEqual({ r: 0, g: 0, b: 0 });
  });

  test("brightness=0.5 halves each channel", () => {
    expect(applyBrightness({ r: 200, g: 100, b: 50 }, 0.5)).toEqual({ r: 100, g: 50, b: 25 });
  });

  test("clamps brightness outside 0..1", () => {
    const orig = { r: 200, g: 100, b: 50 };
    expect(applyBrightness(orig, 1.5)).toEqual(orig);
    expect(applyBrightness(orig, -1)).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe("VER-02 rgbToCss", () => {
  test("formats as rgb(r, g, b)", () => {
    expect(rgbToCss({ r: 12, g: 34, b: 56 })).toBe("rgb(12, 34, 56)");
  });
});

describe("VER-04 PRESETS", () => {
  test("exposes the four documented presets", () => {
    expect(Object.keys(PRESETS).sort()).toEqual(["candle", "cool", "daylight", "warm"]);
  });

  test("each preset has a valid Kelvin and brightness 0..1", () => {
    for (const [name, p] of Object.entries(PRESETS)) {
      expect(typeof p.label).toBe("string");
      expect(p.kelvin).toBeGreaterThanOrEqual(KELVIN_MIN);
      expect(p.kelvin).toBeLessThanOrEqual(KELVIN_MAX);
      expect(p.brightness).toBeGreaterThan(0);
      expect(p.brightness).toBeLessThanOrEqual(1);
      // Sanity: feeding the preset through the pipeline yields a paintable color.
      const c = applyBrightness(kelvinToRGB(p.kelvin), p.brightness);
      expect(c.r + c.g + c.b).toBeGreaterThan(0); // not black
    }
  });

  test("PRESETS object is frozen (immutable)", () => {
    expect(Object.isFrozen(PRESETS)).toBe(true);
  });

  test("warmth progression candle < warm < daylight < cool", () => {
    const order = [PRESETS.candle.kelvin, PRESETS.warm.kelvin, PRESETS.daylight.kelvin, PRESETS.cool.kelvin];
    for (let i = 1; i < order.length; i++) {
      expect(order[i]).toBeGreaterThan(order[i - 1]);
    }
  });
});
