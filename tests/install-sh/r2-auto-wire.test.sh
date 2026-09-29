#!/usr/bin/env bash
# r2-auto-wire.test.sh — GH #547 Point 2 C2/C3 end-to-end. Fixtures A–G2 + self-probe. Each arm
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
# The not-wired summary of an install log: one «- …» line per piece, up to the blank line that ends it.
not_wired() { awk '/NOT wired, or wired only in part/{on=1; next} on && /^[[:space:]]*$/{exit} on' "$1"; }

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
grep -qiE 'marked N/A.*parse boundary now exists' <<<"$OUT" \
  && ok "C: stale-marker FAIL names the broken precondition" \
  || bad "C: no stale-marker message (out: $(printf '%s' "$OUT" | tr '\n' '|'))"

# ── Fixture D — no HTTP boundary yet (JSON.parse only, no framework, no zod), getff's own config ──
# P2 K2 (2026-09-29): the same conditional N/A as fixture A, with its own wording — the gates
# re-check it, so the first boundary file turns them red on new code (fixture D3).
D=$(mktemp -d)
printf '{"name":"d","version":"0.0.0"}\n' > "$D/package.json"
mkdir -p "$D/src"; echo 'export const c = JSON.parse(raw);' > "$D/src/cfg.ts"
install_into "$D" ts-server
grep -qF 'N/A until an HTTP boundary appears' "$D/.ai-factory/tool-decisions.md" \
  && ok "D: no boundary yet + getff's own config → the R2 N/A block is recorded, worded «until an HTTP boundary appears»" \
  || bad "D: no-boundary-yet N/A not recorded (decisions tail: $(tail -5 "$D/.ai-factory/tool-decisions.md" | tr '\n' '|'))"
[ "$(grep -c '<!-- aif:r2-na:begin -->' "$D/.ai-factory/tool-decisions.md")" = 1 ] \
  && ok "D: exactly one R2 N/A block" || bad "D: $(grep -c 'aif:r2-na:begin' "$D/.ai-factory/tool-decisions.md") R2 N/A blocks"
OUT=$(globs "$D"); RC=$?
[ "$RC" = "0" ] \
  && ok "D: no boundary yet → check:globs GREEN (it was red on every push)" \
  || bad "D: check:globs exited $RC. out: $(printf '%s' "$OUT" | tail -3 | tr '\n' '|')"

# ── Fixture D1 — the same layout with zod declared: ambiguous, stays today's RED ──────────────
D1=$(mktemp -d)
printf '{"name":"d1","version":"0.0.0","dependencies":{"zod":"^3.23.0"}}\n' > "$D1/package.json"
mkdir -p "$D1/src"; echo 'export const c = JSON.parse(raw);' > "$D1/src/cfg.ts"
install_into "$D1" ts-server
! grep -qF '<!-- aif:r2-na:begin -->' "$D1/.ai-factory/tool-decisions.md" \
  && ok "D1: zod declared, no signal → ambiguous → NO N/A recorded" \
  || bad "D1: an ambiguous layout was auto-greened with an N/A record"
OUT=$(globs "$D1"); RC=$?
[ "$RC" = "1" ] \
  && ok "D1: ambiguous → check:globs stays the RED alarm (no false auto-green on doubt)" \
  || bad "D1: ambiguous layout did not stay red (rc=$RC)"

# ── Fixture D3 — no boundary yet, then a boundary file appears: the waiver ends, no human step ──
# The gate judges R2's globs as usual — the default globs cover routes/ — and R2 itself (always on
# in getff's config) lints the new code.
mkdir -p "$D/src/routes"; echo 'export const r = 1;' > "$D/src/routes/users.ts"
OUT=$(globs "$D"); RC=$?
[ "$RC" = "0" ] && grep -q 'no longer holds' <<<"$OUT" \
  && ok "D3: the first boundary file after a no-boundary-yet N/A → the N/A stops applying, check:globs judges the covering globs" \
  || bad "D3: rc=$RC out: $(printf '%s' "$OUT" | tail -3 | tr '\n' '|')"
rm -rf "$D/src/routes"

# ── Fixture D2 — the no-boundary-yet layout after the consumer edited getff's config ──────────
# Ownership guard (P2 K2): the waiver is for getff's own, unedited config only. An edited config is
# the consumer's (getff_delivered AND getff_bytes_intact, as everywhere else in 60-ci): the layout
# reads as ambiguous for it, so the re-install drops the N/A it recorded and the message says why.
printf '\n// edited by the consumer\n' >> "$D/eslint.config.mjs"
( cd "$D" && bash "$REPO_ROOT/install.sh" ts-server </dev/null ) >"$D/.install2.log" 2>&1 \
  || bad "D2: the re-install exited non-zero (tail: $(tail -3 "$D/.install2.log" | tr '\n' '|'))"
grep -q 'edited since' <<<"$(grep 'R2 boundary layout ambiguous' "$D/.install2.log")" \
  && ! grep -q 'keeps its default globs' "$D/.install2.log" \
  && ok "D2: no boundary yet with getff's config edited since → ambiguous, the message says so" \
  || bad "D2: the message still reads the edited config as getff's: $(grep 'R2 boundary layout' "$D/.install2.log" | tr '\n' '|')"
! grep -qF 'aif:r2-na' "$D/.ai-factory/tool-decisions.md" \
  && ok "D2: the edited config's re-install removes the no-boundary-yet N/A (the waiver is for getff's own config only)" \
  || bad "D2: the N/A survived on a config the consumer has edited"

