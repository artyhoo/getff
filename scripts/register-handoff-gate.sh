#!/usr/bin/env bash
# getff:no-card — operator hand-off helper, run by hand once; never wired
# Operator hand-off: arm the D13 handoff-currency gate (spec:
# docs/superpowers/specs/2026-09-08-handoff-currency-gate-design.md, Decision 4 + D18).
#
# WHAT "ARMING" IS: two settings deltas, both idempotent —
#   1. the SessionStart injector registration in the SSOT (matcher "compact"), rendered
#      into .claude/settings.json by render-harness-config.mjs;
#   2. AIF_HANDOFF_GATE=1 in a settings.json `env` block (D18: the gate ships DORMANT;
#      presence of a compaction window deliberately does NOT arm it).
# After the gate PR has landed, step 1 is already satisfied and this script effectively
# only does step 2 — it stays idempotent either way.
#
# WHICH settings.json step 2 writes — the USER file by default, since 2026-09-13:
#   Until then the arm went into `<checkout>/.claude/settings.json`. Measured that day: a
#   desktop WORKTREE session's project settings are the WORKTREE's own committed file, never
#   the main checkout's machine-local arming — 0 of 100+ worktrees were armed and the gate
#   never fired in any of them (spec §Changelog round 3). Claude Code MERGES the user and
#   project `env` blocks per key, so `~/.claude/settings.json` is the one file every session on
#   this machine reads. That is also its cost: a user-level arm reaches every repo on the
#   machine whose Stop hook carries the gate (the getff plugin twin included), not just this
#   checkout. `--project` keeps the per-checkout arm for a deliberate narrow scope.
#
# WHY A SCRIPT AND NOT A jq ONE-LINER INTO settings.json — same reasons as the D8
# precedent (scripts/register-precompact-hook.sh, PR #1443):
#   • settings.json's `hooks` key is RENDERED (emitClaude, merge-json from
#     .ai-factory/harness-model.json) — a hand-patch goes drift-RED on the next --check.
#     So the registration goes through the SSOT + --write, the sanctioned channel.
#   • The `env` key is NOT renderer-owned (the drift test's P3 proves foreign keys are
#     byte-preserved), so the arming edit is a guarded in-place jq edit: backup,
#     `jq -e .` validate a TEMP file, atomic `mv`, skip if already present.
#
# IDEMPOTENT: re-running is a no-op that still re-verifies. Refuses to touch a malformed
# settings.json (a broken settings.json silently disables ALL settings from that file).
#
# USAGE — runs from ANY working directory, because the repo root is resolved from the
# script's own path (see the resolver below), not from `git rev-parse` of the cwd:
#     bash /path/to/repo/scripts/register-handoff-gate.sh          # arms ~/.claude/settings.json (default = --user)
#     bash scripts/register-handoff-gate.sh --project              # arms THIS checkout's .claude/settings.json
#     bash /path/to/repo/scripts/register-handoff-gate.sh --project /other/checkout   # explicit root wins
#     bash /path/to/repo/scripts/register-handoff-gate.sh --print-root      # resolve the root and exit, writes nothing
#     bash /path/to/repo/scripts/register-handoff-gate.sh --print-target    # name the settings file step 3 would write, exit
# Steps 1-2 (SSOT + render) and the checkout-side verifications always run against the
# resolved root; only the ARM (step 3 + verify b) moves between the user and project file.
# A symlink to this script works too. Covered by scripts/register-root-resolution.test.sh and
# scripts/register-handoff-gate-target.test.sh.

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
TARGET='user'
ARG_ROOT=''
for _a in "$@"; do
  case "$_a" in
    --print-root) PRINT_ROOT=1 ;;
    --print-target) PRINT_TARGET=1 ;;
    --user) TARGET='user' ;;
    --project) TARGET='project' ;;
    *) ARG_ROOT="$_a" ;;
  esac
done

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
SSOT="$ROOT/.ai-factory/harness-model.json"
SETTINGS="$ROOT/.claude/settings.json"
# The file the ARM goes into. Both are Claude Code settings files with the same `env` shape;
# the user one is what a worktree session reads (header), the project one is the narrow arm.
if [[ "$TARGET" == 'user' ]]; then
  ARM_SETTINGS="${HOME:?HOME must be set to locate ~/.claude/settings.json}/.claude/settings.json"
else
  ARM_SETTINGS="$SETTINGS"
fi
# --print-target: the same testable-without-writing shape as --print-root — the real target
# resolution, then exit before any precondition or write (register-handoff-gate-target.test.sh).
if [[ "$PRINT_TARGET" == 1 ]]; then
  printf '%s\n' "$ARM_SETTINGS"
  exit 0
