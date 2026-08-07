<!-- scope:plan-memory-brainstorm -->
# Brainstorm — meta-orchestrator plan-memory feature

> **Authoritative for:** brainstorm-phase output for the `meta-orchestrator-plan-memory` umbrella — maintainer intent restatement, feature decomposition, prior-art consult with T16 checks, two design directions, R-phase question list, falsifiers, §1.7 self-check. Pre-R-phase deliverable.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). R-phase verdict — this is brainstorm only (Status below). Implementation — not started.

> **Date:** 2026-05-25
> **Status:** brainstorm phase (pre-R-phase)
> **Origin:** Maintainer dialogue 2026-05-25. Kickoff: [.claude/orchestrator-prompts/meta-orchestrator-plan-memory/kickoff.md](../../../.claude/orchestrator-prompts/meta-orchestrator-plan-memory/kickoff.md). Worker dispatched via meta-orchestrator-plan-memory umbrella.

---

## §1 — Maintainer intent restatement

**Verbatim quote (kickoff §1):**

> «А как тебе идея чтобы помимо этого мета-оркестратор бы обновлял свой план — то есть имел бы свою память об проекте (план) и с каждым запуском проверял бы её актуальность и обновлял бы и расставлял очередность? А вызов с `<name>` к тому же добавлял бы в этот план (если ещё не было там кикофа) например?»

**Brainstorm's understanding of intent:**

The maintainer wants `/meta-orchestrator` to act less like a one-shot command and more like a **continuous project brain**: each invocation reads its stored understanding of the project plan, reconciles it against live reality (`gh pr list`, open kickoffs), refreshes the stored copy, and re-scores priority. When invoked with a specific `<name>`, the plan should auto-register that umbrella if it isn't already tracked — closing the manual-tracking tax.

The motivation is clear from the current state: after the planner-completeness umbrella closed (2026-05-25), `plan-currency-check.sh` (L2 UNTRACKED detection) surfaced ~85 UNTRACKED merged PRs vs `wave-sequencing-plan.md`. Detection works; the missing layer is **persistence** — «remember what I already reconciled so the next session starts from a freshly-reconciled state, not from scratch».

Two conceptually separable threads run inside this idea:

1. **Plan-currency persistence** — after each reconcile, write the updated state somewhere durable so the next `/meta-orchestrator` invocation starts from «current» not «stale».
2. **Auto-registration** — when invoked with `<name>`, insert that umbrella into the plan if it's absent (factual add vs strategy add — see §3.3 below).

---

## §2 — Decomposed feature components

Based on kickoff §1.1–§1.5 and the brainstorm's analysis, each component gets a provisional **keep / drop / re-frame** verdict:

