#!/usr/bin/env bash
# run-generated-rule-mutation.sh — on-demand depth mutation pass for generated ESLint rules.
#
# ADAPT of run-bash-mutation.sh discipline (SSOT #91): instead of universalmutator on bash
# hooks, applies deterministic selector perturbations to generated declarative rules and
# measures kill rate vs the ≥60% floor. On-demand LOCAL only — not wired into CI or
# validate (matches run-bash-mutation.sh's SESSION-BOUND delivery channel).
#
# Reads from: .ai-factory/synthesizer-output/rules-manifest-additions.json
# Consumer npm surface: "test:mutation:generated" (wired by setup.d/70-deps.sh).
#
# Mutation set (11 perturbations per rule — superset of install-time gate's 3):
#   STRUCT-1  Prepend unreachable ancestor      "NOMATCH_9X > <original>"
#   STRUCT-2  Replace with sentinel             "Program > NOMATCH_SENTINEL_9X"
#   STRUCT-3  Append unmatchable attribute      "<original>[NOMATCH_ATTR_9X='_']"
#   STRUCT-4  Swap combinator to descendant     "> " → " " in first combinator
#   VAL-1     Prefix first quoted value         'X_<value>'
#   VAL-2     Suffix first quoted value         '<value>_Y'
#   VAL-3     Replace first quoted value        '_NOMATCH_VAL_9X'
#   ATTR-1    Remove first attribute filter     strip first [...]
#   NODE-1    Prefix first node type            'X_<NodeType>'
#   NODE-2    Suffix first node type            '<NodeType>_Y'
#   LOGIC-1   Negate first attribute            [attr='val'] → [attr!='val']
#
# exit 0 = all rules ≥60% kill; exit 1 = below floor (surviving mutants indicate gaps).
# @cc-only-rationale: local dev tool, same axis as run-bash-mutation.sh.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# ─── Args ────────────────────────────────────────────────────────────────────
# Optional: explicit manifest path; defaults to consumer root manifest
MANIFEST="${1:-$REPO_ROOT/.ai-factory/synthesizer-output/rules-manifest-additions.json}"
MIN_KILL="${2:-60}"

die() { echo "run-generated-rule-mutation: $*" >&2; exit 2; }

[ -f "$MANIFEST" ] || die "manifest not found: $MANIFEST (run ./setup --full first)"

# ─── Locate tsx + eslint ──────────────────────────────────────────────────────
TSX_BIN=""
for _t in \
  "$REPO_ROOT/node_modules/.bin/tsx" \
  "$REPO_ROOT/packages/core/node_modules/.bin/tsx" \
  "/app/node_modules/.bin/tsx"; do
  [ -x "$_t" ] && TSX_BIN="$_t" && break
done
[ -n "$TSX_BIN" ] || die "tsx not found — run npm install"

ESLINT_BIN=""
for _e in \
  "$REPO_ROOT/node_modules/.bin/eslint" \
  "$REPO_ROOT/packages/core/node_modules/.bin/eslint" \
  "/app/node_modules/.bin/eslint"; do
  [ -x "$_e" ] && ESLINT_BIN="$_e" && break
done
[ -n "$ESLINT_BIN" ] || die "eslint not found — run npm install"

NM_SRC="$(dirname "$(dirname "$ESLINT_BIN")")"

# ─── Scratch + probe script ────────────────────────────────────────────────────
SCRATCH=$(mktemp -d)
trap 'rm -rf "$SCRATCH"' EXIT
ln -sf "$NM_SRC" "$SCRATCH/node_modules"

cat > "$SCRATCH/selector-probe.mts" << 'PROBE'
import { Linter } from 'eslint';
const selector = process.env['PROBE_SELECTOR'] ?? '';
const code     = process.env['PROBE_CODE'] ?? '';
if (!selector || !code) { process.stderr.write('missing env\n'); process.exit(9); }
const linter = new Linter();
const cfg = [{ rules: { 'no-restricted-syntax': ['error' as const, { selector, message: 'depth-mutation-probe' }] }, languageOptions: { ecmaVersion: 2022, sourceType: 'module' } }];
try {
  const msgs = linter.verify(code, cfg, { filename: 'probe.ts' });
  process.exit(msgs.some(m => m.ruleId === 'no-restricted-syntax') ? 0 : 1);
} catch (e) { process.stderr.write(String(e) + '\n'); process.exit(9); }
PROBE

