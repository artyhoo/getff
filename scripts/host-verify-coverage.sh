#!/usr/bin/env bash
# host-verify-coverage.sh — emit CANDIDATES where a kickoff's host-verify contract
# names no command that reaches an area its own allowlist permits.
#
# THIS IS NOT A GATE. It exits 0 whether or not it finds candidates. The reason is
# measured, not stylistic — see docs/meta-factory/research-patches/2026-08-09-contract-deliverable-coverage.md:
# three gate variants were built and replayed against the incident that motivates this
# file, and each failed on one of the two legs a gate needs:
#
#   variant                                    flags/file   catches the incident?
#   syntactic — what this script emits              5.7     yes — but see the false classes
#   transitive (import closure of the commands)     3.4     NO  — recall 0
#   file-fraction (<10% of area's files reached)    5.1     NO  — the area sits at 13%
#
# The transitive and file-fraction rows are prototype measurements over the same
# 11-kickoff cohort; only the first row is this script's own output.
#
# Those three numbers are the 2026-08-09 decision record and are NOT re-measured here.
# Re-replayed 2026-08-16 on the grown 17-kickoff allowlist cohort after `to_area()` moved
# from a depth table to the containing directory (below): 72 → 78 candidates, 4.24 → 4.59
# per file, 14 → 16 of 17 files flagged. No area flagged before stopped being surfaced
# (19 entries changed label, 0 detections lost); the 6 net-new areas are 3× a permitted
# `tests/install-sh/baselines` no command regenerates, 2× the research-patch gap the
# deepening exists to catch, and `scripts/triage-kernel-v2-bench`. The density stays under
# the 5.7 that this table already judged right for a candidate list, so the emission
# remains usable and the verdict below is unchanged.
#
# A flag density that disqualifies a gate is the right density for a CANDIDATE LIST
# (precedent: the K6 emission in agents/dispatch-input-checker.md, whose own broader
# variant was falsified at 0/2 recall). The adjudicating layer is the named cold seat
# — K4 of agents/dispatch-input-checker.md, the `#silent-contract-skip` class of
# .claude/rules/destination-environment-verification.md §4 — never this script, and
# never "someone reads the output" (#warning-nobody-reads,
# .claude/rules/attention-is-not-a-mechanism.md §2).
#
# THE CLASS IT SERVES
#   getff-freshness-widening S1 (merged PR #1333): the kickoff permitted
#   `packages/core/synthesizer/**` and its §3 criterion 3 was about a synthesis-time
#   stamp, yet none of the four declared commands asserted it.
#   `bash scripts/host-verify.sh getff-freshness-widening-s1` returned 4/4 PASS on a
#   branch where `packages/core/synthesizer/generate.ts` never stamped `tier` — a MAJOR
#   on cold audit. The contract could not have detected the defect class it gated.
#
# GRAMMAR LIVES IN ONE PLACE
#   Contract extraction is NOT re-implemented here: this script shells out to
#   `host-verify.sh --list` and consumes its `   • <command>` lines, so the two cannot
#   disagree about what counts as a contract (#sync-by-copy-paste,
#   .claude/rules/dual-implementation-discipline.md §8).
#
# USAGE
#   bash scripts/host-verify-coverage.sh <umbrella|path-to-kickoff.md>
#
# EXIT CODES
#   0 — emission completed (with or without candidates). NOT a verdict.
#   2 — usage error, kickoff not found, or the contract could not be extracted.
#
# Deterministic bash + awk + git only — no jq, no node, no network, no paid LLM
# (.claude/rules/no-paid-llm-in-ci.md).
set -uo pipefail

usage() {
  cat >&2 <<'EOF'
usage: bash scripts/host-verify-coverage.sh <umbrella|path-to-kickoff.md>

Emits K4 candidates: areas the kickoff's allowlist permits that no declared
host-verify command names. Emission, not a gate — always exits 0 on success.
EOF
}

case "${1:-}" in
  '' | -h | --help) usage; exit 2 ;;
esac

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
TARGET="$1"

if [ -f "$TARGET" ]; then
  KICKOFF="$TARGET"
elif [ -f "$REPO_ROOT/$TARGET" ]; then
  KICKOFF="$REPO_ROOT/$TARGET"
