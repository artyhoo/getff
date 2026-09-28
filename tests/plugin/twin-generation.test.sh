#!/usr/bin/env bash
# S6 acceptance — plugin twins match declared @plugin-transform output.
# spec: docs/meta-factory/zcode-parity-mega.decisions.md §Meta-fork B + §Fork 4 (2B-standardize)
#       .ai-factory/plans/zcode-parity-s6-twin-generator.md
#
# For each .claude/hooks/<name>.sh that has a plugin/hooks/<name> twin:
#   - manual marker → declared, hand-maintained; arm (2) checks the rationale, arm (5) checks
#                     semantic parity with the source (differential run / body / grammar)
#   - sed <expr>    → applying the sed expr to source (minus AUTO-GENERATED header on twin)
#                     produces byte-identical output to the twin
#   - no marker     → source matches twin modulo the twin's AUTO-GENERATED first line
#
# Catches drift / generator bugs / missing markers. Twins without a source (e.g. session-start)
# are skipped (the generator only iterates .claude/hooks/*.sh).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PLUGIN_DIR="$REPO_ROOT/plugin/hooks"
SRC_DIR="$REPO_ROOT/.claude/hooks"
PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); echo "  ✓ $1"; }
bad(){ FAIL=$((FAIL+1)); echo "  ✗ $1"; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# (1) generator runs cleanly
if bash "$REPO_ROOT/scripts/generate-plugin-twins.sh" >/dev/null 2>&1; then
  ok "generator exits 0"
else
  bad "generator non-zero exit"
fi

# (2) for each source, divergence must be declared
shopt -s nullglob
for src in "$SRC_DIR"/*.sh; do
  name=$(basename "$src" .sh)
  twin="$PLUGIN_DIR/$name"
  # Skip sources with no twin — those are intentionally not twinned (internal-only
  # or have other delivery arrangements). The generator also skips these.
  [ -f "$twin" ] || { ok "$name: no twin (intentionally not twinned)"; continue; }

  # Strip the shebang from source and the shebang + AUTO-GENERATED header from twin,
  # so the comparison is body-vs-body. The generator inserts the AUTO-GENERATED line
  # as line 2 of the twin (after the shebang).
  tail -n +2 "$src" > "$TMP/src.body"
  tail -n +3 "$twin" > "$TMP/twin.body"

  marker=$(grep -E '^# @plugin-transform:' "$src" | head -1 | sed 's/^# @plugin-transform: //' || true)

  case "$marker" in
    manual*)
      # Require a ≥20-char rationale on the same line.
      rationale=${marker#manual}
      if [ ${#rationale} -ge 20 ]; then
        ok "$name: manual (declared, hand-maintained)"
      else
        bad "$name: manual marker lacks ≥20-char rationale"
      fi
      ;;
    sed\ *)
      sed_expr=${marker#sed }
      # Apply same transform to source body (post-shebang), compare against twin body.
      bash -c "sed '$sed_expr' \"\$1\"" _ "$TMP/src.body" > "$TMP/src.transformed"
      if diff -q "$TMP/src.transformed" "$TMP/twin.body" >/dev/null; then
        ok "$name: sed transform matches declared output"
      else
        bad "$name: sed transform diverges from declared marker"
      fi
      ;;
    "")
      if diff -q "$TMP/src.body" "$TMP/twin.body" >/dev/null; then
        ok "$name: byte-identical (no marker needed)"
      else
        bad "$name: divergent without @plugin-transform marker — add marker or fix drift"
      fi
      ;;
    *)
      bad "$name: unknown marker format: $marker"
      ;;
  esac
done

# (3) agents population — deliberately NOT checked against the real tree here, and this
# absence is measured rather than lazy. Arm (1) above runs the generator on the REAL tree,
# and the generator now re-syncs agent twins, so an in-tree byte-identity arm placed after
# it can never fail: seeding drift into agents/review-sidecar.md and running this file
# reports "byte-identical" and silently repairs the tree (verified 2026-08-17). Such an arm
# would be decoration — the shape of a check with no failing input.
#
# Real-tree drift detection for this population lives where it can actually fail, in CI:
# packages/core/principles/24-plugin-manifest-integrity.test.ts (d). It caught a live drift
# in PR #1430. This file's job is the GENERATOR, exercised below against a sandbox tree.
# Do not "restore" an in-tree arm here without first moving it above arm (1).

# (4) generator contract, end-to-end in a sandbox: the agents arm re-syncs drift and never
# invents a twin. CLAUDE_PROJECT_DIR keeps the real tree untouched — and a sandbox (rather
# than a predicate-only negative) is what proves the population is actually wired in.
SANDBOX="$TMP/sandbox"
mkdir -p "$SANDBOX/.claude/hooks" "$SANDBOX/plugin/hooks" "$SANDBOX/agents" "$SANDBOX/plugin/agents"
printf -- '---\nname: drifted\n---\n\nSOURCE version\n' > "$SANDBOX/agents/drifted.md"
printf -- '---\nname: drifted\n---\n\nSTALE twin version\n' > "$SANDBOX/plugin/agents/drifted.md"
printf -- '---\nname: untwinned\n---\n\nno twin exists for me\n' > "$SANDBOX/agents/untwinned.md"

if CLAUDE_PROJECT_DIR="$SANDBOX" bash "$REPO_ROOT/scripts/generate-plugin-twins.sh" >/dev/null 2>&1; then
  if cmp -s "$SANDBOX/agents/drifted.md" "$SANDBOX/plugin/agents/drifted.md"; then
    ok "sandbox: drifted agent twin re-synced to byte-identical"
  else
    bad "sandbox: drifted agent twin NOT re-synced (agents arm is a no-op)"
  fi
  if [ -f "$SANDBOX/plugin/agents/untwinned.md" ]; then
    bad "sandbox: generator invented a twin for an intentionally-untwinned agent"
  else
    ok "sandbox: untwinned agent left alone (no twin invented)"
  fi
else
  bad "sandbox: generator failed on a minimal tree"
fi

# (5) hand-maintained twins — semantic parity against the CC source.
# Arm (2) accepts a `manual` marker on its rationale alone, and the generator skips manual twins
# (scripts/generate-plugin-twins.sh `manual*)` branch), so before this arm a manual twin could
# drift from its source with nothing noticing (T21 backward sweep, 2026-09-29: the
# inject-subagent-context twin cited a stale source line, and warn-subagent-report-zcode — a
# differently-named twin the generator never pairs — pointed at a grammar line that had moved
# 24 lines). Each manual twin is compared on what it must keep equal to its source:
#   * inject-output-language, inject-project-digest — the bodies differ by design (the twin's
#     inline _emit_ctx adapter), so they are run SIDE BY SIDE on the same inputs: on the CC path
#     stdout+exit must be byte-identical; on the ZCode path the twin's {additionalContext} must
#     carry exactly the source's CC text.
#   * inject-subagent-context — byte-identical body from `_is_zcode()` on (the validate-prompt
#     precedent, packages/core/hooks/validate-prompt.test.ts), plus identical code lines above it.
#   * warn-subagent-report-zcode — a different event model, so the REPORT grammar is compared
#     literally (cue regex, section regexes, missing-section labels, in order), and the twin's
#     header pointers into the source must land on those lines.
# The two remaining manual twins are gated elsewhere: inject-matching-rule by principle 24(e)
# (packages/core/principles/24-plugin-manifest-integrity.test.ts) and validate-prompt by
# validate-prompt.test.ts. Arm (5d) fails on any manual or cross-named twin in none of these
# lists, so a new hand-maintained twin cannot arrive ungated. Every check is proven to go RED
# on a mutated twin copy in arm (5e); the real tree is never written.
PARITY_DIFFERENTIAL="inject-output-language inject-project-digest"
PARITY_BODY="inject-subagent-context"
PARITY_ELSEWHERE="inject-matching-rule validate-prompt"
PARITY_CROSS="warn-subagent-report-zcode:warn-subagent-report"

# run_hook <file> <stdin> [VAR=value ...] — sets HOUT (stdout, trailing newlines kept) + HRC.
# `env -i` keeps the operator's own AIF_HOOK_LANG / ZCODE_PROJECT_DIR out of the comparison.
run_hook() {
  local f="$1" in="$2" raw; shift 2
  raw=$({ printf '%s' "$in" | env -i PATH="$PATH" HOME="$HOME" "$@" "$BASH" "$f" 2>/dev/null; printf 'rc=%s' "$?"; })
  HRC="${raw##*rc=}"; HOUT="${raw%rc=*}"
}
# zcode_ctx <json> — the {additionalContext} string, trailing newlines kept (empty if no JSON).
zcode_ctx() { local v; v=$(printf '%s' "$1" | jq -j '.additionalContext // empty' 2>/dev/null; printf x); printf '%s' "${v%x}"; }

# _diff_case <src> <twin> <label> <stdin> [VAR=value ...] — CC path identical, ZCode path carries
# the same text. Prints the first divergence and returns 1.
_diff_case() {
  local src="$1" twin="$2" label="$3" in="$4" s_out s_rc t_ctx; shift 4
  run_hook "$src" "$in" "$@"; s_out="$HOUT"; s_rc="$HRC"
  run_hook "$twin" "$in" "$@"
  if [ "$HOUT" != "$s_out" ] || [ "$HRC" != "$s_rc" ]; then
    echo "    CC path diverges [$label]: source rc=$s_rc «$s_out» vs twin rc=$HRC «$HOUT»"; return 1
  fi
  run_hook "$twin" "$in" ZCODE_PROJECT_DIR="$TMP/zcode-root" "$@"
  case "$in" in *'"SubagentStart"'*) t_ctx="$HOUT" ;;  # CC-shaped JSON on both harnesses by design
    *) if [ -z "$s_out" ]; then t_ctx="$HOUT"; else t_ctx="$(zcode_ctx "$HOUT")"$'\n'; fi ;; esac
  if [ "$t_ctx" != "$s_out" ] || [ "$HRC" != "$s_rc" ]; then
    echo "    ZCode path diverges [$label]: source «$s_out» vs twin additionalContext «$t_ctx» rc=$HRC"; return 1
  fi
}

parity_inject_output_language() {
  local lang rc=0
  for lang in unset en ru de; do
    if [ "$lang" = unset ]; then _diff_case "$1" "$2" "lang=unset" "" || rc=1
    else _diff_case "$1" "$2" "lang=$lang" "" AIF_HOOK_LANG="$lang" || rc=1; fi
  done
  return $rc
}

parity_inject_project_digest() {
  local root ev rc=0 d="$TMP/digest"
  mkdir -p "$d/full/.claude" "$d/empty/.claude" "$d/none"
  printf 'intro\n<!-- digest:start -->\nGoal: "quoted" \\ back\n  indented line\n<!-- digest:end -->\ntail\n' > "$d/full/.claude/session-bootstrap.md"
  printf '<!-- digest:start -->\n   \n<!-- digest:end -->\n' > "$d/empty/.claude/session-bootstrap.md"
  for root in full empty none; do
    for ev in UserPromptSubmit SubagentStart; do
      _diff_case "$1" "$2" "$root/$ev" "{\"hook_event_name\":\"$ev\"}" CLAUDE_PROJECT_DIR="$d/$root" || rc=1
    done
    _diff_case "$1" "$2" "$root/non-json" "not json" CLAUDE_PROJECT_DIR="$d/$root" || rc=1
  done
  return $rc
}

parity_inject_subagent_context() {
  # shellcheck disable=SC2016  # sed script, not a shell expansion
  local code_above='/^_is_zcode()/,$d; /^[[:space:]]*#/d; /^[[:space:]]*$/d'
  if ! diff <(sed -n '/^_is_zcode()/,$p' "$1") <(sed -n '/^_is_zcode()/,$p' "$2") >"$TMP/body.diff"; then
    echo "    body from _is_zcode() diverges:"; sed 's/^/      /' "$TMP/body.diff" | head -6; return 1
  fi
  grep -q '^_is_zcode()' "$1" || { echo "    source has no _is_zcode() anchor — comparison would be empty"; return 1; }
  if [ "$(sed "$code_above" "$1")" != "$(sed "$code_above" "$2")" ]; then
    echo "    code lines above _is_zcode() diverge"; return 1
  fi
}

# The REPORT grammar, in order: cue regex, then each section regex + the label it reports.
report_grammar() { grep -v '^[[:space:]]*#' "$1" | grep -oE "REPORT_CUE_RE='[^']*'|grep -qE '[^']*'|\+=\(\"[A-Za-z]+\"\)"; }

parity_warn_subagent_report() {
  local src="$1" twin="$2" g ptr cue s1 s2 s3 n
  g=$(report_grammar "$src")
  [ "$(printf '%s\n' "$g" | grep -c .)" -eq 7 ] || { echo "    source grammar not found (expected 7 items, got: $g)"; return 1; }
  [ "$g" = "$(report_grammar "$twin")" ] || { echo "    REPORT grammar diverges from source"; diff <(printf '%s\n' "$g") <(report_grammar "$twin") | sed 's/^/      /'; return 1; }
  ptr=$(grep -oE 'line [0-9]+: REPORT_CUE_RE, lines [0-9]+/[0-9]+/[0-9]+: section regexes' "$twin" | head -1)
  [ -n "$ptr" ] || { echo "    twin header lost its grammar pointer (line N: REPORT_CUE_RE, lines a/b/c: section regexes)"; return 1; }
  read -r cue s1 s2 s3 <<<"$(printf '%s' "$ptr" | grep -oE '[0-9]+' | tr '\n' ' ')"
  # Each pointer must land on the grammar item it names, in order: cue = item 1, sections =
  # items 2/4/6 (items 3/5/7 are the labels on the following lines).
  local i=1 n want
  for n in "$cue" "$s1" "$s2" "$s3"; do
    want=$(printf '%s\n' "$g" | sed -n "${i}p"); i=$((i == 1 ? 2 : i + 2))
    sed -n "${n}p" "$src" | grep -qF -- "$want" || { echo "    pointer to source :$n is stale — expected «$want», found «$(sed -n "${n}p" "$src")»"; return 1; }
  done
  # The «Mirrors …:A-B VERBATIM» range must span the whole grammar block.
  local range a b
  range=$(grep -oE 'warn-subagent-report\.sh:[0-9]+-[0-9]+ VERBATIM' "$twin" | head -1 | grep -oE '[0-9]+-[0-9]+')
  a=${range%-*}; b=${range#*-}
  { [ -n "$range" ] && [ "$a" -le "$cue" ] && [ "$b" -ge "$s3" ]; } || { echo "    «Mirrors …:$range VERBATIM» does not span the grammar block :$cue-$s3"; return 1; }
}

# check_twin <kind> <src> <twin> — dispatch to the right comparison.
check_twin() {
  case "$1" in
    inject-output-language) parity_inject_output_language "$2" "$3" ;;
    inject-project-digest) parity_inject_project_digest "$2" "$3" ;;
    inject-subagent-context) parity_inject_subagent_context "$2" "$3" ;;
    warn-subagent-report) parity_warn_subagent_report "$2" "$3" ;;
    *) echo "    no parity check for $1"; return 1 ;;
  esac
}

# unregistered_twins <src-dir> <twin-dir> — names of manual or cross-named twins in no list.
unregistered_twins() {
  local s nm t base pair known=" $PARITY_DIFFERENTIAL $PARITY_BODY $PARITY_ELSEWHERE "
  for pair in $PARITY_CROSS; do known="$known${pair#*:} "; done
  for s in "$1"/*.sh; do
    nm=$(basename "$s" .sh)
    if [ ! -f "$2/$nm" ] || ! grep -q '^# @plugin-transform: manual' "$s"; then continue; fi
    case "$known" in *" $nm "*) ;; *) echo "$nm" ;; esac
  done
  for t in "$2"/*; do
    # A twin names its source either in prose («twin of .claude/hooks/<x>.sh») or by a
    # `@dual-pair: <x>` anchor that happens to be a hook name; either form counts.
    base=$(grep -m1 -oE 'twin of \.claude/hooks/[A-Za-z0-9_-]+\.sh' "$t" 2>/dev/null | sed 's#.*/##; s#\.sh$##')
    if [ -z "$base" ]; then
      base=$(grep -m1 -oE '^# @dual-pair: [A-Za-z0-9_-]+' "$t" 2>/dev/null | sed 's/.*: //')
      [ -n "$base" ] && [ -f "$1/$base.sh" ] || base=""
    fi
    [ -n "$base" ] && [ "$base" != "$(basename "$t")" ] || continue
    case " $PARITY_CROSS " in *" $(basename "$t"):$base "*) ;; *) basename "$t" ;; esac
  done
}

