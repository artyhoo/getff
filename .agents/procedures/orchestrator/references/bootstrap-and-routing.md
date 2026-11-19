# orchestrator — bootstrap and routing

> **Authoritative for:** the selected orchestrator procedure sections below; read when routed by [the skill card](../SKILL.md).
> **NOT authoritative for:** project goal or unrelated skill modes. Commands execute from the project root unless stated otherwise.

<!-- @harness-posture: cc-native-with-fallback — Agent-tool subagent dispatch is portable (zcode evidence via night-mode/references/substrate-and-models.md, Harness portability); Skill-tool invocation degrades to direct file reads -->

# Orchestrator — the senior coordinates, juniors execute and verify

> **Authoritative for:** the operator-side orchestration workflow — the Mode A/B dispatch
> **choice rule** (when B over A, and on which model), the task-size decision matrix, quota
> zones, the Phase -1 → Phase 4.5 phase sequence, and the Queue-mode entry conditions.
> [pipeline dispatch procedure](../../pipeline/references/dispatch.md) names this **skill** as the SSOT for the
> Mode A/B vocabulary; within the skill, the channel _definitions_ live in
> [references/glossary.md](glossary.md) and the _choice_ lives here.
> **NOT authoritative for:** the in-session executor loop (dispatch → task review → fix rounds →
> final review) — `superpowers:subagent-driven-development` (ADOPT, wrapped, never re-described);
> workspace isolation mechanics — `superpowers:using-git-worktrees` (its Step 0 detection and
> `git worktree` fallback are adopted by pointer); parallel-dispatch mechanics —
> `superpowers:dispatching-parallel-agents`; plan documents — `superpowers:writing-plans`;
> evidence-before-claims at the verification step — `superpowers:verification-before-completion`;
> final push/PR mechanics — `superpowers:finishing-a-development-branch`. The role and
> dispatch-channel definitions — [references/glossary.md](glossary.md). Incidents,
> ROI and provenance — [references/rationale.md](rationale.md). The portable
> worker-discipline subset that travels into aif containers — see
> [packages/core/templates/shared/skill-context/aif-orchestrator-discipline/SKILL.md](../../../../packages/core/templates/shared/skill-context/aif-orchestrator-discipline/SKILL.md).
> Stage execution through the aif loop — see the `dispatcher` skill, which ships only at factory
> depth (`setup.d/lib.sh` `GETFF_SKILLS_FACTORY`); linkless on purpose, because this skill ships
> one tier lower and a relative sibling link would dangle on an env install. Umbrella priority
> and launch tables — see [pipeline](../../pipeline/SKILL.md). Project goal — see
> [README.md#why-this-exists](../../../../README.md#why-this-exists).

A **thin wrapper** over the superpowers stack: the executor loop is
`superpowers:subagent-driven-development` run as-is, isolation is `superpowers:using-git-worktrees`,
parallel fan-out is `superpowers:dispatching-parallel-agents`. This skill owns only what no
upstream piece covers — project discovery, the Mode A/B dispatch channels and their quota
economics, the task-size triage that decides whether to delegate at all, Phase -1 (cold review of
your own dispatch prompt), and Queue mode. If you catch yourself re-describing the executor loop,
the worktree mechanics, or the parallel-dispatch mechanics here, stop — that is
`#parallel-evolution-creep`.

**Goal:** senior-context isolation + maximum reasoning quality + **one PR per umbrella**.

## Roles, vocabulary and provenance (bindings)

Roles (Orchestrator / Worker / Reviewer), the depth-2 hierarchy limit, and the Mode A / Mode B /
Queue-mode channel definitions are owned by [references/glossary.md](glossary.md) — read
it before your first dispatch in a session and never restate its labels from memory. The 1:1
mapping onto companion vocabulary (Superpowers, aif-handoff, OhMyOpencode), the incidents behind
Phase -1 and Phase 4.5, and this skill's provenance in Anthropic's
[Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents)
patterns live in [references/rationale.md](rationale.md).

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

The cache is in-head for the session (re-take it when the branch or remote changes). Skip when: already worked in this repo during this session, or the task is a single trivial fix (→ direct `Edit`, no workflow). **Full checklist with commands, user-facing questions and the `orchestrator.local.md` template: [references/discovery.md](discovery.md).**

Discovery is this skill's niche; decomposition is the companion's — after discovery, hand a PRD to
`Skill('superpowers:writing-plans')` for the plan document and run it through
`Skill('superpowers:subagent-driven-development')`. Once discovery is cached, activate the
workflow below without re-explaining it.

---

## Default — Mode A (inline `Agent` on Opus). Mode B (file-prompt → Sonnet) is an explicit option

Channel definitions (mechanism ↔ quota pool ↔ use) are owned by
[references/glossary.md](glossary.md); this section owns only the **choice rule**.

**Mode A = the default for everything: execution, research, audit, verification.** Spawn an inline `Agent` from the senior session: immediate result, zero manual copy-paste, strong reasoning, and the plan can branch on interim results. Executor context is isolated (for write tasks — `isolation: "worktree"`).

**Why A and not B:** the Opus quota is not scarce on the Max plan, so the default is strong reasoning inline (the top tier, Fable, is reserved for the hardest tasks — see «Model rule»). Mode A gives an immediate result with no manual overhead; Mode B (a separate Sonnet window) requires hand copy-pasting every prompt and REPORT, and its latency plus overhead usually costs more than it wins — except in the cases below.

**Mode B — an explicit option, not the default.** Take B only when at least one holds: (a) **N-way parallelism** across N live windows yields real throughput beyond parallel inline Agents in one message; (b) a **persistent audit trail** as a prompt file is required; (c) the user **explicitly** asks to offload onto the Sonnet quota AND accepts the manual copy-paste cost; (d) the **Opus pool is under load** (Yellow-O or Red in §Quota monitoring) — there Mode B is a pressure-release valve, not a preference. File-prompt mechanics: [references/batch-prompt-template.md](batch-prompt-template.md).

**Model rule for Mode A (three tiers by task difficulty):**

- **Fable** (`model: "fable"`) — the **hardest** tasks: deep architectural analysis, adversarial cold review of irreversible operations, delicate multi-file reasoning where the cost of error is high. Reserve it for the top edge of difficulty.
- **Opus** (`model: "opus"`, or no parameter — inherits Opus) — the **default** for ordinary bulk work and hard reasoning.
- **Sonnet** (`model: "sonnet"`) — acceptable for easier tasks where it genuinely splits the quota. Verify the split landed on your setup before relying on it — history and the check: [references/rationale.md](rationale.md).

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

| Task size / type                                                                              | Method                                                                                                                       |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **SMALL**: 1 file, ≤5 lines, path known, X→Y replacement                                      | **Senior via `Edit`** — spawning an agent for `s/foo/bar/` costs more than doing it by hand                                  |
| **BULK execution**: ≥2 files OR ≥10 lines OR grep OR logic changes                            | **Mode A (inline Agent on Opus)** ← DEFAULT (`isolation: "worktree"`)                                                        |
| **Research / audit / discovery / verification**                                               | **Mode A (inline Agent)** — lands in the parent session immediately; the plan can branch on interim results                  |
| Parallel independent batches of bulk work (file-lock OK)                                      | **Mode A × N calls in one message** (`isolation: "worktree"`); **Mode B × N windows** when live-window throughput is needed  |
| Pre-flight: git stash / branch setup / final push + PR                                        | Senior                                                                                                                       |
| N-window parallelism / audit trail / Opus pool in Red / explicit Sonnet offload needed        | **Mode B (file-prompt)** — explicit option                                                                                   |
| Explicit «do it yourself / don't write a prompt»                                              | Mode A                                                                                                                       |
| **Autonomous research, ≥2 kickoffs in queue, maintainer wants autonomy**                      | **Queue mode** (see [references/queue-mode.md](queue-mode.md))                                                               |
| **Mechanical pipeline of work you coordinate**: poll aif, harvest, PR body, babysit CI, merge | **Chip worker** — a standalone session with a REPORT contract (§Coordinator seat); never the seat, never an in-session Agent |

**Quota:** Mode A shares a pool with the Orchestrator (Opus by default; `model: "sonnet"` is acceptable for easier tasks where it genuinely splits the quota — see «Model rule»).

### Coordinator seat — the mechanical pipeline goes to a chip worker

When this session is the **coordinator seat** of a campaign (orchestrator + advisor over several stages), it keeps only routing work: cutting kickoffs, dispatching into aif, taking decisions, relaying operator forks. The mechanical pipeline — polling aif, harvesting finished stages into PRs, drafting PR bodies, waiting on CI and conflicts, merging — goes to a **standalone chip worker**: a separate session opened with `spawn_task` (Claude Code desktop), or, on a harness without it, a fresh session the operator opens from the same prompt (a Mode B file-prompt). The prompt is built from [references/chip-worker-template.md](chip-worker-template.md) and ends with a REPORT contract the seat reads back.

- **An in-session `Agent` is not a chip.** Its work still flows through the seat's context and the seat stays a merge-queue participant — the recurrence that made this a rule (2026-09-28: a seat pushed a stage's edits into a background Agent but kept verifying, sequencing on the merge lock and drafting the PR body itself).
- **The worker reports; it never decides.** Operator forks it meets (a stage stuck in manual review, a scope question) come back as `ATTN:` lines; the seat decides.
- **Secure local-only work before the handoff.** A branch that exists nowhere on origin goes into a `git bundle` in the coordination directory first, so the worker can start from it.
- **Not a coordinator seat:** the `dispatcher` seat, a night-mode run on the aif substrate, and the chip worker itself — their role _is_ the pipeline.
- **Command-time nudge — operator repo only.** In this framework's own repo, [.claude/rules/coordinator-seat-delegation.md](../../../rules/coordinator-seat-delegation.md) carries an `events:` card: the first harvest / aif-task-polling / babysit command of a session injects a one-line reminder (CI waits and merges are not triggers — every PR session runs them). `.claude/rules/` is not shipped, so on a consumer install this section is prose only.

