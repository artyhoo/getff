#!/usr/bin/env bash
# skill-index.sh — sourced lib — rebuilds a name-only skill index after a compaction.
#
# @cc-only-rationale: the loss this repairs is a CC behaviour — the harness's skill listing
#   is the one startup block it does NOT re-inject after `/compact` (vendor context model:
#   `noSurviveCompact: true` on «Skill descriptions», code.claude.com/docs/en/context-window,
#   fetched 2026-09-29), and `SessionStart(source=compact)` is the one event that fires at
#   that instant. ZCode has no compaction-lifecycle event (zcode-parity-doctrine.md §2 row
#   21), so there is nothing to repair there; the caller's emit wrapper still keeps the
#   output valid on both harnesses. OPERATOR-AXIS ONLY: not mirrored into plugin/hooks/lib/.
#
# WHY A SOURCED LIB AND NOT ITS OWN HOOK: a new hook needs a new registration in
# `.claude/settings.json`, which no agent can write — that would turn the fix into a manual
# step for the operator. `inject-session-bootstrap.sh` is already registered on
# `startup|resume|clear|compact`, so the index rides on it and needs no registration.
#
# WHAT IT EMITS — on `source=compact` only, one block of skill NAMES grouped by namespace.
# The names are read from the last `skill_listing` attachment in the session transcript,
# i.e. exactly what the harness itself had offered: skills hidden by
# `disable-model-invocation`, `skillOverrides` or a disabled plugin were never in that
# listing and so never reappear here. No usable transcript → the project's own
# model-invocable skills. Nothing to list → nothing emitted.
#
# COST: zero bytes on every other source, zero bytes per prompt. Bounded by
# AIF_SKILL_INDEX_MAX_BYTES (default 4000). AIF_SKILL_INDEX=off disables it.
#
# NON-BLOCKING BY SHAPE: every failure path returns 0 with no output — this runs inside a
# SessionStart hook, and a SessionStart failure must never break a session start.

# Names of the last skill listing the harness recorded in the transcript, one per line.
_skill_index_names_from_transcript() {
  local tpath="$1"
  [ -n "$tpath" ] && [ -r "$tpath" ] || return 0
  command -v jq >/dev/null 2>&1 || return 0
  # grep is the prefilter (a transcript runs to tens of MB); jq is the judge — a line that
  # merely QUOTES a listing is some other record type and fails the select.
  # `-R` + `fromjson?` parses line by line: one malformed or half-written record must not
  # stop the stream, or the last listing BEFORE it would be reported as the current one.
  grep -F 'skill_listing' "$tpath" 2>/dev/null \
    | jq -R -c 'fromjson?
             | select(type == "object")
             | select((.attachment | type) == "object")
             | select(.attachment.type == "skill_listing")
             | .attachment.names
             | select(type == "array")' 2>/dev/null \
    | tail -n 1 \
    | jq -r '.[] | select(type == "string")' 2>/dev/null \
    | tr -d '\r' \
    | grep -E '^([A-Za-z0-9._-]+:)?[A-Za-z0-9._-]+$' || true
}

