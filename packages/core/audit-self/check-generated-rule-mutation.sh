#!/usr/bin/env bash
# check-generated-rule-mutation.sh — D5 install-time mutation gate.
#
# After ./setup --full generates rules via 80-rule-bootstrap.sh, this gate reads the
# emitted manifest and PROVES each generated rule's negative-test is non-vacuous: it
# kills ≥60% of deterministic selector mutations (if a test passes even with a broken
# selector, the test is theatre — per the mutation-discipline, SSOT #91 ADAPT).
#
# MECHANISM: selector perturbation (NOT Stryker/universalmutator — generated rules are
# declarative no-restricted-syntax selectors, not TS code). 11 mutations per rule:
#   STRUCT-1  Prepend unreachable ancestor    "NOMATCH_9X > <orig>"
#   STRUCT-2  Replace with sentinel           "Program > NOMATCH_SENTINEL_9X"
#   STRUCT-3  Append unmatchable attribute    "<orig>[NOMATCH_ATTR_9X='_']"
#   STRUCT-4  Swap first '>' combinator       "> " → " " (descendant)
#   VAL-1     Prefix first quoted value       'X_<val>'
#   VAL-2     Suffix first quoted value       '<val>_Y'
#   VAL-3     Replace first quoted value      '_NOMATCH_VAL_9X'
#   ATTR-1    Remove first [...] filter       (broadens selector — can SURVIVE on weak tests)
#   NODE-1    Prefix first node type          'X_<NodeType>'
#   NODE-2    Suffix first node type          '<NodeType>_Y'
#   LOGIC-1   Negate first attribute          [attr='v'] → [attr!='v']
# Semantic mutations (VAL/ATTR/LOGIC) can SURVIVE if the test input is too broad,
# making the ≥60% kill-floor meaningful — unlike structure-only sentinels.
# Killed = mutated selector does NOT fire on bad input (test would detect breakage).
# Survived = mutated selector STILL fires (test is selector-blind).
#
# DEGRADES GRACEFULLY when:
#   - Manifest absent (80-rule-bootstrap skipped → zero generated rules → exit 0)
#   - ESLint binary absent (tsx not available → skip with guidance)
#   - No declarative rules in the manifest (degenerate → exit 0; an unreadable manifest is a FAIL)
#
# NOT a CI gate — runs ONLY under FULL (--full install). MUST NOT run on CI self-install
# path (FULL unset). rc=0 on degrade, rc=1 on kill-rate failure.
# A run that tested no rule exits ${GETFF_SKIP_RC:-0}: the install self-verify capstone sets
# GETFF_SKIP_RC=77 (the automake/TAP SKIP code) so «checked nothing» is counted as SKIP, not PASS
# (critical-review S4-7); every other caller keeps rc 0.
#
# @cc-only-rationale: sourced by install.sh dispatcher (setup.d/99-finalize.sh); not a
#   consumer-facing npm script (mutation depth pass uses run-generated-rule-mutation.sh).
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Resolve consumer root: passed as first arg, else fall back
CONSUMER_ROOT="${1:-${AIF_PROJECT_ROOT:-$(pwd)}}"

MANIFEST="$CONSUMER_ROOT/.ai-factory/synthesizer-output/rules-manifest-additions.json"

