#!/usr/bin/env bash
# Surface 8 — delivery-channel coverage. Every CC hook script (tracked under
# .claude/hooks/ OR wired via .claude/settings.json) MUST declare its delivery
# channel with a dual-implementation-discipline §6 marker:
#   `# @cc-only-rationale: <reason>`  — deliberate, recorded CC-only choice, OR
#   `# @dual-pair: <anchor>`          — whose anchor resolves to a portable
#                                        counterpart artifact (§5 drift-check).
# Neither marker = silent CC vendor lock-in (the failure the rule exists to prevent).
#
# This is the CI-time, population-wide, harness-independent companion to the
# edit-time gate .claude/hooks/check-hook-marker.sh — which fires only on a CC
# Edit/Write of a `.claude/hooks/*.sh` and therefore cannot see (a) the whole
# population at once, nor (b) a settings-wired script living outside .claude/hooks/.
# Same invariant (§6 marker present), a second, off-CC channel.
#
# spec: .claude/rules/dual-implementation-discipline.md §5-§6
# Per .claude/rules/no-paid-llm-in-ci.md: pure bash + git, zero API calls.
set -uo pipefail
# Resolve by path, not `git rev-parse` — GIT_DIR-immune for the worktree-push hook
# env (see ../run-audit.sh). `git -C "$REPO_ROOT"` matches the proven substrate.sh:10
# pattern; individual files are read via absolute "$REPO_ROOT/$h" (filesystem, so the
# working-tree content is seen even for not-yet-committed marker edits).
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
source "$REPO_ROOT/tests/agnosticism/_cc-absent-lib.sh"
# GIT_DIR-immune: during a worktree `git push`, git exports GIT_DIR/GIT_COMMON_DIR into the
# pre-push env, which would make the `git -C "$REPO_ROOT"` calls below read the WRONG repo.
# Clear them so git rediscovers the repo from REPO_ROOT (same intent as ../run-audit.sh).
unset GIT_DIR GIT_COMMON_DIR GIT_WORK_TREE

# Population (T10 — enumerate before probing): tracked hook scripts ∪ scripts wired
# in tracked .claude/settings.json (the latter adds e.g. scripts/link-coordination.sh,
# which lives outside .claude/hooks/ and the edit-time gate never sees).
pop=$( { git -C "$REPO_ROOT" ls-files '.claude/hooks/**/*.sh' '.claude/hooks/*.sh';
         grep -oE '\$CLAUDE_PROJECT_DIR/[^"]+\.sh' "$REPO_ROOT/.claude/settings.json" 2>/dev/null \
           | sed 's|^\$CLAUDE_PROJECT_DIR/||'; } | sort -u )

# Artifact surfaces a @dual-pair counterpart may legitimately live in. Prose dirs
# (orchestrator-prompts, docs/meta-factory/research-patches, docs/superpowers) are
# EXCLUDED by construction: a narrative mention of an anchor is not a counterpart
# (domain trap T-S8-A — counting prose as a counterpart is channel-coverage theatre).
SURFACES=(agents .claude/skills .claude/rules scripts packages .husky .github)

for h in $pop; do
  if [ ! -f "$REPO_ROOT/$h" ]; then
    record channel-coverage "$h" "wired in settings.json but absent from tree" 1 WIRED-SCRIPT-MISSING
    continue
  fi
  # Marker must be on its own comment line (anchored ^# ) — mirrors check-hook-marker.sh:42,
  # so prose documenting the syntax inside a heredoc/backtick is not mis-counted.
  marker=$(grep -m1 -E '^# @(dual-pair|cc-only-rationale):' "$REPO_ROOT/$h" || true)
  if [ -z "$marker" ]; then
    record channel-coverage "$h" "no delivery-channel marker (dual-implementation-discipline §6)" 1 CC-ONLY-NO-MARKER
  elif printf '%s' "$marker" | grep -q '@dual-pair:'; then
    # Anchor = first whitespace-delimited token after the marker (robust to trailing
    # annotations, e.g. `# @dual-pair: foo   (SSOT #110)` — in-tree precedent exists).
    anchor=$(printf '%s' "$marker" | sed -E 's/.*@dual-pair:[[:space:]]*//; s/[[:space:]].*$//')
    # Counterpart resolution (§5): the same anchor declared in ANY comment syntax
    # (# / <!-- --> / //) in a real artifact surface, excluding the population file itself.
    counterpart=$(git -C "$REPO_ROOT" grep -lE "@dual-pair:[[:space:]]*${anchor}([[:space:]]|\$)" \
      -- "${SURFACES[@]}" 2>/dev/null | grep -vxF "$h" | head -1 || true)
    if [ -n "$counterpart" ]; then
      record channel-coverage "$h" "dual-pair '$anchor' resolves → $counterpart (§5)" 0 PORTABLE
    else
      record channel-coverage "$h" "dual-pair '$anchor' has NO counterpart artifact (§5 drift)" 1 DANGLING-PAIR
    fi
  else
    record channel-coverage "$h" "cc-only-rationale declared (§6 deliberate choice)" 0 PORTABLE
  fi
done
