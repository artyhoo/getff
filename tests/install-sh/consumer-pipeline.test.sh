#!/usr/bin/env bash
# consumer-pipeline.test.sh — GH #482 / consumer-usable-pipeline. Proves: (1) install ships the
# backlog convention + dir; (2) /pipeline discovery finds a consumer kickoff under .ai-factory/;
# (3) framework dogfood still resolves to .claude/ (T15). Asserts install rc=0 (no false-green).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

C=$(mktemp -d)
# Minimal consumer package.json — install.sh requires one (mirrors r2-auto-wire.test.sh).
printf '{"name":"consumer","version":"0.0.0"}\n' > "$C/package.json"
# --with-aif-suite: /pipeline is part of the F7-gated AIF operator suite (it drives the aif-handoff
# dispatch loop). A consumer who wants a usable shipped /pipeline opts into the suite; this test
# exercises the shipped pipeline helper, so it installs with the flag.
( cd "$C" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force --with-aif-suite </dev/null ) >"$C/.install.log" 2>&1
rc=$?
[ "$rc" = "0" ] || bad "install rc=$rc (tail: $(tail -3 "$C/.install.log" | tr '\n' '|'))"

# (1) convention shipped + dir created
grep -qF 'Orchestration — backlog & /pipeline' "$C/AGENTS.md" \
  && ok "AGENTS.md ships the backlog storage convention" \
  || bad "AGENTS.md missing the orchestration convention section"
test -d "$C/.ai-factory/orchestrator-prompts" \
  && ok ".ai-factory/orchestrator-prompts created by install" \
  || bad ".ai-factory/orchestrator-prompts not created"

# (2) consumer writes a kickoff under the agnostic home → discovery finds it
mkdir -p "$C/.ai-factory/orchestrator-prompts/demo"
printf 'Type: fix\n\n## §1 Sub-wave\n| A | do x |\n' > "$C/.ai-factory/orchestrator-prompts/demo/kickoff.md"
DISC=$( REPO_ROOT="$C" bash "$C/.claude/skills/pipeline/helpers/priority-score.sh" 2>&1 || true )
echo "$DISC" | grep -q 'demo' \
  && ok "discovery finds the consumer kickoff via the agnostic .ai-factory home" \
  || bad "discovery did NOT find the consumer kickoff. out: $(printf '%s' "$DISC" | tail -3 | tr '\n' '|')"

# (3) T15 dogfood — in THIS framework repo the resolver still returns the .claude path
FW=$( source "$REPO_ROOT/.claude/skills/pipeline/helpers/lib/common.sh"; REPO_ROOT="$REPO_ROOT" resolve_orch_home )
[ "$FW" = "$REPO_ROOT/.claude/orchestrator-prompts" ] \
  && ok "T15: framework dogfood still resolves to .claude/orchestrator-prompts" \
  || bad "T15: framework orch-home drifted to '$FW' (dogfood broken)"

# ── SKILL.md fence portability (getff#1245) ──────────────────────────────────────────────
# The helpers were fixed in #1244; SKILL.md's own fences kept the framework literal, so the two
# halves of /pipeline read and wrote different directories in every consumer. These arms drive
# the SHIPPED file (post-transform_internal_refs), not the source, so a delivery-time rewrite
# that broke a fence would be caught here rather than in a consumer's session.
SKILL="$C/.claude/skills/pipeline/SKILL.md"
SKILL_DIR="$C/.claude/skills/pipeline"

# (4) the shipped resolver prints the agnostic home for this consumer tree
CONSUMER_HOME=$( REPO_ROOT="$C" bash "$SKILL_DIR/helpers/print-orch-home.sh" 2>/dev/null )
[ "$CONSUMER_HOME" = "$C/.ai-factory/orchestrator-prompts" ] \
  && ok "shipped print-orch-home.sh resolves to .ai-factory/orchestrator-prompts" \
  || bad "shipped print-orch-home.sh returned '$CONSUMER_HOME' (expected $C/.ai-factory/orchestrator-prompts)"

# (5) no fenced line in the shipped SKILL.md names the framework-only home
#     (mirrors packages/core/principles/39-skill-fence-orch-home.test.ts on the installed copy)
FENCE_HITS=$( awk '
  /^[[:space:]]*```/ { inf = !inf; next }
  inf && /\.claude\/orchestrator-prompts/ && !/orch-home:[[:space:]]*allow[[:space:]]+./ { print FILENAME ":" FNR ": " $0 }
' "$SKILL" )
[ -z "$FENCE_HITS" ] \
  && ok "shipped SKILL.md has no framework-only orch-home literal in any fence" \
  || bad "shipped SKILL.md fences still hardcode .claude/orchestrator-prompts: $(printf '%s' "$FENCE_HITS" | tr '\n' '|')"

# (6) end-to-end: the §1 cache fence, executed VERBATIM out of the shipped file, reads a cache
#     written under the consumer home. This is the arm the issue's "fences actually see them"
#     acceptance asks for — it executes the shipped text rather than asserting about it.
mkdir -p "$CONSUMER_HOME"
printf '## Last invocation\n- consumer-cache-sentinel\n' > "$CONSUMER_HOME/_plan-cache.md"
CACHE_FENCE=$( grep -F '_plan-cache.md' "$SKILL" | grep -F 'head -200' | head -1 )
if [ -z "$CACHE_FENCE" ]; then
  bad "could not locate the §1 plan-cache fence in the shipped SKILL.md"
else
  CACHE_OUT=$( cd "$C" && REPO_ROOT="$C" CLAUDE_SKILL_DIR="$SKILL_DIR" bash -c "$CACHE_FENCE" 2>&1 )
  printf '%s' "$CACHE_OUT" | grep -q 'consumer-cache-sentinel' \
    && ok "§1 cache fence (shipped, verbatim) reads the consumer plan cache" \
    || bad "§1 cache fence did not see the consumer cache. out: $(printf '%s' "$CACHE_OUT" | tail -2 | tr '\n' '|')"
fi

# (7) the §0 guard reaches the consumer home through the --auto sentinel (it used to be handed
#     the framework literal, whose absence short-circuited `[ -d "$dir" ] || exit 0`)
mkdir -p "$CONSUMER_HOME/7"
GUARD_OUT=$( cd "$C" && REPO_ROOT="$C" bash "$SKILL_DIR/helpers/integer-name-guard.sh" --auto 2>&1 )
GUARD_RC=$?
rmdir "$CONSUMER_HOME/7"
{ [ "$GUARD_RC" = "2" ] && printf '%s' "$GUARD_OUT" | grep -q "integer ('7')"; } \
  && ok "§0 integer-name guard fires on an integer umbrella under the consumer home" \
  || bad "§0 guard did not fire in the consumer layout (rc=$GUARD_RC out: $GUARD_OUT)"

echo "consumer-pipeline: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = "0" ]
