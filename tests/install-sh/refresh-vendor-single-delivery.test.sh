#!/usr/bin/env bash
# refresh-vendor-single-delivery.test.sh — ledger #1597 A1-1 + S-7.
#
# A1-1: do_refresh delivered .claude/vendor/runtime-bridge TWICE. The first arm went through
# refresh_safe and honoured the Layer-3 `.override.md` escape ("⊝ … keeping"); a second arm then
# called deliver_runtime_bridge_vendor, whose body was an unconditional `rm -rf "$dst"; cp -r`
# with no override check and no divergence guard. Net effect on a consumer who had claimed the
# vendor tree: arm 1 announced "keeping", arm 2 destroyed the edits and every consumer-only file
# under the tree, and the closing banner still claimed override files were preserved. `--dry-run`
# skipped arm 2 entirely, so the preview never showed the wipe it was previewing.
#
# S-7: that second arm was the 7th copy of the same wipe/copy/transform-md loop (setup.d/lib.sh
# ×3, setup.d/45-python.sh, install.sh, setup.d/10-skills.sh ×2) and the only NUL-unsafe one
# (`find -type f | read -r` vs the `-print0 | read -d ''` the skill copies use).
#
# Acceptance is behavioural (T2/T3): every arm runs a REAL --refresh against a mktemp consumer and
# asserts on-disk BYTES and installer OUTPUT. The one structural arm (arm 5) is an anti-drift gate
# on the dedup itself — the only mechanically checkable form of "there is exactly one copy".
#
# Portability: bash 3.2, no GNU-only flags; ASCII substrings only in greps (var-adjacent UTF-8 has
# crashed bash 3.2/BSD tr in this suite twice — PR 1495, PR 1497). Harness shape mirrors
# tests/install-sh/refresh-divergence-guard.test.sh.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

VENDOR_SRC="$REPO_ROOT/packages/runtime-bridge/vendor"
VENDOR_REL=".claude/vendor/runtime-bridge"
[ -d "$VENDOR_SRC" ] || { echo "FATAL: vendor source absent: $VENDOR_SRC"; exit 1; }

# A framework file inside the vendor tree, used as the divergence specimen. Picked from the
# source at runtime so a vendor reshuffle cannot silently make this test vacuous.
PROBE_VENDOR_REL=$(cd "$VENDOR_SRC" && find . -type f -name '*.sh' | head -1 | sed 's#^\./##')
[ -n "$PROBE_VENDOR_REL" ] || { echo "FATAL: no *.sh file in $VENDOR_SRC to use as a probe"; exit 1; }

# make_consumer — minimal consumer + core install, then a PRE-EXISTING vendor drop. Presence on
# disk is exactly what do_refresh's vendor gate treats as "this consumer opted into the bridge"
# (install.sh: PROFILE=factory || WITH_AIF_SUITE || the dir exists), so this reproduces a factory
# consumer's refresh without running the factory profile's guided-install prompt.
make_consumer() {
  local T
  T=$(mktemp -d)
  printf '{ "name":"consumer","version":"0.0.0" }\n' > "$T/package.json"
  ( cd "$T" && git init -q && bash "$REPO_ROOT/install.sh" ts-server < /dev/null ) >/dev/null 2>&1
  mkdir -p "$T/.claude/vendor"
  cp -r "$VENDOR_SRC" "$T/$VENDOR_REL"
  echo "$T"
}

# ══════════════════════════════════════════════════════════════════════════════
# ARM 1 — .override.md on the vendor DIRECTORY: consumer bytes survive --refresh
# ══════════════════════════════════════════════════════════════════════════════
TC1=$(make_consumer)
printf '# consumer override — Layer 3 (whole vendor tree)\n' > "$TC1/$VENDOR_REL.override.md"
printf 'CONSUMER_VENDOR_EDIT_ARM_1\n' > "$TC1/$VENDOR_REL/$PROBE_VENDOR_REL"
printf 'consumer-only\n' > "$TC1/$VENDOR_REL/my-local-note.md"
OUT_1=$( cd "$TC1" && bash "$REPO_ROOT/install.sh" --refresh < /dev/null 2>&1 )

if grep -qF 'CONSUMER_VENDOR_EDIT_ARM_1' "$TC1/$VENDOR_REL/$PROBE_VENDOR_REL" 2>/dev/null; then
  ok "arm 1: consumer edit under an .override.md'd vendor tree survived --refresh"
else
  bad "arm 1: consumer edit under $VENDOR_REL was overwritten despite $VENDOR_REL.override.md"
