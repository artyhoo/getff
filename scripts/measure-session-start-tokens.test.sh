#!/usr/bin/env bash
# Test for scripts/measure-session-start-tokens.sh — the LIVE injected-set meter.
#
# WHY THIS IS A DIFFERENCE TEST AND NOT A FLOOR.
#   Its sibling scripts/measure-always-on.test.sh asserts `total_bytes > FLOOR` — the right
#   check for "is the meter measuring anything at all", and structurally blind to the defect
#   that actually shipped here. From the day this meter was written until 2026-09-14 its
#   exclusion membership test was `grep -Fxq` (exact-line) against entries that are globs
#   (`**/<name>.md`): it matched 0 of 8, counted every excluded rule as resident, and printed
#   174,538 B / 47,067 est. tokens where the true resident payload was 65,770 B / 19,877 —
#   a 2.37x overstatement. An OVER-count sails straight past a floor. So this test asserts a
#   DIFFERENCE the broken matcher could not produce: with a fixture settings file that
#   excludes a known rule, that rule's row must LEAVE Section A and APPEAR in Section B; with
#   an empty exclude list the same row must be back in Section A. Same shape as principle 34's
#   N34-1a leg, which proves a difference rather than "nothing matches anything".
#
# Nothing here reads the live .claude/settings.json for its assertions — the meter is pointed
# at fixture settings via MEASURE_SETTINGS_PATH — so an edit to the committed exclude list can
# neither break this test nor make it pass for the wrong reason.
#
# Channel: the `alwayson-budget` job in .github/workflows/audit-self.yml, beside
# measure-always-on.test.sh and check-alwayson-budget.test.sh (principle 41 gates the wiring).
#
# spec: docs/superpowers/specs/2026-09-14-context-economy-self-enforcement-design.md §2
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$DIR/.." && pwd)"
cd "$REPO_ROOT" || { echo "FAIL: cannot cd $REPO_ROOT"; exit 1; }

command -v jq >/dev/null 2>&1 || { echo "SKIP: jq unavailable"; exit 0; }

fails=0
ok()  { printf 'PASS: %s\n' "$1"; }
bad() { printf 'FAIL: %s\n' "$1"; fails=$(( fails + 1 )); }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# The probe rule: always-on by construction (ALWAYS_ON_CORE, no `paths:` frontmatter), so it
# sits in Section A whenever it is not excluded. Chosen over a `paths:`-gated rule because a
# gated rule never reaches Section A and the test would pass vacuously.
PROBE_REL=".claude/rules/00-rule-index.md"
PROBE_BASE="00-rule-index.md"
[[ -f "$REPO_ROOT/$PROBE_REL" ]] || { echo "SKIP: probe rule $PROBE_REL absent"; exit 0; }

printf '{"claudeMdExcludes":[]}\n'                       > "$TMP/settings-empty.json"
printf '{"claudeMdExcludes":["**/%s"]}\n' "$PROBE_BASE"  > "$TMP/settings-excluding-probe.json"
printf '{"claudeMdExcludes":["dir/**"]}\n'               > "$TMP/settings-unsupported.json"
printf '{"permissions":{}}\n'                            > "$TMP/settings-nolocal.json"

run_meter() {
  # run_meter <settings_path> -> meter stdout. MEMORY autoload is pinned to a non-existent
  # path so the host's own MEMORY.md cannot move the numbers between the two runs.
  MEASURE_SETTINGS_PATH="$1" \
  MEASURE_SETTINGS_LOCAL_PATH="$TMP/settings-nolocal.json" \
  MEASURE_MEMORY_PATH="$TMP/no-such-memory.md" \
    bash "$DIR/measure-session-start-tokens.sh" 2>/dev/null
}

section() {
  # section <output-file> <A|B> -> the rows of that section
  awk -v want="$2" '
    /^## Section A/ { s="A"; next }
    /^## Section B/ { s="B"; next }
    /^## Section C/ { s="C"; next }
    s == want { print }
  ' "$1"
}

total_bytes() { awk -F'): ' '/^## TOTAL/ { split($2, a, " "); print a[1] }' "$1"; }

run_meter "$TMP/settings-empty.json"            > "$TMP/out-empty.txt"
run_meter "$TMP/settings-excluding-probe.json"  > "$TMP/out-excluded.txt"

# --- guard: the meter produced a usable report at all -----------------------
t_empty=$(total_bytes "$TMP/out-empty.txt")
t_excl=$(total_bytes "$TMP/out-excluded.txt")
if [[ ! "$t_empty" =~ ^[0-9]+$ || ! "$t_excl" =~ ^[0-9]+$ ]]; then
  echo "FAIL: meter did not emit a numeric TOTAL (empty='$t_empty' excluded='$t_excl')"
  exit 1
fi
ok "meter emits a numeric TOTAL in both runs ($t_empty / $t_excl bytes)"

# --- the positive control: not excluded -> the probe is resident -------------
if section "$TMP/out-empty.txt" A | grep -q "^$PROBE_REL "; then
  ok "empty exclude list: $PROBE_BASE is counted in Section A"
else
  bad "empty exclude list: $PROBE_BASE should be in Section A (positive control broken)"
fi

# --- the leg the old matcher could not pass ---------------------------------
if section "$TMP/out-excluded.txt" A | grep -q "^$PROBE_REL "; then
  bad "excluded rule $PROBE_BASE is STILL counted in Section A — the glob exclude did not apply"
else
  ok "excluded rule $PROBE_BASE leaves Section A"
fi

if section "$TMP/out-excluded.txt" B | grep -q "^$PROBE_REL "; then
  ok "excluded rule $PROBE_BASE is attributed in Section B"
else
  bad "excluded rule $PROBE_BASE missing from Section B — the entry was not resolved to a file"
fi

# Section B must never report a live entry as an absent file: an entry is a GLOB, and stat-ing
# it is the other half of the 2026-09-14 defect.
if grep -q 'matches NO tracked file' "$TMP/out-excluded.txt"; then
  bad "Section B reported a live exclude entry as matching no tracked file"
else
  ok "Section B resolves the glob entry instead of stat-ing it"
fi

# --- the difference is exactly the probe's size ------------------------------
probe_bytes=$(wc -c < "$REPO_ROOT/$PROBE_REL" | tr -d ' ')
delta=$(( t_empty - t_excl ))
if [[ "$delta" -eq "$probe_bytes" ]]; then
  ok "TOTAL drops by exactly the excluded rule's size ($delta B)"
else
  bad "TOTAL delta $delta B != probe size $probe_bytes B (exclusion applied to the wrong rows?)"
fi

# --- an unsupported entry form must fail loudly, not be quietly ignored ------
out_unsupported=$(MEASURE_SETTINGS_PATH="$TMP/settings-unsupported.json" \
  MEASURE_SETTINGS_LOCAL_PATH="$TMP/settings-nolocal.json" \
  MEASURE_MEMORY_PATH="$TMP/no-such-memory.md" \
  bash "$DIR/measure-session-start-tokens.sh" 2>&1 >/dev/null)
if printf '%s' "$out_unsupported" | grep -q 'FATAL'; then
  ok "an exclude form the matcher cannot evaluate makes the meter fail loudly"
else
  bad "unsupported exclude form was accepted silently (T3 — the meter must fail loudly)"
fi

if [[ "$fails" -eq 0 ]]; then
  echo "ALL PASS (scripts/measure-session-start-tokens.sh)"
  exit 0
fi
echo "FAILURES: $fails"
exit 1
