#!/usr/bin/env bash
# format-getff-writes.test.sh — a project file getff edits in place stays in the project's formatter style.
#
# P6 F8 (2026-09-30, create-vite react-ts): create-vite's .oxlintrc.json passed prettier before the install
# and failed it after — getff's inserted `overrides` laid each short `files` array out one element per
# line, where prettier keeps it on one line. So `format:check` was recorded not armed on a file getff broke.
# setup.d/lib.sh format_getff_writes runs the PROJECT's prettier on every file the install changed whose
# committed version passes that prettier; a file the project already had out of style is left as it is.
#
# ARMS:
#   (A) a committed prettier-clean .oxlintrc.json, edited the way getff edits it → prettier --check passes after;
#       a file the install did not change is not touched, even when it is out of style
#   (B) paired negative: the committed version is already out of prettier style → the file is not touched
#   (D) no prettier in the project → nothing is touched, rc 0
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
W=$(mktemp -d)
trap 'rm -rf "$W"' EXIT

PRETTIER=""
for _cand in "$REPO_ROOT" "$(cd "$REPO_ROOT/../.." 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null)"; do
  [ -n "$_cand" ] && [ -x "$_cand/node_modules/.bin/prettier" ] && { PRETTIER="$_cand/node_modules/prettier/bin/prettier.cjs"; break; }
done
[ -n "$PRETTIER" ] || { echo "✗ no prettier in the repo's node_modules — run the repo's npm ci first (never skipped)"; exit 1; }

CLEAN='{
  "plugins": ["react", "typescript", "oxc"],
  "rules": {
    "react/rules-of-hooks": "error"
  }
}
'
# What getff's JSON writer leaves: its new entry first, each array one element per line.
EDITED='{
  "overrides": [
    {
      "files": [
        "**/*",
        "**/__getff_proof__/**"
      ],
      "rules": {
        "no-empty": "error"
      }
    }
  ],
  "plugins": ["react", "typescript", "oxc"],
  "rules": {
    "react/rules-of-hooks": "error"
  }
}
'
project() {  # $1 = committed .oxlintrc.json text, $2 = "with-prettier" or ""
  local P; P=$(mktemp -d "$W/p.XXXX")
  printf '%s' "$1" > "$P/.oxlintrc.json"
  printf '{"singleQuote":true}\n' > "$P/.prettierrc.json"
  printf 'const  a =  1\n' > "$P/untouched.ts"
  if [ "${2:-}" = with-prettier ]; then
    mkdir -p "$P/node_modules/.bin"
    printf '#!/bin/sh\nexec node "%s" "$@"\n' "$PRETTIER" > "$P/node_modules/.bin/prettier"
    chmod +x "$P/node_modules/.bin/prettier"
  fi
  printf 'node_modules\n' > "$P/.gitignore"
  git -C "$P" init -q && git -C "$P" add -A && git -C "$P" -c user.email=t@t -c user.name=t commit -qm init
  echo "$P"
}
run() {  # $1 = project dir
  ( PROJECT_ROOT="$1"; INSTALL_SH_LIB_ONLY=1
    # shellcheck disable=SC1090
    source "$REPO_ROOT/setup.d/lib.sh"; format_getff_writes; echo "RC=$?" ) 2>&1
}
check() { ( cd "$1" && node "$PRETTIER" --check "$2" >/dev/null 2>&1 ); }

echo "▶ (A) a prettier-clean committed config, edited by getff"
P=$(project "$CLEAN" with-prettier); printf '%s' "$EDITED" > "$P/.oxlintrc.json"
check "$P" .oxlintrc.json && bad "(A) precondition: the edited file should be out of style" || ok "(A) precondition: getff's edit is out of prettier style"
_out=$(run "$P")
check "$P" .oxlintrc.json && ok "(A) prettier --check passes after the install" || bad "(A) still out of style (got: $_out)"
grep -q '"files": \["\*\*/\*", "\*\*/__getff_proof__/\*\*"\]' "$P/.oxlintrc.json" && ok "(A) getff's short array is on one line" || bad "(A) array not collapsed: $(cat "$P/.oxlintrc.json")"
check "$P" untouched.ts && bad "(A) a file the install did not change was formatted" || ok "(A) a file the install did not change stays as it was"

echo "▶ (B) paired negative: the committed config was already out of style"
DIRTY='{ "plugins": [
  "react"
] }
'
P=$(project "$DIRTY" with-prettier); printf '%s' "$EDITED" > "$P/.oxlintrc.json"
_before=$(cat "$P/.oxlintrc.json"); run "$P" >/dev/null
[ "$(cat "$P/.oxlintrc.json")" = "$_before" ] && ok "(B) the project's own style debt is left as it is" || bad "(B) a file out of style before the install was reformatted"

echo "▶ (D) no prettier in the project"
P=$(project "$CLEAN" ""); printf '%s' "$EDITED" > "$P/.oxlintrc.json"
_before=$(cat "$P/.oxlintrc.json"); _out=$(run "$P")
[ "$(cat "$P/.oxlintrc.json")" = "$_before" ] && grep -q 'RC=0' <<<"$_out" && ok "(D) nothing touched, rc 0" || bad "(D) touched or rc ≠ 0 (got: $_out)"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
