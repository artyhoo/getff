---
name: arch
description: 'Use when starting the EXTERNAL design contour — turning a raw idea or prep-doc into a reviewed design and a routed handoff. Triggers: /arch, external contour, внешний контур, спроектируй идею, задумка в архитектуру, design contour, arch loop, продумай и спроектируй, идея → kickoff, research contour, research-spec, distillate, исследовательский контур. NOT for reviewing code (/reviewer), dispatching stages (/pipeline), factory runtime questions (aif-doctor), or a bare brainstorm with no handoff (superpowers:brainstorming).'
arguments: [topic-or-prep-doc]
argument-hint: '<topic | path/to/prep-doc.md>'
disable-model-invocation: true
allowed-tools:
  - Read
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
  - Write
  - Edit
  - Skill
  - Bash(git *)
  - Bash(gh *)
  - Bash(ls *)
  - Bash(cat *)
---

<!-- @harness-posture: cc-native-with-fallback — degradations: no subagents → §2 cold seats + §1.5 probe dispatch degrade; no AskUserQuestion → serial questioning; no Skill invocation → direct file reads; no aif bridge → the `bridge: auto` exit row is unavailable, exit degrades to in-session SDD per tier-home.md:86 -->

# /arch — external design contour

> **Class:** C — choreography wrapping canonical companion procedures.
> **Authoritative for:** idea → research/design → cold review → routed handoff.
> **NOT authoritative for:** project goal, brainstorming internals, tier criteria or execution mechanics.

Input: topic or prep-doc path. Result: reviewed design and scoped routed handoff, or a documented kill/fork.
Run in the operator's top-tier seat; no pinned model replaces that choice.

> **Invocation-channel flag, not a permission.** `disable-model-invocation: true` keeps a skill out of auto-load and out of subagent preload, and stops the Skill tool from invoking it — an explicit `/<name>` from the operator is its only invocation channel, so an agent never self-initiates the procedure. It does **not** seal the file: an agent already asked to do this work may read the SKILL.md and execute its documented steps, and doing so is correct behaviour, not a workaround. On ZCode the flag is not runtime-enforced (absent from the runtime, survey #1699 §5): there the explicit-only channel discipline is prompt-level — this blockquote is the gate, so an agent on ZCode must still treat an explicit /<name> as the only self-initiation channel. <!-- canonical: invocation-channel-flag -->

## Phases and required reads

1. Before ideation or a consensus retell, read [ideation](references/ideation.md). Adopt brainstorming
   as-is, with its user gate; use the pinned grilling/domain-modeling companions and their exact
   fallback rules. Record premise meaning, live decision register and falsifiers as decisions settle.
   Spec includes testing seams. After compaction, retell claims are diffed against the last confirmed
   spec/premise register; unconfirmed author derivations stay outside the agreement table.
2. If evidence is insufficient for ideation, read [research contour](references/research-contour.md)
   before commissioning research. It owns research-spec, source curation, distillation and K-pass.
   Cited-sources-only scope, cold K-pass before consumption and recorded bounded drill-down apply.
3. Before design review, read [design review](references/design-review.md). Two read-only altitudes
   inspect immutable artifact snapshots at `Inputs-ref`; no authoring dialogue. Cold means neither
   author nor recipient of authoring context. Assign unique scratch filenames. Verdicts use actual
   evidence and failure scenarios; unrecorded value premises escalate. Two REVISE rounds → operator fork.
4. Before writing/routing an exit or taking an escalated return, read
   [exit and escalation](references/exit-and-escalation.md). Apply actual tier criteria, plan completeness,
   staging placement and the protected fidelity-check precondition before a bridge-profile marker.
   The operator chooses the execution channel. Never reimplement SDD or dispatcher here.

## Exit artifacts and chips

**Dispatch chips:** before emission read [output-format §9/§9A](../pipeline/references/output-format.md).
Only when `spawn_task` is invocable, alongside the durable handoff/launch card. Every visible prompt
carries `Isolation first` → `In-flight probe` → `Stage-gate at click time` → cwd + artifact path.
Try aif auto-dispatch first under Channel order; chip exceptions require `chip-over-bridge:` evidence.
The single-task `bridge: auto` row already dispatches at write time: never emit a second dispatch chip.

## Seat lifecycle

Registry-role seat sessions (birth · work · self-cleaning · retirement) follow ONE protocol —
[.claude/rules/seat-lifecycle.md](../../rules/seat-lifecycle.md) (SLP): each phase binds a
settled owner (ADR D6/D7/D8, session-bus v2, night-mode); bus-touching steps are
Part-II-gated. Never restate it here (`#fifth-description-of-the-loop`).

## Without this skill

Each contour is re-improvised: the operator manually switches models per phase (6× `/model` in the origin session, 2026-07-21) and re-asks «how do I start this»; the design itself gets no cold review at either altitude, so plausible-but-wrong designs reach the factory where rework is most expensive; and the handoff decision (kickoff vs in-session) is re-derived from memory against no criteria — the exact re-invention the task-tier table was written to end.

## With this skill

One entry point runs the whole contour in one top-tier session: brainstorming unchanged, then two cold reviewers at fixed altitudes gate the design before any implementation spend, then the exit is routed by the recorded tier criteria — the handoff artifact (kickoff on staging, or an in-session plan) lands exactly where the next contour expects it, and parked factory questions flow back to the right seat in batch.
