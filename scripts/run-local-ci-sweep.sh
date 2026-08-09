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
# Test seams (used by run-local-ci-sweep.test.sh, never in real runs):
#   SWEEP_GATES_FILE   path to a gate table overriding the built-in one
#   SWEEP_DIFF_OVERRIDE  space/newline list of changed paths overriding `git diff`
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1
TAB="$(printf '\t')"

MODE="diff"
BASE_REF=""
export CAPTURE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --full) MODE="full" ;;
    --base) shift; BASE_REF="${1:-}" ;;
    --capture) CAPTURE=1 ;;
    -h | --help)
      echo "usage: run-local-ci-sweep.sh [--full] [--base <ref>] [--capture]"
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
  printf '%s\n' \
    "1${TAB}meta-all-wired${TAB}tests/install-sh/,.github/workflows/${TAB}bash tests/install-sh/meta-all-wired.test.sh" \
    "1${TAB}md-ci-only${TAB}.md${TAB}echo '[sweep] WARN: markdown line/dead-link gates run in CI only (local scan hits gitignored files) — verify on CI'" \
    "1${TAB}actionlint${TAB}.github/workflows/${TAB}{ command -v actionlint >/dev/null 2>&1 && actionlint .github/workflows/*.yml; } || echo '[sweep] WARN-skip actionlint absent'" \
    "2${TAB}format-check${TAB}SHIPPED${TAB}npm run format:check" \
    "2${TAB}render-check${TAB}.claude/rules/${TAB}npx tsx packages/core/render/render-rules.ts --check" \
    "3${TAB}typecheck${TAB}packages/${TAB}npm run typecheck" \
    "4${TAB}byte-identical${TAB}SHIPPED${TAB}SNAPSHOT_MODE=compare bash tests/install-sh/byte-identical.test.sh" \
    "5${TAB}install-sh-suite${TAB}tests/install-sh/${TAB}for t in tests/install-sh/*.test.sh; do bash \"\$t\" || exit 1; done" \
    "5${TAB}agnosticism${TAB}packages/core/${TAB}bash tests/agnosticism/harness-self.test.sh" \
    "6${TAB}vitest-principles${TAB}packages/core/${TAB}npm --prefix packages/core run test:principles" \
    "6${TAB}vitest-hooks${TAB}packages/core/${TAB}npm --prefix packages/core run test:hooks" \
    "6${TAB}vitest-render${TAB}packages/core/${TAB}npm --prefix packages/core run test:render" \
    "6${TAB}first-steps-parity${TAB}packages/core/templates/shared/,packages/core/audit-self/${TAB}npx --prefix packages/core vitest run --reporter=default packages/core/audit-self/first-steps-parity.test.ts"
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
ran=0
SORTED="$(gate_table | sort -t"$TAB" -k1,1n)"
while IFS="$TAB" read -r _ name trigger cmd; do
  [ -z "${name:-}" ] && continue
  gate_selected "$trigger" || continue
  ran=$((ran + 1))
  if (eval "$cmd") >/dev/null 2>&1; then
    echo "[sweep] PASS $name"
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
