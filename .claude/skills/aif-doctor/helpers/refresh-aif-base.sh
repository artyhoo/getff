#!/usr/bin/env bash
# refresh-aif-base.sh — PORTABLE refresh of an aif-handoff agent container's git base
# branch to the live GitHub tip, so dispatched tasks branch off CURRENT code rather than a
# stale hand-synced base (which produces off-scope / empty diffs the auto-review false-passes;
# aif-doctor SKILL §3.4 — the #1 cause of false-`done` garbage). Shipped to consumers under
# .claude/skills/aif-doctor/helpers/ — a consumer runs aif-handoff too, so their container
# base can also go stale and they need this heal.
#
# PORTABLE primary path: a plain in-container `git fetch` — works for any consumer whose
# agent container can reach GitHub. Tunnel/airgap FALLBACK (the maintainer's case, where
# github.com:443 is proxy-blocked inside the container) reconstructs the objects on the host
# via api.github.com, bundles them, and docker-cp's them in. The fallback's host-reconstruction
# helper (sync-branch-from-api.sh) is OPTIONAL + operator-local — its absence degrades with a
# clear message, never a hard dependency. The primary fetch path stands alone (T-HEAL-A).
#
# TWO-PART CURRENCY: the fast no-op requires BOTH the branch ref AND the working tree HEAD
# to equal the live tip. A base clone whose ref is current but whose working tree is on
# another branch is the exact broken state this helper exists to detect — the working tree
# is the overlay source for task worktrees (.claude/ is copied from it). See aif-doctor SKILL
# §3.4 + research-patches/2026-07-24-aif-stale-claude-overlay.md.
#
# CHECKED-OUT BRANCH: when $BRANCH is already checked out (the normal state after this
# helper runs once), `git branch -f` is refused by git. We use `merge --ff-only` (fast-forward)
# or detach→`branch -f`→re-attach (non-FF) instead.
#
# Idempotent + reversible: fast no-op when already current; prints the OLD SHA for a
# one-command revert. Non-destructive to task records / worktrees. Composes existing tools only
# (git / docker / gh api / git bundle) — no new dependency, no API-billed call.
# Never uses `git reset --hard` — a banned operation in this project.
#
# Usage: bash refresh-aif-base.sh [branch]            (branch defaults to staging)
#        run from inside the framework/consumer git repo (any worktree).
# Env:   AIF_AGENT_CONTAINER  (default: auto-resolve the aif agent container)
#        AIF_CONTAINER_REPO   (default: /home/www/<host main-clone dir name> — see «Which clone» below)
#        AIF_SYNC_HELPER      (default: ~/.claude/sync-branch-from-api.sh — OPTIONAL fallback only)
#
# Which clone this script heals — and why it is derived, not hard-coded.
#   The live tip comes from the GITHUB REPO of the caller's CWD (`git remote get-url origin`),
#   so the container path must name the SAME repository or the script writes one project's
#   staging onto another project's clone. It used to default to a literal
#   `/home/www/rules-as-tests-aif` while the tip followed the CWD — two independent sources with
#   nothing tying them together. Measured 2026-08-31 during a timeliner dispatch: the run
#   reported `repo=artyhoo/getff … repo_path=/home/www/rules-as-tests-aif` and a confident
#   `✅ already current` about a clone the dispatch did not use. Run from the consumer worktree
#   instead — the natural way — and REPO would have been `artyhoo/timeliner` while REPO_PATH
#   stayed the framework's: the host-bundle fallback imports objects across unrelated histories
#   without complaint, so `branch -f staging <foreign-sha>` would land.
#   The default now follows the host main clone's directory name (worktree-safe via
#   --git-common-dir), which is exactly the aif projects-mount convention (`/home/www/timeliner`,
#   `/home/www/rules-as-tests-aif`, `/home/www/getff-landing`), and an identity guard refuses to
#   touch a container clone that cannot be proven to be the same repository.
set -uo pipefail            # deliberately NOT -e: a failed heal must warn, never abort the caller
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

BRANCH="${1:-staging}"
C="${AIF_AGENT_CONTAINER:-$(docker ps --filter name=agent --format '{{.Names}}' 2>/dev/null | grep -i aif | head -1)}"

# Graceful no-op when no aif agent container is running (e.g. a consumer who doesn't run aif).
if [ -z "$C" ]; then
  echo "[refresh-aif-base] no aif agent container running — nothing to refresh (set AIF_AGENT_CONTAINER to override)."
  exit 0
