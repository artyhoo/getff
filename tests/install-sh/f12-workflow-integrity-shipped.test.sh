#!/usr/bin/env bash
# consumer-install-hardening S1 — F12: install.sh must ship workflow-integrity.yml so the R11
# "check" claim in the shipped .ai-factory/RULES.md matches reality. R11 names ci.yml's ci-success
# aggregate + workflow-integrity.yml (branch-protection-assertion); before this fix only ci.yml
# shipped, so the RULES.md claim referenced an artefact install never delivered. This test runs the
# REAL full pipeline (lib-only mode does not expose copy_safe — see install-sh harness note) and asserts:
#   F12-pos: .github/workflows/workflow-integrity.yml lands next to ci.yml (ts-server + react-next).
#   F12-neg (load-bearing): the shipped RULES.md R11 row references workflow-integrity.yml AND does
#           NOT claim actionlint/zizmor/audit-self.yml — proves the shipped workflow is the artefact
#           the rule names, and that no R11 claim points at an unshipped artefact.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

T=$(mktemp -d)
printf '{ "name": "f12t", "version": "0.0.0" }\n' > "$T/package.json"
( cd "$T" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force ) >/dev/null 2>&1

# F12-pos — the branch-protection self-assertion workflow lands next to ci.yml.
[ -f "$T/.github/workflows/workflow-integrity.yml" ] \
  && ok "F12: workflow-integrity.yml shipped (ts-server)" \
  || bad "F12: workflow-integrity.yml missing (ts-server)"
[ -f "$T/.github/workflows/ci.yml" ] \
  && ok "F12: ci.yml co-located" \
  || bad "F12: ci.yml missing"

# react-next stack ships the same self-assertion (R11 applies to both stacks).
R=$(mktemp -d); printf '{ "name": "f12r", "version": "0.0.0" }\n' > "$R/package.json"
( cd "$R" && git init -q && bash "$REPO_ROOT/install.sh" react-next --force ) >/dev/null 2>&1
[ -f "$R/.github/workflows/workflow-integrity.yml" ] \
  && ok "F12: workflow-integrity.yml shipped (react-next)" \
  || bad "F12: workflow-integrity.yml missing (react-next)"

# F12-neg (load-bearing) — the shipped RULES.md R11 row names workflow-integrity.yml. If the rule
# stops referencing it, this arm fails and shipping the workflow is revealed as no longer needed.
r11_row=$(grep -E '^\| \*\*R11 CI integrity\*\*' "$T/.ai-factory/RULES.md" || true)
grep -q 'workflow-integrity.yml' <<<"$r11_row" \
  && ok "F12-neg: shipped RULES.md R11 row references workflow-integrity.yml (fix is load-bearing)" \
  || bad "F12-neg: R11 row no longer names workflow-integrity.yml — fix may be vacuous"

# Negative honesty — R11 must NOT claim an artefact install does not ship (actionlint/zizmor/audit-self).
grep -qiE 'actionlint|zizmor|audit-self' <<<"$r11_row" \
  && bad "F12-honesty: R11 row claims actionlint/zizmor/audit-self — none are shipped" \
  || ok "F12-honesty: R11 row claims no unshipped actionlint/zizmor/audit-self artefact"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
