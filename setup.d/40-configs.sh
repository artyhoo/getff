#!/usr/bin/env bash
# setup.d/40-configs.sh — §4 Scripts + §5a Shared templates + §5b' ESLint rules + §6a Stack configs.
#
# Sources: lib.sh (already in dispatcher scope)
# S0 rows: §4 (install.sh:866-914), §5a (install.sh:916-994),
#          §5b' eslint-rules (install.sh:996-1060), §6a config subset (install.sh:1062-1123)
# Depends on: 30-templates (RULES.md etc. already at $PROJECT_ROOT/.ai-factory/)
# @cc-only-rationale: sourced by install.sh dispatcher, not standalone
# O9: intra-layer order: rule-files THEN barrel-gen; stryker copy THEN patch

# ─── 4. Scripts ─────────────────────────────────────────
echo "▶ Scripts → scripts/"
mkdir_safe "$PROJECT_ROOT/scripts"
copy_safe "$PKG_ROOT/packages/core/audit-self/audit-ai-docs.sh" "$PROJECT_ROOT/scripts/audit-ai-docs.sh"
chmod_safe +x "$PROJECT_ROOT/scripts/audit-ai-docs.sh" 2>/dev/null || true
# R4 probe (ts-morph) invoked by audit-ai-docs.sh via `npx tsx scripts/audit-r4.ts`.
copy_safe "$PKG_ROOT/packages/core/probes/audit-r4.ts" "$PROJECT_ROOT/scripts/audit-r4.ts"
# cih-s3 F3 "+V": glob-liveness gate — fails if a custom rule matches zero source files
# (silent-inertness alarm). Dependency-free bash; run pre-PR once the layout settles.
copy_safe "$PKG_ROOT/packages/core/audit-self/check-rule-globs.sh" "$PROJECT_ROOT/scripts/check-rule-globs.sh"
chmod_safe +x "$PROJECT_ROOT/scripts/check-rule-globs.sh" 2>/dev/null || true
# GH #535 "+E": deep R2-binding gate. check:globs only proves a rule's globs MATCH files; on a
# monorepo with per-package eslint configs that re-export a base NOT wiring R2, the rule stays
# silently inert while validate/lint pass. This gate resolves the actually-applied config per
# boundary file via `eslint --print-config` and FAILS when R2 is absent — catching that false-green
# without false-failing a correct re-export-of-root. Skips cleanly when eslint isn't installed yet.
copy_safe "$PKG_ROOT/packages/core/audit-self/check-rule-enforced.sh" "$PROJECT_ROOT/scripts/check-rule-enforced.sh"
chmod_safe +x "$PROJECT_ROOT/scripts/check-rule-enforced.sh" 2>/dev/null || true
# GH #547 Point 2: R2 boundary probe (C1) + the shared N/A-marker reader (C4). detect-r2-boundary.sh
# classifies the repo (boundary-present | no-boundary-confident | ambiguous) by READING it; the
# installer (§6b-bis below) and BOTH inertness gates consume it. r2-na-marker.sh is sourced by
# check-rule-globs.sh + check-rule-enforced.sh so they never diverge on honoring a recorded R2 N/A.
copy_safe "$PKG_ROOT/packages/core/audit-self/detect-r2-boundary.sh" "$PROJECT_ROOT/scripts/detect-r2-boundary.sh"
chmod_safe +x "$PROJECT_ROOT/scripts/detect-r2-boundary.sh" 2>/dev/null || true
copy_safe "$PKG_ROOT/packages/core/audit-self/r2-na-marker.sh" "$PROJECT_ROOT/scripts/r2-na-marker.sh"
chmod_safe +x "$PROJECT_ROOT/scripts/r2-na-marker.sh" 2>/dev/null || true
# GH #534: R3 (arch) inertness alarm — the dependency-cruiser analog of check:globs. The shipped
# arch config carries layout-agnostic monorepo boundary rules (packages↛apps / apps↔apps), but
# dependency-cruiser has no built-in "rule matched nothing" report, so on a monorepo whose arch
# config lacks those rules, arch:check passes green while the boundary is unguarded — silently.
# This gate FAILS on an apps/+packages/ monorepo when no packages↛apps rule is present.
copy_safe "$PKG_ROOT/packages/core/audit-self/check-arch-boundaries.sh" "$PROJECT_ROOT/scripts/check-arch-boundaries.sh"
chmod_safe +x "$PROJECT_ROOT/scripts/check-arch-boundaries.sh" 2>/dev/null || true
# cih-s3 F14: lint-staged binary-resolution gate — fails if a .lintstagedrc command's binary
# can't resolve from the cwd lint-staged would use (the ENOENT-before-commit alarm on monorepos).
copy_safe "$PKG_ROOT/packages/core/audit-self/check-lintstaged-resolves.sh" "$PROJECT_ROOT/scripts/check-lintstaged-resolves.sh"
chmod_safe +x "$PROJECT_ROOT/scripts/check-lintstaged-resolves.sh" 2>/dev/null || true
# install-self-verification D1: fences-fire gate — prove installed ESLint rules FIRE on bad input.
# Uses f17 proven technique (ESLint Linter API via tsx, not CLI). Consumer runs:
#   npm run check:fences-fire  (wired in setup.d/70-deps.sh + validate aggregate).
copy_safe "$PKG_ROOT/packages/core/audit-self/check-fences-fire.sh" "$PROJECT_ROOT/scripts/check-fences-fire.sh"
chmod_safe +x "$PROJECT_ROOT/scripts/check-fences-fire.sh" 2>/dev/null || true
# Fixtures subtree: bad/good paired inputs per fence + manifest declaring expected rule-id.
copy_safe "$PKG_ROOT/packages/core/audit-self/fixtures/fences-fire" "$PROJECT_ROOT/scripts/fences-fire-fixtures"
# install-self-verification D2: shields-up gate — prove Husky hooks are wired and active.
# Checks core.hooksPath=.husky, pre-commit/pre-push present+executable+referencing gate commands.
copy_safe "$PKG_ROOT/packages/core/audit-self/check-shields-up.sh" "$PROJECT_ROOT/scripts/check-shields-up.sh"
chmod_safe +x "$PROJECT_ROOT/scripts/check-shields-up.sh" 2>/dev/null || true
# install-self-verification D5: on-demand local mutation depth pass for generated rules.
# Consumer surface: npm run test:mutation:generated (not in validate — on-demand only).
copy_safe "$PKG_ROOT/packages/core/synthesizer/run-generated-rule-mutation.sh" "$PROJECT_ROOT/scripts/run-generated-rule-mutation.sh"
chmod_safe +x "$PROJECT_ROOT/scripts/run-generated-rule-mutation.sh" 2>/dev/null || true
# rule-tests-surface S5: standing firing check for the non-npm enrichment-sidecar test material
# (.ai-factory/rule-tests/<backend>.json). Invoked by the guarded consumer pre-push arm
# (packages/core/hooks/pre-push.ts generatedRuleMaterialSection); also runnable on demand.
copy_safe "$PKG_ROOT/packages/core/synthesizer/run-rule-tests-firing.sh" "$PROJECT_ROOT/scripts/run-rule-tests-firing.sh"
chmod_safe +x "$PROJECT_ROOT/scripts/run-rule-tests-firing.sh" 2>/dev/null || true
# pre-merge-carrier B1 (#1466/#1465): opt-in local pre-merge carrier + CI-state probe.
# Delivered to ALL profiles (F1: core consumers hit the Actions-minutes wall identically);
# delivery is file-landing ONLY — nothing wires these into hooks/validate/CI (W-3 opt-in;
# default-on promotion is B3's trigger-gated decision, never an implementation detail).
copy_safe "$PKG_ROOT/packages/core/audit-self/pre-merge-local.sh" "$PROJECT_ROOT/scripts/pre-merge-local.sh"
chmod_safe +x "$PROJECT_ROOT/scripts/pre-merge-local.sh" 2>/dev/null || true
copy_safe "$PKG_ROOT/packages/core/audit-self/ci-available-probe.sh" "$PROJECT_ROOT/scripts/ci-available-probe.sh"
chmod_safe +x "$PROJECT_ROOT/scripts/ci-available-probe.sh" 2>/dev/null || true
if [ "$STACK" = "react-next" ]; then
  copy_safe "$PKG_ROOT/packages/preset-next-15-canonical/audit-self/audit-ai-docs.react-next.sh" "$PROJECT_ROOT/scripts/audit-ai-docs.react-next.sh"
  chmod_safe +x "$PROJECT_ROOT/scripts/audit-ai-docs.react-next.sh" 2>/dev/null || true
  # Storybook scaffold: the shipped react-next ci.yml has a test-storybook job that needs a
  # .storybook config to build. Static template copy (SB 10.x, @storybook/nextjs-vite) replaces
  # retired setup.sh Batch K's `npx storybook init` (#946) — no network; copy_safe honours
  # --dry-run/--force and never overwrites a consumer's existing files. Deps + scripts: 70-deps.
  mkdir_safe "$PROJECT_ROOT/.storybook"
  copy_safe "$PKG_ROOT/packages/core/templates/react-next/.storybook/main.ts" "$PROJECT_ROOT/.storybook/main.ts"
  copy_safe "$PKG_ROOT/packages/core/templates/react-next/.storybook/preview.ts" "$PROJECT_ROOT/.storybook/preview.ts"
