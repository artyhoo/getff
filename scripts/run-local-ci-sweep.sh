#!/usr/bin/env bash
# run-local-ci-sweep.sh — local CI-equivalent gate sweep for harvest pre-push.
#
# Default: diff-aware (vs merge-base), cheapest-first, fail-fast, fail-safe to full.
# `--full` runs the complete set regardless of the diff.
#
# It gates COMMITTED work: gate SELECTION comes from `git diff <merge-base>...HEAD`, because
# that is what CI will see. Uncommitted edits are therefore invisible to the selection layer,
# and the sweep refuses (rc 3) rather than answering rc 0 when that leaves it with no gates at
# all on a dirty tree. See the `dirty-tree-zero-gates` block at the tail for why the refusal is
# scoped to that case and not to every dirty tree.
#
# The sweep aggregates the gates the GitHub-CI jobs run (audit-self.yml). It exists so a
# harvested aif branch is checked against the real gate set locally before push — the
# recurring "pushed, CI reddened on a gate I didn't re-run" failure (PR #724).
#
# Spec: docs/superpowers/specs/2026-06-26-harvest-skill-design.md
# bash 3.2 compatible (no globstar / associative arrays).
#
# --- COVERAGE vs the required CI contexts (audited 2026-08-09; list re-derived 2026-08-10) -
# The contexts whose fail-closed property rests on being REQUIRED on staging. DERIVED, NOT
# AUTHORED: each entry is declared at its own job by a `# required-context: yes` marker in
# .github/workflows/*.yml, and packages/core/principles/37-required-context-completeness.test.ts
# asserts this block equals that declared set exactly (and that workflow-integrity.yml's
# `required_contexts=` does too). Do not hand-edit one of the three without the others.
#
# REQUIRED_CONTEXTS:
#   Template render probes — P1/P4/P6 (deterministic)
#   capability PR carries Prior-art line in PR body (squash-survival)
#   ci-success
#   fidelity-verdict-in-pr-body
#   stale-revert-in-pr-diff
#   §1.7 forward+backward sections present in PR description
#
# REGISTRATION STATE (2026-08-10, `gh api …/branches/staging/protection` with an admin token):
# registered = `ci-success`, `fidelity-verdict-in-pr-body`, `stale-revert-in-pr-diff`.
# Declared-required but NOT yet registered = `Template render probes — P1/P4/P6 (deterministic)`,
# `capability PR carries Prior-art line in PR body (squash-survival)`, and — newly registrable as
# of the §1.7 trigger unfiltering — `§1.7 forward+backward sections present in PR description`.
# Those three can go red today and the PR still merges; an operator action closes that, and CI
# cannot verify it (workflow-integrity.yml:32-42, GITHUB_TOKEN cannot read protection).
# Named, not positional, deliberately: this line previously said «the last three» / «the first
# two», which silently became wrong the moment a sixth entry was appended above.
#
# `ci-success` is the audit-self.yml aggregator that `needs:` every other job in that file
# (asserted by principle 36). There is no ci.yml. A green sweep predicts a green CI only for the
# jobs listed as COVERED below.
#
# This table below is prose and drifts like any prose. The MECHANISM that keeps the gate table
# itself honest is scripts/run-local-ci-sweep-coverage.test.sh: every single-line atomic command
# audit-self.yml runs must be reachable from gate_table() or carry an explicit UNREACHABLE
# rationale there. It covers the single-line layer only — jobs whose gate logic is inline
# `run: |` / `run: >-` YAML stay invisible to it (see the UNREACHABLE entries below).
#
# COVERED — every `ci-success` need except those named UNREACHABLE:
#   actionlint · typecheck · install-sh-a/b/c (the *.test.sh battery, byte-identical,
#   agnosticism, meta-all-wired, every scripts/*.test.sh self-test the workflow wires (derived,
#   not listed — see gate_table), harvest-via-api, the
#   setup.d lint step) · principles-meta-tests (test:principles/hooks/render/ir/composition/
#   backends/synthesizer/units/skills/spec-validation, the two drift gates, the
#   tests/hooks/*.test.sh battery) ·
#   manifest-render-check · probe-tests · alwayson-budget · phase-8-canonical-regen-acceptance ·
#   scripts/measure/measure.test.sh (the recap-v2 measurement-script oracle; it kept its OWN
#   row from when the derived `script-selftests` row could only see `scripts/<name>.test.sh`.
#   Since 2026-09-14 that derivation also reaches one directory deeper — it had to, or
#   `scripts/lib/claude-md-excludes.test.sh` would have been wired in CI and invisible to the
#   sweep — so this row is now belt-and-braces rather than the only coverage) ·
#   tests/plugin/twin-generation.test.sh (plugin twin generator acceptance — the
#   `plugin-twin-tests` row). Named literally, not as a `tests/plugin/*` loop, so that a future
#   test added to that dir but wired to NO CI step stays out of the sweep — same reasoning as
#   the derived `script-selftests` row: the sweep predicts CI, it does not invent gates. Its
#   `agents/` trigger is load-bearing beyond CI prediction: the suite RUNS the generator, so a
#   sweep after an agents/*.md edit re-syncs the plugin/agents twins that .husky/pre-commit
#   does not yet regenerate ·
#   docs-refresh (the D26 cited-source refresh gate, over merge-base..HEAD) ·
#   f17-node-compat (host Node only) · shipped-prettier (its `npm run format:check` is the
#   sweep's format-check row; it became a `ci-success` need in #1362) ·
#   `Template render probes — P1/P4/P6` (framework-self-template-render.yml — a required context
#   in its own right, not a `ci-success` need; the `template-render` row below runs the same
#   `test:template-render` suite, hermetic into tmpdirs, ~5s).
#
# UNREACHABLE — a green sweep says NOTHING about these; verify on CI:
#   mechanical            whole-tree `find` scanners (packages/core/audit-self/md-line-gate.sh
#                         and its peers); locally they also read gitignored files CI's clean
#                         checkout never has → false red (see the NOTE below).
#   zizmor                needs `pip install zizmor==1.26.1` (network + python env).
#   framework-self-install-ts-server / -react-next, framework-fresh-install-validate (×4 stacks
#   × 2 fixtures; the own-configs cell is tests/consumer-matrix/own-config-cell.sh),
#   framework-fresh-install-validate-multistack, consumer-matrix-start-cell
#   (tests/consumer-matrix/pnpm-monorepo-cell.sh), consumer-matrix-python-unfamiliar-stack-cell,
#   consumer-matrix-npm-tarball-cell, consumer-matrix-getff-dist-cell
#                         each runs a real `install.sh … --full` (or an `npm pack` + `npm i` of
#                         the getff tarball) into a tmp consumer and installs its dependency
#                         tree — network, minutes, non-hermetic.
#                         (consumer-matrix-npm-tarball-cell shipped after this list was written
#                         and went unlisted; consumer-matrix-getff-dist-cell then repeated the
#                         drift — the coverage metatest gates its OWN allowlist array, not this
#                         prose, so this list stayed a second ungated copy. The `unreachable-list-
#                         parity` arm in run-local-ci-sweep-coverage.test.sh now gates it.)
#                         PARTIALLY RECOVERED: the getff-dist cell's step (1),
#                         `build-getff-dist.sh --check`, is hermetic and ~12s — it is the
#                         `getff-dist-manifest` row below, so manifest drift is now a LOCAL red.
#                         The cell's remaining steps stay CI-only.
#   path-scope            scripts/ci-path-scope.sh decides from the pull_request MERGE commit
#                         and the event name — no PR merge ref locally, no decision to run. Its
#                         logic is covered locally by scripts/ci-path-scope.test.sh (real merge
#                         commits in a tmp repo), which the scripts/*.test.sh row runs.
#   pr-commit-trailers    needs the PR base ref + the real PR commit range; the local channel
#                         for it is the pre-push hook, not this sweep.
#   fidelity-verdict-in-pr-body, stale-revert-in-pr-diff
#                         both read the PR body / PR diff off the GitHub API — no PR, no gate.
#   rule-to-probe, enforce-husky-presence, framework-self-detect / -research / -synth /
#   -validate / -install-validated, framework-provenance-anti-hand-edit, the synth-bundle
#   functional smoke, the J3 go-lane live-fire
#                         gate logic is inline bash in the workflow YAML, not a committed
#                         script. Transcribing it here would create a second copy that drifts
#                         from the workflow it claims to predict
#                         (.claude/rules/dual-implementation-discipline.md). Extracting each to
#                         a script — then adding a row that calls it — is the real fix.
#   f17-node-compat (Node 20 arm), the lychee-shipped-md-offline arm
#                         need a second Node version / a pinned downloaded binary; the sweep
#                         runs the host Node, and the lychee test self-SKIPs without it.
# ------------------------------------------------------------------------------------------
#
# --- OFFLOAD (opt-in, machine-local): SWEEP_HEAVY_RUNNER ----------------------------------
# The operator's Mac runs this sweep for every PR and every train, often from several sessions
# at once. Measured 2026-09-29 (load average 13-20): only the install-sh battery left the Mac,
# through INSTALL_SH_HEAVY_RUNNER in scripts/run-install-sh-suite.sh (PR #1913); tsc, prettier,
# every vitest suite and the tsx checks all ran here, because the operator's shadow functions
# for npm/npx live in the interactive shell and a `bash scripts/...` child never sees them.
#
# SWEEP_HEAVY_RUNNER names an executable that takes a command line, runs it elsewhere against a
# mirror of this repo and exits with its code — the contract of PREPUSH_HEAVY_RUNNER (PR #1886)
# and INSTALL_SH_HEAVY_RUNNER (PR #1913). Unset or empty, nothing changes: CI and every other
# checkout never see a difference. PC_LOCAL=1 keeps every row here, as the one runner in use
# (the operator's ~/bin/pc-run) already defines.
#
# Set, each ROUTABLE row (the SWEEP_ROUTABLE list below) runs as
#   <runner> bash scripts/run-local-ci-sweep.sh --run-row <name> --receipt <nonce> …
# in its usual place in the rank order. Everything else runs here. Deny-by-default on purpose:
# a row missing from the list costs Mac CPU, never a Mac-only signal, so a new row can only fail
# in the cheap direction. What stays here and why is written next to the list.
#
# A routed row counts only with its RECEIPT: a line carrying this call's nonce, printed by the
# far end after the row finished, with the row's exit code. The runner's exit code alone is not
# evidence (a runner that runs nothing can exit 0). No receipt means nothing was measured there
# — runner NOT RUN, crash, or a far end whose gate table holds another command or whose index
# tracks another file list (the --cmd-sum check: a stale mirror, or a file staged here and not
# yet committed) — and the row runs HERE instead. A red receipt is a verdict
# and is never retried here — with one exception, below. That split is Bazel's
# --remote_local_fallback rule: fall back on an execution failure, not on a failing action
# (prior-art-evaluations.md#294).
#
# The exception is a red whose output carries a vitest TIMEOUT (`Test timed out in` / `Hook timed
# out in`): the row runs here and the local run is the verdict. Bazel's rule assumes a remote
# executor with reserved capacity; this runner is a shared desktop that also runs games, whose
# load its Linux side cannot see (measured 2026-09-29: WSL load 3.8 while principles/20's 30 s
# hook and principles/43's 120 s test timed out on four pushes in a row, green on the Mac). A
# timeout there says the runner was slow, not that the code is wrong — and a real hang still
# fails here.
#
# Two more cases run here. A row that DEGRADED on the far end: it printed `[sweep] WARN` (a
# toolchain held at another version), or a green run printed a loud skip (`⚠ live ruff firing
# SKIPPED`) naming a tool this host has on PATH — toolchain_pins_ok passes a tool that is simply
# absent, so a runner without ruff would otherwise hand back a PASS in which ruff never ran. The
# Mac may be able to run it for real. And the far end noticing, through --origin, that the runner
# fell back to this host on its own (it runs the row, and the label says where it ran).
#
# ONE STRIKE. The first routed row that comes back without a receipt, runs on this host after all,
# or times out on the runner stops routing for the rest of the sweep: every later routable row
# runs here, labelled with that first reason. An unreachable or busy runner costs one call, not
# one per row.
#
# SHELL ARMS. On a stock Mac every shell a test starts is /bin/bash 3.2 (or /bin/sh, the same
# binary) with BSD userland: `spawnSync('bash', …)` finds nothing else on PATH (checked
# 2026-09-29: `which -a bash` → /bin/bash only), and a `.sh` run by path resolves its
# `env bash` shebang the same way. CI runs on ubuntu only, so the Mac is the one place those
# tests meet the shell consumer Macs run the shipped scripts with. A routed vitest row's files
# that start a shell therefore ALSO run here, and the row passes only if both halves pass — the
# same keep-local split `# stays-local:` gives the install-sh battery. A file starts a shell when
# it names bash or sh as a program ('bash', '/bin/sh', `bash …`) or names a `.sh` file, or
# imports — at any depth, relative specifiers resolved to files — a file under packages/core/ or
# scripts/ that does (shell_scan). The match over-selects (a `.sh` path that is only read
# counts), which costs Mac CPU, never the signal. A row runs a shell when its command, an npm
# script it reaches at any depth, or a node script it runs does; such a row is kept here whole
# (row_shell_reason), and the coverage test REDs on the list naming it. A node script that only
# READS .sh files routes when SHELL_READERS names it with a reason and it starts only git and
# node. Every `exec` string and npm script line goes through /bin/sh -c: what is judged is the
# command inside, not the sh that carries it. Not seen: a shell named inside an exec string
# built at run time or a `node -e` body elsewhere than the row's command, a script path built at
# run time, and code reached through a bare package import (workspace packages included).
# `--route-plan` prints, per row, where it goes and which arms stay.
# ------------------------------------------------------------------------------------------
#
# Test seams (used by run-local-ci-sweep.test.sh, never in real runs):
#   SWEEP_GATES_FILE   path to a gate table overriding the built-in one
#   SWEEP_DIFF_OVERRIDE  space/newline list of changed paths overriding `git diff`
#   SWEEP_ROUTABLE     space list of row names the runner may take, overriding the built-in one
#   SWEEP_SHELL_READERS  `<path><TAB><reason>` lines overriding SHELL_READERS
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1
TAB="$(printf '\t')"

