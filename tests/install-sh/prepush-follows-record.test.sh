#!/usr/bin/env bash
# prepush-follows-record.test.sh — P2 C2 (one-button): the consumer pre-push reads the project's record.
# The shipped hook (packages/core/hooks/pre-push.bundle.mjs) runs its consumer gates through
# scripts/run-armed.sh, and a first step probes every not-armed check, arming the green ones.
#   (A) rule-globs gate red but recorded not-armed → the push is not blocked
#   (B) the same gate armed → the push is blocked (paired negative of A)
#   (C) no scripts/run-armed.sh (a project installed before the record) → the gate runs as before
#   (D) armed-probe: a not-armed check that now exits 0 is armed (per-clone sidecar, the tracked record
#       untouched — no dirty tree after the push); a red one stays
#   (E) armed-probe with run-armed.sh but no record → the push is blocked, loudly
#   (F) armed-probe over its bound (PREPUSH_ARMED_PROBE_TIMEOUT_MS) → said, and the push is not blocked
# Two sections that read the project's OWN files go through the record too (advisor, P6 blocker class;
# measured: a project's own `npm install -g cowsay` workflow, and one broken link in its own docs on a
# first push to a new remote, each turned a push that was green before the install red):
#   (G) unpinned-tool-install: the project's workflow has an unpinned install, recorded not-armed →
#       the push is not blocked, and the exact «not armed» line is printed
#   (H) the same check armed → the push is blocked, on the check itself
#   (I) no scripts/run-armed.sh (a project installed before the record) → it blocks as before
#   (J) the framework repo (the SSOT register present) → it blocks as before, whatever the record says
#   (K) lychee: a broken link in the project's own committed doc, recorded not-armed → not blocked,
#       the line printed; (L) armed → blocked; a stub lychee on PATH keeps both arms tool-independent
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
[ "$rc" -ne 0 ] && grep -q 'rule-glob liveness check failed' "$B/.out" \
  && ok "(B) the same gate armed blocks the push, on the gate itself" || bad "(B) rc=$rc: $(tail -3 "$B/.out")"

C=$(consumer "" "" no-ra)
push_only "$C" rule-globs; rc=$?
[ "$rc" -ne 0 ] && grep -q 'rule-glob liveness check failed' "$C/.out" \
  && ok "(C) no run-armed.sh → the gate runs as before (blocks, on the gate itself)" || bad "(C) rc=$rc: $(tail -3 "$C/.out")"

D=$(consumer "" $'true # was red at install\nexit 3 # 3 type errors at install')
before=$(cat "$D/.ai-factory/tool-decisions.md")
push_only "$D" armed-probe; rc=$?
[ "$rc" -eq 0 ] && ok "(D) armed-probe never blocks on a red not-armed check" || bad "(D) rc=$rc: $(cat "$D/.out")"
( cd "$D" && bash scripts/run-armed.sh true ) | grep -q '^· not armed' \
  && bad "(D) the green one is still not armed" || ok "(D) the green one is armed"
[ "$(cat "$D/.ai-factory/tool-decisions.md")" = "$before" ] && ok "(D) the tracked record is untouched (the flip is in the sidecar)" \
  || bad "(D) the probe edited the tracked record"
grep -qx -- '- exit 3 # 3 type errors at install' "$D/.ai-factory/tool-decisions.md" && ok "(D) the red one stays" || bad "(D) red one changed"

E=$(consumer "" ""); rm -f "$E/.ai-factory/tool-decisions.md"
push_only "$E" armed-probe; rc=$?
[ "$rc" -ne 0 ] && grep -q 'record' "$E/.out" && ok "(E) no record → the push is blocked, loudly" || bad "(E) rc=$rc: $(cat "$E/.out")"

F=$(consumer "" 'sleep 5 # red at install')
t0=$(date +%s); ( cd "$F" && PREPUSH_ARMED_PROBE_TIMEOUT_MS=1000 PREPUSH_ONLY=armed-probe node packages/core/hooks/pre-push.bundle.mjs < /dev/null ) > "$F/.out" 2>&1; rc=$?; t1=$(date +%s)
[ "$rc" -eq 0 ] && grep -q 'armed-probe: skipped — over 1 s' "$F/.out" && [ $((t1 - t0)) -lt 5 ] \
  && ok "(F) a probe over its bound is said and does not block the push ($((t1 - t0)) s)" || bad "(F) rc=$rc $((t1 - t0)) s: $(cat "$F/.out")"

