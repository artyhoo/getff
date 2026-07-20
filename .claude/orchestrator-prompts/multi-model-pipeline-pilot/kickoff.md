# multi-model-pipeline-pilot — kickoff

> **Umbrella:** `multi-model-pipeline-pilot`. **Status:** authored — awaiting operator GO (stages S1-S3 and S5 spend z.ai Coding-Plan quota; do NOT dispatch without explicit GO).
> **Goal:** empirically close the designed-not-proven contract sections of [.claude/skills/claude-glm-executor-handoff/SKILL.md](../../skills/claude-glm-executor-handoff/SKILL.md) §5 by running the pre-registered probes **P3 → P1 → P2** (+ optional S5 mixed-container probe), recording each result as a research patch, and promoting or revising the contract per the predefined gates.
> **Decision record (binding input):** [docs/meta-factory/research-patches/2026-07-21-multi-model-pipeline-decisions.md](../../../docs/meta-factory/research-patches/2026-07-21-multi-model-pipeline-decisions.md) — this pilot executes its Fork-5 and Fork-6 verdicts; Forks 1-4 verdicts constrain the mechanics below.
> **Probe specs SSOT:** [docs/meta-factory/research-patches/2026-07-18-claude-glm-executor-handoff-facts.md](../../../docs/meta-factory/research-patches/2026-07-18-claude-glm-executor-handoff-facts.md) «Probes (4)» section (P1 :59, P2 :60, P3 :61, ordering :64, promotion criterion :68-74). Do not re-derive the specs — cite them.

## §1 Why probes, not infrastructure

The infrastructure already exists and is in production: the aif runtime's sole profile is `Z.AI GLM-5.2` (default for this project, live since 2026-07-16, 17 tasks done across all workflow kinds — decision record F-B); the park/answer escalation stack is e2e-proven (umbrella `aif-question-loop`, final PR #352); the cross-model contract is shipped designed-not-proven (PR #1032). The ONLY missing artifact class is probe results. Building anything before the probes land inverts the skill's own promotion criterion.

## §2 Stages

**S0 — rubric + task pre-registration (no model spend).**
Define and FREEZE, before any run: (a) the P3 rubric axes (proposal to beat: correctness-vs-spec / test-pass / convention-compliance via existing repo gates / diff minimality / review-finding count from the standard SDD reviewer pair) with a per-axis 0-2 score; (b) the three paired task classes per spec (mechanical bug fix / new feature / refactor) drawn from the real backlog; (c) blind scoring protocol — the scorer receives both outputs unlabeled (which-model-is-which stripped), as a cold reviewer-class session per [reviewer-discipline.md](../../rules/reviewer-discipline.md). Deliverable: `docs/meta-factory/research-patches/2026-07-XX-mmp-s0-rubric-preregistration.md` (frozen BEFORE S1 dispatch; any later rubric edit = restart P3).

**S1 — P3 paired capability probe (runs FIRST, per facts-patch :64).**
3 task pairs, same prompt to Sonnet and GLM-5.2 independently. **Arm parity (binding):** only the EXECUTOR model may differ between arms — all non-executor roles (coordinator, reviewers) stay model-constant across both arms; record the coordinator model per arm in the probe patch. If today's runtime cannot hold non-executor roles constant (a single-profile run remaps the WHOLE pipeline via alias mapping `sonnet→glm-5.2`, `opus→GLM-4.7` — decision record F-B), then: (a) drop the reviewer-finding-count axis from the S0 rubric and score only via the blind cold scorer; (b) flag in the probe patch that the GLM arm ran a GLM coordinator — outside the worker-only envelope ([agents/orchestrator-worker-discipline.md](../../../agents/orchestrator-worker-discipline.md):74) — so the gate verdict reads on the executor delta only with that caveat attached. Score per S0 rubric. Apply the P3 decision gate — the probe patch must QUOTE the facts-patch :61 gate row verbatim and record which branch fired (Sonnet>GLM on ≥2/3 → 3-tier justified; ≈ → peer-review collapse per the night-mode posture paragraph, [night-mode SKILL.md](../../skills/night-mode/SKILL.md):15; GLM> on any axis → routing inverts per-task, flag in contract). Deliverable: probe-result patch + gate verdict.

**S2 — P1 status-field probe.** 5 GLM dispatches carrying the REPORT schema ([agents/orchestrator-worker-discipline.md](../../../agents/orchestrator-worker-discipline.md):30-37). Count parse failures; gate ≤1/5. Include ≥1 dispatch engineered to hit a genuine judgment fork, to observe whether `BLOCKER: advisor-consult:` is emitted in the wild (Fork-1 falsifier data).

**S3 — P2 tool-loop convergence probe.** 3 agentic handoffs (read→edit→test); measure tool-call count; gate median ≤5.

