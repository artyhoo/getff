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
# F7 split (owner GO 2026-07-10, widened S5 2026-08-01): the set divides into THREE arms —
# a consumer-facing CORE set (always shipped), an env+ CONTOUR SURFACE (shipped at PROFILE=env
# or above), and an AIF operator SUITE (shipped ONLY at PROFILE=factory or via legacy
# --with-aif-suite). The contour surface carries the architecture-design skill that produces
# the contour; the suite presupposes the aif-handoff operator runtime. On a consumer without
# that runtime the suite's triggers fire into a dead end, and `story` crashes on landing until
# its lang-pack ships (#934). Gating is opt-in + reversible (BFR §1.1 integrate-never-hard-depend;
# same posture as companions.manifest — companion-install-principle.md).
#
# CORE (always — consumer-facing, no aif-handoff runtime assumed):
#   - template-audit — local advisory audit of the rendered templates this installer ships.
#   - ai-doc         — AI-doc authoring standard (channel selection, doc-authority header,
#                      rule-as-test, AI-agnostic authoring) — reusable by consumers who author
#                      their own skills/rules.
#   - rule-research  — bootstrap stack-aware ESLint rules from LIVE docs (consumer-facing by design).
#   - rule-tests     — write/repair the firing test material for an EXISTING generated rule +
#                      verify it in single-rule isolation (mirror pair to rule-research; the write
#                      half is agents/rule-test-author.md). Consumer-facing by design.
#
# CONTOUR SURFACE (env+ — ships at PROFILE=env or factory, NOT core; spec A8 binding):
#   - arch           — the architecture-design skill that produces the contour. Pairs with the
#                      AIF operator suite at factory, but is itself consumer-facing at env+ (a
#                      consumer running their own architecture cycle benefits without the AIF
#                      operator runtime). depth-per-skill: env+ (S5 kickoff §2 binding #3).
#
# AIF operator SUITE (factory only — presupposes the aif-handoff runtime):
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
#   - claude-glm-executor-handoff — pairs an in-aif Claude coordinator with a GLM-family
#                      executor tier (kickoff marker → bridge-profile resolver). Factory-only
#                      by design (S5 kickoff §2 binding #3): the skill presupposes the
#                      runtime-bridge + aif-handoff operator runtime that the factory profile
#                      installs in the same stage. Spec A8 lists env/factory; the kickoff's
#                      narrower reading (factory-only) is adopted per §2 binding #3 + recorded
#                      in the PR body §1.7 Forward-check as a spec-vs-kickoff divergence.
#
# Only self-reflection is intentionally NOT shipped at all: it is the §1.7 self-review discipline
# specific to THIS repo's own development process (not a reusable consumer capability) — see the
# build-vs-reuse shipped-axis default in .claude/rules/build-first-reuse-default.md §1.1 +
# dual-implementation-discipline.md §3.
# Repo-internal cross-refs (docs/packages/scripts/.claude/rules/README) are rewritten to GitHub blob
# URLs by copy_skill_with_transform → transform_internal_refs; sibling-skill links stay relative (sibling ships too).
for _skill in template-audit ai-doc rule-research rule-tests; do
  copy_skill_with_transform "$_skill"
done
# env+ contour surface (spec A8): /arch is the architecture-design skill that produces the
# contour; consumer-facing at env+. /pipeline is env+ too — the design SSOT
# defines the env depth as carrying «pipeline presets, status, …» verbatim
# (docs/superpowers/specs/2026-07-23-beta-program-design.md:211). Standing gate had pipeline
# at factory-only; spec wins → resolved by moving pipeline into the env+ loop. The factory-only
# arm below retains dispatcher/aif-doctor/harvest/night-mode/story/claude-glm-executor-handoff
# (those presuppose the aif operator runtime). Legacy --with-aif-suite routes through
# PROFILE=factory (install.sh:405-408), so the env/factory check covers it without an explicit
# OR clause.
if [ "${PROFILE:-core}" = "env" ] || [ "${PROFILE:-core}" = "factory" ] || [ -n "${WITH_AIF_SUITE:-}" ]; then
  echo "  ▶ Contour surface (profile=env+ OR --with-aif-suite): arch pipeline"
  for _skill in arch pipeline; do
    copy_skill_with_transform "$_skill"
  done
