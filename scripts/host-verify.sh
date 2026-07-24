#!/usr/bin/env bash
# host-verify.sh — run a kickoff's declared destination-environment verification contract.
#
# WHY THIS EXISTS
#   Work dispatched to the aif-handoff runtime is produced inside a container. The artefact
#   ships to the HOST, where the pre-push gates, the operator's toolchain and the real OS live.
#   The container is not the destination environment, and the worker cannot observe the
#   difference — four incidents in one day (2026-07-24) were all this one class:
#     1. Job C   — 5/5 PASS in container, 0/5 on host (`docker` absent in the container, so the
#                  fixture's stub was the only one on PATH).
#     2. Job F1  — 9/9 in container, 7/9 on host (shadow PATH built from jq's directory; true
#                  where /bin symlinks to usr/bin, false on macOS where `cat` lives in /bin).
#     3. tsx     — three PostToolUse gates resolved their TypeScript runner from one repo-local
#                  path; a linked worktree carries no node_modules, so all three were inert.
#     4. F6      — principle-11 F1 measured ~5s in the container against a freshly lowered 15s
#                  budget; on the host the same test takes 17.6-18.1s and fails 3/3.
#
#   "The orchestrator will remember to re-run it on the host" is bare attention, which
#   `.claude/rules/attention-is-not-a-mechanism.md` §1 rejects as a detection layer. This script
#   is the mechanism: it turns the re-run into a command with an exit code.
#
# THE CONTRACT
#   A kickoff declares the commands its acceptance depends on inside a fenced block whose
#   info-string carries the `host-verify` marker:
#
#     ```bash host-verify
#     npx vitest run packages/core/principles/11-build-first-reuse-default.test.ts
#     ```
#
#   Every non-blank, non-comment line in that block is one command. They run from the repo root,
#   on the host, in declaration order. Any non-zero exit fails the contract.
#
# THE OPT-OUT
#   A kickoff that has no executable deliverable on the host declares so explicitly:
#
#     <!-- host-verify: none — prose-only kickoff, no executable deliverable -->
#
#   The token `<!-- host-verify: none` opens the opt-out; the rationale runs to the FIRST `-->`
#   on the line (non-greedy). The rationale is measured in CHARACTERS, locale-independently,
#   and must be ≥20 chars. A token quoted inside a fenced block, an indented code block, or an
#   inline code span does NOT open an opt-out — only prose-position tokens count.
#
# USAGE
#   bash scripts/host-verify.sh <umbrella>                  # .claude/orchestrator-prompts/<umbrella>/kickoff.md
#   bash scripts/host-verify.sh path/to/kickoff.md          # explicit path
#   bash scripts/host-verify.sh --list <umbrella|path>      # print the commands / opt-out, run nothing
#
# EXIT CODES
#   0 — every declared command passed (or --list completed), OR a valid opt-out was found.
#   1 — at least one declared command failed.
#   2 — usage error, kickoff not found, NO contract block found, no-op-only contract, or an
#       invalid (too-short) opt-out. Fail-closed: a missing contract is never a pass.
#
# Deterministic bash + awk only — no jq, no node, no network, no paid LLM
# (.claude/rules/no-paid-llm-in-ci.md). Safe to call from a gate.
set -uo pipefail

usage() {
  cat >&2 <<'EOF'
usage: bash scripts/host-verify.sh [--list] <umbrella|path-to-kickoff.md>

Runs the `host-verify` fenced block declared in the kickoff, on the host, from the repo root.
Exit 0 = all passed (or valid opt-out), 1 = a command failed, 2 = usage / missing kickoff /
missing contract / invalid opt-out.
EOF
}

LIST_ONLY=false
case "${1:-}" in
  --list) LIST_ONLY=true; shift ;;
  -h | --help) usage; exit 2 ;;
esac

TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  usage
  exit 2
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Resolve <umbrella> to its kickoff, or accept an explicit path.
# Fix B8 (umbrella path traversal): an umbrella name containing `/` or `..` would resolve to
# another umbrella's contract while the printed path reads as the first. Reject it LOUDLY,
# before the umbrella-path branch. Explicit paths (cases 1 and 2) are unaffected.
if [ -f "$TARGET" ]; then
  KICKOFF="$TARGET"
