#!/usr/bin/env bash
# Paired-negative for scripts/check-ask-files.sh (advisor-pattern §8 item 6).
#
# Every arm is hermetic: CLAUDE_COORDINATION_DIR points at a mktemp dir, so the real
# mailbox under $HOME is never read and never written. GREEN arms prove the gate stays
# quiet on the states that must not block a push (no mailbox yet — the advisor is not live;
# an empty mailbox; a well-formed ask). RED arms prove each rule actually fires: a gate that
# passes everything is the failure mode this file exists to exclude.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
CHECK="$DIR/check-ask-files.sh"

TMP="$(mktemp -d "${TMPDIR:-/tmp}/ask-files-test.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT
ASKS="$TMP/session-bus/asks"

fails=0
run_check() { CLAUDE_COORDINATION_DIR="$TMP" bash "$CHECK" >"$TMP/out" 2>"$TMP/err"; }

expect_pass() {
  if run_check; then return; fi
  echo "FAIL: $1 — expected exit 0, got $?"; sed 's/^/    /' "$TMP/err"; fails=$((fails + 1))
}

expect_fail() {
  if run_check; then
    echo "FAIL: $1 — expected exit 1, got 0"; fails=$((fails + 1)); return
  fi
  # The finding must NAME the defect: an unactionable red is a red nobody can fix.
  if ! grep -q "$2" "$TMP/err"; then
    echo "FAIL: $1 — stderr did not mention '$2'"; sed 's/^/    /' "$TMP/err"; fails=$((fails + 1))
  fi
}

reset() { rm -rf "$ASKS"; mkdir -p "$ASKS"; }

write_ask() {
  # $1 = filename, $2 = class, $3 = status, rest = extra sections appended verbatim
  local name="$1" class="$2" status="$3"; shift 3
  {
    echo '---'
    echo 'asker-role: dispatcher'
    echo "asker-cwd: $TMP"
    echo "class: $class"
    echo "status: $status"
    echo '---'
    echo
    echo '## Question'
    echo
    echo 'Does stage S2 need its own probe, or is building it the cheaper proof?'
    echo
    echo '## Options considered'
    echo
    echo '- A probe first -> one extra round.'
    echo '- B build then verify live -> rework risk if wrong.'
    echo
    echo '## Evidence'
    echo
    echo '- scripts/check-ask-files.sh:1 — the gate under discussion.'
    printf '%s\n' "$@"
  } >"$ASKS/$name"
}

answer_block() {
  printf '%s\n' '' '## Answer' '' 'verdict: build first' 'rationale: reversible surface' \
    'decided-by: arch' 'timestamp: 2026-08-17T10:00:00+03:00' \
    "decisions-entry: .claude/orchestrator-prompts/x/plan.decisions.md#ask-1"
}

# ── GREEN 1: no mailbox at all (the state today — the advisor is not live yet) ──────────
rm -rf "$TMP/session-bus"
expect_pass "absent mailbox must not block a push"

# ── GREEN 2: mailbox exists but is empty ───────────────────────────────────────────────
reset
expect_pass "empty mailbox"

# ── GREEN 3: a well-formed open consult ────────────────────────────────────────────────
reset
write_ask '2026-08-17-dispatcher-s2-probe.md' consult open
expect_pass "well-formed open consult"

# ── GREEN 4: a well-formed answered ask carrying its decisions.md reference ────────────
reset
write_ask '2026-08-17-dispatcher-s2-probe.md' consult answered "$(answer_block)"
expect_pass "answered ask with a decisions entry"

# ── GREEN 5: a well-formed materiality dispute ─────────────────────────────────────────
reset
write_ask '2026-08-17-reviewer-nit-materiality.md' materiality-dispute open \
  '' '## Finding (verbatim)' '' 'The helper duplicates lib/x.ts.' '' '## Objection' '' 'No consumer notices.'
expect_pass "materiality dispute with finding and objection"

# ── RED 1: filename is not <YYYY-MM-DD>-<role>-<slug>.md ───────────────────────────────
reset
write_ask 'ask-about-s2.md' consult open
expect_fail "malformed filename" "filename must be"

# ── RED 2: missing frontmatter key ─────────────────────────────────────────────────────
reset
write_ask '2026-08-17-dispatcher-s2-probe.md' consult open
sed '/^class:/d' "$ASKS/2026-08-17-dispatcher-s2-probe.md" >"$TMP/x" && mv "$TMP/x" "$ASKS/2026-08-17-dispatcher-s2-probe.md"
expect_fail "missing class key" "'class' missing"

# ── RED 3: illegal enum value ──────────────────────────────────────────────────────────
reset
write_ask '2026-08-17-dispatcher-s2-probe.md' consult pending
expect_fail "illegal status value" "is not one of: open, answered"

# ── RED 4: required section absent ─────────────────────────────────────────────────────
reset
write_ask '2026-08-17-dispatcher-s2-probe.md' consult open
sed '/^## Evidence$/d' "$ASKS/2026-08-17-dispatcher-s2-probe.md" >"$TMP/x" && mv "$TMP/x" "$ASKS/2026-08-17-dispatcher-s2-probe.md"
expect_fail "missing Evidence section" "required section '## Evidence' missing"

