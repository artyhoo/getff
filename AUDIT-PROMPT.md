# Audit prompt for fresh AI session

> Copy the prompt below into a NEW Claude Code session (or any AI agent with file access). The fresh-session aspect is intentional — it's the two-AI review pattern applied to the package itself.

---

## Why a fresh session

This package was created by AI in one session. AI has blind spots about its own work. A different session, with no memory of how the package was built, audits with cleaner eyes — same logic as `review-sidecar` for code review.

---

## The audit prompt — copy and paste

```text
You are auditing the rules-as-tests-aif package as an external reviewer.
You did NOT build this. You have NO memory of design decisions. Be skeptical.

Your job: find bugs, dead links, conceptual gaps, duplication, overweight files,
or claims the package can't substantiate.

You report. You do NOT fix anything in this session. (Fixes happen in a follow-up
session with full context, after I review your findings.)

═══════════════════════════════════════════════════════════════
PHASE 1 — Mechanical checks (use bash, ~5 minutes)
═══════════════════════════════════════════════════════════════

Run these commands and report each result clearly:

1. File count and structure:
   find . -type f | wc -l
   find . -type d
   du -sh .

2. Bash syntax of all .sh files:
   for f in $(find . -name "*.sh"); do
     bash -n "$f" 2>&1 && echo "✓ $f" || echo "✗ $f"
   done

3. JSON validity:
   for f in $(find . -name "*.json"); do
     python3 -c "import json; json.load(open('$f'))" 2>&1 && echo "✓ $f" || echo "✗ $f"
   done

4. File sizes (any > 600 lines is overweight):
   find . -name "*.md" | while read f; do
     L=$(wc -l < "$f"); [ "$L" -gt 600 ] && echo "$L: $f"
   done

5. Markdown links to .md files — find dead-end references:
   for src in $(find . -name "*.md"); do
     grep -oE "\`[^\`]*\.md\`" "$src" | tr -d '`' | sort -u | while read ref; do
       case "$ref" in
         *.ai-factory/*|*AGENTS.md|*CLAUDE.md|*.template.md|*\<*) continue ;;
       esac
       base=$(basename "$ref")
       find . -name "$base" 2>/dev/null | grep -q . || echo "DEAD: $src → $ref"
     done
   done | sort -u

6. Stale path / stale-agent references:
   grep -rs "ai-factory-RULES\.md" --include="*.md" --include="*.sh" . | grep -v node_modules
   # Should be empty (historical rename → packages/preset-*/RULES.md).
   # Post-C-1: our best-practices-sidecar is de-shipped (KEEP-AIF), docs-auditor renamed
   # → living-docs-auditor. No agent FILE or active WIRING should carry the old names
   # (prose mentions like "renamed from docs-auditor" are fine):
   ls agents/best-practices-sidecar.md agents/docs-auditor.md 2>&1   # both: No such file
   grep -nE '"agents/(best-practices-sidecar|docs-auditor)\.md"' install.sh extension.json
   # Should be empty.

═══════════════════════════════════════════════════════════════
PHASE 2 — Rule-to-probe mapping (~5 minutes)
═══════════════════════════════════════════════════════════════

The package's core principle: every rule has an executable check.
Verify the package follows its own principle.

7. Extract all R-rules from RULES.md (source-repo canonical home):
   grep "^## R" packages/preset-next-15-canonical/RULES.md

8. Extract probes from the source-repo audit script:
   grep -E "skip_unless [RD]" packages/core/audit-self/audit-ai-docs.sh

9. Cross-check: for each R-rule, verify EITHER:
   - It has a probe in audit-ai-docs.sh (skip_unless R<N> exists), OR
   - The audit-script header strategy block (lines 8-18) marks it "manual review only"
     or "delegated to ESLint/depcruise" (post-C-1 home of what best-practices-sidecar.md
     used to hold), OR
   - It appears in the aif-rules-check skill-context residue
     (packages/core/templates/shared/skill-context/aif-rules-check/SKILL.md — R4/R10/R17)
   - Otherwise report ORPHAN RULE

10. Same check for R12-R20:
    grep "^## R" packages/preset-next-15-canonical/RULES.react-next.md
    vs packages/preset-next-15-canonical/audit-self/audit-ai-docs.react-next.sh

═══════════════════════════════════════════════════════════════
PHASE 3 — Content quality (~15 minutes, requires reading)
═══════════════════════════════════════════════════════════════

11. Read skills/rules-as-tests/SKILL.md. Verify:
    - description starts with "Use when"
    - ≥5 trigger keywords
    - ≤500 lines
    - Index of references is up-to-date with files in references/

