# Measurement scripts — README

## 1. What this is

Three scripts behind the measurement table in
`docs/superpowers/specs/2026-09-13-plain-words-recap-v2-design.md` (the table at lines 25-34),
vendored 2026-09-13 so a number in that table can be re-derived rather than trusted:

- `measure-recap-len.py` — shape of the `## 🟢 Простыми словами` recap block (length, question
  presence, distribution over blocks and over whole messages).
- `measure-interaction-shape.py` — turn-level classification (re-explain asks, handoff asks, bare
  confirmations, autonomy complaints, «жду го»-class agent waits, recap emissions and what follows
  them).
- `measure-permission-denials.py` — real harness permission denials, ranked by tool-call prefix.

All three are read-only over transcript files (stdlib only, no writes) and print a small
self-describing header before their measurement keys (§3).

## 2. Row → script

One row per spec-table claim, naming the script and the exact output key(s) it printed.

| Spec row | Spec value | Script | Output key(s) |
|---|---|---|---|
| Transcripts scanned / sessions containing a block | 361 / 240 | `measure-recap-len.py` | `transcripts_scanned` / `sessions_with_block` |
| Operator re-explain asks | 100 | `measure-interaction-shape.py` | `reexplain_asks` (mapping inferred — see below) |
| Turns ending in «жду го»-class waits | 636 | `measure-interaction-shape.py` | `agent_wait_phrases` |
| … vs real harness blocks | 101 | `measure-permission-denials.py` | `denied_tool_calls` (mapping inferred — see below) |
| `## 🟢 Простыми словами` blocks emitted | 1607 | `measure-recap-len.py` | `blocks` |
| Block non-empty lines p50 / p90 / max | 7 / 10 / 41 | `measure-recap-len.py` | `block_lines_p50` / `block_lines_p90` / `block_lines_max` |
| Blocks over 15 lines / over 25 | 36 (2.2 %) / 5 | `measure-recap-len.py` | `blocks_over_15` / `blocks_over_25` (the % is `blocks_over_15 / blocks`) |
| Whole-message lines p50 / p90 / max | 11 / 25 / 80 | `measure-recap-len.py` | `message_lines_p50` / `message_lines_p90` / `message_lines_max` |
| Blocks containing a question | 6 % | `measure-recap-len.py` | `blocks_with_question_pct` (count in `blocks_with_question`) |
| `## 🎬` story emissions | 166 | NONE — a one-off `grep -l` | no script, no key |

### Re-run 2026-09-13 (slice 0)

The spec's table is the design-time evidence and stays as ratified — the decisions were made
from those numbers. This is a re-derivation from the vendored scripts on the same machine, for
falsification, not a replacement baseline. All three scripts were run on bare defaults (no
`--days` / `--min-size` override), per `scripts/measure/measure.test.sh`'s own invocation shape
and per README §3 above. Full run headers and raw output are in the task-0.6 report.

Run headers (verbatim):

- `measure-recap-len.py`: `root: /Users/art/.claude/projects`, `glob: -Users-art-code-rules-as-tests-aif*`, `window: all (no time filter)`, `min_size: none`, `marker: ## 🟢 Простыми словами`.
- `measure-interaction-shape.py`: same root/glob, `window: from 2026-08-09 to 2026-09-13`, `min_size: 150000`, `days: 35`, `transcripts_scanned: 268`.
- `measure-permission-denials.py`: same root/glob/window/min_size/days, `transcripts_scanned: 268`.

| Spec row | Spec value | Re-run | Note |
|---|---|---|---|
| Transcripts scanned / sessions containing a block | 361 / 240 | 380 / 254 | +5.3% / +5.8% — in line with ordinary corpus growth over the day; not material. |
| Operator re-explain asks | 100 | 131 | +31%, from `measure-interaction-shape.py`'s `reexplain_asks` (mapping inferred). Same run, same 268-transcript population as the row below, where the evidence-backed `agent_wait_phrases` counter moved only +4.1% — this row moved ~7.5x more than corpus growth explains. Finding, not adjusted: see below. |
| Turns ending in «жду го»-class waits | 636 | 662 | +4.1% (`agent_wait_phrases`, evidence-backed by the `ASKC` regex) — this is the baseline for what corpus growth alone should produce over the same 268-transcript run. |
| … vs real harness blocks | 101 | 115 | +13.9%, from `measure-permission-denials.py`'s `denied_tool_calls` (mapping inferred). Different script/population than the row above so not a same-run comparison, but still well above the +4.1% evidence-backed baseline. Finding, not adjusted: see below. |
| `## 🟢 Простыми словами` blocks emitted | 1607 | 1718 | +6.9% (`blocks`) — tracks `sessions_with_block`'s +5.8% growth; not material. |
| Block non-empty lines p50 / p90 / max | 7 / 10 / 41 | 7 / 10 / 41 | Unchanged — block-length distribution shape is stable. |
| Blocks over 15 lines / over 25 | 36 (2.2 %) / 5 | 36 (2.1 %) / 5 | Absolute counts (`blocks_over_15`, `blocks_over_25`) unchanged even though total `blocks` grew by 111; the percentage drifted only because its denominator grew. Not a mapping concern. |
| Whole-message lines p50 / p90 / max | 11 / 25 / 80 | 11 / 25 / 80 | Unchanged. |
| Blocks containing a question | 6 % | 6 % | Unchanged (`blocks_with_question: 111` of 1718, same ratio). |
| `## 🎬` story emissions | 166 | not re-derivable | No script exists for this row (see honesty note 1 above) — the 166 figure came from an ad-hoc `grep -l` at authoring time. Retrofitting a script for it is a follow-up task, not part of this re-run. |

