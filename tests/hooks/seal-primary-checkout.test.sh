#!/usr/bin/env bash
# Anti-tautology guard for .claude/hooks/seal-primary-checkout.sh — the PreToolUse
# deny gate that seals the PRIMARY checkout's protected paths (.claude/settings.json,
# .claude/settings.local.json, .husky/**, .git/hooks/**) against file-tool edits from
# ANY session, including worktree sessions (CC path permission rules anchor to the
# session's primary working directory and Write(path) rules are inert harness-wide).
#
# Independence: tests instrument the hook through a subprocess against a THROWAWAY
# git repo + linked worktree in a tmpdir; no test exercises the hook against this
# repo's own paths or this session's own cwd.
#
# Sub-tests (stdin-probe style, cf. tests/hooks/prior-art-trailer-hook.test.sh):
#   1. positive-deny: Edit on primary .claude/settings.json from worktree cwd → deny
#   2. positive-deny: Write on primary .git/hooks/<new> from worktree cwd → deny
#   3. negative: Edit on an ordinary worktree file → allow (exit 0, no deny JSON)
#   4. positive-deny: same sealed Edit run FROM the primary checkout itself → deny
#   5. negative: Edit on a NON-sealed primary file → allow (seal is not checkout-wide)
#   6. positive-deny: MultiEdit on primary .husky/pre-commit from worktree → deny
#   7. negative: Bash tool targeting the sealed path → allow (tool gate, not path gate)
#   8. positive-deny: primary .claude/settings.local.json from worktree → deny
#   9. jq-less branch: PATH without jq, sealed Edit from worktree → still deny (sed fallback)
#  10. negative: non-repo cwd → allow (fail-open outside the sealed set, never global)
#  11. positive-deny: relative file_path resolved against the session cwd → deny
#  12. contract: deny JSON parses via jq, reason ≥20 chars and names the sealed path
#
# CI: invoked from .github/workflows/audit-self.yml (hooks test block).

set -uo pipefail

REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
HOOK="$REPO_ROOT/.claude/hooks/seal-primary-checkout.sh"

PASS=0
FAIL=0

record() {
  local outcome="$1" desc="$2"
  if [ "$outcome" = "pass" ]; then
    PASS=$((PASS + 1))
    printf 'PASS: %s\n' "$desc"
  else
    FAIL=$((FAIL + 1))
    printf 'FAIL: %s\n' "$desc"
  fi
}

make_fixture() {
  local tmp
  tmp=$(mktemp -d "${TMPDIR:-/tmp}/seal-test.XXXXXX")
  git -C "$tmp" init --quiet --initial-branch=main
  git -C "$tmp" config user.email "test@example.com"
  git -C "$tmp" config user.name "test"
  mkdir -p "$tmp/.claude" "$tmp/.husky" "$tmp/.git/hooks" "$tmp/pkg"
  printf '{}\n' >"$tmp/.claude/settings.json"
  printf '{}\n' >"$tmp/.claude/settings.local.json"
  printf 'set -e\n' >"$tmp/.husky/pre-commit"
  printf 'placeholder\n' >"$tmp/pkg/file.txt"
  git -C "$tmp" add -A
  git -C "$tmp" -c commit.gpgsign=false commit -q -m init
  git -C "$tmp" worktree add -q "$tmp-wt" -b seal-wt-branch
  # Primary root as a PHYSICAL path (pwd -P), so expected paths match the hook's
  # canonicalization even where $TMPDIR itself is behind a symlink (/var → /private/var).
  printf '%s' "$(cd "$tmp" && pwd -P)"
}

# run_hook <cwd> <tool> <file_path> [extra PATH]: feed a synthesized PreToolUse
# payload on stdin and print the hook's stdout (empty = allow). Exit code is the
# hook's (0 expected in every case — deny travels via JSON, not the exit code).
run_hook() {
  local cwd="$1" tool="$2" fp="$3" path_override="${4:-}"
  local payload
  payload=$(printf '{"tool_name":"%s","tool_input":{"file_path":"%s"},"cwd":"%s"}' "$tool" "$fp" "$cwd")
  if [ -n "$path_override" ]; then
    (cd "$cwd" && printf '%s' "$payload" | env PATH="$path_override" bash "$HOOK")
  else
    (cd "$cwd" && printf '%s' "$payload" | bash "$HOOK")
  fi
}

assert_deny() {
  local desc="$1" out="$2"
  case "$out" in
    *'"permissionDecision":"deny"'*) record pass "$desc" ;;
    *) record fail "$desc — expected deny JSON, got: $(printf '%s' "$out" | head -c 200)" ;;
  esac
}

assert_allow() {
  local desc="$1" out="$2"
  case "$out" in
    *'"permissionDecision":"deny"'*) record fail "$desc — unexpected deny: $(printf '%s' "$out" | head -c 200)" ;;
    *) record pass "$desc" ;;
  esac
}

# ── Sub-tests ─────────────────────────────────────────────────────────────────

test_1_edit_primary_settings_from_worktree() {
  local repo wt out
  repo=$(make_fixture)
  wt="$repo-wt"
  out=$(run_hook "$wt" Edit "$repo/.claude/settings.json")
  assert_deny "1 — Edit primary .claude/settings.json from worktree cwd → deny" "$out"
  rm -rf "$repo" "$wt"
}

test_2_write_primary_git_hooks_from_worktree() {
  local repo wt out
  repo=$(make_fixture)
  wt="$repo-wt"
  out=$(run_hook "$wt" Write "$repo/.git/hooks/pre-push")
  assert_deny "2 — Write primary .git/hooks/<new> from worktree cwd → deny" "$out"
  rm -rf "$repo" "$wt"
}

