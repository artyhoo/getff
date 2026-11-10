#!/usr/bin/env bash
# seal-primary-checkout.sh — PreToolUse deny gate — seal the PRIMARY checkout's protected paths
#
# CC path-based permission rules anchor to the session's primary working directory
# (code.claude.com/docs/en/permissions, "Read and Edit": a rule defined in project
# settings resolves to "<primary working directory>/path", so in a worktree session
# Edit(/src/**) matches THAT worktree's src/). Consequence measured 2026-10-01: a
# session running in a git worktree could Edit the ORIGINAL checkout's
# .claude/settings.json — the worktree copy was DENIED by the project deny rules,
# the primary copy passed through to content. The Write half never worked anywhere:
# "If you write a path rule for Write, NotebookEdit, Glob, or the legacy MultiEdit
# tool instead, Claude Code accepts the rule but never consults it, and warns at
# startup" (same docs page). So this hook checks tool_name + target path ITSELF and
# denies via the PreToolUse permissionDecision contract, independent of permission
# rule anchoring (docs/en/hooks: exit 0 + hookSpecificOutput.permissionDecision).
#
# Primary checkout resolution works from ANY linked worktree: in a worktree
# <wt>/.git is a pointer file and `git rev-parse --git-common-dir` exposes the
# PRIMARY checkout's .git, whose parent is the primary root. From the primary
# itself the common dir is its own .git, so the seal applies there too.
#
# Sealed set (exact file or subtree of the PRIMARY checkout):
#   .claude/settings.json        .claude/settings.local.json
#   .husky/**                    .git/hooks/**
#
# Fail-open outside the sealed set BY DESIGN (git absent, non-repo cwd, unparseable
# input, non-edit tool, jq missing): a global fail-closed would brick every session;
# fail-closed applies only to a RESOLVED sealed match. With jq absent a sed-based
# best-effort extraction still seals well-formed payloads (precedent:
# check-worker-dispatch-channel.sh — a dependency miss must not silently disable
# the gate).
#
# @cc-only-rationale: PreToolUse permissionDecision deny is the only channel that
#   cancels a file-tool call BEFORE it executes, and the sealed threat model itself
#   (permission rules anchoring to the session cwd + inert Write-path rules) is
#   CC-specific. Internal tooling (dual-implementation-discipline.md §3): protects
#   the framework repo's own dev environment; not shipped to consumer projects.
#
# MAINTAINER WIRING (agent-uncommittable — .claude/settings.json is denied to agents
# by its own permissions block; PR #279 precedent: hooks may ship unregistered):
#   Append this object to the hooks.PreToolUse array of .claude/settings.json
#   (alongside ask-question-reminder.sh / inject-subagent-context.sh /
#   inject-matching-rule.sh):
#     {
#       "matcher": "Edit|Write|MultiEdit",
#       "hooks": [
#         {
#           "type": "command",
#           "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/seal-primary-checkout.sh\""
#         }
#       ]
#     }
#   Until registered this hook is dormant (nothing invokes it); the paired test in
#   tests/hooks/seal-primary-checkout.test.sh is the proof of behaviour.
set -uo pipefail

# Homebrew PATH (CLAUDE.md §Harness gates): CC-launched hooks run with a stripped
# PATH, so a Homebrew jq reads as ABSENT without this. Only existing directories,
# prepended only once (mirrors .claude/hooks/lib/hook-emit.sh).
for _hb_dir in /opt/homebrew/bin /usr/local/bin; do
  [ -d "$_hb_dir" ] || continue
  case ":$PATH:" in
    *":$_hb_dir:"*) ;;
    *) PATH="$_hb_dir:$PATH" ;;
  esac
done
unset _hb_dir
export PATH

INPUT="$(cat 2>/dev/null)" || exit 0

# Parse tool_name / tool_input.file_path / cwd. jq first; sed fallback keeps the
# gate alive for single-line well-formed payloads when jq is missing.
if command -v jq >/dev/null 2>&1; then
  TOOL="$(printf '%s' "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || true)"
  FP="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null || true)"
  HOOK_CWD="$(printf '%s' "$INPUT" | jq -r '.cwd // ""' 2>/dev/null || true)"
