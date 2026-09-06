#!/usr/bin/env bash
# tests/install-sh/python-rules-lock.test.sh — ecosystem-wiring W3: the PYTHON RULES-LOCK VARIANT.
#
# Gates the deterministic content of .getff/rules-lock.python.json emitted by install.sh's python lane
# (do_python_lane → setup.d/45-python.sh _py_write_rules_lock). The lock's ONE non-deterministic field
# (wall-clock emittedAt) is excluded from the byte-identical snapshot (tests/install-sh/snapshot.sh);
# this test is the targeted deterministic guard the snapshot exclusion points at
# (attention-is-not-a-mechanism §1 — a non-deterministic field is not left byte-unguarded, its
# deterministic siblings are asserted here).
#
# Drives the REAL install.sh in mktemp -d fixtures (subprocess, like python-entry-lane.test.sh) — the
# lock is written from install.sh's main flow, not from the pure deliver_python_toolchain config tree.
#
# DETERMINISTIC arms (always run — the CI signal): schema shape, ruleIds ↔ delivered files (non-vacuity),
# ruffBans, 16-hex fingerprint, reproducibility (same rule set → same fingerprint across consumers),
# idempotency (plain re-run byte-identical), --refresh regenerate, lock lives under .getff/ (D8:
# .ai-factory/ is now an expected agent-surface home, not a npm-leak signal — arm (2) asserts the
# lock's HOME is .getff/, not the now-obsolete .ai-factory absence), and the TEETH arm — a DIFFERENT
# delivered rule set (a live-generated researched rule rides the seam via PY_TEMPLATE_DIR) yields a
# DIFFERENT fingerprint + the extra ruleId (proves the lock reflects the actual delivered set, not a
# constant).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL="$REPO_ROOT/install.sh"
TPL="$REPO_ROOT/packages/core/templates/python"
RESEARCHED="$REPO_ROOT/packages/core/synthesizer/fixtures/live-generation/firing/rules/getff-researched-no-yaml-load.yml"
LOCK_REL=".getff/rules-lock.python.json"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip() { echo "  · $1"; }

[ -f "$INSTALL" ] || { echo "FATAL: $INSTALL not found"; exit 1; }
[ -d "$TPL" ]     || { echo "FATAL: python templates not found at $TPL"; exit 1; }

py_fixture() {  # echo a fresh temp dir seeded with a pyproject.toml (a pure Python consumer)
  local d; d=$(mktemp -d)
  printf '[project]\nname = "demo"\nversion = "0.0.1"\n' > "$d/pyproject.toml"
  echo "$d"
}

# Grep a top-level string/number field out of the lock (portable — no jq/python3 dependency).
lock_field() { grep -oE "\"$2\"[[:space:]]*:[[:space:]]*(\"[^\"]*\"|[0-9]+|null)" "$1" | head -1 | sed -E 's/.*:[[:space:]]*//; s/^"//; s/"$//'; }

echo "▶ Python rules-lock variant (.getff/rules-lock.python.json) — schema · non-vacuity · determinism"
echo ""

# ── (1) fresh install → the lock exists with the expected schema shape ─────────────────────────────
echo "  ── (1) fresh install.sh python → rules-lock.python.json shape ──"
P=$(py_fixture)
out=$( cd "$P" && bash "$INSTALL" python --force < /dev/null 2>&1 ); rc=$?
LOCK="$P/$LOCK_REL"
[ "$rc" -eq 0 ] || bad "(1) install exit $rc: $(echo "$out" | tail -3 | tr '\n' '|')"
[ -f "$LOCK" ] \
  && ok "(1) $LOCK_REL emitted on the python install path" \
  || bad "(1) $LOCK_REL NOT emitted (do_python_lane did not call _py_write_rules_lock)"
[ "$(lock_field "$LOCK" schemaVersion)" = "2" ]     && ok "(1) schemaVersion=2"        || bad "(1) schemaVersion != 2"
[ "$(lock_field "$LOCK" framework)" = "python" ]    && ok "(1) framework=python"        || bad "(1) framework != python"
# S1 §3 criterion 6 (re-stated per §3a — DERIVATION, not bare null):
# The gate branches on whether the generation context named a dependency.
# Manifest present with a version → lock version MUST match it.
# Manifest absent (no named dependency) → lock version MUST be null.
# This distinguishes «null because no dependency was named» from «null because nothing
# was ever read» (the W-2 tell). The r1 defect (consumer's own [project] version) is
# caught by the absent-manifest arm: a non-null value when no manifest exists = leak.
_ctx="$P/.ai-factory/synthesizer-output/generation-context.json"
_lock_ver=$(lock_field "$LOCK" version)
if [ -f "$_ctx" ]; then
  _ctx_ver=$(grep -oE '"version"[[:space:]]*:[[:space:]]*("[^"]*"|null)' "$_ctx" | head -1 | sed -E 's/.*:[[:space:]]*//; s/^"//; s/"$//')
  [ "$_lock_ver" = "$_ctx_ver" ] \
    && ok "(1) version matches generation-context manifest ($_lock_ver — S1 criterion 6 derivation)" \
    || bad "(1) version mismatch: lock=$_lock_ver ctx=$_ctx_ver (manifest present, value must match)"
else
  [ "$_lock_ver" = "null" ] \
    && ok "(1) version=null (no generation-context manifest → no named dependency — S1 criterion 6 derivation)" \
    || bad "(1) version=$_lock_ver but no manifest exists — leaked value not derived from read (W-1 tell)"
fi
grep -q '"rules"'  "$LOCK" && ok "(1) rules array present (v2 per-rule shape)"  || bad "(1) rules array missing"
grep -q '"ruffBans"' "$LOCK" && ok "(1) ruffBans array present" || bad "(1) ruffBans missing"

# ── (2) lock lives under .getff/ (the python TOOLCHAIN home; D8 split: agent-surface rides .ai-factory/) ─
echo ""; echo "  ── (2) lock rides the .getff/ namespace (.ai-factory/ is the agent-surface home post-D8) ──"
LOCK_DIR=$(dirname "$LOCK")
[ "$LOCK_DIR" = "$P/.getff" ] \
  && ok "(2) lock lives under .getff/ (the python toolchain home — lock + inputs co-located)" \
  || bad "(2) lock NOT under .getff/ (lock dir=$LOCK_DIR; the lock must live with its inputs)"

