# Output format — `/pipeline <umbrella>` inline session report

> **Authoritative for:** the 3-layer structure shape emitted by `/pipeline <umbrella>` invocations — §1 grammar, §2 dependency-graph template, §3 action-queue template, §4 1-liner block grammar, §5 four worked examples (Mode A / SDD / Mode B × N / Queue mode), §6 anti-patterns for 1-liner format, §9 dispatch-chip contract. Principle 18 (`packages/core/principles/18-meta-orchestrator-output-format.test.ts`) enforces the literal substrings below.
> **NOT authoritative for:** project goal — see [`../../../../README.md#why-this-exists`](../../../../README.md#why-this-exists). The `/pipeline` skill body authority — see [`../SKILL.md`](../SKILL.md).

> **Origin:** F.3 (2026-05-24). The 3-layer structure synthesises F.1 prior-art (PR #203) — Argo Workflows' `├── / └──` ASCII tree (ADAPT vocabulary, SSOT row TBA) + maintainer's binding 1-liner format refinement (parent kickoff §1 Sub-wave F.3 lines 237-254). The slash-tag draft (`/Mode-A /Roles-… /Skills-…`) was rated «not convenient» by the maintainer and has zero upstream precedent across 10 surveyed tools (GHA, Concourse, Argo, Dagger, just, LangGraph, Cline, Superpowers, gh workflow run, orchestrator-guide).

---

## §1 Top-level shape

Every `/pipeline <umbrella>` invocation that proceeds to dispatch (i.e. plan-currency check returned «Plan is current», priority chose a winner, kickoff loaded) emits one **inline session report** in this exact shape:

```text
═══════════════════════════════════════════════════════════════
EXECUTION PLAN — <umbrella> (<YYYY-MM-DD>)
═══════════════════════════════════════════════════════════════

## Dependency graph

<Stage tree — §2>

## Action queue — what you do next

<5-column table — §3>

## 1-liner blocks (copy ONE block = ONE new CC session)

### Stage 1 — <name> (<Mode>, ~<cost>)

**What it does:** <1-2 sentences plain language — what this fresh CC-session will do; what it will NOT do if scope is narrow>
**Deliverable:** <concrete artefact — file path / PR shape / verdict tag>
**Why now:** <why this stage at this moment — what gate it opens / what trap it counters / what dependency admitted it>

<1-liner — §4>

### Stage 2 — <name> (<Mode>, ~<cost>)

**What it does:** <…>
**Deliverable:** <…>
**Why now:** <…>

<1-liner — §4>

[...]
═══════════════════════════════════════════════════════════════
```

The three layers (`## Dependency graph` / `## Action queue` / `### Stage N` blocks) are **mandatory** — principle 18 fails if any of the literal headings or the column substrings (§3) is missing from this file.

**Description block (3 lines `What it does / Deliverable / Why now`) is mandatory above every `<1-liner>`** — see §4.1 below for rationale + falsifiers. The block is not principle-18-checked (per maintainer scope decision 2026-05-25, Option A); enforcement is prose-discipline at session time. The block exists because `### Stage X — name (Mode, cost)` heading answers «how» but not «what / why now»; without it the receiving fresh CC-session can be pasted without the maintainer-reader understanding what they just dispatched.

---

## §1A No-arg overview format

> **Origin:** V3 binding per [research-patch §3](../../../../docs/meta-factory/research-patches/2026-05-29-meta-orch-no-arg-overview-s0-remainder.md), Stage 3 I-phase. Sibling format to §1 — coexists, does not replace.

Emitted by `/pipeline` (no arg) OR `/pipeline 0`. Renders ALL open umbrellas surviving §2.5 completion-filter (DONE entries dropped by [`priority-score.sh`](../helpers/priority-score.sh) tri-layer classifier — C1 branch / C2 jaccard / C3 done.md). Wave-style grouping ADAPTs SSOT #68 (OhMyOpencode Atlas/Prometheus `## Parallel Execution Graph` `Wave N`). Reuses **all 6** principle-18 substrings (`## Dependency graph` / `↓` / `## Action queue` / `Paste into a new CC tab` / `Can parallel with` / `### Stage`) — **zero churn** on [`packages/core/principles/18-meta-orchestrator-output-format.test.ts`](../../../../packages/core/principles/18-meta-orchestrator-output-format.test.ts) (whole-file scope passes; §10 SKILL.md scope unchanged).

**Skeleton (binding, ≤30 lines body):**

```text
═══════════════════════════════════════════════════════════════
PROJECT OVERVIEW — all open umbrellas (<YYYY-MM-DD>)
═══════════════════════════════════════════════════════════════

## Dependency graph

Wave 1 — NOW (parallel-OK):
├── <umbrella-A>   (Stage <N>, ~<cost>, <Mode>)   PARALLEL-OK ↔
└── <umbrella-B>   (Stage <N>, ~<cost>, <Mode>)
                                  ↓
Wave 2 — after Wave 1 merges:
└── <umbrella-C>   (Stage <N>, ~<cost>, <Mode>)

## Action queue — what you do next

| # | Paste into a new CC tab | When | Waiting on | Can parallel with |
|---|-------------------------|------|------------|-------------------|
| 1 | /pipeline <umbrella-A> | Now | — | <umbrella-B> |
| 2 | /pipeline <umbrella-B> | Now | — | <umbrella-A> |
| 3 | /pipeline <umbrella-C> | After Wave 1 | Wave 1 merged | — |

Total open umbrellas: <K> (after §2.5 completion-filter; recently DONE entries hidden).

### Stage — overview only
(no per-stage 1-liner; this overview MUST be drilled-down via /pipeline <umbrella> for dispatch)
═══════════════════════════════════════════════════════════════
```

**Wave-grouping rules:**

- **Wave 1 — NOW:** candidates whose dependencies are already merged (free to dispatch now).
- **Wave N (N ≥ 2):** candidates dependent on Wave N-1 merges; ordered by Wave label.
- **Intra-wave parallel/sequential markers:** derived from each candidate's kickoff §2 `Parallel-with` column (V2 binding). Pairwise rule — if A claims B AND B claims A → emit `PARALLEL-OK ↔` between them; if either side omits the column or they disagree → treat as sequential `↓` + emit ATTN.

**Coexistence with §1 (dispatch path):**

- §1 fires on `/pipeline <umbrella-name>` (string arg) — proceeds to §3/§4/§5 dispatch.
- §1A fires on `/pipeline` (no arg) OR `/pipeline 0` — emits overview, STOPS.
- Heading prefixes differ verbatim (`EXECUTION PLAN — <umbrella>` vs `PROJECT OVERVIEW — all open umbrellas`) — no collision; §0 routing in [`../SKILL.md`](../SKILL.md) branches BEFORE format selection (no mixed renderer).

**Falsifiers:**

- Wrong if principle-18 test fails after §1A lands — run `npx vitest run packages/core/principles/18-meta-orchestrator-output-format.test.ts` BEFORE push; expect green (whole-file scope sees the 6 substrings from §1A's skeleton even if §1's example were stripped, but §1's example is preserved → both surfaces pass).
- Wrong if dispatch path mistakenly fires §1A (cross-mode rendering) — §0 routing's regex check decides; format selection follows routing, never the reverse.
- Wrong if `### Stage — overview only` placeholder is interpreted by a downstream tool as a real Stage block — placeholder text explicitly disambiguates («overview only; drilled-down via /pipeline <umbrella>»).

---

## §1B Named-dispatch compact format (pipeline-ux Stage 2)

> **Origin:** pipeline-ux Stage 2 (2026-06-04). Operator feedback: "why so much text". The live run produced walls of per-step narration on every `/pipeline <umbrella>` invocation.

Emitted by `/pipeline <umbrella>` (string arg). Same 3-layer structure as §1 but **bounded to ≤~15 visible lines**: dep-graph + action-queue + 1-liner blocks WITHOUT the verbose 3-line `What it does / Deliverable / Why now` description block per stage. Description blocks are optional in named-dispatch mode — the operator already selected the umbrella.

**Rule:** drop per-step §2.5 narration (plan-currency annotation, priority scoring trace, classify-work output) from the session report. Emit result only. Keep `## Dependency graph` / `↓` / `## Action queue` / `### Stage` structure — principle 18 anchors must remain.

```text
═══════════════════════════════════════════════════════════════
EXECUTION PLAN — <umbrella> (<YYYY-MM-DD>)
═══════════════════════════════════════════════════════════════

## Dependency graph

├── Stage 1 — <name>   (<Mode>, ~<cost>)
│
↓
└── Stage 2 — <name>   (<Mode>, ~<cost>)

## Action queue — what you do next

| Paste into a new CC tab | When | Waiting on | Can parallel with |
|---|---|---|---|
| `<1-liner Stage 1>` | now | — | nothing |

### Stage 1 — <name> (<Mode>, ~<cost>)

`<1-liner>` ← paste this into a new CC tab

═══════════════════════════════════════════════════════════════
```

**Coexistence:** §1B does not replace §1. Full §1 format (with description blocks) is used when emitting for the first time or when the operator explicitly requested detail. §1B is the default for re-invocations and follow-up dispatches where context is already established.

**Falsifiers:** wrong if §1B output exceeds ~15 lines for a 2-stage umbrella; wrong if any of the 6 principle-18 substrings (`## Dependency graph` / `↓` / `## Action queue` / `Paste into a new CC tab` / `Can parallel with` / `### Stage`) is absent from the §1B skeleton above.

## §1C Status format (beta-delivery-ux S2, A5)

> **Origin:** beta-delivery-ux S2 (2026-08-08). Spec: [2026-07-23-beta-program-design.md §4 A5](../../../../docs/superpowers/specs/2026-07-23-beta-program-design.md). Read-only, three-section, no persistent state, NOT a dashboard.

Emitted by `/pipeline status`. The status verb does NOT enter the §1 dispatch tree — it short-circuits to a read-only render against live bricks.

```text
## Pipeline status

### In-factory
  <running aif tasks + their state — from bridge REST /health + /tasks>
  (or: "(bridge unreachable at <url>)" — designed degradation)

### Parked questions
  <each parked task + its fork — from questions.ts --json>
  (or: "(no parked questions)" — designed degradation)

### Ready-to-harvest + PR state
  <open PRs + mergeable state — from gh pr list>
  (or: "(no open PRs)" / "(gh unavailable)" — designed degradation)

### Suggested next
→ next: <suggested command 1>
→ next: <suggested command 2 — optional>
```

**Rules:**

- Each section degrades **independently** — an unreachable bridge does NOT block parked-questions or PR sections.
- Exit code is 0 unless the renderer itself crashes; degraded sections are a **designed success path** (§3 spec).
- 1-3 suggested-next lines tail the output (clig.dev «suggest what to run next»).
- No persistent state, no refresh loop, no TUI. One-shot read + print.

**Falsifiers:** wrong if any section is silently elided (each MUST appear, even in degraded form); wrong if the renderer exits non-zero on a missing brick; wrong if the output omits the `### Suggested next` tail.

**See also:** [`helpers/render-status.sh`](../helpers/render-status.sh) — the renderer. [`SKILL.md §2.6`](../SKILL.md) — invocation point.

---

## §2 Dependency graph

ADAPTed from Argo Workflows' CLI tree (F.1 §A.1 Candidate 3). Prospective (shows WILL run), not retrospective (which is what Argo shows during execution).

**Symbols:**

- `├──` — sibling node (parallel-safe with other `├──` / `└──` at same indent)
- `└──` — last sibling at this indent
- `↓` — inter-stage dependency edge (Stage N → Stage N+1)
- `PARALLEL-OK ↔` (optional inline annotation) — explicit parallel marker between sibling sub-waves at the same stage

**Template:**

```text
Stage 1 — NOW:
├── Sub-wave A   (Mode A, ~30k, read-only)
└── Sub-wave B   (Mode A, ~30k, read-only)
                                  ↓
Stage 2 — after Stage 1 merges:
├── Sub-wave C   (Mode A, ~40k)   PARALLEL-OK ↔
└── Sub-wave D   (Mode B × 3, ~120k)
                                  ↓
Stage 3 — after Stage 2 merges:
└── Sub-wave E   (Mode A, ~30k)
```

**Conventions:**

- One stage header per stage with descriptive label («NOW» / «after Stage N merges» / «after maintainer GO»).
- Each sub-wave bullet carries the Mode + cost estimate + role hint in parentheses.
- `↓` arrow alone on a line communicates the inter-stage edge.
- Single-sub-wave stages use `└──` only (no `├──`).
- Stages where execution depends on a maintainer DECISION rather than just a merge get the label «after maintainer DECISION on <fork>».

---

## §3 Action queue

5-column markdown table mapping each Stage's 1-liner block to a row. The `Can parallel with` column is a genuine BUILD contribution — no upstream renders static parallel-safety; F.1 §A.4 Q3 documents the gap (all CI tools show parallelism dynamically during execution, not statically in a plan).

**Required columns** (principle 18 grep-checks these column-header substrings):

| #   | Paste into a new CC tab | When                 | Waiting on    | Can parallel with        |
| --- | ----------------------- | -------------------- | ------------- | ------------------------ |
| 1   | Stage 1 block below     | Now                  | —             | Stage 1 sibling (if any) |
| 2   | Stage 2 block below     | After Stage 1 merges | <PR# / event> | Stage 2 sibling (if any) |
| 3   | …                       | …                    | …             | …                        |

Tail line below the table:

```text
Total pastes: <N> (depends on <conditions>; max=<M> if all GO).
```

---

## §4 1-liner block grammar

Exactly one block per stage. Maintainer pastes the entire block into a fresh CC session.

**Grammar:**

```text
/orchestrator <umbrella-name> §<section-anchor> — <natural-language payload>, rest in kickoff
```

**Tokens:**

- `/orchestrator` — deterministic CC slash-command routing token. Activates the global `~/.claude/skills/orchestrator/SKILL.md`.
- `<umbrella-name>` — kebab-case identifier matching the kickoff directory `.claude/orchestrator-prompts/<umbrella-name>/kickoff.md`.
- `§<section-anchor>` — exact section header from the kickoff (e.g. `§1`, `§4 Stage 1`, `§1 Sub-wave F.3`).
- `— <natural-language payload>` — free-form description naming Mode/role/autonomous?/iterative-review-status. The global `orchestrator` skill parses this as natural language, NOT as `--flag=value` args.
- `, rest in kickoff` — closing token instructing the receiving session to read the kickoff at the anchor for acceptance criteria, T-traps, skills, stop conditions, etc.

**Why this shape (F.1 evidence):**

- 10 mature tools surveyed (GHA, Concourse, Argo, Dagger, just, LangGraph, Cline, Superpowers, `gh workflow run`, chat-orchestrator pattern article) — all converge on `/<command> <natural-language-payload>` for chat-medium dispatch. None use `/Flag-Value /Flag-Value …` shape.
- Maintainer (2026-05-24) explicitly rated the earlier `/Mode-A /Roles-worker /Skills-foo /Autonomous-yes /Iterative-review-no` draft «not a convenient format, I don't like it».
- The global orchestrator skill at `~/.claude/skills/orchestrator/SKILL.md` parses natural-language payload (no structured-args parser).

## §4.1 Description block above each 1-liner (mandatory, prose-discipline)

> **Origin:** 2026-05-25 maintainer feedback («Why is there no description of what each one does? … shouldn't the meta-orchestrator prompts include descriptions»). Spec gap identified post-F.3-ship: §1 template + §5 examples produced heading + 1-liner with no plain-language context, which is paste-able but not _reader-comprehensible_ without opening the kickoff. Maintainer chose **Option A** (template + examples patch, no principle 18 extension) over Option B (mechanical gate via `**What it does:**` substring grep).

Every `### Stage X — <name> (<Mode>, <cost>)` heading MUST be followed by a 3-line description block BEFORE the `/orchestrator …` 1-liner:

```text
### Stage X — <name> (<Mode>, <cost>)

**What it does:** <1-2 sentences plain language — what the fresh CC-session will do; what it explicitly will NOT do if scope is narrow>
**Deliverable:** <concrete artefact — file path / PR shape / verdict tag / data point captured>
**Why now:** <why this stage at this moment — what gate it opens / what trap it counters / what dependency admitted it>

/orchestrator <umbrella> §<anchor> — <NL payload>, rest in kickoff
```

**Why this block is load-bearing:**

- `/pipeline`'s entire purpose is to dispatch _fresh CC-sessions without the maintainer's current session context_. Each paste = one autonomous world. The 1-liner starts with `/orchestrator` and is optimised for the **receiving** session (it re-reads kickoff). The description block is optimised for the **maintainer-reader who must decide whether to paste**.
- Without the block, the reader must open `kickoff.md §<anchor>` to learn what the dispatched session will produce — which defeats the one-message-one-session pattern.
- `### Stage X — <name> (<Mode>, <cost>)` heading answers «**how** big / **what** mode» — not «**what** the work is / **why** now». The three triplet fields close that gap.

**Falsifiers / when the block is allowed to be terser:**

- One-line stages where the heading already names the deliverable verbatim (e.g. `### Stage 1 — Append SSOT row #79 (Mode A, ~5k)`) — `**What it does:**` may be a single noun phrase, but **must still appear** to keep the format machine-readable for future grep promotion.
- Description block is **NOT principle-18-checked** (per maintainer scope decision 2026-05-25). Promotion to mechanical gate (Option B) is a separate trigger — if 3+ sessions ship dispatches without the block within 6 months, promote to principle 18 substring check on `**What it does:**` presence between `### Stage` and `/orchestrator`.

**Anti-patterns:**

- `#description-as-restated-heading` — content of `**What it does:**` paraphrases the `### Stage X — <name>` heading. Adds zero context. Counter: name what the SESSION will execute (verbs: «queries», «writes», «extends», «runs»), not what the stage is called.
- `#deliverable-without-path` — `**Deliverable:**` says «a research-patch» without naming the file path. Reader can't grep for it post-merge. Counter: give the actual path or PR-title shape.
- `#why-now-as-tautology` — `**Why now:**` says «it's the next step». Adds zero reasoning. Counter: name the gate / trap / dependency edge.

---

## §5 Four worked examples

### Example 1 — Mode A single (R-phase audit, ~30k Opus)

```text
═══════════════════════════════════════════════════════════════
EXECUTION PLAN — meta-orchestrator-followup-audit (2026-05-24)
═══════════════════════════════════════════════════════════════

## Dependency graph

Stage 1 — NOW:
└── F.2 — Cold review of SKILL.md   (Mode A, ~30k, read-only)

## Action queue — what you do next

| # | Paste into a new CC tab | When | Waiting on | Can parallel with |
|---|-------------------------|------|------------|-------------------|
| 1 | Stage 1 block below | Now | — | — |

Total pastes: 1.

## 1-liner blocks (copy ONE block = ONE new CC session)

### Stage 1 — Cold review (Mode A, ~30k)

**What it does:** runs a cold-eye review of SKILL.md as a fresh reader (without your session context), looks for structural drift / missing sections / broken refs; does NOT edit files — REPORT only.
**Deliverable:** REPORT with GO/REVISE/STOP verdict + per-section findings (file:line + suggestions) inline in session output, no commits.
**Why now:** F.1+G-design + F.3 UX shipped; before closing the audit umbrella an independent check is needed that the F.2 deliverable (cold-review of SKILL.md) is consistent with binding spec G §1.5 — otherwise T19 (own QA before handoff).

/orchestrator meta-orchestrator-followup-audit §1 Sub-wave F.2 — Mode A reviewer cold-eye of SKILL.md, return REPORT, no edits, rest in kickoff
═══════════════════════════════════════════════════════════════
```

### Example 2 — Mode SDD (build with implementer + 2 reviewers, ~80k Opus)

```text
═══════════════════════════════════════════════════════════════
EXECUTION PLAN — feature-X-SDD-build (2026-05-25)
═══════════════════════════════════════════════════════════════

## Dependency graph

Stage 1 — NOW:
├── Implementer session   (Mode A, ~50k, writes code)
├── Spec reviewer         (Mode A subagent, ~15k, read-only)
└── Code-quality reviewer (Mode A subagent, ~15k, read-only)
                                  ↓
Stage 2 — after Stage 1 PR merges:
└── Smoke test runner    (Mode A, ~10k)

## Action queue — what you do next

| # | Paste into a new CC tab | When | Waiting on | Can parallel with |
|---|-------------------------|------|------------|-------------------|
| 1 | Stage 1 block below | Now | — | — |
| 2 | Stage 2 block below | After Stage 1 PR merges | Stage 1 PR merged | — |

Total pastes: 2.

## 1-liner blocks (copy ONE block = ONE new CC session)

### Stage 1 — SDD build (Mode SDD, ~80k)

**What it does:** Implementer writes feature-X end-to-end (~50k); spec reviewer subagent checks conformance to kickoff §3 binding spec (~15k); code-quality reviewer subagent runs lint+tests+style (~15k). All three in one session via Agent tool, NOT in worktrees.
**Deliverable:** PR feature-X with code + tests + spec-review GO + code-quality-review GO, ready to merge to staging.
**Why now:** kickoff §3 binding spec frozen, all dependencies resolved; SDD threshold (≥3 independent tasks: implementer + 2 reviewer roles) met; single complex feature without parallel-decomposition surface = SDD beats Mode A solo on catch-rate.

/orchestrator feature-X-SDD-build §3 — Mode SDD implementer + 2 reviewers (spec + code-quality), full autonomous, rest in kickoff

### Stage 2 — Smoke test (Mode A, ~10k)

**What it does:** runs feature-X integration smoke (curl endpoints / `npm test -- smoke` / any manual-liveness probe per kickoff §4), does not edit code.
**Deliverable:** smoke output (pass/fail per probe) inline in session report, or BLOCKER finding if something broke after merge.
**Why now:** Stage 1 PR merged, feature-X in staging; CI pass ≠ runtime-verified (T19), an independent post-merge probe is needed BEFORE umbrella closure.

/orchestrator feature-X-SDD-build §4 — Mode A runner checks smoke, rest in kickoff
═══════════════════════════════════════════════════════════════
```

### Example 3 — Mode B × N parallel workers in worktrees (~150k Opus)

```text
═══════════════════════════════════════════════════════════════
EXECUTION PLAN — refactor-large-module (2026-05-25)
═══════════════════════════════════════════════════════════════

## Dependency graph

Stage 1 — NOW (3 parallel worktrees):
├── Worker 1 — module/auth   (Mode B worktree, ~50k)   PARALLEL-OK ↔
├── Worker 2 — module/api    (Mode B worktree, ~50k)   PARALLEL-OK ↔
└── Worker 3 — module/db     (Mode B worktree, ~50k)
                                  ↓
Stage 2 — after all Stage 1 PRs merge:
└── Integration smoke    (Mode A, ~20k)

## Action queue — what you do next

| # | Paste into a new CC tab | When | Waiting on | Can parallel with |
|---|-------------------------|------|------------|-------------------|
| 1 | Stage 1 Worker-1 block below | Now | — | Worker-2 + Worker-3 |
| 2 | Stage 1 Worker-2 block below | Now | — | Worker-1 + Worker-3 |
| 3 | Stage 1 Worker-3 block below | Now | — | Worker-1 + Worker-2 |
| 4 | Stage 2 block below | After 3 Stage 1 PRs merge | 3 PRs merged | — |

Total pastes: 4 (3 in parallel in Stage 1 + 1 in Stage 2).

## 1-liner blocks (copy ONE block = ONE new CC session)

### Stage 1 Worker-1 — auth refactor (Mode B worktree, ~50k)

**What it does:** refactors `module/auth` in a separate worktree (parallel-subwave-isolation §1 + §4a node_modules links MANDATORY); all edits inside `module/auth/**`, tests in `module/auth/__tests__/`.
**Deliverable:** PR `refactor/auth-<scope>` with green CI, file:line evidence for cold-review.
**Why now:** kickoff §4 decomposed refactor into 3 independent modules (auth/api/db); auth has no dependency edges to api/db → safe for parallel dispatch; launching all 3 workers simultaneously cuts wall-clock by ×3 at the same quota total.

/orchestrator refactor-large-module §4 Worker-1 auth — Mode B implementer in worktree, autonomous, rest in kickoff

### Stage 1 Worker-2 — api refactor (Mode B worktree, ~50k)

**What it does:** refactors `module/api` in worktree #2; scope is limited to `module/api/**`; does not touch auth or db (shared file race trap counter).
**Deliverable:** PR `refactor/api-<scope>` with green CI.
**Why now:** parallel-safe with Worker-1 and Worker-3 (different file-scopes); one of 3 sub-waves of Stage 1.

/orchestrator refactor-large-module §4 Worker-2 api — Mode B implementer in worktree, autonomous, rest in kickoff

### Stage 1 Worker-3 — db refactor (Mode B worktree, ~50k)

**What it does:** refactors `module/db` in worktree #3; scope `module/db/**`.
**Deliverable:** PR `refactor/db-<scope>` with green CI.
**Why now:** third of 3 parallel-safe sub-waves; completes Stage 1.

/orchestrator refactor-large-module §4 Worker-3 db — Mode B implementer in worktree, autonomous, rest in kickoff

### Stage 2 — Integration smoke (Mode A, ~20k)

**What it does:** runs integration tests on staging after all 3 refactor PRs merge, verifies that auth↔api↔db did not break at the boundaries (regression surface from parallel refactor).
**Deliverable:** integration test output inline; or BLOCKER finding if cross-module contracts are violated.
**Why now:** Stage 1 ×3 PRs merged → staging has all 3 refactored modules; unit tests in each PR are OK, but integration surface catches cross-module issues only post-merge — critical to validate the parallel-refactor pattern.

/orchestrator refactor-large-module §5 — Mode A runner integration smoke across 3 modules, rest in kickoff
═══════════════════════════════════════════════════════════════
```

### Example 4 — Mode Queue (sequential research kickoff queue, ~120k Opus)

```text
═══════════════════════════════════════════════════════════════
EXECUTION PLAN — research-umbrella-Q (2026-05-25)
═══════════════════════════════════════════════════════════════

## Dependency graph

Stage 1 — NOW (sequential queue):
├── R1 — prior-art sweep    (Queue iter 1, ~30k)
├── R2 — gap analysis       (Queue iter 2, ~30k, after R1)
├── R3 — verdict synthesis  (Queue iter 3, ~30k, after R2)
└── R4 — patch draft        (Queue iter 4, ~30k, after R3)

## Action queue — what you do next

| # | Paste into a new CC tab | When | Waiting on | Can parallel with |
|---|-------------------------|------|------------|-------------------|
| 1 | Stage 1 Queue block below | Now | — | — |

Total pastes: 1 (Queue mode internally processes all 4 R-iters autonomously).

## 1-liner blocks (copy ONE block = ONE new CC session)

### Stage 1 — Queue mode R1→R4 (Queue mode, ~120k)

**What it does:** one Opus session iterates R1 (prior-art sweep) → Reviewer GO/REVISE → R2 (gap analysis) → Reviewer GO → R3 (verdict synthesis) → Reviewer GO → R4 (patch draft) → Reviewer GO; each R-iteration produces incremental output, with a cold-review checkpoint between them automatically.
**Deliverable:** one research-patch with R1-R4 sections + Reviewer GO chain logged; or REVISE-loop with explicit escalation.
**Why now:** kickoff §2 enumerated 4 sequential R-iterations with iterative-review-each semantics; Queue mode threshold (≥2 sequential R-kickoffs) met; flat-queue dispatch without stage-gates is OK because this is an R-only umbrella (no I-phase build downstream).

/orchestrator research-umbrella-Q §2 — Mode Queue iterative review of each iteration (R1 → R2 → R3 → R4), autonomous, rest in kickoff
═══════════════════════════════════════════════════════════════
```

---

## §6 Anti-patterns for the 1-liner format

- **`#slash-tag-flag-format`** — formatting payload as `/Mode-A /Roles-… /Skills-… /Autonomous-yes /Iterative-review-no /Kickoff:<path>`. F.1 §A.5(i) — ZERO upstream precedent across 10 surveyed tools. Maintainer 2026-05-24 explicit «not a convenient format». Counter: natural-language payload after `— ` (em-dash + space). **Falsifier:** if a future revision of `~/.claude/skills/orchestrator/SKILL.md` adds a structured-args parser, the slash-tag format may regain viability — verify by reading the global skill body before falsifying.
- **`#paste-block-with-kickoff-content-inlined`** — copying acceptance criteria / T-traps / skills list / stop conditions INTO the 1-liner. Defeats `rest in kickoff` deferral; the new session re-reads the kickoff at the anchor anyway. Counter: keep the 1-liner under ~150 chars; anything more belongs in the kickoff.
- **`#missing-section-anchor`** — emitting `/orchestrator <umbrella> — Mode A …` without `§<section>`. The receiving session has no anchor to read; defaults to the kickoff top, which may be `§0 Status` or `§-1 RE-VERIFY` rather than the action body. Counter: every 1-liner carries an explicit `§<section>` anchor.
- **`#pattern-matching-on-name-T16`** — assuming the format works because it visually resembles `/aif-handoff` slash-tag examples (which DO have structured args). Our `/orchestrator` is a different problem class — it parses NL payload, not args. Verify by reading the global skill body, not by analogy.

---

## §7 Falsifiers

- **Wrong if** `~/.claude/skills/orchestrator/SKILL.md` is replaced by a structured-args parser — re-read the global skill body before relying on the natural-language form documented here. (Agent-uncommittable: F.3 reads the global skill but does NOT edit it.)
- **Wrong if** Argo Workflows discontinues the `├── / └──` ASCII tree convention or the upstream pattern is superseded by a better chat-medium-renderable graph notation. Re-check F.1 SSOT entry on a 12-month cadence.
- **Wrong if** the `Can parallel with` column proves redundant in practice (e.g. maintainer never consults it; or all umbrellas turn out to be strictly sequential). Promotion-to-drop trigger: 3 consecutive umbrellas where the column is empty for every row.

---

## §8 Step 3b — the TTY-only preset row

Spec A4 ([`2026-07-23-beta-program-design.md`](../../../../docs/superpowers/specs/2026-07-23-beta-program-design.md) §4 A4, lines 269-271) proposes presets via a TTY menu row in the §3 launch-table. The row is **additive**: `--preset <name>` / `AIF_PIPELINE_PRESET=<name>` stays the primary path per the S2 kickoff §2 binding constraint 1 and clig.dev flag-first. **Menu-only UX is REJECTED** — it breaks agents and CI, which have no TTY.

Render only when `[ -t 0 ] && [ -t 1 ]`. The four presets are data-driven from the `presets/` directory ([`presets/aif.json`](presets/aif.json), [`presets/night.json`](presets/night.json), [`presets/economy.json`](presets/economy.json), [`presets/sdd.json`](presets/sdd.json)); each line's text is the preset's own `description` field, read via [`../helpers/list-presets.sh`](../helpers/list-presets.sh) — never hard-coded here, so adding a preset JSON is the only edit a new preset needs.

```text
Presets (optional — use --preset <name> or AIF_PIPELINE_PRESET=<name> to activate):
  aif      — <description from presets/aif.json>
  night    — <description from presets/night.json>
  economy  — <description from presets/economy.json>
  sdd      — <description from presets/sdd.json>
```

**Falsifier:** if this row ever appears in a non-TTY transcript, the TTY guard regressed; if it lists a preset absent from `presets/*.json` (or omits one present there), the row stopped being data-driven.

## §9 Dispatch chips (ADR D1/D2)

> **Origin:** [`2026-08-09-pipeline-chips-session-bus-design.md`](../../../../docs/superpowers/specs/2026-08-09-pipeline-chips-session-bus-design.md) D1 + D2, stage S1. Chips are an **addition** to the report above, never a replacement: the report + the kickoff files stay the durable record, and chips die on app restart.

**Capability gate.** Emit chips only when `spawn_task` is invocable in this session — a runtime roster probe, never a version-sniff and never an `allowed-tools` declaration (skill-frontmatter `allowed-tools` is not CC-enforced, [SSOT #121](../../../../docs/meta-factory/prior-art-evaluations.md), and an `mcp__ccd_session__*` entry would additionally turn [principle 21](../../../../packages/core/principles/21-shipped-agent-tools-valid.test.ts) red on its `MCP_TOOL_RE`). A tool named in the roster but deferred needs its schema fetched before the first call. When the probe fails, render the paste tabs alone, verbatim — no apology line.

**Emission points.** `/pipeline` §10 — one chip per Stage 1-liner. `/arch` §3 — one chip per routed next action, **except** the single-task `bridge: auto` route, where the write-time hook [`runtime-bridge-dispatch.sh`](../../../hooks/runtime-bridge-dispatch.sh) already dispatches the kickoff and a chip would be a second dispatch path for the same task (the [dispatcher §2.0](../../dispatcher/SKILL.md) probe's three signals are all empty while that task sits in `backlog`, so it cannot catch the collision). `/dispatcher` emits no dispatch chips at all (REST + self-advance); its park-chips are D3, outside this section.

**Chip contract.**

| Field    | Content                                                                                                                                                                                                                                      |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`  | ≤60-char imperative with the DISTINGUISHING tokens first — `S2 auth: dispatch [<umbrella>]`, never the raw 1-liner (real 1-liners run 85–146 chars and carry their `§section` / Mode tokens in the tail, which the title cap truncates away) |
| `tldr`   | the Action-queue context the chip drops — `When` + `Waiting on`                                                                                                                                                                              |
| `prompt` | self-contained, carrying its own gates (below), **and rendered in full in the report next to the chip** — the payload is invisible in the chip UI, so the report is the only place the operator can inspect what a click authorizes          |

**Chip prompt — four mandatory steps, in this order:**

1. **Isolation first** (STOP-on-fail): enter or verify an isolated worktree before any write ([parallel-subwave-isolation.md §1](../../../rules/parallel-subwave-isolation.md)). The app's worktree default is NOT assumed — the prompt step is the mechanism, the default is a convenience.
2. **In-flight probe**, widened: the [dispatcher §2.0](../../dispatcher/SKILL.md) three-signal dedup PLUS an aif queue scan (`curl "$RUNTIME_BRIDGE_AIF_URL/tasks"` filtered by the kickoff slug) — the queue is exactly where those three signals are blind.
3. **Stage-gate at click time**, never frozen at plan time: a stage-N chip opens with the gate predicate AND its resolution instruction — «derive Stage N-1's head branch from the umbrella's PR list / kickoff / state.md NOW, then `gh pr list --search "is:merged head:<derived> base:staging"`; empty → HALT and report». A plan-time literal branch name is wrong on the factory path (aif names branches per task at dispatch time; harvest may rename), so the HALT would fire forever on a branch that never existed. Without this step the chips strip `When` / `Waiting on` off the Action queue and become premature-dispatch buttons (`#flat-queue-no-gates`).
4. **cwd = repo root**, plus the kickoff/residue path and «read and execute».

**Lifecycle.** Superseded chips get a best-effort `dismiss_task`. The operator's click IS the «maintainer opens a fresh session» channel, so `#worker-dispatch-via-subagent` is untouched — the session is born from the click, not from an Agent-tool call.

**Language.** `title` and `tldr` are operator-facing prose: write them in `AIF_OUTPUT_LANG`, like the rest of the report. The chip prompt itself is machinery — English always ([language-discipline.md §1](../../../rules/language-discipline.md)).

**Falsifier:** a chip prompt missing any of steps 1–3 → principle 18's chip check is red before the report ships. An incident that reaches a click means the assertion itself was skipped — fix the emitter and the test, not the operator.

## §A — See also

- [`../SKILL.md` §10](../SKILL.md) — the meta-orchestrator skill that emits this output structure.
- [F.1 prior-art research-patch](../../../../docs/meta-factory/research-patches/2026-05-24-meta-orchestrator-ux-research.md) — Argo `├── / └──` ADAPT verdict, slash-tag REJECT verdict, 10 surveyed tools.
- [G refactor design](../../../../docs/meta-factory/research-patches/2026-05-24-meta-orchestrator-refactor-design.md) + [G §1.5 F.3 binding scope](../../../../docs/meta-factory/research-patches/2026-05-24-meta-orchestrator-refactor-f3-scope.md) — Items 7-9 (F3-S1/S2/S3).
- [`packages/core/principles/18-meta-orchestrator-output-format.test.ts`](../../../../packages/core/principles/18-meta-orchestrator-output-format.test.ts) — principle 18 enforcement.
- [`../../../rules/dual-implementation-discipline.md`](../../../rules/dual-implementation-discipline.md) §5 — channel-split discipline for SKILL ↔ references file pairing.
