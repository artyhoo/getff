---
title: precompact-residue hook
description: Compaction is about to throw away the session's working state. This hook writes down the model's own last words first — and records how full the context window actually was at the moment the harness gave up on it.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/hooks/lib/residue-dir.sh
  - .claude/hooks/precompact-residue.sh
  - .claude/rules/attention-is-not-a-mechanism.md
  - .claude/settings.json
  - docs/site/reference/D.json
  - docs/site/reference/D.md
  - docs/site/reference/D/end-of-turn-reminder.md
  - docs/site/reference/D/inject-handoff-on-compact.md
  - docs/site/terms.md
  - packages/core/hooks/precompact-residue.test.ts
executed:
  - { example: precompact-residue-writes-the-recap-and-the-observed-ceiling-on-an-auto-compaction, stack: repo, date: 2026-09-25, result: silent }
  - { example: precompact-residue-excludes-subagent-turns-from-both-the-body-and-the-ceiling, stack: repo, date: 2026-09-25, result: silent }
  - { example: precompact-residue-clears-the-end-of-turn-debounce-flags-by-exact-name, stack: repo, date: 2026-09-25, result: silent }
docs-refresh: deferred — re-verified 2026-09-25, page authored from the cited sources at this pin; clears at the next refresh of this page
---

# precompact-residue hook

## Fact card

