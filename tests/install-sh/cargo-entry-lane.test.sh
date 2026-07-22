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
# @arm:E2:pos self-check-resolves-delivered-config (cargo lane — 5a fire + no-false-SILENT, 5b lock fp)
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
# @arm:D2:pos no-silent-fingerprint-degrade — hash tool present → authoritative sha256, no warning
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
# @arm:E1:pos scratch-consumer-red-green-pair (cargo lane — planted violation RED + clean control GREEN)
echo "  ── (6) firing self-check (tool-gated) ──"
C=$(cargo_fixture)
out=$( cd "$C" && bash "$INSTALL" cargo < /dev/null 2>&1 ) || true
if command -v cargo >/dev/null 2>&1; then
  echo "$out" | grep -q "fired RED on the planted violation" \
    && ok "(6) cargo present → self-check FIRED RED on the planted std::env::var violation" \
    || bad "(6) cargo present but self-check did not report a RED firing: $(echo "$out" | tail -3 | tr '\n' '|')"
  # Paired GREEN direction (adapter-jig E1): the self-check must ALSO run a conforming clean control
  # and report it green — a RED-only harness passes identically under an always-firing broken config.
  echo "$out" | grep -q "clean control GREEN" \
    && ok "(6) self-check ran the paired CLEAN CONTROL and it stayed GREEN (config discriminates)" \
    || bad "(6) no clean-control GREEN line — the self-check is RED-only (vacuous vs an always-red config): $(echo "$out" | grep -i 'self-check\|clean' | tr '\n' '|')"
  echo "$out" | grep -q "OVER-BROAD" \
    && bad "(6) self-check reported the delivered config OVER-BROAD on a healthy install (false alarm)" \
    || ok "(6) no OVER-BROAD verdict on the healthy delivered config"
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

# ── (8) lock-writer fingerprint degrade must be LOUD, never silent (adapter-jig D2) ────────────────
# @arm:D2:neg no-silent-fingerprint-degrade
# Both silent-degrade triggers of _cargo_write_rules_lock (setup.d/46-cargo.sh):
#   (8a) NO hash tool on PATH (sha256sum/shasum/md5/md5sum all absent) → fingerprint falls back to
#        the documented non-authoritative constant — a LOUD stderr warning MUST accompany it.
#   (8b) delivered clippy config ABSENT ([ -e "$clippy" ] false) → same constant, same obligation.
# RED before the fix: the writer emitted "sha256:unknown" with ZERO stderr on both paths (the exact
# W3-class silent degrade the python lane fixed — 45-python.sh loud else branch, python-rules-lock
# arm 10). Driven via the CARGO_LAYER_LIB_ONLY seam like arm (7); pruned PATH holds only the
# coreutils the writer needs — NOT the hash tools — so the no-tool rung is reached deterministically.
echo "  ── (8) lock-writer degrade: no hash tool / clippy absent → loud non-authoritative warning ──"
BASHBIN=$(command -v bash)
BIN8=$(mktemp -d)
for t in cat awk sed grep date mkdir rm head wc ls; do
  p=$(command -v "$t" 2>/dev/null) && ln -sf "$p" "$BIN8/$t"
done
C=$(cargo_fixture)
cp "$TPL/clippy.toml" "$C/clippy.toml"   # getff-header copy → delivered path resolves to clippy.toml
warn8a=$(
  CARGO_LAYER_LIB_ONLY=1 PROJECT_ROOT="$C" DRY_RUN="" PATH="$BIN8" \
    "$BASHBIN" -c 'source "$1"; _cargo_write_rules_lock >/dev/null' _ "$LAYER" 2>&1
)
fp8a=$(sed -n 's/.*"sourceFingerprint": "\([^"]*\)".*/\1/p' "$C/.ai-factory/synthesizer-output/rules-lock.cargo.json" 2>/dev/null)
printf '%s' "$warn8a" | grep -q "non-authoritative" \
  && ok "(8a) no-hash-tool degrade prints the loud stderr warning (RED before fix — was silent)" \
  || bad "(8a) NO loud warning on the no-hash-tool degrade path (silent fake fingerprint)"
[ "$fp8a" = "sha256:unknown" ] \
  && ok "(8a) fingerprint degrades to the documented non-authoritative constant (sha256:unknown)" \
  || bad "(8a) unexpected fingerprint on the no-hash-tool path: '$fp8a'"
