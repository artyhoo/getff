#!/usr/bin/env bash
# plan-drift-write-guard.sh — deterministic write guard for planning §1 Step 3 (F1 reconcile).
#
# GH-4208120881 fix: the shared-plan write boundary must not rest on writer self-inspection
# (attention-is-not-a-mechanism §1 — self-inspection is neither a deterministic gate nor a
# named cold protocol). Before a reconciled factual write is ACCEPTED, this guard binds:
#   1. repo + path        — the plan file must exist inside a git worktree;
#   2. exact pre-image    — sha256(snapshot) must equal the sha the writer recorded at read
#                           time, and the declared target fragment must occur in the snapshot
#                           EXACTLY ONCE (the "one uniquely identified row or section");
#   3. minimal factual    — the snapshot→postimage diff may touch ONLY the declared target's
#      diff               line span; removed text must be the declared target; added text must
#                           be the declared replacement; every added line must be a factual
#                           status/evidence field carrying an evidence token; table-row syntax
#                           (a `|`-line starts and ends with `|`) must hold;
# and emits a structured receipt bound to the ACTUAL postimage sha256.
#
# Semantic arm (exit 3): a diff confined to the declared span whose removed lines carry
# strategy vocabulary (priority / admission / dependency / gating / headings) or whose added
# lines are not mechanically classifiable as factual+evidence is NEVER auto-accepted — it is
# routed to the named cold check [.agents/roles/plan-drift-semantic-auditor.md]. Deterministic
# bash only; no LLM call, no CI wiring (no-paid-llm-in-ci).
#
# Usage:
#   plan-drift-write-guard.sh --plan <path> \
#     --preimage <snapshot-file> --expected-preimage-sha <sha256> \
#     (--expect-target <fragment> | --expect-target-file <file>) \
#     (--expect-new <fragment> | --expect-new-file <file>)
#
# Exit codes:
#   0  ALLOWED            — receipt printed, bound to the actual postimage
#   1  BLOCKED            — binding/syntax failure: snapshot ≠ read sha, target absent or
#                            non-unique (wrong row), concurrent pre-image change, failed
#                            write (no change detected), diff outside the declared span,
#                            declared replacement not what landed, malformed row
#   2  USAGE              — missing/unknown args, missing files, not a git worktree
#   3  SEMANTIC-REVIEW-REQUIRED — mechanically unclassifiable / strategy-class diff; route to
#                            the named cold check; auto-accept forbidden, receipt withheld
#
# @cc-only-rationale: meta-orchestrator skill helper — runs in-session at the write moment;
#   no portable equivalent fires at the same instant (the guard must observe the working tree
#   between the Edit and the accept decision).
set -euo pipefail

PLAN=""
PREIMAGE=""
EXPECTED_SHA=""
TARGET=""
TARGET_FILE=""
NEW_TEXT=""
NEW_FILE=""
TARGET_GIVEN=0
NEW_GIVEN=0

usage() { echo "USAGE: $0 --plan <path> --preimage <snapshot> --expected-preimage-sha <sha256> (--expect-target <fragment> | --expect-target-file <f>) (--expect-new <fragment> | --expect-new-file <f>)" >&2; exit 2; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --plan) PLAN="${2:-}"; shift 2 ;;
    --preimage) PREIMAGE="${2:-}"; shift 2 ;;
    --expected-preimage-sha) EXPECTED_SHA="${2:-}"; shift 2 ;;
    --expect-target) TARGET="${2:-}"; TARGET_GIVEN=1; shift 2 ;;
    --expect-target-file) TARGET_FILE="${2:-}"; shift 2 ;;
    --expect-new) NEW_TEXT="${2:-}"; NEW_GIVEN=1; shift 2 ;;
    --expect-new-file) NEW_FILE="${2:-}"; shift 2 ;;
    *) echo "BLOCKED: unknown argument '$1'" >&2; usage ;;
  esac
done

