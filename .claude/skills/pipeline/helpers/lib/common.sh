#!/usr/bin/env bash
# common.sh — shared primitives for /pipeline helper scripts. SOURCED, not executed.
# Single source of truth for repo-root resolution, symlink-target resolution, and the slug/
# title tokeniser stopword base + filter tail. Extracted 2026-06-03 (Stage 4 dedup) from the
# 3× resolve_target / 11× REPO_ROOT / 2× tokeniser duplications across the helpers.
#
# Source via (BASH_SOURCE-relative so it works regardless of REPO_ROOT, which tests seam to a
# sandbox; the lib always ships beside the helpers):
#   source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
# Sourcing also resolves REPO_ROOT (honouring a pre-set/env value) as a side effect, so the
# source line replaces each helper's `REPO_ROOT="${REPO_ROOT:-$(git ...)}"` line 1:1.
#
# @cc-only-rationale: meta-orchestrator skill helper library — sourced in-session by helpers
#   invoked via !shell injection; no portable equivalent fires at the same moment.

# Repo-root resolution (honour pre-set/env value; else git toplevel; else pwd). Idempotent.
REPO_ROOT="${REPO_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

# Resolve a possibly-symlinked file to its real absolute target — so flock + writes land on
# the canonical file, not the symlink (used by the cache/delta writers).
resolve_target() {
  local f="$1" l
  if [ -L "$f" ]; then
    l="$(readlink "$f")"
    case "$l" in
      /*) printf '%s\n' "$l" ;;
      *)  printf '%s\n' "$(cd "$(dirname "$f")" && cd "$(dirname "$l")" && pwd)/$(basename "$l")" ;;
    esac
  else
    printf '%s\n' "$f"
  fi
}

# Shared stopword base for the slug/title tokenisers. Callers may EXTEND it (inflight-check
# appends `meta|orch`). The SPLIT step stays caller-side — dup-detect strips punctuation +
# lowercases title text, inflight splits an already-lowercased slug on `_- space` — the two
# tokenisers diverge there by design; only the stopword base + filter tail below are shared.
MO_STOP_BASE='with|from|that|this|into|over|then|kickoff|umbrella|phase|stage|worker|orchestrator|claude|code'

# Tokeniser filter tail: from stdin (one token per line, already lowercased + split by the
# caller), keep tokens >= 4 chars, strip stopwords ($1, default MO_STOP_BASE), sort unique.
mo_filter_tokens() { awk 'length>=4' | grep -vE "^(${1:-$MO_STOP_BASE})$" | sort -u || true; }

# ── Orchestration-home resolution (consumer-usable /pipeline, 2026-06-16) ───────────────
# The skill file is identical in framework and consumer (install copies it). Differentiate at
# RUNTIME by presence: the framework dogfoods kickoffs in .claude/orchestrator-prompts/ (a
# Claude-Code dir); a consumer must NOT couple its backlog to one harness, so its data lives in
# the agnostic .ai-factory/ namespace (dual-implementation-discipline.md §3). MO_ORCH_HOME /
# MO_WAVE_PLAN env overrides win over detection (test seam + power-user escape hatch).
resolve_orch_home() {
  if [ -n "${MO_ORCH_HOME:-}" ]; then printf '%s\n' "${MO_ORCH_HOME}"; return; fi
  if [ -d "${REPO_ROOT}/.claude/orchestrator-prompts" ]; then
    printf '%s\n' "${REPO_ROOT}/.claude/orchestrator-prompts"      # framework dogfood
  else
    printf '%s\n' "${REPO_ROOT}/.ai-factory/orchestrator-prompts"  # agnostic consumer default
  fi
}

# Render an absolute path repo-relative, for compact human-facing messages. A path outside
# REPO_ROOT (e.g. an MO_* seam pointing at a sandbox) falls through unchanged rather than
# being mangled — an absolute path is still a correct answer, a wrong relative one is not.
repo_rel() { printf '%s\n' "${1#"${REPO_ROOT}"/}"; }

# Repo-relative form of resolve_orch_home() — `.claude/orchestrator-prompts` in the framework,
# `.ai-factory/orchestrator-prompts` in a consumer. Helper OUTPUT must go through this rather
# than hardcode either literal: a message naming `.claude/orchestrator-prompts` in a consumer
# points at a directory that does not exist, sending the reader (human or agent) to look in
# the wrong place while the code checked the right one.
resolve_orch_home_rel() { repo_rel "$(resolve_orch_home)"; }

# The backlog-priority registry ("wave plan"). Framework keeps docs/meta-factory/wave-sequencing-plan.md;
# a consumer's plan lives beside its kickoffs at <orch-home>/plan.md (created on first run, SKILL §1).
resolve_plan_path() {
  if [ -n "${MO_WAVE_PLAN:-}" ]; then printf '%s\n' "${MO_WAVE_PLAN}"; return; fi
  if [ -f "${REPO_ROOT}/docs/meta-factory/wave-sequencing-plan.md" ]; then
    printf '%s\n' "${REPO_ROOT}/docs/meta-factory/wave-sequencing-plan.md"
  else
    printf '%s\n' "$(resolve_orch_home)/plan.md"
  fi
}
