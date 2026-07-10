#!/usr/bin/env bash
# cic-s3 #483 — one-button completeness: install.sh now RUNS the dev-dep install it used to only
# DECLARE (T-CIC-C "declare≠install"). The bug: the scripts-merge declared the toolchain + the
# Next-steps handed back a manual `npm install`, so the wired hooks (core.hooksPath=.husky →
# .husky/pre-commit runs `npx lint-staged`) fired with their tools ABSENT → ENOENT on the
# consumer's first commit (#478 root, #483). The fix: detect the PM (detect_pm SSOT) and actually
# install, OPT-IN via [y/N] default-No or --full.
#
# NO REAL INSTALL / NO NETWORK: a FAKE package manager on PATH records its argv and simulates the
# install by dropping node_modules/.bin/{lint-staged,husky} stubs (same "fake the .bin" tactic as
# f14-lintstaged-resolves.test.sh). Asserting "the PM was invoked with the dep list" is what proves
# RUN-not-just-declare — exactly the T-CIC-C distinction.
#
# PAIRED-NEGATIVES:
#   - Arm B: no --full + non-interactive stdin → PM is NOT invoked and node_modules/.bin/lint-staged
#     stays ABSENT (the dead/declared-only state) → gate works AND declare≠install is real.
#   - Arm D: a FLAT pnpm consumer → `pnpm add -D` is emitted WITHOUT the workspace `-w` flag
#     (Arm C's monorepo arm proves -w IS added) → the -w branch is non-vacuous.
#
# P0.2 (ultrareview): CORE_DEVDEPS omitted typescript/@types/node (INSTALL.md declares both
# required) and the installer never installed zod despite INSTALL.md documenting it as a required
# RUNTIME dep — 3/6 validate gates went red on a clean --full flat-npm install (tsc had no Node
# globals, typescript free-floated to an unvalidated major, arch:check flagged zod as undeclared).
#   - Arm A (extended): the devDep install line now also carries typescript@^5.7.0 +
#     @types/node@^22.10.0, and a SEPARATE runtime-dep install line carries zod@^3.24.0 WITHOUT
#     -D/--save-dev (paired-negative: runtime deps must not land as devDependencies).
#   - Arm E: react-native --full → typescript appears EXACTLY ONCE in the devDep install line (the
#     old REACT_NATIVE_DEVDEPS bare `typescript` entry must not duplicate CORE_DEVDEPS' pinned one).
#   - Parity check: INSTALL.md's §4 pins and setup.d/70-deps.sh's arrays are grepped independently
#     (two-sided) so neither can drift alone.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# ── fake PM: $FAKEBIN/{npm,pnpm} record argv to $AIF_PM_LOG and, on install/add, drop bin stubs
#    into the cwd's node_modules/.bin (install.sh cd's to PROJECT_ROOT before invoking the PM).
#    node / npx / git are NOT shadowed (only npm + pnpm live here) so the real hook chain runs. ──
FAKEBIN=$(mktemp -d)
make_fake_pm() {  # $1=name
  cat > "$FAKEBIN/$1" <<'PM'
#!/bin/sh
printf '%s\n' "$*" >> "$AIF_PM_LOG"
case "$1" in
  install|add)
    mkdir -p "$PWD/node_modules/.bin"
    for b in lint-staged husky sort-package-json; do
      printf '#!/bin/sh\nexit 0\n' > "$PWD/node_modules/.bin/$b"
      chmod +x "$PWD/node_modules/.bin/$b"
    done ;;
esac
exit 0
PM
  chmod +x "$FAKEBIN/$1"
}
make_fake_pm npm
make_fake_pm pnpm
export PATH="$FAKEBIN:$PATH"

run_install() {  # $1=dir  ; rest=args ; stdin from /dev/null unless caller pipes
  local d="$1"; shift
  ( cd "$d" && bash "$REPO_ROOT/install.sh" "$@" ) >/dev/null 2>&1
}

# ════ Arm A — flat consumer, --full → npm install RUNS; hooks get tools; commit SUCCEEDS ════
A=$(mktemp -d); export AIF_PM_LOG="$A.log"; : > "$AIF_PM_LOG"
printf '{ "name":"a","version":"0.0.0" }\n' > "$A/package.json"
( cd "$A" && git init -q && git config user.email t@t && git config user.name t )
run_install "$A" ts-server --force --full < /dev/null

grep -q -- '--save-dev' "$AIF_PM_LOG" \
  && ok "A: --full → fake npm invoked with 'install --save-dev …' (RUN, not just declared)" \
  || bad "A: PM not invoked with --save-dev (still declare-only — #483 not fixed)"
