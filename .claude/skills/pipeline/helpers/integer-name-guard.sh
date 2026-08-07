#!/usr/bin/env bash
# integer-name-guard.sh — V1 pre-invocation guard for SKILL.md §0.
# Asserts no umbrella directory under the resolved orchestration home is named as a
# bare integer (^[0-9]+$). An integer-named umbrella makes `/pipeline 1`
# ambiguous between named-umbrella dispatch and V4 top-N routing (§0 arg-routing).
#
# > Class: B — companion paired-negative test at
# >          packages/core/skills/integer-name-guard.test.ts.
# > Authoritative for: the §0 integer-name pre-invocation guard mechanism only.
# > NOT authoritative for: §0 arg-routing semantics (single-SSOT in SKILL.md §0).
#
# WHY A HELPER (not inline): the former inline form at SKILL.md §0 was a compound
# `ls … && { echo …; exit 2; }`. CC splits compounds by operator and vets each
# subcommand independently (permissions.md "Compound commands"); `exit` is NOT a
# CC read-only built-in and is not covered by this skill's allowed-tools, so the
# block forced the auto-mode safety classifier on every invocation. When the
# classifier was unavailable the whole /pipeline expansion died on its
# first block (§0). Routing through the allowlisted
# `Bash(bash ${CLAUDE_SKILL_DIR}/helpers/*.sh *)` entry removes that dependency.
#
# Usage: integer-name-guard.sh [orch-prompts-dir]
#   arg1 — dir to scan (default: resolve_orch_home() — .claude/orchestrator-prompts in
#          the framework, .ai-factory/orchestrator-prompts in a consumer install).
#          Passed explicitly by the §0 caller so the invocation carries a trailing
#          arg and matches the `*.sh *` allowlist glob (no-arg would not match).
#   exit 0 → no integer-named umbrella (safe to proceed)
#   exit 2 → integer-named umbrella found (ERROR printed to stderr; halt)
#
# Seam:
#   MO_ORCH_PROMPTS_DIR — override scan dir for tests (lower precedence than arg1).
#
# @dual-pair: meta-orchestrator-integer-name-guard
# spec: SKILL.md §0 (caller) ↔ this file (guard logic).
# @cc-only-rationale: meta-orchestrator skill helper — runs in-session via !shell
#   injection at SKILL.md §0; no portable hook fires at the per-skill
#   pre-invocation moment. Pure-bash + grep, deterministic, no paid LLM
#   (no-paid-llm-in-ci.md §1 satisfied).
set -euo pipefail

# REPO_ROOT + resolve_orch_home() sourced from lib/common.sh (BASH_SOURCE-relative so it
# survives the REPO_ROOT test-seam; consumer-usable /pipeline 2026-06-16).
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

dir="${1:-${MO_ORCH_PROMPTS_DIR:-$(resolve_orch_home)}}"

# No umbrellas dir → nothing to guard.
[ -d "$dir" ] || exit 0

found=""
for entry in "$dir"/*/; do
  [ -d "$entry" ] || continue          # unmatched glob stays literal → skip
  name="$(basename "$entry")"
  if printf '%s' "$name" | grep -qE '^[0-9]+$'; then
    found="$name"
    break
  fi
done

if [ -n "$found" ]; then
  echo "ERROR: umbrella named as integer ('$found'); rename before /pipeline <N> can be unambiguous." >&2
  exit 2
fi
exit 0
