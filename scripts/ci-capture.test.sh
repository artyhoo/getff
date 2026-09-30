#!/usr/bin/env bash
# Paired-negative for scripts/ci-capture.sh — capture a value only the CI runner produces by
# pushing a throwaway chore/** branch with a marker-wrapped print in a test file a job already
# runs (operational-conventions.md §5).
#
# git is REAL (a bare "origin" + a seed clone under mktemp), so the branch really is created,
# pushed and deleted, and the operator's own checkout is asserted untouched. gh is a PATH stub
# that serves fixture runs/jobs/logs and records every call; on `run list` it snapshots the
# pushed test file from the bare origin, which is how the injected content is asserted after
# the script has already deleted the branch.
#
# CI: invoked from .github/workflows/audit-self.yml (the ci-path-scope.test.sh step, same line).
set -uo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
SCRIPT="$HERE/ci-capture.sh"
PASS=0
FAIL=0
ok()  { PASS=$((PASS+1)); printf 'PASS: %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); printf 'FAIL: %s\n' "$1"; }

TMP=$(mktemp -d "${TMPDIR:-/tmp}/ci-capture-test.XXXXXX")
trap 'rm -rf "$TMP"' EXIT
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@example.invalid GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@example.invalid
export GIT_CONFIG_NOSYSTEM=1 HOME="$TMP/home"
mkdir -p "$HOME"
git config --global init.defaultBranch staging
git config --global core.hooksPath /dev/null

# ── gh stub ──────────────────────────────────────────────────────────────────────────────────
mkdir -p "$TMP/bin"
cat > "$TMP/bin/gh" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$STUB_DIR/calls"
case "$1 $2" in
  "run list")
    br="" ; prev=""
    for a in "$@"; do [ "$prev" = "--branch" ] && br="$a"; prev="$a"; done
    [ -n "$br" ] && git --git-dir="$ORIGIN" show "$br:$STUB_FILE" > "$STUB_DIR/pushed" 2>/dev/null
    case "$*" in
      *databaseId,status*) [ "$(cat "$STUB_DIR/status" 2>/dev/null)" != completed ] && cat "$STUB_DIR/runlist" 2>/dev/null ;;
      *) [ -f "$STUB_DIR/runlist" ] && cat "$STUB_DIR/runlist" ;;
    esac
    exit 0 ;;
  "run view")
    case "$*" in
      *"--json status"*) cat "$STUB_DIR/status" ;;
      *"--json jobs"*)   cat "$STUB_DIR/jobs" ;;
      *"--log"*)
        prev="" ; job=""
        for a in "$@"; do [ "$prev" = "--job" ] && job="$a"; prev="$a"; done
        cat "$STUB_DIR/log.$job" 2>/dev/null ;;
    esac
    exit 0 ;;
  "run cancel") exit 0 ;;
esac
exit 0
STUB
chmod +x "$TMP/bin/gh"

# fresh_repo — bare origin with a `staging` branch holding the script under test + two test files.
fresh_repo() {
  rm -rf "$TMP/origin.git" "$TMP/seed" "$TMP/stub"
  mkdir -p "$TMP/stub"
  git init -q --bare "$TMP/origin.git"
  git clone -q "$TMP/origin.git" "$TMP/seed" 2>/dev/null
  mkdir -p "$TMP/seed/scripts" "$TMP/seed/pkg"
  cp "$SCRIPT" "$TMP/seed/scripts/ci-capture.sh" 2>/dev/null || true
  printf 'import { it } from "vitest";\nit("a", () => {});\n' > "$TMP/seed/pkg/a.test.ts"
  printf '#!/usr/bin/env bash\necho body\nexit 0\n' > "$TMP/seed/pkg/b.test.sh"
  git -C "$TMP/seed" add -A
  git -C "$TMP/seed" commit -q -m seed
  git -C "$TMP/seed" push -q origin staging
  export STUB_DIR="$TMP/stub" ORIGIN="$TMP/origin.git"
}

# run_capture <stdout-file> <args...> — runs the script from the seed clone; sets RC.
run_capture() {
  local out="$1"; shift
  ( cd "$TMP/seed" && PATH="$TMP/bin:$PATH" CI_CAPTURE_INTERVAL=0 bash scripts/ci-capture.sh "$@" ) > "$out" 2> "$out.err"
  RC=$?
}

