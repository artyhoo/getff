#!/usr/bin/env bash
# gh-535-rule-enforced.test.sh — the +E deep gate (check-rule-enforced.sh) must catch the false-green
# where a per-package eslint config shadows the root R2 (so `turbo run lint` leaves R2 inert while
# validate/check:globs stay green), and must NOT false-fail a package that correctly re-exports root.
#
# GH #535 REOPEN: the first version of this gate (and this test's first version) ran `eslint
# --print-config` from the REPO ROOT and tested with a fake keyed on the file PATH. But ESLint v9
# resolves flat config by CWD — from root it loads the ROOT config (which wires R2), so a shadowed
# package whose own config does NOT wire R2 still reported "applied". `turbo run lint` runs `eslint .`
# from each PACKAGE dir, so the gate must resolve from the package's cwd too. The path-keyed fake
# could not model cwd-resolution and hid the bug. This rewrite tests CWD faithfully:
#   - Arm 1 (deterministic, no network): a CWD-AWARE fake that emits the rule iff the nearest
#     eslint.config at/above its $PWD wires it — exactly v9's behaviour. A gate that runs from root
#     sees the root config (rule present → false-green); the FIXED gate cd's into the package and
#     sees the package config (rule absent → FAIL). Also asserts the fake was invoked FROM the
#     package dir (direct proof of the cwd fix).
#   - Arm 2 (real eslint v9, skipped offline): the ground truth — only real eslint follows a
#     re-export-of-root import, so it is the only way to prove the no-false-fail (CASE B) arm.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
GATE="$REPO_ROOT/packages/core/audit-self/check-rule-enforced.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# Root eslint.config.mjs with a RULE_GLOBS.boundary block (the gate parses it) wiring $1 on boundary.
write_root_cfg() { # $1=dir $2=rule
  cat > "$1/eslint.config.mjs" <<CFG
const RULE_GLOBS = {
  boundary: ['**/routes/**/*.{ts,tsx}'],
};
export default [{ files: RULE_GLOBS.boundary, rules: { '$2': 'error' } }];
CFG
}

# ── Arm 1: CWD-AWARE fake — proves the gate resolves from the package cwd (not root) ──
FAKE=$(mktemp)
cat > "$FAKE" <<'ES'
#!/bin/sh
echo "$PWD" >> "$AIF_FAKE_CWD_LOG"
[ "$1" = "--print-config" ] || exit 0
d=$PWD
while [ -n "$d" ] && [ "$d" != "/" ]; do
  for c in eslint.config.js eslint.config.mjs eslint.config.cjs eslint.config.ts eslint.config.mts eslint.config.cts; do
    if [ -f "$d/$c" ]; then
      if grep -q "$AIF_FAKE_RULE" "$d/$c"; then printf '{ "rules": { "%s": [2] } }\n' "$AIF_FAKE_RULE"; else printf '{ "rules": {} }\n'; fi
      exit 0
    fi
  done
  d=$(dirname "$d")
done
printf '{ "rules": {} }\n'
ES
chmod +x "$FAKE"

A=$(mktemp -d); mkdir -p "$A/apps/api/src/routes"
write_root_cfg "$A" no-console
printf '{"name":"api","dependencies":{"zod":"3.0.0"}}\n' > "$A/apps/api/package.json"
printf "export default [{ files: ['**/*.{ts,tsx}'], rules: {} }];\n" > "$A/apps/api/eslint.config.mjs"
printf 'export const x = 1;\n' > "$A/apps/api/src/routes/probe.ts"
CWDLOG="$A.cwdlog"; : > "$CWDLOG"
( cd "$A" && AIF_ESLINT_CMD="$FAKE" AIF_ENFORCED_RULE=no-console AIF_FAKE_RULE=no-console AIF_FAKE_CWD_LOG="$CWDLOG" bash "$GATE" ) >/tmp/g535a.$$ 2>&1
rc=$?
[ "$rc" -ne 0 ] && ok "Arm1: shadowed pkg config lacks the rule → gate FAILS (false-green caught)" || bad "Arm1: gate PASSED a shadowed pkg with the rule inert (cwd bug — #535 reopen)"
grep -qE '/apps/api$' "$CWDLOG" && ok "Arm1: gate invoked print-config FROM the package dir (apps/api) — cwd fix present" || bad "Arm1: gate never ran from apps/api (still resolving from root → the #535 bug)"

# ── Arm 1b (paired-negative): shadowed pkg DOES wire the rule → gate PASSES (no false-fail) ──
B=$(mktemp -d); mkdir -p "$B/apps/api/src/routes"
write_root_cfg "$B" no-console
printf '{"name":"api","dependencies":{"zod":"3.0.0"}}\n' > "$B/apps/api/package.json"
printf "export default [{ files: ['**/routes/**/*.{ts,tsx}'], rules: { 'no-console': 'error' } }];\n" > "$B/apps/api/eslint.config.mjs"
printf 'export const x = 1;\n' > "$B/apps/api/src/routes/probe.ts"
: > "$B.cwdlog"
if ( cd "$B" && AIF_ESLINT_CMD="$FAKE" AIF_ENFORCED_RULE=no-console AIF_FAKE_RULE=no-console AIF_FAKE_CWD_LOG="$B.cwdlog" bash "$GATE" ) >/tmp/g535b.$$ 2>&1; then
  ok "Arm1b neg: shadowed pkg wires the rule → gate PASSES (no false-fail on a correct package config)"
else
  bad "Arm1b neg: gate FAILED a package that DOES wire the rule"
fi

# ── Arm 2 (real eslint v9 — the ground truth; skipped when offline): CASE A FAIL + CASE B (re-export) PASS ──
ESV9=$(mktemp -d)
if ( cd "$ESV9" && printf '{"name":"e","private":true}\n' > package.json && npm i eslint@9 --no-save --silent >/dev/null 2>&1 ); then
  mkdir -p "$ESV9/apps/api/src/routes"; write_root_cfg "$ESV9" no-console
  printf '{"name":"api","dependencies":{"zod":"3.0.0"}}\n' > "$ESV9/apps/api/package.json"
  printf 'export const x = 1;\n' > "$ESV9/apps/api/src/routes/probe.ts"
  # CASE A — self-contained pkg config without the rule → FAIL
  printf "export default [{ files: ['**/*.{ts,tsx}'], rules: {} }];\n" > "$ESV9/apps/api/eslint.config.mjs"
  ( cd "$ESV9" && AIF_ENFORCED_RULE=no-console bash "$GATE" ) >/tmp/g535r.$$ 2>&1
  [ $? -ne 0 ] && ok "Arm2 (real eslint v9): shadowed pkg without rule → gate FAILS" || bad "Arm2 (real eslint v9): gate PASSED an inert shadowed pkg (cwd bug survives on real eslint)"
  # CASE B — pkg RE-EXPORTS root (real eslint follows the import) → PASS (no false-fail)
  printf "export { default } from '../../eslint.config.mjs';\n" > "$ESV9/apps/api/eslint.config.mjs"
  if ( cd "$ESV9" && AIF_ENFORCED_RULE=no-console bash "$GATE" ) >/tmp/g535r2.$$ 2>&1; then
    ok "Arm2 (real eslint v9): pkg re-exports root → gate PASSES (only real eslint follows the import)"
  else
    bad "Arm2 (real eslint v9): gate false-failed a re-export-of-root package"
  fi
  # CASE C (2026-09-21) — pkg config names the rule but switches it OFF → real print-config still
  # lists it as [0]; the gate must read the severity, not the name → FAIL
  printf "export default [{ files: ['**/routes/**/*.{ts,tsx}'], rules: { 'no-console': 'off' } }];\n" > "$ESV9/apps/api/eslint.config.mjs"
  ( cd "$ESV9" && AIF_ENFORCED_RULE=no-console bash "$GATE" ) >/tmp/g535r3.$$ 2>&1
  [ $? -ne 0 ] && grep -q 'switched OFF' /tmp/g535r3.$$ && ok "Arm2 (real eslint v9): rule set to 'off' → gate FAILS (severity read, not name)" || bad "Arm2 (real eslint v9): gate PASSED a rule that is 'off' ($(tr '\n' ';' </tmp/g535r3.$$))"
  rm -f /tmp/g535r3.$$