MODE="diff"
BASE_REF=""
LIST_GATES=0
# Every gate that runs writes its combined output to a file in a per-run log directory (see
# `ensure_log_dir`). Unconditional, not flag-gated: the diagnostic is only worth anything on the
# run that happens to catch a rare red, and no operator can know in advance which run that is —
# a flag would have to be guessed BEFORE the failure (PR #1749: one red `vitest-hooks` in ~11
# runs on one commit, undiagnosable because its output was discarded).
# `SWEEP_LOG_DIR` pins the location; unset, each run gets a fresh `mktemp -d`.
SWEEP_LOG_DIR="${SWEEP_LOG_DIR:-}"
LOG_DIR_READY=0
ROUTE_PLAN=0
# The far end of OFFLOAD (see the header): run ONE named row and print its receipt.
RUN_ROW=""
RUN_ROW_RECEIPT=""
RUN_ROW_SUM=""
RUN_ROW_ORIGIN=""
while [ $# -gt 0 ]; do
  case "$1" in
    --full) MODE="full" ;;
    --base) shift; BASE_REF="${1:-}" ;;
    --list-gates) LIST_GATES=1 ;;
    --route-plan) ROUTE_PLAN=1 ;;
    --run-row) shift; RUN_ROW="${1:-}" ;;
    --receipt) shift; RUN_ROW_RECEIPT="${1:-}" ;;
    --cmd-sum) shift; RUN_ROW_SUM="${1:-}" ;;
    --origin) shift; RUN_ROW_ORIGIN="${1:-}" ;;
    -h | --help)
      echo "usage: run-local-ci-sweep.sh [--full] [--base <ref>] [--list-gates] [--route-plan]"
      echo "env:   SWEEP_LOG_DIR=<dir>   per-gate output logs land here (default: a fresh mktemp -d)"
      echo "       SWEEP_HEAVY_RUNNER=<cmd>   run the routable rows through <cmd> (PC_LOCAL=1: none)"
      echo "exit:  0 gates passed (or nothing to do on a clean tree) · 1 a gate failed"
      echo "       2 bad usage · 3 refused: dirty tree, committed diff selected no gates"
      exit 0 ;;
    *) echo "[sweep] unknown arg: $1" >&2; exit 2 ;;
  esac
  shift
done

# --- derived TRIGGERS (not just derived commands) ---------------------------------------------
# One row below derives its TRIGGER from the artifact it gates, for the reason the
# `script-selftests` note gives for deriving a command: a trigger hand-written beside a list that
# already exists in the repo is a second copy, and it drifts silently. Measured 2026-09-14, the
# `getff-dist-manifest` trigger had already drifted WIDER than the payload it restates — `.claude/`
# for three named subdirectories, `packages/` for five named packages, `scripts/` for six named
# files — so a one-line `.claude/rules/*.md` edit selected a gate whose input set that file is not
# in. (This note used to price that gate at 547s. That number came from a run under parallel load;
# measured alone on the same Mac, `build-getff-dist.sh --check` is 9.4s — the `~12s` the
# `script-selftests` note above already carried. The defect was the wrong selection, not the cost.)
# Deriving means the trigger follows the payload for free, in both directions.
#
# The helper falls back to ALWAYS when its source stops parsing. That direction is deliberate:
# a shrunken trigger is the one failure this file must not have — a gate nobody selects is a gate
# nobody has (.claude/rules/attention-is-not-a-mechanism.md §2).
#
# WHY THE `vitest-*` ROWS ARE NOT DERIVED THE SAME WAY (measured 2026-09-14, negative result).
# Each `test:<suite>` script in packages/core/package.json names the directory its test FILES live
# in, so the suite's own directory is derivable — but what a suite READS is not the same set, and
# only the read-set is a safe trigger. Two facts kill the narrowing:
#   (a) the dependency closure has to be transitive — `ir`'s tests reach `research/`, which reaches
#       `validator/` — and a change three hops out still reds the suite;
#   (b) every closure measured terminates in a directory that resolves a repo-root path
#       (`REPO_ROOT`, `process.cwd()`), i.e. reads something outside packages/core/ that no grep
#       can bound. `ir` and `composition` were the only two suites confined at depth 1; both escape
#       at depth 2 (via `research`/`validator`). `hooks` — 644s, the single most expensive gate —
#       is the worst case: 68 of its 76 test files compute REPO_ROOT and five run the real hook
#       with `cwd: REPO_ROOT`, so it genuinely reads the live tree.
# So every `vitest-*` row keeps the broad `packages/core/` trigger. That is over-selection by
# choice, per this file's own header: a sweep that MISSES a gate CI runs is strictly worse than a
# slow one. `run-local-ci-sweep-coverage.test.sh` enforces this as a rule rather than leaving it
# as a comment — a `vitest-*` row narrowed below `packages/core/` REDs unless its suite's closure
# is proven confined.

# Fallback when the payload stops parsing. `ALWAYS`, not the pre-derivation literal: restating
# that literal here would be the same second copy this row just stopped being, and it would go
# stale the moment the payload grew a root the literal does not name — under-selection, the one
# direction this file must not fail in. ALWAYS runs the gate on every diff instead: loud, slow,
# and safe, while arm 8b of run-local-ci-sweep-coverage.test.sh REDs at the same moment and says
# the derivation broke.
GETFF_PAYLOAD_FALLBACK="ALWAYS"

# getff_payload_trigger — the exact input set of `bash scripts/build-getff-dist.sh --check`.
# That script's PAYLOAD= line IS the set of paths whose bytes the committed manifest hashes, so a
# path outside it cannot move the manifest and cannot red this gate. Directory entries become
# prefix triggers and file entries stay literals; which is which is read off the working tree
# rather than restated here.
# shellcheck disable=SC2329  # invoked from the gate-table rows at table-construction time
getff_payload_trigger() {
  local src="scripts/build-getff-dist.sh" line entry out="" n=0
  [ -f "$src" ] || { printf '%s' "$GETFF_PAYLOAD_FALLBACK"; return; }
  line="$(grep -E '^PAYLOAD="' "$src" | head -1)"
  line="${line#PAYLOAD=\"}"; line="${line%\"}"
  for entry in $line; do
    # Anything not a plain literal path (a variable, a substitution) is unresolvable here; the
    # entry-count floor below turns a payload built that way into the broad fallback.
    case "$entry" in '' | *'$'* | *'`'* | *'*'*) continue ;; esac
    if [ -d "$entry" ]; then out="$out,$entry/"; n=$((n + 1))
    elif [ -e "$entry" ]; then out="$out,$entry"; n=$((n + 1))
    fi
  done
  [ "$n" -ge 10 ] || { printf '%s' "$GETFF_PAYLOAD_FALLBACK"; return; }
  printf '%s' "${out#,}"
}

# formatted_surface_trigger — the exact input set of `npm run format:check`.
# That script's PATHSPECS=( … ) array IS the population it enumerates with `git ls-files`, so a
# path outside it cannot be prettier-checked and cannot red this gate. Same derivation shape,
# same fallback reasoning, same both-directions fixpoint (arm 10 of the coverage test) as the
# payload trigger above.
#
# The hand-written `SHIPPED` token this replaced named six roots and was not that population:
# measured 2026-09-27, 57 of the script's 248 tracked files were outside it — all of
# `templates/`, `packages/core/eslint-rules/`, `packages/core/probes/`, the five named
# `packages/core/hooks/` files and `packages/runtime-bridge/vendor/`. A prettier-dirty edit to
# any of them selected no format gate at all and went red in CI instead.
# shellcheck disable=SC2329  # invoked from the gate-table rows at table-construction time
formatted_surface_trigger() {
  local src="scripts/format-shipped.sh" entry out="" n=0
  [ -f "$src" ] || { printf '%s' "$GETFF_PAYLOAD_FALLBACK"; return; }
  # The array body only: `sed` takes the PATHSPECS=( … ) block, drops its two delimiter lines and
  # every trailing comment, then word-splits what is left. A quoted or substituted entry is
  # unresolvable here and is dropped by the same literal-path filter the payload trigger uses.
  # shellcheck disable=SC2013  # word-splitting is the point: the array is one entry per word
  for entry in $(sed -n '/^PATHSPECS=(/,/^)/p' "$src" | sed '1d;$d; s/#.*//'); do
    case "$entry" in '' | *'$'* | *'`'* | *'*'*) continue ;; esac
    if [ -d "$entry" ]; then out="$out,$entry/"; n=$((n + 1))
    elif [ -e "$entry" ]; then out="$out,$entry"; n=$((n + 1))
    fi
  done
  [ "$n" -ge 8 ] || { printf '%s' "$GETFF_PAYLOAD_FALLBACK"; return; }
  printf '%s' "${out#,}"
}

