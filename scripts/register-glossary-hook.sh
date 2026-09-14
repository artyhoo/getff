#!/usr/bin/env bash
# Operator hand-off: register the D-F glossary UserPromptSubmit hook (spec:
# docs/superpowers/specs/2026-09-13-plain-words-recap-v2-design.md §D-F, hand-action D-E).
#
# WHAT "REGISTERING" IS: one hooks.UserPromptSubmit entry whose command names
# .claude/hooks/glossary-inject.sh. The hook ships DORMANT by construction — a UserPromptSubmit
# hook fires only when a settings file registers it — and the agent sessions may not write
# .claude/settings.json (umbrella §2 item 3: four refusing channels). Unregistered, it looks
# identical to a working one from inside the repo: green tests, clean parity, a file on disk —
# the WorktreeCreate shape, where a hook sat unregistered from the day it shipped. This script
# is the delivery, not a nicety.
#
# WHICH settings.json this writes — the USER file by default (the recap-gate precedent,
# scripts/register-recap-gate.sh): Claude Code merges user and project settings, and a desktop
# WORKTREE session's project settings are the worktree's own committed file, so the user file
# is the one registration every session on this machine reads. `--project` keeps a per-checkout
# registration, but its `hooks` key is RENDERED (render-harness-config.mjs owns it), so the
# --project arm goes through the SSOT + renderer --write — the sanctioned channel, the same
# split register-handoff-gate.sh makes (SSOT+render for `hooks`, guarded jq for what the
# renderer does not own). A direct jq patch of the rendered key would be dropped by the next
# renderer --write.
#
# WHY THE USER-FILE COMMAND BAKES AN ABSOLUTE PATH, not "$CLAUDE_PROJECT_DIR/...": the user
# file is read in EVERY repo on the machine, and a $CLAUDE_PROJECT_DIR-relative command exits
# 127 (hook-error noise) in every repo that does not carry the hook. The absolute path is
# inert elsewhere by the hook's own unarmed-tree guard (no CONTEXT.md at that project's root
# → exit 0 before anything is printed): the hook resolves the project it serves from
# CLAUDE_PROJECT_DIR at hook time, so worktrees of THIS repo each get their own tree's
# CONTEXT.md. Cost, stated: if this checkout is deleted or moved, the registration dangles —
# verify (b) below catches it; re-run this script from the new checkout.
#
# IDEMPOTENT: re-running is a no-op that still re-verifies. Refuses to touch a malformed
# settings.json (a broken settings.json silently disables ALL settings from that file).
# Self-verifying beyond read-back: verify (c) is a LIVE smoke of the registered command in a
# sandboxed residue dir + TMPDIR — the injected line is actually produced, nothing leaks into
# the real counters.
#
# USAGE — runs from ANY working directory, because the repo root is resolved from the
# script's own path (see the resolver below), not from `git rev-parse` of the cwd:
#     bash /path/to/repo/scripts/register-glossary-hook.sh            # registers ~/.claude/settings.json (default = --user)
#     bash scripts/register-glossary-hook.sh --project                # registers THIS checkout (SSOT + renderer channel)
#     bash /path/to/repo/scripts/register-glossary-hook.sh --project /other/checkout   # explicit root wins
#     bash /path/to/repo/scripts/register-glossary-hook.sh --print-root      # resolve the root and exit, writes nothing
#     bash /path/to/repo/scripts/register-glossary-hook.sh --print-target    # name the settings file the write would touch, exit
#     bash /path/to/repo/scripts/register-glossary-hook.sh --help            # print this usage, exit 0, writes nothing
# A symlink to this script works too. Covered by scripts/register-root-resolution.test.sh.
# AN AGENT SESSION RUNS THIS SCRIPT ONLY IN --print-root / --print-target / --help.

set -uo pipefail

