#!/usr/bin/env bash
# fence-agents-coownership — the consumer root AGENTS.md is CO-OWNED, not whole-file-owned.
#
# WHY (spec C1 addition (b); beta-ai-docs-agnosticism S1 §2 D1b): `copy_safe` SKIPS when the
# destination exists (setup.d/lib.sh). The consumer's root AGENTS.md is exactly the file another
# generator already writes — DeepWiki-verified: ai-factory generates and auto-updates it — so our
# contribution landed NOWHERE on any such consumer, while `--force` would have clobbered the
# other writer. `merge_fenced` writes only our `getff:begin section=getff-framework` block.
#
# SHAPE — two arms, deliberately:
#   §1 CASE MATRIX (unit): sources setup.d/lib.sh and drives merge_fenced directly. Fast and
#      exact, so every branch (including the ones a single install path cannot reach) is covered.
#   §2 WIRING (integration): one REAL `install.sh` run proving 30-templates.sh actually calls the
#      helper. §1 without §2 would pass while the installer still used copy_safe.
#
# PAIRED NEGATIVE (umbrella discipline): the idempotence assertion is worthless unless a genuinely
# duplicated section makes it bite — §1.7 re-injects a second block by hand and re-runs the SAME
# counter. If the neg arm does not bite, the pos check was vacuous and is reported as bad.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

TPL="$REPO_ROOT/packages/core/templates/shared/AGENTS.md.template"
BEG='<!-- getff:begin section=getff-framework'
END='<!-- getff:end section=getff-framework -->'

count_beg() { grep -cF "$BEG" "$1" || true; }
count_end() { grep -cF "$END" "$1" || true; }

# ── §1 CASE MATRIX — merge_fenced driven directly ────────────────────────────
# lib.sh expects these from the install.sh dispatcher scope (see its header block).
PKG_ROOT="$REPO_ROOT"
PROJECT_ROOT=""
FORCE=""
DRY_RUN=""
SKIPPED=()
# shellcheck source=/dev/null
source "$REPO_ROOT/setup.d/lib.sh"

echo "── §1 case matrix (merge_fenced direct) ──"

# (0) fresh destination → whole file is our fenced section
W=$(mktemp -d)
install_agents_md "$TPL" "$W/AGENTS.md" >/dev/null 2>&1
if [ -f "$W/AGENTS.md" ] && [ "$(count_beg "$W/AGENTS.md")" = "1" ] && [ "$(count_end "$W/AGENTS.md")" = "1" ]; then
  ok "(0) fresh: file created with exactly one begin + one end marker"
else
  bad "(0) fresh: expected 1 begin + 1 end, got $(count_beg "$W/AGENTS.md")/$(count_end "$W/AGENTS.md")"
fi

# (a) FOREIGN content → our section lands, their content survives
W=$(mktemp -d)
printf '# Someone else AGENTS\n\nFOREIGN-SENTINEL-KEEPME\n' > "$W/AGENTS.md"
BEFORE_A=$(cat "$W/AGENTS.md")
install_agents_md "$TPL" "$W/AGENTS.md" >/dev/null 2>&1
AFTER_A=$(cat "$W/AGENTS.md")
if grep -qF 'FOREIGN-SENTINEL-KEEPME' "$W/AGENTS.md" && [ "$(count_beg "$W/AGENTS.md")" = "1" ]; then
  ok "(a) foreign: our section landed AND foreign content survived"
else
  bad "(a) foreign: foreign content lost or section missing"
fi
# Foreign content must be BEFORE our block (append semantics — theirs is not relocated).
if [ "$(grep -nF 'FOREIGN-SENTINEL-KEEPME' "$W/AGENTS.md" | cut -d: -f1)" -lt \
     "$(grep -nF "$BEG" "$W/AGENTS.md" | cut -d: -f1)" ]; then
  ok "(a) foreign: their content kept its position (our block appended after)"
else
  bad "(a) foreign: our block did not append after the foreign content"
fi
printf '  before(a): %s\n' "$(printf '%s' "$BEFORE_A" | tr '\n' '/')"
printf '  after(a) : %s … [%s lines]\n' "$(printf '%s' "$AFTER_A" | head -c 60 | tr '\n' '/')" "$(printf '%s\n' "$AFTER_A" | wc -l | tr -d ' ')"

