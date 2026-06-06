// VER-08 — pure slot save/recall/delete logic. No DOM, no storage; that wire-up
// lives in app.js. These assertions are the verifiable core.

import { describe, test, expect } from "bun:test";
import {
  isValidSlotName,
  isValidSlotValue,
  setSlot,
  removeSlot,
  getSlot,
  listSlots,
  SLOT_NAME_MAX,
  MAX_SLOTS,
} from "../src/slots.js";

describe("VER-08 slot validation", () => {
  test("name must be non-empty, trimmed string within length cap", () => {
    expect(isValidSlotName("Bedside")).toBe(true);
    expect(isValidSlotName("  reading  ")).toBe(true);
    expect(isValidSlotName("")).toBe(false);
    expect(isValidSlotName("   ")).toBe(false);
    expect(isValidSlotName(null)).toBe(false);
    expect(isValidSlotName(123)).toBe(false);
    expect(isValidSlotName("x".repeat(SLOT_NAME_MAX))).toBe(true);
    expect(isValidSlotName("x".repeat(SLOT_NAME_MAX + 1))).toBe(false);
  });

  test("value requires finite kelvin and brightness in [0,1]", () => {
    expect(isValidSlotValue({ kelvin: 2700, brightness: 0.8 })).toBe(true);
    expect(isValidSlotValue({ kelvin: 2700, brightness: 0 })).toBe(true);
    expect(isValidSlotValue({ kelvin: 2700, brightness: 1 })).toBe(true);
    expect(isValidSlotValue({ kelvin: 2700, brightness: 1.1 })).toBe(false);
    expect(isValidSlotValue({ kelvin: 2700, brightness: -0.01 })).toBe(false);
    expect(isValidSlotValue({ kelvin: NaN, brightness: 0.5 })).toBe(false);
    expect(isValidSlotValue({ kelvin: Infinity, brightness: 0.5 })).toBe(false);
    expect(isValidSlotValue(null)).toBe(false);
    expect(isValidSlotValue({})).toBe(false);
  });
});

describe("VER-08 setSlot / getSlot / removeSlot are pure", () => {
  test("setSlot returns a new object and does not mutate input", () => {
    const before = Object.freeze({});
    const after = setSlot(before, "Bedside", { kelvin: 2400, brightness: 0.6 });
    expect(after).not.toBe(before);
    expect(after.Bedside).toEqual({ kelvin: 2400, brightness: 0.6 });
  });

  test("setSlot trims surrounding whitespace from the name", () => {
    const after = setSlot({}, "  Sunset  ", { kelvin: 2200, brightness: 0.5 });
    expect(Object.keys(after)).toEqual(["Sunset"]);
  });

  test("setSlot replaces an existing slot in place by name", () => {
    const a = setSlot({}, "Reading", { kelvin: 4000, brightness: 0.9 });
    const b = setSlot(a, "Reading", { kelvin: 4500, brightness: 0.7 });
    expect(b.Reading).toEqual({ kelvin: 4500, brightness: 0.7 });
    expect(Object.keys(b)).toEqual(["Reading"]);
  });

  test("getSlot returns the slot or null", () => {
    const m = setSlot({}, "x", { kelvin: 3000, brightness: 0.5 });
    expect(getSlot(m, "x")).toEqual({ kelvin: 3000, brightness: 0.5 });
    expect(getSlot(m, "missing")).toBeNull();
  });

  test("removeSlot deletes and returns a new object", () => {
    const m = setSlot({}, "x", { kelvin: 3000, brightness: 0.5 });
    const removed = removeSlot(m, "x");
    expect(removed).not.toBe(m);
    expect(removed.x).toBeUndefined();
  });

  test("removeSlot is a no-op (returns same ref) for unknown names", () => {
    const m = setSlot({}, "x", { kelvin: 3000, brightness: 0.5 });
    expect(removeSlot(m, "absent")).toBe(m);
  });

  test("setSlot rejects bad name or value with a thrown Error", () => {
    expect(() => setSlot({}, "", { kelvin: 3000, brightness: 0.5 })).toThrow();
    expect(() => setSlot({}, "ok", { kelvin: NaN, brightness: 0.5 })).toThrow();
  });
});

describe("VER-08 listSlots and capacity", () => {
  test("listSlots returns array view with name+kelvin+brightness in insertion order", () => {
    let m = {};
    m = setSlot(m, "first",  { kelvin: 2400, brightness: 0.5 });
    m = setSlot(m, "second", { kelvin: 4000, brightness: 0.8 });
    expect(listSlots(m)).toEqual([
      { name: "first",  kelvin: 2400, brightness: 0.5 },
      { name: "second", kelvin: 4000, brightness: 0.8 },
    ]);
  });

  test("capacity caps at MAX_SLOTS by evicting the oldest", () => {
    let m = {};
    for (let i = 0; i < MAX_SLOTS; i++) {
      m = setSlot(m, `slot${i}`, { kelvin: 3000, brightness: 0.5 });
    }
    expect(Object.keys(m).length).toBe(MAX_SLOTS);
    m = setSlot(m, "overflow", { kelvin: 3000, brightness: 0.5 });
    expect(Object.keys(m).length).toBe(MAX_SLOTS);
    expect(m.overflow).toBeDefined();
    expect(m.slot0).toBeUndefined(); // first inserted got evicted
  });
});
