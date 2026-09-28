#!/usr/bin/env bash
# r2-auto-wire.test.sh — GH #547 Point 2 C2/C3 end-to-end. Fixtures A–E + self-probe. Each arm
# asserts install rc=0 (a mid-install crash must never false-green — lesson GH #531/#544).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# Clean --force install; captures + asserts install rc=0. $1 dir, $2 stack. </dev/null → dev-dep [y/N] = no.
install_into() {
  ( cd "$1" && git init -q && bash "$REPO_ROOT/install.sh" "$2" --force </dev/null ) >"$1/.install.log" 2>&1
  local rc=$?
  [ "$rc" = "0" ] || bad "install rc=$rc (non-zero — see tail: $(tail -3 "$1/.install.log" | tr '\n' '|'))"
  return 0
}
globs() { ( cd "$1" && ESLINT_CONFIG="$1/eslint.config.mjs" bash "$1/scripts/check-rule-globs.sh" ) 2>&1; }

# ── Fixture A — declarative Hono: red→green via recorded N/A (the timeliner case) ──────
A=$(mktemp -d)
printf '{"name":"a","version":"0.0.0","dependencies":{"@hono/zod-openapi":"^0.9.0"}}\n' > "$A/package.json"
mkdir -p "$A/src"; echo 'export const app = 1;' > "$A/src/app.ts"
install_into "$A" ts-server
grep -qF '<!-- aif:r2-na:begin -->' "$A/.ai-factory/tool-decisions.md" \
  && ok "A: declarative Hono → install recorded the conditional R2 N/A block" \
  || bad "A: no R2 N/A block recorded (decisions tail: $(tail -5 "$A/.ai-factory/tool-decisions.md" | tr '\n' '|'))"
OUT=$(globs "$A"); RC=$?
[ "$RC" = "0" ] \
  && ok "A: check:globs is GREEN out of the box (was red-because-unconfigured)" \
  || bad "A: check:globs exited $RC (expected 0 — the red→green fix failed). out: $(printf '%s' "$OUT" | tail -3 | tr '\n' '|')"

# ── Fixture B — hand-rolled parse boundary: globs patched, gate green because WIRED ────
B=$(mktemp -d)
printf '{"name":"b","version":"0.0.0"}\n' > "$B/package.json"
mkdir -p "$B/src/api"; echo 'export const h = (b) => schema.parse(b);' > "$B/src/api/handler.ts"
install_into "$B" ts-server
grep -qF "'**/api/**/*.{ts,tsx}'" "$B/eslint.config.mjs" \
  && ok "B: parse boundary in src/api → RULE_GLOBS.boundary patched to cover it" \
  || bad "B: eslint.config.mjs boundary NOT patched ($(grep -n 'api' "$B/eslint.config.mjs" | tr '\n' '|'))"
! grep -qF '<!-- aif:r2-na:begin -->' "$B/.ai-factory/tool-decisions.md" \
  && ok "B: a real boundary → NO N/A recorded (R2 stays active, not waived)" \
  || bad "B: a parse boundary was wrongly waived as N/A"
OUT=$(globs "$B"); RC=$?
[ "$RC" = "0" ] \
  && ok "B: check:globs GREEN because the boundary glob now matches src/api/handler.ts" \
  || bad "B: check:globs exited $RC (expected 0 after wiring). out: $(printf '%s' "$OUT" | tail -3 | tr '\n' '|')"

# ── Fixture C — precondition breaks: A goes green, then a parse appears → stale FAIL ──
# Reuse fixture A (already green with a recorded N/A), then plant a parse boundary.
mkdir -p "$A/src/api"; echo 'export const h = (b) => payload.parse(b);' > "$A/src/api/late.ts"
OUT=$(globs "$A"); RC=$?
[ "$RC" = "1" ] \
  && ok "C: N/A was recorded but a parse boundary later appears → check:globs FAILS (conditional, not permanent)" \
  || bad "C: stale marker did not flip to red (rc=$RC) — N/A would be a forever off-switch"
printf '%s' "$OUT" | grep -qiE 'marked N/A.*parse boundary now exists' \
  && ok "C: stale-marker FAIL names the broken precondition" \
  || bad "C: no stale-marker message (out: $(printf '%s' "$OUT" | tr '\n' '|'))"

