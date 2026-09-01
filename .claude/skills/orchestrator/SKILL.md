---
name: orchestrator
description: |
  TRIGGER when: «оркестратор/orchestrator», «старшая/младшая модель», «делегируй/delegate»,
  «Mode A/B», «file-prompt», «umbrella», «батч правок/batch fixes», «пакет фиксов»; ИЛИ первая
  из серии мелких правок одной темы; ИЛИ задача распадается на ≥3 независимых подзадач; ИЛИ
  «автономно / волнами / работай без остановок / прогони очередь кикофов сам» при ≥2 kickoff'ах
  → Queue mode.
  SKIP: тривиальная правка по точному пути (≤5 строк, 1 файл).
when_to_use: оркестратор, организатор, ты старшая, батч правок, umbrella, пакет фиксов, много мелких, делегируй, младшая модель, координируй, разбей на подзадачи, orchestrator, batch fixes, delegate, queue mode, kickoff, autonomous research, worker dispatch, воркер, ревьюер, очередь задач, автономно, волнами, итеративно, работай без остановок, прогони очередь кикофов, цикл кикофов, не останавливайся, сам до конца
---

<!-- @harness-posture: cc-native-with-fallback — Agent-tool subagent dispatch is portable (zcode evidence via night-mode SKILL.md:17); Skill-tool invocation degrades to direct file reads -->

# Orchestrator — the senior coordinates, juniors execute and verify

