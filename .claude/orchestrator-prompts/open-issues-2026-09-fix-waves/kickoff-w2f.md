# open-issues fix waves — W2-F: /pipeline helpers

> **Umbrella:** [kickoff.md](kickoff.md) — §0 binding execution rules, §1 D8 and §2 file-lock
> matrix are binding; this file restates only what the executor needs.
> **Class:** stage kickoff (dispatch input). **Base branch:** `staging`. **Branch:**
> `fix/pipeline-helpers`. **PR title:** `W2-F: pipeline helpers`. **Channel:** one aif task, own
> worktree, one PR to `staging` (harvested from the host — never pushed from the container).
> **Rigor label (L0):** `build-and-verify` — the helpers ship to consumers (pipeline skills are
> installed content), and both defects render a wrong answer as a clean one.
> **Authoritative for:** the W2-F contract — anchors measured at the SHA below, the regression
> eval, exit gates, falsifiers.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> D8 itself — owned by [kickoff.md §1](kickoff.md).

**Measurement SHA for every `path:line` below:** `5e3768d6c57473ba5dca60d496b9c5d8478eda88`
(`staging` after W1-E, #1832). Re-locate by content (`grep -n`) if yours differ.

**Dependencies:** none. W2-E runs in parallel on disjoint files.

**Closes (in the PR BODY):** #1518, #1517. Each gets an English closure comment: its recorded
`Failure-scenario:` → the fix → the verify evidence.

## §1 Deliverables (D8)

1. **#1517 (a) — the reported basis is wrong.** `.claude/skills/pipeline/helpers/dup-detect.sh:123` emits
   `basis=xref score=100%`, but `.claude/skills/pipeline/helpers/priority-score.sh:250` hardcodes
   `done_basis="jaccard${_c2_score:+ ${_c2_score}}"`. Pass the true basis through from the
   dup-detect line.
2. **#1517 (b) — gate Signal 1.** `.claude/skills/pipeline/helpers/dup-detect.sh:113` collects cross-references with
   `grep -oE '#[0-9]+'` over the **whole** kickoff. Signal 1 (`:121-124`) then flags the umbrella
   against ANY merged-30d PR whose number appears anywhere in it. `priority-score.sh:240-250`
   consumes that as completion layer C2, so an ACTIVE umbrella that records its merged stages
   inline is classified DONE and dropped before ranking (`.claude/skills/pipeline/SKILL.md:163`: «drops DONE BEFORE
   filter, never after»).
   - A merged PR cited as PROVENANCE must not classify the umbrella DONE. Only
     completion-bearing citations may.
   - The issue body lists candidate rules: exclude xrefs inside rows already carrying a
     `MERGED`/`CLOSED`/`DONE` marker, or require agreement with `frontier.sh` (a non-empty
     `FRONTIER:` means not DONE).
   - Pick one, record the choice in `DECISIONS`, and update the `.claude/skills/pipeline/SKILL.md:163` wording to match.
   - Mind the structural bind the issue names: `frontier.sh` REQUIRES merge evidence (`#<num>`)
     near a `MERGED` marker to count a stage done. The fix must not push authors toward deleting
     the very PR numbers another helper of this skill demands.
3. **#1518 — launch-table stage ids.** `.claude/skills/pipeline/helpers/launch-table-generator.sh:81` and `:95` accept
   first-cell ids only as `([A-D]|[0-9]+)` (`:42` documents «plain letter A-D»).
   - A table whose ids are `K0`, `KD`, `w2e`, … matches zero rows. `grep` exits 1, and
     `set -euo pipefail` (`:13`) kills the script silently.
   - Accept the real stage grammar: the stage-kickoff family SSOT is `STAGE_KICKOFF_RE` in
     `packages/core/principles/kickoff-population.ts`. Reuse its shape, do not invent a third one.
   - On an unparseable table, print a `DEGRADE:` line and exit non-zero on purpose, instead of
     dying inside a pipe.
4. **#1518 — the swallow.** `.claude/skills/pipeline/SKILL.md:278` runs the generator with `2>/dev/null`, and §3's
   blocking rule (`:313`) halts only on a literal «MISSING kickoff». Drop the swallow, and make
   the blocking rule halt on `DEGRADE:` too.

## §2 Verify against the live corpus, not a synthetic one

#1517 was found on a consumer (`timeliner`, umbrella `app-finalization`), and D8's reopen-if
names the live corpus. So:

- Run `priority-score.sh` with no argument against this repo's `.claude/orchestrator-prompts/`
  (read-only) before and after the fix, and diff the `status=` column.
- Every umbrella whose status changes must be explained in the PR body, one line each:
  was DONE on a provenance citation → now ACTIVE, or the reverse.
- At minimum, show `open-issues-2026-09-fix-waves` itself. It cites merged W1 PRs in its own
  kickoff, and waves 2-3 are not done, so before the fix it is exactly the shape #1517 describes.
- Add a regression scenario under `.claude/skills/pipeline/evals/` (next to `evals.json`): a fixture umbrella with a
  provenance citation and an open stage must come out ACTIVE, and one with a `Final PR: #N`
  closure line must come out DONE. It must go RED on the pre-fix helpers. Show that in the
  PR body.
- For #1518, run the generator on a fixture table with `K0`/`KD` ids. Expect rows, not exit 1.
  Also run it on a malformed table and expect a `DEGRADE:` line with a non-zero exit.

## §3 Regeneration (umbrella §0.3)

After the edits: `scripts/build-getff-dist.sh`, then `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`.
**Measure the drift before each capture.** The expected derived set is:
- the pipeline skill's install fingerprints;
- `.ai-factory/refresh-baseline.json` if it covers the helpers;
- `packages/getff/MANIFEST.sha256`;
- the plugin skill copy, if the pipeline skill has one (check `plugin/skills/`).

A path outside that set is a STOP.

## §4 Exit gates

```bash host-verify
PC_LOCAL=1 npx vitest run packages/core/skills/pipeline
bash scripts/check-skill-drift.sh
scripts/build-getff-dist.sh --check
PC_LOCAL=1 make self-audit
bash scripts/run-local-ci-sweep.sh
```

If `packages/core/skills/pipeline` holds no tests for these helpers, say so in `Verify` with the
`ls`, and let the §2 eval plus the before/after corpus diff carry the proof.

## §5 Falsifiers to write into the PR body

- An umbrella with an open stage still reads `status=DONE` → Signal 1 is not gated.
- A DONE umbrella reads `basis=jaccard` while its dup-detect line says `xref` → (a) not closed.
- An umbrella that really is finished now reads ACTIVE → the gate over-corrected. Name the one
  you checked.
- `launch-table-generator.sh` on a `K0` table exits 1 with no `DEGRADE:` line → #1518 not closed.
- `SKILL.md` still pipes the generator to `/dev/null` → the next degrade is silent again.

## §6 Out of scope

- The type-vocabulary gap (`priority-score.sh:198-205` has no `umbrella` bucket). The issue calls
  it minor; file it, do not fix it here.
- `done_pr` being «highest PR mentioned» rather than evidence. Fix it only if the Signal-1 rule
  you choose makes it fall out for free; otherwise record it as a follow-up.
- Any other `/pipeline` helper.

## §7 Report (umbrella §5 template, strict)

`Stat` / `Verify` (each §4 gate and the §2 corpus diff with observed output) / `DECISIONS` (the
Signal-1 rule chosen, and why the other candidate lost) / `ATTN` / `Confidence`. PR body carries
`## Fidelity verdict` and the §1.7 Forward-check / Backward-check sections (umbrella §0.6).

## §8 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**T3** command-or-`file:line` for every claim · **T2** run the helpers on the live corpus, do not
describe what they would print · **T1** the corpus diff covers every umbrella, not the first
three · **T19** own cold review before handoff · **T21** cold `agents/backward-sweep-auditor.md`
on the class «a completion signal that reads a citation's presence as evidence of completion». The
sweep asks whether `frontier.sh`, `plan-currency-check.sh` or another helper does the same.
