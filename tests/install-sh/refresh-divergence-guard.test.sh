#!/usr/bin/env bash
# refresh-divergence-guard.test.sh — consumer-refresh-integrity R1 (issue 1481, casualties 1+3).
#
# The refresh path used to overwrite a consumer-modified delivered file SILENTLY. R1 adds the
# consumer-local baseline manifest ($PROJECT_ROOT/.ai-factory/refresh-baseline.json, sha256 per
# delivered dst path, written on every copy_safe/refresh_safe delivery) and a warn+preserve
# guard inside refresh_safe (setup.d/lib.sh): sha256(dst) != manifest entry AND != sha256(src)
# → preserve the diverged bytes to .ai-factory/refresh-conflicts/<basename>.<sha8>, print a
# loud warning, refresh anyway. Never refuse; a missing manifest entry is unknown → silent
# (kickoff RI-1/RI-2, decisions already made — this file only pins them).
#
# The five arms are the kickoff §2 R1 floor (T14: a green suite with a missing arm is
# "coverage insufficient", not "guard correct"). Acceptance is behavioural (T2/T-CRI-A):
# each arm runs a REAL install into a mktemp fixture, then a real --refresh, and asserts the
# install OUTPUT, the preserved file BYTES, and the refreshed file BYTES — never a grep of
# install.sh's own source text.
#
#   (a) install → mutate a delivered file → refresh → warning printed + preserved copy at
#       .ai-factory/refresh-conflicts/<basename>.<sha8> with the mutated bytes + file
#       refreshed to the as-installed bytes.
#   (b) untouched delivered file → refresh → NO warning, NO conflicts dir (also the transform
#       false-positive probe: agents/hooks are post-delivery-transformed, so a baseline hashed
#       at copy time instead of flush time would spam here).
#   (c) pre-manifest consumer (manifest deleted) → refresh → ZERO divergence claims
#       (T-CRI-B: unknown != diverged, no first-refresh spam); paired-negative: after the
#       refresh heals the manifest, the SAME mutation DOES warn.
#   (d) .override.md file → unchanged Layer-3 skip path: no conflict copy, no warning for it,
#       while a second mutated file WITHOUT the override is guarded in the same run.
#   (e) --dry-run lists `would-flag` for the diverged file and writes nothing (no manifest
#       change, no conflicts dir, file untouched); paired-negative: the real refresh right
#       after DOES warn — the preview predicted a real divergence.
#
# Portability: bash 3.2, no GNU-only flags. Test strings match stable ASCII substrings only
# (`overwriting locally-modified file:`, `would-flag:`) — the shipped warning carries a
# literal UTF-8 warning glyph and var-adjacent UTF-8 has crashed bash 3.2/BSD tr in tests
# twice (PR 1495, PR 1497). Harness shape mirrors consumer-upgrade-path.test.sh.
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

# The probe file: delivered at install via copy_safe AND re-delivered by do_refresh via
# refresh_safe, never post-transformed (a pure file payload) — the cleanest divergence
# specimen. The B1 carrier scripts are deliberately NOT used as probes (W-RI-1: no R-stage
# edit may touch their semantics; this test only ever runs the generic installer).
PROBE_REL=".claude/hooks/deps-hash-check.sh"
# Control file for arm (d): same delivery verbs, never overridden in that arm.
CTRL_REL=".claude/hooks/end-of-turn-reminder.sh"

# make_consumer — minimal consumer + full ts-server install (non-interactive: stdin closed).
make_consumer() {
  local T
  T=$(mktemp -d)
  printf '{ "name":"consumer","version":"0.0.0" }\n' > "$T/package.json"
  ( cd "$T" && git init -q && bash "$REPO_ROOT/install.sh" ts-server < /dev/null ) >/dev/null 2>&1
  echo "$T"
}

MANIFEST_REL=".ai-factory/refresh-baseline.json"
CONFLICTS_REL=".ai-factory/refresh-conflicts"

# ══════════════════════════════════════════════════════════════════════════════
# ARM (a) — diverged file: warning + preserved copy + refreshed to upstream bytes
# ══════════════════════════════════════════════════════════════════════════════
TCA=$(make_consumer)
PROBE_A="$TCA/$PROBE_REL"
if [ ! -f "$PROBE_A" ] || [ ! -f "$TCA/$MANIFEST_REL" ]; then
  bad "arm (a) precondition: install did not deliver $PROBE_REL and/or $MANIFEST_REL"