# ─── Degrade: manifest absent ─────────────────────────────────────────────────
# Distinguish the two causes (issue #910): research artefacts genuinely absent vs present-
# but-synthesis-emitted-nothing. Conflating them sent debugging down the wrong path when a
# symlinked framework checkout silently skipped rule-bootstrap-cli's main().
if [ ! -f "$MANIFEST" ]; then
  echo "  · check-generated-rule-mutation: manifest absent at $MANIFEST"
  _research_dir="$CONSUMER_ROOT/.ai-factory/rules-research"
  if ls "$_research_dir"/*.research.json >/dev/null 2>&1; then
    echo "    (research artefacts PRESENT under $_research_dir but synthesis emitted no manifest —"
    echo "     rule-bootstrap ran and produced nothing; inspect the 80-rule-bootstrap step output,"
    echo "     NOT the artefacts; skipped)"
  else
    echo "    (80-rule-bootstrap skipped or no research artefacts under $_research_dir —"
    echo "     zero generated rules; skipped)"
  fi
  exit "${GETFF_SKIP_RC:-0}"
fi

PASS=0; FAIL=0; SKIP=0; RULES_TESTED=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip() { SKIP=$((SKIP+1)); echo "  · $1"; }

# ─── Locate tsx + eslint ──────────────────────────────────────────────────────
TSX_BIN=""
for _t in \
  "$CONSUMER_ROOT/node_modules/.bin/tsx" \
  "$SCRIPT_DIR/../../../node_modules/.bin/tsx" \
  "$SCRIPT_DIR/../../node_modules/.bin/tsx" \
  "/app/node_modules/.bin/tsx"; do
  [ -x "$_t" ] && TSX_BIN="$_t" && break
done

ESLINT_BIN=""
for _e in \
  "$CONSUMER_ROOT/node_modules/.bin/eslint" \
  "$SCRIPT_DIR/../../../node_modules/.bin/eslint" \
  "$SCRIPT_DIR/../../node_modules/.bin/eslint" \
  "/app/node_modules/.bin/eslint"; do
  [ -x "$_e" ] && ESLINT_BIN="$_e" && break
done

if [ -z "$TSX_BIN" ] || [ -z "$ESLINT_BIN" ]; then
  skip "check-generated-rule-mutation SKIP — tsx ($([ -n "$TSX_BIN" ] && echo found || echo missing)) or eslint ($([ -n "$ESLINT_BIN" ] && echo found || echo missing)) not available"
  echo ""; echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"; exit "${GETFF_SKIP_RC:-0}"
fi

NM_SRC="$(dirname "$(dirname "$ESLINT_BIN")")"

# ─── Scratch + static probe script ────────────────────────────────────────────
SCRATCH=$(mktemp -d)
trap 'rm -rf "$SCRATCH"' EXIT
ln -sf "$NM_SRC" "$SCRATCH/node_modules"

# Probe: tests whether a selector fires on given code via no-restricted-syntax built-in.
# Env vars: PROBE_SELECTOR, PROBE_CODE
# Exit 0 = rule fired (selector matches); Exit 1 = rule did not fire; Exit 9 = error.
cat > "$SCRATCH/selector-probe.mts" << 'PROBE'
import { Linter } from 'eslint';

const selector = process.env['PROBE_SELECTOR'] ?? '';
const code     = process.env['PROBE_CODE'] ?? '';

if (!selector || !code) {
  process.stderr.write('probe: missing PROBE_SELECTOR or PROBE_CODE\n');
  process.exit(9);
}

// Generated negative inputs are TypeScript and may hold JSX (the shipped manifest's own inputs
// carry `(): void` annotations), so parse them the way the consumer's lint does: with the
// typescript-eslint parser when the consumer has it, JSX on. `files` is required — a flat-config
// object without it matches only js/mjs/cjs (see run-generated-rule-mutation.sh's probe).
let parser: unknown;
try { parser = (await import('typescript-eslint')).parser; } catch { parser = undefined; }
const linter = new Linter();
const cfg = [{
  files: ['**/*.{ts,tsx,js,jsx}'],
  rules: {
    'no-restricted-syntax': ['error' as const, { selector, message: 'mutation-probe' }],
  },
  languageOptions: {
    ecmaVersion: 2022, sourceType: 'module',
    ...(parser ? { parser } : {}),
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
}];

try {
  const msgs = linter.verify(code, cfg as never, { filename: parser ? 'probe.tsx' : 'probe.jsx' });
  // An input the parser rejects says nothing about the selector: infrastructure, not a miss.
  const fatal = msgs.find(m => m.fatal);
  if (fatal) { process.stderr.write('probe: input does not parse: ' + fatal.message + '\n'); process.exit(9); }
  process.exit(msgs.some(m => m.ruleId === 'no-restricted-syntax') ? 0 : 1);
} catch (e) {
  process.stderr.write('probe error: ' + String(e) + '\n');
  process.exit(9);
}
PROBE

# ─── Helper: run probe ────────────────────────────────────────────────────────
# Returns 0 if selector fires on code, 1 if not, 9 if error.
_probe_selector() {
  local SEL="$1" CODE="$2"
  local OUT RC
  OUT=$(cd "$SCRATCH" && PROBE_SELECTOR="$SEL" PROBE_CODE="$CODE" "$TSX_BIN" selector-probe.mts 2>&1)
  RC=$?
  if [ "$RC" -eq 9 ]; then
    # Probe error — treat as infrastructure skip
    echo "PROBE_ERR:$OUT" >&2
  fi
  return "$RC"
}

