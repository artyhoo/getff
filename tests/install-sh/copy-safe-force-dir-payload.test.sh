#!/usr/bin/env bash
# tests/install-sh/copy-safe-force-dir-payload.test.sh — A2-1: copy_safe's --force path must
# REPLACE a directory payload, not nest into it.
#
# Root cause (the twin of #873, which fixed only refresh_safe): copy_safe skips its exists-guard
# when FORCE=--force and then runs a bare `cp -r "$src" "$dst"`. For a DIRECTORY source whose $dst
# already exists as a directory, `cp -r src dst` NESTS — it creates $dst/$(basename $src) instead of
# replacing $dst's contents. refresh_safe has carried `[ -d "$src" ] && rm -rf "$dst"` since #873
# (setup.d/lib.sh); copy_safe never did.
#
# Live blast radius: `install.sh python --force` on a brownfield tree routes .getff/astgrep-rules
# through _py_copy_or_refresh → copy_safe (the --refresh lane is refresh_safe and is unaffected), so
# the rules dir nests at .getff/astgrep-rules/astgrep-rules/. ast-grep walks ruleDirs RECURSIVELY,
# sees every rule id twice and aborts EVERY scan with `Error: Duplicate rule id … is found` (exit 8)
# — on clean AND on violating input. That kills the CI gate (.github/workflows/getff-python.yml),
# the .getff/hooks/pre-push rung and _py_firing_self_check in one move.
#
# Second directory call site with the same shape: setup.d/40-configs.sh:54 (fences-fire fixtures).
# Both are covered here; the fix lives in copy_safe itself so every present and future directory
# call site is uniform.
#
# Paired-negative: arm 2 reproduces the OLD copy_safe write body verbatim and proves it NESTS —
# so arm 1's / arm 6's "no nesting" assertions are real discriminators, not vacuous checks.
#
# Deterministic, no network. The ast-grep live-fire arm is GATED on tool availability (mirrors
# tests/install-sh/python-delivery.test.sh) — it SKIPs loudly rather than going RED offline; the
# tree-shape assertion in arm 6 carries the CI signal.
set -uo pipefail

REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip() { echo "  · $1"; }

LIB_SH="$REPO_ROOT/setup.d/lib.sh"
[ -f "$LIB_SH" ] || { echo "ERROR: $LIB_SH not found" >&2; exit 1; }

# ── Dispatcher-scope globals lib.sh + the python layer read ──────────────────
PROJECT_ROOT="$REPO_ROOT"
PKG_ROOT="$REPO_ROOT"
FORCE=""
DRY_RUN=""
SKIPPED=()
export INSTALL_SH_LIB_ONLY=1
# shellcheck source=/dev/null
source "$LIB_SH"

SCRATCH=$(mktemp -d)
trap 'rm -rf "$SCRATCH"' EXIT

echo "▶ copy_safe --force: directory payloads are replaced, never nested (A2-1)"
echo ""

# ── Arm 1 (pos): --force on a dir payload replaces, does not nest, does not merge ──
echo "  ── unit: copy_safe --force, directory source ──"
SRC="$SCRATCH/arm1-src"; DST="$SCRATCH/arm1-dst"
mkdir -p "$SRC" "$DST"
echo "new"   > "$SRC/a.txt"
echo "old"   > "$DST/a.txt"
echo "stale" > "$DST/old.txt"

FORCE="--force"
copy_safe "$SRC" "$DST" >/dev/null
FORCE=""

[ "$(cat "$DST/a.txt" 2>/dev/null)" = "new" ] \
  && ok "arm1: DST/a.txt overwritten with new content" \
  || bad "arm1: DST/a.txt NOT overwritten (got: $(cat "$DST/a.txt" 2>/dev/null || echo MISSING))"

[ ! -e "$DST/old.txt" ] \
  && ok "arm1: stale DST/old.txt removed (replace, not merge)" \
  || bad "arm1: stale DST/old.txt still present (merge, not replace)"

[ ! -e "$DST/$(basename "$SRC")" ] \
  && ok "arm1: no nested DST/\$(basename SRC) (no nesting)" \
  || bad "arm1: nested DST/$(basename "$SRC") exists — bare cp -r nested instead of replacing"

# ── Arm 2 (teeth / non-vacuity): the OLD copy_safe write body DOES nest ──────
# Verbatim pre-fix tail of copy_safe. If this stops nesting, arm 1's check is vacuous.
RAWSRC="$SCRATCH/arm2-src"; RAWDST="$SCRATCH/arm2-dst"
mkdir -p "$RAWSRC" "$RAWDST"
echo "payload" > "$RAWSRC/b.txt"
mkdir -p "$(dirname "$RAWDST")"
cp -r "$RAWSRC" "$RAWDST"