rm -rf "$C"
C=$(cargo_fixture)   # NO clippy config at all → the clippy-absent trigger (full PATH, hash tools present)
warn8b=$(
  CARGO_LAYER_LIB_ONLY=1 PROJECT_ROOT="$C" DRY_RUN="" \
    "$BASHBIN" -c 'source "$1"; _cargo_write_rules_lock >/dev/null' _ "$LAYER" 2>&1
)
fp8b=$(sed -n 's/.*"sourceFingerprint": "\([^"]*\)".*/\1/p' "$C/.ai-factory/synthesizer-output/rules-lock.cargo.json" 2>/dev/null)
printf '%s' "$warn8b" | grep -q "non-authoritative" \
  && ok "(8b) delivered-clippy-absent degrade prints the loud stderr warning (RED before fix — was silent)" \
  || bad "(8b) NO loud warning on the clippy-absent degrade path (silent fake fingerprint)"
[ "$fp8b" = "sha256:unknown" ] \
  && ok "(8b) fingerprint degrades to the documented non-authoritative constant (sha256:unknown)" \
  || bad "(8b) unexpected fingerprint on the clippy-absent path: '$fp8b'"
# Positive control (pairs with the @arm:D2:pos integration arm 5b): full PATH + delivered clippy
# → authoritative sha256:<64hex> and ZERO degrade warning.
cp "$TPL/clippy.toml" "$C/clippy.toml"
warn8c=$(
  CARGO_LAYER_LIB_ONLY=1 PROJECT_ROOT="$C" DRY_RUN="" \
    "$BASHBIN" -c 'source "$1"; _cargo_write_rules_lock >/dev/null' _ "$LAYER" 2>&1
)
fp8c=$(sed -n 's/.*"sourceFingerprint": "\([^"]*\)".*/\1/p' "$C/.ai-factory/synthesizer-output/rules-lock.cargo.json" 2>/dev/null)
printf '%s' "$fp8c" | grep -qE '^sha256:[0-9a-f]{64}$' \
  && ok "(8c) hash tool present → authoritative sha256:<64hex> fingerprint" \
  || bad "(8c) expected sha256:<64hex> with hash tools present, got: '$fp8c'"
printf '%s' "$warn8c" | grep -q "non-authoritative" \
  && bad "(8c) degrade warning fired on the healthy path (false-positive noise)" \
  || ok "(8c) no degrade warning on the healthy path (warning is discriminating, not noise)"
rm -rf "$C" "$BIN8"

# ── (9) E1 discriminating negative: an OVER-BROAD delivered config must be CAUGHT by the clean
# control — the exact false-green the RED-only self-check shipped before this arm (adapter-jig E1
# retrofit): a config firing on EVERY crate printed «enforcement is live» identically. Driven via
# the CARGO_LAYER_LIB_ONLY seam with a getff-header clippy.toml that ALSO bans std::env::args (the
# clean control's own idiom) → the clean control must fire → OVER-BROAD verdict, green refused.
# Tool-gated: without cargo the self-check degrades before reaching either direction.
# @arm:E1:neg scratch-consumer-red-green-pair (over-broad config → clean control REDs the self-check)
if command -v cargo >/dev/null 2>&1; then
  echo "  ── (9) over-broad delivered config → clean control catches it (E1 negative) ──"
  C=$(cargo_fixture)
  {
    echo '# generated by getff cargo backend v0 — do not edit by hand (OVER-BROAD test stub)'
    echo 'disallowed-methods = ['
    echo '    { path = "std::env::var", reason = "banned" },'
    echo '    { path = "std::env::args", reason = "over-broad stub — bans the clean control too" },'
    echo ']'
  } > "$C/clippy.toml"
  over=$(
    CARGO_LAYER_LIB_ONLY=1 PROJECT_ROOT="$C" bash -c '
      source "'"$LAYER"'"
      _cargo_firing_self_check
    ' 2>&1
  )
  echo "$over" | grep -q "FIRED on the clean control" \
    && ok "(9) clean control FIRED under the over-broad config → detected (the E1 pairing discriminates)" \
    || bad "(9) over-broad config NOT detected — clean control missing or silent: $(echo "$over" | tr '\n' '|' | cut -c1-300)"
  echo "$over" | grep -q "OVER-BROAD" \
    && ok "(9) summary refuses the green verdict (OVER-BROAD reported, not «enforcement is live»)" \
    || bad "(9) summary still claimed green under an always-red config (the pre-arm false-green)"
  echo "$over" | grep -q "enforcement is live" \
    && bad "(9) «enforcement is live» printed for an over-broad config (false green)" \
    || ok "(9) no false «enforcement is live» claim"
  rm -rf "$C"
