#!/usr/bin/env bash
# tests/install-sh/go-entry-lane.test.sh — R-3 scope for the go lane (adapter-jig J3): the
# rules-lock sourceFingerprint must come from the SHARED lib.sh _hash256 ladder (one hash ladder,
# one degradation policy repo-wide), the layer must carry NO inline hash-tool ladder outside
# comments (the R-3 invariant — so the dedupe cannot silently regress), the layer must stay inert
# on the default npm flow, and the firing self-check must degrade LOUDLY + rc=0 when
# go/golangci-lint are absent (the A2-3-class rc=0-on-every-branch contract, go side).
#
# The go sibling of cargo-entry-lane.test.sh — scoped to R-3 deliberately: the go lane is owned for
# "the hash ladder ONLY" (umbrella scope lock), so the full delivery-cell matrix (REFUSE cells,
# idempotency, stub discriminators) is NOT re-enacted here.
#
# Drives the REAL install.sh in mktemp -d fixtures (subprocess, like cargo-entry-lane.test.sh).
# go/golangci-lint are ABSENT in this runtime (and in CI) → every self-check arm exercises its
# DEGRADE branch, asserted explicitly — a skipped check is never silently green (T14).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL="$REPO_ROOT/install.sh"
LAYER="$REPO_ROOT/setup.d/47-go.sh"
TPL="$REPO_ROOT/packages/core/templates/go"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
_sha256() {  # portable sha256 (linux sha256sum / macOS shasum) — mirrors lib.sh _hash256's rungs
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'
  else shasum -a 256 "$1" | awk '{print $1}'; fi
}
HAS_SHA_TOOL=0
command -v sha256sum >/dev/null 2>&1 || command -v shasum >/dev/null 2>&1 && HAS_SHA_TOOL=1

[ -f "$INSTALL" ] || { echo "FATAL: $INSTALL not found"; exit 1; }

go_fixture() {  # echo a fresh temp dir seeded with a go.mod (a pure Go consumer)
  local d; d=$(mktemp -d)
  printf 'module demo\n\ngo 1.22\n' > "$d/go.mod"
  echo "$d"
}

echo "▶ Go entry lane (install.sh go) — rules-lock via lib.sh _hash256 · determinism · no inline ladder · npm inert · self-check degrade"
echo ""

# ── (1) fresh explicit `install.sh go` on a pure-Go repo → lock fingerprints the DELIVERED config ───
echo "  ── (1) fresh install.sh go: rules-lock.go.json fingerprints the delivered .golangci.yml ──"
G=$(go_fixture)
out=$( cd "$G" && bash "$INSTALL" go < /dev/null 2>&1 ); rc1=$?
[ "$rc1" -eq 0 ] \
  && ok "(1) install.sh go exits 0 (self-check degrades loudly in a toolchain-absent runtime; still rc=0)" \
  || bad "(1) non-zero exit $rc1 on a pure-Go repo: $(echo "$out" | tail -3 | tr '\n' '|')"
LOCK="$G/.ai-factory/synthesizer-output/rules-lock.go.json"
[ -f "$LOCK" ] && ok "(1) rules-lock.go.json written (.ai-factory/synthesizer-output/)" \
  || bad "(1) rules-lock.go.json missing"
cmp -s "$TPL/.golangci.yml" "$G/.golangci.yml" \
  && ok "(1) .golangci.yml delivered (byte-identical to template)" \
  || bad "(1) .golangci.yml missing/differs"
if [ "$HAS_SHA_TOOL" -eq 1 ]; then
  fp1=$(sed -n 's/.*"sourceFingerprint": "sha256:\([0-9a-f]*\)".*/\1/p' "$LOCK" 2>/dev/null)
  delivered_sha=$(_sha256 "$G/.golangci.yml")
  { [ -n "$fp1" ] && [ "$fp1" = "$delivered_sha" ]; } \
    && ok "(1) sourceFingerprint = sha256(delivered .golangci.yml) — lib.sh _hash256 ladder (R-3)" \
    || bad "(1) fingerprint mismatch: got '${fp1:-<none>}', expected $delivered_sha"
else
  echo "  ── SKIP (1d) fingerprint-value assertion (no sha tool on PATH — the degrade is arm (5)'s job) ──"
fi

