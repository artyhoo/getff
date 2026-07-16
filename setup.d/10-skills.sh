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
if [ -e "$PROJECT_ROOT/.claude/skills/getff" ] && [ "$FORCE" != "--force" ]; then
  SKIPPED+=("$PROJECT_ROOT/.claude/skills/getff")
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would skip: .claude/skills/getff (exists)"
  else
    echo "  ⊝ .claude/skills/getff (exists — skipping)"
  fi
elif [ "$DRY_RUN" = "--dry-run" ]; then
  echo "  [dry-run] would copy: $PKG_ROOT/skills/getff → $PROJECT_ROOT/.claude/skills/getff"
else
  rm -rf "$PROJECT_ROOT/.claude/skills/getff"
  cp -r "$PKG_ROOT/skills/getff" "$PROJECT_ROOT/.claude/skills/getff"
  # getff ships from repo-root skills/ (not .claude/skills/), so it bypasses
  # copy_skill_with_transform — its ](../../../README.md), ](../../install.sh) and
  # ](../../../.claude/rules/…) refs dangle on a consumer tree without this pass
  # (2026-07-10 flat-install smoke: first consumer push red on pre-push §8 lychee).
  while IFS= read -r -d '' mdfile; do
    transform_internal_refs "$mdfile"
  done < <(find "$PROJECT_ROOT/.claude/skills/getff" -name '*.md' -print0)
  echo "  ✓ .claude/skills/getff/ (cross-refs rewritten to ${UPSTREAM_BLOB_URL})"
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
  # No up-dir repo refs in tool-bootstrapping today (transform is a no-op) — run it anyway for
  # install/refresh parity with do_refresh and so a future added ref cannot dangle silently.
  while IFS= read -r -d '' mdfile; do
    transform_internal_refs "$mdfile"
  done < <(find "$PROJECT_ROOT/.claude/skills/tool-bootstrapping" -name '*.md' -print0)
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

# ─── 1c. End-of-turn session-recap Stop hook + lang pack (GH #934) ────────────
# The shipped /story skill is SSOT "shared with the Stop-hook aif_msg_eot_branch_story branch"
# (SKILL.md) — but that Stop hook was never delivered, so the consumer got a skill whose ambient
# end-of-turn nudge silently did not exist. Ship the hook + its lang pack, and register it as a
# Stop hook (non-destructive, idempotent — reuses register_cc_hook / lib.sh). Consumer-safe: the
# hook has no framework-internal dependency and self-guards on jq.
EOT_SRC="$PKG_ROOT/.claude/hooks/end-of-turn-reminder.sh"
EOT_DST="$PROJECT_ROOT/.claude/hooks/end-of-turn-reminder.sh"
if [ -f "$EOT_SRC" ]; then
  copy_safe "$EOT_SRC" "$EOT_DST"
  chmod_safe +x "$EOT_DST" 2>/dev/null || true
  # Lang pack: en (canonical, zero-setup default) + ru (via AIF_HOOK_LANG) + parity check.
  mkdir_safe "$PROJECT_ROOT/.claude/hooks/lang"
  for _lp in en.sh ru.sh check-parity.sh; do
    [ -f "$PKG_ROOT/.claude/hooks/lang/$_lp" ] && copy_safe "$PKG_ROOT/.claude/hooks/lang/$_lp" "$PROJECT_ROOT/.claude/hooks/lang/$_lp"
  done
  chmod_safe +x "$PROJECT_ROOT/.claude/hooks/lang/check-parity.sh" 2>/dev/null || true
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would: register end-of-turn-reminder as a Stop hook in .claude/settings.json"
  else
    # $CLAUDE_PROJECT_DIR-relative (matches the framework's own settings.json — worktree-safe).
    register_cc_hook "$SETTINGS" "Stop" 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/end-of-turn-reminder.sh"' "end-of-turn-reminder"
  fi
fi

