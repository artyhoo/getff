#!/usr/bin/env bash
# Paired-negative for scripts/close-merged-sweep.sh — the scheduled aif close-on-merge sweep.
#
# Hermetic: the "clone" is a throw-away git repo whose `origin` is a mktemp bare repo, and the
# log, cache, install dir, LaunchAgents dir, tsx, curl and launchctl are all mktemp stubs or
# seams — no real aif API, GitHub, launchd or $HOME file is touched. The one real network call
# is the aif-down arm, which probes 127.0.0.1:1 (nothing listens there) with the real curl, so
# the probe the operator's Mac runs is exercised, not a stand-in for it.
#
# GREEN arms prove the sweep stays quiet-but-logged where it must (aif down = skip, exit 0),
# runs harvest.ts from origin/staging (never the clone's checked-out branch) and reports a real
# close; RED arms prove each misconfiguration is loud (non-zero exit AND a log line naming the
# defect), because under launchd nobody watches stdout.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
SWEEP="$DIR/close-merged-sweep.sh"

TMP="$(mktemp -d "${TMPDIR:-/tmp}/close-merged-sweep-test.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT
LOG="$TMP/sweep.log"
CACHE="$TMP/cache"
fails=0

fail() { echo "FAIL: $1"; [ -f "$LOG" ] && sed 's/^/    log| /' "$LOG"; fails=$((fails + 1)); }

# ── The throw-away origin (staging carries --close-merged) + the operator's clone ────────────
g() { git -c user.name=t -c user.email=t@t -c init.defaultBranch=main "$@"; }
SEED="$TMP/seed"
g init -q "$SEED"
mkdir -p "$SEED/packages/runtime-bridge/src/cli"
echo '{"type":"module"}' >"$SEED/packages/runtime-bridge/package.json"
echo "'close-merged': { type: 'boolean' }, // v1" >"$SEED/packages/runtime-bridge/src/cli/harvest.ts"
g -C "$SEED" add -A && g -C "$SEED" commit -qm v1 && g -C "$SEED" branch -q staging
g init -q --bare "$TMP/origin.git"
g -C "$SEED" push -q "$TMP/origin.git" main staging
CLONE="$TMP/clone"
g clone -q "$TMP/origin.git" "$CLONE"
# The clone's CHECKED-OUT branch lacks the mode — exactly the 2026-09-28 state of the real clone.
g -C "$CLONE" checkout -q -b some-feature
echo "// old harvest, no sweep mode" >"$CLONE/packages/runtime-bridge/src/cli/harvest.ts"
g -C "$CLONE" commit -qam old

# Stub curl: `/health` answers per $STUB_HEALTH (ok|down).
cat >"$TMP/curl" <<'EOF'
#!/usr/bin/env bash
[ "${STUB_HEALTH:-ok}" = ok ] && exit 0
exit 7
EOF
# Stub tsx: records its argv and the harvest.ts it was handed, prints $STUB_OUT, exits $STUB_RC.
cat >"$TMP/tsx" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >"$STUB_ARGV"
cat "$1" >"$STUB_ARGV.src"
printf '%s\n' "${STUB_OUT:-}"
exit "${STUB_RC:-0}"
EOF
# Stub launchctl: records every call.
cat >"$TMP/launchctl" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >>"$STUB_LAUNCHCTL_LOG"
exit 0
EOF
chmod +x "$TMP/curl" "$TMP/tsx" "$TMP/launchctl"

run_sweep() {
  rm -f "$LOG" "$TMP/argv" "$TMP/argv.src"
  env CLOSE_MERGED_LOG="$LOG" CLOSE_MERGED_CACHE="$CACHE" CLOSE_MERGED_NOTIFY=0 \
    CLOSE_MERGED_REPO_ROOT="$CLONE" CLOSE_MERGED_TSX="$TMP/tsx" STUB_ARGV="$TMP/argv" \
    "$@" bash "$SWEEP" run >"$TMP/out" 2>"$TMP/err"
}

