#!/usr/bin/env bash
# consumer-delivery-safety-guard.test.sh — W1-A (GH #1514 + #1540): the pre-overwrite
# divergence guard on the DESTRUCTIVE paths (copy_safe --force arm, _copy_tree_with_transform)
# and its parity with post-processed deliveries. Locks the review-REVISE fixes:
#
#   Arm 1 (unit)  no-entry arm: silent preserve at file level, exactly ONE aggregate line,
#                 NEVER a per-file warning (D4(c) — the RI-2 no-spam contract survives; only
#                 the silent data loss is gone).
#   Arm 2 (unit)  entry-present arm under --force: per-file ⚠ + preserved copy with the exact
#                 edited bytes, live file refreshed (D4(b)).
#   Arm 3 (live)  MAJOR 1 parity: pre-manifest consumer, exactly 2 real edits, --force →
#                 "preserved 2" and ONLY the 2 edited files under refresh-conflicts/ — the
#                 pristine post-processed deliveries (transformed agents, header-rewritten
#                 ARCHITECTURE.md, block-appended .prettierignore) must NOT be preserved.
#   Arm 4 (live)  MAJOR 2 preview: a diverged .claude/skills/getff/SKILL.md (plain-skills arm,
#                 which bypasses copy_skill_with_transform) shows `would-flag` under
#                 `--refresh --dry-run` and NOTHING is written; paired-negative: the real
#                 --refresh right after DOES warn + preserve + refresh.
#
# Portability: bash 3.2, no GNU-only flags; ASCII-substring assertions only (the shipped
# warning glyph is UTF-8; var-adjacent UTF-8 has crashed bash 3.2/BSD tr in tests twice —
# PR 1495/1497). Harness shape mirrors refresh-divergence-guard.test.sh.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

hash256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    echo "NOHASH"
  fi
}

CONFLICTS_REL=".ai-factory/refresh-conflicts"
MANIFEST_REL=".ai-factory/refresh-baseline.json"

# ── Unit arms source lib.sh in dispatcher scope (lib-only mode) ──────────────
UT=$(mktemp -d)
PROJECT_ROOT="$UT/consumer"
PKG_ROOT="$REPO_ROOT"
FORCE=""; DRY_RUN=""; SKIPPED=()
INSTALL_SH_LIB_ONLY=1
# shellcheck source=/dev/null
source "$REPO_ROOT/setup.d/lib.sh"

# ══════════════════════════════════════════════════════════════════════════════
# ARM 1 (unit) — no-entry: silent preserve + exactly ONE aggregate line, no per-file ⚠
# ══════════════════════════════════════════════════════════════════════════════
echo "▶ Arm 1: no-entry diverged file under --force → silent preserve, one aggregate line"
mkdir -p "$PROJECT_ROOT/dst" "$UT/src"
echo "consumer-edit"  > "$PROJECT_ROOT/dst/a.txt"
echo "incoming"       > "$UT/src/a.txt"
REFRESH_CONFLICTS_UNBASELINED=0; REFRESH_CONFLICTS_UNBASELINED_FAILED=0; REFRESH_CONFLICTS_UNBASELINED_REPORTED=""
FORCE="--force"
copy_safe "$UT/src/a.txt" "$PROJECT_ROOT/dst/a.txt" > "$UT/arm1.out" 2>&1
FORCE=""
SHA8_1=$(hash256 "$PROJECT_ROOT/dst/a.txt" 2>/dev/null || true)   # post-copy: refreshed bytes
MUT_HASH=$(printf 'consumer-edit\n' | shasum -a 256 2>/dev/null | awk '{print $1}' || echo NOHASH)
PRES_1="$PROJECT_ROOT/$CONFLICTS_REL/a.txt.${MUT_HASH:0:8}"
if grep -q "overwriting locally-modified" "$UT/arm1.out"; then
  bad "arm 1: no-entry arm printed a per-file warning (RI-2 no-spam contract broken): $(cat "$UT/arm1.out")"
else
  ok "arm 1: no per-file warning for a no-entry diverged file (silent at file level)"
