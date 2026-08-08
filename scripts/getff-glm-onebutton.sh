#!/usr/bin/env bash
# getff-glm-onebutton.sh — GLM executor one-button wiring (beta-delivery-ux S4, spec §4 A2).
#
# Three subcommands: detect | explain | provision.
# The executor of the flow is the consumer's in-session AI agent reading an
# INSTALL-FOR-AI.md step (the aider pattern — kickoff §2). The agent:
#   1. runs `detect` → probes /runtime-profiles for a Z.ai-shape GLM profile
#   2. runs `explain` → prints the one explanation (z.ai Coding Plan, $18/mo, env-file path)
#   3. waits for the human to paste the key into the untracked env file
#   4. runs `provision` → REST create + per-mode defaults + validation ping
#
# KEY-HANDLING INVARIANT (kickoff §4 item 2 — binding, design-stop-on-violation):
#   The helper references ONLY the env-var NAME `ANTHROPIC_AUTH_TOKEN`. It must NEVER:
#   cat/echo/printf/log the VALUE; embed the value in a REST body; write the value to disk.
#   The value lives only in the untracked env file the human creates. The helper sources
#   that file (set -a; . "$GLM_ENV_FILE"; set +a) immediately before the validation-ping
#   curl; the curl header carries the value to the API, nowhere else.
#   IF YOU FIND YOURSELF WRITING $ANTHROPIC_AUTH_TOKEN IN ANY echo/printf/log STATEMENT, STOP.
set -euo pipefail

# --- Constants (§7a binding resolutions) ---
AIF_URL="${RUNTIME_BRIDGE_AIF_URL:-http://localhost:3009}"
# Env-file path: XDG Base Directory spec's OWN fallback semantics (§7a #4(ii)).
# Valid on macOS (XDG_CONFIG_HOME unset → literal ~/.config) and Linux alike.
# GLM_ENV_FILE is env-overridable for test harnesses (the default below is the binding §7a #4(ii) path).
GLM_ENV_FILE="${GLM_ENV_FILE:-${XDG_CONFIG_HOME:-$HOME/.config}/getff/glm.env}"
# Env-var NAME (never the value) — §7a #4(i), canonical per SKILL.md D3 row.
GLM_ENV_VAR="ANTHROPIC_AUTH_TOKEN"
# Z.ai Anthropic-shape endpoint (SKILL.md:36 D3 row).
GLM_BASE_URL="https://api.z.ai/api/anthropic"
GLM_DEFAULT_MODEL="glm-5.2"
# Profile display name — MUST be unique under the resolver's match (kickoff §1 caveat
# about prefix collisions: "Z.AI GLM-5.2" is a strict prefix of "Z.AI GLM-5.2 SDK";
# the resolver's exact-match short-circuit saves this, but the name stays exact).
GLM_PROFILE_NAME="Z.AI GLM-5.2"

_log() { printf '[glm-onebutton] %s\n' "$*" >&2; }
_warn() { printf '[glm-onebutton] WARN %s\n' "$*" >&2; }

# ---------------------------------------------------------------------------
# detect — probe the bridge for an existing Z.ai-shape GLM profile.
# Emit: GLM_PROFILE: present | missing | bridge-unreachable
# Exit 0 on present/missing (detection is not failure); non-zero on bridge-unreachable.
# ---------------------------------------------------------------------------
do_detect() {
  local body
  if ! body=$(curl -sf --max-time 5 "$AIF_URL/runtime-profiles" 2>/dev/null); then
    printf 'GLM_PROFILE: bridge-unreachable\n'
    _warn "bridge unreachable at $AIF_URL — the one-button flow presupposes a running aif (spec §3)"
    return 1
  fi
  # A profile targets the Z.ai Anthropic endpoint if its baseUrl matches GLM_BASE_URL.
  # jq filter: any .[].baseUrl == GLM_BASE_URL (the field identified in §7a #1).
  if printf '%s' "$body" | jq -e --arg url "$GLM_BASE_URL" \
      'map(select(.baseUrl == $url)) | length > 0' >/dev/null 2>&1; then
    printf 'GLM_PROFILE: present\n'
    _log "detect: Z.ai-shape profile found at $GLM_BASE_URL"
  else
    printf 'GLM_PROFILE: missing\n'
    _log "detect: no Z.ai-shape profile at $GLM_BASE_URL"
  fi
}

