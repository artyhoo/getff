#!/usr/bin/env bash
# refresh-baseline-survives-early-exit.test.sh — ledger #1597 A1-2.
#
# `setup.d/99-finalize.sh` ends a deps-incomplete `--full` install with `exit 1` (GH #974: an
# install that promised a toolchain and did not deliver one must not report green). That file is
# SOURCED by install.sh, so the `exit` terminates install.sh itself — before its
# `refresh_baseline_flush`. The R1 baseline is therefore never written.
#
# The second half is what makes it permanent rather than transient: `copy_safe`'s skip-if-exists
# path returns BEFORE its `refresh_baseline_stage` call, so a later SUCCESSFUL `--full` re-run
# skips every file that is already on disk and stages nothing. The manifest stays absent, and the
# consumer's first `--refresh` reads «unknown» for every delivered path — the issue-1481
# divergence guard is dead for exactly the run that would have needed it.
#
# Two fixes, one per half, and this file pins both:
#   (1) the flush runs on every exit path (EXIT trap), so an aborted install still records what
#       it delivered;
#   (2) copy_safe stages an existing-but-skipped file too — WEAKLY, so it can only fill a gap in
#       the manifest and never overwrite an entry a real delivery already recorded. Staging the
#       skip strongly would let a consumer's own edit become the baseline and silence the guard.
#
# Acceptance is behavioural: real installs into mktemp consumers, asserting the manifest file and
# the guard's live output. Portability: bash 3.2, ASCII substrings in greps.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

MANIFEST_REL=".ai-factory/refresh-baseline.json"
PROBE_REL=".claude/hooks/deps-hash-check.sh"

# make_bare — a consumer directory ready for install.sh, nothing installed yet.
make_bare() {
  local T
  T=$(mktemp -d)
  printf '{ "name":"consumer","version":"0.0.0" }\n' > "$T/package.json"
  ( cd "$T" && git init -q ) >/dev/null 2>&1
  echo "$T"
}

# A --full install whose dependency step cannot succeed. Same hermetic lever as
# tests/install-sh/gh-974-honest-incomplete-deps.test.sh arm (B): stub every package manager on
# PATH so it exits 1, so 70-deps.sh never sets DEPS_INSTALLED=1 and 99-finalize.sh takes its
# GH #974 exit-1 branch. No network, no registry.
STUBBIN=$(mktemp -d)
printf '#!/bin/sh\nexit 1\n' > "$STUBBIN/npm"
cp "$STUBBIN/npm" "$STUBBIN/pnpm"; cp "$STUBBIN/npm" "$STUBBIN/yarn"
chmod +x "$STUBBIN/npm" "$STUBBIN/pnpm" "$STUBBIN/yarn"
STUB_PATH="$STUBBIN:$PATH"
trap 'rm -rf "$STUBBIN"' EXIT

# ══════════════════════════════════════════════════════════════════════════════
# ARM 1 — a deps-incomplete --full still writes the baseline before exiting 1
# ══════════════════════════════════════════════════════════════════════════════
TC1=$(make_bare)
OUT_1=$( cd "$TC1" && PATH="$STUB_PATH" bash "$REPO_ROOT/install.sh" ts-server --full < /dev/null 2>&1 )
RC_1=$?

if [ "$RC_1" -ne 0 ]; then
  ok "arm 1 precondition: the deps-incomplete --full exited non-zero (rc=$RC_1, GH #974 honest failure)"
else
  bad "arm 1 precondition: --full exited 0 — the deps-incomplete path was not reached, arm 1 is vacuous"
fi
if printf '%s\n' "$OUT_1" | grep -qF 'dependencies did NOT fully install'; then
  ok "arm 1 precondition: the degraded banner fired (this IS the 99-finalize exit-1 path)"
else
  bad "arm 1 precondition: the degraded banner did not fire — arm 1 is testing some other exit"
fi
if [ -f "$TC1/$MANIFEST_REL" ]; then
  ok "arm 1: the refresh baseline was written despite the exit-1 (flush runs on every exit path)"
else
  bad "arm 1: NO $MANIFEST_REL after a deps-incomplete --full — the flush was skipped by the sourced exit"
fi
if [ -f "$TC1/$MANIFEST_REL" ] && [ -f "$TC1/$PROBE_REL" ]; then
  E1=$(jq -r --arg k "$PROBE_REL" 'if (type=="object") and has($k) then .[$k] else "" end' "$TC1/$MANIFEST_REL" 2>/dev/null)
  if [ -n "$E1" ]; then
    ok "arm 1: the baseline carries an entry for a file this aborted run actually delivered"
  else
    bad "arm 1: the baseline exists but has no entry for $PROBE_REL — it recorded nothing useful"
  fi
fi
rm -rf "$TC1"