# --- gate table: rank<TAB>name<TAB>trigger<TAB>command (cheapest rank first) ---
# trigger: ALWAYS | a path prefix (ends with /) | a suffix (starts with .) | a literal.
gate_table() {
  if [ -n "${SWEEP_GATES_FILE:-}" ]; then cat "$SWEEP_GATES_FILE"; return; fi
  # NOTE: the whole-tree `mechanical`-job scanners (md-line-gate, .md→.md dead-links,
  # stale-path, bash-syntax-of-all, json-validity) are deliberately EXCLUDED: they `find`
  # the working tree and so scan gitignored files (e.g. .claude/orchestrator-prompts/*.md)
  # that CI's clean checkout never has → false reds locally. They stay CI-only (peer of the
  # framework-self matrix). A `.md` diff gets an honest advisory gate instead.
  #
  # Two rows DERIVE their content from .github/workflows/audit-self.yml rather than restating
  # it: `script-selftests` greps the workflow for the scripts/**/*.test.sh steps it actually runs,
  # and `toolchain_pins_ok` reads the ast-grep/ruff/rustc pins out of their install steps. A
  # hand-maintained list of either goes stale silently — the first version of this row named
  # four self-tests and was already one short (`host-verify-coverage.test.sh`, added to CI in
  # #1339) before it ever merged. Deriving means a new CI step joins the sweep for free, and a
  # test present in scripts/ but wired to NO CI step (probe-channels.test.sh at time of
  # writing) correctly stays out — the sweep predicts CI, it does not invent gates.
  #
  # `citation-fullsweep` is triggered ALWAYS rather than by a path list, and that is the whole
  # point of the row: a `path:NN` citation goes stale when the CITED file moves, and any tracked
  # file can be a cited file (the 2026-09-14 case was `setup.d/10-skills.sh`). A prefix list here
  # would rebuild the exact hole the gate was built to close. It runs UNSCOPED — pre-push scopes
  # the blame arm to the push via `--affected-by`, but this row predicts the CI job, and the CI
  # job is the unscoped backstop. ~6.4s over the 103-file corpus, measured 2026-09-14.
  #
  # `docs-refresh` is ALWAYS for the same reason: a docs/site page cites arbitrary tracked files as
  # `sources:`, so any path can be the cited source that drifted. It runs the D26 gate over the
  # merge-base..HEAD range — the range the audit-self `docs-refresh` job evaluates on a
  # pull_request — and is git plumbing only (no install), so the unconditional run is cheap.
  #
  # `audit-ai-docs-live` is ALWAYS for the same reason again: its D5 probe fails on ANY file that
  # restates the goal without being enrolled, so no path list can say which diff might trip it.
  # ~2s for both implementations over git's view of the repo (measured 2026-09-28). A layout
  # without the auditor source (a consumer, which receives it as scripts/audit-ai-docs.sh) gets a
  # WARN-skip, never a crash.
  #
  # `install-sh-suite` delegates to scripts/run-install-sh-suite.sh (bounded parallel fan-out with
  # one quarantined test — see that file's header). THIS file is delivered into consumer projects
  # (setup.d/10-skills.sh:179, install.sh:1200) and the runner is NOT, which is deliberate: a
  # consumer has no tests/install-sh/ at all, so the row is never selected in diff mode, and under
  # --full it fails there exactly as it did before — measured 2026-09-14 in a bare directory, the
  # serial loop exited 1 on the unmatched glob and the runner call exits 127 on the missing file.
  # Shipping the runner would add an artefact to the install manifest for a battery consumers do
  # not have.
  #
  # `sweep-ci-coverage` is listed explicitly even though `script-selftests` would derive it: that
  # row's trigger is `scripts/` only, and a workflow-only diff — precisely the diff this metatest
  # exists to catch — would never select it. The duplicate run on a scripts/ diff is pure grep.
  # Its trigger also names `scripts/build-getff-dist.sh`, because that file is now the SOURCE of
  # the `getff-dist-manifest` trigger: a payload edit must re-check the derivation at the earliest
  # channel that can see it, not wait for CI.
  #
  # `claude-dir-ci-only` runs nothing. It exists so that narrowing `getff-dist-manifest` from
  # `.claude/` to the three shipped `.claude/` subdirectories does not leave `.claude/settings.json`
  # and `.claude/orchestrator-prompts/**` matching NO trigger — which the fail-safe below would
  # (correctly, but uselessly) turn into a full-sweep escalation on a log-file edit. Measured
  # 2026-09-14: without this row 17 tracked paths became newly unmapped; with it the unmapped set
  # is byte-identical to the pre-change one, at 64 paths. The row says out loud what actually
  # gates that payload, which is the honest answer the old `.claude/` mapping was hiding.
  #
  # Every other row reuses an already-committed script / npm-script VERBATIM. CI jobs whose
  # gate logic lives inline in the workflow YAML (rule-to-probe, enforce-husky-presence, the
  # six framework-self-* snapshot diffs, the synth-bundle functional smoke) are deliberately
  # NOT transcribed here: a second copy of that logic would drift from the workflow it claims
  # to predict (.claude/rules/dual-implementation-discipline.md). Closing those needs the
  # workflow's logic extracted to a script first — a separate change. The remaining uncovered
  # required jobs need a clean checkout, the network, or a toolchain the sweep must not
  # assume; see the coverage table in the header docs above.
  printf '%s\n' \
    "1${TAB}meta-all-wired${TAB}tests/install-sh/,.github/workflows/${TAB}bash tests/install-sh/meta-all-wired.test.sh" \
    "1${TAB}sweep-ci-coverage${TAB}.github/workflows/,scripts/run-local-ci-sweep.sh,scripts/build-getff-dist.sh${TAB}bash scripts/run-local-ci-sweep-coverage.test.sh" \
    "1${TAB}md-ci-only${TAB}.md${TAB}echo '[sweep] WARN: markdown line/dead-link gates run in CI only (local scan hits gitignored files) — verify on CI'" \
    "1${TAB}claude-dir-ci-only${TAB}.claude/${TAB}echo '[sweep] WARN: .claude/ is gated per-subtree, not as a whole. hooks/ skills/ templates/ ship, so getff-dist-manifest covers them; rules/ has render-check + rule-index-check. settings.json and orchestrator-prompts/ have no row of their own — their readers (the hooks harness-config drift test; vitest-spec-validation) are selected by their own triggers, and the whole-tree json/bash scanners are CI-only — verify on CI'" \
    "1${TAB}actionlint${TAB}.github/workflows/${TAB}{ command -v actionlint >/dev/null 2>&1 && actionlint .github/workflows/*.yml; } || echo '[sweep] WARN-skip actionlint absent'" \
    "1${TAB}alwayson-budget${TAB}CLAUDE.md,.claude/rules/,scripts/measure-always-on.sh,scripts/check-alwayson-budget.sh${TAB}bash scripts/measure-always-on.test.sh && bash scripts/check-alwayson-budget.test.sh && bash scripts/check-alwayson-budget.sh" \
    "2${TAB}format-check${TAB}$(formatted_surface_trigger)${TAB}npm run format:check" \
    "2${TAB}render-check${TAB}.claude/rules/${TAB}npx tsx packages/core/render/render-rules.ts --check" \
    "2${TAB}rule-index-check${TAB}.claude/rules/,AGENTS.md,scripts/render-rule-index.mjs${TAB}npx tsx scripts/render-rule-index.mjs --check" \
    "2${TAB}install-roster-check${TAB}INSTALL-FOR-AI.md,setup.d/,agents/,scripts/render-install-roster.mjs${TAB}npx tsx scripts/render-install-roster.mjs --check" \
    "2${TAB}presets-check${TAB}packages/core/templates/shared/AI-USAGE-GUIDE.md,.claude/skills/pipeline/references/presets/,scripts/render-presets.mjs${TAB}npx tsx scripts/render-presets.mjs --check" \
    "2${TAB}reference-check${TAB}setup.d/,skills/,agents/,.claude/,plugin/,packages/core/templates/,packages/core/manifest/,packages/runtime-bridge/src/cli/,scripts/,package.json,docs/site/reference/${TAB}npx tsx scripts/render-reference.mjs --check" \
    "2${TAB}face-facts-check${TAB}packages/core/manifest/,packages/core/templates/shared/,packages/core/composition/demo/,packages/core/principles/,packages/core/package.json,setup,install.sh,README.md,docs/,skills/getff/references/,scripts/render-face-facts.mjs,docs/site/face-facts.json${TAB}npx tsx scripts/render-face-facts.mjs --check" \
    "2${TAB}terms-style-check${TAB}docs/site/terms.md,docs/site-quality/vale/styles/getff/,scripts/render-terms-style.mjs${TAB}node scripts/render-terms-style.mjs --check" \
    "2${TAB}docs-quality-strict${TAB}docs/site/,docs/site-quality/,.claude/skills/docs-author/,agents/docs-form-auditor.md,scripts/docs-check.mjs,tests/docs-check/${TAB}if command -v vale >/dev/null 2>&1 && command -v lychee >/dev/null 2>&1; then node scripts/docs-check.mjs --strict && node scripts/docs-check.mjs --strict --profile prose; else echo '[sweep] WARN-skip docs-quality-strict: vale/lychee absent on host (CI installs them version+sha256-pinned)'; fi" \
    "2${TAB}script-selftests${TAB}scripts/${TAB}ts=\$(grep -oE 'scripts/([a-zA-Z0-9._-]+/)*[a-zA-Z0-9._-]+\\.test\\.sh' .github/workflows/audit-self.yml | sort -u); [ -n \"\$ts\" ] || { echo 'no scripts/*.test.sh steps found in audit-self.yml — derivation broke'; exit 1; }; for t in \$ts; do bash \"\$t\" || exit 1; done" \
    "3${TAB}citation-fullsweep${TAB}ALWAYS${TAB}node scripts/check-line-citations.mjs --check --corpus" \
    "3${TAB}pipefail-early-exit${TAB}install.sh,setup.d/,packages/core/audit-self/,packages/core/hooks/,packages/runtime-bridge/scripts/,.claude/hooks/,.claude/skills/,.husky/,scripts/,tests/install-sh/${TAB}node scripts/check-pipefail-early-exit.mjs" \
    "3${TAB}docs-refresh${TAB}ALWAYS${TAB}node scripts/check-docs-refresh.mjs \"\$(git merge-base origin/staging HEAD)..HEAD\"" \
    "3${TAB}audit-ai-docs-live${TAB}ALWAYS${TAB}if [ -f packages/core/audit-self/audit-ai-docs.sh ]; then bash packages/core/audit-self/audit-ai-docs.sh && npx --prefix packages/core tsx packages/core/audit-self/audit-ai-docs.ts; else echo '[sweep] WARN-skip audit-ai-docs-live: no packages/core/audit-self/ (not the authoring repo)'; fi" \
    "3${TAB}typecheck${TAB}packages/${TAB}npm run typecheck" \
    "3${TAB}shipped-rules-drift${TAB}packages/${TAB}bash scripts/build-shipped-eslint-rules.sh --check" \
    "3${TAB}getff-dist-manifest${TAB}$(getff_payload_trigger)${TAB}bash scripts/build-getff-dist.sh --check" \
    "3${TAB}shellcheck${TAB}setup.d/,install.sh,scripts/${TAB}{ command -v shellcheck >/dev/null 2>&1 && shellcheck -x -P SCRIPTDIR --exclude=SC2034,SC2016,SC2317 setup.d/*.sh install.sh scripts/*.sh scripts/lib/*.sh; } || echo '[sweep] WARN-skip shellcheck absent'" \
    "4${TAB}byte-identical${TAB}$(getff_payload_trigger),tests/install-sh/${TAB}SNAPSHOT_MODE=compare bash tests/install-sh/byte-identical.test.sh" \
    "4${TAB}synth-bundle-drift${TAB}packages/core/,package.json,package-lock.json${TAB}NODE_ENV=development bash scripts/build-synth-bundle.sh --check" \
    "4${TAB}runtime-bundles-drift${TAB}packages/core/,scripts/build-runtime-bundles.mjs,scripts/check-bundle-dep-parity.sh,package.json,package-lock.json${TAB}NODE_ENV=development node scripts/build-runtime-bundles.mjs --check" \
    "5${TAB}install-sh-suite${TAB}tests/install-sh/${TAB}bash scripts/run-install-sh-suite.sh tests/install-sh/" \
    "5${TAB}agnosticism${TAB}packages/core/${TAB}bash tests/agnosticism/harness-self.test.sh" \
    "5${TAB}premerge-carrier-selftest${TAB}packages/core/audit-self/${TAB}bash packages/core/audit-self/pre-merge-local.test.sh" \
    "5${TAB}mutation-runner-selftest${TAB}packages/core/synthesizer/${TAB}bash packages/core/synthesizer/run-generated-rule-mutation.test.sh && bash packages/core/synthesizer/run-rule-tests-firing.test.sh" \
    "5${TAB}hook-tests${TAB}packages/core/hooks/,tests/hooks/,.husky/${TAB}for t in tests/hooks/*.test.sh; do bash \"\$t\" || exit 1; done" \
    "5${TAB}dispatcher-tests${TAB}.claude/skills/dispatcher/,tests/dispatcher/${TAB}for t in tests/dispatcher/*.test.sh; do bash \"\$t\" || exit 1; done" \
    "5${TAB}measure-scripts${TAB}scripts/measure/${TAB}bash scripts/measure/measure.test.sh" \
    "5${TAB}plugin-aifdoctor-selftests${TAB}scripts/generate-plugin-twins.sh,agents/,.claude/hooks/,plugin/,tests/plugin/,tests/aif-doctor/,scripts/aif-doctor${TAB}ts=\$(grep -vE '^[[:space:]]*#' .github/workflows/audit-self.yml | grep -oE '(tests/plugin|tests/aif-doctor)/[a-zA-Z0-9._-]+\\.test\\.sh' | sort -u); [ -n \"\$ts\" ] || { echo 'no tests/plugin or tests/aif-doctor steps found in audit-self.yml — derivation broke'; exit 1; }; for t in \$ts; do bash \"\$t\" || exit 1; done" \
    "6${TAB}vitest-principles${TAB}packages/core/${TAB}npm --prefix packages/core run test:principles" \
    "6${TAB}vitest-hooks${TAB}packages/core/${TAB}npm --prefix packages/core run test:hooks" \
    "6${TAB}vitest-render${TAB}packages/core/${TAB}npm --prefix packages/core run test:render" \
    "6${TAB}vitest-ir${TAB}packages/core/${TAB}npm --prefix packages/core run test:ir" \
    "6${TAB}vitest-composition${TAB}packages/core/${TAB}npm --prefix packages/core run test:composition" \
    "6${TAB}vitest-backends${TAB}packages/core/${TAB}if toolchain_pins_ok; then npm --prefix packages/core run test:backends; else echo '[sweep] WARN-skip vitest-backends: host toolchain != CI pins'; fi" \
    "6${TAB}vitest-synthesizer${TAB}packages/core/${TAB}if toolchain_pins_ok; then npm --prefix packages/core run test:synthesizer; else echo '[sweep] WARN-skip vitest-synthesizer: host toolchain != CI pins'; fi" \
    "6${TAB}vitest-units${TAB}packages/core/${TAB}npm --prefix packages/core run test:units" \
    "6${TAB}vitest-skills${TAB}packages/core/${TAB}npm --prefix packages/core run test:skills" \
    "6${TAB}vitest-spec-validation${TAB}packages/core/${TAB}{ command -v gh >/dev/null 2>&1 && npm --prefix packages/core run test:spec-validation; } || echo '[sweep] WARN-skip vitest-spec-validation: gh absent (suite resolves action SHAs via the GitHub API)'" \
    "6${TAB}vitest-install-wire${TAB}packages/core/${TAB}npx --prefix packages/core vitest run --reporter=default packages/core/install/wire-live-snippet.test.ts packages/core/install/wire-synth-rules.test.ts" \
    "6${TAB}audit-ai-docs${TAB}packages/core/,docs/,skills/,agents/${TAB}npx --prefix packages/core vitest run --reporter=default packages/core/audit-self/audit-ai-docs.test.ts" \
    "6${TAB}canonical-regen${TAB}packages/${TAB}npm --prefix packages/core test --silent -- tests/acceptance/canonical-regen" \
    "6${TAB}first-steps-parity${TAB}packages/core/templates/shared/,packages/core/audit-self/${TAB}npx --prefix packages/core vitest run --reporter=default packages/core/audit-self/first-steps-parity.test.ts" \
    "6${TAB}template-render${TAB}packages/core/,install.sh,skills/${TAB}npm --prefix packages/core run test:template-render"
}

