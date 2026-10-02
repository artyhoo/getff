#!/usr/bin/env bash
# Paired-negative for scripts/ci-capture.sh — capture a value only the CI runner produces by
# pushing a throwaway chore/** branch with a marker-wrapped print in a test file a job already
# runs (operational-conventions.md §5).
#
# git is REAL (a bare "origin" + a seed clone under mktemp), so the branch really is created,
# pushed and deleted, and the operator's own checkout is asserted untouched. gh is a PATH stub
# over JSON fixtures that applies the script's OWN `-q` expressions with real jq — so the
# script's filters (run lookup, the not-completed cancel filter, the job TSV) are exercised,
# not re-implemented by the stub. Job logs are served on `gh api .../actions/jobs/<id>/logs`
# (the endpoint the script must use: `gh run view --log` refuses until the whole run is done);
# `failonce.<id>` makes the first read of a log fail. On `run list` the stub snapshots the
# pushed test file from the bare origin — how the injected content is asserted after the
# script has already deleted the branch.
#
# Needs: git, jq, node. CI: invoked from .github/workflows/audit-self.yml (the
# ci-path-scope.test.sh step, same line).
set -uo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
SCRIPT="$HERE/ci-capture.sh"
PASS=0
FAIL=0
ok()  { PASS=$((PASS+1)); printf 'PASS: %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); printf 'FAIL: %s\n' "$1"; }
for tool in git jq node; do
  command -v "$tool" >/dev/null 2>&1 || { echo "ci-capture.test.sh: $tool not on PATH — cannot run"; exit 1; }
done

TMP=$(mktemp -d "${TMPDIR:-/tmp}/ci-capture-test.XXXXXX")
trap 'rm -rf "$TMP"' EXIT
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@example.invalid GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@example.invalid
export GIT_CONFIG_NOSYSTEM=1 HOME="$TMP/home" CI_CAPTURE_REPO=o/r
mkdir -p "$HOME"
git config --global init.defaultBranch staging
git config --global core.hooksPath /dev/null

# ── gh stub ──────────────────────────────────────────────────────────────────────────────────
mkdir -p "$TMP/bin"
cat > "$TMP/bin/gh" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$STUB_DIR/calls"
q="" br="" prev=""
for a in "$@"; do
  [ "$prev" = "-q" ] && q="$a"
  [ "$prev" = "--branch" ] && br="$a"
  prev="$a"
done
case "$1 $2" in
  "run list")
    [ -n "$br" ] && git --git-dir="$ORIGIN" show "$br:$STUB_FILE" > "$STUB_DIR/pushed" 2>/dev/null
    [ -f "$STUB_DIR/runs.json" ] || exit 0
    jq -r "$q" "$STUB_DIR/runs.json" ;;
  "run view")
    jq -r "$q" "$STUB_DIR/run.json" ;;
  "run cancel") exit 0 ;;
  api\ *)
    id=$(printf '%s' "$2" | sed -nE 's#^repos/o/r/actions/jobs/([0-9]+)/logs$#\1#p')
    [ -n "$id" ] || { echo "stub: unexpected api path $2" >&2; exit 1; }
    if [ -f "$STUB_DIR/failonce.$id" ]; then rm -f "$STUB_DIR/failonce.$id"; echo '{"message":"Not Found"}'; exit 1; fi
    cat "$STUB_DIR/log.$id" 2>/dev/null || { echo '{"message":"Not Found"}'; exit 1; } ;;
esac
STUB
chmod +x "$TMP/bin/gh"

# fresh_repo — bare origin with a `staging` branch holding the script under test + test files.
fresh_repo() {
  rm -rf "$TMP/origin.git" "$TMP/seed" "$TMP/stub"
  mkdir -p "$TMP/stub"
  git init -q --bare "$TMP/origin.git"
  git clone -q "$TMP/origin.git" "$TMP/seed" 2>/dev/null
  mkdir -p "$TMP/seed/scripts" "$TMP/seed/pkg"
  cp "$SCRIPT" "$TMP/seed/scripts/ci-capture.sh" 2>/dev/null || true
  printf 'import { it } from "vitest";\nit("a", () => {});\n' > "$TMP/seed/pkg/a.test.ts"
  printf '#!/usr/bin/env bash\necho body\nexit 0\n' > "$TMP/seed/pkg/b.test.sh"
  printf 'console.log("body");\n' > "$TMP/seed/pkg/d.test.mjs"
  git -C "$TMP/seed" add -A
  git -C "$TMP/seed" commit -q -m seed
  git -C "$TMP/seed" push -q origin staging
  export STUB_DIR="$TMP/stub" ORIGIN="$TMP/origin.git" STUB_FILE=pkg/a.test.ts
}