fi
if [ "$STACK" = "react-spa" ]; then
  copy_safe "$PKG_ROOT/packages/preset-react-spa/audit-self/audit-ai-docs.react-spa.sh" "$PROJECT_ROOT/scripts/audit-ai-docs.react-spa.sh"
  chmod_safe +x "$PROJECT_ROOT/scripts/audit-ai-docs.react-spa.sh" 2>/dev/null || true
fi
if [ "$STACK" = "react-native" ]; then
  copy_safe "$PKG_ROOT/packages/preset-react-native/audit-self/audit-ai-docs.react-native.sh" "$PROJECT_ROOT/scripts/audit-ai-docs.react-native.sh"
  chmod_safe +x "$PROJECT_ROOT/scripts/audit-ai-docs.react-native.sh" 2>/dev/null || true
fi

# ─── 5. Shared templates ────────────────────────────────
echo "▶ Shared templates → project root"
copy_safe "$PKG_ROOT/packages/core/templates/shared/.nvmrc" "$PROJECT_ROOT/.nvmrc"
# first-commit-passable (issue 1528): ship a .gitignore seed. Source name is DOTLESS — npm pack
# drops a dotted .gitignore from the tarball (measured 2026-09-02), so a dotted source would be
# missing on the npm delivery channel and copy_safe would fail. Without a seed, a gitignore-less
# consumer stages node_modules/ on `git add -A` and lint-staged v16 per-directory config
# discovery then executes vendored configs under node_modules/. copy_safe = a consumer's own
# .gitignore always wins (Layer-2) — warned below, never edited.
copy_safe "$PKG_ROOT/packages/core/templates/shared/gitignore" "$PROJECT_ROOT/.gitignore"
if _prettierignore_in_skipped "$PROJECT_ROOT/.gitignore" && ! grep -q 'node_modules' "$PROJECT_ROOT/.gitignore" 2>/dev/null; then
  echo "  ⚠ .gitignore exists without a node_modules line — 'git add -A' will stage node_modules/. Consider adding node_modules/ to .gitignore (file left untouched)." >&2
