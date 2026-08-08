#!/usr/bin/env bash
# getff-glm-onebutton.sh — beta-delivery-ux S4 §2 (A2): GLM executor tier one-button setup.
#
# Binding design: docs/superpowers/specs/2026-07-23-beta-program-design.md §4 A2 + the
# §7a/§7b/§7c resolutions in .ai-factory/plans/beta-delivery-ux.md (stage kickoff).
#
# WHAT THIS IS (the aider pattern, per kickoff §2): the consumer's in-session AI agent
# reads the INSTALL-FOR-AI.md one-button step and runs this script. The script:
#   1. detects a missing GLM executor profile (aif REST: GET /runtime-profiles);
#   2. prints ONE explanation (z.ai Coding Plan, $18/mo) + the exact env file path;
#   3. waits for the human to paste ONE key into that untracked file;
#   4. verifies the key is reachable in the aif runtime's process env (§7b);
#   5. creates the runtime profile (§7a #1 minimal set);
#   6. sets per-mode defaults via PUT /projects/:id (§7a #2 + §7c #1/#2);
#   7. runs ONE validation model call routed THROUGH the profile id (§7a #3 + §7c #3);
#   8. exits 0 with the profile id + the three per-mode default fields written.
#
# KEY-HANDLING INVARIANT (kickoff §2 constraint 1 + §4 item 2 — load-bearing, T19 cold-QA):
#   The literal token `ANTHROPIC_AUTH_TOKEN` appears ONLY as:
#     (a) the env-var NAME in the human-facing explanation,
#     (b) the value of the `apiKeyEnvVar` field in the POST /runtime-profiles body,
#     (c) the argument to `printenv` in the reachability check (exit-code-only, never echoed).
#   The VALUE of the key is NEVER read into a shell variable, NEVER appears in curl argv
#   or any command line (process-table exposure — kickoff §7b #4), NEVER echoed. It moves
#   file → aif process env only. Grep-provable: `grep -n '\${ANTHROPIC_AUTH_TOKEN'` returns
#   only the reachability non-emptiness test `[ -n "\${ANTHROPIC_AUTH_TOKEN:-}" ]`.
#
# HONEST DEGRADATION (kickoff §2 constraint 4 + §4 item 5): any failure (profile create,
# per-mode defaults, reachability, ping) is an objective-3 MISS — exit non-zero with the
# specific blocker. The PR body records each MISS with the blocker; never "degraded gracefully".
set -uo pipefail

# ─── Config (env-driven) ─────────────────────────────────────────────────────
AIF_URL="${RUNTIME_BRIDGE_AIF_URL:-http://localhost:3009}"
AIF_PROJECT_ID="${AIF_PROJECT_ID:-}"
# §7a #4(i)  env-var NAME (canonical for the Z.ai Anthropic-shape endpoint per
# .claude/skills/claude-glm-executor-handoff/SKILL.md:36 D3 row).
KEY_ENV_VAR_NAME="ANTHROPIC_AUTH_TOKEN"
# §7a #4(ii) file path — XDG Base Directory spec's own fallback semantics
# (valid on macOS where $XDG_CONFIG_HOME is unset → literal ~/.config, and Linux alike).
GLM_ENV_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/getff/glm.env"
# §7a #1 minimal profile field values (Z.ai Anthropic-shape endpoint per SKILL.md D3).
GLM_BASE_URL="${GLM_BASE_URL:-https://api.z.ai/api/anthropic}"
GLM_MODEL="${GLM_MODEL:-glm-5.2}"
GLM_PROFILE_NAME="${GLM_PROFILE_NAME:-GLM (z.ai Anthropic-shape)}"
# §7a #2 top-tier profile id for Plan-mode default (the kickoff names this "top tier";
# the operator MUST provide this — there is no discovery path that is not a guess).
TOP_TIER_PROFILE_ID="${TOP_TIER_PROFILE_ID:-}"
# §7a #3 ping endpoint path template — the aif-handoff repo is absent locally (V6) so
# the live endpoint shape cannot be verified. Default is the most-plausible Anthropic-shape
# route; override via env if the live aif deployment exposes a different path. The helper
# logs which path it attempted; a 404 here is recorded as an objective-3 MISS, not a pass.
AIF_PROFILE_CHAT_PATH="${AIF_PROFILE_CHAT_PATH:-/runtime-profiles/%p/v1/messages}"
# §7b #2 reachability mechanism — worker's choice (kickoff delegates). Default: probe the
# aif container's process env via `docker compose exec` (printenv exit-code-only). Override
# via AIF_REACHABILITY_CMD if the aif deployment uses a different surface (native, k8s, etc).
# The command receives $KEY_ENV_VAR_NAME as %n; MUST test non-emptiness only, never echo.
AIF_REACHABILITY_CMD="${AIF_REACHABILITY_CMD:-docker compose exec -T aif sh -c '[ -n \"\$(printenv %n)\" ]'}"
# Where the aif deployment's compose file lives (for the reachability probe + the §7b
# wiring instruction printed to the human). Auto-detected from common candidates.
AIF_DEPLOY_DIR="${AIF_DEPLOY_DIR:-}"
LOG_LEVEL="${LOG_LEVEL:-INFO}"