# ══════════════════════════════════════════════════════════════════════════════
# ARM 2 — the guard is LIVE after such an install: a consumer edit is preserved
# ══════════════════════════════════════════════════════════════════════════════
# This is the ledger's actual casualty. Arm 1 asserts the file exists; this asserts the file does
# its job on the very next `--refresh`, which is the run that used to destroy the edit.
TC2=$(make_bare)
( cd "$TC2" && PATH="$STUB_PATH" bash "$REPO_ROOT/install.sh" ts-server --full < /dev/null ) >/dev/null 2>&1
if [ ! -f "$TC2/$PROBE_REL" ]; then
  bad "arm 2 precondition: the aborted install did not deliver $PROBE_REL"
else
  printf 'CONSUMER_EDIT_AFTER_ABORTED_FULL\n' > "$TC2/$PROBE_REL"
  OUT_2=$( cd "$TC2" && bash "$REPO_ROOT/install.sh" --refresh < /dev/null 2>&1 )
  if printf '%s\n' "$OUT_2" | grep -F 'overwriting locally-modified file:' | grep -qF 'deps-hash-check.sh'; then
    ok "arm 2: the first --refresh after an aborted --full WARNS about the consumer edit"
  else
    bad "arm 2: the consumer edit was overwritten silently — the guard is dead after an aborted install"
  fi
  PRES_2=""
  for _f in "$TC2/.ai-factory/refresh-conflicts"/deps-hash-check.sh.*; do
    [ -e "$_f" ] && PRES_2="$_f"
  done
  if [ -n "$PRES_2" ] && grep -qF 'CONSUMER_EDIT_AFTER_ABORTED_FULL' "$PRES_2"; then
    ok "arm 2: the diverged bytes were preserved under .ai-factory/refresh-conflicts/"
  else
    bad "arm 2: NO conflicts copy — the consumer edit is gone for good"
  fi
fi
rm -rf "$TC2"

# ══════════════════════════════════════════════════════════════════════════════
# ARM 3 — copy_safe stages a SKIPPED existing file, filling a gap in the manifest
# ══════════════════════════════════════════════════════════════════════════════
# The second half of A1-2: even with the flush fixed, a run whose deliveries are all skips must
# still be able to record a baseline (that is the "re-run --full after fixing the deps" path).
TC3=$(make_bare)
( cd "$TC3" && bash "$REPO_ROOT/install.sh" ts-server < /dev/null ) >/dev/null 2>&1
rm -f "$TC3/$MANIFEST_REL"                       # simulate the run that never flushed
OUT_3=$( cd "$TC3" && bash "$REPO_ROOT/install.sh" ts-server < /dev/null 2>&1 )
if printf '%s\n' "$OUT_3" | grep -qF 'exists — skipping'; then
  ok "arm 3 precondition: the second install did take the skip-if-exists path"
else
  bad "arm 3 precondition: nothing was skipped — arm 3 does not exercise the skip path"
fi
if [ -f "$TC3/$MANIFEST_REL" ]; then
  E3=$(jq -r --arg k "$PROBE_REL" 'if (type=="object") and has($k) then .[$k] else "" end' "$TC3/$MANIFEST_REL" 2>/dev/null)
  if [ -n "$E3" ]; then
    ok "arm 3: a skip-only re-run rebuilt the baseline (skipped files are staged, not dropped)"
  else
    bad "arm 3: the baseline has no entry for the skipped $PROBE_REL — the manifest stays empty forever"
  fi
else
  bad "arm 3: no $MANIFEST_REL after a skip-only re-run — nothing was staged"
fi
rm -rf "$TC3"

# ══════════════════════════════════════════════════════════════════════════════
# ARM 4 (neg, LOAD-BEARING) — the skip-stage must NOT overwrite a real entry
# ══════════════════════════════════════════════════════════════════════════════
# Staging skips STRONGLY would be worse than the bug: consumer installs, edits a file, re-runs
# `./install.sh` (no --force), copy_safe skips, and the edited bytes become the baseline — the
# guard then reports the consumer's own edit as pristine and the next --refresh destroys it
# silently. This arm pins that the skip-stage is weak: prior entry wins.
TC4=$(make_bare)
( cd "$TC4" && bash "$REPO_ROOT/install.sh" ts-server < /dev/null ) >/dev/null 2>&1
printf 'CONSUMER_EDIT_BEFORE_REINSTALL\n' > "$TC4/$PROBE_REL"
( cd "$TC4" && bash "$REPO_ROOT/install.sh" ts-server < /dev/null ) >/dev/null 2>&1
OUT_4=$( cd "$TC4" && bash "$REPO_ROOT/install.sh" --refresh < /dev/null 2>&1 )
if printf '%s\n' "$OUT_4" | grep -F 'overwriting locally-modified file:' | grep -qF 'deps-hash-check.sh'; then
  ok "arm 4 neg: a re-install did NOT relabel the consumer's edit as the baseline (weak staging)"
else
  bad "arm 4 neg: the re-install overwrote the baseline entry with the consumer's own bytes — the guard is now blind to that edit"
fi
rm -rf "$TC4"

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