# ── Repo root: resolved from the SCRIPT'S OWN LOCATION, so this runs from ANY cwd ─────
# Precedence: an explicit path argument → the checkout this script lives in → the git
# toplevel of the current directory (the historical behaviour, kept as the last resort).
# Self-location leads because the two disagree in exactly the case that matters: run from a
# DIFFERENT checkout or worktree of this project and `git rev-parse --show-toplevel` names
# THAT tree. The symlink loop is hand-rolled: macOS ships neither `readlink -f` nor GNU
# `realpath`.
PRINT_ROOT=0
PRINT_TARGET=0
HELP=0
TARGET='user'
ARG_ROOT=''
for _a in "$@"; do
  case "$_a" in
    --print-root) PRINT_ROOT=1 ;;
    --print-target) PRINT_TARGET=1 ;;
    --help|-h) HELP=1 ;;
    --user) TARGET='user' ;;
    --project) TARGET='project' ;;
    # A typo'd flag must not fall into the root argument — a non-empty root suppresses BOTH
    # the self-location resolver and the git fallback, so `--projekt` would die 70 lines
    # later with "hook script not found: --projekt/…" (the recap-gate review M-8 shape).
    --*|-*) echo "unknown option: $_a" >&2; exit 2 ;;
    *)
      if [[ -n "$ARG_ROOT" ]]; then echo "unexpected second argument: $_a" >&2; exit 2; fi
      ARG_ROOT="$_a" ;;
  esac
done

if [[ "$HELP" == 1 ]]; then
  cat <<'EOF'
Usage: register-glossary-hook.sh [--user|--project] [/path/to/repo] [--print-root] [--print-target]

Registers the glossary UserPromptSubmit hook (.claude/hooks/glossary-inject.sh) so the
operator's prompt gets «"<raw word>" = <term>: <definition>» injected while a term is still
being learned (CONTEXT.md). Runs from any working directory — the repo root is resolved from
this script's own location, not from `git rev-parse` of the cwd.

  --user            register in ~/.claude/settings.json (default; absolute-path command)
  --project         register in THIS checkout (SSOT + renderer channel — the `hooks` key of
                    a project settings.json is rendered, never hand-patched)
  /path/to/repo     explicit root, wins over self-location
  --print-root      resolve the root and exit, writes nothing
  --print-target    name the settings file the registration would write, exit, writes nothing
  --help, -h        print this usage, exit 0, writes nothing

After registering, open a FRESH session (hooks are snapshotted at session start), then use a
glossary word in a prompt and look for the injected «"<raw word>" = …» line. To unregister:
delete the .claude/hooks/glossary-inject.sh entry from hooks.UserPromptSubmit in the same
settings file this script reported under "arm into:".
EOF
  exit 0
fi

