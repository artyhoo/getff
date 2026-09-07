#!/usr/bin/env bash
# run-local-ci-sweep-coverage.test.sh — every atomic CI command must be reachable from the sweep.
#
# `scripts/run-local-ci-sweep.sh` exists so a green local run predicts a green CI. Nothing enforced
# that its gate table still mirrors `.github/workflows/audit-self.yml`: two hand-maintained lists,
# nobody reconciling them. PR #1355 closed three concrete holes; it did not close the class. Proof
# the class is live — during #1355 a hand-listed row naming four `scripts/*.test.sh` files was
# already one short (`scripts/host-verify-coverage.test.sh`, wired to CI in #1339) before it merged,
# and by the time THIS test was written a third consumer-matrix cell
# (`consumer-matrix-npm-tarball-cell`, audit-self.yml:1607) had shipped without reaching the sweep's
# own UNREACHABLE list. A gate whose failure mode is "nobody re-read the workflow" is bare attention,
# not a mechanism (.claude/rules/attention-is-not-a-mechanism.md §1).
#
# This is the reverse direction of tests/install-sh/meta-all-wired.test.sh (every test file is wired
# in CI); that file is the shape this one copies, including its load-bearing non-vacuity leg.
#
# ── CEILING — what this test does NOT cover ────────────────────────────────────────────────────
# The single-line layer only. Multi-line `run: |` and folded `run: >-` blocks (41 + 1 at time of
# writing, incl. every `framework-self-*` snapshot job and the zizmor step) keep their gate logic
# inline in the workflow YAML; there is no artifact to name, so they are mechanically uncomparable
# by construction and stay invisible here until that logic is extracted into committed scripts.
# Extraction is the real fix (.claude/rules/dual-implementation-discipline.md — a transcribed second
# copy would drift from the workflow it claims to predict); this test does not attempt it and must
# not be read as claiming CI-wide coverage.
#
# The sibling defect — jobs defined in audit-self.yml but absent from `ci-success.needs` — is NOT
# covered here and does not need to be: `packages/core/principles/36-ci-needs-completeness.test.ts`
# closed it in #1362. Two directions, two gates, no overlap.
#
# ── MATCHING: significant tokens, per row (the deliberate design choice) ───────────────────────
# Three options were on the table:
#
#   full-string `grep -F`   — works on today's text, false-REDs on any cosmetic reword (flag order,
#                             `--prefix` placement, quoting). A gate that reds for cosmetic reasons
#                             is a gate that earns getting muted, and a muted gate is worse than none.
#   anchor only (script /   — survives rewording, but false-GREENS on mode flags. In this repo that
#   npm-script name)          is not hypothetical: `--check` vs `--capture`, `SNAPSHOT_MODE=compare`
#                             vs `capture`, is exactly the difference between a real gate and a
#                             self-overwriting no-op that always passes.
#   significant tokens      — CHOSEN. Compares what identifies and parameterises the gate, ignores
#                             how it was spelled.
#
# A token is SIGNIFICANT when it is: an artifact path (contains `/`, ends `.sh`/`.ts`/`.mjs`); a
# `--flag`; a leading `VAR=value` env assignment; or the operand after `run` / after a bare `--`
# (i.e. the npm-script name or test target). INSIGNIFICANT: the interpreter (`bash`/`npm`/`npx`/
# `tsx`), flag values, token order, quoting, bare positional args.
#
# Matching is per ROW — all of a command's significant tokens must appear in ONE gate-table row,
# never in the concatenated table. Against the whole table, `--check` present anywhere would satisfy
# every command that carries `--check`, which is a false green by construction.
#
# Deterministic, no network: grep over the workflow + `run-local-ci-sweep.sh --list-gates`.
#
# Test seam (mirrors run-local-ci-sweep.sh's own SWEEP_GATES_FILE / SWEEP_DIFF_OVERRIDE, never used
# in a real run): SWEEP_COVERAGE_WF points the workflow side at a COPY, so the RED direction can be
# demonstrated from outside without touching the tracked file. The gate-table side already has the
# sweep's SWEEP_GATES_FILE for the same purpose. Arms 6 and 7 below exercise both directions
# in-process on every run regardless — the seam is for reproducing the proof by hand.
set -uo pipefail
# Tokenisation below relies on unquoted `for tok in $cmd` for word splitting. Without noglob a CI
# command carrying a `*` (`bash tests/foo/*.test.sh`) would expand against the CURRENT directory
# and be compared as whatever happens to be on disk. `case` patterns are unaffected by -f, and
# nothing here wants filename expansion.
set -f
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
WF="${SWEEP_COVERAGE_WF:-$REPO_ROOT/.github/workflows/audit-self.yml}"
SWEEP="$REPO_ROOT/scripts/run-local-ci-sweep.sh"
TAB="$(printf '\t')"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