# ── Fixture E — the consumer owns eslint.config.mjs: a boundary is found, the awk patch stays off ──
# The awk glob patch is for getff's own config only. It used to rewrite a consumer's config: awk +
# mv over their file, and a «✓ added 1 glob(s)» even when the config had no `boundary: [` line and
# nothing changed. This config carries such a line, so an unguarded patch would visibly change it.
# A consumer's config gets RULE_GLOBS and R2 from synth-and-wire --own-config instead (Q4.7,
# 2026-09-28), which needs ts-morph: a plain install has none, so the file stays as it was and the
# not-wired summary says a --full install adds them (synth-wire-consumer-config.test.sh arm R
# covers the write itself).
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
grep -q 'R2.*your own config.*--full' <<<"$(awk '/NOT wired, or wired only in part/{on=1} on' "$E.log")" \
  && ok "E: the not-wired summary says R2 is not in the consumer's own config yet, and that --full adds it" \
  || bad "E: the not-wired summary does not report the unwired R2 boundary with the --full way to add it"
! grep -qiE 'by hand|manually' <<<"$(grep -iE 'eslint|R2' "$E.log")" \
  && ok "E: nothing asks for a manual ESLint edit" \
  || bad "E: the install asks for a manual ESLint edit: $(grep -iE 'eslint|R2' "$E.log" | grep -iE 'by hand|manually' | head -2 | tr '\n' '|')"
rm -f "$E.before" "$E.log"

# ── Fixture E2 — the consumer's own config registers R2 itself, with no RULE_GLOBS block ───────
# The own-config wirer adds RULE_GLOBS and R2 only to a config that has neither; R2 registered by the
# consumer, scoped their own way, gets nothing from it — not with --full either. So the not-wired
# summary must not promise R2's boundary globs for this config.
E2=$(mktemp -d)
printf '{"name":"e2","version":"0.0.0"}\n' > "$E2/package.json"
mkdir -p "$E2/src/api"; echo 'export const h = (b) => schema.parse(b);' > "$E2/src/api/handler.ts"
cat > "$E2/eslint.config.mjs" <<'JS'
// The consumer's own config: R2 on, scoped the consumer's way, no RULE_GLOBS block.
import rulesAsTests from './eslint-rules-local/index.mjs';
export default [
  { files: ['src/**/*.ts'], plugins: { 'rules-as-tests': rulesAsTests }, rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } },
];
JS
( cd "$E2" && git init -q && bash "$REPO_ROOT/install.sh" ts-server </dev/null ) >"$E2.log" 2>&1 \
  || bad "E2: install exited non-zero (tail: $(tail -3 "$E2.log" | tr '\n' '|'))"
grep -q 'eslint.config.mjs is your own config' "$E2.log" \
  || bad "E2: 60-ci did not route the consumer's config as their own — the arm below would be vacuous"
# The lines about R2 and its RULE_GLOBS in this config. Naming RULE_GLOBS is required, not forbidden:
# scripts/check-rule-globs.sh is red on this config, and r2-glob-reach.test.sh T17/T19/T20 hold the
# install to saying so. What E2 forbids is a promise that getff, or a --full install, adds the globs.
# The «getff's rules in eslint.config.mjs … adding them needs ts-morph» line is left out: it is about
# getff's synthesized rules, which a --full install does add — a true promise, and arm E relies on it.
_e2_line=$(not_wired "$E2.log" | grep -F 'eslint.config.mjs' | grep -E 'RULE_GLOBS|no-unsafe-zod-parse' \
  | grep -vF "getff's rules in eslint.config.mjs")
[ -n "$_e2_line" ] || bad "E2: no not-wired line names RULE_GLOBS or R2 for eslint.config.mjs — the arm below would be vacuous"
! grep -qiE 'boundary glob|--full' <<<"$_e2_line" \
  && ok "E2: R2 registered by the consumer without RULE_GLOBS → the summary promises no boundary globs getff would not add" \
  || bad "E2: the not-wired summary promises R2 boundary globs for a config the wirer leaves R2 alone in: $(printf '%s' "$_e2_line" | tr '\n' '|')"
rm -f "$E2.log"

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
# The react-native preset ships no R2 and its config no RULE_GLOBS block, so there is nothing to
# widen: a per-glob «could not add» warning and «widen RULE_GLOBS.boundary by hand» are wrong advice.
! grep -qE 'could not add glob|widen RULE_GLOBS.boundary by hand' "$F/.install.log" \
  && ok "F: no «could not add glob» / «widen RULE_GLOBS.boundary by hand» advice for a config with no RULE_GLOBS block" \
  || bad "F: the install told the consumer to widen a RULE_GLOBS.boundary their stack's config does not have"
grep -q 'has no RULE_GLOBS block' "$F/.install.log" \
  && ok "F: the install says why R2 is not wired (this stack's config has no RULE_GLOBS block)" \
  || bad "F: no line saying the stack's config has no RULE_GLOBS block"
# Q4.7: HTTP boundary code R2 does not check is a gap — packages/preset-react-native/RULES.md:17
# lists R2 for every stack — so the NOT wired summary names it with the reason, not only the scroll.
RN_R2_LINE='R2 (rules-as-tests/no-unsafe-zod-parse) in eslint.config.mjs — .*react-native preset ships no R2'
grep -q "$RN_R2_LINE" <<<"$(not_wired "$F/.install.log")" \
  && ok "F: the NOT wired summary names the boundary code R2 does not check, with the react-native reason" \
  || bad "F: no NOT wired line for R2 naming the react-native preset (summary: $(not_wired "$F/.install.log" | tr '\n' '|'))"

