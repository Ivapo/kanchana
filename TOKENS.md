# Token accounting

The real point of Kanchana is to **measure the token cost of producing a
verifiable app**. The app itself does no LLM work — there is nothing inside
the running code that calls Claude or any other model — so the app cannot
self-report a build cost. The honest number lives **outside** the app, in
Claude Code's own session usage data.

## Where the numbers come from

Claude Code records token usage per session. The community tool
[`ccusage`](https://github.com/ryoppippi/ccusage) reads those records and
prints aggregates. We invoke it via `bunx` so there is nothing to install:

```sh
bunx ccusage
```

This prints (by default) a per-day summary across all Claude Code projects
on this machine. To filter to just this project's sessions, scope it to the
project directory:

```sh
bunx ccusage daily --project /Users/ivapo/dev/main/kanchana
# or
bunx ccusage session --project /Users/ivapo/dev/main/kanchana
```

(See `bunx ccusage --help` for the full flag list; the available filters
have changed across `ccusage` versions, so prefer `--help` over copying
incantations from elsewhere.)

> **Note:** The `package.json` includes a shortcut: `bun run ccusage`.

## Why not a counter inside the app?

A self-reported number from the running PWA would be a **lie about its own
provenance**. The PWA does not invoke an LLM; any in-app counter would have
to be hard-coded after the fact, and would drift the moment the code was
edited. The whole exercise is about *verifiable* numbers — so the number
must come from the system that actually paid for the tokens, which is the
Claude Code session.

## Results

Fill in once you have a meaningful build span to measure. Each row is one
Claude Code session that contributed to Kanchana. Pull values from
`bunx ccusage session --project /Users/ivapo/dev/main/kanchana`.

| Date       | Session (id or label)       | Input tokens | Output tokens | Total |
| ---------- | --------------------------- | ------------ | ------------- | ----- |
|            |                             |              |               |       |
|            |                             |              |               |       |
|            |                             |              |               |       |

**Total to reach v1:** _to fill in_

## Methodology notes

- Numbers reflect what Claude Code **billed** in tokens — they include the
  system prompt, tool descriptions, conversation history, and all model
  output. They do not equal "lines of code produced ÷ tokens-per-line".
- Cached tokens (prompt-cache hits) are reported separately by `ccusage`.
  If you want a "cost-equivalent" view, look at the cost column; if you
  want a "raw work" view, sum input + output.
- Re-running `bun test` does not spend Claude tokens. Only conversational
  turns with the model do. Manual verification on an iPad (per
  `VERIFICATION.md`) is also free.
