#!/usr/bin/env bash
# apply-seal-primary-wiring.sh — idempotent one-command wiring of the
# seal-primary-checkout deny gate into the runtime hook config.
#
# WHAT IT DOES: appends the PreToolUse entry for
# .claude/hooks/seal-primary-checkout.sh to the SSOT
# (.ai-factory/harness-model.json, hooks.PreToolUse), regenerates the derived
# configs with scripts/render-harness-config.mjs --write, validates the result,
# and runs the paired test suite as the self-test.
#
# WHY THE SSOT, NOT settings.json: settings.json's `hooks` key is OWNED by the
# renderer (render-harness-config.mjs: "CC backend: owns ONLY `hooks` in
# settings.json (merge ...)"). A hand patch there is clobbered by the next
# --write and flagged as drift by --check. The sanctioned channel — the one
# check-hook-marker.sh itself prescribes — is: edit harness-model.json, run
# the render. This script automates that channel; it never hand-writes
# settings.json.
#
# MAINTAINER-ONLY by design: .claude/settings.json is agent-uncommittable (its
# own deny rules; PR #279 precedent — hooks may ship unregistered until a
# maintainer wires them). The render is the only writer of the sealed file and
# runs solely under the maintainer's hand via this script.
#
# Modes:
#   (no flags)   apply — backup, patch SSOT, render, validate, self-test
#   --dry-run    read-only preview: prerequisites, current drift state, the
#                exact entry that would be appended; writes nothing
#   --help       this text
#
# Idempotent: if the entry is already wired (SSOT + settings.json agree), the
# script validates and re-runs the self-test but writes nothing and makes no
# backup.
#
# Rollback: the apply mode backs both files up to
# .ai-factory/wiring-backups/<UTC-timestamp>/ and prints the paths; restore
# with cp, or `git checkout --` (both files are tracked).
#
# Exit codes: 0 ok (including already-wired), 1 any step failed.
set -euo pipefail

usage() { sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'; }

MODE=apply
case "${1:-}" in
  "") ;;
  --dry-run) MODE=dry-run ;;
  --help | -h) usage; exit 0 ;;
  *) printf 'unknown flag: %s\n\n' "$1" >&2; usage; exit 1 ;;
esac

REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
SSOT="$REPO_ROOT/.ai-factory/harness-model.json"
SETTINGS="$REPO_ROOT/.claude/settings.json"
RENDER="$REPO_ROOT/scripts/render-harness-config.mjs"
PAIRED_TEST="$REPO_ROOT/tests/hooks/seal-primary-checkout.test.sh"
HOOK="$REPO_ROOT/.claude/hooks/seal-primary-checkout.sh"
MARKER='seal-primary-checkout.sh'

# shellcheck disable=SC2016  # $CLAUDE_PROJECT_DIR must stay LITERAL — the runtime expands it at hook fire time
ENTRY='{"matcher":"Edit|Write|MultiEdit","command":"bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/seal-primary-checkout.sh\""}'

fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }

# ── Prerequisites ─────────────────────────────────────────────────────────────
command -v jq >/dev/null 2>&1 || fail "jq is required (brew install jq)"
command -v node >/dev/null 2>&1 || fail "node is required (the render is a node script)"
for f in "$SSOT" "$SETTINGS" "$RENDER" "$PAIRED_TEST" "$HOOK"; do
  [ -f "$f" ] || fail "missing file: $f"
done

ssot_wired() {
  # any(GEN; COND) evaluates GEN against the PIPE input (the array), not per
  # element — `.command` on an array is a jq type error, so the naive form was
  # always-false (broke idempotency: a wired SSOT re-patched, duplicating the
  # entry). Collect first, then any over the flat list.
  jq -e --arg m "$MARKER" '[(.hooks.PreToolUse // [])[]?.command] | any(contains($m))' \
    "$SSOT" >/dev/null 2>&1
}
settings_wired() {
  jq -e --arg m "$MARKER" \
    '[(.hooks.PreToolUse // [])[]?.hooks[]?.command] | any(contains($m))' \
    "$SETTINGS" >/dev/null 2>&1
}

ssot_wired_now=0
settings_wired_now=0
if ssot_wired; then ssot_wired_now=1; fi
if settings_wired; then settings_wired_now=1; fi

if [ "$ssot_wired_now" -eq 1 ] && [ "$settings_wired_now" -eq 1 ]; then
  WIRED=already
elif [ "$ssot_wired_now" -eq 1 ]; then
  WIRED=render-only   # SSOT patched but the render never ran (or was reverted)
else
  WIRED=no
fi

# ── Dry-run: preview only ─────────────────────────────────────────────────────
if [ "$MODE" = dry-run ]; then
  printf 'dry-run — no file will be written\n'
  printf 'repo:    %s\n' "$REPO_ROOT"
  printf 'SSOT:    %s (wired: %s)\n' "$SSOT" "$([ "$ssot_wired_now" -eq 1 ] && echo yes || echo no)"
  printf 'settings:%s (wired: %s)\n' "" "$([ "$settings_wired_now" -eq 1 ] && echo yes || echo no)"
  printf 'entry to append to .hooks.PreToolUse of the SSOT:\n'
  printf '%s' "$ENTRY" | jq .
  CHECK_PRE=$(node "$RENDER" --check --root "$REPO_ROOT" 2>&1 || true)
  if grep -q '\.claude/settings\.json: drift' <<<"$CHECK_PRE"; then
    printf 'render --check now: settings.json DRIFT (unexpected pre-state — investigate before applying)\n'
  else
    printf 'render --check now: settings.json in sync (any other drift is the gitignored zcode shim, not this wiring)\n'
  fi
  printf 'apply would: backup both files to .ai-factory/wiring-backups/<ts>/,\n'
  printf '  patch the SSOT via jq (tmp+mv), run render --write twice (byte-convergence gate),\n'
  printf '  verify the entry landed in settings.json, run the paired test suite.\n'
  exit 0
