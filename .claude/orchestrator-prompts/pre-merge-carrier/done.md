# pre-merge-carrier — DONE

- Final PR: #1475
- Closed: 2026-08-18
- Summary: S0 (the one and only stage) shipped the design spec + prior-art SSOT rows #259-#263; the build work is a separate umbrella the spec's §(g) declares.

## What landed

- [`docs/superpowers/specs/2026-08-18-pre-merge-carrier-design.md`](../../../docs/superpowers/specs/2026-08-18-pre-merge-carrier-design.md) — sections (a)-(g), the falsifier record, and three open forks.
- [`docs/meta-factory/prior-art-evaluations.md`](../../../docs/meta-factory/prior-art-evaluations.md) rows **#259-#263** (merge-tree DEFER · merge queue REJECT · nektos/act REJECT · jjq DEFER · timeliner reference ADAPT), plus a `Last reviewed` touch on #176.

Host acceptance (kickoff §4) re-verified on `origin/staging` after the squash: spec present, 5 `pre-merge-carrier` hits in the SSOT (0 before), falsifier section present.

## Cold-review record

- T19 own adversarial review — round 1 REVISE, two MAJORs, both fixed before handoff: the lane population was **seven** shipped lanes, not four (three UI presets ship `github-actions-ci-ui.yml` as the consumer's `ci.yml` via `setup.d/40-configs.sh:399/414/437`), and a whole-file prettier pass had violated the SSOT's append-only contract (reverted; the diff ended at +7/-1 on that file).
- `agents/fidelity-auditor.md` — **FIDELITY: GO**, round 2, `Audited-SHA: 06212cfdc907adf21e5fc697ae846837cfe812ce`, zero missing/extra/diverged. Watch-list W-1..W-6 lives in the PR body's `## Review findings`; **W-1 / W-2 / W-3 are the ones a build stage must not undo** (gate the merge result; #1465 riders stay in B1; opt-in only).

## Routed onward — read before opening the build umbrella

1. **Three DECISION-NEEDED forks are open and are the operator's** (spec §i): F1 delivery depth (all profiles vs env+), F2 head-already-contains-base (proceed reporting `merge = head` vs die like the reference), F3 NOT-COVERED policy (report-only vs hard-require). B1 cannot be dispatched without F1 and F2 answered.
2. **A kickoff-level contradiction is recorded, not resolved** (`KICKOFF-AMBIGUOUS`, round 1): §1 row 2(d) conditions the waiter third state on «where a shipped waiter surface exists», while §2 binds the #1465 riders to the same change. Measured: no shipped surface reads GitHub checks at all (0 files match `gh pr checks|statusCheckRollup|check-runs|checkSuites` over the shipped tree). The spec resolves toward §2 — a new `ci-available-probe.sh` — and says so explicitly. That routes to re-design if the operator disagrees, not to rework.
3. **Unmeasured claim carried forward:** golangci-lint cache staleness is marked `INCONCLUSIVE-needs-verification` in §b.1 and must be verified in B2, not assumed.
4. **Method note worth keeping:** the round-1 «`packages/core/templates/react-next/` is EMPTY, `ls` → 0 entries» claim was false — `ls` hides dot-entries (`.storybook/`). The census that holds is `find . -name "github-actions-ci*.yml"` → exactly 7. A negative existence claim proved by bare `ls` is not proved.

## Not done here (by design — kickoff §9 anti-scope)

No carrier script, no `setup.d/` wiring, no CI-template change. Those are B1/B2 in the follow-on umbrella, and they are capability commits: their `Prior-art:` trailers cite #259-#263, which this stage exists to have produced.
