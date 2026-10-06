#!/usr/bin/env bash
# The shipped pre-commit runs lint-staged with SERIALIZED task groups (--concurrent false).
#
# WHY: with lint-staged's default infinite concurrency, the shipped .lintstagedrc.json races
# on package.json: the `*.{json,md,yml,yaml}` / `package.json` groups REWRITE it non-atomically
# (prettier --write, sort-package-json — fs write = truncate-then-write), while the
# `*.{ts,tsx}` group's lint step reads it outside its own file set (an oxlint JS plugin load
# resolves the specifier against the project and reads package.json). CI flake 2026-10-05/06
# (PR #2056 run 37393570781, PR #2058 run 37390691879): the log shows `[STARTED] 'npm run lint'
# oxlint` → `[COMPLETED] sort-package-json` → oxlint `JSONError { path: …/consumer/package.json,
# message: "File is empty" }` — the read landed inside the rewrite's truncate window. Overlapping
# globs are not the (only) problem — the reader reads a file it does not stage — so the
# negation-pattern fix lint-staged documents does not apply; serial groups are the fix.
#
# ARMS:
#   (A) the template's lint-staged invocation carries --concurrent false (sub-tasks inside a
#       group stay sequential either way; groups now run one at a time, so no task reads a file
#       another task is rewriting);
#   (B) paired-negative: the same predicate flags an invocation without the flag (a bare
#       `npx lint-staged` — the pre-fix shape — does not pass).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PC_TPL="$REPO_ROOT/packages/core/templates/shared/husky-pre-commit.sh"

PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

serial_invocation() { # $1 = hook file → 0 when its lint-staged call is serialized
  grep -E '^npx lint-staged --concurrent false(\s|\|\||$)' "$1" >/dev/null 2>&1
}

test -f "$PC_TPL" || { echo "✗ template missing: $PC_TPL"; exit 1; }

# ARM (A): the shipped hook serializes lint-staged's task groups.
LINE=$(grep -n 'npx lint-staged' "$PC_TPL" | head -1)
if [ -n "$LINE" ]; then
  ok "template invokes lint-staged ($LINE)"
else
  bad "template has no lint-staged invocation"
fi

if serial_invocation "$PC_TPL"; then
  ok "(A) the lint-staged call carries --concurrent false — task groups run serially, no reader/writer overlap on package.json"
else
  bad "(A) lint-staged runs with default infinite concurrency — sort-package-json/prettier can rewrite package.json while the lint step's plugin load reads it (CI flake 2026-10-05/06)"
fi

# ARM (B): paired-negative — the pre-fix shape must fail the same predicate.
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
sed 's/^npx lint-staged --concurrent false/npx lint-staged/' "$PC_TPL" > "$T/pre-commit"
if serial_invocation "$T/pre-commit"; then
  bad "(B) paired-negative: a hook line without --concurrent false PASSES the predicate — the assert cannot distinguish"
else
  ok "(B) paired-negative: the pre-fix shape (bare npx lint-staged) fails the predicate"
fi

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