[[ -n "$PLAN" && -n "$PREIMAGE" && -n "$EXPECTED_SHA" && ( "$TARGET_GIVEN" -eq 1 || -n "$TARGET_FILE" ) && ( "$NEW_GIVEN" -eq 1 || -n "$NEW_FILE" ) ]] || usage
[[ -f "$PLAN" ]] || { echo "BLOCKED: plan file not found: $PLAN" >&2; exit 2; }
[[ -f "$PREIMAGE" ]] || { echo "BLOCKED: pre-image snapshot not found: $PREIMAGE" >&2; exit 2; }
[[ -z "$TARGET_FILE" || -f "$TARGET_FILE" ]] || { echo "BLOCKED: target fragment file not found: $TARGET_FILE" >&2; exit 2; }
[[ -z "$NEW_FILE" || -f "$NEW_FILE" ]] || { echo "BLOCKED: replacement fragment file not found: $NEW_FILE" >&2; exit 2; }

# Portable sha256 (same fallback pair as scripts/build-getff-dist.sh).
sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}';
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}';
  else return 1; fi
}

# contains_frag <content-file> <frag-file> — exit 0 iff content contains frag verbatim.
contains_frag() {
  awk -v fragfile="$2" '
    BEGIN { while ((getline fl < fragfile) > 0) frag = frag ((frag == "") ? "" : "\n") fl }
    { content = content ((NR > 1) ? "\n" : "") $0 }
    END { exit (index(content, frag) > 0) ? 0 : 1 }
  ' "$1"
}

# frag_span <content-file> <frag-file> — prints "<count> <firstline> <lastline>".
frag_span() {
  awk -v fragfile="$2" '
    BEGIN {
      while ((getline fl < fragfile) > 0) frag = frag ((frag == "") ? "" : "\n") fl
      nlf = split(frag, parts, "\n")
    }
    {
      content = content ((NR > 1) ? "\n" : "") $0
      off[NR] = curlen; curlen += length($0) + 1
    }
    END {
      start = 1; count = 0; firstline = 0
      while (1) {
        p = index(substr(content, start), frag)
        if (p == 0) break
        abs = start + p - 1
        count++
        lo = 1; hi = NR
        while (lo < hi) { mid = int((lo + hi + 1) / 2); if (off[mid] < abs) lo = mid; else hi = mid - 1 }
        if (firstline == 0) firstline = lo
        start = abs + 1
      }
      print count, firstline, (firstline > 0 ? firstline + nlf - 1 : 0)
    }
  ' "$1"
}

# ── Bind the snapshot to what was read ────────────────────────────────────────
ACTUAL_SNAPSHOT_SHA="$(sha256_file "$PREIMAGE")" || { echo "BLOCKED: no sha256 tool available — pre-image cannot be bound; write forbidden" >&2; exit 1; }
if [[ "$ACTUAL_SNAPSHOT_SHA" != "$EXPECTED_SHA" ]]; then
  echo "BLOCKED: pre-image snapshot sha mismatch — snapshot is not the bytes that were read (expected ${EXPECTED_SHA}, got ${ACTUAL_SNAPSHOT_SHA}); re-read the file and restart reconciliation"
  exit 1
fi

