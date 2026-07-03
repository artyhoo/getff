#!/usr/bin/env bash
# setup.d/99-finalize.sh — synth-wire + R2 AST-wire + V2 otel WARN + ignore_shipped_configs + Done.
#
# Sources: lib.sh (already in dispatcher scope)
# S0 rows: R2-L2 (install.sh:1597-1641), otel (install.sh:1643-1657),
#          ignore_shipped_configs CALL (install.sh:1659-1661), Done (install.sh:1663-1705)
# Depends on: 70-deps (ts-morph installed; DEPS_INSTALLED + DEVDEPS set),
#             60-ci (_r2_verdict set), ALL prior layers (SKIPPED fully accumulated)
# @cc-only-rationale: sourced by install.sh dispatcher, not standalone
# O3: HIGHEST-RISK ordering item — must run AFTER 70-deps (ts-morph) and LAST (SKIPPED complete)
# O2: reads _r2_verdict (from 60-ci) + DEPS_INSTALLED + DEVDEPS (from 70-deps)

# ─── synth-wire: deterministic synthesizer → root eslint.config.mjs ─────────────
# Runs synthesize() for the detected stack and AST-merges emitted rules-as-tests rules
# (R12/R14/R20 for react-next) into the consumer's root eslint.config.mjs.  Idempotent:
# the preset template already hand-inlines these rules (principle 26 guarantees sync),
# so this is a fast string-check no-op for a freshly-installed consumer.  Its value is
# architectural: the synthesizer is now the declared source of truth; future recipe
# additions will wire into the config without template edits.
#
# Runs regardless of _r2_verdict (R12/R14/R20 are not boundary-gated like R2) and
# honours --dry-run (writes nothing, prints what would change).
# rc=0 on every branch — install must not abort on wirer failure.
if command -v node >/dev/null 2>&1 && [ -f "$PROJECT_ROOT/eslint.config.mjs" ]; then
  _synth_wirer="$PKG_ROOT/packages/core/install/synth-and-wire.bundle.mjs"
  if [ ! -f "$_synth_wirer" ]; then
    echo "  · synth-and-wire: bundle not found at $_synth_wirer — skipped"
  else
    echo "▶ synth-wire: confirming synthesized rules-as-tests slice in eslint.config.mjs"
    # Run from PROJECT_ROOT so ts-morph resolves from consumer node_modules.
    # AIF_SYNTH_PKG_ROOT anchors the bundle's fs-based recipe + schema reads to the
    # correct framework payload dir (packages/core/) — import.meta.url collapses to
    # install/ under bundling (zero-dep Path-3, #755); env var is the load-bearing bridge.
    ( cd "$PROJECT_ROOT" && AIF_SYNTH_PKG_ROOT="$PKG_ROOT/packages/core" \
        node "$_synth_wirer" \
          --stack "${STACK:-ts-server}" \
          --path "$PROJECT_ROOT/eslint.config.mjs" \
          ${DRY_RUN:+--dry-run} 2>&1 ) || true
  fi
fi

