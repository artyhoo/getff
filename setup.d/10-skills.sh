#!/usr/bin/env bash
# setup.d/10-skills.sh — §1 Skills + §1b Hooks (deps-hash-check CC hook).
#
# Sources: lib.sh (already in dispatcher scope)
# S0 rows: §1 (install.sh:689-745), §1b (install.sh:747-778)
# Depends on: (none — first content layer)
# @cc-only-rationale: sourced by install.sh dispatcher, not standalone

# ─── 1. Skills ──────────────────────────────────────────
echo "▶ Skills → .claude/skills/"
mkdir_safe "$PROJECT_ROOT/.claude/skills"
if [ -e "$PROJECT_ROOT/.claude/skills/rules-as-tests" ] && [ "$FORCE" != "--force" ]; then
  SKIPPED+=("$PROJECT_ROOT/.claude/skills/rules-as-tests")
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would skip: .claude/skills/rules-as-tests (exists)"
  else
    echo "  ⊝ .claude/skills/rules-as-tests (exists — skipping)"
  fi
elif [ "$DRY_RUN" = "--dry-run" ]; then
  echo "  [dry-run] would copy: $PKG_ROOT/skills/rules-as-tests → $PROJECT_ROOT/.claude/skills/rules-as-tests"
else
  rm -rf "$PROJECT_ROOT/.claude/skills/rules-as-tests"
  cp -r "$PKG_ROOT/skills/rules-as-tests" "$PROJECT_ROOT/.claude/skills/rules-as-tests"
  echo "  ✓ .claude/skills/rules-as-tests/"
fi
if [ -e "$PROJECT_ROOT/.claude/skills/tool-bootstrapping" ] && [ "$FORCE" != "--force" ]; then
  SKIPPED+=("$PROJECT_ROOT/.claude/skills/tool-bootstrapping")
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would skip: .claude/skills/tool-bootstrapping (exists)"
  else
    echo "  ⊝ .claude/skills/tool-bootstrapping (exists — skipping)"
  fi
elif [ "$DRY_RUN" = "--dry-run" ]; then
  echo "  [dry-run] would copy: $PKG_ROOT/skills/tool-bootstrapping → $PROJECT_ROOT/.claude/skills/tool-bootstrapping"
else
  rm -rf "$PROJECT_ROOT/.claude/skills/tool-bootstrapping"
  cp -r "$PKG_ROOT/skills/tool-bootstrapping" "$PROJECT_ROOT/.claude/skills/tool-bootstrapping"
  echo "  ✓ .claude/skills/tool-bootstrapping/"
fi
# meta-orchestrator + its orchestration companions: shipped from authoring location
# .claude/skills/ as single source of truth (no separate mirror under skills/). Repo-internal
# cross-refs in .md files get rewritten to GitHub blob URLs via transform_internal_refs().
#
# F7 split (owner GO 2026-07-10): the set divides into a consumer-facing CORE set (always shipped)
# and an AIF operator SUITE (shipped ONLY under --with-aif-suite). The suite presupposes the
# aif-handoff operator runtime; on a consumer without it those triggers fire into a dead end, and
# `story` crashes on landing until its lang-pack ships (#934). Gating is opt-in + reversible (BFR
# §1.1 integrate-never-hard-depend; same posture as companions.manifest — companion-install-principle.md).
#
# CORE (always — consumer-facing, no aif-handoff runtime assumed):
#   - template-audit — local advisory audit of the rendered templates this installer ships.
#   - ai-doc         — AI-doc authoring standard (channel selection, doc-authority header,
#                      rule-as-test, AI-agnostic authoring) — reusable by consumers who author
#                      their own skills/rules.
#   - rule-research  — bootstrap stack-aware ESLint rules from LIVE docs (consumer-facing by design).
#
# AIF operator SUITE (only under --with-aif-suite — presupposes the aif-handoff runtime):
#   - pipeline      — the planner (/pipeline): umbrella triage, priority ranking, plan/state.md.
#   - dispatcher    — pipeline's execution companion: dispatches a chosen umbrella's stages
#                     through the aif-control loop the ./setup runtime-bridge step installs.
#   - aif-doctor    — diagnoses that same aif-handoff runtime when a task stalls / runtime breaks.
#   - harvest        — egress a finished aif-agent branch into a PR (host-push default, API
#                      break-glass) for consumers running aif-handoff.
#   - night-mode     — overnight-autonomous orchestration over SDD (executor + dual-reviewer +
#                      on-demand top-tier advisor); harness-agnostic, relative model tiers,
#                      graceful degradation on non-CC / sequential-only / single-tier harnesses.
#   - story          — plain-language, by-act recap of a session's work (AIF_HOOK_LANG-gated
#                      output). Stays in the gated set until its lang-pack delivery is fixed
#                      (#934) — it crashes on landing without the pack.
#
# Only self-reflection is intentionally NOT shipped at all: it is the §1.7 self-review discipline
# specific to THIS repo's own development process (not a reusable consumer capability) — see the
# build-vs-reuse shipped-axis default in .claude/rules/build-first-reuse-default.md §1.1 +
# dual-implementation-discipline.md §3.
# Repo-internal cross-refs (docs/packages/scripts/.claude/rules/README) are rewritten to GitHub blob
# URLs by copy_skill_with_transform → transform_internal_refs; sibling-skill links stay relative (sibling ships too).
for _skill in template-audit ai-doc rule-research; do
  copy_skill_with_transform "$_skill"
