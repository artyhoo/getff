#!/usr/bin/env bash
# setup.d/70-deps.sh — §7 package.json scripts merge + §8 dev-dep install (§8b tsx-at-root retired 2026-09-28).
#
# Sources: lib.sh (already in dispatcher scope)
# S0 rows: §7 (install.sh:1358-1440), §8 (install.sh:1442-1538), §8b (install.sh:1540-1595) cite:historical S0 inventory rows = pre-extraction install.sh line ranges
# Depends on: 60-ci (eslint.config.mjs, detect-r2-boundary, etc. already written)
# @cc-only-rationale: sourced by install.sh dispatcher, not standalone
# O9: §7 declare devDeps BEFORE §8 install (intra-layer order)
# O2: sets DEPS_INSTALLED + DEVDEPS globals (read by 99-finalize)
# §4d-2: keep the BARE single-quote test:integration --include verbatim — PARK[S2+]

# ─── 7. package.json scripts (FQA S1-A W4) ──────────────
# install.sh historically left scripts as a manual INSTALL.md §3 step, so consumers landed
# `scripts: {}` while AGENTS.md + the shipped ci.yml call `npm run lint/typecheck/arch:check/
# test:*` → every gate failed "Missing script". Inject the canonical block (non-destructive:
# only adds keys the consumer lacks). The referenced devDependencies (eslint, dependency-cruiser,
# stryker, vitest, prettier, husky) are NOT installed here — that is the consumer's
# `npm install` + residual R-2 (devDeps manifest). Scripts present ≠ runnable until deps land,
# but "Missing script" → "tool not installed" is the intended, INSTALL.md-documented path.
# ─── P2 G2 helpers: the project's own package versions win (operator log entry 28, fork 1 = A) ───
# Defined first so tests can load them alone (DEPS_LIB_ONLY=1, tests/install-sh/
# deps-keep-project-versions.test.sh). Measured on a create-vite project (2026-09-29): `npm install
# -D typescript@^5.7.0` rewrote the project's own ~6.0.2, and an ERESOLVE retried with
# --legacy-peer-deps installed a tree whose vitest could not load its config.

# deps_spec_name <spec> — the package name of an install spec (`@types/node@^22` → `@types/node`).
deps_spec_name() {
  local s="$1" rest
  case "$s" in
    @*) rest="${s#@}"
        case "$rest" in *@*) printf '%s\n' "@${rest%%@*}" ;; *) printf '%s\n' "$s" ;; esac ;;
    *@*) printf '%s\n' "${s%%@*}" ;;
    *)   printf '%s\n' "$s" ;;
  esac
}

