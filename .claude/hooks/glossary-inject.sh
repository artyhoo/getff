#!/usr/bin/env bash
# glossary-inject.sh — UserPromptSubmit hook: glossary injection + usage counter (plain-words-recap-v2 D-F).
# spec: docs/superpowers/specs/2026-09-13-plain-words-recap-v2-design.md §D-F
#
# Scans the operator's prompt for the `_Operator says_` raw words of the CONTEXT.md
# glossary; for each match injects one line
#   "<raw word>" = <term>: <definition>
# (the operator→agent direction) and counts ONE usage per term per prompt. A synonym is
# NOT a usage, and the `**Term**` canonical names are deliberately NOT matched either:
# only the `_Operator says_` list is the curated match contract. Matching the English
# canonical names would false-positive on ordinary words (a term literally named Red) —
# the raw-word list is what the operator actually says (kickoff item 4's «the term itself»
# for the Russian seeds IS the raw word; harvest/egress/handoff are listed as raw words,
# each with its Cyrillic transliteration, so both spellings count as a usage of the one
# term — kickoff item 4 counts the transliteration). The Stop-side twin (the glossary arm inside
# end-of-turn-reminder.sh) reads the per-session pending file this hook writes and counts
# the agent→operator direction (the fixed «term (explanation)» form). BOTH sides derive
# the counters file as `_residue_dir()/_glossary-counts.json` — a path split between the
# two hooks is the kickoff's item-4 falsifier («the hook is registered and a session still
# never sees an injected line»).
#
# Learned (usages ≥ AIF_GLOSSARY_USES OR explanations ≥ AIF_GLOSSARY_EXPLAINS) silences
# this side too: above threshold nothing fires (D-F). To re-teach a term, delete
# `_glossary-counts.json` in the residue dir.
#
# @cc-only-rationale: UserPromptSubmit injection — CC auto-injects plain stdout; ZCode needs
#   strict-JSON {additionalContext}, so _emit_ctx branches on ZCODE_PROJECT_DIR (the
#   inject-session-bootstrap.sh shape; the inline branch IS the portability, no separate
#   portable counterpart artefact). Registration is deliberately NOT automatic: a
#   UserPromptSubmit hook needs a settings entry an agent may not write — the OPERATOR runs
#   scripts/register-glossary-hook.sh. Unregistered == dormant, and from inside the repo a
#   dormant hook is indistinguishable from a working one (the WorktreeCreate shape) — that
#   hand-action is the delivery, not a nicety.
set -euo pipefail

# Consumer-skip guards (the end-of-turn-reminder.sh shape): no jq → no prompt to parse →
# silent exit 0, never error-spam a consumer's every prompt.
command -v jq >/dev/null 2>&1 || exit 0

REPO_ROOT="${CLAUDE_PROJECT_DIR:-${ZCODE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}}"
# NB: env-first resolution — under the plugin twin $0 points into the plugin dir, so
# $0-relative fallback is the LAST resort, not the primary (issue 1484 root cause).
[ -f "$REPO_ROOT/CONTEXT.md" ] || exit 0   # unarmed tree: inert, nothing injected, exit 0

input=$(cat)
prompt="$(printf '%s' "$input" | jq -r '.prompt // empty' 2>/dev/null || true)"
[ -n "$prompt" ] || exit 0

# Harness-portable output (inlined — this hook is copied standalone to test sandboxes, no
# lib/ sibling to rely on). CC: plain stdout auto-injected. ZCode: JSON additionalContext.
_is_zcode() { [ -n "${ZCODE_PROJECT_DIR:-}" ]; }
_emit_ctx() { if _is_zcode && command -v jq >/dev/null 2>&1; then
    jq -n --arg c "$2" '{additionalContext:$c}'
  else printf '%s' "$2"; case "$2" in *$'\n') : ;; *) printf '\n' ;; esac; fi; }