elif [ -f "$REPO_ROOT/$TARGET" ]; then
  KICKOFF="$REPO_ROOT/$TARGET"
else
  case "$TARGET" in
    */*|*..*)
      printf '❌ host-verify: umbrella name must not contain ` / ` or `..` (got: %s).\n' "$TARGET" >&2
      printf '   Use an explicit path instead: bash scripts/host-verify.sh path/to/kickoff.md\n' >&2
      exit 2
      ;;
  esac
  KICKOFF="$REPO_ROOT/.claude/orchestrator-prompts/$TARGET/kickoff.md"
fi

if [ ! -f "$KICKOFF" ]; then
  printf '❌ host-verify: no kickoff at %s\n' "$KICKOFF" >&2
  exit 2
fi

# ── Fence-aware, code-span-aware parser ────────────────────────────────────────
# Extracts contract commands AND opt-out rationale from the kickoff, using a single pass
# that correctly handles every bypass class surfaced by the 2026-07-24/25 cold audit:
#
#   B1 — opt-out quoted inside a ```text fence or inline code span → NOT an opt-out
#   B2 — greedy `.*` runs to the LAST `-->`, measuring a 2-char rationale as 48 → non-greedy
#   B4 — `~~~` wrapper fence, or 4-space-indented fence → NOT a contract opener
#   B5 — fence opened inside `<!-- … -->` → NOT a fence (invisible to humans)
#   B6 — byte-vs-char counting under non-UTF-8 locale → char count is locale-independent
#   B8 — tab-indented fence (tab = 4 columns, meets the ≥4 rule) → NOT a contract opener
#
# The parser is a single awk script that emits one tagged line per record:
#   `CONTRACT <line>` — a command inside a host-verify fenced block
#   `OPTOUT <rationale>` — the rationale captured from a valid `<!-- host-verify: none … -->`
# Exit 3 on an unterminated fence (refuse to guess where it ends).
#
# CommonMark fence rules implemented:
#   - The opening fence's CHARACTER (`` ` `` or `~`) and RUN LENGTH are remembered; only a
#     fence of the same character, at least as long, with no info string, closes it.
#   - A fence with ≥4 columns of leading whitespace (tab = 4) is part of an indented code
#     block — NOT a fence opener. Per CommonMark §4.1: "an indented code block cannot interrupt
#     a paragraph, so … a fenced code block can have ≤3 spaces indentation."
#   - A fence opened inside an HTML comment does not count (the bytes are invisible to humans).
#   - Inline code spans on prose lines are stripped before HTML-comment scanning, so a `<!--`
#     inside backticks is text, not a comment opener.
#   - Trailing `\r` (CRLF kickoff) is stripped at the top, before every other check.
AWK_PARSER='
BEGIN {
  in_html = 0; in_fence = 0; fc = ""; fl = 0; collect = 0
  optout_buf = ""; optout_found = ""
}
{ sub(/\r$/, "") }

# State: inside multi-line HTML comment.
in_html {
  pos = index($0, "-->")
  if (pos > 0) {
    optout_buf = optout_buf "\n" substr($0, 1, pos - 1)
    if (optout_buf ~ /host-verify:[ \t]*none/) {
      match(optout_buf, /host-verify:[ \t]*none/)
      rat = substr(optout_buf, RSTART + RLENGTH)
      sub(/^[ \t]*(\342\200\224|\342\200\223|[-:])/, "", rat)
      sub(/^[ \t]+/, "", rat)
      gsub(/[ \t]+$/, "", rat)
      if (optout_found == "") { optout_found = rat; print "OPTOUT " rat }
    }
    optout_buf = ""; in_html = 0
    $0 = substr($0, pos + 3)
  } else {
    optout_buf = optout_buf "\n" $0
    next
  }
}

# State: inside fenced code block.
in_fence {
  tmp = $0; lc = 0
  while (substr(tmp, 1, 1) == " " || substr(tmp, 1, 1) == "\t") {
    lc += (substr(tmp, 1, 1) == "\t") ? 4 : 1
    tmp = substr(tmp, 2)
  }
  if (lc <= 3) {
    n = 0
    while (substr(tmp, 1, 1) == fc) { n++; tmp = substr(tmp, 2) }
    sub(/[ \t]*$/, "", tmp)
    if (n >= fl && length(tmp) == 0) { in_fence = 0; collect = 0; next }
  }
  if (collect) print "CONTRACT " $0
  next
}

# State: prose. Possibly opens a fence, an HTML comment, or carries an opt-out token.
{
  tmp = $0; lc = 0
  while (substr(tmp, 1, 1) == " " || substr(tmp, 1, 1) == "\t") {
    lc += (substr(tmp, 1, 1) == "\t") ? 4 : 1
    tmp = substr(tmp, 2)
  }

  # Fence opener (only if indentation < 4 columns).
  if (lc < 4) {
    c1 = substr(tmp, 1, 1)
    if (c1 == "`" || c1 == "~") {
      run = 0
      while (substr(tmp, 1, 1) == c1) { run++; tmp = substr(tmp, 2) }
      if (run >= 3) {
        fc = c1; fl = run; info = tmp
        collect = (info ~ /(^|[ \t])host-verify([ \t]|$)/) ? 1 : 0
        in_fence = 1
        next
      }
    }
  }

  # Indented (lc >= 4): treat as indented code block — no fence, no opt-out scan.
  if (lc >= 4) next

  # Prose line. Strip inline code spans before HTML-comment detection so a `<!--` inside
  # backticks is text, not a comment opener. Handles single-backtick spans only; multi-backtick
  # spans are rare in practice and not load-bearing for any named bypass.
  work = $0
  while (match(work, /`[^`]*`/)) {
    work = substr(work, 1, RSTART - 1) substr(work, RSTART + RLENGTH)
  }

  # Scan for HTML comments (possibly several on one line).
  while (index(work, "<!--") > 0) {
    op = index(work, "<!--")
    before = substr(work, 1, op - 1)
    after = substr(work, op + 4)
    cc = index(after, "-->")
    if (cc > 0) {
      comment = substr(after, 1, cc - 1)
      if (comment ~ /[ \t]*host-verify:[ \t]*none/) {
        match(comment, /host-verify:[ \t]*none/)
        rat = substr(comment, RSTART + RLENGTH)
        sub(/^[ \t]*(\342\200\224|\342\200\223|[-:])/, "", rat)
        sub(/^[ \t]+/, "", rat)
        gsub(/[ \t]+$/, "", rat)
        if (optout_found == "") { optout_found = rat; print "OPTOUT " rat }
      }
      work = before substr(after, cc + 3)
    } else {
      # Comment spans into future lines. Stash any opt-out start for accumulation.
      if (after ~ /[ \t]*host-verify:[ \t]*none/) {
        match(after, /host-verify:[ \t]*none/)
        rat = substr(after, RSTART + RLENGTH)
        sub(/^[ \t]*(\342\200\224|\342\200\223|[-:])/, "", rat)
        sub(/^[ \t]+/, "", rat)
        optout_buf = rat
      } else {
        optout_buf = ""
      }
      in_html = 1
      next
    }
  }
}

END { if (in_fence) exit 3 }
'

AWK_OUTPUT="$(awk "$AWK_PARSER" "$KICKOFF")"
AWK_RC=$?
if [ "$AWK_RC" -eq 3 ]; then
  printf '❌ host-verify: %s has an UNTERMINATED fenced block.\n' "${KICKOFF#"$REPO_ROOT/"}" >&2
  printf '   Refusing to guess where it ends — an unclosed fence would turn prose into commands.\n' >&2
  exit 2
fi

# ── Opt-out branch ─────────────────────────────────────────────────────────────
# A valid opt-out (≥20 chars, locale-independent count) exits 0 with the rationale printed.
# A too-short opt-out exits 2 with the measured length. No opt-out → fall through to contract.
OPTOUT_RATIONALE="$(printf '%s\n' "$AWK_OUTPUT" | sed -n 's/^OPTOUT //p' | head -1)"
if [ -n "$OPTOUT_RATIONALE" ]; then
  # Locale-independent character count: strip UTF-8 continuation bytes (0x80-0xBF = \200-\277),
  # then count bytes. Each UTF-8 character leaves exactly one byte (its leading byte), so the
  # count equals the number of characters regardless of ambient LANG/LC_ALL.
  # Verified in-container 2026-07-25: yields 10 for a 10-character Cyrillic rationale
  # under LC_ALL=C, LC_ALL=en_US.UTF-8, and LC_ALL=C.utf8 alike.
  CHAR_COUNT="$(printf '%s' "$OPTOUT_RATIONALE" | LC_ALL=C tr -d '\200-\277' | LC_ALL=C wc -c | tr -d '[:space:]')"
  if [ "$CHAR_COUNT" -lt 20 ]; then
    printf '❌ host-verify: %s opts out with a %s-char rationale (floor: 20).\n' \
      "${KICKOFF#"$REPO_ROOT/"}" "$CHAR_COUNT" >&2
    printf '   Say WHY no host command applies, e.g. <!-- host-verify: none — prose-only kickoff, no executable deliverable -->\n' >&2
    exit 2
  fi
  if [ "$LIST_ONLY" = true ]; then
    printf '── host-verify: %s\n' "${KICKOFF#"$REPO_ROOT/"}"
    printf '   opt-out (%s chars): %s\n' "$CHAR_COUNT" "$OPTOUT_RATIONALE"
    exit 0
  fi
  printf '✅ host-verify: %s opts out (%s chars): %s\n' "${KICKOFF#"$REPO_ROOT/"}" "$CHAR_COUNT" "$OPTOUT_RATIONALE"
  exit 0
fi

# ── Contract branch ────────────────────────────────────────────────────────────
COMMANDS="$(printf '%s\n' "$AWK_OUTPUT" | sed -n 's/^CONTRACT //p')"
# Drop blank and comment-only lines.
COMMANDS="$(printf '%s\n' "$COMMANDS" | grep -vE '^[[:space:]]*(#|$)' || true)"

if [ -z "$COMMANDS" ]; then
  printf '❌ host-verify: %s declares no `host-verify` contract block.\n' "${KICKOFF#"$REPO_ROOT/"}" >&2
  printf '   A missing contract is a FAIL, not a pass — see .claude/rules/destination-environment-verification.md §1.\n' >&2
  printf '   Add the commands, or opt out: <!-- host-verify: none — <rationale, ≥20 chars> -->\n' >&2
  exit 2
fi

# ── No-op guard (broadened) ────────────────────────────────────────────────────
# A contract made only of commands that cannot plausibly FAIL on any real host is not a
# verification. This is a FLOOR AGAINST REFLEX, not a completeness claim: the documented opt-out
# costs a ≥20-char rationale a reviewer reads, whereas `:` costs one character and leaves no
# reviewable marker at all. We split each line on shell separators (;, &&, ||, |), strip
# grouping ({}()), and treat the line as non-substantive when every segment's command is in
# the no-op set {: true false exit echo printf cd pwd test [}. `test`/`[` WITH arguments are
# substantive (a real check like `test -f package.json`); bare `test`/`[` are not.
#
# This does NOT judge substance — that is review-time judgment (rule §4 `#optout-as-reflex`).
# It closes only the bypass class that is cheaper than the documented opt-out.
hv_is_noop_line() {
  local line="$1"
  local segments seg first_word line_has_substantive
  # Replace separators with newlines for iteration.
  segments="$(printf '%s' "$line" | sed 's/&&/\n/g; s/||/\n/g; s/;/\n/g; s/|/\n/g')"
  line_has_substantive=0
  while IFS= read -r seg; do
    seg="$(printf '%s' "$seg" | sed 's/[{}()]//g; s/^[[:space:]]*//; s/[[:space:]]*$//')"
    [ -z "$seg" ] && continue
    first_word="${seg%%[[:space:]]*}"
    case "$first_word" in
      :|true|false|exit|echo|printf|cd|pwd) ;;  # no-op command
      test|\[)
        # Substantive only if the segment has arguments.
        if [ "$first_word" != "$seg" ]; then line_has_substantive=1; break; fi
        ;;
      *) line_has_substantive=1; break ;;
    esac
  done <<< "$segments"
  [ "$line_has_substantive" -eq 0 ]
}