CLOSED_JSON='{"ok":true,"repo":"o/r","closeMerged":[{"taskId":"t1","status":"done","prUrl":"https://github.com/o/r/pull/1","report":{"taskId":"t1","prUrl":"https://github.com/o/r/pull/1","merged":true,"commented":true,"closedReview":false,"approved":true}},{"taskId":"t2","status":"done","prUrl":"https://github.com/o/r/pull/2","report":{"taskId":"t2","prUrl":"https://github.com/o/r/pull/2","merged":true,"commented":false,"closedReview":false,"approved":false,"alreadyClosed":true}},{"taskId":"t3","status":"review","skippedReason":"no merged PR maps to this task"},{"taskId":"t4","status":"done","prUrl":"https://github.com/o/r/pull/4","report":{"taskId":"t4","prUrl":"https://github.com/o/r/pull/4","merged":false,"commented":false,"closedReview":false,"approved":false}}]}'

# ── GREEN 1: aif up, one task closed → exit 0, counted summary, staging's harvest.ts run ─────
run_sweep RUNTIME_BRIDGE_AIF_PROJECT_ID=proj-1 CLOSE_MERGED_CURL="$TMP/curl" STUB_OUT="$CLOSED_JSON"
rc=$?
[ "$rc" -eq 0 ] || fail "closed: expected exit 0, got $rc"
grep -q 'OK closed=1 already=1 skipped=1 unmerged=1' "$LOG" || fail "closed: summary line missing or miscounted"
grep -q 't1 .*pull/1' "$LOG" || fail "closed: the closed task + PR are not named in the log"
grep -q -- '--close-merged --project proj-1' "$TMP/argv" || fail "closed: harvest.ts not called with --close-merged --project"
grep -q "^$CACHE/.*/packages/runtime-bridge/src/cli/harvest.ts" "$TMP/argv" || fail "closed: harvest.ts not run from the staging snapshot cache"
grep -q '// v1' "$TMP/argv.src" 2>/dev/null || fail "closed: ran the clone's checked-out harvest.ts instead of origin/staging's"

# ── GREEN 2: staging moves on origin → the next tick fetches and runs the NEW snapshot ────────
echo "'close-merged': { type: 'boolean' }, // v2" >"$SEED/packages/runtime-bridge/src/cli/harvest.ts"
g -C "$SEED" commit -qam v2 && g -C "$SEED" push -q "$TMP/origin.git" main:staging
run_sweep RUNTIME_BRIDGE_AIF_PROJECT_ID=proj-1 CLOSE_MERGED_REPO=o/r CLOSE_MERGED_CURL="$TMP/curl" \
  STUB_OUT='{"ok":true,"repo":"o/r","closeMerged":[]}'
grep -q '// v2' "$TMP/argv.src" 2>/dev/null || fail "fetch: did not pick up the new origin/staging"
grep -q -- '--repo o/r' "$TMP/argv" || fail "repo: --repo o/r not passed to harvest.ts"
grep -q 'OK closed=0' "$LOG" || fail "repo: empty sweep did not log OK closed=0"
[ "$(find "$CACHE" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')" -eq 1 ] || fail "cache: stale snapshots not pruned"

# ── GREEN 3: aif down (real curl, closed port) → exit 0, SKIP logged, harvest NOT called ─────
run_sweep RUNTIME_BRIDGE_AIF_PROJECT_ID=proj-1 RUNTIME_BRIDGE_AIF_URL=http://127.0.0.1:1
rc=$?
[ "$rc" -eq 0 ] || fail "aif-down: expected exit 0 (quiet skip), got $rc"
grep -q 'SKIP aif-down' "$LOG" || fail "aif-down: no SKIP aif-down line in the log"
[ -f "$TMP/argv" ] && fail "aif-down: harvest.ts ran although aif is unreachable"

# ── GREEN 4: fetch fails (origin gone) → still runs the last-fetched staging, says so ────────
mv "$TMP/origin.git" "$TMP/origin.gone"
run_sweep RUNTIME_BRIDGE_AIF_PROJECT_ID=proj-1 CLOSE_MERGED_CURL="$TMP/curl" \
  STUB_OUT='{"ok":true,"repo":"o/r","closeMerged":[]}'
rc=$?
[ "$rc" -eq 0 ] || fail "offline: expected exit 0 on the last-fetched staging, got $rc"
grep -q 'OK closed=0 .*fetch failed' "$LOG" || fail "offline: the fetch failure is not noted in the log"
mv "$TMP/origin.gone" "$TMP/origin.git"

