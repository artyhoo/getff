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
#   (iv-vii) strict mode: a DEP-class skip fails under strict / degrades without it / honours the
#         escape token; a STRUCTURAL skip stays non-failing even under strict+CI
#   (viii-xi) NON-VACUITY (GH #1391): manifests present + every fixture skipped → rc!=0 with a
#         VACUOUS verdict in the DEGRADE default too; the skip line NAMES the real error
#         (GH #1390); the escape is its own token (FENCES_FIRE_ALLOW_VACUOUS, ≥20 chars) and
#         FENCES_FIRE_ALLOW_SKIP alone must NOT waive the firing proof
#   (xii) paired-positive for (viii): the same shape with a WORKING barrel exits 0 and reports
#         the fixture axis separately — the vacuity gate must not over-fire
#   (xiii/xiv) a probe exiting 0 with NO output is not a fired fence (positive-evidence
#         sentinel); the same stub emitting the sentinel IS counted
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

# ─── Arm (iv/v/vi): strict mode — SKIP is a failure where DEPS are required (GH #915 obs 1) ──
# A dep-missing SKIP whose only consumer is "someone reads the log" is #warning-nobody-reads
# (attention-is-not-a-mechanism.md §1). Strict mode (explicit FENCES_FIRE_STRICT=1, or CI set)
# promotes a DEP-CLASS SKIP (tsx/eslint absent) to rc=1 — NOT a structural skip (barrel not yet
# generated, fixture dir absent), which stays non-failing even under CI (a fresh consumer's own
# CI legitimately runs `validate` before install.sh generates the barrel).
#
# To genuinely exercise the dep-missing path in framework CI (where tsx/eslint DO exist), copy
# the gate to an isolated location with NO node_modules anywhere in its ancestor chain — the
# gate's binary search is entirely path-relative (PROJECT_ROOT + SCRIPT_DIR-relative fallbacks),
# so this reliably makes it "not find" tsx/eslint without touching the real installation.
ISOLATED_GATE_DIR=$(mktemp -d)/deeply/nested/isolated/audit-self
mkdir -p "$ISOLATED_GATE_DIR"
cp "$GATE_SCRIPT" "$ISOLATED_GATE_DIR/check-fences-fire.sh"
ISOLATED_GATE="$ISOLATED_GATE_DIR/check-fences-fire.sh"
DEP_MISSING_ROOT=$(mktemp -d)   # AIF_PROJECT_ROOT with a fixture dir so it reaches the binary check
mkdir -p "$DEP_MISSING_ROOT/scripts/fences-fire-fixtures"
cp "$FIXTURE_SRC/no-unsafe-zod-parse.manifest.json" "$DEP_MISSING_ROOT/scripts/fences-fire-fixtures/" 2>/dev/null || true

# (iv) strict: dep-missing SKIP → rc=1
env -u CI FENCES_FIRE_STRICT=1 AIF_PROJECT_ROOT="$DEP_MISSING_ROOT" bash "$ISOLATED_GATE" >/dev/null 2>&1
if [ $? -eq 1 ]; then
  ok "(iv) strict arm: dep-missing SKIP exits 1 under FENCES_FIRE_STRICT=1"
else
  bad "(iv) strict arm: dep-missing SKIP did NOT fail under FENCES_FIRE_STRICT=1 — silent-degrade leak"
fi

# (v, paired-positive) degrade default preserved: same run WITHOUT strict/CI → rc=0
env -u CI AIF_PROJECT_ROOT="$DEP_MISSING_ROOT" bash "$ISOLATED_GATE" >/dev/null 2>&1
if [ $? -eq 0 ]; then
  ok "(v) degrade arm: same dep-missing SKIP exits 0 without strict/CI (install-must-not-abort preserved)"
else
  bad "(v) degrade arm: non-strict dep-missing SKIP exited non-zero — consumer install would abort"
fi

# (vi) escape token: strict + rationale >=20 chars → rc=0; too-short rationale → still rc=1
env -u CI FENCES_FIRE_STRICT=1 FENCES_FIRE_ALLOW_SKIP='consumer sandbox intentionally has no tsx' \
  AIF_PROJECT_ROOT="$DEP_MISSING_ROOT" bash "$ISOLATED_GATE" >/dev/null 2>&1
RC_LONG=$?
env -u CI FENCES_FIRE_STRICT=1 FENCES_FIRE_ALLOW_SKIP='short' \
  AIF_PROJECT_ROOT="$DEP_MISSING_ROOT" bash "$ISOLATED_GATE" >/dev/null 2>&1
RC_SHORT=$?
if [ "$RC_LONG" -eq 0 ] && [ "$RC_SHORT" -eq 1 ]; then
  ok "(vi) escape arm: >=20-char rationale bypasses strict (rc=0); short rationale rejected (rc=1)"
