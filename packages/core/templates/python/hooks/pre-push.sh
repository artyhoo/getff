#!/usr/bin/env bash
# getff Python pre-push hook — local git rung on the python lane.
#
# What this does:
#   Runs the checks the getff project-checks record arms — the SAME ast-grep + ruff checks the
#   getff python CI gate runs, probed once at install: a check that was green at install blocks
#   the push; one that was red (pre-existing findings) or unrunnable is recorded «not armed» in
#   .ai-factory/tool-decisions.md and does NOT block — what was green before the install stays
#   green. A not-armed check whose reason is a finding count re-probes on every push
#   (scripts/run-armed.sh --probe) and arms itself the day it turns green — no human step. A
#   structural «not wired:» reason (the tool was absent from the machine that ran the install)
#   never re-probes: install the tool, then `install.sh python --refresh` re-arms it. CI is the
#   last-resort gate, not the primary one (README.md#why-this-exists).
#
# Opt-out:
#   - Set GETFF_SKIP_HOOKS=1 in your env to skip this rung for one push:
#       GETFF_SKIP_HOOKS=1 git push ...
#   - Or delete this hook: `rm .getff/hooks/pre-push` (then `git config --unset core.hooksPath`
#     if you have no other hooks under .getff/hooks/).
#   - Or remove the whole getff gate by deleting `.getff/` and uninstalling per the project README.
#
# Delivered by the getff Python lane (setup.d/45-python.sh). Reads the project-checks record
# through scripts/run-armed.sh — the same block .github/workflows/getff-python.yml reads — and
# the command strings below are byte-identical to the record lines the install writes
# (setup.d/45-python.sh _py_record_project_checks): a one-char drift would run a check the
# record skips (the ci-runs-every-recorded-check gate asserts writer/hook/CI agree). Body mirrors
# the CI template — keep the two in sync on any pin bump (both bump together per
# .claude/rules/ci-tool-pinning.md Rule A).
set -euo pipefail

# Opt-out — honoured at runtime (runs when the consumer pushes).
if [[ "${GETFF_SKIP_HOOKS:-0}" == "1" ]]; then
  exit 0
fi

# Drain stdin so `git push` does not SIGPIPE; we run against the working tree, not the diff.
# (The pre-push stdin format is "<local-ref> <local-sha> <remote-ref> <remote-sha>" per line.)
cat >/dev/null

# Both tools must be installed for the rung to fire. A missing linter fails OPEN with a loud
# one-line warning + the pinned install hint (the same hint .github/workflows/getff-python.yml
# prints in its refuse-path) — a missing tool must not brick every push, but silence is also
# forbidden (a hook that exits 0 with no word when its linters are absent is the silent-no-op
# rung anti-pattern, T-S2B-A in the S2b kickoff §5).
have_ast_grep=0
have_ruff=0
if command -v ast-grep >/dev/null 2>&1; then have_ast_grep=1; fi
if command -v ruff      >/dev/null 2>&1; then have_ruff=1; fi

# Run from the repo root so relative paths (.getff/astgrep-rules, .getff/ruff-bans.toml) resolve
# even when the user invokes `git push` from a subdirectory.
cd "$(git rev-parse --show-toplevel)"

# run_recorded <exact-record-command> — run ONE check through the project-checks record
# (scripts/run-armed.sh). The runner prints the check's own output plus a «· not armed» line for
# a command the install recorded as red/unrunnable — those must not block (what was green before
# the install stays green). The runner exits 2 for a record problem (missing / unreadable / no
# armed: + not-armed: block) — but a CHECK may itself exit 2 (ruff exits 2 on a broken config)
# and the runner propagates that verbatim, so the record file decides: unreadable → die loud,
# because silently pushing with NO checks is the silent-no-op rung anti-pattern this hook exists
# against (T-S2B-A); readable → the 2 is the check's own (or a malformed block, whose
# «❌ run-armed:» line is already in the streamed output above) — return it and let the push
# BLOCK on the check, never demote it via a false «restore the record» hint (a re-probe would
# record the still-broken check not-armed and the gate would skip itself). Output is streamed
# after capture so the findings above the ✗ line are visible under `set -o pipefail` too.
run_recorded() {
  local _rc=0 _out
  _out=$(bash scripts/run-armed.sh "$1" 2>&1) || _rc=$?
  printf '%s\n' "$_out"
  if [ "$_rc" -eq 2 ] && [ ! -r .ai-factory/tool-decisions.md ]; then
    echo "✗ getff pre-push: the project-checks record (.ai-factory/tool-decisions.md) is missing or unreadable — scripts/run-armed.sh cannot tell which checks are armed. Restore it: bash /path/to/getff/install.sh python --refresh (or reinstall)." >&2
    exit 1
  fi
  return "$_rc"
}

# ZCode skill-mirror check (#1502) — the same read-only completeness gate the npm lane wires into
# .husky/pre-commit; the python lane's only local git rung is pre-push, so it rides here (and via
# the pre-commit fragment, which invokes this same body at its pre-push stage). Absent script →
# loud WARN, push continues (same DECISIONS contract as the npm hook — never a silent skip); it is
# absent only when removed from the project, and stays absent only under a Layer-3
# scripts/check-zcode-mirror.sh.override.md (--refresh skips such a file). `-f`, not `-x`: the
# script runs through `sh`, so its executable bit must not decide whether the check runs. "$PWD"
# (the toplevel after the cd above) is passed explicitly, so an inherited AIF_PROJECT_ROOT cannot
# point the check at another tree.
if [ -f scripts/check-zcode-mirror.sh ]; then
  if ! sh scripts/check-zcode-mirror.sh "$PWD"; then
    echo "✗ getff pre-push: .zcode/skills mirror incomplete — push blocked. Fix the offenders above (or add an exemption line to .ai-factory/zcode-mirror-exemptions.txt)." >&2
    exit 1
  fi
