#!/usr/bin/env bash
# tests/install-sh/cargo-entry-lane.test.sh — the `install.sh cargo` / `./setup cargo` entry lane
# (ecosystem-wiring W4): arg parsing, detection order, no-package.json bypass, npm flow untouched,
# --refresh re-delivery, the augment-first clippy REFUSE cell, and the post-install firing self-check
# (fire + tool-gated degrade). The cargo analog of python-entry-lane.test.sh.
#
# Drives the REAL install.sh in mktemp -d fixtures (subprocess, like snapshot.sh) — the entry lane
# lives in install.sh's main flow. The firing self-check's DEGRADE arm is unit-tested directly via the
# CARGO_LAYER_LIB_ONLY seam (call _cargo_firing_self_check with a stripped PATH → no cargo).
#
# DETERMINISTIC arms (always run — the CI signal): detection, no-package.json bypass, npm untouched,
# --refresh overwrite, the clippy REFUSE cell, and the tool-ABSENT degrade path (loud, never green).
# TOOL-GATED arm: when cargo is on PATH, the self-check must FIRE RED (else it degrades loudly —
# asserted either way, so the arm is never vacuous).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL="$REPO_ROOT/install.sh"
LAYER="$REPO_ROOT/setup.d/46-cargo.sh"
TPL="$REPO_ROOT/packages/core/templates/cargo"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

[ -f "$INSTALL" ] || { echo "FATAL: $INSTALL not found"; exit 1; }

cargo_fixture() {  # echo a fresh temp dir seeded with a Cargo.toml (a pure Rust consumer)
  local d; d=$(mktemp -d)
  printf '[package]\nname = "demo"\nversion = "0.0.1"\nedition = "2021"\n\n[dependencies]\n' > "$d/Cargo.toml"
  echo "$d"
}

echo "▶ Cargo entry lane (install.sh cargo) — detection · bypass · refresh · REFUSE cell · self-check"
echo ""

# ── (1) fresh explicit `install.sh cargo` on a pure-Rust repo → delivers, no npm artefacts ─────────
echo "  ── (1) fresh explicit: install.sh cargo (Cargo.toml only, no package.json) ──"
C=$(cargo_fixture)
out=$( cd "$C" && bash "$INSTALL" cargo < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] \
  && ok "(1) exit 0 (no-package.json precondition BYPASSED — a Rust repo has no package.json)" \
  || bad "(1) non-zero exit $rc on a pure-Rust repo: $(echo "$out" | tail -3 | tr '\n' '|')"
cmp -s "$TPL/clippy.toml" "$C/clippy.toml" \
  && ok "(1) clippy.toml delivered (byte-identical to template)" \
  || bad "(1) clippy.toml missing/differs"
[ -f "$C/deny.toml" ] && [ -f "$C/.getff/Cargo.lints.toml" ] && [ -f "$C/.github/workflows/getff-cargo.yml" ] \
  && ok "(1) deny.toml + .getff/Cargo.lints.toml + getff-cargo.yml delivered" \
  || bad "(1) deny.toml / Cargo.lints.toml / CI workflow missing"
[ -f "$C/.ai-factory/synthesizer-output/rules-lock.cargo.json" ] \
  && ok "(1) cargo rules-lock written (.ai-factory/synthesizer-output/rules-lock.cargo.json)" \
  || bad "(1) rules-lock.cargo.json missing"
[ ! -e "$C/package.json" ] \
  && ok "(1) no package.json fabricated on the cargo lane" \
  || bad "(1) package.json appeared (npm lane leaked)"
if [ ! -e "$C/eslint.config.mjs" ] && [ ! -e "$C/.husky" ]; then
  ok "(1) NO npm artefacts (eslint.config.mjs / .husky) — npm layer loop never ran"
else
  bad "(1) npm artefact(s) leaked onto the cargo lane"
fi
[ ! -e "$C/target" ] \
  && ok "(1) no target/ in the consumer tree (self-check fires in an OS temp dir ONLY — STOP line)" \
  || bad "(1) target/ leaked into the consumer tree (STOP-line violation)"
rm -rf "$C"

# ── (2) explicit `cargo` OVERRIDES npm auto-detect in a MIXED repo (package.json + Cargo.toml) ─────
echo "  ── (2) explicit cargo overrides npm auto-detect (mixed repo) ──"
C=$(cargo_fixture)
printf '{"name":"mixed","version":"0.0.0"}\n' > "$C/package.json"
out=$( cd "$C" && bash "$INSTALL" cargo < /dev/null 2>&1 ); rc=$?
{ [ "$rc" -eq 0 ] && [ -f "$C/clippy.toml" ]; } \
  && ok "(2) explicit cargo positional took the Rust lane despite package.json present" \
  || bad "(2) explicit cargo did not deliver on a mixed repo (rc=$rc)"
rm -rf "$C"