fi
if [ -f "$PRES_1" ] && [ "$(cat "$PRES_1")" = "consumer-edit" ]; then
  ok "arm 1: preserved copy at $CONFLICTS_REL/a.txt.${MUT_HASH:0:8} carries the exact diverged bytes"
else
  bad "arm 1: preserved copy missing or bytes wrong at $PRES_1"
fi
_report_unbaselined_preserves > "$UT/arm1.agg" 2>&1
AGG_N=$(grep -c "preserved 1 unbaselined diverged file(s)" "$UT/arm1.agg")
AGG_TOTAL=$(wc -l < "$UT/arm1.agg" | tr -d ' ')
if [ "$AGG_N" -eq 1 ] && [ "$AGG_TOTAL" -eq 1 ]; then
  ok "arm 1: exactly ONE aggregate line ($(cat "$UT/arm1.agg"))"
else
  bad "arm 1: aggregate line wrong (matches=$AGG_N lines=$AGG_TOTAL): $(cat "$UT/arm1.agg")"
fi
# neg: a second report call in the same run prints nothing more (once-per-run)
_report_unbaselined_preserves >> "$UT/arm1.agg" 2>&1
if [ "$(wc -l < "$UT/arm1.agg" | tr -d ' ')" -eq 1 ]; then
  ok "arm 1 neg: second report in the same run is silent (once per run)"
else
  bad "arm 1 neg: aggregate line repeated within one run"
fi
[ "$(cat "$PROJECT_ROOT/dst/a.txt")" = "incoming" ] \
  && ok "arm 1: live file refreshed to the incoming bytes (guard preserved but did not refuse)" \
  || bad "arm 1: live file not refreshed (got: $(cat "$PROJECT_ROOT/dst/a.txt"))"

# ══════════════════════════════════════════════════════════════════════════════
# ARM 2 (unit) — entry-present under --force: per-file ⚠ + preserved edited bytes
# ══════════════════════════════════════════════════════════════════════════════
echo ""; echo "▶ Arm 2: entry-present diverged file under --force → ⚠ + preserved copy"
mkdir -p "$PROJECT_ROOT/.ai-factory"
printf '{"dst/a.txt":"deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"}\n' \
  > "$PROJECT_ROOT/$MANIFEST_REL"
echo "consumer-edit-2" > "$PROJECT_ROOT/dst/a.txt"
MUT2_HASH=$(printf 'consumer-edit-2\n' | shasum -a 256 2>/dev/null | awk '{print $1}' || echo NOHASH)
FORCE="--force"
copy_safe "$UT/src/a.txt" "$PROJECT_ROOT/dst/a.txt" > "$UT/arm2.out" 2>&1
FORCE=""
if grep -qF "overwriting locally-modified file:" "$UT/arm2.out" \
  && grep -qF "consumer copy preserved at" "$UT/arm2.out"; then
  ok "arm 2: per-file ⚠ printed with the preserved-copy path"
else
  bad "arm 2: entry-present ⚠ missing: $(cat "$UT/arm2.out")"
fi
PRES_2="$PROJECT_ROOT/$CONFLICTS_REL/a.txt.${MUT2_HASH:0:8}"
if [ -f "$PRES_2" ] && [ "$(cat "$PRES_2")" = "consumer-edit-2" ]; then
  ok "arm 2: preserved copy carries the exact edited bytes"
else
  bad "arm 2: preserved copy missing or bytes wrong at $PRES_2"
fi
[ "$(cat "$PROJECT_ROOT/dst/a.txt")" = "incoming" ] \
  && ok "arm 2: live file refreshed (warn + preserve, never refuse)" \
  || bad "arm 2: live file not refreshed"

# ── Live arms: one real consumer, reused across arms 3 and 4 ─────────────────
make_consumer() {
  local T
  T=$(mktemp -d)
  printf '{ "name":"consumer","version":"0.0.0" }\n' > "$T/package.json"
  ( cd "$T" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force < /dev/null ) >/dev/null 2>&1
  echo "$T"
}

