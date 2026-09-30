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

# P6 run 2 N5 (seam agreed with P3): a file git does not track — P3's .claude/settings.local.json, created
# untracked and excluded through .git/info/exclude, which prettier does not read — has no committed version.
# Its «before» is what .ai-factory/before-getff/ recorded: <rel>.absent = getff created it (clean by definition),
# <rel>.<sum8> = getff changed it and kept the original there.
OUT_OF_STYLE='{"permissions":{"allow":["Bash(npm run lint)","Bash(npm test)"]},"env":{"A":"1"}}
'
echo "▶ (E) an untracked file getff created (<rel>.absent)"
P=$(project "$CLEAN" with-prettier); mkdir -p "$P/.claude" "$P/.ai-factory/before-getff/.claude"
printf '%s' "$OUT_OF_STYLE" > "$P/.claude/settings.local.json"; : > "$P/.ai-factory/before-getff/.claude/settings.local.json.absent"
printf '.claude/settings.local.json\n' >> "$P/.git/info/exclude"
check "$P" .claude/settings.local.json && bad "(E) precondition: the created file should be out of style" || ok "(E) precondition: out of style"
_out=$(run "$P")
check "$P" .claude/settings.local.json && ok "(E) prettier --check passes on the file getff created" || bad "(E) still out of style (got: $_out)"

echo "▶ (F) an untracked file getff changed, its prettier-clean original kept (<rel>.<sum8>)"
P=$(project "$CLEAN" with-prettier); mkdir -p "$P/.ai-factory/before-getff"
printf '{ "a": 1 }\n' > "$P/.ai-factory/before-getff/local.json.0a1b2c3d"
printf '%s' "$OUT_OF_STYLE" > "$P/local.json"
_out=$(run "$P")
check "$P" local.json && ok "(F) prettier --check passes after the install" || bad "(F) still out of style (got: $_out)"

echo "▶ (G) paired negative: the kept original of an untracked file was already out of style"
P=$(project "$CLEAN" with-prettier); mkdir -p "$P/.ai-factory/before-getff"
printf '{"a":1}\n' > "$P/.ai-factory/before-getff/local.json.0a1b2c3d"
printf '%s' "$OUT_OF_STYLE" > "$P/local.json"
_before=$(cat "$P/local.json"); run "$P" >/dev/null
[ "$(cat "$P/local.json")" = "$_before" ] && ok "(G) the project's own style debt is left as it is" || bad "(G) a file out of style before the install was reformatted"

echo "▶ (H) an untracked file getff never wrote"
P=$(project "$CLEAN" with-prettier); printf '%s' "$OUT_OF_STYLE" > "$P/own.json"
_before=$(cat "$P/own.json"); run "$P" >/dev/null
[ "$(cat "$P/own.json")" = "$_before" ] && ok "(H) not touched" || bad "(H) a file getff never wrote was formatted"

echo "▶ (I) two kept originals: the newest decides (an older clean copy does not)"
P=$(project "$CLEAN" with-prettier); mkdir -p "$P/.ai-factory/before-getff"
printf '{ "a": 1 }\n' > "$P/.ai-factory/before-getff/local.json.00000001"; touch -t 202601010000 "$P/.ai-factory/before-getff/local.json.00000001"
printf '{"a":1}\n' > "$P/.ai-factory/before-getff/local.json.ffffffff"; touch -t 202609010000 "$P/.ai-factory/before-getff/local.json.ffffffff"
printf '%s' "$OUT_OF_STYLE" > "$P/local.json"
_before=$(cat "$P/local.json"); run "$P" >/dev/null
[ "$(cat "$P/local.json")" = "$_before" ] && ok "(I) the newest original was out of style → left as it is" || bad "(I) an older clean copy decided"

echo "▶ (J) another path's record (<rel>.bak.<sum8>) does not decide for <rel>"
P=$(project "$CLEAN" with-prettier); mkdir -p "$P/.ai-factory/before-getff"
printf '{ "a": 1 }\n' > "$P/.ai-factory/before-getff/local.json.00000001"; touch -t 202601010000 "$P/.ai-factory/before-getff/local.json.00000001"
printf '{"a":1}\n' > "$P/.ai-factory/before-getff/local.json.bak.ffffffff"; touch -t 202609010000 "$P/.ai-factory/before-getff/local.json.bak.ffffffff"
printf '%s' "$OUT_OF_STYLE" > "$P/local.json"; printf '%s' "$OUT_OF_STYLE" > "$P/local.json.bak"
run "$P" >/dev/null
check "$P" local.json && ok "(J) local.json decided by its own clean record" || bad "(J) local.json.bak's record decided for local.json"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
