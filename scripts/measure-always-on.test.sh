#!/usr/bin/env bash
# Test for measure-always-on.sh — runs the meter and asserts a valid, sane baseline.
#
# Division of labour with scripts/check-alwayson-budget.sh: that script owns the CEILING
# (is the resident set growing past what S-E allowed?). This one owns the FLOOR (is the
# meter still measuring anything at all?). A meter that silently starts reporting an empty
# manifest would make the ceiling gate green for the wrong reason — that is the regression
# this floor exists to catch, and it is why the floor must sit well BELOW the live
# baseline rather than tracking it.
#
# Channel: run from the `alwayson-budget` job in .github/workflows/audit-self.yml, next to
# the ceiling gate it complements. Until 2026-08-07 this file was wired to nothing at all
# (surfaced by the cold backward sweep behind arch-v2 S-L, PR #1263 §6) — an unwired test
# is `#hope-as-gate` per .claude/rules/attention-is-not-a-mechanism.md §2.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
out="$("$DIR/measure-always-on.sh")" || { echo "FAIL: script errored"; exit 1; }
echo "$out" | jq -e . >/dev/null 2>&1 || { echo "FAIL: not valid JSON"; exit 1; }
total="$(echo "$out" | jq -r '.total_bytes')"
[[ "$total" =~ ^[0-9]+$ ]] || { echo "FAIL: total_bytes not integer"; exit 1; }
# Floor rationale (re-derived 2026-08-07, arch-v2 S-L): the previous floor was 100,000 B,
# written against the pre-trim set ("11 rules ~151k + CLAUDE.md"). S-G then cut the resident
# set to 48,671 B, so the floor sat ABOVE the true baseline and this test was RED — it
# asserted the set had not shrunk, which is the opposite of the S-G umbrella's goal. 20,000 B
# is chosen to be far below the live baseline (leaving room for further legitimate trims)
# while remaining far above an empty or broken manifest, which is the only thing a floor can
# usefully discriminate. Re-derive if a future trim brings the baseline near it.
FLOOR="${AIF_ALWAYSON_FLOOR:-20000}"
(( total > FLOOR )) || { echo "FAIL: total_bytes $total <= $FLOOR (manifest empty or meter broken?)"; exit 1; }
echo "PASS: total_bytes=$total (floor $FLOOR)"
