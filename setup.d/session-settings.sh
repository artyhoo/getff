#!/usr/bin/env bash
# setup.d/session-settings.sh — the session-settings group (one-button point 13, plan §3).
#
# Settings that change how a person's sessions run (the auto-compact window, agent teams, getff's
# generic safety permissions) are OFFERED in the pre-launch list and written only on that «yes»,
# which reaches the installer as GETFF_SESSION_SETTINGS=1. They go into the per-person
# .claude/settings.local.json — never the team's committed settings.json — and the install prints
# ONE command that undoes them.
#
# The values live in setup.d/session-settings.json, a subset of getff's own .claude/settings.json;
# scripts/check-ships-manifest.mjs fails when the two drift apart, and every key there is an
# `ask` row of setup.d/ships.manifest.
#
# Merge rule: the person's own value always wins. A key they already set is kept; getff's array
# entries are added to theirs without duplicates. So the undo is a restore of their file:
#   the file existed → its original is kept in .ai-factory/before-getff/ (lib.sh
#                      keep_original_snapshot / keep_original_settle, the Q4.7 mechanism) and the
#                      undo command copies it back;
#   the file did not → a `.absent` marker is left there and the undo command removes the file.
# Sourced by setup.d/12-session-settings.sh (npm lanes) and setup.d/45-python.sh (python lane).
# Depends on lib.sh (json_edit_node, keep_original_*, note_not_wired, note_getff_added) and bridge-guided.sh
# (_bridge_ignore_local, sourced below with BRIDGE_LIB_ONLY=1: function definitions only).
# @cc-only-rationale: sourced by install.sh layers, not standalone

# shellcheck source=setup.d/bridge-guided.sh
BRIDGE_LIB_ONLY=1 . "$PKG_ROOT/setup.d/bridge-guided.sh"

GETFF_SESSION_REVERT=""

# _session_settings_merge FILE DATA — merge DATA into FILE (created as {} when absent), the
# person's values winning. jq when present, else node through json_edit_node. rc 0 = written.
_session_settings_merge() {
  local f="$1" data="$2" tmp="$1.session.tmp"
  if command -v jq >/dev/null 2>&1; then
    # shellcheck disable=SC2016  # jq program, not shell expansions
    if { if [ -f "$f" ]; then cat "$f"; else printf '{}'; fi; } | jq --slurpfile g "$data" '
        def keep($a; $b):
          if ($a | type) == "object" and ($b | type) == "object" then
            reduce ($b | keys_unsorted[]) as $k ($a; .[$k] = (if has($k) then keep(.[$k]; $b[$k]) else $b[$k] end))
          elif ($a | type) == "array" and ($b | type) == "array" then
            $a + [$b[] | . as $x | select(($a | any(.[]; . == $x)) | not)]
          else $a end;
        if type == "object" then keep(.; $g[0]) else error("not an object") end' > "$tmp" 2>/dev/null \
      && jq -e . "$tmp" >/dev/null 2>&1 && mv "$tmp" "$f"; then
      return 0
    fi
    rm -f "$tmp" 2>/dev/null
    return 1
  fi
  local rc=0
  # shellcheck disable=SC2016  # JavaScript, not shell expansions
  json_edit_node "$f" '
    const g = JSON.parse(require("fs").readFileSync(args[0], "utf8"));
    const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
    const keep = (a, b) => {
      if (isObj(a) && isObj(b)) { for (const k of Object.keys(b)) a[k] = k in a ? keep(a[k], b[k]) : b[k]; return a; }
      if (Array.isArray(a) && Array.isArray(b)) return a.concat(b.filter((x) => !a.includes(x)));
      return a;
    };
    return keep(o, g);' "$data" || rc=$?
  return "$rc"
}

# _session_settings_undo ROOT — the undo command for what an earlier run left in
# .ai-factory/before-getff/ (the newest kept original, or the `.absent` marker); empty when none.
_session_settings_undo() {
  local dir="$1/.ai-factory/before-getff/.claude" newest="" c
  [ -e "$dir/settings.local.json.absent" ] && { echo "rm .claude/settings.local.json"; return 0; }
  for c in "$dir"/settings.local.json.*; do
    [ -f "$c" ] || continue
    if [ -z "$newest" ] || [ "$c" -nt "$newest" ]; then newest="$c"; fi
  done
  [ -n "$newest" ] && echo "cp '${newest#"$1"/}' .claude/settings.local.json"
  return 0
}

# apply_session_settings ROOT — write the group into ROOT/.claude/settings.local.json on consent;
# sets GETFF_SESSION_REVERT to the undo command (empty when nothing was changed by getff).
apply_session_settings() {
  local root="$1" data="$PKG_ROOT/setup.d/session-settings.json" f snap="" kept="" rel=".claude/settings.local.json"
  f="$root/$rel"
  GETFF_SESSION_REVERT=""
  if [ "${GETFF_SESSION_SETTINGS:-}" != "1" ]; then
    echo "  · session settings not applied (not chosen in the pre-launch list): auto-compact window, agent teams, getff's generic safety permissions"
    return 0
  fi
  if [ "${DRY_RUN:-}" = "--dry-run" ]; then
    echo "  [dry-run] would: add the session-settings group to $rel (your own values kept)"
    return 0
  fi
  if ! mkdir -p "$root/.claude" 2>/dev/null; then
    note_not_wired "session settings in $rel — .claude/ could not be created"
    return 0
  fi
  if [ -f "$f" ]; then
    if ! snap=$(keep_original_snapshot "$f"); then
      note_not_wired "session settings in $rel — its original could not be copied aside, so it was left as it was"
      return 0
    fi
  fi
  if ! _session_settings_merge "$f" "$data"; then
    [ -n "$snap" ] && rm -f "$snap"
    note_not_wired "session settings in $rel — it is not a valid JSON object or could not be written, so it was left as it was"
    return 0
  fi
  if [ -n "$snap" ]; then
    # keep_original_settle echoes where the original went only when the write changed the file;
    # rc 1 means the change was undone because the original could not be kept.
    if ! kept=$(keep_original_settle "$f" "$snap"); then
      note_not_wired "session settings in $rel — its original could not be kept, so getff's change was undone"
      return 0
    fi
    [ -n "$kept" ] && note_getff_added "$rel"
  elif [ ! -e "$root/.ai-factory/before-getff/.claude/$(basename "$rel").absent" ]; then
    mkdir -p "$root/.ai-factory/before-getff/.claude" 2>/dev/null \
      && : > "$root/.ai-factory/before-getff/.claude/$(basename "$rel").absent"
  fi
  _bridge_ignore_local "$root"
  GETFF_SESSION_REVERT=$(_session_settings_undo "$root")
  if [ -n "$kept" ] || [ -z "$snap" ]; then
    echo "  ✓ session settings added to $rel (your own values kept) — undo with: ${GETFF_SESSION_REVERT:-nothing to undo}"
  else
    echo "  ✓ session settings already in $rel — nothing changed${GETFF_SESSION_REVERT:+; undo with: $GETFF_SESSION_REVERT}"
  fi
  return 0
}
