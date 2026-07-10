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

echo "consumer-pipeline: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = "0" ]
