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
# TWO ARMS, TWO COUNTERS, TWO ESCAPES (GH #1391). The FIXTURE arm proves a rule FIRES; the
# LOAD-PROBE arm proves a placed config IMPORTS. They are reported separately because one
# counter for both claims is unreadable: `PASS=5 FAIL=0 SKIP=3` once meant "zero fences proven,
# five configs importable" and exited 0. Non-vacuity assertion in finish(): if the corpus had
# manifests and NONE produced a verdict, the run is VACUOUS → rc=1 in every mode (dep-class,
# structural, strict or not). Escape: FENCES_FIRE_ALLOW_VACUOUS='<rationale ≥20 chars>' —
# deliberately NOT the same token as the dep-axis FENCES_FIRE_ALLOW_SKIP below.
#
# SKIP GRACEFULLY on any degrade condition (rc=0 — never fabricate fail). Two SKIP classes:
#   structural — fixture dir/barrel/manifests absent (legitimate pre-install/authoring states;
#                e.g. a fresh consumer's own CI runs `validate` before install.sh generates the
#                barrel). ALWAYS non-failing, even under strict mode.
#   dep-class  — tsx/eslint binary absent, or transitive module-resolution failure (GH #915
#                obs 1: this SKIP's only consumer was "someone reads the log" —
#                #warning-nobody-reads, .claude/rules/attention-is-not-a-mechanism.md §1).
# Strict mode promotes a DEP-CLASS SKIP (only) to rc=1 where deps are REQUIRED to be present:
#   FENCES_FIRE_STRICT=1  → force strict;  FENCES_FIRE_STRICT=0 → force degrade;
#   unset                 → auto-strict when CI is set (CI installs deps; a dep-missing SKIP
#                           there means the gate's own firing proof silently did not run).
#   Escape token: FENCES_FIRE_ALLOW_SKIP='<rationale ≥20 chars>' (precedent: ci-tool-pinning §3).
# Interactive/local consumer installs stay degrade (install must not abort).
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

PASS=0; FAIL=0; SKIP=0; SKIP_DEP=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip() { SKIP=$((SKIP+1)); echo "  · $1"; }

# ─── Two axes, two counters (GH #1391) ─────────────────────────────────────────
# PASS/FAIL/SKIP above are the TOTALS. They are shared by two arms that prove DIFFERENT
# claims, and a single counter cannot tell them apart: the FIXTURE arm proves a rule FIRES
# on bad input; the LOAD-PROBE arm proves a placed config IMPORTS cleanly and never proves
# any rule fires. Reported together, five load-probe passes read as "five fences proven"
# while the firing proof was 0/3 — the #1391 consumer wrote a FENCES_FIRE_ALLOW_SKIP
# rationale against that padded number and waived 100% of the firing proof. Each arm now
# carries its own counters, reported separately in finish(), and the fixture arm has a
# non-vacuity assertion no skip class can satisfy.
MANIFEST_COUNT=0
FIXTURE_OK=0; FIXTURE_FAIL=0; FIXTURE_SKIP=0
LOAD_OK=0;    LOAD_FAIL=0;    LOAD_SKIP=0
f_ok()       { FIXTURE_OK=$((FIXTURE_OK+1));     ok   "$1"; }
f_bad()      { FIXTURE_FAIL=$((FIXTURE_FAIL+1)); bad  "$1"; }
f_skip()     { FIXTURE_SKIP=$((FIXTURE_SKIP+1)); skip "$1"; }
l_ok()       { LOAD_OK=$((LOAD_OK+1));           ok   "$1"; }
l_bad()      { LOAD_FAIL=$((LOAD_FAIL+1));       bad  "$1"; }
l_skip()     { LOAD_SKIP=$((LOAD_SKIP+1));       skip "$1"; }

