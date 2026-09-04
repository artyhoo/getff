#!/usr/bin/env bash
# tests/install-sh/first-commit-passable.test.sh — first-commit-passable F1 (issues 1528/1529/1530)
#
# Regression arms for the shipped first-commit path:
#   issue 1528 — gitignore-less consumer stages node_modules/ on `git add -A` → arms (a)/(b)
#   issue 1529 — install commit lints eslint-ignored delivered files → arms (d)/(g)
#   issue 1530 — vitest.config.ts setupFiles ships no tests/setup.ts → arms (c)/(f)
#
# Layer-2 invariant under test (paired negatives, T15): the seed deliveries are
# copy_safe — a consumer's OWN .gitignore / tests/setup.ts / tsconfig.json must
# survive byte-identical, and the brownfield gate must SKIP tests/setup.ts (with
# one ⚠ note) when the consumer tsconfig does not cover tests/.
#
# Deterministic, no network: plain `install.sh <stack>` (deps install is gated
# behind --full in setup.d/70-deps.sh, so these runs never touch npm).
set -uo pipefail

REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL="$REPO_ROOT/install.sh"
GITIGNORE_TPL="$REPO_ROOT/packages/core/templates/shared/gitignore"
LINTSTAGED_TPL="$REPO_ROOT/packages/core/templates/shared/.lintstagedrc.json"
SETUP_TS_SERVER="$REPO_ROOT/templates/ts-server/tests-setup.ts"
SETUP_REACT_SPA="$REPO_ROOT/packages/preset-react-spa/templates/tests-setup.ts"
SETUP_NEXT15="$REPO_ROOT/packages/preset-next-15-canonical/templates/tests-setup.ts"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

[ -f "$INSTALL" ]       || { echo "FATAL: $INSTALL not found"; exit 1; }
[ -f "$GITIGNORE_TPL" ] || { echo "FATAL: $GITIGNORE_TPL not found"; exit 1; }

SCRATCH=$(mktemp -d)
trap 'rm -rf "$SCRATCH"' EXIT

# md5_of <file> — first available hasher's digest; hard-fails when NO hasher
# exists (a vacuous "" = "" comparison would silently pass every byte-identity
# arm, T15). Falls back for hosts without coreutils md5sum (e.g. macOS).
md5_of() {
  local h=""
  if command -v md5sum >/dev/null 2>&1; then
    h=$(md5sum "$1" 2>/dev/null | awk '{print $1}')
  elif command -v shasum >/dev/null 2>&1; then
    h=$(shasum -a 256 "$1" 2>/dev/null | awk '{print $1}')
  elif command -v sha256sum >/dev/null 2>&1; then
    h=$(sha256sum "$1" 2>/dev/null | awk '{print $1}')
  fi
  if [ -z "$h" ]; then
    echo "  ✗ md5_of: no hasher available (md5sum/shasum/sha256sum)" >&2
    exit 1
  fi
  printf '%s\n' "$h"
}

# run_install <stack> <fixture> — prints combined output; caller reads exit via $?
run_install() {
  local stack="$1" fixture="$2"
  ( cd "$fixture" && bash "$INSTALL" "$stack" ) 2>&1
}

seed_fixture() {
  local root="$1"
  mkdir -p "$root/src"
  cat > "$root/package.json" <<'JSON'
{ "name": "fcp-fixture", "version": "0.0.0", "private": true }
JSON
  printf 'export const answer = 42;\n' > "$root/src/index.ts"
}

# ── Arm (a): bare consumer → .gitignore seed lands, byte-identical to template ──────────
FA="$SCRATCH/arm-a"
seed_fixture "$FA"
out_a=$(run_install ts-server "$FA"); rc_a=$?
if [ "$rc_a" -eq 0 ]; then
  ok "arm-a: install exit 0 (bare consumer)"
else
  bad "arm-a: install exit $rc_a; output: $out_a"