chore_refs() { git --git-dir="$TMP/origin.git" for-each-ref --format='%(refname)' refs/heads/chore/ | grep -c . || true; }

LOGP=$'Principles (Phase 2)\tRun tests\t2026-10-01T10:00:00.1234567Z '

# ── 1. usage errors → 2 ─────────────────────────────────────────────────────────────────────
fresh_repo
run_capture "$TMP/o1" pkg/a.test.ts
if [ "$RC" -eq 2 ]; then ok "missing args → rc 2"; else bad "missing args → rc 2 (got $RC)"; fi
run_capture "$TMP/o1" pkg/a.test.ts 'bad label' 'console.log(1)'
if [ "$RC" -eq 2 ]; then ok "label with a space → rc 2"; else bad "label with a space → rc 2 (got $RC)"; fi

# ── 2. test file absent on origin/staging → 2, nothing pushed ────────────────────────────────
run_capture "$TMP/o2" pkg/missing.test.ts lbl 'console.log(1)'
if [ "$RC" -eq 2 ]; then ok "absent test file → rc 2"; else bad "absent test file → rc 2 (got $RC)"; fi
if [ "$(chore_refs)" -eq 0 ]; then ok "absent test file → nothing pushed"; else bad "absent test file → a chore branch was pushed"; fi

# ── 3. unsupported extension → 2 ────────────────────────────────────────────────────────────
printf 'x\n' > "$TMP/seed/pkg/c.test.py"; git -C "$TMP/seed" add -A; git -C "$TMP/seed" commit -q -m py; git -C "$TMP/seed" push -q origin staging
run_capture "$TMP/o3" pkg/c.test.py lbl 'print(1)'
if [ "$RC" -eq 2 ]; then ok "unsupported extension → rc 2"; else bad "unsupported extension → rc 2 (got $RC)"; fi

# ── 4. happy path (TS): payload extracted from the job that carries it; branch deleted ───────
fresh_repo
export STUB_FILE=pkg/a.test.ts
printf '4242\n' > "$STUB_DIR/runlist"
printf 'completed\n' > "$STUB_DIR/status"
printf '1\tcompleted\tlint\n2\tcompleted\tPrinciples (Phase 2)\n' > "$STUB_DIR/jobs"
printf '%sno markers here\n' "$LOGP" > "$STUB_DIR/log.1"
{ printf '%sstdout | pkg/a.test.ts\n' "$LOGP"
  printf '%s===XCAP ver===\n' "$LOGP"
  printf '%sgolangci-lint has version 1.55.2\n' "$LOGP"
  printf '%s  {"Issues": []}\r\n' "$LOGP"
  printf '%s===/XCAP ver===\n' "$LOGP"
  printf '%safter\n' "$LOGP"; } > "$STUB_DIR/log.2"
run_capture "$TMP/o4" pkg/a.test.ts ver 'console.log(process.version);'
if [ "$RC" -eq 0 ]; then ok "happy path → rc 0"; else bad "happy path → rc 0 (got $RC)"; cat "$TMP/o4.err"; fi
want=$'golangci-lint has version 1.55.2\n  {"Issues": []}'
if [ "$(cat "$TMP/o4")" = "$want" ]; then ok "payload = lines between markers, prefix + CR stripped, indentation kept"
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