# (b) SECOND RUN → replaced, never duplicated; byte-identical (idempotence)
SNAP1=$(cat "$W/AGENTS.md")
install_agents_md "$TPL" "$W/AGENTS.md" >/dev/null 2>&1
SNAP2=$(cat "$W/AGENTS.md")
if [ "$(count_beg "$W/AGENTS.md")" = "1" ] && [ "$(count_end "$W/AGENTS.md")" = "1" ]; then
  ok "(b) idempotence: still exactly one begin + one end after the second run"
else
  bad "(b) idempotence: section duplicated — $(count_beg "$W/AGENTS.md") begin / $(count_end "$W/AGENTS.md") end"
fi
if [ "$SNAP1" = "$SNAP2" ]; then
  ok "(b) idempotence: second run is byte-identical"
else
  bad "(b) idempotence: second run changed bytes"
fi
if grep -qF 'FOREIGN-SENTINEL-KEEPME' "$W/AGENTS.md"; then
  ok "(b) idempotence: foreign content still intact after re-run"
else
  bad "(b) idempotence: re-run destroyed foreign content"
fi

# (b-neg) PAIRED NEGATIVE — a hand-duplicated block MUST make the counter bite.
cp "$W/AGENTS.md" "$W/AGENTS.md.bak"
{ echo "$BEG plan=x -->"; echo "duplicate"; echo "$END"; } >> "$W/AGENTS.md"
if [ "$(count_beg "$W/AGENTS.md")" -gt 1 ]; then
  ok "(b-neg) re-injected a second block → duplicate counter bites (non-vacuous)"
else
  bad "(b-neg) re-injected a second block but the counter stayed at 1 → VACUOUS check"
fi
mv "$W/AGENTS.md.bak" "$W/AGENTS.md"

# (c) FENCE-LESS copy of an OLDER version of our own template → adopted exactly once.
# Uses a REAL historical revision from git, not a hand-written lookalike: the whole point is
# that every pre-fence consumer install must be recognised.
W=$(mktemp -d)
# --follow's oldest entry is the RENAME-ORIGIN commit, where the blob does not yet exist at this
# path — so walk oldest-first and take the first revision that actually materialises content.
OLD_SHA=""
for _sha in $(git -C "$REPO_ROOT" log --format=%H --follow -- "packages/core/templates/shared/AGENTS.md.template" | tail -r 2>/dev/null || git -C "$REPO_ROOT" log --format=%H --reverse --follow -- "packages/core/templates/shared/AGENTS.md.template"); do
  if git -C "$REPO_ROOT" show "$_sha:packages/core/templates/shared/AGENTS.md.template" > "$W/AGENTS.md" 2>/dev/null && [ -s "$W/AGENTS.md" ]; then
    OLD_SHA="$_sha"; break
  fi
done
if [ -n "$OLD_SHA" ]; then
  OLD_LINES=$(wc -l < "$W/AGENTS.md" | tr -d ' ')
  TPL_LINES=$(wc -l < "$TPL" | tr -d ' ')
  install_agents_md "$TPL" "$W/AGENTS.md" >/dev/null 2>&1
  NEW_LINES=$(wc -l < "$W/AGENTS.md" | tr -d ' ')
  if [ "$(count_beg "$W/AGENTS.md")" = "1" ] && [ "$(count_end "$W/AGENTS.md")" = "1" ]; then
    ok "(c) pre-fence getff copy (rev ${OLD_SHA:0:8}): exactly one begin + one end"
  else
    bad "(c) pre-fence getff copy: $(count_beg "$W/AGENTS.md") begin / $(count_end "$W/AGENTS.md") end"
  fi
  # ADOPT, not APPEND: the result is the template + 4 wrapper lines (begin, blank, blank, end),
  # NOT old+new concatenated. The +5 slack absorbs a trailing-newline difference; it stays far
  # below the doubled size (old + template ≈ 254), which is the failure this arm exists to catch.
  if [ "$NEW_LINES" -le $((TPL_LINES + 5)) ]; then
    ok "(c) adopted (${OLD_LINES} → ${NEW_LINES} lines ≈ template ${TPL_LINES} + markers), not doubled"
  else
    bad "(c) file DOUBLED: ${OLD_LINES} → ${NEW_LINES} lines (template is ${TPL_LINES}) — appended instead of adopting"
  fi
  # Re-running on the adopted file must stay idempotent.
  SNAP3=$(cat "$W/AGENTS.md"); install_agents_md "$TPL" "$W/AGENTS.md" >/dev/null 2>&1
  [ "$SNAP3" = "$(cat "$W/AGENTS.md")" ] \
    && ok "(c) adopted file is idempotent on re-run" \
    || bad "(c) adopted file changed bytes on re-run"
