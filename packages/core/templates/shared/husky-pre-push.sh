#!/usr/bin/env bash
# .husky/pre-push — TS-core dispatcher (shipped by install.sh via husky-pre-push.sh).
#
# Runtime feature detection, NOT install-time (dual-implementation-discipline.md §3):
# checks at every push whether Node ≥20 is available, routes accordingly.
#
# Capability-check, NOT brand-name detection (dual-implementation-discipline.md §4 / §8):
# gates on `command -v node` + major-version, never on a harness brand string.
#
# Routes:
#   Node ≥20 + pre-push.ts present → TS-core hook (full checks: §7 substance, §1.7 substance, etc.)
#   Otherwise                       → bash critical-only fallback (§7/§1.7 presence only)
#
# Both hooks are installed by install.sh alongside this file.
# See packages/core/hooks/pre-push.fallback.sh for the fallback's check set.
#
# POSIX-sh safe (no `pipefail`): husky v9 invokes the hook via `sh` on
# Debian/Ubuntu (/bin/sh = dash), which ignores the bash shebang above — a
# bashism like `set -o pipefail` aborts the hook with "Illegal option" and
# hard-blocks every consumer push there. The only pipe below (`node_major`)
# carries its own `|| echo 0` fallback, so `set -eu` is sufficient.
set -eu

REPO_ROOT=$(git rev-parse --show-toplevel)
TS_HOOK="$REPO_ROOT/packages/core/hooks/pre-push.ts"
FALLBACK="$REPO_ROOT/packages/core/hooks/pre-push.fallback.sh"

node_major() { node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }

# The trailing probe (`node --import tsx/esm -e ''`) actually exercises the tsx ESM
# loader: on a pnpm monorepo tsx can live in a sub-package and not resolve from the
# repo root, so `--import tsx/esm` would throw and the hook would CRASH instead of
# degrading. A failing probe falls through to the bash FALLBACK — never a hard crash
# that blocks `git push` (GH #636). Deliberate ~130ms/push cost: do NOT remove without
# understanding it guards against an unresolvable-tsx hard crash.
if command -v node >/dev/null 2>&1 && [ "$(node_major)" -ge 20 ] && [ -f "$TS_HOOK" ] \
   && node --import tsx/esm -e '' >/dev/null 2>&1; then
  exec node --import tsx/esm "$TS_HOOK"
elif [ -x "$FALLBACK" ]; then
  exec bash "$FALLBACK"
else
  echo "⚠ pre-push: Node ≥20 unavailable and bash fallback not present — skipping checks."
  echo "  Install Node ≥20 to enable the full TS-core pre-push hook."
  exit 0
fi
