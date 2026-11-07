#!/usr/bin/env bash
# verify-bridge.sh — paste-and-run smoke test for the runtime bridge (REST dispatch).
#
# WHAT THIS IS FOR
#   This is the operator's "did it actually work?" check for the aif-handoff
#   runtime bridge. It is self-contained: edit the CONFIG block, paste the whole
#   file into a terminal (or `bash verify-bridge.sh`), and read the PASS/FAIL.
#   It creates ONE throwaway task on your aif-handoff project and deletes it again.
#
# WHAT IT DOES NOT DO
#   It does NOT persist any config. To wire env + the PostToolUse auto-dispatch
#   hook + .claude/settings.json once, run the sibling installer instead:
#       bash packages/runtime-bridge/scripts/setup-runtime-bridge.sh
#   (That script is interactive and idempotent; this one is read-mostly + a
#   create/delete smoke task. No duplication of the enable logic here.)
#
# DISPATCH PATH = REST (:3009), per research-patch
#   docs/meta-factory/research-patches/2026-05-31-runtime-bridge-mcp-dispatch-fix.md
#
# EXIT: 0 = all preflight + smoke checks passed; 1 = at least one FAIL.
set -uo pipefail

# ── CONFIG — edit PROJECT_ID, then run ────────────────────────────────────────
# Your aif-handoff project UUID (REQUIRED). Falls back to the env var if set.
PROJECT_ID="${RUNTIME_BRIDGE_AIF_PROJECT_ID:-EDIT_ME_PROJECT_UUID}"
# aif-handoff REST/WS base URL (:3009 by default).
AIF_URL="${RUNTIME_BRIDGE_AIF_URL:-http://localhost:3009}"
# aif-handoff MCP (HTTP) URL (:3100) — only probed for info; REST dispatch ignores it.
AIF_MCP_URL="${RUNTIME_BRIDGE_AIF_MCP_URL:-http://localhost:3100}"
# The project working tree aif-handoff operates on. Leave empty to skip the
# clean-worktree check. aif-handoff refuses to advance a task (the events step)
# while this tree is dirty — that surfaces as a dispatch_failed → Manual fallback.
TARGET_PROJECT_DIR="${RUNTIME_BRIDGE_TARGET_DIR:-}"

# ── Locate repo root + CLIs ───────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
DISPATCH_TS="$REPO_ROOT/packages/runtime-bridge/src/cli/dispatch.ts"
AWAIT_TS="$REPO_ROOT/packages/runtime-bridge/src/cli/await.ts"

