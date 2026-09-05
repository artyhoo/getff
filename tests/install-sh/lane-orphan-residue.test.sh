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
#   (5) POLYGLOT paired-negative (ledger A2-6, RED pre-fix) — two lanes installed in ONE tree. The
#       three scan locations are lane-AGNOSTIC, so matching them against the ACTIVE lane's expected
#       set alone made `install.sh go --refresh` on a python+go repo print four
#       '⚠ ORPHAN … review and remove it manually' lines for the LIVE python enforcement
#       (ruff.toml, sgconfig.yml, .getff/ruff-bans.toml, .github/workflows/getff-python.yml) — a
#       consumer, or an AI agent acting on the log, deletes it. Both directions are pinned, plus the
#       discriminator: a header-marked file belonging to NO installed lane is STILL reported, so the
#       union suppresses false positives without blinding the report.
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
# A POLYGLOT consumer: a repo that legitimately carries two lanes side by side (a python service
# and a go service in one tree). Both lanes are installed for real — the whole point of arm (5) is
# that the second lane's --refresh must not name the first lane's live configs stale.
polyglot_py_go_fixture() {
  local d; d=$(mktemp -d)
  printf '[project]\nname = "poly"\nversion = "1.0.0"\n' > "$d/pyproject.toml"
  printf 'module example.com/poly\n\ngo 1.22\n' > "$d/go.mod"
  ( cd "$d" && git init -q && git config user.email t@t.co && git config user.name t ) >/dev/null 2>&1
  ( cd "$d" && bash "$INSTALL" python < /dev/null ) >/dev/null 2>&1
  ( cd "$d" && bash "$INSTALL" go     < /dev/null ) >/dev/null 2>&1
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
  # The REAL mechanism, called exactly as the python lane calls it (setup.d/45-python.sh):
  # `framework-exclusive`, because .getff/astgrep-rules is a scan dir nothing but the framework
  # owns. Since ledger L-4 the 2-arg form keeps files it cannot attribute to a delivery — right
  # for shared payloads, wrong for a dir whose stale contents are live scan configuration — so
  # dropping the flag here would test a call the lane does not make.
  refresh_safe "$SRC/rules" "$DST/rules" framework-exclusive   # dir replace → orphan gone
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

# ── (5) polyglot paired-negative (ledger A2-6): one lane's refresh must not orphan the other's ────
# @arm:C4:neg no-orphan-residue (RED pre-fix: four ORPHAN lines for LIVE python enforcement)
echo "  ── (5) polyglot python+go tree: refreshing one lane never flags the other lane's LIVE files ──"
G=$(polyglot_py_go_fixture)
# Fixture precondition: BOTH lanes really delivered (otherwise the arm proves nothing by vacancy).
py_live=0
for f in ruff.toml sgconfig.yml .getff/ruff-bans.toml .github/workflows/getff-python.yml; do
  [ -f "$G/$f" ] && grep -q 'generated by getff' "$G/$f" 2>/dev/null && py_live=$((py_live+1))
done
[ "$py_live" -eq 4 ] \
  && ok "(5) fixture: all 4 python-lane getff-owned files live in the polyglot tree" \
  || bad "(5) fixture: expected 4 live python-lane files, found $py_live — arm would pass vacuously"
[ -f "$G/.golangci.yml" ] && grep -q 'generated by getff' "$G/.golangci.yml" 2>/dev/null \
  && ok "(5) fixture: go-lane .golangci.yml live in the same tree" \
  || bad "(5) fixture: go lane did not deliver — the polyglot precondition is not met"

# Direction 1 — go --refresh must not name the python lane's live files orphans (the ledger repro).
out=$( cd "$G" && bash "$INSTALL" go --refresh < /dev/null 2>&1 ) || true
echo "$out" | grep -q "ORPHAN:" \
  && bad "(5-go) go --refresh flagged the LIVE python enforcement as stale (A2-6): $(echo "$out" | grep 'ORPHAN:' | tr '\n' '|')" \
  || ok "(5-go) go --refresh reported ZERO orphans — the other lane's live configs are not named stale"
for f in ruff.toml sgconfig.yml .getff/ruff-bans.toml .github/workflows/getff-python.yml; do
  [ -f "$G/$f" ] || bad "(5-go) python-lane $f disappeared during a go refresh"
done

# Direction 2 — the symmetric case: python --refresh must not orphan the go lane's live files.
out=$( cd "$G" && bash "$INSTALL" python --refresh < /dev/null 2>&1 ) || true
echo "$out" | grep -q "ORPHAN:" \
  && bad "(5-py) python --refresh flagged the LIVE go enforcement as stale: $(echo "$out" | grep 'ORPHAN:' | tr '\n' '|')" \
  || ok "(5-py) python --refresh reported ZERO orphans — symmetric with (5-go)"

# Discriminator — the union must not BLIND the report: a header-marked file that belongs to NO
# installed lane is still a true orphan and is still named, on the very same polyglot tree.
printf '# generated by getff python backend v0 — do not edit by hand\n[legacy]\nban = "old"\n' > "$G/getff-legacy-bans.toml"
out=$( cd "$G" && bash "$INSTALL" go --refresh < /dev/null 2>&1 ) || true
echo "$out" | grep -q "ORPHAN: getff-legacy-bans.toml" \
  && ok "(5-true) a file belonging to NO lane is STILL reported on the polyglot tree (union suppresses false positives, not the report)" \
  || bad "(5-true) the lane union swallowed a TRUE orphan — the C4 report is now blind: $(echo "$out" | tail -3 | tr '\n' '|')"
echo "$out" | grep 'ORPHAN:' | grep -qv 'getff-legacy-bans.toml' \
  && bad "(5-true) extra ORPHAN lines beyond the planted one: $(echo "$out" | grep 'ORPHAN:' | tr '\n' '|')" \
  || ok "(5-true) the planted file is the ONLY orphan reported (no collateral false positives)"
rm -rf "$G"

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
