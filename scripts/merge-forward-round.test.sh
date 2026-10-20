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
# CI can only prove the seams hermetically. The one exception is the --sweep seam: the
# pre-merge canonical-link sweep needs a real git object database, so it gets a throwaway
# local fixture repo below (still no network, no gh).
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
    report 0 "$desc" "wanted rc=$want got rc=$rc; output: $out"
    return
  fi
  if [ -n "$pattern" ] && ! grep -q "$pattern" <<<"$out"; then
    report 0 "$desc" "output lacks '$pattern'; output: $out"
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
    report 0 "$desc" "wanted rc=$want got rc=$rc; output: $out"
    return
  fi
  if [ -n "$pattern" ] && ! grep -q "$pattern" <<<"$out"; then
    report 0 "$desc" "output lacks '$pattern'; output: $out"
    return
  fi
  PASS=$((PASS + 1))
  printf 'PASS: %s\n' "$desc"
}

# ── §4 classifier: the generated populations ─────────────────────────────────────
expect_classify 0 "all six generated populations classify generated, rc 0" \
  "CLASSIFY SUMMARY generated=6 semantic=0" \
  "packages/getff/MANIFEST.sha256" \
  "tests/install-sh/baselines/react-native/greenfield.fingerprint" \
  "plugin/hooks/warn-subagent-report-zcode" \
  "plugin/skills/orchestrator/SKILL.md" \
  "docs/site/reference/F3.json" \
  "docs/site/face-facts.json"

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
  "packages/getff/MANIFEST.sha256.bak"

expect_classify_fail 1 "prefix trap: tests/install-sh/baseline/x (singular) is semantic" \
  "CLASSIFY semantic tests/install-sh/baseline/x" \
  "tests/install-sh/baseline/x"

expect_classify_fail 1 "prefix trap: docs/site/reference-notes.md is semantic" \
  "CLASSIFY semantic docs/site/reference-notes.md" \
  "docs/site/reference-notes.md"

expect_classify_fail 1 "prefix trap: docs/site/face-facts.json.bak is semantic" \
  "CLASSIFY semantic docs/site/face-facts.json.bak" \
  "docs/site/face-facts.json.bak"

# ── the --classify file-argument seam ────────────────────────────────────────────
TMPFILE=$(mktemp "${TMPDIR:-/tmp}/mfr-test-classify-XXXXXX")
printf '%s\n' "setup.d/lib.sh" >"$TMPFILE"
expect_rc 1 "classify reads a file argument" "CLASSIFY semantic setup.d/lib.sh" --classify "$TMPFILE"
printf '%s\n' "plugin/hooks/twin" >"$TMPFILE"
expect_rc 0 "classify file argument, generated-only, rc 0" "CLASSIFY SUMMARY generated=1 semantic=0" --classify "$TMPFILE"
rm -f "$TMPFILE"

# ── argument contract ────────────────────────────────────────────────────────────
expect_rc 0 "no arguments prints the planned round and exits 0" "VERDICT: DRY-PLAN"
expect_rc 0 "--help prints usage" "Options:" --help
expect_rc 2 "unknown option is a usage error" "unknown option" --frobnicate
expect_rc 2 "--watch and --park are mutually exclusive" "mutually exclusive" --watch --park 2012
expect_rc 2 "--watch and --dry-run are mutually exclusive" "mutually exclusive" --watch --dry-run 2012
expect_rc 2 "--watch without a PR is a usage error" "needs a PR" --watch
expect_rc 2 "--max-rounds needs a number" "needs a number" --max-rounds abc 2012
expect_rc 2 "--timeout needs a number" "needs a number" --timeout soon 2012
expect_rc 2 "two PR arguments rejected" "exactly one PR" 2012 2005
expect_rc 2 "option missing its value is a usage error" "needs a value" --repo

