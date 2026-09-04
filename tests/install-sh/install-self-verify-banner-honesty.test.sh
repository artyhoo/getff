#!/usr/bin/env bash
# install-self-verify-banner-honesty.test.sh — P0.4: the --full install self-verify capstone
# banner (setup.d/99-finalize.sh) must not claim untested properties.
#
# OBSERVED live on a pnpm monorepo: the banner printed "3/3 checks passed — fences fire, shields
# active, generated tests non-vacuous" while gates had internally SKIPped everything. Two distinct
# leaks, one paired-negative arm each:
#   (ii)  RED-arm — when self-verify gate scripts are ABSENT (SKIP>0, FAIL=0) the banner must NOT
#         print the "fences fire, shields active" success line and MUST surface skip accounting.
#         Pre-fix it printed "✓ self-verify: 0/3 checks passed — fences fire, shields active …".
#   (iii) POSITIVE non-vacuity — when all three gates PASS the success line IS printed (guards
#         against an always-neutral banner that would satisfy (ii) vacuously).
#   (iv)  RED-arm — DEPS_INSTALLED=1 → the D1 fences-fire invocation carries FENCES_FIRE_STRICT=1
#         (deps landed in THIS run → a dep-missing SKIP now is a real delivery gap, GH #932).
#         Pre-fix the invocation left the env untouched, so a degrade-mode SKIP read as a pass.
#   (v)   POSITIVE pair — DEPS_INSTALLED unset → no FENCES_FIRE_STRICT forced (gate default applies).
#
# The capstone is sourced by the install.sh dispatcher (not a standalone script), so this test
# sources 99-finalize.sh with the surrounding dispatcher vars/functions stubbed and synthetic
# PROJECT_ROOT/PKG_ROOT trees. SKIP when node is unavailable (the file's early blocks probe it).
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FINALIZE="$REPO_ROOT/setup.d/99-finalize.sh"

PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "✗ $1"; }

if ! command -v node >/dev/null 2>&1; then
  echo "· node not available — SKIP (99-finalize's early blocks probe node)"
  echo ""; echo "PASS=$PASS FAIL=$FAIL"; exit 0
fi

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# Driver: define the dispatcher-scope vars/functions 99-finalize.sh expects, then source it.
# Runs in a fresh bash (no set -u) so empty SKIPPED/array handling matches the real dispatcher's
# populated state; PROJECT_ROOT / PKG_ROOT / DEPS_INSTALLED / FINALIZE arrive via the environment.
DRIVER="$WORK/driver.sh"
cat > "$DRIVER" << 'EOF'
set -o pipefail
FULL=1; DRY_RUN=""; STACK="ts-server"
SKIPPED=(); DEVDEPS=(placeholder-dev); RUNTIME_DEPS=(placeholder-rt)
_detect_stacks_per_workspace() { :; }
ignore_shipped_configs() { :; }
detect_pm() { echo npm; }
warn_preset_staleness() { :; }
source "$FINALIZE"
EOF

# run_capstone <proj> <pkg> <deps_installed('' | 1)> → echoes capstone+done output (stdout+stderr)
run_capstone() {
  local proj="$1" pkg="$2" deps="$3"
  if [ -n "$deps" ]; then
    PROJECT_ROOT="$proj" PKG_ROOT="$pkg" FINALIZE="$FINALIZE" DEPS_INSTALLED="$deps" \
      bash "$DRIVER" 2>&1
  else
    PROJECT_ROOT="$proj" PKG_ROOT="$pkg" FINALIZE="$FINALIZE" \
      bash "$DRIVER" 2>&1
  fi
}

# ─── Arm (ii): RED — all 3 gate scripts absent → SKIP>0, FAIL=0 ────────────────
PROJ_ABSENT="$WORK/proj-absent"; mkdir -p "$PROJ_ABSENT"
PKG_ABSENT="$WORK/pkg-absent";  mkdir -p "$PKG_ABSENT"
OUT_II=$(run_capstone "$PROJ_ABSENT" "$PKG_ABSENT" "")

