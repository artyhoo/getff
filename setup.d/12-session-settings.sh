#!/usr/bin/env bash
# setup.d/12-session-settings.sh — the session-settings group into .claude/settings.local.json,
# only on the pre-launch «yes» (GETFF_SESSION_SETTINGS=1). Logic + rationale: setup.d/session-settings.sh.
#
# Sources: lib.sh (already in dispatcher scope)
# @cc-only-rationale: sourced by install.sh dispatcher, not standalone

echo "▶ Session settings → .claude/settings.local.json"
# shellcheck source=setup.d/session-settings.sh
. "$PKG_ROOT/setup.d/session-settings.sh"
apply_session_settings "$PROJECT_ROOT"