# ── Fixture F2 — the consumer's own eslint.config.mjs in a react-native repo with boundary code ──
# 60-ci.sh takes the own-config branch here (no --force, so 40-configs keeps the consumer's file).
F2=$(mktemp -d)
printf '{"name":"f2","version":"0.0.0","dependencies":{"react-native":"0.74.0","react":"18.2.0"}}\n' > "$F2/package.json"
mkdir -p "$F2/src/api"; echo 'export const h = (b) => schema.parse(b);' > "$F2/src/api/handler.ts"
printf "export default [{ rules: { 'no-console': 'warn' } }];\n" > "$F2/eslint.config.mjs"
( cd "$F2" && git init -q && bash "$REPO_ROOT/install.sh" react-native </dev/null ) >"$F2/.install.log" 2>&1 \
  || bad "F2: install rc non-zero (tail: $(tail -3 "$F2/.install.log" | tr '\n' '|'))"
grep -q 'preset ships no R2 — nothing to add to your eslint.config.mjs' "$F2/.install.log" \
  || bad "F2: the own-config branch of the R2 auto-wire never ran — the arm below would be vacuous"
grep -q "$RN_R2_LINE" <<<"$(not_wired "$F2/.install.log")" \
  && ok "F2: the consumer's own react-native config with boundary code → a NOT wired line with the reason" \
  || bad "F2: no NOT wired line for R2 naming the react-native preset (summary: $(not_wired "$F2/.install.log" | tr '\n' '|'))"

# ── Fixture F0 — paired: a react-native repo with no HTTP boundary code → no R2 line ──────────
F0=$(mktemp -d)
printf '{"name":"f0","version":"0.0.0","dependencies":{"react-native":"0.74.0","react":"18.2.0"}}\n' > "$F0/package.json"
mkdir -p "$F0/src"; echo 'export const x = 1;' > "$F0/src/index.ts"
install_into "$F0" react-native
grep -q 'R2 auto-wire' "$F0/.install.log" || bad "F0: the R2 auto-wire never ran — the arm below would be vacuous"
! grep -q 'R2 (rules-as-tests/no-unsafe-zod-parse)' <<<"$(not_wired "$F0/.install.log")" \
  && ok "F0: paired — a react-native repo with no HTTP boundary code gets no R2 line" \
  || bad "F0: an R2 line for a react-native repo with no HTTP boundary code (summary: $(not_wired "$F0/.install.log" | tr '\n' '|'))"

# ── Fixture F3 — paired: the consumer's own react-native config already names R2 → no R2 line ──
# eslint.config.js, not .mjs: the check must read the config the install found, whatever its name.
F3=$(mktemp -d)
printf '{"name":"f3","version":"0.0.0","dependencies":{"react-native":"0.74.0","react":"18.2.0"}}\n' > "$F3/package.json"
mkdir -p "$F3/src/api"; echo 'export const h = (b) => schema.parse(b);' > "$F3/src/api/handler.ts"
printf "export default [{ rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } }];\n" > "$F3/eslint.config.js"
( cd "$F3" && git init -q && bash "$REPO_ROOT/install.sh" react-native </dev/null ) >"$F3/.install.log" 2>&1 \
  || bad "F3: install rc non-zero (tail: $(tail -3 "$F3/.install.log" | tr '\n' '|'))"
grep -q 'preset ships no R2 — nothing to add to your eslint.config.js' "$F3/.install.log" \
  || bad "F3: the own-config branch never ran on eslint.config.js — the arm below would be vacuous"
! grep -q 'R2 (rules-as-tests/no-unsafe-zod-parse)' <<<"$(not_wired "$F3/.install.log")" \
  && ok "F3: paired — a react-native config of the consumer's that already names R2 gets no R2 line" \
  || bad "F3: an R2 line for a config that already names R2 (summary: $(not_wired "$F3/.install.log" | tr '\n' '|'))"

# ── Fixture F4 — the same react-native project after the consumer edited getff's config ────────
# An edited config is the consumer's, and react-native's preset still ships no R2: nothing is
# written and nothing is promised. As for the consumer's own react-native config (F2, Q4.7), the
# NOT wired summary names the HTTP boundary code R2 does not check.
printf '\n// edited by the consumer\n' >> "$F/eslint.config.mjs"; cp "$F/eslint.config.mjs" "$F.edited"
( cd "$F" && bash "$REPO_ROOT/install.sh" react-native </dev/null ) >"$F/.install2.log" 2>&1 \
  || bad "F4: the re-install exited non-zero (tail: $(tail -3 "$F/.install2.log" | tr '\n' '|'))"
grep -q 'ships no R2' "$F/.install2.log" && cmp -s "$F/eslint.config.mjs" "$F.edited" \
  && ! grep -qE 'could not add glob|added [0-9]* glob' "$F/.install2.log" \
  && ok "F4: getff's edited react-native config → no R2 to add, the file is left as the consumer left it" \
  || bad "F4: the re-install wrote, or tried to write, R2 globs into the edited react-native config: $(grep -A2 'R2 auto-wire' "$F/.install2.log" | tr '\n' '|')"
grep -q "$RN_R2_LINE" <<<"$(not_wired "$F/.install2.log")" \
  && ok "F4: getff's edited react-native config with boundary code → a NOT wired line with the react-native reason" \
  || bad "F4: no NOT wired line for R2 naming the react-native preset (summary: $(not_wired "$F/.install2.log" | tr '\n' '|'))"
rm -f "$F.edited"

# ── Fixture G — getff's own config whose `boundary: [` array was edited away, then a re-install ──
# The edit makes the config the consumer's, as for the synth-wire (getff_delivered AND
# getff_bytes_intact): 60-ci no longer writes into it, and its boundary globs go to 99-finalize's
# own-config pass. That pass does not redefine a RULE_GLOBS the config declares, so with the
# boundary array gone R2 is refused with or without ts-morph, and --full is no remedy. The file stays
# as the consumer left it. The install used to answer «widen RULE_GLOBS.boundary by hand» on stderr
# and put nothing in the NOT-wired summary (cold-review F5b, Q4.7: never a manual step). The summary
# must name what is not wired and the real reason — the one the wirer itself gives.
G=$(mktemp -d)
printf '{"name":"g","version":"0.0.0"}\n' > "$G/package.json"
mkdir -p "$G/src/api"; echo 'export const h = (b) => schema.parse(b);' > "$G/src/api/handler.ts"
install_into "$G" ts-server
awk '/^[[:space:]]*boundary:[[:space:]]*\[/{skip=1} skip{ if ($0 ~ /\]/) skip=0; next } { print }' \
  "$G/eslint.config.mjs" > "$G/eslint.config.mjs.edit" && mv "$G/eslint.config.mjs.edit" "$G/eslint.config.mjs"
