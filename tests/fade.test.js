// VER-09 — pure fade curve. The whole point of pulling this out is so we can
// assert the shape and bounds without spinning a real clock.

import { describe, test, expect } from "bun:test";
import { fadeCurve, FADE_MODE } from "../src/fade.js";

const MIN = 60_000; // one minute, matches the unit app.js will use

describe("VER-09 fadeCurve OUT mode shape", () => {
  test("holds target until the fade window starts", () => {
    const total = 10 * MIN;
    const fw    =  2 * MIN;
    expect(fadeCurve(0,         total, fw, 1.0, FADE_MODE.OUT)).toBeCloseTo(1.0, 6);
    expect(fadeCurve(5 * MIN,   total, fw, 1.0, FADE_MODE.OUT)).toBeCloseTo(1.0, 6);
    expect(fadeCurve(8 * MIN,   total, fw, 1.0, FADE_MODE.OUT)).toBeCloseTo(1.0, 6);
  });

  test("linearly fades to zero across the fade window", () => {
    const total = 10 * MIN;
    const fw    =  4 * MIN;
    // fade starts at 6 min, ends at 10 min — midpoint should be half target.
    expect(fadeCurve(8 * MIN,   total, fw, 1.0, FADE_MODE.OUT)).toBeCloseTo(0.5, 6);
    expect(fadeCurve(9 * MIN,   total, fw, 1.0, FADE_MODE.OUT)).toBeCloseTo(0.25, 6);
  });

  test("hits exactly 0 at end of total duration", () => {
    expect(fadeCurve(10 * MIN, 10 * MIN, 2 * MIN, 1.0, FADE_MODE.OUT)).toBe(0);
    // Beyond end still reads as 0 (clamp protects against late frames).
    expect(fadeCurve(99 * MIN, 10 * MIN, 2 * MIN, 0.8, FADE_MODE.OUT)).toBe(0);
  });
});

describe("VER-09 fadeCurve IN mode shape", () => {
  test("starts at zero and rises linearly to target across fadeWindow", () => {
    const total = 30 * MIN;
    const fw    = 10 * MIN;
    expect(fadeCurve(0,         total, fw, 0.8, FADE_MODE.IN)).toBe(0);
    expect(fadeCurve(5 * MIN,   total, fw, 0.8, FADE_MODE.IN)).toBeCloseTo(0.4, 6);
    expect(fadeCurve(10 * MIN,  total, fw, 0.8, FADE_MODE.IN)).toBeCloseTo(0.8, 6);
  });

  test("holds at target after the ramp completes", () => {
    const total = 30 * MIN;
    const fw    = 10 * MIN;
    expect(fadeCurve(20 * MIN, total, fw, 0.8, FADE_MODE.IN)).toBeCloseTo(0.8, 6);
    expect(fadeCurve(total,    total, fw, 0.8, FADE_MODE.IN)).toBeCloseTo(0.8, 6);
  });
});

describe("VER-09 fadeCurve bounds and clamping", () => {
  test("output is always in [0, clamp(target,0,1)] across both modes", () => {
    const total = 5 * MIN;
    const fw    = 2 * MIN;
    for (const mode of [FADE_MODE.OUT, FADE_MODE.IN]) {
      for (const tgt of [0, 0.25, 0.5, 0.8, 1.0]) {
        for (let t = -1000; t <= total + 1000; t += 1000) {
          const v = fadeCurve(t, total, fw, tgt, mode);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(tgt);
        }
      }
    }
  });

  test("clamps a target above 1 down to 1 so the bound holds", () => {
    expect(fadeCurve(0, 10 * MIN, 2 * MIN, 5, FADE_MODE.OUT)).toBe(1);
  });

  test("target=0 always returns 0 regardless of elapsed/window/mode", () => {
    for (const mode of [FADE_MODE.OUT, FADE_MODE.IN]) {
      for (let t = 0; t <= 10 * MIN; t += MIN) {
        expect(fadeCurve(t, 10 * MIN, 2 * MIN, 0, mode)).toBe(0);
      }
    }
  });

  test("degenerate total=0: OUT returns 0, IN returns target", () => {
    expect(fadeCurve(0, 0, 0, 0.7, FADE_MODE.OUT)).toBe(0);
    expect(fadeCurve(0, 0, 0, 0.7, FADE_MODE.IN)).toBeCloseTo(0.7, 6);
  });
});
