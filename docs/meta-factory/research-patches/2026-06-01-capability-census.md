<!-- scope:capability-census -->
# Capability census — full-population enumeration of Superset · aif-handoff · Claude Code native (agnostic lens)

> **Type:** R-phase (population-enumeration → funnel on high-value subset). Single Opus Mode-A session. NO adoption code (T5). Every candidate run through [`build-first-reuse-default.md §1.1`](../../../.claude/rules/build-first-reuse-default.md) criteria + the **agnostic resolution principle** (maintainer 2026-06-01): *use CC-native when present, own portable impl when absent, degrade gracefully — «как с хуком»* ([dual-implementation-discipline.md §3](../../../.claude/rules/dual-implementation-discipline.md)).
> **Date:** 2026-06-01.
> **Post-merge status note (added 2026-07-17, archival convention — the 2026-06-01 body below is NOT rewritten):** this census is a pre-resolution snapshot; several of its verdicts and one load-bearing premise are now historically stale — read the body as the research record, not current state. **(a) F2 premise SUPERSEDED:** §0 TL;DR (L18), §3 F2 (L110), and §10 (L239) assert «our runtime-bridge dispatch is currently broken» — PR #313 (REST dispatch + result read-back, merged 2026-05-31 20:14, ~9h BEFORE this census merged 2026-06-01 05:19) had already resolved it; the census relied on a memory note, not current staging. SSOT row #102 in `prior-art-evaluations.md` still carries the «currently broken» framing — a targeted SSOT correction is warranted. **(b) Verdicts since RESOLVED:** F1 (row #101, DECISION-NEEDED-1) — closed by PRs #331 (`inject-matching-rule.sh` reframed as portable fallback, `@dual-pair: rule-path-scoping`) + #593; #108 (orchestrator mechanical-gate hooks) — partially wired via #340 (`SubagentStart`/`SubagentStop` in settings.json). **(c) #328 miscite propagation:** §10.3/§10.7 flagged the «#85 = amux» miscitation; the correction path (accept SSOT #104 as correction) left the miscite in `2026-06-01-satellite-feature-harvest.md` (5 loci: L19/85/94/135/160) and in SSOT row #100 — these still read «amux (#85)». **(d) §10.3 self-contradiction:** §10.3 (L197) lists «census §2.1» among the miscite propagation sites, but §2.1 (L44) actually CONTAINS the correction («NOT #85 — #85 is pre-commit») — §2.1 is clean, not stale. The census body stays as the historical research record; live status of dispatch / F1 / #108 lives in the SSOT rows + the shipping PRs.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). The own-stack-first harvest — [`2026-06-01-satellite-feature-harvest.md`](2026-06-01-satellite-feature-harvest.md) (#328, owns SSOT #100). The companion×stage survey — [`2026-06-01-companion-capability-survey.md`](2026-06-01-companion-capability-survey.md). This patch EXTENDS both by closing the **population-enumeration gap** (T10) those efforts left open — they were incident-driven («found what was needed»), never exhaustive.

---

## §0 TL;DR

Origin: maintainer observed (2026-06-01) that the survey/harvest covered only a fraction of each product — **aif-handoff, Superset, and Claude Code native each had their full capability population never enumerated**. Root cause = `#population-not-enumerated` (T10): SSOT rows accreted opportunistically, never via «list the whole population → funnel each».

This patch enumerates the population (channel-1 minimum; dual-channel on every load-bearing verdict) and funnels the high-value subset under the agnostic principle. **Headline: two criterion-zero findings that hit live unsolved problems**, both dual-channel verified against `code.claude.com/docs`:

- **F1 — CC `paths:` frontmatter on `.claude/rules/*.md` is native path-scoped rule loading** → it is the CC-native counterpart of our own [`inject-matching-rule.sh`](../../../.claude/hooks/inject-matching-rule.sh) (rule-enforcement-channel-selection §4). Agnostic verdict: **ADAPT dual-channel** — `paths:` on CC, our hook as portable fallback for non-CC consumers.
- **F2 — CC Routines API-trigger (`/fire` HTTP endpoint)** → own-stack dispatch substrate; criterion-zero vs aif `API_RUNTIME_*` AND our **runtime-bridge dispatch, which is currently broken** (memory `runtime_bridge_mcp_dispatch_fix`). Agnostic verdict: **REFERENCE-now / re-evaluate ADOPT** for the operator dispatch path.

Population gap quantified: Superset SSOT had **3** rows for **~30** capabilities; CC had ~5 known hook-events vs **~29** documented; aif had ~13 point-rows vs ~7 packages + ~20 env-vars.