# ── 5. shell test file: block goes after the shebang and records the exit status ─────────────
fresh_repo
export STUB_FILE=pkg/b.test.sh
printf '4242\n' > "$STUB_DIR/runlist"; printf 'completed\n' > "$STUB_DIR/status"
printf '7\tcompleted\tinstall-sh-b\n' > "$STUB_DIR/jobs"
{ printf '%s===XCAP sh===\n' "$LOGP"; printf '%sv1\n' "$LOGP"; printf '%sXCAP-RC=0\n' "$LOGP"; printf '%s===/XCAP sh===\n' "$LOGP"; } > "$STUB_DIR/log.7"
run_capture "$TMP/o5" pkg/b.test.sh sh 'no-such-tool-xcap --version'
if [ "$RC" -eq 0 ]; then ok "shell capture → rc 0"; else bad "shell capture → rc 0 (got $RC)"; fi
if [ "$(head -n 1 "$STUB_DIR/pushed")" = '#!/usr/bin/env bash' ]; then ok "shebang stays on line 1"; else bad "shebang displaced"; fi
if [ "$(sed -n 2p "$STUB_DIR/pushed")" != 'echo body' ] && grep -qF 'echo "===XCAP sh==="' "$STUB_DIR/pushed"; then ok "shell block inserted before the body"; else bad "shell block not inserted before the body"; fi
if grep -qF 'XCAP-RC=' "$STUB_DIR/pushed"; then ok "shell block records the exit status"; else bad "shell block lacks XCAP-RC"; fi
bash "$STUB_DIR/pushed" > "$TMP/o5.run" 2>/dev/null
if grep -q 'no-such-tool-xcap' "$TMP/o5.run"; then ok "snippet stderr lands on stdout inside the block"; else bad "snippet stderr not captured"; fi
if grep -qx 'XCAP-RC=127' "$TMP/o5.run"; then ok "snippet exit status printed"; else bad "snippet exit status missing"; fi
if grep -qx '===XCAP sh===' "$TMP/o5.run" && grep -qx 'body' "$TMP/o5.run"; then ok "injected shell file still runs its body"; else bad "injected shell file broken"; fi

# ── 6. run finished, no marker anywhere → 1; branch still deleted ────────────────────────────
fresh_repo
export STUB_FILE=pkg/a.test.ts
printf '4242\n' > "$STUB_DIR/runlist"; printf 'completed\n' > "$STUB_DIR/status"
printf '1\tcompleted\tlint\n' > "$STUB_DIR/jobs"; printf '%snothing\n' "$LOGP" > "$STUB_DIR/log.1"
run_capture "$TMP/o6" pkg/a.test.ts ver 'console.log(1)'
if [ "$RC" -eq 1 ]; then ok "no marker in finished run → rc 1"; else bad "no marker in finished run → rc 1 (got $RC)"; fi
if [ "$(chore_refs)" -eq 0 ]; then ok "no-marker path deletes the branch"; else bad "no-marker path left the branch"; fi

# ── 7. run never appears → 3 (timeout); branch still deleted ─────────────────────────────────
fresh_repo
run_capture "$TMP/o7" pkg/a.test.ts ver 'console.log(1)' --timeout 1
if [ "$RC" -eq 3 ]; then ok "run never registered → rc 3"; else bad "run never registered → rc 3 (got $RC)"; fi
if [ "$(chore_refs)" -eq 0 ]; then ok "timeout path deletes the branch"; else bad "timeout path left the branch"; fi

# ── 8. found while the run is still going → run cancelled; --job filters which logs are read ─
fresh_repo
printf '4242\n' > "$STUB_DIR/runlist"; printf 'in_progress\n' > "$STUB_DIR/status"
printf '1\tcompleted\tlint\n2\tcompleted\tPrinciples (Phase 2)\n3\tin_progress\tinstall-sh-a\n' > "$STUB_DIR/jobs"
{ printf '%s===XCAP ver===\n' "$LOGP"; printf '%sx\n' "$LOGP"; printf '%s===/XCAP ver===\n' "$LOGP"; } > "$STUB_DIR/log.2"
run_capture "$TMP/o8" pkg/a.test.ts ver 'console.log(1)' --job Principles --timeout 20
if [ "$RC" -eq 0 ] && [ "$(cat "$TMP/o8")" = x ]; then ok "early capture → rc 0 + payload"; else bad "early capture (rc $RC, out $(cat "$TMP/o8"))"; fi
if grep -q '^run cancel 4242' "$STUB_DIR/calls"; then ok "in-progress run cancelled after capture"; else bad "in-progress run not cancelled"; fi
if grep -q -- '--job 2 ' "$STUB_DIR/calls" && ! grep -q -- '--job 1 ' "$STUB_DIR/calls"; then ok "--job filter reads only the matching job's log"; else bad "--job filter read the wrong logs"; fi

printf '\n── ci-capture: %d pass / %d fail ──\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
exit 0
