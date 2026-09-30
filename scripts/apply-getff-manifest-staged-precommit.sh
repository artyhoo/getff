#!/usr/bin/env bash
# apply-getff-manifest-staged-precommit.sh — MAINTAINER-ONLY: wire scripts/check-getff-manifest-staged.sh
# into .husky/pre-commit as one atomic commit.
#
# WHY A MAINTAINER STEP. .claude/settings.json denies agents Edit/Write(.husky/**): the hook layer is
# maintainer-owned (CLAUDE.md «Artifact Ownership Contract»). The agent that built the check ships the
# change as scripts/check-getff-manifest-staged.precommit.patch and this script; running it is the
# maintainer's act, not the agent's.
#
# What it does: refuse unless the tracked tree is clean; detach at $APPLY_BASE_REF (default
# origin/staging, fetched first); `git apply` the patch; `bash -n` the hook; run the checker's
# paired-negative test; regenerate docs/site/reference (the hook is a census wiring surface, so
# F3's `unwired` list moves); assert the index holds exactly the hook and F3.json; commit; only
# then create branch maintainer/precommit-getff-manifest-staged at that commit. Any failure before
# the commit restores the files and returns to the branch you started on — nothing to delete.
# `--pr` then pushes the branch and opens a PR against staging.
# Idempotent: an already-wired hook exits 0 (with --pr on the maintainer branch it still pushes).
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
BASE_REF="${APPLY_BASE_REF:-origin/staging}"

if grep -qF 'scripts/check-getff-manifest-staged.sh' "$HOOK"; then
  if [ "$MODE" = "--pr" ] && [ "$(git rev-parse --abbrev-ref HEAD)" = "$BRANCH" ]; then
    echo "✓ $HOOK already wired on $BRANCH — pushing and opening the PR"
  else
    echo "✓ $HOOK already runs check-getff-manifest-staged.sh — nothing to do"
    exit 0
  fi
else
  # Clean TRACKED tree, not only a clean index: the reference render below reads the working
  # tree, so a dirty scripts/ edit would ship inside a commit labelled wiring-only.
  [ -z "$(git status --porcelain --untracked-files=no)" ] \
    || fail "tracked files are modified or staged — commit or restore them first (the maintainer commit must carry the hook change alone)"
  if git show-ref --verify -q "refs/heads/$BRANCH"; then
    fail "branch $BRANCH already exists — finish or remove it first"
  fi
  case "$BASE_REF" in origin/*) git fetch -q origin "${BASE_REF#origin/}" ;; esac
  prev="$(git rev-parse --abbrev-ref HEAD)"
  git switch -q --detach "$BASE_REF"
  rollback() {
    git reset -q -- "$HOOK" 2>/dev/null || true
    git checkout -q -- "$HOOK" 2>/dev/null || true
    if [ -d docs/site/reference ]; then
      git reset -q -- docs/site/reference 2>/dev/null || true
      git checkout -q -- docs/site/reference 2>/dev/null || true
    fi
    git switch -q "$prev" || true
    fail "$1 — restored, back on $prev"
  }
  { [ -f "$PATCH" ] && [ -f scripts/check-getff-manifest-staged.sh ]; } \
    || rollback "$BASE_REF does not carry the check yet (merge its PR first)"
  git apply --check "$PATCH" 2>/dev/null || rollback "$PATCH no longer applies to $HOOK on $BASE_REF — ask an agent to regenerate it"
  git apply "$PATCH"
  bash -n "$HOOK" || rollback "$HOOK has a syntax error after the patch"
  bash scripts/check-getff-manifest-staged.test.sh >/dev/null || rollback "check-getff-manifest-staged.test.sh is RED"
  git add "$HOOK"
  # Absent renderer (a fixture) = nothing to regenerate.
  if [ -f scripts/render-reference.mjs ]; then
    npx tsx scripts/render-reference.mjs --write >/dev/null || rollback "render-reference.mjs --write failed"
    git add docs/site/reference
  fi
  extra="$(git diff --cached --name-only | grep -vxF -e "$HOOK" -e docs/site/reference/F3.json || true)"
  [ -z "$extra" ] || rollback "the commit would carry more than the hook and F3.json: $(tr '\n' ' ' <<<"$extra")"
  git commit -q -m "chore(husky): run the getff MANIFEST-staged check at pre-commit (maintainer commit)" -m \
"Applies scripts/check-getff-manifest-staged.precommit.patch. Agents are denied Edit/Write(.husky/**)
by .claude/settings.json, so the agent that built the check shipped the hook change as a patch and
this maintainer commit lands it." || rollback "git commit failed"
  git switch -q -c "$BRANCH"
  echo "✓ committed $HOOK on $BRANCH (off $BASE_REF)"
fi

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
- `docs/site/reference/F3.json`: regenerated — the check is no longer `unwired` once the hook calls it.

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