fi
if [ -f "$TC1/$VENDOR_REL/my-local-note.md" ]; then
  ok "arm 1: consumer-only file under the overridden vendor tree survived --refresh"
else
  bad "arm 1: consumer-only file under $VENDOR_REL was DELETED despite the .override.md"
fi
# The banner at the end of do_refresh promises exactly this; arm 1 is what makes it true.
if printf '%s\n' "$OUT_1" | grep -qF 'Files with a sibling .override.md were also preserved'; then
  ok "arm 1: the closing banner still makes the override-preserved promise (and now keeps it)"
else
  bad "arm 1: the override-preserved banner line vanished — update this probe or the banner"
fi
# neg (LOAD-BEARING): the SAME consumer WITHOUT the override must be refreshed in the same shape —
# proves arm 1's survival is the override's doing, not a dead vendor arm.
TC1n=$(make_consumer)
printf 'CONSUMER_VENDOR_EDIT_ARM_1\n' > "$TC1n/$VENDOR_REL/$PROBE_VENDOR_REL"
OUT_1n=$( cd "$TC1n" && bash "$REPO_ROOT/install.sh" --refresh < /dev/null 2>&1 )
if ! grep -qF 'CONSUMER_VENDOR_EDIT_ARM_1' "$TC1n/$VENDOR_REL/$PROBE_VENDOR_REL" 2>/dev/null; then
  ok "arm 1 neg: without the .override.md the same edit IS refreshed away (vendor arm is live)"
else
  bad "arm 1 neg: the vendor tree was not refreshed at all — arm 1 proves nothing"
fi
rm -rf "$TC1" "$TC1n"

# ══════════════════════════════════════════════════════════════════════════════
# ARM 2 — the single surviving delivery still applies transform_internal_refs
# ══════════════════════════════════════════════════════════════════════════════
# The duplicate arm A1-1 removes was ALSO the one that ran the markdown transform. Removing it
# without moving the transform onto the surviving arm would ship vendor/README.md's `](../../../…)`
# refs verbatim to a consumer, where they dangle and go red on the first pre-push lychee run
# (the 2026-08-17 CI incident deliver_runtime_bridge_vendor was created to close).
TC2=$(make_consumer)
# Plant the untransformed shape so the assertion cannot pass just because the source is clean.
VMD="$TC2/$VENDOR_REL/README.md"
printf 'see ](../../../README.md) and ](../../../.claude/rules/x.md)\n' > "$VMD"
OUT_2=$( cd "$TC2" && bash "$REPO_ROOT/install.sh" --refresh < /dev/null 2>&1 )
if [ -f "$VMD" ] && ! grep -qF '](../../../README.md)' "$VMD"; then
  ok "arm 2: the delivered vendor README carries the internal-ref transform after the refresh"
else
  bad "arm 2: vendor README still holds an untransformed up-dir ref — the transform was lost with the duplicate arm"
fi
if [ -f "$VMD" ] && grep -qF 'https://github.com/' "$VMD"; then
  ok "arm 2: the transform rewrote the up-dir refs to upstream blob URLs"
else
  bad "arm 2: no blob URL in the delivered vendor README — transform did not run"
fi
rm -rf "$TC2"

# ══════════════════════════════════════════════════════════════════════════════
# ARM 3 — --dry-run preview is FAITHFUL for the vendor tree
# ══════════════════════════════════════════════════════════════════════════════
# The old second arm was skipped under --dry-run, so the preview announced a skip while the real
# run wiped. This arm pins preview == reality on the override path.
TC3=$(make_consumer)
printf '# consumer override — Layer 3\n' > "$TC3/$VENDOR_REL.override.md"
printf 'CONSUMER_VENDOR_EDIT_ARM_3\n' > "$TC3/$VENDOR_REL/$PROBE_VENDOR_REL"
OUT_3=$( cd "$TC3" && bash "$REPO_ROOT/install.sh" --refresh --dry-run < /dev/null 2>&1 )
if printf '%s\n' "$OUT_3" | grep -F 'would skip' | grep -qF "$VENDOR_REL"; then
  ok "arm 3: --dry-run previews a SKIP for the overridden vendor tree"
else
  bad "arm 3: --dry-run did not preview the vendor-tree skip"
fi
if grep -qF 'CONSUMER_VENDOR_EDIT_ARM_3' "$TC3/$VENDOR_REL/$PROBE_VENDOR_REL" 2>/dev/null; then
  ok "arm 3: --dry-run wrote nothing under the vendor tree"
