# Contributing to rules-as-tests-aif

> **Authoritative for:** contributor workflow — local setup (hooks installation), what pre-commit / pre-push hooks check, capability-commit definition + Prior-art trailer convention, bypass policy.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](README.md#why-this-exists). AI-tooling conventions (read-first, Artifact Ownership Contract) — see [CLAUDE.md](CLAUDE.md).

## Local setup

Clone the repo, then run once:

```bash
make install-hooks
```

This sets `core.hooksPath = .husky` via `git config` (no npm/husky package required)
and makes both hooks executable. After this, Git will automatically run the hooks
on `git commit` and `git push`.

### Working in a git worktree

The pre-push hook runs TypeScript checks via `tsx`, which resolve dependencies from `node_modules`. A fresh `git worktree` has none, so the hook fails with `ERR_MODULE_NOT_FOUND`. Symlink the main checkout's `node_modules` (root **and** `packages/core`) into the worktree before pushing — do **not** bypass with `--no-verify`:

```bash
ln -s /abs/path/to/main-checkout/node_modules node_modules
ln -s /abs/path/to/main-checkout/packages/core/node_modules packages/core/node_modules
```

## What hooks check

### pre-commit (target: <5 seconds)

Runs on every `git commit` against staged files only:

| Check | Files | Tool |
|---|---|---|
| Bash syntax | `*.sh` | `bash -n` |
| JSON validity | `*.json` | `python3 json.load` |
| YAML validity | `*.yml`, `*.yaml` | `python3 yaml.safe_load` |
| Markdown ≤600 lines | `*.md` | `awk` |

All checks are scoped to `git diff --cached --diff-filter=ACM` — only files staged
for the current commit are inspected.

### pre-push (target: ≤30 seconds)

Runs on every `git push`:

| Check | Scope | Tool |
|---|---|---|
| Workflow linting | `.github/workflows/*.yml` | `actionlint` |
| Security scan | `.github/workflows/` | `zizmor` |
| Self-test pipeline | `packages/core/audit-self/` | `npx vitest run --reporter=default packages/core/audit-self/audit-ai-docs.test.ts` |
| Manifest render drift | `packages/core/manifest/rules-manifest.json` ↔ rendered `RULES.md` | `npx tsx packages/core/render/render-rules.ts --check` |
| Spec discipline | staged `.claude/orchestrator-prompts/*.md` | `npx tsx packages/core/spec-validation/validate-batch-spec.ts` (pre-commit soft warn, pre-push hard fail) |

> **Pre-push spec validation requires `gh auth login`** for full SHA verification (action existence + tag↔SHA consistency). Without auth, the check falls back to anonymous gh API (60 req/h limit) and exits with code 2 (treated as pass) on rate-limit. For best CI parity locally, run `gh auth login` once. See `packages/core/spec-validation/validate-batch-spec.ts --help`.

## What if you must bypass

```bash
git commit --no-verify   # skips pre-commit
git push --no-verify     # skips pre-push
```

**Warning:** the CI job `enforce-husky-presence` in `audit-self.yml` does NOT catch
`--no-verify` bypasses of the hook content, but it does verify that `.husky/pre-commit`
and `.husky/pre-push` exist, are executable, and contain the expected probes. If you
delete or stub out the hooks, the CI gate will fail on your next push.

See `docs/meta-factory/PROPOSAL.md` §13.9 for the rationale behind the CI gate as
a second line of defence against `--no-verify` normalisation.

## Tools required

Before your first push, ensure these are installed:

### macOS

```bash
brew install actionlint        # workflow linter
pip install zizmor             # security scanner
```

Python 3 is pre-installed on macOS 12+. Node.js (for `npx tsx`) is required for
`packages/core/render/render-rules.ts`. Install via `brew install node` or `nvm`.

### Linux

```bash
go install github.com/rhysd/actionlint/cmd/actionlint@latest
pip install zizmor
```

If `actionlint` or `zizmor` are missing, the pre-push hook prints install instructions
and exits 1 — it will not silently skip the check.

## Run hooks manually

```bash
make pre-commit-check    # run pre-commit probe without committing
make pre-push-check      # run pre-push probe without pushing
make self-audit          # run both
```

## Bash mutation testing (on-demand, local)

TypeScript hooks are mutation-tested by Stryker (`npx stryker run`, a `devDep`,
run by hand — not in CI). Bash hooks (`.claude/hooks/*.sh`) are mutation-tested
by a thin wrapper over [universalmutator](https://github.com/agroce/universalmutator)
— same delivery model: **run locally on demand, not in CI** (mutation is slow and
CI minutes are metered; README doctrine is «CI = last resort»).

**One-time prerequisite (local only):**

```bash
pipx install universalmutator   # or: pip install universalmutator
```

universalmutator is MIT-licensed and is a **dev-time tool only** — it is never
shipped to consumer projects, and nothing in CI depends on it.

**Run it when you touch a hook or its paired-negative test** — this is the
discipline that replaces a CI gate (no automated reminder; it is a convention):

```bash
# <hook>  <its paired-negative test command>  [min-kill-% floor, default 60]
packages/core/audit-self/run-bash-mutation.sh \
  .claude/hooks/deps-hash-check.sh \
  "npx vitest run hooks/deps-hash-check.test.ts" \
  60
```

It mutates the hook with the operators in
[`packages/core/audit-self/bash.rules`](packages/core/audit-self/bash.rules)
(negate `if`, swap `&&`/`||`, flip `exit 0`/`1`, flip `=`/`!=`, disable `set -e`),
runs the test against each mutant, prints the kill rate + every surviving mutant,
and exits non-zero below the floor. A surviving mutant is **either** a real gap in
the test **or** an equivalent mutant — judgement, not automation, decides which
(record equivalent ones so they aren't re-investigated).

Notes:
- universalmutator's generic comment scanner treats `/*` as a C block-comment
  opener; a bash glob in a comment (`# … hooks/*.sh`) would otherwise suppress
  mutation of the rest of the file. The wrapper neutralises this automatically
  (line-count-preserving), so kill rates are not silently truncated.
- Mutants are swapped into a temp **shadow copy** of the hook — the tracked
  file is never written (2026-07-02 leak incident: concurrent suite instances
  interleaved the old in-place swap/restore and a mutant leaked into the tree).
  The shadow's path reaches the test command via `BASHMUT_HOOK`; a hook test
  that spawns its hook must spawn `$BASHMUT_HOOK` (falling back to the tracked
  path when unset), or every mutant survives and the gate fails loudly.
  `packages/core/audit-self/hooks-tree-guard.ts` (vitest globalSetup) is the
  suite-level tripwire that fails a run which leaks into `.claude/hooks/`.

## Build-vs-reuse + `Prior-art:` trailer convention (Phase 8.8)

Before introducing a **capability commit**, you must consult prior art. The
goal is to avoid silently rebuilding what already exists in production —
[docs/meta-factory/prior-art-evaluations.md](docs/meta-factory/prior-art-evaluations.md)
is the SSOT recording each evaluation and its verdict.

### What counts as a capability commit?

The pre-push hook flags a commit as a capability commit if **any** of:

| Trigger | Detection |
|---|---|
| New explicit dependency added to `package.json` | diff line matches `^\+\s*"[^"]+":\s*"\^?[0-9]` (transitive deps don't count) |
| New file ≥50 LOC under a **new** subdirectory of `packages/core/` | new path under previously-empty `packages/core/<dir>/` |
| New file ≥80 LOC anywhere under `packages/` | size threshold for new abstractions |

Out of scope (NOT capability commits): refactors, doc edits, test additions
for existing capabilities, bug fixes, snapshot regenerations, recipe-data
JSON edits.

### What you must do for a capability commit

1. **Consult** [prior-art-evaluations.md](docs/meta-factory/prior-art-evaluations.md)
   (SSOT) for matches on the capability area you're adding.
2. **Run a context7 query** (≥3 phrasings) on the capability area; cite
   candidates that surface.
3. **Document the evidence** in the commit message body via a `Prior-art:`
   trailer (the pre-push hook validates presence + length).

If no SSOT entry matches and context7 surfaces no production analog, **add
a new SSOT entry in the same commit** — with `Verdict` / `Rationale` /
`Trigger to revisit` per [prior-art-evaluations.md §3](docs/meta-factory/prior-art-evaluations.md).

### `Prior-art:` trailer syntax

In the commit message body, after the blank line following the subject:

```text
Prior-art: <narrative referencing prior-art-evaluations.md#<ID>, or escape hatch>
```

Positive forms (one or more lines, each starts with `Prior-art:`):

```text
Prior-art: prior-art-evaluations.md#1 (Autogrep, verdict DEFER — different domain).
Prior-art: prior-art-evaluations.md#3 (fitness functions vocabulary adoption).
```

Escape hatch (for capability-shaped commits that intentionally skip the
consult — e.g. you've already cited the SSOT in an earlier commit of the
same series, or the «capability» surface area is one the hook over-flags):

```text
Prior-art: skipped — refactor only, no new capability
```

**Escape hatch rules** (enforced by hook):

- Rationale **must** be ≥20 chars after «skipped — ».
- Must explain *why* in domain terms (e.g. «refactor only, no new
  capability», «snapshot regen after recipe edit», «trailer cited in
  parent commit X»).
- Placeholders (`TODO`, `later`, `n/a`, `tbd`) are **rejected** — the hook
  treats short / generic skip rationales as gaming and fails.

### Recursive self-application

The convention is enforced at three layers, each validating a different
artifact. Bypassing one is caught by another:

| Layer | Surface | Catches | Added |
|---|---|---|---|
| Meta-test | `packages/core/principles/08-prior-art-cited.test.ts` | research file cites SSOT by ID; broken `#N` refs | T3 |
| Process gate | [EXECUTION-PLAN.md §5.5 Step 1.5](docs/meta-factory/EXECUTION-PLAN.md) | consult done before phase research drafted | T6 |
| Developer-time | `.husky/pre-push` capability detection + trailer parse | commit trailer absent or below escape-hatch length | T7 + T8 |

This means: a capability commit that lacks a trailer fails the push hook;
a research file that doesn't cite SSOT fails the principle test in CI.
Both must be fixed at source — no `--no-verify` / silent CI bypass.

### Bypass policy

`git push --no-verify` skips the hook content but the CI job
`enforce-husky-presence` still runs `audit-ai-docs.test.sh`-equivalent
checks (T9 — added hook regression test under `tests/hooks/`). Skipping
the hook does not skip the principle test; principle 08 runs in
`principles-meta-tests` CI job and catches research-file violations
regardless of hook bypass.

## Reference

- `docs/meta-factory/self-application.md` — why author-side enforcement exists
  and the full Decision matrix (§3) behind each probe choice
- `docs/meta-factory/EXECUTION-PLAN.md` §6 Batch 1.A — Phase 1 scope and acceptance criteria
- `docs/meta-factory/EXECUTION-PLAN.md` §5.5 Step 1.5 — phase entry consult gate (Phase 8.8 T6)
- `docs/meta-factory/PROPOSAL.md` §13.9 — rationale for `enforce-husky-presence` CI gate
- `docs/meta-factory/prior-art-evaluations.md` — SSOT for build-vs-reuse decisions (Phase 8.8 T1+)
- `CLAUDE.md` — agent-side summary of the same convention (auto-loaded by Claude Code)
