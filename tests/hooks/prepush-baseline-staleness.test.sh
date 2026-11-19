#!/usr/bin/env bash
# Paired-negative suite for the stale-install-baselines arm (payload-drift §3h
# arm B) verdict semantics, pinned after the agents-canonical harvest kept
# tripping it on re-homed deliveries (2026-10-06: 61 byte-identical re-home
# paths, then 10 compatibility-entry paths — both dead-end false positives:
# re-capture rewrites the SAME fingerprint, so the demanded fix can never clear
# the flag).
#
# The stale verdict must fire ONLY where re-capture would rewrite a row:
#   A POSITIVE (exit 0) — compatibility entry: the old path's bytes moved to a
#     canonical home (row `.agents/roles/…` keeps the pre-image hash); the old
#     path now holds a different-content pointer stub. Membership matches via
#     the canonical row; a recorded home still carries the bytes → skip.
#   B NEGATIVE (exit 1) — genuine delivery change: the path's OWN row records
#     the pre-image and its resolved bytes changed → stale, flag.
#   C POSITIVE (exit 0) — bytes-identical re-home to a symlink: the old path
#     became a link to the identical canonical file → resolved bytes equal the
#     pre-image → skip.
#   D NEGATIVE (exit 1) — hash lives only under a foreign row and NO recorded
#     home carries the bytes any more (the template-source class: the recorded
#     destination does not exist in this repo) → conservative stale, flag.
#   E POSITIVE (exit 0) — consumer-split: the delivery source is a sibling
#     variant directory (procedure_source's owner mapping), so the recorded
#     consumer path and its repo twin both moved on while the tracked payload
#     copy (a MANIFEST.sha256 row whose assembled file still carries the exact
#     bytes) vouches for it → skip.
#   F NEGATIVE (exit 1) — unrelated retained bytes: the pre-image bytes sit
#     under packages/getff at a path NO MANIFEST row records → not a delivery
#     witness → flag. (2026-10-06 review F2 repro.)
#   G NEGATIVE (exit 1) — stale witness: a payload file still carries the
#     pre-image bytes but its MANIFEST row was regenerated to the new hash —
#     row and bytes disagree, so the row vouches for nothing → flag.
#   H NEGATIVE (exit 1) — untracked witness: pre-image bytes at a
#     delivery-shaped path that no MANIFEST row records (assembly residue) →
#     flag even though a manifest exists.
#
# The hook resolves REPO_ROOT from its own file location, so the fixture gets a
# full copy of packages/core/hooks and runs ITS copy — baselineDir then lands in
# the fixture's tests/install-sh/baselines. Each case is its own repo: base =
# the seeded commit, head = the changed commit, so changed paths keep status M.
#
# CI: invoked from .github/workflows/audit-self.yml#principles-meta-tests
# (alongside prepush-merge-forward-range.test.sh / prepush-upstream-ref.test.sh).

set -uo pipefail

REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
SRC_HOOK_DIR="$REPO_ROOT/packages/core/hooks"
PASS=0
FAIL=0

if [ -f "$REPO_ROOT/packages/core/node_modules/tsx/dist/esm/index.mjs" ]; then
  REAL_NODE_MODULES="$REPO_ROOT/packages/core/node_modules"
elif [ -f "$REPO_ROOT/node_modules/tsx/dist/esm/index.mjs" ]; then
  REAL_NODE_MODULES="$REPO_ROOT/node_modules"
else
  echo "❌ tsx loader not found in packages/core/node_modules or root node_modules"
  exit 1
fi
TSX_LOADER="$REAL_NODE_MODULES/tsx/dist/esm/index.mjs"

git_q() { git -C "$1" -c commit.gpgsign=false "${@:2}"; }

sha() { shasum -a 256 | awk '{print $1}'; }

# build_case: a temp repo with the hook closure (plus packages/core/package.json —
# its "type": "module" is what makes node+tsx treat the copied .ts entry as ESM)
# and an empty baselines cell. Echoes the tmp dir. The case seeds files, then
# makes two commits itself.
build_case() {
  local tmp
  tmp=$(mktemp -d)
  mkdir -p "$tmp/packages/core" "$tmp/tests/install-sh/baselines/case"
  cp -R "$SRC_HOOK_DIR" "$tmp/packages/core/hooks"
  cp "$REPO_ROOT/packages/core/package.json" "$tmp/packages/core/package.json"
  git_q "$tmp" init -q
  git_q "$tmp" config user.email t@t
  git_q "$tmp" config user.name t
  printf '%s' "$tmp"
}