grep -q 'RULE_GLOBS' "$G/eslint.config.mjs" && ! grep -qE '^[[:space:]]*boundary:' "$G/eslint.config.mjs" \
  || bad "G: the fixture edit did not leave RULE_GLOBS without its boundary array — the arm below would be vacuous"
cp "$G/eslint.config.mjs" "$G.edited"
( cd "$G" && bash "$REPO_ROOT/install.sh" ts-server </dev/null ) >"$G/.install2.log" 2>&1 \
  || bad "G: the re-install exited non-zero (tail: $(tail -3 "$G/.install2.log" | tr '\n' '|'))"
grep -q 'getff placed eslint.config.mjs, and it has been edited since, so it is treated as your own config' "$G/.install2.log" \
  && ok "G: 60-ci treats getff's edited config as the consumer's" \
  || bad "G: 60-ci did not route the edited config as the consumer's: $(grep -A2 'R2 auto-wire' "$G/.install2.log" | tr '\n' '|')"
cmp -s "$G/eslint.config.mjs" "$G.edited" && ! grep -q 'could not add glob' "$G/.install2.log" \
  && ok "G: the edited config is left as the consumer left it — 60-ci does not write into it" \
  || bad "G: the re-install wrote into the edited config, or tried to: $(diff "$G.edited" "$G/eslint.config.mjs" | head -3 | tr '\n' '|')"
! grep -qiE 'by hand|manually' "$G/.install2.log" \
  && ok "G: a boundary glob getff cannot write → no manual-edit advice" \
  || bad "G: the install asks for a manual edit: $(grep -iE 'by hand|manually' "$G/.install2.log" | head -1)"
# Here-strings, never `producer | grep -q`: under pipefail grep -q exits on its first match, a
# producer still writing dies of SIGPIPE, the pipeline returns 141 and the arm flips under load
# (2026-09-29, 12-way battery). Every `| grep -q` in tests/install-sh went the same way.
_g_line=$(not_wired "$G/.install2.log" | grep -F 'eslint.config.mjs')
grep -qF 'declares its own RULE_GLOBS with no boundary array, and getff does not redefine it' <<<"$_g_line" \
  && ! grep -q -- '--full' <<<"$_g_line" \
  && ok "G: the not-wired summary says R2 is refused because the config declares RULE_GLOBS with no boundary array — not --full, which would not add it either" \
  || bad "G: the not-wired summary does not give the wirer's reason for R2 in eslint.config.mjs: $(printf '%s' "$_g_line" | head -2 | tr '\n' '|')"
rm -f "$G.edited"

# ── Fixture G3 — getff's own, untouched config whose glob write fails ────────────────────────────
# 60-ci still writes into getff's own config itself; a write that fails (here the temp file it
# writes through is a directory) must be a NOT-wired line with its reason, never «✓ added» and
# never a manual step. The reason is the one that happened: the config has its `boundary: [` array.
G3=$(mktemp -d)
printf '{"name":"g3","version":"0.0.0"}\n' > "$G3/package.json"
mkdir -p "$G3/src/api" "$G3/eslint.config.mjs.tmp"; echo 'export const h = (b) => schema.parse(b);' > "$G3/src/api/handler.ts"
install_into "$G3" ts-server
grep -q 'could not add glob' "$G3/.install.log" \
  || bad "G3: the glob write never failed — the arm below would be vacuous"
! grep -q 'added [0-9]* glob(s) to RULE_GLOBS.boundary' "$G3/.install.log" && ! grep -qiE 'by hand|manually' "$G3/.install.log" \
  && ok "G3: a failed glob write → no «added N glob(s)» claim and no manual-edit advice" \
  || bad "G3: the install claimed the globs, or asked for a manual edit, after a failed write"
_g3_line=$(not_wired "$G3/.install.log" | grep -F 'RULE_GLOBS.boundary of eslint.config.mjs')
grep -q 'the write failed' <<<"$_g3_line" && ! grep -qF 'no `boundary: [` array' <<<"$_g3_line" \
  && ok "G3: the not-wired summary names the boundary globs that were not added, and the one reason that applies" \
  || bad "G3: the not-wired summary does not report the failed glob write, or offers a cause that did not happen: $(printf '%s' "$_g3_line" | tr '\n' '|')"

# ── Fixture G2 — getff's ts-server config with its whole RULE_GLOBS block edited away, re-install ──
# The «no RULE_GLOBS block» branch is chosen by the config's shape, not the stack. For a stack whose
# preset ships R2 the reason is the edit, never «the preset ships no R2» (that is react-native's).
G2=$(mktemp -d)
printf '{"name":"g2","version":"0.0.0"}\n' > "$G2/package.json"
mkdir -p "$G2/src/api"; echo 'export const h = (b) => schema.parse(b);' > "$G2/src/api/handler.ts"
install_into "$G2" ts-server
sed 's/RULE_GLOBS/BOUNDARY_GLOBS/g' "$G2/eslint.config.mjs" > "$G2/eslint.config.mjs.edit" \
  && mv "$G2/eslint.config.mjs.edit" "$G2/eslint.config.mjs"
! grep -q 'RULE_GLOBS' "$G2/eslint.config.mjs" \
  || bad "G2: the fixture edit left a RULE_GLOBS block — the arms below would be vacuous"
