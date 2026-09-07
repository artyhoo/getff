#!/usr/bin/env bash
# PostToolUse gate — M6 edit-time channel for `#worker-dispatch-via-subagent`.
# On Edit|Write|MultiEdit of a `.claude/orchestrator-prompts/<umbrella>/kickoff.md`,
# delegates to the SINGLE shared matcher (29-worker-dispatch-channel.bin.ts → .ts)
# and exit 2 on a hit (the PostToolUse channel the MODEL receives — see the tail
# comment). Both this hook and principle 29's CI test call that one
# matcher — never two divergent copies (anti-pattern `#two-prompts-drift`).
#
# @dual-pair: channel-discipline-worker-dispatch
# @cc-only-rationale: edit-time PostToolUse enforcement is the earliest reachable
#   channel for the kickoff author; it fires only for the session editing the file
#   in Claude Code. The harness-agnostic backstop is the paired CI principle test
#   (packages/core/principles/29-worker-dispatch-channel.test.ts), which catches any
#   kickoff authored outside CC or pasted in pre-wired — together they cover both
#   the earliest-channel and the portability goals (spec §3, dual-implementation §6).
# spec: docs/meta-factory/research-patches/2026-06-27-meta-orch-channel-discipline-mechanism.md
#
# MAINTAINER WIRING (agent-uncommittable — add to ~/.claude/settings.json by hand):
#   Append this object to .hooks.PostToolUse (alongside the existing Edit|Write|MultiEdit
#   entries, e.g. check-kickoff-traps.sh / check-doc-authority.sh):
#     {
#       "matcher": "Edit|Write|MultiEdit",
#       "hooks": [
#         { "type": "command",
#           "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/check-worker-dispatch-channel.sh" }
#       ]
#     }
#   Until wired, the CI principle test is the active backstop (no enforcement gap —
#   it gates every PR; the hook only moves the gate earlier, to edit-time).
#
# Graceful no-op (exit 0) without jq/tsx, off-path, or when the bin shim is absent —
# repo PostToolUse-gate convention (cf. check-doc-authority.sh).
set -uo pipefail

# Harness-portable output (inline — standalone in test sandboxes). ZCode swallows plain
# non-zero exits; JSON additionalContext reaches the model. CC VIOLATION path: exit 2 + stderr.
# Graceful-SKIP paths differ: they exit 0, and on an exit-0 PostToolUse the model receives
# ONLY JSON hookSpecificOutput — plain stdout/stderr reaches nobody (inject-matching-rule.sh
# :17 + :89-90). A dependency-missing skip on stderr is therefore indistinguishable from a
# pass. Sibling of the check-doc-authority.sh fix; same defect class, swept 2026-07-24.

# ── Shared emit prelude (#1597 review ledger R-2, K-1) ────────────────────────
# _is_zcode / _json_escape / _emit_skip / _emit_skip_once / _emit_ctx and the Homebrew PATH
# prepend have ONE definition, at lib/hook-emit.sh. Five gates used to carry a private 13-line
# copy each; the copies had begun to diverge (a lost _is_zcode branch, a sed escaper that
# produced invalid JSON for a tab or CR). Resolved next to THIS file so the framework copy and
# the plugin twin each load their own sibling — both channels ship the directory.
# Pure parameter expansion — no `dirname`, no `cd`, no subshell. These gates run on a
# stripped PATH (a jq-less consumer, a sandbox that rebuilt PATH to hide a tool), and the
# prelude must resolve before any external command is known to exist.
_HOOK_DIR="${BASH_SOURCE[0]%/*}"
[ "$_HOOK_DIR" = "${BASH_SOURCE[0]}" ] && _HOOK_DIR="."
_HOOK_LIB="$_HOOK_DIR/lib/hook-emit.sh"
# shellcheck source=lib/hook-emit.sh
if ! . "$_HOOK_LIB" 2>/dev/null; then
  # Broken install: announce on the model channel with constant text (no escaper available
  # yet) and exit 0 — a missing prelude must not block the edit.
  printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"%s"}}\n' \
    '⚠ check-worker-dispatch-channel: lib/hook-emit.sh could not be sourced — this gate DID NOT RUN for this edit. This is a SKIP, not a pass; reinstall the hooks.'
  exit 0