> **Authoritative for:** the operator-side orchestration workflow — the Mode A/B dispatch
> **choice rule** (when B over A, and on which model), the task-size decision matrix, quota
> zones, the Phase -1 → Phase 4.5 phase sequence, and the Queue-mode entry conditions.
> [pipeline/SKILL.md:382](../pipeline/SKILL.md) names this **skill** as the SSOT for the
> Mode A/B vocabulary; within the skill, the channel _definitions_ live in
> [references/glossary.md](references/glossary.md) and the _choice_ lives here.
> **NOT authoritative for:** the in-session executor loop (dispatch → task review → fix rounds →
> final review) — `superpowers:subagent-driven-development` (ADOPT, wrapped, never re-described);
> workspace isolation mechanics — `superpowers:using-git-worktrees` (its Step 0 detection and
> `git worktree` fallback are adopted by pointer); parallel-dispatch mechanics —
> `superpowers:dispatching-parallel-agents`; plan documents — `superpowers:writing-plans`;
> evidence-before-claims at the verification step — `superpowers:verification-before-completion`;
> final push/PR mechanics — `superpowers:finishing-a-development-branch`. The role and
> dispatch-channel definitions — [references/glossary.md](references/glossary.md). Incidents,
> ROI and provenance — [references/rationale.md](references/rationale.md). The portable
> worker-discipline subset that travels into aif containers — see
> [packages/core/templates/shared/skill-context/aif-orchestrator-discipline/SKILL.md](../../../packages/core/templates/shared/skill-context/aif-orchestrator-discipline/SKILL.md).
> Stage execution through the aif loop — see the `dispatcher` skill, which ships only at factory
> depth (`setup.d/lib.sh` `GETFF_SKILLS_FACTORY`); linkless on purpose, because this skill ships
> one tier lower and a relative sibling link would dangle on an env install. Umbrella priority
> and launch tables — see [pipeline](../pipeline/SKILL.md). Project goal — see
> [README.md#why-this-exists](../../../README.md#why-this-exists).

A **thin wrapper** over the superpowers stack: the executor loop is
`superpowers:subagent-driven-development` run as-is, isolation is `superpowers:using-git-worktrees`,
parallel fan-out is `superpowers:dispatching-parallel-agents`. This skill owns only what no
upstream piece covers — project discovery, the Mode A/B dispatch channels and their quota
economics, the task-size triage that decides whether to delegate at all, Phase -1 (cold review of
your own dispatch prompt), and Queue mode. If you catch yourself re-describing the executor loop,
the worktree mechanics, or the parallel-dispatch mechanics here, stop — that is
`#parallel-evolution-creep`.

**Goal:** senior-context isolation + maximum reasoning quality + **one PR per umbrella**.

## Without this skill

Delegation collapses into two failure modes. Either the senior does the work itself — burning its own context on greps and multi-file edits until it runs out of room mid-umbrella — or it delegates without discipline: no discovery, so junior prompts carry commands that do not exist in this repo; no file-lock matrix, so parallel agents collide in one branch; no quota tracking, so a 429 lands mid-batch and the progress is lost; no Phase -1, so an ambiguous kickoff is discovered only after the executor has acted on it.

## With this skill

Task size picks the mechanism (small → the senior's own `Edit`, bulk → an isolated inline `Agent`, a queue of research kickoffs → Queue mode), discovery is taken once per repo so junior prompts carry real commands, quota zones switch the working mode before a 429 rather than after it, and every kickoff above the trigger threshold gets a cold independent read before dispatch instead of after. One PR per umbrella, with a verify-trace that survives the Phase 4.5 audit.

## Roles, vocabulary and provenance (bindings)

Roles (Orchestrator / Worker / Reviewer), the depth-2 hierarchy limit, and the Mode A / Mode B /
Queue-mode channel definitions are owned by [references/glossary.md](references/glossary.md) — read
it before your first dispatch in a session and never restate its labels from memory. The 1:1
mapping onto companion vocabulary (Superpowers, aif-handoff, OhMyOpencode), the incidents behind
Phase -1 and Phase 4.5, and this skill's provenance in Anthropic's
[Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents)
patterns live in [references/rationale.md](references/rationale.md).

---

## Project bootstrap — discovery on first run in a project

The skill is project-agnostic. In a **new project** the senior silently runs discovery once — without it, junior prompts will carry wrong commands and conventions. Seven areas:

1. Project root + commit language/format (`pwd`, `git log --oneline -20`)
2. Project instructions (`CLAUDE.md` / `AGENTS.md` — reference them, do not restate)
3. Git topology (remote, base branch, `<owner>/<repo>`)
4. Task-ID convention from recent commits
5. Build/check commands + package manager (`<TYPECHECK>` `<LINT>` `<TEST>` `<CHECK_ALL>`)
6. Project-local skills/rules (`ls .claude/skills/ .claude/rules/`) — name them, auto-trigger will load them
7. File-prompt directory in `.gitignore` (for Mode B)

The cache is in-head for the session (re-take it when the branch or remote changes). Skip when: already worked in this repo during this session, or the task is a single trivial fix (→ direct `Edit`, no workflow). **Full checklist with commands, user-facing questions and the `orchestrator.local.md` template: [references/discovery.md](references/discovery.md).**

Discovery is this skill's niche; decomposition is the companion's — after discovery, hand a PRD to
`Skill('superpowers:writing-plans')` for the plan document and run it through
`Skill('superpowers:subagent-driven-development')`. Once discovery is cached, activate the
workflow below without re-explaining it.

---

## Default — Mode A (inline `Agent` on Opus). Mode B (file-prompt → Sonnet) is an explicit option

Channel definitions (mechanism ↔ quota pool ↔ use) are owned by
[references/glossary.md](references/glossary.md); this section owns only the **choice rule**.

**Mode A = the default for everything: execution, research, audit, verification.** Spawn an inline `Agent` from the senior session: immediate result, zero manual copy-paste, strong reasoning, and the plan can branch on interim results. Executor context is isolated (for write tasks — `isolation: "worktree"`).

**Why A and not B:** the Opus quota is not scarce on the Max plan, so the default is strong reasoning inline (the top tier, Fable, is reserved for the hardest tasks — see «Model rule»). Mode A gives an immediate result with no manual overhead; Mode B (a separate Sonnet window) requires hand copy-pasting every prompt and REPORT, and its latency plus overhead usually costs more than it wins — except in the cases below.

**Mode B — an explicit option, not the default.** Take B only when at least one holds: (a) **N-way parallelism** across N live windows yields real throughput beyond parallel inline Agents in one message; (b) a **persistent audit trail** as a prompt file is required; (c) the user **explicitly** asks to offload onto the Sonnet quota AND accepts the manual copy-paste cost; (d) the **Opus pool is under load** (Yellow-O or Red in §Quota monitoring) — there Mode B is a pressure-release valve, not a preference. File-prompt mechanics: [references/batch-prompt-template.md](references/batch-prompt-template.md).

**Model rule for Mode A (three tiers by task difficulty):**

- **Fable** (`model: "fable"`) — the **hardest** tasks: deep architectural analysis, adversarial cold review of irreversible operations, delicate multi-file reasoning where the cost of error is high. Reserve it for the top edge of difficulty.
- **Opus** (`model: "opus"`, or no parameter — inherits Opus) — the **default** for ordinary bulk work and hard reasoning.
- **Sonnet** (`model: "sonnet"`) — acceptable for easier tasks where it genuinely splits the quota. Verify the split landed on your setup before relying on it — history and the check: [references/rationale.md](references/rationale.md).

> **Divergence from upstream, deliberate (T16).** `superpowers:subagent-driven-development`
> §Model Selection optimises **cost and speed per role** and therefore prescribes «the least
> powerful model that can handle each role» — it prices turns as well as tokens («turn count beats
> token price»). This skill allocates a **fixed subscription pool** whose Opus half is not
> scarce and whose top tier has no published limits — a different problem class, which is why the
> default here is Opus rather than the cheapest tier that works. Upstream's «always specify the
> model explicitly when dispatching» stands unchanged.

---

## Three ways to do the work — choose by task size

**Look at task size first, then at type.** Canonical — Phase 3 triages every batch against this
matrix and nothing restates it elsewhere.

| Task size / type                                                                       | Method                                                                                                                      |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **SMALL**: 1 file, ≤5 lines, path known, X→Y replacement                               | **Senior via `Edit`** — spawning an agent for `s/foo/bar/` costs more than doing it by hand                                 |
| **BULK execution**: ≥2 files OR ≥10 lines OR grep OR logic changes                     | **Mode A (inline Agent on Opus)** ← DEFAULT (`isolation: "worktree"`)                                                       |
| **Research / audit / discovery / verification**                                        | **Mode A (inline Agent)** — lands in the parent session immediately; the plan can branch on interim results                 |
| Parallel independent batches of bulk work (file-lock OK)                               | **Mode A × N calls in one message** (`isolation: "worktree"`); **Mode B × N windows** when live-window throughput is needed |
| Pre-flight: git stash / branch setup / final push + PR                                 | Senior                                                                                                                      |
| N-window parallelism / audit trail / Opus pool in Red / explicit Sonnet offload needed | **Mode B (file-prompt)** — explicit option                                                                                  |
| Explicit «do it yourself / don't write a prompt»                                       | Mode A                                                                                                                      |
| **Autonomous research, ≥2 kickoffs in queue, maintainer wants autonomy**               | **Queue mode** (see [references/queue-mode.md](references/queue-mode.md))                                                   |

**Quota:** Mode A shares a pool with the Orchestrator (Opus by default; `model: "sonnet"` is acceptable for easier tasks where it genuinely splits the quota — see «Model rule»).

---

## Cross-session dispatch — worktree by default

Any dispatch of a new Claude Code session (fresh R-phase, a new window for Mode B, an autonomous research kickoff, switching to fresh context after someone else's `/clear`) goes **into its own worktree, not the shared workdir**.

Mechanics are `Skill('superpowers:using-git-worktrees')` — its Step 0 already detects an active
worktree and skips nested creation, and its Step 1 orders **native worktree tools before**
`git worktree add`. Follow that ordering; do not hand-roll the git command when the harness offers
a native one.

**The one override:** upstream asks the user for consent before creating a worktree. Here isolation
for a cross-session dispatch is the **default, not an option** — the consent step is pre-answered
for this workflow. Everything else in that skill applies unchanged.

Our niche above `using-git-worktrees`: umbrella quota zones, the Phase -1 protocol, Mode A/B dispatch. See §Quota monitoring and §Phase -1.

---

## In-session sub-agent isolation — `Agent` tool `isolation: "worktree"`

When delegating through the `Agent` tool **inside the current session**, the senior passes `isolation: "worktree"` whenever the junior will write — the harness creates and removes the worktree automatically.

**Mandatory when:**

- Any sub-agent with **Edit / Write / Bash mutations / commits / git ops**
- A parallel batch of ≥2 concurrent agents — **even if all are read-only** (race on `.git/index`)
- Bypass permissions mode is on — a subagent's mistake in a shared workdir has no undo
- Agent teams — every teammate inherits bypass; isolation is the only defence against cross-contamination

**May be skipped:** a single read-only Explore / grep / file read with no parallel agents.

❌ Anti-patterns: write work without isolation in bypass mode (no undo); a parallel batch without isolation «because they only read» (a race on git/index is still possible).

---

## Phases (quick overview)

| #      | Phase                          | Senior's actions                                                                                                            | Ends when                                               |
| ------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **-1** | **Self-review of own kickoff** | **Cold review of the prompt by 1-2 independent reviewers** (1× Opus default; 2× Opus for prod blast radius) before dispatch | Both reviewers returned GO (or ≤3 amendment iterations) |
| 0      | Pre-flight                     | Stash WIP, branch off `<BASE_BRANCH>`                                                                                       | Branch ready, working tree clean                        |
| 1      | Intake of fixes                | 2–3 lines per fix, zero grep/Read                                                                                           | User says «that's all / plan»                           |
| 2      | Planning                       | Batch table, agreement                                                                                                      | User confirms the plan                                  |
| 3      | Delegation                     | Spawn Agents, **quota check after every batch**                                                                             | All batches reported green                              |
| 4      | Control and PR                 | Final sanity check, push, PR                                                                                                | PR created, link handed over                            |
| 4.5    | Pre-PR self-audit              | Cross-ref claims + citation validation + niche audits                                                                       | Zero ATTN → push                                        |

---

## Quota monitoring (cross-cutting rule, active from Phase 3)

The senior tracks quota spend in real time and switches mode when thresholds are crossed. Without this you can hit a 429 mid-batch and lose progress.

### What to track

- **After every Agent call** the tool result carries a `<usage>total_tokens: N tool_uses: M duration_ms: T</usage>` block. **Remember N for each call.**
- **Cumulative Opus** = the sum of total_tokens across all inline Agent calls + an estimate of my own actions (~500-1500 tokens per substantial message, +500-2000 for reading a large file).
- **Cumulative Sonnet** = not directly observable from this session: Mode B runs in separate windows. Rely on the user's signal («Sonnet ~200k», «sonnet is yellow») or ask for `/status` from their sessions.

### Zones and response

| Zone        | Sonnet cumul | Opus cumul (mine) | Action                                                                                                                                                                                                                            |
| ----------- | ------------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟢 Green    | <150k        | <30k              | **Mode A — the default for everything** (execution + research). Continue.                                                                                                                                                         |
| 🟡 Yellow-S | 150–350k     | <30k              | Sonnet pool running out — not critical, Mode A on the Opus pool runs freely. If Mode B was used in parallel, consolidate windows.                                                                                                 |
| 🟡 Yellow-O | <150k        | 30–80k            | **Opus pool under load — THIS is when Mode B is justified:** move bulk execution to Mode B (file-prompt → Sonnet windows) to relieve Opus. Mode B here is a pressure-release valve, not the default. Minimise your own Read/Bash. |
| 🔴 Red      | >350k        | >80k              | **Pause.** Report the state and offer: (a) `/clear` and continue, (b) break until reset, (c) make sure remaining batches go through Mode B.                                                                                       |
| ⛔ Critical | 429          | same              | Stop. Log what is committed and what sits in the working tree, wait for reset.                                                                                                                                                    |

### Reset windows

Anthropic Max plan: quotas reset on a rolling 5-hour window. Exact figures come from `/status` (when it works) or claude.ai/usage. Rough limits: Opus ~200k/5h, Sonnet ~1M/5h. **The numbers are imprecise** — this is grey area. Use them for threshold estimation only.

> **Fable (the top tier) is deliberately NOT wired into the zones above** — its pool size and reset window are unknown, and inventing thresholds would be fabrication. Since Fable is the most capable and probably the scarcest model, spend it **deliberately and selectively** (only the «hardest tasks» from the «Model rule»), keep your own manual count of Fable calls, and cross-check against `/status`. Wiring Fable into the traffic light is a follow-up for when real limit figures exist.

**Quota-message format for the user + Burn mode (an explicit «burn Opus» on signal): [references/quota-and-burn.md](references/quota-and-burn.md).** In short: on a zone change — one line at the start of the next report; per-batch with no zone change — silence; burn mode only on an explicit user trigger, never autonomously.

### Quota-monitoring anti-patterns

- ❌ Ignoring `<usage>` in the tool result.
- ❌ Silently pushing into the Red zone «it'll probably hold».
- ❌ Recounting from scratch each round. Keep a cumulative total from session start.
- ❌ Spending Opus on quota tracking. This is an in-head operation.
- ❌ Reporting quota per batch when the zone has not changed — that is spam.

---

## Phase -1 — Self-review of your own kickoff (paranoia at start)

A cold read of your own dispatch prompt by 1–2 independent reviewers **before** sending catches ambiguity, stale references and hidden assumptions while the executor has not yet acted on them. A self-review embedded **inside** the prompt does NOT count as one of the reviewers — same execution context, so it is not independent. Why two rather than one, the motivating incidents and the ROI: [references/rationale.md](references/rationale.md).

> **Not the same gate as upstream's.** `superpowers:subagent-driven-development` scans the **plan**
> for internal conflicts before Task 1. Phase -1 cold-reviews the **dispatch prompt** by a seat
> that did not write it. Different artifact, different reader — run both.

**Must-trigger:**

- A multi-step kickoff/prompt **≥30 lines** for a junior agent
- Delegating **≥3 distinct subtasks** to one junior session
- The prompt includes git/PR operations, file edits, capability-commit territory, principle-test additions, or rule-bearing changes
- **Any Mode B file-prompt** (the «open a new session, copy EVERYTHING» format)
- **Any operation with irreversible blast radius** (prod DB write, force-push, package downgrade) — even if the prompt is small

**Skip OK:** direct Edit with no junior; a one-shot trivial task (≤10-line prompt, one Bash/Read/Edit); a read-only research call.

**Protocol skeleton:** (1) read your prompt cold → (2) spawn reviewers with an A/B focus split → (3) collect findings → (4) BLOCKER/MAJOR — fix the prompt, MINOR — log to known-residuals → (5) re-review BOTH in parallel after fixing a BLOCKER, max 3 iterations → GO. **Full protocol (reviewer prompt template, focus split, cost framing, T-traps, anti-patterns): [references/phase-minus-1.md](references/phase-minus-1.md).**

### Principle-test allowlist probe (mandatory measurement when NEW files land under watched paths)

If the dispatch creates ≥1 NEW file under paths guarded by the project's principle tests (for rules-as-tests-aif: `.claude/skills/**`, `.claude/rules/**`, `agents/**`, `docs/meta-factory/research-patches/**`, `packages/core/templates/**`), Phase -1 MUST include the measurement: «for every NEW path, grep `packages/core/principles/` for `EXEMPT_*` allowlists + the structural rule; confirm the artifact satisfies the rule OR falls under an exemption». Probe: `grep -rn 'EXEMPT_\|allowlist\|skip' packages/core/principles/ | grep -E '\.(test\.)?ts:' | head -20`. Grounding incident: PR #264 was pushed twice — principles 15 (paired-negative) and 10 (scope annotation) fired AFTER an 11-measurement Phase -1 missed both. (Relocated from CLAUDE.md «Operational conventions» 2026-07-21 — this skill is the declared codification target.)

### Subagent implementation (default = Opus)

Owned here, by declaration: [references/phase-minus-1.md](references/phase-minus-1.md) points back at
this table rather than holding its own copy.

| Scenario                                                             | Implementation                                                                        | Cost                               |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------- |
| **Hardest / max reasoning** (hardest design, irreversible operation) | Fable (`model: "fable"`)                                                              | most capable tier, use selectively |
| **Default** subagent via Agent tool                                  | **Opus** (omit `model` or `model: opus`)                                              | ~30-50k Opus per call              |
| **Prod-blast-radius** double coverage                                | 2× Opus via Agent parallel (top edge → 1× Fable)                                      | ~60-100k Opus                      |
| User explicitly said «go cheap / Sonnet»                             | 2× Sonnet via Agent tool (`model: "sonnet"`; or Mode B file-prompts for live windows) | ~0 Opus from the current session   |

**When the orchestrator writes a sub-prompt for another session**, that sub-prompt **must explicitly** state the implementation (Mode A 1× Fable / 1× Opus / 2× Opus / 2× Sonnet / Mode B 2× Sonnet). Model choice follows task difficulty.

---

## Phase 0 — Pre-flight (once, before starting)

**The senior does this itself** (not delegated), using values from discovery: stash any WIP
(`git stash push -u -m "wip: pre-umbrella <TASK_ID>"`), `git fetch <REMOTE>`, then branch off the
base — `git checkout -b <type>/<TASK_ID>-<slug> <BASE_BRANCH>`, type ∈ {feat, fix, hotfix,
refactor, chore} by umbrella character.

If Pre-flight `git status` shows WIP unrelated to the umbrella — **ask the user** before stashing. We do not silently lose someone else's work.

> Once the branch is ready, the executor loop is `Skill('superpowers:subagent-driven-development')` —
> it owns dispatch, per-task review, the fix rounds and the final whole-branch review. Use
> `Skill('superpowers:executing-plans')` only where subagents are unavailable; that skill says so
> itself.

---

## Phase 1 — Intake of fixes

- **Response format per fix:** 2–3 lines, no tool calls.
  ```text
  Got #N: «<old>» → «<new>» in <screen/file if named>. Registered.
  ```
- **Internal register.** Up to 5 fixes — in head. ≥5 — TodoWrite (1 item per fix, status pending).
- **Clarifications.** If a fix is ambiguous — **one** question. Better to spend 200 tokens on a clarification than 5000 on rework.
- **Do not argue UX downsides.** The user knows → the decision is made. Register it silently.

**Phase ends on:** «that's all», «plan», «go», «enough», or an explicit end of the stream.

---

## Phase 2 — Plan

One table in one message:

```text
| # | fix (1 line)                       | file/screen           | risk | depends on | batch |
| 1 | <fix>                              | <file>                | low  | -          | A     |
| 2 | <fix>                              | <file>                | low  | -          | A     |
| 3 | <fix>                              | grep across project   | med  | -          | B     |
| 4 | <fix>                              | <file>                | low  | -          | C     |
```

**Batch grouping rules:**

- **One file = one batch** (minimises merge conflicts).
- **Cross-cutting fixes** (renaming a prop + its consumers) — one batch.
- **Independent batches** — in parallel (Phase 3).
- **High-risk fixes** (logic, not just text) — a separate batch, no parallelism, tested first.

**Agreement:** a short «ok?» at the end. Without agreement, do not move to Phase 3. This is the only pause until the umbrella ends.

> For PRD-driven decomposition, `Skill('superpowers:writing-plans')` owns the plan document —
> import its tasks into the batch table above.

---

## Phase 3 — Delegation (orchestrator-workers)

**Mandatory declaration before every Agent call or file-prompt write:**

> «Mode <A|B> for <task-slug>. Mechanism: <inline Agent / file-prompt + Sonnet / Task subagent>. Quota: <Opus pool / Sonnet pool>.»

If you cannot fill this in without re-reading the «Default — Mode A» section above, re-read it first. Never use the Mode A/B labels from memory. Canonical definitions: [references/glossary.md](references/glossary.md).

**Triage every batch against the canonical Decision matrix (§«Three ways» above)** — it is the single statement of the size rule; do not re-derive it here.

The delegation loop itself is `Skill('superpowers:subagent-driven-development')`
(Coordinator → implementer → spec-reviewer → code-quality-reviewer, fix rounds, final review).

### The junior's prompt

Self-contained (the junior's context is empty), values from discovery. **Full template (TASK/CONTEXT/VERIFY/DECISIONS/REPORT) + Mode B file-prompt mechanics: [references/batch-prompt-template.md](references/batch-prompt-template.md).**

> **Before dispatch:** if the final prompt is ≥30 lines OR delegates ≥3 distinct subtasks OR is a Mode B file-prompt OR is an operation with irreversible blast radius → **run the Phase -1 self-review** (see the section above). It pays for itself on the first BLOCKER caught.

### Parallelisation and the file-lock matrix

Fan-out mechanics — how many dispatch calls in one response run concurrently — are
`Skill('superpowers:dispatching-parallel-agents')`. Mode A parallelism is N inline `Agent` calls
with `isolation: "worktree"`; Mode B parallelism is N prompt files opened in N Sonnet windows.

**File-lock matrix — this skill's own gate.** Before any parallel spawn (either mode) check: no two batches edit the same file. If they overlap — sequential.

> **Divergence from upstream, deliberate (T16).** `superpowers:subagent-driven-development` bans
> parallel implementer dispatch outright — its implementers share one workspace, so concurrency is
> a conflict by construction. Here the parallel units are **independent umbrella batches**, each in
> its own worktree and cleared by the file-lock matrix above; the conflict upstream forbids is the
> one this gate removes. Inside a single SDD run, upstream's ban stands.

### Mid-batch sanity check (between batches)

After every 3–4 batches, **one cheap pass** by the senior: `git log --oneline <BASE_BRANCH>..HEAD` (are all commits in format?) and `git diff --stat <BASE_BRANCH>..HEAD` (nothing extraneous?). If something is off — **stop**, investigate, do not accumulate debt.

---

## Phase 4 — Control and PR

### Reading the REPORT (per agent)

Only the REPORT text, do not dive into the code. Checklist in head (6 items):

1. All VERIFY items ✅?
2. Do the files in `Stat` match what the plan expected?
3. Is `DECISIONS` empty or explainable?
4. `Confidence: high`?
5. Is `ATTN` empty?
6. **Quota check:** add `total_tokens` to the cumulative total, assess the zone. Mention it only if the zone changed; otherwise silence.

All 6 ✅ → «ok, next». **0 tool calls.**

Any red in 1-5 → «Recovery patterns» below.
Yellow/Red in #6 → switch working mode.

### Final sanity check, push and PR

Once, before the PR: `git log --oneline <BASE_BRANCH>..HEAD`, `git diff --stat <BASE_BRANCH>..HEAD`, and the `<CHECK_ALL>` command from discovery — once, with build. `Skill('superpowers:verification-before-completion')` owns the evidence-before-claims discipline for this step; the 6-item REPORT checklist above remains the primary gate.

Push and PR creation are the senior's, and the mechanics (branch push, `gh pr create`, body template, the merge-vs-PR menu) are owned by `Skill('superpowers:finishing-a-development-branch')`. Two project details it does not carry: pass `--base` **without** the remote prefix, and title the PR `<TASK_ID>: <short umbrella name>` per the discovery-detected convention. If Phase 0 stashed someone else's WIP, restore it afterwards on the previous branch (`git stash pop`).

---

## Phase 4.5 — Pre-PR self-audit

**When:** Before `gh pr create` — after REPORT checklist passes, before push.

**Purpose:** honest verify-trace at PR-create time — no unverified claim ships as a checked `[x]`. Steps 1-2 adapt the «Research synthesis workflow» that `superpowers:writing-skills` ships in its bundled `anthropic-best-practices.md` (§«Research synthesis workflow»); steps 3-4 are niche additions.

1. **Cross-reference claims:** For every `[x]` checkbox in the REPORT verify-trace, confirm it references a specific tool-call output (file:line, command result, grep output). If any checkbox says «verified» without a concrete artifact — mark `[ ]` and add `ATTN: unverified claim`.

2. **Citation completeness loop:** For every file:line citation in REPORT or PR body — does the cited line exist, and does it evidence the claim (read the line, not just its presence)? If citations are incomplete → return to Worker for evidence (re-dispatch, do not extrapolate).

3. **Companion delegation audit:** For each `Skill('...')` invocation referenced in this umbrella — was it actually invoked, or just mentioned? If referenced but not invoked, the companion's verification step was skipped. Surface as ATTN if material to PR correctness.

4. **Pre-mark PR body checkboxes** (MANDATORY before `gh pr create` / `gh pr edit --body`): put an **already-checked** `[x]` on everything verified through (a) green CI, (b) a Worker REPORT verify-trace (literally enumerated observed results), (c) reviewer probes (`gh pr diff` / `git show` / grep / DB probe). Leave `[ ]` **only** for the physically pending (visual acceptance / runtime after a migration / third-party access). Do NOT extrapolate «merged means runtime verified» — an `[x]` goes only on an item literally mentioned in the verify-trace. Anti-pattern: copying the kickoff checklist over empty — that shifts the work onto the user, who then re-walks what is already verified. This matters most for aggregating epic→staging PRs.

> If Phase 4.5 audit finds ≥1 unverified claim → escalate before PR creation. Zero ATTN → proceed to push + PR.

---

## Recovery patterns (what to do when something goes wrong)

Findings-driven rework — resume-vs-fresh implementer, the round cap, adjudication at the cap — is
owned by `Skill('superpowers:subagent-driven-development')` §The fix loop. The rows below are the
ones with no upstream owner, because they are about the senior/junior boundary in this workflow:

| Situation                                        | Senior's action                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------ |
| `Confidence: low`                                | Ask the user for clarification; relay their answer to the junior               |
| `ATTN` non-empty                                 | Read the ATTN, decide: fix is fine and we move on / rework needed / ask        |
| Junior committed extras (refactor / extra files) | `git reset --soft HEAD~1` + prompt the junior to redo it narrowly              |
| Junior pushed on its own (a violation)           | Immediately `git push --delete <REMOTE> <branch>` after agreeing with the user |
| Two parallel Agents touched the same file        | Conflict. Resolve by hand; go sequential next time                             |
| Junior looped, cannot find the file              | Prompt with an explicit `find` command and a hint                              |
| User changes a fix mid-flight                    | Re-plan, note what is already done, continue                                   |
| Fix #N is technically impossible                 | **Pushback is allowed** — technical impossibility ≠ a UX opinion               |

---

## Queue mode — autonomous research multi-kickoff

Modes A/B serve **one task**; Queue mode serves **a series of research kickoffs**, run autonomously in cycles of Worker → file-system verify → Reviewer (GO/REVISE, max 5 iter) → anti-collusion spot-check → next.

**When:** ≥2 research kickoffs queued + the maintainer granted autonomy + each kickoff has self-contained acceptance criteria. **NOT for:** single kickoffs (Mode A/B), parallel code execution (Mode B × worktrees), kickoffs with open D-questions for the maintainer.

**Everything else — pre-flight checklist, state.md format, the dispatch cycle, the anti-collusion formula, iteration limits, escalation codes, dual-channel verification of CC claims, headless fallback: [references/queue-mode.md](references/queue-mode.md).** Traps: [references/ai-laziness-traps-orchestrator.md](references/ai-laziness-traps-orchestrator.md) (T-AO-A…T-AO-L). Dispatch templates: [references/worker-template.md](references/worker-template.md), [references/reviewer-template.md](references/reviewer-template.md).

---

## Communication with the user

Upstream's continuous-execution norm applies (`superpowers:subagent-driven-development` — do not
pause for check-ins between tasks). What this workflow adds:

- **The Phase 2 plan agreement is the only pause** between intake and the PR. Do not interrupt the flow of fixes.
- **Batched questions.** All ambiguities from Phase 1 — one list at the start of Phase 2 (upstream's own «present everything as one batched question, before execution begins» norm, applied to the intake stream).
- **ATTN escalation.** Judge it: solvable alone / needs the user's word.
- **Status update.** After each batch — 1 line: «batch A: 2 commits, ok». Not a repeat of the report.

---

## Auto-triggering project skills through prompt wording

The junior auto-triggers skills on keywords in its prompt. **Do not restate a skill's content** — mention its name or a context word (`- IF you touch <topic> → activate skill <skill-name>`), the junior will read it. The list of available skills comes from discovery (`ls .claude/skills/`). Use `Skill('superpowers:using-superpowers')` for CSO discipline (auto-invocation by description match).

---

## Anti-patterns (seen it — redo it)

Generic delegation rationalizations are owned by `superpowers:subagent-driven-development`
§Common Rationalizations. These are this workflow's own:

- ❌ Every fix as its own PR. → One PR per umbrella.
- ❌ Full check:all after every fix. → Only at the end.
- ❌ A junior pushes / merges / creates a PR. → Senior only.
- ❌ Long prose in a REPORT. → Strict template, bullets.
- ❌ The senior silently accepts an `ATTN: ...`. → ATTN is a mandatory stop.
- ❌ Parallel spawn without a file-lock check. → Conflicts in one branch.
- ❌ Routing everything through Mode B file-prompts «to save Opus» while the Opus pool is fine. → Mode A is the default; Mode B only on the §«Default — Mode A» conditions.
- ❌ Pulling Sonnet onto a task that needs top-tier reasoning (prod-blast-radius review, hard architectural analysis). → Opus is the default there.
- ❌ Pre-flight skipped, someone else's WIP mixed into the umbrella. → Stashing is MANDATORY.
- ❌ A junior did a refactor «along the way». → Reset, redo narrowly.
- ❌ Discovery skipped in a new repo. → The junior's prompt will carry wrong commands.

---

## Token budget (red flags)

| Metric                             | Normal   | Red flag                                  |
| ---------------------------------- | -------- | ----------------------------------------- |
| Senior per fix (prompt + report)   | 500–1500 | >3000 → diving into code instead of Agent |
| Pre-flight + plan for 10 fixes     | 3–5k     | >10k → too much senior-side research      |
| Final sanity check + PR            | 2–3k     | >5k → superfluous Reads/checks            |
| Junior per fix (its own session)   | 5–30k    | (not my problem)                          |
| Senior total for an umbrella of 10 | ~25–35k  | >50k → revisit the workflow               |

If the senior spends >5k tokens on a single fix, it is almost always diving into the code itself instead of delegating. Roll back, spawn an Agent.
