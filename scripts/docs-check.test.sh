#!/usr/bin/env bash
# docs-check.test.sh — acceptance arms for scripts/docs-check.mjs (getff-ai-site S0q).
#
# Live-fire, never a source grep: every arm RUNS the real checker (plain node — ESM, no repo
# imports) against either the real repo or a throwaway mktemp fixture root seeded from
# tests/docs-check/fixtures/pages/, and asserts output + exit codes. Arms:
#   1. D-Q12 escape grammar, pure arms (no binaries needed): the 19/20-char reason boundary,
#      a missing reason, an unclosed pair, the MDX comment twin, fenced-example immunity.
#   2. D-Q17 scope seam, pure arms: path classification per profile, the gold exemption.
#   3. vacuity guard: --profile pages on a root with no pages fails naming the vacuity.
#   4. paired negative, leak inverse: the same prose file passes under its own profile and
#      REDs when --profile pages forces it through the page gate.
#   5. fixture seeded-defect catalog (needs vale+lychee+markdownlint): each of the five bulk
#      kinds carries exactly its six seeded errors, the clean page carries zero.
#   6. real repo, both severities (needs bins): lenient and strict full runs exit 0 with no
#      tool skips — the shipped tree passes its own gate, and the D-Q17 populations are live.
#   7. prose-profile paired negative (RED unconditional; healed GREEN needs bins).
#   8. --changed live-fire (needs bins + git): the pre-commit channel over a throwaway repo.
#   9. R19 mermaid renderability (pure, no bins): the canonical allow-list module REDs the
#      silent-loss class (unknown header / click / subgraph / garbage / unterminated / empty),
#      ACCEPTs the six supported types and the repo's live fences, reports ABSOLUTE markdown
#      line numbers, and the real checker REDs+GREENs a fixture page through --root. Plus the
#      sources-presence paired negative on checkFrontmatter (D-Q18's mapping input — never
#      exempt, pages profile).
#
# Tool binaries resolve exactly as the checker resolves them: VALE_BIN / LYCHEE_BIN /
# MARKDOWNLINT_BIN env or PATH. Missing binaries SKIP their arms LOUDLY — the audit-self.yml
# docs-quality job live-fires those arms in CI. Pure bash + plain node; no network, no LLM
# (no-paid-llm-in-ci.md).
set -u
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)
cd "$REPO_ROOT" || exit 1

PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
GEN="scripts/docs-check.mjs"
FIXPAGES="tests/docs-check/fixtures/pages"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

VALE_BIN="${VALE_BIN:-$(command -v vale || true)}"
LYCHEE_BIN="${LYCHEE_BIN:-$(command -v lychee || true)}"
# markdownlint-cli2 resolves EXACTLY as the checker resolves it (docs-check.mjs header:
# `MARKDOWNLINT_BIN > npx --no-install markdownlint-cli2`): the devDep's bin sits in
# node_modules/.bin, which `command -v` misses on a CI runner that installed the
# workspace but never put it on PATH — the divergence made the harness SKIP its
# live-fire arms in the very job that exists to run them (vacuous-green inversion
# fired, correctly). Env override still wins; PATH second; the workspace bin third.
MARKDOWNLINT_BIN="${MARKDOWNLINT_BIN:-$(command -v markdownlint-cli2 || true)}"
if [ -z "$MARKDOWNLINT_BIN" ] && [ -x "$REPO_ROOT/node_modules/.bin/markdownlint-cli2" ]; then
  MARKDOWNLINT_BIN="$REPO_ROOT/node_modules/.bin/markdownlint-cli2"
fi
[ -n "$VALE_BIN" ] && export VALE_BIN
[ -n "$LYCHEE_BIN" ] && export LYCHEE_BIN
[ -n "$MARKDOWNLINT_BIN" ] && export MARKDOWNLINT_BIN
have_bins() { [ -n "$VALE_BIN" ] && [ -n "$LYCHEE_BIN" ] && [ -n "$MARKDOWNLINT_BIN" ]; }
bins_note() {
  echo "  ⚠ arms $1 SKIPPED: missing $( [ -z "$VALE_BIN" ] && printf 'vale ' ; [ -z "$LYCHEE_BIN" ] && printf 'lychee ' ; [ -z "$MARKDOWNLINT_BIN" ] && printf 'markdownlint-cli2' )."
  echo "    Set VALE_BIN / LYCHEE_BIN / MARKDOWNLINT_BIN to run them locally;"
  echo "    the audit-self.yml docs-quality job live-fires them in CI."
}

