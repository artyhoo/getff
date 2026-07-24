#!/usr/bin/env bash
# packages/core/audit-self/audit-ai-docs.sh
#
# Code-vs-docs consistency audit for server-side TypeScript projects.
# Each probe maps EXPLICITLY to a rule number from .ai-factory/RULES.md.
#
# Rule mapping:
#   R1  TypeScript hygiene       → delegated to ESLint (no-explicit-any, no-non-null-assertion)
#   R2  Validation at boundaries → delegated to local ESLint rule (rules-as-tests/no-unsafe-zod-parse)
#   R3  Architectural boundaries → delegated to dependency-cruiser (run separately)
#   R4  Tests for new code       → scripts/audit-r4.ts in consumer project (ts-morph; checks export presence + reference in .unit.ts)
#   R5  Async correctness        → delegated to ESLint no-floating-promises
#   R6  Errors                   → delegated to ESLint (no-throw-literal, no-useless-catch)
#   R7  Time/randomness/IO       → delegated to local ESLint rule (rules-as-tests/no-direct-time-randomness)
#   R8  Observability            → delegated to local ESLint rule (rules-as-tests/require-otel-span)
#   R9  Imports/dependencies     → delegated to ESLint (no-restricted-imports)
#   R10 Naming                   → manual review only (not formalisable)
#   R11 CI integrity             → manual review only
#
# Drift checks (separate from R-rules):
#   D1 Skills declared exist     → probe_D1
#   D2 No TODO in JSON configs   → probe_D2
#   D3 Goal-phrase parity        → probe_D3 (sub-wave 7.1.d; authoring repo only — consumer installs skip, see AUDIT_MODE)
#   D4 Tool-decisions staleness  → probe_D4
#   D5 Inverse enrollment        → probe_D5 (authoring repo only — consumer installs skip, see AUDIT_MODE)
#
# Exit codes:
#   0 — all probes PASS (WARN allowed)
#   1 — at least one FAIL
#
# Run time: target 5-10 seconds on typical codebase.
#
# IMPORTANT: every probe should have a matching negative test.
# See references/self-testing-docs.md for the pattern.

set -uo pipefail

FAIL_COUNT=0
PASS_COUNT=0
WARN_COUNT=0

if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; NC=''
fi

pass() { echo -e "${GREEN}PASS${NC}: $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo -e "${RED}FAIL${NC}: $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }
warn() { echo -e "${YELLOW}WARN${NC}: $1"; WARN_COUNT=$((WARN_COUNT + 1)); }

# Allow --only=R<N> or --only=D<N> to run a single probe (useful for negative testing)
ONLY=""
for arg in "$@"; do
  case "$arg" in --only=*) ONLY="${arg#--only=}" ;; esac
done

skip_unless() {
  [ -z "$ONLY" ] && return 1
  [ "$ONLY" = "$1" ] && return 1
  return 0
}

# R1: delegated to ESLint rules @typescript-eslint/no-explicit-any + no-non-null-assertion

# R2: delegated to local ESLint rule rules-as-tests/no-unsafe-zod-parse

# ────────────────────────────────────────────────────────────────────────
# R4 — Tests for new public code: every domain export has .unit.ts
# Mapped to .ai-factory/RULES.md R4
# Implementation: ts-morph script (scripts/audit-r4.ts in consumer project).
# Falls back to "skipped" if tooling missing — keeps the script
# usable in environments without Node/tsx (e.g. fresh setup before npm install).
# ────────────────────────────────────────────────────────────────────────
if skip_unless R4; then : ; else
  RULE="R4: Every public export in src/domain has matching .unit.ts (ts-morph)"
  if [ ! -d src/domain ]; then
    warn "$RULE (skipped: no src/domain — probe could not run)"
  elif ! command -v npx >/dev/null 2>&1; then
    warn "$RULE (skipped: npx not found)"
  elif [ ! -f tsconfig.json ] && [ ! -f node_modules/ts-morph/package.json ]; then
    warn "$RULE (skipped: no tsconfig.json and ts-morph not installed)"
  else
    if npx --no-install tsx scripts/audit-r4.ts 2>&1; then
      pass "$RULE"
    else
      fail "$RULE"
    fi
  fi
