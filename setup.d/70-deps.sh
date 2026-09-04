#!/usr/bin/env bash
# setup.d/70-deps.sh — §7 package.json scripts merge + §8 dev-dep install + §8b tsx-at-root.
#
# Sources: lib.sh (already in dispatcher scope)
# S0 rows: §7 (install.sh:1358-1440), §8 (install.sh:1442-1538), §8b (install.sh:1540-1595)
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
# stryker, npm-run-all2, vitest, prettier, husky) are NOT installed here — that is the consumer's
# `npm install` + residual R-2 (devDeps manifest). Scripts present ≠ runnable until deps land,
# but "Missing script" → "tool not installed" is the intended, INSTALL.md-documented path.
if [ -f "$PROJECT_ROOT/package.json" ]; then
  if [ -n "$DRY_RUN" ]; then
    echo "▶ package.json scripts → [dry-run] would merge canonical block (non-destructive)"
  elif command -v node >/dev/null 2>&1; then
    echo "▶ Merging canonical scripts → package.json (non-destructive)"
    # #508: arch:check target. A pnpm monorepo has no root src/ (only apps/*/src, packages/*/src),
    # so a hardcoded `depcruise … src` hard-fails (exit 1, "Can't open 'src'") and breaks the
    # shipped CI's architecture job. Resolve to source roots that EXIST so arch:check cruises
    # something on flat, layered, AND monorepo shapes instead of crashing on a missing dir. The
    # layer rules in .dependency-cruiser.cjs match nested package src via (?:^|/)src/<layer>.
    # The target must NEVER be a non-existent dir (that is the crash). Resolution order:
    #   1. workspace + a known package root present → that root (apps/packages/services/libs/modules)
    #   2. else a root src/ present → src
    #   3. else → "." (cwd always exists; never "Can't open"). Exotic-named workspace roots fall to
    #      (2)/(3); a one-line arch:check edit lets the consumer point at their exact roots.
    # #508 arch:check target signal — kept as-is (only the mutation-wiring signal below changes,
    # per plan Amendment A1). AIF_MONOREPO_SIG / AIF_ARCH_TARGET stay the manifest-key-based check.
    AIF_MONOREPO_SIG=0
    if [ -f "$PROJECT_ROOT/pnpm-workspace.yaml" ] || grep -q '"workspaces"' "$PROJECT_ROOT/package.json" 2>/dev/null; then
      AIF_MONOREPO_SIG=1
    fi
    AIF_ARCH_TARGET=""
    if [ "$AIF_MONOREPO_SIG" = "1" ]; then
      for _d in apps packages services libs modules; do
        [ -d "$PROJECT_ROOT/$_d" ] && AIF_ARCH_TARGET="$AIF_ARCH_TARGET $_d"
      done
      AIF_ARCH_TARGET="${AIF_ARCH_TARGET# }"
    fi
    if [ -z "$AIF_ARCH_TARGET" ]; then
      if [ -d "$PROJECT_ROOT/src" ]; then AIF_ARCH_TARGET="src"; else AIF_ARCH_TARGET="."; fi
    fi
    # #931 PR-2 (C2 fix, plan Amendment A1): test:mutation must route to the per-package wrapper
    # based on ARTIFACT PRESENCE (scripts/run-mutation.sh), NOT the AIF_MONOREPO_SIG manifest
    # signal above. AIF_MONOREPO_SIG (pnpm-workspace.yaml / "workspaces" key) and the EMIT gate in
    # setup.d/40-configs.sh (_ws_lines — a conventional-dir enumeration: apps|packages|services|
    # libs|modules — that does NOT consult the workspace manifest) are two DIFFERENT signals that
    # diverge both ways: a `packages/*` monorepo with no manifest key would wire "stryker run"
    # against configs that were never emitted (SF-1 stays unfixed); a
    # `"workspaces":["client","server"]` repo with non-conventional dirs would wire the wrapper
    # form even though 40-configs.sh took the FLAT branch (no wrapper ever copied) — a hard error
    # on first run (working → broken regression). 40-configs.sh runs BEFORE 70-deps.sh (setup.d
    # numeric order), so the wrapper's on-disk presence is the authoritative "per-workspace
    # configs were emitted" signal — wire⟺emit by construction.
    AIF_HAS_MUTATION_WRAPPER=0
    [ -f "$PROJECT_ROOT/scripts/run-mutation.sh" ] && AIF_HAS_MUTATION_WRAPPER=1
    AIF_PKG="$PROJECT_ROOT/package.json" AIF_ARCH_TARGET="$AIF_ARCH_TARGET" AIF_STACK="$STACK" AIF_HAS_MUTATION_WRAPPER="$AIF_HAS_MUTATION_WRAPPER" node -e '
      const fs = require("fs");
      const p = process.env.AIF_PKG;
      const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
      pkg.scripts = pkg.scripts || {};
      // #931 PR-2 (C2 fix): route test:mutation to the per-package wrapper IFF setup.d/40-configs.sh
      // actually emitted it (scripts/run-mutation.sh on disk) — see the AIF_HAS_MUTATION_WRAPPER
      // comment above for why this replaced the AIF_MONOREPO_SIG manifest-key signal.
      const hasMutationWrapper = process.env.AIF_HAS_MUTATION_WRAPPER === "1";
      const want = {
        "lint": "eslint . --max-warnings=0",
        "lint:fix": "eslint . --fix",
        "format": "prettier --write .",
        "format:check": "prettier --check .",
        "typecheck": "tsc --noEmit",
        "test": "vitest run",
        "test:watch": "vitest",
        "test:coverage": "vitest run --coverage",
        "test:integration": "vitest run -- --include 'src/**/*.integration.{ts,tsx}'",
        "test:mutation": hasMutationWrapper ? "bash scripts/run-mutation.sh" : "stryker run",
        "test:mutation:incremental": hasMutationWrapper ? "bash scripts/run-mutation.sh --incremental" : "stryker run --incremental",
        "arch:check": "depcruise --config .dependency-cruiser.cjs " + (process.env.AIF_ARCH_TARGET || "src"),
        "audit:docs": "./scripts/audit-ai-docs.sh",
        "check:globs": "bash scripts/check-rule-globs.sh",
        "check:enforced": "bash scripts/check-rule-enforced.sh",
        "check:arch-boundaries": "bash scripts/check-arch-boundaries.sh",
        "check:lintstaged": "bash scripts/check-lintstaged-resolves.sh",
        "check:fences-fire": "bash scripts/check-fences-fire.sh",
        "check:shields-up": "bash scripts/check-shields-up.sh",
        "test:mutation:generated": "bash scripts/run-generated-rule-mutation.sh",
        "validate": "npm-run-all2 --parallel typecheck lint format:check arch:check audit:docs check:globs check:enforced check:arch-boundaries check:lintstaged check:fences-fire check:shields-up test",
        "prepare": "husky"
      };
      // react-next only: the shipped ci.yml test-storybook job calls build-storybook +
      // test-storybook (github-actions-ci-ui.yml:152-157). Scripts were historically merged by
      // retired setup.sh Batch K (storybook-package-additions.json, #946) — this is that merge,
      // relocated to the live path. Same non-destructive guard as the rest of `want`.
      if (process.env.AIF_STACK === "react-next") {
        want["storybook"] = "storybook dev -p 6006";
        want["build-storybook"] = "storybook build";
        want["test-storybook"] = "test-storybook";
      }
      let added = 0;
      for (const [k, v] of Object.entries(want)) if (!(k in pkg.scripts)) { pkg.scripts[k] = v; added++; }
      // cih-s1 F2: also merge the devDeps the SHIPPED HOOKS need so they run, not just exist.
      // .husky/pre-commit calls `npx lint-staged`; the canonical scripts call `husky` (prepare)
      // and sort-package-json. Without these the hooks are dead even after `npm install`. Same
      // non-destructive guard as scripts: only keys the consumer lacks. 2026-08-08: these three
      // specs now mirror CORE_DEVDEPS below EXACTLY — tilde, not caret, where the node-20.19
      // engines floor forced a pin below registry latest (the floor has moved WITHIN a major, so
      // a caret would re-open it). Fourth copy of the same specs lives in
      // tests/install-sh/f2-hook-activation.test.sh:34 (strict equality).
      // devDependencies object created if absent.
      pkg.devDependencies = pkg.devDependencies || {};
      const wantDev = {
        "husky": "^9.1.7",
        "lint-staged": "~16.4.0",
        "sort-package-json": "~3.7.1"
      };
      let addedDev = 0;
      for (const [k, v] of Object.entries(wantDev)) if (!(k in pkg.devDependencies)) { pkg.devDependencies[k] = v; addedDev++; }
      fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n");
      process.stderr.write("  ✓ added " + added + " script(s); " + (Object.keys(want).length - added) + " already present (kept)\n");
      process.stderr.write("  ✓ added " + addedDev + " hook devDep(s); " + (Object.keys(wantDev).length - addedDev) + " already present (kept)\n");
    '
  else
    echo "  ⚠  node not found — skipped scripts merge; add them manually per INSTALL.md §3"
  fi
