#!/usr/bin/env bash
# setup.d/80-rule-bootstrap.sh — rule-bootstrapping install-time step (LIVE-or-degrade).
#
# Runs the rule-bootstrapping pipeline on the consumer from the LIVE research+selection files
# the human's interactive agent session authored (agents/rule-researcher.md → two committed
# JSON files), through the deterministic factory:
#   FileResearchClient + FileGenerateClient → generate.ts factory → install() → rules-lock.json
# Payload: packages/core/install/rule-bootstrap-cli.ts (the shared entry). This step is the
# Option-1 gate placement — a standalone setup.d step, mirroring 05-mcp.sh's FULL gate (the
# placement fork the spike parked per kickoff §6; resolved to Option 1 at harvest time).
#
# Gated on FULL ("--full" carrier, install.sh:57+64) so the non-full / snapshot path no-ops
# → byte-identical guarantee preserved. $0-in-CI (principle 17): the consume path is a pure
# file-read (the live MCP research already happened in the human session); the CI self-install
# path never sets FULL. Degrades on absence (no node / missing CLI / no research files) and
# never aborts install (rc=0).
#
# Decision B: research artefacts ABSENT → degrade + guidance, ship no rule (NEVER the stub on the
# consumer path). The stub stays the CI/test default injection only (rule-bootstrap.ts). #183.
#
# @cc-only-rationale: sourced by install.sh dispatcher, not standalone; install-time
#   orchestration in consumer context after --full dep-install.

# Gate: rule-bootstrapping only runs on the --full / yes pass.
if [ -z "${FULL:-}" ]; then
  return 0 2>/dev/null || true
fi

_rb_cli="$PKG_ROOT/packages/core/install/rule-bootstrap-cli.ts"

if [ ! -f "$_rb_cli" ]; then
  return 0 2>/dev/null || true   # payload absent — degrade silently
fi

if ! command -v node >/dev/null 2>&1; then
  printf '  [80-rule-bootstrap] node not found — skipping (degrade-on-absent)\n'
  return 0 2>/dev/null || true
fi

_research_dir="$PROJECT_ROOT/.ai-factory/rules-research"
# Stack-keyed research pair: the install's $STACK selects the artefacts (mirrors the
# ${STACK:-ts-server} D3 notice in 99-finalize.sh:49-50). Multi-stack delivery (#827 B1):
# react-native / ts-server / react-spa each look up their own <stack>.{research,selection}.json,
# instead of the former react-next-only hardcode that silently degraded every other stack.
_plan="$_research_dir/${STACK:-ts-server}.research.json"
_sel="$_research_dir/${STACK:-ts-server}.selection.json"

if [ ! -f "$_plan" ] || [ ! -f "$_sel" ]; then
  # Decision B: degrade + guidance — never ship the stub rule on the consumer path.
  printf '  [80-rule-bootstrap] no rules-research artefacts at %s\n' "$_research_dir"
  printf '  [80-rule-bootstrap] run the rule-research protocol (agents/rule-researcher.md or the\n'
  printf '                      rule-research skill) to author <stack>.research.json + <stack>.selection.json,\n'
  printf '                      then re-run ./setup --full. Shipping no synthesized rule this pass.\n'
  return 0 2>/dev/null || true
fi

if [ -n "${DRY_RUN:-}" ]; then
  printf '  [dry-run] would: run rule-bootstrap LIVE (from-research/from-selection → generate → buildLock) on %s\n' "$PROJECT_ROOT"
  return 0 2>/dev/null || true
fi

# B4 (#827): guarantee the factory's workspace deps (@rules-as-tests/*) resolve from PKG_ROOT
# before invoking the factory (defined in lib.sh — sourced in dispatcher scope). No-op on the
# happy path (properly-installed checkout); self-heals a borrowed/dangling worktree node_modules.
ensure_workspace_pkg_links "$PKG_ROOT"

printf '  [80-rule-bootstrap] LIVE research+selection → generate → buildLock (--full, %s)\n' "${STACK:-ts-server}"
# Run tsx from PKG_ROOT (the framework — tsx is present there) while targeting the consumer
# via --consumer-root, so this works even when the consumer has no tsx of its own.
( cd "$PKG_ROOT" && npx --no-install tsx "$_rb_cli" \
    --consumer-root "$PROJECT_ROOT" \
    --from-research "$_plan" \
    --from-selection "$_sel" 2>&1 ) || true  # rc=0: never abort install
