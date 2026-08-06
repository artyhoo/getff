<!-- scope: stage-scoped dispatch input — S-D′ of the arch-v2-context-pipeline umbrella (reopened scope, operator override 2026-08-06). NO bridge-profile marker — DELIBERATE: Tier 2 and NOT plan-complete (the subtraction-map authoring is the un-spent design judgment), so the top tier plans in aif per CLAUDE.md Task-tier routing. -->
<!-- host-verify: none — design-stage deliverables are markdown subtraction maps + agent definitions; the measurable arm is ADR-8's inherited 20-dispatch window, adjudicated at window close by the owner's verdict PR, not by a single host command at acceptance. -->

# arch-v2-context-pipeline S-D′ — per-seat subtraction maps

> **Stage goal:** author WHAT EACH CC SEAT CLASS STOPS LOADING — subtraction, never authored
> per-role ambient content (SSOT #234's DEFER/null stands for the additive scope). **Design
> SSOTs (read both, in full):**
> [`2026-08-06-pipeline-token-economy-design.md`](../../../docs/superpowers/specs/2026-08-06-pipeline-token-economy-design.md)
> — §1.5 (the reopen, its scope line, ADR-8 inheritance), §0.5 (priority ordering), §0.6
> (agnosticism constraint), P13;
> [`2026-07-31-arch-v2-context-pipeline-design.md`](../../../docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md)
> — ADR-8 (the experiment protocol this stage inherits), ADR-1 (L1 sub-axes), ADR-2
> (population-table obligation + C2: a custom subagent's system prompt REPLACES CC's).
> Umbrella context: [`../arch-v2-context-pipeline/kickoff.md`](../arch-v2-context-pipeline/kickoff.md).
>
> **Depends on S-E merged** — consumes the P11 probe (do Explore/Plan load rules?) and the
> N2/P14 attribution numbers as the baseline inputs. Do not dispatch before.

**Base:** `origin/staging`. **Mode:** design + implementation, one PR onto staging.

## §1 Deliverables

1. **Subtraction map document** (one file under `docs/superpowers/specs/`): per CC seat class —
   review subagents · Explore/Plan · senior main seat — which currently-loading blocks are
   dropped, via which native mechanism (agent-definition system-prompt replacement / rule
   channel re-scoping / `claudeMdExcludes`), each drop with: measured resident cost of the
   block, per-population reach incl. the ZCode row (documented degradation where unreachable),
   and a **restoration trigger** (the observable failure that reverses the drop).
2. **Review-seat agent definitions** (`agents/*.md`): replacement system prompts carrying
   reviewer-discipline + verdict grammar instead of the full operational head. Editing
   `agents/*.md` shifts install fingerprints — regen snapshots
   (`SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`).
3. **ADR-8 baseline capture BEFORE any map merges** (calibration ledger rows: token cost per
   dispatched task + review-defect count over the trailing 10 uniform dispatches), then the
   20-dispatch window + deterministic A/B per the inherited protocol; owner named in the PR.
4. **SSOT #234 annotation** (same PR): trigger (a) fired — operator-declared expensive-seat
   budget exhaustion, 2026-08-06 session; verdict text unchanged, annotation appended per the
   row's own protocol.

**Priority (binding, spec §0.5):** expensive CC seats first; aif executor seats deferred —
cheap tokens + the guidance gradient (a weaker executor needs MORE resident instruction);
any executor-side trim must show it does not starve the weaker seat.

**Descopes:** no authored per-role digests (that is the closed additive scope); no budget-gate
work (S-E owns); no CLAUDE.md content trim (S-G owns — this stage may re-scope rule CHANNELS,
not rewrite rule text).

## §2 Permitted files

`docs/superpowers/specs/*` (the map), `agents/*.md`, `.claude/rules/*` frontmatter `paths:`
ONLY via maintainer-handoff (proposed diff in PR body — Artifact Ownership Contract),
`.claude/orchestrator-prompts/arch-v2-context-pipeline/calibration.md` (ADR-8 rows),
`docs/meta-factory/prior-art-evaluations.md` (#234 annotation),
`tests/install-sh/*` (snapshot regen only).

## §3 Acceptance

Review-time (design stage): every map row carries cost + reach + restoration trigger (a row
missing any of the three is incomplete); baseline rows exist BEFORE the first map merges;
the #234 annotation lands in the same PR; no drop touches a block whose consumer is the aif
executor tier without the §1 priority justification; §0.6 agnosticism — every mechanism names
its non-CC behaviour or documents degradation.

## §4 AI-traps

See [`ai-laziness-traps.md §2`](../../rules/ai-laziness-traps.md) (cited per §3 of that rule).
**Active traps for this stage: T2, T3, T13, T15, T16, T20.** T2 — the ADR-8 baseline must be
CAPTURED, not described; T3 — every «block X costs Y» row cites the measurement; T13/T16 —
«C2 replaces the system prompt» is upstream-doc-verified for the CURRENT client version, not
assumed from the ADR; T15 — the map's own residency: the map document is consumed at
dispatch-authoring, never loaded always-on; T20 — no drop without its measured cost quoted.
**T-SDP-A — subtraction-theatre:** dropping blocks nobody measured (feels productive, saves
nothing) while the measured heavy blocks stay resident because dropping them is harder.
Counter: maps are ordered by the S-E attribution table, largest resident block first; a map
that skips a top-3 block states why.
**T-SDP-B — restoration-trigger-as-decoration:** writing «restore if problems occur» as the
trigger. Counter: each trigger names an OBSERVABLE (a failed gate, a review-defect class, a
budget line moving), not a vibe.
