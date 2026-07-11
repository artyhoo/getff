#!/usr/bin/env bash
# Behaviour test for install.sh:transform_internal_refs() (sed-rewrites repo-internal
# markdown links to GitHub blob URLs at install time).
#
# Single source of truth: install.sh:39-47 — sourced in lib-only mode (INSTALL_SH_LIB_ONLY=1)
# so the function definition is available without running the install pipeline.
#
# Sub-tests covering the transform classes + idempotency:
#   1.  transforms ](../../../docs/x.md) → ](${URL}/docs/x.md)
#   1b. transforms ](../../../../docs/y.md) → ](${URL}/docs/y.md) — 4-deep depth
#   2.  transforms ](../../../packages/y.ts) → ](${URL}/packages/y.ts)
#   3.  transforms ](../../../../README.md#anchor) → ](${URL}/README.md#anchor) — preserves #anchor
#   4.  transforms ](../../rules/foo.md) → ](${URL}/.claude/rules/foo.md) — rules/ NOT shipped
#       to consumers (2026-07-10 flat-install smoke: 87 dangling links → first push RED on lychee)
#   4b. transforms ](../.claude/rules/foo.md#a) → ](${URL}/.claude/rules/foo.md#a) — agents/*.md shape
#   4c. transforms ](../../install.sh) → ](${URL}/install.sh) — skills/rules-as-tests shape
#   5.  LEAVES ](../../../hooks/bar.sh) intact (consumer has .claude/hooks/ post-install)
#   6.  idempotent — second pass produces no further change
#
# CI: invoked from .github/workflows/audit-self.yml (Mechanical checks job).

set -uo pipefail

REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL_SH="$REPO_ROOT/install.sh"

PASS=0
FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# Source install.sh in lib-only mode → exposes transform_internal_refs + UPSTREAM_BLOB_URL
UPSTREAM_BLOB_URL="https://example.test/blob/main"
INSTALL_SH_LIB_ONLY=1
# shellcheck disable=SC1090
source "$INSTALL_SH"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# Build fixture covering all 5 patterns + 1 already-transformed line for idempotency
FIXTURE="$TMPDIR/sample.md"
cat > "$FIXTURE" <<'EOF'
# Sample

- [docs link](../../../docs/meta-factory/foo.md) — should TRANSFORM
- [deep docs](../../../../docs/meta-factory/bar.md) — should TRANSFORM (4-deep)
- [pkg link](../../../packages/core/principles/x.test.ts) — should TRANSFORM
- [readme](../../../../README.md#why-this-exists) — should TRANSFORM
- [rule link](../../rules/no-paid-llm-in-ci.md) — should TRANSFORM (rules/ not shipped)
- [agent rule link](../.claude/rules/ai-laziness-traps.md#2-canonical-trap-catalogue) — should TRANSFORM
- [installer link](../../install.sh) — should TRANSFORM (framework file, not shipped)
- [hook link](../../../hooks/end-of-turn-reminder.sh) — should STAY
EOF

transform_internal_refs "$FIXTURE"
OUT=$(cat "$FIXTURE")

# Sub-test 1: docs/ rewrite (covers both 3-deep and 4-deep)
grep -qF "${UPSTREAM_BLOB_URL}/docs/meta-factory/foo.md" <<<"$OUT" \
  && ! grep -qF "../../../docs/meta-factory/foo.md" <<<"$OUT" \
  && ok "1: ../../../docs/ → ${UPSTREAM_BLOB_URL}/docs/" \
  || bad "1: docs/ rewrite failed; got: $(grep -F 'foo.md' <<<"$OUT")"

grep -qF "${UPSTREAM_BLOB_URL}/docs/meta-factory/bar.md" <<<"$OUT" \
  && ok "1b: ../../../../docs/ also rewritten (4-deep)" \
  || bad "1b: 4-deep docs/ rewrite failed; got: $(grep -F 'bar.md' <<<"$OUT")"

# Sub-test 2: packages/ rewrite
grep -qF "${UPSTREAM_BLOB_URL}/packages/core/principles/x.test.ts" <<<"$OUT" \
  && ok "2: ../../../packages/ → ${UPSTREAM_BLOB_URL}/packages/" \
  || bad "2: packages/ rewrite failed; got: $(grep -F 'x.test.ts' <<<"$OUT")"

# Sub-test 3: README.md rewrite preserves #anchor
grep -qF "${UPSTREAM_BLOB_URL}/README.md#why-this-exists" <<<"$OUT" \
  && ok "3: README.md#anchor preserved through rewrite" \
  || bad "3: README.md rewrite failed; got: $(grep -F 'why-this-exists' <<<"$OUT")"

# Sub-test 4: rules/ rewritten to blob URL (.claude/rules/ is NOT shipped to consumers)
grep -qF "](${UPSTREAM_BLOB_URL}/.claude/rules/no-paid-llm-in-ci.md)" <<<"$OUT" \
  && ! grep -qF "](../../rules/no-paid-llm-in-ci.md)" <<<"$OUT" \
  && ok "4: ../../rules/ → ${UPSTREAM_BLOB_URL}/.claude/rules/" \
  || bad "4: rules/ rewrite failed; got: $(grep -F 'rules/no-paid' <<<"$OUT")"

# Sub-test 4b: agents-shape ../.claude/rules/ rewritten, #anchor preserved
grep -qF "](${UPSTREAM_BLOB_URL}/.claude/rules/ai-laziness-traps.md#2-canonical-trap-catalogue)" <<<"$OUT" \
  && ! grep -qF "](../.claude/rules/ai-laziness-traps.md" <<<"$OUT" \
  && ok "4b: ../.claude/rules/ → ${UPSTREAM_BLOB_URL}/.claude/rules/ (#anchor preserved)" \
  || bad "4b: .claude/rules/ rewrite failed; got: $(grep -F 'ai-laziness-traps' <<<"$OUT")"

# Sub-test 4c: install.sh rewritten (framework installer, not shipped to consumers)
grep -qF "](${UPSTREAM_BLOB_URL}/install.sh)" <<<"$OUT" \
  && ! grep -qF "](../../install.sh)" <<<"$OUT" \
  && ok "4c: ../../install.sh → ${UPSTREAM_BLOB_URL}/install.sh" \
  || bad "4c: install.sh rewrite failed; got: $(grep -F 'install.sh' <<<"$OUT")"

# Sub-test 5: hooks/ left intact (consumer has .claude/hooks/)
grep -qF "](../../../hooks/end-of-turn-reminder.sh)" <<<"$OUT" \
  && ok "5: ../../../hooks/ left intact (consumer-resolvable)" \
  || bad "5: hooks/ link was modified — leak; got: $(grep -F 'hooks/end' <<<"$OUT")"

# Sub-test 6: idempotent — second pass produces identical output
BEFORE=$(cat "$FIXTURE")
transform_internal_refs "$FIXTURE"
AFTER=$(cat "$FIXTURE")
[ "$BEFORE" = "$AFTER" ] \
  && ok "6: idempotent (second pass no-op)" \
  || bad "6: NOT idempotent — diff: $(diff <(echo "$BEFORE") <(echo "$AFTER"))"

echo ""
echo "Result: ${PASS} pass / ${FAIL} fail"
[ "$FAIL" -eq 0 ]
