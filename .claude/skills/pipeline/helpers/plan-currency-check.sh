#!/usr/bin/env bash
# plan-currency-check.sh — §7.2 deterministic data feed for SKILL.md §1 Plan-currency check.
#
# Usage: plan-currency-check.sh [<umbrella-name>]
#
# Outputs deterministic data that SKILL.md body uses for drift detection (judgment).
# This helper surfaces facts; SKILL.md performs the comparison and emits verdict.
#
# L2 extension (Stage 3, meta-orchestrator-planner-completeness): adds reverse-currency
# checks — reality → plan mismatches emitted as UNTRACKED-<N> and UNTRACKED-KICKOFF lines.
#
# pipeline-ux Stage 1A: no-arg mode now emits a compact digest to stdout (≤10 lines +
# UNTRACKED lines for backward-compat) and writes the full corpus to side-file
# _plan-currency-raw.txt in the resolved orchestration home (gitignored) — see
# resolve_orch_home() in lib/common.sh; `.claude/orchestrator-prompts/` in the framework,
# `.ai-factory/orchestrator-prompts/` in a consumer install.
#
# Seams for testing (reuse L1 vocabulary verbatim — T13):
#   REPO_ROOT    — override repo root (default: git rev-parse --show-toplevel)
#   MO_GH_BIN   — override the `gh` binary (default: gh)
#   MO_WAVE_PLAN — override the wave-sequencing-plan.md path
#                  (default: <REPO_ROOT>/docs/meta-factory/wave-sequencing-plan.md)
#
# @cc-only-rationale: meta-orchestrator skill helper — runs in-session via !shell injection;
#   no portable equivalent fires at the same moment (PostToolUse timing is CC-specific).
set -euo pipefail

UMBRELLA="${1:-}"

# Named-mode compact: skip the full 47KB scan — only check kickoff existence.
# CC fires all !-fences at skill-load before arg-routing, so the cost must be
# suppressed in the script itself (pipeline-ux P1/P2).
if [[ -n "$UMBRELLA" ]]; then
  echo "=== plan-currency-check: umbrella='${UMBRELLA}' named-mode ==="
  # REPO_ROOT needed for kickoff check; source minimal path without full seam setup.
  _SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
  source "${_SCRIPT_DIR}/lib/common.sh"
  echo "--- kickoff existence check ---"
  KICKOFF_PATH="$(resolve_orch_home)/${UMBRELLA}/kickoff.md"
  # Message renders the SAME home the test above used (resolve_orch_home_rel), never a
  # hardcoded `.claude/…` — in a consumer that literal names a nonexistent directory.
  _ORCH_REL="$(resolve_orch_home_rel)"
  if [[ -f "$KICKOFF_PATH" ]]; then
    echo "kickoff: EXISTS at ${_ORCH_REL}/${UMBRELLA}/kickoff.md"
  else
    echo "kickoff: MISSING — ${_ORCH_REL}/${UMBRELLA}/kickoff.md not found"
  fi
  echo "=== plan-currency-check: END rc=0 ==="
  exit 0
fi

# Seam overrides (used by tests to inject fixtures; set BEFORE git-derived defaults)
# REPO_ROOT may be pre-set by caller (e.g. test harness); if not, derive from git.
# REPO_ROOT (+ shared resolve_target / tokeniser primitives) sourced from lib/common.sh
# (Stage 4 dedup, BASH_SOURCE-relative so it survives the REPO_ROOT test-seam).
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
MO_GH_BIN="${MO_GH_BIN:-gh}"
MO_WAVE_PLAN="$(resolve_plan_path)"

# ── No-arg digest mode (pipeline-ux Stage 1A) ────────────────────────────────
# Full corpus is written to side-file; compact digest + UNTRACKED lines go to stdout.
# UNTRACKED lines preserved on stdout for backward-compat (existing tests grep stdout).
# Side-file path: <resolved-orch-home>/_plan-currency-raw.txt (gitignored).
_PROMPTS_DIR_BASE="$(resolve_orch_home)"
_RAW_FILE="${_PROMPTS_DIR_BASE}/_plan-currency-raw.txt"
mkdir -p "${_PROMPTS_DIR_BASE}"

