#!/usr/bin/env bash
# critical-review S8-1 (sibling) — the install-time gate audit-self/check-generated-rule-mutation.sh
# read the manifest with `2>/dev/null || echo '[]'` and a raw `'$MANIFEST'` splice into JS. A
# manifest that did not parse — or a consumer path holding a `'` — became «no declarative rules …
# skipped», exit 0: the self-verify line stayed green on material it never read.
#
# ARMS:
#   (A) unparseable manifest → exit non-zero, FAIL line names the manifest
#   (B) a valid manifest under a path with a `'` is read AND its rule is actually tested — the
#       old NUL→newline `tr` was a no-op, so before the fix every rule took the «no inputs» skip
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
GATE="$REPO_ROOT/packages/core/audit-self/check-generated-rule-mutation.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

if [ ! -x "$REPO_ROOT/node_modules/.bin/eslint" ] || [ ! -x "$REPO_ROOT/node_modules/.bin/tsx" ]; then
  echo "  · tsx/eslint not installed at $REPO_ROOT/node_modules/.bin — the gate would skip before reading the manifest"
  echo ""; echo "PASS=$PASS FAIL=$FAIL (SKIPPED: no tsx/eslint)"; exit 1
fi

newroot() { local d; d=$(mktemp -d "${TMPDIR:-/tmp}/grm-$1-XXXXXX"); mkdir -p "$d/.ai-factory/synthesizer-output"; printf '%s\n' "$d"; }

# ── (A) unparseable manifest ──
R=$(newroot broken)
printf '{ "rule-a": { "check": ' > "$R/.ai-factory/synthesizer-output/rules-manifest-additions.json"
_out=$(bash "$GATE" "$R" 2>&1); _rc=$?
[ "$_rc" -ne 0 ] && ok "(A) unparseable manifest → exit $_rc (fails closed)" || bad "(A) unparseable manifest → exit 0 (got: $_out)"
echo "$_out" | grep -q 'could not read the manifest' && ok "(A) the FAIL line says the manifest could not be read" || bad "(A) no 'could not read the manifest' line"
rm -rf "$R"

# ── (B) quote in the path ──
R=$(newroot "o'quote")
cat > "$R/.ai-factory/synthesizer-output/rules-manifest-additions.json" <<'JSON'
{ "rule-live": { "check": { "type": "declarative", "selector": "MemberExpression[object.name='localStorage']" },
  "negative-test": { "input": ["localStorage.getItem('token');"] } } }
JSON
_out=$(bash "$GATE" "$R" 2>&1); _rc=$?
echo "$_out" | grep -q 'RULES_TESTED=1' && ok "(B) manifest under a path with a quote was read; its rule was tested" || bad "(B) the rule was not tested (rc=$_rc, got: $_out)"
rm -rf "$R"

# ── (C)/(D) typed and JSX inputs are parsed — the shipped manifest's negative inputs are
#    TypeScript (`function send(): void {…}`); the probe used the default JS parser, so a
#    correct rule read as «ORIGINAL selector did NOT fire» once the gate started testing rules ──
gate_one() { # <label> <selector> <input-json-string>
  local R; R=$(newroot "$1")
  printf '{ "rule-%s": { "check": { "type": "declarative", "selector": %s }, "negative-test": { "input": [%s] } } }\n' \
    "$1" "$2" "$3" > "$R/.ai-factory/synthesizer-output/rules-manifest-additions.json"
  _out=$(bash "$GATE" "$R" 2>&1); _rc=$?
  rm -rf "$R"
}
gate_one ts '"CallExpression[callee.name='"'"'fetch'"'"']"' '"function send(): void { fetch('"'"'/x'"'"'); }"'
echo "$_out" | grep -q 'RULES_TESTED=1' && ok "(C) a TypeScript negative input is parsed and its rule tested" || bad "(C) TypeScript input not tested (rc=$_rc, got: $_out)"
gate_one jsx '"JSXIdentifier[name='"'"'head'"'"']"' '"export const H = () => <head />;"'
echo "$_out" | grep -q 'RULES_TESTED=1' && ok "(D) a JSX negative input is parsed and its rule tested" || bad "(D) JSX input not tested (rc=$_rc, got: $_out)"

# ── (E) an input that does not parse is a probe-infrastructure skip, never a «selector broken»
#    FAIL: `if ! _probe …; then [ $? -eq 9 ]` always read 0, so the skip branch was dead ──
gate_one unparse '"Identifier"' '"const = ;"'
echo "$_out" | grep -q 'did NOT fire' && bad "(E) unparseable input reported as a broken selector (got: $_out)" || ok "(E) unparseable input is not reported as a broken selector"
echo "$_out" | grep -q 'skipped' && ok "(E) unparseable input is reported as skipped" || bad "(E) unparseable input not reported as skipped (got: $_out)"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