Why: the seat's context is the scarce resource; a worker session is cheap and disposable (operator directive 2026-09-07, after a seat hand-harvested seven stages).

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

**A reviewer can be a mutator.** A cold reviewer that derives REDs by editing source («disable a branch → run the test → see RED → revert») or that inspects history with `git checkout <sha> -- <file>` mutates the tree, whatever its role label says. It gets `isolation: "worktree"`, or runs **alone** (never concurrently with any other agent in the same tree), or derives its REDs on copies outside the worktree. The failure signature when this is broken: a concurrent read-only reviewer reports «flaky» or «broken» tests whose failing cases are exactly the branches the mutator was disabling — check for that mirror before accepting a flake/regression BLOCKER from a concurrent review batch. Anti-pattern `#mutating-reviewer-in-shared-tree` ([parallel-subwave-isolation.md §3](../../../rules/parallel-subwave-isolation.md)).

**After any non-isolated subagent ran in your tree**, before `git add`: `git status`, then check each changed file's diff **direction** against `origin/<base>` — a file you did not intend to touch, or one now _behind_ the base, is contamination; restore it with `git checkout origin/<base> -- <file>`. Never `git add -A` blind (2026-07-03: a non-isolated review workflow left four files from another PR reverted — blind staging would have reverted a security fix).

❌ Anti-patterns: write work without isolation in bypass mode (no undo); a parallel batch without isolation «because they only read» (a race on git/index is still possible); a «read-only reviewer» label on an agent that edits-and-reverts to derive REDs.

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
