#!/usr/bin/env bash
# setup.d/80-rule-bootstrap.sh — rule-bootstrapping install-time step (LIVE-or-degrade).
#
# Runs the rule-bootstrapping pipeline on the consumer from the LIVE research+selection files
# the human's interactive agent session authored (agents/rule-researcher.md → two committed
# JSON files), through the deterministic factory:
#   FileResearchClient + FileGenerateClient → generate.ts factory → install() → rules-lock.json
# Payload: packages/core/install/rule-bootstrap-cli.bundle.mjs — the shared entry
# (packages/core/install/rule-bootstrap-cli.ts) prebuilt by scripts/build-runtime-bundles.mjs, so
# plain `node` runs it with no tsx and no node_modules in the getff clone. This step is the
# Option-1 gate placement — a standalone setup.d step, mirroring 05-mcp.sh's FULL gate (the
# placement fork the spike parked per kickoff §6; resolved to Option 1 at harvest time).
#
# Gated on FULL ("--full" carrier, install.sh:95+128) so the non-full / snapshot path no-ops
# → byte-identical guarantee preserved. $0-in-CI (principle 17): the consume path is a pure
# file-read (the live MCP research already happened in the human session); the CI self-install
# path never sets FULL. Degrades on absence (no node / missing CLI / no research files) and
# never aborts install (rc=0); a generator that runs and fails is reported, not swallowed.
#
# Decision B: research artefacts ABSENT → degrade + guidance, ship no rule (NEVER the stub on the
# consumer path). The stub stays the CI/test default injection only (rule-bootstrap.ts). #183.
#
# @cc-only-rationale: sourced by install.sh dispatcher, not standalone; install-time
#   orchestration in consumer context after --full dep-install.

# Gate: rule-bootstrapping only runs on the --full / yes pass.
# P2 G1: stack «generic» (no stack getff knows) gets the stack-free part only; this layer is
# npm-bound, so it is skipped and named in the NOT wired summary.
if [ "${STACK:-}" = "generic" ]; then
  note_not_wired "generated rules — not run: the rule generator writes ESLint rules, and stack «generic» has no ESLint getff placed"
  return 0 2>/dev/null || true
fi

if [ -z "${FULL:-}" ]; then
  return 0 2>/dev/null || true
fi

_rb_cli="$PKG_ROOT/packages/core/install/rule-bootstrap-cli.bundle.mjs"

if [ ! -f "$_rb_cli" ]; then
  return 0 2>/dev/null || true   # payload absent — degrade silently
fi

if ! command -v node >/dev/null 2>&1; then
  printf '  [80-rule-bootstrap] node not found — skipping (degrade-on-absent)\n'
  return 0 2>/dev/null || true
fi

_research_dir="$PROJECT_ROOT/.ai-factory/rules-research"
# Stack-keyed research pair: the install's $STACK selects the artefacts (mirrors the
# ${STACK:-ts-server} D3 notice in 99-finalize.sh:342-343). Multi-stack delivery (#827 B1):
# react-native / ts-server / react-spa each look up their own <stack>.{research,selection}.json,
# instead of the former react-next-only hardcode that silently degraded every other stack.
_plan="$_research_dir/${STACK:-ts-server}.research.json"
_sel="$_research_dir/${STACK:-ts-server}.selection.json"

if [ ! -f "$_plan" ] || [ ! -f "$_sel" ]; then
  # Decision B: degrade with the reason — never ship the stub rule on the consumer path, and never
  # a manual step (operator directive 2026-09-28, Q4.7).
  printf '  [80-rule-bootstrap] no rules-research artefacts at %s — shipping no synthesized rule this pass\n' "$_research_dir"
  printf '                      (<stack>.research.json + <stack>.selection.json come from the rule-research\n'
  printf '                      protocol, agents/rule-researcher.md, which an install does not run)\n'
  return 0 2>/dev/null || true
fi