# ── RED 5: question over the one-screen budget ─────────────────────────────────────────
reset
i=0; : >"$TMP/long"; while [ $i -lt 60 ]; do echo "line $i" >>"$TMP/long"; i=$((i + 1)); done
write_ask '2026-08-17-dispatcher-s2-probe.md' consult open
awk 'NR == FNR { buf = buf $0 "\n"; next }
     $0 == "## Question" { print; printf "%s", buf; next }
     { print }' \
  "$TMP/long" "$ASKS/2026-08-17-dispatcher-s2-probe.md" >"$TMP/x" &&
  mv "$TMP/x" "$ASKS/2026-08-17-dispatcher-s2-probe.md"
expect_fail "over-long question" "one-screen budget"

# ── RED 6: a dispute without the verbatim finding ──────────────────────────────────────
reset
write_ask '2026-08-17-reviewer-nit-materiality.md' materiality-dispute open \
  '' '## Objection' '' 'No consumer notices.'
expect_fail "dispute without verbatim finding" "requires section '## Finding (verbatim)'"

# ── RED 7: answered without an answer block ────────────────────────────────────────────
reset
write_ask '2026-08-17-dispatcher-s2-probe.md' consult answered
expect_fail "answered without an Answer section" "requires section '## Answer'"

# ── RED 8: answered, answer block present, but incomplete ──────────────────────────────
reset
write_ask '2026-08-17-dispatcher-s2-probe.md' consult answered \
  '' '## Answer' '' 'verdict: build first' 'decided-by: arch' \
  'timestamp: 2026-08-17T10:00:00+03:00' 'decisions-entry: plan.decisions.md#ask-1'
expect_fail "answer block missing rationale" "missing 'rationale:'"

# ── RED 9: THE cross-check — answered with a complete answer but no decisions entry ────
# This is §5.3 L3(c): the half that moves "recorded before applied" from memory to channel 1.
reset
write_ask '2026-08-17-dispatcher-s2-probe.md' consult answered \
  '' '## Answer' '' 'verdict: build first' 'rationale: reversible surface' \
  'decided-by: arch' 'timestamp: 2026-08-17T10:00:00+03:00'
expect_fail "answered without a decisions entry" "requires 'decisions-entry:'"

# ── RED 10: decisions-entry present but pointing at something else ─────────────────────
reset
write_ask '2026-08-17-dispatcher-s2-probe.md' consult answered \
  '' '## Answer' '' 'verdict: build first' 'rationale: reversible surface' \
  'decided-by: arch' 'timestamp: 2026-08-17T10:00:00+03:00' 'decisions-entry: see the morning report'
expect_fail "decisions-entry not a decisions.md reference" "does not reference a decisions.md entry"

# ── RED 11: one bad file among good ones still fails (no first-file short-circuit) ─────
reset
write_ask '2026-08-17-dispatcher-first.md' consult open
write_ask '2026-08-17-dispatcher-second.md' consult pending
expect_fail "a later bad file is still caught" "is not one of: open, answered"

# ── WIRING: the pre-push section actually runs this script ─────────────────────────────
# A checker nobody calls is armed-but-not-fired. The registry entry in
# packages/core/hooks/pre-push.ts exposes a PREPUSH_ONLY seam (the pattern the prior-art and
# alwayson-budget sections use); driving it here proves the channel, not just the detector.
# Capability-check the tsx loader exactly as .husky/pre-push does — where Node cannot run the
# TS hook, say so loudly instead of reporting a pass this arm never made.
REPO_ROOT="$(cd "$DIR/.." && pwd)"
run_section() {
  CLAUDE_COORDINATION_DIR="$1" PREPUSH_ONLY=ask-file-schema \
    node --import tsx/esm "$REPO_ROOT/packages/core/hooks/pre-push.ts" \
    >"$TMP/out" 2>"$TMP/err"
}

if command -v node >/dev/null 2>&1 && node --import tsx/esm -e '' >/dev/null 2>&1; then
  reset
  write_ask '2026-08-17-dispatcher-s2-probe.md' consult open
  if ! run_section "$TMP"; then
    echo "FAIL: pre-push section — valid mailbox should exit 0"; sed 's/^/    /' "$TMP/err"
    fails=$((fails + 1))
  fi

  reset
  write_ask '2026-08-17-dispatcher-s2-probe.md' consult pending
  if run_section "$TMP"; then
    echo "FAIL: pre-push section — invalid mailbox should exit non-zero"; fails=$((fails + 1))
  elif ! grep -q 'ask-file schema gate RED' "$TMP/err"; then
    echo "FAIL: pre-push section — RED did not name the gate"; sed 's/^/    /' "$TMP/err"
    fails=$((fails + 1))
  fi

  if ! run_section "$TMP/no-such-store"; then
    echo "FAIL: pre-push section — absent mailbox must not block a push"; fails=$((fails + 1))
  fi
else
  echo "DEGRADED: node/tsx unavailable — the pre-push wiring arms did NOT run" >&2
fi

if [ "$fails" -gt 0 ]; then echo "FAILED: $fails arm(s)"; exit 1; fi
echo "PASS"
