#!/usr/bin/env bash
# gh-974 — a `--full` install whose dependency install did NOT fully land (e.g. pnpm
# `trustPolicy: no-downgrade` aborting the devdep batch) must NOT print an unqualified
# "✅ Installation complete" + exit 0. It must emit an honest degraded banner AND exit
# non-zero, so automation/CI is not misled into treating a broken toolchain as a green install.
#
# ARMS (stub the package manager on PATH to control dep-install success, hermetically):
#   (A) --force (FULL unset, no deps promised)      → "✅ Installation complete", rc=0
#   (B) --full + PM install FAILS (deps incomplete) → degraded banner, rc=1  ← the #974 fix
#   (C) --full + PM install SUCCEEDS                 → "✅ Installation complete", rc=0  (no regression)
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL="$REPO_ROOT/install.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# Build a stub-PM dir: npm/pnpm/yarn all exit with $1 (0 = succeed, 1 = fail).
make_stub() {  # $1 = rc
  local d; d=$(mktemp -d)
  printf '#!/bin/sh\nexit %s\n' "$1" > "$d/npm"
  cp "$d/npm" "$d/pnpm"; cp "$d/npm" "$d/yarn"
  chmod +x "$d/npm" "$d/pnpm" "$d/yarn"
  echo "$d"
}

run_install() {  # $1 = stub-rc ("" = no stub), $2.. = install args
  local stub_rc="$1"; shift
  local c; c=$(mktemp -d)
  ( cd "$c" && git init -q && git config user.email t@t && git config user.name t \
      && printf '{"name":"c974","version":"0.0.0"}\n' > package.json \
      && git add -A && git commit -q -m base )
  local path="$PATH"
  [ -n "$stub_rc" ] && path="$(make_stub "$stub_rc"):$PATH"
  ( cd "$c" && PATH="$path" bash "$INSTALL" "$@" ) > "$c/.log" 2>&1
  local rc=$?
  echo "$rc|$c/.log"
}

# ── ARM (A): --force → ✅ complete, rc=0 ──────────────────────────────────────
res=$(run_install "" ts-server --force); rc="${res%%|*}"; log="${res##*|}"
if [ "$rc" -eq 0 ] && grep -q '✅ Installation complete' "$log"; then
  ok "(A) --force → ✅ Installation complete, rc=0 (FULL unset, no deps promised — unchanged)"
else
  bad "(A) --force expected ✅ + rc=0, got rc=$rc (tail: $(tail -2 "$log" | tr '\n' '|'))"
fi

# ── ARM (B): --full + failing deps → degraded banner, rc=1 (the fix) ──────────
res=$(run_install 1 ts-server --full); rc="${res%%|*}"; log="${res##*|}"
if [ "$rc" -ne 0 ] && grep -q 'dependencies did NOT fully install' "$log" && ! grep -q '✅ Installation complete' "$log"; then
  ok "(B) --full + failed dep-install → honest degraded banner, rc=$rc (NOT a silent ✅ complete)"
else
  bad "(B) --full+failed-deps expected degraded banner + rc!=0, got rc=$rc (tail: $(tail -3 "$log" | tr '\n' '|'))"
fi

# ── ARM (C): --full + succeeding deps → ✅ complete, rc=0 (no regression) ──────
res=$(run_install 0 ts-server --full); rc="${res%%|*}"; log="${res##*|}"
if [ "$rc" -eq 0 ] && grep -q '✅ Installation complete' "$log" && ! grep -q 'dependencies did NOT' "$log"; then
  ok "(C) --full + successful dep-install → ✅ Installation complete, rc=0 (happy path unchanged)"
else
  bad "(C) --full+ok-deps expected ✅ + rc=0, got rc=$rc (tail: $(tail -3 "$log" | tr '\n' '|'))"
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