# ── pre-merge canonical-link sweep (--sweep): the exit-5 «merge failed without an
#    unmerged list» repro. Fresh worktrees run the post-checkout hook
#    (link-coordination.sh), which materializes gitignored canonical coordination files
#    as untracked symlinks; once the merge base TRACKS such a path (#2066 landed
#    .claude/orchestrator-prompts/getff-ai-site/kickoff-s1rf1{a,b}.md), the merge refuses
#    to overwrite the untracked copies and aborts BEFORE recording any conflict, so
#    `git diff --diff-filter=U` is empty and the round died with exit 5. The sweep must
#    remove exactly the blocking intersection (tracked-in-base AND untracked-in-scratch,
#    ignored files included) and nothing else. Fixture: throwaway local repo, no gh.
SWEEP_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/mfr-test-sweep-XXXXXX")
R="$SWEEP_ROOT/repo"
git init -q "$R"
git -C "$R" config user.email sweep@test
git -C "$R" config user.name sweep
mkdir -p "$R/canon"
printf 'work\n' >"$R/work.txt"
git -C "$R" add work.txt
git -C "$R" commit -qm "tip: predates the canonical file"
git -C "$R" branch tip
printf 'canonical\n' >"$R/canon/kickoff-a.md"
git -C "$R" add canon/kickoff-a.md
git -C "$R" commit -qm "base: tracks the canonical file"
git -C "$R" branch base
git -C "$R" worktree add --detach "$SWEEP_ROOT/scratch" tip >/dev/null 2>&1
mkdir -p "$SWEEP_ROOT/scratch/canon"
printf 'materialized\n' >"$SWEEP_ROOT/scratch/canon/kickoff-a.md"
printf 'bystander\n' >"$SWEEP_ROOT/scratch/notes.txt"

if git -C "$SWEEP_ROOT/scratch" merge --no-ff --no-edit base >/dev/null 2>&1; then
  report 0 "fixture realism: the unswept merge did NOT fail — the repro premise is gone"
else
  report 1 "fixture realism: the unswept merge is refused (untracked would be overwritten) — the exit-5 shape"
fi
if git -C "$SWEEP_ROOT/scratch" merge --abort >/dev/null 2>&1; then :; fi

# Local assertion helper with self-contained polarity: unlike the shipped expect_rc
# above, a mismatch here is recorded as FAIL with its diagnostic, so a regression in
# the sweep can never print PASS.
expect_sweep() { # <want-rc> <desc> <required-grep-or-empty> <args...>
  local want="$1" desc="$2" pattern="$3"
  shift 3
  local out rc
  out=$(bash "$SUT" "$@" 2>&1)
  rc=$?
  if [ "$rc" -ne "$want" ]; then
    report 0 "$desc" "wanted rc=$want got rc=$rc; output: $out"
    return
  fi
  if [ -n "$pattern" ] && ! grep -q "$pattern" <<<"$out"; then
    report 0 "$desc" "output lacks '$pattern'; output: $out"
    return
  fi
  report 1 "$desc"
}

expect_sweep 0 "sweep removes the target-tracked materialization and logs the line" \
  "removed untracked canonical-link materialization on a target-tracked path: canon/kickoff-a.md" \
  --sweep "$SWEEP_ROOT/scratch" base
if [ ! -e "$SWEEP_ROOT/scratch/canon/kickoff-a.md" ]; then
  report 1 "sweep removed the blocking file"
else
  report 0 "sweep left the blocking file in place" "$SWEEP_ROOT/scratch/canon/kickoff-a.md"
fi
if [ -f "$SWEEP_ROOT/scratch/notes.txt" ]; then
  report 1 "sweep kept the bystander untracked file (removal is narrow)"
else
  report 0 "sweep removed a file the merge did not need removed" "notes.txt"
fi

expect_sweep 0 "sweep is idempotent: second run removes 0" \
  "canonical-link sweep: removed=0" \
  --sweep "$SWEEP_ROOT/scratch" base

if git -C "$SWEEP_ROOT/scratch" merge --no-ff --no-edit base >/dev/null 2>&1 &&
  [ "$(cat "$SWEEP_ROOT/scratch/canon/kickoff-a.md" 2>/dev/null)" = "canonical" ]; then
  report 1 "the swept merge proceeds and restores the canonical tracked content"
else
  report 0 "the swept merge did not proceed cleanly or content is wrong" "canon/kickoff-a.md"
fi

expect_sweep 2 "sweep without arguments is a usage error" "needs a scratch worktree directory" --sweep
expect_sweep 2 "sweep with one argument is a usage error" "needs a target ref" --sweep "$SWEEP_ROOT/scratch"

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