( cd "$G2" && bash "$REPO_ROOT/install.sh" ts-server </dev/null ) >"$G2/.install2.log" 2>&1 \
  || bad "G2: the re-install exited non-zero (tail: $(tail -3 "$G2/.install2.log" | tr '\n' '|'))"
grep -q 'R2 auto-wire (reading the repo)' "$G2/.install2.log" \
  || bad "G2: the R2 auto-wire never ran on the re-install — the arms below would be vacuous"
! grep -q 'preset ships no R2' "$G2/.install2.log" \
  && ok "G2: a ts-server config without RULE_GLOBS → no «preset ships no R2» claim" \
  || bad "G2: the install says the ts-server preset ships no R2: $(grep 'preset ships no R2' "$G2/.install2.log" | head -1)"
# An edited getff config is the consumer's (fixture G): its globs go to 99-finalize's own-config
# pass, not to the «no RULE_GLOBS block» branch. The renamed block here still hands R2 its boundary
# array, so that pass finds R2 in place — there is no gap, and the summary must not invent one.
grep -q 'getff placed eslint.config.mjs, and it has been edited since, so it is treated as your own config' "$G2/.install2.log" \
  && grep -qF "'rules-as-tests/no-unsafe-zod-parse'" "$G2/eslint.config.mjs" \
  && ! grep -qE 'R2 \(rules-as-tests/no-unsafe-zod-parse\)|R2 boundary globs|R2 not wired' <<<"$(not_wired "$G2/.install2.log")" \
  && ok "G2: the edited ts-server config goes to the own-config pass, which finds R2 in place → no false R2 gap in the NOT wired summary" \
  || bad "G2: the edited config was not routed as the consumer's, lost R2, or the summary names an R2 gap (summary: $(not_wired "$G2/.install2.log" | grep -E 'R2|eslint.config' | tr '\n' '|'))"

# ── Fixture H — N/A recorded, a boundary appears, the install is re-run ──────────────────────
# The no-boundary-confident branch replaces an older N/A block; the boundary branches never removed
# one. The stale marker then made check:globs fail «marked N/A» on every push, even after the
# re-install had widened RULE_GLOBS.boundary to cover the new code. A re-install that finds the
# precondition broken must drop the block it recorded, so the gate judges the wired globs instead.
H=$(mktemp -d)
printf '{"name":"h","version":"0.0.0","dependencies":{"@hono/zod-openapi":"^0.9.0"}}\n' > "$H/package.json"
mkdir -p "$H/src"; echo 'export const app = 1;' > "$H/src/app.ts"
install_into "$H" ts-server
grep -qF '<!-- aif:r2-na:begin -->' "$H/.ai-factory/tool-decisions.md" \
  || bad "H: the first install recorded no R2 N/A block — the arm below would be vacuous"
echo 'Consumer note kept after the block.' >> "$H/.ai-factory/tool-decisions.md"
mkdir -p "$H/src/api"; echo 'export const h = (b) => schema.parse(b);' > "$H/src/api/handler.ts"
( cd "$H" && bash "$REPO_ROOT/install.sh" ts-server </dev/null ) >"$H/.install2.log" 2>&1 \
  || bad "H: the re-install exited non-zero (tail: $(tail -3 "$H/.install2.log" | tr '\n' '|'))"
grep -qF "'**/api/**/*.{ts,tsx}'" "$H/eslint.config.mjs" \
  || bad "H: the re-install did not widen RULE_GLOBS.boundary — the arm below would be vacuous"
! grep -qF 'aif:r2-na' "$H/.ai-factory/tool-decisions.md" \
  && ok "H: a boundary found on re-install → the stale R2 N/A block is removed" \
  || bad "H: the stale R2 N/A block survived the re-install ($(grep -n 'aif:r2-na' "$H/.ai-factory/tool-decisions.md" | tr '\n' '|'))"
grep -qF 'Consumer note kept after the block.' "$H/.ai-factory/tool-decisions.md" \
  && ok "H: the consumer's own lines in tool-decisions.md survive the removal" \
  || bad "H: removing the N/A block took the consumer's own lines with it"
grep -q 'removed the R2 N/A' "$H/.install2.log" \
  && ok "H: the install says it removed the stale R2 N/A record" \
  || bad "H: the install removed nothing or said nothing about the stale R2 N/A record"
OUT=$(globs "$H"); RC=$?
[ "$RC" = "0" ] \
  && ok "H: check:globs GREEN after the re-install (no «marked N/A» red)" \
  || bad "H: check:globs exited $RC after the re-install. out: $(printf '%s' "$OUT" | tail -3 | tr '\n' '|')"
OUT=$( cd "$H" && AIF_ESLINT_CMD=true bash scripts/check-rule-enforced.sh 2>&1 )
! grep -q 'stale R2 N/A marker' <<<"$OUT" \
  && ok "H: check:enforced no longer fails on a stale R2 N/A marker" \
  || bad "H: check:enforced still fails on the stale marker. out: $(printf '%s' "$OUT" | tail -2 | tr '\n' '|')"

# ── Fixture H2 — N/A recorded, then the layout turns ambiguous (the declarative framework is gone, zod stays) ──
# The gates read ambiguous as a broken precondition too (r2_na_recheck → broke), so a re-install
# drops the block here as well and the gate falls back to judging the default globs.
H2=$(mktemp -d)
printf '{"name":"h2","version":"0.0.0","dependencies":{"@hono/zod-openapi":"^0.9.0"}}\n' > "$H2/package.json"
mkdir -p "$H2/src"; echo 'export const app = 1;' > "$H2/src/app.ts"
install_into "$H2" ts-server
grep -qF '<!-- aif:r2-na:begin -->' "$H2/.ai-factory/tool-decisions.md" \
  || bad "H2: the first install recorded no R2 N/A block — the arm below would be vacuous"
