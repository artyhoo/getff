#!/usr/bin/env bash
# Paired-negative for the unpushed-merge refusal (scripts/check-merge-pushed.sh, wired by
# .husky/pre-merge-commit and the MERGE_HEAD arm at the top of .husky/pre-commit).
#
# Incident 2026-09-30, branch join/one-button-union: five part branches were merged into a
# join branch without ever being pushed, so `.husky/pre-push` never ran on them. Three gates
# (ci-tool-pinning Rule A, the Docs-card arm, Prior-art C2) went red only on the join, hours
# later, each costing a ~60-minute landing re-check.
#
# Every case runs the REAL hooks: core.hooksPath points at this checkout's .husky for the one
# command under test, and at an empty directory for fixture setup. Cases:
#   A  unpushed branch, clean merge            → refused by pre-merge-commit, HEAD unchanged
#   A2 same, with a `-m "<message with spaces>"` (the join's own merge-message shape)
#   B  unpushed branch, conflicted merge, resolved and committed → refused by pre-commit
#   B2 pushed branch, conflicted merge → pre-commit prints no refusal (the arm discriminates)
#   C  pushed branch, clean merge              → allowed, merge commit created
#   C2 merge-forward of origin/main            → allowed
#   F  `git pull . <unpushed>`                 → refused (heads only in the child merge argv)
#   D  escape with a reason under 20 chars     → refused, nothing logged
#   E  escape with a reason of 20+ chars       → allowed, logged with branch + reason
#
# Bash 3.2 compatible (macOS /bin/bash): no associative arrays, no mapfile, no ${x,,}.
# CI: invoked from .github/workflows/audit-self.yml (tests/hooks/ block).

set -uo pipefail

REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
# MERGE_UNPUSHED_TEST_HOOKS: run against a proposed hook directory before it lands (the
# directory must sit next to a scripts/check-merge-pushed.sh, as .husky does); CI uses .husky.
HOOKS="${MERGE_UNPUSHED_TEST_HOOKS:-$REPO_ROOT/.husky}"
PASS=0
FAIL=0
REFUSAL='never pushed'

