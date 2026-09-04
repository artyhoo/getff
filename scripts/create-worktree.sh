#!/usr/bin/env bash
# create-worktree.sh — portable worktree setup; usable from CLI, CI, or AI agent.
#
# Usage: bash scripts/create-worktree.sh <name> [<project-dir>] [<base-ref>]
#
#   <name>        worktree slug → .claude/worktrees/<name>/, branch worktree-<name>
#   <project-dir> repo root (default: `git rev-parse --show-toplevel`)
#   <base-ref>    explicit base ref (overrides auto-detection)
#
# Contract (mirrors the CC WorktreeCreate hook, .claude/hooks/worktree-setup.sh):
#   stdout : the worktree absolute path — ONLY thing on stdout
#   exit   : 0 = success ; non-zero = creation failed
#
# This is the BUILD half of the dual-channel worktree-create capability: the
# CC-only hook serves the `claude -w <name>` moment; this script serves the
# human / CI / non-CC-agent moment. No production-grade portable bash equivalent
# exists upstream (4 candidates surveyed — see spec §4). The AI-session axis is
# served by REFERENCE to Superpowers `using-git-worktrees` (SSOT #65).
#
# Base-ref resolution (configurable — no hardcoded trunk name, per spec §9
# cold-QA Finding 1): explicit arg → $WORKTREE_BASE_REF env → refreshed
# origin/HEAD (Bug 1 fix) → fallback chain. Refreshing origin/HEAD via
# `remote set-head --auto` makes the default portable: it resolves to whatever
# the remote's actual default branch is (origin/staging here; origin/main for a
# consumer) without this script knowing the name.
#
# @dual-pair: worktree-create-setup
# spec: docs/meta-factory/research-patches/2026-05-30-worktree-create-dual-channel.md §6

set -euo pipefail

NAME="${1:?Usage: $0 <name> [<project-dir>] [<base-ref>]}"
PROJECT_DIR="${2:-$(git rev-parse --show-toplevel 2>/dev/null || true)}"
# Explicit base-ref arg (3rd positional) overrides $WORKTREE_BASE_REF env.
BASE_REF="${3:-${WORKTREE_BASE_REF:-}}"

if [[ -z "$PROJECT_DIR" ]] || { [[ ! -d "$PROJECT_DIR/.git" ]] && [[ ! -f "$PROJECT_DIR/.git" ]]; }; then
  printf '⚠ create-worktree: cannot resolve project root (pass <project-dir> or run inside a repo)\n' >&2
  exit 1
fi

if [[ -z "$BASE_REF" ]]; then
  # Refresh origin/HEAD symbolic-ref to avoid a stale base (Bug 1 — 2026-05-30).
  # No-op when there is no `origin` remote (test harness / detached clone).
  git -C "$PROJECT_DIR" remote set-head origin --auto >/dev/null 2>&1 || true
  # Prefer the remote's actual default (origin/HEAD, now refreshed); fall back
  # through plausible defaults for offline / test repos.
  for cand in "origin/HEAD" "origin/main" "main" "HEAD"; do
    if git -C "$PROJECT_DIR" rev-parse --verify --quiet "$cand" >/dev/null 2>&1; then
      BASE_REF="$cand"
      break
    fi
  done
fi
if [[ -z "$BASE_REF" ]]; then
  printf '⚠ create-worktree: cannot resolve a base ref (origin/HEAD, origin/main, main, HEAD all missing)\n' >&2
  exit 1
fi

WORKTREE_DIR="$PROJECT_DIR/.claude/worktrees/$NAME"
BRANCH="worktree-$NAME"

# Idempotent: pre-existing worktree → reuse (print + exit 0).
if [[ -d "$WORKTREE_DIR" ]]; then
  printf '%s\n' "$WORKTREE_DIR"
  exit 0
fi

mkdir -p "$(dirname "$WORKTREE_DIR")"

# `git worktree add` writes progress on stderr; route to /dev/null for clean
# orchestration. Errors propagate via exit code.
if ! git -C "$PROJECT_DIR" worktree add "$WORKTREE_DIR" -b "$BRANCH" "$BASE_REF" >/dev/null 2>&1; then
  # Branch may pre-exist (re-dispatch of same name) — retry without -b.
  if ! git -C "$PROJECT_DIR" worktree add "$WORKTREE_DIR" "$BRANCH" >/dev/null 2>&1; then
    printf '⚠ create-worktree: git worktree add failed (path=%s branch=%s base=%s)\n' \
      "$WORKTREE_DIR" "$BRANCH" "$BASE_REF" >&2
    exit 1
  fi
fi

# D2 workspace optimisation: symlink node_modules from the primary checkout. Delegated to
# scripts/worktree-node-modules.sh — the ONE canonical implementation, shared with
# .claude/hooks/worktree-setup.sh (the CC half of this @dual-pair). Keeping a second copy here
# is #sync-by-copy-paste (.claude/rules/dual-implementation-discipline.md §8).
# `|| true` keeps a provisioning failure from aborting creation under `set -euo pipefail`.
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
    || printf '⚠ create-worktree: could not ensure packages/core toolchain (tsx); run `npm ci --prefix packages/core` in the worktree\n' >&2
fi

# Link gitignored orchestrator-prompts to a canonical store outside every
# worktree so edits in any worktree are live-shared (symlink-to-canonical,
# SSOT #110). Supersedes the J5 one-way rsync copy (stale snapshot) with a
# live-shared identity: one file, N symlinks.
# `>&2` keeps helper output off this script's stdout (stdout = worktree path only).
# `|| true` prevents a link conflict from aborting worktree creation (set -euo pipefail).
# LOUD miss (handoff item 2, 2026-07-25 — @dual-pair parity with worktree-setup.sh):
# PROJECT_DIR may be caller-supplied or cwd-derived, i.e. a tree without the helper —
# previously the `|| true` swallowed that silently and the worktree stayed unlinked.
# The call stays a standalone literal line: the hydration paired-negative strips it
# by regex and the remaining script must stay valid bash.
if [[ ! -f "$PROJECT_DIR/scripts/link-coordination.sh" ]]; then
  printf '⚠ create-worktree: %s/scripts/link-coordination.sh not found — orchestrator-prompts NOT linked to the canonical store; files created under .claude/orchestrator-prompts/ in this worktree are sole-copy until scripts/link-coordination.sh is run manually\n' "$PROJECT_DIR" >&2
fi
bash "$PROJECT_DIR/scripts/link-coordination.sh" "$WORKTREE_DIR" "$PROJECT_DIR" >&2 || true

# Print path — the ONLY thing on stdout (orchestration contract).
printf '%s\n' "$WORKTREE_DIR"