printf '{"name":"h2","version":"0.0.0","dependencies":{"zod":"^3.23.0"}}\n' > "$H2/package.json"
[ "$( cd "$H2" && bash "$REPO_ROOT/packages/core/audit-self/detect-r2-boundary.sh" | head -1 )" = ambiguous ] \
  || bad "H2: the edited fixture does not classify as ambiguous — the arm below would be vacuous"
( cd "$H2" && bash "$REPO_ROOT/install.sh" ts-server </dev/null ) >"$H2/.install2.log" 2>&1 \
  || bad "H2: the re-install exited non-zero (tail: $(tail -3 "$H2/.install2.log" | tr '\n' '|'))"
! grep -qF 'aif:r2-na' "$H2/.ai-factory/tool-decisions.md" \
  && ok "H2: a layout turned ambiguous on re-install → the stale R2 N/A block is removed" \
  || bad "H2: the stale R2 N/A block survived an ambiguous re-install"
! grep -q 'marked N/A' <<<"$(globs "$H2")" \
  && ok "H2: check:globs no longer reports «marked N/A» (it judges the default globs again)" \
  || bad "H2: check:globs still reports the stale «marked N/A»"

# ── Fixture H4 — N/A recorded (declarative), then the framework AND zod go: no boundary yet ──────
# The layout still waives R2 (P2 K2), so the re-install replaces the block with the no-boundary-yet
# wording — one block, never two — and the gate stays green.
H4=$(mktemp -d)
printf '{"name":"h4","version":"0.0.0","dependencies":{"@hono/zod-openapi":"^0.9.0"}}\n' > "$H4/package.json"
mkdir -p "$H4/src"; echo 'export const app = 1;' > "$H4/src/app.ts"
install_into "$H4" ts-server
printf '{"name":"h4","version":"0.0.0"}\n' > "$H4/package.json"
( cd "$H4" && bash "$REPO_ROOT/install.sh" ts-server </dev/null ) >"$H4/.install2.log" 2>&1 \
  || bad "H4: the re-install exited non-zero (tail: $(tail -3 "$H4/.install2.log" | tr '\n' '|'))"
[ "$(grep -c '<!-- aif:r2-na:begin -->' "$H4/.ai-factory/tool-decisions.md")" = 1 ] \
  && grep -qF 'N/A until an HTTP boundary appears' "$H4/.ai-factory/tool-decisions.md" \
  && ! grep -qF 'validation is declarative' "$H4/.ai-factory/tool-decisions.md" \
  && ok "H4: declarative → no-boundary-yet on re-install → one block, reworded" \
  || bad "H4: blocks=$(grep -c 'aif:r2-na:begin' "$H4/.ai-factory/tool-decisions.md"): $(grep -A2 'aif:r2-na:begin' "$H4/.ai-factory/tool-decisions.md" | tr '\n' '|')"
[ "$(globs "$H4" >/dev/null 2>&1; echo $?)" = 0 ] && ok "H4: check:globs GREEN" || bad "H4: check:globs red after the reworded N/A"

# ── Fixture H3 — a recorded block whose end line was edited away, then a boundary appears ──────
# The strip skips from begin to end; with no end it would cut the rest of the consumer's file.
# The install must leave the file as it is and name the record it could not remove.
H3=$(mktemp -d)
printf '{"name":"h3","version":"0.0.0","dependencies":{"@hono/zod-openapi":"^0.9.0"}}\n' > "$H3/package.json"
mkdir -p "$H3/src"; echo 'export const app = 1;' > "$H3/src/app.ts"
install_into "$H3" ts-server
grep -v 'aif:r2-na:end' "$H3/.ai-factory/tool-decisions.md" > "$H3/td" && mv "$H3/td" "$H3/.ai-factory/tool-decisions.md"
echo 'Consumer note after a truncated block.' >> "$H3/.ai-factory/tool-decisions.md"
cp "$H3/.ai-factory/tool-decisions.md" "$H3.before"
mkdir -p "$H3/src/api"; echo 'export const h = (b) => schema.parse(b);' > "$H3/src/api/handler.ts"
( cd "$H3" && bash "$REPO_ROOT/install.sh" ts-server </dev/null ) >"$H3/.install2.log" 2>&1 \
  || bad "H3: the re-install exited non-zero (tail: $(tail -3 "$H3/.install2.log" | tr '\n' '|'))"
cmp -s "$H3/.ai-factory/tool-decisions.md" "$H3.before" \
  && ok "H3: a block with no end line → tool-decisions.md left byte-identical (nothing cut)" \
  || bad "H3: the strip changed a file whose block has no end line ($(diff "$H3.before" "$H3/.ai-factory/tool-decisions.md" | head -4 | tr '\n' '|'))"
grep -q 'R2 N/A record' <<<"$(awk '/NOT wired, or wired only in part/{on=1} on' "$H3/.install2.log")" \
  && ok "H3: the not-wired summary names the R2 N/A record the install could not remove" \
  || bad "H3: the not-wired summary does not report the R2 N/A record left in place"
! grep -qiE 'by hand|manually' "$H3/.install2.log" \
  && ok "H3: no manual-edit advice" \
  || bad "H3: the install asks for a manual edit: $(grep -iE 'by hand|manually' "$H3/.install2.log" | head -1)"
rm -f "$H3.before"

# boundary_block <config> — the lines of RULE_GLOBS.boundary's array, `boundary: [` to its `]`.
boundary_block() { awk '/^[[:space:]]*boundary:[[:space:]]*\[/{on=1} on{print} on && /\]/{exit}' "$1"; }

