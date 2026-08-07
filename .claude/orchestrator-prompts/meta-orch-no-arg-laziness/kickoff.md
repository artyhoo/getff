# Umbrella: `meta-orch-no-arg-laziness` — R-phase architectural fix for classifier-incompatible inline `!shell` patterns

> **Type:** R-phase only (no implementation in this umbrella; design + verdict).
> **Authoritative for:** R-phase scope covering THREE classifier-incompatible inline `!shell` surfaces in SKILL.md — (a) §3 winner-name persistence between independent `!shell` blocks (Bug #2); (b) classifier behavior on unexpanded `${var}` including `${umbrella:-}` default (Bug #3, verified blocked 2026-05-27); (c) §10 step 5b delta-write block with angle-bracket placeholders + `${umbrella:-no-arg}` (Bug #4, verified blocked 2026-05-27).
> **NOT authoritative for:** PR-A's §2.5 Step 3 Loop fix (already shipped as [PR #260](https://github.com/Yhooi2/rules-as-tests-aif/pull/260) — Bug #1, distinct surface). Implementation of any verdict — separate I-phase umbrella once verdict lands.
>
> **Scope widening rationale (2026-05-27):** Bug #2/#3/#4 share one root problem-class — «inline `!shell` block contains element the auto-mode classifier cannot verify pre-execution (unexpanded `${var}` OR angle-bracket placeholder requiring model substitution)». Solutions (F.1 file-state, F.2 re-invoke, F.3 helper-collapse) apply uniformly. One R-phase, one prior-art sweep, one verdict — avoids duplicate Cline/Superpowers/OhMyOpencode searches across 3 separate umbrellas. Falsifier in §0.5 below.

**Origin:** Closes the "deeper issue" explicitly deferred by PR #193 ([commit 8f60158](https://github.com/Yhooi2/rules-as-tests-aif/commit/8f60158)):

> «Symptom fix only. The deeper issue (§3 !shell blocks executing eagerly at skill load rather than lazily after §2 selects an umbrella) is architectural and out of scope here.»

**Prerequisite:** PR-A merged ([#260](https://github.com/Yhooi2/rules-as-tests-aif/pull/260) — §2.5 Step 3 Loop fix). PR-A had to land first because §2.5 produces the candidate-set N classifications that §2 priority scoring consumes to pick a winner; without iteration there's no winner to persist.

---

## §0 Problem statement

In `/meta-orchestrator` no-arg invocation:

1. §1 currency-check runs with `${umbrella:-}` (OK — defined empty default).
2. §2 priority scoring picks a winner-name (model judgment, prose decision).
3. §3 launch-table needs `${umbrella}` to point at that winner — but `!shell` blocks in CC fire **eagerly at skill-load** with whatever vars were set at invocation time. The winner-name from §2 is **not propagated** to §3's bash environment.

Currently `${umbrella:-}` defaults to empty, so [SKILL.md:239 launch-table-generator.sh](../../../.claude/skills/pipeline/SKILL.md#L239) and [SKILL.md:243 cat kickoff](../../../.claude/skills/pipeline/SKILL.md#L243) receive empty arg → emit `MISSING kickoff`. Skill survives (no F8), but §3 produces empty output and §4/§5 cascade-fail.

**New evidence (2026-05-27 incidents — load-bearing constraints on candidate design):**

**Incident A — Bug #3 surfaced.** While attempting to invoke `/meta-orchestrator meta-orch-no-arg-laziness` before PR #260 merged, CC auto-mode classifier blocked the §2.5 Step 3 `!shell` block with verbatim error:

> «Bash command references an unexpanded shell variable `${umbrella}` with no value visible in the transcript, so the actual target path is unverifiable and agent-inferred.»

**Incident B — Bug #4 surfaced.** Second test invocation `/meta-orchestrator` (no arg) reached §10 step 5b delta-arrays write block; classifier blocked with verbatim error:

> «Command contains unsubstituted placeholders (`<current_ids_json_array>`, `<resolved_ids_json_array>`, `<outcome-one-liner>`, `${umbrella:-no-arg}`) — jq will fail to parse and the script will run with literal placeholder args, an unverifiable/malformed action.»

Two operational facts established by these incidents:

1. **Unexpanded `${var}` in inline `!shell` block → classifier block.** PR-A's helper-delegation shape (`${CLAUDE_SKILL_DIR}/helpers/<name>.sh` with no other variables) survives because `${CLAUDE_SKILL_DIR}` is CC-runtime-visible. Any other `${var}` not visible in transcript = blocked.
2. **`${umbrella:-no-arg}` with explicit default ALSO blocked.** Previously hypothesised that `:-` default would unblock (§1.5b was «unknown»); now verified blocked. The classifier evaluates the literal text, not whether a default value exists. Verdict: **all `${var}` references in inline blocks are equivalently blocked** regardless of default-fallback shape.
3. **Angle-bracket placeholders (`<current_ids_json_array>`, `<outcome-one-liner>`) → classifier block.** These were intentional design (per SKILL.md §10 step 5b prose: «angle-bracket placeholders that the rendering AI substitutes with real JSON-array literals derived from §2.5 Step 8/9»). The classifier doesn't trust «model-substitutes-before-execution» as a contract — it sees the pre-substitution literal and blocks.

**Load-bearing constraint for all §2 candidates:** any winner-persistence (Bug #2) OR delta-write (Bug #4) shape MUST place no unexpanded `${var}` (except CC-runtime-visible like `${CLAUDE_SKILL_DIR}`) AND no angle-bracket placeholder in the inline `!shell` block. Substitution must happen entirely INSIDE a called helper script (helper internals are not classifier-read).

## §0.5 Falsifier on scope-widening

Widened scope (Bug #2 + #3 + #4 in one R-phase) is **wrong if** Bug #4 requires model-judgment INSIDE the substitution that no helper script can do deterministically. Specifically: `<current_ids_json_array>` is the post-dedup id set from §2.5 Step 8 — that set is produced by §2.5 Steps 2/3 helper outputs (deterministic) and the routing-tree judgment (model-applied). If a helper can read §2.5 outputs from a state file and reconstruct the id-array deterministically, F.1 file-state covers Bug #4 the same way it covers Bug #2 — scope-merge valid. If the id-array fundamentally requires re-running the routing-tree judgment (i.e., post-Step-5 model output not captured anywhere), Bug #4 is a different problem-class and needs its own umbrella. **§1.5d below adds a probe to settle this.**

---

## §1 Required searches (phase-research-coverage.md §1 — 6-item checklist on negative-existence)

Before any `BUILD` verdict, **all 6** must run with file:line evidence + fetched excerpts (T3 mandate):

1. **SSOT consult** — [docs/meta-factory/prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md) for entries on: «session-state», «cross-invocation persistence», «memory bank», «plan-cache», «ENV propagation», «winner persistence», «scratch file». Cite by ID. (Memory says SSOT #77 Cline Memory Bank = ADAPT for committed-markdown cross-session state — start there; SSOT #9 Cline Memory Bank subset is the parent. SSOT #68 OhMyOpencode boulder.json — REFERENCE precedent for session-continuity. Verify these by re-reading the SSOT, not by trusting the memory entry.)
2. **DeepWiki `ask_question`** (≥3 phrasings) on:
   - `obra/superpowers` — «how does Superpowers persist state between independent `!shell` blocks in a single skill invocation?»
   - `cline/cline` — «how does Cline Memory Bank pass selected-item state between session steps?»
   - `code-yeongyu/oh-my-openagent` — «how does OhMyOpencode pass winner-of-priority-scoring to downstream stages?»
3. **WebSearch** (≥3 phrasings, per [T12](../../../.claude/rules/ai-laziness-traps.md)): «claude code skill cross-block state», «slash command bash variable persistence», «skill session-bound state file», «agent runtime state between hook events».
4. **Build-vs-reuse SSOT** — full sweep over [prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md), not just keyword match. For each promising entry, T16 problem-class check: «upstream X = problem class Y; ours = winner-name persistence between independent skill `!shell` blocks within one invocation; match?»
5. **CC primitive verification** — direct probe + WebFetch of `code.claude.com/docs/en/hooks.md` and `code.claude.com/docs/en/sub-agents.md` and slash-command docs. Required outputs:
   - **5a — Block timing:** confirm experimentally whether `!shell` blocks execute eagerly at skill-load (all blocks run before model produces any output) OR lazily (block N runs only after model «reaches» it). Probe = synthetic skill with two blocks; block 1 writes `${date}` to `/tmp/probe-N.txt`, block 2 reads `/tmp/probe-N.txt`. If block 2 sees block 1's write, blocks run sequentially with file-persistence between. If block 2 emits stale/empty, eager-all-at-once timing.
   - **5b — Classifier constraints on `${var}` and angle-bracket placeholders (PARTIALLY VERIFIED 2026-05-27):**
     - `${CLAUDE_SKILL_DIR}` — **VERIFIED OK** (PR #260 §2.5 Step 3 helper-delegation block passes classifier).
     - `${umbrella}` (no default) — **VERIFIED BLOCKED** (Incident A above).
     - `${umbrella:-no-arg}` (with default) — **VERIFIED BLOCKED** (Incident B above) — `:-` default does NOT unblock.
     - `<angle-bracket-placeholder>` — **VERIFIED BLOCKED** (Incident B above).
     - `${X}` for arbitrary undefined var — **likely blocked by extrapolation, but no direct probe yet**. Probe = synthetic skill block with `echo "$UNDEFINED_VAR"` to confirm.
     - `$(command-substitution)` (e.g., `$(date -u +%Y-%m-%dT%H:%M:%SZ)`) — **UNKNOWN, needs probe** ([SKILL.md:521](../../../.claude/skills/pipeline/SKILL.md#L521) has `NOW=$(date ...)` adjacent to the blocked block — was the date substitution OK and the placeholders the only block-trigger, or are both blocked? Re-test in isolation).
     - **Verdict criterion:** the candidate matrix in §2 may assume only `${CLAUDE_SKILL_DIR}` is classifier-safe; anything else needs §1.5b probe evidence before claiming OK.
   - **5c — `allowed-tools` write paths:** verify whether the skill's `allowed-tools` list ([SKILL.md:8-16](../../../.claude/skills/pipeline/SKILL.md#L8-L16) — `Bash(git *)`, `Bash(gh *)`, `Bash(ls *)`, `Bash(cat *)`, `Read`, `Write`, `Edit`, `Agent`) permits writing to `.claude/orchestrator-prompts/_meta-orch-*` paths during a single invocation (F.1 viability gate). Note: current `allowed-tools` does NOT include `Bash(jq *)` or generic Write-via-Bash — F.1 may need to use `Write` tool not `bash > file`.
   - **5d — §10 step 5b deterministic-substitution feasibility (settles §0.5 falsifier):** examine §2.5 Step 8/9 + §10 step 5b prose ([SKILL.md:225-226 + :518-527](../../../.claude/skills/pipeline/SKILL.md)). Are `<current_ids_json_array>` and `<resolved_ids_json_array>` derivable from `_master-backlog-delta.json` + `priority-score.sh` output alone (deterministic), or do they require the post-routing-tree id set that exists only in model context (judgment)? If deterministic, F.1 file-state extends naturally to Bug #4. If judgment-required, Bug #4 needs a different candidate (e.g., extend §2.5 Steps to PERSIST the routing-tree id set to a file BEFORE §10 step 5b reads it).
6. **DeepWiki on this repo** — `Yhooi2/rules-as-tests-aif` — search for prior incidents/research on «cross-block state», «winner persistence», «`!shell` timing» in `.claude/skills/meta-orchestrator/`. Also search merged PR history for prior winner-persistence attempts that may have been abandoned.

---

## §2 Candidate solutions (rank with falsifiers)

Score each on: (a) BFR posture; (b) UX friction; (c) failure modes; (d) reversibility; (e) **classifier compatibility per §0 evidence — load-bearing**; (f) **applicability to Bug #2 AND Bug #4 (scope-merge per §0.5)**.

- **F.1 — File-state-as-substrate.** §2 writes winner-id to `.claude/orchestrator-prompts/_meta-orch-state.json` (or extends `_master-backlog-delta.json` with `current_winner` + `current_ids` + `resolved_ids` fields). §3/§4 inline `!shell` blocks become single-helper calls: `${CLAUDE_SKILL_DIR}/helpers/launch-table-generator-from-state.sh` (reads `current_winner` from file); §10 step 5b becomes `${CLAUDE_SKILL_DIR}/helpers/delta-write-from-state.sh` (reads `current_ids` + `resolved_ids` from file, runs jq INSIDE the helper). **Classifier verdict:** only `${CLAUDE_SKILL_DIR}` in inline block → classifier-safe per Incident A/B negative-control. **Covers:** Bug #2 (winner-name) ✓ + Bug #4 (delta-arrays) ✓ — both reduce to «read structured state from file inside helper». **ADAPT precedent:** SSOT #77 (Cline Memory Bank committed-markdown). **Falsifier:** wrong if (a) `Write` tool blocked from `.claude/orchestrator-prompts/_meta-orch-state.json` path by `allowed-tools` (verify §1.5c); OR (b) §1.5a probe reveals blocks execute eagerly all-at-once before model can write the file between §2 and §3; OR (c) §1.5d probe reveals `current_ids` requires post-routing-tree judgment that no helper can reconstruct deterministically — then Bug #4 needs F.1+ extension (§2.5 Steps must persist routing-tree output to file too).

- **F.2 — Re-invoke with winner-arg (covers Bug #2 only).** §2 concludes with: «Recommend `<winner>`. To proceed, run `/meta-orchestrator <winner>` in this session.» No-arg mode exits at §2; the next invocation enters arg-mode where `${umbrella}` IS set by CC primitive (slash-command argv) — classifier-safe because argv expansion is CC-runtime-visible. **Trade-off:** clean architecturally; two invocations instead of one (UX friction); but the §0 «confirmation gate» in [SKILL.md:129](../../../.claude/skills/pipeline/SKILL.md#L129) already expects a maintainer GO between §2 winner-pick and Stage 1 dispatch — re-invocation is a natural place for that gate. **Covers:** Bug #2 ✓ + Bug #4 ✗ (§10 step 5b runs INSIDE the arg-mode invocation, still needs deterministic substitution). **Falsifier:** wrong if maintainer prefers strictly single-command UX OR if state-passing via slash-command argv is restricted by CC docs (verify §1.5). **NOTE:** F.2 alone is insufficient for scope-merge — needs F.1 or F.3 to cover Bug #4.

- **F.3 — Helper-collapse for both §3/§4 AND §10 step 5b.** Two new helpers: (a) `dispatch-from-state.sh` (collapses §3+§4 launch-table + meta-kickoff + state.md, reads winner-id from `_meta-orch-state.json`); (b) `delta-write-from-state.sh` (collapses §10 step 5b jq invocation, reads ids from state file). Both invoke purely via `${CLAUDE_SKILL_DIR}/helpers/<name>.sh` — no other vars, no placeholders. **Covers:** Bug #2 ✓ + Bug #4 ✓. **Variant of F.1** — F.3 = F.1 + section-collapse. **Trade-off:** larger refactor; risk of breaking arg-mode flow (where §3 currently runs fine with `${umbrella}` from argv). **Falsifier:** wrong if §3/§4 contain judgment steps that can't be deterministic-ised in a helper; OR if F.3's complexity gain over plain F.1 is not justified (F.1 alone may suffice if inline blocks just become single-line helper calls).

- **F.4 — REJECT by default.** Replacing `${umbrella}` with `${meta_orch_winner}` (env-var inheritance) **fails classifier per Incident A/B**: classifier blocks ANY unexpanded `${var}` other than `${CLAUDE_SKILL_DIR}`. **Falsifier:** wrong only if §1.5b probe surfaces a specific seam-pattern (e.g., `MO_*` prefix) the classifier allows; no such evidence today.

- **F.5 — Document-the-limitation (UX-explicit F.2).** Accept that no-arg mode halts at §2 winner recommendation; instruct maintainer to manually start a new arg-mode invocation. Covers Bug #2 (workaround); does NOT cover Bug #4 (§10 still blocks). **Falsifier:** wrong if maintainer wants the skill to feel autonomous post-recommendation; also fails scope-merge criterion.

**Cross-bug coverage matrix (preliminary, pending §1 search outcomes):**

| Candidate | Bug #2 (§3 winner-persist) | Bug #3 (`${var}` classifier-block) | Bug #4 (§10 step 5b) | Scope-merge viable |
|---|---|---|---|---|
| F.1 | ✓ | ✓ (no `${var}` in inline) | ✓ (assumes §1.5d ok) | yes |
| F.2 | ✓ | ✓ (argv is CC-visible) | ✗ | no — needs F.1/F.3 too |
| F.3 | ✓ | ✓ | ✓ | yes |
| F.4 | ✗ classifier block | ✗ | n/a | no |
| F.5 | partial (UX workaround) | n/a | ✗ | no |

---

## §3 Out of scope

- **NOT in this R-phase:** any code change to SKILL.md, helpers, or principle tests. R-phase output = research-patch + verdict. Implementation = separate I-phase umbrella once verdict lands.
- **NOT in this R-phase:** PR-A's §2.5 Step 3 Loop fix (already shipped as #260 — distinct bug from §3 winner-persistence; PR-A is the prerequisite, not part of this scope).
- **NOT in this R-phase:** comprehensive integration test of no-arg flow end-to-end (separate `full-check` umbrella planned after this R-phase + the chosen I-phase land).
- **NOT in this R-phase:** redesign of §1 currency-check, §2 priority-scoring rubric, §10 inline session report format — only the §2→§3 winner-passing boundary.

---

## §4 Output

A research-patch at `docs/meta-factory/research-patches/2026-MM-DD-meta-orch-no-arg-laziness.md` containing:

- **§0 Problem statement** — cite #193 deeper-issue note (file:line), b1f47f4 commit, this kickoff path, the 2026-05-27 classifier-block incident with verbatim error text.
- **§1 Search results** — all 6 searches with file:line evidence, fetched excerpts (DeepWiki responses verbatim, WebFetch URLs + key paragraphs, command outputs from §1.5 probes). T3 mandate: no prose-only findings.
- **§2 Candidate matrix** — F.1 / F.2 / F.3 / F.4 / F.5 with: BFR verdict per [build-first-reuse-default.md §1](../../../.claude/rules/build-first-reuse-default.md) (one of ADOPT / ADOPT VOCABULARY / ADAPT / REFERENCE / KEEP NARROW / BUILD / REJECT); falsifier («wrong if …»); classifier-compatibility score from §1.5b; integration cost estimate.
- **§3 SSOT entries to add** — if any new upstream precedents surface, draft append entries for [prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md) with the standard schema. If only existing entries (e.g., #77, #68) apply, document which row + how it transfers.
- **§4 §1.7 self-reflexive checks** — forward (does the verdict comply with [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md), [build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md), [dual-implementation-discipline.md](../../../.claude/rules/dual-implementation-discipline.md), [doc-authority-hierarchy.md](../../../.claude/rules/doc-authority-hierarchy.md)?); backward (does anything in this patch supersede existing rules, principle tests, or SSOT entries silently?). T15 instantiation.
- **§5 Closure proposal** — recommended winning verdict with rationale; recommended I-phase umbrella shape (file scope, test additions, principle test extension if needed).
- **§6 Maintainer DECISION-NEEDED** — per [reviewer-discipline.md §2](../../../.claude/rules/reviewer-discipline.md): name the decision explicitly, describe each option's downstream consequences, flag maintainer-or-orchestrator escalation, stop without inferring.

---

## §5 AI-traps (instantiate, not blanket-reference — per [ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md))

Active canonical T-numbers for this R-phase:

- **T1** — sampling floor=5 for upstream candidates per problem-class (don't stop at SSOT #77 alone)
- **T3** — file:line evidence for every claim, especially §1.5 probes
- **T4** — don't close before all 6 searches; the §1 list is the floor, not the ceiling
- **T7** — run adversarial counter-prompts at category level («what candidate solution did I miss?»), not pattern-match the F.1–F.5 list
- **T11** — prior-art check BEFORE proposing any novel mechanism (F.4 / F.5 are «novel-shape» candidates and need especially careful prior-art sweep)
- **T12** — WebSearch at proposing-moment, not from training data; CC harness behavior may have changed post-cutoff
- **T13** — audit ADOPTED-MECHANISM items (#77 Cline Memory Bank) for upstream evidence depth, don't trust SSOT entry as terminal
- **T15** — self-application: does THIS research-patch apply its own framing? (does its own design choice for winner-passing pass §1.5b classifier check?)
- **T16** — problem-class match on each upstream candidate verbatim («upstream X = problem class Y; ours = Z; match?»); SSOT #77 is committed-markdown for cross-SESSION state; ours is within-INVOCATION state — partial mismatch
- **T19** — own cold-QA pre-handoff: re-review the patch as an independent reviewer before declaring done; check that §6 DECISION-NEEDED items are real decisions, not punted judgment
- **T20** — no inline verdicts without an evidence-bearing tool call same turn; every «F.X = ADOPT/BUILD/REJECT» must be preceded by a Bash/Read/Grep/WebFetch/WebSearch in the same turn

Domain-specific (new for this R-phase):

- **T-N1 — assuming `!shell` block timing without verifying CC docs.** AI tempted to claim «blocks execute lazily» or «eagerly» without WebFetch of `code.claude.com/docs/en/hooks.md` or an experimental probe. **Counter:** §1.5a probe is MANDATORY — synthetic two-block skill writing+reading `/tmp/probe-N.txt`. If §1.5a can't run experimentally, mark verdict as PROVISIONAL with that explicit caveat.
- **T-N2 — assuming classifier behavior on `${var}` and placeholders without verification.** §0 evidence (Incident A + B, 2026-05-27) verifies: `${umbrella}` BLOCKED, `${umbrella:-no-arg}` BLOCKED (`:-` default does NOT save), angle-bracket `<placeholder>` BLOCKED, `${CLAUDE_SKILL_DIR}` OK. Still UNKNOWN: arbitrary undefined `${X}`, `$(command-substitution)`, seam-prefix patterns. AI tempted to extrapolate or assume. **Counter:** §1.5b MUST include synthetic probes for each variable shape used in candidate solutions F.1–F.5. Verdicts that depend on classifier behavior must cite the probe output verbatim.

- **T-N3 — assuming Bug #2/#3/#4 are one problem-class without §1.5d evidence.** Scope-merge in §0.5 is provisional pending §1.5d probe (does `<current_ids_json_array>` reconstruct deterministically from helper-reachable state, or does it require post-routing-tree model judgment?). AI tempted to declare «one problem-class, F.1 covers all» without running §1.5d. **Counter:** §1.5d MUST be among the first probes run in §1. If §1.5d shows judgment-dependency, Bug #4 needs F.1+ extension (persist routing-tree output to state file in §2.5 itself); document that as a separate sub-candidate in §2 before verdict.

---

## §6 Verdict criteria

The R-phase verdict is **one of**: F.1 / F.2 / F.3 / F.4 / F.5 / DEFER (insufficient evidence; specify what evidence is missing and how to gather) / NEW-OPTION-F.6 (a candidate that emerged from §1 searches not in the §2 list).

The verdict body MUST include:

- **Cited evidence** — SSOT entry IDs (e.g., «#77 Cline Memory Bank ADAPT»), file:line, command output from §1.5 probes, WebFetch excerpts. T3 + T20 mandate.
- **Falsifier** — «wrong if …»: what new evidence (next CC release, new prior-art discovery, classifier behavior change) would flip the verdict.
- **BFR posture** — one of ADOPT / ADOPT VOCABULARY / ADAPT / REFERENCE / KEEP NARROW / BUILD / REJECT per [build-first-reuse-default.md §1](../../../.claude/rules/build-first-reuse-default.md). If BUILD, integration-cost estimate (LOC, files touched, new dependencies).
- **Classifier-compatibility score** — per §1.5b results, which inline-block shapes does the verdict require and are they all classifier-safe.
- **I-phase preview** — sketch of the implementation umbrella that would land the verdict (file scope, principle test impact, capability-commit threshold check).