# `--list-gates` prints the table and exits. It exists so scripts/run-local-ci-sweep-coverage.test.sh
# reads the REAL gate_table() through the REAL argument parser, instead of scraping this file's
# printf block with a regex — a scrape is itself a second copy that drifts from what runs.
if [ "$LIST_GATES" -eq 1 ]; then gate_table; exit 0; fi

# --- toolchain_pins_ok ---
# rc 0 when every pinned toolchain binary that is PRESENT on PATH matches the version
# .github/workflows/audit-self.yml installs for it. An ABSENT binary is fine: the suites carry
# their own `it.skipIf(deriveToolVersion(...) === undefined)` and loud-skip. A PRESENT-but-
# DIFFERENT one is the problem — the capability-matrix toolchain-freshness gates assert the
# committed evidence version equals the version that actually resolves, so a host carrying
# ast-grep 0.45 reds locally while CI (pinned install step) stays green. That is a false red of
# exactly the class the `mechanical` scanners are excluded for, so the two toolchain-dependent
# vitest rows WARN-skip on a mismatch instead of failing the sweep.
#
# The pins are read OUT of the workflow, never restated here: a pin bump in audit-self.yml moves
# this guard with it, and a restated literal would be the drift this repo exists to prevent.
# shellcheck disable=SC2329  # invoked indirectly, from the gate-table rows via eval
toolchain_pins_ok() {
  local wf=".github/workflows/audit-self.yml" rc=0 pin live
  [ -f "$wf" ] || return 0

  pin="$(grep -oE '@ast-grep/cli@[0-9][0-9.]*' "$wf" | head -1 | sed 's/.*@//')"
  live="$(ast-grep --version 2>/dev/null | awk '{print $2}')"
  if [ -n "$live" ] && [ -n "$pin" ] && [ "$live" != "$pin" ]; then
    echo "[sweep] toolchain mismatch: ast-grep $live != audit-self.yml pin $pin"; rc=1
  fi

  pin="$(grep -oE 'ruff==[0-9][0-9.]*' "$wf" | head -1 | sed 's/.*==//')"
  live="$(ruff --version 2>/dev/null | awk '{print $2}')"
  if [ -n "$live" ] && [ -n "$pin" ] && [ "$live" != "$pin" ]; then
    echo "[sweep] toolchain mismatch: ruff $live != audit-self.yml pin $pin"; rc=1
  fi

  pin="$(grep -oE 'rustup toolchain install [0-9][0-9.]*' "$wf" | head -1 | awk '{print $4}')"
  live="$(rustc --version 2>/dev/null | awk '{print $2}')"
  if [ -n "$live" ] && [ -n "$pin" ] && [ "$live" != "$pin" ]; then
    echo "[sweep] toolchain mismatch: rustc $live != audit-self.yml pin $pin"; rc=1
  fi

  return "$rc"
}

# --- OFFLOAD: which rows the runner may take (see the header block) ---
# Routable = the row's runner is node tooling (tsc, vitest, tsx/node scripts) that starts no shell
# of its own — not in the command, not in an npm script it reaches, not in a node script it runs
# (row_shell_reason keeps such a row here anyway, and the coverage test REDs on the list) — AND
# the row costs the Mac more run here than routed. A one-row sweep that routes its row costs this
# Mac 1.8-2.9 CPU-s (sweep start, the one shell scan, the `pc-run` call; measured 2026-09-29, each
# side twice and alone, user+sys from /usr/bin/time -l), plus its shell arms: a vitest row's
# files that start a shell run here as well (SHELL ARMS in the header), so a suite where nearly
# every file does is not worth the call.
# Everything else stays here, for one of these reasons:
#   - it RUNS A SHELL: meta-all-wired, sweep-ci-coverage, alwayson-budget, script-selftests,
#     shipped-rules-drift, getff-dist-manifest, synth-bundle-drift, byte-identical, agnosticism,
#     premerge-carrier-selftest, mutation-runner-selftest, hook-tests, dispatcher-tests,
#     measure-scripts, plugin-aifdoctor-selftests, audit-ai-docs-live — and, one hop away,
#     format-check (npm run format:check is bash scripts/format-shipped.sh, which sources
#     setup.d/lib.sh), runtime-bundles-drift (build-runtime-bundles.mjs spawns
#     check-bundle-dep-parity.sh) and template-render (spawns install.sh). `bash` here is
#     /bin/bash 3.2 and the userland is BSD; CI is ubuntu-only, so this is the one place those
#     scripts meet the shell the operator's Mac and consumer Macs run them with.
#   - nearly every file of its suite starts a shell, so its arms would run it here anyway:
#     vitest-hooks (79 of 82 files, 2026-09-29), vitest-install-wire, audit-ai-docs and
#     first-steps-parity (every file).
#   - install-sh-suite routes its own battery (INSTALL_SH_HEAVY_RUNNER), keeping its
#     `# stays-local:` tests here; routing the row would take those along.
#   - it reads a host tool the runner does not pin to this host: actionlint, shellcheck,
#     docs-quality-strict (vale + lychee), vitest-spec-validation (an authenticated `gh`),
#     vitest-skills (skills/pipeline-english-canonical.test.ts:18 pins LC_ALL=en_US.UTF-8; a
#     runner without that locale generated falls back to C and the Cyrillic range matches
#     `×` and `—` — a false red there, measured 2026-09-29).
#   - it is cheaper than the call: render-check, rule-index-check, install-roster-check,
#     presets-check, terms-style-check, pipefail-early-exit, docs-refresh, and the two echo rows;
#     measured the same way (CPU-s here → routed): face-facts-check 0.9 → 2.1, canonical-regen
#     1.2 → 2.0, vitest-composition 1.9 → 2.4, vitest-ir 1.1 → 2.1.
SWEEP_ROUTABLE="${SWEEP_ROUTABLE-typecheck reference-check citation-fullsweep vitest-principles vitest-render vitest-backends vitest-synthesizer vitest-units}"
row_routable() { case " $SWEEP_ROUTABLE " in *" $1 "*) return 0 ;; esac; return 1; }

# cmd_sum <command> — a fingerprint of a row's command text AND of the file list this checkout's
# index tracks. The far end recomputes it from its own gate table and its own index and refuses
# to run on a mismatch: a stale mirror, or a file staged here and not yet committed (a runner
# that syncs the committed tree plus the working-tree diff sees it as untracked, and a row that
# enumerates with `git ls-files` would skip it there). Syncing the files' content is the
# runner's job. `-z`: names unquoted, so a host with another core.quotePath lists the same
# bytes. POSIX cksum: the same algorithm and output on BSD and GNU.
cmd_sum() { { printf '%s\n' "$1"; git ls-files -z 2>/dev/null; } | cksum | awk '{ print $1 "-" $2 }'; }

