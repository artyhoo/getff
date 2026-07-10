#!/usr/bin/env bash
# Ship the pipeline's orchestration companion skills to consumers.
# Pre-change, install.sh shipped only 3 skills (pipeline, tool-bootstrapping, rules-as-tests),
# leaving dispatcher (pipeline's execution companion: planning→execution via the aif-control
# loop), aif-doctor (runtime-bridge diagnosis), and template-audit (rendered-template audit)
# repo-internal — so a consumer's /pipeline run could plan but had no shipped dispatcher to
# execute, no aif-doctor to diagnose the runtime-bridge ./setup just installed, etc.
# This test asserts via the REAL install pipeline (mirror f8/f11/f13) that:
#   (pos)       the orchestration companion skills (dispatcher, aif-doctor, template-audit,
#               night-mode, ai-doc, rule-research, harvest, story) land under .claude/skills/.
#   (clean)     each skill added/edited THIS session (night-mode, ai-doc, rule-research, harvest,
#               story) carries no dangling TRANSFORM-TARGET link — transform rewrites docs/packages/README
#               to blob URLs; rules/ + hooks/ stay relative by convention (transform-internal-refs #4/#5).
#   (transform) dispatcher's repo-internal markdown refs are rewritten to GitHub blob URLs
#               (the same transform pipeline gets) so a doc link can't point at a path absent
#               from the consumer tree.
#   (non-vac)   the SOURCE dispatcher actually carries such refs, so the transform check is
#               not vacuously passing on an empty set.
#   (neg)       a never-shipped skill name is genuinely absent — the existence check discriminates.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

T=$(mktemp -d)
printf '{"name":"ship-orch","version":"0.0.0"}\n' > "$T/package.json"
# --with-aif-suite: the transform check targets the AIF operator suite (dispatcher, aif-doctor,
# night-mode, harvest, story), which the F7 split gates behind this flag. The default set no
# longer ships them — the flag installs the full nine so this transform assertion stays reachable.
( cd "$T" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force --with-aif-suite ) >/dev/null 2>&1

# ── pos: the orchestration companion skills land ─────────────────────────────
for s in dispatcher aif-doctor template-audit night-mode ai-doc rule-research harvest story; do
  if [ -f "$T/.claude/skills/$s/SKILL.md" ]; then
    ok "skill shipped: .claude/skills/$s/SKILL.md"
  else
    bad "skill NOT shipped: .claude/skills/$s/SKILL.md"
  fi
done

# ── transform: repo-internal refs rewritten, none left dangling ──────────────
D="$T/.claude/skills/dispatcher/SKILL.md"
if [ -f "$D" ]; then
  if grep -qE '\]\((\.\./)+(docs|packages)/' "$D" || grep -qE '\]\((\.\./)+README\.md' "$D"; then
    bad "dispatcher SKILL.md still has un-transformed repo-internal refs (consumer-dangling)"
  else
    ok "dispatcher repo-internal refs transformed (no surviving ../../../{docs,packages,README}; rules/+hooks/ stay relative by convention)"
  fi
  grep -q 'github.com/.*/blob/' "$D" \
    && ok "dispatcher refs rewritten to GitHub blob URLs" \
    || bad "dispatcher has no blob URL — transform did not run"
else
  bad "dispatcher SKILL.md missing — cannot check transform"
fi

# ── non-vacuity: the SOURCE dispatcher has repo-internal refs to transform ────
if grep -qE '\]\((\.\./)+(docs/|README\.md)' "$REPO_ROOT/.claude/skills/dispatcher/SKILL.md"; then
  ok "source dispatcher carries repo-internal refs (transform assertion is non-vacuous)"
else
  bad "source dispatcher has NO repo-internal refs — transform assertion would be vacuous"
fi

# ── clean (2026-07-04): the skills added/edited THIS session carry no dangling TRANSFORM-TARGET link ──
# transform_internal_refs rewrites docs/packages/README refs to blob URLs; rules/ + hooks/ stay relative
# by convention (tests/install-sh/transform-internal-refs.test.sh #4/#5 — deemed consumer-local). A
# surviving ](../…/{docs,packages}/ , ](../…/README.md , or ](../…/install.sh (never transformed) in a
# SHIPPED copy = a transform miss (consumer-dangling). Sibling-skill + same-dir links are consumer-valid.
# (rules/ links stay relative for EVERY shipped skill incl. dispatcher — the latent "rules/ not shipped"
# inconsistency is flagged in setup.d/lib.sh, out of this test's scope.)
for s in night-mode ai-doc rule-research harvest story; do
  SF="$T/.claude/skills/$s/SKILL.md"
  [ -f "$SF" ] || { bad "clean-check: shipped skill missing: $s"; continue; }
  if grep -qE '\]\((\.\./)+(docs|packages)/|\]\((\.\./)+(README\.md|install\.sh)' "$SF"; then
    bad "$s: surviving transform-target repo-internal link (consumer-dangling) — transform missed it"
  else
    ok "$s: no dangling transform-target link"
  fi
done
# night-mode carries docs/ refs → its shipped copy must show blob URLs (transform actually ran):
grep -q 'github.com/.*/blob/' "$T/.claude/skills/night-mode/SKILL.md" \
  && ok "night-mode transform ran (blob URLs present)" \
  || bad "night-mode has no blob URL — transform did not run"

# ── neg (load-bearing): a never-shipped skill name is genuinely absent ────────
if [ -f "$T/.claude/skills/__never_shipped__/SKILL.md" ]; then
  bad "neg arm vacuous: a bogus skill path reported present"
else
  ok "neg arm: bogus skill path correctly absent (existence check discriminates)"
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
