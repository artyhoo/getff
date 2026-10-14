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
# ADOPTED-CONTINUITY BINDING (intent-continuity design §5, slice B1 — 2026-10-13). An ask
# whose frontmatter carries `continuity: <feature-id>` is ADOPTED feature work and must
# additionally bind its document-bound responsibility — the current `role` field names the
# SENDER and is never repurposed as the recipient:
#
#   continuity: <stable kebab feature-id>     # the adoption marker; presence switches on
#   target: task | architecture | intent      # the recipient responsibility
#   task-id: <aif task ID>                    # required when target is task
#   primary-doc: <repo-relative path>         # the target's exact primary document
#   primary-doc-sha256: <64 hex>              # the bound digest (exact-content binding)
#   decision-ids: <ids or 'none'>             # relevant recorded decision IDs
#   return-to: <asker-role>[:<path>]          # who gets the answer back (owner-led)
#   proposed-effect: <one line>               # what applying the advice would change
#
# An ask WITHOUT `continuity:` is legacy v1 — every rule below the binding is skipped and
# the file is judged exactly as before (unrelated work keeps its contract; design §9 AC9).
# The no-argument pre-push gate remains SHAPE-only for portable legacy/coordination checks.
# The same incumbent CLI's --prepare-adopted and --accept-adopted modes call the current
# authority/return validator BEFORE the doorbell or caller application. They are the local
# delivery adapter for adopted work; no parallel mailbox or session-memory transport exists.
#
# An ANSWERED adopted ask additionally carries, inside '## Answer': `target:` echoing the
# frontmatter target, and `unresolved-remainder:` (value may be `none`) naming what the
# answer does NOT resolve — the caller validates the remainder before applying the advice.
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

# getff's own store: the value scripts/link-coordination.sh:78 derives for this checkout (spec §2)
# — the ask files are getff-operator state, never shipped. Tests point CLAUDE_COORDINATION_DIR at a tmpdir.
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

# Adopted-continuity bindings (intent-continuity design §5, slice B1). Presence of a
# non-empty `continuity:` switches these rules on; a legacy v1 ask never reaches them.
CONTINUITY_FEATURE_RE='^[a-z0-9][a-z0-9-]*$'
SHA256_RE='^[0-9a-f]{64}$'
DOC_PATH_RE='^[A-Za-z0-9._/-]+$'
# return-to is OWNER-LED: it must LEAD with the asker's role, optionally `:<path>`. The
# path part, when present, is shape-checked (the existence/currency half is the helper's).
RETURN_TO_RE='^[a-z][a-z0-9]*(:[A-Za-z0-9._/-]+)?$'

# ── the authoring half ────────────────────────────────────────────────────────────────────
# `<role>` in the filename is `[a-z][a-z0-9]*` — no hyphens — so the default placeholder is
# hyphen-free on purpose: a template whose own suggested filename fails the gate would be
# worse than no template.
print_template() {
  ask_class="${1:-consult}"
  role="${2:-seat}"
  continuity_feature="${3:-}"
  target="${4:-task}"

  case "$ask_class" in
    consult | materiality-dispute) ;;
    *)
      echo "check-ask-files.sh: unknown class '$ask_class' (consult | materiality-dispute)" >&2
      return 2
      ;;
  esac

  if [ -n "$continuity_feature" ]; then
    case "$target" in
      task | architecture | intent) ;;
      *)
        echo "check-ask-files.sh: unknown target '$target' (task | architecture | intent)" >&2
        return 2
        ;;
    esac
  fi

  # Guidance goes to stderr so `--print-template > <file>` captures the ask and nothing else.
  {
    echo "[ask] write to: $ASKS_DIR/$(date +%Y-%m-%d)-$role-<slug>.md"
    echo "[ask] atomically (spec §2 — write-temp+rename):"
    echo "        f=\"$ASKS_DIR/$(date +%Y-%m-%d)-$role-<slug>.md\""
    echo "        bash scripts/check-ask-files.sh --print-template $ask_class $role >\"\$f.tmp\" 2>/dev/null && mv \"\$f.tmp\" \"\$f\""
    if [ -n "$continuity_feature" ]; then
      echo '[ask] then: bash scripts/check-ask-files.sh --prepare-adopted <ask-file>   # send only its emitted ASK doorbell'
    else
      echo "[ask] then: bash scripts/check-ask-files.sh   # must print OK before you send ASK"
    fi
  } >&2

  echo '---'
  echo "asker-role: $role"
  echo "asker-cwd: $PWD"
  echo "class: $ask_class"
  echo 'status: open'
  if [ -n "$continuity_feature" ]; then
    # Placeholders pass SHAPE so the emitted skeleton is fileable; the digest placeholder
    # is obviously not a real authority — the semantic validator holds on it at routing.
    echo "continuity: $continuity_feature"
    echo "target: $target"
    if [ "$target" = task ]; then echo 'task-id: <aif-task-id>'; fi
    echo 'primary-doc: path/to/primary-doc.md'
    echo 'primary-doc-sha256: 0000000000000000000000000000000000000000000000000000000000000000'
    echo 'decision-ids: none'
    echo "return-to: $role:$(date +%Y-%m-%d)-$role-question.md"
    echo 'proposed-effect: <what applying the advice would change>'
  fi
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

