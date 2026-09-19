# ledger-1597-fixes — DONE

- Final PR: #1668
- Closed: 2026-09-08
- Summary: the fix campaign for the promote-#1597 local review ledger. Eleven stages (F1–F11)
  dispatched through the aif runtime and harvested to `staging`, closing 27 ledger findings
  across the installer lanes, the pre-push hook checks, the rule-tests firing runner, the
  research/synthesizer path and the installer's shared delivery helpers. The umbrella ends with
  F8 — the S-2/S-3 deduplication that collapses three copies of the toolchain-lane machinery
  into `setup.d/lib.sh` and drives `install.sh`'s three lanes from one table.

## Stages

| Stage | Findings closed | PR | Squash | Head branch |
|---|---|---|---|---|
| F1 — cargo self-check exit code + lib.sh hash ladder | A2-3, R-3 | #1660 | `de40a6120f` | `feature/ledger-1597-fixes-1f0d50` |
| F2 — pr-body-fidelity shapes, zero tallies, one FILE_LINE_RE, unpinned npm globals | A4-3, A4-5, R-8, A4-7 | #1659 | `840da9bed4` | `feature/ledger-1597-fixes-644ecb` |
| F3 — firing decided from JSON codes; codeless cargo errors invalidate the sample | A7-2, A7-3, A7-5 | #1667 | `03a0a24cee` | `feature/ledger-1597-fixes-b0c40e` |
| F4 — PEP 621 multi-line deps, whole-plan validation, shared path guards + JSON-array parse, clippy bridge reuse | A7-1, A7-4, R-1, R-4, R-5 | #1656 | `e40f6d88ef` | `feature/ledger-1597-fixes-553d62` |
| F5 — stop delivering the dead maintainer ask-file gate to npm consumers | C-2 (absorbs A1-5) | #1661 | `bb432820e8` | `feature/ledger-1597-fixes-e528ad` |
| F6 — rules-lock hash inputs + fingerprint ladder across the three lanes | A2-9, A2-11, A2-12, R-3b | #1666 | `c12cb41ca7` | `feature/ledger-1597-fixes-cd386d` |
| F7 — quote the REPO_ROOT strip in validate-prompt; exclude the assembled getff payload from the root vitest run | K-6, T-6 | #1662 | `8124fe21e4` | `feature/ledger-1597-fixes-484ce1` |
| F8 — one lane body + a LANE_TABLE walk; shared lane machinery in lib.sh | S-2, S-3 | #1668 | `6e701e2c0d` | `feature/ledger-1597-fixes-3fff3d` |
| F9 — copy_safe's ✓ and baseline staging follow the copy, not the ambient set -e | A1-9d | #1663 | `4e0a6a615f` | `feature/ledger-1597-fixes-203977` |
| F10 — document RULES_DIR_OVERRIDE + four look-alike non-knobs | D-7c | #1658 | `02dc6ab4f1` | `feature/ledger-1597-fixes-94489c` |
| F11 — the refresh sweep names every file it keeps inside a directory payload | L-4d, L-4e | #1665 | `873ac9a4de` | `feature/ledger-1597-fixes-2608d6` |

**Head branches are aif-minted, not kickoff-predicted.** Every stage ran in the aif runtime,
which mints `feature/<slug>-<6>` from the task id with no override in `dispatch.ts` or
`harvest.ts`. A head-name grep against a predicted branch returns `[]` for all eleven stages;
gate on the PR numbers or on `git merge-base --is-ancestor <squash> origin/staging` instead.

**Two stages never produced a harvestable commit and were egressed by hand** through the
HOST-PUSH channel ([.claude/rules/egress-no-api-bypass.md](../../rules/egress-no-api-bypass.md) §1):
F3 (stranded at `status=review` by three `malformed_review_output_fallback` rounds) and F8 (parked
at `status=review, executionOwner=human` with the entire change uncommitted in the container
tree). F11 reached `done` with zero commits and a dirty tree and needed `--confirm-rework` after
the rework-complete premise was measured. See §Residue.

## Residue

Deliberately NOT closed by this umbrella. Each item re-verified on `staging` at
`03a0a24cee` before being written here.

### Repo defects with no owner in this campaign

- **A2-8 — the installer takes over `core.hooksPath` with no pre-existing-hook check.**
  `setup.d/50-hooks.sh:74` runs `git config core.hooksPath .husky` whenever `PROJECT_ROOT` is a
  git repo. The only guards are `DRY_RUN` and «is this a git repo» (`setup.d/50-hooks.sh:72-77`);
  a consumer whose `core.hooksPath` already points elsewhere, or who has live hooks in
  `.git/hooks/`, is silently redirected. This is a design call (fail-loudly vs. take-over), not a
  bug with an obvious fix, and no stage owned `50-hooks.sh` beyond F5's delivery block.

