# KICKOFF — guard-liveness **Stage 2a / shared-schema prelude** (sub-wave of guard-liveness umbrella)

> **Type:** I-phase-small (schema + types + principle-test extension). Single small PR. Hours-scale.
> **Stage 2a prelude** of the guard-liveness umbrella. Created 2026-06-11 by `/pipeline guard-liveness` Phase -1 (1→2) REVISE verdict to resolve BLOCKER-2 (v1.5 ‖ v3 shared-file collision) before the two runners parallelize.
> **Design SSOT:** [docs/meta-factory/research-patches/2026-05-23-guard-liveness-gate.md](../../../docs/meta-factory/research-patches/2026-05-23-guard-liveness-gate.md) §3; v0 audit table [docs/meta-factory/research-patches/2026-06-10-guard-liveness-v0-audit.md](../../../docs/meta-factory/research-patches/2026-06-10-guard-liveness-v0-audit.md) §1/§4.
> Both dependency edges DONE — gate green.
> **Gates:** v1.5 (`guard-liveness-v1.5-cmd-script/`) AND v3 (`guard-liveness-v3-manual-sp/`) both depend on THIS prelude merging — it lands the shared manifest schema surface + principle-02/15 extension so the two runners then edit disjoint files.
> **Base branch:** staging.

| Stage | Scope (one line) | Depends on |
|---|---|---|
| stage2a | shared-schema prelude: manifest schema surface + principle-02/15 extension (§0) | v0 (PR 458) + v1 (PR 460) merged |

## §0 Why this prelude exists (origin)

Phase -1 (1→2) cold-review found that v1.5 and v3 — declared parallel — BOTH edit `packages/core/synthesizer/types.ts` AND BOTH extend `packages/core/principles/02-paired-negative-test.test.ts`. Running them in parallel races the shared files (`parallel-subwave-isolation.md §1` violation). It also found (BLOCKER-1) that v1.5's original plan added `fixture` *inside* `NegativeTest`, but the 10 command/script target rules live in the **manifest** (`packages/core/manifest/rules-manifest.schema.json`) and carry **no** `negative-test` block — so that edit reached zero target rules.

This prelude lands the **shared schema/types/principle surface ONCE**, so afterwards v1.5 adds only its runner + cmd/script data, and v3 adds only its prober + manual data — over disjoint files.

## §1 Core deliverable

Three coordinated, minimal edits in **one PR**, with **NO per-rule data migration** (that is v1.5/v3 territory):

1. **Manifest schema** (`packages/core/manifest/rules-manifest.schema.json`): two NEW **sibling** properties on the RuleEntry object (the object at line 6-82, currently `additionalProperties: false` at line 9) — alongside the existing `negative-test` (line 59):
   - `fixture` — for `command`/`script` rules: `{ "setup-script": string, "cleanup-script"?: string, "cwd"?: string }`, `additionalProperties: false`. Liveness data: a violating filesystem/env state the rule's `check.command`/`check.script` must exit-non-zero on.
   - `pressure-scenario` — for `manual` rules: `{ "baseline-prompt": string, "observable-failure": string, "observable-compliance": string }`, `additionalProperties: false`. RED→GREEN forcing-function data for the v3 prober.
2. **Types mirror** (`packages/core/synthesizer/types.ts`): add `Fixture` + `PressureScenario` interfaces and OPTIONAL fields on the RuleEntry-shaped surface so generated rules validate identically (line 2-4 contract — synth aligned with manifest). Do NOT nest these in `NegativeTest` (BLOCKER-1: that interface is the ESLint recipe layer).
3. **principle 02 extension** (`packages/core/principles/02-paired-negative-test.test.ts`): add a liveness arm that, **IF the field is present**, asserts it is well-formed — mirroring the existing ESLint arm's `if (!nt) return;` presence-optional shape (`assertNegativeTestLiveness`, line 151-170). Concretely:
   - command/script rule with a `fixture`: `setup-script` non-empty (≥ MIN_EXAMPLE_LENGTH); if `cwd` present, non-empty; **anti-tautology on the RIGHT axis** — `setup-script` must NOT be a trivial force-fail (`false`, `exit 1`, empty) — it must reference the rule's own check surface (heuristic: length floor + not in a deny-list of trivial one-liners). This is the MAJOR-2 fix: the comparand is "does the fixture embody the rule's violation", NOT "fixture ≠ examples.good" (code-string vs FS-state is a no-op).
   - manual rule with a `pressure-scenario`: all three fields non-empty AND `observable-failure` !== `observable-compliance` (the real anti-tautology axis for manual).
   - Each new assertion paired with a mutation-sanity `it(...)` (a malformed fixture/scenario → throws), per the file's existing `[M4]` pattern (line 417-441) and `.claude/rules/` testing discipline (paired-negative mandatory).