else
  case "$TARGET" in
    */* | *..*)
      printf '❌ host-verify-coverage: umbrella name must not contain `/` or `..` (got: %s).\n' "$TARGET" >&2
      exit 2
      ;;
  esac
  KICKOFF="$REPO_ROOT/.claude/orchestrator-prompts/$TARGET/kickoff.md"
fi

if [ ! -f "$KICKOFF" ]; then
  printf '❌ host-verify-coverage: no kickoff at %s\n' "$KICKOFF" >&2
  exit 2
fi
REL_KICKOFF="${KICKOFF#"$REPO_ROOT/"}"

# ── Tracked-path oracle ───────────────────────────────────────────────────────
# A token counts as a repo path only if it resolves to something git tracks. Without
# this, prose fragments that merely contain a slash ("criterion-5/7/9") become areas —
# measured: they were 6 of 17 extracted "areas" on the motivating kickoff before the
# oracle was added.
TRACKED_FILE="$(mktemp)"
trap 'rm -f "$TRACKED_FILE"' EXIT
git -C "$REPO_ROOT" ls-files > "$TRACKED_FILE" 2>/dev/null
if [ ! -s "$TRACKED_FILE" ]; then
  printf '❌ host-verify-coverage: `git ls-files` returned nothing — cannot resolve paths.\n' >&2
  exit 2
fi
# Every tracked path plus every directory prefix of one, so a prefix test is one
# fixed-string lookup rather than a per-segment regex scan over the whole index.
PREFIX_FILE="$(mktemp)"
trap 'rm -f "$TRACKED_FILE" "$PREFIX_FILE"' EXIT
awk -F/ '{ p = ""; for (i = 1; i <= NF; i++) { p = (i == 1 ? $i : p "/" $i); print p } }' \
  "$TRACKED_FILE" | sort -u > "$PREFIX_FILE"

# Deepest real prefix of a token: strips globs/braces, walks down while git still
# knows the path. Echoes nothing when the token names nothing tracked.
resolve_real() {
  local raw="$1" p seg cur best
  p="${raw#./}"
  p="${p%%[\`\'\",:;)]}"
  case "$p" in
    *'://'* | //*) return 0 ;;
  esac
  case "$p" in
    */*) ;;
    *) return 0 ;;
  esac
  p="$(printf '%s' "$p" | sed 's/{[^}]*}//g')"
  best=''
  cur=''
  local IFS='/'
  # shellcheck disable=SC2086
  for seg in $p; do
    [ -z "$seg" ] && continue
    case "$seg" in
      *'*'*) break ;;
    esac
    if [ -z "$cur" ]; then cur="$seg"; else cur="$cur/$seg"; fi
    if grep -qxF "$cur" "$PREFIX_FILE"; then
      best="$cur"
    else
      break
    fi
  done
  [ -n "$best" ] && printf '%s\n' "$best"
  return 0
}

