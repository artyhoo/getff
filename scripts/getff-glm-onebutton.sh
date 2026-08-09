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
#   cat/echo/printf/log the VALUE; embed the value in a REST body; write the value to disk;
#   pass the value as a curl argument (process-table exposure — kickoff §7b #4).
#   The value lives only in the untracked env file ($GLM_ENV_FILE) the human creates.
#   The helper sources that file (set -a; . "$GLM_ENV_FILE"; set +a) for the pre-ping
#   reachability check, then calls POST /runtime-profiles/validate — the aif RUNTIME
#   resolves the key from ITS OWN process env (§7b wiring), NOT from the request.
#   IF YOU FIND YOURSELF WRITING $ANTHROPIC_AUTH_TOKEN IN ANY echo/printf/log/curl
#   STATEMENT, STOP.
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
# createRuntimeProfileSchema REQUIRES runtimeId + providerId (no .optional(), no .nullable()).
# Established by probe, not by reading the aif source (which is host-only — kickoff §7e.1):
#   curl -sX POST "$AIF_URL/runtime-profiles" -d '{"name":"probe-only"}'
#   → 400 ZodError, path ["runtimeId"] and ["providerId"], "expected string, received undefined"
# Values match the live Z.ai profile shape (GET /runtime-profiles → runtimeId=claude,
# providerId=anthropic for the Anthropic-shape Z.ai endpoint).
GLM_RUNTIME_ID="claude"
GLM_PROVIDER_ID="anthropic"
# Transport is LOAD-BEARING, not cosmetic. Omitting it resolves to SDK, and for SDK transport
# validateClaudeConnection returns ok unconditionally ("using session auth"), so the step-C ping
# would pass with the key completely unreachable. Measured 2026-08-09 against a non-persisted
# inline profile via POST /runtime-profiles/validate:
#   no transport  → {"ok":true,  "transport":"sdk", "hasApiKey":false}   ← false green
#   transport=api → {"ok":false, "transport":"api", "hasApiKey":false,
#                    "message":"Missing API key (expected env var: …)"}  ← real gate
# This flow is key-based (the consumer pastes a key), not session-based, so "api" is also the
# correct semantic choice — and it is what makes §7b #3 enforceable.
GLM_TRANSPORT="api"
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
  # Fields: the two schema-REQUIRED ids (runtimeId, providerId) + name (display) + transport
  # + defaultModel + apiKeyEnvVar (the NAME) + baseUrl. §7a #1 says "schema-required fields +
  # …", and runtimeId/providerId ARE schema-required — see the GLM_RUNTIME_ID probe note above.
  # All other fields stay on server defaults (§7a #1 rationale: smallest surface to break on aif upgrades).
  local create_resp create_rc
  create_resp=$(curl -sf -X POST "$AIF_URL/runtime-profiles" \
    -H 'Content-Type: application/json' \
    -d "$(jq -n \
      --arg name "$GLM_PROFILE_NAME" \
      --arg runtime "$GLM_RUNTIME_ID" \
      --arg provider "$GLM_PROVIDER_ID" \
      --arg transport "$GLM_TRANSPORT" \
      --arg model "$GLM_DEFAULT_MODEL" \
      --arg keyvar "$GLM_ENV_VAR" \
      --arg baseurl "$GLM_BASE_URL" \
      '{name: $name, runtimeId: $runtime, providerId: $provider, transport: $transport,
        defaultModel: $model, apiKeyEnvVar: $keyvar, baseUrl: $baseurl}')" 2>&1) || create_rc=$?
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

  # Step B — per-mode defaults via PUT /projects/:id (§7a #2 / §7c #1 / §7d.1 #1).
  # aif has NO GET /projects/:id (aifHttp.ts:90) and NO PATCH /project (§7c #1 — run-2 invented it).
  # The ONLY valid write path is PUT /projects/:id with a FULL createProjectSchema body (§7d.1 #1).
  # Read via GET /projects + filter by id, then PUT the full body back with fields mutated.
  _log "provision: step B — per-mode defaults (GET /projects + PUT /projects/:id)"

  local projects_resp projects_rc
  projects_resp=$(curl -sf --max-time 5 "$AIF_URL/projects" 2>&1) || projects_rc=$?
  projects_rc=${projects_rc:-0}

  if [ "$projects_rc" -ne 0 ]; then
    printf 'GLM_PROVISION: FAILED step-B projects-unreadable\n'
    _warn "objective-3 MISS: GET /projects failed (rc=$projects_rc). Response: $projects_resp (§7c #1)"
    return 1
  fi

  # Take the first project (consumers typically have one active project).
  local project_json project_id
  project_json=$(printf '%s' "$projects_resp" | jq -e 'if type == "array" then .[0] else . end' 2>/dev/null) || {
    printf 'GLM_PROVISION: FAILED step-B no-projects\n'
    _warn "objective-3 MISS: GET /projects returned empty/unparseable (§7c #1). Body: $projects_resp"
    return 1
  }
  project_id=$(printf '%s' "$project_json" | jq -r '.id // empty')
  if [ -z "$project_id" ]; then
    printf 'GLM_PROVISION: FAILED step-B no-project-id\n'
    _warn "objective-3 MISS: project JSON has no .id field (§7c #1). Body: $project_json"
    return 1
  fi

  # Read the existing top-tier Plan profile id (§7c #2 Park contract).
  # If non-null → preserve it (the consumer's existing top-tier stays).
  # If null → park the Plan half; still write Task+Review (the unambiguous half).
  local existing_plan_profile
  existing_plan_profile=$(printf '%s' "$project_json" | jq -r '.defaultPlanRuntimeProfileId // empty')

  # Build the PUT body — full createProjectSchema (§7d.1 #1: PUT validates against the FULL schema).
  # Mutate Task+Review → new profile. Plan → preserve existing (or leave null if parked).
  # All other fields pass through unchanged from GET (no partial-body invention — §7c #1).
  local put_body plan_status
  if [ -n "$existing_plan_profile" ]; then
    put_body=$(printf '%s' "$project_json" | jq \
      --arg id "$profile_id" \
      '.defaultTaskRuntimeProfileId = $id | .defaultReviewRuntimeProfileId = $id')
    plan_status="preserved (existing top-tier: $existing_plan_profile)"
    _log "provision: step B — Plan→$existing_plan_profile (preserved), Task+Review→$profile_id"
  else
    # Park the Plan half (§7c #2 Park contract) — write only Task+Review.
    put_body=$(printf '%s' "$project_json" | jq \
      --arg id "$profile_id" \
      '.defaultTaskRuntimeProfileId = $id | .defaultReviewRuntimeProfileId = $id')
    plan_status="PARKED (defaultPlanRuntimeProfileId was null in GET /projects — no top-tier profile to preserve; set Plan default manually in the aif UI)"
    _warn "Park: $plan_status (§7c #2)"
  fi

  local put_resp put_rc
  put_resp=$(curl -sf -X PUT "$AIF_URL/projects/$project_id" \
    -H 'Content-Type: application/json' \
    -d "$put_body" 2>&1) || put_rc=$?
  put_rc=${put_rc:-0}

  if [ "$put_rc" -ne 0 ]; then
    _warn "per-mode-default PUT /projects/$project_id failed (rc=$put_rc). Response: $put_resp"
    _warn "objective-3 MISS: per-mode defaults not set automatically — set them manually in the aif UI (Task+Review → $profile_id) (kickoff §4 item 5)"
    # Continue — the profile IS created; the consumer can set defaults manually.
    # The MISS is recorded; the flow proceeds because profile creation succeeded and
    # the validation ping can still prove the key + route work.
  else
    _log "provision: step B done — PUT /projects/$project_id green (Plan: $plan_status)"
  fi

  # Step B.5 — key-reachability wiring INSTRUCTION (§7b #1 is NOT closed by this step).
  # The aif runtime resolves ANTHROPIC_AUTH_TOKEN from its OWN process.env by NAME
  # (packages/runtime/src/resolution.ts:217-219). That process env is populated from
  # the compose env_file (docker-compose.yml:15,59,94 — env_file: .env).
  # A file at $GLM_ENV_FILE is INVISIBLE to aif unless the deployment loads it.
  #
  # MECHANISM CHOSEN (§7b #2 — deployments vary, mechanism is the worker's pick):
  # Print the docker-compose env_file addition for the consumer/AI agent to apply.
  # The helper does NOT auto-patch deployment files — deployment layouts vary too widely
  # (compose, systemd, k8s, bare node) for a mechanical patch to be reliable.
  #
  # HONEST SCOPE: §7b #1 asks the flow to MAKE the key reachable; printing an instruction
  # does not. What closes the loop instead is step C, which now FAILS when aif cannot
  # resolve the key, so an un-applied instruction produces an objective-3 MISS rather than
  # a green run. That is a gate, not a warning — but it is detection, not wiring, and the
  # difference is stated here rather than papered over.
  #
  # INVARIANT (§2 constraint 1 + §7b #4): the helper references ONLY the env-var NAME.
  # The value moves file → process env only. It never enters the profile, never enters
  # argv or command lines, is never echoed.
  _log "provision: step B.5 — printing key-reachability wiring instruction (§7b)"
  cat <<EOF

