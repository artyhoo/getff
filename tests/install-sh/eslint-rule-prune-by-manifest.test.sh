#!/usr/bin/env bash
# eslint-rule-prune-by-manifest.test.sh — ledger #1597 L-5.
#
# `generate_eslint_barrel`'s stray-rule prune decided ownership of `eslint-rules-local/*` by
# BASENAME COLLISION with any framework rules dir: if a file's basename matched a rule shipped by
# core or by any preset (across ALL stacks), the prune `rm -f`'d its .ts/.mjs/.d.ts with one info
# line. That heuristic was reworked across five fix-of-fix commits (#880 → #887 → #1503 → #1505 →
# #1548) while the same umbrella built the actual ownership record — `.ai-factory/
# refresh-baseline.json`, a sha256 per delivered path — and every rule file is delivered through
# copy_safe/refresh_safe and therefore recorded in it. The prune consulted none of it, and it runs
# on EVERY non-dry-run pass (setup.d/40-configs.sh and install.sh), fresh install or --refresh,
# with no --stack required.
#
# The contract this file pins: prune a rule only when the manifest attributes that exact path to
# the framework AND its bytes still match the recorded hash. A consumer's copy-and-adapt of a
# same-named rule, and any rule the manifest does not know, is consumer-owned and survives.
#
# Acceptance is behavioural: real installs into mktemp consumers, asserting on-disk bytes.
# Portability: bash 3.2, ASCII substrings in greps.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

RL_DIR="eslint-rules-local"

make_consumer() {
  local T
  T=$(mktemp -d)
  printf '{ "name":"consumer","version":"0.0.0" }\n' > "$T/package.json"
  ( cd "$T" && git init -q && bash "$REPO_ROOT/install.sh" ts-server < /dev/null ) >/dev/null 2>&1
  echo "$T"
}

# A rule basename that IS framework-attributable but is NOT part of the ts-server barrel — i.e.
# exactly the "stray from another stack" the prune targets. Resolved from the framework tree at
# runtime so a preset reshuffle cannot make the test vacuous.
STRAY=""
for _d in "$REPO_ROOT"/packages/*/eslint-rules; do
  [ -d "$_d" ] || continue
  case "$_d" in */core/eslint-rules) continue ;; esac
  for _f in "$_d"/*.ts; do
    [ -e "$_f" ] || continue
    case "$_f" in *.test.ts|*.d.ts|*/index.ts) continue ;; esac
    STRAY=$(basename "$_f" .ts)
    STRAY_SRC="$_f"
    break
  done
  [ -n "$STRAY" ] && break
done
[ -n "$STRAY" ] || { echo "FATAL: no preset rule found to use as a stray probe"; exit 1; }

# ══════════════════════════════════════════════════════════════════════════════
# ARM 1 — a consumer's ADAPTED copy of a same-named framework rule is NOT pruned
# ══════════════════════════════════════════════════════════════════════════════
# The ledger's failure scenario verbatim: a consumer hand-copies a preset rule from another
# stack into eslint-rules-local/ and edits it. Under the basename heuristic the next `./setup`
# deletes it with one info line, bypassing the divergence guard every other overwrite consults.
TC1=$(make_consumer)
printf '// CONSUMER_ADAPTED_RULE_ARM_1\nexport default {};\n' > "$TC1/$RL_DIR/$STRAY.ts"
printf '// CONSUMER_ADAPTED_RULE_ARM_1\nexport default {};\n' > "$TC1/$RL_DIR/$STRAY.mjs"
OUT_1=$( cd "$TC1" && bash "$REPO_ROOT/install.sh" ts-server < /dev/null 2>&1 )
if [ -f "$TC1/$RL_DIR/$STRAY.ts" ] && grep -qF 'CONSUMER_ADAPTED_RULE_ARM_1' "$TC1/$RL_DIR/$STRAY.ts"; then
  ok "arm 1: the consumer's adapted [$STRAY].ts survived a re-install (ownership read from the manifest)"
else
  bad "arm 1: the consumer's adapted [$STRAY].ts was pruned — ownership is still decided by basename"
