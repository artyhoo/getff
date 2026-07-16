#!/usr/bin/env bash
# @cc-only-rationale: CC-specific PostToolUse hook — fires at edit-time (a CC-native moment) on
#   consumer-authored docs, with no portable fire-point. SHIPPED to consumer CC projects (GH #934
#   per-hook audit batch C): a ZERO-DEP standalone port of the maintainer-only check-doc-authority.sh
#   (which delegates to a tsx bin + the framework-specific REQUIRED_HEADER_DOCS list a consumer lacks →
#   it would be a dead no-op in a consumer). Scoped to the surface the shipped /ai-doc skill teaches
#   consumers to author (rules/skills/agents), NOT their README/CLAUDE (that authority-header
#   requirement is a framework-internal convention). Consumer-safe: pure bash + grep + awk (no tsx, no
#   node, no framework-internal artefact); non-blocking (exit 1 surfaces to the user, mirrors the
#   framework's own edit-time hook — never exit 2, never blocks the edit); degrades to exit 0 without jq.
#
# What it checks: a doc on the policy surface must carry a `> **Authoritative for:**` line
# (fenced code blocks are stripped first so a documented example does not count). See the
# /ai-doc skill for the full authority-header convention.
set -uo pipefail

command -v jq >/dev/null 2>&1 || exit 0   # graceful no-op without jq

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
INPUT="$(cat)"
TOOL="$(printf '%s' "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || true)"
ABS_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null || true)"

case "$TOOL" in Edit|Write|MultiEdit) ;; *) exit 0 ;; esac
[ -z "$ABS_PATH" ] && exit 0

REL_PATH="${ABS_PATH#"$REPO_ROOT/"}"
[ "$REL_PATH" = "$ABS_PATH" ] && exit 0   # outside repo — skip

# Consumer doc-authority policy: the exact surface the shipped /ai-doc skill teaches consumers to
# author (mirrors the DYNAMIC REQUIRED_PATH_PATTERNS of principle 09 at CONSUMER paths — the static
# framework doc list is intentionally NOT ported). Precise segment boundaries via bash regex.
matched=0
for _re in \
  '^\.claude/rules/[^/]+\.md$' \
  '^\.claude/agents/[^/]+\.md$' \
  '^\.claude/skills/[^/]+/SKILL\.md$' \
  '^\.claude/skills/[^/]+/references/[^/]+\.md$'; do
  if [[ "$REL_PATH" =~ $_re ]]; then matched=1; break; fi
done
[ "$matched" -eq 0 ] && exit 0   # not a policy-covered doc — nothing to check

[ -f "$ABS_PATH" ] || exit 0   # file gone — nothing to check

# Strip fenced code blocks (```…```), then require the authority header on its own line.
_body="$(awk 'BEGIN{f=0} /^```/{f=!f; next} !f{print}' "$ABS_PATH" 2>/dev/null || true)"
if printf '%s\n' "$_body" | grep -qE '^> \*\*Authoritative for:\*\*'; then
  exit 0   # header present — compliant
fi

printf 'FAIL  %s: missing "> **Authoritative for:**" header — see the /ai-doc skill (doc-authority convention)\n' "$REL_PATH" >&2
exit 1
