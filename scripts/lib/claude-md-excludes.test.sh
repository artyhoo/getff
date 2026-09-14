#!/usr/bin/env bash
# Test for scripts/lib/claude-md-excludes.sh — the bash-channel SSOT for `claudeMdExcludes`.
#
# THE LEG THAT MATTERS is §4: the cross-grammar parity sweep. `scripts/lib/claude-md-excludes.sh`
# claims its bash `case` matcher is the exact translation of picomatch's `**/<name>` with
# {dot:true} — the grammar the shipped client and principle 34 both use. Until 2026-09-14 that
# claim lived only in a comment, and the claim next to it in the sibling meter
# (`scripts/measure-session-start-tokens.sh`, `grep -Fxq`) had been false for the entire life
# of the file: 0 of 8 entries matched, and the always-on token budget was overstated 2.37x.
# A claim of equivalence whose only reader is a human is `#hope-as-gate`
# (.claude/rules/attention-is-not-a-mechanism.md §2). This test executes it.
#
# Channel: the `alwayson-budget` job in .github/workflows/audit-self.yml, beside
# measure-always-on.test.sh and check-alwayson-budget.test.sh. Principle 41
# (shell-test-ci-coverage) gates that wiring — an unwired *.test.sh fails CI.
#
# spec: docs/superpowers/specs/2026-09-14-context-economy-self-enforcement-design.md §2
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$DIR/../.." && pwd)"
cd "$REPO_ROOT" || { echo "FAIL: cannot cd $REPO_ROOT"; exit 1; }

fails=0
ok()   { printf 'PASS: %s\n' "$1"; }
bad()  { printf 'FAIL: %s\n' "$1"; fails=$(( fails + 1 )); }

# shellcheck source=claude-md-excludes.sh
. "$DIR/claude-md-excludes.sh"

# ---------------------------------------------------------------------------
# §1 — the matcher, on the live form
# ---------------------------------------------------------------------------
m() { claude_md_excludes_match_one "$1" "$2"; }

# expect_match <path> <pattern> <label>; expect_no_match <path> <pattern> <label>
expect_match()    { if m "$1" "$2"; then ok "$3"; else bad "$3"; fi; }
expect_no_match() { if m "$1" "$2"; then bad "$3"; else ok "$3"; fi; }

expect_match    '.claude/rules/x.md'  '**/x.md' '**/x.md matches a nested path'
expect_match    'x.md'                '**/x.md' '**/x.md matches the root-level file'
expect_match    'a/b/c/x.md'          '**/x.md' '**/x.md matches an arbitrarily deep path'
expect_no_match '.claude/rules/xx.md' '**/x.md' '**/x.md does not match xx.md (no partial basename)'
expect_no_match 'x.md.bak'            '**/x.md' '**/x.md does not match x.md.bak'
expect_match    '.claude/rules/x.md'  '.claude/rules/x.md' 'literal form matches itself'
expect_no_match 'other/.claude/rules/x.md' '.claude/rules/x.md' 'literal form does not match by suffix'

# ---------------------------------------------------------------------------
# §2 — the contract is NARROW, and says so out loud
#
# Measured 2026-09-14: outside the two supported forms the bash `case` translation and
# picomatch genuinely diverge (`*.md` vs `other/y.md` — bash matches because its `*` crosses
# `/`, picomatch does not; `**/*.md` vs `a/x.md` — picomatch matches, bash does not). The lib
# must therefore REFUSE such an entry rather than guess, exactly as principle 31's
# resolveExcludeEntry errors on an ambiguous basename instead of taking a first match.
# ---------------------------------------------------------------------------
for e in '**/x.md' '.claude/rules/x.md' 'CLAUDE.md'; do
  if claude_md_excludes_entry_supported "$e"; then ok "supported form accepted: $e"
  else bad "should be supported: $e"; fi
done
for e in '**/*.md' '*.md' 'dir/**' '**/a/b.md' '**/x?.md' '**/x[12].md' ''; do
  if claude_md_excludes_entry_supported "$e"; then bad "unsupported form silently accepted: '$e'"
  else ok "unsupported form rejected: '${e:-<empty>}'"; fi
done

# ---------------------------------------------------------------------------
# §3 — load(): union + dedupe + loud refusal
# ---------------------------------------------------------------------------
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

printf '{"claudeMdExcludes":["**/a.md","**/b.md"]}\n'            > "$TMP/project.json"
printf '{"claudeMdExcludes":["**/b.md","**/c.md"]}\n'            > "$TMP/local.json"
printf '{"claudeMdExcludes":["**/a.md","dir/**"]}\n'             > "$TMP/bad.json"
printf '{"permissions":{"allow":[]}}\n'                          > "$TMP/nokey.json"

claude_md_excludes_load "$TMP/project.json" "$TMP/local.json"
if [[ "$(claude_md_excludes_count)" == "3" ]]; then
  ok 'union of project+local dedupes the shared entry (2+2 -> 3)'
else
  bad "union should hold 3 entries, got $(claude_md_excludes_count)"
fi
if [[ "$CLAUDE_MD_EXCLUDES_SOURCE" == "project+local" ]]; then
  ok 'overlay source reported as project+local'
else
  bad "overlay source should be project+local, got $CLAUDE_MD_EXCLUDES_SOURCE"