# fixture root: real checker config (vale profile + markdownlint config) + the fixture pages,
# placed at docs/site/ so D-Q17 classifies them as the pages population by path.
make_docs_root() {
  local root="$1"
  mkdir -p "$root/docs/site" "$root/docs/site-quality"
  cp "$REPO_ROOT/.markdownlint.json" "$root/"
  cp -r "$REPO_ROOT/docs/site-quality/vale" "$root/docs/site-quality/vale"
  cp "$REPO_ROOT"/$FIXPAGES/*.md "$root/docs/site/"
}

# ── Arm 1 + 2: pure gates (escape grammar, scope seam) — no binaries needed ───────────────────
cat >"$TMP/pure-arms.mjs" <<EOF
import { checkEscapes, classifyPath } from '$REPO_ROOT/scripts/docs-check.mjs';
let bad = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got); const w = JSON.stringify(want);
  if (g === w) console.log('OK ' + name); else { bad++; console.log('NO ' + name + ' got=' + g + ' want=' + w); }
};
const r19 = 'r'.repeat(19);
const r20 = 'r'.repeat(20);
eq('arm 1: a 19-char vale-reason REDs (D-Q12 floor is 20)',
  checkEscapes('<!-- vale off -->\n<!-- vale-reason: ' + r19 + ' -->\n<!-- vale on -->\n').length, 1);
eq('arm 1: a 20-char vale-reason passes',
  checkEscapes('<!-- vale off -->\n<!-- vale-reason: ' + r20 + ' -->\n<!-- vale on -->\n').length, 0);
eq('arm 1: vale off with no reason comment REDs',
  checkEscapes('<!-- vale off -->\nplain prose line\n<!-- vale on -->\n').length, 1);
eq('arm 1: an unclosed vale off REDs as escape-pairing',
  checkEscapes('<!-- vale off -->\nplain prose line\n').map((e) => e.rule),
  ['docs-check.escape-reason', 'docs-check.escape-pairing']);
eq('arm 1: the MDX comment twin is checked by the same grammar',
  checkEscapes('{/* vale off */}\n{/* vale-reason: ' + r19 + ' */}\n{/* vale on */}\n').length, 1);
eq('arm 1: a fenced example is prose ABOUT the grammar, immune',
  checkEscapes('\`\`\`md\n<!-- vale off -->\nno reason line\n\`\`\`\n').length, 0);
eq('arm 2: docs/site markdown is the pages population', classifyPath('docs/site/terms.md'), 'pages');
eq('arm 2: docs/site mdx at depth is the pages population', classifyPath('docs/site/guide/x.mdx'), 'pages');
eq('arm 2: the docs-author skill is the prose population', classifyPath('.claude/skills/docs-author/SKILL.md'), 'prose');
eq('arm 2: references/gold is exempt from both profiles', classifyPath('.claude/skills/docs-author/references/gold/page.md'), null);
eq('arm 2: the form auditor is the prose population', classifyPath('agents/docs-form-auditor.md'), 'prose');
eq('arm 2: the calibration record is the prose population', classifyPath('docs/site-quality/calibration.md'), 'prose');
eq('arm 2: repo prose outside both profiles is skipped', classifyPath('README.md'), null);
process.exit(bad > 0 ? 1 : 0);
EOF
if node "$TMP/pure-arms.mjs" >"$TMP/pure.out" 2>&1; then
  while IFS= read -r line; do ok "${line#OK }"; done <"$TMP/pure.out"
else
  bad "arms 1+2: pure gates failed:"
  sed 's/^/      /' "$TMP/pure.out"
fi

# ── Arm 3: vacuity guard ───────────────────────────────────────────────────────────────────────
mkdir -p "$TMP/vacuous"
out=$(node "$GEN" --profile pages --root "$TMP/vacuous" 2>&1); rc=$?
if [ $rc -ne 0 ] && echo "$out" | grep -q 'vacuous'; then
  ok "arm 3: --profile pages on an empty root fails naming the vacuity"
else
  bad "arm 3: rc=$rc (out: $(echo "$out" | head -2 | tr '\n' ' '))"
fi

# ── Arm 4: leak inverse — a prose file under its own profile vs the forced page gate ──────────
out=$(node "$GEN" --json docs/site-quality/calibration.md 2>/dev/null); rc=$?
if [ $rc -eq 0 ]; then
  ok "arm 4: the calibration record passes under its own prose profile"