# ─── 1d. Pre-question fork-challenge PreToolUse hook (GH #934) ────────────────
# Generic session-UX nudge (companion class of the §1c Stop recap): a PreToolUse:AskUserQuestion
# challenge that fires the moment the model is about to ask the operator. Consumer-safe: no
# framework-internal dependency; reuses the §1c-delivered lang pack (aif_msg_question_challenge)
# and self-guards on jq. Registered with the "AskUserQuestion" matcher (parity with the framework's
# own settings.json). Non-destructive + idempotent via register_cc_hook.
# Delivery coupling (by design): the lang/ pack this hook sources under `set -e` is delivered by the
# §1c end-of-turn block above — the two hooks always ship together from the same source dir, so §1c
# always runs first when §1d does. Keep them co-delivered; do not ship ask-question-reminder without
# §1c's lang pack.
AQR_SRC="$PKG_ROOT/.claude/hooks/ask-question-reminder.sh"
AQR_DST="$PROJECT_ROOT/.claude/hooks/ask-question-reminder.sh"
if [ -f "$AQR_SRC" ]; then
  copy_safe "$AQR_SRC" "$AQR_DST"
  chmod_safe +x "$AQR_DST" 2>/dev/null || true
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would: register ask-question-reminder as a PreToolUse:AskUserQuestion hook in .claude/settings.json"
  else
    register_cc_hook "$SETTINGS" "PreToolUse" 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/ask-question-reminder.sh"' "ask-question-reminder" "AskUserQuestion"
  fi
fi

# ─── 1e. Path-scoped rule-injector PostToolUse hook (GH #934) ─────────────────
# Consumers DO get .claude/rules/* installed; without this hook that rules channel is cold-load
# only. This edit-time injector delivers the matching rule's `inject:` summary the moment a scoped
# path is edited. Consumer-safe: the only runtime path is the consumer's own .claude/rules/ (no
# framework-internal artefact), and it degrades to exit 0 when the rules dir or jq is absent.
# Registered with the "Edit|Write" matcher (parity with the framework's own settings.json).
IMR_SRC="$PKG_ROOT/.claude/hooks/inject-matching-rule.sh"
IMR_DST="$PROJECT_ROOT/.claude/hooks/inject-matching-rule.sh"
if [ -f "$IMR_SRC" ]; then
  copy_safe "$IMR_SRC" "$IMR_DST"
  chmod_safe +x "$IMR_DST" 2>/dev/null || true
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would: register inject-matching-rule as a PostToolUse:Edit|Write hook in .claude/settings.json"
  else
    register_cc_hook "$SETTINGS" "PostToolUse" 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/inject-matching-rule.sh"' "inject-matching-rule" "Edit|Write"
  fi
fi

# ─── 1f. Output-language UserPromptSubmit hook (GH #934 batch B) ──────────────
# The consumer-generic slice EXTRACTED from the maintainer-only inject-session-bootstrap.sh: when the
# operator pins AIF_HOOK_LANG, tell the model to address them in that language (repo artefacts stay
# English). The framework-self-referential goal/invariants digest is NOT shipped — it stays INTERNAL.
# Consumer-safe: pure bash, no jq, no framework-internal dependency; en/unset → no-op (zero-setup).
# Registered as UserPromptSubmit (no matcher — not a tool-scoped event), non-destructive/idempotent.
OLH_SRC="$PKG_ROOT/.claude/hooks/inject-output-language.sh"
OLH_DST="$PROJECT_ROOT/.claude/hooks/inject-output-language.sh"
if [ -f "$OLH_SRC" ]; then
  copy_safe "$OLH_SRC" "$OLH_DST"
  chmod_safe +x "$OLH_DST" 2>/dev/null || true
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would: register inject-output-language as a UserPromptSubmit hook in .claude/settings.json"
  else
    register_cc_hook "$SETTINGS" "UserPromptSubmit" 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/inject-output-language.sh"' "inject-output-language"
  fi
fi