grep -q 'lint-staged' "$AIF_PM_LOG" \
  && ok "A: the declared hook tool (lint-staged) is in the install arg list" \
  || bad "A: lint-staged absent from install args"
[ -x "$A/node_modules/.bin/lint-staged" ] \
  && ok "A: post-install node_modules/.bin/lint-staged present (tools landed)" \
  || bad "A: node_modules/.bin/lint-staged missing after --full install"
if ( cd "$A" && git add -A && git commit -q -m "smoke: first commit" ) >/dev/null 2>&1; then
  ok "A: first commit SUCCEEDS — pre-commit 'npx lint-staged' resolves (no ENOENT)"
else
  bad "A: first commit failed — wired hook could not find its tool"
fi

# P0.2: INSTALL.md-declared devDeps must actually be in the install argv (not just documented).
grep -q 'typescript@\^5\.7\.0' "$AIF_PM_LOG" \
  && ok "A: devDep install carries typescript@^5.7.0 (INSTALL.md pin)" \
  || bad "A: typescript@^5.7.0 absent from devDep install argv"
grep -q '@types/node@\^22\.10\.0' "$AIF_PM_LOG" \
  && ok "A: devDep install carries @types/node@^22.10.0 (INSTALL.md pin)" \
  || bad "A: @types/node@^22.10.0 absent from devDep install argv"

# P0.2: zod is a RUNTIME dep (INSTALL.md §4 "runtime dep that's used everywhere") — it must land via
# a SEPARATE install invocation WITHOUT -D/--save-dev, never folded into the devDep -D command.
_zod_line=$(grep 'zod@\^3\.24\.0' "$AIF_PM_LOG" || true)
if [ -z "$_zod_line" ]; then
  bad "A: zod@^3.24.0 absent from the install log entirely"
else
  ok "A: zod@^3.24.0 present in the install log"
  case "$_zod_line" in
    *--save-dev*|*' -D'*|*' -D '*)
      bad "A neg: zod install line carries -D/--save-dev — zod must be a runtime dep, not a devDep ($_zod_line)" ;;
    *)
      ok "A neg: zod install line carries NO -D/--save-dev (correctly a runtime dep)" ;;
  esac
fi

# ════ Arm B (paired-negative) — flat, NO --full, non-interactive → NO install (gate + declare≠install) ════
B=$(mktemp -d); export AIF_PM_LOG="$B.log"; : > "$AIF_PM_LOG"
printf '{ "name":"b","version":"0.0.0" }\n' > "$B/package.json"
( cd "$B" && git init -q )
run_install "$B" ts-server --force < /dev/null   # no --full, stdin not a tty → default No

[ ! -s "$AIF_PM_LOG" ] \
  && ok "B neg: no --full + non-interactive → PM NOT invoked (default-No gate holds)" \
  || bad "B neg: PM invoked without consent ($(tr '\n' ';' < "$AIF_PM_LOG"))"
[ ! -e "$B/node_modules/.bin/lint-staged" ] \
  && ok "B neg: node_modules/.bin/lint-staged ABSENT (the declared-only dead state)" \
  || bad "B neg: tools present without an install — fake leaked?"

# ════ Arm C — pnpm WORKSPACE, --full → 'pnpm add -D -w' (workspace-root flag) ════
C=$(mktemp -d); export AIF_PM_LOG="$C.log"; : > "$AIF_PM_LOG"
printf '{ "name":"c","version":"0.0.0" }\n' > "$C/package.json"
printf 'packages:\n  - "apps/*"\n' > "$C/pnpm-workspace.yaml"
( cd "$C" && git init -q )
run_install "$C" ts-server --force --full < /dev/null

grep -Eq 'add .*-D' "$AIF_PM_LOG" \
  && ok "C: pnpm consumer → 'pnpm add -D …' invoked" \
  || bad "C: pnpm add not invoked ($(tr '\n' ';' < "$AIF_PM_LOG"))"
grep -q -- '-w' "$AIF_PM_LOG" \
  && ok "C: workspace present → -w (workspace-root) flag passed (avoids pnpm's add-to-root refusal)" \
  || bad "C: -w flag missing on a workspace install"
# GH #533: a workspace `pnpm add -D -w` is followed by a full `pnpm install` to complete the link
# graph on a cold clone (where `add -w` can leave sibling packages unlinked, breaking typecheck).
grep -qx 'install' "$AIF_PM_LOG" \
  && ok "C: workspace → bare 'pnpm install' follow-up invoked (completes cold-clone link graph)" \
  || bad "C: no 'pnpm install' after 'add -D -w' — cold-clone workspace stays partially linked (#533)"

