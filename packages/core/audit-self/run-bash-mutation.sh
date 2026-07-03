#!/usr/bin/env bash
#
# run-bash-mutation.sh — on-demand bash-hook mutation check (Stage 2 B.2,
# mutation-discipline-umbrella). Thin wrapper over agroce/universalmutator
# (ADAPT verdict, B.1 SSOT #91): generates mutants of a bash hook from the
# project-authored bash.rules operator set, runs the hook's paired-negative
# test against each mutant, and reports the kill rate against the audit §A.4
# ≥60% floor. Exits non-zero below the floor so it can gate a pre-push /
# pre-merge convention.
#
# Delivery channel: SESSION-BOUND / LOCAL — run on demand by a developer, like
# `npx stryker run` for TS. NOT wired into CI (maintainer decision 2026-06-01;
# Stryker itself is devDep-only, not a CI job; README «CI = last resort»).
#
# spec: packages/core/audit-self/bash.rules
# @dual-pair: mutation-discipline-bash-b2
# @cc-only-rationale: local dev tool, not consumer-shipped, not a CC hook —
#   no portable-fallback axis applies (it IS portable bash invoking a pip tool).
#
# Usage:
#   packages/core/audit-self/run-bash-mutation.sh <hook.sh> "<test-cmd>" [min-kill-%]
#
# Example (end-of-turn-reminder hook + its vitest paired-negative test):
#   packages/core/audit-self/run-bash-mutation.sh \
#     .claude/hooks/end-of-turn-reminder.sh \
#     "npx vitest run hooks/end-of-turn-reminder.test.ts" \
#     60
# (the test cmd runs from REPO_ROOT; vitest resolves hooks/<name> via the root config)
#
# Contract for <test-cmd>: it runs with BASHMUT_HOOK exported = absolute path of
# the temp SHADOW copy each mutant is swapped into (the tracked hook is never
# written — see the shadow block below). A test that spawns the hook must spawn
# "$BASHMUT_HOOK" (falling back to the tracked path when unset) so mutants are
# actually exercised; a test that ignores it keeps passing against the untouched
# original, kills nothing, and FAILs the ≥floor gate loudly — never a silent
# false-green.
#
# Prerequisite (one-time, local):  pipx install universalmutator
#   (or: pip install universalmutator) — see CONTRIBUTING.md «Bash mutation testing».

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RULES="$SCRIPT_DIR/bash.rules"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

HOOK="${1:-}"
TEST_CMD="${2:-}"
MIN_KILL="${3:-60}"

die() { echo "run-bash-mutation: $*" >&2; exit 2; }

# --- preconditions -----------------------------------------------------------
[ -n "$HOOK" ] && [ -n "$TEST_CMD" ] || die "usage: run-bash-mutation.sh <hook.sh> \"<test-cmd>\" [min-kill-%]"
command -v mutate >/dev/null 2>&1 || die "universalmutator not found on PATH — install with: pipx install universalmutator"
command -v analyze_mutants >/dev/null 2>&1 || die "analyze_mutants not found — reinstall universalmutator (pipx install universalmutator)"
[ -f "$RULES" ] || die "operator file missing: $RULES"

