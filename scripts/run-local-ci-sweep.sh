#!/usr/bin/env bash
# run-local-ci-sweep.sh — local CI-equivalent gate sweep for harvest pre-push.
#
# Default: diff-aware (vs merge-base), cheapest-first, fail-fast, fail-safe to full.
# `--full` runs the complete set regardless of the diff.
#
# The sweep aggregates the gates the GitHub-CI jobs run (audit-self.yml). It exists so a
# harvested aif branch is checked against the real gate set locally before push — the
# recurring "pushed, CI reddened on a gate I didn't re-run" failure (PR #724).
#
# Spec: docs/superpowers/specs/2026-06-26-harvest-skill-design.md
# bash 3.2 compatible (no globstar / associative arrays).
#
# --- COVERAGE vs the required CI contexts (audited 2026-08-09) -----------------------------
# staging branch protection requires exactly three contexts: `ci-success` (the audit-self.yml
# aggregator that `needs:` every other job in that file — kept complete by
# packages/core/principles/36-ci-needs-completeness.test.ts), `fidelity-verdict-in-pr-body`
# (pr-body-fidelity.yml) and `stale-revert-in-pr-diff` (pr-stale-revert.yml). There is no
# ci.yml. A green sweep predicts a green CI only for the jobs listed as COVERED below.
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
#   backends/live-generation, the two drift gates, the tests/hooks/*.test.sh battery) ·
#   manifest-render-check · probe-tests · alwayson-budget · phase-8-canonical-regen-acceptance ·
#   f17-node-compat (host Node only) · shipped-prettier (not a `ci-success` need, but its
#   `npm run format:check` is the sweep's format-check row).
#
# UNREACHABLE — a green sweep says NOTHING about these; verify on CI:
#   mechanical            whole-tree `find` scanners; locally they also read gitignored files
#                         CI's clean checkout never has → false red (see the NOTE below).
#   zizmor                needs `pip install zizmor==1.26.1` (network + python env).
#   framework-self-install-ts-server / -react-next, framework-fresh-install-validate (×4 stacks),
#   framework-fresh-install-validate-multistack, consumer-matrix-start-cell,
#   consumer-matrix-python-unfamiliar-stack-cell, consumer-matrix-npm-tarball-cell
#                         each runs a real `install.sh … --full` into a tmp consumer and
#                         installs its dependency tree — network, minutes, non-hermetic.
#                         (consumer-matrix-npm-tarball-cell shipped after this list was written
#                         and went unlisted — exactly the drift the coverage metatest now gates.)
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
# Test seams (used by run-local-ci-sweep.test.sh, never in real runs):
#   SWEEP_GATES_FILE   path to a gate table overriding the built-in one
#   SWEEP_DIFF_OVERRIDE  space/newline list of changed paths overriding `git diff`
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1
TAB="$(printf '\t')"

MODE="diff"
BASE_REF=""
LIST_GATES=0
export CAPTURE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --full) MODE="full" ;;
    --base) shift; BASE_REF="${1:-}" ;;
    --capture) CAPTURE=1 ;;
    --list-gates) LIST_GATES=1 ;;
    -h | --help)
      echo "usage: run-local-ci-sweep.sh [--full] [--base <ref>] [--capture] [--list-gates]"
      exit 0 ;;
    *) echo "[sweep] unknown arg: $1" >&2; exit 2 ;;
  esac
  shift
done

