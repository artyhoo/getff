#!/usr/bin/env bash
# render-face-facts.test.sh — acceptance arms for scripts/render-face-facts.mjs (getff-ai-site S0a, D42).
#
# Live-fire, never a source grep: every arm RUNS the real generator (npx tsx) against either
# the real repo (read-only --check arms) or a throwaway mktemp fixture repo, and asserts
# output + exit codes. Arms:
#   1. real repo: --check exit 0 — docs/site/face-facts.json exists, is in sync, and carries
#      the schema + all six framework-computable families (D42 home; face-pages spec §7).
#   2. real repo: maturity section deep-equals packages/core/manifest/maturity.json rows
#      (D42: the renderer "copies the maturity rows"); rosters counts equal the family JSONs'
#      members lengths (READ, never re-derived — §7).
#   3. real repo: enforcementOutcomes shape — the three demo nodes × four backends, every
#      value `rendered` or an FF code (buildDemoRenderFacts live outcomes, never restated).
#   4. fixture: --write from minimal sources derives every family with the fixture's exact
#      known values (counts predicates, install positionals, first-steps copy).
#   5. fixture: --check detects drift (non-zero, naming the file); --write heals it.
#   6. fixture: absence-by-omission — a missing source (maturity.json) fails --write naming
#      the file (D36: a missing field is a build failure, never an empty cell).
#   7. fixture: npm family absent while packages/core is private; present with the version
#      once published ≥ 0.1.0 (§7: "absent until then"; no network in the renderer).
#
# Pure bash + the repo's own tsx deps; no network, no LLM (no-paid-llm-in-ci.md).
set -u
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)
cd "$REPO_ROOT" || exit 1

PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
GEN="scripts/render-face-facts.mjs"
TARGET="docs/site/face-facts.json"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# ── fixture: a minimal-but-complete repo skeleton every family reader accepts ────────────────
# Same posture as render-reference.test.sh's make_fixture: the generator is fail-closed on
# missing sources (D36), so the fixture carries a minimal parseable form of EACH source it
# reads. All generator runs happen from the repo root (npx resolves the repo's tsx); the
# fixture is passed via --root, never cd'd into.
make_fixture() {
  local FIX="$1"
  mkdir -p "$FIX/packages/core/manifest" "$FIX/packages/core/templates/shared" \
           "$FIX/packages/core/principles" "$FIX/docs/site/reference" \
           "$FIX/docs/meta-factory/research-patches" "$FIX/docs/superpowers/specs" \
           "$FIX/skills/getff/references"
  cat > "$FIX/packages/core/manifest/maturity.json" <<'EOF'
{
  "layers": { "rules": { "label": "beta", "definition": "def", "caveat": "cav", "verified-at": "2026-09-14" } },
  "stacks": { "ts-server": { "label": "beta", "definition": "def", "caveat": "cav", "generation": "generated", "verified-at": "2026-09-14" } }
}
EOF
  cat > "$FIX/setup" <<'EOF'
    ts-server|react-next|react-spa|react-native) STACK="$a" ;;
    python|cargo|go) STACK="$a" ;;
EOF
  cat > "$FIX/install.sh" <<'EOF'
LANE_TABLE='python|Python|pyproject.toml|
cargo|Rust/cargo|Cargo.toml|pyproject.toml
go|Go|go.mod|pyproject.toml Cargo.toml'
EOF
  cat > "$FIX/README.md" <<'EOF'
`./setup` is the orchestrator. Flags:

- `--yes` — skip prompts.
- `--dry-run` — write nothing.
EOF
  cat > "$FIX/packages/core/templates/shared/first-steps.source.json" <<'EOF'
{
  "schema": "getff.first-steps/v1",
  "renders": ["packages/core/templates/shared/AI-USAGE-GUIDE.md — AI render"],
  "sequences": { "core": { "goal": "install", "profileFlag": "-y", "steps": [ { "id": "install", "title": "Install", "action": "run setup", "evidence": "install.sh" } ] } }
}
EOF
  cat > "$FIX/docs/site/reference/B.json" <<'EOF'
{ "schemaVersion": 1, "family": "B", "familyName": "skills", "generator": "scripts/render-reference.mjs", "members": [ {}, {}, {} ] }
EOF
  : > "$FIX/packages/core/principles/01-x.test.ts"
  cat > "$FIX/docs/meta-factory/prior-art-evaluations.md" <<'EOF'
## 4. Entry table

