#!/usr/bin/env bash
# tests/install-sh/refresh-offers-lintstaged-migration.test.sh — getff-honest-signals S5 / B2
#
# Consumer-owned half of the spec: a consumer's `.lintstagedrc.json` that diverged
# from the framework template must trigger a migration OFFER on refresh, and the
# consumer's file MUST be byte-identical post-refresh (load-bearing — T-S5-A).
#
# Ownership asymmetry (T-S5-A, load-bearing): this fixture exercises ONLY the
# consumer-owned offer-only half. The framework-owned reclaim half is covered by
# the sibling refresh-reconciles-skill-rename.test.sh (A2). The two halves get
# deliberately different treatment (kickoff §2).
#
# T-HS-A: every assertion leads with EXIT CODE or FILESYSTEM STATE (md5 byte
# identity), never wording. The offer-text assertion is intentionally LOOSE
# (literal substring "lintstaged") because the offer's exact wording is PARK-P-2
# — a UX fork the spec does not fix (kickoff §4c).
#
# Deterministic, no network: invokes install.sh --refresh against mktemp fixtures.
set -uo pipefail

REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL="$REPO_ROOT/install.sh"
TEMPLATE="$REPO_ROOT/packages/core/templates/shared/.lintstagedrc.json"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

[ -f "$INSTALL" ]  || { echo "FATAL: $INSTALL not found"; exit 1; }
[ -f "$TEMPLATE" ] || { echo "FATAL: $TEMPLATE not found"; exit 1; }

SCRATCH=$(mktemp -d)
trap 'rm -rf "$SCRATCH"' EXIT

run_refresh() {
  local fixture="$1"
  ( cd "$fixture" && bash "$INSTALL" ts-server --refresh ) 2>&1
  echo "EXIT=$?"
}

seed_fixture() {
  local root="$1"
  mkdir -p "$root/.claude/agents" "$root/.claude/hooks" "$root/.claude/skills/getff"
  cat > "$root/package.json" <<'JSON'
{ "name": "fixture-consumer", "version": "0.0.0" }
JSON
  echo "# modern" > "$root/.claude/skills/getff/SKILL.md"
}

md5_of() { md5sum "$1" 2>/dev/null | awk '{print $1}'; }

# ── Arm 1 (pos, load-bearing): stale `.lintstagedrc.json` → offer + byte-identical ─
# This is the load-bearing arm. A test that only greps the offer text would PASS
# even if refresh clobbered the consumer's file; the md5 byte-identity assertion
# is the explicit counter (T-S5-A counter-test, T7/T14 trap counter).
F1="$SCRATCH/arm1"
seed_fixture "$F1"
# A genuinely divergent consumer `.lintstagedrc.json` (prettier-only — the spec
# §8 row 5 / kickoff §1 example shape).
cat > "$F1/.lintstagedrc.json" <<'JSON'
{
  "*.{ts,tsx,js,jsx,mjs,cjs,json,md,yml,yaml}": ["prettier --write"]
}
JSON
before_md5=$(md5_of "$F1/.lintstagedrc.json")

out1=$(run_refresh "$F1"); rc1=$(printf '%s\n' "$out1" | tail -1)
case "$rc1" in
  EXIT=0) ok "arm1: refresh exit 0 (T-HS-A first assertion)" ;;
  *)      bad "arm1: refresh exit non-zero ($rc1); output: $out1" ;;
esac

# LOAD-BEARING (T-S5-A counter): file must be byte-identical post-refresh.
after_md5=$(md5_of "$F1/.lintstagedrc.json")
if [ "$before_md5" = "$after_md5" ] && [ -n "$before_md5" ]; then
  ok "arm1: consumer .lintstagedrc.json byte-identical pre/post refresh (md5=$after_md5) — T-S5-A counter holds"
else
  bad "arm1: consumer .lintstagedrc.json CHANGED — before=$before_md5 after=$after_md5 (refresh mutated consumer-owned file)"
fi

# Offer-text assertion (LOOSE until P-2 resolves): a stdout line mentioning "lintstaged"
# in the offer context. Tightened when P-2 wording lands.
if printf '%s\n' "$out1" | grep -qiE 'differs from framework template|consumer-owned.*never overwritten'; then
  ok "arm1: migration-offer marker present in stdout (loose marker — PARK-P-2 will tighten)"
else
  bad "arm1: no migration-offer marker in stdout (PARK-P-2 placeholder missing?)"
fi

# Teeth: confirm the offer actually fired by checking the diff label specifically.
if printf '%s\n' "$out1" | grep -qF '.lintstagedrc.json differs from framework template'; then
  ok "arm1 (teeth): offer line names the file + the diff (non-vacuous)"
