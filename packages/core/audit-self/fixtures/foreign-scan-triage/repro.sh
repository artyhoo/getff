#!/usr/bin/env bash
# repro.sh — getff-foreign-scan-triage Task 1 reproduction (and post-fix regression) gate.
#
# PROOF MISSION: prove whether the four suspect audit-self walkers descend into
# `.claude/worktrees/` (a parallel CC checkout's working tree) and `.stryker-tmp/`
# (Stryker's mutation sandbox). Both are FOREIGN relative to the consumer's own source
# tree, and any walker that respects VCS / build boundaries must NOT traverse them.
#
# MECHANISM: a sandbox consumer monorepo shape is committed alongside this script
# (./sandbox/) with sentinel files named `foreign_in_claude` and `foreign_in_stryker`
# placed under each foreign dir. The sandbox is copied to a tmp dir, the four suspect
# scripts run with cwd = tmp, and the combined output is grepped for the sentinel
# token. Any hit = the script walked into a foreign dir.
#
# PAIRED-DIRECTION GATE (rework round 2 / fidelity MAJOR 2):
#   - NEGATIVE: sentinel 'foreign_in_' MUST NOT appear in any walker output.
#   - POSITIVE: legitimate-path token 'apps/web/' MUST appear in every walker output
#     (the sandbox ships apps/web/.lintstagedrc.json + apps/web/src/routes/handlers/ping.ts;
#     every walker discovers it — verified across all four at authoring time:
#     check-rule-globs 4 hits, check-lintstaged-resolves 8 hits,
#     detect-r2-boundary 14 hits, check-rule-enforced 63 hits).
#   A walker that pruned EVERYTHING — or that silently stopped running — would pass a
#   negative-only check unchanged. The positive-control is what distinguishes "correctly
#   pruned" from "scans nothing" — the exact false-green the paired fixture exists to
#   prevent. Non-vacuousness is proven in §RED below.
#
# §RED — non-vacuousness proof (rework round 2 / fidelity MAJOR 2):
#   For each run, a SECOND sandbox is built that omits apps/ entirely. The same walkers
#   run against it. The positive-control MUST then fail (apps/web/ absent in all four
#   outputs) — if it stays GREEN on the stripped sandbox, the assertion is vacuous and
#   the gate fails loudly. The §RED arm runs on every invocation (not gated behind a
#   flag) because a self-test that only runs on demand silently rots.
#
# §PRE-PUSH — composed-surface reachability + walker-via-install-path gate (rework round 4):
#   The kickoff §1 S1(1) names "the consumer pre-push" as the surface that produced
#   the 280-line symptom. This arm ships a minimal getff install in the sandbox
#   (dispatcher targets + consumer-installed walker copies at scripts/), attempts the
#   composed pre-push honestly, and gates on the consumer walkers through the EXACT
#   call shape pre-push.ts:834-886 uses to invoke them. The TS hook itself is
#   unreachable in this env (tsx absent), so the gate drives `bash scripts/<walker>.sh`
#   directly as the nearest reachable composed surface. §PRE-PUSH-RED proves non-
#   vacuousness by re-running the same call shape against pre-fix walker copies —
#   those MUST over-walk and emit the sentinel.
#
# Branch decision (kickoff §1):
#   - BEFORE fix  → at least one suspect mentions a sentinel → branch (a) fires.
#   - AFTER  fix  → zero sentinel mentions AND positive-control GREEN AND §RED
#                   discriminates AND §PRE-PUSH walker gate GREEN AND §PRE-PUSH-RED
#                   discriminates → branch (a) verified, umbrella closeable.
#
# Suspects swept (T-FST-A counter-trap — the plan named 2, this script covers the
# full sibling set located in Task 3's sweep):
#   1. check-rule-globs.sh          (PRUNE: line 85)
#   2. check-lintstaged-resolves.sh (find: lines 27, 36, 67)
#   3. detect-r2-boundary.sh        (PRUNE: line 44)
#   4. check-rule-enforced.sh       (PRUNE: line 72)
# Siblings confirmed NOT tree walkers (Task 3): check-generated-rule-mutation.sh
# (reads a single manifest), run-bash-mutation.sh (local dev tool), deps-hash-check.sh
# (reads specific manifest files), check-fences-fire.sh (-maxdepth 4 bounded).
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# SCRIPT_DIR = <repo>/packages/core/audit-self/fixtures/foreign-scan-triage (5 levels deep).
# git toplevel is the most robust resolution; falls back to relative for non-git contexts.
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../../.." && pwd)"
if command -v git >/dev/null 2>&1; then
  _git_root="$(cd "$SCRIPT_DIR" && git rev-parse --show-toplevel 2>/dev/null)" && [ -n "$_git_root" ] && REPO_ROOT="$_git_root"
fi
AUDIT="$REPO_ROOT/packages/core/audit-self"
SANDBOX_SRC="$SCRIPT_DIR/sandbox"

