#!/usr/bin/env bash
# PostToolUse hook — runtime-bridge dispatch for meta-launch kickoffs.
#
# @cc-only-rationale: edit-time PostToolUse enforcement — no portable hook fires
#   at the same moment (deterministic trigger only available in CC harness).
#   Portable equivalent: `tsx packages/runtime-bridge/src/cli/dispatch.ts <path>`
#   run manually after kickoff authoring.
# spec: packages/runtime-bridge/src/cli/dispatch.ts
#
# Fires on Write|Edit tool events. Reads stdin JSON (CC PostToolUse shape):
#   { tool_name, tool_input: { file_path } }
#
# Path filter: matches .claude/orchestrator-prompts/<anything>-meta-launch/kickoff.md
#   (the *-meta-launch/kickoff.md glob). Other file writes are silently ignored.
#
# Per-task opt-IN (kickoff §7, maintainer decision 2026-05-31): auto-dispatch
#   is real, metered autonomous work — the hook fires ONLY when the first line
#   of file_path is exactly `<!-- bridge: auto -->` (trimmed match). Default =
#   no auto-dispatch; manual flow stays
#   `tsx packages/runtime-bridge/src/cli/dispatch.ts <kickoff>` on demand.
#   The `<!-- bridge: skip -->` marker in kickoff.ts keeps serving the manual
#   dispatch.ts path (/dispatcher, /pipeline) unchanged.
#
# Fallback: on quota_exceeded / unavailable → dispatch.ts auto-falls-back to
#   ManualBackend and emits copy-paste instructions to stderr.
#
# Output contract (verified 2026-05-22, code.claude.com/docs/en/hooks.md):
#   plain stdout IGNORED for PostToolUse — context must be JSON additionalContext.
#   This hook exits 0 always (injection, never a gate per
#   .claude/rules/rule-enforcement-channel-selection.md §4).
#
# NC-3 (round-6, scoped 2026-05-31): The AI *agent* must NOT write settings.json —
#   the deny-list ("Edit(.claude/settings.json)", "Write(.claude/settings.json)") in
#   .claude/settings.json blocks the agent's Write/Edit tool calls.
#   The *human-run consumer setup script* (packages/runtime-bridge/scripts/
#   setup-runtime-bridge.sh) MAY write settings.json with backup + JSON-validation +
#   consent — it is not bound by the agent tool-permission deny-list.
set -uo pipefail

# ── Dependency guard — loud when it actually swallows work ───────────────────
# A silent exit here on an auto-marked bridge kickoff means a dispatch the author asked
# for never happened and nobody was told (the dependency-skip defect class, aif-parity S4
# §3 item 1). jq-less best-effort parse (sed) recovers the path; the notice fires ONLY
# when the file carries the `<!-- bridge: auto -->` opt-in — every other edit stays
# silent (this hook is an injection, never a gate).
_json_escape() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | tr '\n' ' '; }
_emit_dep_skip() {
  printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"%s"}}\n' \
    "$(_json_escape "$1")"
  printf '%s\n' "$1" >&2
}
if ! command -v jq >/dev/null 2>&1 || ! command -v node >/dev/null 2>&1; then
  _RAW_PATH="$(sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
  case "$_RAW_PATH" in
    *.claude/orchestrator-prompts/*/kickoff.md)
      if [ -f "$_RAW_PATH" ] \
         && [ "$(head -1 "$_RAW_PATH" | tr -d '[:space:]')" = '<!--bridge:auto-->' ]; then
        _emit_dep_skip '⚠ runtime-bridge-dispatch: jq/node unavailable — the auto-dispatch this kickoff opted into DID NOT RUN. Dispatch manually: tsx packages/runtime-bridge/src/cli/dispatch.ts <kickoff-path>.'
      fi ;;
  esac
  exit 0
fi

# ── Parse stdin ──────────────────────────────────────────────────────────────
INPUT="$(cat)"
TOOL="$(printf '%s' "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || true)"
FILE_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null || true)"

# Only fire on Write or Edit events
case "$TOOL" in
  Write|Edit|MultiEdit) ;;
  *) exit 0 ;;
esac

[[ -z "$FILE_PATH" ]] && exit 0

# ── Path filter ──────────────────────────────────────────────────────────────
# *-meta-launch/kickoff.md: SKIP (pipeline-ux P4). These are /pipeline dispatch
#   records written by the SKILL, not umbrella kickoffs to send to aif. Auto-
#   dispatch here creates a spurious aif task that must be hand-parked on every
#   /pipeline invocation. Dispatch happens explicitly via /dispatcher instead.
# */kickoff.md (other): active — umbrella kickoffs written directly by an agent
#   or operator should dispatch to aif.
# Bash glob note: the [[ == ]] pattern uses bash extglob (not regex); we use
# a case statement for broader compatibility.
case "$FILE_PATH" in
  *-meta-launch/kickoff.md) exit 0 ;;  # pipeline-ux P4: skip /pipeline dispatch records
  */kickoff.md) ;;
  *) exit 0 ;;
