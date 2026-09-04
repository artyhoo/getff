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
# THE AUTHORING HALF LIVES HERE TOO — `--print-template` / `--print-answer` / `--help`.
# A schema stated only by the thing that rejects it leaves the first author writing against
# nothing, so this script both JUDGES an ask and OFFERS one. Single source by construction:
# scripts/check-ask-files.test.sh feeds every emitted skeleton back through the validator,
# so "the example is valid" is a mechanism rather than a claim. (Same seam, same reason, as
# `scripts/run-local-ci-sweep.sh --list-gates`:186 — a copy of a format drifts from the
# format.) The prose block below is kept deliberately: it is what the RED message points a
# reader at, and it explains fields the skeleton can only show.
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
#     detectable half to channel 1: the reference must be PRESENT and PATH-SHAPED. The
#     plan-local decisions.md lives in a gitignored/coordination path, so an existence check
#     would be environment-dependent and would fail on a fresh checkout.
#     RE-VERIFIED 2026-09-04, and the mechanism is worth naming because the premise reads
#     stale at first glance: 16 *.decisions.md files ARE git-tracked today, yet `.gitignore:16`
#     ignores `.claude/orchestrator-prompts/*/*`, so each of those is present only because an
#     author force-added it with an explicit exception. A NEW decisions file is therefore
#     untracked by default — it exists in the advisor's worktree and nowhere else. An existence
#     check would go green for its author and RED for every other worktree and for CI, blocking
#     unrelated pushes repo-wide on a file that is not a defect. Environment-dependent, exactly
#     as first stated. What IS environment-independent is the SHAPE of the pointer, and that is
#     now checked: before 2026-09-04 the test was a bare `*decisions.md*` substring, so
#     `decisions-entry: see the morning report; we follow the usual decisions.md convention`
#     passed while pointing at nothing (probed live, it did). The value must now LEAD with a
#     path ending in `.decisions.md`; prose may follow it, never replace it.
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

# decisions-entry SHAPE. The value must LEAD with a repo-relative path ending in
# `.decisions.md`, optionally `#anchor`; prose may follow after whitespace. Angle brackets are
# allowed so the `--print-answer` skeleton's `<path>/<plan>.decisions.md#<anchor>` stays valid —
# the template must pass its own gate (see the authoring-half note above). This is the SHAPE
# half only; existence stays deliberately unchecked, and the block at the top of this file says
# why (re-verified 2026-09-04).
DECISIONS_ENTRY_RE='^[A-Za-z0-9._/<>-]+\.decisions\.md$'

# ── the authoring half ────────────────────────────────────────────────────────────────────
# `<role>` in the filename is `[a-z][a-z0-9]*` — no hyphens — so the default placeholder is
# hyphen-free on purpose: a template whose own suggested filename fails the gate would be
# worse than no template.
print_template() {
  ask_class="${1:-consult}"
  role="${2:-seat}"

  case "$ask_class" in
    consult | materiality-dispute) ;;
    *)
      echo "check-ask-files.sh: unknown class '$ask_class' (consult | materiality-dispute)" >&2
      return 2
      ;;
  esac

  # Guidance goes to stderr so `--print-template > <file>` captures the ask and nothing else.
  {
    echo "[ask] write to: $ASKS_DIR/$(date +%Y-%m-%d)-$role-<slug>.md"
    echo "[ask] atomically (spec §2 — write-temp+rename):"
    echo "        f=\"$ASKS_DIR/$(date +%Y-%m-%d)-$role-<slug>.md\""
    echo "        bash scripts/check-ask-files.sh --print-template $ask_class $role >\"\$f.tmp\" 2>/dev/null && mv \"\$f.tmp\" \"\$f\""
    echo "[ask] then: bash scripts/check-ask-files.sh   # must print OK before you send ASK"
  } >&2

  echo '---'
  echo "asker-role: $role"
  echo "asker-cwd: $PWD"
  echo "class: $ask_class"
  echo 'status: open'
  echo '---'
  echo
  echo '## Question'
  echo
  echo 'One screen at most. State the fork, not the background: what are you choosing'
  echo 'between, and what turns on the choice?'
  echo
  echo '## Options considered'
  echo
  echo '- A <option> -> <what it costs / what it buys>.'
  echo '- B <option> -> <what it costs / what it buys>.'
  echo
  echo '## Evidence'
  echo
  echo '- path/to/file.ext:12 — what that line actually shows.'

  if [ "$ask_class" = 'materiality-dispute' ]; then
    echo
    echo '## Finding (verbatim)'
    echo
    echo '<the reviewer finding, COPIED verbatim — never paraphrased'
    echo ' (.claude/rules/reviewer-discipline.md §6)>'
    echo
    echo '## Objection'
    echo
    echo '<why the finding is disputed, in one paragraph>'
  fi
}