# Glossary thresholds — single source = the lang packs (the very keys the
# ^AIF_GLOSSARY_[A-Z_]+= probe in lang/check-parity.sh keeps in both packs, same commit).
# Env override wins (fork ruling 3): captured BEFORE the pack source, restored after — the
# pack assignment is the DEFAULT. No pack found (a consumer tree without lang/) → literal
# defaults below, kept identical to the pack values.
_g_env_uses="${AIF_GLOSSARY_USES:-}"
_g_env_explains="${AIF_GLOSSARY_EXPLAINS:-}"
_g_env_wclass="${AIF_GLOSSARY_WORD_CLASS:-}"
_lang_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lang"
_lang_file="${_lang_dir}/${AIF_HOOK_LANG:-en}.sh"
if [ -f "$_lang_file" ]; then
  # shellcheck source=/dev/null
  . "$_lang_file" 2>/dev/null || true
fi
if [ -n "$_g_env_uses" ]; then AIF_GLOSSARY_USES="$_g_env_uses"; fi
if [ -n "$_g_env_explains" ]; then AIF_GLOSSARY_EXPLAINS="$_g_env_explains"; fi
if [ -n "$_g_env_wclass" ]; then AIF_GLOSSARY_WORD_CLASS="$_g_env_wclass"; fi
unset _g_env_uses _g_env_explains _g_env_wclass

# Residue-directory primitives — GUARDED source, never unconditional (the residue-dir.sh
# LOADING CONTRACT, D29): this hook runs under `set -euo pipefail`, and sourcing a missing
# lib would abort it on EVERY prompt. Same inline fallback shape as the Stop hook's, so
# both sides resolve the SAME counters path. `root` is pinned env-first (CLAUDE_PROJECT_DIR
# → ZCODE_PROJECT_DIR) because the lib honours a pre-set `root` and a ZCode plugin run has
# no CLAUDE_PROJECT_DIR — without the pin the counters would split per harness.
root="${CLAUDE_PROJECT_DIR:-${ZCODE_PROJECT_DIR:-$REPO_ROOT}}"
_residue_lib="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/residue-dir.sh"
if ! [ -f "$_residue_lib" ] || ! . "$_residue_lib" 2>/dev/null; then
  _residue_dir() {
    if [ -n "${AIF_RESIDUE_DIR:-}" ]; then printf '%s\n' "$AIF_RESIDUE_DIR"; return; fi
    local _rd_root="${root:-${CLAUDE_PROJECT_DIR:-$(pwd)}}"
    local _rd_helper="$_rd_root/.claude/skills/pipeline/helpers/print-orch-home.sh" _rd_out=""
    if [ -f "$_rd_helper" ]; then
      _rd_out=$(REPO_ROOT="$_rd_root" bash "$_rd_helper" 2>/dev/null || true)
      if [ -n "$_rd_out" ]; then printf '%s\n' "$_rd_out"; return; fi
    fi
    if [ -d "$_rd_root/.claude/orchestrator-prompts" ]; then
      printf '%s\n' "$_rd_root/.claude/orchestrator-prompts"
    else
      printf '%s\n' "$_rd_root/.ai-factory/orchestrator-prompts"
    fi
  }
fi