else
  echo "  ── (9) SKIP over-broad negative (cargo not on PATH — covered by degrade arm 7) ──"
fi

# ── sourced-delivery driver for the stub-discriminator arms below ──────────────────────────────────
# Mirrors python-delivery.test.sh's PY_LAYER_UNDER_TEST TDD seam, lifted to cargo (adapter-jig C1):
# source lib.sh + a cargo layer (the REAL 46-cargo.sh by default, or a violating stub) with
# CARGO_LAYER_LIB_ONLY=1 and run deliver_cargo_toolchain against a fixture. The stub arms point this
# at naive/violating layers to PROVE the cell assertions discriminate (RED-provability, spec §3).
run_cargo_delivery() {  # <project_root> <layer_path>
  local _root="$1" _layer="${2:-${CARGO_LAYER_UNDER_TEST:-$LAYER}}"
  (
    export INSTALL_SH_LIB_ONLY=1
    PKG_ROOT="$REPO_ROOT"; PROJECT_ROOT="$_root"; FORCE=""; DRY_RUN=""; SKIPPED=()
    # shellcheck source=/dev/null
    source "$REPO_ROOT/setup.d/lib.sh"
    export CARGO_LAYER_LIB_ONLY=1
    # shellcheck source=/dev/null
    source "$_layer"
    deliver_cargo_toolchain 2>&1
  )
}

# ── (10) cell (iii): consumer-authored deny.toml → REFUSE, ship getff-deny.toml ────────────────────
# @arm:C1:pos delivery-cell-matrix-complete (cargo deny REFUSE cell — was individually untested;
# the W4 MAJOR class lived precisely in an untested REFUSE corner)
echo "  ── (10) REFUSE cell (iii): consumer deny.toml kept, ours shipped as getff-deny.toml ──"
C=$(cargo_fixture)
printf '[bans]\nmultiple-versions = "warn"\n' > "$C/deny.toml"
DENY_BEFORE=$(cat "$C/deny.toml")
out=$( cd "$C" && bash "$INSTALL" cargo < /dev/null 2>&1 ) || true
[ "$(cat "$C/deny.toml")" = "$DENY_BEFORE" ] \
  && ok "(10) consumer deny.toml left byte-identical (cell iii REFUSE — no silent clobber)" \
  || bad "(10) consumer deny.toml was modified — REFUSE cell broken"
cmp -s "$TPL/deny.toml" "$C/getff-deny.toml" \
  && ok "(10) our starter shipped as getff-deny.toml (byte-identical to template)" \
  || bad "(10) getff-deny.toml missing or differs from template"
echo "$out" | grep -q "REFUSE deny.toml" \
  && ok "(10) delivery log announced the deny REFUSE loudly (cell iii)" \
  || bad "(10) no loud REFUSE deny.toml announcement"
rm -rf "$C"

# ── (11) CI REFUSE cell: non-getff file at our namespaced workflow path → REFUSE loudly ───────────
# @arm:C1:pos delivery-cell-matrix-complete (cargo CI REFUSE cell — was individually untested)
echo "  ── (11) CI REFUSE cell: non-getff getff-cargo.yml preserved + loud REFUSE ──"
C=$(cargo_fixture)
mkdir -p "$C/.github/workflows"
printf 'name: consumer-authored cargo wf\n' > "$C/.github/workflows/getff-cargo.yml"
out=$( cd "$C" && bash "$INSTALL" cargo < /dev/null 2>&1 ) || true
grep -qxF 'name: consumer-authored cargo wf' "$C/.github/workflows/getff-cargo.yml" \
  && ok "(11) non-getff getff-cargo.yml NOT clobbered (consumer workflow preserved)" \
  || bad "(11) non-getff getff-cargo.yml was overwritten — STOP-line breach"
echo "$out" | grep -q "REFUSE CI" \
  && ok "(11) printed a loud REFUSE CI with manual wiring instructions" \
  || bad "(11) no loud REFUSE CI on a pre-existing non-getff workflow at our path"
echo "$out" | grep -q "cargo clippy" \
  && ok "(11) REFUSE CI includes the manual clippy-gate command (consumer can self-wire)" \
  || bad "(11) REFUSE CI missing the manual wiring command"
rm -rf "$C"

