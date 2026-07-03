#!/usr/bin/env bash
# refresh-regenerates-barrel.test.sh — #876: --refresh must regenerate the eslint-rules-local/
# index.mjs barrel, not just re-deliver individual rule files.
#
# Root cause: eslint-rules-local/index.mjs is GENERATED at install time (generate_eslint_barrel,
# setup.d/lib.sh) from whatever *.ts rule files are on disk. do_refresh() re-delivers the rule
# .ts/.mjs/.d.ts files themselves (install.sh, eslint-rules-local loop) but, before this fix, never
# regenerated the barrel — so a newly-shipped rule (or a barrel that drifted from the on-disk rule
# set for any other reason) landed on disk but stayed UNREGISTERED in the plugin object ESLint
# actually loads. Enforcement of that rule silently went dead on refresh.
#
# Paired-negative shape: arm 2 (teeth) deletes one rule's import + registration line from an
# installed barrel and asserts the rule is now MISSING — proving the pos assertion in arm 4 is a
# real discriminator (a no-op refresh would leave the rule missing forever).
#
# Deterministic, no network: barrel generation is pure bash/awk text (generate_eslint_barrel,
# setup.d/lib.sh) — no eslint/tsx invocation needed to assert file CONTENT. install.sh itself is
# run for real (mktemp target), mirroring tests/install-sh/check-fences-fire-full-barrel.test.sh's
# install_consumer pattern. Graceful skip (rc=0) if install.sh cannot complete in this env.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALL="$REPO_ROOT/install.sh"

PASS=0; FAIL=0; SKIP=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip() { SKIP=$((SKIP+1)); echo "  · $1"; }

[ -f "$INSTALL" ] || { echo "FATAL: $INSTALL not found"; exit 1; }

FIXTURE=$(mktemp -d)
trap 'rm -rf "$FIXTURE"' EXIT

# ── Arm 1: real install into a mktemp target (react-next — has a stack-specific preset rule,
#    no-server-imports-in-client, so the barrel isn't trivially the same across stacks) ──────────
printf '{"name":"refresh-barrel-test","version":"0.0.0"}\n' > "$FIXTURE/package.json"
( cd "$FIXTURE" && git init -q && git config user.email "test@test.com" && git config user.name "Test" ) >/dev/null 2>&1
( cd "$FIXTURE" && bash "$INSTALL" react-next --force < /dev/null ) > "$FIXTURE/.install.log" 2>&1
INSTALL_RC=$?

BARREL="$FIXTURE/eslint-rules-local/index.mjs"
if [ "$INSTALL_RC" -ne 0 ] || [ ! -f "$BARREL" ]; then
  skip "(all arms) install.sh could not complete in this env (rc=$INSTALL_RC, log tail: $(tail -5 "$FIXTURE/.install.log" 2>/dev/null | tr '\n' '|'))"
  echo ""
  echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
  exit 0
fi
ok "(setup) real install produced eslint-rules-local/index.mjs"

# Rule to sabotage: no-server-imports-in-client is a react-next PRESET rule (not a core rule),
# so its presence in the barrel proves the barrel matches THIS stack's on-disk rule set, not just
# the always-shipped core rules.
RULE_TS="$FIXTURE/eslint-rules-local/no-server-imports-in-client.ts"
if [ ! -f "$RULE_TS" ]; then
  bad "(setup) expected react-next preset rule no-server-imports-in-client.ts not found on disk — fixture assumption broke"
  echo ""
  echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
  exit 1
fi

if grep -q "noServerImportsInClient" "$BARREL" && grep -q "'no-server-imports-in-client':" "$BARREL"; then
  ok "(setup) fresh barrel registers no-server-imports-in-client (import + rules-map entry)"
else
  bad "(setup) fresh barrel does NOT register no-server-imports-in-client — fixture assumption broke"
fi

# ── Arm 2 (teeth / simulate a stale pre-upgrade barrel): strip the rule's import + registration
#    lines directly, as if the barrel predates that rule shipping ────────────────────────────────
grep -v "no-server-imports-in-client" "$BARREL" > "$BARREL.stripped"
mv "$BARREL.stripped" "$BARREL"

if grep -q "no-server-imports-in-client" "$BARREL"; then
  bad "(teeth) strip did not remove no-server-imports-in-client from the barrel — sabotage failed"
else
  ok "(teeth) stale barrel simulated: no-server-imports-in-client import + registration removed"
fi

# ── Arm 3: run --refresh (early-exits through do_refresh) ────────────────────────────────────────
( cd "$FIXTURE" && bash "$INSTALL" react-next --refresh < /dev/null ) > "$FIXTURE/.refresh.log" 2>&1
REFRESH_RC=$?
if [ "$REFRESH_RC" -ne 0 ]; then
  bad "(refresh) install.sh --refresh exited non-zero (rc=$REFRESH_RC, log tail: $(tail -8 "$FIXTURE/.refresh.log" | tr '\n' '|'))"
else
  ok "(refresh) install.sh --refresh completed rc=0"
fi

# ── Arm 4 (pos): the deleted rule is BACK — barrel was regenerated, not left stale ────────────────
if grep -q "noServerImportsInClient" "$BARREL" && grep -q "'no-server-imports-in-client':" "$BARREL"; then
  ok "(pos) --refresh regenerated the barrel: no-server-imports-in-client import + registration restored"
else
  bad "(pos) --refresh did NOT restore no-server-imports-in-client — barrel left stale (the #876 bug)"
fi

# ── Arm 5 (pos, full-set check): barrel's rule-key set matches the on-disk eslint-rules-local/*.ts
#    set exactly (sans index.ts/.d.ts) — not just the one probed rule ────────────────────────────
ON_DISK_KEYS=$(
  for f in "$FIXTURE"/eslint-rules-local/*.ts; do
    b=$(basename "$f" .ts)
    [ "$b" = "index" ] && continue
    [ "${b%.d}" != "$b" ] && continue   # skip *.d.ts (basename .ts leaves a trailing ".d")
    echo "$b"
  done | sort -u
)
BARREL_KEYS=$(grep -oE "^    '[a-z0-9-]+':" "$BARREL" | sed -E "s/^    '//; s/'://" | sort -u)

if [ "$ON_DISK_KEYS" = "$BARREL_KEYS" ]; then
  ok "(pos, full-set) barrel rule-key set exactly matches on-disk eslint-rules-local/*.ts (no rule stranded)"
else
  bad "(pos, full-set) barrel rule-key set diverges from on-disk rules — on-disk:[$(echo "$ON_DISK_KEYS" | tr '\n' ',')] barrel:[$(echo "$BARREL_KEYS" | tr '\n' ',')]"
fi

echo ""
echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
[ "$FAIL" -eq 0 ]
