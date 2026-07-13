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
#   ./install.sh ts-server --with-aif-suite     # also ship the AIF operator suite (aif-handoff runtime required)
#   ./install.sh ts-server --all                # everything: --full + --with-aif-suite (operator machines)
#   ./install.sh python                         # Python toolchain lane (non-npm; ast-grep + ruff, no package.json — see INSTALL-FOR-AI.md)
#
# What it does:
#   1. Copies skills/ + the consumer-facing core skill set
#      .claude/skills/{template-audit,ai-doc,rule-research}/ → .claude/skills/ (always).
#      With --with-aif-suite, also ships the AIF operator suite
#      {pipeline,dispatcher,aif-doctor,harvest,night-mode,story}/ (F7, owner GO 2026-07-10) —
#      those presuppose the aif-handoff operator runtime + `story`'s lang-pack (#934), so they
#      are opt-in, not default (see setup.d/10-skills.sh + --with-aif-suite below).
#      (all shipped from .claude/skills/ as single source of truth; ONLY self-reflection is
#       intentionally NOT shipped — repo-internal §1.7 self-review discipline per build-first-reuse-default.md §1.1 shipped-axis;
#       cross-refs to repo-internal paths get sed-transformed to GitHub blob URLs —
#       see UPSTREAM_BLOB_URL + transform_internal_refs() below;
#       per .claude/rules/dual-implementation-discipline.md §7 SSOT)
#   2. Copies agents/  → .claude/agents/ (consumer-facing set; orchestrator-worker-discipline +
#      reviewer-discipline are AIF-suite-gated — F7 agents arm; authoring-only probers never ship)
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
# Use --with-aif-suite to also ship the AIF operator suite: the six skills (pipeline, dispatcher,
# aif-doctor, harvest, night-mode, story) PLUS the two suite agents (orchestrator-worker-discipline,
# reviewer-discipline) and their aif-orchestrator-discipline skill-context. Those presuppose the
# aif-handoff operator runtime and story's lang-pack (#934); default installs only the
# consumer-facing core set. Opt-in + reversible (delete the six .claude/skills/ dirs, the two
# .claude/agents/ files and the skill-context dir to undo) — same posture as companions.manifest.
# Use --all as the operator shorthand for --full + --with-aif-suite («everything»).

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
# P0.3 (ultrareview): distinguish an EXPLICIT positional stack (the user typed `./setup ts-server`)
# from a stack that was auto-detected or menu-picked. The multi-stack monorepo config placement
# (setup.d/40-configs.sh via _resolve_workspace_stacks) consults this to honor the explicit choice
# for signal-free workspaces — the observed pnpm-hoisting bug ignored the positional arg entirely.
# Set ONLY on the positional-arg branch below; the auto-detect + interactive-menu paths leave it "".
STACK_EXPLICIT=""
FORCE=""
DRY_RUN=""
FULL=""
WIRE_CI=""
REFRESH=""
# python-delivery-v0 S2: the getff Python toolchain lane. TOOLCHAIN="" = the default npm lane;
# TOOLCHAIN="python" routes to the pure-bash Python delivery (setup.d/45-python.sh) instead of the
# npm stack pipeline. Set by an explicit `install.sh python` positional (always wins — the
# auto-detect block below is gated on `[ -z "$TOOLCHAIN" ]`, so a non-empty TOOLCHAIN already IS the
# "explicit wins" signal; no separate _EXPLICIT flag needed) OR by auto-detect (pyproject.toml
# present + no package.json → OFFER; non-interactive declines). The npm flow is untouched when
# TOOLCHAIN stays "" (byte-identical baselines are the gate).
TOOLCHAIN=""
# F7 (owner GO 2026-07-10): the AIF operator suite (pipeline dispatcher aif-doctor harvest
# night-mode story) ships ONLY under this explicit opt-in. Those five presuppose the aif-handoff
# operator runtime and `story` crashes on landing until its lang-pack ships (#934) — a consumer
# without that runtime should not get them by default. Opt-in + reversible, same posture as the
# companions.manifest flow (.claude/rules/companion-install-principle.md; BFR §1.1 integrate-
# never-hard-depend). The consumer-facing core set (template-audit ai-doc rule-research) stays
# default. See setup.d/10-skills.sh for the split.
WITH_AIF_SUITE=""
for arg in "$@"; do
  case "$arg" in
    --dry-run)              DRY_RUN="--dry-run" ;;
    --force)                FORCE="--force" ;;
    --full)                 FULL="--full" ;;
    --wire-ci)              WIRE_CI="--wire-ci" ;;
    --refresh)              REFRESH="--refresh" ;;
    --with-aif-suite)       WITH_AIF_SUITE="--with-aif-suite" ;;
    # --all = everything: --full (dev-deps, no prompts) + the AIF operator suite. Operator
    # convenience alias (owner directive 2026-07-11); consumer default (-y/--full) stays curated.
    --all)                  FULL="--full"; WITH_AIF_SUITE="--with-aif-suite" ;;
    ts-server|react-next|react-spa|react-native)   STACK="$arg"; STACK_EXPLICIT="1" ;;
    # python = a TOOLCHAIN lane, not a fifth npm stack. Explicit positional → always wins over
    # auto-detect (python-delivery-v0 S2 §1). Routed to do_python_lane below, before the npm
    # package.json precondition + stack pick, then early-exits (never touches the npm layer loop).
    python)                 TOOLCHAIN="python" ;;
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