fi

# Resolve the tsx runner through a tier list (linked worktrees carry no node_modules):
#   1. repo-local  2. main worktree via git --git-common-dir  3. tsx on PATH
# Reference: .claude/hooks/check-doc-authority.sh _resolve_tsx (PR #1126).
_resolve_tsx() {
  local candidate="$REPO_ROOT/node_modules/.bin/tsx"
  [[ -x "$candidate" ]] && { printf '%s' "$candidate"; return 0; }
  local common_dir
  common_dir="$(git -C "$REPO_ROOT" rev-parse --git-common-dir 2>/dev/null || true)"
  if [[ -n "$common_dir" ]]; then
    [[ "$common_dir" != /* ]] && common_dir="$REPO_ROOT/$common_dir"
    local main_root="${common_dir%/*}"
    candidate="$main_root/node_modules/.bin/tsx"
    [[ -x "$candidate" ]] && { printf '%s' "$candidate"; return 0; }
  fi
  local on_path; on_path="$(command -v tsx 2>/dev/null || true)"
  [[ -n "$on_path" ]] && { printf '%s' "$on_path"; return 0; }
  return 1
}

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

# Resolve the principle-29 matcher bin through a tier list — framework layout first, vendor
# drop second. Mirrors the `_resolve_dispatch_ts` precedent
# (.claude/hooks/runtime-bridge-dispatch.sh, PR #1448), which closed exactly this defect class:
# a shipped artefact that resolves a FRAMEWORK-ONLY path and then exits 0 is a permanent
# silent no-op on every consumer, indistinguishable from a pass.
#
# Honest note on tier 2: no delivery site ships packages/core today (install.sh vendors only
# packages/runtime-bridge). The tier exists so a future vendor drop is found; TODAY the
# load-bearing half of this fix is the loud miss branch below.
_resolve_bin() {
  local candidate
  for candidate in \
    "$REPO_ROOT/packages/core/principles/29-worker-dispatch-channel.bin.ts" \
    "$REPO_ROOT/.claude/vendor/core/principles/29-worker-dispatch-channel.bin.ts"; do
    [[ -f "$candidate" ]] && { printf '%s' "$candidate"; return 0; }
  done
  return 1
}

# Escape token (rationale-bearing opt-out, ci-tool-pinning.md §3 precedent): a project that
# deliberately runs without this gate silences the notice instead of living with it.
[[ "${AIF_WORKER_DISPATCH_CHANNEL:-1}" == "0" ]] && exit 0

# Graceful-but-LOUD skip if jq is unavailable. The pre-fix `|| exit 0` was silent while the
# sibling in the same plugin payload (check-doc-authority.sh) announced the identical
# dependency-miss — two dependency-skip contracts for one class of check, and this file's own
# comment below already states a silent exit 0 is indistinguishable from a pass
# (#1597 review ledger E-6). jq-less best-effort path extraction (sed on raw stdin) scopes the
# notice to kickoff.md edits, so a jq-less environment is not announced on every Edit/Write.
if ! command -v jq >/dev/null 2>&1; then
  _RAW="$(cat)"
  _RAW_PATH="$(printf '%s' "$_RAW" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
  case "$_RAW_PATH" in
    */.claude/orchestrator-prompts/*/kickoff.md)
      SESSION_ID="$(printf '%s' "$_RAW" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
      _emit_skip_once 'cwdc-nojq' '⚠ check-worker-dispatch-channel: jq unavailable — the #worker-dispatch-via-subagent check DID NOT RUN for this edit, and will not run this session. This is a SKIP, not a pass; install jq to restore enforcement. Announced once per session.' ;;
  esac
  exit 0
fi

INPUT="$(cat)"
TOOL="$(printf '%s' "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || true)"
ABS_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null || true)"
SESSION_ID="$(printf '%s' "$INPUT" | jq -r '.session_id // ""' 2>/dev/null || true)"

case "$TOOL" in Edit | Write | MultiEdit) ;; *) exit 0 ;; esac
[[ -z "$ABS_PATH" ]] && exit 0

REL_PATH="${ABS_PATH#"$REPO_ROOT/"}"
[[ "$REL_PATH" = "$ABS_PATH" ]] && exit 0   # outside repo — skip

# Narrow: only kickoff.md under orchestrator-prompts (one path segment for <umbrella>).
case "$REL_PATH" in
  .claude/orchestrator-prompts/*/kickoff.md) ;;
  *) exit 0 ;;
esac

# Runtime dependency: the principle-29 matcher shim. A miss is announced, never swallowed —
# on an exit-0 PostToolUse the model receives ONLY JSON hookSpecificOutput, so a bare
# `exit 0` here reads to the model exactly like a clean pass (#1597 review ledger L-2).
# Ordered AFTER the path filter so only a kickoff edit — the population this gate claims to
# cover — can trigger the notice.
BIN="$(_resolve_bin)" || {
  _emit_skip_once 'cwdc-nobin' '⚠ check-worker-dispatch-channel: the principle-29 matcher shim (packages/core/principles/29-worker-dispatch-channel.bin.ts) is not present on this layout — the #worker-dispatch-via-subagent check DID NOT RUN for this kickoff, and will not run this session. This is a SKIP, not a pass; the harness-agnostic backstop is principle 29 in the framework CI, which a consumer repo does not run. Set AIF_WORKER_DISPATCH_CHANNEL=0 to opt out. Announced once per session.'
  exit 0
}

# Resolve tsx through tiers: repo-local, main-worktree (git --git-common-dir), PATH.
# Ordered after the path filter so off-path edits do NOT trigger a tsx-miss notice.
# Tier-miss is announced on the model channel via _emit_skip (NEVER silent — silent exit 0
# is indistinguishable from a pass; live-evidenced 2026-07-24 container audit PROBE 3:
# docs/meta-factory/research-patches/2026-07-24-container-gate-reachability.md:109).
TSX="$(_resolve_tsx)" || {
  _emit_skip '⚠ check-worker-dispatch-channel: tsx not found — the #worker-dispatch-via-subagent check DID NOT RUN for this edit. This is a SKIP, not a pass.'
  exit 0
}

# Delegate to the single shared matcher; its exit code IS this hook's exit code (under CC).
# Under ZCode a plain non-zero exit is swallowed — capture output and emit JSON additionalContext
# so the model sees the violation (merged into the tool result). CC behaviour is byte-identical.
BIN_ERR="$("$TSX" "$BIN" "$REL_PATH" 2>&1 1>/dev/null)"
STATUS=$?
if [[ $STATUS -ne 0 ]] && _is_zcode; then
  _emit_ctx "PostToolUse" "❌ check-worker-dispatch-channel: #worker-dispatch-via-subagent violation in $REL_PATH.
$BIN_ERR"
  exit 0
fi
# Guard: emit only when non-empty (otherwise success-path emits a stray \n).
[[ -n "$BIN_ERR" ]] && printf '%s\n' "$BIN_ERR" >&2
# CC violation → exit 2, NOT the matcher's own exit 1. Exit 2 is the only PostToolUse channel
# whose stderr reaches the MODEL; exit 1 reaches the operator transcript alone, so the model
# never learns of the violation and continues (live-verified both directions 2026-07-24,
# docs/meta-factory/research-patches/2026-07-24-posttooluse-channel-verification.md). The
# sibling gates in this same payload (validate-prompt.sh, check-doc-authority.sh) already
# convert; that 2026-07-24 sweep covered four gates and missed this one
# (#1597 review ledger D-1).
[[ $STATUS -ne 0 ]] && exit 2
exit 0
