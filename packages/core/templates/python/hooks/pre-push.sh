#!/usr/bin/env bash
# getff Python pre-push hook — local git rung on the python lane.
#
# What this does:
#   Runs the SAME ast-grep + ruff checks the getff python CI gate runs, but BEFORE the push leaves
#   your machine. CI is the last-resort gate, not the primary one (README.md#why-this-exists).
#
# Opt-out:
#   - Set GETFF_SKIP_HOOKS=1 in your env to skip this rung for one push:
#       GETFF_SKIP_HOOKS=1 git push ...
#   - Or delete this hook: `rm .getff/hooks/pre-push` (then `git config --unset core.hooksPath`
#     if you have no other hooks under .getff/hooks/).
#   - Or remove the whole getff gate by deleting `.getff/` and uninstalling per the project README.
#
# Delivered by the getff Python lane (setup.d/45-python.sh). Body mirrors the CI template at
# .github/workflows/getff-python.yml — keep the two in sync on any pin bump (both bump together
# per .claude/rules/ci-tool-pinning.md Rule A).
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

exit 0
