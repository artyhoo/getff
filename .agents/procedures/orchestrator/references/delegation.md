# orchestrator — delegation

> **Authoritative for:** the selected orchestrator procedure sections below; read when routed by [the skill card](../SKILL.md).
> **NOT authoritative for:** project goal or unrelated skill modes. Commands execute from the project root unless stated otherwise.

## Phase 3 — Delegation (orchestrator-workers)

**Mandatory declaration before every Agent call or file-prompt write:**

> «Mode <A|B> for <task-slug>. Mechanism: <inline Agent / file-prompt + Sonnet / Task subagent>. Quota: <Opus pool / Sonnet pool>.»

If you cannot fill this in without re-reading the «Default — Mode A» section above, re-read it first. Never use the Mode A/B labels from memory. Canonical definitions: [references/glossary.md](glossary.md).

**Triage every batch against the canonical Decision matrix (§«Three ways» above)** — it is the single statement of the size rule; do not re-derive it here.

The delegation loop itself is `Skill('superpowers:subagent-driven-development')`
(Coordinator → implementer → spec-reviewer → code-quality-reviewer, fix rounds, final review).

### The junior's prompt

Self-contained (the junior's context is empty), values from discovery. **Full template (TASK/CONTEXT/VERIFY/DECISIONS/REPORT) + Mode B file-prompt mechanics: [references/batch-prompt-template.md](batch-prompt-template.md).**

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
