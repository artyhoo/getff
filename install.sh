#!/usr/bin/env bash
# install.sh — Deploy rules-as-tests-aif into the current project.
#
# Usage:
#   ./install.sh ts-server                      # default safe install
#   ./install.sh react-next --force             # overwrite existing files
#   ./install.sh react-next --dry-run           # preview without writing
#   ./install.sh react-next --dry-run --force   # preview overwrite plan
#   ./install.sh ts-server --full               # also auto-install dev-deps (no prompts; stack required)
#   ./setup -y ts-server                        # recommended one-shot path (wrapper: --full + companions)
#   ./install.sh ts-server --wire-ci            # also auto-wire missing CI gates via yq (opt-in, detect-first)
#
# What it does:
#   1. Copies skills/ + .claude/skills/{pipeline,dispatcher,aif-doctor,template-audit}/ → .claude/skills/
#      (the meta-orchestrator pipeline + its orchestration companions are shipped from
#       .claude/skills/ as single source of truth; self-reflection + ai-doc are intentionally
#       NOT shipped — repo-internal per build-first-reuse-default.md §1.1 shipped-axis;
#       cross-refs to repo-internal paths get sed-transformed to GitHub blob URLs —
#       see UPSTREAM_BLOB_URL + transform_internal_refs() below;
#       per .claude/rules/dual-implementation-discipline.md §7 SSOT)
#   2. Copies agents/  → .claude/agents/
#   3. Copies factory templates → .ai-factory/  (templates: as-is, you fill in placeholders)
#   4. Copies packages/core/audit-self/ + packages/preset-*/audit-self/ → scripts/
#   5. Copies packages/core/templates/shared/ + packages/preset-*/templates/ → project root
#
# Safety: by default never overwrites existing files. Use --force to overwrite.
# Use --dry-run to preview the plan without touching disk.
# Use --full to also run the consumer's package manager to install the dev-deps the shipped
# hooks/scripts need (default is to ask [y/N], default No — a mutating step is opt-in).
# Use --wire-ci to also auto-wire any CI-orphan rule-enforcement gate (§6c) into your existing
# workflow via yq (used-if-present, never installed by us; default is the non-destructive WARN +
# paste-block — wiring edits your kept workflow in place, so it is opt-in). No effect in --dry-run.

set -euo pipefail

# §4d-4: use ${BASH_SOURCE[0]} not $0 — correct when sourced (lib-only mode).
PKG_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(pwd)"

# Source all safe-helpers from lib.sh (defines transform_internal_refs, copy_safe, etc.).
# lib.sh also sets UPSTREAM_BLOB_URL and the PRETTIERIGNORE_* constants.
# shellcheck source=setup.d/lib.sh
source "$PKG_ROOT/setup.d/lib.sh"

# Library-only mode: when INSTALL_SH_LIB_ONLY=1, source this file to expose
# all helpers (defined in setup.d/lib.sh, now in dispatcher scope) without running
# the install pipeline (which would `read -rp` interactively + write files). Used by
# tests/install-sh/*.test.sh. §4d-4: guard is AFTER sourcing lib.sh so ALL helpers
# (including copy_safe/mkdir_safe/chmod_safe) are exposed in lib-only mode.
if [ "${INSTALL_SH_LIB_ONLY:-}" = "1" ]; then
  return 0 2>/dev/null || true
fi

STACK=""
FORCE=""
DRY_RUN=""
FULL=""
WIRE_CI=""
REFRESH=""
for arg in "$@"; do
  case "$arg" in
    --dry-run)              DRY_RUN="--dry-run" ;;
    --force)                FORCE="--force" ;;
    --full)                 FULL="--full" ;;
    --wire-ci)              WIRE_CI="--wire-ci" ;;
    --refresh)              REFRESH="--refresh" ;;
    ts-server|react-next|react-spa|react-native)   STACK="$arg" ;;
    *)                      ;;
  esac
done
SKIPPED=()