else
  echo "  · Arm2 skipped — could not install eslint@9 (offline); Arm1 (cwd-aware fake) still proves the fix."
fi

# ── Arm 2b (cold review 2026-09-29): the root config is asked about one file per boundary token ──
# A consumer's own R2 scoped by its own `files:` can reach one boundary token's code and miss another's;
# the first boundary file alone read green. A PATH-AWARE fake: the rule is on for a file iff its path
# matches $AIF_FAKE_COVERED (a case pattern) — as ESLint resolves a `files:` scope.
PFAKE=$(mktemp)
cat > "$PFAKE" <<'ES'
#!/bin/sh
[ "$1" = "--print-config" ] || exit 0
case "${2#./}" in $AIF_FAKE_COVERED) printf '{ "rules": { "%s": [2] } }\n' "$AIF_FAKE_RULE" ;; *) printf '{ "rules": {} }\n' ;; esac
ES
chmod +x "$PFAKE"
PT=$(mktemp -d); mkdir -p "$PT/src/routes" "$PT/src/handlers"
cat > "$PT/eslint.config.mjs" <<'CFG'
const RULE_GLOBS = {
  boundary: ['**/routes/**/*.{ts,tsx}', '**/handlers/**/*.{ts,tsx}'],
};
export default [];
CFG
printf '{"name":"pt","dependencies":{"zod":"3.0.0"}}\n' > "$PT/package.json"
printf 'export const r = 1;\n' > "$PT/src/routes/users.ts"
printf 'export const h = 1;\n' > "$PT/src/handlers/pay.ts"
( cd "$PT" && AIF_ESLINT_CMD="$PFAKE" AIF_ENFORCED_RULE=no-console AIF_FAKE_RULE=no-console AIF_FAKE_COVERED='src/routes/*' bash "$GATE" ) >/tmp/g535pt.$$ 2>&1
rc=$?
[ "$rc" -ne 0 ] && grep -q 'NOT in the resolved ESLint config for src/handlers/pay\.ts' /tmp/g535pt.$$ \
  && ok "Arm2b: R2 reaches the routes token only → gate FAILS naming the handlers file it misses" \
  || bad "Arm2b: R2 missing the handlers token's code read green, or the file went unnamed (rc=$rc: $(tr '\n' ';' </tmp/g535pt.$$))"
# Paired negative: R2 reaches both tokens → PASS, and each token's file was asked about.
( cd "$PT" && AIF_ESLINT_CMD="$PFAKE" AIF_ENFORCED_RULE=no-console AIF_FAKE_RULE=no-console AIF_FAKE_COVERED='src/*' bash "$GATE" ) >/tmp/g535pt2.$$ 2>&1
rc=$?
[ "$rc" -eq 0 ] && grep -q 'R2 applied to src/routes/users\.ts' /tmp/g535pt2.$$ && grep -q 'R2 applied to src/handlers/pay\.ts' /tmp/g535pt2.$$ \
  && ok "Arm2b neg: R2 reaches both tokens → gate PASSES, having asked about one file of each" \
  || bad "Arm2b neg: rc=$rc or a token's file was not asked about ($(tr '\n' ';' </tmp/g535pt2.$$))"
rm -f /tmp/g535pt.$$ /tmp/g535pt2.$$

# ── Arm 2c (second cold review 2026-09-29): a package whose own config shadows the root one is asked ──
# about one file per boundary token too, not its first boundary file alone.
PS=$(mktemp -d); mkdir -p "$PS/apps/api/src/routes" "$PS/apps/api/src/handlers"
cp "$PT/eslint.config.mjs" "$PS/eslint.config.mjs"
printf "export default [];\n" > "$PS/apps/api/eslint.config.mjs"
printf '{"name":"api","dependencies":{"zod":"3.0.0"}}\n' > "$PS/apps/api/package.json"
printf 'export const r = 1;\n' > "$PS/apps/api/src/routes/users.ts"
printf 'export const h = 1;\n' > "$PS/apps/api/src/handlers/pay.ts"
( cd "$PS" && AIF_ESLINT_CMD="$PFAKE" AIF_ENFORCED_RULE=no-console AIF_FAKE_RULE=no-console AIF_FAKE_COVERED='src/routes/*' bash "$GATE" ) >/tmp/g535ps.$$ 2>&1
rc=$?
[ "$rc" -ne 0 ] && grep -q 'apps/api: R2 (no-console) is NOT in the resolved ESLint config for apps/api/src/handlers/pay\.ts' /tmp/g535ps.$$ \
  && ok "Arm2c: a shadowed package's R2 reaches the routes token only → gate FAILS naming its handlers file" \
  || bad "Arm2c: a shadowed package's R2 missing the handlers token's code read green, or the file went unnamed (rc=$rc: $(tr '\n' ';' </tmp/g535ps.$$))"
( cd "$PS" && AIF_ESLINT_CMD="$PFAKE" AIF_ENFORCED_RULE=no-console AIF_FAKE_RULE=no-console AIF_FAKE_COVERED='src/*' bash "$GATE" ) >/tmp/g535ps2.$$ 2>&1
rc=$?
[ "$rc" -eq 0 ] && grep -q 'R2 applied to apps/api/src/routes/users\.ts' /tmp/g535ps2.$$ && grep -q 'R2 applied to apps/api/src/handlers/pay\.ts' /tmp/g535ps2.$$ \
  && ok "Arm2c neg: the shadowed package's R2 reaches both tokens → gate PASSES, having asked about one file of each" \
  || bad "Arm2c neg: rc=$rc or a token's file in the shadowed package was not asked about ($(tr '\n' ';' </tmp/g535ps2.$$))"