# ─── Logging ─────────────────────────────────────────────────────────────────
_log() {
  # $1 = level, $2.. = message
  local lvl="$1"; shift
  case "$LOG_LEVEL" in
    DEBUG) ;;
    INFO)  [ "$lvl" = "DEBUG" ] && return ;;
    WARN)  [ "$lvl" = "DEBUG" ] || [ "$lvl" = "INFO" ] && return ;;
    ERROR) [ "$lvl" = "DEBUG" ] || [ "$lvl" = "INFO" ] || [ "$lvl" = "WARN" ] && return ;;
  esac
  printf '[glm-onebutton] %s: %s\n' "$lvl" "$*" >&2
}
info()  { _log INFO  "$@"; }
warn()  { _log WARN  "$@"; }
error() { _log ERROR "$@"; }
debug() { _log DEBUG "$@"; }
fatal() { _log FATAL "$@"; exit 1; }

# ─── Step helpers ────────────────────────────────────────────────────────────
step() { info "step $1: $2"; }

# curl wrapper that logs method + url + status at DEBUG, never logs bodies or headers.
aif_request() {
  # $1=method $2=path $3=json-body (optional)
  local method="$1" path="$2" body="${3:-}"
  local url="$AIF_URL$path"
  debug "HTTP $method $url"
  if [ -n "$body" ]; then
    curl -sS -m 10 -o /tmp/glm-onebutton.res -w '%{http_code}' \
      -X "$method" "$url" -H 'Content-Type: application/json' -d "$body" 2>/dev/null
  else
    curl -sS -m 10 -o /tmp/glm-onebutton.res -w '%{http_code}' \
      -X "$method" "$url" 2>/dev/null
  fi
}

res_body() { cat /tmp/glm-onebutton.res 2>/dev/null; }

# Resolve the aif deploy dir from common candidates if not set.
resolve_deploy_dir() {
  if [ -n "$AIF_DEPLOY_DIR" ] && [ -d "$AIF_DEPLOY_DIR" ]; then
    echo "$AIF_DEPLOY_DIR"; return
  fi
  for cand in "$PWD/aif-handoff" "$HOME/code/aif-handoff" "$PWD/../aif-handoff"; do
    if [ -d "$cand" ] && [ -f "$cand/docker-compose.yml" -o -f "$cand/compose.yml" ]; then
      echo "$cand"; return
    fi
  done
  echo ""
}

# JSON value escape — escapes a string for safe JSON embedding. Never receives the key value
# (the key never enters a shell variable per the §4 item 2 invariant); it's used for
# display name, model, base url — all non-secret strings.
json_str() {
  # $1 = string. Emits a JSON string literal (with surrounding quotes).
  local s="$1"
  s="${s//\\/\\\\}"   # backslash first
  s="${s//\"/\\\"}"   # quotes
  s="${s//$'\n'/\\n}" # newlines
  printf '"%s"' "$s"
}

