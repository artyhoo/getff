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

# ── Arm 6 (paired-negative, adversarial-review Important): the #838 fixture-prune inside
#    generate_eslint_barrel MUST honour scripts/fences-fire-fixtures.override.md the SAME way
#    refresh_safe does for that dir — else --refresh half-honours the Layer-3 escape hatch
#    (dir kept by refresh_safe, but framework fixtures inside it still deleted by the unguarded
#    prune loop), contradicting do_refresh's printed ".override.md preserved" guarantee.
#
#    ts-server is the stack under test here (not react-next, reused from arms 1-5 above):
#    no-server-imports-in-client is a react-next PRESET rule, ABSENT from the ts-server barrel,
#    so its fixture is prune-eligible on ts-server — exactly the condition that triggers the bug.
#
#    Isolated fresh install (own mktemp target) so this arm's --refresh does not interact with
#    the already-refreshed react-next fixture from arms 1-5.
FIXTURE2=$(mktemp -d)
trap 'rm -rf "$FIXTURE" "$FIXTURE2"' EXIT

printf '{"name":"refresh-barrel-override-test","version":"0.0.0"}\n' > "$FIXTURE2/package.json"
( cd "$FIXTURE2" && git init -q && git config user.email "test@test.com" && git config user.name "Test" ) >/dev/null 2>&1
( cd "$FIXTURE2" && bash "$INSTALL" ts-server --force < /dev/null ) > "$FIXTURE2/.install.log" 2>&1
INSTALL2_RC=$?

FIXTURE_DIR2="$FIXTURE2/scripts/fences-fire-fixtures"
if [ "$INSTALL2_RC" -ne 0 ] || [ ! -d "$FIXTURE_DIR2" ]; then
  skip "(arm 6, all) ts-server install could not complete in this env (rc=$INSTALL2_RC, log tail: $(tail -5 "$FIXTURE2/.install.log" 2>/dev/null | tr '\n' '|'))"
else
  ok "(arm 6, setup) fresh ts-server install produced scripts/fences-fire-fixtures/"

  FRAMEWORK_FIXTURE_STEM="$REPO_ROOT/packages/core/audit-self/fixtures/fences-fire/no-server-imports-in-client"
  if [ ! -f "$FRAMEWORK_FIXTURE_STEM.manifest.json" ]; then
    bad "(arm 6, setup) framework fixture no-server-imports-in-client.manifest.json not found — fixture assumption broke"
  else
    # Place the framework fixture into the installed tree (simulates it having shipped there,
    # regardless of whether the initial ts-server install itself delivered it unconditionally).
    cp "$FRAMEWORK_FIXTURE_STEM".* "$FIXTURE_DIR2/"

    if ! grep -q "'no-server-imports-in-client':" "$FIXTURE2/eslint-rules-local/index.mjs" 2>/dev/null; then
      ok "(arm 6, setup) confirmed no-server-imports-in-client is ABSENT from the ts-server barrel (prune-eligible)"
    else
      bad "(arm 6, setup) no-server-imports-in-client unexpectedly present in ts-server barrel — fixture assumption broke"
    fi

    # Consumer signals Layer-3 ownership of the whole fixtures dir.
    echo "consumer-owned: see our fences-fire fixtures policy" > "$FIXTURE2/scripts/fences-fire-fixtures.override.md"

    ( cd "$FIXTURE2" && bash "$INSTALL" ts-server --refresh < /dev/null ) > "$FIXTURE2/.refresh.log" 2>&1
    REFRESH2_RC=$?
    if [ "$REFRESH2_RC" -ne 0 ]; then
      bad "(arm 6, refresh) install.sh --refresh exited non-zero (rc=$REFRESH2_RC, log tail: $(tail -8 "$FIXTURE2/.refresh.log" | tr '\n' '|'))"
    else
      ok "(arm 6, refresh) install.sh --refresh completed rc=0"
    fi

    # (pos) the override protected the framework fixture from the prune — it must STILL exist.
    SURVIVING=$(find "$FIXTURE_DIR2" -maxdepth 1 -name 'no-server-imports-in-client.*' 2>/dev/null | wc -l | tr -d ' ')
    if [ "$SURVIVING" -gt 0 ]; then
      ok "(arm 6, pos) .override.md protected no-server-imports-in-client fixture from the prune ($SURVIVING file(s) survived --refresh)"
    else
      bad "(arm 6, pos) no-server-imports-in-client fixture was DELETED by --refresh despite scripts/fences-fire-fixtures.override.md — the prune ignored the Layer-3 override (adversarial-review Important, unfixed)"
    fi
  fi
fi

echo ""
echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
[ "$FAIL" -eq 0 ]