fi

# R6: delegated to ESLint rules no-throw-literal + no-useless-catch

# R7: delegated to local ESLint rule rules-as-tests/no-direct-time-randomness

# R8: delegated to local ESLint rule rules-as-tests/require-otel-span

# R9: delegated to ESLint rule no-restricted-imports (lodash/moment/axios/request/node-fetch)

# ════════════════════════════════════════════════════════════════════════
# Drift detection probes (separate from R-rules — these check infrastructure)
# ════════════════════════════════════════════════════════════════════════

# ────────────────────────────────────────────────────────────────────────
# D1 — Skills declared in AGENTS.md exist in .claude/skills/
# ────────────────────────────────────────────────────────────────────────
if skip_unless D1; then : ; else
  RULE="D1 (drift): skills declared in AGENTS.md exist on disk"
  if [ ! -f AGENTS.md ]; then
    warn "$RULE: AGENTS.md not found, skipping"
  else
    VIOL=""
    # Portable extraction: works on BSD grep (macOS) and GNU grep alike.
    # Pattern: ` skill `<name>` ` — capture <name> between backticks.
    while read -r s; do
      [ -z "$s" ] && continue
      [ -d ".claude/skills/$s" ] || VIOL="$VIOL"$'\n'"skill '$s' declared in AGENTS.md but missing from .claude/skills/"
    done < <(awk 'match($0, /skill `[^`]+`/) { print substr($0, RSTART+7, RLENGTH-8) }' AGENTS.md 2>/dev/null | grep -v '^<' | sort -u)

    if [ -z "$VIOL" ]; then
      pass "$RULE"
    else
      fail "$RULE"
      echo "$VIOL" | sed 's/^/    /'
    fi
  fi
fi

