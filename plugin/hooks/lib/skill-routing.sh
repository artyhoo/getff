#!/usr/bin/env bash
# skill-routing.sh — keep colliding satellite skills out of the model's routing.
#
# Some skills in plugins getff does not own cover an area another skill owns. The model picks them
# from their description and follows the wrong procedure. This script adds
# `disable-model-invocation: true` to their SKILL.md frontmatter: the description leaves the
# model's context, while the user can still run the skill by typing /<name>.
#
#   mattpocock-skills:tdd                        — superpowers:test-driven-development owns the TDD loop
#   mattpocock-skills:resolving-merge-conflicts  — its rebase advice dead-ends (agents cannot
#                                                  force-push); merge-forward owns conflicts
#
# Why the frontmatter, not settings: CC's `skillOverrides` setting does not apply to plugin skills.
# Rung 2 of the ladder in docs/superpowers/specs/2026-08-18-skill-stack-harmonization-design.md
# §5.1 (bindings → frontmatter → prune → vendor); decision record: prior-art-evaluations.md #253.
#
# A plugin update rewrites the plugin cache and drops the stamp. So consent is recorded once (a
# marker file) and the getff plugin's session-start hook runs `reapply` on every session start.
#
# Usage:
#   skill-routing.sh apply [--dry-run]   stamp every installed target; record consent
#   skill-routing.sh reapply             stamp again only if consent was recorded (plugin hook path)
#   skill-routing.sh status              exit 1 if an installed target is not stamped
#   skill-routing.sh count-unrouted      print how many installed targets are not stamped
#   skill-routing.sh install <mode>      ./setup's consent step (interactive | yes | all | dry-run)
#
# Environment:
#   CLAUDE_CONFIG_DIR    Claude Code config dir (default ~/.claude)
#   XDG_CONFIG_HOME      consent marker lives at ${XDG_CONFIG_HOME:-~/.config}/getff/skill-routing
#   GETFF_SKILL_ROUTING  =off disables reapply (opt out without deleting the marker)
#
# To undo: delete the marker and reinstall the plugin (`claude plugin uninstall` + `install`).
#
# Two copies, byte-identical: setup.d/skill-routing.sh (source; the installer runs it) and
# plugin/hooks/lib/skill-routing.sh (the plugin payload ships only plugin/). Enforced by
# tests/plugin/skill-routing.test.sh.
# @cc-only-rationale: `disable-model-invocation` and the plugin cache layout are Claude Code
#   primitives; other harnesses have neither, so the script finds no target there and exits 0.
set -uo pipefail

# plugin<TAB>skill — one target per line.
TARGETS='mattpocock-skills	tdd
mattpocock-skills	resolving-merge-conflicts'

CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
MARKER="${XDG_CONFIG_HOME:-$HOME/.config}/getff/skill-routing"
FLAG='disable-model-invocation: true'

