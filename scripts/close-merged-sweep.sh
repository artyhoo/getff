#!/usr/bin/env bash
# close-merged-sweep.sh — scheduled trigger for closing aif tasks whose harvested PR has merged.
#
# Why: /harvest SKILL §4 step 3 (and harvest.ts itself) arm `gh pr merge --auto --squash`, so most
# harvested PRs merge LATER, on GitHub, when no session command is running. The in-session
# PostToolUse hook (close-aif-task-on-merge.sh) then only sees "not merged yet", and the aif task
# would wait for a human to click Approve — a manual step (operator directive 2026-09-28).
# This script is the auto-merge path's trigger: a launchd user agent runs `run` every M minutes
# (default 15). The agent uses StartCalendarInterval, not StartInterval: launchd DROPS an interval
# tick that falls while the Mac sleeps, but runs a missed calendar tick on wake (Apple, "Scheduling
# Timed Jobs") — and a laptop is asleep for most of the hours an auto-merge can land in.
#
# Usage:
#   bash scripts/close-merged-sweep.sh install [--every M] [--repo-root P]  # copy script + load agent
#   bash scripts/close-merged-sweep.sh uninstall                            # unload + remove agent
#   bash scripts/close-merged-sweep.sh status                               # agent state + last log
#   bash scripts/close-merged-sweep.sh print-plist [--every M] [--repo-root P]
#   bash scripts/close-merged-sweep.sh run                                  # one sweep (launchd calls it)
#
# Which code runs: NOT the clone's working tree. The operator's main clone sits on whatever branch
# the last session left it on (measured 2026-09-28: a branch without PR #1862, i.e. no
# --close-merged at all), and a session worktree is reaped when its session ends. So `install`
# copies this script out of the repo, and every `run` executes harvest.ts from `origin/staging`:
# `git fetch origin staging`, then `git archive` of packages/runtime-bridge/{package.json,src}
# (only `node:` + relative imports — self-contained) into a per-SHA cache. tsx is taken from the
# clone's node_modules (it is branch-independent there).
#
# `run`:
#   1. needs RUNTIME_BRIDGE_AIF_PROJECT_ID (launchd starts it through `zsh -c`, which reads
#      ~/.zshenv — that is where the operator keeps it); missing → ERROR, exit 2.
#   2. probes GET $RUNTIME_BRIDGE_AIF_URL/health (default http://localhost:3009, 3 s). The aif API
#      is reachable only while `aif-tunnel on` is up (aif runs on the PC) → down = SKIP, exit 0.
#   3. runs `tsx <staging harvest.ts> --close-merged --project <id> [--repo $CLOSE_MERGED_REPO]`
#      from the clone. harvest.ts re-proves merge + PR→task mapping + activity order itself and is
#      idempotent, so this script adds no trust and a re-run changes nothing.
#   4. logs ONE summary line (OK closed=N already=N skipped=N unmerged=N, plus each closed task)
#      to $CLOSE_MERGED_LOG (default ~/Library/Logs/aif-close-merged.log, rotated past 512 KB).
#      ERROR/FAIL also raise a macOS notification (CLOSE_MERGED_NOTIFY=0 disables): under launchd
#      no one reads stdout, so a failure the operator never sees would be #warning-nobody-reads.
#
# Exit codes: 0 = swept or skipped (aif down), 1 = harvest failed / unparsable output,
#             2 = misconfigured (no project id, no tsx, no usable origin/staging), 64 = usage.
#
# Env: CLOSE_MERGED_REPO_ROOT (the clone; `install` bakes it into the plist), CLOSE_MERGED_REPO,
# CLOSE_MERGED_LOG, CLOSE_MERGED_CACHE, CLOSE_MERGED_NOTIFY. Test seams
# (scripts/close-merged-sweep.test.sh): CLOSE_MERGED_TSX, CLOSE_MERGED_CURL, CLOSE_MERGED_LAUNCHCTL,
# CLOSE_MERGED_LAUNCH_AGENTS_DIR, CLOSE_MERGED_INSTALL_DIR.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

