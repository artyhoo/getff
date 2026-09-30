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
# WHAT IT CHECKS, only when the index carries a payload change (pathspecs from
# `build-getff-dist.sh --list-payload`, the single source of the list):
#   1. no UNTRACKED, un-ignored file sits under a payload root — `git add` it (it ships) or
#      gitignore it; the assembler would silently leave it out;
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

STAGED="$(git -C "$ROOT" diff --cached --name-only -- "${PAYLOAD[@]}")"
[ -n "$STAGED" ] || exit 0

problems=""
# indent <prefix>: prefix every stdin line (a read loop, not sed — shellcheck SC2001 at CI severity).
indent() { local line; while IFS= read -r line; do printf '%s%s\n' "$1" "$line"; done; }

UNTRACKED="$(git -C "$ROOT" ls-files --others --exclude-standard -- "${PAYLOAD[@]}")"
if [ -n "$UNTRACKED" ]; then
  problems="${problems}untracked file(s) under a getff payload root — the manifest cannot include them:
$(indent '    ' <<<"$UNTRACKED")
  fix: git add them (they ship), or gitignore them; then rebuild and stage the manifest
"
fi

index_rc=0
index_out="$(bash "$BUILDER" --check-index 2>&1)" || index_rc=$?
if [ "$index_rc" -ne 0 ]; then
  if [ -z "$(git -C "$ROOT" diff --cached --name-only -- "$MANIFEST_PATH")" ]; then
    lead="$MANIFEST_PATH is not staged, but the commit changes the getff payload:"
  else
    lead="the staged $MANIFEST_PATH does not match the staged payload:"
  fi
  problems="${problems}${lead}
$(head -20 <<<"$STAGED" | indent '    ')
$(indent '  ' <<<"$index_out")
  fix: bash scripts/build-getff-dist.sh && git add $MANIFEST_PATH
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
