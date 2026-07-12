#!/usr/bin/env bash
# f19 (GH #976) — check-fences-fire.sh must LOAD-PROBE the PLACED eslint.config.mjs,
# not only the synthetic in-memory fixture config.
#
# THE BUG: check-fences-fire proves rule LOGIC via a synthetic Linter config + a barrel
# resolved from packages/core — it never loads the eslint.config.mjs install.sh actually
# placed. After a partial dep-install (e.g. #974 pnpm trust-downgrade) the placed config
# is non-loadable (ERR_MODULE_NOT_FOUND '@eslint/js') yet fences-fire stays GREEN — the
# consumer's real `npx eslint .` is dead but self-verify passes (#discipline-theatre).
#
# THE FIX: a load-probe arm that `import()`s every placed eslint.config.mjs; a
# module-not-found failure is a dep-class SKIP, promoted to FAIL under the self-verify
# capstone's FENCES_FIRE_STRICT=1 (99-finalize.sh sets it when DEPS_INSTALLED=1).
#
# ARM GREEN — a loadable placed config → load-probe ok → rc=0 under STRICT.
# ARM RED (paired-negative) — the SAME config with @eslint/js absent from node_modules
#   → load-probe NON-LOADABLE → skip_dep → STRICT promotes to rc=1. Proves the probe
#   actually gates on loadability and is not always-green.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
FF="$REPO_ROOT/packages/core/audit-self/check-fences-fire.sh"
FULL_NM="$REPO_ROOT/node_modules"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip() { echo "  · $1"; }

if [ ! -x "$FULL_NM/.bin/tsx" ] || [ ! -x "$FULL_NM/.bin/eslint" ] || [ ! -e "$FULL_NM/@eslint/js" ]; then
  skip "f19 SKIP — repo node_modules incomplete (tsx/eslint/@eslint/js absent); run npm ci first"
  echo ""; echo "PASS=$PASS FAIL=$FAIL"; exit 0
fi

# Install the shipped artefacts (config + barrel + fixtures + fences script) — no deps.
T=$(mktemp -d)
printf '{"name":"f19","version":"0.0.0","type":"module"}\n' > "$T/package.json"
( cd "$T" && git init -q && git config user.email t@t && git config user.name t \
    && git add -A && git commit -q -m base \
    && bash "$REPO_ROOT/install.sh" ts-server --force ) >"$T/.install.log" 2>&1
# A MINIMAL loadable placed config whose ONLY external import is @eslint/js (so the RED
# arm can make exactly that dep absent). Overwrites the full shipped config for a
# hermetic single-variable probe.
printf "import js from '@eslint/js';\nexport default [js.configs.recommended];\n" > "$T/eslint.config.mjs"

# ── ARM GREEN — full node_modules → config loads → rc=0 ────────────────────────
# FENCES_FIRE_LOAD_PROBE=1 is the self-verify capstone's opt-in (99-finalize sets it on FULL).
ln -sfn "$FULL_NM" "$T/node_modules"
if AIF_PROJECT_ROOT="$T" FENCES_FIRE_STRICT=1 FENCES_FIRE_LOAD_PROBE=1 bash "$FF" >"$T/.green" 2>&1; then
  if grep -q 'load-probe: placed eslint.config.mjs loads' "$T/.green"; then
    ok "GREEN: loadable placed config → load-probe ok, self-verify passes (rc=0)"
  else
    bad "GREEN: rc=0 but load-probe line absent — the arm did not run (tail: $(tail -2 "$T/.green" | tr '\n' '|'))"
  fi
else
  bad "GREEN: run failed on a loadable config (rc!=0) — false positive (tail: $(tail -3 "$T/.green" | tr '\n' '|'))"
fi

# Break the toolchain: node_modules WITHOUT @eslint/js (the minimal config's only ext import).
rm -f "$T/node_modules"
mkdir -p "$T/node_modules/.bin"
for entry in "$FULL_NM"/*; do
  b=$(basename "$entry"); [ "$b" = "@eslint" ] && continue
  ln -sfn "$entry" "$T/node_modules/$b"
done
mkdir -p "$T/node_modules/@eslint"
for sub in "$FULL_NM/@eslint"/*; do
  sb=$(basename "$sub"); [ "$sb" = "js" ] && continue
  ln -sfn "$sub" "$T/node_modules/@eslint/$sb"
done
ln -sfn "$FULL_NM/.bin/tsx" "$T/node_modules/.bin/tsx"
ln -sfn "$FULL_NM/.bin/eslint" "$T/node_modules/.bin/eslint"

# ── ARM RED (paired-negative) — non-loadable + FENCES_FIRE_LOAD_PROBE=1 → hard FAIL ─
if AIF_PROJECT_ROOT="$T" FENCES_FIRE_LOAD_PROBE=1 bash "$FF" >"$T/.red" 2>&1; then
  bad "RED: LOAD_PROBE=1 run PASSED with @eslint/js absent — the load-probe did not catch the non-loadable placed config (the #976 bug would reland)"
else
  if grep -q 'load-probe: placed eslint.config.mjs NON-LOADABLE' "$T/.red"; then
    ok "RED: @eslint/js absent + FENCES_FIRE_LOAD_PROBE=1 → NON-LOADABLE → hard FAIL (rc!=0), honest RED"
  else
    bad "RED: rc!=0 but not via the load-probe (tail: $(tail -3 "$T/.red" | tr '\n' '|'))"
  fi
fi

# ── ARM GATE (regression guard for the full-barrel false-fail) — same non-loadable
#    config WITHOUT the flag, even under CI-auto-strict → INFORMATIONAL skip, NOT a fail.
#    This is exactly the check-fences-fire-full-barrel context (installs consumers without
#    the full plugin set; relies on CI-auto-strict for the FIXTURE arm only). ─────────────
if CI=1 AIF_PROJECT_ROOT="$T" bash "$FF" >"$T/.gate" 2>&1; then
  if grep -qi 'load-probe:.*non-loadable' "$T/.gate"; then
    ok "GATE: non-loadable config WITHOUT the flag (CI-auto-strict) → informational skip, run still rc=0 (full-barrel not false-failed)"
  else
    bad "GATE: rc=0 but the load-probe line is missing (tail: $(tail -2 "$T/.gate" | tr '\n' '|'))"
  fi
else
  bad "GATE: non-loadable config WITHOUT FENCES_FIRE_LOAD_PROBE still failed under CI-auto-strict — the #976 fix would reland the full-barrel regression (tail: $(tail -3 "$T/.gate" | tr '\n' '|'))"
fi

rm -rf "$T"
echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