# Refuse to install into the package itself
if [ "$PKG_ROOT" = "$PROJECT_ROOT" ]; then
  echo "❌ Refusing to install into the package directory itself."
  echo "   cd to your target project and run: ${PKG_ROOT}/install.sh"
  exit 1
fi

# ─── Pre-install: verify shipped artefacts carry Authoritative-for headers ──
# Author-side fail-loud check (Wave 3 of §13.21 closure, see
# docs/meta-factory/research-patches/2026-05-09-§13.21-l3-revision.md).
# Mirrors the canonical list at
# packages/core/principles/09-doc-authority-hierarchy.test.ts
# (REQUIRED_HEADER_DOCS Wave 2 + Wave 5.1 + memory-codification-auditor + orchestrator-worker-discipline — 18 shipped surfaces).
# Runs in --dry-run too, so preview also catches drift between PR-side
# (principle 09 CI) and release-time copy. Positioned before package.json
# check + stack picker so framework-author drift fails fastest, before any
# interactive prompt.
# SHIPPED_DOCS is the SINGLE SOURCE OF TRUTH for both the header-verify loop (below) AND the
# §3 skill-context copy step (which derives its skill-context entries from this very array —
# see the `*/skill-context/*/SKILL.md` case there). Adding a skill-context doc here wires it
# into verify AND deploy in one edit → the two lists cannot drift (FQA S1-A P2: aif-orchestrator-
# discipline was header-verified but absent from the hand-maintained copy step, so consumers
# landed 2/3). Keep all three skill-context entries listed explicitly (static-parseable by
# principle 09's SHIPPED_DOCS↔REQUIRED_HEADER_DOCS check).
SHIPPED_DOCS=(
  "packages/core/templates/shared/AGENTS.md.template"
  "packages/core/templates/shared/CLAUDE.md.template"
  "packages/core/templates/shared/DESCRIPTION.template.md"
  "packages/core/templates/shared/ARCHITECTURE.ts-server.md"
  "packages/core/templates/shared/integration-rules.md"
  "packages/preset-next-15-canonical/RULES.md"
  "packages/preset-next-15-canonical/RULES.react-next.md"
  "packages/preset-next-15-canonical/templates/ARCHITECTURE.react-next.md"
  "packages/preset-react-spa/RULES.md"
  "packages/preset-react-spa/RULES.react-spa.md"
  "packages/preset-react-spa/templates/ARCHITECTURE.react-spa.md"
  "packages/preset-react-native/RULES.md"
  "packages/preset-react-native/RULES.react-native.md"
  "packages/preset-react-native/templates/ARCHITECTURE.react-native.md"
  "packages/core/templates/shared/skill-context/aif-review/SKILL.md"
  "packages/core/templates/shared/skill-context/aif-rules-check/SKILL.md"
  "packages/core/templates/shared/skill-context/aif-orchestrator-discipline/SKILL.md"
  "agents/review-sidecar.md"
  "agents/living-docs-auditor.md"
  "agents/compliance-verifier.md"
  "agents/memory-codification-auditor.md"
  "agents/orchestrator-worker-discipline.md"
  "agents/aif-init.md"
  "agents/rule-researcher.md"
  "agents/capability-reuse-auditor.md"
  "skills/tool-bootstrapping/SKILL.md"
  "skills/tool-bootstrapping/references/decision-format.md"
)
echo "▶ Verifying shipped artefacts carry Authoritative-for headers"
verify_fail=0
for rel in "${SHIPPED_DOCS[@]}"; do
  abs="$PKG_ROOT/$rel"
  if [ ! -f "$abs" ]; then
    echo "  ❌ FAIL: $rel missing from package (expected at $abs)" >&2
    verify_fail=1
    continue
  fi
  if ! grep -qE '^> \*\*Authoritative for:\*\*' "$abs"; then
    echo "  ❌ FAIL: $rel missing Authoritative-for header (see .claude/rules/doc-authority-hierarchy.md §3)" >&2
    verify_fail=1
  fi