ALL_NOOP=1
while IFS= read -r _line; do
  [ -z "$_line" ] && continue
  if ! hv_is_noop_line "$_line"; then ALL_NOOP=0; break; fi
done <<< "$COMMANDS"

if [ "$ALL_NOOP" -eq 1 ]; then
  printf '❌ host-verify: %s declares a contract of no-ops only (`:`/`true`/`exit`/`echo`/…).\n' "${KICKOFF#"$REPO_ROOT/"}" >&2
  printf '   Declare the real host commands, or opt out explicitly with a rationale.\n' >&2
  exit 2
fi

REL_KICKOFF="${KICKOFF#"$REPO_ROOT/"}"
printf '── host-verify: %s\n' "$REL_KICKOFF"
printf '   host=%s  repo=%s\n' "$(uname -s)" "$REPO_ROOT"

if [ "$LIST_ONLY" = true ]; then
  printf '%s\n' "$COMMANDS" | while IFS= read -r c; do printf '   • %s\n' "$c"; done
  exit 0
fi

# Per-command wall-clock bound. Without one, a watch-mode runner or a lock/network wait
# stalls forever, and in an unattended run a stall is indistinguishable from "still working"
# — the same silence-vs-death confusion this repo tracks as finding F2.
HV_TIMEOUT="${HOST_VERIFY_TIMEOUT:-900}"
TIMEOUT_BIN=""
for _t in timeout gtimeout; do
  if command -v "$_t" >/dev/null 2>&1; then TIMEOUT_BIN="$_t"; break; fi
