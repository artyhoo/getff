#!/usr/bin/env bash
# tests/install-sh/python-rules-lock.test.sh — ecosystem-wiring W3: the PYTHON RULES-LOCK VARIANT.
#
# Gates the deterministic content of .getff/rules-lock.python.json emitted by install.sh's python lane
# (do_python_lane → setup.d/45-python.sh _py_write_rules_lock). The lock's ONE non-deterministic field
# (wall-clock emittedAt) is excluded from the byte-identical snapshot (tests/install-sh/snapshot.sh);
# this test is the targeted deterministic guard the snapshot exclusion points at
# (attention-is-not-a-mechanism §1 — a non-deterministic field is not left byte-unguarded, its
# deterministic siblings are asserted here).
#
# Drives the REAL install.sh in mktemp -d fixtures (subprocess, like python-entry-lane.test.sh) — the
# lock is written from install.sh's main flow, not from the pure deliver_python_toolchain config tree.
#
# DETERMINISTIC arms (always run — the CI signal): schema shape, ruleIds ↔ delivered files (non-vacuity),
# ruffBans, 16-hex fingerprint, reproducibility (same rule set → same fingerprint across consumers),
# idempotency (plain re-run byte-identical), --refresh regenerate, .ai-factory NEVER created, and the
# TEETH arm — a DIFFERENT delivered rule set (a live-generated researched rule rides the seam via
# PY_TEMPLATE_DIR) yields a DIFFERENT fingerprint + the extra ruleId (proves the lock reflects the
# actual delivered set, not a constant).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL="$REPO_ROOT/install.sh"
TPL="$REPO_ROOT/packages/core/templates/python"
RESEARCHED="$REPO_ROOT/packages/core/synthesizer/fixtures/live-generation/firing/rules/getff-researched-no-yaml-load.yml"
LOCK_REL=".getff/rules-lock.python.json"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip() { echo "  · $1"; }

[ -f "$INSTALL" ] || { echo "FATAL: $INSTALL not found"; exit 1; }
[ -d "$TPL" ]     || { echo "FATAL: python templates not found at $TPL"; exit 1; }

py_fixture() {  # echo a fresh temp dir seeded with a pyproject.toml (a pure Python consumer)
  local d; d=$(mktemp -d)
  printf '[project]\nname = "demo"\nversion = "0.0.1"\n' > "$d/pyproject.toml"
  echo "$d"
}

# Grep a top-level string/number field out of the lock (portable — no jq/python3 dependency).
lock_field() { grep -oE "\"$2\"[[:space:]]*:[[:space:]]*(\"[^\"]*\"|[0-9]+|null)" "$1" | head -1 | sed -E 's/.*:[[:space:]]*//; s/^"//; s/"$//'; }

echo "▶ Python rules-lock variant (.getff/rules-lock.python.json) — schema · non-vacuity · determinism"
echo ""

# ── (1) fresh install → the lock exists with the expected schema shape ─────────────────────────────
echo "  ── (1) fresh install.sh python → rules-lock.python.json shape ──"
P=$(py_fixture)
out=$( cd "$P" && bash "$INSTALL" python --force < /dev/null 2>&1 ); rc=$?
LOCK="$P/$LOCK_REL"
[ "$rc" -eq 0 ] || bad "(1) install exit $rc: $(echo "$out" | tail -3 | tr '\n' '|')"
[ -f "$LOCK" ] \
  && ok "(1) $LOCK_REL emitted on the python install path" \
  || bad "(1) $LOCK_REL NOT emitted (do_python_lane did not call _py_write_rules_lock)"
[ "$(lock_field "$LOCK" schemaVersion)" = "1" ]     && ok "(1) schemaVersion=1"        || bad "(1) schemaVersion != 1"
[ "$(lock_field "$LOCK" framework)" = "python" ]    && ok "(1) framework=python"        || bad "(1) framework != python"
grep -q '"version"[[:space:]]*:[[:space:]]*null' "$LOCK" && ok "(1) version=null"        || bad "(1) version field missing/!=null"
grep -q '"ruleIds"'  "$LOCK" && ok "(1) ruleIds array present"  || bad "(1) ruleIds missing"
grep -q '"ruffBans"' "$LOCK" && ok "(1) ruffBans array present" || bad "(1) ruffBans missing"

# ── (2) NEVER under .ai-factory/ (the npm lane's dir; the python lane forbids it) ──────────────────
echo ""; echo "  ── (2) lock lives under .getff/ (no .ai-factory/ fabricated) ──"
[ ! -e "$P/.ai-factory" ] \
  && ok "(2) no .ai-factory/ — lock rides the .getff/ namespace (no new channel)" \
  || bad "(2) .ai-factory/ appeared on the python lane (wrong home / npm leak)"

