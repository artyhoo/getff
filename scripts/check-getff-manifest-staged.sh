#!/usr/bin/env bash
# check-getff-manifest-staged.sh — a commit that touches the getff payload must carry the
# matching packages/getff/MANIFEST.sha256, and every new payload file must be tracked first.
#
# WHY A COMMIT-TIME GATE. scripts/build-getff-dist.sh --check compares the WORKING-TREE
# manifest with a fresh assembly of the WORKING TREE, and the assembly lists files with
# `git ls-files`. Two staging mistakes are invisible to it by construction, and both reached CI:
#   · #1627 (2026-09-05) — a path-scoped commit (`git add packages/<pkg>` + `git commit`, no -a)
#     left the rebuilt manifest out. Working tree in sync, --check GREEN, the getff-dist CI cell
#     RED on every touched file.
#   · #1625 (2026-09-05) — a new vendored file was still untracked when the manifest was built.
#     Manifest and assembly BOTH excluded it, --check said «in sync», and the payload would have
#     shipped CLIs importing a file the package does not deliver.
# Pre-commit is the earliest channel that can see either: the index exists only there.
#
# WHAT IT CHECKS, only when the index carries a payload change or the manifest itself (pathspecs
# from `build-getff-dist.sh --list-payload`, the single source of the list):
#   1. no UNTRACKED, un-ignored payload file sits in the SAME directory as a staged payload path —
#      the #1625 shape, a new file next to the code that uses it. Scoped on purpose: across all
#      payload roots the arm blocked every payload commit in 8 of 151 worktrees on 2026-10-01
#      (test temp dirs such as packages/core/install/.nrule-probe-*, in-progress files elsewhere),
#      which trains people to sweep unrelated files into commits or to spend the escape;
#   2. `build-getff-dist.sh --check-index` — the staged manifest equals a fresh assembly of the
#      staged payload. A manifest left unstaged is the common way to fail this, and the message
#      names it. A payload change that moves no hash (a mode-only change) passes without a
#      staged manifest on purpose: there is nothing for the manifest to record.
# git honours GIT_INDEX_FILE throughout, so under `git commit -a` / `git commit <path>` the
# check reads the temporary index the commit will record, not .git/index.
#
# ESCAPE: GETFF_MANIFEST_STAGED_ALLOW='<why, ≥20 chars>' downgrades a failure to a logged pass
# (precedent: .claude/rules/ci-tool-pinning.md §3, AIF_ALWAYSON_BUDGET_ALLOW). The rationale is
# appended to <git-common-dir>/getff-manifest-staged-allow.log; if it cannot be logged, the
# escape is refused. The only later backstop is the getff-dist CI cell: pre-push payload-drift
# (packages/core/hooks/pre-push.ts payloadDriftSection) reads the WORKING-TREE manifest, so a
# rebuilt manifest left out of the commit satisfies it too.
#
# Runs from any cwd (root derived from this file's location). Bash 3.2-compatible (macOS default).
# Test: scripts/check-getff-manifest-staged.test.sh (paired-negative, throw-away git repos).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
BUILDER="$ROOT/scripts/build-getff-dist.sh"
MANIFEST_PATH="packages/getff/MANIFEST.sha256"

PAYLOAD=()
while IFS= read -r spec; do
  [ -n "$spec" ] && PAYLOAD+=("$spec")
done <<<"$(bash "$BUILDER" --list-payload)"
[ "${#PAYLOAD[@]}" -gt 0 ] || { echo "ERROR: build-getff-dist.sh --list-payload printed nothing" >&2; exit 1; }

# The manifest is part of the trigger: a manifest-only commit rebuilt from unstaged payload edits
# records hashes its own tree does not have.
STAGED="$(git -C "$ROOT" diff --cached --name-only -- "${PAYLOAD[@]}" "$MANIFEST_PATH")"
[ -n "$STAGED" ] || exit 0

