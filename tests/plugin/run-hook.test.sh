#!/usr/bin/env bash
# S1 acceptance — run-hook.cmd Unix path: dispatches a named sibling script; non-zero on missing arg.
# spec: docs/superpowers/specs/2026-06-22-cc-plugin-packaging-design.md §3 (#3, ADOPT-audited per T13)
#
# AUDIT FINDING (T13): superpowers' run-hook.cmd guards the missing-arg case only in its
# Windows batch block (`if "%~1"=="" ... exit /b 1`). On the Unix path there is no explicit
# guard — an empty name makes `exec bash "${SCRIPT_DIR}/"` fail with a NON-ZERO (not == 1)
# code. The contract we assert on Unix is therefore "non-zero", not "exactly 1".
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
RH="$REPO_ROOT/plugin/hooks/run-hook.cmd"
PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); echo "  ✓ $1"; }
bad(){ FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# Isolated copy so the plugin payload is never polluted by the test.
TMPD=$(mktemp -d)
trap 'rm -rf "$TMPD"' EXIT
cp "$RH" "$TMPD/run-hook.cmd"
printf 'echo RH_OK\n' > "$TMPD/__target__"

# Missing arg → non-zero exit (guard is Windows-only; Unix fails on the empty dispatch).
bash "$TMPD/run-hook.cmd" >/dev/null 2>&1; rc=$?
[ "$rc" -ne 0 ] && ok "missing script name exits non-zero (rc=$rc)" || bad "missing-arg returned 0"

# Dispatch a named sibling script.
OUT=$(bash "$TMPD/run-hook.cmd" __target__ 2>/dev/null)
[ "$OUT" = "RH_OK" ] && ok "dispatches named sibling script" || bad "dispatch output was '$OUT'"

# ── AIF_HOOK_LANG file fallback (incident 2026-09-13: pin never reached ZCode hooks) ──
# Target prints the resolved language so the arms assert what the dispatched hook SEES.
printf 'echo "LANG=${AIF_HOOK_LANG:-unset}"\n' > "$TMPD/__lang_probe__"
CFG="$TMPD/home/.config/getff"
mkdir -p "$CFG"

# 1. Env var present → wins, file not consulted.
OUT=$(AIF_HOOK_LANG=de HOME="$TMPD/home" bash "$TMPD/run-hook.cmd" __lang_probe__ 2>/dev/null)
[ "$OUT" = "LANG=de" ] && ok "env var wins over file" || bad "env precedence broken: '$OUT'"

# 2. Env unset + file says ru → fallback applies (the ZCode GUI-launch case).
printf 'ru\n' > "$CFG/hook-lang"
OUT=$(env -u AIF_HOOK_LANG -u XDG_CONFIG_HOME HOME="$TMPD/home" bash "$TMPD/run-hook.cmd" __lang_probe__ 2>/dev/null)
[ "$OUT" = "LANG=ru" ] && ok "file fallback applies when env unset" || bad "fallback not applied: '$OUT'"

# 3. Env unset + no file → stays unset (English zero-setup default unchanged).
rm "$CFG/hook-lang"
OUT=$(env -u AIF_HOOK_LANG -u XDG_CONFIG_HOME HOME="$TMPD/home" bash "$TMPD/run-hook.cmd" __lang_probe__ 2>/dev/null)
[ "$OUT" = "LANG=unset" ] && ok "no file, no env → unset (default en path)" || bad "unexpected injection: '$OUT'"

# 4. Malformed file content → ignored, stays unset.
printf 'ru123!!\n' > "$CFG/hook-lang"
OUT=$(env -u AIF_HOOK_LANG -u XDG_CONFIG_HOME HOME="$TMPD/home" bash "$TMPD/run-hook.cmd" __lang_probe__ 2>/dev/null)
[ "$OUT" = "LANG=unset" ] && ok "malformed file ignored" || bad "malformed accepted: '$OUT'"

# 5. XDG_CONFIG_HOME honored.
mkdir -p "$TMPD/xdg/getff"; printf 'ru\n' > "$TMPD/xdg/getff/hook-lang"
OUT=$(env -u AIF_HOOK_LANG HOME="$TMPD/home" XDG_CONFIG_HOME="$TMPD/xdg" bash "$TMPD/run-hook.cmd" __lang_probe__ 2>/dev/null)
[ "$OUT" = "LANG=ru" ] && ok "XDG_CONFIG_HOME path honored" || bad "XDG ignored: '$OUT'"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