# deps_declared_packages — «<name><TAB><spec>» for every package the project's package.json declares
# (dependencies, devDependencies, peerDependencies, optionalDependencies). Empty without node.
deps_declared_packages() {
  [ -f "$PROJECT_ROOT/package.json" ] || return 0
  command -v node >/dev/null 2>&1 || return 0
  AIF_PKG="$PROJECT_ROOT/package.json" node -e '
    const p = JSON.parse(require("fs").readFileSync(process.env.AIF_PKG, "utf8"));
    for (const f of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"])
      for (const [n, v] of Object.entries(p[f] || {})) console.log(n + "\t" + v);
  ' 2>/dev/null || true
}

# deps_drop_declared — remove from DEVDEPS / RUNTIME_DEPS every package the project already declares,
# printing «kept your <name> <spec>». Installing it would make npm rewrite the project's own spec.
# Reads DEPS_DECLARED_BEFORE when set: the layer snapshots it before §7 adds getff's own
# husky / lint-staged / sort-package-json entries, which are ours to install, not the project's.
deps_drop_declared() {
  local declared s n v
  local kept=()
  if [ -n "${DEPS_DECLARED_BEFORE+set}" ]; then declared="$DEPS_DECLARED_BEFORE"; else declared="$(deps_declared_packages)"; fi
  [ -n "$declared" ] || return 0
  for s in ${DEVDEPS[@]+"${DEVDEPS[@]}"}; do
    n="$(deps_spec_name "$s")"
    v="$(awk -F'\t' -v n="$n" '$1 == n { print $2; exit }' <<<"$declared")"
    if [ -n "$v" ]; then echo "  ✓ kept your $n $v (already in package.json; getff does not change it)"; else kept+=("$s"); fi
  done
  DEVDEPS=( ${kept[@]+"${kept[@]}"} )
  kept=()
  for s in ${RUNTIME_DEPS[@]+"${RUNTIME_DEPS[@]}"}; do
    n="$(deps_spec_name "$s")"
    v="$(awk -F'\t' -v n="$n" '$1 == n { print $2; exit }' <<<"$declared")"
    if [ -n "$v" ]; then echo "  ✓ kept your $n $v (already in package.json; getff does not change it)"; else kept+=("$s"); fi
  done
  RUNTIME_DEPS=( ${kept[@]+"${kept[@]}"} )
}

# _deps_npm_text <npm output file> — the output without npm's «npm error » / «npm ERR! » prefix.
_deps_npm_text() { sed -E 's/^npm (error|ERR!) ?//' "$1"; }

# _deps_eresolve_candidates <npm output file> — the package names in npm's «Could not resolve
# dependency:» block, requesters first: «… from <pkg>@<ver>» (1), «<pkg>@"…" from the root project»
# (2), then the peer they ask for (3) — dropping the requester keeps a peer the project may need.
_deps_eresolve_candidates() {
  _deps_npm_text "$1" | awk '
    /^Could not resolve dependency:/ { inb = 1; next }
    inb && NF == 0 { exit }
    inb {
      line = $0
      if (line ~ / from the root project$/) {
        t = line; sub(/^ +/, "", t); sub(/^(dev|prod|peer|optional|peerOptional) /, "", t)
        sub(/@"[^"]*" from the root project$/, "", t); print "2 " t
      } else if (match(line, / from [^ ]+$/)) {
        t = substr(line, RSTART + 6); sub(/@[^@]*$/, "", t); print "1 " t
        if (line ~ /^peer /) { p = line; sub(/^peer /, "", p); sub(/@"[^"]*".*$/, "", p); print "3 " p }
      }
    }' | sort -s -k1,1 | cut -d' ' -f2-
}

# deps_eresolve_culprit <npm output file> <spec>… — the first candidate that is one of OUR specs;
# empty when npm names none of them (then nothing of ours can be dropped to fix it).
deps_eresolve_culprit() {
  local log="$1" cand s; shift
  for cand in $(_deps_eresolve_candidates "$log"); do
    for s in "$@"; do
      if [ "$(deps_spec_name "$s")" = "$cand" ]; then printf '%s\n' "$cand"; return 0; fi
    done
  done
  return 0
}

# deps_eresolve_detail <npm output file> — npm's own words for the conflict: the «peer … from …»
# line and the version it found («found vite@6.4.3»).
deps_eresolve_detail() {
  local peer found
  peer="$(_deps_npm_text "$1" | awk '/^Could not resolve dependency:/ { inb = 1; next } inb && / from / && !/from the root project$/ { print; exit }')"
  found="$(_deps_npm_text "$1" | awk '/^Found: / { sub(/^Found: /, ""); print; exit }')"
  printf '%s%s\n' "${peer:-no conflict line}" "${found:+; found $found}"
}

# deps_npm_install_strict <--save-dev|--save> <spec>… — `npm install` with strict peer resolution.
# On ERESOLVE: drop the culprit of OURS (a NOT wired line quoting npm) and retry strict — at most 3
# drops. An ERESOLVE naming none of ours ends with «could not resolve, npm said: <npm's line>».
# --legacy-peer-deps stays only for arborist's TypeError crash (npm/cli#9787) and for stacks that
# set NPM_PEER_FLAG (react-native). Sets DEPS_NPM_SPECS (what finally installed) and
# DEPS_NPM_FAIL_REASON; returns 0 on success, 1 otherwise.
deps_npm_install_strict() {
  local save="$1" log rc drops=0 name what first s; shift
  local specs=( "$@" ) rest=()
  DEPS_NPM_SPECS=(); DEPS_NPM_FAIL_REASON=""
  what="dependency"; [ "$save" = "--save-dev" ] && what="dev dependency"
  log="$(mktemp)"
  while :; do
    if [ "${#specs[@]}" -eq 0 ]; then rm -f "$log"; return 0; fi
    # shellcheck disable=SC2086  # $NPM_PEER_FLAG is one flag or empty
    ( cd "$PROJECT_ROOT" && npm install "$save" "${specs[@]}" ${NPM_PEER_FLAG:-} ) 2>&1 | tee "$log"
    rc=${PIPESTATUS[0]}
    if [ "$rc" -eq 0 ]; then DEPS_NPM_SPECS=( "${specs[@]}" ); rm -f "$log"; return 0; fi
    if [ -n "${NPM_PEER_FLAG:-}" ]; then DEPS_NPM_FAIL_REASON="the npm install failed (its output is above)"; break; fi
    if grep -q 'ERESOLVE' "$log"; then
      first="$(_deps_npm_text "$log" | awk '/ERESOLVE/ && !/^code / { print; exit }')"
      [ -n "$first" ] || first="$(_deps_npm_text "$log" | awk 'NF { print; exit }')"
      if [ "$drops" -ge 3 ]; then
        DEPS_NPM_FAIL_REASON="npm still could not resolve after dropping 3 packages; npm said: $first"; break
      fi
      name="$(deps_eresolve_culprit "$log" "${specs[@]}")"
      if [ -z "$name" ]; then DEPS_NPM_FAIL_REASON="could not resolve, npm said: $first"; break; fi
      echo "  ⚠  npm cannot fit $name next to your packages — installing the rest without it (strict, no --legacy-peer-deps)."
      note_not_wired "$what $name — not installed: npm could not fit it next to your packages (npm: $(deps_eresolve_detail "$log"))"
      rest=()
      for s in "${specs[@]}"; do [ "$(deps_spec_name "$s")" = "$name" ] || rest+=("$s"); done
      specs=( ${rest[@]+"${rest[@]}"} )
      drops=$((drops + 1))
      continue
    fi
    if grep -Eq "Cannot read properties of null|TypeError" "$log"; then
      echo "  ⚠  npm's resolver crashed (not a version conflict, npm/cli#9787) — retrying with --legacy-peer-deps."
      if ( cd "$PROJECT_ROOT" && npm install "$save" "${specs[@]}" --legacy-peer-deps ); then
        DEPS_NPM_SPECS=( "${specs[@]}" ); rm -f "$log"; return 0
      fi
    fi
    DEPS_NPM_FAIL_REASON="the npm install failed (its output is above)"; break
  done
  rm -f "$log"; return 1
}

if [ -n "${DEPS_LIB_ONLY:-}" ]; then return 0 2>/dev/null || true; fi

# The project's own declarations, read BEFORE §7 below writes getff's entries into package.json.
DEPS_DECLARED_BEFORE="$(deps_declared_packages)"

# P2 G1: stack «generic» (no stack getff knows) gets the stack-free part only; this layer is
# npm-bound, so it is skipped and named in the NOT wired summary.
if [ "${STACK:-}" = "generic" ]; then
  note_not_wired "dependencies — not installed: getff has no dependency set for stack «generic»; your package files are left as they are"
  return 0 2>/dev/null || true
fi

# The merge lives in setup.d/lib.sh (merge_canonical_scripts): do_refresh runs it too (refresh sweep G5).
merge_canonical_scripts install

# ─── 8. dev-dependency install — one-button completeness (#483, DN-B=A) ──────
# The scripts-merge above only DECLARES the toolchain; the Next-steps block historically handed
# back a manual `npm install`. So the wired hooks (core.hooksPath=.husky → .husky/pre-commit runs
# `npx lint-staged`) fired with their tools ABSENT → ENOENT on the consumer's first commit (#478
# root, #483). Close it: detect the consumer's PM (detect_pm SSOT) and actually RUN the dev-dep
# install so the declared tools land before that first commit. Mutating + opinionated → OPT-IN:
# interactive [y/N] default-No, or --full to skip the prompt (non-interactive without --full → No).
# Shells out to the consumer's own PM — adds NO dependency to the framework (per §3 scope fence /
# BFR). DEVDEPS is the single source for both the install command and the Next-steps fallback echo
# (so "what we install" and "what we tell you to install" can't drift — #two-prompts-drift).
# P0.2 (ultrareview): typescript + @types/node were DECLARED required by INSTALL.md §4 but never
# actually in CORE_DEVDEPS, so a fresh --full flat-npm install left `tsc --noEmit` with no Node
# globals ("Cannot find name 'console'") and let typescript free-float to an unvalidated major via
# the typescript-eslint peer (at the time, unpinned resolved to 6.0.3, incompatible with the shipped
# tsconfig even WITH @types/node present). typescript@^5.7.0 satisfies typescript-eslint's own peer
# range (>=4.8.4 <6.1.0) and matches the INSTALL.md pin exactly — INSTALL.md and this array are the
# two sides of the #two-prompts-drift check (tests/install-sh/cic-s3-dep-install.test.sh).
#
# The `<6.1.0` upper bound is LOAD-BEARING, not cosmetic: on 2026-07-08 typescript@7.0.2 (the
# Go-native rewrite) became the registry `latest`, and its JS API dropped `ts.Extension`, so an
# unpinned resolve crashes @typescript-eslint/typescript-estree at module load
# (create-program/shared.js:59 — "Cannot read properties of undefined (reading 'Cjs')"), taking down
# `npm run lint` on every fresh consumer. The react-native arm was the first to hit this because it
# installs under --legacy-peer-deps (see REACT_NATIVE_DEVDEPS below), which suppresses the peer-RANGE
# check that shields the strict-peer stacks — so its typescript spec must carry its own cap. Revisit
# this pin (and the RN one) when typescript-eslint's peer range admits TS 7.
# 2026-08-08 pin sweep (consumer-matrix-pnpm-flake follow-up #2): the 16 remaining floats pinned at
# the newest line whose engines.node admits the node-20.19 brownfield floor (the "brownfield
# consumers may keep an older 20.19+ .nvmrc" note below); tilde = engines-forced below registry latest.
CORE_DEVDEPS=(
  eslint@^9 typescript-eslint@^8.59 @eslint/js@^9 @typescript-eslint/utils@^8.62.0 globals@^17.7.0
  prettier@3.8.3 eslint-config-prettier@^10.1.8 @vitest/eslint-plugin@^1.6.20
  typescript@^5.7.0
  vitest@^4.1.5 @vitest/coverage-v8@^4.1.5
  @stryker-mutator/core@^9.6.1 @stryker-mutator/vitest-runner@^9.6.1 @stryker-mutator/typescript-checker@^9.6.1
  dependency-cruiser@~17.4.3 fast-check@^4.8.0 glob@^13.0.6 ts-morph@^28.0.0 tsx@^4.22.4
  husky@^9.1.7 lint-staged@~16.4.0 sort-package-json@~3.7.1
  @types/node@^22.10.0
)
# npx-float (2026-07-10): concurrently/http-server/wait-on are invoked via bare `npx` by the
# shipped react-next CI template (packages/preset-next-15-canonical/templates/
# github-actions-ci-ui.yml, test-storybook job). The installer delivered none of the three, so
# non-TTY npx silently registry-fetched <pkg>@latest on every consumer CI run — no lockfile
# coverage, floats with upstream majors (the P0.2 typescript@7.0.2 failure class on a new
# surface). Pins were chosen node-20 compatible (concurrently@10 needs node >=22) and still run
# fine on the shipped .nvmrc 22.23.1 (brownfield consumers may keep an older 20.19+ .nvmrc); this array is the single canonical pin source now that the orphaned Batch-K
# storybook-package-additions.json template is retired (its only consumer was setup.sh, deleted
# in #946); INSTALL.md §4 mirrors these pins (two-way parity). Guarded by
# tests/install-sh/cic-s3-dep-install.test.sh Arms H+I.
#
# Storybook toolchain (same job): build-storybook + test-storybook need storybook itself, the
# Next.js framework pkg, and the test runner — ship them or that job is red-on-arrival.
# SB 10.x: nextjs-vite is the canonical Next.js framework pkg; addon-essentials/-interactions
# no longer exist past 8.x (merged into core — the retired JSON pinned them at ^10.3.3, a
# version that does not exist). Same pin discipline: majors pinned, node-20-and-up compatible.
# vite is @storybook/nextjs-vite's declared peer (^5||^6||^7||^8) and NOT its direct dep; a
# Next.js consumer has no vite of its own, so without this pin build-storybook resolves vite
# only via vitest's transitive hoist — declare it explicitly (cold-review MAJOR, PR #953).
# ^8 satisfies vitest 4.x (^6||^7||^8), nextjs-vite and node 20+ (engines ^20.19.0||>=22.12.0). No @vitejs/plugin-react
# (P3 2026-09-29): its vite ^8 peer broke configs on vite 6/7; the React vitest configs set esbuild
# jsx 'automatic' instead (a JSX test measured green on vite 6.4.3, 7.3.6, 8.3.1 — react-tsconfig.test.sh).
# @testing-library/user-event: INSTALL.md §4 declares it for React stacks but no array delivered
# it (same INSTALL.md↔installer parity class as P0.2; loud-fail — consumer interaction tests die
# at import). Unpinned like its @testing-library siblings; also in REACT_SPA_DEVDEPS below.
REACT_DEVDEPS=(
  jsdom @testing-library/react
  @testing-library/jest-dom @testing-library/user-event @next/eslint-plugin-next
  eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsx-a11y
  eslint-plugin-testing-library @playwright/test
  concurrently@^9.0.0 http-server@^14.1.0 wait-on@^8.0.0
  storybook@^10.5.0 @storybook/nextjs-vite@^10.5.0 @storybook/test-runner@^0.24.4
  vite@^8.0.0
)
# react-spa (Vite SPA): de-Next-ified — drop @next/eslint-plugin-next, add eslint-plugin-boundaries
# (Feature-Sliced Design layering the shipped SPA eslint.config enforces). Mirrors REACT_DEVDEPS otherwise.
REACT_SPA_DEVDEPS=(
  jsdom @testing-library/react
  @testing-library/jest-dom @testing-library/user-event eslint-plugin-boundaries
  eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsx-a11y
  eslint-plugin-testing-library @playwright/test
)
# react-native (Expo / bare-RN): native, no web/DOM toolchain (vitest env=node, no jsdom/playwright).
# Just the RN ESLint toolchain — eslint-config-expo (Expo baseline), @react-native/eslint-config +
# @eslint/eslintrc (bare-RN baseline via FlatCompat), and the RN lint plugins. Ship BOTH baselines'
# deps so a consumer can switch Expo↔bare without a reinstall.
#
# `typescript` USED TO BE listed EXPLICITLY for react-native ONLY (GH #779 lint follow-up). The
# bare-RN baseline resolves `@react-native/eslint-config#overrides[3]` → `@typescript-eslint/parser`,
# which require()s a standalone `typescript` module at parse time (Expo's eslint-config-expo needs
# it too). At the time, CORE_DEVDEPS pinned no `typescript` at all — every OTHER stack got it only
# via peer auto-install (a transitive peer of typescript-eslint/the parser), but RN's install runs
# with `--legacy-peer-deps` (the a11y-peer ERESOLVE workaround below), which SUPPRESSES npm's peer
# auto-install — so RN alone needed its own bare entry, or `npm run lint` died on a fresh RN
# consumer: "Cannot find module 'typescript'".
#
# P0.2: CORE_DEVDEPS now pins `typescript@^5.7.0` directly (INSTALL.md parity, see above) — an
# EXPLICIT devDependency, not a peer, so `--legacy-peer-deps` no longer suppresses it. RN gets
# typescript from CORE_DEVDEPS like every other stack now, so the RN-local bare entry is removed:
# keeping it would put TWO conflicting `typescript` specs (`^5.7.0` from core vs. unpinned here) in
# the SAME install command for the react-native stack.
REACT_NATIVE_DEVDEPS=(
  eslint-config-expo @react-native/eslint-config @eslint/eslintrc
  eslint-plugin-react-native eslint-plugin-react-native-a11y
)
DEVDEPS=( "${CORE_DEVDEPS[@]}" )
[ "$STACK" = "react-next" ] && DEVDEPS+=( "${REACT_DEVDEPS[@]}" )
[ "$STACK" = "react-spa" ] && DEVDEPS+=( "${REACT_SPA_DEVDEPS[@]}" )
[ "$STACK" = "react-native" ] && DEVDEPS+=( "${REACT_NATIVE_DEVDEPS[@]}" )
# P2 G5 / K4: an oxlint or Biome project gets no ESLint toolchain (40-configs placed no ESLint config),
# a Biome or dprint project no prettier. @typescript-eslint/utils stays: getff's rule plugin imports
# it, and an oxlint config can load that plugin (jsPlugins).
_slot_kept=()
for _s in ${DEVDEPS[@]+"${DEVDEPS[@]}"}; do
  _n=$(deps_spec_name "$_s")
  case "${LINTER_SLOT:-}:$_n" in
    oxlint:eslint|oxlint:typescript-eslint|oxlint:globals|oxlint:@eslint/*|oxlint:eslint-plugin-*|oxlint:eslint-config-*|oxlint:@*/eslint-plugin*|oxlint:@*/eslint-config*) continue ;;
    biome:eslint|biome:typescript-eslint|biome:globals|biome:@eslint/*|biome:eslint-plugin-*|biome:eslint-config-*|biome:@*/eslint-plugin*|biome:@*/eslint-config*) continue ;;
  esac
  case "${FORMATTER_SLOT:-}:$_n" in
    biome:prettier|dprint:prettier|biome:eslint-config-prettier|dprint:eslint-config-prettier) continue ;;
  esac
  _slot_kept+=("$_s")
