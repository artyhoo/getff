#!/usr/bin/env bash
# setup.d/55-runtime-bridge-vendor.sh — §5d vendored runtime-bridge subset (factory-only).
#
# Sources: lib.sh (already in dispatcher scope).
# S0 row: beta-delivery-ux S5 / spec A7 (lines 285-289) — see
#   <docs/superpowers/specs/2026-07-23-beta-program-design.md> §4 A7.
# Depends on: 10-skills (PROJECT_ROOT/.claude/ exists), 50-hooks (hook dir exists).
# @cc-only-rationale: sourced by install.sh dispatcher, not standalone.
#
# What this layer does (INSTALL-TIME, file-copy only):
#   1. Copies the vendored runtime-bridge subset from
#      $PKG_ROOT/packages/runtime-bridge/vendor/ into
#      $PROJECT_ROOT/.claude/vendor/runtime-bridge/ so a consumer (non-framework)
#      repo can dispatch aif tasks via `tsx .claude/vendor/runtime-bridge/...`.
#   2. Copies the dispatch PostToolUse hook from
#      $PKG_ROOT/packages/runtime-bridge/vendor/hooks/runtime-bridge-dispatch.sh
#      into $PROJECT_ROOT/.claude/hooks/runtime-bridge-dispatch.sh
#      (idempotent with the runtime/setup-runtime-bridge.sh flow — see
#      "Coordination" below).
#
# What this layer does NOT do:
#   - Register the PostToolUse hook in .claude/settings.json — that is the
#     runtime/interactive decision the consumer makes when they bring up
#     aif-handoff (packages/runtime-bridge/scripts/setup-runtime-bridge.sh OFFERS
#     to auto-write the settings.json entry once the runtime is reachable).
#     Installing the file at install-time does NOT activate it — activation is a
#     separate runtime decision (kickoff §7 opt-in: only `<!-- bridge: auto -->`
#     kickoffs auto-dispatch; without the settings.json registration the hook is a
#     no-op even if the file is present).
#   - Install aif-handoff itself (DETECT + INSTRUCT only — see
#     setup.d/bridge-guided.sh + setup-runtime-bridge.sh).
#
# Profile gate (factory-only — spec A7 binds this to the factory depth per
# kickoff §3 + plan §4 Task 6):
#   - PROFILE=factory  → install vendor + hook.
#   - PROFILE=env      → skip (env depth lacks the aif-handoff operator runtime).
#   - PROFILE=core     → skip.
#   - WITH_AIF_SUITE   → install (legacy flag routes through factory per
#                        install.sh:405-408).
#
# Coordination with setup-runtime-bridge.sh (idempotent, not duplicate):
#   - setup-runtime-bridge.sh is FRAMEWORK-ONLY (lives at
#     packages/runtime-bridge/scripts/, which the consumer does NOT receive via
#     install.sh). When the consumer's setup.d/bridge-guided.sh runs and
#     aif-handoff is reachable, it looks for that script at
#     $root/packages/runtime-bridge/scripts/setup-runtime-bridge.sh; absent in a
#     consumer install, it prints the docs/runtime-bridge-setup.md pointer
#     (bridge-guided.sh:46-48).
#   - This layer 55 runs at INSTALL time; setup-runtime-bridge.sh runs at
#     RUNTIME (post-install, when the consumer invokes ./setup's bridge-guided
#     step OR sources bridge-guided.sh and aif-handoff answers /health).
#   - Both copy the hook to the same destination; layer 55 lands first
#     (install-time), and if setup-runtime-bridge.sh runs later it overwrites
#     with byte-identical content (file is the same source). No conflict.
#
# Spec reference: docs/superpowers/specs/2026-07-23-beta-program-design.md §4 A7
# (lines 285-289) — "vendors the runtime-bridge subset (CLI entrypoints +
# dispatch hook, env-parameterized) into the consumer repo; dedup-log path
# becomes per-project. npm packaging of the bridge stays deferred (U9)."
#
# Vendor source-of-truth: packages/runtime-bridge/vendor/README.md (spec A7
# binds COPY not dep; P1-P5 forks parked per kickoff §7 + plan §3.1).

# Profile gate — factory / WITH_AIF_SUITE only.
if [ "${PROFILE:-core}" != "factory" ] && [ -z "${WITH_AIF_SUITE:-}" ]; then
  # Not an error — silently skip at env/core depth.
  if [ -n "$DRY_RUN" ]; then
    echo "▶ Runtime-bridge vendor → [dry-run] skipped (profile=${PROFILE:-core}, factory-only)"
  fi
  return 0 2>/dev/null || exit 0
