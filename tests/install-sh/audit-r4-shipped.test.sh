#!/usr/bin/env bash
# consumer-install-hardening S1 — F6: install.sh must ship the R4 probe so the caller resolves.
# The shipped scripts/audit-ai-docs.sh runs `npx --no-install tsx scripts/audit-r4.ts`; without
# the probe file that line hard-fails on a missing file. This test runs the REAL full pipeline
# (lib-only mode does not expose copy_safe — see install-sh harness note) and asserts:
#   F6-pos: scripts/audit-r4.ts lands in the consumer.
#   F6-neg (load-bearing): the caller actually references scripts/audit-r4.ts — proves the file
#           is the thing the audit needs, so shipping it isn't vacuous.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

T=$(mktemp -d)
printf '{ "name": "f6t", "version": "0.0.0" }\n' > "$T/package.json"
( cd "$T" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force ) >/dev/null 2>&1
RC_P50_001=$?
if [ "$RC_P50_001" -eq 0 ]; then ok "audit-r4-shipped: install rc=0 (p50-001)"; else bad "audit-r4-shipped: install rc=$RC_P50_001, expected 0 (p50-001)"; fi

# F6-pos — the R4 probe lands next to its caller.
[ -f "$T/scripts/audit-r4.ts" ] && ok "F6: scripts/audit-r4.ts shipped" || bad "F6: scripts/audit-r4.ts missing"

# F6-neg (load-bearing) — the shipped caller invokes exactly this file. If the audit script
# stops calling audit-r4.ts, this arm fails and the fix is revealed as no longer needed.
grep -q 'scripts/audit-r4\.ts' "$T/scripts/audit-ai-docs.sh" \
  && ok "F6-neg: shipped audit-ai-docs.sh references scripts/audit-r4.ts (fix is load-bearing)" \
  || bad "F6-neg: caller no longer references audit-r4.ts — fix may be vacuous"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