done
DEVDEPS=( ${_slot_kept[@]+"${_slot_kept[@]}"} )

# P0.2: runtime deps — installed as regular `dependencies`, NEVER as -D/--save-dev. zod is the
# boundary-parsing library INSTALL.md §4 documents as "the runtime dep that's used everywhere" and
# that R2 (no-unsafe-zod-parse, packages/core/eslint-rules/no-unsafe-zod-parse.ts) assumes consumer
# boundary code imports. It was previously undeclared anywhere in the installer: a consumer following
# INSTALL.md/the shipped R2 rule and importing zod at an HTTP boundary tripped dependency-cruiser's
# `no-non-package-json` rule on `npm run arch:check` (real, undeclared dep — not a false positive).
# Fix the delivery gap, don't mask it: no arch:check exemption (that would hide a genuine missing
# dependency, exactly the form-over-behavior failure this repo exists to prevent). Same single-source
# discipline as CORE_DEVDEPS: this array feeds BOTH the actual install (below) and the Next-steps
# fallback echo in setup.d/99-finalize.sh (#two-prompts-drift) — currently core-only (no stack ever
# adds to it), unconditional so it is never empty (bash 3.2 `set -u` + an empty array is unsafe).
CORE_RUNTIME_DEPS=( zod@^3.24.0 )
RUNTIME_DEPS=( "${CORE_RUNTIME_DEPS[@]}" )

