#!/usr/bin/env bash
# Paired-negative for scripts/dot-review-gate/gatectl.mjs (round-2 validate-only packet item).
#
# The packet requires validate-only startup plus exact start/pause/read/recovery
# commands WITHOUT model launches or GitHub mutations during validation. Contract
# pinned here:
#   - `validate` loads the policy fail-closed, digests the schema bytes, opens and
#     migrates the ledger, builds the work queue and reports one JSON summary —
#     with ZERO transport (GitHub) calls and ZERO model launches (spy-asserted);
#   - `start` refuses without --allow-live (the default posture is validate-only);
#   - pause/read/recover are offline ledger+coordination-dir operations;
#   - recover launches no models and performs no network mutations; D2065-S07:
#     recovery honors CURRENT operational authority — no trusted policy ⇒
#     INSPECT-ONLY (zero writes, zero DELIVERED); with --policy the runner's own
#     gate (pause/expiry/quota + per-action ACTIVE registration/scope) runs
#     before ANY re-delivery, and local delivery effects are reported directly.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/dot-gatectl-test.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

run_cli() { node "$DIR/gatectl.mjs" "$@" 2>&1; }

status=0
expect_ok() { if [ "$1" -eq 0 ]; then echo "ok $2"; else echo "FAIL $2: exit=$1"; echo "$3" | tail -5; status=1; fi; }
expect_fail() { if [ "$1" -ne 0 ]; then echo "ok $2"; else echo "FAIL $2: expected nonzero exit"; status=1; fi; }

SCHEMA="$TMP/schema.json"
printf '{"type":"object"}\n' > "$SCHEMA"
POLICY="$TMP/policy.json"
node -e '
const fs = require("fs");
import(process.argv[1]).then(({ makePolicyFixture }) => {
  const { createHash } = require("node:crypto");
  const digest = createHash("sha256").update(fs.readFileSync(process.argv[2])).digest("hex");
  // D2065-S07 arms need gated recovery to reach the PER-ACTION authority checks,
  // so the fixture carries the full dispatch-limit set (unattended allowed)
  fs.writeFileSync(process.argv[3], JSON.stringify(makePolicyFixture({ schema_sha256: digest, limits: { max_active_claims: 1, max_attempts_per_tuple: 2, claim_lease_minutes: 120, max_launches_per_window: 5, window_minutes: 60, max_fix_rounds_per_occurrence: 2, max_work_per_pr: 4, coalesce_minutes: 10 } })));
});
' "$(cd "$DIR/../.." && pwd)/tests/dot-review-gate/fixtures/make-admission.mjs" "$SCHEMA" "$POLICY"
LEDGER="$TMP/gate.sqlite"

# RED: the CLI is what this suite pins — module absence IS the RED.

# validate green path: exit 0, one JSON summary with digests + counts, no spies hit
SPY_OUT="$TMP/spy.json"
out="$(DOT_GATE_SPY_OUT="$SPY_OUT" run_cli validate --policy "$POLICY" --schema "$SCHEMA" --ledger "$LEDGER")"; rc=$?
expect_ok "$rc" validate-green-exit0 "$out"
echo "$out" | grep -q '"ok": *true' || { echo "FAIL validate-summary-not-ok"; status=1; }
echo "$out" | grep -q 'policy_sha256' || { echo "FAIL validate-missing-policy-digest"; status=1; }
node -e '
const s = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
if (s.transport_calls !== 0 || s.model_calls !== 0) process.exit(1);
' "$SPY_OUT" && echo "ok validate-zero-transport-zero-model" || { echo "FAIL spies were hit during validate"; status=1; }

# validate fails closed on an unparsable policy
BAD="$TMP/bad.yaml"; printf '{{{{ not json\n' > "$BAD"
out="$(run_cli validate --policy "$BAD" --schema "$SCHEMA" --ledger "$TMP/bad.sqlite")"; rc=$?
expect_fail "$rc" validate-bad-policy-fails-closed
echo "$out" | grep -q 'E_' || { echo "FAIL validate-bad-policy-no-error-code"; status=1; }

