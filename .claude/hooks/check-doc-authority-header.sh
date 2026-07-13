#!/usr/bin/env bash
# @cc-only-rationale: edit-time PostToolUse gate — the consumer-shippable, zero-dep reimplementation
#   of the framework-internal check-doc-authority.sh (which delegates to tsx + packages/core and is a
#   DEAD no-op in every consumer). No portable hook fires at edit-time; the portable enforcement of the
#   same rule is principle 09's CI test (rule+test lifecycle, excluded from @dual-pair per
#   dual-implementation-discipline.md §9). GH #934 per-hook audit follow-up.
#
# What it checks: a consumer-authored doc-authority-bearing doc must declare its scope with a
#   `> **Authoritative for:**` header (see .claude/rules/doc-authority-hierarchy.md §3). Scope is the
#   two surfaces a consumer plausibly authors: `.claude/rules/*.md` and `.claude/skills/*/SKILL.md`.
#
# Posture (GH #934 maintainer decision — default-on gate): a scoped doc missing the header gets exit 2
#   (PostToolUse blocking feedback → the model adds the header). Two escape valves, both leaving a
#   recorded choice rather than a silent bypass:
#     - repo-wide opt-out:  export AIF_DOC_AUTHORITY=0
#     - per-file exemption: a line `<!-- doc-authority: exempt <reason 20+ chars> -->` in the doc
#
# Input: PostToolUse hook JSON via stdin (.tool_input.file_path). Non-scoped paths exit 0 silently.
# Consumer-safe: pure bash + jq, no framework-internal dependency; degrades to exit 0 when jq is absent.
set -uo pipefail

# ── Repo-wide opt-out ─────────────────────────────────────────────────────────
[[ "${AIF_DOC_AUTHORITY:-1}" == "0" ]] && exit 0

# ── Dependency guard: no jq → degrade to a silent no-op (never error-spam) ─────
command -v jq >/dev/null 2>&1 || exit 0

ABS_PATH="$(cat | jq -r '.tool_input.file_path // ""' 2>/dev/null || true)"
[[ -z "$ABS_PATH" ]] && exit 0

# ── Repo-root-relative path (scope patterns are repo-relative) ────────────────
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
REL_PATH="${ABS_PATH#"$PROJECT_DIR/"}"

# ── Scope: consumer-authored .claude/rules/*.md OR .claude/skills/*/SKILL.md ───
# Flat rules dir + single-level skill dir (mirrors principle 09 REQUIRED_PATH_PATTERNS core).
if [[ ! "$REL_PATH" =~ ^\.claude/rules/[^/]+\.md$ ]] \
   && [[ ! "$REL_PATH" =~ ^\.claude/skills/[^/]+/SKILL\.md$ ]]; then
  exit 0
fi

[[ -f "$ABS_PATH" ]] || exit 0   # file gone (e.g. rename/delete) — nothing to check

CONTENT="$(cat "$ABS_PATH" 2>/dev/null || true)"

# ── Per-file exemption escape hatch (rationale ≥20 chars, single-line HTML comment) ─
if printf '%s\n' "$CONTENT" | grep -qE '<!--[[:space:]]*doc-authority:[[:space:]]*exempt[[:space:]]+.{20,}-->'; then
  exit 0
fi

# ── Header check: strip fenced code blocks first (an example header inside ``` ─
#    must not count), then look for the load-bearing `> **Authoritative for:**` line.
#    Line-based toggle on ``` fences — handles the real-doc case (balanced fences, header at top).
#    A stray *unbalanced* fence could over-strip vs the TS `stripFencedCodeBlocks` regex, but real
#    authority headers sit above any code block, so this bound is not reachable in practice.
STRIPPED="$(printf '%s\n' "$CONTENT" | awk '/^```/{f=!f; next} !f')"
if printf '%s\n' "$STRIPPED" | grep -qE '^> \*\*Authoritative for:\*\*'; then
  exit 0
fi

# ── Missing header → gate (exit 2 feeds stderr back to the model) ─────────────
{
  printf '✗ doc-authority: %s is missing the "> **Authoritative for:**" header.\n' "$REL_PATH"
  printf '  Add it (see .claude/rules/doc-authority-hierarchy.md §3), OR exempt this file with a\n'
  printf '  <!-- doc-authority: exempt <reason 20+ chars> --> line, OR set AIF_DOC_AUTHORITY=0 to disable.\n'
} >&2
exit 2
