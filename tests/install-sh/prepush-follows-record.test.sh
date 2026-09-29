#!/usr/bin/env bash
# prepush-follows-record.test.sh — P2 C2 (one-button): the consumer pre-push reads the project's record.
# The shipped hook (packages/core/hooks/pre-push.bundle.mjs) runs its consumer gates through
# scripts/run-armed.sh, and a first step probes every not-armed check, arming the green ones.
#   (A) rule-globs gate red but recorded not-armed → the push is not blocked
#   (B) the same gate armed → the push is blocked (paired negative of A)
#   (C) no scripts/run-armed.sh (a project installed before the record) → the gate runs as before
#   (D) armed-probe: a not-armed check that now exits 0 moves to armed; a red one stays
#   (E) armed-probe with run-armed.sh but no record → the push is blocked, loudly
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
BUNDLE="$REPO_ROOT/packages/core/hooks/pre-push.bundle.mjs"
RA="$REPO_ROOT/packages/core/audit-self/run-armed.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
TMPS=()
cleanup() { [ "${#TMPS[@]}" -gt 0 ] && rm -rf "${TMPS[@]}"; }
trap cleanup EXIT

# consumer <armed lines> <not-armed lines> [no-ra] — a consumer-shaped repo with the bundled hook, a
# red scripts/check-rule-globs.sh, and (unless no-ra) scripts/run-armed.sh + its record.
consumer() {
  local d; d=$(mktemp -d); TMPS+=("$d")
  git -C "$d" init -q; mkdir -p "$d/packages/core/hooks" "$d/scripts" "$d/.ai-factory"
  cp "$BUNDLE" "$d/packages/core/hooks/pre-push.bundle.mjs"
  printf '#!/usr/bin/env bash\necho "globs RED"; exit 1\n' > "$d/scripts/check-rule-globs.sh"
  if [ "${3:-}" != no-ra ]; then
    cp "$RA" "$d/scripts/run-armed.sh"
    {
      echo "<!-- aif:project-checks:begin -->"; echo "stack: ts-server"
      echo "armed:"; [ -n "$1" ] && printf '%s\n' "$1" | sed 's/^/- /'
      echo "not-armed:"; [ -n "$2" ] && printf '%s\n' "$2" | sed 's/^/- /'
      echo "<!-- aif:project-checks:end -->"
    } > "$d/.ai-factory/tool-decisions.md"
  fi
  echo "$d"
}
push_only() { ( cd "$1" && PREPUSH_ONLY="$2" node packages/core/hooks/pre-push.bundle.mjs < /dev/null ) > "$1/.out" 2>&1; }

A=$(consumer "" "bash scripts/check-rule-globs.sh # no HTTP boundary yet")
push_only "$A" rule-globs; rc=$?
[ "$rc" -eq 0 ] && grep -q 'not armed' "$A/.out" && ok "(A) a not-armed red gate does not block the push, and says why" \
  || bad "(A) rc=$rc: $(cat "$A/.out")"

B=$(consumer "bash scripts/check-rule-globs.sh" "")
push_only "$B" rule-globs; rc=$?
[ "$rc" -ne 0 ] && ok "(B) the same gate armed blocks the push" || bad "(B) armed red gate passed"

C=$(consumer "" "" no-ra)
push_only "$C" rule-globs; rc=$?
[ "$rc" -ne 0 ] && ok "(C) no run-armed.sh → the gate runs as before (blocks)" || bad "(C) rc=$rc"

D=$(consumer "" $'true # was red at install\nexit 3 # 3 type errors at install')
push_only "$D" armed-probe; rc=$?
[ "$rc" -eq 0 ] && ok "(D) armed-probe never blocks on a red not-armed check" || bad "(D) rc=$rc: $(cat "$D/.out")"
awk '/^armed:/{f=1;next} /^not-armed:/{f=0} f' "$D/.ai-factory/tool-decisions.md" | grep -qx -- '- true' \
  && ok "(D) the green one moved to armed" || bad "(D) not armed: $(cat "$D/.ai-factory/tool-decisions.md")"
grep -qx -- '- exit 3 # 3 type errors at install' "$D/.ai-factory/tool-decisions.md" && ok "(D) the red one stays" || bad "(D) red one changed"

E=$(consumer "" ""); rm -f "$E/.ai-factory/tool-decisions.md"
push_only "$E" armed-probe; rc=$?
[ "$rc" -ne 0 ] && grep -q 'record' "$E/.out" && ok "(E) no record → the push is blocked, loudly" || bad "(E) rc=$rc: $(cat "$E/.out")"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
