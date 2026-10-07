#!/usr/bin/env bash
# inflight-check.sh — pre-dispatch ledger of LIVE (in-flight) work for an umbrella.
#
# Usage:   inflight-check.sh <umbrella-name>
#
# Complements dup-detect.sh (do NOT conflate): dup-detect catches MERGED
# duplicates over the last 30d; inflight-check catches work happening RIGHT NOW
# — an open PR or an un-merged live branch/worktree carrying the umbrella slug
# (e.g. a parallel session dispatching the same sub-wave before it merges).
# Not a gate; surfaces a confirmation-needed signal BEFORE dispatch.
#
# Outputs (one or more lines):
#   INFLIGHT: <umbrella> — open PR #<n> <branch> (possibly dispatched in another session)
#   INFLIGHT: <umbrella> — live branch <name> (not merged)
#   INFLIGHT: <umbrella> — live worktree <path> (not merged)
#   CLEAR: <umbrella> no in-flight work
#
# Two signals combined deterministically (no LLM):
#   (1) open PR whose title OR headRefName carries the umbrella slug
#   (2) un-merged local/remote branch or worktree carrying the umbrella slug
#
# Seams for testing (mirror dup-detect.sh:23-25):
#   REPO_ROOT, MO_GH_BIN (default gh), MO_GIT_BIN (default git),
#   MO_BASE_REF (default origin/staging), MO_INFLIGHT_MIN_TOKENS (default 2)
#
# @cc-only-rationale: meta-orchestrator skill helper — runs in-session via !shell injection;
#   no portable equivalent fires at the same moment (PostToolUse timing is CC-specific).
set -uo pipefail

# REPO_ROOT (+ shared resolve_target / tokeniser primitives) sourced from lib/common.sh
# (Stage 4 dedup, BASH_SOURCE-relative so it survives the REPO_ROOT test-seam).
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
MO_GH_BIN="${MO_GH_BIN:-gh}"
MO_GIT_BIN="${MO_GIT_BIN:-git}"
MO_BASE_REF="${MO_BASE_REF:-origin/staging}"
MO_INFLIGHT_MIN_TOKENS="${MO_INFLIGHT_MIN_TOKENS:-2}"
STOP="${MO_STOP_BASE}|meta|orch"

# Localized emitted strings (EN default; AIF_HOOK_LANG=ru → Russian). See lang/.
_lang_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../lang" && pwd)"
_lang_file="${_lang_dir}/${AIF_HOOK_LANG:-en}.sh"
[ -f "$_lang_file" ] || _lang_file="${_lang_dir}/en.sh"
# shellcheck source=/dev/null
. "$_lang_file"

NAME="${1:-}"
if [[ -z "${NAME}" ]]; then echo "usage: inflight-check.sh <umbrella-name>"; exit 0; fi

# git ops should observe the target repo (mirrors dup-detect's REPO_ROOT use).
cd "${REPO_ROOT}" 2>/dev/null || true

SLUG="$(printf '%s' "${NAME}" | tr '[:upper:]' '[:lower:]')"
# Significant slug tokens: split on - _ space, keep >=4 chars, strip stopwords.
SLUG_TOKENS="$(printf '%s' "${SLUG}" | tr '_- ' '\n' | mo_filter_tokens "$STOP")"
SLUG_TOKEN_COUNT="$(printf '%s\n' "${SLUG_TOKENS}" | grep -c . 2>/dev/null || echo 0)"
SLUG_TOKEN_COUNT="${SLUG_TOKEN_COUNT//[[:space:]]/}"
# Effective threshold: never demand more tokens than the slug actually has;
# floor of 1 so a single-distinctive-token slug can still match.
EFFECTIVE_MIN="${MO_INFLIGHT_MIN_TOKENS}"
if [[ "${SLUG_TOKEN_COUNT}" -lt "${EFFECTIVE_MIN}" ]]; then EFFECTIVE_MIN="${SLUG_TOKEN_COUNT}"; fi
if [[ "${EFFECTIVE_MIN}" -lt 1 ]]; then EFFECTIVE_MIN=1; fi