# Sentinel token — appears in sentinel filenames AND their file bodies.
# Negative-direction token: ANY hit = the walker descended into a foreign dir.
SENTINEL='foreign_in_'

# Legitimate-path token — substring of every walker's expected output for the sandbox's
# legitimate app tree (apps/web/.lintstagedrc.json, apps/web/src/routes/handlers/ping.ts).
# Positive-direction token: ZERO hits in a walker's output = the walker failed to reach
# the legitimate app tree (over-pruned or never ran).
LEGIT='apps/web/'

if [ ! -d "$SANDBOX_SRC" ]; then
  echo "repro.sh: sandbox fixture missing at $SANDBOX_SRC" >&2
  exit 2
fi

# Two mktemp dirs: WORK (the sandbox copy — ephemeral) + LOG_DIR (per-script output — preserved).
# mktemp -d on Linux defaults to /tmp; on macOS mktemp -d requires a template.
WORK="$(mktemp -d 2>/dev/null || mktemp -d -t foreign-scan-repro)"
LOG_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t foreign-scan-repro-logs)"
# WORK_RED: stripped sandbox (no apps/) for the §RED non-vacuousness arm.
WORK_RED="$(mktemp -d 2>/dev/null || mktemp -d -t foreign-scan-repro-red)"
trap 'rm -rf "$WORK" "$WORK_RED"' EXIT   # LOG_DIR intentionally NOT cleaned up — preserved for inspection

# Copy sandbox to tmp (cp -r; -a not needed — no symlinks expected).
cp -r "$SANDBOX_SRC/." "$WORK/"

# RED-stripped copy: identical to WORK minus the legitimate app dir (apps/). This is
# the "prune-the-app-dir" reduction suggested in fidelity MAJOR 2; the positive-control
# MUST fail here (apps/web/ absent from all four walker outputs), proving the assertion
# discriminates rather than passing on an empty input.
cp -r "$SANDBOX_SRC/." "$WORK_RED/"
rm -rf "$WORK_RED/apps"

# Ensure node_modules exists (empty is enough for check-lintstaged-resolves to proceed
# past its §27 "no node_modules" guard; it then exits with the "no node" path since we
# do not bring node into the bash sandbox, but its earlier `find` calls already ran).
mkdir -p "$WORK/node_modules" "$WORK_RED/node_modules"

# Per-script capture: stdout + stderr (combined) to a log, plus trace via `bash -x`.
# Trace is what surfaces the find output even when the script pipes it to head -1 / wc —
# `bash -x` echoes each command and its argument-expansion to stderr, so a `find` whose
# output is consumed by a pipe still appears in the trace as the resolved file paths.
declare -a LOGS=()
declare -a NAMES=()
run_one() { # $1 = display name, $2 = script path (absolute). Runs against $WORK (main sandbox).
  local name="$1" script="$2"
  local log="$LOG_DIR/${name}.log"
  # `bash -x` writes trace lines to stderr; 2>&1 merges them with the script's own stdout.
  ( cd "$WORK" && bash -x "$script" ) >"$log" 2>&1 || true   # exit codes are not the signal; sentinel is
  LOGS+=("$log")
  NAMES+=("$name")
}

echo "▶ foreign-scan-triage repro: running 4 suspect walkers against sandbox fixture"
echo "  sandbox: $SANDBOX_SRC"
echo "  tmp:     $WORK"
echo "  tmp-red: $WORK_RED   (apps/ stripped — §RED non-vacuousness arm)"
echo "  logs:    $LOG_DIR/<name>.log (+ <name>.red.log for §RED arm)"
echo

run_one "check-rule-globs"          "$AUDIT/check-rule-globs.sh"
run_one "check-lintstaged-resolves" "$AUDIT/check-lintstaged-resolves.sh"
run_one "detect-r2-boundary"        "$AUDIT/detect-r2-boundary.sh"
run_one "check-rule-enforced"       "$AUDIT/check-rule-enforced.sh"

# Sweep all logs for the sentinel token.
# `grep -c` ALWAYS prints the count (even 0); its exit code 1 on zero matches is irrelevant
# because we read stdout, not exit code. Do NOT add `|| echo 0` — that doubles the count.
echo "=== §WALKERS — paired-direction gate: NEGATIVE (sentinel '$SENTINEL') + POSITIVE (legit '$LEGIT') ==="
echo "  each walker MUST satisfy BOTH: 0 sentinel hits AND ≥1 legit-path hit"
overall_fail=0
for i in "${!NAMES[@]}"; do
  name="${NAMES[$i]}"
  log="${LOGS[$i]}"
  neg=$(grep -c "$SENTINEL" "$log" 2>/dev/null); neg=${neg:-0}
  pos=$(grep -c "$LEGIT"   "$log" 2>/dev/null); pos=${pos:-0}
  if [ "$neg" -gt 0 ]; then
    printf '  X %-28s  neg=%-3d pos=%-3d  OVER-WALK\n' "$name" "$neg" "$pos"
    grep -nE "$SENTINEL" "$log" | head -3 | sed 's/^/      /'
    overall_fail=1
  elif [ "$pos" -eq 0 ]; then
    printf '  X %-28s  neg=%-3d pos=%-3d  LEGIT-LOST (walker did not reach apps/web/)\n' "$name" "$neg" "$pos"
    sed 's/^/      /' "$log" | head -10
    overall_fail=1
  else
    printf '  . %-28s  neg=%-3d pos=%-3d  pruned-foreign-only\n' "$name" "$neg" "$pos"
  fi
