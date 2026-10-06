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
# → byte-identical guarantee preserved (the read-only research lines for the record, below, run on
# every pass but only when a research file exists, which no snapshot fixture has). $0-in-CI (principle 17): the consume path is a pure
# file-read (the live MCP research already happened in the human session); the CI self-install
# path never sets FULL. Degrades on absence (no node / missing CLI / no research files) and
# never aborts install (rc=0); a generator that runs and fails is reported, not swallowed.
#
# Decision B: research artefacts ABSENT → degrade + guidance, ship no rule (NEVER the stub on the
# consumer path). The stub stays the CI/test default injection only (rule-bootstrap.ts). #183.
#
# @cc-only-rationale: sourced by install.sh dispatcher, not standalone; install-time
#   orchestration in consumer context after --full dep-install.

_rb_cli="$PKG_ROOT/packages/core/install/rule-bootstrap-cli.bundle.mjs"

# P5 B: the research lines the rule table (scripts/prove-rules.mjs) reads, for the project-checks record
# (99-finalize.sh adds RESEARCH_EXTRA to it; no record file of its own):
#   research-dropped: <id> — <the plan gate's reason>   research-only: <id>[ — <reason>]
#   research-rejected: <reason>   (the gate refused the whole plan)
# They come from the generator's read-only --check-plan (no ESLint needed, nothing written), on every pass
# that finds a research file, so a pass without --full rewrites the record with them too.
# $1 = plan, $2 = selection ('' = none: every kept entry is research-only), $3 = a reason for those.
RESEARCH_EXTRA=()
_rb_record_research() {
  local out rc=0 err line
  { [ -f "$_rb_cli" ] && command -v node >/dev/null 2>&1; } || return 0
  err=$(mktemp)
  out=$( cd "$PROJECT_ROOT" && node "$_rb_cli" --consumer-root "$PROJECT_ROOT" --check-plan "$1" ${2:+--from-selection "$2"} 2>"$err" ) || rc=$?
  if [ "$rc" -eq 3 ]; then
    line=$(sed -n 's/.*research plan rejected — //p' "$err" | head -n 1)
    RESEARCH_EXTRA+=("research-rejected: ${line:-reason not printed}")
  elif [ "$rc" -eq 0 ]; then
    while IFS= read -r line; do
      [ -z "$line" ] || RESEARCH_EXTRA+=("$line")
    done < <(printf '%s' "$out" | node -e '
      let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
        let j; try { j = JSON.parse(s); } catch { return; }
        const why = process.argv[1];
        for (const d of j.dropped || []) console.log(`research-dropped: ${d.id} — ${d.reason}`);
        for (const id of j.researchOnly || []) console.log(`research-only: ${id}${why ? ` — ${why}` : ""}`);
      });' "${3:-}")
  fi
  rm -f "$err"
}

# W2 (one-button, stack-detect-by-files): this layer is gated on the project's LINTER + a drivable
# lint command, NOT on the stack. The generator writes ESLint-format rules and brings its own
# toolchain OUTSIDE the project's dependencies (the _rb_tool_pkgs install below), so the project's
# PRESET was never the real precondition — its lint command is. The stack name (STACK_NAME, the
# honest _detect_stack_name answer; ${STACK:-} fallback keeps preset installs and stand-alone
# sourcing on their pre-W2 key) only keys the research artefacts
# (.ai-factory/rules-research/<name>.{research,selection}.json) and names itself in NOT-wired
# lines. Entry condition (plan §3.3): project_linter answers eslint or oxlint AND scripts.lint is
# a non-empty string — «drivable» is exactly what scripts/prove-rules.mjs lintShape requires (its
# realLint drives `npm run lint`; kind 'none' when scripts.lint is absent or blank). Every
# gated-out case is named with its reason (entry 26 point 4: promise only what was run):
#   no package.json → no lint command exists to drive the generated rules with
#   linter none     → no ESLint/oxlint in scripts.lint's first word or a linter config file
#   linter biome    → getff's generator writes ESLint-format rules and has no GritQL output lane
#                     for Biome (W2 §4c fork 2, operator decision 2026-10-06: the gap is getff's,
#                     not Biome's — Biome CAN hold generated rules as GritQL plugins, re-verified
#                     from Biome's own docs at W2 time, PR body quotes the docs; revisit when a
#                     separately scoped GritQL backend is accepted or a compatible getff backend
#                     is demonstrated — not via Biome's future JS/TS plugin API)
#   no scripts.lint → a linter config alone is not drivable: the proof drives `npm run lint`.
#                     getff never adds a lint command of its own to a lint-less project (W2 §4c
#                     fork 1, operator decision 2026-10-06 = B: the project's setup wins); this
#                     NOT-wired line is the decided answer, never a new scripts.lint key.
_rb_key="${STACK_NAME:-${STACK:-generic}}"
[ "$_rb_key" = "unknown" ] && _rb_key="generic"
_rb_linter="${LINTER_SLOT:-$(project_linter "$PROJECT_ROOT")}"
_rb_note=""
if [ -n "${STACK_NAME:-}" ] && [ "$STACK_NAME" != "generic" ] && [ "$STACK_NAME" != "$STACK" ]; then
  _rb_note=" (detected stack: $STACK_NAME — getff has no preset for it)"
