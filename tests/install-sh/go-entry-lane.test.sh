#!/usr/bin/env bash
# tests/install-sh/go-entry-lane.test.sh — go entry lane: TWO scopes share this file (union
# produced by the merge-forward of ledger-1597 R-3 onto staging's A8-1; the two branches each
# created this file independently).
#
# Scope R-3 (this branch): the rules-lock sourceFingerprint must come from the SHARED lib.sh
# _hash256 ladder (one hash ladder, one degradation policy repo-wide), the layer must carry NO
# inline hash-tool ladder outside comments (the R-3 invariant — so the dedupe cannot silently
# regress), the layer must stay inert on the default npm flow, and the firing self-check must
# degrade LOUDLY + rc=0 when go/golangci-lint are absent (the A2-3-class rc=0-on-every-branch
# contract, go side). The go sibling of cargo-entry-lane.test.sh — scoped to R-3 deliberately:
# the go lane is owned for "the hash ladder ONLY" (umbrella scope lock), so the full
# delivery-cell matrix (REFUSE cells, idempotency, stub discriminators) is NOT re-enacted here…
# …except that A8-1 (below) owns that matrix and lives in this same file since #1635.
#
# Scope A8-1 (upstream #1635): the go lane's two-cell collision matrix for .golangci.yml
# (setup.d/47-go.sh:87-116):
#   fresh   — no consumer config → ours is copied to .golangci.yml.
#   REFUSE  — the consumer already has a .golangci.yml (golangci-lint reads exactly ONE), so
#             ours ships alongside as getff-golangci.yml and their file is left untouched.
# The snapshot baselines (tests/install-sh/baselines/go/*.fingerprint) prove WHICH FILES land in
# each cell. Nothing proved which config the DELIVERED WORKFLOW then loads — and in the REFUSE
# cell it loaded the wrong one:
#
#   if [ -f .golangci.yml ];        then … --enable forbidigo --config .golangci.yml       # ← always won
#   elif [ -f getff-golangci.yml ]; then … --enable forbidigo --config getff-golangci.yml  # ← unreachable
#
# In the REFUSE cell BOTH files exist, so the first branch always won: the getff os.Getenv ban
# was never loaded, and `--enable forbidigo` force-enabled forbidigo against the consumer's own
# config — where, with no forbidigo settings of their own, golangci-lint v1.55.2 falls back to
# forbidigo's DEFAULT pattern `^(fmt\.Print(|f|ln)|print|println)$`. Net effect on a REFUSE-cell
# consumer: os.Getenv passes (our rule silently absent) while any fmt.Println reds their CI
# (a rule they never asked for). The fix tests getff-golangci.yml FIRST — its presence is what
# identifies the REFUSE cell, because 47-go.sh writes it in that cell and no other.
#
# Arms (1)-(5) are the R-3 scope: they drive the REAL install.sh in mktemp -d fixtures
# (subprocess, like cargo-entry-lane.test.sh). go/golangci-lint are ABSENT in this runtime (and
# in CI) → every self-check arm exercises its DEGRADE branch, asserted explicitly — a skipped
# check is never silently green (T14).
# Arms (6)-(9) are BEHAVIOURAL, not structural (A8-1): each extracts the real `run:` block from
# the DELIVERED workflow and executes it with a golangci-lint stub that reports the --config it
# was handed. Grepping the template for a branch order would pass on a file that never runs.
# Arm (8) is the paired negative — it rebuilds the PRE-FIX branch order and asserts the SAME
# harness reports the consumer's config, so a green arm (7) cannot be an artefact of a stub that
# always prints the answer we want.
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

echo "▶ Go entry lane (install.sh go) — rules-lock via lib.sh _hash256 · determinism · no inline ladder · npm inert · self-check degrade · REFUSE-cell config selection (A8-1)"
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