# validate fails closed on a schema-pin mismatch (policy pins different bytes)
MISMATCH="$TMP/mismatch.json"
node -e '
const fs = require("fs");
import(process.argv[1]).then(({ makePolicyFixture }) => {
  fs.writeFileSync(process.argv[2], JSON.stringify(makePolicyFixture({ schema_sha256: "9".repeat(64) })));
});
' "$(cd "$DIR/../.." && pwd)/tests/dot-review-gate/fixtures/make-admission.mjs" "$MISMATCH"
out="$(run_cli validate --policy "$MISMATCH" --schema "$SCHEMA" --ledger "$TMP/m.sqlite")"; rc=$?
expect_fail "$rc" validate-schema-pin-mismatch-fails-closed
echo "$out" | grep -q 'E_SCHEMA_PIN' || { echo "FAIL pin-mismatch-no-code"; status=1; }

# ── SP-3: --schema-v2 is PINNED, not just parsed — a V2-era policy carries
# schema_v2_sha256, the provided V2 bytes must digest to it, permissive bytes
# refuse, and a V2-era policy without any V2 bytes refuses outright.
V2SCHEMA="$(cd "$DIR/../.." && pwd)/docs/meta-factory/dot-review-result-v2.schema.json"
PERMISSIVE_V2="$TMP/v2-permissive.json"; printf '{"type":"object"}\n' > "$PERMISSIVE_V2"
V2PIN_POLICY="$TMP/v2pin-policy.json"
node -e '
const fs = require("fs");
import(process.argv[1]).then(({ makePolicyFixture }) => {
  const { createHash } = require("node:crypto");
  const d1 = createHash("sha256").update(fs.readFileSync(process.argv[2])).digest("hex");
  const d2 = createHash("sha256").update(fs.readFileSync(process.argv[3])).digest("hex");
  fs.writeFileSync(process.argv[4], JSON.stringify(makePolicyFixture({ schema_sha256: d1, schema_v2_sha256: d2, protocol_version: "dot-pr-review/2.0.0" })));
});
' "$(cd "$DIR/../.." && pwd)/tests/dot-review-gate/fixtures/make-admission.mjs" "$SCHEMA" "$V2SCHEMA" "$V2PIN_POLICY"
out="$(run_cli validate --policy "$V2PIN_POLICY" --schema "$SCHEMA" --schema-v2 "$PERMISSIVE_V2" --ledger "$TMP/v2m.sqlite")"; rc=$?
expect_fail "$rc" validate-v2-pin-mismatch-fails-closed
echo "$out" | grep -q 'E_SCHEMA_PIN' || { echo "FAIL v2-pin-mismatch-no-code"; status=1; }
out="$(run_cli validate --policy "$V2PIN_POLICY" --schema "$SCHEMA" --ledger "$TMP/v2n.sqlite")"; rc=$?
expect_fail "$rc" validate-v2-era-without-v2-bytes-refused
echo "$out" | grep -q 'E_SCHEMA_PIN' || { echo "FAIL v2-era-missing-bytes-no-code"; status=1; }
out="$(run_cli validate --policy "$V2PIN_POLICY" --schema "$SCHEMA" --schema-v2 "$V2SCHEMA" --ledger "$TMP/v2g.sqlite")"; rc=$?
expect_ok "$rc" validate-v2-pin-canonical-passes "$out"
echo "$out" | grep -q '"schema_v2_sha256"' || { echo "FAIL v2-pin-digest-not-reported"; status=1; }

# start refuses without --allow-live (default posture is validate-only)
out="$(run_cli start --policy "$POLICY" --ledger "$TMP/s.sqlite")"; rc=$?
expect_fail "$rc" start-refuses-without-allow-live
echo "$out" | grep -q 'E_VALIDATE_ONLY' || { echo "FAIL start-missing-E_VALIDATE_ONLY"; status=1; }

# the packet: distinguish missing enrollment from a runner that does not exist —
# a named runner path that is absent on disk is E_NO_RUNNER, not a generic
# unenrolled refusal
out="$(run_cli start --allow-live --runner "$TMP/does-not-exist.mjs" --policy "$POLICY" --ledger "$TMP/nr.sqlite")"; rc=$?
expect_fail "$rc" start-runner-missing-is-not-unenrolled
echo "$out" | grep -q 'E_NO_RUNNER' || { echo "FAIL start-no-runner-code"; status=1; }

