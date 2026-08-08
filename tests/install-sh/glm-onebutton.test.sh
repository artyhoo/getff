#!/usr/bin/env bash
# tests/install-sh/glm-onebutton.test.sh — test suite for scripts/getff-glm-onebutton.sh
# beta-delivery-ux S4 §4 acceptance.
#
# Pattern: BDD-style shell, mirrors tests/install-sh/bridge-guided.test.sh.
# Mocks curl via export -f to simulate aif REST responses.
#
# Test cases (kickoff §7c binding + plan Task 3):
#   1. detect-existing-profile    — idempotent exit 0; no POST issued
#   2. detect-no-profile-success  — empty list → full flow succeeds (exit 0)
#   3. key-never-touched          — grep helper source for §4 item 2 invariant (load-bearing)
#   4. reachability-miss-path     — AIF_REACHABILITY_CMD fails → MISS exit non-zero (§7b #3)
#   5. validation-ping-profile    — ping URL is profile-scoped, NOT vendor URL (§7c #3)
#   6. decline-degradation        — POST create fails → MISS with blocker, not "graceful" (§4 item 5)
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

HELPER="$REPO_ROOT/scripts/getff-glm-onebutton.sh"
[ -f "$HELPER" ] || { echo "FATAL: helper not found at $HELPER"; exit 2; }

TEST_TMP=$(mktemp -d)
trap 'rm -rf "$TEST_TMP"' EXIT
PING_CALL_FILE="$TEST_TMP/ping_call"
export TEST_TMP PING_CALL_FILE

# Per-case setup: clean HOME with cfg/getff/glm.env + a deploy dir with a compose file.
reset_env() {
  rm -rf "$TEST_TMP"
  mkdir -p "$TEST_TMP/cfg/getff" "$TEST_TMP/deploy"
  printf 'ANTHROPIC_AUTH_TOKEN=fake-key-not-real\n' > "$TEST_TMP/cfg/getff/glm.env"
  touch "$TEST_TMP/deploy/docker-compose.yml"
  rm -f "$PING_CALL_FILE"
}

# Common env vars exported for the helper subprocess.
export GLM_BASE_URL="https://api.z.ai/api/anthropic"
export GLM_MODEL="glm-5.2"
export GLM_PROFILE_NAME="GLM (z.ai Anthropic-shape)"
export RUNTIME_BRIDGE_AIF_URL="http://aif-mock:3009"
export LOG_LEVEL="WARN"  # quiet output for compact test logs

# ─── Case 1: detect-existing-profile (idempotent) ─────────────────────────────
reset_env
curl() {
  local args="$*"
  # Only one call expected: GET /runtime-profiles returning one matching profile.
  if [[ "$args" == *"-X GET"*"/runtime-profiles" ]]; then
    printf '[{"id":"glm-existing-1","name":"%s","baseUrl":"%s"}]' "$GLM_PROFILE_NAME" "$GLM_BASE_URL" > /tmp/glm-onebutton.res
    printf '200'
  else
    printf '404'
  fi
}
export -f curl
out=$(env XDG_CONFIG_HOME="$TEST_TMP/cfg" HOME="$TEST_TMP" \
       AIF_DEPLOY_DIR="$TEST_TMP/deploy" \
       AIF_REACHABILITY_CMD="true" \
       bash "$HELPER" </dev/null 2>&1); rc=$?
[ "$rc" -eq 0 ] && ok "case 1: idempotent exit 0 when profile exists" || bad "case 1: rc=$rc (expected 0): $out"
case "$out" in
  *"id=glm-existing-1"*already*) ok "case 1: output mentions existing profile id" ;;
  *) bad "case 1: output missing idempotent marker: $out" ;;
esac
case "$out" in
  *POST*) bad "case 1: helper issued POST despite existing profile" ;;
  *) ok "case 1: no POST issued (idempotent)" ;;
esac

