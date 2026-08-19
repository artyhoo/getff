# KICKOFF — guard-liveness **v1.5 / command + script** (sub-wave of N9? umbrella)

> **Type:** I-phase (build, schema + runner). Days-scale.
> **Sub-wave v1.5** of guard-liveness umbrella. Siblings: v0 (audit, parallel start with v1), v1 (ESLint), v3 (manual via SP), v2 (full-sweep, ships after v1+v1.5+v3).
> **Design SSOT:** [docs/meta-factory/research-patches/2026-05-23-guard-liveness-gate.md](../../../docs/meta-factory/research-patches/2026-05-23-guard-liveness-gate.md) §3 sub-wave row v1.5.
> v1.5 may run in parallel with v3.
> **Admission:** candidate ([wave-sequencing-plan.md §0](../../../docs/meta-factory/wave-sequencing-plan.md)).

| Stage | Scope (one line) | Depends on |
|---|---|---|
| v1.5 | command + script gate: criticality-selected command/script slice (§1) | v0 lands (per-rule criticality table) |

## §0 Why this sub-wave (origin)
v0 audit (sibling sub-wave) will produce a per-rule criticality table. For `check.type ∈ {command, script}` (10 of 26 rules in current manifest), `gate-rule-tester.ts` skips them today ([validator/gate-rule-tester.ts:69](../../../packages/core/validator/gate-rule-tester.ts)). So no end-to-end "does this guard catch its violation" verification exists for the command/script slice — the larger non-ESLint half of the manifest. This sub-wave closes that for the LOAD-BEARING subset (per v0's table).

## §1 Core deliverable
A pre-commit + pre-push gate that, when a `command`- or `script`-type rule is added/changed, runs the rule's check against a **pre-condition fixture** (filesystem/env state designed to violate the rule) and asserts the check returns non-zero. Plus the schema field that makes this expressible.

## §2 Scope
**IN:**
1. **Schema addition** to [`packages/core/synthesizer/types.ts`](../../../packages/core/synthesizer/types.ts) `NegativeTest`:
   ```ts
   interface NegativeTest {
     input: string[];                  // landed by v1
     'expect-violation': string;
     fixture?: {                       // new: v1.5
       'setup-script': string;         // shell that sets up the violating state
       'cleanup-script'?: string;      // optional teardown
       cwd?: string;                   // optional working dir
     };
   }
   ```
   `fixture` is required for `check.type ∈ {command, script}` (enforced by extended principle 02); optional otherwise.
2. **Runner** at `packages/core/hooks/checks/cmd-script-liveness.ts` — reuses [run-check.ts](../../../packages/core/hooks/utils/run-check.ts) (SSOT #54 ADAPT, already mocked-subprocess-tested): sets up fixture in a temp dir, invokes the rule's `check.command` or `check.script` against it, asserts exit ≠ 0; cleans up.
3. **Change-scoped trigger** in [`pre-push.ts`](../../../packages/core/hooks/pre-push.ts): on each push, parse diff for changed command/script rules → run only those.
4. **pre-commit structural arm:** changed cmd/script rule HAS a `fixture.setup-script` field (non-empty, ≥ min length).
5. **principle 02 extension** to assert `fixture` presence for cmd/script rules + that the fixture's setup is distinct from `examples.good` (anti-tautology, parallels existing `bad !== good`).
6. **Migration:** populate `fixture` for v0's LOAD-BEARING command/script rules in the SAME PR. AUTO-GEN / DEPRECATED rules from v0's table → either skip via `EXEMPT_RULES` allowlist (with rationale per rule) or leave with placeholder + open follow-up.

**OUT:**
- Manual rules → v3's territory.
- ESLint rules → v1's territory.
- Full-sweep regression → v2's territory.
- Stryker on the new runner code: v1.5 author runs locally, records ≥80%, no CI gate (consistent with sibling D4 precedent).

## §3 Method (MANDATORY before any code)
1. **Wait for v0** — read v0's deliverable (`research-patches/2026-05-2X-guard-liveness-v0-audit.md`) and extract the cmd/script row-set. If v0 hasn't landed: STOP, don't guess scope from rule names (T16 risk).
2. **Search-coverage check** ([phase-research-coverage.md §1](../../../.claude/rules/phase-research-coverage.md) ≥3 phrasings on negative-existence): «pre-commit framework that runs custom shell on a per-rule fixture and asserts non-zero exit». DeepWiki on `Aider-AI/aider` (already SSOT #54 ADAPT) + `evilmartians/lefthook` + `pre-commit/pre-commit`. If a tool surfaces, flip BUILD→ADOPT.
3. **Reuse `run-check.ts`** (SSOT #54): timeout + exit + output capture already there. Don't re-implement subprocess invocation.
4. **Channel basis:** [rule-enforcement-channel-selection.md §3](../../../.claude/rules/rule-enforcement-channel-selection.md) — declare the chosen channel in each new check's header.

## §4 Discipline obligations on the PR
- Capability commit (new ≥50 LOC under `hooks/checks/`) → `Prior-art:` trailer citing §3 step 2 results.
- §1.7 forward+backward — H3 «### §1.7 Forward/Backward-check applied», ≥1 file:line in BOTH.
- Stryker ≥80% on `cmd-script-liveness.ts` (run locally, record).
- principle 02 extension covered by tests in the same PR.
- Self-application: every cmd/script rule in this repo's manifest classified LOAD-BEARING by v0 has a real fixture (not placeholder) in this PR.

## §5 AI-laziness traps (per [.claude/rules/ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md))
Active: **T1** (sampling floor — not applicable, full LOAD-BEARING set), **T3** (file:line/output per claim), **T5** (I-phase: don't smuggle unrelated edits), **T11** (prior-art BEFORE coding — §3 step 2), **T13** (`run-check.ts` is ADOPTED — verify it covers timeout edge for long fixtures), **T15** (self-application — every load-bearing cmd/script rule in OUR manifest gets a real fixture), **T16** (don't trust rule-name pattern — read the rule's command before writing the fixture).
Domain-specific:
- **T-V15-A:** «fixture is a shell oneliner → just put `false` to force non-zero exit». FALSE — that proves nothing about the rule. Counter: the fixture must produce the **specific state** the rule was designed to catch. Reviewer must inspect each fixture and confirm it embodies the rule's violation semantics.
- **T-V15-B:** «cleanup-script optional → skip cleanup, CI is fresh each run». Counter: pre-push runs locally, not CI; uncleaned fixtures pollute the dev tree. Cleanup required when fixture writes outside the temp dir.

## §6 Phase -1
Cold-review (1× Opus): stale refs, ambiguity, missing constraints, §5 substance, v0-dependency wording. Grep memory for "fixture" / "run-check" / "guard-liveness". Address BLOCKER/MAJOR, then proceed.

## §7 Coupling notes
- **v1 schema must land first.** This sub-wave adds `fixture` to `NegativeTest` — that interface ships in v1. Coordinate via v0 → v1 → v1.5 stage gate.
- **N5 give-back candidate:** the fixture-runner pattern is reusable across projects (deterministic, no LLM) — surface at N5.