# (5a-c) real tree: every registered twin holds parity with its source. PARITY_TWIN_DIR points
# this arm at another copy of plugin/hooks/ (e.g. `git show origin/staging:…` snapshots) to show
# what it would have said about an older tree; unset, it reads the live twins.
PARITY_TWIN_DIR="${PARITY_TWIN_DIR:-$PLUGIN_DIR}"
if ! command -v jq >/dev/null 2>&1; then
  bad "manual-twin parity needs jq (the ZCode branch of every twin is jq-gated)"
else
  for nm in $PARITY_DIFFERENTIAL $PARITY_BODY; do
    if out=$(check_twin "$nm" "$SRC_DIR/$nm.sh" "$PARITY_TWIN_DIR/$nm"); then ok "$nm: manual twin holds semantic parity with source"
    else bad "$nm: manual twin drifted from source"; echo "$out"; fi
  done
  for pair in $PARITY_CROSS; do
    t=${pair%%:*}; s=${pair#*:}
    if out=$(check_twin "$s" "$SRC_DIR/$s.sh" "$PARITY_TWIN_DIR/$t"); then ok "$t: cross-named twin holds grammar + pointer parity with $s.sh"
    else bad "$t: cross-named twin drifted from $s.sh"; echo "$out"; fi
  done

  # (5d) completeness: no hand-maintained twin outside the lists above.
  missing=$(unregistered_twins "$SRC_DIR" "$PLUGIN_DIR")
  if [ -z "$missing" ]; then ok "every manual / cross-named twin has a parity check"
  else bad "manual or cross-named twin(s) with no parity check — register in arm (5): $missing"; fi

  # (5e) paired negatives — each check must go RED on a mutated copy of its twin.
  M="$TMP/mutants"; mkdir -p "$M/src" "$M/tw"
  mutant_red() {  # <label> <kind> <src> <twin> <perl-substitution>
    cp "$4" "$M/twin"
    perl -0pi -e "$5" "$M/twin"
    if cmp -s "$4" "$M/twin"; then bad "negative [$1]: mutation did not apply — the negative proves nothing"
    elif check_twin "$2" "$3" "$M/twin" >/dev/null; then bad "negative [$1]: mutated twin still reported parity"
    else ok "negative [$1]: mutated twin goes RED"; fi
  }
  mutant_red "output-language ru text" inject-output-language "$SRC_DIR/inject-output-language.sh" "$PLUGIN_DIR/inject-output-language" 's/in Russian/in English/'
  # shellcheck disable=SC2016  # a perl substitution, not a shell expansion
  mutant_red "output-language ZCode shape" inject-output-language "$SRC_DIR/inject-output-language.sh" "$PLUGIN_DIR/inject-output-language" 's/\{additionalContext:\$c\}/{context:\$c}/'
  mutant_red "project-digest end marker" inject-project-digest "$SRC_DIR/inject-project-digest.sh" "$PLUGIN_DIR/inject-project-digest" 's/digest:end/digest:stop/g'
  mutant_red "project-digest SubagentStart event" inject-project-digest "$SRC_DIR/inject-project-digest.sh" "$PLUGIN_DIR/inject-project-digest" 's/hookEventName:"SubagentStart"/hookEventName:"SubagentStop"/'
  mutant_red "subagent-context stale citation" inject-subagent-context "$SRC_DIR/inject-subagent-context.sh" "$PLUGIN_DIR/inject-subagent-context" 's/inject-project-digest\.sh:31,39/inject-project-digest.sh:31,38/'
  mutant_red "subagent-context code above _is_zcode" inject-subagent-context "$SRC_DIR/inject-subagent-context.sh" "$PLUGIN_DIR/inject-subagent-context" 's/^set -uo pipefail$/set -u/m'
  mutant_red "warn-report section regex" warn-subagent-report "$SRC_DIR/warn-subagent-report.sh" "$PLUGIN_DIR/warn-subagent-report-zcode" "s/grep -qE '\\^Confidence:'/grep -qE '^Confidence'/"
  mutant_red "warn-report stale pointer" warn-subagent-report "$SRC_DIR/warn-subagent-report.sh" "$PLUGIN_DIR/warn-subagent-report-zcode" 's/line \d+: REPORT_CUE_RE/line 78: REPORT_CUE_RE/'
  # shellcheck disable=SC2016  # perl back-references, not shell expansions
  mutant_red "warn-report pointer onto the wrong regex" warn-subagent-report "$SRC_DIR/warn-subagent-report.sh" "$PLUGIN_DIR/warn-subagent-report-zcode" 's#lines (\d+)/(\d+)/(\d+): section#lines $2/$1/$3: section#'
  mutant_red "warn-report mirrored range" warn-subagent-report "$SRC_DIR/warn-subagent-report.sh" "$PLUGIN_DIR/warn-subagent-report-zcode" 's/warn-subagent-report\.sh:\d+-\d+ VERBATIM/warn-subagent-report.sh:74-97 VERBATIM/'

  printf '#!/usr/bin/env bash\n# @plugin-transform: manual — a brand-new hand-maintained twin nobody registered\n' > "$M/src/newhook.sh"
  printf '#!/usr/bin/env bash\necho twin\n' > "$M/tw/newhook"
  printf '#!/usr/bin/env bash\n# stray-zcode — ZCode twin of .claude/hooks/some-hook.sh\n' > "$M/tw/stray-zcode"
  printf '#!/usr/bin/env bash\n' > "$M/src/paired-hook.sh"
  printf '#!/usr/bin/env bash\n# @dual-pair: paired-hook\n' > "$M/tw/paired-hook-zcode"
  printf '#!/usr/bin/env bash\n# @dual-pair: some-i18n-anchor\n' > "$M/tw/anchor-only"
  missing=$(unregistered_twins "$M/src" "$M/tw" | tr '\n' ' ')
  if [ "$missing" = "newhook paired-hook-zcode stray-zcode " ]; then ok "negative [completeness]: unregistered manual, prose-named and @dual-pair-named twins are named"
  else bad "negative [completeness]: expected 'newhook paired-hook-zcode stray-zcode', got '$missing'"; fi
fi

echo "Pass: $PASS  Fail: $FAIL"
exit $((FAIL > 0))
