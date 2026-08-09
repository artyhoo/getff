---
description: Seat lifecycle protocol (SLP) — birth, work, self-cleaning, retirement for registry-role seat sessions
paths:
  - ".claude/skills/arch/SKILL.md"
  - ".claude/skills/pipeline/SKILL.md"
  - ".claude/skills/dispatcher/SKILL.md"
  - ".claude/skills/night-mode/SKILL.md"
---

# Seat lifecycle protocol (SLP) — one SSOT, four pointers

> **Class:** B — the compensating mechanism ships in the same PR: the all-four-carry-the-pointer
> grep check ([packages/core/skills/seat-lifecycle-pointer.test.ts](../../packages/core/skills/seat-lifecycle-pointer.test.ts))
> asserts every SKILL.md named in `paths:` above links here. Channel: `paths:` frontmatter
> ([principle 31](../../packages/core/principles/31-rule-channel-declaration.ts) branch (a) —
> read-time load on matching work; no edit-time inject). Promotion criterion in §3.
> **Fires:** seat birth, self-cleaning handoff, or retirement in a seat session.
> **Authoritative for:** the lifecycle SEQUENCE only — §1 the four phases, which settled
> mechanism each phase reuses, and which steps are Part-II-gated; §2 anti-patterns; §3
> promotion / retirement.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists).
> Every mechanism this file sequences is OWNED elsewhere: context-arm trigger — ADR D7
> ([2026-08-09-pipeline-chips-session-bus-design.md](../../docs/superpowers/specs/2026-08-09-pipeline-chips-session-bus-design.md));
> thresholds + residue discipline + tail classifier — ADR D6; PreCompact state preservation —
> ADR D8; registry files, addressing, OFF tombstone — [session-bus v2 §6/§9](../../docs/superpowers/specs/2026-08-09-session-bus-v2.md)
> (Part II, probe-gated); night policy SSOT + morning report — [night-mode/SKILL.md](../skills/night-mode/SKILL.md);
> the implement→review loop — `superpowers:subagent-driven-development`; handoff-vs-compact
> cost preference — the «Re-write-trigger economy» blocks in [dispatcher/SKILL.md](../skills/dispatcher/SKILL.md)
> and [harvest/SKILL.md](../skills/harvest/SKILL.md); the night MODE decision + ceiling —
> [autonomous-night v3 §2/§6](../../docs/superpowers/specs/2026-08-09-autonomous-night-v3-design.md).

> **Origin:** 2026-08-09 autonomous-night v3 design (D-v3.2, [spec §3](../../docs/superpowers/specs/2026-08-09-autonomous-night-v3-design.md)).
> The four seat skills carried divergent (or absent) birth/cleanup/retirement prose —
> `#parallel-evolution-creep`. Empirical base: the design contour's own lineage — 2/2
> manual artifact-first handoffs (ADR contour → v2 membrane session → v3 session), each
> successor born cold from a handoff artifact and continuing without loss; the SLP
> formalizes exactly that observed cycle.

## §1 The four phases (each REUSES a settled mechanism — this file sequences, never re-describes)

«Seat» here = a REGISTRY ROLE: a long-lived role-bearing session with a session-bus v2 §6
role file. Exactly three roles — arch, pipeline, dispatcher; night is a MODE existing seats
enter, never a fourth role ([v3 §2](../../docs/superpowers/specs/2026-08-09-autonomous-night-v3-design.md)).
The review-altitude «seats» of arch §2 and the audit «seats» of
[cold-seat-economy.md](cold-seat-economy.md) are different usages — the SLP binds only
registry roles. Steps marked PART-II-GATED activate only when the session-bus Part-II
probes (P1/F4/P4) land; until then they are inert, not improvised.

1. **Birth.** NOW: the spawn prompt assigns the role; the first turn verifies an isolated
   worktree — repo-root sessions are ineligible as seats (owner: session-bus v2 §6
   corollary; background for the parallel-session class:
   [parallel-subwave-isolation.md §1](parallel-subwave-isolation.md)). PART-II-GATED:
   seat-file write gated by the OFF tombstone (v2 §9) + courtesy `REBIND` on role takeover
   (v2 §6).
2. **Work.** The seat's own skill. At night, the seat-class item mapping applies
   ([night-mode/SKILL.md](../skills/night-mode/SKILL.md) «Seat-class item mapping»).
