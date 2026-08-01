#!/usr/bin/env bash
# setup.d/30-templates.sh — §3a AI Factory templates + §3b tool-decisions + §3d stack-specific + §5b AGENTS.md.
#
# Sources: lib.sh (already in dispatcher scope)
# S0 rows: §3a (install.sh:802-814), §3b (install.sh:824-830), §3d (install.sh:848-859),
#          §5b AGENTS.md (install.sh:949)
# Depends on: SHIPPED_DOCS (set in dispatcher scope)
# @cc-only-rationale: sourced by install.sh dispatcher, not standalone
# O6: MIXED §3 cut at sub-step boundary, not the §3 header.

# ─── 3. AI Factory templates ────────────────────────────
echo "▶ AI Factory templates → .ai-factory/"
mkdir_safe "$PROJECT_ROOT/.ai-factory/rules"
# Consumer backlog home for /pipeline (kickoffs + plan + scratch). Agnostic namespace so the
# backlog is portable across harnesses (.claude/ is Claude-Code-specific). Empty until the
# consumer writes their first kickoff; /pipeline treats empty as "nothing queued", not an error.
mkdir_safe "$PROJECT_ROOT/.ai-factory/orchestrator-prompts"
copy_safe "$PKG_ROOT/packages/core/templates/shared/DESCRIPTION.template.md" "$PROJECT_ROOT/.ai-factory/DESCRIPTION.template.md"
copy_safe "$PKG_ROOT/packages/core/templates/shared/ARCHITECTURE.ts-server.md" "$PROJECT_ROOT/.ai-factory/ARCHITECTURE.ts-server.md"
# Base RULES.md is the stack's primary rule doc. ts-server/react-next share the manifest-rendered
# multi-stack preset-next RULES.md (Stack column carries per-stack applicability); react-spa and
# react-native each ship their own standalone preset-tailored RULES.md (no Stack column). The
# `else` keeps the ts-server/react-next output byte-identical to before these branches existed.
if [ "$STACK" = "react-spa" ]; then
  copy_safe "$PKG_ROOT/packages/preset-react-spa/RULES.md" "$PROJECT_ROOT/.ai-factory/RULES.md"
elif [ "$STACK" = "react-native" ]; then
  copy_safe "$PKG_ROOT/packages/preset-react-native/RULES.md" "$PROJECT_ROOT/.ai-factory/RULES.md"
else
  copy_safe "$PKG_ROOT/packages/preset-next-15-canonical/RULES.md" "$PROJECT_ROOT/.ai-factory/RULES.md"
fi
copy_safe "$PKG_ROOT/packages/core/templates/shared/integration-rules.md" "$PROJECT_ROOT/.ai-factory/rules/integration-rules.md"

# Seed tool-decisions.md so the deps-change re-evaluation hook actually fires (FQA S1-B P1:
# deps-hash-check.sh short-circuits to silent exit 0 when this file is absent — on the ./setup
# path nothing ever created it, so the whole automation was dead). The template carries the
# `deps-hash: <pending>` sentinel (DN-1 = Option B): the hook WARNs every session until the
# consumer runs /tool-bootstrapping once, which stamps the real hash. file-deploy only (kind
# identical to the seeds above) — no npm/package.json dependency at install time.
# CONCERN: S3 tool-bootstrap — this seeds the tool-decisions.md template, which is a file-deploy.
# The actual tool-bootstrapping workflow (picking tools, recording decisions) is a separate S3 concern.
copy_safe "$PKG_ROOT/skills/tool-bootstrapping/templates/tool-decisions.md.template" "$PROJECT_ROOT/.ai-factory/tool-decisions.md"

# ─── §3d: stack-specific .ai-factory/ files ─────────────
if [ "$STACK" = "react-next" ]; then
  copy_safe "$PKG_ROOT/packages/preset-next-15-canonical/templates/ARCHITECTURE.react-next.md" "$PROJECT_ROOT/.ai-factory/ARCHITECTURE.react-next.md"
  copy_safe "$PKG_ROOT/packages/preset-next-15-canonical/RULES.react-next.md" "$PROJECT_ROOT/.ai-factory/RULES.react-next.md"
fi
if [ "$STACK" = "react-spa" ]; then
  copy_safe "$PKG_ROOT/packages/preset-react-spa/templates/ARCHITECTURE.react-spa.md" "$PROJECT_ROOT/.ai-factory/ARCHITECTURE.react-spa.md"
  copy_safe "$PKG_ROOT/packages/preset-react-spa/RULES.react-spa.md" "$PROJECT_ROOT/.ai-factory/RULES.react-spa.md"