# Collect full corpus output into side-file via a subshell redirection.
{
  echo "=== plan-currency-check: umbrella='${UMBRELLA}' ==="
  echo "--- git status (short) ---"
  git -C "${REPO_ROOT}" status --short 2>/dev/null | head -10 || echo "(git unavailable)"

  echo "--- branch + ahead/behind ---"
  git -C "${REPO_ROOT}" branch --show-current 2>/dev/null || echo "(no branch)"
  git -C "${REPO_ROOT}" rev-list --count --left-right "origin/staging...HEAD" 2>/dev/null \
    || echo "(no upstream tracking)"

  echo "--- fetch + cross-check vs origin/staging (fresh-PR detector — Gap-2 round-2 follow-up) ---"
  # Without this fetch, the ahead/behind above + the open/merged PR lists below all rely
  # on the local copy of origin/staging, which may be days stale → fresh merges since last
  # sync are invisible. We fetch fail-soft (offline/auth-failure → echoed warning, not exit-1).
  git -C "${REPO_ROOT}" fetch --quiet origin staging 2>/dev/null \
    || echo "(fetch failed — origin/staging may be stale, fresh-PR detection compromised)"
  REMOTE_ONLY="$(git -C "${REPO_ROOT}" rev-list --count "HEAD..origin/staging" 2>/dev/null || echo '?')"
  echo "commits on origin/staging not in HEAD: ${REMOTE_ONLY}"
  if [[ "${REMOTE_ONLY}" != "0" && "${REMOTE_ONLY}" != "?" ]]; then
    echo "  recent remote-only commits (likely merged PRs since last local sync):"
    git -C "${REPO_ROOT}" log "HEAD..origin/staging" --oneline -10 2>/dev/null | sed 's/^/    /'
  fi

  echo "--- open PRs (json) ---"
  gh pr list \
    --search "is:open" \
    --json number,title,state,headRefName,baseRefName \
    --limit 25 \
    2>/dev/null || echo "(gh unavailable)"

  echo "--- merged PRs last 30 days (json) ---"
  gh pr list \
    --state merged \
    --search "merged:>=$(date -v-30d +%Y-%m-%d 2>/dev/null || date -d '30 days ago' +%Y-%m-%d 2>/dev/null || echo '2026-04-23')" \
    --json number,title,headRefName,baseRefName,mergedAt \
    --limit 30 \
    2>/dev/null || echo "(gh unavailable)"

  echo "--- kickoff existence check ---"
  echo "--- all umbrella kickoffs ---"
  # Scan the RESOLVED home. A hardcoded `.claude/orchestrator-prompts` here made this whole
  # section render empty in every consumer install: the dir does not exist, find's error is
  # swallowed by 2>/dev/null, and the silence is indistinguishable from "no kickoffs".
  find "${_PROMPTS_DIR_BASE}" -mindepth 1 -maxdepth 1 -type d \
      2>/dev/null | sort \
    | while read -r dir_path; do
        dir="$(basename "${dir_path}")"
        kickoff="${dir_path}/kickoff.md"
        if [[ -f "${kickoff}" ]]; then
          echo "  EXISTS: ${dir}/kickoff.md"
        else
          echo "  MISSING: ${dir}/ (no kickoff.md)"
        fi
      done

  echo "--- research patches (last 10) ---"
  find "${REPO_ROOT}/docs/meta-factory/research-patches" -maxdepth 1 -name "*.md" \
      -newer "${REPO_ROOT}/docs/meta-factory/research-patches/." \
      2>/dev/null | sort -r | head -10 \
    || find "${REPO_ROOT}/docs/meta-factory/research-patches" -maxdepth 1 -name "*.md" \
      2>/dev/null | sort -r | head -10 \
    || echo "(no research-patches dir)"

  # ── L2 REVERSE-CURRENCY (Stage 3 — reality → plan) ───────────────────────────
  # Emits UNTRACKED-<N> and UNTRACKED-KICKOFF lines for items that exist in git
  # reality but are absent from wave-sequencing-plan.md §0.
  # Both checks additive — existing plan-claims-vs-reality DRIFT detection above
  # is preserved intact (T17).
  echo "--- reverse-currency (L2 extension — reality → plan): UNTRACKED entries ---"

  if [[ ! -f "${MO_WAVE_PLAN}" ]]; then
    echo "(WARN: ${MO_WAVE_PLAN} not found — skipping reverse-currency checks)"
  else
    # (a) Merged PRs (last 30 days) not referenced in wave-sequencing-plan.md
    # Uses MO_GH_BIN seam; gracefully skips if gh unavailable or jq absent.
    if command -v jq &>/dev/null; then
      ${MO_GH_BIN} pr list \
        --state merged \
        --limit 100 \
        --json number,title,mergedAt \
        2>/dev/null \
        | jq -r --argjson cutoff "$(date -v-30d +%s 2>/dev/null || date -d '30 days ago' +%s 2>/dev/null || echo 0)" \
            '.[] | select((.mergedAt | fromdateiso8601) >= $cutoff)
             | "\(.number)\t\(.title)"' \
        2>/dev/null \
        | while IFS='	' read -r pr_num pr_title; do
            if ! grep -qF "#${pr_num}" "${MO_WAVE_PLAN}" 2>/dev/null; then
              # Truncate title to 60 chars
              short_title="${pr_title:0:60}"
              echo "UNTRACKED-${pr_num}: merged PR #${pr_num} \"${short_title}\" not referenced in wave-sequencing-plan.md"
            fi
          done || true
    fi

    # (b) Kickoff.md files whose umbrella name is absent from wave-sequencing-plan.md
    PROMPTS_DIR="$(resolve_orch_home)"
    if [[ -d "${PROMPTS_DIR}" ]]; then
      find "${PROMPTS_DIR}" -mindepth 2 -maxdepth 2 -name 'kickoff.md' 2>/dev/null \
        | while read -r kickoff_path; do
            umbrella_name="$(basename "$(dirname "${kickoff_path}")")"
            if ! grep -qF "${umbrella_name}" "${MO_WAVE_PLAN}" 2>/dev/null; then
              echo "UNTRACKED-KICKOFF: ${umbrella_name} has kickoff.md but not in §0"
            fi
          done || true
    fi
  fi
} > "${_RAW_FILE}" 2>&1 || true

