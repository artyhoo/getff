#!/usr/bin/env bash
# deliver-gate-scripts.test.sh — consumer-refresh-integrity R3 (issues 1482 + 1485).
#
# Two gate scripts were authored but NEVER delivered to consumers:
#   scripts/check-ask-files.sh   — presence-gated by pre-push.ts askFileSchemaSection()
#                                  (silently returns when absent → the gate never fires);
#   scripts/run-local-ci-sweep.sh — gated on by .claude/skills/harvest/SKILL.md §3 (ships at
#                                  factory / --with-aif-suite depth only).
# R3 delivers both per kickoff RI-4's measured breadth: check-ask-files via the hooks layer
# (setup.d/50-hooks.sh — every standard npm profile), run-local-ci-sweep via the factory suite
# arm (setup.d/10-skills.sh), each mirrored in do_refresh (pair-list entry + gated refresh arm).
# Sources stay at root scripts/ — RI-4 binding (relocation would violate the session-bus v2 §9
# claim recorded in packages/core/hooks/pre-push.ts:1323-1326).
#
# Arms (kickoff §2 R3 + dispatch WHAT-TO-CHANGE 2; T14 floor):
#   (a) fresh install, standard profile → check-ask-files.sh present + executable;
#       --with-aif-suite install → run-local-ci-sweep.sh present + executable.
#   (b) T-CRI-C acceptance (constructible form): install → mutate the delivered script →
#       --refresh → R1 `⚠` warning + preserved copy in .ai-factory/refresh-conflicts/ +
#       live file refreshed (a consumer that vendored the script AFTER this delivery is
#       never silently swapped — issue 1485's own precondition).
#   (b2) PRE-VENDORED case (measured, pinned — the timeliner case: the script existed BEFORE
#       this delivery, so the R1 manifest has no entry → RI-2 "unknown"): fresh-install path
#       copy_safe SKIPS the pre-existing file (silent skip, consumer copy kept); refresh path
#       with NO manifest entry overwrites silently. This is the ratified RI-2 consequence,
#       pinned here as behaviour so any future change is a deliberate decision, not drift.
#   (c) negative arms per the measured breadth: python toolchain lane → check-ask-files NOT
#       delivered (no pre-push arm on non-npm lanes); profile=env → run-local-ci-sweep NOT
#       delivered (harvest is factory-gated).
#   (d) do_refresh mirror for run-local-ci-sweep: factory install → mutate → --refresh →
#       warning + preserved copy + refreshed (the gated refresh arm incl. presence clause).
#   (e) --dry-run of the new delivery lines: `[dry-run] would copy:` output for both scripts,
#       and NOTHING written to the fixture.
#
# NOT here (evidence-only on R3, per dispatch): the npm-tarball probe — root scripts/ is not
# in the packages/core `files` allowlist (measured via the npm-tarball probe target;
# 0 scripts/ entries in the 500-file tarball) → parked DECISION-NEEDED, not relocated.
#
# Acceptance is behavioural (T2/T-CRI-A): every arm runs the REAL installer into a mktemp
# fixture and asserts the installed tree / installer OUTPUT — never a grep of install.sh's
# own source text. Harness shape mirrors refresh-divergence-guard.test.sh (bash 3.2, ASCII
# substrings only for the UTF-8-glyph warning line).
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
# ARM (a) — fresh install delivers both scripts, executable, at measured breadth
# ══════════════════════════════════════════════════════════════════════════════
TA=$(make_consumer)
if [ -f "$TA/$ASK_REL" ]; then
  ok "arm (a): $ASK_REL delivered on a standard-profile fresh install"
else
  bad "arm (a): $ASK_REL MISSING on a standard-profile fresh install (pre-push ask-gate stays dead — issue 1482 unfixed)"
fi
if [ -x "$TA/$ASK_REL" ]; then
  ok "arm (a): $ASK_REL is executable"
else
  bad "arm (a): $ASK_REL is NOT executable"
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
# Paired sanity: the suite install still carries the (ungated) ask script too.
[ -f "$TA2/$ASK_REL" ] && ok "arm (a): $ASK_REL also present on the suite install" \
                       || bad "arm (a): $ASK_REL MISSING on the suite install"