done
if [ -z "$TIMEOUT_BIN" ]; then
  printf '⚠ host-verify: no `timeout`/`gtimeout` on PATH — commands run UNBOUNDED.\n' >&2
  printf '   This is a degraded run, not a safe one: a hung command will stall instead of failing.\n' >&2
fi

FAILED=0
TOTAL=0
# Read from a here-string, not a pipe: a piped `while` runs in a subshell on some shells and
# the FAILED/TOTAL counters would be lost at the end of the loop.
while IFS= read -r CMD; do
  [ -n "$CMD" ] || continue
  TOTAL=$((TOTAL + 1))
  printf '\n▶ [%d] %s\n' "$TOTAL" "$CMD"
  # `-o pipefail` INSIDE the child: this script's own `set -o pipefail` does not propagate
  # across `bash -c`, so without it a declared `npx vitest run x | tee log` would report the
  # exit status of `tee` and a real test failure would pass the contract.
  # `</dev/null` so a declared command can never block the gate waiting on stdin.
  if (cd "$REPO_ROOT" && ${TIMEOUT_BIN:+$TIMEOUT_BIN "$HV_TIMEOUT"} bash -o pipefail -c "$CMD" </dev/null); then
    printf '✅ [%d] PASS — %s\n' "$TOTAL" "$CMD"
  else
    RC=$?
    printf '❌ [%d] FAIL (exit %d) — %s\n' "$TOTAL" "$RC" "$CMD"
    FAILED=$((FAILED + 1))
  fi
done <<< "$COMMANDS"

printf '\n── host-verify result: %d/%d passed on %s\n' "$((TOTAL - FAILED))" "$TOTAL" "$(uname -s)"
if [ "$FAILED" -gt 0 ]; then
  printf '❌ host-verify FAILED for %s — the work is not accepted on the host.\n' "$REL_KICKOFF" >&2
  exit 1
fi
printf '✅ host-verify passed for %s\n' "$REL_KICKOFF"
exit 0
