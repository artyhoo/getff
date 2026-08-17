#!/usr/bin/env bash
# tests/install-sh/glm-onebutton.test.sh — firing tests for scripts/getff-glm-onebutton.sh
# (beta-delivery-ux S4). Mirrors bridge-guided.test.sh's source+stub pattern.
#
# Covers: (a) detect cases (present|missing|bridge-unreachable),
#         (b) explain output (env-file path + env-var name),
#         (c) provision cases (happy path, step-A failure, preflight env-file missing),
#         (d) key-handling invariant grep (the value is NEVER echoed/logged).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# Source the helper in lib-only mode (mirrors BRIDGE_LIB_ONLY=1 pattern from bridge-guided.test.sh:8).
# The helper carries `set -euo pipefail` — restore WITHOUT -e after sourcing, since we test
# functions that legitimately return non-zero (do_detect on bridge-unreachable, do_provision on FAIL).
GLM_LIB_ONLY=1 source "$REPO_ROOT/scripts/getff-glm-onebutton.sh"
set +e

# ============================================================
# (a) detect — three cases. Stub curl per case.
# ============================================================

# present: bridge returns a profile array containing one with baseUrl == GLM_BASE_URL.
curl() {
  case "$*" in
    *"/runtime-profiles"*)
      # No -X POST/-X PATCH prefix in detect (just GET); emulate the GET body.
      printf '%s' "[{\"id\":\"x\",\"baseUrl\":\"$GLM_BASE_URL\",\"name\":\"$GLM_PROFILE_NAME\"}]"
      return 0
      ;;
    *) return 1 ;;
  esac
}
export -f curl
out=$(do_detect 2>/dev/null); rc=$?
[ "$rc" -eq 0 ] && ok "detect: rc=0 on present" || bad "detect: rc=$rc on present"
case "$out" in *"GLM_PROFILE: present"*) ok "detect: present emits 'GLM_PROFILE: present'" ;; *) bad "detect: present emits '$out'" ;; esac

# missing: bridge returns profiles but none match GLM_BASE_URL.
curl() {
  case "$*" in
    *"/runtime-profiles"*)
      printf '%s' '[{"id":"y","baseUrl":"https://api.openai.com","name":"OpenAI"}]'
      return 0
      ;;
    *) return 1 ;;
  esac
}
export -f curl
out=$(do_detect 2>/dev/null); rc=$?
[ "$rc" -eq 0 ] && ok "detect: rc=0 on missing" || bad "detect: rc=$rc on missing"
case "$out" in *"GLM_PROFILE: missing"*) ok "detect: missing emits 'GLM_PROFILE: missing'" ;; *) bad "detect: missing emits '$out'" ;; esac

# bridge-unreachable: curl fails.
curl() { return 1; }
export -f curl
out=$(do_detect 2>/dev/null); rc=$?
[ "$rc" -ne 0 ] && ok "detect: rc!=0 on bridge-unreachable" || bad "detect: rc=0 on bridge-unreachable"
case "$out" in *"GLM_PROFILE: bridge-unreachable"*) ok "detect: unreachable emits 'GLM_PROFILE: bridge-unreachable'" ;; *) bad "detect: unreachable emits '$out'" ;; esac

# ============================================================
# (b) explain — output contains env-file path + env-var name.
# Override GLM_ENV_FILE to a temp path so we can verify dir creation + path printing.
# ============================================================
TMP_HOME=$(mktemp -d)
GLM_ENV_FILE="$TMP_HOME/.config/getff/glm.env"
out=$(do_explain 2>/dev/null)
case "$out" in *"$GLM_ENV_FILE"*) ok "explain: env-file path printed" ;; *) bad "explain: env-file path missing: $out" ;; esac
case "$out" in *"ANTHROPIC_AUTH_TOKEN"*) ok "explain: env-var name printed" ;; *) bad "explain: env-var name missing: $out" ;; esac
case "$out" in *"\$18/mo"*) ok "explain: cost line preserved (escaped dollar)" ;; *) bad "explain: cost line broken: $out" ;; esac
# parent dir was created by do_explain
[ -d "$TMP_HOME/.config/getff" ] && ok "explain: parent dir created" || bad "explain: parent dir NOT created"
rm -rf "$TMP_HOME"

# ============================================================
# (c) provision — happy path + two failure modes.
# Stub curl to handle the three provision-stage URLs.
# ============================================================

# Happy path: step A returns {"id":"test-id"}, step B (GET /projects + PUT /projects/:id)
# returns the updated project, step C (POST /runtime-profiles/validate) returns {}.
# All return rc=0.
# ── FAIL-CLOSED stub (§7e.6) ────────────────────────────────────────────────
# Two rules this stub must obey, both learned from defects a permissive stub hid:
#
#  1. ORDER: the /validate arm MUST precede the generic create arm. A `case` takes the
#     FIRST match, and `*"/runtime-profiles"*` also matches `/runtime-profiles/validate`.
#     Run 4 had them the other way round, so its validate arm was dead code and step C was
#     silently tested against the CREATE response.
#  2. BODY-AWARENESS: the create arm must reject a body missing a schema-required field,
#     returning the same shape the live API returns. Probed 2026-08-09 against the live aif:
#       POST /runtime-profiles -d '{"name":"probe-only"}'
#         → HTTP 400 ZodError, path ["runtimeId"] and ["providerId"]
#     A stub that answers 201 regardless of body green-lights a flow that 400s in reality.
#
# Allowlist — every path the helper may call, each with the date it was probed live:
#   POST /runtime-profiles/validate   (probed 2026-08-09 → exists, 400 on empty body)
#   POST /runtime-profiles            (probed 2026-08-09 → exists, 400 without required ids)
#   PUT  /projects/:id                (§7d.1 #1)
#   GET  /projects                    (§7c #1)
# Anything else is a stub failure, not a pass — an invented endpoint is how run 3 shipped a
# ping to a path that returns 404.
# Echoes back the profile the helper pinned on the SESSION, mirroring aif: POST /chat resolves
# the profile from the session (chat.ts:1336), so the step-D binding assertion is exercised
# against what was actually pinned rather than against a constant.
#
# The pin is carried in a FILE, not a variable, and that is forced: the helper invokes curl
# inside `$( )`, so every stub call runs in its own subshell and any variable the session arm
# sets is gone before the /chat arm runs. A variable here would silently echo an empty profile
# and the binding assertion would fail for a reason that has nothing to do with the helper.
_STUB_PIN_FILE="$(mktemp)"
export _STUB_PIN_FILE
_stub_echo_chat() {
  printf '{"assistantMessage":"ok","usage":{"totalTokens":12},"runtime":{"profileId":"%s"}}' "$(cat "$_STUB_PIN_FILE" 2>/dev/null)"
}

_stub_create_body_ok() {
  # Mirrors createRuntimeProfileSchema's required set: runtimeId + providerId + name.
  case "$1" in
    *'"runtimeId"'*) ;;
    *) return 1 ;;
  esac
  case "$1" in
    *'"providerId"'*) ;;
    *) return 1 ;;
  esac
  return 0
}