# The advisor's half: append this, then flip `status: open` -> `status: answered`. With the
# optional <target> argument the emitted block additionally carries the adopted-continuity
# answer keys (echoed target + named remainder).
print_answer() {
  target="${1:-}"
  echo
  echo '## Answer'
  echo
  echo 'verdict: <the decision, in one line>'
  echo 'rationale: <why — one line; the reasoning belongs in the decisions entry>'
  echo 'decided-by: arch'
  echo "timestamp: $(date +%Y-%m-%dT%H:%M:%S%z)"
  echo 'decisions-entry: <path>/<plan>.decisions.md#<anchor>'
  if [ -n "$target" ]; then
    echo "target: $target"
    echo 'unresolved-remainder: none'
  fi
}

print_usage() {
  cat <<USAGE
usage: check-ask-files.sh [--print-template ... | --print-answer ... | --prepare-adopted <ask-file> | --accept-adopted <ask-file> | --help]

With no arguments: validate every *.md in the ask mailbox. This is the pre-push mode.

  --print-template [<class>] [<role>] [<continuity-feature>] [<target>]
                                        emit a fileable ask skeleton on stdout
                                        <class>: consult (default) | materiality-dispute
                                        <role>:  your seat's role (default: seat)
                                        giving <continuity-feature> emits the adopted-
                                        continuity binding (intent-continuity design §5);
                                        <target>: task (default) | architecture | intent
  --print-answer [<target>]             emit the '## Answer' block the advisor appends;
                                        with <target> the adopted answer keys are included
  --prepare-adopted <ask-file>          shape + current-authority check, then emit the
                                        exact ASK doorbell; only for an open adopted ask
  --accept-adopted <ask-file>           shape + current-authority + journal/return check;
                                        only for an answered adopted ask, before using it
  --help                                this text

Legal field values (the skeleton emits the common ones; these are all of them):
  class:  consult | materiality-dispute
  status: open | answered | escalated | withdrawn
  target: task | architecture | intent        (adopted asks only — frontmatter 'continuity:' present)
  '## Question' budget: $QUESTION_MAX_LINES lines (AIF_ASK_QUESTION_MAX_LINES)

Adopted-continuity frontmatter (only judged when 'continuity: <feature-id>' is present;
legacy v1 asks are unchanged): target, task-id (for task), primary-doc, primary-doc-sha256, decision-ids,
return-to (<asker-role>[:<path>], owner-led), proposed-effect. An answered adopted ask
additionally echoes 'target:' and carries 'unresolved-remainder:' in its Answer block.
SHAPE is this gate's half; whether the binding names CURRENT authority is the adopted-work
validator's half (the two adopted modes call it at delivery and return). The return-to
value for adopted asks must name the exact ask filename: <asker-role>:<ask-file-basename>.
If you rename the emitted question.md skeleton, update return-to before preparing it.
For target=task, both adopted commands fetch GET /tasks/:id at the check boundary
(RUNTIME_BRIDGE_AIF_URL, default http://localhost:3009). Its id and persisted
description/plan must bind the ask's task-id and exact kickoff/plan digest.

Filing an ask, end to end:
  1. mailbox (resolved on THIS machine): $ASKS_DIR
     override with CLAUDE_COORDINATION_DIR
  2. filename: <YYYY-MM-DD>-<role>-<slug>.md  (role and slug lowercase; role has no hyphens)
  3. write it atomically — temp file, then rename (spec §2)
  4. run this script with no arguments; it must print OK
  5. for an adopted ask, run --prepare-adopted <ask-file> and send ONLY the emitted
     AIF-BUS doorbell after its successful exit; legacy asks keep the v1 doorbell

Answering one (advisor):
  append --print-answer's block, flip 'status: open' to 'status: answered', and point
  decisions-entry at the decisions.md entry that records the verdict BEFORE it is applied.
  For an adopted answer, the caller runs --accept-adopted <ask-file> before applying
  advice. The anchored journal entry records ask, feature, decision-ids, verdict and
  return-to; a green answer remains advice, not authority to change product or start work.

Schema reference: the header comment of this file. Design: docs/superpowers/specs/2026-08-10-advisor-pattern-design.md §2.
USAGE
}

case "${1:-}" in
  --print-template)
    shift
    print_template "${1:-}" "${2:-}" "${3:-}" "${4:-}"
    exit $?
    ;;
  --print-answer) print_answer "${2:-}"; exit 0 ;;
  --prepare-adopted | --accept-adopted)
    ADOPTED_ACTION="$1"
    SELECTED_ASK="${2:-}"
    [ -n "$SELECTED_ASK" ] || { echo "check-ask-files.sh: $ADOPTED_ACTION needs an ask file" >&2; exit 2; }
    ;;
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
  grep -qE "^$2:[[:space:]]*[^[:space:]]" <<<"$1"
}