# Project skills the model may invoke (frontmatter `disable-model-invocation: true` excluded).
_skill_index_names_from_project() {
  local root="$1" f name
  [ -d "$root/.claude/skills" ] || return 0
  for f in "$root"/.claude/skills/*/SKILL.md; do
    [ -f "$f" ] || continue
    name=$(awk '
      NR == 1 && $0 !~ /^---[[:space:]]*$/ { exit }
      NR > 1 && /^---[[:space:]]*$/ { done = 1; exit }
      /^disable-model-invocation:[[:space:]]*true[[:space:]]*$/ { hidden = 1 }
      /^name:[[:space:]]*/ { n = $0; sub(/^name:[[:space:]]*/, "", n); gsub(/["\047[:space:]]/, "", n) }
      END { if (!hidden && done && n != "") print n }
    ' "$f" 2>/dev/null || true)
    case "$name" in
      '' | *[!A-Za-z0-9._-]*) ;;
      *) printf '%s\n' "$name" ;;
    esac
  done
}

# _skill_index_block <hook stdin payload> <project root> [room in bytes] — prints the block
# or nothing.
_skill_index_block() {
  local input="$1" root="$2" source_kind="" tpath="" names="" cap room head_text foot_text budget body
  [ "${AIF_SKILL_INDEX:-on}" = "off" ] && return 0
  [ -n "$input" ] || return 0

  if command -v jq >/dev/null 2>&1; then
    source_kind=$(printf '%s' "$input" | jq -r '.source // empty' 2>/dev/null || true)
    tpath=$(printf '%s' "$input" | jq -r '.transcript_path // empty' 2>/dev/null || true)
  else
    case "$input" in
      *'"source":"compact"'* | *'"source": "compact"'*) source_kind="compact" ;;
    esac
  fi
  # Only `compact` follows a compaction. On startup/resume/clear the harness sends its own
  # listing, with descriptions — repeating the names there would be pure cost.
  [ "$source_kind" = "compact" ] || return 0

  names=$(_skill_index_names_from_transcript "$tpath")
  [ -n "$names" ] || names=$(_skill_index_names_from_project "$root")
  [ -n "$names" ] || return 0

  cap="${AIF_SKILL_INDEX_MAX_BYTES:-4000}"
  case "$cap" in '' | *[!0-9]*) cap=4000 ;; esac
  # 10# — a leading zero («0800») would otherwise be read as invalid octal.
  cap=$((10#$cap))
  [ "$cap" -ge 600 ] || cap=600
  # Optional third argument: the room the caller has left under the harness's own cap on
  # hook output. Less than a useful block → emit nothing rather than displace the caller.
  case "${3:-}" in
    '') ;;
    -*) return 0 ;;
    *[!0-9]*) ;;
    *)
      room=$((10#$3))
      [ "$room" -ge 600 ] || return 0
      [ "$room" -ge "$cap" ] || cap="$room"
      ;;
  esac

  head_text='[skill index — re-injected after compaction]
The harness does not re-send its skill listing after a compaction. The skills below are still installed: invoke one through the Skill tool by its exact name (`namespace:name`; names in the first line have no namespace). Descriptions are not repeated here — when a name plausibly fits the task, invoke the skill and read it.'
  foot_text='[/skill index]'
  # Reserve: both fences, their newlines, and the worst-case «+N more» line.
  budget=$((cap - $(printf '%s%s' "$head_text" "$foot_text" | LC_ALL=C wc -c) - 60))
  [ "$budget" -gt 0 ] || return 0

  body=$(printf '%s\n' "$names" | LC_ALL=C awk -v budget="$budget" '
    {
      name = $0; ns = ""
      i = index(name, ":")
      if (i > 0) { ns = substr(name, 1, i - 1); name = substr(name, i + 1) }
      if (name == "" || seen[ns SUBSEP name]++) next
      if (!(ns in order)) { order[ns] = ++groups; label[groups] = ns }
      g = order[ns]
      count[g]++
      item[g, count[g]] = name
    }
    END {
      used = 0; cut = 0
      # The un-namespaced group (project, user and built-in skills) goes first.
      n = 0
      for (g = 1; g <= groups; g++) if (label[g] == "") seq[++n] = g
      for (g = 1; g <= groups; g++) if (label[g] != "") seq[++n] = g
      for (k = 1; k <= n; k++) {
        g = seq[k]
        line = (label[g] == "") ? "" : label[g] ": "
        kept = 0
        for (j = 1; j <= count[g]; j++) {
          piece = (kept ? ", " : "") item[g, j]
          if (used + length(line) + length(piece) + 1 > budget) { cut += count[g] - j + 1; break }
          line = line piece
          kept++
        }
        if (kept) { print line; used += length(line) + 1 }
      }
      if (cut) printf "(+%d more skills cut at the byte cap)\n", cut
    }
  ' 2>/dev/null)
  # All-or-nothing: fences around an empty body would tell the model «no skills».
  [ -n "$body" ] || return 0
  printf '%s\n%s\n%s' "$head_text" "$body" "$foot_text"
}