[ -f "$WF" ]    || { echo "FATAL: $WF not found"; exit 1; }
[ -f "$SWEEP" ] || { echo "FATAL: $SWEEP not found"; exit 1; }

# ── Battery collapse ───────────────────────────────────────────────────────────────────────────
# Four families are each covered by ONE sweep row that loops or derives, so listing their ~180
# individual CI steps would compare a loop against its own elements. They are removed from the
# comparison population here and re-asserted positively below — an exclusion nobody checks is a
# hole, so each family must still prove it has a sweep row.
BATTERY_RE='tests/install-sh/|tests/hooks/|tests/dispatcher/|tests/plugin/|tests/aif-doctor/|scripts/[a-zA-Z0-9._-]+\.test\.sh'
# `npm ci` / `npm install` are dependency setup for the job, not gates — nothing for the sweep to
# mirror, and no covering row to assert. Excluded separately from the battery families so the two
# reasons for exclusion never get conflated.
SETUP_RE='^npm (ci|install)( |$)'
# family label <TAB> the substring its covering sweep row must contain (never a glob — `for x in
# $list` would expand `scripts/*.test.sh` against the real directory and compare nonsense).
battery_families() {
  printf '%s\n' \
    "tests/install-sh/*.test.sh${TAB}tests/install-sh/" \
    "tests/hooks/*.test.sh${TAB}tests/hooks/" \
    "tests/dispatcher/*.test.sh${TAB}tests/dispatcher/" \
    "scripts/*.test.sh${TAB}audit-self.yml" \
    "tests/plugin/*.test.sh${TAB}audit-self.yml" \
    "tests/aif-doctor/*.test.sh${TAB}audit-self.yml"
}

# ── UNREACHABLE allowlist: artifact path <TAB> rationale (≥20 chars) ───────────────────────────
# Keyed on the invoked artifact, not the full command: the reason each is unreachable is a property
# of the artifact (needs the network, a clean checkout, or the real PR range), so a second
# invocation of the same artifact carries the same rationale. Every entry must still be present in
# the workflow — a stale entry silently widens the exemption, so hygiene is asserted below.
unreachable_allowlist() {
  printf '%s\n' \
    "packages/core/audit-self/md-line-gate.sh${TAB}CI-only \`mechanical\` job: whole-tree find scanners read gitignored files a clean CI checkout never has, so a local run false-REDs" \
    "tests/consumer-matrix/pnpm-monorepo-cell.sh${TAB}real install.sh --full into a tmp consumer plus its dependency tree: network, minutes, non-hermetic" \
    "tests/consumer-matrix/python-unfamiliar-stack-cell.sh${TAB}real install.sh --full into a tmp consumer plus its dependency tree: network, minutes, non-hermetic" \
    "tests/consumer-matrix/npm-tarball-cell.sh${TAB}real install.sh --full against a packed tarball: network, minutes, non-hermetic" \
    "tests/consumer-matrix/getff-dist-cell.sh${TAB}npm pack + npm i of the getff tarball into a tmp consumer, then a real getff init -y: network, minutes, non-hermetic" \
    "packages/core/hooks/pre-push.ts${TAB}pr-commit-trailers needs the PR base ref and the real PR commit range; its local channel is the .husky/pre-push hook, not this sweep"
}

# ── Extraction ─────────────────────────────────────────────────────────────────────────────────
# Single-line `run:` steps only (see CEILING). Leading `VAR=value` assignments are stripped so
# `PREPUSH_ONLY=s17 npx tsx …` classifies by its real interpreter — without that, two live gate
# commands (audit-self.yml:844, :856) would sit outside the population unseen.
# `- run: cmd` (step written without a `name:`) is legal YAML and unused in this workflow today —
# which is exactly why the leading `- ` must be optional here rather than assumed away: the first
# nameless step to land would otherwise drop out of the population silently.
raw_run_lines() {
  grep -oE '^[[:space:]]+(- )?run: [^|>].*' "$WF" | sed -E 's/^[[:space:]]*(- )?run: //'
}
strip_env_prefix() {
  # stdin → stdout, dropping leading NAME=VALUE tokens
  sed -E 's/^([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]+[[:space:]]+)+//'
}

# Leaders that invoke a committed artifact (the comparison population) vs. leaders that are inline
# setup / tool installs (out of scope). The union is asserted complete below, so a workflow that
# starts using `node`, `pnpm` or `deno` REDs with "classify it" instead of silently shrinking the
# population — the exact silent-hole shape this test exists to prevent.
GATE_LEADERS="bash npm npx"
NON_GATE_LEADERS="pip corepack"

observed_leaders() { raw_run_lines | strip_env_prefix | awk '{print $1}' | sort -u; }