---

## §1 Scope + method

**Enumeration-first (T10 counter):** for each product, enumerate the full capability population from source BEFORE any verdict. Population recorded in §2 (channel-1 = DeepWiki minimum). The maintainer reviewed §2 for completeness before the funnel (this session, 2026-06-01).

**Funnel (per item):** (0) own-stack-first — does CC ship it? (1) surface-gate — named work-cycle point + materially better? (2) cost-gate (cheap=config/text → adopt-now; expensive=dep/≥50-80 LOC/standing infra → DEFER unless transformative); (3) **agnostic resolution** — CC-native-when-present + own-portable-when-absent + graceful degradation ([dual-implementation-discipline.md §3](../../../.claude/rules/dual-implementation-discipline.md)); two-axis (operator use-maximally / shipped agnostic).

**Dual-channel (no-loop guard):** every load-bearing verdict ≥2 sources. CC claims = primary `code.claude.com/docs` WebFetch + DeepWiki `anthropics/claude-code`. **Honesty flag:** the aif-handoff and Superset *population* (§2.1–§2.2) is **channel-1 (DeepWiki) only** — dual-channel is applied at the funnel stage for items that graduate to a verdict, NOT to every enumerated population line (would be `#always-on-bloat`). Population lines are inventory, not verdicts.

**Long-tail honesty (no silent truncation):** items that funnel to SKIP are recorded one-line in §5, not dropped.

---

## §2 Full-population census

