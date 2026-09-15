#!/usr/bin/env bash
# inject-subagent-digest.sh — SubagentStart hook — injects the session-bootstrap digest into juniors at spawn
# SubagentStart hook — inject the session-bootstrap digest into juniors at spawn.
# Goal: every dispatched subagent gets the project anchor (goal + invariants +
# H1 recommendation discipline) at spawn with zero per-prompt boilerplate. SSOT #108.
#
# @cc-only-rationale: internal orchestrator hook, maintainer-env only, no portable fire-point
# spec: reuses .claude/hooks/inject-session-bootstrap.sh as the single digest source (no #two-prompts-drift)
#
# Output contract (verified DUAL-CHANNEL 2026-06-01 — WebFetch code.claude.com/docs/en/hooks + DeepWiki anthropics/claude-code):
#   SubagentStart is NON-blocking (exit 2 only shows stderr to the user — it CANNOT
#   block a spawn) and delivers context via JSON hookSpecificOutput.additionalContext.
#   Plain stdout is a SILENT NO-OP here (unlike UserPromptSubmit, which auto-injects
#   stdout) — emitting the wrong format = the hook fires but does nothing (#discipline-theatre,
#   T-108-A). Hence the jq-wrapped JSON below, mirroring inject-matching-rule.sh:78-79.
set -uo pipefail

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
command -v jq >/dev/null 2>&1 || exit 0   # graceful no-op without jq

# Single source of truth for the digest text: reuse the UserPromptSubmit digest
# verbatim (one logic, two channels — dual-implementation-discipline §7).
DIGEST="$(bash "$HOOK_DIR/inject-session-bootstrap.sh" 2>/dev/null || true)"
[[ -z "$DIGEST" ]] && exit 0

jq -n --arg ctx "$DIGEST" \
  '{hookSpecificOutput:{hookEventName:"SubagentStart",additionalContext:$ctx}}'
exit 0
