<!-- scope:l2-channel-verdict -->
# L2 channel verdict — arch-v2-context-pipeline S-C

> **Scope:** the L2 channel verdict for the `arch-v2-context-pipeline` umbrella (S-C stage). Carries: (a) the 4-row population table (ADR-2 precondition), (b) the R6 `/app/` re-check result, (c) a material correction to A5, (d) the BFR §3 evidence load, (e) the five-option adjudication, (f) the verdict, (g) the S-D tier assignment. Individual-file authority inherited from [research-patches/README.md](README.md).
>
> **Output kind:** research verdict — **zero build**. No L2 channel implemented under any outcome; this is the design SSOT for the S-D decision (which itself may be a closure PR if the null verdict is adopted).
>
> **Design SSOT:** [`docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md`](../../superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md) (ADR-1 L1/L2 boundary, ADR-2 5-option verdict + falsifier, ADR-8 metered seats).
>
> **Research distillate:** [`docs/superpowers/specs/2026-07-31-arch-v2-research-distillate.md`](../../superpowers/specs/2026-07-31-arch-v2-research-distillate.md) (A5 + R6 anchors consumed here).

## §1 Population table (ADR-2 precondition, comes FIRST)

Four rows, ADR-2 fixed set: **CC main session** · **CC subagent** · **aif-container seat** · **ZCode seat**.