else
  bad "arm 4: prose-profile run on calibration.md rc=$rc"
fi
out=$(node "$GEN" --profile pages --json docs/site-quality/calibration.md 2>/dev/null); rc=$?
if [ $rc -ne 0 ] && echo "$out" | grep -q 'docs/site-quality/calibration.md'; then
  ok "arm 4: the same file forced through the page gate REDs (a title/kind/sources error here is the leak the seam catches)"
else
  bad "arm 4: forced pages-profile run on calibration.md rc=$rc (leak seam did not fire)"
fi

# ── Arm 5: the fixture seeded-defect catalog (needs all three binaries) ────────────────────────
cat >"$TMP/catalog-check.mjs" <<EOF
import { readFileSync } from 'node:fs';
const j = JSON.parse(readFileSync(process.argv[2], 'utf8'));
let bad = 0;
const assert = (name, cond, detail = '') => {
  if (cond) console.log('OK ' + name); else { bad++; console.log('NO ' + name + ' :: ' + detail); }
};
const WANT = ['docs-check.frontmatter', 'docs-check.escape-reason', 'docs-check.skeleton', 'Vale.Spelling', 'getff.Names', 'lychee'].sort();
const files = ['guide', 'reference-sheet', 'family-overview', 'learn-tutorial', 'understand']
  .map((k) => 'docs/site/' + k + '-defects.md').concat(['docs/site/clean-guide.md']);
assert('catalog: pages population is exactly the six fixture pages',
  j.populations.pages.length === 6 && j.populations.prose.length === 0, JSON.stringify(j.populations));
assert('catalog: no tool skips (every binary was live)', j.skips.length === 0, JSON.stringify(j.skips));
for (const f of files) {
  const got = (j.errors || []).filter((e) => e.file === f).map((e) => e.rule).sort();
  if (f.endsWith('clean-guide.md')) {
    assert('catalog: the bootstrap-clean page carries zero errors', got.length === 0, JSON.stringify(got));
  } else {
    assert('catalog: ' + f + ' carries exactly its six seeded rules',
      JSON.stringify(got) === JSON.stringify(WANT), JSON.stringify(got));
  }
}
assert('catalog: no error lands outside the fixture pages',
  (j.errors || []).every((e) => files.includes(e.file)),
  JSON.stringify([...new Set((j.errors || []).map((e) => e.file))]));
process.exit(bad > 0 ? 1 : 0);
EOF
if have_bins; then
  make_docs_root "$TMP/catalog"
  node "$GEN" --strict --json --root "$TMP/catalog" >"$TMP/catalog.json" 2>"$TMP/catalog.err"; rc=$?
  if [ $rc -eq 1 ]; then
    ok "arm 5: the seeded catalog run exits 1 (a gate that never went RED is a claim)"
  else
    bad "arm 5: expected rc=1 on the seeded catalog, got $rc ($(head -2 "$TMP/catalog.err" | tr '\n' ' '))"
  fi
  if node "$TMP/catalog-check.mjs" "$TMP/catalog.json" >"$TMP/catalog.chk" 2>&1; then
    while IFS= read -r line; do ok "${line#OK }"; done <"$TMP/catalog.chk"
  else
    bad "arm 5: catalog assertions failed (checker stderr: $(head -2 "$TMP/catalog.err" | tr '\n' ' ')):"
    sed 's/^/      /' "$TMP/catalog.chk"
  fi
else
  bins_note "5"
fi

# ── Arm 6: the real repo passes its own gate, lenient and strict ───────────────────────────────
if have_bins; then
  out=$(node "$GEN" 2>&1); rc=$?
  if [ $rc -eq 0 ] && echo "$out" | grep -q 'docs-check: PASS'; then
    ok "arm 6: real repo, lenient full run exits 0"
  else
    bad "arm 6: lenient full run rc=$rc (out: $(echo "$out" | grep '✗' | head -3 | tr '\n' ' '))"
  fi
  out=$(node "$GEN" --strict 2>&1); rc=$?
  if [ $rc -eq 0 ] && echo "$out" | grep -q 'severity strict' && ! echo "$out" | grep -q 'SKIP'; then
    ok "arm 6: real repo, strict full run exits 0 with no tool skipped"
  else
    bad "arm 6: strict full run rc=$rc (out: $(echo "$out" | grep -E '✗|SKIP' | head -3 | tr '\n' ' '))"
  fi
  node "$GEN" --json >"$TMP/real.json" 2>/dev/null
  if node -e '
    const j = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
    const bad = !j.populations.pages.includes("docs/site/terms.md")
      || !j.populations.prose.includes("docs/site-quality/calibration.md")
      || j.errors.length !== 0;
    process.exit(bad ? 1 : 0);
  ' "$TMP/real.json"; then
    ok "arm 6: D-Q17 populations are live on the real tree (terms.md in pages, calibration.md in prose, zero errors)"
  else
    bad "arm 6: real-repo populations/errors not as declared ($(node -e 'const j=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")); console.log(JSON.stringify({pages:j.populations.pages,prose:j.populations.prose,errs:j.errors.length}))' "$TMP/real.json"))"
  fi
