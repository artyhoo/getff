#!/usr/bin/env bash
# deliver-gate-scripts.test.sh — consumer-refresh-integrity R3 (issue 1485) + ledger C-2 (#1597).
#
# ONE gate script is still delivered to consumers:
#   scripts/run-local-ci-sweep.sh — gated on by .claude/skills/harvest/SKILL.md §3 (ships at
#                                  factory / --with-aif-suite depth only).
# Its R3 companion scripts/check-ask-files.sh was RETIRED from delivery (ledger C-2, #1597):
# the pre-push ask-file-schema section is maintainer-only (owner: 'maintainer' in
# packages/core/hooks/pre-push.ts) and composeSections() drops maintainer sections on
# consumers (measured live: activeSections(false) omits 'ask-file-schema'), so the delivered
# script was never invoked by a consumer's pre-push — delivery only maintained a gate that
# cannot fire there. The delivery site (setup.d/50-hooks.sh) and its do_refresh mirror were
# removed; install.sh --refresh now REPORTS a stale prior-delivery copy through the shared
# `⚠ ORPHAN:` vocabulary (setup.d/lib.sh report_getff_orphans precedent) and never deletes it.
# Sources stay at root scripts/ — RI-4 binding (relocation would violate the session-bus v2 §9
# claim recorded in packages/core/hooks/pre-push.ts).
#
# Arms:
#   (a) fresh installs → check-ask-files.sh NOT delivered (C-2 paired negative, standard
#       profile AND --with-aif-suite); run-local-ci-sweep.sh present + executable on the
#       suite install and correctly absent on the standard profile.
#   (b) stale prior-delivery copy (constructible form): plant scripts/check-ask-files.sh on
#       a fresh consumer — what a pre-C-2 install landed — then --refresh: the ORPHAN
#       divergence line is printed (identically under --dry-run), the file is NOT
#       re-delivered, NOT rewritten and NOT deleted (report-only), and the refresh-baseline
#       manifest correctly carries no entry for it (the report is presence-based).
#   (c) negative arms per the measured breadth: python toolchain lane → NEITHER script
#       delivered; profile=env → run-local-ci-sweep NOT delivered (factory-gated) and
#       check-ask-files absent there too (the C-2 removal is profile-wide).
#   (d) do_refresh mirror for run-local-ci-sweep: factory install → mutate → --refresh →
#       warning + preserved copy + refreshed (the gated refresh arm incl. presence clause).
#   (e) --dry-run of the delivery lines: run-local-ci-sweep announced as a would-copy;
#       check-ask-files NOT announced and NOTHING written to the fixture.
#
# NOT here (evidence-only on R3, per dispatch): the npm-tarball probe — root scripts/ is not
# in the packages/core `files` allowlist (measured via the npm-tarball probe target;
# 0 scripts/ entries in the 500-file tarball) → parked DECISION-NEEDED, not relocated. The
# tarball PAYLOAD still lists scripts/check-ask-files.sh (RI-4 fork, parked in
# consumer-refresh-integrity/done.md) — tarball membership is out of this file's population.
#
# Acceptance is behavioural (T2/T-CRI-A): every arm runs the REAL installer into a mktemp
# fixture and asserts the installed tree / installer OUTPUT — never a grep of install.sh's
# own source text. Harness shape mirrors refresh-divergence-guard.test.sh (bash 3.2, ASCII
# substrings only for the UTF-8-glyph warning lines).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# hash256 <file> — same sha256sum | shasum ladder as setup.d/lib.sh _hash256 / snapshot.sh.
hash256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    echo "NOHASH"
  fi
}

ASK_REL="scripts/check-ask-files.sh"
SWEEP_REL="scripts/run-local-ci-sweep.sh"
MANIFEST_REL=".ai-factory/refresh-baseline.json"
CONFLICTS_REL=".ai-factory/refresh-conflicts"

# Fixture hygiene (sibling precedent: scripts/check-ask-files.test.sh traps EXIT): every arm
# removes its own fixture inline on the success path; this trap catches early exits so a
# `set -u` abort cannot leak mktemp fixtures or the /tmp snapshots.
TA=""; TA2=""; TB=""; TC=""; TC2=""; TD=""; TE=""
cleanup() {
  for f in "$TA" "$TA2" "$TB" "$TC" "$TC2" "$TD" "$TE"; do
    if [ -n "$f" ] && [ -d "$f" ]; then rm -rf "$f"; fi
  done
  rm -f /tmp/r3dg-*.$$ 2>/dev/null || true
}
trap cleanup EXIT

