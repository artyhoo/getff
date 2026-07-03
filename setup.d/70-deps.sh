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
    AIF_ARCH_TARGET=""
    if [ -f "$PROJECT_ROOT/pnpm-workspace.yaml" ] || grep -q '"workspaces"' "$PROJECT_ROOT/package.json" 2>/dev/null; then
      for _d in apps packages services libs modules; do
        [ -d "$PROJECT_ROOT/$_d" ] && AIF_ARCH_TARGET="$AIF_ARCH_TARGET $_d"
      done
      AIF_ARCH_TARGET="${AIF_ARCH_TARGET# }"
    fi
    if [ -z "$AIF_ARCH_TARGET" ]; then
      if [ -d "$PROJECT_ROOT/src" ]; then AIF_ARCH_TARGET="src"; else AIF_ARCH_TARGET="."; fi
    fi
    AIF_PKG="$PROJECT_ROOT/package.json" AIF_ARCH_TARGET="$AIF_ARCH_TARGET" node -e '
      const fs = require("fs");
      const p = process.env.AIF_PKG;
      const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
      pkg.scripts = pkg.scripts || {};
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
        "test:mutation": "stryker run",
        "test:mutation:incremental": "stryker run --incremental",
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
      let added = 0;
      for (const [k, v] of Object.entries(want)) if (!(k in pkg.scripts)) { pkg.scripts[k] = v; added++; }
      // cih-s1 F2: also merge the devDeps the SHIPPED HOOKS need so they run, not just exist.
      // .husky/pre-commit calls `npx lint-staged`; the canonical scripts call `husky` (prepare)
      // and sort-package-json. Without these the hooks are dead even after `npm install`. Same
      // non-destructive guard as scripts: only keys the consumer lacks; caret ranges (not in the
      // framework root package.json — no range to mirror, per orchestrator note) so consumers get
      // patches. devDependencies object created if absent.
      pkg.devDependencies = pkg.devDependencies || {};
      const wantDev = {
        "husky": "^9.1.7",
        "lint-staged": "^15.2.10",
        "sort-package-json": "^2.10.1"
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
CORE_DEVDEPS=(
  eslint@^9 typescript-eslint@^8.59 @eslint/js@^9 @typescript-eslint/utils globals
  prettier@3.8.3 eslint-config-prettier @vitest/eslint-plugin
  vitest@^4.1.5 @vitest/coverage-v8@^4.1.5
  @stryker-mutator/core @stryker-mutator/vitest-runner @stryker-mutator/typescript-checker
  dependency-cruiser fast-check glob ts-morph tsx
  husky lint-staged sort-package-json
  npm-run-all2
)
REACT_DEVDEPS=(
  @vitejs/plugin-react jsdom @testing-library/react
  @testing-library/jest-dom @next/eslint-plugin-next
  eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsx-a11y
  eslint-plugin-testing-library @playwright/test
)
# react-spa (Vite SPA): de-Next-ified — drop @next/eslint-plugin-next, add eslint-plugin-boundaries
# (Feature-Sliced Design layering the shipped SPA eslint.config enforces). Mirrors REACT_DEVDEPS otherwise.
REACT_SPA_DEVDEPS=(
  @vitejs/plugin-react jsdom @testing-library/react
  @testing-library/jest-dom eslint-plugin-boundaries
  eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsx-a11y
  eslint-plugin-testing-library @playwright/test
)
# react-native (Expo / bare-RN): native, no web/DOM toolchain (vitest env=node, no jsdom/playwright).
# Just the RN ESLint toolchain — eslint-config-expo (Expo baseline), @react-native/eslint-config +
# @eslint/eslintrc (bare-RN baseline via FlatCompat), and the RN lint plugins. Ship BOTH baselines'
# deps so a consumer can switch Expo↔bare without a reinstall.
#
# `typescript` is listed EXPLICITLY for react-native ONLY (GH #779 lint follow-up). The bare-RN
# baseline resolves `@react-native/eslint-config#overrides[3]` → `@typescript-eslint/parser`, which
# require()s a standalone `typescript` module at parse time (Expo's eslint-config-expo needs it too).
# Other stacks get `typescript` auto-installed as a peer of `typescript-eslint`/the parser (verified:
# a react-spa consumer carries node_modules/typescript with NO package.json entry); RN can't, because
# the RN install runs with `--legacy-peer-deps` (the a11y-peer ERESOLVE workaround above), which
# SUPPRESSES npm's peer auto-install. Without this line `npm run lint` dies on a fresh RN consumer:
# "Cannot find module 'typescript'". Unpinned — consistent with the bare entries in these arrays; the
# parser's `typescript >=4.8.4 <6.1.0` peer is satisfied by the current registry latest.
REACT_NATIVE_DEVDEPS=(
  eslint-config-expo @react-native/eslint-config @eslint/eslintrc
  eslint-plugin-react-native eslint-plugin-react-native-a11y
  typescript
)
DEVDEPS=( "${CORE_DEVDEPS[@]}" )
[ "$STACK" = "react-next" ] && DEVDEPS+=( "${REACT_DEVDEPS[@]}" )
[ "$STACK" = "react-spa" ] && DEVDEPS+=( "${REACT_SPA_DEVDEPS[@]}" )
[ "$STACK" = "react-native" ] && DEVDEPS+=( "${REACT_NATIVE_DEVDEPS[@]}" )

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

DEPS_INSTALLED=""
_do_dep_install=""
if [ "$DRY_RUN" = "--dry-run" ]; then
  echo "▶ dev-deps → [dry-run] would offer to install ${#DEVDEPS[@]} dev-deps with $(detect_pm)"
elif [ ! -f "$PROJECT_ROOT/package.json" ]; then
  :   # no package.json to install into — nothing to do
elif [ -n "$FULL" ]; then
  _do_dep_install="yes"
elif [ -t 0 ]; then
  printf "▶ Install %s dev-dependencies now with %s? [y/N] " "${#DEVDEPS[@]}" "$(detect_pm)"
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
        # Unquoted so an empty value expands to no arg (bash 3.2 + `set -u` safe).
        if ( cd "$PROJECT_ROOT" && npm install --save-dev $NPM_PEER_FLAG "${DEVDEPS[@]}" ); then _ok="yes"; fi ;;
    esac
    if [ -n "$_ok" ]; then
      DEPS_INSTALLED="1"
      echo "  ✓ dev-dependencies installed → node_modules/ (wired hooks now have their tools)"
    else
      echo "  ⚠  dev-dep install failed — run it manually (see Next steps)."
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
