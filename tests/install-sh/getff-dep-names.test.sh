#!/usr/bin/env bash
# getff-dep-names.test.sh — P6 run 3, N7 (operator decision 2026-09-30): getff's own dependencies are a
# fixed set per stack, so their MCP servers are decided once in getff. P3's vendor-MCP lookup skips
# them, whoever added them to package.json, reading getff_dep_names (setup.d/lib.sh). Before: a re-run
# read getff's own @playwright/test as the project's and added an unpinned `npx -y @playwright/mcp`.
# The set has one home, the five dependency arrays of setup.d/70-deps.sh; the helper reads them.
#   (1) exit 0 with a bare environment (lib.sh sourced alone, as install.sh:61 does before any layer)
#   (2) bare names only: no version spec, a scoped name keeps its scope
#   (3) sorted, one per line, unique
#   (4) every array is read, whatever the stack: a name only CORE, only react-next, only react-spa,
#       only react-native and only the runtime array carries
#   (5) the count matches the arrays' distinct names, counted here without bash's parser
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

out=$(env -i PATH="$PATH" bash -c 'set -uo pipefail; . "$1/setup.d/lib.sh"; getff_dep_names' _ "$REPO_ROOT" 2>&1); rc=$?
[ "$rc" -eq 0 ] && [ -n "$out" ] && ok "(1) getff_dep_names exits 0 with lib.sh alone and prints names" || bad "(1) rc=$rc: ${out:0:200}"

grep -qE '^.+@' <<<"$out" && bad "(2) a version spec is left: $(grep -E '^.+@' <<<"$out" | head -3 | tr '\n' ' ')" \
  || ok "(2) no version spec is left"
grep -qx '@playwright/test' <<<"$out" && grep -qx 'eslint' <<<"$out" \
  && ok "(2) a scoped name keeps its scope (@playwright/test), a pinned one loses its pin (eslint@^9 → eslint)" \
  || bad "(2) @playwright/test or eslint missing"

[ "$out" = "$(sort -u <<<"$out")" ] && ! grep -qx '' <<<"$out" && ok "(3) sorted, unique, one per line, no empty line" \
  || bad "(3) not sorted-unique, or an empty line (a name lost whole)"

for n in typescript @storybook/nextjs-vite eslint-plugin-boundaries eslint-config-expo zod; do
  grep -qxF "$n" <<<"$out" && ok "(4) $n is in the set" || bad "(4) $n is missing"
done

# The arrays' tokens, counted by text alone (awk, not the helper's sed): every token inside the five array blocks.
want=$(awk '/^(CORE_DEVDEPS|REACT_DEVDEPS|REACT_SPA_DEVDEPS|REACT_NATIVE_DEVDEPS|CORE_RUNTIME_DEPS)=\(/{f=1; sub(/^[A-Z_]+=\(/,"")}
  f{ e=/\)[[:space:]]*$/; sub(/\)[[:space:]]*$/,""); for(i=1;i<=NF;i++) print $i; if(e) f=0 }' "$REPO_ROOT/setup.d/70-deps.sh" \
  | awk '{ n = $0; if (substr(n, 1, 1) == "@") { i = index(substr(n, 2), "@"); if (i) n = substr(n, 1, i) }
           else { i = index(n, "@"); if (i) n = substr(n, 1, i - 1) } print n }' | sort -u)
[ "$(wc -l <<<"$out")" -eq "$(wc -l <<<"$want")" ] && [ "$out" = "$want" ] \
  && ok "(5) the set is exactly the arrays' $(wc -l <<<"$want" | tr -d ' ') distinct names" \
  || bad "(5) differs from the arrays: $(diff <(echo "$want") <(echo "$out") | head -4 | tr '\n' ' ')"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
