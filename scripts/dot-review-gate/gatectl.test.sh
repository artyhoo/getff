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
#   - recover launches no models and performs no network mutations.
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
  fs.writeFileSync(process.argv[3], JSON.stringify(makePolicyFixture({ schema_sha256: digest })));
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

# start refuses without --allow-live (default posture is validate-only)
out="$(run_cli start --policy "$POLICY" --ledger "$TMP/s.sqlite")"; rc=$?
expect_fail "$rc" start-refuses-without-allow-live
echo "$out" | grep -q 'E_VALIDATE_ONLY' || { echo "FAIL start-missing-E_VALIDATE_ONLY"; status=1; }

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

[ "$status" -eq 0 ] && echo "gatectl.test.sh: all green" || { echo "gatectl.test.sh: FAILURES"; exit 1; }