done
if [ -n "${WITH_AIF_SUITE:-}" ]; then
  echo "  ▶ AIF operator suite (--with-aif-suite): pipeline dispatcher aif-doctor harvest night-mode story"
  for _skill in pipeline dispatcher aif-doctor harvest night-mode story; do
    copy_skill_with_transform "$_skill"
  done
fi

# aif-doctor ships portable base-refresh ("heal") helpers under helpers/ — a consumer runs
# aif-handoff too, so their container base can go stale and false-`done` off-scope diffs
# (aif-doctor SKILL §3.4). The recursive `cp -r` in copy_skill_with_transform already lands
# helpers/*.sh; here we just keep them executable and surface the OPT-IN auto-heal seam. Keep
# it opt-in + degrading — making a companion mandatory is a goal change (build-first-reuse-default.md §1.1).
# Guarded on the aif-doctor dir existing (present only under --with-aif-suite) — its skill is in the
# gated suite, so its helpers surface only when the suite was installed.
_AIF_HELPERS="$PROJECT_ROOT/.claude/skills/aif-doctor/helpers"
if [ "$DRY_RUN" != "--dry-run" ] && [ -d "$_AIF_HELPERS" ]; then
  chmod_safe +x "$_AIF_HELPERS/heal.sh" "$_AIF_HELPERS/refresh-aif-base.sh" 2>/dev/null || true
  echo "  ✓ aif-doctor heal helpers → .claude/skills/aif-doctor/helpers/ (executable)"
  echo "    ↳ opt-in: export RUNTIME_BRIDGE_PREFLIGHT='bash .claude/skills/aif-doctor/helpers/heal.sh' to auto-heal the aif base before each dispatch"
fi

# ─── 1b. Hooks ──────────────────────────────────────────
echo "▶ Claude hooks → .claude/hooks/"
mkdir_safe "$PROJECT_ROOT/.claude/hooks"
HOOK_SRC="$PKG_ROOT/packages/core/hooks/deps-hash-check.sh"
HOOK_DST="$PROJECT_ROOT/.claude/hooks/deps-hash-check.sh"
if [ -f "$HOOK_SRC" ]; then
  copy_safe "$HOOK_SRC" "$HOOK_DST"
  chmod_safe +x "$HOOK_DST" 2>/dev/null || true
fi

# Register hook in .claude/settings.json (create minimal file if absent)
SETTINGS="$PROJECT_ROOT/.claude/settings.json"
HOOK_CMD="bash .claude/hooks/deps-hash-check.sh"
if [ "$DRY_RUN" = "--dry-run" ]; then
  echo "  [dry-run] would: register deps-hash-check in .claude/settings.json"
elif [ ! -f "$SETTINGS" ]; then
  printf '{\n  "hooks": {\n    "UserPromptSubmit": [\n      {"hooks": [{"type": "command", "command": "%s"}]}\n    ]\n  }\n}\n' "$HOOK_CMD" > "$SETTINGS"
  echo "  ✓ .claude/settings.json created with UserPromptSubmit hook"
elif command -v jq >/dev/null 2>&1; then
  if ! grep -q "deps-hash-check" "$SETTINGS" 2>/dev/null; then
    jq --arg cmd "$HOOK_CMD" \
      '.hooks.UserPromptSubmit += [{"hooks":[{"type":"command","command":$cmd}]}]' \
      "$SETTINGS" > "$SETTINGS.tmp" && mv "$SETTINGS.tmp" "$SETTINGS"
    echo "  ✓ deps-hash-check registered in existing .claude/settings.json"
  else
    echo "  ⊝ .claude/hooks/deps-hash-check.sh already registered in settings.json"
  fi
else
  echo "  ⚠ jq not found — add manually to .claude/settings.json:"
  echo "    UserPromptSubmit: [{\"hooks\":[{\"type\":\"command\",\"command\":\"$HOOK_CMD\"}]}]"
fi
