#!/usr/bin/env bash
# Test: setup.d/companions.manifest parses as a TAB-delimited 5-field table (S3: stacks column added).
# Tab (not pipe) per kickoff §4 T-OCI-A: detect_cmd rows contain inner pipes,
# so -F'|' splitting contradicts the manifest's own rows.
# Fields: name<TAB>detect_cmd<TAB>install_cmd<TAB>kind<TAB>stacks
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
MANIFEST="$REPO_ROOT/setup.d/companions.manifest"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

[ -f "$MANIFEST" ] && ok "manifest exists" || bad "manifest missing"
# Every non-comment line has exactly 5 TAB-delimited fields (S3 schema: 5th = stacks)
awk -F'\t' '!/^#/ && NF && NF!=5 {bad=1} END{exit bad}' "$MANIFEST" && ok "all rows have 5 fields" || bad "a row does not have 5 fields"
# Superpowers row present (portable: GNU grep treats \t in -E pattern as literal 't')
awk -F'\t' '$1=="superpowers"{f=1} END{exit !f}' "$MANIFEST" && ok "superpowers row present" || bad "no superpowers row"
# ast-grep delivery pair present: CLI binary row (kind=cli) BEFORE the skill-plugin row (kind=cc-plugin)
# — the wrapper loop prompts in file order, and the skill is inert without the binary (SSOT #185).
awk -F'\t' '$1=="ast-grep-cli" && $4=="cli"{f=1} END{exit !f}' "$MANIFEST" && ok "ast-grep-cli row present (kind=cli)" || bad "no ast-grep-cli row with kind=cli"
awk -F'\t' '$1=="ast-grep" && $4=="cc-plugin"{f=1} END{exit !f}' "$MANIFEST" && ok "ast-grep skill row present (kind=cc-plugin)" || bad "no ast-grep skill row with kind=cc-plugin"
awk -F'\t' '$1=="ast-grep-cli"{cli=NR} $1=="ast-grep"{sk=NR} END{exit !(cli && sk && cli<sk)}' "$MANIFEST" && ok "ast-grep-cli row precedes ast-grep skill row" || bad "ast-grep-cli row does not precede ast-grep skill row"
# No version pins (no '@x.y.z' style) in install commands
grep -qE '@[0-9]+\.[0-9]+' "$MANIFEST" && bad "manifest pins a version" || ok "no version pin"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
