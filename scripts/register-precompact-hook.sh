#!/usr/bin/env bash
# Operator hand-off: register the D8 PreCompact residue hook.
#
# WHY A SCRIPT AND NOT A jq ONE-LINER INTO settings.json:
#   `.claude/settings.json` is a RENDERED artifact — scripts/render-harness-config.mjs owns its
#   `hooks` key (emitClaude, merge-json) from the SSOT at `.ai-factory/harness-model.json`.
#   Hand-patching settings.json would go RED on the next `--check` (the renderer's own fix line:
#   "edit .ai-factory/harness-model.json (the SSOT), then run: --write"). So this edits the SSOT
#   and re-renders, which is the sanctioned channel, not a second one.
#
# WHY NO MATCHER:
#   D8-as-written said `matcher: auto`. Bench finding B-2 (research-patches/
#   2026-08-17-precompact-liveness-bench.md) showed that makes the manual half unfireable by
#   construction — and manual /compact is the ONLY half a human can trigger on demand.
#   precompact-residue.sh treats auto and manual identically. No matcher = all triggers.
#
# IDEMPOTENT: re-running is a no-op that still re-verifies.

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
HOOK_REL='.claude/hooks/precompact-residue.sh'
# Literal $CLAUDE_PROJECT_DIR — expanded by Claude Code at hook time, NOT by this shell. The
# single quotes are the whole point: expanding here would bake THIS checkout's path into a
# tracked config that every worktree and machine reads.
# shellcheck disable=SC2016
HOOK_CMD='bash "$CLAUDE_PROJECT_DIR/.claude/hooks/precompact-residue.sh"'

fail() { echo "FAIL: $*" >&2; exit 1; }

# ── Preconditions ────────────────────────────────────────────────────────────
command -v jq   >/dev/null 2>&1 || fail "jq not on PATH"
command -v node >/dev/null 2>&1 || fail "node not on PATH"
[[ -f "$SSOT" ]]              || fail "SSOT not found: $SSOT"
[[ -f "$ROOT/$HOOK_REL" ]]    || fail "hook script not found: $ROOT/$HOOK_REL"
[[ -f "$ROOT/scripts/render-harness-config.mjs" ]] || fail "renderer not found under $ROOT"
jq -e . "$SSOT" >/dev/null    || fail "SSOT is not valid JSON — refusing to touch it"
[[ -f "$SETTINGS" ]] && { jq -e . "$SETTINGS" >/dev/null || fail "settings.json is malformed — fix it first (a broken settings.json silently disables ALL settings from that file)"; }

echo "root:     $ROOT"

# ── Step 1: SSOT entry (idempotent) ──────────────────────────────────────────
if jq -e --arg c "$HOOK_CMD" '.hooks.PreCompact // [] | any(.command == $c)' "$SSOT" >/dev/null; then
  echo "step 1:   SSOT already carries the PreCompact entry — nothing to add"
else
  cp "$SSOT" "$SSOT.bak" || fail "could not back up SSOT"
  tmp="$(mktemp)"
  jq --arg c "$HOOK_CMD" '.hooks.PreCompact = ((.hooks.PreCompact // []) + [{command: $c}])' \
    "$SSOT" > "$tmp" || fail "jq edit failed — SSOT untouched, backup at $SSOT.bak"
  jq -e . "$tmp" >/dev/null || fail "jq produced invalid JSON — SSOT untouched"
  mv "$tmp" "$SSOT" || fail "could not write SSOT"
  echo "step 1:   SSOT entry ADDED (backup: $SSOT.bak)"
fi

# ── Step 2: render (the renderer owns settings.json's `hooks` key) ───────────
echo "step 2:   rendering..."
node "$ROOT/scripts/render-harness-config.mjs" --write --root "$ROOT" 2>&1 | sed 's/^/          /' \
  || fail "renderer exited non-zero"

# ── Step 3: verify — three independent assertions ────────────────────────────
rc=0

# (a) the hook is actually in settings.json under PreCompact
if jq -e --arg c "$HOOK_CMD" \
     '.hooks.PreCompact[]?.hooks[]? | select(.type == "command") | select(.command == $c)' \
     "$SETTINGS" >/dev/null; then
  echo "verify a: PreCompact hook present in settings.json          OK"
else
  echo "verify a: PreCompact hook NOT found in settings.json        FAIL"; rc=1
fi

# (b) no matcher — the B-2 finding. A matcher here would silently drop the manual half.
if [[ "$(jq -r '[.hooks.PreCompact[]? | select(has("matcher"))] | length' "$SETTINGS")" == "0" ]]; then
  echo "verify b: no matcher (fires on auto AND manual)             OK"
else
  echo "verify b: a matcher is set — manual /compact would not fire FAIL"; rc=1
fi

# (c) zero drift: SSOT and every rendered artifact agree
if node "$ROOT/scripts/render-harness-config.mjs" --check --root "$ROOT" >/dev/null 2>&1; then
  echo "verify c: renderer --check reports zero drift               OK"
else
  echo "verify c: renderer --check reports DRIFT                    FAIL"; rc=1
fi

# (d) ZCode plugin output must NOT carry PreCompact (event is inexpressible there —
#     zcode-parity-doctrine.md row 21, accepted-degradation). Guards a silent parity claim.
if [[ -f "$ROOT/plugin/hooks/hooks.json" ]]; then
  if jq -e '.hooks | has("PreCompact")' "$ROOT/plugin/hooks/hooks.json" >/dev/null 2>&1; then
    echo "verify d: plugin/hooks.json wrongly carries PreCompact      FAIL"; rc=1
  else
    echo "verify d: plugin/hooks.json correctly omits PreCompact      OK"
  fi
fi

echo
if [[ $rc -eq 0 ]]; then
  cat <<'EOF'
ALL CHECKS PASSED.

Two things this script cannot do for you:
  1. COMMIT. Both .ai-factory/harness-model.json and .claude/settings.json are git-tracked and
     must land in ONE commit — a model-only edit goes drift-RED.
       git add .ai-factory/harness-model.json .claude/settings.json && git commit
  2. ARM IT. Hooks are snapshotted at session start, so this session is NOT armed.
     Open a fresh session, then trigger /compact to fire the manual half.

Then check the residue landed:
  ls -lt "$(bash .claude/skills/pipeline/helpers/print-orch-home.sh)"/_residue-*.md | head
EOF
else
  echo "SOME CHECKS FAILED — see above. SSOT backup (if written): $SSOT.bak"
fi
exit $rc