# ── (3) non-vacuity: ruleIds ↔ the delivered ast-grep rule files; ruffBans = TID251/TID253 ─────────
echo ""; echo "  ── (3) ruleIds match delivered files; ruffBans match delivered bans ──"
delivered_ids=$(grep -hE '^id:' "$P"/.getff/astgrep-rules/*.yml 2>/dev/null \
  | sed -E 's/^id:[[:space:]]*"?([^"]*)"?[[:space:]]*$/\1/' | sort -u)
n_delivered=$(printf '%s\n' "$delivered_ids" | grep -c .)
for id in $delivered_ids; do
  grep -q "\"$id\"" "$LOCK" || bad "(3) delivered rule '$id' MISSING from lock ruleIds"
done
n_locked=$(grep -oE '"getff-[a-z0-9-]+"' "$LOCK" | sort -u | grep -c .)
[ "$n_delivered" -eq "$n_locked" ] \
  && ok "(3) all $n_delivered delivered ast-grep rule id(s) present in lock (non-vacuous)" \
  || bad "(3) count mismatch: delivered=$n_delivered locked=$n_locked"
grep -q '"TID251"' "$LOCK" && grep -q '"TID253"' "$LOCK" \
  && ok "(3) ruffBans list the delivered TID251/TID253 bans" \
  || bad "(3) ruffBans missing TID251/TID253"

# ── (4) sourceFingerprint is a 16-hex digest ───────────────────────────────────────────────────────
echo ""; echo "  ── (4) sourceFingerprint shape ──"
fp1=$(lock_field "$LOCK" sourceFingerprint)
printf '%s' "$fp1" | grep -qE '^[0-9a-f]{16}$' \
  && ok "(4) sourceFingerprint is 16-hex ($fp1)" \
  || bad "(4) sourceFingerprint not 16-hex: '$fp1'"

# ── (5) reproducibility: a second fresh consumer with the SAME rule set → SAME fingerprint ─────────
echo ""; echo "  ── (5) reproducibility (same rules → same fingerprint) ──"
P2=$(py_fixture)
( cd "$P2" && bash "$INSTALL" python --force < /dev/null ) >/dev/null 2>&1
fp2=$(lock_field "$P2/$LOCK_REL" sourceFingerprint)
[ -n "$fp1" ] && [ "$fp1" = "$fp2" ] \
  && ok "(5) identical delivered rule set → identical sourceFingerprint" \
  || bad "(5) fingerprints diverge across identical installs: '$fp1' vs '$fp2'"

# ── (6) idempotency: a plain re-run leaves the lock byte-identical (stable emittedAt) ──────────────
echo ""; echo "  ── (6) idempotent plain re-run (emittedAt stable) ──"
before=$(cat "$LOCK")
( cd "$P" && bash "$INSTALL" python --force < /dev/null ) >/dev/null 2>&1
[ "$before" = "$(cat "$LOCK")" ] \
  && ok "(6) re-run is idempotent — lock byte-identical (skip-if-present)" \
  || bad "(6) plain re-run changed the lock (not idempotent)"

# ── (7) --refresh regenerates the lock with the SAME fingerprint (rules unchanged) ─────────────────
echo ""; echo "  ── (7) --refresh regenerates (same rules → same fingerprint) ──"
( cd "$P" && bash "$INSTALL" python --refresh < /dev/null ) >/dev/null 2>&1
fp_refresh=$(lock_field "$LOCK" sourceFingerprint)
[ "$fp_refresh" = "$fp1" ] \
  && ok "(7) --refresh keeps the fingerprint (deterministic over the unchanged rule set)" \
  || bad "(7) --refresh changed the fingerprint for an unchanged rule set: '$fp1' → '$fp_refresh'"

# ── (8) TEETH: a live-generated researched rule rides the seam → DIFFERENT fingerprint + extra id ──
# Proves the lock reflects the ACTUAL delivered set (not a constant): the researched rule
# (getff-researched-no-yaml-load) joins via the existing PY_TEMPLATE_DIR seam hook (ZERO seam edit).
echo ""; echo "  ── (8) teeth: researched rule via PY_TEMPLATE_DIR changes the lock ──"
if [ -f "$RESEARCHED" ]; then
  SRC=$(mktemp -d)
  cp -R "$TPL/." "$SRC/"
  cp "$RESEARCHED" "$SRC/.getff/astgrep-rules/"
  P3=$(py_fixture)
  ( cd "$P3" && PY_TEMPLATE_DIR="$SRC" bash "$INSTALL" python --force < /dev/null ) >/dev/null 2>&1
  LOCK3="$P3/$LOCK_REL"
  fp3=$(lock_field "$LOCK3" sourceFingerprint)
  grep -q '"getff-researched-no-yaml-load"' "$LOCK3" \
    && ok "(8) researched rule id captured in the lock (live-generated rule rode the seam)" \
    || bad "(8) researched rule id MISSING from the lock"
  [ -n "$fp3" ] && [ "$fp3" != "$fp1" ] \
    && ok "(8) different delivered rule set → different fingerprint (lock is non-vacuous)" \
    || bad "(8) fingerprint did NOT change for an extra rule: starter=$fp1 researched=$fp3"
  rm -rf "$SRC" "$P3"
else
  skip "(8) researched fixture absent ($RESEARCHED) — teeth arm skipped"
fi

rm -rf "$P" "$P2"
echo ""
echo "── python-rules-lock: $PASS passed, $FAIL failed ──"
[ "$FAIL" -eq 0 ] || exit 1
