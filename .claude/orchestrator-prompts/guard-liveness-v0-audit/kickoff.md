# KICKOFF — guard-liveness **v0 / value-weighted distribution audit** (sub-wave of N9? umbrella)

> **Type:** R-phase (research / classification). Hours-scale, no code, no schema change.
> **Sub-wave v0** of the guard-liveness umbrella (v0 ‖ v1 parallel start per design patch §4). Siblings: v1 (ESLint — lives at `guard-liveness-gate/`, same slug as the design patch), v1.5 (`guard-liveness-v1.5-cmd-script/`), v2 (`guard-liveness-v2-fullsweep/` — orchestrates v1/v1.5/v3 mechanisms, does NOT consume v0's table), v3 (`guard-liveness-v3-manual-sp/`).
> **Design SSOT:** [docs/meta-factory/research-patches/2026-05-23-guard-liveness-gate.md](../../../docs/meta-factory/research-patches/2026-05-23-guard-liveness-gate.md) §3 sub-wave row v0.
> **Admission:** proposed in design patch §4; NOT yet a wave-sequencing-plan §0 row (verified 2026-06-10 — §0 carries no guard-liveness candidate row; do NOT add one in this PR). Launch order = maintainer call.

## §0 Why this wave (origin)
Earlier framing for the umbrella claimed v1 (ESLint, 11 rules) covers «most value» — but the actual `rules-manifest.json` distribution is **non-ESLint-MAJORITY** (11 eslint / 7 command / 5 manual / 3 script → 15/26 = 58% non-ESLint). Closing v1 alone leaves the **larger half uncovered**, and sub-wave sequencing depends on which non-ESLint rules are actually load-bearing vs. auto-generated / deprecated. Need a per-rule criticality classification before authoring v1.5 / v3 kickoffs.

## §1 Core deliverable
A single durable artifact: `docs/meta-factory/research-patches/2026-06-10-guard-liveness-v0-audit.md` (dated the day it lands — e.g. 2026-06-10; slug `guard-liveness-v0-audit` stays stable — the v1.5 kickoff references it by slug) containing:

1. **Per-rule criticality table** — one row per manifest rule:
   - `id` (rule slug),
   - `check.type` (eslint / command / script / manual),
   - `criticality` (LOAD-BEARING / AUTO-GEN / DEPRECATED / UNKNOWN),
   - one-line rationale citing file:line or repo evidence (NOT memory),
   - negative-test coverage. NOTE (verified 2026-06-10): the manifest schema (`rules-manifest.schema.json`, RuleEntry `additionalProperties: false`) makes `negative-test` **structurally illegal in the manifest itself** — record per rule «absent — not in manifest schema», THEN check the recipe layer (`packages/core/synthesizer/recipes/*.json`, `recipe.schema.json` negative-tests, `packages/core/synthesizer/types.ts` `NegativeTest`) for a negative-test belonging to that rule id; copy its `input` value if present. Log ONE consolidated schema-mismatch finding (manifest-vs-recipe layer split) as input to v1.
2. **Weighted re-statement** — recompute the 11/7/5/3 split *weighted by criticality* (LOAD-BEARING rules only). Does ESLint v1 still cover ~42%, more, or less?
3. **Sub-wave scope recommendations** — for v1.5 and v3, list which specific rules belong in each (by id), and which can be skipped/deferred (with reason). v1.5 / v3 kickoff authors will inherit these lists verbatim.
4. **Triggers surfaced** — any rule whose criticality is UNKNOWN after the audit → flag as «needs maintainer classification» rather than guess.

## §2 Method (MANDATORY)
1. **Enumerate the manifest.** The manifest is a **top-level object keyed by rule id** (`IR1..IR6`, `R1..R20`), not a `.rules[]` array — use `jq 'to_entries'`. Process all 26 rules, no sampling — population enumeration BEFORE classification (per [phase-research-coverage.md §1 + T10](../../../.claude/rules/phase-research-coverage.md)).
2. **For each rule, classify by evidence, not by name.** Field map per `check.type` (verified 2026-06-10): **eslint** → `check.rule` (inline rule id); **command** → `check.command` (inline string — cite directly); **script** → `check.script` (consumer-install-relative path — all 3 dangle in this source repo: locate the actual source via `git grep`/`find`, e.g. `packages/core/probes/audit-r4.ts`, `packages/preset-next-15-canonical/audit-self/`; IR3's `check.script` is prose, not a path; record dangling-path as a FINDING, do NOT fix); **manual** → `check.rationale` (inline prose). T16 countermeasure: «id sounds critical» ≠ critical; «id has `auto-` prefix» ≠ auto-gen — read the rule, decide on evidence.
3. **Cross-reference recipes / templates.** A rule is LOAD-BEARING if a recipe or canonical-stack template references it; AUTO-GEN if synthesizer generates it from a known recipe with no manual customization; DEPRECATED if marked so in the manifest or replaced by another rule.
4. **No closure at the §1.5 floor.** This is the full-enumeration case, not a sampling case — sample 26 = enumerate 26.

## §3 Discipline obligations on the deliverable PR
- Patch lives under `docs/meta-factory/research-patches/` — folder-level authority covers individual files; scope-bound by audit ID.
- §1.7 forward+backward note: forward-check = audit complies with §1 + T10 + T16; backward-check = scope is bounded (single-umbrella research; no other artefact silently changed).
- No SSOT row, no Prior-art trailer (R-phase deliverable; SSOT rows land with v1/v1.5/v3 capability commits).
- ≤500-line cap on the patch (pre-commit awk gate) — if classification needs more, split into a CSV under same dir; the `.md` stays the annotated primary artifact (scope annotation + §1.7 + summary table), CSV is supplementary data only.
- **Principle-test gates (fire at pre-push + CI — fix BEFORE push, per CLAUDE.md Phase -1 allowlist-probe mandate):**
  - First line of the patch, literally: `<!-- scope:guard-liveness-v0-audit -->` — BEFORE the `#` title; principle 10 regex `/^<!-- scope:[a-zA-Z0-9.§-]+ -->$/` (alnum, dot, §, hyphen only).
  - Filename `2026-06-10-guard-liveness-v0-audit.md` — the `YYYY-MM-DD-` prefix is load-bearing for principle 13.
  - The §1.7 section must contain BOTH literal words «Forward» and «Backward» (principle 13 substance marker).
  - NO per-file Authoritative-for header — folder-level authority per doc-authority-hierarchy §5; principle 08 does not watch this path.
- PR base = `staging` (agent merge gate allows base=staging).
- Execution isolation: run in a dedicated worktree (orchestrator in-session dispatch uses `isolation: "worktree"`; cross-session start = `bash scripts/create-worktree.sh <name>` first, per parallel-subwave-isolation §1).

## §4 Out of scope
- **Don't propose a fix / new schema in this wave.** Audit only. Recommendations land as input to v1/v1.5/v3 kickoffs (v1 owns the `NegativeTest` schema change), not as code.
- **Don't classify rules that don't yet exist** (e.g. proposed but un-shipped). Manifest = source of truth for v0.
- **Explicit drive-by bans** (record as findings, do NOT fix in this PR): the 3 dangling `check.script` paths in the manifest; adding a wave-sequencing-plan §0 candidate row; patching v1.5/v3 kickoffs' stale `2026-05-2X` refs; adding `negative-test` to the manifest schema.

## §5 AI-laziness traps (per [.claude/rules/ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md))
Active: **T1** (sampling floor — N/A here: full-enumerate, not sample; if you find yourself sampling, STOP — population is 26), **T3** (file:line / output per cell — every `criticality` value cites repo evidence), **T9** (don't sample easy/recent rules — go in manifest order, all of them), **T10** (population BEFORE sampling — already enforced by full enumeration), **T15** (self-application: this audit's *own* deliverable should pass its own rules — patch carries §1.7 + folder-level authority), **T16** (pattern-matching-on-name — classify by reading the rule, not by what the id sounds like — see §2 step 2), **T19** (own cold-QA of the diff before handoff — CI ≠ design review), **T20** (inline-verdict-without-evidence — 26 per-row criticality calls are verdict-shaped; every cell cites repo evidence in the same row).
Domain-specific:
- **T-V0-A:** «manual-type rules look unimportant → mark all DEPRECATED». Counter: manual rules are often the most load-bearing (paired-negative, doc-authority headers) — read the rationale field before classifying.
- **T-V0-B:** «I classified 24/26 confidently, leave 2 UNKNOWN → done». Counter: leaving UNKNOWN is the correct move (per §1 point 4), but ≥3 UNKNOWN means audit is incomplete — re-probe with different evidence (recipe refs, template refs, git log for rule's last touch).

## §6 Phase -1
Cold-review THIS kickoff (1× Opus): stale refs, ambiguity, missing constraints, §5 substance. Grep memory for "guard-liveness" / "criticality classification" so the reviewer inherits context. Address BLOCKER/MAJOR, then proceed.

## §4c Autonomous dispatch — park-don't-guess (aif agent contract)

> **aif agent — fork discipline (non-negotiable):** on ANY genuine fork or ambiguity (two defensible implementations, an undecided design choice, a missing spec detail that changes behaviour) — do NOT pick: park it as a question (set the task to `manualReviewRequired` / `blocked_external`, stating the fork as «Option A → consequence X / Option B → consequence Y») and stop that task. Proceed only on the unambiguous parts. Guessing a fork to «keep moving» is the failure this loop exists to prevent. Bridge env carries `AGENT_MAX_REVIEW_ITERATIONS=1` — not converged in one review pass → hand to human, don't keep guessing.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