# P2 G2: a package the project already declares is never re-installed — `npm install -D <ours>` would
# rewrite the project's own spec (measured: typescript ~6.0.2 → ^5.9.3). Its name is printed as kept.
# From here on DEVDEPS / RUNTIME_DEPS may be EMPTY: every expansion below is `${X[@]+"${X[@]}"}`.
deps_drop_declared

# react-native only: eslint-plugin-react-native-a11y peer-deps eslint ^3..^8 (no eslint-9-compatible
# release exists), while the preset ships eslint ^9. npm 7+ strict peer resolution aborts the whole
# dev-dep install with ERESOLVE → a fresh `install.sh react-native --full` lands NO toolchain (no
# prettier/depcruise) and the consumer's `npm run validate` cannot run. The plugin's rules are flat-
# config plugin OBJECTS consumed as `plugins: { 'react-native-a11y': … }` (eslint.config.rn-common.mjs)
# — they are eslint-9-functional; the peer range is stale npm metadata, not a runtime incompatibility.
# So relax peer resolution for the RN npm install ONLY (ts-server/react-next/react-spa keep strict
# peer checks). npm-specific: pnpm/yarn do not hard-fail on peer conflicts by default. (GH #779 follow-up)
NPM_PEER_FLAG=""
[ "$STACK" = "react-native" ] && NPM_PEER_FLAG="--legacy-peer-deps"

