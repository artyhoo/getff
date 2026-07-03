#!/usr/bin/env bash
# install-self-verification.test.sh — D6 e2e: shipped gate scripts are present,
# structurally correct, and degrade gracefully when called outside a full consumer install.
#
# This is a repo-side CI test (not a consumer gate). It verifies:
#   (i)   Gate scripts exist at their expected source paths + are executable
#   (ii)  Fixture directory exists with manifest + bad/good pairs (all 3 fence fixtures)
#   (iii) check-fences-fire.sh degrades cleanly (SKIP rc=0) when barrel is absent
#   (iv)  check-shields-up.sh degrades cleanly (SKIP rc=0) outside a git repo
#   (v)   check-generated-rule-mutation.sh degrades cleanly (rc=0) when manifest is absent
#   (vi)  99-finalize.sh capstone block is present and has the correct FULL guard pattern
#   (vii) 40-configs.sh ships all 3 new scripts via copy_safe
#   (viii) 70-deps.sh wires check:fences-fire + check:shields-up into validate aggregate
#
# No network, no npm install, no TSX required — all structural checks.
# @dual-pair: install-self-verification-d6
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "✗ $1"; }

# ─── Arm (i): gate scripts exist and are executable ───────────────────────────
for _script in \
  "packages/core/audit-self/check-fences-fire.sh" \
  "packages/core/audit-self/check-shields-up.sh" \
  "packages/core/audit-self/check-generated-rule-mutation.sh" \
  "packages/core/synthesizer/run-generated-rule-mutation.sh"; do
  if [ -x "$REPO_ROOT/$_script" ]; then
    ok "(i) $_script — exists and executable"
  elif [ -f "$REPO_ROOT/$_script" ]; then
    bad "(i) $_script — exists but NOT executable (chmod +x needed)"
  else
    bad "(i) $_script — MISSING"
  fi
done

# ─── Arm (ii): fixture directory structure ────────────────────────────────────
FIXTURE_DIR="$REPO_ROOT/packages/core/audit-self/fixtures/fences-fire"
if [ -d "$FIXTURE_DIR" ]; then
  ok "(ii) fixtures/fences-fire directory exists"
else
  bad "(ii) fixtures/fences-fire directory MISSING"
fi

# 3 fence fixtures × 3 files (bad, good, manifest)
for _fence in "no-unsafe-zod-parse" "no-server-imports-in-client" "require-use-server-directive"; do
  MANIFEST="$FIXTURE_DIR/${_fence}.manifest.json"
  BAD_FILE=$(ls "$FIXTURE_DIR/${_fence}.bad."* 2>/dev/null | head -1 || true)
  GOOD_FILE=$(ls "$FIXTURE_DIR/${_fence}.good."* 2>/dev/null | head -1 || true)
  if [ -f "$MANIFEST" ]; then
    ok "(ii) $_fence.manifest.json present"
  else
    bad "(ii) $_fence.manifest.json MISSING"
  fi
  if [ -n "$BAD_FILE" ]; then
    ok "(ii) $_fence bad fixture: $(basename "$BAD_FILE")"
  else
    bad "(ii) $_fence bad fixture (.bad.*) MISSING"
  fi
  if [ -n "$GOOD_FILE" ]; then
    ok "(ii) $_fence good fixture: $(basename "$GOOD_FILE")"
  else
    bad "(ii) $_fence good fixture (.good.*) MISSING"
  fi
done

# ─── Arm (iii): check-fences-fire.sh degrades cleanly when barrel absent ──────
SCRATCH=$(mktemp -d)
trap 'rm -rf "$SCRATCH"' EXIT
# Minimal AIF_PROJECT_ROOT with NO eslint-rules-local barrel (simulates pre-barrel-gen)
mkdir -p "$SCRATCH/scripts/fences-fire-fixtures"
# Copy one fixture manifest so the gate doesn't skip due to zero manifests
cp "$FIXTURE_DIR/no-unsafe-zod-parse.manifest.json" "$SCRATCH/scripts/fences-fire-fixtures/" 2>/dev/null || true
cp "$FIXTURE_DIR"/no-unsafe-zod-parse.bad.* "$SCRATCH/scripts/fences-fire-fixtures/" 2>/dev/null || true
cp "$FIXTURE_DIR"/no-unsafe-zod-parse.good.* "$SCRATCH/scripts/fences-fire-fixtures/" 2>/dev/null || true

ARM3_RC=0
AIF_PROJECT_ROOT="$SCRATCH" bash "$REPO_ROOT/packages/core/audit-self/check-fences-fire.sh" \
  >/dev/null 2>&1 || ARM3_RC=$?

# The gate should exit 0 (either SKIP due to barrel-absent or SKIP due to tsx-absent, never crash)
if [ "$ARM3_RC" -eq 0 ]; then
  ok "(iii) check-fences-fire.sh degrades cleanly (rc=0) when barrel absent — no crash"
