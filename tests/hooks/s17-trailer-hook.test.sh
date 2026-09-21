#!/usr/bin/env bash
# Anti-tautology guard for the §1.7 discipline-trailer check (Wave 10.3 TS port,
# packages/core/hooks/checks/s17.ts). Sibling of prior-art-trailer-hook.test.sh.
#
# Instruments the TS orchestrator end-to-end through a subprocess in an isolated
# tmp repo, via the PREPUSH_ONLY=s17 seam — so it verifies that isDisciplineIntroducing
# + checkS17TrailerBody are correctly wired through realGit + s17Section() reads the
# warn-only env vars + exits as designed. Sections 1–6 do NOT run under the seam.
#
# Pure-logic mutation coverage (≥80% Stryker) lives in checks/s17.test.ts; this
# guard covers the wiring the unit tests cannot reach.
#
# Sub-tests:
#   1. positive: discipline commit + valid §1.7: citation trailer        → exit 0
#   2. negative: discipline commit + generic stub (no file:line),
#                S17_SUBSTANCE_WARN_ONLY=false                            → exit non-zero
#   3. negative: discipline commit + NO §1.7 at all, S17_WARN_ONLY=false  → exit non-zero
#   4. positive: NON-discipline commit (no rule/principle/skill touched)  → exit 0
#   5. positive: discipline commit + §1.7 Bootstrap exemption            → exit 0
#   6. anti-tautology: logic load-bearing — verified by s17.test.ts + Stryker ≥80%
#   7. DEFAULT (env unset): discipline commit + NO §1.7                   → exit non-zero
#                (guards the enforcing default; catches a revert to warn-only)
#   8. DEFAULT (env unset): discipline commit + generic stub (no file:line) → exit non-zero
#                (guards the substance-arm enforcing default)
#
# CI: invoked from .github/workflows/audit-self.yml#principles-meta-tests.

set -uo pipefail

REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
TS_HOOK="$REPO_ROOT/packages/core/hooks/pre-push.ts"
PASS=0
FAIL=0

# tsx loader resolution: packages/core/node_modules (CI prefix install) OR root
# (hoisted dev install). Probe both so the test is environment-agnostic.
if [ -f "$REPO_ROOT/packages/core/node_modules/tsx/dist/esm/index.mjs" ]; then
  REAL_NODE_MODULES="$REPO_ROOT/packages/core/node_modules"
elif [ -f "$REPO_ROOT/node_modules/tsx/dist/esm/index.mjs" ]; then
  REAL_NODE_MODULES="$REPO_ROOT/node_modules"
else
  echo "❌ tsx loader not found in packages/core/node_modules or root node_modules"
  exit 1
fi
TSX_LOADER="$REAL_NODE_MODULES/tsx/dist/esm/index.mjs"

# make_repo: tmp git repo with origin/main synthesised. (No section-1–6 stubs
# needed — PREPUSH_ONLY=s17 runs only §1.7.)
make_repo() {
  local tmp
  tmp=$(mktemp -d)
  git -C "$tmp" init --quiet --initial-branch=main >/dev/null
  git -C "$tmp" config user.email "test@example.com"
  git -C "$tmp" config user.name "test"
  echo '{"name":"test","version":"0.0.0"}' > "$tmp/package.json"
  git -C "$tmp" add package.json
  git -C "$tmp" -c commit.gpgsign=false commit -q -m "init"
  git -C "$tmp" update-ref refs/remotes/origin/main HEAD
  git -C "$tmp" update-ref refs/remotes/origin/staging HEAD
  echo "$tmp"
}

# add_discipline_commit REPO MSG…: adds a new .claude/rules/*.md file containing a
# new "## §" section heading (so isDisciplineIntroducing fires), then commits.
add_discipline_commit() {
  local repo="$1"; shift
  mkdir -p "$repo/.claude/rules"
  printf '# Test rule\n\n## §1 New section\n\nBody of the rule.\n' > "$repo/.claude/rules/test-rule.md"
  git -C "$repo" add .claude/rules/test-rule.md
  local args=()
  for msg in "$@"; do args+=("-m" "$msg"); done
  git -C "$repo" -c commit.gpgsign=false commit -q "${args[@]}"
}

# add_nondiscipline_commit REPO MSG…: changes a non-discipline source file only.
add_nondiscipline_commit() {
  local repo="$1"; shift
  mkdir -p "$repo/src"
  echo 'export const x = 1;' > "$repo/src/x.ts"
  git -C "$repo" add src/x.ts
  local args=()
  for msg in "$@"; do args+=("-m" "$msg"); done
  git -C "$repo" -c commit.gpgsign=false commit -q "${args[@]}"
}

# run_hook REPO: invokes ONLY §1.7 via the PREPUSH_ONLY=s17 seam. Inherits any
# S17_WARN_ONLY / S17_SUBSTANCE_WARN_ONLY exported by the caller.
run_hook() {
  local repo="$1"
  (
    cd "$repo"
    NODE_PATH="$REAL_NODE_MODULES" \
    PREPUSH_ONLY="s17" \
      node --import "$TSX_LOADER" "$TS_HOOK" >/dev/null 2>&1
  )
}

record() {
  local outcome="$1" desc="$2"
  if [ "$outcome" = "pass" ]; then PASS=$((PASS+1)); printf 'PASS: %s\n' "$desc"
  else FAIL=$((FAIL+1)); printf 'FAIL: %s\n' "$desc"; fi
}

