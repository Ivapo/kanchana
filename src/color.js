// Pure color math for Kanchana. No DOM, no globals. Importable from tests.
//
// @capability: kelvin-to-rgb
// @verifies: VER-02
// @capability: brightness-composite
// @verifies: VER-03
// @capability: presets
// @verifies: VER-04

// Approximation of black-body radiator color at a given Kelvin temperature.
// Source: Tanner Helland's well-known fit, widely used because it's cheap and
// good enough for ambient lighting (we are NOT trying to be colorimetrically
// exact — there is no calibrated display loop on the iPad anyway).
//
// Valid range: 1000K .. 40000K. We clamp before computing because the fit
// produces negative or >255 channels outside that envelope.
export const KELVIN_MIN = 1000;
export const KELVIN_MAX = 40000;

// @capability: kelvin-to-rgb
// @verifies: VER-02
export function kelvinToRGB(kelvin) {
  const t = clamp(kelvin, KELVIN_MIN, KELVIN_MAX) / 100;

  let r, g, b;

  if (t <= 66) {
    r = 255;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
  }

  if (t <= 66) {
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
  } else {
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  }

  if (t >= 66) {
    b = 255;
  } else if (t <= 19) {
    b = 0;
  } else {
    b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  }

  return {
    r: Math.round(clamp(r, 0, 255)),
    g: Math.round(clamp(g, 0, 255)),
    b: Math.round(clamp(b, 0, 255)),
  };
}

// Perceived-brightness dimming.
//
// iOS Safari does not expose hardware brightness to web pages. The only honest
// option is to dim the displayed color toward black. We do this by scaling each
// RGB channel by `brightness` (0..1). This is mathematically equivalent to
// compositing pure black at opacity (1 - brightness) over the full-bright color
// — but doing it on the color directly keeps us to a single paint op with no
// extra layer. The trade-off (documented in README): hardware backlight power
// is unchanged, so the panel still draws roughly the same battery as a bright
// white screen. This is a real platform constraint, not a bug.
//
// @capability: brightness-composite
// @verifies: VER-03
export function applyBrightness(rgb, brightness) {
  const b = clamp(brightness, 0, 1);
  return {
    r: Math.round(rgb.r * b),
    g: Math.round(rgb.g * b),
    b: Math.round(rgb.b * b),
  };
}

// Format an {r,g,b} object as a CSS color string. Kept separate so the
// numeric pipeline above stays unit-testable without string parsing.
//
// @capability: css-color-format
// @verifies: VER-02
export function rgbToCss({ r, g, b }) {
  return `rgb(${r}, ${g}, ${b})`;
}

// Canonical presets. Values are intentionally round Kelvin numbers that match
// common lighting product nomenclature (e.g. "2700K warm white" is the de
// facto incandescent-replacement spec).
//
// @capability: presets
// @verifies: VER-04
export const PRESETS = Object.freeze({
  candle:   { label: "Candle",   kelvin: 1900, brightness: 0.55 },
  warm:     { label: "Warm",     kelvin: 2700, brightness: 0.80 },
  daylight: { label: "Daylight", kelvin: 5000, brightness: 0.95 },
  cool:     { label: "Cool",     kelvin: 6500, brightness: 1.00 },
});

function clamp(n, lo, hi) {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}