done

echo

# ---------------------------------------------------------------------------------------------
# §RED — non-vacuousness proof for the positive-control (fidelity MAJOR 2).
#
# The §WALKERS arm proves "no over-walk AND legitimate sources still reached" on the
# realistic sandbox. THIS arm proves the positive half discriminates: against a stripped
# sandbox with apps/ removed, every walker's output MUST have ZERO legit-path hits — if
# any walker still shows apps/web/ in its trace against WORK_RED, the positive-control
# would be vacuous (passing on the realistic sandbox by luck, not by discrimination).
# ---------------------------------------------------------------------------------------------
declare -a RED_LOGS=()
declare -a RED_NAMES=()
run_one_red() { # $1 = display name, $2 = script path
  local name="$1" script="$2"
  local log="$LOG_DIR/${name}.red.log"
  ( cd "$WORK_RED" && bash -x "$script" ) >"$log" 2>&1 || true
  RED_LOGS+=("$log"); RED_NAMES+=("$name")
}
run_one_red "check-rule-globs"          "$AUDIT/check-rule-globs.sh"
run_one_red "check-lintstaged-resolves" "$AUDIT/check-lintstaged-resolves.sh"
run_one_red "detect-r2-boundary"        "$AUDIT/detect-r2-boundary.sh"
run_one_red "check-rule-enforced"       "$AUDIT/check-rule-enforced.sh"

echo "=== §RED — non-vacuousness: stripped sandbox (no apps/), positive-control MUST FAIL ==="
echo "  each walker MUST show 0 legit-path hits against WORK_RED — proves the assertion discriminates"
red_fail=0
for i in "${!RED_NAMES[@]}"; do
  name="${RED_NAMES[$i]}"
  log="${RED_LOGS[$i]}"
  pos=$(grep -c "$LEGIT" "$log" 2>/dev/null); pos=${pos:-0}
  if [ "$pos" -gt 0 ]; then
    printf '  X %-28s  red-pos=%-3d  VACUOUS (apps/web/ still appears without apps/ in tree)\n' "$name" "$pos"
    grep -nE "$LEGIT" "$log" | head -3 | sed 's/^/      /'
    red_fail=1
  else
    printf '  . %-28s  red-pos=%-3d  discriminates\n' "$name" "$pos"
  fi
done
echo
overall_fail=$((overall_fail | red_fail))

