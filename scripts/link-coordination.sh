#!/usr/bin/env bash
# link-coordination.sh — cross-worktree symlink-to-canonical coordination sync.
#
# Symlinks gitignored orchestrator-prompt files to a single canonical store
# outside every worktree, so an edit in any worktree is visible in all others.
#
# Decision origin: research-patch 2026-05-17-cross-worktree-coord-doc-sync.md §5
# SSOT #110 — verdict ADAPT (upstream: worktree-env-sync symlink mode + Archon worktree.linkFiles).
#
# @dual-pair: cross-worktree-coordination-doc-sync
# spec: docs/meta-factory/research-patches/2026-05-17-cross-worktree-coord-doc-sync.md §5
#
# GRANULARITY — option (i): per-file symlinks only.
#   Umbrella dirs (.claude/orchestrator-prompts/<umbrella>/) remain REAL dirs.
#   Only gitignored content files are symlinked; tracked files (README.md,
#   done.md) are NEVER touched — they stay as real per-worktree files.
#
#   Per-file limitation: a NEW gitignored file born in a worktree is only
#   shared after re-running this helper (adopt-then-link). Author new umbrella
#   kickoffs in the primary checkout, or re-run the helper to link them back.
#   Root-level exception (2026-09-14): the shared root FAMILIES —
#   `_handoff-*.md`, `_residue-*.md`, `_morning-report-*.md` — are glob-shared
#   (ROOT-FILE sections below); they must cross checkouts, or a session in one
#   worktree cannot see the carry-over authored in another.
#
# Usage: bash scripts/link-coordination.sh [<worktree-dir>] [<seed-source-dir>]
#
#   <worktree-dir>    the worktree to link (default: git toplevel of cwd)
#   <seed-source-dir> optional primary checkout to bootstrap $CANON from
#                     (only seeds when $CANON is empty)
#
# Contract:
#   stdout  : NOTHING — reserved by CC WorktreeCreate hook for the worktree path.
#             All diagnostic/progress output goes to STDERR.
#   exit 0  : success (symlinks created or already correct)
#   exit 1  : conflict detected (real file in worktree AND in CANON — never clobbers)
#
# Lifecycle split (cross-session kickoff portability, SSOT #116): kickoff.md is a
# committed durable design doc (git owns it); state.md + _plan-cache +
# _master-backlog-delta are gitignored regenerable runtime (this helper owns them).
#
# Tracked files skipped: ANY git-tracked file under orchestrator-prompts/ — the
# decision is derived from `git ls-files` (see is_tracked() below), NOT a fixed
# name-list. The common cases (README.md, */done.md, */kickoff.md) retain a
# name-based fast-path so fake/non-git worktrees in tests still skip them; the
# git-tracked check additionally covers one-off .gitignore tracked-exceptions
# (e.g. !.../<umbrella>/stage-N.md, !.../modular-install-fullpack/kickoff-s*.md)
# that the name-list cannot enumerate. Symlinking such a tracked file replaces the
# real committed file with a symlink, which a downstream recursive copy (aif-handoff
# cpSync of `.claude`) then hits as EEXIST — the crash-loop this guard prevents.

set -euo pipefail

# ── ARGS ──────────────────────────────────────────────────────────────────────

ON_CONFLICT="skip"
POSITIONAL=()
for arg in "$@"; do
  case "$arg" in
    --on-conflict=*) ON_CONFLICT="${arg#*=}" ;;
    *)               POSITIONAL+=("$arg") ;;
  esac
done
WT_DIR="${POSITIONAL[0]:-}"
SEED_SRC="${POSITIONAL[1]:-}"
case "$ON_CONFLICT" in
  canon|worktree|skip) ;;
  *) echo "link-coordination: invalid --on-conflict='$ON_CONFLICT' (canon|worktree|skip)" >&2; exit 2 ;;
esac

if [[ -z "$WT_DIR" ]]; then
  WT_DIR="$(git rev-parse --show-toplevel 2>/dev/null)" || {
    echo "link-coordination: cannot resolve worktree-dir (pass arg or run inside a repo)" >&2
    exit 1
  }
fi

CANON="${CLAUDE_COORDINATION_DIR:-$HOME/.claude-coordination/rules-as-tests-aif}"
WT_PROMPTS="$WT_DIR/.claude/orchestrator-prompts"

