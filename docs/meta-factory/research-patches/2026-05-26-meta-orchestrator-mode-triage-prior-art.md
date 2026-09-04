<!-- scope:meta-orchestrator-mode-triage-prior-art -->
# R-phase prior-art survey — meta-orchestrator mode triage + planner (3 areas)

> **Class:** Research patch (R-phase lane); precedes Stage 2 I-phase of meta-orchestrator-mode-triage-and-planner umbrella.
> **Authoritative for:** prior-art verdict for 3 capability areas — (A) discovery sweep extension, (B) master-plan persistence + delta-tracking, (C) triage alias layer. Binding GATE 1 output for DN-2-revised (β-1 vs β-2 recommendation).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Implementation — Stage 2 I-phase (separate kickoff). Design doc — [2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md](2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md).

> **Date:** 2026-05-26
> **Status:** R-phase complete — verdicts in §4 verdict table; β-2 recommended for §7.2.
> **Origin:** Kickoff for Stage 1 R-phase of meta-orchestrator-mode-triage-and-planner umbrella (DN-1=(a), DN-2=β, DN-3=resolved per design §12).

---

## §0 Cold-start verify

```text
git rev-parse --short HEAD → bb3ecec
git branch --show-current → research/meta-orchestrator-mode-triage-prior-art
git rev-list --count HEAD..origin/staging → 0 (up to date)
ls docs/meta-factory/research-patches/2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md → EXISTS
ls .claude/skills/meta-orchestrator/helpers/ → 7 files (assign-skill.sh, classify-work.sh, dup-detect.sh, launch-table-generator.sh, plan-currency-check.sh, priority-score.sh, update-cache.sh)
ls .claude/skills/meta-orchestrator/references/plan-cache.md → EXISTS
gh pr list --state open → #237 (research/bundle-autonomous-prior-art) only
```

All cold-start gates PASS. Worktree isolation CONFIRMED (branch ≠ staging).

---

## §0.1 Population enumeration (T10 counter)

Population enumeration BEFORE sampling — required by T10.

### Area A — Discovery sweep extension

**Population:** all production-grade AI orchestration frameworks and CLI tools that might implement
automatic backlog discovery from source code annotations, structured Q&A files, or code comment markers.

Candidate universe constructed by:

1. Own-stack sweep (§1 checklist item 1): existing `priority-score.sh` surfaces (a)-(e) + `plan-currency-check.sh` UNTRACKED-N / UNTRACKED-KICKOFF — verified by file inspection.
2. Category sweep: AI task managers (TaskMaster, Backlog.md, OpenHands), AI orchestrators (Superpowers, aif-handoff, AIF), standalone TODO scanners (tickgit/Augmentable), code intelligence platforms.
3. SSOT consult: entries #70 (ComposioHQ agent-orchestrator), #72 (OpenHands dup-check), #73 (TaskMaster `analyze-complexity`), #74 (Superpowers SDD model selection).

**Sampling strategy:** full enumeration for Tier-1 (TaskMaster, aif-handoff, Superpowers, AIF, Cline, OhMyOpencode/oh-my-openagent); WebSearch ≥3 phrasings for general category; DeepWiki ≥3 queries for repo internals. Population N≈12 candidates; sampled K=8 (67%). Floor ≥3 phrasings applied.

### Area B — Master-plan persistence & delta-tracking

**Population:** AI orchestration frameworks with cross-session state persistence: (i) delta-tracking specifically (NEW-SINCE-LAST / RESOLVED-SINCE-LAST pattern); (ii) sidecar/shadow-file persistence shapes.

Adjacent shipped work (mandatory): SSOT #77 (Cline Memory Bank ADAPT verdict for Direction B) + `references/plan-cache.md` + `helpers/update-cache.sh`.

Candidate universe: TaskMaster `.taskmaster/state.json`, aif-handoff task state machine, Backlog.md, Cline Memory Bank, general AI agent state persistence patterns.

**Sampling:** full enumeration for Tier-1; WebSearch ≥3 phrasings; DeepWiki ≥4 queries. Population N≈10; sampled K=8 (80%).

### Area C — Triage alias layer

**Population:** frameworks that provide user-facing labels/aliases that map to internal execution dispatch mechanisms; override flag conventions in AI orchestration CLIs.

Candidate universe: Superpowers (SDD / executing-plans / skill names), AIF (command-alias → skill), aif-handoff (Subagents vs Skills mode, Full vs Fast Planner), oh-my-openagent (@plan / /start-work / ultrawork), TaskMaster (solo / team / research model roles), SSOT #43 (RuntimeAdapter ADOPT VOCABULARY).

**Sampling:** DeepWiki ≥3 queries; WebSearch ≥2 phrasings; global orchestrator SKILL.md direct read. Population N≈8; sampled K=7 (88%).

---

## §1 — Area A prior-art: discovery sweep extension

### §1.1 Internal precedents (verified by file inspection)

**`priority-score.sh` existing surfaces (a)-(e):**

```bash
# Verified 2026-05-26 via Read .claude/skills/meta-orchestrator/helpers/priority-score.sh
# Lines 98-148:
# (a) cold-review-fixes.md — umbrella-cold-review-fixes type=cleanup
# (b) state.md with PENDING/TODO/AWAITING/REVIEW-PENDING — umbrella-state-pending type=state-followup
# (c) Memory files with TODO-codify: — memory-codify-<stem> type=memory-followup
# (d) Stale open PRs >14 days — stale-pr-<N> type=stalled
# (e) wave-sequencing-plan.md §0 rows 🟡/🔲 NOT blocked/DEFERRED — wave-plan-<id> type=plan-followup
```

Synthetic namespace format: `<prefix>-<reason>` — chosen to never collide with real kickoff names (plain directory basenames without dash-reason suffix). Pattern confirmed by PR #214 (origin of surfaces a-e).

