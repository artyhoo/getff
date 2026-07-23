#!/usr/bin/env bash
# Surface 9 — rule-channel readability. No core rule (Tier-0 ∪ paths:-declaring rule) may be
# INVISIBLE on any harness this project actively delivers to. "Invisible" = the CTX Stage 3
# capability matrix (.ai-factory/rule-channel-capabilities.json) computes a "refused" verdict
# for that (rule × harness) pair. PORTABLE when the live-computed matrix has ZERO refused
# verdicts (whether declared in the degradation manifest or not — a readability probe cares
# about the END STATE "is it visible anywhere", not about whether a refusal was honestly
# recorded, which is scripts/render-rule-channels.mjs --check's own separate concern).
#
# This is the off-CC, population-wide readability companion to
# scripts/render-rule-channels.mjs --check (which gates HONESTY of refusals — refused-but-
# undeclared is a drift failure) and to principle 31 (which gates that every rule DECLARES
# a channel at all, harness-agnostic). Neither of those asserts "therefore every supported
# harness can actually see it" — this probe is the missing readability assertion Stage 3's
# kickoff calls out, parallel to how rules-autoload.sh (Surface 7) is the readability
# companion to principle 09's doc-authority header gate.
#
# Follow-up: consumer-facing per-harness config EMISSION (turning this matrix into installed
# artifacts for {zcode, Cursor, Codex, Cline, Aider, ...}) is issue #898 — CLOSED/parked per
# #894 §7 (the "(b)" fork). This probe is the "(c)-lite" readability slice shipped now; the
# consumer emitter remains parked, not resurrected by this probe's existence.
#
# Per .claude/rules/no-paid-llm-in-ci.md: this probe SHELLS OUT to a deterministic, zero-dep
# Node script (render-rule-channels.mjs) rather than re-implementing its verdict computation
# in bash — avoids #sync-by-copy-paste (dual-implementation-discipline.md §8) of the same
# capability-matrix lookup logic in two languages. Node is a portable runtime available on
# every harness this project targets (not a CC-specific dependency), so this stays a
# harness-agnostic, off-CC probe exactly like its siblings.
set -uo pipefail
# Resolve by path, not `git rev-parse` — GIT_DIR-immune for worktree-push hook env (see ../run-audit.sh).
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
source "$REPO_ROOT/tests/agnosticism/_cc-absent-lib.sh"
unset GIT_DIR GIT_COMMON_DIR GIT_WORK_TREE

GEN="$REPO_ROOT/scripts/render-rule-channels.mjs"
# render-rule-channels.mjs imports a .ts module (rule-channel-glob.ts), so it must run under
# tsx, not plain node (node <22.6 => ERR_UNKNOWN_FILE_EXTENSION). Resolution order, fastest
# first — every step is a mechanism already proven in this repo:
#   1. packages/core/node_modules/.bin/tsx — tsx is a `packages/core` devDep, so the CI
#      Principles job's `npm ci --prefix packages/core` lands it here (NOT root).
#   2. root node_modules/.bin/tsx — where a hoisted local dev checkout puts it instead.
#   3. `node --import tsx/esm` — Node's OWN upward module resolution, the same mechanism
#      .husky/pre-push:28 already depends on to decide whether it can run the TS-core hook.
#      This is what reaches a git worktree under .claude/worktrees/<name>/ whose node_modules
#      symlinks were never provisioned: node walks up and finds the primary checkout's
#      install. Steps 1+2 both miss there, and without this step the probe reported a FAKE
#      rule-channel failure for a purely environmental cause (incident 2026-07-23: the probe
#      recorded `fallback-check-mode ... --check exit=127 ... DEGRADED:no-json-mode`, which
#      is loud but about the WRONG thing — 63 of 125 live worktrees were in that state).
# NOT `npx tsx`: flaky in this nested vitest->bash->cmd context (and may reach the network).
TSX="$REPO_ROOT/packages/core/node_modules/.bin/tsx"
[ -x "$TSX" ] || TSX="$REPO_ROOT/node_modules/.bin/tsx"
if [ -x "$TSX" ]; then
  run_gen() { "$TSX" "$GEN" "$@"; }