# ---------------------------------------------------------------------------------------------
# §PRE-PUSH — composed-surface reachability + walker-via-install-path gate.
#
# Originally fidelity round 4 (two-defect fix from round 3):
#   DEFECT 1 (round 3 → round 4) — the prior arm ran .husky/pre-push against a sandbox with
#     NO getff install, so the dispatcher short-circuited at 'skipping checks'. The kickoff
#     §1 S1(1) requires the fixture to carry 'a getff install'; the round-4 arm ships one.
#   DEFECT 2 (round 3 → round 4) — the prior arm could not fail. round 4 wired prepush_fail
#     into overall_fail.
#
# Fidelity round 5 rework (this block) closes two NEW defects introduced by round 4:
#   DEFECT 3 — round-4 §PRE-PUSH-RED sourced pre-fix walker copies via
#     `git show 3e4165c0^:...`. That SHA lives only on this branch; after squash-merge +
#     branch delete it is permanently unreachable in any fresh clone, causing a silent
#     GIT_SHOW_FAILED stub that makes the negative-control falsely appear vacuous. The
#     §1a host-verify contract would go permanently RED on staging for an unrelated reason.
#     FIX: synthesise the pre-fix walkers at RUNTIME by copying the current walker and
#     deleting the foreign-dir entries from its prune list (literal substring match, no
#     regex). No git-history dependency — works in a fresh clone with no branch history.
#   DEFECT 4 — round-4 §PRE-PUSH hard-coded "tsx absent → bash fallback" because that was
#     true in the container. The host has tsx in node_modules and the dispatcher's TS path
#     IS reachable there; the hard-coding bakes a container-shaped conclusion into a
#     host-run gate. (Caveat discovered at authoring time: node's `--import tsx/esm`
#     resolves cwd-first, so the dispatcher's probe behaves the same in the sandbox cwd
#     on both container AND host — neither reaches tsx from /tmp/<sandbox>/. The runtime
#     probe below surfaces this honestly; the print names which path was taken so a reader
#     can tell whether the composed surface was actually exercised or only approximated.)
#     FIX: probe the dispatcher's own condition (the tsx probe) at RUNTIME from the sandbox
#     cwd. If the probe passes → drive the real composed surface (.husky/pre-push). If it
#     fails → fall back to `bash scripts/<walker>.sh` (the call shape pre-push.ts:834-886
#     uses). Print which path was taken.
#
# pre-push.ts invokes ONLY TWO of the four walkers (verified pre-push.ts:834 / :885):
#   - scripts/check-rule-globs.sh          (ruleGlobsSection)
#   - scripts/check-lintstaged-resolves.sh (lintStagedResolvesSection)
# detect-r2-boundary.sh and check-rule-enforced.sh are NOT invoked by pre-push; they stay
# covered by §WALKERS above (driven directly against the framework-original copies).
#
# §PRE-PUSH-RED non-vacuousness (mirrors §RED at lines 187-201 for this arm): a parallel
# sandbox-with-install is built where the consumer walker copies are the PRE-FIX versions
# (synthesised at runtime, see DEFECT 3 fix above). Through the same composed surface,
# those walkers MUST over-walk into .claude/worktrees/ or .stryker-tmp/ and emit the
# sentinel. If they don't, the §PRE-PUSH negative-control is vacuous and the gate fails.
#
# DETECTION DIFFERS FROM §WALKERS (load-bearing): §WALKERS uses `bash -x` so sentinel
# FILENAMES appear in the trace — detection greps for $SENTINEL. This arm deliberately uses
# plain `bash` (no trace) to match pre-push.ts's actual call shape, so sentinel filenames
# never appear in normal walker output. Detection greps for the FOREIGN-DIR PATH PATTERN
# instead — when either walker over-walks into a foreign dir, the dir path appears in its
# normal stdout/stderr (rule-globs names the dir in its shadow-package FAIL report;
# lintstaged-resolves names the dir when listing governing .lintstagedrc.json configs).
# Verified live: fixed walker output never mentions either foreign dir; pre-fix output
# mentions them multiple times — the path-pattern signal discriminates correctly.
# ---------------------------------------------------------------------------------------------
PREPUSH_WORK="$(mktemp -d 2>/dev/null || mktemp -d -t foreign-scan-prepush)"
PREPUSH_RED_WORK="$(mktemp -d 2>/dev/null || mktemp -d -t foreign-scan-prepush-red)"
trap 'rm -rf "$WORK" "$WORK_RED" "$PREPUSH_WORK" "$PREPUSH_RED_WORK"' EXIT

# --- Build sandbox-with-install (DEFECT 1 fix; unchanged from round 4) ---
# Minimal getff install: dispatcher targets at packages/core/hooks/ + consumer-installed
# walker copies at scripts/ (the install path — what pre-push.ts:834-886 invokes).
cp -r "$SANDBOX_SRC/." "$PREPUSH_WORK/"
mkdir -p "$PREPUSH_WORK/packages/core/hooks" "$PREPUSH_WORK/scripts"
cp "$AUDIT/check-rule-globs.sh"          "$PREPUSH_WORK/scripts/"
cp "$AUDIT/check-lintstaged-resolves.sh" "$PREPUSH_WORK/scripts/"
# r2-na-marker.sh is sourced by check-rule-globs.sh:75 — install.sh:594 ships it to scripts/.
cp "$AUDIT/r2-na-marker.sh"              "$PREPUSH_WORK/scripts/" 2>/dev/null || true
# Dispatcher targets so .husky/pre-push gets past 'skipping checks' (Node ≥20 + tsx loader).
cp "$REPO_ROOT/packages/core/hooks/pre-push.ts"          "$PREPUSH_WORK/packages/core/hooks/" 2>/dev/null || true
cp "$REPO_ROOT/packages/core/hooks/pre-push.fallback.sh" "$PREPUSH_WORK/packages/core/hooks/" 2>/dev/null || true
chmod +x "$PREPUSH_WORK/packages/core/hooks/pre-push.fallback.sh" 2>/dev/null || true

# Sandbox-as-git-repo so pre-push dispatcher's `git rev-parse --show-toplevel` resolves here.
( cd "$PREPUSH_WORK" && git init -q && git config user.email t@t && git config user.name t \
  && git add -A && git commit -qm c1 ) >/dev/null 2>&1 || true