else
  bad "(c) could not materialise a historical template revision ($OLD_SHA)"
fi

# (c-neg) PAIRED NEGATIVE — a file carrying only ONE sentinel must NOT be adopted.
# Guards the dangerous direction: a false-positive adopt destroys a consumer's own file.
W=$(mktemp -d)
printf '# AGENTS.md — context for AI coding agents\n\nMY-OWN-DOC-KEEPME\n' > "$W/AGENTS.md"
install_agents_md "$TPL" "$W/AGENTS.md" >/dev/null 2>&1
if grep -qF 'MY-OWN-DOC-KEEPME' "$W/AGENTS.md"; then
  ok "(c-neg) one sentinel only → NOT adopted, consumer content preserved (append path)"
else
  bad "(c-neg) one sentinel only → file was adopted/clobbered — false-positive adopt"
fi

# (force) --force replaces OUR section only, never the whole file.
W=$(mktemp -d)
printf '# Their file\n\nFORCE-FOREIGN-KEEPME\n' > "$W/AGENTS.md"
install_agents_md "$TPL" "$W/AGENTS.md" >/dev/null 2>&1
FORCE="--force"
install_agents_md "$TPL" "$W/AGENTS.md" >/dev/null 2>&1
FORCE=""
if grep -qF 'FORCE-FOREIGN-KEEPME' "$W/AGENTS.md" && [ "$(count_beg "$W/AGENTS.md")" = "1" ]; then
  ok "(force) --force replaced our section only; foreign content survived"
else
  bad "(force) --force clobbered the co-owned file"
fi

# (override) Layer-3 escape hatch — a sibling AGENTS.override.md means hands off entirely.
W=$(mktemp -d)
printf 'CONSUMER-OWNED\n' > "$W/AGENTS.md"
printf 'my override\n' > "$W/AGENTS.override.md"
install_agents_md "$TPL" "$W/AGENTS.md" >/dev/null 2>&1
if [ "$(cat "$W/AGENTS.md")" = "CONSUMER-OWNED" ]; then
  ok "(override) .override.md present → nothing written (Layer-3 honoured)"
else
  bad "(override) .override.md present but the file was still written"
fi

# (malformed) begin without end → LOUD refuse, file untouched (never splice to EOF).
W=$(mktemp -d)
printf '%s plan=x -->\nbody\nTAIL-MUST-SURVIVE\n' "$BEG" > "$W/AGENTS.md"
install_agents_md "$TPL" "$W/AGENTS.md" >/dev/null 2>&1
if grep -qF 'TAIL-MUST-SURVIVE' "$W/AGENTS.md"; then
  ok "(malformed) unterminated fence → refused, trailing content survives"
else
  bad "(malformed) unterminated fence → content after the marker was deleted"
fi

# ── §2 WIRING — the REAL installer must use the helper ───────────────────────
echo "── §2 wiring (real install.sh) ──"
T=$(mktemp -d)
printf '{"name":"fence","version":"0.0.0"}\n' > "$T/package.json"
# Pre-seed a foreign AGENTS.md: this is the case copy_safe silently skipped.
printf '# Consumer own AGENTS\n\nINSTALL-FOREIGN-KEEPME\n' > "$T/AGENTS.md"
( cd "$T" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force ) >/dev/null 2>&1

if [ "$(count_beg "$T/AGENTS.md")" = "1" ] && [ "$(count_end "$T/AGENTS.md")" = "1" ]; then
  ok "wiring: real install wrote exactly one fenced section into a pre-existing AGENTS.md"
