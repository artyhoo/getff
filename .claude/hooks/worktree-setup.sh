#!/usr/bin/env bash
# WorktreeCreate hook — auto-create CC worktree under .claude/worktrees/<name>/
# with project-specific node_modules symlinks (workspace optimisation).
#
# Fires on `claude --worktree <name>` (`-w <name>`) and replaces default git
# worktree behaviour with this project-specific setup.
#
# Contract (verified 2026-05-29 via live `--settings` schema probe +
# code.claude.com/docs/en/hooks):
#   stdin  : JSON {session_id, transcript_path, cwd, hook_event_name, name}
#   stdout : the worktree absolute path — ONLY thing on stdout
#   exit   : 0 = success ; non-zero = CC reports creation failure (CAN BLOCK)
#
# Behaviour:
#   * worktree path = $CLAUDE_PROJECT_DIR/.claude/worktrees/<name>/
#   * branch        = worktree-<name>
#   * base ref      = origin/HEAD (fallback: origin/main → main → HEAD)
#   * symlinks      = node_modules + packages/core/node_modules → primary checkout
#   * idempotent    = if worktree path already exists, reuse (print + exit 0)
#
# Project-specific divergence from tfriedel/claude-worktree-hooks precedent:
#   that upstream runs `npm install` per worktree; we symlink instead, matching
#   meta-kickoff.template.md §4a workspace-optimisation pattern (preserved here
#   so the hook can replace that prompt block transparently).
#
# @dual-pair: worktree-create-setup
#   Portable counterpart: scripts/create-worktree.sh (CLI/CI/non-CC-agent moment).
#   This hook serves the CC-only `claude -w <name>` moment; same semantic check,
#   two delivery channels (dual-implementation-discipline.md §5-§7). Replaces the
#   former @cc-only-rationale — a portable equivalent now exists.
# spec: docs/meta-factory/research-patches/2026-05-30-worktree-create-dual-channel.md §6
#   (origin spec: 2026-05-29-dispatch-worktree-automation.md §3 Candidate D2)

set -uo pipefail

INPUT="$(cat)"

# jq is required to parse stdin reliably. Without it, fall through to default
# git behaviour by failing (non-zero) — CC reports the error; maintainer installs jq.
if ! command -v jq >/dev/null 2>&1; then
  printf '⚠ worktree-setup: jq unavailable — install jq to use WorktreeCreate hook\n' >&2
  exit 1
fi

NAME="$(printf '%s' "$INPUT" | jq -r '.name // empty' 2>/dev/null || true)"
STDIN_CWD="$(printf '%s' "$INPUT" | jq -r '.cwd // empty' 2>/dev/null || true)"

if [[ -z "$NAME" ]]; then
  printf '⚠ worktree-setup: missing .name in WorktreeCreate stdin payload\n' >&2
  exit 1
fi

# Resolve project root. CLAUDE_PROJECT_DIR env is the authoritative CC-supplied
# anchor; stdin .cwd is the documented fallback; git-toplevel is the final
# fallback for out-of-CC invocations (e.g. test harness).
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$STDIN_CWD}"
if [[ -z "$PROJECT_DIR" ]] || { [[ ! -d "$PROJECT_DIR/.git" ]] && [[ ! -f "$PROJECT_DIR/.git" ]]; }; then
  PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi
if [[ -z "$PROJECT_DIR" ]]; then
  printf '⚠ worktree-setup: cannot resolve project root\n' >&2
  exit 1
fi

WORKTREE_DIR="$PROJECT_DIR/.claude/worktrees/$NAME"
BRANCH="worktree-$NAME"

# Idempotent: pre-existing worktree → reuse.
if [[ -d "$WORKTREE_DIR" ]]; then
  printf '%s\n' "$WORKTREE_DIR"
  exit 0
fi