**Presence is NOT required here** (well-formed-IF-present). v1.5 flips `fixture` to REQUIRED for command/script; v3 flips `pressure-scenario` to REQUIRED for manual — each in its own PR, after migrating its rule set. This keeps the prelude green with zero data.

## §2 Scope

**IN:** the three edits above + their tests, in one PR. principle 15 (`15-skill-paired-negative`) extension ONLY if the schema field needs a paired-negative there too — check `packages/core/principles/15-*.test.ts` first; if not applicable, say so in the PR body (do not touch it gratuitously).

**OUT (hard — these are sibling sub-waves, do NOT do them here):**
- The command/script **runner** (`hooks/checks/cmd-script-liveness.ts`) → v1.5.
- The manual **prober** (`agents/manual-rule-liveness-prober.md`) → v3.
- Populating `fixture` for the 10 cmd/script rules (R1,R3,R4,R11,R17,R19,IR1,IR2,IR3,IR4) → v1.5 migration.
- Populating `pressure-scenario` for the 5 manual rules (R10,R13,R18,IR5,IR6) → v3 migration.
- Flipping either field to REQUIRED → v1.5/v3 respectively.
- Any `rules-manifest.json` data edit (this PR touches the SCHEMA + types + principle test only, not the data file).

## §3 Method (MANDATORY before any code)

1. **Read the three target files** at the cited lines: `rules-manifest.schema.json:6-82` (RuleEntry + `negative-test` shape to mirror), `synthesizer/types.ts:1-37` (`ManifestCheck` union + `NegativeTest`), `02-paired-negative-test.test.ts:151-170,401-452` (the ESLint liveness arm to parallel).
2. **Mirror, don't invent.** `fixture`/`pressure-scenario` JSON-schema style must match the existing `negative-test` block (line 59-80): `additionalProperties:false`, `required`, `description`. The TS interfaces match the `NegativeTest` style (line 14-18).
3. **Search-coverage** (`phase-research-coverage.md §1`, ≥3 phrasings on negative-existence): this is a schema+test extension of an existing in-repo pattern (the ESLint `negative-test` arm) — NOT a new external capability. State that explicitly; no external tool surfaces a "manifest-rule liveness fixture field" — it is project-internal. If unsure → DeepWiki `pre-commit/pre-commit` + WebSearch one phrasing, record verdict.
4. **Run the principle suite** after edits: `npm --prefix packages/core run test:principles 2>/dev/null | tail -20` — principle 02 must stay green (presence-optional means existing 26 rules without the new fields still pass) AND the new mutation-sanity tests must pass.

## §4 Discipline obligations on the PR

