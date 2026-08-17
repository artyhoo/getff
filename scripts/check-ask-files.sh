#!/usr/bin/env bash
# check-ask-files.sh — ask-file schema validity + the answered⇒decisions-entry cross-check.
#
# Landing obligation §8 item 6 of docs/superpowers/specs/2026-08-10-advisor-pattern-design.md,
# mechanising §5.3 L3(b) (schema validity) and L3(c) (decisions.md reference before the
# answer is applied). The judgment half — whether the question is worth asking, whether the
# verdict is sound, whether the decisions entry is honest — stays with the advisor and the
# morning review. This gate only asserts the fields exist and carry legal values, which is
# exactly the "channel 1 / channel 2" split the spec draws (§2: "Schema presence is
# mechanically checkable (channel 1); content is judgment (channel 2)").
#
# WHY THIS LIVES OUTSIDE packages/: session-bus v2 §9 executable claim 1 — no verb-grammar
# literal (AIF-BUS / AIF_BUS) and no mailbox path segment under packages/. This script
# carries the mailbox path legitimately; the pre-push registry entry that calls it
# (packages/core/hooks/pre-push.ts, askFileSchemaSection) carries no bus literal and no bus
# logic, so the claim stays honest in both directions.
#
# THE SCHEMA (spec §2, field list transcribed; this file is its mechanical half).
# One ask = one markdown file with flat YAML-ish frontmatter + H2 sections:
#
#   ---
#   asker-role: dispatcher
#   asker-cwd: /Users/x/code/rules-as-tests-aif
#   class: consult                  # consult | materiality-dispute
#   status: open                    # open | answered | escalated | withdrawn
#   ---
#
#   ## Question
#   <=1 screen (AIF_ASK_QUESTION_MAX_LINES, default 50)
#
#   ## Options considered
#   ## Evidence
#   ## Finding (verbatim)   # materiality-dispute only
#   ## Objection            # materiality-dispute only
#   ## Answer               # required once status: answered
#   verdict: ...
#   rationale: ...
#   decided-by: arch
#   timestamp: 2026-08-17T10:00:00+03:00
#   decisions-entry: <ref containing decisions.md>
#
# Frontmatter keys are FLAT (asker-role / asker-cwd, not a nested `asker:` map) so this gate
# needs no YAML parser — no new dependency, therefore no new capability. The spec's "asker
# (role + cwd)" is satisfied by the pair.
#
# WHAT THIS GATE DELIBERATELY DOES NOT CHECK (stated, not implied away):
#   - that the referenced decisions.md entry EXISTS or is honest. §5.3 L3(c) moves only the
#     detectable half to channel 1: the reference must be PRESENT. The plan-local
#     decisions.md lives in a gitignored/coordination path, so an existence check would be
#     environment-dependent and would fail on a fresh checkout.
#   - non-.md files. Ask files are written temp+rename (spec §2, atomic), so a partially
#     written file never carries the .md extension. Ignoring everything else is what makes
#     a concurrent write invisible to this gate rather than a flake.
#   - nested subdirectories: the mailbox is flat by construction.
#
# Deterministic; no paid LLM (.claude/rules/no-paid-llm-in-ci.md). Bash 3.2 compatible
# (no associative arrays, no mapfile) — macOS ships 3.2 and the pre-push hook runs there.
set -uo pipefail

# Same expression as scripts/link-coordination.sh:74 and spec §2 — one convention, one
# default, no second knob. Tests point CLAUDE_COORDINATION_DIR at a tmpdir.
CANON="${CLAUDE_COORDINATION_DIR:-$HOME/.claude-coordination/rules-as-tests-aif}"
ASKS_DIR="$CANON/session-bus/asks"

# "<=1 screen" made mechanical. The number is config, not statute (effort-worthiness.md §2
# L4 wording): a longer question is a smell the advisor should not have to page through.
QUESTION_MAX_LINES="${AIF_ASK_QUESTION_MAX_LINES:-50}"

FILENAME_RE='^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z][a-z0-9]*-[a-z0-9][a-z0-9-]*\.md$'

findings=0

fail() {
  findings=$((findings + 1))
  echo "  ✗ $1" >&2
}

# Value of a flat frontmatter key, from the block between the first two `---` lines.
fm_value() {
  awk -v key="$2" '
    NR == 1 && $0 == "---" { inside = 1; next }
    inside && $0 == "---"   { exit }
    inside {
      pos = index($0, ":")
      if (pos > 0 && substr($0, 1, pos - 1) == key) {
        v = substr($0, pos + 1)
        sub(/^[ \t]+/, "", v); sub(/[ \t\r]+$/, "", v)
        print v
        exit
      }
    }
  ' "$1"
}

# Body of an H2 section, matched as an EXACT line so titles carrying regex metacharacters
# ("## Finding (verbatim)") need no escaping.
section_body() {
  awk -v title="$2" '
    $0 == title { inside = 1; next }
    inside && /^## / { exit }
    inside { print }
  ' "$1"
}

