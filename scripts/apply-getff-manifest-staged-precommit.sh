#!/usr/bin/env bash
# apply-getff-manifest-staged-precommit.sh — MAINTAINER-ONLY: wire scripts/check-getff-manifest-staged.sh
# into .husky/pre-commit as one atomic commit.
#
# WHY A MAINTAINER STEP. .claude/settings.json denies agents Edit/Write(.husky/**): the hook layer is
# maintainer-owned (CLAUDE.md «Artifact Ownership Contract»). The agent that built the check ships the
# change as scripts/check-getff-manifest-staged.precommit.patch and this script; running it is the
# maintainer's act, not the agent's.
#
# What it does: refuse unless the index is empty and .husky/pre-commit is unmodified; `git apply` the
# patch; `bash -n` the hook; run the checker's paired-negative test; commit .husky/pre-commit ALONE.
# On staging/main it first creates branch maintainer/precommit-getff-manifest-staged.
# `--pr` then pushes the branch and opens a PR against staging with a gate-compliant body.
# Idempotent: an already-wired hook exits 0 without touching anything.
#
# Usage: bash scripts/apply-getff-manifest-staged-precommit.sh [--pr]
# Bash 3.2-compatible (macOS default).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
PATCH="scripts/check-getff-manifest-staged.precommit.patch"
HOOK=".husky/pre-commit"
BRANCH="maintainer/precommit-getff-manifest-staged"
fail() { echo "ERROR: $*" >&2; exit 1; }

MODE="${1:-}"
case "$MODE" in ""|--pr) ;; *) echo "usage: $0 [--pr]" >&2; exit 2 ;; esac

cd "$ROOT"
[ -f "$PATCH" ] || fail "$PATCH missing — run this from a checkout that contains the check"
[ -f scripts/check-getff-manifest-staged.sh ] || fail "scripts/check-getff-manifest-staged.sh missing"

if grep -qF 'scripts/check-getff-manifest-staged.sh' "$HOOK"; then
  echo "✓ $HOOK already runs check-getff-manifest-staged.sh — nothing to do"
  exit 0
fi

[ -z "$(git diff --cached --name-only)" ] || fail "the index is not empty — the maintainer commit must carry $HOOK alone"
git diff --quiet -- "$HOOK" || fail "$HOOK has unstaged edits — commit or restore them first"
git apply --check "$PATCH" || fail "$PATCH no longer applies to $HOOK (the hook moved) — ask an agent to regenerate it"

case "$(git rev-parse --abbrev-ref HEAD)" in
  staging|main) git switch -c "$BRANCH" ;;
esac

git apply "$PATCH"
bash -n "$HOOK" || { git checkout -- "$HOOK"; fail "$HOOK has a syntax error after the patch — reverted"; }
bash scripts/check-getff-manifest-staged.test.sh >/dev/null \
  || { git checkout -- "$HOOK"; fail "check-getff-manifest-staged.test.sh is RED — reverted $HOOK"; }

git add "$HOOK"
git commit -m "chore(husky): run the getff MANIFEST-staged check at pre-commit (maintainer commit)" -m \
"Applies scripts/check-getff-manifest-staged.precommit.patch. Agents are denied Edit/Write(.husky/**)
by .claude/settings.json, so the agent that built the check shipped the hook change as a patch and
this maintainer commit lands it."
echo "✓ committed $HOOK on $(git rev-parse --abbrev-ref HEAD)"

[ "$MODE" = "--pr" ] || { echo "  next: re-run with --pr to push and open the PR"; exit 0; }

git push -u origin HEAD
gh pr create --base staging --title "chore(husky): run the getff MANIFEST-staged check at pre-commit" --body-file - <<'BODY'
## Summary

Maintainer commit that wires `scripts/check-getff-manifest-staged.sh` into `.husky/pre-commit`. The check,
its paired-negative test and the patch landed earlier in an agent PR; agents are denied `Edit/Write(.husky/**)`
by `.claude/settings.json`, so the hook edit is applied here by `scripts/apply-getff-manifest-staged-precommit.sh`.

## Changes

- `.husky/pre-commit`: one block before `exit "$fail"` that runs the checker (last, so it reads the index after
  the invariants render re-stages a payload hook).

## Prior-art consult

- [x] Not a capability commit — `.husky/pre-commit` is outside `packages/`; the check itself is covered by the agent PR.

## Test plan

- [x] `bash scripts/check-getff-manifest-staged.test.sh` green (run by the apply script before committing)
- [x] `bash -n .husky/pre-commit` (run by the apply script)

## Provenance

n/a

## Review findings

n/a

## Fidelity verdict

FIDELITY: skipped — maintainer hook wiring for an already-merged check; no kickoff applies

## Parked questions

n/a

## §1.7 Self-discipline check (REQUIRED if PR touches discipline-bearing files)

### §1.7 Skipped: wiring-only maintainer commit — one pre-commit block calling a check whose design, tests and §1.7 review shipped in the agent PR
BODY