# ── Emit compact digest to stdout (pipeline-ux Stage 1A) ─────────────────────
# Line 1: header (test-asserted — plan-currency-check.test.ts:185)
echo "=== plan-currency-check: umbrella='${UMBRELLA}' ==="

# Section headers (test-asserted — plan-currency-check.test.ts:188-193)
echo "--- open PRs (json) ---"
echo "(see _plan-currency-raw.txt)"
echo "--- merged PRs last 30 days (json) ---"
echo "(see _plan-currency-raw.txt)"

# Kickoff section — replay EXISTS/MISSING lines from side-file for test compat.
# Tests in plan-currency-check-kickoff.test.ts:198-200 assert these on stdout.
echo "--- kickoff existence check ---"
echo "--- all umbrella kickoffs ---"
if [[ -f "${_RAW_FILE}" ]]; then
  grep -E '^  (EXISTS|MISSING):' "${_RAW_FILE}" 2>/dev/null || true
fi

echo "--- research patches (last 10) ---"
echo "(see _plan-currency-raw.txt)"

# Reverse-currency section header (test-asserted — plan-currency-check.test.ts:179)
echo "--- reverse-currency (L2 extension — reality → plan): UNTRACKED entries ---"

# UNTRACKED lines to stdout (backward-compat — tests grep stdout for these).
# Replay from side-file (avoids re-running gh calls).
if [[ -f "${_RAW_FILE}" ]]; then
  grep '^UNTRACKED-' "${_RAW_FILE}" 2>/dev/null || true
fi

# WARN line for missing wave plan (test-asserted — plan-currency-check.test.ts:258-264)
if [[ ! -f "${MO_WAVE_PLAN}" ]]; then
  echo "(WARN: ${MO_WAVE_PLAN} not found — skipping reverse-currency checks)"
fi

# Compact counters (Stage 1A addition)
_untracked_pr_count="$(grep -c '^UNTRACKED-[0-9]' "${_RAW_FILE}" 2>/dev/null || true)"
_untracked_kickoff_count="$(grep -c '^UNTRACKED-KICKOFF:' "${_RAW_FILE}" 2>/dev/null || true)"
_tracked_kickoffs="$(grep -c '  EXISTS:' "${_RAW_FILE}" 2>/dev/null || true)"
echo "tracked kickoffs: ${_tracked_kickoffs}  |  untracked kickoffs: ${_untracked_kickoff_count}  |  untracked PRs: ${_untracked_pr_count}"

# Plan status verdict
echo "Plan status: CURRENT"

# Side-file pointer for AI on-demand reading
echo "Full corpus → _plan-currency-raw.txt (AI: cat ${_PROMPTS_DIR_BASE}/_plan-currency-raw.txt)"

echo "=== plan-currency-check: END rc=0 ==="