| ID | Candidate |
|---:|---|
| 1 | Alpha |
| 2 | Beta |
EOF
  : > "$FIX/docs/meta-factory/research-patches/2026-01-01-x.md"
  : > "$FIX/docs/meta-factory/research-patches/README.md"
  : > "$FIX/docs/superpowers/specs/2026-01-01-spec.md"
  printf 'see https://arxiv.org/abs/2401.00001\n' > "$FIX/docs/note.md"
  printf 'cite https://arxiv.org/abs/2401.00001 and https://doi.org/10.1000/x\n' > "$FIX/skills/getff/references/x.md"
  printf '{ "name": "getff", "private": true, "version": "0.0.5" }\n' > "$FIX/packages/core/package.json"
}

# ── Arm 1: real repo — --check green; schema + all six families present ─────────────────────
out=$(npx tsx "$GEN" --check 2>&1); rc=$?
if [ $rc -eq 0 ]; then
  ok "arm 1: --check exits 0 on the committed face-facts.json"
else
  bad "arm 1: --check rc=$rc: $out"
fi
if [ -f "$TARGET" ] && node -e '
  const f = require("./docs/site/face-facts.json");
  const need = ["schema", "maturity", "installCommands", "firstSteps", "rosters", "counts", "enforcementOutcomes"];
  const missing = need.filter((k) => !(k in f));
  if (missing.length) { console.error("missing sections: " + missing.join(",")); process.exit(1); }
  if (f.schema !== "getff.face-facts/v1") { console.error("bad schema id"); process.exit(1); }
' 2>/dev/null; then
  ok "arm 1: face-facts.json carries schema + the six framework-computable families"
else
  bad "arm 1: face-facts.json missing, unparseable, or missing a family section"
fi

# ── Arm 2: real repo — maturity copied verbatim; rosters READ, never re-derived ─────────────
if node -e '
  const fs = require("fs");
  const f = require("./docs/site/face-facts.json");
  const m = JSON.parse(fs.readFileSync("packages/core/manifest/maturity.json", "utf8"));
  const deepEq = JSON.stringify(f.maturity.layers) === JSON.stringify(m.layers)
              && JSON.stringify(f.maturity.stacks) === JSON.stringify(m.stacks);
  if (!deepEq) { console.error("maturity section is not a verbatim copy of maturity.json"); process.exit(1); }
  const dir = "docs/site/reference";
  for (const e of fs.readdirSync(dir).filter((x) => /^[A-Z][0-9]*\.json$/.test(x))) {
    const fam = JSON.parse(fs.readFileSync(dir + "/" + e, "utf8"));
    const got = f.rosters.families[fam.family];
    if (!got || got.members !== fam.members.length) {
      console.error("rosters." + fam.family + " members " + (got && got.members) + " != " + fam.members.length);
      process.exit(1);
    }
  }
' 2>/dev/null; then
  ok "arm 2: maturity section verbatim; rosters member counts equal the family JSONs"
else
  bad "arm 2: maturity copy or rosters read drifted from its source"
fi

# ── Arm 3: real repo — enforcementOutcomes: 3 demo nodes × 4 backends, rendered|FFxxxx ──────
if node -e '
  const f = require("./docs/site/face-facts.json");
  const eo = f.enforcementOutcomes;
  const nodes = Object.keys(eo.nodes);
  if (nodes.length !== 3) { console.error("expected 3 demo nodes, got " + nodes.length); process.exit(1); }
  for (const n of nodes) {
    const backends = Object.keys(eo.nodes[n]);
    if (backends.length !== 4) { console.error(n + ": expected 4 backends, got " + backends.length); process.exit(1); }
    for (const b of backends) {
      if (!/^(rendered|FF[0-9]{4})$/.test(eo.nodes[n][b])) {
        console.error(n + "/" + b + ": bad outcome value " + eo.nodes[n][b]); process.exit(1);
      }
    }
  }
' 2>/dev/null; then
  ok "arm 3: enforcementOutcomes carries 3 demo nodes × 4 backends, values rendered|FFxxxx"
else
  bad "arm 3: enforcementOutcomes shape wrong or outcome values outside rendered|FFxxxx"
fi

# ── fixture arms ─────────────────────────────────────────────────────────────────────────────
FIX="$TMP/fixture"
make_fixture "$FIX"

# ── Arm 4: fixture --write derives every family with the fixture's exact known values ───────
out=$(npx tsx "$GEN" --write --root "$FIX" 2>&1); rc=$?
if [ $rc -eq 0 ]; then
  ok "arm 4: --write exits 0 on the fixture"
else
  bad "arm 4: --write rc=$rc: $out"
