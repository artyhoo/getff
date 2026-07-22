#!/usr/bin/env bash
# tests/install-sh/lane-orphan-residue.test.sh — adapter-jig C4 (no-orphan-residue).
#
# Refreshing a lane must leave no SILENTLY-active orphaned delivered artefacts: a file delivered by
# a PRIOR framework version that the current version no longer delivers is swept (directory
# payloads) or LOUDLY reported (individually-delivered top-level files), never silently left active
# (spec §3.3 C4; terraform-plugin-testing post-run residue sweep, §6 ADAPT).
#
# Two delivery shapes, two mechanisms:
#   IN-DIR payloads (.getff/astgrep-rules) — swept WHOLESALE by refresh_safe (rm -rf + re-copy,
#     setup.d/lib.sh #873 branch): a rule the current template no longer ships vanishes on --refresh.
#   TOP-LEVEL individually-delivered files (clippy.toml/deny.toml/ruff.toml/getff-*.yml/…) — per-file
#     refresh can never sweep a DROPPED file; the lanes call report_getff_orphans (setup.d/lib.sh) on
#     the refresh pass to LOUDLY report getff-header-marked files outside the current delivered set
#     (report-only per J2 decisions log #8 — deleting consumer-tree files is the irreversible branch).
#     Same root-cause class as the #882 npm barrel prune (refresh-different-stack-prunes-barrel), on
#     the python/cargo lanes that test never reaches.
#
# Arms:
#   (1) pos — planted in-dir orphan rule GONE after `install.sh python --refresh` (dir sweep proven).
#   (2) neg discriminator — copy_safe (skip-if-exists) on the same dir leaves the orphan ALIVE:
#       proves arm (1) discriminates the refresh_safe sweep (a copy-only regression would go RED).
#   (3) neg (the honest gap, RED pre-fix) — a stale getff-header-marked TOP-LEVEL file that the
#       current template set does not deliver MUST be loudly reported on --refresh (python + cargo).
#   (4) false-positive control — a clean refresh (nothing stale) reports NO orphan (the report is
#       discriminating, not noise); a consumer-authored file WITHOUT the getff header is never
#       flagged (not ours to name).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL="$REPO_ROOT/install.sh"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

py_fixture() {
  local d; d=$(mktemp -d)
  printf '[project]\nname = "orphan-consumer"\nversion = "1.0.0"\n' > "$d/pyproject.toml"
  ( cd "$d" && git init -q && git config user.email t@t.co && git config user.name t ) >/dev/null 2>&1
  echo "$d"
}
cargo_fixture() {
  local d; d=$(mktemp -d)
  printf '[package]\nname = "demo"\nversion = "0.0.1"\nedition = "2021"\n\n[dependencies]\n' > "$d/Cargo.toml"
  ( cd "$d" && git init -q && git config user.email t@t.co && git config user.name t ) >/dev/null 2>&1
  echo "$d"
}

echo "▶ Lane orphan residue (adapter-jig C4) — refresh sweeps dir payloads, loudly reports top-level orphans"
echo ""

# ── (1) positive: in-dir orphan rule is SWEPT by --refresh (refresh_safe rm-rf dir payload) ────────
# @arm:C4:pos no-orphan-residue (dropped in-dir rule vanishes on refresh; delivered set intact)
echo "  ── (1) in-dir orphan (.getff/astgrep-rules) swept on --refresh ──"
P=$(py_fixture)
( cd "$P" && bash "$INSTALL" python < /dev/null ) >/dev/null 2>&1
printf 'id: getff-stale-rule\nlanguage: python\nrule:\n  pattern: eval($X)\n' > "$P/.getff/astgrep-rules/getff-stale-rule.yml"
[ -f "$P/.getff/astgrep-rules/getff-stale-rule.yml" ] || bad "(1) fixture: could not plant the orphan rule"
( cd "$P" && bash "$INSTALL" python --refresh < /dev/null ) >/dev/null 2>&1
[ ! -e "$P/.getff/astgrep-rules/getff-stale-rule.yml" ] \
  && ok "(1) planted orphan rule GONE after --refresh (refresh_safe dir sweep, lib.sh #873 branch)" \
  || bad "(1) orphan rule SURVIVED --refresh — a dropped rule stays silently active (C4 violation)"
[ -f "$P/.getff/astgrep-rules/getff-no-eval.yml" ] \
  && ok "(1) current delivered rule set intact after the sweep (sweep replaces, not deletes-only)" \
  || bad "(1) delivered rule set damaged by the sweep"
rm -rf "$P"