else
  bins_note "6"
fi

# ── Arm 7: prose-profile paired negative on a scratch root ─────────────────────────────────────
make_prose_root() {
  local root="$1"
  mkdir -p "$root/docs/site-quality"
  cp "$REPO_ROOT/.markdownlint.json" "$root/"
  cp -r "$REPO_ROOT/docs/site-quality/vale" "$root/docs/site-quality/vale"
  cp "$REPO_ROOT/docs/site-quality/calibration.md" "$root/docs/site-quality/calibration.md"
  printf '\n<!-- vale off -->\nThis escape has no reason and the word zorblify sits here.\n<!-- vale on -->\n' >>"$root/docs/site-quality/calibration.md"
}
make_prose_root "$TMP/prose"
out=$(node "$GEN" --json --root "$TMP/prose" 2>/dev/null); rc=$?
if [ $rc -ne 0 ] && echo "$out" | grep -q 'docs-check.escape-reason'; then
  ok "arm 7: the prose profile REDs on an unreasoned vale off (escape gate covers prose, not just pages)"
else
  bad "arm 7: prose-root RED run rc=$rc (out: $(echo "$out" | grep '✗' | head -2 | tr '\n' ' '))"
fi
if have_bins; then
  sed -i '/vale off/d;/vale on/d;/zorblify/d' "$TMP/prose/docs/site-quality/calibration.md"
  out=$(node "$GEN" --strict --json --root "$TMP/prose" 2>/dev/null); rc=$?
  if [ $rc -eq 0 ] && ! echo "$out" | grep -q '"tool": "docs-check".*skips'; then
    ok "arm 7: the healed prose root goes GREEN under strict with no tool skipped"
  else
    bad "arm 7: healed prose root rc=$rc (out: $(echo "$out" | grep -E '✗|docs-check.tool' | head -2 | tr '\n' ' '))"
  fi
else
  bins_note "7b"
fi

# ── Arm 8: --changed live-fire over a throwaway git repo (the pre-commit channel) ──────────────
if have_bins; then
  root="$TMP/changed"
  make_docs_root "$root"
  git -C "$root" init -q
  git -C "$root" config user.email test@example.com
  git -C "$root" config user.name test
  git -C "$root" add -A
  git -C "$root" commit -qm init
  cp "$REPO_ROOT/$FIXPAGES/clean-guide.md" "$root/docs/site/fresh-clean.md"
  git -C "$root" add docs/site/fresh-clean.md
  node "$GEN" --changed --strict --json --root "$root" >"$TMP/changed.json" 2>"$TMP/changed.err"; rc=$?
  if [ $rc -eq 0 ] && grep -q '"docs/site/fresh-clean.md"' "$TMP/changed.json"; then
    ok "arm 8: --changed PASSes a staged clean page AND the JSON names it in the pages population (the gate ran, not nothing)"
  else
    bad "arm 8: --changed on a staged clean page rc=$rc ($(head -2 "$TMP/changed.err" | tr '\n' ' '))"
  fi
  cp "$REPO_ROOT/$FIXPAGES/guide-defects.md" "$root/docs/site/fresh-defect.md"
  git -C "$root" add docs/site/fresh-defect.md
  node "$GEN" --changed --strict --json --root "$root" >"$TMP/changed2.json" 2>/dev/null; rc=$?
  if [ $rc -ne 0 ] && grep -q '"docs/site/fresh-defect.md"' "$TMP/changed2.json"; then
    ok "arm 8: --changed REDs on the staged defect page, naming it"
  else
    bad "arm 8: --changed on a staged defect page rc=$rc (paired negative missing)"
  fi
else
  bins_note "8"
fi