# ── RED 1: no project id → exit 2, ERROR names the variable, no harvest ──────────────────────
run_sweep RUNTIME_BRIDGE_AIF_PROJECT_ID= CLOSE_MERGED_CURL="$TMP/curl"
rc=$?
[ "$rc" -eq 2 ] || fail "no-project: expected exit 2, got $rc"
grep -q 'ERROR .*RUNTIME_BRIDGE_AIF_PROJECT_ID' "$LOG" || fail "no-project: ERROR does not name RUNTIME_BRIDGE_AIF_PROJECT_ID"
[ -f "$TMP/argv" ] && fail "no-project: harvest.ts ran without a project id"

# ── RED 2: tsx missing → exit 2, ERROR names tsx ─────────────────────────────────────────────
run_sweep RUNTIME_BRIDGE_AIF_PROJECT_ID=proj-1 CLOSE_MERGED_CURL="$TMP/curl" CLOSE_MERGED_TSX="$TMP/no-such-tsx"
rc=$?
[ "$rc" -eq 2 ] || fail "no-tsx: expected exit 2, got $rc"
grep -q 'ERROR .*tsx' "$LOG" || fail "no-tsx: ERROR does not name tsx"

# ── RED 3: harvest fails → exit 1, FAIL carries its stderr ───────────────────────────────────
cat >"$TMP/tsx-fail" <<'EOF'
#!/usr/bin/env bash
echo '[harvest] --close-merged FAILED: aif 500' >&2
exit 1
EOF
chmod +x "$TMP/tsx-fail"
run_sweep RUNTIME_BRIDGE_AIF_PROJECT_ID=proj-1 CLOSE_MERGED_CURL="$TMP/curl" CLOSE_MERGED_TSX="$TMP/tsx-fail"
rc=$?
[ "$rc" -eq 1 ] || fail "harvest-fail: expected exit 1, got $rc"
grep -q 'FAIL harvest rc=1.*aif 500' "$LOG" || fail "harvest-fail: FAIL line lacks rc or harvest's stderr"

# ── RED 4: harvest exits 0 but prints no ok:true JSON → exit 1 (never a silent OK) ──────────
run_sweep RUNTIME_BRIDGE_AIF_PROJECT_ID=proj-1 CLOSE_MERGED_CURL="$TMP/curl" STUB_OUT='garbage'
rc=$?
[ "$rc" -eq 1 ] || fail "bad-json: expected exit 1, got $rc"
grep -q 'FAIL unparsable' "$LOG" || fail "bad-json: no FAIL unparsable line"

# ── RED 5: origin/staging lost the mode → exit 2, never runs a harvest.ts without it ─────────
echo "// regressed" >"$SEED/packages/runtime-bridge/src/cli/harvest.ts"
g -C "$SEED" commit -qam v3 && g -C "$SEED" push -q "$TMP/origin.git" main:staging
run_sweep RUNTIME_BRIDGE_AIF_PROJECT_ID=proj-1 CLOSE_MERGED_CURL="$TMP/curl"
rc=$?
[ "$rc" -eq 2 ] || fail "no-mode: expected exit 2, got $rc"
grep -q 'ERROR .*no --close-merged' "$LOG" || fail "no-mode: ERROR does not say the mode is missing"
[ -f "$TMP/argv" ] && fail "no-mode: harvest.ts ran without --close-merged"
echo "'close-merged': { type: 'boolean' }, // v4" >"$SEED/packages/runtime-bridge/src/cli/harvest.ts"
g -C "$SEED" commit -qam v4 && g -C "$SEED" push -q "$TMP/origin.git" main:staging
g -C "$CLONE" fetch -q origin staging

# ── Log rotation: a log past the cap is moved to .1 before the run appends ───────────────────
head -c 600000 /dev/zero | tr '\0' 'x' >"$LOG"
env CLOSE_MERGED_LOG="$LOG" CLOSE_MERGED_NOTIFY=0 CLOSE_MERGED_REPO_ROOT="$CLONE" CLOSE_MERGED_TSX="$TMP/tsx" \
  RUNTIME_BRIDGE_AIF_PROJECT_ID=proj-1 RUNTIME_BRIDGE_AIF_URL=http://127.0.0.1:1 bash "$SWEEP" run >/dev/null 2>&1