# SHELL_READERS — node scripts that name `.sh` files or `bash` only as text they read, one
# `<path><TAB><reason>` line each. Such a file is not a shell seed of its own (see shell_scan),
# so a row that runs it can route. An entry counts only while its reason is 20+ characters AND
# the file and its import closure start nothing but git and node (shell_scan checks every
# child_process call on each scan); an entry that stops passing marks its rows
# `reader-starts-more-than-git:<path>`, and the coverage test REDs on the list.
SHELL_READERS="${SWEEP_SHELL_READERS-scripts/render-reference.mjs${TAB}lists setup.d/*.sh and scripts/*.sh headers as text; spawns only git and node --check
scripts/render-install-roster.mjs${TAB}reads setup.d/20-agents.sh and 10-skills.sh as text; spawns nothing
scripts/lib/skill-tiers.mjs${TAB}reads setup.d/lib.sh as text to find the skill tiers; spawns nothing
scripts/census.mjs${TAB}parses scripts as text and keeps 'bash' in its verb set; spawns nothing
scripts/render-face-facts.mjs${TAB}reads install.sh as text to count its stack alternations; spawns nothing
scripts/check-line-citations.mjs${TAB}resolves citations into .sh files as text; spawns only git}"

# shell_scan — which files start a shell and which routable rows do (SHELL ARMS in the header).
# Prints, repo-relative:
#   mark<TAB><path>            a .ts/.mts/.mjs/.js/.cjs file under packages/core/ or scripts/
#                              that names bash or sh as a program or names a .sh file (not a
#                              SHELL_READERS entry), or imports such a file at any depth.
#   row<TAB><name><TAB><why>   a routable row that starts a shell: `runs-a-shell` (its command,
#                              or an npm script it reaches, names one or runs a shell script
#                              without an extension), `starts-a-shell:<path>` (it runs a marked
#                              node script), `setup-starts-a-shell:<path>` (a vitest row whose
#                              globalSetup/setupFiles start more than git and node),
#                              `reader-starts-more-than-git:<path>`, or a fail-closed answer —
#                              `unparsed-npm-call` (also npm behind another command),
#                              `unknown-workspace:<w>`, `unparsed-workspace-glob:<g>`,
#                              `npm-nested-too-deep`, `unscanned-script:<path>` (outside the two
#                              walked trees), `unresolved-script:<word>`, `node-eval`,
#                              `unparsed-vitest-setup:<config>`, `scan-error`.
# A file is marked when it names a shell or a .sh file, writes a shell shebang into a string, names
# a tracked shell script without an extension, spawns node/npm/npx/tsx (a script this pass does not
# follow), relatively imports a script outside the two trees, or imports a marked file.
# npm calls are followed as npm runs them: `--prefix`/`-C`, `--workspaces`/`-w`, `run`/`test`
# with their pre/post scripts, to depth 4. A vitest segment's file arguments are tests, not
# scripts: their shells are arms (shell_arms), not a reason. Node, not grep: depth needs relative
# import specifiers resolved to files. A basename match marks half the tree through `index` and
# `types` (measured 2026-09-29: 314 files in 31 s, against 193 in 0.1 s resolved). The caller
# runs it once and stops routing if it fails, since an empty answer would route every shell test.
shell_scan() {
  local rows="" n c
  while IFS="$TAB" read -r _ n _ c; do
    if [ -n "${n:-}" ] && row_routable "$n"; then rows="$rows$n$TAB$c
"; fi
  done <<EOF
$(gate_table)
EOF
  SWEEP_SCAN_READERS="$SHELL_READERS" SWEEP_SCAN_ROWS="$rows" node - <<'JS'
const fs = require('fs'), path = require('path'), cp = require('child_process');
const exts = ['.ts', '.mts', '.mjs', '.js', '.cjs'];
// A shell named as a program or a .sh file, a shell shebang written into a string (a stub the
// code writes and runs), or node/npm/npx/tsx spawned from code (it runs a script this pass does
// not follow, so it may start a shell).
const seedRe = /['"`]((\/[\w.-]+)*\/)?(ba)?sh['"` ]|\.sh['"`]|#!\s*\/\S*\/(env\s+)?(ba)?sh\b|\b(spawn|spawnSync|execFile|execFileSync|execa|execaSync|fork)\s*\(\s*(['"`](npm|npx|node|tsx)['"`]|process\.execPath)/;
const shebangSh = /^#!\s*\/\S*\/(env\s+)?(ba)?sh\b/;
const firstLine = (p) => { try { return fs.readFileSync(p, 'utf8').split('\n', 1)[0]; } catch { return ''; } };
const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
// Tracked shell scripts without an extension (setup, git hooks, plugin hook wrappers): code that
// names one starts a shell as surely as code that names a .sh file.
const extless = [...new Set(cp.execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 1 << 26 }).split('\0')
  .filter((f) => f && !path.extname(f) && isFile(f) && shebangSh.test(firstLine(f))).map((f) => path.basename(f)))];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const extlessRe = extless.length ? new RegExp('[\'"`](?:[^\'"`\\s]*\\/)?(' + extless.map(esc).join('|') + ')[\'"`]') : null;