done
if [ "$verify_fail" -ne 0 ]; then
  echo "" >&2
  echo "Aborting install: shipped artefacts failed Authoritative-for header verification." >&2
  echo "This is a framework-author bug; principle 09 CI should also be red." >&2
  exit 1
fi
echo "  ✓ all ${#SHIPPED_DOCS[@]} shipped artefacts carry valid headers"

# Must be a project (has package.json) — but in dry-run we just warn so the user can preview.
if [ ! -f "$PROJECT_ROOT/package.json" ]; then
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "⚠  No package.json found in $PROJECT_ROOT — proceeding with dry-run preview anyway."
  else
    echo "❌ No package.json found in $PROJECT_ROOT"
    echo "   Run this from your project root."
    exit 1
  fi
fi

# For --refresh: auto-detect the stack from the consumer's existing files so the
# interactive prompt is skipped (refresh is non-interactive by design — opt-in flag).
if [ -n "$REFRESH" ] && [ -z "$STACK" ]; then
  if [ -f "$PROJECT_ROOT/.ai-factory/RULES.react-next.md" ] || \
     [ -f "$PROJECT_ROOT/.ai-factory/ARCHITECTURE.react-next.md" ]; then
    STACK="react-next"
  elif [ -f "$PROJECT_ROOT/.ai-factory/RULES.react-native.md" ] || \
       [ -f "$PROJECT_ROOT/.ai-factory/ARCHITECTURE.react-native.md" ]; then
    STACK="react-native"
  elif [ -f "$PROJECT_ROOT/.ai-factory/RULES.react-spa.md" ] || \
       [ -f "$PROJECT_ROOT/.ai-factory/ARCHITECTURE.react-spa.md" ]; then
    STACK="react-spa"
  else
    STACK="ts-server"
  fi
fi

# Pick stack when none was supplied. An explicit positional STACK (parsed above) always wins.
# Otherwise auto-detect from the consumer's repo signals (package.json) so a fresh `./setup -y`
# installs without a hand-typed stack — GH #780. REUSE _detect_stack_from_pkg (lib.sh, SSOT,
# node-free). Fall back to the interactive menu / `--full` fail-loud ONLY when detection is
# genuinely `unknown` — never a silent wrong install on doubt.
if [ -z "$STACK" ]; then
  STACK="$(_detect_stack_from_pkg)"
  if [ "$STACK" = "unknown" ]; then
    STACK=""   # reset so the interactive menu / --full fail-loud below handles it
    if [ -n "$FULL" ]; then
      echo "❌ --yes / --full: could not auto-detect a stack from package.json"
      echo "   (no react-native / next / react / typescript dependency signal)."
      echo "   Specify one explicitly: ts-server | react-next | react-spa | react-native"
      echo "   Example: ./setup -y ts-server"
      exit 1
    fi
    echo "What stack does this project use?"
    echo "  1) ts-server    — Node.js + Fastify/Hono/Express (server only)"
    echo "  2) react-next   — React 19 + Next.js 15 App Router"
    echo "  3) react-spa    — React 19 + Vite SPA (Feature-Sliced Design)"
    echo "  4) react-native — React Native / Expo (Expo or bare-RN baseline)"
    read -rp "Choose [1/2/3/4]: " choice
    case "$choice" in
      1) STACK="ts-server" ;;
      2) STACK="react-next" ;;
      3) STACK="react-spa" ;;
      4) STACK="react-native" ;;
      *) echo "❌ Invalid choice"; exit 1 ;;
    esac
  else
    echo "  ▶ Auto-detected stack from package.json: $STACK"
  fi
fi

if [ "$STACK" != "ts-server" ] && [ "$STACK" != "react-next" ] && [ "$STACK" != "react-spa" ] && [ "$STACK" != "react-native" ]; then
  echo "❌ Unknown stack: $STACK (use ts-server, react-next, react-spa, or react-native)"
  exit 1
fi

if [ -n "$REFRESH" ]; then
  echo "▶ Refreshing rules-as-tests-aif framework artefacts in $PROJECT_ROOT (stack: $STACK)"
