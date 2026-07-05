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
# tsx, not plain node (node <22.6 => ERR_UNKNOWN_FILE_EXTENSION). tsx is a `packages/core`
# devDep: the CI Principles job runs `npm ci --prefix packages/core`, so tsx lands in
# packages/core/node_modules/.bin (NOT root); a hoisted local dev checkout has it at root
# instead. Resolve packages/core first, then root. (npx tsx was flaky in this nested
# vitest->bash->cmd context.) If neither exists, the --json-empty fallback below fires loudly.
TSX="$REPO_ROOT/packages/core/node_modules/.bin/tsx"
[ -x "$TSX" ] || TSX="$REPO_ROOT/node_modules/.bin/tsx"

# --json is a probe-only reporting mode: emit the raw computeMatrix() rows as JSON on stdout,
# so this bash probe can grep for "refused" without duplicating computeVerdict()'s logic.
# Falls back to a plain --check invocation's exit code if --json is unavailable (defensive —
# keeps this probe from silently reporting false-PORTABLE if the script's CLI surface changes).
rows_json=$("$TSX" "$GEN" --json --root "$REPO_ROOT" 2>/dev/null || true)

if [ -z "$rows_json" ]; then
  # Fallback: no --json support detected. Use --check's exit status as a coarser signal —
  # exit 1 means SOME undeclared refusal or drift exists, which is a strict superset of
  # "some rule is invisible" (an honest, declared refusal is STILL invisible on that harness).
  # This branch should not normally fire; recorded loudly if it does (T-S9-A: never silently
  # downgrade to a weaker check without saying so).
  "$TSX" "$GEN" --check --root "$REPO_ROOT" >/tmp/rule-channel-readability-fallback.$$ 2>&1
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
