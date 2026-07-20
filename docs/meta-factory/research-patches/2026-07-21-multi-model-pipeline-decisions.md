<!-- scope:multi-model-pipeline-decisions -->

# Multi-model dev pipeline — decision record on the six open forks (2026-07-21)

> **Scope:** decision record + research provenance only; **no mechanism built, no rule edited, no skill changed, no probe run.** Input: the operator's prep doc `pipeline-idea-and-open-forks.md` (2026-07-19, outside the repo; §0 summarises its load-bearing content). This patch closes the doc's six deliberately-open forks with file:line evidence and a per-verdict falsifier, per [phase-research-coverage.md §1.7](../../../.claude/rules/phase-research-coverage.md) H1 recommendation discipline. Folder authority: [research-patches/](.) is scope-bound by gap per [doc-authority-hierarchy.md §5](../../../.claude/rules/doc-authority-hierarchy.md) — no per-file Authoritative-for header required. Companion artifact: the pilot kickoff at `.claude/orchestrator-prompts/multi-model-pipeline-pilot/kickoff.md` (executes the fork-5/6 verdicts).

## §0 Input

The operator's prep doc proposes routing development work by judgment-depth across model tiers — top tier (Fable/Opus-class) for architecture, skeptical review and fork resolution; a cheap strong-agentic tier (GLM-5.2-class) for research, implementation and bottom-up review; escalation upward when the executor hits a fork with a real cost of error. It explicitly self-describes as «не спецификация», leaves six forks open, and delegates the design decision to this session: (1) escalation mechanism, (2) CAS/versioning against parallel updates, (3) design-intent-fidelity check, (4) GLM-unavailability fallback, (5) whether to separate testing the routing idea from building infrastructure around it, (6) empirical methodology if tested.

## §1 Evidence base

Eight cold-agent reports (this session, 2026-07-20/21), each grounded in file:line or live-doc citations. Transcripts live in the session workspace; the load-bearing facts are restated with citations throughout §2-§3.

