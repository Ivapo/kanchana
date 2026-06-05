# Kanchana — agent brief

This file is auto-loaded every time Claude Code opens this repo. Keep it
short and load-bearing — the longer docs do the heavy lifting.

## What this project actually is

A small iPad PWA (a screen-as-lamp) that is **also a measurement vehicle**
for "how many tokens does it take to produce a verifiable app". The lamp
is the deliverable; the verifiability is the point. Treat both as
first-class.

## Read these before changing anything

1. **`VERIFICATION.md`** — the canonical list of capabilities, VER-ids,
   and tests. Source of truth for "is X covered?". If you change behavior,
   update this table in the same diff.
2. **`CONVENTIONS.md`** — defines the dual-purpose comment scheme
   (`@capability: kebab-name`, `@verifies: VER-NN`) used throughout. New
   code without these anchors is incomplete.
3. **`TOKENS.md`** — explains why there is no in-app token counter (the
   app does no LLM work, so any in-app number would be a lie) and how to
   pull real numbers with `bunx ccusage`.
4. **`README.md`** — user-facing intro, install steps, real platform
   constraints (no hardware brightness, Wake Lock release on hide, etc.).

## Conventions that bite if missed

- **Paths are relative** (`./sw.js`, `./manifest.webmanifest`, `./icons/…`).
  GitHub Pages serves at `/kanchana/`, not `/`. Do not reintroduce absolute
  paths — they break production.
- **Pure logic lives in `src/color.js`**. Anything DOM-touching goes in
  `src/app.js` / `src/ui.js` / `src/wakelock.js`. The split exists so the
  tests can stay headless.
- **One test command**: `bun test`. CI deploys only on green. Every
  `describe()` starts with its VER-id so the suite output matches
  `VERIFICATION.md` by inspection.
- **Service worker `CACHE_VERSION`** in `sw.js` must be bumped whenever
  any precached asset changes; otherwise installed users keep the stale
  bundle.
- **Icons are generated**, not hand-edited. Run `bun run icons` after
  changing the recipe in `scripts/make-icons.js`.

## Deployment

- Live at https://ivapo.github.io/kanchana/.
- Auto-deploys on push to `main` via `.github/workflows/deploy.yml`.
- Pages was enabled once via `gh api -X POST /repos/Ivapo/kanchana/pages
  -f build_type=workflow` — the workflow's default `GITHUB_TOKEN` cannot
  create the Pages site, only deploy to one that exists. If you fork or
  re-create the repo, run that command once.

## What is intentionally NOT here

- A framework. Adding React/Vue/etc. requires explicit justification.
- A bundler. The `src/` layout is shipped as-is — modules served raw.
- An in-app token counter. See `TOKENS.md` for the reasoning.
- Backwards-compat shims for old browsers. Wake Lock and PWA install
  degrade gracefully; that is the whole compatibility surface.
