#!/usr/bin/env bash
# gh-730-r2-zod-scope.test.sh — check-rule-enforced.sh must skip packages whose nearest
# package.json does NOT declare "zod" as "R2 N/A (skipped)", while still failing packages that
# declare "zod" but haven't wired R2 (non-vacuity).
#
# Acceptance per kickoff §6:
# - Arm 1: mixed monorepo (apps/api has zod + R2 wired, apps/mobile no zod + R2 unwired) → exit 0;
#   apps/mobile logged as "no zod boundary — R2 N/A (skipped)"; apps/api logged as ✓
# - Arm 2 (non-vacuity): apps/api declares zod but config does NOT wire R2 → gate FAILS (skip
#   does not swallow a real zod-package inertness)
# - Arm 3 (paired-negative): zod package with R2 wired → gate PASSES (no false-fail)
# - Arm 4 (self-application / anti-T-R2-SCOPE-A): when apps/mobile declares zod but lacks R2,
#   gate FAILS — proves the skip is conditional on absence of zod, not unconditional
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
GATE="$REPO_ROOT/packages/core/audit-self/check-rule-enforced.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# Root eslint.config.mjs with RULE_GLOBS.boundary over src/ (matches both apps/api and apps/mobile).
write_root_cfg() { # $1=dir $2=rule
  cat > "$1/eslint.config.mjs" <<CFG
const RULE_GLOBS = {
  boundary: ['**/src/**/*.{ts,tsx}'],
};
export default [{ files: RULE_GLOBS.boundary, rules: { '$2': 'error' } }];
CFG
}

# CWD-aware fake eslint: emits the rule iff the nearest eslint.config.* from $PWD contains it.
# Same harness as gh-535-rule-enforced.test.sh — tests the gate's cwd-resolution faithfully.
FAKE=$(mktemp)
cat > "$FAKE" <<'ES'
#!/bin/sh
echo "$PWD" >> "$AIF_FAKE_CWD_LOG"
[ "$1" = "--print-config" ] || exit 0
d=$PWD
while [ -n "$d" ] && [ "$d" != "/" ]; do
  for c in eslint.config.mjs eslint.config.js eslint.config.cjs eslint.config.ts; do
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

# ── Arm 1: mixed monorepo — apps/api (zod + R2 wired) + apps/mobile (no zod, no R2) → exit 0 ──
A=$(mktemp -d)
mkdir -p "$A/apps/api/src/routes" "$A/apps/mobile/src/app"
write_root_cfg "$A" no-console
# apps/api: package.json declares zod; eslint config wires the rule
printf '{"name":"api","dependencies":{"zod":"3.0.0"}}\n' > "$A/apps/api/package.json"
printf "export default [{ files: ['**/src/**/*.{ts,tsx}'], rules: { 'no-console': 'error' } }];\n" > "$A/apps/api/eslint.config.mjs"
printf 'export const x = 1;\n' > "$A/apps/api/src/routes/probe.ts"
# apps/mobile: package.json has NO zod; eslint config does NOT wire the rule
printf '{"name":"mobile","dependencies":{"expo":"50.0.0"}}\n' > "$A/apps/mobile/package.json"
printf "export default [{ files: ['**/*.{ts,tsx}'], rules: {} }];\n" > "$A/apps/mobile/eslint.config.mjs"
printf 'export const idx = 1;\n' > "$A/apps/mobile/src/app/index.tsx"
CWDLOG_A="$A.cwdlog"; : > "$CWDLOG_A"
out1=$( cd "$A" && AIF_ESLINT_CMD="$FAKE" AIF_ENFORCED_RULE=no-console AIF_FAKE_RULE=no-console AIF_FAKE_CWD_LOG="$CWDLOG_A" bash "$GATE" 2>&1 )
rc1=$?
[ "$rc1" -eq 0 ] && ok "Arm1: mixed monorepo (api zod+R2, mobile no-zod) → gate exits 0" \
  || bad "Arm1: gate exited $rc1 (expected 0) — $(echo "$out1" | tr '\n' ';')"
grep -q "apps/mobile.*no zod boundary.*R2 N/A.*skipped" <<<"$out1" \
  && ok "Arm1: apps/mobile logged 'no zod boundary — R2 N/A (skipped)'" \
  || bad "Arm1: apps/mobile skip log line missing — $(echo "$out1" | tr '\n' ';')"
# The skip line names the file it is about, as the root scope's does: one package can hold a nested
# package.json without zod beside code that has it (third cold review 2026-09-29).
grep -q "apps/mobile: no zod boundary at apps/mobile/src/app/index\.tsx — R2 N/A (skipped)" <<<"$out1" \
  && ok "Arm1: the apps/mobile skip line names the file it is about" \
  || bad "Arm1: the apps/mobile skip line does not name its file — $(grep 'no zod' <<<"$out1" | tr '\n' ';')"
