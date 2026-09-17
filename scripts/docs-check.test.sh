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
MARKDOWNLINT_BIN="${MARKDOWNLINT_BIN:-$(command -v markdownlint-cli2 || true)}"
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

echo "docs-check.test.sh: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
