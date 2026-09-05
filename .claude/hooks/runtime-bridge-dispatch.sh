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
# Fallback: on an ENVIRONMENTAL failure (quota_exceeded / unavailable / timeout /
#   dispatch_failed) → dispatch.ts auto-falls-back to ManualBackend and emits
#   copy-paste instructions to stderr. On `spec_invalid` (the kickoff itself is
#   wrong — e.g. a `bridge-profile` marker naming a profile the runtime does not
#   have) dispatch.ts ABORTS instead: no task, no /tmp artefact, exit 2. This hook
#   still exits 0 — it forwards the abort text as additionalContext and never
#   blocks the Write (see the output contract below).
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
        # Name BOTH layouts. This file ships to the framework repo AND, via the vendor drop
        # (setup.d/55-runtime-bridge-vendor.sh), to every factory consumer — whose only copy
        # lives under .claude/vendor/runtime-bridge/. Naming the framework-only path sent the
        # consumer's model to a module that does not exist there (#1597 review ledger E-4);
        # _resolve_dispatch_ts below already knows both locations.
        _emit_dep_skip '⚠ runtime-bridge-dispatch: jq/node unavailable — the auto-dispatch this kickoff opted into DID NOT RUN. Dispatch manually with whichever path exists in this project: `tsx packages/runtime-bridge/src/cli/dispatch.ts <kickoff-path>` (framework checkout) or `tsx .claude/vendor/runtime-bridge/src/cli/dispatch.ts <kickoff-path>` (consumer install).'
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
  # NOT a genuine no-op. Control only reaches here past the opt-in gate above, i.e. the
  # kickoff's own first line is `<!-- bridge: auto -->` — the author explicitly asked for this
  # dispatch. The pre-fix comment read the miss as «the consumer really did opt out», a premise
  # that is false for a kickoff that just opted in: a consumer on `--profile env` (no vendor
  # drop), or any layout where the vendor path moves again, got exit 0 and silence while the
  # jq/node-miss branch above announced DID NOT RUN for the identical condition — two policies
  # for one opted-in condition (#1597 review ledger L-6). Same announcement, same channel.
  #
  # Scope note: a kickoff WITHOUT the opt-in marker still exits silently at the gate above, so
  # a project that never asked for the bridge is still never nagged.
  _emit_dep_skip '⚠ runtime-bridge-dispatch: no dispatch entrypoint found — the auto-dispatch this kickoff opted into (`<!-- bridge: auto -->`) DID NOT RUN. This is a SKIP, not a pass. Neither packages/runtime-bridge/src/cli/dispatch.ts (framework checkout) nor .claude/vendor/runtime-bridge/src/cli/dispatch.ts (consumer install) exists here; re-run the installer with --profile factory to get the vendor drop, or remove the `<!-- bridge: auto -->` marker if auto-dispatch is not wanted.'
  exit 0
}

# ── Invoke dispatch entrypoint ────────────────────────────────────────────────
# Use tsx (TypeScript executor) if available; fall back to node with --loader.
# dispatch.ts outputs JSON hookSpecificOutput.additionalContext. Its exit code is 0
# for every dispatch outcome and 2 when the kickoff itself is invalid; we capture
# stdout and deliberately DO NOT propagate that status — this hook is an injection,
# so the Write is never blocked (rule §4 turns the gate/injection split on the
# HOOK's exit code, which stays 0 unconditionally below).
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
