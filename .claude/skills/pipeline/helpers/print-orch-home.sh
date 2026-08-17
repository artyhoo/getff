#!/usr/bin/env bash
# Prints the resolved orchestration home — `.claude/orchestrator-prompts` in the framework
# repo, `.ai-factory/orchestrator-prompts` in a consumer install (resolve_orch_home() in
# lib/common.sh; the framework dir is NEVER delivered, setup.d/lib.sh:65-66).
#
# WHY IT EXISTS: SKILL.md's `!shell` fences cannot source lib/common.sh — they are single
# commands vetted against this skill's allowed-tools, not sourced shells. Before this helper
# they hardcoded the framework literal, so in every consumer install the §0 guard, the §1 plan
# cache and the §2.5 backlog delta read a directory that cannot exist (getff#1245). Fences now
# substitute this script's output instead.
#
# Lives in helpers/ (not helpers/lib/) so it matches the SKILL.md allowed-tools glob
# `Bash(bash ${CLAUDE_SKILL_DIR}/helpers/*.sh *)` — lib/ is for sourced libraries only.
# Callers append a trailing token (`2>/dev/null`) so the invocation matches that glob's
# mandatory ` *` tail — same reason integer-name-guard.sh documents at :23-25.
#
# Sibling of print-plan-path.sh (same shape, same rationale, different resolver).
#
# @cc-only-rationale: /pipeline skill helper — runs in-session via !shell injection to feed a
#   path into a fence; no portable hook fires at that moment. Pure bash, deterministic,
#   no paid LLM (no-paid-llm-in-ci.md §1 satisfied).
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
resolve_orch_home