# ────────────────────────────────────────────────────────────────────────
# D2 — No TODO / _comment in JSON configs
# ────────────────────────────────────────────────────────────────────────
if skip_unless D2; then : ; else
  RULE="D2 (drift): no TODO/_comment in JSON configs"
  VIOL=$(grep -E "_comment|TODO|FIXME" \
    .mcp.json .claude/settings.json .ai-factory/*.json 2>/dev/null || true)

  if [ -z "$VIOL" ]; then
    pass "$RULE"
  else
    warn "$RULE — JSON configs accumulate stale comments"
    echo "$VIOL" | sed 's/^/    /'
  fi
fi

# ────────────────────────────────────────────────────────────────────────
# Canonical goal phrase — shared by D3 and D5 (defined globally so D5 can
# reference DOWNSTREAM_DOCS when invoked with --only=D5 without D3 running).
#
# SSOT entry: prior-art-evaluations.md#16 (verdict BUILD — sub-wave 7.1.d).
# Surface fix (Wave 8.2): extended from 2 entries to 4 after grep-sweep
# revealed .claude/hooks/inject-session-bootstrap.sh and
# docs/meta-factory/EXECUTION-PLAN.md as unenrolled active downstream docs
# (Incident-4: research-patches/2026-05-11-d3-downstream-docs-completeness.md).
# ────────────────────────────────────────────────────────────────────────
CANON_PHRASE="AI agents can't silently bypass undocumented conventions"
CANON_ALT="AI cannot silently bypass what fails CI"
DOWNSTREAM_DOCS=(
  ".claude/session-bootstrap.md"
  "CLAUDE.md"
  ".claude/hooks/inject-session-bootstrap.sh"
  "docs/meta-factory/EXECUTION-PLAN.md"
  "AGENTS.md"
)

# Mode detection (D3/D5 only): authoring repo vs consumer install.
# D3/D5 are authoring-repo drift probes — they track goal-phrase parity across
# THIS framework's own goal-bearing docs, none of which install.sh ships to
# consumers (it ships an AGENTS.md.template + .ai-factory/RULES.md; the rendered
# consumer AGENTS.md is consumer-authored and does not carry the canonical
# phrase — unlike the authoring-repo root AGENTS.md, this framework's own
# portable rule index for off-CC harnesses, which carries the phrase and is
# therefore enrolled in DOWNSTREAM_DOCS above). Without this gate every fresh
# consumer install failed D3
# (4× "file not found") and D5 (the installed script itself is a phrase-carrying
# orphan at scripts/audit-ai-docs.sh — TEST_INFRA only exempts the authoring
# path), making install.sh's "Run ./scripts/audit-ai-docs.sh — should PASS"
# unsatisfiable (verified 2026-06-11 on a fresh /tmp install).
# Capability check, not brand-name (dual-implementation-discipline §4): the
# framework source tree uniquely contains this script's own source path;
# consumer installs receive only scripts/audit-ai-docs.sh (+ the unrelated
# packages/core/hooks/pre-push.fallback.sh).
if [ -f "packages/core/audit-self/audit-ai-docs.sh" ]; then
  AUDIT_MODE="authoring"
else
  AUDIT_MODE="consumer"
fi

# ────────────────────────────────────────────────────────────────────────
# D3 — Goal-phrase parity: canonical phrase present in downstream goal-bearing docs
# Source: Wave 6 D-3 SHIP-B (added sub-wave 7.1.d, 2026-05-11)
#
# Canonical goal phrase (README.md §Goal):
#   "AI agents can't silently bypass undocumented conventions"
#   Synonym: "AI cannot silently bypass what fails CI"
#
# Checked downstream docs (enumerated explicitly — not regex-matched globally):
#   .claude/session-bootstrap.md          — operational restatement (must carry goal)
#   CLAUDE.md                             — AI-tooling conventions (must carry goal pointer)
#   .claude/hooks/inject-session-bootstrap.sh — injects phrase into every session
#   docs/meta-factory/EXECUTION-PLAN.md   — operational planning doc (Incident-3 drift source)
#
# SSOT entry: prior-art-evaluations.md#16 (verdict BUILD — no production analog
# for doc-vs-doc goal-phrase parity check; see 7.1.d context7 sweep).
# ────────────────────────────────────────────────────────────────────────
if skip_unless D3; then : ; else
  RULE="D3 (drift): canonical goal phrase present in downstream goal-bearing docs"
  if [ "$AUDIT_MODE" = "consumer" ]; then
    pass "$RULE (skipped: consumer install — authoring-repo goal docs are not part of the shipped payload)"
  else
    D3_VIOL=""
    for doc in "${DOWNSTREAM_DOCS[@]}"; do
      if [ ! -f "$doc" ]; then
        D3_VIOL="$D3_VIOL"$'\n'"  $doc: file not found"
        continue
      fi
      if ! grep -qF "$CANON_PHRASE" "$doc" && ! grep -qF "$CANON_ALT" "$doc"; then
        D3_VIOL="$D3_VIOL"$'\n'"  $doc: missing canonical goal phrase or synonym"
      fi
    done

    if [ -z "$D3_VIOL" ]; then
      pass "$RULE"
    else
      fail "$RULE"
      echo "$D3_VIOL"
    fi
  fi
fi

# ────────────────────────────────────────────────────────────────────────
# D4 — Tool-bootstrapping staleness: .ai-factory/tool-decisions.md mtime ≤ package.json mtime
# WARN only (not FAIL): tool-decisions.md may not exist on fresh installs.
#
# Fires WARN when:
#   (a) .ai-factory/tool-decisions.md exists AND package.json is newer, OR
#   (b) package.json exists AND .ai-factory/tool-decisions.md is absent
#       (reminds operator to run initial tool-bootstrap)
#
# Skipped silently when: no package.json in cwd (non-Node project).
# ────────────────────────────────────────────────────────────────────────
if skip_unless D4; then : ; else
  RULE="D4 (drift): .ai-factory/tool-decisions.md up-to-date with package.json"
  if [ ! -f package.json ]; then
    pass "$RULE (no package.json — skipped)"
  elif [ ! -f .ai-factory/tool-decisions.md ]; then
    warn "$RULE — .ai-factory/tool-decisions.md missing; re-run install.sh (auto-seeds it) or /tool-bootstrapping"
  else
    # Compare mtimes: if package.json is strictly newer → stale.
    # Asymmetric stat-failure fallbacks (PKG=0, DEC=1) ensure PKG_MTIME ≤ DEC_MTIME
    # when either stat fails, so a stat error never produces a false stale WARN.
    PKG_MTIME=$(stat -c %Y package.json 2>/dev/null || stat -f %m package.json 2>/dev/null || echo 0)
    DEC_MTIME=$(stat -c %Y .ai-factory/tool-decisions.md 2>/dev/null || stat -f %m .ai-factory/tool-decisions.md 2>/dev/null || echo 1)
    if [ "$PKG_MTIME" -gt "$DEC_MTIME" ]; then
      warn "$RULE — package.json is newer than tool-decisions.md; run /tool-bootstrapping to re-evaluate"
    else
      pass "$RULE"
    fi
  fi
fi

# ────────────────────────────────────────────────────────────────────────
# D5 (drift, inverse-completeness): every file in repo with canonical goal
# phrase must be enrolled in DOWNSTREAM_DOCS or explicitly exempt.
# Catches Incident-4 (DOWNSTREAM_DOCS curated from recall, not derived from grep).
#
# Invariant: FOUND ⊆ ENROLLED ∪ EXEMPT.
# Any file in FOUND \ (ENROLLED ∪ EXEMPT) is a coverage gap → D5 FAILS.
#
# SSOT entry: prior-art-evaluations.md#16 (same as D3 — D5 is structural
# extension of D3, not a new capability area).
# Incident-4 origin: research-patches/2026-05-11-d3-downstream-docs-completeness.md
# ────────────────────────────────────────────────────────────────────────
if skip_unless D5; then : ; else
  RULE="D5 (drift, inverse): every file with canonical phrase is enrolled or exempt"
  if [ "$AUDIT_MODE" = "consumer" ]; then
    pass "$RULE (skipped: consumer install — inverse enrollment tracks the framework authoring repo)"
  else
    # FROZEN — historical artefacts; phrase appears in research/audit prose, not
    # as live downstream goal-bearing claim.
    D5_FROZEN_PATTERNS='(docs/meta-factory/research-patches/|docs/audits/)'
    # TEST_INFRASTRUCTURE — files that define the canon or test it. The audit
    # tool's own source + tests (both the .ts implementation and the .sh probe,
    # plus their .test.* siblings) carry the phrase as fixtures/assertions, not
    # as a live downstream goal-bearing claim. Mirrors D5_TEST_INFRA_RE in the
    # canonical .ts implementation (audit-ai-docs.ts) — the .ts|.test.ts arms
    # were previously present only there, causing bash/.ts D5 drift on
    # packages/core/audit-self/audit-ai-docs.ts. inject-session-bootstrap.test.ts
    # is the negative test for the phrase-injection hook — it asserts on the
    # canonical phrase and is test infra, not a downstream doc.
    D5_TEST_INFRA_PATTERNS='(packages/core/audit-self/audit-ai-docs\.(ts|test\.ts|sh|test\.sh)|packages/core/audit-self/template-render\.audit\.ts|packages/core/hooks/inject-session-bootstrap\.test\.ts)'
    # ROOT_SOURCE — README.md defines CANON_ALT as the project's own goal statement;
    # it is the upstream authority, not a downstream consumer requiring drift-tracking.
    D5_ROOT_SOURCE_PATTERNS='(^README\.md$)'
    # GITIGNORED — transient operational prompts; gitignored per .gitignore:2 and
    # explicitly «out of project doc surface» per CLAUDE.md §doc-authority-hierarchy.
    D5_GITIGNORED_PATTERNS='(^\.claude/orchestrator-prompts/|^\.stryker-tmp/|^\.stryker/)'
    # GENERATED_TWIN — plugin/hooks/<name> twins are emitted from
    # .claude/hooks/<name>.sh by scripts/generate-plugin-twins.sh. The phrase
    # reaches the twin only because the generator copied it from the source, and
    # that source carries the enrollment (DOWNSTREAM_DOCS). Enrolling the twin
    # too would track one claim in two places and drift the moment the generator
    # runs. Content-gated, not path-gated: the generator also supports a `manual`
    # mode whose twins are hand-maintained and DO deserve independent tracking,
    # so only a twin carrying the generator's own header is exempt.
    # Mirrors isGeneratedTwin() in the .ts implementation.
    D5_GENERATED_TWIN_PATH_PATTERNS='(^plugin/hooks/)'
    D5_GENERATED_TWIN_MARKER='AUTO-GENERATED from .claude/hooks/'
    # FALSE-POSITIVE allowlist removed Wave 8.5 — was dead per Wave 8.2 audit:
    # packages/preset-next-15-canonical/RULES.md never matched either canon phrase
    # (grep -F confirmed 0 matches); exemption was pre-emptive and unnecessary.

    # Enrollment set
    D5_ENROLLED=$(printf '%s\n' "${DOWNSTREAM_DOCS[@]}")

    # Find set: grep -lF for both canon phrases, excluding node_modules + .git
    D5_FOUND=$(
      {
        grep -rlF "$CANON_PHRASE" --exclude-dir=node_modules --exclude-dir=.git . 2>/dev/null
        grep -rlF "$CANON_ALT" --exclude-dir=node_modules --exclude-dir=.git . 2>/dev/null
      } | sed 's|^\./||' | sort -u
    )

    D5_ORPHANS=""
    while IFS= read -r file; do
      [ -z "$file" ] && continue
      # Enrolled?
      if printf '%s\n' "$D5_ENROLLED" | grep -qxF "$file"; then continue; fi
      # Frozen?
      if echo "$file" | grep -qE "$D5_FROZEN_PATTERNS"; then continue; fi
      # Test infra?
      if echo "$file" | grep -qE "$D5_TEST_INFRA_PATTERNS"; then continue; fi
      # Root source?
      if echo "$file" | grep -qE "$D5_ROOT_SOURCE_PATTERNS"; then continue; fi
      # Gitignored transient prompts?
      if echo "$file" | grep -qE "$D5_GITIGNORED_PATTERNS"; then continue; fi
      # Generated plugin twin whose source is separately enrolled?
      if echo "$file" | grep -qE "$D5_GENERATED_TWIN_PATH_PATTERNS" \
        && grep -qF "$D5_GENERATED_TWIN_MARKER" "$file" 2>/dev/null; then continue; fi
      # Orphan — coverage gap.
      D5_ORPHANS="$D5_ORPHANS"$'\n'"  $file: contains canonical phrase but not in DOWNSTREAM_DOCS or any exemption"
    done <<< "$D5_FOUND"

    if [ -z "$D5_ORPHANS" ]; then
      pass "$RULE"
    else
      fail "$RULE"
      echo "$D5_ORPHANS"
      echo ""
      echo "  Fix: add the file to DOWNSTREAM_DOCS in audit-ai-docs.sh,"
      echo "       OR add a justified pattern to D5_FROZEN/TEST_INFRA/ROOT_SOURCE/GITIGNORED."
    fi
  fi
fi

# ────────────────────────────────────────────────────────────────────────
# Summary
# ────────────────────────────────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────"
echo "Audit complete: $PASS_COUNT PASS, $FAIL_COUNT FAIL, $WARN_COUNT WARN"

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
exit 0
