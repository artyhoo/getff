#!/usr/bin/env bash
# Surface 10 — dual-implementation-discipline §8 `#brand-name-detection`. Runtime shell
# logic MUST branch on a *capability* (env var / settings key presence), never on a
# brand-name literal (§4). A brand comparison breaks the moment CC renames an
# identifier or a compatible harness self-identifies differently.
#
# WHAT COUNTS (measured 2026-08-09, both directions — see
# docs/meta-factory/research-patches/2026-08-09-dual-impl-s8-detection-layer.md §2):
#   FIRES on a comparison against a brand literal:
#     [[ "$H" == "claude" ]] · [ "$h" = 'claude' ] · case "$A" in claude) · =~ anthropic
#   SILENT on the legitimate §4 shapes — the false-positive direction that killed the
#   rule's own :193 sketch:
#     [[ -n "$ANTHROPIC_API_KEY" ]]      (env-var presence = a capability check)
#     [[ -n "$CLAUDE_CODE_HOOKS_ENABLED" ]]
#     "$CLAUDE_PROJECT_DIR/.claude/settings.json"   (path string, not a branch)
#     a comment documenting the anti-pattern's own syntax
# The rule's §8 falsification command as written (`grep '"claude"\|"cc"\|ANTHROPIC'`)
# flagged `ANTHROPIC_API_KEY` — a legit capability check — so it was not shippable
# verbatim; this is the refined form that measured 4/4 true-positive, 0/3 false-positive.
#
# spec: .claude/rules/dual-implementation-discipline.md §4 + §8 `#brand-name-detection`
# Per .claude/rules/no-paid-llm-in-ci.md: pure bash + git, zero API calls.
set -uo pipefail
# Resolve by path, not `git rev-parse` — GIT_DIR-immune for the worktree-push hook env
# (see ../run-audit.sh); mirrors channel-coverage.sh:24.
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
source "$REPO_ROOT/tests/agnosticism/_cc-absent-lib.sh"
unset GIT_DIR GIT_COMMON_DIR GIT_WORK_TREE

# A space-delimited `=` is a `[ ]` comparison; `VAR=claude` (no space) is an assignment.
# `cc` is included per §8's literal list but only in comparison position, so the
# ubiquitous `.claude/` path segment cannot match.
BRAND_RE='(==|!=|=~|[[:space:]]=)[[:space:]]*["'"'"']?(claude|anthropic|cc)["'"'"']?[[:space:]]*(\]|\)|;|$)|^[[:space:]]*case[[:space:]].*[[:space:]]in[[:space:]]*(claude|anthropic)\)'

# Population (T10 — enumerate before probing): every tracked shell script. Wider than
# the rule's `.claude/hooks/`-only sketch on purpose — §4 governs "runtime code",
# and a settings-wired script outside .claude/hooks/ branches at the same risk.
count=$(git -C "$REPO_ROOT" ls-files '*.sh' | wc -l | tr -d ' ')
hits=0

# ONE grep pass over the whole population, then filter the MATCHED LINES. A per-file loop
# costs ~2 subprocesses x population and pushed principle 21 past its 5s timeout (caught by
# pre-push 2026-08-09) — the population is the same, only the process count changes.
#
# Two carve-outs, both about TEXT rather than control flow, applied to the matched line:
#  1. whole-line comments — prose documenting the anti-pattern (this file, the rule,
#     check-hook-marker.sh's usage block) is not a branch;
#  2. lines whose leading command is `echo`/`printf` — a brand literal inside a printed
#     payload is emitted text, not a branch taken by this script. Load-bearing: without it
#     the probe flags harness-self.test.sh's own seeded-fixture generator (verified
#     2026-08-09). Same carve-out and rationale as ci-tool-pinning.md §2 "Printed hints".
while IFS= read -r m; do
  [ -n "$m" ] || continue
  # `git grep -nI` output is `path:lineno:content`; strip the two leading fields.
  content=${m#*:}; content=${content#*:}
  printf '%s' "$content" | grep -qE '^[[:space:]]*(#|echo|printf)' && continue
  hits=$((hits + 1))
  record brand-detection "${m%%:*}" \
    "brand-literal branch (§8 #brand-name-detection): $(printf '%.110s' "${m#*:}")" 1 BRAND-DETECTION
done <<EOF
$(git -C "$REPO_ROOT" grep -nIiE "$BRAND_RE" -- '*.sh' 2>/dev/null || true)
EOF

if [ "$hits" -eq 0 ]; then
  record brand-detection population \
    "no brand-literal branch across $count tracked *.sh (capability-checks per §4 excluded)" 0 PORTABLE
fi