# ─── Extract rules from manifest ──────────────────────────────────────────────
# Returns JSON array: [{id, selector, negativeTestInputs}] for declarative rules with negative-test.
# critical-review S8-1 — fail closed: a manifest that does not parse used to become `[]` here and
# read as «no declarative rules … skipped», exit 0. The path travels in the environment (a `'` in a
# consumer path broke the old JS string splice the same way). A declarative rule whose negative-test
# is missing or misspelled is kept with inputs=[] so _test_rule reports it instead of it vanishing.
_rules_err=$(mktemp)
if ! RULES_JSON=$(GETFF_MUTATION_MANIFEST="$MANIFEST" node --input-type=module -e "
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync(process.env.GETFF_MUTATION_MANIFEST, 'utf8'));
if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('manifest is not a JSON object');
const rules = [];
for (const [id, rule] of Object.entries(manifest)) {
  const r = rule ?? {};
  const check = r.check ?? {};
  const selector = check.selector ?? '';
  if (!selector || check.type !== 'declarative') continue;
  // handle both 'negative-test' (hyphenated, SynthesizedRule) and 'negativeTest' (camelCase)
  const nt = r['negative-test'] ?? r['negativeTest'] ?? null;
  rules.push({ id, selector, inputs: nt && Array.isArray(nt.input) ? nt.input : [] });
}
process.stdout.write(JSON.stringify(rules));
" 2>"$_rules_err"); then
  bad "check-generated-rule-mutation: could not read the manifest $MANIFEST: $(grep -m1 -E 'Error' "$_rules_err" || head -n 1 "$_rules_err")"
  rm -f "$_rules_err"
  echo ""; echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP RULES_TESTED=0"; exit 1
fi
rm -f "$_rules_err"

RULE_COUNT=$(echo "$RULES_JSON" | node --input-type=module -e "
import { createInterface } from 'node:readline';
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  try { process.stdout.write(String(JSON.parse(chunks.join('')).length)); }
  catch { process.stdout.write('0'); }
});
" 2>/dev/null || echo '0')

if [ "$RULE_COUNT" -eq 0 ]; then
  skip "check-generated-rule-mutation: manifest has no declarative rules with negative-test inputs — skipped"
  echo ""; echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP RULES=0"; exit "${GETFF_SKIP_RC:-0}"
fi

echo "▶ check-generated-rule-mutation: testing $RULE_COUNT generated rule(s) for mutation kill-rate ≥60%"

# ─── Selector perturbation helpers (mirrors run-generated-rule-mutation.sh _mutate) ───
# Prints 11 mutated selectors to stdout, one per line.
_mutate() {
  local ORIG="$1"
  # STRUCT-1: prepend unreachable ancestor
  echo "NOMATCH_9X > ${ORIG}"
  # STRUCT-2: replace with sentinel
  echo "Program > NOMATCH_SENTINEL_9X"
  # STRUCT-3: append unmatchable attribute
  echo "${ORIG}[NOMATCH_ATTR_9X='_']"
  # STRUCT-4: replace first ' > ' child combinator with descendant (space)
  echo "$(echo "$ORIG" | sed 's/ > / /')"
  # VAL-1: prefix first quoted value
  echo "$(echo "$ORIG" | sed "s/'\\([^']*\\)'/'X_\\1'/")"
  # VAL-2: suffix first quoted value
  echo "$(echo "$ORIG" | sed "s/'\\([^']*\\)'/'\\1_Y'/")"
  # VAL-3: replace first quoted value with nomatch
  echo "$(echo "$ORIG" | sed "s/'[^']*'/'_NOMATCH_VAL_9X'/")"
  # ATTR-1: remove first [...] attribute filter (makes selector broader — can SURVIVE)
  echo "$(echo "$ORIG" | sed 's/\[[^]]*\]//')"
  # NODE-1: prefix first node-type identifier
  echo "$(echo "$ORIG" | sed 's/^\([A-Z][A-Za-z]*\)/X_\1/')"
  # NODE-2: suffix first node-type identifier
  echo "$(echo "$ORIG" | sed 's/^\([A-Z][A-Za-z]*\)/\1_Y/')"
  # LOGIC-1: negate first attribute equality  ='...' → !='...'
  echo "$(echo "$ORIG" | sed "s/='\([^']*\)'/!='\1'/")"
}

