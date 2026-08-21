#!/usr/bin/env bash
# eslint-barrel-preserve-consumer.test.sh — issue 1481 casualty 2: regenerating the
# eslint-rules-local/index.mjs barrel (generate_eslint_barrel, setup.d/lib.sh — the ONE
# place both the setup.d/40-configs.sh copy path and install.sh do_refresh call) must
# PRESERVE consumer-added entries whose rule basename is not framework-attributable,
# instead of silently dropping every non-framework import from the hand-extended barrel.
#
# Arms (kickoff consumer-refresh-integrity §2 row R2 — the floor):
#   (a) consumer-added rule (.mjs only, NO .ts — the no-tsc consumer reality,
#       setup.d/40-configs.sh:174-177) + hand-extended barrel → --refresh keeps the entry;
#       the barrel must stay LOADABLE (an entry pointing at a missing module is the FQA
#       S1-A W1 failure mode — all rules dead while CI stays green — it is NOT a pass);
#   (b) framework-only barrel → regeneration byte-identical (checksum compare);
#   (c) #882 must survive unchanged: a cross-stack stray (rule basename from a DIFFERENT
#       preset) is still pruned and dropped — in the SAME tree where the consumer entry
#       is preserved (both behaviors coexist);
#   (d) --dry-run writes nothing (full no-op, guard inside the helper).
#
# Deterministic, no network: real install.sh runs into mktemp fixtures, mirroring
# tests/install-sh/refresh-different-stack-prunes-barrel.test.sh's pattern. Graceful
# skip (rc=0) if install.sh cannot complete in this env.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALL="$REPO_ROOT/install.sh"

PASS=0; FAIL=0; SKIP=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip() { SKIP=$((SKIP+1)); echo "  · $1"; }

[ -f "$INSTALL" ] || { echo "FATAL: $INSTALL not found"; exit 1; }

RULE_BASE="my-consumer-rule"          # kebab basename  → camel export per the file/key convention
RULE_CAMEL="myConsumerRule"

# consumer_rule_mjs <dst> — a hand-written consumer rule module (compiled .mjs, NO .ts).
consumer_rule_mjs() {
  cat > "$1" <<'EOF'
const myConsumerRule = {
  meta: { name: 'my-consumer-rule', type: 'problem', docs: { description: 'consumer-owned' }, schema: [], messages: { bad: 'bad' } },
  create() { return {}; },
};
export { myConsumerRule };
EOF
}

# hand_extend_barrel <barrel> — append the consumer import + rules-map entry, exactly how a
# consumer extends the generated barrel by hand (issue 1481's scenario).
hand_extend_barrel() {
  awk -v imp="import { $RULE_CAMEL } from './$RULE_BASE.mjs';" \
      -v ent="    '$RULE_BASE': $RULE_CAMEL," '
    !pi && /^const plugin = \{/ { print imp; pi = 1 }
    !pe && /^  \},$/ { print ent; pe = 1 }
    { print }
  ' "$1" > "$1.tmp" && mv "$1.tmp" "$1"
}

# barrel_loadable <fixture_dir> — the barrel must import cleanly AND expose the consumer
# rule key (dead-import barrel = S1-A W1 = NOT a pass). The framework rule .mjs siblings
# import '@typescript-eslint/utils', so link the repo's node_modules (f19 pattern); skips
# (not fails) if node or the dep tree is absent in this env.
barrel_loadable() {
  command -v node >/dev/null 2>&1 || { skip "(loadability) node not found in env"; return 0; }
  [ -d "$REPO_ROOT/node_modules/@typescript-eslint/utils" ] || { skip "(loadability) repo node_modules incomplete (@typescript-eslint/utils absent; run npm ci)"; return 0; }
  ln -sfn "$REPO_ROOT/node_modules" "$1/node_modules"
  if node -e "import('file://$1/eslint-rules-local/index.mjs').then(m => { process.exit('$RULE_BASE' in m.rules ? 0 : 1); }).catch(() => process.exit(2))"; then
    ok "(loadability) barrel imports and registers '$RULE_BASE' in plugin.rules"
  else
    bad "(loadability) barrel import failed or '$RULE_BASE' missing from plugin.rules"
  fi
}