12. Read references/overview.md and references/checks-map.md.
    Question: do they duplicate the "5-layer framework" exposition? They should
    NOT — overview explains layers, checks-map maps to enforcement levels.
    If both contain a paragraph saying "five layers: architecture, meta-tests,
    spec-by-example, mutation, living docs" — flag as duplication.

13. Read the three shipped agents (post-C-1; best-practices-sidecar is KEEP-AIF, not ours):
    agents/review-sidecar.md, agents/living-docs-auditor.md, agents/compliance-verifier.md.
    Question: are responsibilities clearly different?
    - review-sidecar = catches tautological/mock-only tests in a diff
    - living-docs-auditor = runs audit-ai-docs.sh, reports backward code-vs-docs drift
    - compliance-verifier = reviews PR §1.7 Forward/Backward section substance
    If any two overlap (same job, different wording) — flag duplication.

14. Read references/ai-traps.md "Lessons learned" section.
    For each lesson, check it has:
    - Concrete observed failure (not generic "be careful")
    - Generalizable lesson
    - Executable detection rule (or explicitly noted as manual review)

15. Read packages/core/templates/shared/DESCRIPTION.template.md and
    packages/core/templates/shared/ARCHITECTURE.ts-server.md.
    Verify all <PLACEHOLDER> markers are valid YAML/Markdown
    (matched brackets, comments explaining what to fill in).

═══════════════════════════════════════════════════════════════
PHASE 4 — Self-application (does the package follow its own rules?)
═══════════════════════════════════════════════════════════════

16. R10 — Naming: each file named after its content?
    Examples to check:
    - audit-ai-docs.sh — yes, audits AI docs
    - living-docs-auditor.md — yes, audits Living-Documentation drift
    - compliance-verifier.md — yes, verifies PR §1.7 compliance
    - checks-map.md — yes, maps checks to layers
    Flag any file with misleading name.

17. References to outer corpus: do any .md in this package reference
    files that are NOT part of the package? (e.g., "see pravila-kak-testy.md")
    If yes — these are external context that won't be available to users.
    Flag and suggest either removing or marking as "external context".

18. Token economy claim: SKILL.md should describe the package's token usage.
    Calculate actual usage:
    - SKILL.md lines × 30 = approx tokens always loaded
    - References combined × 30 = max tokens if all references load
    Report whether the package is "lightweight" as claimed in README.

═══════════════════════════════════════════════════════════════
PHASE 5 — Setup verification (~5 min, optional, requires sandbox)
═══════════════════════════════════════════════════════════════

19. (If you have a sandbox) — run setup.sh with --skip-deps in /tmp/test
    and verify:
    - ai-factory init creates .ai-factory/
    - install.sh overlays without crashing
    - npm scripts added to package.json
    - .husky/pre-commit and pre-push installed

20. Negative test for audit-ai-docs.sh:
    - In sandbox, create src/domain/bad.ts with `const _ = Date.now()`
    - Run bash scripts/audit-ai-docs.sh
    - EXPECTED: exit code 1, R7 reports FAIL
    - If it doesn't catch — the regex is broken

═══════════════════════════════════════════════════════════════
PHASE 6 — Self-meta-test (does the package's own infra still work?)
═══════════════════════════════════════════════════════════════

These two artifacts are LOAD-BEARING for the package's "rules as tests"
thesis applied to itself. They were added in earlier audit cycles. Verify
they exist AND still work — silent regression here is severity BLOCKER.

21. CI for the package itself (.github/workflows/audit-self.yml).

    Check:
    cat .github/workflows/audit-self.yml | grep -E "^  [a-z-]+:$"

    EXPECTED: at least three jobs — `mechanical:` (bash/json/dead-links),
    `rule-to-probe:` (orphan-rule check), `probe-tests:` (runs negative tests).
    (Reality 2026-05: many more — manifest-render-check, principles-meta-tests,
    enforce-husky-presence, framework-self-install-*, framework-self-detect/research/synth/validate.)

    Run the rule-to-probe logic locally to verify it doesn't false-positive (post-C-1:
    enforcement strategy lives in the audit-script header + skill-context residue, NOT in
    best-practices-sidecar.md which is no longer ours):

    fail=0
    AUDIT_TS=packages/core/audit-self/audit-ai-docs.sh
    AUDIT_RN=packages/preset-next-15-canonical/audit-self/audit-ai-docs.react-next.sh
    RESIDUE=packages/core/templates/shared/skill-context/aif-rules-check/SKILL.md
    for rules_file in packages/preset-next-15-canonical/RULES.md \
                      packages/preset-next-15-canonical/RULES.react-next.md; do
      for r in $(grep -oE "^## R[0-9]+[a-z]?" "$rules_file" | grep -oE "R[0-9]+[a-z]?"); do
        in_audit=0
        grep -qE "skip_unless ${r}[a-z]*\b|^#.*\b${r}[a-z]*\b" "$AUDIT_TS" "$AUDIT_RN" 2>/dev/null && in_audit=1
        in_residue=0
        grep -qE "\b${r}\b" "$RESIDUE" 2>/dev/null && in_residue=1
        [ "$in_audit" -eq 0 ] && [ "$in_residue" -eq 0 ] && { echo "ORPHAN: $r"; fail=1; }
      done
    done
    echo "exit=$fail"

    If file is missing, jobs are missing, or local check reports any ORPHAN
    or exit≠0 — REPORT as BLOCKER "Self-audit CI broken/missing".
    Past breakage: regex `R[0-9a-z]+` greedily matched `## Rule maintenance`,
    and `\b` boundary failed on R16a/R16b sub-probes. Verify both are fixed.