fi

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
  npm-run-all2@~8.0.4 @types/node@^22.10.0
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
# ^8 not ^7: the unpinned @vitejs/plugin-react above resolves to 6.x which peers vite@^8 —
# vite@^7 ERESOLVEs against it (PR #956 CI smoke); ^8 satisfies plugin-react 6.x, vitest 4.x
# (^6||^7||^8), nextjs-vite, and node 20+ (engines ^20.19.0||>=22.12.0 — covers the shipped .nvmrc 22.23.1 and brownfield 20.19+ pins).
# @testing-library/user-event: INSTALL.md §4 declares it for React stacks but no array delivered
# it (same INSTALL.md↔installer parity class as P0.2; loud-fail — consumer interaction tests die
# at import). Unpinned like its @testing-library siblings; also in REACT_SPA_DEVDEPS below.
REACT_DEVDEPS=(
  @vitejs/plugin-react jsdom @testing-library/react
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
  @vitejs/plugin-react jsdom @testing-library/react
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

# npm's peer-set walk can CRASH (not ERESOLVE — an unhandled TypeError inside arborist's
# #loadPeerSet, `Cannot read properties of null (reading 'edgesOut')`) whenever a transitive
# wildcard peer range resolves to a NEWER major than the one this manifest pins, and that newer
# major's own peer set is self-referential. Reproduced 2026-09-03 on BOTH npm 10.9.9 and 11.4.2
# against a cold cache: `@vitest/eslint-plugin` peer-deps `vitest: "*"` → the freshly published
# vitest 5.0.0 → its exact peers `@vitest/coverage-v8@5.0.0` / `@vitest/browser-playwright@5.0.0`
# → back to the vitest 4.1.x this manifest pins → null node → crash. Upstream: npm/cli#9787,
# npm/cli#8261. The crash aborts the WHOLE dev-dep install, so a fresh `install.sh <stack> --full`
# lands no toolchain at all — the same consumer-facing failure the RN ERESOLVE note above describes,
# but triggered by a third party publishing a major, i.e. it can strike any stack on any day with
# NO change on our side.
#
# So: keep the strict attempt as the DEFAULT (a genuine peer conflict must still surface — masking
# it is exactly the form-over-behavior failure this repo exists to prevent), and fall back to
# --legacy-peer-deps ONLY after the strict attempt has actually failed. The retry is not a silent
# `|| true`: it prints what happened, and `_ok` still gates the honest "install incomplete" path
# below, so a fallback that ALSO fails is reported as a failure. Stacks that already relax peers
# (react-native) skip the retry — their first attempt is the relaxed one.
_npm_install_with_peer_fallback() {
  # $@ = the npm argv after `npm` (e.g. install --save-dev <specs…>)
  if ( cd "$PROJECT_ROOT" && npm "$@" $NPM_PEER_FLAG ); then return 0; fi
  if [ -n "$NPM_PEER_FLAG" ]; then return 1; fi
  echo "  ⚠  npm could not resolve the peer graph (strict mode) — retrying with --legacy-peer-deps."
  echo "     This is usually a third-party major published upstream, not a defect in your project."
  ( cd "$PROJECT_ROOT" && npm "$@" --legacy-peer-deps )
}

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
  :   # non-interactive (no tty) without --full → default No; the manual command prints in Next steps
fi

if [ "$_do_dep_install" = "yes" ]; then
  _pm=$(detect_pm)
  if ! command -v "$_pm" >/dev/null 2>&1; then
    echo "  ⚠  $_pm not found on PATH — skipped dev-dep install (install manually, see Next steps)."
  else
    echo "▶ Installing ${#DEVDEPS[@]} dev-dependencies with $_pm (this may take a minute) …"
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
          # honesty: if linking fails, _ok stays empty → the "install failed, run manually" path.
          if ( cd "$PROJECT_ROOT" && pnpm add -D -w "${DEVDEPS[@]}" && pnpm install ); then _ok="yes"; fi
        else
          if ( cd "$PROJECT_ROOT" && pnpm add -D "${DEVDEPS[@]}" ); then _ok="yes"; fi
        fi ;;
      yarn)
        if ( cd "$PROJECT_ROOT" && yarn add -D "${DEVDEPS[@]}" ); then _ok="yes"; fi ;;
      *)
        # $NPM_PEER_FLAG is empty for all stacks except react-native (see ERESOLVE note above).
        # The helper appends it, retrying once with --legacy-peer-deps if the strict pass crashed.
        if _npm_install_with_peer_fallback install --save-dev "${DEVDEPS[@]}"; then _ok="yes"; fi ;;
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
            if ( cd "$PROJECT_ROOT" && pnpm add -w "${RUNTIME_DEPS[@]}" ); then _ok_rt="yes"; fi
          else
            if ( cd "$PROJECT_ROOT" && pnpm add "${RUNTIME_DEPS[@]}" ); then _ok_rt="yes"; fi
          fi ;;
        yarn)
          if ( cd "$PROJECT_ROOT" && yarn add "${RUNTIME_DEPS[@]}" ); then _ok_rt="yes"; fi ;;
        *)
          if _npm_install_with_peer_fallback install "${RUNTIME_DEPS[@]}"; then _ok_rt="yes"; fi ;;
      esac
    fi

    if [ -n "$_ok" ] && [ -n "$_ok_rt" ]; then
      DEPS_INSTALLED="1"
      echo "  ✓ dev + runtime dependencies installed → node_modules/ (wired hooks now have their tools)"
    else
      echo "  ⚠  dep install incomplete — run the remainder manually (see Next steps)."
    fi
  fi