_self="${BASH_SOURCE[0]}"
while [[ -L "$_self" ]]; do
  _dir="$(cd -P "$(dirname "$_self")" >/dev/null 2>&1 && pwd)"
  _self="$(readlink "$_self")"
  [[ "$_self" != /* ]] && _self="$_dir/$_self"
done
_selfroot="$(cd -P "$(dirname "$_self")/.." >/dev/null 2>&1 && pwd)" || _selfroot=''

ROOT="$ARG_ROOT"
if [[ -z "$ROOT" && -n "$_selfroot" && -f "$_selfroot/.ai-factory/harness-model.json" ]]; then
  ROOT="$_selfroot"
fi
if [[ -z "$ROOT" ]]; then
  ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
fi
if [[ -z "$ROOT" ]]; then
  echo "FAIL: cannot locate the repo root from ${BASH_SOURCE[0]} and no root given." >&2
  echo "      Usage: $0 [--user|--project] [/path/to/repo] [--print-root] [--print-target]" >&2
  exit 1
fi

# --print-root resolves and exits. It is the only way to exercise the resolver WITHOUT
# performing the settings write the rest of this script does, which is what makes the
# resolution testable at all (scripts/register-root-resolution.test.sh drives this arm).
if [[ "$PRINT_ROOT" == 1 ]]; then
  printf '%s\n' "$ROOT"
  exit 0
fi
SETTINGS="$ROOT/.claude/settings.json"
SSOT="$ROOT/.ai-factory/harness-model.json"
HOOK_REL='.claude/hooks/glossary-inject.sh'
# --user command: ABSOLUTE path (see header — inert in repos without the hook, no 127 noise).
# shellcheck disable=SC2016  # the path is baked verbatim; nothing here expands at hook time
USER_HOOK_CMD="bash \"$ROOT/$HOOK_REL\""
# --project command: the literal-$CLAUDE_PROJECT_DIR idiom (precompact/handoff-gate shape) —
# a tracked config every worktree and machine reads must not bake this checkout's path.
# shellcheck disable=SC2016
PROJECT_HOOK_CMD='bash "$CLAUDE_PROJECT_DIR/.claude/hooks/glossary-inject.sh"'
# The file the REGISTRATION goes into. Both are Claude Code settings files; the user one is
# what a worktree session reads (header), the project one is the narrow arm.
if [[ "$TARGET" == 'user' ]]; then
  ARM_SETTINGS="${HOME:?HOME must be set to locate ~/.claude/settings.json}/.claude/settings.json"
else
  ARM_SETTINGS="$SETTINGS"
fi
# --print-target: the same testable-without-writing shape as --print-root — the real target
# resolution, then exit before any precondition or write.
if [[ "$PRINT_TARGET" == 1 ]]; then
  printf '%s\n' "$ARM_SETTINGS"
  exit 0
fi

fail() { echo "FAIL: $*" >&2; exit 1; }

# ── Preconditions ────────────────────────────────────────────────────────────
command -v jq >/dev/null 2>&1 || fail "jq not on PATH"
[[ -f "$ROOT/$HOOK_REL" ]] || fail "hook script not found: $ROOT/$HOOK_REL"
[[ -x "$ROOT/$HOOK_REL" ]] || fail "hook script is not executable: $ROOT/$HOOK_REL"
if [[ "$TARGET" == 'project' ]]; then
  command -v node >/dev/null 2>&1 || fail "node not on PATH"
  [[ -f "$SSOT" ]] || fail "SSOT not found: $SSOT"
  jq -e . "$SSOT" >/dev/null || fail "SSOT is not valid JSON — refusing to touch it"
  [[ -f "$ROOT/scripts/render-harness-config.mjs" ]] || fail "renderer not found under $ROOT"
fi
# Fatal only for the file this run actually WRITES. A broken settings.json silently disables
# EVERY setting in it, so we refuse to edit one we cannot parse.
if [[ "$ARM_SETTINGS" == "$SETTINGS" ]]; then
  [[ -f "$ARM_SETTINGS" ]] || fail "settings.json not found: $ARM_SETTINGS (run the framework install first)"
else
  [[ -f "$ARM_SETTINGS" ]] || fail "user settings not found: $ARM_SETTINGS (Claude Code writes it on first run; or pass --project)"
fi
jq -e . "$ARM_SETTINGS" >/dev/null || fail "settings.json is malformed — fix it first (a broken settings.json silently disables ALL settings from that file)"

echo "root:     $ROOT"
echo "arm into: $ARM_SETTINGS ($TARGET settings)"

# ── Register: one hooks.UserPromptSubmit entry in the TARGET file ────────────
# The user file's `hooks` key is NOT renderer-owned (the renderer writes only the project
# settings.json + plugin/hooks/hooks.json), so a guarded in-place jq edit is the sanctioned
# channel here: backup, jq into a TEMP file, `jq -e .` validate, atomic mv, skip if already
# present. The --project target IS renderer-owned — that arm goes through the SSOT + --write
# below instead, never a direct patch.
_entry_already_present() { # $1 = settings file, $2 = command
  jq -e --arg c "$2" '.hooks.UserPromptSubmit // [] | any((.hooks // [])[]?; .command == $c)' "$1" >/dev/null 2>&1
}

if [[ "$TARGET" == 'user' ]]; then
  if _entry_already_present "$ARM_SETTINGS" "$USER_HOOK_CMD"; then
    echo "register:  glossary hook already registered in $ARM_SETTINGS — nothing to do"
  else
    cp "$ARM_SETTINGS" "$ARM_SETTINGS.bak" || fail "could not back up $ARM_SETTINGS"
    tmp="$(mktemp)"
    jq --arg c "$USER_HOOK_CMD" \
       '.hooks.UserPromptSubmit = ((.hooks.UserPromptSubmit // []) + [{hooks: [{type: "command", command: $c}]}])' \
       "$ARM_SETTINGS" > "$tmp" || fail "jq edit failed — $ARM_SETTINGS untouched, backup at $ARM_SETTINGS.bak"
    jq -e . "$tmp" >/dev/null || fail "jq produced invalid JSON — $ARM_SETTINGS untouched"
    mv "$tmp" "$ARM_SETTINGS" || fail "could not write $ARM_SETTINGS"
    echo "register:  glossary hook REGISTERED in $ARM_SETTINGS (backup: $ARM_SETTINGS.bak)"
  fi
else
  # --project: the SSOT is the registration surface; the renderer materializes it into the
  # project settings.json (and, being model-derived, into plugin/hooks/hooks.json — the ZCode
  # plugin twin plugin/hooks/glossary-inject exists for exactly that path).
  if _entry_already_present "$SSOT" "$PROJECT_HOOK_CMD"; then
    echo "step 1:    SSOT already carries the UserPromptSubmit entry — nothing to add"
  else
    cp "$SSOT" "$SSOT.bak" || fail "could not back up SSOT"
    tmp="$(mktemp)"
    jq --arg c "$PROJECT_HOOK_CMD" \
       '.hooks.UserPromptSubmit = ((.hooks.UserPromptSubmit // []) + [{command: $c}])' \
       "$SSOT" > "$tmp" || fail "jq edit failed — SSOT untouched, backup at $SSOT.bak"
    jq -e . "$tmp" >/dev/null || fail "jq produced invalid JSON — SSOT untouched"
    mv "$tmp" "$SSOT" || fail "could not write SSOT"
    echo "step 1:    SSOT entry ADDED (backup: $SSOT.bak)"
  fi
  echo "step 2:    rendering..."
  node "$ROOT/scripts/render-harness-config.mjs" --write --root "$ROOT" 2>&1 | sed 's/^/          /' \
    || fail "renderer exited non-zero"
fi

# ── Verify — independent assertions, read back from disk ─────────────────────
rc=0

# (a) the entry is actually in the TARGET file under UserPromptSubmit
_target_cmd="$USER_HOOK_CMD"
[[ "$TARGET" == 'project' ]] && _target_cmd="$PROJECT_HOOK_CMD"
if jq -e --arg c "$_target_cmd" \
     '.hooks.UserPromptSubmit[]? | select(.hooks) | any(.hooks[]?; .command == $c)' \
     "$ARM_SETTINGS" >/dev/null 2>&1 \
   || jq -e --arg c "$_target_cmd" \
     '.hooks.UserPromptSubmit[]? | select(.command == $c)' "$ARM_SETTINGS" >/dev/null 2>&1; then
  echo "verify a:  entry present in $ARM_SETTINGS (UserPromptSubmit)      OK"
else
  echo "verify a:  entry NOT found in $ARM_SETTINGS                       FAIL"; rc=1
fi

# (b) the registered command's script exists and is executable — catches the dangled
#     absolute path after a checkout move (header, --user cost).
_reg_script="$ROOT/$HOOK_REL"
[[ -x "$_reg_script" ]] \
  && echo "verify b:  $HOOK_REL present and executable                      OK" \
  || { echo "verify b:  $HOOK_REL missing or not executable                   FAIL"; rc=1; }

# (c) LIVE smoke of the registered command, fully sandboxed: the residue dir AND TMPDIR are
#     redirected to a scratch dir, so the counters write and the pending file land in the
#     sandbox, not in the operator's residue. The smoke word is parsed from CONTEXT.md itself
#     (the first _Operator says_ word) — if CONTEXT.md or the seed line is absent, the tree is
#     unarmed and the registration is still valid but cannot be proven here: NOTE, not FAIL.
_smoke_dir="$(mktemp -d)"
_smoke_word="$(awk '/^_Operator says_:/ { sub(/^_Operator says_:[ ]*/, ""); gsub(/«/, ""); gsub(/»/, ""); sub(/\..*/, ""); n = split($0, w, ","); gsub(/^[ \t]+|[ \t]+$/, "", w[1]); print w[1]; exit }' "$ROOT/CONTEXT.md" 2>/dev/null || true)"
if [[ -z "$_smoke_word" ]]; then
  echo "verify c:  LIVE smoke SKIPPED — no _Operator says_ seed in CONTEXT.md (unarmed tree)  NOTE"
