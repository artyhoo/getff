#!/usr/bin/env bash
# delivered-prettier-conformance.test.sh — GH #1378 / #1377.
#
# The framework's "Shipped artifacts are Prettier-clean" gate checked the SOURCE tree only. But
# install.sh does not deliver skill/agent markdown verbatim: setup.d/lib.sh:transform_internal_refs()
# rewrites repo-internal refs into ${UPSTREAM_BLOB_URL} blob URLs AFTER the copy. Inside a markdown
# table cell that rewrite grows the cell ~50 chars while the `| --- |` separator row keeps upstream's
# dash count, so the DELIVERED file is Prettier-dirty BY CONSTRUCTION while its source is clean —
# and it hits files unchanged upstream, because agents and skills are re-delivered unconditionally
# on refresh. Measured instances at the time of the fix: .claude/agents/capability-reuse-auditor.md,
# .claude/agents/dispatch-input-checker.md, .claude/skills/{arch,dispatcher,self-reflection}/SKILL.md.
#
# scripts/format-shipped.sh grew a second phase that materialises each transform-routed markdown at
# its CONSUMER-FINAL path under a temp root carrying the shipped .prettierrc.json, runs the REAL
# transform, then Prettier-checks the result. This test is that phase's paired negative.
#
# Arms:
#   1. positive  — the delivered phase is GREEN on the current tree.
#   2. NEG       — a seeded ref inside a table cell (source-clean, delivery-dirty) turns it RED,
#                  and names the delivered path. Without this the phase could be vacuously green.
#   3. isolation — the same seeded file passes a SOURCE-only Prettier check, proving arm 2's red
#                  comes from the delivered phase and not from phase 1.
#   4. control   — the same table with the ref OUTSIDE the cell stays GREEN (the gate flags the
#                  transform's effect, not "this file has a table").
#   5. population— .claude/skills is enumerated WHOLE, not as an allowlist of shipped slugs
#                  (GH #1377 class: eight shipped slugs were outside the old hand-maintained list).
#
# Deterministic, no network beyond the pinned `npx prettier@3.8.3` the rest of the battery uses.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

FMT="$REPO_ROOT/scripts/format-shipped.sh"
[ -f "$FMT" ] || { echo "FATAL: $FMT not found"; exit 1; }

if ! npx --yes prettier@3.8.3 --version >/dev/null 2>&1; then
  echo "  · skipped (npx prettier@3.8.3 unreachable) — this test is Prettier-bound by construction"
  exit 0
fi

# ── Arm 5 (deterministic, runs first — no Prettier needed): the pathspec is the whole dir ────────
# The old value was `.claude/skills/pipeline .claude/skills/dispatcher .claude/skills/aif-doctor
# .claude/skills/template-audit` — a hand-maintained allowlist that had drifted from what
# setup.d/10-skills.sh delivers. Assert the whole-dir form is present AND that no per-slug entry
# remains (a re-narrowing would silently re-open the #1377 population gap).
if grep -qE '^[[:space:]]*\.claude/skills[[:space:]]*$' "$FMT"; then
  ok "format-shipped.sh enumerates .claude/skills as a whole dir (no shipped-slug allowlist to drift)"
else
  bad "format-shipped.sh no longer takes .claude/skills whole — the #1377 population gap can reopen"
fi
if grep -qE '^[[:space:]]*\.claude/skills/[a-z-]+([[:space:]]|$)' "$FMT"; then
  bad "format-shipped.sh PATHSPECS carries per-slug .claude/skills/<name> entries again (allowlist drift)"
else
  ok "neg: no per-slug .claude/skills/<name> entry in PATHSPECS (population cannot silently narrow)"
fi

# ── Scratch repo: a minimal shipped layout the script can enumerate with git ls-files ────────────
# Hermetic by design — seeding a probe into the real tree would leave the working copy dirty and
# make the arms order-dependent.
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/scripts" "$TMP/setup.d" "$TMP/agents"
cp "$FMT" "$TMP/scripts/format-shipped.sh"
cp "$REPO_ROOT/setup.d/lib.sh" "$TMP/setup.d/lib.sh"
cp "$REPO_ROOT/.prettierrc.json" "$TMP/.prettierrc.json"

