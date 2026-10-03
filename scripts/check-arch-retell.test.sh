#!/usr/bin/env bash
# check-arch-retell.test.sh — paired positive/negative fixtures for
# scripts/check-arch-retell.mjs (the /arch consensus-retell provenance gate).
#
# Arms:
#   N1-N5  the gate stays QUIET: a well-formed retell (operator quote, P-number, register row,
#          blanket register row, combined sources), a spec without a retell section, a Baseline
#          naming a real commit, a table whose columns are in a different order, the template
#          quoted inside a code fence, an escaped pipe in a quote, a bold Baseline label with a
#          padded table, an unreachable Baseline the index does not add (--staged)
#   P1-P10 the gate FIRES: no Source column, an empty Source cell, `author` in the confirmed table,
#          an unrecognised source, an empty operator quote, a P-number the spec never defines, a
#          register row the spec never defines, a missing Baseline line, a Baseline that is not a
#          commit, a missing «Unconfirmed» subsection
#   P11-P16 id boundaries (a prose word is not a register row, P1 does not record P10), every
#          retell section checked and none counts as a register, a header-only table, a second
#          table in the section
#   S1     --staged (pre-commit) resolves a Baseline only when the index adds that line
#   R1-R2  CLI contract: exit 1 on findings, 0 when clean; with no args it scans the real spec
#          corpus (holds no retell section yet — R1 is a smoke test until one lands)
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHECK="$REPO_ROOT/scripts/check-arch-retell.mjs"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
n=0
HEAD_SHA=$(git -C "$REPO_ROOT" rev-parse HEAD)

# The registers a retell may cite — present outside the retell section in every fixture.
REGISTERS='# Spec

This is a design; prose may mention P10 without recording it.

## Operator-premise register

| P | Premise |
|---|---|
| P1 | one button |
| P2 | no questions before install |

## Decision register

| Decision | Status | Resolution | Falsifier |
|---|---|---|---|
| D4 | answered | a question round before install | — |
'

GOOD_TABLE='| # | Claim | Source |
|---|---|---|
| 1 | Install needs one button | operator «one button, that is all» |
| 2 | Nothing asks before install | P2 |
| 3 | A question round runs first | register D4 (blanket) |
| 4 | One button, no pre-install ask | P1 + P2 |'

UNCONFIRMED='### Unconfirmed — author derivations

- retry-then-remove on a failed install (source: author)'

# fixture <label> <want: quiet | fire:<ERE the finding must match>> <retell section body> [whole-file override] [flag]
# A fire arm needs exit 1 AND its own finding, so a crashed checker (also exit 1) cannot pass it.
fixture() {
  local label="$1" want="$2" body="$3" whole="${4-}" flag="${5-}" f out rc
  n=$((n+1)); f="$TMP/s$n.md"
  if [ -n "$whole" ]; then printf '%s\n' "$whole" > "$f"
  else printf '%s\n## Consensus retell\n\n%s\n' "$REGISTERS" "$body" > "$f"; fi
  out=$(cd "$REPO_ROOT" && node "$CHECK" ${flag:+"$flag"} "$f" 2>&1) && rc=0 || rc=$?
  if [ "$want" = quiet ] && [ "$rc" = 0 ]; then ok "$label"
  elif [ "$want" != quiet ] && [ "$rc" = 1 ] && grep -qE "❌ .*${want#fire:}" <<<"$out"; then ok "$label"
  else bad "$label — want $want, rc=$rc: $(tr '\n' '|' <<<"$out")"; fi
}

echo "── stays quiet"
fixture "N1 well-formed retell, Baseline none" quiet "Baseline: none — first retell

$GOOD_TABLE

$UNCONFIRMED"
fixture "N2 spec without a retell section" quiet "" "$REGISTERS"
fixture "N3 Baseline names a real commit, --resolve" quiet "Baseline: $HEAD_SHA

$GOOD_TABLE

$UNCONFIRMED" "" --resolve
fixture "N4 Source column not last" quiet "Baseline: none — first retell

| # | Source | Claim |
|---|---|---|
| 1 | P1 | Install needs one button |

$UNCONFIRMED"