# ─── 1g. Doc authority-header edit-time check (GH #934 batch C) ───────────────
# Zero-dep consumer port of the maintainer-only check-doc-authority.sh (which needs a tsx bin + the
# framework's own REQUIRED_HEADER_DOCS list → dead no-op in a consumer). Edit-time PostToolUse check
# that a consumer-authored rule/skill/agent doc carries the `> **Authoritative for:**` header — the
# exact convention the shipped /ai-doc skill teaches. Consumer-safe: pure bash + grep + awk, no tsx/
# node/framework-internal artefact; non-blocking (exit 1 surfaces, never blocks); jq-guarded.
CAH_SRC="$PKG_ROOT/.claude/hooks/check-authority-header.sh"
CAH_DST="$PROJECT_ROOT/.claude/hooks/check-authority-header.sh"
if [ -f "$CAH_SRC" ]; then
  copy_safe "$CAH_SRC" "$CAH_DST"
  chmod_safe +x "$CAH_DST" 2>/dev/null || true
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would: register check-authority-header as a PostToolUse:Edit|Write hook in .claude/settings.json"
  else
    register_cc_hook "$SETTINGS" "PostToolUse" 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/check-authority-header.sh"' "check-authority-header" "Edit|Write"
  fi
fi

# ─── 1h. Project-anchor digest injector (GH #934 batch D) ────────────────────
# Project-agnostic adaptation of the maintainer-only inject-session-bootstrap + inject-subagent-digest
# pair (which hard-code the FRAMEWORK's own goal/invariants digest). This ONE hook injects the
# CONSUMER's own anchor — the digest block of THEIR .claude/session-bootstrap.md — into BOTH the main
# session (UserPromptSubmit) and every subagent (SubagentStart). We also ship a starter template
# (copy_safe → .claude/session-bootstrap.md, non-destructive) that ships EMPTY, so nothing is injected
# until the consumer fills it (zero-setup, zero token cost by default).
PDG_SRC="$PKG_ROOT/.claude/hooks/inject-project-digest.sh"
PDG_DST="$PROJECT_ROOT/.claude/hooks/inject-project-digest.sh"
if [ -f "$PDG_SRC" ]; then
  copy_safe "$PDG_SRC" "$PDG_DST"
  chmod_safe +x "$PDG_DST" 2>/dev/null || true
  # Starter template → consumer's .claude/session-bootstrap.md (never overwrite a filled one).
  [ -f "$PKG_ROOT/.claude/templates/session-bootstrap.md" ] && copy_safe "$PKG_ROOT/.claude/templates/session-bootstrap.md" "$PROJECT_ROOT/.claude/session-bootstrap.md"
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would: register inject-project-digest as UserPromptSubmit + SubagentStart hooks"
  else
    register_cc_hook "$SETTINGS" "UserPromptSubmit" 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/inject-project-digest.sh"' "inject-project-digest"
    register_cc_hook "$SETTINGS" "SubagentStart" 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/inject-project-digest.sh"' "inject-project-digest"
  fi
fi

# ─── 1i. Memory-codification write-time reminder (GH #934 batch D) ───────────
# Generic nudge: wrote a durable behavioural rule to agent memory → codify it into the repo (don't
# leave conventions only in unreliable memory — the project's own thesis). Fires on a Write to any
# */memory/* path. Its companion agents/memory-codification-auditor.md is ALREADY shipped, so this
# closes a half-shipped gap. Consumer-safe: message is generic (no framework-internal doc ref), jq-guarded.
MCF_SRC="$PKG_ROOT/.claude/hooks/inject-memory-codification.sh"
MCF_DST="$PROJECT_ROOT/.claude/hooks/inject-memory-codification.sh"
if [ -f "$MCF_SRC" ]; then
  copy_safe "$MCF_SRC" "$MCF_DST"
  chmod_safe +x "$MCF_DST" 2>/dev/null || true
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would: register inject-memory-codification as a PostToolUse:Write hook"
  else
    register_cc_hook "$SETTINGS" "PostToolUse" 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/inject-memory-codification.sh"' "inject-memory-codification" "Write"
  fi
fi
