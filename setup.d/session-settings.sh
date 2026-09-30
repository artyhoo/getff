#!/usr/bin/env bash
# setup.d/session-settings.sh — the session-settings group (one-button point 13, plan §3).
#
# Settings that change how a person's sessions run (the auto-compact window, agent teams, the handoff
# gate, getff's generic safety permissions) are OFFERED in the pre-launch list and written only on that «yes»,
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

# _session_settings_theirs ROOT DATA OUT — the project's own setup wins (one-button fork 1 = A,
# operator log entry 28). Claude Code reads settings.local.json OVER the team's settings.json, so a
# getff value written into the local file would override a value the project set for everyone.
# Writes to OUT the group minus every single value (a leaf that is not an array element) the
# project's .claude/settings.json already sets, and prints one TAB line per value the project
# already has in either file where getff's differs: <file> TAB <key.path> TAB <theirs> TAB <getff's>.
# Array entries (permissions) stay additive: Claude Code merges them across the two files anyway.
# rc 1 when neither jq nor node can read the files (the caller then writes nothing).
_session_settings_theirs() {
  local root="$1" data="$2" out="$3" proj="$1/.claude/settings.json" loc="$1/.claude/settings.local.json"
  if command -v jq >/dev/null 2>&1; then
    printf '{}' > "$out.empty"
    [ -f "$proj" ] || proj="$out.empty"
    [ -f "$loc" ] || loc="$out.empty"
    # shellcheck disable=SC2016  # jq program, not shell expansions
    jq -n -r --slurpfile g "$data" --slurpfile p "$proj" --slurpfile l "$loc" '
      def at($o; $path): try ($o | getpath($path)) catch null;
      def leaves: [paths(scalars) | select(all(.[]; type == "string"))];
      ($p[0] // {}) as $P | ($l[0] // {}) as $L | $g[0] as $G
      | ($G | leaves) as $ks
      | (reduce $ks[] as $k ($G; if at($P; $k) != null then delpaths([$k]) else . end)) as $W
      | ($W | tojson | "WRITE\t\(.)"),
        ($ks[] | . as $k | at($G; $k) as $gv
          | (if at($P; $k) != null and at($P; $k) != $gv then ".claude/settings.json\t\(join("."))\t\(at($P; $k) | tojson)\t\($gv | tojson)" else empty end),
            (if at($P; $k) == null and at($L; $k) != null and at($L; $k) != $gv then ".claude/settings.local.json\t\(join("."))\t\(at($L; $k) | tojson)\t\($gv | tojson)" else empty end))' \
      2>/dev/null > "$out.lines" || { rm -f "$out.lines" "$out.empty"; return 1; }
    rm -f "$out.empty"
  elif command -v node >/dev/null 2>&1; then
    # shellcheck disable=SC2016  # JavaScript, not shell expansions
    GETFF_P="$proj" GETFF_L="$loc" GETFF_G="$data" node -e '
      const fs = require("fs");
      const read = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {}) || {};
      const P = read(process.env.GETFF_P), L = read(process.env.GETFF_L), G = read(process.env.GETFF_G);
      const at = (o, path) => path.reduce((v, k) => (v !== null && typeof v === "object" && !Array.isArray(v) && k in v ? v[k] : null), o);
      const leaves = (o, pre = []) => Object.entries(o).flatMap(([k, v]) =>
        v !== null && typeof v === "object" && !Array.isArray(v) ? leaves(v, [...pre, k]) : Array.isArray(v) ? [] : [[...pre, k]]);
      const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      const W = JSON.parse(JSON.stringify(G)), lines = [];
      for (const k of leaves(G)) {
        const gv = at(G, k), pv = at(P, k), lv = at(L, k);
        if (pv !== null) {
          delete at(W, k.slice(0, -1))[k[k.length - 1]];
          if (!same(pv, gv)) lines.push([".claude/settings.json", k.join("."), JSON.stringify(pv), JSON.stringify(gv)].join("\t"));
        } else if (lv !== null && !same(lv, gv)) {
          lines.push([".claude/settings.local.json", k.join("."), JSON.stringify(lv), JSON.stringify(gv)].join("\t"));
        }
      }
      console.log("WRITE\t" + JSON.stringify(W));
      for (const l of lines) console.log(l);' 2>/dev/null > "$out.lines" || { rm -f "$out.lines"; return 1; }
  else
    return 1
  fi
  grep '^WRITE' "$out.lines" | cut -f2- > "$out"
  grep -v '^WRITE' "$out.lines" || true
  rm -f "$out.lines"
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
    echo "  · session settings not applied (not chosen in the pre-launch list): auto-compact window, agent teams, the handoff gate, getff's generic safety permissions"
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
  local own="" lines _file _key _theirs _ours
  own=$(mktemp "${TMPDIR:-/tmp}/getff-session.XXXXXX") || own=""
  if [ -z "$own" ] || ! lines=$(_session_settings_theirs "$root" "$data" "$own"); then
    [ -n "$own" ] && rm -f "$own"
    note_not_wired "session settings in $rel — the project's .claude/settings.json or $rel is not valid JSON (or neither jq nor node is on PATH), so getff could not tell which values the project already sets and wrote none"
    return 0
  fi
  while IFS=$'\t' read -r _file _key _theirs _ours; do
    [ -n "$_key" ] || continue
    echo "  ⊝ $_key: the project's own value $_theirs in $_file is kept (getff's: $_ours)"
    note_kept_value "$_file: $_key = $_theirs kept (getff's: $_ours)"
  done <<<"$lines"
  if [ -f "$f" ]; then
    if ! snap=$(keep_original_snapshot "$f"); then
      rm -f "$own"
      note_not_wired "session settings in $rel — its original could not be copied aside, so it was left as it was"
      return 0
    fi
  fi
  if ! _session_settings_merge "$f" "$own"; then
    rm -f "$own"
    [ -n "$snap" ] && rm -f "$snap"
    note_not_wired "session settings in $rel — it is not a valid JSON object or could not be written, so it was left as it was"
    return 0
  fi
  rm -f "$own"
  if [ -n "$snap" ]; then
    # keep_original_settle echoes where the original went only when the write changed the file;
    # rc 1 means the change was undone because the original could not be kept.
    if ! kept=$(keep_original_settle "$f" "$snap"); then
      note_not_wired "session settings in $rel — its original could not be kept, so getff's change was undone"
      return 0
    fi
    [ -n "$kept" ] && note_getff_added "$rel"
  else
    if [ ! -e "$root/.ai-factory/before-getff/.claude/$(basename "$rel").absent" ]; then
      mkdir -p "$root/.ai-factory/before-getff/.claude" 2>/dev/null \
        && : > "$root/.ai-factory/before-getff/.claude/$(basename "$rel").absent"
    fi
    # This run created the file: hand it to this run's formatter (P5's format_getff_writes reads
    # KEPT_ORIGINALS), so the `.absent` record — which never expires — does not reformat a later
    # hand edit. Guarded: keep_original_mark lives in P5's lib.sh, not on every branch.
    if declare -F keep_original_mark >/dev/null; then keep_original_mark "$f"; fi
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
