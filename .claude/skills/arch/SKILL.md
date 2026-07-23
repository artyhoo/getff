---
name: arch
description: Use when starting the EXTERNAL design contour — turning a raw idea or prep-doc into a reviewed design and a routed handoff. Wraps superpowers:brainstorming unchanged and adds only the two missing pieces - a cold two-altitude design review (top-tier goal/feasibility critic + executor-tier facts/patterns reviewer, dispatched as read-only subagents) and exit routing per the CLAUDE.md task-tier criteria (factory-bound → kickoff → staging → /pipeline or bridge auto-dispatch; small in-session → superpowers writing-plans tail; tiny → direct edit). Triggers - /arch, external contour, внешний контур, спроектируй идею, задумка в архитектуру, design contour, arch loop, продумай и спроектируй, идея → kickoff. NOT for reviewing code (/reviewer), dispatching stages (/pipeline), factory runtime questions (aif-doctor), or a bare brainstorm with no handoff (use superpowers:brainstorming directly).
arguments: [topic-or-prep-doc]
argument-hint: "<topic | path/to/prep-doc.md>"
disable-model-invocation: true
allowed-tools:
  - Read
  - Grep
  - Glob
  - Agent
  - Write
  - Edit
  - Skill
  - Bash(git *)
  - Bash(gh *)
  - Bash(ls *)
  - Bash(cat *)
---

> **Class:** C — prose workflow choreography; every load-bearing gate it routes through is owned (and where applicable mechanically enforced) elsewhere: kickoff traps → principle 12; kickoff placement → [kickoff-staging-placement.md](../../rules/kickoff-staging-placement.md); tier criteria → [CLAUDE.md «Task-tier routing»](../../../CLAUDE.md). Promotion trigger: ≥2 incidents in 6 months where a phase was silently skipped and a design flaw reached the factory → add a deterministic phase-artifact check.
> **Fires:** operator starts a design contour for a nontrivial idea (`/arch <topic|prep-doc>`).
> **Authoritative for:** the external-contour choreography ONLY — §0 seat, §1 phase order, §2 the cold two-altitude design-review pass, §3 exit routing, §4 escalation intake.
> **NOT authoritative for:** the ideation loop itself — `superpowers:brainstorming` (ADOPT, wrapped, never re-described); reviewer ROLE discipline (surface, never decide) — [reviewer-discipline.md](../../rules/reviewer-discipline.md); tier criteria — [CLAUDE.md «Task-tier routing»](../../../CLAUDE.md); tier→model instantiation — [night-mode/SKILL.md](../night-mode/SKILL.md) («Overnight model posture» paragraph, relative tiers); dispatch mechanics — [pipeline/SKILL.md](../pipeline/SKILL.md) + `packages/runtime-bridge`. Project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
>
> **Deliberate frontmatter deviation:** sibling command-skills pin `model: opus`; this skill deliberately omits `model:` — the contour is defined to run in the operator's TOP-tier session (whatever fills that seat today; a pinned `opus` would down-shift a stronger-model session). The seat is chosen by the operator at session start, not by frontmatter.

# /arch — external design contour (idea → reviewed design → routed handoff)

A **thin wrapper**: phase 1 is `superpowers:brainstorming` verbatim; this skill owns only what no upstream piece covers — the cold two-altitude review of the *design itself* (§2) and the routed handoff out of the contour (§3). If you catch yourself re-describing the brainstorm loop or the reviewer protocol here, stop — that is `#parallel-evolution-creep`.

## §0 Invocation & seat

`/arch <topic>` or `/arch <path/to/prep-doc.md>`. Run in a **top-tier session** (relative tiers per [night-mode/SKILL.md](../night-mode/SKILL.md), «Overnight model posture» paragraph — the window slides to the active harness's model set). The operator is a thinking partner, not a ticket author: explore intent before proposing (brainstorming's own discipline).

## §1 Phase 1 — ideate + design (pure reuse)