fi
if [ ! -f "$PROJECT_ROOT/package.json" ]; then
  printf '  [80-rule-bootstrap] generated rules — not run: the project has no package.json, so there is no lint command to drive them\n'
  note_not_wired "generated rules — not run: the project has no package.json, so there is no lint command to drive them"
  _rb_g="$PROJECT_ROOT/.ai-factory/rules-research/generic.research.json"
  [ ! -f "$_rb_g" ] || _rb_record_research "$_rb_g" "" "no package.json: no lint command to drive generated rules"
  return 0 2>/dev/null || true
fi
if [ "$_rb_linter" = "biome" ]; then
  printf '  [80-rule-bootstrap] generated rules — not run: this project lints with Biome; getff has no GritQL output lane for Biome (its generated rules are ESLint-format)%s\n' "$_rb_note"
  note_not_wired "generated rules — not run: this project lints with Biome; getff has no GritQL output lane for Biome (its generated rules are ESLint-format), so none run here; Biome stays the project's only linter$_rb_note"
  _rb_r="$PROJECT_ROOT/.ai-factory/rules-research/$_rb_key"
  [ ! -f "$_rb_r.research.json" ] || _rb_record_research "$_rb_r.research.json" "" "linter biome: getff has no GritQL output lane (generated rules are ESLint-format)"
  return 0 2>/dev/null || true
fi
if [ "$_rb_linter" = "none" ]; then
  printf '  [80-rule-bootstrap] generated rules — not run: no ESLint or oxlint in this project (no lint script naming one, no config file for one)%s\n' "$_rb_note"
  note_not_wired "generated rules — not run: no ESLint or oxlint in this project (no lint script naming one, no config file for one), so there is nothing here to run generated rules$_rb_note"
  _rb_r="$PROJECT_ROOT/.ai-factory/rules-research/$_rb_key"
  [ ! -f "$_rb_r.research.json" ] || _rb_record_research "$_rb_r.research.json" "" "no ESLint or oxlint in the project"
  return 0 2>/dev/null || true
fi
if [ -z "$(project_lint_command "$PROJECT_ROOT")" ]; then
  printf '  [80-rule-bootstrap] generated rules — not run: this project has no lint command in package.json (scripts.lint) for the proof to drive%s\n' "$_rb_note"
  note_not_wired "generated rules — not run: this project has no lint command in package.json (scripts.lint) for the proof to drive, so no generated rule can be exercised here$_rb_note"
  _rb_r="$PROJECT_ROOT/.ai-factory/rules-research/$_rb_key"
  [ ! -f "$_rb_r.research.json" ] || _rb_record_research "$_rb_r.research.json" "" "no scripts.lint: no lint command for the proof to drive"
  return 0 2>/dev/null || true
fi
_rb_r="$PROJECT_ROOT/.ai-factory/rules-research/$_rb_key"
if [ -f "$_rb_r.research.json" ]; then
  if [ -f "$_rb_r.selection.json" ]; then _rb_record_research "$_rb_r.research.json" "$_rb_r.selection.json" ""
  else _rb_record_research "$_rb_r.research.json" "" "no selection file: nothing was chosen for generation"; fi
fi

# Gate: rule-bootstrapping only runs on the --full / yes pass.
if [ -z "${FULL:-}" ]; then
  return 0 2>/dev/null || true
fi

if [ ! -f "$_rb_cli" ]; then
  return 0 2>/dev/null || true   # payload absent — degrade silently
