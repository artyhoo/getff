#!/usr/bin/env bash
# tests/install-sh/refresh-reconciles-skill-rename.test.sh — getff-honest-signals S5 / A2
#
# Framework-owned half of the spec: a consumer that installed before the
# `rules-as-tests` → `getff` rename ends up with BOTH skill dirs after refresh.
# The superseded `.claude/skills/rules-as-tests/` dir is framework-owned — refresh
# MUST reclaim it once `.claude/skills/getff/` has been delivered.
#
# Ownership asymmetry (T-S5-A, load-bearing): this fixture exercises ONLY the
# framework-owned reclaim. The consumer-owned `.lintstagedrc.json` half is covered
# by the sibling refresh-offers-lintstaged-migration.test.sh (B2). The two halves
# get deliberately different treatment (kickoff §2).
#
# T-HS-A: every assertion leads with EXIT CODE or FILESYSTEM STATE, never wording.
# T15 (self-application): arm 5 statically verifies the framework's own source tree
# is in the negative-case state (no legacy dir shipped) — the reclaim code's
# self-application is the no-op arm. Live refresh against the framework's own repo
# is deliberately NOT run (it would side-effect `.claude/skills/*`).
#
# Deterministic, no network: invokes install.sh --refresh against mktemp fixtures.
set -uo pipefail

REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL="$REPO_ROOT/install.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

[ -f "$INSTALL" ] || { echo "FATAL: $INSTALL not found"; exit 1; }

SCRATCH=$(mktemp -d)
trap 'rm -rf "$SCRATCH"' EXIT

# Helper: run do_refresh against a fixture project root, capturing stdout+exit.
# Invokes install.sh as a subprocess (the same surface a consumer hits).
# Args: $1 = fixture project-root path.
run_refresh() {
  local fixture="$1"
  # Refresh auto-detects stack from existing files; pass `ts-server` positional to
  # make the test independent of fixture content. --refresh early-exits at
  # install.sh:816 so the full install pipeline never runs (only do_refresh).
  ( cd "$fixture" && bash "$INSTALL" ts-server --refresh ) 2>&1
  echo "EXIT=$?"
}

# Minimal consumer-shape seed: package.json precondition + agents/hooks dirs that
# refresh iterates. Keeps fixtures focused on the skill-rename reclaim surface.
seed_fixture() {
  local root="$1"
  mkdir -p "$root/.claude/agents" "$root/.claude/hooks"
  cat > "$root/package.json" <<'JSON'
{ "name": "fixture-consumer", "version": "0.0.0" }
JSON
}

# ── Arm 1 (pos): legacy + modern both present, NO .override.md → legacy reclaimed ─
# Kickoff §2 DECIDES ownership (no per-consumer probe); reclaim fires when the
# consumer has not placed the `.override.md` opt-out sibling. Arm 2 covers the
# override-present case (kept). Together arm1+arm2 form the override discriminator.
F1="$SCRATCH/arm1"
seed_fixture "$F1"
mkdir -p "$F1/.claude/skills/rules-as-tests/references" \
         "$F1/.claude/skills/getff/references"
echo "# legacy skill body" > "$F1/.claude/skills/rules-as-tests/SKILL.md"
echo "# legacy ref"        > "$F1/.claude/skills/rules-as-tests/references/foo.md"
echo "# modern skill body" > "$F1/.claude/skills/getff/SKILL.md"
echo "# modern ref"        > "$F1/.claude/skills/getff/references/bar.md"

out1=$(run_refresh "$F1"); rc1=$(printf '%s\n' "$out1" | tail -1)
case "$rc1" in
  EXIT=0) ok "arm1: refresh exit 0 (T-HS-A first assertion)" ;;
  *)      bad "arm1: refresh exit non-zero ($rc1); output: $out1" ;;
esac

if [ ! -d "$F1/.claude/skills/rules-as-tests" ]; then
  ok "arm1: legacy .claude/skills/rules-as-tests/ reclaimed (filesystem state)"
else
  bad "arm1: legacy .claude/skills/rules-as-tests/ STILL present — reclaim did not fire"
fi

if [ -d "$F1/.claude/skills/getff" ]; then
  ok "arm1: modern .claude/skills/getff/ still present (not collateral damage)"
else
  bad "arm1: modern .claude/skills/getff/ MISSING — reclaim took the wrong dir"