# ─── Step 1: detect ──────────────────────────────────────────────────────────
step 1 "detect missing executor profile"
debug "GET $AIF_URL/runtime-profiles"
http=$(aif_request GET /runtime-profiles)
debug "GET /runtime-profiles → HTTP $http"
if [ "$http" != "200" ]; then
  error "objective-3 MISS: cannot reach aif at $AIF_URL (GET /runtime-profiles → HTTP $http)."
  error "blocker: aif runtime not reachable. Start it (docker compose up -d in your aif-handoff checkout) and re-run."
  exit 1
fi
# Filter for an existing GLM profile by baseUrl containing the Z.ai anthropic endpoint,
# or by name matching our display name, or by provider/model hints. jq if available,
# fallback to grep.
existing_id=""
if command -v jq >/dev/null 2>&1; then
  existing_id=$(res_body | jq -r --arg url "$GLM_BASE_URL" --arg name "$GLM_PROFILE_NAME" \
    '.[] | select((.baseUrl // "") | tostring | test($url;"i") or (.name // "") == $name) | .id' 2>/dev/null | head -1)
else
  existing_id=$(res_body | grep -oE '"id":"[^"]*"' | head -1 | sed 's/.*:"//;s/"$//')
fi
if [ -n "$existing_id" ]; then
  info "profile already configured: $existing_id (idempotent — not recreating)."
  printf '[glm-onebutton] done: GLM profile id=%s already present.\n' "$existing_id"
  exit 0
fi
info "no GLM profile detected — proceeding to one-button setup."

# ─── Step 2: explain + path ──────────────────────────────────────────────────
step 2 "explain + path"
printf '\n[machine] GLM executor tier needs a Z.ai Coding Plan ($18/mo) key.\n' >&2
printf '[machine] Get one at https://docs.z.ai/devpack/quick-start\n' >&2
printf '[machine] Then paste the key into THIS file (create it if absent):\n' >&2
printf '[machine]   %s\n' "$GLM_ENV_FILE" >&2
printf '[machine] The file content should be exactly ONE line:\n' >&2
printf '[machine]   %s=<your-key>\n' "$KEY_ENV_VAR_NAME" >&2
printf '[machine] The value stays in that file. This script reads only the NAME, never the value.\n\n' >&2

# ─── Step 3: wait for the human ──────────────────────────────────────────────
step 3 "wait for human confirmation"
if [ -t 0 ]; then
  printf '[glm-onebutton] press ENTER once you have pasted the key into %s: ' "$GLM_ENV_FILE" >&2
  IFS= read -r _ans || true
else
  # Non-interactive (e.g. dispatched by an AI agent): poll the file for existence + non-empty.
  info "non-interactive mode: polling for $GLM_ENV_FILE existence (60s timeout)."
  for _i in $(seq 1 60); do
    [ -s "$GLM_ENV_FILE" ] && break
    sleep 1
  done
  if [ ! -s "$GLM_ENV_FILE" ]; then
    error "objective-3 MISS: $GLM_ENV_FILE not created/non-empty after 60s."
    error "blocker: the human did not paste the key in time, or the path is wrong."
    exit 1
  fi
fi
debug "env file exists: $GLM_ENV_FILE"