fi
if [ -f "$FA/.gitignore" ] && [ "$(md5_of "$FA/.gitignore")" = "$(md5_of "$GITIGNORE_TPL")" ]; then
  ok "arm-a: .gitignore seed landed byte-identical to template (issue 1528 GREEN side)"
else
  bad "arm-a: .gitignore missing or differs from template"
fi

# ── Arm (b): paired negative — consumer's OWN .gitignore untouched; note fires iff ──────
#     no node_modules line.
# b1: own .gitignore WITHOUT node_modules → byte-identical + exactly one ⚠ note.
FB1="$SCRATCH/arm-b1"
seed_fixture "$FB1"
printf 'build/\n*.log\n' > "$FB1/.gitignore"
own_md5=$(md5_of "$FB1/.gitignore")
out_b1=$(run_install ts-server "$FB1"); rc_b1=$?
notes_b1=$(printf '%s\n' "$out_b1" | grep -c 'gitignore exists without a node_modules line' || true)
if [ "$rc_b1" -eq 0 ] && [ "$(md5_of "$FB1/.gitignore")" = "$own_md5" ]; then
  ok "arm-b1: consumer .gitignore byte-identical post-install (Layer-2 hold)"
else
  bad "arm-b1: consumer .gitignore MUTATED (rc=$rc_b1) — Layer-2 violation"
fi
if [ "$notes_b1" -eq 1 ]; then
  ok "arm-b1: ⚠ note fired exactly once for gitignore lacking node_modules"
else
  bad "arm-b1: expected exactly 1 ⚠ note, got $notes_b1"
fi
# b2: own .gitignore WITH node_modules → byte-identical + NO note.
FB2="$SCRATCH/arm-b2"
seed_fixture "$FB2"
printf 'node_modules/\nbuild/\n' > "$FB2/.gitignore"
own_md5_b2=$(md5_of "$FB2/.gitignore")
out_b2=$(run_install ts-server "$FB2"); rc_b2=$?
notes_b2=$(printf '%s\n' "$out_b2" | grep -c 'gitignore exists without a node_modules line' || true)
if [ "$rc_b2" -eq 0 ] && [ "$(md5_of "$FB2/.gitignore")" = "$own_md5_b2" ]; then
  ok "arm-b2: consumer .gitignore (with node_modules) byte-identical post-install"
else
  bad "arm-b2: consumer .gitignore MUTATED (rc=$rc_b2) — Layer-2 violation"
fi
if [ "$notes_b2" -eq 0 ]; then
  ok "arm-b2: no ⚠ note when consumer gitignore already covers node_modules"
else
  bad "arm-b2: spurious ⚠ note ($notes_b2) on a covered gitignore"
fi

# ── Arm (c): tests/setup.ts lands per stack with expected content; consumer's own ───────
#     tests/setup.ts survives byte-identical.
for stack in ts-server react-next react-spa; do
  FC="$SCRATCH/arm-c-$stack"
  seed_fixture "$FC"
  run_install "$stack" "$FC" >/dev/null 2>&1; rc_c=$?
  case "$stack" in
    ts-server)  src="$SETUP_TS_SERVER"  marker="Vitest setup hook" ;;
    react-next) src="$SETUP_NEXT15"     marker="jest-dom/vitest" ;;
    react-spa)  src="$SETUP_REACT_SPA"  marker="jest-dom/vitest" ;;
  esac
  if [ "$rc_c" -eq 0 ] && [ -f "$FC/tests/setup.ts" ] \
     && [ "$(md5_of "$FC/tests/setup.ts")" = "$(md5_of "$src")" ]; then
    ok "arm-c ($stack): tests/setup.ts delivered byte-identical to $src"
  else
    bad "arm-c ($stack): tests/setup.ts missing or differs (rc=$rc_c)"
  fi
  if grep -q "$marker" "$FC/tests/setup.ts" 2>/dev/null; then
    ok "arm-c ($stack): content carries the stack contract marker ('$marker')"
  else
    bad "arm-c ($stack): content missing expected marker '$marker'"
  fi
