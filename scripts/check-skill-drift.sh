#!/usr/bin/env bash
# scripts/check-skill-drift.sh — skill/agent file drift detector
#
# D-AuditC-5 channel 1 (edit-time) + channel 2 (pre-push via .husky/pre-push section 3b).
# Principle test 14-skill-drift-detection.test.ts is channel 3 (CI last resort).
#
# T16 problem-class statement (per .claude/rules/ai-laziness-traps.md §2):
#   Upstream pattern: packages/core/audit-self/audit-ai-docs.test.sh — audits code-vs-rules
#     drift in CONSUMER projects (rules declared in AGENTS.md must hold in actual code).
#   Our problem class: skill/agent FILE-INTERNAL drift in the SOURCE repo (broken refs,
#     missing frontmatter, trigger-overlap inventory).
#   Match: Partial — both mechanical static drift detection on declarative files. ADAPT
#     (re-implementation for distinct surface), NOT ADOPT (no upstream code reused).
#
# Scope: repo-local ONLY — .claude/skills/, agents/, skills/ (top-level).
# NEVER scans ~/.claude/skills/ (non-portable; user-home is session-bound concern).
#
# Exit codes:
#   0 = clean (no broken refs, no missing frontmatter, invocation-channel contract intact;
#       overlaps are warnings only)
#   1 = broken refs OR missing frontmatter OR invocation-channel-contract drift detected

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

ERRORS=0
BROKEN_REF_TMP="$REPO_ROOT/.skill-drift-broken-tmp-$$"
FRONTMATTER_TMP="$REPO_ROOT/.skill-drift-frontmatter-tmp-$$"
OVERLAP_TMP="$REPO_ROOT/.skill-drift-overlap-tmp-$$"
CONTRACT_TMP="$REPO_ROOT/.skill-drift-contract-tmp-$$"

# Cleanup on exit
cleanup() { rm -f "$BROKEN_REF_TMP" "$FRONTMATTER_TMP" "$OVERLAP_TMP" "$CONTRACT_TMP"; }
trap cleanup EXIT

touch "$BROKEN_REF_TMP"

# ── 1. Broken internal refs check ────────────────────────────────────────────
# Scan .claude/skills/**/*.md, agents/**/*.md, skills/**/*.md
# For each markdown link [text](relative/path.md) verify the target file exists.
# Skip: http/https/mailto URLs, absolute paths (/...), same-file anchors (#...).

echo "=== Skill drift check: broken internal refs ==="