body_key_value() {
  printf '%s\n' "$1" | sed -n "s/^$2:[[:space:]]*//p" | head -1
}

if [ -n "${SELECTED_ASK:-}" ]; then
  [ -f "$SELECTED_ASK" ] || { echo "check-ask-files.sh: ask file missing: $SELECTED_ASK" >&2; exit 2; }
  selected_dir="$(cd "$(dirname "$SELECTED_ASK")" && pwd -P)"
  mailbox_dir="$(cd "$ASKS_DIR" 2>/dev/null && pwd -P)" || {
    echo "check-ask-files.sh: ask mailbox missing: $ASKS_DIR" >&2; exit 2;
  }
  [ "$selected_dir" = "$mailbox_dir" ] || {
    echo "check-ask-files.sh: selected ask is outside the active mailbox" >&2; exit 2;
  }
fi

if [ ! -d "$ASKS_DIR" ]; then
  echo "OK: no ask mailbox at $ASKS_DIR — nothing to validate"
  exit 0
fi

count=0
if [ -n "${SELECTED_ASK:-}" ]; then
  set -- "$SELECTED_ASK"
else
  set -- "$ASKS_DIR"/*.md
fi
for f in "$@"; do
  [ -e "$f" ] || continue   # unmatched glob when the mailbox is empty
  count=$((count + 1))
  base="$(basename "$f")"
  before=$findings

  if ! grep -qE "$FILENAME_RE" <<<"$base"; then
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

  # ── Adopted-continuity binding (design §5): only when `continuity:` is present ─────────
  # A legacy v1 ask carries no continuity key and never reaches any rule below (AC9).
  continuity="$(fm_value "$f" 'continuity')"
  if [ -n "$continuity" ]; then
    if ! grep -qE "$CONTINUITY_FEATURE_RE" <<<"$continuity"; then
      fail "$base: continuity '$continuity' is not a stable kebab feature ID"
    fi
    target="$(fm_value "$f" 'target')"
    case "$target" in
      task | architecture | intent) ;;
      '') fail "$base: adopted ask needs frontmatter key 'target' (task | architecture | intent)" ;;
      *) fail "$base: target '$target' is not one of: task, architecture, intent" ;;
    esac
    if [ "$target" = task ] && [ -z "$(fm_value "$f" 'task-id')" ]; then
      fail "$base: task ask needs frontmatter key 'task-id'"
    fi
    primary_doc="$(fm_value "$f" 'primary-doc')"
    case "$primary_doc" in
      '') fail "$base: adopted ask needs frontmatter key 'primary-doc' (repo-relative path)" ;;
      *) grep -qE "$DOC_PATH_RE" <<<"$primary_doc" ||
        fail "$base: primary-doc '$primary_doc' is not a repo-relative document path" ;;
    esac
    primary_doc_sha="$(fm_value "$f" 'primary-doc-sha256')"
    case "$primary_doc_sha" in
      '') fail "$base: adopted ask needs frontmatter key 'primary-doc-sha256' (64 hex)" ;;
      *) grep -qE "$SHA256_RE" <<<"$primary_doc_sha" ||
        fail "$base: primary-doc-sha256 must be 64 hex chars (got '$primary_doc_sha')" ;;
    esac
    grep -qE '^decision-ids:[[:space:]]*[^[:space:]]' "$f" ||
      fail "$base: adopted ask needs frontmatter key 'decision-ids' (IDs or 'none')"
    return_to="$(fm_value "$f" 'return-to')"
    case "$return_to" in
      '') fail "$base: adopted ask needs frontmatter key 'return-to' (<asker-role>[:<path>], owner-led)" ;;
      *) grep -qE "$RETURN_TO_RE" <<<"$return_to" ||
        fail "$base: return-to '$return_to' must LEAD with the asker role, optionally ':<path>'" ;;
    esac
    grep -qE '^proposed-effect:[[:space:]]*[^[:space:]]' "$f" ||
      fail "$base: adopted ask needs frontmatter key 'proposed-effect' (what applying the advice would change)"
  fi

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
        if ! grep -qE "$DECISIONS_ENTRY_RE" <<<"$entry_path"; then
          fail "$base: decisions-entry must LEAD with a path ending in .decisions.md (got '$entry_path' from '$entry') — prose that merely mentions decisions.md is not a pointer"
        fi
      fi
      # Adopted answered asks additionally echo the addressed target and name the
      # unresolved remainder (design §5 — the caller validates the remainder before use).
      if [ -n "$continuity" ]; then
        body_has_key "$abody" 'target' ||
          fail "$base: adopted answered ask needs 'target:' in '## Answer' echoing the frontmatter target"
        answer_target="$(body_key_value "$abody" 'target')"
        [ "$answer_target" = "$target" ] ||
          fail "$base: Answer target '$answer_target' does not echo the frontmatter target '$target'"
        body_has_key "$abody" 'unresolved-remainder' ||
          fail "$base: adopted answered ask needs 'unresolved-remainder:' in '## Answer' (value may be 'none') — the caller must see what the answer does NOT resolve"
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

if [ -n "${SELECTED_ASK:-}" ]; then
  [ -n "$(fm_value "$SELECTED_ASK" 'continuity')" ] || {
    echo "check-ask-files.sh: adopted delivery requires a continuity binding" >&2; exit 2;
  }
  status="$(fm_value "$SELECTED_ASK" 'status')"
  case "$ADOPTED_ACTION:$status" in
    --prepare-adopted:open | --accept-adopted:answered) ;;
    *) echo "check-ask-files.sh: $ADOPTED_ACTION cannot process status '$status'" >&2; exit 2 ;;
  esac
  helper="$PWD/.agents/procedures/intent/helpers/ask-advice.mjs"
  [ -f "$helper" ] || { echo "check-ask-files.sh: adopted validator missing at $helper" >&2; exit 2; }
  if [ "$(fm_value "$SELECTED_ASK" 'target')" = task ]; then
    task_id="$(fm_value "$SELECTED_ASK" 'task-id')"
    [[ "$task_id" =~ ^[A-Za-z0-9._:-]+$ ]] || { echo "check-ask-files.sh: invalid task-id" >&2; exit 2; }
    task_state="$(mktemp)" || exit 2
    trap 'rm -f "$task_state"' EXIT
    task_url="${RUNTIME_BRIDGE_AIF_URL:-http://localhost:3009}/tasks/$task_id"
    curl -fsS --max-time 10 "$task_url" >"$task_state" || { echo "check-ask-files.sh: cannot fetch current task state" >&2; exit 2; }
    set -- "$ADOPTED_ACTION" "$SELECTED_ASK" --task-state "$task_state"
  else
    set -- "$ADOPTED_ACTION" "$SELECTED_ASK"
  fi
  if [ "$ADOPTED_ACTION" = '--prepare-adopted' ]; then
    node "$helper" --route --ask "$SELECTED_ASK" "${@:3}" || exit 2
    echo "AIF-BUS v1 ASK role=$(fm_value "$SELECTED_ASK" 'asker-role') ref=$SELECTED_ASK"
  else
    node "$helper" --validate-return --ask "$SELECTED_ASK" "${@:3}" || exit 2
  fi
  exit 0
fi

echo "OK: $count ask file(s) valid in $ASKS_DIR"
