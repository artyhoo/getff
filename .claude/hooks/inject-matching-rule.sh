#!/usr/bin/env bash
# PostToolUse rule-injector — path-scoped just-in-time delivery of .claude/rules/*.md.
# @dual-pair: rule-path-scoping
#   Two channels deliver path-scoped rules at the same scope: CC-native `paths:` frontmatter
#   (read-time, whole-rule) and this hook (edit-time, `inject:` summary). This hook is itself
#   CC-only (PostToolUse); the portable contract is the `globs:` HTML-comment marker it reads —
#   a non-CC harness can consume the same marker with its own injector. (Was @cc-only-rationale
#   pre-F1; reframed 2026-06-01 — the rule's `paths:` is the native sibling channel, SSOT #101.)
# spec: .claude/rules/rule-enforcement-channel-selection.md §4 (the dual-pair note + ADAPT mechanism)
#
# Mechanism: on Edit|Write, for each .claude/rules/*.md carrying a `<!-- globs: ... -->`
# marker whose pattern matches the edited path, inject that rule's `<!-- inject: ... -->`
# summary (fallback: title) as PostToolUse additionalContext — ONCE per session
# (session-cache). Non-blocking injection (exit 0 + JSON), never a gate.
#
# Output contract (verified 2026-05-22, code.claude.com/docs/en/hooks.md):
#   plain stdout is IGNORED for PostToolUse; context must be JSON additionalContext.
#
# Glob subset (deterministic, no glob engine): `prefix/**` (path starts with prefix/),
# `*.ext` (path ends with .ext), or an exact repo-relative path.
#
# SHIP status (GH #934): NOW SHIPPED to consumer CC projects — consumers DO get .claude/rules/*
# installed, and without this hook that rules channel is cold-load only. Consumer-safe: the only
# runtime path is the consumer's own $RULES_DIR (no framework-internal artefact), and it degrades
# to exit 0 when the rules dir or jq is absent. Delivered by install.sh + do_refresh (setup.d).
set -uo pipefail

# @plugin-transform: manual — plugin twin carries T-PLUG-A relocation comment block (~30 lines of prose documenting plugin-channel path resolution). Not mechanically transformable; semantic prose divergence stays hand-maintained.
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RULES_DIR="$REPO_ROOT/.claude/rules"

command -v jq >/dev/null 2>&1 || exit 0   # graceful no-op without jq

INPUT="$(cat)"
TOOL="$(printf '%s' "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || true)"
ABS_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null || true)"
SESSION="$(printf '%s' "$INPUT" | jq -r '.session_id // "nosession"' 2>/dev/null || true)"

case "$TOOL" in Edit|Write|MultiEdit) ;; *) exit 0 ;; esac
[[ -z "$ABS_PATH" ]] && exit 0
[[ -d "$RULES_DIR" ]] || exit 0

REL_PATH="${ABS_PATH#"$REPO_ROOT/"}"
[[ "$REL_PATH" = "$ABS_PATH" ]] && exit 0   # outside repo — skip

CACHE="${TMPDIR:-/tmp}/cc-rule-injector-${SESSION//[^A-Za-z0-9_-]/_}.txt"
touch "$CACHE" 2>/dev/null || CACHE=""

# Match REL_PATH against one glob pattern from the supported subset. Returns 0 on match.
glob_match() {
  local path="$1" pat="$2"
  case "$pat" in
    */\*\*)  [[ "$path" == "${pat%\*\*}"* ]] ;;   # prefix/**  -> starts with prefix/
    \*.*)    [[ "$path" == *"${pat#\*}" ]] ;;      # *.ext      -> ends with .ext
    *)       [[ "$path" == "$pat" ]] ;;            # exact
  esac
}

INJECTED=""
for rule in "$RULES_DIR"/*.md; do
  [[ -f "$rule" ]] || continue
  # Marker MUST be on its own line (anchored ^) so prose that documents the syntax
  # (e.g. `<!-- globs: … -->` inside backticks mid-paragraph) is not mis-detected.
  globs_line="$(grep -m1 -oE '^[[:space:]]*<!--[[:space:]]*globs:.*-->' "$rule" 2>/dev/null || true)"
  [[ -z "$globs_line" ]] && continue
  patterns="$(printf '%s' "$globs_line" | sed -E 's/^[[:space:]]*<!--[[:space:]]*globs:[[:space:]]*//; s/[[:space:]]*-->[[:space:]]*$//')"

  matched=0
  IFS=',' read -ra pats <<< "$patterns"
  for p in "${pats[@]}"; do
    p="$(printf '%s' "$p" | xargs 2>/dev/null || printf '%s' "$p")"  # trim
    [[ -z "$p" ]] && continue
    if glob_match "$REL_PATH" "$p"; then matched=1; break; fi
  done
  [[ "$matched" -eq 0 ]] && continue

  slug="$(basename "$rule" .md)"
  if [[ -n "$CACHE" ]] && grep -qxF "$slug" "$CACHE" 2>/dev/null; then continue; fi  # once per session

  summary="$(grep -m1 -oE '^[[:space:]]*<!--[[:space:]]*inject:.*-->' "$rule" 2>/dev/null | sed -E 's/^[[:space:]]*<!--[[:space:]]*inject:[[:space:]]*//; s/[[:space:]]*-->[[:space:]]*$//' || true)"
  [[ -z "$summary" ]] && summary="$(grep -m1 -E '^# ' "$rule" | sed -E 's/^#[[:space:]]*//')"

  INJECTED="${INJECTED}📎 Path-relevant rule — ${summary} (see .claude/rules/${slug}.md)"$'\n'
  [[ -n "$CACHE" ]] && printf '%s\n' "$slug" >> "$CACHE"
done

[[ -z "$INJECTED" ]] && exit 0

jq -n --arg ctx "$INJECTED" \
  '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$ctx}}'
exit 0