# ══════════════════════════════════════════════════════════════════════════════
# ARM (b) — T-CRI-C acceptance: post-delivery divergence → R1 warn + preserve + refresh
# ══════════════════════════════════════════════════════════════════════════════
TB=$(make_consumer)
PROBE_B="$TB/$ASK_REL"
if [ ! -f "$PROBE_B" ] || [ ! -f "$TB/$MANIFEST_REL" ]; then
  bad "arm (b) precondition: install did not deliver $ASK_REL and/or $MANIFEST_REL"
else
  ok "arm (b) precondition: install delivered the script and wrote the baseline manifest"
  ENTRY_B=$(jq -r --arg k "$ASK_REL" 'if has($k) then .[$k] else "" end' "$TB/$MANIFEST_REL")
  [ -n "$ENTRY_B" ] && ok "arm (b) precondition: manifest carries a baseline entry for $ASK_REL" \
                    || bad "arm (b) precondition: NO manifest entry for $ASK_REL — the delivery never staged"

  cp "$PROBE_B" /tmp/r3dg-fresh-b.$$          # as-installed bytes (the refresh target)
  printf 'CONSUMER_DIVERGENCE_MARKER_R3_ARM_B\n' > "$PROBE_B"
  cp "$PROBE_B" /tmp/r3dg-mut-b.$$            # diverged bytes (what must be preserved)
  SHA8_B=$(hash256 "$PROBE_B"); SHA8_B="${SHA8_B:0:8}"

  OUT_B=$( cd "$TB" && bash "$REPO_ROOT/install.sh" --refresh < /dev/null 2>&1 )

  if printf '%s\n' "$OUT_B" | grep -qF 'overwriting locally-modified file:' \
    && printf '%s\n' "$OUT_B" | grep -qF "$PROBE_B"; then
    ok "arm (b): R1 warning printed for the diverged $ASK_REL (names the dst + preserved copy)"
  else
    bad "arm (b): NO warning for the diverged $ASK_REL (silent swap — T-CRI-C acceptance failed)"
  fi

  PRES_B="$TB/$CONFLICTS_REL/check-ask-files.sh.$SHA8_B"
  if [ -f "$PRES_B" ] && cmp -s "$PRES_B" /tmp/r3dg-mut-b.$$; then
    ok "arm (b): preserved copy at $CONFLICTS_REL/check-ask-files.sh.$SHA8_B carries the exact diverged bytes"
  else
    bad "arm (b): preserved copy missing or bytes differ at $PRES_B (consumer edit lost silently)"
  fi

  if cmp -s "$PROBE_B" /tmp/r3dg-fresh-b.$$; then
    ok "arm (b): live file refreshed to the as-installed bytes (warn + preserve, then refresh)"
  else
    bad "arm (b): live file NOT refreshed to the upstream bytes"
  fi
  rm -f /tmp/r3dg-fresh-b.$$ /tmp/r3dg-mut-b.$$
fi
rm -rf "$TB"

# ══════════════════════════════════════════════════════════════════════════════
# ARM (b2) — PRE-VENDORED consumer (script existed BEFORE this delivery; RI-2 unknown)
# ══════════════════════════════════════════════════════════════════════════════
TB2=$(mktemp -d)
printf '{ "name":"pre-vendored","version":"0.0.0" }\n' > "$TB2/package.json"
( cd "$TB2" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force < /dev/null ) >/dev/null 2>&1
# Simulate the timeliner case: the consumer vendored the script BEFORE this delivery existed —
# remove the delivered copy AND its manifest entry, plant a consumer-authored diverged copy.
rm -f "$TB2/$ASK_REL"
jq --arg k "$ASK_REL" 'del(.[$k])' "$TB2/$MANIFEST_REL" > "$TB2/$MANIFEST_REL.tmp" 2>/dev/null \
  && mv "$TB2/$MANIFEST_REL.tmp" "$TB2/$MANIFEST_REL"
