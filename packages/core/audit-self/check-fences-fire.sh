#!/usr/bin/env bash
# check-fences-fire.sh — prove installed ESLint fences FIRE on deliberately-bad input.
#
# Generalises f17-lint-rules-planted-violation.test.sh (one rule, repo-side CI) into a
# shipped consumer gate covering multiple fence classes via the same proven technique:
#   ESLint Linter API via tsx (NOT the CLI — CLI crashes with ERR_REQUIRE_CYCLE_MODULE
#   when importing .ts flat configs in ESLint v9; see f17 header for full rationale).
#
# FENCE CLASSES:
#   Class 1 — standalone module rules: no-unsafe-zod-parse (R2),
#              no-server-imports-in-client (R12).
#   Class 2 — declarative recipes via restricted-syntax-audit-exempt (R14/R20).
#
# ALGORITHM per fixture triple (<name>.bad.<ext> + <name>.good.<ext> + <name>.manifest.json):
#   1. Parse rule-id and optional rule-options from manifest.
#   2. bad.ts → rule MUST fire (probe exits 0 ⇒ PASS; exits 1 ⇒ FAIL "fence silent").
#   3. good.ts → rule MUST NOT fire (probe exits 0 ⇒ PASS; exits 2 ⇒ FAIL "false-positive").
#
# SKIP GRACEFULLY when tsx or eslint binaries are absent (rc=0 — degrade, never fabricate fail).
# NEVER run the ESLint CLI with the full flat config (ERR_REQUIRE_CYCLE_MODULE).
#
# CONSUMER PATH: scripts/check-fences-fire.sh (copied by setup.d/40-configs.sh).
# FIXTURE PATH:  scripts/fences-fire-fixtures/ (copied by setup.d/40-configs.sh).
#
# @cc-only-rationale: sourced by install.sh dispatcher and consumer scripts; same bash
#   content is the portable mechanism (no CC primitives used).
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ─── Resolve project root ──────────────────────────────────────────────────────
if [ -n "${AIF_PROJECT_ROOT:-}" ]; then
  PROJECT_ROOT="$AIF_PROJECT_ROOT"
elif [ -d "$SCRIPT_DIR/../scripts" ] && [ -d "$SCRIPT_DIR/../node_modules" ]; then
  # Consumer: script lives at PROJECT_ROOT/scripts/check-fences-fire.sh
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
elif [ -d "$SCRIPT_DIR/../../../packages" ]; then
  # Framework: script lives at packages/core/audit-self/check-fences-fire.sh
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
else
  PROJECT_ROOT="$(pwd)"
fi

# ─── Resolve fixture directory ─────────────────────────────────────────────────
FIXTURE_DIR=""
for _d in \
  "$PROJECT_ROOT/scripts/fences-fire-fixtures" \
  "$SCRIPT_DIR/fixtures/fences-fire"; do
  [ -d "$_d" ] && FIXTURE_DIR="$_d" && break
done

if [ -z "$FIXTURE_DIR" ]; then
  echo "  · check-fences-fire: fixture dir not found (expected $PROJECT_ROOT/scripts/fences-fire-fixtures) — skipped"
  exit 0
fi

PASS=0; FAIL=0; SKIP=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip() { SKIP=$((SKIP+1)); echo "  · $1"; }

# ─── Locate binaries ──────────────────────────────────────────────────────────
TSX_BIN=""
for _t in \
  "$PROJECT_ROOT/node_modules/.bin/tsx" \
  "$SCRIPT_DIR/../../../node_modules/.bin/tsx" \
  "$SCRIPT_DIR/../../node_modules/.bin/tsx" \
  "/app/node_modules/.bin/tsx"; do
  [ -x "$_t" ] && TSX_BIN="$_t" && break
done

ESLINT_BIN=""
for _e in \
  "$PROJECT_ROOT/node_modules/.bin/eslint" \
  "$SCRIPT_DIR/../../../node_modules/.bin/eslint" \
  "$SCRIPT_DIR/../../node_modules/.bin/eslint" \
  "/app/node_modules/.bin/eslint"; do
  [ -x "$_e" ] && ESLINT_BIN="$_e" && break
done

if [ -z "$TSX_BIN" ] || [ -z "$ESLINT_BIN" ]; then
  skip "check-fences-fire SKIP — tsx ($([ -n "$TSX_BIN" ] && echo found || echo missing)) or eslint ($([ -n "$ESLINT_BIN" ] && echo found || echo missing)) not available; run npm install first"
  echo ""; echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"; exit 0
