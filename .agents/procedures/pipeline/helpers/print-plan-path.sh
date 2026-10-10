#!/usr/bin/env bash
# Prints the resolved backlog-plan path (framework wave-plan or consumer .ai-factory plan).
# Lives in helpers/ (not helpers/lib/) so it matches the SKILL.md allowed-tools glob
# `Bash(bash .agents/procedures/pipeline/helpers/*.sh *)` — lib/ is for sourced libraries only.
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"
resolve_plan_path
