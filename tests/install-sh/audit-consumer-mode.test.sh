#!/usr/bin/env bash
# tests/install-sh/audit-consumer-mode.test.sh
#
# Paired positive/negative tests for audit-ai-docs.sh consumer-mode detection.
#
# Bug (2026-06-11): install.sh ships the audit to scripts/audit-ai-docs.sh on
# consumer projects, but D3/D5 hardcode authoring-repo paths (CLAUDE.md,
# .claude/session-bootstrap.md, …) that install.sh never ships — every fresh
# consumer install failed D3 (4× file-not-found) and D5 (the installed script
# itself carries the canonical phrase; the TEST_INFRA exemption only covers the
# authoring path). install.sh "Next steps: Run ./scripts/audit-ai-docs.sh —
# should PASS" was unsatisfiable.
#
# Fix under test: D3/D5 run only in the framework authoring repo (detected via
# presence of packages/core/audit-self/audit-ai-docs.sh relative to cwd); on
# consumer installs they pass as skipped. Authoring-repo behaviour must stay
# intact (missing docs / orphan files still FAIL there).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

SCRIPT="$REPO_ROOT/packages/core/audit-self/audit-ai-docs.sh"
# Extract the canonical phrase from the script under test instead of hardcoding
# it: keeps this file out of the D5 found-set in the authoring repo (no literal
# phrase here) and stays correct if the canon phrase is ever revised.
CANON_PHRASE=$(grep -m1 '^CANON_PHRASE=' "$SCRIPT" | cut -d'"' -f2)
[ -n "$CANON_PHRASE" ] || { echo "FATAL: could not extract CANON_PHRASE from $SCRIPT"; exit 1; }

# ── 1. consumer-shaped project (what install.sh produces): exit 0, D3/D5 skip ──
TMP=$(mktemp -d)
mkdir -p "$TMP/scripts"
cp "$SCRIPT" "$TMP/scripts/audit-ai-docs.sh"
out=$(cd "$TMP" && bash scripts/audit-ai-docs.sh 2>&1); rc=$?
[ "$rc" -eq 0 ] && ok "consumer install → exit 0" || bad "consumer install → exit $rc (expected 0)"
grep -q '^FAIL' <<<"$out" && bad "consumer install emitted FAIL lines" || ok "consumer install: no FAIL lines"
grep -q 'D3.*skipped: consumer install' <<<"$out" && ok "D3 skip message present" || bad "D3 skip message missing"
grep -q 'D5.*skipped: consumer install' <<<"$out" && ok "D5 skip message present" || bad "D5 skip message missing"
rm -rf "$TMP"

# ── 2. paired negative: consumer mode does NOT neuter the audit (D1 still fails) ──
TMP=$(mktemp -d)
mkdir -p "$TMP/scripts"
cp "$SCRIPT" "$TMP/scripts/audit-ai-docs.sh"
printf '# Agents\n\nUse skill `phantom-skill` for X.\n' > "$TMP/AGENTS.md"
out=$(cd "$TMP" && bash scripts/audit-ai-docs.sh 2>&1); rc=$?
[ "$rc" -eq 1 ] && ok "consumer + phantom skill → exit 1 (D1 still live)" || bad "consumer + phantom skill → exit $rc (expected 1)"
grep -q 'phantom-skill' <<<"$out" && ok "D1 violation names the phantom skill" || bad "D1 violation missing"
rm -rf "$TMP"

# ── 3. paired negative: authoring-shaped tree keeps failing on missing docs ──
TMP=$(mktemp -d)
mkdir -p "$TMP/packages/core/audit-self"
cp "$SCRIPT" "$TMP/packages/core/audit-self/audit-ai-docs.sh"
out=$(cd "$TMP" && bash packages/core/audit-self/audit-ai-docs.sh --only=D3 2>&1); rc=$?
[ "$rc" -eq 1 ] && ok "authoring shape, missing docs → D3 exit 1" || bad "authoring shape, missing docs → exit $rc (expected 1)"
grep -q 'file not found' <<<"$out" && ok "D3 reports file not found" || bad "D3 file-not-found detail missing"