FIX_A=$(mktemp -d)   # arm (a): consumer entry survives --refresh
FIX_B=$(mktemp -d)   # arm (b): framework-only byte-identity
FIX_C=$(mktemp -d)   # arm (c): #882 cross-stack stray still pruned (+ consumer kept)
FIX_D=$(mktemp -d)   # arm (d): dry-run writes nothing
trap 'rm -rf "$FIX_A" "$FIX_B" "$FIX_C" "$FIX_D"' EXIT

for _d in "$FIX_A" "$FIX_B" "$FIX_C" "$FIX_D"; do
  printf '{"name":"barrel-preserve","version":"0.0.0"}\n' > "$_d/package.json"
  ( cd "$_d" && git init -q && git config user.email "test@test.com" && git config user.name "Test" ) >/dev/null 2>&1
done

# ── Arm (a): consumer-added entry survives --refresh ─────────────────────────────
( cd "$FIX_A" && bash "$INSTALL" ts-server --force < /dev/null ) > "$FIX_A/.i1.log" 2>&1
A1_RC=$?
if [ "$A1_RC" -ne 0 ] || [ ! -f "$FIX_A/eslint-rules-local/index.mjs" ]; then
  skip "(all arms) baseline ts-server install could not complete in this env (rc=$A1_RC, log tail: $(tail -5 "$FIX_A/.i1.log" 2>/dev/null | tr '\n' '|'))"
  echo ""
  echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
  exit 0
fi
ok "(a, setup) ts-server --force install completed rc=0"

consumer_rule_mjs "$FIX_A/eslint-rules-local/$RULE_BASE.mjs"
hand_extend_barrel "$FIX_A/eslint-rules-local/index.mjs"
ok "(a, setup) hand-extended barrel + consumer $RULE_BASE.mjs (no .ts) in place"

( cd "$FIX_A" && bash "$INSTALL" ts-server --refresh < /dev/null ) > "$FIX_A/.i2.log" 2>&1
A2_RC=$?
if [ "$A2_RC" -eq 0 ]; then
  ok "(a) ts-server --refresh completed rc=0"
else
  bad "(a) ts-server --refresh exited non-zero (rc=$A2_RC, log tail: $(tail -8 "$FIX_A/.i2.log" | tr '\n' '|'))"
fi

if [ -f "$FIX_A/eslint-rules-local/$RULE_BASE.mjs" ]; then
  ok "(a, pos) consumer module $RULE_BASE.mjs still on disk after refresh"
else
  bad "(a, pos) consumer module $RULE_BASE.mjs deleted by refresh"
fi
if grep -q "^import { $RULE_CAMEL } from './$RULE_BASE.mjs';" "$FIX_A/eslint-rules-local/index.mjs" && \
   grep -q "^    '$RULE_BASE': $RULE_CAMEL,$" "$FIX_A/eslint-rules-local/index.mjs"; then
  ok "(a, pos) consumer import line + rules-map entry preserved in regenerated barrel"
else
  bad "(a, pos) consumer entry dropped from regenerated barrel — the issue 1481 casualty 2 bug"
fi
barrel_loadable "$FIX_A"

# ── Arm (b): framework-only barrel regenerates byte-identical ────────────────────
( cd "$FIX_B" && bash "$INSTALL" ts-server --force < /dev/null ) > "$FIX_B/.i1.log" 2>&1
B1_RC=$?
if [ "$B1_RC" -ne 0 ]; then
  skip "(b) baseline ts-server --force could not complete (rc=$B1_RC)"
else
  B_SUM_1=$(shasum -a 256 "$FIX_B/eslint-rules-local/index.mjs" | cut -d' ' -f1)
  ( cd "$FIX_B" && bash "$INSTALL" ts-server --refresh < /dev/null ) > "$FIX_B/.i2.log" 2>&1
  B2_RC=$?
  B_SUM_2=$(shasum -a 256 "$FIX_B/eslint-rules-local/index.mjs" | cut -d' ' -f1)
  if [ "$B2_RC" -eq 0 ] && [ "$B_SUM_1" = "$B_SUM_2" ]; then
    ok "(b, pos) framework-only barrel byte-identical across --refresh (sha256 ${B_SUM_2:0:12}…)"
  else
    bad "(b) framework-only barrel drifted or refresh failed (rc=$B2_RC, before:$B_SUM_1 after:$B_SUM_2)"
  fi