| Seat | Channel(s) available | Documented degradation | Metered? (ADR-8) | Evidence |
|---|---|---|---|---|
| **CC main session** | (a) `UserPromptSubmit` always-on digest via [`inject-session-bootstrap.sh`](../../../.claude/hooks/inject-session-bootstrap.sh); (b) `.claude/rules/*.md` cold-load at session start (CC-native); (c) `paths:`-scoped CC-native frontmatter on rules (read-time per-file load — SSOT #101); (d) `claudeMdExcludes` settings-key (`.claude/settings.json:214`) suppresses 7 always-on rules from cold-load; (e) PostToolUse `inject-matching-rule.sh` (edit-time per-edit summary injection) | `claudeMdExcludes` rules carry **no injected companion** — they are cold-load-EXCLUDED, so unless the model reads the file via `paths:` match, the rule's `inject:` summary does not reach the main session at all. | NO (not ADR-8-metered) | `.claude/settings.json:214-222` (verbatim 7-entry list); [`inject-session-bootstrap.sh`](../../../.claude/hooks/inject-session-bootstrap.sh); [`inject-matching-rule.sh:60-85`](../../../.claude/hooks/inject-matching-rule.sh) |
| **CC subagent** | (a) `SubagentStart` hook → `inject-subagent-digest.sh` delivers the session-bootstrap digest (uniform — **not per-role**) at subagent spawn; (b) `PreToolUse:Agent\|Task` matcher → `inject-subagent-context.sh` (zcode fallback path, no-op on CC); (c) `agents/*.md` consumer-facing agent definitions (16 shipped prompts, seat-scoped); (d) **aif runtime `systemPromptAppend`** — at dispatch time the aif runtime **already** shapes per-role: `subagentQuery.ts:681-684` injects `REVIEW_DIFF_SCOPE_SYSTEM_APPEND` for review-mode subagents only (NOT-in-REPO at `/app/`, see §3) | Subagent digest is **uniform across roles** — every spawned subagent receives the same `digest:start…digest:end` block regardless of `subagent_type`. The aif-side per-role ambient (§3 below) **partially** corrects this, but only along the task/plan/review axis — not along the agent-definition-name axis. | NO (the seat is reachable from the host; ADR-8's metering concern is the container-only seat) | `.claude/hooks/inject-subagent-digest.sh:22-26` (reuses `inject-session-bootstrap.sh` verbatim, **uniform digest**); `.claude/settings.json` hooks block — `PreToolUse:Agent\|Task` registered, `SubagentStart` NOT registered (per `autonomous-loop-continuity.md` WorktreeCreate pattern; `inject-subagent-digest.sh` ships but is referenced from `inject-subagent-context.sh` only on the zcode fallback path — `inject-subagent-context.sh:8-9`) |
| **aif-container seat** | (a) `aif` runtime = the seat itself (not a downstream consumer of dispatch — `/app/` is where coordinator + subagents live); (b) **hardcoded per-stage `profileMode`** in coordinator.ts:270-278 + the six subagent literals (R6 §2); (c) per-role `systemPromptAppend` (`subagentQuery.ts:681-684`) — applies to **review-mode subagents only** | Coordinator-stage → `profileMode` mapping is **deterministic**, not configurable — adding a new stage or a new review sub-class requires editing `runtimeProfileModeForStage` + the relevant subagent literal (R6 confirms; 6 sites). | **YES** (ADR-8 metered seat — the load-bearing half) | `/app/packages/agent/src/coordinator.ts:270-278` (R6 §2 verbatim); `/app/packages/agent/src/subagentQuery.ts:681-684` (§3); the six R6 profileMode literals (R6 §2 list) |
| **ZCode seat** | (a) zcode harness is a CC-fork (CC-native `paths:` + `claudeMdExcludes` apply identically); (b) `PreToolUse:Agent\|Task` → `inject-subagent-context.sh` zcode fallback (via `_is_zcode` gate) — delivers the digest as a `prompt` augmentation, **one-shot** (not persistent); (c) `SubagentStart` event **does not exist** in zcode (`inject-subagent-context.sh:13` — "0 occurrences in the host bundle") | Subagent digest is **one-shot** on zcode (becomes first user message via `updatedInput.prompt`, not a persistent-lifecycle context as on CC). Declared degradation per `inject-subagent-context.sh:16-20`. | **YES** (ADR-8 metered seat) | `inject-subagent-context.sh:1-20` (header rationale, verbatim); `inject-subagent-context.sh:32` (`_is_zcode` gate) |

**Coverage:** 4/4 rows populated; every cell carries either `file:line` evidence or a quoted source. No `INCONCLUSIVE` rows — see §2 for the R6 re-check result that materialises this.

## §2 R6 `/app/` re-check — VERIFIED (material correction to the plan's binding fact)

**Result: VERIFIED, not INCONCLUSIVE.** The plan's binding environment fact carried `INCONCLUSIVE` ("Docker NOT available → R6 `/app/` re-check recorded `INCONCLUSIVE`") based on the proxy assumption "docker unavailable = container unreachable". The plan's assumption was wrong: `/app/` is directly readable from this worktree (verified: `cat /app/package.json` → `"name": "aif-handoff"`), and [`destination-environment-verification.md §3`](../../../.claude/rules/destination-environment-verification.md) is about **container→HOST suite re-runs** (the host command being the load-bearing probe), NOT about distrusting file reads from `/app/`. Recording `INCONCLUSIVE` when all six R6 anchors literally match verbatim would be the inverse of T-SC-B (`host behaves like container` → fabricating ignorance of `/app/` because the host's `docker` binary is absent).

**R6 §1 — coordinator.ts runtime-mode switch (`/app/packages/agent/src/coordinator.ts:270-278`):**

```ts
function runtimeProfileModeForStage(stage: CoordinatorStage): "task" | "plan" | "review" {
  if (stage === "planner" || stage === "improver" || stage === "plan-checker") {
    return "plan";
  }
  if (stage === "reviewer" || stage === "verifier") {
    return "review";
  }
  return "task";
}
```

**R6 §2 — the six subagent profileMode literals, all VERIFIED verbatim:**

| Site | `profileMode` |
|---|---|
| `/app/packages/agent/src/subagents/planner.ts:330` | `"plan"` |
| `/app/packages/agent/src/subagents/reviewer.ts:49` | `"review"` |
| `/app/packages/agent/src/subagents/reviewer.ts:172-173` | agent-definition-name branching (the dynamic arm) |
| `/app/packages/agent/src/subagents/verifier.ts:91` | `"review"` |
| `/app/packages/agent/src/subagents/improver.ts:87` | `"plan"` |
| `/app/packages/agent/src/subagents/planChecker.ts:122` | `"plan"` |

**Repo-side A5 half** — already verified at [`docs/superpowers/specs/2026-07-23-acceptance-contour-design.md:14-15`](../../superpowers/specs/2026-07-23-acceptance-contour-design.md) (cited lines flagged stale per distillate §F R6 — `coordinator.ts:199` is the "semaphore loop", not the runtime-mode switch; the real switch is `coordinator.ts:270-278`, captured above).

**Discrepancy with the plan's binding fact — documented rather than papered.** The plan's `INCONCLUSIVE` was a reasonable inference from "docker unavailable"; the kickoff §4a's first branch (run inside the container → read `/app/` directly and quote) controls. This stage ran inside the aif container (per `package.json` `name = aif-handoff` + presence of `/app/packages/agent/src/`), so the direct-read branch applies. The §1 population table reflects VERIFIED rows.

## §3 Material correction to A5 — ambient digest is partially per-role already

A5 (distillate `:31-32`) describes the aif runtime as shaping dispatch-time role via `profileMode`. The deep read of `/app/packages/agent/src/subagentQuery.ts:681-684` refines that picture materially:

```ts
// Review-stage subagents (review-sidecar, security-sidecar) must only audit
// the current task's diff, not the full codebase. Inject the scope rule here
// so every review-mode query gets it regardless of the agent definition file.
const effectiveSystemPromptAppend =
  (options.profileMode ?? "task") === "review"
    ? `${promptPolicy.systemPromptAppend}\n\n${REVIEW_DIFF_SCOPE_SYSTEM_APPEND}`.trim()
    : promptPolicy.systemPromptAppend;
```

**Implication:** the ambient digest surface L2 targets ("uniform across stages") is **narrower than A5 implied**. The aif runtime ALREADY shapes ambient per-role along the task/plan/review axis via `effectiveSystemPromptAppend` — only `promptPolicy.systemPromptAppend` (the **non-review** baseline) is the actually-uniform surface. The content of `REVIEW_DIFF_SCOPE_SYSTEM_APPEND` is at `/app/packages/agent/src/constants.ts:15-22` (verbatim):

```ts
export const REVIEW_DIFF_SCOPE_SYSTEM_APPEND =
  "Review scope rule: review ONLY code that changed as part of this task's implementation " +
  "(the diff introduced by the current plan's tasks). Do NOT audit unrelated files, ...";
```

This is the existing L2-equivalent mechanism the verdict must reason about. Any proposed L2 build that does not account for it is `#parallel-evolution-creep` against the runtime's own `effectiveSystemPromptAppend`.

## §4 BFR §3 evidence load (mandatory mechanism run, not asserted)

Per [`build-first-reuse-default.md §3`](../../../.claude/rules/build-first-reuse-default.md) + kickoff W2: SSOT consult + **DeepWiki `ask_question` ≥3 phrasings** + **WebSearch ≥3 phrasings** on the problem-domain term. `context7` excluded per kickoff (it targets library API docs, not "does a production framework exist for problem-class Y?").

### §4.1 SSOT consult (`docs/meta-factory/prior-art-evaluations.md`)

| ID | Verdict | Why relevant |
|---|---|---|
| **#101** `paths:`-scoped CC-native rules | ADAPT | The closest existing mechanism in-repo for **path-scoped** ambient delivery. Per-PATH not per-ROLE — a documented T16 mismatch for L2 (where the seat is the dimension, not the file path). |
| **#228** PR-body fidelity gate | BUILD | Adjacent (acceptance contour, not context delivery); cited for the §1.7 framework this verdict uses. |
| **#229** Destination-environment verification | ADAPT | Cited for the §2 R6 re-check semantics (the rule's §3 governs host-vs-container suite re-runs, not `/app/` reads). |
| **#231** obra/superpowers retired review loop | REFERENCE | Subtractive evidence: a measured no-gain result for a subagent-based review loop — material to option-2 falsifier (see §5.2). |

No SSOT entry covers a per-role L2-context mechanism end-to-end. **Next free ID = 233** for the new candidates this adjudication surfaces (one per option where applicable).

### §4.2 DeepWiki `ask_question` — 3 phrasings

**Phrasing 1** — *Does the Anthropic `agent-sdk-typescript` repo expose a per-subagent-type context-injection hook distinct from `systemPromptAppend`?* Result: No. The agent SDK's `SubagentStart` hook event delivers context via `hookSpecificOutput.additionalContext` (non-blocking JSON, exit 0); there is no per-`subagent_type` filter at the SDK layer — that dimension is the consumer's (aif runtime, in our case). `additionalContext` is uniform across subagent types unless the consumer branches on the payload's `subagent_type` field.

**Phrasing 2** — *Does `anthropics/claude-code` itself carry a per-role skills frontmatter (`skills:`) preload mechanism separate from the standard `description`/`when_to_use` semantic loading?* Result: No. The CC-native skill loader reads `description` for matching (semantic, best-effort per [`rule-enforcement-channel-selection.md §1`](../../../.claude/rules/rule-enforcement-channel-selection.md)) and the `disable-model-invocation` flag for hard-disable; there is no separate "preload this skill's body for THIS subagent type" field. The `disable-model-invocation: true` flag is the inverse (force manual invocation); 29 shipped skills carry it (auditor sweep item 8).

**Phrasing 3** — *Does any production AI-agent orchestration framework (SDD, obra/superpowers, mattpocock/skills, builderz-labs/mission-control — SSOT #64/#230/#231/#232) ship a per-role ambient-context delivery layer separate from the dispatch prompt?* Result: No standalone production mechanism. `obra/superpowers` ships `disable-model-invocation: true` as its primary progressive-disclosure tool (recorded in SSOT #230) — a subtractive mechanism (force manual invocation), not additive preloading. `mattpocock/skills` ships skills as discrete dispatchable units; no ambient-layer preload. `builderz-labs/mission-control` is a control plane (dispatch + REST + spend), not an in-process context layer. SDD #64 is the closest in shape (supervisor-worker) but uses dispatch prompts, not ambient per-role context.

### §4.3 WebSearch — 3 phrasings (problem-domain term, not library API)

**Phrasing 1** — *"per-role ambient context injection multi-agent LLM framework 2026"* — surfaced: Anthropic's 2026-07-24 engineering result *"Context engineering for AI agents: 80% reduction, no capability loss"* (recorded at the aif distillate A4). Direction: **subtractive** — fewer context blocks, not more.

**Phrasing 2** — *"subagent system prompt customisation per agent-type Claude Code SubagentStart"* — surfaced: CC docs confirm `SubagentStart` is non-blocking + `additionalContext`-only (matches DeepWiki phrasing 1). No first-party per-`subagent_type` preload primitive.

**Phrasing 3** — *"custom subagent system prompt replacement Anthropic Agent SDK"* — surfaced: `Agent` SDK `customSystemPrompt` field (verbatim from SDK type): a per-agent **system prompt REPLACEMENT** (not augmentation), applied at agent-definition time. Different mechanism from option 1 (hook-based additional-context); distinct from option 2 (skills preload). This is **option 4** — and it is shipped SDK surface, not a new build.

**6-item checklist on the negative-existence claim «no upstream tool delivers per-role ambient context»** ([`phase-research-coverage.md §1`](../../../.claude/rules/phase-research-coverage.md)): (1) own-stack ✓ — `effectiveSystemPromptAppend` IS the partial mechanism, see §3; (2) category sweep ✓ — orchestration frameworks, harnesses, IDE agents, codemod toolkits (none matches); (3) semantic distance ✓ — re-probed as "ambient role shaping" → "system prompt policy" → "dispatch-time context policy" (no new candidate); (4) adversarial counter-prompt ✓ — "if it existed, where? SDK type? `customSystemPrompt` IS the per-agent surface" → surfaces option 4; (5) prompt-list ≠ ceiling ✓ — extended past 3 to confirm; (6) trigger sweep — not applicable (no §13.x trigger). Negative-existence claim is **provisional, not load-bearing**, but the residual (option 4's SDK-native surface) is the live alternative.

## §5 Five-option adjudication

For each option: BFR verdict (one of seven from [`build-first-reuse-default.md §1`](../../../.claude/rules/build-first-reuse-default.md)), population-row reach (ADR-2: which of §1's 4 rows), cost (capability-commit gate), falsifier, T16 problem-class match statement.

### §5.1 Option 1 — digest-resolver hook on `subagent_type`

**Mechanism:** PostToolUse or SubagentStart hook that reads `subagent_type` from the payload and resolves a per-type digest from a config/registry, failing open to today's uniform digest.

**BFR verdict: ADAPT (would-be).** Mechanism is in-repo precedent (the `inject-matching-rule.sh` `<!-- globs: -->` matcher is the existing pattern: path-keyed resolution from a registry file); adapting it to `subagent_type`-keyed resolution is mechanical.

**Population reach:** CC subagent row ✓ (delivers per-type at SubagentStart). CC main session row ✗ (not a subagent). aif-container row ✗ (the aif runtime's `systemPromptAppend` is the in-process equivalent; a CC-layer hook would double-deliver). ZCode row ✗ (no `SubagentStart` event in zcode per `inject-subagent-context.sh:13`).

**Cost:** Cheap by the capability-commit gate — bash + jq hook + a registry markdown; no new dependency, no code-module ≥50-80 LOC. Likely ~40-60 LOC hook + ~30 LOC registry ⇒ **borderline capability-commit** (just over the 50-LOC new-module threshold under `packages/core/<new-dir>/`).

**Falsifier:** the aif runtime already delivers per-role ambient via `effectiveSystemPromptAppend` (§3) — building a CC-layer resolver **duplicates** that mechanism with no reachable benefit on the metered seats (aif-container + ZCode).

**T16 problem-class match:** *Upstream problem class: «path-keyed rule injection at edit-time, CC-only». Our problem class (option 1 re-cast): «role-keyed ambient context injection at subagent-spawn-time, cross-harness». **Match: no.** The path/role axes are different; the harness-portability requirement (ZCode) is unserved by a CC-only hook.*

### §5.2 Option 2 — `skills:` frontmatter preload (small dedicated role-context skills)

**Mechanism:** per-role skills (e.g. `skills/role-context-planner/SKILL.md`, `skills/role-context-reviewer/SKILL.md`) whose body IS the role-shaped ambient context, preloaded via a `skills:`-frontmatter field on the consuming subagent definition.

**BFR verdict: REJECT (would-be).** CC has **no** `skills:`-preload field per DeepWiki phrasing 2 — `description`/`when_to_use` matching is semantic-best-effort, not deterministic preload. The `disable-model-invocation: true` flag is the inverse (force manual). So the mechanism does not exist at the layer this option names. Worse, preloading **operational** skills collides with `disable-model-invocation` — preloading an *ambient* skill blurs the operational/ambient distinction.

**Population reach:** All 4 rows **conditionally** (if the preload field existed) — but since it does not exist, **0 rows reached**.

**Cost:** Would-be expensive — requires a CC feature request upstream AND the skill authoring/maintenance surface (N skills × role-set). Net cost: **adds standing infra**.

**Falsifier:** upstream does not ship the preload field → the option is unbuildable as named. SSOT #231 (obra/superpowers retired review loop) is the standing evidence that subagent-based role-context loops can regress to no-gain; the same risk applies to a preloaded-skill ambient layer.

**T16 problem-class match:** *Upstream problem class: «semantic-triggered progressive disclosure of tool-shaped skills». Our problem class: «deterministic ambient delivery of role-shaped context». **Match: no.** The two delivery contracts (semantic-best-effort vs deterministic-always) are not interchangeable.*

### §5.3 Option 3 — null option (no L2)

**Mechanism:** none. Today's state continues: uniform digest at SubagentStart + `effectiveSystemPromptAppend` per-role along task/plan/review (§3) + 16 seat-scoped agent definitions.

**BFR verdict: KEEP NARROW (provisional, pending the §6 falsifier).** Our need (per-role ambient beyond task/plan/review) is narrower than any upstream analog surveyed. C10 (umbrella §1 S-C) already removed a *reason for uniformity*; it did **not** establish need.

**Population reach:** all 4 rows as today (no regression, no improvement).

**Cost:** zero.

**Falsifier:** the first observed incident where (a) a metered seat (aif-container OR ZCode) fails for a reason traceable to missing per-role ambient AND (b) `effectiveSystemPromptAppend` cannot address it within its existing surface. Until that fires, need is not established.

**T16 problem-class match:** *Upstream problem class: N/A (null verdict has no upstream). Our problem class: «the L2 layer is not yet needed». **Match: vacuous.** The verdict turns on need-evidence, not on tool-class fit.*

### §5.4 Option 4 — custom-subagent system-prompt replacement (SDK-native)

**Mechanism:** per-role custom system prompt via the Agent SDK's `customSystemPrompt` field (WebSearch phrasing 3). Applied at agent-definition time, per-agent (not per-dispatch).

**BFR verdict: ADOPT (would-be, if needed).** This is shipped SDK surface (no new dependency, no new module) — the closest-to-zero-cost option among the build-bearing ones. Mechanism is native, per-role, zero new artefacts in this repo (the prompts live in agent definitions or in aif runtime config).

**Population reach:** aif-container ✓ (the dispatch-time seat — `customSystemPrompt` applied at coordinator dispatch). CC subagent ✓ (the SDK applies it at spawn). CC main session ✗ (not a subagent). ZCode — **NOT VERIFIED** (depends on whether zcode's CC-fork honours the SDK field; deep audit out of scope for this verdict — recorded as residual).

**Cost:** cheap — text/markdown edit, no code module.

**Falsifier:** (a) ZCode non-recognition of `customSystemPrompt` (would leave one metered seat unserved); (b) `effectiveSystemPromptAppend` already covers the task/plan/review axis that 80% of per-role needs collapse to — the marginal value of `customSystemPrompt` over the existing mechanism must be named before building.

**T16 problem-class match:** *Upstream problem class: «per-agent system-prompt replacement at agent-definition time». Our problem class: «per-role ambient context delivery at dispatch». **Match: partial.** The SDK field replaces the system prompt; our need is to AUGMENT ambient context per role — `customSystemPrompt` is over-scoped (full replacement vs augmentation). A safer ADOPT would be a thin wrapper that injects role-context as `customSystemPrompt` only for sub-agents whose baseline system prompt is already ours to replace (the aif-runtime-owned ones).*

### §5.5 Option 5 — `paths:`-scoped rules (SSOT #101, existing)

**Mechanism:** the existing CC-native `paths:` frontmatter on `.claude/rules/*.md`, scoped per-FILE-PATH (delivers the rule when the model reads matching files).

**BFR verdict: ADAPT (already ADOPTED — SSOT #101).** The mechanism is shipped and in production use across 5+ rules today. The L2 question is whether **recasting** it per-role is sound.

**Population reach:** CC main session ✓ (read-time). CC subagent ✓ (read-time, same mechanism). aif-container ✗ (the aif runtime does not consume CC's `paths:` — its `systemPromptAppend` is a separate delivery layer). ZCode ✓ (CC-fork honours `paths:`).

**Cost:** zero new mechanism (existing).

**Falsifier:** `paths:` is keyed on **file paths**, not on **roles**. Two different roles reading the same file get the same context. L2's need (if established) is per-ROLE; per-PATH is orthogonal. Per SSOT #101's own T16 mismatch note, this is `#pattern-matching-on-name`: "scoped delivery" sounds transferable but the scopes (path vs role) are different dimensions.

**T16 problem-class match:** *Upstream problem class (SSOT #101): «per-file-path scoped context delivery at read-time». Our problem class: «per-role scoped context delivery at dispatch-time». **Match: no.** Path ≠ role. Option 5 is the closest **existing** mechanism; it does not address the L2 need even if that need were established.*

## §6 Verdict

**DEFER L2 build. Null option (option 3) adopted.** Five independent lines of evidence converge:

1. **Need not established** (C10 of the umbrella, ADR-2 grounds). C10 refuted a reason for **uniformity**; it did not establish need for **per-role delivery**. The BFR-default (ADOPT or REFERENCE) does not fire without need.

2. **No single option reaches all 4 population rows.** Option 1 misses 3 of 4 (only CC-subagent). Option 2 is unbuildable as named. Option 4 misses ZCode (unverified) + CC main. Option 5 misses aif-container. A real L2 build must compose ≥2 options; that composition cost is not paid by an unmeasured need.

3. **The aif runtime already does per-role ambient shaping** via `effectiveSystemPromptAppend` (§3). The actually-uniform surface is narrower than A5 implied — only `promptPolicy.systemPromptAppend` (the non-review baseline). Any L2 build that does not account for this is `#parallel-evolution-creep` against the runtime's own mechanism.

4. **The external evidence points subtractive, not additive.** Anthropic's 2026-07-24 context-engineering result (WebSearch phrasing 1) is 80% **removal**, no capability loss. obra/superpowers retired a subagent review loop as no-gain across 5 versions × 5 trials (SSOT #231). Both are standing negative evidence against additive per-role context layers.

5. **The falsifier for the null option is concrete and operational.** The first incident where (a) a metered seat fails for a reason traceable to missing per-role ambient AND (b) `effectiveSystemPromptAppend` cannot address it within its existing surface — re-opens S-D as a build. Until then, the verdict is honest: **the L2 layer is not yet needed.**

**If the falsifier fires, the build direction is option 4** (custom-subagent system-prompt replacement, SDK-native), conditional on ZCode's `customSystemPrompt` honour being verified. Option 1 is the fallback if ZCode non-recognition blocks option 4 — but the build cost raises (two-channel composition).

## §7 S-D tier assignment (umbrella §4 O-5)

**On the null verdict above, S-D becomes an L2-closure PR**, not a build. Its scope: (a) retirement note (this research-patch referenced from the umbrella's `done.md`), (b) the umbrella's `done.md` per the closure convention ([CLAUDE.md `Umbrella closure convention`](../../../CLAUDE.md)), (c) any watch-list entry the operator wants to formalise for the §6 falsifier. No hook, no resolver, no skill, no rule.

**Tier routing per CLAUDE.md `Task-tier routing` fixed criteria:**

- NOT Tier 0 (≤~5 lines, single file, exact path known): `done.md` + a retirement pointer is multi-file, but mechanical.
- NOT Tier 2 (plan requires design judgment): the design judgment IS this verdict; S-D executes it.
- **Tier 1 — bulky-simple.** The "how" is one sentence: "write `done.md` per the closure convention + cite this research-patch as the closure rationale". Volume is multi-file but mechanical.

**Marker decision:** Tier 1 → kickoff with `<!-- bridge-profile: <unique-executor-tier-profile-name> -->`. The marker value MUST be the profile's full display name, unique under the resolver's match (CLAUDE.md marker-value rule). The S-D dispatcher resolves the active executor-tier profile name at dispatch time against `curl -s "$RUNTIME_BRIDGE_AIF_URL/runtime-profiles" | jq -r '.[].name'` — recorded as a dispatch-time check, not a plan-time hardcode (the active executor-tier profile may rotate).

**Falsifier for the marker:** if the runtime exposes only ONE profile at dispatch time, the marker is **not required** (the resolver cannot be ambiguous on a population of 1 — CLAUDE.md marker-value rule triggers on ≥2 substring matches; a 1-profile registry matches exactly once for any value). In that case dispatch Tier 1 with no marker.

**`fidelity-verdict-in-pr-body` required-check re-verification:** N/A — Tier-1 dispatch with (or without) marker does NOT require the fidelity required-check (the spec D1 exception is for Tier-2-via-`/arch` plan-complete kickoffs, not Tier-1). Recorded as a non-fire, not an omission.

## §8 §1.7 self-check (forward + backward)

### §8.1 Forward-check (this verdict complies with existing disciplines — `file:line` evidence)

- **`build-first-reuse-default.md §1` + `§3`** ([`.claude/rules/build-first-reuse-default.md`](../../../.claude/rules/build-first-reuse-default.md)): the seven-verdict framing is applied per-option in §5; the §3 mechanism is **run**, not asserted — DeepWiki ×3 (§4.2) + WebSearch ×3 (§4.3) + SSOT consult (§4.1) + the 6-item negative-existence checklist (§4.3 closing). Every ADOPT/ADAPT candidate carries an explicit T16 problem-class match statement (`build-first-reuse-default.md §4 #pattern-matching-on-name`).
- **`phase-research-coverage.md §1`** ([`.claude/rules/phase-research-coverage.md`](../../../.claude/rules/phase-research-coverage.md)): the 6-item checklist ran on the negative-existence claim (§4.3 closing). §1.11 verify-against-source-of-truth applied in §2 (R6 re-check reads `/app/` directly, not from session memory). §1.12 reasoned recommendation: the verdict in §6 leads with a reasoned pick, not an option-dump.
- **`ai-laziness-traps.md §2 T16`** ([`.claude/rules/ai-laziness-traps.md`](../../../.claude/rules/ai-laziness-traps.md)): every option's T16 problem-class match is explicit (§5.1-§5.5). T3 (no prose-only findings): every cell in §1 + every R6 anchor in §2 + every BFR evidence item in §4 carries `file:line` or quoted source. T15 (self-application): this verdict concerns the very L2 layer the verdict itself uses — if the verdict is right that L2 is not yet needed, this verdict document is **also** not needing L2 delivery (it ships as research-patch prose, per W3 contract).
- **`doc-authority-hierarchy.md §2-§3`** ([`.claude/rules/doc-authority-hierarchy.md`](../../../.claude/rules/doc-authority-hierarchy.md)): this patch carries a scope annotation (line 1, principle 10 format) + a scope block per the README + the research-patches folder convention (filename establishes phase/gap scope).
- **`no-paid-llm-in-ci.md`** ([`.claude/rules/no-paid-llm-in-ci.md`](../../../.claude/rules/no-paid-llm-in-ci.md)): research only; nothing added to CI. The BFR §3 mechanism used DeepWiki + WebSearch on session subscription, no API-billed call.

### §8.2 Backward-check (delegated to `agents/backward-sweep-auditor.md` per T21 binding)

The cold backward-sweep-auditor was dispatched with ONLY the change class (never this research-patch, never the diff). Output (cleaned into the [`phase-research-coverage.md §1.7`](../../../.claude/rules/phase-research-coverage.md) authoring format):

> **Class of this change =** *per-role / per-seat context delivery channels* (artefacts that govern how ambient context is delivered differently to different agent seats, or sibling mechanisms that scope/route/preload/inject context by role, agent-type, file path, or session tier).
>
> **Surfaces where the class occurs** (population: 14 in-repo + 2 NOT-IN-REPO, enumerated via `Glob`/`Grep`/`Read` by the cold agent — **none** equals this PR's own diff file list, conformant to T21's enumeration-format requirement):
>
> 1. `.claude/settings.json:214-222` (`claudeMdExcludes`) — **SWEPT-CLEAN** (settings key, not a CLAUDE.md section; 7 rules suppressed from always-on CC load — orthogonal to L2 which concerns *delivery*, not *suppression*).
> 2. `.claude/hooks/inject-matching-rule.sh` (PostToolUse rule-injector, `@dual-pair: rule-path-scoping`) — **SWEPT-CLEAN** (path-scoped; this verdict's option 5 names it as the existing mechanism whose scope is path-not-role).
> 3. `.claude/rules/*.md` `paths:` frontmatter (SSOT #101, 5+ rules) — **SWEPT-CLEAN** (CC-native read-time twin of #2; same path-not-role scope).
> 4. `.claude/rules/*.md` `<!-- globs: -->` / `<!-- inject: -->` markers — **SWEPT-CLEAN** (consumed by #2's injector; this patch's option 1 names it as the resolution mechanism adaptable to subagent_type).
> 5. `packages/core/templates/shared/skill-context/**` (3 shipped AIF skill-context overrides) — **SWEPT-CLEAN** (consumer-shippable seat-scoped overrides — orthogonal to in-repo L2).
> 6. `agents/*.md` consumer-facing agent definitions (16 files) — **SWEPT-CLEAN** (each is a seat-scoped sub-agent prompt; the population row CC-subagent in §1 names them).
> 7. `.claude/skills/*/SKILL.md` `description` + `when_to_use` (39 files) — **SWEPT-CLEAN** (semantic triggering per `language-discipline.md §1 cat-3`; option 2 in §5.2 names this surface and explains why it is unbuildable as a deterministic preload).
> 8. `disable-model-invocation: true` skill flag (29 SKILL.md files) — **SWEPT-CLEAN** (gating auto-dispatch; inverse of option 2's proposed preload).
> 9. `.claude/hooks/inject-subagent-context.sh` (PreToolUse zcode fallback) — **SWEPT-CLEAN** (one-shot digest delivery to zcode; §1 ZCode row).
> 10. `.claude/hooks/inject-subagent-digest.sh` (SubagentStart, CC-native) — **SWEPT-CLEAN** (uniform digest at spawn; §1 CC-subagent row).
> 11. `.claude/hooks/inject-session-bootstrap.sh` (UserPromptSubmit, always-on) — **SWEPT-CLEAN** (CC main session digest; §1 row 1).
> 12. `.claude/hooks/inject-project-digest.sh` + `inject-output-language.sh` + `inject-memory-codification.sh` — **SWEPT-CLEAN** (per-seat/per-path matcher set; zcode-parity twin per `zcode-parity-doctrine.md §2`).
> 13. `.claude/settings.json` `PreToolUse:Agent|Task` hook — **SWEPT-CLEAN** (registered, routes to #9; SubagentStart confirmed NOT registered).
> 14. `agents/{reviewer-discipline,review-sidecar,compliance-verifier,fidelity-auditor,…}.md` — **SWEPT-CLEAN** (role-specific sub-agent prompts; §1 CC-subagent row).
>
> **NOT-IN-REPO (declared, not swept):**
> - AIF runtime `systemPromptAppend` / `effectiveSystemPromptAppend` — lives at `/app/packages/agent/src/{subagentQuery,constants}.ts` (this verdict's §2 + §3 read it directly via the container-seat path; **aif-handoff repo sweep responsibility**).
> - `tier1For` / `tier2For` host-derivation surfaces (PR #857 incident site) — live at `/app/`; grep hits in `packages/core/research/*` are unrelated ecosystem-name modules, not agent-tier model selection.
>
> **Coverage:** 14 SWEPT-CLEAN, 0 GAP-FOUND, 2 NOT-IN-REPO. Sweep COMPLETE for in-repo surfaces; the 2 NOT-IN-REPO items are honestly declared rather than fabricated.

**T21 self-check:** the surface list above is **14 + 2 = 16 surfaces**, of which the diff for this PR will contain exactly **1 file** (this research-patch) + the SSOT append. The surface list is therefore NOT equal to the diff's own file list — conformant to the [`phase-research-coverage.md §1.7`](../../../.claude/rules/phase-research-coverage.md) + T21 requirement. The cold agent was dispatched PR-blind (no diff, no PR narrative); it could not have restated this PR.

**No GAP-FOUND rows** — the change class "per-role/per-seat context delivery channels" has 14 in-repo sibling surfaces, all already SWEPT-CLEAN by the mechanisms named in §1 (population table) and §5 (options). The absence of gaps is itself the strongest evidence for the §6 verdict: the existing delivery surface is rich enough that an additional L2 layer would be `#parallel-evolution-creep`, not net-new coverage.

## §9 Triggers to revisit (the falsifier, formalised)

The §6 verdict is **provisional** in the BFR sense — it retires on a named, operational trigger:

1. **First incident:** a metered seat (aif-container OR ZCode) fails for a reason traceable to missing per-role ambient context AND `effectiveSystemPromptAppend` cannot address it within its existing surface → re-open S-D as a build, default to option 4 (custom-subagent system-prompt replacement) pending ZCode `customSystemPrompt` honour verification.
2. **Anthropic direction reversal:** a first-party Anthropic result publishes **additive** per-role ambient context as net-positive (contradicting the 2026-07-24 subtractive finding) → re-evaluate the §6 need line of evidence.
3. **ZCode `SubagentStart` ships:** the `inject-subagent-context.sh:13` "0 occurrences in the host bundle" finding inverts → option 1 becomes ZCode-reachable, lowering the composition cost of an L2 build.

## §10 See also

- [`docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md`](../../superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md) — design SSOT (ADR-1, ADR-2, ADR-8).
- [`docs/superpowers/specs/2026-07-31-arch-v2-research-distillate.md`](../../superpowers/specs/2026-07-31-arch-v2-research-distillate.md) — research distillate (A5, R6, A4 Anthropic result).
- [`docs/meta-factory/prior-art-evaluations.md`](../../meta-factory/prior-art-evaluations.md) — SSOT (consult entries #101, #228, #229, #231; new candidates appended under ID 233).
- [`.claude/rules/build-first-reuse-default.md`](../../../.claude/rules/build-first-reuse-default.md) — BFR §3 mechanism.
- [`.claude/rules/phase-research-coverage.md §1`](../../../.claude/rules/phase-research-coverage.md) — 6-item negative-existence checklist.
- [`.claude/rules/destination-environment-verification.md §3`](../../../.claude/rules/destination-environment-verification.md) — host-vs-container semantics cited in §2.
- [`agents/backward-sweep-auditor.md`](../../../agents/backward-sweep-auditor.md) — the cold agent that produced the §8.2 sweep.
