#!/usr/bin/env bash
# Wave 7 7.2.c — PostToolUse: principle-09 authority header quick-check.
# Delegates to 09-doc-authority-hierarchy.bin.ts (Batch A, sub-wave 7.1.c).
# Input: hook JSON via stdin. CLI filters to REQUIRED_HEADER_DOCS; exits 0 for other paths.
# @cc-only-rationale: edit-time PostToolUse delivery of the principle-09 authority-header
#   check (delegates to 09-doc-authority-hierarchy.bin.ts). The same rule's portable
#   enforcement is the principle-09 CI test itself — a rule+test lifecycle, excluded from
#   @dual-pair per dual-implementation-discipline.md §9; no portable hook fires at edit-time.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BIN="$REPO_ROOT/packages/core/principles/09-doc-authority-hierarchy.bin.ts"
TSX="$REPO_ROOT/node_modules/.bin/tsx"

if ! command -v jq >/dev/null 2>&1; then
  printf '⚠ check-doc-authority: jq unavailable — skipping\n' >&2; exit 0
fi

ABS_PATH="$(cat | jq -r '.tool_input.file_path // ""' 2>/dev/null || true)"
[[ -z "$ABS_PATH" ]] && exit 0

# Convert absolute path to repo-root-relative (CLI API expects relative paths)
REL_PATH="${ABS_PATH#"$REPO_ROOT/"}"
[[ "$REL_PATH" = "$ABS_PATH" ]] && exit 0   # outside repo — skip

# Runtime dependency: Batch A CLI shim; graceful no-op until it lands
[[ ! -f "$BIN" ]] && exit 0

if [[ ! -x "$TSX" ]]; then
  printf '⚠ check-doc-authority: tsx not found — skipping\n' >&2; exit 0
fi

"$TSX" "$BIN" "$REL_PATH"
