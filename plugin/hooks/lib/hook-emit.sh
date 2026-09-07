#!/usr/bin/env bash
# Shared PostToolUse emit prelude for the framework's edit-time gates.
#
# @cc-only-rationale: this is the emit half of CC's PostToolUse output contract — the
#   hookSpecificOutput/additionalContext envelope and the exit-2 stderr channel are CC
#   primitives with no portable equivalent that fires at edit time. It is a prelude for
#   CC hooks, not a capability of its own, so it inherits their channel by construction.
#
# Why this file exists (#1597 review ledger R-2): five PostToolUse gates each carried a
# private 13-line copy of _is_zcode/_json_escape/_emit_skip, and the copies had already
# started to diverge — runtime-bridge-dispatch's variant lost its _is_zcode branch and so
# emitted the CC envelope to ZCode, and every sed-based escaper produced INVALID JSON for a
# message containing a tab or a CR. One definition, one behaviour.
#
# Sourced, not inlined: both channels that carry these gates carry this file as a sibling —
# the framework repo at .claude/hooks/lib/ and the marketplace plugin at plugin/hooks/lib/
# (the plugin ships the directory whole). Hooks the INSTALLER copies one-by-one to a
# consumer — .claude/hooks/check-doc-authority-header.sh, and the vendored
# runtime-bridge-dispatch.sh dropped by setup.d/55-runtime-bridge-vendor.sh — deliberately
# keep their inline copies: a lone file cannot source a sibling that was never delivered.
#
# Contract for callers: source this BEFORE first use, set SESSION_ID (from the hook payload)
# if _emit_skip_once is used, and keep every message a constant or a locally-built string.

# ── Homebrew PATH (CLAUDE.md §Harness gates, #1597 review ledger K-1) ──────────
# CC-launched hooks inherit a stripped PATH with no Homebrew directories, so a
# Homebrew-only jq/node/tsx reads as ABSENT and the gate degrades to a skip nobody asked
# for. Only existing directories are prepended, and only once: a sandbox test that hides a
# tool by rebuilding PATH must stay hidden, so this must never resurrect a path the caller
# deliberately removed on a host where the tool lives elsewhere.
for _hb_dir in /opt/homebrew/bin /usr/local/bin; do
  if [ -d "$_hb_dir" ]; then
    case ":$PATH:" in
      *":$_hb_dir:"*) ;;
      *) PATH="$_hb_dir:$PATH" ;;
    esac
  fi
done
unset _hb_dir
export PATH

# ── Harness detection ─────────────────────────────────────────────────────────
# Capability/env presence, never a brand-name comparison
# (.claude/rules/dual-implementation-discipline.md §4).
_is_zcode() { [ -n "${ZCODE_PROJECT_DIR:-}" ]; }

# ── JSON escaping WITHOUT jq ──────────────────────────────────────────────────
# jq is precisely the dependency that may be missing on the paths that call this, so the
# escaper cannot use it. Backslash and quote are escaped; newline, CR and TAB collapse to a
# space; any remaining C0 control byte is dropped. The pre-R-2 copies handled only backslash,
# quote and newline, so a message carrying a tab or a CR emitted a raw control character
# inside a JSON string — invalid JSON (jq exit 5), i.e. a notice the harness discards.
_json_escape() {
  printf '%s' "$1" \
    | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' \
    | tr '\n\r\t' '   ' \
    | tr -d '\000-\037'
}

# ── Skip notice on the channel the model actually receives ────────────────────
# On an exit-0 PostToolUse the model receives ONLY JSON hookSpecificOutput — plain
# stdout/stderr reaches nobody (inject-matching-rule.sh, the proven channel). A skip
# announced on stderr alone is therefore indistinguishable from a pass. stderr is kept too,
# for terminal and CI readers.
_emit_skip() {
  if _is_zcode; then
    printf '{"additionalContext":"%s"}\n' "$(_json_escape "$1")"
  else
    printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"%s"}}\n' \
      "$(_json_escape "$1")"
  fi
  printf '%s\n' "$1" >&2
}

# ── Bounded variant: announce at most once per session ────────────────────────
# For a dependency whose absence is STRUCTURAL rather than transient — a gate that can never
# resolve on this layout would otherwise nag on every single edit for the whole session (the
# permanent-loud-skip defect, #1597 review ledger A3-6). Usage: _emit_skip_once <tag> <msg>.
# Precedent: .claude/hooks/check-doc-authority-header.sh (jq guard, GH #934).
#
# With no SESSION_ID it announces EVERY time: suppression needs a session to scope to, and
# without one the choice is between a shared global key — which silences unrelated later runs
# after the first — and repeating. Repeating is the safe direction; silence is the failure
# mode this whole family exists to fix.
_emit_skip_once() {
  [ -z "${SESSION_ID:-}" ] && { _emit_skip "$2"; return 0; }
  local flag="${TMPDIR:-/tmp}/aif-$1-${SESSION_ID}"
  [ -f "$flag" ] && return 0
  : > "$flag" 2>/dev/null || true
  _emit_skip "$2"
}

# ── Violation context (ZCode) ─────────────────────────────────────────────────
# ZCode swallows a plain non-zero exit, so a violation reaches the model only as JSON
# additionalContext. Usage: _emit_ctx <event> <message>.
_emit_ctx() {
  if _is_zcode && command -v jq >/dev/null 2>&1; then
    jq -n --arg c "$2" '{additionalContext:$c}'
  else
    printf '%s\n' "$2"
  fi
}