# ── 4. paired negative: authoring-shaped tree keeps failing on D5 orphan ──
mkdir -p "$TMP/docs"
printf '%s\n' "$CANON_PHRASE" > "$TMP/docs/orphan.md"
out=$(cd "$TMP" && bash packages/core/audit-self/audit-ai-docs.sh --only=D5 2>&1); rc=$?
[ "$rc" -eq 1 ] && ok "authoring shape, orphan file → D5 exit 1" || bad "authoring shape, orphan file → exit $rc (expected 1)"
grep -q 'docs/orphan.md' <<<"$out" && ok "D5 names the orphan file" || bad "D5 orphan detail missing"
rm -rf "$TMP"

# ── 5. D6: the passport goal region (one-button w2 HO-4) ──
# The gate checks the CONSUMER's own marked region (getff:begin/end section=passport + the five
# sub-block headings), never getff's canonical phrase. A3 of the kickoff: a filled region exits 0;
# the region emptied while the shipped template still carries it exits ≠ 0. A pre-region passport
# (installed before the marked region existed — the template lacks it too) only WARNs: migration
# must not red-gate every pre-HO-5 consumer.
PASSPORT_BEGIN='<!-- getff:begin section=passport -->'
PASSPORT_END='<!-- getff:end section=passport -->'
_region_fixture() { # _region_fixture DESCRIPTION_CONTENT TEMPLATE_CONTENT
  TMP=$(mktemp -d)
  mkdir -p "$TMP/scripts" "$TMP/.ai-factory"
  cp "$SCRIPT" "$TMP/scripts/audit-ai-docs.sh"
  printf '# Proj\n' > "$TMP/README.md"
  printf '%s' "$1" > "$TMP/.ai-factory/DESCRIPTION.md"
  printf '%s' "$2" > "$TMP/.ai-factory/DESCRIPTION.template.md"
}
_filled_region="$PASSPORT_BEGIN
### Goal scope
What this is.
### Goal core
One sentence.
### Invariants
- Stable API.
### Never
- No new deps.
### Non-goals
- No offline mode.
$PASSPORT_END
"
_bare_region="$PASSPORT_BEGIN
$PASSPORT_END
"

# 5a: filled region → exit 0, D6 PASS
_region_fixture "$_filled_region" "$_bare_region"
out=$(cd "$TMP" && bash scripts/audit-ai-docs.sh 2>&1); rc=$?
[ "$rc" -eq 0 ] && ok "consumer + filled passport region → exit 0" || bad "consumer + filled passport region → exit $rc (expected 0)"
grep -q '^PASS: D6' <<<"$out" && ok "D6 PASS line present" || bad "D6 PASS line missing"
rm -rf "$TMP"

# 5b: region emptied while the shipped template still carries it → exit 1 (A3's ≠0 arm)
_region_fixture '# Proj

## Stack
- Runtime: node
' "$_bare_region"
out=$(cd "$TMP" && bash scripts/audit-ai-docs.sh 2>&1); rc=$?
[ "$rc" -eq 1 ] && ok "consumer + emptied passport region → exit 1" || bad "consumer + emptied passport region → exit $rc (expected 1)"
grep -q 'D6.*lost its marked goal region' <<<"$out" && ok "D6 failure names the lost region" || bad "D6 lost-region message missing"
rm -rf "$TMP"

# 5c: pre-region passport (the shipped template lacks the region too) → WARN, exit 0
_region_fixture '# Proj

## Stack
- Runtime: node
' 'pre-region template
'
out=$(cd "$TMP" && bash scripts/audit-ai-docs.sh 2>&1); rc=$?
[ "$rc" -eq 0 ] && ok "consumer + pre-region passport → exit 0 (WARN only)" || bad "consumer + pre-region passport → exit $rc (expected 0)"
grep -q 'D6.*pre-region passport' <<<"$out" && ok "pre-region WARN message present" || bad "pre-region WARN message missing"
rm -rf "$TMP"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