# ── Parse CONTEXT.md into term/word/definition records ───────────────────────
# One awk pass. Emits tab-separated records:  T<TAB>term<TAB>definition  and
# W<TAB>term<TAB>raw-word. The definition is the `**Term**:` paragraph (joined to one
# line); the raw words come from the `_Operator says_:` line, «»-quotes stripped. The
# authority blockquote at the top of CONTEXT.md is skipped by construction: it never
# starts a line with `## `, `**`, or `_Operator says_:`, and `term` is empty until the
# first H2.
_pairs="$(awk '
  function emit_term() {
    if (term == "" || def == "") return
    gsub(/\t/, " ", def)
    if (says != "") {
      gsub(/\.$/, "", says)
      # NB: TWO LITERAL gsubs, never a [guillemets] bracket — under a byte locale
      # (LC_CTYPE=POSIX, the container default) a bracket expression matches the individual
      # BYTES 0xC2/0xAB/0xBB, and 0xBB is also the trailing byte of U+043B (Cyrillic el,
      # UTF-8 0xD0 0xBB), so the bracket destroys every raw word carrying that letter: it
      # eats the 0xBB, orphaning the 0xD0 lead byte, and the seed term stops matching its
      # own prompt. Measured 2026-09-14; the literal-sequence form is byte-exact in both
      # byte and UTF-8 locales. NB2: no apostrophes in awk comments inside a single-quoted
      # program — one closes the program early (measured same day).
      gsub(/«/, "", says)
      gsub(/»/, "", says)
      n = split(says, w, ",")
      for (i = 1; i <= n; i++) {
        gsub(/^[ \t]+|[ \t]+$/, "", w[i])
        if (w[i] != "") print "W\t" term "\t" w[i]
      }
    }
    print "T\t" term "\t" def
  }
  /^## /              { emit_term(); term = substr($0, 4); def = ""; says = ""; inde = 0; next }
  inde && /^$/        { inde = 0; next }
  inde                { def = def " " $0; next }
  /^\*\*[^*]+\*\*:/   { if (term != "") { def = $0; sub(/^\*\*[^*]+\*\*:[ ]?/, "", def); inde = 1 } next }
  /^_Operator says_:/ { if (term != "") { says = $0; sub(/^_Operator says_:[ ]?/, "", says) } next }
  END                 { emit_term() }
' "$REPO_ROOT/CONTEXT.md")"

# Word-boundary regex. The character class is CATEGORY-3 MATCH DATA and lives in the lang
# packs (AIF_GLOSSARY_WORD_CLASS, both packs, guarded by the same ^AIF_GLOSSARY_[A-Z_]+=
# parity probe) — NOT inline: Surface 1 of principle 22 gates this file to no Cyrillic
# outside the packs, and the pack home is the language-discipline.md §5 counter to
# #match-data-translated-away. Locale-free bracket bounds, so a match cannot leak into a
# neighbouring word that merely shares the raw word's letters. -i covers the Capitalized
# sentence-start case; folding follows the ambient UTF-8 locale, the same dependence every
# other Cyrillic match pattern in this repo has. A raw word carrying a regex metacharacter
# would need escaping — the seed words do not, and the `_Operator says_` data is the
# contract for what may appear there. Pack absent → empty class → Latin-only bounds:
# degraded boundary precision, never a crash (the pack ships with the hook).
_words_re() {
  local _wc="${AIF_GLOSSARY_WORD_CLASS:-}"
  printf '(^|[^A-Za-z%s0-9])%s([^A-Za-z%s0-9]|$)' "$_wc" "$1" "$_wc"
}

session_id="$(printf '%s' "$input" | jq -r '.session_id // "nosession"' 2>/dev/null || echo "nosession")"
counts_file="$(_residue_dir)/_glossary-counts.json"
pending_file="${TMPDIR:-/tmp}/aif-glossary-pending-$(printf '%s' "$session_id" | tr -c 'A-Za-z0-9._-' '_' | cut -c1-96)"
gl_uses_thr="${AIF_GLOSSARY_USES:-3}"
case "$gl_uses_thr" in '' | *[!0-9]* | 0) gl_uses_thr=3 ;; esac
gl_explains_thr="${AIF_GLOSSARY_EXPLAINS:-5}"
case "$gl_explains_thr" in '' | *[!0-9]* | 0) gl_explains_thr=5 ;; esac