# --- gate table: rank<TAB>name<TAB>trigger<TAB>command (cheapest rank first) ---
# trigger: ALWAYS | SHIPPED | a path prefix (ends with /) | a suffix (starts with .) | a literal.
gate_table() {
  if [ -n "${SWEEP_GATES_FILE:-}" ]; then cat "$SWEEP_GATES_FILE"; return; fi
  # NOTE: the whole-tree `mechanical`-job scanners (md-line-gate, .md→.md dead-links,
  # stale-path, bash-syntax-of-all, json-validity) are deliberately EXCLUDED: they `find`
  # the working tree and so scan gitignored files (e.g. .claude/orchestrator-prompts/*.md)
  # that CI's clean checkout never has → false reds locally. They stay CI-only (peer of the
  # framework-self matrix). A `.md` diff gets an honest advisory gate instead.
  #
  # Two rows DERIVE their content from .github/workflows/audit-self.yml rather than restating
  # it: `script-selftests` greps the workflow for the scripts/*.test.sh steps it actually runs,
  # and `toolchain_pins_ok` reads the ast-grep/ruff/rustc pins out of their install steps. A
  # hand-maintained list of either goes stale silently — the first version of this row named
  # four self-tests and was already one short (`host-verify-coverage.test.sh`, added to CI in
  # #1339) before it ever merged. Deriving means a new CI step joins the sweep for free, and a
  # test present in scripts/ but wired to NO CI step (probe-channels.test.sh at time of
  # writing) correctly stays out — the sweep predicts CI, it does not invent gates.
  #
  # `sweep-ci-coverage` is listed explicitly even though `script-selftests` would derive it: that
  # row's trigger is `scripts/` only, and a workflow-only diff — precisely the diff this metatest
  # exists to catch — would never select it. The duplicate run on a scripts/ diff is pure grep.
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
    "1${TAB}sweep-ci-coverage${TAB}.github/workflows/,scripts/run-local-ci-sweep.sh${TAB}bash scripts/run-local-ci-sweep-coverage.test.sh" \
    "1${TAB}md-ci-only${TAB}.md${TAB}echo '[sweep] WARN: markdown line/dead-link gates run in CI only (local scan hits gitignored files) — verify on CI'" \
    "1${TAB}actionlint${TAB}.github/workflows/${TAB}{ command -v actionlint >/dev/null 2>&1 && actionlint .github/workflows/*.yml; } || echo '[sweep] WARN-skip actionlint absent'" \
    "1${TAB}alwayson-budget${TAB}CLAUDE.md,.claude/rules/,scripts/measure-always-on.sh,scripts/check-alwayson-budget.sh${TAB}bash scripts/measure-always-on.test.sh && bash scripts/check-alwayson-budget.test.sh && bash scripts/check-alwayson-budget.sh" \
    "2${TAB}format-check${TAB}SHIPPED${TAB}npm run format:check" \
    "2${TAB}render-check${TAB}.claude/rules/${TAB}npx tsx packages/core/render/render-rules.ts --check" \
    "2${TAB}rule-index-check${TAB}.claude/rules/,AGENTS.md,scripts/render-rule-index.mjs${TAB}npx tsx scripts/render-rule-index.mjs --check" \
    "2${TAB}script-selftests${TAB}scripts/${TAB}ts=\$(grep -oE 'scripts/[a-zA-Z0-9._-]+\\.test\\.sh' .github/workflows/audit-self.yml | sort -u); [ -n \"\$ts\" ] || { echo 'no scripts/*.test.sh steps found in audit-self.yml — derivation broke'; exit 1; }; for t in \$ts; do bash \"\$t\" || exit 1; done" \
    "3${TAB}typecheck${TAB}packages/${TAB}npm run typecheck" \
    "3${TAB}shipped-rules-drift${TAB}packages/${TAB}bash scripts/build-shipped-eslint-rules.sh --check" \
    "3${TAB}shellcheck${TAB}setup.d/,install.sh${TAB}{ command -v shellcheck >/dev/null 2>&1 && shellcheck --exclude=SC2034,SC2016,SC2317 setup.d/*.sh install.sh; } || echo '[sweep] WARN-skip shellcheck absent'" \
    "4${TAB}byte-identical${TAB}SHIPPED${TAB}SNAPSHOT_MODE=compare bash tests/install-sh/byte-identical.test.sh" \
    "4${TAB}synth-bundle-drift${TAB}packages/core/,package.json,package-lock.json${TAB}NODE_ENV=development bash scripts/build-synth-bundle.sh --check" \
    "5${TAB}install-sh-suite${TAB}tests/install-sh/${TAB}for t in tests/install-sh/*.test.sh; do bash \"\$t\" || exit 1; done" \
    "5${TAB}agnosticism${TAB}packages/core/${TAB}bash tests/agnosticism/harness-self.test.sh" \
    "5${TAB}hook-tests${TAB}packages/core/hooks/,tests/hooks/,.husky/${TAB}for t in tests/hooks/*.test.sh; do bash \"\$t\" || exit 1; done" \
    "5${TAB}dispatcher-tests${TAB}.claude/skills/dispatcher/,tests/dispatcher/${TAB}for t in tests/dispatcher/*.test.sh; do bash \"\$t\" || exit 1; done" \
    "6${TAB}vitest-principles${TAB}packages/core/${TAB}npm --prefix packages/core run test:principles" \
    "6${TAB}vitest-hooks${TAB}packages/core/${TAB}npm --prefix packages/core run test:hooks" \
    "6${TAB}vitest-render${TAB}packages/core/${TAB}npm --prefix packages/core run test:render" \
    "6${TAB}vitest-ir${TAB}packages/core/${TAB}npm --prefix packages/core run test:ir" \
    "6${TAB}vitest-composition${TAB}packages/core/${TAB}npm --prefix packages/core run test:composition" \
    "6${TAB}vitest-backends${TAB}packages/core/${TAB}if toolchain_pins_ok; then npm --prefix packages/core run test:backends; else echo '[sweep] WARN-skip vitest-backends: host toolchain != CI pins'; fi" \
    "6${TAB}vitest-live-generation${TAB}packages/core/${TAB}if toolchain_pins_ok; then npm --prefix packages/core run test:live-generation; else echo '[sweep] WARN-skip vitest-live-generation: host toolchain != CI pins'; fi" \
    "6${TAB}vitest-install-wire${TAB}packages/core/${TAB}npx --prefix packages/core vitest run --reporter=default packages/core/install/wire-live-snippet.test.ts packages/core/install/wire-synth-rules.test.ts" \
    "6${TAB}audit-ai-docs${TAB}packages/core/,docs/,skills/,agents/${TAB}npx --prefix packages/core vitest run --reporter=default packages/core/audit-self/audit-ai-docs.test.ts" \
    "6${TAB}canonical-regen${TAB}packages/${TAB}npm --prefix packages/core test --silent -- tests/acceptance/canonical-regen" \
    "6${TAB}first-steps-parity${TAB}packages/core/templates/shared/,packages/core/audit-self/${TAB}npx --prefix packages/core vitest run --reporter=default packages/core/audit-self/first-steps-parity.test.ts"
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

# --- changed paths (vs merge-base) ---
changed_paths() {
  if [ -n "${SWEEP_DIFF_OVERRIDE:-}" ]; then printf '%s\n' $SWEEP_DIFF_OVERRIDE; return; fi
  local base="${BASE_REF:-$(git merge-base origin/staging HEAD 2>/dev/null || echo HEAD~1)}"
  git diff --name-only "${base}...HEAD"
}

# --- trigger_matches <trigger-list> <path> ---
# trigger-list is one or more triggers joined by commas; matches if ANY matches.
# Each trigger: ALWAYS | SHIPPED | a prefix (ends with /) | a suffix (starts with .) | a literal.
trigger_matches() {
  local triglist="$1" p="$2" trig
  local IFS=,
  for trig in $triglist; do
    case "$trig" in
      ALWAYS) return 0 ;;
      SHIPPED)
        case "$p" in
          skills/* | agents/* | packages/core/templates/* | packages/preset-*/* | .claude/rules/* | .claude/skills/*) return 0 ;;
        esac ;;
      */) case "$p" in "$trig"*) return 0 ;; esac ;;   # prefix (before suffix: .github/workflows/ is both .*-prefixed and /-suffixed)
      .*) case "$p" in *"$trig") return 0 ;; esac ;;   # suffix
      *) case "$p" in "$trig") return 0 ;; esac ;;       # literal/glob
    esac
  done
  return 1
}