# ─── Step 4: reachability (§7b) ──────────────────────────────────────────────
step 4 "verify key reachability in aif runtime process env"
DEPLOY_DIR=$(resolve_deploy_dir)
if [ -z "$DEPLOY_DIR" ]; then
  warn "no aif deploy dir detected (tried \$AIF_DEPLOY_DIR, ./aif-handoff, ~/code/aif-handoff, ../aif-handoff)."
  warn "the §7b reachability probe cannot run without knowing where aif lives."
  warn "printing wiring instructions instead; the human must wire glm.env into the aif deployment."
  printf '\n[machine] WIRING REQUIRED (§7b): make %s readable in the aif runtime process env.\n' "$GLM_ENV_FILE" >&2
  printf '[machine] Pick ONE mechanism:\n' >&2
  printf '[machine]   (a) docker compose: add `env_file:\n     - %s` to the aif service in your compose file.\n' "$GLM_ENV_FILE" >&2
  printf '[machine]   (b) manual: copy the %s line from %s into the aif deployment'"'"'s own .env.\n' "$KEY_ENV_VAR_NAME" "$GLM_ENV_FILE" >&2
  printf '[machine] Then export AIF_DEPLOY_DIR=<your aif-handoff path> and re-run this script.\n\n' >&2
  error "objective-3 MISS: §7b reachability probe blocked — AIF_DEPLOY_DIR not set."
  error "blocker: glm.env wiring into the aif deployment is required before this script can verify reachability."
  exit 1
fi
info "aif deploy dir: $DEPLOY_DIR"
# §7b #3: verify reachability before the ping. Mechanism = docker compose exec printenv
# (exit-code-only, never echoes the value). The literal $KEY_ENV_VAR_NAME is passed;
# the command tests non-emptiness via the shell's [ -n ... ] over the printenv output.
REACH_CMD="${AIF_REACHABILITY_CMD//%n/$KEY_ENV_VAR_NAME}"
debug "reachability probe (value never echoed): cd \"$DEPLOY_DIR\" && $REACH_CMD"
if (cd "$DEPLOY_DIR" && eval "$REACH_CMD" >/dev/null 2>&1); then
  info "key reachable in aif runtime process env under name $KEY_ENV_VAR_NAME."
else
  error "objective-3 MISS: key NOT reachable in aif runtime process env under name $KEY_ENV_VAR_NAME."
  error "blocker (§7b #3): the aif runtime cannot see the key. Wire glm.env into the deployment (see step 4 messages above),"
  error "then re-run. Per kickoff §2 constraint 4 this is a MISS, never a silent warning."
  printf '\n[machine] WIRING (§7b): add to the aif deployment so %s is loaded:\n' "$GLM_ENV_FILE" >&2
  printf '[machine]   docker compose: add `env_file:\n     - %s` to the aif service.\n' "$GLM_ENV_FILE" >&2
  printf '[machine]   OR copy the %s=... line from %s into the aif .env manually.\n\n' "$KEY_ENV_VAR_NAME" "$GLM_ENV_FILE" >&2
  exit 1
fi

# ─── Step 5: create profile (§7a #1 minimal set) ────────────────────────────
step 5 "create runtime profile (POST /runtime-profiles — minimal field set)"
# Minimal set per §7a #1: schema-required + display name + model + apiKeyEnvVar (NAME only)
# + baseUrl. Everything else stays on server defaults. The key VALUE is never in this body.
BODY=$(printf '{"name":%s,"defaultModel":%s,"baseUrl":%s,"apiKeyEnvVar":%s,"enabled":true}' \
  "$(json_str "$GLM_PROFILE_NAME")" \
  "$(json_str "$GLM_MODEL")" \
  "$(json_str "$GLM_BASE_URL")" \
  "$(json_str "$KEY_ENV_VAR_NAME")")
debug "POST body (no key value): $BODY"
http=$(aif_request POST /runtime-profiles "$BODY")
debug "POST /runtime-profiles → HTTP $http"
if [ "$http" != "200" ] && [ "$http" != "201" ]; then
  error "objective-3 MISS: profile creation failed (HTTP $http)."
  error "blocker: $(res_body | head -c 300)"
  exit 1
fi
PROFILE_ID=$(res_body | { command -v jq >/dev/null 2>&1 && jq -r '.id // empty' || grep -oE '"id":"[^"]*"' | head -1 | sed 's/.*:"//;s/"$//'; })
if [ -z "$PROFILE_ID" ]; then
  error "objective-3 MISS: profile created but no id returned in response."
  error "blocker: aif response shape unexpected — $(res_body | head -c 300)"
  exit 1