fi

# ── Arm (c): #882 cross-stack stray still pruned, consumer entry still kept ──────
( cd "$FIX_C" && bash "$INSTALL" react-next --force < /dev/null ) > "$FIX_C/.i1.log" 2>&1
C1_RC=$?
if [ "$C1_RC" -ne 0 ] || [ ! -f "$FIX_C/eslint-rules-local/no-server-imports-in-client.ts" ]; then
  skip "(c) react-next --force setup could not complete (rc=$C1_RC) — cross-stack arm skipped"
else
  consumer_rule_mjs "$FIX_C/eslint-rules-local/$RULE_BASE.mjs"
  hand_extend_barrel "$FIX_C/eslint-rules-local/index.mjs"

  ( cd "$FIX_C" && bash "$INSTALL" ts-server --refresh < /dev/null ) > "$FIX_C/.i2.log" 2>&1
  C2_RC=$?
  if [ "$C2_RC" -eq 0 ]; then
    ok "(c) ts-server --refresh (stack switch) completed rc=0"
  else
    bad "(c) ts-server --refresh exited non-zero (rc=$C2_RC, log tail: $(tail -8 "$FIX_C/.i2.log" | tr '\n' '|'))"
  fi

  STRAY_COUNT=$(find "$FIX_C/eslint-rules-local" -maxdepth 1 -name 'no-server-imports-in-client.*' 2>/dev/null | wc -l | tr -d ' ')
  if [ "$STRAY_COUNT" -eq 0 ]; then
    ok "(c, pos) #882 unchanged: cross-stack stray no-server-imports-in-client.* pruned from disk"
  else
    bad "(c, pos) cross-stack stray NOT pruned ($STRAY_COUNT file(s)) — #882 regressed"
  fi
  if grep -q "no-server-imports-in-client" "$FIX_C/eslint-rules-local/index.mjs"; then
    bad "(c, pos) pruned stray still referenced in regenerated barrel"
  else
    ok "(c, pos) pruned stray dropped from barrel (framework-attributable → never preserved)"
  fi
  if grep -q "^    '$RULE_BASE': $RULE_CAMEL,$" "$FIX_C/eslint-rules-local/index.mjs" && [ -f "$FIX_C/eslint-rules-local/$RULE_BASE.mjs" ]; then
    ok "(c, pos) consumer entry + module preserved in the SAME tree where the stray was pruned"
  else
    bad "(c, pos) consumer entry lost during stack-switch refresh"
  fi
fi

# ── Arm (d): --dry-run writes nothing (full no-op) ───────────────────────────────
( cd "$FIX_D" && bash "$INSTALL" ts-server --force < /dev/null ) > "$FIX_D/.i1.log" 2>&1
D1_RC=$?
if [ "$D1_RC" -ne 0 ]; then
  skip "(d) baseline ts-server --force could not complete (rc=$D1_RC)"
else
  consumer_rule_mjs "$FIX_D/eslint-rules-local/$RULE_BASE.mjs"
  hand_extend_barrel "$FIX_D/eslint-rules-local/index.mjs"
  D_SUM_1=$(shasum -a 256 "$FIX_D/eslint-rules-local/index.mjs" | cut -d' ' -f1)

  ( cd "$FIX_D" && bash "$INSTALL" ts-server --refresh --dry-run < /dev/null ) > "$FIX_D/.i2.log" 2>&1
  D2_RC=$?
  D_SUM_2=$(shasum -a 256 "$FIX_D/eslint-rules-local/index.mjs" | cut -d' ' -f1)
  if [ "$D2_RC" -eq 0 ] && [ "$D_SUM_1" = "$D_SUM_2" ] && [ -f "$FIX_D/eslint-rules-local/$RULE_BASE.mjs" ]; then
    ok "(d, pos) --dry-run left barrel byte-identical and consumer module untouched (full no-op)"
  else
    bad "(d) --dry-run wrote something (rc=$D2_RC, before:$D_SUM_1 after:$D_SUM_2, module present:$( [ -f "$FIX_D/eslint-rules-local/$RULE_BASE.mjs" ] && echo yes || echo no))"
  fi
fi

echo ""
echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
[ "$FAIL" -eq 0 ]
