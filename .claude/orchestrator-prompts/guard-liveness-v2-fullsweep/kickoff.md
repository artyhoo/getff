# KICKOFF — guard-liveness **v2 / full-sweep regression** (sub-wave of N9? umbrella)

> **Type:** I-phase (build — thin CI orchestrator over already-shipped mechanisms). 2–3 days.
> **Sub-wave v2** of guard-liveness umbrella. Siblings: v0 (audit), v1 (ESLint), v1.5 (cmd/script), v3 (manual via SP).
> **Design SSOT:** [docs/meta-factory/research-patches/2026-05-23-guard-liveness-gate.md](../../../docs/meta-factory/research-patches/2026-05-23-guard-liveness-gate.md) §3 sub-wave row v2.
> v2 has no own substrate — it orchestrates the three change-scoped mechanisms in full-sweep mode.
> **Admission:** candidate ([wave-sequencing-plan.md §0](../../../docs/meta-factory/wave-sequencing-plan.md)).

| Stage | Scope (one line) | Depends on |
|---|---|---|
| v2 | periodic full-sweep regression at CI/pre-merge over the change-scoped mechanisms (§0) | v1 + v1.5 + v3 ALL merged |

## §0 Why this sub-wave (origin)
v1 / v1.5 / v3 are **change-scoped** — they only verify rules touched in the current PR. That leaves a regression hole: a rule shipped clean today can rot tomorrow (its `bad`/`fixture`/`pressure-scenario` becomes inert as the rule's check logic drifts, dependencies update, or the rule itself silently weakens). The change-scoped gate won't catch it because the rule wasn't touched in the rotting PR. v2 fills the hole with a **periodic full-sweep** at CI/pre-merge (the project's last-resort gate per [README invariant](../../../README.md)).

This is exactly the v2 trade-off the project already accepted-and-deferred for Stryker ([open-questions.md:120](../../../docs/meta-factory/open-questions.md)) — "expensive on full set, must fit ≤5 min per CI run". v2 inherits that runtime constraint.

## §1 Core deliverable
A single CI job (under existing `ci-success` aggregator per [automerge plan](../../../docs/meta-factory/automerge-staging-plan.md)) that re-invokes v1 + v1.5 + v3 mechanisms in **full-sweep mode** (no `git diff` scoping) against the entire manifest. Job is gating on PRs merging into `main` (last-resort backstop), advisory on `staging` (per default-branch policy).

## §2 Scope
**IN:**
1. **Full-sweep flag** added to v1's hook check, v1.5's runner, and v3's prober (the v3 prober's CI invocation: see §3 — it has a *deterministic structural arm* in CI, the full RED→GREEN LLM probe stays session-bound).
2. **CI workflow** at `.github/workflows/guard-liveness-fullsweep.yml`:
   - Trigger: `pull_request` targeting `main`.
   - Steps: install deps → run v1 ESLint sweep → run v1.5 cmd/script sweep → run v3 manual *structural* sweep (NOT the LLM probe).
   - Output: JSON report; fail if any guard's `bad`-corpus / fixture / pressure-scenario doesn't trip its real check.
   - Runtime budget: **≤5 min**. If breached, exit with diagnostic and require parallel-job split, not silent slowness.