# ─── getff Python toolchain lane (python-delivery-v0 S2) ─────────────────────
# A NON-npm entry: delivers the pre-rendered ast-grep + ruff lint bundle (setup.d/45-python.sh) into a
# consumer PYTHON project, then proves it fires. Runs the pure-bash delivery under the env-var contract
# GETFF_TOOLCHAIN=python and EXITS — it never enters the npm package.json precondition, stack pick, or
# the setup.d layer loop, so no npm-assuming step fires on this lane. do_python_lane is defined here so
# it is in scope for the detection block just below (which runs before the npm package.json require).
do_python_lane() {
  export GETFF_TOOLCHAIN=python
  [ -n "$REFRESH" ] && export GETFF_TOOLCHAIN_REFRESH=1
  if [ -n "$REFRESH" ]; then
    echo "▶ Refreshing getff Python toolchain artefacts in $PROJECT_ROOT"
  else
    echo "▶ Installing getff Python toolchain into $PROJECT_ROOT"
  fi
  # Source the delivery layer: its activation guard (GETFF_TOOLCHAIN=python) runs
  # deliver_python_toolchain, reusing copy_safe/refresh_safe from lib.sh (already in scope). The layer
  # also DEFINES _py_firing_self_check (helper) without auto-running it — we call it below so the
  # firing proof is an install-flow concern (parity with 99-finalize.sh's capstone self-verify).
  # shellcheck source=setup.d/45-python.sh
  source "$PKG_ROOT/setup.d/45-python.sh"
  # Post-install firing self-check: always-run with graceful degrade (matches the 99-finalize.sh
  # capstone UX — no separate opt-in flag; an absent tool degrades loudly, never silently green).
  # Skipped only under --dry-run (nothing was written to fire against).
  if [ "$DRY_RUN" != "--dry-run" ]; then
    _py_firing_self_check
  else
    echo "  [dry-run] would run the getff firing self-check (plant a violation in an OS temp dir → assert ast-grep + ruff fire RED)"
  fi
  echo ""
  echo "✅ getff Python toolchain ${REFRESH:+re-}delivery complete."
}

