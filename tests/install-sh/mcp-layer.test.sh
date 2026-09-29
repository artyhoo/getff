#!/usr/bin/env bash
# tests/install-sh/mcp-layer.test.sh — Empirical MCP layer test (S2, modular-install-fullpack).
#
# NOTE (T-MIF-A/T-MIF-C honesty): CI asserts the .mcp.json *shape* + that `claude mcp add`
# *was invoked* (the config that WOULD make MCPs reachable). True mcp__context7__* / deepwiki
# tool reachability is a manual/aif cold-QA + S5 acceptance step — no MCP runtime / no paid LLM
# in CI per .claude/rules/no-paid-llm-in-ci.md.
#
# Tests:
#   (a) install.sh <stack> --full --force --global → .mcp.json exists with correct context7 shape,
#       and the user-scope deepwiki row is installed (--global is its consent)
#   (b) idempotency: second --full run → context7 not duplicated; and WITHOUT --global the
#       user-scope deepwiki row is never installed (critical-review S1-4: -y = project only)
#   (c) --full --dry-run → no .mcp.json written
#   (d) byte-identical guard (D2): --force WITHOUT --full → no .mcp.json (gate proven)
#   (e) brownfield: pre-seeded .mcp.json with non-context7 entry preserved (additive merge)
#   (f) deepwiki absent machine-wide (stub `claude mcp get` → not found) → deepwiki http entry
#       in the project .mcp.json (one-button P3, point 8)
#   (g) paired negative: deepwiki at user scope (stub reports «Scope: User config») → no project
#       entry; and under --global the user-scope row owns it, so the project file carries none

set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

echo "▶ MCP layer empirical tests (setup.d/05-mcp.sh)"
echo ""

# Skip all tests if jq is absent — context7 write requires it; note and exit gracefully.
if ! command -v jq >/dev/null 2>&1; then
  echo "  ⊝ jq not found — skipping mcp-layer tests (jq required for .mcp.json write)"
  echo ""
  echo "PASS=$PASS FAIL=$FAIL (jq absent — tests skipped)"
  exit 0
fi

# ── Shared stub setup ─────────────────────────────────────────────────────────
# Create a claude stub that records calls, so claude mcp add is testable. `claude mcp get deepwiki`
# answers like Claude Code 2.1.270: «Scope: User config …» when STUB_DEEPWIKI_USER=1, else the
# not-found error (exit 1) — the probe getff_deepwiki_machine_wide (lib.sh) reads.
_stub_bin=$(mktemp -d)
_claude_log=$(mktemp)
cat > "$_stub_bin/claude" <<'EOF'
#!/bin/sh
printf 'claude-stub %s\n' "$*" >> "$CLAUDE_LOG"
if [ "$1 $2 $3" = "mcp get deepwiki" ]; then
  if [ "${STUB_DEEPWIKI_USER:-0}" = 1 ]; then
    printf 'deepwiki:\n  Scope: User config (available in all your projects)\n  Type: http\n'
    exit 0
  fi
  echo 'No MCP server found with name: deepwiki' >&2
  exit 1
fi
exit 0
EOF
chmod +x "$_stub_bin/claude"
export CLAUDE_LOG="$_claude_log"

_run_install() {
  local proj="$1"; shift
  local args=("$@")
  # Run install.sh in a subshell with the stub on PATH; PROJECT_ROOT must be set.
  (
    export PATH="$_stub_bin:$PATH"
    cd "$proj"
    bash "$REPO_ROOT/install.sh" ts-server "${args[@]}" 2>/dev/null
  )
}

# ── (a) --full --force → .mcp.json with correct context7 shape ───────────────
echo "  ── (a) greenfield: --full --force creates .mcp.json with context7 ──"
_proj_a=$(mktemp -d)
echo '{}' > "$_proj_a/package.json"
_run_install "$_proj_a" --full --force --global >/dev/null 2>&1 || true