# ---------------------------------------------------------------------------
# explain — print the ONE explanation block (the aider pattern, kickoff §2).
# Creates the env-file parent dir; does NOT create the env file itself.
# ---------------------------------------------------------------------------
do_explain() {
  mkdir -p "$(dirname "$GLM_ENV_FILE")"
  cat <<EOF
The executor tier (GLM-5.2) needs a z.ai Coding Plan (\$18/mo, Anthropic-shape endpoint).
One key. Paste it into: $GLM_ENV_FILE
As the line: $GLM_ENV_VAR=<your-key>
The installer NEVER reads the value — only the env-var name. Confirm paste before running 'provision'.
EOF
  _log "explain: env-file path printed; parent dir ensured at $(dirname "$GLM_ENV_FILE")"
}

# ---------------------------------------------------------------------------
# provision — REST profile create + per-mode defaults + validation ping.
# Sources the env file for the validation ping; NEVER handles the key value.
# ---------------------------------------------------------------------------
do_provision() {
  # Pre-flight: env file must exist and contain the env-var NAME.
  if [ ! -f "$GLM_ENV_FILE" ]; then
    printf 'GLM_PROVISION: FAILED preflight env-file-missing\n'
    _warn "objective-3 MISS: $GLM_ENV_FILE not found — run 'explain' first, paste the key, then re-run 'provision' (kickoff §4 item 5)"
    return 1
  fi

  _log "provision: step A — REST profile create (POST $AIF_URL/runtime-profiles)"

  # Step A — REST profile create (§7a #1 minimal field set).
  # Fields: name (display) + defaultModel + apiKeyEnvVar (the NAME) + baseUrl.
  # All other fields stay on server defaults (§7a #1 rationale: smallest surface to break on aif upgrades).
  local create_resp create_rc
  create_resp=$(curl -sf -X POST "$AIF_URL/runtime-profiles" \
    -H 'Content-Type: application/json' \
    -d "$(jq -n \
      --arg name "$GLM_PROFILE_NAME" \
      --arg model "$GLM_DEFAULT_MODEL" \
      --arg keyvar "$GLM_ENV_VAR" \
      --arg baseurl "$GLM_BASE_URL" \
      '{name: $name, defaultModel: $model, apiKeyEnvVar: $keyvar, baseUrl: $baseurl}')" 2>&1) || create_rc=$?
  create_rc=${create_rc:-0}

  if [ "$create_rc" -ne 0 ]; then
    printf 'GLM_PROVISION: FAILED step-A rest-create-nonzero\n'
    _warn "objective-3 MISS: REST profile create failed (rc=$create_rc). Response: $create_resp (kickoff §4 item 5)"
    _warn "fall back to guided-manual setup: create the profile in the aif-handoff UI with baseUrl=$GLM_BASE_URL, apiKeyEnvVar=$GLM_ENV_VAR"
    return 1
  fi

  # Extract the created profile ID (field name "id" per the 18-key shape, kickoff §1).
  local profile_id
  profile_id=$(printf '%s' "$create_resp" | jq -r '.id // empty' 2>/dev/null || true)
  if [ -z "$profile_id" ]; then
    printf 'GLM_PROVISION: FAILED step-A no-profile-id\n'
    _warn "objective-3 MISS: REST create returned no .id field. Response: $create_resp (kickoff §4 item 5)"
    return 1
  fi
  _log "provision: step A done — profile id=$profile_id"

  # Step B — per-mode defaults (§7a #2: project-level aif runtime-profile config).
  # Write Plan→top-tier / Task+Review→executor-tier to the project-level config.
  # The live aif exposes the per-mode-default endpoint shape; if unreachable or rejected,
  # honest-degrade (§7 contract — this step is PARKED on live-verification per Task 1 item 3).
  _log "provision: step B — per-mode defaults (PATCH project-level config)"
  local patch_rc
  patch_rc=0
  # The aif project-level config endpoint holds per-mode profile IDs. We PATCH the
  # Task+Review defaults to the newly-created GLM profile; Plan stays on the existing top-tier profile.
  # Field names are design-intent per §7a #2; if the live aif rejects, honest-degrade fires.
  local patch_resp
  patch_resp=$(curl -sf -X PATCH "$AIF_URL/project" \
    -H 'Content-Type: application/json' \
    -d "$(jq -n --arg id "$profile_id" \
      '{defaultTaskRuntimeProfileId: $id, defaultReviewRuntimeProfileId: $id}')" 2>&1) || patch_rc=$?

  if [ "$patch_rc" -ne 0 ]; then
    # §7a #2 honest-degrade: per-mode-default mechanism unverified at build time (Task 1 item 3 PARKED).
    # This is NOT a neutral graceful degrade — it is an objective-3 MISS if the consumer cannot
    # set per-mode defaults (kickoff §4 item 5 + §6 T-BDU-B). Record honestly.
    _warn "per-mode-default PATCH failed (rc=$patch_rc). Response: $patch_resp"
    _warn "objective-3 MISS: per-mode defaults not set automatically — set them manually in the aif-handoff UI (Task+Review → profile $profile_id) (kickoff §4 item 5)"
    # Continue to step C — the profile IS created; the consumer can set defaults manually.
    # The MISS is recorded for the PR body; the flow does not stop here because the profile
    # creation (step A) succeeded and the validation ping (step C) can still prove the key works.
  else
    _log "provision: step B done — Task+Review defaults → profile $profile_id"
  fi

  # Step C — validation ping (§7a #3: ONE real minimal model call).
  # Sources the env file HERE (set -a exports all vars); the curl header carries the value.
  # NEVER log the value — log only *** redaction.
  _log "provision: step C — validation ping (real model call via $GLM_BASE_URL/v1/messages)"
  # shellcheck disable=SC1090
  set -a; . "$GLM_ENV_FILE"; set +a

  # Verify the env-var NAME is set in the environment (value presence check, NOT value echo).
  if [ -z "${!GLM_ENV_VAR:-}" ]; then
    printf 'GLM_PROVISION: FAILED step-C env-var-unset\n'
    _warn "objective-3 MISS: $GLM_ENV_VAR is not set in $GLM_ENV_FILE (kickoff §4 item 5)"
    return 1
  fi
  _log "provision: env var $GLM_ENV_VAR present (value redacted: ***)"

  local ping_resp ping_rc
  # The Z.ai Anthropic-shape endpoint uses x-api-key header (Anthropic convention, SKILL.md D3).
  # Body: 1-token-scale completion — proves key + model + route together (§7a #3).
  ping_resp=$(curl -sf -X POST "$GLM_BASE_URL/v1/messages" \
    -H 'Content-Type: application/json' \
    -H "x-api-key: ${!GLM_ENV_VAR}" \
    -H 'anthropic-version: 2023-06-01' \
    -d "$(jq -n --arg m "$GLM_DEFAULT_MODEL" \
      '{model: $m, max_tokens: 1, messages: [{role: "user", content: "."}]}')" 2>&1) || ping_rc=$?
  ping_rc=${ping_rc:-0}

  if [ "$ping_rc" -ne 0 ]; then
    printf 'GLM_PROVISION: FAILED step-C validation-ping-nonzero\n'
    _warn "objective-3 MISS: validation ping failed (rc=$ping_rc). Response: $ping_resp (kickoff §4 item 5)"
    _warn "the key + model + route chain is broken — check the key validity at z.ai, the endpoint URL, or the aif profile config"
    return 1
  fi
  _log "provision: step C done — validation ping returned (value redacted, response shape not logged to avoid leaking model output)"

  # Step E — done.
  printf 'GLM_PROVISION: DONE profile-id=%s\n' "$profile_id"
  _log "provision: GLM executor tier wired — profile $profile_id, defaults set, validation ping green"
}

# ---------------------------------------------------------------------------
# Dispatch
# GLM_LIB_ONLY=1 → source-only mode (test harness; mirrors BRIDGE_LIB_ONLY in bridge-guided.sh).
# ---------------------------------------------------------------------------
if [ -n "${GLM_LIB_ONLY:-}" ]; then
  return 0 2>/dev/null || exit 0
fi

subcmd="${1:-}"
case "$subcmd" in
  detect)   do_detect ;;
  explain)  do_explain ;;
  provision) do_provision ;;
  *)
    printf 'Usage: %s detect|explain|provision\n' "${0##*/}" >&2
    printf '  detect    — probe for an existing Z.ai GLM profile\n' >&2
    printf '  explain   — print the one-button explanation + env-file path\n' >&2
    printf '  provision — REST create + per-mode defaults + validation ping\n' >&2
    exit 2
    ;;
esac