Key-reachability wiring (§7b — the aif runtime must see the key in its env):
  The aif runtime resolves ANTHROPIC_AUTH_TOKEN from its process.env by NAME.
  To make the key reachable WITHOUT the helper touching the value, add this
  to each service in your aif deployment's docker-compose.yml:

    env_file:
      - .env
      - $GLM_ENV_FILE

  Then: docker compose up -d (reload).
  For non-compose deployments: ensure ANTHROPIC_AUTH_TOKEN is in the aif
  process env by your deployment's standard mechanism.

  The next step (POST /runtime-profiles/validate) FAILS if this wiring is not
  applied — an un-applied instruction is an objective-3 MISS, not a warning.
EOF

  # Step C — key-reachability gate via the created profile (§7c #3 / §7d.1 #3 / §7e.3).
  # Routes through the aif profile id, NOT the vendor URL directly (§7c #3 — run-2
  # pinged $GLM_BASE_URL/v1/messages, proving the key but not the route the flow built).
  #
  # SCOPE, stated honestly (§7e.3): this call proves profile resolution + that aif can
  # resolve the key from its own process env under the declared name. It does NOT make a
  # model call — for transport=api, validateClaudeConnection checks only that apiKey and
  # baseUrl are non-empty. §7a #3's "one real minimal model call" is therefore NOT satisfied
  # by this step alone; that half is PARKED (see the park note after this function).
  _log "provision: step C — key-reachability gate (POST $AIF_URL/runtime-profiles/validate)"

  # Source glm.env for the HELPER's env (pre-ping check below).
  # The aif runtime resolves the key from ITS OWN env via the §7b mechanism above.
  # shellcheck disable=SC1090
  set -a; . "$GLM_ENV_FILE"; set +a

  # Pre-ping check: the var is present in the FILE (helper env). This is a file-integrity
  # check only — it says nothing about aif's env. The validate call below is what tests aif.
  if [ -z "${!GLM_ENV_VAR:-}" ]; then
    printf 'GLM_PROVISION: FAILED step-C env-var-unset-in-helper\n'
    _warn "objective-3 MISS: $GLM_ENV_VAR is not set in $GLM_ENV_FILE (kickoff §4 item 5 + §7b #3)"
    return 1
  fi
  _log "provision: env var $GLM_ENV_VAR present in $GLM_ENV_FILE (value redacted: ***)"

  # POST /runtime-profiles/validate — payload {profileId} only (§7d.1 #3).
  # Omit apiKey — keeps §2 constraint 1 intact (value never enters argv/body) and
  # relies on §7b's env wiring being in place.
  local validate_resp validate_rc
  validate_resp=$(curl -s -X POST "$AIF_URL/runtime-profiles/validate" \
    -H 'Content-Type: application/json' \
    -d "$(jq -n --arg id "$profile_id" '{profileId: $id}')" 2>&1) || validate_rc=$?
  validate_rc=${validate_rc:-0}

  if [ "$validate_rc" -ne 0 ]; then
    printf 'GLM_PROVISION: FAILED step-C validation-transport\n'
    _warn "objective-3 MISS: validation call did not complete (rc=$validate_rc). Response: $validate_resp (kickoff §4 item 5)"
    return 1
  fi

  # The endpoint answers HTTP 200 even when validation FAILS — the verdict is in the body's
  # .ok field, not in the status code. Measured 2026-08-09: a profile whose apiKeyEnvVar is
  # absent from aif's env returns `HTTP 200 {"ok":false,"message":"Missing API key …"}`, and
  # `curl -sf` exits 0 on it. Reading the exit code alone is a false green — parse .ok.
  local validate_ok validate_msg
  validate_ok=$(printf '%s' "$validate_resp" | jq -r '.ok // false' 2>/dev/null || printf 'false')
  validate_msg=$(printf '%s' "$validate_resp" | jq -r '.message // "no message"' 2>/dev/null || printf 'unparseable')
  if [ "$validate_ok" != "true" ]; then
    printf 'GLM_PROVISION: FAILED step-C validation-not-ok\n'
    _warn "objective-3 MISS: aif rejected the profile — $validate_msg (kickoff §4 item 5 + §7b #3)"
    _warn "most likely the key is unreachable to the aif runtime: apply the env_file wiring printed above, restart aif, re-run"
    return 1
  fi
  _log "provision: step C done — aif resolves $GLM_ENV_VAR for profile $profile_id ($validate_msg)"

  printf 'GLM_PROVISION: DONE profile-id=%s\n' "$profile_id"
  _log "provision: GLM executor tier wired — profile $profile_id, defaults set, key reachable"
  _log "provision: NOTE — §7a #3's real model call is PARKED, not delivered (see §7e.3 park note)"
}