# ── Fixture K — a parse site in src/application/: its glob is one R8's `application:` key carries ──
# «Already covered» used to be a file-wide substring match, so '**/application/**/*.{ts,tsx}' under
# `application:` counted as covered and never went into `boundary: [` — R2 did not cover that code.
K=$(mktemp -d)
printf '{"name":"h","version":"0.0.0"}\n' > "$K/package.json"
mkdir -p "$K/src/application"; echo 'export const h = (b) => schema.parse(b);' > "$K/src/application/x.ts"
install_into "$K" ts-server
grep -qF "'**/application/**/*.{ts,tsx}'" "$K/eslint.config.mjs" \
  || bad "K: the config carries no '**/application/**/*.{ts,tsx}' anywhere — the arm below would be vacuous"
grep -qF "'**/application/**/*.{ts,tsx}'" <<<"$(boundary_block "$K/eslint.config.mjs")" \
  && ok "K: a parse site in src/application → its glob is inside RULE_GLOBS.boundary, not only under application:" \
  || bad "K: '**/application/**/*.{ts,tsx}' is not in the boundary array ($(boundary_block "$K/eslint.config.mjs" | tr '\n' '|'))"
# Paired negative: the glob now IS a boundary element, so a re-install must not add it again.
( cd "$K" && bash "$REPO_ROOT/install.sh" ts-server </dev/null ) >"$K/.install2.log" 2>&1 \
  || bad "K: the re-install exited non-zero (tail: $(tail -3 "$K/.install2.log" | tr '\n' '|'))"
n_k=$(boundary_block "$K/eslint.config.mjs" | grep -cF "'**/application/**/*.{ts,tsx}'")
[ "$n_k" = "1" ] \
  && ok "K: a glob already in the boundary array → a re-install adds no duplicate" \
  || bad "K: the boundary array holds '**/application/**/*.{ts,tsx}' $n_k times after a re-install (expected 1)"

# ── Fixture L — a parse site in a directory whose name holds an apostrophe ──
# The glob went into the config wrapped in single quotes unescaped: `'**/it's/**/*.{ts,tsx}',` —
# a config ESLint cannot load. It must be a valid string element holding the glob.
L=$(mktemp -d)
printf '{"name":"i","version":"0.0.0"}\n' > "$L/package.json"
mkdir -p "$L/src/it's"; echo 'export const h = (b) => schema.parse(b);' > "$L/src/it's/x.ts"
install_into "$L" ts-server
grep -qF "**/it" "$L/eslint.config.mjs" || bad "L: no glob for the apostrophe directory reached eslint.config.mjs — the arm below would be vacuous"
node --check "$L/eslint.config.mjs" 2>"$L/.check.err" \
  && ok "L: a glob with an apostrophe → eslint.config.mjs is still valid JavaScript" \
  || bad "L: eslint.config.mjs no longer parses ($(head -3 "$L/.check.err" | tr '\n' '|'))"