else
  ok "arm (a) precondition: install delivered the probe file and wrote $MANIFEST_REL"
  # The manifest must carry an entry for the probe — else the guard is unknown-by-default
  # and arm (a) below would pass vacuously through the (c) path.
  ENTRY_A=$(jq -r --arg k "$PROBE_REL" 'if has($k) then .[$k] else "" end' "$TCA/$MANIFEST_REL")
  if [ -n "$ENTRY_A" ]; then
    ok "arm (a) precondition: manifest carries a baseline entry for $PROBE_REL"
  else
    bad "arm (a) precondition: NO manifest entry for $PROBE_REL — the baseline never recorded the delivery"
  fi

  cp "$PROBE_A" /tmp/r1dg-fresh-a.$$          # as-installed bytes (the refresh target)
  printf 'CONSUMER_DIVERGENCE_MARKER_ARM_A\n' > "$PROBE_A"
  cp "$PROBE_A" /tmp/r1dg-mut-a.$$            # diverged bytes (what must be preserved)
  SHA8_A=$(hash256 "$PROBE_A"); SHA8_A="${SHA8_A:0:8}"

  OUT_A=$( cd "$TCA" && bash "$REPO_ROOT/install.sh" --refresh < /dev/null 2>&1 )

  # Output: the warning names the dst and the preserved path (ASCII substring + path probe).
  if printf '%s\n' "$OUT_A" | grep -qF 'overwriting locally-modified file:' \
    && printf '%s\n' "$OUT_A" | grep -qF "$PROBE_A"; then
    ok "arm (a): warning printed for the diverged file (names the dst and the preserved copy)"
  else
    bad "arm (a): warning NOT printed for the diverged $PROBE_REL (guard did not fire)"
  fi

  # Preserved copy: exact <basename>.<sha8> shape, carrying the diverged bytes.
  PRES_A="$TCA/$CONFLICTS_REL/deps-hash-check.sh.$SHA8_A"
  if [ -f "$PRES_A" ]; then
    if cmp -s "$PRES_A" /tmp/r1dg-mut-a.$$; then
      ok "arm (a): preserved copy exists at $CONFLICTS_REL/deps-hash-check.sh.$SHA8_A with the exact diverged bytes"
    else
      bad "arm (a): preserved copy exists but its bytes differ from the diverged content"
    fi
  else
    bad "arm (a): NO preserved copy at $CONFLICTS_REL/deps-hash-check.sh.$SHA8_A (consumer edit lost silently)"
  fi

  # Live file: refreshed to the as-installed bytes (warn + preserve, then refresh anyway).
  if cmp -s "$PROBE_A" /tmp/r1dg-fresh-a.$$; then
    ok "arm (a): live file refreshed to the as-installed bytes (guard warned but did not refuse)"
  else
    bad "arm (a): live file is neither the diverged copy nor the as-installed bytes"
  fi

  # neg (LOAD-BEARING): without --refresh the mutation persists — proves the refresh did the
  # overwrite the guard annotates (assertion non-vacuous).
  TCAn=$(make_consumer)
  printf 'CONSUMER_DIVERGENCE_MARKER_ARM_A\n' > "$TCAn/$PROBE_REL"
  if grep -qF 'CONSUMER_DIVERGENCE_MARKER_ARM_A' "$TCAn/$PROBE_REL"; then
    ok "arm (a) neg: without --refresh the mutation persists (refresh was the actor, not time)"
  else
    bad "arm (a) neg: mutation vanished without --refresh — arm (a) was vacuous"
  fi
  rm -rf "$TCAn" /tmp/r1dg-fresh-a.$$ /tmp/r1dg-mut-a.$$
fi
rm -rf "$TCA"

# ══════════════════════════════════════════════════════════════════════════════
# ARM (b) — untouched file: NO warning, NO conflicts dir (first-refresh-spam probe)
# ══════════════════════════════════════════════════════════════════════════════
TCB=$(make_consumer)
OUT_B=$( cd "$TCB" && bash "$REPO_ROOT/install.sh" --refresh < /dev/null 2>&1 )
if printf '%s\n' "$OUT_B" | grep -qF 'overwriting locally-modified file:'; then
  bad "arm (b): untouched consumer got divergence claim(s) — first-refresh spam (T-CRI-B): $(printf '%s\n' "$OUT_B" | grep -cF 'overwriting locally-modified file:')"