fixture "N5 the template quoted inside a code fence" quiet "" "$REGISTERS
\`\`\`markdown
## Consensus retell

| # | Claim | Source |
|---|---|---|
| 1 | <claim> | author |
\`\`\`"

fixture "N6 escaped pipe inside an operator quote" quiet "Baseline: none — first retell

| # | Claim | Source |
|---|---|---|
| 1 | Pipes are fine | operator «a \\| b» |

$UNCONFIRMED"
fixture "N7 bold Baseline label, prettier-padded table" quiet "**Baseline:** none — first retell

| #   | Claim         | Source |
| --- | ------------- | ------ |
| 1   | One button    | P1     |

$UNCONFIRMED"
fixture "N8 unreachable Baseline not staged, --staged mode" quiet "Baseline: 0000000deadbeef

$GOOD_TABLE

$UNCONFIRMED" "" --staged

echo "── fires"
fixture "P1 no Source column" "fire:no «Source» column" "Baseline: none — first retell

| # | Claim |
|---|---|
| 1 | Install needs one button |

$UNCONFIRMED"
fixture "P2 empty Source cell" "fire:empty Source cell" "Baseline: none — first retell

| # | Claim | Source |
|---|---|---|
| 1 | Install needs one button |  |

$UNCONFIRMED"
fixture "P3 author in the confirmed table" "fire:author. belongs in" "Baseline: none — first retell

| # | Claim | Source |
|---|---|---|
| 1 | Retry then remove | author |

$UNCONFIRMED"
fixture "P4 unrecognised source" "fire:unrecognised source" "Baseline: none — first retell

| # | Claim | Source |
|---|---|---|
| 1 | Install needs one button | agreed earlier |

$UNCONFIRMED"
fixture "P5 empty operator quote" "fire:empty operator quote" "Baseline: none — first retell

| # | Claim | Source |
|---|---|---|
| 1 | Install needs one button | operator «» |

$UNCONFIRMED"
fixture "P6 P-number the spec never defines" "fire:cites P9" "Baseline: none — first retell

| # | Claim | Source |
|---|---|---|
| 1 | Install needs one button | P9 |

$UNCONFIRMED"
fixture "P7 register row the spec never defines" "fire:cites D77" "Baseline: none — first retell

| # | Claim | Source |
|---|---|---|
| 1 | Install needs one button | register D77 |

$UNCONFIRMED"
fixture "P8 missing Baseline line" "fire:no «Baseline:» line" "$GOOD_TABLE

$UNCONFIRMED"
fixture "P9 Baseline is not a commit, --resolve" "fire:is not a commit" "Baseline: 0000000deadbeef

$GOOD_TABLE

$UNCONFIRMED" "" --resolve
fixture "P9b Baseline neither a SHA nor none" "fire:commit SHA or «none»" "Baseline: last week

$GOOD_TABLE

$UNCONFIRMED"
fixture "P10 missing Unconfirmed subsection" "fire:no «### Unconfirmed" "Baseline: none — first retell

$GOOD_TABLE"

fixture "P11 register id that is only a prose word" "fire:cites design" "Baseline: none — first retell

| # | Claim | Source |
|---|---|---|
| 1 | x | register design |

$UNCONFIRMED"
fixture "P12 P1 recorded does not cover P10" "fire:cites P10" "Baseline: none — first retell

| # | Claim | Source |
|---|---|---|
| 1 | x | P10 |

$UNCONFIRMED"
fixture "P13 second retell section is checked too" "fire:author. belongs in" "Baseline: none — first retell

$GOOD_TABLE

$UNCONFIRMED

## Consensus retell

Baseline: none — second retell

| # | Claim | Source |
|---|---|---|
| 1 | x | author |

$UNCONFIRMED"
fixture "P14 a premise recorded only inside another retell" "fire:cites P7" "Baseline: none — first retell

| # | Claim | Source |
|---|---|---|
| 1 | x | P7 |

$UNCONFIRMED

## Consensus retell

Baseline: none — second retell

| # | Claim | Source |
|---|---|---|
| 1 | P7 is here | P1 |

$UNCONFIRMED"
fixture "P15 header-only table" "fire:no rows" "Baseline: none — first retell

| # | Claim | Source |
|---|---|---|

$UNCONFIRMED"
fixture "P16 a second table in the section" "fire:more than one table" "Baseline: none — first retell

$GOOD_TABLE

| # | Claim | Source |
|---|---|---|
| 1 | x | author |

$UNCONFIRMED"

echo "── CLI contract"
out=$(cd "$REPO_ROOT" && node "$CHECK" 2>&1) && rc=0 || rc=$?
if [ "$rc" = 0 ]; then ok "R1 the real spec corpus is clean"; else bad "R1 corpus scan rc=$rc: $out"; fi
printf '%s\n## Consensus retell\n\nBaseline: none\n\n| # | Claim |\n|---|---|\n| 1 | x |\n' "$REGISTERS" > "$TMP/r2-bad.md"
out=$(cd "$REPO_ROOT" && node "$CHECK" "$TMP/r2-bad.md" "$TMP/s1.md" 2>&1) && rc=0 || rc=$?
if [ "$rc" = 1 ] && grep -q 'r2-bad.md' <<<"$out" && ! grep -q 's1.md' <<<"$out"; then ok "R2 findings name the file and exit 1"; else bad "R2 rc=$rc: $out"; fi

# S1: in --staged mode a Baseline line ADDED in the index must resolve (the authoring moment,
# when the SHA is local and real); a squash-merged, branch-deleted SHA stays quiet later (N8).
G="$TMP/git"; mkdir -p "$G/docs/superpowers/specs"
git -C "$G" init -q && git -C "$G" -c user.email=t@t -c user.name=t commit -q --allow-empty -m init
printf '%s\n## Consensus retell\n\nBaseline: 0000000deadbeef\n\n%s\n\n%s\n' "$REGISTERS" "$GOOD_TABLE" "$UNCONFIRMED" > "$G/docs/superpowers/specs/s.md"
git -C "$G" add docs/superpowers/specs/s.md
out=$(cd "$G" && node "$CHECK" --staged docs/superpowers/specs/s.md 2>&1) && rc=0 || rc=$?
if [ "$rc" = 1 ] && grep -q 'is not a commit' <<<"$out"; then ok "S1 --staged resolves a Baseline added in the index"; else bad "S1 rc=$rc: $out"; fi

echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = 0 ]