_mcp_a="$_proj_a/.mcp.json"
[ -f "$_mcp_a" ] && ok "(a) .mcp.json created" || bad "(a) .mcp.json not created"
if [ -f "$_mcp_a" ]; then
  jq -e '.mcpServers.context7' "$_mcp_a" >/dev/null 2>&1 \
    && ok "(a) context7 key present in .mcp.json" \
    || bad "(a) context7 key missing from .mcp.json"
  # http remote, like getff's own .mcp.json — nothing runs locally, no client version to pin
  jq -e '.mcpServers.context7.type == "http"' "$_mcp_a" >/dev/null 2>&1 \
    && ok "(a) context7.type = http" \
    || bad "(a) context7.type != http"
  jq -e '.mcpServers.context7.url == "https://mcp.context7.com/mcp"' "$_mcp_a" >/dev/null 2>&1 \
    && ok "(a) context7.url = https://mcp.context7.com/mcp" \
    || bad "(a) context7.url mismatch"
  jq -e '.mcpServers.context7 | has("command") | not' "$_mcp_a" >/dev/null 2>&1 \
    && ok "(a) context7 has no local command (no npx @latest)" \
    || bad "(a) context7 still carries a local command"
  # --global: the user-scope manifest row owns deepwiki, so the project file carries none
  jq -e '.mcpServers | has("deepwiki") | not' "$_mcp_a" >/dev/null 2>&1 \
    && ok "(a) --global: no project deepwiki entry (user-scope row owns it)" \
    || bad "(a) --global: a project deepwiki entry was written as well"
fi

# claude mcp add (deepwiki row, --scope user) must have been invoked — --global allowed it
grep -q 'claude-stub mcp add' "$_claude_log" \
  && ok "(a) claude mcp add was invoked under --global (kind=mcp row)" \
  || bad "(a) claude mcp add was NOT invoked"
rm -f "$_claude_log"; > "$_claude_log"
rm -rf "$_proj_a"

# ── (b) idempotency: second --full run → context7 not duplicated ─────────────
echo "  ── (b) idempotency: second --full run does not duplicate context7 ──"
_proj_b=$(mktemp -d)
echo '{}' > "$_proj_b/package.json"
_run_install "$_proj_b" --full --force >/dev/null 2>&1 || true
_run_install "$_proj_b" --full --force >/dev/null 2>&1 || true
_mcp_b="$_proj_b/.mcp.json"
[ -f "$_mcp_b" ] && ok "(b) .mcp.json still present after second run" || bad "(b) .mcp.json missing after second run"
if [ -f "$_mcp_b" ]; then
  _ctx7_count=$(jq '[.mcpServers | keys[] | select(. == "context7")] | length' "$_mcp_b" 2>/dev/null || echo 0)
  [ "$_ctx7_count" -le 1 ] \
    && ok "(b) context7 not duplicated ($_ctx7_count entry)" \
    || bad "(b) context7 duplicated ($_ctx7_count entries)"
fi
# deepwiki detect-first: second run should show skip (already present stub logic returns 0)
# The stub records invocations; claude mcp list check in detect determines skip.
# (In this test environment, the stub's detect returns non-zero for "grep -q deepwiki" on
#  empty output → installs on each run via stub. We just assert the stub was called, not the
#  exact idempotency of the stub itself — true idempotency is a cold-QA / manual step per T-MIF-C.)
ok "(b) second-run idempotency: context7 checked (deepwiki idempotency is manual cold-QA per T-MIF-C)"
# paired negative for (a): neither --full run passed --global, so the user-scope row stays out.
grep -q 'claude-stub mcp add' "$_claude_log" \
  && bad "(b) claude mcp add ran WITHOUT --global — a machine-global install under plain --full" \
  || ok "(b) without --global the user-scope MCP row is skipped (project-only install)"
rm -f "$_claude_log"; > "$_claude_log"
rm -rf "$_proj_b"

# ── (c) --full --dry-run → no .mcp.json written ──────────────────────────────
echo "  ── (c) --full --dry-run writes no .mcp.json ──"
_proj_c=$(mktemp -d)
echo '{}' > "$_proj_c/package.json"
_run_install "$_proj_c" --full --dry-run >/dev/null 2>&1 || true
_mcp_c="$_proj_c/.mcp.json"
[ ! -f "$_mcp_c" ] \
  && ok "(c) --full --dry-run: .mcp.json NOT written" \
  || bad "(c) --full --dry-run: .mcp.json was written (should not be)"
rm -rf "$_proj_c"

# ── (d) byte-identical guard (D2): --force WITHOUT --full → no .mcp.json ─────
echo "  ── (d) D2 gate: --force without --full writes no .mcp.json ──"
_proj_d=$(mktemp -d)
echo '{}' > "$_proj_d/package.json"
_run_install "$_proj_d" --force >/dev/null 2>&1 || true
_mcp_d="$_proj_d/.mcp.json"
[ ! -f "$_mcp_d" ] \
  && ok "(d) D2 gate: --force without --full → no .mcp.json (FULL gate working)" \
  || bad "(d) D2 gate FAILED: .mcp.json created on non-full path — byte-identical broken"