fi
if [ -f "$TC1/$RL_DIR/$STRAY.mjs" ]; then
  ok "arm 1: the consumer's adapted [$STRAY].mjs survived too (the whole triple is consumer-owned)"
else
  bad "arm 1: the consumer's adapted [$STRAY].mjs was pruned"
fi
# neg (LOAD-BEARING): the run must actually have reached the barrel generator — otherwise
# survival proves only that the prune never ran.
if [ -f "$TC1/$RL_DIR/index.mjs" ] && printf '%s\n' "$OUT_1" | grep -qF "$RL_DIR"; then
  ok "arm 1 neg: the re-install did regenerate the barrel (the prune pass ran and chose to keep)"
else
  bad "arm 1 neg: no barrel activity in this run — arm 1 is vacuous"
fi
rm -rf "$TC1"

# ══════════════════════════════════════════════════════════════════════════════
# ARM 2 — a PRISTINE framework-delivered stray IS still pruned (#882 preserved)
# ══════════════════════════════════════════════════════════════════════════════
# The cross-stack prune must survive the fix: a stray rule that the framework really delivered
# and the consumer never touched is ours to remove.
TC2=$(make_consumer)
cp "$STRAY_SRC" "$TC2/$RL_DIR/$STRAY.ts"
printf 'export default {};\n' > "$TC2/$RL_DIR/$STRAY.mjs"
# Record it in the baseline as a framework delivery with its exact bytes — which is what a real
# `--stack <other>` install would have left behind.
python3 - "$TC2" "$RL_DIR/$STRAY.ts" "$RL_DIR/$STRAY.mjs" <<'PYEOF'
import hashlib, json, os, sys
root, *rels = sys.argv[1:]
man = os.path.join(root, ".ai-factory", "refresh-baseline.json")
data = json.load(open(man)) if os.path.exists(man) else {}
for rel in rels:
    data[rel] = hashlib.sha256(open(os.path.join(root, rel), "rb").read()).hexdigest()
os.makedirs(os.path.dirname(man), exist_ok=True)
json.dump(data, open(man, "w"), sort_keys=True)
PYEOF
OUT_2=$( cd "$TC2" && bash "$REPO_ROOT/install.sh" ts-server < /dev/null 2>&1 )
if [ ! -e "$TC2/$RL_DIR/$STRAY.ts" ] && [ ! -e "$TC2/$RL_DIR/$STRAY.mjs" ]; then
  ok "arm 2: a pristine framework-delivered stray [$STRAY] is still pruned (#882 intact)"
else
  bad "arm 2: the pristine stray [$STRAY] survived — the cross-stack prune regressed"
fi
if printf '%s\n' "$OUT_2" | grep -qF "pruned stale rule [$STRAY]"; then
  ok "arm 2: the prune announced itself for [$STRAY]"
else
  bad "arm 2: no prune line for [$STRAY] in the output"
fi
rm -rf "$TC2"

# ══════════════════════════════════════════════════════════════════════════════
# ARM 3 — an UNRECORDED same-name rule is consumer-owned (unknown != ours)
# ══════════════════════════════════════════════════════════════════════════════
# A consumer who authored a rule whose basename happens to collide with another stack's preset,
# on a consumer whose manifest never mentions that path. Unknown provenance must not authorise
# deletion — the same «unknown = today's behaviour, never destructive» rule the divergence guard
# already follows.
TC3=$(make_consumer)
cp "$STRAY_SRC" "$TC3/$RL_DIR/$STRAY.ts"      # byte-identical to the framework rule…
rm -f "$TC3/.ai-factory/refresh-baseline.json" # …but nothing on record says we delivered it
( cd "$TC3" && bash "$REPO_ROOT/install.sh" ts-server < /dev/null ) >/dev/null 2>&1
if [ -f "$TC3/$RL_DIR/$STRAY.ts" ]; then
  ok "arm 3: an unrecorded [$STRAY].ts is left alone (no manifest entry = not attributable to us)"
else
  bad "arm 3: an unrecorded [$STRAY].ts was deleted — the prune still asserts ownership it cannot prove"
fi
rm -rf "$TC3"

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
