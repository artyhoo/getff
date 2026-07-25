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
#   4d. transforms ](../../../agents/foo.md) → ](${URL}/agents/foo.md) — S2 2026-07-25:
#       agents/ DOES ship to .claude/agents/, but the relative path from a skill file at
#       depth 3 resolves to <consumer>/agents/ (wrong) instead of <consumer>/.claude/agents/.
#       Six such leaks surfaced in the S2 corpus sweep (harvest/dispatcher/night-mode).
#   4e. transforms ](../tests/fixtures/foo/README.md) → ](${URL}/tests/fixtures/foo/README.md)
#       — S2 2026-07-25: tests/ is never shipped; one leak in shipped-agent-liveness-prober.md.
#   4f. LEAVES ](../../../scripts/foo.sh) intact — scripts/ is PARTIALLY shipped
#       (subset via setup.d/40-configs.sh); per-file ambiguity is a §4 park trigger
#       (kickoff getff-honest-signals-s2 §4). Boundary documented, not blanket-rewritten.
#   4g. transforms ](../../orchestrator-prompts/foo/kickoff.md) → ](${URL}/.claude/orchestrator-prompts/foo/kickoff.md)
#       — S2 2026-07-25 round-1 rework: .claude/orchestrator-prompts/ is NEVER delivered
#       to consumers (the only install action is mkdir_safe "$PROJECT_ROOT/.ai-factory/
#       orchestrator-prompts" at setup.d/30-templates.sh:17 — note: .ai-factory/, not
#       .claude/). One leak surfaced in .claude/skills/aif-doctor/SKILL.md:26.
#   4h. transforms ](../.claude/skills/foo/SKILL.md) → ](${URL}/.claude/skills/foo/SKILL.md)
#       — 2026-07-25 handoff item 5: agents/*.md at repo root reach skills via
#       ../.claude/skills/...; shipped to <consumer>/.claude/agents/ that ref resolves to
#       <consumer>/.claude/.claude/skills/... (doubled segment). Blob URL, not relative:
#       the target skill may be absent (aif-suite–gated). Leak: agents/fidelity-auditor.md:22.
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
- [installer anchor](../../install.sh#usage) — should TRANSFORM (anchor form)
- [shim dir](../../install.shim/x.md) — should STAY (right boundary: not install.sh)
- [agent file link](../../../agents/fidelity-auditor.md) — should TRANSFORM (S2: wrong path on consumer)
- [tests fixture](../tests/fixtures/foo/README.md) — should TRANSFORM (S2: tests/ not shipped)
- [orchestrator-prompts](../../orchestrator-prompts/aif-doctor-skill/kickoff.md) — should TRANSFORM (S2: never delivered to consumers)
- [scripts link](../../../scripts/run-local-ci-sweep.sh) — should STAY (S2 park: scripts/ partial-ship)
- [agent skill link](../.claude/skills/dispatcher/SKILL.md) — should TRANSFORM (agent shape: doubles to .claude/.claude on consumer)
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

# Sub-test 4c: install.sh rewritten (framework installer, not shipped to consumers);
# right-boundary: only `install.sh)` / `install.sh#…` forms — install.shim/ stays.
grep -qF "](${UPSTREAM_BLOB_URL}/install.sh)" <<<"$OUT" \
  && grep -qF "](${UPSTREAM_BLOB_URL}/install.sh#usage)" <<<"$OUT" \
  && ! grep -qF "](../../install.sh)" <<<"$OUT" \
  && grep -qF "](../../install.shim/x.md)" <<<"$OUT" \
  && ok "4c: ../../install.sh → ${UPSTREAM_BLOB_URL}/install.sh (anchor kept; .shim/ untouched)" \
  || bad "4c: install.sh rewrite failed; got: $(grep -F 'install.sh' <<<"$OUT")"

# Sub-test 4d: agents/ rewritten (S2 2026-07-25). agents/ ships to .claude/agents/ but
# the relative path from a skill file at depth 3 lands at <consumer>/agents/ (wrong).
grep -qF "](${UPSTREAM_BLOB_URL}/agents/fidelity-auditor.md)" <<<"$OUT" \
  && ! grep -qF "](../../../agents/fidelity-auditor.md)" <<<"$OUT" \
  && ok "4d: ../../../agents/ → ${UPSTREAM_BLOB_URL}/agents/ (S2: depth-mismatch fix)" \
  || bad "4d: agents/ rewrite failed; got: $(grep -F 'agents/fidelity' <<<"$OUT")"

# Sub-test 4e: tests/ rewritten (S2 2026-07-25). tests/ never ships to consumers.
grep -qF "](${UPSTREAM_BLOB_URL}/tests/fixtures/foo/README.md)" <<<"$OUT" \
  && ! grep -qF "](../tests/fixtures/foo/README.md)" <<<"$OUT" \
  && ok "4e: ../tests/ → ${UPSTREAM_BLOB_URL}/tests/ (S2: tests/ never shipped)" \
  || bad "4e: tests/ rewrite failed; got: $(grep -F 'tests/fixtures' <<<"$OUT")"

# Sub-test 4f: scripts/ NOT rewritten (S2 park). scripts/ is partially shipped
# (subset via setup.d/40-configs.sh); the per-file ambiguity is a §4 park trigger.
# Documents the boundary — extend with a shipped-scripts allowlist if a future
# scripts/ ref to a non-shipped script re-breaks a consumer push.
grep -qF "](../../../scripts/run-local-ci-sweep.sh)" <<<"$OUT" \
  && ok "4f: ../../../scripts/ left intact (S2 park: scripts/ partial-ship ambiguity)" \
  || bad "4f: scripts/ was rewritten — park violated; got: $(grep -F 'scripts/run' <<<"$OUT")"

# Sub-test 4g: orchestrator-prompts/ rewritten (S2 2026-07-25 round-1 rework).
# .claude/orchestrator-prompts/ is never delivered to consumers — the only install
# action is mkdir_safe "$PROJECT_ROOT/.ai-factory/orchestrator-prompts" at
# setup.d/30-templates.sh:17 (note: .ai-factory/, NOT .claude/). A skill file's
# ](../../orchestrator-prompts/...) resolves to <consumer>/.claude/orchestrator-prompts/...
# — a path that does not exist. The rewrite targets the framework blob URL under
# .claude/orchestrator-prompts/ (the framework-source path), matching the getff
# install-time mapping for repo-internal refs.
grep -qF "](${UPSTREAM_BLOB_URL}/.claude/orchestrator-prompts/aif-doctor-skill/kickoff.md)" <<<"$OUT" \
  && ! grep -qF "](../../orchestrator-prompts/aif-doctor-skill/kickoff.md)" <<<"$OUT" \
  && ok "4g: ../../orchestrator-prompts/ → ${UPSTREAM_BLOB_URL}/.claude/orchestrator-prompts/ (S2 rework: never delivered to consumer)" \
  || bad "4g: orchestrator-prompts/ rewrite failed; got: $(grep -F 'orchestrator-prompts/' <<<"$OUT")"

# Sub-test 4h: agent-shape .claude/skills/ rewritten (2026-07-25 handoff item 5).
# agents/*.md live at repo root and reach skills via ](../.claude/skills/...); shipped to
# <consumer>/.claude/agents/ the same ref resolves to <consumer>/.claude/.claude/skills/...
# — a doubled segment that does not exist. Blob URL, not a relative rewrite: the target
# skill may be absent on the consumer (aif-suite–gated, e.g. dispatcher).
grep -qF "](${UPSTREAM_BLOB_URL}/.claude/skills/dispatcher/SKILL.md)" <<<"$OUT" \
  && ! grep -qF "](../.claude/skills/dispatcher/SKILL.md)" <<<"$OUT" \
  && ok "4h: ../.claude/skills/ → ${UPSTREAM_BLOB_URL}/.claude/skills/ (agent shape: doubled-segment fix)" \
  || bad "4h: .claude/skills/ rewrite failed; got: $(grep -F '.claude/skills/dispatcher' <<<"$OUT")"

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
