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
#
# #two-prompts-drift (printed manual fallback vs automated install):
#   - Arm F: react-native + npm, NO --full → the Next-steps manual commands (devDep AND runtime)
#     carry --legacy-peer-deps, mirroring the §8 npm arms' $NPM_PEER_FLAG (the a11y-peer ERESOLVE
#     workaround) — a consumer who declined the automated install and copy-pastes must not hit
#     the very ERESOLVE abort the automated path avoids.
#   - Arm G (paired-negative): ts-server + npm, NO --full → NEITHER printed npm command carries
#     --legacy-peer-deps (the flag is react-native-scoped, not blanket).
#
# npx-float (2026-07-10, same failure class as P0.2's typescript@7.0.2): the shipped react-next CI
# template (packages/preset-next-15-canonical/templates/github-actions-ci-ui.yml, test-storybook
# job) runs `npx concurrently` / `npx http-server` / `npx wait-on`. When the package is absent from
# the consumer's node_modules, non-TTY npx silently fetches <pkg>@latest from the registry on EVERY
# consumer CI run — zero lockfile coverage, floats with upstream majors.
#   - Arm H: react-next --full → the template npx tools + storybook toolchain land PINNED in the
#     devDep argv (REACT_DEVDEPS is the canonical pin source; INSTALL.md mirrors it — two-way
#     parity below; node-20 compatible — concurrently@10 needs node >=22, .nvmrc is 20.19.0).
#   - Arm I: static sweep — every `npx <tool>` in EVERY shipped CI workflow template maps to a
#     package present in that stack's DEVDEPS arrays (bin→pkg: playwright→@playwright/test,
#     stryker→@stryker-mutator/core). Paired-negative: a synthetic template with an uncovered
#     tool IS flagged (the checker is non-vacuous).
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

# ════ Arm F (#two-prompts-drift) — react-native + npm, NO --full → printed fallback carries --legacy-peer-deps ════
# The automated §8 npm arms (setup.d/70-deps.sh devDep + runtime installs) pass $NPM_PEER_FLAG
# (--legacy-peer-deps) for react-native because eslint-plugin-react-native-a11y peer-deps
# eslint ^3..^8 while the preset ships eslint ^9 → npm 7+ ERESOLVE hard-fail. The Next-steps
# manual fallback (setup.d/99-finalize.sh) is built from the same DEVDEPS/RUNTIME_DEPS arrays but
# used to drop the flag — an RN consumer who declined the automated install and copy-pasted the
# printed command got the exact ERESOLVE abort the automated path avoids. Both printed npm lines
# (devDep + runtime) must carry the flag.
F=$(mktemp -d); export AIF_PM_LOG="$F.log"; : > "$AIF_PM_LOG"
printf '{ "name":"f","version":"0.0.0" }\n' > "$F/package.json"
( cd "$F" && git init -q )
F_OUT=$( cd "$F" && bash "$REPO_ROOT/install.sh" react-native --force < /dev/null 2>&1 )

_f_dev_line=$(printf '%s\n' "$F_OUT" | grep -E '^ *npm install --save-dev' || true)
_f_rt_line=$(printf '%s\n' "$F_OUT" | grep -E '^ *npm install' | grep -v -- '--save-dev' || true)
[ -n "$_f_dev_line" ] \
  && ok "F: no --full → Next-steps prints the manual 'npm install --save-dev' fallback" \
  || bad "F: printed devDep fallback command missing from install output"
case "$_f_dev_line" in
  *--legacy-peer-deps*) ok "F: printed RN devDep command carries --legacy-peer-deps (mirrors §8 npm arm)" ;;
  *) bad "F: printed RN devDep command LACKS --legacy-peer-deps → copy-paste ERESOLVE abort ($_f_dev_line)" ;;
esac
case "$_f_rt_line" in
  *--legacy-peer-deps*) ok "F: printed RN runtime-dep command carries --legacy-peer-deps (mirrors §8 npm arm)" ;;
  *) bad "F: printed RN runtime-dep command LACKS --legacy-peer-deps ($_f_rt_line)" ;;
esac

# ════ Arm G (paired-negative for F) — ts-server + npm, NO --full → NO --legacy-peer-deps ════
# Proves the printed flag is react-native-scoped: every other stack keeps strict peer resolution,
# so a blanket flag (weakening peer checks for everyone) would be its own defect.
G=$(mktemp -d); export AIF_PM_LOG="$G.log"; : > "$AIF_PM_LOG"
printf '{ "name":"g","version":"0.0.0" }\n' > "$G/package.json"
( cd "$G" && git init -q )
G_OUT=$( cd "$G" && bash "$REPO_ROOT/install.sh" ts-server --force < /dev/null 2>&1 )