fi
copy_safe "$PKG_ROOT/packages/core/templates/shared/.lintstagedrc.json" "$PROJECT_ROOT/.lintstagedrc.json"
# cih-s3 F14 (M3): in a workspace, a single root .lintstagedrc runs `eslint` from git-root; in
# a pnpm/isolated-node_modules monorepo the per-package eslint binary isn't at root → ENOENT
# blocks the commit. Drop a per-package .lintstagedrc.json stub in each EXISTING package dir so
# lint-staged runs with cwd=that package and resolves the local binary. PM-agnostic (no
# `pnpm exec`). Best-effort — packages added later need the same stub; scripts/check-lintstaged-
# resolves.sh is the alarm that catches an unstubbed package before its first blocked commit.
if [ "$DRY_RUN" != "--dry-run" ] && { [ -f "$PROJECT_ROOT/pnpm-workspace.yaml" ] || grep -q '"workspaces"' "$PROJECT_ROOT/package.json" 2>/dev/null; }; then
  _ndrop=0
  while IFS= read -r _pkgjson; do
    _pkgdir=$(dirname "$_pkgjson")
    [ "$_pkgdir" = "$PROJECT_ROOT" ] && continue
    if [ ! -f "$_pkgdir/.lintstagedrc.json" ]; then
      cp "$PROJECT_ROOT/.lintstagedrc.json" "$_pkgdir/.lintstagedrc.json" && _ndrop=$((_ndrop + 1))
    fi
  done < <(find "$PROJECT_ROOT" -name node_modules -prune -o -name .git -prune -o -name package.json -print 2>/dev/null)
  echo "  ✓ workspace detected → dropped $_ndrop per-package .lintstagedrc.json stub(s) (F14 lint-staged cwd fix)"
fi
# cih-s3 F15: keep prettier off the generated RULES.md table region (rendered SSOT, not
# format-stable) so a `*.md → prettier --write` lint-staged step can't reflow it.
# GH #531 (reopen): merge (not skip-if-exists) so a BROWNFIELD consumer with its own
# .prettierignore still gets the AIF exclusions — otherwise the generated RULES.md re-breaks
# `prettier --check .`. Greenfield path stays byte-identical (delegates to copy_safe).
merge_prettierignore "$PKG_ROOT/packages/core/templates/shared/.prettierignore" "$PROJECT_ROOT/.prettierignore"
# GH #531: ship the Prettier config so the consumer's `format:check` (prettier --check .) uses the
# same style the shipped artefacts are formatted in (singleQuote — the framework's existing TS/JS
# style). Without it, prettier defaults (double-quote) would flag every shipped .ts/.mjs/.cjs.
# copy_safe (skip-if-exists) never clobbers a consumer's own prettier config.
copy_safe "$PKG_ROOT/.prettierrc.json" "$PROJECT_ROOT/.prettierrc.json"
copy_safe "$PKG_ROOT/packages/core/templates/shared/tsconfig.json" "$PROJECT_ROOT/tsconfig.json"

# ─── 5a. tests/setup.ts delivery gate (first-commit-passable, issue 1530) ───
# vitest.config.ts declares setupFiles: ['./tests/setup.ts'] on ts-server / react-spa /
# react-next, but nothing shipped the file → `npx vitest run` dies with "Cannot find module".
# The file may only ship when the consumer tsconfig covers it: typescript-eslint projectService
# raises a hard parse error for a staged file no tsconfig includes, so delivering it anyway
# would keep the install commit un-passable even after the --no-warn-ignored fix (issue 1529).
# Covered ⇔ the installer wrote tsconfig.json itself (not in SKIPPED), OR the tsconfig has NO
# include key (tsc default = whole tree), OR some include entry starts with "tests".
# Unreadable/JSONC tsconfig → fail-OPEN: treat covered, no note, never abort the layer.
fc3_deliver_tests_setup() {
  local src="$1"
  local covered=0
  if ! _prettierignore_in_skipped "$PROJECT_ROOT/tsconfig.json"; then
    covered=1   # greenfield (or --force refresh): installer wrote tsconfig.json
  elif [ ! -f "$PROJECT_ROOT/tsconfig.json" ]; then
    covered=1   # no tsconfig on disk → tsc default (whole tree)
  elif ! command -v node >/dev/null 2>&1; then
    covered=1   # fail-OPEN: node-free install cannot read JSON (same posture as detect_pm)
  else
    local _rc=0
    AIF_FCP_TSCONFIG="$PROJECT_ROOT/tsconfig.json" node -e '
      try {
        const c = JSON.parse(require("fs").readFileSync(process.env.AIF_FCP_TSCONFIG, "utf8"));
        if (!Array.isArray(c.include)) process.exit(3); // no include key → whole tree
        if (c.include.some((e) => String(e).startsWith("tests"))) process.exit(0);
        process.exit(1); // include present, nothing covers tests/
      } catch { process.exit(2); } // unreadable/JSONC → fail-open
    ' 2>/dev/null || _rc=$?
    case $_rc in
      1) covered=0 ;;
      *) covered=1 ;;
    esac
  fi
  if [ "$covered" -eq 1 ]; then
    copy_safe "$src" "$PROJECT_ROOT/tests/setup.ts"
  else
    echo "  ⚠ tsconfig.json include does not cover tests/ — tests/setup.ts NOT delivered (staging it would fail the install commit). Add \"tests/**/*\" to tsconfig include and re-run install, or create tests/setup.ts yourself." >&2
  fi
}

