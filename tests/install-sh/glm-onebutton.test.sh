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
    # ORDER RULE — validate BEFORE the generic create arm.
    *"-X POST"*"/runtime-profiles/validate"*)
      printf '%s' '{"ok":true,"message":"Claude API profile configured","profile":{"hasApiKey":true}}'
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
curl() { return 0; }  # curl doesn't even fire — preflight catches first
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

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