# Match the success-VERDICT-line signature ('checks passed — fences fire') rather than the full
# old wording, so the arm covers both the retired 'shields active' and the current 'shields
# wired (form check)' phrasings while NOT matching the unconditional intent header line
# ('probing — do fences fire…'), which is an announcement, not a verdict (P0.4b follow-up).
if echo "$OUT_II" | grep -q 'checks passed — fences fire'; then
  bad "(ii) RED: banner claims the success property line while all 3 gates were SKIPPED (PASS=0)"
else
  ok "(ii) banner withholds the property claim when gates are skipped"
fi
if echo "$OUT_II" | grep -qE 'self-verify:.*skipped'; then
  ok "(ii) self-verify banner surfaces skip accounting"
else
  bad "(ii) self-verify banner omits skip accounting (SKIP=3 reads as clean)"
fi

# ─── Arm (iii): POSITIVE non-vacuity — all 3 gates pass → success line printed ──
PROJ_OK="$WORK/proj-ok"; mkdir -p "$PROJ_OK/scripts"
cat > "$PROJ_OK/scripts/check-fences-fire.sh" << 'S'
#!/usr/bin/env bash
exit 0
S
cp "$PROJ_OK/scripts/check-fences-fire.sh" "$PROJ_OK/scripts/check-shields-up.sh"
chmod +x "$PROJ_OK/scripts/check-fences-fire.sh" "$PROJ_OK/scripts/check-shields-up.sh"
PKG_OK="$WORK/pkg-ok"; mkdir -p "$PKG_OK/packages/core/audit-self"
cat > "$PKG_OK/packages/core/audit-self/check-generated-rule-mutation.sh" << 'S'
#!/usr/bin/env bash
exit 0
S
chmod +x "$PKG_OK/packages/core/audit-self/check-generated-rule-mutation.sh"
OUT_III=$(run_capstone "$PROJ_OK" "$PKG_OK" "1")
if echo "$OUT_III" | grep -q 'fences fire, shields wired (form check)'; then
  ok "(iii) POSITIVE: banner prints the success property line when all 3 gates pass (non-vacuous)"
else
  bad "(iii) POSITIVE: banner withheld the success line even though all 3 gates passed"
fi
# Paired-negative for the P0.4b capstone fix: the success line must NOT upgrade the form-only
# D2 (check-shields-up) pass into a behavioural 'shields active' claim.
if echo "$OUT_III" | grep -q 'shields active'; then
  bad "(iii-b) capstone success line still makes the behavioural 'shields active' claim from a form-only check"
else
  ok "(iii-b) capstone success line is form-scoped ('wired (form check)'), no behavioural overclaim"
fi

# ─── Arms (iv)/(v): D1 strict env keyed on DEPS_INSTALLED ──────────────────────
FF_ENV="$WORK/ff-env.txt"
PROJ_ENV="$WORK/proj-env"; mkdir -p "$PROJ_ENV/scripts"
# Stub captures whether FENCES_FIRE_STRICT reached it. $FF_ENV expands now (test path);
# ${FENCES_FIRE_STRICT} is escaped so it evaluates at stub runtime.
cat > "$PROJ_ENV/scripts/check-fences-fire.sh" << S
#!/usr/bin/env bash
echo "STRICT=\${FENCES_FIRE_STRICT:-unset}" > "$FF_ENV"
exit 0
S
chmod +x "$PROJ_ENV/scripts/check-fences-fire.sh"
PKG_ENV="$WORK/pkg-env"; mkdir -p "$PKG_ENV"

: > "$FF_ENV"
run_capstone "$PROJ_ENV" "$PKG_ENV" "1" >/dev/null
if grep -q 'STRICT=1' "$FF_ENV"; then
  ok "(iv) D1 fences-fire carries FENCES_FIRE_STRICT=1 when DEPS_INSTALLED=1"
else
  bad "(iv) D1 fences-fire did NOT set FENCES_FIRE_STRICT under DEPS_INSTALLED=1 (got: $(cat "$FF_ENV"))"
fi

: > "$FF_ENV"
run_capstone "$PROJ_ENV" "$PKG_ENV" "" >/dev/null
if grep -q 'STRICT=unset' "$FF_ENV"; then
  ok "(v) D1 fences-fire leaves FENCES_FIRE_STRICT unset when DEPS_INSTALLED is not set"
else
  bad "(v) D1 forced FENCES_FIRE_STRICT even without DEPS_INSTALLED (got: $(cat "$FF_ENV"))"
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