| # | Agent | Verified |
|---|---|---|
| E1 | contract-stack | REPORT schema + advisor-consult sub-form ([agents/orchestrator-worker-discipline.md](../../../agents/orchestrator-worker-discipline.md):30-95); SDD roster + BLOCKED handler (superpowers SDD `SKILL.md:104-120`, plugin cache 5.1.0); no `opus-advisor.md` exists in `agents/`; reviewer/auditor agent roster for pilot reuse |
| E2 | CC-capabilities | Live docs (code.claude.com, platform.claude.com, fetched 2026-07-21): advisor tool rollout-gate for Fable; `ANTHROPIC_BASE_URL` strictly process-global (no per-agent override); agent `model:` frontmatter passes arbitrary ids only behind a gateway/custom base URL; `--fallback-model` cannot cross providers |
| E3 | runtime-bridge | park/questions/answer mechanics (`packages/runtime-bridge/src/cli/{park,questions,answer}.ts`); CAS absent package-wide; aif-question-loop umbrella DONE (final PR #352) |
| E4 | GLM-facts | Probe designs P1-P3 verbatim + decision gates ([2026-07-18-claude-glm-executor-handoff-facts.md](2026-07-18-claude-glm-executor-handoff-facts.md):55-74); NO probe-result patch exists yet (verified negative, grep sweep) |
| E5 | z.ai reverify | Live docs.z.ai (fetched 2026-07-21): wiring env confirmed; Anthropic-shaped endpoint is Coding-Plan-gated (structurally); quota layers — 5h cycle + weekly cap + peak-hour multipliers |
| E6 | aif-runtime | Live aif-handoff DB (read-only via running container): GLM profile in production — §2 F-B |
| E7 | decided-stances | N0 defer+armed-trigger (`docs/meta-factory/wave-sequencing-plan.md:201-216`); SSOT #201 ADAPT stance; `NEEDS_ADVISOR`/advisor-consult liveness unproven (zero live records repo-wide); operator role→model memory (reviewers=Opus, workers=Sonnet, 2026-07-02) |
| E8 | SSOT sweep | #64/#45/#201 verdicts verbatim; «multi-model routing» and «GLM-as-executor» had ZERO SSOT coverage (`multi-model`/`model routing`/`z.ai`/`glm-5` grep = 0 hits) — gap closed by rows #221/#222 (this PR) |

## §2 Ground-truth findings that reshape the forks

- **F-A — The repo already owns most of the proposed design.** The prep doc's «черновой набросок ролей» is materialised: tier posture in [night-mode SKILL.md](../../../.claude/skills/night-mode/SKILL.md):15 (relative capability tiers, PR #902); the cross-model edge contract in [claude-glm-executor-handoff SKILL.md](../../../.claude/skills/claude-glm-executor-handoff/SKILL.md) (PR #1032); the escalation lattice in [agents/orchestrator-worker-discipline.md](../../../agents/orchestrator-worker-discipline.md):57-95; the park stack in `packages/runtime-bridge` (umbrella DONE #352). Re-deciding any of this from scratch would be `#parallel-evolution-creep` ([build-first-reuse-default.md §4](../../../.claude/rules/build-first-reuse-default.md)).
- **F-B — GLM-5.2 is already the production executor substrate.** aif-handoff runtime DB (E6, read-only): the ONLY runtime profile is `Z.AI GLM-5.2` (`base_url=https://api.z.ai/api/anthropic`, `api_key_env_var=ZAI_API_KEY`, key present in `.env`, created 2026-07-16), wired as the project-level default for `rules-as-tests-aif`; **112 usage events / ~8.8M tokens across 17 tasks (2026-07-16 → 2026-07-19), all reaching `done`, spanning every workflow kind** (planner / plan-checker / implementer / reviewer / review-gate / review-security). Corollaries: (i) the substrate + credential questions are closed empirically — no purchase or wiring work is on the pilot's critical path; (ii) whole-pipeline-on-GLM (planning and review stages included, via the profile's alias mapping `sonnet→glm-5.2`, `opus→GLM-4.7`) has 17 observational completions — real-world viability signal that nonetheless does **not** satisfy P3: no paired Sonnet control, no rubric (trap T-MMP-A in the pilot kickoff).
- **F-C — Cross-provider mixing is process-level only.** CC side (E2): base URL is process-global; no per-agent provider override; fallback chains resolve within one base URL. aif side (E6): one claude invocation receives exactly one `ANTHROPIC_BASE_URL` (aif-handoff `packages/runtime/src/adapters/claude/options.ts:266-272`); per-mode different-profile plumbing exists (aif-handoff `packages/data/src/index.ts:2735-2804`) but **has never been exercised** (no mixed-profile task in DB history; no agent frontmatter anywhere references a GLM model). The skill's «Opus coordinator + GLM worker in one container via `model:` frontmatter» therefore remains designed-not-proven ([claude-glm-executor-handoff SKILL.md](../../../.claude/skills/claude-glm-executor-handoff/SKILL.md):109).
- **F-D — The escalation lattice is complete, shipped, and partly unproven.** park/questions/answer proven e2e (#352); advisor-consult sub-form shipped with an explicit «no new `Status:` values» constraint ([agents/orchestrator-worker-discipline.md](../../../agents/orchestrator-worker-discipline.md):70); both `NEEDS_ADVISOR` (night-mode) and `BLOCKER: advisor-consult:` liveness are unproven — zero live records repo-wide (E7, verified negative).
- **F-E — z.ai doc deltas since the skill's 2026-07-18 snapshot** (E5): a weekly quota layer (Lite ~400 prompts / 7 days) on top of the 5-hour cycle; peak-hour multipliers (GLM-5.2 consumes 3× quota at 14:00-18:00 UTC+8, 2× off-peak, promo 1× off-peak through end of September); the coding-plan OpenAI-shape endpoint is `/api/coding/paas/v4` (distinct from the general `/api/paas/v4`). Folding these into the skill is pilot stage S4 scope — deliberately NOT edited in this PR (single-concern discipline per [CLAUDE.md «PR strategy»](../../../CLAUDE.md)).
- **F-F — SSOT gaps closed.** Multi-model routing had no SSOT row and the shipped `claude-glm-executor-handoff` capability had no SSOT row (a stranded-convention gap, E8). Rows [prior-art-evaluations.md#221](../prior-art-evaluations.md) and [prior-art-evaluations.md#222](../prior-art-evaluations.md) are added in this PR.

## §3 Fork verdicts

### Fork 1 — escalation mechanism → **(a)+(d): REUSE the existing two-channel lattice; no new protocol**

**Verdict.** Owner-strategy forks → park/questions/answer (`park.ts` PUT `paused:true` + `## ⏸ OPEN QUESTION` plan anchor; answer via 4-value `AnswerDecision`). Judgment-call escalation from an executor → `BLOCKER: advisor-consult:` sub-form inside the existing REPORT `BLOCKED` status. Option (b) (new versioned decision protocol) — REJECT now: no incident motivates it and it duplicates a DONE umbrella (`#parallel-evolution-creep`). Option (c) (manual-only) — subsumed: park IS the manual channel. Option (d) (`NEEDS_ADVISOR`) — already generalised into the sub-form for non-overnight dispatch per [agents/orchestrator-worker-discipline.md](../../../agents/orchestrator-worker-discipline.md):91; night-mode keeps its own convention for unattended runs.

**Evidence.** SSOT #109 (BUILD verdict for `park.ts` — upstream had no park primitive); umbrella DONE `#352` (`.claude/orchestrator-prompts/aif-question-loop/done.md:2`); sub-form spec at [agents/orchestrator-worker-discipline.md](../../../agents/orchestrator-worker-discipline.md):57-70 with routing table :76-80 and 2-cycle cap :86.

**Scope: operator-axis only.** The advisor-consult sub-form exists in [agents/orchestrator-worker-discipline.md](../../../agents/orchestrator-worker-discipline.md) (which the operator's aif workers read) but NOT in its shipped consumer twin — `packages/core/templates/shared/skill-context/aif-orchestrator-discipline/SKILL.md:36` carries the plain `BLOCKER` field with no sub-form (`grep -rn 'advisor-consult' packages/` = 0 hits; found by the cold backward sweep). The twin is maintainer-owned read-only per the [CLAUDE.md Artifact Ownership Contract](../../../CLAUDE.md), so the drift (`#two-prompts-drift` class per [dual-implementation-discipline.md](../../../.claude/rules/dual-implementation-discipline.md)) is **surfaced as a maintainer observation, not fixed here**: sync the sub-form into the twin only if/after the pilot's S2 data shows the convention routes reliably — syncing an unproven convention into the consumer surface would ship a designed-not-proven contract.

**Falsified if:** pilot probe P1 fails its gate (≥2/5 GLM REPORTs unparseable → the sub-form is unroutable on the GLM edge; fall back to Claude-side parsing per the P1 gate wording, [2026-07-18-claude-glm-executor-handoff-facts.md](2026-07-18-claude-glm-executor-handoff-facts.md):59); or a real decision-race incident lands (→ Fork 2 trigger fires and (b) reopens).

### Fork 2 — CAS/versioning → **DEFER + armed trigger (N0 §5.3 idiom)**

**Verdict.** Do not build CAS now. Arm a trigger instead, matching the repo's defer-with-armed-trigger precedent (`docs/meta-factory/wave-sequencing-plan.md:205`).

**Evidence.** CAS is absent by construction: `aifHttp.ts:56-58` is a bare partial PUT; `park.ts:132-148` and `answer.ts:207-212` are unguarded GET→PUT read-modify-write on `plan` (last-writer-wins); zero concurrent-write tests exist (E3, verified negative). Today's safety = forward-only state-machine events (`answer.ts:31-35` — a second resume is rejected 4xx) + low observed parallelism (17 tasks / 7 days in the aif DB, E6). The e2e-proven question loop (#352) shipped and operated without CAS.

**Armed trigger (any one fires → revisit):** (a) first documented clobber incident — a lost `## ⏸ OPEN QUESTION` or `## ✅ OPERATOR ANSWER` block traced to a concurrent `plan` write; (b) sustained ≥5 simultaneously-parked tasks; (c) a second concurrent operator/coordinator writing answers. On fire: decide bridge-side compare-and-swap vs aif-server-side revision field as a separate researched fork — not pre-decided here.

**Falsified if:** the trigger conditions are wrong-sized — e.g. a clobber occurs below 5 parked tasks (then the incident IS the trigger, per (a), and the verdict self-corrects).

### Fork 3 — design-intent fidelity check → **(d)+(e) hybrid at (b)'s cadence: REUSE two existing layers, applied by risk class; no new mechanism**

**Verdict.** Per-increment fidelity = SDD's spec-compliance reviewer (already ADOPTed, SSOT #64 — coordinator-initiated, fresh-context). Accumulated-drift fidelity = night-mode's two-altitude whole-work pass + completeness-critic, run once per umbrella/multi-stage unit, not per task — i.e. option (b)'s «by risk/class» cadence implemented with option (d)/(e)'s existing machinery (Phase -1 cold-review precedent for handoff artifacts; two-altitude pass for accumulated diffs). Option (a) (nothing beyond normal review) — REJECT: the 2026-05-09 reviewer-drift incident ([CLAUDE.md «Artifact Ownership Contract»](../../../CLAUDE.md)) is exactly the failure class normal per-increment review missed. Option (c) (unconditional per-task) — REJECT: cost without incident evidence at per-task granularity.

**Evidence.** Both layers exist and are named-cold-agent-protocol class, satisfying [attention-is-not-a-mechanism.md §1](../../../.claude/rules/attention-is-not-a-mechanism.md)(b): SDD reviewer prompts (E1); two-altitude pass in [night-mode SKILL.md](../../../.claude/skills/night-mode/SKILL.md) (E7); Phase -1 cold-review obligation in [CLAUDE.md](../../../CLAUDE.md) «Meta-orchestrator self-review obligation».

**Falsified if:** across ≥3 pilot/production umbrellas the whole-work pass surfaces zero findings the per-increment reviews missed (→ drop the extra pass, (a) wins), or it repeatedly surfaces MAJOR findings (→ escalate cadence toward (c)).

### Fork 4 — GLM-unavailability fallback → **no automatic fallback; queue-and-wait + operator profile-switch**

**Verdict.** No automatic cross-provider fallback is built. Quota-cycle exhaustion (the dominant «unavailability» mode) waits for the next 5-hour/weekly cycle; genuine outage → operator switches the aif project default profile back to an Anthropic profile (one DB row; historical profiles existed until 2026-06-29, E6). Self-host (MIT weights) — REJECT now: infrastructure cost is disproportionate to a pilot and `#integration-overhead-overestimate` cuts both ways.

**Evidence.** Automatic fallback is technically unavailable at both layers (F-C): CC `--fallback-model` cannot cross providers (E2, docs 2026-07-21); aif binds one base URL per invocation (`options.ts:266-272`). Quota structure (E5): 5h cycle Lite ~80 prompts + weekly ~400 + peak 3× multiplier — «wait for refresh» is the provider's own designed semantics (no balance deduction on exhaustion).

**Falsified if:** the pilot logs ≥3 quota-blocked working days in a month, or a z.ai outage ≥48h — then the queue-vs-second-provider-vs-self-host fork reopens with real frequency data.

### Fork 5 — separate the routing-idea test from infrastructure build → **YES: the pilot runs probes on existing infra and builds nothing**

**Verdict.** The separation the prep doc suspects is warranted — and the infrastructure half is already answered: profile live (F-B), park stack DONE (F-D), contract shipped designed-not-proven (F-A). What is missing is exactly one artifact class: probe-result research patches. The pilot (companion kickoff) therefore runs P3 → P1 → P2 per the pre-registered specs and gates, builds no new mechanism, and only then does any infra fork reopen on evidence.

**Evidence.** The skill's own promotion criterion already encodes probe-first ([2026-07-18-claude-glm-executor-handoff-facts.md](2026-07-18-claude-glm-executor-handoff-facts.md):68-74; [claude-glm-executor-handoff SKILL.md](../../../.claude/skills/claude-glm-executor-handoff/SKILL.md):112). P3 runs first per the ordering directive (facts patch :64 — its result reshapes what contract is even needed). The 17 GLM-only completions (F-B) justify optimism, not skipping P3 (T-MMP-A).

**Falsified if:** P3's result demands contract redesign before P1/P2 are meaningful (then infra-shaping work follows the probe — which is this verdict's intended order, not its refutation); or the operator overrides with build-first (their prerogative, surfaced as a park).

### Fork 6 — empirical methodology → **directed qualitative gates per the pre-registered probe specs; paired design; no formal statistics at n=3**

**Verdict.** Keep the probes' own pre-registered sample sizes and gates (P1 n=5, gate ≤1/5 parse failures; P2 n=3, gate median ≤5 tool iterations; P3 n=3 paired same-prompt task pairs across three task classes, gate ≥2/3). The paired design IS the ORCH-style power argument (same task through both modes beats splitting tasks between modes) applied at qualitative scale — ADOPT-VOCABULARY of the paired-comparison shape ([prior-art-evaluations.md#221](../prior-art-evaluations.md)), without McNemar formality at n=3. Report per T6 predicates (counts, coverage, calibration) and T14 (a clean low-n result is «coverage-limited», never «proven»). The P3 rubric axes are an open design item (E4: only «a fixed rubric» is specified anywhere) — pilot stage S0 defines and freezes them BEFORE any run (pre-registration against `#discipline-theatre`).

**Evidence.** Probe specs + gates verbatim at [2026-07-18-claude-glm-executor-handoff-facts.md](2026-07-18-claude-glm-executor-handoff-facts.md):59-61; rubric absence verified (E4).

**Falsified if:** P3 at n=3 is ambiguous (mixed per-class winners, or scores within rubric noise) — then escalate n with more paired task classes rather than switching methodology; formal stats become worth their cost only at n where cells stop being singletons.

## §4 Deliberately not done in this PR

No skill edits (F-E deltas → pilot S4), no runtime/bridge changes, no probe runs, no CAS work, no new escalation protocol, no capability commit (docs + SSOT rows + kickoff only). This mirrors the plan-§0 doc-lies-avoidance pattern of [zcode-parity-doctrine.md §3](../../../.claude/rules/zcode-parity-doctrine.md): design intent is recorded here; runtime reality changes only when the pilot lands its patches.

## §5 §1.7 self-reflexive note

Forward: this patch introduces no rule and no capability; it complies with [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) (all probes are session/aif-context, never CI), [build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md) (all six verdicts are REUSE/DEFER/REJECT — zero BUILD), principle 10 (scope annotation, line 1), and SSOT append-only §3 (rows #221/#222 carry Verdict/Rationale/Trigger). Backward: the change class «recording multi-model-pipeline decisions» was swept by a COLD PR-blind [backward-sweep-auditor](../../../agents/backward-sweep-auditor.md) run handed only the class — 28 surfaces enumerated, 27 SWEPT-CLEAN, 1 GAP-FOUND (the shipped consumer twin missing the advisor-consult sub-form — disposition recorded in Fork 1 «Scope: operator-axis only»). The one doctrine tension (whole-pipeline-on-GLM observations vs the skill's worker-only guard) is surfaced honestly in F-B/T-MMP-A rather than resolved silently: the guard governs the cross-model contract edge, which the all-GLM container runs never exercised. The PR body carries the CI-checked §1.7 sections with file:line citations.