LABEL="dev.getff.aif-close-merged"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="${CLOSE_MERGED_LOG:-$HOME/Library/Logs/aif-close-merged.log}"
CACHE="${CLOSE_MERGED_CACHE:-$HOME/Library/Caches/getff-aif-close-merged}"
INSTALL_DIR="${CLOSE_MERGED_INSTALL_DIR:-$HOME/Library/Application Support/getff}"
LOG_CAP_BYTES=524288
BRIDGE_REL="packages/runtime-bridge"
HARVEST_REL="$BRIDGE_REL/src/cli/harvest.ts"
BASE_REF="origin/staging"

ts() { date '+%Y-%m-%dT%H:%M:%S%z'; }

log() {
  mkdir -p "$(dirname "$LOG")"
  printf '%s close-merged-sweep: %s\n' "$(ts)" "$*" >>"$LOG"
}

notify() {
  [ "${CLOSE_MERGED_NOTIFY:-1}" = 0 ] && return 0
  command -v osascript >/dev/null 2>&1 || return 0
  # The message is passed as an argv item, never spliced into the AppleScript source.
  osascript -e 'on run argv' -e 'display notification (item 1 of argv) with title "aif close-merged sweep"' \
    -e 'end run' "$1" >/dev/null 2>&1 || true
}

rotate_log() {
  [ -f "$LOG" ] || return 0
  local size
  size=$(wc -c <"$LOG" | tr -d ' ')
  [ "$size" -gt "$LOG_CAP_BYTES" ] && mv -f "$LOG" "$LOG.1"
  return 0
}

# The main clone — never a session worktree, which is reaped when its session ends.
main_clone_root() {
  local common
  if common=$(git -C "$SCRIPT_DIR" rev-parse --path-format=absolute --git-common-dir 2>/dev/null); then
    dirname "$common"
  else
    dirname "$SCRIPT_DIR"
  fi
}

# Extract origin/staging's runtime-bridge into $CACHE/<sha> (once per SHA) and print that dir.
staging_bridge() {
  local root="$1" sha dest tmp
  sha=$(git -C "$root" rev-parse --verify -q "$BASE_REF^{commit}") || return 1
  dest="$CACHE/$sha"
  if [ ! -f "$dest/$HARVEST_REL" ]; then
    mkdir -p "$CACHE"
    tmp=$(mktemp -d "$CACHE/.extract.XXXXXX")
    if ! git -C "$root" archive "$sha" "$BRIDGE_REL/package.json" "$BRIDGE_REL/src" | tar -x -C "$tmp"; then
      rm -rf "$tmp"
      return 1
    fi
    rm -rf "$dest"
    mv "$tmp" "$dest"
    # Keep only the SHA just extracted: older snapshots are never run again.
    find "$CACHE" -mindepth 1 -maxdepth 1 ! -name "$sha" -exec rm -rf {} +
  fi
  printf '%s' "$dest"
}