else
  bad "wiring: real install produced $(count_beg "$T/AGENTS.md") begin / $(count_end "$T/AGENTS.md") end — installer still on copy_safe?"
fi
grep -qF 'INSTALL-FOREIGN-KEEPME' "$T/AGENTS.md" \
  && ok "wiring: pre-existing consumer content survived the real install" \
  || bad "wiring: real install clobbered the consumer's own AGENTS.md"

# Second real install → still one section (installer-level idempotence).
SNAP=$(cat "$T/AGENTS.md")
( cd "$T" && bash "$REPO_ROOT/install.sh" ts-server --force ) >/dev/null 2>&1
if [ "$(count_beg "$T/AGENTS.md")" = "1" ] && [ "$SNAP" = "$(cat "$T/AGENTS.md")" ]; then
  ok "wiring: second real install is byte-identical (no duplicated section)"
else
  bad "wiring: second real install duplicated or mutated the section"
fi

# ── §3 FACTORY-GATE DOC PARITY — the template's `factory` row names every gated agent ──
#
# WHY: setup.d/20-agents.sh gates two sub-agents to --profile factory, but the template's
# factory row listed only the 7-skill suite, so a consumer AI at factory depth never learned
# it had them. Nothing checked the two lists against each other, and the drift survived a
# full review round as a NEVER-DONE register row (`1311-r1-5`, s4b outcome audit
# §drift-register). A doc claim about install behaviour whose only guard is «someone will
# notice» is `#hope-as-gate` (.claude/rules/attention-is-not-a-mechanism.md §2) — so the two
# lists are reconciled mechanically here, at the earliest channel that already runs in CI.
#
# Extraction is structural, not a hard-coded name list: whichever agents 20-agents.sh gates
# to factory must appear in the row, so ADDING a third gated agent fails this until the
# template names it too.
GATE_SH="$REPO_ROOT/setup.d/20-agents.sh"

# The gated case-arm = the last `<pattern>)` line before the arm body testing PROFILE != factory.
gated_agents() {
  awk '
    /^[[:space:]]*[A-Za-z0-9._|-]+\)[[:space:]]*$/ { pat = $0 }
    /!=[[:space:]]*"factory"/ { if (pat != "") { print pat; exit } }
  ' "$GATE_SH" | tr -d '[:space:])' | tr '|' '\n' | sed 's/\.md$//'
}

# Same counter for both arms (positive + paired negative): every gated agent named in the row.
missing_from_factory_row() {
  _tpl="$1"; _missing=""
  _row=$(grep -E '^\|.*`factory`' "$_tpl" || true)
  for _a in $(gated_agents); do
    [ -n "$_a" ] || continue
    case "$_row" in
      *"$_a"*) ;;
      *) _missing="$_missing $_a" ;;
    esac
  done
  echo "$_missing"
}

_gated_count=$(gated_agents | grep -c . || true)
if [ "$_gated_count" -lt 1 ]; then
  bad "factory-gate parity: extracted 0 gated agents from 20-agents.sh — the awk arm no longer matches"
else
  ok "factory-gate parity: extracted $_gated_count gated agent(s) from 20-agents.sh"
fi

_miss=$(missing_from_factory_row "$TPL")
if [ -z "$_miss" ]; then
  ok "factory-gate parity: the template's \`factory\` row names every factory-gated agent"
else
  bad "factory-gate parity: template \`factory\` row omits:$_miss (add to AGENTS.md.template, then re-capture install snapshots)"
fi

# PAIRED NEGATIVE — strip one gated agent from a COPY and re-run the SAME counter; if the
# check does not bite, the positive assertion above was vacuous.
_neg_tpl="$(mktemp)"
_first_gated=$(gated_agents | head -1)
sed "s/$_first_gated//g" "$TPL" > "$_neg_tpl"
if [ -n "$(missing_from_factory_row "$_neg_tpl")" ]; then
  ok "factory-gate parity (neg): removing \`$_first_gated\` from the row makes the check bite"
else
  bad "factory-gate parity (neg): check stayed green on a template missing \`$_first_gated\` — assertion is vacuous"
fi
rm -f "$_neg_tpl"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
