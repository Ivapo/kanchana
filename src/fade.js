// Timer fade curve. Pure math: given (elapsed, totalDuration, fadeWindow,
// target, mode) return the brightness the surface should show at that moment.
//
// The function is the verifiable unit. The animation loop lives in app.js
// and is just "every frame, ask fade.js what brightness to paint". Nothing
// here touches the DOM, `setTimeout`, or `performance.now()` — that keeps
// the curve testable headlessly and means a future agent can reuse it for
// a different driver (e.g. a CSS animation generator).
//
// @capability: timer-fade
// @verifies: VER-09

export const FADE_MODE = Object.freeze({
  OUT: "fade-out", // hold target, then taper to 0 over the last fadeWindow ms
  IN:  "fade-in",  // start at 0, rise to target over the first fadeWindow ms, hold
});

// elapsed/total/fadeWindow share whatever time unit the caller uses (we use
// milliseconds in app.js). target is in [0,1] like applyBrightness expects.
//
// Guarantees (asserted by tests):
//   - return value is always in [0, clamp(target,0,1)]
//   - mode=OUT: at elapsed >= total, returns 0
//   - mode=IN:  at elapsed >= fadeWindow, returns clamped target
//   - clamps elapsed and fadeWindow into sane ranges before computing
//
// @capability: timer-fade
// @verifies: VER-09
export function fadeCurve(elapsed, totalDuration, fadeWindow, targetBrightness, mode = FADE_MODE.OUT) {
  const tgt = clamp(targetBrightness, 0, 1);
  if (!Number.isFinite(totalDuration) || totalDuration <= 0) {
    // Degenerate: a zero-length program — OUT is already done, IN never ramps.
    return mode === FADE_MODE.IN ? tgt : 0;
  }
  const t  = clamp(elapsed, 0, totalDuration);
  const fw = clamp(fadeWindow, 0, totalDuration);

  if (mode === FADE_MODE.IN) {
    // No ramp window: snap to target immediately. (Edge case for a UI that
    // accidentally sets fadeWindow=0 — keep behavior defined, not NaN.)
    if (fw === 0) return tgt;
    if (t >= fw)  return tgt;
    return tgt * (t / fw);
  }

  // FADE_MODE.OUT
  const fadeStart = totalDuration - fw;
  if (t <= fadeStart) return tgt;
  if (fw === 0)       return t >= totalDuration ? 0 : tgt;
  return tgt * (1 - (t - fadeStart) / fw);
}

function clamp(n, lo, hi) {
  if (!Number.isFinite(n)) return lo;
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}