# cold-review arm: even WITH --allow-live, live start stays unenrolled — the
# E_LIVE_UNENROLLED fallback is load-bearing (validate-only posture), pin it
out="$(run_cli start --allow-live --policy "$POLICY" --ledger "$TMP/lv.sqlite")"; rc=$?
expect_fail "$rc" start-allow-live-still-unenrolled
echo "$out" | grep -q 'E_LIVE_UNENROLLED' || { echo "FAIL allow-live-no-code"; status=1; }

# pause then read: offline, state visible
out="$(run_cli pause --ledger "$LEDGER")"; rc=$?
expect_ok "$rc" pause-offline "$out"
out="$(run_cli read --ledger "$LEDGER")"; rc=$?
expect_ok "$rc" read-offline "$out"
echo "$out" | grep -q '"paused": *true' || { echo "FAIL read-does-not-show-paused"; status=1; }

# recover: offline, reports recovered counts, launches nothing
out="$(DOT_GATE_SPY_OUT="$TMP/spy2.json" run_cli recover --ledger "$LEDGER" --coordination-dir "$TMP/coord")"; rc=$?
expect_ok "$rc" recover-offline "$out"
node -e '
const s = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
if (s.transport_calls !== 0 || s.model_calls !== 0) process.exit(1);
' "$TMP/spy2.json" && echo "ok recover-zero-transport-zero-model" || { echo "FAIL recover hit spies"; status=1; }

