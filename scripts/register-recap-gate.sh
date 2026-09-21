#!/usr/bin/env bash
# getff:no-card — operator hand-off helper, run by hand once; never wired
# Operator hand-off: arm the plain-words recap gate (spec:
# .superpowers/sdd/2026-09-13-plain-words-recap-v2-slice-1-delivery, D-E, R-15).
#
# WHAT "ARMING" IS: one settings delta — AIF_RECAP_GATE=1 in a settings.json `env` block.
# The gate ships DORMANT: the instruction text lands unconditionally, the rejection behaviour
# only fires once this flag is set. Unlike register-handoff-gate.sh, this script registers no
# hook and never invokes the renderer — the Stop hook is already registered by
# setup.d/10-skills.sh §1c. This script's whole job is the guarded `env` write.
#
# WHICH settings.json this writes — the USER file by default, since 2026-09-13:
#   Until then the arm went into `<checkout>/.claude/settings.json`. Measured that day: a
#   desktop WORKTREE session's project settings are the WORKTREE's own committed file, never
#   the main checkout's machine-local arming — 0 of 100+ worktrees were armed and the gate
#   never fired in any of them (spec §Changelog round 3). Claude Code MERGES the user and
#   project `env` blocks per key, so `~/.claude/settings.json` is the one file every session on
#   this machine reads. That is also its cost: a user-level arm reaches every repo on the
#   machine whose Stop hook carries the gate (the getff plugin twin included), not just this
#   checkout. `--project` keeps the per-checkout arm for a deliberate narrow scope.
#
# WHY A SCRIPT AND NOT A jq ONE-LINER INTO settings.json — same reasons as the D8/D18
# precedents (scripts/register-precompact-hook.sh PR #1443, scripts/register-handoff-gate.sh):
#   • the `env` key is NOT renderer-owned (the drift test's P3 proves foreign keys are
#     byte-preserved), so the arming edit is a guarded in-place jq edit: backup,
#     `jq -e .` validate a TEMP file, atomic `mv`, skip if already present.
#
# IDEMPOTENT: re-running is a no-op that still re-verifies. Refuses to touch a malformed
# settings.json (a broken settings.json silently disables ALL settings from that file).
#
# USAGE — runs from ANY working directory, because the repo root is resolved from the
# script's own path (see the resolver below), not from `git rev-parse` of the cwd:
#     bash /path/to/repo/scripts/register-recap-gate.sh          # arms ~/.claude/settings.json (default = --user)
#     bash scripts/register-recap-gate.sh --project              # arms THIS checkout's .claude/settings.json
#     bash /path/to/repo/scripts/register-recap-gate.sh --project /other/checkout   # explicit root wins
#     bash /path/to/repo/scripts/register-recap-gate.sh --print-root      # resolve the root and exit, writes nothing
#     bash /path/to/repo/scripts/register-recap-gate.sh --print-target    # name the settings file the arm would write, exit
#     bash /path/to/repo/scripts/register-recap-gate.sh --help            # print this usage, exit 0, writes nothing
# A symlink to this script works too. Covered by scripts/register-root-resolution.test.sh.

set -uo pipefail

# ── Repo root: resolved from the SCRIPT'S OWN LOCATION, so this runs from ANY cwd ─────
# Precedence: an explicit path argument → the checkout this script lives in → the git
# toplevel of the current directory (the historical behaviour, kept as the last resort).
#
# Self-location leads because the two disagree in exactly the case that matters: run from a
# DIFFERENT checkout or worktree of this project and `git rev-parse --show-toplevel` names
# THAT tree, so the script would arm a settings.json the operator never meant to touch —
# silently, because that tree satisfies every precondition. The symlink loop is hand-rolled:
# macOS ships neither `readlink -f` nor GNU `realpath`.
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
    # A typo'd flag used to fall into the root argument, and a non-empty root suppresses
    # BOTH the self-location resolver and the git fallback — so `--projekt` died 70 lines
    # later with "Stop hook not found: --projekt/.claude/hooks/…" (review M-8). Reject the
    # flag shape by name; a second positional root is the same silent-overwrite class.
    --*|-*) echo "unknown option: $_a" >&2; exit 2 ;;
    *)
      if [[ -n "$ARG_ROOT" ]]; then echo "unexpected second argument: $_a" >&2; exit 2; fi
      ARG_ROOT="$_a" ;;
  esac
done

if [[ "$HELP" == 1 ]]; then
  cat <<'EOF'
Usage: register-recap-gate.sh [--user|--project] [/path/to/repo] [--print-root] [--print-target]