rm -f /tmp/g535ps.$$ /tmp/g535ps2.$$

# ── Arm 2d (second cold review, NIT): a token whose first file an earlier token already had asked about ──
# is asked about its next file, not skipped. Files are taken in sorted order, the same on every filesystem:
# routes' only file src/api/routes/x.ts sorts before src/api/v.ts, the api token's other file.
PN=$(mktemp -d); mkdir -p "$PN/src/api/routes"
cat > "$PN/eslint.config.mjs" <<'CFG'
const RULE_GLOBS = {
  boundary: ['**/routes/**/*.{ts,tsx}', '**/api/**/*.{ts,tsx}'],
};
export default [];
CFG
printf '{"name":"pn","dependencies":{"zod":"3.0.0"}}\n' > "$PN/package.json"
printf 'export const x = 1;\n' > "$PN/src/api/routes/x.ts"
printf 'export const v = 1;\n' > "$PN/src/api/v.ts"
( cd "$PN" && AIF_ESLINT_CMD="$PFAKE" AIF_ENFORCED_RULE=no-console AIF_FAKE_RULE=no-console AIF_FAKE_COVERED='src/api/routes/*' bash "$GATE" ) >/tmp/g535pn.$$ 2>&1
rc=$?
[ "$rc" -ne 0 ] && grep -q 'NOT in the resolved ESLint config for src/api/v\.ts' /tmp/g535pn.$$ \
  && ok "Arm2d: the api token's first file was the routes token's → its next file is asked about, and R2 missing it FAILS" \
  || bad "Arm2d: the api token was skipped because its first file was already asked about (rc=$rc: $(tr '\n' ';' </tmp/g535pn.$$))"
rm -f /tmp/g535pn.$$

# ── Arm 2e (third cold review 2026-09-29): a package nested in a shadowed package, with a config of its own, ──
# answers for its own files only. apps/api/admin sorts before apps/api/src, so its routes file was apps/api's
# first routes file: asked from admin's config, it read green for apps/api, whose own routes code went unasked.
PE=$(mktemp -d); mkdir -p "$PE/apps/api/src/routes" "$PE/apps/api/admin/routes"
cp "$PT/eslint.config.mjs" "$PE/eslint.config.mjs"
printf "export default [];\n" > "$PE/apps/api/eslint.config.mjs"
printf "export default [];\n" > "$PE/apps/api/admin/eslint.config.mjs"
printf '{"name":"api","dependencies":{"zod":"3.0.0"}}\n' > "$PE/apps/api/package.json"
printf 'export const a = 1;\n' > "$PE/apps/api/admin/routes/x.ts"
printf 'export const y = 1;\n' > "$PE/apps/api/src/routes/y.ts"
# The fake sees the file from its governing dir: admin's routes/x.ts matches, apps/api's src/routes/y.ts does not.
( cd "$PE" && AIF_ESLINT_CMD="$PFAKE" AIF_ENFORCED_RULE=no-console AIF_FAKE_RULE=no-console AIF_FAKE_COVERED='routes/*' bash "$GATE" ) >/tmp/g535pe.$$ 2>&1
rc=$?
[ "$rc" -ne 0 ] && grep -q 'apps/api: R2 (no-console) is NOT in the resolved ESLint config for apps/api/src/routes/y\.ts' /tmp/g535pe.$$ \
  && [ "$(grep -c 'apps/api/admin/routes/x\.ts' /tmp/g535pe.$$)" -eq 1 ] \
  && ok "Arm2e: a nested package's file does not answer for its parent package — apps/api's own routes file is asked about, admin's once" \
  || bad "Arm2e: the nested package's file stood in for apps/api, or was asked about twice (rc=$rc: $(tr '\n' ';' </tmp/g535pe.$$))"
rm -f /tmp/g535pe.$$

# ── Arm 3: no boundary files → graceful skip ──
C=$(mktemp -d); write_root_cfg "$C" no-console; mkdir -p "$C/src/lib"; printf 'export const y = 2;\n' > "$C/src/lib/u.ts"
if ( cd "$C" && AIF_ESLINT_CMD="$FAKE" AIF_FAKE_CWD_LOG=/dev/null bash "$GATE" ) >/tmp/g535c.$$ 2>&1 && grep -qi 'nothing for R2 to govern\|nothing to verify' /tmp/g535c.$$; then
  ok "Arm3: no boundary files → gate skips (exit 0)"
else
  bad "Arm3: gate did not skip with no boundary files ($(tr '\n' ';' </tmp/g535c.$$))"
fi

# ── Arm 4: eslint absent → graceful skip ──
D=$(mktemp -d); write_root_cfg "$D" no-console; mkdir -p "$D/apps/api/src/routes"; printf "export default [];\n" > "$D/apps/api/eslint.config.mjs"; printf 'export const x=1;\n' > "$D/apps/api/src/routes/p.ts"
if ( cd "$D" && env -u AIF_ESLINT_CMD PATH="/nonexistent" /bin/bash "$GATE" ) >/tmp/g535d.$$ 2>&1; then
  ok "Arm4: eslint absent → gate skips (exit 0)"
else
  bad "Arm4: gate hard-failed when eslint absent ($(tr '\n' ';' </tmp/g535d.$$))"
fi

# ── #807 multi-stack: no root config → check-rule-enforced.sh recurses per workspace ───────────
# The #793/#796 layout ships per-workspace eslint.config.mjs + NO root config. The gate must recurse
# into each workspace (with ESLINT_CONFIG set so the child finds a valid $CFG) instead of exit-2'ing
# on the missing root config. The CWD-aware FAKE from Arm 1 resolves the rule from the package cwd.
write_ws_cfg() { # $1=ws-dir $2=rule  — per-workspace config with a RULE_GLOBS.boundary block.
  # NOTE: `boundary:` MUST be on its own line — the gate's awk extractor anchors on
  # `^[[:space:]]*boundary:[[:space:]]*\[` (matching the real shipped multi-line template shape);
  # an inline `{ boundary: [...] }` would be mis-read as "no boundary tokens".
  mkdir -p "$1"
  cat > "$1/eslint.config.mjs" <<CFG
const RULE_GLOBS = {
  boundary: ['**/routes/**/*.{ts,tsx}'],
};
export default [{ files: RULE_GLOBS.boundary, rules: { '$2': 'error' } }];
CFG
}

# (pos) per-ws config WIRES the rule → recursion runs the child from the ws dir → child resolves the
# rule → exit 0. No root config anywhere (the #807 bug shape).
MS=$(mktemp -d)
printf '{"name":"mono","private":true}\n' > "$MS/package.json"
write_ws_cfg "$MS/apps/api" no-console
printf '{"name":"api","dependencies":{"zod":"3.0.0"}}\n' > "$MS/apps/api/package.json"
mkdir -p "$MS/apps/api/src/routes"; printf 'export const x=1;\n' > "$MS/apps/api/src/routes/p.ts"
: > "$MS.cwdlog"
if ( cd "$MS" && AIF_ESLINT_CMD="$FAKE" AIF_ENFORCED_RULE=no-console AIF_FAKE_RULE=no-console AIF_FAKE_CWD_LOG="$MS.cwdlog" bash "$GATE" ) >/tmp/g535ms.$$ 2>&1; then
  ok "#807 (pos): no root config, ws WIRES rule → gate recurses + PASSES (was exit 2)"