# ─── 5b'. Custom ESLint rules plugin (used by eslint.config.mjs) ───
# O9: copy rule files THEN generate barrel (intra-layer order).
echo "▶ Custom ESLint rules → eslint-rules-local/"
mkdir_safe "$PROJECT_ROOT/eslint-rules-local"
# Ship a rule as PRE-COMPILED artifacts (Variant A / fix #752): copy the committed
# `.mjs` (runtime, ESM-by-extension — loads on every Node, no TS loader) + `.d.ts`
# (types) + `.ts` (authoring source, kept for reference). The consumer needs NO `tsc`
# at install — compilation happened at framework build (scripts/build-shipped-eslint-rules.sh).
# This replaces #745's compile-at-install, which silently broke when the consumer lacked
# `tsc` (wrong search paths + typescript not in dev-deps) → "green lies" (#752).
_copy_rule() {  # $1 = source .ts path
  local src="$1" stem bn
  stem="${src%.ts}"; bn="$(basename "$stem")"
  copy_safe "$src" "$PROJECT_ROOT/eslint-rules-local/$bn.ts"
  [ -f "$stem.mjs" ]  && copy_safe "$stem.mjs"  "$PROJECT_ROOT/eslint-rules-local/$bn.mjs"
  [ -f "$stem.d.ts" ] && copy_safe "$stem.d.ts" "$PROJECT_ROOT/eslint-rules-local/$bn.d.ts"
}
# Generic rules (core): no-direct-time-randomness, no-unsafe-zod-parse, require-otel-span, restricted-syntax-audit-exempt
for f in "$PKG_ROOT"/packages/core/eslint-rules/*.ts; do
  case "$f" in
    *.test.ts) continue ;;
    *.d.ts) continue ;;
    */index.ts) continue ;;
  esac
  _copy_rule "$f"
done
if [ "$STACK" = "react-next" ]; then
  # Stack-specific rules (preset): no-server-imports-in-client, require-form-safe-parse, require-use-server-directive
  for f in "$PKG_ROOT"/packages/preset-next-15-canonical/eslint-rules/*.ts; do
    case "$f" in
      *.test.ts) continue ;;
      *.d.ts) continue ;;
      */index.ts) continue ;;
    esac
    _copy_rule "$f"
  done
fi
if [ "$STACK" = "react-spa" ]; then
  # Stack-specific rules (preset): require-error-boundary
  for f in "$PKG_ROOT"/packages/preset-react-spa/eslint-rules/*.ts; do
    case "$f" in
      *.test.ts) continue ;;
      *.d.ts) continue ;;
      */index.ts) continue ;;
    esac
    _copy_rule "$f"
  done
fi

# Generate the index.mjs barrel that eslint.config.mjs imports (`./eslint-rules-local/index.mjs`).
# Variant A / fix #752: the rule `.mjs` + `.d.ts` are ALREADY pre-compiled at framework build
# (scripts/build-shipped-eslint-rules.sh) and shipped above by `_copy_rule` — install does NO
# compilation, so the consumer needs NO `tsc`. This is the fix for #745's compile-at-install,
# which silently broke when the consumer lacked tsc (wrong search paths + typescript not in
# dev-deps) → barrel imported non-existent `.mjs` → enforcement dead while CI stayed green.
#
# FQA S1-A W1: install copied the rule FILES but the copy loop skips `*/index.ts`, so the
# barrel never landed → eslint hit a missing-module error on config load → ALL custom rules
# (and all linting) died. Generated from whatever rule files landed above, so it always matches
# the shipped set with zero template-drift.
# Convention (holds for all rules): file `foo-bar.ts` exports `fooBar`; rule key = `foo-bar`.

# Generate index.mjs barrel (unambiguous ESM — no TS loader, no package.json "type" dep) + prune
# stack-absent #838 fences-fire fixtures. Logic lives in ONE place (generate_eslint_barrel,
# setup.d/lib.sh) so both this copy path and do_refresh's refresh path (#876) call the same code.
generate_eslint_barrel

# ─── 6. Stack-specific templates ────────────────────────
# O9: stryker copy THEN patch (intra-layer order).
mkdir_safe "$PROJECT_ROOT/.github/workflows"

