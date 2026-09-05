#!/usr/bin/env bash
# tests/install-sh/go-entry-lane.test.sh — go lane REFUSE-cell config selection (ledger A8-1).
#
# The go lane has a two-cell collision matrix for .golangci.yml (setup.d/47-go.sh:87-116):
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
# Arms are BEHAVIOURAL, not structural: each extracts the real `run:` block from the DELIVERED
# workflow and executes it with a golangci-lint stub that reports the --config it was handed.
# Grepping the template for a branch order would pass on a file that never runs.
#
# Arm (3) is the paired negative — it rebuilds the PRE-FIX branch order and asserts the SAME
# harness reports the consumer's config, so a green arm (2) cannot be an artefact of a stub that
# always prints the answer we want.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

setup_lane() {
  PKG_ROOT="$REPO_ROOT"; PROJECT_ROOT=""; FORCE=""; DRY_RUN=""; SKIPPED=()
  export INSTALL_SH_LIB_ONLY=1
  # shellcheck source=/dev/null
  source "$REPO_ROOT/setup.d/lib.sh"
  export GO_LAYER_LIB_ONLY=1
  # shellcheck source=/dev/null
  source "$REPO_ROOT/setup.d/47-go.sh"
}
setup_lane

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

# ── (1) REFUSE cell delivers getff-golangci.yml and leaves the consumer's file byte-identical ──
P=$(mktemp -d "${TMPDIR:-/tmp}/go-entry-refuse.XXXXXX")
init_go_consumer "$P"
printf 'linters:\n  disable-all: true\n  enable:\n    - errcheck\n' > "$P/.golangci.yml"
CONSUMER_SHA_BEFORE=$(shasum -a 256 < "$P/.golangci.yml" | awk '{print $1}')
run_go_delivery "$P" >/dev/null 2>&1
CONSUMER_SHA_AFTER=$(shasum -a 256 < "$P/.golangci.yml" | awk '{print $1}')
if [ -f "$P/getff-golangci.yml" ] && [ "$CONSUMER_SHA_BEFORE" = "$CONSUMER_SHA_AFTER" ]; then
  ok "(1) REFUSE cell: getff-golangci.yml delivered, consumer .golangci.yml untouched"
else
  bad "(1) REFUSE cell: getff-golangci.yml=$( [ -f "$P/getff-golangci.yml" ] && echo yes || echo no ), consumer file changed=$( [ "$CONSUMER_SHA_BEFORE" = "$CONSUMER_SHA_AFTER" ] && echo no || echo YES )"
fi

# ── (2) @A8-1:pos the delivered workflow loads the GETFF config in the REFUSE cell ────────────
if [ -f "$P/.github/workflows/getff-go.yml" ]; then
  SEL=$(selected_config "$P")
  if [ "$SEL" = "CONFIG=getff-golangci.yml" ]; then
    ok "(2) REFUSE cell: delivered getff-go.yml loads getff-golangci.yml (the getff ban is live)"
  else
    bad "(2) REFUSE cell: delivered getff-go.yml loaded '$SEL' — expected CONFIG=getff-golangci.yml"
  fi
else
  bad "(2) REFUSE cell: no getff-go.yml delivered"
fi

# ── (3) @A8-1:neg pre-fix branch order, same harness → the consumer's config wins ─────────────
# Rebuilds the exact chain that shipped before this fix. If this arm ever goes green with
# CONFIG=getff-golangci.yml, the harness is not discriminating and arm (2) proves nothing.
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
  ok "(3) paired negative: the pre-fix order loads the CONSUMER's .golangci.yml (arm 2 discriminates)"
else
  bad "(3) paired negative did not reproduce the defect — got '$SEL_PRE', expected CONFIG=.golangci.yml"
fi
rm -rf "$P"

# ── (4) fresh cell still loads .golangci.yml (the fix must not invert the common case) ────────
Q=$(mktemp -d "${TMPDIR:-/tmp}/go-entry-fresh.XXXXXX")
init_go_consumer "$Q"
run_go_delivery "$Q" >/dev/null 2>&1
if [ ! -f "$Q/getff-golangci.yml" ] && [ -f "$Q/.golangci.yml" ]; then
  SEL_FRESH=$(selected_config "$Q")
  if [ "$SEL_FRESH" = "CONFIG=.golangci.yml" ]; then
    ok "(4) fresh cell: no getff-golangci.yml, delivered getff-go.yml loads .golangci.yml (ours)"
  else
    bad "(4) fresh cell: delivered getff-go.yml loaded '$SEL_FRESH' — expected CONFIG=.golangci.yml"
  fi
else
  bad "(4) fresh cell delivery shape wrong: getff-golangci.yml=$( [ -f "$Q/getff-golangci.yml" ] && echo yes || echo no ) .golangci.yml=$( [ -f "$Q/.golangci.yml" ] && echo yes || echo no )"
fi
rm -rf "$Q"

echo ""
echo "Result: $PASS pass / $FAIL fail"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