# ─── #827 B3: per-workspace live-research synth-wire for multi-stack monorepos ──
# The root synth-wire block above wires $PROJECT_ROOT/eslint.config.mjs and is gated on that root
# config existing — correct for flat repos. A multi-stack monorepo has NO root config, so the
# live-research snippet (emitted by 80-rule-bootstrap for the install's $STACK) would wire NOWHERE.
# Mirror the R2 per-workspace loop (§13.5 I-2 L2 below): for each detected workspace whose stack
# matches the install $STACK, wire the (single, stack-keyed) root snippet into that workspace's
# eslint.config.mjs.
#
# Routing (simplest correct; matches the dogfood layout): research is ROOT-level + stack-keyed
# ($PROJECT_ROOT/.ai-factory/rules-research/<stack>.{research,selection}.json — the same convention
# 80-rule-bootstrap reads), and 80-rule-bootstrap emits ONE snippet for the install's $STACK. We
# route that snippet to workspaces whose DETECTED stack == $STACK. A multi-stack monorepo runs
# ./setup <stack> --full once per stack (install.sh takes a single --stack arg); each run delivers
# that stack's live rule into its matching workspaces. Snippet is passed EXPLICITLY (--snippet)
# because the CLI default derives it from the config's own dir, which a workspace config lacks.
# Gated on NO root config (mutually exclusive with the root block above — no double-wire).
# Honours --dry-run; rc=0 on every branch — install must not abort on wirer failure.
if command -v node >/dev/null 2>&1 && [ "$DRY_RUN" != "--dry-run" ] \
   && [ ! -f "$PROJECT_ROOT/eslint.config.mjs" ]; then
  _synth_wirer_ws="$PKG_ROOT/packages/core/install/synth-and-wire.bundle.mjs"
  _ws_snippet="$PROJECT_ROOT/.ai-factory/synthesizer-output/eslint-rules-snippet.json"
  if [ ! -f "$_synth_wirer_ws" ]; then
    : # bundle absent — nothing to wire (the root block already echoes this for flat repos)
  elif [ ! -f "$_ws_snippet" ]; then
    : # no live snippet emitted (80-rule-bootstrap degraded / not --full) — presets are the fence
  else
    _ws_map_synth=$(_detect_stacks_per_workspace "$PROJECT_ROOT")
    if [ -n "$_ws_map_synth" ]; then
      echo "▶ synth-wire per-workspace: routing ${STACK:-ts-server} live-research snippet to matching workspace configs"
      while IFS=$'\t' read -r _sw_dir _sw_stack; do
        [ -n "$_sw_dir" ] || continue
        # Only wire the snippet into workspaces matching the install's $STACK — the snippet IS that
        # stack's live rule. Other-stack workspaces are delivered on their own ./setup <stack> run.
        [ "$_sw_stack" = "${STACK:-ts-server}" ] || continue
        while IFS= read -r -d '' _sw_cfg; do
          echo "  · synth-wire (live): $_sw_cfg"
          ( cd "$PROJECT_ROOT" && AIF_SYNTH_PKG_ROOT="$PKG_ROOT/packages/core" \
              node "$_synth_wirer_ws" \
                --stack "${STACK:-ts-server}" \
                --path "$_sw_cfg" \
                --snippet "$_ws_snippet" 2>&1 ) || true
        done < <(find "$PROJECT_ROOT/$_sw_dir" \
          -name 'eslint.config.mjs' \
          ! -path '*/node_modules/*' \
          -print0 2>/dev/null)
      done <<< "$_ws_map_synth"
    fi
  fi
fi

# ─── D3: presets-are-fallback notice (live-research-default-delivery) ───────────
# Live-research is the DEFAULT stack-rule delivery; presets are the FALLBACK baseline. When the
# consumer has NOT authored rules-research artefacts for this stack, the live path (80-rule-bootstrap
# → synth-wire snippet merge above) produced nothing, so the shipped preset rules are the only
# stack fence. Surface that + point at the live-research protocol. Deps-free echo; exit stays 0.
# Mirrors the R7/R8-arming WARN style below; --dry-run-aware.
_rr_dir="$PROJECT_ROOT/.ai-factory/rules-research"
_rr_plan="$_rr_dir/${STACK:-ts-server}.research.json"
_rr_sel="$_rr_dir/${STACK:-ts-server}.selection.json"
if [ "$DRY_RUN" = "--dry-run" ]; then
  echo "  [dry-run] would check ${STACK:-ts-server} rules-research artefacts for the presets-are-fallback notice"
elif [ ! -f "$_rr_plan" ] || [ ! -f "$_rr_sel" ]; then
  echo ""
  echo "ℹ  Presets are the FALLBACK baseline — prefer live-research for fresh, stack-specific rules."
  echo "   No .ai-factory/rules-research/${STACK:-ts-server}.{research,selection}.json found, so the shipped"
  echo "   preset rules are your only stack fence this install. Run the rule-research protocol"
  echo "   (agents/rule-researcher.md or the rule-research skill), then re-run ./setup --full to"
  echo "   deliver live-researched rules into eslint.config.mjs (they augment + override the presets)."
fi

# ─── D4 (#811): preset staleness guard — frozen-snapshot vs installed-major WARN ───
# The shipped preset is a frozen Next-15 snapshot (packages/preset-next-15-canonical/preset.meta.json
# pins). When the consumer's installed framework/tool major differs, WARN + steer to live-research.
# Deps-free (warn_preset_staleness greps package.json text); scoped to react-next (the preset's stack);
# --dry-run-aware; exit stays 0.
_preset_meta="$PKG_ROOT/packages/preset-next-15-canonical/preset.meta.json"
if [ "$DRY_RUN" = "--dry-run" ]; then
  echo "  [dry-run] would compare installed tool majors vs $_preset_meta for the #811 staleness WARN"