fi

if ! command -v node >/dev/null 2>&1; then
  printf '  [80-rule-bootstrap] node not found — skipping (degrade-on-absent)\n'
  return 0 2>/dev/null || true
fi

_research_dir="$PROJECT_ROOT/.ai-factory/rules-research"
# Name-keyed research pair (W2): the install's detected/explicit NAME selects the artefacts
# ($_rb_key — STACK_NAME where the install named the stack, ${STACK:-} fallback otherwise;
# mirrors the D3 notice in 99-finalize.sh). Multi-stack delivery (#827 B1): react-native /
# ts-server / react-spa each look up their own <stack>.{research,selection}.json, instead of the
# former react-next-only hardcode that silently degraded every other stack; W2 adds the named
# no-preset stacks (astro / svelte-kit / …) and generic to the same lookup.
_plan="$_research_dir/$_rb_key.research.json"
_sel="$_research_dir/$_rb_key.selection.json"

if [ ! -f "$_plan" ] || [ ! -f "$_sel" ]; then
  # Decision B: degrade with the reason — never ship the stub rule on the consumer path, and never
  # a manual step (operator directive 2026-09-28, Q4.7).
  printf '  [80-rule-bootstrap] no rules-research artefacts at %s — shipping no synthesized rule this pass\n' "$_research_dir"
  printf '                      (<stack>.research.json + <stack>.selection.json come from the rule-research\n'
  printf '                      protocol, agents/rule-researcher.md, which an install does not run)\n'
  return 0 2>/dev/null || true
fi

