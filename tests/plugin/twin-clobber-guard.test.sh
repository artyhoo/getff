#!/usr/bin/env bash
# Acceptance — the generator refuses to CLOBBER a twin whose content is not derivable
# from either the working-tree source or the HEAD source.
#
# Why this exists (measured, not hypothetical). A twin's mode is decided by a
# `# @plugin-transform:` marker in the SOURCE (scripts/generate-plugin-twins.sh). Remove the
# `manual` marker and the twin silently drops to identity mode, so the next generator run
# overwrites the hand-maintained twin with a copy of the source — deleting whatever logic lived
# only in the twin. Nothing saw it: tests/plugin/twin-generation.test.sh reports
# "byte-identical (no marker needed)" AFTER the clobber, which is true and useless.
#
# That is exactly how the Stage 9C ZCode rollout arm died (#1044 → restored in #1442), and the
# same shape erased it a second time when a session restored the twin alone (e49407d6c0's commit
# body: "restoring plugin/hooks/end-of-turn-reminder alone does not stick"). Measured live
# 2026-08-17 on inject-output-language: dropping the marker took the twin 52 → 30 lines and
# ZCODE_PROJECT_DIR 1 → 0 occurrences, with every gate green.
#
# The guard's rule, stated positively: an identity-mode overwrite is safe only when the twin
# currently on disk equals EITHER the twin derivable from the working-tree source (already in
# sync) OR the twin derivable from the HEAD source (source edited, twin simply stale — the
# normal case the generator exists to fix). Anything else means the twin carries content no
# source can reproduce, and overwriting it is a silent deletion.
#
# Coverage matrix (paired-negative per principle 02):
#   (1) clean tree                          → generator succeeds, twins unchanged
#   (2) source edited, twin stale           → generator succeeds (the normal regeneration case)
#   (3) `manual` marker removed             → generator FAILS, twin left untouched
#   (4) twin hand-edited, source untouched  → generator FAILS, twin left untouched
#   (5) marker still present                → skipped as manual, twin left untouched
#   (6) source/twin absent from HEAD (new)  → guard degrades to allow, never hard-errors
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); echo "  ✓ $1"; }
bad(){ FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# Every case runs against a THROWAWAY CLONE, never the live tree: the generator writes real
# files, and a half-applied mutation in the real repo is exactly the accident this guard is
# about. The clone keeps HEAD (the guard reads it), so the fixtures stay realistic.
SANDBOX=$(mktemp -d "${TMPDIR:-/tmp}/twin-clobber.XXXXXX")
trap 'rm -rf "$SANDBOX"' EXIT

# A MINIMAL repo, not a clone of this one. The guard needs exactly four directories plus a HEAD
# to read `HEAD:<path>` from, and cloning the whole repository eight times cost 2m32s of pure
# I/O (measured) — most of it copying files no case touches. Building one fixture and copying it
# per case takes it to seconds. `env -u GIT_DIR -u GIT_WORK_TREE` because an inherited GIT_DIR
# turns `git init` into a bare-repo surprise when this runs from a hook.
FIXTURE="$SANDBOX/_fixture"
build_fixture() {
  mkdir -p "$FIXTURE"
  local d
  for d in .claude/hooks plugin/hooks agents plugin/agents; do
    mkdir -p "$FIXTURE/$d"
    cp -R "$REPO_ROOT/$d/." "$FIXTURE/$d/" 2>/dev/null || true
  done
  (
    cd "$FIXTURE" || exit 1
    env -u GIT_DIR -u GIT_WORK_TREE git init --quiet
    git config user.email t@t.co
    git config user.name t
    git add -A
    git commit --quiet -m "fixture baseline"
  ) >/dev/null 2>&1
}

fresh_clone() {
  local dst="$SANDBOX/$1"
  rm -rf "$dst"
  cp -R "$FIXTURE" "$dst" || return 1
  printf '%s' "$dst"
}

build_fixture

# Run the WORKING-TREE generator against the sandbox, via CLAUDE_PROJECT_DIR (which the
# generator prefers over $0's location). Running the sandbox's own copy would test whatever is
# committed at HEAD instead of the change under review — which is how the first draft of this
# file reported RED against a guard that was already written but not yet committed.
run_gen() {
  (CLAUDE_PROJECT_DIR="$1" bash "$REPO_ROOT/scripts/generate-plugin-twins.sh" >/dev/null 2>&1)
}

# A source declared `manual` whose twin genuinely diverges — the population this guard protects.
SRC_REL=".claude/hooks/inject-output-language.sh"
TWIN_REL="plugin/hooks/inject-output-language"

echo "== twin clobber guard =="

# ==============================================================================
# (1) clean tree → generator succeeds and changes nothing
# ==============================================================================
C=$(fresh_clone c1) && {
  before=$(md5 -q "$C/$TWIN_REL" 2>/dev/null || md5sum "$C/$TWIN_REL" | cut -d' ' -f1)
  if run_gen "$C"; then
    after=$(md5 -q "$C/$TWIN_REL" 2>/dev/null || md5sum "$C/$TWIN_REL" | cut -d' ' -f1)
    [ "$before" = "$after" ] && ok "(1) clean tree: generator succeeds, twin untouched" \
      || bad "(1) clean tree: twin changed on a no-op run"
  else
    bad "(1) clean tree: generator exited non-zero"
  fi
}

# ==============================================================================
# (2) identity source edited, twin stale → generator regenerates (the normal case)
# ==============================================================================
C=$(fresh_clone c2) && {
  ID_SRC="$C/.claude/hooks/check-hook-marker.sh"
  ID_TWIN="$C/plugin/hooks/check-hook-marker"
  if [ -f "$ID_SRC" ] && [ -f "$ID_TWIN" ]; then
    printf '\n# sentinel-edit-for-test\n' >> "$ID_SRC"
    if run_gen "$C" && grep -q 'sentinel-edit-for-test' "$ID_TWIN"; then
      ok "(2) source edited, twin stale → regenerated (guard does not block the normal case)"
    else
      bad "(2) source edited: generator refused or did not propagate the edit"
    fi
  else
    bad "(2) fixture missing: no identity-mode source/twin pair to probe"
  fi
}

# ==============================================================================
# (3) `manual` marker removed → generator MUST fail, twin MUST survive
# ==============================================================================
C=$(fresh_clone c3) && {
  before=$(wc -l < "$C/$TWIN_REL")
  grep -v '^# @plugin-transform: manual' "$C/$SRC_REL" > "$C/.tmp" && mv "$C/.tmp" "$C/$SRC_REL"
  if run_gen "$C"; then
    after=$(wc -l < "$C/$TWIN_REL")
    bad "(3) marker removed: generator SUCCEEDED and clobbered the twin ($before → $after lines)"
  else
    after=$(wc -l < "$C/$TWIN_REL")
    [ "$before" = "$after" ] \
      && ok "(3) marker removed → generator fails, twin survives intact ($after lines)" \
      || bad "(3) marker removed: generator failed but twin was already damaged ($before → $after)"
  fi
}

# ==============================================================================
# (4) twin hand-edited while source untouched → generator MUST fail
# (the e49407d6c0 incident: a twin-only restore that pre-commit silently undid)
# ==============================================================================
C=$(fresh_clone c4) && {
  ID_TWIN="$C/plugin/hooks/check-hook-marker"
  if [ -f "$ID_TWIN" ]; then
    printf '\n# hand-edit-only-in-twin\n' >> "$ID_TWIN"
    if run_gen "$C"; then
      grep -q 'hand-edit-only-in-twin' "$ID_TWIN" \
        && bad "(4) twin hand-edit: generator succeeded but kept the edit (unexpected)" \
        || bad "(4) twin hand-edit: generator SILENTLY discarded it — the e49407d6c0 failure mode"
    else
      grep -q 'hand-edit-only-in-twin' "$ID_TWIN" \
        && ok "(4) twin hand-edited → generator fails, the edit survives for the author to place" \
        || bad "(4) twin hand-edit: generator failed but the edit was already lost"
    fi
  else
    bad "(4) fixture missing: no identity twin to hand-edit"
  fi
}

# ==============================================================================
# (5) marker present → still skipped as manual, twin untouched (no regression)
# ==============================================================================
C=$(fresh_clone c5) && {
  before=$(wc -l < "$C/$TWIN_REL")
  if run_gen "$C"; then
    after=$(wc -l < "$C/$TWIN_REL")
    [ "$before" = "$after" ] && ok "(5) manual marker still honoured, twin untouched" \
      || bad "(5) manual twin was modified ($before → $after)"
  else
    bad "(5) generator failed on an unmodified tree"
  fi
}

# ==============================================================================
# (6) source + twin absent from HEAD → guard degrades to allow, never hard-errors
# ==============================================================================
C=$(fresh_clone c6) && {
  cp "$C/.claude/hooks/check-hook-marker.sh" "$C/.claude/hooks/brand-new-hook.sh"
  cp "$C/plugin/hooks/check-hook-marker" "$C/plugin/hooks/brand-new-hook"
  if run_gen "$C"; then
    ok "(6) hook absent from HEAD → guard allows (no false block on brand-new twins)"
  else
    bad "(6) guard hard-blocked a brand-new hook pair that has no HEAD baseline"
  fi
}

# ==============================================================================
# (7) agents population — same contract. Probed live before this arm was written:
# a hand-edit to plugin/agents/review-sidecar.md vanished, generator exit 0.
# ==============================================================================
C=$(fresh_clone c7) && {
  AG_TWIN="$C/plugin/agents/review-sidecar.md"
  if [ -f "$AG_TWIN" ]; then
    printf '\n<!-- hand-edit-only-in-agent-twin -->\n' >> "$AG_TWIN"
    if run_gen "$C"; then
      bad "(7) agent twin hand-edit: generator succeeded — the cp clobbered it silently"
    else
      grep -q 'hand-edit-only-in-agent-twin' "$AG_TWIN" \
        && ok "(7) agent twin hand-edited → generator fails, the edit survives" \
        || bad "(7) agent twin hand-edit: generator failed but the edit was already lost"
    fi
  else
    bad "(7) fixture missing: plugin/agents/review-sidecar.md absent"
  fi
}

# ==============================================================================
# (8) agents population — stale twin (source edited) still re-syncs, no false block
# ==============================================================================
C=$(fresh_clone c8) && {
  AG_SRC="$C/agents/review-sidecar.md"; AG_TWIN="$C/plugin/agents/review-sidecar.md"
  if [ -f "$AG_SRC" ]; then
    printf '\n<!-- sentinel-agent-source-edit -->\n' >> "$AG_SRC"
    if run_gen "$C" && grep -q 'sentinel-agent-source-edit' "$AG_TWIN"; then
      ok "(8) agent source edited → twin re-synced (guard does not block the normal case)"
    else
      bad "(8) agent source edited: generator refused or did not propagate"
    fi
  else
    bad "(8) fixture missing: agents/review-sidecar.md absent"
  fi
}

echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