else
  bad "arm 3: --dry-run mutated the vendor tree"
fi
# neg (LOAD-BEARING): the REAL refresh right after must match the preview — skip, not wipe.
OUT_3r=$( cd "$TC3" && bash "$REPO_ROOT/install.sh" --refresh < /dev/null 2>&1 )
if grep -qF 'CONSUMER_VENDOR_EDIT_ARM_3' "$TC3/$VENDOR_REL/$PROBE_VENDOR_REL" 2>/dev/null; then
  ok "arm 3 neg: the real refresh did what --dry-run promised (preview is faithful)"
else
  bad "arm 3 neg: --dry-run promised a skip and the real refresh wiped the tree"
fi
printf '%s\n' "$OUT_3r" > /dev/null   # keep the capture explicit for future arms
rm -rf "$TC3"

# ══════════════════════════════════════════════════════════════════════════════
# ARM 4 — _copy_tree_with_transform: one helper, NUL-safe, replaces (not nests)
# ══════════════════════════════════════════════════════════════════════════════
PROJECT_ROOT="$REPO_ROOT"
PKG_ROOT="$REPO_ROOT"
FORCE=""
DRY_RUN=""
SKIPPED=()
INSTALL_SH_LIB_ONLY=1
# shellcheck disable=SC1090
source "$REPO_ROOT/setup.d/lib.sh"

if ! type _copy_tree_with_transform >/dev/null 2>&1; then
  bad "arm 4: _copy_tree_with_transform is not defined in setup.d/lib.sh (the 7 copies were never collapsed)"
else
  ok "arm 4: _copy_tree_with_transform is defined in setup.d/lib.sh"
  SCRATCH=$(mktemp -d)
  S4="$SCRATCH/src"; D4="$SCRATCH/dst"
  mkdir -p "$S4/nested" "$D4"
  printf 'ref ](../../README.md) here\n' > "$S4/nested/doc.md"
  printf 'plain\n' > "$S4/nested/keep.txt"
  # A newline in the filename: the NUL-unsafe `find | read -r` variant skips this file's
  # transform entirely, which is the S-7 divergence the collapse removes.
  NL_MD="$S4/we
ird.md"
  printf 'ref ](../../README.md) here\n' > "$NL_MD"
  printf 'stale\n' > "$D4/gone.txt"

  _copy_tree_with_transform "$S4" "$D4" >/dev/null 2>&1

  if [ -f "$D4/nested/doc.md" ] && ! grep -qF '](../../README.md)' "$D4/nested/doc.md"; then
    ok "arm 4: nested *.md transformed in the delivered tree"
  else
    bad "arm 4: nested *.md not delivered/transformed"
  fi
  if [ -f "$D4/we
ird.md" ] && ! grep -qF '](../../README.md)' "$D4/we
ird.md"; then
    ok "arm 4: a *.md whose filename contains a newline is transformed (NUL-safe walk)"
  else
    bad "arm 4: newline-named *.md not transformed — the walk is still newline-unsafe"
  fi
  if [ ! -e "$D4/gone.txt" ]; then
    ok "arm 4: pre-existing dst file removed (wipe-and-recopy semantics preserved)"
  else
    bad "arm 4: dst was merged into, not replaced"
  fi
  if [ ! -e "$D4/$(basename "$S4")" ]; then
    ok "arm 4: no nested dst/\$(basename src) (cp -r nesting avoided)"
  else
    bad "arm 4: cp -r nested into the existing dst"
  fi
  rm -rf "$SCRATCH"
fi

# ══════════════════════════════════════════════════════════════════════════════
# ARM 5 — anti-drift: exactly ONE inlined transform walk survives (S-7)
# ══════════════════════════════════════════════════════════════════════════════
# The finding is duplication; "there is one copy" has no behavioural probe, so this arm counts the
# walks structurally. It is deliberately narrow: the `find … -name '*.md' … -print0` walk that
# feeds transform_internal_refs. One occurrence = the helper itself.
WALKS=$(grep -cE "find .* -name '\*\.md' .*-print0" "$REPO_ROOT/install.sh" "$REPO_ROOT"/setup.d/*.sh 2>/dev/null \
  | awk -F: '{s+=$2} END {print s+0}')
if [ "$WALKS" -eq 1 ]; then
  ok "arm 5: exactly one *.md transform walk across install.sh + setup.d/*.sh (single helper)"
else
  bad "arm 5: $WALKS *.md transform walks across install.sh + setup.d/*.sh — expected 1 (S-7 dedup incomplete or a new copy appeared)"
fi

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