# ── (2) negative discriminator: copy_safe (skip-if-exists) leaves the in-dir orphan ALIVE ──────────
# @arm:C4:neg no-orphan-residue (copy-only delivery → orphan survives → arm (1) discriminates)
echo "  ── (2) copy_safe instead of refresh_safe → orphan survives (arm-1 discriminator) ──"
SRC=$(mktemp -d); DST=$(mktemp -d)
mkdir -p "$SRC/rules" "$DST/rules"
printf 'current\n' > "$SRC/rules/current.yml"
printf 'orphan\n' > "$DST/rules/getff-stale-rule.yml"
out=$(
  export INSTALL_SH_LIB_ONLY=1
  PKG_ROOT="$REPO_ROOT"; PROJECT_ROOT="$DST"; FORCE=""; DRY_RUN=""; SKIPPED=()
  # shellcheck source=/dev/null
  source "$REPO_ROOT/setup.d/lib.sh"
  refresh_safe "$SRC/rules" "$DST/rules"          # the REAL mechanism: dir replace → orphan gone
  [ -e "$DST/rules/getff-stale-rule.yml" ] && echo "REFRESH_LEFT_ORPHAN"
  printf 'orphan\n' > "$DST/rules/getff-stale-rule.yml"   # re-plant, then the violating shape:
  copy_safe "$SRC/rules" "$DST/rules"             # skip-if-exists → whole dir skipped → orphan alive
  [ -e "$DST/rules/getff-stale-rule.yml" ] && echo "COPYSAFE_LEFT_ORPHAN"
)
echo "$out" | grep -q "REFRESH_LEFT_ORPHAN" \
  && bad "(2) refresh_safe left the in-dir orphan — the sweep mechanism itself is broken" \
  || ok "(2) refresh_safe swept the in-dir orphan (mechanism confirmed at the lib.sh seam)"
echo "$out" | grep -q "COPYSAFE_LEFT_ORPHAN" \
  && ok "(2) copy_safe left the orphan ALIVE — a copy-only delivery regression is exactly what arm (1) would catch RED" \
  || bad "(2) copy_safe unexpectedly swept the orphan — discriminator fixture is broken"
rm -rf "$SRC" "$DST"

# ── (3) the honest gap (RED pre-fix): stale getff-owned TOP-LEVEL files must be LOUDLY reported ────
# @arm:C4:neg no-orphan-residue (pre-fix reproduction: silent survival; post-fix: loud ORPHAN report)
echo "  ── (3) stale getff-owned top-level file → loud ORPHAN report on --refresh (python + cargo) ──"
P=$(py_fixture)
( cd "$P" && bash "$INSTALL" python < /dev/null ) >/dev/null 2>&1
# A file a PRIOR getff version delivered (header-marked) that the current template set does not ship:
printf '# generated by getff python backend v0 — do not edit by hand\n[legacy]\nban = "old"\n' > "$P/getff-legacy-bans.toml"
out=$( cd "$P" && bash "$INSTALL" python --refresh < /dev/null 2>&1 ) || true
[ -e "$P/getff-legacy-bans.toml" ] \
  && ok "(3-py) stale file still present (report-only contract — getff never deletes consumer-tree files)" \
  || bad "(3-py) stale file was DELETED — report-only contract violated (J2 decisions log #8)"
echo "$out" | grep -q "ORPHAN: getff-legacy-bans.toml" \
  && ok "(3-py) --refresh LOUDLY reported the getff-owned orphan (was silent pre-fix — the C4 gap)" \
  || bad "(3-py) NO orphan report for a stale getff-owned top-level file — it stays silently active (C4 violation): $(echo "$out" | tail -3 | tr '\n' '|')"
rm -rf "$P"
C=$(cargo_fixture)
( cd "$C" && bash "$INSTALL" cargo < /dev/null ) >/dev/null 2>&1
printf '# generated by getff cargo backend v0 — do not edit by hand\n[legacy]\n' > "$C/getff-old-clippy.toml"
out=$( cd "$C" && bash "$INSTALL" cargo --refresh < /dev/null 2>&1 ) || true
echo "$out" | grep -q "ORPHAN: getff-old-clippy.toml" \
  && ok "(3-cargo) cargo --refresh LOUDLY reported the getff-owned orphan (parity with the python lane)" \
  || bad "(3-cargo) NO orphan report on the cargo lane: $(echo "$out" | tail -3 | tr '\n' '|')"
rm -rf "$C"

# ── (4) false-positive controls: clean refresh silent; headerless consumer files never flagged ─────
echo "  ── (4) discriminating, not noise: clean refresh + consumer-authored file → NO orphan report ──"
P=$(py_fixture)
( cd "$P" && bash "$INSTALL" python < /dev/null ) >/dev/null 2>&1
printf '[my]\nown = "config"\n' > "$P/mytool.toml"      # consumer-authored, NO getff header
out=$( cd "$P" && bash "$INSTALL" python --refresh < /dev/null 2>&1 ) || true
echo "$out" | grep -q "ORPHAN:" \
  && bad "(4) orphan report fired on a CLEAN refresh (false-positive noise): $(echo "$out" | grep 'ORPHAN:' | tr '\n' '|')" \
  || ok "(4) clean refresh (delivered set current + consumer file headerless) → zero orphan reports"
[ -e "$P/mytool.toml" ] \
  && ok "(4) consumer-authored mytool.toml untouched (never ours to name or touch)" \
  || bad "(4) consumer-authored file disappeared"
rm -rf "$P"

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
