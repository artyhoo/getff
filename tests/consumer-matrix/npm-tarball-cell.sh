#!/usr/bin/env bash
# Consumer-matrix NPM-TARBALL CELL: npm install <tarball> · Node 22 (beta-delivery-ux R1, A6).
#
# THIS CELL IS THE `files` ALLOWLIST VALIDATION MECHANISM.
# Per kickoff §3: "an allowlist *derived* is not an allowlist *validated*" (T2 counter).
# The binding input s6-u10-handoff.md §2 hands a recommended allowlist marked «VALIDATE before
# trusting» — this cell is what validates it. Every `files` entry must carry paired RED→GREEN
# evidence from this cell (kickoff §3 item 4): prove the cell FAILS without the entry and PASSES
# with it. An entry with no failing-without-it evidence is an unvalidated guess (T2/T14).
#
# T-BDU-R1-A counter: `npm pack` succeeding is NOT a gate — it succeeds on a 711-file bloated
# tarball AND on one whose `files` silently drops a by-path asset. Only installing the tarball
# into a fixture and running the real consumer path is.
#
# The cell's consumer path:
#   1. `npm pack` packages/core → a tarball (record file count).
#   2. `npm i <tarball>` into a fresh fixture (no registry needed — install by path).
#   3. Assert the package `main` (manifest JSON) loads and contains rules.
#   4. Assert key by-path assets exist in the installed package (install bundle, templates,
#      skills, eslint-rules, manifest schema).
#   5. Assert the install wiring (install/synth-and-wire.bundle.mjs) arrived INTACT — syntax,
#      entry guard, tail export. NOT the install flow itself: that runs through
#      setup.d/99-finalize.sh and is exercised end-to-end by pnpm-monorepo-cell.sh.
#   6. Assert the shipped rule DEFINITIONS arrived and are non-empty (manifest rule entries +
#      eslint-rules/ module files). This cell asserts ARRIVAL, not FIRING — see the scope note
#      below.
#
# SCOPE — what this cell does NOT assert (T14: state the classes you do not exercise).
# «At least one rule actually FIRING» (binding input §3 item 2) is NOT exercised here: firing a
# rule needs eslint + a TS-aware config loader inside the fixture, which a tarball install does
# not carry (eslint is a devDependency — the same runtime-dep gap step (7b) records for 3 bins).
# That assertion is carried by the SIBLING cell on the file-copy channel —
# tests/consumer-matrix/pnpm-monorepo-cell.sh step (d-1) plants an OrderSchema.parse(req.body)
# violation and asserts `eslint rc=1` with the R2 message. Both cells are merge-blocking via
# ci-success needs:, and both are declared in the R1 kickoff's host-verify contract, so the pair
# covers arrival (here) + firing (there). Rule modules are plain ESLint rules whose behaviour is
# delivery-channel-independent, so the residual class — «a rule that works file-copied and breaks
# tarball-installed» — is not reachable by any assert this cell could add short of shipping eslint
# as a runtime dep (ruled out at R1 entry, see docs/meta-factory/getff-name-architecture-freeze.md).
#
# Runs on ubuntu (CI, merge-blocking) and macOS (`make consumer-matrix`, local/nightly).
set -euo pipefail

FRAMEWORK_ROOT="${FRAMEWORK_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/consumer-matrix-tarball.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
FIXTURE="$WORK/fixture"
TARBALL_DIR="$WORK/tarballs"

# Container gotcha (kickoff §1 + memory): /home/node/.npm/_cacache/ is root-owned in the aif
# container, so npm commands need a user-owned cache dir. Also: absolute paths only — a cd in
# one Bash call leaks into the next in some container shells.
export npm_config_cache="${npm_config_cache:-/tmp/npm-cache-beta}"

fail() { echo ""; echo "✗ FAIL: $*" >&2; exit 1; }
step() { echo ""; echo "── $*"; }

