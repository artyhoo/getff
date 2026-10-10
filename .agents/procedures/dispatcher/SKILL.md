---
name: dispatcher
description: "Use when you need to EXECUTE a chosen umbrella's stages through the aif-control loop. Triggers: dispatcher, execute umbrella, run stages, aif loop, harvest PR, stage gate advance. Invocation channel: explicit /dispatcher only — disable-model-invocation:true is a channel flag and not a permission (§0). NOT for planning — priority and launch-table are /pipeline."
arguments: [umbrella]
argument-hint: '[umbrella-name]'
disable-model-invocation: true
model: opus
allowed-tools:
  - Bash(git *)
  - Bash(gh *)
  - Bash(tsx *)
  - Bash(npx *)
  - Bash(ls *)
  - Bash(cat *)
  - Read
  - Agent
---

<!-- @harness-posture: cc-native-with-fallback — CC slash-command + !shell + REST dispatch; dual-channel degradation for CC-absent harnesses documented in references/invocation.md §0 -->

# /dispatcher — execute a chosen umbrella

> **Authoritative for:** the aif execution loop and the conditionally loaded procedures below.
> **NOT authoritative for:** project goal, planning/priority (/pipeline), or runtime repairs (/aif-doctor).

Inputs: a named umbrella and its reviewed kickoff. Result: stage-by-stage execution, cold fidelity,
harvested gated PRs, stage advancement and durable state/done records.

> **Invocation-channel flag, not a permission.** `disable-model-invocation: true` keeps a skill out of auto-load and out of subagent preload, and stops the Skill tool from invoking it — an explicit `/<name>` from the operator is its only invocation channel, so an agent never self-initiates the procedure. It does **not** seal the file: an agent already asked to do this work may read the SKILL.md and execute its documented steps, and doing so is correct behaviour, not a workaround. On ZCode the flag is not runtime-enforced (absent from the runtime, survey #1699 §5): there the explicit-only channel discipline is prompt-level — this blockquote is the gate, so an agent on ZCode must still treat an explicit /<name> as the only self-initiation channel. <!-- canonical: invocation-channel-flag -->

## Procedure

- Before starting or resuming, read [invocation](references/invocation.md), then
  [execution](references/execution.md) §1 preflight and the relevant §2 step **before its action**.
  Resolve actual host/container paths and in-flight state; wrong branch or missing input stops dispatch.
- Follow the loop: dispatch → monitor → parked Q&A → pre-egress fidelity → harvest → cold review →
  stage gate → frontier read/advance → closure. Never use an in-memory FIFO as the merge gate.
- For a parked fork, read [parks](references/parks.md) before answering or emitting its chip.
  Technical implementation forks and owner strategy/value forks have different seats; never guess
  an owner decision. Unknown or terminal blockers are surfaced honestly, not force-cleared.
- Before harvest, read [harvest](references/harvest.md) and execution §2.4/§2.4b, including fidelity
  ordering. Stock egress uses the host transport and its pre-push hook. A container-only github block
  does not authorize API bypass. API escape needs verified host transport failure + reachable API,
  the local CI sweep, reconciled host files, and cold audit of the **minted** head before PR creation.
  Listed file contents replace whole paths; the helper does not append-merge or retrieve container data.
- REVISE routes verified file:line fixes locally or open decisions through the tier-home rework route.
  Enforce the existing convergence caps; STOP/ambiguous scope escalates. Before advancing verify the
  required PRs merged to staging, then read the actual frontier. Close merged tasks through harvest,
  never leave the UI as the closure mechanism.
- Environment failure → doctor for passive triage and its mutation tiers. Tier-1 reversible fixes
  auto-apply with evidence/undo; Tier-2 destructive/spending/standing config needs exact authorization.
- For scope/ownership questions or provenance claims, read [scope-and-provenance](references/scope-and-provenance.md).

## Park-chip constraints

**Park-chip:** emit only when `spawn_task` is invocable; payload is **pointers only**, not an answer
or copied question. Read [parks](references/parks.md) before constructing it. **Re-verify at click time**
against the live task/question: absent or answered park → **report and stop**. Dismissal is best-effort.
Keep the normal text fallback when chips are unavailable; dispatch-chip gates are a separate contract.

## Seat lifecycle

Registry-role seat sessions (birth · work · self-cleaning · retirement) follow ONE protocol —
[.claude/rules/seat-lifecycle.md](../../rules/seat-lifecycle.md) (SLP): each phase binds a
settled owner (ADR D6/D7/D8, session-bus v2, night-mode); bus-touching steps are
Part-II-gated. Never restate it here (`#fifth-description-of-the-loop`).

## Without this skill

The operator manually tracked task IDs, polled `GET /tasks/:id` in a shell loop, forgot to run `harvest.ts` after `done` status (the most-skipped step), copy-pasted `gh pr create` commands with wrong `--base` args, ran `superpowers:requesting-code-review` only sometimes, and manually checked whether the PR merged before dispatching the next stage. Each stage required 6–10 manual steps with no enforcement that all happened in the right order.

## With this skill

`/dispatcher <umbrella>` drives the full dispatch→monitor→Q&A→harvest→cold-review→gate→advance loop. Technical forks are resolved autonomously via `superpowers:brainstorming` (on CC) and reported; strategic forks surface a single question to the operator. The harvest step (push + PR + auto-merge) fires automatically on `done` status — the forgotten step is no longer forgettable. The operator's attention is needed only for genuine strategic decisions.

---