# make_consumer [extra install args...] — minimal npm consumer + full ts-server install
# (non-interactive: stdin closed). Echoes the fixture dir.
make_consumer() {
  local T
  T=$(mktemp -d)
  printf '{ "name":"consumer","version":"0.0.0" }\n' > "$T/package.json"
  ( cd "$T" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force "$@" < /dev/null ) >/dev/null 2>&1
  echo "$T"
}

# ══════════════════════════════════════════════════════════════════════════════
# ARM (a) — fresh installs: the retired script is NOT delivered; the sweep script is
# ══════════════════════════════════════════════════════════════════════════════
TA=$(make_consumer)
# Positive control: the hooks layer DID run (it delivers .husky/pre-push), so the
# absence checks below are meaningful rather than a crashed-install vacuous pass.
if [ -f "$TA/.husky/pre-push" ]; then
  ok "arm (a) positive control: hooks layer ran (.husky/pre-push delivered) — the absence checks below are meaningful"
else
  bad "arm (a) positive control: .husky/pre-push NOT delivered — install never reached the hooks layer; the absence checks below are vacuous"
fi
if [ ! -e "$TA/$ASK_REL" ]; then
  ok "arm (a): $ASK_REL NOT delivered on a standard-profile fresh install (C-2: maintainer-only gate, delivery retired)"
else
  bad "arm (a): $ASK_REL DELIVERED on a standard-profile fresh install — C-2 removal regressed"
fi
# Standard profile (no factory opt-in) must NOT carry the factory-gated sweep script.
if [ ! -e "$TA/$SWEEP_REL" ]; then
  ok "arm (a): $SWEEP_REL correctly absent on a standard-profile install (factory-gated breadth)"
else
  bad "arm (a): $SWEEP_REL shipped on a standard profile — RI-4 breadth violated"
fi
rm -rf "$TA"

TA2=$(make_consumer --with-aif-suite)
if [ -f "$TA2/$SWEEP_REL" ]; then
  ok "arm (a): $SWEEP_REL delivered on a --with-aif-suite install"
else
  bad "arm (a): $SWEEP_REL MISSING on a --with-aif-suite install (harvest skill's gate target dead — issue 1485 unfixed)"
fi
if [ -x "$TA2/$SWEEP_REL" ]; then
  ok "arm (a): $SWEEP_REL is executable"
else
  bad "arm (a): $SWEEP_REL is NOT executable"
fi
# Paired negative: the suite install does not resurrect the retired ask script either.
if [ ! -e "$TA2/$ASK_REL" ]; then
  ok "arm (a): $ASK_REL absent on the suite install too (C-2 removal is profile-wide)"
else
  bad "arm (a): $ASK_REL present on the suite install — C-2 removal regressed"
fi
rm -rf "$TA2"

# ══════════════════════════════════════════════════════════════════════════════
# ARM (b) — stale prior-delivery copy → ORPHAN report on --refresh, file never touched
# ══════════════════════════════════════════════════════════════════════════════
TB=$(make_consumer)
PROBE_B="$TB/$ASK_REL"
mkdir -p "$TB/scripts"
# Plant the bytes a pre-C-2 delivery landed (copy_safe delivered the root source as-is, and
# C-2 did not touch that source) — the constructible form of "installed before the removal".
cp "$REPO_ROOT/$ASK_REL" "$PROBE_B"
cp "$PROBE_B" /tmp/r3dg-stale-b.$$
# The fresh install no longer stages the file, so the baseline manifest must NOT carry an
# entry for it — the report below fires on PRESENCE, not on the baseline machinery.
# Deliberately jq-free (the key is always quoted in the manifest, pretty or compact): a
# missing local jq must not silently turn this precondition into a vacuous ok.
ENTRY_B=""
if [ -f "$TB/$MANIFEST_REL" ] && grep -F "\"$ASK_REL\"" "$TB/$MANIFEST_REL" > /dev/null 2>&1; then
  ENTRY_B="staged"
fi
if [ -z "$ENTRY_B" ]; then
  ok "arm (b) precondition: baseline manifest carries NO entry for $ASK_REL (nothing staged — the report is presence-based)"