fi

cd "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || { echo "[refresh-aif-base] not inside a git repo — skip."; exit 0; }
REPO="$(git remote get-url origin 2>/dev/null | sed -E 's#^.*github\.com[:/]##; s#\.git$##')"
[ -n "$REPO" ] || { echo "[refresh-aif-base] no github origin remote — skip."; exit 0; }

# Container path DERIVED from the host main clone, so it can never name a different project than
# the tip we are about to write. --git-common-dir keeps this correct from a worktree, whose own
# directory name is a random codename rather than the repo's. AIF_CONTAINER_REPO still overrides.
MAIN_CLONE="$(cd "$(dirname "$(cd "$(git rev-parse --git-common-dir 2>/dev/null)" 2>/dev/null && pwd)")" 2>/dev/null && pwd)"
if [ -n "${AIF_CONTAINER_REPO:-}" ]; then
  REPO_PATH="$AIF_CONTAINER_REPO"
elif [ -n "$MAIN_CLONE" ]; then
  REPO_PATH="/home/www/$(basename "$MAIN_CLONE")"
else
  echo "[refresh-aif-base] cannot resolve the host main clone (--git-common-dir) — set AIF_CONTAINER_REPO; skip."
  exit 1
fi

# Live tip via api.github.com (reachable even when github.com:443 is tunnel-blocked).
REAL="$(gh api "repos/$REPO/git/refs/heads/$BRANCH" --jq '.object.sha' 2>/dev/null || true)"
[ -n "$REAL" ] || { echo "[refresh-aif-base] gh api unreachable for repos/$REPO ($BRANCH) — cannot resolve live tip; skip."; exit 1; }
echo "repo=$REPO branch=$BRANCH  real_tip=${REAL:0:7}  container=$C  repo_path=$REPO_PATH"

# ── Shorthand for in-container git ──────────────────────────────────────────────────
icg() { docker exec "$C" git -C "$REPO_PATH" "$@"; }

# ── Identity guard: the container clone MUST be the same repository as the caller's ──
# Offline by construction — the aif clone has no git remote (it cannot fetch), so «same origin
# URL» is not askable there. Two clones of one repository share a root commit; two different
# repositories do not. A shallow clone lacking the root fails this check and is SKIPPED, which is
# the safe direction: a missed refresh costs one manual command, a cross-repo write costs a clone.
HOST_ROOT="$(git rev-list --max-parents=0 HEAD 2>/dev/null | tail -1)"
if [ -z "$HOST_ROOT" ]; then
  echo "[refresh-aif-base] cannot read the host repo's root commit — refusing to identify the container clone; skip."
  exit 1
fi
if ! icg cat-file -e "${HOST_ROOT}^{commit}" 2>/dev/null; then
  echo "[refresh-aif-base] ABORT: $C:$REPO_PATH is NOT a clone of $REPO."
  echo "   host root commit ${HOST_ROOT:0:7} is absent there, so writing $BRANCH would cross repositories."
  echo "   → run this from the worktree of the project you are dispatching, or set AIF_CONTAINER_REPO."
  exit 1
fi

# ── Refuse dirty tracked changes (never stash silently, never reset --hard) ─────────
refuse_if_dirty() {
  local dirty; dirty="$(icg status --porcelain 2>/dev/null | grep -vE '^\?\?' || true)"
  if [ -n "$dirty" ]; then
    echo "[refresh-aif-base] ABORT: container $BRANCH checkout has uncommitted tracked changes:"
    echo "$dirty" | sed 's/^/   /'
    echo "   → stash by name (docker exec $C git -C $REPO_PATH stash push -m 'refresh-aif-base') and re-run."
    echo "   → this script never stashes silently and never runs git reset --hard."
    return 1
  fi
  return 0
}

