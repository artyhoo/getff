# open-issues fix waves — W2-F: /pipeline helpers

> **Umbrella:** [kickoff.md](kickoff.md) — §0 binding execution rules, §1 D8 and §2 file-lock
> matrix are binding; this file restates only what the executor needs, and where it widens the §2
> file-lock row it says so (§3).
> **Class:** stage kickoff (dispatch input). **Base branch:** `staging`. **Branch:**
> `fix/pipeline-helpers`. **PR title:** `W2-F: pipeline helpers`. **Channel:** one aif task, own
> worktree, one PR to `staging` (harvested from the host — never pushed from the container).
> **Rigor label (L0):** `build-and-verify` — the helpers ship to consumers (pipeline skills are
> installed content), and both defects render a wrong answer as a clean one.
> **Authoritative for:** the W2-F contract — anchors measured at the SHA below, the regression
> test, exit gates, falsifiers.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> D8 itself — owned by [kickoff.md §1](kickoff.md).

**Measurement SHA for every `path:line` below:** `5e3768d6c57473ba5dca60d496b9c5d8478eda88`
(`staging` after W1-E, #1832). Re-locate by content (`grep -n`) if yours differ. This file was
cold-reviewed before dispatch (round 1 REVISE, 1 BLOCKER + 5 MAJOR, all folded in below).

**Dependencies:** none. W2-E runs in parallel on disjoint files.

**Closes (in the PR BODY):** #1518, #1517. Each gets an English closure comment: its recorded
`Failure-scenario:` → the fix → the verify evidence. Read both WITH comments
(`gh issue view N --repo artyhoo/getff --comments`) — the review comments carry a trap (§1 item 4).

## §1 Deliverables (D8)

1. **#1517 (a) — the reported basis is wrong.** `.claude/skills/pipeline/helpers/dup-detect.sh:123`
   emits `basis=xref score=100%`, but `.claude/skills/pipeline/helpers/priority-score.sh:250`
   hardcodes `done_basis="jaccard${_c2_score:+ ${_c2_score}}"`. Pass the true basis through from the
   dup-detect line.
2. **#1517 (b) — gate Signal 1.** `.claude/skills/pipeline/helpers/dup-detect.sh:113` collects
   cross-references with `grep -oE '#[0-9]+'` over the **whole** kickoff; Signal 1 (`:121-124`)
   then flags the umbrella against ANY merged-30d PR whose number appears anywhere in it, and
   `priority-score.sh:240-250` consumes that as completion layer C2 — so an ACTIVE umbrella that
   records its merged stages inline is classified DONE and dropped before ranking
   (`.claude/skills/pipeline/SKILL.md:163`: «drops DONE BEFORE filter, never after»).
   - A merged PR cited as PROVENANCE must not classify the umbrella DONE; only completion-bearing
     citations may.
   - Candidate rules (issue body): exclude xrefs inside rows already carrying a
     `MERGED`/`CLOSED`/`DONE` marker, or require agreement with `frontier.sh` (a non-empty
     `FRONTIER:` means not DONE). Pick one, record the choice and why the other lost in
     `DECISIONS`, and update the `.claude/skills/pipeline/SKILL.md:163` wording to match.
   - The structural bind the issue names: `frontier.sh` REQUIRES merge evidence (`#<num>`) near a
     `MERGED` marker to count a stage done. The fix must not push authors toward deleting PR
     numbers another helper of this skill demands.
3. **#1518 — launch-table stage ids.** `.claude/skills/pipeline/helpers/launch-table-generator.sh:81`
   (primary path, under a `## §N Sub-wave` heading) and `:95` (fallback) accept first-cell ids only
   as `([A-D]|[0-9]+)` (`:42` documents «plain letter A-D»). Real ids in #1518 are `K0`, `KD`,
   `KA`, `today-hero`.
   - **Specify the grammar directly** — e.g. a case-insensitive `[A-Za-z][A-Za-z0-9-]*` or
     `[0-9]+`, with the table's header and separator rows excluded. Do NOT reuse `STAGE_KICKOFF_RE`
     (`packages/core/principles/kickoff-population.ts:34`, `/^kickoff-[a-z]\d[a-z0-9]*\.md$/`): it
     is a FILENAME grammar that requires a lowercase letter then a digit, so it rejects `KD`,
     `today-hero` and today's plain `A`-`D`. Existing `A`-`D` / digit tables must still parse.
4. **#1518 — both paths degrade loudly, and the swallow goes.**
   - The kill site is `launch-table-generator.sh:106` (`detect_subwaves | sed …` under
     `set -euo pipefail`, `:13`), where a zero-match `grep` ends the script.
   - **Trap from the #1518 review comment:** fixing only the fallback leaves the PRIMARY path
     silent. A `## §N Sub-wave` heading plus K-style ids exits 0 with an EMPTY skeleton today (a
     real in-repo instance: `adapter-jig-meta-launch`). On zero parsed rows in EITHER path, print
     a `DEGRADE:` line and exit non-zero on purpose.
   - `.claude/skills/pipeline/SKILL.md:278` runs the generator with `2>/dev/null`, and the §3
     blocking rule (`:313`) halts only on a literal «MISSING kickoff». Drop the swallow and make the
     blocking rule halt on `DEGRADE:` too. Keep the `@dual-pair: meta-orchestrator-dispatch-from-state`
     marker on `.claude/skills/pipeline/SKILL.md:313` intact (its pair is `.claude/skills/pipeline/helpers/dispatch-from-state.sh:33`).

## §2 Proof — a deterministic test, because the live repro has decayed

- **The live corpus will not show the bug today.** At the measurement SHA, `dup-detect.sh
  getff-ai-site` and `dup-detect.sh plain-words-recap-v2` both print `OK` (the #1517 repro,
  `done_pr=1773`/`1779`, aged out of the 30-day window), and every DONE in the corpus comes from
  `basis=done` or `basis=branch`, none from C2. A before/after `status=` diff will therefore be
  EMPTY — that is not a pass. Run it anyway (read-only, no argument) and report it as context.
- **The proof is a vitest file** under `packages/core/skills/pipeline/` (next to
  `frontier.test.ts`, whose `spawnSync` + `mkdtempSync` fixture pattern at `:13-39` is the
  precedent). It spawns the real helpers against a fixture orch-home and a stub `gh` (seam
  `MO_GH_BIN`, `dup-detect.sh:22`/`:49`; also `MO_PR_WINDOW_DAYS`):
  - a fixture umbrella with a provenance-cited merged PR and an open stage → **ACTIVE**, and the
    basis names `xref` when it IS used;
  - one with a completion-bearing line (`Final PR: #N`) → **DONE**;
  - `launch-table-generator.sh` on a `K0`/`KD` fallback table → rows, exit 0; on a `## §N Sub-wave`
    heading with K ids → rows, exit 0; on an unparseable table → a `DEGRADE:` line, non-zero exit.
  - Show each case going **RED on the pre-fix helpers** (paste the failing run into the PR body).
- `.claude/skills/pipeline/evals/` is NOT the regression channel: its fixtures simulate injected
  state without running real `git`/`gh` (`evals.json` `_note`) and are graded from a session
  transcript. An eval is optional on top, never instead.

## §3 Regeneration and the docs-refresh gate

- **Payload (umbrella §0.3):** `scripts/build-getff-dist.sh`, then
  `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`. **Measure the drift before each
  capture.** Expected derived set: the pipeline skill's install fingerprints,
  `.ai-factory/refresh-baseline.json` if it covers the helpers, `packages/getff/MANIFEST.sha256`
  (the new test file under `packages/core/` is a MANIFEST entry), and the plugin skill copy if
  `plugin/skills/` carries the pipeline skill. A path outside that set is a STOP.
- **D26 docs-refresh gate** (`scripts/check-docs-refresh.mjs`; `packages/core/hooks/pre-push.ts:1502`,
  ALWAYS in `scripts/run-local-ci-sweep.sh:298`): `docs/site/reference/B/pipeline.md` lists
  `.claude/skills/pipeline/SKILL.md` in `sources:` and this stage edits it. Refresh that page, or
  give it a `docs-refresh: deferred — <reason>` frontmatter token (comma, never `: ` inside the
  token — E201). Either way this widens the umbrella §2 file-lock row by that page; say so in the
  PR body. A commit touching `docs/site/` needs a `Docs-card:` trailer.

## §4 Exit gates

```bash host-verify
PC_LOCAL=1 npx vitest run packages/core/skills/pipeline
node scripts/check-docs-refresh.mjs "$(git merge-base origin/staging HEAD)..HEAD"
bash scripts/check-skill-drift.sh
scripts/build-getff-dist.sh --check
PC_LOCAL=1 make self-audit
bash scripts/run-local-ci-sweep.sh
```

## §5 Falsifiers to write into the PR body

- The fixture umbrella with a provenance citation and an open stage reads `status=DONE` → Signal 1
  is not gated.
- A C2-sourced DONE reads `basis=jaccard` while its dup-detect line says `xref` → (a) not closed.
- The `Final PR: #N` fixture reads ACTIVE → the gate over-corrected.
- `launch-table-generator.sh` on a K-id table exits 1 with no `DEGRADE:` line, or exits 0 with an
  empty skeleton on the `## §N Sub-wave` path → #1518 not closed.
- A plain `A`-`D` table stops parsing → the grammar regressed.
- `SKILL.md` still pipes the generator to `/dev/null` → the next degrade is silent again.

## §6 Out of scope

- **Completion layer C1 (branch).** `open-issues-2026-09-fix-waves` itself reads
  `status=DONE done_pr=1802 basis=branch` because its PLANNING PR's branch
  (`docs/open-issues-2026-09-fix-waves`) matches the umbrella name (`priority-score.sh:229-237`,
  which runs before C2). Same class as #1517, different layer, not in D8. Record it in the PR body
  as a follow-up with that evidence; do not fix it, and it does not trip the §5 falsifiers.
- The type-vocabulary gap (`priority-score.sh:198-205` has no `umbrella` bucket) — file, don't fix.
- `done_pr` being «highest PR mentioned» rather than evidence — fix only if the Signal-1 rule you
  choose makes it fall out for free; otherwise a follow-up.
- Any other `/pipeline` helper.

## §7 Report (umbrella §5 template, strict)

`Stat` / `Verify` (each §4 gate, the §2 RED-then-GREEN runs, the read-only corpus run) /
`DECISIONS` (the Signal-1 rule chosen and why the other lost; the id grammar) / `ATTN` /
`Confidence`. PR body carries `## Fidelity verdict` and the §1.7 Forward-check / Backward-check
sections (umbrella §0.6).

## §8 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**T3** command-or-`file:line` for every claim · **T2** run the helpers, do not describe what they
would print · **T14** an empty corpus diff is «coverage insufficient», not «clean» — the §2 test
carries the proof · **T19** own cold review before handoff · **T21** cold
`agents/backward-sweep-auditor.md` on the class «a completion signal that reads a citation's or a
name's presence as evidence of completion» — C1 (§6) is one known instance; the sweep asks whether
`frontier.sh`, `plan-currency-check.sh` or another helper does the same.