fi

if [ -f "$F1/.claude/skills/getff/SKILL.md" ]; then
  ok "arm1: modern SKILL.md body intact"
else
  bad "arm1: modern SKILL.md MISSING — refresh clobbered the modern skill"
fi

# ── Arm 2 (pos): .override.md sibling → legacy kept (consumer opt-out) ─────────
F2="$SCRATCH/arm2"
seed_fixture "$F2"
mkdir -p "$F2/.claude/skills/rules-as-tests" "$F2/.claude/skills/getff"
echo "# legacy" > "$F2/.claude/skills/rules-as-tests/SKILL.md"
echo "# modern" > "$F2/.claude/skills/getff/SKILL.md"
touch "$F2/.claude/skills/rules-as-tests.override.md"

out2=$(run_refresh "$F2"); rc2=$(printf '%s\n' "$out2" | tail -1)
case "$rc2" in
  EXIT=0) ok "arm2: refresh exit 0 with override present" ;;
  *)      bad "arm2: refresh exit non-zero ($rc2); output: $out2" ;;
esac

if [ -d "$F2/.claude/skills/rules-as-tests" ] && [ -f "$F2/.claude/skills/rules-as-tests/SKILL.md" ]; then
  ok "arm2: legacy dir KEPT (.override.md honoured — Layer-3 consumer opt-out)"
else
  bad "arm2: legacy dir MISSING — .override.md guard bypassed"
fi

# ── Arm 3 (pos): no legacy dir present → no-op, no error, modern intact ────────
F3="$SCRATCH/arm3"
seed_fixture "$F3"
mkdir -p "$F3/.claude/skills/getff"
echo "# modern" > "$F3/.claude/skills/getff/SKILL.md"

out3=$(run_refresh "$F3"); rc3=$(printf '%s\n' "$out3" | tail -1)
case "$rc3" in
  EXIT=0) ok "arm3: refresh exit 0 when no legacy dir present (fresh-install path)"
           ;;
  *)      bad "arm3: refresh exit non-zero ($rc3) on a fresh-install-shaped tree; output: $out3"
           ;;
esac

if [ -d "$F3/.claude/skills/getff" ] && [ ! -d "$F3/.claude/skills/rules-as-tests" ]; then
  ok "arm3: modern present, legacy never created (no false reclaim)"
else
  bad "arm3: unexpected state — getff present=$([ -d "$F3/.claude/skills/getff" ] && echo y || echo n), legacy present=$([ -d "$F3/.claude/skills/rules-as-tests" ] && echo y || echo n)"
fi

# ── Arm 5 (T15 self-application, static): framework source ships no legacy dir ─
# The framework is the SUPPLIER of the reclaim code; its own source tree is the
# negative case (rename complete in-repo). Live refresh against the framework's
# own repo is deliberately NOT run — it would side-effect `.claude/skills/*` and
# measure supplier-side install behaviour we don't want to test here. The static
# check confirms the supplier tree is in the rename-complete state.
if [ ! -d "$REPO_ROOT/skills/rules-as-tests" ] && [ -d "$REPO_ROOT/skills/getff" ]; then
  ok "arm5 (T15 self-app, static): framework source ships no legacy skill — reclaim is supplier-side no-op"
else
  bad "arm5 (T15 self-app, static): framework source tree unexpected — legacy=$([ -d "$REPO_ROOT/skills/rules-as-tests" ] && echo present || echo absent), modern=$([ -d "$REPO_ROOT/skills/getff" ] && echo present || echo absent)"
fi

# ── Arm 6 (teeth / non-vacuity): reclaim code path is actually present ─────────
# Prove arm1's "legacy reclaimed" assertion is a real discriminator by checking
# that install.sh actually contains the reclaim code (an upstream revert would
# silently flip this to vacuous green). Direct grep for the load-bearing symbols.
if grep -q 'Skill-rename orphan reclaim' "$INSTALL" \
   && grep -q 'reclaimed superseded framework skill dir' "$INSTALL" \
   && grep -q '_LEGACY_SKILL_DIR}.override.md' "$INSTALL"; then
  ok "arm6 (teeth): install.sh carries the reclaim code (arm1/2 assertions non-vacuous)"
else
  bad "arm6 (teeth): install.sh MISSING the reclaim code — arm1/arm2 would be vacuously green"
fi

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
