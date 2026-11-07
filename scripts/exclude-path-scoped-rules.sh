#!/usr/bin/env bash
# exclude-path-scoped-rules.sh — list every path-scoped rule of a getff checkout in
# `claudeMdExcludes`, so Claude Code stops loading the whole rule text on read and the rule
# loader (`.claude/hooks/inject-matching-rule.sh`) delivers its summary on edit instead.
#
# Trigger build, slice 2 (design D22; spec S-6/S-7). One logic, two callers:
#   - scripts/rule-load-replay.sh writes the list into a THROWAWAY clone's
#     `.claude/settings.local.json` (the before/after measurement, S-7);
#   - the operator's slice-2 script writes it into getff's own `.claude/settings.json`
#     (the real switch, D29 — agents cannot write that file).
#
# A rule is path-scoped when its frontmatter (the first `---` block) carries a `paths:` key;
# prose that mentions `paths:` does not count. Entries use the `**/<basename>` shape, the only
# glob shape principle 31 resolves (`resolveExcludeEntry`). Existing entries are kept, the
# result is de-duplicated and sorted, so a second run changes nothing.
#
# Usage: exclude-path-scoped-rules.sh <repo-root> [settings-file]
#   settings-file defaults to <repo-root>/.claude/settings.json; a missing file is created as {}.
# Exit: 0 written; 2 bad arguments or invalid JSON; 3 no path-scoped rule found.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
command -v jq >/dev/null 2>&1 || { echo "exclude-path-scoped-rules: jq not found" >&2; exit 2; }

ROOT="${1:-}"
if [ -z "$ROOT" ] || [ ! -d "$ROOT/.claude/rules" ]; then
  echo "usage: exclude-path-scoped-rules.sh <repo-root> [settings-file]" >&2; exit 2; fi
SETTINGS="${2:-$ROOT/.claude/settings.json}"
[ -f "$SETTINGS" ] || printf '{}\n' > "$SETTINGS"
jq -e 'type == "object"' "$SETTINGS" >/dev/null 2>&1 || {
  echo "exclude-path-scoped-rules: $SETTINGS is not a JSON object" >&2; exit 2; }

names=()
for f in "$ROOT"/.claude/rules/*.md; do
  [ -f "$f" ] || continue
  if awk 'NR == 1 { if ($0 !~ /^---[[:space:]]*$/) exit 1; next }
          /^---[[:space:]]*$/ { exit 1 }
          /^paths:/ { found = 1; exit 0 }
          END { exit !found }' "$f"; then
    names+=("**/$(basename "$f")")
  fi
done
[ "${#names[@]}" -gt 0 ] || {
  echo "exclude-path-scoped-rules: no path-scoped rule under $ROOT/.claude/rules" >&2; exit 3; }

add="$(printf '%s\n' "${names[@]}" | jq -R . | jq -s .)"
tmp="$(mktemp "${SETTINGS}.XXXXXX")"
jq --argjson add "$add" '.claudeMdExcludes = (((.claudeMdExcludes // []) + $add) | unique)' \
  "$SETTINGS" > "$tmp"
mv "$tmp" "$SETTINGS"
echo "exclude-path-scoped-rules: ${#names[@]} path-scoped rules; claudeMdExcludes in $SETTINGS now lists $(jq '.claudeMdExcludes | length' "$SETTINGS") entries"