# ─── Case 2: detect-no-profile → full flow success ────────────────────────────
reset_env
curl() {
  local args="$*"
  case "$args" in
    # Order: more-specific ping before generic create.
    *"-X POST"*/runtime-profiles/*v1/messages*)
      printf '%s\n' "$args" > "$PING_CALL_FILE"
      printf '{"content":[{"text":"ok"}]}' > /tmp/glm-onebutton.res
      printf '200'
      ;;
    *"-X POST"*/runtime-profiles*)
      printf '{"id":"new-glm-1","name":"%s"}' "$GLM_PROFILE_NAME" > /tmp/glm-onebutton.res
      printf '201'
      ;;
    *"-X GET"*/runtime-profiles)
      printf '[]' > /tmp/glm-onebutton.res
      printf '200'
      ;;
    *"-X GET"*/projects)
      printf '[{"id":"proj-1","name":"p","plannerMaxBudgetUsd":1,"planCheckerMaxBudgetUsd":1,"implementerMaxBudgetUsd":1,"reviewSidecarMaxBudgetUsd":1}]' > /tmp/glm-onebutton.res
      printf '200'
      ;;
    *"-X PUT"*/projects/*)
      printf '{"id":"proj-1"}' > /tmp/glm-onebutton.res
      printf '200'
      ;;
    *)
      printf '404'
      ;;
  esac
}
export -f curl
out=$(env XDG_CONFIG_HOME="$TEST_TMP/cfg" HOME="$TEST_TMP" \
       AIF_DEPLOY_DIR="$TEST_TMP/deploy" \
       AIF_PROJECT_ID="proj-1" \
       TOP_TIER_PROFILE_ID="tier-top-1" \
       AIF_REACHABILITY_CMD="true" \
       TEST_TMP="$TEST_TMP" \
       bash "$HELPER" </dev/null 2>&1); rc=$?
[ "$rc" -eq 0 ] && ok "case 2: full flow succeeds (exit 0)" || bad "case 2: rc=$rc (expected 0): $out"
case "$out" in
  *done*new-glm-1*) ok "case 2: output reports profile id (new-glm-1)" ;;
  *) bad "case 2: output missing done+id marker: $out" ;;
esac
case "$out" in
  *tier-top-1*new-glm-1*new-glm-1*) ok "case 2: output shows Plan=TOP, Task=GLM, Review=GLM" ;;
  *) bad "case 2: per-mode defaults summary missing/incorrect: $out" ;;
esac

# ─── Case 3: key-never-touched-invariant (§4 item 2 — load-bearing) ──────────
# Grep the helper source: the key VALUE never appears because the literal
# `ANTHROPIC_AUTH_TOKEN` appears only as (a) comment, (b) the assignment to
# KEY_ENV_VAR_NAME, (c) inside string-expanded comments documenting the invariant.
# Asserts:
#   (a) NO non-comment line dereferences `${ANTHROPIC_AUTH_TOKEN...}` — the value
#       would have to be read into a shell variable, which the script never does.
#   (b) The script never `source`s the glm.env file into its own shell.
#   (c) No `eval` of any $-expansion of the key var.
non_comment_deref=$(grep -nE '\$\{?ANTHROPIC_AUTH_TOKEN' "$HELPER" | grep -vE '^[0-9]+:#' || true)
if [ -z "$non_comment_deref" ]; then
  ok "case 3: no non-comment \${ANTHROPIC_AUTH_TOKEN...} dereference in helper source"
else
  bad "case 3: KEY VALUE dereferenced in non-comment code: $non_comment_deref"
fi

if grep -nE '(^|[^.])\s*source\s+.*glm\.env|^\s*\.\s+.*glm\.env' "$HELPER" >/dev/null 2>&1; then
  bad "case 3: helper sources glm.env into its own shell (violates invariant)"
else
  ok "case 3: helper never sources glm.env (key value never enters helper shell)"
fi

# The literal token `ANTHROPIC_AUTH_TOKEN` should appear only in comments + the
# single KEY_ENV_VAR_NAME assignment line. Anything else means the value/name is
# used in a way not anticipated by the invariant.
literal_uses=$(grep -nE 'ANTHROPIC_AUTH_TOKEN' "$HELPER" | grep -vE '^[0-9]+:#' || true)
literal_count=$(printf '%s\n' "$literal_uses" | grep -cE '.' || true)
# Expected: exactly 1 non-comment line (the KEY_ENV_VAR_NAME="ANTHROPIC_AUTH_TOKEN" assignment).
if [ "$literal_count" -eq 1 ]; then
  case "$literal_uses" in
    *KEY_ENV_VAR_NAME=*ANTHROPIC_AUTH_TOKEN\"*) ok "case 3: literal token used only in KEY_ENV_VAR_NAME assignment" ;;
    *) bad "case 3: literal token in unexpected non-comment line: $literal_uses" ;;
  esac
else
  bad "case 3: expected 1 non-comment literal use, got $literal_count: $literal_uses"
fi

# ─── Case 4: reachability-miss-path (§7b #3 — MISS, never silent warning) ─────
reset_env
curl() {
  local args="$*"
  if [[ "$args" == *"-X GET"*/runtime-profiles ]]; then
    printf '[]' > /tmp/glm-onebutton.res
    printf '200'
  else
    printf '404'
  fi
}
export -f curl
# AIF_REACHABILITY_CMD=false → reachability probe exits non-zero → §7b #3 MISS.
out=$(env XDG_CONFIG_HOME="$TEST_TMP/cfg" HOME="$TEST_TMP" \
       AIF_DEPLOY_DIR="$TEST_TMP/deploy" \
       AIF_REACHABILITY_CMD="false" \
       bash "$HELPER" </dev/null 2>&1); rc=$?
[ "$rc" -ne 0 ] && ok "case 4: reachability-miss exits non-zero (rc=$rc)" || bad "case 4: reachability-miss rc=0 (expected non-zero): $out"
case "$out" in
  *"objective-3 MISS"*"NOT reachable"*) ok "case 4: output flags reachability as objective-3 MISS" ;;
  *) bad "case 4: output missing MISS+reachability marker: $out" ;;
