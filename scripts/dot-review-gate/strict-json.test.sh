#!/usr/bin/env bash
# Paired-negative for scripts/dot-review-gate/strict-json.mjs.
#
# The Dot report arrives as untrusted bytes from an authenticated browser session.
# JSON.parse silently collapses duplicate keys (last wins) — a report that claims
# "verdict":"GO" and also "verdict":"STOP" parses to whichever came last, so the
# contract requires rejecting it outright. Same pass enforces the spec §7 bounds:
# payload ≤ 1 MiB, nesting ≤ 64 levels.
#
# GREEN arms: valid documents parse; results equal JSON.parse's.
# RED arms: each rejection direction fires with a code naming the reason.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
MOD="$DIR/strict-json.mjs"

fails=0
expect_ok() { # name, json-text, [expected-serialized-value]
  local name="$1" text="$2" want="${3:-}"
  local out
  out=$(node --input-type=module -e "
import { parseStrictJson } from '$MOD';
const v = parseStrictJson(process.argv[1]);
console.log('OK:' + JSON.stringify(v));
" "$text" 2>&1)
  if [[ "$out" != OK:* ]]; then
    echo "FAIL[$name] expected parse OK, got: $out"; fails=$((fails+1)); return
  fi
  if [[ -n "$want" && "${out#OK:}" != "$want" ]]; then
    echo "FAIL[$name] value mismatch: want $want got ${out#OK:}"; fails=$((fails+1)); return
  fi
  echo "ok[$name]"
}

expect_reject() { # name, json-text, expected-code-substring
  local name="$1" text="$2" code="$3"
  local out
  out=$(node --input-type=module -e "
import { parseStrictJson } from '$MOD';
try { parseStrictJson(process.argv[1]); console.log('ACCEPTED (bad)'); }
catch (e) { console.log('REJECTED:' + (e.code || '') + ':' + e.message); }
" "$text" 2>&1)
  if [[ "$out" != REJECTED:* ]]; then
    echo "FAIL[$name] expected rejection, got: $out"; fails=$((fails+1)); return
  fi
  if [[ "$out" != *"$code"* ]]; then
    echo "FAIL[$name] wrong reason, wanted '$code' in: $out"; fails=$((fails+1)); return
  fi
  echo "ok[$name]"
}

# ── GREEN: valid shapes parse identically to JSON.parse ──────────────────────
expect_ok object       '{"a":1,"b":[true,null,"x"]}' '{"a":1,"b":[true,null,"x"]}'
expect_ok nested       '{"r":{"d":{"deep":{"v":1}}}}' '{"r":{"d":{"deep":{"v":1}}}}'
expect_ok unicode      '"café"'
expect_ok escapes      '"a\"b\\c\n"' '"a\"b\\c\n"'
expect_ok empty-obj    '{}' '{}'
expect_ok number-zero  '0' '0'
expect_ok exp-number   '1e2' '100'

# ── RED: duplicate keys rejected (the load-bearing direction) ────────────────
expect_reject dup-top      '{"verdict":"GO","verdict":"STOP"}' 'DUP_KEY'
expect_reject dup-nested   '{"a":{"x":1,"x":2}}' 'DUP_KEY'
expect_reject dup-in-array '[{"k":1},{"k":2,"k":3}]' 'DUP_KEY'
expect_reject dup-deep     '{"a":{"b":{"c":1,"c":2}}}' 'DUP_KEY'

# ── RED: prototype inheritance is not a data shape (review R7) ───────────────
# obj[key] = value with key __proto__ invokes the prototype setter: the parsed
# "report" would carry its real fields on Object.prototype, where schema validation
# still sees them through property access. Both policy layers reject it: the key is
# refused outright, and parsed objects are prototype-free so nothing inherits.
expect_reject proto-root      '{"__proto__":{"injected":true}}'  'PROTO_KEY'
expect_reject proto-nested    '{"a":{"__proto__":1}}'            'PROTO_KEY'
expect_reject proto-report-wrap '{"__proto__":{"kind":"admission","verdict":"GO"}}' 'PROTO_KEY'

node --input-type=module - "$MOD" <<'NODE' || fails=$((fails+1))
const [modPath] = process.argv.slice(2);
const { parseStrictJson } = await import(modPath);
const t = (name, cond) => { if (!cond) { console.log(`FAIL[${name}]`); process.exitCode = 1; } else console.log(`ok[${name}]`); };
const v = parseStrictJson('{"a":{"b":[1,{"c":2}]}}');
t('null-proto-root', Object.getPrototypeOf(v) === null);
t('null-proto-nested', Object.getPrototypeOf(v.a) === null && Object.getPrototypeOf(v.a.b[1]) === null);
t('no-inherited-props', v.toString === undefined && v.a.toString === undefined && v.a.b[1].valueOf === undefined);
t('roundtrip', JSON.stringify(v) === '{"a":{"b":[1,{"c":2}]}}');
NODE

# ── RED: bounds ───────────────────────────────────────────────────────────────
# depth limit counts container nesting: 64 containers accepted, 65 rejected
node --input-type=module - "$MOD" <<'NODE' || fails=$((fails+1))
const [modPath] = process.argv.slice(2);
const { parseStrictJson } = await import(modPath);
const open64 = '{"a":'.repeat(64);
const close64 = '}'.repeat(64);
const open65 = '{"a":'.repeat(65);
const close65 = '}'.repeat(65);
try { parseStrictJson(open64 + '1' + close64); console.log('ok[depth-64-exactly]'); }
catch (e) { console.log(`FAIL[depth-64-exactly] ${e.message}`); process.exitCode = 1; }
try { parseStrictJson(open65 + '1' + close65); console.log('FAIL[depth-65] accepted'); process.exitCode = 1; }
catch (e) { if (e.code === 'DEPTH') console.log('ok[depth-65]'); else { console.log(`FAIL[depth-65] wrong reason ${e.message}`); process.exitCode = 1; } }
NODE

# byte cap (generated in-process — a 1 MiB literal busts the shell ARG_MAX)
node --input-type=module - "$MOD" <<'NODE' || fails=$((fails+1))
const [modPath] = process.argv.slice(2);
const { parseStrictJson } = await import(modPath);
const big = '"' + 'a'.repeat(1024 * 1024) + '"';
try { parseStrictJson(big); console.log('FAIL[size-over] accepted'); process.exitCode = 1; }
catch (e) { if (e.code === 'SIZE') console.log('ok[size-over]'); else { console.log(`FAIL[size-over] wrong reason ${e.message}`); process.exitCode = 1; } }
NODE
expect_reject trailing      '{"a":1} {"b":2}' 'TRAILING'
expect_reject truncated     '{"a":' 'PARSE'
expect_reject not-json      'review: ship it' 'PARSE'
expect_reject bom           $'\xef\xbb\xbf{"a":1}' 'BOM'

echo "----"
if [[ $fails -gt 0 ]]; then echo "FAILURES: $fails"; exit 1; fi
echo "strict-json.test.sh: all green"