# ══════════════════════════════════════════════════════════════════════════════
# ARM 3 (live) — MAJOR 1 parity: 2 real edits on a pre-manifest consumer → preserved == 2
# ══════════════════════════════════════════════════════════════════════════════
echo ""; echo "▶ Arm 3: pre-manifest --force — only the 2 real edits preserved (post-processed parity)"
TC=$(make_consumer)
L2="$TC/.claude/hooks/deps-hash-check.sh"
SKILL="$TC/.claude/skills/getff/SKILL.md"
if [ ! -f "$L2" ] || [ ! -f "$SKILL" ]; then
  bad "arm 3 precondition: install did not deliver the probe files"
else
  ok "arm 3 precondition: Layer-2 file + plain skill delivered"
  # The pristine post-processed payloads the false positives used to come from.
  for _pp in "$TC/.claude/agents/capability-reuse-auditor.md" "$TC/.ai-factory/ARCHITECTURE.md" "$TC/.prettierignore"; do
    [ -s "$_pp" ] || bad "arm 3 precondition: post-processed payload missing/empty: $_pp"
  done
  rm -f "$TC/$MANIFEST_REL"
  echo "// ARM3 L2 EDIT" >> "$L2"
  echo "ARM3 SKILL EDIT" >> "$SKILL"
  OUT3=$( cd "$TC" && bash "$REPO_ROOT/install.sh" ts-server --force < /dev/null 2>&1 )
  N_PRESERVED=$(ls -1 "$TC/$CONFLICTS_REL" 2>/dev/null | wc -l | tr -d ' ')
  if printf '%s\n' "$OUT3" | grep -qF "preserved 2 unbaselined diverged file(s)"; then
    ok "arm 3: aggregate line reports exactly 2 preserved"
  else
    bad "arm 3: aggregate line wrong (got: $(printf '%s\n' "$OUT3" | grep -F 'unbaselined' || echo NONE)); files: $(ls "$TC/$CONFLICTS_REL" 2>/dev/null | tr '\n' ' ')"
  fi
  if [ "$N_PRESERVED" -eq 2 ]; then
    ok "arm 3: exactly 2 files under $CONFLICTS_REL/ (no pristine post-processed copies)"
  else
    bad "arm 3: $N_PRESERVED file(s) under $CONFLICTS_REL/ — pristine copies preserved: $(ls "$TC/$CONFLICTS_REL" 2>/dev/null | tr '\n' ' ')"
  fi
  for _f in "$TC/$CONFLICTS_REL"/*; do
    [ -e "$_f" ] || continue
    case "$(basename "$_f")" in
      deps-hash-check.sh.*|SKILL.md.*) ok "arm 3: preserved file is a real edit: $(basename "$_f")" ;;
      *) bad "arm 3: PRISTINE file preserved (MAJOR 1 regression): $(basename "$_f")" ;;
    esac
  done
  grep -qF "ARM3 L2 EDIT" "$TC/$CONFLICTS_REL/deps-hash-check.sh."* 2>/dev/null \
    && ok "arm 3: preserved Layer-2 copy carries the edited bytes" \
    || bad "arm 3: preserved Layer-2 copy missing its edit marker"
  grep -qF "ARM3 SKILL EDIT" "$TC/$CONFLICTS_REL/SKILL.md."* 2>/dev/null \
    && ok "arm 3: preserved skill copy carries the edited bytes" \
    || bad "arm 3: preserved skill copy missing its edit marker"
fi

# ══════════════════════════════════════════════════════════════════════════════
# ARM 4 (live) — MAJOR 2 preview: plain-skills dry-run shows would-flag, writes nothing
# ══════════════════════════════════════════════════════════════════════════════
echo ""; echo "▶ Arm 4: diverged plain skill, --refresh --dry-run → would-flag, nothing written"
# Arm 3's force run re-delivered everything and re-wrote the manifest (baseline healed).
if [ -f "$TC/$MANIFEST_REL" ]; then
  ok "arm 4 precondition: force re-run healed the manifest"
else
  bad "arm 4 precondition: manifest absent after the force run — staging broken"
fi
rm -rf "$TC/$CONFLICTS_REL"
echo "ARM4 SKILL EDIT" >> "$SKILL"
MAN_BEFORE=$(mktemp); cp "$TC/$MANIFEST_REL" "$MAN_BEFORE"
OUT4=$( cd "$TC" && bash "$REPO_ROOT/install.sh" --refresh --dry-run < /dev/null 2>&1 )
if printf '%s\n' "$OUT4" | grep -F "would-flag:" | grep -qF "skills/getff/SKILL.md"; then
  ok "arm 4: --refresh --dry-run reports would-flag for the diverged plain skill"
else
  bad "arm 4: no would-flag for .claude/skills/getff/SKILL.md under --refresh --dry-run (MAJOR 2 regression)"
fi
grep -qF "ARM4 SKILL EDIT" "$SKILL" \
  && ok "arm 4: dry-run did NOT overwrite the diverged skill file" \
  || bad "arm 4: dry-run overwrote the diverged skill file"
cmp -s "$TC/$MANIFEST_REL" "$MAN_BEFORE" \
  && ok "arm 4: manifest bytes unchanged by dry-run" \
  || bad "arm 4: dry-run changed the manifest"
[ ! -e "$TC/$CONFLICTS_REL" ] \
  && ok "arm 4: no conflicts dir created by dry-run" \
  || bad "arm 4: dry-run created $CONFLICTS_REL/"
# neg (LOAD-BEARING): the real refresh right after DOES warn + preserve — the would-flag
# predicted a real divergence (preview faithful).
OUT4B=$( cd "$TC" && bash "$REPO_ROOT/install.sh" --refresh < /dev/null 2>&1 )
if printf '%s\n' "$OUT4B" | grep -F "overwriting locally-modified file:" | grep -qF "skills/getff/SKILL.md"; then
  ok "arm 4 neg: the real refresh warns for exactly the file the dry-run would-flagged"
else
  bad "arm 4 neg: real refresh did not warn for the dry-run-flagged file"
fi
grep -qF "ARM4 SKILL EDIT" "$TC/$CONFLICTS_REL/SKILL.md."* 2>/dev/null \
  && ok "arm 4 neg: diverged skill bytes preserved under refresh-conflicts/" \
  || bad "arm 4 neg: no preserved copy of the diverged skill"
rm -f "$MAN_BEFORE"

# ══════════════════════════════════════════════════════════════════════════════
# ARM 5 (unit) — post-mutating-caller parity census: a PRISTINE post-processed delivery must
# never take the no-entry arm. One case per parity mode, driven through copy_safe exactly as the
# real call sites do (round 2: stryker-pm was the mode the first round left unwired while its own
# comment claimed the fix was a one-line arg — it was not).
# ══════════════════════════════════════════════════════════════════════════════
echo "▶ Arm 5: pristine post-processed deliveries under --force → no no-entry claim"
A5=$(mktemp -d)
PROJECT_ROOT="$A5/consumer"; mkdir -p "$PROJECT_ROOT"
FORCE="--force"; DRY_RUN=""

# stryker-pm: a pnpm consumer (package.json "packageManager" is the corepack signal detect_pm
# reads first), so the patch IS byte-changing — the case where the raw-src comparison false-flags.
printf '{\n  "packageManager": "pnpm@9.0.0"\n}\n' > "$PROJECT_ROOT/package.json"
A5_SRC="$A5/stryker.src.json"
printf '{\n  "packageManager": "npm",\n  "mutate": ["src/**/*.ts"]\n}\n' > "$A5_SRC"
A5_DST="$PROJECT_ROOT/stryker.config.json"
cp "$A5_SRC" "$A5_DST"
_patch_stryker_package_manager_inplace "$A5_DST"
grep -qF '"packageManager": "pnpm"' "$A5_DST" \
  && ok "arm 5 precondition: the patch is byte-changing on this consumer (pnpm)" \
  || bad "arm 5 precondition: patch did not change the config — case is vacuous"