printf 'CONSUMER_VENDORED_COPY_R3\n' > "$TB2/$ASK_REL"
VEND_HASH=$(hash256 "$TB2/$ASK_REL")

# Path 1 — fresh-install (`--force` install again): copy_safe under --force overwrites; the
# plain re-install (no --force) is the skip-if-exists shape. Measure the plain re-install.
OUT_B2I=$( cd "$TB2" && bash "$REPO_ROOT/install.sh" ts-server < /dev/null 2>&1 )
CUR_HASH=$(hash256 "$TB2/$ASK_REL")
if [ "$CUR_HASH" = "$VEND_HASH" ]; then
  ok "arm (b2) fresh-install path: pre-vendored $ASK_REL KEPT (copy_safe skip-if-exists — consumer copy survives, RI-2 unknown ⇒ no divergence claim)"
elif printf '%s\n' "$OUT_B2I" | grep -qF 'overwriting locally-modified file:'; then
  ok "arm (b2) fresh-install path: pre-vendored copy overwritten WITH the R1 warning + preserve (guard fired)"
else
  bad "arm (b2) fresh-install path: pre-vendored $ASK_REL overwritten SILENTLY — behaviour drifted from the pinned RI-2 measurement (re-measure and re-pin)"
fi

# Path 2 — refresh on the same pre-vendored tree (still no manifest entry): refresh_safe
# overwrites with NO warning (unknown ≠ diverged — ratified RI-2 consequence, pinned here).
printf 'CONSUMER_VENDORED_COPY_R3\n' > "$TB2/$ASK_REL"
OUT_B2R=$( cd "$TB2" && bash "$REPO_ROOT/install.sh" --refresh < /dev/null 2>&1 )
UPSTREAM_HASH=$(hash256 "$REPO_ROOT/$ASK_REL")
CUR_HASH2=$(hash256 "$TB2/$ASK_REL")
if [ "$CUR_HASH2" = "$UPSTREAM_HASH" ]; then
  if printf '%s\n' "$OUT_B2R" | grep -qF 'overwriting locally-modified file:'; then
    ok "arm (b2) refresh path: pre-vendored copy overwritten WITH warning (guard now covers it — better than the pinned RI-2 measurement; re-pin)"
  else
    ok "arm (b2) refresh path: pre-vendored copy overwritten SILENTLY (pinned RI-2 consequence: no manifest entry ⇒ unknown ⇒ no divergence claim — follow-up candidate, see REPORT)"
  fi
else
  bad "arm (b2) refresh path: refresh did NOT deliver the upstream bytes over the pre-vendored copy — mirror broken"
fi
rm -rf "$TB2"

# ══════════════════════════════════════════════════════════════════════════════
# ARM (c) — negative breadth arms
# ══════════════════════════════════════════════════════════════════════════════
# (c1) python toolchain lane: no npm pre-push arm → check-ask-files NOT delivered.
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
[ -f "$TC2/$ASK_REL" ] && ok "arm (c): profile=env still delivers $ASK_REL (hooks arm is profile-ungated)" \
                       || bad "arm (c): profile=env MISSING $ASK_REL (hooks arm is profile-ungated)"
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
# ARM (e) — --dry-run announces the new delivery lines and writes nothing
# ══════════════════════════════════════════════════════════════════════════════
TE=$(mktemp -d)
printf '{ "name":"dryrun","version":"0.0.0" }\n' > "$TE/package.json"
( cd "$TE" && git init -q ) >/dev/null 2>&1
OUT_E=$( cd "$TE" && bash "$REPO_ROOT/install.sh" ts-server --dry-run < /dev/null 2>&1 )
if printf '%s\n' "$OUT_E" | grep -qF "[dry-run] would copy:" && printf '%s\n' "$OUT_E" | grep -qF "scripts/check-ask-files.sh"; then
  ok "arm (e): dry-run announces the check-ask-files delivery (would-copy line)"
else
  bad "arm (e): dry-run does NOT announce the check-ask-files delivery"
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
