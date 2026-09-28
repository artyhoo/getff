#!/usr/bin/env bash
# own-config-known-rot.test.sh — the own-config cell's KNOWN ROT matchers (tests/consumer-matrix/known-rot.sh)
# must name ONLY the rot they were written for. A matcher that also swallows a neighbouring failure
# turns the merge-blocking cell green on a real regression, so every positive below has negatives
# one mutation away. The logs are the shapes measured on the four cells on 2026-09-28 (tsc via
# `npm run typecheck`, vitest 4.1.11 via `npm test`, colour codes included).
set -uo pipefail
LIB="$(cd "$(dirname "$0")/../consumer-matrix" && pwd)/known-rot.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

[ -f "$LIB" ] || { echo "  ✗ tests/consumer-matrix/known-rot.sh is missing"; echo "PASS=0 FAIL=1"; exit 1; }
# shellcheck source=tests/consumer-matrix/known-rot.sh
. "$LIB"

T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT INT TERM
E=$'\x1b'

expect() { # $1 = stack, $2 = step, $3 = log file, $4 = wanted id ("" = none), $5 = label
  local got
  got=$(STACK="$1" known_rot_for "$2" "$3")
  if [ "$got" = "$4" ]; then ok "$5"; else bad "$5 (wanted '${4:-none}', got '${got:-none}')"; fi
}

# ── K2: tsc rejects the preset vitest.config.ts over test.poolOptions ─────────────────────────
cat > "$T/k2.log" <<'LOG'

> own-config-consumer@0.0.0 typecheck
> tsc --noEmit

vitest.config.ts(62,5): error TS2769: No overload matches this call.
  The last overload gave the following error.
    Object literal may only specify known properties, and 'poolOptions' does not exist in type 'InlineConfig'.
LOG
expect ts-server typecheck "$T/k2.log" K2 "K2: the poolOptions overload error alone is known rot (ts-server typecheck)"
expect react-next build "$T/k2.log" K2 "K2: same on react-next build"
expect react-native typecheck "$T/k2.log" "" "K2 does not apply to a stack it does not name (react-native)"
expect ts-server lint "$T/k2.log" "" "K2 does not apply to a step it does not name (lint)"

{ cat "$T/k2.log"; echo "lib/answer.ts(2,3): error TS2322: Type 'string' is not assignable to type 'number'."; } > "$T/k2-plus.log"
expect ts-server typecheck "$T/k2-plus.log" "" "K2 + one more tsc error is a plain FAIL, not rot"

sed "s/'poolOptions'/'pool'/" "$T/k2.log" > "$T/k2-other.log"
expect ts-server typecheck "$T/k2-other.log" "" "a TS2769 in vitest.config.ts about another key is not K2"

sed 's/^vitest.config.ts(62,5)/eslint.config.mjs(62,5)/' "$T/k2.log" > "$T/k2-file.log"
expect ts-server typecheck "$T/k2-file.log" "" "the same error in another file is not K2"

printf '\n> x@0.0.0 typecheck\n> tsc --noEmit\n\nnpm error Lifecycle script failed\n' > "$T/k2-none.log"
expect ts-server typecheck "$T/k2-none.log" "" "a red typecheck with no tsc error at all is not K2"

# ── K4: the ts-server vitest.config.ts only collects *.unit.ts / *.audit.ts ───────────────────
k4_log() { # $1 = the include line's globs
  printf '\n> own-config-consumer@0.0.0 test\n> vitest run\n\n'
  # shellcheck disable=SC2016 # the backticks are vitest's own output, not an expansion
  printf '%s[1m%s[43m DEPRECATED %s[49m%s[22m `test.poolOptions` was removed in Vitest 4.\n\n' "$E" "$E" "$E" "$E"
  printf '%s[31mNo test files found, exiting with code 1\n%s[39m\n' "$E" "$E"
  printf '%s[2minclude: %s[22m%s[33m%s%s[39m\n' "$E" "$E" "$E" "$1" "$E"
  printf '%s[2mexclude:  %s[22m%s[33m**/*.integration.ts, **/node_modules/**%s[39m\n' "$E" "$E" "$E" "$E"
}
k4_log 'lib/**/*.unit.ts, lib/**/*.audit.ts, tests/**/*.unit.ts, tests/**/*.audit.ts' > "$T/k4.log"
expect ts-server test "$T/k4.log" K4 "K4: no files found, include reaches lib/ with *.unit/*.audit naming only"
expect react-next test "$T/k4.log" "" "K4 does not apply to react-next"

grep -v 'No test files found' "$T/k4.log" > "$T/k4-nomsg.log"
expect ts-server test "$T/k4-nomsg.log" "" "the same include listing without «No test files found» is not K4"

k4_log 'src/**/*.unit.ts, src/**/*.audit.ts, tests/**/*.unit.ts, tests/**/*.audit.ts' > "$T/k4-src.log"
expect ts-server test "$T/k4-src.log" "" "include still anchored on src/ (the layout rewrite regressed) is NOT K4"

k4_log 'lib/**/*.unit.ts, lib/**/*.{test,spec}.ts' > "$T/k4-test.log"
expect ts-server test "$T/k4-test.log" "" "an include that already collects *.test.ts is not K4"

{ k4_log 'lib/**/*.unit.ts, lib/**/*.audit.ts'; printf ' FAIL  lib/x.unit.ts > y\nAssertionError: expected 1 to be 2\n'; } > "$T/k4-fail.log"
expect ts-server test "$T/k4-fail.log" "" "a real failing test next to the message is not K4"

printf '\n> x@0.0.0 test\n> vitest run\n\n FAIL  lib/answer.test.ts\nError: boom\n' > "$T/k4-none.log"
expect ts-server test "$T/k4-none.log" "" "a red test run that found files is not K4"

echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