else
  bad "arm (b) precondition: manifest STILL stages $ASK_REL — the delivery did not actually go away"
fi

OUT_B=$( cd "$TB" && bash "$REPO_ROOT/install.sh" --refresh < /dev/null 2>&1 )

if printf '%s\n' "$OUT_B" | grep -qF 'ORPHAN: scripts/check-ask-files.sh' \
  && printf '%s\n' "$OUT_B" | grep -qF 'no longer delivered'; then
  ok "arm (b): --refresh reports the stale copy (ORPHAN divergence line names the file + the C-2 reason)"
else
  bad "arm (b): --refresh printed NO stale-copy report for $ASK_REL (silently ignored or re-delivered)"
fi
if printf '%s\n' "$OUT_B" | grep -qF "$ASK_REL (refreshed)"; then
  bad "arm (b): --refresh re-delivered $ASK_REL (the retired script came back on the refresh path)"
else
  ok "arm (b): --refresh does NOT re-deliver $ASK_REL (no refresh of the retired script)"
fi
if cmp -s "$PROBE_B" /tmp/r3dg-stale-b.$$; then
  ok "arm (b): the stale copy is STILL on disk with its exact bytes (report-only — never deleted, never rewritten)"
else
  bad "arm (b): the stale copy was deleted or modified by --refresh (consumer file destroyed)"
fi
rm -f /tmp/r3dg-stale-b.$$

OUT_BD=$( cd "$TB" && bash "$REPO_ROOT/install.sh" --refresh --dry-run < /dev/null 2>&1 )
if printf '%s\n' "$OUT_BD" | grep -qF 'ORPHAN: scripts/check-ask-files.sh'; then
  ok "arm (b): --refresh --dry-run prints the same report (read-only report, identical under --dry-run)"
else
  bad "arm (b): --dry-run did not print the stale-copy report (dry-run output diverges from the real run)"
fi
rm -rf "$TB"

# ══════════════════════════════════════════════════════════════════════════════
# ARM (c) — negative breadth arms
# ══════════════════════════════════════════════════════════════════════════════
# (c1) python toolchain lane: no npm pre-push arm → NEITHER script delivered.
TC=$(mktemp -d)
cat > "$TC/pyproject.toml" <<'EOF'
[project]
name = "r3-python-consumer"
version = "0.0.1"
EOF
( cd "$TC" && git init -q && bash "$REPO_ROOT/install.sh" python --force < /dev/null ) >/dev/null 2>&1
if [ ! -e "$TC/$ASK_REL" ]; then
  ok "arm (c): python lane does NOT deliver $ASK_REL (no pre-push arm on non-npm lanes)"
else
  bad "arm (c): python lane DELIVERED $ASK_REL — RI-4 measured breadth violated"
fi
if [ ! -e "$TC/$SWEEP_REL" ]; then
  ok "arm (c): python lane does NOT deliver $SWEEP_REL (factory-gated, npm suite arm)"
else
  bad "arm (c): python lane DELIVERED $SWEEP_REL — RI-4 measured breadth violated"
fi
rm -rf "$TC"

# (c2) profile=env (env+ without factory skills): run-local-ci-sweep NOT delivered.
TC2=$(make_consumer --profile env)
if [ ! -e "$TC2/$SWEEP_REL" ]; then
  ok "arm (c): profile=env does NOT deliver $SWEEP_REL (harvest ships at factory depth only)"
else
  bad "arm (c): profile=env DELIVERED $SWEEP_REL — factory gating violated"
fi
# C-2 paired negative: the retired ask script is absent on every npm profile now.
if [ ! -e "$TC2/$ASK_REL" ]; then
  ok "arm (c): profile=env does NOT deliver $ASK_REL (C-2 removal is profile-wide)"
else
  bad "arm (c): profile=env DELIVERED $ASK_REL — C-2 removal regressed"
fi
rm -rf "$TC2"

# ══════════════════════════════════════════════════════════════════════════════
# ARM (d) — do_refresh mirror for run-local-ci-sweep (gated arm incl. presence clause)
# ══════════════════════════════════════════════════════════════════════════════
TD=$(make_consumer --with-aif-suite)
PROBE_D="$TD/$SWEEP_REL"
if [ ! -f "$PROBE_D" ]; then
  bad "arm (d) precondition: suite install did not deliver $SWEEP_REL"