# ── (12) cell (v): idempotent re-run — delivered config artefacts byte-identical ──────────────────
# @arm:C1:pos delivery-cell-matrix-complete (cargo idempotent re-run cell — was untested; python
# precedent python-delivery.test.sh cell v)
echo "  ── (12) cell (v): re-run idempotency (configs byte-identical; log + rules-lock excluded) ──"
cargo_config_fingerprint() {  # volatile-excluded per 46-cargo.sh delivery-log contract
  find "$1" -type f -not -name '.getff-cargo-install.log' -not -name 'rules-lock.cargo.json' \
    2>/dev/null | LC_ALL=C sort | while IFS= read -r f; do
      printf '%s  %s\n' "$(_sha256 "$f")" "${f#"$1/"}"
    done
}
C=$(cargo_fixture)
( cd "$C" && bash "$INSTALL" cargo < /dev/null ) >/dev/null 2>&1
fp1=$(cargo_config_fingerprint "$C")
( cd "$C" && bash "$INSTALL" cargo < /dev/null ) >/dev/null 2>&1
fp2=$(cargo_config_fingerprint "$C")
{ [ -n "$fp1" ] && [ "$fp1" = "$fp2" ]; } \
  && ok "(12) second run left the delivered config tree byte-identical (cell v idempotent)" \
  || bad "(12) second run changed the config tree: $(diff <(echo "$fp1") <(echo "$fp2") | tr '\n' '|' | cut -c1-300)"
rm -rf "$C"

# ── (13) C1 discriminating negative: a naive copy-only stub layer MUST violate the REFUSE cells ────
# The python-delivery.test.sh:24-26 PY_LAYER_UNDER_TEST copy-only-stub precedent lifted to cargo:
# a green-only cell matrix that never runs against a clobbering stub is REFUSED (spec §3). The stub
# unconditionally cp's every template (no getff-header guard, no existence guard); the REFUSE-cell
# byte-identity assertions of arms (5)/(10)/(11) MUST detect it — proving they discriminate.
# @arm:C1:neg delivery-cell-matrix-complete (copy-only stub clobbers all three REFUSE cells)
echo "  ── (13) copy-only stub violates REFUSE cells (C1 negative — assertions discriminate) ──"
STUBDIR=$(mktemp -d)
cat > "$STUBDIR/stub-46-cargo.sh" <<'STUB_EOF'
# naive copy-only cargo delivery stub — the adapter-jig C1 discriminating negative.
# No getff-header guard, no existence guard: clobbers every REFUSE cell unconditionally.
deliver_cargo_toolchain() {
  local tpl="${CARGO_TEMPLATE_DIR:-$PKG_ROOT/packages/core/templates/cargo}"
  mkdir -p "$PROJECT_ROOT/.getff" "$PROJECT_ROOT/.github/workflows"
  cp "$tpl/clippy.toml" "$PROJECT_ROOT/clippy.toml"
  cp "$tpl/deny.toml" "$PROJECT_ROOT/deny.toml"
  cp "$tpl/Cargo.lints.toml" "$PROJECT_ROOT/.getff/Cargo.lints.toml"
  cp "$tpl/github-actions-ci.yml" "$PROJECT_ROOT/.github/workflows/getff-cargo.yml"
}
STUB_EOF
C=$(cargo_fixture)
printf 'cognitive-complexity-threshold = 30\n' > "$C/clippy.toml"
printf '[bans]\nmultiple-versions = "warn"\n' > "$C/deny.toml"
mkdir -p "$C/.github/workflows"
printf 'name: consumer-authored cargo wf\n' > "$C/.github/workflows/getff-cargo.yml"
run_cargo_delivery "$C" "$STUBDIR/stub-46-cargo.sh" >/dev/null 2>&1
STUB_HITS=0
cmp -s "$TPL/clippy.toml" "$C/clippy.toml" && STUB_HITS=$((STUB_HITS+1))
cmp -s "$TPL/deny.toml" "$C/deny.toml" && STUB_HITS=$((STUB_HITS+1))
cmp -s "$TPL/github-actions-ci.yml" "$C/.github/workflows/getff-cargo.yml" && STUB_HITS=$((STUB_HITS+1))
[ "$STUB_HITS" -eq 3 ] \
  && ok "(13) copy-only stub clobbered clippy.toml + deny.toml + getff-cargo.yml — the (5)/(10)/(11) byte-identity assertions would go RED against it (discriminating, not vacuous)" \
  || bad "(13) stub clobbered only $STUB_HITS/3 REFUSE surfaces — the stub is not a valid discriminator (or a guard leaked into it)"
rm -rf "$C" "$STUBDIR"