# ════ Arm D (paired-negative for -w) — FLAT pnpm → 'pnpm add -D' WITHOUT -w ════
D=$(mktemp -d); export AIF_PM_LOG="$D.log"; : > "$AIF_PM_LOG"
printf '{ "name":"d","version":"0.0.0" }\n' > "$D/package.json"
printf '' > "$D/pnpm-lock.yaml"     # flat pnpm marker, NO pnpm-workspace.yaml
( cd "$D" && git init -q )
run_install "$D" ts-server --force --full < /dev/null

grep -Eq 'add .*-D' "$AIF_PM_LOG" \
  && ok "D: flat pnpm consumer → 'pnpm add -D …' invoked" \
  || bad "D: pnpm add not invoked on flat pnpm ($(tr '\n' ';' < "$AIF_PM_LOG"))"
if grep -q -- '-w' "$AIF_PM_LOG"; then
  bad "D neg: -w passed on a FLAT pnpm consumer (no workspace) → -w branch is vacuous"
else
  ok "D neg: flat pnpm → NO -w flag (the -w branch keys on the workspace marker, non-vacuous)"
fi
# GH #533 paired-negative: the `pnpm install` link-completion follow-up is WORKSPACE-only — a flat
# pnpm consumer gets `pnpm add -D` alone (no separate bare install), proving the follow-up is scoped.
if grep -qx 'install' "$AIF_PM_LOG"; then
  bad "D neg: bare 'pnpm install' fired on a FLAT pnpm consumer → #533 follow-up not workspace-scoped"
else
  ok "D neg: flat pnpm → NO bare 'pnpm install' follow-up (link-completion is workspace-scoped)"
fi

# ════ Arm E (P0.2) — react-native --full → NO duplicate/conflicting typescript spec ════
# GH #779 gave REACT_NATIVE_DEVDEPS a bare `typescript` entry because CORE_DEVDEPS pinned none;
# now that CORE_DEVDEPS pins typescript@^5.7.0 (INSTALL.md parity), a leftover RN-local bare entry
# would put TWO `typescript` specs in the SAME devDep install command for the react-native stack.
E=$(mktemp -d); export AIF_PM_LOG="$E.log"; : > "$AIF_PM_LOG"
printf '{ "name":"e","version":"0.0.0" }\n' > "$E/package.json"
( cd "$E" && git init -q && git config user.email t@t && git config user.name t )
run_install "$E" react-native --force --full < /dev/null

_rn_devdep_line=$(sed -n '1p' "$AIF_PM_LOG")
_rn_ts_tokens=$(printf '%s\n' "$_rn_devdep_line" | tr ' ' '\n' | grep -cE '^typescript(@.*)?$' || true)
if [ "$_rn_ts_tokens" -eq 1 ]; then
  ok "E: react-native devDep install carries exactly ONE typescript spec (deduped)"
else
  bad "E: react-native devDep install carries $_rn_ts_tokens typescript spec(s) (want 1) — line: $_rn_devdep_line"
fi
grep -q 'typescript@\^5\.7\.0' <<< "$_rn_devdep_line" \
  && ok "E: the surviving react-native typescript spec is the pinned typescript@^5.7.0 (not the old bare entry)" \
  || bad "E: react-native devDep line missing the pinned typescript@^5.7.0"

# ════ Parity check (P0.2) — INSTALL.md §4 pins vs setup.d/70-deps.sh arrays (two-sided) ════
# Cheap, deterministic, no install.sh execution: neither side can drift without failing this.
for _pkg_spec in 'typescript@\^5\.7\.0' '@types/node@\^22\.10\.0' 'zod@\^3\.24\.0'; do
  _in_docs=""; _in_installer=""
  grep -q "$_pkg_spec" "$REPO_ROOT/INSTALL.md" && _in_docs="yes"
  grep -q "$_pkg_spec" "$REPO_ROOT/setup.d/70-deps.sh" && _in_installer="yes"
  if [ -n "$_in_docs" ] && [ -n "$_in_installer" ]; then
    ok "parity: $_pkg_spec declared in BOTH INSTALL.md and setup.d/70-deps.sh"
  else
    bad "parity: $_pkg_spec — INSTALL.md=${_in_docs:-NO} setup.d/70-deps.sh=${_in_installer:-NO} (drifted)"
  fi
done

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