# P5 A3: the generator writes ESLint rules and loads ESLint at run time. An oxlint or Biome project
# has none (P2 K4, 70-deps.sh), so getff brings its own toolchain OUTSIDE the project's dependencies and
# points the bundle at it (GETFF_TOOLS_ROOT, scripts/build-runtime-bundles.mjs) — the project's package.json
# and its installed packages are not touched (fork 1 = A). Ranges, never pins (fork 2 = B). Where it lives:
# see the P6 run 2 N1 block below (node_modules/.cache, else the user cache under --global, else a temp
# directory removed at the end of this step — removed explicitly: this file is sourced, so no EXIT trap).
_rb_tool_pkgs=(eslint@^9 typescript-eslint typescript)
_rb_tools=""
_rb_tools_tmp=""
# P6 F1 (2026-09-30): asking only for `eslint` let an ESLint that getff's own @typescript-eslint/utils
# pulled into an oxlint project count as the generator's toolchain — no parser, 0 rules generated.
# The project's set counts only when EVERY module the bundle loads from the project resolves the way
# the bundle resolves it (scripts/build-runtime-bundles.mjs «rule generator» fromProject — kept equal
# by tests/install-sh/generator-tools-root.test.sh arm K), TypeScript resolves from the parser, and its
# ESLint major is the one getff installs itself (_rb_tool_pkgs[0]). Anything else — a partial set, or
# another major — gets getff's toolchain, and the bundle then loads the whole set from it.
_rb_eslint_major="${_rb_tool_pkgs[0]#eslint@^}"
_rb_why_tools="$(cd "$PROJECT_ROOT" && node - "$_rb_eslint_major" 2>&1 <<'JS'
const { createRequire } = require('node:module');
const { join, dirname } = require('node:path');
const { existsSync, readFileSync } = require('node:fs');
const r = createRequire(join(process.cwd(), 'package.json'));
const res = (id, via) => {
  try { return r.resolve(id); } catch {}
  if (via) { try { return createRequire(r.resolve(via + '/package.json')).resolve(id); } catch {} }
  return '';
};
const need = [['eslint'], ['eslint/use-at-your-own-risk'], ['@typescript-eslint/parser', 'typescript-eslint'], ['@typescript-eslint/utils', 'typescript-eslint']];
const found = {};
for (const [id, via] of need) {
  found[id] = res(id, via);
  if (!found[id]) { console.log(`'${id}' does not resolve from the project`); process.exit(0); }
}
try { createRequire(found['@typescript-eslint/parser']).resolve('typescript'); }
catch { console.log("'typescript' does not resolve from the project's @typescript-eslint/parser"); process.exit(0); }
let d = dirname(found.eslint), v = '';
for (; d !== dirname(d); d = dirname(d)) {
  const p = join(d, 'package.json');
  if (existsSync(p)) { const j = JSON.parse(readFileSync(p, 'utf8')); if (j.name === 'eslint') { v = j.version; break; } }
}
if (String(v).split('.')[0] !== process.argv[2]) console.log(`eslint ${v || '(version not read)'} is not ${process.argv[2]}.x, the major the generator runs with`);
JS
)" || _rb_why_tools="the toolchain probe failed: ${_rb_why_tools:-node exited non-zero}"
if [ -n "$_rb_why_tools" ]; then
  # P6 run 2 N1 (2026-09-30): the generated rules' mutation check needs the same parser at every push, so the
  # toolchain must outlive the install. It goes in the project's node_modules/.cache — where tools keep their
  # caches — which git, the linters, prettier, tsc and the test runners skip, so no ignore line and no
  # package.json key is written. Without node_modules: the user cache under --global, else a temp directory;
  # scripts/run-generated-rule-mutation.sh installs it into node_modules/.cache when a clone lacks it.
  if [ -d "$PROJECT_ROOT/node_modules" ]; then
    _rb_tools="$PROJECT_ROOT/node_modules/.cache/getff/generator-tools"
  elif [ "${GETFF_GLOBAL:-}" = "1" ]; then
    _rb_tools="${XDG_CACHE_HOME:-$HOME/.cache}/getff/generator-tools"
  fi
  if [ -n "${DRY_RUN:-}" ]; then
    printf "  [dry-run] would: install getff's rule-generator toolchain (%s), no package.json key, into %s\n" \
      "${_rb_tool_pkgs[*]}" "${_rb_tools:-a temp directory removed after the run}"
  else
    [ -n "$_rb_tools" ] || { _rb_tools="$(mktemp -d)"; _rb_tools_tmp="$_rb_tools"; }
    mkdir -p "$_rb_tools"
    printf "  [80-rule-bootstrap] the project's ESLint cannot run the generator (%s) — installing getff's rule-generator toolchain (%s) into %s\n" \
      "$_rb_why_tools" "${_rb_tool_pkgs[*]}" "$_rb_tools"
    _rb_npm_rc=0
    rm -f "$_rb_tools/.complete"   # written back only after a clean install (scripts/run-generated-rule-mutation.sh reads it)
    _rb_npm_out="$(npm install --prefix "$_rb_tools" --no-audit --no-fund --loglevel=error "${_rb_tool_pkgs[@]}" 2>&1)" || _rb_npm_rc=$?
    if [ "$_rb_npm_rc" -ne 0 ]; then
      _rb_npm_why="$(grep -m1 -E 'npm (error|ERR!)' <<<"$_rb_npm_out" || true)"
      [ -n "$_rb_npm_why" ] || _rb_npm_why="$(head -n 1 <<<"$_rb_npm_out")"
      printf '  ⚠ [80-rule-bootstrap] toolchain install failed (npm exit %s) — no rule was generated from your research this pass\n' "$_rb_npm_rc"
      note_not_wired "generated rules — the generator's ESLint toolchain could not be installed: ${_rb_npm_why:-npm exited $_rb_npm_rc}"
      [ -z "$_rb_tools_tmp" ] || rm -rf "$_rb_tools_tmp"
      return 0 2>/dev/null || true
    fi
    : > "$_rb_tools/.complete"
    # Versions go to the report through P3's record helper when this tree has it.
    if command -v companion_record_version >/dev/null 2>&1; then
      for _rb_p in eslint typescript-eslint typescript; do
        _rb_v="$(node -p "require('$_rb_tools/node_modules/$_rb_p/package.json').version" 2>/dev/null || true)"
        # The record is committed: a toolchain inside the project is named relative to its root (P6 run 4
        # N11 — rows carried this machine's absolute path); one outside it (--global's user cache) keeps its path.
        _rb_from="$_rb_tools/node_modules/$_rb_p/package.json"
        case "$_rb_from" in "$PROJECT_ROOT"/*) _rb_from="${_rb_from#"$PROJECT_ROOT"/}" ;; esac
        companion_record_version "$_rb_p" generator-tool "${_rb_v:-not read}" "$_rb_from"
      done
    fi
  fi
fi

if [ -n "${DRY_RUN:-}" ]; then
  printf '  [dry-run] would: run rule-bootstrap LIVE (from-research/from-selection → generate → buildLock) on %s\n' "$PROJECT_ROOT"
  return 0 2>/dev/null || true
fi

printf '  [80-rule-bootstrap] LIVE research+selection → generate → buildLock (--full, %s)\n' "$_rb_key"
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
# packages/core/synthesizer/file-clients.ts FileResearchClient). Each becomes its own NOT wired line; only a
# generator that exited 0 generated the other entries (a failure has its own line below).
_rb_rest=""
[ "$_rb_rc" -ne 0 ] || _rb_rest="; the other entries were generated"
while IFS= read -r _rb_drop; do
  note_not_wired "generated rule for research entry ${_rb_drop%% — *} — dropped: ${_rb_drop#* — }$_rb_rest"
done < <(sed -n 's/.*\[rule-bootstrap\] dropped research entry //p' "$_rb_log")
if [ "$_rb_rc" -eq 3 ]; then
  # rc=3 = the generator REJECTED the research artefact (rule-bootstrap-cli.ts live-arm catch); its
  # reason follows «invalid or unreadable — » on the first matching line.
  _rb_why="$(sed -n 's/.*invalid or unreadable — //p' "$_rb_log" | head -n 1)"
  printf '  ⚠ [80-rule-bootstrap] research plan REJECTED — no rule was generated from your research this pass\n'
  note_not_wired "generated rules from .ai-factory/rules-research/${_rb_key}.{research,selection}.json — research plan rejected: ${_rb_why:-reason not printed (output above, [80-rule-bootstrap])}; the preset rules still apply"
elif [ "$_rb_rc" -ne 0 ]; then
  printf '  ⚠ [80-rule-bootstrap] rule generation FAILED (exit %s) — no rule was generated from your research this pass
' "$_rb_rc"
  note_not_wired "generated rules from .ai-factory/rules-research/${_rb_key}.{research,selection}.json — the generator exited $_rb_rc (output above, [80-rule-bootstrap]); the preset rules still apply"
fi
rm -f "$_rb_log"

# P6 run 2 N1: the generated rules' mutation check is a check getff adds to the push. The project's record always
# lists it (P2's project-hook checks, 99-finalize arms it only if it exits 0); here it runs once on the material
# this pass generated, so a red or unable-to-run check — getff's own defect, never the project's code — is said
# loudly at generation time. GEN_MUT_RC carries the exit code to the arm pass, so the check does not run twice.
unset GEN_MUT_RC GEN_MUT_WHY
if [ "$_rb_rc" -eq 0 ] && [ -f "$PROJECT_ROOT/.ai-factory/synthesizer-output/rules-manifest-additions.json" ] \
   && [ -f "$PROJECT_ROOT/scripts/run-generated-rule-mutation.sh" ]; then
  _rb_mut_log="$(mktemp)"; _rb_mut_rc=0
  ( cd "$PROJECT_ROOT" && bash scripts/run-generated-rule-mutation.sh ) > "$_rb_mut_log" 2>&1 || _rb_mut_rc=$?
  _rb_mut_sum="$(grep -m1 -E '^=== overall: ' "$_rb_mut_log" || true)"
  export GEN_MUT_RC="$_rb_mut_rc"
  if [ "$_rb_mut_rc" -eq 0 ]; then
    printf '  ✓ [80-rule-bootstrap] generated rules pass their mutation check %s\n' "${_rb_mut_sum:+($_rb_mut_sum)}"
  else
    if [ "$_rb_mut_rc" -eq 2 ]; then
      GEN_MUT_WHY="it cannot run: $(sed -n 's/^run-generated-rule-mutation: //p' "$_rb_mut_log" | head -n 1)"
    else
      GEN_MUT_WHY="getff's generated material fails it: ${_rb_mut_sum:-$(tail -n 1 "$_rb_mut_log")}"
    fi
    export GEN_MUT_WHY
    sed 's/^/    /' "$_rb_mut_log"
    printf '  ✗ [80-rule-bootstrap] the generated rules FAILED their mutation check (exit %s) — %s\n' "$_rb_mut_rc" "$GEN_MUT_WHY"
    note_not_wired "the generated rules' mutation check (bash scripts/run-generated-rule-mutation.sh) — $GEN_MUT_WHY; the rules stay in your lint, and the check stays not armed, so it blocks no push"
  fi
  rm -f "$_rb_mut_log"
  unset _rb_mut_log _rb_mut_rc _rb_mut_sum
fi
