# KICKOFF — ledger-1597-fixes

> **Type:** remediation umbrella, four independent I-phase stages, one PR to `staging` per stage.
> **Origin:** the local max-effort review of the merged promote
> <https://github.com/Yhooi2/rules-as-tests-aif/pull/1597> (shipped surface `a8fd65e13c → 992377dbdb`)
> produced a 101-finding ledger. Twenty of its concerns run as desktop fix sessions coordinated
> from the host; the four stages here are the ones whose file sets touch NO file claimed by any
> desktop session, so they can run in the aif factory in parallel with that campaign.
> **Base branch:** staging. Per
> [kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md) this umbrella is
> merged to `staging` before any stage is dispatched.
> **Rigor label (effort-worthiness L0):** `build-and-verify` — every fix is reversible, none touches
> a consumer-shipped installer path, and the authoritative verification is a RED-then-GREEN test plus
> the CI run on the stage PR.
> **Prior-art (EXECUTION-PLAN §5.5 Step 1.5):** no capability commit in any stage — regex fixes,
> exit-code parsing, a shared-helper extraction inside one package, a PEP 621 parser widening. Each
> commit carries `Prior-art: skipped — <rationale ≥20 chars>`.
>
> **Citation form is load-bearing** — issue/PR references are full URLs or bare `PR NNN`, never
> hash-tokens. Finding IDs (`A4-3`, `R-8` …) are ledger keys, quoted verbatim in each stage.

## §0 Read first, in order

1. [README.md#why-this-exists](../../../README.md#why-this-exists) → [.claude/session-bootstrap.md](../../session-bootstrap.md) → [CLAUDE.md](../../../CLAUDE.md).
2. The stage kickoff you were dispatched with — it carries the finding text inline (the ledger file lives on the operator's host, not in this checkout).
3. [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md) — the T-numbers each stage names.

## §1 Stages

| Stage | Kickoff | Findings | Files owned by the stage |
| --- | --- | --- | --- |
| F1 | `kickoff-f1.md` | A2-3, R-3 | `setup.d/46-cargo.sh`, `setup.d/47-go.sh` (hash ladder only), `tests/install-sh/cargo-entry-lane.test.sh`, `tests/install-sh/go-entry-lane.test.sh` |
| F2 | `kickoff-f2.md` | A4-3, A4-5, R-8, A4-7 | `packages/core/hooks/checks/pr-body-fidelity.ts`, `packages/core/hooks/checks/unpinned-tool-install.ts`, `packages/core/hooks/checks/s17.ts` (shared regex only) + their tests |
| F3 | `kickoff-f3.md` | A7-2, A7-3, A7-5 | `packages/core/synthesizer/run-rule-tests-firing.sh` + its test material |
| F4 | `kickoff-f4.md` | A7-1, A7-4, R-1, R-4, R-5 | `packages/core/research/ecosystem-python.ts`, `packages/core/research/ecosystem-{cargo,go,npm}.ts` (helper extraction only), `packages/core/install/rule-bootstrap-cli.ts`, `packages/core/backends/golangci/firing-runner.ts`, `packages/core/backends/shared/json-array-parse.ts`, `packages/core/synthesizer/render-researched-{clippy,astgrep}.ts`, `packages/core/synthesizer/research-to-{clippy-node,node}.ts` + tests |

Stages are independent: no two stages share a file, and none shares a file with the desktop campaign.

## §2 Scope lock (binding for every stage)

- **Owned files only.** Every file NOT listed in the stage's row is owned by another session in this campaign — `setup.d/lib.sh`, `setup.d/45-python.sh`, `install.sh`, `packages/core/hooks/pre-push.ts`, `packages/core/hooks/checks/prior-art.ts`, everything under `packages/runtime-bridge/`, everything under `plugin/hooks/`, `.github/workflows/**`, `packages/core/principles/**`, `packages/core/templates/**`. Needing one of those is a PARK, not an edit.
- **One concern per stage, no drive-by fixes.** A neighbouring defect you notice goes into the report's observations, never into the diff.
- **Deferred by design, do not pick up:** `S-2` (the go lane is a copy of the cargo lane, ~200 lines ×3) and `S-3` (install.sh lane-routing triplication) — both are refactors across files the desktop installer chain owns; they run as a tail stage after that chain lands.

## §3 Binding constraints (do not re-derive)

- Test first: every finding gets a test that is RED against the current code before the fix and GREEN after. Quote both runs in the report.
- Never `--no-verify`, never force-push. On a conflicting branch, merge-forward per [.claude/rules/git-conflict-merge-forward.md](../../rules/git-conflict-merge-forward.md).
- Each commit carries a `Prior-art:` line (escape form with a ≥20-char rationale — see CLAUDE.md).
- The PR body carries `## Fidelity verdict` with a literal `FIDELITY: skipped — <≥20 chars>` line, plus `### §1.7 Forward-check applied` and `### §1.7 Backward-check applied`, each ≥40 characters and each with at least one literal `path.ext:NN` citation.
- Line numbers in the finding text are at `992377dbdb`; relocate them on the current base before editing — the file may have moved on.

## §4 AI-traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active for every stage — name them in the report, do not restate the catalogue:

- **T3** — every acceptance claim carries command output or a `file:line` citation.
- **T5** — the stage's file row is the whole scope; a third file is a park.
- **T14** — a green run with a SKIPped lane proves nothing: say which lanes actually executed.
- **T19** — cold-review your own diff before the report.
- **T20** — quote the output behind each verdict.

## §5 Host acceptance

The stage kickoffs each carry their own `bash host-verify` contract; the umbrella-level contract is the sweep the coordinator runs on every harvested branch before the PR:

```bash host-verify
bash scripts/run-local-ci-sweep.sh
```

A red that also reproduces on `origin/staging` is pre-existing, not the stage's.

## §6 Park-don't-guess (autonomous aif contract)

Park the task (do not guess) if: a fix needs a file outside the stage row; a RED test cannot be written because the required tool (ast-grep, ruff, cargo, go) is absent in the runtime AND the finding cannot be proven with a recorded fixture; the finding text turns out wrong on the current base (say what you measured).