FAILED=0
pass() { printf '  \033[32mPASS\033[0m %s\n' "$*"; }
warn() { printf '  \033[33mWARN\033[0m %s\n' "$*"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$*"; FAILED=1; }
hdr()  { printf '\n=== %s ===\n' "$*"; }

runner() { if command -v tsx >/dev/null 2>&1; then tsx "$@"; else npx --yes tsx "$@"; fi; }

# ── 0. Dependencies ───────────────────────────────────────────────────────────
hdr "0. Dependencies"
if command -v curl >/dev/null 2>&1; then pass "curl present"; else fail "curl missing"; exit 1; fi
if command -v node >/dev/null 2>&1; then pass "node present ($(node -v))"; else fail "node missing"; exit 1; fi
if command -v tsx >/dev/null 2>&1 || command -v npx >/dev/null 2>&1; then pass "tsx/npx present"; else fail "need tsx or npx"; fi
if [[ -f "$DISPATCH_TS" ]]; then pass "dispatch.ts found"; else fail "dispatch.ts missing ($DISPATCH_TS)"; fi
if [[ -f "$AWAIT_TS" ]]; then pass "await.ts found"; else fail "await.ts missing ($AWAIT_TS)"; fi

# ── 1. Config sanity ──────────────────────────────────────────────────────────
hdr "1. Config"
if [[ "$PROJECT_ID" == "EDIT_ME_PROJECT_UUID" || -z "$PROJECT_ID" ]]; then
  fail "PROJECT_ID is unset — edit the CONFIG block or export RUNTIME_BRIDGE_AIF_PROJECT_ID"
else
  pass "PROJECT_ID = $PROJECT_ID"
fi
pass "AIF_URL = $AIF_URL   (REST/WS)"
pass "AIF_MCP_URL = $AIF_MCP_URL   (reserved — REST dispatch ignores it)"

# ── 2. aif-handoff reachability ───────────────────────────────────────────────
hdr "2. aif-handoff reachability"
if grep -q '^2' <<<"$(curl -sS -m 2 -o /dev/null -w '%{http_code}' "$AIF_URL/health" 2>/dev/null)"; then
  pass "$AIF_URL/health → 2xx (REST up)"
else
  fail "$AIF_URL/health unreachable — start aif-handoff (docker compose up -d)"
fi
MCP_CODE="$(curl -sS -m 2 -o /dev/null -w '%{http_code}' -X POST "$AIF_MCP_URL/mcp" 2>/dev/null || echo 000)"
if [[ "$MCP_CODE" != "000" ]]; then
  warn "MCP server answering on $AIF_MCP_URL (code $MCP_CODE) — informational only; REST dispatch does not use it"
else
  warn "MCP server not reachable on $AIF_MCP_URL — fine; REST dispatch does not need it"
fi

# ── 3. Clean-worktree precondition (the events-step guard) ────────────────────
hdr "3. Target worktree clean? (gates the plan_ready transition)"
if [[ -z "$TARGET_PROJECT_DIR" ]]; then
  warn "TARGET_PROJECT_DIR unset — skipping; if dispatch reaches plan_ready then the tree was clean"
elif [[ ! -d "$TARGET_PROJECT_DIR/.git" ]]; then
  warn "$TARGET_PROJECT_DIR is not a git repo — skipping clean check"
elif [[ -z "$(git -C "$TARGET_PROJECT_DIR" status --porcelain 2>/dev/null)" ]]; then
  pass "$TARGET_PROJECT_DIR is clean"
else
  warn "$TARGET_PROJECT_DIR has uncommitted changes — aif-handoff will block the events step (dispatch_failed → Manual fallback). Commit/stash/gitignore them for a full plan_ready run."
fi

# ── 4. Smoke test: dispatch a throwaway kickoff → read status → cleanup ───────
hdr "4. Smoke test (creates + deletes ONE throwaway task)"
if [[ "$FAILED" -eq 1 ]]; then
  warn "skipping smoke test — fix the FAILs above first"
else
  warn "this creates a REAL task; on a CLEAN worktree the coordinator may briefly start it before cleanup (a short autonomous run). On a dirty worktree it is blocked + rolled back (no run)."
  TMPDIR_SMOKE="$(mktemp -d)"
  KDIR="$TMPDIR_SMOKE/runtime-bridge-smoke-meta-launch"
  mkdir -p "$KDIR"
  printf '# runtime-bridge smoke test\n\nThrowaway task created by verify-bridge.sh — safe to delete.\n' > "$KDIR/kickoff.md"

  export RUNTIME_BRIDGE_MODE=aif-handoff
  export RUNTIME_BRIDGE_AIF_PROJECT_ID="$PROJECT_ID"
  export RUNTIME_BRIDGE_AIF_URL="$AIF_URL"

  # Force a fresh dispatch (bypass the 24h dedup cache) by uniquifying content.
  printf '\n<!-- smoke %s -->\n' "$(date +%s 2>/dev/null || echo nodate)" >> "$KDIR/kickoff.md"

  DISPATCH_OUT="$(runner "$DISPATCH_TS" "$KDIR/kickoff.md" 2>"$TMPDIR_SMOKE/dispatch.err")"
  DISPATCH_ERR="$(cat "$TMPDIR_SMOKE/dispatch.err" 2>/dev/null || true)"

  # dispatch.ts prints additionalContext JSON on success; taskId is in the message.
  TASK_ID="$(printf '%s' "$DISPATCH_OUT" | grep -oE 'taskId=[0-9a-fA-F-]{36}' | head -1 | sed 's/taskId=//')"

  if grep -q 'Dispatched to aif-handoff' <<<"$DISPATCH_OUT"; then
    pass "dispatched to aif-handoff (taskId=$TASK_ID) — full chain reached plan_ready"
    if [[ -n "$TASK_ID" ]]; then
      STATUS_OUT="$(runner "$AWAIT_TS" "$TASK_ID" --once 2>/dev/null || true)"
      pass "status read-back: $STATUS_OUT"
    fi
  elif grep -qi 'dirty_worktree\|Branch isolation' <<<"$DISPATCH_ERR"; then
    # REST mechanics reached the server (create+plan+events) and rolled back, but
    # the autonomous path did NOT complete — that is a real "not ready" result,
    # not a pass. Actionable: clean the target worktree.
    fail "blocked by aif-handoff's clean-worktree guard — autonomous path did NOT complete (REST mechanics reached the server; half-created task was rolled back; dispatch fell back to Manual). FIX: clean the target worktree (commit/stash/gitignore), then re-run."
  elif grep -q 'ManualBackend' <<<"$DISPATCH_OUT"; then
    fail "dispatch fell back to ManualBackend (aif-handoff unreachable or PROJECT_ID wrong). stderr:"
    printf '%s\n' "$DISPATCH_ERR" | sed 's/^/      /'
  else
    fail "unexpected dispatch result"
    printf 'stdout: %s\nstderr: %s\n' "$DISPATCH_OUT" "$DISPATCH_ERR" | sed 's/^/      /'
  fi

  # ── Cleanup: delete the throwaway task(s) on the project ────────────────────
  if command -v python3 >/dev/null 2>&1; then
    LIST="$(curl -sS -m 5 "$AIF_URL/tasks?projectId=$PROJECT_ID" 2>/dev/null || echo '[]')"
    printf '%s' "$LIST" | python3 -c "import sys,json
try: ts=json.load(sys.stdin)
except Exception: ts=[]
[print(t['id']) for t in ts if 'runtime-bridge-smoke' in (t.get('title','') or '')]" 2>/dev/null \
      | while read -r tid; do
          [[ -n "$tid" ]] && curl -sS -m 5 -o /dev/null -w "  cleanup: DELETE $tid → %{http_code}\n" -X DELETE "$AIF_URL/tasks/$tid"
        done
  else
    warn "python3 absent — could not auto-clean the smoke task; delete 'runtime-bridge-smoke...' manually in aif-handoff"
  fi
  rm -rf "$TMPDIR_SMOKE"
fi

# ── 5. Persistent enable reminder ─────────────────────────────────────────────
hdr "5. To enable AUTO-dispatch persistently (one-time)"
printf '  Run the installer (writes env + hook + .claude/settings.json, idempotent):\n'
printf '    bash %s/packages/runtime-bridge/scripts/setup-runtime-bridge.sh\n' "$REPO_ROOT"

# ── Summary ───────────────────────────────────────────────────────────────────
hdr "Summary"
if [[ "$FAILED" -eq 0 ]]; then
  printf '  \033[32mAll checks passed.\033[0m\n'
  exit 0
else
  printf '  \033[31mSome checks failed — see FAIL lines above.\033[0m\n'
  exit 1
fi
