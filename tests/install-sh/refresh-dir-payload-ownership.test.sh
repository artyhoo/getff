#!/usr/bin/env bash
# refresh-dir-payload-ownership.test.sh — ledger #1597 L-4.
#
# The R1 divergence guard (#1503, built for issue 1481 «refresh overwrote consumer-modified files
# silently») was bolted onto refresh_safe's FILE path only, and said so in its own header: «FILES
# ONLY. Directory payloads … stage nothing and are never flagged». refresh_safe's directory arm
# was still `rm -rf "$dst"; cp -r "$src" "$dst"`, so for every directory payload — the fences-fire
# fixtures (install.sh) and the runtime-bridge vendor tree — the issue-1481 casualty was
# GUARANTEED, not merely possible: a consumer file under the tree was deleted with no
# .ai-factory/refresh-conflicts/ copy, no warning, and no --dry-run preview.
#
# The contract this file pins: the directory arm walks files and routes each through the SAME
# per-file decision the file arm makes (override → divergence → preserve → refresh → stage), and
# it deletes a destination file only when the refresh-baseline manifest attributes that path to
# the framework. Unattributed (consumer-authored, or predating the manifest) is left alone —
# keeping a file is reversible, deleting it is not.
#
# Acceptance is behavioural (T2/T3): arms 1-3 run a REAL install + --refresh into mktemp
# consumers and assert on-disk bytes and installer output. Arm 4 drives refresh_safe directly
# with a hand-written manifest, because «the framework stopped shipping this file» cannot be
# staged from the real tree without mutating the framework's own sources.
#
# Portability: bash 3.2, no GNU-only flags, ASCII substrings only in greps (var-adjacent UTF-8
# has crashed bash 3.2/BSD tr in this suite twice — PR 1495, PR 1497).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

hash256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'
  else echo "NOHASH"; fi
}

# The directory payload under test: scripts/fences-fire-fixtures/, delivered by install.sh's
# do_refresh via refresh_safe on a plain `--refresh` at core depth (no profile gate), which makes
# it the cheapest live specimen of the class. Its framework probe file is picked at runtime so a
# fixture reshuffle cannot make this test vacuous.
DIR_REL="scripts/fences-fire-fixtures"
DIR_SRC="$REPO_ROOT/packages/core/audit-self/fixtures/fences-fire"
[ -d "$DIR_SRC" ] || { echo "FATAL: directory payload source absent: $DIR_SRC"; exit 1; }
# Picked from the INSTALLED tree, not from the source: generate_eslint_barrel prunes fixtures
# whose rule is not in this stack's barrel (setup.d/lib.sh), so a source-side pick can name a
# file the consumer never receives — which reads as a test failure instead of a bad probe.
fw_file_of() {
  ( cd "$1/$DIR_REL" 2>/dev/null && find . -type f | LC_ALL=C sort | head -1 | sed 's#^\./##' )
}

MANIFEST_REL=".ai-factory/refresh-baseline.json"
CONFLICTS_REL=".ai-factory/refresh-conflicts"

make_consumer() {
  local T
  T=$(mktemp -d)
  printf '{ "name":"consumer","version":"0.0.0" }\n' > "$T/package.json"
  ( cd "$T" && git init -q && bash "$REPO_ROOT/install.sh" ts-server < /dev/null ) >/dev/null 2>&1
  echo "$T"
}

# ══════════════════════════════════════════════════════════════════════════════
# ARM 1 — a consumer-AUTHORED file under a directory payload survives --refresh
# ══════════════════════════════════════════════════════════════════════════════
# This is the exact reproduction from the ledger: consumer adds their own fixture, `--refresh`
# printed a bare "(refreshed)" and the file was GONE with conflicts=no.
TC1=$(make_consumer)
if [ ! -d "$TC1/$DIR_REL" ]; then
  bad "arm 1 precondition: install did not deliver the $DIR_REL directory payload"