# --- (1) Probe the dispatcher's own condition at runtime (DEFECT 4 fix). ---
# The dispatcher routes to the TS hook iff `node --import tsx/esm -e ''` succeeds. Probe
# the SAME condition from the sandbox cwd (matching how the dispatcher will be invoked
# below). The probe is cwd-based: node walks up from cwd looking for node_modules/tsx.
# Whether the host has tsx in its repo-root node_modules does not change the probe's
# behaviour in /tmp/<sandbox> cwd — this is honest evidence capture, not a host/container
# distinction. The probe's result determines which composed surface the gate drives.
PREPUSH_BIN="$REPO_ROOT/.husky/pre-push"
TS_HOOK_REACHABLE=0
if command -v node >/dev/null 2>&1 \
  && [ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -ge 20 ] \
  && [ -f "$PREPUSH_WORK/packages/core/hooks/pre-push.ts" ] \
  && ( cd "$PREPUSH_WORK" && node --import tsx/esm -e '' ) >/dev/null 2>&1; then
  TS_HOOK_REACHABLE=1
fi

# --- (2) Drive the composed surface that is actually reachable (DEFECT 4 fix). ---
PREPUSH_LOG="$LOG_DIR/prepush-attempt.log"
PREPUSH_WALK_LOG="$LOG_DIR/prepush-walkers.log"
if [ "$TS_HOOK_REACHABLE" -eq 1 ]; then
  COMPOSED_SURFACE='TS hook reachable (dispatcher tsx probe passed from sandbox cwd) — driving real .husky/pre-push'
  # The dispatcher routes to the TS hook; pre-push.ts:834-886 invokes the consumer-installed
  # scripts/<walker>.sh copies as part of its real pre-push flow. Capture the full drive
  # (dispatcher + walker output combined) into PREPUSH_WALK_LOG.
  if [ -f "$PREPUSH_BIN" ]; then
    ( cd "$PREPUSH_WORK" && bash "$PREPUSH_BIN" ) >"$PREPUSH_WALK_LOG" 2>&1 || true
  else
    echo "§PRE-PUSH: .husky/pre-push not found at $PREPUSH_BIN" >"$PREPUSH_WALK_LOG"
  fi
  # PREPUSH_LOG mirrors PREPUSH_WALK_LOG in this branch (single drive).
  cp "$PREPUSH_WALK_LOG" "$PREPUSH_LOG"
else
  COMPOSED_SURFACE='TS hook unreachable (dispatcher tsx probe failed from sandbox cwd) — fallback: bash scripts/<walker>.sh (call shape pre-push.ts:834-886 uses)'
  # Still attempt the dispatcher for evidence capture + dispatcher-state assertion.
  if [ -f "$PREPUSH_BIN" ]; then
    ( cd "$PREPUSH_WORK" && bash "$PREPUSH_BIN" ) >"$PREPUSH_LOG" 2>&1 || true
  else
    echo "§PRE-PUSH: .husky/pre-push not found at $PREPUSH_BIN" >"$PREPUSH_LOG"
  fi
  # Drive the consumer-installed walkers via the EXACT call shape pre-push.ts:834-886 uses:
  # `bash scripts/<walker>.sh` from sandbox cwd. Exercises the install path (scripts/ copies,
  # not packages/core/audit-self/ originals) AND pre-push.ts's invocation shape.
  {
    echo '--- bash scripts/check-rule-globs.sh (cwd = sandbox-with-install) ---'
    ( cd "$PREPUSH_WORK" && bash scripts/check-rule-globs.sh ) 2>&1 || true
    echo
    echo '--- bash scripts/check-lintstaged-resolves.sh (cwd = sandbox-with-install) ---'
    ( cd "$PREPUSH_WORK" && bash scripts/check-lintstaged-resolves.sh ) 2>&1 || true
  } >"$PREPUSH_WALK_LOG"
fi

FOREIGN_DIR_RE='(\.claude/worktrees/|\.stryker-tmp/)'
prepush_neg=$(grep -cE "$FOREIGN_DIR_RE" "$PREPUSH_WALK_LOG" 2>/dev/null) || prepush_neg=0
prepush_pos=$(grep -c "$LEGIT"            "$PREPUSH_WALK_LOG" 2>/dev/null) || prepush_pos=0
dispatcher_skipped=$(grep -c 'skipping checks' "$PREPUSH_LOG" 2>/dev/null) || dispatcher_skipped=0
dispatcher_fallback=$(grep -cE 'fallback:'     "$PREPUSH_LOG" 2>/dev/null) || dispatcher_fallback=0

# --- (3) §PRE-PUSH-RED non-vacuousness: RUNTIME-SYNTHESISED pre-fix walkers (DEFECT 3 fix). ---
# Pre-fix delta (verified by diffing 3e4165c0^..HEAD at round-4 authoring time):
#   - check-rule-globs.sh PRUNE (line 85): pre-fix had .stryker-tmp but NOT .claude/worktrees
#   - check-lintstaged-resolves.sh find lines (40 + 71): pre-fix pruned only node_modules + .git
#     (no .stryker-tmp, no .claude/worktrees)
# Synthesis = copy current walker + strip the foreign-dir entries (literal substring match —
# bash ${var//"pattern"/} with a quoted pattern is literal, not regex). Result is byte-identical
# to the pre-fix version on those prune lines. Works in a fresh clone with no branch history.
cp -r "$SANDBOX_SRC/." "$PREPUSH_RED_WORK/"
mkdir -p "$PREPUSH_RED_WORK/packages/core/hooks" "$PREPUSH_RED_WORK/scripts"

