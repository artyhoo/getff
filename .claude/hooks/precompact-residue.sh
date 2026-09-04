#!/usr/bin/env bash
# @cc-only-rationale: CC-specific PreCompact hook (session-residue writer) — PreCompact fires
#   only inside a Claude Code session, and it is NOT in ZCode's event set
#   (`ZCODE_EVENTS`, scripts/render-harness-config.mjs:46-54), so no portable counterpart
#   exists by nature. Framework-internal (operator-axis) for now: not delivered by
#   install.sh / setup.d, and its reader is the framework's own /pipeline §1 injection.
#   Audience triage per .claude/rules/dual-implementation-discipline.md §3 — «internal
#   tooling → CC-native only»; widening to the consumer axis is a separate decision, not a
#   side effect of this hook shipping.
# spec: docs/superpowers/specs/2026-08-09-pipeline-chips-session-bus-design.md §D8 (S2b)
#
# WHAT IT DOES — the hook itself WRITES the residue; it never asks the model to.
# Round-1 correction recorded in D8: a non-blocking PreCompact hook gives the model no
# execution window, so «remind the model to write a handoff before compaction» is
# undeliverable as specified. The deterministic form is the one registered in
# docs/meta-factory/prior-art-evaluations.md #108 («PreCompact — save wave-state before
# compaction»): extract what is ALREADY in the transcript and write it to a file.
#
# NON-BLOCKING BY CHOICE, not by inability. PreCompact *can* block (exit 2 → compaction is
# blocked, per the CC hooks reference, fetched 2026-08-17). This hook must never do that:
# blocking compaction on a residue-write failure would strand a session at a full context
# window — strictly worse than losing the residue. Every path therefore ends `exit 0`, and
# `set -uo pipefail` (NOT -e) keeps a failed sub-step from aborting the rest of the write.
#
# NAMED READER (a residue nobody reads is `#warning-nobody-reads`,
# .claude/rules/attention-is-not-a-mechanism.md §2): the file rides the /pipeline §1 Step-1
# injection block (.claude/skills/pipeline/SKILL.md), so the next /pipeline invocation
# surfaces it; the D6 handoff prose points a continuing session at the same path.
#
# LOCATION — the resolved orchestration home (`<orch-home>/_residue-<session>.md`), NOT
# #108's `.claude/session-state.md` sketch. Two deliberate deviations, both recorded in D8:
#   • per-session file, so N parallel sessions do not clobber one shared file;
#   • the orch-home, because that is where the reader already looks — /pipeline §1 resolves
#     it with helpers/print-orch-home.sh, and this hook calls THAT SAME helper (below), so
#     reader and writer agree by construction rather than by two copies of one rule.
set -uo pipefail

# Dependency guard — the transcript is JSONL and every extraction below is jq. No jq → no
# work is possible → exit silently rather than error-spam a compaction (same shape as
# end-of-turn-reminder.sh's consumer-skip guard).
command -v jq >/dev/null 2>&1 || exit 0

# Language pack — sourced for ONE value: AIF_RECAP_MARKER, the heading the model was told to
# start its recap with. That marker is category-3 match-data
# (.claude/rules/language-discipline.md §1): it must match whatever language the session ran
# in, or the recap block is invisible to the grep below. The residue file's own prose stays
# English (category 1 — a repo artifact).
# @dual-pair: hook-lang-i18n (spec: docs/superpowers/specs/2026-06-01-hook-lang-i18n-design.md)
_lang_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lang"
_lang_file="${_lang_dir}/${AIF_HOOK_LANG:-en}.sh"
[ -f "$_lang_file" ] || _lang_file="${_lang_dir}/en.sh"
# shellcheck source=/dev/null
[ -f "$_lang_file" ] && . "$_lang_file"
: "${AIF_RECAP_MARKER:=## 🟢 In plain words}"

input=$(cat)