fi

# ── Apply ─────────────────────────────────────────────────────────────────────
BACKUP_DIR=""
if [ "$WIRED" = no ]; then
  BACKUP_DIR="$REPO_ROOT/.ai-factory/wiring-backups/$(date -u +%Y%m%dT%H%M%SZ)"
  mkdir -p "$BACKUP_DIR/.claude"
  cp "$SSOT" "$BACKUP_DIR/harness-model.json"
  cp "$SETTINGS" "$BACKUP_DIR/.claude/settings.json"
  printf 'backup:  %s\n' "$BACKUP_DIR"
fi

if [ "$WIRED" = no ]; then
  TMP="$(mktemp "${TMPDIR:-/tmp}/ssot-patch.XXXXXX")"
  jq --argjson e "$ENTRY" '.hooks.PreToolUse = ((.hooks.PreToolUse // []) + [$e])' \
    "$SSOT" >"$TMP"
  mv "$TMP" "$SSOT"
  printf 'patched: %s (entry appended to hooks.PreToolUse)\n' "$SSOT"
else
  printf 'SSOT already wired — skipping the patch (idempotent)\n'
fi

# --root is PINNED to the script's own repo: the render otherwise resolves the
# SSOT by walking up from process.cwd(), so invoking this script from a
# different checkout (a worktree, another clone) would read and write THAT
# repo's config — measured live (e2e clone run): entry patched into the clone's
# SSOT, render consumed the caller's cwd repo instead.
printf 'render:  node scripts/render-harness-config.mjs --write --root %s\n' "$REPO_ROOT"
node "$RENDER" --write --root "$REPO_ROOT" >/dev/null || fail "render --write failed — restore from ${BACKUP_DIR:-git checkout}"

# ── Validate ──────────────────────────────────────────────────────────────────
jq -e . "$SSOT" >/dev/null 2>&1 || fail "SSOT no longer parses — restore from ${BACKUP_DIR:-git checkout}"
jq -e . "$SETTINGS" >/dev/null 2>&1 || fail "settings.json no longer parses — restore from ${BACKUP_DIR:-git checkout}"
settings_wired || fail "entry absent from settings.json hooks.PreToolUse after render — restore from ${BACKUP_DIR:-git checkout}"

# Byte-convergence instead of a bare --check: rerun the render and require the
# settings.json bytes to be stable — that IS per-file "in sync with the SSOT".
# A global --check exit 1 is NOT usable as the gate: it also counts the
# gitignored maintainer-env .zcode/ shim (hooks pending interactive trust on
# ZCode), which is pre-existing and not this wiring's concern. That class is
# reported, and becomes fatal ONLY when the drift line names settings.json.
HASH1=$(cksum "$SETTINGS")
node "$RENDER" --write --root "$REPO_ROOT" >/dev/null || fail "second render --write failed — restore from ${BACKUP_DIR:-git checkout}"
HASH2=$(cksum "$SETTINGS")
[ "$HASH1" = "$HASH2" ] || fail "render output did not converge (settings.json changed between consecutive --write runs) — restore from ${BACKUP_DIR:-git checkout}"

CHECK_OUT=$(node "$RENDER" --check --root "$REPO_ROOT" 2>&1 || true)
if grep -q '\.claude/settings\.json: drift' <<<"$CHECK_OUT"; then
  fail "render --check reports .claude/settings.json drift after --write — restore from ${BACKUP_DIR:-git checkout}"
fi
if grep -q 'drift' <<<"$CHECK_OUT"; then
  printf 'note: pre-existing render --check drift OUTSIDE settings.json (gitignored maintainer-env shim) — not introduced by this wiring\n'
fi

MATCHER=$(jq -r --arg m "$MARKER" \
  '(.hooks.PreToolUse // []) | map(select(any(.hooks[].command; contains($m)))) | .[0].matcher // ""' \
  "$SETTINGS" 2>/dev/null || true)
[ -n "$MATCHER" ] || fail "could not read back the registered matcher from settings.json"
for tool in Edit Write MultiEdit; do
  case "|$MATCHER|" in
    *"|$tool|"*) ;;
    *) fail "registered matcher '$MATCHER' does not deliver $tool (matcher-parity: the hook body case-arms all three)" ;;
  esac
done
printf 'validated: settings.json parses, entry present, matcher "%s", render --check in sync\n' "$MATCHER"

# ── Self-test: the paired suite ───────────────────────────────────────────────
printf 'self-test: bash tests/hooks/seal-primary-checkout.test.sh\n'
if ! bash "$PAIRED_TEST"; then
  fail "paired test suite failed after wiring — restore from ${BACKUP_DIR:-git checkout} and investigate"
fi

printf '\nOK: seal-primary-checkout is wired. Fresh sessions load it on spawn;\n'
printf 'cross-session probes: edit %s/.claude/settings.json from a NEW worktree session — expect the deny reason.\n' "$REPO_ROOT"
[ -n "$BACKUP_DIR" ] && printf 'backups (untracked, deletable once the wiring commit lands): %s\n' "$BACKUP_DIR"
exit 0