_g_npm_lines=$(printf '%s\n' "$G_OUT" | grep -E '^ *npm install' || true)
[ -n "$_g_npm_lines" ] \
  && ok "G: ts-server no --full → Next-steps prints the manual npm fallback" \
  || bad "G: printed npm fallback commands missing from ts-server install output"
case "$_g_npm_lines" in
  *--legacy-peer-deps*) bad "G neg: ts-server printed command carries --legacy-peer-deps (flag not RN-scoped): $_g_npm_lines" ;;
  *) ok "G neg: ts-server printed commands carry NO --legacy-peer-deps (flag is RN-scoped)" ;;
esac

# ════ Arm H (npx-float) — react-next --full → storybook-CI npx toolchain lands as devDeps ════
# The shipped react-next CI template runs `npx concurrently/http-server/wait-on`; without these in
# the devDep install, non-TTY npx registry-fetches @latest on every consumer CI run (no lockfile
# coverage — the P0.2 typescript@7.0.2 failure class on a new surface).
H=$(mktemp -d); export AIF_PM_LOG="$H.log"; : > "$AIF_PM_LOG"
printf '{ "name":"h","version":"0.0.0" }\n' > "$H/package.json"
( cd "$H" && git init -q && git config user.email t@t && git config user.name t )
run_install "$H" react-next --force --full < /dev/null

for _spec in 'concurrently@\^9\.0\.0' 'http-server@\^14\.1\.0' 'wait-on@\^8\.0\.0' \
             'storybook@\^10\.5\.0' '@storybook/nextjs-vite@\^10\.5\.0' '@storybook/test-runner@\^0\.24\.4' \
             'vite@\^8\.0\.0'; do
  grep -q "$_spec" "$AIF_PM_LOG" \
    && ok "H: react-next devDep install carries $_spec (template npx tool covered)" \
    || bad "H: $_spec absent from react-next devDep argv — template npx registry-fetches @latest"
done

# INSTALL.md §4 declares @testing-library/user-event for React stacks (INSTALL.md parity class,
# same as P0.2) — the install must actually deliver it (unpinned, like its @testing-library
# siblings; loud-fail class: a missing module breaks the consumer's interaction tests at import).
grep -q '@testing-library/user-event' "$AIF_PM_LOG" \
  && ok "H: react-next devDep install carries @testing-library/user-event (INSTALL.md §4 parity)" \
  || bad "H: @testing-library/user-event absent from react-next devDep argv — INSTALL.md declares it"

# ════ Arm I (npx-float) — every `npx <tool>` in a shipped CI workflow template is covered by ════
# the DEVDEPS arrays the installer delivers for that stack. Static grep, no install.sh execution.
# Extraction is a per-line heuristic (second token after `npx`, including inside quoted
# concurrently sub-commands); the arrays contain no comments inside the parens, so array-block
# membership means the installer actually delivers the package.
extract_array() { sed -n "/^$1=(/,/^)/p" "$REPO_ROOT/setup.d/70-deps.sh"; }
map_bin_to_pkg() {
  case "$1" in
    playwright) echo "@playwright/test" ;;      # @playwright/test ships the `playwright` bin
    stryker)    echo "@stryker-mutator/core" ;; # @stryker-mutator/core ships the `stryker` bin
    *)          echo "$1" ;;
  esac
}
check_template_npx() {  # $1=template  $2..=array names → echoes space-separated uncovered pkgs
  local _tpl="$1"; shift
  local _allowed="" _a
  for _a in "$@"; do _allowed="$_allowed
$(extract_array "$_a")"; done
  local _bins _bin _pkg _missing=""
  # Flag-prefixed shapes (`npx -y <tool>`, `npx --no-install <tool>`) are skipped over so the
  # package token is always the LAST field of the -o match.
  _bins=$(grep -oE 'npx +(--?[a-zA-Z-]+ +)*[@a-zA-Z][@a-zA-Z0-9/_.-]*' "$_tpl" | awk '{print $NF}' | sort -u)
  for _bin in $_bins; do
    _pkg=$(map_bin_to_pkg "$_bin")
    printf '%s\n' "$_allowed" | grep -qE "(^|[[:space:](])${_pkg}(@|[[:space:])]|$)" \
      || _missing="$_missing $_pkg"
  done
  echo "$_missing"
}