# Refresh origin/HEAD symbolic-ref to avoid a stale base (Bug 1 — 2026-05-30 fix).
# Without this, a local origin/HEAD frozen at the old default (e.g. main, pre the
# 2026-05-22 staging migration) silently bases new worktrees on the wrong branch.
# No-op when there is no `origin` remote (test harness / detached clone).
git -C "$PROJECT_DIR" remote set-head origin --auto >/dev/null 2>&1 || true

# Resolve base ref: prefer origin/HEAD (refreshed above → the remote's live
# default; = origin/staging for this repo post-2026-05-22 default-branch
# migration); fall back through plausible defaults for test harnesses.
BASE_REF=""
for cand in "origin/HEAD" "origin/main" "main" "HEAD"; do
  if git -C "$PROJECT_DIR" rev-parse --verify --quiet "$cand" >/dev/null 2>&1; then
    BASE_REF="$cand"
    break
  fi
done
if [[ -z "$BASE_REF" ]]; then
  printf '⚠ worktree-setup: cannot resolve a base ref (origin/HEAD, origin/main, main, HEAD all missing)\n' >&2
  exit 1
fi

mkdir -p "$(dirname "$WORKTREE_DIR")"

# `git worktree add` writes its own progress on stderr; route to /dev/null for
# clean orchestration. Errors propagate via exit code.
if ! git -C "$PROJECT_DIR" worktree add "$WORKTREE_DIR" -b "$BRANCH" "$BASE_REF" >/dev/null 2>&1; then
  # Branch may pre-exist (re-dispatch of same name) — retry without -b.
  if ! git -C "$PROJECT_DIR" worktree add "$WORKTREE_DIR" "$BRANCH" >/dev/null 2>&1; then
    printf '⚠ worktree-setup: git worktree add failed (path=%s branch=%s base=%s)\n' \
      "$WORKTREE_DIR" "$BRANCH" "$BASE_REF" >&2
    exit 1
  fi
fi

# Project-specific D2 customisation: symlink node_modules from the primary
# checkout. Skip if no primary node_modules exists (fresh clone before install).
if [[ -e "$PROJECT_DIR/node_modules" ]] && [[ ! -e "$WORKTREE_DIR/node_modules" ]]; then
  ln -sfn "$PROJECT_DIR/node_modules" "$WORKTREE_DIR/node_modules"
fi
# packages/core/node_modules must point at the primary's REAL nested dir when it
# exists: the root lock plans nested dep versions (packages/core/node_modules/<dep>)
# that diverge from the root layer, and a ../../node_modules link SHADOWS the
# nested layer — esbuild then bundles the root versions and
# `scripts/build-synth-bundle.sh --check` false-fails with "synth-bundle drift"
# in every fresh worktree (incident 2026-07-02). Fallback to ../../node_modules
# only when the primary has no nested dir (fresh clone before install).
if [[ -d "$WORKTREE_DIR/packages/core" ]] && [[ ! -e "$WORKTREE_DIR/packages/core/node_modules" ]]; then
  if [[ -d "$PROJECT_DIR/packages/core/node_modules" ]]; then
    ln -sfn "$PROJECT_DIR/packages/core/node_modules" "$WORKTREE_DIR/packages/core/node_modules"
  else
    ln -sfn ../../node_modules "$WORKTREE_DIR/packages/core/node_modules"
  fi
fi

# Link gitignored orchestrator-prompts to a canonical store outside every
# worktree so edits in any worktree are live-shared (symlink-to-canonical,
# SSOT #110). Supersedes the J5 one-way rsync copy (stale snapshot) with a
# live-shared identity: one file, N symlinks.
# `>&2` keeps helper output off this hook's stdout (stdout = worktree path only).
# `|| true` prevents a link conflict from blocking worktree creation.
bash "$PROJECT_DIR/scripts/link-coordination.sh" "$WORKTREE_DIR" "$PROJECT_DIR" >&2 || true

# Print path — the ONLY thing on stdout per CC command-hook contract.
printf '%s\n' "$WORKTREE_DIR"
