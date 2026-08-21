# Umbrella: aif-handoff-runtime-bridge-iphase

> **transient artifact** — oversized orchestration design doc; exempt from the 600-line markdown gate (cross-session-kickoff-portability, SSOT #116).

> **Status:** DRAFT planned 2026-05-29. **NOT yet dispatched.** I-phase BUILD scope; ready for `/meta-orchestrator aif-handoff-runtime-bridge-iphase` invocation.
> **Authoritative for:** umbrella scope + 5 sub-wave breakdown + admission gates for **implementing** a thin adapter that lets aif-handoff serve as the cross-session autonomous dispatch layer for our `/meta-orchestrator` pipeline. Opt-in for consumers who install aif-handoff alongside; substrate stays dependency-free.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). The original R-phase verdict matrix (4 variants × 5 criteria, DEFER ALL) — see [research-patches/2026-05-29-aif-handoff-bridge-{variant-a-mcp,variant-b-watcher,variant-b-prime-hybrid,variant-c-minimal,synthesis}.md](../../../docs/meta-factory/research-patches/). Maintainer-decision-loop architecture — that lives **above** this umbrella per the layered model (Superpowers brainstorming → maintainer planning → /meta-orchestrator → THIS bridge → aif-handoff runtime).

> **Class:** N/A (kickoff doc, not a rule). Discipline-bearing artefact — full §1.7 self-reflexive check at §10 below.

---

## §0 One-line frame

**Phased hybrid bridge** between `/meta-orchestrator` kickoff output and a cross-session execution runtime, supporting BOTH aif-handoff AND amux backends behind a common `RuntimeBackend` abstraction, with `ManualBackend` always-present as the no-op fallback. Maintainer directive 2026-05-29 (brainstorm session): «надо строить мост между оркестратором и aif-handoff/amux, и A и C; отказаться я всегда успею если не буду укладываться в лимиты; когда есть aif-handoff использовать его, когда нет — amux; при установке предлагать на выбор; в runtime тоже иметь выбор».

**Phase 1 (this iteration) — aif-handoff backend + ManualBackend fallback.** Reuses original SW-A/B/C/D scaffolding but builds behind the common `RuntimeBackend` interface so Phase 2 reuses without rework. SW-A now also captures **per-invocation `total_cost_usd`** — this is the load-bearing measurement that gates Phase 2.

**Phase 2 (conditional, post-Phase-1-measurement) — amux backend.** Triggered iff Phase 1 measurement shows credit-cap risk under real usage OR maintainer wants resilience against aif-handoff outages. SW-E/F/G/H reuse the Phase 1 interface; amux gets its own transport-verification sub-wave equivalent to SW-A.

**Runtime opt-out always available.** `RUNTIME_BRIDGE_MODE=manual` env var (session-wide) + per-task `<!-- bridge: skip -->` kickoff marker (per-task) force ManualBackend even when a backend is installed. ManualBackend is the always-present default: writes kickoff to `/tmp/<task-id>.md`, prints copy-paste instructions, polls for response file. **Invariant:** the bridge never degrades the current manual-paste experience; it only adds automation when available + opted-in.

**Load-bearing premise (Pre-A finding, verified twice from primary Anthropic sources):** `claude -p` (= Agent SDK invocation = aif-handoff CLI transport = amux `claude` subprocess) moves to a separate $100/$200 monthly Agent SDK credit on 2026-06-15. Both backends share this credit pool. Phase 1's `total_cost_usd` measurement is the gate that determines Phase 2 trigger. Predecessor R-phase synthesis's blockers (i) PLAN.md disk coupling and (ii) WebSocket broadcast remain empirical STOP-gates inside SW-B and SW-C; blocker (iii) autoMode Reviewer is addressed via `AGENT_AUTO_REVIEW_STRATEGY=closure_first` + `manualReviewRequired=true` (still subject to SW-D Step 3a probe).

---

## §1 Origin — why a new I-phase