# Python-lane detection (before the npm package.json precondition, which a python repo cannot satisfy):
#   (a) explicit `install.sh python` positional → TOOLCHAIN already "python" (always wins).
#   (b) --refresh of a PRIOR python install (marker: .getff-python-install.log or .getff/astgrep-rules) —
#       ONLY when no explicit npm STACK arg was given (STACK_EXPLICIT). Review fix (S2 round 1): an
#       explicit `install.sh ts-server --refresh` on a repo that carries BOTH package.json and a stale
#       python marker must refresh the npm stack, not silently reroute to the python-only refresh and
#       exit 0 — that used to skip the npm refresh entirely with no error. An explicit stack/toolchain
#       arg now always takes precedence over the marker auto-detect.
#   (c) fresh auto-detect: pyproject.toml present + NO package.json → OFFER. Interactive prompt defaults
#       No; the non-interactive (-y/--full) and --dry-run paths DECLINE (npm lane) — the explicit
#       `python` positional is the non-interactive opt-in (kickoff §1 detect order).
if [ -z "$TOOLCHAIN" ]; then
  if [ -n "$REFRESH" ] && [ -z "$STACK_EXPLICIT" ] && { [ -f "$PROJECT_ROOT/.getff-python-install.log" ] || [ -d "$PROJECT_ROOT/.getff/astgrep-rules" ]; }; then
    TOOLCHAIN="python"
  elif [ -z "$REFRESH" ] && [ ! -f "$PROJECT_ROOT/package.json" ] && [ -f "$PROJECT_ROOT/pyproject.toml" ]; then
    if [ -n "$FULL" ] || [ "$DRY_RUN" = "--dry-run" ]; then
      : # non-interactive / dry-run → decline (npm lane). Explicit `python` arg is the opt-in.
    else
      echo "▶ Detected a Python project (pyproject.toml present, no package.json)."
      # Review fix (S2 round 1): a bare `read` returns non-zero at EOF (non-tty invocation with a
      # closed stdin, e.g. this script run without -y in CI or a scripted harness) — under
      # `set -euo pipefail` that used to abort the whole script right here with a message-less
      # `exit 1`, instead of falling through to the documented "decline → npm lane → clean
      # no-package.json abort" behaviour. `|| _py_ans=""` makes the read EOF-safe: a closed stdin is
      # treated as an empty (declining) answer, same as an explicit empty Enter-press.
      read -rp "  Install the getff Python toolchain lane (ast-grep + ruff rules)? [y/N]: " _py_ans || _py_ans=""
      case "$_py_ans" in [yY]|[yY][eE][sS]) TOOLCHAIN="python" ;; esac
    fi
  fi
fi

if [ "$TOOLCHAIN" = "python" ]; then
  do_python_lane
  exit 0
