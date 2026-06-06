# Verification

This file is the **single source of truth** for what is covered. An agent
reading only this file should be able to answer: "what does Kanchana claim
to do, how do I prove each claim, and what is intentionally not tested?"

Every row maps a user-facing capability to:

- **Test(s)** — the assertion that proves it.
- **Command** — exact command to run that test from the project root.
- **Expected** — what success looks like.

The single command that exercises all automated checks:

```sh
bun test
```

Expected: `0 fail`, exit code 0. Current count: **46 pass / 0 fail**.

---

## Automated checks

| VER-ID  | Capability                | Test(s)                                                                  | Command                                                                          | Expected                                                |
| ------- | ------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------- |
| VER-02  | `kelvin-to-rgb`           | `tests/color.test.js` → `describe("VER-02 kelvinToRGB", …)` (7 cases)    | `bun test tests/color.test.js -t "VER-02 kelvinToRGB"`                           | All cases pass. Confirms Tanner-Helland fit + clamping. |
| VER-02  | `css-color-format`        | `tests/color.test.js` → `describe("VER-02 rgbToCss", …)`                 | `bun test tests/color.test.js -t "VER-02 rgbToCss"`                              | `rgbToCss({r:12,g:34,b:56})` → `"rgb(12, 34, 56)"`.     |
| VER-03  | `brightness-composite`    | `tests/color.test.js` → `describe("VER-03 applyBrightness", …)` (4)      | `bun test tests/color.test.js -t "VER-03"`                                       | b=1 no-op, b=0 black, b=0.5 halves, out-of-range clamps.|
| VER-04  | `presets`                 | `tests/color.test.js` → `describe("VER-04 PRESETS", …)` (4)              | `bun test tests/color.test.js -t "VER-04"`                                       | Four presets exist, are frozen, Kelvin ascends candle → cool, and produce paintable colors. |
| VER-06  | `offline-cache` + `pwa-install` | `tests/sw.test.js` (3 cases)                                       | `bun test tests/sw.test.js`                                                      | Every URL in `sw.js` `PRECACHE` exists on disk; manifest parses with required fields; icon files exist. |
| VER-08  | `custom-slots`            | `tests/slots.test.js` → `describe("VER-08 …", …)` (11 cases)             | `bun test tests/slots.test.js`                                                   | Name + value validation reject malformed input; `setSlot`/`removeSlot` are pure (return new refs, no mutation); `listSlots` preserves insertion order; FIFO eviction at `MAX_SLOTS`. |
| VER-09  | `timer-fade`              | `tests/fade.test.js` → `describe("VER-09 …", …)` (8 cases)               | `bun test tests/fade.test.js`                                                    | OUT mode holds target then linearly fades to **exactly 0** at total; IN mode starts at 0 and rises to target across `fadeWindow`; output is always in `[0, clamp(target,0,1)]` across both modes; bounds hold under clamping. |
| VER-10  | `candle-flicker`          | `tests/flicker.test.js` → `describe("VER-10 …", …)` (7 cases)            | `bun test tests/flicker.test.js`                                                 | Same seed → identical trajectory; across 6 seeds × 5000 steps Kelvin stays in `base ± kelvinJitter` and brightness in `base ± brightnessJitter ∩ [0,1]`; custom opts enforce custom bounds; step does not mutate input. |

## Manual checks (cannot run headless)

The following require a real browser (preferably an iPad) and are listed
here so an agent knows what is **not** automated and why.