# ── TRACKED-FILE DETECTION ────────────────────────────────────────────────────
# A file that git tracks is owned by git and must NEVER be symlink-managed: doing
# so replaces the real committed file with a symlink in the primary checkout, and
# a downstream recursive copy (e.g. aif-handoff's cpSync of `.claude` into a fresh
# worktree) then throws EEXIST when the symlink lands over the git-checked-out real
# file. The historical hard-coded skip-list (done.md / README.md / kickoff.md) only
# covered the *common* tracked-exception lines in .gitignore; one-off exceptions
# (e.g. `!.claude/orchestrator-prompts/<umbrella>/stage-N.md`,
# `!.../modular-install-fullpack/kickoff-s*.md`) slipped through and were wrongly
# adopted. This check derives the skip decision from git itself, so ANY tracked
# file is skipped regardless of name. Non-git / fake worktrees: ls-files returns
# non-zero → not skipped here, and the name-based fast-path below still applies.
is_tracked() {
  # $1 = path (absolute or repo-relative) inside $WT_DIR
  git -C "$WT_DIR" ls-files --error-unmatch -- "$1" >/dev/null 2>&1
}

# ── INIT ──────────────────────────────────────────────────────────────────────

mkdir -p "$CANON"
mkdir -p "$WT_PROMPTS"

# ── SEED ──────────────────────────────────────────────────────────────────────
# Only when a seed-source is given AND $CANON currently has zero umbrella dirs.
# Seeds gitignored content from the primary checkout into $CANON so fresh
# worktrees are not blind (preserves J5 goal with live-share semantics).
# Excludes tracked files — $CANON holds only gitignored content. The name-based
# excludes (done.md, README.md) are kept as a fast-path; the authoritative filter
# is the git-tracked exclude list built below, so one-off tracked exceptions
# (stage-N.md, kickoff-s*.md) are never seeded into $CANON either.