# ── (2) re-run determinism — the fingerprint is a REPRODUCIBILITY record, same file → same value ────
echo "  ── (2) re-run: fingerprint deterministic (same delivered bytes → same sha256) ──"
if [ "$HAS_SHA_TOOL" -eq 1 ]; then
  ( cd "$G" && bash "$INSTALL" go < /dev/null ) >/dev/null 2>&1
  fp2=$(sed -n 's/.*"sourceFingerprint": "sha256:\([0-9a-f]*\)".*/\1/p' "$LOCK" 2>/dev/null)
  { [ -n "$fp1" ] && [ "$fp1" = "$fp2" ]; } \
    && ok "(2) second run produced the identical sourceFingerprint (deterministic record)" \
    || bad "(2) fingerprint changed across runs: '$fp1' → '${fp2:-<none>}'"
else
  echo "  ── SKIP (2) determinism assertion (no sha tool on PATH) ──"
fi
rm -rf "$G"

# ── (3) the R-3 invariant: NO inline hash ladder outside comments in 47-go.sh ───────────────────────
# The whole point of R-3: 47-go.sh must fingerprint via lib.sh _hash256, never re-grow its own
# sha256sum/shasum/md5/md5sum ladder. Comment-only lines are exempt (they may cite the history);
# any CODE hit means the ladder is back → this arm goes RED.
echo "  ── (3) no inline hash ladder outside comments (the R-3 invariant) ──"
LADDER_HITS=$(grep -nE 'sha256sum|shasum|md5sum|\bmd5\b' "$LAYER" | grep -vE '^[0-9]+:[[:space:]]*#' || true)
if [ -z "$LADDER_HITS" ]; then
  ok "(3) 47-go.sh carries zero hash-tool invocations outside comments — fingerprinting lives in lib.sh _hash256"
else
  bad "(3) inline hash-ladder residue in 47-go.sh (R-3 regression): $LADDER_HITS"
fi

# ── (4) npm flow UNTOUCHED — the default npm install must NOT trigger the go lane ───────────────────
echo "  ── (4) npm flow inert (package.json only, no go.mod) ──"
N=$(mktemp -d)
printf '{"name":"npm-only","version":"0.0.0"}\n' > "$N/package.json"
( cd "$N" && git init -q && git config user.email t@t.co && git config user.name t ) >/dev/null 2>&1
out=$( cd "$N" && bash "$INSTALL" ts-server --force < /dev/null 2>&1 ) || true
{ [ ! -e "$N/.golangci.yml" ] && [ ! -e "$N/getff-golangci.yml" ] && [ ! -e "$N/.ai-factory/synthesizer-output/rules-lock.go.json" ]; } \
  && ok "(4) npm lane produced NO go artefacts (47-go.sh inert on npm — activation guard holds)" \
  || bad "(4) go artefact leaked onto the npm lane (activation guard broken)"
rm -rf "$N"

# ── (5) self-check degrade path (go/golangci-lint absent) — loud, honestly-labelled, rc=0 ───────────
# The go self-check already guards its captures with || _rc=$? (the form A2-3 brought to the cargo
# lane); this arm pins BOTH halves of the contract: the §1.3 load-bearing «insufficient (tool
# absent)» label prints AND the function still returns 0 (a self-check must not abort the install).
echo "  ── (5) self-check degrade (go/golangci-lint absent) — loud «insufficient (tool absent)», rc=0 ──"
G=$(go_fixture)
cp "$TPL/.golangci.yml" "$G/.golangci.yml"
deg_rc=0
deg=$( GO_LAYER_LIB_ONLY=1 PROJECT_ROOT="$G" PATH="/usr/bin:/bin" bash -c '
  source "'"$LAYER"'"
  _go_firing_self_check
' 2>&1 ) || deg_rc=$?
echo "$deg" | grep -q "go or golangci-lint not on PATH" \
  && ok "(5) stripped-PATH self-check prints the loud tool-absent degrade" \
  || bad "(5) degrade arm did not fire on a stripped PATH"
echo "$deg" | grep -q "insufficient (tool absent)" \
  && ok "(5) the §1.3 load-bearing label «insufficient (tool absent)» is printed (never silently green)" \
  || bad "(5) §1.3 label missing from the degrade output"
echo "$deg" | grep -q "a skipped check is NOT green" \
  && ok "(5) degrade summary refuses to claim green (honesty line present)" \
  || bad "(5) degrade summary missing the not-green honesty line"
[ "$deg_rc" -eq 0 ] \
  && ok "(5) degraded self-check returned rc=0 (rc=0-on-every-branch contract — A2-3 class, go side)" \
  || bad "(5) degraded self-check returned rc=$deg_rc — it would abort install.sh under set -e"
[ ! -e "$G/selfcheck" ] && [ ! -e "$G/target" ] \
  && ok "(5) degrade run wrote nothing under the consumer tree (temp-dir-only STOP line holds)" \
  || bad "(5) degrade run leaked self-check residue into the consumer tree"
rm -rf "$G"

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