const readers = new Map();
for (const l of (process.env.SWEEP_SCAN_READERS || '').split('\n')) {
  const [p, ...r] = l.split('\t');
  const why = r.join(' ').trim();
  if (p && p.trim() && why.length >= 20) readers.set(path.normalize(p.trim()), why);
}
const files = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (exts.includes(path.extname(e.name))) files.push(p);
  }
};
['packages/core', 'scripts'].forEach((r) => fs.existsSync(r) && walk(r));
const known = new Set(files), importers = new Map(), imports = new Map(), src = new Map(), outside = new Set();
const candidates = (b) => [b, b.replace(/\.(m?)js$/, '.$1ts'), ...exts.map((e) => b + e), ...exts.map((e) => path.join(b, 'index' + e))];
const resolve = (from, spec) => {
  const cs = candidates(path.join(path.dirname(from), spec));
  for (const c of cs) if (known.has(c)) return c;
  // A relative import of a script outside the two walked trees is not followed: mark the importer.
  if (cs.some((c) => exts.includes(path.extname(c)) && isFile(c))) outside.add(from);
  return null;
};
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  src.set(f, s);
  imports.set(f, []);
  for (const m of s.matchAll(/(?:from|import|require)\s*\(?\s*['"`](\.{1,2}\/[^'"`]+)['"`]/g)) {
    const t = resolve(f, m[1]);
    if (t) { imports.get(f).push(t); if (!importers.has(t)) importers.set(t, []); importers.get(t).push(f); }
  }
}
// startsOnlyGitAndNode: every child_process call in the file and its import closure is `git` or
// `process.execPath` by execFile/spawn, or an exec string that is one plain `git …` command. The
// check behind a SHELL_READERS entry and behind vitest's setup files; anything it cannot read —
// a namespace, default or require import of child_process, execa/zx/shelljs, `shell: true`, a
// computed first argument — fails it.
const gitOrNode = (src) => {
  if (/shell\s*:\s*true/.test(src)) return false;
  if (/import\s+(\*\s+as\s+)?\w+\s+from\s+['"](node:)?child_process['"]|require\s*\(\s*['"](node:)?child_process['"]\s*\)|from\s+['"](execa|zx|shelljs|cross-spawn)['"]/.test(src)) return false;
  const names = [];
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"](node:)?child_process['"]/g))
    for (const part of m[1].split(',')) {
      const [orig, local] = part.trim().split(/\s+as\s+/);
      if (orig) names.push([orig, local || orig]);
    }
  for (const [orig, n] of names)
    for (const m of src.matchAll(new RegExp('(?<![\\w.])' + esc(n) + '\\s*\\(\\s*([^,)]*)', 'g'))) {
      const a = m[1].trim();
      if (a === "'git'" || a === '"git"' || a === 'process.execPath') continue;
      if (/^exec(Sync)?$/.test(orig) && /^(['"`])git [^'"`;&|$<>(){}\\]*\1$/.test(a)) continue;
      return false;
    }
  return true;
};
const closureOk = (f, seen = new Set()) => {
  if (seen.has(f)) return true;
  seen.add(f);
  const s = src.has(f) ? src.get(f) : (isFile(f) ? fs.readFileSync(f, 'utf8') : null);
  if (s === null || outside.has(f) || !gitOrNode(s)) return false;
  return (imports.get(f) || []).every((t) => closureOk(t, seen));
};
const rejected = new Set();
for (const f of readers.keys()) if (known.has(f) && !closureOk(f)) rejected.add(f);
const exempt = (f) => readers.has(f) && !rejected.has(f);
const seedText = (s) => seedRe.test(s) || (extlessRe !== null && extlessRe.test(s));
const marked = new Set([...outside]);
for (const f of files) if (!exempt(f) && seedText(src.get(f))) marked.add(f);
const q = [...marked];
while (q.length) for (const i of importers.get(q.pop()) || []) if (!marked.has(i)) { marked.add(i); q.push(i); }

const unq = (t) => t.replace(/^[('"{]+|[)'"};]+$/g, '');
const words = (seg) => seg.trim().split(/\s+/).filter(Boolean).map(unq).filter(Boolean);
const segs = (text) => text.split(/&&|\|\||[;|&\n]/);
const pkg = (dir) => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); } catch { return {}; } };
const valued = ['--prefix', '-C', '-p', '--package', '-w', '--workspace', '-c', '--call'];
const program = (w) => {
  let i = 0;
  while (i < w.length && (/^[A-Za-z_]\w*=/.test(w[i]) || ['if', 'then', 'else', 'elif', 'do', 'while', 'until', '!'].includes(w[i]))) i++;
  if (w[i] === 'npx' || w[i] === 'exec')
    for (i++; i < w.length && w[i].startsWith('-'); i++) if (valued.includes(w[i])) i++;
  return i;
};
const workspaces = (dir, why) => {
  const out = [];
  for (const g of [].concat(pkg(dir).workspaces || [])) {
    if (typeof g !== 'string') { why.push('unparsed-workspaces'); continue; }
    if (g.endsWith('/*') && !g.slice(0, -2).includes('*')) {
      const base = path.join(dir, g.slice(0, -2));
      if (fs.existsSync(base)) for (const e of fs.readdirSync(base, { withFileTypes: true })) if (e.isDirectory()) out.push(path.join(base, e.name));
    } else if (g.includes('*')) why.push('unparsed-workspace-glob:' + g);
    else out.push(path.join(dir, g));
  }
  return out;
};
const workspace = (dir, v, why) => {
  if (v && fs.existsSync(path.join(dir, v, 'package.json'))) return path.join(dir, v);
  return workspaces(dir, why).find((d) => pkg(d).name === v) || null;
};
// expand: the command text plus every npm script it reaches, each with the directory npm runs it in.
const expand = (text, dir, depth, out, why) => {
  out.push({ text, dir });
  for (const seg of segs(text)) {
    const w = words(seg);
    let i = program(w);
    if (w[i] !== 'npm') {
      if (w.includes('npm')) why.push('unparsed-npm-call');
      continue;
    }
    if (depth >= 4) { why.push('npm-nested-too-deep'); continue; }
    let d = dir, ws = false, named = [], sub = null, name = null, extra = [];
    for (i++; i < w.length; i++) {
      const t = w[i];
      if (t === '--') { extra = extra.concat(w.slice(i + 1)); break; }
      if (t === '--prefix' || t === '-C') d = path.join(dir, w[++i] || '');
      else if (t.startsWith('--prefix=')) d = path.join(dir, t.slice(9));
      else if (t === '--workspaces' || t === '-ws') ws = true;
      else if (t === '-w' || t === '--workspace') named.push(w[++i]);
      else if (t.startsWith('--workspace=')) named.push(t.slice(12));
      else if (t.startsWith('-')) continue;
      else if (!sub) sub = t;
      else if (!name) name = t;
      else extra.push(t);
    }
    let script = null;
    if (['run', 'run-script', 'rum', 'urn'].includes(sub)) script = name;
    else if (['test', 't', 'tst'].includes(sub)) { script = 'test'; if (name) extra.unshift(name); }
    if (!script) { why.push('unparsed-npm-call'); continue; }
    let dirs = [d];
    if (ws || named.length) {
      dirs = ws ? workspaces(d, why) : [];
      for (const v of named) { const x = workspace(d, v, why); if (!x) { why.push('unknown-workspace:' + v); continue; } dirs.push(x); }
    }
    for (const pd of dirs) {
      const s = pkg(pd).scripts || {};
      for (const k of ['pre' + script, script, 'post' + script])
        if (typeof s[k] === 'string') expand(s[k] + (k === script && extra.length ? ' ' + extra.join(' ') : ''), pd, depth + 1, out, why);
    }
  }
};
// setupReason: vitest's globalSetup/setupFiles run in every vitest row, so a routed row takes them
// along whole — they must start only git and node (gitOrNode, over their import closure).
const setupReason = (dir) => {
  const cfg = ['vitest.config.ts', 'vitest.config.mts', 'vitest.config.js', 'vitest.config.mjs'].map((c) => path.join(dir, c)).find(isFile);
  if (!cfg) return '';
  const s = fs.readFileSync(cfg, 'utf8');
  for (const m of s.matchAll(/\b(globalSetup|setupFiles)\s*:\s*/g)) {
    const rest = s.slice(m.index + m[0].length);
    const v = rest.match(/^\[([^\]]*)\]|^(['"`][^'"`]*['"`])/);
    if (!v) return 'unparsed-vitest-setup:' + path.normalize(cfg);
    for (const lit of (v[1] !== undefined ? v[1] : v[2]).split(',').map((x) => x.trim()).filter(Boolean)) {
      if (!/^(['"`])[^'"`]*\1$/.test(lit)) return 'unparsed-vitest-setup:' + path.normalize(cfg);
      const f = path.normalize(path.join(dir, lit.slice(1, -1)));
      if (!closureOk(f)) return 'setup-starts-a-shell:' + f;
    }
  }
  return '';
};
const nodeValued = ['--import', '--require', '-r', '--loader', '--experimental-loader', '--conditions', '-C'];
const rel = (p) => path.normalize(p);
for (const line of (process.env.SWEEP_SCAN_ROWS || '').split('\n')) {
  const tab = line.indexOf('\t');
  if (tab < 1) continue;
  const name = line.slice(0, tab), cmd = line.slice(tab + 1);
  let reason = '';
  try {
    const texts = [], why = [];
    expand(cmd, '.', 0, texts, why);
    if (why.length) reason = why[0];
    else if (texts.some((x) => /(^|[\s;|&("'`=])(\S*\/)?(ba)?sh([\s;|&)"'`]|$)|\.sh(\W|$)/.test(x.text))) reason = 'runs-a-shell';
    else {
      outer: for (const x of texts) for (const seg of segs(x.text)) {
        const w = words(seg), i = program(w);
        if (w[i] === 'vitest') {
          const r = setupReason(x.dir);
          if (r) { reason = r; break outer; }
          continue;
        }
        const runner = ['node', 'tsx', 'ts-node'].includes(w[i]);
        let entry = runner;
        for (let j = i; j < w.length; j++) {
          let t = w[j];
          if (runner && j > i && /^(-e|--eval|-p|--print)$/.test(t)) { reason = 'node-eval'; break outer; }
          if (t.startsWith('-')) {
            if (runner && nodeValued.includes(t)) j++;
            t = t.replace(/^[^=]*=?/, '');
          }
          t = t.replace(/^\.\//, '');
          if (!t || j === i && runner) continue;
          let p = rel(path.join(x.dir, t));
          if (entry && !w[j].startsWith('-')) {
            entry = false;
            if (!exts.includes(path.extname(t))) {
              const hit = candidates(p).find((c) => exts.includes(path.extname(c)) && isFile(c));
              if (!hit) { reason = 'unresolved-script:' + t; break outer; }
              p = rel(hit);
            }
          } else if (!exts.includes(path.extname(t))) {
            if (isFile(p) && shebangSh.test(firstLine(p))) { reason = 'runs-a-shell'; break outer; }
            continue;
          }
          if (marked.has(p)) { reason = (rejected.has(p) ? 'reader-starts-more-than-git:' : 'starts-a-shell:') + p; break outer; }
          if (!known.has(p)) { reason = (isFile(p) ? 'unscanned-script:' : 'unresolved-script:') + p; break outer; }
        }
      }
    }
  } catch (e) {
    reason = 'scan-error';
  }
  if (reason) process.stdout.write('row\t' + name + '\t' + reason + '\n');
}
for (const f of [...marked].sort()) process.stdout.write('mark\t' + f + '\n');
JS
}
SHELL_SCAN=""

# vitest_scope <command> — the vitest path filters a row's run applies, relative to packages/core:
# empty when the row runs no vitest, UNKNOWN when it runs vitest in a shape this parser does not
# read. Three shapes are read: `npm --prefix packages/core run test:<suite>` (the suite's filters
# come from packages/core/package.json, never restated here), `npm --prefix packages/core test …
# -- <filter>…`, and `vitest run packages/core/<file>…`. A routable row that answers UNKNOWN is
# kept here (see the main loop), and the coverage test REDs on it, because its shell arms could
# not be found.
# Always called inside $( ): the `set -f` that keeps the word lists from globbing ends with it.
vitest_scope() {
  local cmd="$1" suite script tok out=""
  set -f
  case "$cmd" in *vitest* | *"run test:"* | *"packages/core test"*) ;; *) return 0 ;; esac
  suite="$(printf '%s\n' "$cmd" | grep -oE 'run test:[a-z0-9-]+' | head -1)"
  if [ -n "$suite" ]; then
    script="$(node -e 'const s = require("./packages/core/package.json").scripts || {}; process.stdout.write(s[process.argv[1]] || "")' "${suite#run }" 2>/dev/null)"
    case "$script" in "vitest run "*) ;; *) printf 'UNKNOWN'; return 0 ;; esac
    for tok in ${script#vitest run }; do
      case "$tok" in -*) ;; *) out="$out $tok" ;; esac
    done
  else
    case "$cmd" in
      *"--prefix packages/core test"*" -- "*)
        for tok in ${cmd##*" -- "}; do
          case "$tok" in -*) ;; *) out="$out $tok" ;; esac
        done ;;
      *)
        for tok in $cmd; do
          case "$tok" in packages/core/*.test.ts | packages/core/*.audit.ts) out="$out ${tok#packages/core/}" ;; esac
        done ;;
    esac
  fi
  if [ -z "$out" ]; then printf 'UNKNOWN'; return 0; fi
  printf '%s' "${out# }"
}

# shell_arms <command> — the files in the row's vitest scope that start a shell (the `mark` lines
# of $SHELL_SCAN; see SHELL ARMS in the header), relative to packages/core, space-separated. A file
# is in scope when one of the row's filters is a substring of its path — vitest's own rule for a
# CLI filter, so `hooks/` here selects exactly what `vitest run hooks/` runs.
shell_arms() {
  local scope f tok out=""
  set -f
  scope="$(vitest_scope "$1")"
  case "$scope" in '' | UNKNOWN) return 0 ;; esac
  while IFS= read -r f; do
    for tok in $scope; do
      case "$f" in *"$tok"*) out="$out $f"; break ;; esac
    done
  done <<EOF
$(awk -F'\t' '$1 == "mark" { print $2 }' <<<"$SHELL_SCAN" | sed -n 's|^packages/core/||p' | grep -E '\.(test|audit)\.ts$')
EOF
  printf '%s' "${out# }"
}

# scope_count <command> — how many test files the row's vitest scope holds (shell_arms' rule).
scope_count() {
  local scope f tok n=0
  set -f
  scope="$(vitest_scope "$1")"
  for f in $(cd packages/core 2>/dev/null && find . -name node_modules -prune -o \( -name '*.test.ts' -o -name '*.audit.ts' \) -print | sed 's|^\./||'); do
    for tok in $scope; do
      case "$f" in *"$tok"*) n=$((n + 1)); break ;; esac
    done
  done
  printf '%s' "$n"
}

# row_shell_reason <name> <command> — why a routable row stays here after all, or nothing: the
# row's `row` line of $SHELL_SCAN (it starts a shell, or could not be read), else — for a vitest
# row — `every-file-starts-a-shell` when every file of its scope does (its arms would be the whole
# row).
row_shell_reason() {
  local why arms
  set -f
  why="$(awk -F'\t' -v n="$1" '$1 == "row" && $2 == n { print $3; exit }' <<<"$SHELL_SCAN")"
  if [ -n "$why" ]; then printf '%s' "$why"; return 0; fi
  case "$(vitest_scope "$2")" in '' | UNKNOWN) return 0 ;; esac
  arms="$(shell_arms "$2")"
  [ -n "$arms" ] && [ "$(wc -w <<<"$arms" | tr -d ' ')" -ge "$(scope_count "$2")" ] && printf 'every-file-starts-a-shell'
  return 0
}

# loud_skip_here <output> — succeeds when a green run's output carries a loud skip (`⚠ … SKIPPED`,
# the backends' convention) naming a program this host has on PATH: the runner lacked the tool,
# and this host can run the test for real. `tr` leaves word characters only, so nothing globs.
loud_skip_here() {
  local w
  for w in $(LC_ALL=C sed -n 's/.*⚠\(.*\)SKIPPED.*/\1/p' <<<"$1" | LC_ALL=C tr -c 'A-Za-z0-9._\n-' ' '); do
    type -P "$w" >/dev/null 2>&1 && return 0
  done
  return 1
}

# --- the far end: `--run-row <name>` runs exactly one row of THIS checkout's table ---
# It never selects, never refuses on a dirty tree and never routes again. The receipt is written
# only after the row finished and is the whole verdict, so the exit code is 0 once it is written:
# a runner reads a non-zero exit as its own business (pc-run re-runs a 127 locally).
if [ -n "$RUN_ROW" ]; then
  exec 3>&2
  row_cmd=""
  found=0
  while IFS="$TAB" read -r _ n _ c; do
    [ "${n:-}" = "$RUN_ROW" ] || continue
    row_cmd="$c"; found=1; break
  done <<EOF
$(gate_table)
EOF
  if [ "$found" -eq 0 ]; then
    echo "[sweep:run-row] NOT RUN: no row named '$RUN_ROW' in this checkout's gate table"
    exit 2
  fi
  if [ -n "$RUN_ROW_SUM" ] && [ "$(cmd_sum "$row_cmd")" != "$RUN_ROW_SUM" ]; then
    echo "[sweep:run-row] NOT RUN: row '$RUN_ROW' or the tracked file list here differs from the caller's (checksum) — stale mirror, or a file staged there and not committed?"
    exit 2
  fi
  host="runner"
  if [ -n "$RUN_ROW_ORIGIN" ] && [ -e "$RUN_ROW_ORIGIN" ]; then host="origin"; fi
  (eval "$row_cmd") </dev/null
  rrc=$?
  printf '[sweep:receipt %s] row=%s rc=%s host=%s\n' "$RUN_ROW_RECEIPT" "$RUN_ROW" "$rrc" "$host"
  exit 0