else
  ok "arm 1 precondition: install delivered the $DIR_REL directory payload"
  printf 'export const mine = 1;\n' > "$TC1/$DIR_REL/my-rule.bad.ts"
  OUT_1=$( cd "$TC1" && bash "$REPO_ROOT/install.sh" --refresh < /dev/null 2>&1 )
  if [ -f "$TC1/$DIR_REL/my-rule.bad.ts" ]; then
    ok "arm 1: consumer-authored file under the directory payload survived --refresh"
  else
    bad "arm 1: consumer-authored $DIR_REL/my-rule.bad.ts was DELETED by --refresh (issue-1481 class)"
  fi
  # neg (LOAD-BEARING): the same run must actually have refreshed the payload's framework files —
  # otherwise the survival above proves only that nothing happened.
  if printf '%s\n' "$OUT_1" | grep -qF "$DIR_REL"; then
    ok "arm 1 neg: the refresh run did touch the directory payload (survival is a real verdict)"
  else
    bad "arm 1 neg: no $DIR_REL activity in the refresh output — arm 1 is vacuous"
  fi
fi
rm -rf "$TC1"

# ══════════════════════════════════════════════════════════════════════════════
# ARM 2 — a MODIFIED framework file inside the payload is warned + preserved
# ══════════════════════════════════════════════════════════════════════════════
TC2=$(make_consumer)
FW_FILE=$(fw_file_of "$TC2")
[ -n "$FW_FILE" ] || { echo "FATAL: the installed $DIR_REL payload is empty — probe unavailable"; exit 1; }
PROBE_2="$TC2/$DIR_REL/$FW_FILE"
if [ ! -f "$PROBE_2" ] || [ ! -f "$TC2/$MANIFEST_REL" ]; then
  bad "arm 2 precondition: missing $DIR_REL/$FW_FILE and/or $MANIFEST_REL after install"
else
  cp "$PROBE_2" /tmp/l4-fresh-2.$$
  printf 'CONSUMER_DIR_PAYLOAD_EDIT_ARM_2\n' > "$PROBE_2"
  SHA8_2=$(hash256 "$PROBE_2"); SHA8_2="${SHA8_2:0:8}"
  OUT_2=$( cd "$TC2" && bash "$REPO_ROOT/install.sh" --refresh < /dev/null 2>&1 )

  if printf '%s\n' "$OUT_2" | grep -F 'overwriting locally-modified file:' | grep -qF "$FW_FILE"; then
    ok "arm 2: divergence warning printed for a modified file INSIDE a directory payload"
  else
    bad "arm 2: no divergence warning for $DIR_REL/$FW_FILE — the guard still exempts directory payloads"
  fi
  PRES_2="$TC2/$CONFLICTS_REL/$(basename "$FW_FILE").$SHA8_2"
  if [ -f "$PRES_2" ] && grep -qF 'CONSUMER_DIR_PAYLOAD_EDIT_ARM_2' "$PRES_2"; then
    ok "arm 2: the diverged bytes were preserved under $CONFLICTS_REL/"
  else
    bad "arm 2: NO refresh-conflicts copy for the modified file under the directory payload"
  fi
  if cmp -s "$PROBE_2" /tmp/l4-fresh-2.$$; then
    ok "arm 2: the file was refreshed to the as-installed bytes (warn + preserve, never refuse)"
  else
    bad "arm 2: the file is neither the diverged copy nor the as-installed bytes"
  fi
  rm -f /tmp/l4-fresh-2.$$
fi
rm -rf "$TC2"

# ══════════════════════════════════════════════════════════════════════════════
# ARM 3 — --dry-run previews the flag, writes nothing; and an untouched consumer
#         gets ZERO divergence claims for the payload (no first-refresh spam)
# ══════════════════════════════════════════════════════════════════════════════
TC3=$(make_consumer)
PROBE_3="$TC3/$DIR_REL/$FW_FILE"
MAN_3_BEFORE=$(mktemp)
cp "$TC3/$MANIFEST_REL" "$MAN_3_BEFORE"
printf 'CONSUMER_DIR_PAYLOAD_EDIT_ARM_3\n' > "$PROBE_3"
OUT_3=$( cd "$TC3" && bash "$REPO_ROOT/install.sh" --refresh --dry-run < /dev/null 2>&1 )
if printf '%s\n' "$OUT_3" | grep -F 'would-flag:' | grep -qF "$FW_FILE"; then
  ok "arm 3: --dry-run reports would-flag for a diverged file inside a directory payload"
else
  bad "arm 3: --dry-run gave no would-flag for the directory payload (preview blind to the class)"
