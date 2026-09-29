#!/usr/bin/env bash
# close-aif-task-on-merge.sh — PostToolUse(Bash) hook — close the aif task a merged harvest PR names
#
# @cc-only-rationale: no §5 portable-markdown counterpart exists to anchor-pair with — the
#   non-hook equivalent is the TS return channel below, and packages/** TS is outside
#   delivery-channel triage (dual-implementation-discipline.md §2(iv)). Internal operator
#   tooling (§3): registered only in this repo's harness model, not shipped by any setup.d
#   step. Manual equivalent where no hook channel exists — /harvest SKILL §4 step 5:
#   `tsx packages/runtime-bridge/src/cli/harvest.ts <taskId> --close-merged`.
# spec: packages/runtime-bridge/src/cli/harvest.ts (reportMergeToAif)
#
# WHY (operator directive 2026-09-28 — every manual step is a defect): PR #1862 taught harvest.ts
# to close an aif task (done → verified, the UI's Approve route) once its PR has merged, but the
# close still ran only when an agent remembered /harvest §4 step 5. This hook runs it at the moment
# the merge happens in a session: after a Bash call that merges a PR.
#
# What counts as a merge call (per shell segment whose command word is `gh`):
#   - `gh pr merge [<number|url|branch>] [flags]`  (no selector = the cwd's current branch);
#   - `gh api -X PUT … repos/<owner>/<repo>/pulls/<n>/merge`  (the REST fallback used when
#     GraphQL is down; a GET on that path is only a status probe and is ignored).
#   `gh pr merge --disable-auto` is ignored. A selector built from a shell variable cannot be
#   resolved here and is announced, not guessed.
#
# What it does, per resolved PR:
#   1. `gh pr view <sel> --json url,state,body` — the PR's body is the only task source: every
#      exact `aif-task: <id>` line (harvest.ts `taskMarker`) names one task. No marker → silent
#      exit (not a harvested PR, nothing to close).
#   2. State not MERGED (typically `--auto` armed and checks still running) → a notice with the
#      command to run once it lands; nothing is written.
#   3. aif unreachable (GET <url>/health, 3 s — the API is up only while `aif-tunnel on` is) →
#      a notice naming the task(s) left open and the command to close them later.
#   4. Otherwise `harvest.ts <id> --report-merge <prUrl>` for each task — the exact-PR form of the
#      return channel. It re-proves the merge, the PR→task mapping and the activity order itself,
#      so this hook adds no trust: a wrong or unmerged PR still writes nothing.
#
# FAIL-OPEN: the merge has already happened when this runs, so there is nothing to gate. Every
# path exits 0; every miss (no jq/gh/tsx/entrypoint, aif down, harvest error) is announced as JSON
# additionalContext — the channel the model actually receives on an exit-0 PostToolUse
# (lib/hook-emit.sh) — never swallowed (attention-is-not-a-mechanism.md §2 #warning-nobody-reads).
set -uo pipefail

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/hook-emit.sh
if ! . "$HOOK_DIR/lib/hook-emit.sh" 2>/dev/null; then
  printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"%s"}}\n' \
    '⚠ close-aif-task-on-merge: lib/hook-emit.sh could not be sourced — the aif close-on-merge check DID NOT RUN. Close manually: tsx packages/runtime-bridge/src/cli/harvest.ts <taskId> --close-merged'
  exit 0
fi

# Task ids come from a PR body and are word-split below: never let one glob-expand.
set -f

INPUT="$(cat)"

# ── Cheap pre-filter before any dependency is required ───────────────────────
# Most Bash calls are not merges; they must cost nothing and never announce anything.
case "$INPUT" in
  *'gh'*'merge'*) ;;
  *) exit 0 ;;
esac

MANUAL_HINT='tsx packages/runtime-bridge/src/cli/harvest.ts <taskId> --close-merged'

if ! command -v jq >/dev/null 2>&1; then
  _emit_skip "⚠ close-aif-task-on-merge: jq unavailable — a command that may have merged a PR ran, but its aif task was NOT checked or closed. Close manually: $MANUAL_HINT"
  exit 0
fi

