# skill-harmonization-mechanisms — DONE

- Final PR: #1468
- Closed: 2026-08-18
- Summary: all three build stages of the operator-axis harmonization tail merged — S1 CONTEXT.md pointer-rule principle test (#1464, spec §5.2), S2 two-phase claim machinery with the widened in-flight probe (#1467, §5.3), S3 mechanical dependency frontier from the incumbent `Depends on` column + slicing/fog-of-war vocabulary (#1468, §5.4 / D-H13).

## Stage record

| Stage | PR | Squash | Notes |
| --- | --- | --- | --- |
| S1 anchors | [#1464](https://github.com/artyhoo/getff/pull/1464) | `6152aba3f1` | principle 42 — every CONTEXT.md pointer resolves to a file AND an anchor; skips cleanly while no CONTEXT.md exists |
| S2 claim | [#1467](https://github.com/artyhoo/getff/pull/1467) | `8b884603b2` | runtime-bridge claim/unpause split + `/pipeline` Step 3 reorder + probe claim signal + orphan expiry; `references/claim-machinery.md` + `references/stage-gates.md` added |
| S3 frontier | [#1468](https://github.com/artyhoo/getff/pull/1468) | `4b3912c199` | `helpers/frontier.sh` + `references/frontier.md` + 24-arm paired negative; `meta-kickoff.template.md` §2a vocabulary + `{{FOG_OF_WAR}}` |

Stages were mutually independent (`Depends on: —` for all three), dispatched in parallel with
worktree isolation, and S3 merge-forwarded over S1+S2 (`.claude/rules/git-conflict-merge-forward.md` §2).

## Routed onward — NOT closed by this umbrella

Surfaced by S3's two PR-blind cold seats; all are outside the three ratified stage scopes and
were deliberately left as observations rather than drive-by edits (CLAUDE.md `PR strategy`).
The operator routed them to a follow-up session on 2026-08-18:

1. **`/dispatcher` §2.7 + `night-mode` advance stages without reading the frontier** — `grep -rln frontier .claude/skills/` hits only `pipeline/` and `arch/`. These are the surfaces that actually advance stages autonomously, and `night-mode/SKILL.md` delegates stage-gate mechanics to `dispatcher` §2. Operator called this the weightiest residue.
2. **Third spelling of the same edge** — `orchestrator/references/queue-mode.md:72` («predecessor GO?») + `:251` (`ESCALATE:K:blocked-by-prerequisite`), plus 6 `**Prerequisite:**` kickoff lines.
3. **`Blocked-by:` in the unratified prep-doc** `docs/superpowers/specs/2026-08-17-arch-prep-skill-stack-harmonization.md:347` — no supersession pointer in its header. (The RATIFIED spec's stale `§3` label was fixed in #1468's second commit.)
4. **Pre-existing stale count claim** — `.claude/skills/pipeline/references/failures.md:1,3` says «F1 through F8» while the table carries nine rows (F9 at `:18`).
5. **Template↔registry reconciliation is still bare attention** — `SKILL.md` §4 Step 2 leaves the `comm -23` between the templates and `references/placeholders.md` to «the maintainer's responsibility»; principles 27/38/41 are the channel precedent for exactly this shape.
6. **`evals/` has zero scenarios for the frontier** — `evals/files/scenario-2-named-state.md:57-62` states dependencies in prose.
7. **Coverage limit, documented not fixed** — 29 `kickoff-s<N>.md` files across 7 umbrellas keep stages outside `kickoff.md`, so those umbrellas resolve to `DEGRADE` (`references/frontier.md` ceiling 6).

## Open residue from the parent spec (not this umbrella's scope)

- §8 item 1 — the attended `/setup-matt-pocock-skills` run that creates the first `CONTEXT.md` (S1's principle test skips until it exists).
- §8 item 6 — D-H18 consumer-axis satellite harmonization, its own design contour.
- D-H7 misroute counter stays ARMED on SSOT #253; a live misroute triggers the D-H8 ladder.