session_id=$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null || true)
transcript=$(printf '%s' "$input" | jq -r '.transcript_path // empty' 2>/dev/null || true)
payload_cwd=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null || true)
trigger=$(printf '%s' "$input" | jq -r '.trigger // empty' 2>/dev/null || true)

# `trigger` is documented as manual|auto, but the hook must not DEPEND on it: a payload
# without the field still deserves a residue (fail-open on metadata, never on the write).
[ -n "$trigger" ] || trigger="unknown"
# A session id is the filename key. Absent → the residue would collide across sessions, which
# is the exact failure the per-session location exists to avoid. Fall back to a timestamp key
# rather than clobbering or skipping.
[ -n "$session_id" ] || session_id="nosession-$(date +%Y%m%dT%H%M%S)"
# Sanitise: the id lands in a filename. Anything outside [A-Za-z0-9._-] is replaced, so a
# hostile or merely odd id cannot escape the directory (`../`) or split the path.
session_key=$(printf '%s' "$session_id" | tr -c 'A-Za-z0-9._-' '_' | cut -c1-96)

# Repo root: CLAUDE_PROJECT_DIR is set by CC in the hook subprocess; the payload's `cwd` is
# the documented fallback; `pwd` is the last resort.
root="${CLAUDE_PROJECT_DIR:-}"
[ -n "$root" ] || root="$payload_cwd"
[ -n "$root" ] || root="$(pwd)"

# ── Residue directory — ONE resolution, shared with the reader ────────────────
# AIF_RESIDUE_DIR is the test seam + operator escape hatch (precedent: MO_ORCH_HOME).
# Otherwise call the /pipeline helper that §1's injection fence already calls, with
# REPO_ROOT pinned (lib/common.sh honours a pre-set value, common.sh:17) so the helper
# resolves THIS repo rather than whatever git toplevel the hook's cwd happens to be in.
# The inline branch at the end is the no-helper fallback (a consumer install without the
# skill); it mirrors resolve_orch_home() (helpers/lib/common.sh:50-57) and is the only
# duplicated logic here — kept because a residue written to a directory nobody reads is
# worse than a five-line mirror.
_residue_dir() {
  if [ -n "${AIF_RESIDUE_DIR:-}" ]; then printf '%s\n' "$AIF_RESIDUE_DIR"; return; fi
  local helper="$root/.claude/skills/pipeline/helpers/print-orch-home.sh" out=""
  if [ -f "$helper" ]; then
    out=$(REPO_ROOT="$root" bash "$helper" 2>/dev/null || true)
    if [ -n "$out" ]; then printf '%s\n' "$out"; return; fi
  fi
  if [ -d "$root/.claude/orchestrator-prompts" ]; then
    printf '%s\n' "$root/.claude/orchestrator-prompts"
  else
    printf '%s\n' "$root/.ai-factory/orchestrator-prompts"
  fi
}
residue_dir="$(_residue_dir)"
mkdir -p "$residue_dir" 2>/dev/null || exit 0
residue_file="${residue_dir}/_residue-${session_key}.md"

# ── Anchor: what this session was about ──────────────────────────────────────
# Same cascade as end-of-turn-reminder.sh:245-253 — CC's own session title first (present
# even when the first user message carries no extractable text block), head of the first
# user instruction second. grep-then-jq avoids slurping a large transcript.
anchor=""
if [ -n "$transcript" ] && [ -f "$transcript" ]; then
  anchor=$(grep '"type":"ai-title"' "$transcript" 2>/dev/null | tail -1 \
    | jq -r '.aiTitle // empty' 2>/dev/null || true)
  if [ -z "$anchor" ]; then
    anchor=$(grep -m1 '"type":"user"' "$transcript" 2>/dev/null \
      | jq -r 'if (.message.content|type=="array") then (.message.content[]? | select(.type=="text") | .text) else (.message.content // empty) end' 2>/dev/null \
      | head -1 | tr '\n' ' ' | cut -c1-120 || true)
  fi
fi
[ -n "$anchor" ] || anchor="(no session anchor in the transcript)"