elif [ "${STACK:-}" = "react-next" ]; then
  warn_preset_staleness "$_preset_meta" "$PROJECT_ROOT/package.json"
fi

# ─── 6b-bis-L2. GH #547 Layer 2: AST-wire R2 into consumer per-package configs ─
# Runs AFTER §8 dep-install so ts-morph is resolvable when --full is set.
# Option A (migration-ast Stage 4): gated on --full; ensure-then-use; degrade
# when engine absent. rc=0 on every branch (lesson GH #531/#544).
# Layer 1 (§6b-bis above) patches OUR eslint.config.mjs; this Layer 2 patches
# CONSUMER per-package eslint.config.mjs files that re-export a base lacking R2.
if [ "${_r2_verdict:-}" = "boundary-present" ] && [ "$DRY_RUN" != "--dry-run" ] \
   && [ -f "$PROJECT_ROOT/eslint.config.mjs" ]; then
  _l2_degrade() {
    echo "  · R2 not auto-wired: AST editor unavailable (Node or ts-morph not present)."
    echo "    Add to <pkg>/eslint.config.mjs:"
    echo "      export default [...base, { rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } }];"
    echo "    (or run ./install.sh ts-server --full to install dev-deps and auto-wire)"
  }
  if ! command -v node >/dev/null 2>&1; then
    _l2_degrade
  elif [ ! -f "$PROJECT_ROOT/node_modules/ts-morph/package.json" ]; then
    _l2_degrade
  else
    _wirer="$PKG_ROOT/packages/core/install/wire-eslint-r2.ts"
    if [ ! -f "$_wirer" ]; then
      echo "  · R2 Layer-2 wirer not found at $_wirer — skipped"
    else
      # Find per-package eslint.config.mjs files (not the root one, not node_modules)
      _l2_configs=()
      while IFS= read -r -d '' _cfg; do
        _l2_configs+=("$_cfg")
      done < <(find "$PROJECT_ROOT" \
        -name 'eslint.config.mjs' \
        ! -path "$PROJECT_ROOT/eslint.config.mjs" \
        ! -path '*/node_modules/*' \
        -print0 2>/dev/null)
      if [ "${#_l2_configs[@]}" -eq 0 ]; then
        : # no per-package configs — nothing to wire
      else
        echo "▶ R2 Layer-2: wiring ${#_l2_configs[@]} per-package eslint config(s)"
        for _cfg in "${_l2_configs[@]}"; do
          # rc=0 forced by || true — never abort install on wirer failure
          ( cd "$PROJECT_ROOT" && npx --no-install tsx "$_wirer" \
              --path "$_cfg" ${FULL:+--yes} 2>&1 ) || true
        done
      fi
    fi
  fi
fi

# §13.5 I-2 L2: R2 per-workspace wiring for multi-stack monorepos (SSOT #182).
# The block above gates on root eslint.config.mjs — intentional for flat repos. In a multi-stack
# monorepo there is NO root config; this block wires R2 into ts-server workspace configs only.
# No --scope: workspace-local config placement already scopes ESLint to that workspace — a
# dir-prefixed files: glob inside a workspace-local config is relative to that config's dir,
# making 'ws/**' resolve to 'ws/ws/**' (nothing). Scoping is by config placement, not files:.
# Scope source = _detect_stacks_per_workspace detection map, NOT recipe appliesTo (T-MS-A).
if [ "$DRY_RUN" != "--dry-run" ] && [ ! -f "$PROJECT_ROOT/eslint.config.mjs" ]; then
  _ws_map_r2=$(_detect_stacks_per_workspace "$PROJECT_ROOT")
  if [ -n "$_ws_map_r2" ]; then
    if ! command -v node >/dev/null 2>&1 || \
       [ ! -f "$PROJECT_ROOT/node_modules/ts-morph/package.json" ]; then
      echo "  · R2 per-workspace: Node/ts-morph not available — add R2 manually to ts-server workspace configs"
    else
      _wirer_ws="$PKG_ROOT/packages/core/install/wire-eslint-r2.ts"
      if [ ! -f "$_wirer_ws" ]; then
        echo "  · R2 per-workspace: wirer not found at $_wirer_ws — skipped"
      else
        echo "▶ R2 per-workspace: scoped wiring (multi-stack monorepo)"
        while IFS=$'\t' read -r _ws_dir _ws_stack; do
          [ -n "$_ws_dir" ] || continue
          case "$_ws_stack" in
            ts-server)
              # Wire R2 into every eslint.config.mjs within this workspace.
              # No --scope: the config is workspace-local (placed by 40-configs.sh) so ESLint
              # scoping is already provided by config placement — a dir-prefixed files: glob
              # inside a workspace-local config would be relative to that config's own dir,
              # making 'apps/api/**' match 'apps/api/apps/api/**' (nothing). Omit files: here.
              while IFS= read -r -d '' _ws_cfg; do
                echo "  · R2 wiring: $_ws_cfg"
                ( cd "$PROJECT_ROOT" && npx --no-install tsx "$_wirer_ws" \
                    --path "$_ws_cfg" ${FULL:+--yes} 2>&1 ) || true
              done < <(find "$PROJECT_ROOT/$_ws_dir" \
                -name 'eslint.config.mjs' \
                ! -path '*/node_modules/*' \
                -print0 2>/dev/null)
              ;;
            unknown)
              echo "  ⚠ $_ws_dir: unknown stack — R2 not wired (re-checkable marker; not exit 1)"
              ;;
            *)
              : # react-native / react-next / react-spa: R2 is a server-boundary rule; not wired per-workspace
              ;;
          esac
        done <<< "$_ws_map_r2"
      fi
    fi
  fi