3. **Aggregated under `ci-success`** as a `needs:` step (consistent with #130 — never require a path-filtered check directly).
4. **Add to required checks on `main` branch protection** (maintainer action, recorded in PR body for click-through).
5. **principle 02 / 15 extension** (if needed): assert v2 doesn't trigger on `staging` push (avoid double-fire with change-scoped gates).

**OUT:**
- v3's **LLM-probe full-sweep**: stays session-bound — `no-paid-llm-in-ci` prohibits LLM in CI. CI sweep of v3 covers only the *structural* arm («every manual rule has a pressure-scenario block, fields non-empty»), not the RED→GREEN behavioral check.
- Stryker full-sweep: separate concern, already deferred per [open-questions.md:120](../../../docs/meta-factory/open-questions.md). Don't fold here.
- New gate mechanisms: v2 ONLY orchestrates; if it needs new logic, that's a v1/v1.5/v3 sub-wave bug, not v2 scope.

## §3 Method (MANDATORY before any code)
1. **Confirm all three siblings merged.** `gh pr list --state merged --search "guard-liveness v1 OR v1.5 OR v3"`. STOP if any is pending — v2 has nothing to orchestrate.
2. **Runtime measurement before commit.** Run the full-sweep locally with `time` — if >4 min, split into parallel jobs BEFORE landing the workflow. The 5-min constraint is load-bearing.
3. **Search-coverage** (≥3 phrasings): «CI workflow that aggregates multiple change-scoped gates into a periodic full-sweep». DeepWiki on `actions/runner` + `Aider-AI/aider` CI + WebSearch. If a declarative tool surfaces, flip BUILD→ADOPT.
4. **Channel basis:** [rule-enforcement-channel-selection.md §3](../../../.claude/rules/rule-enforcement-channel-selection.md) — CI is **last resort**. v2 is explicitly the last-resort backstop. Document this in the workflow header.

## §4 Discipline obligations on the PR
- Capability commit (new workflow + likely ≥50 LOC across hooks for `--full-sweep` flags) → `Prior-art:` trailer.
- §1.7 forward+backward — H3 marker, file:line both sides.
- **Runtime evidence in PR body:** `time make full-sweep` output (≤5 min). PR fails review if budget breached.
- **Branch-protection update** documented in PR body as a maintainer-action post-merge (per [pr-template-multi-phase pattern](../../../INSTALL-FOR-AI.md)) — adding `guard-liveness-fullsweep` to `main` required-checks is a click, not a code change.
- Self-application: v2 must run green on this repo's own full manifest at merge time.

## §5 AI-laziness traps (per [.claude/rules/ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md))
Active: **T2** (designing the workflow ≠ running it — run it locally, paste timing output), **T3** (file:line / command-output on every claim), **T5** (don't smuggle new gate logic here — that's a sibling sub-wave bug), **T11** (prior-art BEFORE coding — §3 step 3), **T13** (`ci-success` aggregator is ADOPTED — confirm `needs:` semantics still work with this addition; don't path-filter the check directly per #130), **T14** (don't confuse «sweep passed» with «no guard-rot» if coverage was insufficient — report which rules were swept), **T15** (self-application — v2's workflow must itself pass v1's structural check if it adds a rule entry), **T16** (`ci-success` aggregator and v2-fullsweep sound aligned — verify the `needs:` pattern matches the established convention from #130).
Domain-specific:
- **T-V2-A:** «runtime 4:58 → fits 5-min budget → ship». Counter: include 20% headroom — if you're at 80%+ of budget on day 1, a single new rule pushes it over. Split into parallel jobs at 4:00, not 4:55.
- **T-V2-B:** «full-sweep failed on rule X → file ticket, merge anyway». Counter: v2 is GATING on `main`. Failing the sweep IS the bug — fix the rule's `bad` corpus or mark it skipped with rationale, do not merge through.

## §6 Phase -1
Cold-review (1× Opus): stale refs, ambiguity, runtime claims verified, branch-protection step explicit. Grep memory for "ci-success" / "automerge" / "full-sweep" / "guard-rot". Address BLOCKER/MAJOR, then proceed.

## §7 Coupling notes
- **Cannot ship before v1+v1.5+v3.** v2 has no substrate — purely an orchestrator. Premature v2 = empty CI job.
- **N5 give-back:** the workflow + aggregator pattern is a low-novelty contribution. Likely NOT a give-back candidate (every project does CI orchestration differently). Skip.
- **Branch-protection click required post-merge** — maintainer responsibility, signaled in PR body.