**Finding — the two `mapping inferred` rows move far more than corpus growth explains.** Within
the identical `measure-interaction-shape.py` run (268 transcripts, same window), the
evidence-backed `agent_wait_phrases` counter grew +4.1% while the inferred `reexplain_asks`
(`CLAR` bucket) grew +31% — a ~7.5x gap on the exact same population. `denied_tool_calls`
(`measure-permission-denials.py`, also inferred) grew +13.9%, likewise above the +4.1% baseline,
though that script has no evidence-backed counter-row in the same run to compare against
directly. This is consistent with README §2's own warning: a defaults re-run landing far from
the spec value after accounting for corpus growth means the mapping is questionable, not that the
number should be quietly adjusted. Numbers are left as measured; the mapping's soundness is a
question for whoever owns the CLAR/harness-block classification regexes, not something this task
resolves.

Two honesty notes on this table:

1. **The `## 🎬` row has no script.** The 166 figure came from an ad-hoc `grep -l` over
   transcripts at authoring time and is the one number in the spec table that this slice does
   NOT make re-derivable. Do not invent a command that "would" produce it — if it needs to become
   re-derivable, that is a follow-up task, not something to retrofit into this README.
2. **Evidence-backed vs inferred mappings.** The 636 mapping (`agent_wait_phrases`) is
   evidence-backed: the `ASKC` regex at `measure-interaction-shape.py:51-57` is literally the
   «жду го» vocabulary (`жду твоего`, `дай го`, `твой клик`, `решай ты`, `GO оператора`, …), so
   that row is that counter and nothing else. The 100 (`reexplain_asks`, the `CLAR` bucket) and
   101 (`denied_tool_calls`) mappings have no such provenance note and are marked
   `mapping inferred` above. A defaults re-run (task 0.6) landing nowhere near these two spec
   values, after accounting for corpus growth, means the mapping is wrong — that is a finding for
   the PR body, not a number to quietly adjust.

## 3. How to re-run

Every number in the spec table is machine-and-date-bound: the scripts default to
`~/.claude/projects` on the author's machine, filtered to this project's transcript glob. Run
them yourself to get today's numbers, not the spec's:

```bash
python3 scripts/measure/measure-recap-len.py \
  --root ~/.claude/projects --glob '-Users-art-code-rules-as-tests-aif*'

python3 scripts/measure/measure-interaction-shape.py \
  --root ~/.claude/projects --glob '-Users-art-code-rules-as-tests-aif*' --days 35

python3 scripts/measure/measure-permission-denials.py \
  --root ~/.claude/projects --glob '-Users-art-code-rules-as-tests-aif*' --days 35
```

All three take `--root` and `--glob`. `measure-interaction-shape.py` and
`measure-permission-denials.py` additionally take `--days` (default 35) and `--min-size` (default
150000) — the two filters they actually apply. `measure-recap-len.py` takes neither, because it
has neither filter; its third option is `--marker` (default
`## 🟢 Простыми словами`). Passing `--days` or `--min-size` to it is an argparse error, not a
no-op. Each script carries an `_argv_with_equals()` helper because a glob
value beginning with `-` (like the default above) is rejected by bare argparse — that helper is
why `--glob '-Users-art-...'` works as a normal `--opt value` pair instead of needing `--opt=value`
on the command line.

Every run prints a five-key self-describing header before its measurement keys, so a re-run line
is only auditable if it states its own root, glob, window and min-size — a number pasted without
its header is not evidence of anything:

- `measure-recap-len.py` prints `run_utc, root, glob, window, min_size, marker`, where `window` is
  always the literal `all (no time filter)` and `min_size` is always the literal `none` — this
  script has neither filter.
- `measure-interaction-shape.py` and `measure-permission-denials.py` print
  `run_utc, root, glob, window, min_size, days`, where `window` is a real computed
  `from <date> to <date>` range.

## 4. A re-run is a falsifier, not a new baseline

The numbers in the spec table are dated 2026-09-13. A later re-run produces DIFFERENT numbers
because the corpus grew; that is not a defect and is not a reason to edit the spec's table in
place. If a re-run contradicts a decision the spec argues FROM, that is a finding — raise it, do
not silently restate the evidence under a ratified decision.

## 5. Do not "improve" the counting

The percentile helper's nearest-rank formula (`measure-recap-len.py:19-21` — sort, then index at
`int(len(v) * p)`, no interpolation) and the classification regex table in
`measure-interaction-shape.py` (`CLAR`, `ASKC`, `CONFIRM`, `AUTON`, …) are the measurement, not an
implementation detail of it. Changing either invalidates every row in §2 that cites its output —
re-deriving the whole spec table, not just re-running the script, would be required.

## 6. Test

```bash
bash scripts/measure/measure.test.sh
```

This is the oracle for "the vendored scripts still count the way the spec table assumes": it runs
each script against a fixture directory with hand-counted contents and asserts the printed keys
match the hand count, rather than only asserting that a script runs without crashing
(`#hope-as-gate`, `.claude/rules/attention-is-not-a-mechanism.md` §2). It does not validate the
spec table's own numbers — only that re-running the scripts on a known input reproduces a known
output.

One documented edge case the test also covers: in `measure-recap-len.py`, ten of the eighteen
header/measurement keys print only inside `if lens:` (there is at least one block to measure), so
a zero-match run emits the five-key header plus only `transcripts_scanned`, `sessions_with_block`,
`blocks`, `marker` and the window/min_size pair — never the percentile or question-count keys.
That mirrors the vendored original's behaviour and is a known, deferred minor; it is not a bug to
fix as part of this doc.