# ── Body: the last model-authored recap, else the last assistant text ─────────
# `select(.isSidechain != true)` is REQUIRED and load-bearing for the same reason it is in
# the D7 context-arm: subagent turns share the transcript file, so without it the residue can
# capture a sub-agent's recap instead of the main thread's. The `"(type|role)"` alternation
# mirrors end-of-turn-reminder.sh:269 (CC writes an outer `type`; the ZCode synthetic
# producer writes only `message.role`) — carried here so the extractor is not narrower than
# the transcript shapes the repo already knows about.
body=""
body_kind="none"
if [ -n "$transcript" ] && [ -f "$transcript" ]; then
  assistant_texts=$(grep -E '"(type|role)":"assistant"' "$transcript" 2>/dev/null \
    | jq -r 'select(.isSidechain != true)
             | [ .message.content[]? | select(.type=="text") | .text ] | join("\n")' 2>/dev/null || true)
  # Slice from the LAST occurrence of the marker to the end of the assistant stream — not to
  # the end of that one turn. Deliberate: what a continuing session needs is «the last recap
  # PLUS everything the model said after it», and the turns following a recap are exactly the
  # work the recap does not yet cover.
  last_recap=$(printf '%s' "$assistant_texts" | awk -v m="$AIF_RECAP_MARKER" '
    index($0, m) { start = NR }
    { line[NR] = $0 }
    END { if (start) for (i = start; i <= NR; i++) print line[i] }' 2>/dev/null || true)
  # Caps are LINE-based, not byte-based: a `head -c` / `tail -c` cut lands mid-codepoint on
  # the emoji-bearing recap heading and mid-word everywhere else, so the residue's first or
  # last line arrives corrupted. Lines cost nothing extra and truncate where a reader expects.
  if [ -n "$last_recap" ]; then
    body=$(printf '%s' "$last_recap" | head -n 120)
    body_kind="recap"
  else
    # FALLBACK (D8: «the recap fires conditionally, so the fallback is the last main-thread
    # assistant text excerpt»). Not a degraded no-op: an excerpt of the final turn is what a
    # continuing session needs most, and it is always available when a transcript is.
    body=$(printf '%s' "$assistant_texts" | tail -n 60)
    [ -n "$body" ] && body_kind="excerpt"
  fi
fi

# ── Branch + head, for the continuing session ────────────────────────────────
branch=$(git -C "$root" rev-parse --abbrev-ref HEAD 2>/dev/null || true)
head_sha=$(git -C "$root" rev-parse --short HEAD 2>/dev/null || true)
[ -n "$branch" ] || branch="(not a git worktree)"

# ── Write ────────────────────────────────────────────────────────────────────
# Written even when there is NO transcript and no body: D8 requires anchor + timestamp +
# branch to be present unconditionally, because «a session existed here and was compacted»
# is itself the load-bearing fact for the reader. Redirect failures are swallowed (a
# read-only or full disk must not surface as a compaction error).
# shellcheck disable=SC2016  # backticks below are markdown code spans, not command substitution
{
  printf '# Session residue — %s\n\n' "$anchor"
  printf -- '- **Session:** `%s`\n' "$session_id"
  printf -- '- **Written:** %s (PreCompact, trigger=`%s`)\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$trigger"
  printf -- '- **Branch:** `%s` @ `%s`\n' "$branch" "${head_sha:-unknown}"
  printf -- '- **Repo:** `%s`\n' "$root"
  printf -- '- **Transcript:** `%s`\n' "${transcript:-(absent)}"
  printf -- '- **Body source:** %s\n\n' "$body_kind"
  if [ -n "$body" ]; then
    printf '## Last model-authored state (verbatim from the transcript)\n\n'
    printf '%s\n' "$body"
  else
    printf '## Last model-authored state\n\n(no assistant text recoverable from the transcript)\n'
  fi
} > "$residue_file" 2>/dev/null || true

exit 0