curl() {
  case "$*" in
    # NOT IN THE ALLOWLIST — run 3's invented ping path. The live API 404s it
    # (probed 2026-08-09). Rejected explicitly so the assertion below tests the
    # allowlist, not some incidental body rule.
    *"/v1/messages"*)
      printf 'STUB-REJECT: endpoint does not exist on aif: %s\n' "$*" >&2
      return 22
      ;;
    # ORDER RULE — /chat/sessions BEFORE /chat, or the /chat glob swallows the session create.
    # Step D pins the profile on a SESSION, then sends the completion to that session: aif's
    # POST /chat reads the profile off the session (chat.ts:1336) and ignores a runtimeProfileId
    # in the chat body. The session stub records what was pinned so the /chat arm can echo it.
    *"-X POST"*"/chat/sessions"*)
      printf '%s' "$*" | sed -n 's/.*"runtimeProfileId":"\([^"]*\)".*/\1/p' > "$_STUB_PIN_FILE"
      printf '{"id":"stub-session-1"}'
      return 0
      ;;
    # Step D — the model proof (§7a #3 / §7e.3(2)). The stub ECHOES BACK the profile pinned on
    # the session rather than printing a constant: a constant would satisfy the helper's binding
    # assertion no matter what it sent, the same can't-fail shape §7e.6 rejects for stubs.
    *"-X POST"*"/chat"*)
      _stub_echo_chat
      return 0
      ;;
    # ORDER RULE — validate BEFORE the generic create arm.
    *"-X POST"*"/runtime-profiles/validate"*)
      # LIVE-SHAPE: live aif nests hasApiKey under .profile (probed 2026-08-09).
      # The helper's primary parse is jq '.profile.hasApiKey'; this stub exercises
      # that path. A second stub below (N5) covers the defensive-fallthrough branch
      # (no hasApiKey field anywhere → .ok-only check).
      printf '%s' '{"ok":true,"message":"Claude API profile configured","profile":{"hasApiKey":true,"apiKeyEnvVar":"ANTHROPIC_AUTH_TOKEN"}}'
      return 0
      ;;
    *"-X POST"*"/runtime-profiles"*)
      # BODY RULE — reject exactly what the live API rejects.
      if _stub_create_body_ok "$*"; then
        printf '%s' '{"id":"test-id","name":"Z.AI GLM-5.2"}'
        return 0
      fi
      printf '%s' '{"success":false,"error":{"name":"ZodError","message":"runtimeId/providerId required"}}'
      return 22   # curl -f exit code for HTTP 4xx
      ;;
    *"-X PUT"*"/projects/"*)
      printf '%s' '{"id":"proj-1","ok":true}'
      return 0
      ;;
    *"/projects"*)
      # GET /projects — return a project with an existing top-tier Plan profile.
      printf '%s' '[{"id":"proj-1","name":"default","defaultPlanRuntimeProfileId":"top-tier-1","defaultTaskRuntimeProfileId":"old-task","defaultReviewRuntimeProfileId":"old-review"}]'
      return 0
      ;;
    *)
      printf 'STUB-REJECT: path not in allowlist: %s\n' "$*" >&2
      return 1
      ;;
  esac
}
export -f curl

# Set up a temp HOME with the env file.
TMP_PROV=$(mktemp -d)
mkdir -p "$TMP_PROV/.config/getff"
printf 'ANTHROPIC_AUTH_TOKEN=test-key-not-real\n' > "$TMP_PROV/.config/getff/glm.env"
GLM_ENV_FILE="$TMP_PROV/.config/getff/glm.env"

out=$(do_provision 2>/dev/null); rc=$?
[ "$rc" -eq 0 ] && ok "provision happy: rc=0" || bad "provision happy: rc=$rc"
case "$out" in *"GLM_PROVISION: DONE profile-id=test-id"*) ok "provision happy: emits DONE profile-id=test-id" ;; *) bad "provision happy: emits '$out'" ;; esac

# Verify the key value is NOT in the output (key-handling invariant — sister check to (d)).
case "$out" in *"test-key-not-real"*) bad "provision happy: KEY VALUE LEAKED in stdout" ;; *) ok "provision happy: key value not in stdout" ;; esac

# ── PAIRED NEGATIVES (§7e.6) — the stub must FAIL on the known-bad inputs ────
# A stub that cannot be made to fail by feeding it run-4's actual defects is not evidence.

# N1 — the body rule catches a create body missing runtimeId/providerId (run 4's live 400).
if _stub_create_body_ok '{"name":"Z.AI GLM-5.2","defaultModel":"glm-5.2","apiKeyEnvVar":"ANTHROPIC_AUTH_TOKEN","baseUrl":"https://api.z.ai/api/anthropic"}'; then
  bad "neg N1: stub ACCEPTED run-4's create body (missing runtimeId/providerId) — stub is not fail-closed"
else
  ok "neg N1: stub rejects run-4's create body (missing runtimeId/providerId), as the live API does"
fi
if _stub_create_body_ok '{"name":"x","runtimeId":"claude","providerId":"anthropic"}'; then
  ok "neg N1b: stub accepts a body carrying both required ids (non-vacuous)"
else
  bad "neg N1b: stub rejected a VALID body — the body rule is over-tight"
fi

# N2 — the order rule: /validate must not be swallowed by the generic create arm.
# Reproduces run 4's ordering to prove the hazard is real, then asserts ours is correct.
# shellcheck disable=SC2221,SC2222  # the shadowed arm is the POINT — this function
# reproduces run 4's ordering on purpose so the guard below is proven non-vacuous.
# (Worth noting: SC2221/SC2222 flag this class automatically, and they fire on run 4's
# real stub too — shellcheck simply is not pointed at tests/install-sh/** today.)
_wrong_order() {
  case "$*" in
    *"-X POST"*"/runtime-profiles"*)         printf 'create-arm' ;;
    *"-X POST"*"/runtime-profiles/validate"*) printf 'validate-arm' ;;
    *) printf 'fallback' ;;
  esac
}
if [ "$(_wrong_order -s -X POST http://h/runtime-profiles/validate -d '{}')" = "create-arm" ]; then
  ok "neg N2: run-4 arm order provably swallows /validate (hazard is real, not theoretical)"
else
  bad "neg N2: could not reproduce the arm-order hazard — the guard below proves nothing"
fi
if [ "$(curl -s -X POST http://h/runtime-profiles/validate -d '{}' | jq -r '.ok // "no-ok-field"')" = "true" ]; then
  ok "neg N2b: our stub routes /validate to the validate arm (ordering correct)"
else
  bad "neg N2b: our stub did NOT route /validate to the validate arm — arm order regressed"
fi

# N3 — an endpoint outside the allowlist must be rejected, not silently answered.
# Run 3 shipped a ping to /runtime-profiles/<id>/v1/messages, which the live API 404s.
if curl -s -X POST "http://h/runtime-profiles/some-id/v1/messages" -d '{}' >/dev/null 2>&1; then
  bad "neg N3: stub ANSWERED an endpoint outside the allowlist (run-3's invented ping path)"
else
  ok "neg N3: stub rejects run-3's invented ping path (not in allowlist)"
fi

# ── N4 — §7e.4 binding verifier: hasApiKey:false MUST produce a hard MISS ─────
# A stub that always returns hasApiKey:true would let an unwired deployment report DONE.
# Run-3's helper parsed .ok only, so hasApiKey:false (the §7e.4 honest-MISS signal) was
# invisible. The run-4 helper MUST treat hasApiKey:false as FAILED step-C key-unreachable.

