#!/usr/bin/env bash
# Consumer-matrix GETFF-DIST CELL: `npx getff init` from the assembled `getff` tarball · Node 22
# (npm-publish-getff-init U10, S2). THIS CELL IS THE U10 GATE.
#
# The kickoff's own acceptance (2026-07-23 stub, kept verbatim in the full kickoff §3 S3):
# «`npx getff init` → the first planted violation FAILS». «Published → installs cleanly» is not the
# assertion (T-NPI-A); a tarball that installs but whose install.sh cannot find one of its 107
# PKG_ROOT reads is the failure this cell exists to catch.
#
# The cell's consumer path:
#   (1) `scripts/build-getff-dist.sh --check` — the committed MANIFEST.sha256 equals a fresh
#       assembly of the repo root, and package.json `files` spells every payload root.
#   (2) `npm pack` packages/getff (prepack re-runs the check + assembly) → tarball; record count.
#   (3) `npm i <tarball>` into a fresh fixture (no registry needed — install by path).
#   (4) the bin: `getff --version` = the package version; `getff frobnicate` → exit 2 + usage;
#       every MANIFEST path npm can ship exists in the installed package (npm ALWAYS drops
#       node_modules/ trees, lock files and nested .gitignore files — those manifest lines are
#       the documented exception; install.sh reads none of them).
#   (5) THE GATE: `getff init -y ts-server` in the fixture → exit 0, then a planted
#       `OrderSchema.parse(req.body)` under src/routes/ → `npx eslint` exits non-zero WITH the R2
#       message (the rule fired; a crash would also be non-zero — the message discriminates); and
#       the false-positive arm: a static-literal `.parse` outside the boundary → eslint rc=0.
#   (6) OPT-IN paired-RED arms (`GETFF_DIST_CELL_RED_ARMS=1`): for each payload root, pack with
#       that `files` entry removed and show step (5) fails — the evidence table lives in the
#       PR body / freeze record, not in CI (each arm re-installs a consumer, ~7 min apiece;
#       `GETFF_DIST_CELL_RED_ONLY=1` + `GETFF_DIST_CELL_RED_ENTRIES="<entry>"` runs one arm alone).
#
# Runs on ubuntu (CI, merge-blocking via ci-success needs:) and macOS (`make consumer-matrix-getff-dist`).
set -euo pipefail

FRAMEWORK_ROOT="${FRAMEWORK_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/consumer-matrix-getff-dist.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
export npm_config_cache="${npm_config_cache:-/tmp/npm-cache-beta}"

fail() { echo ""; echo "✗ FAIL: $*" >&2; exit 1; }
step() { echo ""; echo "── $*"; }

PKG_DIR="$FRAMEWORK_ROOT/packages/getff"
PKG_VERSION="$(node -e "console.log(require('$PKG_DIR/package.json').version)")"

# pack_and_install <pkgdir> <fixture> [--ignore-scripts] → sets TARBALL, INSTALLED
pack_and_install() {
  local pkgdir="$1" fixture="$2" flag="${3:-}" packed
  # shellcheck disable=SC2086  # $flag is an optional single npm flag, empty by default
  packed=$( cd "$pkgdir" && npm pack $flag 2>"$WORK/pack.err" | tail -1 ) || fail "npm pack failed: $(cat "$WORK/pack.err")"
  TARBALL="$WORK/$(basename "$fixture").tgz"
  mv "$pkgdir/$packed" "$TARBALL"
  mkdir -p "$fixture"
  ( cd "$fixture" && git init -q && git config user.email ci@example.com && git config user.name CI \
    && npm init -y >/dev/null 2>&1 && npm install "$TARBALL" >"$WORK/install-$(basename "$fixture").log" 2>&1 ) \
    || { tail -20 "$WORK/install-$(basename "$fixture").log"; fail "npm install of tarball failed"; }
  INSTALLED="$fixture/node_modules/getff"
  test -d "$INSTALLED" || fail "installed package dir not found at $INSTALLED"
}