esac
case "$out" in
  *degraded*gracefully*) bad "case 4: output says 'degraded gracefully' (forbidden by §4 item 5)" ;;
  *) ok "case 4: no 'degraded gracefully' language (honest MISS)" ;;
esac

# ─── Case 5: validation-ping-targets-profile (§7c #3 — profile-scoped, not vendor) ──
reset_env
curl() {
  local args="$*"
  case "$args" in
    *"-X POST"*/runtime-profiles/*v1/messages*)
      printf '%s\n' "$args" > "$PING_CALL_FILE"
      printf '{"content":[{"text":"ok"}]}' > /tmp/glm-onebutton.res
      printf '200'
      ;;
    *"-X POST"*/runtime-profiles*)
      printf '{"id":"new-glm-1","name":"%s"}' "$GLM_PROFILE_NAME" > /tmp/glm-onebutton.res
      printf '201'
      ;;
    *"-X GET"*/runtime-profiles)
      printf '[]' > /tmp/glm-onebutton.res
      printf '200'
      ;;
    *"-X GET"*/projects)
      printf '[{"id":"proj-1","name":"p","plannerMaxBudgetUsd":1,"planCheckerMaxBudgetUsd":1,"implementerMaxBudgetUsd":1,"reviewSidecarMaxBudgetUsd":1}]' > /tmp/glm-onebutton.res
      printf '200'
      ;;
    *"-X PUT"*/projects/*)
      printf '{"id":"proj-1"}' > /tmp/glm-onebutton.res
      printf '200'
      ;;
    *)
      printf '404'
      ;;
  esac
}
export -f curl
out=$(env XDG_CONFIG_HOME="$TEST_TMP/cfg" HOME="$TEST_TMP" \
       AIF_DEPLOY_DIR="$TEST_TMP/deploy" \
       AIF_PROJECT_ID="proj-1" \
       TOP_TIER_PROFILE_ID="tier-top-1" \
       AIF_REACHABILITY_CMD="true" \
       TEST_TMP="$TEST_TMP" \
       bash "$HELPER" </dev/null 2>&1); rc=$?
PING_CALL=$(cat "$PING_CALL_FILE" 2>/dev/null || echo "")
case "$PING_CALL" in
  */runtime-profiles/new-glm-1/*v1/messages*)
    ok "case 5: ping URL is profile-scoped (/runtime-profiles/new-glm-1/...)" ;;
  *)
    if [ -z "$PING_CALL" ]; then
      bad "case 5: no ping call recorded (helper did not reach step 7?) — out: $out"
    else
      bad "case 5: ping URL not profile-scoped: '$PING_CALL'"
    fi
    ;;
esac
case "$PING_CALL" in
  *api.z.ai*)
    bad "case 5: ping URL hits VENDOR endpoint directly (§7c #3 violation): '$PING_CALL'"
    ;;
  *)
    ok "case 5: ping URL does NOT hit vendor endpoint (api.z.ai) — routed through aif profile"
    ;;
esac
[ "$rc" -eq 0 ] && ok "case 5: full flow exits 0 (ping succeeded)" || bad "case 5: rc=$rc (expected 0): $out"

# ─── Case 6: decline-degradation (§4 item 5 — failure = MISS, not graceful) ───
reset_env
curl() {
  local args="$*"
  case "$args" in
    *"-X GET"*/runtime-profiles)
      printf '[]' > /tmp/glm-onebutton.res
      printf '200'
      ;;
    *"-X POST"*/runtime-profiles*)
      # Simulate profile-create failure (HTTP 500 with a server error body).
      printf '{"error":"internal server error","detail":"db connection refused"}' > /tmp/glm-onebutton.res
      printf '500'
      ;;
    *)
      printf '404'
      ;;
  esac
}
export -f curl
out=$(env XDG_CONFIG_HOME="$TEST_TMP/cfg" HOME="$TEST_TMP" \
       AIF_DEPLOY_DIR="$TEST_TMP/deploy" \
       AIF_REACHABILITY_CMD="true" \
       bash "$HELPER" </dev/null 2>&1); rc=$?
[ "$rc" -ne 0 ] && ok "case 6: profile-create failure exits non-zero (rc=$rc)" || bad "case 6: profile-create failure rc=0 (expected non-zero): $out"
case "$out" in
  *"objective-3 MISS"*"profile"*"creation"*"failed"*) ok "case 6: output flags profile-creation as objective-3 MISS" ;;
  *) bad "case 6: output missing MISS+profile-creation marker: $out" ;;
esac
case "$out" in
  *degraded*gracefully*) bad "case 6: output says 'degraded gracefully' (forbidden)" ;;
  *) ok "case 6: no 'degraded gracefully' language (honest failure)" ;;
esac

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