What each row means: [how to read a fact card](../D.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the card quotes the hook's own header line and registration JSON verbatim -->

<!-- getff:begin section=D-card-precompact-residue plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `precompact-residue` |
| kind | hook |
| ships-to | not installed on any lane (no-lane) |
| description | PreCompact hook — writes the session-residue note before compaction |
| source | `.claude/hooks/precompact-residue.sh:2` |
| event | `["PreCompact"]` |
| matcher | `[]` |
| delivery | `["@dual-pair:hook-lang-i18n (spec: docs/superpowers/specs/2026-06-01-hook-lang-i18n-design.md)","@cc-only-rationale"]` |
<!-- getff:end section=D-card-precompact-residue -->

<!-- vale on -->

## Explanation

When your agent's context compacts, everything not written down is gone. This
hook stands at that moment and writes one markdown file per session — the
session anchor, the timestamp, the branch, and the model's own final state
copied verbatim from the transcript. The card's delivery row looks busy, so
read it carefully: the `@dual-pair:hook-lang-i18n` entry names the
recap-marker language [twin](../../terms.md#twin) (the English and Russian
marker packs it loads so the recap block is found in either language, header
lines 94-105), while `@cc-only-rationale` describes the hook itself — the
PreCompact event is Claude-Code-only. In the parity census this is row 21,
`cc-only`: ZCode exposes no compaction-lifecycle hook of any kind, so there is
no degraded arm to ship.

The write is silent on stdout. A PreCompact hook *could* block compaction by
exiting non-zero, and this one never does — by choice, recorded in the header
(lines 20-24): the residue is a side effect, not a veto. Here is a real
auto-compaction on a small transcript (recap block plus turns, one subagent
turn mixed in):

```bash
D="$(mktemp -d)"; mkdir -p "$D/tr" "$D/tmp" "$D/out"
printf '%s\n' \
'{"type":"assistant","isSidechain":false,"message":{"usage":{"input_tokens":11,"cache_read_input_tokens":0,"cache_creation_input_tokens":0},"content":[{"type":"text","text":"early turn"}]}}' \
'{"type":"assistant","isSidechain":true,"message":{"usage":{"input_tokens":555,"cache_read_input_tokens":0,"cache_creation_input_tokens":0},"content":[{"type":"text","text":"subagent turn"}]}}' \
'{"type":"assistant","isSidechain":false,"message":{"usage":{"input_tokens":101,"cache_read_input_tokens":0,"cache_creation_input_tokens":0},"content":[{"type":"text","text":"## 🟢 In plain words\n\nFix the flaky timeout test.\n\nNext: rerun the suite twice."}]}}' \
> "$D/tr/main.jsonl"
printf '%s' '{"hook_event_name":"PreCompact","trigger":"auto","session_id":"docs-demo-pc-1","transcript_path":"'$D'/tr/main.jsonl","cwd":"'$D'"}' \
  | AIF_RESIDUE_DIR="$D/out" TMPDIR="$D/tmp" bash .claude/hooks/precompact-residue.sh
cat "$D/out/_residue-docs-demo-pc-1.md"
```

```markdown
# Session residue — (no session anchor in the transcript)

- **Session:** `docs-demo-pc-1`
- **Written:** 2026-09-25T22:32:15Z (PreCompact, trigger=`auto`)
- **Branch:** `(not a git worktree)` @ `unknown`
- **Repo:** `/tmp/t5pc2`
- **Transcript:** `/tmp/t5pc2/tr/main.jsonl`
- **Body source:** recap
- **Model handoff:** `/tmp/t5pc2/out/_handoff-docs-demo-pc-1.md` (absent)
- **Observed context ceiling:** 101 tokens (usage at this auto-compaction — the window estimate the next turn is judged against)

## Last model-authored state (verbatim from the transcript)

## 🟢 In plain words

Fix the flaky timeout test.

Next: rerun the suite twice.
```

Two numbers in that file are earned, not copied. The **observed ceiling** is
the usage sum — input plus cache reads — on the *last main-thread* assistant
entry at the instant the harness declared the window spent (lines 227-255).
The demo transcript's last main-thread entry sums to 101; the 555-token
subagent turn sits between entries and must not be counted, because a
subagent's usage is not the main thread's window — the
`select(.isSidechain != true)` filter is load-bearing for the body extraction
(lines 192-203) and again here. A computed 0 is discarded rather than written:
a zero floor would fire the reader's arm on every turn, strictly worse than
silence (lines 249-252). A **manual** `/compact` is never measured — a live
probe caught PreCompact firing on a manual compaction that was then refused,
so a manual trigger can carry an arbitrarily small sum (header lines 50-52);
its residue line reads `(not measurable from this trigger)` and no ceiling
file is written.

The ceiling has a named reader — the contract file
`${TMPDIR}/aif-ctx-observed-<session-key>` is read by the
[end-of-turn-reminder](end-of-turn-reminder.md) Stop hook's context arm
(header lines 31-48), and the residue file itself is read by the /pipeline
injection and by [inject-handoff-on-compact](inject-handoff-on-compact.md) at
the next session start. A file nobody reads is exactly the
`#warning-nobody-reads` anti-pattern (.claude/rules/
attention-is-not-a-mechanism.md §2), which is why the header names its readers
rather than hoping for them (lines 26-29).

The same auto-compaction also resets three things by **exact name** — the
end-of-turn reminder's `soft` and `deep` debounce flags and the handoff-currency
baseline — because a compaction is what makes an earlier reminder spent history,
and nothing else ever cleared them (header lines 54-69; the D34 baseline at
lines 268-278). Exact names, never a glob: the directory is full of `aif-`
prefixed channels, and a wildcard sweep would take the measurement with the
flags. The demo pre-creates both flags plus a decoy with underscores in place
of dashes:

```bash
: > "$D/tmp/aif-ctx-docs-demo-pc-1-soft"; : > "$D/tmp/aif-ctx-docs-demo-pc-1-deep"
: > "$D/tmp/aif-ctx-docs_demo_pc_1-soft"   # decoy — not a contract name
# … run the hook as above, then:
ls "$D/tmp"
```

```text
aif-ctx-docs_demo_pc_1-soft
aif-ctx-observed-docs-demo-pc-1
```

Both contract files are gone; the decoy survives. Even a session with **no
transcript at all** still gets its residue — anchor, timestamp and branch are
unconditional (D8; demo with `transcript_path` pointing nowhere produces a
file whose body source reads `none`).

## Evidence

- `.claude/hooks/precompact-residue.sh:2` is the header the card's description row
  quotes: `# precompact-residue.sh — PreCompact hook — writes the session-residue note before compaction`.
- Non-blocking by choice: lines 20-24 — PreCompact can block with exit 2 and this hook
  never does; the file runs `set -uo pipefail` without `-e` for the same reason.
- Named reader: lines 26-29 cite the /pipeline §1 injection block and the
  `#warning-nobody-reads` rule; the machine-readable contract (`#aif-ctx-observed`)
  is specified at lines 31-48 with the refused-compact evidence for auto-only at 50-52.
- Debounce reset contract: lines 54-69 — exact names
  `${TMPDIR}/aif-ctx-<session_key>-{soft,deep}`; implementation at lines 257-266; the
  D34 handoff-baseline reset (`aif-handoff-<key>.v2`, exact names, auto-only) at
  lines 268-278.
- Session key: line 123 — `tr -c 'A-Za-z0-9._-' '_'` sanitisation so a hostile id
  cannot escape the directory; the timestamp fallback for an absent id at lines 120-121.
- Residue directory: guarded source of `.claude/hooks/lib/residue-dir.sh` with an
  identical inline fallback at lines 138-164 — a missing lib degrades, never aborts.
- Body extraction: recap marker (default `## 🟢 In plain words`, lines 105 and 94-104
  for the language packs), sidechain filter at lines 192-203, fallback excerpt at
  lines 219-223, line caps at 212-214.
- Ceiling: `select(.isSidechain != true)` extraction with the `tail -50` jq-parse bound at
  lines 237-240, the usage sum (input + both cache counters) at lines 242-245, the
  0-discard guard at lines 246-249, the write at lines 253-254 — swallowed on failure
  like every side effect here.
- Registration: `.claude/settings.json:237` (`PreCompact`) with the command at line 242.
- Paired test: `packages/core/hooks/precompact-residue.test.ts` — stdout silence (line
  172, D8), sidechain exclusion (230), no-transcript write (264), recap capture (198),
  excerpt fallback (249), anchor rules (274, 304, 331), id sanitisation (344).