_probe() {
  local SEL="$1" CODE="$2"
  cd "$SCRATCH" && PROBE_SELECTOR="$SEL" PROBE_CODE="$CODE" "$TSX_BIN" selector-probe.mts 2>/dev/null
  return $?
}

# ─── Selector perturbation helpers ───────────────────────────────────────────
_mutate() {
  local ORIG="$1"
  # STRUCT-1: prepend unreachable ancestor
  echo "NOMATCH_9X > ${ORIG}"
  # STRUCT-2: replace with sentinel
  echo "Program > NOMATCH_SENTINEL_9X"
  # STRUCT-3: append unmatchable attribute
  echo "${ORIG}[NOMATCH_ATTR_9X='_']"
  # STRUCT-4: replace first child combinator '>' with descendant (space)
  echo "$(echo "$ORIG" | sed 's/ > / /' )"
  # VAL-1: prefix first quoted value
  echo "$(echo "$ORIG" | sed "s/'\\([^']*\\)'/'X_\\1'/")"
  # VAL-2: suffix first quoted value
  echo "$(echo "$ORIG" | sed "s/'\\([^']*\\)'/'\\1_Y'/")"
  # VAL-3: replace first quoted value with nomatch
  echo "$(echo "$ORIG" | sed "s/'[^']*'/'_NOMATCH_VAL_9X'/")"
  # ATTR-1: remove first [...] attribute filter
  echo "$(echo "$ORIG" | sed 's/\[[^]]*\]//')"
  # NODE-1: prefix first node type identifier
  echo "$(echo "$ORIG" | sed 's/^\([A-Z][A-Za-z]*\)/X_\1/')"
  # NODE-2: suffix first node type identifier
  echo "$(echo "$ORIG" | sed 's/^\([A-Z][A-Za-z]*\)/\1_Y/')"
  # LOGIC-1: negate first attribute equality ='...' → !='...'
  echo "$(echo "$ORIG" | sed "s/='\([^']*\)'/!='\1'/" )"
}