**S4 — synthesis + skill update (one PR).** Fold probe verdicts into [claude-glm-executor-handoff SKILL.md](../../skills/claude-glm-executor-handoff/SKILL.md) §5 honest-gaps (promote proven sections, revise failed ones); fold the z.ai doc deltas from decision record F-E (weekly quota layer, peak multipliers, `/api/coding/paas/v4`) into the skill's facts; add SSOT trigger-review note on #222.

**S5 (optional, operator call) — mixed-models-one-container probe.** One aif container, two agents on different `model:` frontmatter values, both invoked in one run (skill §5 #4 precondition — the last designed-not-proven substrate claim). Cheap if S1-S3 already green.

## §3 Constraints

- **Quota discipline:** schedule all GLM runs OFF-PEAK (peak = 14:00-18:00 UTC+8 → 3× quota multiplier; off-peak 2×, promo 1× through end of September). Record per-stage: dispatch timestamps + prompts consumed. Weekly cap on Lite ≈ 400 prompts — the full pilot budget (≈11 dispatches + retries) must fit comfortably; if quota-blocked, WAIT for the cycle (Fork-4 verdict), never switch providers mid-probe.
- **[no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md):** all probes run in aif/session context; nothing probe-related enters CI.
- **Fork policy (Fork-1 verdict):** owner-strategy forks → park via the runtime-bridge park/answer flow (the e2e-proven channel); executor judgment-calls → `BLOCKER: advisor-consult:` sub-form, caps per [agents/orchestrator-worker-discipline.md](../../../agents/orchestrator-worker-discipline.md):86 (max 2 cycles).
- **One stage = one executor session** + pre-dispatch in-flight probe per [CLAUDE.md](../../../CLAUDE.md) «Pre-dispatch in-flight probe» (gh PR probe + ahead-commits + parallel-session scan + re-probe after any review).
- **Worker dispatch channel:** stages are dispatched through the aif runtime (kickoff-consuming coordinator), not via in-session write-capable subagents — per the project's channel-discipline gate.

## §4 Acceptance criteria

1. Each probe stage lands exactly one research patch (scope-annotated per principle 10) containing: raw per-run numbers, the gate applied verbatim with PASS/FAIL, quota consumed, and T6-style confidence predicates (counts + coverage + calibration; a clean low-n result is reported as «coverage-limited», never «proven» — T14).
2. S4's skill-update PR cites every probe patch by path and updates §5 honest-gaps to match runtime-verified reality (no doc-lies — [zcode-parity-doctrine.md §3](../../rules/zcode-parity-doctrine.md) status-column pattern).
3. The decision record's Fork-1/4/6 falsifiers are each explicitly checked against probe outcomes in S4 (fired / not fired, with evidence).
4. done.md written at S4 merge per [CLAUDE.md](../../../CLAUDE.md) «Umbrella closure convention» (S5 optional — if skipped, done.md records the skip + rationale).

## §5 Out of scope

CAS/versioning (Fork-2: deferred, armed trigger recorded in the decision record); any new escalation protocol (Fork-1: REUSE verdict); automatic provider fallback (Fork-4); self-hosting GLM; edits to README/goal-bearing docs; consumer-shipped artifacts (this is operator-axis work per [build-first-reuse-default.md §1.1](../../rules/build-first-reuse-default.md)).

## §6 AI-traps (per [ai-laziness-traps.md §3](../../rules/ai-laziness-traps.md))

Active traps for this umbrella: **T2** (designing ≠ running — the probes must actually dispatch, not be «would-pass» reasoned), **T3** (every probe claim needs command+output or file:line), **T6** (confidence as predicates, not «high»), **T7** (run the adversarial counter-prompt on each gate verdict), **T14** (clean low-n ≠ clean), **T15** (the pilot audits its own methodology — S0 pre-registration is itself an artifact to review), **T20** (no verdict without evidence-bearing tool output in the same turn).

Domain-specific:

- **T-MMP-A** — treating the 17 GLM-only zcode-parity completions (aif DB, 2026-07-16→19) as P3 evidence. They have no paired Sonnet control and no rubric; observational completions ≠ controlled comparison. P3 must run its own paired design regardless of how convincing the observational record looks.
- **T-MMP-B** — quota-blindness: peak-hour 3× multipliers silently burn the weekly cap; a probe session that ignores scheduling can exhaust the Lite weekly quota (~400 prompts) and misread it as «GLM unavailability» (contaminating the Fork-4 falsifier data). Record cycle timestamps + per-stage quota consumption in every probe patch.
- **T-MMP-C** — rubric-drift: adjusting the S0 rubric after seeing S1 outputs converts a pre-registered comparison into `#discipline-theatre`. Any rubric change after first dispatch = declared restart of P3, recorded in the probe patch.