done
# Paired negative: pre-existing consumer tests/setup.ts survives.
FCOWN="$SCRATCH/arm-c-own"
seed_fixture "$FCOWN"
mkdir -p "$FCOWN/tests"
printf '// my own setup\n' > "$FCOWN/tests/setup.ts"
own_setup_md5=$(md5_of "$FCOWN/tests/setup.ts")
run_install ts-server "$FCOWN" >/dev/null 2>&1; rc_cown=$?
if [ "$rc_cown" -eq 0 ] && [ "$(md5_of "$FCOWN/tests/setup.ts")" = "$own_setup_md5" ]; then
  ok "arm-c (own): pre-existing consumer tests/setup.ts byte-identical post-install"
else
  bad "arm-c (own): consumer tests/setup.ts CLOBBERED (rc=$rc_cown) — Layer-2 violation"
fi

# ── Arm (d): delivered .lintstagedrc.json carries --no-warn-ignored on BOTH eslint lines ─
FD="$SCRATCH/arm-d"
seed_fixture "$FD"
run_install ts-server "$FD" >/dev/null 2>&1; rc_d=$?
if [ "$rc_d" -eq 0 ] \
   && [ "$(grep -c -- '--max-warnings=0 --no-warn-ignored' "$FD/.lintstagedrc.json")" -eq 2 ]; then
  ok "arm-d: delivered .lintstagedrc.json has --no-warn-ignored on both eslint lines (issue 1529)"
else
  bad "arm-d: delivered .lintstagedrc.json missing --no-warn-ignored (count=$(grep -c -- '--no-warn-ignored' "$FD/.lintstagedrc.json" 2>/dev/null || echo 0))"
fi
if [ "$(md5_of "$FD/.lintstagedrc.json")" = "$(md5_of "$LINTSTAGED_TPL")" ]; then
  ok "arm-d: delivered file byte-identical to updated template"
else
  bad "arm-d: delivered .lintstagedrc.json differs from template"
fi

# ── Arm (e): refresh-covers-full-delivery EXCLUDED list carries the two new destinations ─
# (asserted here as a live check; the heredoc edit itself lives in the sibling test file)
if grep -qE '^[[:space:]]*\.gitignore$' "$REPO_ROOT/tests/install-sh/refresh-covers-full-delivery.test.sh" \
   && grep -qE '^[[:space:]]*tests/setup.ts$' "$REPO_ROOT/tests/install-sh/refresh-covers-full-delivery.test.sh"; then
  ok "arm-e: .gitignore + tests/setup.ts present in refresh-covers-full-delivery EXCLUDED list"
else
  bad "arm-e: new copy_safe destinations missing from EXCLUDED heredoc → sibling test RED"
fi

# ── Arm (f): brownfield tsconfig gate (issue 1530, mandatory — CI consumer is greenfield) ─
# f1: consumer tsconfig include=["src/**/*"] → setup NOT delivered + ⚠ note exactly once.
FF1="$SCRATCH/arm-f1"
seed_fixture "$FF1"
cat > "$FF1/tsconfig.json" <<'JSON'
{ "compilerOptions": { "strict": true }, "include": ["src/**/*"] }
JSON
out_f1=$(run_install ts-server "$FF1"); rc_f1=$?
notes_f1=$(printf '%s\n' "$out_f1" | grep -c 'tests/setup.ts NOT delivered' || true)
if [ "$rc_f1" -eq 0 ] && [ ! -f "$FF1/tests/setup.ts" ] && [ "$notes_f1" -eq 1 ]; then
  ok "arm-f1: brownfield (include=src/**) → setup NOT delivered, exactly one ⚠ note"
else
  bad "arm-f1: setup exists=$([ -f "$FF1/tests/setup.ts" ] && echo yes || echo no), notes=$notes_f1, rc=$rc_f1"
