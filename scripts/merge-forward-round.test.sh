#!/usr/bin/env bash
# Paired-negative for scripts/merge-forward-round.sh — the §4 generated-vs-semantic
# classifier and the argument contract, hermetic (no git history, no gh, no network).
#
# The classifier is the load-bearing park/no-park decision (git-conflict-merge-forward.md
# §4): a SEMANTIC path classified generated would push a hand-unresolvable merge; a
# GENERATED path classified semantic parks rounds that should run unattended. Both
# directions are exercised below, including the prefix traps (`baselines-evil/x`,
# `plugin/hooksfile`, `MANIFEST.sha256.bak`) that a looser glob would misclassify.
# The git/gh round machinery is exercised for real by usage (dry-run against a live PR);
# CI can only prove the seams hermetically.
#
# CI: .github/workflows/audit-self.yml (next to scripts/ci-success-gate.test.sh).
set -uo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
SUT="$HERE/merge-forward-round.sh"
PASS=0
FAIL=0

report() { # <ok> <desc> [detail]
  if [ "$1" -eq 1 ]; then
    PASS=$((PASS + 1))
    printf 'PASS: %s\n' "$2"
  else
    FAIL=$((FAIL + 1))
    printf 'FAIL: %s%s\n' "$2" "${3:+ — $3}"
  fi
}

expect_classify_fail() { # <want-rc> <desc> <required-grep-or-empty> <input-lines...>
  local want="$1" desc="$2" pattern="$3"
  shift 3
  local out rc
  out=$(printf '%s\n' "$@" | bash "$SUT" --classify 2>&1)
  rc=$?
  if [ "$rc" -ne "$want" ]; then
    report 1 "$desc" "wanted rc=$want got rc=$rc; output: $out"
    return
  fi
  if [ -n "$pattern" ] && ! grep -q "$pattern" <<<"$out"; then
    report 1 "$desc" "output lacks '$pattern'; output: $out"
    return
  fi
  PASS=$((PASS + 1))
  printf 'PASS: %s\n' "$desc"
}

expect_classify() { # <want-rc> <desc> <required-grep-or-empty> <input-lines...>
  # same seam, named for the direction it asserts; rc 0 iff every input path is generated
  expect_classify_fail "$@"
}

expect_rc() { # <want-rc> <desc> <required-grep-or-empty> <args...>
  local want="$1" desc="$2" pattern="$3"
  shift 3
  local out rc
  out=$(bash "$SUT" "$@" 2>&1)
  rc=$?
  if [ "$rc" -ne "$want" ]; then
    report 1 "$desc" "wanted rc=$want got rc=$rc; output: $out"
    return
  fi
  if [ -n "$pattern" ] && ! grep -q "$pattern" <<<"$out"; then
    report 1 "$desc" "output lacks '$pattern'; output: $out"
    return
  fi
  PASS=$((PASS + 1))
  printf 'PASS: %s\n' "$desc"
}

# ── §4 classifier: the generated populations ─────────────────────────────────────
expect_classify 0 "all four generated populations classify generated, rc 0" \
  "CLASSIFY SUMMARY generated=4 semantic=0" \
  "packages/getff/MANIFEST.sha256" \
  "tests/install-sh/baselines/react-native/greenfield.fingerprint" \
  "plugin/hooks/warn-subagent-report-zcode" \
  "plugin/skills/orchestrator/SKILL.md"

expect_classify 0 "empty input is vacuously generated" \
  "CLASSIFY SUMMARY generated=0 semantic=0" \
  ""

# ── §4 classifier: the semantic direction + prefix traps (the load-bearing negatives) ──
expect_classify_fail 1 "mixed list is semantic, rc 1, with per-path verdicts" \
  "CLASSIFY semantic docs/site/reference/D/warn-subagent-report-zcode.md" \
  "plugin/hooks/warn-subagent-report-zcode" \
  "docs/site/reference/D/warn-subagent-report-zcode.md" \
  "setup.d/lib.sh" \
  "scripts/merge-forward-round.sh"

expect_classify_fail 1 "prefix trap: baselines-evil/ is NOT tests/install-sh/baselines/*" \
  "CLASSIFY semantic tests/install-sh/baselines-evil/x" \
  "tests/install-sh/baselines-evil/x"

expect_classify_fail 1 "prefix trap: plugin/hooksfile (no slash) is semantic" \
  "CLASSIFY semantic plugin/hooksfile" \
  "plugin/hooksfile"

expect_classify_fail 1 "prefix trap: plugin/hooks2/x is semantic" \
  "CLASSIFY semantic plugin/hooks2/x" \
  "plugin/hooks2/x"

expect_classify_fail 1 "prefix trap: MANIFEST.sha256.bak is not the manifest" \
  "CLASSIFY semantic packages/getff/MANIFEST.sha256.bak" \
  "MANIFEST.sha256.bak"

expect_classify_fail 1 "prefix trap: tests/install-sh/baseline/x (singular) is semantic" \
  "CLASSIFY semantic tests/install-sh/baseline/x" \
  "tests/install-sh/baseline/x"

# ── the --classify file-argument seam ────────────────────────────────────────────
TMPFILE=$(mktemp "${TMPDIR:-/tmp}/mfr-test-classify-XXXXXX")
printf '%s\n' "setup.d/lib.sh" >"$TMPFILE"
expect_rc 1 "classify reads a file argument" "CLASSIFY semantic setup.d/lib.sh" --classify "$TMPFILE"
printf '%s\n' "plugin/hooks/twin" >"$TMPFILE"
expect_rc 0 "classify file argument, generated-only, rc 0" "CLASSIFY SUMMARY generated=1 semantic=0" --classify "$TMPFILE"
rm -f "$TMPFILE"

# ── argument contract ────────────────────────────────────────────────────────────
expect_rc 0 "no arguments prints the planned round and exits 0" "VERDICT: DRY-PLAN"
expect_rc 0 "--help prints usage" "Options:"
expect_rc 2 "unknown option is a usage error" "unknown option" --frobnicate
expect_rc 2 "--watch and --park are mutually exclusive" "mutually exclusive" --watch --park 2012
expect_rc 2 "--watch and --dry-run are mutually exclusive" "mutually exclusive" --watch --dry-run 2012
expect_rc 2 "--watch without a PR is a usage error" "needs a PR" --watch
expect_rc 2 "--max-rounds needs a number" "needs a number" --max-rounds abc 2012
expect_rc 2 "--timeout needs a number" "needs a number" --timeout soon 2012
expect_rc 2 "two PR arguments rejected" "exactly one PR" 2012 2005
expect_rc 2 "option missing its value is a usage error" "needs a value" --repo

# ── the repo's own portability gate over the script under test ───────────────────
if B32_OUT=$(bash "$HERE/check-bash32.sh" "$SUT" 2>&1); then
  PASS=$((PASS + 1))
  printf 'PASS: check-bash32 clean on merge-forward-round.sh\n'
else
  FAIL=$((FAIL + 1))
  printf 'FAIL: check-bash32 findings on merge-forward-round.sh:\n%s\n' "$B32_OUT"
fi

printf '\n%d pass / %d fail\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
