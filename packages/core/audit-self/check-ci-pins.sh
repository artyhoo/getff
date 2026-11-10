#!/usr/bin/env bash
# check-ci-pins.sh — every tool install in this project's .github/workflows/*.yml pins a version
# (getff installs it as scripts/check-ci-pins.sh). It is the pre-push hook's unpinned-tool-install
# section run on its own: the project's record (.ai-factory/tool-decisions.md, aif:project-checks)
# arms it once it exits 0, and until then the pre-push hook prints «not armed» instead of blocking a
# push over a workflow the project already had (P2, advisor: the P6 blocker class).
cd "$(dirname "$0")/.." || exit 2
GETFF_SECTION_DIRECT=1 PREPUSH_ONLY=unpinned-tool-install exec node packages/core/hooks/pre-push.bundle.mjs < /dev/null