# A ref long enough that the blob-URL rewrite widens the column past its separator row. The cell
# content is otherwise the widest in its column, so the rewrite is the ONLY thing that moves.
write_probe() { # $1 = file, $2 = "in-cell" | "outside"
  {
    printf '# probe\n\n'
    printf 'Prose above the table.\n\n'
    if [ "$2" = "in-cell" ]; then
      printf '| Verdict | Where it is written down |\n'
      printf '| --- | --- |\n'
      printf '| BUILD | record it per [build-first-reuse-default.md](../.claude/rules/build-first-reuse-default.md) |\n'
    else
      printf '| Verdict | Where it is written down |\n'
      printf '| --- | --- |\n'
      printf '| BUILD | record it per the build-first-reuse rule |\n\n'
      printf 'The rule: [build-first-reuse-default.md](../.claude/rules/build-first-reuse-default.md)\n'
    fi
  } > "$1"
  # Make the SOURCE Prettier-canonical, so any later failure is the transform's doing, not ours.
  npx --yes prettier@3.8.3 --write --ignore-path /dev/null "$1" >/dev/null 2>&1
}

write_probe "$TMP/agents/seeded.md" in-cell
write_probe "$TMP/agents/control.md" outside

( cd "$TMP" && git init -q && git add -A ) >/dev/null 2>&1

run_gate() { ( cd "$TMP" && bash scripts/format-shipped.sh --check 2>&1 ); }

# ── Arm 1: positive — the REAL tree's delivered phase is green ───────────────────────────────────
real_out=$(cd "$REPO_ROOT" && bash "$FMT" --check 2>&1); real_rc=$?
if [ "$real_rc" -eq 0 ]; then
  ok "delivered phase is GREEN on the real tree (shipped skills + agents survive transform_internal_refs)"
else
  bad "delivered phase RED on the real tree: $(printf '%s' "$real_out" | grep -c '^\[warn\]') warn line(s)"
fi

# ── Arm 2: NEG (LOAD-BEARING) — the seeded in-cell ref must turn the gate RED ────────────────────
seeded_out=$(run_gate); seeded_rc=$?
if [ "$seeded_rc" -ne 0 ] && printf '%s' "$seeded_out" | grep -qF '.claude/agents/seeded.md'; then
  ok "neg: a ref seeded INSIDE a table cell turns the gate RED and names .claude/agents/seeded.md"
else
  bad "neg: seeded in-cell ref did NOT fail the gate (rc=$seeded_rc) → delivered phase is VACUOUS"
fi

# ── Arm 3: isolation — the seeded file is SOURCE-clean, so arm 2's red is the delivered phase ────
src_rc=0
( cd "$TMP" && npx --yes prettier@3.8.3 --check --ignore-path /dev/null agents/seeded.md ) >/dev/null 2>&1 || src_rc=$?
if [ "$src_rc" -eq 0 ]; then
  ok "isolation: the seeded file passes a SOURCE-only check — only the delivered phase sees the defect"
else
  bad "isolation: the seeded file is source-dirty too — arm 2 does not prove the delivered phase fires"
fi

# ── Arm 4: control — the same ref OUTSIDE the cell must stay green ───────────────────────────────
rm -f "$TMP/agents/seeded.md"
( cd "$TMP" && git add -A ) >/dev/null 2>&1
ctrl_out=$(run_gate); ctrl_rc=$?
if [ "$ctrl_rc" -eq 0 ]; then
  ok "control: the same ref OUTSIDE the table cell stays GREEN (gate flags the transform, not tables)"
else
  bad "control: a ref outside any table cell failed the gate → over-broad: $(printf '%s' "$ctrl_out" | grep '^\[warn\]' | head -3)"
fi

echo ""
echo "delivered-prettier-conformance: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