fi

# ─── cih-s3 V2: runtime-discipline arming WARN (consumer-side, deps-free) ───
# R7/R8 (no-direct-time-randomness / require-otel-span) ship DEFERRED behind AIF_STRICT_RUNTIME=1
# in the eslint config templates. If the consumer already depends on @opentelemetry/* yet has not
# armed the runtime rules, R8 silently never fires — surface that. Greps the package.json TEXT
# (deps may be uninstalled at install time → no module/require check). Non-fatal: WARN only,
# exit stays 0 (a fresh skeleton legitimately defers). --dry-run-aware.
if [ "$DRY_RUN" = "--dry-run" ]; then
  echo "  [dry-run] would check @opentelemetry/* vs AIF_STRICT_RUNTIME for the R7/R8 arming WARN"
elif [ -f "$PROJECT_ROOT/package.json" ] && \
     grep -q '@opentelemetry/' "$PROJECT_ROOT/package.json" && \
     [ "${AIF_STRICT_RUNTIME:-}" != "1" ]; then
  echo ""
  echo "⚠  Detected @opentelemetry/* but AIF_STRICT_RUNTIME is unset — R8 (require-otel-span) will not fire."
  echo "   Set AIF_STRICT_RUNTIME=1 to arm runtime-discipline rules (R7/R8)."
fi

# GH #531 (reopen): ignore the framework configs we shipped FRESH (consumer-owned ones stay checked).
# Runs after ALL copy_safe calls so SKIPPED is complete, and after the static .prettierignore merge.
ignore_shipped_configs

# ─── install-self-verification capstone (FULL only) ─────────────────────────
# Runs at the end of --full install to PROVE — not just assert — that:
#   1. Installed ESLint fences FIRE on deliberately-bad input (D1)
#   2. Husky shields are wired and active (D2)
#   3. Generated rule tests are non-vacuous: kill ≥60% of selector mutations (D5)
# MUST NOT run on CI self-install path (FULL unset). Degrades gracefully (rc=0) when
# eslint/deps are absent. Mirrors 80-rule-bootstrap.sh FULL guard (lines 25-27).
if [ -z "${FULL:-}" ]; then
  : # not a --full install — skip self-verification
elif [ "${DRY_RUN:-}" = "--dry-run" ]; then
  echo "· install-self-verify: [dry-run] would run fences-fire + shields-up + mutation gates"