# §13.5 I-2 L2: per-workspace eslint.config.mjs placement (SSOT #182).
# P0.3 (ultrareview): _resolve_workspace_stacks (lib.sh) wraps the pure _detect_stacks_per_workspace
# map and applies the config-placement precedence (own signal > explicit positional STACK arg > root
# package.json signal > unknown), echoing "dir<TAB>stack<TAB>provenance" per workspace and nothing
# for flat / single-root repos — the empty-output case falls through to the single-root path below,
# preserving the original single-stack behavior unchanged (no regression). Root fallback is what fixes
# the pnpm-hoisting case (shared `typescript` hoisted to root → every workspace's own package.json is
# signal-free → `unknown`), which previously placed ZERO configs and silently exited 0.
_ws_lines=$(_resolve_workspace_stacks "$PROJECT_ROOT")
if [ -n "$_ws_lines" ]; then
  # ── Multi-stack monorepo: place per-workspace eslint configs + eslint-rules-local stubs ──────
  echo "▶ Multi-stack monorepo: placing per-workspace ESLint configs"
  _ws_placed=0            # count of workspaces that received a config (aggregate loud-fail gate below)
  _ws_unknown_report=""   # accumulate still-unknown workspaces to name in the loud-fail message
  # #931 PR-2: per-workspace Stryker mutation config, emitted alongside the eslint placement
  # below (Global Constraints 1/3/4/6 — design plan). mkdir ONCE unconditionally, mirroring the
  # unconditional mkdir_safe style already used in this file (e.g. scripts/, eslint-rules-local/)
  # rather than a lazily-created dir — harmless when zero workspaces qualify (the wrapper globs
  # stryker/*.json and skips gracefully on empty). Node-optional: the emit is a Node string
  # substitution (consistent with patch_stryker_package_manager below); if node is absent, skip
  # emission entirely with one WARN rather than per-workspace spam or a crash.
  mkdir_safe "$PROJECT_ROOT/stryker"
  _stryker_node_ok=0
  command -v node >/dev/null 2>&1 && _stryker_node_ok=1
  [ "$_stryker_node_ok" -eq 1 ] || echo "  ⚠ node not found — skipping per-workspace Stryker config emit (wire stryker/<workspace>.json manually per INSTALL.md)" >&2
  # M2 fix (dual-review): packageManager mirrors the flat branch's patch_stryker_package_manager
  # instead of the template's hardcoded "npm" — computed ONCE (repo-global signal, detect_pm SSOT),
  # reused for every per-workspace emit below.
  _stryker_pm=$(detect_pm)
  while IFS=$'\t' read -r _ws_dir _ws_stack _ws_prov; do
    [ -n "$_ws_dir" ] || continue
    _ws_abs="$PROJECT_ROOT/$_ws_dir"
    # Provenance suffix: show WHY this workspace got its stack (own signal is silent; the fallbacks
    # announce themselves so a hoisting monorepo's install output is self-explaining).
    case "$_ws_prov" in
      explicit-arg)  _ws_prov_note=" (explicit stack arg)" ;;
      root-fallback) _ws_prov_note=" (root package.json fallback)" ;;
      *)             _ws_prov_note="" ;;
    esac
    echo "▶ Per-workspace config: $_ws_dir → $_ws_stack preset$_ws_prov_note"
    mkdir_safe "$_ws_abs"

    # #931 PR-2: per-workspace Stryker config — targets this workspace's EXISTING vitest config
    # + tsconfig.json (Global Constraint 4: never creates them). Detection order vitest.config.ts
    # → .mts → .js (same constraint). Missing either → skip with a re-checkable stderr marker,
    # never exit 1 (mirrors the `unknown` stack marker below in the eslint case block).
    # I2/A2 fix (dual-review): HOISTED above the eslint stack `case` (was previously positioned
    # after it, so the `unknown)` arm's `continue` skipped this block entirely for a workspace
    # with vitest+tsconfig but no ESLint stack signal — GC4 conditions emit on vitest+tsconfig
    # ONLY, stack-independent). Running this unconditionally per workspace, before the case,
    # makes the emit reachable regardless of the workspace's ESLint stack classification.
    if [ "$_stryker_node_ok" -eq 1 ]; then
      _stryker_vcfg=""
      for _svc in vitest.config.ts vitest.config.mts vitest.config.js; do
        [ -f "$_ws_abs/$_svc" ] && _stryker_vcfg="$_svc" && break
      done
      if [ -n "$_stryker_vcfg" ] && [ -f "$_ws_abs/tsconfig.json" ]; then
        _ws_slug=$(printf '%s' "$_ws_dir" | tr '/' '-')
        _stryker_dst="$PROJECT_ROOT/stryker/$_ws_slug.json"
        # C1/A3 fix (dual-review): mirror copy_safe's WRITE guard (setup.d/lib.sh:79 — precedent
        # rewrite_arch_sot_header, lib.sh:151-156) so a consumer's hand-tuned per-package config
        # is never silently clobbered on re-install.
        if [ -e "$_stryker_dst" ] && [ "$FORCE" != "--force" ]; then
          SKIPPED+=("$_stryker_dst")
          if [ "$DRY_RUN" = "--dry-run" ]; then
            echo "  [dry-run] would skip: stryker/$_ws_slug.json (exists)"
          else
            echo "  ⊝ stryker/$_ws_slug.json (exists — skipping; use --force to overwrite)"
          fi
        elif [ "$DRY_RUN" = "--dry-run" ]; then
          echo "  [dry-run] would emit: stryker/$_ws_slug.json"
        else
          AIF_STRYKER_TMPL="$PKG_ROOT/templates/ts-server/stryker.package.json.tmpl" \
          AIF_STRYKER_OUT="$_stryker_dst" \
          AIF_WS_DIR="$_ws_dir" \
          AIF_WS_SLUG="$_ws_slug" \
          AIF_VITEST_CFG="$_ws_dir/$_stryker_vcfg" \
          AIF_PACKAGE_MANAGER="$_stryker_pm" \
          node -e '
            const fs = require("fs");
            const tmpl = fs.readFileSync(process.env.AIF_STRYKER_TMPL, "utf8");
            // M3 fix (dual-review): escape backslash/quote so a substituted value (workspace dir,
            // vitest config path, slug) cannot corrupt the emitted JSON — both characters are
            // filesystem-legal even though rare in practice.
            const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
            const out = tmpl
              .split("__WS_DIR__").join(esc(process.env.AIF_WS_DIR))
              .split("__VITEST_CONFIG__").join(esc(process.env.AIF_VITEST_CFG))
              .split("__WS_SLUG__").join(esc(process.env.AIF_WS_SLUG))
              .split("__PACKAGE_MANAGER__").join(esc(process.env.AIF_PACKAGE_MANAGER));
            fs.writeFileSync(process.env.AIF_STRYKER_OUT, out);
          '
          echo "  ✓ stryker/$_ws_slug.json (vitest: $_ws_dir/$_stryker_vcfg, tsconfig: $_ws_dir/tsconfig.json)"
        fi
      else
        echo "  ⚠ $_ws_dir: no vitest config (tried vitest.config.ts/.mts/.js) or no tsconfig.json — Stryker config NOT emitted for this workspace (re-checkable marker; not exit 1)" >&2
      fi
    fi

    case "$_ws_stack" in
      ts-server)
        copy_safe "$PKG_ROOT/templates/ts-server/eslint.config.mjs" "$_ws_abs/eslint.config.mjs"
        _ws_placed=$((_ws_placed + 1))
        ;;
      react-next)
        copy_safe "$PKG_ROOT/packages/preset-next-15-canonical/templates/eslint.config.react.mjs" "$_ws_abs/eslint.config.mjs"
        _ws_placed=$((_ws_placed + 1))
        ;;
      react-spa)
        copy_safe "$PKG_ROOT/packages/preset-react-spa/templates/eslint.config.react.mjs" "$_ws_abs/eslint.config.mjs"
        _ws_placed=$((_ws_placed + 1))
        ;;
      react-native)
        # RN ships TWO baselines + a shared base; detect Expo vs bare-RN per workspace package.json.
        if grep -qE '"expo"[[:space:]]*:' "$_ws_abs/package.json" 2>/dev/null; then
          _rn_eslint="eslint.config.expo.mjs"
        else
          _rn_eslint="eslint.config.bare-rn.mjs"
        fi
        copy_safe "$PKG_ROOT/packages/preset-react-native/templates/$_rn_eslint" "$_ws_abs/eslint.config.mjs"
        copy_safe "$PKG_ROOT/packages/preset-react-native/templates/eslint.config.rn-common.mjs" "$_ws_abs/eslint.config.rn-common.mjs"
        _ws_placed=$((_ws_placed + 1))
        ;;
      unknown)
        # Still-unknown after own + explicit-arg + root fallback: KEEP as a re-checkable marker per
        # the §13.5 fork-2 default (never a PER-workspace exit 1). The AGGREGATE all-unknown case is
        # caught by the loud-fail after the loop — a silent zero-config install is the observed DoS.
        echo "  ⚠ $_ws_dir: unknown stack (own package.json, explicit arg, and root package.json all signal-free) — no eslint config placed (re-checkable marker; not exit 1)"
        _ws_unknown_report="${_ws_unknown_report}     - ${_ws_dir} (unknown — no dependency signal)\n"
        continue
        ;;
    esac
    # Per-workspace eslint-rules-local stub: preset templates import './eslint-rules-local/index.mjs'
    # relative to the config's dir. Workspaces are always 2 levels deep (container/name, enforced by
    # _workspace_pkg_dirs) → 3 levels of '../' reliably reach the project root's eslint-rules-local/.
    mkdir_safe "$_ws_abs/eslint-rules-local"
    if [ -z "$DRY_RUN" ]; then
      printf '// Auto-generated by install.sh — re-exports the root eslint-rules-local plugin.\n// Workspace is always container/name (2 levels deep) so 3 "../" reaches project root.\nexport { default, rules } from '"'"'../../../eslint-rules-local/index.mjs'"'"';\n' \
        > "$_ws_abs/eslint-rules-local/index.mjs"
      echo "  ✓ $_ws_dir/eslint-rules-local/index.mjs stub → root"
    fi
  done <<< "$_ws_lines"
  # P0.3 (ultrareview) AGGREGATE loud-fail: the multi-stack path ran but placed ZERO configs — every
  # workspace stayed `unknown` after own-signal + explicit-arg + root-fallback. A silent zero-config
  # install is the observed commit-DoS (lint finds no eslint config → crashes rc=2 → pre-commit blocks
  # EVERY commit while the installer exits 0). Fail LOUD and instructively instead. Distinct from the
  # per-workspace `unknown` marker default above: this is the whole-repo no-config-anywhere case.
  if [ "$_ws_placed" -eq 0 ]; then
    {
      echo ""
      echo "❌ Multi-stack monorepo: ZERO per-workspace ESLint configs were placed."
      echo "   Every workspace classified 'unknown' — no dependency signal in its own package.json,"
      echo "   no explicit stack arg, and the root package.json carries no stack signal either:"
      printf '%b' "$_ws_unknown_report"
      echo "   A zero-config install would make 'lint' crash (rc=2) and block EVERY commit."
      echo "   Re-run naming your stack explicitly so signal-free workspaces inherit it, e.g.:"
      echo "     ./setup ts-server        # or react-next | react-spa | react-native"
    } >&2
    exit 1
  fi
  # GH #807: the multi-stack branch placed per-workspace ESLint configs but no root
  # .dependency-cruiser.cjs, so `arch:check` (depcruise --config .dependency-cruiser.cjs) exited 1
  # and validate went RED. Unlike ESLint's per-config (nearest-config) scoping, dependency-cruiser
  # is a REPO-WIDE arch tool that crawls from src/ — it is naturally root-level. Place it ONCE at
  # root, AFTER the per-workspace loop (NOT inside it — that would copy_safe to the same root path N
  # times). Mirrors the flat-path placement at the ts-server/react-* branches below. (kickoff ⚑M2)
  copy_safe "$PKG_ROOT/templates/ts-server/dependency-cruiser.cjs" "$PROJECT_ROOT/.dependency-cruiser.cjs"
  # #931 PR-2: the test:mutation runner for the per-workspace stryker/*.json configs emitted
  # above. Placed ONCE after the loop (mirrors the .dependency-cruiser.cjs placement immediately
  # above — not inside the per-workspace loop, which would copy_safe to the same root path N
  # times). setup.d/70-deps.sh wires "test:mutation" to this script on monorepo detection.
  copy_safe "$PKG_ROOT/templates/ts-server/run-mutation.sh.tmpl" "$PROJECT_ROOT/scripts/run-mutation.sh"
  chmod_safe +x "$PROJECT_ROOT/scripts/run-mutation.sh" 2>/dev/null || true
