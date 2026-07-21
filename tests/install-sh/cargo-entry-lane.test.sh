#!/usr/bin/env bash
# tests/install-sh/cargo-entry-lane.test.sh — the `install.sh cargo` / `./setup cargo` entry lane
# (ecosystem-wiring W4): arg parsing, detection order, no-package.json bypass, npm flow untouched,
# --refresh re-delivery, the augment-first clippy REFUSE cell (incl. the delivered-config regression
# arms 5a/5b: self-check fires on the DELIVERED getff-clippy.toml + the rules-lock fingerprints it,
# never the consumer's own file), and the post-install firing self-check (fire + tool-gated degrade).
# The cargo analog of python-entry-lane.test.sh.
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
_sha256() {  # portable sha256 (linux sha256sum / macOS shasum)
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'
  else shasum -a 256 "$1" | awk '{print $1}'; fi
}

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
# ── Finding-1 regression arms (W4 rework): in the REFUSE cell, the self-check and the rules-lock
# must target the DELIVERED getff-clippy.toml — never the consumer's own clippy.toml (which lacks
# our bans, so a self-check against it reports a FALSE «SILENT», and a lock hashing it lies about
# the delivered set). Tool-gated like arm (6): with cargo present the self-check must FIRE.
if command -v cargo >/dev/null 2>&1; then
  echo "$out" | grep -q "fired RED on the planted violation" \
    && ok "(5a) REFUSE cell: self-check FIRED — it proved the DELIVERED getff-clippy.toml, not the consumer's config" \
    || bad "(5a) REFUSE cell: self-check did not fire (ran against the consumer's clippy.toml — delivered-config resolution bug)"
  echo "$out" | grep -q "SILENT (delivery bug)" \
    && bad "(5a) REFUSE cell: false SILENT verdict — self-check proved the WRONG (consumer) config" \
    || ok "(5a) REFUSE cell: no false SILENT verdict"
else
  echo "$out" | grep -q "firing NOT proven (degrade, NOT green)" \
    && ok "(5a) REFUSE cell: cargo absent → loud degrade (arm not vacuous)" \
    || bad "(5a) REFUSE cell: cargo absent but no loud degrade printed"
fi
LOCK="$C/.ai-factory/synthesizer-output/rules-lock.cargo.json"
lock_fp=$(sed -n 's/.*"sourceFingerprint": "sha256:\([0-9a-f]*\)".*/\1/p' "$LOCK" 2>/dev/null)
delivered_fp=$(_sha256 "$C/getff-clippy.toml")
consumer_fp=$(_sha256 "$C/clippy.toml")
{ [ -n "$lock_fp" ] && [ "$lock_fp" = "$delivered_fp" ]; } \
  && ok "(5b) rules-lock sourceFingerprint = sha256(getff-clippy.toml) — the lock records the DELIVERED set" \
  || bad "(5b) rules-lock sourceFingerprint (${lock_fp:-<none>}) != sha256(delivered getff-clippy.toml) ($delivered_fp)"
[ "$lock_fp" != "$consumer_fp" ] \
  && ok "(5b) rules-lock does NOT hash the consumer's clippy.toml (the lock does not lie)" \
  || bad "(5b) rules-lock hashes the CONSUMER's clippy.toml — the lock misrepresents the delivered set"
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