fi
if grep -qF 'CONSUMER_DIR_PAYLOAD_EDIT_ARM_3' "$PROBE_3"; then
  ok "arm 3: --dry-run wrote nothing inside the directory payload"
else
  bad "arm 3: --dry-run mutated the directory payload"
fi
if cmp -s "$TC3/$MANIFEST_REL" "$MAN_3_BEFORE"; then
  ok "arm 3: manifest bytes unchanged by --dry-run"
else
  bad "arm 3: --dry-run changed the manifest"
fi
rm -f "$MAN_3_BEFORE"
rm -rf "$TC3"

TC3b=$(make_consumer)
OUT_3b=$( cd "$TC3b" && bash "$REPO_ROOT/install.sh" --refresh < /dev/null 2>&1 )
if printf '%s\n' "$OUT_3b" | grep -F 'overwriting locally-modified file:' | grep -qF "$DIR_REL"; then
  bad "arm 3b: untouched consumer got divergence claims for the directory payload (first-refresh spam)"
else
  ok "arm 3b: untouched consumer, refresh → ZERO divergence claims for the directory payload"
fi
N_BEFORE_3b=$(find "$TC3b/$DIR_REL" -type f 2>/dev/null | wc -l | tr -d ' ')
if [ -d "$TC3b/$DIR_REL" ] && [ -f "$TC3b/$DIR_REL/$FW_FILE" ] && [ "$N_BEFORE_3b" -gt 0 ]; then
  ok "arm 3b: the payload is still fully delivered after the refresh ($N_BEFORE_3b files; walk did not lose any)"
else
  bad "arm 3b: the directory payload lost files during a clean refresh (found $N_BEFORE_3b)"
fi
if [ ! -e "$TC3b/$DIR_REL/$(basename "$DIR_SRC")" ]; then
  ok "arm 3b: no nested $DIR_REL/$(basename "$DIR_SRC") (the #873 nesting defect stays closed)"
else
  bad "arm 3b: the payload nested into itself — #873 regressed"
fi
rm -rf "$TC3b"

# ══════════════════════════════════════════════════════════════════════════════
# ARM 4 — deletion is manifest-driven: framework-attributed stale file goes,
#         unattributed consumer file stays
# ══════════════════════════════════════════════════════════════════════════════
# Driven at the lib level: «the framework stopped shipping X» cannot be produced from the real
# tree without editing the framework's own sources.
PROJECT_ROOT=$(mktemp -d)
PKG_ROOT="$REPO_ROOT"
FORCE=""
DRY_RUN=""
SKIPPED=()
INSTALL_SH_LIB_ONLY=1
# shellcheck disable=SC1090
source "$REPO_ROOT/setup.d/lib.sh"

S4="$PROJECT_ROOT/src"; D4="$PROJECT_ROOT/payload"
mkdir -p "$S4" "$D4" "$PROJECT_ROOT/.ai-factory"
printf 'upstream\n' > "$S4/shipped.txt"
printf 'upstream-old\n' > "$D4/dropped.txt"      # framework used to ship it; manifest knows it
printf 'consumer-own\n'  > "$D4/mine.txt"        # never delivered by us; manifest does not
printf 'old\n' > "$D4/shipped.txt"
DROPPED_HASH=$(hash256 "$D4/dropped.txt")
printf '{ "payload/dropped.txt": "%s" }\n' "$DROPPED_HASH" > "$PROJECT_ROOT/$MANIFEST_REL"

refresh_safe "$S4" "$D4" >/dev/null 2>&1

if [ ! -e "$D4/dropped.txt" ]; then
  ok "arm 4: a stale file the manifest attributes to the framework IS removed"
else
  bad "arm 4: framework-attributed stale file survived — the payload never converges on upstream"
fi
if [ -f "$D4/mine.txt" ] && grep -qF 'consumer-own' "$D4/mine.txt"; then
  ok "arm 4: an unattributed file is treated as consumer-owned and kept"
else
  bad "arm 4: unattributed consumer file was deleted — deletion is still shape-based, not manifest-based"
fi
if [ "$(cat "$D4/shipped.txt" 2>/dev/null)" = "upstream" ]; then
  ok "arm 4: still-shipped files are refreshed to upstream bytes"
else
  bad "arm 4: the payload was not refreshed at all — arm 4's deletion verdicts are vacuous"
fi
rm -rf "$PROJECT_ROOT"

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
