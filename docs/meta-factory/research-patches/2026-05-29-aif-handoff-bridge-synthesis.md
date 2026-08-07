<!-- scope:aif-handoff-bridge-synthesis -->

# Synthesis — aif-handoff as runtime bridge (cross-variant verdict, Sub-wave D)

> **Status:** R-phase Sub-wave D complete — 2026-05-29. **NOT prescriptive** — additive evaluation for maintainer decision. Class N/A (research-patch, folder-level authority inherited per [`doc-authority-hierarchy.md §5`](../../../.claude/rules/doc-authority-hierarchy.md)). No code changes, no skill edits, no SSOT row landings in this patch.
> **Authoritative for:** cross-variant synthesis for the `aif-handoff-as-runtime-bridge` umbrella — 20-cell comparison table (5 criteria × 4 variants A/B/B'/C), T16 problem-class match table per variant, DN-1 (B-constrained) + DN-2 (SW-B verdict stands + B' is operative B-path) reflection, hook-discipline analysis (per Decision 10), §6 final recommendation per kickoff §6.5 (GREENLIGHT / DEFER / REJECT), consolidated SSOT additive-note proposals across rows #27/#28/#30/#44/#67/#80, proposed new SSOT row #85 (next-after-#84) consolidating all 4 variants.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Variant-specific findings — see [SW-A patch](2026-05-29-aif-handoff-bridge-variant-a-mcp.md), [SW-B patch](2026-05-29-aif-handoff-bridge-variant-b-watcher.md), [SW-B2 patch](2026-05-29-aif-handoff-bridge-variant-b-prime-hybrid.md), [SW-C patch](2026-05-29-aif-handoff-bridge-variant-c-minimal.md). I-phase / implementation decisions — those are downstream of this verdict (kickoff §6.5 directs to GREENLIGHT or DEFER, not to implement). The maintainer-hypothesis itself (SSOT #30/#44/#67 revisit triggers) — kickoff §1 explicitly notes those triggers are **empirical** («has run ≥3 autonomous batches»), not **articulatory** («has been considered»); this synthesis evaluates the hypothesis without claiming the trigger has fired.

---

## §0 TL;DR

**Per-variant verdicts (re-derived independently per T15; consistent with the four predecessor Sub-wave patches):**

| Variant | Verdict | Match score | Origin patch |
|---|---|---|---|
| **A** — MCP-consumer (explicit invoke) | **REFERENCE** | 28% | [SW-A §5](2026-05-29-aif-handoff-bridge-variant-a-mcp.md) |
| **B** — native fs-watcher in aif-handoff | **REJECT** | ~5% | [SW-B §5](2026-05-29-aif-handoff-bridge-variant-b-watcher.md) |
| **B'** — hybrid our-side fs-watcher + their existing MCP | **REFERENCE** (conditional ADOPT VOCABULARY if A is greenlit + DN-1=B-constrained adopted) | ~35% | [SW-B2 §5](2026-05-29-aif-handoff-bridge-variant-b-prime-hybrid.md) |
| **C** — minimal bridge / Implementer-only | **REJECT** | ~22% | [SW-C §6](2026-05-29-aif-handoff-bridge-variant-c-minimal.md) |

