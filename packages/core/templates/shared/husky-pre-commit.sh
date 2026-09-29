#!/usr/bin/env sh
# Pre-commit hook: fast checks only (target: <5 seconds).
# Heavy checks live in pre-push and CI.
# @aif-shield: pre-commit — framework-owned commit shield. Do NOT replace with a bare
#   git-hooks manager: a `prepare`-driven manager (e.g. simple-git-hooks) that regenerates
#   .husky/ will clobber this and the sibling pre-push (GH #975). check-shields-up.sh gates
#   on this marker so a silent replacement is caught, not passed on the bare `lint-staged` string.
#
# Install: place at .husky/pre-commit and run `chmod +x .husky/pre-commit`

npx lint-staged || exit $?
# A check the pre-push probe (or `npm run validate`) found green waits in a per-clone sidecar; fold it
# into the tracked record (.ai-factory/tool-decisions.md) and stage it, so the flip rides this commit.
# After lint-staged, so its stash-and-restore never sees the index change. A failed fold never blocks
# the commit: the sidecar stays and scripts/run-armed.sh keeps reading it.
if [ -f scripts/run-armed.sh ]; then bash scripts/run-armed.sh --fold || true; fi