fi
if [ "${PROFILE:-core}" = "factory" ] || [ -n "${WITH_AIF_SUITE:-}" ]; then
  echo "  ▶ AIF operator suite (profile=factory OR --with-aif-suite): dispatcher aif-doctor harvest night-mode story claude-glm-executor-handoff"
  for _skill in dispatcher aif-doctor harvest night-mode story claude-glm-executor-handoff; do
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
# Registered with the "Edit|Write|MultiEdit" matcher (parity with the framework's own settings.json).
IMR_SRC="$PKG_ROOT/.claude/hooks/inject-matching-rule.sh"
IMR_DST="$PROJECT_ROOT/.claude/hooks/inject-matching-rule.sh"
if [ -f "$IMR_SRC" ]; then
  copy_safe "$IMR_SRC" "$IMR_DST"
  chmod_safe +x "$IMR_DST" 2>/dev/null || true
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would: register inject-matching-rule as a PostToolUse:Edit|Write|MultiEdit hook in .claude/settings.json"
  else
    register_cc_hook "$SETTINGS" "PostToolUse" 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/inject-matching-rule.sh"' "inject-matching-rule" "Edit|Write|MultiEdit"
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

# ─── 1g. Doc-authority-header PostToolUse gate (GH #934 per-hook audit follow-up) ─
# Zero-dep bash REIMPLEMENTATION of the framework-internal check-doc-authority.sh (which delegates to
# tsx + packages/core — both absent in consumers, so that hook is a DEAD no-op there). This consumer
# version enforces the doc-authority-header discipline on the two surfaces a consumer authors:
# .claude/rules/*.md + .claude/skills/*/SKILL.md. A scoped doc missing the "> **Authoritative for:**"
# header gets exit 2 (PostToolUse feedback → the model adds it). Default-on gate (GH #934 maintainer
# decision); opt out repo-wide with AIF_DOC_AUTHORITY=0, or per-file with a
# `<!-- doc-authority: exempt <reason 20+> -->` line. Consumer-safe: pure bash + jq, no
# framework-internal dependency; degrades to exit 0 when jq is absent. Registered with the "Edit|Write|MultiEdit"
# matcher (parity with the framework's own check-doc-authority.sh registration).
DAH_SRC="$PKG_ROOT/.claude/hooks/check-doc-authority-header.sh"
DAH_DST="$PROJECT_ROOT/.claude/hooks/check-doc-authority-header.sh"
if [ -f "$DAH_SRC" ]; then
  copy_safe "$DAH_SRC" "$DAH_DST"
  chmod_safe +x "$DAH_DST" 2>/dev/null || true
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would: register check-doc-authority-header as a PostToolUse:Edit|Write|MultiEdit hook in .claude/settings.json"
  else
    register_cc_hook "$SETTINGS" "PostToolUse" 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/check-doc-authority-header.sh"' "check-doc-authority-header" "Edit|Write|MultiEdit"
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

# ─── 1j. Workspace one-command scripts → MOVED to setup.d/85-worktree-scripts.sh ──
# Consolidated to ONE ship-point: the worktree
# helper scripts cluster (create-worktree.sh + worktree-node-modules.sh + link-coordination.sh
# + getff-work.sh) now ships exclusively from setup.d/85-worktree-scripts.sh under the
# env+ gate (PROFILE=env|factory, OR WITH_AIF_SUITE). The previous §1j block that shipped
# only create-worktree.sh from this file has been removed — the cluster's call-chain
# requirement (create-worktree → worktree-node-modules → link-coordination) means a partial
# ship from two sites drifts independently; 85 is the single owner now. Gate semantics
# identical (env|factory|WITH_AIF_SUITE). See setup.d/85-worktree-scripts.sh §1.