# Stub: same shape as happy path but hasApiKey:false.
_save_curl_type() { :; }  # placeholder for clarity
curl() {
  case "$*" in
    *"-X POST"*"/runtime-profiles/validate"*)
      # LIVE-SHAPE: nested .profile.hasApiKey:false (the §7e.4 honest-MISS signal).
      printf '%s' '{"ok":true,"message":"Claude API profile configured","profile":{"hasApiKey":false,"apiKeyEnvVar":"ANTHROPIC_AUTH_TOKEN"}}'
      return 0
      ;;
    *"-X POST"*"/runtime-profiles"*)
      if _stub_create_body_ok "$*"; then
        printf '%s' '{"id":"test-id","name":"Z.AI GLM-5.2"}'
        return 0
      fi
      return 22
      ;;
    *"-X PUT"*"/projects/"*)  printf '%s' '{"id":"proj-1","ok":true}'; return 0 ;;
    *"/projects"*)            printf '%s' '[{"id":"proj-1","defaultPlanRuntimeProfileId":"x"}]'; return 0 ;;
    *) return 1 ;;
  esac
}
export -f curl
# Force W1 to no-op (no docker-compose.yml in the test tmpdir) so the wiring path is the
# hasApiKey gate alone — that's what N4 exercises.
TMP_N4=$(mktemp -d)
AIF_HANDOFF_CHECKOUT="$TMP_N4/nonexistent-checkout"
export AIF_HANDOFF_CHECKOUT
out=$(do_provision 2>/dev/null); rc=$?
[ "$rc" -ne 0 ] && ok "neg N4: hasApiKey:false produces rc!=0 (objective-3 MISS)" || bad "neg N4: hasApiKey:false produced rc=0 (false green)"
case "$out" in *"FAILED step-C key-unreachable"*) ok "neg N4: emits FAILED step-C key-unreachable (§7e.4 verifier fired)" ;; *) bad "neg N4: emits '$out' — hasApiKey:false did not fire the §7e.4 gate" ;; esac
# Idempotency check: ensure we never dereferenced the value in the W1 path either.
case "$out" in *"test-key-not-real"*) bad "neg N4: KEY VALUE LEAKED in stdout" ;; *) ok "neg N4: key value not in stdout (W1 + hasApiKey gate preserve invariant)" ;; esac
rm -rf "$TMP_N4"
unset AIF_HANDOFF_CHECKOUT

# ── N5 — defensive-fallthrough: older aif WITHOUT .profile.hasApiKey or top-level .hasApiKey
# Helper's third branch (validate_has_key="") falls through to the .ok-only check. The helper
# MUST NOT fail in this case (older aif relies on .ok alone). This is the paired-positive for
# the third branch — the live shape (N1) and the top-level fallback are the other two.
TMP_N5=$(mktemp -d)
GLM_ENV_FILE="$TMP_N5/glm.env" AIF_HANDOFF_CHECKOUT="$TMP_N5/no-such" \
GLM_PROFILE_NAME="Z.AI GLM-5.2" RUNTIME_BRIDGE_AIF_URL="http://h" \
  bash -c '
    set -e
    printf "ANTHROPIC_AUTH_TOKEN=test-key-not-real\n" > "'"$TMP_N5"'/glm.env"
    # Stub: validate returns .ok:true but NO hasApiKey field anywhere.
    # FAIL-CLOSED, same contract as the base stub (§7e.6). This block previously carried a
    # catch-all returning rc=0 and a create arm with no body rule, so it would have green-lit
    # run 3s invented /v1/messages ping and a create body missing the required ids — W-4
    # reintroduced. Only the validate RESPONSE differs from the base stub; the allowlist and
    # the body rule are identical by contract.
    curl() {
      case "$*" in
        *"/v1/messages"*)
          printf "STUB-REJECT: endpoint does not exist on aif: %s\n" "$*" >&2; return 22 ;;
        *"-X POST"*"/chat/sessions"*)
          printf "%s" "$*" | sed -n "s/.*\"runtimeProfileId\":\"\([^\"]*\)\".*/\1/p" > "$_STUB_PIN_FILE"
          printf "{\"id\":\"stub-session-1\"}"; return 0 ;;
        *"-X POST"*"/chat"*)
          printf "{\"assistantMessage\":\"ok\",\"usage\":{\"totalTokens\":12},\"runtime\":{\"profileId\":\"$(cat "$_STUB_PIN_FILE" 2>/dev/null)\"}}"; return 0 ;;
        *"-X POST"*"/runtime-profiles/validate"*) printf "%s" "{\"ok\":true,\"message\":\"older aif without hasApiKey\"}"; return 0 ;;
        *"-X POST"*"/runtime-profiles"*)
          case "$*" in *\"runtimeId\"*) ;; *) printf "%s" "{\"success\":false,\"error\":{\"name\":\"ZodError\"}}"; return 22 ;; esac
          case "$*" in *\"providerId\"*) ;; *) printf "%s" "{\"success\":false,\"error\":{\"name\":\"ZodError\"}}"; return 22 ;; esac
          printf "%s" "{\"id\":\"test-id\",\"name\":\"Z.AI GLM-5.2\"}"; return 0 ;;
        *"-X PUT"*"/projects/"*) printf "%s" "{\"id\":\"proj-1\",\"ok\":true}"; return 0 ;;
        *"/runtime-profiles"*) printf "[]"; return 0 ;;
        *"/projects"*) printf "%s" "[{\"id\":\"proj-1\",\"defaultPlanRuntimeProfileId\":\"x\"}]"; return 0 ;;
        *) printf "STUB-REJECT: path not in allowlist: %s\n" "$*" >&2; return 1 ;;
      esac
    }
    export -f curl
    bash "'"$REPO_ROOT"'/scripts/getff-glm-onebutton.sh" provision 2>/dev/null
  '
rc=$?
[ "$rc" -eq 0 ] && ok "neg N5: defensive fallthrough (no hasApiKey field) → rc=0 (older aif compatible)" || bad "neg N5: rc=$rc — defensive fallthrough wrongly failed (regression on older aif support)"
rm -rf "$TMP_N5"

# ── _wire_key_reachability unit tests (W1 logic, isolated) ───────────────────
# When the deployment is absent (the in-container case), the function MUST return 1
# (W2 fallback). When the deployment is present + writable + unmarked, it MUST write
# the override and return 0. When an unmarked override already exists, it MUST back off
# (return 2) without clobbering.

# Restore the happy-path curl stub for any later tests.
curl() {
  case "$*" in
    *"-X POST"*"/runtime-profiles/validate"*)
      # LIVE-SHAPE: nested .profile.hasApiKey.
      printf '%s' '{"ok":true,"message":"Claude API profile configured","profile":{"hasApiKey":true,"apiKeyEnvVar":"ANTHROPIC_AUTH_TOKEN"}}'
      return 0
      ;;
    *"-X POST"*"/runtime-profiles"*)
      if _stub_create_body_ok "$*"; then
        printf '%s' '{"id":"test-id","name":"Z.AI GLM-5.2"}'
        return 0
      fi
      return 22
      ;;
    *"-X PUT"*"/projects/"*)  printf '%s' '{"id":"proj-1","ok":true}'; return 0 ;;
    *"/projects"*)            printf '%s' '[{"id":"proj-1","defaultPlanRuntimeProfileId":"x"}]'; return 0 ;;
    *) return 1 ;;
  esac
}
export -f curl

# W1-absent: no checkout directory → return 1.
TMP_WIRE=$(mktemp -d)
AIF_HANDOFF_CHECKOUT="$TMP_WIRE/no-such"
wire_out=$(_wire_key_reachability 2>/dev/null); wire_rc=$?
[ "$wire_rc" -eq 1 ] && ok "wire-absent: rc=1 when no docker-compose.yml (W2 fallback)" || bad "wire-absent: rc=$wire_rc (expected 1)"