( cd "$L" && node --input-type=module -e "
  const src = (await import('node:fs')).readFileSync('eslint.config.mjs', 'utf8');
  const m = src.match(/const RULE_GLOBS = (\{[\s\S]*?\n\});/);
  const g = m && new Function('return ' + m[1])();
  process.exit(g && g.boundary.includes(\"**/it's/**/*.{ts,tsx}\") ? 0 : 1);
" ) 2>/dev/null \
  && ok "L: the boundary array holds the apostrophe glob as one string element" \
  || bad "L: RULE_GLOBS.boundary does not hold \"**/it's/**/*.{ts,tsx}\" ($(boundary_block "$L/eslint.config.mjs" | tr '\n' '|'))"

# ── Fixture M — RULE_GLOBS re-wrapped in a type cast: the boundary array is no longer its own key ──
# The element read answers `no-array` there, so nothing counted as covered; the awk insert still
# found the `boundary: [` line and added the same glob again on every re-install (cold review).
M=$(mktemp -d)
printf '{"name":"j","version":"0.0.0"}\n' > "$M/package.json"
mkdir -p "$M/src/api"; echo 'export const h = (b) => schema.parse(b);' > "$M/src/api/handler.ts"
install_into "$M" ts-server
sed -e 's|^const RULE_GLOBS = {$|const RULE_GLOBS = /** @type {any} */ ({|' "$M/eslint.config.mjs" \
  | awk 'cast==0 && /^const RULE_GLOBS = \/\*\*/{cast=1} cast==1 && /^};$/{print "});"; cast=2; next} {print}' \
  > "$M/eslint.config.mjs.edit" && mv "$M/eslint.config.mjs.edit" "$M/eslint.config.mjs"
grep -q '^const RULE_GLOBS = /\*\* @type' "$M/eslint.config.mjs" && node --check "$M/eslint.config.mjs" 2>/dev/null \
  || bad "M: the fixture edit did not leave a cast-wrapped, valid RULE_GLOBS — the arm below would be vacuous"
n_m0=$(boundary_block "$M/eslint.config.mjs" | grep -cF "'**/api/**/*.{ts,tsx}'")
( cd "$M" && bash "$REPO_ROOT/install.sh" ts-server </dev/null ) >"$M/.install2.log" 2>&1 \
  || bad "M: the re-install exited non-zero (tail: $(tail -3 "$M/.install2.log" | tr '\n' '|'))"
n_m=$(boundary_block "$M/eslint.config.mjs" | grep -cF "'**/api/**/*.{ts,tsx}'")
[ "$n_m0" = "1" ] && [ "$n_m" = "1" ] \
  && ok "M: a boundary array the element read cannot see → a re-install adds no duplicate" \
  || bad "M: '**/api/**/*.{ts,tsx}' in the boundary array: $n_m0 before the re-install, $n_m after (expected 1 and 1)"
! grep -q 'could not add glob' "$M/.install2.log" \
  && ok "M: a glob already in that array → no «could not add glob» false alarm" \
  || bad "M: the re-install reported a glob it did not need to add: $(grep 'could not add glob' "$M/.install2.log" | head -1)"

# ── Fixture H — a flat repo whose own root config is not an ES-module flat config ─────────────
# getff adds its block (R2 with it) only to an eslint.config.mjs or an ES-module eslint.config.js.
# A root eslint.config.ts / .cjs / .mts / .cts is left as it is, and the R2 auto-wire used to skip
# it without a word: HTTP boundary code the install could see ended the install unchecked by R2,
# and the NOT wired summary named only «getff's rules», never R2 or that code (Q4.7).
# $1 dir, $2 config name, $3 config body, $4 stack (default ts-server), $5 package.json deps
# object (default none). Installs without --force so the consumer's config stays.
own_cfg_install() {
  local deps='{}'
  [ -z "${5:-}" ] || deps="$5"
  printf '{"name":"h","version":"0.0.0","dependencies":%s}\n' "$deps" > "$1/package.json"
  mkdir -p "$1/src/api"; echo 'export const h = (b) => schema.parse(b);' > "$1/src/api/handler.ts"
  printf '%s\n' "$3" > "$1/$2"
  cp "$1/$2" "$1.before"
  ( cd "$1" && git init -q && bash "$REPO_ROOT/install.sh" "${4:-ts-server}" </dev/null ) >"$1.log" 2>&1 \
    || bad "H: install into $2 exited non-zero (tail: $(tail -3 "$1.log" | tr '\n' '|'))"
  cmp -s "$1/$2" "$1.before" || bad "H: the install changed the consumer's $2"
  [ ! -e "$1/eslint.config.mjs" ] || bad "H: getff placed an eslint.config.mjs beside the consumer's $2 — the arm below would be vacuous"
  [ "$( cd "$1" && bash "$REPO_ROOT/packages/core/audit-self/detect-r2-boundary.sh" 2>/dev/null | head -1 )" = boundary-present ] \
    || bad "H: detect-r2-boundary.sh does not see the fixture's boundary code — the arm below would be vacuous"
}
# Every R2 line of the NOT wired summary, from any pass: a duplicate from another pass counts too.
r2_summary_lines() { awk '/NOT wired, or wired only in part/{on=1} on' "$1" | grep -F 'R2 (rules-as-tests/no-unsafe-zod-parse)'; }
# $1 log, $2 config name, $3 arm label, $4 the reason the line must give.
h_assert_line() {
  local all
  all=$(r2_summary_lines "$1")
  [ "$(printf '%s' "$all" | grep -c .)" = "1" ] && grep -qF "in $2 —" <<<"$all" \
    && ok "$3: boundary code + own $2 → exactly one NOT wired R2 line, and it names $2" \
    || bad "$3: expected exactly one NOT wired R2 line naming $2, got: $(printf '%s' "$all" | tr '\n' '|')"
  grep -qF "$4" <<<"$all" \
    && grep -qF "R2 does not check it" <<<"$all" \
    && grep -qF "through the boundary globs '" <<<"$all" \
    && grep -qF "'**/api/**/*.{ts,tsx}'" <<<"$all" \
    && ok "$3: the line gives the reason and the boundary globs R2 would cover, each glob intact" \
    || bad "$3: the R2 line for $2 lacks the reason, the unchecked-code claim or an intact glob: $all"
  ! grep -qiE 'by hand|manually' <<<"$(grep -iE 'eslint|R2' "$1")" \
    && ok "$3: nothing asks for a manual ESLint edit ($2)" \
    || bad "$3: the install asks for a manual ESLint edit: $(grep -iE 'eslint|R2' "$1" | grep -iE 'by hand|manually' | head -2 | tr '\n' '|')"
}
for _hcfg in eslint.config.ts eslint.config.cjs; do
  H=$(mktemp -d)
  own_cfg_install "$H" "$_hcfg" 'export default [{ rules: {} }];'
  h_assert_line "$H.log" "$_hcfg" H 'getff adds R2 only to an eslint.config.mjs or an ES-module eslint.config.js'
  rm -f "$H.before" "$H.log"
done
# react-native, whose preset ships no R2: the line gives that reason, not the file type.
H=$(mktemp -d)
own_cfg_install "$H" eslint.config.mts 'export default [{ rules: {} }];' react-native '{"react-native":"0.74.0","react":"18.2.0"}'
h_assert_line "$H.log" eslint.config.mts "H rn" 'the react-native preset ships no R2'
rm -f "$H.before" "$H.log"
# Paired negatives: the same config already sets R2 as a quoted rule id, in either quote kind → no line.
for _hq in "'rules-as-tests/no-unsafe-zod-parse'" '"rules-as-tests/no-unsafe-zod-parse"'; do
  H=$(mktemp -d)
  own_cfg_install "$H" eslint.config.ts "export default [{ rules: { $_hq: 'error' } }];"
  [ -z "$(r2_summary_lines "$H.log")" ] && ! grep -q 'R2 auto-wire: HTTP boundary code found' "$H.log" \
    && ok "H neg: own eslint.config.ts that already sets R2 as $_hq → no R2 line" \
    || bad "H neg: an R2 line was reported for a config that already sets R2 as $_hq: $(r2_summary_lines "$H.log" | tr '\n' '|')"
  rm -f "$H.before" "$H.log"
done

# ── Self-probe (T15 / spec §8): C1 on THIS repo must be honest, never a false confident-N/A ──
SELF=$( bash "$REPO_ROOT/packages/core/audit-self/detect-r2-boundary.sh" 2>/dev/null | head -1 )
[ "$SELF" != "no-boundary-confident" ] \
  && ok "self-probe: this repo classifies as '$SELF' (honest — never a false no-boundary-confident)" \
  || bad "self-probe: this repo returned no-boundary-confident — a false N/A on the framework's own layout"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