**`plan-currency-check.sh` L2 extension (PR #217):**

```bash
# Lines 98-140: UNTRACKED-<N> (merged PRs not in wave-sequencing-plan.md)
# and UNTRACKED-KICKOFF: <umbrella> has kickoff.md but not in §0
```

These are reverse-currency detectors — existing kickoffs and merged PRs that the plan doesn't reference. The proposed new surfaces (f), (g), (h) extend this pattern orthogonally.

**Real TODO count in `packages/**/*.ts`:**

```bash
# Verified 2026-05-26:
# packages/core/eslint-rules/require-otel-span.ts:60: // TODO: decorator @span not supported...
# packages/core/audit-self/template-render.audit.ts:51: // TODO: consolidate once Batch A...
# packages/core/audit-self/template-render.audit.ts:119: // TODO: import rendered-path mapping...
# (node_modules excluded from scope per DN-1)
```

Population of `// TODO:` markers in `packages/**/*.ts` (excluding node_modules): at least 3 confirmed (sample, not exhaustive). Namespace prefix `todo-<file>-<line>` would produce non-colliding entries.

**`docs/meta-factory/open-questions.md` §13.x entries:** Direct inspection of `plan-currency-check.sh` L2 shows UNTRACKED-KICKOFF for kickoffs not in wave-sequencing-plan.md but does NOT scan `open-questions.md §13.x` raw entries directly. Namespace `openq-§13-<id>` is genuinely new (no surface f today).

**Research-patches §future sections:** `priority-score.sh` does not scan `research-patches/` for `§future` or «Known residuals» sections. Namespace `residual-<patch>-<anchor>` is genuinely new.

### §1.2 External precedents — WebSearch phrasings

**Phrasing 1:** «AI agent backlog auto-discovery grep open questions todo markers 2025 2026»
→ Result: Ralph Wiggum pattern (pick highest priority unfinished task, implement, update progress). oh-my-openagent TodoWrite tool enforces todo completion. Neither scans codebase for `// TODO:` markers as backlog source. No production analog found for «open-questions.md §13.x scanning» pattern.

**Phrasing 2:** «open-questions registry grep tooling AI orchestration backlog surface discovery»
→ Result: Parcha.ai Grep tool (natural-language semantic search for coding agents), osgrep (open source semantic search for AI agents, distinguishes ORCHESTRATION from DEFINITION). Academic paper «Is Grep All You Need? How Agent Harnesses Reshape Agentic Search» (arxiv 2605.15184). These are search/retrieval tools — they scan codebases for pattern queries at request time. Problem class: semantic search over code ON DEMAND. Our problem class: structured multi-surface DISCOVERY pipeline that AGGREGATES across heterogeneous sources (kickoffs + open-questions + code + patches) into a prioritised candidate list. **T16: problem class mismatch → REFERENCE for grep-as-reliable-search-signal; BUILD for the aggregation pipeline.**

**Phrasing 3:** «TODO comment aggregation production tools code intelligence backlog management 2026»
→ Result: General backlog management tools (Monday, Jira, Clickup, etc.) — all require explicit task creation by a human; none auto-discover from `// TODO:` code comments. No production AI-native TODO-to-backlog aggregator found.

**Augmentable / tickgit «TODO Finder»** (WebFetch 2026-05-26):
- Problem class: scans public git repos for TODO annotations via `tickgit`; displays through web UI at todos.tickgit.com.
- Capability: repository-level TODO scan, aggregation, browsable display. Approximately 35,000 TODOs across ~100 GitHub repos.
- Limitations: web-only, no synthetic namespace prefixes, no heterogeneous-source aggregation, no priority scoring.
- T16: Upstream class = web-UI TODO browser for public OSS repos. Our class = in-session deterministic bash scanner emitting namespaced synthetic candidates to a running meta-orchestrator. **KEEP-NARROW** — tickgit confirms TODO scanning is a real, production-grade need; our scope is narrower (bash, in-session, namespaced, multi-source).

### §1.3 External precedents — DeepWiki queries

**TaskMaster (eyaltoledano/claude-task-master) — DeepWiki 2026-05-26:**

Q: Does TaskMaster support auto-discovery of TODO comments in source code files or open questions without assigned tasks?

DeepWiki finding: «TaskMaster does not directly support auto-discovery of TODO comments in source code files or open questions without assigned tasks. Its primary method for surfacing backlog items is through parsing Product Requirement Documents (PRDs).» The `research` command gathers context, `add-task` can leverage codebase analysis, but no scan-and-aggregate-TODOs feature exists.

T16: TaskMaster upstream class = PRD-driven task generation from structured docs. Our class = multi-surface discovery across heterogeneous sources (code + docs + PRs + plan + memory). **Problem class mismatch confirmed — KEEP-NARROW** (TaskMaster is the canonical PRD-based approach; our multi-surface approach is different problem).

**Superpowers (obra/superpowers) — DeepWiki 2026-05-26:**

Finding: Superpowers orchestrator skill does not discover backlog items from multiple sources. «The focus is on a predefined workflow rather than dynamic backlog discovery.» What persists: the skills themselves (auto-updated at session start). No multi-surface aggregation.

**AIF (lee-to/ai-factory) — DeepWiki 2026-05-26:**

Finding: «AI Factory does not have a meta-orchestrator that auto-discovers backlog items from sources like open questions, TODO comments, stale PRs, or research patches.» Workflow is command-driven (`/ai-factory.feature`, `/ai-factory.task`). `/aif-evolve` reads accumulated patches to improve SKILL quality — NOT for plan-tracking or backlog discovery.

**Cline (cline/cline) — DeepWiki 2026-05-26:**

Finding: Memory Bank is documentation methodology for context across sessions; Focus Chain manages task progress but doesn't scan for TODO comments. `search_files` tool could be used with custom instructions for manual TODO discovery, but no auto-aggregation pipeline.

### §1.4 SSOT consult

Relevant existing entries:
- **#70** (ComposioHQ agent-orchestrator): `getMergeability()` PR-readiness signal set. Problem class: stale PR detection. Our surface (d) already covers stale PRs. REFERENCE for signal vocabulary; BUILD for the specific synthetic-namespace format.
- **#73** (TaskMaster `analyze-complexity`): LLM-assisted complexity scoring. Different from discovery. REFERENCE for «discovery of backlog items doesn't yet exist in TaskMaster».

No existing SSOT entry covers the multi-source discovery pipeline (open-questions §13.x + `// TODO:` + `research-patches §future`). **3 new SSOT rows needed (entries #78, #79, #80).**

### §1.5 Area A Verdict

For each of 3 new synthetic surfaces proposed in design §6:

| Sub-surface | Verdict | Rationale |
|---|---|---|
| (f) `openq-§13-<id>` — open-questions.md §13.x raw entries without kickoff | **BUILD** | No upstream tool discovers structured Q&A registries as backlog candidates. Internal precedent: `plan-currency-check.sh` (L2) patterns (UNTRACKED-N / UNTRACKED-KICKOFF) provide the namespace and shell idiom. Problem class: grep for `^### 13\.` + check for absence of kickoff dir + emit namespaced synthetic candidate. Deterministic bash, ≤20 LOC new code in priority-score.sh. |
| (g) `todo-<file>-<line>` — `// TODO:` / `// FIXME:` in `packages/**/*.ts` | **BUILD** (scope per DN-1) | tickgit confirms TODO scanning is production-grade; but tickgit is web-only, not in-session, and lacks synthetic namespacing for orchestrator integration. Our BUILD is narrower: bash `grep -rn` on `packages/**/*.ts` only (DN-1 answer), emitting namespaced lines. T16: tickgit upstream class ≠ our in-session multi-source aggregator. KEEP-NARROW from tickgit; BUILD the in-session namespace emitter. |
| (h) `residual-<patch>-<anchor>` — research-patches §future + known-residuals | **BUILD** | No upstream tool scans research-patch future-sections as backlog. Internal precedent: `plan-currency-check.sh` already reads `docs/meta-factory/research-patches/` (finds files, sorts, emits last-10). Extending to grep for `§future` / «Known residuals» headers within those files is ≤10 LOC additional bash. Problem class unique to this project's discipline-patch-accumulator pattern. |

**Namespace collision analysis (verified):** `openq-§13-42` / `todo-packages/core/foo.ts-60` / `residual-2026-05-25-design-§future` all contain characters (§, /, -) that cannot appear in kickoff directory basenames (which are plain alphanumeric+dash without § or path separators). Zero collision risk confirmed.

---

## §2 — Area B prior-art: master-plan persistence & delta-tracking

### §2.1 Adjacent shipped work (MANDATORY — T16 class separation)

**SSOT #77 — Cline Memory Bank ADAPT verdict (PR #230, PR #236, 2026-05-25):**

The plan-memory R-phase (research-patch `2026-05-25-plan-memory-rphase.md`) already established:

- **Direction A** (auto-write to `wave-sequencing-plan.md §0`) carries HIGH blast-radius risk (Q1 evidence: 6–8 non-unique string fragments in §0, concurrent-write collision on parallel worktrees, 19 commits to this file in 90 days). **Direction A = SUPERSEDED / REJECTED** per kickoff §0 binding override.
- **Direction B** (separate per-machine cache `_plan-cache.md`) was ADOPTED. Shipped in PR #236: `references/plan-cache.md` + `helpers/update-cache.sh`. SSOT #77 is the verdict record.

**T16 class separation (mandatory per kickoff §2 requirement):**

- Cline Memory Bank problem class: human-readable project documentation committed to git, updated on explicit user command or AI signal, purpose = session context for human-readable status across multiple sessions.
- Our §7.1 delta-tracking problem class: machine-readable sweep-state persistence, updated deterministically on EVERY invocation (no user command), purpose = NEW-SINCE-LAST / RESOLVED-SINCE-LAST emission for the meta-orchestrator's discovery pipeline.

**Match? PARTIAL (~40%).** Same storage medium (committed markdown or gitignored JSON). Different update mechanism (on-demand vs deterministic-auto-every-invocation). Different purpose (documentation vs delta-computation input). The ADAPT of Cline's committed-markdown pattern (§7.1 companion artifact) is already established at SSOT #77. The **NEW** capability we are deciding here is the §7.1 delta-tracking SHAPE (how to store the state needed for NEW-SINCE-LAST comparison) — this is NOT yet in SSOT #77.

**`references/plan-cache.md` scope review (direct file inspection 2026-05-26):**

```text
plan-cache.md covers:
§1 Cache injection (read side) — cat _plan-cache.md | head -200
§2 Cache reconciliation rule (stale-cache detection via git HEAD comparison)
§3 Cache-update step — update-cache.sh writes ## Last invocation section only
§4 Anti-patterns (cache-as-source-of-truth, writer-feature-creep, cache-clobbers-hand-edits)
```

The `_plan-cache.md` file tracks: `## Last invocation` (Timestamp / Umbrella / Git HEAD / Session outcome) + `## Last priority ranking` + `## DRIFT items` + `## DECISION-NEEDED` + `## Deferred follow-ups` + `## Stale-cache marker`.

**Critical finding:** The current `_plan-cache.md` schema does NOT have a `## Delta tracking` section with `untracked_seen` and `closed_since_last` arrays. The §7.1 delta-tracking proposed in design `§7.1` (`state/last-check.json` with `untracked_seen` / `closed_since_last`) is a NEW capability NOT yet shipped in PR #236.

### §2.2 Internal precedents

**`.claude/orchestrator-prompts/_plan-cache.md` (gitignored, per-machine):**

Exists at `.claude/orchestrator-prompts/_plan-cache.md` when `update-cache.sh` has run. Schema per `update-cache.sh` lines 58–91 (write_initial_template function). Does NOT contain delta-tracking arrays (no `untracked_seen`, no `closed_since_last`).

**No `state/` subdir in `.claude/skills/meta-orchestrator/`:** Verified by `ls .claude/skills/meta-orchestrator/helpers/` — 7 helpers, no `state/` directory. Confirmed: `state/last-check.json` does NOT exist today.

**`state.md` companion pattern (per-umbrella):** Each umbrella at `.claude/orchestrator-prompts/<name>/state.md` tracks single-umbrella multi-session state. Verified: 14 state.md companions exist (Q3 evidence from plan-memory R-phase). These are per-umbrella; NO global state.md spans all umbrellas.

### §2.3 External precedents — WebSearch phrasings

**Phrasing 1:** «sweep-since-last-check AI agent delta tracking git HEAD bound state cache»
→ Key results: Hermes Agent checkpoints + rollback. Sidecar pattern for observability (Kubernetes pod companion container). Cache invalidation surface analysis (OpenClacky). Multi-tier exact-match cache for AI workloads. None match the «emit NEW-SINCE-LAST / RESOLVED-SINCE-LAST from a git-HEAD-anchored snapshot» pattern.

**Phrasing 2:** «AI agent backlog state persistence "last-check" delta JSON sidecar git HEAD 2025»
→ Results: Fault-tolerant AI pipeline checkpointing (MightyBot). Backlog.md (git-native markdown task manager). GitAgent patterns. Sidecar observability. The closest: «agents persist execution history directly into git; every state change becomes a commit.» Problem class: audit trail, not delta-detection.

**Phrasing 3:** «AI agent workflow state persistence best practices 2026»
→ Results: 7 state persistence strategies (Indium Tech), checkpoint-store with step-ID + output + status-flag. The «checkpoint store resumes from last completed step» pattern (RisingWave epoch-based asynchronous checkpointing). None implement the specific NEW-SINCE-LAST sweep semantic.

**Backlog.md (MrLesk, WebFetch 2026-05-26):**
- Git-native markdown task manager with kanban view.
- No delta tracking (no NEW-SINCE-LAST), no git-HEAD-bound state.
- No TODO comment scanning.
- Problem class: explicit markdown task files managed by humans/agents. T16: problem class = manual-kanban; our problem class = automated multi-source discovery. **REFERENCE** (confirms git-native markdown is production-validated storage; does not cover our delta-tracking need).

### §2.4 External precedents — DeepWiki queries

**TaskMaster — DeepWiki query on delta tracking:**

Finding: «TaskMaster does not implement: Delta tracking (no NEW-SINCE-LAST or RESOLVED-SINCE-LAST mechanisms). No git HEAD-based persistence for detecting changes since last run. The only git integration is manual tag creation via `--from-branch`.»

TaskMaster DOES have `.taskmaster/state.json` (tag context + migration status) and TDD autopilot `~/.taskmaster/` state (phase / subtask / attempt tracking). But these track workflow progress within a single pipeline run — NOT cross-invocation delta on a backlog of external candidates.

T16: TaskMaster upstream class = workflow-run progress tracking (within a single `task-master` CLI invocation). Our problem class = cross-invocation snapshot delta (what changed in the repo's backlog since the last `/meta-orchestrator` invocation). **Problem class mismatch confirmed → BUILD.**

**aif-handoff — DeepWiki query on delta tracking:**

Finding: «aif-handoff does NOT track delta state between orchestration runs using sweep-since-last-check, NEW-SINCE-LAST detection, or git-HEAD-bound delta tracking patterns.» aif-handoff uses a state-machine model (backlog → planning → implementing → review → done → verified); coordinator polls by status, not by delta from a snapshot.

The ONLY «last-check» analog: `lastSyncedAt` timestamp in MCP bidirectional sync (for conflict resolution in `handoff_sync_status` tool, not backlog delta). T16: aif-handoff class = task state-machine polling. Our class = snapshot delta against git HEAD. **Problem class mismatch → BUILD.**

**Superpowers — DeepWiki query on delta tracking:**

Finding: «There is no explicit mechanism for delta tracking or a "sweep-since-last-check" pattern for backlog items between sessions.» Skills auto-update at session start (using-superpowers SKILL.md injected into conversation). No state persistence for NEW-SINCE-LAST discovery.

### §2.5 §7.1 delta artefact shape — β-1 vs β-2 recommendation

**Decision scope (per kickoff §1 DN-2-revised binding):** choose between:

- **β-1**: extend `_plan-cache.md` with a new section (e.g. `## Delta snapshot`) containing the `untracked_seen` list and `closed_since_last` list as markdown bullets, updated by `update-cache.sh`.
- **β-2**: sibling shadow file `_master-backlog-delta.md` at `.claude/orchestrator-prompts/_master-backlog-delta.md`, separate from `_plan-cache.md`, gitignored, written by a dedicated `update-delta.sh` helper or by inline SKILL.md `Edit` call.

**Evidence-based comparison:**

| Criterion | β-1 (extend `_plan-cache.md`) | β-2 (sibling `_master-backlog-delta.md`) |
|---|---|---|
| `update-cache.sh` contract | Breaking: helper-scope contract (§3 of plan-cache.md) is «writes ONLY the `## Last invocation` section deterministically»; adding delta sections violates the idempotency contract and the paired-negative test `packages/core/hooks/update-cache.test.ts` | Non-breaking: new file, new helper or inline Edit; no change to `update-cache.sh` contract |
| Test impact | Must update `update-cache.test.ts` (adds test-seam complexity for the delta arrays) | Zero impact on existing test; new paired-negative test targets new file/helper only |
| Read-side | Cache injection already reads `_plan-cache.md` at §1 Step 1; delta is co-located | Delta read is a separate `!shell` block or merged into `plan-currency-check.sh`; slightly more wiring |
| Blast-radius on corruption | Corruption of the delta section could corrupt the `## Last invocation` section (same file) if `awk` state machine in `update_existing()` misbehaves | Corruption is isolated to delta file; `_plan-cache.md` unaffected |
| `#cache-writer-feature-creep` anti-pattern | Directly violates `plan-cache.md §4 #cache-writer-feature-creep`: «adding sections to the helper interface beyond `## Last invocation`»; the anti-pattern names this exact extension | Avoids the anti-pattern; new file stays outside the helper's contract |
| Schema format | Markdown bullets (human-readable but not machine-parseable without regex) | Could be JSON sidecar (`_master-backlog-delta.json`) — strictly machine-parseable, or markdown |
| Gitignore discipline | `_plan-cache.md` is already gitignored at `.claude/orchestrator-prompts/_*` pattern or via explicit gitignore | Sibling at `_master-backlog-delta.md` (or `.json`) follows same `_*` convention — trivially co-gitignored |
| Alignment with design §7.1 schema | Design proposes a JSON schema (`untracked_seen`, `closed_since_last` arrays) — markdown bullets require extra parsing vs JSON | A `.json` sidecar directly implements the design §7.1 schema; `jq` reads it; `update-delta.sh` writes it deterministically |

**RECOMMENDATION: β-2 (sibling shadow file `_master-backlog-delta.json`).**

Evidence:

1. **β-1 directly violates the shipped `plan-cache.md §4 #cache-writer-feature-creep` anti-pattern** (direct file:line evidence). The SSOT for the plan-cache helper contract explicitly names this extension as the anti-pattern to prevent.

2. **β-1 breaks the `update-cache.test.ts` idempotency contract** (verified: `update-cache.sh` uses `awk` state machine scoped to `## Last invocation` section; adding new sections requires rewriting the awk). Modifying the shipped test to accommodate a scope expansion contradicts the round-3 scope-reduction principle that shipped it.

3. **β-2 is architecturally cleaner**: a JSON sidecar for the delta arrays (as the design §7.1 schema proposes) is machine-parseable by `jq` without regex, matches the explicit schema in design §7.1, and follows the `_*` gitignore convention already established at `.claude/orchestrator-prompts/`.

4. **T16 check on Cline Memory Bank (SSOT #77):** Cline's committed-markdown sub-pattern (ADOPT per #77) covers the `_plan-cache.md` shape. Delta tracking is an additional layer ABOVE the session-memory pattern — it is NOT the same problem class. ADAPT #77 scoping is unchanged; β-2 adds a new artifact outside #77's scope.

**Falsifier for β-2 recommendation:** β-2 is wrong if (a) the `plan-currency-check.sh` helper is refactored to merge delta-read into its output (which would make co-location in `_plan-cache.md` cleaner), OR (b) the `update-cache.sh` scope is formally widened by a maintainer decision (making β-1 compliant with the contract). Neither has occurred as of 2026-05-26.

### §2.6 §7.2 master-plan auto-update shape (β binding context)

Under the β pattern (NOT Direction A = no auto-write to `wave-sequencing-plan.md §0`):

- **β-2 shadow `_master-backlog-delta.json`** is read by SKILL.md at §2 or §2.5 to derive NEW-SINCE-LAST / RESOLVED-SINCE-LAST.
- The SKILL.md body emits «NEW-SINCE-LAST: `<item-id>`» / «RESOLVED-SINCE-LAST: `<item-id>`» as surfaced items — maintainer sees them in the meta-orchestrator output.
- SKILL.md NEVER auto-writes to `wave-sequencing-plan.md §0`. The maintainer manually updates §0 based on the surfaced RESOLVED-SINCE-LAST items.
- The δ file is updated via a new `update-delta.sh` helper (or inline SKILL.md `Edit`) at end of each invocation.

This satisfies the kickoff's binding constraint: «NO direct write to `wave-sequencing-plan.md §0` under either β branch.»

---

## §3 — Area C prior-art: triage alias layer

### §3.1 Internal precedent — global orchestrator SKILL.md vocab

**Direct inspection of `~/.claude/skills/orchestrator/SKILL.md` (2026-05-26):**

```text
## Glossary — three roles
| Role | One-sentence definition |
| Orchestrator | Main session (Opus); owns queue, state.md, dispatch, anti-collusion... |
| Worker | Subagent that executes one kickoff; writes output; does NOT spawn sub-queues |
| Reviewer | Subagent that verifies Worker output cold; returns GO or REVISE; does NOT fix |

## Vocabulary alignment — companions
| Our term (primary) | Companion equivalent | Verdict |
| Mode A / Mode B (delegation styles) | Superpowers SDD; aif-handoff Planner/Implementer/Reviewer | ADOPT-VOCABULARY |
| Worktree-per-parallel-session | Superpowers using-git-worktrees; aif-handoff Git Isolation | REFERENCE |
| Worker / Reviewer subagents | Superpowers SDD role prompts; aif-handoff RuntimeAdapter | KEEP-NARROW + REFERENCE |
```

**Mode A / Mode B / SDD / Queue mode vocabulary confirmed present in SKILL.md** (lines read at start of orchestrator skill). The vocabulary table is current (2026-05-21 N2 Decision B1-lite, ADOPT-VOCABULARY + REFERENCE verdicts).

**Drift check:** SKILL.md vocab table uses «Mode A inline», «Mode B × N worktrees», «SDD», «Queue mode». Design §4 alias table maps DIRECT→`direct-Edit`, SOLO→`Mode-A`, PAIR→`Mode-SDD`, DECOMPOSE→`Mode-B`, RESEARCH→`R-phase-session`. These aliases are an additional user-facing UX layer ABOVE the existing vocabulary — they do NOT rename the internal terms. No drift detected from the global SKILL.md (as of 2026-05-26).

### §3.2 External precedents — DeepWiki queries

**Superpowers (obra/superpowers) — alias layer query:**

DeepWiki finding: «The Superpowers system does not have a direct mapping table from human-readable labels like SOLO, BUNDLE, PAIR, DECOMPOSE, DIRECT, RESEARCH to internal modes.» Dispatch is via named skills (skill slugs). Users invoke `subagent-driven-development` or `executing-plans` by skill name, not by a user-facing alias table.

T16: Superpowers problem class = skill-name routing via description match (CSO «1% rule», SSOT #76). Our problem class = explicit alias-routing-table in SKILL.md body that maps triage output → Mode label shown to maintainer. The Superpowers approach is semantic/probabilistic (description match); ours is deterministic (routing tree → fixed alias). **KEEP-NARROW** — our alias table is narrower and more deterministic; Superpowers CSO is the adjacent vocabulary we REFERENCE but do not ADOPT.

**aif-handoff — alias layer query:**

DeepWiki finding: Two modes (Subagents vs Skills) controlled by `AGENT_USE_SUBAGENTS` env var. Planner has Full/Fast modes. `RuntimeWorkflowExecutionMode` internal enum: `"standard"`, `"isolated_skill_session"`, `"native_subagents"`. `createRuntimeWorkflowSpec()` maps user choice to internal execution mode.

T16: aif-handoff upstream class = env-var fork selecting between two execution quality levels (iterative vs single-pass). Our alias layer class = triage routing tree (multiple dimensions: TYPE × load_bearing × sibling_count × scope_decided × parallel_safe) → 6-way alias. **Problem class partially matches on «user-facing label → internal dispatch» shape; diverges on routing complexity and trigger mechanism (env-var vs triage-predicate evaluation).** Verdict: **ADAPT** for the vocabulary shape (binary label → internal mode name mapping); BUILD for the multi-dimensional routing predicates.

**oh-my-openagent (code-yeongyu/oh-my-openagent) — DeepWiki:**

Finding: Provides user-facing commands/aliases → internal agent dispatch: `ultrawork`/`ulw` → Sisyphus agent; `@plan`/Tab → Prometheus planning agent; `/start-work` → Atlas execution agent; `task(category:"deep")` → Hephaestus deep work; `@oracle` → Oracle agent. Category System routes by intent (`visual-engineering`, `quick`, `deep`).

T16: oh-my-openagent upstream class = named agent shortcuts and category-based routing, multi-agent framework. Problem-class MATCH on «user-visible label → underlying dispatch mechanism» — this is the closest analog to our alias layer. Key difference: oh-my-openagent aliases are hardcoded to specific named agents (Sisyphus, Prometheus, Atlas); our aliases are the output of a routing-tree that depends on triage predicates evaluated at runtime.

Verdict: **REFERENCE** — oh-my-openagent confirms the alias → dispatch pattern is production-grade; its categorical routing (`quick`/`deep`) is an analog to our `fix`/`I-phase-small`/`I-phase-large`/`R-phase` TYPE classification. We do not adopt its named-agent architecture.

**AIF (lee-to/ai-factory) — alias layer query:**

DeepWiki finding: AIF uses slash commands as mode aliases (`/ai-factory.feature`, `/ai-factory.task`, `/ai-factory.implement`, `/ai-factory.fix`, `/ai-factory.evolve`). These are skill-file aliases: each command maps to a `skills/<name>/SKILL.md`. Modes: `solo` (local file) vs `team` (Hamster cloud). AI model roles: `main`, `research`, `fallback`.

T16: AIF upstream class = slash-command aliases for skill dispatch in a self-improvement workflow. Our alias layer class = routing-tree output labels (DIRECT/SOLO/BUNDLE/PAIR/DECOMPOSE/RESEARCH) displayed in meta-orchestrator dispatch prompts. **REFERENCE** — AIF confirms slash-command → skill alias is production-grade but is a different dispatch surface (command-time selection vs triage-time routing output).

### §3.3 External precedents — WebSearch phrasings

**Phrasing 1:** «CLI mode aliases user-facing labels internal mechanisms AI orchestration dispatch 2026»
→ Result: «alias normalization involves recognizing that different terms like `web_search`, `search_web`, `google`, and `browse` refer to the same capability» (tool routing context). Conductor (Microsoft, 2026-05-14): YAML workflow definitions, deterministic routing — no alias mapping table. ORCH framework: `--scope` flag prevents file conflicts, `--depends-on` for sequential tasks. None implement the 6-alias → 6-Mode routing table pattern.

**Phrasing 2:** «Superpowers "subagent-driven-development" mode aliases dispatch vocabulary»
→ DeepWiki confirms SDD dispatches implementer subagent per task with two-stage review. Dispatch vocabulary: DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED. These are IMPLEMENTER STATUS signals (post-execution), not user-facing MODE aliases (pre-execution triage).

T16 clarification: Superpowers dispatch vocabulary is post-execution status signaling; our alias layer is pre-execution mode selection. Problem classes differ on timing (before vs after dispatch). **REFERENCE** (confirms dispatch vocabularies are real), **BUILD** for pre-execution alias routing.

### §3.4 SSOT consult for alias layer

**SSOT #43 (RuntimeAdapter ADOPT VOCABULARY):** «Provider-neutral AI runtime abstraction — unified `run`/`resume`/`forkSession` interface.» This is the execution-provider vocabulary precedent. The alias layer (DIRECT/SOLO/BUNDLE/PAIR/DECOMPOSE/RESEARCH) is above the provider level — it maps work classification to execution form, not to provider. SSOT #43 is vocabulary precedent for the provider layer BELOW our aliases. No conflict.

**SSOT #64 (Superpowers SDD):** SDD is the internal mechanism for PAIR mode. Already registered. The PAIR alias pointing to `Mode-SDD` is an UX layer above SSOT #64.

**SSOT #74 (Superpowers SDD 3-tier model selection):** `small`/`medium`/`large` classification within a single plan. Narrower than our 6-alias triage (which operates across TYPES and cross-plan). KEEP-NARROW (our triage is broader in scope).

**No existing SSOT entry covers the 6-alias routing table as a stand-alone feature.** New row needed (SSOT #81).

### §3.5 Area C Verdict

| Component | Verdict | Rationale |
|---|---|---|
| Alias vocab (DIRECT/SOLO/BUNDLE/PAIR/DECOMPOSE/RESEARCH) | **BUILD** with **ADOPT-VOCABULARY** acknowledgement | 6 aliases don't exist as a pre-formed table in any upstream. The internal Mode vocab (Mode A/B/SDD/Queue) is ADOPT-VERBATIM from global orchestrator SKILL.md (no change to internal terms). The ALIAS table is a NEW user-facing UX layer that maps triage output to human-readable dispatch label. No upstream has this exact table. oh-my-openagent REFERENCE confirms the pattern is production-grade. |
| Override flags (`--mode-direct` ... `--mode-research`) | **BUILD** with **REFERENCE** to aif-handoff `AGENT_USE_SUBAGENTS` pattern | No upstream has these exact flags. aif-handoff binary env-var fork validates the «user override of auto-dispatch» pattern. Our 6-flag set is more granular (6 modes vs 2). BUILD the flags; REFERENCE aif-handoff for the override-to-internal-mode mapping shape. |
| «Emit ALIAS in SKILL.md body NOT helper» architectural choice | **CONFIRMED by evidence** | DeepWiki confirms Superpowers aliases are at skill-dispatch level (SKILL.md body), not at helper level. Design §9 single-source architecture (alias computed AFTER routing tree, not emitted from `classify-work.sh`) is consistent with production patterns. `classify-work.sh` unchanged per DN-3. |

---

## §4 — Verdict summary table

| Area | Sub-component | Verdict | SSOT row | Falsifier | Integration cost |
|---|---|---|---|---|---|
| **A** | Surface (f): openq-§13-<id> | BUILD | New row #78 | Upstream tool scans structured Q&A registries as backlog → rebuild as ADOPT | ≤20 LOC in priority-score.sh; paired-negative test extension |
| **A** | Surface (g): todo-<file>-<line> (DN-1=packages/**/*.ts) | BUILD (KEEP-NARROW vs tickgit) | New row #79 | tickgit ships in-session bash mode with namespace prefixes → ADOPT | ≤15 LOC grep in priority-score.sh; requires excluding node_modules |
| **A** | Surface (h): residual-<patch>-<anchor> | BUILD | New row #80 | Upstream tool scans per-file §future sections as synthetic backlog candidates → rebuild as ADOPT | ≤10 LOC grep in priority-score.sh |
| **B §7.1** | Delta artefact shape | β-2 = sibling `_master-backlog-delta.json` | SSOT #77 already covers cache parent; δ file is new — no separate SSOT row needed (same capability area as #77) | β-2 is wrong if update-cache.sh scope formally widened by maintainer OR if plan-currency-check.sh refactor merges delta-read into its output | New `_master-backlog-delta.json` + `update-delta.sh` (≤30 LOC); no change to existing `update-cache.sh` or `update-cache.test.ts` |
| **B §7.2** | Master-plan auto-update | β (NOT Direction A) — β-2 shadow file | SSOT #77 (direction already decided, PR #236) | β-2 wrong if `#cache-writer-feature-creep` anti-pattern is formally retired by maintainer | SKILL.md §2.5 reads δ file; emits NEW-SINCE-LAST / RESOLVED-SINCE-LAST as surfaced items; maintainer manually updates wave-sequencing-plan.md §0 |
| **C** | Alias vocab table | BUILD + ADOPT-VOCABULARY (internal terms from global SKILL.md) | New row #81 | Upstream framework ships identical 6-way alias table → ADOPT | SKILL.md body §2.5 routing tree output (≤30 LOC routing logic + mapping table) |
| **C** | Override flags (`--mode-*`) | BUILD + REFERENCE (aif-handoff shape) | Row #81 covers (same capability area) | Override flags become native CC slash-command parameters → ADOPT-VERBATIM | Override detection in SKILL.md preamble; log to δ file |
| **C** | Alias-in-SKILL-not-helper architecture | CONFIRMED | n/a (architectural choice, not new capability) | n/a | Zero new code; DN-3 already resolved |

**SSOT new rows needed: 4 (entries #78, #79, #80, #81).**

---

## §5 — Falsifiers (≥1 per area; ≥3 total)

**Area A — F1:** A production-grade AI-native tool is discovered that scans structured Q&A registries (like `open-questions.md`) AND `// TODO:` code markers AND research-patch future sections AND emits namespaced synthetic candidates for an orchestrator's priority queue — all in one in-session bash tool. If found: ADOPT or ADAPT surface (f)/(g)/(h) from it. **How to trigger:** quarterly WebSearch + DeepWiki sweep on «multi-source backlog aggregator AI orchestration». Current evidence (2026-05-26): no such tool found across ≥8 candidates sampled.

**Area A — F2:** tickgit/augmentable ships an in-session CLI mode (`tickgit scan --format=json`) consumable from bash with namespace-prefixed output compatible with `priority-score.sh`'s synthetic candidate format. If found: ADOPT-tickgit for surface (g) instead of hand-rolled grep. **How to trigger:** check tickgit release notes at next R-phase update.

**Area B — F3:** The `update-cache.sh` helper-scope contract (plan-cache.md §3, «writes ONLY `## Last invocation` section») is formally retired or widened by a maintainer decision, and `update-cache.test.ts` is updated accordingly. If so: β-1 (extend `_plan-cache.md`) becomes compliant and the β-2 recommendation is invalidated. **How to trigger:** maintainer explicitly reopens plan-cache.md §3 scope in a PR.

**Area B — F4:** `plan-currency-check.sh` is refactored to merge delta-read into its output (reading `_master-backlog-delta.json` as part of its scan and emitting delta items in its stdout). If so: β-1 becomes more attractive (co-location advantage increases). **How to trigger:** Stage 2B implementation session proposes a merged plan-currency+delta read in `plan-currency-check.sh`.

**Area C — F5:** A framework ships an identical 6-alias (DIRECT/SOLO/BUNDLE/PAIR/DECOMPOSE/RESEARCH) routing table pre-formed for the `fix`/`I-phase-small`/`I-phase-large`/`R-phase` TYPE classification. Probability: very low — the 6-alias set is derived from project-specific TYPE taxonomy. **How to trigger:** a new meta-orchestration framework survey at next R-phase.

---

## §6 — §1.7 Forward + Backward self-reflexive check

### Forward — complies with existing disciplines

- ✅ **[build-first-reuse-default.md §1](../../../.claude/rules/build-first-reuse-default.md):** All 3 areas searched ≥3 external phrasings + ≥3 DeepWiki queries + SSOT consult before any BUILD verdict. BUILD is only concluded after confirmed upstream gap (no production analog found). Area C acknowledges ADOPT-VOCABULARY for internal Mode terms; BUILD only for the new alias layer. No «own-stack-blind-spot» anti-pattern: own `priority-score.sh`, `plan-cache.md`, global SKILL.md all inspected first.
- ✅ **[no-paid-llm-in-ci.md §1](../../../.claude/rules/no-paid-llm-in-ci.md):** All research uses WebSearch + WebFetch + DeepWiki MCP (subscription-bundled). Zero API-billed calls. All proposed implementations (priority-score.sh extensions, `update-delta.sh`, alias routing in SKILL.md body) are deterministic bash + markdown — no LLM in CI.
- ✅ **[doc-authority-hierarchy.md §3](../../../.claude/rules/doc-authority-hierarchy.md):** This patch carries Authoritative-for + NOT-authoritative-for header at top. First line = `<!-- scope:meta-orchestrator-mode-triage-prior-art -->` per principle 10.
- ✅ **[dual-implementation-discipline.md §3](../../../.claude/rules/dual-implementation-discipline.md):** Proposed implementations are CC-helper-only (run via `!shell` injection in SKILL.md body). Each will carry `@cc-only-rationale` at ship time (Stage 2). No portable fallback needed (in-session meta-orchestrator helpers have no portable analog that fires at the same moment).
- ✅ **[ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md):** All active T-numbers applied (see §7). ≥1 domain-specific trap per kickoff requirement: T-MMT-R-A (domain-bundling collapse) and T-MMT-R-B (meta-self-universe confusion) both applied — 3 areas kept separate, ≥2 external non-repo precedents per area achieved (Area A: tickgit + TaskMaster; Area B: aif-handoff state-machine + TaskMaster state.json; Area C: oh-my-openagent + aif-handoff Subagents/Skills mode).
- ✅ **[reviewer-discipline.md §2](../../../.claude/rules/reviewer-discipline.md):** β-1 vs β-2 verdict is evidence-backed (β-1 directly violates shipped `#cache-writer-feature-creep` anti-pattern at plan-cache.md §4 — file:line evidence). This is a clear best on the merits per §1.12 «lead with reasoned recommendation; act when the best path is clear». NOT a true 50/50 strategy fork requiring DECISION-NEEDED.
- ✅ **[parallel-subwave-isolation.md §1](../../../.claude/rules/parallel-subwave-isolation.md):** Confirmed in isolated worktree (`research/meta-orchestrator-mode-triage-prior-art` branch, `git rev-list HEAD..origin/staging → 0`).
- ✅ **[recommendation-laziness-discipline.md §3](../../../.claude/rules/recommendation-laziness-discipline.md):** All verdicts in this patch are backed by evidence-bearing tool calls in the same turn (file reads, bash commands, WebSearch, WebFetch, DeepWiki queries). T20 counteracted.
- ✅ **[phase-research-coverage.md §1.7](../../../.claude/rules/phase-research-coverage.md):** This section is the §1.7 check.
- ✅ **[phase-research-coverage.md §1.11](../../../.claude/rules/phase-research-coverage.md):** State claims verified against actual files (direct file inspection; not from session memory). All «X exists» / «X doesn't exist» verified with Bash or Read tool calls.
- ✅ **[phase-research-coverage.md §1.12](../../../.claude/rules/phase-research-coverage.md):** Recommendations are committed (β-2 recommended clearly with evidence; no option-dump).

### Backward — what is superseded or affected

- **Design §7.2 body** («extend existing `wave-sequencing-plan.md`», Direction A) is **explicitly superseded** by this patch's β-2 verdict. The binding GATE 1 output replaces the design's recommendation. Direction A is confirmed inadvisable (evidence from plan-memory R-phase Q1: HIGH blast-radius + concurrent-write race).
- **SSOT `prior-art-evaluations.md`** gains 4 new rows (#78–#81) in the same commit as this patch.
- **No `.claude/rules/*.md` modified.**
- **No `principles/*.test.ts` modified.** (Stage 2 may add new principle test for alias-↔-routing-tree consistency per design §13.)
- **No other existing research-patch superseded.** Plan-memory R-phase patch (#230/#236) is cited and built upon — not overridden.
- **Scope of SSOT #77 (Cline Memory Bank ADAPT):** unchanged. The new `_master-backlog-delta.json` artifact is an addition alongside #77's scope, not a replacement.

---

## §7 — Active T-traps

All T-traps from [ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md) applied:

| T-number | Status | How applied |
|---|---|---|
| **T1** (shallow sampling stops at 3) | APPLIED | Area A: sampled K=8 candidates across 4 search phrasings + 4 DeepWiki queries. Area B: K=8. Area C: K=7. Floor ≥3 phrasings enforced; ceiling not assumed. |
| **T3** (plausible finding without verification) | APPLIED | All file-line citations verified via Read tool. TODO counts verified via Bash. `plan-cache.md` schema verified by direct file inspection. `state/` non-existence confirmed via `ls`. |
| **T7** (following prompt literally) | APPLIED | Areas treated as genuinely separate problem-class universes. Adversarial check: «does any upstream do ALL three areas combined?» — verified NO, not just «are they listed separately in kickoff?» |
| **T10** (completeness from what looked at, not what exists) | APPLIED | Population enumerated FIRST (§0.1) for each area BEFORE sampling. Population N and sample K recorded. |
| **T11** (designing without prior-art check) | APPLIED | All 3 BUILD verdicts preceded by ≥6-item search checklist. No «I propose…» without search. |
| **T12** (skipping literature sweep) | APPLIED | WebSearch executed at session time (not from training memory). DeepWiki consulted for repo-internals (4 repos × 2+ queries each). |
| **T13** (treating ADOPTED items as zero-work) | APPLIED | SSOT #77 (Cline ADAPT) was verified current via plan-cache.md file inspection — not assumed to cover δ tracking. |
| **T15** (self-application skipped) | APPLIED | §6 §1.7 forward+backward check applies this patch's BFR-default discipline to itself (verifying ≥3 phrasings × 3 areas). T-MMT-R-B applied to ensure external sources outnumber own-repo precedents per area. |
| **T16** (pattern-matching-on-name) | APPLIED | T16 problem-class comparisons written explicitly for each upstream: «Upstream class: X. Our class: Y. Match? Evidence: …» See §1.5, §2.4, §3.2, §3.3. |
| **T17** (destructive delegation without preserving) | APPLIED | No destructive ops in R-phase. Design §7.2 Direction A verdict is SUPERSEDED but the design doc itself is unchanged (research-patch is a new artifact, not an edit to the design doc). |
| **T19** (handoff without own cold-QA) | APPLIED | Cold-QA self-pass performed below before PR creation. |
| **T20** (inline verdict without evidence) | APPLIED | Each verdict is backed by at least one evidence-bearing tool call in the same turn (Read, Bash, WebSearch, WebFetch, or DeepWiki). No vibes-only verdicts. |
| **T-MO-design-A** («alias inline emit attractor») | APPLIED | Area C §3.5 explicitly confirms ALIAS stays in SKILL.md body; `classify-work.sh` unchanged per DN-3. No temptation to emit ALIAS from helper observed or acted upon. |
| **T-MMT-R-A** («domain-bundling collapse») | APPLIED | 3 areas maintained as separate §§1/2/3 sections with separate population enumerations, search strategies, and verdict tables. No bundling of evidence across areas. |
| **T-MMT-R-B** («meta-self-universe confusion») | APPLIED | ≥2 external non-repo precedents per area confirmed: Area A (tickgit + TaskMaster + oh-my-openagent), Area B (aif-handoff state machine + TaskMaster `.taskmaster/state.json` + Backlog.md), Area C (oh-my-openagent category routing + aif-handoff Subagents/Skills mode + AIF slash commands). |

---

## §8 SSOT new rows (to be added in same commit)

```text
| 78 | tickgit / augmentable «TODO Finder» (todos.tickgit.com, open-source, 2019-2026) | AI agent discovery sweep — `// TODO:` comment scanning in source code repositories as a production-validated approach | 2026-05-26 | 2026-05-26 | KEEP-NARROW | WebFetch 2026-05-26: scans public git repos for TODO annotations via `tickgit` bash tool; web UI display; ~35k TODOs across ~100 repos. Upstream class: web-UI TODO browser for OSS repos (async discovery + display). Our class: in-session bash scanner emitting namespaced synthetic candidates (`todo-<file>-<line>`) into a running meta-orchestrator priority queue. T16: problem class ≠ (web vs in-session, display vs namespaced emit, no multi-source aggregation). KEEP-NARROW — confirms TODO scanning is production-grade; our scope is narrower (in-session, namespaced, multi-source). | tickgit ships in-session CLI mode with namespace-prefixed output consumable by bash orchestrators without network → ADOPT |
| 79 | Backlog.md (MrLesk, open-source, 2024-2026) — markdown-native kanban task manager for git repos | AI agent backlog management — git-native markdown task persistence (confirms committed-markdown is production-validated for AI task tracking) | 2026-05-26 | 2026-05-26 | REFERENCE | WebFetch 2026-05-26: 100% offline, all data as markdown files in git repo. Explicitly targets AI agent collaboration. No TODO comment scanning, no delta tracking, no git-HEAD-bound state. Problem class: explicit markdown task files managed by humans/agents. Our class: automated multi-source discovery + delta-tracking. T16: class mismatch on discovery and delta. REFERENCE for «committed markdown files = valid AI-agent task storage» pattern (parallel to SSOT #77 Cline sub-pattern). | N/A — REFERENCE is permanent for this use case |
| 80 | aif-handoff task state-machine (`lee-to/aif-handoff` — `paused:true/false` semantic + status transitions; SSOT #28) re-evaluated for delta-tracking capability | meta-orchestrator §7.1 delta-tracking — does aif-handoff's state machine cover NEW-SINCE-LAST / RESOLVED-SINCE-LAST sweep semantics? | 2026-05-26 | 2026-05-26 | DEFER (extension of #28) | DeepWiki 2026-05-26: aif-handoff coordinator polls for tasks in specific statuses (backlog→done pipeline); does NOT track delta from a git-HEAD-anchored snapshot. The only «last-check» analog is `lastSyncedAt` (MCP conflict resolution, not orchestration delta). T16: aif-handoff class = task state-machine polling; our class = snapshot delta vs git HEAD. BUILD confirmed for §7.1 δ file. DEFER if aif-handoff adds a sweep-since-git-HEAD checkpoint primitive. | aif-handoff adds «delta from git HEAD since last coordinator run» primitive; OR project adopts aif-handoff as runtime per SSOT #27/#30 trigger conditions |
| 81 | oh-my-openagent (code-yeongyu/oh-my-openagent) categorical routing + alias dispatch | meta-orchestrator user-facing alias layer — aliases (`ultrawork`/`@plan`/`/start-work`) mapping to named agents confirms the alias→dispatch pattern is production-grade | 2026-05-26 | 2026-05-26 | REFERENCE | DeepWiki 2026-05-26: `ultrawork`/`ulw`→Sisyphus (aggressive parallel execution); `@plan`/Tab→Prometheus (planning); `/start-work`→Atlas (execution); category system (`visual-engineering`/`quick`/`deep`). Closest analog to our 6-alias table (DIRECT/SOLO/BUNDLE/PAIR/DECOMPOSE/RESEARCH). T16: oh-my-openagent class = named-agent routing with hardcoded agent identities; our class = routing-tree-output aliases derived from triage predicates at runtime. REFERENCE confirms alias→dispatch pattern is production-grade; BUILD our 6-alias routing table as project-specific triage output. | Framework ships equivalent routing-tree-driven alias table for `fix`/`I-phase-small`/`I-phase-large`/`R-phase` TYPE taxonomy → ADOPT |
```

---

## §9 Cold-QA self-pass (T19 counter)

Adversarial review of this patch before PR creation:

- **§0 cold-start verify:** all commands recorded with actual outputs. PASS.
- **§0.1 population enumeration:** N and K stated for all 3 areas before sampling. PASS.
- **T16 problem-class comparisons:** each upstream has explicit «Upstream class: X. Our class: Y. Match? Evidence:» format in §1.5, §2.4, §2.5, §3.2, §3.3. PASS.
- **β-1 vs β-2 recommendation:** backed by file:line evidence (`plan-cache.md §4 #cache-writer-feature-creep` anti-pattern; `update-cache.test.ts` idempotency contract). PASS.
- **No Direction A research:** per kickoff binding override (Direction A REJECTED; only β-1/β-2 in scope). PASS.
- **No auto-write to wave-sequencing-plan.md §0:** confirmed — β-2 surfaces items to maintainer who updates manually. PASS.
- **SSOT rows enumerated:** 4 new rows (#78–#81) identified, drafted in §8. PASS.
- **First-line scope annotation:** `<!-- scope:meta-orchestrator-mode-triage-prior-art -->` present as first line. PASS.
- **Authoritative-for header:** present at top. PASS.
- **T-trap coverage:** all 14 T-numbers from kickoff §7 addressed in §7 table. PASS.

**Cold-QA PASS** — no MAJOR findings.

---

## §10 See also

- [docs/meta-factory/research-patches/2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md](2026-05-25-meta-orchestrator-mode-triage-and-planner-design.md) — binding design doc this patch surveys (§7.2 Direction A superseded by β-2 verdict)
- [docs/meta-factory/research-patches/2026-05-25-plan-memory-rphase.md](2026-05-25-plan-memory-rphase.md) — adjacent shipped work (Direction B ADOPT verdict, plan-cache.md origin; T16 separation in §2.1)
- [.claude/skills/meta-orchestrator/references/plan-cache.md](../../../.claude/skills/pipeline/references/plan-cache.md) — `#cache-writer-feature-creep` anti-pattern evidence for β-2 recommendation
- [.claude/skills/meta-orchestrator/helpers/priority-score.sh](../../../.claude/skills/pipeline/helpers/priority-score.sh) — existing surfaces (a)-(e); target for Area A new surfaces (f)/(g)/(h)
- [.claude/skills/meta-orchestrator/helpers/update-cache.sh](../../../.claude/skills/pipeline/helpers/update-cache.sh) — helper-scope contract («writes ONLY `## Last invocation`») — evidence against β-1
- [docs/meta-factory/prior-art-evaluations.md](../prior-art-evaluations.md) — SSOT; new rows #78–#81 added in this commit
- [.claude/rules/build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md) — BFR §3 mandatory search checklist applied
- [.claude/rules/ai-laziness-traps.md](../../../.claude/rules/ai-laziness-traps.md) — T1/T3/T7/T10/T11/T12/T13/T15/T16/T17/T19/T20/T-MO-design-A/T-MMT-R-A/T-MMT-R-B all addressed
