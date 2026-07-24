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

# Extract every line inside a fenced block whose info-string carries `host-verify`.
#
# Fence handling follows CommonMark, and the details are load-bearing (a cold review found
# each of these as a live bypass):
#   - The opening fence's backtick RUN LENGTH is remembered; only a fence of at least that
#     length AND with no info string closes it. So a ```` ```bash host-verify ```` block
#     quoted INSIDE a 4-backtick documentation wrapper stays content of the wrapper and does
#     NOT open a contract. Without this, a kickoff that merely QUOTES the rule's §1 example —
#     or pastes the gate's own error text — would satisfy the gate while declaring nothing.
#   - A block is only collected when its own info string carries `host-verify` as a word, so
#     a prose mention cannot open one.
#   - An UNTERMINATED fence is an error (exit 2), never "everything after it is a command":
#     one typo'd fence would otherwise hand kickoff narrative to `bash -c`.
# Multiple contract blocks concatenate in document order.
COMMANDS="$(
  awk '
    match($0, /^[ \t]*`+/) {
      run = substr($0, RSTART, RLENGTH); sub(/^[ \t]*/, "", run)
      n = length(run); rest = substr($0, RSTART + RLENGTH)
      if (!inblock) {
        if (n >= 3) {
          inblock = 1; openlen = n
          collect = (rest ~ /(^|[ \t])host-verify([ \t]|$)/) ? 1 : 0
        }
        next
      }
      probe = rest; gsub(/[ \t]/, "", probe)
      if (n >= openlen && probe == "") { inblock = 0; collect = 0; next }
      # shorter fence, or one carrying an info string: content of the outer block
    }
    inblock && collect { print }
    END { if (inblock) exit 3 }
  ' "$KICKOFF"
)" || {
  AWK_RC=$?
  if [ "$AWK_RC" -eq 3 ]; then
    printf '❌ host-verify: %s has an UNTERMINATED fenced block.\n' "${KICKOFF#"$REPO_ROOT/"}" >&2
    printf '   Refusing to guess where it ends — an unclosed fence would turn prose into commands.\n' >&2
    exit 2
  fi
  exit 2
}
COMMANDS="$(printf '%s\n' "$COMMANDS" | grep -vE '^[[:space:]]*(#|$)' || true)"

if [ -z "$COMMANDS" ]; then
  printf '❌ host-verify: %s declares no `host-verify` contract block.\n' "${KICKOFF#"$REPO_ROOT/"}" >&2
  printf '   A missing contract is a FAIL, not a pass — see .claude/rules/destination-environment-verification.md §1.\n' >&2
  exit 2
fi

# A contract made only of no-ops is not a contract. This does NOT judge substance (that is
# review-time judgment, rule §4 `#optout-as-reflex`) — it closes the one bypass that is
# cheaper than the documented opt-out: the opt-out costs a >=20-char rationale a reviewer
# reads, whereas `:` would cost one character and leave no reviewable marker at all.
SUBSTANTIVE="$(printf '%s\n' "$COMMANDS" | grep -vE '^[[:space:]]*(:|true|exit[[:space:]]+0)[[:space:]]*$' || true)"
if [ -z "$SUBSTANTIVE" ]; then
  printf '❌ host-verify: %s declares a contract of no-ops only (`:`/`true`/`exit 0`).\n' "${KICKOFF#"$REPO_ROOT/"}" >&2
  printf '   Declare the real host commands, or opt out explicitly with a rationale.\n' >&2
  exit 2
fi

REL_KICKOFF="${KICKOFF#"$REPO_ROOT/"}"
printf '── host-verify: %s\n' "$REL_KICKOFF"
printf '   host=%s  repo=%s\n' "$(uname -s)" "$REPO_ROOT"

if [ "$LIST_ONLY" = true ]; then
  printf '%s\n' "$COMMANDS" | while IFS= read -r c; do printf '   • %s\n' "$c"; done
  exit 0
fi

# Per-command wall-clock bound. Without one, a watch-mode runner or a lock/network wait
# stalls forever, and in an unattended run a stall is indistinguishable from "still working"
# — the same silence-vs-death confusion this repo tracks as finding F2.
HV_TIMEOUT="${HOST_VERIFY_TIMEOUT:-900}"
TIMEOUT_BIN=""
for _t in timeout gtimeout; do
  if command -v "$_t" >/dev/null 2>&1; then TIMEOUT_BIN="$_t"; break; fi
done
if [ -z "$TIMEOUT_BIN" ]; then
  printf '⚠ host-verify: no `timeout`/`gtimeout` on PATH — commands run UNBOUNDED.\n' >&2
  printf '   This is a degraded run, not a safe one: a hung command will stall instead of failing.\n' >&2
fi

FAILED=0
TOTAL=0
# Read from a here-string, not a pipe: a piped `while` runs in a subshell on some shells and
# the FAILED/TOTAL counters would be lost at the end of the loop.
while IFS= read -r CMD; do
  [ -n "$CMD" ] || continue
  TOTAL=$((TOTAL + 1))
  printf '\n▶ [%d] %s\n' "$TOTAL" "$CMD"
  # `-o pipefail` INSIDE the child: this script's own `set -o pipefail` does not propagate
  # across `bash -c`, so without it a declared `npx vitest run x | tee log` would report the
  # exit status of `tee` and a real test failure would pass the contract.
  # `</dev/null` so a declared command can never block the gate waiting on stdin.
  if (cd "$REPO_ROOT" && ${TIMEOUT_BIN:+$TIMEOUT_BIN "$HV_TIMEOUT"} bash -o pipefail -c "$CMD" </dev/null); then
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
