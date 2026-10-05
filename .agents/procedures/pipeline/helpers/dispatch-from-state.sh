#!/usr/bin/env bash
# dispatch-from-state.sh — §3 deterministic dispatch context emitter (F.3 helper-collapse).
#
# > Class: C — prose-only; companion paired-negative test at
# >          packages/core/hooks/dispatch-from-state.test.ts. No principle test
# >          gates compliance — the test gates the helper's own contract.
# > Authoritative for: deterministic single-helper read of dispatch state
# >                    + umbrella kickoff body for SKILL.md §3 launch-table.
# > NOT authoritative for: SKILL.md §3 judgment columns (Mode / SDD? / Stage / Parallel-sibling) —
# >                        those remain AI-judgment per §3 Step 2; helper only injects raw data.
#
# Usage: dispatch-from-state.sh <umbrella-or-no-arg>
#
# Behaviour:
#   1. If state-file missing → emit "(no dispatch state — fresh session)" line (exit 0,
#      legitimate for first invocation).
#   2. If state-file exists + jq parses → emit winner-id + sub-wave state block.
#   3. If state-file exists + jq parse fails → emit warning to stderr, continue
#      with kickoff body (state corruption is not fatal — kickoff is SSOT).
#   4. If umbrella arg empty → quiet skip (exit 0) — legitimate when §2 has not
#      selected a winner yet (mirrors launch-table-generator.sh no-arg branch).
#   5. If kickoff missing for given umbrella → emit "MISSING kickoff: <path>"
#      (matches the §3 Blocking-rule wording so SKILL.md §3 prose stays correct).
#   6. Otherwise → emit kickoff body (head -120, matches original §3 block 2 semantics).
#
# F.3 architecture: this helper replaces the §3 inline `!shell` `cat kickoff.md`
# block (DN-3 A — REMOVED 2026-05-28). Pre-removal the block was classifier-incompatible
# under no-arg mode (`${umbrella:-}` substituted before §2 picks winner, so §3 always
# emitted "MISSING kickoff" in arg-mode and contributed nothing in no-arg mode). Helper
# reads winner-id from state-file populated by §2; emits dispatch context for §3 +
# kickoff body in one invocation.
#
# @dual-pair: meta-orchestrator-dispatch-from-state
# spec: SKILL.md §3 (consumer of this helper's output, judgment-side flow) ↔ this file
#       (emitter); both agree on state-file JSON key names (winner_id / sub_wave_state).
# @cc-only-rationale: consumer-facing CC-session helper invoked from the /pipeline
#   slash-command via Bash tool at SKILL.md §3; no portable hook fires at the per-skill
#   cross-invocation moment, so a portable fallback would be a no-op outside CC.
#   Pure-bash + jq, deterministic, no paid LLM (no-paid-llm-in-ci.md §1 satisfied).
#
# Seams for testing (mirrors update-cache.sh / update-delta.sh convention):
#   MO_STATE_FILE — override state path (default: <resolved-orch-home>/_meta-orch-state.json)
#   MO_KICKOFF_DIR — override umbrella dispatch dir (default: <resolved-orch-home>)
#                    <resolved-orch-home> = resolve_orch_home() in lib/common.sh —
#                    .claude/orchestrator-prompts (framework) | .ai-factory/… (consumer)
#   REPO_ROOT     — override repo root (default: git rev-parse --show-toplevel)

set -euo pipefail

UMBRELLA="${1:-}"

# REPO_ROOT (+ shared resolve_target / tokeniser primitives) sourced from lib/common.sh
# (Stage 4 dedup, BASH_SOURCE-relative so it survives the REPO_ROOT test-seam).
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
STATE_FILE="${MO_STATE_FILE:-$(resolve_orch_home)/_meta-orch-state.json}"
KICKOFF_DIR="${MO_KICKOFF_DIR:-$(resolve_orch_home)}"

emit_state_section() {
  echo "=== dispatch state ==="
  if [[ ! -f "${STATE_FILE}" ]]; then
    echo "(no dispatch state — fresh session; populated when §2 picks winner)"
    return 0
  fi
  if ! jq empty "${STATE_FILE}" 2>/dev/null; then
    echo "(state file corrupt — falling back to kickoff body as SSOT)" >&2
    return 0
  fi
  local winner sub_state
  winner=$(jq -r '.winner_id // "(unset)"' "${STATE_FILE}")
  sub_state=$(jq -r '.sub_wave_state // "(unset)"' "${STATE_FILE}")
  echo "winner_id: ${winner}"
  echo "sub_wave_state: ${sub_state}"
}

emit_kickoff_section() {
  echo ""
  echo "=== kickoff body ==="
  if [[ -z "${UMBRELLA}" ]]; then
    echo "(no umbrella arg — §3 runs after §2 selects winner)"
    return 0
  fi
  local kickoff="${KICKOFF_DIR}/${UMBRELLA}/kickoff.md"
  if [[ ! -f "${kickoff}" ]]; then
    # Report the path actually probed (honours the MO_KICKOFF_DIR seam), not a hardcoded
    # `.claude/…` that names a nonexistent directory in a consumer install.
    echo "MISSING kickoff: $(repo_rel "${kickoff}")"
    return 0
  fi
  echo "kickoff: ${kickoff} ($(wc -l < "${kickoff}") lines)"
  echo "---"
  head -120 "${kickoff}"
}

emit_state_section
emit_kickoff_section