# ── Force-set the container base ref AND working tree to $1, then confirm both landed ─
# Handles checked-out $BRANCH (merge --ff-only or detach→branch-f→re-attach) and non-checked-out
# (branch -f + checkout). Verifies BOTH ref and HEAD equal the target before reporting success.
apply_and_verify() {
  local target="$1"

  local head_branch; head_branch="$(icg rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"

  if [ "$head_branch" = "$BRANCH" ]; then
    # Branch is checked out — git branch -f would be refused. Use FF merge or detach+reattach.
    if icg merge --ff-only "$target" >/dev/null 2>&1; then
      :  # fast-forward succeeded — ref and HEAD both advanced
    else
      # Non-FF or merge refused: detach to target, move branch pointer, re-attach.
      icg checkout --detach "$target" >/dev/null 2>&1 || return 1
      icg branch -f "$BRANCH" "$target" 2>/dev/null || return 1
      icg checkout "$BRANCH" >/dev/null 2>&1 || return 1
    fi
  else
    # Branch is NOT checked out — safe to force-move the pointer, then check it out.
    icg branch -f "$BRANCH" "$target" 2>/dev/null || return 1
    icg checkout "$BRANCH" >/dev/null 2>&1 || return 1
  fi

  # Update tracking ref so future fetches compare against the right baseline.
  icg update-ref "refs/remotes/origin/$BRANCH" "$target" 2>/dev/null || true

  # Verify BOTH the branch ref and the working tree HEAD equal the target.
  local now_ref now_head
  now_ref="$(icg rev-parse "$BRANCH" 2>/dev/null || echo none)"
  now_head="$(icg rev-parse HEAD 2>/dev/null || echo none)"
  if [ "$now_ref" != "$target" ] || [ "$now_head" != "$target" ]; then
    echo "[refresh-aif-base] verify FAILED: ref=${now_ref:0:7} HEAD=${now_head:0:7} != target=${target:0:7}"
    return 1
  fi
  return 0
}

# ── Warn if .claude/ has uncommitted edits (those get copied into every new worktree) ─
warn_claude_dirty() {
  local claude_dirty; claude_dirty="$(icg status --porcelain -- .claude/ 2>/dev/null || true)"
  if [ -n "$claude_dirty" ]; then
    echo "⚠ container .claude/ has uncommitted edits — these are copied into every new task worktree:"
    echo "$claude_dirty" | sed 's/^/   /'
    echo "   → commit or stash them inside the container to avoid drift."
  fi
}

# ── Two-part fast no-op: requires BOTH ref AND HEAD at the live tip ─────────────────
CUR_REF="$(icg rev-parse "$BRANCH" 2>/dev/null || echo none)"
CUR_HEAD="$(icg rev-parse HEAD 2>/dev/null || echo none)"

if [ "$CUR_REF" = "$REAL" ] && [ "$CUR_HEAD" = "$REAL" ]; then
  echo "✅ container $BRANCH already current — ref and working tree both match (${REAL:0:7}), no-op."
  exit 0
fi

OLD="$CUR_REF"

# ── Refuse dirty tracked changes before any refresh attempt (never stash, never reset) ─
refuse_if_dirty || exit 1

# ── Parked state: ref is current but working tree is on another branch ──────────────
if [ "$CUR_REF" = "$REAL" ] && [ "$CUR_HEAD" != "$REAL" ]; then
  PARKED="$(icg rev-parse --abbrev-ref HEAD 2>/dev/null || echo detached)"
  echo "⚠ container $BRANCH ref is current (${REAL:0:7}) BUT the base working tree is on '$PARKED' @ ${CUR_HEAD:0:7}"
  echo "   → .claude/ is copied from the working tree, so this is the stale-overlay state."
  echo "   → realigning working tree to $BRANCH @ ${REAL:0:7} ..."
  if apply_and_verify "$REAL"; then
    echo "✅ container $BRANCH realigned from '$PARKED' @ ${CUR_HEAD:0:7} -> ${REAL:0:7}  (parked-state recovery)"
    echo "   revert: docker exec $C git -C $REPO_PATH checkout $PARKED"
    warn_claude_dirty
    exit 0
  fi
  echo "[refresh-aif-base] parked-state realign FAILED — see verify output above."
  exit 1
fi

echo "container $BRANCH = ${CUR_REF:0:7}  ->  ${REAL:0:7}  (refresh needed)"