# W1-write: create a docker-compose.yml with two services; helper MUST write the override.
mkdir -p "$TMP_WIRE/checkout"
cat > "$TMP_WIRE/checkout/docker-compose.yml" <<'YML'
services:
  api:
    image: aif-handoff-api
    env_file:
      - .env
  agent:
    image: aif-handoff-agent
    env_file:
      - .env
YML
AIF_HANDOFF_CHECKOUT="$TMP_WIRE/checkout"
# Stub docker as a function returning 127. Note: `command -v docker` finds the
# function (returns 0), so the helper takes the "docker compose up -d failed"
# branch (helper line ~194-196), not the "docker not in PATH" branch. Either way
# the override IS written and the function returns 0. Function stub (not PATH
# mangling) keeps coreutils (awk/sort/etc.) available for the override writer.
docker() { return 127; }
export -f docker
wire_out=$(_wire_key_reachability 2>/dev/null); wire_rc=$?
[ "$wire_rc" -eq 0 ] && ok "wire-write: rc=0 (W1 override written; reload deferred)" || bad "wire-write: rc=$wire_rc (expected 0)"
unset -f docker
override_path="$TMP_WIRE/checkout/docker-compose.override.yml"
[ -f "$override_path" ] && ok "wire-write: override file created" || bad "wire-write: override file NOT created"
if [ -f "$override_path" ] && grep -qF 'getff-glm-override-marker' "$override_path"; then
  ok "wire-write: override carries our marker"
else
  bad "wire-write: override missing marker"
fi
# Verify override covers BOTH detected services + references glm.env path (NOT the value).
if [ -f "$override_path" ] && grep -qE '^  api:' "$override_path" \
   && grep -qE '^  agent:' "$override_path" \
   && grep -qF 'glm.env' "$override_path"; then
  ok "wire-write: override lists api + agent + glm.env path"
else
  bad "wire-write: override missing service entries or glm.env path"
fi
if [ -f "$override_path" ] && grep -qiE 'sk-[a-z]|test-key' "$override_path"; then
  bad "wire-write: override LEAKED a value-shaped token (must hold paths only)"
else
  ok "wire-write: override holds paths only (no value tokens)"
fi

# W1-idempotent: second invocation MUST be a no-op (return 0) without rewriting.
# Track inode-change rather than mtime — mtime has 1-second granularity and idempotency
# check needs to be deterministic. Re-running on a marked file MUST NOT open it for write.
override_size_before=$(wc -c < "$override_path" 2>/dev/null || echo 0)
override_hash_before=$(md5sum "$override_path" 2>/dev/null | awk '{print $1}' || echo "")
wire_out=$(_wire_key_reachability 2>/dev/null); wire_rc=$?
[ "$wire_rc" -eq 0 ] && ok "wire-idempotent: rc=0 on second invocation" || bad "wire-idempotent: rc=$wire_rc (expected 0)"
override_hash_after=$(md5sum "$override_path" 2>/dev/null | awk '{print $1}' || echo "")
[ "$override_hash_before" = "$override_hash_after" ] && ok "wire-idempotent: override unchanged on second invocation" || bad "wire-idempotent: override was rewritten (NOT idempotent)"

# W1-collision: replace our marked override with an unmarked file → MUST return 2.
rm -f "$override_path"
cat > "$override_path" <<'YML'
services:
  api:
    image: consumer-custom-image
YML
wire_out=$(_wire_key_reachability 2>/dev/null); wire_rc=$?
[ "$wire_rc" -eq 2 ] && ok "wire-collision: rc=2 when unmarked override exists (W2 fallback, no clobber)" || bad "wire-collision: rc=$wire_rc (expected 2)"
# Verify the consumer's file was NOT touched.
if grep -qF 'consumer-custom-image' "$override_path"; then
  ok "wire-collision: consumer override preserved (no clobber)"
else
  bad "wire-collision: consumer override was OVERWRITTEN"
fi
rm -rf "$TMP_WIRE"
unset AIF_HANDOFF_CHECKOUT

# Step-A failure: REST profile create returns nonzero.
curl() {
  case "$*" in
    *"-X POST"*"/runtime-profiles"*) return 1 ;;  # create fails
    *) return 1 ;;
  esac
}
export -f curl
out=$(do_provision 2>/dev/null); rc=$?
[ "$rc" -ne 0 ] && ok "provision step-A fail: rc!=0" || bad "provision step-A fail: rc=0"
case "$out" in *"GLM_PROVISION: FAILED step-A rest-create-nonzero"*) ok "provision step-A fail: emits FAILED step-A rest-create-nonzero" ;; *) bad "provision step-A fail: emits '$out'" ;; esac

# Preflight env-file missing: no env file at $GLM_ENV_FILE.
# Fail-CLOSED even though curl never fires here — the preflight env-file check returns before
# any request is made. `return 0` was the caseless fail-open shape the §7e.6 meta-scanner's
# declared population used to exclude; it was harmless only by accident of call order, and
# "harmless today" is not the invariant this suite asserts.
curl() { return 1; }  # curl doesn't even fire — preflight catches first
export -f curl
TMP_NOENV=$(mktemp -d)
GLM_ENV_FILE="$TMP_NOENV/.config/getff/glm.env"  # pointed at non-existent path
out=$(do_provision 2>/dev/null); rc=$?
[ "$rc" -ne 0 ] && ok "provision preflight: rc!=0" || bad "provision preflight: rc=0"
case "$out" in *"GLM_PROVISION: FAILED preflight env-file-missing"*) ok "provision preflight: emits FAILED preflight env-file-missing" ;; *) bad "provision preflight: emits '$out'" ;; esac
rm -rf "$TMP_NOENV" "$TMP_PROV"

# ============================================================
# (d) Key-handling invariant grep — the value is NEVER echoed/logged.
# The helper references $ANTHROPIC_AUTH_TOKEN ONLY in the source-and-redact context;
# echo/printf/log statements must NOT carry the value-bearing variable reference.
# Per kickoff §6 T19 + §4 item 2 — this invariant is design-stop-on-violation.
# ============================================================
# The grep pattern: any echo/printf/log statement that also references $ANTHROPIC_AUTH_TOKEN
# (or ${ANTHROPIC_AUTH_TOKEN} / ${!GLM_ENV_VAR}-with-GLM_ENV_VAR=ANTHROPIC_AUTH_TOKEN context).
# The allowlist: the env-var-unset check `[ -z "${!GLM_ENV_VAR:-}" ]` is OK (test, not echo).
INVARIANT_VIOLATIONS=$(grep -nE '(\becho\b|\bprintf\b|\b_log\b|\b_warn\b).*\$\{?ANTHROPIC_AUTH_TOKEN\}?' "$REPO_ROOT/scripts/getff-glm-onebutton.sh" || true)
if [ -z "$INVARIANT_VIOLATIONS" ]; then
  ok "key-handling invariant: no echo/printf/log/_log/_warn line references \$ANTHROPIC_AUTH_TOKEN"
else
  bad "key-handling invariant VIOLATED: $INVARIANT_VIOLATIONS"
fi