# The three parsers below run under LC_ALL=C (byte semantics for the BOM strip) and read each
# line through norm(): a trailing CR is dropped and a UTF-8 BOM is skipped on line 1, so a CRLF
# or BOM-prefixed SKILL.md parses the same as a plain one.
BOM=$(printf '\357\273\277')
NORM='function norm(s) { sub(/\r$/, "", s); if (NR == 1 && index(s, bom) == 1) s = substr(s, 4); return s }
function val(s) { sub(/^[^:]*:[ \t]*/, "", s); sub(/[ \t]+#.*$/, "", s); gsub(/["\047]/, "", s); sub(/[ \t]+$/, "", s); return s }'

# _fm_name <file> — the frontmatter `name:` value, or empty when the file has no frontmatter.
_fm_name() {
  LC_ALL=C awk -v bom="$BOM" "$NORM"'
    { l = norm($0) }
    NR == 1 && l != "---" { exit }
    NR == 1 { next }
    l == "---" { exit }
    l ~ /^name:/ { print val(l); exit }
  ' "$1"
}

# _is_stamped <file> — rc 0 only when a CLOSED frontmatter carries the flag set to true (the last
# occurrence wins). An unclosed frontmatter is never "stamped": that would be a false GREEN.
_is_stamped() {
  LC_ALL=C awk -v bom="$BOM" "$NORM"'
    { l = norm($0) }
    NR == 1 && l != "---" { exit }
    NR == 1 { next }
    l == "---" { closed = 1; exit }
    l ~ /^disable-model-invocation:/ { on = (val(l) == "true") }
    END { exit (closed && on) ? 0 : 1 }
  ' "$1"
}

# _stamp <file> — drop any disable-model-invocation line from the frontmatter, then add the flag
# right before the closing --- (with that line's own line ending). The body after the frontmatter
# is copied unchanged. Refuses a file with no closed frontmatter or one it cannot write. The new
# content goes to a temp file in the same directory (mode copied) and replaces the original by
# rename, so a concurrent reader or a second session start never sees a truncated SKILL.md.
_stamp() {
  local f="$1" tmp rc
  [ -w "$f" ] || return 1
  tmp=$(mktemp "$(dirname "$f")/.SKILL.md.XXXXXX") || return 1
  cp -p "$f" "$tmp" && LC_ALL=C awk -v bom="$BOM" -v flag="$FLAG" "$NORM"'
    { l = norm($0) }
    NR == 1 && l != "---" { exit }
    NR == 1 { print; fm = 1; next }
    fm && l == "---" { print flag (($0 ~ /\r$/) ? "\r" : ""); print; fm = 0; closed = 1; next }
    fm && l ~ /^disable-model-invocation:/ { next }
    { print }
    END { exit closed ? 0 : 1 }
  ' "$f" > "$tmp" && mv -f "$tmp" "$f"
  rc=$?
  rm -f "$tmp"
  return $rc
}

# _each_target <callback> — call <callback> <plugin> <skill> <file> for every installed copy.
_each_target() {
  local cb="$1" plugin skill dir f
  [ -d "$CLAUDE_DIR/plugins/cache" ] || return 0
  while IFS='	' read -r plugin skill; do
    [ -n "$plugin" ] || continue
    for dir in "$CLAUDE_DIR"/plugins/cache/*/"$plugin"/*/; do
      [ -d "$dir" ] || continue
      while IFS= read -r f; do
        [ "$(_fm_name "$f")" = "$skill" ] && "$cb" "$plugin" "$skill" "$f"
      done < <(find "$dir" -name SKILL.md -type f -exec grep -lE "^name:[[:space:]]*[\"']?$skill([\"'[:space:]#]|\$)" {} + 2>/dev/null)
    done
  done <<EOF
$TARGETS
EOF
}

FOUND=0; UNROUTED=0; ROUTED=0; FAILED=0; DRY=""
_visit() {
  FOUND=$((FOUND + 1))
  _is_stamped "$3" && return 0
  UNROUTED=$((UNROUTED + 1))
  if [ -n "$DRY" ]; then
    printf '  [dry-run] would route %s:%s out of model invocation (%s)\n' "$1" "$2" "$3"
  elif _stamp "$3"; then
    ROUTED=$((ROUTED + 1))
    printf '  ✓ routed %s:%s out of model invocation — /%s still works (%s)\n' "$1" "$2" "$2" "$3"
  else
    FAILED=$((FAILED + 1))
    printf '  ⚠ could not stamp %s:%s (%s)\n' "$1" "$2" "$3"
  fi
}
_count() { FOUND=$((FOUND + 1)); _is_stamped "$3" || UNROUTED=$((UNROUTED + 1)); }

cmd="${1:-status}"; shift || true
[ "${1:-}" = "--dry-run" ] && DRY=1

case "$cmd" in
  apply)
    _each_target _visit
    if [ "$FOUND" -eq 0 ]; then
      echo "  ⊝ no colliding satellite skill installed — nothing to route"
      exit 0
    fi
    [ "$UNROUTED" -eq 0 ] && echo "  ⊝ skill routing already applied ($FOUND copies)"
    if [ -z "$DRY" ]; then
      mkdir -p "$(dirname "$MARKER")" && echo on > "$MARKER"
    fi
    [ "$FAILED" -eq 0 ]
    ;;
  reapply)
    [ "${GETFF_SKILL_ROUTING:-}" = "off" ] && exit 0
    [ -f "$MARKER" ] || exit 0
    _each_target _visit
    exit 0
    ;;
  status)
    _each_target _count
    [ "$UNROUTED" -eq 0 ]
    ;;
  count-unrouted)
    _each_target _count
    echo "$UNROUTED"
    ;;
  install)
    # ./setup's step. $1 = setup mode: interactive | yes | all | dry-run. The plugin cache is
    # user-scope, so this follows the companion consent rule (setup.d/engine.sh): -y needs
    # --global (GETFF_GLOBAL=1). rc 3 = skipped for lack of --global (setup records the gap).
    mode="${1:-interactive}"
    _each_target _count
    if [ "$UNROUTED" -eq 0 ]; then
      echo "  ⊝ no unrouted colliding skill installed — nothing to do"
      exit 0
    fi
    case "$mode" in
      dry-run) exec bash "$0" apply --dry-run ;;
      yes|all)
        if [ "${GETFF_GLOBAL:-}" != "1" ]; then
          echo "  ⊝ skill routing skipped — it edits user-scope plugin files (all projects on this machine)"
          exit 3
        fi
        exec bash "$0" apply
        ;;
      *)
        printf '  Make %s colliding satellite skill(s) user-invoked only (/name), machine-wide? [y/N]: ' "$UNROUTED"
        read -r ans || ans=""
        case "$ans" in
          [yY]|[yY][eE][sS]) exec bash "$0" apply ;;
          *) echo "  ⊝ skill routing skipped"; exit 0 ;;
        esac
        ;;
    esac
    ;;
  *)
    echo "usage: skill-routing.sh apply [--dry-run] | reapply | status | count-unrouted | install <mode>" >&2
    exit 2
    ;;
esac