| VER-ID  | Capability                | Steps                                                                                                                                                                                                                                          | Expected                                                                                                  | Why not automated                                                |
| ------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| VER-01  | `surface-color`           | `bun run dev`, open `http://localhost:5173` in Safari/Chrome, observe full-viewport warm color. Drag warmth slider.                                                                                                                            | Whole screen is one solid color; warmth slider visibly shifts color from amber → near-white → cool blue.  | Requires real layout + paint; bun test has no DOM.               |
| VER-04  | `presets` (UI side)       | In the running app, tap each preset button (Candle / Warm / Daylight / Cool).                                                                                                                                                                  | Surface color and slider positions update to that preset.                                                  | Requires DOM event delivery.                                     |
| VER-05  | `wake-lock`               | On iPadOS 16.4+: open the app, tick "Keep screen on", leave it untouched for longer than the system idle (default 2 min). Lock the device, unlock, return to the app.                                                                          | Status text shows "wake-lock acquired"; screen does **not** dim/lock while the app is foreground; lock is re-acquired on visibilitychange. | The Screen Wake Lock API needs user gesture, real visibility events, and the actual OS idle timer — none of which exist in bun test. |
| VER-06  | `pwa-install` (iPad install) | In Safari on the iPad, navigate to the served URL (must be HTTPS or localhost). Tap Share → Add to Home Screen. Launch from home screen.                                                                                                    | App opens in standalone mode (no Safari chrome), with the Kanchana icon and the warm default surface.    | Requires Safari's Add-to-Home-Screen flow.                       |
| VER-06  | `offline-cache` (runtime) | Load the installed app once with network on. Enable Airplane Mode. Launch the home-screen icon again.                                                                                                                                          | App loads and renders normally with no network.                                                            | Requires the SW lifecycle in a real browser; bun test only checks the precache manifest matches files. |
| VER-07  | `controls-autohide`       | Tap a slider, then leave the app untouched for ~4 seconds.                                                                                                                                                                                     | Control panel fades out. Tapping anywhere on the surface brings it back.                                  | Timers + DOM events.                                             |
| VER-13  | `dev-server`              | `bun run dev`; in another terminal `curl -sI http://localhost:5173/sw.js`.                                                                                                                                                                     | `200 OK`, `Content-Type: text/javascript`.                                                                | Trivial to do by hand; automation would just duplicate the smoke test we did during development. |
| VER-08  | `custom-slots` (UI side)  | `bun run dev`, open the app, set warmth + brightness you like, type a name (e.g. "Bedside") in the "Save as" field, tap **Save**. A chip appears in the list. Tap the chip → sliders return to those values. Tap the chip's **×** → it disappears. Reload the page → the chip survives.                                              | Save round-trips via `localStorage` and the slot list re-renders in insertion order; recall sets sliders; delete removes; persistence survives reload. | DOM events + `localStorage`; out of scope for `bun test`. |
| VER-09  | `timer-fade` (UI side)    | Set Timer = 1 min, fade = 1 min. Bring brightness to ~80%. Tap **Fade-out**. Watch the surface dim smoothly toward black across one minute; "fading…" then "done" in the status. Then tap **Sunrise** at brightness 60% — surface starts black, ramps to 60% over the fade window, holds. **Cancel** stops mid-run and returns slider control. | Smooth visible fade with the curve from `fade.js`; no flicker at zero; cancel restores direct slider control. | Real wall-clock `setInterval`, no DOM in `bun test`. |
| VER-10  | `candle-flicker` (UI)     | Set warmth ~1900K, brightness ~55%. Tick **Candle flicker**. Surface should wobble gently — never freeze, never go pitch black, never go pure white, never visibly leave the warm-amber range. Untick → returns to slider values. Touching a slider while it's on also cancels it. | Visible bounded wobble around the base; no escape from the documented envelope; cancel paths work. | Live animation; `bun test` covers determinism + bounds, not the animation loop driver itself. |

## Not yet verified (deferred to v3+)

These are intentional omissions, listed so they don't masquerade as covered:

- **Display calibration**: We don't claim the rendered color matches an
  absolute SPD; the Kelvin → RGB fit is approximate. No colorimeter-based
  test exists.
- **Cross-browser PWA install**: Only iPad Safari is documented. Chromium
  install prompts on Android/desktop are out of scope for v1.
- **Battery impact**: Dimming via composite does not reduce backlight power.
  This is documented in `README.md` under "Constraints", but there is no
  measurement.
- **Service worker upgrade flow**: We bump `CACHE_VERSION` to invalidate;
  there is no test for the activate-time cleanup of stale caches.
- **Full RGB color mode**: Deliberately deferred to v3. v2 stays on the
  Kelvin axis so the existing color pipeline (`kelvinToRGB` →
  `applyBrightness` → `rgbToCss`) remains the single source of truth.

## How VER-IDs are assigned

See `CONVENTIONS.md`. IDs are never recycled; retired capabilities keep
their row marked **Retired** rather than reusing the number.
