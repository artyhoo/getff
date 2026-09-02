#!/usr/bin/env bash
# Surface 11 — skills-surface harness-posture census (beta-ai-docs-agnosticism S2, spec C3).
#
# THE CONTRACT (declaration grammar + vocabulary — documented here because this probe
# is the mechanical reader of the convention; spec §6 C3 :362-368):
#
#   Every `.claude/skills/*/SKILL.md` MUST carry a harness-posture declaration,
#   on its own line, in this exact form:
#
#     <!-- @harness-posture: <vocabulary> — <rationale / degradations> -->
#
#   The HTML-comment form follows the repo's established annotation convention for
#   markdown artefacts (.claude/rules/dual-implementation-discipline.md §5: bash `#`,
#   markdown `<!-- -->`, TS `//` — one marker syntax per file class, greppable
#   identically by this bash probe and the principle-21 TS arm). Frontmatter was
#   rejected: skill YAML frontmatter is parsed by CC/zcode loaders and
#   scripts/check-skill-drift.sh — a new frontmatter key there risks parser drift
#   for zero gain (plan DD1, 2026-09-01). D8-clean: one line in a cold body, zero
#   always-on context.
#
#   Vocabulary (the ONLY allowed values — anything else is INVALID-HARNESS-POSTURE):
#     portable                       — runs on any target harness; rationale states the basis
#     portable-designed-not-proven   — designed for portability; live cross-harness run NOT
#                                      exercised (honest gap declared, not faked — T-BAD-B)
#     cc-native-with-fallback        — uses CC primitives; the portable fallback / degradation
#                                      per primitive is stated in the rationale
#     cc-only                        — deliberate CC-only; rationale ≥20 non-whitespace chars
#                                      (mirrors `# @cc-only-rationale` in channel-coverage)
#
#   The declaration must appear OUTSIDE a fenced code block (``` toggles fence state;
#   a marker inside an example fence is documentation, not a declaration — a fenced
#   example placed before the real declaration must never hijack the verdict, so
#   fence-state is tracked while scanning, identically in the principle-21 TS parser).
#
#   Population SCOPE (recorded exclusions, backward-sweep 2026-09-01): this census
#   covers the operator-repo live surface `.claude/skills/*/SKILL.md` (git-tracked)
#   ONLY. Deliberately OUTSIDE the population: (a) the top-level `skills/` source
#   templates shipped to consumers via install.sh — a separate declarable family;
#   (b) `packages/core/templates/shared/skill-context/*/SKILL.md` — shipped consumer
#   overrides, framework-maintainer-owned (Artifact Ownership Contract), not editable
#   by a session. Widening the glob to either is a future owner's change, not a
#   silent scope guess.
#
#   What a row verdicts: the DECLARATION's presence and shape ONLY. It does NOT run any
#   skill cross-harness — «41/41 declarations PORTABLE» is not «41 skills proven portable»
#   (T14 coverage honesty; the unproven half stays declared via
#   `portable-designed-not-proven`, never laundered into `portable`).
#
# T16 statement (kickoff §7 — ADOPTED shape, not copy-paste): upstream problem class =
# "agents declare tools mechanically" (principle 21 agents arm parses `tools:` frontmatter);
# our problem class = "skills declare harness posture mechanically". Match is structural at
# the census + dynamic-enumeration + pure-parser + paired-negative level; the declaration
# FORM is designed for SKILL.md prose bodies (marker comment), NOT ported from agent
# frontmatter parsing.
#
# T-BADC-S2-A guard: the population is enumerated DYNAMICALLY (`git ls-files` glob, cross-
# checked against the on-disk dir count) — no skill name or count is hard-coded, so a new
# undeclared skill dir is RED on the next run with zero probe edits (kickoff §4.5 falsifier).
#
# Per .claude/rules/no-paid-llm-in-ci.md: pure bash + git, zero API calls.
set -uo pipefail
# Resolve by path, not `git rev-parse` — GIT_DIR-immune for the worktree-push hook env
# (see ../run-audit.sh + channel-coverage.sh:19-28).
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
source "$REPO_ROOT/tests/agnosticism/_cc-absent-lib.sh"
unset GIT_DIR GIT_COMMON_DIR GIT_WORK_TREE

# Population (T10 — enumerate before verdicts): git-tracked SKILL.md files, cross-checked
# against the git-tracked `.claude/skills/` dir count. On-disk dirs are NOT the population:
# `/.claude/skills/aif*/` installer-generated skills are gitignored by design (.gitignore:105-110)
# and a consumer checkout carries dozens of them — counting disk dirs would make this probe's
# population environment-dependent (RED in one checkout, GREEN in another). A mismatch between
# the two TRACKED counts means a tracked dir with no tracked SKILL.md (or the inverse) — RED,
# never silently skipped. A NEW tracked skill dir with no declaration is RED on the next run
# with zero probe edits (kickoff §4.5 falsifier).
pop=$(git -C "$REPO_ROOT" ls-files '.claude/skills/*/SKILL.md' | sort)
tracked=$(printf '%s\n' "$pop" | grep -c . || true)
tracked_dirs=$(git -C "$REPO_ROOT" ls-files '.claude/skills/' | grep -E '^\.claude/skills/[^/]+/' | cut -d/ -f3 | sort -u | wc -l)
if [ "$tracked" -ne "$tracked_dirs" ]; then
  record skills-census "population" "tracked SKILL.md files ($tracked) != tracked skill dirs ($tracked_dirs)" 1 POPULATION-DRIFT
fi

ALLOWED='^(portable|portable-designed-not-proven|cc-native-with-fallback|cc-only)$'

for f in $pop; do
  file="$REPO_ROOT/$f"
  # Marker must be on its own line, anchored `<!-- @harness-posture:` — prose mentions
  # inside sentences/backticks do not count (same discipline as channel-coverage.sh:50),
  # and lines inside a fenced code block (```) do not count either — a fenced grammar
  # example must never satisfy the census (cold-QA MAJOR, 2026-09-01).
  marker=$(awk '
    /^```/ { infence = !infence; next }
    !infence && /^<!--[[:space:]]*@harness-posture:/ { print; exit }
  ' "$file")
  skill=${f#.claude/skills/}
  if [ -z "$marker" ]; then
    record skills-census "$f" "no @harness-posture declaration (grammar: probe header)" 1 NO-HARNESS-POSTURE
    continue
  fi
  vocab=$(printf '%s' "$marker" | sed -E 's/^<!--[[:space:]]*@harness-posture:[[:space:]]*//' | awk '{print $1}')
  if ! printf '%s' "$vocab" | grep -qE "$ALLOWED"; then
    record skills-census "$f" "posture '$vocab' outside allowed vocabulary (grammar: probe header)" 1 INVALID-HARNESS-POSTURE
    continue
  fi
  if [ "$vocab" = "cc-only" ]; then
    # Rationale = everything after the vocab token, with the em-dash separator stripped.
    rationale=$(printf '%s' "$marker" | sed -E 's/^<!--[[:space:]]*@harness-posture:[[:space:]]*cc-only([[:space:]]+—[[:space:]]+)?//' | sed 's/[[:space:]]*-->[[:space:]]*$//')
    len=$(printf '%s' "$rationale" | tr -d '[:space:]' | wc -c)
    if [ "$len" -lt 20 ]; then
      record skills-census "$f" "cc-only rationale too short ($len chars, ≥20 required)" 1 INVALID-HARNESS-POSTURE
      continue
    fi
  fi
  record skills-census "$f" "declared: $vocab" 0 PORTABLE
done
