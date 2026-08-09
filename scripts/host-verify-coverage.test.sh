#!/usr/bin/env bash
# Paired contract for scripts/host-verify-coverage.sh.
#
# The emitter is NOT a gate — it exits 0 either way — so the paired negative is on the
# OUTPUT, not the exit code: a kickoff whose host-verify block misses a permitted area
# must produce a CANDIDATE line naming that area, and an equivalent kickoff whose block
# covers every permitted area must produce none. A checker that emitted nothing in both
# cases would pass an exit-code test and be dead; this is the shape
# .claude/rules/attention-is-not-a-mechanism.md §2 calls #hope-as-gate.
#
# Fixtures are built in mktemp against REAL tracked repo paths — the emitter resolves
# tokens through `git ls-files`, so a fixture citing invented paths would prove nothing.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$DIR/host-verify-coverage.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
FAILED=0

fail() { printf 'FAIL: %s\n' "$1"; FAILED=$((FAILED + 1)); }

# ── fixture A — NEGATIVE: a permitted area no declared command names ──────────
# Mirrors getff-freshness-widening S1 (merged PR #1333): the allowlist permits the
# synthesizer, the contract only runs an install-sh script, and 4/4 PASS said nothing
# about the synthesis-time deliverable.
cat > "$TMP/uncovered.md" <<'EOF'
# fixture — permitted area missed by the contract

## §2 Permitted files

- `packages/core/synthesizer/**` — the generation-time deliverable.
- `tests/install-sh/**` — tests for the above.

## §3 Acceptance

```bash host-verify
bash tests/install-sh/snapshot.sh
```
EOF

OUT_A="$("$SCRIPT" "$TMP/uncovered.md" 2>&1)"
RC_A=$?
[ "$RC_A" -eq 0 ] || fail "uncovered fixture: emitter must exit 0 (emission, not a gate); got $RC_A"
printf '%s\n' "$OUT_A" | grep -q '^CANDIDATE: packages/core/synthesizer' \
  || fail "uncovered fixture: expected a CANDIDATE for packages/core/synthesizer; got:
$OUT_A"
printf '%s\n' "$OUT_A" | grep -qx 'Candidates: 1' \
  || fail "uncovered fixture: expected exactly 1 candidate; got:
$(printf '%s\n' "$OUT_A" | grep '^Candidates:')"

# ── fixture B — POSITIVE: every permitted area is named by a command ──────────
# Identical but for the allowlist. Proves the emitter DISCRIMINATES rather than
# flagging unconditionally — the failure mode a 100%-red signal would hide.
cat > "$TMP/covered.md" <<'EOF'
# fixture — every permitted area named by the contract

## §2 Permitted files

- `tests/install-sh/**` — the whole permitted surface.

## §3 Acceptance

```bash host-verify
bash tests/install-sh/snapshot.sh
```
EOF

OUT_B="$("$SCRIPT" "$TMP/covered.md" 2>&1)"
printf '%s\n' "$OUT_B" | grep -qx 'Candidates: 0' \
  || fail "covered fixture: expected 0 candidates; got:
$OUT_B"
printf '%s\n' "$OUT_B" | grep -q '^CANDIDATE:' \
  && fail "covered fixture: emitted a CANDIDATE line where the contract covers the allowlist"

# ── fixture C — no allowlist: must report N/A, never "clean" ──────────────────
# 30 of the 41 contract-bearing kickoffs are in this state. Reporting them as clean
# would be T14's "clean audit at low coverage" defect wired into a tool.
cat > "$TMP/noallowlist.md" <<'EOF'
# fixture — scope stated as prose, no allowlist section

## §2 What to build

Something, described in prose.

## §5 Anti-scope

- Do not touch `packages/core/detector/**`.

## §3 Acceptance

```bash host-verify
bash tests/install-sh/snapshot.sh
```
EOF

OUT_C="$("$SCRIPT" "$TMP/noallowlist.md" 2>&1)"
printf '%s\n' "$OUT_C" | grep -q 'Allowlist: ABSENT' \
  || fail "no-allowlist fixture: expected 'Allowlist: ABSENT'; got:
$OUT_C"
printf '%s\n' "$OUT_C" | grep -q 'Candidates: N/A' \
  || fail "no-allowlist fixture: absence of input must not read as 'Candidates: 0'; got:
$OUT_C"

# ── fixture D — a valid opt-out has no commands to compare against ────────────
cat > "$TMP/optout.md" <<'EOF'
# fixture — prose-only kickoff

<!-- host-verify: none — prose-only kickoff, no executable deliverable -->
EOF

OUT_D="$("$SCRIPT" "$TMP/optout.md" 2>&1)"
printf '%s\n' "$OUT_D" | grep -q 'Contract: OPT-OUT' \
  || fail "opt-out fixture: expected 'Contract: OPT-OUT'; got:
$OUT_D"

# ── fixture E — no contract at all: fail-closed, exit 2 ──────────────────────
# host-verify.sh treats a missing contract as exit 2 (#silent-contract-skip); the
# emitter must inherit that rather than printing a reassuring empty candidate list.
cat > "$TMP/nocontract.md" <<'EOF'
# fixture — no host-verify contract, no opt-out

## §2 Permitted files

- `tests/install-sh/**`
EOF

"$SCRIPT" "$TMP/nocontract.md" > /dev/null 2>&1
RC_E=$?
[ "$RC_E" -eq 2 ] || fail "no-contract fixture: expected exit 2 (fail-closed); got $RC_E"

# ── incident replay — the real kickoff, not a fixture (T2: run it) ────────────
REPO_ROOT="$(git rev-parse --show-toplevel)"
REAL="$REPO_ROOT/.claude/orchestrator-prompts/getff-freshness-widening-s1/kickoff.md"
if [ -f "$REAL" ]; then
  OUT_R="$("$SCRIPT" "$REAL" 2>&1)"
  printf '%s\n' "$OUT_R" | grep -q '^CANDIDATE: packages/core/synthesizer' \
    || fail "incident replay: the motivating kickoff must still emit its synthesizer candidate; got:
$(printf '%s\n' "$OUT_R" | grep -E '^(Candidates|CANDIDATE)')"
fi

if [ "$FAILED" -gt 0 ]; then
  printf '%d check(s) failed\n' "$FAILED"
  exit 1
fi
echo "PASS"