while IFS= read -r -d '' md_file; do
  file_dir="$(dirname "$md_file")"

  # Extract href targets from markdown links [text](href).
  # grep -Eo (without -n) avoids line-number prefixes in output.
  # || true: grep exits 1 when no matches; that is fine under set -e.
  hrefs=$(grep -Eo '\[([^]]*)\]\(([^)]+)\)' "$md_file" 2>/dev/null \
          | sed -E 's/\[([^]]*)\]\(([^)]+)\)/\2/' || true)

  [ -z "$hrefs" ] && continue

  while IFS= read -r href; do
    [ -z "$href" ] && continue
    # Skip URLs
    case "$href" in
      http://*|https://*|mailto:*) continue ;;
    esac
    # Skip same-file anchors
    case "$href" in
      \#*) continue ;;
    esac
    # Skip absolute paths
    case "$href" in
      /*) continue ;;
    esac
    # Strip anchor fragment to get the file path
    target_path="${href%%#*}"
    # Skip empty (pure fragment refs)
    [ -z "$target_path" ] && continue
    # Resolve relative to the source file's directory
    resolved="$file_dir/$target_path"
    if [ ! -f "$resolved" ]; then
      echo "BROKEN-REF: $md_file → $href"
      echo "1" >> "$BROKEN_REF_TMP"
    fi
  done <<< "$hrefs"

done < <(find .claude/skills agents skills -name "*.md" -print0 2>/dev/null)

BROKEN_REF_COUNT=$(wc -l < "$BROKEN_REF_TMP" | tr -d ' ')

if [ "$BROKEN_REF_COUNT" -gt 0 ]; then
  echo "FAIL: $BROKEN_REF_COUNT broken ref(s) found."
  ERRORS=$((ERRORS + 1))
else
  echo "OK: no broken refs."
fi

# ── 2. Missing frontmatter check ──────────────────────────────────────────────
# For SKILL.md files and agents/*.md: verify YAML frontmatter has name: and description:

echo ""
echo "=== Skill drift check: frontmatter completeness ==="

touch "$FRONTMATTER_TMP"

check_frontmatter() {
  local file="$1"

  # Check if file starts with ---
  local first_line
  first_line=$(head -1 "$file" 2>/dev/null)
  if [ "$first_line" != "---" ]; then
    echo "MISSING-FRONTMATTER: $file (no opening --- found)"
    echo "1" >> "$FRONTMATTER_TMP"
    return
  fi

  # Read frontmatter block (between first --- and second ---)
  local has_name=0 has_desc=0 in_frontmatter=0 line_count=0
  while IFS= read -r line; do
    line_count=$((line_count + 1))
    if [ "$line_count" -eq 1 ] && [ "$line" = "---" ]; then
      in_frontmatter=1
      continue
    fi
    if [ "$in_frontmatter" -eq 1 ] && [ "$line" = "---" ]; then
      break
    fi
    if [ "$in_frontmatter" -eq 1 ]; then
      case "$line" in
        name:*) has_name=1 ;;
        description:*) has_desc=1 ;;
      esac
    fi
    [ "$line_count" -ge 30 ] && break
  done < "$file"

  if [ "$has_name" -eq 0 ] || [ "$has_desc" -eq 0 ]; then
    local missing=""
    [ "$has_name" -eq 0 ] && missing="name:"
    [ "$has_desc" -eq 0 ] && missing="${missing:+$missing, }description:"
    echo "MISSING-FRONTMATTER: $file (missing: $missing)"
    echo "1" >> "$FRONTMATTER_TMP"
  fi
}

# Skill SKILL.md files
while IFS= read -r -d '' skill_file; do
  check_frontmatter "$skill_file"
done < <(find .claude/skills skills -name "SKILL.md" -print0 2>/dev/null)

# Agent files
while IFS= read -r -d '' agent_file; do
  check_frontmatter "$agent_file"
done < <(find agents -name "*.md" -print0 2>/dev/null)

FRONTMATTER_ERRORS=$(wc -l < "$FRONTMATTER_TMP" | tr -d ' ')

if [ "$FRONTMATTER_ERRORS" -gt 0 ]; then
  echo "FAIL: $FRONTMATTER_ERRORS file(s) with missing frontmatter."
  ERRORS=$((ERRORS + 1))
else
  echo "OK: all skill/agent files have name: and description: frontmatter."
fi

# ── 3. Trigger-overlap inventory (WARN-only) ──────────────────────────────────
# Collect description: lines from SKILL.md files, report overlapping keywords.
# Uses a temp file for portability (bash 3.2 associative arrays not available).

echo "" >&2
echo "=== Skill drift check: trigger-overlap inventory (WARN only) ===" >&2

touch "$OVERLAP_TMP"

while IFS= read -r -d '' skill_file; do
  skill_name=$(basename "$(dirname "$skill_file")")
  # Get description line (first occurrence)
  desc_line=$(grep -m1 '^description:' "$skill_file" 2>/dev/null || true)
  [ -z "$desc_line" ] && continue
  desc_val="${desc_line#description:}"
  desc_val="${desc_val# }"
  # Extract first few comma-separated tokens as "triggers"
  IFS=',' read -ra kw_array <<< "$desc_val"
  for kw in "${kw_array[@]:0:10}"; do
    # Trim whitespace, lowercase, strip punctuation
    kw=$(printf '%s' "$kw" | sed -E 's/^[[:space:]]+//;s/[[:space:]]+$//' \
         | tr '[:upper:]' '[:lower:]' | tr -d '«»"' | cut -c1-40)
    [ -z "$kw" ] && continue
    [ ${#kw} -lt 5 ] && continue  # skip very short tokens
    # Check for overlap: look for this kw recorded from a different skill
    match=$(grep -F "|${kw}|" "$OVERLAP_TMP" 2>/dev/null | head -1 || true)
    if [ -n "$match" ]; then
      existing=$(printf '%s' "$match" | cut -d'|' -f3)
      if [ "$existing" != "$skill_name" ]; then
        echo "WARN: trigger overlap — \"$kw\" in \"$existing\" and \"$skill_name\"" >&2
      fi
    else
      printf '%s\n' "|${kw}|${skill_name}" >> "$OVERLAP_TMP"
    fi
  done
done < <(find .claude/skills skills -name "SKILL.md" -print0 2>/dev/null)

# ── 4. Invocation-channel contract check ─────────────────────────────────────
# Every SKILL.md whose frontmatter carries `disable-model-invocation: true` must carry the
# canonical invocation-channel line VERBATIM, and no skill without the flag may carry it.
#
# Why byte-equality and not a keyword grep: the line asserts three separable things — (a) not
# auto-loaded, (b) the Skill tool will not invoke it, (c) an agent already asked to do the work
# may still read the file and execute its steps. Half (c) is the one that keeps getting dropped
# (2026-05-24 D3-MAJOR; 2026-09-08 handoff-memory incident, both recorded in the SSOT section),
# and a keyword grep passes a paraphrase that silently loses it. Same shape as the digest
# anti-drift gate in packages/core/principles/35-ai-laziness-digest-anti-drift.test.ts.
#
# SSOT: docs/meta-factory/operational-conventions.md §4. Edit there first; this check propagates.
# Absent SSOT file (consumer clone, sandbox) → section SKIPPED, never a failure.

echo ""
echo "=== Skill drift check: invocation-channel contract ==="

CONTRACT_SSOT="docs/meta-factory/operational-conventions.md"
CONTRACT_TOKEN="<!-- canonical: invocation-channel-flag -->"

if [ ! -f "$CONTRACT_SSOT" ]; then
  echo "SKIP: $CONTRACT_SSOT not present — nothing to compare against."
else
  CANON_COUNT=$(grep -cF "$CONTRACT_TOKEN" "$CONTRACT_SSOT" 2>/dev/null || true)
  [ -z "$CANON_COUNT" ] && CANON_COUNT=0
  if [ "$CANON_COUNT" -ne 1 ]; then
    echo "CONTRACT-SSOT-BROKEN: $CONTRACT_SSOT carries $CANON_COUNT canonical line(s), expected exactly 1."
    ERRORS=$((ERRORS + 1))
  else
    CANON_LINE=$(grep -F "$CONTRACT_TOKEN" "$CONTRACT_SSOT" | head -1)
    touch "$CONTRACT_TMP"

    while IFS= read -r -d '' skill_file; do
      # Frontmatter-only flag read: stop at the closing --- so a body mention never counts.
      has_flag=0 fm_line=0 in_fm=0
      while IFS= read -r line; do
        fm_line=$((fm_line + 1))
        if [ "$fm_line" -eq 1 ]; then
          [ "$line" = "---" ] && in_fm=1 || break
          continue
        fi
        [ "$in_fm" -eq 1 ] && [ "$line" = "---" ] && break
        case "$line" in
          "disable-model-invocation:"*true*) has_flag=1 ;;
        esac
        [ "$fm_line" -ge 60 ] && break
      done < "$skill_file"

      if grep -Fxq -- "$CANON_LINE" "$skill_file" 2>/dev/null; then
        carries=1
      else
        carries=0
      fi

      if [ "$has_flag" -eq 1 ] && [ "$carries" -eq 0 ]; then
        if grep -qF "$CONTRACT_TOKEN" "$skill_file" 2>/dev/null; then
          echo "CONTRACT-DRIFT: $skill_file (canonical line differs from $CONTRACT_SSOT §4)"
        else
          echo "CONTRACT-MISSING: $skill_file (has disable-model-invocation: true, lacks the canonical line)"
        fi
        echo "1" >> "$CONTRACT_TMP"
      elif [ "$has_flag" -eq 0 ] && [ "$carries" -eq 1 ]; then
        echo "CONTRACT-STALE: $skill_file (carries the canonical line but no disable-model-invocation: true)"
        echo "1" >> "$CONTRACT_TMP"
      fi
    done < <(find .claude/skills skills -name "SKILL.md" -print0 2>/dev/null)

    CONTRACT_ERRORS=$(wc -l < "$CONTRACT_TMP" | tr -d ' ')
    if [ "$CONTRACT_ERRORS" -gt 0 ]; then
      echo "FAIL: $CONTRACT_ERRORS file(s) with a wrong or missing invocation-channel contract."
      ERRORS=$((ERRORS + 1))
    else
      echo "OK: every disable-model-invocation carrier states the invocation-channel contract."
    fi
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
if [ "$ERRORS" -eq 0 ]; then
  echo "check-skill-drift: PASS (0 errors)"
  exit 0
else
  echo "check-skill-drift: FAIL ($ERRORS error category/categories)"
  exit 1
fi
