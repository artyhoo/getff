#!/usr/bin/env bash
# demo/setup-sandbox.sh — builds the throwaway consumer project the two .tape
# recordings run against. Runs BEFORE `vhs` starts recording (npm install of
# the shipped dev-deps takes longer than a 20s demo should show on screen) —
# `make demo` calls this first, then hands the sandbox to vhs.
#
# Regenerates a fresh sandbox every run; safe to re-run any time.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SANDBOX="${SANDBOX:-/tmp/getff-demo}"

rm -rf "$SANDBOX"
mkdir -p "$SANDBOX"
cd "$SANDBOX"

git init -q
git config user.email "demo@getff.dev"
git config user.name "getff demo"
npm init -y --silent >/dev/null

# README's documented one-command install (using the local checkout instead
# of a fresh `git clone` of the repo, so regeneration doesn't depend on
# network access or on this branch being pushed yet — same `./setup`
# entrypoint, same non-interactive flags: `bash /tmp/rt/setup ts-server`).
printf 'node_modules/\n' > .gitignore

bash "$REPO_ROOT/setup" -y ts-server

# `./setup -y` already installs dev-deps (npm install) and activates the shipped .husky
# hooks (core.hooksPath). Do NOT run `npx husky init` here — it clobbers the
# shipped pre-commit/pre-push with husky's own placeholder hook.

git add -A
# --no-verify: this is the scaffold commit (shipped framework files, not yet
# reviewed/trimmed source), not a developer change — the hook exists to
# gate developer commits, which start right after this one.
git commit -q -m "chore: initial commit (framework installed)" --no-verify

# Clean baseline source file the violation-blocked recording appends to.
mkdir -p src
cat > src/index.ts <<'TS'
export function greet(name: string): string {
  return `Hello, ${name}!`;
}
TS
git add src/index.ts
git commit -q -m "feat: add greet function"

echo "Sandbox ready at $SANDBOX"
