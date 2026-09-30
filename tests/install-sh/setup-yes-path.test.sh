#!/usr/bin/env bash
# Tests ./setup -y yes-path: flag forwarding, fail-loud guards, alias parity. (S4)
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
SETUP="$REPO_ROOT/setup"
INSTALL_SH="$REPO_ROOT/install.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

[ -x "$SETUP" ] && ok "setup is executable" || bad "setup not executable"
bash -n "$SETUP" && ok "setup parses cleanly" || bad "setup has syntax error"
bash -n "$INSTALL_SH" && ok "install.sh parses cleanly" || bad "install.sh has syntax error"

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
echo '{}' > "$TMP/package.json"

# ── T1: -y forwards --full to install.sh ─────────────────────────────────────────
# Discriminator: 05-mcp.sh runs only when FULL is set; in dry-run it prints
# "[dry-run] would: add context7 to .mcp.json" — absent when FULL is not forwarded.
( cd "$TMP" && bash "$SETUP" -y ts-server --dry-run >out_y.txt 2>&1 ) || true
grep -q 'context7' "$TMP/out_y.txt" \
  && ok "-y ts-server --dry-run: FULL forwarded (05-mcp context7 in output)" \
  || bad "-y ts-server --dry-run: --full not forwarded (context7 absent from output)"

# ── T1b: --yes alias ─────────────────────────────────────────────────────────────
( cd "$TMP" && bash "$SETUP" --yes ts-server --dry-run >out_yes.txt 2>&1 ) || true
grep -q 'context7' "$TMP/out_yes.txt" \
  && ok "--yes ts-server --dry-run: FULL forwarded" \
  || bad "--yes alias did not forward --full"

# ── T1c: --all alias ─────────────────────────────────────────────────────────────
( cd "$TMP" && bash "$SETUP" --all ts-server --dry-run >out_all.txt 2>&1 ) || true
grep -q 'context7' "$TMP/out_all.txt" \
  && ok "--all ts-server --dry-run: FULL forwarded" \
  || bad "--all alias did not forward --full"

# ── T1d: --full alias on wrapper ─────────────────────────────────────────────────
( cd "$TMP" && bash "$SETUP" --full ts-server --dry-run >out_full.txt 2>&1 ) || true
grep -q 'context7' "$TMP/out_full.txt" \
  && ok "--full (wrapper alias) ts-server --dry-run: FULL forwarded" \
  || bad "--full wrapper alias did not forward --full"

# ── T2: react-spa accepted by wrapper (was missing from stack glob pre-S4) ───────
( cd "$TMP" && bash "$SETUP" react-spa --dry-run >out_spa.txt 2>&1 ) || true
grep -qiF 'react-spa' "$TMP/out_spa.txt" \
  && ok "react-spa accepted by wrapper" \
  || bad "react-spa not recognised by wrapper (stack glob missing?)"

# ── T3: react-native accepted by wrapper ─────────────────────────────────────────
( cd "$TMP" && bash "$SETUP" react-native --dry-run >out_rn.txt 2>&1 ) || true
grep -qiF 'react-native' "$TMP/out_rn.txt" \
  && ok "react-native accepted by wrapper" \
  || bad "react-native not recognised by wrapper (stack glob missing?)"

# ── T4: ./setup -y (no stack, no stack signal) → stack `generic`, never a hang on a read ─────
# P2 G1 (operator log entry 26 point 2): `{}` carries no stack signal, so the install takes the
# stack-free part as stack `generic`. --dry-run: the real run adds user-scope MCP servers (05-mcp).
# The old form asserted a non-zero exit and passed on `timeout 5` killing the install (rc 124).
_exit_nostack=0
_out_nostack=$( cd "$TMP" && timeout 60 bash "$SETUP" -y --dry-run 2>&1 ) || _exit_nostack=$?
[ "$_exit_nostack" -eq 0 ] \
  && ok "./setup -y --dry-run (no stack): exits 0 (no hang, no exit on an unknown stack)" \
  || bad "./setup -y --dry-run (no stack): exit $_exit_nostack (timeout = 124)"
grep -q 'stack: generic' <<<"$_out_nostack" \
  && ok "./setup -y --dry-run (no stack): says it installs stack generic" \
  || bad "./setup -y --dry-run (no stack): output does not name stack generic"

# ── T5: install.sh --full (no stack, no stack signal) → stack `generic`; a wrong NAME fails loud ─
_exit_ins=0
_out_ins=$( cd "$TMP" && timeout 60 bash "$INSTALL_SH" --full --dry-run 2>&1 ) || _exit_ins=$?
[ "$_exit_ins" -eq 0 ] \
  && ok "install.sh --full --dry-run (no stack): exits 0" \
  || bad "install.sh --full --dry-run (no stack): exit $_exit_ins (timeout = 124)"
grep -q 'stack: generic' <<<"$_out_ins" \
  && ok "install.sh --full --dry-run (no stack): says it installed stack generic" \
  || bad "install.sh --full --dry-run (no stack): output does not name stack generic"
_exit_bad=0
_out_bad=$( cd "$TMP" && timeout 5 bash "$INSTALL_SH" not-a-stack --full 2>&1 ) || _exit_bad=$?
[ "$_exit_bad" -ne 0 ] && grep -q 'Unknown stack: not-a-stack' <<<"$_out_bad" \
  && ok "install.sh not-a-stack: exits non-zero and names the stack choices" \
  || bad "install.sh not-a-stack: exit $_exit_bad, output: ${_out_bad:0:200}"

# ── T6: no self/consumer branch in setup or install.sh (S4 acceptance criterion) ─
! grep -qE 'SELF_INSTALL|consumer.branch|personal.branch' "$SETUP" "$INSTALL_SH" \
  && ok "no self/consumer branch code in setup or install.sh" \
  || bad "self/consumer branch pattern found — S4 must not introduce one"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