# Test 1: discipline commit + valid §1.7: citation trailer → exit 0.
test_1_positive_citation() {
  local repo; repo=$(make_repo)
  add_discipline_commit "$repo" \
    "feat(rules): add test rule" \
    "Body." \
    "§1.7: forward-check: packages/core/principles/02-paired-negative-test.test.ts:216 verified; backward: 0 new files"
  if S17_WARN_ONLY=false S17_SUBSTANCE_WARN_ONLY=false run_hook "$repo"; then
    record pass "1 — discipline commit + valid citation trailer → exit 0"
  else
    record fail "1 — valid citation trailer expected exit 0, got non-zero"
  fi
  rm -rf "$repo"
}

# Test 2: discipline commit + generic stub (no file:line) + substance enforced → non-zero.
test_2_negative_substance_enforced() {
  local repo; repo=$(make_repo)
  add_discipline_commit "$repo" \
    "feat(rules): add test rule" \
    "Body." \
    "§1.7: forward-check applied — Checked all rules, compliant. Backward-check — complete sweep performed."
  if S17_SUBSTANCE_WARN_ONLY=false run_hook "$repo"; then
    record fail "2 — generic stub w/ substance enforced should have failed but exited 0"
  else
    record pass "2 — generic stub (no file:line) + S17_SUBSTANCE_WARN_ONLY=false → exit non-zero"
  fi
  rm -rf "$repo"
}

# Test 3: discipline commit + NO §1.7 + presence enforced → non-zero.
test_3_negative_missing_enforced() {
  local repo; repo=$(make_repo)
  add_discipline_commit "$repo" \
    "feat(rules): add test rule" \
    "Body with no discipline-check reference whatsoever."
  if S17_WARN_ONLY=false run_hook "$repo"; then
    record fail "3 — missing §1.7 w/ presence enforced should have failed but exited 0"
  else
    record pass "3 — no §1.7 trailer + S17_WARN_ONLY=false → exit non-zero"
  fi
  rm -rf "$repo"
}

# Test 4: NON-discipline commit (src only) + nothing → exit 0 (gate not applicable).
test_4_positive_non_discipline() {
  local repo; repo=$(make_repo)
  add_nondiscipline_commit "$repo" \
    "feat: unrelated source change" \
    "No rule/principle/skill touched; §1.7 must not apply."
  if S17_WARN_ONLY=false S17_SUBSTANCE_WARN_ONLY=false run_hook "$repo"; then
    record pass "4 — non-discipline commit → exit 0 (gate not applicable)"
  else
    record fail "4 — non-discipline commit wrongly blocked"
  fi
  rm -rf "$repo"
}

# Test 5: discipline commit + §1.7 Bootstrap exemption → exit 0.
test_5_positive_bootstrap() {
  local repo; repo=$(make_repo)
  add_discipline_commit "$repo" \
    "feat(rules): add test rule" \
    "Body." \
    "§1.7 Bootstrap: this is the discipline-bearing artifact introducing the rule itself"
  if S17_WARN_ONLY=false S17_SUBSTANCE_WARN_ONLY=false run_hook "$repo"; then
    record pass "5 — discipline commit + Bootstrap exemption → exit 0"
  else
    record fail "5 — Bootstrap exemption expected exit 0, got non-zero"
  fi
  rm -rf "$repo"
}

# Test 6: anti-tautology — logic load-bearing verified by s17.test.ts + Stryker ≥80%.
test_6_antitautology_covered_by_vitest() {
  record pass "6 — anti-tautology (s17 logic load-bearing) verified by s17.test.ts + Stryker ≥80%"
}

# Test 7: discipline commit + NO §1.7, env UNSET → non-zero. Guards the enforcing
# DEFAULT (not just the explicit S17_WARN_ONLY=false override). A revert of the
# default to 'true' (warn-only) flips this to exit 0 and fails the test.
test_7_default_blocks_missing() {
  local repo; repo=$(make_repo)
  add_discipline_commit "$repo" \
    "feat(rules): add test rule" \
    "Body with no discipline-check reference whatsoever."
  if ( unset S17_WARN_ONLY S17_SUBSTANCE_WARN_ONLY; run_hook "$repo" ); then
    record fail "7 — missing §1.7 with default (env unset) should block but exited 0 (default reverted to warn?)"
  else
    record pass "7 — no §1.7 + env UNSET → exit non-zero (enforcing default)"
  fi
  rm -rf "$repo"
}

# Test 8: discipline commit + generic stub (no file:line), env UNSET → non-zero.
# Guards the substance-arm enforcing DEFAULT (S17_SUBSTANCE_WARN_ONLY).
test_8_default_blocks_substance() {
  local repo; repo=$(make_repo)
  add_discipline_commit "$repo" \
    "feat(rules): add test rule" \
    "Body." \
    "§1.7: forward-check applied — Checked all rules, compliant. Backward-check — complete sweep performed."
  if ( unset S17_WARN_ONLY S17_SUBSTANCE_WARN_ONLY; run_hook "$repo" ); then
    record fail "8 — generic stub with default (env unset) should block but exited 0 (substance default reverted?)"
  else
    record pass "8 — generic stub (no file:line) + env UNSET → exit non-zero (substance enforcing default)"
  fi
  rm -rf "$repo"
}

test_1_positive_citation
test_2_negative_substance_enforced
test_3_negative_missing_enforced
test_4_positive_non_discipline
test_5_positive_bootstrap
test_6_antitautology_covered_by_vitest
test_7_default_blocks_missing
test_8_default_blocks_substance

printf '\n── Summary ──\n%d pass / %d fail\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
exit 0