# ── SP-5 / ST-1 + D2065-S07: recover reports the TRUE count, restores the
# ORIGINAL bounded payload (not a {recovered:true} stub), and honors CURRENT
# operational authority — the SAME gate the runner composes. Seeds: a stranded
# INTENT (dispatch write failed) plus optional registration state.
RECOVER_REPO=1231007068
seed_intent() { # <ledger sqlite> <coord dir> <pr node> <repo id>
  node -e '
Promise.all([import(process.argv[1]), import(process.argv[2])]).then(async ([{ createCcAdapter }, { openLedger }]) => {
  const ledger = openLedger(process.argv[3]);
  const adapter = createCcAdapter({ ledger, coordinationDir: process.argv[4] + "/missing", notify: async () => {} });
  await adapter.dispatchAction({ kind: "fix-assignment", targetSession: "sess-recover", payload: { repository_id: Number(process.argv[6]), pr_node_id: process.argv[5], instruction: "fix artyhoo/getff#F-9 at rev 9" } }).catch(() => {});
  ledger.close?.();
  process.exit(0);
});
' "$DIR/cc-adapter.mjs" "$DIR/ledger.mjs" "$1" "$2" "$3" "$4"
}
seed_registration() { # <ledger sqlite> <pr node> <number> <ACTIVE|RELEASED>
  node -e '
import(process.argv[2]).then(({ openLedger }) => {
  const ledger = openLedger(process.argv[1]);
  ledger.insertRegistration({ prNodeId: process.argv[3], prNumber: Number(process.argv[4]), coordinator: "coordinator/test", reconciledAt: "2026-10-06T12:00:00Z" });
  if (process.argv[5] === "RELEASED") ledger.updateRegistration(process.argv[3], { state: "RELEASED", operatorTransition: "operator released the managed PR" });
  ledger.close?.();
  process.exit(0);
});
' "$1" "$DIR/ledger.mjs" "$2" "$3" "$4"
}
count_msgs() { ls -1 "$1"/_dot-gate-msg-*.md 2>/dev/null | wc -l | tr -d ' '; }
intents_left() { node -e '
import(process.argv[2]).then(({ openLedger }) => {
  const l = openLedger(process.argv[1]);
  const n = l.coordList("INTENT").length;
  l.close?.();
  process.exit(n === Number(process.argv[3]) ? 0 : 1);
});
' "$1" "$DIR/ledger.mjs" "$2"; }

# no trusted policy ⇒ INSPECT-ONLY: pending visible, ZERO writes, ZERO DELIVERED
S7A="$TMP/s7a"; mkdir -p "$S7A"
seed_intent "$S7A/l.sqlite" "$S7A" "PR_s7a" "$RECOVER_REPO"
out="$(run_cli recover --ledger "$S7A/l.sqlite" --coordination-dir "$S7A")"; rc=$?
expect_ok "$rc" recover-no-policy-inspect-only "$out"
echo "$out" | grep -q '"mode": *"inspect"' || { echo "FAIL inspect-mode-not-reported"; status=1; }
echo "$out" | grep -q 'E_NO_TRUSTED_CONFIG' || { echo "FAIL inspect-hold-code-missing"; status=1; }
echo "$out" | grep -q '"recovered_deliveries": *0' || { echo "FAIL inspect-delivered-something"; status=1; }
[ "$(count_msgs "$S7A")" -eq 0 ] || { echo "FAIL inspect-wrote-message-file"; status=1; }
intents_left "$S7A/l.sqlite" 1 && echo "ok recover-inspect-preserves-intent" || { echo "FAIL inspect-marked-something-delivered"; status=1; }

# paused + trusted policy ⇒ hold E_PAUSED, zero writes, intent preserved
S7B="$TMP/s7b"; mkdir -p "$S7B"
seed_intent "$S7B/l.sqlite" "$S7B" "PR_s7b" "$RECOVER_REPO"
seed_registration "$S7B/l.sqlite" "PR_s7b" 2077 ACTIVE
run_cli pause --ledger "$S7B/l.sqlite" >/dev/null
out="$(run_cli recover --ledger "$S7B/l.sqlite" --coordination-dir "$S7B" --policy "$POLICY")"; rc=$?
expect_ok "$rc" recover-paused-holds "$out"
echo "$out" | grep -q 'E_PAUSED' || { echo "FAIL paused-hold-code-missing"; status=1; }
[ "$(count_msgs "$S7B")" -eq 0 ] || { echo "FAIL paused-wrote-message-file"; status=1; }
intents_left "$S7B/l.sqlite" 1 && echo "ok recover-paused-preserves-intent" || { echo "FAIL paused-marked-delivered"; status=1; }

# expired trusted policy ⇒ refused at load, fail-closed, zero writes
EXPPOLICY="$TMP/expired-policy.json"
node -e '
const fs = require("fs");
import(process.argv[1]).then(({ makePolicyFixture }) => {
  fs.writeFileSync(process.argv[2], JSON.stringify(makePolicyFixture({ authorization_expiry: "2020-01-01T00:00:00Z" })));
});
' "$(cd "$DIR/../.." && pwd)/tests/dot-review-gate/fixtures/make-admission.mjs" "$EXPPOLICY"
S7C="$TMP/s7c"; mkdir -p "$S7C"
seed_intent "$S7C/l.sqlite" "$S7C" "PR_s7c" "$RECOVER_REPO"
seed_registration "$S7C/l.sqlite" "PR_s7c" 2078 ACTIVE
out="$(run_cli recover --ledger "$S7C/l.sqlite" --coordination-dir "$S7C" --policy "$EXPPOLICY")"; rc=$?
expect_fail "$rc" recover-expired-authorization-refused "$out"
echo "$out" | grep -q 'E_EXPIRY' || { echo "FAIL expiry-code-missing"; status=1; }
[ "$(count_msgs "$S7C")" -eq 0 ] || { echo "FAIL expired-wrote-message-file"; status=1; }

# per-action CURRENT authority — no registration ⇒ held, intent preserved
S7D="$TMP/s7d"; mkdir -p "$S7D"
seed_intent "$S7D/l.sqlite" "$S7D" "PR_s7d" "$RECOVER_REPO"
out="$(run_cli recover --ledger "$S7D/l.sqlite" --coordination-dir "$S7D" --policy "$POLICY")"; rc=$?
expect_ok "$rc" recover-unregistered-holds "$out"
echo "$out" | grep -q 'E_UNREGISTERED' || { echo "FAIL unregistered-hold-code-missing"; status=1; }
echo "$out" | grep -q '"recovered_deliveries": *0' || { echo "FAIL unregistered-delivered"; status=1; }
[ "$(count_msgs "$S7D")" -eq 0 ] || { echo "FAIL unregistered-wrote-message-file"; status=1; }
intents_left "$S7D/l.sqlite" 1 && echo "ok recover-unregistered-preserves-intent" || { echo "FAIL unregistered-marked-delivered"; status=1; }

# RELEASED registration ⇒ held (a persisted action grants no permanent permission)
S7E="$TMP/s7e"; mkdir -p "$S7E"
seed_intent "$S7E/l.sqlite" "$S7E" "PR_s7e" "$RECOVER_REPO"
seed_registration "$S7E/l.sqlite" "PR_s7e" 2079 RELEASED
out="$(run_cli recover --ledger "$S7E/l.sqlite" --coordination-dir "$S7E" --policy "$POLICY")"; rc=$?
expect_ok "$rc" recover-released-holds "$out"
echo "$out" | grep -q 'E_UNREGISTERED' || { echo "FAIL released-hold-code-missing"; status=1; }
[ "$(count_msgs "$S7E")" -eq 0 ] || { echo "FAIL released-wrote-message-file"; status=1; }

# ACTIVE registration but FOREIGN repository scope ⇒ held
S7F="$TMP/s7f"; mkdir -p "$S7F"
seed_intent "$S7F/l.sqlite" "$S7F" "PR_s7f" 999
seed_registration "$S7F/l.sqlite" "PR_s7f" 2080 ACTIVE
out="$(run_cli recover --ledger "$S7F/l.sqlite" --coordination-dir "$S7F" --policy "$POLICY")"; rc=$?
expect_ok "$rc" recover-foreign-scope-holds "$out"
echo "$out" | grep -q 'E_UNREGISTERED' || { echo "FAIL foreign-hold-code-missing"; status=1; }
[ "$(count_msgs "$S7F")" -eq 0 ] || { echo "FAIL foreign-wrote-message-file"; status=1; }

# authorized positive: ORIGINAL payload delivered exactly once, local effects counted
S7G="$TMP/s7g"; mkdir -p "$S7G"
seed_intent "$S7G/l.sqlite" "$S7G" "PR_s7g" "$RECOVER_REPO"
seed_registration "$S7G/l.sqlite" "PR_s7g" 2081 ACTIVE
out="$(run_cli recover --ledger "$S7G/l.sqlite" --coordination-dir "$S7G" --policy "$POLICY")"; rc=$?
expect_ok "$rc" recover-authorized-delivers "$out"
echo "$out" | grep -q '"recovered_deliveries": *1' || { echo "FAIL recover-count-wrapper"; status=1; }
echo "$out" | grep -q '"local_message_writes": *1' || { echo "FAIL local-writes-not-reported"; status=1; }
grep -q 'fix artyhoo/getff#F-9 at rev 9' "$S7G"/_dot-gate-msg-*.md || { echo "FAIL recover-lost-payload"; status=1; }
[ "$(count_msgs "$S7G")" -eq 1 ] && echo "ok recover-restores-original-payload" || { echo "FAIL recover-wrong-file-count"; status=1; }
out2="$(run_cli recover --ledger "$S7G/l.sqlite" --coordination-dir "$S7G" --policy "$POLICY")"; rc2=$?
expect_ok "$rc2" recover-repeat-idempotent "$out2"
echo "$out2" | grep -q '"recovered_deliveries": *0' || { echo "FAIL repeat-redelivered"; status=1; }
echo "$out2" | grep -q '"local_message_writes": *0' || { echo "FAIL repeat-wrote-again"; status=1; }

# mid-recovery state change: the FIRST action delivers, the SECOND structurally holds
S7H="$TMP/s7h"; mkdir -p "$S7H"
seed_intent "$S7H/l.sqlite" "$S7H" "PR_s7h1" "$RECOVER_REPO"
seed_registration "$S7H/l.sqlite" "PR_s7h1" 2082 ACTIVE
seed_intent "$S7H/l.sqlite" "$S7H" "PR_s7h2" "$RECOVER_REPO"
out="$(run_cli recover --ledger "$S7H/l.sqlite" --coordination-dir "$S7H" --policy "$POLICY")"; rc=$?
expect_ok "$rc" recover-mid-recovery-partial "$out"
echo "$out" | grep -q '"recovered_deliveries": *1' || { echo "FAIL mid-recovery-count"; status=1; }
echo "$out" | grep -q 'E_UNREGISTERED' || { echo "FAIL mid-recovery-second-not-held"; status=1; }
intents_left "$S7H/l.sqlite" 1 && echo "ok recover-mid-recovery-holds-next-action" || { echo "FAIL mid-recovery-second-marked-delivered"; status=1; }

[ "$status" -eq 0 ] && echo "gatectl.test.sh: all green" || { echo "gatectl.test.sh: FAILURES"; exit 1; }