REFRESH_CONFLICTS_UNBASELINED=0; REFRESH_CONFLICTS_UNBASELINED_FAILED=0; REFRESH_CONFLICTS_UNBASELINED_REPORTED=""
copy_safe "$A5_SRC" "$A5_DST" stryker-pm > "$A5/stryker.out" 2>&1
if [ "$REFRESH_CONFLICTS_UNBASELINED" -eq 0 ]; then
  ok "arm 5: pristine patched stryker.config.json NOT claimed as diverged (stryker-pm parity)"
else
  bad "arm 5: pristine patched stryker.config.json false-flagged ($REFRESH_CONFLICTS_UNBASELINED preserved)"
fi
# Paired negative: a REAL consumer edit on the same path must still be preserved.
printf '{\n  "packageManager": "npm",\n  "mutate": ["MY/OWN/**"]\n}\n' > "$A5_DST"
REFRESH_CONFLICTS_UNBASELINED=0; REFRESH_CONFLICTS_UNBASELINED_REPORTED=""
copy_safe "$A5_SRC" "$A5_DST" stryker-pm > "$A5/stryker2.out" 2>&1
if [ "$REFRESH_CONFLICTS_UNBASELINED" -eq 1 ]; then
  ok "arm 5 neg: a genuinely edited stryker.config.json IS still preserved"