- **D-6 — the merge-forward rule names the snapshot regen but not the MANIFEST regen.**
  `.claude/rules/git-conflict-merge-forward.md:29` step 6 is
  `Regenerate: SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`, and the verify step at
  `.claude/rules/git-conflict-merge-forward.md:32` likewise names only the snapshot. Nothing in the recipe tells the operator to run
  `bash scripts/build-getff-dist.sh` after touching `install.sh` or `setup.d/**`. **This gap was
  paid twice in this campaign**: it is the single blocker the aif review gate raised against F8
  (`build-getff-dist.sh --check` exiting 1 on a manifest attesting a stale `install.sh` hash), and
  it is why F3 and F11 both needed a separate host regen commit after merge-forward. The rule is
  maintainer-owned ([CLAUDE.md](../../../CLAUDE.md) Artifact Ownership Contract,
  `.claude/rules/` row), so no stage could edit it.

- **K-4 — the doc-authority principle is blind to the vendored payload.**
  `packages/runtime-bridge/vendor/README.md` is a shipped consumer-facing doc — `install.sh:1052`
  and `setup.d/55-runtime-bridge-vendor.sh:74` deliver that tree to
  `<consumer>/.claude/vendor/runtime-bridge/`. It carries an authority header today, but neither
  `packages/core/principles/09-doc-authority-hierarchy.ts` nor its `.test.ts` mentions `vendor`
  (grep count 0 in both), so `REQUIRED_HEADER_DOCS` does not contain it and the principle would
  not go RED if the header were dropped. `.claude/rules/doc-authority-hierarchy.md:50` — the
  «shipped consumer-facing artefacts» bullet — lists `packages/core/templates/shared/`, the
  preset, and `agents/`, but not the vendor tree. Both artefacts are maintainer-owned.

  > The residue list handed to this closure also carried **A5-8**
  > («`AifHandoffBackend.ts` still carries `_rest` as a 4th copy»). **It is closed, not residue** —
  > PR #1627 (`9dac4259c0`) folded it, and `AifHandoffBackend.ts:548` is now a two-line delegate
  > to `aifRequest` from `cli/aifHttp.ts`. Do not re-open it.

### Host / environment conditions

- **`cargo-entry-lane` cannot go green on this Mac, and it makes
  `scripts/run-local-ci-sweep.sh` unusable end-to-end.** `tests/install-sh/cargo-entry-lane.test.sh`
  reports `PASS=51 FAIL=5` on `origin/staging` itself — arms 5a (×2), 6 (×2) and 9 — because the
  host's `cargo` is a rustup shim with no default toolchain, so the real `cargo clippy` firing
  self-check cannot fire against the delivered `clippy.toml`. Measured on a detached
  `origin/staging` worktree for PR #1667 and again for #1668, with an identical failing-arm set
  both times. The sweep's `install-sh-suite` gate aggregates ~20 files and reports only the gate
  name, so the failure has to be located by looping the directory by hand. Not a repo defect —
  but every future stage pays the triage cost until a toolchain is installed or the arms learn to
  SKIP on a shim.

### aif-handoff runtime defects (not repo defects)

- **The FALSE-DONE class.** A task can reach `status=done` with **zero commits and a dirty
  working tree** while the auto-review gate passes in `fallback` parser mode with 0 findings —
  observed on F11, where the worker was still waiting on its test battery when the task
  terminalised, so no REPORT with a `Status:` line ever existed. `packages/runtime-bridge/src/cli/harvest.ts:672` catches this
  as `needsConfirm` (the `done`+0-ahead+dirty shape is documented at `:93`), which is why `--confirm-rework` is required; the premise must be MEASURED
  (full host battery + diff inside the owned-file row) before that flag is passed, never assumed.
  F8 is the same class one state earlier: its container tree carried the entire 8-file change
  uncommitted while the task sat at `review`.

- **The `malformed_review_output_fallback` loop has no human exit.** F3 burned three consecutive
  review rounds on it (2/3, then 3/5), each ending with 0 new findings in `fallback` parser mode.
  aif's legacy resolver has no human event out of `review`
  (`aif-handoff packages/shared/src/stateMachine.ts:335`), so `harvest.ts` refuses the task
  forever and the only route out is a hand bundle through the HOST-PUSH channel. F8 hit the same
  dead end from `executionOwner=human`.

- **F8's task record is deliberately untouched**, left at
  `status=review, executionOwner=human` (task `3fff3de9-b26c-430e-9e20-1c9b19eb2ce2`). The work
  is on `staging` via #1668; the aif record is not a source of truth for it.
