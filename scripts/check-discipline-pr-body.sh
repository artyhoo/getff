#!/usr/bin/env bash
# Production §1.7 grammar checker. PR_BODY is data, never evaluated as shell.
set -euo pipefail

if [ -z "${PR_BODY:-}" ]; then
  echo "::error::PR description is empty. PR touches discipline-bearing files."
  echo "Required: ### §1.7 Forward-check applied + ### §1.7 Backward-check applied"
  echo "Or: ### §1.7 Skipped: <rationale ≥60 chars>"
  echo "See: .claude/rules/phase-research-coverage.md §1.7"
  exit 1
fi

# Skip marker shortcuts the gate. Body must be ≥60 chars after the colon.
if grep -qE '^### §1\.7 Skipped:.{60,}' <<<"$PR_BODY"; then
  echo "✅ §1.7 Skipped marker present with ≥60-char rationale."
  exit 0
fi

# Extract section bodies via awk: from "### §1.7 <Section>" to next "###"
forward_body=$(echo "$PR_BODY" | awk '
  /^### §1\.7 Forward-check applied/ { capture=1; next }
  /^###/ { capture=0 }
  capture { print }
' | tr -d '[:space:]' | wc -c)

backward_body=$(echo "$PR_BODY" | awk '
  /^### §1\.7 Backward-check applied/ { capture=1; next }
  /^###/ { capture=0 }
  capture { print }
' | tr -d '[:space:]' | wc -c)

fail=0
if [ "$forward_body" -lt 40 ]; then
  echo "::error::Missing or too-short \"### §1.7 Forward-check applied\" section (${forward_body} non-whitespace chars, need ≥40)."
  fail=1
fi
if [ "$backward_body" -lt 40 ]; then
  echo "::error::Missing or too-short \"### §1.7 Backward-check applied\" section (${backward_body} non-whitespace chars, need ≥40)."
  fail=1
fi

if [ "$fail" -eq 1 ]; then
  echo ""
  echo "PR touches discipline-bearing files (.claude/rules/, packages/core/principles/, EXECUTION-PLAN, prior-art-evaluations, CLAUDE.md, or shipped templates)."
  echo ""
  echo "PR description must include either:"
  echo "  ### §1.7 Forward-check applied"
  echo "  <body ≥40 chars enumerating which existing disciplines were checked>"
  echo ""
  echo "  ### §1.7 Backward-check applied"
  echo "  <body ≥40 chars enumerating the sweep of existing artefacts under the new rule's scope>"
  echo ""
  echo "OR a skip marker:"
  echo "  ### §1.7 Skipped: <reason ≥60 chars>"
  echo ""
  echo "Reference: .claude/rules/phase-research-coverage.md §1.7"
  echo "Skill:     .claude/skills/self-reflection/SKILL.md"
  exit 1
fi

echo "✅ §1.7 sections present and non-empty (forward: ${forward_body} chars, backward: ${backward_body} chars)."

# Substance gate: Forward-check section must cite at least one file:line ref.
# Catches generic prose like "Checked existing rules R1-R20 — compliant."
# Regex: at-least-one non-whitespace path component ending in .ext:N
forward_citations=$(echo "$PR_BODY" | awk '
  /^### §1\.7 Forward-check applied/ { capture=1; next }
  /^###/ { capture=0 }
  capture { print }
' | grep -cE '[^[:space:]]+\.[a-z]+:[0-9]+' || true)

if [ "$forward_citations" -lt 1 ]; then
  echo "::error::Forward-check section contains 0 file:line citations (regex [^[:space:]]+\\.[a-z]+:[0-9]+)."
  echo "Substance arm (Wave 8.1) — §1.7 must cite specific evidence, not generic prose."
  echo "Example: 'packages/core/principles/02-paired-negative-test.test.ts:82 mutation arm verified'" # cite:historical example text for the trailer shape, not a live pointer
  echo "Bootstrap exemption: §1.7 Skipped marker with rationale ≥60 chars."
  exit 1
fi
echo "✅ Forward-check cites ${forward_citations} file:line reference(s)."

# Substance gate: Backward-check section must cite at least one file:line ref
# (parity with Forward-check Wave 8.1 substance arm). Catches quantifier
# confabulation: prose like "all 13 X audited" without any verifiable citation.
# Regex: at-least-one non-whitespace path component ending in .ext:N
backward_citations=$(echo "$PR_BODY" | awk '
  /^### §1\.7 Backward-check applied/ { capture=1; next }
  /^###/ { capture=0 }
  capture { print }
' | grep -cE '[^[:space:]]+\.[a-z]+:[0-9]+' || true)

if [ "$backward_citations" -lt 1 ]; then
  echo "::error::Backward-check section contains 0 file:line citations (regex [^[:space:]]+\\.[a-z]+:[0-9]+)."
  echo "Substance arm (Forward-check Wave 8.1 parity) — §1.7 Backward-check must cite specific evidence, not generic prose."
  echo "Example: 'packages/core/hooks/checks/s17.test.ts:16 all body-prose test cases ported to vitest (Wave 10.3)'"
  echo "Bootstrap exemption: §1.7 Skipped marker with rationale ≥60 chars."
  exit 1
fi
echo "✅ Backward-check cites ${backward_citations} file:line reference(s)."