# Classification uses the env-stripped form; the command EMITTED keeps its `VAR=value` prefix. That
# asymmetry is load-bearing: `NODE_ENV=development` and `SNAPSHOT_MODE=compare` change what the gate
# does, so they must reach sig_tokens. Stripping before emitting would have let the sweep drop
# `NODE_ENV=development` from the synth-bundle row and still read as covered.
ci_commands() {
  local line stripped leader_re
  leader_re="^($(echo "$GATE_LEADERS" | tr ' ' '|')) "
  raw_run_lines | while IFS= read -r line; do
    stripped="$(printf '%s\n' "$line" | strip_env_prefix)"
    printf '%s\n' "$stripped" | grep -qE "$leader_re" || continue
    printf '%s\n' "$stripped" | grep -qE "$SETUP_RE" && continue
    printf '%s\n' "$line" | grep -qE "$BATTERY_RE" && continue
    printf '%s\n' "$line"
  done | sort -u
}

# The gate table is rank<TAB>name<TAB>trigger<TAB>command. Only the COMMAND field may satisfy a
# token: a row NAMED `typecheck` must not be able to cover the CI command `npm run typecheck` it
# does not actually run.
gate_commands() { cut -d"$TAB" -f4- ; }

# ── sig_tokens <command> → significant tokens, one per line ────────────────────────────────────
sig_tokens() {
  local tok prev=""
  for tok in $1; do
    case "$tok" in
      --*) echo "$tok" ;;
      *=*) [ -z "$prev" ] && echo "$tok" ;;                       # leading env assignment only
      *.sh | *.ts | *.mjs) case "$tok" in */*) echo "$tok" ;; esac ;;
      *) if [ "$prev" = "run" ] || [ "$prev" = "--" ]; then echo "$tok"; fi ;;
    esac
    prev="$tok"
  done
}

# ── artifact_of <command> → its first artifact path (the allowlist key), or empty ──────────────
artifact_of() {
  local tok
  for tok in $1; do
    case "$tok" in
      */*.sh | */*.ts | */*.mjs) echo "$tok"; return ;;
    esac
  done
}

# ── uncovered <gate-table-text> → CI commands matched by no row and no allowlist entry ─────────
uncovered() {
  local rows="$1" cmd toks row t all art allowed
  ci_commands | while IFS= read -r cmd; do
    [ -z "$cmd" ] && continue
    art="$(artifact_of "$cmd")"
    allowed=0
    if [ -n "$art" ]; then
      while IFS="$TAB" read -r a _; do
        [ "$a" = "$art" ] && { allowed=1; break; }
      done <<EOF
$(unreachable_allowlist)
EOF
    fi
    [ "$allowed" -eq 1 ] && continue

    # Fail-closed: a command with nothing identifiable in it (no artifact path, no flag, no
    # `run`/`--` operand) must be REPORTED, never skipped. Skipping it would be a silent hole of
    # exactly the shape this test exists to close — and the report tells the reader that
    # sig_tokens needs a new case, which is the actual fix.
    toks="$(sig_tokens "$cmd")"
    [ -z "$toks" ] && { echo "$cmd  [no significant token — sig_tokens needs a case for this form]"; continue; }
    all=0
    while IFS= read -r row; do
      [ -z "$row" ] && continue
      all=1
      for t in $toks; do
        case "$row" in *"$t"*) ;; *) all=0; break ;; esac
      done
      [ "$all" -eq 1 ] && break
    done <<EOF
$rows
EOF
    [ "$all" -eq 1 ] || echo "$cmd"
  done
}

GATES="$("$SWEEP" --list-gates 2>/dev/null | gate_commands)"

# ── 1. non-vacuity of both inputs ──────────────────────────────────────────────────────────────
# An empty population or an empty gate table makes every arm below pass for the wrong reason —
# `for x in <nothing>` exits 0, the vacuous-gate trap that bit PR #1355 twice. Floors are asserted
# BEFORE any coverage claim, and they are floors (≥), never exact counts, so ordinary growth does
# not red the gate.
CI_COUNT=$(ci_commands | grep -c .)
GATE_COUNT=$(printf '%s\n' "$GATES" | grep -c .)
if [ "$CI_COUNT" -ge 15 ]; then
  ok "comparison population non-empty: $CI_COUNT atomic CI commands extracted (floor 15)"
else
  bad "only $CI_COUNT CI commands extracted (floor 15) — extraction broke; every arm below would be vacuous"
fi
if [ "$GATE_COUNT" -ge 20 ]; then
  ok "gate table non-empty: $GATE_COUNT rows read via --list-gates (floor 20)"
else
  bad "only $GATE_COUNT gate rows read from $SWEEP --list-gates (floor 20) — the seam broke"
fi

