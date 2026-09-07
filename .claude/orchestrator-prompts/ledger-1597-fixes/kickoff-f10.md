# KICKOFF — ledger-1597-fixes / F10 — document the undocumented consumer knobs (D-7c)

> **Umbrella:** [kickoff.md](kickoff.md) — read §2 scope lock and §3 constraints first; this is a **§1b tail stage**, docs-only.
> **Rigor label (effort-worthiness L0):** `build-and-verify`.
> **Findings:** campaign addendum D-7c (from PR #1646's sibling sweep). Line numbers at `fbd14c2f69`.

## Task

Document, in the consumer-facing docs, every environment knob the sweep found undocumented: one runtime knob read inside a delivered hook (`RULES_DIR_OVERRIDE`, `.claude/hooks/inject-matching-rule.sh:38`) and four install-time knobs (`GETFF_LANES`, `GETFF_SKILLS_CORE`, `GETFF_SKILLS_FACTORY`, `AIF_ARCH_TARGET`). Each entry states what the knob does, at which moment it is read (install vs runtime), its default, and what it does NOT do — established by RUNNING it, not by reading it (the #1640/#1646 method). One PR to `staging`.

## Context (data — the addendum)

### D-7c — consumer knobs with zero doc coverage
- **Where:** `RULES_DIR_OVERRIDE` — `.claude/hooks/inject-matching-rule.sh:38` (runtime, inside a delivered hook; same class as `GETFF_SKIP_HOOKS`, non-GETFF prefix). `GETFF_LANES` — `setup.d/lib.sh:921-924` (install-time lane table; `getff_lane_expected` / `getff_lane_installed`). `GETFF_SKILLS_CORE` / `GETFF_SKILLS_FACTORY` — `setup.d/lib.sh` skill tier sets (`grep -n GETFF_SKILLS setup.d/lib.sh setup.d/10-skills.sh`). `AIF_ARCH_TARGET` — `grep -rn AIF_ARCH_TARGET setup.d install.sh`.
- **Defect:** 0 hits for any of them in `*.md` outside kickoffs/meta-factory (measured 2026-09-06; `GETFF_SKILLS_FACTORY` appears only in `.claude/skills/orchestrator/SKILL.md`). A consumer cannot discover them; an AI agent reading INSTALL-FOR-AI.md cannot either.
- **Already known:** `RULES_DIR_OVERRIDE` is labelled a TEST SEAM at `.claude/hooks/inject-matching-rule.sh:36` («kickoff S6 §2 planner decision 2 — env-var over …»). Expected outcome: rejected as internal with that line cited — unless you find a consumer-facing surface that reads it, in which case document it as such.
- **Caveat established by #1646:** not every `GETFF_*` variable is a knob — most are internal locals. For each of the five, first decide from the code whether it is a USER-FACING knob (read from the environment at a boundary the consumer controls) or an internal constant; document only the knobs, and list the ones you rejected with the line that proves they are internal.

## Constraints

- Doc home: `INSTALL.md` (its «Environment knobs» area created by #1646, INSTALL.md:399-412 — extend it) for install-time knobs; the runtime knob goes next to the `GETFF_SKIP_HOOKS` runtime entry. `INSTALL-FOR-AI.md` is AT the 600-line pre-commit cap (`.husky/pre-commit:92`): add at most ONE pointer line there, and only if a line can be freed honestly (do not trim other prose). If a knob belongs to `docs/runtime-bridge-setup.md` (aif/profile knobs), put it there.
- Owned files: `INSTALL.md`, `docs/runtime-bridge-setup.md`, `INSTALL-FOR-AI.md` (one pointer line max). Neither INSTALL.md nor INSTALL-FOR-AI.md is in `packages/getff/MANIFEST.sha256` (verify with `grep -c`); if a doc you touch IS pinned, regenerate the manifest in the same commit. Do not run `prettier --write` over a whole doc (it reflows pre-existing prose — #1640 trap); keep the diff to your sections. `npx markdownlint-cli2 <files>` must report 0 errors.
- Prove each knob live on a mktemp consumer: one run without, one with the knob, quote the delta (tree diff or log line). For `RULES_DIR_OVERRIDE`, run the delivered hook with and without it and quote which rules dir it reads.
- Iteration cap: 5 tool-loop rounds; then report PARTIAL listing the knobs still undocumented.

## Tools

Bash, Read, Edit, Grep, git.

## Output

A REPORT with a literal `Status: DONE|BLOCKED|PARTIAL` line, `Deliverable:`, `Evidence:` (the per-knob before/after runs quoted; the rejected-as-internal list with line numbers), `BLOCKER:`/`MINOR:` per [agents/orchestrator-worker-discipline.md](../../../agents/orchestrator-worker-discipline.md). Name the active traps from the umbrella §4.

## AI-traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**T3**, **T5**, **T14**, **T19**, **T20** (umbrella §4), plus **T2** (a doc entry written from reading the code, without the run, is «would behave», not documentation).

## Verify

1. `grep -rn '<KNOB>' INSTALL.md docs/runtime-bridge-setup.md` finds every documented knob; the rejected list carries a `file:line` each.
2. Per-knob delta quoted from a live run.
3. `npx markdownlint-cli2 INSTALL.md INSTALL-FOR-AI.md docs/runtime-bridge-setup.md` → 0 errors; `wc -l INSTALL-FOR-AI.md` ≤ 600; `bash scripts/build-getff-dist.sh --check` in sync.

```bash host-verify
npx markdownlint-cli2 INSTALL.md INSTALL-FOR-AI.md docs/runtime-bridge-setup.md
bash scripts/build-getff-dist.sh --check
bash scripts/run-local-ci-sweep.sh
```