# commit_all REPO MSG: deterministic post-cutoff commit; echoes the SHA.
commit_all() {
  local repo="$1" msg="$2"
  GIT_AUTHOR_DATE="2026-10-06T12:00:00" GIT_COMMITTER_DATE="2026-10-06T12:00:00" \
    git -C "$repo" add -A
  GIT_AUTHOR_DATE="2026-10-06T12:00:00" GIT_COMMITTER_DATE="2026-10-06T12:00:00" \
    git_q "$repo" commit -qm "$msg"
  git_q "$repo" rev-parse HEAD
}

# fingerprint REPO ROWS...: write `<hash>  <path>` rows into the baseline cell.
fingerprint() {
  local tmp="$1"; shift
  : > "$tmp/tests/install-sh/baselines/case/case.fingerprint"
  local row h p
  for row in "$@"; do
    h=${row%%|*}; p=${row#*|}
    printf '%s  %s\n' "$h" "$p" >> "$tmp/tests/install-sh/baselines/case/case.fingerprint"
  done
}

# run_arm REPO LOCAL_SHA REMOTE_SHA: the copied hook, PREPUSH_ONLY=payload-drift,
# stdin-driven range (base = remote sha — a known commit in the fixture).
run_arm() {
  local repo="$1" local_sha="$2" remote_sha="$3"
  (
    cd "$repo" || exit 1
    printf 'refs/heads/feat %s refs/heads/feat %s\n' "$local_sha" "$remote_sha" |
      NODE_PATH="$REAL_NODE_MODULES" PREPUSH_ONLY="payload-drift" \
      node --import "$TSX_LOADER" "$repo/packages/core/hooks/pre-push.ts" 2>&1
  )
}

record() {
  local outcome="$1" desc="$2"
  if [ "$outcome" = "pass" ]; then PASS=$((PASS+1)); printf 'PASS: %s\n' "$desc"
  else FAIL=$((FAIL+1)); printf 'FAIL: %s\n' "$desc"; fi
}

# ── Case A: compatibility entry at the re-homed path → skip ──
TA=$(build_case)
mkdir -p "$TA/agents" "$TA/.agents/roles"
printf 'old canonical body\n' > "$TA/.agents/roles/compat.md"
cp "$TA/.agents/roles/compat.md" "$TA/agents/compat.md"
HA=$(sha < "$TA/.agents/roles/compat.md")
C0A=$(commit_all "$TA" "seed canonical+legacy")
printf -- '---\nname: compat\ndescription: compat entry\n---\n\nRead .agents/roles/compat.md in full.\n' > "$TA/agents/compat.md"
C1A=$(commit_all "$TA" "legacy path becomes compatibility entry")
fingerprint "$TA" "${HA}|.agents/roles/compat.md"
OUT_A=$(run_arm "$TA" "$C1A" "$C0A"); RC_A=$?
if [ "$RC_A" -eq 0 ]; then
  record pass "A — compat entry: hash lives under the canonical row, home intact → exit 0"
else
  record fail "A — compat entry flagged (rc=$RC_A, output below)"; printf '%s\n' "$OUT_A"
fi

# ── Case B: genuine change at a delivered path → flag ──
TB=$(build_case)
mkdir -p "$TB/.agents/roles"
printf 'delivered v1\n' > "$TB/.agents/roles/deliv.md"
HB=$(sha < "$TB/.agents/roles/deliv.md")
C0B=$(commit_all "$TB" "seed delivered path")
printf 'delivered v2 — real content edit\n' > "$TB/.agents/roles/deliv.md"
C1B=$(commit_all "$TB" "genuine delivery change")
fingerprint "$TB" "${HB}|.agents/roles/deliv.md"
OUT_B=$(run_arm "$TB" "$C1B" "$C0B"); RC_B=$?
if [ "$RC_B" -ne 0 ] && printf '%s' "$OUT_B" | grep -q 'stale install baselines' &&
  printf '%s' "$OUT_B" | grep -q '\.agents/roles/deliv\.md'; then
  record pass "B — genuine delivery change → exit 1, path named"
else
  record fail "B — genuine change NOT flagged (rc=$RC_B, output below)"; printf '%s\n' "$OUT_B"
fi

# ── Case C: bytes-identical re-home to a symlink → skip ──
TC=$(build_case)
mkdir -p "$TC/.claude" "$TC/.agents/roles"
printf 're-homed body\n' > "$TC/.agents/roles/rehome.md"
cp "$TC/.agents/roles/rehome.md" "$TC/.claude/rehome.md"
HC=$(sha < "$TC/.agents/roles/rehome.md")
C0C=$(commit_all "$TC" "seed pre-migration real file")
rm "$TC/.claude/rehome.md"
ln -s ../.agents/roles/rehome.md "$TC/.claude/rehome.md"
C1C=$(commit_all "$TC" "re-home: .claude path becomes link")
fingerprint "$TC" "${HC}|.agents/roles/rehome.md"
OUT_C=$(run_arm "$TC" "$C1C" "$C0C"); RC_C=$?
if [ "$RC_C" -eq 0 ]; then
  record pass "C — byte-identical re-home via symlink → exit 0"
else
  record fail "C — re-home flagged (rc=$RC_C, output below)"; printf '%s\n' "$OUT_C"
fi

# ── Case D: no recorded home carries the bytes → conservative flag ──
TD=$(build_case)
mkdir -p "$TD/src"
printf 'template source v1\n' > "$TD/src/templ.md"
HD=$(sha < "$TD/src/templ.md")
C0D=$(commit_all "$TD" "seed template source")
printf 'template source v2 — edited\n' > "$TD/src/templ.md"
C1D=$(commit_all "$TD" "edit template source")
fingerprint "$TD" "${HD}|consumer-gone/dest.md"
OUT_D=$(run_arm "$TD" "$C1D" "$C0D"); RC_D=$?
if [ "$RC_D" -ne 0 ] && printf '%s' "$OUT_D" | grep -q 'src/templ\.md'; then
  record pass "D — no recorded home carries the pre-image → exit 1, conservative flag"
else
  record fail "D — orphaned hash NOT flagged (rc=$RC_D, output below)"; printf '%s\n' "$OUT_D"
fi

# ── Case E: delivery source is a sibling variant in the payload → skip ──
TE=$(build_case)
mkdir -p "$TE/skills/foo" "$TE/.agents/procedures/foo" "$TE/.agents/procedures/foo-consumer" "$TE/packages/getff/.agents/procedures/foo-consumer"
printf 'consumer-split body\n' > "$TE/.agents/procedures/foo-consumer/SKILL.md"
cp "$TE/.agents/procedures/foo-consumer/SKILL.md" "$TE/packages/getff/.agents/procedures/foo-consumer/SKILL.md"
printf 'repo canonical already re-ported at base\n' > "$TE/.agents/procedures/foo/SKILL.md"
cp "$TE/.agents/procedures/foo-consumer/SKILL.md" "$TE/skills/foo/SKILL.md"
HE=$(sha < "$TE/.agents/procedures/foo-consumer/SKILL.md")
# The tracked delivery witness: the assembled payload's manifest row, committed
# with the seed. Rows are repo-root-relative (the same form arm A consumes).
printf '%s  %s\n' "$HE" "packages/getff/.agents/procedures/foo-consumer/SKILL.md" > "$TE/packages/getff/MANIFEST.sha256"
C0E=$(commit_all "$TE" "seed consumer-split delivery")
printf -- '---\nname: foo\ndescription: compat entry\n---\n\nRead the canonical file.\n' > "$TE/skills/foo/SKILL.md"
C1E=$(commit_all "$TE" "top-level path becomes compat entry")
fingerprint "$TE" "${HE}|.agents/procedures/foo/SKILL.md"
OUT_E=$(run_arm "$TE" "$C1E" "$C0E"); RC_E=$?
if [ "$RC_E" -eq 0 ]; then
  record pass "E — consumer-split: payload copy still carries the bytes → exit 0"
else
  record fail "E — consumer-split flagged (rc=$RC_E, output below)"; printf '%s\n' "$OUT_E"
fi

# ── Case F: unrelated retained bytes in the payload tree → still flag ──
TF=$(build_case)
mkdir -p "$TF/src"
printf 'template source v1\n' > "$TF/src/templ.md"
HF=$(sha < "$TF/src/templ.md")
C0F=$(commit_all "$TF" "seed template source")
printf 'template source v2 — edited\n' > "$TF/src/templ.md"
C1F=$(commit_all "$TF" "edit template source")
fingerprint "$TF" "${HF}|consumer-gone/dest.md"
# Report repro (2026-10-06 review F2): pre-image bytes parked under the payload
# tree at a path no MANIFEST row records, created AFTER the commits.
mkdir -p "$TF/packages/getff/unrelated"
printf 'template source v1\n' > "$TF/packages/getff/unrelated/example.md"
OUT_F=$(run_arm "$TF" "$C1F" "$C0F"); RC_F=$?
if [ "$RC_F" -ne 0 ] && printf '%s' "$OUT_F" | grep -q 'src/templ\.md'; then
  record pass "F — unrelated retained payload bytes do not exempt → exit 1"
else
  record fail "F — unrelated payload bytes exempted the stale row (rc=$RC_F, output below)"; printf '%s\n' "$OUT_F"
fi

# ── Case G: stale witness (manifest row regenerated, file not) → still flag ──
TG=$(build_case)
mkdir -p "$TG/src" "$TG/packages/getff/delivery"
printf 'template source v1\n' > "$TG/src/templ.md"
cp "$TG/src/templ.md" "$TG/packages/getff/delivery/templ.md"
printf 'payload filler\n' > "$TG/packages/getff/filler.txt"
HGF=$(sha < "$TG/packages/getff/filler.txt")
HG1=$(sha < "$TG/src/templ.md")
printf '%s  %s\n' "$HG1" "packages/getff/delivery/templ.md" > "$TG/packages/getff/MANIFEST.sha256"
printf '%s  %s\n' "$HGF" "packages/getff/filler.txt" >> "$TG/packages/getff/MANIFEST.sha256"
C0G=$(commit_all "$TG" "seed template source + consistent manifest")
HG2=$(printf 'template source v2 — edited\n' | sha)
printf 'template source v2 — edited\n' > "$TG/src/templ.md"
# Manifest regenerated to the NEW hash while the stale payload file still
# carries the pre-image bytes — row and bytes disagree (assembly skipped the
# file). The committed state itself carries the disagreement.
printf '%s  %s\n' "$HG2" "packages/getff/delivery/templ.md" > "$TG/packages/getff/MANIFEST.sha256"
printf '%s  %s\n' "$HGF" "packages/getff/filler.txt" >> "$TG/packages/getff/MANIFEST.sha256"
C1G=$(commit_all "$TG" "edit source, regen manifest row, payload file left stale")
fingerprint "$TG" "${HG1}|consumer-gone/dest.md"
OUT_G=$(run_arm "$TG" "$C1G" "$C0G"); RC_G=$?
if [ "$RC_G" -ne 0 ] && printf '%s' "$OUT_G" | grep -q 'src/templ\.md'; then
  record pass "G — stale witness (row/bytes disagree) does not exempt → exit 1"
else
  record fail "G — stale witness exempted the row (rc=$RC_G, output below)"; printf '%s\n' "$OUT_G"
fi

# ── Case H: untracked witness (bytes at an unmanifested delivery-shaped path) → flag ──
TH=$(build_case)
mkdir -p "$TH/src" "$TH/packages/getff/.agents/procedures/tool-bootstrapping-consumer"
printf 'template source v1\n' > "$TH/src/templ.md"
printf 'payload filler\n' > "$TH/packages/getff/filler.txt"
HHF=$(sha < "$TH/packages/getff/filler.txt")
HH=$(sha < "$TH/src/templ.md")
printf '%s  %s\n' "$HHF" "packages/getff/filler.txt" > "$TH/packages/getff/MANIFEST.sha256"
C0H=$(commit_all "$TH" "seed template source + unrelated manifest row")
printf 'template source v2 — edited\n' > "$TH/src/templ.md"
C1H=$(commit_all "$TH" "edit template source")
fingerprint "$TH" "${HH}|consumer-gone/dest.md"
# Assembly residue: pre-image bytes at the sibling-variant path the real
# consumer-split delivery uses, present on disk but recorded by NO manifest row.
printf 'template source v1\n' > "$TH/packages/getff/.agents/procedures/tool-bootstrapping-consumer/SKILL.md"
OUT_H=$(run_arm "$TH" "$C1H" "$C0H"); RC_H=$?
if [ "$RC_H" -ne 0 ] && printf '%s' "$OUT_H" | grep -q 'src/templ\.md'; then
  record pass "H — untracked witness (no manifest row) does not exempt → exit 1"
else
  record fail "H — untracked witness exempted the row (rc=$RC_H, output below)"; printf '%s\n' "$OUT_H"
fi

rm -rf "$TA" "$TB" "$TC" "$TD" "$TE" "$TF" "$TG" "$TH"
printf '\n%d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