# Count how many significant slug tokens appear in the given lowercased haystack.
count_token_hits() {
  local hay="$1" hits=0 t
  while IFS= read -r t; do
    [[ -z "${t}" ]] && continue
    if grep -qF "${t}" <<<"${hay}"; then hits=$((hits + 1)); fi
  done <<< "${SLUG_TOKENS}"
  printf '%s' "${hits}"
}

# A haystack matches the umbrella if it contains the full slug as a substring,
# OR >= EFFECTIVE_MIN significant slug tokens. Substring catches the exact branch;
# token threshold catches a renamed/re-prefixed branch without false-firing on
# generic stopwords.
matches_slug() {
  local hay; hay="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  if grep -qF "${SLUG}" <<<"${hay}"; then return 0; fi
  [[ -z "${SLUG_TOKENS}" ]] && return 1
  local hits; hits="$(count_token_hits "${hay}")"
  [[ "${hits}" -ge "${EFFECTIVE_MIN}" ]]
}

found=0

# ── Signal 1: open PRs ────────────────────────────────────────────────────────
PR_JSON="$("${MO_GH_BIN}" pr list --state open --json number,title,headRefName --limit 100 2>/dev/null)" || PR_JSON=""
if [[ -n "${PR_JSON}" ]]; then
  while IFS= read -r entry; do
    [[ -z "${entry}" ]] && continue
    num="$(printf '%s' "${entry}" | grep -oE '"number":[0-9]+' | grep -oE '[0-9]+' || true)"
    [[ -z "${num}" ]] && continue
    title="$(printf '%s' "${entry}" | sed 's/.*"title":"\([^"]*\)".*/\1/')"
    branch="$(printf '%s' "${entry}" | sed 's/.*"headRefName":"\([^"]*\)".*/\1/')"
    if matches_slug "${title} ${branch}"; then
      echo "INFLIGHT: ${NAME} — open PR #${num} ${branch} ${AIF_PIPELINE_INFLIGHT_PR_NOTE}"
      found=1
    fi
  done < <(printf '%s\n' "${PR_JSON}" | grep -oE '\{[^}]+\}' 2>/dev/null || true)
fi

# ── Signal 2: un-merged live branches ────────────────────────────────────────
BRANCHES="$("${MO_GIT_BIN}" branch -a --no-merged "${MO_BASE_REF}" 2>/dev/null || true)"
if [[ -n "${BRANCHES}" ]]; then
  while IFS= read -r b; do
    b="$(printf '%s' "${b}" | sed 's/^[* +]*//; s/[[:space:]]*$//')"
    [[ -z "${b}" ]] && continue
    case "${b}" in *'->'*) continue ;; esac   # skip "HEAD -> ..." pointers
    short="${b#remotes/origin/}"
    if matches_slug "${short}"; then
      echo "INFLIGHT: ${NAME} — live branch ${short} ${AIF_PIPELINE_INFLIGHT_UNMERGED}"
      found=1
    fi
  done <<< "${BRANCHES}"
fi

# ── Signal 2b: live worktrees ─────────────────────────────────────────────────
WT="$("${MO_GIT_BIN}" worktree list 2>/dev/null || true)"
if [[ -n "${WT}" ]]; then
  while IFS= read -r line; do
    [[ -z "${line}" ]] && continue
    if matches_slug "${line}"; then
      wt_path="$(printf '%s' "${line}" | awk '{print $1}')"
      echo "INFLIGHT: ${NAME} — live worktree ${wt_path} ${AIF_PIPELINE_INFLIGHT_UNMERGED}"
      found=1
    fi
  done <<< "${WT}"
fi

if [[ "${found}" -eq 0 ]]; then echo "CLEAR: ${NAME} no in-flight work"; fi
exit 0