# ─── Per-rule mutation testing ─────────────────────────────────────────────────
_test_rule() {
  local RULE_ID="$1"
  local SELECTOR="$2"
  local INPUTS_JSON="$3"  # JSON array of bad input strings
  local MIN_KILL_PCT=60

  # Read inputs array into bash array — NUL-delimited end to end (critical-review S8-1 sibling).
  # The old `| tr '\x00' '\n'` never touched the NUL (BSD tr reads '\x00' as the characters
  # `x` `0` `0` and mapped every x and 0 to a newline instead), so inputs were cut at those letters,
  # the last one — lacking a newline — was dropped by `read`, and a rule with a single input took
  # the «no inputs» skip below. `read -d ''` splits on the NUL directly.
  local INPUTS=()
  while IFS= read -r -d '' _line; do
    INPUTS+=("$_line")
  done < <(node --input-type=module -e "
    const chunks = [];
    process.stdin.on('data', c => chunks.push(c));
    process.stdin.on('end', () => {
      const arr = JSON.parse(chunks.join(''));
      arr.slice(0, 3).forEach(s => process.stdout.write(String(s) + '\x00'));
    });
  " 2>/dev/null <<< "$INPUTS_JSON" || true)

  if [ "${#INPUTS[@]}" -eq 0 ]; then
    skip "[$RULE_ID] no inputs in negative-test — skipped"
    return
  fi

  # Use the first bad input for mutation tests
  local BAD_CODE="${INPUTS[0]}"

  # First verify the ORIGINAL selector fires on the bad input
  # rc is captured BEFORE branching: inside `if ! cmd; then` $? is the negation's 0, so the
  # old `[ $? -eq 9 ]` there never fired and every probe error read as a broken selector.
  local _orig_rc=0
  _probe_selector "$SELECTOR" "$BAD_CODE" || _orig_rc=$?
  if [ "$_orig_rc" -ne 0 ]; then
    if [ "$_orig_rc" -eq 9 ]; then
      skip "[$RULE_ID] probe could not evaluate the negative-test input (parse or infrastructure error) — skipped"
      return
    fi
    bad "[$RULE_ID] ORIGINAL selector did NOT fire on negative-test input (selector broken before mutation?)"
    return
  fi

  # Apply 11 semantic selector mutations (VAL/ATTR/NODE/LOGIC operators can SURVIVE
  # on weak tests, making the ≥60% kill-floor meaningful).
  local KILLED=0 TOTAL=0
  while IFS= read -r MUT; do
    [ -z "$MUT" ] && continue
    TOTAL=$((TOTAL+1))
    if _probe_selector "$MUT" "$BAD_CODE"; then
      : # still fires = SURVIVED
    else
      KILLED=$((KILLED+1))
    fi
  done < <(_mutate "$SELECTOR")

  [ "$TOTAL" -eq 0 ] && { skip "[$RULE_ID] no mutations generated — skipped"; return; }
  local KILL_PCT=$(( KILLED * 100 / TOTAL ))
  RULES_TESTED=$((RULES_TESTED+1))

  if [ "$KILL_PCT" -ge "$MIN_KILL_PCT" ]; then
    ok "[$RULE_ID] kill=$KILLED/$TOTAL (${KILL_PCT}%) ≥${MIN_KILL_PCT}% — generated test non-vacuous"
  else
    bad "[$RULE_ID] kill=$KILLED/$TOTAL (${KILL_PCT}%) <${MIN_KILL_PCT}% — generated negative-test is selector-blind (test theatre)"
  fi
}

# Parse and iterate rules
IDX=0
while true; do
  RULE_DATA=$(node --input-type=module -e "
    import { readFileSync } from 'node:fs';
    const rules = JSON.parse(process.argv[1]);
    const i = parseInt(process.argv[2]);
    if (i >= rules.length) { process.stdout.write('__END__'); process.exit(0); }
    const r = rules[i];
    // Separator: print id, selector, inputs as JSON lines
    process.stdout.write(JSON.stringify(r));
  " "$RULES_JSON" "$IDX" 2>/dev/null || echo '__END__')

  if [ "$RULE_DATA" = '__END__' ] || [ -z "$RULE_DATA" ]; then
    break
  fi

  RULE_ID=$(node --input-type=module -e "
    import { createInterface } from 'node:readline';
    const chunks = []; process.stdin.on('data', c => chunks.push(c));
    process.stdin.on('end', () => process.stdout.write(JSON.parse(chunks.join('')).id || ''));
  " <<< "$RULE_DATA" 2>/dev/null || echo '')

  RULE_SEL=$(node --input-type=module -e "
    import { createInterface } from 'node:readline';
    const chunks = []; process.stdin.on('data', c => chunks.push(c));
    process.stdin.on('end', () => process.stdout.write(JSON.parse(chunks.join('')).selector || ''));
  " <<< "$RULE_DATA" 2>/dev/null || echo '')

  RULE_INPUTS=$(node --input-type=module -e "
    import { createInterface } from 'node:readline';
    const chunks = []; process.stdin.on('data', c => chunks.push(c));
    process.stdin.on('end', () => process.stdout.write(JSON.stringify(JSON.parse(chunks.join('')).inputs || [])));
  " <<< "$RULE_DATA" 2>/dev/null || echo '[]')

  if [ -n "$RULE_ID" ] && [ -n "$RULE_SEL" ]; then
    _test_rule "$RULE_ID" "$RULE_SEL" "$RULE_INPUTS"
  fi

  IDX=$((IDX+1))
done

echo ""
echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP RULES_TESTED=$RULES_TESTED"
[ "$FAIL" -eq 0 ] || exit 1
[ "$RULES_TESTED" -gt 0 ] || exit "${GETFF_SKIP_RC:-0}"