else
  bad "(iii) check-fences-fire.sh exited rc=$ARM3_RC without a barrel (should SKIP, not FAIL)"
fi

# ─── Arm (iv): check-shields-up.sh degrades cleanly outside a git repo ────────
NO_GIT_DIR=$(mktemp -d)
trap 'rm -rf "$NO_GIT_DIR"' EXIT
ARM4_RC=0
AIF_PROJECT_ROOT="$NO_GIT_DIR" bash "$REPO_ROOT/packages/core/audit-self/check-shields-up.sh" \
  >/dev/null 2>&1 || ARM4_RC=$?

if [ "$ARM4_RC" -eq 0 ]; then
  ok "(iv) check-shields-up.sh degrades cleanly (rc=0) outside a git repo — no crash"
else
  bad "(iv) check-shields-up.sh exited rc=$ARM4_RC outside a git repo (should SKIP)"
fi

# ─── Arm (v): check-generated-rule-mutation.sh degrades when manifest absent ──
NO_MANIFEST_DIR=$(mktemp -d)
trap 'rm -rf "$NO_MANIFEST_DIR"' EXIT
ARM5_RC=0
bash "$REPO_ROOT/packages/core/audit-self/check-generated-rule-mutation.sh" "$NO_MANIFEST_DIR" \
  >/dev/null 2>&1 || ARM5_RC=$?

if [ "$ARM5_RC" -eq 0 ]; then
  ok "(v) check-generated-rule-mutation.sh degrades cleanly (rc=0) when manifest absent"
else
  bad "(v) check-generated-rule-mutation.sh exited rc=$ARM5_RC without manifest (should SKIP)"
fi

# ─── Arm (vi): 99-finalize.sh capstone block present + FULL guard ─────────────
FINALIZE="$REPO_ROOT/setup.d/99-finalize.sh"
if grep -q 'install-self-verify' "$FINALIZE" 2>/dev/null && \
   grep -q 'check-fences-fire' "$FINALIZE" 2>/dev/null && \
   grep -q 'check-shields-up' "$FINALIZE" 2>/dev/null && \
   grep -q 'check-generated-rule-mutation' "$FINALIZE" 2>/dev/null; then
  ok "(vi) 99-finalize.sh: self-verify capstone present (fences-fire + shields-up + mutation)"
else
  bad "(vi) 99-finalize.sh: self-verify capstone MISSING or incomplete (check all 3 gate references)"
fi

if grep -q '^\s*if \[ -z.*FULL' "$FINALIZE" 2>/dev/null; then
  ok "(vi) 99-finalize.sh: FULL guard present (capstone runs only on --full install)"
else
  bad "(vi) 99-finalize.sh: FULL guard MISSING — capstone would run on every install"
fi

# ─── Arm (vii): 40-configs.sh ships all new scripts via copy_safe ─────────────
CONFIGS="$REPO_ROOT/setup.d/40-configs.sh"
for _check in "check-fences-fire.sh" "check-shields-up.sh" "run-generated-rule-mutation.sh" "fences-fire-fixtures"; do
  if grep -q "$_check" "$CONFIGS" 2>/dev/null; then
    ok "(vii) 40-configs.sh: ships $_check"
  else
    bad "(vii) 40-configs.sh: does NOT ship $_check"
  fi
done

# ─── Arm (viii): 70-deps.sh wires check:fences-fire + check:shields-up ────────
DEPS="$REPO_ROOT/setup.d/70-deps.sh"
if grep -q '"check:fences-fire"' "$DEPS" 2>/dev/null; then
  ok "(viii) 70-deps.sh: check:fences-fire script declared"
else
  bad "(viii) 70-deps.sh: check:fences-fire script MISSING"
fi
if grep -q '"check:shields-up"' "$DEPS" 2>/dev/null; then
  ok "(viii) 70-deps.sh: check:shields-up script declared"
else
  bad "(viii) 70-deps.sh: check:shields-up script MISSING"
fi
if grep -q 'check:fences-fire.*check:shields-up\|check:shields-up.*check:fences-fire' "$DEPS" 2>/dev/null || \
   grep -q '"validate".*check:fences-fire' "$DEPS" 2>/dev/null; then
  ok "(viii) 70-deps.sh: both gates wired into validate aggregate"
else
  bad "(viii) 70-deps.sh: validate aggregate does NOT reference check:fences-fire/check:shields-up"
fi
if grep -q '"test:mutation:generated"' "$DEPS" 2>/dev/null; then
  ok "(viii) 70-deps.sh: test:mutation:generated script declared (on-demand; NOT in validate)"
else
  bad "(viii) 70-deps.sh: test:mutation:generated script MISSING"
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