[ -e "$RAWDST/$(basename "$RAWSRC")/b.txt" ] \
  && ok "arm2 (teeth): the pre-fix 'mkdir -p; cp -r' body nests into an existing dir" \
  || bad "arm2 (teeth): pre-fix body did NOT nest — arm1/arm6 'no nesting' checks would be vacuous"

# ── Arm 3 (regression): --force on a FILE payload still overwrites ───────────
echo ""
echo "  ── regression: file payloads + non-force paths unchanged ──"
FSRC="$SCRATCH/arm3-src.txt"; FDST="$SCRATCH/arm3-dst.txt"
echo "new" > "$FSRC"; echo "old" > "$FDST"
FORCE="--force"; copy_safe "$FSRC" "$FDST" >/dev/null; FORCE=""
[ "$(cat "$FDST")" = "new" ] \
  && ok "arm3: --force still overwrites a file payload" \
  || bad "arm3: --force did not overwrite the file payload (got: $(cat "$FDST"))"

# ── Arm 4 (regression): greenfield dir copy (dst absent, no --force) ─────────
GSRC="$SCRATCH/arm4-src"; GDST="$SCRATCH/arm4-dst"
mkdir -p "$GSRC"; echo "x" > "$GSRC/c.txt"
copy_safe "$GSRC" "$GDST" >/dev/null
{ [ -f "$GDST/c.txt" ] && [ ! -e "$GDST/$(basename "$GSRC")" ]; } \
  && ok "arm4: greenfield dir copy lands contents at the top level" \
  || bad "arm4: greenfield dir copy wrong shape (c.txt=$([ -f "$GDST/c.txt" ] && echo yes || echo no))"

# ── Arm 5 (regression): skip-if-exists for a dir payload without --force ─────
SSRC="$SCRATCH/arm5-src"; SDST="$SCRATCH/arm5-dst"
mkdir -p "$SSRC" "$SDST"
echo "new" > "$SSRC/d.txt"; echo "consumer" > "$SDST/keep.txt"
SKIPPED=()
copy_safe "$SSRC" "$SDST" >/dev/null
{ [ -f "$SDST/keep.txt" ] && [ ! -e "$SDST/d.txt" ] && [ "${#SKIPPED[@]}" -eq 1 ]; } \
  && ok "arm5: without --force an existing dir is left untouched and recorded in SKIPPED" \
  || bad "arm5: skip-if-exists broke for dir payloads (keep.txt=$([ -f "$SDST/keep.txt" ] && echo yes || echo no), d.txt=$([ -e "$SDST/d.txt" ] && echo yes || echo no), SKIPPED=${#SKIPPED[@]})"
SKIPPED=()

# ── Arm 6 (integration): install the python lane twice, 2nd pass --force ─────
echo ""
echo "  ── integration: deliver_python_toolchain ×2, second pass --force ──"
P=$(mktemp -d)
export PY_LAYER_LIB_ONLY=1
# shellcheck source=/dev/null
source "$REPO_ROOT/setup.d/45-python.sh"
unset GETFF_TOOLCHAIN_REFRESH 2>/dev/null || true

PROJECT_ROOT="$P"; SKIPPED=(); FORCE=""; DRY_RUN=""
deliver_python_toolchain >/dev/null 2>&1
PROJECT_ROOT="$P"; SKIPPED=(); FORCE="--force"; DRY_RUN=""
deliver_python_toolchain >/dev/null 2>&1
FORCE=""

RULES_DIR="$P/.getff/astgrep-rules"
[ -d "$RULES_DIR" ] \
  && ok "arm6: .getff/astgrep-rules delivered" \
  || bad "arm6: .getff/astgrep-rules missing after two passes"

[ ! -e "$RULES_DIR/astgrep-rules" ] \
  && ok "arm6: no nested .getff/astgrep-rules/astgrep-rules after install --force" \
  || bad "arm6: NESTED .getff/astgrep-rules/astgrep-rules present — every ast-grep scan aborts with exit 8"

# Every rule id must be declared exactly once anywhere under the scanned dir — this is precisely
# what ast-grep enforces when it walks ruleDirs recursively.
# Shipped ids are QUOTED (`id: "getff-no-os-system"`) — the unquoted form would make this arm
# vacuous, so the id inventory is asserted non-empty before the per-id count is trusted.
rule_ids=$(grep -rhoE '^id:[[:space:]]*"?[A-Za-z0-9_.-]+"?' "$RULES_DIR" 2>/dev/null \
             | sed -E 's/^id:[[:space:]]*"?//; s/"$//' | LC_ALL=C sort -u)