fi

claude_md_excludes_load "$TMP/project.json" "$TMP/nokey.json"
if [[ "$CLAUDE_MD_EXCLUDES_SOURCE" == "project" ]]; then
  ok 'a settings file without the key does not count as an overlay source'
else
  bad "overlay source should be project, got $CLAUDE_MD_EXCLUDES_SOURCE"
fi

if claude_md_excludes_load "$TMP/bad.json" "$TMP/nokey.json" 2>/dev/null; then
  bad 'load() accepted an unsupported entry form instead of refusing'
else
  ok 'load() refuses (non-zero) when an entry form cannot be matched faithfully'
fi

# ---------------------------------------------------------------------------
# §4 — CROSS-GRAMMAR PARITY (the load-bearing leg)
#
# The whole tracked tree x the whole committed exclude list, run through BOTH this bash
# matcher and packages/core's PINNED picomatch, asserting an identical hit set. picomatch is
# invoked with cwd=packages/core deliberately: SSOT prior-art-evaluations.md#238 pins it there
# and NOT at the root, and the root carries a different MAJOR (2.3.2 vs 4.0.5, measured
# 2026-09-14), so resolving it from the repo root would compare against the wrong matcher and
# the parity claim would be worthless.
# ---------------------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "SKIP: node unavailable — cross-grammar parity leg not run"
elif [[ ! -d "$REPO_ROOT/packages/core/node_modules/picomatch" ]]; then
  echo "SKIP: packages/core picomatch not installed — cross-grammar parity leg not run"
else
  claude_md_excludes_load "$REPO_ROOT/.claude/settings.json" "$REPO_ROOT/.claude/settings.local.json"
  printf '%s\n' ${CLAUDE_MD_EXCLUDES[@]+"${CLAUDE_MD_EXCLUDES[@]}"} > "$TMP/pats.txt"
  git ls-files > "$TMP/paths.txt"

  : > "$TMP/bash-hits.txt"
  while IFS= read -r pat; do
    [[ -n "$pat" ]] || continue
    while IFS= read -r f; do
      claude_md_excludes_match_one "$f" "$pat" && printf '%s\t%s\n' "$pat" "$f" >> "$TMP/bash-hits.txt"
    done < "$TMP/paths.txt"
  done < "$TMP/pats.txt"
  LC_ALL=C sort -o "$TMP/bash-hits.txt" "$TMP/bash-hits.txt"

  ( cd "$REPO_ROOT/packages/core" && node -e '
      const picomatch = require("picomatch");
      const { readFileSync } = require("node:fs");
      const [patFile, pathFile] = process.argv.slice(1);
      const pats  = readFileSync(patFile,  "utf8").split("\n").filter(Boolean);
      const paths = readFileSync(pathFile, "utf8").split("\n").filter(Boolean);
      for (const p of paths) for (const pat of pats)
        if (picomatch.isMatch(p, pat, { dot: true })) process.stdout.write(pat + "\t" + p + "\n");
    ' "$TMP/pats.txt" "$TMP/paths.txt" ) | LC_ALL=C sort > "$TMP/pm-hits.txt"

  n_paths=$(wc -l < "$TMP/paths.txt" | tr -d ' ')
  n_pats=$(wc -l < "$TMP/pats.txt" | tr -d ' ')
  n_bash=$(wc -l < "$TMP/bash-hits.txt" | tr -d ' ')
  n_pm=$(wc -l < "$TMP/pm-hits.txt" | tr -d ' ')

  # A parity run where NEITHER grammar matched anything proves nothing — that is exactly the
  # shape of the defect this file exists to catch (the dead `grep -Fxq` matched 0 of 8 and
  # would have "agreed" with a broken picomatch call). Demand a non-empty hit set first.
  if [[ "$n_pm" -eq 0 ]]; then
    bad "parity leg is vacuous: picomatch matched 0 of $n_pats entries over $n_paths files"
  elif diff "$TMP/pm-hits.txt" "$TMP/bash-hits.txt" >/dev/null; then
    ok "cross-grammar parity: identical $n_pm hits over $n_paths tracked files x $n_pats entries"
  else
    bad "cross-grammar parity BROKEN (bash $n_bash hits, picomatch $n_pm hits):"
    diff "$TMP/pm-hits.txt" "$TMP/bash-hits.txt" | head -20
  fi
fi

# ---------------------------------------------------------------------------
# §5 — matching_files() resolves a glob to real files
#
# The Section B half of the 2026-09-14 defect: the meter stat-ed the ENTRY (`[[ -f <glob> ]]`),
# which can never be true, and printed "file absent" for all eight live excludes.
# ---------------------------------------------------------------------------
hits=$(claude_md_excludes_matching_files '**/00-rule-index.md' \
        '.claude/rules/00-rule-index.md' 'docs/other.md')
if [[ "$hits" == ".claude/rules/00-rule-index.md" ]]; then
  ok 'matching_files resolves an entry to the file it matches'
else
  bad "matching_files returned '$hits'"
fi

if [[ "$fails" -eq 0 ]]; then
  echo "ALL PASS (scripts/lib/claude-md-excludes.sh)"
  exit 0
fi
echo "FAILURES: $fails"
exit 1
