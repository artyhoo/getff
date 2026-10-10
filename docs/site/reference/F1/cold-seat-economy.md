---
title: cold-seat-economy rule
description: The rule that decides when an expensive fresh-agent audit is actually earned — re-audit on substance, not on commit count, and spend the expensive seat last.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/rules/cold-seat-economy.md
  - .claude/rules/00-rule-index.md
  - packages/core/principles/31-rule-channel-declaration.ts
  - packages/core/principles/50-cold-seat-inputs-ref.test.ts
  - scripts/snapshot-for-seat.sh
  - .claude/skills/dispatcher/references/execution.md
  - .claude/skills/harvest/SKILL.md
  - .claude/skills/orchestrator/references/reviewer-template.md
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: snapshot-inputs-ref, stack: repo, date: 2026-10-07, result: printed }
---

# cold-seat-economy rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- getff:begin section=F1-card-cold-seat-economy plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `cold-seat-economy` |
| kind | rule |
| ships-to | framework |
| description | the cold-seat economy discipline — §1 re-audit on substance not SHA, §2 seat ordering (expensive WHAT-audit last, on the final diff), §3 follow-up rounds (fresh narrow seat + watch-list by default; resume the exception), §4 anti-patterns, §5 promotion / retirement, §7 immutable seat inputs + one named ref per answer. |
| source | `.agents/rules/cold-seat-economy.md:17` |
| class | C |
| fires | re-running a cold seat; resume-vs-fresh; pinning seat inputs to a SHA. |
| channels | skill-embed(3) |
<!-- getff:end section=F1-card-cold-seat-economy -->

<!-- vale on -->

## Explanation

A "cold seat" is a fresh AI agent handed a review job with no memory of writing the
work — the project's most expensive instrument, and the one most tempting to
re-run, because re-running feels like rigour. This [rule](../../terms.md#rule) is
the counterweight: it decides when a re-audit is earned, and makes the expensive
seat cheap to skip when nothing it judges has moved.

Three decisions carry the rule. First, re-audit on substance, not SHA: a new commit
that moves none of what the seat judges earns a narrow delta check, not a full
re-run — and the resume path (waking the original auditor) is the exception, taken
only when a watch-list cannot carry the follow-up. Second, order the seats: the
expensive "what does this actually change" audit runs last, on the final diff, so
it never has to be repeated because an earlier seat found something. Third, every
follow-up round starts from the previous seat's watch-list — the specific things it
said it could not verify — instead of re-deriving scope from zero.

The measured cost of getting this wrong is recorded in the rule's own table. One
review question, two delivery forms:

| Seat | Tokens | Tool calls | Wall time |
|---|---|---|---|
| fresh agent (executor tier), inputs inlined, zero tools | 85,855 | 0 | 16 s |
| fresh agent (executor tier), narrow 4-file review | 177,105 | 7 | 137 s |

Inlined inputs cost twice the tokens and a fraction of the time. That trade is
the whole point of §7, the one part of the rule backed by a shipped test: seat
inputs are immutable (files as they were at one pinned commit, never live worktree
paths), and every answer names the commit it was taken at. The class row is `C` —
prose, not a gate — and §7 is the honest exception where part of the discipline
became mechanical: the shipped test asserts that the dispatch templates carry the
`Inputs-ref:` placeholder as a fenced field, so filling it is unavoidable; whether
it was filled with a real SHA stays judgment, and the test's own header says so.

The tool behind that field is a small repo script. Run it and it prints the ref to
paste into the seat prompt, then hands out read-only copies of the files as they
were at that commit:

```bash
bash scripts/snapshot-for-seat.sh HEAD .claude/rules/cold-seat-economy.md
```

```text
Inputs-ref: 0e909fb2e3977372d54dee053fd0b49317a9ecc2
/tmp/seat-snapshot.21r3F5/.claude__rules__cold-seat-economy@0e909fb2e397.md
```

The snapshot files are written read-only (`mode 0444`), and the script writes them
into a fresh temp directory it does not delete — remove the printed directory when
the seat is done (`rm -rf` on the printed path).

The `channels` row says `skill-embed(3)`: the rule text is carried into three
skill files as embedded summaries, so an agent running those skills meets the
discipline at the moment it dispatches work. Honest state of those three carriers
at this base: the orchestrator carrier is live and its anchor resolves; the
harvest carrier is a prose pointer to its fidelity reference; the dispatcher
carrier lives in the skill's `references/` file rather than the file the marker
names. The companion channel-marker check passes a rule on any one live carrier
and reports the stale ones as diagnostics, so the rule reads green with two stale
markers — a state the rule's own maintenance section expects someone to tidy.

What the rule does not do: it cannot judge whether a commit moved substance —
that call stays with whoever orders the seats, which is why the rule is advice
shaped as rules rather than a gate. And it does not make the delta check
optional; narrower is not skipped.

## Evidence

Checked 2026-10-07 against the working tree this batch was written in.

- The three decisions: `.claude/rules/cold-seat-economy.md:28` (§1 re-audit on
  substance), `:58` (§2 seat ordering), `:67` (§3 follow-up rounds and the resume
  exception).
- The measurement table rows quoted above: `:83` (file-reading form) and `:84`
  (inputs-inlined form).
- §7, immutable inputs and one named ref per answer: `:164`.
- The shipped test for §7: `packages/core/principles/50-cold-seat-inputs-ref.test.ts`
  — sweeps every markdown dispatch template under `.claude/skills/` (by predicate,
  plus declared extras) and requires the `Inputs-ref:` placeholder inside a fenced
  block; its own header states that filling the ref with a real SHA remains
  judgment at dispatch time.
- The snapshot tool and its printed contract: `scripts/snapshot-for-seat.sh:1` to
  `:20` (usage, `Inputs-ref:` stdout line, mode-0444 files, exit codes).
- The three skill-embed carriers and their markers:
  `.claude/rules/cold-seat-economy.md:3` (harvest), `:4` (dispatcher),
  `:5` (orchestrator). Live state at this base: the orchestrator anchor resolves at
  `.claude/skills/orchestrator/references/reviewer-template.md:16`; the harvest
  pointer is `.claude/skills/harvest/SKILL.md:74`; the dispatcher embed text is at
  `.claude/skills/dispatcher/references/execution.md:196` to `:204`, not in
  `dispatcher/SKILL.md` itself.
- The index row grading this rule class `C` with channels `skill-embed(3)`:
  `.claude/rules/00-rule-index.md:16`.
- The companion channel-marker check's pass-on-any-live semantics:
  `packages/core/principles/31-rule-channel-declaration.ts` — the marker
  validation returns `ok` when at least one marker's anchor is found, with stale
  markers carried as reasons, not failures.