fi
if node -e '
  const f = require(process.argv[1]);
  const fail = (m) => { console.error(m); process.exit(1); };
  if (f.maturity.layers.rules.label !== "beta") fail("maturity not copied verbatim");
  const ic = f.installCommands;
  if (JSON.stringify(ic.stacks) !== JSON.stringify(["ts-server", "react-next", "react-spa", "react-native"])) fail("stacks parse wrong: " + JSON.stringify(ic.stacks));
  if (JSON.stringify(ic.lanes.map((l) => l.lane)) !== JSON.stringify(["python", "cargo", "go"])) fail("lanes parse wrong: " + JSON.stringify(ic.lanes));
  if (ic.lanes.find((l) => l.lane === "cargo").detect !== "Cargo.toml") fail("lane detect file wrong");
  if (JSON.stringify(ic.flags.map((x) => x.flag)) !== JSON.stringify(["--yes", "--dry-run"])) fail("flags parse wrong: " + JSON.stringify(ic.flags));
  if (f.firstSteps.sequences.core.steps[0].id !== "install") fail("first-steps not copied");
  if (f.rosters.families.B.members !== 3) fail("rosters count wrong: " + JSON.stringify(f.rosters.families.B));
  const c = f.counts;
  if (c.principles.count !== 1) fail("principles count " + c.principles.count);
  if (c.priorArtRows.count !== 2) fail("priorArtRows count " + c.priorArtRows.count);
  if (c.researchPatches.count !== 1) fail("researchPatches count " + c.researchPatches.count + " (README.md must be excluded)");
  if (c.specs.count !== 1) fail("specs count " + c.specs.count);
  if (c.academicSources.count !== 2) fail("academicSources count " + c.academicSources.count + " (2 unique: the duplicated arXiv URL must dedupe, the DOI adds one)");
  if ("npm" in f) fail("npm section must be absent while packages/core is private");
' "$FIX/docs/site/face-facts.json" 2>/dev/null; then
  ok "arm 4: every family derived with the fixture's exact values (counts, positionals, copy)"
else
  bad "arm 4: derived face-facts.json disagrees with the fixture's known values"
fi

# ── Arm 5: drift detected then healed ────────────────────────────────────────────────────────
sed -i 's/"count": 2/"count": 9/' "$FIX/docs/site/face-facts.json"
out=$(npx tsx "$GEN" --check --root "$FIX" 2>&1); rc=$?
if [ $rc -ne 0 ] && echo "$out" | grep -q "face-facts.json"; then
  ok "arm 5: --check detects drift, non-zero, naming the file"
else
  bad "arm 5: --check rc=$rc on a corrupted file: $out"
fi
npx tsx "$GEN" --write --root "$FIX" >/dev/null 2>&1
out=$(npx tsx "$GEN" --check --root "$FIX" 2>&1); rc=$?
if [ $rc -eq 0 ]; then
  ok "arm 5: --write heals the drift (exit 0 after)"
else
  bad "arm 5: --write did not heal the drift: $out"
fi

# ── Arm 6: absence-by-omission — missing source fails --write naming the file (D36) ─────────
mv "$FIX/packages/core/manifest/maturity.json" "$TMP/maturity.bak"
out=$(npx tsx "$GEN" --write --root "$FIX" 2>&1); rc=$?
if [ $rc -ne 0 ] && echo "$out" | grep -q "maturity.json"; then
  ok "arm 6: missing maturity.json fails --write naming the file (D36 build failure)"
else
  bad "arm 6: rc=$rc on a missing source (must fail naming it): $out"
fi
mv "$TMP/maturity.bak" "$FIX/packages/core/manifest/maturity.json"

# ── Arm 7: npm family absent while private; present with the version once ≥ 0.1.0 ───────────
printf '{ "name": "getff", "private": false, "version": "0.2.0" }\n' > "$FIX/packages/core/package.json"
out=$(npx tsx "$GEN" --write --root "$FIX" 2>&1); rc=$?
if [ $rc -eq 0 ] && node -e '
  const f = require(process.argv[1]);
  if (!f.npm || f.npm.version !== "0.2.0") { console.error("npm section wrong: " + JSON.stringify(f.npm)); process.exit(1); }
' "$FIX/docs/site/face-facts.json" 2>/dev/null; then
  ok "arm 7: published ≥0.1.0 → npm section present with the version; no network"
else
  bad "arm 7: rc=$rc / npm section missing or wrong after publishing: $out"
fi

echo
echo "render-face-facts.test.sh: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