else
  bad "arm 5 neg: real edit not preserved (count=$REFRESH_CONFLICTS_UNBASELINED) — parity over-suppressed"
fi

# md-refs: a pristine transformed markdown delivery (agents / python skill files).
A5_MD_SRC="$A5/agent.md"
printf 'see [x](../../packages/core/README.md) and [y](../../README.md)\n' > "$A5_MD_SRC"
A5_MD_DST="$PROJECT_ROOT/agent.md"
cp "$A5_MD_SRC" "$A5_MD_DST"; transform_internal_refs "$A5_MD_DST"
if cmp -s "$A5_MD_SRC" "$A5_MD_DST"; then
  bad "arm 5 precondition: transform_internal_refs was a no-op — md-refs case is vacuous"
else
  ok "arm 5 precondition: the transform is byte-changing for this file"
fi
REFRESH_CONFLICTS_UNBASELINED=0; REFRESH_CONFLICTS_UNBASELINED_REPORTED=""
copy_safe "$A5_MD_SRC" "$A5_MD_DST" md-refs > "$A5/md.out" 2>&1
if [ "$REFRESH_CONFLICTS_UNBASELINED" -eq 0 ]; then
  ok "arm 5: pristine transformed markdown NOT claimed as diverged (md-refs parity)"
else
  bad "arm 5: pristine transformed markdown false-flagged"
fi

# arch-header: a pristine header-rewritten ARCHITECTURE.md delivery (shared + python lanes).
A5_ARCH_SRC="$A5/ARCHITECTURE.md"
printf '> Drop into `.ai-factory/ARCHITECTURE.md` and override only what your project needs. rest\n' > "$A5_ARCH_SRC"
A5_ARCH_DST="$PROJECT_ROOT/ARCHITECTURE.md"
cp "$A5_ARCH_SRC" "$A5_ARCH_DST"; _rewrite_arch_sot_header_inplace "$A5_ARCH_DST"
if cmp -s "$A5_ARCH_SRC" "$A5_ARCH_DST"; then
  bad "arm 5 precondition: the header rewrite was a no-op — arch-header case is vacuous"
else
  ok "arm 5 precondition: the header rewrite is byte-changing for this file"
fi
REFRESH_CONFLICTS_UNBASELINED=0; REFRESH_CONFLICTS_UNBASELINED_REPORTED=""
copy_safe "$A5_ARCH_SRC" "$A5_ARCH_DST" arch-header > "$A5/arch.out" 2>&1
if [ "$REFRESH_CONFLICTS_UNBASELINED" -eq 0 ]; then
  ok "arm 5: pristine header-rewritten ARCHITECTURE.md NOT claimed as diverged (arch-header parity)"
else
  bad "arm 5: pristine header-rewritten ARCHITECTURE.md false-flagged"
fi