else
  bad "(vi) escape arm: expected long-rationale rc=0 + short-rationale rc=1, got $RC_LONG/$RC_SHORT"
fi
rm -rf "$DEP_MISSING_ROOT" "$(dirname "$(dirname "$(dirname "$(dirname "$ISOLATED_GATE_DIR")")")")"

# (vii, paired-negative) STRUCTURAL skip (barrel absent, deps present) stays non-strict even
# under strict+CI — proves strict mode targets dep-class only, not every SKIP (the D6
# install-self-verification regression this arm guards against: a fresh consumer's own CI runs
# `validate` before install.sh generates the barrel — that must keep degrading, not fail).
BARREL_ABSENT_ROOT=$(mktemp -d)
mkdir -p "$BARREL_ABSENT_ROOT/scripts/fences-fire-fixtures"
cp "$FIXTURE_SRC/no-unsafe-zod-parse.manifest.json" "$BARREL_ABSENT_ROOT/scripts/fences-fire-fixtures/" 2>/dev/null || true
cp "$FIXTURE_SRC"/no-unsafe-zod-parse.bad.* "$BARREL_ABSENT_ROOT/scripts/fences-fire-fixtures/" 2>/dev/null || true
cp "$FIXTURE_SRC"/no-unsafe-zod-parse.good.* "$BARREL_ABSENT_ROOT/scripts/fences-fire-fixtures/" 2>/dev/null || true
CI=1 FENCES_FIRE_STRICT=1 AIF_PROJECT_ROOT="$BARREL_ABSENT_ROOT" bash "$GATE_SCRIPT" >/dev/null 2>&1
if [ $? -eq 0 ]; then
  ok "(vii) structural-skip arm: barrel-absent SKIP stays rc=0 even under strict+CI (only dep-class skips fail)"
else
  bad "(vii) structural-skip arm: barrel-absent SKIP wrongly failed under strict+CI — over-broad strict promotion"
fi
rm -rf "$BARREL_ABSENT_ROOT"

# ─── Arms (viii)-(xiii): NON-VACUITY of the fixture arm (GH #1391 / #1390) ────────────
# GH #1391: the gate printed `PASS=5 FAIL=0` and exited 0 with EVERY fixture skipped — the
# five passes were load-probes (they prove a config IMPORTS, never that a rule FIRES), so the
# firing proof was 0/3 and the gate reported success. #contract-that-cannot-fail.
# GH #1390: the skip line rendered the cause as an empty `()` because `head -1` read a blank
# first line, so the real `Cannot find package …` message never reached the log.
#
# Both arms run against ONE reproduction of the reported consumer shape: barrel PRESENT,
# tsx+eslint PRESENT, manifests PRESENT, but the barrel imports an unresolvable package →
# every fixture takes the dep-class skip inside _run_fixture. Verified locally: tsx emits a
# BLANK first line, the frame header second, and `Cannot find package` only on line 5.
#
# PLACEMENT: these arms sit ABOVE the arms (ii)/(iii) scratch section on purpose — that section
# exits early when the install-generated barrel is absent, which is ALWAYS the case in the
# framework repo. Below it, every arm here would silently never run (the same vacuity #1391 is
# about). They build their own barrel instead, so they run in framework CI.
VAC_NM="$(dirname "$(dirname "$ESLINT_BIN")")"

_vac_root() {
  # _vac_root <dir> <barrel-import-specifier> — build a consumer-shaped root whose barrel
  # re-exports <specifier> (an unresolvable specifier ⇒ the reported dep-skip shape).
  local _root="$1" _spec="$2"
  mkdir -p "$_root/scripts/fences-fire-fixtures" "$_root/eslint-rules-local"
  ln -sf "$VAC_NM" "$_root/node_modules"
  printf "export { default } from '%s';\n" "$_spec" > "$_root/eslint-rules-local/index.mjs"
  cp "$FIXTURE_SRC/no-unsafe-zod-parse.manifest.json" "$_root/scripts/fences-fire-fixtures/"
  cp "$FIXTURE_SRC"/no-unsafe-zod-parse.bad.*  "$_root/scripts/fences-fire-fixtures/" 2>/dev/null || true
  cp "$FIXTURE_SRC"/no-unsafe-zod-parse.good.* "$_root/scripts/fences-fire-fixtures/" 2>/dev/null || true
}

VAC_MISSING_PKG='definitely-not-a-real-package-xyz'
VAC_ROOT=$(mktemp -d)
_vac_root "$VAC_ROOT" "$VAC_MISSING_PKG"

