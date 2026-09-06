#!/usr/bin/env bash
# Wave 7 7.2.c — PostToolUse: principle-09 authority header quick-check.
# Delegates to 09-doc-authority-hierarchy.bin.ts (Batch A, sub-wave 7.1.c).
# Input: hook JSON via stdin. CLI filters to REQUIRED_HEADER_DOCS; exits 0 for other paths.
# @cc-only-rationale: edit-time PostToolUse delivery of the principle-09 authority-header
#   check (delegates to 09-doc-authority-hierarchy.bin.ts). The same rule's portable
#   enforcement is the principle-09 CI test itself — a rule+test lifecycle, excluded from
#   @dual-pair per dual-implementation-discipline.md §9; no portable hook fires at edit-time.
# @file-content-gate: this hook validates a file's content (path-only — no internal
#   tool_name filter), so its registration matcher MUST be Edit|Write|MultiEdit (else a
#   MultiEdit that strips an authority header slips past silently). Enforced by check-hook-marker.sh.
set -uo pipefail

# Harness-portable output (inline — standalone in test sandboxes). ZCode swallows plain
# non-zero exits; JSON additionalContext reaches the model. CC VIOLATION path: exit 2 +
# stderr — the only non-JSON channel the model receives on PostToolUse. Exit-1 stderr
# reaches the operator transcript but NOT the model (live-verified both directions from
# the model's own vantage 2026-07-24 — see
# docs/meta-factory/research-patches/2026-07-24-posttooluse-channel-verification.md; the
# earlier "exit 1 byte-for-byte" contract locked a channel the model never received).
#
# Graceful-SKIP paths are a different case: they exit 0, and on an exit-0 PostToolUse the
# model receives ONLY JSON hookSpecificOutput — plain stdout/stderr reaches nobody
# (inject-matching-rule.sh:17 + :89-90, the proven channel). A dependency-missing skip
# announced on stderr is therefore indistinguishable from a pass. Observed live in the aif
# container on 2026-07-23, where `jq` is absent and the notice reached no one:
# docs/meta-factory/research-patches/2026-07-23-aif-parity-s4-synthesis.md §3 item 1.

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
    '⚠ check-doc-authority: lib/hook-emit.sh could not be sourced — this gate DID NOT RUN for this edit. This is a SKIP, not a pass; reinstall the hooks.'
  exit 0
fi

# Resolve the tsx runner through a tier list (linked worktrees carry no node_modules):
#   1. repo-local  2. main worktree via git --git-common-dir  3. tsx on PATH
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

# Resolve the principle-09 bin through a tier list — framework layout first, vendor drop
# second. Mirrors the `_resolve_dispatch_ts` precedent (.claude/hooks/runtime-bridge-dispatch.sh,
# PR #1448), which closed exactly this defect class for the dispatch hook: a shipped artefact
# that resolves a FRAMEWORK-ONLY path and then exits 0 is a permanent silent no-op on every
# consumer, indistinguishable from a pass.
#
# Honest note on tier 2: no delivery site ships packages/core today — install.sh vendors only
# packages/runtime-bridge (install.sh `.claude/vendor/runtime-bridge`), and
# `packages/core/principles/*.bin.ts` appears in no manifest. The tier exists so a future
# vendor drop is found without another silent-no-op incident; TODAY the load-bearing half of
# this fix is the loud miss branch below, not the second candidate.
_resolve_bin() {
  local candidate
  for candidate in \
    "$REPO_ROOT/packages/core/principles/09-doc-authority-hierarchy.bin.ts" \
    "$REPO_ROOT/.claude/vendor/core/principles/09-doc-authority-hierarchy.bin.ts"; do
    [[ -f "$candidate" ]] && { printf '%s' "$candidate"; return 0; }
  done
  return 1
}