22. Negative tests for audit-ai-docs.sh probes.

    Check:
    npx vitest run packages/core/audit-self/audit-ai-docs.test.ts

    EXPECTED: exit 0, all tests pass (vitest — ported from the old bash
    negative-test harness, Wave 10.4). Each test injects a violation in a temp
    dir, runs the probe with --only=R<N>/D<N>, asserts the probe catches it.
    NOTE: only the core (ts-server) probes are negative-tested; the react-next probes
    (packages/preset-next-15-canonical/audit-self/audit-ai-docs.react-next.sh) have
    no paired negative-test file — flag as a MAJOR finding.

    If file is missing, exit≠0, or any test FAILs — REPORT as BLOCKER
    "Probes without working negative tests — silent breakage risk".
    The probe regex can rot at any time; this is the only thing keeping it honest.

23. Self-application: does the package itself pass its own audit?

    Check (source-repo canonical path; scripts/audit-ai-docs.sh is the CONSUMER path):
    bash packages/core/audit-self/audit-ai-docs.sh
    echo "exit=$?"

    EXPECTED: exit 0, no FAILs (WARNs from D1/D2/D4 are acceptable if AGENTS.md,
    .mcp.json, or .ai-factory/tool-decisions.md don't exist at package root —
    the package itself doesn't ship them).

    If any FAIL appears — REPORT as BLOCKER "Package fails its own audit".
    Past breakage: leftover negative-test artifacts (src/, AGENTS.md with
    `phantom-skill`, .mcp.json with `_comment_TODO`) accumulated in the package
    root and triggered 7 FAILs. These should not be committed; ensure they're
    not present.



Produce a structured report. For each finding:

## Finding N
- **Severity**: BLOCKER | MAJOR | MINOR | INFO
- **Phase**: <which phase found it>
- **Location**: <file:line or section>
- **What I saw**: <one sentence>
- **Why it's a problem**: <one or two sentences>
- **Suggested fix**: <one sentence — don't write the actual fix, describe it>

Severity rules:
- BLOCKER — package won't work as advertised (e.g., setup.sh crashes, dead link
  in installation instructions, audit script has bug that misses violations)
- MAJOR — significant quality issue (e.g., conceptual duplication between docs,
  rule without enforcement, misleading claim)
- MINOR — cosmetic (e.g., typo, minor inconsistency in formatting)
- INFO — observation worth noting but not a defect

After all findings, output a summary:
- Total: N findings (X BLOCKER, Y MAJOR, Z MINOR, W INFO)
- Recommendation: SHIP / FIX-AND-SHIP / REWORK
  - SHIP — only INFO and ≤3 MINOR
  - FIX-AND-SHIP — ≤2 MAJOR and no BLOCKER
  - REWORK — any BLOCKER or >2 MAJOR

Do NOT make changes to any files. Report only.
```

---

## After the audit

1. Save the audit output to a file (e.g., `audit-results-<date>.md`).
2. Review findings yourself — agree/disagree with each.
3. In a NEW session, prompt the AI to fix the agreed findings:
   ```text
   Read audit-results-<date>.md. For each finding I marked as "AGREE",
   apply the suggested fix. Do not touch findings I marked "DISAGREE".
   After fixes, re-run AUDIT-PROMPT.md PHASE 1-2 to verify.
   ```
4. Iterate until findings are: 0 BLOCKER, ≤2 MAJOR, ≤5 MINOR.

---

## Why two-AI

This is the same pattern as `review-sidecar` in the package itself: a fresh AI
without context catches things the original author missed. The package was
created in one session; AI in that session optimized for "produce valid output",
which is a different goal than "find what's wrong with the output".

The fresh session has no investment in the existing decisions. Its job is to
break the package on paper — and that's what makes it useful.
