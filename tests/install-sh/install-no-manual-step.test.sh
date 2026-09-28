#!/usr/bin/env bash
# install-no-manual-step.test.sh — the getff install never hands the person running it a manual step
# (operator directive 2026-09-28, decision Q4.7). What the install cannot do goes to the «NOT wired»
# summary with what is missing and why — never with «do X yourself».
#
# #1868 applied this to the ESLint config path. This file covers the rest of the JS/TS install
# output: the git-hooks activation, the non-ESLint tool configs kept by copy_unless_foreign, a
# legacy eslintrc next to the flat config, the summary header and the kept-files list, the closing
# «Next steps» block (replaced by what the install itself checked), the dependency install, and the
# jq-less JSON writes (a node fallback). The predicate is tests/install-sh/lib/manual-step.sh.
#
# Arms:
#   U  lib.sh: json_edit_node writes JSON without jq (register_cc_hook + context7 in .mcp.json),
#      leaves a file that is not a JSON object untouched, note_getff_added records a file once,
#      and with neither jq nor node the hook lands in the NOT-wired list with its reason;
#   N  a fresh ts-server install in a git repo, no --full: no manual step anywhere; the hooks are
#      reported active from `git config`, audit-ai-docs.sh was run by the install, the dependency
#      install is a NOT-wired line with its reason, and there is no «Next steps» list;
#   H  the consumer's own core.hooksPath: kept, reported with the reason and no command;
#   S  a subdirectory install: no hooks command, the reason names the git toplevel;
#   G  not a git repository: no hooks command, the reason says so;
#   P  the consumer's own .prettierrc: prettier reported not wired, no «merge … into it»;
#   L  a legacy .eslintrc.json beside the placed flat config: reported, no «port your rules»;
#   K  the consumer's own .husky hooks: kept, a NOT-wired line naming the checks that do not run;
#   A  the project's own scripts/audit-ai-docs.sh: not executed, and the install still finishes;
#   V  husky v9 (core.hooksPath=.husky/_): kept and reported active, never «not active»;
#   O  @opentelemetry/* with AIF_STRICT_RUNTIME unset: R8 unarmed is a NOT-wired line;
#   W  the R2 wirer on a config getff placed: an unrecognised shape, or no --full and no terminal,
#      is a NOT-wired line with the wirer's reason, never an «Add to / Add manually» snippet;
#   R  the predicate: a positive control, a negative control, and a sweep of the installer source;
#   F  --full with a package manager that fails: the dependency line says the install failed,
#      the degraded banner points at the NOT-wired list, not at a manual step.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
# shellcheck source=tests/install-sh/lib/manual-step.sh
. "$REPO_ROOT/tests/install-sh/lib/manual-step.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT INT TERM

# The not-wired summary: its header, then one «- …» line per piece, up to the blank line that ends it.
not_wired() { awk '/NOT wired, or wired only in part/{on=1; next} on && /^[[:space:]]*$/{exit} on' "$1"; }
# no_manual <arm> <log> — the whole install output hands no manual step back.
no_manual() {
  local lines
  lines=$(manual_step_lines "$2")
  [ -z "$lines" ] && ok "$1: nothing in the install output asks for a manual step" \
    || bad "$1: the install still asks for a manual step: $(printf '%s\n' "$lines" | head -3 | tr '\n' '|')"
}
# project <dir> [git] — a minimal package.json project, a git repo unless $2 = nogit.
project() {
  mkdir -p "$1"
  printf '{ "name": "nms", "version": "0.0.0" }\n' > "$1/package.json"
  [ "${2:-git}" = nogit ] || git -C "$1" init -q
}
install_into() { # <dir> <log> <args…>
  local d="$1" log="$2"; shift 2
  ( cd "$d" && bash "$REPO_ROOT/install.sh" "$@" </dev/null ) >"$log" 2>&1
}

