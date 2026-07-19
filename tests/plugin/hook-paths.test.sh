#!/usr/bin/env bash
# S2 acceptance — relocated plugin hooks are extensionless, marked, and env-var-correct.
# spec: docs/superpowers/specs/2026-06-22-cc-plugin-packaging-design.md §5 (path-translation)
#       docs/superpowers/plans/plugin-hook-triage.md (the per-hook triage)
#
# Asserts, for every relocated hook script under plugin/hooks/ (i.e. every file that is
# NOT run-hook.cmd, NOT *.json, NOT *.md, NOT a _zcode-* helper):
#   (a) extensionless filename            — dodges CC's Windows ".sh → prepend bash" quirk
#   (b) carries a delivery-channel marker — @dual-pair | @cc-only-rationale (dual-impl §6)
#   (c) no plugin-data path hardcodes "$CLAUDE_PROJECT_DIR/.claude/hooks/" (relocation bug)
#   (d) if it reads consumer rules (.claude/rules), it resolves them via CLAUDE_PROJECT_DIR
#   (e) if it sources siblings, it self-resolves its own dir
# Plus manifest sanity:
#   (f) plugin/hooks/hooks.json parses
#   (g) every command target named in hooks.json exists under plugin/hooks/
# Plus repo-root resolution sweep (plan-v3 §"Sibling-sweep T21 (final, corrected)"):
#   (h) every twin that reads repo files resolves the repo via CLAUDE_PROJECT_DIR (env-first
#       OR cd-guard form). Skips non-repo-reading twins (CAT-B sibling-source, no file reads).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
HOOKS_DIR="$REPO_ROOT/plugin/hooks"
PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); echo "  ✓ $1"; }
bad(){ FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# --- collect the relocated hook scripts -------------------------------------
shopt -s nullglob
scripts=()
for f in "$HOOKS_DIR"/*; do
  base=$(basename "$f")
  case "$base" in
    # run-hook.cmd = polyglot dispatcher (Windows+Unix); *.json/*.md = manifest/prose.
    # _zcode-* = SOURCED HELPERS (e.g. _zcode-emit, plan-v3 Mechanism 1), not delivery-channel
    # artifacts — neither @dual-pair nor @cc-only-rationale applies semantically. The gate's
    # purpose is delivery-channel discipline on HOOKS, not on internal infrastructure (T-ZP-C).
    run-hook.cmd|*.json|*.md|_zcode-*) continue ;;
  esac
  [ -f "$f" ] && scripts+=("$f")
done

if [ "${#scripts[@]}" -eq 0 ]; then
  bad "no relocated hook scripts found under plugin/hooks/ (S2 ships ≥1)"
fi

# Guard the iteration: bash 3.2 + `set -u` aborts on "${empty[@]}".
for f in ${scripts[@]+"${scripts[@]}"}; do
  base=$(basename "$f")

  # (a) extensionless
  case "$base" in
    *.*) bad "$base has an extension (must be extensionless)";;
    *)   ok  "$base is extensionless";;
  esac

  # (b) delivery-channel marker
  if grep -qE '^# @(dual-pair|cc-only-rationale):' "$f"; then
    ok "$base carries a delivery-channel marker"
  else
    bad "$base missing @dual-pair / @cc-only-rationale marker"
  fi

  # (c) no plugin-data path rooted at $CLAUDE_PROJECT_DIR/.claude/hooks/
  # Real relocation bug = an ACTIVE command-string `bash "$CLAUDE_PROJECT_DIR/.claude/hooks/X.sh"`
  # (the install-copy form, wrong under the plugin channel). A COMMENT showing the old form as
  # documentation (e.g. an example JSON command in a header) is NOT a bug — strip comment lines
  # before grepping so prose examples don't trip the check (T-PLUG-A spec item #6/#8/#10).
  if grep -vE '^[[:space:]]*#' "$f" | grep -qE 'CLAUDE_PROJECT_DIR[^[:space:]]*/\.claude/hooks/'; then
    bad "$base hardcodes \$CLAUDE_PROJECT_DIR/.claude/hooks/ in active code (relocation bug)"
  else
    ok "$base has no mis-rooted plugin-data path"
  fi

  # (d) reads consumer rules → must be ROOTED at CLAUDE_PROJECT_DIR, never at the plugin root.
  # Two arms so the check is not satisfied by a stray CLAUDE_PROJECT_DIR mention elsewhere:
  #   (d1) the var must appear at all; (d2) consumer rules must NOT be rooted at the plugin root
  #   (the T-PLUG-A *inverse* mis-rooting: `${CLAUDE_PLUGIN_ROOT}/…/.claude/rules`).
  # Trigger only on ACTIVE, genuine bash read-constructs targeting .claude/rules — not on
  # prose mentions inside heredocs, digest text, or MSG single-quoted strings (citation
  # strings, not reads: e.g. inject-session-bootstrap digest, inject-memory-codification MSG).
  # A genuine read has a bash read-construct immediately adjacent to a .claude/rules path:
  #   RULES_DIR=…/.claude/rules | for x in …/.claude/rules/*.md | cat …/.claude/rules…
  #   [ -f …/.claude/rules… ] | grep … .claude/rules | ls …/.claude/rules | <(… .claude/rules)
  has_rules_read=0
  if grep -vE '^[[:space:]]*#' "$f" | grep -qE '(RULES_DIR=|for[[:space:]]+[A-Za-z_]+[[:space:]]+in[[:space:]].*|cat[[:space:]]|[[:space:]]-f[[:space:]]|grep[[:space:]]|ls[[:space:]]|<\()[^#]*\.claude/rules'; then
    has_rules_read=1
  fi
  if [ "$has_rules_read" = "1" ]; then
    if ! grep -qE 'CLAUDE_PROJECT_DIR' "$f"; then
      bad "$base reads .claude/rules but never references CLAUDE_PROJECT_DIR (project-data misrooted)"
    elif grep -qE 'CLAUDE_PLUGIN_ROOT[^[:space:]]*/?\.claude/rules' "$f"; then
      bad "$base roots consumer .claude/rules at \${CLAUDE_PLUGIN_ROOT} (T-PLUG-A inverse — reads plugin's rules, not the consumer's)"
    else
      ok "$base roots consumer rules at CLAUDE_PROJECT_DIR (not the plugin root)"
    fi
  fi

  # (e) sources siblings → self-resolves its dir
  if grep -qE '^[[:space:]]*(\.|source)[[:space:]]' "$f"; then
    if grep -qE 'dirname "?\$\{?(BASH_SOURCE|0)' "$f"; then
      ok "$base self-resolves its dir before sourcing siblings"
    else
      bad "$base sources siblings without self-resolving its dir"
    fi
  fi
done

# (h) repo_root_resolution_form — T21 sibling-sweep (plan-v3 §"Sibling-sweep T21 (final, corrected)")
# Every twin that READS REPO FILES must resolve the repo via CLAUDE_PROJECT_DIR. Two valid forms:
#   Form A (env-first, 7 twins): (REPO_ROOT|PROJECT_DIR)="${CLAUDE_PROJECT_DIR:-<fallback>}"
#   Form B (cd-guard,    1 twin): [ -n "${CLAUDE_PROJECT_DIR:-}" ] && { cd "$CLAUDE_PROJECT_DIR" …
# The 8 in-sweep twins are enumerated by NAME below; the 6 non-sweep twins (no repo-file reads —
# CAT-B sibling-source via HOOK_DIR, or only an orchestration-mode marker-file prefix) are skipped
# by name so a future contributor adding a new repo-reading twin WITHOUT the guard is caught.
# Verified invariant across plugin/hooks/ at plan-v3 finalisation (8 in-sweep + 6 skip = 14 total).
in_sweep_twins=(
  check-doc-authority
  check-hook-marker
  check-kickoff-traps
  check-worker-dispatch-channel
  inject-matching-rule
  runtime-bridge-dispatch
  validate-prompt
  deps-hash-check
)
# Non-sweep twins (do NOT read repo files; documented for completeness so the enumeration stays honest):
#   ask-question-reminder, inject-memory-codification, inject-session-bootstrap (CAT-B sibling-source),
#   inject-subagent-context (CAT-B sibling-source), session-start, end-of-turn-reminder
#   (CLAUDE_PROJECT_DIR used only as orchestration-mode marker-file prefix at end-of-turn-reminder:85,
#    not a repo-file read).
for name in "${in_sweep_twins[@]}"; do
  f="$HOOKS_DIR/$name"
  if [ ! -f "$f" ]; then
    bad "(h) $name: in-sweep twin missing under plugin/hooks/ (list drift)"
    continue
  fi
  # Form A: env-first REPO_ROOT/PROJECT_DIR assignment. The fallback shape $(cd "$(dirname "$0")/.." && pwd)
  #         can have any depth (/../.. for .claude/hooks/, /.. for plugin/hooks/), so we anchor on the
  #         CLAUDE_PROJECT_DIR prefix only.
  # Form B: cd-guard that pins cwd to the consumer root when env is set.
  if grep -qE '(REPO_ROOT|PROJECT_DIR)="\$\{CLAUDE_PROJECT_DIR' "$f" \
  || grep -q '\[ -n "\${CLAUDE_PROJECT_DIR' "$f"; then
    ok "(h) $name resolves repo via CLAUDE_PROJECT_DIR (Form A env-first OR Form B cd-guard)"
  else
    bad "(h) $name reads repo files but lacks CLAUDE_PROJECT_DIR-first resolution (T16 regression)"
  fi
done

# (f)(g) hooks.json sanity
HJ="$HOOKS_DIR/hooks.json"
if [ -f "$HJ" ] && python3 -c "import json;json.load(open('$HJ'))" 2>/dev/null; then
  ok "hooks.json parses"
  # every "run-hook.cmd <name>" target must exist as a sibling
  targets=$(python3 -c "
import json,re
d=json.load(open('$HJ'))
seen=set()
def walk(o):
    if isinstance(o,dict):
        for v in o.values(): walk(v)
    elif isinstance(o,list):
        for v in o: walk(v)
    elif isinstance(o,str):
        m=re.search(r'run-hook\.cmd\"?\s+([A-Za-z0-9_-]+)', o)
        if m: seen.add(m.group(1))
walk(d)
print('\n'.join(sorted(seen)))
" 2>/dev/null)
  if [ -z "$targets" ]; then
    bad "hooks.json names no run-hook.cmd targets"
  else
    for t in $targets; do
      [ -f "$HOOKS_DIR/$t" ] && ok "hooks.json target '$t' exists" || bad "hooks.json target '$t' missing under plugin/hooks/"
    done
  fi
else
  bad "hooks.json missing or invalid JSON"
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
