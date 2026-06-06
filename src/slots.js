// User-defined preset slots: pure save/recall/delete logic for the {kelvin,
// brightness} pairs the user wants to come back to. Mirrors the frozen
// PRESETS pattern in color.js — that table is canonical and immutable; this
// module manages a *mutable, user-owned* map by returning new copies (no
// in-place mutation, so the store wrapper in app.js can swap state cleanly).
//
// Storage lives in app.js (localStorage). This file is intentionally storage-
// agnostic so the same functions run under `bun test` with plain objects.
//
// @capability: custom-slots
// @verifies: VER-08

export const SLOT_NAME_MAX = 40;
export const MAX_SLOTS = 24;

// @capability: custom-slots
// @verifies: VER-08
export function isValidSlotName(name) {
  if (typeof name !== "string") return false;
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= SLOT_NAME_MAX;
}

// Accept the same {kelvin, brightness} shape PRESETS uses, with brightness in
// [0,1] (the canonical internal unit — UI maps 0..100 elsewhere).
//
// @capability: custom-slots
// @verifies: VER-08
export function isValidSlotValue(v) {
  if (!v || typeof v !== "object") return false;
  if (typeof v.kelvin !== "number" || !Number.isFinite(v.kelvin)) return false;
  if (typeof v.brightness !== "number" || !Number.isFinite(v.brightness)) return false;
  if (v.brightness < 0 || v.brightness > 1) return false;
  return true;
}

// Insert-or-replace a slot. Always returns a NEW object so React-style "is
// this a new state?" identity checks (or the storage save guard in app.js)
// can rely on reference inequality.
//
// @capability: custom-slots
// @verifies: VER-08
export function setSlot(slots, name, value) {
  if (!isValidSlotName(name)) throw new Error("invalid slot name");
  if (!isValidSlotValue(value)) throw new Error("invalid slot value");
  const key = name.trim();
  const next = { ...slots, [key]: { kelvin: value.kelvin, brightness: value.brightness } };
  // Cap the total number of slots. We drop the oldest insertion key (the
  // first key that is not the one we just added) — JS object key ordering
  // preserves insertion order for string keys, which is exactly what we need
  // for FIFO eviction.
  const keys = Object.keys(next);
  if (keys.length > MAX_SLOTS) {
    const drop = keys.find((k) => k !== key);
    if (drop) delete next[drop];
  }
  return next;
}

// @capability: custom-slots
// @verifies: VER-08
export function removeSlot(slots, name) {
  if (!(name in slots)) return slots;
  const { [name]: _, ...rest } = slots;
  return rest;
}

// @capability: custom-slots
// @verifies: VER-08
export function getSlot(slots, name) {
  return slots[name] ?? null;
}

// Stable array view for rendering. Order matches insertion order, which lets
// the UI render the freshest slot in the same position the user just saved.
//
// @capability: custom-slots
// @verifies: VER-08
export function listSlots(slots) {
  return Object.entries(slots).map(([name, v]) => ({
    name,
    kelvin: v.kelvin,
    brightness: v.brightness,
  }));
}