ok()   { PASS=$((PASS + 1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL + 1)); echo "  ✗ $1"; [ -n "${2:-}" ] && printf '%s\n' "$2" | sed 's/^/      | /'; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
W="$TMP/w"

g() { git -C "$W" -c commit.gpgsign=false "$@"; }
# The command under test runs with the real hooks; everything else with none.
gh_() { git -C "$W" -c commit.gpgsign=false -c core.hooksPath="$HOOKS" "$@"; }

commit_file() { # <file> <content> <msg>
  printf '%s\n' "$2" > "$W/$1"
  g add "$1" && g commit -q -m "$3"
}

# ── fixture: a bare origin + a clone; main pushed ────────────────────────────
mkdir -p "$TMP/nohooks"
git init -q --bare "$TMP/origin.git"
git init -q --initial-branch=main "$W"
g config user.email test@example.com
g config user.name test
g config core.hooksPath "$TMP/nohooks"
g remote add origin "$TMP/origin.git"
commit_file base.txt base "init"
g push -q -u origin main

# pushed-feat: one commit, pushed.        local-feat: one commit, never pushed.
g checkout -q -b pushed-feat main; commit_file p.txt p "pushed work"; g push -q -u origin pushed-feat
g checkout -q -b local-feat main;  commit_file l.txt l "local work"
# conflict pair: both edit base.txt against the target.
g checkout -q -b local-conflict main;  commit_file base.txt theirs-local "local conflict"
g checkout -q -b pushed-conflict main; commit_file base.txt theirs-pushed "pushed conflict"; g push -q origin pushed-conflict
# origin/main moves ahead (the merge-forward case).
g checkout -q -b main-ahead main; commit_file m.txt m "staging moved"; g push -q origin main-ahead:main
g checkout -q main

# target <name> — a fresh non-fast-forwardable target branch (own commit t.txt).
target() { g checkout -q -b "$1" main; commit_file "t-$1.txt" t "target $1"; }
# conflict_target <name> <branch> — a target that edits base.txt too, then merges <branch>
# WITHOUT hooks (a conflicted `git merge` runs none) and asserts the merge really stopped on a
# conflict; the resolution is staged. Returns 1 when no conflict happened (fixture defect).
conflict_target() {
  target "$1"; commit_file base.txt "ours-$1" "target $1 edits base"
  g merge --no-edit "$2" >/dev/null 2>&1
  g rev-parse -q --verify MERGE_HEAD >/dev/null 2>&1 || return 1
  printf 'resolved\n' > "$W/base.txt"; g add base.txt
}
head_of() { g rev-parse HEAD; }
abort_merge() { g rev-parse -q --verify MERGE_HEAD >/dev/null 2>&1 && g merge --abort; return 0; }

LOG=$(cd "$W" && git rev-parse --path-format=absolute --git-common-dir)/merge-unpushed-override.log

echo "merge-unpushed-refusal"

# ── A: unpushed, clean merge → refused ───────────────────────────────────────
target tA; before=$(head_of)
out=$(gh_ merge --no-edit local-feat 2>&1); rc=$?
if [ "$rc" -ne 0 ] && grep -q "$REFUSAL" <<<"$out" && grep -q "local-feat" <<<"$out" \
   && grep -q "git push" <<<"$out" && [ "$(head_of)" = "$before" ]; then
  ok "A  unpushed branch, clean merge: refused, names the branch, says to push, HEAD unchanged"
else bad "A  unpushed clean merge not refused (rc=$rc)" "$out"; fi
abort_merge

# ── A2: same with a multi-word -m message (the join's shape) ─────────────────
target tA2; before=$(head_of)
out=$(gh_ merge -m "Merge local-feat (abc) into tA2" local-feat 2>&1); rc=$?
if [ "$rc" -ne 0 ] && grep -q "$REFUSAL" <<<"$out" && [ "$(head_of)" = "$before" ]; then
  ok "A2 unpushed branch merged with -m \"<message>\": refused"
else bad "A2 unpushed merge with -m not refused (rc=$rc)" "$out"; fi
abort_merge

# ── B: unpushed, conflicted merge, resolution committed → refused ────────────
conflict_target tB local-conflict || bad "B  fixture: merge of local-conflict did not conflict"
before=$(head_of)
out=$(gh_ commit --no-edit 2>&1); rc=$?
if [ "$rc" -ne 0 ] && grep -q "$REFUSAL" <<<"$out" && grep -q "local-conflict" <<<"$out" \
   && [ "$(head_of)" = "$before" ]; then
  ok "B  unpushed branch, conflicted merge committed: refused by pre-commit, HEAD unchanged"
else bad "B  conflicted unpushed merge not refused at commit (rc=$rc)" "$out"; fi
abort_merge

# ── B2: pushed, conflicted merge → the pre-commit arm stays silent ───────────
# (other pre-commit sections may still fail in this bare fixture; only the refusal is asserted)
if conflict_target tB2 pushed-conflict; then
  out=$(gh_ commit --no-edit 2>&1)
  if grep -q "$REFUSAL" <<<"$out"; then bad "B2 pushed conflicted merge was refused" "$out"
  else ok "B2 pushed branch, conflicted merge committed: no refusal"; fi
else bad "B2 fixture: merge of pushed-conflict did not conflict"; fi
abort_merge

# ── C: pushed, clean merge → allowed ─────────────────────────────────────────
target tC
out=$(gh_ merge --no-edit pushed-feat 2>&1); rc=$?
if [ "$rc" -eq 0 ] && [ "$(g rev-parse HEAD^2 2>/dev/null)" = "$(g rev-parse pushed-feat)" ]; then
  ok "C  pushed branch, clean merge: allowed, merge commit created"
else bad "C  pushed merge blocked (rc=$rc)" "$out"; fi
abort_merge

# ── C2: merge-forward of origin/main → allowed ───────────────────────────────
target tC2; g fetch -q origin
out=$(gh_ merge --no-edit origin/main 2>&1); rc=$?
if [ "$rc" -eq 0 ] && [ "$(g rev-parse HEAD^2 2>/dev/null)" = "$(g rev-parse origin/main)" ]; then
  ok "C2 merge-forward of origin/main: allowed"
else bad "C2 merge-forward blocked (rc=$rc)" "$out"; fi
abort_merge

# ── F: `git pull` of an unpushed branch → refused ───────────────────────────
# pull sets GIT_REFLOG_ACTION="pull …" and runs a child `git merge <sha>`: the heads are ONLY in
# that child's argv, so this case pins the argv read (the others also resolve via the reflog action).
target tF; before=$(head_of)
out=$(gh_ pull --no-rebase --no-edit . local-feat 2>&1); rc=$?
if [ "$rc" -ne 0 ] && grep -q "$REFUSAL" <<<"$out" && [ "$(head_of)" = "$before" ]; then
  ok "F  git pull of an unpushed branch: refused (heads read from the child merge argv)"
else bad "F  unpushed pull not refused (rc=$rc)" "$out"; fi
abort_merge

# ── D: escape with a short reason → refused, not logged ──────────────────────
target tD; before=$(head_of); rm -f "$LOG"
out=$(MERGE_UNPUSHED_OVERRIDE="too short" gh_ merge --no-edit local-feat 2>&1); rc=$?
if [ "$rc" -ne 0 ] && grep -q "20" <<<"$out" && [ "$(head_of)" = "$before" ] && [ ! -s "$LOG" ]; then
  ok "D  escape with a <20-char reason: refused, nothing logged"
else bad "D  short escape reason accepted (rc=$rc)" "$out"; fi
abort_merge

# ── E: escape with a 20+ char reason → allowed and logged ────────────────────
target tE; rm -f "$LOG"
REASON="fixture: operator-approved local-only experiment merge"
out=$(MERGE_UNPUSHED_OVERRIDE="$REASON" gh_ merge --no-edit local-feat 2>&1); rc=$?
if [ "$rc" -eq 0 ] && [ "$(g rev-parse HEAD^2 2>/dev/null)" = "$(g rev-parse local-feat)" ] \
   && grep -q "local-feat" "$LOG" 2>/dev/null && grep -qF "$REASON" "$LOG" 2>/dev/null; then
  ok "E  escape with a 20+ char reason: allowed, logged with branch and reason"
else bad "E  long escape not honoured or not logged (rc=$rc; log: $(cat "$LOG" 2>/dev/null))" "$out"; fi
abort_merge

echo "merge-unpushed-refusal: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