# ── (14) C2: consumer manifest (Cargo.toml) byte-identical across install AND --force ──────────────
# Zero prior coverage (recon C2): the lane's read-only-manifest contract (46-cargo.sh:19-23 — NEVER
# auto-edit Cargo.toml; deliver .getff/Cargo.lints.toml instead) was asserted nowhere; a future
# "helpful auto-merge" of [lints.clippy] would have passed every cargo test.
# @arm:C2:pos no-consumer-manifest-mutation (hash-compare across plain install + --force)
echo "  ── (14) C2: Cargo.toml byte-identical after install and --force (manifest never mutated) ──"
C=$(cargo_fixture)
printf '\n[lints.rust]\nunsafe_code = "forbid"\n' >> "$C/Cargo.toml"   # real consumer content incl. a [lints] table
MANIFEST_SHA_BEFORE=$(_sha256 "$C/Cargo.toml")
( cd "$C" && bash "$INSTALL" cargo < /dev/null ) >/dev/null 2>&1
[ "$(_sha256 "$C/Cargo.toml")" = "$MANIFEST_SHA_BEFORE" ] \
  && ok "(14) Cargo.toml byte-identical after plain install (read-only manifest contract)" \
  || bad "(14) Cargo.toml MUTATED by plain install — the lane wrote into the consumer manifest"
( cd "$C" && bash "$INSTALL" cargo --force < /dev/null ) >/dev/null 2>&1
[ "$(_sha256 "$C/Cargo.toml")" = "$MANIFEST_SHA_BEFORE" ] \
  && ok "(14) Cargo.toml byte-identical after --force too (overwrite flag never reaches the manifest)" \
  || bad "(14) Cargo.toml MUTATED under --force"
! grep -q '\[lints\.clippy\]' "$C/Cargo.toml" \
  && ok "(14) [lints.clippy] deny projection NOT merged into Cargo.toml (lands only at .getff/Cargo.lints.toml)" \
  || bad "(14) [lints.clippy] appeared inside the consumer Cargo.toml — forbidden auto-merge"
[ -f "$C/.getff/Cargo.lints.toml" ] \
  && ok "(14) deny projection delivered at the namespaced .getff/Cargo.lints.toml reference" \
  || bad "(14) .getff/Cargo.lints.toml missing — projection not delivered anywhere"
rm -rf "$C"

# ── (15) C2 discriminating negative: a manifest-mutating stub MUST be caught by the hash-compare ───
# The "helpful auto-merge" the W4 design explicitly forbade (46-cargo.sh:19-23): a stub that appends
# the [lints.clippy] deny block into the consumer's Cargo.toml. The before/after hash-compare of
# arm (14) MUST detect it — without this violating stub the arm is green-only → REFUSED (spec §3).
# @arm:C2:neg no-consumer-manifest-mutation (auto-merge stub → hash-compare goes RED)
echo "  ── (15) manifest-mutating stub caught by the hash-compare (C2 negative) ──"
STUBDIR=$(mktemp -d)
cat > "$STUBDIR/stub-mutating-46-cargo.sh" <<'STUB_EOF'
# manifest-mutating cargo delivery stub — the adapter-jig C2 discriminating negative:
# the forbidden "helpful auto-merge" of the deny projection into the consumer's Cargo.toml.
deliver_cargo_toolchain() {
  local tpl="${CARGO_TEMPLATE_DIR:-$PKG_ROOT/packages/core/templates/cargo}"
  mkdir -p "$PROJECT_ROOT/.getff"
  cp "$tpl/Cargo.lints.toml" "$PROJECT_ROOT/.getff/Cargo.lints.toml"
  printf '\n[lints.clippy]\ndisallowed_methods = "deny"\n' >> "$PROJECT_ROOT/Cargo.toml"
}
STUB_EOF
C=$(cargo_fixture)
MANIFEST_SHA_BEFORE=$(_sha256 "$C/Cargo.toml")
run_cargo_delivery "$C" "$STUBDIR/stub-mutating-46-cargo.sh" >/dev/null 2>&1
[ "$(_sha256 "$C/Cargo.toml")" != "$MANIFEST_SHA_BEFORE" ] \
  && ok "(15) mutating stub CHANGED the Cargo.toml hash — arm (14)'s hash-compare discriminates the forbidden auto-merge" \
  || bad "(15) mutating stub left the hash unchanged — the stub is not a valid discriminator"
grep -q '\[lints\.clippy\]' "$C/Cargo.toml" \
  && ok "(15) stub's merged [lints.clippy] block is exactly what arm (14)'s grep assertion catches" \
  || bad "(15) stub did not merge [lints.clippy] — fixture does not reproduce the forbidden mutation"
rm -rf "$C" "$STUBDIR"

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
