#!/usr/bin/env sh
# Pre-commit hook: fast checks only (target: <5 seconds).
# Heavy checks live in pre-push and CI.
# @aif-shield: pre-commit — framework-owned commit shield. Do NOT replace with a bare
#   git-hooks manager: a `prepare`-driven manager (e.g. simple-git-hooks) that regenerates
#   .husky/ will clobber this and the sibling pre-push (GH #975). check-shields-up.sh gates
#   on this marker so a silent replacement is caught, not passed on the bare `lint-staged` string.
#
# Install: place at .husky/pre-commit and run `chmod +x .husky/pre-commit`

npx lint-staged
