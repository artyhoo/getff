# KICKOFF — skill-harmonization-mechanisms (operator-axis build tail)

> **Type:** multi-stage umbrella (factory-bound; authored at round-3 exit routing,
> 2026-08-18).
> **Origin:** [operator-axis spec](../../../docs/superpowers/specs/2026-08-18-skill-stack-harmonization-design.md)
> §8 item 3 — v4 state: the §5.1 script/`--check`/wizard items are DISSOLVED (round 3
> replaced the prune with CLAUDE.md bindings, already landed in-session); what remains
> to build is §5.2 + §5.3 + §5.4.
> **Base branch:** staging (NOT main). NOTE: this kickoff lands on staging together
> with the harmonization spec branch `claude/festive-shtern-0e0296` when the operator
> lifts the PR pause — do not dispatch before that merge.
> **Prior-art (EXECUTION-PLAN §5.5 Step 1.5):** spent at design time — spec §4
> D-H5/D-H11/D-H13 with per-decision falsifiers; §5.2's non-duplication verified
> round-1 (the lychee gate runs without `--include-fragments`, so anchors are
> unchecked today); §5.3 reuses the existing aif REST surface
> (`AifHandoffBackend.ts` paused-create + DELETE) — no new dependency anywhere.

## §1 Deliverables (3 stages)

| Stage | Deliverable | Depends on |
| --- | --- | --- |
| S1 anchors | §5.2 CONTEXT.md pointer-rule principle test (mold of principles 08/09): every CONTEXT.md link resolves to an existing anchor; a term with an owner doc carries gist+link, never a redefinition. MUST skip cleanly while no CONTEXT.md exists (the attended `/setup-matt-pocock-skills` run that creates it is a separate operator item — spec §8 item 1). Paired negative required | — |
| S2 claim | §5.3 claim machinery, four parts IN ORDER: (1) split runtime-bridge dispatch into claim-create (`paused:true`) and unpause halves (`AifHandoffBackend.ts:236→260`, CLI today has no create-only mode); (2) reorder `/pipeline` Step 3 around them (unpause on Phase -1 GO; `DELETE /tasks/:id` on RED — the call exists, `AifHandoffBackend.ts:263`); (3) widen `probe-inflight.sh` with a claim signal — its jq filter (`probe-inflight.sh:146-147`) selects only `done|verified` tasks with a branch, so a fresh paused claim is invisible to ALL five existing signals; (4) orphan-claim expiry → `STALE-CLAIM`, never an eternal block. Live RED/GREEN proof closes probe P4 (spec §6) | — |
| S3 frontier | §5.4: `/pipeline` derives the dispatchable frontier mechanically from the incumbent `Depends on` column (14 tracked kickoffs already carry it); kickoffs without the column degrade safely (every not-yet-done stage is frontier). Vocabulary (vertical-slice, expand–contract, fog-of-war) lands in `meta-kickoff.template.md` — no `kickoff.template.md` exists (B-M6) | — |

Stages are mutually independent — parallel dispatch allowed with worktree isolation;
S2's four parts are strictly sequential inside the stage.

## §2 Binding constraints (from the ratified registers — do not re-derive)

- S2 is NOT a prose «dispatcher step reorder» — it is the three-owner machinery
  (runtime-bridge + `/pipeline` + dispatcher probe), spec §5.3 verbatim (B-M1/B-M2).
- No second status vocabulary: `state.md` stays the journal, claims live in the aif
  queue (P-5, D-H5).
- No `Blocked-by:` spelling — the incumbent `Depends on` column is the standard
  (D-H13, `#parallel-evolution-creep` guard).
- `meta-kickoff.template.md` is a shipped file (env profile) — after any S3 template
  edit the install baselines MUST be regenerated deliberately
  (`SNAPSHOT_MODE=capture`), with the diff reviewed first (round-3 R1 precedent: an
  unreviewed template edit turned 8 fingerprints stale).
- §1.7 PR-body mandate applies (targets touch `packages/core/principles/**`,
  `.claude/skills/**`, `packages/runtime-bridge/**`).

## §3 AI-traps (per [.claude/rules/ai-laziness-traps.md §3](../../rules/ai-laziness-traps.md))

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md) for the
full catalogue. Active traps for this umbrella: T2, T3, T19, T21.

Domain-specific:

- **T-SHM-A** — declaring the claim signal done after adding it to `probe-inflight.sh`
  without proving it from EVERY dispatch entry point (host branch, container branch,
  PR, live queue): probe P4 closes only with the live RED-on-paused-claim /
  GREEN-after-cancel proof (spec §6 P4), not with the code merge.
- **T-SHM-B** — S1's test written against an imagined CONTEXT.md shape: the file does
  not exist yet; the test must be authored against the pointer-RULE (spec §5.2) with a
  fixture CONTEXT.md, and skip (not pass vacuously green) when the real file is absent
  — a vacuous pass is `#discipline-theatre`.

## §4 Stage gates + host acceptance

One stage = one executor session; run
`SLUG=skill-harmonization-mechanisms bash .claude/skills/dispatcher/helpers/probe-inflight.sh`
before every dispatch. Phase -1 cold review between stages.

```host-verify
npx vitest run packages/core/principles/ -t "context"
bash .claude/skills/dispatcher/helpers/probe-inflight.sh
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
```

(S1 gate green on host; S2's claim signal visible to the host-run probe — the RED/GREEN
proof runs against the live aif queue from the host; S3's template edit accounted for in
the baselines.)

## §5 See also

- [Operator-axis spec](../../../docs/superpowers/specs/2026-08-18-skill-stack-harmonization-design.md) §5.2-§5.4 + §6 P4 — the SSOT for every decision above.
- [CLAUDE.md «Pre-dispatch in-flight probe»](../../../CLAUDE.md) — the race this machinery closes.
- [.claude/skills/pipeline/SKILL.md](../../skills/pipeline/SKILL.md) — Step 3 owner.