**Predecessor R-phase verdict:** DEFER ALL (PR #281 SW-D synthesis 2026-05-29; final close-review GO PR #283).

**Why reverse:** during close-out dialogue with maintainer 2026-05-29, **two load-bearing facts** that the R-phase did not surface:

1. **aif-handoff CLI transport uses CC subscription** (not Anthropic SDK metered). Source: `lee-to/aif-handoff` README — «⚠️ Anthropic prohibits using Claude Max / Pro subscriptions outside of the official Claude Code CLI. … use the CLI transport — it runs through the official Claude Code CLI and is safe to use on a Max / Pro subscription.» Verified via `gh api repos/lee-to/aif-handoff/contents/README.md` 2026-05-29. **Implication:** no recurring API cost; subscription-bundled.

2. **Maintainer's layered decision model aims to defuse the autoMode Reviewer conflict** with `reviewer-discipline.md §2`. Maintainer architecture: (a) maintainer plans + approves top-level strategy via Superpowers `brainstorming`; (b) `/meta-orchestrator` validates + creates kickoffs **+ sequences umbrellas + decides within-umbrella sub-wave ordering**; (c) aif-handoff executes the dispatched work under `AGENT_AUTO_REVIEW_STRATEGY=closure_first`; (d) when auto-review fails to converge → task lands in `done` with `manualReviewRequired=true` flag → maintainer batches manual review off-line. **Verification gate:** this defusing is contingent on Sub-wave D confirming that `manualReviewRequired` is a real per-task knob in aif-handoff (not just a doc artifact), AND that Kanban surfaces flagged tasks queryably for batch review. **Implication (conditional):** strategy never silently picked by aif-handoff IF the gate holds; manual escalation is explicit, not bypassed.

3. **Synthesis's 3 ADOPT-blockers — partial coverage by these 2 new facts.** Blocker (iii) autoMode Reviewer is what §1 point 2 addresses. Blockers (i) PLAN.md disk coupling and (ii) WebSocket broadcast no-topic-filter — NOT addressed by the new facts; remain structural risks under verification at Sub-wave B (PLAN.md) and Sub-wave C (WebSocket). §7 STOP conditions catch them, but the reader must know this at §1, not at §7. Verdict reversal is **partial**: cost path verified (fact 1), layered architecture proposed (fact 2); 2 technical blockers still need empirical verification at build time.

**Plus:** maintainer explicit goal restated 2026-05-29 — «моя задача только избавить меня от ручного труда копировать промты и запусктаь в новые сессии оркестраторов а затем рарорты обратно мета оркестратору приносить или запускать новые сессии». aif-handoff cross-session daemon is the **only available upstream candidate** for this (Superpowers explicitly stays in-session per their own scope).

**Plus:** maintainer expressed strategic preference 2026-05-29 — «А ЗАТО МОЖЕМ ИСПОЛЬЗОВАТЬ ЛУЧШЕЕ ИЗ ОБОИХ ПЛАГИНОВ! - и только если в суперпауерс нет уже альтернативы готовой конечно». Combine Superpowers + aif-handoff for complementary layers (in-session + cross-session). Requires Sub-wave Pre-A audit FIRST to ensure no Superpowers re-use is missed before building.

**Plus (round-4 amendment, 2026-05-29):** Pre-A landed (PR #286, 432 lines, OPEN on staging) with two impact-changing findings: (a) SP audit verdict = all 9 KEEP-REFERENCE, no umbrella scope shrinkage; (b) **June 15, 2026 Agent SDK credit-pool split** (Pro $20, Max 5x $100, Max 20x $200 monthly — verified twice from `code.claude.com/docs/en/headless` Note box + `support.claude.com/en/articles/15036540`) materially affects fact 1 above. After surfacing this in brainstorming session, maintainer directive flipped from «pick one backend» to «build both, phased, with measurement gate + opt-out + ManualBackend fallback». See §3 «Phase split» subsection + §12 round-4 amendment log.

This is the «DEFER row activates when new load-bearing facts emerge» pattern from `phase-research-coverage.md §1.6 trigger sweep` — the trigger here is «load-bearing assumption (API metering) revealed false post-verdict» + «companion + maintainer-design integration unlock the path» + «Pre-A findings re-shape architecture from single-backend to hybrid».

---

## §2 Admission gates — DO NOT dispatch Sub-wave Pre-A until ALL hold

1. **`aif-handoff-as-runtime-bridge` umbrella closed.** ✅ DONE 2026-05-29 (PR #283 merged 14:54:18Z).
2. **Maintainer prioritization explicit.** Maintainer dialogue 2026-05-29 confirms «го iphase» (or equivalent) — verify before dispatch.
3. **Phase -1 cold-review of THIS kickoff complete.** 1× Opus reviewer per orchestrator skill Phase -1 protocol. Reviewer verifies: (a) §1.7 forward+backward (§10 below), (b) load-bearing fact citations from §1 (CLI transport README cite + AGENT_AUTO_REVIEW_STRATEGY mechanism), (c) §3 sub-wave breakdown is non-redundant, (d) DECISION=C invariant is preserved through adapter design (substrate stays dependency-free; aif-handoff opt-in for consumer).
4. **No `claude` CLI transport breaking change shipped in last 30 days.** Falsifier: `gh api repos/lee-to/aif-handoff/commits?since=<date>` returns ≥1 commit touching `packages/runtime/src/adapters/claude/cli.ts` since 30 days before dispatch with breaking-change implication. If yes → re-sweep `cli.ts` before Sub-wave A.

If any gate fails → kickoff stays parked.

---

## §3 Sub-wave breakdown — Phase 1 (4 sub-waves) + Phase 2 (4 sub-waves, conditional)

Mode A Opus per Decision 5. Self-setup convention applies (state.md Decision 13 of predecessor umbrella): each sub-wave prompt is self-contained; Worker session creates own worktree from primary workdir paste.

**Worker base branch = `staging`, NOT `main`.** All predecessor R-phase research-patches (`docs/meta-factory/research-patches/2026-05-29-aif-handoff-bridge-{variant-a-mcp,variant-b-watcher,variant-b-prime-hybrid,variant-c-minimal,synthesis}.md` + closing PR #283 + Pre-A patch `2026-05-29-superpowers-reuse-audit-for-runtime-bridge.md`) are on `staging` only — they are NOT on `main`. Per `project_automerge_staging_plan` migration (2026-05-22, PR #150), `staging` is GitHub default + trunk; `main` is prod-promotion. **Worker pre-flight (mandatory before reading any predecessor patch):**

```bash
git fetch origin
git ls-tree origin/staging docs/meta-factory/research-patches/ | grep aif-handoff-bridge-synthesis
git ls-tree origin/staging docs/meta-factory/research-patches/ | grep superpowers-reuse-audit
# Both must return non-empty. If empty → orchestrator paste is from a stale base; halt + escalate.
```

### Phase split (round-4 architecture)

**Phase 1 — aif-handoff backend + ManualBackend fallback. Builds the `RuntimeBackend` abstraction; first user-facing bridge ships here.**
- SW-A: aif-handoff CLI transport verify + `total_cost_usd` measurement (gate for Phase 2)
- SW-B: `RuntimeBackend` interface + `AifHandoffBackend` impl + `ManualBackend` impl + PostToolUse hook
- SW-C: aif-handoff WebSocket status read-back
- SW-D: setup script (aif-handoff/skip), runtime opt-out spec, consumer-facing docs

**Phase 1 decision point (after SW-D merge):** maintainer has 1-2 weeks of real usage with `total_cost_usd` data. Branches:
1. Cost fits inside $100/$200 monthly Agent SDK credit AND aif-handoff stable → Phase 2 LOW priority (maybe skip)
2. Cost exceeds credit OR aif-handoff outages annoy → Phase 2 triggers
3. Cost catastrophic OR bridge UX bad → close umbrella as «not-worth-building», keep ManualBackend as standalone improvement

**Phase 2 — amux backend (conditional on Phase 1 decision-point).** Reuses Phase 1 `RuntimeBackend` interface; amux gets its own SW-A-equivalent.
- SW-E: amux transport verify + T16 ~55% confirmation + cost measurement
- SW-F: `AmuxBackend` impl of `RuntimeBackend`
- SW-G: amux REST/SSE status read-back
- SW-H: setup script expanded to 3-way choice (aif-handoff / amux / skip), runtime preference order config

### Shared component spec (binding for SW-B and SW-F)

**`RuntimeBackend` interface (TypeScript-ish sketch):**
```typescript
interface RuntimeBackend {
  readonly name: 'aif-handoff' | 'amux' | 'manual';
  readonly available: () => Promise<boolean>;  // probe at runtime
  readonly dispatch: (kickoff: KickoffSpec) => Promise<TaskHandle>;
  readonly getStatus: (handle: TaskHandle) => Promise<TaskStatus>;
  readonly awaitDone: (handle: TaskHandle, timeoutMs?: number) => Promise<TaskResult>;
}
```

**Preference resolver:** at orchestrator startup, probe `available()` on each backend. Active backend = first available in order `[aif-handoff, amux, manual]`. Override via env var `RUNTIME_BRIDGE_MODE` ∈ `{auto, manual, aif-handoff, amux}`. Per-task override via `<!-- bridge: skip -->` first-line marker in the kickoff.md.

**`ManualBackend` impl (always available, ~20-30 LOC bash + 30 LOC TypeScript):**
- `dispatch`: copies kickoff to `/tmp/runtime-bridge-<task-id>.md`, prints to stderr «откройте новое окно Claude Code, скопируйте из X, положите отчёт в /tmp/runtime-bridge-<task-id>.response.md, нажмите Enter здесь когда готово» — does NOT block parent session
- `getStatus`: checks for response file existence + mtime
- `awaitDone`: polls every 30s for response file; returns content when found (no timeout in MVP)

**Auto-fallback rule:** if a non-manual backend's `dispatch` throws `quota_exceeded` or `unavailable` → orchestrator silently retries via `ManualBackend` + prints a warning to stderr. Maintainer never gets a dead-end; worst case is degradation to status quo.

### Sub-wave Pre-A — Superpowers re-use audit (DONE 2026-05-29, PR #286)

**Status:** SHIPPED — PR #286 MERGED to staging 2026-05-29 (round-4 cold-review fix B1), 432 lines. Verdicts: 9 SP skills = all KEEP-REFERENCE (no umbrella scope shrinkage); 4 companions = amux ADOPT-candidate T16 ~55% / ai-factory REFERENCE / claude-squad REJECT / oh-my-openagent REFERENCE. New finding: June 15 Agent SDK credit pool — drove round-4 architecture flip to hybrid phased.



**Output (actual, DONE):** `docs/meta-factory/research-patches/2026-05-29-superpowers-reuse-audit-for-runtime-bridge.md`.

**Origin:** maintainer's strategic preference («только если в суперпауерс нет уже альтернативы готовой»). Verify before BUILD that Superpowers `subagent-driven-development` + `requesting-code-review` + `using-git-worktrees` + `dispatching-parallel-agents` don't already cover scope we'd otherwise rebuild.

**Must cover:**

1. **Expanded SP skill audit list:** `subagent-driven-development` + `requesting-code-review` + `using-git-worktrees` + `dispatching-parallel-agents` + **`writing-plans` + `executing-plans` + `brainstorming` + `verification-before-completion` + `finishing-a-development-branch`**. The last five are load-bearing: `writing-plans`+`executing-plans` are the in-session analogue of aif-handoff's runtime; `brainstorming` is the entry point to our Top layer (see Sub-wave D Step 3b below); `verification-before-completion`+`finishing-a-development-branch` may overlap our stage-gates.
2. For each SP skill:
   - **Skill content via `gh api repos/obra/superpowers/contents/skills/<skill-slug>/SKILL.md --jq '.content' | base64 -d`** (per individual skill). Do NOT `git clone` the upstream repo into the Worker worktree — it dirties working tree, breaks subsequent `gh pr` ops, and burns tokens on clone output.
   - Current usage in our `SKILL.md` + `templates/meta-kickoff.template.md`
   - **Bi-directional gap:** (a) what SP covers that our Sub-wave A/B/C/D scope intends to build, (b) what aif-handoff/amux/claude-squad/superset-sh uniquely provide that SP does NOT cover.
   - **In-session vs cross-session boundary:** where SP ends (at `/clear`) and the cross-session runtime layer begins.
3. T16 problem-class match per SP skill: «SP problem class: X / our umbrella problem class: Y / match? / evidence».
4. **Companion-projects audit (broader candidate space):**
   - **Read and integrate** [`2026-05-26-companion-reuse-aif-handoff-autoqueue.md`](../../../docs/meta-factory/research-patches/2026-05-26-companion-reuse-aif-handoff-autoqueue.md) — do NOT re-derive, build on its findings or surface a falsifier.
   - **ai-factory** (parent framework of aif-handoff) probe per BFR-default §3 6-layer search: does ai-factory expose surfaces aif-handoff does not? Mandatory probe per principle 11, even if expected yield is low.
   - **amux** (mixpeek/amux) — REST API task-queue daemon, potentially covers all 4 maintainer pain points. **COST-CLASS PROBE FIRST:** verify whether amux calls Claude Code CLI (subscription-bundled, OK) or Anthropic API directly (metered). amux docs reportedly mention «you pay for Claude API tokens consumed» — find the actual call site in code. **If metered → label `last-resort, requires explicit extra-limits maintainer approval`. If subscription-bundled → equal candidate to aif-handoff.** Maintainer explicit preference 2026-05-29: prefer subscription-bundled alternatives if found; metered amux is acceptable only as last resort.
   - **claude-squad** (smtg-ai/claude-squad) — Go TUI, tmux-backed; brief T16 check — does it offer a machine-callable surface (not just human TUI)?
   - **oh-my-openagent** (Sisyphus loop pattern) — brief T16 problem-class check; not a full audit (already evaluated in prior memory).
   - **superset-sh/superset** — already evaluated in this brainstorm session: REFERENCE only (no structured readback API; 2/4 pain coverage). Document the prior finding; do NOT re-audit. Its mobile app may be cited as a notification-channel example in Sub-wave D Step 3c, but NOT as a runtime-bridge candidate.
5. Verdict per SP skill: KEEP-REFERENCE / UPGRADE-TO-ADOPT-USAGE / OUT-OF-SCOPE-FOR-THIS-UMBRELLA. Verdict per companion project: ADOPT-candidate / ADAPT-candidate / REFERENCE / REJECT / DEFER + cost-class label.
6. Concrete recommendation: which Sub-waves of A/B/C/D shrink, expand, or restructure based on findings.
7. §1.7 forward+backward checks.

**Estimated effort:** ~100-130k Opus (widened from original 80-100k due to companion-projects audit).

### Phase 1 — Sub-wave A — Verify CLI transport mode + first `total_cost_usd` measurement

**Output:** `docs/meta-factory/research-patches/2026-05-XX-aif-handoff-cli-transport-verification.md` + measurement appendix with at least 1 real `total_cost_usd` capture.

**Must cover:**

1. Read `aif-handoff/packages/runtime/src/adapters/claude/cli.ts` (and any helpers it calls) — extract the EXACT `claude` command-line invocation: which flags? `--print` / `-p` / `--headless` / interactive subprocess?
2. **Default-transport check:** read `aif-handoff/packages/runtime/src/adapters/claude/index.ts:449` and confirm `const transport = input.transport ?? RuntimeTransport.SDK` (Pre-A reviewer + orchestrator stop-hook re-verification 2026-05-29 both confirmed; independently re-verify in case upstream moved the line). **Load-bearing for §1 fact 1 and SW-D setup-guide** — without explicit `transport: "cli"` config consumer falls back to SDK transport.
3. **June 15 Agent SDK credit pool — already verified twice by Pre-A and orchestrator stop-hook re-verification 2026-05-29.** Primary sources: `code.claude.com/docs/en/headless` Note box + `support.claude.com/en/articles/15036540`. Worker must NOT re-fetch as if unknown; cite Pre-A patch §6 + this kickoff §0 «Load-bearing premise» as verified prior. T13 applies: re-confirm only that the cited URLs still serve the same text (≤ 2 WebFetch calls), do not re-research from scratch.
4. **NEW (round-4 must-cover): first `total_cost_usd` measurement.** Dispatch one realistic autonomous task via `claude -p --output-format json --bare "<medium-substance prompt>"` (similar shape to what aif-handoff CLI transport would invoke). Capture the JSON output's `total_cost_usd` field. Document the prompt + cost + token counts. **This is the load-bearing Phase 1→Phase 2 gate input** — without it, decision-point at end of Phase 1 has no real data to gate on.
   - Suggested measurement task: have the Worker re-do a small probe similar to a typical research-patch section (e.g. «summarise Pre-A patch §6 in 200 words»), so the cost data is comparable to real future autonomous work
   - Capture metadata: model used, prompt tokens, completion tokens, total_cost_usd. Append to research-patch as «§Measurement appendix».
5. T16 problem-class: «aif-handoff CLI transport is built for X / our usage is Y / match?»
6. STOP condition: if `cli.ts` shows something other than `claude` CLI subprocess invocation (e.g. raw HTTP to Anthropic API) → halt Phase 1, surface to maintainer (this would invalidate the entire ToS-safety premise).
7. §1.7 forward+backward.

**Estimated effort:** ~80-110k Opus (round-4: removed «source-find for 15 June» now that Pre-A confirmed it; added `total_cost_usd` measurement; net similar).

### Phase 1 — Sub-wave B — `RuntimeBackend` interface + `AifHandoffBackend` + `ManualBackend` + hook

**Output:** code under `packages/runtime-bridge/` + paired-negative tests. Package name `runtime-bridge` (NOT `aif-handoff-bridge`) — round-4 reflects multi-backend architecture.

**Workspace init (load-bearing pre-step before any source file):** `packages/runtime-bridge/` does not exist yet. Initialise as a proper workspace package — minimum `package.json` (name `@rules-as-tests-aif/runtime-bridge`, private:true, type:module), `tsconfig.json` extending root, and entry in the root workspace array. Without this, source files won't be in CI scope and will silently bypass typecheck / principle tests. Verify via `npm install` and `npm run typecheck` from repo root before any further work.

**Must cover:**

1. **`RuntimeBackend` interface** as specified in §3 «Shared component spec» above. Strict TypeScript, no `any`. Export from package root.
2. **`ManualBackend` impl** (always-present default, ~20-30 LOC bash + 30-50 LOC TS):
   - `dispatch`: copies kickoff to `/tmp/runtime-bridge-<task-id>.md`, prints stderr copy-paste instructions, returns handle
   - `getStatus`: checks response file existence
   - `awaitDone`: polls every 30s, returns content when found, no MVP timeout
   - **Verified by paired-negative test: works on machines where neither aif-handoff nor amux is installed.**
3. **`AifHandoffBackend` impl:**
   - `available()`: probes aif-handoff coordinator via cheap reachability check (e.g. `curl --connect-timeout 1` against the MCP server endpoint)
   - `dispatch`: invokes aif-handoff MCP `handoff_create_task` with kickoff content
   - **Planner-skip — REQUIRED, not optional.** Without it, aif-handoff's Planner re-derives sub-wave sequencing and silently displaces `/meta-orchestrator`'s Middle-layer ordering. PLAN.md writer = pure transcription of meta-orch's sub-wave sequence; no value-add transformation.
     - **ROUND-7 UPDATE (2026-05-30, post-SW-B):** the assumed `accept_existing_plan` knob **does NOT exist** in aif-handoff's MCP surface (SW-B Worker verified via `gh api repos/lee-to/aif-handoff/contents/packages/mcp/src/tools/createTask.ts` + sibling tools). **Actual workaround shipped in `packages/runtime-bridge/src/AifHandoffBackend.ts` (PR #290):** `handoff_create_task(paused:true, plannerMode:"fast")` + `pushPlan` (transcribe meta-orch sequence) + `resume`. This achieves planner-skip without the non-existent flag. Phase 2 SW-F (amux) and any future aif-handoff version-bump must re-verify this workaround still holds.
     - If the planner-skip workaround becomes technically infeasible at evaluation time (blocker (i) PLAN.md disk coupling) → **STOP and escalate** as DECISION-NEEDED. Do NOT bypass by silently letting Planner re-plan.
   - **MCP schema discovery (NC-1, round-6 amendment):** kickoff does NOT inline the `handoff_create_task` / `accept_existing_plan` MCP call shape. Worker MUST first fetch aif-handoff MCP tool schema BEFORE implementing — either via `gh api repos/lee-to/aif-handoff/contents/packages/coordinator/src/mcp/` to read source, or via DeepWiki `ask_question` (≥3 phrasings) on `lee-to/aif-handoff` for the tool list + arg shape. Discover whether `accept_existing_plan` is (a) a separate MCP tool, (b) a flag on `handoff_create_task`, (c) something else entirely. Document findings in §<N> of the patch + cite file:line. If schema differs from kickoff assumption (e.g. no `accept_existing_plan` equivalent exists) → STOP and escalate as DECISION-NEEDED, do NOT improvise.
   - `getStatus` / `awaitDone`: bridged to SW-C (WebSocket status read-back); MVP can return `pending` placeholder until SW-C lands
4. **Preference resolver** at orchestrator startup: probes both backends, picks first available in order `[aif-handoff, amux, manual]`. Reads `RUNTIME_BRIDGE_MODE` env override. ManualBackend is the always-tail entry — never excluded.
5. **PostToolUse hook** (`.claude/hooks/runtime-bridge-dispatch.sh`) path-scoped to `.claude/orchestrator-prompts/*-meta-launch/kickoff.md` Write events:
   - Reads the just-written kickoff.md
   - Checks for `<!-- bridge: skip -->` first-line marker → if present, no-op (manual paste only)
   - Otherwise calls preference resolver → invokes `dispatch()` on active backend
   - On `quota_exceeded` / `unavailable` exception → silently falls back to ManualBackend + stderr warning
   - **Do NOT edit `.claude/settings.json` (NC-3, round-6 amendment):** settings.json is agent-self-protected per `settings_json_agent_uncommittable` memory — the harness deny-list will block any Write/Edit. Worker MUST output the required `PostToolUse` JSON entry snippet in the PR body (under «Maintainer apply manually» section) for maintainer-applied wire-in; do NOT attempt to write settings.json.
6. Idempotency: hook MUST NOT create duplicate tasks on file re-edit (debounce by content hash or umbrella name).
7. Paired-negative tests:
   - Hook fires on real meta-launch kickoff.md write ✓
   - Hook does NOT fire on arbitrary file write ✓
   - Hook handles aif-handoff-unreachable → falls back to ManualBackend ✓
   - `RUNTIME_BRIDGE_MODE=manual` forces ManualBackend even if aif-handoff installed ✓
   - `<!-- bridge: skip -->` marker forces ManualBackend per-task ✓
8. §1.7 forward+backward.

**Estimated effort:** ~110-140k Opus (round-4: +interface abstraction + ManualBackend impl + 2 extra paired-negative tests; heaviest sub-wave).

### Phase 1 — Sub-wave C — aif-handoff WebSocket status read-back

**Output:** code under same adapter dir (`AifHandoffBackend.getStatus` + `awaitDone` real impl, replacing SW-B's placeholder) + paired-negative test.

**Must cover:**

1. WebSocket consumer that connects to aif-handoff's status event stream.
2. **Client-side filter by taskId-in-payload** (NOT server-side topic subscription — predecessor SW-A CONFIRMED absent). Per-meta-launch-kickoff filter so multiple in-flight umbrellas don't cross-contaminate.
3. Status events transform into state.md updates (umbrella state.md §5 Handoff state row).
4. Termination conditions: task done / task error / aif-handoff disconnect / WebSocket reconnect logic.
5. Paired-negative test: events for our taskId → state.md updated; events for other taskIds → ignored; aif-handoff disconnect → state.md notes the disconnection AND `awaitDone` returns a graceful error (NOT silent drop).
6. **Bridge-discipline test:** if WebSocket connection drops mid-task, `AifHandoffBackend.awaitDone` raises `unavailable` → preference resolver falls back to `ManualBackend.awaitDone` semantics (prompts user to manually check task in aif-handoff UI + paste response).
7. §1.7 forward+backward.

**Estimated effort:** ~70-90k Opus (unchanged from round-3).

### Phase 1 — Sub-wave D — Setup script (aif-handoff/skip) + runtime opt-out + consumer docs

**Output:** setup script (~30-60 LOC bash) + `docs/runtime-bridge-setup.md` consumer-facing guide. **Phase 1 scope only:** aif-handoff/skip 2-way choice. amux added in Phase 2 SW-H, not here.

**Must cover:**

1. **Setup script (interactive)** — first-run:
   - Probes for aif-handoff (Docker compose reachable? MCP server live?)
   - Asks consumer: «Install aif-handoff bridge? [y/N — default N = manual paste mode]»
   - If yes: walks through Docker compose + MCP server setup; wires hook into `.claude/settings.json` PostToolUse entry; sets `RUNTIME_BRIDGE_MODE=auto` in consumer's shell config
   - If no: prints copy-paste instructions for `<!-- bridge: skip -->` marker; sets nothing (default = ManualBackend always)
2. **Required runtime profile + env configuration on aif-handoff side** (load-bearing for cost-safety):
   - **Transport:** consumer MUST set `transport: "cli"` in aif-handoff Claude runtime profile. CLI is NOT default per `packages/runtime/src/adapters/claude/index.ts:449`. Setup script verifies post-config via `aif-handoff config show` or equivalent.
   - **Auto-review strategy:** `AGENT_AUTO_REVIEW_STRATEGY=closure_first` per maintainer's layered design + `reviewer-discipline.md §2` alignment.
3. **Runtime opt-out spec (MUST be documented in setup guide):**
   - Env var `RUNTIME_BRIDGE_MODE`: `auto` (default) / `manual` (force ManualBackend) / `aif-handoff` (force aif-handoff or fail) — `amux` value reserved for Phase 2
   - Per-task `<!-- bridge: skip -->` first-line marker in any kickoff.md → ManualBackend even when bridge is active
   - Auto-fallback to ManualBackend on any backend exception — documented as expected behaviour, not a bug
4. **Cost-cap consumer warning:** setup guide MUST include a prominent box:
   > «After 2026-06-15, `claude -p` (and therefore aif-handoff CLI transport) draws from a separate monthly Agent SDK credit ($100 on Max 5x / $200 on Max 20x / $20 on Pro). Monitor your usage via `/usage` or [Anthropic billing dashboard]. If your monthly use exceeds the credit cap, the bridge will auto-fall-back to ManualBackend until the credit refreshes.»
5. **Step 3a — `manualReviewRequired` probe (load-bearing, blocks Steps 3b/3c):** verify whether the flag BLOCKS aif-handoff autoMode pipeline OR is non-blocking. Evidence channels: DeepWiki (≥3 phrasings) + read source for Reviewer state-transition code (file:line).
6. **Step 3b — Non-blocking path (primary if probe confirms):** document batch-review pattern: maintainer periodically opens fresh CC session, invokes Superpowers `brainstorming`, walks accumulated `manualReviewRequired` queue, answers in batch. Cite filter command/UI.
7. **Step 3c — Blocking path (fallback, only if hypothesis falsified):** surface as DECISION-NEEDED for a separate umbrella (notification channel: Telegram / mobile push / email / pushover). Phase 1 SW-D does NOT design this; surfaces only.
8. Integration test against a real aif-handoff instance if maintainer-machine accessible at dispatch time.
9. §1.7 forward+backward.

**Estimated effort:** ~50-70k Opus (unchanged from round-3; scope narrowed — no amux in Phase 1).

### Phase 1 → Phase 2 decision point

After SW-D merges, this kickoff is paused pending maintainer measurement data. Maintainer is expected to:
1. Use the bridge in real autonomous work for ~1-2 weeks
2. Capture `total_cost_usd` per task (SW-A measurement + ongoing real usage)
3. Note any aif-handoff outages or UX problems
4. Decide which Phase 2 branch fires:
   - **Branch a (skip Phase 2):** aif-handoff covers reliably + cost fits. Close umbrella as Phase 1-only success.
   - **Branch b (build Phase 2):** real cost ceiling hit OR aif-handoff outages annoy → dispatch SW-E onward.
   - **Branch c (abandon):** bridge UX bad / data shows manual paste is actually cheaper net-of-bridge-overhead → close umbrella; keep ManualBackend as standalone improvement.

### Phase 2 (CONDITIONAL — only fires if Phase 1 decision = Branch b)

Reuses Phase 1's `RuntimeBackend` interface verbatim. No rework on aif-handoff / Manual impls.

#### Phase 2 — Sub-wave E — amux transport verify + T16 ~55% confirmation + cost measurement

**Output:** `docs/meta-factory/research-patches/<date>-amux-transport-verification.md` + measurement appendix.

**Must cover:**

1. Read amux source (`mixpeek/amux`) to find the `claude` subprocess invocation. Confirm OAuth-first authentication (Pre-A claim) by reading the actual code path that resolves `ANTHROPIC_API_KEY` vs OAuth token.
2. T16 problem-class match — Pre-A estimated ~55%; SW-E independently confirms by reading the actual REST API surface, session model, status event shape. If T16 < 40% after deeper read → STOP, surface as DECISION-NEEDED (amux may not be a real fit).
3. `total_cost_usd` measurement for one realistic task through amux's `claude -p` path. Compare to SW-A's aif-handoff measurement.
4. STOP condition: amux not in npm/PyPI / unmaintained / no community support → halt Phase 2, surface to maintainer.
5. §1.7 forward+backward.

**Estimated effort:** ~70-100k Opus.

#### Phase 2 — Sub-wave F — `AmuxBackend` impl of `RuntimeBackend`

**Output:** code under `packages/runtime-bridge/` extending Phase 1 with `AmuxBackend` class.

**Must cover:**

1. `available()`: probes amux REST endpoint reachability
2. `dispatch`: `POST /api/sessions` with kickoff body (or equivalent — depends on actual API surface from SW-E)
3. `getStatus` / `awaitDone`: bridged to SW-G (SSE/REST status read-back)
4. **Update preference resolver:** add amux to preference order `[aif-handoff, amux, manual]`. Round-4 envisions aif-handoff preferred when both available (maintainer 2026-05-29: «когда есть aif-handoff используем его»). Add `RUNTIME_BRIDGE_MODE=amux` enum option.
5. Paired-negative tests parallel to SW-B's aif-handoff tests, but for amux.
6. §1.7 forward+backward.

**Estimated effort:** ~80-110k Opus.

#### Phase 2 — Sub-wave G — amux REST/SSE status read-back

**Output:** code under same adapter dir; `AmuxBackend.getStatus` + `awaitDone` real impl.

**Must cover:**

1. SSE stream consumer for amux's `GET /api/events` (or polling `GET /api/sessions/:name/meta` if SSE unsupported)
2. Per-session filter (analogous to SW-C's taskId-in-payload pattern for aif-handoff)
3. state.md updates parallel to SW-C
4. Paired-negative tests; bridge-discipline test (amux disconnect → graceful manual fallback)
5. §1.7 forward+backward.

**Estimated effort:** ~60-80k Opus.

#### Phase 2 — Sub-wave H — Setup script expanded to 3-way choice + preference order config

**Output:** updated setup script + updated consumer docs.

**Must cover:**

1. Setup script now prompts: «Install bridge backend? [aif-handoff / amux / skip — default skip]»
2. If both already installed: setup script asks preference order (default: aif-handoff > amux per maintainer)
3. Update env var values to include `amux`: `RUNTIME_BRIDGE_MODE` ∈ `{auto, manual, aif-handoff, amux}`
4. Update cost-cap warning: now mentions BOTH backends share the same Agent SDK credit pool
5. Update `<!-- bridge: skip -->` documentation to explain per-task opt-out
6. Integration test against both backends if available
7. §1.7 forward+backward.

**Estimated effort:** ~40-60k Opus (smaller — extending existing setup, not rebuilding).

### Phase -1 cold-reviews (mandatory between stages)

**Phase 1:**
- **Admission (after round-4 kickoff drafts):** 1× Opus reviewer on this round-4 hybrid restructure before any Phase 1 sub-wave dispatch.
- **Sub-wave A → Sub-wave B (or STOP):** 1× Opus, especially if SW-A `total_cost_usd` measurement comes in surprisingly high.
- **Sub-waves B + C merged → Sub-wave D:** 1× Opus.
- **Sub-wave D merged → Phase 1 decision point:** 1× Opus (verifies end-to-end Phase 1 integration spec + maintainer decision-point readiness).

**Phase 2 (conditional):**
- **Phase 2 dispatch admission:** 1× Opus on maintainer's Phase-1-data-driven decision rationale before SW-E.
- **Sub-wave E → Sub-wave F:** 1× Opus.
- **Sub-waves F + G merged → Sub-wave H:** 1× Opus.
- **Sub-wave H merged → umbrella close:** 1× Opus.

### Honest umbrella cost estimate (round-4)

**Phase 1 (committed):**
- Pre-A (already spent): **171k Opus** (sunk cost, PR #286 merged 2026-05-29)
- Remaining Workers (A+B+C+D): **310-410k Opus** (A 80-110k + B 110-140k + C 70-90k + D 50-70k)
- Phase -1 cold-reviews (4× rounds 4..N): **150-300k Opus**
- Orchestrator sessions (2-3): **40-80k Opus**
- **Phase 1 total: ~671-961k Opus including Pre-A; ~500-790k Opus remaining**

**Phase 2 (conditional — only if Phase 1 decision = Branch b):**
- Workers: **250-350k Opus** (E 70-100k + F 80-110k + G 60-80k + H 40-60k)
- Phase -1 cold-reviews (4×): **150-300k Opus**
- Orchestrator sessions (1-2): **30-60k Opus**
- **Phase 2 total: ~430-710k Opus (IF triggered)**

**Combined umbrella (if both phases land): ~920-1500k Opus.** Phase 1-only path (most likely): ~490-790k Opus → working aif-handoff bridge + ManualBackend.

Cost variance drivers: (a) REVISE rounds on Phase -1 amendments, (b) paired-negative test depth, (c) `total_cost_usd` measurement in SW-A may consume real-money credit pool if maintainer is past 2026-06-15 at dispatch time (small — ~$1-3 per measurement task).

---

## §4 Stage gates (real `gh` commands, not prose)

Per [SKILL.md §6](../../../.claude/skills/pipeline/SKILL.md). Self-setup convention applies (each Worker creates own worktree). Branch names reflect round-4 package rename (`runtime-bridge`, not `aif-handoff-bridge`).

### Phase 1

**Pre-A → A admission (Pre-A DONE 2026-05-29 PR #286):**
```bash
gh pr view 286 --repo Yhooi2/rules-as-tests-aif --json state --jq '.state'
# Must return "MERGED". Round-4 cold-review B1 fix: auto-merge was off on Pre-A PR; orchestrator manually merged 2026-05-29 after round-4 GO so pre-flight `git ls-tree origin/staging` probe in §3 will find the Pre-A patch.
git ls-tree origin/staging docs/meta-factory/research-patches/ | grep -q superpowers-reuse-audit
# Must return exit 0. If empty → re-fetch origin/staging; if still empty → halt + escalate.
```

**A → B admission:**
```bash
gh pr list --search "is:merged head:research/aif-handoff-cli-transport-verification base:staging" --json number,title --limit 5
```
Must return ≥1.

**B + C → D admission** (2 separate calls):
```bash
gh pr list --search "is:merged head:feat/runtime-bridge-adapter base:staging" --json number,title --limit 5
gh pr list --search "is:merged head:feat/runtime-bridge-status-readback base:staging" --json number,title --limit 5
```
BOTH must return ≥1.

**D → Phase 1 decision point admission:**
```bash
gh pr list --search "is:merged head:feat/runtime-bridge-setup base:staging" --json number,title --limit 5
```
Must return ≥1.

### Phase 2 (conditional — maintainer must explicitly authorise Phase 2 dispatch after Phase 1 decision)

**E → F admission:**
```bash
gh pr list --search "is:merged head:research/amux-transport-verification base:staging" --json number,title --limit 5
```
Must return ≥1.

**F + G → H admission** (2 separate calls):
```bash
gh pr list --search "is:merged head:feat/runtime-bridge-amux-adapter base:staging" --json number,title --limit 5
gh pr list --search "is:merged head:feat/runtime-bridge-amux-status-readback base:staging" --json number,title --limit 5
```
BOTH must return ≥1.

**H → close admission:**
```bash
gh pr list --search "is:merged head:feat/runtime-bridge-setup-3way base:staging" --json number,title --limit 5
```
Must return ≥1.

---

## §5 AI-traps active

Per [.claude/rules/ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md).

**Standard catalogue (from §2):**

- **T1** — sampling floor ≥5 per negative-existence claim. Especially for Sub-wave Pre-A («Superpowers does NOT cover X»).
- **T3** — every finding has file:line / command output / fetched URL.
- **T7** — adversarial counter-prompts on negative-existence (especially Sub-wave A: «`claude -p` is NOT in cli.ts» — must verify by reading the actual command builder).
- **T11** — search for prior bridge implementations BEFORE designing our own (Sub-wave Pre-A is partially this).
- **T12** — DeepWiki/WebFetch at R-phase time, not training-data recall.
- **T13** — re-verify ADOPTED items.
- **T15** — recursive self-application: this kickoff itself, each Sub-wave patch.
- **T16** — explicit problem-class match per Superpowers skill (Pre-A) + per aif-handoff invocation (A).
- **T17** — destructive delegation: this is I-phase = WRITES CODE. Preservation discipline applies before any rewrite.
- **T19** — cold-QA before handoff.
- **T20** — verdict + SSOT + evidence + falsifier co-located.

**Domain-specific traps (NEW for this umbrella):**

- **T-AIF-BRIDGE-IP-1** — «CLI transport assumed = subscription» without verifying THE SPECIFIC INVOCATION. Counter: Sub-wave A reads cli.ts command builder explicitly.
- **T-AIF-BRIDGE-IP-2** — «aif-handoff MCP server always reachable». Counter: Sub-wave B's hook MUST handle unreachable gracefully (opt-in design).
- **T-AIF-BRIDGE-IP-3** — «WebSocket events are always taskId-tagged». Counter: Sub-wave C must read aif-handoff WebSocket schema first; if untagged, the filter strategy changes.
- **T-AIF-BRIDGE-IP-4** — «`AGENT_AUTO_REVIEW_STRATEGY=closure_first` solves reviewer-discipline.md §2». Counter: Sub-wave D explicit walk-through of how `manualReviewRequired=true` escalation maps to our Phase -1 discipline; verify aif-handoff actually surfaces this clearly.
- **T-AIF-BRIDGE-IP-5** — «aif-handoff Setup is trivial because it's a companion». Counter: Sub-wave D documents the actual Docker compose check + auth flow + first-time integration test; don't assume.

---

## §6 Recursive self-application

This umbrella respects:

- **`build-first-reuse-default.md`:** Sub-wave Pre-A is the explicit re-use audit (Superpowers); BUILD only follows if Pre-A verdict confirms gap.
- **`no-paid-llm-in-ci.md`:** Sub-wave A explicitly verifies CC subscription stays applicable; STOP-condition if not.
- **`reviewer-discipline.md §2`:** layered design (maintainer plans → /meta-orch validates → aif-handoff executes under closure_first + manualReviewRequired escalation) preserves strategy-fork-surface at maintainer level.
- **DECISION=C:** adapter is opt-in for consumers; substrate gains NO new direct dependency on aif-handoff.
- **CLAUDE.md `PR strategy`:** each Sub-wave is one atomic PR within umbrella scope; no drive-by.

---

## §7 Stop conditions per stage

- **Sub-wave Pre-A STOP:** if Superpowers audit reveals ≥2 of Sub-wave A/B/C/D scope already covered by Superpowers → restructure umbrella (de-scope, possibly close as REJECT-with-redirect).
- **Sub-wave A STOP:** if cli.ts uses `claude -p` AND 15-June impact is metered AND maintainer didn't pre-approve API path → halt Sub-wave B/C/D, surface verdict «requires API path → out of opt-in DECISION=C scope without explicit re-approval».
- **Sub-wave B STOP:** if MCP `handoff_create_task` schema requires non-trivial restructuring of our kickoff format → halt, surface as DECISION-NEEDED (reshape kickoff format vs build pre-processor).
- **Sub-wave C STOP:** WebSocket lacks **server-side topic subscription** (CONFIRMED by predecessor SW-A: broadcast-channel pattern, no topic-filter API). taskId IS present in event payloads — implementation MUST use **client-side filtering by taskId-in-payload** as the standard pattern. STOP fires if EITHER (a) client-side filter proves insufficient at expected event volume / cross-task ID collisions, OR (b) event payloads omit taskId entirely (re-verify Worker's reading of the schema) → fallback to API polling; if API polling rate-limit too tight → halt, surface as DECISION-NEEDED.
- **Sub-wave D STOP:** if first integration test fails repeatedly → halt, surface to maintainer (likely Docker / auth env mismatch).

---

## §8 Anti-scope

- Do NOT modify our `/meta-orchestrator` skill substantially (the adapter is BELOW that; meta-orchestrator stays unchanged).
- Do NOT modify aif-handoff upstream (no PRs to `lee-to/aif-handoff`; adapter is on OUR side).
- Do NOT add npm deps to substrate (`packages/core/`). Adapter dependencies (if any) live in `packages/runtime-bridge/`.
- Do NOT autonomously install aif-handoff for the user. Setup script DETECTS, doesn't INSTALL.
- Do NOT skip Sub-wave Pre-A audit. Maintainer explicit directive: «только если в суперпауерс нет уже альтернативы готовой».
- Do NOT implement aif-handoff Planner or Reviewer logic on our side. PLAN.md writer = pure transcription of meta-orch sub-wave sequence to disk; no value-add transformation, no enrichment, no re-derivation.
- Do NOT build a multi-task lifecycle manager. Adapter handles ONE task per meta-launch kickoff Write event; multi-task orchestration stays in aif-handoff's native Kanban.
- Do NOT build a sophisticated state.md updater. Sub-wave C is append-only — adds status events to the existing state.md format; no schema changes, no re-derivation logic.
- Do NOT build a rich aif-handoff client. Reachability probe = `curl --connect-timeout 1` or equivalent capability-check; nothing more. Health monitoring, retry/backoff, auth refresh — anti-scope for THIS umbrella.

---

## §9 Output spec

Each Sub-wave produces:
- (Pre-A, A): markdown research-patch under `docs/meta-factory/research-patches/2026-05-XX-...md`.
- (B, C, D): code under `packages/runtime-bridge/` + tests + (D only) consumer-facing setup guide.
- All Sub-waves: §1.7 PR-body discipline per meta-launch §4b (H3 + «applied» + ≥40 chars + file:line) OR `§1.7 Skipped:` if mechanical-only.

PRs titled per Sub-wave pattern: `(Pre-A) research(superpowers-reuse): …` / `(A) research(aif-handoff-cli-verify): …` / `(B/C/D) feat(runtime-bridge): Sub-wave X — …` / `(E) research(amux-transport-verify): …` / `(F/G/H) feat(runtime-bridge): Phase 2 Sub-wave X — …`.

Base branch: `staging`. Auto-merge via established pattern (`project_automerge_staging_plan`).

**Capability-commit `Prior-art:` trailer (MANDATORY for SW-B/C/D):** any commit adding ≥80 LOC under `packages/runtime-bridge/` is a capability commit per `CLAUDE.md` §«What is a capability commit?» definition (and is also matched by `.husky/pre-push` regex). Each such commit MUST carry a `Prior-art:` trailer in the commit body that cites:
- Relevant SSOT rows from `docs/meta-factory/prior-art-evaluations.md` — at minimum #27/#28/#30/#44/#67/#84 (predecessor R-phase populated these with aif-handoff + companion vocabulary verdicts). Add new rows if SW-Pre-A surfaces additional unregistered precedents.
- The §1 verdict-reversal premise (cite this kickoff path).
- SW-Pre-A findings (cite the research-patch path for whichever SP/companion verdicts shaped the BUILD scope).

Pre-push hook will block commits missing this trailer. Workers must include it inline (not as a follow-up amend).

---

## §10 §1.7 forward + backward check on THIS kickoff

### Forward (does this kickoff comply with existing disciplines?)

- **`build-first-reuse-default.md`:** Sub-wave Pre-A is the explicit BFR-default §3 re-use audit; BUILD scope contingent on Pre-A verdict. ✓
- **`no-paid-llm-in-ci.md`:** Sub-wave A explicitly probes CC subscription stays applicable; STOP condition if metered. ✓
- **`reviewer-discipline.md §2`:** layered design preserves strategy-fork-surface at maintainer level via aif-handoff's `manualReviewRequired=true` flag + `closure_first` strategy. ✓
- **`phase-research-coverage.md §1.7`:** this §10 is the self-reflexive walk. ✓
- **`ai-laziness-traps.md §3`:** §5 above enumerates 11 standard T-numbers + 5 domain-specific T-AIF-BRIDGE-IP-{1..5}. ✓
- **`doc-authority-hierarchy.md §3`:** header carries Status + Authoritative-for + NOT authoritative-for. ✓ (Class N/A — kickoff per filename-convention authority.)
- **`dual-implementation-discipline.md §2`:** kickoff is markdown-only artefact carve-out. **Round-4 NEW:** the `RuntimeBackend` abstraction IS a dual-implementation by design (aif-handoff + amux backends behind a shared interface) — §7 of `dual-implementation-discipline.md` («single source of truth: one logic, two channels») applies directly. SW-B's `RuntimeBackend.ts` IS the SSOT spec; SW-F's `AmuxBackend` consumes it; both backends share `@dual-pair:` markers per §5 of the rule. Recursive self-application: hybrid bridge dogfoods the same rule it's structured by. ✓
- **DECISION=C invariant:** §8 hard-codes substrate-dependency-free; adapter opt-in for consumers. ✓
- **CLAUDE.md `PR strategy`:** atomic per Sub-wave; no drive-by outside umbrella scope. ✓
- **Self-setup convention (Decision 13 of predecessor):** §3 + §9 explicitly invoke it for sub-wave dispatches. ✓

### Backward (what existing artefacts does this kickoff's framing affect?)

- **Predecessor umbrella `aif-handoff-as-runtime-bridge`** — DONE 2026-05-29 verdict DEFER ALL. This umbrella REVERSES that verdict based on 2 new load-bearing facts; predecessor's research-patches remain valid evidence and are explicitly cited. No silent supersession.
- **SSOT #27/#28/#30/#44/#67 + slot #84** — predecessor proposed additive notes (not landed). This umbrella's Sub-wave D output may land additive notes for these rows; verdict changes to existing rows = NO.
- **`reviewer-discipline.md §2`** — interpretation refined: «autoMode is OK when convergence-aware + `manualReviewRequired` escalates». Not a rule change; an applied interpretation. May surface as candidate clarification to §2.
- **`build-first-reuse-default.md`** — verdict ladder applied: Pre-A REFERENCE-vs-ADAPT decision per skill; B/C/D = ADAPT (small wrapper poверх aif-handoff existing API).
- **No `.claude/rules/*` modified** by this kickoff. No principle test modified. No skill modified outside skill-context override pattern.
- **NEW artefacts** created by SW-B and SW-D (acknowledged in round-4 backward check per round-4 cold-review mn3): (a) `.claude/hooks/runtime-bridge-dispatch.sh` — new PostToolUse hook; (b) `.claude/settings.json` PostToolUse entry — maintainer-applied per `settings_json_agent_uncommittable` memory; (c) `packages/runtime-bridge/` — new workspace package; (d) `docs/runtime-bridge-setup.md` — consumer-facing setup guide. None of these existed pre-umbrella; SW-B's workspace-init step + SW-D's setup-script wire-in are the moments they materialise.

### Self-reflexive (T15)

- T1 sampling floor: meta-artefact, sampling delegated to Sub-waves. ✓
- T3 file:line evidence: §1 cites README quote + commit IDs; §2 cites PR #283; §3 cites prior research-patches by filename. ✓
- T7 adversarial counter-prompt: §1 cites 2 load-bearing facts that REVERSE prior verdict; explicitly framed as «what new evidence emerged». ✓
- T11 prior-art search: explicit Sub-wave Pre-A consumes the work. ✓
- T15 self-application: §10 self-walked. ✓
- T16 problem-class: §3 Sub-waves Pre-A and A both have T16 requirements. ✓
- T20 inline-verdict: NO verdict in this kickoff. Outputs scope + admission gates + sub-wave breakdown. ✓ (Verdict per Sub-wave landed by their respective patches.)

---

## §11 See also

- [`.claude/orchestrator-prompts/aif-handoff-as-runtime-bridge/kickoff.md`](../aif-handoff-as-runtime-bridge/kickoff.md) — predecessor R-phase umbrella (DEFER ALL verdict)
- [`docs/meta-factory/research-patches/2026-05-29-aif-handoff-bridge-{variant-a-mcp,variant-b-watcher,variant-b-prime-hybrid,variant-c-minimal,synthesis}.md`](../../../docs/meta-factory/research-patches/) — all 5 predecessor R-phase patches
- [`docs/meta-factory/research-patches/2026-05-29-superpowers-reuse-audit-for-runtime-bridge.md`](../../../docs/meta-factory/research-patches/2026-05-29-superpowers-reuse-audit-for-runtime-bridge.md) — Pre-A research-patch (PR #286, load-bearing for round-4 hybrid restructure)
- [`.claude/orchestrator-prompts/aif-handoff-as-runtime-bridge-meta-launch/state.md`](../aif-handoff-as-runtime-bridge-meta-launch/state.md) — predecessor state.md (Decisions 8-15, observations Obs-7..9)
- [`docs/meta-factory/prior-art-evaluations.md`](../../../docs/meta-factory/prior-art-evaluations.md) — SSOT rows #27/#28/#30/#44/#67 + slot #84 + #85 (amux, proposed by Pre-A)
- [`.claude/skills/meta-orchestrator/SKILL.md`](../../../.claude/skills/pipeline/SKILL.md) — `/meta-orchestrator` skill, surfaces the dispatched-kickoff pattern this umbrella adapts
- [`.claude/rules/build-first-reuse-default.md`](../../../.claude/rules/build-first-reuse-default.md) — BFR §3 6-layer search (Sub-wave Pre-A implements; Phase 2 SW-E re-applies for amux)
- [`.claude/rules/no-paid-llm-in-ci.md`](../../../.claude/rules/no-paid-llm-in-ci.md) — Sub-wave A `total_cost_usd` measurement aligns
- [`.claude/rules/reviewer-discipline.md §2`](../../../.claude/rules/reviewer-discipline.md) — layered model preserves this discipline; brainstorm session 2026-05-29 walked it explicitly
- [`.claude/rules/dual-implementation-discipline.md`](../../../.claude/rules/dual-implementation-discipline.md) — `RuntimeBackend` abstraction is a dual-channel impl (aif-handoff + amux backends behind shared spec)
- [`lee-to/aif-handoff` README](https://github.com/lee-to/aif-handoff/blob/main/README.md) — CLI transport warning + AGENT_AUTO_REVIEW_STRATEGY docs
- [`code.claude.com/docs/en/headless`](https://code.claude.com/docs/en/headless) — June 15 Agent SDK credit pool Note box (load-bearing for §0 premise + SW-A cost measurement)
- [`support.claude.com/en/articles/15036540`](https://support.claude.com/en/articles/15036540) — Agent SDK credit amounts ($20/$100/$200) + post-depletion behaviour

---

## §12 Phase -1 amendments log (audit trail) — extracted

Moved verbatim to [kickoff-amendments.md](kickoff-amendments.md) (2026-08-08) to bring this file under the 600-line pre-commit gate. Audit trail unchanged there.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