elif _smoke_out="$(printf '%s' "{\"prompt\":\"explain the term $_smoke_word please\",\"session_id\":\"register-glossary-smoke\"}" \
    | CLAUDE_PROJECT_DIR="$ROOT" AIF_RESIDUE_DIR="$_smoke_dir" TMPDIR="$_smoke_dir" \
      bash "$ROOT/$HOOK_REL" 2>/dev/null)" \
   && printf '%s' "$_smoke_out" | grep -qF "\"$_smoke_word\" = "; then
  echo "verify c:  LIVE smoke fired: injected line for \"$_smoke_word\" produced            OK"
else
  echo "verify c:  LIVE smoke produced no injected line for \"$_smoke_word\"              FAIL"; rc=1
fi
rm -rf "$_smoke_dir" 2>/dev/null || true

# (d) zero drift for the --project arm only: the SSOT and every rendered artifact agree.
#     (The --user arm edits a file the renderer never reads — nothing to drift.)
if [[ "$TARGET" == 'project' ]]; then
  if node "$ROOT/scripts/render-harness-config.mjs" --check --root "$ROOT" >/dev/null 2>&1; then
    echo "verify d:  renderer --check reports zero drift                   OK"
  else
    echo "verify d:  renderer --check reports DRIFT                        FAIL"; rc=1
  fi
