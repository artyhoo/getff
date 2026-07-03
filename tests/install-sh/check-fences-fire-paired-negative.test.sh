#!/usr/bin/env bash
# check-fences-fire-paired-negative.test.sh — T15 self-application: the check-fences-fire.sh probe
# MUST fail (exit non-zero) when a fence is deliberately broken — falsifiability proof.
#
# Without this test, check-fences-fire.sh could silently pass even on a broken gate (SKIP or
# logic error making it always-ok). This mirrors f17's "arm (iii) RAW-CHANNEL" pattern:
# the meta-test proves the meta-gate has teeth.
#
# ARMS:
#   (i)   form-check: check-fences-fire.sh script exists and is executable
#   (pos) POSITIVE arm: gate run against unmodified source-plugin fixtures MUST exit 0
#         (all included fences fire on the deliberately-bad fixtures). This is the
#         NON-VACUOUS arm — it catches an always-silent gate (#832: without it the
#         other arms only assert fail-on-broken, which a permanently-broken gate
#         satisfied vacuously). It builds its own barrel from the SOURCE plugin
#         (packages/core/eslint-rules/index.ts) so it RUNS in framework CI even though
#         the shipped install-generated barrel (eslint-rules-local/index.mjs) is absent.
#   (ii)  FENCE SILENT arm: bad fixture replaced with valid code → gate must exit non-zero
#   (iii) FALSE POSITIVE arm: good fixture replaced with bad code → gate must exit non-zero
#
# SKIP condition: tsx or eslint not available (same graceful-degrade as the gate itself).
# rc=0 on SKIP, rc=1 on any arm FAIL.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GATE_SCRIPT="$REPO_ROOT/packages/core/audit-self/check-fences-fire.sh"
FIXTURE_SRC="$REPO_ROOT/packages/core/audit-self/fixtures/fences-fire"