else
  echo "⚠ getff pre-push: scripts/check-zcode-mirror.sh not found — .zcode/skills mirror NOT checked; getff's installer puts it back: bash /path/to/getff/install.sh python --refresh (skipped while scripts/check-zcode-mirror.sh.override.md marks it project-owned)." >&2
fi

if [[ "$have_ast_grep" == "0" ]]; then
  echo "⚠ getff pre-push: ast-grep NOT on PATH — skipping ast-grep arm (fail OPEN)." >&2
  echo "    install hint: npm install -g @ast-grep/cli@0.44.1" >&2
fi
if [[ "$have_ruff" == "0" ]]; then
  echo "⚠ getff pre-push: ruff NOT on PATH — skipping ruff arm (fail OPEN)." >&2
  echo "    install hint: pip install ruff==0.15.21" >&2
fi

# If BOTH are absent, exit 0 here so we don't brick the push with no enforcement available.
if [[ "$have_ast_grep" == "0" && "$have_ruff" == "0" ]]; then
  echo "⚠ getff pre-push: no linters present — rung degraded to NO-OP. Install ast-grep + ruff to restore enforcement." >&2
  exit 0
fi

# The three checks. Record path (the lane delivers scripts/run-armed.sh alongside this hook):
# each command runs through the record, so only the checks the install armed can block. Direct
# fallback (runner absent — consumer removed it, or a hook left from a pre-record install): the
# exact pre-record body, kept so the rung never degrades silently. The command strings are the
# record's byte-exact lines either way.
# `-f` alone would trust a truncated (e.g. zero-byte) runner: bash exits 0 on an empty script, so
# every run_recorded call would silently pass and the --probe would no-op — a silent no-check push
# (the exact T-S2B-A shape). The content grep (the marker the runner itself parses) is the sanity
# floor; anything that fails it takes the loud direct fallback below.
if [ -f scripts/run-armed.sh ] && grep -q 'aif:project-checks' scripts/run-armed.sh 2>/dev/null; then

  # ast-grep arm — mirror of .github/workflows/getff-python.yml:48-49 (sgconfig.yml resolves
  # .getff/astgrep-rules).
  if [[ "$have_ast_grep" == "1" ]]; then
    if ! run_recorded "ast-grep scan"; then
      echo "✗ getff pre-push: ast-grep structural rule(s) fired — push blocked. See violations above." >&2
      exit 1
    fi
  fi

  # ruff arm — mirror of .github/workflows/getff-python.yml:71-72 (discovered config) + :80-81
  # (getff bans isolated via --config). The two ruff runs are TWO record lines (T-OBW2P-A): a
  # green bans run must not arm a red discovered-config run, so neither line implies the other.
  if [[ "$have_ruff" == "1" ]]; then
    if ! run_recorded "ruff check ."; then
      echo "✗ getff pre-push: ruff (discovered config) fired — push blocked." >&2
      exit 1
    fi
    if [[ -f .getff/ruff-bans.toml ]]; then
      if ! run_recorded "ruff check . --config .getff/ruff-bans.toml --no-cache"; then
        echo "✗ getff pre-push: ruff (getff bans --config) fired — push blocked." >&2
        exit 1
      fi
    else
      echo "⚠ getff pre-push: .getff/ruff-bans.toml missing — getff TID bans NOT enforced by this rung." >&2
    fi
  fi

  # Self-arming probe — a check the install could not arm re-probes here and arms itself the day
  # it turns green, with no human step (run-armed.sh --probe: armed and structural «not wired:»
  # lines are skipped, so the common push pays only the not-yet-green checks). Non-blocking —
  # EXCEPT exit 2 (record unreadable), which dies loud for the same reason run_recorded does.
  _probe_rc=0
  bash scripts/run-armed.sh --probe || _probe_rc=$?
  if [ "$_probe_rc" -eq 2 ]; then
    echo "✗ getff pre-push: the project-checks record (.ai-factory/tool-decisions.md) is missing or unreadable — scripts/run-armed.sh cannot tell which checks are armed. Restore it: bash /path/to/getff/install.sh python --refresh (or reinstall)." >&2
    exit 1
  fi

else

  echo "⚠ getff pre-push: scripts/run-armed.sh missing, unreadable, or not a run-armed script (empty/truncated counts) — running the checks directly, NOT through the project-checks record (a brownfield tree will be blocked by pre-existing findings; restore the runner: bash /path/to/getff/install.sh python --refresh)." >&2

  # ast-grep arm — mirror of .github/workflows/getff-python.yml:48-49 (sgconfig.yml resolves
  # .getff/astgrep-rules).
  if [[ "$have_ast_grep" == "1" ]]; then
    if ! ast-grep scan; then
      echo "✗ getff pre-push: ast-grep structural rule(s) fired — push blocked. See violations above." >&2
      exit 1
    fi
  fi

  # ruff arm — mirror of .github/workflows/getff-python.yml:71-72 (discovered config) + :80-81
  # (getff bans isolated via --config).
  if [[ "$have_ruff" == "1" ]]; then
    if ! ruff check .; then
      echo "✗ getff pre-push: ruff (discovered config) fired — push blocked." >&2
      exit 1
    fi
    if [[ -f .getff/ruff-bans.toml ]]; then
      if ! ruff check . --config .getff/ruff-bans.toml --no-cache; then
        echo "✗ getff pre-push: ruff (getff bans --config) fired — push blocked." >&2
        exit 1
      fi
    else
      echo "⚠ getff pre-push: .getff/ruff-bans.toml missing — getff TID bans NOT enforced by this rung." >&2
    fi
  fi

fi

exit 0
