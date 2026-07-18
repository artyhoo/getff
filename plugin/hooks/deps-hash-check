#!/usr/bin/env bash
# @dual-pair: deps-hash-check-dogfood
# spec: packages/core/hooks/deps-hash-check.sh — packages/ copy is the SOURCE shipped by
# install.sh:261; .claude/ copy is this repo's dogfood instance wired in settings.json;
# plugin/hooks/deps-hash-check is the consumer-plugin twin (T-PLUG-A). All three are kept
# byte-identical; drift is guarded by deps-hash-check.test.ts (#382 §6).
# Consumer-facing UserPromptSubmit hook — D7=a (Wave 5.3).
# Compares sha256 of current package.json deps against deps-hash stored in
# .ai-factory/tool-decisions.md. On mismatch → prints one-line WARN to stdout
# (Claude Code harness injects stdout into session context automatically).
# Under ZCode, stdout must be strict-JSON {additionalContext} (plain is discarded);
# _emit_warn inlines that so one byte-identical file serves both harnesses.
# Always exits 0 — non-blocking, context injection only.
#
# Register in consumer's .claude/settings.json:
#   "UserPromptSubmit": [{"hooks":[{"type":"command","command":"bash .claude/hooks/deps-hash-check.sh"}]}]

set -uo pipefail

# T-PLUG-A: plugin channel sets CLAUDE_PROJECT_DIR; pin cwd there so the bare-relative
# package.json / .ai-factory/tool-decisions.md reads below resolve to the CONSUMER root (not the
# plugin payload dir). When CLAUDE_PROJECT_DIR is unset (dogfood / install-copy / tests), rely on
# invocation-cwd unchanged from pre-relocation behaviour. One byte-identical file serves all three
# instances (packages/ SSOT, .claude/ dogfood, plugin/ twin) — guarded by deps-hash-check.test.ts.
[ -n "${CLAUDE_PROJECT_DIR:-}" ] && { cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0; }

# Harness-portable output: CC auto-injects plain stdout; ZCode needs JSON. Inlined (not
# sourced from lib/) because install.sh ships this file standalone to consumers (no lib/).
_emit_warn() {
  if [ -n "${ZCODE_PROJECT_DIR:-}" ] && command -v jq >/dev/null 2>&1; then
    jq -n --arg c "$1" '{additionalContext:$c}'
  else
    printf '⚠ %s\n' "$1"
  fi
}

DECISIONS=".ai-factory/tool-decisions.md"

# If no tool-decisions.md exists yet, nothing to compare against.
[ -f "$DECISIONS" ] || exit 0

# Extract stored deps-hash from YAML frontmatter (first line matching "deps-hash:").
STORED_HASH=$(grep -m1 "^deps-hash:" "$DECISIONS" 2>/dev/null | sed 's/^deps-hash:[[:space:]]*//' || true)
[ -z "$STORED_HASH" ] && exit 0

# Recompute current hash. Requires node (same dep as the rest of the framework).
[ -f package.json ] || exit 0
if ! command -v node >/dev/null 2>&1; then exit 0; fi

DEPS_JSON=$(node -e \
  "const p=JSON.parse(require('fs').readFileSync('package.json','utf8')); \
   console.log(JSON.stringify({...p.dependencies,...p.devDependencies}))" \
  2>/dev/null || true)
[ -z "$DEPS_JSON" ] && exit 0

if command -v sha256sum >/dev/null 2>&1; then
  CURRENT_HASH="sha256-$(printf '%s' "$DEPS_JSON" | sha256sum | awk '{print $1}')"
elif command -v shasum >/dev/null 2>&1; then
  CURRENT_HASH="sha256-$(printf '%s' "$DEPS_JSON" | shasum -a 256 | awk '{print $1}')"
else
  exit 0
fi

if [ "$CURRENT_HASH" != "$STORED_HASH" ]; then
  # Distinguish a real drift (a stored sha256- baseline that no longer matches) from an
  # UNBASELINED state (the install-time `<pending …>` placeholder). On a fresh install
  # nothing has "changed" and there was no prior baseline — saying so honestly avoids the
  # misleading "deps changed" message (GH #548, Option B: keep the per-prompt onboarding
  # nudge, fix only the wording).
  case "$STORED_HASH" in
    sha256-*)
      _emit_warn "package.json deps changed since last tool-bootstrap — run /tool-bootstrapping to re-evaluate"
      ;;
    *)
      _emit_warn "tool decisions not yet baselined — run /tool-bootstrapping to record current package.json deps"
      ;;
  esac
fi

exit 0