# run_capture <stdout-file> <args...> — runs the script from the seed clone; sets RC.
run_capture() {
  local out="$1"; shift
  ( cd "$TMP/seed" && PATH="$TMP/bin:$PATH" CI_CAPTURE_INTERVAL=0 bash scripts/ci-capture.sh "$@" ) > "$out" 2> "$out.err"
  RC=$?
}

chore_refs() { git --git-dir="$TMP/origin.git" for-each-ref --format='%(refname)' refs/heads/chore/ | grep -c . || true; }
# run_json <status> <jobs TSV "id status name" lines...>
run_json() {
  local st="$1"; shift
  printf '%s\n' "$@" | jq -R -s --arg st "$st" \
    '{status: $st, jobs: [split("\n")[] | select(length > 0) | split("\t") | {databaseId: (.[0] | tonumber), status: .[1], name: .[2]}]}' \
    > "$STUB_DIR/run.json"
}
LOGP='2026-10-01T10:00:00.1234567Z '
ESC=$(printf '\033')

# ── 1. usage errors → 2 ─────────────────────────────────────────────────────────────────────
fresh_repo
run_capture "$TMP/o1" pkg/a.test.ts
if [ "$RC" -eq 2 ]; then ok "missing args → rc 2"; else bad "missing args → rc 2 (got $RC)"; fi
run_capture "$TMP/o1" pkg/a.test.ts 'bad label' 'console.log(1)'
if [ "$RC" -eq 2 ]; then ok "label with a space → rc 2"; else bad "label with a space → rc 2 (got $RC)"; fi
# expect_fast_rc2 <desc> <args...> — a flag without its value must exit 2, not spin forever.
expect_fast_rc2() {
  local desc="$1" pid n=0 rc; shift
  ( cd "$TMP/seed" && PATH="$TMP/bin:$PATH" bash scripts/ci-capture.sh "$@" ) > /dev/null 2>&1 &
  pid=$!
  while kill -0 "$pid" 2>/dev/null && [ "$n" -lt 50 ]; do sleep 0.1; n=$((n+1)); done
  if kill -0 "$pid" 2>/dev/null; then kill "$pid"; wait "$pid" 2>/dev/null; bad "$desc (still running after 5 s)"; return; fi
  wait "$pid"; rc=$?
  if [ "$rc" -eq 2 ]; then ok "$desc"; else bad "$desc (got rc $rc)"; fi
}
expect_fast_rc2 "trailing --timeout without a value → rc 2" pkg/a.test.ts lbl x --timeout
expect_fast_rc2 "trailing --job without a value → rc 2" pkg/a.test.ts lbl x --timeout 5 --job

# ── 2. test file absent on origin/staging → 2, nothing pushed ────────────────────────────────
run_capture "$TMP/o2" pkg/missing.test.ts lbl 'console.log(1)'
if [ "$RC" -eq 2 ]; then ok "absent test file → rc 2"; else bad "absent test file → rc 2 (got $RC)"; fi
if [ "$(chore_refs)" -eq 0 ]; then ok "absent test file → nothing pushed"; else bad "absent test file → a chore branch was pushed"; fi

# ── 3. unsupported extension → 2 ────────────────────────────────────────────────────────────
run_capture "$TMP/o3" pkg/c.test.py lbl 'print(1)'
if [ "$RC" -eq 2 ]; then ok "unsupported extension → rc 2"; else bad "unsupported extension → rc 2 (got $RC)"; fi