# Positive control: the env-var NAME (without $) IS legitimately referenced (constants block).
NAME_REFS=$(grep -cE 'GLM_ENV_VAR=|ANTHROPIC_AUTH_TOKEN' "$REPO_ROOT/scripts/getff-glm-onebutton.sh" || true)
[ "$NAME_REFS" -ge 2 ] && ok "key-handling invariant: env-var name referenced ($NAME_REFS sites — name, not value)" || bad "key-handling invariant: env-var name not referenced"

# ============================================================
# (e) Regression guards for §7c #1 (PUT /projects/:id, no PATCH /project) + §7c #3 + §7d.1 #3
#     (POST /runtime-profiles/validate, no direct vendor ping) + §7d.1 #4 (no x-api-key attribution).
# ============================================================

# §7c #1 — run-2 invented PATCH /project; must be gone.
if grep -qE 'PATCH.*"\$AIF_URL/project"' "$REPO_ROOT/scripts/getff-glm-onebutton.sh"; then
  bad "regression §7c #1: helper still contains PATCH \$AIF_URL/project (must be PUT /projects/:id)"
else
  ok "regression §7c #1: no PATCH \$AIF_URL/project (PUT /projects/:id in use)"
fi

# §7c #1 positive — PUT /projects/ must be present.
if grep -qE 'PUT.*"\$AIF_URL/projects/' "$REPO_ROOT/scripts/getff-glm-onebutton.sh"; then
  ok "regression §7c #1: PUT /projects/:id present"
else
  bad "regression §7c #1: PUT /projects/:id MISSING"
fi

# §7c #3 / §7d.1 #3 — direct vendor ping must be gone (match non-comment lines only).
if grep -vE '^\s*#' "$REPO_ROOT/scripts/getff-glm-onebutton.sh" | grep -qE 'GLM_BASE_URL.*v1/messages'; then
  bad "regression §7c #3: helper still pings \$GLM_BASE_URL/v1/messages directly (must use /runtime-profiles/validate)"
else
  ok "regression §7c #3: no direct vendor ping (uses POST /runtime-profiles/validate)"
fi

# §7c #3 / §7d.1 #3 positive — POST /runtime-profiles/validate must be present.
if grep -qE 'POST.*runtime-profiles/validate' "$REPO_ROOT/scripts/getff-glm-onebutton.sh"; then
  ok "regression §7c #3: POST /runtime-profiles/validate present"
else
  bad "regression §7c #3: POST /runtime-profiles/validate MISSING"
fi

# §7d.1 #4 — invented x-api-key attribution must be gone.
if grep -qiE 'x-api-key.*SKILL\.md.*D3|SKILL\.md.*D3.*x-api-key' "$REPO_ROOT/scripts/getff-glm-onebutton.sh"; then
  bad "regression §7d.1 #4: helper still attributes x-api-key to SKILL.md D3 (D3 names ANTHROPIC_AUTH_TOKEN only)"
else
  ok "regression §7d.1 #4: no invented x-api-key attribution"
fi

# §7d.1 #4 — no x-api-key header line at all (the validate endpoint builds the request).
if grep -qE 'x-api-key: ' "$REPO_ROOT/scripts/getff-glm-onebutton.sh"; then
  bad "regression §7d.1 #4: helper still carries an x-api-key header line (aif builds the request via /validate)"
else
  ok "regression §7d.1 #4: no x-api-key header line (aif builds the request)"
fi

# §7e.2 — the two schema-required ids must be in the create body. Live-probed 2026-08-09:
# omitting them returns HTTP 400 ZodError, so a helper without them can never provision.
if grep -qE 'runtimeId: \$runtime' "$REPO_ROOT/scripts/getff-glm-onebutton.sh" \
   && grep -qE 'providerId: \$provider' "$REPO_ROOT/scripts/getff-glm-onebutton.sh"; then
  ok "regression §7e.2: create body carries runtimeId + providerId (schema-required)"
else
  bad "regression §7e.2: create body MISSING runtimeId/providerId — live API returns 400"
fi

# §7e.3 — transport must be explicit. Without it the profile resolves to SDK, and for SDK
# transport validateClaudeConnection returns ok unconditionally, so step C can never fail.
# Measured 2026-08-09: no transport → {"ok":true,"transport":"sdk","hasApiKey":false}.
if grep -qE 'transport: \$transport' "$REPO_ROOT/scripts/getff-glm-onebutton.sh"; then
  ok "regression §7e.3: create body sets transport explicitly (SDK default would void step C)"
else
  bad "regression §7e.3: transport not set — step C degenerates to an unconditional pass"
fi

# §7e.3 — step C must read the verdict from the body. /runtime-profiles/validate answers
# HTTP 200 even when validation FAILS (measured 2026-08-09), so `curl -sf`'s exit code is
# not the verdict; a helper that trusts it reports a false green.
if grep -qE "jq -r '\.ok" "$REPO_ROOT/scripts/getff-glm-onebutton.sh"; then
  ok "regression §7e.3: step C parses .ok from the body (200-with-ok:false is not a pass)"
else
  bad "regression §7e.3: step C trusts the HTTP status — validate returns 200 on failure"
fi

# ── N6 — the per-mode-default PUT failing is a TERMINAL objective-3 MISS ─────
# §2 constraint 4: a degrade to manual steps is an objective-3 MISS, not a neutral fallback.
# The helper used to warn here and fall through to `GLM_PROVISION: DONE`, and
# INSTALL-FOR-AI.md tells the consumer's agent to report that line verbatim — so a missed
# binding objective reached the consumer as success. This is the paired-negative for that.
TMP_N6=$(mktemp -d)
printf 'ANTHROPIC_AUTH_TOKEN=test-key-not-real\n' > "$TMP_N6/glm.env"
curl() {
  case "$*" in
    *"/v1/messages"*) return 22 ;;
    *"-X POST"*"/runtime-profiles/validate"*)
      printf '%s' '{"ok":true,"profile":{"hasApiKey":true}}'; return 0 ;;
    *"-X POST"*"/runtime-profiles"*)
      if _stub_create_body_ok "$*"; then printf '%s' '{"id":"test-id"}'; return 0; fi
      return 22 ;;
    # THE ONE DIFFERENCE from the happy path: the per-mode-default PUT is rejected.
    *"-X PUT"*"/projects/"*)
      printf '%s' '{"success":false,"error":{"name":"ZodError"}}'; return 22 ;;
    *"/projects"*) printf '%s' '[{"id":"proj-1","defaultPlanRuntimeProfileId":"x"}]'; return 0 ;;
    *) return 1 ;;
  esac
}
export -f curl
GLM_ENV_FILE="$TMP_N6/glm.env" AIF_HANDOFF_CHECKOUT="$TMP_N6/no-such" out=$(do_provision 2>/dev/null); rc=$?
[ "$rc" -ne 0 ] && ok "neg N6: per-mode-default PUT failure produces rc!=0 (terminal MISS)" || bad "neg N6: PUT failure produced rc=0 — objective-3 MISS reported as success"
case "$out" in *"GLM_PROVISION: DONE"*) bad "neg N6: printed DONE despite an objective-3 MISS (false green reaches the consumer)" ;; *) ok "neg N6: no DONE line emitted on an objective-3 MISS" ;; esac
case "$out" in *"FAILED step-B per-mode-defaults"*) ok "neg N6: emits FAILED step-B per-mode-defaults" ;; *) bad "neg N6: emits '$out' — the MISS carries no machine-readable terminal token" ;; esac
rm -rf "$TMP_N6"