while IFS='|' read -r _tpl _arrays; do
  _missing=$(check_template_npx "$REPO_ROOT/$_tpl" $_arrays)
  if [ -z "${_missing// /}" ]; then
    ok "I: $_tpl — every npx tool covered by [$_arrays]"
  else
    bad "I: $_tpl — npx tool(s) NOT delivered by installer devDeps:$_missing (registry-fetch @latest at consumer CI run)"
  fi
done <<'TPLS'
packages/preset-next-15-canonical/templates/github-actions-ci-ui.yml|CORE_DEVDEPS REACT_DEVDEPS
packages/preset-react-spa/templates/github-actions-ci-ui.yml|CORE_DEVDEPS REACT_SPA_DEVDEPS
packages/preset-react-native/templates/github-actions-ci-ui.yml|CORE_DEVDEPS REACT_NATIVE_DEVDEPS
templates/ts-server/github-actions-ci.yml|CORE_DEVDEPS
templates/ts-server/github-actions-workflow-integrity.yml|CORE_DEVDEPS
TPLS

# I paired-negative: a template invoking a tool NO array delivers must be flagged (non-vacuous).
# Second shape: flag-prefixed `npx -y <tool>` / `npx --no-install <tool>` (both live in this repo:
# setup.d/99-finalize.sh) must not slip past the extractor.
_I_NEG=$(mktemp)
printf '      - run: npx left-pad-enterprise --port 1\n      - run: npx -y flag-prefixed-tool\n' > "$_I_NEG"
_neg_missing=$(check_template_npx "$_I_NEG" CORE_DEVDEPS)
case "$_neg_missing" in
  *left-pad-enterprise*)
    ok "I neg: uncovered npx tool in a synthetic template IS flagged (checker non-vacuous)" ;;
  *)
    bad "I neg: synthetic uncovered npx tool NOT flagged — the I sweep is vacuous" ;;
esac
case "$_neg_missing" in
  *flag-prefixed-tool*)
    ok "I neg: flag-prefixed \`npx -y <tool>\` shape IS extracted and flagged" ;;
  *)
    bad "I neg: \`npx -y <tool>\` slips past the extractor — flag-prefixed invocations unswept" ;;
esac

# ════ Parity check (P0.2) — INSTALL.md §4 pins vs setup.d/70-deps.sh arrays (two-sided) ════
# Cheap, deterministic, no install.sh execution: neither side can drift without failing this.
# npx-float: the three react-next storybook-CI npx tools joined the list 2026-07-10.
for _pkg_spec in 'typescript@\^5\.7\.0' '@types/node@\^22\.10\.0' 'zod@\^3\.24\.0' \
                 'concurrently@\^9\.0\.0' 'http-server@\^14\.1\.0' 'wait-on@\^8\.0\.0' \
                 'storybook@\^10\.5\.0' '@storybook/nextjs-vite@\^10\.5\.0' '@storybook/test-runner@\^0\.24\.4' \
                 'vite@\^8\.0\.0'; do
  _in_docs=""; _in_installer=""
  grep -q "$_pkg_spec" "$REPO_ROOT/INSTALL.md" && _in_docs="yes"
  grep -q "$_pkg_spec" "$REPO_ROOT/setup.d/70-deps.sh" && _in_installer="yes"
  if [ -n "$_in_docs" ] && [ -n "$_in_installer" ]; then
    ok "parity: $_pkg_spec declared in BOTH INSTALL.md and setup.d/70-deps.sh"
  else
    bad "parity: $_pkg_spec — INSTALL.md=${_in_docs:-NO} setup.d/70-deps.sh=${_in_installer:-NO} (drifted)"
  fi
done

# ════ No third pin copy (npx-float follow-up) — storybook-package-additions.json stays retired ════
# The former sibling template (merged by retired setup.sh Batch K, #946) duplicated these pins —
# and pinned @storybook/addon-essentials@^10.3.3, a version that does not exist (the addon died
# at 8.x, merged into SB core). REACT_DEVDEPS + INSTALL.md (two-way parity above) are now the
# only pin copies. If the JSON reappears, a third drifting copy is back (#two-prompts-drift).
_SB_JSON="$REPO_ROOT/packages/core/templates/react-next/storybook-package-additions.json"
if [ ! -f "$_SB_JSON" ]; then
  ok "parity3: storybook-package-additions.json stays retired (no third pin copy)"
else
  bad "parity3: storybook-package-additions.json resurrected — third pin copy will drift; fold pins into REACT_DEVDEPS instead"
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
