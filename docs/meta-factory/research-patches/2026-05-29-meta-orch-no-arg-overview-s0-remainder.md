<!-- scope:meta-orch-no-arg-overview-s0-remainder -->
# Stage 0-remainder — `meta-orch-no-arg-overview` R-phase

> **Authoritative for:** Stage 0-remainder evidence + verdicts for the `meta-orch-no-arg-overview` umbrella — §1 6-item search checklist (items 1, 2, 3, 4, 5a, 5b, 5c, 6; §1.5d skipped — closed via PR #264), §3 Stage 3 UX design verdict (V1 arg-parser, V2 parallelism-signal source, V3 no-arg overview format, V4 integer-arg semantics), §4 Stage 2 mechanism confirmation against §1.5c empirical, §6 parallelism declaration for Stages 1 ∥ 2 ∥ 4 with file-scope re-flag, §7 §1.7 self-reflexive note.
> **NOT authoritative for:** Stage 0-thin §1.5d probe — shipped via PR #264, see [`2026-05-28-meta-orch-no-arg-overview-s0-thin-probe.md`](2026-05-28-meta-orch-no-arg-overview-s0-thin-probe.md). Implementation of these verdicts (Stage 3 implementer ships the actual SKILL.md/output-format.md/helpers edits per V1–V4 binding).
> **Origin:** 2026-05-29 Stage 0-remainder R-phase dispatch per kickoff [§1](../../../.claude/orchestrator-prompts/meta-orch-no-arg-overview/kickoff.md) + [§2 row 0](../../../.claude/orchestrator-prompts/meta-orch-no-arg-overview/kickoff.md). Worktree-isolated per [parallel-subwave-isolation.md §1](../../../.claude/rules/parallel-subwave-isolation.md): branch `feat/meta-orch-no-arg-overview-s0-rphase` from `origin/staging` (HEAD `351189c`).

---

## §1 6-item search-coverage evidence

Per [`phase-research-coverage.md §1`](../../../.claude/rules/phase-research-coverage.md). T-traps active per kickoff §4 + user STEP 3: T1, T3, T4, T11, T12, T13, T15, T16, T17, T20.

### §1.1 — SSOT consult (kickoff item 1)

[`prior-art-evaluations.md`](../prior-art-evaluations.md) sweep for the six capability areas named in kickoff §1 item 1. Citing by row ID, with T16 problem-class check per entry.

| # | Area | SSOT row | Verdict in row | T16 ours vs upstream | Adoption for this umbrella |
|---|---|---|---|---|---|
| 1.1.a | Full plan rendering | **#68** (OhMyOpencode Atlas/Prometheus 3-layer + `## Parallel Execution Graph`) | REFERENCE | Upstream = multi-agent within-session dispatch with `Wave 1/2/3` markdown; ours = cross-session umbrella overview with kickoff §2 Stage table. ~30% match (DECLARATIVE-PARALLELISM idea adapts; runtime substrate differs). | **REFERENCE for V3**: confirms «overview rendering with explicit parallel-wave grouping» is production-grade; adapt the heading shape, NOT the runtime. |
| 1.1.b | Top-N selection | (no SSOT row) | — | DeepWiki probe (§1.2 below) on Superpowers + WebSearch (§1.3) both surface NO upstream candidate for `/cmd <N>` semantics. | **No upstream; BUILD with V4 verdict below.** |
| 1.1.c | Parallel-vs-sequential indication | **#68** + **#65** ([`using-git-worktrees`](https://github.com/obra/superpowers)) + **#66** (AIF `--parallel`) | REFERENCE / ADOPT / REFERENCE | #68 = explicit wave-grouping (match); #65 = pure-git worktree isolation (substrate-level, parallel-safe execution, NOT in-plan indication); #66 = AIF `--parallel` mode toggles parallel dispatch (run-time, not declared statically). ~40-60% match across the three. | **ADAPT** #68's `Wave N` grouping for V2 (declarative source). REFERENCE #65 for the execution-time substrate. |
| 1.1.d | Completion detection | **#77** (Cline Memory Bank committed `progress.md` checkboxes), **#64** (Superpowers SDD `DONE`/`DONE_WITH_CONCERNS`/`NEEDS_CONTEXT`/`BLOCKED` status), **#80** (aif-handoff delta-tracking, DEFER) | ADAPT / ADOPT / DEFER | #77 = committed markdown with `- [x]` (~85% match on storage; differs on update trigger — Cline = on-demand AI-signalled, ours = auto-derived from gh state). #64 = within-session implementer-reported status (different scope — ours = across-session). #80 = deferred. | **ADAPT** #77 for the §4 tertiary signal (committed `done.md` per umbrella). |
| 1.1.e | Branch→umbrella mapping | (no SSOT row) | — | DeepWiki probes (§1.2) on Superpowers + Cline + OhMyOpencode all surface negative: none rely on branch≡task naming. Empirical §1.5c: 13% rate. | **No upstream; problem is project-local; mechanism designed in §4.** |
| 1.1.f | Overview UI | **#79** (Backlog.md pattern, REFERENCE) | REFERENCE | Upstream = single committed markdown file with human-curated priority sections; ours = dynamic discovery via priority-score.sh. ~10% match (storage format only). | **REFERENCE only**; the dynamic side stays ours. |

**T16 net:** No SSOT row matches problem-class strongly enough to skip BUILD. Strongest precedent is #68's `## Parallel Execution Graph` heading shape (V2 ADAPT) + #77 committed-markdown completion sub-pattern (§4 ADAPT). All other rows fail T16 problem-class check (upstream's substrate, scope, or trigger differs materially).

### §1.2 — DeepWiki `ask_question` (kickoff item 2; ≥3 phrasings × 3 repos)

Executed 2026-05-29 via `mcp__deepwiki__ask_question`. Each row = one DeepWiki query + verbatim distilled finding + T16 check.

**Repo 1: `obra/superpowers`** (≥3 phrasings)

| # | Phrasing | Finding (verbatim distilled) | T16 problem-class match |
|---|---|---|---|
| 1.2.a | «How does Superpowers indicate parallel-vs-sequential between sub-tasks in its plan output?» | DOT (GraphViz) flowcharts in skill files (`subagent-driven-development/SKILL.md`, `dispatching-parallel-agents`); plan markdown uses checkboxes `- [ ]` only — **no inline icon/keyword in the plan document itself for parallel-vs-sequential**. Parallel = handled by skill chosen at execution (`dispatching-parallel-agents` triggers multiple `Task(...)` calls; `subagent-driven-development` runs sequentially per task). | ~20% — upstream = runtime-skill-driven; ours = static-plan-declared. Mismatch on declaration moment. |
| 1.2.b | «Does Superpowers have a top-N selection mode for backlog items?» | **No.** The `brainstorming` skill works one-design-at-a-time; `writing-plans` produces full plans; there is a `priority-test` skill but it tests *skill-loading order*, not user-facing backlog ranking. | ~5% — no precedent for `/cmd <N>` semantics. |
| 1.2.c | «How does Superpowers detect task / plan completion?» | (i) Subagent `DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` / `BLOCKED` status codes; (ii) `TodoWrite` checkbox; (iii) `finishing-a-development-branch` skill which detects Git environment via `GIT_DIR != GIT_COMMON_DIR` (worktree-aware). **No PR-reference detection, no branch≡task mapping, no `done.md` file.** | ~30% on the in-session status-code idea; SDD scope = within-plan (ours = across-umbrella). |

**Repo 2: `cline/cline`** (≥3 phrasings)

| # | Phrasing | Finding (verbatim distilled) | T16 problem-class match |
|---|---|---|---|
| 1.2.d | «How does Cline Memory Bank decide which task is completed vs in-progress?» | Standard Markdown checklist `- [ ]` / `- [x]` in `task_progress` parameter of tool calls; `FocusChain` class parses + persists to disk; AI is instructed to silently update list per tool call. Format is plain markdown checkboxes inside `progress.md`. | ~85% on storage sub-pattern (committed markdown checkboxes); differs on update trigger (Cline = AI-signalled per turn, ours = deterministic auto-derived from gh state). |
| 1.2.e | «Does Cline have a branch-to-task mapping discipline?» | **No.** Cline does NOT enforce branch-to-task naming; no mechanism links `feat/foo` to Memory Bank item `foo`. Memory Bank is conversation/file-bound, not Git-branch-bound. | ~0% — confirms branch≡umbrella naming has zero upstream precedent. |
| 1.2.f | «How does Cline render a full work-plan overview?» | `task_progress` Markdown checklist integrated into ongoing conversation via `FocusChain` UI component; no separate «show all pending tasks» rendering as a distinct mode. `activeContext.md` + `progress.md` are plain markdown. | ~25% — Cline overview is in-band per turn; ours = explicit slash-command-on-demand mode. |

**Repo 3: `code-yeongyu/oh-my-openagent`** (≥3 phrasings)

| # | Phrasing | Finding (verbatim distilled) | T16 problem-class match |
|---|---|---|---|
| 1.2.g | «Integer-shaped slash-command args (`/omo 3`) — alias routing for numeric vs string?» | `parseSlashCommand` (regex `SLASH_COMMAND_PATTERN`) captures args as a **single string**; no integer disambiguation at the parser layer. `/omo 3` → `args = "3"` (string). Any numeric interpretation is the command-body's job (e.g. `parseInt` per command). System explicitly **prevents** `/3foo` (slash + digit) from parsing as a command — commands must start with letter or `@`. | ~70% — confirms our regex-in-skill-body disambiguation pattern is the prevailing approach. |
| 1.2.h | «Completion detection mechanism?» | (i) **Ralph Loop** scans transcript for `<promise>TEXT</promise>` markers; (ii) **Boulder Mechanism** = checkbox parsing in `.omo/plans/<name>.md` + `boulder.json` state + `pollForCompletion` aggregating `areAllTodosComplete` + `areAllChildrenIdle` + `areContinuationHooksIdle`. **No `done/` directory, no git branch matching.** | ~60% — plan-file checkbox parsing strongly matches our V_§4 tertiary-signal idea (file-presence as completion marker). |
| 1.2.i | «Parallelism indication format?» | **EXPLICIT declarative:** `## Parallel Execution Graph` section with `Wave 1 (Start immediately): ├── Task 1 ... └── Task 5`; `Task Dependency Graph` table; `Dependency Matrix` table (`Depends On / Blocks / Can Parallelize With`); per-task `**Parallelization:**` block with `Can Run In Parallel: YES/NO` + `Parallel Group: Wave N`. Prometheus prompt mandates the structure. | ~80% — strongest upstream precedent for V2 declarative parallelism. |

**Repo 4: `Yhooi2/rules-as-tests-aif`** (kickoff item 6) — **INCONCLUSIVE-channel-unavailable**

DeepWiki returned `Error processing question: Repository not found. Visit https://deepwiki.com to index it.` on all 3 phrasings (completion detection, no-arg overview output flow, parallelism indication in output-format.md). Repository is NOT indexed on DeepWiki as of 2026-05-29. **Fallback executed** via local `Read` of the actual files:
- `.claude/skills/meta-orchestrator/SKILL.md` (read; §0/§1 confirmed: `arguments: [umbrella]` single positional, `argument-hint: "[umbrella-name]"`, `disable-model-invocation: true`, `allowed-tools` glob)
- `.claude/skills/meta-orchestrator/helpers/priority-score.sh` (read; deterministic data feed + 8 synthetic surface types; reads but does not filter against merged-PR state)
- `.claude/skills/meta-orchestrator/helpers/dup-detect.sh` (read; already implements jaccard-token-overlap PR-title matching on 30-day merged window — this is the existing fallback signal that kickoff §1.5c contemplates; basis=xref|jaccard)
- `.claude/skills/meta-orchestrator/references/output-format.md` (read; §1 fires only on dispatch path per output-format.md:24; §2 Dependency graph + §3 Action queue + §4 1-liner already define the three-layer shape)
- `packages/core/principles/18-meta-orchestrator-output-format.test.ts` (read; checks 6 substrings × 2 surfaces; output-format.md scope = whole-file)

T16 net: kickoff item 6 falsified only on the channel (DeepWiki), not on the underlying claim. **Local-fallback evidence is load-bearing.** Documented as a channel-availability residual; re-test next quarter.

### §1.3 — WebSearch (kickoff item 3; ≥3 phrasings × 4 themes)

| # | Theme + phrasing | Finding | T16 |
|---|---|---|---|
| 1.3.a | «slash command integer argument parsing AI agent CLI tokenize numeric vs string» | CLI args are strings by default across Java/Python/C; explicit conversion required (`parseInt` / `type=int` / `atoi`). [krismuniz/slash-command](https://github.com/krismuniz/slash-command) separates command keywords from body as the parsing step; type coercion is downstream. No standard for integer-shaped slash args. | Confirms regex-in-skill-body approach is industry-standard. |
| 1.3.b | «task plan overview UI chat agent show all backlog items ranked priority» | [Microsoft Planner Agent](https://techcommunity.microsoft.com/blog/plannerblog/planner-agent-brings-work-management-directly-into-microsoft-365-copilot/4511720) returns "prioritized, interactive view" via Copilot; [Azure Boards backlogs](https://learn.microsoft.com/en-us/azure/devops/boards/backlogs/backlogs-overview) use `Stack Rank` + `Backlog Priority` fields with drag-reorder. AI-agent integration via Azure Boards MCP enables natural-language top-N requests. | Confirms «full overview with priority order» is a recognised UX category; supports V3 BUILD. |
| 1.3.c | «detect completed task git branch matching squash merge umbrella feature» | [GitHub squash-merge](https://github.com/orgs/community/discussions/66139) collapses branch history → branch-name signal degrades post-merge; PR API can show «merged» state but not always squash-vs-merge distinction. | **Confirms §1.5c problem class** — branch-based completion is brittle when squash-merge is the dominant workflow. Reinforces §4 multi-signal verdict. |
| 1.3.d | «parallelism indication action queue dependency graph workflow markdown rendering» | [Taskflow](https://taskflow.github.io/taskflow/GraphProcessingPipeline.html) + [Action Dependency Graph](https://arxiv.org/pdf/2412.01277) frameworks use edges + wave parallelism. Industry standard: explicit dependency edges + wave grouping. | Confirms V2 ADAPT verdict shape. |

### §1.4 — Build-vs-reuse SSOT full sweep (kickoff item 4)

Per [`build-first-reuse-default.md §3`](../../../.claude/rules/build-first-reuse-default.md). For each Stage 2 / Stage 3 candidate mechanism, T16 problem-class check explicit.

**Candidate M1 — maintainer's «5-line bash branch≡umbrella matcher»** (kickoff §0 P2 binding)
- T16 upstream problem class: «per-task feature branches named after task» (the implicit norm in Superpowers SDD / Cline / AIF single-feature pipelines).
- Our problem class: «umbrella-shipped via multi-stage PRs with abbreviated `scope:` prefixes (`fix(aif-handoff-bridge): …` for umbrella `aif-handoff-as-runtime-bridge`)».
- **Match? ~15%.** §1.5c empirical = 13% branch-matchable. NOT a problem-class fit as sole signal.
- Verdict: **insufficient alone**; reuse as Layer 1 of multi-signal classifier.

**Candidate M2 — committed `done.md` per umbrella (ADAPT Cline #77)**
- T16 upstream problem class: «per-task committed-markdown checkbox tracking via Memory Bank `progress.md`; on-demand AI-signalled update».
- Our problem class: «per-umbrella deterministic completion file written by merging session post-PR-merge; consumed by priority-score.sh at next invocation».
- **Match? ~70%** on the storage sub-pattern (committed file is reliable completion signal); differs on update trigger.
- Verdict: **ADAPT** for §4 tertiary signal.

**Candidate M3 — kickoff alias-table convention (`<!-- pr-scopes: alias1,alias2 -->`)** (BUILD)
- T16 upstream problem class: no direct upstream — closest is OhMyOpencode #81 alias-routing (REFERENCE; runtime alias→handler).
- Our problem class: declarative alias table inside kickoff.md (planning-time, not runtime; data fed to a grep-tool).
- **Match? ~25%** on alias-table-as-data idea.
- Verdict: **BUILD** the convention; cite #81 as REFERENCE.

**Candidate M4 — leverage existing `dup-detect.sh` jaccard scoring** (REUSE)
- T16 upstream problem class: in-house deterministic token-overlap scoring of kickoff vs PR title.
- Our problem class: identical (the helper already exists; PR #213 / planner-completeness shipped it).
- **Match? 100%.**
- Verdict: **REUSE** for §4 secondary signal. priority-score.sh wires the existing output as a filter.

### §1.5a — CC slash-command integer-arg parsing (verify)

- SKILL.md frontmatter: `arguments: [umbrella]` (single positional, string). Both `/meta-orchestrator 1` and `/meta-orchestrator some-name` arrive identically as `umbrella="1"` and `umbrella="some-name"`.
- DeepWiki §1.2.g confirms OhMyOpencode `parseSlashCommand` treats arg as single string; no type coercion at parse layer.
- WebSearch §1.3.a confirms industry norm: CLI args are strings; type-conversion is a downstream step.
- Falsifier (per kickoff): wrong if any umbrella basename is literally `^[0-9]+$`. Empirical check executed:
  ```bash
  $ ls .claude/orchestrator-prompts/ | grep -E '^[0-9]+$' | wc -l
  0
  ```
- **Verdict V1 (binding):** regex `^[0-9]+$` against `umbrella` literal in skill body. If match → top-N path; else → umbrella-name path. **Mandatory skill-body assertion at invocation start:** `[ -z "$(ls .claude/orchestrator-prompts/ | grep -E '^[0-9]+$')" ] || abort "umbrella named as integer; rename before invocation"`. Failure-mode is loud, not silent.

### §1.5b — `output-format.md` extension feasibility (verify)

- Principle 18 (`packages/core/principles/18-meta-orchestrator-output-format.test.ts:46-53,76`) enforces 6 substrings × 2 surfaces:
  - `'## Dependency graph'`, `'↓'`, `'## Action queue'`, `'Paste в новый CC tab'`, `'Можно параллельно с'`, `'### Stage'`
  - For `.claude/skills/meta-orchestrator/references/output-format.md` the scope is **whole-file**, NOT a specific section.
- Adding a new section `## §1.5 No-arg overview format` to `output-format.md` that re-uses all 6 substrings in its skeleton → ZERO principle-18 contention. The new section is a sibling to existing §1–§5, not a replacement.
- **Verdict (criterion met):** zero churn on existing principle-18 test; the dispatch-path §1 stays unchanged; the no-arg overview format gets its own §1.5 (or §1A) section. **Stage 3 implementer ships the section in the same PR that wires the no-arg renderer.**

### §1.5c — Last-100 merged-PR branch-naming compliance audit (LOAD-BEARING)

Per kickoff §1 item 5c verbatim. Sample = exact kickoff command output:

```bash
gh pr list --state merged --limit 100 --json number,title,headRefName > /tmp/merged-prs-100.json
# wc → 100 PRs
```

Match logic (per kickoff thresholds):
- **[A] EXACT** = branch (after `feat/|fix/|chore/|docs/|research/|hotfix/|refactor/|test/|wip/|build/|ci/|perf/` prefix-strip) equals an umbrella basename.
- **[B] PREFIX-UMBRELLA** = branch (after prefix-strip) starts with `<umbrella>-` (covers stage-suffix patterns like `-s0-thin-probe`).
- **[A+B] BRANCH-MATCHABLE** = matcher can derive umbrella from branch alone.
- **[C] TITLE-ONLY** = umbrella basename appears as substring of PR title but NOT in branch (fallback signal).
- **[D] NO-MATCH** = neither branch nor title.

| Metric | Count | % of 100 |
|---|---|---|
| [A] EXACT | 9 | 9.0% |
| [B] PREFIX-UMBRELLA | 4 | 4.0% |
| **[A+B] BRANCH-MATCHABLE** | **13** | **13.0%** |
| [C] TITLE-ONLY | 4 | 4.0% |
| **[A+B+C] ANY-DETECTABLE** | **17** | **17.0%** |
| [D] NO-MATCH | 83 | 83.0% |

**Examples (first 3 per bucket):**
- **[A] EXACT:** #263 `feat/meta-orch-f3-iphase` ≡ `meta-orch-f3-iphase`; #261 `research/meta-orch-no-arg-laziness` ≡ `meta-orch-no-arg-laziness`; #252 `research/universal-satellite-integration-matrix` ≡ `universal-satellite-integration-matrix`.
- **[B] PREFIX-UMBRELLA:** #266 `feat/meta-orch-no-arg-overview-s4` ⊃ `meta-orch-no-arg-overview`; #264 `feat/meta-orch-no-arg-overview-s0-thin-probe` ⊃ `meta-orch-no-arg-overview`; #233 `refactor/slow-test-triage-iphase-dn1c` ⊃ `slow-test-triage`.
- **[C] TITLE-ONLY:** #232 `research/defer-reflex-stage-2-benchmark` title∋`defer-reflex-detection`; #229 `research/defer-reflex-r-phase-fresh` title∋`defer-reflex-detection`; #215 `fix/recommendation-laziness-iphase-d` title∋`recommendation-laziness-discipline`.
- **[D] NO-MATCH:** #269 `fix/aif-handoff-bridge-stage1-followup` (umbrella `aif-handoff-as-runtime-bridge` — abbreviated scope); #268/#267 same family.

**Threshold reading per kickoff §1 5c verdict criteria:**
- ≥85% → branch-matcher is sole-signal sufficient: **NOT MET** (13% << 85%)
- 50–85% → branch-matcher + PR-title-substring fallback: **NOT MET** (17% << 50%)
- <50% → «problem-class is different, split umbrellas per §0.5»: **MET (17% < 50%)**

**§0.5 falsifier P2 explicitly fires.** Maintainer's 5-line bash branch≡umbrella matcher (kickoff §0 P2 binding) is **insufficient as sole signal**.

**Mitigation (does NOT require umbrella split):** §4 below verdict = **multi-signal classifier** (Layer 1 branch + Layer 2 jaccard title via existing `dup-detect.sh` + Layer 3 committed `done.md` as load-bearing). The umbrella scope-merge stays valid because the §0.5 «split» counter-action assumed the matcher would be the SOLE mechanism; replacing it with a multi-signal classifier preserves the umbrella while still closing the P2 gap. The threshold reading falsifies only **M1-as-sole-signal**, not the umbrella's existence.

### §1.6 — (Note) §1.5d skipped per kickoff §1.5d closure via PR #264

Closed via [`2026-05-28-meta-orch-no-arg-overview-s0-thin-probe.md §5b`](2026-05-28-meta-orch-no-arg-overview-s0-thin-probe.md) (DEFERRED-PENDING-PROBE-INVOCATION matrix). Not re-done in this patch per user STEP 3 explicit scope.

---

## §3 Stage 3 UX design verdict (binding for Stage 3 implementer)

Each verdict carries a falsifier; Stage 3 implementer reads file:line evidence quoted in §1.

### V1 — Arg-parser disambiguation

**Verdict (binding):** Skill body executes, at invocation start, against literal `umbrella` arg:

```bash
if printf '%s' "$umbrella" | grep -qxE '^[0-9]+$'; then
  # Top-N path — N = $umbrella
  : route_to_top_n "$umbrella"
elif [ -z "$umbrella" ]; then
  # No-arg overview path
  : route_to_overview
else
  # Umbrella-name path (existing §3 launch-table + §4 meta-kickoff)
  : route_to_named_umbrella "$umbrella"
fi
```

**Evidence chain:** §1.5a verification + §1.2.g DeepWiki (OhMyOpencode `parseSlashCommand` confirms args-as-string) + §1.3.a WebSearch (industry-standard CLI string-default).

**Pre-invocation guard (mandatory):** before routing, assert no umbrella is literally `^[0-9]+$`:
```bash
if ls .claude/orchestrator-prompts/ 2>/dev/null | grep -qE '^[0-9]+$'; then
  echo "ERROR: an umbrella basename matches ^[0-9]+$ — rename before /meta-orchestrator <N> can be unambiguous."; exit 2
fi
```

**Falsifier:** wrong if (a) a future umbrella is named `1`/`2`/etc. (the guard above is a loud failure-mode counter); (b) CC's frontmatter `arguments:` adds type coercion in future versions (re-verify at next CC release ≥ Apr-2027); (c) user uses `/meta-orchestrator 0` or negative `-1` (treat as no-arg per V4 below).

### V2 — Parallelism-signal source: **DECLARATIVE**, sourced from kickoff `§2 Stage table` `Parallel-with` column

**Verdict (binding):** Stage 3 implementer reads the existing `| Parallel-with |` column already mandated by [output-format.md §3](../../../.claude/skills/pipeline/references/output-format.md) Action queue (column `Можно параллельно с`). The signal lives in EACH umbrella's kickoff (one source per umbrella). NO inferred-parallelism — no AST-level file-scope detection, no grep-based heuristic.

**Evidence chain:**
- SSOT #68 (OhMyOpencode Atlas/Prometheus) — strongest upstream precedent: `## Parallel Execution Graph` with `Wave N` markdown is industry-validated (§1.2.i DeepWiki quoted the Prometheus prompt mandate verbatim).
- Existing project format: [kickoff.md §2 line 94-100](../../../.claude/orchestrator-prompts/meta-orch-no-arg-overview/kickoff.md) already has the column for this umbrella (`Stage 1 | Stage 2` parallel-with annotations). Convention exists; V2 confirms it stays.
- DeepWiki §1.2.a — Superpowers does NOT have declarative in-plan parallelism (runtime-skill-driven). Our declarative approach diverges intentionally.

**Adoption:** ADAPT #68's `Wave N` heading shape for the rendered overview, not for the kickoff data source. Kickoff column stays markdown table; rendered output uses Wave-style grouping (V3 below).

**Falsifier:**
- Wrong if a kickoff omits the `Parallel-with` column → degrade gracefully to sequential (safe default); Stage 3 implementer emits ATTN finding when a candidate lacks the column.
- Wrong if Parallel-with declarations across kickoffs disagree (e.g. umbrella A claims parallel with B; B does not claim parallel with A). Stage 3 implementer requires BOTH to declare each other; otherwise treat as sequential and emit ATTN.
- §1.7-self-check residual: V2 puts the parallelism signal in kickoff.md, which IS the file Stage 3 reads at runtime — recursive coupling is intentional (single source of truth per umbrella; verifiable at audit time by grepping the column).

### V3 — No-arg overview format: ≤30-line ASCII/markdown skeleton, coexisting with output-format.md F.3

**Verdict (binding):** Stage 3 implementer adds a new section `## §1A No-arg overview format` to [`output-format.md`](../../../.claude/skills/pipeline/references/output-format.md), immediately after current §1. The section's example skeleton MUST reuse all 6 principle-18 substrings (§1.5b verified zero churn).

**Skeleton (binding, ≤30 lines body):**

```text
═══════════════════════════════════════════════════════════════
PROJECT OVERVIEW — all open umbrellas (<YYYY-MM-DD>)
═══════════════════════════════════════════════════════════════

## Dependency graph

Wave 1 — СЕЙЧАС (parallel-OK):
├── <umbrella-A>   (Stage <N>, ~<cost>, <Mode>)   PARALLEL-OK ↔
└── <umbrella-B>   (Stage <N>, ~<cost>, <Mode>)
                                  ↓
Wave 2 — после мержа Wave 1:
└── <umbrella-C>   (Stage <N>, ~<cost>, <Mode>)

## Action queue — что ты делаешь дальше

| # | Paste в новый CC tab | Когда | Ждёшь | Можно параллельно с |
|---|----------------------|-------|-------|---------------------|
| 1 | /meta-orchestrator <umbrella-A> | Сейчас | — | <umbrella-B> |
| 2 | /meta-orchestrator <umbrella-B> | Сейчас | — | <umbrella-A> |
| 3 | /meta-orchestrator <umbrella-C> | После Wave 1 | Wave 1 merged | — |

Всего открытых umbrellas: <K> (после Stage 2 completion-filter; status-tag DONE-recently hidden).

### Stage — overview only
(no per-stage 1-liner; this overview MUST be drilled-down via /meta-orchestrator <umbrella> for dispatch)
═══════════════════════════════════════════════════════════════
```

**Why this shape:**
- ADAPTS #68 Wave grouping (DeepWiki §1.2.i verbatim) — strongest upstream precedent.
- Re-uses the principle-18 6 substrings = zero churn on existing test (§1.5b verified).
- Reuses existing output-format.md §3 Action queue column-headers verbatim.
- Trailing `### Stage — overview only` placeholder satisfies principle-18 `### Stage` substring check while signalling drilldown.

**Falsifier:**
- Wrong if principle-18 test fails after the new section lands — Stage 3 implementer runs `npx vitest run packages/core/principles/18-meta-orchestrator-output-format.test.ts` and gets green BEFORE PR-create.
- Wrong if the new section accidentally collides with §1's existing `EXECUTION PLAN — <umbrella>` header — sections are at `## §1` and `## §1A`, header strings differ verbatim, no collision.
- Wrong if dispatch path mistakenly fires the overview format (cross-mode rendering) — Stage 3 implementer routes V1's branches to distinct render-functions, not one mixed renderer.

### V4 — Integer-arg semantics: top-N filter on completion-filtered ranking + parallel-marker derivation

**Verdict (binding):** `<N>` means «top-N candidates from `priority-score.sh` ranking AFTER Stage 2's completion-filter applies». Render:
1. Sort candidates by priority score descending.
2. Drop any candidate flagged `DONE` by Stage 2's multi-signal classifier (§4 below).
3. Take first N from remaining.
4. For each: emit «Что делает / Deliverable / Почему сейчас» 3-line block per [output-format.md §4.1](../../../.claude/skills/pipeline/references/output-format.md) + 1-liner.
5. Parallel-vs-sequential markers between the N: derive from each candidate's kickoff `§2 Parallel-with` column (V2). If k of the N pairwise list each other → emit `PARALLEL-OK ↔`; else sequential `↓`.

**Edge cases (binding):**
- **N > candidate count:** emit all available + a single warning line `Only K candidates available; you requested N.` Do NOT pad with synthetic rows.
- **N = 0 OR negative arg detected post-regex-match:** route to no-arg overview path (V3). Regex `^[0-9]+$` matches `0` and positive integers; `-1` does NOT match (sign char) → falls through to umbrella-name path, which then 404s on the directory → emit clear error.
- **N = 1:** equivalent to current «winner recommendation» behaviour. Stage 3 implementer keeps the existing render-path callable from this branch (no regression).

**Falsifier:**
- Wrong if Stage 2's completion-filter is bypassed by mistake → N would include stale DONE umbrellas. Stage 3 implementer wires N-filter AFTER Stage 2's filter, never before.
- Wrong if priority-score.sh ordering is non-deterministic across two consecutive invocations → top-N would flicker. Verify deterministic ordering by running `priority-score.sh | sort` twice in same session.

---

## §4 Stage 2 mechanism confirmation (multi-signal classifier)

**Empirical input from §1.5c:** 13% branch-matchable, 17% any-detectable, 83% no-match → §0.5 falsifier P2 fires for «matcher-as-sole-signal». **Multi-signal classifier confirms scope-merge stays valid** (umbrella does NOT split per §0.5 because the falsifier applies only to the sole-signal interpretation; multi-signal preserves the umbrella).

**Binding mechanism (3 layers, ordered by reliability):**

**Layer 1 — branch-prefix match** (covers 13% per §1.5c):
- Strip `feat/|fix/|chore/|docs/|research/|hotfix/|refactor/|test/|wip/|build/|ci/|perf/` from `headRefName`.
- EXACT-match against `ls .claude/orchestrator-prompts/`, OR PREFIX-match `<umbrella>-*` (covers stage-suffix patterns).
- ≤5 LOC bash; this is roughly the maintainer's original proposal, narrowed to the 13% it actually covers.

**Layer 2 — jaccard token overlap on PR title** (REUSE existing `dup-detect.sh`):
- `dup-detect.sh:18` already implements `basis=jaccard score=N%` with `MO_JACCARD_THRESHOLD=30` default.
- Stage 2 wires `priority-score.sh` to consult `dup-detect.sh --all` output filtered to merged-30d window; any `POTENTIAL_DUPE:` line implies a completion candidate for the named umbrella.
- Adds the 4% TITLE-ONLY layer (§1.5c [C]) at zero new LOC (helper exists; Stage 2 wires it).

**Layer 3 — committed `done.md` per umbrella (LOAD-BEARING, ADAPT Cline #77):**
- Convention: when an umbrella's last stage merges, the merging session writes `.claude/orchestrator-prompts/<umbrella>/done.md` with content:
  ```text
  Closed: <YYYY-MM-DD>
  Via PR: #<N> (<branch>)
  Notes: <optional 1-line summary>
  ```
- Layer 3 is the **load-bearing fallback** because:
  - It is deterministic (file present or absent).
  - It is reachable without any gh state (zero rate-limit risk).
  - It is the only layer that covers the 83% NO-MATCH bucket reliably.
  - ADAPT of Cline #77 committed-markdown sub-pattern (SSOT-cited; ~70% T16 match per §1.4 M2).
- **Stage 2 ships:** (i) `priority-score.sh` consults `done.md` existence per candidate and tags `status=DONE`; (ii) candidates tagged DONE are dropped from no-arg overview AND top-N list; (iii) `dup-detect.sh` Layer-1+Layer-2 are wired as data inputs; (iv) NEW paired-negative test under `packages/core/hooks/done-md-completion-filter.test.ts` confirming candidate with `done.md` is filtered out.

**Sequencing for Stage 2:** ship Layers 1+2+3 in one atomic PR per kickoff §2 row scope. Layer 3 is the new convention; the merging session must adopt it (Stage 4 candidate set extension: «after PR merge, write done.md if last stage; covered by Stage 2 paired-negative test»).

**T16 check on each Layer:**
- L1: project-local, no upstream match (~0%).
- L2: REUSE in-house (100% match, same helper).
- L3: ADAPT Cline #77 committed-markdown (~70%) per §1.4 M2.

**Falsifier:** wrong if (a) merging session forgets to write `done.md` (mitigation: post-merge hook or PR-template checkbox in a future amendment); (b) `done.md` content schema drifts (mitigation: paired-negative test asserts schema); (c) an umbrella that legitimately re-opens after closure leaves a stale `done.md` (mitigation: explicit `mv done.md done-<date>.md.archive` convention in re-open kickoff).

---

## §6 Parallelism declaration for downstream stages (file-scope re-flag)

**Stages 1 ∥ 2 ∥ 4 — partial conflict surfaced; reordering required:**

| Stage | Files touched | Conflict with |
|---|---|---|
| 1 | `docs/meta-factory/wave-sequencing-plan.md` | none — independent file scope |
| 2 | `.claude/skills/meta-orchestrator/helpers/priority-score.sh`, `.claude/skills/meta-orchestrator/helpers/dup-detect.sh` (wiring + Layer 3 done.md filter), `packages/core/hooks/done-md-completion-filter.test.ts` (new), kickoff convention doc | **Stage 4** (overlap on `helpers/dup-detect.sh`) |
| 4 | `.claude/skills/meta-orchestrator/SKILL.md` (14 `!`-block rewrites), `.claude/skills/meta-orchestrator/helpers/dup-detect.sh` (empty-arg → `--all` collapse), `packages/core/hooks/dup-detect-empty-arg.test.ts` (already exists from PR #264), maintainer-recipe diff | **Stage 2** (overlap on `helpers/dup-detect.sh`) |

**Re-flag:** kickoff §2 line 104 stated Stages 1 ∥ 2 ∥ 4 «touch zero shared files». **Empirically false** for `helpers/dup-detect.sh` — Stage 2 wires it as Layer 2 input, Stage 4 collapses its empty-arg branch. Same file = sequential or merge-conflict.

**Recommended re-scope (binding for Stage orchestrator):**
- **Option A (recommended)** — fold Stage 4 P4-b `dup-detect.sh` empty-arg fix into Stage 2 (same helper-file owner; Stage 4 keeps SKILL.md `!`-block rewrites + settings.json maintainer-recipe only). One file = one Stage owner.
- **Option B** — keep Stages separate but force merge-order: Stage 2 first (adds Layer-2 wire + Layer-3 done.md filter, leaves empty-arg branch alone), Stage 4 second (rewrites SKILL.md + adds empty-arg fix on rebased dup-detect.sh).

Recommend Option A. Stage 4 scope shrinks slightly; Stage 2 scope grows by the ~10-LOC dup-detect.sh empty-arg fix already designed in PR #264's paired-negative test.

**Stages 1 ∥ 2** (post-Option-A reorg) — **parallel-OK**: different files (`docs/meta-factory/wave-sequencing-plan.md` vs `.claude/skills/meta-orchestrator/helpers/*` + `packages/core/hooks/*`).

**Stage 3** — sequential after Stage 0 (this patch), parallel-OK with Stages 1 + 2 (different files: `SKILL.md` + `output-format.md` + new helper for no-arg renderer, vs the others), merge-order constraint with Stage 4 (kickoff §2 line 108) preserved.

---

## §7 §1.7 self-reflexive note (forward + backward)

Per [`phase-research-coverage.md §1.7`](../../../.claude/rules/phase-research-coverage.md).

**Forward-check:** this patch complies with —
- [`phase-research-coverage.md §1`](../../../.claude/rules/phase-research-coverage.md) — all 6 items executed (item 6 INCONCLUSIVE-channel via DeepWiki; local-fallback documented in §1.2 row 4).
- [`phase-research-coverage.md §1.12`](../../../.claude/rules/phase-research-coverage.md) — every verdict in §3 + §4 names file:line evidence quoted in §1.
- [`ai-laziness-traps.md §3`](../../../.claude/rules/ai-laziness-traps.md) — T-trap enumeration done per kickoff §4: T1 (sampling floor met — 100 PRs), T3 (file:line in every verdict), T4 (counter-prompt §7-end), T11 (SSOT + DeepWiki + WebSearch executed before any verdict), T12 (lit sweep done; no «I already know how slash-command parsers work» shortcut), T13 (ADOPT/ADAPT entries got T16 problem-class check explicit in §1.1, §1.4, §3), T15 (V1 guard auto-applies to this umbrella itself; V2 source-of-truth requires kickoff column which this kickoff has; §6 file-scope conflict detection applies recursively), T16 (every upstream entry quoted «match: X%»), T17 (no destructive recommendation — Stage 4 P4-b fix proposes COLLAPSE not DELETE of `||` semantics; PR #264's content preserved), T20 (every recommendation runs an evidence-bearing tool call in same turn).
- [`build-first-reuse-default.md §3`](../../../.claude/rules/build-first-reuse-default.md) — 6-layer mechanism executed (SSOT, DeepWiki, WebSearch, SSOT-sweep, this rule, prior-art per Candidate M1-M4 in §1.4). Each Candidate carries explicit verdict.
- [`no-paid-llm-in-ci.md §1`](../../../.claude/rules/no-paid-llm-in-ci.md) — every Stage 2 + Stage 3 mechanism is deterministic bash (regex, file-presence, jaccard) + vitest. Zero API-billed call.
- [`doc-authority-hierarchy.md §3`](../../../.claude/rules/doc-authority-hierarchy.md) — Authoritative-for + NOT-authoritative-for + Origin header above.
- [`parallel-subwave-isolation.md §1`](../../../.claude/rules/parallel-subwave-isolation.md) — patch authored in worktree `/Users/art/code/rules-as-tests-aif-noarg-s0` on branch `feat/meta-orch-no-arg-overview-s0-rphase`.
- [`recommendation-laziness-discipline.md §3`](../../../.claude/rules/recommendation-laziness-discipline.md) — every verdict in §3 + §4 backs the recommendation with a same-turn tool call (Read/Bash/WebSearch/DeepWiki output cited in §1).

**Backward-check (no silent supersession):**
- This patch is the §1 6-item completion sibling to [`2026-05-28-meta-orch-no-arg-overview-s0-thin-probe.md`](2026-05-28-meta-orch-no-arg-overview-s0-thin-probe.md) (which carved §1.5d only). The thin-probe patch is referenced verbatim; not silently superseded.
- §4 multi-signal classifier **extends** maintainer's kickoff §0 P2 5-line bash proposal — it does NOT silently replace it; M1 stays as Layer 1 within the classifier with explicit 13% coverage cited.
- §6 file-scope re-flag is **new evidence-driven** — kickoff §2 line 104 claim falsified empirically; surfaced as a recommendation to Stage orchestrator with two options.
- The thin-probe patch's §7 forward-check list (line 84-90 of thin-probe) is the predecessor — this patch adds [`phase-research-coverage.md §1.12`](../../../.claude/rules/phase-research-coverage.md) + [`recommendation-laziness-discipline.md §3`](../../../.claude/rules/recommendation-laziness-discipline.md) + [`ai-laziness-traps.md §3`](../../../.claude/rules/ai-laziness-traps.md) to that list because those rules apply with extra weight on a verdict-heavy R-phase patch (vs the data-only thin-probe).
- **Counter-prompt («what completion signal did I miss?» per T4):** considered (a) commit-message trailer (`Closes-umbrella: <name>`); (b) PR-body footer marker; (c) GitHub label `umbrella:<name>`. All three are reasonable; none was BUILT here because (a)/(b) require commit-or-PR-message discipline (which §1.5c implicitly shows is loose), and (c) requires gh-API write access at merge time. The `done.md` Layer 3 is offline-deterministic and zero-permission. Future trigger to re-evaluate: ≥3 incidents in 6 months of stale `done.md` files.
- T15 self-application against THIS umbrella's own naming: branch `feat/meta-orch-no-arg-overview-s0-rphase` matches PREFIX-UMBRELLA (Layer 1) — covered. After Stages 1-4 merge, the Stage 2 multi-signal classifier MUST correctly classify this umbrella as DONE (verified by adding `done.md` post-merge; failing to do so = §3-stage-gate ATTN at next `/meta-orchestrator` invocation).

---

## §8 See also

- [`2026-05-28-meta-orch-no-arg-overview-s0-thin-probe.md`](2026-05-28-meta-orch-no-arg-overview-s0-thin-probe.md) — §1.5d carve-out (closed via PR #264). Sibling patch; this patch covers §1 items 1, 2, 3, 4, 5a, 5b, 5c, 6.
- [`../../../.claude/orchestrator-prompts/meta-orch-no-arg-overview/kickoff.md`](../../../.claude/orchestrator-prompts/meta-orch-no-arg-overview/kickoff.md) — binding scope; §1/§3/§4/§6 verdicts in this patch reference its §0 P1/P2/P3 + §0.5 falsifiers + §1 6-item + §2 stage table + §4 T-traps.
- [`../prior-art-evaluations.md`](../prior-art-evaluations.md) — SSOT consulted §1.1 (rows #64, #65, #66, #68, #77, #79, #80, #81 cited).
- [`../../../.claude/rules/ai-laziness-traps.md`](../../../.claude/rules/ai-laziness-traps.md) — T20 in particular for the inline-verdict-without-evidence discipline applied throughout §3.
- [`../../../.claude/rules/recommendation-laziness-discipline.md`](../../../.claude/rules/recommendation-laziness-discipline.md) — parent rule for the every-verdict-backs-with-evidence pattern applied to §3 + §4.
- [`../../../.claude/skills/meta-orchestrator/SKILL.md`](../../../.claude/skills/pipeline/SKILL.md) — Stage 3 implementation target (V1 routing branch + V4 top-N + V3 overview render).
- [`../../../.claude/skills/meta-orchestrator/references/output-format.md`](../../../.claude/skills/pipeline/references/output-format.md) — V3 new section `## §1A No-arg overview format` lands here; V2 reuses existing §3 Action queue column.
- [`../../../.claude/skills/meta-orchestrator/helpers/priority-score.sh`](../../../.claude/skills/pipeline/helpers/priority-score.sh) + [`../../../.claude/skills/meta-orchestrator/helpers/dup-detect.sh`](../../../.claude/skills/pipeline/helpers/dup-detect.sh) — Stage 2 implementation targets (§4 Layer 1+2+3 wiring).
- [`../../../packages/core/principles/18-meta-orchestrator-output-format.test.ts`](../../../packages/core/principles/18-meta-orchestrator-output-format.test.ts) — §1.5b verified zero-churn target.
- [PR #264](https://github.com/Yhooi2/rules-as-tests-aif/pull/264) — Stage 0-thin §1.5d closure; §0.5 P4 falsifier resolved upstream of this patch.