[ -f "$LOG.1" ] || fail "rotate: oversized log was not rotated to .1"
[ "$(wc -c <"$LOG")" -lt 10000 ] || fail "rotate: fresh log still carries the old bulk"
rm -f "$LOG" "$LOG.1"

# ── install / uninstall: copy + plist + launchctl calls, all under mktemp ────────────────────
mkdir -p "$CLONE/node_modules/.bin" && cp "$TMP/tsx" "$CLONE/node_modules/.bin/tsx"
AGENTS="$TMP/LaunchAgents"
INST="$TMP/App Support/getff"
LCLOG="$TMP/launchctl.log"
inst() {
  env CLOSE_MERGED_LAUNCH_AGENTS_DIR="$AGENTS" CLOSE_MERGED_INSTALL_DIR="$INST" \
    CLOSE_MERGED_LAUNCHCTL="$TMP/launchctl" STUB_LAUNCHCTL_LOG="$LCLOG" CLOSE_MERGED_LOG="$LOG" \
    bash "$SWEEP" "$@" >"$TMP/out" 2>"$TMP/err"
}
PLIST="$AGENTS/dev.getff.aif-close-merged.plist"

inst install --repo-root "$CLONE" --every 20
rc=$?
[ "$rc" -eq 0 ] || { fail "install: expected exit 0, got $rc"; sed 's/^/    err| /' "$TMP/err"; }
[ -f "$PLIST" ] || fail "install: plist not written"
cmp -s "$INST/close-merged-sweep.sh" "$SWEEP" || fail "install: the script was not copied out of the repo"
grep -q '<string>dev.getff.aif-close-merged</string>' "$PLIST" || fail "install: Label missing"
grep -q "<string>$INST/close-merged-sweep.sh</string>" "$PLIST" || fail "install: plist does not run the installed copy"
grep -q "<string>$CLONE</string>" "$PLIST" || fail "install: CLOSE_MERGED_REPO_ROOT not baked into the plist"
grep -q '<string>/bin/zsh</string>' "$PLIST" || fail "install: not launched through zsh (the ~/.zshenv env would be lost)"
# StartCalendarInterval, never StartInterval: an interval tick that falls in sleep is dropped,
# a calendar tick is run on wake — and a laptop sleeps through most auto-merges.
grep -q 'StartInterval<' "$PLIST" && fail "install: StartInterval drops ticks during sleep — use StartCalendarInterval"
grep -q '<key>StartCalendarInterval</key>' "$PLIST" || fail "install: no StartCalendarInterval"
[ "$(grep -c '<key>Minute</key>' "$PLIST")" -eq 3 ] || fail "install: --every 20 should yield 3 Minute entries"
grep -q '<integer>40</integer>' "$PLIST" || fail "install: --every 20 missing minute 40"
grep -q '^bootstrap gui/' "$LCLOG" || fail "install: launchctl bootstrap not called"
if command -v plutil >/dev/null 2>&1; then
  plutil -lint "$PLIST" >/dev/null || fail "install: plutil rejects the plist"
fi

if inst install --repo-root "$CLONE" --every 7; then
  fail "install-bad-every: --every 7 (not a divisor of 60) was accepted"
fi
if inst install --repo-root "$TMP/nowhere"; then
  fail "install-bad-root: a path without origin/staging was accepted"
fi
grep -q 'origin/staging' "$TMP/err" || fail "install-bad-root: error does not name origin/staging"

: >"$LCLOG"
inst uninstall
[ -f "$PLIST" ] && fail "uninstall: plist still present"
[ -f "$INST/close-merged-sweep.sh" ] && fail "uninstall: installed copy still present"
grep -q '^bootout gui/.*/dev.getff.aif-close-merged' "$LCLOG" || fail "uninstall: launchctl bootout not called"

if [ "$fails" -eq 0 ]; then
  echo "close-merged-sweep.test.sh: all arms passed"
  exit 0
fi
echo "close-merged-sweep.test.sh: $fails failure(s)"
exit 1
