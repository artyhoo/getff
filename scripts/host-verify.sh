#!/usr/bin/env bash
# host-verify.sh — run a kickoff's declared destination-environment verification contract.
#
# WHY THIS EXISTS
#   Work dispatched to the aif-handoff runtime is produced inside a container. The artefact
#   ships to the HOST, where the pre-push gates, the operator's toolchain and the real OS live.
#   The container is not the destination environment, and the worker cannot observe the
#   difference — four incidents in one day (2026-07-24) were all this one class:
#     1. Job C   — 5/5 PASS in container, 0/5 on host (`docker` absent in the container, so the
#                  fixture's stub was the only one on PATH).
#     2. Job F1  — 9/9 in container, 7/9 on host (shadow PATH built from jq's directory; true
#                  where /bin symlinks to usr/bin, false on macOS where `cat` lives in /bin).
#     3. tsx     — three PostToolUse gates resolved their TypeScript runner from one repo-local
#                  path; a linked worktree carries no node_modules, so all three were inert.
#     4. F6      — principle-11 F1 measured ~5s in the container against a freshly lowered 15s
#                  budget; on the host the same test takes 17.6-18.1s and fails 3/3.
#
#   "The orchestrator will remember to re-run it on the host" is bare attention, which
#   `.claude/rules/attention-is-not-a-mechanism.md` §1 rejects as a detection layer. This script
#   is the mechanism: it turns the re-run into a command with an exit code.
#
# THE CONTRACT
#   A kickoff declares the commands its acceptance depends on inside a fenced block whose
#   info-string carries the `host-verify` marker:
#
#     ```bash host-verify
#     npx vitest run packages/core/principles/11-build-first-reuse-default.test.ts
#     ```
#
#   Every non-blank, non-comment line in that block is one command. They run from the repo root,
#   on the host, in declaration order. Any non-zero exit fails the contract.
#
# USAGE
#   bash scripts/host-verify.sh <umbrella>                  # .claude/orchestrator-prompts/<umbrella>/kickoff.md
#   bash scripts/host-verify.sh path/to/kickoff.md          # explicit path
#   bash scripts/host-verify.sh --list <umbrella|path>      # print the commands, run nothing
#
# EXIT CODES
#   0 — every declared command passed (or --list completed).
#   1 — at least one declared command failed.
#   2 — usage error, kickoff not found, or NO contract block found (fail-closed: a missing
#       contract is never reported as a pass; that is the whole failure mode being closed).
#
# Deterministic bash + awk only — no jq, no node, no network, no paid LLM
# (.claude/rules/no-paid-llm-in-ci.md). Safe to call from a gate.
set -uo pipefail

usage() {
  cat >&2 <<'EOF'
usage: bash scripts/host-verify.sh [--list] <umbrella|path-to-kickoff.md>

Runs the `host-verify` fenced block declared in the kickoff, on the host, from the repo root.
Exit 0 = all passed, 1 = a command failed, 2 = usage / missing kickoff / missing contract.
EOF
}

LIST_ONLY=false
case "${1:-}" in
  --list) LIST_ONLY=true; shift ;;
  -h | --help) usage; exit 2 ;;
esac

TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  usage
  exit 2
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Resolve <umbrella> to its kickoff, or accept an explicit path.
if [ -f "$TARGET" ]; then
  KICKOFF="$TARGET"
elif [ -f "$REPO_ROOT/$TARGET" ]; then
  KICKOFF="$REPO_ROOT/$TARGET"
else
  KICKOFF="$REPO_ROOT/.claude/orchestrator-prompts/$TARGET/kickoff.md"
fi

if [ ! -f "$KICKOFF" ]; then
  printf '❌ host-verify: no kickoff at %s\n' "$KICKOFF" >&2
  exit 2
fi

# Extract every line inside ```<lang> host-verify … ``` blocks. The marker is matched on the
# fence INFO-STRING only, so a `host-verify` mention in prose or in a nested example cannot
# open a block. Multiple blocks concatenate in document order.
COMMANDS="$(
  awk '
    /^[[:space:]]*```/ {
      if (inblock) { inblock = 0; next }
      if ($0 ~ /(^|[[:space:]])host-verify([[:space:]]|$)/) { inblock = 1 }
      next
    }
    inblock { print }
  ' "$KICKOFF" | grep -vE '^[[:space:]]*(#|$)' || true
)"

if [ -z "$COMMANDS" ]; then
  printf '❌ host-verify: %s declares no `host-verify` contract block.\n' "${KICKOFF#"$REPO_ROOT/"}" >&2
  printf '   A missing contract is a FAIL, not a pass — see .claude/rules/destination-environment-verification.md §1.\n' >&2
  exit 2
fi

REL_KICKOFF="${KICKOFF#"$REPO_ROOT/"}"
printf '── host-verify: %s\n' "$REL_KICKOFF"
printf '   host=%s  repo=%s\n' "$(uname -s)" "$REPO_ROOT"

if [ "$LIST_ONLY" = true ]; then
  printf '%s\n' "$COMMANDS" | while IFS= read -r c; do printf '   • %s\n' "$c"; done
  exit 0
fi

FAILED=0
TOTAL=0
# Read from a here-string, not a pipe: a piped `while` runs in a subshell on some shells and
# the FAILED/TOTAL counters would be lost at the end of the loop.
while IFS= read -r CMD; do
  [ -n "$CMD" ] || continue
  TOTAL=$((TOTAL + 1))
  printf '\n▶ [%d] %s\n' "$TOTAL" "$CMD"
  # `</dev/null` so a declared command can never block the gate waiting on stdin.
  if (cd "$REPO_ROOT" && bash -c "$CMD" </dev/null); then
    printf '✅ [%d] PASS — %s\n' "$TOTAL" "$CMD"
  else
    RC=$?
    printf '❌ [%d] FAIL (exit %d) — %s\n' "$TOTAL" "$RC" "$CMD"
    FAILED=$((FAILED + 1))
  fi
done <<< "$COMMANDS"

printf '\n── host-verify result: %d/%d passed on %s\n' "$((TOTAL - FAILED))" "$TOTAL" "$(uname -s)"
if [ "$FAILED" -gt 0 ]; then
  printf '❌ host-verify FAILED for %s — the work is not accepted on the host.\n' "$REL_KICKOFF" >&2
  exit 1
fi
printf '✅ host-verify passed for %s\n' "$REL_KICKOFF"
exit 0