| # | Component | Verdict | Rationale |
|---|---|---|---|
| 1 | **Persistent project-plan memory** | **KEEP — load-bearing** | The entire idea depends on cross-session persistence. Without it, every invocation re-pays the full reconcile cost. |
| 2 | **Plan-currency on every launch** | **KEEP — already partially exists** | L2 detection (PR #217) does the discovery half. This component adds the *write-back* half — persisting the reconciled state. |
| 3 | **Priority re-scoring** | **KEEP WITH SCOPE GUARD** | Re-scoring is already in §2 of SKILL.md (multi-criteria scoring). The new element is: start from a *persisted* priority snapshot, then update deltas, rather than scoring from scratch. Pure factual updates (score a newly-registered umbrella) auto-apply; strategy tie-breakers still surface per reviewer-discipline.md §2. |
| 4 | **Auto-registration on `/meta-orchestrator <name>`** | **RE-FRAME** | The naive form (insert a Track row automatically) bumps into strategy vs factual territory. Re-frame: register factual metadata (umbrella name, kickoff path, discovery timestamp) as a **candidate entry** with status `UNTRACKED-NEW`; present to maintainer for promotion to an active Track row. The AI does not silently add strategy content — it surfaces a decision-needed candidate. |
| 5 | **L6 auto-draft reconcile** | **RE-FRAME as a sub-function of #2** | L6 is not a separate feature. It is the output artifact of the plan-currency write-back (#2): when the skill writes reconciled state, the diff to `wave-sequencing-plan.md` is L6's «auto-draft». L6 = the Write side of plan-currency. Keep L6 as a label for that specific sub-step, but do not build it as an independent module. |

**Dropped component:**

- Nothing is fully dropped; component 5 is collapsed into component 2.

---

## §3 — Prior-art consult

All T16 checks performed in this session with tool-call evidence. Verdicts are **PROVISIONAL** (brainstorm phase; final verdict at R-phase with 6-item coverage checklist per phase-research-coverage.md §1).

### 3.1 Cline Memory Bank (`cline/cline`)

**DeepWiki query 2026-05-25 (two queries):**

> «How does Cline Memory Bank work? Where does project plan or state persist across sessions?»
> «Does Cline Memory Bank auto-update its plan files on every session start, or does it require an explicit user command?»

**Evidence from DeepWiki:** Memory Bank = structured markdown files in `memory-bank/` directory: `projectbrief.md`, `productContext.md`, `activeContext.md`, `systemPatterns.md`, `techContext.md`, `progress.md`. Cline reads all Memory Bank files at the start of every task. **Update is NOT automatic on every session** — requires either user command («update memory bank») or AI-initiated trigger (new pattern discovered, significant change). The `activeContext.md` and `progress.md` track current state. Plan files are committed-markdown in the project repo.

**T16 problem-class check:**
- Upstream problem class: «AI coding assistant maintains project context across sessions via committed markdown files in `memory-bank/`; updates triggered by user command or AI signal; files are human-readable and co-owned with the project.»
- Our problem class: «A meta-orchestrator skill maintains a cross-session plan of tracked umbrellas + priority scores + reconcile state; auto-updates on every invocation by comparing stored state vs live `gh pr list` + kickoff filesystem; updates are deterministic (factual facts about PRs), not LLM-driven documentation rewrites.»
- **Match? PARTIAL — ~55%.** The committed-markdown-in-repo pattern is the vocabulary match. The mechanism diverges: Cline requires explicit human command or AI judgment to update; our requirement is **deterministic auto-update on every invocation**. Cline Memory Bank is project documentation; our plan is factual state (PR merge status, kickoff existence) that can be auto-refreshed without judgment.

**PROVISIONAL VERDICT: ADAPT.** Adopt the committed-markdown-in-repo storage pattern and the file-per-concern separation (`activeContext.md` → our `state.md` companion). Do not adopt the manual-update-trigger discipline (ours is auto-triggered deterministically). R-phase must verify: does the committed-markdown pattern survive `wave-sequencing-plan.md`'s existing strategy content without creating a `#two-prompts-drift` risk?

---

### 3.2 TaskMaster MCP (`eyaltoledano/claude-task-master`)

**DeepWiki query 2026-05-25:**

> «Does TaskMaster maintain a persistent project plan across sessions? Where does task state live?»

**Evidence from DeepWiki:** TaskMaster stores persistent plan in `.taskmaster/tasks/tasks.json` (JSON format). `state.json` tracks current active tag + migration status. `config.json` stores model configuration. Updates require explicit CLI commands (`task-master update-task`, `task-master set-status`, etc.) — **not auto-updated on invocation**. Tagged task lists allow isolated contexts per feature/branch.

**Existing SSOT rows:** #73 (L4 decomposition heuristics, ADAPT VOCABULARY), #74 (TaskMaster analyze-complexity, ADAPT VOCABULARY). Already surveyed for L3/L4/L5 in planner-completeness R-phase.

**T16 problem-class check:**
- Upstream problem class: «PRD-driven project task management with persistent JSON task store; LLM-assisted complexity analysis; explicit CLI commands to update; single-project scope.»
- Our problem class: «Cross-umbrella meta-orchestration plan with PR-merge factual state; auto-refreshed on each invocation; multi-umbrella scope; no LLM to update.»
- **Match? WEAK — ~30%.** JSON-task-store persistence pattern is a vocabulary reference. The fundamental difference: TaskMaster is a task manager where humans issue commands; our plan is a self-refreshing fact cache.

**PROVISIONAL VERDICT: REFERENCE.** The `.taskmaster/` directory convention (plan lives in a dedicated dot-directory inside the project) is a useful precedent. The JSON state format is too structured for our mostly-markdown workflow. No new SSOT row at brainstorm phase — R-phase will decide.

---

### 3.3 Superpowers `subagent-driven-development` (SSOT #64)

**DeepWiki query 2026-05-25:**

> «Does Superpowers subagent-driven-development skill maintain a persistent plan or task list across sessions?»

**Evidence from DeepWiki:** SDD reads an implementation plan markdown file **once at session start**; tracks task completion via `TodoWrite` (in-session only); does **not** persist cross-session plan state. Plans are static markdown in `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`. «No persistent cross-session task list in the traditional sense.»

**Second DeepWiki query — `using-git-worktrees`:**

> «Does any Superpowers skill maintain a persistent cross-session project roadmap or wave plan? Is there a skill that self-updates a plan file on every invocation?»

**Evidence:** «No — neither the using-git-worktrees skill nor any other Superpowers skill maintains a persistent cross-session project roadmap or wave plan, nor is there a skill that self-updates a plan file on every invocation.»

**T16 problem-class check:**
- Upstream problem class: «Within-session task tracking for a single implementation plan; plan is static; state is in-session only.»
- Our problem class: «Cross-session persistent plan with deterministic auto-refresh on each invocation.»
- **Match? NO on cross-session persistence** — Superpowers explicitly does not do what we need. The vocabulary (size tiers, plan format) is already registered at SSOT #64/#74.

**PROVISIONAL VERDICT: REFERENCE (vocabulary only, already registered).** No new prior-art to survey.

---

### 3.4 OpenHands (`All-Hands-AI/OpenHands`) — SSOT #72

**DeepWiki query 2026-05-25:**

> «Does OpenHands maintain a persistent project plan or task list across sessions?»

**Evidence from DeepWiki:** `TaskTrackerAction` manages task lists (view/plan commands); frontend persists `conversationMode`, `subConversationTaskId`, `planContent` to **local storage**; `Plan.md` content updated via `PlanningFileEditorObservation` events. Cross-session continuity is via local-storage browser state — not committed markdown, not a deterministic file.

**T16 problem-class check:**
- Upstream problem class: «SaaS coding agent with browser-local-storage plan persistence; server-side state machine; React frontend; plan managed within a running SaaS session.»
- Our problem class: «CLI session-bound skill with committed-markdown or file-based plan; deterministic bash auto-refresh; no browser, no SaaS.»
- **Match? NO.** Local-storage SaaS pattern is incompatible with our substrate (CC CLI + bash + git).

**PROVISIONAL VERDICT: REFERENCE (task status enum vocabulary — todo/in_progress/done already noted in SSOT #72 row).** Confirms BUILD for our substrate.

---

### 3.5 aif-handoff (`lee-to/aif-handoff`) — SSOT #67

**WebSearch query 2026-05-25 + existing SSOT #67:**

Evidence: aif-handoff is a server-side autonomous Kanban runtime (Docker + PostgreSQL + cron-driven `pollAndProcess`). Cross-session state lives in a database. This was already REJECT at SSOT #67 for the meta-orchestrator problem class.

**T16 problem-class check (plan-memory sub-problem):**
- Upstream problem class: «Server-side DB-backed Kanban persistence with cron-driven state machine.»
- Our problem class: «CLI-session-bound committed-markdown or file-based plan with deterministic bash refresh.»
- **Match? NO.** Same structural mismatch that produced SSOT #67.

**PROVISIONAL VERDICT: REJECT (already registered at SSOT #67).** No new row.

---

### 3.6 Devin Knowledge Notes (WebSearch 2026-05-25)

**WebSearch query:**

> «Devin knowledge notes persistent project plan session state management»

**Evidence:** Devin Knowledge Base = persistent store of tips/instructions that Devin **automatically recalls when relevant** based on trigger descriptions. Auto-generated repo note on repo setup. Knowledge items have content + trigger description; grouped into folders. **Machine Snapshots** = save states for machine setup. Knowledge is NOT a project-plan tracker — it is a convention/rule store (similar to `.claude/rules/*.md`).

**T16 problem-class check:**
- Upstream problem class: «Knowledge items (coding standards, workflows, conventions) stored as trigger-recalled notes; recall is AI-semantic, not deterministic; no task/umbrella tracking.»
- Our problem class: «Cross-session plan tracking PR-merge status + umbrella priority + kickoff existence; deterministic refresh.»
- **Match? NO.** Devin Knowledge Notes solve the rule-recall problem (analogous to our `.claude/rules/` layer), not the plan-state problem.

**PROVISIONAL VERDICT: REJECT for plan-memory feature. Note: Devin Knowledge Notes pattern is already covered by our existing `.claude/rules/` machinery — not a new gap.**

---

### 3.7 State-of-art sweep (WebSearch 2026-05-25)

**WebSearch query:**

> «AI agent persistent project plan memory across sessions orchestrator 2026»

**Key finding:** In 2026, production pattern is a **Memory Router** with multi-scope tagging (user_id, agent_id, run_id). Tools: Cognee, Zep, Mem0. Cloudflare Agent Memory (private beta April 2026). LangGraph for stateful graph-based orchestration. Team-scale shared memory is a «killer feature» for 2026.

**T16 problem-class check for Mem0/LangGraph:**
- Upstream problem class: «General-purpose AI agent memory with embedding-based retrieval, multi-scope tagging, cloud infrastructure.»
- Our problem class: «Single-maintainer project-specific plan with PR-merge factual state; bash-scriptable; no embedding needed; no cloud infra; committed markdown preferred.»
- **Match? NO on implementation class.** The problem of «AI agent remembering things across sessions» is solved at scale with embedding stores; our scale (one project, one maintainer, O(10) tracked umbrellas) is 3 orders of magnitude smaller. The general pattern confirms that cross-session persistence is a real need; the solution at our scale is committed-markdown (per Cline precedent), not a vector DB.

**PROVISIONAL VERDICT: REFERENCE (confirms the need exists; our implementation scale renders cloud memory tools over-engineered). BUILD-at-scale confirmed by upstream evidence.**

---

## §4 — Two viable design directions

These are NOT ranked. R-phase picks between them.

### Direction A: Plan lives in `wave-sequencing-plan.md` (extend-in-place)

**Where the plan lives:** the existing `docs/meta-factory/wave-sequencing-plan.md` (§0 table) is extended with new auto-updatable columns or a parallel `§0.cache` section.

**What's tracked:**
- Umbrella name + status (existing §0 rows)
- Last-reconcile timestamp per umbrella (new auto-filled field)
- UNTRACKED-NEW candidates (new auto-appended candidate list at bottom of §0)
- Priority score cache (auto-updated numeric score per umbrella)

**Sync direction:** Reality → plan (auto-write). After each `/meta-orchestrator` invocation, the skill edits `wave-sequencing-plan.md` §0 with updated facts. Purely factual updates (PR merged, kickoff appeared) auto-apply; strategy reordering surfaces as DECISION-NEEDED.

**Strategy-vs-factual line per row:**
| Update | Auto or Surface |
|--------|----------------|
| «PR #N merged» → mark row done | AUTO |
| «New kickoff appeared for umbrella X» → add UNTRACKED-NEW | AUTO (candidate only; promotion to full row = human) |
| «Priority score changed» → rewrite score field | AUTO (numeric, deterministic) |
| «Umbrella X priority > Y» → reorder rows | SURFACE as DECISION-NEEDED |

**Conflict resolution:** plan says ✅ done, gh shows PR not merged → skill emits DRIFT-N item (per existing §1 DRIFT protocol). Reality wins; plan is updated to match.

**Pros:**
- Single file, no new artifacts, PR-visible history, no `dual-implementation-discipline.md §7` risk.
- Existing §1 DRIFT logic already handles some of this.
- `wave-sequencing-plan.md` is the natural home per its own Authoritative-for header.

**Cons:**
- Strategy-bearing file becomes write-destination for auto-updates — coupling «strategy layer» (ordering, scope decisions) with «factual cache» (PR merge status). The `kickoff §3.2` table already flagged this: «Public diffs for routine reconciles add noise; coupling strategy with factual.»
- DRIFT from the auto-write itself: if two sessions run concurrently (parallel worktrees) and both try to edit §0, last-write-wins conflict.
- `wave-sequencing-plan.md` is ~80 lines of carefully-worded strategy text; auto-edit risk is high (Edit tool on strategy-bearing prose = high blast radius per [CLAUDE.md «Artifact Ownership Contract»](../../../CLAUDE.md)).

---

### Direction B: Shadow cache file (committed, separate from strategy)

**Where the plan lives:** new committed file `.claude/orchestrator-prompts/_plan-cache.md` (or `docs/meta-factory/plan-cache.md`) — a **factual-cache-only** artifact, separate from `wave-sequencing-plan.md`. `wave-sequencing-plan.md` remains the strategy SSOT; the cache is a derivative.

**What's tracked:**
- Auto-refreshable facts only: umbrella name, kickoff-exists bool, last-PR-merged date, UNTRACKED-merged-PRs count, last-reconcile timestamp, priority score (numeric).
- No prose strategy, no ordering rationale, no wave descriptions.
- UNTRACKED-NEW candidate list (populated automatically; cleared when human promotes to `wave-sequencing-plan.md`).

**Sync direction:** Reality → cache (auto-write). Cache → plan (DECISION-NEEDED surface, not auto-apply). The cache answers «what did we discover?»; the plan answers «what are we doing about it?»

**Strategy-vs-factual line per row:**
| Update | Target | Auto or Surface |
|--------|--------|----------------|
| «PR #N merged» → update factual field in cache | cache | AUTO |
| «New kickoff appeared» → add to UNTRACKED-NEW in cache | cache | AUTO |
| «Promote UNTRACKED-NEW to plan Track row» | `wave-sequencing-plan.md` | SURFACE (human decision) |
| «Priority score» → numeric field in cache | cache | AUTO |
| «Priority order change» | `wave-sequencing-plan.md` | SURFACE (human decision) |

**Conflict resolution:** cache auto-updates; `wave-sequencing-plan.md` never auto-updated; conflict only possible in cache (multiple concurrent sessions). Mitigation: cache is append-only for UNTRACKED-NEW; factual fields are idempotent (merging two «PR #N merged: true» entries is safe).

**Pros:**
- Clean separation: strategy file never auto-touched. `dual-implementation-discipline.md §7` satisfied (one SSOT per layer).
- Lower blast radius: auto-edits only touch the cache, not the strategy prose.
- Easier to test: cache has a strict schema (no prose); deterministic grep checks possible.
- Concurrent-session safe: factual cache tolerates idempotent merges; strategy file is never auto-written.

**Cons:**
- New artifact = new maintenance surface. Two-file read on each `/meta-orchestrator` invocation.
- Cache drift risk: if cache and `wave-sequencing-plan.md` describe the same umbrella differently, the discipline requires the cache to clearly defer — needs explicit `spec:` pointer per `dual-implementation-discipline.md §7`.
- Bootstrap: on first invocation, cache is empty. Skill must gracefully handle «no cache yet» → full scan → write. Subsequent: delta scan.

---

## §5 — R-phase questions

The R-phase must answer these before picking between Direction A and Direction B:

1. **Write-safety of `wave-sequencing-plan.md`:** measure the actual blast radius of an automated Edit to §0. How many lines is §0? What's the realistic worst-case when an edit corrupts a strategy row? Is a surgical Edit to a well-delimited §0.cache sub-section safe enough to satisfy Direction A?

2. **Cache-drift measurability:** for Direction B, design the `spec:` pointer and check mechanism per `dual-implementation-discipline.md §5`. Is a deterministic bash drift check feasible at ≤20 LOC? What does the `@dual-pair:` annotation look like for a markdown+markdown pair (vs bash+markdown)?

3. **Concurrent-session safety:** does this repo ever have two `/meta-orchestrator` sessions running in parallel worktrees on the same plan artifacts? Measure frequency from git log. If yes → Direction A (write to shared file) has a real race condition; Direction B (cache is idempotent) is structurally safer.

4. **Bootstrap cost:** if cache is empty on first invocation (Direction B), how long does the full-scan take? Is the L2 `plan-currency-check.sh` output (~85 UNTRACKED lines) processable in a single Edit to seed the cache? Or does the initial write require a separate slow step?

5. **Memory-codification.md §3 compliance:** whichever direction is chosen, does the plan-memory artifact qualify as a «durable convention» under `memory-codification.md §2`? If it lives in a committed file (both directions) — yes, it satisfies the rule. Verify the write-time discipline is applied at the skill's ship-time.

6. **reviewer-discipline.md §2 boundary audit:** for each auto-apply update in the strategy-vs-factual table (§4 above), verify: is this truly factual (deterministic, no AI judgment) or does it require strategy judgment in edge cases? A concrete test: what happens when a kickoff exists but no PR has ever been opened for it — is auto-registering it as UNTRACKED-NEW factual (it exists) or strategy (we might not want it tracked)?

7. **no-paid-llm-in-ci.md §1 check:** all refresh logic must be deterministic bash. Confirm: does any part of the priority re-scoring (§2 of SKILL.md) require LLM judgment? If yes — that part stays human-confirmed; auto-update applies only to the numerical score formula inputs (PR count, days since last merge), not to the multi-criteria weight application.

8. **Cline Memory Bank ADAPT boundary:** if Direction B is chosen and the cache file resembles a Cline `activeContext.md`, does the file need the same «must read at session start» discipline? Or does the `!shell` injection in SKILL.md §1 already cover the «read at start» requirement deterministically?

---

## §6 — Falsifiers

Scenarios under which **either direction is wrong or unnecessary**:

1. **If `gh pr list` stays under 5s response time** — the full L2 scan costs ≤5s per invocation. If the project stays at O(10) active umbrellas, there is no meaningful caching benefit. The current cost of re-discovery is negligible, not compounding. In this scenario, the «remember what I already discovered» layer adds maintenance overhead with minimal runtime gain. Falsifier fires if: `time bash plan-currency-check.sh` < 5s on the current repo.

2. **If the maintainer manually reconciles `wave-sequencing-plan.md` frequently enough** — PR #220 already did a manual reconcile for 2026-05-25. If the maintainer's habit is to reconcile on every wave-close, the gap between «what the skill discovers» and «what the plan knows» is typically ≤3 days and ≤5 PRs. Below that threshold, auto-write overhead (risk of corrupt edit, audit noise in git history) may exceed the benefit. Falsifier fires if: average UNTRACKED count at wave-close is ≤5.

3. **If the active umbrella count stays ≤4** — the current priority scoring (4-axis multi-criteria) is already fast mental math on ≤4 candidates. Persistent priority score caching adds no decision speed at small N. Falsifier fires if: `ls .claude/orchestrator-prompts/*/kickoff.md | wc -l` stays ≤6.

4. **If the `state.md` companion already satisfies the need** — each `/meta-orchestrator <umbrella>` invocation already writes a `state.md` per the SKILL.md §10 spec. If the orchestrator re-reads the previous run's `state.md` on each invocation, it already has the prior-session snapshot for that umbrella. The cross-session memory problem is already ≥50% solved for the single-umbrella case; the gap is only in the global no-argument case. Falsifier fires if: `state.md` lifetime analysis shows it covers the maintainer's actual use pattern.

5. **If `dual-implementation-discipline.md §7` forces too much overhead on Direction B** — the cache SSOT pointer + drift check mechanism may cost more to maintain than it saves. If the R-phase benchmarks the drift check at >30 LOC with non-trivial false-positive rate, Direction B degrades into a maintenance burden. Falsifier fires if: the Direction B drift check cannot be implemented in ≤25 LOC with >90% precision.

---

## §7 — §1.7 self-reflexive check

**Forward-check (this brainstorm complies with existing disciplines):**

- `no-paid-llm-in-ci.md §1` — no API-billed LLM calls made in this session. All prior-art evidence from DeepWiki + WebSearch (session-subscription-bound). All proposed update mechanisms in §4 are deterministic bash or committed markdown. ✅
- `build-first-reuse-default.md §3` — prior-art candidates consulted with T16 problem-class checks per §3 above. DeepWiki ×5 repos queried (Cline ×2, TaskMaster ×1, Superpowers ×2, OpenHands ×1). WebSearch ×3+ phrasings run. ✅
- `recommendation-laziness-discipline.md §3 (T20)` — every verdict in §3 is backed by a tool-call output quoted in the same section (DeepWiki excerpts, WebSearch result descriptions). No inline verdict without preceding evidence-tool-call. ✅
- `reviewer-discipline.md §2` — brainstorm presents two directions without picking between them (§4). No strategy picked; R-phase questions listed in §5. ✅ (T-PM-A anti-pattern avoided)
- `dual-implementation-discipline.md §7` — Direction B explicitly plans for the SSOT pointer; flagged as R-phase question item 2. ✅
- `memory-codification.md §3` — flagged as R-phase question item 5 to verify compliance at ship time. ✅
- `doc-authority-hierarchy.md §3` — this file carries required header (Authoritative-for + NOT authoritative-for + Class equivalent). ✅
- `phase-research-coverage.md §1.12` — brainstorm leads with factual decomposition, not option-dumping; R-phase questions are operationalizable (measurable). ✅

**Backward-check (no existing artifact is silently superseded):**

- This brainstorm does NOT modify `wave-sequencing-plan.md`, SKILL.md, `plan-currency-check.sh`, or any rule file.
- This brainstorm does NOT append to `prior-art-evaluations.md` (SSOT rows are explicitly deferred to R-phase per kickoff §8 constraint).
- Existing SSOT rows #27/#64/#67/#72/#73/#74 are cited as references but NOT modified.
- No new helper scripts created. No new rules created. ✅

---

## §8 — Recurrence-risk note (T-PM-A + T15 self-application gate)

**T-PM-A (brainstorm-overstepping-to-architecture):** This brainstorm presents two directions (§4) with explicit R-phase questions rather than a single winning architecture. The T-PM-A trap was «brainstorm output reads `we should build X with Y`» — checked: §4 uses «Where the plan lives / What's tracked / Sync direction» structure, not «we will implement Z». The directions name design forks, not implementation decisions. ✅

**T15 (recursive self-application — §3.7):**

Does THIS umbrella's own plan-of-action live in the stored plan? The `meta-orchestrator-plan-memory` umbrella itself should be discoverable by the plan-memory feature it describes.

**Direct answer:** No — as of 2026-05-25, `wave-sequencing-plan.md §0` does not contain a Track row for `meta-orchestrator-plan-memory`. The L2 `plan-currency-check.sh` UNTRACKED-KICKOFF output would emit: `UNTRACKED-KICKOFF: meta-orchestrator-plan-memory has kickoff.md but not in §0`.

**Bootstrapping question (kickoff §3.7):** how does the first plan-entry get created? The plan-memory feature, once built, would auto-register itself as UNTRACKED-NEW on the first invocation — but only after it is built. Before it is built, there is no mechanism to auto-register. This is a genuine bootstrapping gap:

- **If Direction A** (write to `wave-sequencing-plan.md`): the first registration must be done manually (add a Track row for `meta-orchestrator-plan-memory` to §0). After the feature ships, subsequent umbrellas are auto-registered.
- **If Direction B** (shadow cache): the cache starts empty; on first invocation, it scans and discovers `meta-orchestrator-plan-memory` kickoff as UNTRACKED-NEW, adds it to the cache as a candidate. The cache file is created automatically. But `wave-sequencing-plan.md` still needs a manual Track row for the umbrella to be formally planned.

**Resolution:** in both directions, the first Track row for any umbrella (including this one) requires a human decision (per §4 strategy-vs-factual table: «UNTRACKED-NEW → promote to full Track row = human»). The bootstrapping is not a blocker — it is the expected behavior. The auto-registration feature reduces the discovery cost (human doesn't have to notice the UNTRACKED), not the admission cost (human still decides to admit to the plan).

**T15 recursion confirmed handled.** The self-application note for R-phase: when shipping the plan-memory feature, the umbrella's own Track row should be added to `wave-sequencing-plan.md` in the same PR that ships the feature — making the first self-application visible in the commit history.

---

## See also

- [kickoff.md](../../../.claude/orchestrator-prompts/meta-orchestrator-plan-memory/kickoff.md) — brainstorm kickoff (origin of this patch)
- [SKILL.md §1–§2](../../../.claude/skills/pipeline/SKILL.md) — current plan-currency + priority sections (the read-only surface this feature extends)
- [helpers/plan-currency-check.sh](../../../.claude/skills/pipeline/helpers/plan-currency-check.sh) — L2 detection (the write-back missing half)
- [docs/meta-factory/wave-sequencing-plan.md §0](../wave-sequencing-plan.md) — current plan SSOT (Direction A write target)
- [docs/meta-factory/research-patches/2026-05-25-planner-completeness-prior-art.md](2026-05-25-planner-completeness-prior-art.md) — L3/L4/L5 R-phase (predecessor; SSOT rows #72-#76 registered there)
- [docs/meta-factory/research-patches/2026-05-23-meta-orchestrator-prior-art.md](2026-05-23-meta-orchestrator-prior-art.md) — original /meta-orchestrator BUILD verdict (SSOT rows #66-#70)
- [.claude/rules/memory-codification.md §3](../../../.claude/rules/memory-codification.md) — write-time discipline for durable conventions
- [.claude/rules/dual-implementation-discipline.md §7](../../../.claude/rules/dual-implementation-discipline.md) — SSOT pointer requirement for Direction B
- [.claude/rules/reviewer-discipline.md §2](../../../.claude/rules/reviewer-discipline.md) — strategy-vs-factual boundary (§4 strategy-vs-factual table)
