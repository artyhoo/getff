#!/usr/bin/env bash
# critical-review S4-3 — install used to run `git config core.hooksPath .husky` unconditionally.
# A consumer's own hooksPath (.githooks, lefthook, …) or live hooks in .git/hooks silently stopped
# firing; from a subdirectory of the repo NO hook fired at all (a relative hooksPath resolves
# against the toplevel, where .husky does not exist). Now the install keeps a foreign hook setup,
# records it as not wired with the reason — and, since the operator directive of 2026-09-28 (Q4.7),
# prints no command to wire the framework hooks by hand.
#
# ARMS:
#   (A) husky_hookspath_blocker: foreign hooksPath → blocked; .husky / .husky/_ / unset → free
#   (B) live hook in .git/hooks (hooksPath unset) → blocked; *.sample only → free
#   (C) install root below the git toplevel → blocked
#   (D) end-to-end: install.sh on a repo with core.hooksPath=.githooks keeps it and says so
#   (E) paired negative: a fresh repo still gets core.hooksPath=.husky
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# shellcheck disable=SC1090
INSTALL_SH_LIB_ONLY=1 source "$REPO_ROOT/setup.d/lib.sh"
if ! command -v husky_hookspath_blocker >/dev/null 2>&1; then
  bad "husky_hookspath_blocker not exported from lib.sh"
  echo ""; echo "PASS=$PASS FAIL=$FAIL"; exit 1
fi

newrepo() { local d; d=$(mktemp -d); git -C "$d" init -q; printf '%s\n' "$d"; }

# ── (A) hooksPath values ──
R=$(newrepo)
[ -z "$(husky_hookspath_blocker "$R")" ] && ok "(A) unset hooksPath, empty .git/hooks → free" || bad "(A) unset hooksPath reported blocked"
git -C "$R" config core.hooksPath .githooks
_r=$(husky_hookspath_blocker "$R")
case "$_r" in *.githooks*) ok "(A) foreign hooksPath .githooks → blocked, reason names it" ;; *) bad "(A) foreign hooksPath not blocked (got: '$_r')" ;; esac
git -C "$R" config core.hooksPath .husky
[ -z "$(husky_hookspath_blocker "$R")" ] && ok "(A) hooksPath=.husky → free (our own)" || bad "(A) hooksPath=.husky reported blocked"
git -C "$R" config core.hooksPath .husky/_
[ -z "$(husky_hookspath_blocker "$R")" ] && ok "(A) hooksPath=.husky/_ (husky v9) → free" || bad "(A) hooksPath=.husky/_ reported blocked"
rm -rf "$R"

# ── (B) live hooks in .git/hooks ──
R=$(newrepo)
printf '#!/bin/sh\nexit 0\n' > "$R/.git/hooks/pre-commit.sample"; chmod +x "$R/.git/hooks/pre-commit.sample"
[ -z "$(husky_hookspath_blocker "$R")" ] && ok "(B) only *.sample hooks → free" || bad "(B) *.sample hooks reported as live"
printf '#!/bin/sh\nexit 1\n' > "$R/.git/hooks/pre-commit"; chmod +x "$R/.git/hooks/pre-commit"
_r=$(husky_hookspath_blocker "$R")
case "$_r" in *pre-commit*) ok "(B) live .git/hooks/pre-commit → blocked, reason names it" ;; *) bad "(B) live .git/hooks hook not blocked (got: '$_r')" ;; esac
rm -rf "$R"

# ── (C) install root below the toplevel ──
R=$(newrepo); mkdir -p "$R/web"
_r=$(husky_hookspath_blocker "$R/web")
case "$_r" in *toplevel*) ok "(C) install root below the git toplevel → blocked" ;; *) bad "(C) subdirectory install not blocked (got: '$_r')" ;; esac
rm -rf "$R"

# ── (D) end-to-end ──
T=$(newrepo)
printf '{ "name":"t","version":"0.0.0" }\n' > "$T/package.json"
git -C "$T" config core.hooksPath .githooks
_out=$( cd "$T" && bash "$REPO_ROOT/install.sh" ts-server 2>&1 )
[ "$(git -C "$T" config core.hooksPath)" = ".githooks" ] && ok "(D) install kept the consumer's core.hooksPath=.githooks" || bad "(D) install repointed core.hooksPath to $(git -C "$T" config core.hooksPath)"
grep -q 'git config core.hooksPath' <<<"$_out" && bad "(D) install still prints a git config command to run by hand" || ok "(D) no manual wiring command in install output"
grep -q '\.githooks' <<<"$(echo "$_out" | grep -E '^[[:space:]]*- framework git hooks')" \
  && ok "(D) the NOT-wired line names the kept core.hooksPath=.githooks" || bad "(D) no NOT-wired git hooks line naming .githooks"