CHANGED="$(changed_paths)"

# --- fail-safe: any changed path matching NO gate trigger → escalate to --full ---
if [ "$MODE" = "diff" ] && [ -n "$CHANGED" ]; then
  GATES_SNAPSHOT="$(gate_table)"
  while IFS= read -r p; do
    [ -z "$p" ] && continue
    matched=0
    while IFS="$TAB" read -r _ n trig _; do
      [ -z "${n:-}" ] && continue
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
gate_selected() {
  [ "$MODE" = "full" ] && return 0
  local trig="$1" p
  while IFS= read -r p; do
    [ -z "$p" ] && continue
    if trigger_matches "$trig" "$p"; then return 0; fi
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
ran=0
SORTED="$(gate_table | sort -t"$TAB" -k1,1n)"
while IFS="$TAB" read -r _ name trigger cmd; do
  [ -z "${name:-}" ] && continue
  gate_selected "$trigger" || continue
  ran=$((ran + 1))
  # Output is CAPTURED, not discarded, for one reason: several rows degrade to a WARN-skip
  # instead of failing (actionlint/shellcheck absent, host toolchain != CI pins, the CI-only
  # markdown scanners). Piping their stdout to /dev/null made every one of those print a plain
  # `PASS`, indistinguishable from a real run — a warning whose only consumer is a log nobody
  # can read (.claude/rules/attention-is-not-a-mechanism.md §2 `#warning-nobody-reads`). A
  # degraded gate now says so on its own line; rc is unchanged either way.
  out="$( (eval "$cmd") 2>&1 </dev/null )"; rc=$?
  if [ "$rc" -eq 0 ]; then
    case "$out" in
      # `[sweep] WARN`-prefixed only: every degrade row in the table emits that exact prefix,
      # while several install-sh tests legitimately print bare "WARN" during a real run
      # (nvmrc-ci-drift, r2-glob-reach) — matching those would mislabel a genuine pass.
      *'[sweep] WARN'*) echo "[sweep] WARN-SKIP $name — degraded, NOT a real run" ;;
      *) echo "[sweep] PASS $name" ;;
    esac
  else
    echo "[sweep] FAIL $name"
    echo "SWEEP: stopped at $name (mode=$MODE)"
    exit 1
  fi
done <<EOF
$SORTED
EOF

if [ "$ran" -eq 0 ]; then
  echo "SWEEP: no gates selected for this diff (mode=$MODE)"
else
  echo "SWEEP: $ran gate(s) passed (mode=$MODE)"
fi
exit 0