# ── Arm 9: R19 mermaid renderability + the sources-presence paired negative (pure — no bins) ───
cat >"$TMP/mermaid-arms.mjs" <<EOF
import { readFileSync } from 'node:fs';
import { validateMermaidFence, extractMermaidFences, validateMarkdownMermaid } from '$REPO_ROOT/scripts/lib/mermaid-allowlist.mjs';
import { checkFrontmatter } from '$REPO_ROOT/scripts/docs-check.mjs';
let bad = 0;
const assert = (name, cond, detail = '') => {
  if (cond) console.log('OK ' + name); else { bad++; console.log('NO ' + name + ' :: ' + detail); }
};
const rules = (md) => validateMarkdownMermaid(md).map((e) => e.rule);
const fence = (body) => '\`\`\`mermaid\n' + body + '\n\`\`\`\n';
assert('arm 9: an unknown diagram header REDs as mermaid.allowlist.type',
  rules(fence('mindmap\n  root((A))\n')).includes('mermaid.allowlist.type'),
  JSON.stringify(rules(fence('mindmap\n  root((A))\n'))));
assert('arm 9: a click directive REDs as silent-loss (the renderer drops it silently, R6 BU-3)',
  rules(fence('flowchart LR\n  A --> B\n  click A call alert()\n')).includes('mermaid.allowlist.silent-loss'));
assert('arm 9: a subgraph REDs as silent-loss',
  rules(fence('flowchart LR\n  subgraph X\n  A --> B\n  end\n')).includes('mermaid.allowlist.silent-loss'));
assert('arm 9: a garbage statement REDs as mermaid.allowlist.statement',
  rules(fence('flowchart LR\n  A --> %%% nonsense\n')).includes('mermaid.allowlist.statement'));
assert('arm 9: a style line REDs as silent-loss (use classDef + class)',
  rules(fence('flowchart LR\n  A[Go]\n  style A fill:#f9f\n')).includes('mermaid.allowlist.silent-loss'));
assert('arm 9: an unterminated fence REDs as mermaid.allowlist.unterminated',
  rules('\`\`\`mermaid\nflowchart LR\n  A --> B\n').includes('mermaid.allowlist.unterminated'));
assert('arm 9: an empty fence REDs as mermaid.allowlist.empty',
  rules(fence('')).includes('mermaid.allowlist.empty'));
assert('arm 9: a par/and control block REDs as silent-loss, not a bare statement miss',
  rules(fence('sequenceDiagram\n  A->>B: hi\n  par one\n    A->>B: x\n  and two\n    A->>B: y\n  end\n')).filter((r) => r === 'mermaid.allowlist.silent-loss').length >= 2);
const SIX = [
  'flowchart LR\n  A[Beta · test] -->|tag| B\n  C -- labeled --> D\n  D -. dotted .-> E\n  classDef ok fill:#fde68a,stroke:#92400e\n  class A ok',
  'stateDiagram-v2\n  [*] --> s1\n  s1 --> [*]: done\n  state "Named" as s2',
  'sequenceDiagram\n  participant IR as Convention IR\n  IR->>R: rules\n  R-->>IR: drift → RED',
  'classDiagram\n  class Animal\n  Animal : +int age\n  Animal <|-- Dog',
  'erDiagram\n  CUSTOMER {\n    string name PK\n  }\n  CUSTOMER ||--o{ ORDER : places',
  'xychart-beta\n  title "t"\n  x-axis [a, b, c]\n  y-axis "n" 0 --> 10\n  bar [1, 2, 3]',
];
assert('arm 9: all six supported types ACCEPT (an allow-list that accepts nothing REDs the site)',
  SIX.every((body) => validateMermaidFence(body).length === 0),
  JSON.stringify(SIX.map((b) => validateMermaidFence(b))));
// CommonMark fence variants must not skip the allow-list (harvest review 2026-09-21): a longer
// fence, a capitalised info string and an info string with attributes are all mermaid fences.
const BAD = 'flowchart LR\n  A --> B\n  click A call alert()\n';
for (const [open, close] of [['\`\`\`\`mermaid', '\`\`\`\`'], ['\`\`\`Mermaid', '\`\`\`'], ['\`\`\`mermaid title="x"', '\`\`\`'], ['~~~mermaid', '~~~']]) {
  const got = rules('x\n' + open + '\n' + BAD + close + '\n');
  assert('arm 9: a silent-loss construct REDs inside a ' + open + ' fence too', got.includes('mermaid.allowlist.silent-loss'), JSON.stringify(got));
}
assert('arm 9: a shorter inner run does not close a 4-backtick fence (the click line stays inside)',
  rules('\`\`\`\`mermaid\nflowchart LR\n  A --> B\n\`\`\`\n  click A call alert()\n\`\`\`\`\n').includes('mermaid.allowlist.silent-loss'),
  'inner fence run closed the fence early');
