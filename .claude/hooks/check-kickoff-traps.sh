#!/usr/bin/env bash
# PostToolUse gate — kickoff T-enumeration floor (Wave N8 C2, ai-laziness-traps §3).
# @cc-only-rationale: PostToolUse edit-time gate — kickoffs are authored and
#   dispatched before any pre-push/CI channel runs on their content; edit-time is the earliest (and only) gate.
# spec: .claude/rules/ai-laziness-traps.md §3 (kickoff-author obligation #2)
#
# On Edit|Write|MultiEdit of a `.claude/orchestrator-prompts/<wave>/kickoff.md` that
# ENGAGES the rule (mentions `ai-laziness-traps`), assert the mechanical floor of §3
# obligation #2: ≥3 DISTINCT canonical T-numbers (T<n>) enumerated. Fewer = the
# #trap-catalogue-blanket-reference anti-pattern (cites the rule as decoration, names
# no traps). Principle 12 checks citation PRESENCE; this adds the COUNT floor it
# misses — and reaches edit-time, where principle 12 (CI-skipped, gitignored) cannot.
# Whether the named traps are the RIGHT ones stays judgment → review-time, not gated.
#
# Exit 2 on violation — on a PostToolUse hook, exit-2 stderr is the ONLY non-JSON channel
# the model receives; exit-1 stderr reaches the operator transcript but NOT the model
# (live-verified 2026-07-24 — see
# docs/meta-factory/research-patches/2026-07-24-posttooluse-channel-verification.md).
# Graceful-but-LOUD skip without jq (guard below); silent exit 0 off-path or on a kickoff
# that has not yet engaged the rule.
set -uo pipefail

