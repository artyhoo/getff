#!/usr/bin/env bash
# ci-runs-every-recorded-check.test.sh — P2 (advisor rework, item 3): every check the install records
# has a step in the CI workflow getff delivers, and that step goes through scripts/run-armed.sh.
# The record (.ai-factory/tool-decisions.md, aif:project-checks) lists each check armed or not-armed;
# a not-armed one arms itself later, so every entry — not only today's armed set — needs its CI step.
# Before this test react-spa's workflow ran no check-rule-globs / check-arch-boundaries /
# check-lintstaged step while its record armed them: the install said «CI runs it», CI did not.
#   (1) per stack (ts-server react-next react-spa react-native): a real install (no dependencies),
#       every recorded command has `run-armed.sh <command>` or `run-armed.sh --if-armed '<command>'`
#       in .github/workflows/ci.yml
#   (2) paired negative: the same predicate on a copy of one workflow with one step deleted names it
#   (3) the reverse: every run-armed caller getff delivers (ci.yml, .lintstagedrc.json) names a command
#       the record lists. run-armed.sh skips a check only on an exact-string match under not-armed and
#       runs any other string, so a caller one character off the record would run a not-armed check.
#   (4) paired negative: a one-character mistype in a copy of the workflow is named
# EXEMPT (the reason is printed): a check that has no meaning on, or no tool on, a CI runner.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
TMPS=()
cleanup() { [ "${#TMPS[@]}" -gt 0 ] && rm -rf "${TMPS[@]}"; }
trap cleanup EXIT
EXEMPT=('bash scripts/check-shields-up.sh' 'bash scripts/check-doc-links.sh')
EXEMPT_WHY=("check-shields-up proves this clone's git hooks are wired; a CI runner runs no git hook"
  "check-doc-links needs lychee, which a CI runner does not have: it exits 3 there, so a step would turn an armed check red on every run")
exempt() { local e; for e in "${EXEMPT[@]}"; do [ "$1" = "$e" ] && return 0; done; return 1; }

# missing_steps <record file> <workflow> → the recorded commands with no run-armed step, one per line
missing_steps() {
  local c
  awk '/aif:project-checks:end/{f=0} f; /aif:project-checks:begin/{f=1}' "$1" | sed -n 's/^- //p' | sed 's/ # .*$//' \
    | while IFS= read -r c; do
        exempt "$c" && continue
        grep -qF -- "run-armed.sh $c" "$2" || grep -qF -- "run-armed.sh --if-armed '$c'" "$2" || echo "$c"
      done
}

# off_record <record file> <caller file…> → run-armed callers whose command the record does not list
off_record() {
  local rec="$1" c; shift
  grep -hoE "run-armed\.sh (--if-armed '[^']*'|[^\"]*)" "$@" 2>/dev/null \
    | sed -E "s/^run-armed\.sh --if-armed '([^']*)'$/\1/; s/^run-armed\.sh //; s/[[:space:]]+$//" \
    | while IFS= read -r c; do
        case "$c" in validate|--*) continue ;; esac
        cmds=$(awk '/aif:project-checks:end/{f=0} f; /aif:project-checks:begin/{f=1}' "$rec" | sed -n 's/^- //p' | sed 's/ # .*$//')
        grep -qxF -- "$c" <<<"$cmds" || echo "$c"
      done
}

for i in "${!EXEMPT[@]}"; do echo "▶ exempt: ${EXEMPT[$i]} — ${EXEMPT_WHY[$i]}"; done
for st in ts-server react-next react-spa react-native; do
  d=$(mktemp -d); TMPS+=("$d")
  if ! ( cd "$d" && git init -q && printf '{"name":"x","version":"0.0.0"}\n' > package.json \
      && bash "$REPO_ROOT/install.sh" "$st" --force < /dev/null > "$d/.install.log" 2>&1 ); then
    bad "(0) $st: install.sh exited non-zero (tail: $(tail -3 "$d/.install.log" | tr '\n' '|'))"
    continue
  fi
  rec="$d/.ai-factory/tool-decisions.md" wf="$d/.github/workflows/ci.yml"
  n=$(awk '/aif:project-checks:end/{f=0} f; /aif:project-checks:begin/{f=1}' "$rec" 2>/dev/null | grep -c '^- ')
  if [ ! -f "$wf" ] || [ "${n:-0}" -lt 5 ]; then
    bad "(1) $st: no workflow or a record of ${n:-0} checks — the install did not run (tail: $(tail -3 "$d/.install.log" | tr '\n' '|'))"
    continue
  fi
  miss=$(missing_steps "$rec" "$wf")
  [ -z "$miss" ] && ok "(1) $st: all $n recorded checks have a run-armed CI step" \
    || bad "(1) $st: recorded but never run in CI: $(tr '\n' ';' <<<"$miss")"
  off=$(off_record "$rec" "$wf" "$d/.lintstagedrc.json")
  [ -z "$off" ] && ok "(3) $st: every run-armed caller in ci.yml and .lintstagedrc.json is a recorded command" \
    || bad "(3) $st: a caller the record does not list (runs even when not armed): $(tr '\n' ';' <<<"$off")"
  [ "$st" = react-spa ] && SPA="$d"