fi

# ─── 8b. GH #636 (a): guarantee the pre-push TS hook runtime (tsx) resolves from the ROOT ─────
# The dispatcher runs `node --import tsx/esm <root>/packages/core/hooks/pre-push.ts` from the repo
# ROOT, so tsx must resolve THERE. tsx is in CORE_DEVDEPS, but on a pnpm monorepo a tsx that lives in
# a sub-package is NOT hoisted to the root, so the TS hook degrades to the bash fallback (critical-only
# checks — #638 made that degradation graceful instead of a crash). Close the gap: probe tsx-at-root
# with the SAME expression the dispatcher uses (#638); if missing, install it (--full → silent;
# interactive tty → [y/N], even without --full; refused / non-tty → WARN with the exact command).
# tsx ONLY — NOT ts-morph/R2 (separate concern, §6b-bis-L2 below). Idempotent: the probe short-circuits
# when tsx already resolves (incl. the --full §8 install above, which lands tsx with -w on a workspace).
_tsx_resolves() { ( cd "$PROJECT_ROOT" && node --import tsx/esm -e '' ) >/dev/null 2>&1; }
if [ "$DRY_RUN" = "--dry-run" ]; then
  echo "▶ tsx-at-root → [dry-run] would ensure tsx resolves from the workspace root (pre-push TS hook runtime)"
