<!-- bridge: skip -->
<!-- host-verify: none — umbrella/dispatch kickoff: it authors no executable deliverable in this repo. The stage's acceptance commands are declared and quoted in kickoff-a1.md §3 (npm build/test probes inside the aif container's aif-handoff worktree, re-run independently by the host at acceptance). -->
# aif-admission-latency — umbrella A kickoff

> **Type:** umbrella kickoff, **factory-dispatched** through aif project `ec817095-89ec-4959-a4c9-34327326df11` (`artyhoo/aif-handoff` — the operator's fork of `lee-to/aif-handoff`, container base `/home/www/aif-handoff`, seeded 2026-09-11 at fork HEAD `d82e466`). `bridge: skip` is load-bearing: this repo's auto-dispatch hook targets the framework's own aif project; the stage task is created on the aif-handoff project explicitly (stage kickoff §6).
> **Spawned by operator dispatch 2026-09-11**, off the back of the same-day admission-latency investigation (host session handoff `HANDOFF-encyclopedia-2026-09-11.md` Part 0): the factory's serialized, cycle-by-cycle backlog admission — confirmed intended upstream design — makes newly dispatched tasks wait for the CURRENT poll cycle to fully drain (all project lanes exit) before anything new is admitted, even when the task's own project has every slot free. Measured live: 90.6 min; DB history shows waits up to 16.3 h. The operator wants the research and the fix contributed back into aif itself.
> **Rigor label (effort-worthiness L0):** `build-and-verify` — the stage ships code + tests and an upstream-facing issue text; a wrong fix here would be proposed to an external project.

## §0 Goal

Turn the pinned investigation into an upstream-ready contribution on the operator's fork:

1. **Research artifact** — an upstream-grade GitHub issue text (English) documenting the serialized-admission latency: mechanism with `file:line` anchors, the pinned empirical data, candidate designs with trade-offs.
2. **Fix** — a branch implementing mid-cycle admission (a backlog task on a parallel project with free slots starts processing within one poll interval while another project's lane is mid-pass), with a regression test proving the outcome.
3. **Everything harvested by the host** — the worker never pushes; the operator decides whether/when to open the upstream issue and PR.

## §1 Stage table

| Stage | Shape | Type | Gate out |
| --- | --- | --- | --- |
| A1 — research issue + mid-cycle admission fix | ONE aif task on project `ec817095` | code + tests + issue text in the fork repo | build + tests green; regression test proves the outcome; issue text complete; report GREEN |

Single stage — no E-style family split. The stage kickoff is [`kickoff-a1.md`](kickoff-a1.md).

## §2 Floors (umbrella-level)

- **No pushes, no PRs, no GitHub operations from the task** — the container has no GitHub egress by design; the host harvests the branch and the operator submits upstream.
- **No operations on the RUNNING factory** — the task works in its own worktree of `/home/www/aif-handoff`; it never restarts, kills, or reconfigures the live aif containers/processes. Deployment of the fix is the operator's decision, after harvest.
- **Upstream-first shape** — the patch and issue must follow `lee-to/aif-handoff` conventions (read `CONTRIBUTING.md`, `CHANGELOG.md`, existing test patterns in the fork): the goal is a contribution the upstream maintainer can accept, not a private divergence.
- **The factory-of-factories / second-instance mitigation is OUT of scope** — that is the operator's separate infrastructure decision; this umbrella only prepares the upstream fix.

## §3 Umbrella traps ([.claude/rules/ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md))

Active traps at umbrella level: **T2, T7, T12, T19** (the stage carries its full list in
[`kickoff-a1.md`](kickoff-a1.md) §5).

- **T2** — the umbrella's "fix designed" claim is auditable only through A1's §3 gate table: run rows, not descriptions.
- **T7** — the umbrella-level counter-prompt: "what would make this contribution look upstream-ready when it is not?" (private divergences, untested outcomes, anchors not re-verified).
- **T12** — every research-payload number in the stage kickoff is pinned from the 2026-09-11 investigation; the stage re-derives nothing from memory, and neither does this umbrella.
- **T19** — the host's acceptance pass is a cold pass over the harvested branch before anything is proposed upstream.