# ── Fixture D — ambiguous (JSON.parse only, framework unknown): stays today's RED ─────
D=$(mktemp -d)
printf '{"name":"d","version":"0.0.0"}\n' > "$D/package.json"
mkdir -p "$D/src"; echo 'export const c = JSON.parse(raw);' > "$D/src/cfg.ts"
install_into "$D" ts-server
! grep -qF '<!-- aif:r2-na:begin -->' "$D/.ai-factory/tool-decisions.md" \
  && ok "D: ambiguous → NO auto-green (no N/A recorded)" \
  || bad "D: ambiguous layout was wrongly auto-greened with an N/A record"
OUT=$(globs "$D"); RC=$?
[ "$RC" = "1" ] \
  && ok "D: ambiguous → check:globs stays the RED alarm (no false auto-green on doubt)" \
  || bad "D: ambiguous layout did not stay red (rc=$RC)"

# ── Fixture E — the consumer owns eslint.config.mjs: a boundary is found, nothing is patched ──
# A plain install keeps a pre-existing config (copy_safe skip + report — operator decision
# 2026-09-23). The auto-wire used to rewrite it anyway: awk + mv over the consumer's file, and a
# «✓ added 1 glob(s)» even when the config had no `boundary: [` line and nothing changed. This
# config carries such a line, so an unguarded patch would visibly change it.
E=$(mktemp -d)
printf '{"name":"e","version":"0.0.0"}\n' > "$E/package.json"
mkdir -p "$E/src/api"; echo 'export const h = (b) => schema.parse(b);' > "$E/src/api/handler.ts"
cat > "$E/eslint.config.mjs" <<'JS'
// The consumer's own config; its RULE_GLOBS-like block is theirs, not getff's.
const OWN = {
  boundary: [
    'server/**/*.ts',
  ],
};
export default [{ files: OWN.boundary, rules: {} }];
JS
cp "$E/eslint.config.mjs" "$E.before"
( cd "$E" && git init -q && bash "$REPO_ROOT/install.sh" ts-server </dev/null ) >"$E.log" 2>&1
rc_e=$?
[ "$rc_e" = "0" ] || bad "E: install rc=$rc_e (tail: $(tail -3 "$E.log" | tr '\n' '|'))"
grep -q 'R2 auto-wire' "$E.log" || bad "E: the R2 auto-wire never ran — the arm below would be vacuous"
cmp -s "$E/eslint.config.mjs" "$E.before" \
  && ok "E: a boundary in the consumer's own config's project → eslint.config.mjs byte-identical" \
  || bad "E: the R2 auto-wire rewrote the consumer's eslint.config.mjs ($(diff "$E.before" "$E/eslint.config.mjs" | head -4 | tr '\n' '|'))"
! grep -q 'added [0-9]* glob(s) to RULE_GLOBS.boundary' "$E.log" \
  && ok "E: no «added N glob(s)» claim over a config the install did not touch" \
  || bad "E: the install claimed it added globs to the consumer's config"
awk '/NOT wired, or wired only in part/{on=1} on' "$E.log" | grep -q 'R2.*your own config' \
  && ok "E: the not-wired summary says R2 is not wired into the consumer's own config" \
  || bad "E: the not-wired summary does not report the unwired R2 boundary"
rm -f "$E.before" "$E.log"

# ── Fixture F — getff's own config with no `boundary: [` array (react-native ships none) ──────
# The awk patch copies such a config unchanged; the counter still went up and the install said
# «✓ added 1 glob(s)» over a file it had not changed.
F=$(mktemp -d)
printf '{"name":"f","version":"0.0.0","dependencies":{"react-native":"0.74.0","react":"18.2.0"}}\n' > "$F/package.json"
mkdir -p "$F/src/api"; echo 'export const h = (b) => schema.parse(b);' > "$F/src/api/handler.ts"
install_into "$F" react-native
grep -q 'R2 auto-wire' "$F/.install.log" || bad "F: the R2 auto-wire never ran — the arm below would be vacuous"
! grep -q 'added [0-9]* glob(s) to RULE_GLOBS.boundary' "$F/.install.log" \
  && ok "F: a config with no boundary array → no «added N glob(s)» claim" \
  || bad "F: the install claimed it added globs to a config that has no RULE_GLOBS.boundary array"

# ── Self-probe (T15 / spec §8): C1 on THIS repo must be honest, never a false confident-N/A ──
SELF=$( bash "$REPO_ROOT/packages/core/audit-self/detect-r2-boundary.sh" 2>/dev/null | head -1 )
[ "$SELF" != "no-boundary-confident" ] \
  && ok "self-probe: this repo classifies as '$SELF' (honest — never a false no-boundary-confident)" \
  || bad "self-probe: this repo returned no-boundary-confident — a false N/A on the framework's own layout"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
