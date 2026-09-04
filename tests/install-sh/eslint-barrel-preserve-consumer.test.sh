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
#   (a2) consumer rule carrying .ts + .mjs + .d.ts + hand-added barrel entry → --refresh
#       leaves all three files byte-identical, the barrel stays loadable, AND the basename
#       appears EXACTLY ONCE (import line + rules-map line — grep -c == 1; a bare grep -q
#       passes on the duplicated barrel, which is the issue 1519 RP-1b blocker);
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

# hand_extend_barrel <barrel> [base] [camel] — append the consumer import + rules-map entry,
# exactly how a consumer extends the generated barrel by hand (issue 1481's scenario).
# Defaults to RULE_BASE/RULE_CAMEL; arm (a2) passes its own basename/camel.
hand_extend_barrel() {
  local _hb_base="${2:-$RULE_BASE}" _hb_camel="${3:-$RULE_CAMEL}"
  awk -v imp="import { $_hb_camel } from './$_hb_base.mjs';" \
      -v ent="    '$_hb_base': $_hb_camel," '
    !pi && /^const plugin = \{/ { print imp; pi = 1 }
    !pe && /^  \},$/ { print ent; pe = 1 }
    { print }
  ' "$1" > "$1.tmp" && mv "$1.tmp" "$1"
}

# barrel_loadable <fixture_dir> [base] — the barrel must import cleanly AND expose the
# consumer rule key (dead-import barrel = S1-A W1 = NOT a pass). Defaults to RULE_BASE;
# arm (a2) passes its own basename. The framework rule .mjs siblings import
# '@typescript-eslint/utils', so link the repo's node_modules (f19 pattern); skips (not
# fails) if node or the dep tree is absent in this env.
barrel_loadable() {
  local _bl_dir="$1" _bl_base="${2:-$RULE_BASE}"
  command -v node >/dev/null 2>&1 || { skip "(loadability) node not found in env"; return 0; }
  [ -d "$REPO_ROOT/node_modules/@typescript-eslint/utils" ] || { skip "(loadability) repo node_modules incomplete (@typescript-eslint/utils absent; run npm ci)"; return 0; }
  ln -sfn "$REPO_ROOT/node_modules" "$_bl_dir/node_modules"
  if node -e "import('file://$_bl_dir/eslint-rules-local/index.mjs').then(m => { process.exit('$_bl_base' in m.rules ? 0 : 1); }).catch(() => process.exit(2))"; then
    ok "(loadability) barrel imports and registers '$_bl_base' in plugin.rules"
  else
    bad "(loadability) barrel import failed or '$_bl_base' missing from plugin.rules"
  fi
}

# consumer_rule_trio <dir> <base> <camel> — a consumer rule carrying the FULL trio:
# .ts (authoring source, kept for reference — the installer never compiles it, fix #752),
# .mjs (hand-written compiled module) and .d.ts (types). The issue 1519 population.
consumer_rule_trio() {
  local _ct_dir="$1" _ct_base="$2" _ct_camel="$3"
  cat > "$_ct_dir/$_ct_base.ts" <<EOF
// consumer-authored rule source — never compiled by the installer (fix #752), kept for reference
const $_ct_camel = {
  meta: { name: '$_ct_base', type: 'problem', docs: { description: 'consumer-owned' }, schema: [], messages: { bad: 'bad' } },
  create() { return {}; },
};
export { $_ct_camel };
EOF
  cat > "$_ct_dir/$_ct_base.mjs" <<EOF
const $_ct_camel = {
  meta: { name: '$_ct_base', type: 'problem', docs: { description: 'consumer-owned' }, schema: [], messages: { bad: 'bad' } },
  create() { return {}; },
};
export { $_ct_camel };
EOF
  cat > "$_ct_dir/$_ct_base.d.ts" <<EOF
export declare const $_ct_camel: {
  meta: { name: string; type: 'problem' };
  create(): Record<string, unknown>;
};
EOF
}

FIX_A=$(mktemp -d)   # arm (a): consumer entry survives --refresh
FIX_A2=$(mktemp -d)  # arm (a2): consumer .ts+.mjs+.d.ts trio survives --refresh, exactly once
FIX_B=$(mktemp -d)   # arm (b): framework-only byte-identity
FIX_C=$(mktemp -d)   # arm (c): #882 cross-stack stray still pruned (+ consumer kept)
FIX_D=$(mktemp -d)   # arm (d): dry-run writes nothing
trap 'rm -rf "$FIX_A" "$FIX_A2" "$FIX_B" "$FIX_C" "$FIX_D"' EXIT

for _d in "$FIX_A" "$FIX_A2" "$FIX_B" "$FIX_C" "$FIX_D"; do
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

# ── Arm (a2): consumer .ts+.mjs+.d.ts trio survives --refresh, entry EXACTLY ONCE ─
# Issue 1519: the #882 stale-rule prune rm -f's the whole trio for a basename not valid
# for the current stack — the prune fires BEFORE the issue-1481 preservation loop can
# keep the barrel entry. Fix shape (kickoff RP-1 + RP-1b): a non-framework-attributable
# basename is never pruned; and since the generation loops then emit the canonical entry
# for its .ts, the kept-entry loop must SKIP that basename or the barrel ships a duplicate
# import binding → hard ESM SyntaxError → every rule dead (the loadability assert below).
A2_BASE="consumer-ts-rule"            # kebab basename — absent from every framework rules dir
A2_CAMEL="consumerTsRule"