# Census guard: every copy_safe call site followed by an in-place mutation of the same dst must
# declare a parity mode. Enumerated by PREDICATE over the shipped setup.d + install.sh, so a new
# post-mutating caller added later fails here instead of silently false-flagging consumer files.
echo "▶ Arm 5c: post-mutating copy_safe callers all declare a parity mode"
UNDECLARED=0
while IFS= read -r hit; do
  file=${hit%%:*}; rest=${hit#*:}; lineno=${rest%%:*}
  # the mutation must target the SAME dst var/path the copy_safe line delivered
  cs_line=$(sed -n "${lineno}p" "$REPO_ROOT/$file")
  dst=$(printf '%s\n' "$cs_line" | awk '{print $3}')
  nxt=$(sed -n "$((lineno+1)),$((lineno+3))p" "$REPO_ROOT/$file")
  # The mutation must target the SAME dst this copy_safe delivered, else the window matches the
  # NEXT delivery's post-processing (dep-cruiser's copy_safe sits one line above stryker's).
  # patch_stryker_package_manager takes no argument and owns exactly one path, so it matches on
  # that path instead of on the dst token.
  mutates=""
  case "$nxt" in
    *transform_internal_refs*"$dst"*|*rewrite_arch_sot_header*"$dst"*) mutates=1 ;;
  esac
  case "$nxt$dst" in
    *patch_stryker_package_manager*stryker.config.json*) mutates=1 ;;
  esac
  [ -n "$mutates" ] || continue
  case "$cs_line" in
    *" md-refs"*|*" arch-header"*|*" stryker-pm"*|*" transform"*|*" suppress-no-entry"*) ;;
    *) UNDECLARED=$((UNDECLARED+1)); echo "    undeclared: $file:$lineno  dst=$dst" ;;
  esac
done <<EOF2
$(cd "$REPO_ROOT" && grep -n 'copy_safe ' install.sh setup.d/*.sh | grep -v '^setup.d/lib.sh:' | grep -v '#')
EOF2
if [ "$UNDECLARED" -eq 0 ]; then
  ok "arm 5c: no post-mutating copy_safe caller is missing its parity mode"
else
  bad "arm 5c: $UNDECLARED post-mutating copy_safe caller(s) without a parity mode"
fi

# Census-row gate (fidelity round 1, MAJOR 1): the census comment in setup.d/lib.sh is closure
# evidence for why six non-primary call-site files were touched, and it cites path:NN coordinates.
# scripts/check-line-citations.mjs only reads *.md, so those coordinates are ungated by
# construction — they were ALL stale one round ago. This arm parses the CENSUS-BEGIN/END block and
# fails unless each cited line really holds a copy_safe carrying the declared mode.
echo "▶ Arm 5d: every census row resolves to a copy_safe carrying its declared parity mode"
BADROW=0; ROWS=0
while IFS= read -r row; do
  # row shape: "#   <file>:<line>   <post-processor>   → <mode>"
  coord=$(printf '%s\n' "$row" | awk '{print $2}')
  mode=$(printf '%s\n' "$row" | sed 's/.*→[[:space:]]*//' | awk '{print $1}')
  case "$coord" in *:*) ;; *) continue ;; esac
  f=${coord%%:*}; ln=${coord##*:}
  ROWS=$((ROWS+1))
  if [ ! -f "$REPO_ROOT/$f" ]; then
    BADROW=$((BADROW+1)); echo "    census row names a missing file: $coord"; continue
  fi
  actual=$(sed -n "${ln}p" "$REPO_ROOT/$f")
  case "$actual" in
    *"copy_safe "*" $mode"*) ;;
    *) BADROW=$((BADROW+1)); echo "    census row stale: $coord declares '$mode' but the line is: $actual" ;;
  esac
done <<EOF3
$(sed -n '/CENSUS-BEGIN/,/CENSUS-END/p' "$REPO_ROOT/setup.d/lib.sh" | grep '→')
EOF3
if [ "$ROWS" -lt 10 ]; then
  bad "arm 5d: parsed only $ROWS census row(s) — the block shape changed, gate is vacuous"
else
  ok "arm 5d: parsed $ROWS census rows"
fi
if [ "$BADROW" -eq 0 ]; then
  ok "arm 5d: every census row resolves to a copy_safe with its declared mode"
else
  bad "arm 5d: $BADROW stale census row(s)"
fi

rm -rf "$A5"

rm -rf "$TC" "$UT"

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
