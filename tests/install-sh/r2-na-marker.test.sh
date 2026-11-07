#!/usr/bin/env bash
# r2-na-marker.test.sh — GH #547 Point 2 C4. Both inertness gates honor a recorded R2 N/A marker
# through ONE shared helper, re-verifying its precondition (so N/A is conditional, not permanent).
# Runs the SOURCE gates against crafted temp project dirs (cwd=temp). PAIRED-NEGATIVE throughout.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
AUDIT="$REPO_ROOT/packages/core/audit-self"
TPL="$REPO_ROOT/templates/ts-server/eslint.config.mjs"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# A temp project with the shipped eslint.config.mjs + the audit-self scripts available as siblings of
# the gate (so the helper resolves detect-r2-boundary.sh next to itself, exactly as in a consumer).
mkproj() {
  local d; d=$(mktemp -d)
  printf '{"name":"x","version":"0.0.0","dependencies":{"@hono/zod-openapi":"^0.9.0"}}\n' > "$d/package.json"
  cp "$TPL" "$d/eslint.config.mjs"
  # A real declarative repo HAS source (just no BOUNDARY files) — without this the gate hits its
  # "no .ts/.tsx source yet → skip" early-exit and never reaches the R2/marker logic (mirrors fixture A).
  mkdir -p "$d/src"; echo 'export const app = 1;' > "$d/src/app.ts"
  mkdir -p "$d/scripts"
  cp "$AUDIT/check-rule-globs.sh" "$AUDIT/check-rule-enforced.sh" \
     "$AUDIT/detect-r2-boundary.sh" "$AUDIT/r2-na-marker.sh" "$d/scripts/"
  mkdir -p "$d/.ai-factory"; printf '# decisions\n' > "$d/.ai-factory/tool-decisions.md"
  printf '%s' "$d"
}
write_marker() { # $1 dir — append the C3 N/A block
  cat >> "$1/.ai-factory/tool-decisions.md" <<'MARK'

<!-- aif:r2-na:begin -->
### R2 (no-unsafe-zod-parse) — N/A for this layout (auto-recorded by install.sh)
**Verdict:** N/A — declarative validation; no manual `.parse()` boundary.
<!-- aif:r2-na:end -->
MARK
}
globs() { ( cd "$1" && ESLINT_CONFIG="$1/eslint.config.mjs" bash scripts/check-rule-globs.sh ) 2>&1; }

# ── marker present + precondition HOLDS (declarative, no boundary) → PASS ──────
T=$(mkproj); write_marker "$T"
OUT=$(globs "$T"); RC=$?
[ "$RC" = "0" ] \
  && ok "marker holds (declarative repo, no boundary) → check:globs PASSES instead of the red alarm" \
  || bad "marker-holds case exited $RC (expected 0). out: $(printf '%s' "$OUT" | tail -3 | tr '\n' '|')"
grep -qiE 'R2 .*N/A.*precondition holds' <<<"$OUT" \
  && ok "marker-holds prints the 'R2 N/A — precondition holds' note" \
  || bad "no 'precondition holds' note (out: $(printf '%s' "$OUT" | tr '\n' '|'))"

# ── NEG (load-bearing): marker present but precondition BROKE → stale FAIL ─────
T=$(mkproj); write_marker "$T"
mkdir -p "$T/src/api"; echo 'export const h=(b)=>schema.parse(b);' > "$T/src/api/x.ts"
OUT=$(globs "$T"); RC=$?
[ "$RC" = "1" ] \
  && ok "NEG: marker present but a parse boundary now exists → check:globs FAILS (stale-marker alarm)" \
  || bad "NEG: stale marker did not fail the gate (rc=$RC) — N/A would be a permanent off-switch"
grep -qiE 'marked N/A.*but a parse boundary now exists' <<<"$OUT" \
  && ok "NEG: stale-marker FAIL names the broken precondition" \
  || bad "NEG: no stale-marker message (out: $(printf '%s' "$OUT" | tr '\n' '|'))"

# ── NEG (load-bearing): NO marker, declarative repo (zero boundary) → today's RED ─
T=$(mkproj)   # no write_marker
OUT=$(globs "$T"); RC=$?
[ "$RC" = "1" ] \
  && ok "NEG: no marker + zero-match boundary → today's red alarm (unchanged when no decision recorded)" \
  || bad "NEG: gate went green WITHOUT a marker (rc=$RC) — auto-green must require the recorded decision"

# ── check-rule-enforced honors the SAME marker (no divergence) ────────────────
enforced() { ( cd "$1" && ESLINT_CONFIG="$1/eslint.config.mjs" bash scripts/check-rule-enforced.sh ) 2>&1; }
T=$(mkproj); write_marker "$T"
OUT=$(enforced "$T"); RC=$?
{ [ "$RC" = "0" ] && grep -qiE 'N/A.*precondition holds' <<<"$OUT"; } \
  && ok "check:enforced honors the marker (holds → PASS) — two gates, one marker" \
  || bad "check:enforced diverged from check:globs on a holding marker (rc=$RC: $(printf '%s' "$OUT" | tr '\n' '|'))"