fi

NM_SRC="$(dirname "$(dirname "$ESLINT_BIN")")"

# ─── Resolve eslint-rules-local barrel ────────────────────────────────────────
LOCAL_BARREL=""
for _b in \
  "$PROJECT_ROOT/eslint-rules-local/index.mjs" \
  "$SCRIPT_DIR/../eslint-rules-local/index.mjs" \
  "$SCRIPT_DIR/../../eslint-rules-local/index.mjs"; do
  [ -f "$_b" ] && LOCAL_BARREL="$_b" && break
done

if [ -z "$LOCAL_BARREL" ]; then
  skip "check-fences-fire SKIP — eslint-rules-local/index.mjs not found (run install.sh first to generate the barrel)"
  echo ""; echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"; exit 0
fi

BARREL_DIR="$(dirname "$LOCAL_BARREL")"

# ─── Scratch directory + static probe script ───────────────────────────────────
SCRATCH=$(mktemp -d)
trap 'rm -rf "$SCRATCH"' EXIT

# Symlink node_modules and barrel into scratch
ln -sf "$NM_SRC" "$SCRATCH/node_modules"
ln -sf "$BARREL_DIR" "$SCRATCH/eslint-rules-local"

# Write one static probe script; per-fixture params arrive via env vars:
#   FENCE_RULE_ID   — fully qualified rule id (e.g. "rules-as-tests/no-unsafe-zod-parse")
#   FENCE_RULE_OPTS — JSON array string of rule options (empty string = no options)
#   FENCE_BAD_FILE  — absolute path to the bad fixture
#   FENCE_GOOD_FILE — absolute path to the good fixture
cat > "$SCRATCH/fence-probe.mts" << 'PROBE_SCRIPT'
import { Linter } from 'eslint';
import { readFileSync } from 'node:fs';
import tsParser from '@typescript-eslint/parser';
import { default as plugin } from './eslint-rules-local/index.mjs';

const ruleId   = process.env['FENCE_RULE_ID']   ?? '';
const optsJson = process.env['FENCE_RULE_OPTS']  ?? '';
const badFile  = process.env['FENCE_BAD_FILE']   ?? '';
const goodFile = process.env['FENCE_GOOD_FILE']  ?? '';

if (!ruleId || !badFile || !goodFile) {
  process.stderr.write('probe: missing required env vars\n');
  process.exit(9);
}

const pluginName = ruleId.split('/')[0] ?? 'rules-as-tests';
const ruleOpts: unknown[] = optsJson ? (JSON.parse(optsJson) as unknown[]) : [];
const ruleValue = ruleOpts.length > 0 ? (['error', ...ruleOpts] as const) : ('error' as const);

const linter = new Linter();
// `files` is REQUIRED: in ESLint flat config an object without a `files` key
// matches NO file, so `linter.verify(..., { filename: 'bad.ts' })` returns
// "No matching configuration found" and the rule never runs — every fence
// falsely reads SILENT (#832). The TS parser lets the probe parse TS-syntax
// fixtures (e.g. `(x: unknown)`); it is already a packages/core dependency
// (required by the @typescript-eslint/utils-authored rules themselves).
const cfg = [{
  files: ['**/*.{ts,tsx,js,jsx}'],
  plugins: { [pluginName]: plugin },
  rules: { [ruleId]: ruleValue },
  languageOptions: { ecmaVersion: 2022, sourceType: 'module', parser: tsParser },
}];

const badCode  = readFileSync(badFile, 'utf8');
const goodCode = readFileSync(goodFile, 'utf8');

const badMsgs  = linter.verify(badCode,  cfg, { filename: 'bad.ts' });
const goodMsgs = linter.verify(goodCode, cfg, { filename: 'good.ts' });

const badFired  = badMsgs.some(m => m.ruleId === ruleId);
const goodFired = goodMsgs.some(m => m.ruleId === ruleId);

if (!badFired)  process.stderr.write('FENCE_SILENT: bad fixture did not trigger ' + ruleId + '\n');
if (goodFired)  process.stderr.write('FALSE_POSITIVE: good fixture triggered ' + ruleId + '\n');

