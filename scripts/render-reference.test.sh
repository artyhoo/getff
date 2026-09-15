#!/usr/bin/env bash
# render-reference.test.sh — acceptance arms for scripts/render-reference.mjs (getff-ai-site S0a).
#
# Live-fire, never a source grep: every arm RUNS the real generator (npx tsx) against either
# the real repo (census mode only — it never throws, it reports holes as lines) or a throwaway
# mktemp fixture repo, and asserts output + exit codes. Arms:
#   1. census on the real repo: exit 0, population header, all eleven families reported.
#   2. census on an empty fixture: exit 0, the zero-population shape is still a census.
#   3. --write fills an EXISTING page's fence and NEVER creates a missing page (TD2-6);
#      every family JSON lands.
#   4. --check detects drift (non-zero, naming the artefact); --write heals it (exit 0).
#   5. a source hole fails --write naming the file — absence-by-omission blocks the render (D36).
#   6. an F.3 member that cannot parse, or whose `/**` header block swallows live code, fails
#      --write naming the file — the 2026-09-15 triage-*.mjs breakage class (unterminated
#      family headers reached review green because no gate parsed F3 members).
#
# Pure bash + the repo's own tsx deps; no network, no LLM (no-paid-llm-in-ci.md).
set -u
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)
cd "$REPO_ROOT" || exit 1

PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
GEN="scripts/render-reference.mjs"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# ── Arm 1: census on the real repo — exit 0 and all eleven families reported ─────────────────
out=$(npx tsx "$GEN" --census 2>/dev/null); rc=$?
if [ $rc -eq 0 ] && echo "$out" | grep -q '^== census (F.3 wiring) over scripts/ — population '; then
  ok "arm 1: census exits 0 with the population header"
else
  bad "arm 1: census rc=$rc / missing population header"
fi
missing_fam=0
for f in A B C D E F1 F2 F3 G H I; do
  echo "$out" | grep -qE "^  $f .*(OK|HOLES)" || missing_fam=1
done
if [ $missing_fam -eq 0 ]; then
  ok "arm 1: all eleven families reported (OK or HOLES — the census is the measurement, D55)"
else
  bad "arm 1: a family is missing from the per-family census output"
fi