# Normalise a real path to the AREA a permitted-files list reasons in: the path itself
# when it names a DIRECTORY, otherwise its containing directory. `resolve_real` only ever
# returns paths git knows, so "not a tracked file" is an exact directory test.
#
# This replaced a hard-coded per-root depth table (`docs`/`.claude`/`.github`/`tests` at 2
# segments, `packages/core` at 3). That table was the source of an area-granularity FALSE
# NEGATIVE: every `docs/**` path normalised to `docs/meta-factory`, so a contract naming one
# file under that prefix marked the whole prefix covered. Measured on triage-kernel-v2 S4b,
# whose allowlist permits BOTH `docs/meta-factory/triage-corpus/*` and
# `docs/meta-factory/research-patches/*` while its §7 names only triage-corpus files: the
# emitter reported `Candidates: 0`, and the research patch duly shipped (PR #1400) without
# principle 10's `<!-- scope: -->` line, caught by a hand-run of `test:principles`.
# The table had the same hole under `.claude/skills/<skill>`, `tests/install-sh/baselines`
# and `packages/core/hooks/checks`; deriving the area from the tree closes all four and
# leaves no depth constant to drift.
to_area() {
  local p="$1"
  if grep -qxF "$p" "$TRACKED_FILE"; then
    case "$p" in
      */*) printf '%s\n' "${p%/*}" ;;
      *) printf '%s\n' "$p" ;;
    esac
  else
    printf '%s\n' "$p"
  fi
}

# ── (a) the allowlist — the declared non-goal, read as prose ──────────────────
# The section body up to the first `**Not permitted` / `**Out of scope` /
# `**Forced-but-unlisted` marker. Only backticked tokens count: an allowlist states
# its paths in code spans, and unquoted prose in the same section is narrative.
ALLOWLIST_BODY="$(awk '
  /^#{2,4}[ \t].*([Pp]ermitted files|[Pp]ermitted set|[Ff]iles you may touch|[Pp]ermitted paths)/ { p = 1; next }
  p && /^## / { exit }
  p { print }
' "$KICKOFF")"

HAS_ALLOWLIST=false
[ -n "$ALLOWLIST_BODY" ] && HAS_ALLOWLIST=true

ALLOWLIST_HEAD="$(printf '%s\n' "$ALLOWLIST_BODY" | awk '
  /\*\*Not permitted|\*\*Out of scope|\*\*Forced-but-unlisted/ { exit }
  { print }
')"

PERMITTED_AREAS=''
if [ "$HAS_ALLOWLIST" = true ]; then
  while IFS= read -r tok; do
    [ -z "$tok" ] && continue
    real="$(resolve_real "$tok")"
    [ -z "$real" ] && continue
    PERMITTED_AREAS="$PERMITTED_AREAS$(to_area "$real")
"
  done <<EOF
$(printf '%s\n' "$ALLOWLIST_HEAD" | grep -oE '`[^`]+`' | tr -d '`' | tr ' ,()' $'\n\n\n\n')
EOF
fi
PERMITTED_AREAS="$(printf '%s' "$PERMITTED_AREAS" | grep -v '^$' | sort -u)"

# ── (b) what the declared commands name ───────────────────────────────────────
LIST_OUT="$(bash "$REPO_ROOT/scripts/host-verify.sh" --list "$KICKOFF" 2>&1)"
LIST_RC=$?
if [ "$LIST_RC" -ne 0 ]; then
  printf 'CONTRACT-COVERAGE: %s\n' "$REL_KICKOFF"
  printf 'Contract: UNAVAILABLE (host-verify.sh --list exit %d)\n' "$LIST_RC"
  printf '%s\n' "$LIST_OUT" >&2
  exit 2
fi

if printf '%s\n' "$LIST_OUT" | grep -q '   opt-out ('; then
  printf 'CONTRACT-COVERAGE: %s\n' "$REL_KICKOFF"
  printf 'Contract: OPT-OUT — no commands to compare against\n'
  printf 'Candidates: 0\n'
  exit 0
fi

COMMANDS="$(printf '%s\n' "$LIST_OUT" | sed -n 's/^   • //p')"
NAMED_AREAS=''
while IFS= read -r cmd; do
  [ -z "$cmd" ] && continue
  for tok in $(printf '%s' "$cmd" | tr " '\"();|&" $'\n\n\n\n\n\n\n\n'); do
    real="$(resolve_real "$tok")"
    [ -z "$real" ] && continue
    NAMED_AREAS="$NAMED_AREAS$(to_area "$real")
"
  done
done <<EOF
$COMMANDS
EOF
NAMED_AREAS="$(printf '%s' "$NAMED_AREAS" | grep -v '^$' | sort -u)"

# ── (c) emit (a) minus (b) ────────────────────────────────────────────────────
printf 'CONTRACT-COVERAGE: %s\n' "$REL_KICKOFF"
if [ "$HAS_ALLOWLIST" != true ]; then
  # 30 of the 41 contract-bearing kickoffs are in this state (measured 2026-08-09):
  # scope is expressed as prose plus an `Anti-scope`/`Descopes` denylist, so there is
  # no allowlist to subtract from. Absence of candidates here is absence of INPUT.
  printf 'Allowlist: ABSENT — scope stated as prose/denylist; no set to compare against\n'
  printf 'Candidates: N/A (not "clean" — the comparison has no input)\n'
  printf 'Commands name: %s\n' "$(printf '%s' "$NAMED_AREAS" | tr '\n' ' ')"
  exit 0
fi

N_PERM="$(printf '%s\n' "$PERMITTED_AREAS" | grep -cv '^$')"
printf 'Allowlist: present — %s permitted areas\n' "$N_PERM"
printf 'Commands name: %s\n' "$(printf '%s' "$NAMED_AREAS" | tr '\n' ' ')"

N_CAND=0
while IFS= read -r a; do
  [ -z "$a" ] && continue
  if ! printf '%s\n' "$NAMED_AREAS" | grep -qxF "$a"; then
    printf 'CANDIDATE: %s — permitted, named by no declared command\n' "$a"
    N_CAND=$((N_CAND + 1))
  fi
done <<EOF
$PERMITTED_AREAS
EOF
printf 'Candidates: %d\n' "$N_CAND"

# Never let an empty list read as health (T14). These are the false-positive classes
# MEASURED on the 11-kickoff cohort, and the false-NEGATIVE class the incident proves.
cat <<'EOF'
Known-false-positive classes (do not report "coverage clean"):
  (i)   transitive reach — a command may exercise an area it never names. Measured on
        a prototype closure over this cohort, 38% of flags were reached that way.
  (ii)  grant-by-description — an allowlist may permit paths it never spells out
        ("the four §1.1 registry files"), so a named area can be under-counted.
  (iii) non-path deliverable — a contract may assert repo-root artefacts that
        resolve to no tracked area at all.
Known-false-negative classes:
  (a) an area NAMED by a command whose assertions do not touch the deliverable inside
      it. This is the motivating incident's own shape and is beyond every mechanical
      variant — only the adjudicating seat closes it.
  (b) sibling files in ONE directory — an area is the containing directory, so a
      permitted `<dir>/A.md` counts as covered by a command naming `<dir>/B.md`. This is
      the residual of the quantization defect fixed in 2026-08-16: the per-root depth
      table was one level too coarse and is gone, but the floor is now the directory, not
      the file. Closing (b) too — subtracting at file granularity — was built and replayed
      over the same cohort and REJECTED at 6.65 flags/file (vs 4.59), above the density
      this emitter already treats as its ceiling, and demonstrably wrong: on
      triage-kernel-v2 S4b it flags `s4b-outcomes.csv` and `s4b-audit-raw.json`, both of
      which the declared `scripts/triage-s4b-outcomes.mjs` run produces.
EOF
exit 0