fi

VENDOR_SRC="$PKG_ROOT/packages/runtime-bridge/vendor"
VENDOR_DST="$PROJECT_ROOT/.claude/vendor/runtime-bridge"
HOOK_SRC="$VENDOR_SRC/hooks/runtime-bridge-dispatch.sh"
HOOK_DST="$PROJECT_ROOT/.claude/hooks/runtime-bridge-dispatch.sh"

# Source absent → this layer is a no-op (the framework hasn't vendored yet, or
# this is a test invocation without the vendor dir). Surface it during dry-run.
if [ ! -d "$VENDOR_SRC" ]; then
  if [ -n "$DRY_RUN" ]; then
    echo "▶ Runtime-bridge vendor → [dry-run] no-op (vendor source absent: $VENDOR_SRC)"
  else
    echo "  ⚠ Runtime-bridge vendor: source absent ($VENDOR_SRC) — skipped"
  fi
  return 0 2>/dev/null || exit 0
fi

echo "▶ Runtime-bridge vendor → .claude/vendor/runtime-bridge/ (profile=${PROFILE:-factory})"

if [ -n "$DRY_RUN" ]; then
  echo "  [dry-run] would: cp -r $VENDOR_SRC → $VENDOR_DST"
  echo "  [dry-run] would: cp $HOOK_SRC → $HOOK_DST"
  return 0 2>/dev/null || exit 0
fi

# Real install path.
mkdir_safe "$PROJECT_ROOT/.claude/vendor"
# Wipe + recopy (vendor updates land via re-running ./setup --force; matches
# the existing skills/* idempotent wipe-and-recopy pattern in 10-skills.sh:22).
# Wipe + recopy + rewrite repo-internal relative refs in the DELIVERED markdown (2026-08-17).
# This bare `cp -r` used to be the only shipped-markdown path in setup.d/ that skipped
# transform_internal_refs (cf. 10-skills.sh:29,48 · 20-agents.sh:50 · lib.sh:900,930), so
# vendor/README.md's two `](../../../…)` refs shipped verbatim. They resolve in-repo —
# packages/runtime-bridge/vendor/ sits three levels below the repo root, the same depth as
# .claude/vendor/runtime-bridge/ below a consumer root — which is exactly why the breakage is
# invisible here and fatal there: on a consumer both targets are absent, and pre-push §8
# (`lychee --offline` over changed *.md) goes red on the FIRST push. That is the 2026-07-10
# flat-install smoke incident (lib.sh:65-93).
# Delivery-time, not source-time, ON PURPOSE: PR #1417 keeps this vendor drop byte-identical to
# its tracked source, and rewriting the delivered copy preserves that (the tracked file is not
# touched) where re-authoring the README would break it.
# The sequence lives in lib.sh (_copy_tree_with_transform) so the refresh path runs the identical
# one — these two are an @sync-with-layers pair that already drifted. The refresh path adds the
# ownership decision this install path does not owe: it goes through refresh_tree_with_transform,
# which honours the Layer-3 `.override.md` escape before reusing this same sequence.
_copy_tree_with_transform "$VENDOR_SRC" "$VENDOR_DST"

# Copy the dispatch hook (idempotent — same destination as
# setup-runtime-bridge.sh's HOOK_DST copy; byte-identical source).
mkdir_safe "$PROJECT_ROOT/.claude/hooks"
if [ -f "$HOOK_SRC" ]; then
  copy_safe "$HOOK_SRC" "$HOOK_DST"
  chmod_safe +x "$HOOK_DST" 2>/dev/null || true
fi

# Surface the install + the post-install manual step (the consumer still needs
# to set RUNTIME_BRIDGE_* env vars + register the PostToolUse hook in
# settings.json when they bring up aif-handoff — see vendor README).
echo "  ✓ .claude/vendor/runtime-bridge/ (vendored COPY per spec A7; P1-P5 parked)"
echo "  ✓ .claude/hooks/runtime-bridge-dispatch.sh (PostToolUse dispatch hook)"
echo "    ↳ NEXT (consumer runtime step, not install-time): when you bring up"
echo "      aif-handoff, run \`bash packages/runtime-bridge/scripts/setup-runtime-bridge.sh\`"
echo "      (if you have the framework checkout) OR set RUNTIME_BRIDGE_MODE +"
echo "      RUNTIME_BRIDGE_AIF_URL + RUNTIME_BRIDGE_AIF_PROJECT_ID + register the"
echo "      hook in .claude/settings.json — see .claude/vendor/runtime-bridge/README.md"