# ── fixture: an empty-but-complete repo skeleton every family builder accepts ─────────────────
# The builder IMPORTS (render-install-roster shippedAgents, skill-tiers readTierSets) keep the
# installer's own fail-closed posture: 20-agents.sh must carry ≥1 skip-list entry and lib.sh all
# three GETFF_SKILLS_* constants, or they throw naming the installer — so the fixture carries a
# minimal parseable form of each. All generator runs happen from the repo root (npx resolves the
# repo's tsx + ajv); the fixture is passed via --root, never cd'd into.
make_fixture() {
  local root="$1"
  mkdir -p "$root"/setup.d "$root"/skills "$root"/agents "$root"/.claude/hooks "$root"/.claude/rules \
    "$root"/.claude/skills "$root"/scripts "$root"/packages/core/templates \
    "$root"/packages/core/manifest "$root"/packages/runtime-bridge/src/cli \
    "$root"/plugin/hooks "$root"/plugin/skills "$root"/plugin/commands "$root"/plugin/agents \
    "$root"/plugin/.claude-plugin "$root"/docs/site/reference/schema
  # G8: every family validates against its draft-07 schema — the fixture carries THIS repo's
  # schemas (the generator's own contract surface, committed at docs/site/reference/schema/).
  cp "$REPO_ROOT"/docs/site/reference/schema/*.schema.json "$root/docs/site/reference/schema/"
  printf '{"name":"fixture","private":true}\n' >"$root/package.json"
  # family F.2 locates each rule's key LINE (`^\s*"key"\s*:`) — the key must open its own line.
  cat >"$root/packages/core/manifest/rules-manifest.json" <<'JSON'
{
  "R1": {
    "title": "Fixture rule one",
    "stack": ["ts-server"],
    "check": { "type": "command", "command": "true" }
  }
}
JSON
  printf '{"hooks":{}}\n' >"$root/plugin/hooks/hooks.json"
  printf '{"hooks":{}}\n' >"$root/.claude/settings.json"
  printf '{"version":"0.0.0"}\n' >"$root/plugin/.claude-plugin/plugin.json"
  printf '[]\n' >"$root/packages/core/templates/templates.manifest.json"
  # readTierSets matches `${name}="([^"]+)"` — the value must be non-empty; a name with no
  # matching skill dir is harmless (tiers only classify names buildB enumerates from dirs).
  printf 'GETFF_SKILLS_CORE="fixture-core"\nGETFF_SKILLS_ENV="fixture-env"\nGETFF_SKILLS_FACTORY="fixture-factory"\n' >"$root/setup.d/lib.sh"
  printf '#!/usr/bin/env bash\n# setup.d/20-agents.sh — write the fixture agent skip-list.\n    docs-writer.md) continue ;;\n' >"$root/setup.d/20-agents.sh"
}

# ── Arm 2: census on an empty fixture — the zero-population shape still exits 0 ───────────────
make_fixture "$TMP/empty"
out=$(npx tsx "$GEN" --census --root "$TMP/empty" 2>/dev/null); rc=$?
if [ $rc -eq 0 ] && echo "$out" | grep -q 'population 0, cards 0, unwired 0, test material 0'; then
  ok "arm 2: empty fixture census exits 0 with the zero-population line"
else
  bad "arm 2: empty fixture census rc=$rc / wrong population line: $(echo "$out" | head -1)"
fi

# ── Arm 3: --write fills an existing page's fence, never creates a page (TD2-6) ───────────────
make_fixture "$TMP/fill"
cat >"$TMP/fill/docs/site/reference/A.md" <<'MD'
# Family A — installer layers

Intro prose the generator must not touch.
MD
out=$(npx tsx "$GEN" --write --root "$TMP/fill" 2>&1); rc=$?
jsons=0
for f in A B C D E F1 F2 F3 G H I; do
  [ -f "$TMP/fill/docs/site/reference/$f.json" ] && jsons=$((jsons+1))
done
if [ $rc -eq 0 ] && [ "$jsons" -eq 11 ]; then
  ok "arm 3: --write exits 0 and lands all eleven family JSONs"
else
  bad "arm 3: --write rc=$rc, family JSONs present: $jsons/11 (out: $(echo "$out" | grep -E 'Error|✗' | head -1))"
  echo "$out" | head -30
fi
if grep -q 'getff:begin section=A-table' "$TMP/fill/docs/site/reference/A.md" \
  && grep -q 'getff:end section=A-table' "$TMP/fill/docs/site/reference/A.md" \
  && head -3 "$TMP/fill/docs/site/reference/A.md" | grep -q 'Intro prose the generator must not touch.'; then
  ok "arm 3: the existing page gained the A-table fence; the pre-existing prose survived"
else
  bad "arm 3: the A-table fence did not land in the existing page (or prose was clobbered)"
fi
if [ ! -e "$TMP/fill/docs/site/reference/B.md" ]; then
  ok "arm 3: no page was created for family B (TD2-6 — the generator never creates a page)"
else
  bad "arm 3: docs/site/reference/B.md was created — the generator overstepped TD2-6"
fi

# ── Arm 4: --check detects drift; --write heals it ────────────────────────────────────────────
printf '{"schemaVersion":1,"family":"A","familyName":"tampered","generator":"scripts/render-reference.mjs","members":[]}\n' \
  >"$TMP/fill/docs/site/reference/A.json"
out=$(npx tsx "$GEN" --check --root "$TMP/fill" 2>&1); rc=$?
if [ $rc -ne 0 ] && echo "$out" | grep -q 'A.json drifted from the sources'; then
  ok "arm 4: --check exits non-zero naming the drifted artefact"
else
  bad "arm 4: --check rc=$rc on a tampered family JSON (out: $(echo "$out" | head -2 | tr '\n' ' '))"
fi
npx tsx "$GEN" --write --root "$TMP/fill" >/dev/null 2>&1
npx tsx "$GEN" --check --root "$TMP/fill" >/dev/null 2>&1; rc=$?
if [ $rc -eq 0 ]; then
  ok "arm 4: --write heals the drift; --check then exits 0"
else
  bad "arm 4: --check still non-zero after --write (rc=$rc)"
fi

# ── Arm 5: a source hole fails --write naming the file (D36 absence-by-omission) ──────────────
make_fixture "$TMP/hole"
printf '#!/usr/bin/env bash\n# no grammar here\n' >"$TMP/hole/.claude/hooks/ghost-hook.sh"
out=$(npx tsx "$GEN" --write --root "$TMP/hole" 2>&1); rc=$?
if [ $rc -ne 0 ] && echo "$out" | grep -q 'ghost-hook.sh'; then
  ok "arm 5: a hook header hole fails --write naming the file (no token leak, no silent render)"
else
  bad "arm 5: --write rc=$rc on a source hole; expected failure naming ghost-hook.sh (out: $(echo "$out" | head -2 | tr '\n' ' '))"
fi

# ── Arm 6: an F.3 member that cannot parse, or whose /** header swallows live code, fails ─────
# The 2026-09-15 class (commit 6a0330a713): family headers inserted WITHOUT the closing `*/` —
# five triage-*.mjs files stopped parsing and two more silently lost their imports to the
# unterminated block, and every gate stayed green because nothing parsed F3 members. Two
# sub-arms, one per subclass; the broken file is UNWIRED in its fixture on purpose — the arms
# must hold population-wide, not only for wired members.
make_fixture "$TMP/parse"
printf '#!/usr/bin/env node\n/**\n * broken-parse — header block that never closes at all.\nimport { readFileSync } from "node:fs";\nexport const x = () => readFileSync;\n' \
  >"$TMP/parse/scripts/broken-parse.mjs"
out=$(npx tsx "$GEN" --write --root "$TMP/parse" 2>&1); rc=$?
if [ $rc -ne 0 ] && echo "$out" | grep -q 'broken-parse.mjs'; then
  ok "arm 6a: an F.3 member that cannot parse fails --write naming the file (unwired, still caught)"
else
  bad "arm 6a: --write rc=$rc on an unparseable F.3 member; expected failure naming broken-parse.mjs (out: $(echo "$out" | head -2 | tr '\n' ' '))"
fi
make_fixture "$TMP/swallow"
# Parses CLEAN (the later `*/` closes the block) but the import below the header is dead —
# `node --check` alone cannot see this subclass; the header-closure arm is what catches it.
printf '#!/usr/bin/env node\n/**\n * broken-swallow — header block left open past live code.\n// Usage note.\nimport { readFileSync } from "node:fs";\n\n/** Collapse whitespace. */\nexport const normalize = (s) => s.replace(/\\s+/gu, " ").trim();\nconsole.log(typeof readFileSync);\n' \
  >"$TMP/swallow/scripts/broken-swallow.mjs"
out=$(npx tsx "$GEN" --write --root "$TMP/swallow" 2>&1); rc=$?
if [ $rc -ne 0 ] && echo "$out" | grep -q 'broken-swallow.mjs'; then
  ok "arm 6b: an open /** header that swallows live code fails --write even though the file parses"
else
  bad "arm 6b: --write rc=$rc on a silent-swallow F.3 member; expected failure naming broken-swallow.mjs (out: $(echo "$out" | head -2 | tr '\n' ' '))"
fi
# The green half: the same fixture with a conforming member writes clean.
printf '#!/usr/bin/env node\n/**\n * ok-script — parses and closes its header block; unwired in this fixture.\n */\nexport const ok = true;\n' \
  >"$TMP/swallow/scripts/broken-swallow.mjs"
npx tsx "$GEN" --write --root "$TMP/swallow" >/dev/null 2>&1; rc=$?
if [ $rc -eq 0 ]; then
  ok "arm 6b: the same fixture with a closed header writes clean (the arms are fail-closed, not blanket)"
else
  bad "arm 6b: --write rc=$rc after the header was closed — the F.3 arms over-fire"
fi

echo "render-reference.test.sh: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