# NEG: same marker, boundary now exists → check:enforced also stale-FAILs.
mkdir -p "$T/src/api"; echo 'export const h=(b)=>schema.parse(b);' > "$T/src/api/x.ts"
OUT=$(enforced "$T"); RC=$?
[ "$RC" = "1" ] \
  && ok "NEG: check:enforced also stale-FAILs when the precondition breaks (consistent with check:globs)" \
  || bad "NEG: check:enforced stayed green on a broken precondition (rc=$RC) — gates diverged"

# ── no-boundary-yet (P2 K2): no framework, no zod, no boundary → the marker holds in both gates ──
nby() { local d; d=$(mkproj); printf '{"name":"x","version":"0.0.0"}\n' > "$d/package.json"; printf '%s' "$d"; }
write_marker_yet() { # $1 dir — the block 60-ci writes for no-boundary-yet
  cat >> "$1/.ai-factory/tool-decisions.md" <<'MARK'

<!-- aif:r2-na:begin -->
### R2 (no-unsafe-zod-parse) — N/A until an HTTP boundary appears (auto-recorded by install.sh)
**Verdict:** N/A — no HTTP boundary yet.
<!-- aif:r2-na:end -->
MARK
}
T=$(nby); write_marker_yet "$T"
OUT=$(globs "$T"); RC=$?
{ [ "$RC" = "0" ] && grep -qiE 'R2 .*N/A.*precondition holds' <<<"$OUT"; } \
  && ok "no-boundary-yet: the marker holds → check:globs PASSES" \
  || bad "no-boundary-yet: check:globs rc=$RC (out: $(printf '%s' "$OUT" | tail -3 | tr '\n' '|'))"
OUT=$(enforced "$T"); RC=$?
{ [ "$RC" = "0" ] && grep -qiE 'N/A.*precondition holds' <<<"$OUT"; } \
  && ok "no-boundary-yet: check:enforced honours the same marker" \
  || bad "no-boundary-yet: check:enforced rc=$RC (out: $(printf '%s' "$OUT" | tr '\n' '|'))"
# The first boundary file ends the waiver with no human step: the gate judges R2's globs as usual —
# green here (the default globs cover routes/), and it says the N/A no longer applies.
mkdir -p "$T/src/routes"; echo 'export const r = 1;' > "$T/src/routes/users.ts"
OUT=$(globs "$T"); RC=$?
{ [ "$RC" = "0" ] && grep -q 'no longer holds' <<<"$OUT" && grep -q 'R2 no-unsafe-zod-parse (RULE_GLOBS.boundary): matches' <<<"$OUT"; } \
  && ok "no-boundary-yet + a routes/ file → the N/A stops applying, R2's globs are checked as usual (green: covered)" \
  || bad "no-boundary-yet + boundary: rc=$RC (out: $(printf '%s' "$OUT" | tr '\n' '|'))"
OUT=$(AIF_ESLINT_CMD=true enforced "$T"); RC=$?
{ [ "$RC" = "0" ] && ! grep -q 'stale R2 N/A marker' <<<"$OUT"; } \
  && ok "no-boundary-yet + a boundary → check:enforced falls through to its usual check (no stale-marker FAIL)" \
  || bad "no-boundary-yet + boundary: check:enforced rc=$RC (out: $(printf '%s' "$OUT" | tr '\n' '|'))"
# NEG: a boundary the default globs do not cover → today's red «matches ZERO», not a false green.
T=$(nby); write_marker_yet "$T"
mkdir -p "$T/src/api"; echo 'export const h=(b)=>schema.parse(b);' > "$T/src/api/x.ts"
OUT=$(globs "$T"); RC=$?
{ [ "$RC" = "1" ] && grep -q 'matches ZERO source files' <<<"$OUT"; } \
  && ok "NEG: no-boundary-yet + an uncovered parse boundary → check:globs FAILS as for any uncovered boundary" \
  || bad "NEG: uncovered boundary after no-boundary-yet: rc=$RC (out: $(printf '%s' "$OUT" | tr '\n' '|'))"
# NEG: zod added (still no boundary) → ambiguous → today's red: the default globs match nothing.
T=$(nby); write_marker_yet "$T"; printf '{"name":"x","version":"0.0.0","dependencies":{"zod":"^3.23.0"}}\n' > "$T/package.json"
{ globs "$T" >/dev/null; [ $? = 1 ]; } \
  && ok "NEG: no-boundary-yet + zod declared later → check:globs FAILS (ambiguous is red)" \
  || bad "NEG: zod appeared and check:globs stayed green"
# NEG (load-bearing): the DECLARATIVE marker keeps its stale-marker alarm — only the no-boundary-yet
# wording ends quietly.
T=$(mkproj); write_marker "$T"; mkdir -p "$T/src/routes"; echo 'export const r = 1;' > "$T/src/routes/users.ts"
OUT=$(globs "$T"); RC=$?
{ [ "$RC" = "1" ] && grep -qiE 'marked N/A.*parse boundary now exists' <<<"$OUT"; } \
  && ok "NEG: a declarative N/A + a boundary → still the stale-marker FAIL" \
  || bad "NEG: declarative marker went quiet on a boundary (rc=$RC)"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