# ── 2. leader completeness (no silent shrink of the population) ────────────────────────────────
unclassified=""
while IFS= read -r leader; do
  [ -z "$leader" ] && continue
  case " $GATE_LEADERS $NON_GATE_LEADERS " in
    *" $leader "*) ;;
    *) unclassified="$unclassified $leader" ;;
  esac
done <<EOF
$(observed_leaders)
EOF
[ -z "$unclassified" ] \
  && ok "every single-line run: leader is classified as gate-invoking or inline setup" \
  || bad "unclassified run: leader(s) →$unclassified — add each to GATE_LEADERS (it invokes a committed artifact) or NON_GATE_LEADERS (inline setup / tool install), never leave it out"

# ── 3. battery families each have a sweep row ──────────────────────────────────────────────────
# Without this, removing a battery row from the sweep would go unnoticed: its CI steps are excluded
# from the population by BATTERY_RE, so the coverage arm would never look at them.
missing_batt=""
while IFS="$TAB" read -r label pat; do
  [ -z "${label:-}" ] && continue
  case "$GATES" in *"$pat"*) ;; *) missing_batt="$missing_batt $label" ;; esac
done <<EOF
$(battery_families)
EOF
[ -z "$missing_batt" ] \
  && ok "every battery family excluded from the population still has a sweep row" \
  || bad "battery family excluded from comparison but NOT covered by any sweep row →$missing_batt"

# ── 4. allowlist hygiene ───────────────────────────────────────────────────────────────────────
stale=""; thin=""
while IFS="$TAB" read -r art why; do
  [ -z "${art:-}" ] && continue
  grep -qF "$art" "$WF" || stale="$stale $art"
  [ "${#why}" -ge 20 ] || thin="$thin $art"
done <<EOF
$(unreachable_allowlist)
EOF
[ -z "$stale" ] \
  && ok "every UNREACHABLE allowlist entry names an artifact the workflow still invokes" \
  || bad "stale allowlist entr(ies) — not present in audit-self.yml →$stale"
[ -z "$thin" ] \
  && ok "every UNREACHABLE allowlist entry carries a ≥20-char rationale" \
  || bad "allowlist entr(ies) with a rationale under 20 chars →$thin"

# ── 5. the real check ──────────────────────────────────────────────────────────────────────────
UNCOVERED="$(uncovered "$GATES")"
[ -z "$UNCOVERED" ] \
  && ok "every atomic CI command is reachable from gate_table() or explicitly allowlisted" \
  || bad "CI command(s) the sweep never runs — a green sweep does NOT predict a green CI for these:
$(printf '%s\n' "$UNCOVERED" | sed 's/^/      /')
    Fix by adding a gate_table() row in scripts/run-local-ci-sweep.sh, or — if the gate genuinely
    cannot run locally — an unreachable_allowlist() entry here stating why (≥20 chars)."

# ── 6. NEG (LOAD-BEARING): a seeded unknown CI command must be named ───────────────────────────
# The workflow is copied, never mutated. A metatest that cannot go RED is decoration.
REAL_WF="$WF"
tmpwf=$(mktemp)
FAKE="bash scripts/seeded-nonexistent-gate.sh --check"
awk -v ins="        run: $FAKE" \
  '{print} /^jobs:$/ && !d {print "  seeded-probe-job:"; print "    steps:"; print ins; d=1}' \
  "$REAL_WF" > "$tmpwf"
if ! grep -qF "$FAKE" "$tmpwf"; then
  bad "neg: seeding failed — the probe command never entered the workflow copy (vacuous proof)"
else
  WF="$tmpwf"
  neg="$(uncovered "$GATES")"
  WF="$REAL_WF"
  case "$neg" in
    *"$FAKE"*) ok "neg: an unwired CI command is named by the gate (non-vacuous)" ;;
    *) bad "neg: gate stayed green with '$FAKE' present in the workflow → VACUOUS" ;;
  esac
fi
rm -f "$tmpwf"

# ── 7. NEG (LOAD-BEARING): removing a real gate row must flip its CI command to uncovered ──────
# Arm 6 proves the workflow side is live; this proves the gate-table side is too. Without it, a
# gate table that silently emptied would still pass arm 6 (the fake is uncovered either way).
VICTIM_CMD="npm run typecheck"
if ! printf '%s\n' "$GATES" | grep -qF "$VICTIM_CMD"; then
  bad "neg: probe row '$VICTIM_CMD' is no longer in the gate table — pick a live row for this arm"
else
  SEEDED_GATES="$(printf '%s\n' "$GATES" | grep -vF "$VICTIM_CMD")"
  case "$(uncovered "$SEEDED_GATES")" in
    *"$VICTIM_CMD"*) ok "neg: deleting the '$VICTIM_CMD' row flips its CI command to uncovered (non-vacuous)" ;;
    *) bad "neg: gate stayed green with the '$VICTIM_CMD' row deleted → VACUOUS" ;;
  esac
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