grep -q "✓" <<<"$out1" \
  && ok "Arm1: apps/api reported R2 applied (✓ line present)" \
  || bad "Arm1: apps/api ✓ line missing — $(echo "$out1" | tr '\n' ';')"

# ── Arm 2: non-vacuity — apps/api HAS zod but R2 NOT wired → gate must FAIL ──
B=$(mktemp -d)
mkdir -p "$B/apps/api/src/routes"
write_root_cfg "$B" no-console
printf '{"name":"api","dependencies":{"zod":"3.0.0"}}\n' > "$B/apps/api/package.json"
# config does NOT wire the rule
printf "export default [{ files: ['**/*.{ts,tsx}'], rules: {} }];\n" > "$B/apps/api/eslint.config.mjs"
printf 'export const x = 1;\n' > "$B/apps/api/src/routes/probe.ts"
CWDLOG_B="$B.cwdlog"; : > "$CWDLOG_B"
out2=$( cd "$B" && AIF_ESLINT_CMD="$FAKE" AIF_ENFORCED_RULE=no-console AIF_FAKE_RULE=no-console AIF_FAKE_CWD_LOG="$CWDLOG_B" bash "$GATE" 2>&1 )
rc2=$?
[ "$rc2" -ne 0 ] \
  && ok "Arm2 non-vacuity: apps/api has zod but R2 inert → gate FAILS (skip is conditional, not blanket)" \
  || bad "Arm2 non-vacuity: gate PASSED a zod-package with R2 inert (false-green — skip swallowed a real inertness)"

# ── Arm 3: paired-negative — zod package WITH R2 wired → gate PASSES (no false-fail) ──
C=$(mktemp -d)
mkdir -p "$C/apps/api/src/routes"
write_root_cfg "$C" no-console
printf '{"name":"api","dependencies":{"zod":"3.0.0"}}\n' > "$C/apps/api/package.json"
printf "export default [{ files: ['**/src/**/*.{ts,tsx}'], rules: { 'no-console': 'error' } }];\n" > "$C/apps/api/eslint.config.mjs"
printf 'export const x = 1;\n' > "$C/apps/api/src/routes/probe.ts"
CWDLOG_C="$C.cwdlog"; : > "$CWDLOG_C"
out3=$( cd "$C" && AIF_ESLINT_CMD="$FAKE" AIF_ENFORCED_RULE=no-console AIF_FAKE_RULE=no-console AIF_FAKE_CWD_LOG="$CWDLOG_C" bash "$GATE" 2>&1 )
rc3=$?
[ "$rc3" -eq 0 ] \
  && ok "Arm3 paired-neg: zod package with R2 wired → gate PASSES (no false-fail)" \
  || bad "Arm3 paired-neg: gate false-failed a zod package that wires R2 — $(echo "$out3" | tr '\n' ';')"

# ── Arm 4: self-application — skip is conditional on zod-absence (not unconditional) ──
# Same layout as Arm 1, but apps/mobile NOW declares zod (no R2 still) → gate must FAIL.
# This proves: the green exit in Arm 1 is because mobile lacks zod, NOT because the skip is
# unconditional. Removing the zod gate or making it always-skip would pass this with wrong logic.
D=$(mktemp -d)
mkdir -p "$D/apps/api/src/routes" "$D/apps/mobile/src/app"
write_root_cfg "$D" no-console
printf '{"name":"api","dependencies":{"zod":"3.0.0"}}\n' > "$D/apps/api/package.json"
printf "export default [{ files: ['**/src/**/*.{ts,tsx}'], rules: { 'no-console': 'error' } }];\n" > "$D/apps/api/eslint.config.mjs"
printf 'export const x = 1;\n' > "$D/apps/api/src/routes/probe.ts"
# apps/mobile now HAS zod (as if it were R2-relevant) but still no R2 in config
printf '{"name":"mobile","dependencies":{"zod":"3.0.0","expo":"50.0.0"}}\n' > "$D/apps/mobile/package.json"
printf "export default [{ files: ['**/*.{ts,tsx}'], rules: {} }];\n" > "$D/apps/mobile/eslint.config.mjs"
printf 'export const idx = 1;\n' > "$D/apps/mobile/src/app/index.tsx"
CWDLOG_D="$D.cwdlog"; : > "$CWDLOG_D"
out4=$( cd "$D" && AIF_ESLINT_CMD="$FAKE" AIF_ENFORCED_RULE=no-console AIF_FAKE_RULE=no-console AIF_FAKE_CWD_LOG="$CWDLOG_D" bash "$GATE" 2>&1 )
rc4=$?
[ "$rc4" -ne 0 ] \
  && ok "Arm4 self-application: apps/mobile with zod but no R2 → gate FAILS (skip is zod-conditional, not blanket)" \
  || bad "Arm4 self-application: gate PASSED when mobile has zod+no-R2 (skip is unconditional/broken)"

rm -f "$FAKE" 2>/dev/null
echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