cmd_run() {
  rotate_log
  local root tsx url project
  root="${CLOSE_MERGED_REPO_ROOT:-$(main_clone_root)}"
  tsx="${CLOSE_MERGED_TSX:-$root/node_modules/.bin/tsx}"
  url="${RUNTIME_BRIDGE_AIF_URL:-http://localhost:3009}"
  project="${RUNTIME_BRIDGE_AIF_PROJECT_ID:-}"

  if [ -z "$project" ]; then
    log "ERROR RUNTIME_BRIDGE_AIF_PROJECT_ID is unset — the sweep cannot scope to a project (set it in ~/.zshenv)"
    notify "RUNTIME_BRIDGE_AIF_PROJECT_ID is unset; no tasks are being closed"
    return 2
  fi
  if [ ! -x "$tsx" ]; then
    log "ERROR tsx not found at $tsx — install packages in $root"
    notify "tsx missing at $tsx; no tasks are being closed"
    return 2
  fi

  # Probe first: with the tunnel down there is nothing to do, and no reason to touch the network.
  local curl_bin="${CLOSE_MERGED_CURL:-curl}"
  if ! "$curl_bin" -sf -o /dev/null --max-time 3 "$url/health" 2>/dev/null; then
    log "SKIP aif-down $url/health unreachable (aif-tunnel off?) — next tick retries"
    return 0
  fi

  # A failed fetch (offline, VPN) is not fatal: the last-fetched staging still has --close-merged.
  local fetch_note=""
  git -C "$root" fetch -q origin staging 2>/dev/null || fetch_note=" (fetch failed — using the last-fetched $BASE_REF)"

  local bridge
  if ! bridge=$(staging_bridge "$root"); then
    log "ERROR cannot extract $BASE_REF:$BRIDGE_REL from $root$fetch_note"
    notify "cannot read $BASE_REF in $root; no tasks are being closed"
    return 2
  fi
  if ! grep -q "'close-merged'" "$bridge/$HARVEST_REL"; then
    log "ERROR $BASE_REF harvest.ts has no --close-merged mode$fetch_note"
    notify "$BASE_REF harvest.ts has no --close-merged; no tasks are being closed"
    return 2
  fi

  local args=("$bridge/$HARVEST_REL" --close-merged --project "$project")
  [ -n "${CLOSE_MERGED_REPO:-}" ] && args+=(--repo "$CLOSE_MERGED_REPO")

  local out err rc=0
  err=$(mktemp "${TMPDIR:-/tmp}/close-merged-sweep.XXXXXX")
  out=$(cd "$root" && "$tsx" "${args[@]}" 2>"$err") || rc=$?
  if [ "$rc" -ne 0 ]; then
    log "FAIL harvest rc=$rc$fetch_note: $(tr '\n' ' ' <"$err" | cut -c1-600)"
    rm -f "$err"
    notify "harvest --close-merged failed (rc=$rc); see $LOG"
    return 1
  fi
  rm -f "$err"

  local line summary
  line=$(printf '%s\n' "$out" | grep -E '^\{.*"ok":true' | tail -1 || true)
  if [ -z "$line" ] || ! summary=$(printf '%s' "$line" | jq -r '
      .closeMerged as $e
      | ($e | map(select(.report.approved == true and (.report.alreadyClosed | not)))) as $closed
      | "OK closed=\($closed | length)"
        + " already=\($e | map(select(.report.alreadyClosed == true)) | length)"
        + " skipped=\($e | map(select(.skippedReason != null)) | length)"
        + " unmerged=\($e | map(select(.report != null and .report.merged == false)) | length)"
        + ($closed | map(" | \(.taskId) \(.prUrl)") | join(""))' 2>/dev/null); then
    log "FAIL unparsable harvest output: $(printf '%s' "$out" | tr '\n' ' ' | cut -c1-600)"
    notify "harvest --close-merged printed no ok:true JSON; see $LOG"
    return 1
  fi
  log "$summary$fetch_note"
  return 0
}

parse_install_args() {
  EVERY=15
  ROOT=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --every) EVERY="${2:?--every needs minutes}"; shift 2 ;;
      --repo-root) ROOT="${2:?--repo-root needs a path}"; shift 2 ;;
      *) echo "close-merged-sweep: unknown option $1" >&2; exit 64 ;;
    esac
  done
  # One calendar entry per minute mark, so the period must tile the hour evenly.
  case "$EVERY" in '' | *[!0-9]*) EVERY=0 ;; esac
  if [ "$EVERY" -lt 1 ] || [ "$EVERY" -gt 60 ] || [ $((60 % EVERY)) -ne 0 ]; then
    echo "close-merged-sweep: --every must be a divisor of 60 (minutes), e.g. 5, 10, 15, 30" >&2
    exit 64
  fi
  [ -n "$ROOT" ] || ROOT="$(main_clone_root)"
}

calendar_entries() {
  local m=0
  while [ "$m" -lt 60 ]; do
    printf '\t\t<dict>\n\t\t\t<key>Minute</key>\n\t\t\t<integer>%d</integer>\n\t\t</dict>\n' "$m"
    m=$((m + EVERY))
  done
}

xml_escape() { printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }

