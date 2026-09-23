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

# ══════════════════════════════════════════════════════════════════════════════
# ARM 5 (critical-review S2-2) — a consumer file that PRE-DATES the install is not baselined
# ══════════════════════════════════════════════════════════════════════════════
# The weak stage must only record bytes getff itself delivered. A consumer's own file sitting at a
# delivery path before the FIRST install is skipped by copy_safe; staging it anyway made the
# consumer's bytes the «pristine framework» baseline, so the next `--force` overwrote it with no
# preserved copy (the guard saw baseline == disk → pristine).
TC5=$(make_bare)
mkdir -p "$TC5/$(dirname "$PROBE_REL")"
printf 'CONSUMER_OWN_FILE_BEFORE_FIRST_INSTALL\n' > "$TC5/$PROBE_REL"
( cd "$TC5" && bash "$REPO_ROOT/install.sh" ts-server < /dev/null ) >/dev/null 2>&1
E5=$(jq -r --arg k "$PROBE_REL" 'if (type=="object") and has($k) then .[$k] else "" end' "$TC5/$MANIFEST_REL" 2>/dev/null)
if [ -z "$E5" ]; then
  ok "arm 5: the consumer's pre-existing $PROBE_REL was NOT recorded as a framework delivery"
else
  bad "arm 5: the consumer's own pre-existing file became the framework baseline (entry $E5)"
fi
( cd "$TC5" && bash "$REPO_ROOT/install.sh" ts-server --force < /dev/null ) >/dev/null 2>&1
PRES_5=""
for _f in "$TC5/.ai-factory/refresh-conflicts"/deps-hash-check.sh.*; do
  [ -e "$_f" ] && grep -qF 'CONSUMER_OWN_FILE_BEFORE_FIRST_INSTALL' "$_f" && PRES_5="$_f"
done
if [ -n "$PRES_5" ]; then
  ok "arm 5: --force preserved the consumer's own bytes under .ai-factory/refresh-conflicts/"
else
  bad "arm 5: --force overwrote the consumer's own file with no preserved copy"
fi
rm -rf "$TC5"

# ARM 5b — the same unbaselined consumer file under --refresh (critical-review cold pass, M2).
# RI-2 (#1512) let the refresh path overwrite a no-entry file silently; W1-A lifted that only for
# the destructive paths. With weak staging now limited to byte-identical files, every pre-existing
# consumer file is no-entry — so --refresh must preserve it the same D4(c) way (silent copy +
# one aggregate line), never drop it.
TC5B=$(make_bare)
mkdir -p "$TC5B/$(dirname "$PROBE_REL")"
printf 'CONSUMER_OWN_FILE_BEFORE_FIRST_INSTALL\n' > "$TC5B/$PROBE_REL"
( cd "$TC5B" && bash "$REPO_ROOT/install.sh" ts-server < /dev/null ) >/dev/null 2>&1
OUT_5B=$( cd "$TC5B" && bash "$REPO_ROOT/install.sh" --refresh < /dev/null 2>&1 )
PRES_5B=""
for _f in "$TC5B/.ai-factory/refresh-conflicts"/deps-hash-check.sh.*; do
  [ -e "$_f" ] && grep -qF 'CONSUMER_OWN_FILE_BEFORE_FIRST_INSTALL' "$_f" && PRES_5B="$_f"
done
if [ -n "$PRES_5B" ]; then
  ok "arm 5b: --refresh preserved the consumer's unbaselined bytes under .ai-factory/refresh-conflicts/"
else
  bad "arm 5b: --refresh overwrote the consumer's unbaselined file with no preserved copy"
fi
if printf '%s\n' "$OUT_5B" | grep -q 'preserved [0-9]* unbaselined diverged file'; then
  ok "arm 5b: --refresh reported the preserve in the one aggregate line"
else
  bad "arm 5b: no aggregate preserve line on --refresh"
fi
rm -rf "$TC5B"

# ══════════════════════════════════════════════════════════════════════════════
# ARM 6 (critical-review S2-1) — a consumer file inside a delivered DIRECTORY survives --refresh
# ══════════════════════════════════════════════════════════════════════════════
# scripts/fences-fire-fixtures is a consumer-extensible payload. If the consumer created the
# directory (with their own fixture) before the first install, copy_safe skips the whole dir; the
# weak stage used to baseline every file in it, and --refresh then treated the consumer's fixture
# as framework residue and deleted it.
TC6=$(make_bare)
FIX_REL="scripts/fences-fire-fixtures/consumer-own.manifest.json"
mkdir -p "$TC6/scripts/fences-fire-fixtures"
printf '{"consumer":"own"}\n' > "$TC6/$FIX_REL"
( cd "$TC6" && bash "$REPO_ROOT/install.sh" ts-server < /dev/null ) >/dev/null 2>&1
( cd "$TC6" && bash "$REPO_ROOT/install.sh" --refresh < /dev/null ) >/dev/null 2>&1
if [ -f "$TC6/$FIX_REL" ]; then
  ok "arm 6: the consumer's own fixture inside the delivered dir survived --refresh"
else
  bad "arm 6: --refresh deleted the consumer's own $FIX_REL"
fi
rm -rf "$TC6"

# ══════════════════════════════════════════════════════════════════════════════
# ARM 7 (critical-review cold pass) — post-processed deliveries are re-baselined on an all-skip run
# ══════════════════════════════════════════════════════════════════════════════
# Weak staging stages only bytes that equal the delivery. For a post-processed delivery
# (arch-header ARCHITECTURE.md, md-refs agents) the delivery is NOT the raw src, so a raw-src
# comparison never matched and the A1-2 manifest rebuild silently lost those files.
TC7=$(make_bare)
( cd "$TC7" && bash "$REPO_ROOT/install.sh" ts-server < /dev/null ) >/dev/null 2>&1
rm -f "$TC7/$MANIFEST_REL"
( cd "$TC7" && bash "$REPO_ROOT/install.sh" ts-server < /dev/null ) >/dev/null 2>&1
for _rel in .ai-factory/ARCHITECTURE.md $(cd "$TC7" && ls .claude/agents/*.md 2>/dev/null | head -1); do
  E7=$(jq -r --arg k "$_rel" 'if (type=="object") and has($k) then .[$k] else "" end' "$TC7/$MANIFEST_REL" 2>/dev/null)
  if [ -n "$E7" ]; then
    ok "arm 7: the all-skip re-install re-baselined the post-processed $_rel"
  else
    bad "arm 7: the all-skip re-install left the post-processed $_rel out of the baseline"
  fi
done
rm -rf "$TC7"

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