else
  ok "arm (b): untouched consumer, refresh → ZERO divergence claims"
fi
if [ -e "$TCB/$CONFLICTS_REL" ]; then
  bad "arm (b): $CONFLICTS_REL/ created although nothing diverged"
else
  ok "arm (b): no $CONFLICTS_REL/ dir (conflicts dir is created only by an actual divergence)"
fi
# neg (LOAD-BEARING): the same run must show real refresh activity — an output with no
# refresh lines at all would make the absence-of-warning meaningless (vacuous pass).
if printf '%s\n' "$OUT_B" | grep -qF '(refreshed)'; then
  ok "arm (b) neg: the refresh run did deliver files ($(printf '%s\n' "$OUT_B" | grep -cF '(refreshed)') refresh lines) — the zero-warning claim is a real verdict"
else
  bad "arm (b) neg: no refresh activity found in the output — the absence of warnings is vacuous"
fi
rm -rf "$TCB"

# ══════════════════════════════════════════════════════════════════════════════
# ARM (c) — pre-manifest consumer: unknown ≠ diverged, zero claims
# ══════════════════════════════════════════════════════════════════════════════
TCC=$(make_consumer)
rm -f "$TCC/$MANIFEST_REL"
printf 'CONSUMER_DIVERGENCE_MARKER_ARM_C\n' > "$TCC/$PROBE_REL"
OUT_C=$( cd "$TCC" && bash "$REPO_ROOT/install.sh" --refresh < /dev/null 2>&1 )
if printf '%s\n' "$OUT_C" | grep -qF 'overwriting locally-modified file:'; then
  bad "arm (c): pre-manifest consumer got divergence claim(s) — a missing entry must be unknown, not diverged"
else
  ok "arm (c): manifest deleted → refresh makes ZERO divergence claims (unknown = today's behaviour)"
fi
if [ -e "$TCC/$CONFLICTS_REL" ]; then
  bad "arm (c): $CONFLICTS_REL/ created for a pre-manifest consumer"
else
  ok "arm (c): no conflicts dir for a pre-manifest consumer"
fi
# neg (LOAD-BEARING): the SAME consumer, now that the refresh healed the manifest, must warn
# on a NEW mutation — proving arm (c)'s silence was the unknown-entry path, not a dead guard.
if [ -f "$TCC/$MANIFEST_REL" ]; then
  ok "arm (c) neg precondition: refresh re-wrote the manifest (baseline healed)"
  printf 'CONSUMER_DIVERGENCE_MARKER_ARM_C2\n' > "$TCC/$PROBE_REL"
  OUT_C2=$( cd "$TCC" && bash "$REPO_ROOT/install.sh" --refresh < /dev/null 2>&1 )
  if printf '%s\n' "$OUT_C2" | grep -qF 'overwriting locally-modified file:' \
    && printf '%s\n' "$OUT_C2" | grep -qF "$PROBE_REL"; then
    ok "arm (c) neg: with a baseline present the same mutation DOES warn (arm c silence was the unknown path)"
  else
    bad "arm (c) neg: guard stayed silent even with a healed manifest — it is dead, and arm (c) proved nothing"
  fi
else
  bad "arm (c) neg precondition: refresh did NOT re-write the manifest — baseline write path broken"
fi
rm -rf "$TCC"

# ══════════════════════════════════════════════════════════════════════════════
# ARM (d) — .override.md: unchanged Layer-3 skip path, no conflict copy
# ══════════════════════════════════════════════════════════════════════════════
TCD=$(make_consumer)
PROBE_D="$TCD/$PROBE_REL"
CTRL_D="$TCD/$CTRL_REL"
printf '# consumer override — Layer 3\n' > "$PROBE_D.override.md"
printf 'CONSUMER_DIVERGENCE_MARKER_ARM_D\n' > "$PROBE_D"
printf 'CONSUMER_DIVERGENCE_MARKER_ARM_D\n' > "$CTRL_D"
OUT_D=$( cd "$TCD" && bash "$REPO_ROOT/install.sh" --refresh < /dev/null 2>&1 )
if grep -qF 'CONSUMER_DIVERGENCE_MARKER_ARM_D' "$PROBE_D"; then
  ok "arm (d): overridden file kept its consumer bytes (.override.md skip path unchanged)"
else
  bad "arm (d): overridden file was clobbered despite .override.md"