# _first_err <captured-output> — the first line that actually NAMES the failure (GH #1390).
# `head -1` was wrong at every call site: the branches below are reached BECAUSE a
# module-resolution pattern matched somewhere in the output, i.e. the useful line is known to
# be present but is not first. Measured (tsx 4.22.4 / node 24): line 1 is BLANK, line 2 is the
# frame header (`node:internal/modules/run_main:105`), and `Cannot find package '…'` is line 5 —
# so the rendered parenthetical came out empty and the skip was misattributed for a full slice.
# Prefer the line matching the error pattern; fall back to the first non-blank line.
_first_err() {
  local _line
  _line=$(printf '%s\n' "$1" | grep -m1 -iE 'cannot find (module|package)|ERR_MODULE_NOT_FOUND|ERR_PACKAGE_PATH|ERR_UNSUPPORTED_DIR_IMPORT')
  [ -z "$_line" ] && _line=$(printf '%s\n' "$1" | grep -m1 -vE '^[[:space:]]*$')
  printf '%s' "$_line" | tr -d '\n' | cut -c1-240
}
# skip_dep: a SKIP caused specifically by a MISSING DEPENDENCY (tsx/eslint binary absent, or
# transitive module resolution failure) — the #915 obs 1 motivating class, promotable by strict
# mode. Distinct from structural skips (fixture dir absent, barrel not yet generated by
# install.sh, malformed fixture, no manifests) which are legitimate pre-install/authoring states
# unrelated to "did CI install deps" and must NOT fail even under CI (a fresh consumer's own CI
# runs `validate` before the barrel exists — that is expected, not a regression).
skip_dep() { SKIP_DEP=$((SKIP_DEP+1)); skip "$1"; }

# Single exit seam — every termination path routes here so strict mode sees ALL skips
# (including the early fixture-dir / no-manifest paths). See header for the mode contract.
finish() {
  echo ""
  echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
  echo "  fixture arm  (fence FIRING proof):   manifests=$MANIFEST_COUNT proved=$FIXTURE_OK failed=$FIXTURE_FAIL skipped=$FIXTURE_SKIP"
  echo "  load-probe arm (config IMPORTABLE):  ok=$LOAD_OK failed=$LOAD_FAIL skipped=$LOAD_SKIP"

  # ─── Non-vacuity of the FIXTURE arm (GH #1391) ───────────────────────────────
  # "The corpus was present and nothing in it ran" is never a legitimate pass, whatever the
  # skip class — so this check is INDEPENDENT of the dep/structural split and of strict mode.
  # It deliberately does NOT fire when MANIFEST_COUNT is 0: "no manifests yet" is the
  # legitimate pre-install/authoring state (a fresh consumer's own CI runs `validate` before
  # install.sh generates the fixtures), while "manifests exist, zero were probed" is red.
  # Its escape is its OWN token: a FENCES_FIRE_ALLOW_SKIP rationale is written about the
  # dep axis and must not silently waive the entire firing proof (the #1391 CI escape).
  if [ "$MANIFEST_COUNT" -gt 0 ] && [ "$FIXTURE_OK" -eq 0 ] && [ "$FIXTURE_FAIL" -eq 0 ]; then
    if [ -n "${FENCES_FIRE_ALLOW_VACUOUS:-}" ] && [ "${#FENCES_FIRE_ALLOW_VACUOUS}" -ge 20 ]; then
      echo "  · VACUOUS run allowed by FENCES_FIRE_ALLOW_VACUOUS: $FENCES_FIRE_ALLOW_VACUOUS"
    else
      echo "  ✗ VACUOUS: $MANIFEST_COUNT fixture manifest(s) present, $FIXTURE_SKIP skipped, 0 probed — this run proved NO fence fires. Load-probe passes (ok=$LOAD_OK) prove configs import, never that a rule fires. Fix the skip cause above (usually a missing dep named in the skip line), or escape with FENCES_FIRE_ALLOW_VACUOUS='<rationale ≥20 chars>' — NOT FENCES_FIRE_ALLOW_SKIP, which only waives the dep axis. (GH #1391)"
      exit 1
    fi
  fi

  local strict="${FENCES_FIRE_STRICT:-}"
  if [ -z "$strict" ] && [ -n "${CI:-}" ]; then strict=1; fi
  if [ "$strict" = "1" ] && [ "$SKIP_DEP" -gt 0 ]; then
    if [ -n "${FENCES_FIRE_ALLOW_SKIP:-}" ] && [ "${#FENCES_FIRE_ALLOW_SKIP}" -ge 20 ]; then
      echo "  · strict: $SKIP_DEP dep-skip(s) allowed by FENCES_FIRE_ALLOW_SKIP: $FENCES_FIRE_ALLOW_SKIP"
    else
      echo "  ✗ strict mode: $SKIP_DEP dep-missing skip(s) are failures — the gate's own firing proof did not run because a required dependency (tsx/eslint) was absent. Escape: FENCES_FIRE_ALLOW_SKIP='<rationale ≥20 chars>'. (GH #915 obs 1)"
      exit 1
    fi
  fi
  [ "$FAIL" -eq 0 ] && exit 0 || exit 1
}