# (viii) all-fixtures-skipped ⇒ non-zero with a DISTINCT verdict, in the DEGRADE default too
# (no CI, no FENCES_FIRE_STRICT) — vacuity is its own axis, not a strict-mode side effect.
VAC_OUT=$(env -u CI -u FENCES_FIRE_STRICT AIF_PROJECT_ROOT="$VAC_ROOT" bash "$GATE_SCRIPT" 2>&1)
VAC_RC=$?
if [ "$VAC_RC" -ne 0 ] && echo "$VAC_OUT" | grep -q 'VACUOUS'; then
  ok "(viii) vacuity arm: manifests present + every fixture skipped → rc=$VAC_RC with a VACUOUS verdict (#1391)"
else
  bad "(viii) vacuity arm: expected rc!=0 + VACUOUS, got rc=$VAC_RC — the gate reports success having proved no fence (#1391)"
  echo "    gate output: $(echo "$VAC_OUT" | tail -6 | tr '\n' '|')"
fi

# (ix) the skip line must NAME the real error, not render an empty parenthetical (#1390)
if echo "$VAC_OUT" | grep -q "module load failed ($VAC_MISSING_PKG\|module load failed (.*$VAC_MISSING_PKG"; then
  ok "(ix) error-capture arm: dep-skip parenthetical names the unresolvable package (#1390)"
elif echo "$VAC_OUT" | grep -q 'module load failed ()'; then
  bad "(ix) error-capture arm: parenthetical is EMPTY — head -1 read the blank first line, the real cause never reached the log (#1390)"
else
  bad "(ix) error-capture arm: parenthetical does not name '$VAC_MISSING_PKG' (#1390)"
  echo "    skip line: $(echo "$VAC_OUT" | grep -m1 'module load failed' | head -c 300)"
fi

# (x) the vacuity escape is its OWN token with a >=20-char rationale (precedent: ci-tool-pinning §3)
env -u CI -u FENCES_FIRE_STRICT FENCES_FIRE_ALLOW_VACUOUS='consumer probes fences in a separate lint job' \
  AIF_PROJECT_ROOT="$VAC_ROOT" bash "$GATE_SCRIPT" >/dev/null 2>&1
VAC_ESC_LONG=$?
env -u CI -u FENCES_FIRE_STRICT FENCES_FIRE_ALLOW_VACUOUS='nope' \
  AIF_PROJECT_ROOT="$VAC_ROOT" bash "$GATE_SCRIPT" >/dev/null 2>&1
VAC_ESC_SHORT=$?
if [ "$VAC_ESC_LONG" -eq 0 ] && [ "$VAC_ESC_SHORT" -ne 0 ]; then
  ok "(x) vacuity escape arm: >=20-char FENCES_FIRE_ALLOW_VACUOUS rationale bypasses (rc=0); short rationale rejected (rc=$VAC_ESC_SHORT)"
else
  bad "(x) vacuity escape arm: expected long-rationale rc=0 + short-rationale rc!=0, got $VAC_ESC_LONG/$VAC_ESC_SHORT"
fi

# (xi, the #1391 CI escape) FENCES_FIRE_ALLOW_SKIP must NOT waive vacuity. The reported
# consumer waived 100% of the firing proof with a dep-skip rationale written against the
# PADDED counter; the two axes therefore need two tokens.
env -u CI -u FENCES_FIRE_STRICT FENCES_FIRE_ALLOW_SKIP='the other fixture probes still run and still must pass' \
  AIF_PROJECT_ROOT="$VAC_ROOT" bash "$GATE_SCRIPT" >/dev/null 2>&1
if [ $? -ne 0 ]; then
  ok "(xi) escape-separation arm: FENCES_FIRE_ALLOW_SKIP alone does NOT waive vacuity — the two axes have two tokens (#1391)"
else
  bad "(xi) escape-separation arm: a dep-skip waiver silently waived the whole firing proof (#1391)"
fi
rm -rf "$VAC_ROOT"

# (xii, paired-positive) the vacuity gate must NOT over-fire: the same shape with a WORKING
# barrel proves its fence and exits 0, and the summary reports the fixture axis separately so
# an ALLOW_SKIP rationale can be checked against a number that means what it says.
VAC_OK_ROOT=$(mktemp -d)
_vac_root "$VAC_OK_ROOT" "$REPO_ROOT/packages/core/eslint-rules/index.ts"
VAC_OK_OUT=$(env -u CI -u FENCES_FIRE_STRICT AIF_PROJECT_ROOT="$VAC_OK_ROOT" bash "$GATE_SCRIPT" 2>&1)
VAC_OK_RC=$?
if [ "$VAC_OK_RC" -eq 0 ] && echo "$VAC_OK_OUT" | grep -qE 'proved=[1-9]'; then
  ok "(xii) paired-positive: working barrel → rc=0 and the summary reports the fixture axis (proved=N) separately from load-probes"