else
  bad "#807 (pos): ws wires the rule but gate failed ($(tr '\n' ';' </tmp/g535ms.$$))"
fi
! grep -q 'run from the project root' /tmp/g535ms.$$ \
  && ok "#807 (pos): NOT the exit-2 'run from the project root' path (recursed per-ws)" \
  || bad "#807 (pos): hit the exit-2 root-config guard (recursion not reached)"

# (PAIRED-NEGATIVE) per-ws config does NOT wire the rule, ws has a zod boundary → the child's
# --print-config (cwd-aware fake) finds the rule absent → FAIL bubbles up through the recursion.
MSN=$(mktemp -d)
printf '{"name":"mono","private":true}\n' > "$MSN/package.json"
mkdir -p "$MSN/apps/api/src/routes"
# Give it a boundary block (own-line, so the gate's extractor sees it) but NO rule wired.
cat > "$MSN/apps/api/eslint.config.mjs" <<'CFG'
const RULE_GLOBS = {
  boundary: ['**/routes/**/*.{ts,tsx}'],
};
export default [{ files: RULE_GLOBS.boundary, rules: {} }];
CFG
printf '{"name":"api","dependencies":{"zod":"3.0.0"}}\n' > "$MSN/apps/api/package.json"
printf 'export const x=1;\n' > "$MSN/apps/api/src/routes/p.ts"
: > "$MSN.cwdlog"
if ( cd "$MSN" && AIF_ESLINT_CMD="$FAKE" AIF_ENFORCED_RULE=no-console AIF_FAKE_RULE=no-console AIF_FAKE_CWD_LOG="$MSN.cwdlog" bash "$GATE" ) >/tmp/g535msn.$$ 2>&1; then
  bad "#807 NEG: ws does NOT wire the rule (zod boundary) but gate PASSED → recursion alarm vacuous"
else
  ok "#807 NEG: ws does NOT wire rule + zod boundary → gate FAILS through recursion (non-vacuous)"
fi
# The child labels its lines «root config»: the line before them names the workspace config they are
# about, which is how the install tells them from the root config's own (cold review 2026-09-29).
grep -qx 'check-rule-enforced: checking apps/api/eslint.config.mjs' /tmp/g535msn.$$ \
  && ok "#807 NEG: the recursion names the workspace config it asks next" \
  || bad "#807 NEG: no «checking apps/api/eslint.config.mjs» line before the workspace's own lines ($(tr '\n' ';' </tmp/g535msn.$$))"

# (deps-free degrade) no root config + eslint ABSENT → each child SKIPs → exit 0 (the unit-test env).
# Faithful deps-free env: keep the real PATH (the recursion + r2-na source legitimately need
# dirname/basename — so the Arm-4 `PATH=/nonexistent` trick can't be used here) but shadow `npx` so
# the gate's `npx --no-install eslint` resolver can't reach a hoisted workspace eslint, and clear
# AIF_ESLINT_CMD. A fresh tmp fixture has no node_modules/.bin/eslint and there is no global eslint,
# so the gate's resolver finds nothing → child SKIPs (exit 0), the correct deps-free degrade.
MSD=$(mktemp -d); STUBBIN=$(mktemp -d)
printf '#!/bin/sh\nexit 127\n' > "$STUBBIN/npx"; chmod +x "$STUBBIN/npx"
printf '{"name":"mono","private":true}\n' > "$MSD/package.json"
write_ws_cfg "$MSD/apps/api" no-console
printf '{"name":"api","dependencies":{"zod":"3.0.0"}}\n' > "$MSD/apps/api/package.json"
mkdir -p "$MSD/apps/api/src/routes"; printf 'export const x=1;\n' > "$MSD/apps/api/src/routes/p.ts"
if ( cd "$MSD" && env -u AIF_ESLINT_CMD PATH="$STUBBIN:$PATH" bash "$GATE" ) >/tmp/g535msd.$$ 2>&1 \
   && grep -qi 'eslint not available\|R2 N/A (skipped)\|nothing to verify' /tmp/g535msd.$$; then
  ok "#807 (deps-free): no root config + eslint absent → recurses, child SKIPs → exit 0"
else
  bad "#807 (deps-free): gate hard-failed / no SKIP when eslint absent on a multi-stack monorepo ($(tr '\n' ';' </tmp/g535msd.$$))"
fi

# ── Severity arms (2026-09-21): a rule that is PRESENT but switched OFF is not enforced ──────────
# `eslint --print-config` keeps a disabled rule in its output as `"<rule>": [0]`, so the old
# name-only grep reported `'<rule>': 'off'` as "R2 applied" + exit 0 — the exact silent inertness
# this gate exists to catch. check-fences-fire.sh cannot see it either (it lints in a temp dir with
# its own config), so this gate is the only one that can. The fake prints the rule at the severity
# given in AIF_FAKE_SEV (raw JSON, so every spelling ESLint can emit is exercised).
SEVFAKE=$(mktemp)
cat > "$SEVFAKE" <<'ES'
#!/bin/sh
[ "$1" = "--print-config" ] || exit 0
printf '{ "rules": { "%s": %s } }\n' "$AIF_FAKE_RULE" "$AIF_FAKE_SEV"
ES
chmod +x "$SEVFAKE"
S=$(mktemp -d); mkdir -p "$S/src/routes"
write_root_cfg "$S" no-console
printf '{"name":"s","dependencies":{"zod":"3.0.0"}}\n' > "$S/package.json"
printf 'export const x = 1;\n' > "$S/src/routes/users.ts"
run_sev() { # $1=raw JSON severity, rest = extra env assignments → gate rc; output in /tmp/g535s.$$
  local sev="$1"; shift
  ( cd "$S" && env "$@" AIF_ESLINT_CMD="$SEVFAKE" AIF_ENFORCED_RULE=no-console AIF_FAKE_RULE=no-console AIF_FAKE_SEV="$sev" bash "$GATE" ) >/tmp/g535s.$$ 2>&1
}
for sev in '[0]' '["off"]' '0' '"off"' '[0, {"x":1}]'; do
  if run_sev "$sev"; then
    bad "Severity NEG: rule printed as $sev (off) but gate PASSED — disabled rule reported as enforced"
  else
    grep -q 'src/routes/users.ts' /tmp/g535s.$$ && grep -qi "'error'" /tmp/g535s.$$ \
      && ok "Severity NEG: rule $sev (off) → gate FAILS, names the file and the fix" \
      || bad "Severity NEG: rule $sev failed but message lacks the file / the fix ($(tr '\n' ';' </tmp/g535s.$$))"
  fi