render_plist() {
  local script root log
  script=$(xml_escape "$INSTALL_DIR/close-merged-sweep.sh")
  root=$(xml_escape "$ROOT")
  log=$(xml_escape "$LOG")
  cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>$LABEL</string>
	<key>ProgramArguments</key>
	<array>
		<string>/bin/zsh</string>
		<string>-c</string>
		<string>exec /bin/bash "\$0" run</string>
		<string>$script</string>
	</array>
	<key>EnvironmentVariables</key>
	<dict>
		<key>CLOSE_MERGED_REPO_ROOT</key>
		<string>$root</string>
	</dict>
	<key>WorkingDirectory</key>
	<string>$root</string>
	<key>StartCalendarInterval</key>
	<array>
$(calendar_entries)
	</array>
	<key>RunAtLoad</key>
	<true/>
	<key>ProcessType</key>
	<string>Background</string>
	<key>StandardOutPath</key>
	<string>$log.launchd</string>
	<key>StandardErrorPath</key>
	<string>$log.launchd</string>
</dict>
</plist>
EOF
}

agents_dir() { printf '%s' "${CLOSE_MERGED_LAUNCH_AGENTS_DIR:-$HOME/Library/LaunchAgents}"; }

cmd_install() {
  parse_install_args "$@"
  if ! git -C "$ROOT" rev-parse --verify -q "$BASE_REF^{commit}" >/dev/null 2>&1; then
    echo "close-merged-sweep: $ROOT has no $BASE_REF — pass --repo-root <the clone>" >&2
    return 2
  fi
  if ! git -C "$ROOT" show "$BASE_REF:$HARVEST_REL" 2>/dev/null | grep -q "'close-merged'"; then
    echo "close-merged-sweep: $BASE_REF:$HARVEST_REL in $ROOT has no --close-merged mode (needs PR #1862) — git fetch origin staging" >&2
    return 2
  fi
  if [ ! -x "$ROOT/node_modules/.bin/tsx" ]; then
    echo "close-merged-sweep: $ROOT/node_modules/.bin/tsx missing — install packages in $ROOT first" >&2
    return 2
  fi
  local dir plist lc uid
  dir="$(agents_dir)"
  plist="$dir/$LABEL.plist"
  lc="${CLOSE_MERGED_LAUNCHCTL:-launchctl}"
  uid="$(id -u)"
  mkdir -p "$dir" "$INSTALL_DIR"
  cp "$SCRIPT_DIR/close-merged-sweep.sh" "$INSTALL_DIR/close-merged-sweep.sh"
  chmod 755 "$INSTALL_DIR/close-merged-sweep.sh"
  render_plist >"$plist"
  "$lc" bootout "gui/$uid/$LABEL" >/dev/null 2>&1 || true
  "$lc" bootstrap "gui/$uid" "$plist"
  echo "close-merged-sweep: installed $plist — every $EVERY min (and on wake), clone $ROOT; log: $LOG"
}

cmd_uninstall() {
  local lc uid
  lc="${CLOSE_MERGED_LAUNCHCTL:-launchctl}"
  uid="$(id -u)"
  "$lc" bootout "gui/$uid/$LABEL" >/dev/null 2>&1 || true
  rm -f "$(agents_dir)/$LABEL.plist" "$INSTALL_DIR/close-merged-sweep.sh"
  echo "close-merged-sweep: uninstalled $LABEL"
}

cmd_status() {
  local lc installed="$INSTALL_DIR/close-merged-sweep.sh"
  lc="${CLOSE_MERGED_LAUNCHCTL:-launchctl}"
  if ! "$lc" print "gui/$(id -u)/$LABEL" 2>/dev/null | grep -E '^\s*(state|last exit code|runs) ='; then
    echo "agent $LABEL: not loaded"
  fi
  # The installed copy does not follow the repo; say so when this checkout's version differs.
  if [ -f "$installed" ] && ! cmp -s "$installed" "$SCRIPT_DIR/close-merged-sweep.sh"; then
    echo "installed copy differs from $SCRIPT_DIR/close-merged-sweep.sh — re-run install to update it"
  fi
  [ -f "$LOG" ] && tail -n 5 "$LOG"
  return 0
}

case "${1:-}" in
  run) shift; cmd_run "$@" ;;
  install) shift; cmd_install "$@" ;;
  uninstall) cmd_uninstall ;;
  print-plist) shift; parse_install_args "$@"; render_plist ;;
  status) cmd_status ;;
  *) sed -n '13,18p' "$0" >&2; exit 64 ;;
esac