# ── (3) non-vacuity: rules ↔ the delivered ast-grep rule files; ruffBans = TID251/TID253 ──────────
echo ""; echo "  ── (3) rules match delivered files; ruffBans match delivered bans ──"
delivered_ids=$(grep -hE '^id:' "$P"/.getff/astgrep-rules/*.yml 2>/dev/null \
  | sed -E 's/^id:[[:space:]]*"?([^"]*)"?[[:space:]]*$/\1/' | sort -u)
n_delivered=$(printf '%s\n' "$delivered_ids" | grep -c .)
for id in $delivered_ids; do
  grep -q "\"$id\"" "$LOCK" || bad "(3) delivered rule '$id' MISSING from lock rules"
done
n_locked=$(grep -oE '"getff-[a-z0-9-]+"' "$LOCK" | sort -u | grep -c .)
[ "$n_delivered" -eq "$n_locked" ] \
  && ok "(3) all $n_delivered delivered ast-grep rule id(s) present in lock (non-vacuous)" \
  || bad "(3) count mismatch: delivered=$n_delivered locked=$n_locked"
grep -q '"TID251"' "$LOCK" && grep -q '"TID253"' "$LOCK" \
  && ok "(3) ruffBans list the delivered TID251/TID253 bans" \
  || bad "(3) ruffBans missing TID251/TID253"

# ── (4) sourceFingerprint is a 16-hex digest ───────────────────────────────────────────────────────
# @arm:D2:pos no-silent-fingerprint-degrade — hash tool present → authoritative digest, no degrade
echo ""; echo "  ── (4) sourceFingerprint shape ──"
fp1=$(lock_field "$LOCK" sourceFingerprint)
printf '%s' "$fp1" | grep -qE '^[0-9a-f]{16}$' \
  && ok "(4) sourceFingerprint is 16-hex ($fp1)" \
  || bad "(4) sourceFingerprint not 16-hex: '$fp1'"

# ── (5) reproducibility: a second fresh consumer with the SAME rule set → SAME fingerprint ─────────
echo ""; echo "  ── (5) reproducibility (same rules → same fingerprint) ──"
P2=$(py_fixture)
( cd "$P2" && bash "$INSTALL" python --force < /dev/null ) >/dev/null 2>&1
fp2=$(lock_field "$P2/$LOCK_REL" sourceFingerprint)
[ -n "$fp1" ] && [ "$fp1" = "$fp2" ] \
  && ok "(5) identical delivered rule set → identical sourceFingerprint" \
  || bad "(5) fingerprints diverge across identical installs: '$fp1' vs '$fp2'"

# ── (6) idempotency: a plain NO-FLAG re-run leaves the lock byte-identical (skip-if-present) ────────
# The idempotent skip fires ONLY on the plain no-flag re-run where copy_safe did NOT overwrite the
# delivered artefacts. --force / --refresh are OVERWRITE paths that DO regenerate (arms (7) + (9)) — so
# this arm must use a bare `install.sh python`, NOT --force (which now correctly regenerates the lock).
# @arm:D1:pos lock-never-stale-on-any-pass — true no-change re-run stays byte-stable (content-aware skip)
echo ""; echo "  ── (6) idempotent plain no-flag re-run (emittedAt stable) ──"
before=$(cat "$LOCK")
( cd "$P" && bash "$INSTALL" python < /dev/null ) >/dev/null 2>&1
[ "$before" = "$(cat "$LOCK")" ] \
  && ok "(6) plain no-flag re-run is idempotent — lock byte-identical (skip-if-present)" \
  || bad "(6) plain no-flag re-run changed the lock (not idempotent)"

# ── (7) --refresh regenerates the lock with the SAME fingerprint (rules unchanged) ─────────────────
echo ""; echo "  ── (7) --refresh regenerates (same rules → same fingerprint) ──"
( cd "$P" && bash "$INSTALL" python --refresh < /dev/null ) >/dev/null 2>&1
fp_refresh=$(lock_field "$LOCK" sourceFingerprint)
[ "$fp_refresh" = "$fp1" ] \
  && ok "(7) --refresh keeps the fingerprint (deterministic over the unchanged rule set)" \
  || bad "(7) --refresh changed the fingerprint for an unchanged rule set: '$fp1' → '$fp_refresh'"

# ── (8) TEETH: a live-generated researched rule rides the seam → DIFFERENT fingerprint + extra id ──
# Proves the lock reflects the ACTUAL delivered set (not a constant): the researched rule
# (getff-researched-no-yaml-load) joins via the existing PY_TEMPLATE_DIR seam hook (ZERO seam edit).
echo ""; echo "  ── (8) teeth: researched rule via PY_TEMPLATE_DIR changes the lock ──"
if [ -f "$RESEARCHED" ]; then
  SRC=$(mktemp -d)
  cp -R "$TPL/." "$SRC/"
  cp "$RESEARCHED" "$SRC/.getff/astgrep-rules/"
  P3=$(py_fixture)
  ( cd "$P3" && PY_TEMPLATE_DIR="$SRC" bash "$INSTALL" python --force < /dev/null ) >/dev/null 2>&1
  LOCK3="$P3/$LOCK_REL"
  fp3=$(lock_field "$LOCK3" sourceFingerprint)
  grep -q '"getff-researched-no-yaml-load"' "$LOCK3" \
    && ok "(8) researched rule id captured in the lock (live-generated rule rode the seam)" \
    || bad "(8) researched rule id MISSING from the lock"
  [ -n "$fp3" ] && [ "$fp3" != "$fp1" ] \
    && ok "(8) different delivered rule set → different fingerprint (lock is non-vacuous)" \
    || bad "(8) fingerprint did NOT change for an extra rule: starter=$fp1 researched=$fp3"
  rm -rf "$SRC" "$P3"
else
  skip "(8) researched fixture absent ($RESEARCHED) — teeth arm skipped"
fi

# ── (9) REGRESSION (W3 rework, MAJOR): --force re-delivery must NOT leave a STALE lock ─────────────
# copy_safe (lib.sh:79) OVERWRITES the delivered .getff/ artefacts under --force. The lock — whose whole
# job is to record the DELIVERED set (ruleIds/ruffBans/sourceFingerprint) — must therefore be regenerated
# on --force too, not only on --refresh. Before the fix _py_write_rules_lock regenerated ONLY on
# GETFF_TOOLCHAIN_REFRESH=1, so `install.sh python --force` over a prior install whose template CHANGED
# delivered a NEW ruff-bans.toml but left ruffBans/sourceFingerprint STALE (the lock lied). RED before the
# fix (fpB==fpA, no TID999 in the lock); GREEN after (lock tracks template B).
# @arm:D1:neg lock-never-stale-on-any-pass — W3 pre-fix reproduction: flag-path guard left the lock stale
echo ""; echo "  ── (9) regression: --force re-delivery regenerates the lock (no stale ruffBans/fingerprint) ──"
SRC9=$(mktemp -d); cp -R "$TPL/." "$SRC9/"
P9=$(py_fixture)
( cd "$P9" && PY_TEMPLATE_DIR="$SRC9" bash "$INSTALL" python --force < /dev/null ) >/dev/null 2>&1
L9="$P9/$LOCK_REL"
fpA=$(lock_field "$L9" sourceFingerprint)
grep -q '"TID999"' "$L9" && preTID=1 || preTID=0
# Mutate the template B: the delivered .getff/ruff-bans.toml is a copy of the template ruff.toml — add a ban.
sed -i.bak -E 's/select = \["DTZ005", "TID251", "TID253"\]/select = ["DTZ005", "TID251", "TID253", "TID999"]/' "$SRC9/ruff.toml" && rm -f "$SRC9/ruff.toml.bak"
# Re-install with --force (NOT --refresh) over the SAME consumer → copy_safe overwrites ruff-bans.toml.
( cd "$P9" && PY_TEMPLATE_DIR="$SRC9" bash "$INSTALL" python --force < /dev/null ) >/dev/null 2>&1
grep -q 'TID999' "$P9/.getff/ruff-bans.toml" \
  && ok "(9) --force re-delivery overwrote the delivered ruff-bans.toml (template B reached the consumer)" \
  || bad "(9) --force did NOT overwrite ruff-bans.toml — repro precondition unmet"
fpB=$(lock_field "$L9" sourceFingerprint)
if [ "$preTID" -eq 0 ] && grep -q '"TID999"' "$L9" && [ -n "$fpB" ] && [ "$fpB" != "$fpA" ]; then
  ok "(9) lock regenerated on --force: ruffBans gained TID999 + fingerprint moved $fpA -> $fpB (not stale)"
else
  bad "(9) STALE lock after --force: TID999-in-lock=$(grep -c '"TID999"' "$L9") fp $fpA -> $fpB (RED before fix)"
fi
rm -rf "$SRC9" "$P9"

# ── (10) MINOR (W3 rework): loud degrade when NO sha256/md5 hash tool is on PATH ───────────────────
# The sourceFingerprint hash ladder falls through to a fake CONSTANT (0000000000000000) when the host has
# no sha256sum/shasum/md5/md5sum. That constant must NEVER be trusted silently (attention-is-not-a-
# mechanism §1 / degrade-loudly) → assert the loud stderr warning fires. Driven via the lib-only seam
# (PY_LAYER_LIB_ONLY=1) under a pruned PATH holding only the coreutils the writer needs — NOT the hash
# tools — so the no-tool branch is reached deterministically without perturbing the full installer.
# @arm:D2:neg no-silent-fingerprint-degrade — W3 pre-fix reproduction: no-hash-tool path was silent
echo ""; echo "  ── (10) loud degrade: no hash tool → stderr warning + non-authoritative fingerprint ──"
BASHBIN=$(command -v bash)
BIN=$(mktemp -d)
for t in cat find sort sed grep awk date mkdir rm head wc; do
  p=$(command -v "$t" 2>/dev/null) && ln -sf "$p" "$BIN/$t"
done
P10=$(py_fixture)
mkdir -p "$P10/.getff/astgrep-rules"
cp "$TPL/.getff/astgrep-rules/"*.yml "$P10/.getff/astgrep-rules/"
cp "$TPL/ruff.toml" "$P10/.getff/ruff-bans.toml"
warn10=$(
  PATH="$BIN" PY_LAYER_LIB_ONLY=1 PROJECT_ROOT="$P10" DRY_RUN="" GETFF_TOOLCHAIN_REFRESH="" FORCE="--force" \
    "$BASHBIN" -c 'source "$1"; _py_write_rules_lock >/dev/null' _ "$REPO_ROOT/setup.d/45-python.sh" 2>&1
)
fp10=$(lock_field "$P10/$LOCK_REL" sourceFingerprint)
printf '%s' "$warn10" | grep -q "non-authoritative" \
  && ok "(10) loud stderr warning emitted when no hash tool is on PATH (RED before fix — was silent)" \
  || bad "(10) NO loud warning on the no-hash-tool degrade path (silent fake fingerprint)"
[ "$fp10" = "0000000000000000" ] \
  && ok "(10) fingerprint degrades to the documented non-authoritative constant" \
  || bad "(10) unexpected fingerprint on the degrade path: '$fp10'"
rm -rf "$BIN" "$P10"

# ── (11) REGRESSION (W5 rework, MAJOR): a PLAIN re-run after a researched-rule JOIN must NOT ──────
# leave a STALE lock. _py_join_researched_rules (setup.d/45-python.sh) runs on EVERY delivery pass —
# including the plain no-flag re-run — so a consumer-side researched rule rendered into
# .getff/rules-research/ between passes CHANGES the delivered set with NO overwrite flag in sight.
# The W3-era flag-gated skip (`lock exists && !REFRESH && !FORCE → skip`) assumed «no overwrite flag
# ⇒ delivered set unchanged» — false since the join exists. The fix makes the guard CONTENT-AWARE:
# skip only when the stored sourceFingerprint equals the freshly-computed one. RED before the fix
# (lock keeps the starter-only ids + fingerprint after the join delivered a 5th rule); GREEN after
# (researched id present + fingerprint moved). The session-side render hop is vitest-covered
# (rule-bootstrap-practice.test.ts render-parity oracle) — the committed rendered artifact IS its
# byte-identical output, so copying it into rules-research is the same consumer state, Node-free.
# @arm:D1:neg lock-never-stale-on-any-pass — W5 pre-fix reproduction: flag-only skip vs plain-pass join
echo ""; echo "  ── (11) regression: researched join on a PLAIN re-run regenerates the lock (content-aware) ──"
if [ -f "$RESEARCHED" ]; then
  P11=$(py_fixture)
  ( cd "$P11" && bash "$INSTALL" python < /dev/null ) >/dev/null 2>&1
  L11="$P11/$LOCK_REL"
  [ -f "$L11" ] || bad "(11) plain fresh install did not emit the lock — precondition unmet"
  fpP=$(lock_field "$L11" sourceFingerprint)
  nP=$(grep -oE '"getff-[a-z0-9-]+"' "$L11" | sort -u | grep -c .)
  grep -q '"getff-researched-no-yaml-load"' "$L11" && preRes=1 || preRes=0
  [ "$preRes" -eq 0 ] || bad "(11) researched id already in the starter lock — precondition unmet"
  # The consumer authors a researched rule between passes (rendered home survives --refresh).
  mkdir -p "$P11/.getff/rules-research"
  cp "$RESEARCHED" "$P11/.getff/rules-research/"
  # PLAIN no-flag re-run — the join delivers the researched rule; NO overwrite flag is set.
  ( cd "$P11" && bash "$INSTALL" python < /dev/null ) >/dev/null 2>&1
  [ -f "$P11/.getff/astgrep-rules/getff-researched-no-yaml-load.yml" ] \
    && ok "(11) plain re-run joined the researched rule into the scan dir (repro precondition)" \
    || bad "(11) researched rule did NOT join on the plain re-run — repro precondition unmet"
  fpQ=$(lock_field "$L11" sourceFingerprint)
  nQ=$(grep -oE '"getff-[a-z0-9-]+"' "$L11" | sort -u | grep -c .)
  if grep -q '"getff-researched-no-yaml-load"' "$L11" && [ -n "$fpQ" ] && [ "$fpQ" != "$fpP" ]; then
    ok "(11) lock regenerated on the PLAIN pass: researched id captured ($nP -> $nQ ids) + fingerprint moved $fpP -> $fpQ"
  else
    bad "(11) STALE lock after the plain-pass join: ids $nP -> $nQ fp $fpP -> $fpQ researched-in-lock=$(grep -c 'researched-no-yaml-load' "$L11" || true) (RED before fix)"
  fi
  rm -rf "$P11"
else
  skip "(11) researched fixture absent ($RESEARCHED) — regression arm skipped"
fi

# ── (12) MAJOR A (W-8): manifest-present arm fires for real ──────────────────────────────────────
# The python lane now reads from .ai-factory/synthesizer-output/ (where the Node emitter writes),
# NOT .getff/ (which was never written → dead path, manifest-present arm unreachable by construction).
# This arm pre-populates the manifest at the CORRECT path and asserts the lock's version matches —
# proving the manifest-present arm fires end-to-end. Without this arm the path fix is unverified
# (the null arm fires on every scratch install because no synthesis ran).
echo ""; echo "  ── (12) manifest-present arm: python reads .ai-factory/synthesizer-output/ for real ──"
P12=$(py_fixture)
mkdir -p "$P12/.ai-factory/synthesizer-output"
cat > "$P12/.ai-factory/synthesizer-output/generation-context.json" <<'CTXEOF'
{
  "version": "3.2.1",
  "rules": []
}
CTXEOF
( cd "$P12" && bash "$INSTALL" python --force < /dev/null ) >/dev/null 2>&1
L12="$P12/$LOCK_REL"
_ctx12=$(lock_field "$L12" version)
if [ "$_ctx12" = "3.2.1" ]; then
  ok "(12) manifest-present arm fires: lock version=3.2.1 (matches generation-context manifest)"
else
  bad "(12) manifest-present arm BROKEN: lock version='$_ctx12' (expected 3.2.1 from manifest at .ai-factory/synthesizer-output/)"
fi
# Also test the fragment dir (MAJOR B / §6 fork 2): pre-populated fragments are read by _py_json_rules.
# SCOPE OF THIS ARM (PARK-S1-7, round-5 audit): it proves the READER, not the producer. The
# fragment below is hand-written under the DELIVERED ast-grep id, because that is the key
# `_py_json_rules` looks up. The synthesizer keys its fragments by the PLAN id instead
# (emit.ts:97-103 writes `${r.id}.json`, and r.id is `G${n}` from generate.ts:52 /
# synthesize.ts:90), and (pre-S1b) the researched-python path returned before emit ran at all
# (rule-bootstrap-cli.ts `--from-practice` arm). S1b UNPARKED this: the producer now lives in
# runPracticeRender and writes its fragment to `generation-context/python/<entryId>.json`
# (per-lane subdir, DC-1). The reader path moved with it (45-python.sh `_frag_dir`).
# This arm STILL proves the READER only — the fragment is hand-placed (not produced by the
# CLI), and arm (13) below is the additive producer-proof. Criterion 6 forbids broadening
# this arm into a producer claim; the path update is necessary maintenance to keep the
# reader-claim meaningful after the path moved, not a scope change.
mkdir -p "$P12/.ai-factory/synthesizer-output/generation-context/python"
# Re-run with fragments for a rule that python actually delivers
_delivered_id=$(grep -hE '^id:' "$P12"/.getff/astgrep-rules/*.yml 2>/dev/null | head -1 | sed -E 's/^id:[[:space:]]*"?([^"]*)"?[[:space:]]*$/\1/')
if [ -n "$_delivered_id" ]; then
  printf '{"id":"%s","provenance":[{"url":"https://pyyaml.org","allowlistKey":"pyyaml","fetchedAt":"2026-08-08","tier":0}],"tier":0}\n' "$_delivered_id" \
    > "$P12/.ai-factory/synthesizer-output/generation-context/python/$_delivered_id.json"
  ( cd "$P12" && bash "$INSTALL" python --force < /dev/null ) >/dev/null 2>&1
  if grep -q "\"provenance\":\[.*\"pyyaml\"" "$L12" 2>/dev/null; then
    ok "(12) fragment-READER works: rule '$_delivered_id' provenance read from a hand-placed generation-context/python/ fragment (producer side covered by arm 13 — S1b)"
  else
    bad "(12) fragment-read arm BROKEN: rule '$_delivered_id' provenance not read from fragment dir"
  fi
fi
rm -rf "$P12"

# ── (13) PRODUCER (S1b — unparks PARK-S1-7): real `--from-practice` pipeline writes the fragment ──
# Arm (12) hand-places a fragment under the delivered id → proves the READER. This arm runs the
# REAL producer pipeline end-to-end with NO hand-placed fragment anywhere: tsx CLI → install.sh
# python. Closes kickoff §3 criteria 1 (producer on LIVE path), 2 (key resolves through READER,
# not by inspection), 3 (provenance real, tier honest), 5 (RED before fix), 6 (arm 12 unchanged —
# this arm is ADDITIVE), and 4 (cross-lane non-contamination, both directions).
# T-S1b-A counter: criterion 1 REQUIRES the real --from-practice invocation, not a hand-placed
# fragment. T-S1b-B counter: criterion 2 is satisfied through the READER's emitted lock, not by
# asserting two strings look alike. T-S1b-C counter: criterion 4 sweeps cargo + go too.
echo ""; echo "  ── (13) producer: real --from-practice → fragment → python lock + cargo/go non-leak (S1b) ──"
PRACTICE_FIX="$REPO_ROOT/packages/core/synthesizer/fixtures/live-generation/getff-researched-no-yaml-load.practice.json"
RULE_ID_13="getff-researched-no-yaml-load"
URL_13="https://pyyaml.org/wiki/PyYAMLDocumentation"
# M4b rework: criterion 3 names url + allowlistKey + fetchedAt; the prior check grep'd URL only.
# All three travel together (the fragment is cat'd verbatim after stampProvenanceTier, which
# spreads the original fields via tier.ts:26-29), so coverage of all three beats coverage of one.
ALLOWKEY_13="pyyaml"
FETCHEDAT_13="2026-07-11T00:00:00.000Z"
# Find tsx (mirror rule-bootstrap-practice.test.ts:52 tsxBin): per-dir CI layouts install
# packages/core deps only, so tsx lives in packages/core/node_modules/.bin before any root hoist.
TSX_BIN=""
for _cand in "$REPO_ROOT/packages/core/node_modules/.bin/tsx" "$REPO_ROOT/node_modules/.bin/tsx"; do
  [ -x "$_cand" ] && TSX_BIN="$_cand" && break
done
if [ -z "$TSX_BIN" ]; then
  # M4c rework (§5 T15 self-application): the prior `skip` touched neither PASS nor FAIL, so an
  # unprovisioned host reported this stage GREEN — exactly the skip-that-passes concealment shape
  # T15 asks this stage to name as its own failure mode. CI shard install-sh-c provisions tsx, so
  # the CI signal is real; a developer running the suite locally without provisioning should NOT
  # read green. Fail the arm loudly so the missing-tool precondition surfaces.
  bad "(13) tsx not found — producer arm CANNOT run (T15: skip-that-passes on the one arm proving the stage). Provision: bash scripts/worktree-node-modules.sh --apply \$(pwd)"
  bad "(13) cross-lane arms also did not run (depend on the producer run)"
else
  [ -f "$PRACTICE_FIX" ] \
    && ok "(13) precondition: practice fixture present ($PRACTICE_FIX)" \
    || { bad "(13) precondition FAILED: practice fixture missing"; PRACTICE_FIX=""; }

  if [ -n "$PRACTICE_FIX" ]; then
    P13=$(py_fixture)
    # M3 rework: seed multi-stack manifests so the cargo + go lanes WRITE real locks at their
    # real home (.ai-factory/synthesizer-output/, NOT .getff/ — only the python lock lives
    # there; setup.d/46-cargo.sh:198-199 + 47-go.sh:164-165). The prior arm pointed at
    # .getff/rules-lock.{cargo,go}.json which NOTHING writes — `[ -f … ]` was false on every
    # tree and both branches took the `else`, emitting `ok`. THAT wrong path was the whole
    # defect; the seeds below are not what makes the lanes run.
    #
    # R2 correction (cold audit round 2, MINOR): an earlier draft of this comment claimed the
    # lanes «declined at manifest-detect» without a Cargo.toml/go.mod. There is no such gate —
    # the positional `cargo`/`go` arg sets TOOLCHAIN and routes to do_cargo_lane/do_go_lane
    # (install.sh:152/155 → :290/:318), which export GETFF_TOOLCHAIN and deliver unconditionally;
    # `_cargo_write_rules_lock` runs before the firing self-check, so the lock lands either way.
    # The seeds stay because a cargo lock emitted onto a tree with no Cargo.toml is an artefact
    # of the fixture rather than a realistic consumer — but they are a REALISM choice, not a
    # precondition (verified live: the three lanes coexist on one consumer, all exit 0, all three
    # locks appear).
    printf '[package]\nname = "demo"\nversion = "0.0.1"\nedition = "2021"\n' > "$P13/Cargo.toml"
    printf 'module demo\n\ngo 1.21\n' > "$P13/go.mod"
    # Run the real --from-practice CLI against the consumer (NOT a hand-placed fragment).
    # On the pre-fix tree the CLI renders the .yml only; on the post-fix tree (T3) it ALSO
    # emits the generation-context/python/<entryId>.json fragment.
    CLI_OUT=$( cd "$P13" && "$TSX_BIN" "$REPO_ROOT/packages/core/install/rule-bootstrap-cli.ts" \
      --from-practice "$PRACTICE_FIX" --consumer-root "$P13" 2>&1 )
    if [ -f "$P13/.getff/rules-research/$RULE_ID_13.yml" ]; then
      ok "(13) producer rendered $RULE_ID_13.yml into .getff/rules-research/ (the durable researched home)"
    else
      bad "(13) producer did NOT render the rule YAML — precondition unmet (CLI tail: $(printf '%s' "$CLI_OUT" | tail -3 | tr '\n' '|'))"
    fi

    # Run the python lane (joins rules-research/*.yml → astgrep-rules/, reads fragments, writes lock).
    ( cd "$P13" && bash "$INSTALL" python --force < /dev/null ) >/dev/null 2>&1
    L13="$P13/$LOCK_REL"

    # Criterion 1 + 2 + 3 + 5: the lock entry for the researched rule carries the record's
    # url/allowlistKey/fetchedAt — proven through the READER's emitted lock, not by inspection.
    if grep -q "\"$RULE_ID_13\"" "$L13" 2>/dev/null; then
      ok "(13) python lock carries the researched rule id (join seam delivered the rendered YAML)"
    else
      bad "(13) python lock MISSING the researched rule id (join seam did NOT deliver it)"
    fi
    # T1 RED→GREEN: this assertion FAILS on the pre-fix tree (no producer → fallback provenance:[])
    # and PASSES on the post-fix tree (T3 wrote the fragment with the record's provenance).
    # M4b rework: criterion 3 names url + allowlistKey + fetchedAt — assert ALL THREE (the
    # fragment is cat'd verbatim after stampProvenanceTier, which preserves every original
    # field via tier.ts:26-29 spread, so all three travel together).
    _url_present=0; _allow_present=0; _fetched_present=0
    grep -qF "$URL_13" "$L13" 2>/dev/null && _url_present=1
    grep -qF "\"allowlistKey\":\"$ALLOWKEY_13\"" "$L13" 2>/dev/null && _allow_present=1
    grep -qF "\"fetchedAt\":\"$FETCHEDAT_13\"" "$L13" 2>/dev/null && _fetched_present=1
    if [ "$_url_present" -eq 1 ] && [ "$_allow_present" -eq 1 ] && [ "$_fetched_present" -eq 1 ]; then
      ok "(13) python lock carries non-empty provenance for $RULE_ID_13 (url + allowlistKey + fetchedAt all present) — producer GREEN"
      PRODUCER_13_RESULT="GREEN"
    else
      bad "(13) python lock provenance INCOMPLETE for $RULE_ID_13 (url=$_url_present allowKey=$_allow_present fetchedAt=$_fetched_present) — producer RED (PARK-S1-7 unfixed)"
      PRODUCER_13_RESULT="RED"
    fi

    # Criterion 3 — tier honesty. The fixture's provenance URL is in the Tier-0 builtin allowlist
    # (allowlistKey 'pyyaml'), so stampProvenanceTier yields tier:0 for the source and weakestTier
    # yields tier:0 for the rule. Asserting tier:0 here asserts the producer called
    # stampProvenanceTier (derived verdict) rather than emitting the constant DEFAULT_TIER=2.
    # A *derived* 0 and an *accidental* value are different artefacts — and on the RED tree the
    # value is the fallback 2, which the assertion correctly distinguishes from a stamped 0.
    #
    # M1 rework (R1 cold audit): the prior pattern `"$RULE_ID_13"[^}]*"tier":0` could not cross
    # the `}` that closes the first provenance source object, so it bound the SOURCE's tier
    # (inside provenance[]), never the RULE-LEVEL tier (outside it). A synthetic rule carrying
    # rule-tier:2 with a Tier-0 source PASSED — exactly the derived-vs-accidental conflation
    # criterion 3 forbids and S1 round-3 rejected once already. The new pattern binds the
    # tier that sits AFTER the `]` closing the provenance array (i.e. the rule-level tier).
    #
    # R2 rework (cold audit round 2, MAJOR): the round-1 repair used an UNBOUNDED `.*` between
    # the rule id and `],"tier":0`. `_py_write_rules_lock` emits the whole `rules[]` array on ONE
    # line (setup.d/45-python.sh `printf '  "rules": %s,\n'`), and the lock is multi-rule (four
    # starter rules under packages/core/templates/python/.getff/astgrep-rules/ plus the researched
    # one), so `.*` traversed past the researched rule's own object into a LATER rule and bound
    # ITS `],"tier":0`. A researched rule carrying rule-tier 2 therefore passed as a derived
    # Tier-0 stamp whenever any later rule was Tier-0 — the round-1 defect through a new door.
    # The bound is `[^]]*`, which cannot cross the `]` that closes this rule's provenance array.
    #
    # ONE pattern, TWO uses (round-2 W-8): the discrimination proof below and the live assertion
    # further down consume the SAME variable. Round 1 wrote them as two separate regex literals
    # that already differed textually, so the proof certified a string the assertion did not use
    # — `#sync-by-copy-paste` (dual-implementation-discipline.md §8) at the proof level.
    #
    # Discrimination proof: build the five synthetic locks — the three the round-1 audit measured
    # PLUS the two multi-rule shapes that bracket the round-2 defect — and show the pattern fires
    # on exactly the honest ones. A regex change without this proof does not close M1.
    #
    # R3 rework (cold audit round 3, MINOR): the corpus is now EMITTED, not hand-written. Each
    # case calls the real `_py_json_rules` through the `PY_LAYER_LIB_ONLY=1` seam against a
    # synthetic fragment dir, so the separator, the empty-provenance fallback object and the
    # `  "rules": …,` framing are the artefact's OWN bytes. The hand-written corpus joined rule
    # objects with `},{` while the emitter joins with `}, {` (`_py_json_rules` builds the
    # separator as `out="$out, "`). That byte was non-load-bearing for THIS pattern — the
    # verdicts are identical on both shapes — but a proof corpus one byte off the artefact it
    # certifies is `#sync-by-copy-paste` (dual-implementation-discipline.md §8) at the fixture
    # level: it is what hides the NEXT boundary defect, and it drifts silently the day the
    # emitter's rendering changes. Emitting removes the copy rather than re-synchronising it.
    _m1_re='","provenance":\[[^]]*\],"tier":0([^0-9]|$)'
    _M1_LAYER="$REPO_ROOT/setup.d/45-python.sh"
    _M1_PROV='[{"url":"u","allowlistKey":"pyyaml","fetchedAt":"2026-07-11","tier":0}]'
    # _m1_frag <frag-dir> <rule-id> <provenance-json> <rule-tier> — one generation-context
    # fragment in the PRODUCER's own shape: rule-bootstrap-cli.ts writes
    # `JSON.stringify({id, provenance, tier})` (compact, that key order), and `_py_json_rules`
    # cat's it verbatim into `rules[]`.
    _m1_frag() { printf '{"id":"%s","provenance":%s,"tier":%s}\n' "$2" "$3" "$4" > "$1/$2.json"; }
    # _m1_lock <frag-dir> <newline-separated rule ids> — the emitter's own `  "rules": …,` line.
    # A rule id with no fragment in <frag-dir> takes `_py_json_rules`' `{"id":…,"provenance":[],
    # "tier":2}` fallback — also emitted, never copied.
    _m1_lock() {
      PY_LAYER_LIB_ONLY=1 bash -c \
        'source "$1"; printf "  \"rules\": %s,\n" "$(_py_json_rules "$2" "$3")"' \
        _ "$_M1_LAYER" "$2" "$1"
    }
    _m1_ids_multi=$(printf '%s\ngetff-no-eval\n' "$RULE_ID_13")
    _m1_honest=$(mktemp); _m1_dishonest=$(mktemp); _m1_empty=$(mktemp)
    _m1_multi=$(mktemp); _m1_multi_honest=$(mktemp)
    # Honest: researched rule stamped Tier-0 at RULE level over a Tier-0 source.
    _m1_fd_h=$(mktemp -d); _m1_frag "$_m1_fd_h" "$RULE_ID_13" "$_M1_PROV" 0
    _m1_lock "$_m1_fd_h" "$RULE_ID_13" > "$_m1_honest"
    # Dishonest (the round-1 defeater): same Tier-0 SOURCE, rule-level tier 2.
    _m1_fd_d=$(mktemp -d); _m1_frag "$_m1_fd_d" "$RULE_ID_13" "$_M1_PROV" 2
    _m1_lock "$_m1_fd_d" "$RULE_ID_13" > "$_m1_dishonest"
    # Empty-provenance fallback: no fragment at all → the emitter's own `provenance:[],tier:2`.
    _m1_fd_e=$(mktemp -d)
    _m1_lock "$_m1_fd_e" "$RULE_ID_13" > "$_m1_empty"
    # The round-2 defeater: researched rule dishonest at rule level, a LATER rule honestly Tier-0.
    # This is the real lock's shape (one researched rule + starter rules on a single line).
    _m1_fd_m=$(mktemp -d)
    _m1_frag "$_m1_fd_m" "$RULE_ID_13" "$_M1_PROV" 2
    _m1_frag "$_m1_fd_m" "getff-no-eval" '[]' 0
    _m1_lock "$_m1_fd_m" "$_m1_ids_multi" > "$_m1_multi"
    # Over-tightening control (the opposite error): an HONEST researched rule followed by a
    # Tier-2 starter rule — the real lock's actual shape. A pattern tightened until it can no
    # longer match a multi-rule lock at all would fail this case and silently red the live arm.
    # The neighbour gets NO fragment, so it takes the emitter's own Tier-2 fallback.
    _m1_fd_mh=$(mktemp -d); _m1_frag "$_m1_fd_mh" "$RULE_ID_13" "$_M1_PROV" 0
    _m1_lock "$_m1_fd_mh" "$_m1_ids_multi" > "$_m1_multi_honest"
    # Corpus precondition: an emitted corpus can fail to materialise (a broken seam, a renamed
    # `_py_json_rules`) in a way a hand-written one could not. Five empty files would make every
    # `grep` miss and read as a REGEX defect — the wrong diagnosis. Assert the emit landed first,
    # so the next reader is sent at the seam, not at the pattern.
    _m1_corpus_bad=""
    for _f in "$_m1_honest" "$_m1_dishonest" "$_m1_empty" "$_m1_multi" "$_m1_multi_honest"; do
      grep -q "\"$RULE_ID_13\"" "$_f" 2>/dev/null || _m1_corpus_bad="$_m1_corpus_bad $_f"
    done
    if [ -n "$_m1_corpus_bad" ]; then
      bad "(13) M1 corpus NOT emitted — _py_json_rules produced no rule object via the PY_LAYER_LIB_ONLY seam (empty/absent:$_m1_corpus_bad). This is a SEAM failure, not a regex failure."
    else
      ok "(13) M1 corpus emitted by the real _py_json_rules (proof fixture reproduces the artefact's own bytes, separator included)"
    fi
    _h=$(grep -qE "\"$RULE_ID_13$_m1_re" "$_m1_honest"       && echo pass || echo fail)
    _d=$(grep -qE "\"$RULE_ID_13$_m1_re" "$_m1_dishonest"    && echo WRONGLY-pass || echo correctly-fail)
    _e=$(grep -qE "\"$RULE_ID_13$_m1_re" "$_m1_empty"        && echo WRONGLY-pass || echo correctly-fail)
    _m=$(grep -qE "\"$RULE_ID_13$_m1_re" "$_m1_multi"        && echo WRONGLY-pass || echo correctly-fail)
    _mh=$(grep -qE "\"$RULE_ID_13$_m1_re" "$_m1_multi_honest" && echo pass || echo WRONGLY-fail)
    if [ "$_h" = "pass" ] && [ "$_d" = "correctly-fail" ] && [ "$_e" = "correctly-fail" ] \
       && [ "$_m" = "correctly-fail" ] && [ "$_mh" = "pass" ]; then
      ok "(13) M1 discrimination 5/5: pattern binds THIS rule's tier (honest->pass; dishonest rule-tier:2+Tier-0-src->fail; empty-fallback->fail; multi-rule dishonest-then-Tier-0-neighbour->fail; multi-rule honest-then-Tier-2-neighbour->pass)"
    else
      bad "(13) M1 discrimination FAILED: pattern does not discriminate (honest=$_h dishonest=$_d empty=$_e multi-dishonest=$_m multi-honest=$_mh)"
    fi
    rm -f "$_m1_honest" "$_m1_dishonest" "$_m1_empty" "$_m1_multi" "$_m1_multi_honest"
    rm -rf "$_m1_fd_h" "$_m1_fd_d" "$_m1_fd_e" "$_m1_fd_m" "$_m1_fd_mh"
    # Real assertion against the live lock — the SAME `$_m1_re` the proof above just certified.
    if grep -qE "\"$RULE_ID_13$_m1_re" "$L13" 2>/dev/null; then
      ok "(13) tier=0 stamped at RULE LEVEL (after the ] closing provenance) — stampProvenanceTier derived verdict, NOT DEFAULT_TIER=2 fallback"
    else
      # Same bound as the assertion: without `[^]]*` this diagnostic reports a NEIGHBOUR rule's
      # tier and sends the next reader after the wrong defect.
      _tier_13=$(grep -oE "\"$RULE_ID_13\",\"provenance\":\[[^]]*\],\"tier\":[0-9]+" "$L13" 2>/dev/null | head -1 | grep -oE '[0-9]+$')
      [ -z "$_tier_13" ] && _tier_13="<absent or bound to source-tier only>"
      bad "(13) rule-level tier='$_tier_13' for $RULE_ID_13 — expected 0 (Tier-0 builtin via stampProvenanceTier) — kickoff §3 criterion 3"
    fi

    # Criterion 4 — cross-lane non-contamination, DIRECTION python→cargo/go. Run the cargo + go
    # lanes against the same consumer. The python rule must NOT appear in either lock. Mechanism
    # (DC-1): the producer writes to generation-context/python/; the cargo/go glob is
    # `*.json` NON-RECURSIVE on the parent generation-context/ dir, so the subdir is invisible
    # by construction (46-cargo.sh:262, 47-go.sh:229). REVERSE direction: cargo/go producers do
    # not exist today; the per-lane subdir layout handles them symmetrically if/when added.
    #
    # M3 rework: the cargo/go locks live at .ai-factory/synthesizer-output/rules-lock.{cargo,go}.json
    # (setup.d/46-cargo.sh:198-199, 47-go.sh:164-165) — NOT .getff/ (only the PYTHON lock lives
    # there). The prior arm pointed at .getff/ variants that NOTHING writes: `[ -f … ]` was false
    # on every tree and both branches took the `else`, emitting `ok`. With Cargo.toml + go.mod
    # seeded above, the lanes now WRITE real locks; the absent-lock case is now `bad` (precondition
    # unmet), NOT a trivial pass — an assertion whose positive branch never runs is not an assertion.
    ( cd "$P13" && bash "$INSTALL" cargo --force < /dev/null ) >/dev/null 2>&1
    L13_CARGO="$P13/.ai-factory/synthesizer-output/rules-lock.cargo.json"
    ( cd "$P13" && bash "$INSTALL" go --force < /dev/null ) >/dev/null 2>&1
    L13_GO="$P13/.ai-factory/synthesizer-output/rules-lock.go.json"
    if [ -f "$L13_CARGO" ]; then
      if grep -q "\"$RULE_ID_13\"" "$L13_CARGO" 2>/dev/null; then
        bad "(13) cargo lock LEAKED the python rule (cross-lane contamination — DC-1 broken)"
      else
        ok "(13) cargo lock free of the python rule (per-lane subdir isolates the non-recursive glob — DC-1)"
      fi
    else
      bad "(13) cargo lock absent at $L13_CARGO — precondition unmet (cargo lane declined despite Cargo.toml seed; lock-level check did not fire)"
    fi
    if [ -f "$L13_GO" ]; then
      if grep -q "\"$RULE_ID_13\"" "$L13_GO" 2>/dev/null; then
        bad "(13) go lock LEAKED the python rule (cross-lane contamination — DC-1 broken)"
      else
        ok "(13) go lock free of the python rule (per-lane subdir isolates the non-recursive glob — DC-1)"
      fi
    else
      bad "(13) go lock absent at $L13_GO — precondition unmet (go lane declined despite go.mod seed; lock-level check did not fire)"
    fi
    # Belt-and-braces: directly exercise the cargo/go glob against the post-producer fragment dir.
    # This catches a future regression where the producer moves files into the parent dir even if
    # the cargo/go lanes themselves fail to write a lock for an unrelated reason.
    _parent_frag_dir="$P13/.ai-factory/synthesizer-output/generation-context"
    if [ -d "$_parent_frag_dir" ]; then
      _leaked=""
      for _rf in "$_parent_frag_dir"/*.json; do
        [ -f "$_rf" ] || continue
        if grep -q "\"$RULE_ID_13\"" "$_rf" 2>/dev/null; then
          _leaked="$_leaked $_rf"
        fi
      done
      if [ -z "$_leaked" ]; then
        ok "(13) direct glob: no python-rule fragment reachable via parent-dir *.json (DC-1 holds at the glob level)"
      else
        bad "(13) direct glob: parent-dir *.json reached python fragment(s):$_leaked (DC-1 broken at the glob level)"
      fi
    else
      ok "(13) direct glob: producer wrote no parent-dir generation-context/ (subdir layout — DC-1)"
    fi
    rm -rf "$P13"
  fi
fi

# ── (14) A2-7: sourceFingerprint must cover the provenance fragments the lock WRITES ──────────────
# Ledger addendum A2-7. The fingerprint is the input to the CONTENT-AWARE idempotent skip
# (45-python.sh, "fingerprint unchanged … no-op"). It hashed only the delivered rule bytes
# (astgrep ymls + ruff bans) — but the lock's `provenance` field is built from the
# generation-context/python/*.json fragments read further down the same function. A fragment
# added without a rule-byte change therefore could not perturb the fingerprint, the skip fired,
# and the lock stayed STALE forever — contradicting the invariant its own docstring states
# ("the lock is NEVER stale relative to the delivered .getff/ artefacts").
#
# This was MASKED on the --force path by A2-1: copy_safe nested .getff/astgrep-rules/astgrep-rules/,
# the fingerprint's `find … -name '*.yml'` is recursive, so the yml count doubled (4 → 8) and the
# hash changed for the wrong reason. Arm (12) above passed on that accident. With A2-1 fixed the
# tree is genuinely identical and the hole is exposed on BOTH the plain and the --force path.
#
# PAIRED: (14a) fragment added, rule bytes untouched → fingerprint CHANGES + provenance lands.
#         (14b) nothing changed at all → the skip line STILL fires and the lock stays byte-identical
#               (the content-aware skip is preserved, not defeated by hashing more inputs).
echo ""; echo "  ── (14) A2-7: fingerprint covers provenance fragments; idempotent skip preserved ──"
P14=$(py_fixture)
( cd "$P14" && bash "$INSTALL" python < /dev/null ) >/dev/null 2>&1
L14="$P14/$LOCK_REL"
_fp_before=$(lock_field "$L14" sourceFingerprint)
_id14=$(grep -hE '^id:' "$P14"/.getff/astgrep-rules/*.yml 2>/dev/null | head -1 | sed -E 's/^id:[[:space:]]*"?([^"]*)"?[[:space:]]*$/\1/')
_yml_sha_before=$(cat "$P14"/.getff/astgrep-rules/*.yml 2>/dev/null | shasum -a 256 2>/dev/null | awk '{print $1}')

if [ -z "$_fp_before" ] || [ -z "$_id14" ]; then
  bad "(14) precondition FAILED: no lock fingerprint ('$_fp_before') or no delivered rule id ('$_id14')"
else
  ok "(14) precondition: first install emitted fingerprint $_fp_before for delivered id $_id14"

  # (14a) add ONLY a provenance fragment — rule bytes stay byte-identical.
  mkdir -p "$P14/.ai-factory/synthesizer-output/generation-context/python"
  printf '{"id":"%s","provenance":[{"url":"https://pyyaml.org","allowlistKey":"a2-7-probe","fetchedAt":"2026-09-05","tier":0}],"tier":0}\n' "$_id14" \
    > "$P14/.ai-factory/synthesizer-output/generation-context/python/$_id14.json"
  ( cd "$P14" && bash "$INSTALL" python < /dev/null ) >/dev/null 2>&1
  _fp_after=$(lock_field "$L14" sourceFingerprint)
  _yml_sha_after=$(cat "$P14"/.getff/astgrep-rules/*.yml 2>/dev/null | shasum -a 256 2>/dev/null | awk '{print $1}')

  # Non-vacuity: the rule bytes MUST be unchanged, else any fingerprint change proves nothing.
  [ "$_yml_sha_before" = "$_yml_sha_after" ] \
    && ok "(14a) non-vacuity: delivered rule bytes byte-identical across the two passes (the fragment is the only delta)" \
    || bad "(14a) non-vacuity BROKEN: rule bytes changed between passes — a fingerprint change would prove nothing"

  [ -n "$_fp_after" ] && [ "$_fp_after" != "$_fp_before" ] \
    && ok "(14a) fingerprint changed ($_fp_before → $_fp_after) after a provenance-fragment-only delta" \
    || bad "(14a) fingerprint UNCHANGED ($_fp_before) after adding a provenance fragment — the skip is blind to the lock's own provenance inputs (A2-7)"

  grep -q '"allowlistKey": *"a2-7-probe"' "$L14" 2>/dev/null || grep -q 'a2-7-probe' "$L14" 2>/dev/null \
    && ok "(14a) lock regenerated and carries the fragment's provenance (reader reached on a plain, non-force pass)" \
    || bad "(14a) lock does NOT carry the fragment provenance — it was skipped as 'unchanged' and is now permanently stale"

  # (14b) NOTHING changes → the content-aware skip must still fire and the lock stay byte-identical.
  _lock_sha_before=$(shasum -a 256 "$L14" 2>/dev/null | awk '{print $1}')
  _out14b=$( cd "$P14" && bash "$INSTALL" python < /dev/null 2>&1 )
  _lock_sha_after=$(shasum -a 256 "$L14" 2>/dev/null | awk '{print $1}')

  echo "$_out14b" | grep -q 'fingerprint unchanged' \
    && ok "(14b) no-delta re-run still prints the content-aware skip (hashing more inputs did not defeat idempotency)" \
    || bad "(14b) skip line GONE on a no-delta re-run — the lock now regenerates every pass (emittedAt churn): $(echo "$_out14b" | grep -i 'rules-lock' | tr '\n' '|' | cut -c1-160)"

  [ "$_lock_sha_before" = "$_lock_sha_after" ] \
    && ok "(14b) lock byte-identical across a no-delta re-run" \
    || bad "(14b) lock bytes changed on a no-delta re-run (fingerprint is not deterministic over the fragment set)"
fi
rm -rf "$P14"

rm -rf "$P" "$P2"
echo ""
echo "── python-rules-lock: $PASS passed, $FAIL failed ──"
[ "$FAIL" -eq 0 ] || exit 1