# ── 4. happy path (TS): payload from the job that carries it; noise stripped; branch deleted ─
fresh_repo
printf '[{"databaseId":4242,"status":"completed"}]\n' > "$STUB_DIR/runs.json"
run_json completed $'1\tcompleted\tlint' $'2\tcompleted\tPrinciples (Phase 2)'
printf '\357\273\277%sno markers here\n' "$LOGP" > "$STUB_DIR/log.1"
{ printf '\357\273\277%sRunning tests\n' "$LOGP"
  printf '%s  console.log("===XCAP ver===");\n' "$LOGP"            # echoed source is not a marker
  printf '%s%s[90m===XCAP ver===%s[39m\n' "$LOGP" "$ESC" "$ESC"     # coloured marker
  printf '%sgolangci-lint has version 1.55.2\n' "$LOGP"
  printf '%s\n' "$LOGP"
  printf '%sstdout | pkg/a.test.ts\n' "$LOGP"
  printf '%s  {"Issues": []}\r\n' "$LOGP"
  printf '%s===/XCAP ver===\n' "$LOGP"
  printf '%safter\n' "$LOGP"; } > "$STUB_DIR/log.2"
run_capture "$TMP/o4" pkg/a.test.ts ver 'console.log(process.version);'
if [ "$RC" -eq 0 ]; then ok "happy path → rc 0"; else bad "happy path → rc 0 (got $RC)"; cat "$TMP/o4.err"; fi
want=$'golangci-lint has version 1.55.2\n  {"Issues": []}'
if [ "$(cat "$TMP/o4")" = "$want" ]; then ok "payload: BOM/timestamp/ANSI/CR/vitest header/blank stripped, indentation kept"
else bad "payload mismatch"; printf -- '--- got:\n%s\n' "$(cat "$TMP/o4")"; fi
if [ "$(chore_refs)" -eq 0 ]; then ok "remote chore branch deleted after capture"; else bad "remote chore branch left behind"; fi
if grep -qF 'console.log("===XCAP ver===");' "$STUB_DIR/pushed" && grep -qF 'console.log("===/XCAP ver===");' "$STUB_DIR/pushed"; then ok "pushed TS file carries both markers"; else bad "pushed TS file lacks the markers"; fi
if grep -qF 'console.log(process.version);' "$STUB_DIR/pushed"; then ok "pushed TS file carries the snippet"; else bad "pushed TS file lacks the snippet"; fi
if [ "$(head -n 1 "$STUB_DIR/pushed")" = 'import { it } from "vitest";' ]; then ok "TS block appended, original head intact"; else bad "TS original head changed"; fi
if [ -z "$(git -C "$TMP/seed" status --porcelain)" ]; then ok "operator checkout untouched"; else bad "operator checkout dirtied"; fi
if [ "$(git -C "$TMP/seed" worktree list | grep -c .)" -eq 1 ]; then ok "temp worktree removed"; else bad "temp worktree left registered"; fi
if [ "$(git -C "$TMP/seed" for-each-ref refs/heads/chore/ | grep -c . || true)" -eq 0 ]; then ok "local chore branch removed"; else bad "local chore branch left"; fi
if grep -q -- '--workflow audit-self.yml' "$STUB_DIR/calls"; then ok "default workflow = audit-self.yml"; else bad "run list not filtered by audit-self.yml"; fi
if grep -q '^run cancel' "$STUB_DIR/calls"; then bad "completed run was cancelled"; else ok "completed run not cancelled"; fi
unpinned=$(grep -v '^api ' "$STUB_DIR/calls" | grep -v -- '-R o/r')
if [ -n "$unpinned" ]; then bad "a gh call is not pinned with -R o/r"; else ok "every gh run call is pinned with -R to the origin repo"; fi
if grep -q -- '--log' "$STUB_DIR/calls"; then bad "script used gh run view --log (refused mid-run by real gh)"; else ok "logs read via the job-logs endpoint, not run view --log"; fi

# ── 5. shell test file: block goes after the shebang and records stderr + exit status ────────
fresh_repo
export STUB_FILE=pkg/b.test.sh
printf '[{"databaseId":4242,"status":"completed"}]\n' > "$STUB_DIR/runs.json"
run_json completed $'7\tcompleted\tinstall-sh-b'
{ printf '%s===XCAP sh===\n' "$LOGP"; printf '%sv1\n' "$LOGP"; printf '%sXCAP-RC=0\n' "$LOGP"; printf '%s===/XCAP sh===\n' "$LOGP"; } > "$STUB_DIR/log.7"
run_capture "$TMP/o5" pkg/b.test.sh sh 'no-such-tool-xcap --version'
if [ "$RC" -eq 0 ]; then ok "shell capture → rc 0"; else bad "shell capture → rc 0 (got $RC)"; fi
if [ "$(head -n 1 "$STUB_DIR/pushed")" = '#!/usr/bin/env bash' ]; then ok "shebang stays on line 1"; else bad "shebang displaced"; fi
bash "$STUB_DIR/pushed" > "$TMP/o5.run" 2>/dev/null
if [ "$(sed -n 1p "$TMP/o5.run")" = '===XCAP sh===' ] && grep -qx 'body' "$TMP/o5.run"; then ok "shell block runs before the body, body still runs"; else bad "injected shell file broken"; fi
if grep -q 'no-such-tool-xcap' "$TMP/o5.run"; then ok "snippet stderr lands on stdout inside the block"; else bad "snippet stderr not captured"; fi
if grep -qx 'XCAP-RC=127' "$TMP/o5.run"; then ok "snippet exit status printed"; else bad "snippet exit status missing"; fi