# ════════════════════════════════════════════════════════════════════════════════════════════════════
# A8-1 scope (upstream #1635) — REFUSE-cell config selection. In-process delivery (sources lib.sh
# + 47-go.sh directly, GO_LAYER_LIB_ONLY=1) rather than the subprocess arms above: the behaviour
# under test is the DELIVERED WORKFLOW's config choice, not the delivery surface.
# ════════════════════════════════════════════════════════════════════════════════════════════════════

setup_lane() {
  PKG_ROOT="$REPO_ROOT"; PROJECT_ROOT=""; FORCE=""; DRY_RUN=""; SKIPPED=()
  export INSTALL_SH_LIB_ONLY=1
  # shellcheck source=/dev/null
  source "$REPO_ROOT/setup.d/lib.sh"
  export GO_LAYER_LIB_ONLY=1
  # shellcheck source=/dev/null
  source "$REPO_ROOT/setup.d/47-go.sh"
}

run_go_delivery() {
  PROJECT_ROOT="$1"; SKIPPED=(); FORCE=""; DRY_RUN=""
  unset GETFF_TOOLCHAIN_REFRESH
  deliver_go_toolchain
}

# init_go_consumer <dir> — a go module in a git repo whose default branch is main (so
# deliver_getff_workflow substitutes `main` and the delivered file matches the template).
init_go_consumer() {
  local root="$1"
  printf 'module example.com/a8-1-fixture\n\ngo 1.22\n' > "$root/go.mod"
  git -C "$root" init -q -b main
  git -C "$root" config user.email "test@getff.local"
  git -C "$root" config user.name "getff A8-1 test"
  git -C "$root" remote add origin https://github.com/getff-test/consumer.git
  git -C "$root" symbolic-ref refs/remotes/origin/HEAD refs/heads/main
  git -C "$root" add -A >/dev/null 2>&1
  git -C "$root" commit -qm init >/dev/null 2>&1
}

# extract_gate_block <workflow> — the shell body of the `golangci-lint run (getff bans)` step.
# Keyed on the step name and the `run: |` that follows it; stops at the next line indented no
# deeper than the `run:` key. Deliberately not a YAML parser: the block is what CI executes, and
# executing it is the whole point of these arms.
extract_gate_block() {
  awk '
    /- name: golangci-lint run \(getff bans\)/ { seen=1; next }
    seen && /^[[:space:]]*run: \|/ { inblock=1; next }
    inblock {
      if ($0 ~ /^[[:space:]]*$/) { print ""; next }
      match($0, /^[[:space:]]*/)
      if (RLENGTH <= 8) exit
      print substr($0, 11)
    }
  ' "$1"
}

# selected_config <consumer_dir> [block_file] — run the gate block under a golangci-lint stub
# and echo the --config value it was handed (or SKIP when the block took the no-config branch).
selected_config() {
  local dir="$1" block="${2:-}" stub="$1/.stub-bin"
  mkdir -p "$stub"
  cat > "$stub/golangci-lint" <<'STUB'
#!/usr/bin/env bash
prev=""
for a in "$@"; do
  [ "$prev" = "--config" ] && { echo "CONFIG=$a"; exit 0; }
  prev="$a"
done
echo "CONFIG=<none>"
STUB
  chmod +x "$stub/golangci-lint"
  [ -n "$block" ] || { block="$dir/.gate-block.sh"; extract_gate_block "$dir/.github/workflows/getff-go.yml" > "$block"; }
  ( cd "$dir" && PATH="$stub:$PATH" bash "$block" 2>/dev/null | grep -E '^CONFIG=|no getff go config' || true )
}

setup_lane