# init_and_plant <fixture> → rc of the whole consumer path (0 = rule fired as designed)
init_and_plant() {
  local fixture="$1" rc
  # stdin from /dev/null: `setup` asks «Install aif-handoff bridge? [y/N]» when a coordinator is
  # reachable (even on the -y path) and would block forever on an inherited open stdin — measured
  # on the first local run of this cell (hung at that prompt with a live aif on localhost:3009).
  # CI has no coordinator, but the redirect keeps the cell deterministic everywhere.
  ( cd "$fixture" && ./node_modules/.bin/getff init -y ts-server </dev/null >"$WORK/init-$(basename "$fixture").log" 2>&1 ) \
    || { tail -30 "$WORK/init-$(basename "$fixture").log"; return 10; }
  ( cd "$fixture" && npm install zod@3.23.8 >>"$WORK/init-$(basename "$fixture").log" 2>&1 ) || return 11
  mkdir -p "$fixture/src/routes"
  cat > "$fixture/src/routes/order.ts" <<'TS'
import { z } from 'zod';
const OrderSchema = z.object({ id: z.string() });
export const handler = (req: { body: unknown }) => OrderSchema.parse(req.body);
TS
  set +e
  ( cd "$fixture" && npx eslint src/routes/order.ts ) >"$WORK/viol-$(basename "$fixture").log" 2>&1
  rc=$?
  set -e
  [ "$rc" -ne 0 ] || return 12
  grep -q "no-unsafe-zod-parse" "$WORK/viol-$(basename "$fixture").log" || return 13
  return 0
}

step "(1) drift gate — committed MANIFEST.sha256 == fresh assembly; \`files\` covers every payload root"
bash "$FRAMEWORK_ROOT/scripts/build-getff-dist.sh" --check || fail "(1) build-getff-dist.sh --check is RED — re-run scripts/build-getff-dist.sh and commit MANIFEST.sha256"

# GETFF_DIST_CELL_RED_ONLY=1 skips the main consumer path (steps 2-5) so one arm fits a bounded
# runner slot: every arm re-installs a consumer (~7 min of dev-deps) and ten of them serially do
# not fit anywhere. Run the arms as parallel single-entry invocations with GETFF_DIST_CELL_RED_ENTRIES.
if [ "${GETFF_DIST_CELL_RED_ONLY:-}" = "1" ]; then
  GETFF_DIST_CELL_RED_ARMS=1
else
step "(2)+(3) npm pack packages/getff → tarball → npm i <tarball> into a fresh fixture"
FIXTURE="$WORK/fixture"
pack_and_install "$PKG_DIR" "$FIXTURE"
( cd "$PKG_DIR" && npm pack --dry-run --ignore-scripts 2>&1 ) > "$WORK/pack-dryrun.log" || true
FILE_COUNT=$(grep -oE 'total files: [0-9]+' "$WORK/pack-dryrun.log" | grep -oE '[0-9]+$' || true)
echo "  tarball: $TARBALL"
grep -E 'npm notice (package size|unpacked size|total files)' "$WORK/pack-dryrun.log" || true
echo "  installed to: $INSTALLED"

step "(4) the bin + manifest coverage"
BIN="$FIXTURE/node_modules/.bin/getff"
test -x "$BIN" || fail "(4) node_modules/.bin/getff not linked — bin entry not wired"
V="$(cd "$FIXTURE" && "$BIN" --version)"
[ "$V" = "$PKG_VERSION" ] || fail "(4) getff --version printed '$V', package.json says '$PKG_VERSION'"
echo "  ✓ getff --version → $V"
set +e
( cd "$FIXTURE" && "$BIN" frobnicate ) >"$WORK/unknown.log" 2>&1
U_RC=$?
set -e
[ "$U_RC" -eq 2 ] || fail "(4) getff frobnicate exited $U_RC, expected 2"
grep -q "Usage:" "$WORK/unknown.log" || fail "(4) unknown command did not print usage"
echo "  ✓ getff frobnicate → exit 2 + usage"
for must in install.sh setup setup.d/lib.sh packages/core/package.json packages/core/install/synth-and-wire.bundle.mjs .claude/hooks templates/ts-server scripts/create-worktree.sh MANIFEST.sha256; do
  test -e "$INSTALLED/$must" || fail "(4) '$must' missing from the installed package — a payload root did not ship"
done
MISSING=0; SHIPPABLE=0
while IFS= read -r line; do
  path="${line#*  }"
  # npm-packlist ALWAYS drops these, whatever `files` says (measured 2026-09-05 on the first
  # run of this cell: 6 fixture .gitignore files under packages/core/ were the only misses):
  # node_modules/ trees, lock files, and every nested .gitignore. None is read by install.sh.
  case "$path" in
    */node_modules/*|*/package-lock.json|*/.gitignore|.gitignore) continue ;;
  esac
  SHIPPABLE=$((SHIPPABLE + 1))
  if [ ! -f "$INSTALLED/$path" ]; then
    MISSING=$((MISSING + 1))
    [ "$MISSING" -le 20 ] && echo "  ✗ missing: $path"
  fi
