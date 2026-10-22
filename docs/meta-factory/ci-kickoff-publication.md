# CI for kickoff publication

> **Authoritative for:** the scope and retained checks of the kickoff publication CI lane.
> **NOT authoritative for:** kickoff delivery and merge timing — see [kickoff staging placement](../../.agents/rules/kickoff-staging-placement.md); project goal — see [README](../../README.md#why-this-exists).

Kickoffs still travel through a reviewed PR and a squash merge to `staging` before
dispatch. This lane reduces the checks needed to publish documents; it does not
change how `$pipeline` discovers them or authorize an implementation launch.

## Selection

`scripts/ci-path-scope.sh` computes two independent outputs: `install` retains the
existing measured install-area scope; `runtime=false` selects the kickoff lane.
The latter requires a `pull_request` merge checkout with a nonempty diff against
its first parent and at least one changed umbrella or stage kickoff.

Every changed path must be a regular, non-executable file in this set:

- `.claude/orchestrator-prompts/<umbrella>/kickoff.md` or a stage kickoff using
  the existing `kickoff-<letter><digit>[alnum].md` grammar;
- kickoff decision/amendment sidecars;
- dated Markdown or JSON planning companions under `docs/superpowers/specs/`;
- the generated `docs/site/face-facts.json`, still checked against its generator;
- `.gitignore`, only when every added line is a stage-document exception such as
  `!.claude/orchestrator-prompts/example/kickoff-s*.md`, the same umbrella has a
  changed kickoff, and no line is removed.

Code, workflows, scripts, other configuration, unknown paths, deletions, symlinks,
executable documents and malformed diffs retain full runtime CI. The existing
`NEVER_SKIP` install-fixture exceptions also retain full CI. Push and merge-group
events always run the full runtime suite, including the post-merge staging push.
A failed classifier job blocks `ci-success`; it never grants a silent skip.

## Checks retained

The kickoff lane runs the entire principles suite, including kickoff naming,
tracking, rigor labels, host-verification contracts, worker-channel restrictions,
and CI aggregate completeness. It also runs the kickoff hook, worker dispatch,
host-verify and pipeline park-contract suites that read real kickoff documents.
Changed Markdown is linted and formatted, and the existing batch-spec validator
checks action references in the actual changed kickoffs.

Whole-tree mechanical checks, shipped formatting, generated-document drift,
documentation quality/refresh, citation checks, context budget, hook presence,
actionlint and zizmor remain. Independent PR fidelity, prior-art, stale-revert
and discipline workflows retain their existing triggers and gates. The separate
template-render workflow also retains its existing behavior.

Runtime builds, toolchain installs, consumer/install matrices and runtime suites
are skipped only for the proven kickoff lane. The aggregate validates the scope
decision and requires successful document checks; a failed or skipped replacement
check cannot turn an untested publication green. Full-runtime selection also
rejects any skipped runtime-scoped job.

## Verification and reuse

This extends the existing path-scope and aggregate scripts rather than introducing
another CI service. Prior art: SSOT #244 (aggregate wiring), #116 (Git-based kickoff
portability), and the measured install scope in
[the read-set record](research-patches/2026-09-29-ci-path-scope-read-set.md).

`scripts/ci-path-scope.test.sh` uses real temporary merge commits to discriminate
kickoff publication from mixed changes. `scripts/ci-success-gate.test.sh` checks
missing decisions, skipped required checks and failures. Principle 36 checks the
workflow transport with seeded wiring removals. The local sweep selects kickoff
contracts for planning paths, with real-table trigger checks in
`scripts/run-local-ci-sweep-coverage.test.sh`.

Revisit the selection when a new runtime test starts reading a kickoff or planning
companion: keep that reader in the document lane or add a `NEVER_SKIP` exception.
