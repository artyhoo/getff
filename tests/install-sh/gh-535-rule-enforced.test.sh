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

rm -f "$FAKE" /tmp/g535a.$$ /tmp/g535b.$$ /tmp/g535r.$$ /tmp/g535r2.$$ /tmp/g535c.$$ /tmp/g535d.$$ /tmp/g535ms.$$ /tmp/g535msn.$$ /tmp/g535msd.$$ 2>/dev/null
echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
