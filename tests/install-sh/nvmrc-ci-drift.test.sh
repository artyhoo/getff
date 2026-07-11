#!/usr/bin/env bash
# GH #509 — post-install WARN on .nvmrc ↔ pre-existing CI Node-version drift.
#
# THE CASE: install ships .nvmrc (22.23.1) but copy_safe does NOT overwrite an existing CI
# workflow. A consumer whose own CI hardcodes a different `node-version: NN` then has local
# `nvm use` (.nvmrc) ≠ CI. It's the consumer's own CI, nothing is broken → WARN only (never
# a failure). A workflow that uses `node-version-file: '.nvmrc'` reads .nvmrc → cannot drift.
#
# PAIRED-NEGATIVE: POS = mismatched hardcode → warn fires; NEG1 = node-version-file → silent;
# NEG2 = matching-major hardcode → silent. The negatives prove the warn is not unconditional.
#
# EXIT-CODE GUARD (cold-review M2): every arm asserts install rc=0. The whole block runs under
# the script's `set -euo pipefail`; a no-match grep in the warn pipeline returns 1 and WOULD
# abort the install (the NEG1 case — shipped CI uses node-version-file). An output-only
# assertion would pass while the install silently crashed, so rc=0 is the load-bearing check.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# install into $1 (pre-seeded with .github/workflows/ci.yml = $2); output → $3; returns install rc.
# NO --force: the #509 scenario is the default skip-if-exists path that LEAVES the consumer's own
# CI in place (--force would overwrite it → no drift to warn about). </dev/null so the #483
# dev-dep [y/N] gate reads empty stdin and defaults to "no" (non-interactive).
seed_and_install() { # $1 dir, $2 ci.yml body, $3 logfile
  printf '{"name":"d509","version":"0.0.0"}\n' > "$1/package.json"
  mkdir -p "$1/.github/workflows"
  printf '%s\n' "$2" > "$1/.github/workflows/ci.yml"
  ( cd "$1" && git init -q && bash "$REPO_ROOT/install.sh" ts-server </dev/null ) > "$3" 2>&1
}

HARDCODE_22=$'jobs:\n  build:\n    steps:\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 22'
HARDCODE_20=$'jobs:\n  build:\n    steps:\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20'
USES_FILE=$'jobs:\n  build:\n    steps:\n      - uses: actions/setup-node@v4\n        with:\n          node-version-file: \'.nvmrc\''

# ── POS: pre-existing CI hardcodes Node 20, .nvmrc pins 22 → drift WARN fires ──
T=$(mktemp -d); LOG=$(mktemp); seed_and_install "$T" "$HARDCODE_20" "$LOG"; RC=$?
[ "$RC" = "0" ] && ok "POS: install exited 0 (warn never aborts)" || bad "POS: install exited $RC (warn block aborted install)"
grep -q "pins Node 22.* hardcodes node-version: 20" "$LOG" \
  && ok "POS: hardcoded node-version: 20 vs .nvmrc 22 → drift WARN printed" \
  || bad "POS: no drift warn for 20 vs 22 (saw: $(grep -i nvmrc "$LOG" | head -1))"
grep -q "node-version: 20" "$T/.github/workflows/ci.yml" \
  && ok "POS: pre-existing CI left intact (warn is non-destructive)" \
  || bad "POS: install mutated the consumer's CI (must be advisory only)"

# ── NEG1: node-version-file: '.nvmrc' → cannot drift → silent AND install still exits 0 ──
# (This rc=0 arm is the exact check that catches the set -e/pipefail abort the cold-review found.)
T2=$(mktemp -d); LOG2=$(mktemp); seed_and_install "$T2" "$USES_FILE" "$LOG2"; RC2=$?
[ "$RC2" = "0" ] && ok "NEG1: install exited 0 with node-version-file (no pipefail abort on no-match grep)" || bad "NEG1: install exited $RC2 (warn pipeline aborted install — the || true regression)"
grep -q "pins Node" "$LOG2" \
  && bad "NEG1: warned despite node-version-file (cannot drift) → false positive" \
  || ok "NEG1: node-version-file → no warn (correct — reads .nvmrc directly)"

# ── NEG2: pre-existing CI hardcodes the SAME major (22) → no drift → silent ──
T3=$(mktemp -d); LOG3=$(mktemp); seed_and_install "$T3" "$HARDCODE_22" "$LOG3"; RC3=$?
[ "$RC3" = "0" ] && ok "NEG2: install exited 0" || bad "NEG2: install exited $RC3"
grep -q "pins Node" "$LOG3" \
  && bad "NEG2: warned on matching major 22 vs 22 → unconditional warn" \
  || ok "NEG2: matching major (22 vs 22) → no warn (warn is conditional)"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