# ─── Extract rules from manifest ──────────────────────────────────────────────
RULES_JSON=$(node --input-type=module -e "
  import { readFileSync } from 'node:fs';
  const m = JSON.parse(readFileSync('$MANIFEST', 'utf8'));
  const rules = [];
  for (const [id, rule] of Object.entries(m)) {
    const r = rule;
    const check = r.check ?? {};
    const selector = check.selector ?? '';
    if (!selector || check.type !== 'declarative') continue;
    const nt = r['negative-test'] ?? r['negativeTest'] ?? null;
    if (!nt || !Array.isArray(nt.input) || !nt.input.length) continue;
    rules.push({ id, selector, inputs: nt.input });
  }
  process.stdout.write(JSON.stringify(rules));
" 2>/dev/null || echo '[]')

RULE_COUNT=$(node --input-type=module -e "
  const chunks = [];
  process.stdin.on('data', c => chunks.push(c));
  process.stdin.on('end', () => process.stdout.write(String(JSON.parse(chunks.join('')).length)));
" <<< "$RULES_JSON" 2>/dev/null || echo '0')

if [ "$RULE_COUNT" -eq 0 ]; then
  echo "No declarative rules with negative-test inputs in manifest — nothing to test."
  exit 0
fi

echo "=== generated rule mutation: ${RULE_COUNT} rule(s), floor=${MIN_KILL}% ==="
echo "manifest: $MANIFEST"
echo

OVERALL_KILLED=0; OVERALL_TOTAL=0; OVERALL_FAIL=0

# Iterate rules
IDX=0
while true; do
  RULE_DATA=$(node --input-type=module -e "
    const rules = JSON.parse(process.argv[1]);
    const i = parseInt(process.argv[2]);
    if (i >= rules.length) { process.stdout.write('__END__'); process.exit(0); }
    process.stdout.write(JSON.stringify(rules[i]));
  " "$RULES_JSON" "$IDX" 2>/dev/null || echo '__END__')
  [ "$RULE_DATA" = '__END__' ] || [ -z "$RULE_DATA" ] && break

  RULE_ID=$(node --input-type=module -e "const c=[]; process.stdin.on('data',d=>c.push(d)); process.stdin.on('end',()=>process.stdout.write(JSON.parse(c.join('')).id||''));" <<< "$RULE_DATA" 2>/dev/null || echo '')
  RULE_SEL=$(node --input-type=module -e "const c=[]; process.stdin.on('data',d=>c.push(d)); process.stdin.on('end',()=>process.stdout.write(JSON.parse(c.join('')).selector||''));" <<< "$RULE_DATA" 2>/dev/null || echo '')
  RULE_INPUT=$(node --input-type=module -e "const c=[]; process.stdin.on('data',d=>c.push(d)); process.stdin.on('end',()=>{ const r=JSON.parse(c.join('')); process.stdout.write((r.inputs||[])[0]||''); });" <<< "$RULE_DATA" 2>/dev/null || echo '')

  [ -z "$RULE_ID" ] || [ -z "$RULE_SEL" ] || [ -z "$RULE_INPUT" ] && { IDX=$((IDX+1)); continue; }

  echo "--- $RULE_ID ---"
  echo "selector: $RULE_SEL"

  # Verify original fires
  if ! _probe "$RULE_SEL" "$RULE_INPUT"; then
    echo "  WARN: original selector did NOT fire on negative-test input — skipping rule"
    IDX=$((IDX+1)); continue
  fi

  KILLED=0; SURVIVED=0; SURVIVORS=()
  while IFS= read -r MUT; do
    [ -z "$MUT" ] && continue
    if _probe "$MUT" "$RULE_INPUT"; then
      SURVIVED=$((SURVIVED+1))
      SURVIVORS+=("$MUT")
    else
      KILLED=$((KILLED+1))
    fi
  done < <(_mutate "$RULE_SEL")

  TOTAL=$((KILLED+SURVIVED))
  [ "$TOTAL" -eq 0 ] && { IDX=$((IDX+1)); continue; }

  KILL_PCT=$((KILLED * 100 / TOTAL))
  OVERALL_KILLED=$((OVERALL_KILLED+KILLED))
  OVERALL_TOTAL=$((OVERALL_TOTAL+TOTAL))

  echo "  kill: $KILLED/$TOTAL (${KILL_PCT}%)"

  if [ "$KILL_PCT" -ge "$MIN_KILL" ]; then
    echo "  ✓ ≥${MIN_KILL}% — non-vacuous"
  else
    echo "  ✗ <${MIN_KILL}% — generated negative-test is selector-blind"
    OVERALL_FAIL=$((OVERALL_FAIL+1))
    if [ "${#SURVIVORS[@]}" -gt 0 ]; then
      echo "  Surviving mutations (test did not detect these breakages):"
      for S in "${SURVIVORS[@]}"; do
        echo "    - $S"
      done
    fi
  fi
  echo

  IDX=$((IDX+1))
done

# ─── Summary ─────────────────────────────────────────────────────────────────
if [ "$OVERALL_TOTAL" -gt 0 ]; then
  OVERALL_PCT=$((OVERALL_KILLED * 100 / OVERALL_TOTAL))
  echo "=== overall: kill=$OVERALL_KILLED/$OVERALL_TOTAL (${OVERALL_PCT}%) floor=${MIN_KILL}% ==="
fi

if [ "$OVERALL_FAIL" -gt 0 ]; then
  echo "FAIL — $OVERALL_FAIL rule(s) below kill-rate floor"
  exit 1
else
  echo "PASS — all generated rules ≥${MIN_KILL}% kill rate"
  exit 0
fi
