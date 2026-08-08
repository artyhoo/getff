#!/usr/bin/env bash
# setup.d/85-worktree-scripts.sh — §5e worktree scripts cluster (env+ profile).
#
# Sources: lib.sh (already in dispatcher scope)
# S0 row: beta-delivery-ux S2 / spec A9 (lines 290-294) — see
#   <docs/superpowers/specs/2026-07-23-beta-program-design.md> §4 A9.
# Depends on: 40-configs ($PROJECT_ROOT/scripts/ already created).
# @cc-only-rationale: sourced by install.sh dispatcher, not standalone.
#
# What this layer does (INSTALL-TIME, file-copy only):
#   Ships the three worktree helper scripts from the framework's scripts/ tree
#   into the consumer's scripts/ tree so `getff work <name>` (and direct
#   `scripts/create-worktree.sh <name>` invocations) work for consumers at
#   env+ profile depth. The three scripts form a call chain:
#     create-worktree.sh  →  worktree-node-modules.sh  →  link-coordination.sh
#   so all three MUST ship together (a partial ship produces loud warnings
#   from create-worktree.sh:127-129 when its callees are absent).
#
# Profile gate (env+ per kickoff §0 + §8a Park-6):
#   - PROFILE=env      → install (env depth carries the workspace one-command).
#   - PROFILE=factory  → install.
#   - PROFILE=core     → skip (core lacks the workspace surface).
#   - WITH_AIF_SUITE   → install (legacy flag routes through factory per
#                        install.sh:405-408).
#
# REUSE contract (kickoff §4 binding):
#   The scripts are copied VERBATIM from $PKG_ROOT/scripts/ — no rewrite,
#   no patching. create-worktree.sh is dual-pair with the CC
#   .claude/hooks/worktree-setup.sh hook (CC-native) and is the load-bearing
#   portable path. See CLAUDE.md "Parallel-session dispatch" + "Worktree
#   node_modules provisioning" for the canonical usage.

# Profile gate — env / factory / WITH_AIF_SUITE only.
if [ "${PROFILE:-core}" != "env" ] \
  && [ "${PROFILE:-core}" != "factory" ] \
  && [ -z "${WITH_AIF_SUITE:-}" ]; then
  # Not an error — silently skip at core depth.
  if [ -n "$DRY_RUN" ]; then
    echo "▶ Worktree scripts → [dry-run] skipped (profile=${PROFILE:-core}, env+)"
  fi
  return 0 2>/dev/null || exit 0
fi

# Source absent → no-op (defensive — the framework ships these by construction
# today; if a future split relocates them, this guard surfaces the drift).
# R2 (S2 rework round 1): getff-work.sh is the workspace one-command entry-point
# (spec A9) — it composes worktree creation by REUSING create-worktree.sh + the
# dep-wiring chain. It MUST ship alongside the three callees so consumers receive
# the complete workspace surface at env+ profile depth.
WORKTREE_SCRIPTS=(
  "create-worktree.sh"
  "worktree-node-modules.sh"
  "link-coordination.sh"
  "getff-work.sh"
)
missing=0
for s in "${WORKTREE_SCRIPTS[@]}"; do
  if [ ! -f "$PKG_ROOT/scripts/$s" ]; then
    missing=1
    if [ -n "$DRY_RUN" ]; then
      echo "▶ Worktree scripts → [dry-run] missing source: $PKG_ROOT/scripts/$s"
    else
      echo "  ⚠ Worktree scripts: source absent ($PKG_ROOT/scripts/$s) — skipped"
    fi
  fi
done
if [ "$missing" = "1" ]; then
  return 0 2>/dev/null || exit 0
fi

echo "▶ Worktree scripts → scripts/ (profile=${PROFILE:-env+})"

if [ -n "$DRY_RUN" ]; then
  for s in "${WORKTREE_SCRIPTS[@]}"; do
    echo "  [dry-run] would: cp $PKG_ROOT/scripts/$s → $PROJECT_ROOT/scripts/$s"
  done
  return 0 2>/dev/null || exit 0
fi

# Real install path — copy each script verbatim, mark executable.
mkdir_safe "$PROJECT_ROOT/scripts"
for s in "${WORKTREE_SCRIPTS[@]}"; do
  copy_safe "$PKG_ROOT/scripts/$s" "$PROJECT_ROOT/scripts/$s"
  chmod_safe +x "$PROJECT_ROOT/scripts/$s" 2>/dev/null || true
done

echo "  ✓ scripts/create-worktree.sh (worktree entrypoint — REUSE per kickoff §4)"
echo "  ✓ scripts/worktree-node-modules.sh (node_modules provisioning)"
echo "  ✓ scripts/link-coordination.sh (workspace link coordination)"
echo "  ✓ scripts/getff-work.sh (workspace one-command entry-point — spec A9)"
echo "    ↳ NEXT: invoke via \`getff work <name>\` (env+ profile) or directly"
echo "      via \`bash scripts/create-worktree.sh <name>\`."