# own_files <armed lines> <not-armed lines> [no-ra|framework] — consumer() plus the two record-governed
# check scripts, a workflow with an unpinned install and a committed doc with one broken link.
own_files() {
  local d; d=$(consumer "$1" "$2" "${3:-}")
  cp "$REPO_ROOT/packages/core/audit-self/check-ci-pins.sh" "$REPO_ROOT/packages/core/audit-self/check-doc-links.sh" "$d/scripts/" 2>/dev/null
  mkdir -p "$d/.github/workflows" "$d/docs"
  printf 'on: push\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm install -g cowsay\n' > "$d/.github/workflows/own.yml"
  printf '# Guide\n\nSee [setup](./missing.md).\n' > "$d/docs/guide.md"
  if [ "${3:-}" = framework ]; then mkdir -p "$d/docs/meta-factory"; : > "$d/docs/meta-factory/prior-art-evaluations.md"; fi
  git -C "$d" -c user.email=t@t -c user.name=t add -A >/dev/null && git -C "$d" -c user.email=t@t -c user.name=t commit -qm own
  echo "$d"
}
PINS='bash scripts/check-ci-pins.sh' LINKS='bash scripts/check-doc-links.sh'

G=$(own_files "" "$PINS # exits 1 at install")
push_only "$G" unpinned-tool-install; rc=$?
[ "$rc" -eq 0 ] && grep -qxF "· not armed: $PINS — exits 1 at install" "$G/.out" \
  && ok "(G) the project's own unpinned workflow, not armed → push not blocked, «· not armed: $PINS — exits 1 at install»" \
  || bad "(G) rc=$rc: $(tail -4 "$G/.out")"

H=$(own_files "$PINS" "")
push_only "$H" unpinned-tool-install; rc=$?
[ "$rc" -ne 0 ] && grep -q 'Unpinned bare-run tool install' "$H/.out" && grep -q 'own.yml:6' "$H/.out" \
  && ok "(H) the same check armed blocks the push, naming own.yml:6" || bad "(H) rc=$rc: $(tail -4 "$H/.out")"

I=$(own_files "" "" no-ra)
push_only "$I" unpinned-tool-install; rc=$?
[ "$rc" -ne 0 ] && grep -q 'Unpinned bare-run tool install' "$I/.out" \
  && ok "(I) no run-armed.sh → it blocks as before" || bad "(I) rc=$rc: $(tail -4 "$I/.out")"

J=$(own_files "" "$PINS # exits 1 at install" framework)
push_only "$J" unpinned-tool-install; rc=$?
[ "$rc" -ne 0 ] && grep -q 'Unpinned bare-run tool install' "$J/.out" \
  && ok "(J) the framework repo → it blocks as before, the record does not govern it" || bad "(J) rc=$rc: $(tail -4 "$J/.out")"

# A stub lychee: fails on any file that links ./missing.md, as the real one does offline.
STUB=$(mktemp -d); TMPS+=("$STUB")
printf '#!/usr/bin/env bash\n[ "${1:-}" = --version ] && { echo "lychee 0.0.0-stub"; exit 0; }\nrc=0; for a; do [ -f "$a" ] && grep -q "(./missing.md)" "$a" && { echo "[$a]: [ERROR] missing.md | File not found"; rc=2; }; done; exit $rc\n' > "$STUB/lychee"
chmod +x "$STUB/lychee"
K=$(own_files "" "$LINKS # exits 2 at install")
( cd "$K" && PATH="$STUB:$PATH" PREPUSH_ONLY=lychee node packages/core/hooks/pre-push.bundle.mjs < /dev/null ) > "$K/.out" 2>&1; rc=$?
[ "$rc" -eq 0 ] && grep -qxF "· not armed: $LINKS — exits 2 at install" "$K/.out" \
  && ok "(K) a broken link in the project's own doc, not armed → push not blocked, «· not armed: $LINKS — exits 2 at install»" \
  || bad "(K) rc=$rc: $(tail -4 "$K/.out")"

L=$(own_files "$LINKS" "")
( cd "$L" && PATH="$STUB:$PATH" PREPUSH_ONLY=lychee node packages/core/hooks/pre-push.bundle.mjs < /dev/null ) > "$L/.out" 2>&1; rc=$?
[ "$rc" -ne 0 ] && grep -q 'docs/guide.md' "$L/.out" \
  && ok "(L) the same check armed blocks the push, naming docs/guide.md" || bad "(L) rc=$rc: $(tail -4 "$L/.out")"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