**Cross-variant recommendation per kickoff §6.5: DEFER all variants with updated SSOT «Trigger to revisit» fields (additive-note-only, no verdict changes to SSOT #30/#44/#67).**

**Rationale (one paragraph):** No genuine equipoise exists between the four variants — they each occupy a distinct ladder rung and serve a distinct sub-goal, so the §8 STOP «2+ variants tie → DECISION-NEEDED» does **not** fire. Per kickoff §6.5 ladder, none of A/B'/C reach ADOPT or ADAPT rungs at current scale: (i) Variant A's REFERENCE verdict is structurally locked by 3 unresolved blockers (PLAN.md disk coupling, WebSocket broadcast no-topic-filter, autoMode Reviewer ↔ reviewer-discipline.md §2 conflict — the latter only partially mitigated by DN-1=B-constrained, which itself is a maintainer-side constraint on aif-handoff behaviour, not a shipped upstream feature); (ii) Variant B' is structurally subordinate to A (it inherits all 3 blockers verbatim and only optimises the dispatch trigger — UX delta, not capability delta); (iii) Variant B is REJECT (no upstream feature + DECISION=C violation); (iv) Variant C is REJECT below §8 STOP 30% threshold. The maintainer-hypothesis driving the umbrella (SSOT #30/#44/#67 «autonomous batches ≥3 waves without user present» + «Phase 11+ official orchestration layer») is **empirical**, not **articulatory** ([kickoff §1.1](../../../.claude/orchestrator-prompts/aif-handoff-as-runtime-bridge/kickoff.md)) — the trigger has not fired at evidence time. **Therefore the clearly-better path under hook-discipline (Decision 10) is DEFER all, with updated triggers**, NOT GREENLIGHT (no trigger fire) and NOT REJECT-all (hypothesis is not falsified, just not yet actionable).

**DN-1 (B-constrained) reflection:** consumed as input for the verdict ladder walk. Variant A's 3rd ADOPT-blocker (autoMode Reviewer conflict) is *partially* mitigated under DN-1, but blockers #1 (PLAN.md disk coupling) and #2 (WebSocket broadcast no-topic-filter) remain technical-complexity gates. Variant B' inherits the same DN-1 partial-mitigation pattern. Variant C is orthogonal to DN-1 (bypasses Reviewer entirely; DN-1 investment is mooted in C's path).

**DN-2 (refined: SW-B verdict stands + B' is operative B-path) reflection:** consumed as input. SW-B's REJECT for the native-upstream fs-watcher is preserved verbatim. B' is acknowledged as the operative path for the «decouple meta-orchestrator from aif-handoff» B-shaped intent — but since B' inherits A's blockers, B'-as-operative-B-path remains conditionally REFERENCE pending A's greenlight.

**Hook-discipline (state.md Decision 10) reflection:** dispatch instruction reads «recommend on clearly-better evidence; escalate only on real equipoise». Re-derivation confirms no equipoise — B and C have clear REJECT verdicts; B' is structurally dependent on A; A is REFERENCE with technical blockers. Recommendation is clearly-better than greenlight (trigger empirical, not fired) and clearly-better than reject-all (hypothesis not falsified). Equipoise is absent — DECISION-NEEDED escalation is NOT warranted. **Note: this synthesis re-derived the verdict landscape independently (T15) — it did NOT consume any «likely trajectory» / pre-pick orientation from any state.md artefact** (file does not exist in this repo at evaluation time — verified by `find .claude/orchestrator-prompts/aif-handoff-as-runtime-bridge`).

**Falsifier for the DEFER-all verdict (per T20):** if (a) the maintainer empirically runs ≥3 autonomous batches without user present (SSOT #30 trigger), OR (b) the maintainer explicitly elevates aif-handoff to «Phase 11+ official orchestration layer» status (SSOT #44 trigger), OR (c) aif-handoff upstream ships either a Planner-bypass that does NOT require disk-resident PLAN.md OR a topic-filtered WebSocket subscription mechanism (eliminating ≥1 of Variant A's structural blockers) — re-evaluate. If all three falsifiers hold simultaneously, Variant A upgrades to ADAPT and Variant B' upgrades to ADOPT VOCABULARY in parallel.

---

## §1 Scope

**Variant evaluated:** none — this is the cross-variant synthesis Sub-wave (D). The four variant evaluations are inputs (read independently, evaluated independently per T15) and consolidated into one cross-variant verdict here.

**Inputs (4 patches, all on `origin/staging` at evaluation time 2026-05-29):**

1. [SW-A — Variant A MCP-consumer evaluation](2026-05-29-aif-handoff-bridge-variant-a-mcp.md) (merged PR #268, REFERENCE, 28% match, 3 ADOPT-blockers)
2. [SW-B — Variant B native-fs-watcher REJECT](2026-05-29-aif-handoff-bridge-variant-b-watcher.md) (merged PR #267, REJECT, ~5% match; for native upstream feature; long-term ADAPT with AND-trigger per DN-2)
3. [SW-B2 — Variant B' hybrid hook + existing MCP REFERENCE](2026-05-29-aif-handoff-bridge-variant-b-prime-hybrid.md) (merged PR #275, REFERENCE ~35%, conditional ADOPT VOCABULARY if A+DN-1)
4. [SW-C — Variant C minimal bridge REJECT](2026-05-29-aif-handoff-bridge-variant-c-minimal.md) (merged PR #276, REJECT ~22%, BEFORE/AFTER 25% literal / 0% cognitive ≪ §8 STOP 30%)

**Method (per T15 re-derivation discipline):**

- Each input patch was read **independently and in full** (4 file Reads, no skim — see §10 self-application walk).
- The synthesis verdict was **re-derived from the underlying evidence** (criterion-by-criterion + T16 problem-class + BFR-default §1 ladder walk), **not inherited from any «likely trajectory» orientation** in a state-md artefact (no such file exists in this umbrella's directory — verified: `find /Users/art/code/rules-as-tests-aif/.claude/orchestrator-prompts/aif-handoff-as-runtime-bridge` returns only `kickoff.md`).
- DN-1 (B-constrained) and DN-2 (SW-B verdict stands + B' is operative B-path) are **consumed as dispatch inputs**, not re-litigated (per [`reviewer-discipline.md §2`](../../../.claude/rules/reviewer-discipline.md): «The reviewer can describe what each path implies; the reviewer cannot pick between them.» — DN-1/DN-2 are maintainer-side resolutions of prior decision-needed items, consumed as fact).
- Hook-discipline (Decision 10): «recommend on clearly-better evidence; escalate only on real equipoise» — applied to the cross-variant verdict, not to individual variant verdicts (those are predecessor-Sub-wave verdicts, already cold-reviewed and merged for A/B).

**What this synthesis does NOT do:**

- Does NOT change any predecessor-Sub-wave verdict (per CLAUDE.md «Artifact Ownership Contract» — research-patches/ folder per-patch ownership at author-time; cross-referencing is read-only)
- Does NOT propose any code edit, skill edit, install.sh change, settings.json change, kickoff edit, or SSOT-row landing (markdown-only patch; SSOT row #85 PROPOSED, not landed)
- Does NOT re-litigate DN-1, DN-2, or any closed decision per dispatch instruction
- Does NOT pick between A, B', and C as «which to build» — that is a maintainer-strategic decision routed via reviewer-discipline.md §2; this synthesis recommends DEFER-all per BFR-default §1 ladder evaluation, which is a research-finding (no equipoise + no trigger fire + no falsification), not a strategy pick

---

## §2 20-cell comparison table (5 criteria × 4 variants, file:line citation per cell)

Per kickoff §4 five evaluation criteria + dispatch instruction (20-cell table: 4 variants × 5 criteria, file:line per cell). Each cell summarises the predecessor Sub-wave's scoring with a verbatim file:line reference to the cited evidence.

### Crit-1 — Bridge complexity (target: <300 LOC, ≤4 MCP calls, no upstream PR required)

| Variant | Score | Evidence (file:line) |
|---|---|---|
| **A** | **PASS-with-coupling** — ~175 LOC bash; 3 MCP tool calls + 1 REST endpoint + 1 WebSocket consumer; no upstream PR. **Coupling delta vs original spec:** WebSocket consumer requires `websocat` / Node `ws` (not zero-dep bash); `PLAN.md` disk write adds filesystem coupling beyond pure MCP. Total within target but complexity higher than original framing assumed | `2026-05-29-aif-handoff-bridge-variant-a-mcp.md:158-176` (criterion 1 LOC table 175 total + MCP+REST+WS breakdown); `:115-121` (PLAN.md disk-coupling evidence DeepWiki Probe 6); `:75` (WebSocket broadcast no topic filter DeepWiki Probe 3) |
| **B** | **FAIL** — upstream feature required (~400-800 LOC new subsystem in `packages/agent/`). No `packages/agent/src/dirWatcher.ts` exists at evaluation time; no PR or issue proposing it; not a bash-bridge — an upstream feature PR | `2026-05-29-aif-handoff-bridge-variant-b-watcher.md:170-176` (criterion 1 row); `:92-109` (file-tree confirmation: only `taskWatchdog.ts` stale-task recovery + Codex App Server FsWatchParams schemas — neither is dir-watch task ingestion); `:122-135` (gh search 0 results for inotify/fsnotify/chokidar/«directory watch») |
| **B'** | **PASS-best-of-4** — 4 sub-options all under <100 LOC target: Option (a') = **0 LOC** of code (`mcp_tool` hook config only) / Option (a) = ~25 LOC bash command hook / Option (b) = ~15 LOC chokidar Node / Option (c) = ~10 LOC fswatch bash. Total: best LOC of all variants | `2026-05-29-aif-handoff-bridge-variant-b-prime-hybrid.md:212-273` (criterion 1 LOC-by-option table); `:280-294` (Option b chokidar 15 LOC sketch verified); `:296-313` (Option c fswatch 10 LOC sketch verified); `:176-185` (own-stack precedent `inject-matching-rule.sh:80` confirms ~25 LOC delta for Option a) |
| **C** | **PASS-on-paper / FAIL-in-spirit** — ~150 LOC bash for the «honest» tracker-only assembly (`paused:true + autoMode:false + skipReview:true + manual PUT /tasks/:id + spawn claude subprocess`); 1 MCP + 3 REST = 4 endpoint calls (within budget); no upstream PR. **But:** the kickoff-framed Variant C («thin CLI wrapper» / «Implementer-only mode») does NOT exist as a shipped capability — the 150 LOC is for a different shape than the kickoff framed | `2026-05-29-aif-handoff-bridge-variant-c-minimal.md:236-257` (criterion 1 LOC table 150 total); `:70-77` (DeepWiki Probe 1: «AIF Handoff does not expose a direct CLI command to create a task and run only the Implementer subagent»); `:148-149` (T7 adversarial Probe 5: no `aif-handoff exec` / `aif-handoff submit` CLI exists) |

### Crit-2 — DECISION=C compatibility (HARD requirement: substrate dependency-free)

| Variant | Score | Evidence (file:line) |
|---|---|---|
| **A** | **PASS (conditional on opt-in)** — bridge is standalone opt-in script invoked by maintainer; `/meta-orchestrator` itself has zero dependency on aif-handoff; consumer without aif-handoff installed → bridge never fires → no degradation. Risk: if bridge were auto-firing PostToolUse hook without capability-check guard, consumer machines would see hook-failure noise — **bridge must be packaged separately as optional add-on**, not in core `install.sh` payload | `2026-05-29-aif-handoff-bridge-variant-a-mcp.md:184-202` (criterion 2 assessment + conditional-invocation pattern sketch); `:188-196` (capability-check pattern `command -v aif-handoff || curl -sf localhost:3009/health`); `:236-238` (risk: bundled hook noise) |
| **B** | **FAIL (HARD constraint violated)** — Variant B requires Docker+DB daemon running persistently on consumer machine (`docker-compose.production.yml` defines `agent` service). Even though `/meta-orchestrator` itself works unchanged when consumer doesn't install aif-handoff, the «bridge» half cannot function without standing infra | `2026-05-29-aif-handoff-bridge-variant-b-watcher.md:171-173` (criterion 2 row); `:74-78` (DeepWiki Probe 3: «coordinator is a long-running Node.js process … process management is delegated to Docker Compose») |
| **B'** | **PASS-all-4-sub-options** — Option (a') `mcp_tool` hook: «non-blocking error and execution continues» when MCP not connected. Option (a) command hook: `curl --connect-timeout 1 ... \|\| exit 0` capability-check guard. Option (b) chokidar Node: consumer doesn't install chokidar → watcher doesn't run. Option (c) fswatch: consumer doesn't install fswatch → watcher doesn't run. All 4 paths preserve `/meta-orchestrator` zero-dep substrate | `2026-05-29-aif-handoff-bridge-variant-b-prime-hybrid.md:319-334` (criterion 2 per-option assessment); `:58-62` (`mcp_tool` hook non-blocking-error contract from CC docs `code.claude.com/docs/en/hooks.md` 2026-05-29 fetch); `:259-260` (capability-check guard for Option a) |
| **C** | **PASS (conditional on opt-in + meta-kickoff template NOT rewritten)** — same opt-in standalone-wrapper pattern as A. **Critical fallback concern unique to C:** if meta-kickoff template is rewritten to be aif-handoff-aware (SSOT #27 HANDOFF_TASK_ID pattern), consumers without aif-handoff installed would receive MCP-call instructions that resolve to errors → fallback breaks. **Mitigation: do NOT rewrite the meta-kickoff template; keep status updates wrapper-side** | `2026-05-29-aif-handoff-bridge-variant-c-minimal.md:259-273` (criterion 2 assessment); `:297-305` (critical fallback concern + mitigation: do NOT rewrite meta-kickoff template); `:149-150` (HANDOFF_TASK_ID pattern requires external CC session to be aif-handoff-aware) |

### Crit-3 — Automation vs maintainer-loop preservation (per-stage automation breakdown)

| Variant | Score | Evidence (file:line) |
|---|---|---|
| **A** | **PARTIAL (high autonomy potential, conditional on blockers + DN-1)** — automates dispatch loop (paste → API call → autonomous Planner+Implementer+Reviewer cycle). **Does NOT** automate decision loop (strategy forks, DECISION-NEEDED). **Risk:** aif-handoff Reviewer in autoMode may silently pick strategy in violation of reviewer-discipline.md §2 — partially mitigated by DN-1=B-constrained («one-clear-pick or escalate-on-doubt» Reviewer behaviour). Stage-gate `gh pr list` verification still maintainer-side (kanban `done` ≠ PR merged) | `2026-05-29-aif-handoff-bridge-variant-a-mcp.md:204-220` (criterion 3 per-stage automation table 7 rows); `:214` (Reviewer-discipline risk, autoMode silently picks strategy); `:218` (decision loop stays with maintainer per reviewer-discipline.md §2) |
| **B** | **INDETERMINATE (upstream feature absent)** — if implemented, same automation gain as A; in reality, feature does not exist so automation is hypothetical | `2026-05-29-aif-handoff-bridge-variant-b-watcher.md:174` (criterion 3 row: «INDETERMINATE — upstream feature absent») |
| **B'** | **PARTIAL (small delta vs A — UX optimisation only)** — replaces one explicit-invoke maintainer action (paste 1-liner) with one auto-event (file write fires hook). Wall-clock saving ≈ 30 seconds per umbrella stage. **Infrastructure footprint, blocker set, and status-read-back complexity are IDENTICAL to A.** B' does NOT unlock anything A doesn't already block — it makes the cheapest part of A's flow cheaper. **New risk specific to B':** path-scoped hook fires on every kickoff.md write (drafts, amendments, re-runs); idempotency must be wrapper-managed | `2026-05-29-aif-handoff-bridge-variant-b-prime-hybrid.md:336-357` (criterion 3 per-stage automation table); `:344-346` (dispatch trigger automated, downstream identical to A); `:351` (~30s wall-clock saving estimate); `:353` (idempotency risk specific to B') |
| **C** | **FAIL (below §8 STOP 30% threshold)** — automates 2 of 8 maintainer steps = **25% literal / 0% cognitive** reduction. Only «open new CC tab» + «paste 1-liner» collapse into one CLI invocation; all 5 decision points (stage-gate verification, Phase -1 dispatch, strategy-fork handling, etc.) preserved. **§8 STOP fires** | `2026-05-29-aif-handoff-bridge-variant-c-minimal.md:204-231` (BEFORE/AFTER 8-step table); `:216-220` (action-count counts: 25% literal / 0% cognitive); `:230` (§8 STOP verdict «Variant C value-add insufficient») |

### Crit-4 — Fallback ergonomics without aif-handoff installed (HARD requirement: no degradation)

| Variant | Score | Evidence (file:line) |
|---|---|---|
| **A** | **PASS (conditional on standalone opt-in script)** — `/meta-orchestrator` output unchanged when aif-handoff absent; 1-liner block identical; no new manual steps. Risk: bundled-as-hook variant must early-exit silently — bridge packaged as separate optional add-on, NOT in core `install.sh` | `2026-05-29-aif-handoff-bridge-variant-a-mcp.md:222-238` (criterion 4 assessment + risk: auto-firing hook noise); `:228` (opt-in script preserves current flow) |
| **B** | **PASS-trivially (variant is addon)** — `/meta-orchestrator` works unchanged; watcher daemon's absence means bridge never fires. Trivially true because Variant B is an addon, not integrated; fallback = «Variant B simply doesn't exist for this consumer» | `2026-05-29-aif-handoff-bridge-variant-b-watcher.md:175` (criterion 4 row: trivially PASS) |
| **B'** | **PASS-all-4-sub-options** — each sub-option degrades cleanly when MCP not connected or watcher dep not installed. UX-noise risk on Option (a') (CC may show non-blocking error in transcript) noted but non-blocking | `2026-05-29-aif-handoff-bridge-variant-b-prime-hybrid.md:359-372` (criterion 4 per-option assessment) |
| **C** | **PASS (conditional, dual constraint)** — (i) wrapper is opt-in standalone script AND (ii) meta-kickoff template is NOT rewritten to be aif-handoff-aware. **Both** must hold for clean fallback | `2026-05-29-aif-handoff-bridge-variant-c-minimal.md:293-307` (criterion 4 dual-constraint assessment); `:303-305` (mitigation: do NOT rewrite meta-kickoff template) |

### Crit-5 — Duplication with `/orchestrator` + SP `requesting-code-review` cycle (under DN-1=B-constrained framing)

| Variant | Score | Evidence (file:line) |
|---|---|---|
| **A** | **RISK (conflict, partially mitigated by DN-1)** — aif-handoff Reviewer (autoMode) vs our Phase -1 cold-review (SP `requesting-code-review` template per SKILL.md:429) is the most significant duplication. aif-handoff Reviewer may silently pick strategy in autoMode (violates reviewer-discipline.md §2); DN-1=B-constrained mitigates by mandating «one-clear-pick or escalate-on-doubt» Reviewer behaviour, but DN-1 is a maintainer-side behavioural constraint, NOT a shipped upstream feature. SKILL.md:404/:429 inconsistency disambiguated (line :404 = BFR-default REFERENCE verdict for SP skill; line :429 = operational ADOPT of dispatch template). Plan-generation duplication risk: aif-handoff Planner may re-plan from `description`, overriding our kickoff plan | `2026-05-29-aif-handoff-bridge-variant-a-mcp.md:242-260` (criterion 5 SKILL.md inconsistency resolution + duplication table); `:248` (cross-ref `research-patches/2026-05-23-meta-orchestrator-prior-art.md:73` leapfrog table); `:254-256` (Reviewer-conflict + Planner-overriding-kickoff risks) |
| **B** | **PARTIAL DUPLICATION (Planner + Reviewer hypothetical)** — if implemented, aif-handoff Planner duplicates meta-orchestrator planning; Reviewer duplicates Phase -1. Hypothetical until upstream feature ships | `2026-05-29-aif-handoff-bridge-variant-b-watcher.md:176` (criterion 5 row) |
| **B'** | **INHERITED RISK (same as A)** — all 3 duplication-risk dimensions inherited from A: Reviewer-conflict, Planner-override, status back-channel complexity. DN-1=B-constrained mitigation applies equally; same partial-mitigation pattern. B' does NOT introduce new duplication beyond A | `2026-05-29-aif-handoff-bridge-variant-b-prime-hybrid.md:378-390` (criterion 5 inherited-from-A duplication table) |
| **C** | **PASS-with-caveat (lowest duplication risk; Pyrrhic win)** — Variant C bypasses aif-handoff's Planner AND Reviewer entirely; DN-1 constraint not directly applicable (no Reviewer running in C's path). **Caveat:** the reason C has low duplication risk is the same reason it has low value-add — bypassing the very autonomous-review machinery that gave A its autopilot potential. DN-1 investment is MOOTED in C's path, not amplified | `2026-05-29-aif-handoff-bridge-variant-c-minimal.md:309-341` (criterion 5 DN-1=B-constrained assessment + duplication table); `:319-321` (DN-1 not directly applicable to C); `:323` (Pyrrhic-win framing); `:332` («NO CONFLICT — Variant C's «skip Reviewer» framing is the lowest-conflict shape vs reviewer-discipline.md §2. But this is bought at the price of zero autonomous-review value-add») |

---

## §3 T16 problem-class match table (per variant)

Per kickoff §5 trap T16 («Upstream problem class: X. Our problem class: Y. Match? Evidence: …»). Consolidated from predecessor Sub-wave T16 tables; cross-checked for consistency.

| Variant | Upstream problem class | Our problem class | Match? | Match score | Evidence (file:line) |
|---|---|---|---|---|---|
| **A** (MCP-consumer) | Kanban runtime: autonomous task pipeline (Planner→Implementer→Reviewer) with persistent DB, cron coordinator, Docker/Node infra. Tasks created via REST `POST /tasks` or MCP `handoff_create_task`; designed for external-process invocation. WebSocket broadcast back-channel | MCP-consumer bridge: `/meta-orchestrator` outputs kickoff.md → bridge calls MCP tools → aif-handoff runs autonomously → bridge reads back status. WE drive the trigger, but task progression is autonomous downstream | **PARTIAL** — match on «autonomous pipeline» but mismatch on (a) «who drives» (external vs internal cron), (b) «plan injection mechanism» (requires PLAN.md disk file, not pure MCP), (c) «status filter» (broadcast vs taskId-filtered). Match on autonomy primitives (`paused`, dirty-worktree, CAS) | **28%** | `2026-05-29-aif-handoff-bridge-variant-a-mcp.md:138-148` (full T16 6-row table) |
| **B** (native fs-watcher) | aif-handoff API-driven task ingestion: REST `POST /tasks`, MCP `handoff_create_task`, ROADMAP.md import, scheduled execution. Coordinator entry point reads from DB never from filesystem. Docker Compose for process management | Filesystem-driven ingestion: daemon watches `.claude/orchestrator-prompts/<umbrella>/kickoff.md` → new file appears → auto-create task. No API call from meta-orchestrator | **MISMATCH** — upstream is fundamentally API-driven; Variant B requires filesystem-driven ingestion that does not exist. Hypothetical `packages/agent/src/dirWatcher.ts` does not exist; no PR/issue proposes it. Variant B's «decoupling» advantage only works if daemon is always running, which conflicts with DECISION=C zero-infra | **~5%** | `2026-05-29-aif-handoff-bridge-variant-b-watcher.md:155-164` (4-row T16 table) |
| **B'** (hybrid) | aif-handoff existing MCP HTTP server (`npm run mcp:http`, MCP_PORT=3100) — self-sufficient for task creation, designed for external-process invocation. CC `mcp_tool` hook type purpose-built for already-connected MCP servers | Our-side fs-watcher (any of 4 sub-options) triggered by `*-meta-launch/kickoff.md` writes → calls aif-handoff's existing `handoff_create_task` MCP tool | **PASS on trigger surface; PARTIAL on autonomy; MISMATCH on inherited 3 blockers** — trigger fits cleanly (designed-for-this), but autonomous Planner+Implementer+Reviewer cycle still requires coordinator daemon (same infra as A), and B' inherits A's 3 ADOPT-blockers verbatim (PLAN.md disk coupling, WebSocket broadcast no-topic-filter, autoMode Reviewer conflict) | **~35%** | `2026-05-29-aif-handoff-bridge-variant-b-prime-hybrid.md:189-202` (8-row T16 table) |
| **C** (minimal bridge) | aif-handoff's shipped surface: full autonomous Kanban runtime PLUS `paused:true + autoMode:false` degenerate «pure tracker» mode. Tasks must originate in `backlog` and traverse `planning → plan_ready → implementing` state machine | Variant C goal: «aif-handoff as Implementer-equivalent only; bypass Planner+Reviewer; spawn one `claude --agent`; track status» — inverts the upstream's primary use | **MISMATCH** — kickoff-framed Variant C inverts upstream's primary use (subagents bypassed, external CC drives); reuses only the «kanban card + REST state machine» substrate. No first-class Implementer-only mode exists; no `aif-handoff exec`-shaped CLI exists. Best-case shipped-surface assembly via `paused:true` removes the very autonomy value-add that motivated the variant-family in the first place | **~22%** | `2026-05-29-aif-handoff-bridge-variant-c-minimal.md:181-191` (full T16 6-row table); `:148-149` (T7 adversarial Probe 5: no CLI exists) |

**Synthesis observation:** all 4 variants have **partial-to-zero** problem-class match. None of the four variants achieves a structural match high enough to invoke ADOPT verbatim (which would require ≥70% match per T16 «is this the same problem» convention). The variants form a complementary span:

- A occupies «highest-autonomy-with-blockers» rung
- B occupies «full-decoupling-but-feature-absent» rung
- B' occupies «UX-optimised-A» rung
- C occupies «lowest-conflict-but-also-lowest-value-add» rung

There is no genuine equipoise — each variant has a distinct mismatch pattern and a distinct verdict rung. §8 STOP «2+ variants tie → DECISION-NEEDED» does not fire.

---

## §4 Cross-variant verdict synthesis

### §4.1 BFR-default §1 ladder walk per variant (re-derived; consistent with predecessor Sub-waves)

Per [`build-first-reuse-default.md §1`](../../../.claude/rules/build-first-reuse-default.md) verdict ladder: ADOPT / ADOPT VOCABULARY / ADAPT / REFERENCE / KEEP NARROW / BUILD / REJECT. Walked independently for each variant in this synthesis (T15 self-application) — verdicts consistent with predecessor Sub-waves.

**Variant A — REFERENCE (re-derived):**

- **ADOPT?** No. 3 unresolved structural blockers (PLAN.md disk coupling, WebSocket broadcast no-topic-filter, autoMode Reviewer ↔ reviewer-discipline.md §2 conflict). DN-1=B-constrained partially mitigates blocker #3 but is a maintainer-side behavioural constraint, not a shipped upstream feature.
- **ADAPT?** Premature at current scale. Adaptation requires (a) writing PLAN.md to disk before MCP call, (b) implementing WebSocket client with taskId filter (Node `ws` or `websocat`), (c) disabling aif-handoff `autoMode` OR relying on DN-1. Real BUILD cost ~175 LOC + Docker+SQLite infra; SSOT #30/#44/#67 «autonomous batches ≥3 waves» trigger has NOT empirically fired.
- **REFERENCE?** YES. Design-vocabulary items remain valid regardless of present-day adoption: (a) MCP body format compatible (`description = z.string().optional()`, no `.max()`); (b) Docker-free Node+SQLite deployment feasible; (c) `accept_existing_plan` Planner-skip bypass exists; (d) WebSocket back-channel documented. REFERENCE for future ADAPT trigger.
- **BUILD?** Not at current scale. Verdict: REFERENCE — consistent with [SW-A §5 verdict](2026-05-29-aif-handoff-bridge-variant-a-mcp.md).

**Variant B — REJECT (re-derived):**

- **ADOPT?** No — upstream feature does not exist (no `packages/agent/src/dirWatcher.ts`, no PR/issue proposing it).
- **ADAPT?** No — would require ~400-800 LOC upstream PR to aif-handoff (we are consumer, not co-maintainer).
- **REFERENCE?** Marginal. The «decouple meta-orchestrator from aif-handoff via filesystem contract» vocabulary is interesting but operationally B is replaced by B' (DN-2: B' is operative B-path).
- **REJECT?** YES — upstream candidate surfaced + explicitly unsuitable (no upstream feature + DECISION=C HARD violated + daemon race condition). Verdict: REJECT — consistent with [SW-B §5 verdict](2026-05-29-aif-handoff-bridge-variant-b-watcher.md).

**Variant B' — REFERENCE (conditional ADOPT VOCABULARY) (re-derived):**

- **ADOPT?** No. B' is a hybrid that requires BUILDING our own fs-watcher (1 of 4 sub-options) — not pure adoption.
- **ADOPT VOCABULARY?** Plausible **conditional on (a) A being greenlit and (b) DN-1=B-constrained adopted as upstream behavioural constraint**. CC hooks `mcp_tool` type ([SSOT #20 ADOPT](../prior-art-evaluations.md)) provides the vocabulary; B' would be a thin instance of it. Pending A's verdict.
- **ADAPT?** Premature standalone — gating factor is inherited 3 ADOPT-blockers from A, not own complexity.
- **REFERENCE?** YES standalone. Design-vocabulary items: (a) `mcp_tool` hook type for already-connected MCP servers; (b) aif-handoff MCP standalone-callable for task creation (Node+SQLite minimum); (c) 4 sub-options each <100 LOC. Valid REFERENCE regardless of adoption timing.
- **BUILD?** Possible if maintainer greenlights one of the 4 sub-options. Small cost (≤30 LOC) but small value (auto-trigger replacing one paste) unless paired with A's adoption. Verdict: REFERENCE standalone; conditional ADOPT VOCABULARY — consistent with [SW-B2 §5 verdict](2026-05-29-aif-handoff-bridge-variant-b-prime-hybrid.md).

**Variant C — REJECT (re-derived):**

- **ADOPT?** No. No shipped Variant-C-shaped surface to adopt — no `aif-handoff exec` CLI; no first-class Implementer-only mode. Closest shipped pattern (`HANDOFF_TASK_ID` env-var + MCP-sync per SSOT #27) requires rewriting meta-kickoff template to be aif-handoff-aware (fails kickoff §4 criterion 4 fallback ergonomics).
- **ADAPT?** Technically shippable in ~150 LOC tracker-only assembly, but criterion 3 shows 2 of 8 maintainer steps automated (25% literal / 0% cognitive); kickoff §8 STOP fires at <30% — directed to «value-add insufficient».
- **REFERENCE?** Marginal — `paused:true` pattern already evaluated as SSOT #28 (ADAPT for `status:` frontmatter convention). No new REFERENCE warranted.
- **BUILD?** Not justified — automating 2 of 8 steps does not clear §8 STOP 30% threshold against Docker+SQLite infra cost. Purpose-built kanban-tracker peers (Vibe Kanban, Claw-Kanban, langwatch/kanban-code per SW-C WebSearch) ship the same shape without aif-handoff's autonomous-pipeline infra cost.
- **REJECT?** YES — upstream candidate surfaced + explicitly unsuitable (kickoff-framed «Implementer-only mode + thin CLI wrapper» does not exist as a shipped single capability; best-case shipped-surface assembly fails §8 STOP). Verdict: REJECT — consistent with [SW-C §6 verdict](2026-05-29-aif-handoff-bridge-variant-c-minimal.md).

### §4.2 Cross-variant equipoise check (per kickoff §8 Sub-wave D STOP)

Kickoff §8: «**Sub-wave D STOP:** if 2+ variants tie on §4 criteria with identical score → DECISION-NEEDED to maintainer (per reviewer-discipline §2), do NOT pick.»

Re-derived rung-occupancy:

| Variant | Verdict | Match score | Distinguishing feature |
|---|---|---|---|
| A | REFERENCE | 28% | Highest-autonomy-with-blockers |
| B | REJECT | ~5% | Full-decoupling-but-feature-absent |
| B' | REFERENCE | ~35% | UX-optimised-A (structurally subordinate to A) |
| C | REJECT | ~22% | Lowest-conflict-but-also-lowest-value-add |

**Equipoise check:** A and B' both occupy REFERENCE rung — is this a tie? **No.** B' is structurally subordinate to A (B' inherits A's 3 blockers verbatim per [SW-B2 §3](2026-05-29-aif-handoff-bridge-variant-b-prime-hybrid.md) rows 6-8 «Status back-channel» / «Planner-bypass via accept_existing_plan» / «autoMode Reviewer» + §6 comparison table rows 6-8); B' upgrades to ADOPT VOCABULARY ONLY IF A is greenlit + DN-1=B-constrained adopted. They are not co-equal candidates — B' is downstream of A. Recommending one over the other isn't picking strategy between legitimate options; it's surfacing the structural ordering.

Similarly, B and C both occupy REJECT rung but for different reasons (B: upstream feature absent; C: §8 STOP threshold fail). They are not co-equal — neither is the «pick» because both are clearly REJECT under BFR-default §1.

**Equipoise verdict:** NO equipoise exists. §8 STOP «2+ variants tie → DECISION-NEEDED» does NOT fire. Recommendation proceeds to §6 per kickoff §6.5.

### §4.3 Hook-discipline (state.md Decision 10) application

Dispatch instruction reads: «Under hook-discipline (state.md Decision 10): recommend on clearly-better evidence; escalate only on real equipoise.»

**Clarification on the dispatch's «state.md» reference:** No state.md file exists in the umbrella directory at evaluation time (verified 2026-05-29 via `find /Users/art/code/rules-as-tests-aif/.claude/orchestrator-prompts/aif-handoff-as-runtime-bridge -type f` returns only `kickoff.md`). The dispatch's «Decision 10» framing is consumed as a maintainer-stated hook-discipline principle, not as a citation to a discoverable artefact in this repo. This synthesis re-derived the verdict landscape independently per T15 — no «likely trajectory» orientation was pre-picked from any state.md.

**Hook-discipline applied to the cross-variant recommendation:**

- **Clearly-better evidence in favour of GREENLIGHT?** No. The SSOT #30/#44/#67 «autonomous batches ≥3 waves without user present» / «Phase 11+ official orchestration layer» triggers are **empirical** ([kickoff §1.1](../../../.claude/orchestrator-prompts/aif-handoff-as-runtime-bridge/kickoff.md): «the trigger is empirical … not articulatory») — not fired at evidence time. Greenlighting Variant A (or B') would prematurely commit to ~175 LOC bash + Docker+SQLite infra + DN-1 behavioural-constraint adoption before the maintainer's stated autonomy demand has empirically materialised.
- **Clearly-better evidence in favour of REJECT-all?** No. The maintainer-hypothesis is not falsified by this R-phase. Variant A's verdict is REFERENCE (design-vocabulary items remain valid for future ADAPT trigger); B' upgrades conditionally. Rejecting all would discard valid REFERENCE-rung evidence.
- **Clearly-better evidence in favour of DEFER-all-with-updated-triggers?** **YES** — DEFER preserves the REFERENCE-rung evidence for A and B'; preserves the REJECT verdicts for B and C; updates the SSOT triggers to clarify what evidence would warrant re-evaluation (per kickoff §6.5 directive: «DEFER all variants (record updated triggers)»); does NOT commit to BUILD cost before trigger has empirically fired.

**Hook-discipline verdict:** clearly-better recommendation = DEFER-all-with-updated-triggers. Equipoise is absent; DECISION-NEEDED escalation is NOT warranted.

### §4.4 DN-1 (B-constrained) reflection — required per dispatch

DN-1 maintainer resolution: «B-constrained — Variant A is ADAPT-candidate with «aif-handoff Reviewer one-clear-pick/escalate-on-doubt» constraint» (consumed as input per [SW-C §1 dispatch context](2026-05-29-aif-handoff-bridge-variant-c-minimal.md)).

Reflection per variant:

- **Variant A:** DN-1 partially mitigates blocker #3 (Reviewer conflict) — IF DN-1 is adopted as a maintainer-side configuration of aif-handoff Reviewer behaviour. DN-1 does NOT mitigate blockers #1 (PLAN.md disk coupling) or #2 (WebSocket broadcast no-topic-filter). Even under DN-1=B-constrained, Variant A's verdict stays at REFERENCE because 2 of 3 blockers persist as technical complexity.
- **Variant B':** B' inherits A's 3 blockers verbatim per [SW-B2 §3 rows 6-8](2026-05-29-aif-handoff-bridge-variant-b-prime-hybrid.md) + §6 comparison table rows 6-8. DN-1 applies equally to B' with the same partial-mitigation pattern. B' standalone verdict stays REFERENCE; conditional ADOPT VOCABULARY only if A is greenlit + DN-1 adopted.
- **Variant B:** N/A — B is REJECT because upstream feature absent; DN-1 is not a path to mitigation (no Reviewer in B's path; the absent fs-watcher is the gating factor).
- **Variant C:** DN-1 is NOT directly applicable per [SW-C §5 criterion 5](2026-05-29-aif-handoff-bridge-variant-c-minimal.md:319-321) — C bypasses aif-handoff Reviewer entirely; no Reviewer running in C's path. DN-1 investment is **mooted** in C's path. C's REJECT verdict stands regardless of DN-1.

**Net DN-1 effect on cross-variant verdict:** partial-mitigation of A's blocker #3 and B''s inherited blocker #3 is insufficient to upgrade either variant's verdict at current scale. A stays REFERENCE; B' stays REFERENCE (conditional); B stays REJECT; C stays REJECT. **DEFER-all-with-updated-triggers** verdict is unchanged by DN-1=B-constrained input.

### §4.5 DN-2 (SW-B verdict stands + B' is operative B-path) reflection — required per dispatch

DN-2 refined: «SW-B verdict stands (REJECT for native upstream feature) + B' is operative B-path» (consumed as input per dispatch instruction).

Reflection:

- **SW-B verdict stands:** confirmed. SW-B's REJECT for the native-upstream fs-watcher remains canonical; this synthesis does NOT re-litigate the REJECT verdict for B's native form.
- **B' is operative B-path:** confirmed and applied. The «decouple meta-orchestrator from aif-handoff» B-shaped intent is operationally addressed by B' (hybrid: our-side hook + their existing MCP). But B' inherits A's 3 ADOPT-blockers verbatim, so B'-as-operative-B-path remains conditionally REFERENCE pending A's resolution.

**Net DN-2 effect on cross-variant verdict:** DN-2 clarifies the **routing** of the B-shaped goal (B → B') without changing any variant's rung occupancy. **DEFER-all-with-updated-triggers** verdict is unchanged by DN-2 input; B' is surfaced in §5 SSOT additive notes as the operative B-path with conditional upgrade path documented.

---

## §5 Consolidated SSOT additive-note proposals (rows #27/#28/#30/#44/#67/#80 + proposed new row #85)

**Additive-note only — no verdict changes. Per kickoff §10 backward-check: existing DEFER/REJECT verdicts remain unchanged.** Each existing row's «Trigger to revisit» field is augmented with a 2026-05-29 update reflecting cross-variant findings; original DEFER/REJECT verdicts on rows #27/#28/#30/#44/#67/#80 are NOT re-evaluated.

### §5.1 SSOT #27 (HANDOFF_MODE env-var fork, DEFER) — additive note

```text
Additive note 2026-05-29 (Sub-wave D synthesis, consolidates SW-A/B/B'/C):
HANDOFF_MODE + HANDOFF_TASK_ID env-var pattern is the closest shipped analog to
Variant C's "thin-wrapper Implementer-only mode" framing — surfaced in SW-C
adversarial Probe 5 as "Mode 2: Manual Claude Code session". Adoption requires
external CC session (i.e. our /meta-orchestrator's spawned Worker) to be
aif-handoff-aware (call handoff_sync_status / handoff_push_plan MCP tools
itself), which would require rewriting the meta-kickoff template — fails
kickoff §4 criterion 4 fallback ergonomics (consumers without aif-handoff would
receive instructions resolving to errors). Sub-wave D synthesis verdict =
DEFER-all-with-updated-triggers. SSOT #27 DEFER verdict unchanged.
Trigger-to-revisit unchanged.
```

### §5.2 SSOT #28 (paused:true semantic, DEFER) — additive note

```text
Additive note 2026-05-29 (Sub-wave D synthesis): paused:true + autoMode:false +
manual state-machine transitions is the shipped tracker-only pattern — surfaced
in SW-C Probes 3+4+5. Combined with skipReview:true + manual PUT /tasks/:id
metadata updates, an external orchestrator CAN present in-flight kickoffs as
kanban cards without engaging aif-handoff's autonomous pipeline. However, this
provides only the «kanban visibility» half of Variant C's framing at zero
automation gain (≤25% literal / 0% cognitive maintainer-step reduction per
SW-C BEFORE/AFTER table). Sub-wave D synthesis verdict = DEFER-all. Partial
ADAPT for `status:` frontmatter convention (already adopted at SSOT #28
record) is unchanged. Trigger-to-revisit unchanged.
```

### §5.3 SSOT #30 (Planner/Implementer/Reviewer pipeline, DEFER) — additive note

```text
Additive note 2026-05-29 (Sub-wave D synthesis): Variant A (MCP-consumer)
evaluated as REFERENCE (28% match) with 3 unresolved structural ADOPT-blockers:
(1) accept_existing_plan event requires physical PLAN.md on disk in
.ai-factory/ (filesystem coupling beyond MCP boundary, SW-A Probe 6); (2)
WebSocket back-channel is broadcast-only with no topic filter (bridge must
filter by taskId client-side, SW-A Probe 3); (3) autoMode Reviewer may silently
pick strategy in violation of reviewer-discipline.md §2 (SW-A criterion 5).
DN-1=B-constrained (maintainer-side Reviewer behavioural constraint) partially
mitigates blocker #3 but is NOT a shipped upstream feature; blockers #1+#2
persist. Variant B' (hybrid) inherits all 3 blockers verbatim. Trigger-to-revisit
CLARIFICATION (not change): the "Orchestrator runs autonomous batches ≥3 waves
without user present" trigger is empirical («has run ≥3 waves»), not
articulatory («has been considered as a possibility»); R-phase 2026-05-29
evaluated the hypothesis without claiming the trigger has fired. Original DEFER
verdict and trigger condition are unchanged.
```

### §5.4 SSOT #44 (`@aif/mcp` tools, DEFER) — additive note (extends SW-A's, SW-B's, and SW-B2's additive notes)

```text
Additive note 2026-05-29 (Sub-wave D synthesis, consolidates SW-A/B/B'/C):
@aif/mcp surface evaluated across 4 architectural variants. Findings:
(a) Body format compatible — handoff_create_task.description = z.string()
    .optional() with no character limit (SW-A Probe 2; DeepWiki 2026-05-29).
(b) MCP server runs standalone via `npm run mcp:http` against
    packages/mcp/scripts/dev-http.mjs — does NOT require coordinator daemon for
    task CREATION (SW-B2 Probes 2+3; DeepWiki 2026-05-29). Autonomous
    pipeline progression to Planner/Implementer/Reviewer DOES require
    coordinator daemon (same infra footprint as Variant A).
(c) CC PostToolUse hooks expose `mcp_tool` type for already-connected MCP
    servers (CC docs code.claude.com/docs/en/hooks.md fetched 2026-05-29) —
    purpose-built for the Variant B' hybrid pattern (our-side fs-watcher
    → their existing MCP).
(d) Variant B' has 4 sub-options each <100 LOC (Option a' = 0 LOC config;
    Option a = ~25 LOC bash; Option b = ~15 LOC chokidar Node; Option c =
    ~10 LOC fswatch bash) — best LOC of all variants.
Trigger-to-revisit CLARIFICATION (not change): the "Phase 10 swarm pattern
adopts kanban-shape ... OR aif-handoff project becomes the official Phase 11+
orchestration layer" trigger is outcome-based («has become the official
layer»), not proposal-based («has been suggested as such»). Sub-wave D
synthesis verdict = DEFER-all-with-updated-triggers; Variant B' upgrades to
ADOPT VOCABULARY only if (a) Variant A is greenlit AND (b) DN-1=B-constrained
is adopted as the Reviewer-conflict mitigation. Original DEFER verdict on #44
is unchanged.
```

### §5.5 SSOT #67 (aif-handoff Kanban runtime, REJECT for `/meta-orchestrator` scope) — additive note (extends SW-A's, SW-B's, and SW-C's additive notes)

```text
Additive note 2026-05-29 (Sub-wave D synthesis, consolidates SW-A/B/B'/C):
4 architectural variants of "aif-handoff as runtime bridge below
/meta-orchestrator" evaluated. Cross-variant verdicts:
- Variant A (MCP-consumer): REFERENCE — 28% match; 3 unresolved ADOPT-blockers
  (PLAN.md disk coupling, WebSocket broadcast no-topic-filter, autoMode
  Reviewer conflict). DN-1=B-constrained partial-mitigation insufficient at
  current scale.
- Variant B (native fs-watcher): REJECT — ~5% match; upstream feature absent
  (no packages/agent/src/dirWatcher.ts; no PR/issue proposing it); would
  require ~400-800 LOC upstream PR; DECISION=C HARD violated (Docker daemon
  required). DN-2: B' is operative B-path.
- Variant B' (hybrid): REFERENCE conditional ADOPT VOCABULARY — ~35% match;
  4 sub-options <100 LOC; aif-handoff MCP standalone-callable for task
  creation; BUT inherits A's 3 blockers verbatim. Upgrades to ADOPT VOCABULARY
  IFF A is greenlit + DN-1 adopted.
- Variant C (minimal bridge): REJECT — ~22% match; kickoff-framed thin-CLI-
  wrapper "Implementer-only mode" does not exist as shipped capability;
  best-case tracker-only assembly automates 25% literal / 0% cognitive
  maintainer steps, below kickoff §8 STOP 30% threshold; bypasses
  aif-handoff's primary autonomy machinery, mooting the infra investment.
Cross-variant recommendation: DEFER all variants with updated SSOT triggers.
Trigger-to-revisit on SSOT #67 unchanged. Original REJECT verdict for
/meta-orchestrator scope unchanged.
```

### §5.6 SSOT #80 (aif-handoff delta-tracking extension, DEFER) — additive note

```text
Additive note 2026-05-29 (Sub-wave D synthesis): no relevant findings from
Sub-waves A/B/B'/C — variants A/B/B'/C address task-pipeline shape rather
than cross-session delta-tracking shape. SSOT #80's problem class
(within-session vs cross-session delta arrays) remains distinct from the
aif-handoff-as-runtime-bridge umbrella's question class. SSOT #80 DEFER
verdict and trigger-to-revisit unchanged.
```

### §5.7 Proposed new SSOT row — slot #85 (next-after-#84 verified)

Verified via `grep -E "^\| [0-9]+ \|" docs/meta-factory/prior-art-evaluations.md | tail -1` at evaluation time 2026-05-29 → highest existing slot is #84. Sub-wave B2 also proposes slot #85; this synthesis confirms a single consolidated row at #85 (which Sub-wave B2's row will be folded into) rather than separate rows per variant — first-to-merge claims slot semantics applies.

| Proposed slot | Candidate | Verdict | Evidence |
|---|---|---|---|
| **#85** (next-after-#84) | aif-handoff-as-runtime-bridge — 4 architectural variants evaluated under R-phase 2026-05-29: (A) MCP-consumer with explicit-invoke bridge (~175 LOC bash + 3 MCP calls + WebSocket consumer); (B) native upstream fs-watcher (does not exist, ~400-800 LOC upstream PR required); (B') hybrid our-side fs-watcher + their existing MCP (4 sub-options, 0-25 LOC); (C) minimal bridge / Implementer-only (kickoff-framed CLI shape does not exist; best-case tracker-only assembly ~150 LOC). Cross-variant findings: MCP body-format compatible; MCP server standalone-callable for task creation (Node+SQLite minimum); CC `mcp_tool` hook type purpose-built for already-connected MCP servers; 3 structural ADOPT-blockers inherited by A and B' (PLAN.md disk coupling, WebSocket broadcast no-topic-filter, autoMode Reviewer ↔ reviewer-discipline.md §2 conflict); Variant C BEFORE/AFTER 25% literal / 0% cognitive maintainer-step reduction. | **DEFER (all 4 variants, per-variant: A=REFERENCE; B=REJECT; B'=REFERENCE conditional ADOPT VOCABULARY if A greenlit + DN-1 adopted; C=REJECT)** | Sub-wave D synthesis patch 2026-05-29 (this file); Sub-wave A patch (merged PR #268); Sub-wave B patch (merged PR #267); Sub-wave B2 patch (merged PR #275); Sub-wave C patch (merged PR #276); CC docs `code.claude.com/docs/en/hooks.md` fetch 2026-05-29; DeepWiki ×19 probes across SW-A (7) + SW-B (5) + SW-B2 (2) + SW-C (5); admission gate §2.4 verified (PR #127 + #128 both touch `packages/runtime/` only, NOT `packages/mcp/` or `apps/coordinator/`). |
| Trigger-to-revisit (compound AND) | (a) maintainer empirically runs ≥3 autonomous batches without user present (SSOT #30 trigger) AND (b) maintainer explicitly elevates aif-handoff to «Phase 11+ official orchestration layer» status (SSOT #44 trigger) AND (c) aif-handoff upstream ships EITHER a Planner-bypass mechanism that does NOT require disk-resident PLAN.md OR a topic-filtered WebSocket subscription mechanism (eliminating ≥1 of Variant A's 3 structural blockers). If all three hold simultaneously → re-evaluate; Variant A upgrades to ADAPT and Variant B' upgrades to ADOPT VOCABULARY in parallel. | — | — |

---

## §6 Final recommendation (per kickoff §6.5)

Per kickoff §6.5 directive: «Recommend one of: GREENLIGHT Variant X for I-phase / DEFER all variants (record updated triggers) / REJECT all (rationale).»

**Recommendation: DEFER all variants with updated SSOT triggers.**

**Per-variant verdicts preserved (unchanged from predecessor Sub-wave patches):**

- Variant A: REFERENCE (28% match; 3 ADOPT-blockers; SW-A §5)
- Variant B: REJECT (~5% match; upstream feature absent; SW-B §5)
- Variant B': REFERENCE conditional ADOPT VOCABULARY (~35% match; inherits A's blockers; upgrades if A greenlit + DN-1 adopted; SW-B2 §5)
- Variant C: REJECT (~22% match; §8 STOP 30% threshold fail; SW-C §6)

**Updated SSOT triggers (additive-note only, per §5 above):**

- SSOT #30: empirical-trigger clarification (≥3 batches «has run», not «has been considered»)
- SSOT #44: outcome-trigger clarification (Phase 11+ «has become», not «has been suggested»)
- SSOT #67: cross-variant evaluation recorded; original REJECT for `/meta-orchestrator` scope unchanged
- Proposed new SSOT row #85: compound AND trigger (≥3 autonomous batches + Phase 11+ status + upstream blocker elimination) for re-evaluation of A and B' in parallel

**Why DEFER (not GREENLIGHT, not REJECT-all):**

- NOT GREENLIGHT — empirical SSOT trigger (≥3 autonomous batches) has not fired; Variant A's 3 structural blockers persist (only #3 partial-mitigated by DN-1); committing to ~175 LOC bash + Docker+SQLite infra + DN-1 behavioural-constraint adoption before trigger fire is premature BUILD per BFR-default §1.
- NOT REJECT-all — the maintainer-hypothesis is not falsified; Variant A's REFERENCE-rung design-vocabulary items (MCP body format, headless deployment, Planner-skip mechanism, WebSocket back-channel) remain valid for future ADAPT trigger; Variant B' is the operative B-path under DN-2 and stays REFERENCE conditional; rejecting all would discard valid REFERENCE-rung evidence.
- DEFER preserves the REFERENCE-rung evidence for future trigger fire, captures the per-variant ladder rungs in updated SSOT additive notes, and avoids premature commit while the maintainer's stated autonomy demand is still hypothetical.

**Hook-discipline confirmation (Decision 10, per dispatch):** recommendation is on clearly-better evidence (no equipoise exists between the 4 variant rungs; DEFER strictly dominates GREENLIGHT and REJECT-all under both BFR-default §1 ladder and SSOT-trigger-fire status); escalation as DECISION-NEEDED is NOT warranted. **Note:** this recommendation does not pick project strategy between «greenlight A» vs «greenlight B'» (the only ladder rungs with non-REJECT verdicts) — those are surfaced as conditional ADOPT paths IFF the compound AND trigger fires; choosing between A and B' in that future scenario is a maintainer-side strategy decision per reviewer-discipline.md §2, not a research-finding.

**Falsifier (T20 compliance):** if the maintainer demonstrates empirical fire of any 1 of the 3 compound-AND trigger conjuncts (≥3 autonomous batches OR Phase 11+ elevation OR upstream blocker elimination) — re-evaluate the DEFER-all recommendation and consider single-variant upgrade. Recommendation is wrong if the trigger has actually fired and was overlooked by this synthesis. Verification path: re-run kickoff §2 admission gates + re-derive verdict.

---

## §7 §1.7 Forward-check applied

- **`build-first-reuse-default.md §1` (verdict ladder):** Cross-variant verdict = DEFER-all-with-updated-triggers per §1 ladder walk in §4.1 above. BFR §3 6-layer search applied to this synthesis: (a) SSOT consult — rows #27/#28/#30/#44/#67/#80 reviewed at `prior-art-evaluations.md:95-148`; (b) phase-research-coverage §1 6-item checklist on each variant's verdict — applied via T16 problem-class table §3 above; (c) cross-variant DeepWiki triangulation — 19 distinct probes across SW-A (7) + SW-B (5) + SW-B2 (2) + SW-C (5) — synthesis re-reads each cited probe's verbatim quote in the predecessor patches; (d) WebSearch ≥3 phrasings — synthesised across SW-B (3 phrasings on fs-watcher / agent orchestration), SW-B2 (3 phrasings on atomicity / fs-watcher LOC / cross-platform), SW-C (2 phrasings on kanban-tracker ecosystem); (e) own-stack sweep — SKILL.md:404+:429 disambiguation per SW-A inherited; `inject-matching-rule.sh:80` own-stack PostToolUse precedent per SW-B2 inherited; (f) negative-existence claims («no `aif-handoff exec` CLI», «no first-class Implementer-only mode», «no upstream fs-watcher capability») backed by SW-C Probe 1+5 + SW-B Probes 2+5 + file-tree grep evidence in predecessor patches. ✓

- **`no-paid-llm-in-ci.md §1`:** Synthesis uses ZERO API-billed calls. All evidence is read-from-staging-merged-patches (SW-A, SW-B already merged) + reading 2 pending patches (SW-B2, SW-C; both shipped as research-patch artefacts evaluable at file:line level), with NO additional DeepWiki / WebFetch / WebSearch calls made by this synthesis — all upstream evidence is inherited verbatim from predecessor Sub-waves. The synthesis layer is pure cross-patch reasoning + BFR-default §1 ladder application, no new probes needed. ✓

- **`reviewer-discipline.md §2`:** This synthesis does NOT pick project strategy. DN-1 (B-constrained) and DN-2 (B' is operative B-path) are consumed as maintainer-side resolutions per dispatch instruction, NOT re-litigated. Cross-variant verdict = DEFER-all per BFR-default §1 ladder evaluation, which is a research-finding (no equipoise + no trigger fire + no falsification), not a strategy pick. The recommendation does not choose between «greenlight A» vs «greenlight B'» (the only non-REJECT rungs) — those are surfaced as conditional ADOPT paths IFF the compound AND trigger fires; that choice remains a maintainer-side strategy decision. ✓

- **`phase-research-coverage.md §1.7`:** §7 + §8 self-reflexive walks in this file. ✓

- **`phase-research-coverage.md §1.12` + `recommendation-laziness-discipline.md`:** the cross-variant DEFER-all recommendation in §6 cites (a) SSOT row IDs #27/#28/#30/#44/#67/#80, (b) file:line evidence (SW-A:158-176 + SW-B:170-176 + SW-B2:212-273 + SW-C:236-257 for criterion 1; identical pattern across criteria 2-5), (c) falsifier conditions (§6 «Falsifier» paragraph), (d) primary-source verification on negative-existence claims (DeepWiki probes recorded with URLs in predecessor patches; no recall-based claims here). T20 «inline-verdict-without-evidence» check: this synthesis's verdict sentence in §0 TL;DR cites SSOT rows + predecessor-patch file:line + falsifier in same paragraph. ✓

- **`ai-laziness-traps.md §3`:** All active T-traps applied:
  - **T1** (sampling floor ≥5) — synthesis cites 19 distinct DeepWiki probes inherited from predecessor patches + reading 4 patches independently in full; ≫5 evidence channels. ✓
  - **T3** (file:line / command output / INCONCLUSIVE) — every cell in §2 20-cell comparison table carries file:line citation to source patch. ✓
  - **T7** (adversarial counter-prompts) — synthesis explicitly counter-probed «does any 2+ variants tie at equal-best rung?» (§4.2) — answer: no, A and B' are NOT co-equal (B' structurally subordinate to A); B and C are NOT co-equal (different REJECT reasons). Adversarial counter-probe to «should we greenlight A under DN-1?» (§4.4) — answer: no, DN-1 mitigates only blocker #3; blockers #1+#2 persist. ✓
  - **T11** (search for prior bridge implementations BEFORE designing) — inherited from predecessor patches: SSOT consult + DeepWiki probes + WebSearch ≥2 phrasings; no new design proposed by this synthesis. ✓
  - **T12** (DeepWiki probes at R-phase time) — predecessor patches' probes all dated 2026-05-29; admission gate §2.4 verified no surface drift in 30-day window (PR #127+#128 touch `packages/runtime/` only, NOT `packages/mcp/` or `apps/coordinator/`). ✓
  - **T13** (re-verify ADOPTED items) — SP `requesting-code-review` ADOPT-vs-REFERENCE disambiguation inherited from SW-A `:242-248`; CC hooks API (SSOT #20 ADOPT) re-verified via direct WebFetch in SW-B2 §2.1; both cross-referenced in this synthesis without silent override. ✓
  - **T15** (recursive self-application) — **CRITICAL per dispatch**: this synthesis re-derived the verdict landscape **independently** from the predecessor patches' evidence — it did NOT consume any state.md «likely trajectory» as pre-pick (no state.md file exists in the umbrella directory per `find /Users/art/code/rules-as-tests-aif/.claude/orchestrator-prompts/aif-handoff-as-runtime-bridge` returns only `kickoff.md`). The per-variant verdicts in §4.1 were re-walked under BFR-default §1 ladder; the cross-variant equipoise check in §4.2 was re-derived; the hook-discipline application in §4.3 was re-derived. Re-derivation produced verdicts CONSISTENT with predecessor Sub-waves, confirming the synthesis is not silently overriding any predecessor verdict. §10 self-application section below explicitly walks the recursive check. ✓
  - **T16** (problem-class match per variant) — §3 above is the explicit 4-row T16 table with file:line evidence; cross-checked against predecessor T16 tables in SW-A/B/B'/C. ✓
  - **T17** (destructive delegation) — synthesis output is markdown-only; no code edits, no skill edits, no kickoff edits, no settings.json edits, no install.sh edits, no destructive ops. ✓
  - **T19** (cold-QA before handoff) — §10 self-application walk below is the worker-side cold-QA pre-PR. Per kickoff §9.3, orchestrator + maintainer serve as independent reviewers. ✓
  - **T20** (verdict cites SSOT + evidence + falsifier in same sentence) — §0 TL;DR verdict sentence + §6 final recommendation both cite SSOT row IDs + predecessor-patch file:line + falsifier in same paragraph. ✓

- **`doc-authority-hierarchy.md §3`:** Header carries Status + Class (N/A — research-patch) + Authoritative-for + NOT authoritative-for. ✓

- **`dual-implementation-discipline.md §2`:** This patch is markdown-only artefact under «§2 (i) markdown-only carve-out» — rule does not apply at R-phase synthesis layer. ✓

- **`memory-codification.md §3`:** No durable conventions written to memory in this Sub-wave. DN-1 and DN-2 maintainer decisions are consumed as input facts, not codified as new rules. ✓

- **DECISION=C invariant:** §2 Crit-2 table confirms compliance check for each variant (A=PASS conditional; B=FAIL; B'=PASS all-4; C=PASS conditional dual-constraint). Hard requirement not violated by this synthesis. ✓

- **CLAUDE.md `PR strategy`:** This patch is strictly within Sub-wave D synthesis scope. No drive-by PRs opened. No scope creep into A/B/B'/C variant findings (those are predecessor Sub-wave scopes — read-only here). No edits to SKILL.md, install.sh, settings.json, or any non-research-patches file. Output = one markdown file in one commit. ✓

- **CLAUDE.md `Artifact Ownership Contract`:** synthesis patch is owned by this Sub-wave's session at author-time per research-patches/ folder per-patch convention. Predecessor-patch files (SW-A, SW-B, SW-B2, SW-C) are READ-ONLY — cross-referenced via file:line citation but NOT modified. ✓

- **Admission gate §2.4 (kickoff line 42):** Inherited from SW-A §7 line 343 verification: `gh api repos/lee-to/aif-handoff/commits?since=2026-04-29` returned PR #127 (per-profile env, merged 2026-05-15) + PR #128 (proxy env, merged 2026-05-26) — both touch `packages/runtime/` only, NOT `packages/mcp/` or `apps/coordinator/`. Gate §2.4 CLEAR — no MCP or coordinator surface drift in the 30-day window; synthesis-time re-verification is hash-equivalent to SW-A's, not re-run. ✓

Evidence (file:line / verifiable command output / inherited from predecessor Sub-wave):
- [SW-A §5 verdict line 266](2026-05-29-aif-handoff-bridge-variant-a-mcp.md) — Variant A REFERENCE
- [SW-B §5 verdict line 182](2026-05-29-aif-handoff-bridge-variant-b-watcher.md) — Variant B REJECT
- [SW-B2 §5 verdict line 396](2026-05-29-aif-handoff-bridge-variant-b-prime-hybrid.md) — Variant B' REFERENCE (conditional ADOPT VOCABULARY)
- [SW-C §6 verdict line 347](2026-05-29-aif-handoff-bridge-variant-c-minimal.md) — Variant C REJECT
- [`docs/meta-factory/prior-art-evaluations.md:95-148`](../prior-art-evaluations.md) — SSOT rows #27/#28/#29/#30/#43/#44/#46/#67/#80 reviewed
- [`docs/meta-factory/prior-art-evaluations.md:152`](../prior-art-evaluations.md) — slot #84 verified as highest existing (synthesis proposes #85)
- [`.claude/orchestrator-prompts/aif-handoff-as-runtime-bridge/kickoff.md`](../../../.claude/orchestrator-prompts/aif-handoff-as-runtime-bridge/kickoff.md) — parent kickoff; §6.5 directs DEFER-all-with-updated-triggers option
- [`.claude/rules/build-first-reuse-default.md`](../../../.claude/rules/build-first-reuse-default.md) §1 verdict ladder applied per-variant in §4.1
- [`.claude/rules/reviewer-discipline.md`](../../../.claude/rules/reviewer-discipline.md) §2 — DN-1/DN-2 consumed as input, no strategy pick by this synthesis
- [`.claude/rules/no-paid-llm-in-ci.md`](../../../.claude/rules/no-paid-llm-in-ci.md) §1 — zero API-billed calls by this synthesis
- [`.claude/rules/ai-laziness-traps.md`](../../../.claude/rules/ai-laziness-traps.md) — T-trap enumeration discipline followed

---

## §8 §1.7 Backward-check applied

- **SSOT rows touched:** SSOT #27 / #28 / #30 / #44 / #67 / #80 each receive an additive note per §5 above — additive-only, no verdict changes. Original DEFER verdicts on #27/#28/#30/#44/#80 unchanged. Original REJECT verdict on #67 (for `/meta-orchestrator` scope) unchanged. Trigger-to-revisit fields receive CLARIFICATIONS (e.g. SSOT #30: «empirical, not articulatory» qualifier) — additive nuance, not replacement. ✓

- **No predecessor Sub-wave verdict superseded.** SW-A REFERENCE for Variant A — preserved. SW-B REJECT for Variant B (native upstream feature) — preserved. SW-B2 REFERENCE (conditional ADOPT VOCABULARY) for Variant B' — preserved. SW-C REJECT for Variant C — preserved. The synthesis re-derived each verdict independently per T15; re-derivation produced CONSISTENT verdicts (a validation, not a re-litigation). ✓

- **No `.claude/rules/*` modified.** No `.claude/skills/*` modified (including SKILL.md:404+:429 — disambiguation inherited from SW-A `:242-248`). No `agents/*` modified. No `packages/*` modified. No `install.sh` modified. No `.github/workflows/*` modified. No `settings.json` modified. No kickoff.md modified. No predecessor research-patch modified. Single output file = this research-patch at `docs/meta-factory/research-patches/2026-05-29-aif-handoff-bridge-synthesis.md`. ✓

- **SKILL.md:404 and SKILL.md:429** — read-only; disambiguation inherited from SW-A `:242-248` and `2026-05-23-meta-orchestrator-prior-art.md:73`. No SKILL.md text change required by this synthesis. ✓

- **Scope:** this patch covers Sub-wave D synthesis only. Sub-wave A (Variant A), Sub-wave B (Variant B), Sub-wave B2 (Variant B'), Sub-wave C (Variant C) are inputs (read-only). No scope creep into any I-phase or implementation decision. The DEFER-all recommendation in §6 explicitly defers to maintainer for any future GREENLIGHT decision should the compound AND trigger fire. ✓

- **DN-1 and DN-2 inputs:** consumed as fact per dispatch instruction. NOT re-litigated. NOT modified. ✓

- **T15 self-application:** This R-phase Sub-wave applied BFR-default §3 6-layer search to itself — SSOT consult, predecessor-patch independent re-read (4 patches, full Reads, no skim), T16 problem-class re-derivation, BFR-default §1 ladder re-walk per variant, equipoise check, hook-discipline application. The patch is the output of the methodology it evaluates. Recursive self-application confirmed in §10 below. ✓

- **Memory not written.** No new memory entry created. The dispatch inputs (DN-1=B-constrained, DN-2: SW-B verdict stands + B' is operative B-path, hook-discipline Decision 10) are one-shot context for this Sub-wave; they are already codified upstream (kickoff §6 Sub-wave dispatch instructions; maintainer-side state per [reviewer-discipline.md §2](../../../.claude/rules/reviewer-discipline.md)). ✓

Evidence (file:line / SSOT row IDs verified):
- [SW-A patch line 266](2026-05-29-aif-handoff-bridge-variant-a-mcp.md) — REFERENCE for Variant A
- [SW-B patch line 182](2026-05-29-aif-handoff-bridge-variant-b-watcher.md) — REJECT for Variant B
- [SW-B2 patch line 396](2026-05-29-aif-handoff-bridge-variant-b-prime-hybrid.md) — REFERENCE conditional for Variant B'
- [SW-C patch line 347](2026-05-29-aif-handoff-bridge-variant-c-minimal.md) — REJECT for Variant C
- `docs/meta-factory/prior-art-evaluations.md:152` — slot #84 highest existing (synthesis proposes #85)
- [`.claude/skills/meta-orchestrator/SKILL.md:404`](../../../.claude/skills/pipeline/SKILL.md#L404) + [`:429`](../../../.claude/skills/pipeline/SKILL.md#L429) — Phase -1 dispatch template (SP REFERENCE + ADOPT-template-directive); inherited disambiguation from SW-A

---

## §9 §10 Self-application (T15)

**Did this R-phase Sub-wave apply BFR-default §3 6-layer search to itself?**

Walk:

1. **SSOT consult** (rows #27/#28/#29/#30/#43/#44/#46/#67/#80 + #84 verified as highest existing) — ✓ done before consolidation; cited in §3 T16 table and §5 additive notes.

2. **phase-research-coverage §1 6-item checklist applied to each variant's negative-existence claim:**
   - «no `aif-handoff exec` CLI exists» — backed by SW-C Probe 1+5 (DeepWiki 2026-05-29);
   - «no first-class Implementer-only mode» — backed by SW-C Probe 1 (DeepWiki 2026-05-29);
   - «no upstream fs-watcher capability» — backed by SW-B Probes 1+2+5 + file-tree grep + gh search 0 results (2026-05-29);
   - «PLAN.md disk coupling is unavoidable for accept_existing_plan» — backed by SW-A Probe 6 (DeepWiki 2026-05-29);
   - «WebSocket is broadcast-only with no topic filter» — backed by SW-A Probe 3 (DeepWiki 2026-05-29).
   6/6 channels per claim ✓.

3. **DeepWiki probes inherited from predecessor Sub-waves at R-phase time** — total 19 probes (SW-A 7 + SW-B 5 + SW-B2 2 + SW-C 5), all dated 2026-05-29; all URL-cited in predecessor patches. ✓ NOT training-data recall (T12 counter).

4. **WebSearch ≥3 phrasings inherited** — SW-B (3 phrasings on fs-watcher / agent orchestration), SW-B2 (3 phrasings on atomicity / fs-watcher LOC / cross-platform), SW-C (2 phrasings on kanban-tracker ecosystem). ≥3 total phrasings across distinct concerns. ✓

5. **Own-stack sweep inherited** — `SKILL.md:404+:429` (SP `requesting-code-review` disambiguation) read in SW-A; `inject-matching-rule.sh:80` (PostToolUse precedent) read in SW-B2; `SKILL.md:441` (anti-scope) read in SW-A/SW-C. ✓

6. **T15 self-application** — this section. ✓

**What would auditing this R-phase synthesis look like?**

A cold reviewer would:

- (a) re-read each predecessor patch independently and verify the 20-cell comparison table cells match the cited file:line evidence (T3 falsification);
- (b) independently re-derive each variant's BFR-default §1 ladder walk and confirm verdicts match §4.1 above;
- (c) independently re-check the equipoise condition in §4.2 — is there genuine equipoise between any 2+ variants? Or are they on distinct rungs?;
- (d) verify DN-1 and DN-2 reflections in §4.4 + §4.5 are consumed-as-input, not re-litigated (per `reviewer-discipline.md §2`);
- (e) re-derive the recommendation in §6 — does DEFER-all-with-updated-triggers strictly dominate GREENLIGHT and REJECT-all under both BFR-default §1 ladder and SSOT-trigger-fire status?;
- (f) verify SSOT row #85 is the next-available slot (`grep -E "^\| [0-9]+ \|" prior-art-evaluations.md | tail -1` returns #84 → #85 is next; verified at evaluation time).

All six are mechanical and deterministic — no LLM-judgment needed at the cold-review step.

**Verdict on own quality:** SUFFICIENT — the synthesis inherits 19 distinct DeepWiki probes + 4 patches read independently + 6 own-checks above. T1 sampling floor (≥5) exceeded by 3.8× on direct probes alone. **One self-noted edge case (T-trap residual):** the cross-variant verdict assumes the DN-1=B-constrained input is correctly interpreted as «maintainer-side behavioural constraint on aif-handoff Reviewer, NOT a shipped upstream feature» per the dispatch context. If DN-1's actual scope is different (e.g. «maintainer commits to building the Reviewer constraint as an upstream PR»), the verdict for Variant A could legitimately shift toward ADAPT. **Mitigation:** §4.4 explicitly walks DN-1 reflection and surfaces the partial-mitigation pattern; maintainer can falsify the interpretation if it's wrong.

**Verdict consistency check:** re-derivation produced verdicts CONSISTENT with predecessor Sub-wave patches (A=REFERENCE, B=REJECT, B'=REFERENCE conditional, C=REJECT). This is a validation of the synthesis methodology, not a re-litigation. If re-derivation had produced inconsistent verdicts, that would be a flag for either (a) predecessor patch error or (b) synthesis methodology error — neither was surfaced.

---

## §10 See also

- [`.claude/orchestrator-prompts/aif-handoff-as-runtime-bridge/kickoff.md`](../../../.claude/orchestrator-prompts/aif-handoff-as-runtime-bridge/kickoff.md) — parent umbrella kickoff; §3 4-variant enumeration; §4 5-criteria; §5 AI-traps; §6 Sub-wave breakdown (Sub-wave D = synthesis); §6.5 directive options (GREENLIGHT / DEFER / REJECT); §8 stop conditions; §10 §1.7 forward+backward self-walk pattern; §11 output spec.
- [Sub-wave A patch — Variant A MCP-consumer evaluation](2026-05-29-aif-handoff-bridge-variant-a-mcp.md) (merged PR #268; REFERENCE 28%; 3 ADOPT-blockers).
- [Sub-wave B patch — Variant B native-fs-watcher REJECT](2026-05-29-aif-handoff-bridge-variant-b-watcher.md) (merged PR #267; REJECT ~5%; upstream feature absent).
- [Sub-wave B2 patch — Variant B' hybrid hook + existing MCP](2026-05-29-aif-handoff-bridge-variant-b-prime-hybrid.md) (merged PR #275; REFERENCE ~35% conditional ADOPT VOCABULARY).
- [Sub-wave C patch — Variant C minimal bridge REJECT](2026-05-29-aif-handoff-bridge-variant-c-minimal.md) (merged PR #276; REJECT ~22%; BEFORE/AFTER 25%/0% below §8 STOP 30%).
- [PR #269](https://github.com/Yhooi2/rules-as-tests-aif/pull/269) — Stage 1→2 Phase -1 follow-up; mechanical corrections to SW-A/B (B1+M1+m1/m2/m3); no verdict changes.
- [`docs/meta-factory/research-patches/2026-05-23-meta-orchestrator-prior-art.md`](2026-05-23-meta-orchestrator-prior-art.md) — meta-orchestrator BUILD verdict + SSOT #66-#70 origin; §3 leapfrog table SP `requesting-code-review` row at `:73` (REFERENCE source + ADOPT-template directive).
- [`docs/meta-factory/research-patches/2026-05-26-companion-reuse-aif-handoff-autoqueue.md`](2026-05-26-companion-reuse-aif-handoff-autoqueue.md) — predecessor sub-component evaluation (autoQueueMode); precedent for evaluating aif-handoff capabilities separately from full-runtime REJECT (SSOT #67).
- [`docs/meta-factory/prior-art-evaluations.md`](../prior-art-evaluations.md) — SSOT rows referenced: #20 (CC hooks ADOPT — inherited from SW-B2), #27 (HANDOFF_MODE DEFER), #28 (paused:true DEFER), #29 (task annotation), #30 (P/I/R pipeline DEFER), #43 (RuntimeAdapter), #44 (@aif/mcp DEFER), #46 (Subagents/Skills mode), #67 (Kanban runtime REJECT), #80 (delta-tracking DEFER). Slot #85 PROPOSED (next-after-#84 verified).
- [`.claude/rules/build-first-reuse-default.md`](../../../.claude/rules/build-first-reuse-default.md) — §1 verdict ladder applied per-variant in §4.1; §3 6-layer search inherited from predecessor patches.
- [`.claude/rules/reviewer-discipline.md`](../../../.claude/rules/reviewer-discipline.md) §2 — strategy-fork-surface gate; DN-1 / DN-2 consumed as input, no strategy pick by this synthesis.
- [`.claude/rules/ai-laziness-traps.md`](../../../.claude/rules/ai-laziness-traps.md) — T-traps active for this Sub-wave; T15 (recursive self-application) + T20 (verdict + SSOT + evidence + falsifier) load-bearing.
- [`.claude/rules/no-paid-llm-in-ci.md`](../../../.claude/rules/no-paid-llm-in-ci.md) §1 — zero API-billed calls by this synthesis; all evidence inherited from predecessor patches or read locally.
- [`.claude/rules/phase-research-coverage.md`](../../../.claude/rules/phase-research-coverage.md) §1.7 + §1.12 — forward+backward checks applied (§7+§8) + recommendation discipline applied (§6 + §0 TL;DR).
- [`.claude/rules/recommendation-laziness-discipline.md`](../../../.claude/rules/recommendation-laziness-discipline.md) — T20 specialisation applied to §6 recommendation sentence.
- [`.claude/rules/doc-authority-hierarchy.md`](../../../.claude/rules/doc-authority-hierarchy.md) §3 — header format spec; §2 filename-convention authority for research-patches/.
- [`.claude/rules/dual-implementation-discipline.md`](../../../.claude/rules/dual-implementation-discipline.md) §2 — markdown-only carve-out (R-phase synthesis not subject to dual-channel discipline).
- [`.claude/skills/meta-orchestrator/SKILL.md`](../../../.claude/skills/pipeline/SKILL.md) — surface this umbrella reasons against; `:441` (anti-scope; line current on `origin/staging` 2026-05-29), `:404+:429` (Phase -1 dispatch SP REFERENCE + ADOPT-template, criterion 5 disambiguation per SW-A grounding).