# ── N7/N8/N9 — step D (§7a #3 model proof) fails closed on each way it can lie ──
# The model proof exists to catch a key that resolves but is not VALID at the vendor. It can
# be faked three ways, so each has its own negative: the call not happening at all, the
# completion running on a DIFFERENT profile than the one this run wired, and a "completion"
# that billed nothing. Without these three, step D would be a can't-fail step — exactly the
# §7e.6 shape this suite already rejects for stubs.
TMP_ND=$(mktemp -d)
printf 'ANTHROPIC_AUTH_TOKEN=test-key-not-real\n' > "$TMP_ND/glm.env"
_nd_stub() {  # $1 = /chat response body, $2 = /chat return code
  _ND_JSON="$1"; _ND_RC="$2"
  curl() {
    case "$*" in
      *"/v1/messages"*) return 22 ;;
      *"-X POST"*"/chat/sessions"*) printf '%s' '{"id":"stub-session-1"}'; return 0 ;;
      *"-X POST"*"/chat"*) printf '%s' "$_ND_JSON"; return "$_ND_RC" ;;
      *"-X POST"*"/runtime-profiles/validate"*) printf '%s' '{"ok":true,"profile":{"hasApiKey":true}}'; return 0 ;;
      *"-X POST"*"/runtime-profiles"*)
        if _stub_create_body_ok "$*"; then printf '%s' '{"id":"test-id"}'; return 0; fi
        return 22 ;;
      *"-X PUT"*"/projects/"*) printf '%s' '{"id":"proj-1","ok":true}'; return 0 ;;
      *"/projects"*) printf '%s' '[{"id":"proj-1","defaultPlanRuntimeProfileId":"x"}]'; return 0 ;;
      *) printf 'STUB-REJECT: path not in allowlist: %s\n' "$*" >&2; return 1 ;;
    esac
  }
  export -f curl
}
_nd_run() { GLM_ENV_FILE="$TMP_ND/glm.env" AIF_HANDOFF_CHECKOUT="$TMP_ND/no-such" do_provision 2>/dev/null; }

_nd_stub '' 22
out=$(_nd_run); rc=$?
[ "$rc" -ne 0 ] && ok "neg N7: /chat unreachable → rc!=0" || bad "neg N7: unreachable model proof still returned rc=0"
case "$out" in *"FAILED step-D model-proof-unreachable"*) ok "neg N7: emits FAILED step-D model-proof-unreachable" ;; *) bad "neg N7: emits '$out'" ;; esac

_nd_stub '{"assistantMessage":"ok","usage":{"totalTokens":12},"runtime":{"profileId":"someone-elses-profile"}}' 0
out=$(_nd_run); rc=$?
[ "$rc" -ne 0 ] && ok "neg N8: completion on a DIFFERENT profile → rc!=0" || bad "neg N8: accepted a completion billed to another profile"
case "$out" in *"FAILED step-D model-proof-wrong-profile"*) ok "neg N8: emits FAILED step-D model-proof-wrong-profile" ;; *) bad "neg N8: emits '$out'" ;; esac

_nd_stub '{"assistantMessage":"ok","usage":{"totalTokens":0},"runtime":{"profileId":"test-id"}}' 0
out=$(_nd_run); rc=$?
[ "$rc" -ne 0 ] && ok "neg N9: zero-token 'completion' → rc!=0" || bad "neg N9: accepted a completion that billed nothing"
case "$out" in *"FAILED step-D model-proof-no-usage"*) ok "neg N9: emits FAILED step-D model-proof-no-usage" ;; *) bad "neg N9: emits '$out'" ;; esac

# N10 — the FOURTH way step D can lie, and the only one that used to fall OPEN. The usage gate
# was `[ "$chat_tokens" -le 0 ] 2>/dev/null`: on a non-numeric value `[` errors out (status 2),
# the `if` is therefore false, and control falls straight through to `GLM_PROVISION: DONE`.
# `null` and an absent `usage` object are safe — jq's `// 0` turns both into `0`, which the
# arithmetic test catches — so the reachable window is narrow (aif types `RuntimeUsage.totalTokens`
# as `number`). Narrow is not closed, and this is a fail-OPEN branch inside the one step whose
# entire job is to fail closed. Both halves are asserted: a string, and a JSON float — `12.5`
# is numeric in JSON but not an integer, so `[ -le ]` errors on it exactly as it does on `abc`.
_nd_stub '{"assistantMessage":"ok","usage":{"totalTokens":"abc"},"runtime":{"profileId":"test-id"}}' 0
out=$(_nd_run); rc=$?
[ "$rc" -ne 0 ] && ok "neg N10: non-numeric totalTokens → rc!=0" || bad "neg N10: non-numeric totalTokens fell through to DONE (usage gate fails OPEN)"
case "$out" in *"FAILED step-D model-proof-unusable-usage"*) ok "neg N10: emits FAILED step-D model-proof-unusable-usage" ;; *) bad "neg N10: emits '$out'" ;; esac
case "$out" in *"GLM_PROVISION: DONE"*) bad "neg N10: printed DONE on an unparseable usage figure" ;; *) ok "neg N10: no DONE line on an unparseable usage figure" ;; esac

_nd_stub '{"assistantMessage":"ok","usage":{"totalTokens":12.5},"runtime":{"profileId":"test-id"}}' 0
out=$(_nd_run); rc=$?
[ "$rc" -ne 0 ] && ok "neg N10b: non-integer totalTokens → rc!=0" || bad "neg N10b: non-integer totalTokens fell through to DONE (usage gate fails OPEN)"

# N10c — paired POSITIVE, so N10/N10b cannot be satisfied by a gate that rejects everything.
# A plain positive integer MUST still pass the widened test.
_nd_stub '{"assistantMessage":"ok","usage":{"totalTokens":12},"runtime":{"profileId":"test-id"}}' 0
out=$(_nd_run); rc=$?
[ "$rc" -eq 0 ] && ok "neg N10c: a positive integer usage figure still passes (gate is not reject-all)" || bad "neg N10c: rc=$rc — the widened usage gate rejects a VALID completion"

# §2 constraint 1 on the NEW surface — step D must not put the key value in any request.
#
# The captured requests go to a FILE, not a shell variable, and that is forced for the same
# reason as the pin file above: the helper invokes curl inside `$( )`, so each stub call runs
# in its own subshell and a variable assignment dies with it. An earlier version of this block
# accumulated into `_ND_SEEN` and therefore asserted against an empty string — it reported the
# invariant held while a deliberately injected key value sailed past it. That is the exact
# can't-fail shape §7e.6 forbids, and it is why the paired-negative below is not optional.
_ND_SEEN_FILE=$(mktemp)
export _ND_SEEN_FILE
: > "$_ND_SEEN_FILE"
curl() {
  case "$*" in
    *"-X POST"*"/chat/sessions"*) printf '%s\n' "$*" >> "$_ND_SEEN_FILE"; printf '%s' '{"id":"stub-session-1"}'; return 0 ;;
    *"-X POST"*"/chat"*) printf '%s\n' "$*" >> "$_ND_SEEN_FILE"; printf '%s' '{"assistantMessage":"ok","usage":{"totalTokens":12},"runtime":{"profileId":"test-id"}}'; return 0 ;;
    *"-X POST"*"/runtime-profiles/validate"*) printf '%s\n' "$*" >> "$_ND_SEEN_FILE"; printf '%s' '{"ok":true,"profile":{"hasApiKey":true}}'; return 0 ;;
    # Body rule, same as every sibling stub — a create arm that answers 2xx without inspecting
    # the body is W-4's tell verbatim.
    *"-X POST"*"/runtime-profiles"*)
      printf '%s\n' "$*" >> "$_ND_SEEN_FILE"
      if _stub_create_body_ok "$*"; then printf '%s' '{"id":"test-id"}'; return 0; fi
      printf '%s' '{"success":false,"error":{"name":"ZodError"}}'; return 22 ;;
    *"-X PUT"*"/projects/"*) printf '%s\n' "$*" >> "$_ND_SEEN_FILE"; printf '%s' '{"id":"proj-1","ok":true}'; return 0 ;;
    *"/projects"*) printf '%s\n' "$*" >> "$_ND_SEEN_FILE"; printf '%s' '[{"id":"proj-1","defaultPlanRuntimeProfileId":"x"}]'; return 0 ;;
    *) printf 'STUB-REJECT: path not in allowlist: %s\n' "$*" >&2; return 1 ;;
  esac
}
GLM_ENV_FILE="$TMP_ND/glm.env" AIF_HANDOFF_CHECKOUT="$TMP_ND/no-such" do_provision >/dev/null 2>&1

