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

# Path to the consumer's aif-handoff checkout. Mirrors the canonical path that
# setup.d/aif-handoff-guided-install.sh:30 clones to. Env-overridable for consumers who
# keep aif in a non-standard location.
AIF_HANDOFF_CHECKOUT="${AIF_HANDOFF_CHECKOUT:-$HOME/code/aif-handoff}"

# ---------------------------------------------------------------------------
# _wire_key_reachability — §7b #1 / §7e.4 wiring mechanism (W1 best-effort).
#
# Makes the key value reachable in the aif runtime's process env by adding
# $GLM_ENV_FILE to each service's env_file list via a marked override file.
# The override is named docker-compose.override.yml so docker compose auto-merges
# it without changing how the consumer invokes `docker compose up`.
#
# Return codes (the caller falls through to the W2 instruction print on non-zero):
#   0  — wiring applied, OR already present (idempotent), OR reloaded successfully
#   1  — deployment not detected (no docker-compose.yml at $AIF_HANDOFF_CHECKOUT)
#   2  — deployment detected but wiring could not be applied safely (existing
#         unmarked override, unwritable path, no services parsed, docker absent)
#
# INVARIANT (§2 constraint 1 + §7b #4): the helper references ONLY the env-var NAME.
# This function writes PATHS to glm.env, never the value. The value stays in
# glm.env; docker compose's env_file merge loads it into the aif process env.
# ---------------------------------------------------------------------------
_wire_key_reachability() {
  local checkout="$AIF_HANDOFF_CHECKOUT"
  local compose_yml="$checkout/docker-compose.yml"
  local override_yml="$checkout/docker-compose.override.yml"
  local marker='# getff-glm-override-marker — managed by getff-glm-onebutton.sh provision'

  # W1 detector: canonical aif-handoff docker-compose deployment must exist.
  if [ ! -f "$compose_yml" ]; then
    _log "wire: no docker-compose.yml at $compose_yml — W1 does not apply"
    return 1
  fi

  # Idempotency: if our marker is already in the override, no-op (W1 succeeded before).
  if [ -f "$override_yml" ] && grep -qF 'getff-glm-override-marker' "$override_yml"; then
    _log "wire: $override_yml already carries our marker — idempotent no-op"
    return 0
  fi

  # Collision: an override exists WITHOUT our marker — do NOT clobber consumer state.
  if [ -f "$override_yml" ]; then
    _warn "wire: $override_yml exists without our marker — backing off (W2 fallback)"
    return 2
  fi

  # Detect service names from the parent compose file. Naive grep parse: matches
  # top-level `  <name>:` lines under `services:`. Sufficient for typical aif-handoff
  # compose layouts (api/agent/worker). For non-standard layouts the parse returns empty
  # and we back off rather than guessing.
  local services
  services=$(awk '
    /^services:[[:space:]]*$/ { in_services=1; next }
    /^[a-zA-Z]/ { in_services=0 }
    in_services && /^  [a-zA-Z0-9_-]+:/ {
      sub(/^  /, ""); sub(/:.*$/, ""); print
    }
  ' "$compose_yml" | sort -u)
  if [ -z "$services" ]; then
    _warn "wire: no services parsed from $compose_yml — W2 fallback"
    return 2
  fi

  # Write the override. Lists BOTH .env (preserve existing parent entries under
  # replace-merge semantics) and $GLM_ENV_FILE (the canonical key path per §7a #4(ii)).
  # Under append-merge semantics the duplicate .env is harmless (compose dedupes).
  # Persistence: the override is the canonical wiring artifact. Removal rolls back.
  {
    printf '%s\n' "$marker"
    printf '# Remove this file to undo the getff GLM key wiring.\n'
    printf '# The value lives only in %s; this file references the path.\n' "$GLM_ENV_FILE"
    printf 'services:\n'
    local svc
    for svc in $services; do
      printf '  %s:\n' "$svc"
      printf '    env_file:\n'
      printf '      - .env\n'
      printf '      - %s\n' "$GLM_ENV_FILE"
    done
  } > "$override_yml" 2>/dev/null || {
    _warn "wire: cannot write $override_yml — W2 fallback"
    return 2
  }
  _log "wire: wrote $override_yml covering services: $(printf '%s' "$services" | tr '\n' ' ')"

  # Best-effort reload. If docker isn't in PATH or compose fails, the override IS
  # persisted — the consumer can `docker compose up -d` manually. The §7e.4 hasApiKey
  # gate below is what makes an un-reloaded wiring honest (it returns false until applied).
  if ! command -v docker >/dev/null 2>&1; then
    _warn "wire: docker not in PATH — override persisted; consumer must run 'docker compose up -d' in $checkout"
    return 0  # W1 wiring IS written; reload is the consumer's job
  fi
  _log "wire: docker compose up -d (best-effort reload) in $checkout"
  if ! (cd "$checkout" && docker compose up -d) >&2; then
    _warn "wire: docker compose up -d failed — override persisted, reload manually"
  fi
  return 0
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
      '.defaultTaskRuntimeProfileId = $id | .defaultReviewRuntimeProfileId = $id
       | with_entries(select(.value != null or ((.key | endswith("MaxBudgetUsd")) | not)))')
    plan_status="preserved (existing top-tier: $existing_plan_profile)"
    _log "provision: step B — Plan→$existing_plan_profile (preserved), Task+Review→$profile_id"
  else
    # Park the Plan half (§7c #2 Park contract) — write only Task+Review.
    put_body=$(printf '%s' "$project_json" | jq \
      --arg id "$profile_id" \
      '.defaultTaskRuntimeProfileId = $id | .defaultReviewRuntimeProfileId = $id
       | with_entries(select(.value != null or ((.key | endswith("MaxBudgetUsd")) | not)))')
    plan_status="PARKED (defaultPlanRuntimeProfileId was null in GET /projects — no top-tier profile to preserve; set Plan default manually in the aif UI)"
    _warn "Park: $plan_status (§7c #2)"
  fi

  local put_resp put_rc
  put_resp=$(curl -sf -X PUT "$AIF_URL/projects/$project_id" \
    -H 'Content-Type: application/json' \
    -d "$put_body" 2>&1) || put_rc=$?
  put_rc=${put_rc:-0}

  if [ "$put_rc" -ne 0 ]; then
    printf 'GLM_PROVISION: FAILED step-B per-mode-defaults\n'
    _warn "per-mode-default PUT /projects/$project_id failed (rc=$put_rc). Response: $put_resp"
    _warn "objective-3 MISS: per-mode defaults not set automatically — set them manually in the aif UI (Task+Review → $profile_id) (kickoff §4 item 5)"
    # FAIL-CLOSED (§2 constraint 4). This branch used to warn and fall through to
    # `GLM_PROVISION: DONE`, and INSTALL-FOR-AI.md tells the consumer's agent to report that
    # line verbatim — so a missed binding objective surfaced to the consumer as success.
    # §2 constraint 4 is explicit that a degrade to manual steps is an objective-3 MISS and
    # NOT a neutral fallback, so the terminal signal must carry the MISS, not hide it.
    return 1
  else
    _log "provision: step B done — PUT /projects/$project_id green (Plan: $plan_status)"
  fi

  # Step B.5 — key-reachability WIRING (§7b #1 / §7e.4 — closes the #warning-nobody-reads
  # shape run 3 shipped). The aif runtime resolves ANTHROPIC_AUTH_TOKEN from its OWN
  # process.env by NAME (packages/runtime/src/resolution.ts:217-219). That process env is
  # populated from each service's `env_file:` entries (docker-compose.yml:15,59,94 —
  # env_file: .env). A file at $GLM_ENV_FILE is INVISIBLE to aif unless the deployment
  # loads it.
  #
  # W1 — best-effort auto-wire via docker-compose.override.yml:
  #   If $AIF_HANDOFF_CHECKOUT/docker-compose.yml is present (the canonical path from
  #   setup.d/aif-handoff-guided-install.sh:30) and no unmarked override exists, the
  #   helper writes a marker-bearing override that adds $GLM_ENV_FILE to each detected
  #   service's env_file list, then runs `docker compose up -d` (best-effort reload).
  #   The override lists BOTH .env (preserve existing) and $GLM_ENV_FILE so it works
  #   under both append- and replace-merge semantics.
  #
  # W2 — honest fallback (instruction + binding verifier):
  #   When W1 cannot apply (deployment not detected, unmarked override collision,
  #   unwritable path), the helper prints the docker-compose snippet for the consumer's
  #   AI agent (kickoff §2 — the agent IS the executor) to apply. Step C's hasApiKey
  #   gate then decides: if the agent wired correctly, hasApiKey=true; if not, MISS.
  #   This is NOT the run-3 warning-nobody-reads shape, because the hasApiKey gate
  #   converts an un-applied instruction into an objective-3 MISS rather than a green run.
  #
  # INVARIANT (§2 constraint 1 + §7b #4): the helper references ONLY the env-var NAME.
  # The override file holds a PATH to glm.env, never the value. The value moves
  # file → process env only (glm.env → aif container env via compose env_file merge).
  # It never enters the profile, never enters curl argv or any command line, is never echoed.
  _log "provision: step B.5 — key-reachability wiring (§7b #1 / §7e.4)"
  local wire_rc
  _wire_key_reachability && wire_rc=0 || wire_rc=$?
  if [ "$wire_rc" -eq 0 ]; then
    _log "provision: step B.5 — W1 wiring applied (or already present)"
  else
    _log "provision: step B.5 — W1 did not apply (rc=$wire_rc); printing W2 instruction fallback"
    cat <<EOF

Key-reachability wiring (§7b — the aif runtime must see the key in its env):
  The aif runtime resolves ANTHROPIC_AUTH_TOKEN from its process.env by NAME.
  The helper could not auto-detect a canonical aif-handoff docker-compose deployment
  (\$AIF_HANDOFF_CHECKOUT=${AIF_HANDOFF_CHECKOUT:-$HOME/code/aif-handoff}). To wire
  the key WITHOUT the helper touching the value, add this to each service in your aif
  deployment's docker-compose.yml:

    env_file:
      - .env
      - $GLM_ENV_FILE

  Then: docker compose up -d (reload).
  For non-compose deployments: ensure ANTHROPIC_AUTH_TOKEN is in the aif
  process env by your deployment's standard mechanism.

  The next step (POST /runtime-profiles/validate) FAILS if this wiring is not
  applied — an un-applied instruction is an objective-3 MISS, not a warning.
EOF
  fi

  # Step C — key-reachability gate via the created profile (§7c #3 / §7d.1 #3 / §7e.3 / §7e.4).
  # Routes through the aif profile id, NOT the vendor URL directly (§7c #3 — run-2
  # pinged $GLM_BASE_URL/v1/messages, proving the key but not the route the flow built).
  #
  # SCOPE, stated honestly (§7e.3): this call proves profile resolution + that aif can
  # resolve the key from its own process env under the declared name. It does NOT make a
  # model call — for transport=api, validateClaudeConnection checks only that apiKey and
  # baseUrl are non-empty. §7a #3's "one real minimal model call" is therefore NOT satisfied
  # by this step alone — step D below is that half, and it is what would catch a key that
  # resolves but is rejected by the vendor.
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
  # .ok field AND .profile.hasApiKey, not in the status code. Measured 2026-08-09: a profile
  # whose apiKeyEnvVar is absent from aif's env returns `HTTP 200 {"ok":false,"message":"Missing API key …"}`,
  # and `curl -sf` exits 0 on it. Reading the exit code alone is a false green — parse .ok.
  #
  # §7e.4 binding verifier — .profile.hasApiKey (when present):
  #   hasApiKey = Boolean(resolved.apiKey) = normalizeString(env[envVarName]) off aif's
  #   OWN process.env (aif-handoff packages/runtime/src/resolution.ts:426, :217-219).
  #   So hasApiKey:true IS proof that §7b #1's outcome was achieved, without dereferencing
  #   the value, without argv exposure, without echoing it (§7b #4 intact).
  #   hasApiKey:false is an objective-3 MISS, not a warning to print and continue.
  # Field location: live aif (probed 2026-08-09) wraps the resolved profile in .profile:
  #   {"ok":true,"message":"…","profile":{"hasApiKey":false,"apiKeyEnvVar":"…",…}}
  # Older aif without .profile.hasApiKey falls back to the .ok verdict.
  local validate_ok validate_msg validate_has_key
  validate_ok=$(printf '%s' "$validate_resp" | jq -r '.ok // false' 2>/dev/null || printf 'false')
  validate_msg=$(printf '%s' "$validate_resp" | jq -r '.message // "no message"' 2>/dev/null || printf 'unparseable')
  # Look for hasApiKey under .profile first (live shape), then top-level (defensive compat).
  if printf '%s' "$validate_resp" | jq -e '.profile.hasApiKey != null' >/dev/null 2>&1; then
    validate_has_key=$(printf '%s' "$validate_resp" | jq -r '.profile.hasApiKey' 2>/dev/null || printf 'false')
  elif printf '%s' "$validate_resp" | jq -e '.hasApiKey != null' >/dev/null 2>&1; then
    validate_has_key=$(printf '%s' "$validate_resp" | jq -r '.hasApiKey' 2>/dev/null || printf 'false')
  else
    validate_has_key=""  # field absent — older aif; fall back to .ok
  fi
  if [ "$validate_ok" != "true" ]; then
    printf 'GLM_PROVISION: FAILED step-C validation-not-ok\n'
    _warn "objective-3 MISS: aif rejected the profile — $validate_msg (kickoff §4 item 5 + §7b #3)"
    _warn "most likely the key is unreachable to the aif runtime: apply the env_file wiring (W1 override or W2 instruction above), restart aif, re-run"
    return 1
  fi
  # §7e.4 gate — explicit hasApiKey:false is a hard MISS even when .ok:true (semantic:
  # aif resolved the profile but the key is not in its env, so any model call would fail).
  if [ -n "$validate_has_key" ] && [ "$validate_has_key" != "true" ]; then
    printf 'GLM_PROVISION: FAILED step-C key-unreachable\n'
    _warn "objective-3 MISS: aif resolved the profile but hasApiKey=false (§7e.4 verifier)"
    _warn "the key is in $GLM_ENV_FILE but NOT in aif's process env — apply the §7b wiring (W1 override or W2 instruction above), restart aif, re-run"
    return 1
  fi
  if [ "$validate_has_key" = "true" ]; then
    _log "provision: step C done — §7e.4 verifier hasApiKey=true (key IS in aif's process env)"
  else
    _log "provision: step C done — aif resolves $GLM_ENV_VAR for profile $profile_id ($validate_msg; older aif without explicit hasApiKey field)"
  fi

  # Step D — the MODEL proof (§7a #3 second half, §7e.3(2)). Step C proved aif can RESOLVE the
  # key and reach the profile; it does not prove the key is VALID at the vendor, because
  # validateClaudeConnection makes no network call. This does: one minimal completion through
  # aif's own chat route, with the profile pinned explicitly so the proof is about THIS profile
  # and not whatever the project happens to default to.
  #
  # Why this honours §2 constraint 1: the body carries the profile ID, never the key. aif
  # resolves ANTHROPIC_AUTH_TOKEN from its OWN process.env by name
  # (packages/runtime/src/resolution.ts:217-219), so the value never enters this helper's
  # memory, argv, or logs. That is what makes §7a #3 and constraint 1 co-satisfiable — the
  # conflict the earlier park asserted does not exist (kickoff §7f.2).
  # TWO steps, and the order is forced — not a style choice. `POST /chat` resolves the profile
  # from the chat SESSION (`existingSession?.runtimeProfileId ?? null`, aif
  # packages/api/src/routes/chat.ts:1336); `chatRequestSchema` accepts a `runtimeProfileId`
  # field but the handler never reads it when opening a new conversation. Measured 2026-08-09:
  # a single `POST /chat` carrying `runtimeProfileId` for a freshly created profile ran the
  # completion on the PROJECT DEFAULT instead and echoed that profile back. So the profile is
  # pinned on the session, and the completion is then sent to that session.
  local sess_resp sess_rc chat_session_id
  sess_resp=$(curl -sf -X POST "$AIF_URL/chat/sessions" \
    -H 'Content-Type: application/json' \
    -d "$(jq -nc --arg p "$project_id" --arg r "$profile_id" \
            '{projectId:$p, runtimeProfileId:$r, title:"getff GLM provisioning proof"}')" \
    2>&1) || sess_rc=$?
  sess_rc=${sess_rc:-0}
  chat_session_id=$(printf '%s' "$sess_resp" | jq -r '.id // empty')
  if [ "$sess_rc" -ne 0 ] || [ -z "$chat_session_id" ]; then
    printf 'GLM_PROVISION: FAILED step-D proof-session-uncreatable\n'
    _warn "objective-3 MISS: could not open a chat session pinned to $profile_id (rc=$sess_rc). Response: $sess_resp (§7e.3(2))"
    return 1
  fi

  local chat_resp chat_rc chat_profile chat_tokens
  chat_resp=$(curl -sf -X POST "$AIF_URL/chat" \
    -H 'Content-Type: application/json' \
    -d "$(jq -nc --arg p "$project_id" --arg s "$chat_session_id" \
            '{projectId:$p, sessionId:$s, message:"Reply with exactly one word: ok"}')" \
    2>&1) || chat_rc=$?
  chat_rc=${chat_rc:-0}
  if [ "$chat_rc" -ne 0 ]; then
    printf 'GLM_PROVISION: FAILED step-D model-proof-unreachable\n'
    _warn "objective-3 MISS: the model proof call failed (rc=$chat_rc). Response: $chat_resp (§7a #3 + §7e.3(2))"
    _warn "a CHAT_AUTH_ERROR here means aif cannot authenticate with $GLM_ENV_VAR — check the §7b wiring landed and aif was restarted"
    return 1
  fi
  chat_profile=$(printf '%s' "$chat_resp" | jq -r '.runtime.profileId // empty')
  chat_tokens=$(printf '%s' "$chat_resp" | jq -r '.usage.totalTokens // 0')
  # Bind the proof to OUR profile. A completion billed against a different profile proves
  # someone else's key works, not the one this run just wired.
  if [ "$chat_profile" != "$profile_id" ]; then
    printf 'GLM_PROVISION: FAILED step-D model-proof-wrong-profile\n'
    _warn "objective-3 MISS: completion ran on profile '$chat_profile', expected '$profile_id' (§7e.3(2))"
    return 1
  fi
  # A completion that billed zero tokens is not a completion.
  if [ "$chat_tokens" -le 0 ] 2>/dev/null; then
    printf 'GLM_PROVISION: FAILED step-D model-proof-no-usage\n'
    _warn "objective-3 MISS: completion reported no token usage — the vendor call did not happen (§7a #3)"
    return 1
  fi
  _log "provision: step D done — real completion on profile $profile_id, $chat_tokens tokens billed"

  printf 'GLM_PROVISION: DONE profile-id=%s\n' "$profile_id"
  _log "provision: GLM executor tier wired — profile $profile_id, defaults set, key reachable, model proven"
}

# ---------------------------------------------------------------------------
# §7a #3's second half — "one real minimal model call": DELIVERED as step D above.
#
# This block used to be a PARK. It is kept as a record of why, because the park's rationale
# was wrong in a way worth not repeating: it concluded "Option B is a dead-end at the aif API
# surface" from a handful of 404s, and generalised that into "every aif-side completion route
# is closed". That is a negative-existence claim from a partial probe. It was withdrawn after
# `POST /chat/sessions` answered 400 rather than 404 (kickoff §7f.2).
#
# What the earlier options got right, and what they missed:
#   Option A — call {baseUrl}/v1/messages from the helper. Correctly rejected: any form that
#     lets the helper hold the value violates §2 constraint 1 / §7b #4, and `curl --header @-`
#     only moves the exposure off argv, it still requires reading the value (T16: upstream
#     solves argv exposure, not "never read it" — the pattern does not transfer).
#   Option B — route the completion through aif. Rejected on a false premise; it is the
#     delivery path. aif holds the key in its own process env, so the helper sends a profile
#     id and never the value: §7a #3 and §2 constraint 1 are co-satisfiable, and the "two
#     binding constraints in genuine conflict" that justified the park never existed.
#   POST /runtime-profiles/validate genuinely does NOT call the provider (transport=api checks
#     only that apiKey and baseUrl are non-empty) — that part of the run-4 finding stands, and
#     is exactly why step C alone is not the model proof.
#
# HONEST VERIFICATION GAP (do not read step D's presence as "proven end-to-end on a consumer"):
# the completion route, the session pinning and the response shape were each measured live on
# 2026-08-09, and step D's failure modes are covered by paired negatives N7/N8/N9. What could
# NOT be exercised on the verifying host is the full chain against a profile THIS helper
# created: that aif deployment has ZAI_API_KEY in its process env and no ANTHROPIC_AUTH_TOKEN,
# so a helper-created profile returns CHAT_AUTH_ERROR there regardless of correctness. On a
# consumer machine the §7b wiring puts ANTHROPIC_AUTH_TOKEN into the aif env, which is the
# case the helper is written for — but that specific end-to-end run remains UNEXERCISED, and
# a first consumer run failing at step D with CHAT_AUTH_ERROR means the wiring, not the proof.
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
