#!/usr/bin/env bash
# rule-load-replay.sh — run one fixed headless Claude Code session in a THROWAWAY clone of getff
# and report what rule text reached its context: native rule loads (Claude Code's own
# `nested_memory` records for `.claude/rules/`) and the rule loader's cards
# (`inject-matching-rule.sh` additionalContext).
#
# Trigger build, slice 2 (spec items 4-5, S-7): the before/after evidence for the switch that
# lists getff's path-scoped rules in `claudeMdExcludes`. The same prompt runs twice, once on the
# clone as it is and once with `--exclude local` (and, for the "after" state, the slice's rule
# patch via `--patch`). The switch itself is written into the clone only — never into the
# checkout this script runs from.
#
# HOST-ONLY and NOT for CI: it starts a live `claude -p` session on the operator's own
# subscription (no-paid-llm-in-ci.md). Its plumbing is tested with a stub binary in
# scripts/rule-load-replay.test.sh.
#
# Usage:
#   rule-load-replay.sh --label <name> --prompt-file <file>
#                       [--exclude local|project] [--patch <file>] [--ref <rev>]
#                       [--model <model>] [--allowed-tools <list>] [--out <dir>]
#   --exclude local    writes the list into the clone's .claude/settings.local.json (S-7)
#   --exclude project  writes it into the clone's .claude/settings.json (the S-7 cross-check)
#   --ref              revision to check out in the clone (default: origin/staging of REPO)
#   --out              where the run's files go (default: a new mktemp directory)
# Env overrides: REPO (default: this checkout), CLAUDE_BIN (default: claude),
#   MEASURE (default: $REPO/scripts/measure-turn-attribution.sh),
#   CORPUS_ROOT (default: ~/.claude/projects — where Claude Code writes the transcript).
# Output: the run directory holds clone/, prompt.txt, result.json, stderr.log, transcript/,
#   measure.txt, summary.txt. summary.txt carries grep-stable key lines:
#   REPLAY label=… exclude=… patch=… ref=… session=… claude_exit=…
#   NATIVE-RULE-LOADS pop=… records=… paths=… chars=…   (from the measurement script)
#   LOADER-CARDS cards=<n> chars=<n>                     (loader lines starting with 📎)
# Exit: 0 on a measured run; 2 bad arguments; 3 the session left no transcript; 4 the
#   measurement failed. A non-zero `claude` exit is recorded, not fatal: its transcript is
#   still measured.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="${REPO:-$(cd "$HERE/.." && pwd)}"
CLAUDE_BIN="${CLAUDE_BIN:-claude}"
MEASURE="${MEASURE:-$REPO/scripts/measure-turn-attribution.sh}"
CORPUS_ROOT="${CORPUS_ROOT:-$HOME/.claude/projects}"

LABEL="" PROMPT_FILE="" EXCLUDE="" PATCH="" REF="" MODEL="sonnet" TOOLS="Read,Edit" OUT=""
die() { echo "rule-load-replay: $*" >&2; exit 2; }
while [ $# -gt 0 ]; do
  case "$1" in
    --label) LABEL="${2:-}"; shift 2 ;;
    --prompt-file) PROMPT_FILE="${2:-}"; shift 2 ;;
    --exclude) EXCLUDE="${2:-}"; shift 2 ;;
    --patch) PATCH="${2:-}"; shift 2 ;;
    --ref) REF="${2:-}"; shift 2 ;;
    --model) MODEL="${2:-}"; shift 2 ;;
    --allowed-tools) TOOLS="${2:-}"; shift 2 ;;
    --out) OUT="${2:-}"; shift 2 ;;
    *) die "unknown argument: $1" ;;
  esac
done
[ -n "$LABEL" ] || die "--label is required"
[[ "$LABEL" =~ ^[A-Za-z0-9._-]+$ ]] || die "--label must match [A-Za-z0-9._-]+"
[ -f "$PROMPT_FILE" ] || die "--prompt-file not found: ${PROMPT_FILE:-<unset>}"
case "$EXCLUDE" in ""|local|project) ;; *) die "--exclude must be local or project" ;; esac
[ -z "$PATCH" ] || [ -f "$PATCH" ] || die "--patch not found: $PATCH"
for dep in git jq; do command -v "$dep" >/dev/null 2>&1 || die "missing dependency: $dep"; done
[ -n "$REF" ] || REF="$(git -C "$REPO" rev-parse origin/staging)"

