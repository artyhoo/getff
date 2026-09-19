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
#     NOTE (ledger L-4, post-dating arms 1-5): that sentence now holds only for a payload declared
#     `framework-exclusive` — which .getff/astgrep-rules is, so arms 1-2 stand unchanged. A SHARED
#     payload (scripts/fences-fire-fixtures) keeps every file it cannot attribute; arm (6) covers it.
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
#   (6) INSIDE a shared directory payload (ledger L-4b/L-4c, RED pre-fix) — the three scan globs of
#       report_getff_orphans are all `-maxdepth 1` and it runs only on the toolchain lanes, so
#       nothing looked inside scripts/fences-fire-fixtures — an npm/ts-lane payload. A file there
#       with no refresh-baseline entry is unattributable, is KEPT by the L-4 sweep, and pre-fix the
#       whole set collapsed into one anonymous count line that additionally mislabelled it
#       "consumer-owned". Measured cost: a stale `*.manifest.json` planted that way survives every
#       --refresh, and check-fences-fire.sh then enumerates it, counts it in the non-vacuity
#       denominator and probes it — `probing 3 fence(s)` / `manifests=3` / rc=1 on a two-fixture
#       corpus. Live configuration, not inert residue. Post-fix each kept file is NAMED with the
#       same `ORPHAN:` token arms 3-5 grep for, and still not deleted (report-only).
#   (7) C4-ATTN-3 collateral control — a cargo+python polyglot tree, both lanes refreshed: the new
#       in-payload scan must add ZERO orphan lines where nothing is stale. Arm (5) pins the same
#       property for python+go on the top-level scan; this pins it for the second lane pair and for
#       the surface arm (6) introduced.
#   (8) RETIRED directory payload (ledger L-4d, RED pre-fix) — the framework STOPPED shipping a
#       whole directory: refresh_safe's source-gone early-exit returns before _refresh_dir_payload
#       can run, so the consumer's copy is neither refreshed nor walked nor named. A version-N
#       consumer of a payload dropped in version N+1 gets ZERO signal that the directory is now
#       theirs alone. Post-fix the early-exit names the directory once (⊝ vocabulary — NOT the
#       ORPHAN: token, which arms 4/5/7 grep to zero on clean trees), report-only, byte-identical
#       under --dry-run, and the «leave consumer copy alone» behaviour is unchanged.
#   (9) .getff/rules-research/ (ledger L-4e, RED pre-fix) — the consumer-owned durable home for
#       researched rules is never a refresh_safe destination (so _report_dir_residue cannot see
#       it) and report_getff_orphans' three globs are all -maxdepth 1 (so they never descend into
#       it): a stale *.yml there is re-joined into the live scan dir on EVERY pass and no refresh
#       output ever mentions the directory. Post-fix the orphan scan names it once as
#       consumer-owned storage (⊝ line, NOT the ORPHAN: token — arms 4/5/7) when it exists, and
#       stays silent when it does not. Per-rule staleness is deliberately NOT judged here — the
#       join in setup.d/45-python.sh owns that decision; this line only makes the reader aware
#       the directory exists, is theirs, and is never swept.
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
# An npm/ts consumer — the only lane that receives scripts/fences-fire-fixtures, the cheapest live
# specimen of a SHARED (non-`framework-exclusive`) directory payload. Same shape as the
# make_consumer helper in refresh-dir-payload-ownership.test.sh, which pins the sibling L-4 contract.
ts_fixture() {
  local d; d=$(mktemp -d)
  printf '{ "name":"consumer","version":"0.0.0" }\n' > "$d/package.json"
  ( cd "$d" && git init -q && bash "$INSTALL" ts-server < /dev/null ) >/dev/null 2>&1
  echo "$d"
}
# A polyglot consumer carrying the OTHER lane pair from arm (5): a python service and a rust crate.
polyglot_py_cargo_fixture() {
  local d; d=$(mktemp -d)
  printf '[project]\nname = "poly"\nversion = "1.0.0"\n' > "$d/pyproject.toml"
  printf '[package]\nname = "demo"\nversion = "0.0.1"\nedition = "2021"\n\n[dependencies]\n' > "$d/Cargo.toml"
  ( cd "$d" && git init -q && git config user.email t@t.co && git config user.name t ) >/dev/null 2>&1
  ( cd "$d" && bash "$INSTALL" python < /dev/null ) >/dev/null 2>&1
  ( cd "$d" && bash "$INSTALL" cargo  < /dev/null ) >/dev/null 2>&1
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

# ── (6) inside a SHARED directory payload (ledger L-4b/L-4c) ───────────────────────────────────────
# @arm:C4:neg no-orphan-residue (pre-fix: kept-but-anonymous inside a payload; post-fix: named)
echo "  ── (6) unattributable file INSIDE scripts/fences-fire-fixtures → named ORPHAN on --refresh ──"
D6="scripts/fences-fire-fixtures"
S=$(ts_fixture)
if [ ! -d "$S/$D6" ]; then
  bad "(6) precondition: ts install did not deliver the $D6 directory payload"
else
  ok "(6) precondition: ts install delivered the $D6 directory payload"
  # Paired negative FIRST, on the very same tree: a clean refresh must name nothing. Run before the
  # plant so it cannot pass by the payload being absent or the refresh never reaching it.
  out=$( cd "$S" && bash "$INSTALL" --refresh < /dev/null 2>&1 ) || true
  echo "$out" | grep -q "ORPHAN:" \
    && bad "(6-neg) clean ts refresh emitted ORPHAN lines (false-positive noise from the new in-payload scan): $(echo "$out" | grep 'ORPHAN:' | tr '\n' '|')" \
    || ok "(6-neg) clean ts refresh → ZERO ORPHAN lines (the in-payload scan is discriminating, not noise)"
  echo "$out" | grep -qF "$D6" \
    && ok "(6-neg) the clean run did reach the payload (the zero above is a verdict, not vacancy)" \
    || bad "(6-neg) no $D6 activity in the refresh output — arm (6-neg) is vacuous"

  # A triple a PRIOR getff version delivered before this consumer's baseline existed: present in the
  # payload, absent from the current template set, and carrying NO baseline entry — the exact state
  # _refresh_dir_payload keeps and, pre-fix, never named.
  printf '{ "rule-id": "local/getff-legacy-fence" }\n' > "$S/$D6/getff-legacy-fence.manifest.json"
  printf 'export const bad = 1;\n'  > "$S/$D6/getff-legacy-fence.bad.ts"
  printf 'export const good = 1;\n' > "$S/$D6/getff-legacy-fence.good.ts"
  out=$( cd "$S" && bash "$INSTALL" --refresh < /dev/null 2>&1 ) || true
  named=0
  for _s in manifest.json bad.ts good.ts; do
    echo "$out" | grep "ORPHAN:" | grep -qF "getff-legacy-fence.$_s" && named=$((named+1))
  done
  [ "$named" -eq 3 ] \
    && ok "(6) all 3 unattributable files inside the payload are NAMED as orphans (pre-fix: one anonymous count line, mislabelled consumer-owned)" \
    || bad "(6) only $named/3 in-payload orphans named — a stale file survives unnamed (C4 violation): $(echo "$out" | grep 'ORPHAN:' | tr '\n' '|')"
  survived=0
  for _s in manifest.json bad.ts good.ts; do
    [ -f "$S/$D6/getff-legacy-fence.$_s" ] && survived=$((survived+1))
  done
  [ "$survived" -eq 3 ] \
    && ok "(6) all 3 files still present — report-only contract holds inside a payload too (J2 decisions log #8)" \
    || bad "(6) the report DELETED $((3-survived)) in-payload file(s) it could not attribute — the irreversible branch (issue 1481 class)"
  echo "$out" | grep 'ORPHAN:' | grep -qv 'getff-legacy-fence' \
    && bad "(6) extra ORPHAN lines beyond the planted triple: $(echo "$out" | grep 'ORPHAN:' | grep -v 'getff-legacy-fence' | tr '\n' '|')" \
    || ok "(6) the planted triple is the ONLY thing reported (no collateral inside the payload)"
fi
rm -rf "$S"

# ── (7) C4-ATTN-3: cargo+python polyglot control — the new scan adds no collateral orphans ─────────
# @arm:C4:neg no-orphan-residue (collateral control for the second lane pair)
echo "  ── (7) polyglot python+cargo tree: both lanes refresh with ZERO orphan lines ──"
K=$(polyglot_py_cargo_fixture)
py_live=0
for f in ruff.toml sgconfig.yml .getff/ruff-bans.toml .github/workflows/getff-python.yml; do
  [ -f "$K/$f" ] && grep -q 'generated by getff' "$K/$f" 2>/dev/null && py_live=$((py_live+1))
done
[ "$py_live" -eq 4 ] \
  && ok "(7) fixture: all 4 python-lane getff-owned files live in the python+cargo tree" \
  || bad "(7) fixture: expected 4 live python-lane files, found $py_live — arm would pass vacuously"
[ -f "$K/clippy.toml" ] && grep -q 'generated by getff' "$K/clippy.toml" 2>/dev/null \
  && ok "(7) fixture: cargo-lane clippy.toml live in the same tree" \
  || bad "(7) fixture: cargo lane did not deliver — the polyglot precondition is not met"
for _lane in cargo python; do
  out=$( cd "$K" && bash "$INSTALL" "$_lane" --refresh < /dev/null 2>&1 ) || true
  echo "$out" | grep -q "ORPHAN:" \
    && bad "(7-$_lane) $_lane --refresh emitted ORPHAN lines on a clean polyglot tree: $(echo "$out" | grep 'ORPHAN:' | tr '\n' '|')" \
    || ok "(7-$_lane) $_lane --refresh reported ZERO orphans (no collateral from the in-payload scan)"
done
rm -rf "$K"

# ── (8) RETIRED directory payload: the framework stopped shipping the whole dir (ledger L-4d) ──────
# @arm:C4:neg no-orphan-residue (pre-fix: source-gone early-exit is silent; post-fix: one naming line)
echo "  ── (8) retired directory payload (source dir gone) → named once, kept untouched ──"
S8=$(mktemp -d); D8=$(mktemp -d)
mkdir -p "$S8/rules"
printf 'shipped\n' > "$S8/rules/current.yml"
mkdir -p "$D8/rules"
printf 'version-N bytes\n' > "$D8/rules/current.yml"
printf 'consumer own\n' > "$D8/rules/mine.yml"
rm -rf "$S8"   # version N+1 stopped shipping the payload entirely — $src no longer exists
out=$(
  export INSTALL_SH_LIB_ONLY=1
  PKG_ROOT="$REPO_ROOT"; PROJECT_ROOT="$D8"; FORCE=""; DRY_RUN=""; SKIPPED=()
  # shellcheck source=/dev/null
  source "$REPO_ROOT/setup.d/lib.sh"
  # The 2-arg shared-ownership form, called exactly as install.sh's do_refresh calls the
  # fences-fire payload — the shape whose vanished source used to return 0 without a word.
  refresh_safe "$S8/rules" "$D8/rules"
)
[ -f "$D8/rules/current.yml" ] && [ "$(cat "$D8/rules/current.yml")" = "version-N bytes" ] \
  && ok "(8) consumer copy untouched (the change is naming, not touching — «leave consumer copy alone» holds)" \
  || bad "(8) the vanished-source early-exit mutated the consumer copy it was told to leave alone"
[ -f "$D8/rules/mine.yml" ] \
  && ok "(8) the consumer's own file inside the retired payload untouched" \
  || bad "(8) consumer file deleted from the retired payload (report-only contract violated)"
echo "$out" | grep -qF "retired payload" \
  && ok "(8) refresh NAMES the retired payload as consumer-owned (pre-fix: silent early-exit, the L-4d blind spot)" \
  || bad "(8) retired directory payload unnamed on refresh — no signal that the payload is now the consumer's alone: $(echo "$out" | tr '\n' '|')"
echo "$out" | grep -F "retired payload" | grep -qF "$D8/rules" \
  && ok "(8) the naming line identifies the retired directory itself" \
  || bad "(8) the naming line does not name the directory path"
echo "$out" | grep -F "retired payload" | grep -q "ORPHAN:" \
  && bad "(8) the retired-payload line borrowed the ORPHAN: token — clean-tree arms grep ORPHAN: to zero" \
  || ok "(8) the naming uses the ⊝ vocabulary, not the ORPHAN: token (vocabulary separation holds)"
# --dry-run twin: read-only naming must preview byte-identically, and still write nothing.
out_dry=$(
  export INSTALL_SH_LIB_ONLY=1
  PKG_ROOT="$REPO_ROOT"; PROJECT_ROOT="$D8"; FORCE=""; DRY_RUN="--dry-run"; SKIPPED=()
  # shellcheck source=/dev/null
  source "$REPO_ROOT/setup.d/lib.sh"
  refresh_safe "$S8/rules" "$D8/rules"
)
[ "$out" = "$out_dry" ] \
  && ok "(8) --dry-run prints the IDENTICAL naming line (preview agrees with the real run)" \
  || bad "(8) --dry-run output differs from the real run: [$(echo "$out_dry" | tr '\n' '|')]"
[ -f "$D8/rules/mine.yml" ] && [ "$(cat "$D8/rules/current.yml")" = "version-N bytes" ] \
  && ok "(8) dry-run wrote nothing inside the retired payload" \
  || bad "(8) dry-run mutated the retired payload"
rm -rf "$S8" "$D8"

# ── (9) .getff/rules-research/ — consumer-owned durable home, named when it exists (ledger L-4e) ───
# @arm:C4:neg no-orphan-residue (pre-fix: unseen by both guards; post-fix: one ⊝ line names it)
echo "  ── (9) .getff/rules-research/ named as consumer-owned storage when it exists ──"
P9=$(py_fixture)
( cd "$P9" && bash "$INSTALL" python < /dev/null ) >/dev/null 2>&1
# Paired negative FIRST, on the same fixture: the guard must be silent while the directory does
# not exist (a clean python consumer has none — only the session-side rule-bootstrap CLI creates
# it), so the post-fix line below is a real signal, not ambient noise.
out=$( cd "$P9" && bash "$INSTALL" python --refresh < /dev/null 2>&1 ) || true
echo "$out" | grep -qF "consumer-owned researched-rule storage" \
  && bad "(9-neg) the guard fired without .getff/rules-research/ existing (ambient noise): $(echo "$out" | grep -F 'consumer-owned researched-rule storage' | tr '\n' '|')" \
  || ok "(9-neg) no rules-research line on a consumer that never had the directory (discriminating, not noise)"
# Now the L-4e state: a stale researched rule (an id the barrel prune no longer recognises) plus
# its *.practice.json input record — exactly what an older rule-bootstrap CLI leaves behind.
RR9="$P9/.getff/rules-research"
mkdir -p "$RR9"
printf 'id: getff-researched-legacy\nlanguage: python\nrule:\n  pattern: eval($X)\n' > "$RR9/getff-researched-legacy.yml"
printf '{ "entryId": "getff-researched-legacy", "practice": "legacy" }\n' > "$RR9/getff-researched-legacy.practice.json"
out=$( cd "$P9" && bash "$INSTALL" python --refresh < /dev/null 2>&1 ) || true
echo "$out" | grep -cF "consumer-owned researched-rule storage" | grep -q '^1$' \
  && ok "(9) refresh names .getff/rules-research/ exactly once as consumer-owned storage (pre-fix: unseen by both guards)" \
  || bad "(9) .getff/rules-research/ not named (or named more than once): $(echo "$out" | grep -cF 'consumer-owned researched-rule storage') line(s)"
echo "$out" | grep -F "consumer-owned researched-rule storage" | grep -q "ORPHAN:" \
  && bad "(9) the rules-research line borrowed the ORPHAN: token — clean-tree arms grep ORPHAN: to zero" \
  || ok "(9) the naming uses the ⊝ vocabulary, not the ORPHAN: token (vocabulary separation holds)"
# The join still runs on the same pass — naming the directory must not disturb the mechanism
# that owns the per-rule judgment (kickoff: do NOT classify individual researched rules).
[ -f "$P9/.getff/astgrep-rules/getff-researched-legacy.yml" ] \
  && ok "(9) the stale researched rule STILL joined into the scan dir (the join owns that judgment, unchanged)" \
  || bad "(9) the researched join stopped working — the naming line broke _py_join_researched_rules"
[ -f "$RR9/getff-researched-legacy.yml" ] && [ -f "$RR9/getff-researched-legacy.practice.json" ] \
  && ok "(9) both planted files still present — report-only contract (nothing in .getff/rules-research/ is deleted)" \
  || bad "(9) a planted file in .getff/rules-research/ was deleted — the irreversible branch"
# --dry-run twin: the same guard line, and the directory untouched.
out_dry=$( cd "$P9" && bash "$INSTALL" python --refresh --dry-run < /dev/null 2>&1 ) || true
echo "$out_dry" | grep -cF "consumer-owned researched-rule storage" | grep -q '^1$' \
  && ok "(9) --dry-run prints the SAME guard line for the directory (preview agrees with the real run)" \
  || bad "(9) --dry-run guard line missing or duplicated: $(echo "$out_dry" | grep -cF 'consumer-owned researched-rule storage')"
[ -f "$RR9/getff-researched-legacy.yml" ] && [ -f "$RR9/getff-researched-legacy.practice.json" ] \
  && ok "(9) dry-run wrote nothing in .getff/rules-research/" \
  || bad "(9) dry-run mutated .getff/rules-research/"
rm -rf "$P9"

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