fi
# f2: consumer tsconfig with NO include key → delivered, no note (tsc default = whole tree).
FF2="$SCRATCH/arm-f2"
seed_fixture "$FF2"
printf '{ "compilerOptions": { "strict": true } }\n' > "$FF2/tsconfig.json"
out_f2=$(run_install ts-server "$FF2"); rc_f2=$?
notes_f2=$(printf '%s\n' "$out_f2" | grep -c 'tests/setup.ts NOT delivered' || true)
if [ "$rc_f2" -eq 0 ] && [ -f "$FF2/tests/setup.ts" ] && [ "$notes_f2" -eq 0 ]; then
  ok "arm-f2: tsconfig without include key → setup delivered, no note"
else
  bad "arm-f2: setup exists=$([ -f "$FF2/tests/setup.ts" ] && echo yes || echo no), notes=$notes_f2, rc=$rc_f2"
fi
# f4: consumer tsconfig include already covering tests/ → delivered, no note (predicate arm 3).
FF4="$SCRATCH/arm-f4"
seed_fixture "$FF4"
printf '{ "compilerOptions": { "strict": true }, "include": ["src/**/*", "tests/**/*"] }\n' > "$FF4/tsconfig.json"
out_f4=$(run_install ts-server "$FF4"); rc_f4=$?
notes_f4=$(printf '%s\n' "$out_f4" | grep -c 'tests/setup.ts NOT delivered' || true)
if [ "$rc_f4" -eq 0 ] && [ -f "$FF4/tests/setup.ts" ] && [ "$notes_f4" -eq 0 ]; then
  ok "arm-f4: tsconfig include covering tests/ → setup delivered, no note"
else
  bad "arm-f4: setup exists=$([ -f "$FF4/tests/setup.ts" ] && echo yes || echo no), notes=$notes_f4, rc=$rc_f4"
fi
# f3: JSONC tsconfig (// comment) → fail-OPEN: delivered, no note, exit 0.
FF3="$SCRATCH/arm-f3"
seed_fixture "$FF3"
cat > "$FF3/tsconfig.json" <<'JSONC'
// tsc --init style comment
{ "compilerOptions": { "strict": true }, "include": ["src/**/*"] }
JSONC
out_f3=$(run_install ts-server "$FF3"); rc_f3=$?
notes_f3=$(printf '%s\n' "$out_f3" | grep -c 'tests/setup.ts NOT delivered' || true)
if [ "$rc_f3" -eq 0 ] && [ -f "$FF3/tests/setup.ts" ] && [ "$notes_f3" -eq 0 ]; then
  ok "arm-f3: JSONC tsconfig → fail-open (delivered, no note, exit 0)"
else
  bad "arm-f3: fail-open broken — setup exists=$([ -f "$FF3/tests/setup.ts" ] && echo yes || echo no), notes=$notes_f3, rc=$rc_f3"
fi

# ── Arm (g): pnpm-workspace → per-package .lintstagedrc.json stubs carry the flag ────────
# (propagation-by-construction: stubs are cp'd from the delivered root file at
# setup.d/40-configs.sh workspace branch — asserted once here.)
FG="$SCRATCH/arm-g"
seed_fixture "$FG"
mkdir -p "$FG/packages/app"
printf '{ "name": "app", "version": "0.0.0", "private": true }\n' > "$FG/packages/app/package.json"
printf 'packages:\n  - "packages/*"\n' > "$FG/pnpm-workspace.yaml"
run_install ts-server "$FG" >/dev/null 2>&1; rc_g=$?
if [ "$rc_g" -eq 0 ] \
   && [ "$(grep -c -- '--max-warnings=0 --no-warn-ignored' "$FG/packages/app/.lintstagedrc.json")" -eq 2 ]; then
  ok "arm-g: per-package stub carries --no-warn-ignored on both eslint lines (propagation)"
else
  bad "arm-g: per-package stub missing flag or not delivered (rc=$rc_g)"
fi

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