if [ -z "$OUT" ]; then OUT="$(mktemp -d "${TMPDIR:-/tmp}/getff-replay-${LABEL}-XXXXXX")"; fi
mkdir -p "$OUT"
CLONE="$OUT/clone"
git clone --quiet --shared --no-checkout "$REPO" "$CLONE"
git -C "$CLONE" -c advice.detachedHead=false checkout --quiet --detach "$REF"
[ -z "$PATCH" ] || git -C "$CLONE" apply "$PATCH"
case "$EXCLUDE" in
  local) bash "$HERE/exclude-path-scoped-rules.sh" "$CLONE" "$CLONE/.claude/settings.local.json" >/dev/null ;;
  project) bash "$HERE/exclude-path-scoped-rules.sh" "$CLONE" "$CLONE/.claude/settings.json" >/dev/null ;;
esac
cp "$PROMPT_FILE" "$OUT/prompt.txt"
# Freeze the prepared state (patch + exclusion) as one local commit, so `git -C clone diff HEAD`
# afterwards shows the session's own work only and never reveals which state it ran in.
git -C "$CLONE" add -A -f
git -C "$CLONE" -c user.name=replay -c user.email=replay@localhost commit --quiet --allow-empty \
  --no-verify -m "replay setup: $LABEL"

# The session sees only the clone's project + local settings: no user-level hooks or plugins,
# so the before and after runs differ by the exclusion (and patch) alone.
set +e
( cd "$CLONE" && "$CLAUDE_BIN" -p "$(cat "$OUT/prompt.txt")" --model "$MODEL" \
    --setting-sources project,local --allowedTools "$TOOLS" --permission-mode acceptEdits \
    --output-format json ) < /dev/null > "$OUT/result.json" 2> "$OUT/stderr.log"
CLAUDE_EXIT=$?
set -e
SESSION="$(jq -r '.session_id // empty' "$OUT/result.json" 2>/dev/null || true)"
[ -n "$SESSION" ] || { echo "rule-load-replay: no session_id in $OUT/result.json (claude exit $CLAUDE_EXIT)" >&2; exit 3; }

# Collect the session transcript (and its subagents) into a private corpus, so the
# measurement reads this run alone.
MAIN="$(find "$CORPUS_ROOT" -name "$SESSION.jsonl" -not -path '*/subagents/*' -print -quit 2>/dev/null || true)"
[ -n "$MAIN" ] || { echo "rule-load-replay: transcript $SESSION.jsonl not found under $CORPUS_ROOT" >&2; exit 3; }
mkdir -p "$OUT/transcript/replay-$LABEL"
cp "$MAIN" "$OUT/transcript/replay-$LABEL/"
SUBDIR="$(dirname "$MAIN")/$SESSION/subagents"
if [ -d "$SUBDIR" ]; then
  mkdir -p "$OUT/transcript/replay-$LABEL/$SESSION"
  cp -R "$SUBDIR" "$OUT/transcript/replay-$LABEL/$SESSION/"
fi

if ! MEASURE_SECTIONS=native-load CORPUS_ROOT="$OUT/transcript" PROJECT_MATCH="*replay-$LABEL*" \
    bash "$MEASURE" > "$OUT/measure.txt" 2>&1; then
  echo "rule-load-replay: measurement failed, see $OUT/measure.txt" >&2; exit 4
fi

# Loader cards: every additionalContext line the loader emits starts with the 📎 marker.
# `.attachment.content` is an array of strings (Claude Code 2.1.281); a string is accepted too.
# Characters are counted by jq (codepoints), the unit of the native-load figure above.
read -r CARDS CARD_CHARS < <(find "$OUT/transcript" -name '*.jsonl' -print0 | xargs -0 cat \
  | jq -c 'select(.type == "attachment" and .attachment.type == "hook_additional_context")
           | .attachment.content | if type == "array" then .[] else . end | strings
           | split("\n")[] | select(startswith("📎"))' 2>/dev/null \
  | jq -rs '"\(length) \(map(length) | add // 0)"')

{
  echo "REPLAY label=$LABEL exclude=${EXCLUDE:-none} patch=$([ -n "$PATCH" ] && basename "$PATCH" || echo none) ref=$REF session=$SESSION claude_exit=$CLAUDE_EXIT"
  grep '^NATIVE-RULE-LOADS ' "$OUT/measure.txt" || true
  echo "LOADER-CARDS cards=$CARDS chars=$CARD_CHARS"
} > "$OUT/summary.txt"
cat "$OUT/summary.txt"
echo "rule-load-replay: run directory $OUT"