problems=""
# indent <prefix>: prefix every stdin line (a read loop, not sed — shellcheck SC2001 at CI severity).
indent() { local line; while IFS= read -r line; do printf '%s%s\n' "$1" "$line"; done; }

STAGED_DIRS=""
while IFS= read -r p; do
  [ "$p" = "$MANIFEST_PATH" ] && continue
  STAGED_DIRS="${STAGED_DIRS}$(dirname "$p")
"
done <<<"$STAGED"
UNTRACKED=""
while IFS= read -r f; do
  [ -n "$f" ] || continue
  grep -qxF "$(dirname "$f")" <<<"$STAGED_DIRS" && UNTRACKED="${UNTRACKED}${f}
"
done <<<"$(git -C "$ROOT" ls-files --others --exclude-standard -- "${PAYLOAD[@]}")"
if [ -n "$UNTRACKED" ]; then
  # Under `git commit <path>` the index is HEAD + those paths, so a file `git add`ed but left
  # out of the pathspec also lands here — hence «not in this commit».
  problems="${problems}payload file(s) next to what this commit changes are untracked or not in this commit — the manifest cannot include them:
$(indent '    ' <<<"${UNTRACKED%
}")
  fix: git add them (they ship) or gitignore them; then rebuild and stage the manifest
"
fi

index_rc=0
index_out="$(bash "$BUILDER" --check-index 2>&1)" || index_rc=$?
if [ "$index_rc" -ne 0 ] && ! grep -q '^DRIFT' <<<"$index_out"; then
  # Not a verdict about the staging at all (checkout-index failed, a symlink, an empty root):
  # say so instead of blaming the manifest.
  problems="${problems}build-getff-dist.sh --check-index could not run (exit $index_rc):
$(indent '  ' <<<"$index_out")
"
elif [ "$index_rc" -ne 0 ]; then
  if [ -z "$(git -C "$ROOT" diff --cached --name-only -- "$MANIFEST_PATH")" ]; then
    lead="$MANIFEST_PATH is not staged, but the commit changes the getff payload:"
  else
    lead="the staged $MANIFEST_PATH does not match the staged payload:"
  fi
  problems="${problems}${lead}
$(head -20 <<<"$STAGED" | indent '    ')
$(indent '  ' <<<"$index_out")
  fix: stage every payload edit the manifest should record, then
       bash scripts/build-getff-dist.sh && git add $MANIFEST_PATH
       (the build reads the WORKING TREE: an unstaged payload edit still lands in the manifest)
"
fi

[ -n "$problems" ] || exit 0

echo "❌ getff payload commit without its manifest:" >&2
printf '%s' "$problems" >&2

allow="${GETFF_MANIFEST_STAGED_ALLOW:-}"
if [ -z "$allow" ]; then
  echo "  escape (logged): GETFF_MANIFEST_STAGED_ALLOW='<why, ≥20 chars>'" >&2
  exit 1
fi
if [ "${#allow}" -lt 20 ]; then
  echo "  GETFF_MANIFEST_STAGED_ALLOW refused: the rationale is ${#allow} chars, needs ≥20 — say WHY the manifest cannot enter this commit" >&2
  exit 1
fi
common="$(git -C "$ROOT" rev-parse --git-common-dir)"
case "$common" in /*) ;; *) common="$ROOT/$common" ;; esac
log="$common/getff-manifest-staged-allow.log"
stamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
if ! printf '%s\t%s\t%s\n' "$stamp" "$(tr '\n' ' ' <<<"$STAGED")" "$allow" >>"$log" 2>/dev/null; then
  echo "  GETFF_MANIFEST_STAGED_ALLOW refused: could not append to $log — an escape leaves a trace or does not pass" >&2
  exit 1
fi
echo "  ⚠ allowed by GETFF_MANIFEST_STAGED_ALLOW (logged to $log): $allow" >&2
exit 0
