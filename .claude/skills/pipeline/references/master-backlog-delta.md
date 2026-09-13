# /pipeline master-backlog-delta — discipline detail

> **Authoritative for:** master-backlog-delta (`_master-backlog-delta.json`) discipline detail referenced by SKILL.md §2.5 Step 1 + Step 8 + §10 item 5. Delta-reconciliation rule, delta-as-supplementary framing, T-mem-A counter extension to delta, helper-scope contracts for both writer (`update-delta.sh`) and read-side differ (`delta-diff.sh`).
> **NOT authoritative for:** SKILL.md §2.5 `!shell` injection blocks themselves (those live in SKILL.md by necessity — CC executes them from there). NOT authoritative for project goal — see [README.md#why-this-exists](../../../../README.md#why-this-exists). NOT authoritative for the delta JSON schema — that is single-SSOT'd in [update-delta.sh §1](../helpers/update-delta.sh) (`write_initial_template` heredoc).

> **Origin:** /pipeline Stage 3 of mode-triage umbrella, 2026-05-26. Companion to SKILL.md §2.5 + §10 master-backlog-delta surfaces (read side ships Stage 3; writer + arrays-in-body ship Stage 2B/2C). Mirrors [plan-cache.md](plan-cache.md) §1-§4 structure for the parallel delta artefact.

<!-- @dual-pair: meta-orchestrator-master-backlog-delta -->
<!-- spec: ../helpers/update-delta.sh (metadata write side) ↔ ../helpers/delta-diff.sh (read side set-diff) ↔ SKILL.md §2.5 Step 1 + Step 8 + §10 item 5b -->

---

## §1 Delta injection (read side) — SKILL.md §2.5 Step 1 + Step 8

**Step 1** reads `untracked_seen[].id` via inline `jq` to surface the prior-sweep id set as context. **Step 8** invokes [`delta-diff.sh`](../helpers/delta-diff.sh) to compute the actual NEW-SINCE-LAST / RESOLVED-SINCE-LAST set diff between prior `untracked_seen` and the current L1+L2 candidate sweep — emitting one line per id-set difference into the §10 rendered dispatch report.

**Why two read-side touchpoints (not one):** Step 1's `jq -r '.untracked_seen[]?.id'` is a _context-priming_ surface — it shows the AI what the last sweep saw, so judgment in Steps 2-7 (dup-detect / classify / assign / route / alias) is informed. Step 8 is a _deterministic diff_, run after the current candidate set is known. Collapsing them into one block would force the AI to do set-diff in judgment instead of via the helper — that is the §4 `#delta-as-source-of-truth` anti-pattern in disguise.

**`first_seen` semantics (binding for read-side):** `untracked_seen[].first_seen` records the **most recent sighting**, NOT the first-ever sighting (per SKILL.md §10 item 5b binding choice — overwrite-shape, not preserve-shape). Read-side code MUST NOT treat `first_seen` as a historical anchor; it is a per-invocation refresh stamp.

---

## §2 Delta-reconciliation rule — SKILL.md §2.5 Step 1 + Step 8

Compare prior `untracked_seen[].id` set (from Step 1) against the current L1+L2 mechanical sweep candidate set (output of §2 priority-score + L3 dup-detect). If divergence is detected — e.g. delta claims `<id>` was seen but the current `priority-score.sh` + `plan-currency-check.sh` output no longer surfaces it AND no merged PR closing it appears in `gh pr list --state merged` — emit:

> «DELTA STALE: `<id>` claimed seen at last sync `<ts>`, current sweep does not surface it AND no merge evidence. Re-deriving from mechanical state; delta treated as supplementary only.»

Delta is welcome supplementary input, **never load-bearing** — same model as cache reconciliation ([plan-cache.md §2](plan-cache.md)) and REPORT reconciliation (SKILL.md §1 Step 2 item 5; memory `feedback_no_human_verification_ai_self_verifies`). Mechanical state — `gh pr list`, `git log`, `ls`, the L1+L2 helpers — always wins.

**Divergence trigger condition (binding — NOT a copy of plan-cache.md §2):**

The reconciliation trigger here is **L1+L2-sweep divergence**, NOT git-HEAD-SHA divergence (which is plan-cache.md §2's trigger). The delta tracks _backlog-id state_, not _plan-file content state_; the reconciliation criterion is therefore:

- (a) `untracked_seen[].id` ∋ id, AND
- (b) current L1+L2 sweep does NOT surface id, AND
- (c) `gh pr list --state merged --search '<id-fragment>'` shows NO recent merge,

then divergence is **real** (item silently dropped from the backlog — investigate). Conversely, if (b) holds but (c) shows a merge, the divergence is **expected** (item closed since last sync) — emit `RESOLVED-SINCE-LAST: <id>` per Step 8 and proceed without alarm. Copying plan-cache.md §2's SHA-divergence check verbatim is the `T-Stage3-A` trap (see §4).

**T-mem-A counter** ([ai-laziness-traps.md §2](../../../rules/ai-laziness-traps.md), cache-as-source-of-truth drift): every «`<id>` is open» / «`<id>` is closed» claim derived from `untracked_seen` MUST be re-verified via the current L1+L2 sweep + `gh pr list` (which `plan-currency-check.sh` + `dup-detect.sh` already do — delta **precedes** but does **NOT replace** the mechanical probe). Reading the delta's id-set without re-running L1+L2 is the named anti-pattern (§4 `#delta-as-source-of-truth`). T-mem-A originally codified for plan-cache (plan-cache.md §2) extends to delta because the failure mode is identical (stage-0 cache trusted without re-verification); the counter rule is the same.

---

## §3 Delta-update step — SKILL.md §10 item 5b

At end of invocation, the two writes happen in this order (per SKILL.md §10 item 5b — already shipped Stage 2C):

1. **`update-delta.sh` owns metadata + bootstrap** — `bash ${CLAUDE_SKILL_DIR}/helpers/update-delta.sh "<umbrella-or-no-arg>" "<outcome-one-liner>"` refreshes `last_check_ts` + `last_check_git_head` and bootstraps the schema on first run (idempotent; paired-negative test at [`packages/core/hooks/update-delta.test.ts`](../../../../packages/core/hooks/update-delta.test.ts)).
2. **`delta-write-from-state.sh` owns arrays** — `bash ${CLAUDE_SKILL_DIR}/helpers/delta-write-from-state.sh "${umbrella:-no-arg}" '<current_ids_json_array>' '<resolved_ids_json_array>'` writes the `untracked_seen` + `closed_since_last` arrays (F.3 helper-collapse PR #261 2026-05-28; paired-negative test at `packages/core/hooks/delta-write-from-state.test.ts`).

**Helper-scope contract** (mirrors [plan-cache.md §3](plan-cache.md) round-3 reduction of `update-cache.sh`): the metadata writer (`update-delta.sh`) is deterministic on TWO fields only; the two arrays are populated by `delta-write-from-state.sh` after the metadata writer runs (F.3 helper-collapse PR #261 2026-05-28 — the inline `!shell` `jq` block was removed). This split keeps the metadata writer's idempotency contract tight (covered by `update-delta.test.ts`), while the array content flows through the sibling helper (no underspecified `$3..$N` interface).

**Single SSOT:** both helpers live at `.claude/skills/pipeline/helpers/` only — no consumer mirror under `skills/pipeline/` per [install.sh:26](../../../../install.sh) authority. `delta-diff.sh` (read side) is genuinely new this stage; `update-delta.sh` (metadata writer) shipped Stage 2B and is UNCHANGED in this stage.

---

## §4 Anti-patterns

- **`#delta-as-source-of-truth`** — reading `untracked_seen[].id` and trusting its «`<id>` is open» / «`<id>` is closed» claims without re-running `dup-detect.sh` + `gh pr list`. Counter: §2 reconciliation rule + T-mem-A in [ai-laziness-traps.md §2](../../../rules/ai-laziness-traps.md). Mirrors plan-cache.md §4 `#cache-as-source-of-truth`.
- **`#delta-arrays-writer-creep`** — extending `update-delta.sh` to write the two arrays (`untracked_seen` / `closed_since_last`) in addition to metadata. The two arrays MUST be populated by direct inline `jq` in SKILL.md body, not by the helper. Counter: helper-scope contract above (§3). Mirrors plan-cache.md §4 `#cache-writer-feature-creep`. Falsifier: a future PR adds `--with-arrays` flag or third positional arg `$3` for the array data → that PR violates this anti-pattern.
- **`#delta-clobbers-mechanical-state`** — letting prior `untracked_seen` content (stale) override what the current L1+L2 sweep surfaces. Counter: §2 mechanical-wins rule + Step 8 emits `RESOLVED-SINCE-LAST: <id>` for ids that dropped between sweeps, never silently retains them in dispatch output. Mirrors plan-cache.md §4 `#cache-clobbers-hand-edits`.
- **`T-Stage3-A` — `#cache-delta-mirror-pattern-mismatch`** — copying plan-cache.md §2's git-HEAD-SHA-divergence reconciliation trigger verbatim into the delta rule, instead of writing the L1+L2-sweep-divergence trigger that delta actually requires. Cache problem class = plan-file-content drift (SHA-anchored); delta problem class = backlog-id-set drift (sweep-anchored). T16 (pattern-matching-on-name) variant: «plan-cache.md is the precedent → mirror its §2 trigger condition» is wrong on the trigger; only the _shape_ (supplementary-not-load-bearing + reconciliation-emit-prose + T-mem-A counter) mirrors. The trigger condition itself is built fresh per §2 above. Falsifier: a future edit to §2 introduces `git rev-parse HEAD` comparison without an L1+L2 sweep check → that edit triggers this anti-pattern.

---

## §5 See also

- [SKILL.md §2.5 Step 1](../SKILL.md) — context-priming `jq` read of `untracked_seen[].id`.
- [SKILL.md §2.5 Step 8](../SKILL.md) — `delta-diff.sh` invocation + NEW-SINCE-LAST / RESOLVED-SINCE-LAST emission.
- [SKILL.md §10 item 5b](../SKILL.md) — write-back sequence (body-owned arrays + helper-owned metadata).
- [helpers/delta-diff.sh](../helpers/delta-diff.sh) — read-side set-diff helper (NEW Stage 3).
- [helpers/update-delta.sh](../helpers/update-delta.sh) — write-side metadata helper (Stage 2B, UNCHANGED).
- [`packages/core/hooks/delta-diff.test.ts`](../../../../packages/core/hooks/delta-diff.test.ts) — paired-negative contract for the read-side set-diff.
- [`packages/core/hooks/update-delta.test.ts`](../../../../packages/core/hooks/update-delta.test.ts) — paired-negative contract for the writer.
- [plan-cache.md](plan-cache.md) — parallel artefact for the plan-cache surface; §1-§4 structure mirrored here.
- [prior-art-evaluations.md §77 (Cline Memory Bank ADAPT)](../../../../docs/meta-factory/prior-art-evaluations.md) — adjacent ADAPT verdict (committed-markdown sub-pattern for `_plan-cache.md`).
- [research-patches/2026-05-26-meta-orchestrator-mode-triage-prior-art.md §2](../../../../docs/meta-factory/research-patches/2026-05-26-meta-orchestrator-mode-triage-prior-art.md) — R-phase Area B BUILD verdict (β-2 sibling JSON sidecar) backing this artefact.
