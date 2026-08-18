# pre-merge-carrier — build-umbrella handoff

> **Status:** handoff note for the session that opens the build umbrella. NOT a kickoff —
> the kickoff is the artefact that session must author, after §1 is answered.
> **Date:** 2026-08-18.
> **Authoritative for:** the state of play between the merged S0 design and the first build
> dispatch — §1 the four decisions the operator owns, §2 the ordered path from decision to
> dispatch, §3 the measured aif-fitness probes, §4 constraints that must survive into B1.
> **NOT authoritative for:** the design itself — see
> [the S0 spec](2026-08-18-pre-merge-carrier-design.md). Ratified constraints —
> [the umbrella kickoff §2](../../../.claude/orchestrator-prompts/pre-merge-carrier/kickoff.md).
> Project goal — [README.md#why-this-exists](../../../README.md#why-this-exists).

## §0 Where things stand

S0 is merged and its umbrella is closed. Nothing is in flight.

| Artefact            | State                                                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design spec         | [`docs/superpowers/specs/2026-08-18-pre-merge-carrier-design.md`](2026-08-18-pre-merge-carrier-design.md) — merged, PR #1475 (squash `d676867988`) |
| SSOT rows #259-#263 | merged in the same PR; `Last reviewed` touched on #176                                                                                             |
| Umbrella closure    | `done.md` for the umbrella + its meta-launch record, PR #1476 (squash `b47edee38a`)                                                                |
| Cold audit          | `agents/fidelity-auditor.md` — **GO**, round 2, `Audited-SHA 06212cfdc9`, zero drift; watch-list in #1475's `## Review findings`                   |
| Build umbrella      | **does not exist yet** — no kickoff, no branch, no dispatch                                                                                        |

## §1 The four decisions (operator-owned — B1 cannot be dispatched without 1 and 2)

Each carries the spec's recommendation and what the alternative costs. None was silently resolved.

### F1 — delivery depth

Ship `scripts/pre-merge-local.sh` at **all profiles** (recommended) or **env+ only**?

- **All profiles.** The script is a standalone leaf: it needs git plus the lane's own toolchain, nothing else. Core-depth consumers hit the #1465 Actions-quota wall identically, and they are the ones least likely to have any other local gate.
- **env+ only.** Precedent is [`setup.d/85-worktree-scripts.sh`](../../../setup.d/85-worktree-scripts.sh), which gates the worktree helpers at env+. Cost: core consumers get no local carrier exactly where CI minutes are scarcest.

### F2 — head already contains base

The reference implementation dies here («a run here would prove nothing»), which is right for a fallback carrier. For an inner-loop carrier the merge result equals the head tree by construction.

- **Proceed, reporting `merge = head (base already contained)`** (recommended) — the three-sha contract stays intact and the loop still gates the real artefact.
- **Die like the reference** — forces a fresh base merge before every run; friction on every up-to-date branch, which is the common case for a tool meant to run constantly.

### F3 — NOT-COVERED policy (needed before B2, not B1)

CI legs the carrier cannot reproduce locally (gitleaks binary, codecov upload, playwright browsers on the UI lanes).

- **Report-only** (recommended): name each uncovered leg in the verdict, run opportunistic legs when the binary exists.
- **Hard-require**: CANNOT-RUN when a leg's binary is absent. Stricter, but it imports host requirements the shipped axis forbids assuming.

### F4 — the kickoff contradiction (recorded as `KICKOFF-AMBIGUOUS`, round 1)

Kickoff §1 row 2(d) conditions the waiter rider on «where a shipped waiter surface exists»; §2 binds both #1465 riders to land in the same change as the carrier. **Measured:** no shipped surface reads the GitHub checks API at all — `grep -rln "gh pr checks\|statusCheckRollup\|check-runs\|checkSuites"` over `packages/core/templates/ setup.d/ scripts/ packages/runtime-bridge/src/` returns 0 files (2026-08-18). So the condition is false and the binding still holds — the two clauses point opposite ways.

The spec resolved toward §2: part 1 lands as a **new** `ci-available-probe.sh`, stated explicitly rather than silently. If the operator prefers the docs-only reading, that is a **kickoff re-design**, not rework of the spec.

## §2 Ordered path from decision to dispatch (do not skip a step)

1. **Answer F1 + F2** (F3 before B2). Without them B1's delivery section and exit-code table are underspecified.
2. **Author the build-umbrella kickoff** at `.claude/orchestrator-prompts/<name>/kickoff.md`, with: a real `Depends on` stage column (B1 → B2 → B3 per the spec's §g), a `host-verify` fenced block ([destination-environment-verification.md §1](../../../.claude/rules/destination-environment-verification.md) — a missing contract is a FAIL, not a pass), §3 T-enumeration plus ≥1 domain trap ([ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md)), and the F1/F2 answers written in as ratified constraints so the executor cannot re-derive them.
3. **Phase -1 cold-review of that kickoff** — mandatory per the meta-launch record §7, before any dispatch.
4. **Merge the kickoff to `staging`** — [kickoff-staging-placement.md §1](../../../.claude/rules/kickoff-staging-placement.md): a kickoff living only on a feature branch is invisible to `/pipeline` and to aif, which read from `staging`. This is the step that makes dispatch possible at all.
5. **Re-probe in-flight** (`SLUG=<name> bash .claude/skills/dispatcher/helpers/probe-inflight.sh`) immediately before dispatch — every historical collision materialised inside the Phase -1 window.
6. **Dispatch.**

## §3 aif fitness — probed live, not assumed

Probes run 2026-08-18 against `aif-handoff-agent-1`. Re-run them at dispatch time; container state is operator-machine state that moves with no commit.

| Probe                                                                                                       | Result                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `/health`                                                                                                   | `200`                                                                                                                           |
| `git --version`                                                                                             | `2.39.5` (`merge-tree --write-tree` would be available at ≥2.38, though the design DEFERs it — SSOT #259)                       |
| `git worktree add --detach` → `rev-parse` → `worktree remove --force` inside `/home/www/rules-as-tests-aif` | **all three OK** — this is the load-bearing one: the carrier and its self-tests are built entirely on throwaway worktrees       |
| `node` / `npm`                                                                                              | `v22.23.1` / `10.9.8` — the ts-lane `npm ci` path is available                                                                  |
| Container clone base                                                                                        | `e28a042e70` (#1398) — **far behind** `staging` at `b47edee38a`. Down-sync before dispatch or the worker builds on a stale tree |

**Verdict on the channel, with its limit stated.** B1 is a good aif fit and a better one than S0 was: S0 was a design stage whose deliverable _required_ open forks, which is what the meta-launch record §4c honestly flagged as putting the park contract under maximum load. B1 is an I-phase with named surfaces (one script, one probe script, one `setup.d` section, fixture tests, two docs lines) and — once F1/F2 are answered — no design fork left to park. **Wrong if:** the F1/F2 answers arrive as «decide while implementing», which would put a design fork back inside an autonomous worker.

**Not probed, so not claimed:** whether the fixture self-tests pass in the container (they have never been written, let alone run), and whether `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh` behaves identically there — B1 touches `setup.d/`, so the install snapshot baselines under `tests/install-sh/baselines/` will need regeneration, and per [destination-environment-verification.md §2](../../../.claude/rules/destination-environment-verification.md) a green container run is not evidence about the host. Declare both in the kickoff's `host-verify` block.

## §4 What must survive into B1 (from the cold audit's watch-list)

Full table in PR #1475's `## Review findings`. The three that a build stage could plausibly undo:

- **W-1** — gate the MERGE RESULT, never the head alone. Tell: any verdict path or self-test reporting fewer than three shas, or naming the head sha as the verified one.
- **W-2** — the #1465 riders stay inside B1. Tell: `ci-available-probe.sh` or either docs line drifting into a B2/B3 row, or a new fork naming the riders.
- **W-3** — opt-in only. Tell: any `setup.d/`, husky, `validate`, or CI wiring of the carrier appearing in B1.

Also carried: `golangci-lint` cache staleness is marked `INCONCLUSIVE-needs-verification` in the spec's §b.1 and must be **verified** in B2, never assumed; and B1/B2 are capability commits, so their `Prior-art:` trailers cite #259-#263.

## §5 Traps this stage already paid for

- **A negative proved by a blind command is not proved.** «`packages/core/templates/react-next/` is EMPTY, `ls` → 0 entries» was false — `ls` hides dot-entries (`.storybook/`). The census that holds is `find . -name "github-actions-ci*.yml"` → exactly 7 lanes.
- **Never run `prettier --write` on the SSOT.** A five-row append became 90 deleted lines and mutated historical row #152's `docs/en/*` into `docs/en/_`. No gate catches it — there is no repo-wide `format:check`. Check `git diff origin/staging -- <file> | grep -c "^-[^-]"` before committing.
- **The lane population is seven, not four.** Three UI presets ship `github-actions-ci-ui.yml` as the consumer's `ci.yml` via `deliver_getff_workflow` ([`setup.d/40-configs.sh:399/414/437`](../../../setup.d/40-configs.sh)). A kickoff that says «four lanes» is already wrong.
- **`gh pr merge` via GraphQL can EOF.** The REST path works: `gh api -X PUT repos/<o>/<r>/pulls/<n>/merge -f merge_method=squash -f sha=<head>`.