- **Capability commit** (touches `packages/core/principles/**` + manifest schema; likely ≥80 LOC with tests) → `Prior-art:` trailer. Verdict: ADAPT — extends the in-repo `negative-test` liveness arm (v1 #460) to non-ESLint rule types; no external analog (§3 step 3). Cite the v1 PR + the in-repo pattern.
- **§1.7 forward+backward** in the PR BODY (paths match `.claude/skills/.../§4b` mandate — `packages/core/principles/**`): H3 `### §1.7 Forward-check applied` + `### §1.7 Backward-check applied`, the literal word «applied», ≥40 non-ws chars each, ≥1 `file:line` citation each. Forward: doc-authority/no-paid-llm/build-first-reuse. Backward: sweep existing principle-02 arms + the 26 manifest rules (confirm presence-optional → all still pass).
- **Pre-flight grep** the §1.7 body before `gh pr create` (H3 depth, «applied», ≥40 chars, ≥2 file:line).
- Self-application: the new mutation-sanity tests ARE the paired-negative for this PR's own schema additions.

## §4c Autonomous aif-handoff dispatch — park-don't-guess contract (MANDATORY — this kickoff is dispatched to the runtime-bridge)

**Why:** aif-handoff agents have **no mid-implementation "pause and ask" primitive** — they implement, *guessing* on any ambiguity, then auto-review. A genuine design fork is not recognised as a question; aif just picks. Without the levers below, aif decides forks wrong, silently.

**aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two defensible schema shapes, an undecided field name that changes the v1.5/v3 contract, a missing spec detail that changes behaviour) — **do NOT pick — park it as a question** (set the task to `manualReviewRequired` / `blocked_external` with the fork stated as «Option A → consequence X / Option B → consequence Y») and **stop that task.** Proceed only on the unambiguous parts. Guessing a fork to "keep moving" is the failure this whole loop exists to prevent.

**Likely-fork watchpoints for THIS prelude (park, don't guess):**
- Field naming: `fixture` vs `liveness` vs `cmd-script-test` — if the v1.5 kickoff's chosen name differs from `fixture`, PARK (the name is the v1.5/v3 contract).
- Whether to relax `additionalProperties:false` by enumerating the new props (correct) vs setting it true (wrong) — if unsure, the enumerate-props path is correct; only park if a third option seems needed.

**Egress (after `status=done`):** aif does NOT push/PR by design. Run `npx tsx packages/runtime-bridge/src/cli/harvest.ts <taskId> --base staging`; if the container's github push is tunnel-blocked, use `packages/runtime-bridge/scripts/harvest-via-api.sh` (GitHub Trees API path). Anti-pattern `#autonomous-done-no-harvest`.

## §5 AI-laziness traps (per [.claude/rules/ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md))

**Active canonical traps:** T3 (file:line on every claim — cite the schema/types/principle lines you edit), T5 (I-phase: do NOT smuggle v1.5/v3 work in — no runner, no prober, no data migration), T11 (prior-art before the schema design — §3 step 3), T13 (the `negative-test` arm is the ADOPTED in-repo pattern; confirm your extension matches its presence-optional semantics, not a stricter one), T15 (self-application — the prelude's own mutation-sanity tests are its paired-negative), T16 (don't pattern-match: `fixture` for cmd/script ≠ `negative-test` for ESLint — different check surface; cite why).

**Domain-specific:**
- **T-S2A-A:** «make the field REQUIRED so the principle test has teeth» — FALSE for the prelude. Presence-required here breaks CI (26 rules have no fixture/scenario yet). The teeth land in v1.5/v3 *after* migration. Counter: presence-optional + mutation-sanity on well-formedness only.
- **T-S2A-B:** «anti-tautology = fixture ≠ examples.good» — FALSE (MAJOR-2). For cmd/script the fixture is FS-state, examples.good is a code-string — never comparable. Counter: assert the fixture is non-trivial (not `false`/`exit 1`/empty) and references the rule's check surface.

## §6 Phase -1

Cold-review (1× Opus) before merge: schema mirrors `negative-test` style exactly; types align with manifest (line 2-4 contract); principle-02 arm is presence-optional (existing 26 rules still green); mutation-sanity tests are real (a malformed fixture throws); §1.7 body passes the awk gate; no v1.5/v3 scope smuggled in.

## §7 Coupling notes

- **Gates v1.5 AND v3.** Both depend on this PR merging. After it lands: v1.5 ‖ v3 dispatch in separate worktrees (Mode B ×2) over disjoint files (v1.5 → runner + cmd/script data; v3 → prober + manual data). The remaining soft-overlap is `rules-manifest.json` data edits on disjoint rule keys — isolate via worktrees, second-merged rebases.
- **N5 give-back:** the fixture/pressure-scenario schema convention is a give-back candidate alongside v1.5's runner + v3's prober — surface at N5, not here.
