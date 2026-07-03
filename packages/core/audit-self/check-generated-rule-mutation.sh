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
#   - No rules with both selector + negative-test (degenerate → exit 0)
#
# NOT a CI gate — runs ONLY under FULL (--full install). MUST NOT run on CI self-install
# path (FULL unset). rc=0 on degrade, rc=1 on kill-rate failure.
#
# @cc-only-rationale: sourced by install.sh dispatcher (setup.d/99-finalize.sh); not a
#   consumer-facing npm script (mutation depth pass uses run-generated-rule-mutation.sh).
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Resolve consumer root: passed as first arg, else fall back
CONSUMER_ROOT="${1:-${AIF_PROJECT_ROOT:-$(pwd)}}"

MANIFEST="$CONSUMER_ROOT/.ai-factory/synthesizer-output/rules-manifest-additions.json"

# ─── Degrade: manifest absent ─────────────────────────────────────────────────
if [ ! -f "$MANIFEST" ]; then
  echo "  · check-generated-rule-mutation: manifest absent at $MANIFEST"
  echo "    (80-rule-bootstrap skipped or no research artefacts — zero generated rules; skipped)"
  exit 0
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
  echo ""; echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"; exit 0
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

const linter = new Linter();
const cfg = [{
  rules: {
    'no-restricted-syntax': ['error' as const, { selector, message: 'mutation-probe' }],
  },
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
}];

try {
  const msgs = linter.verify(code, cfg, { filename: 'probe.js' });
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
RULES_JSON=$(node --input-type=module -e "
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync('$MANIFEST', 'utf8'));
const rules = [];
for (const [id, rule] of Object.entries(manifest)) {
  const r = rule;
  const check = r.check ?? {};
  const selector = check.selector ?? '';
  if (!selector || check.type !== 'declarative') continue;
  // handle both 'negative-test' (hyphenated, SynthesizedRule) and 'negativeTest' (camelCase)
  const nt = r['negative-test'] ?? r['negativeTest'] ?? null;
  if (!nt || !Array.isArray(nt.input) || nt.input.length === 0) continue;
  rules.push({ id, selector, inputs: nt.input });
}
process.stdout.write(JSON.stringify(rules));
" 2>/dev/null || echo '[]')

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
  echo ""; echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP RULES=0"; exit 0
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

  # Read inputs array into bash array
  local INPUTS=()
  while IFS= read -r _line; do
    INPUTS+=("$_line")
  done < <(node --input-type=module -e "
    import { createInterface } from 'node:readline';
    const chunks = [];
    process.stdin.on('data', c => chunks.push(c));
    process.stdin.on('end', () => {
      const arr = JSON.parse(chunks.join(''));
      arr.forEach(s => process.stdout.write(s + '\x00'));
    });
  " 2>/dev/null <<< "$INPUTS_JSON" | tr '\x00' '\n' | head -3 || true)

  if [ "${#INPUTS[@]}" -eq 0 ]; then
    skip "[$RULE_ID] no inputs in negative-test — skipped"
    return
  fi

  # Use the first bad input for mutation tests
  local BAD_CODE="${INPUTS[0]}"

  # First verify the ORIGINAL selector fires on the bad input
  if ! _probe_selector "$SELECTOR" "$BAD_CODE"; then
    if [ $? -eq 9 ]; then
      skip "[$RULE_ID] probe infrastructure error — skipped"
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
[ "$FAIL" -eq 0 ]