has_section() {
  [ -n "$(awk -v title="$2" '$0 == title { print "y"; exit }' "$1")" ]
}

# A key: value line inside a section body, non-empty value.
body_has_key() {
  printf '%s\n' "$1" | grep -qE "^$2:[[:space:]]*[^[:space:]]"
}

body_key_value() {
  printf '%s\n' "$1" | sed -n "s/^$2:[[:space:]]*//p" | head -1
}

if [ ! -d "$ASKS_DIR" ]; then
  echo "OK: no ask mailbox at $ASKS_DIR — nothing to validate"
  exit 0
fi

count=0
for f in "$ASKS_DIR"/*.md; do
  [ -e "$f" ] || continue   # unmatched glob when the mailbox is empty
  count=$((count + 1))
  base="$(basename "$f")"
  before=$findings

  if ! printf '%s' "$base" | grep -qE "$FILENAME_RE"; then
    fail "$base: filename must be <YYYY-MM-DD>-<role>-<slug>.md (lowercase role and slug)"
  fi

  role="$(fm_value "$f" 'asker-role')"
  cwd="$(fm_value "$f" 'asker-cwd')"
  class="$(fm_value "$f" 'class')"
  status="$(fm_value "$f" 'status')"

  [ -n "$role" ] || fail "$base: frontmatter key 'asker-role' missing or empty"
  [ -n "$cwd" ] || fail "$base: frontmatter key 'asker-cwd' missing or empty"

  case "$class" in
    consult | materiality-dispute) ;;
    '') fail "$base: frontmatter key 'class' missing or empty (consult | materiality-dispute)" ;;
    *) fail "$base: class '$class' is not one of: consult, materiality-dispute" ;;
  esac

  case "$status" in
    open | answered | escalated | withdrawn) ;;
    '') fail "$base: frontmatter key 'status' missing or empty (open | answered | escalated | withdrawn)" ;;
    *) fail "$base: status '$status' is not one of: open, answered, escalated, withdrawn" ;;
  esac

  for section in '## Question' '## Options considered' '## Evidence'; do
    has_section "$f" "$section" || fail "$base: required section '$section' missing"
  done

  if has_section "$f" '## Question'; then
    qbody="$(section_body "$f" '## Question')"
    if [ -z "$(printf '%s' "$qbody" | tr -d '[:space:]')" ]; then
      fail "$base: '## Question' is empty"
    fi
    qlines="$(printf '%s\n' "$qbody" | wc -l | tr -d ' ')"
    if [ "$qlines" -gt "$QUESTION_MAX_LINES" ]; then
      fail "$base: '## Question' is $qlines lines — over the one-screen budget of $QUESTION_MAX_LINES"
    fi
  fi

  # A dispute carries the finding VERBATIM plus the objection (spec §2; the verbatim-copy
  # obligation itself is .claude/rules/reviewer-discipline.md §6 — prose, not this gate).
  if [ "$class" = 'materiality-dispute' ]; then
    for section in '## Finding (verbatim)' '## Objection'; do
      has_section "$f" "$section" ||
        fail "$base: class materiality-dispute requires section '$section'"
    done
  fi

  # L3(c) — the cross-check. An answered ask must carry a complete answer block AND point at
  # the decisions.md entry that records the verdict, so "recorded before applied" is
  # detectable rather than remembered.
  if [ "$status" = 'answered' ]; then
    if ! has_section "$f" '## Answer'; then
      fail "$base: status 'answered' requires section '## Answer'"
    else
      abody="$(section_body "$f" '## Answer')"
      for key in verdict rationale decided-by timestamp; do
        body_has_key "$abody" "$key" ||
          fail "$base: '## Answer' missing '$key:' (verdict, rationale, decided-by, timestamp)"
      done
      if ! body_has_key "$abody" 'decisions-entry'; then
        fail "$base: status 'answered' requires 'decisions-entry:' in '## Answer' — the decisions.md entry recording this verdict"
      else
        entry="$(body_key_value "$abody" 'decisions-entry')"
        case "$entry" in
          *decisions.md*) ;;
          *) fail "$base: decisions-entry '$entry' does not reference a decisions.md entry" ;;
        esac
      fi
    fi
  fi

  [ "$findings" -eq "$before" ] || echo "  (in $f)" >&2
done

if [ "$count" -eq 0 ]; then
  echo "OK: ask mailbox $ASKS_DIR is empty — nothing to validate"
  exit 0
fi

if [ "$findings" -gt 0 ]; then
  echo "SCHEMA: $findings finding(s) across $count ask file(s) in $ASKS_DIR" >&2
  echo "Schema reference: the header of scripts/check-ask-files.sh (spec §2 field list)." >&2
  exit 1
fi

echo "OK: $count ask file(s) valid in $ASKS_DIR"
