#!/usr/bin/env bash
# setup.d/20-agents.sh — §2 Sub-agents + §3c skill-context overrides.
#
# Sources: lib.sh (already in dispatcher scope)
# S0 rows: §2 (install.sh:779-801), §3c (install.sh:838-845)
# Depends on: SHIPPED_DOCS (set in dispatcher scope before layers run)
# @cc-only-rationale: sourced by install.sh dispatcher, not standalone

# ─── 2. Sub-agents ──────────────────────────────────────
echo "▶ Sub-agents → .claude/agents/"
# C-1 agent-collision resolution (2026-05-20, research-patches/2026-05-20-agent-collision-resolution.md):
#   - best-practices-sidecar — KEEP-AIF: removed from our payload; AIF's rules-sidecar
#     (reads .ai-factory/RULES.md) + edit-time ESLint + pre-push are the real enforcers.
#   - docs-auditor — RENAMED to living-docs-auditor (de-collides with AIF's same-named agent).
#   - review-sidecar — still collides with AIF's. copy_safe DEFAULT (no --force) intentionally
#     SKIPS it when AIF's is present (AIF keeps its slot). Do NOT --force-overwrite it: that
#     would strip AIF frontmatter the implement-coordinator + aif-handoff pipeline depend on.
#     Instead our anti-tautology content is delivered into AIF's pipeline via the native
#     .ai-factory/skill-context/aif-review/SKILL.md override (copied in §3 below). The live
#     CC-dispatch probe (former DECISION-NEEDED #2) is RESOLVED: a background maxTurns:6
#     sidecar reads + applies skill-context (3/3 read, 2/2 apply) — SSOT #50, ADOPT.
#     agents/review-sidecar.md remains the portable SSOT (@dual-pair anchor: review-sidecar).
mkdir_safe "$PROJECT_ROOT/.claude/agents"
for f in "$PKG_ROOT"/agents/*.md; do
  case "$(basename "$f")" in
    manual-rule-liveness-prober.md) continue ;;  # authoring-only tool (#552)
    shipped-agent-liveness-prober.md) continue ;;  # authoring-only tool (M2 probe, #552 sibling)
    backward-sweep-auditor.md) continue ;;  # authoring-only tool (§1.7 backward-check cold-sweep, T21)
    adapter-jig-reviewer.md) continue ;;  # authoring-only tool (framework-side adapter-wiring conformance review, adapter-jig J1)
    dispatch-input-checker.md) continue ;;  # authoring-only station (arch-v2 S-B contract v2, dispatch-input reality-check)
    orchestrator-worker-discipline.md|reviewer-discipline.md)
      # F7 companion split (agents arm): these two presuppose the aif-handoff operator runtime
      # (runtime-bridge dispatch / reviewer-session protocol) — same class as the gated suite
      # skills in 10-skills.sh. Ship only under --with-aif-suite, or keep refreshing a copy
      # already on disk (presence = prior opt-in; parity with the skills gate in install.sh).
      if [ -z "${WITH_AIF_SUITE:-}" ] && [ ! -e "$PROJECT_ROOT/.claude/agents/$(basename "$f")" ]; then continue; fi ;;
  esac
  _dst="$PROJECT_ROOT/.claude/agents/$(basename "$f")"
  # Agents carry ](../docs/…) + ](../.claude/rules/…) refs that dangle on a consumer tree
  # (rules/ is not shipped) — transform freshly-written copies only, never a skipped
  # consumer-owned file (2026-07-10 flat-install smoke: first push red on lychee §8).
  _writes=1
  if [ -e "$_dst" ] && [ "$FORCE" != "--force" ]; then _writes=0; fi
  copy_safe "$f" "$_dst"
  if [ "$_writes" = 1 ] && [ "$DRY_RUN" != "--dry-run" ] && [ -f "$_dst" ]; then
    transform_internal_refs "$_dst"
  fi
done

# ─── §3c: skill-context overrides ───────────────────────
# skill-context overrides — AIF-native "extend a vendored sub-agent" mechanism (C-1, SSOT #50).
# AIF's own background sidecars MANDATORY-read .ai-factory/skill-context/<skill>/SKILL.md
# (verified live: a background maxTurns:6 sidecar reads + applies these). We ride that wiring
# instead of shipping colliding agents: aif-review gets our anti-tautology test-review content;
# aif-rules-check gets the R10-naming + test-existence residue of the removed best-practices-sidecar.
# Derive the skill-context copy set from SHIPPED_DOCS (single source — FQA P2 fix). Every
# skill-context entry that is header-verified above is copied here; the two lists cannot drift.
# `${arr[@]+"${arr[@]}"}` = bash-3.2-safe empty-array expansion under set -u (macOS ships 3.2).
for _doc in ${SHIPPED_DOCS[@]+"${SHIPPED_DOCS[@]}"}; do
  case "$_doc" in
    packages/core/templates/shared/skill-context/*/SKILL.md)
      _sc="${_doc#packages/core/templates/shared/skill-context/}"; _sc="${_sc%/SKILL.md}"
      # F7 companion split (skill-context arm): aif-orchestrator-discipline pairs with the
      # gated orchestrator-worker-discipline agent (@dual-pair) — suite-only, or present = prior opt-in.
      if [ "$_sc" = "aif-orchestrator-discipline" ] && [ -z "${WITH_AIF_SUITE:-}" ] \
        && [ ! -e "$PROJECT_ROOT/.ai-factory/skill-context/$_sc/SKILL.md" ]; then continue; fi
      mkdir_safe "$PROJECT_ROOT/.ai-factory/skill-context/$_sc"
      copy_safe "$PKG_ROOT/$_doc" "$PROJECT_ROOT/.ai-factory/skill-context/$_sc/SKILL.md" ;;
  esac
done
