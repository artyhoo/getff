#!/usr/bin/env bash
# Paired-negative for the runtime-bridge auto-dispatch opt-IN gate
# (.claude/hooks/runtime-bridge-dispatch.sh) — one-click-installer kickoff §7,
# maintainer decision 2026-05-31: auto-dispatch is real, metered autonomous
# work, so the hook must NOT fire on every */kickoff.md write (the old opt-OUT
# default was a paid-by-default footgun). Default = NO dispatch; ONLY a kickoff
# whose FIRST line is exactly `<!-- bridge: auto -->` (trimmed match, mirroring
# the kickoff.ts skip-marker precedent) auto-dispatches.
#
# Cases:
#   (a) NEGATIVE   — unmarked */kickoff.md            → no dispatch (the guard)
#   (b) POSITIVE   — `<!-- bridge: auto -->` first line → dispatch fires
#                    (positive control proving (a) is non-vacuous)
#   (c) REGRESSION — *-meta-launch/kickoff.md WITH marker → still skipped
#                    (pipeline-ux P4 path filter must survive the gate)
#
# tsx is stubbed via PATH-prepend (echoes DISPATCH-CALLED); jq/node presence is
# asserted up front because the hook's dependency guard exits 0 silently when
# they are absent — (a)/(c) would then pass vacuously with no dispatch leg at all.
#
# CI: invoked from .github/workflows/audit-self.yml#principles-meta-tests
# (alongside prepush-fallback-base-ref.test.sh).

set -uo pipefail

REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
HOOK="$REPO_ROOT/.claude/hooks/runtime-bridge-dispatch.sh"
PASS=0
FAIL=0

ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# ── Setup guards: the hook's dependency/entrypoint guards exit 0 silently when
#    unmet, which would make the negative cases (a)/(c) pass vacuously ─────────
command -v jq   >/dev/null 2>&1 || { echo "SETUP FAIL: jq missing";   exit 1; }
command -v node >/dev/null 2>&1 || { echo "SETUP FAIL: node missing"; exit 1; }
[ -f "$HOOK" ] || { echo "SETUP FAIL: hook missing at $HOOK"; exit 1; }
[ -f "$REPO_ROOT/packages/runtime-bridge/src/cli/dispatch.ts" ] \
  || { echo "SETUP FAIL: dispatch.ts missing (hook would no-op)"; exit 1; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# tsx stub: PATH-prepended; the hook prefers `command -v tsx` over npx, so the
# stub intercepts the dispatch leg and just announces itself on stdout.
mkdir -p "$TMP/bin"
cat > "$TMP/bin/tsx" <<'STUB'
#!/usr/bin/env bash
echo "DISPATCH-CALLED"
STUB
chmod +x "$TMP/bin/tsx"
export PATH="$TMP/bin:$PATH"

run_hook() {  # $1 = kickoff path; prints hook stdout, returns hook exit code
  jq -n --arg fp "$1" '{tool_name:"Write", tool_input:{file_path:$fp}}' \
    | bash "$HOOK" 2>/dev/null
}

# ── Case (a): unmarked kickoff → NO dispatch (negative arm) ───────────────────
UMBRELLA="$TMP/.claude/orchestrator-prompts/optin-probe"
mkdir -p "$UMBRELLA"
printf '# Kickoff without marker\n\nbody\n' > "$UMBRELLA/kickoff.md"
OUT_A=$(run_hook "$UMBRELLA/kickoff.md"); RC_A=$?
if [ "$RC_A" -eq 0 ] && ! printf '%s' "$OUT_A" | grep -q 'DISPATCH-CALLED'; then
  ok "(a) unmarked kickoff → no dispatch (exit 0)"
else
  bad "(a) unmarked kickoff dispatched (rc=$RC_A out=$OUT_A)"
fi

# ── Case (b): `<!-- bridge: auto -->` first line → dispatch fires ─────────────
# Same path as (a); the ONLY difference is the first line (non-vacuity pin).
printf '<!-- bridge: auto -->\n# Kickoff with marker\n\nbody\n' > "$UMBRELLA/kickoff.md"
OUT_B=$(run_hook "$UMBRELLA/kickoff.md")
if printf '%s' "$OUT_B" | grep -q 'DISPATCH-CALLED'; then
  ok "(b) bridge:auto marker → dispatch fires (positive control)"
else
  bad "(b) marked kickoff did NOT dispatch (out=$OUT_B)"
fi

# ── Case (c): *-meta-launch/kickoff.md WITH marker → still skipped (P4) ───────
META="$TMP/.claude/orchestrator-prompts/optin-probe-meta-launch"
mkdir -p "$META"
printf '<!-- bridge: auto -->\n# Meta-launch dispatch record\n' > "$META/kickoff.md"
OUT_C=$(run_hook "$META/kickoff.md"); RC_C=$?
if [ "$RC_C" -eq 0 ] && ! printf '%s' "$OUT_C" | grep -q 'DISPATCH-CALLED'; then
  ok "(c) meta-launch + marker → still skipped (P4 regression guard)"
else
  bad "(c) meta-launch kickoff dispatched (rc=$RC_C out=$OUT_C)"
fi

# ── Case (d): CONSUMER layout — only the vendor drop exists → dispatch fires ──
# The hook ships to two audiences with different layouts: the framework repo keeps
# dispatch.ts at packages/runtime-bridge/src/cli/, a consumer install lands it at
# .claude/vendor/runtime-bridge/src/cli/ (setup.d/55-runtime-bridge-vendor.sh). Before the
# two-tier resolution the hook only knew the framework path, so on every consumer it hit
# the `neither found` branch and exited 0 in silence — while the vendor copy sat right
# there. Measured on a real `--profile factory` install 2026-08-17.
#
# THIS IS THE PAIRED NEGATIVE: revert _resolve_dispatch_ts to the single framework path
# and this case fails (no DISPATCH-CALLED), while (a)/(b)/(c) all still pass — which is
# exactly why the defect survived the existing suite.
#
# CLAUDE_PROJECT_DIR is what the hook reads for REPO_ROOT, so pointing it at a synthetic
# consumer tree reproduces the consumer layout without needing a real install.
CONSUMER="$TMP/consumer"
mkdir -p "$CONSUMER/.claude/vendor/runtime-bridge/src/cli" \
         "$CONSUMER/.claude/orchestrator-prompts/vendor-probe"
printf '// vendor dispatch entrypoint stub\n' \
  > "$CONSUMER/.claude/vendor/runtime-bridge/src/cli/dispatch.ts"
[ -e "$CONSUMER/packages/runtime-bridge/src/cli/dispatch.ts" ] \
  && { echo "SETUP FAIL: (d) tree must NOT carry the framework path"; exit 1; }
printf '<!-- bridge: auto -->\n# Kickoff on a consumer install\n' \
  > "$CONSUMER/.claude/orchestrator-prompts/vendor-probe/kickoff.md"
OUT_D=$(jq -n --arg fp "$CONSUMER/.claude/orchestrator-prompts/vendor-probe/kickoff.md" \
  '{tool_name:"Write", tool_input:{file_path:$fp}}' \
  | CLAUDE_PROJECT_DIR="$CONSUMER" bash "$HOOK" 2>/dev/null)
if printf '%s' "$OUT_D" | grep -q 'DISPATCH-CALLED'; then
  ok "(d) consumer layout (vendor drop only) → dispatch fires"
else
  bad "(d) consumer layout did NOT dispatch — hook is blind to the vendor path (out=$OUT_D)"
fi

# ── Case (e): OPTED-IN kickoff, neither entrypoint present → LOUD skip ────────
# Rewritten for #1597 review ledger L-6. The previous case asserted silence here on an
# `<!-- bridge: auto -->` kickoff, encoding the premise the fix falsifies: control reaches
# the resolver miss only PAST the opt-in gate, so the author explicitly asked for this
# dispatch and got exit 0 + nothing — while the jq/node-miss branch announced DID NOT RUN for
# the identical opted-in condition. Two policies for one condition; this is now one.
# The genuine-opt-out guard the old case meant to provide moved to (f), where it belongs:
# a kickoff with no marker at all.
OPTED="$TMP/opted-in-no-bridge"
mkdir -p "$OPTED/.claude/orchestrator-prompts/opted-probe"
printf '<!-- bridge: auto -->\n# Kickoff with no bridge installed\n' \
  > "$OPTED/.claude/orchestrator-prompts/opted-probe/kickoff.md"
OUT_E=$(jq -n --arg fp "$OPTED/.claude/orchestrator-prompts/opted-probe/kickoff.md" \
  '{tool_name:"Write", tool_input:{file_path:$fp}}' \
  | CLAUDE_PROJECT_DIR="$OPTED" bash "$HOOK" 2>/dev/null); RC_E=$?
if [ "$RC_E" -eq 0 ] \
   && printf '%s' "$OUT_E" | grep -q 'DID NOT RUN' \
   && printf '%s' "$OUT_E" | grep -q '.claude/vendor/runtime-bridge/src/cli/dispatch.ts'; then
  ok "(e) opted-in kickoff, no entrypoint → loud SKIP naming both layouts (exit 0)"
else
  bad "(e) opted-in miss is still silent or under-specified (rc=$RC_E out=$OUT_E)"
fi

# ── Case (f): kickoff with NO opt-in marker → genuine opt-out stays silent ─────
# Guards the L-6 fix against over-reach: a project that never asked for the bridge must not
# be nagged on kickoff writes. This is the invariant the old case (e) was reaching for.
BARE="$TMP/bare"
mkdir -p "$BARE/.claude/orchestrator-prompts/bare-probe"
printf '# Kickoff with no bridge marker\n' \
  > "$BARE/.claude/orchestrator-prompts/bare-probe/kickoff.md"
OUT_F=$(jq -n --arg fp "$BARE/.claude/orchestrator-prompts/bare-probe/kickoff.md" \
  '{tool_name:"Write", tool_input:{file_path:$fp}}' \
  | CLAUDE_PROJECT_DIR="$BARE" bash "$HOOK" 2>/dev/null); RC_F=$?
if [ "$RC_F" -eq 0 ] && [ -z "$OUT_F" ]; then
  ok "(f) no opt-in marker → silent no-op preserved (exit 0, empty)"
else
  bad "(f) an un-marked kickoff is being nagged (rc=$RC_F out=$OUT_F)"
fi

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