# The advisor's half: append this, then flip `status: open` -> `status: answered`.
print_answer() {
  echo
  echo '## Answer'
  echo
  echo 'verdict: <the decision, in one line>'
  echo 'rationale: <why — one line; the reasoning belongs in the decisions entry>'
  echo 'decided-by: arch'
  echo "timestamp: $(date +%Y-%m-%dT%H:%M:%S%z)"
  echo 'decisions-entry: <path>/<plan>.decisions.md#<anchor>'
}

print_usage() {
  cat <<USAGE
usage: check-ask-files.sh [--print-template [<class> [<role>]] | --print-answer | --help]

With no arguments: validate every *.md in the ask mailbox. This is the pre-push mode.

  --print-template [<class>] [<role>]   emit a fileable ask skeleton on stdout
                                        <class>: consult (default) | materiality-dispute
                                        <role>:  your seat's role (default: seat)
  --print-answer                        emit the '## Answer' block the advisor appends
  --help                                this text

Legal field values (the skeleton emits the common ones; these are all of them):
  class:  consult | materiality-dispute
  status: open | answered | escalated | withdrawn
  '## Question' budget: $QUESTION_MAX_LINES lines (AIF_ASK_QUESTION_MAX_LINES)

Filing an ask, end to end:
  1. mailbox (resolved on THIS machine): $ASKS_DIR
     override with CLAUDE_COORDINATION_DIR
  2. filename: <YYYY-MM-DD>-<role>-<slug>.md  (role and slug lowercase; role has no hyphens)
  3. write it atomically — temp file, then rename (spec §2)
  4. run this script with no arguments; it must print OK
  5. send the doorbell: AIF-BUS v1 ASK role=<role> ref=<path-to-the-ask>

Answering one (advisor):
  append --print-answer's block, flip 'status: open' to 'status: answered', and point
  decisions-entry at the decisions.md entry that records the verdict BEFORE it is applied.

Schema reference: the header comment of this file. Design: docs/superpowers/specs/2026-08-10-advisor-pattern-design.md §2.
USAGE
}

case "${1:-}" in
  --print-template)
    shift
    print_template "${1:-}" "${2:-}"
    exit $?
    ;;
  --print-answer) print_answer; exit 0 ;;
  -h | --help) print_usage; exit 0 ;;
  '') ;;
  *) echo "check-ask-files.sh: unknown argument '$1' (try --help)" >&2; exit 2 ;;
esac

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
        # Take the leading whitespace-delimited token, drop any #anchor: that token IS the
        # pointer, and everything after the first space is free-form prose the advisor may add.
        entry_path="${entry%% *}"
        entry_path="${entry_path%%#*}"
        if ! printf '%s' "$entry_path" | grep -qE "$DECISIONS_ENTRY_RE"; then
          fail "$base: decisions-entry must LEAD with a path ending in .decisions.md (got '$entry_path' from '$entry') — prose that merely mentions decisions.md is not a pointer"
        fi
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
  echo "A conforming skeleton: bash scripts/check-ask-files.sh --print-template   (--help for the filing recipe)." >&2
  exit 1
fi

echo "OK: $count ask file(s) valid in $ASKS_DIR"
