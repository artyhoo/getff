#!/usr/bin/env bash
# setup.d/50-hooks.sh — §5c .husky/ hooks cluster + core.hooksPath activation.
#
# Sources: lib.sh (already in dispatcher scope)
# S0 rows: §5c (install.sh:950-994)
# Depends on: 40-configs (tsconfig.json etc. already written)
# @cc-only-rationale: sourced by install.sh dispatcher, not standalone

# ─── §5c: .husky/ hooks ─────────────────────────────────
mkdir_safe "$PROJECT_ROOT/.husky"
# critical-review S3-1: note consumer-owned hooks BEFORE copy_safe keeps them, so the post-deps
# re-assert in 99-finalize (reassert_husky_shields) keeps them too.
husky_note_consumer_hooks "$PKG_ROOT" "$PROJECT_ROOT"
# critical-review wave 2: a kept consumer hook runs none of the framework's checks — say so in the
# NOT wired summary. 99-finalize's self-verify exempts only that hook: the rest of shields-up still
# runs and its FAIL counts, but a pass is counted as SKIP, never as «shields wired».
for _ch in ${HUSKY_CONSUMER_HOOKS:-}; do
  case "$_ch" in
    # Never the template's `@aif-shield` marker: a hook that follows this advice would then read as
    # the framework's, and the next --full run's reassert_husky_shields would overwrite it.
    pre-commit) _ch_cmd="npx lint-staged" ;;
    *)          _ch_cmd="node --import tsx/esm packages/core/hooks/pre-push.ts  (no Node 20 + tsx: bash packages/core/hooks/pre-push.fallback.sh)" ;;
  esac
  note_not_wired "framework $_ch shield — your own .husky/$_ch is kept and runs none of the framework checks; to add them, call from it: $_ch_cmd"
done
copy_safe "$PKG_ROOT/packages/core/templates/shared/husky-pre-commit.sh" "$PROJECT_ROOT/.husky/pre-commit"
copy_safe "$PKG_ROOT/packages/core/templates/shared/husky-pre-push.sh" "$PROJECT_ROOT/.husky/pre-push"
# Wave 10.5: also install the bash critical-only fallback so the dispatcher can find it.
# The runtime dispatcher (husky-pre-push.sh) selects between TS-core and fallback at each push.
copy_safe "$PKG_ROOT/packages/core/hooks/pre-push.fallback.sh" "$PROJECT_ROOT/packages/core/hooks/pre-push.fallback.sh"
# cih-s1 F1: also ship the TS-core hook + its COMPLETE import graph so the
# dispatcher's Node≥20 arm is reachable (without these, husky-pre-push.sh always
# falls to the presence-only bash fallback). The relative layout under
# packages/core/hooks/ is preserved so the dispatcher resolves $REPO_ROOT/packages/
# core/hooks/pre-push.ts. Complete graph: pre-push.ts → static imports
# {utils/run-check.ts, utils/git.ts, checks/prior-art.ts, checks/s17.ts,
# checks/docs-card.ts, checks/unpinned-tool-install.ts} + dynamic await-import() targets
# {checks/guard-liveness.ts, checks/cmd-script-liveness.ts} — these die()/push-block
# when absent (pre-push.ts:612-613 → process.exit(1)); NOT graceful degradation.
# The transitive eslint-rules barrel is shipped separately below. (#735)
for ts_hook in \
  pre-push.ts \
  utils/run-check.ts \
  utils/git.ts \
  checks/prior-art.ts \
  checks/s17.ts \
  checks/docs-card.ts \
  checks/unpinned-tool-install.ts \
  checks/guard-liveness.ts \
  checks/cmd-script-liveness.ts; do
  copy_safe "$PKG_ROOT/packages/core/hooks/$ts_hook" "$PROJECT_ROOT/packages/core/hooks/$ts_hook"
done
# cih-s1 F1b: ship the eslint-rules barrel (transitive dep of guard-liveness.ts via
# ../../eslint-rules/index.ts). Without this group, guard-liveness.ts die()/push-blocks
# on load even after the 3 checks above ship. Destination: packages/core/eslint-rules/
# (same relative path as in the framework repo). (#735)
echo "▶ Core ESLint rules → packages/core/eslint-rules/"
for esl_hook in \
  index.ts \
  no-unsafe-zod-parse.ts \
  no-direct-time-randomness.ts \
  require-otel-span.ts \
  restricted-syntax-audit-exempt.ts; do
  copy_safe "$PKG_ROOT/packages/core/eslint-rules/$esl_hook" "$PROJECT_ROOT/packages/core/eslint-rules/$esl_hook"
