<!-- scope: stage-scoped dispatch input — S-D′ of the arch-v2-context-pipeline umbrella (reopened scope, operator override 2026-08-06). NO bridge-profile marker — DELIBERATE: Tier 2 and NOT plan-complete (the subtraction-map authoring is the un-spent design judgment), so the top tier plans in aif per CLAUDE.md Task-tier routing. -->
<!-- host-verify contract lives in §3 (a real contract, not an opt-out). The earlier `host-verify: none` opt-out was retracted 2026-08-06: deliverable 2 edits `agents/*.md`, which shifts install fingerprints, so this stage DOES have an executable arm — see §3. -->

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

`docs/superpowers/specs/*` (the map), `agents/*.md` **EXCEPT the maintainer-owned set** —
`agents/living-docs-auditor.md`, `agents/review-sidecar.md`, `agents/rule-test-author.md` are
read-only for all sessions ([CLAUDE.md `Artifact Ownership Contract`](../../../CLAUDE.md)); a
replacement system prompt that genuinely belongs in one of those files travels as a proposed
diff in the PR body for maintainer handoff, never as a direct edit —
`.claude/rules/*` frontmatter `paths:`
ONLY via maintainer-handoff (proposed diff in PR body — Artifact Ownership Contract),
`.claude/orchestrator-prompts/arch-v2-context-pipeline/calibration.md` (ADR-8 rows),
`docs/meta-factory/prior-art-evaluations.md` (#234 annotation),
`tests/install-sh/*` (snapshot regen only).

## §3 Acceptance

```bash host-verify
bash tests/install-sh/snapshot.sh
```

> The earlier `host-verify: none` opt-out on this file was **wrong** and is retracted:
> deliverable 2 edits `agents/*.md`, which §1 itself notes shifts install fingerprints
> («regen snapshots»). An opt-out on a stage with an executable arm is `#optout-as-reflex`
> ([destination-environment-verification.md §4](../../rules/destination-environment-verification.md)).
> Regen with `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`, then the plain run
> above must pass **on the host**.

Review-time (design stage): every map row carries cost + reach + restoration trigger (a row
missing any of the three is incomplete); baseline rows exist BEFORE the first map merges;
the #234 annotation lands in the same PR; no drop touches a block whose consumer is the aif
executor tier without the §1 priority justification; §0.6 agnosticism — every mechanism names
its non-CC behaviour or documents degradation.

**Deliverable 2 (review-seat agent definitions) — its own criteria, previously absent:** each
shipped `agents/*.md` replacement prompt (a) exists and is named in the map it implements,
(b) carries the reviewer-role boundary + verdict grammar of
[reviewer-discipline.md §2](../../rules/reviewer-discipline.md) (surface strategy forks as
DECISION-NEEDED, never pick), (c) states which currently-loading blocks it drops and what the
seat still receives, (d) touches no file in the maintainer-owned set above, and (e) the install
snapshots were regenerated in the same PR with the host run quoted.

**S-E dependency — TWO gates, not one** (the umbrella models this at
[`../arch-v2-context-pipeline/kickoff.md`](../arch-v2-context-pipeline/kickoff.md) §3): (1)
**merged** — S-E's PR is on `staging`; (2) **content-read** — P11 actually returned a usable
answer. P11 may legitimately land `INCONCLUSIVE` («coverage insufficient» is its honest output
when the probe cannot observe). If it did, this stage's Explore/Plan rows have no evidence
base: say so and descope those rows, do NOT substitute an assumption. Reading «S-E merged» as
sufficient is `#hope-as-gate`.

## §3a Park-don't-guess contract (non-negotiable)

**aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two
defensible implementations, an undecided design choice, a missing spec detail that changes
behaviour) — **do NOT pick.** Park it as a question (set the task to `manualReviewRequired` /
`blocked_external` with the fork stated as «Option A → consequence X / Option B → consequence
Y») and **stop that task.** Proceed only on the unambiguous parts.

Expected to fire here on: **(a)** any drop whose cost S-E's attribution table does not price —
an unpriced drop cannot be ordered against the others (T-SDP-A), so park it rather than
guessing its rank; **(b)** the ZCode population row, when a mechanism has no ZCode equivalent
— «documented degradation» is the decided answer, but if a drop would be *silently* different
there rather than absent, that is a real fork: state both consequences and park; **(c)** any
drop where the restoration trigger has no observable (T-SDP-B) — park instead of writing a
vibe. Never extrapolate a per-seat load figure from an environment you did not measure.

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