# npm's peer-set walk can CRASH (an unhandled TypeError inside arborist's #loadPeerSet, npm/cli#9787,
# npm/cli#8261) when a third party publishes a major; that crash — and only that, never an ERESOLVE —
# is retried with --legacy-peer-deps inside deps_npm_install_strict (top of this file). An ERESOLVE
# drops OUR conflicting package and retries strict (P2 G2): --legacy-peer-deps on a real version
# conflict installed a tree that did not load (P1 run 2026-09-29: vitest ERR_PACKAGE_PATH_NOT_EXPORTED).

DEPS_INSTALLED=""
_do_dep_install=""
if [ "$DRY_RUN" = "--dry-run" ]; then
  echo "▶ dev-deps → [dry-run] would offer to install ${#DEVDEPS[@]} dev-dep(s) + ${#RUNTIME_DEPS[@]} runtime dep(s) with $(detect_pm)"
elif [ ! -f "$PROJECT_ROOT/package.json" ]; then
  :   # no package.json to install into — nothing to do
elif [ -n "$FULL" ]; then
  _do_dep_install="yes"
elif [ -t 0 ]; then
  printf "▶ Install %s dev-dependencies + %s runtime dependency(ies) now with %s? [y/N] " "${#DEVDEPS[@]}" "${#RUNTIME_DEPS[@]}" "$(detect_pm)"
  read -r _ans || _ans=""
  case "$_ans" in [yY]|[yY][eE][sS]) _do_dep_install="yes" ;; esac