if [ -z "$FIXTURE_DIR" ]; then
  skip "check-fences-fire: fixture dir not found (expected $PROJECT_ROOT/scripts/fences-fire-fixtures) — skipped"
  finish
fi

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
  skip_dep "check-fences-fire SKIP — tsx ($([ -n "$TSX_BIN" ] && echo found || echo missing)) or eslint ($([ -n "$ESLINT_BIN" ] && echo found || echo missing)) not available; run npm install first"
  finish
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
  finish
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
// Success sentinel — POSITIVE evidence that the probe actually executed both verifies.
// The caller treats rc=0 WITHOUT this line as "the probe never ran" (a skip), not as a
// fired fence: an rc=0 with empty output is indistinguishable from a silent early exit
// otherwise (GH #1391 secondary observation).
process.stderr.write('FENCE_PROBE_DONE rc=' + rc + '\n');
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
    f_skip "[$BASE] missing bad/good fixture files — skipped"
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
    f_skip "[$BASE] manifest missing rule-id — skipped"
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
    FIXTURE_SKIP=$((FIXTURE_SKIP+1))
    skip_dep "[$BASE] tsx module load failed ($(_first_err "$OUT")) — dep missing; barrel present"
    return
  fi

  # POSITIVE EVIDENCE, not rc=0 (GH #1391 secondary observation, confirmed reachable by
  # arm (xiii) of the paired-negative test). The dispatch below is "no resolution pattern
  # matched → rc==0 → fence ACTIVE", so a probe that exits 0 having produced NO output at all
  # (observed: tsx swallowing an unresolvable import when stdout is captured) matched no grep
  # and landed on the ok branch — reporting a fence ACTIVE that never ran, the worst path this
  # gate has. A verdict now requires the sentinel the probe prints just before exiting; its
  # absence is a dep-class skip (never a PASS), and if it is the only outcome the non-vacuity
  # assertion in finish() turns the run red in every mode.
  if [ "$RC" -eq 0 ] && ! echo "$OUT" | grep -q 'FENCE_PROBE_DONE'; then
    FIXTURE_SKIP=$((FIXTURE_SKIP+1))
    skip_dep "[$BASE] probe exited 0 without the FENCE_PROBE_DONE sentinel — the probe never executed, so nothing was proved${OUT:+ (output: $(_first_err "$OUT"))}"
    return
  fi

  if [ "$RC" -eq 0 ]; then
    f_ok "[$BASE] fence fires on bad input; good input passes — $RULE_ID ACTIVE"
  elif echo "$OUT" | grep -q 'FENCE_SILENT'; then
    f_bad "[$BASE] FENCE SILENT: $RULE_ID did NOT flag the bad fixture (rule deleted/broken/misconfigured)"
  elif echo "$OUT" | grep -q 'FALSE_POSITIVE'; then
    f_bad "[$BASE] FALSE POSITIVE: $RULE_ID flagged the good fixture (selector too broad)"
  else
    f_bad "[$BASE] probe failed (rc=$RC): $(echo "$OUT" | head -3 | tr '\n' '|')"
  fi
}

# ─── Iterate all manifests ─────────────────────────────────────────────────────
MANIFESTS=()
while IFS= read -r -d '' _f; do
  MANIFESTS+=("$_f")
done < <(find "$FIXTURE_DIR" -maxdepth 1 -name '*.manifest.json' -print0 2>/dev/null | sort -z)

if [ "${#MANIFESTS[@]}" -eq 0 ]; then
  skip "check-fences-fire: no fixture manifests found in $FIXTURE_DIR"
  finish
fi

# The denominator of the non-vacuity assertion in finish(): how many fixtures the corpus
# OFFERED. Set only once the corpus is known non-empty, so "no manifests yet" stays a
# legitimate structural skip rather than a vacuous run.
MANIFEST_COUNT="${#MANIFESTS[@]}"

echo "▶ check-fences-fire: probing ${#MANIFESTS[@]} fence(s) from $FIXTURE_DIR"
for _m in "${MANIFESTS[@]}"; do
  _run_fixture "$_m"
done