3. **Self-cleaning.** Trigger and thresholds are OWNED elsewhere and only BOUND here: the
   D7 context-arm measures (stage S2a ships the trigger; v3 ships only this consuming
   policy), D6 owns thresholds + the mechanical-vs-judgment tail classifier, and the
   continuation ladder is v2 §4 — day: continuation chip when `spawn_task` is invocable,
   else the paste 1-liner; night: F4-positive → CLI-spawned fresh successor carrying the
   context package, F4-negative → auto-compact in place with the T_soft defer floor. Break
   at stage boundaries, never mid-harvest (D6). Handoff-vs-compact cost preference: the
   «Re-write-trigger economy» blocks (header owners list).
4. **Retirement.** NOW: artifact handoff — D6 residue discipline; nothing load-bearing
   lives only in working memory (v2 §4 rung 1). At NIGHT-END (terminal, not mid-night) the
   closing seat writes the morning report and emits the night-end chip
   ([night-mode/SKILL.md](../skills/night-mode/SKILL.md) terminal condition; v3 §7);
   mid-night successors inherit the mandate and emit nothing. PART-II-GATED: successor's
   seat-file overwrite (last-writer-wins, v2 §6).

## §2 Anti-patterns

- **`#fifth-description-of-the-loop`** — this file (or a skill's pointer block) growing
  operational detail an owner already carries. Counter: the header owners list; pointer
  blocks in the four skills stay 3–5 lines, never a restatement.
- **`#lifecycle-phase-skipped`** — a live seat skipping a phase (e.g. retiring with no
  residue artifact, or a night birth outside an isolated worktree). Counter: the pointer
  keeps the protocol in-context on matching work; ≥2 incidents → §3 promotion.
- **`#normative-now-from-parked-machinery`** — treating a PART-II-GATED step as live before
  its probe lands. Counter: §1 gating labels; v2 §9 degradation matrix is the honest state.

## §3 Promotion / retirement

- **Promotion:** ≥2 documented incidents in 6 months of a lifecycle phase silently skipped
  by a live seat → promote the grep check to a principle test
  ([v3 §3](../../docs/superpowers/specs/2026-08-09-autonomous-night-v3-design.md)).
- **Retirement:** 12 consecutive incident-free months → archive to prose in
  [CLAUDE.md](../../CLAUDE.md). Peer criteria: [reviewer-discipline.md §4](reviewer-discipline.md).

## §4 §1.7 self-reflexive note

- **Forward-check:** complies with [rule-enforcement-channel-selection.md §1/§3](rule-enforcement-channel-selection.md)
  (judgment-shaped sequencing → read-time load at the narrowest reliable trigger — the four
  seat skills; the mechanically-checkable half — pointer presence — is a deterministic
  vitest grep); [no-paid-llm-in-ci.md](no-paid-llm-in-ci.md) (zero API calls);
  [doc-authority-hierarchy.md §2-§3](doc-authority-hierarchy.md) (Class + Authoritative-for
  header); [build-first-reuse-default.md](build-first-reuse-default.md) (REUSE — zero new
  mechanisms: every phase binds an existing owner; the only new artifacts are this file, four
  3–5-line pointer blocks, and one test).
- **Backward-check:** class of this change = *artifacts owning seat/session lifecycle
  prose*. Enumerated (grep `retirement|handoff|self-clean|seat` over `.claude/skills/**`,
  `.claude/rules/**`): dispatcher/harvest re-write-trigger blocks — CITED as cost owner,
  not superseded; [cold-seat-economy.md](cold-seat-economy.md) — different «seat» usage,
  terminology note added here; night-mode terminal condition — EXTENDED (v3 §10.5, same
  PR); session-bus v2 §4 ladder — BOUND as owner. No surface superseded.

## See also

- [autonomous-night v3 design](../../docs/superpowers/specs/2026-08-09-autonomous-night-v3-design.md) — §3 D-v3.2 (this protocol's design record), §4 ladder binding, §7 night-end chip.
- [session-bus v2](../../docs/superpowers/specs/2026-08-09-session-bus-v2.md) — §4 continuation ladder, §6 registry, §9 kill-switch/degradation.
- [packages/core/skills/seat-lifecycle-pointer.test.ts](../../packages/core/skills/seat-lifecycle-pointer.test.ts) — the Class-B compensating grep check.
- [night-mode/SKILL.md](../skills/night-mode/SKILL.md) — night policy SSOT this protocol binds at phases 2–4.
