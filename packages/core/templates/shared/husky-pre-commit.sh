#!/usr/bin/env sh
# Pre-commit hook: fast checks only (target: <5 seconds).
# Heavy checks live in pre-push and CI.
# @aif-shield: pre-commit — framework-owned commit shield. Do NOT replace with a bare
#   git-hooks manager: a `prepare`-driven manager (e.g. simple-git-hooks) that regenerates
#   .husky/ will clobber this and the sibling pre-push (GH #975). check-shields-up.sh gates
#   on this marker so a silent replacement is caught, not passed on the bare `lint-staged` string.
#
# Install: place at .husky/pre-commit and run `chmod +x .husky/pre-commit`

# ZCode skill-mirror check (#1502): blocks a commit whose .zcode/skills mirror of .claude/skills
# is incomplete — CC-only consumers get one info line and exit 0. getff's installer delivers the
# script next to this hook on every install and every --refresh, so it is missing only when it was
# removed from the project — and it stays missing only while a Layer-3
# scripts/check-zcode-mirror.sh.override.md says the project owns it (--refresh skips such a
# file). Missing is a loud WARN, never a silent skip. `-f`, not `-x`: the script runs through `sh`,
# so its executable bit must not decide whether the check runs. "$PWD" is passed explicitly: git
# runs this hook from the tree root, and an AIF_PROJECT_ROOT inherited from the environment must
# not point the check at another tree.
if [ -f scripts/check-zcode-mirror.sh ]; then
  sh scripts/check-zcode-mirror.sh "$PWD" || exit 1
else
  echo "check-zcode-mirror: WARN scripts/check-zcode-mirror.sh not found — mirror NOT checked; getff's installer puts it back: bash /path/to/getff/install.sh --refresh (skipped while scripts/check-zcode-mirror.sh.override.md marks it project-owned)" >&2
fi
npx lint-staged || exit $?
# A check the pre-push probe (or `npm run validate`) found green waits in a per-clone sidecar; fold it
# into the tracked record (.ai-factory/tool-decisions.md) and stage it, so the flip rides this commit.
# After lint-staged, so its stash-and-restore never sees the index change. A failed fold never blocks
# the commit: the sidecar stays and scripts/run-armed.sh keeps reading it.
if [ -f scripts/run-armed.sh ]; then bash scripts/run-armed.sh --fold || true; fi