fi

# --- `--route-plan`: where each row would go, and which shell arms stay here ---
# One line per row: name<TAB>route|local<TAB>arms-or-reason. A listed name with no row prints
# `missing`. Read by run-local-ci-sweep-coverage.test.sh through the real parser, like --list-gates.
if [ "$ROUTE_PLAN" -eq 1 ]; then
  if ! SHELL_SCAN="$(shell_scan)"; then
    echo "[sweep] --route-plan: cannot find the files that start a shell (node failed)" >&2
    exit 2
  fi
  PLAN_TABLE="$(gate_table)"
  while IFS="$TAB" read -r _ n _ c; do
    [ -z "${n:-}" ] && continue
    if ! row_routable "$n"; then printf '%s\tlocal\t\n' "$n"
    elif [ "$(vitest_scope "$c")" = UNKNOWN ]; then printf '%s\tlocal\tunparsed-vitest-shape\n' "$n"
    elif reason="$(row_shell_reason "$n" "$c")" && [ -n "$reason" ]; then printf '%s\tlocal\t%s\n' "$n" "$reason"
    else printf '%s\troute\t%s\n' "$n" "$(shell_arms "$c")"
    fi
  done <<EOF
$PLAN_TABLE
EOF
  for n in $SWEEP_ROUTABLE; do
    case "$PLAN_TABLE" in *"$TAB$n$TAB"*) ;; *) printf '%s\tmissing\t\n' "$n" ;; esac
  done
  exit 0
fi

# --- changed paths (vs merge-base) ---
changed_paths() {
  # shellcheck disable=SC2086  # SWEEP_DIFF_OVERRIDE is a deliberate word-split list of paths
  if [ -n "${SWEEP_DIFF_OVERRIDE:-}" ]; then printf '%s\n' $SWEEP_DIFF_OVERRIDE; return; fi
  local base="${BASE_REF:-$(git merge-base origin/staging HEAD 2>/dev/null || echo HEAD~1)}"
  git diff --name-only "${base}...HEAD"
}

# --- working-tree changes the committed diff above cannot see ---
# Raw `git status --porcelain` lines, status letters kept: `M` vs `??` is the operator's first
# question when the refusal below fires, and re-deriving it costs a second command. Gitignored
# files are absent by construction (no `--ignored`), which is right — CI never sees them either.
# Outside a repo (or with git absent) this yields nothing and the refusal cannot fire; the
# sweep degrades to its previous behaviour rather than blocking on a condition it cannot read.
dirty_paths() {
  git status --porcelain 2>/dev/null
}

# --- trigger_matches <trigger-list> <path> ---
# trigger-list is one or more triggers joined by commas; matches if ANY matches.
# Each trigger: ALWAYS | a prefix (ends with /) | a suffix (starts with .) | a literal.
trigger_matches() {
  local triglist="$1" p="$2" trig
  local IFS=,
  for trig in $triglist; do
    case "$trig" in
      ALWAYS) return 0 ;;
      */) case "$p" in "$trig"*) return 0 ;; esac ;;   # prefix (before suffix: .github/workflows/ is both .*-prefixed and /-suffixed)
      .*) case "$p" in *"$trig") return 0 ;; esac ;;   # suffix
      *) case "$p" in "$trig") return 0 ;; esac ;;       # literal/glob
    esac
  done
  return 1
}

CHANGED="$(changed_paths)"

# --- fail-safe: any changed path matching NO gate trigger → escalate to --full ---
# An ALWAYS row is deliberately NOT counted as coverage for a path. ALWAYS means
# "unconditional", not "matches every path": counting it would make every path look mapped and
# silently retire this whole fail-safe the moment the first ALWAYS row landed. Measured
# 2026-09-14 while adding `citation-fullsweep`: with the ALWAYS row counted,
# SWEEP_DIFF_OVERRIDE=weird/unmapped.bin went from "escalating to --full" (every gate) to
# "1 gate(s) passed" — a false green of exactly the shape this script exists to prevent.
if [ "$MODE" = "diff" ] && [ -n "$CHANGED" ]; then
  GATES_SNAPSHOT="$(gate_table)"
  while IFS= read -r p; do
    [ -z "$p" ] && continue
    matched=0
    while IFS="$TAB" read -r _ n trig _; do
      [ -z "${n:-}" ] && continue
      case ",$trig," in *,ALWAYS,*) continue ;; esac
      if trigger_matches "$trig" "$p"; then matched=1; break; fi
    done <<EOF
$GATES_SNAPSHOT
EOF
    if [ "$matched" -eq 0 ]; then
      echo "[sweep] unmapped path '$p' → escalating to --full"
      MODE="full"
      break
    fi
  done <<EOF
$CHANGED
EOF
fi

# --- gate_selected <trigger> ---
# Sets GATE_SELECTED_BY on every match: "diff" when a CHANGED PATH matched the trigger,
# "always" for an ALWAYS row, "full" in --full mode. The dirty-tree refusal at the tail keys
# on the "diff" count, never on the raw run count: an ALWAYS row runs whatever the diff says,
# so counting it as coverage would silently retire that refusal the moment the first ALWAYS
# row landed. Measured 2026-09-14 on the merge that first put the two together — this file's
# own `citation-fullsweep` row (#1772) against the refusal (#1780): `ran` was never 0 again,
# and the refusal's two mechanism arms went red. Same shape as the coverage exclusion above.
GATE_SELECTED_BY=""
gate_selected() {
  GATE_SELECTED_BY=""
  [ "$MODE" = "full" ] && { GATE_SELECTED_BY="full"; return 0; }
  local trig="$1" p
  # ALWAYS means always — including an EMPTY diff. The loop below is driven by $CHANGED, so
  # without this short-circuit an ALWAYS row selects nothing when the diff is empty and the
  # sweep prints "no gates selected" — the `#hope-as-gate` shape
  # (.claude/rules/attention-is-not-a-mechanism.md §2). Observed 2026-09-14 on the first run
  # of the `citation-fullsweep` row, against a tree whose changes were all uncommitted.
  case ",$trig," in *,ALWAYS,*) GATE_SELECTED_BY="always"; return 0 ;; esac
  while IFS= read -r p; do
    [ -z "$p" ] && continue
    if trigger_matches "$trig" "$p"; then GATE_SELECTED_BY="diff"; return 0; fi
  done <<EOF
$CHANGED
EOF
  return 1
}

# --- run selected gates, cheapest-first, fail-fast ---
# eval runs in a SUBSHELL: a gate command carrying its own `exit 1` (install-sh-suite's
# per-test loop) must fail THAT gate, not kill the sweep mid-loop. Without the subshell the
# sweep self-truncated: rc=1 with no `[sweep] FAIL` / `SWEEP: stopped at` lines and the
# rank-6 gates silently never ran (handoff item 3, 2026-07-25).
#
# `</dev/null` is the second half of the same defence, and it is load-bearing. The loop is
# driven by a heredoc on STDIN, and the gate subshell inherits that STDIN — so any gate whose
# command reads stdin EATS the remaining gate lines. The sweep then prints a plausible
# all-PASS tail and exits 0 having silently skipped every gate below it. Observed 2026-08-09
# the moment the tests/hooks/*.test.sh battery was added: `--full` reported "16 gate(s)
# passed" while install-sh-suite and all eleven rank-6 gates never ran (the pre-push
# stdin-detection tests feed the hook on stdin). A truncated sweep that exits 0 is worse than
# no sweep — it is the exact false-green this script exists to prevent.
# Created lazily, on the first gate that actually runs: `--list-gates` and a diff that selects
# nothing must not litter a directory. A location that cannot be created degrades to "no log
# files" — the FAIL tail below still prints, so a read-only TMPDIR loses the archive, never the
# diagnostic itself.
LOG_DIR_FAILED=0
ensure_log_dir() {
  if [ "$LOG_DIR_READY" -eq 1 ] || [ "$LOG_DIR_FAILED" -eq 1 ]; then
    return "$LOG_DIR_FAILED"
  fi
  if [ -n "$SWEEP_LOG_DIR" ]; then
    if ! mkdir -p "$SWEEP_LOG_DIR" 2>/dev/null; then LOG_DIR_FAILED=1; return 1; fi
  else
    SWEEP_LOG_DIR="$(mktemp -d "${TMPDIR:-/tmp}/run-local-ci-sweep.XXXXXX" 2>/dev/null)" || SWEEP_LOG_DIR=""
    if [ -z "$SWEEP_LOG_DIR" ]; then LOG_DIR_FAILED=1; return 1; fi
  fi
  LOG_DIR_READY=1
  return 0
}

# ── fd 3: the live progress channel ────────────────────────────────────────────────────────────
# Gate output is CAPTURED (see the eval line below), so a long-running gate is silent for its whole
# duration: while `install-sh-suite` ran its 114-file battery the sweep printed nothing for ~30
# minutes and a working run was indistinguishable from a hung one — proving liveness meant walking
# the process tree with `pgrep -P` by hand, three times in one session on 2026-09-14. A mechanism
# whose state is recovered by human attention is the shape
# .claude/rules/attention-is-not-a-mechanism.md §1 forbids.
#
# fd 3 is the escape hatch: it is NOT touched by the `2>&1` capture, so anything a gate writes
# there reaches the operator live. Gates that emit progress must write to fd 3 and must tolerate
# it being closed (they run standalone in CI too) — see scripts/run-install-sh-suite.sh
# `progress()`. Nothing is FORCED onto fd 3: a gate that ignores it behaves exactly as before.
exec 3>&2

# --- OFFLOAD: routing is on only with a runner, without PC_LOCAL (see the header block) ---
RUNNER="${SWEEP_HEAVY_RUNNER:-}"
ROUTING=0
RUNNER_NAME=""
ORIGIN_MARK=""
ROUTED_N=0
FELLBACK_N=0
# ONE STRIKE (see the header): set to the first routed row's failure reason; routing stops there.
RUNNER_TRIPPED=""
if [ -n "$RUNNER" ] && [ -z "${PC_LOCAL:-}" ]; then
  if ! command -v "$RUNNER" >/dev/null 2>&1; then
    echo "[sweep] SWEEP_HEAVY_RUNNER='$RUNNER' is not an executable command."
    echo "        Fix the path, or unset SWEEP_HEAVY_RUNNER to run every gate here."
    exit 2
  fi
  # The origin mark: a file that exists only on THIS host. The far end finds it only when the
  # runner ran it here (its own fallback), which is how a PASS can say where it actually ran.
  if ORIGIN_MARK="$(mktemp "${TMPDIR:-/tmp}/sweep-origin.XXXXXX" 2>/dev/null)"; then
    ROUTING=1
    RUNNER_NAME="$(basename "$RUNNER")"
    trap 'rm -f "$ORIGIN_MARK"' EXIT
  else
    ORIGIN_MARK=""
    echo "[sweep] WARN-ROUTE: cannot create an origin mark under ${TMPDIR:-/tmp} — every row runs here" >&3
  fi
  # Which test files start a shell decides what stays here; without that answer nothing routes.
  if [ "$ROUTING" -eq 1 ] && ! SHELL_SCAN="$(shell_scan 2>/dev/null)"; then
    ROUTING=0
    echo "[sweep] WARN-ROUTE: cannot find the files that start a shell (node failed) — every row runs here" >&3
  fi