# Guard the guard: the leak assertion below is about STEP D's request bodies, so the guard has
# to establish that step D's completion request is actually in the capture — not merely that the
# capture is non-empty. `[ -s ]` was weaker than the property it protects: aborting the helper
# right after step A leaves NINE earlier requests in the file, so `-s` reported
# «capture is non-empty (9 requests recorded)» and the leak assertion passed while no `/chat`
# completion had ever been made (measured on a scratch copy with an injected early `return 1`).
# Match a whitespace-delimited token ENDING in `/chat`, which is the completion POST — the
# `/chat/sessions` create is a different token and must not satisfy this guard on its own.
_nd_chat_reqs=$(grep -cE '(^|[[:space:]])[^[:space:]]*/chat([[:space:]]|$)' "$_ND_SEEN_FILE" || true)
if [ "$_nd_chat_reqs" -ge 1 ]; then
  ok "key-invariant capture carries step D's completion request ($_nd_chat_reqs POST /chat, $(wc -l < "$_ND_SEEN_FILE" | tr -d ' ') requests total)"
else
  bad "key-invariant capture has NO POST /chat completion — the leak assertion below cannot fail (vacuous)"
fi
if grep -q 'test-key-not-real' "$_ND_SEEN_FILE"; then
  bad "step D: KEY VALUE LEAKED into a request body (§2 constraint 1)"
else
  ok "step D: requests carry the profile id, never the key value (§2 constraint 1)"
fi
# PAIRED NEGATIVE — the detector must fire on a request that DOES carry the value, otherwise the
# green above says nothing. This has to exercise the REAL path: an earlier version wrote a
# leak-shaped string to a temp file and grepped it back, which proved that `grep` works — never
# that the capture wiring would carry a real leak from a request body to the grep. The two are
# different claims, and only the second is the property under test.
#
# So: build a scratch copy of the helper with the key value injected into step D's chat body
# (exactly the mutation a §2 constraint 1 violation would be), run it against the SAME capture
# stub, and assert the value lands in the capture. Nothing but the injection differs — same
# helper, same stub, same grep.
_leak_capture=$(mktemp)
_leaky_helper=$(mktemp)
sed -e 's|--arg s "$chat_session_id"|--arg s "$chat_session_id" --arg LEAKV "${!GLM_ENV_VAR}"|' \
    -e 's|word: ok"}|word: ok", leak:$LEAKV}|' \
    "$REPO_ROOT/scripts/getff-glm-onebutton.sh" > "$_leaky_helper"
# Confirm the injection actually landed — a silently-failed sed would make the negative vacuous
# in precisely the way this block exists to prevent.
if grep -q 'leak:\$LEAKV' "$_leaky_helper" && grep -q 'arg LEAKV' "$_leaky_helper"; then
  ok "key-invariant paired-negative: leak injected into step D's chat body (mutation applied)"
else
  bad "key-invariant paired-negative: leak injection did NOT apply — the negative below is vacuous"
fi
(
  _ND_SEEN_FILE="$_leak_capture"; export _ND_SEEN_FILE
  GLM_LIB_ONLY=1 source "$_leaky_helper"
  set +e
  GLM_ENV_FILE="$TMP_ND/glm.env" AIF_HANDOFF_CHECKOUT="$TMP_ND/no-such" do_provision >/dev/null 2>&1
)
if grep -q 'test-key-not-real' "$_leak_capture"; then
  ok "key-invariant paired-negative: a value injected into step D's body reaches the detector (capture wiring is live)"
else
  bad "key-invariant paired-negative: an injected leak did NOT reach the detector — the green above cannot fail"
fi
rm -f "$_leak_capture" "$_leaky_helper" "$_ND_SEEN_FILE"
rm -rf "$TMP_ND"

# ── §7c #1 regression — the PUT body must omit null budget fields ────────────
# ROOT CAUSE of the objective-3 MISS, measured live 2026-08-09 rather than reasoned about:
# `createProjectSchema` (aif `packages/api/src/schemas.ts`) declares the four
# `*MaxBudgetUsd` fields as `z.number().positive().optional()` — optional but NOT nullable —
# while `GET /projects` returns them as `null`. PUTting the GET body back verbatim therefore
# 400s with `expected number, received null` on `plannerMaxBudgetUsd` (reproduced live), which
# is exactly the rc=22 the research patch recorded. Dropping the null-valued budget keys makes
# the same PUT return 200 with every other value unchanged (verified live).
if grep -q 'endswith("MaxBudgetUsd")' "$REPO_ROOT/scripts/getff-glm-onebutton.sh"; then
  ok "regression §7c #1: PUT body drops null-valued *MaxBudgetUsd keys (schema rejects null)"
else
  bad "regression §7c #1: PUT body passes GET nulls through — createProjectSchema 400s on them"
fi

