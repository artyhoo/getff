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

# ── (6) idempotency: a plain NO-FLAG re-run leaves the lock byte-identical (skip-if-present) ────────
# The idempotent skip fires ONLY on the plain no-flag re-run where copy_safe did NOT overwrite the
# delivered artefacts. --force / --refresh are OVERWRITE paths that DO regenerate (arms (7) + (9)) — so
# this arm must use a bare `install.sh python`, NOT --force (which now correctly regenerates the lock).
echo ""; echo "  ── (6) idempotent plain no-flag re-run (emittedAt stable) ──"
before=$(cat "$LOCK")
( cd "$P" && bash "$INSTALL" python < /dev/null ) >/dev/null 2>&1
[ "$before" = "$(cat "$LOCK")" ] \
  && ok "(6) plain no-flag re-run is idempotent — lock byte-identical (skip-if-present)" \
  || bad "(6) plain no-flag re-run changed the lock (not idempotent)"

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

# ── (9) REGRESSION (W3 rework, MAJOR): --force re-delivery must NOT leave a STALE lock ─────────────
# copy_safe (lib.sh:79) OVERWRITES the delivered .getff/ artefacts under --force. The lock — whose whole
# job is to record the DELIVERED set (ruleIds/ruffBans/sourceFingerprint) — must therefore be regenerated
# on --force too, not only on --refresh. Before the fix _py_write_rules_lock regenerated ONLY on
# GETFF_TOOLCHAIN_REFRESH=1, so `install.sh python --force` over a prior install whose template CHANGED
# delivered a NEW ruff-bans.toml but left ruffBans/sourceFingerprint STALE (the lock lied). RED before the
# fix (fpB==fpA, no TID999 in the lock); GREEN after (lock tracks template B).
echo ""; echo "  ── (9) regression: --force re-delivery regenerates the lock (no stale ruffBans/fingerprint) ──"
SRC9=$(mktemp -d); cp -R "$TPL/." "$SRC9/"
P9=$(py_fixture)
( cd "$P9" && PY_TEMPLATE_DIR="$SRC9" bash "$INSTALL" python --force < /dev/null ) >/dev/null 2>&1
L9="$P9/$LOCK_REL"
fpA=$(lock_field "$L9" sourceFingerprint)
grep -q '"TID999"' "$L9" && preTID=1 || preTID=0
# Mutate the template B: the delivered .getff/ruff-bans.toml is a copy of the template ruff.toml — add a ban.
sed -i.bak -E 's/select = \["TID251", "TID253"\]/select = ["TID251", "TID253", "TID999"]/' "$SRC9/ruff.toml" && rm -f "$SRC9/ruff.toml.bak"
# Re-install with --force (NOT --refresh) over the SAME consumer → copy_safe overwrites ruff-bans.toml.
( cd "$P9" && PY_TEMPLATE_DIR="$SRC9" bash "$INSTALL" python --force < /dev/null ) >/dev/null 2>&1
grep -q 'TID999' "$P9/.getff/ruff-bans.toml" \
  && ok "(9) --force re-delivery overwrote the delivered ruff-bans.toml (template B reached the consumer)" \
  || bad "(9) --force did NOT overwrite ruff-bans.toml — repro precondition unmet"
fpB=$(lock_field "$L9" sourceFingerprint)
if [ "$preTID" -eq 0 ] && grep -q '"TID999"' "$L9" && [ -n "$fpB" ] && [ "$fpB" != "$fpA" ]; then
  ok "(9) lock regenerated on --force: ruffBans gained TID999 + fingerprint moved $fpA→$fpB (not stale)"
else
  bad "(9) STALE lock after --force: TID999-in-lock=$(grep -c '"TID999"' "$L9") fp $fpA→$fpB (RED before fix)"
fi
rm -rf "$SRC9" "$P9"

# ── (10) MINOR (W3 rework): loud degrade when NO sha256/md5 hash tool is on PATH ───────────────────
# The sourceFingerprint hash ladder falls through to a fake CONSTANT (0000000000000000) when the host has
# no sha256sum/shasum/md5/md5sum. That constant must NEVER be trusted silently (attention-is-not-a-
# mechanism §1 / degrade-loudly) → assert the loud stderr warning fires. Driven via the lib-only seam
# (PY_LAYER_LIB_ONLY=1) under a pruned PATH holding only the coreutils the writer needs — NOT the hash
# tools — so the no-tool branch is reached deterministically without perturbing the full installer.
echo ""; echo "  ── (10) loud degrade: no hash tool → stderr warning + non-authoritative fingerprint ──"
BASHBIN=$(command -v bash)
BIN=$(mktemp -d)
for t in cat find sort sed grep awk date mkdir rm head wc; do
  p=$(command -v "$t" 2>/dev/null) && ln -sf "$p" "$BIN/$t"