const live = readFileSync('$REPO_ROOT/docs/site/how-it-works.md', 'utf8');
assert('arm 9: the repo live fences (how-it-works.md, 3 fences) ACCEPT',
  extractMermaidFences(live).length === 3 && validateMarkdownMermaid(live).length === 0,
  'fences=' + extractMermaidFences(live).length + ' findings=' + JSON.stringify(validateMarkdownMermaid(live)));
const padded = 'intro line\n\n' + fence('flowchart LR\n  A --> %%% nope\n');
const paddedErr = validateMarkdownMermaid(padded)[0];
assert('arm 9: findings carry ABSOLUTE markdown line numbers (fence offset + in-fence line)',
  paddedErr && paddedErr.line === 5, JSON.stringify(paddedErr));
const noSources = checkFrontmatter({ title: 't', description: 'd', kind: 'guide' }, 'docs/site/x.md');
assert('arm 9: sources: missing REDs unconditionally (D26 refresh mapping input — never exempt)',
  noSources.some((e) => e.rule === 'docs-check.frontmatter' && e.message.includes('\`sources:\` missing')),
  JSON.stringify(noSources));
const withSources = checkFrontmatter({ title: 't', description: 'd', kind: 'guide', sources: ['setup.d/x.sh'] }, 'docs/site/x.md');
assert('arm 9: sources: present passes the frontmatter gate on an otherwise-complete page',
  !withSources.some((e) => e.message.includes('\`sources:\`')), JSON.stringify(withSources));
process.exit(bad > 0 ? 1 : 0);
EOF
if node "$TMP/mermaid-arms.mjs" >"$TMP/mermaid.out" 2>&1; then
  while IFS= read -r line; do ok "${line#OK }"; done <"$TMP/mermaid.out"
else
  bad "arm 9: R19 mermaid + sources pure arms failed:"
  sed 's/^/      /' "$TMP/mermaid.out"
fi

# arm 9b: the real checker REDs + GREENs a fixture page through --root (the seam, not just the module)
make_mermaid_root() {
  local root="$1"; local fence_body="$2"
  mkdir -p "$root/docs/site"
  cp "$REPO_ROOT/.markdownlint.json" "$root/"
  node -e '
    const fs = require("node:fs");
    // `node -e` puts every extra arg at argv[1..]; take all three from slice(1).
    const [root, body, src] = process.argv.slice(1);
    // clean-guide.md links to sibling fixture pages that are NOT copied into this root;
    // unlink them to plain text so an installed lychee (CI pins one) does not RED the
    // GREEN run on a missing target that has nothing to do with the mermaid gate.
    let page = fs.readFileSync(src, "utf8").replace(/\[([^\]]*)\]\(\.\/[^)]+\)/g, "$1");
    page += "\n```mermaid\n" + body + "\n```\n";
    fs.writeFileSync(root + "/docs/site/mermaid-page.md", page);
  ' "$root" "$fence_body" "$REPO_ROOT/$FIXPAGES/clean-guide.md"
}
make_mermaid_root "$TMP/m-red" 'flowchart LR
  A --> B
  click A call alert()'
out=$(node "$GEN" --json --root "$TMP/m-red" --profile pages 2>/dev/null); rc=$?
if [ $rc -ne 0 ] && echo "$out" | grep -q 'mermaid.allowlist'; then
  ok "arm 9b: the real checker REDs a page carrying a click directive (exit $rc, rule named)"
else
  bad "arm 9b: fixture RED run rc=$rc — the mermaid gate did not fire through docs-check"
fi
make_mermaid_root "$TMP/m-green" 'flowchart LR
  A --> B
  B --> C'
out=$(node "$GEN" --json --root "$TMP/m-green" --profile pages 2>/dev/null); rc=$?
if [ $rc -eq 0 ] && echo "$out" | grep -q '"docs/site/mermaid-page.md"'; then
  ok "arm 9b: the same page with an allow-listed fence passes the full page gate"
else
  bad "arm 9b: fixture GREEN run rc=$rc (out: $(echo "$out" | grep '✗' | head -3 | tr '\n' ' '))"
fi

echo "docs-check.test.sh: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