done
for sev in '[2]' '["error"]' '2' '[2, {"x":1}]'; do
  run_sev "$sev" && ok "Severity POS: rule $sev (error) → gate PASSES" || bad "Severity POS: gate FAILED a rule at $sev (error) ($(tr '\n' ';' </tmp/g535s.$$))"
done
for sev in '[1]' '["warn"]'; do
  run_sev "$sev" && bad "Severity WARN: rule $sev (warn) PASSED by default — warn blocks nothing without --max-warnings=0" \
    || ok "Severity WARN: rule $sev (warn) → gate FAILS by default (fail-closed)"
  run_sev "$sev" AIF_ENFORCED_ALLOW_WARN=1 && ok "Severity WARN: $sev + AIF_ENFORCED_ALLOW_WARN=1 → gate PASSES (documented escape)" \
    || bad "Severity WARN: AIF_ENFORCED_ALLOW_WARN=1 did not admit $sev"
done
run_sev '[0]' AIF_ENFORCED_ALLOW_WARN=1 && bad "Severity NEG: AIF_ENFORCED_ALLOW_WARN=1 admitted an OFF rule" || ok "Severity NEG: the warn escape does NOT admit an OFF rule"
rm -f "$SEVFAKE" /tmp/g535s.$$

# ── Own root config: the consumer's eslint.config.cjs, a workspace config with RULE_GLOBS ─────────
# Reading ESLint's lookup order made the consumer's root .cjs «the root config», and its missing
# boundary tokens ended the gate with «nothing to verify (skipped)» — the workspace configs under it,
# which ESLint uses for their own files, went unchecked (cold-review F3). They are the rule layer, as
# in the §807 layout with no root config: recurse into them.
own_root_mono() { # $1 = the rule the workspace config wires
  local d; d=$(mktemp -d)
  printf '{"name":"mono","private":true}\n' > "$d/package.json"
  printf 'module.exports = [];\n' > "$d/eslint.config.cjs"
  write_ws_cfg "$d/apps/api" "$1"
  printf '{"name":"api","dependencies":{"zod":"3.0.0"}}\n' > "$d/apps/api/package.json"
  mkdir -p "$d/apps/api/src/routes"; printf 'export const x=1;\n' > "$d/apps/api/src/routes/p.ts"
  printf '%s' "$d"
}
OR=$(own_root_mono no-debugger); : > "$OR.cwdlog"
if ( cd "$OR" && AIF_ESLINT_CMD="$FAKE" AIF_ENFORCED_RULE=no-console AIF_FAKE_RULE=no-console AIF_FAKE_CWD_LOG="$OR.cwdlog" bash "$GATE" ) >/tmp/g535or.$$ 2>&1; then
  bad "own-root: the workspace config under the consumer's eslint.config.cjs leaves R2 off, yet the gate PASSED ($(tr '\n' ';' </tmp/g535or.$$))"
else
  ok "own-root: a workspace config under the consumer's eslint.config.cjs that leaves the rule off → gate FAILS"
fi
# Paired negative: the workspace config wires the rule → the gate passes, having verified it there.
ORP=$(own_root_mono no-console); : > "$ORP.cwdlog"
if ( cd "$ORP" && AIF_ESLINT_CMD="$FAKE" AIF_ENFORCED_RULE=no-console AIF_FAKE_RULE=no-console AIF_FAKE_CWD_LOG="$ORP.cwdlog" bash "$GATE" ) >/tmp/g535orp.$$ 2>&1 \
  && grep -q 'verifying R2' /tmp/g535orp.$$; then
  ok "own-root neg: the workspace config wires the rule → gate PASSES, verified in the workspace"
else
  bad "own-root neg: gate failed, or passed without verifying the workspace ($(tr '\n' ';' </tmp/g535orp.$$))"
fi
rm -rf "$OR" "$ORP"; rm -f "$OR.cwdlog" "$ORP.cwdlog" /tmp/g535or.$$ /tmp/g535orp.$$