# ── (6) REFUSE cell delivers getff-golangci.yml and leaves the consumer's file byte-identical ──
P=$(mktemp -d "${TMPDIR:-/tmp}/go-entry-refuse.XXXXXX")
init_go_consumer "$P"
printf 'linters:\n  disable-all: true\n  enable:\n    - errcheck\n' > "$P/.golangci.yml"
CONSUMER_SHA_BEFORE=$(_sha256 "$P/.golangci.yml")   # portable helper (upstream arm used bare shasum — absent on some hosts)
run_go_delivery "$P" >/dev/null 2>&1
CONSUMER_SHA_AFTER=$(_sha256 "$P/.golangci.yml")
if [ -f "$P/getff-golangci.yml" ] && [ "$CONSUMER_SHA_BEFORE" = "$CONSUMER_SHA_AFTER" ]; then
  ok "(6) REFUSE cell: getff-golangci.yml delivered, consumer .golangci.yml untouched"
else
  bad "(6) REFUSE cell: getff-golangci.yml=$( [ -f "$P/getff-golangci.yml" ] && echo yes || echo no ), consumer file changed=$( [ "$CONSUMER_SHA_BEFORE" = "$CONSUMER_SHA_AFTER" ] && echo no || echo YES )"
fi

# ── (7) @A8-1:pos the delivered workflow loads the GETFF config in the REFUSE cell ────────────
if [ -f "$P/.github/workflows/getff-go.yml" ]; then
  SEL=$(selected_config "$P")
  if [ "$SEL" = "CONFIG=getff-golangci.yml" ]; then
    ok "(7) REFUSE cell: delivered getff-go.yml loads getff-golangci.yml (the getff ban is live)"
  else
    bad "(7) REFUSE cell: delivered getff-go.yml loaded '$SEL' — expected CONFIG=getff-golangci.yml"
  fi
else
  bad "(7) REFUSE cell: no getff-go.yml delivered"
fi

# ── (8) @A8-1:neg pre-fix branch order, same harness → the consumer's config wins ─────────────
# Rebuilds the exact chain that shipped before this fix. If this arm ever goes green with
# CONFIG=getff-golangci.yml, the harness is not discriminating and arm (7) proves nothing.
cat > "$P/.gate-block-prefix.sh" <<'PREFIX'
set -euo pipefail
if [ -f .golangci.yml ]; then
  golangci-lint run --enable forbidigo --config .golangci.yml ./...
elif [ -f getff-golangci.yml ]; then
  golangci-lint run --enable forbidigo --config getff-golangci.yml ./...
else
  echo "no getff go config found"
  exit 0
fi
PREFIX
SEL_PRE=$(selected_config "$P" "$P/.gate-block-prefix.sh")
if [ "$SEL_PRE" = "CONFIG=.golangci.yml" ]; then
  ok "(8) paired negative: the pre-fix order loads the CONSUMER's .golangci.yml (arm 7 discriminates)"
else
  bad "(8) paired negative did not reproduce the defect — got '$SEL_PRE', expected CONFIG=.golangci.yml"
fi
rm -rf "$P"

# ── (9) fresh cell still loads .golangci.yml (the fix must not invert the common case) ────────
Q=$(mktemp -d "${TMPDIR:-/tmp}/go-entry-fresh.XXXXXX")
init_go_consumer "$Q"
run_go_delivery "$Q" >/dev/null 2>&1
if [ ! -f "$Q/getff-golangci.yml" ] && [ -f "$Q/.golangci.yml" ]; then
  SEL_FRESH=$(selected_config "$Q")
  if [ "$SEL_FRESH" = "CONFIG=.golangci.yml" ]; then
    ok "(9) fresh cell: no getff-golangci.yml, delivered getff-go.yml loads .golangci.yml (ours)"
  else
    bad "(9) fresh cell: delivered getff-go.yml loaded '$SEL_FRESH' — expected CONFIG=.golangci.yml"
  fi
else
  bad "(9) fresh cell delivery shape wrong: getff-golangci.yml=$( [ -f "$Q/getff-golangci.yml" ] && echo yes || echo no ) .golangci.yml=$( [ -f "$Q/.golangci.yml" ] && echo yes || echo no )"
fi
rm -rf "$Q"

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
