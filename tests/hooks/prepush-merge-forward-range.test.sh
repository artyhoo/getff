#!/usr/bin/env bash
# Paired-negative for the merge-forward range bug (2026-08-07, observed harvesting
# PR #1269/#1270): after the documented merge-forward recipe
# (.claude/rules/git-conflict-merge-forward.md §2 — `git merge origin/staging` on a
# published PR branch, then plain push), the pre-push stdin range
# `remote_sha..local_sha` swept in staging's OWN squash commits. Those commits
# routinely lack `Prior-art:`/`§1.7` trailers (the squash-trailer-loss, compensated
# server-side by the PR-body gate #1098), so the push failed on commits the pusher
# does not own and cannot amend. Fix: exclude commits reachable from the resolved
# trunk (`rev-list remote_sha..local_sha --not <trunk>`) — a range-correctness fix,
# NOT a gate relaxation.
#
# Four cases over one fixture (C1 → feat:F2, origin/feat=F2; staging:S2 = trailer-less
# capability commit, origin/staging=S2; M = merge of origin/staging into feat;
# F3 = NEW trailer-less capability commit on feat after the merge):
#
#   TS hook (PREPUSH_ONLY=prior-art, stdin push of feat):
#   A POSITIVE — push F2→M: S2 (staging-owned, trailer-less) is EXCLUDED → exit 0.
#   B NEGATIVE — push F2→F3: the branch's OWN trailer-less capability commit is
#     still INCLUDED → exit 1 (the gate stays fully live for commits the branch
#     itself introduces).
#
#   bash fallback (pre-push.fallback.sh, same stdin — the reduced channel that
#   mis-fired on the same 2026-08-07 push):
#   C POSITIVE — push F2→M: trunk-reachable commits excluded AND the merge commit
#     itself (no trailer by construction — `git merge --no-edit`) skipped via
#     --no-merges (parity with the TS core, which never flags merge commits:
#     diff-tree/`git show --cc` are empty for a clean merge) → exit 0.
#   D NEGATIVE — push F2→F3: the branch's own trailer-less commit still fails
#     the presence check → exit 1 (--no-merges exempts merges only).
#
# CI: invoked from .github/workflows/audit-self.yml#principles-meta-tests
# (alongside prepush-upstream-ref.test.sh / prepush-fallback-base-ref.test.sh).

set -uo pipefail

REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
TS_HOOK="$REPO_ROOT/packages/core/hooks/pre-push.ts"
FALLBACK="$REPO_ROOT/packages/core/hooks/pre-push.fallback.sh"
PASS=0
FAIL=0

if [ -f "$REPO_ROOT/packages/core/node_modules/tsx/dist/esm/index.mjs" ]; then
  REAL_NODE_MODULES="$REPO_ROOT/packages/core/node_modules"
elif [ -f "$REPO_ROOT/node_modules/tsx/dist/esm/index.mjs" ]; then
  REAL_NODE_MODULES="$REPO_ROOT/node_modules"
else
  echo "❌ tsx loader not found in packages/core/node_modules or root node_modules"
  exit 1
fi
TSX_LOADER="$REAL_NODE_MODULES/tsx/dist/esm/index.mjs"

git_q() { git -C "$1" -c commit.gpgsign=false "${@:2}"; }

