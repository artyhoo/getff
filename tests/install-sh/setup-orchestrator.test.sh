#!/usr/bin/env bash
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
SETUP="$REPO_ROOT/setup"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

[ -x "$SETUP" ] && ok "setup is executable" || bad "setup not executable"
bash -n "$SETUP" && ok "setup parses" || bad "setup has syntax error"

# --dry-run in a throwaway project writes nothing and prints preflight + summary
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
( cd "$TMP" && echo '{}' > package.json && bash "$SETUP" ts-server --dry-run >out.txt 2>&1 )
grep -qi 'preflight' "$TMP/out.txt" && ok "preflight ran" || bad "no preflight"
grep -qi 'dry-run' "$TMP/out.txt" && ok "dry-run acknowledged" || bad "dry-run not acknowledged"
[ ! -f "$TMP/AGENTS.md" ] && ok "dry-run wrote nothing" || bad "dry-run wrote files"

# Parse-proof assertions (plan Task 5 Manifest-parse note: verify the field-splitter
# against the REAL companions.manifest rows — tab-delimited, inner pipes in detect_cmd).
grep -qi 'superpowers' "$TMP/out.txt" && ok "manifest row parsed through engine (superpowers in output)" || bad "superpowers absent from output — manifest row did not reach engine"
! grep -qi 'command not found' "$TMP/out.txt" && ok "parser produced no garbage commands" || bad "parser produced garbage commands (command not found in output)"

# getff-ai-site S0a (face spec §10 item 2, E3): `setup` learns cargo|go. install.sh already routes
# the three non-npm toolchain lanes (install.sh:166-172 python|cargo|go → TOOLCHAIN); the wrapper's
# positional case only forwarded python, so `./setup cargo` silently fell through to npm stack
# auto-detect — two command shapes for one positional, exactly what E3 exists to prevent. python is
# the CONTROL (already routed before this stage); cargo/go must reach their toolchain lanes too.
# --dry-run keeps every arm write-free (copy_safe/refresh_safe no-op under DRY_RUN, lib.sh:854 / :1192).
for lane in python cargo go; do
  LANE_OUT=$( cd "$TMP" && bash "$SETUP" "$lane" --dry-run 2>&1 )
  echo "$LANE_OUT" | grep -q 'toolchain' \
    && ok "setup $lane routes to the toolchain lane" \
    || bad "setup $lane never reached the toolchain lane (fell through to npm auto-detect)"
done
[ ! -f "$TMP/clippy.toml" ] && [ ! -f "$TMP/.golangci.yml" ] \
  && ok "lane dry-runs wrote nothing" || bad "lane dry-run wrote lane configs"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