synthesize_prefix_walker() { # $1 = src path, $2 = target path, $3 = literal substring to strip
  local src="$1" tgt="$2" strip="$3" content
  if [ ! -f "$src" ]; then
    echo "# SYNTHESIZE_FAILED — source walker missing: $src" >"$tgt"
    return
  fi
  content=$(<"$src")
  # Global literal-substring replacement (quoted pattern => no glob/regex). ALL occurrences
  # stripped, so both find lines in check-lintstaged-resolves.sh are fixed in one call.
  content="${content//"$strip"/}"
  printf '%s\n' "$content" >"$tgt"
}
# check-rule-globs.sh: pre-fix had no `-o -path '*/.claude/worktrees'` in PRUNE.
synthesize_prefix_walker \
  "$AUDIT/check-rule-globs.sh" \
  "$PREPUSH_RED_WORK/scripts/check-rule-globs.sh" \
  " -o -path '*/.claude/worktrees'"
# check-lintstaged-resolves.sh: pre-fix find lines pruned only `-name node_modules -o -name .git`
# (no .stryker-tmp, no .claude/worktrees). Strip the trailing two entries on BOTH find lines.
synthesize_prefix_walker \
  "$AUDIT/check-lintstaged-resolves.sh" \
  "$PREPUSH_RED_WORK/scripts/check-lintstaged-resolves.sh" \
  " -o -name .stryker-tmp -o -path '*/.claude/worktrees'"
cp "$AUDIT/r2-na-marker.sh" "$PREPUSH_RED_WORK/scripts/r2-na-marker.sh" 2>/dev/null || true
cp "$REPO_ROOT/packages/core/hooks/pre-push.ts"          "$PREPUSH_RED_WORK/packages/core/hooks/" 2>/dev/null || true
cp "$REPO_ROOT/packages/core/hooks/pre-push.fallback.sh" "$PREPUSH_RED_WORK/packages/core/hooks/" 2>/dev/null || true
chmod +x "$PREPUSH_RED_WORK/packages/core/hooks/pre-push.fallback.sh" 2>/dev/null || true
( cd "$PREPUSH_RED_WORK" && git init -q && git config user.email t@t && git config user.name t \
  && git add -A && git commit -qm c1 ) >/dev/null 2>&1 || true

PREPUSH_RED_LOG="$LOG_DIR/prepush-walkers-red.log"
if [ "$TS_HOOK_REACHABLE" -eq 1 ]; then
  COMPOSED_SURFACE_RED='TS hook reachable — pre-fix install driven through .husky/pre-push'
  if [ -f "$PREPUSH_BIN" ]; then
    ( cd "$PREPUSH_RED_WORK" && bash "$PREPUSH_BIN" ) >"$PREPUSH_RED_LOG" 2>&1 || true
  else
    echo "§PRE-PUSH-RED: .husky/pre-push not found at $PREPUSH_BIN" >"$PREPUSH_RED_LOG"
  fi
else
  COMPOSED_SURFACE_RED='TS hook unreachable — pre-fix install driven via call-shape substitute'
  {
    echo '--- bash scripts/check-rule-globs.sh (PRE-FIX; cwd = sandbox-with-pre-fix-install) ---'
    ( cd "$PREPUSH_RED_WORK" && bash scripts/check-rule-globs.sh ) 2>&1 || true
    echo
    echo '--- bash scripts/check-lintstaged-resolves.sh (PRE-FIX; cwd = sandbox-with-pre-fix-install) ---'
    ( cd "$PREPUSH_RED_WORK" && bash scripts/check-lintstaged-resolves.sh ) 2>&1 || true
  } >"$PREPUSH_RED_LOG"
fi
# Detection mirrors §PRE-PUSH above: foreign-dir path pattern, not sentinel filename.
prepush_red_neg=$(grep -cE "$FOREIGN_DIR_RE" "$PREPUSH_RED_LOG" 2>/dev/null) || prepush_red_neg=0