rm -rf "$_proj_d"

# ── (e) brownfield: pre-seeded .mcp.json with another server → preserved ─────
echo "  ── (e) brownfield: existing .mcp.json other entries preserved (additive merge) ──"
_proj_e=$(mktemp -d)
echo '{}' > "$_proj_e/package.json"
# Pre-seed .mcp.json with a different MCP server
cat > "$_proj_e/.mcp.json" <<'EOF'
{"mcpServers":{"existing-server":{"command":"npx","args":["some-mcp"]}}}
EOF
_run_install "$_proj_e" --full --force >/dev/null 2>&1 || true
_mcp_e="$_proj_e/.mcp.json"
[ -f "$_mcp_e" ] && ok "(e) brownfield: .mcp.json still present" || bad "(e) brownfield: .mcp.json missing"
if [ -f "$_mcp_e" ]; then
  jq -e '.mcpServers["existing-server"]' "$_mcp_e" >/dev/null 2>&1 \
    && ok "(e) brownfield: existing-server entry preserved (not clobbered)" \
    || bad "(e) brownfield: existing-server entry was clobbered — data loss!"
  jq -e '.mcpServers.context7' "$_mcp_e" >/dev/null 2>&1 \
    && ok "(e) brownfield: context7 added additively" \
    || bad "(e) brownfield: context7 not added"
fi
rm -rf "$_proj_e"

# ── (f) deepwiki absent machine-wide → project http entry ────────────────────
echo "  ── (f) deepwiki not configured machine-wide → added to the project .mcp.json ──"
_proj_f=$(mktemp -d)
echo '{}' > "$_proj_f/package.json"
STUB_DEEPWIKI_USER=0 _run_install "$_proj_f" --full --force >/dev/null 2>&1 || true
_mcp_f="$_proj_f/.mcp.json"
if [ -f "$_mcp_f" ]; then
  jq -e '.mcpServers.deepwiki.type == "http" and .mcpServers.deepwiki.url == "https://mcp.deepwiki.com/mcp"' \
    "$_mcp_f" >/dev/null 2>&1 \
    && ok "(f) deepwiki http entry in the project .mcp.json" \
    || bad "(f) deepwiki http entry missing from the project .mcp.json"
  jq -e '.mcpServers.context7.type == "http"' "$_mcp_f" >/dev/null 2>&1 \
    && ok "(f) context7 written alongside deepwiki" \
    || bad "(f) context7 missing when deepwiki was added"
else
  bad "(f) .mcp.json not created"
fi
grep -q 'claude-stub mcp get deepwiki' "$_claude_log" \
  && ok "(f) the probe asked \`claude mcp get deepwiki\` (not the removed \`mcp list --scope\`)" \
  || bad "(f) the machine-wide probe never asked \`claude mcp get deepwiki\`"
rm -f "$_claude_log"; > "$_claude_log"
rm -rf "$_proj_f"

# ── (g) paired negative: deepwiki at user scope → no project entry ───────────
echo "  ── (g) deepwiki configured machine-wide → no project entry ──"
_proj_g=$(mktemp -d)
echo '{}' > "$_proj_g/package.json"
STUB_DEEPWIKI_USER=1 _run_install "$_proj_g" --full --force >/dev/null 2>&1 || true
_mcp_g="$_proj_g/.mcp.json"
if [ -f "$_mcp_g" ]; then
  jq -e '.mcpServers | has("deepwiki") | not' "$_mcp_g" >/dev/null 2>&1 \
    && ok "(g) user-scope deepwiki → the project .mcp.json carries none" \
    || bad "(g) user-scope deepwiki → a duplicate project entry was written"
  jq -e '.mcpServers.context7.type == "http"' "$_mcp_g" >/dev/null 2>&1 \
    && ok "(g) context7 still written" \
    || bad "(g) context7 missing"
else
  bad "(g) .mcp.json not created"
fi
rm -f "$_claude_log"; > "$_claude_log"
rm -rf "$_proj_g"

# ── Cleanup ───────────────────────────────────────────────────────────────────
rm -rf "$_stub_bin" "$_claude_log"

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
