<!-- scope:meta-orchestrator-ux-research -->
# Research patch — Sub-wave F.1: multi-stage dispatch UX prior-art survey

> **Inherits authority from** [research-patches/README.md](README.md) folder-level Authoritative-for header. Scope-bound to: UX prior-art for `/meta-orchestrator` output format — paste-this-block, dependency graph, action queue, closed-loop re-invocation. **NOT authoritative for** project goal (see [README.md#why-this-exists](../../../README.md#why-this-exists)); the SKILL.md edits themselves — those are F.3's deliverable; build-vs-reuse verdict on the meta-orchestrator capability (already settled: BUILD, see [2026-05-23-meta-orchestrator-prior-art.md](2026-05-23-meta-orchestrator-prior-art.md)).
> **Date:** 2026-05-24 · **Author session:** claude-sonnet-4-6, Sub-wave F.1 (read-only + this file + commit). No SKILL.md edits, no principle stubs, no PRs.
> **Tags:** `#meta-orchestrator-ux` · `#paste-this-block` · `#dependency-graph` · `#action-queue` · `#closed-loop`

---

## §A.1 — Prior-art summary

Evidence gathered via WebSearch ≥3 phrasings per candidate + DeepWiki for repo-specific behaviour. Sources cited inline.

### Candidate 1 — GitHub Actions (`workflow_dispatch` + `needs:` + `gh` CLI)

**Source:** [GitHub Docs — visualization graph](https://docs.github.com/actions/managing-workflow-runs/using-the-visualization-graph) · [gh run view](https://cli.github.com/manual/gh_run_view) · GitHub Changelog 2025-12-04 (25-input limit)

The canonical CI DAG tool for most developers. `workflow_dispatch` accepts typed inputs (string / boolean / choice / number / environment) via a form in the GitHub UI — the UI auto-generates input fields from YAML `inputs:` declarations. The `needs:` key at the job level declares dependencies; the GitHub UI renders a real-time visualization graph (color-coded boxes with dependency lines). The `gh` CLI offers `gh run view --job`, `gh run watch`, and `gh workflow run` for terminal users. `workflow_dispatch` invocation via CLI: `gh workflow run <name> --field key=value`. No «paste this next command» output — operators must know the next job name manually.

**UX problem solved:** web-form input collection for CI triggers; real-time job-status visualization in a browser.

### Candidate 2 — Concourse CI (`fly` CLI + pipeline DAG UI)

**Source:** [Concourse pipeline UI explained](https://concourse-ci.org/blog/2018-08-17-concourse-pipeline-ui-explained/) · DeepWiki `concourse/concourse`

`fly trigger-job -j pipeline/job-name -w` is the copy-paste CLI pattern. The web UI shows the pipeline as a visual DAG (jobs as boxes, resources as circles, dependency arrows). Dotted lines = trigger:false (manual); solid lines = auto-trigger. No ASCII-in-terminal DAG — the visualization lives only in the web browser. The CLI itself (`fly`) presents no «what to run next» intelligence. The «paste this» pattern in Concourse is limited to the `fly` binary download command shown on the welcome page.

**UX problem solved:** pipeline state visualization in a web UI; CLI invocation of known jobs by name.

### Candidate 3 — Argo Workflows (`argo submit`, `argo get`, `argo list`)

**Source:** [Argo Workflows DAG walk-through](https://argo-workflows.readthedocs.io/en/latest/walk-through/dag/) · DeepWiki `argoproj/argo-workflows` · WebSearch

`argo get` and `argo list` output a tabular status view (workflow name, status, duration). When the CLI renders a DAG run, it uses an ASCII tree:
```text
STEP                       PODNAME        DURATION  MESSAGE
 ✔ dag-hl6lc main
 ├─✔ a            whalesay   dag-hl6lc-… 10s
 ├─✔ b            whalesay   dag-hl6lc-… 10s
 └─✔ c            whalesay   dag-hl6lc-… 9s
```
Parallel tasks appear as sibling branches (same indent level). Dependencies are implicit in the tree structure — a task's parent is its upstream dependency. No «what to run next» — operators submit a YAML workflow spec upfront; the engine handles ordering. `argo submit` = one-liner to launch a full workflow, not a stage.

**UX problem solved:** real-time ASCII status of a running multi-step workflow; Kubernetes-native DAG execution.

### Candidate 4 — Dagger (`dagger call`, TUI)

**Source:** [Dagger CLI reference](https://docs.dagger.io/reference/cli/) · DeepWiki `dagger/dagger` · [Dagger.io review](https://medium.com/@frank.ittermann_46267/part-2-my-journey-with-dagger-io-almost-perfect-but-not-quite-2bb3b645e938)

`dagger call <function> [--arg value]` is the copy-paste pattern — functions are chained via pipes (`dagger call build --source . | dagger call test`). The Terminal UI (TUI) renders a live DAG tree of OpenTelemetry spans during execution: parent-child relationships indicate call chains; green ✔ / red ✗ per node; duration shown inline. No dependency-graph-before-run rendering (DAG is emergent from execution, not declared ahead). Standard format: `dagger -m github.com/org/repo@tag call function-name --flag value`.

**UX problem solved:** real-time pipeline execution visualization in a terminal with caching visibility; copyable per-function invocations in CI shell scripts.

### Candidate 5 — `just` task runner (`just --list`, recipe deps)

**Source:** DeepWiki `casey/just` · [Justfile became my favorite task runner](https://tduyng.medium.com/justfile-became-my-favorite-task-runner-7a89e3f45d9a)

`just --list` outputs a flat table: `recipe-name # doc comment`. Dependencies between recipes exist internally (declared via `recipe: dep1 dep2` syntax) but are NOT shown in `--list` output. Invocation: `just recipe-name` or `just recipe arg1 arg2`. The mental model is «named shell scripts with automatic dependency ordering» — not an interactive «what to do next» system. No multi-session handoff concept.

**UX problem solved:** named, documented command shortcuts in a project; implicit dependency ordering without Makefile complexity.

### Candidate 6 — LangGraph (human-in-the-loop checkpoints)

**Source:** [LangChain HITL docs](https://docs.langchain.com/oss/python/langchain/human-in-the-loop) · DeepWiki `langchain-ai/langgraph`

LangGraph's HITL pattern: `interrupt()` inside a node pauses graph execution and surfaces an `Interrupt(value=<message>)` object to the Python/TypeScript caller. Resume requires calling `stream(Command(resume=<value>), config={"thread_id": ...})`. The operator sees: `{'__interrupt__': (Interrupt(value='approve this action?', id='...'))}`. This is a **programmatic API** interrupt — the «what to do next» is a Python/TS method call, not a chat-paste block. The stream_mode options (`values`, `updates`, `tasks`, `debug`) provide varying detail about execution. No human-readable «paste this to a new session» concept.

**UX problem solved:** state-machine interrupt/resume for autonomous agents; thread-based state persistence across invocations.

### Candidate 7 — Cline `new_task` handoff

**Source:** [Cline new_task tool](https://docs.cline.bot/exploring-clines-tools/new-task-tool) · WebSearch

Cline's `new_task` tool ends the current session and starts a new one with a structured context block. The handoff template includes: Completed Work / Current State / Next Steps / Reference Information / Actionable Start. When context window reaches 50%, Cline uses `ask_followup_question` to propose creating a new task with a pre-populated context block. The format is **natural-language prose** passed to the `new_task` tool — not a slash-command with structured flags. The operator approves the handoff; Cline composes the context.

**UX problem solved:** context-window boundary management across sessions; structured continuity of state across multiple Cline invocations.

### Candidate 8 — Superpowers `dispatching-parallel-agents`

**Source:** DeepWiki `obra/superpowers`

The `dispatching-parallel-agents` skill illustrates parallel dispatch via TypeScript-like pseudocode with multiple `Task(...)` calls in one message. The skill does NOT define a copy-paste block format for the human operator. Visualization uses embedded Graphviz `dot` diagrams within `SKILL.md` for documentation — these are not rendered as ASCII in chat; they are static SVG-style notation in the markdown. The «Review and Integrate» phase instructs the operator to read agent summaries — no paste-ready blocks.

**UX problem solved:** AI session parallel agent fan-out with explicit task separation; decision framework for when parallel dispatch is warranted.

### Candidate 9 — `gh workflow run` + `workflow_dispatch` format (slash-tag comparison)

**Source:** [gh workflow view](https://cli.github.com/manual/gh_workflow_view) · [workflow_dispatch inputs guide](https://oneuptime.com/blog/post/2025-12-20-workflow-dispatch-inputs-github-actions/view) · WebSearch

`gh workflow run <name> --field key=value --field key2=value2` is the closest natural analog to the slash-tag draft (`/Mode-A /Roles-worker`). It's a positional command + `--field` flag pairs. Inputs are defined in YAML `inputs:` with `type`, `description`, `default`, `required` fields. The GitHub UI renders a form for these inputs; the CLI uses `--field`. Recent community discussions (GitHub Discussion #12882) show users requesting better multiline input support — the current string input UX is limited.

**UX problem solved:** structured parameterized workflow triggering with typed validation; human-friendly form input in the browser.

### Candidate 10 — Orchestrator-guide article (chat-based agent UX patterns)

**Source:** [Agent skills vs slash commands vs prompts](https://www.awesomeskills.dev/en/blog/agent-skills-vs-slash-commands-vs-prompts) · [Context engineering slash commands](https://jxnl.co/writing/2025/08/29/context-engineering-slash-commands-subagents/) · WebSearch

Jason Liu's article (2025-08-29) distinguishes: slash commands = deterministic control (bypasses LLM reasoning, 100% intent reliability); natural language = ambiguous; slash commands inject a long prompt into the context window. The dominant pattern in mature AI agent tools: slash command for routing/invocation + natural language payload after the command for context. Example: `/deploy to production` (slash = deterministic routing; `to production` = natural language payload parsed by the LLM). No flag-based syntax (`/Mode-A /Roles-worker`) observed in mature tools.

**UX problem solved:** deterministic command dispatch with LLM-parsed natural-language context; reduced round-trips vs. pure NL.

---

## §A.2 — Problem-class matching (T16 explicit verification)

**Our problem class (verbatim from kickoff, slightly refined for precision):**

A single maintainer drives a long-lived, multi-umbrella workflow where each umbrella decomposes into N stages with stage-to-stage dependencies and intra-umbrella parallelism. The maintainer wants `/meta-orchestrator <umbrella>` to: (a) auto-detect current state from git/PR reality, (b) produce a copy-paste-ready paste-this-prompt block per next-actionable stage, (c) show stage dependencies + parallelism at a glance in ONE compact rendering, (d) keep maintainer's per-invocation cognitive load to «open new tab, paste one block» without parsing structured flag syntax. The **medium is a chat session; the rendering is plaintext markdown in a CLI/chat UI**. The artefact lifecycle: maintainer invokes → AI plans → maintainer pastes ONE block in a fresh CC session → session executes autonomously → on completion maintainer re-invokes → loop closes.

---

| Candidate | Upstream problem class | Our problem class | Match? Evidence | Verdict |
|---|---|---|---|---|
| **1 — GitHub Actions `workflow_dispatch`** | Parameterize CI workflow triggers via typed form inputs in a web browser or CLI flag pairs; web UI shows DAG status | Produce a chat-pasted natural-language block for a new AI session, showing dependencies in plaintext | **Partial (visualization axis only).** `needs:` + web DAG = dependency rendering model directly applicable. BUT: `--field key=value` format ≠ our plaintext chat block (different medium entirely: structured CLI vs. chat input); no «what to run next» intelligence; no closed-loop re-invocation. | **REFERENCE** (dependency visualization vocabulary + `needs:` DAG model) |
| **2 — Concourse `fly` CLI** | Named CI job triggering in a YAML pipeline; visual DAG in a web browser | Chat-based dependency-aware session dispatch | **Weak.** `fly trigger-job -j pipeline/job` is close to our `just paste this command` shape but: (a) operator must know the job name manually; (b) DAG lives in browser, not CLI output; (c) no «what can run parallel» intelligence surfaced to operator. Medium mismatch (browser vs. chat). | **REFERENCE** (paste-this-CLI-command pattern; negative evidence: browser-only DAG is insufficient for our chat-first medium) |
| **3 — Argo Workflows CLI** | Kubernetes DAG workflow execution with real-time ASCII tree status; YAML-defined workflow spec | Plaintext chat dependency visualization + copy-paste session dispatch | **Partial on visualization axis.** The `├─✔ / └─✔` ASCII tree IS the pattern closest to what we need for dependency + parallel rendering. BUT: Argo shows execution-time status (retrospective), not pre-run dispatch plan (prospective); no «paste this» block output; operator submits the whole workflow upfront, not stage-by-stage. | **ADAPT vocabulary** (`├─ / └─` ASCII tree pattern for dependency + parallel display) |
| **4 — Dagger TUI** | Real-time pipeline execution tree in a terminal via OpenTelemetry spans; `dagger call func --arg val` | Plaintext chat pre-run plan + copy-paste dispatch | **Weak match.** TUI DAG is runtime-emergent (shows what IS running), not a pre-run plan (shows what WILL run + when + in what order). `dagger call` = function invocation on a known function; our block includes AI context, roles, skills — fundamentally different payload. Different medium (TUI vs. chat). | **REFERENCE** (runtime DAG visualization inspiration; `dagger call` as evidence that positional args beat slash-tag flags) |
| **5 — `just --list`** | Flat listing of available named recipes with doc comments | Action queue showing dependencies + parallelism | **No match.** `just` is a flat recipe list; it explicitly hides dependency ordering from `--list`. No «what to run next» concept. No multi-session handoff. Pattern contribution: clean `recipe-name # description` format for single-line action items. | **KEEP NARROW** (our action queue table is a superset; `just --list` one-liner per action is an ADAPT vocabulary candidate for row descriptions) |
| **6 — LangGraph HITL** | Python/TS programmatic interrupt/resume with thread-based state persistence | Chat-pasted block for a new human-opened CC session | **No match on medium.** LangGraph's HITL is a programmatic API (`interrupt()` → `Command(resume=...)`) — the human interacts via Python/TS code, not a chat-paste. The state-persistence model (thread_id + checkpoint) IS conceptually similar to our «re-invoke meta-orchestrator → auto-detect state» pattern. | **REFERENCE** (closed-loop re-invocation pattern — checkpoint + thread-id concept maps to our «gh pr list re-derives state» approach; confirms the pattern is well-established) |
| **7 — Cline `new_task` handoff** | Auto-generated context block passed to a new session via `new_task` tool; natural-language prose | Maintainer-pasted block for a new CC session | **Closest functional match found.** Cline's `new_task` context block: Completed Work / Current State / Next Steps / Actionable Start = same structural intent as our 1-liner block. BUT: (a) Cline auto-generates and auto-submits the context (no maintainer paste step); (b) format is prose, not a `/skill-command + context`; (c) single-task continuation, not multi-stage dispatch plan. **The strongest functional overlap for the «structured handoff» axis.** | **ADAPT** (handoff context structure: Completed/State/NextStep/ActionableStart maps to our 1-liner block template; refine for chat-paste + skill invocation) |
| **8 — Superpowers `dispatching-parallel-agents`** | AI-internal parallel fan-out with `Task()` pseudocode; Graphviz dot diagrams in SKILL.md | Human-facing paste-ready blocks with plaintext ASCII dependency visualization | **No match on output format.** SP shows AI-to-AI Task dispatch (not human-pasted); dot diagrams = SVG/PNG in markdown (not CLI-renderable ASCII in chat). The parallel fan-out CONCEPT is our §5 Mode B, already REFERENCEd in the build R-phase (#64/#65). | **REFERENCE** (already covered by SSOT #64/#65; no new UX-format contribution beyond what prior R-phase registered) |
| **9 — `gh workflow run --field`** | Structured CLI invocation with `--field key=value` flag pairs | Chat-paste block with context payload | **Partial — negative evidence for slash-tag format.** `--field key=value` is the mature convention for structured parameterization; `/Mode-A /Roles-worker` flag-prefix format has no precedent in any surveyed tool. The `gh workflow run` syntax IS familiar to maintainer already (used in this project). However, `--field key=value` is CLI-native, not chat-native — a maintainer pasting `gh workflow run --field mode=A --field roles=worker` into a CC chat session would be confusing (CC doesn't parse CLI flags). | **REFERENCE** (negative evidence: structured-flag syntax doesn't transfer to chat medium; confirms natural language + skill-slash is the convergent pattern) |
| **10 — Slash command + NL payload** | Deterministic routing via slash command + natural-language context after the slash | `/orchestrator` + plain-language brief for the session | **Good match on design principle.** Mature pattern across Claude Code, Cline, GitHub Copilot Chat, Cursor, Discord: `/<skill> <natural-language-context>`. The global `/orchestrator` skill already uses this exact pattern (per SKILL.md: accepts natural-language after slash). The slash-tag format (`/Mode-A /Roles-worker`) is an aberration from this convergent norm. | **ADOPT VOCABULARY** (slash + natural-language payload = confirmed mature pattern for chat-native dispatch; the 1-liner block should follow this shape) |

---

## §A.3 — Verdict summary + 6-item search-coverage

### Synthesis

No mature upstream tool exactly matches our problem class (single-maintainer, multi-stage, chat-paste, closed-loop, plaintext markdown output). The composite verdict from prior R-phase (BUILD) stands. However, F.1 finds **three specific UX sub-patterns** that should be directly ADOPTED or ADAPTED rather than reinvented:

1. **ASCII tree for dependency + parallel rendering** (ADAPT from Argo Workflows `├─ / └─` pattern): the prospective plan version (showing what WILL happen) is novel, but the rendering vocabulary is well-established.
2. **Slash + natural-language payload for chat dispatch** (ADOPT VOCABULARY from 10+ mature tools): `/orchestrator <natural-language-brief>` is the convergent pattern; the slash-tag format `/Mode-A /Roles-worker` has zero upstream precedent and should be dropped.
3. **Handoff context structure** (ADAPT from Cline `new_task`): Completed / Current State / Next Steps / Actionable Start mirrors our 1-liner block intent; refine for multi-stage and skill invocation.

The **dependency visualization question** (Candidate 1 vs. 3): GitHub Actions uses a web UI DAG; Argo Workflows uses CLI ASCII tree. For our **chat-only medium**, the Argo-style ASCII tree is the only viable option — web UI is out of scope, Graphviz dot is unrendered in chat.

### 6-item search-coverage checklist (applied to «no exact upstream match» claim)

1. **Own-stack sweep:** existing SSOT (#66-#71) + Superpowers (#64/#65) + Claude Code primitives all checked. No existing row addresses UX output format — only capability. ✅ Clear.
2. **Category sweep:** CI orchestration (GHA, Concourse, Argo, Dagger) + task runners (`just`, Taskfile) + AI agent orchestration (LangGraph, Cline, Superpowers) + chat UX patterns (slash commands, `workflow_dispatch`). 6 distinct categories. ✅ Covered.
3. **Semantic-distance check:** searched «multi-stage CI dispatch UX», «orchestrator output format copy-paste», «paste-this-prompt parallel agent», «action queue dependency visualization», «slash command vs natural language agent dispatch». Not anchored to single vocabulary cluster. ✅ Diverse.
4. **Adversarial counter-prompt:** «If a mature tool DID solve the chat-paste + dependency-graph problem for human-in-the-loop AI dispatch, where would it live?» Checked: Claude Code commands (`/batch`, `/plan` — already REJECTED per prior R-phase #5), Cline new_task (closest; checked), AutoGen (programmatic, no chat-paste), n8n kanban (web UI, no chat-paste). None match composite. ✅ Counter-prompt found Cline as closest partial; still not ADOPT-grade.
5. **Floor ≥ 5 candidates (not ceiling):** Researched 10 candidates (4 explicit from kickoff + 6 adjacent). Each with source URL. ✅ Above floor.
6. **Trigger sweep:** SSOT #66-#71 checked; no existing entry addresses UX format. No trigger to re-litigate. ✅ Clean.

**Negative-existence verdict (provisional, acceptable):** No mature upstream tool implements the composite of (a) chat-pasted natural-language block + (b) plaintext ASCII dependency graph + (c) action queue table + (d) closed-loop gh-pr-list auto-detection in a single output artifact. Confidence: high on (a)+(b)+(d); medium on (c) (action queue table format has partial precedents in project management tools like Linear, but those are web UI, not plaintext-markdown).

---

## §A.4 — Answers to Q1–Q5

### Q1: «Paste-this-block» vs «structured flag args» — what do mature tools converge on?

**Convergent answer: slash command + natural-language payload after the slash.**

Evidence from 10 candidates:
- GitHub Actions `workflow_dispatch`: `--field key=value` (CLI flag pairs) — but this is for shell/CI, not chat sessions.
- Cline: natural-language prose in `new_task` context block, no slash-prefix flags.
- Claude Code global `/orchestrator`: natural language after the slash (per SKILL.md body — reads and interprets NL).
- ChatOps / Discord / GitHub Copilot Chat: `/<command> <natural-language-payload>` is the universal pattern.
- Jason Liu's article (2025): slash = deterministic routing; NL = LLM-parsed payload after the slash.

The `/Mode-A /Roles-worker /Skills-foo /Autonomous-yes` format has ZERO precedent in any surveyed tool. It is «CLI flag syntax injected into a chat field» — a category mismatch. The global `/orchestrator` skill (confirmed source in SKILL.md: natural-language after invocation) does NOT parse structured flag tokens. The maintainer's «not convenient» rating aligns exactly with this mismatch.

**Recommendation for F.3:** Replace slash-tag format with:
```text
/orchestrator
<umbrella-name> — Stage N: <what this stage does in plain Russian/English>.
Mode: <A|B×N|SDD|Queue>.
Kickoff: .claude/orchestrator-prompts/<umbrella>/kickoff.md §<section>.
Key constraints: <stop conditions, 1-2 lines>.
```
Where `/orchestrator` is the slash command (deterministic routing) and everything after it is natural-language payload parsed by the LLM. This matches the convergent pattern across all 10 candidates.

### Q2: Stage-dependency visualisation — ASCII graph vs table vs Gantt vs DAG-image?

**Convergent answer (for CLI/chat plaintext): ASCII tree with `├─` / `└─` symbols.**

Evidence:
- Argo Workflows: CLI uses `├─✔ task-name ... 10s` ASCII tree — the only CLI tool that renders DAG in terminal.
- GitHub Actions: web UI only (SVG graph); CLI (`gh run view`) shows a flat table of jobs, no dependency arrows.
- Dagger TUI: live tree during execution (not prospective plan).
- Concourse: web browser only (SVG pipeline graph).
- Gantt charts: require fixed time estimates — inappropriate for our Volume-based (S/M/L) model.
- Mermaid diagrams: unrendered in Claude Code chat output (rendered in GitHub PR descriptions, but not in CC session responses).
- Plain markdown tables: can show dependency columns but lose visual hierarchy of the tree.

**The Argo ASCII tree pattern (adapted for prospective planning) is the strongest option** for our chat medium. Example shape (prospective, not retrospective):
```text
Stage 1 (now):
├── F.1 — UX research       [R-phase, Mode A, ~30k]  PARALLEL-OK ↔
└── F.2 — Cold review       [R-phase, Mode A, ~30k]  PARALLEL-OK ↔

Stage 2 (after both Stage 1 branches merge):
└── F.3 — UX implementation [Mode A, ~40k]
```
`├──` = sibling (parallel); `└──` = last sibling; indentation = stage ordering.

### Q3: Action queue / next-step rendering — what format encodes state best?

**Convergent answer: Markdown table with 5 columns: #, Action (paste block name), Когда, Ждёшь (what to wait for), Можно параллельно с.**

Evidence comparison:
- Argo CLI: shows status-after-execution (retrospective), not plan-before-execution.
- LangGraph `stream_mode=updates`: programmatic dict output, not human-readable table.
- Linear project view: web UI only; markdown table with `Blocked by` / `Blocking` columns is closest plaintext analog.
- `just --list`: flat 1-column list — too minimal for our multi-column state (when / what to wait for / parallel).

The kickoff's proposed table format (| # | Paste в новый CC tab | Когда | Ждёшь | Можно параллельно с |) is well-aligned with the strongest plaintext precedents found. **The kickoff draft is valid — ADAPT the column headers slightly for clarity but keep the 5-column table.**

Key finding: the «Можно параллельно с» (parallel-safe partner) column has NO direct upstream precedent in a static table — it's a genuine BUILD contribution. All CI tools (GHA, Concourse, Argo) show parallelism dynamically during execution, not statically in a plan table. This column addresses the specific gap: a human operator reading a static plan needs to know «can I paste both Stage 1 blocks into two CC tabs right now, or must I wait?»

### Q4: Closed-loop re-invocation — how do mature tools handle session-N-complete → re-invoke coordinator?

**Pattern: checkpoint + mechanical state re-derivation.**

Evidence:
- LangGraph: thread_id + `Command(resume=...)` — state is persisted in checkpointer; re-invocation re-derives from saved state. **Core principle: state comes from the store (checkpointer), not from the human's memory of what happened.** This exactly mirrors our «`gh pr list` re-derives state, REPORT is supplementary» model.
- Cline `new_task`: context block is the «checkpoint»; new session reconstructs from it. Risk: human-copied context can be stale (Cline mitigates by auto-populating it at the 50% threshold).
- GitHub Actions: completely stateless per-run; no re-invocation concept.
- Concourse: pipeline is always-running; no «session N done → re-invoke» cycle.

**Our model is CLOSEST to LangGraph's thread-checkpoint pattern**, but implemented without a persistent server (we use `gh pr list` as the authoritative state source instead of a database). The key design principle confirmed: **do NOT trust the human's REPORT as authoritative state** — always re-derive from mechanical sources. This is already correctly specified in the kickoff §1 3-layer table.

**Stale-REPORT reconciliation pattern** (gap in current SKILL.md): when REPORT says «Stage 1 merged» but `gh pr list` shows no such merge — emit «REPORT says X, mechanical state says Y; trusting mechanical state; here is what I found». This is the «flag the discrepancy back» pattern specified in the kickoff. No upstream tool implements this exact reconciliation; it should be explicit in SKILL.md §1 Step 2 drift detection (currently missing this specific case).

### Q5: Single-shot vs iterative output design — what UX-research methodology is mature for «not convenient» feedback?

**Two strongest methods for our context:**

1. **Paired A/B draft + single-round comparison** (strongest for async chat): Present two format variants side-by-side in ONE message — «Format A (current slash-tag) vs Format B (slash + NL payload)» — and ask maintainer to rate each on the same 1-3 scale. This is the chat-native analog of A/B testing; the synchronous compare resolves ambiguity in one round-trip rather than 2-3.

2. **Retrospective think-aloud + targeted change** (per NNGroup AI usability research): After the maintainer uses the updated format once, ask «what friction did you notice?» (retrospective) rather than «do you like it?» (evaluative). Friction-framing elicits specific actionable findings vs. vague preference ratings. Source: [NNGroup AI tools limitations](https://www.nngroup.com/articles/ai-powered-tools-limitations/) — concurrent think-aloud fails for conversational AI (participant is already talking to the system), retrospective works.

**Recommendation for F.3:** ship one revised format (using F.1 §A.5 recommendations below) + ask maintainer ONE targeted question after first use: «What part of the block caused friction when pasting?» This bounds to ≤1 iteration round in F.3's scope.

---

## §A.5 — Direct input to F.3

### Recommendation (i): 1-liner block format — drop slash-tags, adopt slash + NL payload

**Derived from:** §A.4 Q1 verdict; T16 mismatch of slash-tag format with global `/orchestrator` skill (NL-after-slash); Candidate 10 ADOPT VOCABULARY.

Replace:
```text
/orchestrator /<umbrella-name> /Mode-<X> /Roles-<r1>,<r2> /Skills-<s1> /Autonomous-yes /Iterative-review-no
/Kickoff:.claude/orchestrator-prompts/<umbrella>/kickoff.md#§<section>
...
```

With:
```text
/orchestrator

<umbrella-name> — Stage <N>: <plain-language description of what this stage does, 1-2 sentences>.
Mode <X>: <which workers/worktrees, brief>.
Kickoff: `.claude/orchestrator-prompts/<umbrella>/kickoff.md` §<section>.
Key acceptance criteria: <1-2 lines>.
Stop condition: <main F-condition from kickoff §7>.
```

The `/orchestrator` slash command is the deterministic routing token (consistent with CC's slash-command primitive). Everything after the blank line is natural-language payload parsed by the global `/orchestrator` skill's LLM. No structured flags — the LLM reads the natural-language brief and selects Mode/Roles/Skills internally (as it does today for all `/orchestrator` invocations).

**Falsifier:** wrong if the global `~/.claude/skills/orchestrator/SKILL.md` does NOT accept natural language after slash invocation but requires structured flags — F.3 must verify by reading that skill's body before adopting this recommendation. (Agent-uncommittable: F.3 reads but does not edit.)

### Recommendation (ii): Dependency graph format — Argo-style ASCII tree (prospective)

**Derived from:** §A.4 Q2 verdict; Candidate 3 ADAPT vocabulary.

```text
## Dependency graph

Stage 1 — СЕЙЧАС (оба параллельно):
├── F.1 — UX research       (Mode A, ~30k, read-only)
└── F.2 — Cold review       (Mode A, ~30k, read-only)

Stage 2 — после мержа обоих Stage 1:
└── F.3 — UX implementation (Mode A, ~40k, зависит от F.1+F.2)
```

`├──` = parallel sibling; `└──` = last or sole node; stage indented under label; parenthetical = Mode + estimated cost + key constraint.

**Falsifier:** wrong if the Argo ASCII tree is too detailed for the 10-15 stages of a real umbrella (causes visual overload). If testing with `mutation-discipline-umbrella` (4 stages) shows overload → fall back to a flat table with «Deps» column only.

### Recommendation (iii): Action queue table format — keep the kickoff draft, minor refinements

**Derived from:** §A.4 Q3 verdict; kickoff draft already structurally correct per prior-art survey.

Keep the 5-column table from the kickoff:
```text
| # | Paste в новый CC tab | Когда | Ждёшь | Можно параллельно с |
```

Refinements:
- Column 2 heading: «Блок» (shorter, fits in chat)
- Column 5: «Параллельно с» (drop «Можно» for column width)
- Add row under table: «Всего твоих paste'ов: <N>»

**Falsifier:** wrong if maintainer finds 5 columns too wide for a mobile/small-window chat view — then collapse to 3 columns (# | Блок | Когда/Параллельно).

### Recommendation (iv): Closed-loop re-invocation — add explicit REPORT reconciliation line to SKILL.md §1

**Derived from:** §A.4 Q4 LangGraph checkpoint pattern.

SKILL.md §1 Step 2 (drift detection) should add: «If maintainer-passed REPORT states something that contradicts `gh pr list` output (e.g. REPORT says "Stage 1 merged" but `gh pr list` shows no such merge) → emit: «REPORT says X; mechanical state shows Y; trusting `gh pr list`; possible causes: stale REPORT, pending GitHub sync, or REPORT was for a different branch. Proceeding on mechanical state.»»

This is currently prose in the kickoff's 3-layer table but absent from SKILL.md §1 Step 2 text. Adding it closes the mechanical-vs-REPORT reconciliation gap without changing the overall architecture.

**Falsifier:** wrong if `gh pr list` itself returns stale data within a GitHub propagation window (< 60s). In that case both REPORT and `gh pr list` would agree incorrectly. Mitigation already in kickoff: `plan-currency-check.sh` should add `git fetch origin <branch>` before querying. (This is Gap-2 from §1.5 — existing follow-up, not introduced here.)

---

## §A.6 — Falsifiers

| Recommendation | Wrong if... |
|---|---|
| (i) Slash + NL payload format | Global `/orchestrator` SKILL.md body does NOT accept NL after slash — requires structured flags. F.3 must read SKILL.md source before adopting. |
| (i) Drop slash-tag format | Maintainer confirms «I was already parsing the slash-tags manually and preferred them» — contradicts «not convenient» feedback. Low probability given explicit «не нравится». |
| (ii) Argo ASCII tree | 10+ stage umbrella creates unreadable ASCII tree in chat. Test: try with `mutation-discipline-umbrella` (4 stages) and a hypothetical 10-stage umbrella before shipping. |
| (ii) ASCII tree over Mermaid | Claude Code begins rendering Mermaid diagrams inline in chat responses. Then Mermaid becomes preferred — recheck at F.3 time. |
| (iii) 5-column action table | Maintainer finds 5 columns too wide — use 3 columns (# | Блок | Когда/Параллельно) as fallback. |
| (iv) REPORT reconciliation line | SKILL.md already has equivalent wording that F.1 missed. F.3 must diff §1 Step 2 text carefully before adding duplicate. |
| Composite (no ADOPT-verbatim) | A new Claude Code `/batch-plan` or similar skill ships between 2026-05-24 and F.3 execution that matches the composite. Check `code.claude.com/docs/en/commands.md` changelog before F.3. |

---

## §A.7 — See also

- Kickoff source (SSOT for UX requirements): [`.claude/orchestrator-prompts/meta-orchestrator-followup-audit/kickoff.md §1 Sub-wave F`](../../../.claude/orchestrator-prompts/meta-orchestrator-followup-audit/kickoff.md) lines 167-335.
- Prior meta-orchestrator BUILD R-phase (capability verdict, not UX): [`2026-05-23-meta-orchestrator-prior-art.md`](2026-05-23-meta-orchestrator-prior-art.md).
- SSOT rows relevant: #64 (SP `subagent-driven-development`), #65 (SP `using-git-worktrees`), #66 (AIF REFERENCE), #68 (OhMyOpencode REFERENCE+ADOPT-VOCABULARY), #70 (ComposioHQ REFERENCE), #71 (SP Red Flags REJECT).
- Current SKILL.md state: [`.claude/skills/meta-orchestrator/SKILL.md`](../../../.claude/skills/pipeline/SKILL.md) §5 (dispatch tree) and §10 (output artifacts).
- BFR rule (7-verdict taxonomy): [`.claude/rules/build-first-reuse-default.md §1`](../../../.claude/rules/build-first-reuse-default.md).
- T16 trap (pattern-matching-on-name): [`.claude/rules/ai-laziness-traps.md §2 T16`](../../../.claude/rules/ai-laziness-traps.md).
- Global `/orchestrator` skill (agent-uncommittable, F.3 must read before adopting rec (i)): `~/.claude/skills/orchestrator/SKILL.md`.

---

## §A.8 — Decision log (F.1 session)

| Decision | Reason |
|---|---|
| Candidate count = 10 (not 6 minimum) | T1 counter: stopped at 3 candidates would miss Cline (closest handoff analog) and slash+NL pattern evidence. Added candidates 7-10. |
| LangGraph included despite prior REJECT verdict | Prior REJECT (#66-#71 area) was for the CAPABILITY BUILD verdict (LangGraph as meta-orchestrator is wrong problem class). For UX patterns (HITL checkpoint model), LangGraph is relevant and not previously evaluated on this axis. Not re-litigating capability verdict. |
| No new SSOT rows proposed | The UX sub-patterns found (Argo ASCII tree, slash+NL, Cline handoff) are sub-pattern ADAPT/REFERENCE findings, not new capability-level entries. Per SSOT policy: rows at capability commit moment, not research patch. SSOT rows for these patterns should land when F.3 implements them in a capability commit. |
| Composite verdict = BUILD with ADAPT from 3 sub-patterns | No single upstream tool matches the composite (confirmed by counter-prompt search + 10 candidates). Build is confirmed. The 3 ADAPTs reduce the build scope on specific UX axes. |
| Slash-tag format recommendation is strong despite being «destructive» to the kickoff draft | The evidence is unambiguous: 0 of 10 candidates use flag-prefix-in-chat format; the global `/orchestrator` uses NL-after-slash. Recommending against the kickoff's draft is T15 self-application (research must actually change the output, not just confirm it). |