# ============================================================
# (e) META — §7e.6 structural: every curl stub in THIS file fails closed.
# ============================================================
# Why this exists as a gate rather than a comment: W-4 ("the curl stub is fail-closed") was
# reported CLEAN in round 3, then REINTRODUCED in round 4 — the N5 stub was a copy of the base
# stub that drifted, its catch-all returning rc=0. A stub that cannot fail on a known-bad path
# is not evidence, and the drift is invisible to every assertion above because those assertions
# only exercise paths the helper actually takes. A prose reminder rots under exactly the fatigue
# that causes the copy-drift (.claude/rules/attention-is-not-a-mechanism.md §1), so the
# invariant is asserted mechanically over this file's own source.
# Scoped to `curl()` stubs — the invariant's declared population. Other case statements in
# this file (e.g. the `_wrong_order` hazard reproducer) are not stubs and must not be graded
# against it.
#
# THREE fail-open shapes are caught, not one:
#   (i)   an explicit `return 0` in the catch-all arm;
#   (ii)  a catch-all arm with no `return` at all — a case arm inherits the exit status of its
#         last command, so `*) printf 'x' ;;` is just as fail-open as `*) return 0 ;;` and reads
#         as if it were safe;
#   (iii) a CASELESS stub — `curl() { return 0; }` answers 2xx-equivalent for every path, which
#         is the most fail-open shape there is, and it has no catch-all arm for (i)/(ii) to
#         match. The scanner's declared population was `case`-based stubs only, so this shape
#         was invisible to it; the file carried one (the preflight stub, whose curl never
#         fires). Declaring the population and then scanning a subset of it is the same
#         can't-fail shape this gate exists to reject, so the population is widened rather
#         than narrowed in prose.
# A caseless stub is fail-closed iff its body carries an explicit non-zero `return`.
_scan_failopen_catchalls() {
  awk '
    # A comment is not a stub. Without this the scanner flags the prose above, which names the
    # caseless shape literally in order to describe it — and the previous shape-workaround
    # (assembling fixtures so no literal catch-all arm appears in this file) had to exist for
    # exactly the same reason. Skipping comments removes the class rather than dodging it.
    /^[[:space:]]*#/ { next }
    # (iii-a) single-line stub — definition and body on one line. Both flavours are graded:
    # a caseless one-liner on its body, a case-based one-liner on its LAST `*)` arm (the
    # catch-all; the greedy sub is deliberate — earlier `*)` are pattern-arm terminators).
    # STATED LIMIT: a case-based stub with no catch-all arm at all is fail-open too — bash
    # returns 0 from a `case` that matches nothing — and is NOT detected here.
    /curl\(\)[[:space:]]*\{.*\}/ {
      body = $0
      sub(/^.*curl\(\)[[:space:]]*\{/, "", body)
      sub(/\}[^}]*$/, "", body)
      if (body ~ /case/) {
        if (body ~ /\*\)/) {
          arm = body; sub(/^.*\*\)/, "", arm)
          if (arm ~ /return[[:space:]]+0/ || arm !~ /return[[:space:]]+[0-9]+/) print NR
        }
      } else if (body !~ /return[[:space:]]+[1-9]/) print NR
      next
    }
    /curl\(\)[[:space:]]*\{/ { in_curl = 1; curl_start = NR; saw_case = 0; saw_nonzero = 0 }
    in_curl && /case[[:space:]]/          { saw_case = 1 }
    in_curl && /return[[:space:]]+[1-9]/  { saw_nonzero = 1 }
    # (iii-b) multi-line stub that closed without ever opening a case.
    in_curl && /^[[:space:]]*\}[[:space:]]*$/ {
      if (!saw_case && !saw_nonzero) print curl_start
      in_curl = 0
    }
    in_curl && /^[[:space:]]*\*\)/ {
      arm = $0; ln = NR
      while (arm !~ /;;/ && (getline line) > 0) arm = arm " " line
      if (arm ~ /return[[:space:]]+0/ || arm !~ /return[[:space:]]+[0-9]+/) printf "%d\n", ln
    }' "$1"
}

_failopen=$(_scan_failopen_catchalls "$0")
if [ -z "$_failopen" ]; then
  ok "meta §7e.6: every curl stub (case-based AND caseless) fails closed on an unallowlisted path"
else
  bad "meta §7e.6: fail-open stub(s)/arm(s) at line(s): $(echo "$_failopen" | tr '\n' ' ')"
fi

# PAIRED NEGATIVE — the scanner must FAIL on a deliberately fail-open stub, otherwise the
# assertion above is vacuous and would pass on an empty file just as happily (T15 non-vacuity).
# The fixture is assembled programmatically rather than written as a literal heredoc: a
# heredoc would put a real fail-open catch-all into THIS file's source, and the scanner above
# reads `$0` — it would flag its own test fixture. (It did, on the first run of this gate.)
_tmp_fixture=$(mktemp)
{
  printf 'curl() {\n'
  printf '  case "$*" in\n'
  printf '    %s printf "STUB-DEFAULT"; return 0 ;;\n' '*)'
  printf '  esac\n}\n'
} > "$_tmp_fixture"
if [ -n "$(_scan_failopen_catchalls "$_tmp_fixture")" ]; then
  ok "meta §7e.6 paired-negative: the scanner flags a fail-open catch-all (non-vacuous)"
else
  bad "meta §7e.6 paired-negative: scanner passed a fail-open stub — the meta check is vacuous"
fi
rm -f "$_tmp_fixture"

# PAIRED NEGATIVE for the CASELESS shape (the population the scanner used to exclude). The
# function name is printed from an argument so the literal stub opener never appears in this
# file's own source — same reason the catch-all arm above is passed as `'*)'`.
_tmp_fixture_caseless=$(mktemp)
{
  printf '%s() {\n' curl
  printf '  printf "STUB-DEFAULT"; return 0\n'
  printf '}\n'
} > "$_tmp_fixture_caseless"
if [ -n "$(_scan_failopen_catchalls "$_tmp_fixture_caseless")" ]; then
  ok "meta §7e.6 paired-negative: the scanner flags a CASELESS fail-open stub (widened population)"
else
  bad "meta §7e.6 paired-negative: scanner passed a caseless fail-open stub — the widening is vacuous"
fi
# Same shape as a one-liner, which is how the real one was written.
_tmp_fixture_oneline=$(mktemp)
printf '%s() { printf "STUB-DEFAULT"; return 0; }\n' curl > "$_tmp_fixture_oneline"
if [ -n "$(_scan_failopen_catchalls "$_tmp_fixture_oneline")" ]; then
  ok "meta §7e.6 paired-negative: the scanner flags a one-line caseless fail-open stub"
else
  bad "meta §7e.6 paired-negative: scanner passed a one-line caseless fail-open stub"
fi
# PAIRED POSITIVE — the widened rule must not be reject-all: a caseless stub that returns
# non-zero IS fail-closed and must stay unflagged. Without this, the two negatives above would
# also be satisfied by a scanner that flags every stub it sees.
_tmp_fixture_closed=$(mktemp)
printf '%s() { return 1; }\n' curl > "$_tmp_fixture_closed"
if [ -z "$(_scan_failopen_catchalls "$_tmp_fixture_closed")" ]; then
  ok "meta §7e.6 paired-positive: a caseless stub returning non-zero is NOT flagged (not reject-all)"
else
  bad "meta §7e.6 paired-positive: scanner flagged a fail-CLOSED caseless stub (over-tight)"
fi
# One-line CASE-BASED stub — the shape the sibling suite `bridge-guided.test.sh` uses throughout.
# Graded in both directions so the sweep of that file is backed rather than assumed.
_tmp_fixture_1lcase_open=$(mktemp)
printf '%s() { case "$*" in *"/health"*) return 0 ;; %s return 0 ;; esac; }\n' curl '*)' > "$_tmp_fixture_1lcase_open"
if [ -n "$(_scan_failopen_catchalls "$_tmp_fixture_1lcase_open")" ]; then
  ok "meta §7e.6 paired-negative: the scanner flags a one-line case stub with a fail-open catch-all"
else
  bad "meta §7e.6 paired-negative: scanner passed a one-line case stub whose catch-all returns 0"
fi
_tmp_fixture_1lcase_closed=$(mktemp)
printf '%s() { case "$*" in *"/health"*) return 0 ;; %s return 1 ;; esac; }\n' curl '*)' > "$_tmp_fixture_1lcase_closed"
if [ -z "$(_scan_failopen_catchalls "$_tmp_fixture_1lcase_closed")" ]; then
  ok "meta §7e.6 paired-positive: a one-line case stub with a fail-closed catch-all is NOT flagged"
else
  bad "meta §7e.6 paired-positive: scanner flagged a fail-CLOSED one-line case stub (over-tight)"
fi
rm -f "$_tmp_fixture_caseless" "$_tmp_fixture_oneline" "$_tmp_fixture_closed" \
      "$_tmp_fixture_1lcase_open" "$_tmp_fixture_1lcase_closed"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
