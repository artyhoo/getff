# Umbrella: aif-handoff as optional runtime bridge between /meta-orchestrator and /orchestrator

> **Status:** DRAFT planned 2026-05-28. **NOT yet dispatched.** R-phase only — no code, no skill edits, no SSOT row landings until R-phase patch is reviewed and maintainer-approved.
> **Authoritative for:** umbrella scope + 3-variant architectural breakdown + admission gates for evaluating aif-handoff as an **optional runtime layer** sitting between `/meta-orchestrator` (planner) and `/orchestrator` (executor), with graceful-fallback to current maintainer-paste flow when aif-handoff absent.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). The verdict itself (R-phase produces verdict per `build-first-reuse-default.md §1` ladder; this kickoff sets scope). DECISION=C invariant — codified in-band at §4 criterion 2 below (HARD requirement, not target: substrate stays dependency-free); origin recorded in memory `project_companion_abc_decisions_closed.md` but the rule itself lives in-band per `.claude/rules/rule-enforcement-channel-selection.md §5 #memory-as-primary-channel`. Stage 5 J5 verdict (`.claude/orchestrator-prompts/*` gitignored vs hybrid) — orthogonal, this umbrella works under any J5 outcome.

> **Class:** N/A (kickoff doc, not a rule). Discipline-bearing artefact — full §1.7 self-reflexive check at §10 below.

---

## §0 One-line frame

Maintainer hypothesis (2026-05-28 session): «когда aif-handoff установлен → пусть он сам подхватывает meta-kickoff'ы, гоняет их через свой Planner→Implementer→Reviewer цикл, пересматривает план при дрифте, заменяя maintainer на автопилоте; когда не установлен → текущий flow (maintainer пастит 1-liner в свежую CC сессию)». Reframes the `aif-handoff = runtime` question from «replacement for /meta-orchestrator» (SSOT #67 REJECT) to «**optional executor layer ниже /meta-orchestrator**».

---

## §1 Origin — why a new R-phase

Three already-recorded DEFER-triggers in [docs/meta-factory/prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md) are activated by the maintainer's reframed question:

1. **SSOT #30 (Planner/Implementer/Reviewer pipeline, DEFER).** Original DEFER rationale: «Project has no autonomous batch use case; Mode B + human-orchestrated batches adequate. We are producer for AIF, not consumer — AIF runtime adoption in our dev workflow = circular.» Trigger to revisit: **«Orchestrator runs autonomous batches ≥3 waves without user present»**. → The reframed question is a maintainer *hypothesis* that this trigger condition WOULD activate **if** adopted. Note: the trigger is **empirical** («has run ≥3 waves»), not **articulatory** («has been considered»). This R-phase evaluates the hypothesis without claiming the trigger has fired. Sub-wave D's SSOT proposals stay **additive-note-only** per §10 backward-check / meta-launch §9 anti-scope; original DEFER verdict is not re-evaluated by this R-phase.

2. **SSOT #44 (`@aif/mcp` tools, DEFER).** Original DEFER: «(1) project has no autonomous batch use case (human orchestrator present); (2) adoption requires standing up aif-handoff infrastructure (Docker, DB) — overhead at current interactive scale.» Trigger to revisit: **«Phase 10 swarm pattern adopts kanban-shape requiring shared task state across parallel sessions; OR aif-handoff project becomes the official Phase 11+ orchestration layer»**. → The reframed question *proposes* aif-handoff as an «optional Phase 11+ orchestration layer» but the trigger condition is **outcome** («has become the official layer»), not **proposal** («has been suggested as such»). Same framing as item 1: Sub-wave D's SSOT proposals stay additive-note-only; original DEFER verdict is not re-evaluated.

3. **SSOT #67 (aif-handoff full Kanban runtime, REJECT for `/meta-orchestrator` scope).** Original REJECT axes: (a) writes code vs our `§7.9` no-code constraint; (b) Docker+DB infra vs our zero-infra requirement; (c) cron-driven vs user-invoked slash. Trigger to revisit: **«`/meta-orchestrator` scope expands to include persistent autonomous agent runtime (different product)»**. → The reframed question explicitly does NOT replace `/meta-orchestrator` (planner stays) — it proposes aif-handoff as a **separate optional layer below** `/meta-orchestrator`, which sidesteps all three original REJECT axes:
   - (a) `/meta-orchestrator` still does not write code; aif-handoff writes code AS the executor — but the executor IS allowed to write code (that's `/orchestrator`'s role today)
   - (b) infra requirement applies only when bridge is opted-in; fallback path = current zero-infra flow
   - (c) `/meta-orchestrator` slash command stays user-invoked; bridge fires AFTER meta-kickoff is written

This is the classic «DEFER row activates when its trigger condition becomes a maintainer goal» pattern from [phase-research-coverage.md §1.6 trigger sweep](../../../.claude/rules/phase-research-coverage.md) — push-based sweep would have surfaced this eventually; the maintainer surfaced it explicitly.

---

