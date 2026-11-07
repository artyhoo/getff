#!/usr/bin/env bash
# plugin-source-hashes.sh — print the plugin's source-hash manifest for a repo root.
# Usage: bash scripts/plugin-source-hashes.sh <repo-root>   (stdout = plugin/hooks/lib/source-sha256.txt)
#
# One entry per plugin/hooks/<name> twin whose source .claude/hooks/<name>.sh exists: the source's
# hash, then one line per path declared on `# @plugin-yield-deps: <rel> ...`. A source that reaches
# files beside itself (a `.`/`source` statement, BASH_SOURCE, _HOOK_DIR) WITHOUT a declaration gets
# NO entry — the consumer copy then never silences the plugin copy (spec D2: safe by construction).
set -euo pipefail
export LC_ALL=C
ROOT="${1:?usage: plugin-source-hashes.sh <repo-root>}"
# shellcheck source=../plugin/hooks/lib/source-hash.sh
. "$(cd "$(dirname "$0")" && pwd)/../plugin/hooks/lib/source-hash.sh"
printf '' | getff_sha256 >/dev/null || { echo "plugin-source-hashes: no sha256sum or shasum" >&2; exit 2; }

# Widened in the unsafe direction (fix round 1, item 2): also catches dirname "$0" /
# dirname "${0}" / dirname $0 (a hook that only re-derives its OWN path this way is safe and
# should carry an EMPTY declaration instead — see below), and a `.`/`source` preceded by `(`
# as in `$(. file)`. A false positive here just costs a hook its manifest entry (safe fallback,
# per the file header above); it never lets an undeclared read slip through with a hash.
# The code lines go through a variable, not a pipe: under pipefail an early-exiting `grep -q`
# can SIGPIPE the producer and turn a match into a miss — the unsafe direction here.
reaches_beside() {
  local code
  code=$(grep -vE '^[[:space:]]*#' "$1") || return 1
  grep -qE '(^|[;&|([:space:]])(\.|source)[[:space:]]|BASH_SOURCE|_HOOK_DIR|dirname[[:space:]]+"?\$\{?0\}?"?' <<<"$code"
}

SOURCE_DIR="$ROOT/.agents/hooks"
[ -d "$SOURCE_DIR" ] || SOURCE_DIR="$ROOT/.claude/hooks"

for twin in "$ROOT"/plugin/hooks/*; do
  [ -f "$twin" ] || continue
  n=$(basename "$twin")
  src="$SOURCE_DIR/$n.sh"
  [ -f "$src" ] || continue
  # Marker presence is tested SEPARATELY from its list being empty (fix round 1, item 1): a
  # `# @plugin-yield-deps:` line with nothing after it means "reads nothing beside itself" —
  # main-line entry, reaches_beside is NOT consulted. No marker at all falls through to the
  # reaches_beside heuristic (safe-by-construction fallback: no entry when undeclared+risky).
  if grep -q '^# @plugin-yield-deps:' "$src"; then
    deps=$(sed -n 's/^# @plugin-yield-deps:[[:space:]]*//p' "$src" | head -n 1)
  else
    deps=""
    reaches_beside "$src" && continue
  fi
  printf '%s  %s\n' "$(getff_path_hash "$SOURCE_DIR" "$n.sh")" "$n.sh"
  for d in $deps; do
    h=$(getff_path_hash "$SOURCE_DIR" "$d") \
      || { echo "plugin-source-hashes: $n declares $d, which is not under .claude/hooks/" >&2; exit 2; }
    printf '%s  %s\n' "$h" "$n.sh:$d"
  done
done