fi
info "profile created: id=$PROFILE_ID"

# ─── Step 6: per-mode defaults (§7a #2 + §7c #1/#2) ─────────────────────────
step 6 "set per-mode defaults (GET /projects → filter by id → PUT /projects/:id full body)"
if [ -z "$AIF_PROJECT_ID" ]; then
  error "objective-3 MISS: AIF_PROJECT_ID is empty — cannot identify the project to mutate."
  error "blocker: the operator must export AIF_PROJECT_ID before running this script."
  error "(kickoff §7c #1: aif has no GET /projects/:id, so the worker cannot auto-resolve it without a hint.)"
  exit 1
fi
if [ -z "$TOP_TIER_PROFILE_ID" ]; then
  error "objective-3 MISS: TOP_TIER_PROFILE_ID is empty — cannot set Plan→top-tier default."
  error "blocker: the operator must export TOP_TIER_PROFILE_ID (the existing top-tier profile id) before running this script."
  error "(kickoff §7a #2: Plan→top-tier; Task+Review→executor-tier. Both halves must be writable per §7c #2.)"
  exit 1
fi

# §7c #1: GET /projects (aif has no GET /projects/:id), filter by id.
debug "GET $AIF_URL/projects"
http=$(aif_request GET /projects)
debug "GET /projects → HTTP $http"
if [ "$http" != "200" ]; then
  error "objective-3 MISS: cannot read projects (HTTP $http)."
  error "blocker: $(res_body | head -c 300)"
  exit 1
fi
# Filter the matching project, preserve ALL fields (budget fields are load-bearing per
# aifHttp.ts:71-73 — NULLed on omit). Mutate only the three per-mode default*RuntimeProfileId
# fields per §7c #2: Plan→top-tier, Task+Review→GLM (executor-tier).
CURRENT_BODY=$(res_body)
PROJECT_JSON=$(printf '%s' "$CURRENT_BODY" | {
  if command -v jq >/dev/null 2>&1; then
    jq -c --arg id "$AIF_PROJECT_ID" --arg top "$TOP_TIER_PROFILE_ID" --arg glm "$PROFILE_ID" \
      '.[] | select(.id == $id)' 2>/dev/null
  else
    echo ""
  fi
})
if [ -z "$PROJECT_JSON" ]; then
  error "objective-3 MISS: project $AIF_PROJECT_ID not found in GET /projects response."
  error "blocker: AIF_PROJECT_ID mismatch — available projects: $(printf '%s' "$CURRENT_BODY" | head -c 300)"
  exit 1