# ── 6. JS block really runs: a throw prints XCAP-THREW and the close marker still comes ──────
fresh_repo
export STUB_FILE=pkg/d.test.mjs
printf '[{"databaseId":4242,"status":"completed"}]\n' > "$STUB_DIR/runs.json"
run_json completed $'1\tcompleted\tlint'; printf '%snothing\n' "$LOGP" > "$STUB_DIR/log.1"
run_capture "$TMP/o6" pkg/d.test.mjs js 'throw new Error("boom-xcap");'
node "$STUB_DIR/pushed" > "$TMP/o6.run" 2>&1
if [ "$(sed -n 1p "$TMP/o6.run")" = body ] && grep -q '^XCAP-THREW:.*boom-xcap' "$TMP/o6.run" && [ "$(tail -n 1 "$TMP/o6.run")" = '===/XCAP js===' ]; then
  ok "JS block runs after the body; a throw is caught and the close marker still prints"
else bad "JS block did not run as expected"; cat "$TMP/o6.run"; fi

# ── 7. run finished, no complete block → 1; branch still deleted ────────────────────────────
if [ "$RC" -eq 1 ]; then ok "no marker in finished run → rc 1"; else bad "no marker in finished run → rc 1 (got $RC)"; fi
if [ "$(chore_refs)" -eq 0 ]; then ok "no-marker path deletes the branch"; else bad "no-marker path left the branch"; fi
fresh_repo
printf '[{"databaseId":4242,"status":"completed"}]\n' > "$STUB_DIR/runs.json"
run_json completed $'1\tcompleted\tlint'
{ printf '%s===XCAP ver===\n' "$LOGP"; printf '%spartial\n' "$LOGP"; } > "$STUB_DIR/log.1"
run_capture "$TMP/o7" pkg/a.test.ts ver 'console.log(1)'
if [ "$RC" -eq 1 ] && [ ! -s "$TMP/o7" ]; then ok "open marker without close → rc 1, nothing printed"; else bad "open-only block accepted (rc $RC)"; fi

# ── 8. run never appears → 3 (timeout); branch still deleted ─────────────────────────────────
fresh_repo
run_capture "$TMP/o8" pkg/a.test.ts ver 'console.log(1)' --timeout 1
if [ "$RC" -eq 3 ]; then ok "run never registered → rc 3"; else bad "run never registered → rc 3 (got $RC)"; fi
if [ "$(chore_refs)" -eq 0 ]; then ok "timeout path deletes the branch"; else bad "timeout path left the branch"; fi

# ── 9. found while the run is going → only NOT-completed runs cancelled; --job filters ───────
fresh_repo
printf '[{"databaseId":4242,"status":"in_progress"},{"databaseId":5151,"status":"completed"}]\n' > "$STUB_DIR/runs.json"
run_json in_progress $'1\tcompleted\tlint' $'2\tcompleted\tPrinciples (Phase 2)' $'3\tin_progress\tinstall-sh-a'
printf '%s===XCAP ver===\n%sx\n%s===/XCAP ver===\n' "$LOGP" "$LOGP" "$LOGP" > "$STUB_DIR/log.2"
cp "$STUB_DIR/log.2" "$STUB_DIR/log.1"
run_capture "$TMP/o9" pkg/a.test.ts ver 'console.log(1)' --job Principles --timeout 20
if [ "$RC" -eq 0 ] && [ "$(cat "$TMP/o9")" = x ]; then ok "early capture → rc 0 + payload"; else bad "early capture (rc $RC, out $(cat "$TMP/o9"))"; fi
if grep -q '^run cancel -R o/r 4242$' "$STUB_DIR/calls"; then ok "in-progress run cancelled after capture"; else bad "in-progress run not cancelled"; fi
if grep -q '^run cancel .*5151' "$STUB_DIR/calls"; then bad "completed run 5151 was cancelled"; else ok "completed run on the branch left alone"; fi
if grep -q 'actions/jobs/2/logs' "$STUB_DIR/calls" && ! grep -q 'actions/jobs/1/logs' "$STUB_DIR/calls"; then
  ok "--job filter reads only the matching job's log"; else bad "--job filter read the wrong logs"; fi

