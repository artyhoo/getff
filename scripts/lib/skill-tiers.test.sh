#!/usr/bin/env bash
# Test for scripts/lib/skill-tiers.mjs — the ONE reader of the GETFF_SKILLS_* tier constants.
#
# WHY: two renderers need the three-tier skill read (ref-gen G12, spec
# docs/superpowers/specs/2026-09-14-getff-ai-reference-generator-design.md §2 G12): the roster
# read CORE/ENV and the reference generator needs all three (family B tiers). A second reader of
# `GETFF_SKILLS_*` anywhere is the #sync-by-copy-paste shape — the falsifier in G12 says collapse
# to the module. The reader is fail-closed on a missing constant (the roster's own posture,
# render-install-roster.mjs readSet: throw, never render empty).
#
# Channel: the `alwayson-budget` job in .github/workflows/audit-self.yml (principle 41 gates the
# wiring — an unwired *.test.sh fails CI).
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$DIR/../.." && pwd)"
cd "$REPO_ROOT" || { echo "FAIL: cannot cd $REPO_ROOT"; exit 1; }

fails=0
ok()   { printf 'PASS: %s\n' "$1"; }
bad()  { printf 'FAIL: %s\n' "$1"; fails=$(( fails + 1 )); }

# --- arm 1: the module reads all three tiers from the real setup.d/lib.sh -----------------
tiers="$(node -e '
  import("./scripts/lib/skill-tiers.mjs").then(({ readSkillTiers }) => {
    try { process.stdout.write(JSON.stringify(readSkillTiers(process.cwd()))); }
    catch (e) { console.error(String(e)); process.exit(1); }
  });
')" || { bad "readSkillTiers threw on the real lib.sh"; tiers=""; }

if [ -n "$tiers" ]; then
  case "$tiers" in
    *'"core":["ai-doc","rule-research","rule-tests","template-audit"]'*)
      ok "core tier = 4 dirs sorted (lib.sh:61)" ;;
    *) bad "core tier mismatch: $tiers" ;;
  esac
  case "$tiers" in
    *'"env":["arch","night-mode","orchestrator","pipeline","reviewer"]'*)
      ok "env tier = 5 dirs sorted (lib.sh:62)" ;;
    *) bad "env tier mismatch: $tiers" ;;
  esac
  case "$tiers" in
    *'"factory":["aif-doctor","claude-glm-executor-handoff","dispatcher","harvest","story"]'*)
      ok "factory tier = 5 dirs sorted (lib.sh:63)" ;;
    *) bad "factory tier mismatch: $tiers" ;;
  esac
fi

# --- arm 2: fail-closed on a missing constant (never fail-open to an empty set) -----------
if node -e '
  import("./scripts/lib/skill-tiers.mjs").then(({ readTierSets }) => {
    try { readTierSets("GETFF_SKILLS_CORE=\"a b\"\n"); process.exit(3); }
    catch (e) { if (/GETFF_SKILLS_ENV not found/.test(String(e))) process.exit(0); process.exit(4); }
  });
'; then
  ok 'readTierSets throws naming the missing constant (GETFF_SKILLS_ENV)'
else
  bad 'readTierSets did NOT throw fail-closed on a missing constant'
fi

# --- arm 3: the roster imports the module (G12: no second reader of GETFF_SKILLS_*) -------
if grep -n "skill-tiers" scripts/render-install-roster.mjs >/dev/null; then
  ok 'render-install-roster.mjs imports scripts/lib/skill-tiers.mjs'
else
  bad 'render-install-roster.mjs still re-parses GETFF_SKILLS_* locally (second reader)'
fi
# Production readers only: *.test.* files read lib.sh INDEPENDENTLY on purpose (a parity test
# that imports the module it checks compares the parser with itself); comments are not readers.
readers="$(grep -rn 'GETFF_SKILLS_' --include='*.mjs' --include='*.ts' scripts/ packages/ setup.d/ 2>/dev/null \
  | grep -v 'skill-tiers.mjs' | grep -vE '\.test\.(ts|sh|js|mjs):' | grep -vE '^[^:]+:[0-9]+:\s*(\*|//)' | tr '\n' ' ')"
if [ -z "$readers" ]; then
  ok 'no second JS reader of GETFF_SKILLS_* outside the module'
else
  bad "second reader(s) of GETFF_SKILLS_*: $readers"
fi

# --- arm 4: the roster still derives its merged core set (no behaviour change) ------------
if npx tsx scripts/render-install-roster.mjs --check >/dev/null 2>&1; then
  ok 'render-install-roster --check still GREEN after the extraction'
else
  bad 'render-install-roster --check RED after the extraction'
fi

if [[ "$fails" -eq 0 ]]; then
  echo "ALL PASS (scripts/lib/skill-tiers.mjs)"
  exit 0
fi
echo "FAILURES: $fails"
exit 1