if [[ -n "$SEED_SRC" ]]; then
  SRC_PROMPTS="$SEED_SRC/.claude/orchestrator-prompts"
  # Count existing umbrella dirs in $CANON
  CANON_DIRS=0
  if [[ -d "$CANON" ]]; then
    CANON_DIRS=$(find "$CANON" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
  fi

  if [[ "$CANON_DIRS" -eq 0 ]] && [[ -d "$SRC_PROMPTS" ]] && command -v rsync >/dev/null 2>&1; then
    echo "link-coordination: seeding \$CANON from $SRC_PROMPTS ..." >&2
    # Build rsync excludes for every git-tracked file under orchestrator-prompts/
    # (paths made relative to $SRC_PROMPTS, which is the rsync transfer root).
    TRACKED_EXCLUDES=()
    while IFS= read -r tracked_rel; do
      [[ -n "$tracked_rel" ]] && TRACKED_EXCLUDES+=( --exclude="${tracked_rel#.claude/orchestrator-prompts/}" )
    done < <(git -C "$SEED_SRC" ls-files -- '.claude/orchestrator-prompts/' 2>/dev/null)
    rsync -a --ignore-existing \
      --exclude='done.md' \
      --exclude='README.md' \
      ${TRACKED_EXCLUDES[@]+"${TRACKED_EXCLUDES[@]}"} \
      "$SRC_PROMPTS/" "$CANON/" 2>/dev/null || true
    echo "link-coordination: seed complete." >&2
  fi
fi

# ── ADOPT-THEN-LINK ───────────────────────────────────────────────────────────
# For each umbrella under $WT_PROMPTS, for each REAL (non-symlink) gitignored
# file that is not done.md or README.md:
#   - If ABSENT in $CANON → adopt: mv it to $CANON, then symlink back.
#   - If PRESENT in BOTH (real local + canonical) → CONFLICT: exit 1 (never clobber).

CONFLICT=0

if [[ -d "$WT_PROMPTS" ]]; then
  for umbrella_dir in "$WT_PROMPTS"/*/; do
    [[ -d "$umbrella_dir" ]] || continue
    umbrella="$(basename "$umbrella_dir")"

    for file_path in "$umbrella_dir"*; do
      [[ -f "$file_path" ]] || continue        # regular files only (not dirs)
      [[ -L "$file_path" ]] && continue        # skip existing symlinks

      filename="$(basename "$file_path")"
      # Skip tracked files (git owns them; never symlink-manage).
      # Name-based fast-path (covers fake/non-git worktrees in tests) …
      [[ "$filename" == "done.md" ]] && continue
      [[ "$filename" == "README.md" ]] && continue
      [[ "$filename" == "kickoff.md" ]] && continue
      # … plus the authoritative git-tracked check (covers one-off .gitignore
      # exceptions like stage-N.md / kickoff-s*.md the name-list cannot enumerate).
      is_tracked "$file_path" && continue

      canon_target="$CANON/$umbrella/$filename"

      if [[ ! -e "$canon_target" ]]; then
        # Absent in CANON → adopt: mv to CANON, symlink back
        mkdir -p "$CANON/$umbrella"
        mv "$file_path" "$canon_target"
        ln -s "$canon_target" "$file_path"
        echo "link-coordination: adopted $umbrella/$filename → \$CANON" >&2
      else
        case "$ON_CONFLICT" in
          skip)
            echo "CONFLICT: $file_path exists as real file AND $canon_target exists in \$CANON — resolve manually then re-run" >&2
            CONFLICT=1 ;;
          canon)
            rm -f "$file_path"; ln -s "$canon_target" "$file_path"
            echo "link-coordination: on-conflict=canon → canonical wins, relinked $umbrella/$filename" >&2 ;;
          worktree)
            mv -f "$file_path" "$canon_target"; ln -s "$canon_target" "$file_path"
            echo "link-coordination: on-conflict=worktree → worktree wins, adopted $umbrella/$filename" >&2 ;;
        esac
      fi
    done
  done
fi

# ── ROOT-FILE ADOPT-THEN-LINK ───────────────────────────────────────────────
# Exact-name root files (wordlist semantics — no spaces in names)…
ROOT_FILES="_plan-cache.md _master-backlog-delta.json"
# …plus the shared root FAMILIES (2026-09-14), glob-populated from ONE list:
#   `_handoff-*.md`      model/operator-authored session carry-overs — a handoff
#                        authored in one worktree must be readable from every other
#                        checkout (incident 2026-09-14, getff-ai-site: the CC
#                        worktree session's handoff 404'd for the main-clone ZCode
#                        seat reading the path its prompt named);
#   `_residue-*.md`      PreCompact residues, injected as pointers by /pipeline §1
#                        from whatever checkout runs it — same cross-checkout
#                        invisibility class, one family over;
#   `_morning-report-*.md` operator-facing recaps, pointer-referenced from handoff
#                        bodies — a shared handoff naming one must not 404 one hop
#                        later.
# Wordlist semantics stay: a name with whitespace is skipped LOUDLY (the unquoted
# for-loop below cannot carry it); an unmatched glob fails the [[ -f ]] guard.
ROOT_SHARED_FAMILIES=('_handoff-*.md' '_residue-*.md' '_morning-report-*.md')
ROOT_ADOPT_FILES="$ROOT_FILES"
for pattern in "${ROOT_SHARED_FAMILIES[@]}"; do
  for hf in "$WT_PROMPTS"/$pattern; do
    if [[ -f "$hf" ]]; then
      case "${hf##*/}" in
        *[[:space:]]*)
          echo "link-coordination: root shared-file name contains whitespace — not shareable via the wordlist: ${hf##*/}" >&2 ;;
        *)
          ROOT_ADOPT_FILES="$ROOT_ADOPT_FILES ${hf##*/}" ;;
      esac
    fi
  done
done
if [[ -d "$WT_PROMPTS" ]]; then
  for filename in $ROOT_ADOPT_FILES; do
    file_path="$WT_PROMPTS/$filename"
    [[ -f "$file_path" ]] || continue
    [[ -L "$file_path" ]] && continue
    # Tracked files are git's, never symlink-managed (same guard as the umbrella
    # loop; protects a handoff committed via a one-off .gitignore exception from
    # the #canon-symlink-swallows-commit shape, principle 44 arm A's class).
    is_tracked "$file_path" && continue
    canon_target="$CANON/$filename"
    if [[ ! -e "$canon_target" ]]; then
      mv "$file_path" "$canon_target"; ln -s "$canon_target" "$file_path"
      echo "link-coordination: adopted root $filename → \$CANON" >&2
    else
      case "$ON_CONFLICT" in
        skip)     echo "CONFLICT: $file_path exists as real file AND $canon_target exists in \$CANON — resolve manually then re-run" >&2; CONFLICT=1 ;;
        canon)    rm -f "$file_path"; ln -s "$canon_target" "$file_path"; echo "link-coordination: on-conflict=canon → relinked root $filename" >&2 ;;
        worktree) mv -f "$file_path" "$canon_target"; ln -s "$canon_target" "$file_path"; echo "link-coordination: on-conflict=worktree → adopted root $filename" >&2 ;;
      esac
    fi
  done