fi
# Mutate the three per-mode defaults. defaultChatRuntimeProfileId is NOT in §7a #2 — leave untouched.
PUT_BODY=$(printf '%s' "$PROJECT_JSON" | jq -c \
  --arg top "$TOP_TIER_PROFILE_ID" \
  --arg glm "$PROFILE_ID" \
  '.defaultPlanRuntimeProfileId = $top |
   .defaultTaskRuntimeProfileId = $glm |
   .defaultReviewRuntimeProfileId = $glm')
if [ -z "$PUT_BODY" ]; then
  error "objective-3 MISS: failed to construct PUT body (jq missing or project json malformed)."
  error "blocker: project_json=$(printf '%s' "$PROJECT_JSON" | head -c 300)"
  exit 1
fi
# Sanity: verify the load-bearing budget fields survived (they must NOT be null in the PUT body
# per aifHttp.ts:71-73). If any is null, the GET response was incomplete and the PUT would clobber.
MISSING_BUDGET=$(printf '%s' "$PUT_BODY" | jq -r '
  ((.plannerMaxBudgetUsd // "MISSING") | tostring) + "," +
  ((.planCheckerMaxBudgetUsd // "MISSING") | tostring) + "," +
  ((.implementerMaxBudgetUsd // "MISSING") | tostring) + "," +
  ((.reviewSidecarMaxBudgetUsd // "MISSING") | tostring)')
if printf '%s' "$MISSING_BUDGET" | grep -q MISSING; then
  error "objective-3 MISS: one or more load-bearing budget fields are null in the PUT body."
  error "blocker: budget fields = $MISSING_BUDGET (aifHttp.ts:71-73 — NULLed on omit). Refusing to PUT — would clobber UI-set budget."
  exit 1
fi
debug "PUT /projects/$AIF_PROJECT_ID body (3 fields mutated, budget preserved): $(printf '%s' "$PUT_BODY" | head -c 400)"
http=$(aif_request PUT "/projects/$AIF_PROJECT_ID" "$PUT_BODY")
debug "PUT /projects/$AIF_PROJECT_ID → HTTP $http"
if [ "$http" != "200" ]; then
  error "objective-3 MISS: per-mode defaults write failed (HTTP $http)."
  error "blocker: $(res_body | head -c 300)"
  exit 1
fi
info "per-mode defaults written: Plan=$TOP_TIER_PROFILE_ID, Task=$PROFILE_ID, Review=$PROFILE_ID"

# ─── Step 7: validation ping (§7a #3 + §7c #3 — through the profile id) ──────
step 7 "validation ping (one real minimal model call routed THROUGH profile id)"
# §7c #3: route through the created profile id, NOT $GLM_BASE_URL directly. The exact
# aif endpoint shape for profile-targeted chat could not be verified (V6: aif-handoff repo
# absent, live bridge unreachable). Default: /runtime-profiles/:id/v1/messages (Anthropic-shape).
# Override via AIF_PROFILE_CHAT_PATH (%p = profile id).
CHAT_PATH="${AIF_PROFILE_CHAT_PATH//%p/$PROFILE_ID}"
# Minimal Anthropic-shape request body — 1-token-scale completion.
PING_BODY=$(printf '{"model":%s,"max_tokens":1,"messages":[{"role":"user","content":"ping"}]}' \
  "$(json_str "$GLM_MODEL")")
debug "POST $AIF_URL$CHAT_PATH (profile-routed, body has no key value)"
http=$(aif_request POST "$CHAT_PATH" "$PING_BODY")
debug "POST $CHAT_PATH → HTTP $http"
case "$http" in
  200|201)
    info "validation ping OK — key + model + route proven together (profile $PROFILE_ID)."
    ;;
  401|403)
    error "objective-3 MISS: validation ping returned auth failure (HTTP $http)."
    error "blocker: the aif runtime could not authenticate to Z.ai with the key. Verify the key value + the glm.env wiring."
    error "(§7b reachability probe passed at step 4 but the vendor rejected the key itself — different failure class.)"
    exit 1
    ;;
  404)
    error "objective-3 MISS: profile-targeted chat endpoint not found (HTTP 404 at $CHAT_PATH)."
    error "blocker: the aif deployment exposes a different profile-targeted chat path than the default."
    error "Set AIF_PROFILE_CHAT_PATH=<path-with-%p> to the live endpoint and re-run. Response: $(res_body | head -c 200)"
    exit 1
    ;;
  *)
    error "objective-3 MISS: validation ping failed (HTTP $http)."
    error "blocker: $(res_body | head -c 300)"
    exit 1
    ;;
esac

# ─── Step 8: done ────────────────────────────────────────────────────────────
step 8 "done"
printf '[glm-onebutton] done: GLM executor tier wired.\n'
printf '[glm-onebutton]   profile id:           %s\n' "$PROFILE_ID"
printf '[glm-onebutton]   Plan default:         %s (top tier)\n' "$TOP_TIER_PROFILE_ID"
printf '[glm-onebutton]   Task default:         %s (executor tier)\n' "$PROFILE_ID"
printf '[glm-onebutton]   Review default:       %s (executor tier)\n' "$PROFILE_ID"
exit 0
