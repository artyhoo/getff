# /pipeline plan-cache — discipline detail

> **Authoritative for:** plan-cache (`_plan-cache.md`) discipline detail referenced by SKILL.md §1 Step 2 item 6 + §10 item 5. Cache-reconciliation rule, cache-as-supplementary framing, T-mem-A counter, helper-scope contract.
> **NOT authoritative for:** SKILL.md §1 Step 1 `!shell` injection itself (the read-side block is in SKILL.md by necessity — CC executes it from there). NOT authoritative for project goal — see [README.md#why-this-exists](../../../../README.md#why-this-exists).

> **Origin:** /pipeline skill-memory umbrella, 2026-05-25. Companion to SKILL.md §1 + §10 plan-cache surfaces.

<!-- @dual-pair: meta-orchestrator-plan-cache -->
<!-- spec: ../helpers/update-cache.sh (write side) ↔ SKILL.md §1 Step 1 first !shell block (read side) -->

---

## §1 Cache injection (read side) — SKILL.md §1 Step 1 first `!shell` block

```!
head -200 "$(bash "${CLAUDE_SKILL_DIR}/helpers/print-orch-home.sh" 2>/dev/null)/_plan-cache.md" 2>/dev/null || echo "(no cache — fresh session; will be created by helpers/update-cache.sh on this invocation's exit)"
```

Placed BEFORE the other 4 injection blocks (git status / gh pr list / wave-plan head / plan-currency-check.sh) because cache is «here's what last session knew» context that should inform reading of the live mechanical blocks below.

**`head -200` rationale** (round-3 amendment, was `-100`): a populated cache (priority table 8-12 rows + 5-10 DRIFT items + 3-5 DECISION-NEEDED + deferred + stale-marker) can reach 110-140 lines. `-100` silently truncated stale-cache marker; `-200` keeps it safely. Token cost: ~6-12 kB → ~1.5-3k tokens per invocation, acceptable per umbrella §6 falsifier (cap stays below the 2k-per-invocation threshold).

---

## §2 Cache reconciliation rule — SKILL.md §1 Step 2 item 6

Compare cache's «Last invocation» Git HEAD field to current `git rev-parse HEAD`. If diverged AND `wave-sequencing-plan.md` was touched in the diff between the two SHAs → emit:

> «CACHE STALE: last sync at <SHA>, current <SHA>. Re-deriving DRIFT from mechanical state; cache treated as supplementary only.»

Cache is welcome supplementary input, **never load-bearing** — same model as REPORT reconciliation (SKILL.md §1 Step 2 item 5; memory `feedback_no_human_verification_ai_self_verifies`). Mechanical state always wins.

**T-mem-A counter** (cache-as-source-of-truth drift, [ai-laziness-traps.md §2](../../../rules/ai-laziness-traps.md)): every «PR #X merged» / «umbrella DONE» claim from cache MUST be re-verified via `gh pr list` (which `plan-currency-check.sh` already does — cache **precedes** but does **NOT replace** the mechanical probe). Reading the cache without re-running `gh pr list` is the named anti-pattern.

---

## §3 Cache-update step — SKILL.md §10 item 5

At end of invocation, run via Bash tool:

```bash
bash ${CLAUDE_SKILL_DIR}/helpers/update-cache.sh "<umbrella-or-no-arg>" "<outcome-one-liner>"
```

Updates `<orch-home>/_plan-cache.md` (gitignored, per-machine) for next-invocation continuity via the §1 cache injection. `<orch-home>` is the resolved orchestration home — `.claude/orchestrator-prompts/` in the framework repo, `.ai-factory/orchestrator-prompts/` in a consumer install (`resolve_orch_home()` in `helpers/lib/common.sh`, printed by `helpers/print-orch-home.sh`). The read side above resolves it the same way; hardcoding either literal desynchronises reader from writer (getff#1245).

**Helper-scope contract** (round-3 scope reduction per umbrella §1.3 item 4): the helper writes ONLY the `## Last invocation` section deterministically (`$1` umbrella name, `$2` outcome one-liner, env-injectable `MO_TIMESTAMP` / `MO_GIT_HEAD` seams for tests). All other sections — `## Last priority ranking`, `## DRIFT items surfaced last time`, `## DECISION-NEEDED pending maintainer`, `## Deferred follow-ups` — are populated by direct `Edit` on the cache file BEFORE invoking the helper. This split keeps the helper deterministic with a tight idempotency contract (covered by `packages/core/hooks/update-cache.test.ts`), while the richer session content flows through standard `Edit` (no underspecified `$3..$N` interface).

**Single SSOT:** the helper lives at `.claude/skills/pipeline/helpers/update-cache.sh` only — no consumer mirror under `skills/pipeline/` per [install.sh:233-235](../../../../install.sh) authority.

---

## §4 Anti-patterns

- **`#cache-as-source-of-truth`** — reading cache and trusting its «PR #X merged» claims without re-running `gh pr list`. Counter: §2 reconciliation rule + T-mem-A in [ai-laziness-traps.md §2](../../../rules/ai-laziness-traps.md).
- **`#cache-writer-feature-creep`** — adding sections to the helper interface beyond `## Last invocation` («last 5 invocations», «kill-rate trend», «favorite umbrella»). Counter: helper-scope contract above; new section requires a separate kickoff. T-mem-B in umbrella kickoff §5.
- **`#cache-clobbers-hand-edits`** — helper rewrites the full file instead of in-place updating the `## Last invocation` section. Counter: idempotency test in `packages/core/hooks/update-cache.test.ts` — manual edits to `## DRIFT items surfaced last time` MUST survive a subsequent helper invocation.

---

## §5 See also

- [SKILL.md §1 Step 2 item 6](../SKILL.md) — cache-reconciliation rule (this file is the detail).
- [SKILL.md §10 item 5](../SKILL.md) — cache-update step (this file is the detail).
- [helpers/update-cache.sh](../helpers/update-cache.sh) — write-side SSOT.
- [`packages/core/hooks/update-cache.test.ts`](../../../../packages/core/hooks/update-cache.test.ts) — paired-negative contract.
- `.claude/orchestrator-prompts/meta-orchestrator-skill-memory/kickoff.md` — origin design (302 LOC; gitignored — local kickoff, not committed).
- [prior-art-evaluations.md#77](../../../../docs/meta-factory/prior-art-evaluations.md) — Cline Memory Bank ADAPT verdict (R-phase PR #230).