# ── 9b. a completed job's log is read once, however many polls the run takes ─────────────────
fresh_repo
printf '[{"databaseId":4242,"status":"in_progress"}]\n' > "$STUB_DIR/runs.json"
run_json in_progress $'1\tcompleted\tlint' $'3\tin_progress\tinstall-sh-a'
printf '%snothing\n' "$LOGP" > "$STUB_DIR/log.1"
run_capture "$TMP/o9b" pkg/a.test.ts ver 'console.log(1)' --timeout 1
polls=$(grep -c -- '--json status' "$STUB_DIR/calls")
if [ "$RC" -eq 3 ] && [ "$polls" -ge 2 ] && [ "$(grep -c 'actions/jobs/1/logs' "$STUB_DIR/calls")" -eq 1 ]; then
  ok "completed job log read once across $polls polls"; else bad "job 1 log read $(grep -c 'actions/jobs/1/logs' "$STUB_DIR/calls") time(s) over $polls polls (rc $RC)"; fi

# ── 10. a failed log read is retried, even after the run completed ──────────────────────────
fresh_repo
printf '[{"databaseId":4242,"status":"completed"}]\n' > "$STUB_DIR/runs.json"
run_json completed $'2\tcompleted\tPrinciples (Phase 2)'
printf '%s===XCAP ver===\n%sy\n%s===/XCAP ver===\n' "$LOGP" "$LOGP" "$LOGP" > "$STUB_DIR/log.2"
: > "$STUB_DIR/failonce.2"
run_capture "$TMP/o10" pkg/a.test.ts ver 'console.log(1)' --timeout 20
if [ "$RC" -eq 0 ] && [ "$(cat "$TMP/o10")" = y ]; then ok "log read that failed once is retried and captured"; else bad "failed log read not retried (rc $RC)"; fi
if [ "$(grep -c 'actions/jobs/2/logs' "$STUB_DIR/calls")" -eq 2 ]; then ok "the failed job log was read exactly twice"; else bad "job 2 log read $(grep -c 'actions/jobs/2/logs' "$STUB_DIR/calls") time(s)"; fi

# ── 11. a pre-push hook that rejects deletes cannot strand the branch ───────────────────────
fresh_repo
printf '[{"databaseId":4242,"status":"completed"}]\n' > "$STUB_DIR/runs.json"
run_json completed $'2\tcompleted\tPrinciples (Phase 2)'
printf '%s===XCAP ver===\n%sz\n%s===/XCAP ver===\n' "$LOGP" "$LOGP" "$LOGP" > "$STUB_DIR/log.2"
mkdir -p "$TMP/hooks"
printf '#!/bin/sh\nwhile read -r l ls r rs; do [ "$ls" = 0000000000000000000000000000000000000000 ] && exit 1; done\nexit 0\n' > "$TMP/hooks/pre-push"
chmod +x "$TMP/hooks/pre-push"
git -C "$TMP/seed" config core.hooksPath "$TMP/hooks"
run_capture "$TMP/o11" pkg/a.test.ts ver 'console.log(1)'
if [ "$RC" -eq 0 ] && [ "$(chore_refs)" -eq 0 ]; then ok "delete bypasses a delete-rejecting pre-push; branch gone"; else bad "delete stranded by pre-push (rc $RC, refs $(chore_refs))"; fi
printf '#!/bin/sh\nexit 1\n' > "$TMP/hooks/pre-push"
run_capture "$TMP/o11b" pkg/a.test.ts ver 'console.log(1)'
if [ "$RC" -eq 2 ] && [ "$(chore_refs)" -eq 0 ]; then ok "the capture push itself still runs pre-push (rejected → rc 2)"; else bad "capture push skipped pre-push (rc $RC)"; fi

printf '\n── ci-capture: %d pass / %d fail ──\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
exit 0