fi
HOOK_REL='.claude/hooks/inject-handoff-on-compact.sh'
# Literal $CLAUDE_PROJECT_DIR — expanded by Claude Code at hook time, NOT by this shell
# (single quotes are the whole point; the D8 precedent's rationale applies verbatim).
# shellcheck disable=SC2016
HOOK_CMD='bash "$CLAUDE_PROJECT_DIR/.claude/hooks/inject-handoff-on-compact.sh"'
MATCHER='compact'

fail() { echo "FAIL: $*" >&2; exit 1; }

# ── Preconditions ────────────────────────────────────────────────────────────
command -v jq   >/dev/null 2>&1 || fail "jq not on PATH"
command -v node >/dev/null 2>&1 || fail "node not on PATH"
[[ -f "$SSOT" ]]              || fail "SSOT not found: $SSOT"
[[ -f "$ROOT/$HOOK_REL" ]]    || fail "injector script not found: $ROOT/$HOOK_REL"
[[ -f "$ROOT/scripts/render-harness-config.mjs" ]] || fail "renderer not found under $ROOT"
jq -e . "$SSOT" >/dev/null    || fail "SSOT is not valid JSON — refusing to touch it"
[[ -f "$SETTINGS" ]] || fail "settings.json not found: $SETTINGS (run the framework install first)"
jq -e . "$SETTINGS" >/dev/null || fail "settings.json is malformed — fix it first (a broken settings.json silently disables ALL settings from that file)"
if [[ "$ARM_SETTINGS" != "$SETTINGS" ]]; then
  [[ -f "$ARM_SETTINGS" ]] || fail "user settings not found: $ARM_SETTINGS (Claude Code writes it on first run; or pass --project)"
  jq -e . "$ARM_SETTINGS" >/dev/null || fail "user settings.json is malformed — fix it first (a broken settings.json silently disables ALL settings from that file)"
fi

echo "root:     $ROOT"
echo "arm into: $ARM_SETTINGS ($TARGET settings)"

# ── Step 1: SSOT entry (idempotent — matcher AND command must both match) ────
if jq -e --arg c "$HOOK_CMD" --arg m "$MATCHER" \
     '.hooks.SessionStart // [] | any(.command == $c and .matcher == $m)' "$SSOT" >/dev/null; then
  echo "step 1:   SSOT already carries the SessionStart injector — nothing to add"
else
  cp "$SSOT" "$SSOT.bak" || fail "could not back up SSOT"
  tmp="$(mktemp)"
  jq --arg c "$HOOK_CMD" --arg m "$MATCHER" \
     '.hooks.SessionStart = ((.hooks.SessionStart // []) + [{matcher: $m, command: $c}])' \
     "$SSOT" > "$tmp" || fail "jq edit failed — SSOT untouched, backup at $SSOT.bak"
  jq -e . "$tmp" >/dev/null || fail "jq produced invalid JSON — SSOT untouched"
  mv "$tmp" "$SSOT" || fail "could not write SSOT"
  echo "step 1:   SSOT entry ADDED (backup: $SSOT.bak)"
fi

# ── Step 2: render (the renderer owns settings.json's `hooks` key) ───────────
echo "step 2:   rendering..."
node "$ROOT/scripts/render-harness-config.mjs" --write --root "$ROOT" 2>&1 | sed 's/^/          /' \
  || fail "renderer exited non-zero"

# ── Step 3: arm — AIF_HANDOFF_GATE=1 in the TARGET settings.json env block (D18) ──
# env is NOT renderer-owned (drift-test P3: foreign keys are byte-preserved), so a guarded
# in-place jq edit is the correct channel here — NOT a second channel to `hooks`. The user
# file is never renderer-owned at all; the same temp + validate + atomic-mv shape applies.
if [[ "$(jq -r '.env.AIF_HANDOFF_GATE // empty' "$ARM_SETTINGS")" == "1" ]]; then
  echo "step 3:   AIF_HANDOFF_GATE=1 already set in $ARM_SETTINGS — nothing to do"
else
  cp "$ARM_SETTINGS" "$ARM_SETTINGS.bak" || fail "could not back up $ARM_SETTINGS"
  tmp="$(mktemp)"
  jq '.env = ((.env // {}) + {AIF_HANDOFF_GATE: "1"})' "$ARM_SETTINGS" > "$tmp" \
    || fail "jq edit failed — $ARM_SETTINGS untouched, backup at $ARM_SETTINGS.bak"
  jq -e . "$tmp" >/dev/null || fail "jq produced invalid JSON — $ARM_SETTINGS untouched"
  mv "$tmp" "$ARM_SETTINGS" || fail "could not write $ARM_SETTINGS"
  echo "step 3:   AIF_HANDOFF_GATE=1 ARMED in $ARM_SETTINGS (backup: $ARM_SETTINGS.bak)"