else
  cp "$PROBE_D" /tmp/r3dg-fresh-d.$$
  printf 'CONSUMER_DIVERGENCE_MARKER_R3_ARM_D\n' > "$PROBE_D"
  cp "$PROBE_D" /tmp/r3dg-mut-d.$$
  SHA8_D=$(hash256 "$PROBE_D"); SHA8_D="${SHA8_D:0:8}"

  # NOTE: bare `--refresh` resolves PROFILE to core on a non-interactive run — the presence
  # clause (script already on disk = prior opt-in) is exactly what must carry this arm.
  OUT_D=$( cd "$TD" && bash "$REPO_ROOT/install.sh" --refresh < /dev/null 2>&1 )

  if printf '%s\n' "$OUT_D" | grep -qF 'overwriting locally-modified file:' \
    && printf '%s\n' "$OUT_D" | grep -qF "$PROBE_D"; then
    ok "arm (d): R1 warning printed for the diverged $SWEEP_REL on refresh (presence clause fired)"
  else
    bad "arm (d): NO warning for the diverged $SWEEP_REL (gated refresh mirror missing or presence clause broken)"
  fi
  PRES_D="$TD/$CONFLICTS_REL/run-local-ci-sweep.sh.$SHA8_D"
  if [ -f "$PRES_D" ] && cmp -s "$PRES_D" /tmp/r3dg-mut-d.$$; then
    ok "arm (d): preserved copy at $CONFLICTS_REL/run-local-ci-sweep.sh.$SHA8_D with the exact diverged bytes"
  else
    bad "arm (d): preserved copy missing or bytes differ at $PRES_D"
  fi
  if cmp -s "$PROBE_D" /tmp/r3dg-fresh-d.$$; then
    ok "arm (d): live file refreshed to the as-installed bytes (do_refresh mirror works)"
  else
    bad "arm (d): live file NOT refreshed — the do_refresh mirror does not deliver the sweep script"
  fi
  rm -f /tmp/r3dg-fresh-d.$$ /tmp/r3dg-mut-d.$$
fi
rm -rf "$TD"

# ══════════════════════════════════════════════════════════════════════════════
# ARM (e) — --dry-run announces the live delivery, NOT the retired one; writes nothing
# ══════════════════════════════════════════════════════════════════════════════
TE=$(mktemp -d)
printf '{ "name":"dryrun","version":"0.0.0" }\n' > "$TE/package.json"
( cd "$TE" && git init -q ) >/dev/null 2>&1
OUT_E=$( cd "$TE" && bash "$REPO_ROOT/install.sh" ts-server --dry-run < /dev/null 2>&1 )
# Vacuity guard first: the dry run DOES announce deliveries, so the absence below means
# something (a bare absence-check on silent output would be a vacuous negative).
if printf '%s\n' "$OUT_E" | grep -qF "[dry-run] would copy:"; then
  ok "arm (e): dry-run announces copy deliveries at all (guard against a vacuous negative)"
else
  bad "arm (e): dry-run announced NO would-copy lines — the negative below is vacuous"
fi
if printf '%s\n' "$OUT_E" | grep -qF "scripts/check-ask-files.sh"; then
  bad "arm (e): dry-run still announces the retired $ASK_REL delivery"
else
  ok "arm (e): dry-run does NOT announce the retired $ASK_REL delivery"
fi
if [ ! -e "$TE/$ASK_REL" ]; then
  ok "arm (e): dry-run wrote NO $ASK_REL into the fixture"
else
  bad "arm (e): dry-run WROTE $ASK_REL — dry-run discipline broken"
fi

OUT_E2=$( cd "$TE" && bash "$REPO_ROOT/install.sh" ts-server --dry-run --with-aif-suite < /dev/null 2>&1 )
if printf '%s\n' "$OUT_E2" | grep -qF "[dry-run] would copy:" && printf '%s\n' "$OUT_E2" | grep -qF "scripts/run-local-ci-sweep.sh"; then
  ok "arm (e): dry-run announces the run-local-ci-sweep delivery (would-copy line)"
else
  bad "arm (e): dry-run does NOT announce the run-local-ci-sweep delivery"
fi
if [ ! -e "$TE/$SWEEP_REL" ]; then
  ok "arm (e): dry-run wrote NO $SWEEP_REL into the fixture"
else
  bad "arm (e): dry-run WROTE $SWEEP_REL — dry-run discipline broken"
fi
rm -rf "$TE"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