[ -n "$rule_ids" ] \
  && ok "arm6: rule-id inventory non-empty ($(echo "$rule_ids" | wc -l | tr -d ' ') ids) — the duplicate check below is not vacuous" \
  || bad "arm6: no rule ids parsed out of $RULES_DIR — the duplicate check below would be vacuous"

dup_ids=""
for rid in $rule_ids; do
  n=$(grep -rlE "^id:[[:space:]]*\"?${rid}\"?[[:space:]]*$" "$RULES_DIR" 2>/dev/null | wc -l | tr -d ' ')
  [ "$n" -gt 1 ] && dup_ids="$dup_ids $rid(x$n)"
done
[ -z "$dup_ids" ] \
  && ok "arm6: every ast-grep rule id declared exactly once under the scanned rules dir" \
  || bad "arm6: duplicate rule ids under the scanned rules dir —$dup_ids"

# ── Arm 9: a consumer-RESEARCHED rule survives the newly-wiping --force pass ─
# The fix makes --force a rm-rf-replace pass for .getff/astgrep-rules, which is exactly what
# _py_join_researched_rules' docstring already claims (setup.d/45-python.sh:153 — "install /
# --force / --refresh"). Its durable home is .getff/rules-research/, and the join runs after the
# copy on every pass, so the wipe must not strand a researched rule.
mkdir -p "$P/.getff/rules-research"
cat > "$P/.getff/rules-research/getff-researched-probe.yml" <<'RULEEOF'
id: "getff-researched-probe"
language: python
severity: error
message: "researched probe rule"
rule:
  pattern: __getff_researched_probe__($$$ARGS)
RULEEOF
PROJECT_ROOT="$P"; SKIPPED=(); FORCE="--force"; DRY_RUN=""
deliver_python_toolchain >/dev/null 2>&1
FORCE=""

[ -f "$RULES_DIR/getff-researched-probe.yml" ] \
  && ok "arm9: consumer-researched rule re-joined into the scan dir after the wiping --force pass" \
  || bad "arm9: researched rule STRANDED — the --force wipe dropped it and the join did not restore it"

[ ! -e "$RULES_DIR/astgrep-rules" ] \
  && ok "arm9: still no nesting on a third --force pass" \
  || bad "arm9: nested .getff/astgrep-rules/astgrep-rules reappeared on a third --force pass"

# ── Arm 7 (live-fire, GATED): ast-grep scan must not abort on duplicate ids ──
echo ""
echo "  ── live-fire: ast-grep scan (pinned @ast-grep/cli@0.44.1; SKIP if unobtainable) ──"
if command -v npx >/dev/null 2>&1 && npx --yes -p @ast-grep/cli@0.44.1 ast-grep --version >/dev/null 2>&1; then
  printf 'x = 1\n' > "$P/clean_module.py"
  sg_out=$(cd "$P" && npx --yes -p @ast-grep/cli@0.44.1 ast-grep scan . 2>&1); sg_rc=$?
  if echo "$sg_out" | grep -qi 'Duplicate rule id'; then
    bad "live-fire: ast-grep aborted with a duplicate-rule-id error (rc=$sg_rc): $(echo "$sg_out" | tr '\n' '|' | cut -c1-200)"
  else
    ok "live-fire: ast-grep scan ran without a duplicate-rule-id abort after install --force"
  fi
else
  skip "live-fire ast-grep SKIP — @ast-grep/cli@0.44.1 not obtainable (npx/network absent); arm6 tree shape carries CI"
fi

# ── Arm 8: the second directory call site (40-configs.sh:54 fences-fire fixtures) ──
echo ""
echo "  ── second directory call site: fences-fire fixtures (setup.d/40-configs.sh) ──"
FIX_SRC="$REPO_ROOT/packages/core/audit-self/fixtures/fences-fire"
if [ -d "$FIX_SRC" ]; then
  FIX_DST="$SCRATCH/arm8-fixtures"
  copy_safe "$FIX_SRC" "$FIX_DST" >/dev/null
  FORCE="--force"; copy_safe "$FIX_SRC" "$FIX_DST" >/dev/null; FORCE=""
  [ ! -e "$FIX_DST/fences-fire" ] \
    && ok "arm8: fences-fire fixtures dir not nested after a --force re-install" \
    || bad "arm8: NESTED $FIX_DST/fences-fire — the 40-configs.sh:54 call site still nests under --force"
else
  bad "arm8: fixture source $FIX_SRC missing — the audited call site moved; re-audit copy_safe dir call sites"
fi

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