# ── Bind repo + path ─────────────────────────────────────────────────────────
PLAN_DIR="$(dirname "$PLAN")"
TOPLEVEL="$(git -C "$PLAN_DIR" rev-parse --show-toplevel 2>/dev/null)" || { echo "BLOCKED: $PLAN is not inside a git worktree — repo binding failed" >&2; exit 2; }
TOPLEVEL_REAL="$(cd "$TOPLEVEL" && pwd -P)"
PLAN_REAL="$(cd "$PLAN_DIR" && pwd -P)/$(basename "$PLAN")"
case "$PLAN_REAL" in
  "$TOPLEVEL_REAL"/*) : ;;
  *) echo "BLOCKED: plan path escapes the repo toplevel (${PLAN_REAL} vs ${TOPLEVEL_REAL})" >&2; exit 2 ;;
esac

# ── Target uniqueness + span (declared pre-image) ────────────────────────────
TARGET_SRC="${TARGET_FILE:-/dev/stdin}"
if [[ -z "$TARGET_FILE" ]]; then
  TARGET_TMP="$(mktemp "${TMPDIR:-/tmp}/pdwg-target.XXXXXX")" && printf '%s' "$TARGET" > "$TARGET_TMP"
  TARGET_SRC="$TARGET_TMP"
fi
NEW_SRC="${NEW_FILE:-/dev/stdin}"
if [[ -z "$NEW_FILE" ]]; then
  NEW_TMP="$(mktemp "${TMPDIR:-/tmp}/pdwg-new.XXXXXX")" && printf '%s' "$NEW_TEXT" > "$NEW_TMP"
  NEW_SRC="$NEW_TMP"
fi
trap 'rm -f "${TARGET_TMP:-}" "${NEW_TMP:-}" "${DIFF_TMP:-}" "${JOINT_REM_TMP:-}" "${JOINT_ADD_TMP:-}"' EXIT

read -r OCC SPAN_START SPAN_END <<< "$(frag_span "$PREIMAGE" "$TARGET_SRC")"
if [[ "$OCC" -eq 0 ]]; then
  echo "BLOCKED: declared target fragment not found in the pre-image — wrong row or stale declaration"
  exit 1
fi
if [[ "$OCC" -gt 1 ]]; then
  echo "BLOCKED: declared target fragment occurs ${OCC} times in the pre-image — not uniquely identified; refine the declaration"
  exit 1
fi

# ── Failed-write detection ───────────────────────────────────────────────────
PREIMAGE_SHA_COPY="$ACTUAL_SNAPSHOT_SHA"
POSTIMAGE_SHA="$(sha256_file "$PLAN")" || { echo "BLOCKED: no sha256 tool available — postimage cannot be bound; write forbidden" >&2; exit 1; }
if [[ "$POSTIMAGE_SHA" == "$PREIMAGE_SHA_COPY" ]]; then
  echo "BLOCKED: failed write — postimage is byte-identical to the pre-image; no reconciliation landed"
  exit 1
fi

# ── Diff classification ──────────────────────────────────────────────────────
DIFF_TMP="$(mktemp "${TMPDIR:-/tmp}/pdwg-diff.XXXXXX")"
diff -u "$PREIMAGE" "$PLAN" > "$DIFF_TMP" || true

# Strategy vocabulary whose edit is a semantic fork, never a mechanical accept (the wave-plan
# §0 rows carry priority / admission / dependency gating prose; a heading edit is structural).
PROTECTED_RE='(^#{1,6} |[Pp]riorit|[Aa]dmission|[Dd]ependenc|[Gg]ated on|[Bb]locked on|[Dd]epends on|[Pp]arallel-[Ww]ith)'
# Permitted factual-field classes (planning §1 Step 3: "factual status/evidence").
FACTUAL_RE='(✅|🟡|🔲|⚠|DONE|MERGED|CLOSED|OPEN|NOT STARTED|IN-FLIGHT|SHIPPED|VERIFIED|RECONCILED|PARTIAL|OPEN_PR_TOTAL)'
# Every added factual line must carry evidence (PR ref, ISO date, count verdict, path, file:line).
EVIDENCE_RE='(#[0-9]+|20[0-9]{2}-[0-9]{2}-[0-9]{2}|OPEN_PR_TOTAL|done\.md|kickoff\.md|[A-Za-z0-9_./-]+\.(md|sh|ts|mjs|json):[0-9]+|npm view|git rev-parse|gh pr)'

OUTSIDE_SAMPLES=""
OUTSIDE_COUNT=0
PROTECTED_HITS=""
SEMANTIC_HITS=""
SYNTAX_HITS=""
REMOVED_JOINT=""
ADDED_JOINT=""
ADDED_N=0
REMOVED_N=0

while IFS= read -r dline; do
  case "$dline" in
    '@@'*)
      set -- $(printf '%s\n' "$dline" | awk '{split($2, a, /[-,]/); split($3, b, /[,+]/); print a[2], b[2]}')
      OLD_LINE="${1:-0}"; NEW_LINE="${2:-0}"
      ;;
    '+++'*|'---'*) : ;;
    '\\'*) : ;;
    '-'*)
      if (( OLD_LINE < SPAN_START || OLD_LINE > SPAN_END )); then
        OUTSIDE_COUNT=$((OUTSIDE_COUNT + 1))
        OUTSIDE_SAMPLES="${OUTSIDE_SAMPLES}${OUTSIDE_SAMPLES:+; }old L${OLD_LINE}"
      fi
      body="${dline#-}"
      if printf '%s\n' "$body" | grep -Eq "$PROTECTED_RE"; then
        PROTECTED_HITS="${PROTECTED_HITS}  old L${OLD_LINE}: ${body}"$'\n'
      fi
      REMOVED_JOINT="${REMOVED_JOINT}${REMOVED_JOINT:+$'\n'}${body}"
      REMOVED_N=$((REMOVED_N + 1))
      OLD_LINE=$((OLD_LINE + 1))
      ;;
    '+'*)
      if (( NEW_LINE < SPAN_START || NEW_LINE > SPAN_END )); then
        OUTSIDE_COUNT=$((OUTSIDE_COUNT + 1))
        OUTSIDE_SAMPLES="${OUTSIDE_SAMPLES}${OUTSIDE_SAMPLES:+; }new L${NEW_LINE}"
      fi
      body="${dline#+}"
      if [[ "$body" == '|'* && "$body" != *'|' ]]; then
        SYNTAX_HITS="${SYNTAX_HITS}  new L${NEW_LINE}: ${body}"$'\n'
      fi
      if ! printf '%s\n' "$body" | grep -Eq "$FACTUAL_RE" || ! printf '%s\n' "$body" | grep -Eq "$EVIDENCE_RE"; then
        SEMANTIC_HITS="${SEMANTIC_HITS}  new L${NEW_LINE}: ${body}"$'\n'
      fi
      ADDED_JOINT="${ADDED_JOINT}${ADDED_JOINT:+$'\n'}${body}"
      ADDED_N=$((ADDED_N + 1))
      NEW_LINE=$((NEW_LINE + 1))
      ;;
    *)
      OLD_LINE=$((OLD_LINE + 1)); NEW_LINE=$((NEW_LINE + 1))
      ;;
  esac
done < "$DIFF_TMP"

# Binding failures first — deterministic rejections (exit 1).
if (( OUTSIDE_COUNT > 0 )); then
  echo "BLOCKED: diff touches lines outside the declared target span (lines ${SPAN_START}-${SPAN_END}); changed: ${OUTSIDE_SAMPLES} — wrong row or concurrent pre-image change; re-read and re-declare"
  exit 1
fi
if (( REMOVED_N > 0 )); then
  printf '%s\n' "$REMOVED_JOINT" > "${DIFF_TMP}.rem"
  if ! contains_frag "${DIFF_TMP}.rem" "$TARGET_SRC"; then
    echo "BLOCKED: removed text is not the declared target — what landed removed something other than the declared pre-image fragment"
    exit 1
  fi
fi
printf '%s\n' "$ADDED_JOINT" > "${DIFF_TMP}.add"
if ! contains_frag "${DIFF_TMP}.add" "$NEW_SRC"; then
  echo "BLOCKED: postimage does not contain the declared replacement — the write that landed is not what was declared (concurrent in-row change or failed edit)"
  exit 1
fi
if [[ -n "$SYNTAX_HITS" ]]; then
  echo "BLOCKED: table syntax — a changed row line does not start and end with '|':"
  printf '%s' "$SYNTAX_HITS"
  exit 1
fi

# Semantic arm — never auto-accept (exit 3).
if [[ -n "$PROTECTED_HITS" ]]; then
  echo "SEMANTIC-REVIEW-REQUIRED: removed lines carry strategy vocabulary or structural headings — route to .agents/roles/plan-drift-semantic-auditor.md; auto-accept forbidden"
  printf '%s' "$PROTECTED_HITS"
  exit 3
fi
if [[ -n "$SEMANTIC_HITS" ]]; then
  echo "SEMANTIC-REVIEW-REQUIRED: added lines are not mechanically classifiable as factual fields carrying evidence — route to .agents/roles/plan-drift-semantic-auditor.md; auto-accept forbidden"
  printf '%s' "$SEMANTIC_HITS"
  exit 3
fi

echo "PLAN-WRITE-RECEIPT: verdict=ALLOWED repo=${TOPLEVEL_REAL} path=${PLAN} preimage_sha=${PREIMAGE_SHA_COPY} postimage_sha=${POSTIMAGE_SHA} target_span=${SPAN_START}-${SPAN_END} added=${ADDED_N} removed=${REMOVED_N} guard=plan-drift-write-guard.sh/1"
exit 0
