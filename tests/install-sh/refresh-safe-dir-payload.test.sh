#!/usr/bin/env bash
# tests/install-sh/refresh-safe-dir-payload.test.sh — #873: refresh_safe must REPLACE a directory
# payload, not nest into it.
#
# Root cause: refresh_safe's tail is `cp -r "$src" "$dst"`. For a DIRECTORY source whose $dst
# already exists as a directory, `cp -r src dst` nests — it creates $dst/$(basename $src) instead
# of replacing $dst's contents. Directory payloads (e.g. scripts/fences-fire-fixtures/) can
# therefore never be refreshed non-destructively into an already-installed consumer.
#
# Paired-negative: arm 4 proves the "no nesting" assertion in arm 1 is a real discriminator by
# reproducing the raw `cp -r` nesting behaviour directly — demonstrating the bug this fix prevents.
#
# Deterministic, no network: pure bash + mktemp scratch dirs. Mirrors tests/install-sh/
# lib-helpers.test.sh's lib-only sourcing pattern.
set -uo pipefail

REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

LIB_SH="$REPO_ROOT/setup.d/lib.sh"
if [ ! -f "$LIB_SH" ]; then
  echo "ERROR: $LIB_SH not found" >&2
  exit 1
fi

# ── Source lib.sh in lib-only mode ───────────────────────────────────────────
PROJECT_ROOT="$REPO_ROOT"
PKG_ROOT="$REPO_ROOT"
FORCE=""
DRY_RUN=""
SKIPPED=()

INSTALL_SH_LIB_ONLY=1
# shellcheck disable=SC1090
source "$LIB_SH"

SCRATCH=$(mktemp -d)
trap 'rm -rf "$SCRATCH"' EXIT

# ── Arm 1 (pos): replace, not merge, not nest ────────────────────────────────
# Ledger L-4 narrowed «replace» from «rm -rf the whole tree» to «remove what the refresh-baseline
# manifest attributes to the framework»: a stale file we can PROVE we delivered still goes, but a
# file we cannot attribute to ourselves is the consumer's and stays. So this arm now runs against
# a real manifest — without one, every destination file is unattributable by construction and the
# removal half would be asserting the pre-L-4 contract (delete what we cannot prove is ours,
# which is exactly issue 1481).
SRC="$SCRATCH/arm1-src"
DST="$SCRATCH/arm1-dst"
mkdir -p "$SRC" "$DST"
echo "new" > "$SRC/a.txt"
echo "old" > "$DST/a.txt"
echo "stale" > "$DST/old.txt"      # framework-delivered, no longer shipped → must go
echo "mine"  > "$DST/consumer.txt" # never delivered by us → must stay

ARM1_ROOT="$SCRATCH"
mkdir -p "$ARM1_ROOT/.ai-factory"
if command -v sha256sum >/dev/null 2>&1; then
  ARM1_OLD_HASH=$(sha256sum "$DST/old.txt" | awk '{print $1}')
else
  ARM1_OLD_HASH=$(shasum -a 256 "$DST/old.txt" | awk '{print $1}')
fi
printf '{ "arm1-dst/old.txt": "%s" }\n' "$ARM1_OLD_HASH" > "$ARM1_ROOT/.ai-factory/refresh-baseline.json"

ARM1_PREV_ROOT="$PROJECT_ROOT"
PROJECT_ROOT="$ARM1_ROOT"
refresh_safe "$SRC" "$DST" >/dev/null
PROJECT_ROOT="$ARM1_PREV_ROOT"

if [ "$(cat "$DST/a.txt" 2>/dev/null)" = "new" ]; then
  ok "arm1: DST/a.txt replaced with new content"
else
  bad "arm1: DST/a.txt NOT replaced (got: $(cat "$DST/a.txt" 2>/dev/null || echo MISSING))"
fi

if [ ! -e "$DST/old.txt" ]; then
  ok "arm1: stale framework-attributed DST/old.txt removed (proves replace, not merge)"
else
  bad "arm1: stale DST/old.txt still present (merge, not replace)"
fi

if [ "$(cat "$DST/consumer.txt" 2>/dev/null)" = "mine" ]; then
  ok "arm1: unattributed DST/consumer.txt kept (replace is manifest-scoped, not blanket)"
else
  bad "arm1: unattributed DST/consumer.txt was deleted — the L-4 ownership scope regressed"
fi

if [ ! -e "$DST/$(basename "$SRC")" ]; then
  ok "arm1: no nested DST/\$(basename SRC) (proves no nesting)"
else
  bad "arm1: nested DST/\$(basename SRC) exists — cp -r nested instead of replacing"
fi

# ── Arm 2 (pos): .override.md guard still wins for dirs ──────────────────────
SRC2="$SCRATCH/arm2-src"
DST2="$SCRATCH/arm2-dst"
mkdir -p "$SRC2" "$DST2"
echo "new" > "$SRC2/a.txt"
echo "stale" > "$DST2/stale.txt"
touch "$SCRATCH/arm2-dst.override.md"

refresh_safe "$SRC2" "$DST2" >/dev/null

if [ -e "$DST2/stale.txt" ] && [ ! -e "$DST2/a.txt" ]; then
  ok "arm2: .override.md guard left DST2 untouched (dir branch does not bypass guard)"
else
  bad "arm2: .override.md guard did NOT protect DST2 (stale.txt present=$([ -e "$DST2/stale.txt" ] && echo yes || echo no), a.txt present=$([ -e "$DST2/a.txt" ] && echo yes || echo no))"
fi

# ── Arm 3 (pos): --dry-run writes nothing ─────────────────────────────────────
SRC3="$SCRATCH/arm3-src"
DST3="$SCRATCH/arm3-dst"
mkdir -p "$SRC3" "$DST3"
echo "new" > "$SRC3/a.txt"
echo "old" > "$DST3/a.txt"

DRY_RUN='--dry-run'
refresh_safe "$SRC3" "$DST3" >/dev/null
DRY_RUN=''

if [ "$(cat "$DST3/a.txt" 2>/dev/null)" = "old" ] && [ ! -e "$DST3/$(basename "$SRC3")" ]; then
  ok "arm3: --dry-run left DST3 untouched"
else
  bad "arm3: --dry-run modified DST3 (got a.txt=$(cat "$DST3/a.txt" 2>/dev/null || echo MISSING))"
fi

# ── Arm 4 (teeth / non-vacuity): raw cp -r DOES nest — proves arm1's assertion
#    is a real discriminator, not a vacuous check ─────────────────────────────
RAWSRC="$SCRATCH/arm4-rawsrc"
RAWDST="$SCRATCH/arm4-rawdst"
mkdir -p "$RAWSRC" "$RAWDST"
echo "payload" > "$RAWSRC/b.txt"

cp -r "$RAWSRC" "$RAWDST"

if [ -e "$RAWDST/$(basename "$RAWSRC")" ]; then
  ok "arm4 (teeth): raw 'cp -r' nests into an existing dir — demonstrates the bug the fix prevents"
else
  bad "arm4 (teeth): raw 'cp -r' did NOT nest — arm1's 'no nesting' check would be vacuous"
fi

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