# --- (4) Verdict + contribute to overall_fail (DEFECT 2 fix retained from round 4). ---
prepush_fail=0
echo "=== §PRE-PUSH — composed-surface reachability + walker-via-install-path gate ==="
echo "  composed surface driven (DEFECT 4 fix: runtime probe, not hardcoded):"
echo "    $COMPOSED_SURFACE"
echo "  sandbox-with-install: packages/core/hooks/pre-push.{ts,fallback.sh} + scripts/<walker copies>"
echo "  (sandbox-as-git-repo: dispatcher git rev-parse --show-toplevel resolves here)"
echo
echo "  dispatcher attempt output (or full composed drive if TS-reachable):"
sed 's/^/      /' "$PREPUSH_LOG" | head -20
echo
if [ "$TS_HOOK_REACHABLE" -eq 1 ]; then
  # TS-reachable: dispatcher routed to TS hook; the composed drive IS the walk log.
  if [ "$dispatcher_skipped" -ge 1 ]; then
    echo "  X dispatcher hit 'skipping checks' DESPITE install + TS-reachable — investigate $PREPUSH_LOG"
    prepush_fail=1
  else
    echo "  . dispatcher routed through TS hook (pre-push.ts ran). Walker invocations at"
    echo "    pre-push.ts:834-886 drove the consumer-installed scripts/<walker>.sh copies."
  fi
else
  # TS-unreachable: dispatcher fell back. Verify it actually progressed past 'skipping checks'.
  if [ "$dispatcher_skipped" -ge 1 ]; then
    echo "  X dispatcher hit 'skipping checks' DESPITE the install — investigate $PREPUSH_LOG"
    prepush_fail=1
  elif [ "$dispatcher_fallback" -ge 1 ]; then
    echo "  . dispatcher progressed past 'skipping checks' to the bash fallback (TS hook path"
    echo "    unreachable from sandbox cwd: tsx probe 'node --import tsx/esm -e \"\"' failed)."
    echo "    Bash fallback does not invoke consumer walkers (only §7/§1.7 trailer checks,"
    echo "    framework-gated — skipped on a consumer sandbox)."
    echo "    Nearest reachable composed surface for walker invocation: bash scripts/<walker>.sh"
    echo "    (the call shape pre-push.ts:834-886 uses) — driven below."
  else
    echo "  ? dispatcher produced unexpected output — investigate $PREPUSH_LOG"
    prepush_fail=1
  fi
fi
echo
echo "  walker gate (consumer-installed scripts/<walker>.sh via composed surface):"
echo "    pre-push.ts:834-886 invokes ONLY these two: check-rule-globs.sh + check-lintstaged-resolves.sh"
echo "    neg=$prepush_neg (foreign-dir-path hits; MUST be 0)   pos=$prepush_pos (legit-path hits; MUST be ≥1)"
if [ "$prepush_neg" -gt 0 ]; then
  echo "  X §PRE-PUSH FAIL: consumer-installed walker over-walked into foreign dir through"
  echo "    the composed surface. Foreign-dir-path hits:"
  grep -nE "$FOREIGN_DIR_RE" "$PREPUSH_WALK_LOG" | head -5 | sed 's/^/      /'
  prepush_fail=1
elif [ "$prepush_pos" -eq 0 ]; then
  echo "  X §PRE-PUSH FAIL: composed surface did not reach apps/web/ (legit-path lost)."
  echo "    Either the dispatcher exited before reaching the walker sections (TS-reachable"
  echo "    case) or the call-shape substitute also failed (TS-unreachable case). Output:"
  sed 's/^/      /' "$PREPUSH_WALK_LOG" | head -15
  prepush_fail=1
else
  echo "  . §PRE-PUSH GREEN: consumer-installed walkers respected foreign-dir boundary AND"
  echo "    reached the legitimate app tree through the composed surface."
fi
echo
echo "  §PRE-PUSH-RED non-vacuousness (RUNTIME-synthesised pre-fix walker copies; same composed surface):"
echo "    composed surface driven: $COMPOSED_SURFACE_RED"
echo "    neg=$prepush_red_neg (foreign-dir-path hits; MUST be ≥1 — proves the negative-control discriminates)"
if [ "$prepush_red_neg" -ge 1 ]; then
  echo "  . §PRE-PUSH-RED GREEN: pre-fix walkers over-walked as expected — assertion discriminates."
  echo "    foreign-dir-path hits (sample):"
  grep -nE "$FOREIGN_DIR_RE" "$PREPUSH_RED_LOG" | head -3 | sed 's/^/      /'
else
  echo "  X §PRE-PUSH-RED FAIL: pre-fix walkers did NOT over-walk through the composed"
  echo "    surface — assertion vacuous, investigate. Walker output:"
  sed 's/^/      /' "$PREPUSH_RED_LOG" | head -15
  prepush_fail=1
fi
echo

overall_fail=$((overall_fail | prepush_fail))