# ── (3) npm flow UNTOUCHED — a bare npm install must NOT trigger the cargo lane ─────────────────────
echo "  ── (3) npm flow untouched (package.json only, no Cargo.toml) ──"
N=$(mktemp -d)
printf '{"name":"npm-only","version":"0.0.0"}\n' > "$N/package.json"
( cd "$N" && git init -q && git config user.email t@t.co && git config user.name t ) >/dev/null 2>&1
out=$( cd "$N" && bash "$INSTALL" ts-server --force < /dev/null 2>&1 ) || true
{ [ ! -f "$N/clippy.toml" ] && [ ! -f "$N/deny.toml" ]; } \
  && ok "(3) npm lane produced NO cargo artefacts (46-cargo.sh inert on npm — guarded no-op)" \
  || bad "(3) cargo artefact leaked onto the npm lane (activation guard broken)"
rm -rf "$N"

# ── (4) --refresh re-delivery OVERWRITES a framework-owned clippy.toml (brownfield update) ─────────
echo "  ── (4) --refresh overwrites the framework-owned clippy.toml ──"
C=$(cargo_fixture)
( cd "$C" && bash "$INSTALL" cargo < /dev/null ) >/dev/null 2>&1
# Mutate the delivered getff clippy.toml, then --refresh must restore the template bytes.
echo "# consumer tampered" >> "$C/clippy.toml"
out=$( cd "$C" && bash "$INSTALL" cargo --refresh < /dev/null 2>&1 ) || true
cmp -s "$TPL/clippy.toml" "$C/clippy.toml" \
  && ok "(4) --refresh restored the framework-owned clippy.toml to template bytes" \
  || bad "(4) --refresh did not overwrite the tampered getff clippy.toml"
rm -rf "$C"

# ── (5) augment-first REFUSE cell — a consumer-authored clippy.toml is NOT clobbered ──────────────
echo "  ── (5) REFUSE cell: consumer clippy.toml kept, ours shipped as getff-clippy.toml ──"
C=$(cargo_fixture)
printf 'cognitive-complexity-threshold = 30\n' > "$C/clippy.toml"
CONSUMER_BEFORE=$(cat "$C/clippy.toml")
out=$( cd "$C" && bash "$INSTALL" cargo < /dev/null 2>&1 ) || true
{ [ "$(cat "$C/clippy.toml")" = "$CONSUMER_BEFORE" ] && [ -f "$C/getff-clippy.toml" ]; } \
  && ok "(5) consumer clippy.toml untouched + our rules shipped as getff-clippy.toml (cell ii REFUSE)" \
  || bad "(5) REFUSE cell wrong: consumer clippy.toml modified or getff-clippy.toml missing"
echo "$out" | grep -q "REFUSE clippy.toml" \
  && ok "(5) delivery log announced the REFUSE loudly (attention-is-not-a-mechanism)" \
  || bad "(5) no loud REFUSE announcement in the delivery log"
rm -rf "$C"

# ── (6) firing self-check — tool-gated (FIRE when cargo present, else loud degrade) ────────────────
echo "  ── (6) firing self-check (tool-gated) ──"
C=$(cargo_fixture)
out=$( cd "$C" && bash "$INSTALL" cargo < /dev/null 2>&1 ) || true
if command -v cargo >/dev/null 2>&1; then
  echo "$out" | grep -q "fired RED on the planted violation" \
    && ok "(6) cargo present → self-check FIRED RED on the planted std::env::var violation" \
    || bad "(6) cargo present but self-check did not report a RED firing: $(echo "$out" | tail -3 | tr '\n' '|')"
else
  echo "$out" | grep -q "firing NOT proven (degrade, NOT green)" \
    && ok "(6) cargo absent → loud tool-absent degrade (never silently green)" \
    || bad "(6) cargo absent but no loud degrade printed"
fi
rm -rf "$C"

# ── (7) degrade path (stripped PATH, no cargo) via the CARGO_LAYER_LIB_ONLY seam ──────────────────
echo "  ── (7) degrade path (stripped PATH, no cargo) ──"
C=$(cargo_fixture)
cp "$TPL/clippy.toml" "$C/clippy.toml"
deg=$(
  CARGO_LAYER_LIB_ONLY=1 PROJECT_ROOT="$C" \
  PATH="/usr/bin:/bin" bash -c '
    source "'"$LAYER"'"
    _cargo_firing_self_check
  ' 2>&1
)
echo "$deg" | grep -q "cargo not on PATH" \
  && ok "(7) stripped-PATH self-check prints the loud tool-absent degrade" \
  || bad "(7) degrade arm did not fire on a stripped PATH"
echo "$deg" | grep -q "a skipped check is NOT green" \
  && ok "(7) degrade summary refuses to claim green (attention-is-not-a-mechanism honesty)" \
  || bad "(7) degrade summary missing the not-green honesty line"
[ ! -e "$C/target" ] \
  && ok "(7) degrade run wrote nothing under the consumer tree (temp-dir-only STOP line holds)" \
  || bad "(7) degrade run leaked target/ into the consumer tree"
rm -rf "$C"

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