Invoke `superpowers:brainstorming` AS IS: intent → clarifying questions → 2-3 approaches with trade-offs → design presented section-by-section → spec written and self-reviewed. Its user-review gate stands. Additionally, when the dialogue closes real forks with verdicts, record them with per-verdict falsifiers (H1 discipline) — as a research-patch decision record when the design closes a coverage gap (that folder's charter; established decision-record practice), otherwise inside the spec itself.

## §2 Phase 2 — cold two-altitude design review (delta #1)

Dispatch **two read-only subagents** (Agent tool), each handed ONLY artifact paths (spec / decision record / kickoff draft) — never chat context. Cold by construction: the reviewer that never saw the dialogue cannot inherit its blind spots (Phase -1 cold-review precedent, [CLAUDE.md «Meta-orchestrator self-review obligation»](../../../CLAUDE.md)).

- **Top-down** — `model:` top tier. Question: does the design serve the stated goal; is it feasible; are the architectural choices sound; what did the authors not consider?
- **Bottom-up** — `model:` executor tier. Question: do the named files/APIs/patterns actually exist as claimed; does this assemble from the real bricks; which claims lack file:line evidence?

**Seat instantiation — operator model ladder (fixed 2026-07-23). Relative tiers, not hard-coded model names** (same posture as [night-mode/SKILL.md](../night-mode/SKILL.md) «Overnight model posture» — the window slides to whatever the active harness offers): the contour runs a three-role ladder — *top tier designs · mid tier verifies · executor tier builds*. When the authoring session itself occupies the top tier, BOTH §2 review seats default to the **mid tier** (Claude today: Fable authors → Opus reviews; on a harness without a third tier the seats collapse to a fresh-context same-tier second opinion, per night-mode's degradation rule). Rationale: a cold review's power is cold-by-construction (artifact-only input, no authoring dialogue), not the reviewer's tier — and top-tier tokens are not spent on volume verification. The **executor tier** side of the ladder is owned by [CLAUDE.md «Task-tier routing»](../../../CLAUDE.md), not this skill. The operator may explicitly request a top-tier review seat for an unusually hard design.

Both report in the **verdict grammar this skill's dispatch prompts specify** (owned here — it is the prompt contract, not a protocol restatement): `VERDICT: GO | REVISE | STOP`, findings graded `BLOCKER | MAJOR | MINOR`, each with file:line evidence. The operator's global `/reviewer` command speaks the same grammar, so manual `/reviewer` sessions with a model switch remain a legal substitute for either seat. Reviewer ROLE discipline — surface findings and forks, never decide strategy — is owned by [reviewer-discipline.md](../../rules/reviewer-discipline.md); dispatch prompts point there for role bounds. Iterate design → review to GO; cap **2** REVISE rounds, then surface the disagreement to the operator as a genuine fork (park-vs-proceed spirit).

## §3 Phase 3 — exit routing (delta #2)

Two decisions, in order — this is the contour's boundary:

**Decision 1 — factory or in-session?** A senior judgment this skill owns (it is NOT part of the CLAUDE.md tier table, which governs only the factory path). Factory is the **default** for bulky work. Keep it in-session when the work needs the operator in the loop as it unfolds (discipline-bearing authoring, live design iteration), touches surfaces the factory cannot write (agent-uncommittable globals), or the contour itself produced it small enough to finish here.

**Decision 2 — route:**

| Path | Route |
|---|---|
| factory-bound | classify Tier 1 vs Tier 2 per [CLAUDE.md «Task-tier routing»](../../../CLAUDE.md) and author the kickoff accordingly (traps section per principle 12; the Tier-1 profile marker per that table) → merge to **staging** ([kickoff-staging-placement.md](../../rules/kickoff-staging-placement.md)) → multi-stage umbrella → [/pipeline](../pipeline/SKILL.md); single task → `<!-- bridge: auto -->` first line (runtime-bridge dispatches it) |
| in-session | continue the native superpowers tail: `writing-plans` → `subagent-driven-development` |
| tiny (Tier 0, ≤~5 lines / 1 file) | just make the edit; no artifacts |

## §4 Escalation intake (the contour's return edge)

Factory tasks park questions (runtime-bridge `park`/`answer`). Sweep them in batch from a top-tier session («office hours»): in-scope architecture questions → the senior-executor seat answers; intent/goal/creative questions — and anything the senior seat is unsure about — → the top seat. Route by question class, not by a fixed hop chain.

## Without this skill

Each contour is re-improvised: the operator manually switches models per phase (6× `/model` in the origin session, 2026-07-21) and re-asks «how do I start this»; the design itself gets no cold review at either altitude, so plausible-but-wrong designs reach the factory where rework is most expensive; and the handoff decision (kickoff vs in-session) is re-derived from memory against no criteria — the exact re-invention the task-tier table was written to end.

## With this skill

One entry point runs the whole contour in one top-tier session: brainstorming unchanged, then two cold reviewers at fixed altitudes gate the design before any implementation spend, then the exit is routed by the recorded tier criteria — the handoff artifact (kickoff on staging, or an in-session plan) lands exactly where the next contour expects it, and parked factory questions flow back to the right seat in batch.

## See also

- `superpowers:brainstorming` — the wrapped phase-1 engine (ADOPT; its spec self-review + user gate stand unchanged; verified absent from upstream through v6.1.1: no design-review skill exists there, 2026-07-21).
- [reviewer-discipline.md](../../rules/reviewer-discipline.md) — reviewer ROLE discipline both §2 seats point to (surface, never decide).
- [CLAUDE.md «Task-tier routing»](../../../CLAUDE.md) — the §3 factory-path classification criteria (fixed, judgment-applied).
- [pipeline/SKILL.md](../pipeline/SKILL.md) — the internal-contour entry `/arch` hands umbrellas to.
- [night-mode/SKILL.md](../night-mode/SKILL.md) — relative-tier posture, «Overnight model posture» paragraph (tier→model instantiation SSOT).
- `packages/runtime-bridge` — `bridge: auto` + `bridge-profile` markers (kickoff.ts), park/answer CLI.