rm -rf "$T"

# ── (E) paired negative ──
T=$(newrepo)
printf '{ "name":"t","version":"0.0.0" }\n' > "$T/package.json"
( cd "$T" && bash "$REPO_ROOT/install.sh" ts-server ) >/dev/null 2>&1
[ "$(git -C "$T" config core.hooksPath)" = ".husky" ] && ok "(E) fresh repo still gets core.hooksPath=.husky" || bad "(E) fresh repo lost hook activation"
rm -rf "$T"

# ── (F) subdirectory install: the NOT-wired line names the subdirectory's web/.husky/ and the
#    toplevel reason. It used to print `git config core.hooksPath web/.husky` (a bare `.husky`
#    resolves against the toplevel, where .husky does not exist — critical-review cold pass); since
#    Q4.7 no command is printed at all ──
T=$(newrepo); mkdir -p "$T/web"
printf '{ "name":"t","version":"0.0.0" }\n' > "$T/web/package.json"
_out=$( cd "$T/web" && bash "$REPO_ROOT/install.sh" ts-server 2>&1 )
grep -q 'toplevel' <<<"$(echo "$_out" | grep -E '^[[:space:]]*- framework git hooks' | grep 'web/\.husky/')" \
  && ok "(F) the NOT-wired line names web/.husky/ and the toplevel reason" || bad "(F) no NOT-wired line naming web/.husky/ and the toplevel"
grep -q 'git config core.hooksPath' <<<"$_out" && bad "(F) subdirectory install still prints a git config command" || ok "(F) no git config command for a subdirectory install"
[ -z "$(git -C "$T" config core.hooksPath)" ] && ok "(F) core.hooksPath left unset" || bad "(F) core.hooksPath was set to $(git -C "$T" config core.hooksPath)"
rm -rf "$T"

# ── (G) end-to-end through the post-deps re-assert: `--full` with a package manager stub that
#    SUCCEEDS (DEPS_INSTALLED=1, so 99-finalize runs reassert_husky_shields). Pins both halves the
#    unit arms cannot: 50-hooks really notes the consumer's own hook (S3-1), and the re-assert
#    really honours HUSKY_HOOKSPATH_OWNED=0 (S4-3) — reverting either wiring flips this arm ──
STUBBIN=$(mktemp -d)
printf '#!/bin/sh\nexit 0\n' > "$STUBBIN/npm"; cp "$STUBBIN/npm" "$STUBBIN/pnpm"; cp "$STUBBIN/npm" "$STUBBIN/yarn"
chmod +x "$STUBBIN/npm" "$STUBBIN/pnpm" "$STUBBIN/yarn"
T=$(newrepo)
printf '{ "name":"t","version":"0.0.0" }\n' > "$T/package.json"
git -C "$T" config core.hooksPath .githooks
mkdir -p "$T/.husky"; printf '#!/usr/bin/env sh\nnpm run typecheck\n' > "$T/.husky/pre-commit"; chmod +x "$T/.husky/pre-commit"
_out=$( cd "$T" && PATH="$STUBBIN:$PATH" bash "$REPO_ROOT/install.sh" ts-server --full < /dev/null 2>&1 )
grep -qi 'dependencies did NOT fully install' <<<"$_out" && bad "(G) precondition: deps reported incomplete — the re-assert branch was not reached" || ok "(G) precondition: deps reported installed (re-assert branch reached)"
grep -q 'npm run typecheck' "$T/.husky/pre-commit" && ok "(G) --full kept the consumer's own .husky/pre-commit" || bad "(G) --full overwrote the consumer's own .husky/pre-commit"
[ "$(git -C "$T" config core.hooksPath)" = ".githooks" ] && ok "(G) --full kept core.hooksPath=.githooks through the re-assert" || bad "(G) the post-deps re-assert repointed core.hooksPath to $(git -C "$T" config core.hooksPath)"
rm -rf "$T" "$STUBBIN"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
