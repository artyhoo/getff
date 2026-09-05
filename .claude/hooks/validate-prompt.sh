#!/usr/bin/env bash
# Wave 7 sub-wave 7.2.b — PostToolUse hook: validate batch-spec on orchestrator-prompts.
# Fires on Edit|Write|MultiEdit tool calls. Input: hook JSON via stdin (tool_input.file_path).
# Exits 0 silently on pass or unmatched path; non-zero + diagnostic on red.
# Gracefully skips if jq or tsx unavailable (never block tool calls for missing tooling).
# @cc-only-rationale: edit-time PostToolUse delivery; the validator itself is portable
#   (packages/core/spec-validation/validate-batch-spec.ts) — the hook is only its CC
#   fire-point. No portable hook fires at edit-time.
# @file-content-gate: this hook validates a file's content (path-only — no internal
#   tool_name filter), so its registration matcher MUST be Edit|Write|MultiEdit (else a
#   MultiEdit that violates the spec slips past silently). Enforced by check-hook-marker.sh.

set -uo pipefail

# @plugin-transform: manual — the twin drops the Wave-7 header lines and the @file-content-gate
#   marker, so it cannot be regenerated in identity mode. The consumer-layout $VALIDATOR guard is
#   NO LONGER a twin-only addition: since the #1597 review-ledger L-2 fix both copies carry the
#   same _resolve_validator tier list + loud miss branch, and the source-side guard is no longer a
#   no-op (it fires on any layout without packages/core/). Keep the two blocks in sync by hand.
# Harness-portable output (inline — standalone in test sandboxes). ZCode swallows plain
# non-zero exits; JSON additionalContext reaches the model. CC VIOLATION path: exit 2 +
# stderr — the only non-JSON channel the model receives on PostToolUse; exit-1 stderr
# reaches the operator transcript but NOT the model (live-verified 2026-07-24 — see
# docs/meta-factory/research-patches/2026-07-24-posttooluse-channel-verification.md).
#
# Graceful-SKIP paths differ: they exit 0, and on an exit-0 PostToolUse the model receives
# ONLY JSON hookSpecificOutput — plain stdout/stderr reaches nobody (inject-matching-rule.sh
# :17 + :89-90). A dependency-missing skip on stderr is therefore indistinguishable from a
# pass. Sibling of the check-doc-authority.sh fix; same defect class, swept 2026-07-24
# (docs/meta-factory/research-patches/2026-07-23-aif-parity-s4-synthesis.md §3 item 1).
_is_zcode() { [ -n "${ZCODE_PROJECT_DIR:-}" ]; }
# JSON-escape WITHOUT jq — jq is precisely the dependency that may be missing here.
_json_escape() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | tr '\n' ' '; }
# Announce a skip on the channel the model actually receives on an exit-0 path, and keep
# the human/log channel too.
_emit_skip() {
  if _is_zcode; then
    printf '{"additionalContext":"%s"}\n' "$(_json_escape "$1")"
  else
    printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"%s"}}\n' \
      "$(_json_escape "$1")"
  fi
  printf '%s\n' "$1" >&2
}
_emit_ctx() { if _is_zcode && command -v jq >/dev/null 2>&1; then
    jq -n --arg c "$2" '{additionalContext:$c}'
  else printf '%s\n' "$2"; fi; }

# Announce at most ONCE PER SESSION (flag file keyed on session_id + tag). The bounded form
# of _emit_skip, for a dependency whose absence is STRUCTURAL rather than transient: a gate
# that can never resolve on this layout would otherwise nag on every prompt edit for the whole
# session (the permanent-loud-skip defect, #1597 review ledger A3-6).
# Precedent: .claude/hooks/check-doc-authority-header.sh (jq guard, GH #934).
_emit_skip_once() {
  # No session_id (a non-CC caller, or a harness that omits the field) → announce EVERY time.
  # Suppression needs a session to scope to; without one the choice is between a shared
  # global key — which silences unrelated later runs after the first — and repeating the
  # notice. Repeating is the safe direction: this whole fix exists because silence reads as
  # a pass.
  [ -z "${SESSION_ID:-}" ] && { _emit_skip "$2"; return 0; }
  local flag="${TMPDIR:-/tmp}/aif-$1-${SESSION_ID}"
  [ -f "$flag" ] && return 0
  : > "$flag" 2>/dev/null || true
  _emit_skip "$2"
}

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

# Resolve the batch-spec validator through a tier list — framework layout first, vendor drop
# second. Mirrors the `_resolve_dispatch_ts` precedent (.claude/hooks/runtime-bridge-dispatch.sh,
# PR #1448), which closed exactly this defect class: a shipped artefact that resolves a
# FRAMEWORK-ONLY path and then exits 0 is a permanent silent no-op on every consumer,
# indistinguishable from a pass (#1597 review ledger L-2).
#
# Honest note on tier 2: no delivery site ships packages/core today (install.sh vendors only
# packages/runtime-bridge). The tier exists so a future vendor drop is found; TODAY the
# load-bearing half of this fix is the loud miss branch below.
_resolve_validator() {
  local candidate
  for candidate in \
    "$REPO_ROOT/packages/core/spec-validation/validate-batch-spec.ts" \
    "$REPO_ROOT/.claude/vendor/core/spec-validation/validate-batch-spec.ts"; do
    [[ -f "$candidate" ]] && { printf '%s' "$candidate"; return 0; }
  done
  return 1
}

