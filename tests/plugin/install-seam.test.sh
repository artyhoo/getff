#!/usr/bin/env bash
# S5 acceptance — the /install-enforcement hybrid seam (Option C: fetch the official installer).
# spec: docs/superpowers/specs/2026-06-22-cc-plugin-packaging-design.md §6
#
# Proves plugin/install/fetch-and-wire.sh against a LOCAL installer source (offline, deterministic
# — RAT_INSTALL_SOURCE points at the repo root, used in place; no network clone in CI):
#   (1) dry-run (default) exits 0, previews a plan, and writes NOTHING to the consumer
#   (2) --apply wires the HARD layer — creates .husky/pre-commit + .husky/pre-push in the consumer
#   (3) an unknown flag is rejected (exit 2)
#   (4) the command + skill artifacts exist and reference the seam
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
SEAM="$REPO_ROOT/plugin/install/fetch-and-wire.sh"
PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); echo "  ✓ $1"; }
bad(){ FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# Fresh throwaway consumer repo (git + package.json — install.sh wires git hooks).
mk_consumer() {
  local d; d=$(mktemp -d "${TMPDIR:-/tmp}/rat-seam-consumer.XXXXXX")
  ( cd "$d" && git init -q && git config user.email t@t && git config user.name t )
  printf '{"name":"tw","version":"0.0.0"}' > "$d/package.json"
  printf '%s' "$d"
}

# (1) dry-run: exits 0, previews, writes nothing -----------------------------
C1=$(mk_consumer)
OUT=$(CLAUDE_PROJECT_DIR="$C1" RAT_INSTALL_SOURCE="$REPO_ROOT" bash "$SEAM" ts-server </dev/null 2>&1); rc=$?
[ "$rc" -eq 0 ] && ok "dry-run exits 0" || bad "dry-run exit=$rc"
# `grep -c`, not `grep -q`: under pipefail an early-exit grep SIGPIPEs the writer into
# rc=141 and the `&&` reads the match as a failure — the canonical corpus pushed the
# preview past the pipe buffer (the getff-dist-canonical-links grep-consumption idiom).
printf '%s' "$OUT" | grep -ciE 'dry-run|preview' >/dev/null && ok "dry-run prints a preview" || bad "dry-run printed no preview"
[ ! -e "$C1/.husky" ] && ok "dry-run wrote nothing (.husky absent)" || bad "dry-run created .husky (should be a no-write preview)"

# (2) --apply: wires the hard layer ------------------------------------------
C2=$(mk_consumer)
A_OUT=$(CLAUDE_PROJECT_DIR="$C2" RAT_INSTALL_SOURCE="$REPO_ROOT" bash "$SEAM" ts-server --apply </dev/null 2>&1); rc=$?
[ "$rc" -eq 0 ] && ok "--apply exits 0" || bad "--apply exit=$rc (output: $(printf '%s' "$A_OUT" | tail -3))"
[ -f "$C2/.husky/pre-commit" ] && ok "--apply created .husky/pre-commit" || bad "--apply did not create .husky/pre-commit"
[ -f "$C2/.husky/pre-push" ] && ok "--apply created .husky/pre-push" || bad "--apply did not create .husky/pre-push"

# (3) unknown flag rejected ---------------------------------------------------
CLAUDE_PROJECT_DIR="$C1" RAT_INSTALL_SOURCE="$REPO_ROOT" bash "$SEAM" --bogus </dev/null >/dev/null 2>&1
[ "$?" -eq 2 ] && ok "unknown flag exits 2" || bad "unknown flag not rejected with exit 2"

# (4) command + skill artifacts exist and reference the seam ------------------
CMD="$REPO_ROOT/plugin/commands/install-enforcement.md"
SK="$REPO_ROOT/plugin/skills/installing-enforcement/SKILL.md"
[ -f "$CMD" ] && grep -q 'fetch-and-wire' "$CMD" && ok "command references the seam helper" || bad "command missing or does not reference fetch-and-wire"
[ -f "$SK" ] && grep -qiE 'hard|enforcement' "$SK" && ok "installing-enforcement skill present" || bad "installing-enforcement skill missing/empty"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
