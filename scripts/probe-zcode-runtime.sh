#!/usr/bin/env bash
# probe-zcode-runtime.sh — executable drift probe against the INSTALLED ZCode binary.
#
# WHY (Fork B, survey PR #1699 §8 / #1708 follow-up): the parity SSOT (doctrine §2, renderer
# ZCODE_EVENTS, survey §2–§5) makes claims about the runtime that were verified by HAND against
# the binary — #1696 caught the vendor doc claiming a SessionStart:compact matcher the runtime
# never dispatches, and survey #1699 §4 caught OUR OWN renderer citing a security policy that no
# longer exists. «Documents lie; binaries don't» needs to be a TEST, not a repeated manual audit
# (recursive self-application; attention-is-not-a-mechanism §1).
#
# Method rule (survey §2 disambiguation): probe DISPATCH SITES and schema LITERALS, never bare
# strings — `grep -c SubagentStop` returns 9 in a bundle where the hook event does not exist
# (internal `V.SubagentStopped` task event). Assertions below therefore use quoted literals
# ("SubagentStart") or names with no internal-event homographs (PreCompact, WorktreeCreate).
#
# Scope: maintainer machines with /Applications/ZCode.app present. Absent → SKIP (exit 0 with a
# loud notice) so CI on other hosts stays green; the skip is itself asserted by the vitest
# wrapper. Assertions encode the build-2026-09-04 (3.11.2/6792) baseline; a NEW build that
# changes any of them fails HERE first — update the survey/doctrine before the probe, in lockstep.
#
# Zero deps beyond bash+grep. No LLM, no network (no-paid-llm-in-ci safe).

set -uo pipefail

ZC="${ZCODE_RUNTIME_BUNDLE:-/Applications/ZCode.app/Contents/Resources/glm/zcode.cjs}"

if [ ! -f "$ZC" ]; then
  echo "SKIP: $ZC not present — runtime probe is maintainer-machine only."
  echo "note: on hosts without the installed app this probe asserts nothing (by design)."
  exit 0
fi

FINGERPRINT="$(stat -f '%Sm %z bytes' "$ZC" 2>/dev/null || stat -c '%y %s bytes' "$ZC" 2>/dev/null)"
echo "probe-zcode-runtime: bundle $ZC ($FINGERPRINT)"

fail=0

# assert <label> <expected-op> <expected-count> <pattern>
#   op: eq | ge  (grep -a -c -F count comparison; -F literal, no regex accidents)
assert() {
  local label="$1" op="$2" want="$3" pattern="$4"
  local got
  got=$(grep -a -c -F "$pattern" "$ZC" || true)
  local ok=no
  if [ "$op" = eq ] && [ "${got:-0}" -eq "$want" ]; then ok=yes; fi
  if [ "$op" = ge ] && [ "${got:-0}" -ge "$want" ]; then ok=yes; fi
  if [ "$ok" = yes ]; then
    echo "  ✓ $label (${got} ${op} ${want})"
  else
    echo "  ✗ $label — DRIFT: got ${got}, want ${op} ${want} — re-run the survey probes (docs/meta-factory/research-patches/2026-09-10-zcode-full-parity-rphase-survey.md §9) and update this probe + doctrine in lockstep"
    fail=$((fail+1))
  fi
}

echo "— hook-event enum (survey §2; doctrine §2 ZCODE_EVENTS) —"
assert "7-event enum literal present"        ge 1 '"SessionStart","UserPromptSubmit","PreToolUse","PermissionRequest","PostToolUse","PostToolUseFailure","Stop"'
assert "PreCompact absent (row 21)"          eq 0 'PreCompact'
assert "WorktreeCreate absent (row 20)"      eq 0 'WorktreeCreate'
assert '"SubagentStart" hook event absent'   eq 0 '"SubagentStart"'
assert '"SessionEnd" hook event absent'      eq 0 '"SessionEnd"'

echo "— workspace-hooks trust channel (survey §4) —"
assert "pending-trust diagnostic present"    ge 1 'config_project_hooks_pending_trust'
assert "review interaction wired"            ge 1 'workspaceHookReview'
assert "persistent trust state present"      ge 1 'trusted_persistent'
assert "OLD silent-strip policy gone"        eq 0 'config_project_hooks_ignored'

echo "— skills/commands surface (survey §5) —"
assert "disable-model-invocation absent"     eq 0 'disable-model-invocation'
assert "plugin compatibility classification" ge 1 'runnable:["skills","commands","hooks","mcpServers","userConfig"]'

echo "— hook I/O contract literals (survey §3) —"
assert "PreToolUse permissionDecision enum"  ge 1 '"allow","ask","deny"'
assert "lenient k3t: continue key"           ge 1 '"continue"'
assert "lenient k3t: stopReason key"         ge 1 'stopReason'
assert "lenient k3t: systemMessage key"      ge 1 'systemMessage'
assert "SRn: updatedInput field (PreToolUse)" ge 1 'updatedInput'

echo "— CC env compat (survey §3) —"
assert "CLAUDE_PROJECT_DIR env var"          ge 1 'CLAUDE_PROJECT_DIR'

if [ "$fail" -gt 0 ]; then
  echo "probe-zcode-runtime: ${fail} DRIFT assertion(s) — the installed binary disagrees with the parity SSOT."
  exit 1
fi
echo "probe-zcode-runtime: all assertions green."