TOOL="$(printf '%s' "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || true)"
[ "$TOOL" = "Bash" ] || exit 0
COMMAND="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || true)"
CWD="$(printf '%s' "$INPUT" | jq -r '.cwd // ""' 2>/dev/null || true)"
[ -n "$COMMAND" ] || exit 0

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$HOOK_DIR/../.." && pwd)}"
[ -n "$CWD" ] && [ -d "$CWD" ] || CWD="$REPO_ROOT"

NOTES=()
note() { NOTES+=("$1"); }
flush() {
  [ "${#NOTES[@]}" -eq 0 ] && return 0
  local joined="" n
  for n in "${NOTES[@]}"; do joined="${joined:+$joined | }$n"; done
  _emit_skip "$joined"
}

# ── Find merge calls → "<selector>\t<repo>\t<cwd>" lines ─────────────────────
# The command is split into shell segments on ; | & ( ) and newlines — but only OUTSIDE quotes
# (a `--subject "a; b"` or a multi-line `-m "…"` stays one segment), a trailing `\` joins the next
# line, and an unquoted heredoc body (`<<[-]WORD … WORD`) is dropped. A segment counts only when
# `gh` is its COMMAND word (after VAR=val / env / command prefixes): a commit message, PR body or
# echo that merely mentions `gh pr merge 42` is never a merge. Quoting inside a segment is honoured
# by xargs' tokenizer. Anything this parser misreads costs a missed selector, never a wrong
# close — step 4 re-proves everything.
_split_segments() {
  awk '
  function emit() { print out; out = "" }
  {
    line = $0
    if (hd != "") {
      t = line
      if (hddash) sub(/^\t+/, "", t)
      if (t == hd) hd = ""
      next
    }
    n = length(line); pend = ""
    for (i = 1; i <= n; i++) {
      c = substr(line, i, 1)
      if (q != "") {
        out = out c
        if (c == "\\" && q == "\"" && i < n) { i++; out = out substr(line, i, 1); continue }
        if (c == q) q = ""
        continue
      }
      if (c == "\\" && i == n) { cont = 1; continue }
      if (c == "\\") { out = out c substr(line, i + 1, 1); i++; continue }
      if (c == "\"" || c == "\047") { q = c; out = out c; continue }
      if (substr(line, i, 2) == "<<" && substr(line, i, 3) != "<<<") {
        j = i + 2; dash = 0
        if (substr(line, j, 1) == "-") { dash = 1; j++ }
        while (substr(line, j, 1) == " " || substr(line, j, 1) == "\t") j++
        w = ""
        while (j <= n) {
          d = substr(line, j, 1)
          if (d == " " || d == "\t" || d == ";" || d == "|" || d == "&" || d == "(" || d == ")" || d == "<" || d == ">") break
          if (d != "\"" && d != "\047" && d != "\\") w = w d
          j++
        }
        if (w != "") { pend = w; pdash = dash }
        out = out substr(line, i, j - i); i = j - 1; continue
      }
      if (c == ";" || c == "|" || c == "&" || c == "(" || c == ")") { emit(); continue }
      out = out c
    }
    if (q != "") { out = out " "; next }
    if (cont) { cont = 0; out = out " " } else emit()
    if (pend != "") { hd = pend; hddash = pdash }
  }
  END { if (out != "") print out }'
}
_strip_prefixes() {
  sed -E 's/^[[:space:]]+//
    s/^([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)+//
    s/^((do|then|else|!|\{)[[:space:]]+)+//
    s/^(command|builtin|env|time)[[:space:]]+//
    s/^([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)+//'
}
VALUE_FLAGS=' -R --repo -b --body -F --body-file -t --subject -A --author-email --match-head-commit '
SELECTORS=()
UNRESOLVED=0
SEG_CWD="$CWD"
while IFS= read -r seg; do
  seg="$(printf '%s' "$seg" | _strip_prefixes)"
  # Track a literal `cd <dir>` so `cd ../other && gh pr merge 5` asks the right repo.
  case "$seg" in
    'cd '*)
      dir="$(printf '%s' "${seg#cd }" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"
      dir="${dir#[\"\']}"; dir="${dir%[\"\']}"
      case "$dir" in *'$'*|*'`'*|'') ;; *)
        case "$dir" in '~'*) dir="$HOME${dir#\~}" ;; /*) ;; *) dir="$SEG_CWD/$dir" ;; esac
        [ -d "$dir" ] && SEG_CWD="$dir" ;;
      esac
      continue ;;
  esac
  if grep -Eq '^gh[[:space:]]+api([[:space:]]|$)' <<<"$seg"; then
    grep -Eq '/pulls/[^/[:space:]]+/merge' <<<"$seg" || continue
    # Only a PUT merges; a bare GET on the same path is the "is it merged?" probe.
    grep -Eq '(-X|--method)[[:space:]=]*PUT([[:space:]]|$)' <<<"$seg" || continue
    rest_api="$(printf '%s' "$seg" | sed -nE 's#.*repos/([^/[:space:]"'"'"']+/[^/[:space:]"'"'"']+)/pulls/([0-9]+)/merge.*#\2	\1#p')"
    if [ -z "$rest_api" ]; then UNRESOLVED=1; continue; fi
    case "${rest_api#*	}" in *'{'*|*'$'*) rest_api="${rest_api%%	*}	" ;; esac
    SELECTORS+=("${rest_api}	${SEG_CWD}")
    continue
  fi
  grep -Eq '^gh[[:space:]]+pr[[:space:]]+merge([[:space:]]|$)' <<<"$seg" || continue
  rest="$(printf '%s' "$seg" | sed -E 's/^gh[[:space:]]+pr[[:space:]]+merge//')"
  if ! tokens="$(printf '%s' "$rest" | xargs -n1 printf '%s\n' 2>/dev/null)"; then
    UNRESOLVED=1
    continue
  fi
  sel="" repo="" want_value="" disable=0
  while IFS= read -r tok; do
    [ -n "$tok" ] || continue
    if [ -n "$want_value" ]; then
      case "$want_value" in -R|--repo) repo="$tok" ;; esac
      want_value=""
      continue
    fi
    case "$tok" in
      --disable-auto) disable=1 ;;
      --repo=*) repo="${tok#--repo=}" ;;
      --*=*) ;;
      -*)
        case "$VALUE_FLAGS" in *" $tok "*) want_value="$tok" ;; esac ;;
      # Redirections (`2>/dev/null`, `>log`, a bare `>` followed by its target) are not selectors.
      *'>'|*'<') want_value="redirect" ;;
      [0-9]*'>'*|[0-9]*'<'*|'>'*|'<'*) ;;
      *) [ -z "$sel" ] && sel="$tok" ;;
    esac
  done <<< "$tokens"
  [ "$disable" -eq 1 ] && continue
  case "$sel$repo" in
    *'$'*|*'`'*) UNRESOLVED=1; continue ;;
  esac
  SELECTORS+=("${sel}	${repo}	${SEG_CWD}")
done < <(printf '%s\n' "$COMMAND" | _split_segments)

if [ "$UNRESOLVED" -eq 1 ]; then
  note "⚠ close-aif-task-on-merge: a PR merge ran but its selector could not be resolved (shell variable or unbalanced quoting) — its aif task was NOT checked. If the PR carries an aif-task line, close it: $MANUAL_HINT"
fi
if [ "${#SELECTORS[@]}" -eq 0 ]; then
  flush
  exit 0
fi

# bash 3.2 has no `timeout`: fall back to perl's alarm (SIGALRM survives exec → exit 142).
# A hook the harness kills emits nothing, so every network call is bounded here instead.
GH_TIMEOUT="${CLOSE_AIF_GH_TIMEOUT:-20}"
HARVEST_TIMEOUT="${CLOSE_AIF_HARVEST_TIMEOUT:-60}"
_bounded() {
  local secs="$1"; shift
  if command -v timeout >/dev/null 2>&1; then timeout "$secs" "$@"
  elif command -v gtimeout >/dev/null 2>&1; then gtimeout "$secs" "$@"
  elif command -v perl >/dev/null 2>&1; then perl -e 'alarm shift @ARGV; exec @ARGV or exit 127' "$secs" "$@"
  else "$@"
  fi
}
_timed_out() { [ "$1" -eq 124 ] || [ "$1" -eq 142 ]; }

if ! command -v gh >/dev/null 2>&1; then
  note "⚠ close-aif-task-on-merge: gh unavailable — a PR merge ran but its aif task was NOT checked or closed. Close manually: $MANUAL_HINT"
  flush
  exit 0
fi

# ── Resolve each PR, collect "<taskId>\t<prUrl>" pairs to close ───────────────
AIF_URL="${RUNTIME_BRIDGE_AIF_URL:-http://localhost:3009}"
PAIRS=()
SEEN_URLS=" "
for entry in "${SELECTORS[@]}"; do
  sel="${entry%%	*}"
  rest_e="${entry#*	}"
  repo="${rest_e%%	*}"
  sel_cwd="${rest_e#*	}"
  args=(pr view)
  [ -n "$sel" ] && args+=("$sel")
  [ -n "$repo" ] && args+=(--repo "$repo")
  args+=(--json 'url,state,body')
  view="$(cd "$sel_cwd" && _bounded "$GH_TIMEOUT" gh "${args[@]}" 2>/dev/null)"
  rc=$?
  if [ "$rc" -ne 0 ]; then
    why="failed"
    _timed_out "$rc" && why="timed out after ${GH_TIMEOUT}s"
    note "⚠ close-aif-task-on-merge: gh pr view ${sel:-<current branch>} $why — could not read the merged PR, so its aif task was NOT checked. Close manually: $MANUAL_HINT"
    continue
  fi
  url="$(printf '%s' "$view" | jq -r '.url // ""' 2>/dev/null || true)"
  state="$(printf '%s' "$view" | jq -r '.state // ""' 2>/dev/null || true)"
  if [ -z "$url" ]; then
    note "⚠ close-aif-task-on-merge: gh pr view ${sel:-<current branch>} returned no PR url — its aif task was NOT checked. Close manually: $MANUAL_HINT"
    continue
  fi
  case "$SEEN_URLS" in *" $url "*) continue ;; esac
  SEEN_URLS="$SEEN_URLS$url "
  ids="$(printf '%s' "$view" | jq -r '.body // ""' 2>/dev/null | tr -d '\r' \
    | sed -n 's/^[[:space:]]*aif-task: \([^[:space:]][^[:space:]]*\)[[:space:]]*$/\1/p')"
  [ -n "$ids" ] || continue
  if [ "$state" != "MERGED" ]; then
    for id in $ids; do
      note "close-aif-task-on-merge: $url is $state, not merged yet (auto-merge armed?) — aif task $id stays open. Once it merges: tsx packages/runtime-bridge/src/cli/harvest.ts $id --report-merge $url"
    done
    continue
  fi
  for id in $ids; do PAIRS+=("${id}	${url}"); done
done

if [ "${#PAIRS[@]}" -eq 0 ]; then
  flush
  exit 0
fi

# ── Preconditions for the write: aif reachable, entrypoint + tsx present ─────
_later_cmds() {
  local p out=""
  for p in "${PAIRS[@]}"; do
    out="${out:+$out ; }tsx packages/runtime-bridge/src/cli/harvest.ts ${p%%	*} --report-merge ${p#*	}"
  done
  printf '%s' "$out"
}

if ! command -v curl >/dev/null 2>&1 || ! curl -sf -o /dev/null --max-time 3 "$AIF_URL/health" 2>/dev/null; then
  note "⚠ close-aif-task-on-merge: the PR merged but the aif API at $AIF_URL is unreachable (aif-tunnel off?) — the task was NOT closed. This is a SKIP, not a pass. With the tunnel up, run: $(_later_cmds)"
  flush
  exit 0
fi

_resolve_harvest_ts() {
  local candidate
  for candidate in \
    "$REPO_ROOT/packages/runtime-bridge/src/cli/harvest.ts" \
    "$REPO_ROOT/.claude/vendor/runtime-bridge/src/cli/harvest.ts"; do
    [ -f "$candidate" ] && { printf '%s' "$candidate"; return 0; }
  done
  return 1
}

# Tier list shared with check-doc-authority.sh: linked worktrees often carry no node_modules.
_resolve_tsx() {
  local candidate="$REPO_ROOT/node_modules/.bin/tsx"
  [ -x "$candidate" ] && { printf '%s' "$candidate"; return 0; }
  local common_dir
  common_dir="$(git -C "$REPO_ROOT" rev-parse --git-common-dir 2>/dev/null || true)"
  if [ -n "$common_dir" ]; then
    case "$common_dir" in /*) ;; *) common_dir="$REPO_ROOT/$common_dir" ;; esac
    candidate="${common_dir%/*}/node_modules/.bin/tsx"
    [ -x "$candidate" ] && { printf '%s' "$candidate"; return 0; }
  fi
  local on_path; on_path="$(command -v tsx 2>/dev/null || true)"
  [ -n "$on_path" ] && { printf '%s' "$on_path"; return 0; }
  return 1
}

if ! HARVEST_TS="$(_resolve_harvest_ts)"; then
  note "⚠ close-aif-task-on-merge: no harvest.ts entrypoint under $REPO_ROOT — the merged PR's aif task was NOT closed. Run from a checkout that has it: $(_later_cmds)"
  flush
  exit 0
fi
if ! TSX="$(_resolve_tsx)"; then
  note "⚠ close-aif-task-on-merge: tsx not found (repo, main worktree, PATH) — the merged PR's aif task was NOT closed. Install deps, then run: $(_later_cmds)"
  flush
  exit 0
fi

# ── Close each task through the return channel ───────────────────────────────
ERR_LOG="$(mktemp "${TMPDIR:-/tmp}/close-aif-task-on-merge.XXXXXX" 2>/dev/null || printf '')"
trap '[ -n "$ERR_LOG" ] && rm -f "$ERR_LOG"' EXIT

for p in "${PAIRS[@]}"; do
  id="${p%%	*}"
  url="${p#*	}"
  if [ -n "$ERR_LOG" ]; then
    out="$(cd "$REPO_ROOT" && RUNTIME_BRIDGE_AIF_URL="$AIF_URL" _bounded "$HARVEST_TIMEOUT" "$TSX" "$HARVEST_TS" "$id" --report-merge "$url" 2>"$ERR_LOG")"
  else
    out="$(cd "$REPO_ROOT" && RUNTIME_BRIDGE_AIF_URL="$AIF_URL" _bounded "$HARVEST_TIMEOUT" "$TSX" "$HARVEST_TS" "$id" --report-merge "$url" 2>/dev/null)"
  fi
  rc=$?
  if [ "$rc" -ne 0 ]; then
    err=""
    [ -n "$ERR_LOG" ] && err="$(tail -n 5 "$ERR_LOG" 2>/dev/null | tr '\n' ' ')"
    _timed_out "$rc" && err="timed out after ${HARVEST_TIMEOUT}s${err:+; $err}"
    note "⚠ close-aif-task-on-merge: closing aif task $id for $url FAILED (exit $rc): ${err:-no stderr}. Retry: tsx packages/runtime-bridge/src/cli/harvest.ts $id --report-merge $url"
    continue
  fi
  approved="$(printf '%s' "$out" | jq -r '.mergeReport.approved // false' 2>/dev/null || true)"
  already="$(printf '%s' "$out" | jq -r '.mergeReport.alreadyClosed // false' 2>/dev/null || true)"
  final="$(printf '%s' "$out" | jq -r '.mergeReport.finalStatus // ""' 2>/dev/null || true)"
  reason="$(printf '%s' "$out" | jq -r '.mergeReport.skippedReason // ""' 2>/dev/null || true)"
  [ -n "$final" ] || final="unknown"
  printf '%s' "$out" | jq -e '.mergeReport' >/dev/null 2>&1 || reason="${reason:-harvest.ts printed no mergeReport}"
  if [ "$approved" = "true" ]; then
    note "close-aif-task-on-merge: aif task $id closed (done → verified) — $url merged."
  elif [ "$already" = "true" ]; then
    note "close-aif-task-on-merge: aif task $id was already verified — nothing to do ($url)."
  else
    note "⚠ close-aif-task-on-merge: aif task $id NOT closed (status $final): ${reason:-no reason reported}. $url"
  fi
done

flush
exit 0