# P5 A3: the generator writes ESLint rules and loads ESLint at run time. An oxlint or Biome project
# has none (P2 K4, 70-deps.sh), so getff brings its own toolchain OUTSIDE the project and points
# the bundle at it (GETFF_TOOLS_ROOT, scripts/build-runtime-bundles.mjs) — the project's package.json
# and node_modules are not touched (fork 1 = A). Ranges, never pins (fork 2 = B). With --global
# (GETFF_GLOBAL=1) it lives in the user cache and is reused; otherwise it is a temp directory removed
# at the end of this step (removed explicitly: this file is sourced, so it must not own an EXIT trap).
_rb_tool_pkgs=(eslint@^9 typescript-eslint typescript)
_rb_tools=""
_rb_tools_tmp=""
if ! ( cd "$PROJECT_ROOT" && node -e "require.resolve('eslint')" >/dev/null 2>&1 ); then
  if [ "${GETFF_GLOBAL:-}" = "1" ]; then
    _rb_tools="${XDG_CACHE_HOME:-$HOME/.cache}/getff/generator-tools"
  fi
  if [ -n "${DRY_RUN:-}" ]; then
    printf "  [dry-run] would: install getff's rule-generator toolchain (%s) outside the project into %s\n" \
      "${_rb_tool_pkgs[*]}" "${_rb_tools:-a temp directory removed after the run}"
  else
    [ -n "$_rb_tools" ] || { _rb_tools="$(mktemp -d)"; _rb_tools_tmp="$_rb_tools"; }
    mkdir -p "$_rb_tools"
    printf "  [80-rule-bootstrap] the project has no ESLint — installing getff's rule-generator toolchain (%s) into %s\n" \
      "${_rb_tool_pkgs[*]}" "$_rb_tools"
    _rb_npm_rc=0
    _rb_npm_out="$(npm install --prefix "$_rb_tools" --no-audit --no-fund --loglevel=error "${_rb_tool_pkgs[@]}" 2>&1)" || _rb_npm_rc=$?
    if [ "$_rb_npm_rc" -ne 0 ]; then
      _rb_npm_why="$(grep -m1 -E 'npm (error|ERR!)' <<<"$_rb_npm_out" || true)"
      [ -n "$_rb_npm_why" ] || _rb_npm_why="$(head -n 1 <<<"$_rb_npm_out")"
      printf '  ⚠ [80-rule-bootstrap] toolchain install failed (npm exit %s) — no rule was generated from your research this pass\n' "$_rb_npm_rc"
      note_not_wired "generated rules — the generator's ESLint toolchain could not be installed: ${_rb_npm_why:-npm exited $_rb_npm_rc}"
      [ -z "$_rb_tools_tmp" ] || rm -rf "$_rb_tools_tmp"
      return 0 2>/dev/null || true
    fi
    # Versions go to the report through P3's record helper when this tree has it.
    if command -v companion_record_version >/dev/null 2>&1; then
      for _rb_p in eslint typescript-eslint typescript; do
        _rb_v="$(node -p "require('$_rb_tools/node_modules/$_rb_p/package.json').version" 2>/dev/null || true)"
        companion_record_version "$_rb_p" generator-tool "${_rb_v:-not read}" "$_rb_tools/node_modules/$_rb_p/package.json"
      done
    fi
  fi
fi

if [ -n "${DRY_RUN:-}" ]; then
  printf '  [dry-run] would: run rule-bootstrap LIVE (from-research/from-selection → generate → buildLock) on %s\n' "$PROJECT_ROOT"
  return 0 2>/dev/null || true
fi

printf '  [80-rule-bootstrap] LIVE research+selection → generate → buildLock (--full, %s)\n' "${STACK:-ts-server}"
# critical-review S5-9 / N14: this used to be `cd $PKG_ROOT && npx --no-install tsx <cli>.ts`, and
# a getff clone has no node_modules — the generator died on ERR_MODULE_NOT_FOUND before generating
# anything. The prebuilt bundle inlines its dependencies and loads ESLint + the TypeScript parser
# from the PROJECT (the §8 toolchain install put them there), so it runs from the project root: the
# project's node_modules and its eslint-rules-local/ barrel resolve from the cwd.
# Still rc=0 on failure (never abort the install), but the failure is loud and lands in the final
# NOT wired summary.
_rb_rc=0
_rb_log="$(mktemp)"
( cd "$PROJECT_ROOT" && { [ -z "$_rb_tools" ] || export GETFF_TOOLS_ROOT="$_rb_tools"; } && node "$_rb_cli" \
    --consumer-root "$PROJECT_ROOT" \
    --from-research "$_plan" \
    --from-selection "$_sel" 2>&1 ) > "$_rb_log" || _rb_rc=$?
[ -z "$_rb_tools_tmp" ] || rm -rf "$_rb_tools_tmp"
cat "$_rb_log"
# P5 A2: the generator drops a research entry the plan gate refuses and keeps the rest; it names
# each drop on one line («[rule-bootstrap] dropped research entry <id> — <reason>»,
# packages/core/synthesizer/file-clients.ts FileResearchClient). Each becomes its own NOT wired line.
while IFS= read -r _rb_drop; do
  note_not_wired "generated rule for research entry ${_rb_drop%% — *} — dropped: ${_rb_drop#* — }; the other entries were generated"
done < <(sed -n 's/.*\[rule-bootstrap\] dropped research entry //p' "$_rb_log")
if [ "$_rb_rc" -eq 3 ]; then
  # rc=3 = the generator REJECTED the research artefact (rule-bootstrap-cli.ts live-arm catch); its
  # reason follows «invalid or unreadable — » on the first matching line.
  _rb_why="$(sed -n 's/.*invalid or unreadable — //p' "$_rb_log" | head -n 1)"
  printf '  ⚠ [80-rule-bootstrap] research plan REJECTED — no rule was generated from your research this pass\n'
  note_not_wired "generated rules from .ai-factory/rules-research/${STACK:-ts-server}.{research,selection}.json — research plan rejected: ${_rb_why:-reason not printed (output above, [80-rule-bootstrap])}; the preset rules still apply"
elif [ "$_rb_rc" -ne 0 ]; then
  printf '  ⚠ [80-rule-bootstrap] rule generation FAILED (exit %s) — no rule was generated from your research this pass
' "$_rb_rc"
  note_not_wired "generated rules from .ai-factory/rules-research/${STACK:-ts-server}.{research,selection}.json — the generator exited $_rb_rc (output above, [80-rule-bootstrap]); the preset rules still apply"
fi
rm -f "$_rb_log"
