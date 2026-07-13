#!/usr/bin/env bash
# gh-934 (batch B) — install.sh must ship the output-language UserPromptSubmit hook: the
# consumer-generic slice EXTRACTED from the maintainer-only inject-session-bootstrap.sh (which
# stays INTERNAL — it injects the framework's own goal/invariants digest). This hook injects ONLY
# the language signal when AIF_HOOK_LANG is pinned, wired NON-DESTRUCTIVELY into the consumer's
# .claude/settings.json alongside the §1b deps-hash UserPromptSubmit hook. Delivery ≠ liveness
# (#551): the test PROVES the delivered hook FIRES (RU + arbitrary lang) and is a zero-setup no-op
# by default (en/unset).
#
# ARMS:
#   (A) delivery — hook present + executable
#   (B) settings-merge — UserPromptSubmit has BOTH inject-output-language AND the pre-existing
#       §1b deps-hash (append, not clobber — same event)
#   (C) idempotent — a second install adds no duplicate UserPromptSubmit entry
#   (D) firing (RU) — AIF_HOOK_LANG=ru → stdout carries the [output-language] Russian instruction
#   (E) zero-setup default — AIF_HOOK_LANG unset/en → empty stdout (no-op)
#   (F) firing (arbitrary) — AIF_HOOK_LANG=de → stdout names language "de"
#   (G) --refresh restores the hook + registration for a brownfield consumer missing it
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip(){ echo "  · $1"; }

command -v jq >/dev/null 2>&1 || { skip "gh-934-lang SKIP — jq not available (the settings-merge arms need it)"; echo ""; echo "PASS=$PASS FAIL=$FAIL"; exit 0; }

# ── Install a consumer ────────────────────────────────────────────────────────
T=$(mktemp -d)
(
  cd "$T" && git init -q && git config user.email t@t && git config user.name t \
    && printf '{"name":"g934lang","version":"0.0.0"}\n' > package.json \
    && git add -A && git commit -q -m base \
    && bash "$REPO_ROOT/install.sh" ts-server --force
) >"$T/.log" 2>&1

H="$T/.claude/hooks"
S="$T/.claude/settings.json"

# ── ARM (A): delivery ─────────────────────────────────────────────────────────
if [ -x "$H/inject-output-language.sh" ]; then ok "(A) inject-output-language.sh shipped + executable"; else bad "(A) inject-output-language.sh missing/not-exec"; fi

# ── ARM (B): non-destructive same-event settings merge ────────────────────────
_ups=$(jq -r '(.hooks.UserPromptSubmit // []) | map(.hooks[].command) | join("|")' "$S" 2>/dev/null)
if echo "$_ups" | grep -q 'inject-output-language' && echo "$_ups" | grep -q 'CLAUDE_PROJECT_DIR'; then
  ok "(B) UserPromptSubmit has inject-output-language, \$CLAUDE_PROJECT_DIR-relative"
else
  bad "(B) inject-output-language UserPromptSubmit entry missing/mis-shaped (got: $_ups)"
fi
if echo "$_ups" | grep -q 'deps-hash-check'; then
  ok "(B) pre-existing §1b deps-hash UserPromptSubmit hook SURVIVED (non-destructive, same event)"
else
  bad "(B) deps-hash hook lost — merge clobbered a sibling on the same event (got: $_ups)"
fi

# ── ARM (C): idempotency ──────────────────────────────────────────────────────
( cd "$T" && bash "$REPO_ROOT/install.sh" ts-server --force ) >"$T/.log2" 2>&1
_n=$(jq '(.hooks.UserPromptSubmit // []) | map(.hooks[].command) | map(select(test("inject-output-language"))) | length' "$S" 2>/dev/null)
[ "$_n" = 1 ] && ok "(C) idempotent — re-install leaves exactly one inject-output-language entry" || bad "(C) non-idempotent — $_n entries after re-install"

# ── ARM (D): firing RU ────────────────────────────────────────────────────────
OUT_RU=$(printf '' | AIF_HOOK_LANG=ru bash "$H/inject-output-language.sh" 2>/dev/null)
if printf '%s' "$OUT_RU" | grep -q '\[output-language\]' && printf '%s' "$OUT_RU" | grep -q 'AIF_HOOK_LANG=ru'; then
  ok "(D) firing (RU): AIF_HOOK_LANG=ru → the [output-language] Russian instruction is injected (delivery→liveness)"
else
  bad "(D) firing (RU): no output-language line ($(printf '%s' "$OUT_RU" | head -c 100))"
fi

# ── ARM (E): zero-setup default (en/unset → no-op) ────────────────────────────
OUT_EN=$(printf '' | env -u AIF_HOOK_LANG bash "$H/inject-output-language.sh" 2>/dev/null)
OUT_ENEXPL=$(printf '' | AIF_HOOK_LANG=en bash "$H/inject-output-language.sh" 2>/dev/null)
if [ -z "$OUT_EN" ] && [ -z "$OUT_ENEXPL" ]; then
  ok "(E) zero-setup: AIF_HOOK_LANG unset/en → empty stdout (no-op, no consumer setup needed)"
else
  bad "(E) default not a no-op (unset='$OUT_EN' en='$OUT_ENEXPL')"
fi

# ── ARM (F): firing arbitrary language ────────────────────────────────────────
OUT_DE=$(printf '' | AIF_HOOK_LANG=de bash "$H/inject-output-language.sh" 2>/dev/null)
if printf '%s' "$OUT_DE" | grep -q '\[output-language\]' && printf '%s' "$OUT_DE" | grep -q 'language "de"'; then
  ok "(F) firing (arbitrary): AIF_HOOK_LANG=de → generic language instruction names \"de\""
else
  bad "(F) firing (de): no generic language line ($(printf '%s' "$OUT_DE" | head -c 100))"
fi

# ── ARM (G): --refresh restores a brownfield consumer missing the hook ────────
rm -f "$H/inject-output-language.sh"
jq '.hooks.UserPromptSubmit |= (map(select((.hooks[].command | test("inject-output-language")) | not)))' \
  "$S" > "$S.tmp" && mv "$S.tmp" "$S"
( cd "$T" && bash "$REPO_ROOT/install.sh" ts-server --refresh ) >"$T/.log3" 2>&1
_ups2=$(jq -r '(.hooks.UserPromptSubmit // []) | map(.hooks[].command) | join("|")' "$S" 2>/dev/null)
if [ -x "$H/inject-output-language.sh" ] && echo "$_ups2" | grep -q 'inject-output-language' && echo "$_ups2" | grep -q 'deps-hash-check'; then
  ok "(G) --refresh restores the hook + registration for a brownfield consumer (deps-hash still present)"
else
  bad "(G) --refresh did not restore (ups=$_ups2, $(ls "$H" 2>/dev/null | tr '\n' ' '))"
fi

rm -rf "$T"
echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