PASS=0; FAIL=0; SKIP=0
ok()   { PASS=$((PASS+1)); echo "✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "✗ $1"; }
skip() { SKIP=$((SKIP+1)); echo "· $1"; }

# ─── Arm (i): form-check ──────────────────────────────────────────────────────
if [ -x "$GATE_SCRIPT" ]; then
  ok "(i) gate script $GATE_SCRIPT exists and is executable"
else
  bad "(i) gate script $GATE_SCRIPT missing or not executable"
fi

# ─── Skip-condition probe: is tsx + eslint resolvable? ───────────────────────
TSX_BIN=""
for _t in \
  "$REPO_ROOT/node_modules/.bin/tsx" \
  "$REPO_ROOT/packages/core/node_modules/.bin/tsx" \
  "/app/node_modules/.bin/tsx"; do
  [ -x "$_t" ] && TSX_BIN="$_t" && break
done

ESLINT_BIN=""
for _e in \
  "$REPO_ROOT/node_modules/.bin/eslint" \
  "$REPO_ROOT/packages/core/node_modules/.bin/eslint" \
  "/app/node_modules/.bin/eslint"; do
  [ -x "$_e" ] && ESLINT_BIN="$_e" && break
done

if [ -z "$TSX_BIN" ] || [ -z "$ESLINT_BIN" ]; then
  skip "(pos) tsx or eslint not found — POSITIVE arm SKIP (graceful degrade, same condition as the gate)"
  skip "(ii) tsx or eslint not found — arms (ii)/(iii) SKIP (same condition as the gate)"
  skip "(iii) tsx or eslint not found — arm (iii) SKIP"
  echo ""
  echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
  [ "$FAIL" -eq 0 ]; exit $?
fi

# Single EXIT trap for every scratch dir this test creates (a second `trap ... EXIT`
# would REPLACE the first and leak the earlier dir).
POS_SCRATCH=""; SCRATCH=""
trap '[ -n "$POS_SCRATCH" ] && rm -rf "$POS_SCRATCH"; [ -n "$SCRATCH" ] && rm -rf "$SCRATCH"' EXIT

# Gate SKIP detection must match the gate's actual skip wording ("SKIP —", "— skipped",
# "module load failed"). A bare 'SKIP' pattern would ALWAYS match the trailing
# "PASS=… FAIL=… SKIP=…" summary line, silently turning every genuine arm FAIL into an
# inconclusive skip — the same vacuousness this test exists to prevent.
GATE_SKIP_PATTERN='SKIP —|— skipped|module load failed|dep missing'

# ─── Arm (pos): NON-VACUOUS POSITIVE — gate exits 0 on unmodified source-plugin fixtures ──
# This is the teeth: an always-silent gate (the #832 bug) makes every fence read SILENT,
# so the gate exits non-zero on UNMODIFIED bad fixtures → this arm FAILs. The arm therefore
# detects a permanently-broken gate that the fail-on-broken arms (ii)/(iii) cannot.
#
# It is non-vacuous in framework CI: instead of relying on the shipped install-generated
# barrel (eslint-rules-local/index.mjs — absent in this repo, generated only on consumers),
# it builds a barrel that re-exports the SOURCE plugin. The probe runs via tsx, which
# resolves the .ts entry point directly.
#
# Only fixtures whose rule-id is exported by the source plugin are copied:
#   - no-unsafe-zod-parse.*            (rule-id rules-as-tests/no-unsafe-zod-parse)
#   - require-use-server-directive.*   (rule-id rules-as-tests/restricted-syntax-audit-exempt)
# R12 (no-server-imports-in-client) is a synthesizer recipe (next-r12-*.json) absent from the
# source plugin → covered by the consumer's install-generated barrel; framework-CI coverage is
# a follow-up (#832 split). Including its fixture here would make the gate exit non-zero for the
# WRONG reason (rule not registered), so it is deliberately excluded.
POS_SCRATCH=$(mktemp -d)

POS_NM="$(dirname "$(dirname "$TSX_BIN")")"
ln -sf "$POS_NM" "$POS_SCRATCH/node_modules"

mkdir -p "$POS_SCRATCH/eslint-rules-local"
cat > "$POS_SCRATCH/eslint-rules-local/index.mjs" << EOF
// Built from the SOURCE plugin (not the shipped install-generated barrel) so the POSITIVE
// arm RUNS in framework CI. tsx resolves the .ts entry point.
export { default } from '$REPO_ROOT/packages/core/eslint-rules/index.ts';
EOF

POS_FIXTURES="$POS_SCRATCH/scripts/fences-fire-fixtures"
mkdir -p "$POS_FIXTURES"
for _stem in no-unsafe-zod-parse require-use-server-directive; do
  for _suffix in manifest.json bad.txt good.txt bad.ts good.ts bad.tsx good.tsx; do
    [ -f "$FIXTURE_SRC/$_stem.$_suffix" ] && cp "$FIXTURE_SRC/$_stem.$_suffix" "$POS_FIXTURES/"
  done
done

POS_OUTPUT=$(AIF_PROJECT_ROOT="$POS_SCRATCH" bash "$GATE_SCRIPT" 2>&1)
POS_RC=$?

if [ "$POS_RC" -eq 0 ] && echo "$POS_OUTPUT" | grep -q 'fence fires on bad input'; then
  ok "(pos) POSITIVE arm: gate exits 0 + fences ACTIVE on unmodified source-plugin fixtures — gate is NON-VACUOUS (not always-silent)"
elif echo "$POS_OUTPUT" | grep -qE "$GATE_SKIP_PATTERN"; then
  skip "(pos) gate SKIP'd in scratch env (tool/barrel resolution) — POSITIVE arm inconclusive: $(echo "$POS_OUTPUT" | head -3 | tr '\n' '|')"
else
  bad "(pos) POSITIVE arm: gate did NOT exit 0 + fences-ACTIVE on unmodified bad fixtures (rc=$POS_RC) — fences are SILENT (the #832 always-silent bug)"
  echo "    gate output: $(echo "$POS_OUTPUT" | head -8 | tr '\n' '|')"
fi

# ─── Scratch: isolated fixture environment ────────────────────────────────────
SCRATCH=$(mktemp -d)

FIXTURES_DIR="$SCRATCH/fences-fire-fixtures"
mkdir -p "$FIXTURES_DIR"

# We must also simulate a consumer's eslint-rules-local barrel for the gate to load the plugin.
# The gate skips cleanly when the barrel is missing (SKIP, rc=0). For this paired-negative test
# we want the FENCE_SILENT arm (rc=1), so we need the barrel to be found. Link from repo root.
BARREL_SRC=""
for _b in \
  "$REPO_ROOT/eslint-rules-local/index.mjs" \
  "$REPO_ROOT/packages/core/eslint-rules-local/index.mjs"; do
  [ -f "$_b" ] && BARREL_SRC="$(dirname "$_b")" && break
done

if [ -z "$BARREL_SRC" ]; then
  skip "(ii) eslint-rules-local/index.mjs not found — gate would SKIP (barrel check first)"
  skip "(iii) same reason"
  echo ""
  echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
  # NOT a bare `exit 0`: the (pos) arm has already run — its FAIL must propagate
  # even when arms (ii)/(iii) skip (framework repo has no install-generated barrel).
  [ "$FAIL" -eq 0 ]; exit $?
fi

# Symlink node_modules so the gate's scratch probe can import eslint
NM_SRC="$(dirname "$(dirname "$ESLINT_BIN")")"
ln -sf "$NM_SRC" "$SCRATCH/node_modules"
ln -sf "$BARREL_SRC" "$SCRATCH/eslint-rules-local"

# The gate script resolves fixture dir via AIF_PROJECT_ROOT or relative path.
# We set AIF_PROJECT_ROOT=$SCRATCH and place the fixtures at $SCRATCH/scripts/fences-fire-fixtures.
mkdir -p "$SCRATCH/scripts"
mkdir -p "$SCRATCH/node_modules"  # already linked above

# Re-link barrel inside SCRATCH root so gate's _run_fixture finds eslint-rules-local from PROJECT_ROOT
ln -sf "$BARREL_SRC" "$SCRATCH/eslint-rules-local"

FAKE_FIXTURES="$SCRATCH/scripts/fences-fire-fixtures"
mkdir -p "$FAKE_FIXTURES"

# ─── Arm (ii): FENCE SILENT — bad file is actually good code ─────────────────
# Setup: use the real no-unsafe-zod-parse fixture manifest, but swap bad.ts with good code.
# The gate must see FENCE_SILENT (bad fixture did not trigger the rule) → exit non-zero.
ARM2_RULE="rules-as-tests/no-unsafe-zod-parse"
cat > "$FAKE_FIXTURES/arm2-silent.manifest.json" << 'EOF'
{"rule-id": "rules-as-tests/no-unsafe-zod-parse", "description": "paired-negative arm (ii): bad file is actually good — fence should be silent (test: gate must FAIL)"}
EOF
# The "bad" file is actually GOOD code (uses safeParse) — the fence should NOT fire on it.
# This simulates a generated fixture where the bad example is wrong.
cat > "$FAKE_FIXTURES/arm2-silent.bad.ts" << 'EOF'
// deliberately GOOD code in the "bad" file — fence should NOT fire
const schema = { safeParse: (x: unknown) => ({ success: true, data: x }) };
const result = schema.safeParse(process.env.INPUT);
export { result };
EOF
# Good file (correct — used only to confirm false-positive check passes)
cat > "$FAKE_FIXTURES/arm2-silent.good.ts" << 'EOF'
const schema = { safeParse: (x: unknown) => ({ success: true, data: x }) };
const result = schema.safeParse(process.env.INPUT);
export { result };
EOF

# Run gate with this single broken fixture; must exit non-zero (FENCE_SILENT)
ARM2_OUTPUT=$(AIF_PROJECT_ROOT="$SCRATCH" bash "$GATE_SCRIPT" 2>&1)
ARM2_RC=$?

if [ "$ARM2_RC" -ne 0 ]; then
  ok "(ii) FENCE SILENT arm: gate exits non-zero (rc=$ARM2_RC) when bad fixture has valid code — probe is falsifiable"
elif echo "$ARM2_OUTPUT" | grep -qE "$GATE_SKIP_PATTERN"; then
  skip "(ii) gate SKIP'd (tool resolution issue in scratch env) — arm inconclusive"
else
  bad "(ii) FENCE SILENT arm: gate exited 0 when bad file is valid code — probe accepts silent fences (vacuous pass)"
  echo "    gate output: $(echo "$ARM2_OUTPUT" | head -5 | tr '\n' '|')"
fi

# ─── Arm (iii): FALSE POSITIVE — good file has bad code ──────────────────────
# Clear fixtures and use a fresh scenario: good.ts has bad code → false positive → gate fails.
rm -f "$FAKE_FIXTURES"/*.json "$FAKE_FIXTURES"/*.ts 2>/dev/null || true

cat > "$FAKE_FIXTURES/arm3-fp.manifest.json" << 'EOF'
{"rule-id": "rules-as-tests/no-unsafe-zod-parse", "description": "paired-negative arm (iii): good file has bad code — false positive (gate must FAIL)"}
EOF
# bad.ts is correct (uses .parse() → rule fires on it)
cat > "$FAKE_FIXTURES/arm3-fp.bad.ts" << 'EOF'
const schema = { parse: (x: unknown) => x };
const result = schema.parse(process.env.INPUT);
export { result };
EOF
# good.ts is WRONG — uses .parse() instead of .safeParse() → rule fires on it (false positive)
cat > "$FAKE_FIXTURES/arm3-fp.good.ts" << 'EOF'
// deliberately BAD code in the "good" file — fence fires here, which is a false positive
const schema = { parse: (x: unknown) => x };
const result = schema.parse(process.env.INPUT);
export { result };
EOF

ARM3_OUTPUT=$(AIF_PROJECT_ROOT="$SCRATCH" bash "$GATE_SCRIPT" 2>&1)
ARM3_RC=$?

if [ "$ARM3_RC" -ne 0 ]; then
  ok "(iii) FALSE POSITIVE arm: gate exits non-zero (rc=$ARM3_RC) when good fixture has bad code — probe catches false positives"
elif echo "$ARM3_OUTPUT" | grep -qE "$GATE_SKIP_PATTERN"; then
  skip "(iii) gate SKIP'd — arm inconclusive"
else
  bad "(iii) FALSE POSITIVE arm: gate exited 0 when good file triggers the rule — probe misses false positives"
  echo "    gate output: $(echo "$ARM3_OUTPUT" | head -5 | tr '\n' '|')"
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
[ "$FAIL" -eq 0 ]