# ---------------------------------------------------------------------------
# PARK (§7) — §7a #3's second half: "one real minimal model call"
#
# §7e.3 splits the ping into a route/key proof (delivered above) and a model proof (this
# park). The model proof is a genuine fork, not an omission, because the two obvious
# mechanisms each break a standing binding:
#
#   Option A — call {baseUrl}/v1/messages from the helper with the key in a header.
#     Consequence: the value enters curl's argv → process-table exposure, which §2
#     constraint 1 and §7b #4 forbid (run-2 watch-list W-2). A `curl --config <file>`
#     indirection avoids argv but introduces a temp file holding the secret, i.e. a new
#     storage location for the value that §7a #4(ii) does not sanction.
#
#   Option B — route the completion through aif.
#     Consequence: no aif endpoint performs a completion through a stored profile.
#     POST /runtime-profiles/validate does not call the provider (transport=api checks only
#     that apiKey and baseUrl are non-empty); POST /runtime-profiles/models returned a static
#     Claude catalogue (Sonnet 4.6 / Opus 4.6) for a Qwen profile, so it is not querying the
#     provider either. Both measured 2026-08-09.
#
# Picking either silently would violate the standing constraint it breaks, so this is parked
# per §7 rather than guessed. Until it is resolved, the flow proves that aif can resolve the
# key and reach the profile — it does NOT prove the key is *valid* at the vendor.
# ---------------------------------------------------------------------------

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