## §2 Admission gates — DO NOT dispatch Sub-wave A until ALL hold

1. **F.3 meta-orchestrator helper-collapse umbrella merged.** ✅ CLEAR (as of 2026-05-29). Branch `feat/meta-orch-f3-iphase` was the **source** of [PR #263](https://github.com/Yhooi2/rules-as-tests-aif/pull/263) F.3 I-phase, which merged to `staging` 2026-05-28T16:32:32Z (squash commit `f9ac4b1`). The meta-orchestrator surface this umbrella reasons against is no longer in flux.

2. **Maintainer prioritisation explicit.** This R-phase competes with: (a) `meta-orch-channel-discipline` umbrella (promote SKILL.md:347 Class C→A); (b) `companion-reuse-deep-dive` follow-ups DN-1 through DN-4 from PR #262; (c) bundle Stage 3 follow-ups. Maintainer call which goes next. Sub-waves of multiple umbrellas in parallel = budget burn without throughput gain.

3. **Phase -1 cold-review of THIS kickoff complete.** 1× Opus reviewer per orchestrator skill [Phase -1 protocol](../../../.claude/skills/pipeline/SKILL.md). Reviewer verifies §1.7 forward+backward (§10 below), DEFER-trigger citations from §1, and §3 variant analysis is genuinely 3 options (not 1 dressed as 3).

4. **No active aif-handoff capability commit landed in last 30 days.** If aif-handoff upstream ships new MCP tools or autonomy primitives in this window, R-phase must re-sweep the new surface before locking verdict. Falsifier: `gh api repos/lee-to/aif-handoff/commits?since=<date>` returns ≥1 commit touching `packages/mcp/` or `apps/coordinator/` since 30 days before dispatch.

If any gate fails → kickoff stays parked.

---

## §3 Three architectural variants — exhaustive enumeration

Each variant MUST be evaluated against the same 5 criteria (§5 below). R-phase output must include a concrete verdict for each, not «А и Б одинаково хороши».

### Variant A — aif-handoff as MCP-consumer of meta-kickoff'ов

**Mechanism:**
```text
/meta-orchestrator → writes .claude/orchestrator-prompts/<umbrella>-meta-launch/kickoff.md + state.md
                              ↓
            bridge script (~150-300 LOC bash):
              handoff_create_task --title "<umbrella>" --body "<kickoff content>"
                              ↓
            aif-handoff Planner reads task body → generates per-stage plan
                              ↓
            aif-handoff Implementer spawns `claude --agent` with kickoff as input
                              ↓
            aif-handoff Reviewer checks diff → if REVISE → loop back to Planner
                              ↓
            handoff_sync_status emits WebSocket events → bridge script tails them
                              ↓
            bridge writes status back to state.md (paused/blocked/done)
```

**Pros:** Clean MCP boundary; aif-handoff's native autonomy primitives (paused gates, dirty-worktree guard, CAS claim) are used as-is; bridge is bash-only.

**Cons:** Requires aif-handoff installed (Docker+DB) — significant consumer overhead; MCP `handoff_create_task` body format may not accept our 39-placeholder template structure as-is; bidirectional sync via WebSocket events is complex to right.

**Falsifier:** if `handoff_create_task` rejects our kickoff body shape (e.g. requires `roadmapAlias` + `phase:N` tags that meta-orchestrator doesn't produce today), Variant A is dead — bridge would require pre-processing meta-kickoff into aif-handoff task schema, which approaches Variant B's complexity without B's filesystem advantage.

### Variant B — aif-handoff filesystem-watcher mode on `.claude/orchestrator-prompts/`

**Mechanism:**
```text
/meta-orchestrator → writes .claude/orchestrator-prompts/<umbrella>-meta-launch/kickoff.md (as today)
                              ↓
            aif-handoff coordinator daemon watches dir (via inotify / fsnotify / polling)
                              ↓
            new kickoff.md detected → auto-creates task with body = kickoff content
                              ↓
            same Planner/Implementer/Reviewer cycle as Variant A
                              ↓
            status written back to <umbrella>-meta-launch/state.md
```

**Pros:** Decoupled — meta-orchestrator doesn't know aif-handoff exists; pure filesystem contract; works with any future companion that watches dirs. Maintainer can disable bridge by `kill -9` daemon without code change.

**Cons:** Requires aif-handoff to support directory-watch mode — **unverified at R-phase time**, may need upstream PR; race condition if both maintainer paste AND daemon pick same kickoff; daemon process management complexity (systemd? launchd? supervisord?).

**Falsifier:** if DeepWiki probe «does aif-handoff have a directory-watch mode for tasks» returns «no, only API-driven» → Variant B requires upstream feature work, downgrades to «long-term ADAPT» (not actionable now).

### Variant B' (B-prime) — Hybrid: we build small fs-watcher/hook → calls aif-handoff existing MCP

**Origin:** added 2026-05-29 after maintainer pushback on DN-2. SW-B's analysis scoped pure Variant B narrowly to «aif-handoff has built-in directory-watch as native feature», missing the alternative where **we build a small fs-watcher on OUR side** (CC PostToolUse hook OR standalone watcher) that calls aif-handoff's **existing** MCP `handoff_create_task`. SW-B's verdict for original Variant B stays (long-term ADAPT for native upstream feature); this Variant B' is a separate evaluation.

**Mechanism:**
```text
/meta-orchestrator → writes .claude/orchestrator-prompts/<umbrella>-meta-launch/kickoff.md (as today)
                              ↓
            OUR fs-watcher (one of):
              (a) CC PostToolUse hook, path-scoped to *-meta-launch/kickoff.md (~20 LOC bash)
              (b) standalone chokidar Node script (~50-100 LOC)
              (c) systemd/launchd-wrapped inotifywait/fswatch (~30 LOC bash)
                              ↓
            on detection → reads kickoff.md content → calls aif-handoff MCP:
              handoff_create_task --title "<umbrella>" --description "<kickoff content>"
                              ↓
            aif-handoff Planner/Implementer/Reviewer cycle runs (same as Variant A from here)
```

**Pros:** ~20-100 LOC on our side (vs 400-800 LOC upstream PR for native Variant B); no aif-handoff upstream changes required; uses their **existing** API surface; CC-hook variant is essentially zero-config-add for users who already have aif-handoff + our hooks; DECISION=C trivially preserved (hook is opt-in, our substrate gains no new dep).

**Cons:** still requires aif-handoff Docker+DB for the MCP server (same as A and original B — not B'-specific); race condition between hook firing and meta-orchestrator finishing the write (partial content); CC hook execution context may have limitations on external HTTP/MCP calls — must verify.

**Falsifier:** if (a) CC PostToolUse hooks cannot make MCP/HTTP calls AND no alternative trigger exists, OR (b) aif-handoff MCP `handoff_create_task` requires coordinator-daemon-local context (not callable from arbitrary process), Variant B' collapses to «requires our daemon process» — heavier than current framing implies.

### Variant C — Minimal bridge: aif-handoff as Implementer-equivalent only

**Mechanism:**
```text
/meta-orchestrator → produces 1-liner block (current behaviour)
                              ↓
            maintainer pastes 1-liner into either:
              (a) fresh CC session (current path — UNCHANGED)
              (b) aif-handoff CLI: `aif-handoff exec --kickoff <path>` (NEW thin wrapper)
                              ↓
            Variant C path (b) skips aif-handoff Planner+Reviewer entirely;
            spawns single `claude --agent` with meta-kickoff and tracks status only
                              ↓
            status visible in aif-handoff UI (just for tracking, no re-plan)
```

**Pros:** Lowest blast radius; bridge = single CLI command + status tracking; aif-handoff's own Planner+Reviewer NOT used — avoids duplication with our Phase -1 (which already uses SP `requesting-code-review` per [SKILL.md:404](../../../.claude/skills/pipeline/SKILL.md#L404)); maintainer keeps control over WHEN bridge fires.

**Cons:** Doesn't actually achieve the maintainer's «autopilot» goal — Planner/Reviewer cycle of aif-handoff bypassed; bridge = mostly tracking, not orchestration; value-add = «pretty Kanban UI for tracking what's running», not autonomous re-plan.

**Falsifier:** if maintainer's hypothesis explicitly requires Planner re-plan on drift (which §0 implies), Variant C fails the requirement — value-add too low to justify infra setup.

---

## §4 Five evaluation criteria — each variant scored

Every Sub-wave verdict MUST score each variant against these 5 criteria with file:line / command-output evidence per claim (not vibes):

1. **Bridge complexity** — LOC count for bash bridge; number of distinct MCP calls; daemon-management requirements (Variant B only); upstream-feature dependencies. Targets: < 300 LOC, ≤ 4 MCP calls, no upstream PR required.

2. **DECISION=C compatibility (substrate dependency-free).** Does the variant preserve `/meta-orchestrator` running standalone without aif-handoff? Test: clean checkout + `./install.sh` + `/meta-orchestrator <umbrella>` must succeed identically with and without aif-handoff installed. Hard requirement, not target.

3. **What's actually automated vs maintainer-loop preserved.** Per stage of work: which steps move from maintainer to aif-handoff, which steps stay with maintainer (DECISION-NEEDED routing per [reviewer-discipline.md §2](../../../.claude/rules/reviewer-discipline.md), maintainer pushback approval, strategy forks). The goal is automating the **dispatch** loop, not the **decision** loop.

4. **Fallback ergonomics without aif-handoff installed.** Consumer without aif-handoff installed must have NO degradation in `/meta-orchestrator` experience vs today. Test: same kickoff, same 1-liner output, same maintainer-paste flow. No new manual steps added.

5. **Duplication with existing /orchestrator + SP cycle.** **Note (Phase -1 finding 2026-05-29):** SKILL.md surfaces an internal inconsistency about SP `requesting-code-review` — [SKILL.md:404](../../../.claude/skills/pipeline/SKILL.md#L404) cites it as REFERENCE («SP SSOT, REFERENCE — see R-phase patch §3 leapfrog table»), while [SKILL.md:429](../../../.claude/skills/pipeline/SKILL.md#L429) says «ADOPT the SP dispatch template». Sub-wave evaluation MUST resolve which is canonical before scoring this criterion (cite R-phase patch `2026-05-23-meta-orchestrator-prior-art.md §3` for ground truth; if it disambiguates → use that; if it does NOT → surface as DECISION-NEEDED per reviewer-discipline.md §2). Per [SKILL.md:335](../../../.claude/skills/pipeline/SKILL.md#L335), Mode B parallel ADOPTs SP `subagent-driven-development`. aif-handoff's Planner/Reviewer would duplicate one or both — score variants on whether duplication is meaningful net-add or pure waste.

---

## §5 AI-traps active for this R-phase

Per [.claude/rules/ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md), kickoff MUST enumerate T-numbers explicitly (T7 anti-pattern penalty for blanket reference).

**Standard catalogue (from §2 of ai-laziness-traps.md):**

- **T1** — sampling floor ≥5. Each Variant's evaluation MUST cite ≥5 distinct DeepWiki probes / file inspections / command outputs. «I looked at 3 things, all looked OK» = T1 violation.
- **T3** — every finding has file:line, command output, or explicit INCONCLUSIVE. No prose-only claims (e.g. «aif-handoff supports directory watching» needs a file path or upstream issue link).
- **T7** — adversarial counter-prompts run on negative-existence claims (especially Variant B «no directory-watch mode in aif-handoff» — counter-prompt: «if it had one, where would it live? `apps/coordinator/src/watchers/`? `packages/cli/commands/watch.ts`?»).
- **T11** — search for prior bridge implementations BEFORE designing our own. Specifically: does any project bridge a planner+executor split using aif-handoff already? `code-yeongyu/oh-my-openagent`? `lee-to/ai-factory` itself?
- **T12** — DeepWiki probes at R-phase time, not training-data recall on `lee-to/aif-handoff`. Active upstream may have shipped relevant capabilities since the SSOT #67 evaluation (2026-05-23).
- **T13** — re-verify already-ADOPTED items. SP `requesting-code-review` already adopted ([SKILL.md:404](../../../.claude/skills/pipeline/SKILL.md#L404)) — confirm aif-handoff's Reviewer would not silently override it.
- **T15** — recursive self-application. R-phase patch must include its own §self-application: «did this R-phase apply BFR-default §3 6-layer search to itself?» (audit own prior-art consult quality).
- **T16** — explicit «Upstream problem class: X. Our problem class: Y. Match? Evidence: …» per variant. Without this walk, the «reframed as optional layer» framing risks repeating the SSOT #67 muddied-scope mistake from a different angle.
- **T17** — destructive delegation. R-phase does NOT delete or modify any meta-orchestrator code. Output is markdown only.
- **T19** — cold-QA before handoff. Reviewer-session reads the R-phase patch independently before PR open. Not «CI green = ready» (T19 trap: CI ≠ design review).
- **T20** — every verdict cites SSOT row + evidence + falsifier in same sentence. «Variant A wins on criterion 1» without `aif-handoff/packages/mcp/handoff_create_task.ts:N` evidence = T20 violation.

**Domain-specific T-traps for this R-phase (new entries, candidate promotion if recurring across umbrellas):**

- **T-AIF-BRIDGE-A** — «MCP body-format assumed compatible without inspection». Specifically: assuming `handoff_create_task` accepts arbitrary markdown body without verifying schema. Counter: inspect `aif-handoff/packages/mcp/schemas/` (or DeepWiki probe specific schema) BEFORE proposing Variant A as bash-only.

- **T-AIF-BRIDGE-B** — «directory-watch mode existence assumed». Specifically: assuming aif-handoff has filesystem-watcher capability because «modern tools usually do». Counter: explicit DeepWiki probe + GitHub issue search for `inotify` / `fsnotify` / `chokidar` in upstream codebase.

- **T-AIF-BRIDGE-C** — «automation theatre». Specifically: declaring «Variant C automates dispatch» when actually it just adds UI tracking without changing maintainer-action count. Counter: per-step maintainer-action count BEFORE/AFTER table mandatory in Variant C evaluation.

---

## §6 Sub-wave breakdown (R-phase, single session each, Mode A inline Opus)

All four Sub-waves are research-only. Output = markdown research-patch + SSOT row proposal. **No code, no skill edits, no install.sh changes.**

### Sub-wave A — Variant A (MCP-consumer) deep evaluation

**Output:** `docs/meta-factory/research-patches/2026-MM-DD-aif-handoff-bridge-variant-a-mcp.md`.

**Must cover:**

1. DeepWiki sweep on aif-handoff MCP surface: `handoff_create_task`, `handoff_update_task`, `handoff_sync_status`, `handoff_push_plan`, `handoff_annotate_plan`. ≥3 probes with «within-one-project, task creation from external orchestrator» disambiguation.
2. Body-format compatibility: inspect MCP tool schemas (`aif-handoff/packages/mcp/schemas/*.ts` or equivalent) — does our 39-placeholder meta-kickoff format fit without pre-processing? T-AIF-BRIDGE-A enforced.
3. Status-back-channel: WebSocket events (`task:created`, `task:moved`, etc.) — can bridge script consume them reliably? Or only API polling?
4. Bridge LOC estimate (with line-count rationale, not vibes).
5. §4 5-criteria scoring with file:line evidence.
6. Verdict per BFR-default §1 ladder: ADOPT / ADAPT / REFERENCE / REJECT for Variant A specifically.

### Sub-wave B — Variant B (filesystem watcher) viability probe

**Output:** `docs/meta-factory/research-patches/2026-MM-DD-aif-handoff-bridge-variant-b-watcher.md`.

**Must cover:**

1. DeepWiki probe «directory-watch / filesystem-watcher mode in aif-handoff». T-AIF-BRIDGE-B enforced — adversarial counter-prompts mandatory.
2. If absent: estimate upstream PR effort (Sub-wave B downgrades to long-term ADAPT verdict).
3. If present (or partial): race-condition analysis vs maintainer-paste path.
4. Daemon process-management requirements (systemd / launchd / supervisord) — would consumer-install complexity blow past DECISION=C overhead threshold?
5. §4 5-criteria scoring.
6. Verdict per BFR-default §1 ladder for Variant B.

### Sub-wave B2 — Variant B' (hybrid CC-hook + aif-handoff MCP wrapper) feasibility + scoring

**Output:** `docs/meta-factory/research-patches/2026-05-29-aif-handoff-bridge-variant-b-prime-hybrid.md`.

**Origin:** added 2026-05-29 post-Stage-1 after maintainer surfaced gap in original Variant B framing. SW-B verdict for native Variant B stays; SW-B2 evaluates the hybrid alternative as a separate research artefact.

**Must cover:**

1. **Mechanism design** — describe the hybrid bridge concretely:
   - Option (a): CC PostToolUse hook on Write tool, path-scoped to `.claude/orchestrator-prompts/*-meta-launch/kickoff.md` (~20 LOC bash)
   - Option (b): standalone chokidar Node script (~50-100 LOC)
   - Option (c): inotifywait (Linux) / fswatch (macOS) bash wrapper (~30 LOC, cross-platform consideration)
   - For each: actual LOC count target + sample script structure + invocation pattern for `handoff_create_task` MCP call.

2. **Technical feasibility probes (≥5 distinct evidence channels per T1):**
   - **CC hooks capability probe** — verify PostToolUse hook context can: (a) execute external commands via Bash, (b) make HTTP calls (curl), (c) invoke MCP server (via stdio? HTTP?). Reference: `code.claude.com/docs/en/hooks.md`. Fetch + cite.
   - **aif-handoff MCP standalone probe** — does `handoff_create_task` require aif-handoff coordinator daemon running locally? Or can MCP server be invoked statelessly with project DB connection? DeepWiki + upstream docs check.
   - **fs-watcher LOC comparison** — chokidar vs inotifywait vs fswatch — minimum viable script for «watch glob → emit event → invoke command» pattern. Cite per-tool docs.
   - **Race condition probe** — what is Write tool's atomicity guarantee? Can hook fire on partial-write? Mitigation patterns (debounce, atomic-rename, completion marker).
   - **Cross-platform feasibility** — does (a)/(b)/(c) work on macOS + Linux + Windows-WSL? CC hooks portability.

3. **Per-blocker analysis against SW-A's 3 Variant A ADOPT-blockers:**
   - SW-A blocker 1: `accept_existing_plan` requires PLAN.md on disk — does Variant B' inherit this? (Likely yes, since it uses same MCP)
   - SW-A blocker 2: WebSocket broadcast no topic filter — does Variant B' inherit? (Likely yes, same status-back-channel)
   - SW-A blocker 3: autoMode Reviewer conflicts reviewer-discipline.md §2 — DN-1 = B-constrained applies (Reviewer must implement ask-on-doubt). Verify Variant B' is compatible with the DN-1 constraint.

4. **DECISION=C HARD requirement check:** hybrid preserves substrate-dependency-free? Hook is opt-in for consumers. Our substrate gains no new direct dependency. Verify against `.claude/rules/build-first-reuse-default.md §1` invariant + memory `project_companion_abc_decisions_closed.md`. Expected PASS — but explicit verification mandatory (T-AIF-BRIDGE-B'-1 trap).

5. **§4 5-criteria scoring** for Variant B':
   - **Bridge complexity:** target <100 LOC (vs <300 target). Expected PASS if hook approach works.
   - **DECISION=C compatibility:** HARD. Expected PASS.
   - **Automation vs maintainer-loop:** Variant B' is autonomy-gold-standard (auto-trigger on file event, no maintainer click needed). Compare quantitatively to A's «maintainer pastes» pattern.
   - **Fallback ergonomics:** consumer without aif-handoff installed → hook just doesn't fire → no degradation. PASS expected.
   - **Duplication w/ /orchestrator + SP:** same considerations as Variant A re: aif-handoff Reviewer (DN-1 = B-constrained applies). If autoMode-constraint holds, duplication is reduced.

6. **Verdict per BFR-default §1 ladder** for Variant B' specifically (ADOPT / ADOPT VOCABULARY / ADAPT / REFERENCE / KEEP NARROW / BUILD / REJECT). Apply T16 problem-class match.

7. **Comparison table** vs Variant A and original Variant B (one row per variant, one column per criterion). Sub-wave D will consume this directly.

**Domain-specific traps for SW-B2:**

- **T-AIF-BRIDGE-B'-1** — «CC PostToolUse hook is unconstrained» assumed. Verify hook execution context: can it invoke MCP? Counter: explicit `code.claude.com/docs/en/hooks.md` fetch + small POC test if hook semantic is unclear.
- **T-AIF-BRIDGE-B'-2** — race condition between hook firing and Write completion not analyzed. Counter: probe Write atomicity, propose mitigation (atomic temp-rename or completion-marker file).
- **T-AIF-BRIDGE-B'-3** — «aif-handoff MCP-standalone» assumed without verification. Counter: explicit DeepWiki probe «can aif-handoff MCP server be invoked without coordinator daemon running locally».
- **T-AIF-BRIDGE-B'-4** — Variant A's 3 ADOPT-blockers (accept_existing_plan PLAN.md, WebSocket broadcast, autoMode) assumed not applicable to B'. Counter: explicit per-blocker walk (item 3 above).
- **T-AIF-BRIDGE-B'-5** — «LOC count target ~20-100» assumed without writing concrete sample. Counter: include sample bash/Node script (even if not committed) — actual LOC count, not estimate.

**Estimated effort:** ~80-100k Opus tokens (similar scope to SW-A/SW-B; new probe surface is CC hooks + aif-handoff MCP-standalone — not in original SW-A/B scope).

**STOP conditions:**
- If T-AIF-BRIDGE-B'-1 reveals CC hooks CANNOT invoke MCP/HTTP AND no portable alternative within DECISION=C → verdict «Variant B' requires our own daemon», approaches original Variant B cost → REJECT or long-term ADAPT.
- If T-AIF-BRIDGE-B'-3 reveals aif-handoff MCP requires coordinator-daemon-local context (not callable from arbitrary hook process) → Variant B' framing collapses → reframe and re-evaluate.
- If §4 criterion 2 (DECISION=C) FAILS unexpectedly → halt and surface to maintainer.

### Sub-wave C — Variant C (minimal bridge, Implementer-only) value-add audit

**Output:** `docs/meta-factory/research-patches/2026-MM-DD-aif-handoff-bridge-variant-c-minimal.md`.

**Must cover:**

1. Per-step maintainer-action count BEFORE/AFTER comparison. T-AIF-BRIDGE-C enforced — without this table, Variant C verdict is provisional.
2. Tracking-only value: is «pretty Kanban UI for in-flight kickoffs» worth Docker+DB cost when bridge doesn't auto-re-plan?
3. Duplication analysis vs SP `requesting-code-review` (already ADOPTED) — does Variant C bypass or compete with Phase -1?
4. §4 5-criteria scoring.
5. Verdict per BFR-default §1 ladder for Variant C.

### Sub-wave D — Synthesis + cross-variant verdict

**Output:** `docs/meta-factory/research-patches/2026-MM-DD-aif-handoff-bridge-synthesis.md`.

**Must cover:**

1. Comparison table across all 5 criteria × 3 variants (15 cells, each with citation).
2. SSOT new-row proposals (next-available-slot placeholder; first-to-merge claims slot).
3. Maintainer DECISION-NEEDED routing per [reviewer-discipline.md §2](../../../.claude/rules/reviewer-discipline.md) if 2+ variants score equal-best.
4. Update to SSOT #30, #44, #67 «Trigger to revisit» fields (additive notes, NOT verdict changes).
5. Recommend one of: GREENLIGHT Variant X for I-phase / DEFER all variants (record updated triggers) / REJECT all (rationale).

---

## §7 Stage gates (real `gh` commands, not prose)

Between Sub-waves: REAL git merge check, not in-memory FIFO. Per [SKILL.md §6](../../../.claude/skills/pipeline/SKILL.md#L354).

**Sub-wave A → B admission:**
```bash
gh pr list --search "is:merged head:research/aif-handoff-bridge-variant-a base:staging" --json number,title,mergedAt --limit 5
```
Must return ≥1 row. If 0 → BLOCKED.

**Sub-wave A,B → C admission** (2 separate calls — `gh pr list --search` does NOT support `OR` syntax):
```bash
gh pr list --search "is:merged head:research/aif-handoff-bridge-variant-a base:staging" --json number,title --limit 5
gh pr list --search "is:merged head:research/aif-handoff-bridge-variant-b base:staging" --json number,title --limit 5
```
BOTH queries must return ≥1 row. If either is empty → BLOCKED. (A and B can run parallel; C synthesises both.)

**Sub-wave B2 admission** (independent of C — can run parallel; both feed D):
```bash
gh pr list --search "is:merged head:research/aif-handoff-bridge-variant-a base:staging" --json number,title --limit 5
gh pr list --search "is:merged head:research/aif-handoff-bridge-variant-b base:staging" --json number,title --limit 5
```
BOTH queries must return ≥1 row. SW-B2 reads SW-A's blocker analysis and SW-B's verdict as baseline; parallel-safe with SW-C.

**A,B,B2,C → D admission** (4 sub-waves now — SW-D synthesizes 4 variants):
```bash
gh pr list --search "is:merged head:research/aif-handoff-bridge-variant base:staging" --json number,title --limit 10
```
Must return ≥4 rows (SW-A + SW-B + SW-B2 + SW-C).

---

## §8 Stop conditions per stage

- **Sub-wave A STOP:** if MCP schema inspection reveals `handoff_create_task` requires structured fields (not free markdown body) that meta-orchestrator does not produce → record finding, verdict «Variant A requires upstream feature OR meta-orchestrator output reshape», do NOT propose ADOPT.
- **Sub-wave B STOP:** if no directory-watch capability exists in aif-handoff AND no upstream PR feasible within reasonable effort → verdict «Variant B = long-term ADAPT, not actionable now».
- **Sub-wave C STOP:** if BEFORE/AFTER maintainer-action count table shows <30% reduction → verdict «Variant C value-add insufficient».
- **Sub-wave D STOP:** if 2+ variants tie on §4 criteria with identical score → DECISION-NEEDED to maintainer (per reviewer-discipline §2), do NOT pick.

---

## §9 Recursive-self-application

Per [README.md#why-this-exists](../../../README.md#why-this-exists) invariant #2 («recursive self-application green»).

This R-phase MUST apply its own discipline:

1. **BFR-default §3 6-layer search applied to this R-phase itself.** R-phase patch §1.7 forward-check confirms: (a) SSOT consult done (rows #27/#28/#29/#30/#43/#44/#46/#67 all reviewed), (b) phase-research-coverage §1 6-item checklist run on each negative-existence claim, (c) DeepWiki ≥3 phrasings per Sub-wave, (d) WebSearch ≥2 phrasings on `<aif-handoff bridge>` / `<external orchestrator MCP>` queries, (e) own-stack sweep on `agents/`, `.claude/skills/`, `install.sh` (NB: `install.sh:457-460` is only an informational `echo` note — the actual skill-context payload copy happens earlier; Sub-wave R-phase MUST verify the exact line range of the copy step before citing).

2. **T16 problem-class match per variant.** Without explicit «Upstream problem class: X. Our problem class: Y. Match?» the verdict repeats SSOT #67 muddied-scope mistake from a different angle.

3. **Phase -1 cold-review of EACH Sub-wave patch BEFORE PR open** (not just CI green). Per [ai-laziness-traps.md T19](../../../.claude/rules/ai-laziness-traps.md).

---

## §10 §1.7 forward + backward check on THIS kickoff

### Forward (does this kickoff comply with existing disciplines?)

- **`build-first-reuse-default.md`:** kickoff is a research-only umbrella that EXISTS to apply BFR §3 to a specific question. It does not propose BUILD pre-research. ✓
- **`no-paid-llm-in-ci.md`:** R-phase uses DeepWiki MCP + WebSearch + filesystem inspection + DeepWiki ask_question — all subscription-bundled or free. ✓
- **`reviewer-discipline.md §2`:** §8 Sub-wave D STOP explicitly surfaces ties as DECISION-NEEDED to maintainer; Sub-wave verdicts do NOT pick project strategy when 2+ variants legitimate. ✓
- **`phase-research-coverage.md §1.7`:** this §10 is the self-reflexive walk. ✓ (Recursive — §10 walks the §1.7 rule applied to itself.)
- **`ai-laziness-traps.md §3`:** §5 above enumerates 11 standard T-numbers + 3 domain-specific T-AIF-BRIDGE-{A,B,C}. ✓
- **`doc-authority-hierarchy.md §3`:** header carries Status + Authoritative-for + NOT authoritative-for. ✓ (Class field N/A — research kickoff per filename-convention authority in [doc-authority-hierarchy.md §2](../../../.claude/rules/doc-authority-hierarchy.md).)
- **`dual-implementation-discipline.md §2`:** kickoff is markdown-only artefact under «§2 (i) markdown-only carve-out» — rule does not apply at kickoff layer; applies at I-phase if BUILD/ADAPT verdict carries through. ✓
- **DECISION=C invariant:** §4 criterion 2 hard-codes substrate-dependency-free as a HARD requirement (not target). ✓
- **CLAUDE.md `PR strategy`:** this kickoff does not silently expand scope mid-PR. Output is one kickoff file in one commit; R-phase dispatch is a separate decision. ✓

### Backward (what existing artefacts does this kickoff's framing affect?)

- **SSOT #27/#28/#29/#30/#43/#44/#46/#67** — eight rows referencing aif-handoff. None are silently superseded by this kickoff. R-phase patch may PROPOSE additive «Trigger to revisit» notes per Sub-wave D §6.4 — additive only, no verdict changes.
- **No `.claude/rules/*` modified.** No principle test modified. No agent prompt modified. No skill modified. No install.sh modified.
- **No SSOT row landed yet.** New row proposals stay in Sub-wave D patch as «proposed, awaiting maintainer landing».
- **DECISION=C invariant** unchanged. This kickoff respects axis-A substrate purity (variant evaluation criteria hard-requires fallback path).

### Self-reflexive check (T15)

Has this kickoff itself been audited for the same traps it enumerates in §5? Walk:

- T1 sampling floor: this kickoff is the meta-artefact, no sampling done here — sampling discipline applies at Sub-wave level. ✓ (deferred to Sub-waves)
- T3 file:line evidence: §1 (SSOT row IDs cited), §3 (file:line for SKILL.md references), §4 (file:line references), §7 (real `gh` commands not prose). ✓
- T7 adversarial counter-prompt: §3 each variant has explicit «Falsifier» line. ✓
- T11 prior-art search: §1 cites 3 existing SSOT DEFER triggers — the prior-art consult IS the origin of the kickoff. ✓
- T15 self-application: §9 explicitly required for R-phase patches; §10 self-walked here for the kickoff itself. ✓
- T16 problem-class: framing change «replacement → optional layer below» is the T16 walk applied prophylactically (avoids repeating SSOT #67 muddied-scope mistake). Each Sub-wave repeats T16 per variant in detail. ✓
- T20 inline-verdict: no verdict in this kickoff. Output is scope + admission gates + variant enumeration. ✓ (verdict landed by R-phase patches, not by this kickoff)

---

## §11 Output spec

R-phase produces 4 markdown research-patches under `docs/meta-factory/research-patches/2026-MM-DD-aif-handoff-bridge-{variant-a-mcp,variant-b-watcher,variant-c-minimal,synthesis}.md`. Each patch:

1. Scope comment header (`<!-- scope:aif-handoff-bridge-variant-X -->`).
2. Status / Date / Authoritative-for / NOT authoritative-for header.
3. §0 TL;DR with verdict + match-score + falsifier.
4. §1 Scope (which variant; what was probed).
5. §2 DeepWiki sweep evidence (probe text + DeepWiki URL + key extraction).
6. §3 T16 problem-class match table.
7. §4 §4-criteria scoring (5 rows × file:line evidence).
8. §5 Verdict per BFR-default §1.
9. §6 SSOT row / additive-note proposals.
10. §7 §1.7 forward-check applied.
11. §8 §1.7 backward-check applied.
12. §9 See also.

PR titled `research(aif-handoff-bridge): Sub-wave <X> — <variant name>`. Base branch: `staging`. Auto-merge into staging via project_automerge_staging_plan.md flow.

---

## §12 See also

- [docs/meta-factory/prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md) — SSOT rows #27, #28, #29, #30, #43, #44, #46, #67, #80 (existing aif-handoff entries).
- [docs/meta-factory/research-patches/2026-05-26-companion-reuse-aif-handoff-autoqueue.md](../../../docs/meta-factory/research-patches/2026-05-26-companion-reuse-aif-handoff-autoqueue.md) — predecessor sub-component evaluation (autoQueueMode); precedent for evaluating aif-handoff capabilities separately from full-runtime REJECT.
- [docs/meta-factory/research-patches/2026-05-23-meta-orchestrator-prior-art.md](../../../docs/meta-factory/research-patches/2026-05-23-meta-orchestrator-prior-art.md) — meta-orchestrator BUILD verdict + SSOT #66-#70 origin (including #67 REJECT).
- [.claude/skills/meta-orchestrator/SKILL.md](../../../.claude/skills/pipeline/SKILL.md) — surface this umbrella reasons against; F.3 helper-collapse must merge before dispatch (§2 gate 1).
- [.claude/rules/build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md) — verdict ladder applied in §6 per-variant verdicts.
- [.claude/rules/parallel-subwave-isolation.md](../../../.claude/rules/parallel-subwave-isolation.md) — relevant if Sub-waves A and B dispatch parallel.
- [.claude/rules/no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) — §10 forward-check enforces.
- [.claude/rules/ai-laziness-traps.md](../../../.claude/rules/ai-laziness-traps.md) — §5 enumerates active T-numbers; §3 of the rule mandates per-kickoff enumeration.
- [.claude/rules/reviewer-discipline.md](../../../.claude/rules/reviewer-discipline.md) — §2 strategy-fork surface for tied verdicts.
- memory project_companion_abc_decisions_closed.md — DECISION=C invariant this kickoff respects.
- memory project_automerge_staging_plan.md — PR landing flow.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