esac

# ── File must exist (Write may fire before flush on some CC versions) ────────
[[ -f "$FILE_PATH" ]] || exit 0

# ── Opt-IN gate (kickoff §7, maintainer decision 2026-05-31) ──────────────────
# Only a kickoff whose FIRST line is exactly `<!-- bridge: auto -->` may
# auto-dispatch. Trimmed-exact match mirrors the kickoff.ts skip-marker
# precedent (covers CRLF / trailing whitespace).
first=$(head -n1 "$FILE_PATH" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
[ "$first" = '<!-- bridge: auto -->' ] || exit 0

# ── Locate repo root + entrypoint ────────────────────────────────────────────
# Two-tier resolution, framework first, vendor second. This same file ships to BOTH
# audiences (framework repo via .claude/hooks/, consumer via the vendor drop at
# setup.d/55-runtime-bridge-vendor.sh), and the two layouts put dispatch.ts in
# different places — a single hardcoded path is wrong for exactly one of them.
#
# It was wrong for the consumer: the single-path form resolved only
# `packages/runtime-bridge/src/cli/dispatch.ts`, which no consumer install has (the
# vendor drop lands at `.claude/vendor/runtime-bridge/`). The `! -f` branch below then
# exited 0 with a comment claiming the consumer had «opted out» — but a factory-profile
# consumer opted IN, got the vendor copy, and still saw a silent no-op. Measured
# 2026-08-17 on a real `install.sh ts-server --full --force --profile factory` fixture:
# hook fired, found nothing, exited 0 silently; symlinking the vendor dir onto the
# framework path made the very same hook dispatch successfully. Same defect class as the
# per-file allowlist audit that surfaced it (a shipped artefact addressing a
# framework-only path), but in executable code rather than prose.
#
# Tier order is framework-first so the framework repo — where BOTH paths can exist once a
# vendor copy is present in-tree — keeps dispatching through its own source of truth.
# Mirrors the `_resolve_tsx` tier-list precedent (.claude/hooks/check-doc-authority.sh,
# PR #1126): try each candidate, use the first that exists, announce nothing on success.
REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

_resolve_dispatch_ts() {
  local candidate
  for candidate in \
    "$REPO_ROOT/packages/runtime-bridge/src/cli/dispatch.ts" \
    "$REPO_ROOT/.claude/vendor/runtime-bridge/src/cli/dispatch.ts"; do
    [[ -f "$candidate" ]] && { printf '%s' "$candidate"; return 0; }
  done
  return 1
}

DISPATCH_TS="$(_resolve_dispatch_ts)" || {
  # Genuine no-op: neither the framework package nor the vendor drop is present, so the
  # consumer really did opt out of runtime-bridge (no `--profile factory`, no
  # `--with-aif-suite`). Silent by design — a project without the bridge should not be
  # nagged on every kickoff write.
  exit 0
}

# ── Invoke dispatch entrypoint ────────────────────────────────────────────────
# Use tsx (TypeScript executor) if available; fall back to node with --loader.
# dispatch.ts exits 0 always and outputs JSON hookSpecificOutput.additionalContext.
if command -v tsx >/dev/null 2>&1; then
  RESULT="$(tsx "$DISPATCH_TS" "$FILE_PATH" 2>/tmp/runtime-bridge-dispatch-stderr.txt)"
elif command -v npx >/dev/null 2>&1; then
  RESULT="$(npx --yes tsx "$DISPATCH_TS" "$FILE_PATH" 2>/tmp/runtime-bridge-dispatch-stderr.txt)"
else
  # Neither tsx nor npx — fall back to manual instructions via stderr
  printf '[runtime-bridge] tsx not found — paste kickoff manually: %s\n' "$FILE_PATH" >&2
  exit 0
fi

# ── Forward JSON output (additionalContext) ───────────────────────────────────
if [[ -n "$RESULT" ]]; then
  printf '%s\n' "$RESULT"
fi

exit 0