done < "$INSTALLED/MANIFEST.sha256"
[ "$MISSING" -eq 0 ] || fail "(4) $MISSING of $SHIPPABLE manifest files did not arrive in the installed package (npm dropped or \`files\` missed them)"
echo "  ✓ manifest coverage: $SHIPPABLE/$SHIPPABLE shippable manifest files present (node_modules/ trees, lock files and nested .gitignore excluded by npm, by design)"

step "(5) THE U10 GATE — getff init -y ts-server, then the first planted violation must FAIL"
set +e
init_and_plant "$FIXTURE"
G_RC=$?
set -e
case "$G_RC" in
  0) ;;
  10) fail "(5) getff init exited non-zero — see the init log above" ;;
  11) fail "(5) npm install zod failed in the fixture" ;;
  12) fail "(5) eslint rc=0 over a planted OrderSchema.parse(req.body) — the rule did NOT fire" ;;
  13) fail "(5) eslint failed but not with the R2 message (crash, not enforcement?): $(tail -8 "$WORK/viol-fixture.log")" ;;
  *) fail "(5) unexpected rc=$G_RC" ;;
esac
echo "  ✓ eslint over src/routes/order.ts → non-zero with 'no-unsafe-zod-parse':"
grep -E "no-unsafe-zod-parse|error" "$WORK/viol-fixture.log" | head -3 | sed 's/^/      /'
# false-positive arm: the rule's own VALID shape outside the boundary must NOT fire.
cat > "$FIXTURE/src/config.ts" <<'TS'
import { z } from 'zod';
const ConfigSchema = z.object({ port: z.number() });
export const config = ConfigSchema.parse({ port: 3000 } as const);
TS
set +e
( cd "$FIXTURE" && npx eslint src/config.ts ) >"$WORK/fp.log" 2>&1
FP_RC=$?
set -e
grep -q "no-unsafe-zod-parse" "$WORK/fp.log" && fail "(5) R2 fired on a static-literal parse outside the boundary (cries-wolf arm): $(tail -6 "$WORK/fp.log")"
echo "  ✓ false-positive arm: no R2 message on src/config.ts (eslint rc=$FP_RC)"

fi  # GETFF_DIST_CELL_RED_ONLY

if [ "${GETFF_DIST_CELL_RED_ARMS:-}" = "1" ]; then
  step "(6) paired-RED arms — pack with one \`files\` entry removed, expect the consumer path to FAIL"
  printf '  %-20s %-8s %s\n' "files entry" "arm" "evidence"
  # shellcheck disable=SC2086  # deliberate word-split list; override with GETFF_DIST_CELL_RED_ENTRIES
  for entry in ${GETFF_DIST_CELL_RED_ENTRIES:-install.sh setup setup.d/ agents/ skills/ templates/ .claude/ .prettierrc.json packages/ scripts/}; do
    ARM="$WORK/arm-$(echo "$entry" | tr -c 'A-Za-z0-9' '_')"
    rm -rf "$ARM"; mkdir -p "$ARM/pkg"
    ( cd "$PKG_DIR" && tar -cf - --exclude='*.tgz' . ) | ( cd "$ARM/pkg" && tar -xf - )
    node -e '
      const fs = require("fs"); const p = process.argv[1] + "/package.json";
      const j = JSON.parse(fs.readFileSync(p)); j.files = j.files.filter((f) => f !== process.argv[2]);
      fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");' "$ARM/pkg" "$entry"
    set +e
    pack_and_install "$ARM/pkg" "$ARM/fixture" --ignore-scripts >/dev/null 2>&1 && init_and_plant "$ARM/fixture"
    A_RC=$?
    set -e
    if [ "$A_RC" -eq 0 ]; then
      printf '  %-20s %-8s %s\n' "$entry" "GREEN" "UNVALIDATED-by-this-cell (init + rule still pass without it)"
    else
      printf '  %-20s %-8s %s\n' "$entry" "RED" "rc=$A_RC — $(grep -m1 -E 'No such file|not found|missing|cannot|error' "$WORK/init-fixture.log" "$WORK/init-$(basename "$ARM/fixture").log" 2>/dev/null | tail -1 | cut -c1-110)"
    fi
  done
fi

echo ""
if [ "${GETFF_DIST_CELL_RED_ONLY:-}" = "1" ]; then
  echo "✅ consumer-matrix getff-dist cell: RED-ARMS-ONLY run finished (main consumer path skipped by request)"
else
  echo "✅ consumer-matrix getff-dist cell: GREEN (${FILE_COUNT:-?} files in tarball, version $PKG_VERSION)"
  echo "   getff init -y ts-server from the installed tarball → the planted R2 violation FAILED under eslint."
fi
