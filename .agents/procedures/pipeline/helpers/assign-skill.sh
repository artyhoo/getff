#!/usr/bin/env bash
# assign-skill.sh — L5 skill/agent assignment helper for /pipeline.
#
# Usage: assign-skill.sh <type> <description-string>
#
# For a classified work item (type + description), proposes the most relevant
# CC skill or AI-agnostic sub-agent by keyword-matching the description against
# .claude/skills/*/SKILL.md description fields and agents/*.md body text.
#
# Output: exactly one line on stdout in one of:
#   recommended_skill: <slug>       — basename of .claude/skills/<slug>/
#   recommended_agent: <path>       — relative to repo root (agents/<name>.md)
#   recommended: none               — no keyword overlap (max score < 1)
#
# Mechanism: deterministic bash keyword overlap (no paid LLM, no embeddings).
# Score = count of input tokens appearing as substrings in candidate token set.
# Ties: prefer skill over agent, then alphabetical slug within type.
#
# DECISIONS:
#   - Scope: project-local skills only (.claude/skills/); global ($HOME/.claude/skills/)
#     scanned iff MO_SKILLS_GLOBAL=1 (off by default — not guaranteed on consumers).
#   - agents/*.md surface: first 50 lines (no guaranteed frontmatter convention).
#   - Stopwords: 15 common connectives + L5-noise words (see STOPWORDS below).
#   - Tie-breaking: skill before agent (deterministic type rank), then alphabetical.
#
# Seams (mirror L1/L2 pattern — priority-score.sh:35-42):
#   REPO_ROOT        — override repo root (default: git rev-parse --show-toplevel)
#   MO_SKILLS_DIR   — override skills dir (default: $REPO_ROOT/.claude/skills)
#   MO_AGENTS_DIR   — override agents dir (default: $REPO_ROOT/agents)
#   MO_SKILLS_GLOBAL — set to "1" to also scan $HOME/.claude/skills/ (default: off)
#
# @cc-only-rationale: meta-orchestrator skill helper — runs in-session via shell injection;
#   planning-time precompute of CC's runtime skill dispatch (per dual-implementation-discipline.md §3 internal default).
set -euo pipefail

TYPE="${1:-}"
DESCRIPTION="${2:-}"

# Empty description → no match
if [[ -z "${DESCRIPTION// /}" ]]; then
  echo "recommended: none"
  exit 0
fi

# Seam overrides
# REPO_ROOT (+ shared resolve_target / tokeniser primitives) sourced from lib/common.sh
# (Stage 4 dedup, BASH_SOURCE-relative so it survives the REPO_ROOT test-seam).
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
MO_SKILLS_DIR="${MO_SKILLS_DIR:-${REPO_ROOT}/.claude/skills}"
MO_AGENTS_DIR="${MO_AGENTS_DIR:-${REPO_ROOT}/agents}"

# Stopwords dropped during tokenisation
STOPWORDS="^(a|the|and|or|of|to|for|with|in|on|at|by|use|when|each|item|skill|tool|run)$"

# tokenise <text> → newline-separated lowercase tokens, ≥3 chars, no stopwords
tokenise() {
  echo "${1:-}" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' ' ' | tr ' ' '\n' \
    | grep -E '.{3,}' | grep -vE "${STOPWORDS}" | sort -u || true
}

# score_against <candidate_text> → integer (count of input tokens present in candidate)
INPUT_TOKENS=$(tokenise "${DESCRIPTION}")
score_against() {
  local cand_tokens score=0 tok
  cand_tokens=$(tokenise "${1:-}")
  while IFS= read -r tok; do
    [[ -n "${tok}" ]] || continue
    grep -qF "${tok}" 2>/dev/null <<<"${cand_tokens}" && score=$((score + 1)) || true
  done <<< "${INPUT_TOKENS}"
  echo "${score}"
}

# Track best candidate
best_score=0; best_type=""; best_name=""

# Update best if this candidate beats or ties (with precedence) the current best.
# Precedence for equal score: skill < agent (type rank), then alphabetical name.
maybe_update() {
  local ctype="${1}" cname="${2}" score="${3}"
  [[ "${score}" -ge 1 ]] || return 0
  if [[ "${score}" -gt "${best_score}" ]]; then
    best_score="${score}"; best_type="${ctype}"; best_name="${cname}"
  elif [[ "${score}" -eq "${best_score}" ]]; then
    # skill beats agent; within same type, alphabetically-first wins
    if [[ "${ctype}" == "skill" && "${best_type}" == "agent" ]]; then
      best_type="${ctype}"; best_name="${cname}"
    elif [[ "${ctype}" == "${best_type}" && "${cname}" < "${best_name}" ]]; then
      best_name="${cname}"
    fi
  fi
}

# Scan a skills directory
scan_skills() {
  local dir="${1:-}"; [[ -d "${dir}" ]] || return 0
  local slug md desc score
  for md in "${dir}"/*/SKILL.md; do
    [[ -f "${md}" ]] || continue
    slug="$(basename "$(dirname "${md}")")"
    desc="$(head -20 "${md}" | awk -F': ' '/^description:/{print substr($0,index($0,$2))}' | head -1)"
    [[ -n "${desc}" ]] || continue
    score=$(score_against "${desc}")
    maybe_update "skill" "${slug}" "${score}"
  done
}

scan_skills "${MO_SKILLS_DIR}"
[[ "${MO_SKILLS_GLOBAL:-0}" == "1" ]] && scan_skills "${HOME}/.claude/skills" || true

# Scan agents
if [[ -d "${MO_AGENTS_DIR}" ]]; then
  for md in "${MO_AGENTS_DIR}"/*.md; do
    [[ -f "${md}" ]] || continue
    local_path="agents/$(basename "${md}")"
    score=$(score_against "$(head -50 "${md}" 2>/dev/null || true)")
    maybe_update "agent" "${local_path}" "${score}"
  done
fi

# Emit recommendation
if [[ "${best_score}" -lt 1 ]]; then
  echo "recommended: none"
elif [[ "${best_type}" == "skill" ]]; then
  echo "recommended_skill: ${best_name}"
else
  echo "recommended_agent: ${best_name}"
fi
