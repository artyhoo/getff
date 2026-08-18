#!/usr/bin/env bash
# pre-merge-local-delivery.test.sh — the carrier + probe DELIVER to consumers (F1 arm).
#
# B1 acceptance for the delivery channel (kickoff §2 B1 row, F1 ratified: ALL
# profiles, core included — the delivery is NOT profile-gated):
#   delivery-core    — a `--profile core` ts-server consumer receives BOTH
#                      scripts/pre-merge-local.sh and scripts/ci-available-probe.sh,
#                      executable, byte-identical to the framework source.
#   refresh-updates  — a brownfield consumer's stale carrier copy IS refreshed by
#                      `install.sh --refresh` (the §c intent: not stranded on v1),
#                      with the paired-negative proving the assertion can fail.
#
# W-3 boundary (asserted here so drift surfaces): delivery is file-landing ONLY —
# the install must NOT wire the carrier into husky/validate/CI. A grep proves the
# consumer's package.json "validate" does not name the carrier and .husky/ has no
# new hook referencing it.
#
# Harness shape mirrors consumer-upgrade-path.test.sh (mktemp → git init →
# install → mutation → re-run refresh → assertion, with paired-negative arms).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

make_consumer_profile() {
  local T prof="$1"
  T=$(mktemp -d)
  printf '{ "name":"consumer","version":"0.0.0" }\n' > "$T/package.json"
  # < /dev/null: prompts take the declining EOF path (consumer-upgrade-path precedent)
  ( cd "$T" && git init -q && npm_config_cache="$T/.npm-cache" \
      bash "$REPO_ROOT/install.sh" ts-server --profile "$prof" < /dev/null ) >/dev/null 2>&1
  echo "$T"
}

echo "== delivery: --profile core (F1 — core consumers receive the carrier too) =="
TC=$(make_consumer_profile core)

for f in pre-merge-local ci-available-probe; do
  DST="$TC/scripts/$f.sh"
  if [ -f "$DST" ]; then
    ok "core profile: scripts/$f.sh delivered"
  else
    bad "core profile: scripts/$f.sh MISSING (F1 violation — delivery must not be profile-gated)"
    continue
  fi
  [ -x "$DST" ] && ok "scripts/$f.sh is executable" || bad "scripts/$f.sh not executable"
  SRC="$REPO_ROOT/packages/core/audit-self/$f.sh"
  if cmp -s "$SRC" "$DST"; then
    ok "scripts/$f.sh byte-identical to the framework source"
  else
    bad "scripts/$f.sh differs from the framework source"
  fi
done

# W-3: delivery = file-landing only. No invocation wiring may ride along.
if grep -q "pre-merge-local" "$TC/package.json" 2>/dev/null; then
  bad "W-3 VIOLATION: carrier referenced from the consumer's package.json scripts"
else
  ok "W-3: consumer package.json does not wire the carrier (opt-in, not default-on)"
fi
if [ -d "$TC/.husky" ] && grep -rq "pre-merge-local\|ci-available-probe" "$TC/.husky" 2>/dev/null; then
  bad "W-3 VIOLATION: carrier wired into a husky hook"
else
  ok "W-3: no husky hook invokes the carrier"
fi

echo "== refresh: a stale brownfield carrier copy is updated (not stranded on v1) =="
STALE_MARKER="STALE_CARRIER_CONTENT_INJECTED_BY_TEST"
printf '#!/usr/bin/env bash\n%s\n' "$STALE_MARKER" > "$TC/scripts/pre-merge-local.sh"

if grep -q "$STALE_MARKER" "$TC/scripts/pre-merge-local.sh"; then
  ok "paired-negative control: stale content confirmed planted pre-refresh"
else
  bad "stale plant failed — refresh test below is vacuous"
fi

( cd "$TC" && npm_config_cache="$TC/.npm-cache" bash "$REPO_ROOT/install.sh" --refresh < /dev/null ) >/dev/null 2>&1

if grep -q "$STALE_MARKER" "$TC/scripts/pre-merge-local.sh"; then
  bad "--refresh did NOT update the stale carrier copy (brownfield stranded on v1)"
else
  ok "--refresh updated the stale carrier copy"
fi
if cmp -s "$REPO_ROOT/packages/core/audit-self/pre-merge-local.sh" "$TC/scripts/pre-merge-local.sh"; then
  ok "refreshed carrier is byte-identical to the framework source"
else
  bad "refreshed carrier differs from the framework source"
fi
if cmp -s "$REPO_ROOT/packages/core/audit-self/ci-available-probe.sh" "$TC/scripts/ci-available-probe.sh"; then
  ok "probe also refreshed byte-identical"
else
  bad "probe not refreshed to the framework source"
fi

rm -rf "$TC"

echo ""
echo "Result: $PASS pass / $FAIL fail"
[ "$FAIL" -eq 0 ]
