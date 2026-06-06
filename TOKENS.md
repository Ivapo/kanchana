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

### v1 (initial build — VER-01..07 + VER-13)

| Date       | Session (id)                              | Input | Output  | Cache create | Cache read   | Total       | Cost (USD) |
| ---------- | ----------------------------------------- | ----- | ------- | ------------ | ------------ | ----------- | ---------- |
| 2026-06-05 | `8c53d229-76e4-47a6-a913-873f59d1349d`    | 108   | 47,401  | 144,563      | 4,919,395    | 5,111,467   | $4.55      |

**Total to reach v1 (snapshot):** **5,111,467 tokens / $4.55** (single
session, `claude-opus-4-7`). The session continued past this snapshot;
re-running `bunx ccusage session -i 8c53d229-76e4-47a6-a913-873f59d1349d`
on 2026-06-05 returns the final v1 figure (**6,604,044 tokens / $5.55**).

### v2 (VER-08 custom slots + VER-09 timer fade + VER-10 candle flicker)

| Date       | Session (id)                              | Input | Output  | Cache create | Cache read   | Total       | Cost (USD) |
| ---------- | ----------------------------------------- | ----- | ------- | ------------ | ------------ | ----------- | ---------- |
| 2026-06-05 | `34864658-ab92-4955-af8b-42cc3af71bd8`    | 63    | 30,016  | 99,316       | 3,429,768    | 3,559,163   | $3.09      |

**Total to reach v2 (snapshot):** **3,559,163 tokens / $3.09** for **three**
new verified capabilities (single session, `claude-opus-4-7`). Same caveat
as v1: re-run `bunx ccusage session -i 34864658-ab92-4955-af8b-42cc3af71bd8`
after the session closes for the final figure.

### Tokens per verified capability

A first-order "what does it cost to add one verifiable capability to this
codebase?" view. Numerator is the session total above; denominator is the
number of `VER-NN` rows that session added to `VERIFICATION.md`.

| Cohort | Session total | Capabilities | Tokens / capability | Cost / capability |
| ------ | ------------- | ------------ | ------------------- | ----------------- |
| v1     | 5,111,467     | 8 (VER-01..07 + VER-13) | ~639,000      | ~$0.57            |
| v2     | 3,559,163     | 3 (VER-08, VER-09, VER-10) | ~1,186,000 | ~$1.03            |

Don't over-read the v1 figure: most v1 VER rows are small (a CSS shape,
a manifest field) sharing one big pure-color module — high amortisation
inflates the "capabilities" denominator. v2's three capabilities are each
their own pure module + dedicated test file + UI wiring, which is closer
to "one capability = one feature" — so the v2 per-capability cost is the
more honest number to quote when scoping future work.

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
