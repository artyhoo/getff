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

# Idempotent: pre-existing worktree → reuse. Still RE-PROVISION before returning: a worktree
# reused after any vitest run holds real node_modules/.vite cache dirs where the symlinks
# belong, and returning early left it permanently unprovisioned (incident 2026-07-23).
if [[ -d "$WORKTREE_DIR" ]]; then
  bash "$PROJECT_DIR/scripts/worktree-node-modules.sh" --apply "$WORKTREE_DIR" "$PROJECT_DIR" >&2 || true
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

# Project-specific D2 customisation: symlink node_modules from the primary checkout.
# The logic lives in scripts/worktree-node-modules.sh — ONE canonical implementation shared
# with scripts/create-worktree.sh, the portable half of this @dual-pair. Both channels used to
# carry byte-identical copies of this block, which is #sync-by-copy-paste
# (.claude/rules/dual-implementation-discipline.md §8); §7 requires the shared logic to have a
# single home. Non-fatal: a failed provisioning must never block worktree creation.
bash "$PROJECT_DIR/scripts/worktree-node-modules.sh" --apply "$WORKTREE_DIR" "$PROJECT_DIR" >&2 || true

# Self-heal the packages/core toolchain when the symlinks above did NOT surface
# it. Symlink delivery only works when the primary was already installed at
# create-time; a cold primary (worktree born mid-install — incident 2026-07-21:
# the worktree predated the primary's tsx by ~48 min) or a later clobber (vite
# materialising a real node_modules over the link) leaves tsx unreachable at BOTH
# probe paths the principle-21 harness checks (packages/core/node_modules/.bin/tsx,
# then root node_modules/.bin/tsx — tests/agnosticism/probes/rule-channel-readability.sh),
# so those probes silently degrade to a PORTABLE fallback instead of running.
# Install standalone IN THE WORKTREE, mirroring CI's `npm ci --prefix packages/core`
# (audit-self.yml). Non-fatal: an offline/failed install must never block creation.
# Guarded on a present lockfile + reachable npm: without them the install cannot
# run, and dropping the delivery symlink (below) would strictly WORSEN the state
# — so skip entirely and leave the symlink in place.
if [[ -d "$WORKTREE_DIR/packages/core" ]] \
   && [[ -f "$WORKTREE_DIR/packages/core/package-lock.json" ]] \
   && command -v npm >/dev/null 2>&1 \
   && [[ ! -x "$WORKTREE_DIR/packages/core/node_modules/.bin/tsx" ]] \
   && [[ ! -x "$WORKTREE_DIR/node_modules/.bin/tsx" ]]; then
  # Never write THROUGH a delivery symlink into the primary — drop a link that
  # pointed at a tsx-less primary, then install a real nested dir locally.
  if [[ -L "$WORKTREE_DIR/packages/core/node_modules" ]]; then
    rm -f "$WORKTREE_DIR/packages/core/node_modules"
  fi
  npm ci --prefix "$WORKTREE_DIR/packages/core" --silent >/dev/null 2>&1 \
    || printf '⚠ worktree-setup: could not ensure packages/core toolchain (tsx); run `npm ci --prefix packages/core` in the worktree\n' >&2
fi

# Link gitignored orchestrator-prompts to a canonical store outside every
# worktree so edits in any worktree are live-shared (symlink-to-canonical,
# SSOT #110). Supersedes the J5 one-way rsync copy (stale snapshot) with a
# live-shared identity: one file, N symlinks.
# `>&2` keeps helper output off this hook's stdout (stdout = worktree path only).
# `|| true` prevents a link conflict from blocking worktree creation.
# LOUD miss (stderr — stdout stays path-only per the WorktreeCreate contract): the
# previous call swallowed a missing helper via `|| true`, leaving the new worktree
# silently unlinked from the canonical store (handoff item 2, 2026-07-25; same class
# as the 2026-07-24 tsx-resolution incident). Deliberately NOT tiered to this hook's
# own checkout (unlike adopt-orchestrator-prompts.sh): the helper is project-local by
# contract — $PROJECT_DIR is the project being provisioned, and borrowing another
# checkout's copy would run coordination-linking a foreign project never opted into.
if [[ -f "$PROJECT_DIR/scripts/link-coordination.sh" ]]; then
  bash "$PROJECT_DIR/scripts/link-coordination.sh" "$WORKTREE_DIR" "$PROJECT_DIR" >&2 || true
else
  printf '⚠ worktree-setup: %s/scripts/link-coordination.sh not found — orchestrator-prompts NOT linked to the canonical store; files created under .claude/orchestrator-prompts/ in this worktree are sole-copy until scripts/link-coordination.sh is run manually\n' "$PROJECT_DIR" >&2
fi

# Print path — the ONLY thing on stdout per CC command-hook contract.
printf '%s\n' "$WORKTREE_DIR"