# ── Counters lock (plain-words-recap-v2 S3, cold review 2026-09-21) ──────────
# The counters file is machine-shared BY DESIGN (kickoff-s3.md §1 item 4), and the
# increment below is a read-modify-write: two sessions that read the same value both
# write value+1 and one usage is lost. Measured before this block existed: 10 concurrent
# prompts carrying one term → `usages: 2`; the same 10 run one at a time → `usages: 10`.
# With 4+ worktree sessions the norm here, `usages >= AIF_GLOSSARY_USES` was effectively
# unreachable, so the «stop explaining after N times» throttle — the whole BUILD rationale
# of prior-art row #283 — never engaged.
#
# `mkdir` is the portable atomic test-and-set (flock(1) is absent on macOS). Best-effort by
# construction, exactly like every other counters write here: a lock we cannot take within
# the bound is skipped, never fatal — a hook that blocks a turn over a learning counter is
# worse than an undercount. Bound: 100 × 20 ms = 2 s. A lock dir older than a minute is a
# crashed holder and is reclaimed, so one killed session cannot wedge the counter forever.
_gl_lock() {
  _gl_lockdir="${1}.lock"
  _gl_held=""
  _gl_i=0
  while ! mkdir "$_gl_lockdir" 2>/dev/null; do
    if [ -n "$(find "$_gl_lockdir" -maxdepth 0 -mmin +1 2>/dev/null)" ]; then
      rmdir "$_gl_lockdir" 2>/dev/null || true
      continue
    fi
    _gl_i=$((_gl_i + 1))
    [ "$_gl_i" -ge 100 ] && return 1
    sleep 0.02 2>/dev/null || true
  done
  _gl_held=1
  return 0
}
_gl_unlock() {
  [ -n "${_gl_held:-}" ] || return 0
  rmdir "$_gl_lockdir" 2>/dev/null || true
  _gl_held=""
}

# Best-effort state: a counters write that fails (read-only residue, no dir) must never
# kill the hook or leak to stdout — the injection below still happens.
[ -f "$counts_file" ] || { printf '{"terms":{}}' > "$counts_file" 2>/dev/null || true; }
: > "$pending_file" 2>/dev/null || true
gl_tmp="${counts_file}.tmp-$$"
out=""
_done=""
while IFS=$'\t' read -r rec term word; do
  [ "$rec" = "W" ] || continue
  [ -n "${term:-}" ] && [ -n "${word:-}" ] || continue
  case "${_done}" in *"${term}"$'\n'*) continue ;; esac
  grep -qEi -- "$(_words_re "$word")" <<<"$prompt" || continue
  _done="${_done}${term}"$'\n'
  # Read AND write inside one lock hold — the read is what the increment is derived from,
  # so a lock taken only around the write would leave the same lost-update window.
  _gl_lock "$counts_file" || true
  gl_u="$(jq -r --arg t "$term" '(.terms[$t].usages // 0)' "$counts_file" 2>/dev/null || echo 0)"
  gl_e="$(jq -r --arg t "$term" '(.terms[$t].explanations // 0)' "$counts_file" 2>/dev/null || echo 0)"
  case "$gl_u" in '' | *[!0-9]*) gl_u=0 ;; esac
  case "$gl_e" in '' | *[!0-9]*) gl_e=0 ;; esac
  if [ "$gl_u" -ge "$gl_uses_thr" ] || [ "$gl_e" -ge "$gl_explains_thr" ]; then
    _gl_unlock
    continue  # learned — above threshold nothing fires (D-F): no line, no pending entry
  fi
  gl_u=$((gl_u + 1))
  if jq --arg t "$term" --argjson u "$gl_u" '.terms[$t].usages = $u' \
       "$counts_file" > "$gl_tmp" 2>/dev/null; then
    mv -f "$gl_tmp" "$counts_file" 2>/dev/null || rm -f "$gl_tmp" 2>/dev/null || true
  fi
  _gl_unlock
  def="$(printf '%s\n' "$_pairs" | awk -F'\t' -v t="$term" '$1 == "T" && $2 == t { print $3; exit }')"
  [ -n "$def" ] || def="$term"
  out="${out}\"${word}\" = ${term}: ${def}"$'\n'
  printf '%s\t%s\n' "$term" "$word" >> "$pending_file" 2>/dev/null || true
done <<EOF
$_pairs
EOF
rm -f "$gl_tmp" 2>/dev/null || true

if [ -n "$out" ]; then
  _emit_ctx "UserPromptSubmit" "$out"
fi
exit 0