PKG_DIR="$FRAMEWORK_ROOT/packages/core"
PKG_NAME="$(node -e "console.log(require('$PKG_DIR/package.json').name)")"
PKG_VERSION="$(node -e "console.log(require('$PKG_DIR/package.json').version)")"
# npm pack naming for scoped packages: @scope/name → scope-name-version.tgz
# (drops @, replaces / with -)
TARBALL_NAME="$(node -e "console.log(require('$PKG_DIR/package.json').name.replace(/^@/, '').replace(/\//g, '-') + '-' + require('$PKG_DIR/package.json').version + '.tgz')")"

step "(1) npm pack packages/core → tarball"
mkdir -p "$TARBALL_DIR"
# Pack from the package dir (npm pack writes the tarball to CWD); capture the printed filename.
PACKED_FILE=$( cd "$PKG_DIR" && npm pack 2>"$WORK/pack.err" ) || fail "npm pack failed: $(cat "$WORK/pack.err")"
mv "$PKG_DIR/$PACKED_FILE" "$TARBALL_DIR/"
TARBALL="$TARBALL_DIR/$PACKED_FILE"
test -f "$TARBALL" || fail "tarball not produced at $TARBALL"

# Re-run dry-run for the file-count summary (pack output format varies; dry-run is parseable).
( cd "$PKG_DIR" && npm pack --dry-run 2>&1 ) > "$WORK/pack-dryrun.log" || true
FILE_COUNT=$(grep -oE 'total files: [0-9]+' "$WORK/pack-dryrun.log" | grep -oE '[0-9]+$' || true)
echo "  tarball: $TARBALL"
echo "  files in tarball: ${FILE_COUNT:-<unparsed>}"
grep -E 'npm notice (filename|package size|unpacked size|total files|shasum)' "$WORK/pack-dryrun.log" || true

step "(2) npm i <tarball> into a fresh fixture (no registry needed)"
mkdir -p "$FIXTURE"
( cd "$FIXTURE" && npm init -y >"$WORK/npm-init.log" 2>&1 )
( cd "$FIXTURE" && npm install "$TARBALL" >"$WORK/install.log" 2>&1 ) || {
  tail -20 "$WORK/install.log"
  fail "npm install of tarball failed"
}
INSTALLED="$FIXTURE/node_modules/$PKG_NAME"
test -d "$INSTALLED" || fail "installed package dir not found at $INSTALLED"
echo "  installed to: $INSTALLED"

step "(3) assert the package main (manifest JSON) loads and contains rules"
MANIFEST=$(node -e "const m = require('$INSTALLED/manifest/rules-manifest.json'); const keys = Object.keys(m); if (keys.length === 0) process.exit(1); console.log(keys.length + ' rules: ' + keys.slice(0,5).join(', ') + (keys.length > 5 ? '...' : ''))") \
  || fail "(3) manifest JSON not loadable or empty — the package main is broken"
echo "  ✓ manifest: $MANIFEST"

step "(4) assert key by-path assets exist in the installed package (binding input §2 blind spot)"
# These are by-path assets that an import-closure allowlist MISSES (s6-u10-handoff.md §2 CAVEAT).
# Each must be present in the installed package — if a `files` entry is missing, the asset is absent.
for asset in \
  "install/synth-and-wire.bundle.mjs" \
  "manifest/rules-manifest.json" \
  "manifest/rules-manifest.schema.json" \
  "eslint-rules/index.ts" \
  "LICENSE" \
  "README.md" \
  "templates/" \
  "skills/" \
; do
  if [[ "$asset" == */ ]]; then
    # Directory check
    test -d "$INSTALLED/$asset" || fail "(4) directory '$asset' missing from installed package — by-path asset not delivered"
    echo "  ✓ dir  $asset ($(find "$INSTALLED/$asset" -type f | wc -l | tr -d ' ') files)"
  else
    test -f "$INSTALLED/$asset" || fail "(4) file '$asset' missing from installed package — by-path asset not delivered"
    echo "  ✓ file $asset"
  fi
done

step "(4b) assert bin targets exist (package.json bin: entries must resolve in installed package)"
# Every bin target file must arrive in the tarball — if a code dir is missing from files,
# the bin target it points at is absent and the installed bin would fail.
node -e "
const pkg = require('$INSTALLED/package.json');
const bins = pkg.bin || {};
const fs = require('fs');
let ok = 0;
for (const [name, target] of Object.entries(bins)) {
  const path = '$INSTALLED/' + target.replace(/^\.\//, '');
  if (!fs.existsSync(path)) process.exit(1);
  ok++;
}
console.log('  ✓ ' + ok + ' bin target(s) all present in installed package');
" || fail "(4b) one or more bin targets missing from installed package — bin: entries point at files not delivered"

step "(4c) assert exports targets exist (package.json exports: entries must resolve)"
node -e "
const pkg = require('$INSTALLED/package.json');
const exp = pkg.exports || {};
const fs = require('fs');
let ok = 0;
for (const [key, target] of Object.entries(exp)) {
  const path = '$INSTALLED/' + target.replace(/^\.\//, '');
  if (!fs.existsSync(path)) process.exit(1);
  ok++;
}
console.log('  ✓ ' + ok + ' exports target(s) all present in installed package');
" || fail "(4c) one or more exports targets missing — exports: entries point at files not delivered"

step "(5) assert the shipped install-wiring bundle is INTACT (syntax + entry guard + tail)"
# What this step is NOT: it is not the install flow. The real install flow is exercised by the
# sibling cell — setup.d/99-finalize.sh:25 invokes this same bundle during install.sh, and
# tests/consumer-matrix/pnpm-monorepo-cell.sh runs that end to end.
#
# What it IS: proof the bundle arrived WHOLE in the tarball. Three asserts, because the obvious
# ones do not discriminate (measured 2026-08-10):
#   - `readFileSync().length > 100` (the previous form) passes on ANY file over 100 bytes — a
#     truncated or corrupted bundle shipped green. #contract-that-cannot-fail.
#   - `await import()` is NOT usable here: the bundle has a module-level side effect that opens
#     install/research-plan.schema.json relative to cwd, so importing it throws even though its
#     `process.argv[1]` self-guard correctly suppresses main(). Verified, not assumed.
#   - `node --check` alone is necessary but not sufficient: a 200-byte head of the bundle still
#     parses (it is a shebang + a couple of complete statements). Measured: 200-byte prefix
#     PASSES --check, 50 KB prefix FAILS, intact PASSES.
# So: syntax integrity (--check) + the entry guard + the closing export together fail on every
# truncation point the size check missed.
BUNDLE="$INSTALLED/install/synth-and-wire.bundle.mjs"
node --check "$BUNDLE" 2>"$WORK/bundle-check.err" \
  || fail "(5) install bundle is not a syntactically valid ES module: $(head -3 "$WORK/bundle-check.err")"
grep -q "synth-and-wire.bundle.mjs" "$BUNDLE" \
  || fail "(5) install bundle is missing its process.argv[1] entry guard — the executable entry point did not arrive"
grep -q "mergeLiveRules" "$BUNDLE" \
  || fail "(5) install bundle is missing its mergeLiveRules export — the bundle tail is truncated"
echo "  ✓ synth-and-wire.bundle.mjs intact: node --check OK, entry guard + tail export present ($(wc -c < "$BUNDLE" | tr -d ' ') bytes)"

step "(6) assert the shipped rule DEFINITIONS arrived (arrival, NOT firing — see scope note above)"
# The binding input §3 item 2: "the matrix cell is the only honest check that they ARRIVED."
# Arrival is what this step asserts: the manifest carries rule definitions and eslint-rules/
# contains real rule modules. FIRING is asserted by pnpm-monorepo-cell.sh step (d-1) on the
# file-copy channel — do NOT read a green (6) as evidence that a rule executes.
RULE_MODULE=$(node -e "
const m = require('$INSTALLED/manifest/rules-manifest.json');
const r1 = m.R1 || Object.values(m)[0];
if (!r1) process.exit(1);
console.log(JSON.stringify(r1).slice(0, 120));
") || fail "(6) manifest has no loadable rule definitions"
echo "  ✓ R1 from manifest: $RULE_MODULE"
# Verify the eslint-rules directory has actual rule files
RULE_FILE_COUNT=$(find "$INSTALLED/eslint-rules" -name '*.ts' -o -name '*.mjs' -o -name '*.js' 2>/dev/null | wc -l | tr -d ' ')
[ "$RULE_FILE_COUNT" -gt 0 ] || fail "(6) eslint-rules directory has no rule files — rules did not arrive"
echo "  ✓ eslint-rules/ contains $RULE_FILE_COUNT rule files"

step "(7) F-C′ bin runnability — execute ≥1 bin end-to-end from the installed tarball"
# Spec §11 fork F-C′ binds the bin-runnability decision inside R1 against THIS cell.
# All 6 bin targets are .ts files with shebang `#!/usr/bin/env -S npx tsx`. Under plain
# `node` they do not run. Option (a) — promote tsx to runtime dep — is on trial here.
# `npm i <tarball>` should have installed tsx into the fixture's node_modules, so
# `npx tsx` (invoked by the shebang) resolves locally.
BIN_PATH="$FIXTURE/node_modules/.bin/rules-as-tests-detect"
test -x "$BIN_PATH" || fail "(7) bin target rules-as-tests-detect not linked into node_modules/.bin — bin entry not wired"
echo "  ✓ bin symlink: $BIN_PATH"
# (7a) THE F-C′ DISCRIMINATOR — assert tsx ARRIVED as a declared runtime dependency.
# Without this assert step (7) cannot fail for the fork it exists to decide: the shebang is
# `#!/usr/bin/env -S npx tsx`, and when tsx is absent `npx` SILENTLY INSTALLS IT FROM THE
# NETWORK — measured 2026-08-10 with tsx demoted back to devDependencies: tsx absent from the
# fixture, bin still rc=0, stderr `npm warn exec The following package was not found and will
# be installed: tsx@4.23.12` (an UNPINNED fetch, ≠ the declared ^4.22.4). So "the bin ran" is
# true under BOTH F-C′ options and decides nothing — `#contract-that-cannot-fail`
# (.claude/rules/destination-environment-verification.md §4). Presence in node_modules is the
# assert that actually discriminates: it is what makes the bin work OFFLINE and at the pinned
# range, which is the concrete cost that decided F-C′ for option (a).
test -d "$FIXTURE/node_modules/tsx" \
  || fail "(7a) tsx NOT installed into the fixture — it is not a declared runtime dependency of the package. The bin may still 'work' via npx's silent unpinned network install; that is not a shipped guarantee (F-C′ option (a) not in effect)."
TSX_VER=$(node -e "console.log(require('$FIXTURE/node_modules/tsx/package.json').version)")
echo "  ✓ tsx present in fixture as a runtime dep: $TSX_VER (offline-capable, pinned range)"
# Run --help (short-circuits before detectStack() but still loads the import chain —
# proves tsx loader works on the installed .ts code).
HELP_OUT=$(cd "$FIXTURE" && "$BIN_PATH" --help 2>"$WORK/bin-help.err") || {
  cat "$WORK/bin-help.err"
  fail "(7) bin execution failed — F-C′ option (a) tsx-dep did not produce a runnable bin from the installed tarball"
}
case "$HELP_OUT" in
  *"Usage: rules-as-tests-detect"*) ;;
  *) fail "(7) bin ran but help output unexpected: $HELP_OUT" ;;
esac
echo "  ✓ bin output: $(echo "$HELP_OUT" | head -1)"
# Run a real detect against the empty fixture (no project files → still produces valid JSON).
DETECT_OUT=$(cd "$FIXTURE" && "$BIN_PATH" "$FIXTURE" 2>"$WORK/bin-detect.err") || {
  cat "$WORK/bin-detect.err"
  fail "(7) detect run failed against fixture — bin not runnable end-to-end"
}
echo "$DETECT_OUT" | head -1 | grep -q '{' || fail "(7) detect did not emit JSON — bin output malformed: $DETECT_OUT"
echo "  ✓ detect emitted JSON: $(echo "$DETECT_OUT" | head -1 | cut -c1-80)"

step "(7b) bins with self-contained deps — import chains resolve end-to-end"
# Loading --help on each bin still requires tsx to resolve every top-level `import` in the
# .ts file (and its transitive imports). If a `files` entry is missing, the bin exits
# non-zero with a module-not-found error — the paired-RED evidence for the code dirs.
#
# Scope: detector + research + verify-provenance. The other 3 bins (synth, validate,
# install) transitively import validator/gate-*.ts which `import 'eslint'` — a
# devDependency not present in a tarball install. Promoting eslint+typescript-eslint+
# ts-morph to runtime deps for a 0.1.0 beta was ruled out as disproportionate scope
# expansion; instead, the runtime-dep gap for those 3 bins is recorded in the §2
# name-architecture freeze record as a deferred U10 follow-up. This cell validates
# the bins whose consumer-path is reachable with the package's declared `dependencies`.
RUNNABLE_BINS="rules-as-tests-detect rules-as-tests-research rules-as-tests-verify-provenance"
for bin_name in $RUNNABLE_BINS; do
  bin_link="$FIXTURE/node_modules/.bin/$bin_name"
  test -x "$bin_link" || fail "(7b) $bin_name not linked in node_modules/.bin"
  # Disable set -e around this command — non-zero exit is the very thing we are testing.
  set +e
  out=$(cd "$FIXTURE" && "$bin_link" --help 2>"$WORK/bin-${bin_name}.err")
  rc=$?
  set -e
  # RED condition: stderr contains ERR_MODULE_NOT_FOUND (the .ts chain broke).
  # NB: verify-provenance has no --help flag — it treats `--help` as bundleDir and
  # exits 1 with "::error::Cannot verify provenance" (chain loaded; not a module error).
  if grep -q "ERR_MODULE_NOT_FOUND" "$WORK/bin-${bin_name}.err" 2>/dev/null; then
    echo "  ✗ $bin_name --help → exit $rc (module not found)"
    cat "$WORK/bin-${bin_name}.err"
    fail "(7b) $bin_name import chain failed to load — a transitive .ts file is missing from the installed package (RED for the code dir that owns it)"
  fi
  echo "  ✓ $bin_name --help → exit $rc ($(echo "$out$([ -s "$WORK/bin-${bin_name}.err" ] && head -1 "$WORK/bin-${bin_name}.err")" | head -1 | cut -c1-50))"
done
# Confirm the 3 bins NOT exercised are at least linked (their .ts files are present
# in the tarball; runtime-dep gap is documented separately).
for bin_name in rules-as-tests-synth rules-as-tests-validate rules-as-tests-install; do
  bin_link="$FIXTURE/node_modules/.bin/$bin_name"
  test -x "$bin_link" || fail "(7b) $bin_name not linked in node_modules/.bin"
  echo "  ~ $bin_name linked (runtime-dep gap: needs eslint etc.; deferred to U10)"
done

echo ""
echo "✅ consumer-matrix npm-tarball cell: GREEN (${FILE_COUNT:-?} files in tarball)"
echo "   10/14 files entries carry measured paired RED evidence; 4 (validator/, ir/, backends/,"
echo "   composition/) are UNVALIDATED-by-this-cell — table in the freeze record (kickoff §3 item 4)."
echo "   F-C′ resolution: option (a) tsx-dep — bin runs end-to-end from installed tarball."