else
  TOOL="$(printf '%s' "$INPUT" | sed -n 's/.*"tool_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
  FP="$(printf '%s' "$INPUT" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
  HOOK_CWD="$(printf '%s' "$INPUT" | sed -n 's/.*"cwd"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
fi

# Tool gate: only file-editing tools are in scope (do not rely on the registration
# matcher being exhaustive — the hook owns its decision).
case "$TOOL" in
  Edit | Write | MultiEdit) ;;
  *) exit 0 ;;
esac
[ -n "$FP" ] || exit 0
[ -n "$HOOK_CWD" ] || HOOK_CWD="$PWD"
[ -d "$HOOK_CWD" ] || exit 0

# Resolve the PRIMARY checkout root from the session cwd.
COMMON_DIR="$(cd "$HOOK_CWD" 2>/dev/null && git rev-parse --git-common-dir 2>/dev/null)" || exit 0
[ -n "$COMMON_DIR" ] || exit 0
case "$COMMON_DIR" in
  /*) ;;
  *) COMMON_DIR="$HOOK_CWD/$COMMON_DIR" ;;
esac
PRIMARY="$(cd "$COMMON_DIR/.." 2>/dev/null && pwd -P)" || exit 0

# Canonicalize the target: absolute-ize, then realpath -m when available (resolves
# symlinks of existing ancestors AND lexical ..; the target itself may not exist —
# Write creates). Lexical fallback: canonicalize the longest existing ancestor via
# pwd -P and keep the remainder verbatim (covers .. but not symlinked ancestors —
# documented degradation).
case "$FP" in
  /*) ;;
  *) FP="$HOOK_CWD/$FP" ;;
esac
FP_CANON=""
if command -v realpath >/dev/null 2>&1; then
  FP_CANON="$(realpath -m -- "$FP" 2>/dev/null)" || FP_CANON=""
fi
if [ -z "$FP_CANON" ]; then
  _anc="$FP"
  while [ ! -e "$_anc" ] && [ "$_anc" != "/" ]; do
    _anc="$(dirname "$_anc")"
  done
  if [ -e "$_anc" ]; then
    _anc_real="$(cd "$_anc" 2>/dev/null && pwd -P)" || _anc_real="$_anc"
    FP_CANON="$_anc_real${FP#"$_anc"}"
  else
    FP_CANON="$FP"
  fi
fi
unset _anc _anc_real

# The seal decision itself — allow unless the target resolves under the sealed set.
case "$FP_CANON" in
  "$PRIMARY/.claude/settings.json" | "$PRIMARY/.claude/settings.json"/* | \
    "$PRIMARY/.claude/settings.local.json" | "$PRIMARY/.claude/settings.local.json"/* | \
    "$PRIMARY/.husky" | "$PRIMARY/.husky"/* | \
    "$PRIMARY/.git/hooks" | "$PRIMARY/.git/hooks"/*) ;;
  *) exit 0 ;;
esac

# Deny with the standard PreToolUse contract (exit 0 + permissionDecision JSON so
# the reason reaches the model). jq builds a guaranteed-valid JSON string; the
# jq-less branch uses the lib/hook-emit.sh escaper family.
if command -v jq >/dev/null 2>&1; then
  REASON="$(jq -n --arg p "$FP_CANON" '"Sealed path (primary checkout): " + $p + " — protected from every session by .claude/hooks/seal-primary-checkout.sh. Edit the WORKTREE copy, or ask the maintainer for the sealed surfaces."')" || REASON=""
  if [ -n "$REASON" ]; then
    printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":%s}}\n' "$REASON"
    exit 0
  fi
fi
ESC="$(printf '%s' "$FP_CANON" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | tr '\n\r\t' '   ' | tr -d '\000-\037')"
printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Sealed path (primary checkout): %s — protected from every session by .claude/hooks/seal-primary-checkout.sh. Edit the WORKTREE copy, or ask the maintainer for the sealed surfaces."}}\n' "$ESC"
exit 0