fi
if [ "$STACK" = "react-native" ]; then
  copy_safe "$PKG_ROOT/packages/preset-react-native/templates/ARCHITECTURE.react-native.md" "$PROJECT_ROOT/.ai-factory/ARCHITECTURE.react-native.md"
  copy_safe "$PKG_ROOT/packages/preset-react-native/RULES.react-native.md" "$PROJECT_ROOT/.ai-factory/RULES.react-native.md"
fi

# ─── Materialize the AGENTS.md-referenced SoT (.ai-factory/DESCRIPTION.md + ARCHITECTURE.md) ──
# AGENTS.md.template sends the very first agent session to `.ai-factory/DESCRIPTION.md` and
# `.ai-factory/ARCHITECTURE.md`. Historically the installer shipped only DESCRIPTION.template.md +
# ARCHITECTURE.<stack>.md and asked the HUMAN to manually rename — so on landing the referenced
# files did not exist (dangling references as the framework's first impression). Materialize them
# here with copy_safe semantics: NEVER clobber a consumer-edited DESCRIPTION.md/ARCHITECTURE.md on
# re-run (--refresh early-exits before this file is sourced, so only the normal install path runs).
# Source the stack-appropriate ARCHITECTURE variant directly from $PKG_ROOT (order-independent).
# Stack→source map + header rewrite are the SSOT helpers in setup.d/lib.sh (shared with do_refresh,
# #949) — this delivery must never diverge from the --refresh delivery.
_arch_sot_src="$(arch_sot_src_for_stack)"
copy_safe "$PKG_ROOT/packages/core/templates/shared/DESCRIPTION.template.md" "$PROJECT_ROOT/.ai-factory/DESCRIPTION.md"

_arch_sot_dst="$PROJECT_ROOT/.ai-factory/ARCHITECTURE.md"
_arch_sot_existed=0; [ -e "$_arch_sot_dst" ] && _arch_sot_existed=1
copy_safe "$_arch_sot_src" "$_arch_sot_dst"
rewrite_arch_sot_header "$_arch_sot_dst" "$_arch_sot_existed"

# ── aif-handoff integration note ─────────────────────────
# Per Stage 2 v3 §4.6 — single informational note, no prompt needed;
# our Phase 3 skill-context files ARE the client-side aif-handoff integration.
echo "  ✓ aif-handoff integration: skill-context files installed at .ai-factory/skill-context/ (auto)"

# ─── §5b: AGENTS.md ─────────────────────────────────────
copy_safe "$PKG_ROOT/packages/core/templates/shared/AGENTS.md.template" "$PROJECT_ROOT/AGENTS.md"

# ─── §3e: tier-home doc (env+ profile only; beta-delivery-ux S3 / spec A3) ───
# The authoritative Tier 0/1/2 criteria + capability-absence degradation matrix. CLAUDE.md
# «Task-tier routing» in the operator repo points here; the consumer's AGENTS.md (rendered from
# AGENTS.md.template) carries a pointer in its §Tier routing + degradation section.
#
# F-A′ PARKED (kickoff §1.1/§7): the payload-home choice between Option A
# (.ai-factory/tier-home.md — lighter, file-on-disk) and Option B
# (.ai-factory/skill-context/tier-home/SKILL.md — structured, skill-context-loaded) is deferred
# to the maintainer. BOTH candidate paths are wired here so the post-decision follow-up is
# delete-one-not-rewrite. The unchosen path is removed when the maintainer signs off.
if [ "${PROFILE:-core}" = "env" ] || [ "${PROFILE:-core}" = "factory" ]; then
  copy_safe "$PKG_ROOT/packages/core/templates/shared/tier-home.md" "$PROJECT_ROOT/.ai-factory/tier-home.md"
  mkdir_safe "$PROJECT_ROOT/.ai-factory/skill-context/tier-home"
  copy_safe "$PKG_ROOT/packages/core/templates/shared/tier-home.md" "$PROJECT_ROOT/.ai-factory/skill-context/tier-home/SKILL.md"
  echo "  ✓ tier-home doc installed at .ai-factory/tier-home.md + .ai-factory/skill-context/tier-home/SKILL.md (profile: $PROFILE; F-A′ PARKED)"
fi