elif [ ! -f "$PROJECT_ROOT/package.json" ]; then
  :   # no package.json — nothing to install into
elif ! command -v node >/dev/null 2>&1; then
  :   # no node → the dispatcher can't run the TS hook anyway; the bash fallback covers it
elif _tsx_resolves; then
  :   # already resolvable from the root (incl. the --full §8 install) — nothing to do
else
  # tsx is NOT resolvable from the root. Build the PM-aware, root-targeted install command ONCE — the
  # SSOT for both the actual install and the WARN message, so the two can't drift (#two-prompts-drift).
  _pm=$(detect_pm)
  case "$_pm" in
    pnpm) if [ -f "$PROJECT_ROOT/pnpm-workspace.yaml" ]; then _tsx_argv=(pnpm add -D -w tsx); else _tsx_argv=(pnpm add -D tsx); fi ;;
    yarn) _tsx_argv=(yarn add -D tsx) ;;
    *)    _tsx_argv=(npm i -D tsx) ;;
  esac
  _tsx_cmd="${_tsx_argv[*]}"
  # Decide whether to install (mirror the §8 gate: --full → silent; interactive → offer; else No).
  _do_tsx=""
  if [ -n "$FULL" ]; then
    _do_tsx="yes"
  elif [ -t 0 ]; then
    printf "▶ tsx is not resolvable from the workspace root (needed by the pre-push TS hook).\n"
    printf "  Install it now with '%s'? [y/N] " "$_tsx_cmd"
    read -r _ans || _ans=""
    case "$_ans" in [yY]|[yY][eE][sS]) _do_tsx="yes" ;; esac
  fi
  if [ "$_do_tsx" = "yes" ]; then
    if ! command -v "$_pm" >/dev/null 2>&1; then
      echo "  ⚠  $_pm not found on PATH — could not install tsx."
    else
      echo "▶ Ensuring tsx at the workspace root: $_tsx_cmd"
      ( cd "$PROJECT_ROOT" && "${_tsx_argv[@]}" ) || echo "  ⚠  '$_tsx_cmd' failed."
    fi
  fi
  # Honest end-state: if tsx STILL doesn't resolve (refused, non-tty, PM missing, or install failed),
  # the pre-push hook will run in REDUCED mode — say so + print the exact enabling command.
  if ! _tsx_resolves; then
    echo ""
    echo "⚠  tsx is not resolvable from the workspace root — the pre-push hook will run in"
    echo "   REDUCED mode (critical-only bash checks), not the full TypeScript suite."
    echo "   To enable full pre-push checks, run from the repo root:"
    echo "       $_tsx_cmd"
  fi
fi