test_3_edit_ordinary_worktree_file_allows() {
  local repo wt out
  repo=$(make_fixture)
  wt="$repo-wt"
  printf 'new\n' >"$wt/pkg/file.txt"
  out=$(run_hook "$wt" Edit "$wt/pkg/file.txt")
  assert_allow "3 — Edit ordinary worktree file → allow" "$out"
  rm -rf "$repo" "$wt"
}

test_4_sealed_edit_from_primary_still_denied() {
  local repo out
  repo=$(make_fixture)
  out=$(run_hook "$repo" Edit "$repo/.claude/settings.json")
  assert_deny "4 — sealed Edit run from the primary checkout itself → deny" "$out"
  rm -rf "$repo" "$repo-wt"
}

test_5_non_sealed_primary_file_allows() {
  local repo wt out
  repo=$(make_fixture)
  wt="$repo-wt"
  out=$(run_hook "$wt" Edit "$repo/pkg/file.txt")
  assert_allow "5 — Edit non-sealed primary file from worktree → allow (seal is path-scoped)" "$out"
  rm -rf "$repo" "$wt"
}

test_6_multiedit_primary_husky_denied() {
  local repo wt out
  repo=$(make_fixture)
  wt="$repo-wt"
  out=$(run_hook "$wt" MultiEdit "$repo/.husky/pre-commit")
  assert_deny "6 — MultiEdit primary .husky/pre-commit from worktree → deny" "$out"
  rm -rf "$repo" "$wt"
}

test_7_bash_tool_not_in_scope() {
  local repo wt out
  repo=$(make_fixture)
  wt="$repo-wt"
  out=$(run_hook "$wt" Bash "$repo/.claude/settings.json")
  assert_allow "7 — Bash tool targeting a sealed path → allow (PreToolUse file-tool gate only)" "$out"
  rm -rf "$repo" "$wt"
}

test_8_settings_local_denied() {
  local repo wt out
  repo=$(make_fixture)
  wt="$repo-wt"
  out=$(run_hook "$wt" Write "$repo/.claude/settings.local.json")
  assert_deny "8 — Write primary .claude/settings.local.json from worktree → deny" "$out"
  rm -rf "$repo" "$wt"
}

test_9_jq_less_branch_still_denies() {
  local repo wt out stripped_path
  repo=$(make_fixture)
  wt="$repo-wt"
  # Strip Homebrew so jq is invisible; git/realpath stay reachable via /usr/bin:/bin.
  stripped_path="/usr/bin:/bin"
  out=$(run_hook "$wt" Edit "$repo/.claude/settings.json" "$stripped_path")
  assert_deny "9 — jq absent (stripped PATH), sealed Edit from worktree → deny (sed fallback)" "$out"
  rm -rf "$repo" "$wt"
}

test_10_non_repo_cwd_fails_open() {
  local bare out
  bare=$(mktemp -d "${TMPDIR:-/tmp}/seal-nonrepo.XXXXXX")
  out=$(run_hook "$bare" Edit "$bare/.claude/settings.json")
  assert_allow "10 — non-repo cwd → allow (fail-open outside the sealed set)" "$out"
  rm -rf "$bare"
}

test_11_relative_file_path_resolved() {
  local repo out
  repo=$(make_fixture)
  out=$(run_hook "$repo" Edit ".claude/settings.json")
  assert_deny "11 — relative file_path resolved against the session cwd → deny" "$out"
  rm -rf "$repo" "$repo-wt"
}

test_12_deny_json_contract() {
  local repo wt out parse reason_len named
  repo=$(make_fixture)
  wt="$repo-wt"
  out=$(run_hook "$wt" Edit "$repo/.claude/settings.json")
  parse=0
  reason_len=0
  named=0
  if command -v jq >/dev/null 2>&1; then
    if printf '%s' "$out" | jq -e '.hookSpecificOutput.hookEventName == "PreToolUse" and .hookSpecificOutput.permissionDecision == "deny"' >/dev/null 2>&1; then
      parse=1
    fi
    reason_len=$(printf '%s' "$out" | jq -r '.hookSpecificOutput.permissionDecisionReason | length' 2>/dev/null)
    named=$(printf '%s' "$out" | jq -r --arg p "$(cd "$repo" && pwd -P)/.claude/settings.json" '.hookSpecificOutput.permissionDecisionReason | contains($p)' 2>/dev/null)
  else
    case "$out" in
      *'"hookEventName":"PreToolUse"'*'"permissionDecision":"deny"'*) parse=1 ;;
    esac
    reason_len=${#out}
    case "$out" in
      *settings.json*) named=true ;;
    esac
  fi
  if [ "$parse" -eq 1 ] && [ "${reason_len:-0}" -ge 20 ] && [ "$named" = "true" ]; then
    record pass "12 — deny JSON valid, reason ≥20 chars, names the sealed path"
  else
    record fail "12 — deny JSON contract broken (parse=$parse reason_len=$reason_len named=$named)"
  fi
  rm -rf "$repo" "$wt"
}

# ── Run all ───────────────────────────────────────────────────────────────────

test_1_edit_primary_settings_from_worktree
test_2_write_primary_git_hooks_from_worktree
test_3_edit_ordinary_worktree_file_allows
test_4_sealed_edit_from_primary_still_denied
test_5_non_sealed_primary_file_allows
test_6_multiedit_primary_husky_denied
test_7_bash_tool_not_in_scope
test_8_settings_local_denied
test_9_jq_less_branch_still_denies
test_10_non_repo_cwd_fails_open
test_11_relative_file_path_resolved
test_12_deny_json_contract

printf '\n── Summary ──\n%d pass / %d fail\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
exit 0