elif echo "$VAC_OK_OUT" | grep -qE 'module load failed|dep missing'; then
  # Narrower than GATE_SKIP_PATTERN on purpose: that pattern also matches the load-probe's
  # structural "— skipped" line, which is EXPECTED here (no placed eslint.config.mjs in a
  # scratch root) and would turn this arm permanently inconclusive — vacuity by another name.
  skip "(xii) gate SKIP'd in scratch env — paired-positive inconclusive: $(echo "$VAC_OK_OUT" | tail -3 | tr '\n' '|')"
else
  bad "(xii) paired-positive: expected rc=0 + a separate fixture-axis count (proved=N), got rc=$VAC_OK_RC"
  echo "    gate output: $(echo "$VAC_OK_OUT" | tail -6 | tr '\n' '|')"
fi
rm -rf "$VAC_OK_ROOT"

# (xiii) #1391 secondary observation — a probe that exits 0 having produced NO output must not
# read as a fired fence. The gate's dispatch was `grep module-resolution → else rc==0 → ok`, so
# a silent rc=0 (observed on tsx 4.22.4 with output captured) landed on the ok branch and
# reported a fence ACTIVE that never ran. Positive evidence (a sentinel the probe prints) is
# the falsifier. Driven here by a STUB tsx — deterministic, no dependence on which tsx build
# exhibits the silent exit.
_stub_tsx_root() {
  # _stub_tsx_root <dir> <stub-body> — consumer-shaped root whose node_modules/.bin/tsx is a stub
  local _root="$1" _body="$2"
  mkdir -p "$_root/scripts/fences-fire-fixtures" "$_root/eslint-rules-local" "$_root/node_modules/.bin"
  printf 'export default { rules: {} };\n' > "$_root/eslint-rules-local/index.mjs"
  cp "$FIXTURE_SRC/no-unsafe-zod-parse.manifest.json" "$_root/scripts/fences-fire-fixtures/"
  cp "$FIXTURE_SRC"/no-unsafe-zod-parse.bad.*  "$_root/scripts/fences-fire-fixtures/" 2>/dev/null || true
  cp "$FIXTURE_SRC"/no-unsafe-zod-parse.good.* "$_root/scripts/fences-fire-fixtures/" 2>/dev/null || true
  printf '#!/usr/bin/env bash\n%s\n' "$_body" > "$_root/node_modules/.bin/tsx"
  printf '#!/usr/bin/env bash\nexit 0\n' > "$_root/node_modules/.bin/eslint"
  chmod +x "$_root/node_modules/.bin/tsx" "$_root/node_modules/.bin/eslint"
}

SILENT_ROOT=$(mktemp -d)
_stub_tsx_root "$SILENT_ROOT" 'exit 0'
SILENT_OUT=$(env -u CI -u FENCES_FIRE_STRICT AIF_PROJECT_ROOT="$SILENT_ROOT" bash "$GATE_SCRIPT" 2>&1)
SILENT_RC=$?
if [ "$SILENT_RC" -ne 0 ] && ! echo "$SILENT_OUT" | grep -q 'ACTIVE'; then
  ok "(xiii) silent-probe arm: a probe exiting 0 with no output is NOT counted as a fired fence (rc=$SILENT_RC, no ACTIVE claim)"
else
  bad "(xiii) silent-probe arm: rc=$SILENT_RC and ACTIVE-claim present=$(echo "$SILENT_OUT" | grep -c 'ACTIVE') — a probe that never ran reported a live fence (#1391 secondary)"
  echo "    gate output: $(echo "$SILENT_OUT" | tail -6 | tr '\n' '|')"
fi
rm -rf "$SILENT_ROOT"

# (xiv, paired-positive for xiii) the SAME stub, now printing the success sentinel, IS counted —
# proving arm (xiii) fails on missing evidence, not on the stub itself.
SENTINEL_ROOT=$(mktemp -d)
_stub_tsx_root "$SENTINEL_ROOT" 'echo FENCE_PROBE_DONE; exit 0'
SENTINEL_OUT=$(env -u CI -u FENCES_FIRE_STRICT AIF_PROJECT_ROOT="$SENTINEL_ROOT" bash "$GATE_SCRIPT" 2>&1)
SENTINEL_RC=$?
if [ "$SENTINEL_RC" -eq 0 ] && echo "$SENTINEL_OUT" | grep -q 'ACTIVE'; then
  ok "(xiv) sentinel paired-positive: probe emitting the success sentinel counts as a fired fence (rc=0) — arm (xiii) is non-vacuous"
else
  bad "(xiv) sentinel paired-positive: expected rc=0 + ACTIVE, got rc=$SENTINEL_RC — the sentinel requirement rejects a legitimate pass"
  echo "    gate output: $(echo "$SENTINEL_OUT" | tail -6 | tr '\n' '|')"
fi
rm -rf "$SENTINEL_ROOT"
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
