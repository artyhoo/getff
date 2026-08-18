# KICKOFF — frontier-residue-sweep (stage-ordering vocabulary + registry-claim residue)

> **Type:** multi-stage umbrella (factory-internal; authored 2026-08-18 at the close of
> `skill-harmonization-mechanisms`, by operator routing).
> **Origin:** the seven observations S3's two PR-blind cold seats surfaced OUTSIDE the ratified
> stage scopes — recorded verbatim at
> [`skill-harmonization-mechanisms/done.md`](../skill-harmonization-mechanisms/done.md)
> «Routed onward». The operator called item 1 «the weightiest residue».
> **Base branch:** staging (NOT main).
> **Rigor label (effort-worthiness L0):** `build-and-verify` — every item is factory-internal
> and reversible; each carries a live RED/GREEN or a measured before/after.
> **Prior-art:** the mechanism these items extend is already built and ratified — spec §5.4 /
> D-H13, shipped as `.claude/skills/pipeline/helpers/frontier.sh` (PR #1468). No new capability
> is proposed by S1-S3; S4/S5 are judgment calls that MUST run the BFR consult before proposing
> a gate.

## §0 Read first, in order

1. This kickoff.
2. [`skill-harmonization-mechanisms/done.md`](../skill-harmonization-mechanisms/done.md) — the
   seven items with file:line anchors, plus what the umbrella deliberately did not close.
3. [`.claude/skills/pipeline/references/frontier.md`](../../skills/pipeline/references/frontier.md)
   — the shipped grammar, the done-basis layers, the 7 ceilings, and the measured calibration.
   **Read the ceilings before proposing anything**: several "gaps" are documented, deliberate
   limits, not oversights.
4. [`.claude/rules/attention-is-not-a-mechanism.md §1`](../../rules/attention-is-not-a-mechanism.md)
   — the rule every item below is an instance of.

## §1 Deliverables

| Stage | Deliverable | Depends on |
| --- | --- | --- |
| S1 executors | **The weightiest item (operator, 2026-08-18).** `/dispatcher` §2.7 «Advance» and `night-mode` pick the next stage by eye — `grep -rln frontier .claude/skills/` hits only `pipeline/` and `arch/`, and `night-mode/SKILL.md:35` delegates stage-gate mechanics to `dispatcher` §2. Wire the frontier read into the surface that actually advances stages autonomously. Bindings, not a fork of the helper. Live proof required: a dispatcher-path run whose stage choice is traceable to a `FRONTIER:` line | — |
| S2 spellings | Retire the third and fourth spellings of the SAME edge: `orchestrator/references/queue-mode.md:72` («predecessor GO?») + `:251` (`ESCALATE:K:blocked-by-prerequisite`), the 6 `**Prerequisite:**` kickoff lines, and the unratified prep-doc `docs/superpowers/specs/2026-08-17-arch-prep-skill-stack-harmonization.md:347` (`Blocked-by:` with no supersession pointer in its header). D-H13 allows exactly one spelling; converting the 11 prose-edge kickoffs to the column belongs here too (`frontier.md` ceiling 5) | — |
| S3 stale claims | Two pre-existing false count claims in shipped docs: `.claude/skills/pipeline/references/failures.md:1,3` says «F1 through F8» over a nine-row table (F9 at `:18`); and the 27-of-275 `done.md` files carrying no `- Final PR: #` line (measured 2026-08-18, PR #1470 §1.7 backward-check — a `done_pr` metadata gap, NOT a detection failure, since Layer C3 tags DONE on existence: `priority-score.sh:255`) | — |
| S4 registry gate | `SKILL.md` §4 Step 2 leaves the template↔`references/placeholders.md` `comm -23` reconciliation to «the maintainer's responsibility» — a mechanically checkable claim on bare attention. Channel precedent: principles 27/38/41 (three existing «two lists nobody reconciles» gates). **Decide, do not assume**: run the BFR consult first; a paired-negative principle test is the expected shape, «leave as prose» is a legitimate outcome if argued | — |
| S5 evals | `/pipeline` evals carry zero scenarios for the frontier (`evals/files/scenario-2-named-state.md:57-62` states deps in prose). Add coverage OR argue on the merits that the 24-arm paired negative already carries the contract and evals should stay judgment-only | S1 (its output shape is what an eval would grade) |

Stages S1-S4 are mutually independent — parallel dispatch allowed with worktree isolation.

## §2 Binding constraints (do not re-derive)

- **Never introduce a second spelling.** The edge is `Depends on` in the stage table; S2 removes
  competitors, it does not add a synonym (D-H13, `#parallel-evolution-creep`).
- **Do not fork `frontier.sh`.** `/dispatcher` and `night-mode` consume its output; the helper
  stays a single emitter with one owner (`/pipeline`).
- **`done=yes basis=marker-unverified` is not a merge proof** — any executor wiring MUST keep the
  §6 `gh pr list --search "is:merged … base:staging"` check as the authority and feed its verdict
  back via `MO_FRONTIER_DONE` / `MO_FRONTIER_OPEN`. A wiring that dispatches on the marker read
  alone re-opens the exact false-green class S3's cold review closed.
- **Respect the documented ceilings.** `frontier.md` §6 items 1-7 are measured limits with
  falsifiers, including one deliberately surrendered true positive (arch-v2 S-D′). Changing one
  means re-measuring, not just editing prose.
- **`.claude/skills/pipeline/SKILL.md` sits at 599 lines** against a hard `>600` pre-commit gate.
  Any addition is in-place or routes to `references/`.
- Shipped-file edits (`.claude/skills/**`, `templates/**`) require deliberate baseline
  regeneration (`SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`) with the diff reviewed
  before committing.

## §3 AI-traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active: **T2** (designing ≠ auditing — a binding paragraph is not a wiring; show the run),
**T3** (every finding carries command output or file:line), **T14** (clean read ≠ proof — S3's
counts are measured, re-measure rather than trusting these numbers months later), **T19** (own
cold review of the diff before handoff), **T21** (delegate the backward sweep to a cold seat and
hand it the CLASS, never the diff — that is precisely what surfaced all seven items).

Domain-specific:

- **T-FRS-A** — declaring S1 done because a binding paragraph was added to `dispatcher/SKILL.md`.
  The failure mode being fixed is «the executor never reads the frontier»; proof is an actual
  dispatch-path run whose stage choice traces to a `FRONTIER:` line, not prose that says it should.
- **T-FRS-B** — treating a documented ceiling as a bug and "fixing" it into a false green. Before
  changing any layer, read its falsifier in `frontier.md` and re-run the measurement that set it.

## §4 Stage gates + host acceptance

One stage = one executor session. Run
`SLUG=frontier-residue-sweep bash .claude/skills/dispatcher/helpers/probe-inflight.sh` before every
dispatch; Phase -1 cold review between stages.

```host-verify
npx vitest run --root packages/core hooks/frontier.test.ts
npx vitest run --root packages/core principles/
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
bash scripts/check-skill-drift.sh
```

## §5 See also

- [Operator-axis spec §5.4 + §4 D-H13](../../../docs/superpowers/specs/2026-08-18-skill-stack-harmonization-design.md) — the ratified decision these items extend.
- [`skill-harmonization-mechanisms/done.md`](../skill-harmonization-mechanisms/done.md) — the source list with anchors.
- PR [#1468](https://github.com/artyhoo/getff/pull/1468) — the S3 build, its two cold reviews, and the nine regression arms.