( cd "$FIX_A2" && bash "$INSTALL" ts-server --force < /dev/null ) > "$FIX_A2/.i1.log" 2>&1
A21_RC=$?
if [ "$A21_RC" -ne 0 ] || [ ! -f "$FIX_A2/eslint-rules-local/index.mjs" ]; then
  skip "(a2) baseline ts-server install could not complete in this env (rc=$A21_RC)"
else
  consumer_rule_trio "$FIX_A2/eslint-rules-local" "$A2_BASE" "$A2_CAMEL"
  hand_extend_barrel "$FIX_A2/eslint-rules-local/index.mjs" "$A2_BASE" "$A2_CAMEL"
  A2_TS_1=$(shasum -a 256 "$FIX_A2/eslint-rules-local/$A2_BASE.ts" | cut -d' ' -f1)
  A2_MJS_1=$(shasum -a 256 "$FIX_A2/eslint-rules-local/$A2_BASE.mjs" | cut -d' ' -f1)
  A2_DTS_1=$(shasum -a 256 "$FIX_A2/eslint-rules-local/$A2_BASE.d.ts" | cut -d' ' -f1)
  ok "(a2, setup) consumer trio $A2_BASE.ts/.mjs/.d.ts + hand-added barrel entry in place"

  ( cd "$FIX_A2" && bash "$INSTALL" ts-server --refresh < /dev/null ) > "$FIX_A2/.i2.log" 2>&1
  A22_RC=$?
  if [ "$A22_RC" -eq 0 ]; then
    ok "(a2) ts-server --refresh completed rc=0"
  else
    bad "(a2) ts-server --refresh exited non-zero (rc=$A22_RC, log tail: $(tail -8 "$FIX_A2/.i2.log" | tr '\n' '|'))"
  fi

  A2_TS_2=$(shasum -a 256 "$FIX_A2/eslint-rules-local/$A2_BASE.ts" 2>/dev/null | cut -d' ' -f1)
  A2_MJS_2=$(shasum -a 256 "$FIX_A2/eslint-rules-local/$A2_BASE.mjs" 2>/dev/null | cut -d' ' -f1)
  A2_DTS_2=$(shasum -a 256 "$FIX_A2/eslint-rules-local/$A2_BASE.d.ts" 2>/dev/null | cut -d' ' -f1)
  if [ "$A2_TS_1" = "$A2_TS_2" ] && [ -n "$A2_TS_2" ]; then
    ok "(a2, pos) $A2_BASE.ts byte-identical after refresh"
  else
    bad "(a2, pos) $A2_BASE.ts deleted or modified by refresh (the issue 1519 prune) — before:$A2_TS_1 after:$A2_TS_2"
  fi
  if [ "$A2_MJS_1" = "$A2_MJS_2" ] && [ -n "$A2_MJS_2" ]; then
    ok "(a2, pos) $A2_BASE.mjs byte-identical after refresh"
  else
    bad "(a2, pos) $A2_BASE.mjs deleted or modified by refresh — before:$A2_MJS_1 after:$A2_MJS_2"
  fi
  if [ "$A2_DTS_1" = "$A2_DTS_2" ] && [ -n "$A2_DTS_2" ]; then
    ok "(a2, pos) $A2_BASE.d.ts byte-identical after refresh"
  else
    bad "(a2, pos) $A2_BASE.d.ts deleted or modified by refresh — before:$A2_DTS_1 after:$A2_DTS_2"
  fi

  # The load-bearing half: EXACTLY ONE import line + ONE rules-map line for the basename.
  # grep -q alone passes on the RP-1b-duplicated barrel; only the count assert catches it.
  A2_IMP_COUNT=$(grep -c "from './$A2_BASE.mjs';" "$FIX_A2/eslint-rules-local/index.mjs")
  A2_MAP_COUNT=$(grep -c "^    '$A2_BASE': $A2_CAMEL,$" "$FIX_A2/eslint-rules-local/index.mjs")
  if [ "$A2_IMP_COUNT" -eq 1 ]; then
    ok "(a2, pos) import line for '$A2_BASE' appears exactly once in the regenerated barrel"
  else
    bad "(a2, pos) import line count for '$A2_BASE' = $A2_IMP_COUNT (expected 1; 0 = pruned/dropped, 2 = the RP-1b duplicate-entry blocker)"
  fi
  if [ "$A2_MAP_COUNT" -eq 1 ]; then
    ok "(a2, pos) rules-map entry for '$A2_BASE' appears exactly once in the regenerated barrel"
  else
    bad "(a2, pos) rules-map entry count for '$A2_BASE' = $A2_MAP_COUNT (expected 1; 0 = pruned/dropped, 2 = the RP-1b duplicate-entry blocker)"
  fi

  barrel_loadable "$FIX_A2" "$A2_BASE"
fi

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
