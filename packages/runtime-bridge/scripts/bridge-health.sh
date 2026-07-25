#!/usr/bin/env bash
# bridge-health.sh — $0 deterministic CONTAINER-side health check for the aif bridge.
#
# WHY (qloop-ux-probe 2026-06-01): the costly, recurring bugs lived on the
# host↔container↔aif boundary that neither unit tests nor CI cover (a full agent
# run costs LLM tokens → no-paid-llm-in-ci). They were only ever found by a live
# probe MID-TASK. This script turns that class into a $0 pre-flight: run it at
# session start (or after any bridge change) and get "bridge red, fix first"
# instead of discovering breakage while you wanted to do real work.
#
# It is the CONTAINER-side complement to verify-bridge.sh (which does the
# host-side dispatch smoke + creates a throwaway task). This one creates NO task,
# spends NO tokens — just docker exec + curl + grep.
#
# Checks (each maps to a real qloop-ux-probe finding):
#   1. agent container present                                  (precondition)
#   2. container checkout clean                  → Finding A (dirty_worktree 409)
#   3. container park.ts carries the C-2 URL probe → Finding C/C-2 (stale code)
#   4. a park candidate URL is reachable FROM the container → Finding C/C-2 (net)
#   5. dedup store has no manual-fallback entries  → Finding B (stale retry block)
#
# EXIT: 0 = healthy; 1 = at least one FAIL. WARN never fails the run.
set -uo pipefail

# ── CONFIG (env-overridable; sensible defaults) ──────────────────────────────
AGENT_CONTAINER="${RUNTIME_BRIDGE_AGENT_CONTAINER:-$(docker ps --filter 'name=agent' --format '{{.Names}}' 2>/dev/null | grep -i aif | head -1)}"
CONTAINER_REPO="${RUNTIME_BRIDGE_CONTAINER_REPO:-/home/www/rules-as-tests-aif}"
DEDUP_PATH="${RUNTIME_BRIDGE_DEDUP_PATH:-/tmp/runtime-bridge-dedup.jsonl}"
# park.ts probes these in order; we check the same set is reachable from inside.
CANDIDATES="${RUNTIME_BRIDGE_CANDIDATES:-http://api:3009 http://localhost:3009}"

FAILED=0
pass() { printf '  \033[32mPASS\033[0m %s\n' "$*"; }
warn() { printf '  \033[33mWARN\033[0m %s\n' "$*"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$*"; FAILED=1; }
hdr()  { printf '\n=== %s ===\n' "$*"; }

dexec() { docker exec "$AGENT_CONTAINER" sh -c "$1" 2>/dev/null; }

# ── 0. Preconditions ─────────────────────────────────────────────────────────
hdr "0. Preconditions"
if ! command -v docker >/dev/null 2>&1; then
  fail "docker not found — this is a container-side check; run where the aif containers live"
  exit 1
fi
if [[ -z "$AGENT_CONTAINER" ]]; then
  fail "no aif agent container detected (set RUNTIME_BRIDGE_AGENT_CONTAINER)"
  exit 1
fi
pass "agent container = $AGENT_CONTAINER"

# ── 1. Container checkout clean (Finding A precheck) ─────────────────────────
hdr "1. Container checkout clean? (dirty → dispatch 409s)"
DIRTY="$(dexec "cd $CONTAINER_REPO && git status --porcelain")"
if [[ -z "$DIRTY" ]]; then
  pass "$CONTAINER_REPO is clean"
else
  warn "uncommitted changes in $CONTAINER_REPO — the NEXT autonomous dispatch will 409 (dirty_worktree). Commit/stash/clean it first:"
  printf '%s\n' "$DIRTY" | sed 's/^/        /'
fi

# ── 2. Container park.ts carries the C-2 reachability probe ──────────────────
hdr "2. Container park.ts has the URL probe (Finding C-2)"
if dexec "grep -q resolveReachableBaseUrl $CONTAINER_REPO/packages/runtime-bridge/src/cli/park.ts"; then
  pass "park.ts has resolveReachableBaseUrl (C-2 probe present)"
else
  fail "park.ts is missing resolveReachableBaseUrl — container code is stale (pre-#357). The agent will fall back to localhost and CANNOT park. Pull staging in the container."
fi

# ── 3. A park candidate URL reachable FROM the container (Finding C/C-2) ─────
hdr "3. park endpoint reachable from inside the container"
REACHED=""
for url in $CANDIDATES; do
  # reachable == curl got a real HTTP status (1xx–5xx). Connection failure prints 000.
  code="$(dexec "curl -s -m3 -o /dev/null -w '%{http_code}' $url/tasks")"
  if [[ "$code" =~ ^[1-5][0-9][0-9]$ ]]; then pass "$url/tasks → $code (reachable)"; REACHED="$url"; else warn "$url unreachable from container (code=${code:-000})"; fi
done
[[ -z "$REACHED" ]] && fail "NO park candidate reachable from the container — the agent cannot park itself (exactly Finding C). Check the aif service + docker network."

# ── 4. Dedup store: stale manual-fallback entries (Finding B) ────────────────
hdr "4. Dedup store hygiene"
if [[ -f "$DEDUP_PATH" ]]; then
  # `grep -c` prints the count AND exits 1 when the count is zero, so a `|| echo 0`
  # fallback appends a SECOND line: MANUAL becomes "0\n0" and the arithmetic test below
  # dies with `[[: 0\n0: syntax error in expression`. The count is already on stdout, so
  # swallow the exit status instead of substituting a value, and default only for the
  # genuinely-empty case (file unreadable). Observed live 2026-07-25 during an /aif-doctor
  # sweep: section 4 printed the syntax error and then reported PASS from the else branch.
  MANUAL="$(grep -c '"backend":"manual"' "$DEDUP_PATH" 2>/dev/null || true)"
  MANUAL="${MANUAL:-0}"
  if [[ "$MANUAL" -gt 0 ]]; then
    warn "$MANUAL manual-fallback dedup entr(y/ies) in $DEDUP_PATH — these can block a legit retry for 24h. Re-dispatch with --force, or prune with bridge-cleanup.sh."
  else
    pass "no manual-fallback dedup entries"
  fi
else
  pass "no dedup store yet ($DEDUP_PATH absent)"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
hdr "Summary"
if [[ "$FAILED" -eq 0 ]]; then
  printf '  \033[32mBridge healthy (container-side).\033[0m\n'; exit 0
else
  printf '  \033[31mBridge UNHEALTHY — fix the FAIL lines before relying on autonomous dispatch.\033[0m\n'; exit 1
fi