else
  echo "▶ Installing rules-as-tests-aif into $PROJECT_ROOT (stack: $STACK)"
fi

# do_refresh — re-copy all framework-owned artefacts (agents, skills, hooks, scripts,
# skill-context overrides) to the consumer. Called only when --refresh is passed.
# Framework-owned = artefacts the framework authors, header-verifies, and ships with no
# consumer-specific data. Consumer-authored files (AGENTS.md, RULES.md, ci.yml,
# eslint.config.mjs, tsconfig.json, .prettierrc, etc.) are NEVER in this set.
# Boundary derivation: SHIPPED_DOCS ∪ copy_safe'd framework artefacts; override signal =
# sibling .override.md (Layer 3 per INSTALL-FOR-AI.md §Three-layer).
# @sync-with-layers: do_refresh mirrors the layer-by-layer install but for refresh semantics.
# When layers (10-skills, 20-agents, etc.) evolve, this function needs a hand-sync check.
# O4-b: kept in entry (dispatcher) scope, not split into per-layer MODE args, to avoid
# behaviour drift mid-S1 refactor (refactor-only posture).
do_refresh() {
  echo "▶ Mode: --refresh (framework-owned artefacts; consumer files preserved)"
  echo "  Skips any file with a sibling .override.md (Layer-3 consumer ownership)"

  # ── Sub-agents ──────────────────────────────────────────
  echo "▶ Sub-agents → .claude/agents/"
  for f in "$PKG_ROOT"/agents/*.md; do
    case "$(basename "$f")" in
      manual-rule-liveness-prober.md) continue ;;
      shipped-agent-liveness-prober.md) continue ;;
    esac
    refresh_safe "$f" "$PROJECT_ROOT/.claude/agents/$(basename "$f")"
  done

  # ── Skills (plain copy, no internal-ref transform) ──────
  echo "▶ Skills (rules-as-tests, tool-bootstrapping) → .claude/skills/"
  for _slug in rules-as-tests tool-bootstrapping; do
    _src="$PKG_ROOT/skills/$_slug"
    _dst="$PROJECT_ROOT/.claude/skills/$_slug"
    _override="${_dst}.override.md"
    [ -d "$_src" ] || continue
    if [ -e "$_override" ]; then
      if [ "$DRY_RUN" = "--dry-run" ]; then
        echo "  [dry-run] would skip: .claude/skills/$_slug (.override.md — consumer-owned)"
      else
        echo "  ⊝ .claude/skills/$_slug (.override.md — consumer-owned, keeping)"
      fi
      continue
    fi
    if [ "$DRY_RUN" = "--dry-run" ]; then
      echo "  [dry-run] would refresh: $_src → $_dst"
      continue
    fi
    rm -rf "$_dst"
    cp -r "$_src" "$_dst"
    echo "  ✓ .claude/skills/$_slug/ (refreshed)"
  done

  # ── Orchestration skills (with internal-ref transform) ──
  echo "▶ Orchestration skills → .claude/skills/"
  for _skill in pipeline dispatcher aif-doctor template-audit; do
    refresh_skill_with_transform "$_skill"
  done
  _AIF_HELPERS="$PROJECT_ROOT/.claude/skills/aif-doctor/helpers"
  if [ "$DRY_RUN" != "--dry-run" ] && [ -d "$_AIF_HELPERS" ]; then
    chmod_safe +x "$_AIF_HELPERS/heal.sh" "$_AIF_HELPERS/refresh-aif-base.sh" 2>/dev/null || true
  fi

  # ── Claude hooks ────────────────────────────────────────
  echo "▶ Claude hooks → .claude/hooks/"
  _HOOK_SRC="$PKG_ROOT/packages/core/hooks/deps-hash-check.sh"
  _HOOK_DST="$PROJECT_ROOT/.claude/hooks/deps-hash-check.sh"
  if [ -f "$_HOOK_SRC" ]; then
    refresh_safe "$_HOOK_SRC" "$_HOOK_DST"
    if [ "$DRY_RUN" != "--dry-run" ] && [ -f "$_HOOK_DST" ]; then
      chmod_safe +x "$_HOOK_DST" 2>/dev/null || true
    fi
  fi

  # ── Scripts ─────────────────────────────────────────────
  echo "▶ Scripts → scripts/"
  for _pair in \
    "packages/core/audit-self/audit-ai-docs.sh:scripts/audit-ai-docs.sh" \
    "packages/core/probes/audit-r4.ts:scripts/audit-r4.ts" \
    "packages/core/audit-self/check-rule-globs.sh:scripts/check-rule-globs.sh" \
    "packages/core/audit-self/check-rule-enforced.sh:scripts/check-rule-enforced.sh" \
    "packages/core/audit-self/detect-r2-boundary.sh:scripts/detect-r2-boundary.sh" \
    "packages/core/audit-self/r2-na-marker.sh:scripts/r2-na-marker.sh" \
    "packages/core/audit-self/check-arch-boundaries.sh:scripts/check-arch-boundaries.sh" \
    "packages/core/audit-self/check-lintstaged-resolves.sh:scripts/check-lintstaged-resolves.sh"; do
    _s="${_pair%%:*}"; _d="${_pair##*:}"
    refresh_safe "$PKG_ROOT/$_s" "$PROJECT_ROOT/$_d"
    case "$_d" in
      *.sh) if [ "$DRY_RUN" != "--dry-run" ] && [ -f "$PROJECT_ROOT/$_d" ]; then
              chmod_safe +x "$PROJECT_ROOT/$_d" 2>/dev/null || true; fi ;;
    esac
  done
  if [ "$STACK" = "react-next" ]; then
    _rn_src="$PKG_ROOT/packages/preset-next-15-canonical/audit-self/audit-ai-docs.react-next.sh"
    _rn_dst="$PROJECT_ROOT/scripts/audit-ai-docs.react-next.sh"
    refresh_safe "$_rn_src" "$_rn_dst"
    if [ "$DRY_RUN" != "--dry-run" ] && [ -f "$_rn_dst" ]; then
      chmod_safe +x "$_rn_dst" 2>/dev/null || true
    fi
  fi
  if [ "$STACK" = "react-spa" ]; then
    _rs_src="$PKG_ROOT/packages/preset-react-spa/audit-self/audit-ai-docs.react-spa.sh"
    _rs_dst="$PROJECT_ROOT/scripts/audit-ai-docs.react-spa.sh"
    refresh_safe "$_rs_src" "$_rs_dst"
    if [ "$DRY_RUN" != "--dry-run" ] && [ -f "$_rs_dst" ]; then
      chmod_safe +x "$_rs_dst" 2>/dev/null || true
    fi
  fi
  if [ "$STACK" = "react-native" ]; then
    _rnat_src="$PKG_ROOT/packages/preset-react-native/audit-self/audit-ai-docs.react-native.sh"
    _rnat_dst="$PROJECT_ROOT/scripts/audit-ai-docs.react-native.sh"
    refresh_safe "$_rnat_src" "$_rnat_dst"
    if [ "$DRY_RUN" != "--dry-run" ] && [ -f "$_rnat_dst" ]; then
      chmod_safe +x "$_rnat_dst" 2>/dev/null || true
    fi
  fi

  # ── Core hooks (TS pre-push pipeline) ───────────────────
  # Ships the COMPLETE import graph of pre-push.ts: static imports (lines 30-32)
  # AND dynamic await import() targets (lines 405/469). Missing entries crash the
  # hook with ERR_MODULE_NOT_FOUND before any gate runs. (#735)
  echo "▶ Core hooks (TS) → packages/core/hooks/"
  for _ts in \
    pre-push.ts \
    utils/run-check.ts \
    utils/git.ts \
    checks/prior-art.ts \
    checks/s17.ts \
    checks/unpinned-tool-install.ts \
    checks/guard-liveness.ts \
    checks/cmd-script-liveness.ts; do
    refresh_safe "$PKG_ROOT/packages/core/hooks/$_ts" "$PROJECT_ROOT/packages/core/hooks/$_ts"
  done
  # ── Core ESLint rules (transitive dep of guard-liveness.ts) ─────────────────
  # guard-liveness.ts imports ../../eslint-rules/index.ts (relative, not node_modules).
  # Without this group, guard-liveness.ts dies on load even after the 3 checks ship.
  # Destination: packages/core/eslint-rules/ on the consumer (same relative path). (#735)
  echo "▶ Core ESLint rules → packages/core/eslint-rules/"
  for _esl in \
    index.ts \
    no-unsafe-zod-parse.ts \
    no-direct-time-randomness.ts \
    require-otel-span.ts \
    restricted-syntax-audit-exempt.ts; do
    refresh_safe "$PKG_ROOT/packages/core/eslint-rules/$_esl" \
                 "$PROJECT_ROOT/packages/core/eslint-rules/$_esl"
  done

  _fb_src="$PKG_ROOT/packages/core/hooks/pre-push.fallback.sh"
  _fb_dst="$PROJECT_ROOT/packages/core/hooks/pre-push.fallback.sh"
  refresh_safe "$_fb_src" "$_fb_dst"
  if [ "$DRY_RUN" != "--dry-run" ] && [ -f "$_fb_dst" ]; then
    chmod_safe +x "$_fb_dst" 2>/dev/null || true
  fi
  # #635: also refresh the hooks-scoped {"type":"module"} marker (mirrors the full-install copy_safe
  # at install.sh:915). Without this, a consumer upgraded via --refresh gets the new multi-file
  # pre-push.ts WITHOUT type:module → Node ≥22 dies with ERR_REQUIRE_CYCLE_MODULE on the require(esm)
  # bridge. Same AIF-owned, hooks-scoped marker — cannot collide with a consumer's own package.
  refresh_safe "$PKG_ROOT/packages/core/templates/shared/hooks-package.json" \
               "$PROJECT_ROOT/packages/core/hooks/package.json"

  # ── Skill-context overrides (derived from SHIPPED_DOCS — cannot drift) ──
  echo "▶ Skill-context → .ai-factory/skill-context/"
  for _doc in "${SHIPPED_DOCS[@]}"; do
    case "$_doc" in
      packages/core/templates/shared/skill-context/*/SKILL.md)
        _sc="${_doc#packages/core/templates/shared/skill-context/}"; _sc="${_sc%/SKILL.md}"
        refresh_safe "$PKG_ROOT/$_doc" "$PROJECT_ROOT/.ai-factory/skill-context/$_sc/SKILL.md" ;;
    esac
  done

  echo ""
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "✅ Dry-run complete (--refresh preview). Nothing was written."
    echo "   Re-run without --dry-run to apply, or add --force to also overwrite consumer files."
  else
    echo "✅ Framework artefacts refreshed."
    echo "   Consumer-owned files (AGENTS.md, RULES.md, ci.yml, eslint.config.mjs, etc.) were not touched."
    echo "   Files with a sibling .override.md were also preserved."
  fi
}

# ─── --refresh early-exit: run refresh then stop (skip the full install flow) ──
if [ -n "$REFRESH" ]; then
  do_refresh
  exit 0
fi

# ─── Shared globals (O2): initialized here before sourcing layers so every
# layer writes into the dispatcher's own shell scope (not a subshell). ────────
_r2_verdict=""
DEPS_INSTALLED=""
DEVDEPS=""

# ─── Source numbered layers in lexicographic order ───────────────────────────
# Dispatcher style = directory-glob loop (§4d-7 pre-resolved).
# Each layer is sourced (not exec'd) so mutations to SKIPPED/_r2_verdict/
# DEPS_INSTALLED persist back into this scope.
for f in "$PKG_ROOT"/setup.d/[0-9]*.sh; do
  # shellcheck source=/dev/null
  source "$f"
done
