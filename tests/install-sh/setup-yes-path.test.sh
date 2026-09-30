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

# ── T4: ./setup -y (no stack) fails loud — must not hang on interactive read ─────
_exit_nostack=0
_out_nostack=$( cd "$TMP" && timeout 5 bash "$SETUP" -y 2>&1 ) || _exit_nostack=$?
[ "$_exit_nostack" -ne 0 ] \
  && ok "./setup -y (no stack): exits non-zero (no silent hang)" \
  || bad "./setup -y (no stack): did not exit non-zero (may have hung)"
grep -qiE 'stack|ts-server|react-next' <<<"$_out_nostack" \
  && ok "./setup -y (no stack): error message mentions stack choices" \
  || bad "./setup -y (no stack): error missing stack guidance"

# ── T5: install.sh --full (no stack) fails loud ──────────────────────────────────
_exit_ins=0
_out_ins=$( cd "$TMP" && timeout 5 bash "$INSTALL_SH" --full 2>&1 ) || _exit_ins=$?
[ "$_exit_ins" -ne 0 ] \
  && ok "install.sh --full (no stack): exits non-zero" \
  || bad "install.sh --full (no stack): did not exit non-zero"
grep -qiE 'stack|ts-server|react-next' <<<"$_out_ins" \
  && ok "install.sh --full (no stack): error message mentions stack" \
  || bad "install.sh --full (no stack): error missing stack guidance"

# ── T6: no self/consumer branch in setup or install.sh (S4 acceptance criterion) ─
! grep -qE 'SELF_INSTALL|consumer.branch|personal.branch' "$SETUP" "$INSTALL_SH" \
  && ok "no self/consumer branch code in setup or install.sh" \
  || bad "self/consumer branch pattern found — S4 must not introduce one"

# ── T7-T9: the dry run previews the real run (P6 run 2 N4, one-button P3) ────────
# The road previews with --dry-run before it installs; a preview that omits a tool sends the agent
# probing on its own (P6 R2: it ran `claude mcp get deepwiki` because the Companions section named
# no MCP server). companions_section = the lines between «▶ Companions» and the next «▶» header.
companions_section() { awk '/^▶ Companions/{f=1;next} /^▶ /{f=0} f' "$1"; }

# T7: --dry-run wins in any flag order. Before the fix `--dry-run -y` let -y reset MODE to «yes»:
# install.sh still got --dry-run, but the companion and bridge steps ran for real.
( cd "$TMP" && bash "$SETUP" --dry-run -y ts-server >out_dy.txt 2>&1 ) || true
grep -qF 'complete (dry-run)' "$TMP/out_dy.txt" \
  && ok "--dry-run -y ts-server: still a dry run (flag order does not matter)" \
  || bad "--dry-run -y ts-server: -y after --dry-run turned the companion steps into a real run ($(grep -o 'complete ([a-z-]*)' "$TMP/out_dy.txt"))"

# T8: with -y the Companions section names both MCP servers the real run adds and records.
_cs_y=$(companions_section "$TMP/out_y.txt")
grep -qF 'context7' <<<"$_cs_y" && grep -qF 'deepwiki' <<<"$_cs_y" \
  && ok "-y --dry-run: the Companions section names context7 and deepwiki" \
  || bad "-y --dry-run: the Companions section omits an MCP server: $(tr '\n' '|' <<<"$_cs_y")"

# T9: without -y the Companions section still names them, and says this mode does not add them.
( cd "$TMP" && bash "$SETUP" ts-server --dry-run >out_plain.txt 2>&1 ) || true
_cs_p=$(companions_section "$TMP/out_plain.txt")
grep -qF 'context7' <<<"$_cs_p" && grep -qF 'deepwiki' <<<"$_cs_p" && grep -qF 'only with -y' <<<"$_cs_p" \
  && ok "--dry-run without -y: the Companions section names the MCP servers and that only -y adds them" \
  || bad "--dry-run without -y: the Companions section does not say what happens to the MCP servers: $(tr '\n' '|' <<<"$_cs_p")"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