else
  echo ""
  echo "▶ install-self-verify: proving fences fire, shields are up, generated tests non-vacuous"

  _ISV_PASS=0; _ISV_FAIL=0

  # D1: fences fire
  _FF_SCRIPT="$PROJECT_ROOT/scripts/check-fences-fire.sh"
  if [ -x "$_FF_SCRIPT" ]; then
    if AIF_PROJECT_ROOT="$PROJECT_ROOT" bash "$_FF_SCRIPT"; then
      _ISV_PASS=$((_ISV_PASS+1))
    else
      _ISV_FAIL=$((_ISV_FAIL+1))
      echo "  ✗ fences-fire FAILED — some installed ESLint rules are silent on bad input"
    fi
  else
    echo "  · fences-fire: script not found at $_FF_SCRIPT (40-configs.sh copy skipped?) — skipped"
  fi

  # D2: shields up
  _SU_SCRIPT="$PROJECT_ROOT/scripts/check-shields-up.sh"
  if [ -x "$_SU_SCRIPT" ]; then
    if AIF_PROJECT_ROOT="$PROJECT_ROOT" bash "$_SU_SCRIPT"; then
      _ISV_PASS=$((_ISV_PASS+1))
    else
      _ISV_FAIL=$((_ISV_FAIL+1))
      echo "  ✗ shields-up FAILED — Husky hooks not fully wired (see above)"
    fi
  else
    echo "  · shields-up: script not found at $_SU_SCRIPT — skipped"
  fi

  # D5: mutation gate (install-time, framework-side — not shipped to consumer)
  _MUT_SCRIPT="$PKG_ROOT/packages/core/audit-self/check-generated-rule-mutation.sh"
  if [ -x "$_MUT_SCRIPT" ]; then
    if AIF_PROJECT_ROOT="$PROJECT_ROOT" bash "$_MUT_SCRIPT" "$PROJECT_ROOT"; then
      _ISV_PASS=$((_ISV_PASS+1))
    else
      _ISV_FAIL=$((_ISV_FAIL+1))
      echo "  ✗ generated-rule-mutation FAILED — some generated tests are selector-blind (theatre)"
    fi
  else
    echo "  · generated-rule-mutation: script not at $_MUT_SCRIPT — skipped"
  fi

  echo ""
  if [ "$_ISV_FAIL" -eq 0 ]; then
    echo "✓ self-verify: $_ISV_PASS/3 checks passed — fences fire, shields active, generated tests non-vacuous"
  else
    echo "⚠  self-verify: $_ISV_PASS/3 passed, $_ISV_FAIL FAILED — review output above before committing"
  fi
fi

# ─── Done ───────────────────────────────────────────────
if [ ${#SKIPPED[@]} -gt 0 ]; then
  echo ""
  echo "⚠  ${#SKIPPED[@]} files were skipped because they already exist."
  echo "    Your project may now have a configuration that diverges from the framework's expectations."
  echo "    To overwrite them: re-run with --force"
  echo "    To preview what would change: re-run with --dry-run --force"
  echo "    Skipped paths:"
  printf '      - %s\n' "${SKIPPED[@]}"
  echo ""
fi

echo ""
if [ "$DRY_RUN" = "--dry-run" ]; then
  echo "✅ Dry-run complete. Nothing was written."
else
  echo "✅ Installation complete."
fi
echo ""
echo "Next steps:"
echo "  1. Edit .ai-factory/DESCRIPTION.template.md → save as .ai-factory/DESCRIPTION.md"
echo "  2. Edit .ai-factory/ARCHITECTURE.${STACK:-ts-server}.md → save as .ai-factory/ARCHITECTURE.md"
echo "  3. Edit AGENTS.md placeholders to match your project"
if [ "${DEPS_INSTALLED:-}" = "1" ]; then
  echo "  4. ✓ Dev-dependencies installed into node_modules/ — nothing to do."
else
  # step 4 fallback: the manual dep-install (run only when --full/[y/N] consent was not given).
  # Built from the same DEVDEPS array the installer uses → list cannot drift from what we install.
  case "$(detect_pm)" in
    pnpm) _add="pnpm add -D" ;;
    yarn) _add="yarn add -D" ;;
    *)    _add="npm install --save-dev" ;;
  esac
  echo "  4. Install dev-dependencies (or re-run: ./install.sh ${STACK:-ts-server} --full):"
  echo ""
  echo "     $_add \\"
  printf '       %s\n' "${DEVDEPS[*]}"
fi
echo "  5. Verify git hooks: 'git config core.hooksPath' should print .husky (install activated it; do NOT run 'npx husky init' — it would clobber the shipped .husky/pre-commit + pre-push)"
echo "  6. Run: ./scripts/audit-ai-docs.sh — should PASS"
echo "  7. Run: npm run validate"
echo ""
echo "For full guide: see INSTALL.md"