fi
if printf '%s\n' "$OUT_D" | grep -F 'overwriting locally-modified file:' | grep -qF "deps-hash-check.sh"; then
  bad "arm (d): the override skip path emitted a divergence warning for the overridden file"
else
  ok "arm (d): no divergence warning for the overridden file (skip happens before the guard)"
fi
if printf '%s\n' "$OUT_D" | grep -qF '.override.md'; then
  ok "arm (d): the override skip line is still announced in the output"
else
  bad "arm (d): the .override.md skip announcement vanished from the refresh output"
fi
D_CONFLICT_FOUND=""
for _df in "$TCD/$CONFLICTS_REL"/deps-hash-check.sh.*; do
  [ -e "$_df" ] && D_CONFLICT_FOUND=1
done
if [ -n "$D_CONFLICT_FOUND" ]; then
  bad "arm (d): a conflict copy was preserved for the OVERRIDDEN file (skip must not preserve)"
else
  ok "arm (d): no conflict copy for the overridden file"
fi
# neg (LOAD-BEARING): the control file — same run, same mutation, NO override — must be
# warned + refreshed: proves the run was live and the skip is the override's doing.
if printf '%s\n' "$OUT_D" | grep -F 'overwriting locally-modified file:' | grep -qF "end-of-turn-reminder.sh" \
  && ! grep -qF 'CONSUMER_DIVERGENCE_MARKER_ARM_D' "$CTRL_D"; then
  ok "arm (d) neg: the non-overridden control file WAS guarded + refreshed in the same run (skip is the override's doing)"
else
  bad "arm (d) neg: control file not guarded in the same run — arm (d) cannot distinguish skip from a no-op refresh"
fi
rm -rf "$TCD"

# ══════════════════════════════════════════════════════════════════════════════
# ARM (e) — --dry-run: would-flag listed, NOTHING written
# ══════════════════════════════════════════════════════════════════════════════
TCE=$(make_consumer)
PROBE_E="$TCE/$PROBE_REL"
printf 'CONSUMER_DIVERGENCE_MARKER_ARM_E\n' > "$PROBE_E"
MAN_E_BEFORE=$(mktemp)
cp "$TCE/$MANIFEST_REL" "$MAN_E_BEFORE"
OUT_E=$( cd "$TCE" && bash "$REPO_ROOT/install.sh" --refresh --dry-run < /dev/null 2>&1 )
if printf '%s\n' "$OUT_E" | grep -qF 'would-flag:' && printf '%s\n' "$OUT_E" | grep -F 'would-flag:' | grep -qF 'deps-hash-check.sh'; then
  ok "arm (e): --dry-run reports would-flag for the diverged file"
else
  bad "arm (e): --dry-run did not report would-flag for the diverged file"
fi
if grep -qF 'CONSUMER_DIVERGENCE_MARKER_ARM_E' "$PROBE_E"; then
  ok "arm (e): the diverged file was NOT written by --dry-run"
else
  bad "arm (e): --dry-run overwrote the diverged file (dry-run must write nothing)"
fi
if cmp -s "$TCE/$MANIFEST_REL" "$MAN_E_BEFORE"; then
  ok "arm (e): manifest bytes unchanged by --dry-run"
else
  bad "arm (e): --dry-run changed the manifest (dry-run must write nothing)"
fi
if [ ! -e "$TCE/$CONFLICTS_REL" ]; then
  ok "arm (e): no conflicts dir created by --dry-run"
else
  bad "arm (e): --dry-run created $CONFLICTS_REL/"
fi
# neg (LOAD-BEARING): the real refresh right after DOES warn for the same divergence —
# the would-flag line predicted a real divergence, not a cosmetic string.
OUT_E2=$( cd "$TCE" && bash "$REPO_ROOT/install.sh" --refresh < /dev/null 2>&1 )
if printf '%s\n' "$OUT_E2" | grep -qF 'overwriting locally-modified file:' \
  && printf '%s\n' "$OUT_E2" | grep -F 'overwriting locally-modified file:' | grep -qF 'deps-hash-check.sh'; then
  ok "arm (e) neg: the real refresh warns for exactly the file --dry-run would-flagged (preview is faithful)"
else
  bad "arm (e) neg: real refresh did not warn — the would-flag predicted nothing real"
fi
rm -rf "$TCE" "$MAN_E_BEFORE"

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
