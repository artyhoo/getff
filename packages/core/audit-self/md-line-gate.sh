#!/usr/bin/env bash
# md-line-gate.sh — markdown overweight gate (≤600 lines) with declared-transient
# exemptions. Single source for the audit-self CI "No file > 500 lines (markdown)"
# step (.github/workflows/audit-self.yml); extracted from inline YAML so the gate
# is unit-testable (cross-session kickoff portability I-phase, SSOT #116 — the
# kickoff exemption ships with a paired positive+negative test, no discipline-theatre).
#
# Exemptions (each per-file/glob exemption requires an in-file "transient artifact"
# marker in the first 20 lines; directory-level audit-trail accumulators do not):
#   - EXEMPT (per-file):  docs/meta-factory/EXECUTION-PLAN.md   (transient pre-1.0 plan)
#   - EXEMPT_DIRS:        docs/meta-factory/research-patches/    (evidence accumulator,
#                         length ∝ investigation depth)
#   - kickoffs (glob):    .claude/orchestrator-prompts/*/kickoff.md  (committed durable
#                         design docs; may exceed 600 lines IFF marked — SSOT #116)
#
# Usage: md-line-gate.sh [<root-dir>]   (default root = ".")
# Exit 0 = every markdown file within the 600-line limit (or exempt); exit 1 =
# at least one overweight non-exempt file. GitHub `::notice`/`::error` annotations
# are emitted for the Actions log.
set -euo pipefail

ROOT="${1:-.}"
fail=0

# Exempt list: declared-transient artifacts per their own disclaimer.
# Each entry MUST include rationale comment + carry the "transient artifact" marker.
EXEMPT=(
  "${ROOT}/docs/meta-factory/EXECUTION-PLAN.md"  # transient pre-1.0 plan, see line 8
)
# Exempt directories: audit-trail accumulators where length is proportional to
# investigation depth, not freedom-of-prose. Each entry MUST include rationale.
EXEMPT_DIRS=(
  "${ROOT}/docs/meta-factory/research-patches/"  # research-patches: evidence accumulator, length ∝ investigation depth
)

while IFS= read -r f; do
  # Directory-level exemption first (cheaper than per-file marker check)
  for ex_dir in "${EXEMPT_DIRS[@]}"; do
    case "$f" in
      "$ex_dir"*) continue 2 ;;
    esac
  done
  # Kickoff design docs (cross-session kickoff portability, SSOT #116): committed
  # durable docs that may exceed 600 lines IF they carry a "transient artifact"
  # marker in the first 20 lines — mirrors the per-file EXEMPT marker guard below,
  # but pattern-matched (kickoffs are a glob, not a fixed list). No marker → falls
  # through to the size check below (oversized → error).
  case "$f" in
    "${ROOT}/.claude/orchestrator-prompts/"*/kickoff.md)
      if grep -qi "transient artifact" <<<"$(head -20 "$f")"; then
        echo "::notice file=$f::skipped overweight check (declared transient kickoff)"
        continue
      fi
      ;;
  esac
  for ex in "${EXEMPT[@]}"; do
    if [ "$f" = "$ex" ]; then
      if grep -qi "transient artifact" <<<"$(head -20 "$f")"; then
        echo "::notice file=$f::skipped overweight check (declared transient)"
        continue 2
      else
        echo "::error file=$f::listed in EXEMPT but no 'transient artifact' marker in first 20 lines"
        fail=1
        continue 2
      fi
    fi
  done
  n=$(wc -l < "$f")
  if [ "$n" -gt 600 ]; then
    echo "::error file=$f::overweight ($n lines, max 600)"
    fail=1
  fi
done < <(find "$ROOT" -name "*.md" -not -path "*/.git/*" -not -path "*/node_modules/*")
exit "$fail"