else
  # ── Flat / single-root repo: original single-stack behavior unchanged ──────────────────────────
  echo "▶ Stack-specific templates ($STACK) → project root"
  if [ "$STACK" = "ts-server" ]; then
    copy_safe "$PKG_ROOT/templates/ts-server/eslint.config.mjs" "$PROJECT_ROOT/eslint.config.mjs"
    copy_safe "$PKG_ROOT/templates/ts-server/vitest.config.ts" "$PROJECT_ROOT/vitest.config.ts"
    fc3_deliver_tests_setup "$PKG_ROOT/templates/ts-server/tests-setup.ts"
    # Ship the arch config directly (FQA S1-A W2: deferring to legacy setup.sh left arch:check
    # with no config on the ./setup path — the template exists, just copy it).
    copy_safe "$PKG_ROOT/templates/ts-server/dependency-cruiser.cjs" "$PROJECT_ROOT/.dependency-cruiser.cjs"
    copy_safe "$PKG_ROOT/templates/ts-server/stryker.config.json" "$PROJECT_ROOT/stryker.config.json"
    patch_stryker_package_manager
    # getff-honest-signals S4 — deliver via deliver_getff_workflow so the consumer's actual
    # default branch is substituted for the template's hard-coded `main` at install time.
    # Byte-identical when (a) default IS main, or (b) detection fails (PARK Option A — see
    # helper docstring in setup.d/lib.sh).
    deliver_getff_workflow "$PKG_ROOT/templates/ts-server/github-actions-ci.yml" "$PROJECT_ROOT/.github/workflows/ci.yml"
    # R11 branch-protection self-assertion (the executable arm RULES.md#r11 names alongside ci-success).
    # workflow-integrity.yml carries one `branches: [main]` on its push: arm — same defect class,
    # narrower observable impact (PR arm has no branch filter, runtime assertion already uses
    # github.event.repository.default_branch dynamically). Routed through the same substitution
    # for symmetry; a push to a non-main default touching .github/workflows/** now triggers it.
    deliver_getff_workflow "$PKG_ROOT/templates/ts-server/github-actions-workflow-integrity.yml" "$PROJECT_ROOT/.github/workflows/workflow-integrity.yml"
  elif [ "$STACK" = "react-next" ]; then
    copy_safe "$PKG_ROOT/packages/preset-next-15-canonical/templates/eslint.config.react.mjs" "$PROJECT_ROOT/eslint.config.mjs"
    copy_safe "$PKG_ROOT/packages/preset-next-15-canonical/templates/vitest.config.ts" "$PROJECT_ROOT/vitest.config.ts"
    fc3_deliver_tests_setup "$PKG_ROOT/packages/preset-next-15-canonical/templates/tests-setup.ts"
    copy_safe "$PKG_ROOT/packages/preset-next-15-canonical/templates/playwright.config.ts" "$PROJECT_ROOT/playwright.config.ts"
    # Ship the arch config (FQA S1-A W2). The ts-server base (no-circular/no-orphans) is
    # stack-agnostic; a react-tailored layering config is a follow-up (residual R-1).
    copy_safe "$PKG_ROOT/templates/ts-server/dependency-cruiser.cjs" "$PROJECT_ROOT/.dependency-cruiser.cjs"
    copy_safe "$PKG_ROOT/templates/ts-server/stryker.config.json" "$PROJECT_ROOT/stryker.config.json"
    patch_stryker_package_manager
    # getff-honest-signals S4 — deliver_getff_workflow substitutes the consumer's actual
    # default branch for the template's hard-coded `main` (kickoff §2 item 2 — class sweep).
    deliver_getff_workflow "$PKG_ROOT/packages/preset-next-15-canonical/templates/github-actions-ci-ui.yml" "$PROJECT_ROOT/.github/workflows/ci.yml"
    # R11 branch-protection self-assertion (stack-agnostic — asserts ci-success stays required).
    deliver_getff_workflow "$PKG_ROOT/templates/ts-server/github-actions-workflow-integrity.yml" "$PROJECT_ROOT/.github/workflows/workflow-integrity.yml"
  elif [ "$STACK" = "react-spa" ]; then
    copy_safe "$PKG_ROOT/packages/preset-react-spa/templates/eslint.config.react.mjs" "$PROJECT_ROOT/eslint.config.mjs"
    copy_safe "$PKG_ROOT/packages/preset-react-spa/templates/vitest.config.ts" "$PROJECT_ROOT/vitest.config.ts"
    fc3_deliver_tests_setup "$PKG_ROOT/packages/preset-react-spa/templates/tests-setup.ts"
    copy_safe "$PKG_ROOT/packages/preset-react-spa/templates/playwright.config.ts" "$PROJECT_ROOT/playwright.config.ts"
    # Ship the arch config (FQA S1-A W2). The ts-server base (no-circular/no-orphans) is
    # stack-agnostic; SPA layering (Feature-Sliced Design) is enforced by eslint-plugin-boundaries
    # in the shipped eslint.config, so dependency-cruiser stays the universal base here.
    copy_safe "$PKG_ROOT/templates/ts-server/dependency-cruiser.cjs" "$PROJECT_ROOT/.dependency-cruiser.cjs"
    copy_safe "$PKG_ROOT/templates/ts-server/stryker.config.json" "$PROJECT_ROOT/stryker.config.json"
    patch_stryker_package_manager
    # getff-honest-signals S4 — deliver_getff_workflow substitutes the consumer's actual
    # default branch for the template's hard-coded `main` (kickoff §2 item 2 — class sweep).
    deliver_getff_workflow "$PKG_ROOT/packages/preset-react-spa/templates/github-actions-ci-ui.yml" "$PROJECT_ROOT/.github/workflows/ci.yml"
    # R11 branch-protection self-assertion (stack-agnostic — asserts ci-success stays required).
    deliver_getff_workflow "$PKG_ROOT/templates/ts-server/github-actions-workflow-integrity.yml" "$PROJECT_ROOT/.github/workflows/workflow-integrity.yml"
  elif [ "$STACK" = "react-native" ]; then
    # RN ships TWO baselines (Expo vs bare-RN) + a shared base BOTH import. Pick the baseline by
    # detecting the consumer's deps (`"expo"` present → Expo baseline; else bare-RN), then ALWAYS land
    # the shared eslint.config.rn-common.mjs — both baselines `import './eslint.config.rn-common.mjs'`,
    # so omitting it would dangle the import and crash the consumer's ESLint on config load.
    if grep -qE '"expo"[[:space:]]*:' "$PROJECT_ROOT/package.json" 2>/dev/null; then
      _rn_eslint="eslint.config.expo.mjs"
    else
      _rn_eslint="eslint.config.bare-rn.mjs"
    fi
    copy_safe "$PKG_ROOT/packages/preset-react-native/templates/$_rn_eslint" "$PROJECT_ROOT/eslint.config.mjs"
    copy_safe "$PKG_ROOT/packages/preset-react-native/templates/eslint.config.rn-common.mjs" "$PROJECT_ROOT/eslint.config.rn-common.mjs"
    copy_safe "$PKG_ROOT/packages/preset-react-native/templates/vitest.config.ts" "$PROJECT_ROOT/vitest.config.ts"
    # RN is native / web-less → NO playwright (E2E is Detox/Maestro, not wired by install).
    # Ship the arch config (stack-agnostic ts-server base: no-circular/no-orphans).
    copy_safe "$PKG_ROOT/templates/ts-server/dependency-cruiser.cjs" "$PROJECT_ROOT/.dependency-cruiser.cjs"
    copy_safe "$PKG_ROOT/templates/ts-server/stryker.config.json" "$PROJECT_ROOT/stryker.config.json"
    patch_stryker_package_manager
    # getff-honest-signals S4 — deliver_getff_workflow substitutes the consumer's actual
    # default branch for the template's hard-coded `main` (kickoff §2 item 2 — class sweep).
    deliver_getff_workflow "$PKG_ROOT/packages/preset-react-native/templates/github-actions-ci-ui.yml" "$PROJECT_ROOT/.github/workflows/ci.yml"
    # R11 branch-protection self-assertion (stack-agnostic — asserts ci-success stays required).
    deliver_getff_workflow "$PKG_ROOT/templates/ts-server/github-actions-workflow-integrity.yml" "$PROJECT_ROOT/.github/workflows/workflow-integrity.yml"
  fi
fi