fi

# ── LINK ──────────────────────────────────────────────────────────────────────
# For each umbrella in $CANON, for each gitignored file:
#   - If target in WT already a correct symlink → skip.
#   - If target exists as REAL file → skip (handled in ADOPT-THEN-LINK above;
#     could be a conflict we already flagged, or a just-adopted file now symlinked).
#   - If target absent → create symlink.

if [[ -d "$CANON" ]]; then
  for canon_umbrella_dir in "$CANON"/*/; do
    [[ -d "$canon_umbrella_dir" ]] || continue
    umbrella="$(basename "$canon_umbrella_dir")"

    # Ensure the umbrella dir exists as a real dir in the worktree
    wt_umbrella_dir="$WT_PROMPTS/$umbrella"
    mkdir -p "$wt_umbrella_dir"

    for canon_file in "$canon_umbrella_dir"*; do
      [[ -f "$canon_file" ]] || continue
      filename="$(basename "$canon_file")"
      # Skip tracked files (git owns them; never symlink-manage).
      [[ "$filename" == "done.md" ]] && continue
      [[ "$filename" == "README.md" ]] && continue
      [[ "$filename" == "kickoff.md" ]] && continue

      wt_target="$wt_umbrella_dir/$filename"

      # Authoritative git-tracked check on the worktree target (covers one-off
      # .gitignore tracked-exceptions the name-list cannot enumerate). Prevents
      # symlinking over a git-checked-out real file → downstream cpSync EEXIST.
      is_tracked "$wt_target" && continue

      if [[ -L "$wt_target" ]]; then
        # Already a symlink → skip (correct by assumption)
        continue
      fi

      if [[ -e "$wt_target" ]]; then
        # Real file exists — was either adopted above or is a conflict already flagged.
        # In either case do NOT ln -s over it (would crash under set -e with "File exists").
        continue
      fi

      # Absent → create symlink
      ln -s "$canon_file" "$wt_target"
      echo "link-coordination: linked $umbrella/$filename → \$CANON" >&2
    done
  done
fi

# ── ROOT-FILE LINK ──────────────────────────────────────────────────────────
if [[ -d "$CANON" ]]; then
  # Superset list: exact names + the shared families globbed from BOTH sides — a
  # file adopted from ANOTHER tree exists only in $CANON, so the worktree-side
  # glob alone would never link it into this checkout (the exact gap that kept
  # worktree-authored handoffs invisible to sibling checkouts before 2026-09-14).
  ROOT_LINK_FILES="$ROOT_ADOPT_FILES"
  for pattern in "${ROOT_SHARED_FAMILIES[@]}"; do
    for hf in "$CANON"/$pattern; do
      if [[ -f "$hf" ]]; then
        case "${hf##*/}" in
          *[[:space:]]*) ;; # adopt side already warned if the same name sat there
          *) ROOT_LINK_FILES="$ROOT_LINK_FILES ${hf##*/}" ;;
        esac
      fi
    done
  done
  for filename in $ROOT_LINK_FILES; do
    canon_file="$CANON/$filename"
    [[ -f "$canon_file" ]] || continue
    wt_target="$WT_PROMPTS/$filename"
    [[ -L "$wt_target" ]] && continue
    # Tracked paths are git's — same guard as the umbrella LINK loop. Covers the
    # tracked-but-absent-on-disk shape (index keeps the name, checkout lacks the
    # file, [[ -e ]] never fires): ln -s would swallow it into a symlink commit,
    # the #canon-symlink-swallows-commit class (kickoff-staging-placement.md §5.2).
    is_tracked "$wt_target" && continue
    [[ -e "$wt_target" ]] && continue
    ln -s "$canon_file" "$wt_target"
    echo "link-coordination: linked root $filename → \$CANON" >&2
  done
fi

# ── EXIT ──────────────────────────────────────────────────────────────────────

if [[ "$CONFLICT" -eq 1 ]]; then
  echo "link-coordination: exiting with conflict(s) — see CONFLICT lines above." >&2
  exit 1
fi

exit 0