else
  if node --import tsx/esm -e '' >/dev/null 2>&1; then
    run_gen() { node --import tsx/esm "$GEN" "$@"; }
  else
    # tsx is unreachable by EVERY route. That is an ENVIRONMENT failure, not a rule-channel
    # failure — say so precisely instead of laundering it through the --json fallback below
    # as if the capability matrix were at fault (T-S9-A: never downgrade silently, and never
    # misattribute). `node --import tsx/esm -e ''` fails distinguishably here: node exits
    # non-zero with ERR_MODULE_NOT_FOUND "Cannot find package 'tsx'".
    record rule-channel-readability tsx-unresolvable \
      "tsx absent at packages/core/node_modules/.bin, at node_modules/.bin, and unresolvable via 'node --import tsx/esm' — provision this checkout (npm ci --prefix packages/core, or restore this worktree's node_modules symlinks); NOT a rule-channel defect" \
      1 DEGRADED:tsx-unresolvable
    exit 0
  fi
fi

# --json is a probe-only reporting mode: emit the raw computeMatrix() rows as JSON on stdout,
# so this bash probe can grep for "refused" without duplicating computeVerdict()'s logic.
# Falls back to a plain --check invocation's exit code if --json is unavailable (defensive —
# keeps this probe from silently reporting false-PORTABLE if the script's CLI surface changes).
rows_json=$(run_gen --json --root "$REPO_ROOT" 2>/dev/null || true)

if [ -z "$rows_json" ]; then
  # Fallback: no --json support detected. Use --check's exit status as a coarser signal —
  # exit 1 means SOME undeclared refusal or drift exists, which is a strict superset of
  # "some rule is invisible" (an honest, declared refusal is STILL invisible on that harness).
  # This branch should not normally fire; recorded loudly if it does (T-S9-A: never silently
  # downgrade to a weaker check without saying so).
  run_gen --check --root "$REPO_ROOT" >/tmp/rule-channel-readability-fallback.$$ 2>&1
  check_status=$?
  record rule-channel-readability fallback-check-mode \
    "render-rule-channels.mjs --json unavailable; used --check exit=${check_status} as coarse signal" \
    "$([ "$check_status" -eq 0 ] && echo 0 || echo 1)" \
    "$([ "$check_status" -eq 0 ] && echo PORTABLE || echo DEGRADED:no-json-mode)"
  rm -f /tmp/rule-channel-readability-fallback.$$
  exit 0
fi

refused_count=$(printf '%s' "$rows_json" | grep -o '"verdict":"refused"' | wc -l | tr -d ' ')
total_count=$(printf '%s' "$rows_json" | grep -o '"verdict":' | wc -l | tr -d ' ')

if [ "$total_count" -lt 1 ]; then
  record rule-channel-readability population-sentinel "computed 0 (rule × harness) rows — probe is blind" 1 DEGRADED:empty-population
  exit 0
fi

if [ "$refused_count" -eq 0 ]; then
  record rule-channel-readability no-invisible-core-rules "0/${total_count} (rule × harness) pairs refused" 0 PORTABLE
else
  # Name the specific refused pairs so a reader doesn't have to re-run the generator.
  refused_pairs=$(printf '%s' "$rows_json" | grep -oE '"rule":"[^"]+","harness":"[^"]+","verdict":"refused"' \
    | sed -E 's/"rule":"([^"]+)","harness":"([^"]+)".*/\1 on \2/' | paste -sd ';' -)
  record rule-channel-readability no-invisible-core-rules \
    "${refused_count}/${total_count} refused: ${refused_pairs}" 1 CC-ONLY
fi