done
# GH #532: the shipped pre-push.ts is authored as an ES module, but its module-type is decided by
# the NEAREST package.json. In THIS repo packages/core/package.json declares "type":"module" (so the
# hook loads as ESM and runs); in a consumer the nearest package.json is usually the project root with
# no "type" → CJS default → tsx's `require(esm)` bridge hits Node ≥22 cycle detection and the hook dies
# with ERR_REQUIRE_CYCLE_MODULE *at module load*, before any §7/§1.7 check runs (every git push aborts
# with a stack trace). Ship a hooks-scoped {"type":"module"} marker so the shipped .ts loads as ESM —
# exactly as it does in this framework repo. Scoped to packages/core/hooks/ (AIF-owned) so it can't
# collide with a consumer's own packages/core package or be picked up as a workspace member.
copy_safe "$PKG_ROOT/packages/core/templates/shared/hooks-package.json" "$PROJECT_ROOT/packages/core/hooks/package.json"

# ledger C-2 (#1597): scripts/check-ask-files.sh is NO LONGER delivered — the pre-push
# ask-file-schema section is maintainer-only (owner: 'maintainer', packages/core/hooks/pre-push.ts)
# and composeSections() drops maintainer sections on consumers, so the delivered script was
# unreachable here. A stale copy from a prior delivery is reported (never deleted) by --refresh.
chmod_safe +x "$PROJECT_ROOT/.husky/pre-commit" "$PROJECT_ROOT/.husky/pre-push" \
  "$PROJECT_ROOT/packages/core/hooks/pre-push.fallback.sh" 2>/dev/null || true

# cih-s1 F2: activate the shipped hooks deterministically. Copying the files alone leaves them
# inert — git never calls .husky/* until core.hooksPath points there. We set it directly instead
# of `npx husky init` (which would CLOBBER the .husky/pre-commit + pre-push we just shipped).
# Guarded on DRY_RUN and on PROJECT_ROOT being a git repo (no-op in non-git dirs, e.g. some tests).
if [ -n "$DRY_RUN" ]; then
  echo "▶ git hooks → [dry-run] would set core.hooksPath=.husky"
elif git -C "$PROJECT_ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  # critical-review S4-3: never repoint a hook setup the consumer already runs (their own
  # hooksPath, live .git/hooks) or a hooksPath that would resolve outside this install root.
  _hp_block=$(husky_hookspath_blocker "$PROJECT_ROOT")
  if [ -n "$_hp_block" ]; then
    HUSKY_HOOKSPATH_OWNED=0
    HUSKY_HOOKS_BLOCKED="$_hp_block"
    echo "  ⊝ git hooks NOT activated: $_hp_block — kept as is"
    # A relative hooksPath resolves against the toplevel, so a subdirectory install must name
    # its prefix — and git runs hooks from the toplevel, so the hooks then need a `cd` first.
    _hp_prefix=$(git -C "$PROJECT_ROOT" rev-parse --show-prefix 2>/dev/null || true)
    if [ -n "$_hp_prefix" ]; then
      note_not_wired "framework git hooks (${_hp_prefix}.husky/) — $_hp_block; to use them run: git config core.hooksPath ${_hp_prefix}.husky (git runs hooks from the repo root: add 'cd ${_hp_prefix%/}' at the top of each hook)"
    else
      note_not_wired "framework git hooks (.husky/) — $_hp_block; to use them instead run: git config core.hooksPath .husky"
    fi
  elif [ "$(git -C "$PROJECT_ROOT" config --get core.hooksPath 2>/dev/null)" = ".husky/_" ]; then
    HUSKY_HOOKSPATH_OWNED=0
    echo "▶ git hooks → core.hooksPath=.husky/_ kept (husky v9 runs .husky/pre-commit + pre-push)"
  else
    HUSKY_HOOKSPATH_OWNED=1
    git -C "$PROJECT_ROOT" config core.hooksPath .husky
    echo "▶ Activated git hooks → core.hooksPath=.husky"
  fi
else
  echo "  ⚠  not a git repo — skipped core.hooksPath activation (run: git config core.hooksPath .husky)"
fi