fi

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
      backward-sweep-auditor.md) continue ;;  # authoring-only tool (§1.7 backward-check cold-sweep, T21)
      orchestrator-worker-discipline.md|reviewer-discipline.md)
        # F7 companion split (agents arm) — parity with setup.d/20-agents.sh: suite-only,
        # or keep refreshing a copy already on disk (presence = prior --with-aif-suite opt-in).
        if [ -z "${WITH_AIF_SUITE:-}" ] && [ ! -e "$PROJECT_ROOT/.claude/agents/$(basename "$f")" ]; then continue; fi ;;
    esac
    _dst="$PROJECT_ROOT/.claude/agents/$(basename "$f")"
    refresh_safe "$f" "$_dst"
    # Transform freshly-refreshed copies only (override-kept files untouched) — parity with
    # setup.d/20-agents.sh. Without this, --refresh reintroduces dangling rules/ links and the
    # consumer's next push after an upgrade goes red on pre-push §8 lychee (cold-review of
    # 081447838, reproduced: 35 broken links post-refresh).
    if [ "$DRY_RUN" != "--dry-run" ] && [ ! -e "${_dst%.md}.override.md" ] && [ -f "$_dst" ]; then
      transform_internal_refs "$_dst"
    fi
  done

  # ── Skills (plain copy + internal-ref transform) ────────
  echo "▶ Skills (getff, tool-bootstrapping) → .claude/skills/"
  for _slug in getff tool-bootstrapping; do
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
    # Same transform pass as the install path (setup.d/10-skills.sh) — install/refresh parity.
    while IFS= read -r -d '' _mdfile; do
      transform_internal_refs "$_mdfile"
    done < <(find "$_dst" -name '*.md' -print0)
    echo "  ✓ .claude/skills/$_slug/ (refreshed, cross-refs rewritten to ${UPSTREAM_BLOB_URL})"
  done

  # ── Orchestration skills (with internal-ref transform) ──
  # Consumer-facing core set: always refreshed. AIF operator suite (F7): refreshed ONLY when
  # already present on disk (presence = prior --with-aif-suite opt-in) OR the flag is passed now.
  # Absence + no flag = never installed → refresh must NOT create it (else refresh silently
  # opts a consumer into the runtime-dependent suite). See setup.d/10-skills.sh for the split.
  echo "▶ Orchestration skills → .claude/skills/"
  for _skill in template-audit ai-doc rule-research; do
    refresh_skill_with_transform "$_skill"
  done
  for _skill in pipeline dispatcher aif-doctor harvest night-mode story; do
    if [ -n "$WITH_AIF_SUITE" ] || [ -e "$PROJECT_ROOT/.claude/skills/$_skill" ]; then
      refresh_skill_with_transform "$_skill"
    fi
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

  # GH #934: refresh coverage for the end-of-turn session-recap Stop hook + lang pack (parity with
  # the fresh-install delivery in setup.d/10-skills.sh §1c — closes the refresh-drift class #869/#890).
  # A brownfield consumer that installed before #934 gets the hook + the Stop registration via --refresh.
  _EOT_SRC="$PKG_ROOT/.claude/hooks/end-of-turn-reminder.sh"
  _EOT_DST="$PROJECT_ROOT/.claude/hooks/end-of-turn-reminder.sh"
  if [ -f "$_EOT_SRC" ]; then
    refresh_safe "$_EOT_SRC" "$_EOT_DST"
    # if-then (not `A && B || true`) to stay SC2015-clean under the pinned shellcheck 0.9.0 gate
    # — parity with the deps-hash block above.
    if [ "$DRY_RUN" != "--dry-run" ] && [ -f "$_EOT_DST" ]; then chmod_safe +x "$_EOT_DST" 2>/dev/null || true; fi
    mkdir_safe "$PROJECT_ROOT/.claude/hooks/lang"
    for _lp in en.sh ru.sh check-parity.sh; do
      [ -f "$PKG_ROOT/.claude/hooks/lang/$_lp" ] && refresh_safe "$PKG_ROOT/.claude/hooks/lang/$_lp" "$PROJECT_ROOT/.claude/hooks/lang/$_lp"
    done
    if [ "$DRY_RUN" != "--dry-run" ]; then chmod_safe +x "$PROJECT_ROOT/.claude/hooks/lang/check-parity.sh" 2>/dev/null || true; fi
    if [ "$DRY_RUN" != "--dry-run" ]; then
      register_cc_hook "$PROJECT_ROOT/.claude/settings.json" "Stop" 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/end-of-turn-reminder.sh"' "end-of-turn-reminder"
    fi
  fi

  # GH #934: refresh coverage for the two session-UX hooks (setup.d/10-skills.sh §1d/§1e parity) —
  # ask-question-reminder (PreToolUse:AskUserQuestion) + inject-matching-rule (PostToolUse:Edit|Write).
  # A brownfield consumer installed before #934 gets both hooks + their matcher-scoped registration
  # via --refresh (not --force-only). ask-question-reminder reuses the lang pack refreshed above.
  _AQR_SRC="$PKG_ROOT/.claude/hooks/ask-question-reminder.sh"
  _AQR_DST="$PROJECT_ROOT/.claude/hooks/ask-question-reminder.sh"
  if [ -f "$_AQR_SRC" ]; then
    refresh_safe "$_AQR_SRC" "$_AQR_DST"
    if [ "$DRY_RUN" != "--dry-run" ] && [ -f "$_AQR_DST" ]; then chmod_safe +x "$_AQR_DST" 2>/dev/null || true; fi
    if [ "$DRY_RUN" != "--dry-run" ]; then
      register_cc_hook "$PROJECT_ROOT/.claude/settings.json" "PreToolUse" 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/ask-question-reminder.sh"' "ask-question-reminder" "AskUserQuestion"
    fi
  fi
  _IMR_SRC="$PKG_ROOT/.claude/hooks/inject-matching-rule.sh"
  _IMR_DST="$PROJECT_ROOT/.claude/hooks/inject-matching-rule.sh"
  if [ -f "$_IMR_SRC" ]; then
    refresh_safe "$_IMR_SRC" "$_IMR_DST"
    if [ "$DRY_RUN" != "--dry-run" ] && [ -f "$_IMR_DST" ]; then chmod_safe +x "$_IMR_DST" 2>/dev/null || true; fi
    if [ "$DRY_RUN" != "--dry-run" ]; then
      register_cc_hook "$PROJECT_ROOT/.claude/settings.json" "PostToolUse" 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/inject-matching-rule.sh"' "inject-matching-rule" "Edit|Write"
    fi
  fi
  # GH #934 batch B: refresh coverage for the output-language UserPromptSubmit hook (setup.d/10-skills.sh
  # §1f parity). A brownfield consumer installed before batch B gets it + the registration via --refresh.
  _OLH_SRC="$PKG_ROOT/.claude/hooks/inject-output-language.sh"
  _OLH_DST="$PROJECT_ROOT/.claude/hooks/inject-output-language.sh"
  if [ -f "$_OLH_SRC" ]; then
    refresh_safe "$_OLH_SRC" "$_OLH_DST"
    if [ "$DRY_RUN" != "--dry-run" ] && [ -f "$_OLH_DST" ]; then chmod_safe +x "$_OLH_DST" 2>/dev/null || true; fi
    if [ "$DRY_RUN" != "--dry-run" ]; then
      register_cc_hook "$PROJECT_ROOT/.claude/settings.json" "UserPromptSubmit" 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/inject-output-language.sh"' "inject-output-language"
    fi
  fi
  # GH #934 batch C: refresh coverage for the doc authority-header check hook (setup.d/10-skills.sh
  # §1g parity). A brownfield consumer installed before batch C gets it + the registration via --refresh.
  _CAH_SRC="$PKG_ROOT/.claude/hooks/check-authority-header.sh"
  _CAH_DST="$PROJECT_ROOT/.claude/hooks/check-authority-header.sh"
  if [ -f "$_CAH_SRC" ]; then
    refresh_safe "$_CAH_SRC" "$_CAH_DST"
    if [ "$DRY_RUN" != "--dry-run" ] && [ -f "$_CAH_DST" ]; then chmod_safe +x "$_CAH_DST" 2>/dev/null || true; fi
    if [ "$DRY_RUN" != "--dry-run" ]; then
      register_cc_hook "$PROJECT_ROOT/.claude/settings.json" "PostToolUse" 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/check-authority-header.sh"' "check-authority-header" "Edit|Write"
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
    "packages/core/audit-self/check-lintstaged-resolves.sh:scripts/check-lintstaged-resolves.sh" \
    "packages/core/audit-self/check-fences-fire.sh:scripts/check-fences-fire.sh" \
    "packages/core/audit-self/check-shields-up.sh:scripts/check-shields-up.sh" \
    "packages/core/synthesizer/run-generated-rule-mutation.sh:scripts/run-generated-rule-mutation.sh"; do
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

  # ── Custom ESLint rules plugin → eslint-rules-local/ (#869-class: framework-owned) ──
  # 40-configs.sh copy_safe's framework-authored rules into eslint-rules-local/ as PRE-COMPILED
  # .mjs + .d.ts + .ts (fix #752): the CORE rules (always) PLUS the stack's PRESET rules
  # (react-next → no-server-imports-in-client; react-spa → require-error-boundary). All are
  # framework-namespace files a consumer never owns (setup.d/lib.sh:194) — DISTINCT from the
  # packages/core/eslint-rules/ copy above (guard-liveness dep). A rule-logic fix must reach a
  # brownfield consumer non-destructively; copy_safe skip-if-exists cannot deliver it. Iterate the
  # SAME source dirs (core + per-stack presets) the _copy_rule delivery uses at 40-configs.sh:128-157
  # so the refresh set tracks delivery — the refresh-covers-full-delivery gate Check 3 enforces this
  # source-dir parity (a core-only refresh silently stranded preset rules on react-next/react-spa
  # consumers before this — the exact #869 class, verified live).
  echo "▶ Custom ESLint rules → eslint-rules-local/"
  _rule_dirs="packages/core/eslint-rules"
  if [ "$STACK" = "react-next" ]; then _rule_dirs="$_rule_dirs packages/preset-next-15-canonical/eslint-rules"; fi
  if [ "$STACK" = "react-spa" ];  then _rule_dirs="$_rule_dirs packages/preset-react-spa/eslint-rules"; fi
  for _rdir in $_rule_dirs; do
    for _rl in "$PKG_ROOT/$_rdir"/*.ts; do
      case "$_rl" in
        *.test.ts|*.d.ts|*/index.ts) continue ;;
      esac
      [ -e "$_rl" ] || continue   # empty-glob guard (nullglob off → literal *.ts)
      _rlstem="${_rl%.ts}"; _rlbn="$(basename "$_rlstem")"
      refresh_safe "$_rl" "$PROJECT_ROOT/eslint-rules-local/$_rlbn.ts"
      [ -f "$_rlstem.mjs" ]  && refresh_safe "$_rlstem.mjs"  "$PROJECT_ROOT/eslint-rules-local/$_rlbn.mjs"
      [ -f "$_rlstem.d.ts" ] && refresh_safe "$_rlstem.d.ts" "$PROJECT_ROOT/eslint-rules-local/$_rlbn.d.ts"
    done
  done

  # ── fences-fire fixtures (directory payload) → scripts/ (#873) ──
  # Directory payload: refresh_safe now replaces (not nests) an existing dir (setup.d/lib.sh, #873).
  refresh_safe "$PKG_ROOT/packages/core/audit-self/fixtures/fences-fire" "$PROJECT_ROOT/scripts/fences-fire-fixtures"

  # ── Regenerate the eslint-rules-local barrel + prune stack-absent fixtures (#876) ──
  # do_refresh re-delivers individual rule files above but the GENERATED index.mjs barrel would keep
  # its old import list → a newly-shipped rule lands unregistered. Regenerate from the on-disk rule
  # set (matches whatever this stack's refresh loop just delivered). Runs AFTER the fixtures refresh
  # so the #838 prune inside the helper sees the freshly-delivered fixtures. SSOT helper (setup.d/lib.sh).
  # #882 (fixed): --refresh with a DIFFERENT stack than the original install used to leave a PRIOR
  # stack's preset rule stranded on disk, silently re-registered into the regenerated barrel. Fixed
  # inside generate_eslint_barrel() itself (setup.d/lib.sh) — it now prunes any eslint-rules-local/*.ts
  # not valid for the CURRENT $STACK before generating barrel content, so this call covers both the
  # --force and --refresh paths without any change needed here.
  generate_eslint_barrel

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

  # ── Husky hook dispatchers → .husky/ (#869-class: framework-owned) ──
  # 50-hooks.sh:11-12 copy_safe's these framework-authored dispatchers into .husky/ (skip-if-
  # exists). They are NOT consumer config — husky-pre-push.sh is "the TS-core dispatcher shipped
  # by install.sh". #636/#638 added a load-bearing tsx-ESM probe to husky-pre-push.sh without
  # which the hook HARD-CRASHES instead of degrading to the bash fallback on a pnpm monorepo. A
  # brownfield consumer whose .husky/pre-push predates that fix can only receive it non-
  # destructively via --refresh — copy_safe never updates it. refresh_safe honours a sibling
  # .husky/pre-push.override.md for a consumer that has taken Layer-3 ownership.
  # LITERAL destinations (not a loop var): the delivery in 50-hooks.sh names these two files
  # literally, so the refresh must too — a per-file refresh-completeness gate can only exact-match
  # a literal against a literal (a collapsed .husky/ namespace target would let a future
  # literally-delivered .husky/* file slip through refresh undetected).
  echo "▶ Husky hooks → .husky/"
  refresh_safe "$PKG_ROOT/packages/core/templates/shared/husky-pre-commit.sh" "$PROJECT_ROOT/.husky/pre-commit"
  refresh_safe "$PKG_ROOT/packages/core/templates/shared/husky-pre-push.sh"   "$PROJECT_ROOT/.husky/pre-push"
  if [ "$DRY_RUN" != "--dry-run" ]; then
    chmod_safe +x "$PROJECT_ROOT/.husky/pre-commit" "$PROJECT_ROOT/.husky/pre-push" 2>/dev/null || true
  fi

  # ── Prettier ignore (managed block) — #890 ──────────────
  # The static .prettierignore template's managed block ships via merge_prettierignore (40-configs.sh)
  # on the --full path only. do_refresh MUST also deliver it, else a new shipped ignore pattern (e.g.
  # #889's .ai-factory/ARCHITECTURE.*.md) never reaches an already-installed consumer without --force
  # — the #869 "refresh omits a --full-delivered artefact" class, on the merge-delivered surface.
  # merge_prettierignore is genuinely idempotent (#890 fix): it inserts only missing patterns into the
  # existing block (single block preserved). Honour a sibling .prettierignore.override.md (Layer-3
  # consumer ownership), mirroring refresh_safe's .override.md handling.
  echo "▶ Prettier ignore → .prettierignore"
  if [ -e "$PROJECT_ROOT/.prettierignore.override.md" ]; then
    if [ "$DRY_RUN" = "--dry-run" ]; then
      echo "  [dry-run] would skip: .prettierignore (.override.md — consumer-owned)"
    else
      echo "  ⊝ .prettierignore (.override.md — consumer-owned, keeping)"
    fi
  else
    merge_prettierignore "$PKG_ROOT/packages/core/templates/shared/.prettierignore" "$PROJECT_ROOT/.prettierignore"
  fi

  # ── .ai-factory SoT pair (DESCRIPTION.md + ARCHITECTURE.md) → .ai-factory/ (#949) ──
  # AGENTS.md points the very first agent session at .ai-factory/DESCRIPTION.md + ARCHITECTURE.md.
  # The --full path materializes them (setup.d/30-templates.sh); a brownfield consumer whose install
  # predates that feature has DANGLING references until they run --refresh. copy_safe (no-clobber)
  # semantics — NOT refresh_safe — because these are consumer-EDITABLE content docs: a fresh install
  # that never wrote them (or a consumer who deleted one) gets the starter, but an edited
  # DESCRIPTION.md/ARCHITECTURE.md is NEVER overwritten (copy_safe skips-if-exists). $STACK is always
  # resolved on the --refresh path (install.sh stack inference defaults to ts-server), so the arch
  # variant is chosen, never guessed. SSOT helpers (arch_sot_src_for_stack / rewrite_arch_sot_header,
  # setup.d/lib.sh) shared with the --full delivery so the two paths cannot diverge.
  echo "▶ .ai-factory SoT → .ai-factory/"
  copy_safe "$PKG_ROOT/packages/core/templates/shared/DESCRIPTION.template.md" "$PROJECT_ROOT/.ai-factory/DESCRIPTION.md"
  _arch_sot_src="$(arch_sot_src_for_stack)"
  _arch_sot_dst="$PROJECT_ROOT/.ai-factory/ARCHITECTURE.md"
  _arch_sot_existed=0; [ -e "$_arch_sot_dst" ] && _arch_sot_existed=1
  copy_safe "$_arch_sot_src" "$_arch_sot_dst"
  rewrite_arch_sot_header "$_arch_sot_dst" "$_arch_sot_existed"

  # ── Skill-context overrides (derived from SHIPPED_DOCS — cannot drift) ──
  echo "▶ Skill-context → .ai-factory/skill-context/"
  for _doc in "${SHIPPED_DOCS[@]}"; do
    case "$_doc" in
      packages/core/templates/shared/skill-context/*/SKILL.md)
        _sc="${_doc#packages/core/templates/shared/skill-context/}"; _sc="${_sc%/SKILL.md}"
        # F7 companion split (skill-context arm) — parity with setup.d/20-agents.sh §3c.
        if [ "$_sc" = "aif-orchestrator-discipline" ] && [ -z "${WITH_AIF_SUITE:-}" ] \
          && [ ! -e "$PROJECT_ROOT/.ai-factory/skill-context/$_sc/SKILL.md" ]; then continue; fi
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