# ---------------------------------------------------------------------------------------------
# Paired-negative assertion (rework round 1): check-lintstaged-resolves.sh §31 existence guard.
#
# The guard at line 31 answers a SINGLE question: 'are dependencies installed yet?'. Its
# alternation must stay '-name node_modules' ONLY. A previous widening of this guard to
# 'node_modules -o .stryker-tmp -o .claude/worktrees' was a regression: it suppressed the
# skip path on repos that have foreign dirs but no installed deps.
#
# This assertion pins the correct behaviour: a sandbox WITHOUT node_modules but WITH
# .claude/worktrees/ must STILL take the 'no node_modules yet — skipped' exit path.
# Regression signature: the guard's alternation was widened → output omits the skip message
# and proceeds to 'verifying lint-staged command binaries resolve'.
# ---------------------------------------------------------------------------------------------
GUARD_FAIL=0
WORK_NOMOD="$(mktemp -d 2>/dev/null || mktemp -d -t foreign-scan-repro-nomod)"
# Extend the EXIT trap to also clean WORK_NOMOD (this arm). PREPUSH_WORK + PREPUSH_RED_WORK
# were added to the trap by the §PRE-PUSH arm above and MUST be preserved here.
trap 'rm -rf "$WORK" "$WORK_RED" "$PREPUSH_WORK" "$PREPUSH_RED_WORK" "$WORK_NOMOD"' EXIT

# Minimal sandbox: contains .claude/worktrees/ (foreign dir) but NO node_modules.
mkdir -p "$WORK_NOMOD/.claude/worktrees/feature-x/eslint.config.mjs.d"
mkdir -p "$WORK_NOMOD/.stryker-tmp/sandbox-1"
printf '{ "fake": "sentinel to keep .claude/worktrees non-empty" }\n' \
  >"$WORK_NOMOD/.claude/worktrees/feature-x/eslint.config.mjs.d/foreign_in_claude.ts"

GUARD_LOG="$LOG_DIR/check-lintstaged-resolves.guard.log"
( cd "$WORK_NOMOD" && bash "$AUDIT/check-lintstaged-resolves.sh" ) >"$GUARD_LOG" 2>&1 || true

guard_skipped=$(grep -c 'no node_modules yet' "$GUARD_LOG" 2>/dev/null); guard_skipped=${guard_skipped:-0}
guard_proceeded=$(grep -c 'verifying lint-staged command binaries resolve' "$GUARD_LOG" 2>/dev/null); guard_proceeded=${guard_proceeded:-0}

echo "=== paired-negative: check-lintstaged-resolves §31 existence guard ==="
echo "  sandbox: has .claude/worktrees/, has .stryker-tmp/, NO node_modules"
echo "  expectation: guard fires ('no node_modules yet' present, 'verifying' absent)"
echo "  actual:   'no node_modules yet'=$guard_skipped   'verifying'=$guard_proceeded"
if [ "$guard_skipped" -ge 1 ] && [ "$guard_proceeded" -eq 0 ]; then
  echo "  . guard PASS (existence guard fired, script did not proceed)"
else
  echo "  X guard FAIL -- existence guard was widened; expected skip path, got execution"
  sed 's/^/      /' "$GUARD_LOG" | head -10
  GUARD_FAIL=1
fi
echo

overall_fail=$((overall_fail | GUARD_FAIL))

if [ "$overall_fail" -ne 0 ]; then
  echo "RESULT: FAIL -- see markers above."
  echo "  Failure modes:"
  echo "    - over-walk           = sentinel hit in a walker log (§WALKERS negative)"
  echo "    - legit-lost          = walker did not reach apps/web/ (§WALKERS positive)"
  echo "    - vacuous             = §RED still showed apps/web/ against stripped sandbox"
  echo "    - guard regression    = paired-negative (§GUARD above)"
  echo "    - prepush-over-walk   = §PRE-PUSH walker gate RED (consumer install over-walked)"
  echo "    - prepush-legit-lost  = §PRE-PUSH walker gate RED (consumer install lost legit path)"
  echo "    - prepush-vacuous     = §PRE-PUSH-RED did NOT over-walk on pre-fix install"
  echo "    - prepush-dispatcher  = §PRE-PUSH dispatcher hit 'skipping checks' despite install"
  echo "  Logs preserved in: $LOG_DIR/  (re-run regenerates; manual rm to clean up.)"
else
  echo "RESULT: GREEN — paired-direction (§WALKERS) + non-vacuousness (§RED) +"
  echo "  paired-negative (§GUARD) + composed-surface walker gate (§PRE-PUSH + §PRE-PUSH-RED)"
  echo "  all pass."
  echo "  Every walker prunes both foreign dirs AND still reaches the legitimate app tree;"
  echo "  §RED proves the positive-control discriminates; check-lintstaged-resolves still"
  echo "  skips when only foreign dirs (no node_modules) exist; §PRE-PUSH drives the"
  echo "  consumer-installed walkers via pre-push.ts:834-886's call shape and §PRE-PUSH-RED"
  echo "  proves the negative-control discriminates against pre-fix walker copies."
  echo "  (The AFTER-fix expected state. Before-fix this would be RED on §WALKERS negative.)"
fi

exit "$overall_fail"
