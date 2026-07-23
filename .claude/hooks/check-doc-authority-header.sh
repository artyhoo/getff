#!/usr/bin/env bash
# @cc-only-rationale: edit-time PostToolUse gate — the consumer-shippable, zero-dep reimplementation
#   of the framework-internal check-doc-authority.sh (which delegates to tsx + packages/core and is a
#   DEAD no-op in every consumer). No portable hook fires at edit-time; the portable enforcement of the
#   same rule is principle 09's CI test (rule+test lifecycle, excluded from @dual-pair per
#   dual-implementation-discipline.md §9). GH #934 per-hook audit follow-up.
# @file-content-gate: this hook validates a file's content (path-only — no internal
#   tool_name filter), so its registration matcher MUST be Edit|Write|MultiEdit (else a
#   MultiEdit that strips an authority header slips past silently). Enforced by check-hook-marker.sh.
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
# Consumer-safe: pure bash + jq, no framework-internal dependency; degrades LOUDLY (scoped
# JSON skip-notice) when jq is absent — a silent skip is indistinguishable from a pass, the
# exact defect class this gate exists to prevent (aif-parity S4 §3 item 1, 2026-07-23).
set -uo pipefail

# ── Repo-wide opt-out ─────────────────────────────────────────────────────────
[[ "${AIF_DOC_AUTHORITY:-1}" == "0" ]] && exit 0

# ── Dependency guard: no jq → LOUD skip, scoped to this gate's own paths ──────
# jq-less best-effort path extraction (sed on raw stdin) — used only to decide whether the
# edit is in scope, so consumers without jq (stock macOS) hear about the dead gate exactly
# when editing a doc it should have checked, not on every Edit/Write.
_json_escape() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | tr '\n' ' '; }
if ! command -v jq >/dev/null 2>&1; then
  _RAW_PATH="$(sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
  case "$_RAW_PATH" in
    *.claude/rules/*.md | *.claude/skills/*/SKILL.md | "")
      _MSG='⚠ doc-authority-header: jq unavailable — the authority-header check DID NOT RUN for this edit. This is a SKIP, not a pass; install jq to restore enforcement.'
      if [ -n "${ZCODE_PROJECT_DIR:-}" ]; then
        printf '{"additionalContext":"%s"}\n' "$(_json_escape "$_MSG")"
      else
        printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"%s"}}\n' \
          "$(_json_escape "$_MSG")"
      fi
      printf '%s\n' "$_MSG" >&2 ;;
  esac
  exit 0
fi

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

# ── Missing header → gate ─────────────────────────────────────────────────────
# Under CC: exit 2 feeds stderr back to the model as PostToolUse blocking feedback (the model
#   sees the diagnostic and adds the header).
# Under ZCode: PostToolUse is schema-bound to `additionalContext` only (CCt.strict @ zcode.cjs:
#   ~577900 rejects unknown top-level keys; exit 2 is swallowed as HookRunFailed, stderr never
#   reaches the model — verified via bundle inspection 2026-07-18, lRt @ zcode.cjs:541 +
#   b_n() excludes PostToolUse from preventContinuation). So under ZCode we emit the diagnostic
#   as schema-valid `{additionalContext}` JSON and exit 0 — advisory, not blocking. Post-mutation
#   gates cannot block on ZCode by construction (the file is already changed), so advisory is the
#   best available mechanism; the JSON shape at least surfaces the violation to the model rather
#   than silently discarding it.
_msg="$(printf '✗ doc-authority: %s is missing the "> **Authoritative for:**" header.\n' "$REL_PATH")
  Add it (see .claude/rules/doc-authority-hierarchy.md §3), OR exempt this file with a
  <!-- doc-authority: exempt <reason 20+ chars> --> line, OR set AIF_DOC_AUTHORITY=0 to disable."
if [ -n "${ZCODE_PROJECT_DIR:-}" ] && command -v jq >/dev/null 2>&1; then
  jq -n --arg c "$_msg" '{additionalContext:$c}'
  exit 0
fi
printf '%s\n' "$_msg" >&2
exit 2
