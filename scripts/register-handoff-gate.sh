#!/usr/bin/env bash
# Operator hand-off: arm the D13 handoff-currency gate (spec:
# docs/superpowers/specs/2026-09-08-handoff-currency-gate-design.md, Decision 4 + D18).
#
# WHAT "ARMING" IS: two settings deltas, both idempotent —
#   1. the SessionStart injector registration in the SSOT (matcher "compact"), rendered
#      into .claude/settings.json by render-harness-config.mjs;
#   2. AIF_HANDOFF_GATE=1 in the settings.json `env` block (D18: the gate ships DORMANT;
#      presence of a compaction window deliberately does NOT arm it).
# After the gate PR has landed, step 1 is already satisfied and this script effectively
# only does step 2 — it stays idempotent either way.
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

set -uo pipefail

ROOT="${1:-}"
if [[ -z "$ROOT" ]]; then
  ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
    echo "FAIL: not in a git repo and no root given. Usage: $0 [/path/to/repo]" >&2
    exit 1
  }
fi
SSOT="$ROOT/.ai-factory/harness-model.json"
SETTINGS="$ROOT/.claude/settings.json"
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

echo "root:     $ROOT"

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

# ── Step 3: arm — AIF_HANDOFF_GATE=1 in the settings.json env block (D18) ────
# env is NOT renderer-owned (drift-test P3: foreign keys are byte-preserved), so a guarded
# in-place jq edit is the correct channel here — NOT a second channel to `hooks`.
if [[ "$(jq -r '.env.AIF_HANDOFF_GATE // empty' "$SETTINGS")" == "1" ]]; then
  echo "step 3:   AIF_HANDOFF_GATE=1 already set — nothing to do"
else
  cp "$SETTINGS" "$SETTINGS.bak" || fail "could not back up settings.json"
  tmp="$(mktemp)"
  jq '.env = ((.env // {}) + {AIF_HANDOFF_GATE: "1"})' "$SETTINGS" > "$tmp" \
    || fail "jq edit failed — settings.json untouched, backup at $SETTINGS.bak"
  jq -e . "$tmp" >/dev/null || fail "jq produced invalid JSON — settings.json untouched"
  mv "$tmp" "$SETTINGS" || fail "could not write settings.json"
  echo "step 3:   AIF_HANDOFF_GATE=1 ARMED (backup: $SETTINGS.bak)"
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

# (b) the gate is actually armed in the rendered env
if [[ "$(jq -r '.env.AIF_HANDOFF_GATE // empty' "$SETTINGS")" == "1" ]]; then
  echo "verify b: AIF_HANDOFF_GATE=1 present in settings.json env         OK"
else
  echo "verify b: AIF_HANDOFF_GATE missing from settings.json env         FAIL"; rc=1
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

echo
if [[ $rc -eq 0 ]]; then
  cat <<'EOF'
ALL CHECKS PASSED — the handoff-currency gate is ARMED.

Two things this script cannot do for you:
  1. COMMIT (only if it edited the SSOT in step 1 — after the gate PR has landed this
     script normally edits nothing tracked). .ai-factory/harness-model.json AND
     .claude/settings.json are git-tracked and must land in ONE commit — a model-only
     edit goes drift-RED:
       git add .ai-factory/harness-model.json .claude/settings.json && git commit
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
