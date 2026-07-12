#!/usr/bin/env bash
# gh-975 — a consumer `prepare`-driven git-hooks manager (simple-git-hooks) clobbers the
# framework .husky/pre-push during 70-deps' install; reassert_husky_shields (lib.sh) must
# restore it AFTER deps, and check-shields-up must gate on the @aif-shield marker (not the
# bare `lint-staged` string a competing hook also carries).
#
# ARMS:
#   (A) clobber → reassert restores pre-push + framework pre-commit (marker) + hooksPath, WARNs
#   (B) shields-up FAILS on the clobbered pre-commit (marker gate) and PASSES after re-assert
#   (C) idempotency/paired-negative: a repo whose hooks already match templates → no re-assert (no WARN)
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PC_TPL="$REPO_ROOT/packages/core/templates/shared/husky-pre-commit.sh"
PP_TPL="$REPO_ROOT/packages/core/templates/shared/husky-pre-push.sh"
SHIELDS="$REPO_ROOT/packages/core/audit-self/check-shields-up.sh"

PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# shellcheck disable=SC1090
INSTALL_SH_LIB_ONLY=1 source "$REPO_ROOT/setup.d/lib.sh"
if ! command -v reassert_husky_shields >/dev/null 2>&1; then
  bad "reassert_husky_shields not exported from lib.sh"
  echo ""; echo "PASS=$PASS FAIL=$FAIL"; exit 1
fi

T=$(mktemp -d)
git -C "$T" init -q; git -C "$T" config user.email t@t; git -C "$T" config user.name t
mkdir -p "$T/.husky"
# Framework hooks initially present (as 50-hooks would place them).
cp "$PC_TPL" "$T/.husky/pre-commit"; cp "$PP_TPL" "$T/.husky/pre-push"
chmod +x "$T/.husky/pre-commit" "$T/.husky/pre-push"
git -C "$T" config core.hooksPath .husky
# Consumer package.json declaring a competing prepare-driven manager.
cat > "$T/package.json" <<'JSON'
{ "name": "c975", "version": "0.0.0",
  "scripts": { "prepare": "simple-git-hooks" },
  "simple-git-hooks": { "pre-commit": "npx lint-staged" } }
JSON

# ── Simulate the 70-deps clobber: simple-git-hooks regenerates .husky, drops pre-push,
#    replaces pre-commit with its own (lint-staged, NO @aif-shield marker) ──────────────
rm -f "$T/.husky/pre-push"
printf '#!/usr/bin/env sh\nSKIP_SIMPLE_GIT_HOOKS=1\nnpx lint-staged\n' > "$T/.husky/pre-commit"
chmod +x "$T/.husky/pre-commit"

# ARM (B-pre): shields-up must FAIL on the clobbered layout (marker gate + missing pre-push).
if AIF_PROJECT_ROOT="$T" bash "$SHIELDS" >/dev/null 2>&1; then
  bad "(B-pre) shields-up PASSED on a clobbered layout (pre-push gone, pre-commit lacks @aif-shield) — false green"
else
  ok "(B-pre) shields-up FAILS on the clobbered layout (missing pre-push / no @aif-shield marker)"
fi

# ── ARM (A): re-assert ────────────────────────────────────────────────────────
_out=$(reassert_husky_shields "$REPO_ROOT" "$T" 2>&1)
[ -f "$T/.husky/pre-push" ] && ok "(A) pre-push restored after re-assert" || bad "(A) pre-push NOT restored"
if grep -q '@aif-shield' "$T/.husky/pre-commit" 2>/dev/null; then
  ok "(A) pre-commit restored to the framework hook (@aif-shield marker present)"
else
  bad "(A) pre-commit still the competing hook (no @aif-shield marker)"
fi
[ "$(git -C "$T" config core.hooksPath)" = ".husky" ] && ok "(A) core.hooksPath re-pinned to .husky" || bad "(A) core.hooksPath not .husky"
echo "$_out" | grep -q 'simple-git-hooks' && ok "(A) WARN names the competing manager (simple-git-hooks)" || bad "(A) WARN did not name the competing manager"

# ── ARM (B-post): shields-up PASSES after re-assert ──────────────────────────
if AIF_PROJECT_ROOT="$T" bash "$SHIELDS" >/dev/null 2>&1; then
  ok "(B-post) shields-up PASSES after re-assert (framework shields restored)"
else
  bad "(B-post) shields-up still FAILS after re-assert — restore incomplete"
fi

# ── ARM (C): idempotency — a second call re-asserts nothing (no WARN) ─────────
_out2=$(reassert_husky_shields "$REPO_ROOT" "$T" 2>&1)
if echo "$_out2" | grep -q 're-asserted'; then
  bad "(C) second re-assert WARNed despite hooks already matching templates — not idempotent"
else
  ok "(C) idempotent: hooks already match templates → no re-assert, no WARN"
fi

rm -rf "$T"
echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
