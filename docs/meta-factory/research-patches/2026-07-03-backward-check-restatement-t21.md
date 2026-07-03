<!-- scope:backward-check-restatement-t21 -->
# Backward-check restatement-theatre — T21 self-review patch

> Scope: the 2026-07-03 codification of trap **T21** `#backward-check-restates-not-sweeps` + the cold `agents/backward-sweep-auditor.md` + the §1.7 enumeration format. Individual-file authority inherited from [research-patches/README.md](README.md).

## Problem

Deep in a long (~90-turn) session, a `### §1.7 Backward-check applied` degrades from an outward **sweep** (sibling surfaces where the change-class must also hold) into an inward **restatement** of the PR's own changes. The restatement clears CI ([discipline-self-check.yml](../../../.github/workflows/discipline-self-check.yml): ≥40 chars + ≥1 `file.ext:line`) because both arms are satisfied by prose that cites the PR's own diff files. **Incident:** PR #857 commit `ec643bac7` shipped a restatement backward-check; the parallel single-label-host gap on the Tier-1 host-derivation surface (`tier1For`'s `candidateFields`, sibling to the Tier-2 `loadAckFile` surface the PR fixed) reached the PR and was caught only by operator challenge → fixed in `bf1b8b5f3`.

## Root Cause

`#discipline-theatre` ([phase-research-coverage.md §4](../../../.claude/rules/phase-research-coverage.md)) specialised onto the backward-check, **worst under context fatigue**: the loaded context is saturated with the PR's *inward* narrative, so «backward-check» pattern-matches to «recap what I changed» — but the check's value is entirely *outward*. It composes T2 (claim-a-sweep ≠ run-it), T14 (clean result on low coverage misread as clean), T15 (skip the recursive-self-application). The fakeable syntactic gate rewards the least-resistance output — the same evidence-skipping shape as T20 / [recommendation-laziness-discipline.md](../../../.claude/rules/recommendation-laziness-discipline.md).

## Solution

- **T21** in [ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md) (+ §4 anti-pattern + §5 promotion at 3 incidents, MANUAL-classification only).
- **Cold sub-agent** [agents/backward-sweep-auditor.md](../../../agents/backward-sweep-auditor.md): PR-blind by dispatch contract (given only the change *class*, no PR narrative to recap). AI-agnostic, read in-session, zero paid LLM.
- **Enumeration authoring format** in [phase-research-coverage.md §1.7](../../../.claude/rules/phase-research-coverage.md) + the self-reflection skill Step 0: `Class = X; Surfaces where class-X occurs: [enumerate ALL]; per surface SWEPT-CLEAN | GAP-FOUND`.
- **Detector (c) rejected as a gate, on evidence:** the incident's restatement cited a *non-diff* file (`packages/core/principles/30-research-source-trust.test.ts:139`, absent from `ec643bac7`'s `git diff --name-only`) → a naive «cites a non-diff path» detector **false-negatives on the very incident**. Completeness of the enumeration is semantic; per [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) it cannot be a CI gate.

## Prevention

**PRIORITY CHECK — when authoring a §1.7 Backward-check for a change with parallel surfaces:** do NOT hand-author the surface list from the loaded context. Dispatch the cold `backward-sweep-auditor` with **only the change's class**, and paste its per-surface GAP/CLEAN table into the enumeration format. A backward-check whose surface list equals `git diff --name-only origin/staging..HEAD` is a restatement, not a sweep — reject at review.

## §1.7 self-review (recursive self-application of this very patch)

This patch introduces a discipline artefact, so it must pass its own countermeasure. The **forward-check** confirms compliance with the active layers (no-paid-llm — the only mechanism is the read-in-session cold agent; doc-authority — the new agent + edited rules carry headers, principle 09 green; build-first-reuse — ADAPT of the in-repo AI-agnostic-auditor + T19 cold-QA, no new dep). The **backward-check** was run *as a cold sweep of this change's own class* («a discipline self-check enforced by a syntactic proxy a shaped-but-empty body can satisfy»): the cold agent enumerated **12** sibling gates (`discipline-self-check.yml`, `s17.ts`, `prior-art.ts`, `audit-self.yml:pr-commit-trailers`, principles 13/08/15/09/12/10/16) — **none in this PR's diff**. Every one already backstops the *empty-filler* sub-class (paired-negative / substance arm); **none** catches the *restatement-with-self-citation* sub-class (T21), which is precisely why the fix ships a cold semantic sweep, not a 13th syntactic arm. **Load-bearing dogfood result:** the author's *hand* enumeration named only ~4 siblings — the cold sweep's 12 caught the author's own near-under-complete backward-check (T21 firing on its own codification). The recursive-self-application is genuine, not a restatement: the surfaces named are outward siblings, verified absent from the diff.

**Honest residual:** the countermeasure moves the trap from *passive restatement* (cheap, default) to *active fabrication* (invent a false-complete surface list) — a real cost raise — but does not make faking impossible: an author can skip *invoking* the cold agent, and no CI gate can verify enumeration completeness without a paid LLM (excluded by policy). Backstop of last resort remains review-time judgment — the same channel that caught the incident. Not a gate, by design. Incident counter: 1/3.

## Tags

`#discipline-theatre` · `#recursive-self-application-gap` · `#recommendation-skips-own-discipline`
