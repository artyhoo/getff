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
curl() {
  case "$*" in
    *"-X POST"*"/runtime-profiles"*)
      printf '%s' '{"id":"test-id","name":"Z.AI GLM-5.2"}'
      return 0
      ;;
    *"-X POST"*"/runtime-profiles/validate"*)
      printf '%s' '{"valid":true}'
      return 0
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
    *) return 1 ;;
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

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