fi

# run_routed <name> <command> — run one routable row through the runner. Sets `out` (the output
# of the run whose exit code is the verdict), `rc`, `where` (a label for the PASS/FAIL line) and
# `route_log` (what the runner said when its result was not used — kept in the log file).
run_routed() {
  local name="$1" cmd="$2" nonce raw rrc receipt r_rc r_host arms aout arc degraded
  route_log=""
  nonce="$$.$ran.$RANDOM$RANDOM"
  printf '[sweep] %s → %s\n' "$name" "$RUNNER_NAME" >&3
  raw="$( (cd "$REPO_ROOT" && exec "$RUNNER" bash scripts/run-local-ci-sweep.sh --run-row "$name" \
    --receipt "$nonce" --cmd-sum "$(cmd_sum "$cmd")" --origin "$ORIGIN_MARK") 2>&1 </dev/null )"
  rrc=$?
  # tr: a runner that crosses a Windows hop may hand lines back with a CR on the end.
  receipt="$(printf '%s\n' "$raw" | grep -F "[sweep:receipt $nonce] " | tail -1 | tr -d '\r')"
  r_rc="${receipt##* rc=}"; r_rc="${r_rc%% *}"
  r_host="${receipt##* host=}"
  case "$r_rc" in '' | *[!0-9]*) receipt="" ;; esac

  if [ -z "$receipt" ]; then
    # Nothing was measured on the runner. Run it here; the runner's own words go to the log.
    route_log="$raw
[sweep] $name: $RUNNER_NAME returned no result (exit $rrc) — ran here instead
"
    out="$( (eval "$cmd") 2>&1 </dev/null )"; rc=$?
    where="here — no result from $RUNNER_NAME"
    RUNNER_TRIPPED="no result for $name"
    FELLBACK_N=$((FELLBACK_N + 1))
    return
  fi
  if [ "$r_host" = "origin" ]; then
    out="$raw"; rc="$r_rc"
    where="here — $RUNNER_NAME fell back to this host"
    RUNNER_TRIPPED="it fell back to this host on $name"
    FELLBACK_N=$((FELLBACK_N + 1))
    return
  fi
  out="$raw"; rc="$r_rc"; where="on $RUNNER_NAME"
  # The receipt is the verdict; a runner that still exits non-zero (its own cleanup) is noted.
  [ "$rrc" -eq 0 ] || route_log="[sweep] $name: $RUNNER_NAME exited $rrc after the receipt (rc=$r_rc)
"
  if [ "$rc" -ne 0 ]; then
    case "$raw" in
      *'Test timed out in '* | *'Hook timed out in '*)
        # The runner was too slow for the suite's own budget (see the header): not a verdict on
        # the code. The local run is.
        route_log="$route_log$raw
[sweep] $name: timed out on $RUNNER_NAME — ran here instead
"
        out="$( (eval "$cmd") 2>&1 </dev/null )"; rc=$?
        where="here — timed out on $RUNNER_NAME"
        RUNNER_TRIPPED="a timeout in $name"
        FELLBACK_N=$((FELLBACK_N + 1))
        return ;;
    esac
  fi
  if [ "$rc" -eq 0 ]; then
    case "$out" in *'[sweep] WARN'*) degraded=1 ;; *) degraded=0 ;; esac
    [ "$degraded" -eq 1 ] || ! loud_skip_here "$out" || degraded=1
    if [ "$degraded" -eq 1 ]; then
      # Degraded there (a tool the runner lacks or holds at another version). Here it may run
      # for real — and if it degrades here too, the verdict is exactly what it would have been.
      route_log="$route_log$raw
[sweep] $name: degraded on $RUNNER_NAME — ran here instead
"
      out="$( (eval "$cmd") 2>&1 </dev/null )"; rc=$?
      where="here — degraded on $RUNNER_NAME"
      FELLBACK_N=$((FELLBACK_N + 1))
      return
    fi
    arms="$(shell_arms "$cmd")"
    if [ -n "$arms" ]; then
      printf '[sweep] %s: %s shell arm file(s) here\n' "$name" "$(printf '%s\n' "$arms" | wc -w | tr -d ' ')" >&3
      # shellcheck disable=SC2086  # arms is a word list of paths, split on purpose (set -f: no globbing)
      aout="$(cd "$REPO_ROOT/packages/core" && set -f && npx vitest run --reporter=default $arms 2>&1 </dev/null)"
      arc=$?
      out="$out
----- $name: shell arms, run here (bash 3.2): $arms -----
$aout"
      [ "$arc" -eq 0 ] || rc="$arc"
      where="on $RUNNER_NAME + shell arms here"
    fi
  fi
  ROUTED_N=$((ROUTED_N + 1))
}

ran=0
diff_selected=0
SORTED="$(gate_table | sort -t"$TAB" -k1,1n)"
while IFS="$TAB" read -r _ name trigger cmd; do
  [ -z "${name:-}" ] && continue
  gate_selected "$trigger" || continue
  ran=$((ran + 1))
  [ "$GATE_SELECTED_BY" = "diff" ] && diff_selected=$((diff_selected + 1))
  # Output is CAPTURED, not discarded, for two reasons. (1) Several rows degrade to a WARN-skip
  # instead of failing (actionlint/shellcheck absent, host toolchain != CI pins, the CI-only
  # markdown scanners). Piping their stdout to /dev/null made every one of those print a plain
  # `PASS`, indistinguishable from a real run — a warning whose only consumer is a log nobody
  # can read (.claude/rules/attention-is-not-a-mechanism.md §2 `#warning-nobody-reads`). A
  # degraded gate now says so on its own line; rc is unchanged either way.
  # (2) The captured text is then WRITTEN OUT, pass or fail. It used to be read for the WARN
  # classification and then dropped on the floor — so a FAIL printed a bare gate name and the
  # evidence was gone, which is the same `#warning-nobody-reads` shape one branch lower: the
  # only consumer of a failing gate's output was a variable nobody could read.
  where=""
  route_log=""
  # A listed row whose vitest shape is unreadable, or that starts a shell itself, runs here (the
  # coverage test REDs on either, so the list gets fixed rather than the row silently moving).
  if [ "$ROUTING" -eq 1 ] && row_routable "$name" && [ "$(vitest_scope "$cmd")" != UNKNOWN ] \
    && [ -z "$(row_shell_reason "$name" "$cmd")" ]; then
    if [ -n "$RUNNER_TRIPPED" ]; then
      out="$( (eval "$cmd") 2>&1 </dev/null )"; rc=$?
      where="here — $RUNNER_NAME skipped after $RUNNER_TRIPPED"
      FELLBACK_N=$((FELLBACK_N + 1))
    else
      run_routed "$name" "$cmd"
    fi
  else
    out="$( (eval "$cmd") 2>&1 </dev/null )"; rc=$?
  fi
  at="${where:+ · $where}"
  log_path=""
  if ensure_log_dir; then
    # Gate names come from gate_table()/$SWEEP_GATES_FILE, not from user input, but sanitise
    # anyway: one `/` in a name would otherwise write outside the log dir (or just fail).
    safe_name="${name//[^A-Za-z0-9._-]/_}"
    log_path="$SWEEP_LOG_DIR/$(printf '%02d' "$ran")-${safe_name}.log"
    printf '%s%s\n' "$route_log" "$out" >"$log_path" 2>/dev/null || log_path=""
  fi
  if [ "$rc" -eq 0 ]; then
    case "$out" in
      # `[sweep] WARN`-prefixed only: every degrade row in the table emits that exact prefix,
      # while several install-sh tests legitimately print bare "WARN" during a real run
      # (nvmrc-ci-drift, r2-glob-reach) — matching those would mislabel a genuine pass.
      *'[sweep] WARN'*) echo "[sweep] WARN-SKIP $name$at — degraded, NOT a real run" ;;
      *) echo "[sweep] PASS $name$at" ;;
    esac
  else
    if [ -n "$log_path" ]; then
      echo "[sweep] FAIL $name$at — output: $log_path"
    else
      echo "[sweep] FAIL $name$at — output: (log dir unavailable, tail below only)"
    fi
    # The path alone would still make the operator run a second command to see anything, and in
    # a remote/agent session the file may not be reachable at all. Print a bounded tail so the
    # common case needs no follow-up; the file holds the untruncated text.
    echo "----- $name: last 40 lines of output -----"
    printf '%s\n' "$out" | tail -40
    echo "----- end $name output -----"
    echo "SWEEP: stopped at $name (mode=$MODE)"
    [ -n "$log_path" ] && echo "SWEEP: gate logs in $SWEEP_LOG_DIR"
    exit 1
  fi
done <<EOF
$SORTED
EOF

if [ "$diff_selected" -eq 0 ] && [ "$MODE" != "full" ]; then
  # No gate was selected BY THE DIFF. `changed_paths` reads the COMMITTED diff, so this is an honest answer only
  # when the working tree is also clean. On a dirty tree it is the false-green this script's
  # `</dev/null` note above already names as worse than no sweep: an operator who runs the sweep
  # mid-work to check their edits gets rc 0 about changes no gate ever looked at. Measured
  # 2026-09-14 (worktree cool-swanson-d3f4b6): two modified-but-uncommitted files produced
  # exactly `SWEEP: no gates selected for this diff (mode=diff)` and EXIT=0.
  #
  # The refusal is the EXIT CODE, not this text — a warning line whose only consumer is someone
  # reading the log is `#warning-nobody-reads`
  # (.claude/rules/attention-is-not-a-mechanism.md §2), which is what the defect already was.
  #
  # Scoped to the zero-gates case deliberately. Refusing on ANY dirty tree would break the
  # script's own stated purpose (line 2: harvest pre-push): .claude/skills/harvest/SKILL.md §1
  # harvests a COMMITTED branch out of a deliberately polluted worktree, and the harvest base
  # clone measured 12 dirty entries (5 tracked-modified) on 2026-09-14. A harvested branch is
  # ≥1 commit ahead by construction, so its committed diff always selects a gate and this
  # branch is unreachable there — pinned by the third new arm in run-local-ci-sweep.test.sh.
  DIRTY="$(dirty_paths)"
  if [ -n "$DIRTY" ]; then
    echo "[sweep] FAIL dirty-tree-zero-gates — the committed diff selected no gates, and these"
    echo "        working-tree changes were examined by nothing:"
    printf '%s\n' "$DIRTY" | sed 's/^/          /'
    echo "SWEEP: REFUSED (mode=$MODE) — the sweep gates COMMITTED work; commit the paths above"
    echo "SWEEP: and re-run, or pass --base <ref> to scope it against a different committed base"
    exit 3
  fi
fi
if [ "$ran" -eq 0 ]; then
  echo "SWEEP: no gates selected for this diff (mode=$MODE)"
else
  echo "SWEEP: $ran gate(s) passed (mode=$MODE)"
  if [ "$ROUTING" -eq 1 ]; then
    echo "SWEEP: offload — $ROUTED_N row(s) ran on $RUNNER_NAME, $FELLBACK_N routed row(s) ran here instead, $((ran - ROUTED_N - FELLBACK_N)) not routable"
    [ -n "$RUNNER_TRIPPED" ] && echo "SWEEP: offload stopped after $RUNNER_TRIPPED"
  fi
  [ "$LOG_DIR_READY" -eq 1 ] && echo "SWEEP: gate logs in $SWEEP_LOG_DIR"
fi
exit 0