fi

echo
if [[ $rc -eq 0 ]]; then
  cat <<EOF
ALL CHECKS PASSED — the glossary hook is REGISTERED in $ARM_SETTINGS.

Two things this script cannot do for you:
  1. COMMIT (only --project edits tracked files; a --user registration is machine-local and
     touches nothing tracked). After a --project run, .ai-factory/harness-model.json AND
     .claude/settings.json must land in ONE commit — a model-only edit goes drift-RED:
       git add .ai-factory/harness-model.json .claude/settings.json && git commit
  2. ACTIVATE IN RUNNING SESSIONS. Hooks are snapshotted at session start, so the session
     this ran in will NOT inject. Open a fresh session, use a glossary word in a prompt
     (e.g. one of the _Operator says_ words in CONTEXT.md), and look for the
     «"<raw word>" = <term>: …» line. The twin Stop-side demand fires only when that same
     session's prompt was scanned — the two sides share the residue-dir counters file
     (_residue_dir()/_glossary-counts.json); a path split between them is the kickoff's
     item-4 falsifier.

The dormant/working trap, restated: with green tests and no registration nothing is
observable from inside the repo. The observable proof is the injected line above.
EOF
else
  echo "SOME CHECKS FAILED — see above. Backups (if written): $ARM_SETTINGS.bak $SSOT.bak"
fi
exit "$rc"