# Escape token (rationale-bearing opt-out, ci-tool-pinning.md §3 precedent; same variable the
# consumer-side sibling check-doc-authority-header.sh already honours): a project that
# deliberately runs without this gate silences the notice instead of living with it.
[[ "${AIF_DOC_AUTHORITY:-1}" == "0" ]] && exit 0

if ! command -v jq >/dev/null 2>&1; then
  _emit_skip '⚠ check-doc-authority: jq unavailable — the principle-09 authority-header check DID NOT RUN for this edit. This is a SKIP, not a pass; install jq to restore enforcement.'
  exit 0
fi

# Read stdin ONCE: the session_id is needed for the once-per-session skip flag below, and
# stdin is not re-readable after `cat`.
INPUT="$(cat)"
ABS_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null || true)"
SESSION_ID="$(printf '%s' "$INPUT" | jq -r '.session_id // ""' 2>/dev/null || true)"
[[ -z "$ABS_PATH" ]] && exit 0

# Convert absolute path to repo-root-relative (CLI API expects relative paths)
REL_PATH="${ABS_PATH#"$REPO_ROOT/"}"
[[ "$REL_PATH" = "$ABS_PATH" ]] && exit 0   # outside repo — skip

# Extension prefilter BEFORE any spawn. Every path the bin can require is markdown — the
# static REQUIRED_HEADER_DOCS list is *.md throughout and all four REQUIRED_PATH_PATTERNS
# (packages/core/principles/09-doc-authority-hierarchy.ts:177-182) end in `\.md$` — so a
# non-markdown edit can only ever make the bin exit 0 after a ~0.45 s cold tsx boot.
# Measured 0.44-0.46 s per no-op edit (#1597 review ledger F-3).
case "$REL_PATH" in
  *.md | *.markdown) ;;
  *) exit 0 ;;
esac

# Runtime dependency: the principle-09 CLI shim. A miss is announced, never swallowed —
# on an exit-0 PostToolUse the model receives ONLY JSON hookSpecificOutput, so a bare
# `exit 0` here reads to the model exactly like a clean pass (#1597 review ledger L-2).
BIN="$(_resolve_bin)" || {
  _emit_skip_once 'cda-nobin' '⚠ check-doc-authority: the principle-09 CLI shim (packages/core/principles/09-doc-authority-hierarchy.bin.ts) is not present on this layout — the authority-header check DID NOT RUN for this edit, and will not run this session. This is a SKIP, not a pass. On a consumer install the equivalent gate is .claude/hooks/check-doc-authority-header.sh (zero-dep, shipped by setup.d/10-skills.sh); set AIF_DOC_AUTHORITY=0 to opt out of both. Announced once per session.'
  exit 0
}

# Resolve tsx through tiers: repo-local, main-worktree (git --git-common-dir), PATH.
# Ordered after the jq check so a missing-jq skip fires first (matches pre-fix ordering).
TSX="$(_resolve_tsx)" || {
  _emit_skip '⚠ check-doc-authority: tsx not found — the principle-09 authority-header check DID NOT RUN for this edit. This is a SKIP, not a pass.'
  exit 0
}

# Delegate; capture output so under ZCode a violation reaches the model (plain exit 1 + stderr
# is swallowed by ZCode — JSON additionalContext is merged into the tool result). Under CC the
# bin's stderr + non-zero exit is preserved byte-for-byte.
BIN_ERR="$("$TSX" "$BIN" "$REL_PATH" 2>&1 1>/dev/null)"
STATUS=$?
if [[ $STATUS -ne 0 ]] && _is_zcode; then
  _emit_ctx "PostToolUse" "❌ check-doc-authority: principle-09 authority-header check failed for $REL_PATH.
$BIN_ERR"
  exit 0
fi
# Guard: emit only when non-empty (otherwise success-path emits a stray \n).
[[ -n "$BIN_ERR" ]] && printf '%s\n' "$BIN_ERR" >&2
# CC violation → exit 2 (stderr feeds the model); success → 0.
[[ $STATUS -ne 0 ]] && exit 2
exit 0
