#!/usr/bin/env bash
# tests/install-sh/rules-lock-schema-parity.test.sh — adapter-jig arm D3 (lock-schema-parity).
#
# Every lane's emitted rules-lock must carry the F11 CORE field set
#   {schemaVersion, framework, version, ruleIds, emittedAt, sourceFingerprint}
# (packages/core/installer/types.ts RulesLock), judged on the ACTUAL emitted JSON of each lane's
# scratch-install fixture: both lock writers are bash (setup.d/45-python.sh _py_write_rules_lock,
# setup.d/46-cargo.sh _cargo_write_rules_lock), so the exported TS type cannot gate them — only
# this arm can (adapter-jig spec §3.4 D3). Per-lane tool-ban extras (python ruffBans, cargo
# backend/note) are EXTRAS: allowed to differ or be absent — the compare is core-NAMES ⊆ emitted,
# never set-equality, and value formats are deliberately NOT compared (D3 keys on names).
#
# Origin (spec §3.4 D3): F11 froze schema parity on PR-body authority alone — a frozen contract
# row with no checked artifact was attention-dependent. Retrofit RED at landing time: the shipped
# cargo lock omitted 3 of the 6 core fields (schemaVersion, version, ruleIds) — fixed in the same
# increment (fix + arm atomic).
#
# Drives the REAL install.sh in mktemp -d fixtures (subprocess, like python-rules-lock.test.sh /
# cargo-entry-lane.test.sh). Deterministic, no network.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL="$REPO_ROOT/install.sh"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

[ -f "$INSTALL" ] || { echo "FATAL: $INSTALL not found"; exit 1; }

# The frozen F11 CORE set — name-for-name mirror of RulesLock (packages/core/installer/types.ts).
CORE_FIELDS="schemaVersion framework version ruleIds emittedAt sourceFingerprint"

# Top-level key names of a (flat, one-key-per-line) lock JSON — portable grep, no jq dependency.
lock_keys() { grep -oE '^[[:space:]]*"[A-Za-z][A-Za-z0-9]*"[[:space:]]*:' "$1" | sed -E 's/^[[:space:]]*"([A-Za-z0-9]+)".*/\1/'; }

# Echo the core fields MISSING from lock $1 (empty = full core set present).
missing_core() {
  local keys m="" f
  keys=$(lock_keys "$1")
  for f in $CORE_FIELDS; do
    printf '%s\n' "$keys" | grep -qx "$f" || m="$m $f"
  done
  printf '%s' "$m"
}

echo "▶ Rules-lock schema parity (adapter-jig D3) — F11 core set ⊆ each lane's emitted lock"
echo ""

# ── (1) python lane: scratch install → core set ⊆ emitted keys ─────────────────────────────────────
# @arm:D3:pos lock-schema-parity
echo "  ── (1) python lane emits the full F11 core set ──"
P=$(mktemp -d)
printf '[project]\nname = "demo"\nversion = "0.0.1"\n' > "$P/pyproject.toml"
( cd "$P" && bash "$INSTALL" python --force < /dev/null ) >/dev/null 2>&1
PLOCK="$P/.getff/rules-lock.python.json"
if [ -f "$PLOCK" ]; then
  ok "(1) python scratch install emitted $PLOCK"
  mP=$(missing_core "$PLOCK")
  [ -z "$mP" ] \
    && ok "(1) python lock carries all 6 F11 core fields" \
    || bad "(1) python lock MISSING core field(s):$mP"
else
  bad "(1) python lock not emitted — cannot judge schema parity"
fi

# ── (2) cargo lane: scratch install → core set ⊆ emitted keys ──────────────────────────────────────
# RED before the fix: the shipped cargo writer emitted only {framework, backend, emittedAt,
# sourceFingerprint, note} — schemaVersion/version/ruleIds absent (the real D3 retrofit bug).
echo ""; echo "  ── (2) cargo lane emits the full F11 core set ──"
C=$(mktemp -d)
printf '[package]\nname = "demo"\nversion = "0.0.1"\nedition = "2021"\n\n[dependencies]\n' > "$C/Cargo.toml"
( cd "$C" && bash "$INSTALL" cargo < /dev/null ) >/dev/null 2>&1
CLOCK="$C/.ai-factory/synthesizer-output/rules-lock.cargo.json"
if [ -f "$CLOCK" ]; then
  ok "(2) cargo scratch install emitted $CLOCK"
  mC=$(missing_core "$CLOCK")
  [ -z "$mC" ] \
    && ok "(2) cargo lock carries all 6 F11 core fields (RED before fix — 3 were absent)" \
    || bad "(2) cargo lock MISSING core field(s):$mC"
else
  bad "(2) cargo lock not emitted — cannot judge schema parity"
fi

# ── (3) extras are tolerated: per-lane fields beyond the core set must NOT fail the compare ────────
# The compare is ⊆ (names), not set-equality: python's ruffBans and cargo's backend/note are
# per-lane-named EXTRAS by contract. Assert they exist in the shipped locks AND that the core
# compare above passed anyway — proving the arm does not demand identical schemas.
echo ""; echo "  ── (3) per-lane extras tolerated by the core compare ──"
grep -q '"ruffBans"' "$PLOCK" 2>/dev/null \
  && ok "(3) python extra ruffBans present — and ignored by the core-set compare" \
  || bad "(3) python ruffBans extra missing (fixture drift — update this arm's extras census)"
grep -q '"backend"' "$CLOCK" 2>/dev/null \
  && ok "(3) cargo extra backend present — and ignored by the core-set compare" \
  || bad "(3) cargo backend extra missing (fixture drift — update this arm's extras census)"

# ── (4) discriminator negative: a lock with one core field renamed must RED the compare ────────────
# @arm:D3:neg lock-schema-parity
# Proves the arm has teeth (non-vacuous): schemaVersion→schemaVer stub → missing_core flags it.
echo ""; echo "  ── (4) teeth: renamed core field is detected (arm discriminator) ──"
STUB=$(mktemp)
cat > "$STUB" <<'EOF'
{
  "schemaVer": 1,
  "framework": "python",
  "version": null,
  "ruleIds": [],
  "emittedAt": "2026-01-01T00:00:00Z",
  "sourceFingerprint": "deadbeefdeadbeef"
}
EOF
mS=$(missing_core "$STUB")
case " $mS " in
  *" schemaVersion "*) ok "(4) renamed core field (schemaVersion→schemaVer) REDs the set-compare (non-vacuous)" ;;
  *) bad "(4) compare stayed green with a renamed core field → VACUOUS arm" ;;
esac
rm -f "$STUB"
rm -rf "$P" "$C"

echo ""
echo "── rules-lock-schema-parity: $PASS passed, $FAIL failed ──"
[ "$FAIL" -eq 0 ]