Arms AIF_RECAP_GATE=1 in a Claude Code settings.json `env` block. Runs from any working
directory — the repo root is resolved from this script's own location, not from
`git rev-parse` of the cwd.

  --user            arm ~/.claude/settings.json (default)
  --project         arm THIS checkout's .claude/settings.json
  /path/to/repo     explicit root, wins over self-location
  --print-root      resolve the root and exit, writes nothing
  --print-target    name the settings file the arm would write, exit, writes nothing
  --help, -h        print this usage, exit 0, writes nothing
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
# The file the ARM goes into. Both are Claude Code settings files with the same `env` shape;
# the user one is what a worktree session reads (header), the project one is the narrow arm.
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
[[ -f "$ROOT/.claude/hooks/end-of-turn-reminder.sh" ]] || fail "Stop hook not found: $ROOT/.claude/hooks/end-of-turn-reminder.sh"
# Fatal only for the file this run actually WRITES. A broken settings.json silently disables
# EVERY setting in it, so we refuse to edit one we cannot parse.
if [[ "$ARM_SETTINGS" == "$SETTINGS" ]]; then
  [[ -f "$ARM_SETTINGS" ]] || fail "settings.json not found: $ARM_SETTINGS (run the framework install first)"
else
  [[ -f "$ARM_SETTINGS" ]] || fail "user settings not found: $ARM_SETTINGS (Claude Code writes it on first run; or pass --project)"
fi
jq -e . "$ARM_SETTINGS" >/dev/null || fail "settings.json is malformed — fix it first (a broken settings.json silently disables ALL settings from that file)"

# ADVISORY, never fatal: in --user mode this checkout's own settings.json is neither read nor
# written, so a problem with it must not block an arm that would otherwise succeed. It is still
# worth saying: `hooks.Stop` lives in THAT file, and a broken one disables the very hook the flag
# arms — for this project. (The sibling scripts/register-handoff-gate.sh:184 checks it fatally and
# is right to, because it genuinely reads $SETTINGS afterwards; this script verifies by grepping
# the hook file instead, so that justification does not carry over.)
if [[ "$ARM_SETTINGS" != "$SETTINGS" ]]; then
  if [[ ! -f "$SETTINGS" ]]; then
    echo "warn:     $SETTINGS not found — arming $ARM_SETTINGS anyway; the Stop hook is not registered for THIS checkout" >&2
  elif ! jq -e . "$SETTINGS" >/dev/null 2>&1; then
    echo "warn:     $SETTINGS is malformed — arming $ARM_SETTINGS anyway, but every setting in that file (including hooks.Stop) is silently dead until you fix it" >&2
  fi
fi

echo "root:     $ROOT"
echo "arm into: $ARM_SETTINGS ($TARGET settings)"

# ── Arm: AIF_RECAP_GATE=1 in the TARGET settings.json env block (spec R-15) ───────────
# The recap gate ships DORMANT: the instruction text lands unconditionally, the REJECTION
# only here. `env` is not renderer-owned (drift-test P3 — foreign keys are byte-preserved),
# so a guarded in-place jq edit is the sanctioned channel: backup, jq into a TEMP file,
# `jq -e .` validate, atomic mv. A malformed settings.json silently disables EVERY setting
# in that file, which is why nothing is written until the temp validates.
if [[ "$(jq -r '.env.AIF_RECAP_GATE // empty' "$ARM_SETTINGS")" == "1" ]]; then
  echo "arm:      AIF_RECAP_GATE=1 already set in $ARM_SETTINGS — nothing to do"
else
  cp "$ARM_SETTINGS" "$ARM_SETTINGS.bak" || fail "could not back up $ARM_SETTINGS"
  tmp="$(mktemp)"
  jq '.env = ((.env // {}) + {AIF_RECAP_GATE: "1"})' "$ARM_SETTINGS" > "$tmp" \
    || fail "jq edit failed — $ARM_SETTINGS untouched, backup at $ARM_SETTINGS.bak"
  jq -e . "$tmp" >/dev/null || fail "jq produced invalid JSON — $ARM_SETTINGS untouched"
  mv "$tmp" "$ARM_SETTINGS" || fail "could not write $ARM_SETTINGS"
  echo "arm:      AIF_RECAP_GATE=1 ARMED in $ARM_SETTINGS (backup: $ARM_SETTINGS.bak)"
fi

# ── Verify — two independent assertions, read back from disk ─────────────────
rc=0
[[ "$(jq -r '.env.AIF_RECAP_GATE // empty' "$ARM_SETTINGS")" == "1" ]] \
  || { echo "verify:   ✗ AIF_RECAP_GATE not readable back from $ARM_SETTINGS"; rc=1; }
grep -q 'AIF_RECAP_GATE' "$ROOT/.claude/hooks/end-of-turn-reminder.sh" \
  || { echo "verify:   ✗ the Stop hook in $ROOT does not read AIF_RECAP_GATE — arming a hook that ignores it"; rc=1; }
[ "$rc" -eq 0 ] && echo "verify:   ✓ armed and the hook reads the flag"
exit "$rc"