# build_repo: the merge-forward fixture. Echoes "<tmp> <F2> <M> <F3>".
# All commits post-date the 2026-05-12 historical cutoff.
build_repo() {
  local tmp
  tmp=$(mktemp -d)
  export GIT_AUTHOR_DATE="2026-08-07T12:00:00" GIT_COMMITTER_DATE="2026-08-07T12:00:00"
  git -C "$tmp" init --quiet --initial-branch=main >/dev/null
  git -C "$tmp" config user.email "test@example.com"
  git -C "$tmp" config user.name "test"
  # One-key-per-line JSON throughout: prior-art.ts isNewDepAdded matches
  # `^[+-]\s+"<key>": "<semver>` per line, so a `{ "a": "1", "b": "2" }` one-liner
  # is invisible to detection (and the C1→S2 reformat diff would false-flag
  # unrelated keys). Mirrors the sibling harnesses' add_cap_commit shape.
  cat > "$tmp/package.json" <<'PKG'
{
  "name": "test",
  "version": "0.0.0"
}
PKG
  # Framework layout: the fallback's §7/§1.7 arms engage only when the SSOT
  # register is present (GH #985 consumer-scope guard).
  mkdir -p "$tmp/docs/meta-factory"
  echo '# register' > "$tmp/docs/meta-factory/prior-art-evaluations.md"
  git -C "$tmp" add package.json docs/meta-factory/prior-art-evaluations.md
  git_q "$tmp" commit -q -m "init" -m "Prior-art: skipped — bootstrap fixture base."   # C1
  git -C "$tmp" update-ref refs/remotes/origin/main HEAD

  # staging side: S2 — a capability commit (new dep) WITHOUT a Prior-art trailer.
  # This is the squash-trailer-loss shape: the trailer lived in the PR body, the
  # squash commit on staging has none (server-side PR-body gate #1098 covered it).
  git -C "$tmp" checkout -q -b tmp-staging main
  cat > "$tmp/package.json" <<'PKG'
{
  "name": "test",
  "version": "0.0.0",
  "dependencies": {
    "staging-dep": "^1.0.0"
  }
}
PKG
  git -C "$tmp" add package.json
  git_q "$tmp" commit -q -m "feat(staging): add staging-dep" -m "No Prior-art line (squash-trailer-loss)."   # S2
  git -C "$tmp" update-ref refs/remotes/origin/staging HEAD

  # feat side: F2 — innocuous doc commit (published PR tip → origin/feat).
  git -C "$tmp" checkout -q -b feat main
  echo "doc" > "$tmp/feat-note.md"
  git -C "$tmp" add feat-note.md
  git_q "$tmp" commit -q -m "docs(feat): note" -m "Prior-art: skipped — innocuous doc, no capability."   # F2
  git -C "$tmp" update-ref refs/remotes/origin/feat HEAD
  local f2; f2=$(git -C "$tmp" rev-parse HEAD)

  # merge-forward: origin/staging INTO feat, plain merge commit (no trailer —
  # exactly what recipe §2 step 7 `git commit --no-edit` produces).
  git_q "$tmp" merge origin/staging --no-edit -q   # M
  local m; m=$(git -C "$tmp" rev-parse HEAD)

  # F3 — a NEW trailer-less capability commit the branch itself introduces.
  cat > "$tmp/package.json" <<'PKG'
{
  "name": "test",
  "version": "0.0.0",
  "dependencies": {
    "staging-dep": "^1.0.0",
    "feat-dep": "^1.0.0"
  }
}
PKG
  git -C "$tmp" add package.json
  git_q "$tmp" commit -q -m "feat(feat): add feat-dep" -m "No Prior-art line."   # F3
  local f3; f3=$(git -C "$tmp" rev-parse HEAD)
  unset GIT_AUTHOR_DATE GIT_COMMITTER_DATE

  echo "$tmp $f2 $m $f3"
}

# run_ts REPO STDIN_LINE: §7 via the PREPUSH_ONLY seam, stdin-driven base.
run_ts() {
  local repo="$1" stdin_line="$2"
  (
    cd "$repo" || exit 1
    printf '%s\n' "$stdin_line" | NODE_PATH="$REAL_NODE_MODULES" \
      PREPUSH_ONLY="prior-art" node --import "$TSX_LOADER" "$TS_HOOK" >/dev/null 2>&1
  )
}

# run_fb REPO STDIN_LINE: the bash fallback, stdin-driven base (no env override).
run_fb() {
  local repo="$1" stdin_line="$2"
  (
    cd "$repo" || exit 1
    printf '%s\n' "$stdin_line" | bash "$FALLBACK" >/dev/null 2>&1
  )
}

record() {
  local outcome="$1" desc="$2"
  if [ "$outcome" = "pass" ]; then PASS=$((PASS+1)); printf 'PASS: %s\n' "$desc"
  else FAIL=$((FAIL+1)); printf 'FAIL: %s\n' "$desc"; fi
}

read -r REPO F2 M F3 <<< "$(build_repo)"

# Test A (TS, positive): push F2→M. Range must exclude trunk-reachable S2 → exit 0.
if run_ts "$REPO" "refs/heads/feat ${M} refs/heads/feat ${F2}"; then
  record pass "A — TS: staging squash commit EXCLUDED from merge-forward push range → exit 0"
else
  record fail "A — TS: merge-forward push flagged staging-owned commits (bare remote_sha..local_sha range)"
fi

# Test B (TS, paired negative): push F2→F3. The branch's OWN trailer-less
# capability commit must still fail → exit 1.
if run_ts "$REPO" "refs/heads/feat ${F3} refs/heads/feat ${F2}"; then
  record fail "B — TS: branch's own trailer-less capability commit NOT flagged (gate relaxed)"
else
  record pass "B — TS: branch's own trailer-less capability commit still INCLUDED → exit 1"
fi

# Test C (fallback, positive): same push F2→M → exit 0 (trunk excluded, merge skipped).
if run_fb "$REPO" "refs/heads/feat ${M} refs/heads/feat ${F2}"; then
  record pass "C — fallback: merge-forward push passes (trunk-reachable excluded, merge commit skipped)"
else
  record fail "C — fallback: merge-forward push blocked (bare range and/or merge-commit presence check)"
fi

# Test D (fallback, paired negative): push F2→F3 → exit 1 (presence check live).
if run_fb "$REPO" "refs/heads/feat ${F3} refs/heads/feat ${F2}"; then
  record fail "D — fallback: branch's own trailer-less commit NOT flagged (presence check relaxed)"
else
  record pass "D — fallback: branch's own trailer-less commit still fails presence check → exit 1"
fi

rm -rf "$REPO"

printf '\n── Summary ──\n%d pass / %d fail\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
exit 0