else
  :   # non-interactive (no tty) without --full → default No; 99-finalize lists the deps as not wired
fi

# _deps_not_wired <reason> — the dependency install did not land: one NOT-wired line naming the
# packages and the reason (operator directive 2026-09-28: no copy-paste install command instead).
_deps_not_wired() {
  note_not_wired "dependencies (${#DEVDEPS[@]} dev + ${#RUNTIME_DEPS[@]} runtime: ${DEVDEPS[*]-} ${RUNTIME_DEPS[*]-}) — not installed: $1"
}
DEPS_NPM_FAIL_REASON=""
if [ "$DRY_RUN" != "--dry-run" ] && [ -f "$PROJECT_ROOT/package.json" ] && [ "$_do_dep_install" != "yes" ]; then
  if [ -t 0 ] && [ -z "$FULL" ]; then
    _deps_not_wired "the install adds packages only on --full or a yes at its prompt, and the prompt was answered no"
  else
    _deps_not_wired "the install adds packages only on --full or a yes at its prompt, and this run had neither (no terminal to ask on)"
  fi
fi

if [ "$_do_dep_install" = "yes" ]; then
  _pm=$(detect_pm)
  if ! command -v "$_pm" >/dev/null 2>&1; then
    echo "  ⚠  $_pm not found on PATH — dependencies NOT installed"
    _deps_not_wired "$_pm (the package manager this project uses) is not on PATH"
  else
    echo "▶ Installing ${#DEVDEPS[@]} dev-dependencies with $_pm (this may take a minute) …"
    # npm ONLY: bound the ONE wildcard peer that makes arborist crash.
    # `@vitest/eslint-plugin` peer-deps `vitest: "*"`; once vitest 5.0.0 became registry `latest`
    # (2026-09-03) that wildcard pulled vitest 5 into the peer set beside the vitest@^4.1.5 this
    # manifest pins, and vitest 5's own peers are EXACT self-references (@vitest/coverage-v8@5.0.0,
    # @vitest/browser-playwright@5.0.0) that walk back to the pinned 4.1.x → arborist reaches a null
    # node and throws (`Cannot read properties of null (reading 'edgesOut')`). Measured offline
    # (no network, 3 reps, 24 CORE_DEVDEPS): the strict attempt burns 35.7-38.8s of CPU and THEN
    # crashes; bounded, the same resolve succeeds in 2.4-2.5s — a ~15x cut the --legacy-peer-deps
    # retry below CANNOT recover, because the retry only runs AFTER that CPU is already spent.
    # Upstream: npm/cli#9787, npm/cli#8261.
    #
    # NESTED (`overrides["@vitest/eslint-plugin"].vitest`), never a TOP-LEVEL `overrides.vitest` —
    # this is load-bearing, not style. npm refuses an override on a package that is also a DIRECT
    # dependency unless the two specs match exactly; `npm install --save-dev vitest@^4.1.5` re-saves
    # the direct spec as the RESOLVED `^4.1.11`, so a top-level override pinned at `^4.1.5` goes
    # stale the instant the devDep install finishes and the NEXT npm invocation in this same run
    # (the runtime-dep install below) dies with `EOVERRIDE: Override for vitest@^4.1.11 conflicts
    # with direct dependency` — measured end-to-end 2026-09-04, install.sh exit 1. The documented
    # `"vitest": "$vitest"` self-reference does not help either: measured offline, it leaves the
    # peer walk unbounded and still crashes in 2.2s. The nested form constrains vitest only where
    # the eslint plugin asks for it, never touches the direct dependency, and so cannot go stale.
    #
    # This does NOT weaken the strict-first gate: it narrows exactly ONE known-broken wildcard to
    # the range this manifest ALREADY pins in CORE_DEVDEPS, and leaves the consumer's own direct
    # vitest choice untouched. Every other peer conflict — notably the react-native a11y/eslint-9
    # ERESOLVE above — still surfaces strictly. The range is DERIVED from CORE_DEVDEPS, never
    # retyped, so the override and the pin cannot drift (#two-prompts-drift).
    # npm-scoped because the crash is arborist's: pnpm keys overrides under `pnpm.overrides` and
    # yarn under `resolutions`, so a bare `overrides` would be dead config for them.
    if [ "$_pm" = "npm" ] && command -v node >/dev/null 2>&1; then
      _vitest_range=""
      for _spec in "${CORE_DEVDEPS[@]}"; do
        case "$_spec" in vitest@*) _vitest_range="${_spec#vitest@}"; break ;; esac
      done
      if [ -n "$_vitest_range" ]; then
        AIF_PKG="$PROJECT_ROOT/package.json" AIF_VITEST_RANGE="$_vitest_range" node -e '
          const fs = require("fs");
          const p = process.env.AIF_PKG;
          const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
          pkg.overrides = pkg.overrides || {};
          const KEY = "@vitest/eslint-plugin";
          // Non-destructive, same guard as the scripts/devDeps merges above: a consumer who has
          // deliberately set their own entry for this key keeps it, whatever shape it has.
          if (!(KEY in pkg.overrides)) {
            pkg.overrides[KEY] = { vitest: process.env.AIF_VITEST_RANGE };
            fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n");
            process.stderr.write("  ✓ scoped overrides[" + KEY + "].vitest=" +
              process.env.AIF_VITEST_RANGE + " (bounds the wildcard peer; npm arborist crash guard)\n");
          }
        ' || true
      fi
    fi
    _ok=""
    case "$_pm" in
      pnpm)
        # pnpm refuses to add to a workspace root without -w; pass it only when a workspace exists.
        # Explicit branch (not an empty-array expansion) for bash 3.2 + `set -u` safety.
        if [ -f "$PROJECT_ROOT/pnpm-workspace.yaml" ]; then
          # GH #533: `pnpm add -D -w` adds the dev-deps to the workspace ROOT, but on a COLD clone
          # (zero node_modules) it can leave sibling workspace packages unlinked — no node_modules,
          # missing `workspace:` symlinks — so typecheck/lint/test falsely fail while Next-steps
          # claims "nothing to do". Follow with a full `pnpm install` to materialise the whole
          # workspace link graph; idempotent + cheap when the tree is already warm. The `&&` keeps
          # honesty: if linking fails, _ok stays empty → the «install failed» not-wired path.
          if [ "${#DEVDEPS[@]}" -eq 0 ] || ( cd "$PROJECT_ROOT" && pnpm add -D -w "${DEVDEPS[@]}" && pnpm install ); then _ok="yes"; fi
        else
          if [ "${#DEVDEPS[@]}" -eq 0 ] || ( cd "$PROJECT_ROOT" && pnpm add -D "${DEVDEPS[@]}" ); then _ok="yes"; fi
        fi ;;
      yarn)
        if [ "${#DEVDEPS[@]}" -eq 0 ] || ( cd "$PROJECT_ROOT" && yarn add -D "${DEVDEPS[@]}" ); then _ok="yes"; fi ;;
      *)
        # Strict; an ERESOLVE drops our conflicting package (NOT wired) and retries strict; what
        # finally installed replaces DEVDEPS so the counts below and in 99-finalize stay true.
        if deps_npm_install_strict --save-dev ${DEVDEPS[@]+"${DEVDEPS[@]}"}; then _ok="yes"; DEVDEPS=( ${DEPS_NPM_SPECS[@]+"${DEPS_NPM_SPECS[@]}"} ); fi ;;
    esac

    # P0.2: runtime deps (zod) — SAME consent gate as the devDep install above (one prompt covers
    # both), but a SEPARATE PM invocation WITHOUT -D/--save-dev (regular `dependencies`, never
    # devDependencies). Only attempted when the devDep install above succeeded, so a failed devDep
    # install can't produce a misleading "runtime deps landed, devDeps didn't" half-state.
    _ok_rt=""
    if [ -n "$_ok" ]; then
      echo "▶ Installing ${#RUNTIME_DEPS[@]} runtime dependency(ies) with $_pm …"
      case "$_pm" in
        pnpm)
          if [ -f "$PROJECT_ROOT/pnpm-workspace.yaml" ]; then
            if [ "${#RUNTIME_DEPS[@]}" -eq 0 ] || ( cd "$PROJECT_ROOT" && pnpm add -w "${RUNTIME_DEPS[@]}" ); then _ok_rt="yes"; fi
          else
            if [ "${#RUNTIME_DEPS[@]}" -eq 0 ] || ( cd "$PROJECT_ROOT" && pnpm add "${RUNTIME_DEPS[@]}" ); then _ok_rt="yes"; fi
          fi ;;
        yarn)
          if [ "${#RUNTIME_DEPS[@]}" -eq 0 ] || ( cd "$PROJECT_ROOT" && yarn add "${RUNTIME_DEPS[@]}" ); then _ok_rt="yes"; fi ;;
        *)
          if deps_npm_install_strict --save ${RUNTIME_DEPS[@]+"${RUNTIME_DEPS[@]}"}; then _ok_rt="yes"; RUNTIME_DEPS=( ${DEPS_NPM_SPECS[@]+"${DEPS_NPM_SPECS[@]}"} ); fi ;;
      esac
    fi

    if [ -n "$_ok" ] && [ -n "$_ok_rt" ]; then
      DEPS_INSTALLED="1"
      echo "  ✓ dev + runtime dependencies installed → node_modules/ (wired hooks now have their tools)"
    else
      echo "  ⚠  dep install incomplete — $_pm failed (output above)"
      _deps_not_wired "${DEPS_NPM_FAIL_REASON:-the $_pm install failed (its output is above)}"
    fi
  fi
fi

# ─── 8b. (retired 2026-09-28) tsx at the workspace root ─────────────────────────────────────
# This step used to guarantee that `node --import tsx/esm` resolved from the repo root, because the
# pre-push dispatcher ran packages/core/hooks/pre-push.ts through tsx (GH #636/#638). The hook now
# ships as a prebuilt packages/core/hooks/pre-push.bundle.mjs that plain `node` runs, so nothing on
# the hook path needs tsx any more; tsx itself still arrives with CORE_DEVDEPS in §8.