# ─── Placed-config load-probe (GH #976) ─────────────────────────────────────────
# The fixture probe above proves rule LOGIC via a SYNTHETIC in-memory Linter config
# (fence-probe.mts lines "const cfg = [...]") + a barrel resolved from packages/core.
# It NEVER loads the eslint.config.mjs files install.sh actually placed into the
# consumer. So after a PARTIAL dep-install (e.g. #974 pnpm trust-downgrade, or any PM
# hiccup) it stays GREEN while every placed config is non-loadable
# (ERR_MODULE_NOT_FOUND '@eslint/js') — the consumer's real `npx eslint .` channel is
# dead but self-verify says the rule-firing axis passed (#discipline-theatre on the
# install self-verify). Independently load-probe each PLACED config.
#
# FAILURE SEMANTICS — gated on FENCES_FIRE_LOAD_PROBE, NOT the fixture strict machinery:
#   A non-loadable placed config is only a delivery DEFECT when a `--full` install
#   CLAIMED to deliver a working lint channel. The self-verify capstone (99-finalize.sh,
#   FULL only) sets FENCES_FIRE_LOAD_PROBE=1 to opt in → non-loadable = hard FAIL (the
#   honest RED #976 asks for). In EVERY other context — a `--force`/no-deps install, the
#   `check-fences-fire-full-barrel` test (which installs consumers WITHOUT the full plugin
#   set and relies on CI-auto-strict for the FIXTURE arm), a plain `npm run
#   check:fences-fire` — the flag is unset → a non-loadable config is an INFORMATIONAL skip,
#   never promoted (so it does NOT ride the fixture's FENCES_FIRE_STRICT/CI-auto-strict path).
#   A NON-dep load error (config syntax) is always a hard FAIL — a placed config that
#   can't parse is broken irrespective of deps.
# EXCLUDES: node_modules (installed deps), templates/ (source templates import a
# relative barrel that only exists post-install → would false-fail), and scratch/build
# dirs. In the framework repo (no active root eslint.config.mjs, only the template) this
# finds nothing → structural skip.
_PLACED_CONFIGS=()
while IFS= read -r -d '' _c; do _PLACED_CONFIGS+=("$_c"); done < <(
  find "$PROJECT_ROOT" -maxdepth 4 -name 'eslint.config.mjs' \
    -not -path '*/node_modules/*' \
    -not -path '*/templates/*' \
    -not -path '*/.git/*' \
    -not -path '*/.stryker-tmp/*' \
    -not -path '*/dist/*' \
    -not -path '*/.next/*' \
    -not -path '*/reports/*' \
    -print0 2>/dev/null | sort -z)

if [ "${#_PLACED_CONFIGS[@]}" -eq 0 ]; then
  l_skip "load-probe: no placed eslint.config.mjs found under $PROJECT_ROOT — skipped (pre-install/authoring, or framework repo)"
else
  for _cfg in "${_PLACED_CONFIGS[@]}"; do
    _rel="${_cfg#"$PROJECT_ROOT"/}"
    _lp_out=$(FENCE_CFG="file://$_cfg" node --input-type=module -e "
      import(process.env.FENCE_CFG).then(() => process.exit(0)).catch((e) => { process.stderr.write(String((e && e.message) || e)); process.exit(1); });
    " 2>&1)
    _lp_rc=$?
    if [ "$_lp_rc" -eq 0 ]; then
      l_ok "load-probe: placed $_rel loads (imports resolve — real \`eslint .\` channel wired)"
    elif echo "$_lp_out" | grep -qiE 'cannot find (module|package)|ERR_MODULE_NOT_FOUND|ERR_PACKAGE_PATH|Cannot find package'; then
      if [ "${FENCES_FIRE_LOAD_PROBE:-}" = "1" ]; then
        l_bad "load-probe: placed $_rel NON-LOADABLE ($(_first_err "$_lp_out")) — a --full install claimed success but a plugin dep is absent; the consumer's \`eslint .\` is dead (#976)"
      else
        l_skip "load-probe: placed $_rel non-loadable ($(_first_err "$_lp_out")) — deps not installed in this context; informational (set FENCES_FIRE_LOAD_PROBE=1 in a --full self-verify to promote)"
      fi
    else
      l_bad "load-probe: placed $_rel failed to load (non-dep error): $(echo "$_lp_out" | head -2 | tr '\n' '|')"
    fi
  done
fi

finish