const rc = (!badFired ? 1 : 0) + (goodFired ? 2 : 0);
process.exit(rc);
PROBE_SCRIPT

echo "  · tsx: $TSX_BIN"
echo "  · barrel: $LOCAL_BARREL"

# ─── Per-fixture probe ─────────────────────────────────────────────────────────
_run_fixture() {
  local MANIFEST="$1"
  local BASE
  BASE="$(basename "$MANIFEST" .manifest.json)"
  local FIXTURE_BASE
  FIXTURE_BASE="$(dirname "$MANIFEST")/$BASE"

  # Find bad and good files (support .ts and .tsx)
  local BAD_FILE="" GOOD_FILE=""
  for _ext in .ts .tsx .js .jsx .txt; do
    [ -z "$BAD_FILE"  ] && [ -f "${FIXTURE_BASE}.bad${_ext}"  ] && BAD_FILE="${FIXTURE_BASE}.bad${_ext}"
    [ -z "$GOOD_FILE" ] && [ -f "${FIXTURE_BASE}.good${_ext}" ] && GOOD_FILE="${FIXTURE_BASE}.good${_ext}"
  done

  if [ -z "$BAD_FILE" ] || [ -z "$GOOD_FILE" ]; then
    skip "[$BASE] missing bad/good fixture files — skipped"
    return
  fi

  # Parse manifest via node (avoids jq dependency)
  local RULE_ID RULE_OPTS
  RULE_ID=$(node --input-type=module -e "
    import { readFileSync } from 'node:fs';
    const m = JSON.parse(readFileSync('$MANIFEST', 'utf8'));
    process.stdout.write(m['rule-id'] ?? '');
  " 2>/dev/null || true)

  RULE_OPTS=$(node --input-type=module -e "
    import { readFileSync } from 'node:fs';
    const m = JSON.parse(readFileSync('$MANIFEST', 'utf8'));
    const o = m['rule-options'];
    if (o) process.stdout.write(JSON.stringify(o));
  " 2>/dev/null || true)

  if [ -z "$RULE_ID" ]; then
    skip "[$BASE] manifest missing rule-id — skipped"
    return
  fi

  # Run probe
  local OUT RC
  OUT=$(cd "$SCRATCH" && \
    FENCE_RULE_ID="$RULE_ID" \
    FENCE_RULE_OPTS="${RULE_OPTS:-}" \
    FENCE_BAD_FILE="$BAD_FILE" \
    FENCE_GOOD_FILE="$GOOD_FILE" \
    "$TSX_BIN" fence-probe.mts 2>&1)
  RC=$?

  if echo "$OUT" | grep -qiE 'cannot find module|ERR_MODULE_NOT_FOUND|ERR_PACKAGE_PATH|Cannot find package'; then
    skip "[$BASE] tsx module load failed ($(echo "$OUT" | head -1 | tr -d '\n')) — dep missing; barrel present"
    return
  fi

  if [ "$RC" -eq 0 ]; then
    ok "[$BASE] fence fires on bad input; good input passes — $RULE_ID ACTIVE"
  elif echo "$OUT" | grep -q 'FENCE_SILENT'; then
    bad "[$BASE] FENCE SILENT: $RULE_ID did NOT flag the bad fixture (rule deleted/broken/misconfigured)"
  elif echo "$OUT" | grep -q 'FALSE_POSITIVE'; then
    bad "[$BASE] FALSE POSITIVE: $RULE_ID flagged the good fixture (selector too broad)"
  else
    bad "[$BASE] probe failed (rc=$RC): $(echo "$OUT" | head -3 | tr '\n' '|')"
  fi
}

# ─── Iterate all manifests ─────────────────────────────────────────────────────
MANIFESTS=()
while IFS= read -r -d '' _f; do
  MANIFESTS+=("$_f")
done < <(find "$FIXTURE_DIR" -maxdepth 1 -name '*.manifest.json' -print0 2>/dev/null | sort -z)

if [ "${#MANIFESTS[@]}" -eq 0 ]; then
  skip "check-fences-fire: no fixture manifests found in $FIXTURE_DIR"
  echo ""; echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"; exit 0
fi

echo "▶ check-fences-fire: probing ${#MANIFESTS[@]} fence(s) from $FIXTURE_DIR"
for _m in "${MANIFESTS[@]}"; do
  _run_fixture "$_m"
done

echo ""
echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
[ "$FAIL" -eq 0 ]