# ── U: JSON writes without jq ──────────────────────────────────────────────────────────────────
NOJQ="$WORK/nojq-bin"; NONODE="$WORK/nonode-bin"; mkdir -p "$NOJQ" "$NONODE"
for t in bash sh cat mv rm cp grep sed awk mkdir dirname basename tr head tail printf env mktemp chmod; do
  p=$(command -v "$t" 2>/dev/null) || continue
  case "$p" in /*) ln -s "$p" "$NOJQ/$t"; ln -s "$p" "$NONODE/$t" ;; esac
done
ln -s "$(command -v node)" "$NOJQ/node"
(
  # shellcheck disable=SC1090
  INSTALL_SH_LIB_ONLY=1 source "$REPO_ROOT/setup.d/lib.sh"
  NOT_WIRED=()
  s="$WORK/u/.claude/settings.json"; mkdir -p "${s%/*}"
  printf '{ "hooks": { "Stop": [ { "hooks": [ { "type": "command", "command": "mine.sh" } ] } ] } }\n' > "$s"
  out=$(PATH="$NOJQ" register_cc_hook "$s" Stop "bash .claude/hooks/eot.sh" eot.sh 2>&1)
  node -e 'const s = require(process.argv[1]); const c = s.hooks.Stop.flatMap(g => g.hooks.map(h => h.command));
    process.exit(c.includes("mine.sh") && c.includes("bash .claude/hooks/eot.sh") ? 0 : 1)' "$s" \
    && echo "OK register_cc_hook without jq appends the hook through node and keeps the existing one" \
    || echo "BAD register_cc_hook without jq: $(printf '%s' "$out" | tr '\n' '|') — settings: $(tr '\n' ' ' < "$s")"
  before=$(cat "$s")
  PATH="$NOJQ" register_cc_hook "$s" Stop "bash .claude/hooks/eot.sh" eot.sh >/dev/null 2>&1
  [ "$before" = "$(cat "$s")" ] && echo "OK a second jq-less register_cc_hook changes nothing" \
    || echo "BAD a second jq-less register_cc_hook changed settings.json"
  PATH="$NOJQ" register_cc_hook "$s" SubagentStart "bash .claude/hooks/eot.sh" eot.sh >/dev/null 2>&1
  node -e 'const s = require(process.argv[1]); process.exit((s.hooks.SubagentStart || []).length === 1 ? 0 : 1)' "$s" \
    && echo "OK jq-less idempotence is per event, as with jq" || echo "BAD jq-less register_cc_hook skipped a second event"
  m="$WORK/u/.mcp.json"; printf '{ "mcpServers": { "mine": { "command": "x" } } }\n' > "$m"
  PATH="$NOJQ" add_context7_mcp "$m" >/dev/null 2>&1
  node -e 'const m = require(process.argv[1]); process.exit(m.mcpServers.mine && m.mcpServers.context7 ? 0 : 1)' "$m" \
    && echo "OK add_context7_mcp without jq adds context7 and keeps the other servers" \
    || echo "BAD add_context7_mcp without jq: $(tr '\n' ' ' < "$m")"
  # Negative controls: a file that is not a JSON object stays byte-identical, leaves no .tmp behind,
  # and the hook is a NOT-wired line — never a partial write, never «✓ registered».
  for bad_json in '{ "hooks": ' '[]'; do
    b="$WORK/u/bad-$(printf '%s' "$bad_json" | tr -cd '[:alnum:]')x/.claude/settings.json"; mkdir -p "${b%/*}"
    printf '%s\n' "$bad_json" > "$b"; before=$(cat "$b"); nw_before=${#NOT_WIRED[@]}
    PATH="$NOJQ" register_cc_hook "$b" Stop "bash .claude/hooks/eot.sh" eot.sh > "$WORK/u-bad.out" 2>&1
    [ "$before" = "$(cat "$b")" ] && [ ! -e "$b.tmp" ] \
      && echo "OK a settings.json holding «$bad_json» stays byte-identical, no .tmp left" \
      || echo "BAD a settings.json holding «$bad_json» was changed: $(tr '\n' ' ' < "$b")"
    [ "${#NOT_WIRED[@]}" -gt "$nw_before" ] && ! grep -q '✓' "$WORK/u-bad.out" \
      && echo "OK a settings.json holding «$bad_json» makes the hook a NOT-wired line" \
      || echo "BAD a settings.json holding «$bad_json»: no NOT-wired line, output: $(tr '\n' '|' < "$WORK/u-bad.out")"
  done
  # One entry per file: in a multi-stack monorepo the per-workspace synth-wire and the R2 wirer can
  # both add getff's block to the same consumer config, and the summary listed it twice.
  GETFF_ADDED_TO=()
  note_getff_added apps/api/eslint.config.mjs; note_getff_added apps/api/eslint.config.mjs
  note_getff_added eslint.config.js
  [ "${#GETFF_ADDED_TO[@]}" -eq 2 ] && echo "OK note_getff_added records each file once" \
    || echo "BAD note_getff_added: ${#GETFF_ADDED_TO[@]} entries for 2 files: ${GETFF_ADDED_TO[*]-}"
  n="$WORK/u/none/.claude/settings.json"; mkdir -p "${n%/*}"; printf '{}\n' > "$n"
  # Not in $( ): a command substitution is a subshell, and its NOT_WIRED entry would be lost.
  PATH="$NONODE" register_cc_hook "$n" Stop "bash .claude/hooks/eot.sh" eot.sh > "$WORK/u-none.out" 2>&1
  out=$(cat "$WORK/u-none.out")
  printf '%s\n' "${NOT_WIRED[@]-}" | grep -q 'eot.sh' \
    && echo "OK with neither jq nor node the hook is a NOT-wired line" || echo "BAD no NOT-wired line without jq and node"
  printf '%s\n%s\n' "$out" "${NOT_WIRED[@]-}" > "$WORK/u.log"
  asks_by_hand "$WORK/u.log" && echo "BAD the jq-less path asks for a manual edit: $(manual_step_lines "$WORK/u.log" | head -1)" \
    || echo "OK the jq-less path asks for no manual edit"
) > "$WORK/u.out" 2>&1
while IFS= read -r l; do
  case "$l" in "OK "*) ok "U: ${l#OK }" ;; "BAD "*) bad "U: ${l#BAD }" ;; esac
done < "$WORK/u.out"
grep -qE '^(OK|BAD) ' "$WORK/u.out" || bad "U: the lib.sh arm printed nothing: $(tail -3 "$WORK/u.out" | tr '\n' '|')"

# ── N: fresh ts-server install, git repo, no --full ───────────────────────────────────────────
N="$WORK/fresh"; project "$N"
install_into "$N" "$WORK/n.log" ts-server; rc=$?
[ "$rc" -eq 0 ] && ok "N: the install exits 0" || bad "N: the install exited $rc: $(tail -3 "$WORK/n.log" | tr '\n' '|')"
no_manual N "$WORK/n.log"
grep -q '^Next steps:' "$WORK/n.log" && bad "N: the install still prints a «Next steps» list" || ok "N: no «Next steps» list"
grep -qE '✓ git hooks active — core\.hooksPath=\.husky' "$WORK/n.log" \
  && ok "N: the install reports the hooks active from git config" || bad "N: no «git hooks active» line read from git config"
grep -qE '✓ scripts/audit-ai-docs\.sh — [0-9]+ PASS, 0 FAIL' "$WORK/n.log" \
  && ok "N: the install ran audit-ai-docs.sh itself and reports its result" || bad "N: no audit-ai-docs.sh result in the install output"
not_wired "$WORK/n.log" | grep -E '^[[:space:]]*- dependencies' | grep -q 'not installed' \
  && ok "N: the dependency install is a NOT-wired line with its reason" \
  || bad "N: no NOT-wired line for the dependencies: $(not_wired "$WORK/n.log" | head -3 | tr '\n' '|')"
grep -q 'npm install --save-dev' "$WORK/n.log" && bad "N: the install still prints an npm install command to copy" \
  || ok "N: no dependency command to copy"
grep -q 'each line says why and what to do' "$WORK/n.log" && bad "N: the summary header still promises «what to do»" \
  || ok "N: the summary header does not promise «what to do»"

# ── H: the consumer's own core.hooksPath ────────────────────────────────────────────────────
H="$WORK/own-hooks"; project "$H"; git -C "$H" config core.hooksPath .githooks
install_into "$H" "$WORK/h.log" ts-server
[ "$(git -C "$H" config core.hooksPath)" = .githooks ] && ok "H: core.hooksPath=.githooks kept" \
  || bad "H: core.hooksPath repointed to $(git -C "$H" config core.hooksPath)"
not_wired "$WORK/h.log" | grep 'git hooks' | grep -q "\.githooks" \
  && ok "H: the NOT-wired line names the consumer's hooksPath" || bad "H: no NOT-wired line naming .githooks"
grep -q 'git config core.hooksPath' "$WORK/h.log" && bad "H: the install still prints a git config command" \
  || ok "H: no git config command printed"
no_manual H "$WORK/h.log"

# ── S: subdirectory install ──────────────────────────────────────────────────────────────────
S="$WORK/sub"; mkdir -p "$S"; git -C "$S" init -q; project "$S/web" nogit
install_into "$S/web" "$WORK/s.log" ts-server
not_wired "$WORK/s.log" | grep 'git hooks' | grep -q 'toplevel' \
  && ok "S: the NOT-wired line says the install root is not the git toplevel" || bad "S: no NOT-wired hooks line naming the toplevel"
grep -q 'git config core.hooksPath' "$WORK/s.log" && bad "S: the install still prints a git config command" \
  || ok "S: no git config command printed"
no_manual S "$WORK/s.log"

# ── G: not a git repository ──────────────────────────────────────────────────────────────────
G="$WORK/nogit"; project "$G" nogit
install_into "$G" "$WORK/g.log" ts-server
not_wired "$WORK/g.log" | grep 'git hooks' | grep -q 'not a git repository' \
  && ok "G: the NOT-wired line says the project is not a git repository" || bad "G: no NOT-wired hooks line for a non-git project"
no_manual G "$WORK/g.log"

# ── P: the consumer's own .prettierrc ────────────────────────────────────────────────────────
P="$WORK/own-prettier"; project "$P"; printf '{ "semi": false }\n' > "$P/.prettierrc"
install_into "$P" "$WORK/p.log" ts-server
[ "$(cat "$P/.prettierrc")" = '{ "semi": false }' ] && ok "P: the consumer's .prettierrc is byte-identical" \
  || bad "P: the consumer's .prettierrc changed"
not_wired "$WORK/p.log" | grep -q '^[[:space:]]*- prettier' \
  && ok "P: prettier is a NOT-wired line" || bad "P: no NOT-wired line for prettier"
no_manual P "$WORK/p.log"

# ── L: a legacy .eslintrc.json beside the placed flat config ─────────────────────────────────
L="$WORK/legacy"; project "$L"; printf '{ "rules": { "no-console": "error" } }\n' > "$L/.eslintrc.json"
install_into "$L" "$WORK/l.log" ts-server
not_wired "$WORK/l.log" | grep -q '\.eslintrc\.json' \
  && ok "L: the legacy eslintrc is a NOT-wired line" || bad "L: no NOT-wired line for .eslintrc.json"
no_manual L "$WORK/l.log"

# ── K: the consumer's own .husky hooks ───────────────────────────────────────────────────────
K="$WORK/own-husky"; project "$K"; mkdir -p "$K/.husky"
for _h in pre-commit pre-push; do printf '#!/bin/sh\necho own-%s\n' "$_h" > "$K/.husky/$_h"; done
install_into "$K" "$WORK/k.log" ts-server
for _h in pre-commit pre-push; do
  grep -q "own-$_h" "$K/.husky/$_h" && ok "K: the consumer's .husky/$_h is kept" || bad "K: the consumer's .husky/$_h was overwritten"
  not_wired "$WORK/k.log" | grep "\.husky/$_h" | grep -q 'runs none of the framework' \
    && ok "K: the kept .husky/$_h is a NOT-wired line saying the framework checks do not run" \
    || bad "K: no NOT-wired line for the kept .husky/$_h"
done
no_manual K "$WORK/k.log"

# ── A: the project's own scripts/audit-ai-docs.sh ───────────────────────────────────────────
# The install runs the audit only when getff placed the script: a file the project already had
# is its own code, and copy_safe kept it. The planted script exits 1 with no output and leaves a
# marker when it runs — before the fix it ran, and its silent failure aborted a finished install.
A="$WORK/own-audit"; project "$A"; mkdir -p "$A/scripts"
printf '#!/bin/sh\ntouch "$(dirname "$0")/../AUDIT_RAN"\nexit 1\n' > "$A/scripts/audit-ai-docs.sh"
install_into "$A" "$WORK/a.log" ts-server; rc=$?
[ "$rc" -eq 0 ] && ok "A: the install exits 0 over the project's own audit script" \
  || bad "A: the install exited $rc: $(tail -3 "$WORK/a.log" | tr '\n' '|')"
grep -q '^For full guide' "$WORK/a.log" && ok "A: the install reaches its last line" \
  || bad "A: the install stopped before «For full guide»"
[ -e "$A/AUDIT_RAN" ] && bad "A: the install executed the project's own scripts/audit-ai-docs.sh" \
  || ok "A: the project's own audit script was not executed"
grep -qE '· scripts/audit-ai-docs\.sh — not run: .*project' "$WORK/a.log" \
  && ok "A: the checked block says the project's own audit script was not run, and why" \
  || bad "A: no «not run» line for the project's own audit script"
no_manual A "$WORK/a.log"

# ── V: husky v9 — core.hooksPath=.husky/_ already set ─────────────────────────────────────────
V="$WORK/husky9"; project "$V"; git -C "$V" config core.hooksPath .husky/_
install_into "$V" "$WORK/v.log" ts-server
[ "$(git -C "$V" config core.hooksPath)" = .husky/_ ] && ok "V: core.hooksPath=.husky/_ kept" \
  || bad "V: core.hooksPath repointed to $(git -C "$V" config core.hooksPath)"
grep -qE '✓ git hooks active — core\.hooksPath=\.husky/_' "$WORK/v.log" \
  && ok "V: the checked block reports the husky v9 hooks active" \
  || bad "V: the checked block does not report .husky/_ active: $(grep 'git hooks' "$WORK/v.log" | tail -1)"
grep -q 'git hooks — not active' "$WORK/v.log" && bad "V: the checked block says the hooks are not active" \
  || ok "V: no false «not active» line"

# ── O: @opentelemetry/* with AIF_STRICT_RUNTIME unset ─────────────────────────────────────────
O="$WORK/otel"; mkdir -p "$O"; git -C "$O" init -q
printf '{ "name": "nms", "version": "0.0.0", "dependencies": { "@opentelemetry/api": "^1.0.0" } }\n' > "$O/package.json"
( cd "$O" && unset AIF_STRICT_RUNTIME; bash "$REPO_ROOT/install.sh" ts-server </dev/null ) >"$WORK/o.log" 2>&1
not_wired "$WORK/o.log" | grep 'R8' | grep -q 'AIF_STRICT_RUNTIME is unset' \
  && ok "O: R8 unarmed is a NOT-wired line with its reason" || bad "O: no NOT-wired line for the unarmed R8"
grep -qE 'Set AIF_STRICT_RUNTIME=1 to' "$WORK/o.log" && bad "O: the install still tells the reader to set AIF_STRICT_RUNTIME" \
  || ok "O: no «Set AIF_STRICT_RUNTIME=1» instruction"
no_manual O "$WORK/o.log"

# ── R: the predicate itself — it fires on every wording the installer used, never on a fact ────
# A positive control: each line below is a manual step the installer printed at some point; a
# predicate that stops matching one of them would let an arm above pass on a real step.
_miss=0
while IFS= read -r _l; do
  [ -z "$_l" ] && continue
  printf '%s\n' "$_l" > "$WORK/r.line"
  asks_by_hand "$WORK/r.line" || { _miss=1; bad "R: the predicate misses a known manual step: $_l"; }
done <<'LINES'
  ⚠ ruff not on PATH — firing NOT proven (degrade, NOT green). Verify manually:
   protocol (agents/rule-researcher.md / the rule-research skill), then ./setup --full. Presets
    ↳ NEXT (consumer runtime step, not install-time): when you bring up
   Set AIF_STRICT_RUNTIME=1 to arm runtime-discipline rules (R7/R8).
  [05-mcp] context7 already in .mcp.json — skipping (use --force to refresh)
  ⊝ stryker/api.json (exists — skipping; use --force to overwrite)
  ⚠ .gitignore exists without a node_modules line. Consider adding node_modules/ to .gitignore
⚠  self-verify: 2/3 passed, 1 FAILED — review output above before committing
    consumer-owned — never overwritten; review the diff and decide.
  · kept (locally modified): x — review whether it is still wanted.
    delivered workflow uses 'main' — edit .github/workflows/ci.yml if your default differs
  keep core.hooksPath=.husky or remove the competing manager's hooks.
[profile] core (refresh keeps the depth already on disk; pass --profile env to deepen)
  never writes, sweeps, or prunes here; stale entries stay until you remove them.
    -y installs into the project only; a machine-global install needs --global or a yes at the prompt
  ⊝ runtime-bridge skipped — -y installs into the project only, re-run with --global to allow it
  - framework pre-commit shield — your own .husky/pre-commit is kept; to add them, call from it: npx lint-staged
LINES
[ "$_miss" -eq 0 ] && ok "R: the predicate fires on every known manual-step wording (positive control)"
# A negative control: fact lines the install prints must not read as steps.
_miss=0
while IFS= read -r _l; do
  [ -z "$_l" ] && continue
  printf '%s\n' "$_l" > "$WORK/r.line"
  asks_by_hand "$WORK/r.line" && { _miss=1; bad "R: the predicate flags a fact line as a manual step: $_l"; }
done <<'LINES'
  - framework git hooks (.husky/) — not active: core.hooksPath=.githooks, and getff does not repoint a hook setup the repository already has
  ✓ git hooks active — core.hooksPath=.husky
  · npm run validate — not run: it runs this project's own lint, typecheck and tests
  ⊝ .eslintrc.json (exists — skipping)
LINES
[ "$_miss" -eq 0 ] && ok "R: the predicate passes fact lines (negative control)"
# A source sweep: every printed line in the JS/TS install path, not only the lines the arms above
# reach. Comment lines are not output. The toolchain lanes and the aif-handoff / runtime-bridge
# guided flows still carry steps and are outside this sweep until their own Q4.7 pass lands.
_sweep=$(cd "$REPO_ROOT" && for f in install.sh setup setup.d/*.sh; do
  case "$f" in (setup.d/45-python.sh|setup.d/46-cargo.sh|setup.d/47-go.sh|setup.d/aif-handoff-guided-install.sh|setup.d/bridge-guided.sh) continue ;; esac
  manual_step_lines "$f" | grep -vE '^[[:space:]]*#' | sed "s|^|$f: |"
done)
[ -z "$_sweep" ] && ok "R: no line in install.sh, setup or setup.d (JS/TS path) hands back a manual step" \
  || bad "R: installer source still prints a manual step: $(printf '%s\n' "$_sweep" | head -5 | cut -c1-160 | tr '\n' '|')"

# ── W: the R2 wirer on a config getff placed ─────────────────────────────────────────────────
# 99-finalize's _r2_wire_cfg runs the wirer's plain mode on a per-package config getff delivered.
# Without --full and without a terminal, or on an export shape the wirer does not recognise, that
# mode printed an «Add to <cfg> … / Add manually» snippet. Driven through the real function with the
# real wirer (tsx + ts-morph from this checkout's node_modules, read only, never installed into).
W="$WORK/r2own"; mkdir -p "$W/apps/api"
ln -s "$REPO_ROOT/node_modules" "$W/node_modules"
eval "$(sed -n '/^_r2_route_not_wired() {/,/^}/p;/^_r2_wire_cfg() {/,/^}/p' "$REPO_ROOT/setup.d/99-finalize.sh")"
# w_case <name> <config source> <reason> — run _r2_wire_cfg on apps/api/eslint.config.mjs, no --full,
# no tty; the NOT-wired line must carry the wirer's own reason, not the generic fallback.
w_case() {
  printf '%s\n' "$2" > "$W/apps/api/eslint.config.mjs"
  (
    # shellcheck disable=SC1090
    INSTALL_SH_LIB_ONLY=1 source "$REPO_ROOT/setup.d/lib.sh"
    NOT_WIRED=(); GETFF_ADDED_TO=()
    getff_delivered() { return 0; }
    PROJECT_ROOT="$W" PKG_ROOT="$REPO_ROOT" FULL=""
    _r2_wire_cfg "$W/apps/api/eslint.config.mjs" "$REPO_ROOT/packages/core/install/wire-eslint-r2.ts" </dev/null >"$WORK/w-$1.out" 2>&1
    printf '%s\n' ${NOT_WIRED[@]+"${NOT_WIRED[@]}"} >"$WORK/w-$1.nw"
  )
  grep '^R2 .* — ' "$WORK/w-$1.nw" | grep -q "$3" && ok "W $1: R2 left out of a getff-placed config is a NOT-wired line with its reason" \
    || bad "W $1: no NOT-wired R2 line: out=$(head -3 "$WORK/w-$1.out" | tr '\n' '|')"
  no_manual "W $1" "$WORK/w-$1.out"
}
w_case unrecognised 'import makeConfig from "./preset.mjs";
export default makeConfig();' 'does not recognise'
w_case unconfirmed 'export default [];' 'without a terminal'

# ── F: --full, the package manager fails ────────────────────────────────────────────────────
STUB="$WORK/stub-fail"; mkdir -p "$STUB"
printf '#!/bin/sh\nexit 1\n' > "$STUB/npm"; cp "$STUB/npm" "$STUB/pnpm"; cp "$STUB/npm" "$STUB/yarn"
chmod +x "$STUB/npm" "$STUB/pnpm" "$STUB/yarn"
F="$WORK/full-fail"; project "$F"
( cd "$F" && PATH="$STUB:$PATH" bash "$REPO_ROOT/install.sh" ts-server --full </dev/null ) >"$WORK/f.log" 2>&1; rc=$?
[ "$rc" -ne 0 ] && ok "F: a --full install whose dependencies failed still exits non-zero" || bad "F: rc 0 on failed dependencies"
not_wired "$WORK/f.log" | grep -E '^[[:space:]]*- dependencies' | grep -q 'failed' \
  && ok "F: the dependency NOT-wired line says the install failed" \
  || bad "F: no NOT-wired dependency line saying it failed: $(not_wired "$WORK/f.log" | grep dependencies | head -1)"
grep -q 'step 4' "$WORK/f.log" && bad "F: the degraded banner still points at «step 4»" || ok "F: the banner points at no numbered step"
grep -q 'dependencies did NOT fully install' "$WORK/f.log" && ok "F: the degraded banner says the dependencies did not install" \
  || bad "F: no «dependencies did NOT fully install» banner — the non-zero exit came from somewhere else"
grep -q '^For full guide' "$WORK/f.log" && ok "F: the install reaches its last line before exiting non-zero" \
  || bad "F: the install stopped before «For full guide»"
no_manual F "$WORK/f.log"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