# Resolve the hook to an absolute path (analyze_mutants swaps the mutant in at
# this path regardless of cwd; the test command resolves it via REPO_ROOT).
case "$HOOK" in
  /*) HOOK_ABS="$HOOK" ;;
  *)  HOOK_ABS="$REPO_ROOT/$HOOK" ;;
esac
[ -f "$HOOK_ABS" ] || die "hook not found: $HOOK_ABS"

MUT_DIR="$(mktemp -d)"
WORK_DIR="$(mktemp -d)"   # mutants + killed.txt/notkilled.txt land here, not in the repo
trap 'rm -rf "$MUT_DIR" "$WORK_DIR"' EXIT   # no temp-dir accumulation across runs

# --- shadow the target: mutants are swapped into a temp COPY, never the repo ---
# analyze_mutants overwrites whatever path it is given, once per mutant, and
# restores content-only at the end. Handing it the tracked hook path serialises
# fine in a single run but LEAKS under concurrency: two suite instances
# interleave their swap/restore cycles and a mutant — plus a 644 mode from the
# content-only restore — survives in the working tree (incident 2026-07-02:
# .claude/hooks/check-hook-marker.sh left with a broken glob + flipped exit).
# So the swap target is this WORK_DIR shadow; the test command reads its path
# via BASHMUT_HOOK (header contract above).
SHADOW_DIR="$WORK_DIR/shadow"
mkdir -p "$SHADOW_DIR"
SHADOW_HOOK="$SHADOW_DIR/$(basename "$HOOK_ABS")"
cp "$HOOK_ABS" "$SHADOW_HOOK"

echo "=== bash mutation: $(basename "$HOOK_ABS") ==="
echo "rules:  $RULES"
echo "test:   $TEST_CMD"
echo "floor:  ${MIN_KILL}% kill rate"
echo

# --- sanitize block-comment-opener false-triggers (load-bearing) -------------
# universalmutator's generic comment state-machine treats `/*` and `{-` as block-
# comment openers (C / Haskell). bash has neither — but a bash *glob* in a comment
# (e.g. `# … .claude/hooks/*.sh`) contains `/*`, which with no later `*/` makes the
# engine skip every subsequent line → silent under-count or zero mutants (the Trail-
# of-Bits regexp-engine limitation, B.1 §B.1.3). We neutralise the openers in a
# line-count-preserving copy used ONLY for mutant generation; the byte we insert is
# a space inside a comment, behaviourally inert. analyze_mutants swaps each mutant
# into the SHADOW copy (above) — the tracked hook is never written.
SAN_HOOK="$WORK_DIR/$(basename "$HOOK_ABS")"
sed -e 's@/\*@/ *@g' -e 's@{-@{ -@g' "$HOOK_ABS" > "$SAN_HOOK"

# --- generate mutants (regexp engine, no compile step → --noCheck) -----------
# 2>/dev/null drops the harmless "FAILED TO FIND RULE ... AS BUILT-IN" probe line
# (universalmutator checks built-ins before resolving the path).
GEN_LOG="$WORK_DIR/generate.log"
mutate "$SAN_HOOK" --only "$RULES" --noCheck --mutantDir "$MUT_DIR" >"$GEN_LOG" 2>&1
N_MUT="$(ls "$MUT_DIR"/*."${HOOK_ABS##*.}" 2>/dev/null | wc -l | tr -d ' ')"
if [ "$N_MUT" -eq 0 ]; then
  echo "No mutants generated — operators do not match this hook (or hook is trivial)." >&2
  echo "(generation log: $GEN_LOG)" >&2
  exit 3
fi
echo "generated $N_MUT mutants → running paired-negative test against each…"
echo

# --- run the paired-negative test against each mutant ------------------------
# analyze_mutants: swaps each mutant into $SHADOW_HOOK (mutant↔source matching
# is by basename, so mutants generated from $SAN_HOOK apply to the same-named
# shadow), runs <testscript> (non-zero exit = mutant KILLED), restores the
# shadow, writes killed.txt + notkilled.txt, prints MUTATION SCORE.
# --noShuffle for deterministic ordering.
ANALYZE_LOG="$WORK_DIR/analyze.log"
(
  cd "$WORK_DIR" || exit 2
  analyze_mutants "$SHADOW_HOOK" \
    "cd '$REPO_ROOT' && { export BASHMUT_HOOK='$SHADOW_HOOK'; $TEST_CMD ; } >/dev/null 2>&1" \
    --mutantDir "$MUT_DIR" --noShuffle 2>&1 | tee "$ANALYZE_LOG"
)

SCORE="$(grep -oE 'MUTATION SCORE: [0-9.]+' "$ANALYZE_LOG" | tail -1 | grep -oE '[0-9.]+$')"
[ -n "$SCORE" ] || die "could not parse MUTATION SCORE from analyze_mutants output ($ANALYZE_LOG)"

# float score → integer percent (no bc dependency)
PCT="$(awk -v s="$SCORE" 'BEGIN{ printf "%d", (s*100)+0.5 }')"
KILLED="$(wc -l < "$WORK_DIR/killed.txt" 2>/dev/null | tr -d ' ')"; KILLED="${KILLED:-0}"
SURVIVED="$(wc -l < "$WORK_DIR/notkilled.txt" 2>/dev/null | tr -d ' ')"; SURVIVED="${SURVIVED:-0}"

echo
echo "=== result: $(basename "$HOOK_ABS") ==="
echo "kill rate: ${PCT}%  (killed ${KILLED} / survived ${SURVIVED} of ${N_MUT})"

# --- surviving mutants: show each one's source-line transform ----------------
if [ "$SURVIVED" -gt 0 ] && [ -s "$WORK_DIR/notkilled.txt" ]; then
  echo
  echo "SURVIVING mutants (test did NOT catch — a real gap OR an equivalent mutant):"
  # notkilled.txt lists mutant BASENAMES (not full paths); the files live in $MUT_DIR.
  while read -r m _; do
    [ -n "$m" ] || continue
    f="$MUT_DIR/$m"
    [ -f "$f" ] || { echo "  - $m: <mutant file gone>"; continue; }
    # diff against the sanitized reference so only the code mutation shows
    # (both sides carry the same neutralised `/ *` comments).
    d="$(diff "$SAN_HOOK" "$f" 2>/dev/null | grep -E '^[<>]' | tr '\n' ' ')"
    echo "  - $m: ${d:-<no textual diff — equivalent mutant>}"
  done < "$WORK_DIR/notkilled.txt"
fi

echo
# Gate on the RAW score (not the rounded PCT) so a 59.5% kill rate cannot round
# up past a strict ≥MIN_KILL floor.
if awk -v s="$SCORE" -v f="$MIN_KILL" 'BEGIN{ exit !((s*100) >= f) }'; then
  echo "PASS — ${PCT}% ≥ ${MIN_KILL}% floor"
  exit 0
else
  echo "FAIL — ${PCT}% < ${MIN_KILL}% floor (surviving mutants above are uncaught regressions or need an equivalent-mutant annotation)" >&2
  exit 1
fi