Legend: **[S]** already in SSOT (row#) · **[N]** new (not previously enumerated) · **↔** own-stack/cross-product overlap.

### §2.1 Superset `superset-sh/superset` — orchestrator of CLI agents (channel-1: DeepWiki 2026-06-01)

| Capability | Status |
|---|---|
| Parallel execution (10+ agents) | [N] ↔ amux (§10.3; **NOT #85** — #85 is `pre-commit`, amux has no row pre-census), CC background agent-view #100 |
| Worktree isolation per task | [N] ↔ SSOT #65, our scripts/create-worktree.sh |
| Agent monitoring + attention notifications | [S] #98 (Slack notify) partial |
| Daemon session-persistence (survives crash/restart) | [N] — genuinely-new (we have none) |
| Universal compatibility (any terminal CLI agent) | [N] |
| MCP task-suite: `create_task`/`update_task`/`list_tasks`/`get_task`/`delete_task`/`list_task_statuses` | [N] ↔ aif Kanban #67, our runtime-bridge |
| MCP workspace-suite: `create`/`update`/`switch`/`delete`/`list`/`get_workspace_details` | [N] |
| MCP device/org: `list_devices`/`list_projects`/`get_app_context`/`list_members` | [S] #99 (list_devices) partial |
| MCP `start_agent_session{deviceId}` | [S] #99 |
| Inline prompts (pause/ask/approve/plan-review in chat) | [N] ↔ our `questions.ts`, aif `paused` |
| Sandbox-access prompts | [N] |
| Slash: `/new` `/clear` `/stop` `/model` `/login` `/mcp` `/review` | [N] |
| Slack-agent (`runSlackAgent`, Pro plan) | [S] #98 |
| Automations (RRule cron) | [S] #86 |
| Workspace presets (env-setup/dep-install automation) | [N] ↔ our install.sh, AIF scaffolding |
| Built-in diff viewer · IDE integration (VS Code/Cursor/JetBrains/Xcode) · Linear integration | [N] — UI, irrelevant to our headless substrate |

**Channel-1 caveat:** this DeepWiki pass reported «no Slack/Telegram» — contradicts #98 (Slack-agent verified via dedicated DeepWiki search 2026-06-01). Single-channel negative not trusted; dual-channel resolved #98 already.

### §2.2 aif-handoff `lee-to/aif-handoff` (channel-1: DeepWiki 2026-06-01)

| Capability | Status |
|---|---|
| Packages: `@aif/shared` `@aif/runtime` `@aif/data` `@aif/api` `@aif/web` `@aif/agent` `@aif/mcp` | [S] partial (#43/#44/#45) |
| Planner/Implementer/Reviewer pipeline (plan-/implement-coordinator + review-/security-sidecar) | [S] #30 partial |
| Convergence/auto-review loop (`AGENT_MAX_REVIEW_ITERATIONS`, `AGENT_AUTO_REVIEW_STRATEGY=closure_first`) | [S] #97 |
| Subagents-mode vs Skills-mode (`AGENT_USE_SUBAGENTS`) | [S] #46 |
| Paused/resume task semantics | [S] #28 |
| **`scheduledAt` task scheduling** | [N] ↔ CC Routines #100 |
| **`API_RUNTIME_*` one-shot dispatch** (`API_RUNTIME_START_TIMEOUT_MS`/`_RUN_TIMEOUT_MS`) | [N] ↔ **F2** CC Routines API-trigger + our runtime-bridge dispatch |
| Auto-Queue mode + pool depth (`COORDINATOR_MAX_CONCURRENT_TASKS`) | [S] #88 |
| Worktree/git isolation (`AIF_TASK_WORKTREES_ENABLED`) | [S] #65-adjacent |
| Roadmap Import (`.ai-factory/ROADMAP.md` bulk) | [N] |
| Plan annotation `<!-- handoff:task:<uuid> -->` | [S] #29 |
| Watchdog/timeout layer: `AGENT_STAGE_RUN_TIMEOUT_MS` `_STALE_TIMEOUT_MS` `_STALE_MAX_RETRY` `_QUERY_START_TIMEOUT_MS` `_FIRST_ACTIVITY_TIMEOUT_MS` + quarantine | [N] — robustness pattern, REFERENCE |
| `AGENT_BYPASS_PERMISSIONS` · `AIF_RUNTIME_SESSION_FORK_ENABLED` · `AIF_RUNTIME_OPENCODE_LONG_RUNNING_DISPATCHER_ENABLED` | [N] |
| Adapters: `ANTHROPIC_*` / `OPENAI_*` credentials | [N] config |

### §2.3 Claude Code native (dual-channel: primary `code.claude.com/docs` + DeepWiki 2026-06-01)

**Slash commands (~50, channel-1 + spot dual):** `/add-dir` `/bg` `/branch`(ex-`/fork`) `/clear` `/code-review`(`--fix`) `/commit*` `/compact` `/config` `/context` `/copy` `/doctor` `/effort` `/export` `/feature-dev` `/feedback` `/focus` `/goal` `/help` `/hookify` `/loop` `/login` `/memory` `/model` `/mcp` `/plugin` `/plan` `/recap` `/reload-skills` `/remote-control` `/rename` `/resume` `/rewind`(`/undo`) `/simplify` `/skills` `/status` `/teleport` `/theme` `/tui` `/usage` `/web-setup` `/workflows`. [N for most] — relevant: `/goal`↔our EOT, `/recap`↔EOT, `/hookify`, `/code-review --fix`, `/simplify`, `/workflows`.

**Hooks (~29 events, dual-channel `/en/hooks`):** SessionStart · Setup · UserPromptSubmit · UserPromptExpansion · PreToolUse · PermissionRequest · PermissionDenied · PostToolUse · PostToolUseFailure · PostToolBatch · Notification · MessageDisplay · SubagentStart · SubagentStop · TaskCreated · TaskCompleted · Stop · StopFailure · TeammateIdle · **InstructionsLoaded** · ConfigChange · CwdChanged · FileChanged · WorktreeCreate · WorktreeRemove · PreCompact · PostCompact · Elicitation · ElicitationResult · SessionEnd. [N] — prior SSOT/#100 knew ~5; **F1** (InstructionsLoaded) is the headline.

**Memory/rules surface (dual-channel `/en/memory`):** `.claude/rules/*.md` with **`paths:` frontmatter** (path-scoped, glob + brace-expansion) [N=**F1**] · `@path` imports (depth 4) · managed-policy CLAUDE.md + `claudeMd` settings key · `claudeMdExcludes` · `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD` · symlinked shared rules · auto-memory (`autoMemoryDirectory`, `autoMemoryEnabled`). [N]

**Scheduled/autonomous:** Routines (`/schedule`; Scheduled cron min-1h + **API `/fire`** + GitHub `pull_request.*`/`release.*`; research preview, daily cap, CLI v2.1.81) [S #100, **F2/F3**] · `/loop` · Desktop scheduled tasks.

**Parallel/agent:** subagents + `isolation:"worktree"` [S #20/#65] · background agents / agent-view (`/bg`) [S #100] · agent teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`) · git worktrees (`claude -w`).

**Work-from-anywhere:** Remote Control · Channels (Telegram/Discord/iMessage) · Slack · Web/iOS/`--teleport`/`/desktop`. [S #100]

---

## §3 High-value funnel findings (dual-channel verified) + agnostic verdict

### F1 — CC `paths:` frontmatter ↔ our `inject-matching-rule.sh` · verdict ADAPT dual-channel
**Evidence (dual-channel):** `/en/memory` — «Rules can be scoped to specific files using YAML frontmatter with the `paths` field. These conditional rules only apply when Claude is working with files matching the specified patterns» (glob table + `{ts,tsx}` brace-expansion); `/en/hooks` — `InstructionsLoaded` matcher `load_reason=path_glob_match` = «conditional rules with `paths:` frontmatter match».
**Our parallel:** [`inject-matching-rule.sh`](../../../.claude/hooks/inject-matching-rule.sh) (rule-enforcement-channel-selection §4, Class B) matches edited path against `<!-- globs: -->` marker → injects `<!-- inject: -->` summary as PostToolUse `additionalContext`.
**Problem-class match (T16):** upstream = load a path-scoped rule when working matching files; ours = same. **Match: yes.** Divergence: CC loads the *whole rule*; ours injects a *summary*, once/session, and is *portable* to non-CC harnesses.
**Refinement (verified in-repo):** `paths:` is **already dogfooded** — [`phase-research-coverage.md`](../../../.claude/rules/phase-research-coverage.md) uses it today («invoked at the surfaces declared in `paths:` above»). So F1 is NOT «discover `paths:` exists» — the repo already runs BOTH mechanisms **unreconciled** (native `paths:` on one rule + custom `<!-- globs: -->` hook on others). The finding is: **document them as the intended dual-pair** and converge the convention, not introduce a new one.
**Agnostic verdict (maintainer principle «как с хуком»):** **ADAPT dual-channel** — on CC, add `paths:` frontmatter to shipped rules (native, zero custom code); keep `inject-matching-rule.sh` as the portable fallback for Cursor/Aider/Codex consumers; shipped rules carry BOTH `paths:` + `<!-- globs: -->` (same path-scope, two channels, `@dual-pair` anchor per dual-implementation-discipline §5).
**Falsifier:** wrong if `paths:` semantics differ materially from our hook (e.g. fires on read not edit — docs say «when Claude reads files matching the pattern», so timing IS different: read-triggered vs our Edit/Write-triggered — note for the I-phase). → **DECISION-NEEDED-1** (own R-phase; touches live `.claude/hooks/` + the rule).

### F2 — CC Routines API-trigger (`/fire`) ↔ runtime-bridge dispatch + aif `API_RUNTIME_*` · verdict REFERENCE-now
**Evidence (dual-channel):** `/en/routines` — «An API trigger gives a routine a dedicated HTTP endpoint. POSTing to the endpoint with the routine's bearer token starts a new session»; `curl -X POST …/routines/<id>/fire -H "Authorization: Bearer …"`. Use-case «Alert triage … calls the routine's API endpoint».
**Our live problem:** runtime-bridge `dispatch()` is broken (memory `runtime_bridge_mcp_dispatch_fix`: «dispatch() в коде всё ещё сломан, no REST status-write»); aif ships `API_RUNTIME_*` one-shot dispatch as the same shape.
**Agnostic verdict:** **REFERENCE-now / ADOPT-when-needed (operator)** — Routines `/fire` is a working HTTP-dispatch substrate the maintainer already has on subscription; REFERENCE its shape for the runtime-bridge dispatch design instead of finishing the broken bespoke REST. Shipped-axis: DEFER (consumers without claude.ai subscription can't depend on `/fire`; our core stays agnostic). **Caveat:** research preview, daily cap, `experimental-cc-routine-2026-04-01` beta header may break. → **DECISION-NEEDED-2** (own R-phase; touches live runtime-bridge).

### F3 — CC Routines GitHub-trigger ↔ compliance-verifier / living-docs-auditor · verdict DEFER+trigger
**Evidence:** `/en/routines` GitHub trigger `pull_request.opened`; doc use-case «Bespoke code review … applies your team's own review checklist, leaves inline comments». Subscription-bundled = **no-paid-llm-in-ci clean** (not a `.github/workflows` API call).
**Agnostic verdict:** **DEFER+trigger** (operator) — the sanctioned no-paid-LLM path for automated semantic §1.7 / living-docs review; trigger = maintainer wants auto PR-review AND accepts research-preview cap. Matches harvest #328 table #5.

### F-bonus — CC config/memory surface (dual-channel `/en/memory`)
`claudeMd` settings key (org CLAUDE.md), `claudeMdExcludes` (monorepo ancestor skip), `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD`, `@path` imports, symlinked shared rules, `autoMemoryDirectory`. All [N], all **cheap** (config). Relevant to consumer install ergonomics — surface for install.sh design, not adopted here (T5).

---

## §4 Skip-log (honest long-tail, funnel→SKIP)

- **Superset UI** (diff viewer, IDE/Linear integration, tab/pane, themes, font picker, scrollback) — irrelevant to headless substrate.
- **Superset MCP workspace/task-suite** — overlaps aif Kanban #67 + our runtime-bridge; no own-stack gap forcing action; REFERENCE the schema (already #86 KEEP-NARROW).
- **aif watchdog/timeout env-vars** — robustness pattern; REFERENCE-only (we don't run aif's coordinator as our substrate).
- **CC slash `/theme` `/tui` `/scroll-speed` `/terminal-setup` `/focus` `/export` `/copy` `/feedback` `/doctor`** — convenience, no work-surface.
- **CC `/branch` `/effort` `/feature-dev` `/status` `/usage`** — useful-but-marginal, no criterion-zero.
- Daemon session-persistence (Superset), universal-compat — genuinely-new but no current pain (DEFER, no trigger named).

(Items already verdicted elsewhere — Superpowers vocab #92-#96, work-from-anywhere #100 — not re-derived; cited.)

---

## §5 SSOT additive rows (append-only; #100 reserved for #328)

> **#100 belongs to [#328](2026-06-01-satellite-feature-harvest.md).** This patch appends **#101–#103**. If #328 has not merged when this lands, a numbering gap at #100 is expected and resolves when #328 merges (monotonic preserved).

- **#101 — CC `paths:` frontmatter native path-scoped rule loading** (F1). Verdict **ADAPT** (dual-channel: CC-native `paths:` + our `inject-matching-rule.sh` portable fallback). Anchor: rule-enforcement-channel-selection §4. Trigger: I-phase to add `paths:` to shipped rules + reconcile read-vs-edit timing.
- **#102 — CC Routines API-trigger (`/fire`)** as HTTP dispatch substrate (F2). Verdict **REFERENCE** shipped / **ADOPT-when-needed** operator. Trigger: runtime-bridge dispatch rebuild OR research-preview exits.
- **#103 — CC config/memory surface** (`claudeMd`, `claudeMdExcludes`, `paths:`, `@imports`, `autoMemoryDirectory`) (F-bonus). Verdict **REFERENCE** for consumer install ergonomics.

---

## §6 §1.7 self-reflexive check

### §1.7 Forward-check applied
Complies with **build-first-reuse-default §1.1** (own-stack-first ran first; F1/F2 are CC-native-supersedes findings, not new builds) per [`.claude/rules/build-first-reuse-default.md:35`](../../../.claude/rules/build-first-reuse-default.md); **dual-implementation-discipline §3** (agnostic = CC-when-present + own-fallback — the F1 verdict is literally dual-channel) per [`.claude/rules/dual-implementation-discipline.md`](../../../.claude/rules/dual-implementation-discipline.md); **no-paid-llm-in-ci §2** (F3 = subscription-bundled, not API-billed; all research = WebFetch + DeepWiki) per [`.claude/rules/no-paid-llm-in-ci.md:17`](../../../.claude/rules/no-paid-llm-in-ci.md); **doc-authority-hierarchy** (scope-annotation first line + header) per [`.claude/rules/doc-authority-hierarchy.md:1`](../../../.claude/rules/doc-authority-hierarchy.md); **reviewer-discipline §2** (F1/F2 surfaced as DECISION-NEEDED, not decided) per [`.claude/rules/reviewer-discipline.md:1`](../../../.claude/rules/reviewer-discipline.md).

### §1.7 Backward-check applied
EXTENDS [`2026-06-01-satellite-feature-harvest.md`](2026-06-01-satellite-feature-harvest.md) (#328) and [`2026-06-01-companion-capability-survey.md`](2026-06-01-companion-capability-survey.md) by closing their T10 population-enumeration gap — both cited, neither superseded. SSOT #100 reserved for #328 (no collision); existing rows #28/#29/#30/#46/#65/#85/#86/#88/#97/#98/#99 cited, none edited. New rows #101-#103 append-only. No shipped artefact retired (T-SFH-D family): `inject-matching-rule.sh` KEPT as portable fallback (F1), `questions.ts` untouched.

---

## §7 T-trap audit (per `ai-laziness-traps.md §2`)

- **T1/T9** — full population enumerated (§2), not first-3-sampled; long tail recorded in §4 not dropped.
- **T3/T20** — every load-bearing verdict (F1/F2/F3) cites a primary-doc quote + a same-turn tool call; population channel-1 status honestly flagged (§1).
- **T5** — research only; sole writes = this patch + SSOT #101-#103 append. No `.claude/hooks/` or runtime-bridge edited.
- **T10** — population enumerated BEFORE funnel; in-SSOT vs new flagged per line.
- **T13/T16** — F1 problem-class match stated explicitly (read-trigger vs edit-trigger divergence noted, not hand-waved).
- **T-CENSUS-A (population-completeness theatre)** — counter: §2 lists ALL enumerated items incl. irrelevant UI, then §4 skip-logs them; completeness is by-enumeration not by-sampling.
- **T-CENSUS-B (channel-1 over-claim)** — counter: §1 + §2.1/§2.2 explicitly mark aif/Superset population as DeepWiki-only; dual-channel reserved for graduated verdicts (F1/F2/F3 = CC, dual-sourced).

---

## §8 T19 cold-QA self-pass

1. First line `<!-- scope:capability-census -->` → principle 10 PASS.
2. Load-bearing findings (F1/F2/F3) each ≥2 sources? F1 = `/en/memory` + `/en/hooks`; F2/F3 = `/en/routines` + use-case prose. PASS (CC). aif/Superset population = channel-1, flagged not-a-verdict. PASS.
3. Own-stack-first applied? F1/F2 ARE CC-native-supersedes findings. PASS.
4. Agnostic principle applied per finding? F1 dual-channel (CC + fallback), F2 REFERENCE-shipped/ADOPT-operator, F3 subscription-bundled. PASS.
5. SSOT append-only + #100 collision avoided? #101-#103, #100 reserved for #328. PASS.
6. Shipped artefact retired? No — `inject-matching-rule.sh` + `questions.ts` kept. PASS.
7. DECISION-NEEDED surfaced not decided? F1/F2 → own R-phase. PASS.
- **MINOR:** aif/Superset population is channel-1 (DeepWiki) only — any item graduating to a verdict needs dual-channel at its own funnel. Flagged, not hidden.

---

## §10 Wave-2 — all-companion census (autonomous, agnostic lens)

Maintainer-directed 2026-06-01: «автономно по всему пройтись по всем спутникам … знать свои инструменты и их преимущества чтобы работать эффективно». Parallel Mode-A research dispatch (4 Opus workers) → this synthesis. **Scope: Superset · Superpowers · AI Factory · amux · CC-native. OhMyOpencode + Cursor EXCLUDED per maintainer 2026-06-01.** Worker outputs are load-bearing-dual-channel per worker; **orchestrator spot-verified the #85 mis-citation (caught a propagated error, §10.3)**; remaining worker claims carry the workers' own single-channel flags. ADOPT-now items touching live code are surfaced as DECISION-NEEDED (T5 research-only; reviewer-discipline §2), not auto-applied.

### §10.1 Superset (`superset-sh/superset`) — expanded funnel (population §2.1)
Orchestrator-of-CLI-agents. **Standout advantages:** daemon session-persistence (survives crash/restart), MCP task+workspace suite (15+ tools), inline prompts (pause/approve/plan-review), multi-device `deviceId` routing.
- **CC-native-redundant (own-stack-first):** parallel-execution + worktree-isolation → CC `isolation:worktree`/agent-view (#100, #65); Slack/notify → CC Slack+Channels (#100); remote → CC Remote Control (#100).
- **Genuine residue (no CC/own equivalent):** daemon session-persistence (survives crash) — REFERENCE; MCP task/workspace-suite — KEEP-NARROW (↔ aif Kanban #67 + our runtime-bridge, three parallel impls); workspace-presets (env-setup automation) — REFERENCE (↔ install.sh). Inline-prompts ↔ our `questions.ts` (kept, #328 T-SFH-D). multi-device — DEFER (#99).
- **Verdict:** shipped-axis REJECT-substrate (can't hard-depend on Superset Pro); operator-axis = use what maintainer already runs; no new own-build. Already SSOT #86/#98/#99 — no new row needed; census §2.1 is the population record.

### §10.2 Superpowers (`obra/superpowers`) v5.1.0 — full skill enumeration
**14 installed skills form a COMPLETE dev-loop** (brainstorm→plan→worktree→SDD/execute→TDD→review→verify→finish) — all already ADOPT (installed) or in SSOT (#64 SDD, #65 worktrees, #82 best-practices, #96 visual-companion). **9 extra skills** live in `obra/superpowers-skills` repo, NOT in local cache (worker single-channel `[DW-only]`).
- **Gap (operator):** problem-solving skill set (`when-stuck` router + collision-zone/inversion/meta-pattern/scale-game/simplification-cascades) not locally cloned — verify `~/.config/superpowers/skills/` + clone if absent. Cheap. (`when-stuck`=#93 already.)
- **Vocabulary (ADOPT-VOCABULARY, cheap):** `inversion-exercise`↔our T7 adversarial-counter-prompt; `meta-pattern-recognition`↔T16; `simplification-cascades`↔BFR REFERENCE-eliminates-subsystem — fold names into `ai-laziness-traps.md` T7/T16 rationale. `tracing-knowledge-lineages`/`preserving-productive-tensions` already #92/#94.
- **No new row** — Superpowers fully covered by existing SSOT; gaps are operator-action + vocabulary, not capability rows.

### §10.3 amux — **SSOT-correction finding**
**amux has NO SSOT row.** «#85 (amux)» cited in #328 (row #100), #295 matrix, and census §2.1 is a **mis-citation** — verified: `#85 = pre-commit/pre-commit pre-push base-ref` (grep `prior-art-evaluations.md:153`). amux ≈ parallel-`claude`-session multiplexer (two prod repos: `mixpeek/amux` web-dashboard, `andyrewlee/amux` Go-TUI).
- **CC-native-redundant (own-stack-first kills most):** phone-dashboard → CC Remote Control (#100); YOLO auto-approve → CC `--dangerously-skip-permissions`; per-session MCP → `.mcp.json`; git-conflict-detect → CC worktree-isolation (strictly stronger). All REJECT-as-build.
- **Genuine residue (REFERENCE):** atomic task-claiming (`POST /board/:id/claim` — zero-race task distribution, a real gap at scale vs our manual dispatch); `.amux/workspaces.json` per-workspace setup-commands (gap vs bare `create-worktree.sh`); self-healing watchdog (confirms aif #45 ADAPT is the right path).
- **Verdict + new row #104:** REJECT-most / REFERENCE-residue. Row corrects the propagated «#85=amux» error.

### §10.4 AI Factory (`lee-to/ai-factory`) — genuine operator gaps
Distinct from aif-handoff. **Standout advantage:** the **Reflex Loop** — `fix`→`.ai-factory/patches/TIMESTAMP.md`→`implement` reads patches→`evolve` proposes SKILL.md improvements. Closed cross-session learning loop, files-only, zero infra.
- **G1 ADOPT (operator), new row #105:** patch-store convention (`.ai-factory/patches/`) + implement-reads-patches — our fixes don't feed forward; same mistakes recur.
- **G2 ADOPT (operator), folded into #105:** `/evolve` self-improvement (patches→skill-gap→SKILL.md proposal). ADAPT to `.claude/skills/`.
- **G3 ADOPT (operator):** `skill-generator` learn-mode (URL→SKILL.md) — add to our `/ai-docs`.
- **Validates our agnostic shipped-axis (REFERENCE, new row #106):** AIF template-variable substitution (`{{skills_dir}}` etc.) ships one SKILL.md to 15+ agents — empirical proof of `dual-implementation-discipline §3` agnostic-core; AIF is the mature upstream example.

### §10.5 CC-native — under-used own-stack features (THE «know your tools» payload)
The biggest efficiency win: features our own harness ships that we under-use. Worker funneled ~50 slash + skill-frontmatter + hooks. **Top ADOPT-now (operator workflow / orchestrator mechanism):**

| CC feature | Why it matters to us | Surface |
|---|---|---|
| **`/goal <condition>`** | session-level Stop-hook completion-evaluator (fresh Haiku) — replaces hand-rolled «keep going until CI passes»; survives resume; `-p`-compatible; composes with our Stop hook | autonomous-loop (new row #107) |
| **SubagentStart / SubagentStop / TaskCreated / TaskCompleted hooks** | mechanize orchestrator: inject session-bootstrap digest into juniors at spawn ($0, no per-prompt boilerplate); exit-2 force-continue on missing REPORT sections; gate task-creation on worktree-isolation; completion-gate on REPORT schema — all deterministic, no LLM | orchestrator gates (new row #108) |
| **PreCompact hook** | write running wave-state/goal to `.claude/session-state.md` BEFORE compaction wipes it — earlier than our UserPromptSubmit re-inject | session-state preservation (#108) |
| **ConfigChange hook** | block unauthorized `settings.json` changes deterministically — codifies `feedback_settings_json_agent_uncommittable` as a hook | self-protection (#108) |
| **`context: fork` + `agent: Explore` skills** | R-phase research skills run isolated, skip CLAUDE.md token cost — codify our kickoffs as forked skills | R-phase efficiency |
| **skill frontmatter** `paths:`/`model:`/`effort:`/`allowed-tools:`/`hooks:` | per-skill path-scope + model/effort routing + tool pre-approval + lifecycle hooks | skill-layer (complements #101) |
| **`/code-review --fix`** · **`/effort ultracode`** · **`/batch`** · **`/workflows`** · **`/diff`** · **`/context`** · **`/usage`** | review→apply in one step; auto-workflow per task; bulk parallel-PR waves; workflow-progress view; turn-granular diff; context-bloat debug; per-wave cost accountability | habit-adoptions |

- **Honest cost-flags (no-paid-llm §2):** `/schedule` (Routines, #102) + `/autofix-pr` run on Anthropic cloud — confirm subscription-bundled (not pay-per-use) before load-bearing dependence. Workers flagged single-channel.
- **Honest SKIP (named):** `/run`/`/verify` (wrong problem-class — no app to launch), `/team-onboarding` (single-maintainer), `/desktop`/`/sandbox`/UX-prefs, Bedrock/Vertex setup.

### §10.6 SSOT rows this wave appends (#104–#108, append-only)
#104 amux (REJECT-most/REFERENCE-residue + #85-miscitation correction) · #105 AIF patch-store+evolve Reflex Loop (ADOPT operator) · #106 AIF template-variable agnostic-skill (REFERENCE shipped) · #107 CC `/goal` completion-evaluator (ADOPT operator) · #108 CC orchestrator mechanical-gate hooks (ADOPT operator, DECISION-NEEDED — touches settings.json+hooks).

### §10.7 DECISION-NEEDED surfaced (reviewer-discipline §2, not decided)
1. **#328 correction:** its row #100 mis-cites «#85 (amux)» — fix before merge OR accept census #104 as the correction.
2. **#108 orchestrator-hook gates** touch `.claude/settings.json` (self-protected) + hooks → own I-phase.
3. **AIF Reflex Loop (#105)** — adopt patch-store now, or DEFER until a recurring-mistake instance is cited?

## 🟢 Простыми словами

Ты был прав: survey/harvest покрыли малую долю каждого из трёх (Superset — 3 строки на ~30 фич; CC — знали 5 хуков из ~29; aif — 13 точечных из ~7 пакетов + ~20 env-vars). Корень — никто не перечислял **всю** популяцию, брали что нужно по месту.

Я перечислил всё (§2) и прогнал ценное через твой принцип «**CC когда есть, своё когда нет, как с хуком**». Две главные находки бьют в живые проблемы:
1. **CC умеет path-scoped правила сам** (`paths:` в frontmatter) — это нативный аналог нашего `inject-matching-rule.sh`. Вердикт ровно «как с хуком»: на CC — нативка, для не-CC консьюмеров — наш хук как fallback. Оба маркера в правиле.
2. **CC Routines умеют HTTP-диспетчер** (`/fire`) — а наш runtime-bridge dispatch сейчас сломан. Можно взять готовый `/fire` для operator-диспетча вместо достройки сломанного.

Записал всё в этот патч (закрывает дыру «популяция не перечислена») + 3 новые SSOT-строки (#101-#103, #100 оставил за #328). Находки 1/2 трогают живой код — вынес как DECISION-NEEDED под отдельные R-phase, не решаю сам.

**Wave-2 (§10) — прошёлся по всем спутникам автономно** (Superset · Superpowers · AI Factory · amux · CC-native; OhMyOpencode и Cursor — по твоему «не надо» выкинул). Главное «знать свои инструменты»:
- **CC native** — мы недоиспользуем кучу своего: `/goal` (автономный цикл до условия), хуки `SubagentStart/Stop/TaskCompleted/PreCompact/ConfigChange` (можно механизировать орк-дисциплину + защиту settings.json детерминированно, $0), `/code-review --fix`, `/batch`, skill-frontmatter (`paths:`/`model:`/`effort:`). Это самый большой выигрыш по эффективности.
- **Superpowers** — все 14 скиллов уже стоят и образуют полный dev-цикл; гэп только в problem-solving наборе (не склонирован локально).
- **AI Factory** — Reflex Loop (fix→patch→implement→evolve) реально закрывает «наши фиксы не учатся вперёд»; ADOPT operator.
- **amux** — почти всё перекрывает CC натив; **поймал ошибку: «#85=amux» в #328 неверно** (#85 = pre-commit), amux вообще не было в SSOT → строка #104 + коррекция.
+5 SSOT-строк #104-#108. CC-claims помечены worker-sourced (не все ре-верифицированы мной — bench-test до wiring живого кода).