done

# (2) the predicate is not vacuous: delete one step from a copy and it is named
if [ -n "${SPA:-}" ]; then
  grep -v 'run-armed.sh bash scripts/check-lintstaged-resolves.sh' "$SPA/.github/workflows/ci.yml" > "$SPA/ci-minus.yml"
  grep -qx 'bash scripts/check-lintstaged-resolves.sh' <<<"$(missing_steps "$SPA/.ai-factory/tool-decisions.md" "$SPA/ci-minus.yml")" \
    && ok "(2) paired negative: a deleted step is named" || bad "(2) a deleted step went unnoticed (vacuous predicate)"
  sed 's/run-armed.sh npm run typecheck/run-armed.sh npm run typecheck:x/' "$SPA/.github/workflows/ci.yml" > "$SPA/ci-typo.yml"
  grep -qx 'npm run typecheck:x' <<<"$(off_record "$SPA/.ai-factory/tool-decisions.md" "$SPA/ci-typo.yml")" \
    && ok "(4) paired negative: a mistyped caller is named" || bad "(4) a mistyped caller went unnoticed (vacuous predicate)"
else
  bad "(2)(4) no react-spa install to run the negatives on"
fi

# ── python lane (one-button W2): the same both-direction gate, python surfaces ──
# Differences from the npm lanes: the workflow is the NAMESPACED getff-python.yml (never ci.yml —
# the python lane never clobbers the consumer's own), the record floor is 3 (ast-grep scan /
# ruff check . / ruff check . --config .getff/ruff-bans.toml --no-cache — the two ruff runs are
# TWO record lines, T-OBW2P-A: a green bans run must not arm a red discovered-config run), and
# there is no .lintstagedrc.json on the python lane. The tools need not be installed here: a
# structurally not-armed line (tool absent) is still a record line its CI step must exist for.
pd=$(mktemp -d); TMPS+=("$pd")
if ! ( cd "$pd" && git init -q && bash "$REPO_ROOT/install.sh" python < /dev/null > "$pd/.install.log" 2>&1 ); then
  bad "(py0) python: install.sh exited non-zero (tail: $(tail -3 "$pd/.install.log" | tr '\n' '|'))"
else
  prec="$pd/.ai-factory/tool-decisions.md" pwf="$pd/.github/workflows/getff-python.yml"
  pn=$(awk '/aif:project-checks:end/{f=0} f; /aif:project-checks:begin/{f=1}' "$prec" 2>/dev/null | grep -c '^- ')
  if [ ! -f "$pwf" ] || [ "${pn:-0}" -lt 3 ]; then
    bad "(py1) python: no getff-python.yml or a record of ${pn:-0} checks — the install did not run (tail: $(tail -3 "$pd/.install.log" | tr '\n' '|'))"
  else
    pmiss=$(missing_steps "$prec" "$pwf")
    [ -z "$pmiss" ] && ok "(py1) python: all $pn recorded checks have a run-armed step in getff-python.yml" \
      || bad "(py1) python: recorded but never run in CI: $(tr '\n' ';' <<<"$pmiss")"
    poff=$(off_record "$prec" "$pwf")
    [ -z "$poff" ] && ok "(py3) python: every run-armed caller in getff-python.yml is a recorded command" \
      || bad "(py3) python: a caller the record does not list (runs even when not armed): $(tr '\n' ';' <<<"$poff")"
    # (2p)(4p) the python predicates are not vacuous either
    grep -v 'run-armed.sh ast-grep scan' "$pwf" > "$pd/wf-minus.yml"
    grep -qx 'ast-grep scan' <<<"$(missing_steps "$prec" "$pd/wf-minus.yml")" \
      && ok "(py2) paired negative: a deleted step is named" || bad "(py2) a deleted step went unnoticed (vacuous predicate)"
    sed 's#run-armed\.sh ruff check \.#run-armed.sh ruff check .x#' "$pwf" > "$pd/wf-typo.yml"
    grep -q 'ruff check .x' <<<"$(off_record "$prec" "$pd/wf-typo.yml")" \
      && ok "(py4) paired negative: a mistyped caller is named" || bad "(py4) a mistyped caller went unnoticed (vacuous predicate)"
  fi
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