fi

# ── Step 4: verify — four independent assertions ─────────────────────────────
rc=0

# (a) the injector is actually in settings.json under SessionStart with the matcher
if jq -e --arg c "$HOOK_CMD" \
     '.hooks.SessionStart[]? | select(.matcher == "compact") | any(.hooks[]?; .command == $c)' \
     "$SETTINGS" >/dev/null; then
  echo "verify a: injector present in settings.json (matcher compact)      OK"
else
  echo "verify a: injector NOT found in settings.json                     FAIL"; rc=1
fi

# (b) the gate is actually armed in the TARGET file's env
if [[ "$(jq -r '.env.AIF_HANDOFF_GATE // empty' "$ARM_SETTINGS")" == "1" ]]; then
  echo "verify b: AIF_HANDOFF_GATE=1 present in $TARGET settings env       OK"
else
  echo "verify b: AIF_HANDOFF_GATE missing from $TARGET settings env       FAIL"; rc=1
fi

# (c) zero drift: SSOT and every rendered artifact agree
if node "$ROOT/scripts/render-harness-config.mjs" --check --root "$ROOT" >/dev/null 2>&1; then
  echo "verify c: renderer --check reports zero drift                     OK"
else
  echo "verify c: renderer --check reports DRIFT                          FAIL"; rc=1
fi

# (d) the plugin output must NOT carry the injector (spec D20: operator-axis only;
#     consumers receive no residue writer, and the plugin SessionStart slot is the
#     bootstrap's). Guards a silent parity claim — same shape as the D8 script's verify d.
if [[ -f "$ROOT/plugin/hooks/hooks.json" ]]; then
  if jq -r '[.hooks.SessionStart[]? | select(.matcher == "compact") | .hooks[]?.command] | join(" ")' \
       "$ROOT/plugin/hooks/hooks.json" | grep -q 'inject-handoff-on-compact'; then
    echo "verify d: plugin/hooks.json wrongly carries the injector          FAIL"; rc=1
  else
    echo "verify d: plugin/hooks.json correctly omits the injector          OK"
  fi
fi

# (e) INFORMATIONAL — where the gate floor will land for the sessions this arm reaches.
#     The Stop hook resolves the compaction point env → project settings → user settings
#     (D14, third step added 2026-09-13). A user-level arm serves WORKTREE sessions, whose
#     project file is the worktree's committed one, so only the env or the USER key counts
#     here. Nothing declared is not a defect: the floor falls back to ctx_soft (300000).
_cp_env="$(jq -r '.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW // empty' "$ARM_SETTINGS")"
_cp_key="$(jq -r '.autoCompactWindow // empty' "$ARM_SETTINGS")"
if [[ "$_cp_env" =~ ^[0-9]+$ ]]; then
  echo "verify e: compaction point ${_cp_env} (env.CLAUDE_CODE_AUTO_COMPACT_WINDOW) → gate floor $(( _cp_env * 67 / 100 ))  NOTE"
elif [[ "$_cp_key" =~ ^[0-9]+$ ]]; then
  echo "verify e: compaction point ${_cp_key} (autoCompactWindow) → gate floor $(( _cp_key * 67 / 100 ))  NOTE"
else
  echo "verify e: no compaction point in $TARGET settings → gate floor = ctx_soft (300000)  NOTE"
  echo "          (to bound compaction at 300k, apply the pair from"
  echo "           docs/superpowers/specs/2026-09-08-dynamic-context-window-design.md §What ships now)"
fi

echo
if [[ $rc -eq 0 ]]; then
  cat <<EOF
ALL CHECKS PASSED — the handoff-currency gate is ARMED in $ARM_SETTINGS.

Two things this script cannot do for you:
  1. COMMIT (only if it edited the SSOT in step 1 — after the gate PR has landed this
     script normally edits nothing tracked). .ai-factory/harness-model.json AND
     .claude/settings.json are git-tracked and must land in ONE commit — a model-only
     edit goes drift-RED:
       git add .ai-factory/harness-model.json .claude/settings.json && git commit
     (a --user arm edits ~/.claude/settings.json, which is not tracked by any repo.)
  2. ACTIVATE IN RUNNING SESSIONS. Hooks + env are snapshotted at session start, so the
     session this ran in is NOT armed. Open a fresh session; the gate wakes up when the
     context passes the band floor (min(ctx_soft, compaction point × 67%)).

Then verify it live (spec D26 checklist):
  • a stop in the band with an untouched handoff → ONE block whose reason names the file
  • write the handoff → the next stop allows
  • the first auto-compaction → residue pointer line + the handoff injected on SessionStart
EOF
else
  echo "SOME CHECKS FAILED — see above. Backups (if written): $SSOT.bak $SETTINGS.bak"
fi
exit $rc