done
P10=$(py_fixture)
mkdir -p "$P10/.getff/astgrep-rules"
cp "$TPL/.getff/astgrep-rules/"*.yml "$P10/.getff/astgrep-rules/"
cp "$TPL/ruff.toml" "$P10/.getff/ruff-bans.toml"
warn10=$(
  PATH="$BIN" PY_LAYER_LIB_ONLY=1 PROJECT_ROOT="$P10" DRY_RUN="" GETFF_TOOLCHAIN_REFRESH="" FORCE="--force" \
    "$BASHBIN" -c 'source "$1"; _py_write_rules_lock >/dev/null' _ "$REPO_ROOT/setup.d/45-python.sh" 2>&1
)
fp10=$(lock_field "$P10/$LOCK_REL" sourceFingerprint)
printf '%s' "$warn10" | grep -q "non-authoritative" \
  && ok "(10) loud stderr warning emitted when no hash tool is on PATH (RED before fix — was silent)" \
  || bad "(10) NO loud warning on the no-hash-tool degrade path (silent fake fingerprint)"
[ "$fp10" = "0000000000000000" ] \
  && ok "(10) fingerprint degrades to the documented non-authoritative constant" \
  || bad "(10) unexpected fingerprint on the degrade path: '$fp10'"
rm -rf "$BIN" "$P10"

# ── (11) REGRESSION (W5 rework, MAJOR): a PLAIN re-run after a researched-rule JOIN must NOT ──────
# leave a STALE lock. _py_join_researched_rules (setup.d/45-python.sh) runs on EVERY delivery pass —
# including the plain no-flag re-run — so a consumer-side researched rule rendered into
# .getff/rules-research/ between passes CHANGES the delivered set with NO overwrite flag in sight.
# The W3-era flag-gated skip (`lock exists && !REFRESH && !FORCE → skip`) assumed «no overwrite flag
# ⇒ delivered set unchanged» — false since the join exists. The fix makes the guard CONTENT-AWARE:
# skip only when the stored sourceFingerprint equals the freshly-computed one. RED before the fix
# (lock keeps the starter-only ids + fingerprint after the join delivered a 5th rule); GREEN after
# (researched id present + fingerprint moved). The session-side render hop is vitest-covered
# (rule-bootstrap-practice.test.ts render-parity oracle) — the committed rendered artifact IS its
# byte-identical output, so copying it into rules-research is the same consumer state, Node-free.
echo ""; echo "  ── (11) regression: researched join on a PLAIN re-run regenerates the lock (content-aware) ──"
if [ -f "$RESEARCHED" ]; then
  P11=$(py_fixture)
  ( cd "$P11" && bash "$INSTALL" python < /dev/null ) >/dev/null 2>&1
  L11="$P11/$LOCK_REL"
  [ -f "$L11" ] || bad "(11) plain fresh install did not emit the lock — precondition unmet"
  fpP=$(lock_field "$L11" sourceFingerprint)
  nP=$(grep -oE '"getff-[a-z0-9-]+"' "$L11" | sort -u | grep -c .)
  grep -q '"getff-researched-no-yaml-load"' "$L11" && preRes=1 || preRes=0
  [ "$preRes" -eq 0 ] || bad "(11) researched id already in the starter lock — precondition unmet"
  # The consumer authors a researched rule between passes (rendered home survives --refresh).
  mkdir -p "$P11/.getff/rules-research"
  cp "$RESEARCHED" "$P11/.getff/rules-research/"
  # PLAIN no-flag re-run — the join delivers the researched rule; NO overwrite flag is set.
  ( cd "$P11" && bash "$INSTALL" python < /dev/null ) >/dev/null 2>&1
  [ -f "$P11/.getff/astgrep-rules/getff-researched-no-yaml-load.yml" ] \
    && ok "(11) plain re-run joined the researched rule into the scan dir (repro precondition)" \
    || bad "(11) researched rule did NOT join on the plain re-run — repro precondition unmet"
  fpQ=$(lock_field "$L11" sourceFingerprint)
  nQ=$(grep -oE '"getff-[a-z0-9-]+"' "$L11" | sort -u | grep -c .)
  if grep -q '"getff-researched-no-yaml-load"' "$L11" && [ -n "$fpQ" ] && [ "$fpQ" != "$fpP" ]; then
    ok "(11) lock regenerated on the PLAIN pass: researched id captured ($nP→$nQ ids) + fingerprint moved $fpP→$fpQ"
  else
    bad "(11) STALE lock after the plain-pass join: ids $nP→$nQ fp $fpP→$fpQ researched-in-lock=$(grep -c 'researched-no-yaml-load' "$L11" || true) (RED before fix)"
  fi
  rm -rf "$P11"
else
  skip "(11) researched fixture absent ($RESEARCHED) — regression arm skipped"
fi

rm -rf "$P" "$P2"
echo ""
echo "── python-rules-lock: $PASS passed, $FAIL failed ──"
[ "$FAIL" -eq 0 ] || exit 1
