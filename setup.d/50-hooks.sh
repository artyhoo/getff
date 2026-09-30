#!/usr/bin/env bash
# setup.d/50-hooks.sh — §5c .husky/ hooks cluster + core.hooksPath activation.
#
# Sources: lib.sh (already in dispatcher scope)
# S0 rows: §5c (install.sh:950-994)
# Depends on: 40-configs (tsconfig.json etc. already written)
# @cc-only-rationale: sourced by install.sh dispatcher, not standalone

# ─── §5c: .husky/ hooks ─────────────────────────────────
# P2 G1: stack «generic» (no stack getff knows) gets the stack-free part only; this layer is
# npm-bound, so it is skipped and named in the NOT wired summary.
if [ "${STACK:-}" = "generic" ]; then
  note_not_wired "git hooks (husky pre-commit / pre-push) — not installed: stack «generic» has no npm toolchain for them to run"
  return 0 2>/dev/null || true
fi

mkdir_safe "$PROJECT_ROOT/.husky"
# critical-review S3-1: note consumer-owned hooks BEFORE copy_safe keeps them, so the post-deps
# re-assert in 99-finalize (reassert_husky_shields) keeps them too.
husky_note_consumer_hooks "$PKG_ROOT" "$PROJECT_ROOT"
# critical-review wave 2: a kept consumer hook runs none of the framework's checks — say so in the
# NOT wired summary. 99-finalize's self-verify exempts only that hook: the rest of shields-up still
# runs and its FAIL counts, but a pass is counted as SKIP, never as «shields wired».
# The line names the check that does not run and why; it never tells the reader to paste a call into
# their hook (Q4.7: the install hands back no manual step). Adding that call to a hook the consumer
# owns is an operator decision, not made here.
for _ch in ${HUSKY_CONSUMER_HOOKS:-}; do
  case "$_ch" in
    pre-commit) _ch_what="the ZCode skill-mirror check and lint-staged on the staged files" ;;
    *)          _ch_what="getff's rule checks (packages/core/hooks/pre-push.bundle.mjs)" ;;
  esac
  note_not_wired "framework $_ch shield — your own .husky/$_ch is kept and runs none of the framework checks ($_ch_what); getff does not change a git hook the project already has"
done
copy_safe "$PKG_ROOT/packages/core/templates/shared/husky-pre-commit.sh" "$PROJECT_ROOT/.husky/pre-commit"
copy_safe "$PKG_ROOT/packages/core/templates/shared/husky-pre-push.sh" "$PROJECT_ROOT/.husky/pre-push"
# Wave 10.5: also install the bash critical-only fallback so the dispatcher can find it.
# The runtime dispatcher (husky-pre-push.sh) selects between TS-core and fallback at each push.
copy_safe "$PKG_ROOT/packages/core/hooks/pre-push.fallback.sh" "$PROJECT_ROOT/packages/core/hooks/pre-push.fallback.sh"
# The TS-core hook ships as ONE prebuilt .mjs (scripts/build-runtime-bundles.mjs) that plain `node`
# runs — so the dispatcher's Node≥20 arm needs no tsx, no node_modules and no TypeScript sources in
# the project. It used to ship as pre-push.ts + its import graph + the packages/core/eslint-rules
# barrel + a {"type":"module"} marker (cih-s1 F1/F1b, #735, GH #532); in a project that owns its
# eslint.config / tsconfig those .ts files were linted and type-checked as the project's own code
# and turned lint, typecheck and build RED right after install (2026-09-27 fresh-install audit). The
# bundle's first lines keep it out of the project's lint (`/* eslint-disable */`); tsc never reads
# .mjs. Same relative path as in the framework repo: the hook derives the repo root from its own
# location (packages/core/hooks/ → ../../..). A stale .ts copy from an older install is reported
# (never deleted) by --refresh.
copy_safe "$PKG_ROOT/packages/core/hooks/pre-push.bundle.mjs" "$PROJECT_ROOT/packages/core/hooks/pre-push.bundle.mjs"

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
# The logic lives in setup.d/lib.sh (activate_husky_hookspath): do_refresh runs it too (refresh sweep G2).
activate_husky_hookspath
