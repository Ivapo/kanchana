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

This prints (by default) a per-day summary across **all** Claude Code
sessions on this machine — `ccusage` does not have a per-project filter.
To isolate this project's contribution, filter by **date range** (only
work on Kanchana that day) or by **session id**:

```sh
bunx ccusage session --since 20260605                   # this build day
bunx ccusage session -i 8c53d229-76e4-47a6-a913-873f59d1349d   # the one session
bunx ccusage session --json                             # machine-readable
```

(See `bunx ccusage --help` and `bunx ccusage session --help` for the
authoritative flag list; subcommands and flags have shifted across
`ccusage` versions, so prefer `--help` over copying incantations.)

> **Note:** The `package.json` includes a shortcut: `bun run ccusage`.

## Why not a counter inside the app?

A self-reported number from the running PWA would be a **lie about its own
provenance**. The PWA does not invoke an LLM; any in-app counter would have
to be hard-coded after the fact, and would drift the moment the code was
edited. The whole exercise is about *verifiable* numbers — so the number
must come from the system that actually paid for the tokens, which is the
Claude Code session.

## Results

Each row is one Claude Code session that contributed to Kanchana. Pull
values from `bunx ccusage session --json` (or the table form above) and
identify the relevant session(s) by id or date.

Snapshot taken **2026-06-05 ~00:42 local** — mid-session, so these numbers
will keep ticking up as long as we are still talking. They are the honest
"cost so far". Source: `bunx ccusage session --since 20260605 --json`.

| Date       | Session (id)                              | Input | Output  | Cache create | Cache read   | Total       | Cost (USD) |
| ---------- | ----------------------------------------- | ----- | ------- | ------------ | ------------ | ----------- | ---------- |
| 2026-06-05 | `8c53d229-76e4-47a6-a913-873f59d1349d`    | 108   | 47,401  | 144,563      | 4,919,395    | 5,111,467   | $4.55      |

**Total to reach v1 (snapshot):** **5,111,467 tokens / $4.55** (single
session, `claude-opus-4-7`). Re-run `bunx ccusage session --since 20260605`
to see the final figure once this session ends.

### How to read this row

- **Input / Output** are the only fields that are pure model work: 108
  fresh input tokens and 47,401 generated output tokens. That output total
  covers every file written, every diff edited, every shell call narrated.
- **Cache create** + **Cache read** dominate because the conversation kept
  re-using the same system prompt, tool definitions, and prior turns —
  Anthropic's prompt cache lets those bytes be billed at a fraction of the
  base rate, which is why the cost is **$4.55** despite a 5.1M token total.
- **Total** sums all four columns; it is the "raw work" view. **Cost** is
  the "what Anthropic actually charged" view.

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