else
  bad "arm1 (teeth): offer line missing the literal 'differs from framework template' marker"
fi

# ── Arm 2 (pos): consumer `.lintstagedrc.json` == template → no offer, byte-identical ─
F2="$SCRATCH/arm2"
seed_fixture "$F2"
cp "$TEMPLATE" "$F2/.lintstagedrc.json"
before_md5_2=$(md5_of "$F2/.lintstagedrc.json")

out2=$(run_refresh "$F2"); rc2=$(printf '%s\n' "$out2" | tail -1)
case "$rc2" in
  EXIT=0) ok "arm2: refresh exit 0 with template-equal consumer file" ;;
  *)      bad "arm2: refresh exit non-zero ($rc2); output: $out2" ;;
esac

after_md5_2=$(md5_of "$F2/.lintstagedrc.json")
if [ "$before_md5_2" = "$after_md5_2" ]; then
  ok "arm2: template-equal consumer file byte-identical pre/post (no false mutation)"
else
  bad "arm2: template-equal consumer file CHANGED — before=$before_md5_2 after=$after_md5_2"
fi

if printf '%s\n' "$out2" | grep -qF 'matches framework template — no offer needed'; then
  ok "arm2: stdout reports 'matches template — no offer needed' (no spurious offer on equal file)"
else
  bad "arm2: stdout missing 'matches template — no offer needed' marker"
fi

# ── Arm 3 (pos): consumer has NO `.lintstagedrc.json` → no-op, no error ─────────
# The consumer may have explicitly chosen not to use lint-staged; refresh must not
# create one (T-S5-A: leaving the file alone, including NOT creating it).
F3="$SCRATCH/arm3"
seed_fixture "$F3"

out3=$(run_refresh "$F3"); rc3=$(printf '%s\n' "$out3" | tail -1)
case "$rc3" in
  EXIT=0) ok "arm3: refresh exit 0 when consumer has no .lintstagedrc.json" ;;
  *)      bad "arm3: refresh exit non-zero ($rc3); output: $out3" ;;
esac

if [ ! -f "$F3/.lintstagedrc.json" ]; then
  ok "arm3: refresh did NOT create .lintstagedrc.json (consumer opted out — respected)"
else
  bad "arm3: refresh CREATED .lintstagedrc.json — T-S5-A violation (consumer-owned)"
fi

# ── Arm 4 (neg / teeth): without B1, no offer line would print → proves non-vacuous ─
# Prove arm1's offer-text assertion is a real discriminator by checking install.sh
# actually contains the offer code. An upstream revert of B1 would flip this RED.
if grep -q 'lintstaged.*reconciliation' "$INSTALL" \
   && grep -q 'differs from framework template' "$INSTALL" \
   && grep -q 'consumer-owned — never overwritten' "$INSTALL"; then
  ok "arm4 (teeth): install.sh carries the offer code (arm1/2 assertions non-vacuous)"
else
  bad "arm4 (teeth): install.sh MISSING the offer code — arm1/arm2 would be vacuously green"
fi

# ── Arm 5 (guardrail): verify no mutation primitives target the consumer file ───
# Static check on install.sh: the lintstaged-reconciliation block must NOT contain
# any cp/mv/rm/>/tee that writes to $_CONSUMER_LINTSTAGED. This is the
# belt-and-braces counter to T-S5-A. (A grep can be fooled by a comment, but a
# code-review audit + this grep together catch the dominant failure mode.)
# Extract just the lintstaged block, drop comments + echo lines, look for writes.
# Regex covers BOTH directions: redirect-after (`$_CONSUMER_LINTSTAGED ... >`)
# AND redirect-before (`> $_CONSUMER_LINTSTAGED ...`) — cold-review finding #2.
block=$(awk '/Stale .lintstagedrc reconciliation/,/^  # ── Claude hooks/' "$INSTALL")
writable=$(printf '%s\n' "$block" \
  | grep -vE '^[[:space:]]*#|^[[:space:]]*echo ' \
  | grep -nE '\$_CONSUMER_LINTSTAGED\b.*[>|]|[>|].*\$_CONSUMER_LINTSTAGED|\bcp\b.*\$_CONSUMER_LINTSTAGED|\bmv\b.*\$_CONSUMER_LINTSTAGED|\brm\b.*\$_CONSUMER_LINTSTAGED|\btee\b.*\$_CONSUMER_LINTSTAGED' || true)
if [ -z "$writable" ]; then
  ok "arm5 (guardrail): lintstaged-reconciliation block has NO mutation primitives targeting \$_CONSUMER_LINTSTAGED (T-S5-A static)"
else
  bad "arm5 (guardrail): lintstaged block CONTAINS a mutation primitive against \$_CONSUMER_LINTSTAGED: $writable"
fi

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