# ── PRIMARY (portable): the container fetches GitHub directly ────────────────────────
if icg fetch origin "$BRANCH" >/dev/null 2>&1; then
  FETCHED="$(icg rev-parse "origin/$BRANCH" 2>/dev/null || echo none)"
  # Accept the primary path only if the fetch actually advanced the base off the stale OLD
  # (a container whose origin points elsewhere / is itself stale falls through to the fallback,
  #  which forces the exact gh-api tip). A benign race where origin moved past REAL is fine.
  if [ "$FETCHED" != "none" ] && [ "$FETCHED" != "$OLD" ]; then
    if apply_and_verify "$FETCHED"; then
      [ "$FETCHED" = "$REAL" ] || echo "[refresh-aif-base] note: container origin tip ${FETCHED:0:7} != gh-api snapshot ${REAL:0:7} (benign race / origin ahead)."
      echo "✅ container $BRANCH ${OLD:0:7} -> ${FETCHED:0:7}  (primary: in-container git fetch)"
      echo "   revert: docker exec $C git -C $REPO_PATH checkout --detach && docker exec $C git -C $REPO_PATH branch -f $BRANCH $OLD && docker exec $C git -C $REPO_PATH checkout $BRANCH"
      warn_claude_dirty
      exit 0
    fi
    echo "[refresh-aif-base] primary fetch landed but branch-set failed — trying host-bundle fallback."
  else
    echo "[refresh-aif-base] in-container fetch did not advance the base (origin stale/elsewhere) — host-bundle fallback."
  fi
else
  echo "[refresh-aif-base] in-container 'git fetch' failed (tunnel/airgap?) — host-bundle fallback."
fi

# ── FALLBACK (tunnel/airgap): host gets objects -> bundle -> docker cp -> import ─────
# OPTIONAL operator-local dep: reconstruct host objects via gh API only when the host is stale
# AND a sync helper is present; otherwise degrade with a clear message (never hard-depend).
HOST="$(git rev-parse "$BRANCH" 2>/dev/null || echo none)"
if [ "$HOST" != "$REAL" ]; then
  SYNC="${AIF_SYNC_HELPER:-$HOME/.claude/sync-branch-from-api.sh}"
  if [ -f "$SYNC" ]; then
    echo "host $BRANCH stale (${HOST:0:7}) — reconstructing via gh API (FF-only) using $SYNC ..."
    bash "$SYNC" "$BRANCH" || { echo "[refresh-aif-base] host sync failed (diverged? resolve manually) — skip."; exit 1; }
    HOST="$(git rev-parse "$BRANCH" 2>/dev/null || echo none)"
  else
    echo "[refresh-aif-base] host $BRANCH stale (${HOST:0:7}) and no sync helper ($SYNC) to reconstruct it."
    echo "   → on a normal network the PRIMARY in-container fetch handles this; the fallback is the tunnel/airgap case."
    echo "   → provide the objects on the host (git fetch / git bundle) or set AIF_SYNC_HELPER, then re-run. Skipping."
    exit 1
  fi
fi
[ "$HOST" = "$REAL" ] || { echo "[refresh-aif-base] host $BRANCH (${HOST:0:7}) != real (${REAL:0:7}) after sync — skip."; exit 1; }

BUNDLE="$(mktemp -t aif-base.XXXXXX.bundle)"; trap 'rm -f "$BUNDLE"' EXIT
git bundle create "$BUNDLE" "$BRANCH" >/dev/null 2>&1 && git bundle verify "$BUNDLE" >/dev/null 2>&1 \
  || { echo "[refresh-aif-base] bad bundle — skip."; exit 1; }
echo "bundle $(du -h "$BUNDLE" | cut -f1) -> $C"
docker cp "$BUNDLE" "$C:/tmp/aif-base.bundle"
# '+' forces past the non-FF (old base is a divergent synthetic commit); the fetch imports the
# objects, then apply_and_verify sets the local base to the exact live tip.
icg fetch /tmp/aif-base.bundle "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH" >/dev/null 2>&1 || true
docker exec "$C" rm -f /tmp/aif-base.bundle 2>/dev/null || true
if apply_and_verify "$REAL"; then
  echo "✅ container $BRANCH ${OLD:0:7} -> ${REAL:0:7}  (fallback: host bundle import)"
  echo "   revert: docker exec $C git -C $REPO_PATH checkout --detach && docker exec $C git -C $REPO_PATH branch -f $BRANCH $OLD && docker exec $C git -C $REPO_PATH checkout $BRANCH"
  icg log --oneline -1 "$BRANCH" 2>/dev/null || true
  warn_claude_dirty
  exit 0
fi
echo "[refresh-aif-base] verify failed after fallback (container $BRANCH != ${REAL:0:7}) — skip."
exit 1