# Harness-portable output (inline — standalone in test sandboxes). CC: exit 2 + stderr =
# feedback the model receives (advisory in effect — PostToolUse cannot block). ZCode: JSON
# additionalContext (exit 2 swallowed as HookRunFailed); exit 0.
_is_zcode() { [ -n "${ZCODE_PROJECT_DIR:-}" ]; }
# JSON-escape WITHOUT jq — jq is precisely the dependency that may be missing here.
_json_escape() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | tr '\n' ' '; }
# Announce a dependency-missing skip on the channel the model actually receives on an
# exit-0 path (JSON hookSpecificOutput), keeping stderr for terminal/CI readers.
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
_adv_violation() { if _is_zcode; then _emit_ctx "PostToolUse" "$1"; else printf '%s\n' "$1" >&2; exit 2; fi; }

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
if ! command -v jq >/dev/null 2>&1; then
  # jq-less best-effort path extraction (sed on raw stdin) — scope the skip notice to
  # kickoff.md edits (or unparseable stdin — conservative), not every Edit/Write.
  _RAW_PATH="$(sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
  case "$_RAW_PATH" in
    *.claude/orchestrator-prompts/*/kickoff.md | "")
      _emit_skip '⚠ check-kickoff-traps: jq unavailable — BOTH kickoff checks DID NOT RUN for this edit (the host-verification contract arm and the T-enumeration arm). This is a SKIP, not a pass; install jq to restore enforcement.' ;;
  esac
  exit 0
fi

INPUT="$(cat)"
TOOL="$(printf '%s' "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || true)"
ABS_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null || true)"

case "$TOOL" in Edit | Write | MultiEdit) ;; *) exit 0 ;; esac
[[ -z "$ABS_PATH" ]] && exit 0

# Narrow: only kickoff.md under orchestrator-prompts (one path segment for <wave>).
# Match on the ABSOLUTE path's suffix, NOT on a REPO_ROOT-relative path. The older form
# stripped a "$REPO_ROOT/" prefix and matched an anchored pattern, so any kickoff NOT under
# the resolved root — a linked worktree (they nest inside the repo here, so a primary-rooted
# session never matched a worktree kickoff), or a session whose CLAUDE_PROJECT_DIR points at
# a different checkout — kept an absolute REL_PATH, missed the pattern, and exited 0 in
# SILENCE. That is the exact defect class this hook's arm 1 exists to close, reintroduced in
# the dispatcher itself. Suffix-matching is root-independent, so it cannot recur.
case "$ABS_PATH" in
  */.claude/orchestrator-prompts/*/kickoff.md) ;;
  *) exit 0 ;;
esac
# Display path only — never load-bearing for the scope decision above.
REL_PATH="${ABS_PATH#"$REPO_ROOT/"}"

[[ -f "$ABS_PATH" ]] || exit 0
CONTENT="$(cat "$ABS_PATH" 2>/dev/null || true)"

# Violations accumulate — a kickoff can breach both arms, and reporting one at a time
# costs the author a round-trip per rule. (Same posture as validate_s17 in the operator's
# git-safety.sh, which loops over Forward AND Backward and joins every error.)
VIOLATIONS=()


# ── Arm 1 — destination-environment verification contract ─────────────────────
# spec: .claude/rules/destination-environment-verification.md §1
# Every kickoff under orchestrator-prompts is a dispatch input, and a dispatched worker
# executes in the aif container while the artefact is accepted on the HOST. The kickoff
# must therefore name the commands the orchestrator runs on the host, or explicitly
# declare that none apply via an opt-out comment with a ≥20-char rationale.
#
# ALL recognition logic lives in scripts/host-verify.sh — contract extraction, opt-out
# detection, no-op guard, fence/code-span awareness, locale-independent char counting.
# This gate is a thin caller: it runs the runner in --list mode, captures its stderr
# verbatim, and surfaces it in the violation text. Keeping a parallel in-gate opt-out
# scan was the source of bypasses B1-B8 (gate and runner disagreed on what counts as
# a contract vs opt-out). One implementation, one answer.
#
# Sequencing: the runner-missing check fires BEFORE any opt-out acceptance. A kickoff
# with a valid opt-out but no runner available is a LOUD "DID NOT RUN" skip, never an
# acceptance — the gate cannot verify what it cannot run.
#
# Resolve the runner by TIER, and announce a miss LOUDLY rather than skipping in silence.
# Same defect class as the 2026-07-24 tsx-resolution incident: three gates resolved their
# runner from one hard-coded repo-local path and went inert wherever that path was absent.
# Tier 1 = the project root the harness reports; tier 2 = this hook's own checkout.
HV_RUNNER=""
for _cand in \
  "$REPO_ROOT/scripts/host-verify.sh" \
  "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd)/scripts/host-verify.sh"; do
  if [[ -f "$_cand" ]]; then HV_RUNNER="$_cand"; break; fi
done
if [[ -z "$HV_RUNNER" ]]; then
  _emit_skip '⚠ check-kickoff-traps: scripts/host-verify.sh not found — the host-verification contract check DID NOT RUN for this edit. This is a SKIP, not a pass; the runner must be present for either a contract or an opt-out to be accepted.'
else
  # Capture runner output (stderr+stdout merged) and exit code. The runner's --list mode
  # exits 0 for both "contract found" and "valid opt-out found" (both print a summary);
  # exits 2 for missing contract, too-short opt-out, no-op-only contract, or usage error.
  # Surface the runner's output VERBATIM in the violation text — the exit code alone
  # cannot distinguish a missing-contract from a too-short-opt-out, and the message
  # carries the measured rationale length (B6) and the specific failure class.
  HV_OUTPUT="$(bash "$HV_RUNNER" --list "$ABS_PATH" 2>&1)"
  HV_RC=$?
  if [[ "$HV_RC" -ne 0 ]]; then
    VIOLATIONS+=("❌ kickoff host-verify: $REL_PATH
$HV_OUTPUT")
  fi
fi

# ── Arm 2 — ai-laziness-traps T-enumeration floor ─────────────────────────────
# Engagement guard: only enforce the floor once the author engages the rule. A
# kickoff that never mentions ai-laziness-traps is principle-12 / review territory.
if printf '%s' "$CONTENT" | grep -q 'ai-laziness-traps'; then
  # Count DISTINCT canonical T-numbers (T1, T12, …). Domain labels (T-Wave9-A) are a
  # separate §3 #3 obligation and excluded from this count.
  DISTINCT="$(printf '%s' "$CONTENT" | grep -oE '\bT[0-9]+\b' | sort -u | grep -c .)"
  if [[ "$DISTINCT" -lt 3 ]]; then
    VIOLATIONS+=("❌ kickoff-traps: $REL_PATH engages ai-laziness-traps but enumerates only $DISTINCT distinct T-number(s) (floor: 3).
   §3 obligation #2: list the active traps, e.g. \"Active traps for this R-phase: T1, T3, T7\".
   Citing the rule without naming ≥3 traps = #trap-catalogue-blanket-reference.")
  fi
fi

if [[ "${#VIOLATIONS[@]}" -gt 0 ]]; then
  _adv_violation "$(printf '%s\n' "${VIOLATIONS[@]}")"
  exit 0
fi
exit 0