# Escape token (rationale-bearing opt-out, ci-tool-pinning.md §3 precedent): a project that
# deliberately runs without this gate silences the notice instead of living with it.
[[ "${AIF_VALIDATE_PROMPT:-1}" == "0" ]] && exit 0

# Graceful-but-loud skip if jq unavailable. jq-less best-effort path extraction (sed on
# raw stdin) scopes the notice to orchestrator-prompts *.md edits (or unparseable stdin —
# conservative) instead of announcing on every Edit/Write in a jq-less environment.
if ! command -v jq >/dev/null 2>&1; then
  _RAW_PATH="$(sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
  case "$_RAW_PATH" in
    *.claude/orchestrator-prompts/*.md | "")
      _emit_skip '⚠ validate-prompt: jq unavailable — batch-spec validation DID NOT RUN for this edit. This is a SKIP, not a pass; install jq to restore enforcement.' ;;
  esac
  exit 0
fi

# Read stdin ONCE: the session_id is needed for the once-per-session skip flag below, and
# stdin is not re-readable after `cat`.
INPUT="$(cat)"
FILE_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null || true)"
SESSION_ID="$(printf '%s' "$INPUT" | jq -r '.session_id // ""' 2>/dev/null || true)"

# Only process files under .claude/orchestrator-prompts/**/*.md
if [[ -z "$FILE_PATH" ]] || [[ "$FILE_PATH" != *".claude/orchestrator-prompts/"*".md" ]]; then
  exit 0
fi

# Runtime dependency: the batch-spec validator. A miss is announced, never swallowed — on an
# exit-0 PostToolUse the model receives ONLY JSON hookSpecificOutput, so a bare `exit 0` here
# reads to the model exactly like a clean pass. Ordered AFTER the path filter so only an
# orchestrator-prompts edit can trigger the notice.
VALIDATOR="$(_resolve_validator)" || {
  _emit_skip_once 'vp-novalidator' '⚠ validate-prompt: the batch-spec validator (packages/core/spec-validation/validate-batch-spec.ts) is not present on this layout — batch-spec validation DID NOT RUN for this edit, and will not run this session. This is a SKIP, not a pass. Set AIF_VALIDATE_PROMPT=0 to opt out. Announced once per session.'
  exit 0
}

# Resolve tsx through tiers: repo-local, main-worktree (git --git-common-dir), PATH.
# Ordered after the jq check so a missing-jq skip fires first (matches pre-fix ordering).
# Tier-miss is announced on the model channel via _emit_skip (NEVER silent — silent exit 0
# is indistinguishable from a pass, the defect class this sweep closes).
TSX="$(_resolve_tsx)" || {
  _emit_skip '⚠ validate-prompt: tsx not found — batch-spec validation DID NOT RUN for this edit. This is a SKIP, not a pass.'
  exit 0
}

# Validator exit 2 = gh CLI unavailable (soft-skip inside validate-batch-spec.ts). A silent
# exit 0 here is the same dependency-skip defect class as the jq/tsx guards above — in the
# aif container gh IS absent, so the gh-dependent cross-checks never ran and nobody knew.
# Capture output so that under ZCode a violation reaches the model (non-zero exit + stderr is
# swallowed by ZCode; JSON additionalContext is merged into the tool result).
VALIDATOR_OUT="$("$TSX" "$VALIDATOR" "$FILE_PATH" 2>&1 1>/dev/null)"
STATUS=$?
if [[ $STATUS -eq 2 ]]; then
  _emit_skip '⚠ validate-prompt: gh CLI unavailable — the gh-dependent spec cross-checks DID NOT RUN for this edit (soft-skip by validate-batch-spec.ts). This is a partial SKIP, not a pass; install gh to restore full validation.'
  exit 0
fi
if [[ $STATUS -ne 0 ]] && _is_zcode; then
  _emit_ctx "PostToolUse" "❌ validate-prompt: batch-spec validation failed for ${FILE_PATH#${REPO_ROOT}/}
$VALIDATOR_OUT"
  exit 0
fi
# CC path: re-emit captured stderr, then exit 2 on violation — the only non-JSON channel
# the model receives on PostToolUse (exit-1 stderr reaches the operator only; live-verified
# 2026-07-24). Guard: emit only when non-empty (success-path emits nothing).
[[ -n "$VALIDATOR_OUT" ]] && printf '%s\n' "$VALIDATOR_OUT" >&2
[[ $STATUS -ne 0 ]] && exit 2
exit 0