# ── RULE_GLOBS as JavaScript reads it, and a workspace's eslint.config.js ─────────────────────────
# The boundary tokens were read from single-quoted globs on a line that starts `boundary: [` only, so
# prettier's double quotes or a one-line RULE_GLOBS object read as «no boundary tokens — nothing to
# verify (skipped)»: exit 0 over a boundary file R2 never reaches. And with no root config the gate
# recursed into eslint.config.mjs workspaces only — a workspace's own eslint.config.js, which the
# install now writes R2 into, stopped it at «not found» (second cold review, after #1868).
quoted_root() { # $1 = RULE_GLOBS source, $2 = rule the config wires
  local d; d=$(mktemp -d)
  printf '{"name":"q","dependencies":{"zod":"3.0.0"}}\n' > "$d/package.json"
  mkdir -p "$d/src/routes"; printf 'export const x=1;\n' > "$d/src/routes/p.ts"
  printf '%s\nexport default [{ files: RULE_GLOBS.boundary, rules: { "%s": "error" } }];\n' "$1" "$2" > "$d/eslint.config.mjs"
  printf '%s' "$d"
}
for q in 'dq|const RULE_GLOBS = {
  boundary: ["**/routes/**/*.{ts,tsx}"],
};' "one-line|const RULE_GLOBS = { boundary: ['**/routes/**/*.{ts,tsx}'], appCode: ['**/*.ts'] };"; do
  QN=$(quoted_root "${q#*|}" no-debugger)
  if ( cd "$QN" && AIF_ESLINT_CMD="$FAKE" AIF_ENFORCED_RULE=no-console AIF_FAKE_RULE=no-console AIF_FAKE_CWD_LOG=/dev/null bash "$GATE" ) >/tmp/g535q.$$ 2>&1; then
    bad "RULE_GLOBS ${q%%|*}: the boundary file's config leaves the rule off, yet the gate PASSED ($(tr '\n' ';' </tmp/g535q.$$))"
  else
    ok "RULE_GLOBS ${q%%|*}: boundary tokens read — a boundary file the rule does not reach FAILS"
  fi
  QP=$(quoted_root "${q#*|}" no-console)
  if ( cd "$QP" && AIF_ESLINT_CMD="$FAKE" AIF_ENFORCED_RULE=no-console AIF_FAKE_RULE=no-console AIF_FAKE_CWD_LOG=/dev/null bash "$GATE" ) >/tmp/g535q.$$ 2>&1 \
     && grep -q 'applied to 1 boundary file\|verifying R2' /tmp/g535q.$$ && ! grep -q 'nothing to verify' /tmp/g535q.$$; then
    ok "RULE_GLOBS ${q%%|*} neg: the rule wired → gate PASSES, having verified the boundary file"
  else
    bad "RULE_GLOBS ${q%%|*} neg: gate failed, or skipped instead of verifying ($(tr '\n' ';' </tmp/g535q.$$))"
  fi
  rm -rf "$QN" "$QP"
done
ws_js() { # $1 = the rule apps/api/eslint.config.js wires
  local d; d=$(mktemp -d)
  printf '{"name":"mono","private":true}\n' > "$d/package.json"
  write_ws_cfg "$d/apps/api" "$1"; mv "$d/apps/api/eslint.config.mjs" "$d/apps/api/eslint.config.js"
  printf '{"name":"api","dependencies":{"zod":"3.0.0"}}\n' > "$d/apps/api/package.json"
  mkdir -p "$d/apps/api/src/routes"; printf 'export const x=1;\n' > "$d/apps/api/src/routes/p.ts"
  printf '%s' "$d"
}
WJ=$(ws_js no-console)
if ( cd "$WJ" && AIF_ESLINT_CMD="$FAKE" AIF_ENFORCED_RULE=no-console AIF_FAKE_RULE=no-console AIF_FAKE_CWD_LOG=/dev/null bash "$GATE" ) >/tmp/g535wj.$$ 2>&1 \
   && grep -q 'verifying R2' /tmp/g535wj.$$; then
  ok "workspace .js: no root config, apps/api/eslint.config.js wires the rule → gate recurses + PASSES"
else
  bad "workspace .js: a workspace eslint.config.js was not checked ($(tr '\n' ';' </tmp/g535wj.$$))"
fi
WJN=$(ws_js no-debugger)
if ( cd "$WJN" && AIF_ESLINT_CMD="$FAKE" AIF_ENFORCED_RULE=no-console AIF_FAKE_RULE=no-console AIF_FAKE_CWD_LOG=/dev/null bash "$GATE" ) >/tmp/g535wj.$$ 2>&1; then
  bad "workspace .js NEG: apps/api/eslint.config.js leaves the rule off, yet the gate PASSED"
elif grep -q 'run from the project root' /tmp/g535wj.$$; then
  bad "workspace .js NEG: the gate failed at the missing root config, not on the workspace"
else
  ok "workspace .js NEG: apps/api/eslint.config.js leaves the rule off → gate FAILS in the workspace"
fi
rm -rf "$WJ" "$WJN"; rm -f /tmp/g535q.$$ /tmp/g535wj.$$
# The two gates read RULE_GLOBS and find workspace configs with one block of code, kept byte-identical:
# a copy that drifts makes one gate red where the other is green.
reader_block() { sed -n '/^# >>> rule-globs reader/,/^# <<< rule-globs reader/p' "$1"; }
GLOBS_GATE="$REPO_ROOT/packages/core/audit-self/check-rule-globs.sh"
if [ -n "$(reader_block "$GATE")" ] && [ "$(reader_block "$GATE")" = "$(reader_block "$GLOBS_GATE")" ]; then
  ok "rule-globs reader: check-rule-enforced.sh and check-rule-globs.sh carry the same block"
else
  bad "rule-globs reader: the block differs between the two gates, or is missing ($(diff <(reader_block "$GATE") <(reader_block "$GLOBS_GATE") | head -3 | tr '\n' '|'))"
fi

# The block reads RULE_GLOBS the way JavaScript reads it: a comment is not code, whatever quotes or keys
# it holds, and a key that ends in «boundary» is not boundary (third cold review, after #1868).
rg_read() { # $1 = key, $2 = config → the globs the block reads, each followed by |
  ( eval "$(reader_block "$GLOBS_GATE")"; extract_key "$1" "$2" ) | tr '\n' '|'
}
RD=$(mktemp -d)
cat > "$RD/apostrophe.mjs" <<'JS'
const RULE_GLOBS = {
  boundary: [
    // don't forget the api dir, it's where "handlers" live
    '**/routes/**/*.{ts,tsx}',
  ],
};
JS
cat > "$RD/line-comment.mjs" <<'JS'
// was: boundary: ['**/example/**/*.ts'],
const RULE_GLOBS = {
  boundary: ['**/routes/**/*.{ts,tsx}'],
};
JS
cat > "$RD/block-comment.mjs" <<'JS'
const RULE_GLOBS = {
  /*
   * boundary: ['src/old/handlers.ts'],
   */
  boundary: ['**/routes/**/*.{ts,tsx}'],
};
JS
cat > "$RD/key-suffix.mjs" <<'JS'
const RULE_GLOBS = {
  'my-boundary': ['**/nope/**'],
  boundary: ['**/routes/**/*.{ts,tsx}'],
};
JS
# Only the boundary of the top-level `const RULE_GLOBS = { … }` object is RULE_GLOBS.boundary — the one
# wireOwnConfig reads. Another object's boundary key, or one nested inside RULE_GLOBS, adds nothing (a
# nested `boundary: ['**/*.ts']` matched every file: a false green). A computed literal key and an
# Object.freeze wrapper are read, as JavaScript and the wirer read them (#1889 review F2/F7).
cat > "$RD/nested-other.mjs" <<'JS'
const RULE_GLOBS = {
  boundary: ['**/routes/**/*.{ts,tsx}'],
};
const opts = { layers: { boundary: ['**/*.ts'] } };
JS
cat > "$RD/second-object.mjs" <<'JS'
const OTHER = { boundary: ['**/*.ts'] };
const RULE_GLOBS = { boundary: ['**/routes/**/*.{ts,tsx}'] };
JS
cat > "$RD/nested-inside.mjs" <<'JS'
const RULE_GLOBS = {
  layers: { boundary: ['**/*.ts'] },
  boundary: ['**/routes/**/*.{ts,tsx}'],
  extra: [{ boundary: ['**/*.tsx'] }],
};
JS
cat > "$RD/computed-key.mjs" <<'JS'
const RULE_GLOBS = { ["boundary"]: ['**/routes/**/*.{ts,tsx}'] };
JS
cat > "$RD/frozen.mjs" <<'JS'
const RULE_GLOBS = Object.freeze({
  boundary: ['**/routes/**/*.{ts,tsx}'],
});
JS
# Code above RULE_GLOBS is not RULE_GLOBS: a regex literal with a lone bracket or quote, a stray `)`, or a
# template literal whose later line holds a URL must not hide the block. The wirer writes RULE_GLOBS right
# above `export default`, after all of the consumer's own code (fourth cold review). A type assertion and a
# declaration list are read, as the wirer reads them.
cat > "$RD/regex-above.mjs" <<'JS'
const isGen = (f) => /[(]/.test(f) || /\(/.test(f) || /['"`{]/.test(f);
const RULE_GLOBS = {
  boundary: ['**/routes/**/*.{ts,tsx}'],
};
JS
# A `/*`, `//` or quote inside a regex literal or a template string is not a comment or a string opener
# (fourth cold review: the comment cut read `/\/*$/` as the start of a block comment and dropped the
# rest of the file, and a template string's second line as code).
cat > "$RD/regex.mjs" <<'JS'
const here = import.meta.dirname.replace(/\/*$/, '');
const RULE_GLOBS = {
  boundary: ['**/routes/**/*.{ts,tsx}'],
};
JS
cat > "$RD/regex-class.mjs" <<'JS'
const sep = /[/*'"`]/g; const url = /https?:\/\//;
const RULE_GLOBS = { boundary: ['**/routes/**/*.{ts,tsx}'] };
JS
printf "const re = /'/; const RULE_GLOBS = { boundary: ['**/routes/**/*.{ts,tsx}'] };\n" > "$RD/regex-quote.mjs"
cat > "$RD/template-lines.mjs" <<'JS'
const help = `
  lint src/*.ts only, see https://example.com/docs
  don't forget
`;
const RULE_GLOBS = {
  boundary: ['**/routes/**/*.{ts,tsx}'],
};
JS
cat > "$RD/template-url.mjs" <<'JS'
const msg = `Lint config,
see https://eslint.org/docs /* not a comment`;
const RULE_GLOBS = {
  boundary: ['**/routes/**/*.{ts,tsx}'],
};
JS
cat > "$RD/type-assert.mjs" <<'JS'
const RULE_GLOBS = <const>{ boundary: ['**/routes/**/*.{ts,tsx}'] };
JS
cat > "$RD/decl-list.mjs" <<'JS'
const A = 1, RULE_GLOBS = { boundary: ['**/routes/**/*.{ts,tsx}'] };
JS
cat > "$RD/division.mjs" <<'JS'
const half = 10 /*two*/ / 2, third = (9) / 3; const RULE_GLOBS = { boundary: ['**/routes/**/*.{ts,tsx}'] };
JS
for f in apostrophe line-comment block-comment key-suffix nested-other second-object nested-inside computed-key frozen regex-above template-url type-assert decl-list regex regex-class regex-quote template-lines division; do
  got=$(rg_read boundary "$RD/$f.mjs")
  [ "$got" = '**/routes/**/*.{ts,tsx}|' ] \
    && ok "rule-globs reader ($f): RULE_GLOBS.boundary is read as JavaScript reads it" \
    || bad "rule-globs reader ($f): read [$got], expected [**/routes/**/*.{ts,tsx}|]"
done
# A template literal spans lines: a `/*` on its later line opens no comment, so code after it stays code.
printf 'const m = `a\nb /* c`;\nconst r = "rules-as-tests/no-unsafe-zod-parse";\n' > "$RD/template-cmt.mjs"
_tc_code=$( eval "$(reader_block "$GLOBS_GATE")"; code_of "$RD/template-cmt.mjs" ) && grep -q 'no-unsafe-zod-parse' <<<"$_tc_code" \
  && ok "rule-globs reader: code_of keeps code after a template literal that holds /*" \
  || bad "rule-globs reader: code_of cut code after a template literal that holds /*"
printf "// boundary: ['**/routes/**']\nexport default [];\n" > "$RD/only-comment.mjs"
if ( eval "$(reader_block "$GLOBS_GATE")"; has_key boundary "$RD/only-comment.mjs" ); then
  bad "rule-globs reader: has_key finds a boundary array that only a comment holds"
else
  ok "rule-globs reader: a boundary array in a comment is not a boundary key"
fi
printf "const OWN = { boundary: ['**/routes/**'] };\nexport default [];\n" > "$RD/not-rule-globs.mjs"
if ( eval "$(reader_block "$GLOBS_GATE")"; has_key boundary "$RD/not-rule-globs.mjs" ); then
  bad "rule-globs reader: has_key finds a boundary array outside RULE_GLOBS"
else
  ok "rule-globs reader: a boundary array outside RULE_GLOBS is not RULE_GLOBS.boundary"
fi
# End to end: RULE_GLOBS.boundary matches nothing, a nested boundary key matches every file — fail.
mkdir -p "$RD/nest/src/lib"; printf 'export const x = 1;\n' > "$RD/nest/src/lib/x.ts"
cat > "$RD/nest/eslint.config.mjs" <<'JS'
const RULE_GLOBS = {
  boundary: ['**/nowhere/**/*.{ts,tsx}'],
};
const opts = { layers: { boundary: ['**/*.ts'] } };
export default [{ files: RULE_GLOBS.boundary, rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } }];
JS
if ( cd "$RD/nest" && bash "$GLOBS_GATE" ) >/dev/null 2>&1; then
  bad "check-rule-globs: passed on a nested boundary key, while RULE_GLOBS.boundary matches no source file"
else
  ok "check-rule-globs: a nested boundary key does not make a dead RULE_GLOBS.boundary pass"
fi
# A package config whose only mention of R2 is a comment does not wire R2 (#1889 observation 7).
cmt_pkg() { # $1 = apps/api/eslint.config.mjs source → dir
  local d; d=$(mktemp -d)
  cat > "$d/eslint.config.mjs" <<'JS'
const RULE_GLOBS = {
  boundary: ['**/routes/**/*.{ts,tsx}'],
};
export default [{ files: RULE_GLOBS.boundary, rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } }];
JS
  mkdir -p "$d/apps/api/src/routes"; printf 'export const x = 1;\n' > "$d/apps/api/src/routes/p.ts"
  printf '%s\n' "$1" > "$d/apps/api/eslint.config.mjs"
  printf '%s' "$d"
}
CM=$(cmt_pkg "// TODO: turn on rules-as-tests/no-unsafe-zod-parse
export default [];")
if ( cd "$CM" && bash "$GLOBS_GATE" ) >/tmp/g535cm.$$ 2>&1; then
  bad "check-rule-globs: a package config that names R2 only in a comment passed as wired ($(tr '\n' ';' </tmp/g535cm.$$))"
else
  grep -q 'does NOT wire R2' /tmp/g535cm.$$ \
    && ok "check-rule-globs: R2 named only in a comment → the package does NOT wire R2" \
    || bad "check-rule-globs: failed, but not on the package config ($(tr '\n' ';' </tmp/g535cm.$$))"
fi
CMP=$(cmt_pkg "// R2 below
export default [{ rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } }];")
( cd "$CMP" && bash "$GLOBS_GATE" ) >/tmp/g535cm.$$ 2>&1 \
  && ok "check-rule-globs neg: a package config that wires R2 in code passes" \
  || bad "check-rule-globs neg: a package config that wires R2 in code failed ($(tr '\n' ';' </tmp/g535cm.$$))"
# A package config under any of ESLint's six flat-config names is that package's config (.mts/.cts too).
CMM=$(cmt_pkg "export default [];"); mv "$CMM/apps/api/eslint.config.mjs" "$CMM/apps/api/eslint.config.mts"
( cd "$CMM" && bash "$GLOBS_GATE" ) >/tmp/g535cm.$$ 2>&1
grep -q 'does NOT wire R2' /tmp/g535cm.$$ \
  && ok "check-rule-globs: a package eslint.config.mts without R2 is read as that package's config" \
  || bad "check-rule-globs: a package eslint.config.mts was not read as its config ($(tr '\n' ';' </tmp/g535cm.$$))"
rm -rf "$CM" "$CMP" "$CMM"; rm -f /tmp/g535cm.$$
# End to end: a comment's quoted glob matches a source file while the real one matches nothing — the gate
# must fail, not pass on the comment.
mkdir -p "$RD/e2e/src/lib"; printf 'export const x = 1;\n' > "$RD/e2e/src/lib/x.ts"
cat > "$RD/e2e/eslint.config.mjs" <<'JS'
const RULE_GLOBS = {
  boundary: [ // was "**/*.ts" before the move
    '**/nowhere/**/*.{ts,tsx}',
  ],
};

export default [{ files: RULE_GLOBS.boundary, rules: {} }];
JS
if ( cd "$RD/e2e" && bash "$GLOBS_GATE" ) >/dev/null 2>&1; then
  bad "check-rule-globs: passed on a glob in a comment, while RULE_GLOBS.boundary matches no source file"
else
  ok "check-rule-globs: a glob in a comment does not make a dead RULE_GLOBS.boundary pass"
fi
# A workspace config with a regex literal above a dead boundary: the gate must fail on the boundary, not
# lose the array to a comment the regex seemed to open and skip the workspace as R2 N/A.
mkdir -p "$RD/ws/apps/api/src/routes"; printf '{"name":"m","private":true}\n' > "$RD/ws/package.json"
printf 'export const h = 1;\n' > "$RD/ws/apps/api/src/routes/users.ts"
cat > "$RD/ws/apps/api/eslint.config.mjs" <<'JS'
const here = import.meta.dirname.replace(/\/*$/, '');
const RULE_GLOBS = {
  boundary: ['**/handlers/**/*.{ts,tsx}'],
};
export default [{ files: RULE_GLOBS.boundary, rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } }];
JS
if ( cd "$RD/ws" && bash "$GLOBS_GATE" ) >/dev/null 2>&1; then
  bad "check-rule-globs: passed a workspace whose RULE_GLOBS.boundary matches no source file, with a regex literal above it"
else
  ok "check-rule-globs: a regex literal above a dead workspace RULE_GLOBS.boundary does not make it pass"
fi
rm -rf "$RD"

# check-rule-enforced.sh finds a package's config under all six flat-config names, as ESLint does: a
# package whose own eslint.config.mts leaves R2 off governs its boundary file, not the root config.
MT=$(mktemp -d); write_root_cfg "$MT" no-console
printf '{"name":"mt","dependencies":{"zod":"3.0.0"}}\n' > "$MT/package.json"
mkdir -p "$MT/apps/api/src/routes"; printf 'export const x = 1;\n' > "$MT/apps/api/src/routes/p.ts"
printf 'export default [];\n' > "$MT/apps/api/eslint.config.mts"
if ( cd "$MT" && AIF_ESLINT_CMD="$FAKE" AIF_ENFORCED_RULE=no-console AIF_FAKE_RULE=no-console AIF_FAKE_CWD_LOG=/dev/null bash "$GATE" ) >/tmp/g535mt.$$ 2>&1; then
  bad "check-rule-enforced: a package eslint.config.mts that leaves the rule off passed — verified against the root config ($(tr '\n' ';' </tmp/g535mt.$$))"
else
  grep -q 'apps/api' /tmp/g535mt.$$ \
    && ok "check-rule-enforced: a package eslint.config.mts governs its boundary file (rule off there → FAIL)" \
    || bad "check-rule-enforced: failed, but not on apps/api ($(tr '\n' ';' </tmp/g535mt.$$))"
fi
# check-rule-enforced.sh prunes the framework's vendored packages/core as check-rule-globs.sh does: a
# vendored eslint-rules file there is not the consumer's boundary code.
VC=$(mktemp -d)
cat > "$VC/eslint.config.mjs" <<'CFG'
const RULE_GLOBS = {
  boundary: ['**/eslint-rules/**/*.{ts,tsx}'],
};
export default [{ files: RULE_GLOBS.boundary, rules: { 'no-console': 'error' } }];
CFG
printf '{"name":"vc","dependencies":{"zod":"3.0.0"}}\n' > "$VC/package.json"
mkdir -p "$VC/packages/core/eslint-rules"; printf 'export const x = 1;\n' > "$VC/packages/core/eslint-rules/index.ts"
mkdir -p "$VC/src/eslint-rules"; printf 'export const y = 1;\n' > "$VC/src/eslint-rules/own.ts"
if ( cd "$VC" && AIF_ESLINT_CMD="$FAKE" AIF_ENFORCED_RULE=no-console AIF_FAKE_RULE=no-console AIF_FAKE_CWD_LOG=/dev/null bash "$GATE" ) >/tmp/g535vc.$$ 2>&1 \
   && ! grep -q 'packages/core' /tmp/g535vc.$$ && ! grep -qi 'skipped' /tmp/g535vc.$$; then
  ok "check-rule-enforced: the vendored packages/core is not the consumer's boundary code"
else
  bad "check-rule-enforced: checked a vendored packages/core file as boundary code ($(tr '\n' ';' </tmp/g535vc.$$))"
fi
# A consumer workspace NAMED packages/core is the consumer's own code: only getff's vendored subtrees
# (packages/core/hooks, eslint-rules, audit-self, principles) are pruned, not every */packages/core.
PC=$(mktemp -d); write_root_cfg "$PC" no-console
printf '{"name":"pc","dependencies":{"zod":"3.0.0"}}\n' > "$PC/package.json"
mkdir -p "$PC/packages/core/src/routes"; printf 'export const x = 1;\n' > "$PC/packages/core/src/routes/a.ts"
printf 'export default [];\n' > "$PC/packages/core/eslint.config.mjs"
if ( cd "$PC" && AIF_ESLINT_CMD="$FAKE" AIF_ENFORCED_RULE=no-console AIF_FAKE_RULE=no-console AIF_FAKE_CWD_LOG=/dev/null bash "$GATE" ) >/tmp/g535pc.$$ 2>&1; then
  bad "check-rule-enforced: a consumer workspace named packages/core with the rule off passed ($(tr '\n' ';' </tmp/g535pc.$$))"
else
  grep -q 'packages/core' /tmp/g535pc.$$ \
    && ok "check-rule-enforced: a consumer workspace named packages/core is checked (rule off there → FAIL)" \
    || bad "check-rule-enforced: failed, but not on packages/core ($(tr '\n' ';' </tmp/g535pc.$$))"
fi
rm -rf "$MT" "$VC" "$PC"; rm -f /tmp/g535mt.$$ /tmp/g535vc.$$ /tmp/g535pc.$$

rm -f "$FAKE" /tmp/g535a.$$ /tmp/g535b.$$ /tmp/g535r.$$ /tmp/g535r2.$$ /tmp/g535c.$$ /tmp/g535d.$$ /tmp/g535ms.$$ /tmp/g535msn.$$ /tmp/g535msd.$$ 2>/dev/null
echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
