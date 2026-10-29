# Shared result gate for the dot-review-gate *.test.sh suites — review R6.
#
# A suite is green ONLY when ALL of these hold:
#   - the child node process exited 0, checked BEFORE any output filtering (a
#     pipeline's exit status belongs to the filter, not the child — the old
#     `out=$(node ... | grep ...)` pattern could show all green for a child that
#     printed `ok first-arm` and then crashed);
#   - the child printed something;
#   - the filtered output carries no FAIL token;
#   - the observed set of `ok <arm>` lines EQUALS the expected arm list exactly:
#     missing arms and unexpected arms both fail, so an arm that silently stops
#     running can never look like coverage.
#
# Usage in a suite:
#   source "$DIR/suite-harness.sh"
#   out="$(node "$SCRIPT" args... 2>&1)"; status=$?
#   assert_suite_arms "<suite-name>" "$status" "$out" arm-1 arm-2 ... || exit 1

assert_suite_arms() {
  local name="$1" status="$2" out="$3"
  shift 3

  if [[ "$status" -ne 0 ]]; then
    echo "$out" | grep -v Warning | grep -v trace-warnings | tail -40
    echo "$name: child process exited $status (output above) — never green"
    return 1
  fi

  local clean
  clean="$(echo "$out" | grep -v Warning | grep -v trace-warnings)"

  if [[ -z "$clean" ]]; then
    echo "$name: child produced no output — never green"
    return 1
  fi

  if [[ "$clean" == *FAIL* ]]; then
    echo "$clean"
    echo "$name: FAIL in child output"
    return 1
  fi

  local found want
  found="$(echo "$clean" | grep -oE '^ok [a-zA-Z0-9-]+$' | sed 's/^ok //' | sort)"
  want="$(printf '%s\n' "$@" | sort)"
  if [[ "$found" != "$want" ]]; then
    echo "arm set mismatch (wanted vs found):"
    diff <(echo "$want") <(echo "$found")
    echo "$clean" | head -30
    echo "$name: arm set mismatch — never green"
    return 1
  fi

  echo "$clean" | grep '^ok ' | sed 's/^/  /'
}
