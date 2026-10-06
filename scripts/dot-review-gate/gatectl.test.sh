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

# ── SP-5 / ST-1: recover reports the TRUE count (the wrapper object bug) and
# restores the ORIGINAL bounded payload — not a {recovered:true} stub
SP5LEDGER="$TMP/sp5.sqlite"
SP5DIR="$TMP/sp5-coord"
mkdir -p "$SP5DIR"
node -e '
import(process.argv[1]).then(async ({ createCcAdapter }) => {
  import(process.argv[2]).then(async ({ openLedger }) => {
    const adapter = createCcAdapter({ ledger: openLedger(process.argv[3]), coordinationDir: process.argv[4] + "/missing", notify: async () => {} });
    await adapter.dispatchAction({ kind: "fix-assignment", targetSession: "sess-gatectl", payload: { instruction: "fix artyhoo/getff#F-9 at rev 9" } }).catch(() => {});
    process.exit(0);
  });
});
' "$DIR/cc-adapter.mjs" "$DIR/ledger.mjs" "$SP5LEDGER" "$SP5DIR"
out="$(DOT_GATE_SPY_OUT="$TMP/spy3.json" run_cli recover --ledger "$SP5LEDGER" --coordination-dir "$SP5DIR")"; rc=$?
expect_ok "$rc" recover-sp5 "$out"
echo "$out" | grep -q '"recovered_deliveries": *1' || { echo "FAIL recover-count-wrapper"; status=1; }
grep -q 'fix artyhoo/getff#F-9 at rev 9' "$SP5DIR"/_dot-gate-msg-*.md || { echo "FAIL recover-lost-payload"; status=1; }
[ "$status" -eq 0 ] && echo "ok recover-restores-original-payload" || true

[ "$status" -eq 0 ] && echo "gatectl.test.sh: all green" || { echo "gatectl.test.sh: FAILURES"; exit 1; }
