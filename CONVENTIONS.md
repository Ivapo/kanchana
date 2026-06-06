# Conventions

This file is the contract for the **dual-purpose comments** used throughout
Kanchana. The goal: a coding agent (or human) can reliably grep from a
**capability** name to its **implementation** and to its **verification ID**,
in either direction, without reading any prose.

## Anchor scheme

Every non-trivial unit (function, file section, HTML element, test suite)
carries up to two machine-readable anchors, written as line comments in
whatever syntax the host file uses (`//`, `<!-- -->`, `/* */`).

| Anchor          | Shape                          | Meaning                                                          |
| --------------- | ------------------------------ | ---------------------------------------------------------------- |
| `@capability:`  | `@capability: kebab-name`      | Names a user-facing capability this code implements.             |
| `@verifies:`    | `@verifies: VER-NN`            | Points at one or more verification IDs from `VERIFICATION.md`.   |

Both anchors are line-bounded — the value runs to end of line, no markdown,
no quotes. Use the **exact same** kebab-case capability name everywhere it
appears so `grep -R "@capability: warmth-control"` returns every site.

## Capability names (canonical list)

These names are stable. Add a new one here when you add new behavior; never
rename without doing a repo-wide sweep.

| Capability               | Where it lives                                   |
| ------------------------ | ------------------------------------------------ |
| `app-bootstrap`          | `src/app.js`                                     |
| `surface-color`          | `index.html`, `src/app.js`                       |
| `kelvin-to-rgb`          | `src/color.js`, `tests/color.test.js`            |
| `brightness-composite`   | `src/color.js`, `tests/color.test.js`            |
| `css-color-format`       | `src/color.js`, `tests/color.test.js`            |
| `presets`                | `src/color.js`, `src/app.js`, `tests/color.test.js` |
| `controls-autohide`      | `src/ui.js`, `src/app.js`, `index.html`          |
| `wake-lock`              | `src/wakelock.js`, `src/app.js`                  |
| `pwa-install`            | `manifest.webmanifest`, `sw.js`, `index.html`, `scripts/make-icons.js` |
| `offline-cache`          | `sw.js`, `tests/sw.test.js`                      |
| `dev-server`             | `server.js`                                      |
| `custom-slots`           | `src/slots.js`, `src/app.js`, `tests/slots.test.js`   |
| `timer-fade`             | `src/fade.js`,  `src/app.js`, `tests/fade.test.js`    |
| `candle-flicker`         | `src/flicker.js`, `src/app.js`, `tests/flicker.test.js` |

## Verification IDs

Verification IDs are defined in `VERIFICATION.md`. The format is `VER-NN`
where `NN` is a zero-padded two-digit number. IDs are never recycled — when a
capability is removed, leave the row in `VERIFICATION.md` and mark it
**Retired**.

## Test naming

Test suite descriptions should start with the relevant VER-id, e.g.

```js
describe("VER-02 kelvinToRGB", () => { ... });
```

This lets a reviewer scan the suite output and confirm coverage against the
verification table without opening any source.

## Commenting tone

- One short human comment per non-trivial unit explaining **why** (intent,
  trade-offs, hidden constraints). The "what" is in the code.
- The two anchors above sit on their own lines, near the human comment.
- No multi-paragraph docstrings. If a comment grows long, the explanation
  probably belongs in `README.md` or here.
