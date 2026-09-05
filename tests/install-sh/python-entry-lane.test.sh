#!/usr/bin/env bash
# tests/install-sh/python-entry-lane.test.sh — the `install.sh python` / `./setup python` entry lane
# (python-delivery-v0 S2 Task 1): arg parsing, detection order, no-package.json bypass, npm flow
# untouched, --refresh re-delivery, and the post-install firing self-check (fire + tool-gated degrade).
#
# Drives the REAL install.sh in mktemp -d fixtures (subprocess, like snapshot.sh) — the entry lane
# lives in install.sh's main flow, not behind INSTALL_SH_LIB_ONLY, so a lib-only source cannot exercise
# arg-parse + detection + early-exit. The firing self-check's DEGRADE arm is unit-tested directly via
# the PY_LAYER_LIB_ONLY seam (call _py_firing_self_check with a stripped PATH → no tools).
#
# DETERMINISTIC arms (always run — the CI signal): detection matrix, no-package.json bypass, npm
# untouched, --refresh overwrite, and the tool-ABSENT degrade path (loud, never silently green).
# TOOL-GATED arm: when ast-grep / ruff are on PATH, the self-check must FIRE RED (else it degrades
# loudly — asserted either way, so the arm is never vacuous).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL="$REPO_ROOT/install.sh"
TPL="$REPO_ROOT/packages/core/templates/python"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip() { echo "  · $1"; }

[ -f "$INSTALL" ] || { echo "FATAL: $INSTALL not found"; exit 1; }

py_fixture() {  # echo a fresh temp dir seeded with a pyproject.toml (a pure Python consumer)
  local d; d=$(mktemp -d)
  printf '[project]\nname = "demo"\nversion = "0.0.1"\n' > "$d/pyproject.toml"
  echo "$d"
}

echo "▶ Python entry lane (install.sh python) — detection · bypass · refresh · self-check"
echo ""

# ── (1) fresh explicit `install.sh python` on a pure-python repo → delivers, no npm artefacts ──────
echo "  ── (1) fresh explicit: install.sh python (pyproject only, no package.json) ──"
P=$(py_fixture)
out=$( cd "$P" && bash "$INSTALL" python < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] \
  && ok "(1) exit 0 (no-package.json precondition BYPASSED — a python repo has no package.json)" \
  || bad "(1) non-zero exit $rc on a pure-python repo → precondition not bypassed: $(echo "$out" | tail -3 | tr '\n' '|')"
cmp -s "$TPL/sgconfig.yml" "$P/sgconfig.yml" \
  && ok "(1) sgconfig.yml delivered (byte-identical to template)" \
  || bad "(1) sgconfig.yml missing/differs"
[ -f "$P/.getff/astgrep-rules/getff-no-eval.yml" ] && [ -f "$P/ruff.toml" ] \
  && ok "(1) ast-grep rules dir + ruff.toml delivered" \
  || bad "(1) rules dir or ruff.toml missing"
[ ! -e "$P/package.json" ] \
  && ok "(1) no package.json fabricated on the python lane" \
  || bad "(1) package.json appeared (npm lane leaked)"
# D8 (getff-any-stack-trace S2) narrowed this arm: .ai-factory/ is now an EXPECTED agent-surface
# home on the python lane (_py_deliver_agent_surface ships skills/agents/hooks/.mcp.json/AGENTS.md
# .ai-factory/), so it is no longer a npm-leak signal. eslint.config.mjs + .husky remain genuine
# npm-layer-leak signals — the npm setup.d layer loop is the only thing that delivers them.
if [ ! -e "$P/eslint.config.mjs" ] && [ ! -e "$P/.husky" ]; then
  ok "(1) NO npm artefacts (eslint.config.mjs / .husky) — npm layer loop never ran"
else
  bad "(1) npm artefact(s) leaked onto the python lane"
fi
[ ! -e "$P/.ruff_cache" ] \
  && ok "(1) no .ruff_cache in the consumer tree (self-check writes to an OS temp dir ONLY — STOP line)" \
  || bad "(1) .ruff_cache leaked into the consumer tree (STOP-line violation)"

# ── (2) explicit `python` OVERRIDES npm auto-detect in a MIXED repo (package.json + pyproject) ─────
echo ""; echo "  ── (2) explicit override: mixed repo, install.sh python wins over npm detect ──"
P=$(mktemp -d)
printf '{"name":"m","version":"0.0.0","dependencies":{"typescript":"^5"}}\n' > "$P/package.json"
printf '[project]\nname="m"\n' > "$P/pyproject.toml"
( cd "$P" && bash "$INSTALL" python < /dev/null ) >/dev/null 2>&1
[ -f "$P/sgconfig.yml" ] && [ ! -e "$P/eslint.config.mjs" ] \
  && ok "(2) python bundle delivered + no eslint.config.mjs (explicit python beat the npm auto-detect)" \
  || bad "(2) explicit override failed: sgconfig=$( [ -f "$P/sgconfig.yml" ] && echo y || echo n ) eslint=$( [ -e "$P/eslint.config.mjs" ] && echo y || echo n )"

# ── (3) mixed repo WITHOUT the python arg → defaults to npm (no python bundle) ─────────────────────
echo ""; echo "  ── (3) mixed repo defaults npm: install.sh --dry-run (no python arg) ──"
P=$(mktemp -d)
printf '{"name":"m","version":"0.0.0","dependencies":{"typescript":"^5"}}\n' > "$P/package.json"
printf '[project]\nname="m"\n' > "$P/pyproject.toml"
( cd "$P" && bash "$INSTALL" --dry-run < /dev/null ) >/dev/null 2>&1
[ ! -e "$P/sgconfig.yml" ] \
  && ok "(3) no sgconfig.yml — a repo WITH package.json defaults to the npm lane (python not auto-taken)" \
  || bad "(3) python bundle delivered on a package.json repo without the explicit python arg"

# ── (4) pure-python auto-detect: interactive OFFER, default No (declined via EOF) → no python ──────
# Review fix 1 (S2 round 1): a bare `read` at EOF (closed stdin, non-tty) returns non-zero. install.sh
# runs under `set -euo pipefail`, so BEFORE the fix that killed the script right there with a
# message-less `exit 1` — never reaching the documented "decline → npm lane → clean no-package.json
# abort" path. RED against pre-fix code: rc was still 1, but the "No package.json found" message was
# ABSENT (the script died silently at the `read` line). GREEN (this arm): the message IS present.
echo ""; echo "  ── (4) auto-detect OFFER default No: install.sh (no arg, EOF) on pyproject-only ──"
P=$(py_fixture)
out=$( cd "$P" && bash "$INSTALL" < /dev/null 2>&1 ); rc=$?
[ ! -e "$P/sgconfig.yml" ] \
  && ok "(4) OFFER declined on EOF (default No) → python bundle NOT delivered (npm lane, then no-package.json abort)" \
  || bad "(4) python bundle delivered despite a declined OFFER"
echo "$out" | grep -qi 'Detected a Python project' \
  && ok "(4) the OFFER prompt was shown (auto-detect fired on pyproject + no package.json)" \
  || bad "(4) OFFER prompt not shown: $(echo "$out" | tr '\n' '|' | cut -c1-160)"
[ "$rc" -eq 1 ] \
  && ok "(4) exit code 1 (clean abort at the npm no-package.json precondition, not an arbitrary crash)" \
  || bad "(4) unexpected exit code $rc (expected 1): $(echo "$out" | tr '\n' '|' | cut -c1-160)"
echo "$out" | grep -qF 'No package.json found' \
  && ok "(4) EOF-safe read fell through to the clean 'No package.json found' message (fix 1: bare EOF read no longer set-e-aborts message-less)" \
  || bad "(4) 'No package.json found' message MISSING — a bare \`read\` at EOF likely set-e-aborted the script silently before reaching the npm lane: $(echo "$out" | tr '\n' '|' | cut -c1-200)"

# ── (5) pure-python auto-detect: OFFER accepted (y) → delivers ────────────────────────────────────
echo ""; echo "  ── (5) auto-detect OFFER accepted (y) → delivers ──"
P=$(py_fixture)
printf 'y\n' | ( cd "$P" && bash "$INSTALL" ) >/dev/null 2>&1
[ -f "$P/sgconfig.yml" ] \
  && ok "(5) answering 'y' to the OFFER delivered the python bundle" \
  || bad "(5) accepted OFFER did not deliver"

# ── (6) --refresh re-delivers framework-owned artefacts (overwrites a tampered rule) ──────────────
echo ""; echo "  ── (6) --refresh re-delivery: overwrites a tampered framework rule ──"
P=$(py_fixture)
( cd "$P" && bash "$INSTALL" python < /dev/null ) >/dev/null 2>&1
printf 'TAMPERED\n' >> "$P/.getff/astgrep-rules/getff-no-eval.yml"
( cd "$P" && bash "$INSTALL" python --refresh < /dev/null ) >/dev/null 2>&1
if grep -q TAMPERED "$P/.getff/astgrep-rules/getff-no-eval.yml"; then
  bad "(6) --refresh did NOT overwrite the tampered framework rule (brownfield consumer stuck on stale rules)"
else
  ok "(6) --refresh overwrote the tampered framework rule (framework-owned re-delivery)"
fi
cmp -s "$TPL/.getff/astgrep-rules/getff-no-eval.yml" "$P/.getff/astgrep-rules/getff-no-eval.yml" \
  && ok "(6) refreshed rule is byte-identical to the current template" \
  || bad "(6) refreshed rule differs from template"

# ── (7) --refresh AUTO-detects a prior python install via marker (no explicit arg) ────────────────
echo ""; echo "  ── (7) --refresh auto-detect via marker (.getff-python-install.log) ──"
printf 'TAMPER2\n' >> "$P/.getff/astgrep-rules/getff-no-os-system.yml"
( cd "$P" && bash "$INSTALL" --refresh < /dev/null ) >/dev/null 2>&1
grep -q TAMPER2 "$P/.getff/astgrep-rules/getff-no-os-system.yml" \
  && bad "(7) bare --refresh missed the python lane (marker not honoured)" \
  || ok "(7) bare --refresh auto-detected the python lane via marker + re-delivered"

# ── (7b) EXPLICIT npm-stack arg beats the python-marker auto-detect on --refresh (fix 3) ───────────
# Review fix 3 (S2 round 1): a repo carrying BOTH package.json AND a stale/prior .getff/astgrep-rules
# marker used to route `install.sh ts-server --refresh` to the python-only refresh (exit 0), silently
# SKIPPING the npm refresh the user explicitly asked for — no error, no npm artefacts touched. Fixed
# by gating the marker branch on `[ -z "$STACK_EXPLICIT" ]`: an explicit npm stack/toolchain positional
# now always wins over the marker auto-route. Pre-seed .claude/agents + .claude/skills so the npm
# do_refresh() completes cleanly (a pre-existing, unrelated "--refresh on a repo that was never
# installed" edge case would otherwise die partway through on an unrelated `cp` — out of this fix's
# scope; seeding sidesteps it without masking the fix-3 assertion).
echo ""; echo "  ── (7b) explicit npm-stack arg + python marker present → npm refresh, not python-only ──"
P=$(mktemp -d)
printf '{"name":"m","version":"0.0.0","dependencies":{"typescript":"^5"}}\n' > "$P/package.json"
mkdir -p "$P/.getff/astgrep-rules" "$P/.claude/agents" "$P/.claude/skills"
printf 'ruleDirs: []\n' > "$P/.getff/astgrep-rules/marker.yml"
out=$( cd "$P" && bash "$INSTALL" ts-server --refresh < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] \
  && ok "(7b) exit 0 — npm refresh completed" \
  || bad "(7b) unexpected exit $rc: $(echo "$out" | tail -5 | tr '\n' '|')"
echo "$out" | grep -qF 'Refreshing rules-as-tests-aif framework artefacts' \
  && ok "(7b) npm refresh banner shown (explicit ts-server arg took precedence over the python marker)" \
  || bad "(7b) npm refresh banner MISSING: $(echo "$out" | head -5 | tr '\n' '|')"
echo "$out" | grep -qF 'Refreshing getff Python toolchain' \
  && bad "(7b) WRONGLY routed to the python-only refresh despite an explicit npm stack arg (marker auto-detect beat the explicit arg)" \
  || ok "(7b) did NOT reroute to the python-only refresh (explicit stack arg precedence holds)"
[ -f "$P/.claude/agents/aif-init.md" ] \
  && ok "(7b) an actual npm artefact (.claude/agents/aif-init.md) was refreshed — the npm lane genuinely ran" \
  || bad "(7b) no npm artefact delivered — npm refresh did not actually run"

# ── (8) firing self-check: FIRES when tools present, else DEGRADES loudly (tool-gated, never green) ─
# @arm:E1:pos scratch-consumer-red-green-pair (python lane — planted violation RED + clean control GREEN)
echo ""; echo "  ── (8) firing self-check on install (tool-gated fire; loud degrade otherwise) ──"
P=$(py_fixture)
out=$( cd "$P" && bash "$INSTALL" python < /dev/null 2>&1 )
# NB: guard the `sg` alias with an ast-grep identity probe — on Linux `sg` also names
# the setgid(1) coreutil, so a bare `command -v sg` would take the "present" branch on a
# host that has NO ast-grep (CI install-sh shards), diverging from the self-check's own
# guarded detection (45-python.sh). Both must agree or the assertions below false-fire.
if command -v ast-grep >/dev/null 2>&1 || { command -v sg >/dev/null 2>&1 && sg --version 2>/dev/null | grep -qi 'ast-grep'; }; then
  echo "$out" | grep -qF 'ast-grep fired RED' \
    && ok "(8) ast-grep present → self-check FIRED RED on the planted violation" \
    || bad "(8) ast-grep present but self-check did not report a RED fire: $(echo "$out" | grep -i ast-grep | tr '\n' '|')"
  # Paired GREEN direction (adapter-jig E1): the self-check must ALSO prove the rules stay quiet on
  # conforming code — a RED-only harness passes identically under an always-firing rule set.
  echo "$out" | grep -qF 'ast-grep clean control GREEN' \
    && ok "(8) ast-grep clean control GREEN reported (rules discriminate, not always-red)" \
    || bad "(8) no ast-grep clean-control GREEN line — self-check is RED-only (vacuous vs an over-broad rule set)"
else
  echo "$out" | grep -qF 'ast-grep not on PATH' \
    && ok "(8) ast-grep absent → self-check DEGRADED loudly (not silently green)" \
    || bad "(8) ast-grep absent but no loud degrade line"
fi
if command -v ruff >/dev/null 2>&1 || command -v uvx >/dev/null 2>&1; then
  echo "$out" | grep -qF 'ruff fired RED' \
    && ok "(8) ruff present → self-check FIRED RED on the planted violation" \
    || bad "(8) ruff present but self-check did not report a RED fire: $(echo "$out" | grep -i ruff | tr '\n' '|')"
  echo "$out" | grep -qF 'ruff clean control GREEN' \
    && ok "(8) ruff clean control GREEN reported (bans discriminate, not always-red)" \
    || bad "(8) no ruff clean-control GREEN line — self-check is RED-only (vacuous vs an over-broad config)"
else
  echo "$out" | grep -qF 'ruff not on PATH' \
    && ok "(8) ruff absent → self-check DEGRADED loudly (not silently green)" \
    || bad "(8) ruff absent but no loud degrade line"
fi
echo "$out" | grep -qF 'OVER-BROAD' \
  && bad "(8) self-check reported OVER-BROAD on a healthy install (false alarm)" \
  || ok "(8) no OVER-BROAD verdict on the healthy delivered rule set"

# ── (9) DEGRADE path (unit): _py_firing_self_check with NO tools on PATH → loud, never green ───────
echo ""; echo "  ── (9) degrade path (stripped PATH, no ast-grep/ruff/uvx) ──"
P=$(py_fixture)
( cd "$P" && bash "$INSTALL" python < /dev/null ) >/dev/null 2>&1   # deliver with tools available
# Build a coreutils-only PATH that EXCLUDES every research tool, so `command -v ast-grep|sg|ruff|uvx`
# genuinely fails regardless of WHERE the runner installed them. A plain PATH="/usr/bin:/bin" is
# environment-fragile: some CI runners ship ast-grep in /usr/bin, so the strip left it reachable and
# the ast-grep lane FIRED instead of degrading — arm 9 then never exercised the both-tools-absent
# degrade summary it exists to prove (python-delivery-v0 S2 CI-only failure, 2026-07-12; passed on
# macOS where node/ast-grep live in homebrew, outside /usr/bin).
_notools="$P/.no-tools-bin"; mkdir -p "$_notools"
for _d in /usr/bin /bin /usr/local/bin /opt/homebrew/bin; do
  [ -d "$_d" ] || continue
  for _f in "$_d"/*; do
    [ -e "$_f" ] || continue
    _b=${_f##*/}
    case "$_b" in ast-grep|sg|ruff|uvx|npx|node|nodejs|pip|pip3) continue ;; esac
    [ -e "$_notools/$_b" ] || ln -s "$_f" "$_notools/$_b" 2>/dev/null || true
  done
done
deg=$(
  PROJECT_ROOT="$P" PKG_ROOT="$REPO_ROOT" INSTALL_SH_LIB_ONLY=1 NOTOOLS="$_notools" bash -c '
    source "'"$REPO_ROOT"'/setup.d/lib.sh"
    PY_LAYER_LIB_ONLY=1 source "'"$REPO_ROOT"'/setup.d/45-python.sh"
    PATH="$NOTOOLS" _py_firing_self_check
  ' 2>&1
)
echo "$deg" | grep -qF 'ast-grep not on PATH' && echo "$deg" | grep -qF 'ruff not on PATH' \
  && ok "(9) both lanes print a loud tool-absent degrade with the exact manual command" \
  || bad "(9) degrade lines missing: $(echo "$deg" | tr '\n' '|')"
echo "$deg" | grep -qiE 'NOT proven|NOT green' \
  && ok "(9) degrade summary refuses to claim green (attention-is-not-a-mechanism honesty)" \
  || bad "(9) degrade summary did not withhold the green claim"
echo "$deg" | grep -qF '@ast-grep/cli@0.44.1' && echo "$deg" | grep -qF 'ruff@0.15.21' \
  && ok "(9) manual commands carry the PINNED tool versions (@0.44.1 / ==0.15.21 lineage)" \
  || bad "(9) manual commands missing pinned versions"
[ ! -e "$P/.ruff_cache" ] \
  && ok "(9) degrade run wrote nothing under the consumer tree (temp-dir-only STOP line holds)" \
  || bad "(9) .ruff_cache leaked during the degrade run"

# ── helpers for arms (10)-(12): the python lock fingerprint recipe (45-python.sh _py_write_rules_lock)
# — sha256/16 over the sorted delivered ast-grep rule bytes + the .getff/ruff-bans.toml bytes.
_sha256_str() {  # portable sha256 of stdin (linux sha256sum / macOS shasum)
  if command -v sha256sum >/dev/null 2>&1; then sha256sum | awk '{print $1}'
  else shasum -a 256 | awk '{print $1}'; fi
}
_py_lock_fp16() {  # replicate the writer's recipe exactly (incl. command-substitution newline strip)
  local root="$1" _hi
  _hi=$( { find "$root/.getff/astgrep-rules" -name '*.yml' 2>/dev/null | sort | while IFS= read -r f; do cat "$f"; done; [ -f "$root/.getff/ruff-bans.toml" ] && cat "$root/.getff/ruff-bans.toml"; } )
  printf '%s' "$_hi" | _sha256_str | cut -c1-16
}
_file_fp16() { local _h; _h=$( cat "$1" ); printf '%s' "$_h" | _sha256_str | cut -c1-16; }

# ── (10) E2 positive — REFUSE cell: self-check + lock resolve the DELIVERED config, never the
# consumer's same-named ruff.toml (the python twin of cargo arms 5a/5b; adapter-jig E2, W4 finding-1
# class). Consumer owns a bans-less ruff.toml + pyproject [tool.ruff] → install → the self-check must
# fire via .getff/ruff-bans.toml (a resolver preferring the consumer's config would report a FALSE
# SILENT — its config has no TID bans), and the lock fingerprint must hash the DELIVERED set, not the
# consumer's file.
# @arm:E2:pos self-check-resolves-delivered-config (python REFUSE cell — fire + lock fp = delivered set)
echo ""; echo "  ── (10) REFUSE cell: self-check + lock target the DELIVERED config (E2) ──"
P=$(py_fixture)
printf '[tool.ruff]\nline-length = 120\n' >> "$P/pyproject.toml"
printf '[lint]\nselect = ["E9"]\n' > "$P/ruff.toml"   # consumer-owned, NO TID bans
CONSUMER_RUFF_BEFORE=$(cat "$P/ruff.toml")
out=$( cd "$P" && bash "$INSTALL" python < /dev/null 2>&1 ) || true
[ "$(cat "$P/ruff.toml")" = "$CONSUMER_RUFF_BEFORE" ] && [ -f "$P/getff-ruff.toml" ] \
  && ok "(10) REFUSE cell held: consumer ruff.toml untouched + getff-ruff.toml reference shipped" \
  || bad "(10) REFUSE cell wrong: consumer ruff.toml modified or getff-ruff.toml missing"
if command -v ruff >/dev/null 2>&1 || command -v uvx >/dev/null 2>&1; then
  echo "$out" | grep -qF 'ruff fired RED' \
    && ok "(10) self-check FIRED via the DELIVERED .getff/ruff-bans.toml (not the consumer's bans-less config)" \
    || bad "(10) self-check did not fire in the REFUSE cell — delivered-config resolution bug: $(echo "$out" | grep -i ruff | tr '\n' '|')"
  echo "$out" | grep -qF 'ruff did NOT fire' \
    && bad "(10) FALSE SILENT verdict — the self-check validated the consumer's config (W4 finding-1 class)" \
    || ok "(10) no false SILENT verdict in the REFUSE cell"
fi
LOCKF="$P/.getff/rules-lock.python.json"
lock_fp=$(sed -n 's/.*"sourceFingerprint": "\([0-9a-f]*\)".*/\1/p' "$LOCKF" 2>/dev/null)
want_fp=$(_py_lock_fp16 "$P")
consumer_fp=$(_file_fp16 "$P/ruff.toml")
[ -n "$lock_fp" ] && [ "$lock_fp" = "$want_fp" ] \
  && ok "(10) lock sourceFingerprint = fp16(delivered rules + .getff/ruff-bans.toml) — records the DELIVERED set" \
  || bad "(10) lock sourceFingerprint (${lock_fp:-<none>}) != recomputed delivered-set fp ($want_fp)"
[ "$lock_fp" != "$consumer_fp" ] \
  && ok "(10) lock does NOT hash the consumer's ruff.toml (the lock does not lie)" \
  || bad "(10) lock hashes the CONSUMER's ruff.toml — the lock misrepresents the delivered set"

# ── (11) E2 discriminating negative — fallback ORDERING, the latent W4-class bug this increment
# fixes: with .getff/ruff-bans.toml ABSENT (the pre-bans-file older delivery the code comment
# anticipates), a consumer-first fallback resolves the consumer's bans-less ruff.toml → planted
# violation does NOT fire → FALSE SILENT. Post-fix the getff-owned getff-ruff.toml reference copy
# wins the fallback and the self-check fires. Driven via the PY_LAYER_LIB_ONLY seam so the bans file
# can be genuinely absent (a real install always delivers it at HEAD — the bug is latent, not live).
# @arm:E2:neg self-check-resolves-delivered-config (bans file absent → getff-ruff.toml must beat consumer ruff.toml)
if command -v ruff >/dev/null 2>&1 || command -v uvx >/dev/null 2>&1; then
  echo ""; echo "  ── (11) fallback ordering: getff-ruff.toml beats the consumer's ruff.toml (E2 negative) ──"
  P=$(py_fixture)
  printf '[lint]\nselect = ["E9"]\n' > "$P/ruff.toml"          # consumer-owned, NO TID bans
  cp "$TPL/ruff.toml" "$P/getff-ruff.toml"                     # getff reference copy (has the bans)
  # NO .getff/ruff-bans.toml — the fallback cascade is what resolves.
  ordr=$(
    PROJECT_ROOT="$P" PKG_ROOT="$REPO_ROOT" INSTALL_SH_LIB_ONLY=1 bash -c '
      source "'"$REPO_ROOT"'/setup.d/lib.sh"
      PY_LAYER_LIB_ONLY=1 source "'"$REPO_ROOT"'/setup.d/45-python.sh"
      _py_firing_self_check
    ' 2>&1
  )
  echo "$ordr" | grep -qF 'ruff fired RED' \
    && ok "(11) self-check resolved the GETFF-owned getff-ruff.toml — planted violation fired" \
    || bad "(11) FALSE SILENT — fallback resolved the consumer's bans-less ruff.toml (consumer-first ordering bug): $(echo "$ordr" | grep -i ruff | tr '\n' '|')"
  echo "$ordr" | grep -qF 'ruff did NOT fire' \
    && bad "(11) explicit false-SILENT verdict printed (delivered-config resolution bug)" \
    || ok "(11) no false-SILENT verdict (getff-owned-first ordering holds)"
else
  echo ""; echo "  ── (11) SKIP fallback-ordering negative (no ruff/uvx on PATH) ──"
fi

# ── (12) E1 discriminating negative — an OVER-BROAD delivered rule set must be CAUGHT by the clean
# controls (pre-fix the RED-only self-check printed «enforcement is live» identically): an ast-grep
# rule matching EVERY expression + a bans config banning the clean control's own import (json).
# @arm:E1:neg scratch-consumer-red-green-pair (over-broad rules → clean controls RED the self-check)
if { command -v ast-grep >/dev/null 2>&1 || { command -v sg >/dev/null 2>&1 && sg --version 2>/dev/null | grep -qi 'ast-grep'; }; } \
   && { command -v ruff >/dev/null 2>&1 || command -v uvx >/dev/null 2>&1; }; then
  echo ""; echo "  ── (12) over-broad delivered rules → clean controls catch them (E1 negative) ──"
  P=$(py_fixture)
  mkdir -p "$P/.getff/astgrep-rules"
  {
    echo 'id: getff-overbroad-stub'
    echo 'language: python'
    echo 'severity: error'
    echo 'message: over-broad stub — matches every expression'
    echo 'rule:'
    echo '  pattern: $A'
  } > "$P/.getff/astgrep-rules/getff-overbroad-stub.yml"
  {
    echo '[lint]'
    echo 'select = ["TID251", "TID253"]'
    echo '[lint.flake8-tidy-imports]'
    echo 'banned-module-level-imports = ["tensorflow", "json"]'
  } > "$P/.getff/ruff-bans.toml"
  ovb=$(
    PROJECT_ROOT="$P" PKG_ROOT="$REPO_ROOT" INSTALL_SH_LIB_ONLY=1 bash -c '
      source "'"$REPO_ROOT"'/setup.d/lib.sh"
      PY_LAYER_LIB_ONLY=1 source "'"$REPO_ROOT"'/setup.d/45-python.sh"
      _py_firing_self_check
    ' 2>&1
  )
  echo "$ovb" | grep -qF 'ast-grep FIRED on the clean control' \
    && ok "(12) ast-grep clean control FIRED under the over-broad rule → detected" \
    || bad "(12) over-broad ast-grep rule NOT detected: $(echo "$ovb" | grep -i 'ast-grep' | tr '\n' '|')"
  echo "$ovb" | grep -qF 'ruff FIRED on the clean control' \
    && ok "(12) ruff clean control FIRED under the json-banning config → detected" \
    || bad "(12) over-broad ruff config NOT detected: $(echo "$ovb" | grep -i 'ruff' | tr '\n' '|')"
  echo "$ovb" | grep -qF 'OVER-BROAD' \
    && ok "(12) summary refuses the green verdict (OVER-BROAD reported)" \
    || bad "(12) summary still claimed green under always-red rules (the pre-arm false-green)"
  echo "$ovb" | grep -qF 'enforcement is live' \
    && bad "(12) «enforcement is live» printed for over-broad rules (false green)" \
    || ok "(12) no false «enforcement is live» claim"
else
  echo ""; echo "  ── (12) SKIP over-broad negative (ast-grep and/or ruff not on PATH) ──"
fi

# ── (13) D8 / S2 positive — agent surface delivered on the python lane ──────────
# Kickoff §7 host-verify contract: this arm fails when the delivered agent surface is missing.
# Without it, the lane test stays green on an S2 that ships an empty agent surface (the host-verify
# commands would all be negative/bookkeeping checks). Each assertion names a CURATED-SUBSET artefact
# from kickoff §2 item 1; failure here is the fail-closed signal the contract requires.
# D8 positive arm: agent-surface delivery (python lane — fail-closed when the curated subset is
# missing). NOTE deliberately NOT an `@arm:` marker: that locator grammar belongs to the
# adapter-jig conformance registry (principle 33, frozen F1-F11 contract per SSOT #226) — a D8
# marker here obligates a foreign registry and fails its pairing gate. Plain-comment label only.
echo ""; echo "  ── (13) D8 agent surface delivered (skills / agents / hooks / .mcp.json / AGENTS.md / .ai-factory/) ──"
P=$(py_fixture)
( cd "$P" && bash "$INSTALL" python < /dev/null ) >/dev/null 2>&1
_d8_fail=0
# Skills (4-skill curated subset — kickoff §2 item 1)
for _s in getff tool-bootstrapping rule-research rule-tests; do
  [ -f "$P/.claude/skills/$_s/SKILL.md" ] \
    && ok "(13) skill $_s/SKILL.md delivered" \
    || { bad "(13) MISSING skill: .claude/skills/$_s/SKILL.md"; _d8_fail=1; }
done
# Agents (2-agent curated subset — kickoff §2 item 1)
for _a in rule-researcher rule-test-author; do
  [ -f "$P/.claude/agents/${_a}.md" ] \
    && ok "(13) agent ${_a}.md delivered" \
    || { bad "(13) MISSING agent: .claude/agents/${_a}.md"; _d8_fail=1; }
done
# Hooks (deps-hash-check + inject-matching-rule — kickoff §2 item 1)
for _h in deps-hash-check.sh inject-matching-rule.sh; do
  [ -f "$P/.claude/hooks/$_h" ] \
    && ok "(13) hook $_h delivered" \
    || { bad "(13) MISSING hook: .claude/hooks/$_h"; _d8_fail=1; }
done
# .claude/settings.json with both hook registrations
_d8_s="$P/.claude/settings.json"
if [ ! -f "$_d8_s" ]; then
  bad "(13) MISSING .claude/settings.json"; _d8_fail=1
else
  ok "(13) .claude/settings.json present"
  grep -q 'deps-hash-check' "$_d8_s" \
    && ok "(13) deps-hash-check registered in settings.json" \
    || { bad "(13) deps-hash-check NOT registered in settings.json"; _d8_fail=1; }
  grep -q 'inject-matching-rule' "$_d8_s" \
    && ok "(13) inject-matching-rule registered in settings.json" \
    || { bad "(13) inject-matching-rule NOT registered in settings.json"; _d8_fail=1; }
fi
# .mcp.json with context7
[ -f "$P/.mcp.json" ] && grep -q '"context7"' "$P/.mcp.json" \
  && ok "(13) .mcp.json present with context7" \
  || { bad "(13) MISSING .mcp.json or context7 entry"; _d8_fail=1; }
# AGENTS.md
[ -f "$P/AGENTS.md" ] \
  && ok "(13) AGENTS.md delivered" \
  || { bad "(13) MISSING AGENTS.md"; _d8_fail=1; }
# .ai-factory/ agent-surface subtree (the artefacts AGENTS.md.template references + skill-context overrides)
for _f in .ai-factory/DESCRIPTION.md .ai-factory/ARCHITECTURE.md .ai-factory/RULES.md \
          .ai-factory/rules/integration-rules.md .ai-factory/tool-decisions.md \
          .ai-factory/skill-context/aif-review/SKILL.md .ai-factory/skill-context/aif-rules-check/SKILL.md; do
  [ -f "$P/$_f" ] \
    && ok "(13) $_f delivered" \
    || { bad "(13) MISSING: $_f"; _d8_fail=1; }
done
# Self-verifying TEETH assertion: arm (13) is fail-closed — the host-verify contract requires it.
# Verified separately by T-S2-B: a delivery WITHOUT _py_deliver_agent_surface MUST make arm (13) RED.
[ "$_d8_fail" = "0" ] \
  && ok "(13) full curated agent surface delivered — fail-closed arm held GREEN" \
  || bad "(13) agent surface incomplete — see MISSING items above (the host-verify contract fires here)"
rm -rf "$P"

# ── (14) D-S2b positive — local git pre-push rung delivered + activated + opt-out ─────────────
# Kickoff §3: hook file delivered + executable + activation present + opt-out honored. The
# verdict-driven design (SSOT #237) is bare core.hooksPath-style delivery as default. This arm
# fails-closed when the rung is missing or not activated. NOTE deliberately NOT an `@arm:` marker
# (S2 incident commit 7f21e44f19 — that grammar belongs to the adapter-jig registry, principle 33);
# plain-comment label only, parallel to arm (13).
echo ""; echo "  ── (14) D-S2b local git pre-push rung: delivered + executable + activated ──"
P=$(py_fixture)
git -C "$P" init -q
( cd "$P" && bash "$INSTALL" python < /dev/null ) >/dev/null 2>&1
_s2b_fail=0
# (a) hook file delivered
[ -f "$P/.getff/hooks/pre-push" ] \
  && ok "(14) .getff/hooks/pre-push delivered" \
  || { bad "(14) MISSING: .getff/hooks/pre-push"; _s2b_fail=1; }
# (b) hook file executable
[ -x "$P/.getff/hooks/pre-push" ] \
  && ok "(14) .getff/hooks/pre-push is executable" \
  || { bad "(14) .getff/hooks/pre-push NOT executable"; _s2b_fail=1; }
# (c) activation present — git config core.hooksPath .getff/hooks
_act=$(git -C "$P" config --get core.hooksPath 2>/dev/null || true)
[ "$_act" = ".getff/hooks" ] \
  && ok "(14) core.hooksPath=.getff/hooks activated" \
  || { bad "(14) core.hooksPath NOT set to .getff/hooks (got: ${_act:-<unset>})"; _s2b_fail=1; }
# (d) header comment carries opt-out + deletion path (kickoff §2 item 3 — documented deletion path
# + env escape, stated in the hook's header comment).
grep -q 'GETFF_SKIP_HOOKS=1' "$P/.getff/hooks/pre-push" \
  && ok "(14) header documents GETFF_SKIP_HOOKS=1 runtime opt-out" \
  || { bad "(14) header missing GETFF_SKIP_HOOKS=1 opt-out doc"; _s2b_fail=1; }
grep -qE 'rm[[:space:]]+(\.getff/hooks/pre-push|\.git/hooks)' "$P/.getff/hooks/pre-push" \
  && ok "(14) header documents deletion path" \
  || { bad "(14) header missing deletion path"; _s2b_fail=1; }

# ── (14b) D-S2b opt-out at INSTALL time (GETFF_SKIP_HOOKS=1 → no activation) ──────────────────
# Kickoff §3: opt-out honored (GETFF_SKIP_HOOKS=1 install → no activation). The load-bearing
# assertion is NO core.hooksPath mutation — the opt-out's job is to leave the consumer's git config
# untouched (the hook body MAY still be delivered; it just isn't wired into git).
echo ""; echo "  ── (14b) D-S2b install-time opt-out: GETFF_SKIP_HOOKS=1 → no activation ──"
P2=$(py_fixture)
git -C "$P2" init -q
( cd "$P2" && GETFF_SKIP_HOOKS=1 bash "$INSTALL" python < /dev/null ) >/dev/null 2>&1
_act2=$(git -C "$P2" config --get core.hooksPath 2>/dev/null || true)
[ -z "$_act2" ] \
  && ok "(14b) GETFF_SKIP_HOOKS=1 install → core.hooksPath NOT set (opt-out honored)" \
  || bad "(14b) GETFF_SKIP_HOOKS=1 install → core.hooksPath WAS set to '$_act2' (opt-out broken)"
rm -rf "$P" "$P2"

# ── (15) D-S2b RED/GREEN firing through the actual git rung (T-S2B-C — prove the rung, not the scanner) ─
# The whole point of the stage (kickoff §3): a hook delivered but never proven to fire through git
# is «coverage insufficient», not «works». We do REAL git operations: git init / commit / push
# through a local bare remote. The hook fires (or skips) via git itself, NOT via direct invocation
# of ast-grep/ruff. Tool-gated — when ast-grep + ruff are both absent the arm is SKIP (the rung
# would fail-OPEN; the RED/GREEN assertion is vacuous without the tools).
echo ""; echo "  ── (15) D-S2b RED/GREEN firing through actual git push (T-S2B-C) ──"
if { command -v ast-grep >/dev/null 2>&1 || { command -v sg >/dev/null 2>&1 && sg --version 2>/dev/null | grep -qi 'ast-grep'; }; } \
   && { command -v ruff >/dev/null 2>&1 || command -v uvx >/dev/null 2>&1; }; then
  # Build a fixture WITH a bare remote so git push has a destination (pre-push needs a real push).
  P3=$(py_fixture)
  git -C "$P3" init -q
  git -C "$P3" config user.email test@test.test
  git -C "$P3" config user.name test
  git -C "$P3" config commit.gpgsign false
  ( cd "$P3" && bash "$INSTALL" python < /dev/null ) >/dev/null 2>&1
  REMOTE=$(mktemp -d)
  git init -q --bare "$REMOTE"
  git -C "$P3" remote add origin "$REMOTE"
  # Initial clean commit + push — this is the GREEN control (the rung allows a clean push).
  printf 'print("hello")\n' > "$P3/clean.py"
  git -C "$P3" add clean.py
  git -C "$P3" commit -q -m "initial clean"
  BR=$(git -C "$P3" symbolic-ref --short HEAD 2>/dev/null || echo main)
  if git -C "$P3" push -q origin "$BR" 2>push_err; then
    ok "(15) GREEN control: clean push succeeded (rung allowed it)"
  else
    bad "(15) GREEN control FAILED — clean push blocked: $(cat push_err | tr '\n' '|')"
    _s2b_fail=1
  fi
  # RED: plant a violation the shipped rules catch (os.system — getff-no-os-system.yml).
  # Then commit + push → the pre-push hook MUST fire and block the push (non-zero exit).
  printf 'import os\nos.system("echo pwned")\n' > "$P3/bad.py"
  git -C "$P3" add bad.py
  git -C "$P3" commit -q -m "plant violation"
  if git -C "$P3" push -q origin "$BR" 2>push_red; then
    bad "(15) RED run FAILED — push with planted violation SUCCEEDED (rung did not fire)"
    _s2b_fail=1
  else
    # Push blocked — assert our hook is what fired (output mentions getff). T-S2B-C counter: prove
    # the rung fired via git, not the scanner directly.
    # NOTE: capture into a variable first. Piping the group straight into grep is self-defeating
    # under `set -o pipefail` (line 15): the re-push legitimately exits non-zero (the rung blocks
    # it — that IS the assertion), so the pipeline's status is 1 even when grep matches, and the
    # arm can never go green in the RED case it exists to prove. Caught on the host 2026-08-07;
    # invisible in the container, where the arm SKIPs for want of ast-grep/ruff (T14).
    _red_out=$( { cat push_red; git -C "$P3" push origin "$BR" 2>&1; } || true )
    if printf '%s\n' "$_red_out" | grep -qi 'getff pre-push'; then
      ok "(15) RED run: planted violation blocked the push via the getff rung (hook fired through git)"
    else
      bad "(15) RED run: push blocked but getff hook output not found: $(cat push_red | tr '\n' '|')"
      _s2b_fail=1
    fi
  fi
  # SKIP-RUN: GETFF_SKIP_HOOKS=1 must let the violation through (runtime opt-out honored).
  if GETFF_SKIP_HOOKS=1 git -C "$P3" push -q origin "$BR" 2>push_skip; then
    ok "(15) SKIP-RUN: GETFF_SKIP_HOOKS=1 push succeeded (runtime opt-out honored)"
  else
    bad "(15) SKIP-RUN FAILED — GETFF_SKIP_HOOKS=1 push blocked anyway: $(cat push_skip | tr '\n' '|')"
    _s2b_fail=1
  fi
  rm -rf "$P3" "$REMOTE" push_err push_red push_skip
else
  echo "  · (15) SKIP RED/GREEN git-push fixture (ast-grep and/or ruff not on PATH)"
  echo "    └─ the rung would fail-OPEN; the RED/GREEN assertion is vacuous without the tools."
fi

# ── (16) D-S2b integration arm — consumer with existing hooks is NEVER clobbered (T-S2B-B) ─────
# Kickoff §3 mandatory fixture: pre-set core.hooksPath OR .pre-commit-config.yaml OR legacy
# .git/hooks/pre-push → install → consumer's setup still works, getff rung integrated or cleanly
# declined WITH a printed notice — never silently broken. Three cases per verdict-driven design.
echo ""; echo "  ── (16) D-S2b integration arm (3 cases: existing core.hooksPath / pre-commit / legacy .git/hooks) ──"

# Case 1: existing core.hooksPath is preserved (declined with notice).
P4=$(py_fixture); git -C "$P4" init -q
git -C "$P4" config core.hooksPath .my-hooks
out1=$( cd "$P4" && bash "$INSTALL" python < /dev/null 2>&1 )
_act3=$(git -C "$P4" config --get core.hooksPath 2>/dev/null || true)
[ "$_act3" = ".my-hooks" ] \
  && ok "(16a) case 1: existing core.hooksPath='.my-hooks' preserved (NOT overwritten)" \
  || bad "(16a) case 1 FAILED: core.hooksPath='$_act3' (expected '.my-hooks')"
echo "$out1" | grep -qi 'NOT overwriting\|NOT activated' \
  && ok "(16a) case 1: printed notice (consumer informed)" \
  || bad "(16a) case 1: no notice printed (silently broken): $(echo "$out1" | grep -i hook | tr '\n' '|')"
[ -f "$P4/.getff/hooks/pre-push" ] \
  && ok "(16a) case 1: getff hook body still delivered to .getff/hooks/pre-push" \
  || bad "(16a) case 1: getff hook body NOT delivered (declined too hard)"
rm -rf "$P4"

# Case 2: existing .pre-commit-config.yaml → fragment appended (idempotent on re-install).
P5=$(py_fixture)
printf 'repos:\n  - repo: https://github.com/pre-commit/pre-commit-hooks\n    rev: v4.6.0\n    hooks:\n      - id: trailing-whitespace\n' > "$P5/.pre-commit-config.yaml"
out2=$( cd "$P5" && bash "$INSTALL" python < /dev/null 2>&1 )
grep -q 'getff-python-pre-push' "$P5/.pre-commit-config.yaml" \
  && ok "(16b) case 2: getff entry appended to .pre-commit-config.yaml" \
  || bad "(16b) case 2 FAILED: getff entry NOT appended: $(echo "$out2" | grep -i 'pre-commit\|getff' | tr '\n' '|')"
# Idempotency: re-run install — no duplicate entry (Task 5: marker-grep prevents duplication).
# Count the unique marker line (one per append) — NOT the substring 'getff-python-pre-push',
# which appears 3× per append (marker + SKIP= comment + id: line) and would mask a duplication.
( cd "$P5" && bash "$INSTALL" python < /dev/null ) >/dev/null 2>&1
_count=$(grep -c 'delivered by setup.d/45-python.sh' "$P5/.pre-commit-config.yaml")
[ "$_count" = "1" ] \
  && ok "(16b) case 2 idempotency: re-install did not duplicate the entry ($_count marker line)" \
  || bad "(16b) case 2 idempotency FAILED: $_count marker lines (expected 1)"
# core.hooksPath NOT set (pre-commit owns hooks — augment-first means don't compete).
git -C "$P5" init -q 2>/dev/null
_act4=$(git -C "$P5" config --get core.hooksPath 2>/dev/null || true)
[ -z "$_act4" ] \
  && ok "(16b) case 2: core.hooksPath NOT touched (pre-commit owns hooks)" \
  || bad "(16b) case 2: core.hooksPath='$_act4' set anyway (would compete with pre-commit)"
rm -rf "$P5"

# Case 3: existing .git/hooks/pre-push file (no core.hooksPath) → declined with notice.
P6=$(py_fixture); git -C "$P6" init -q
mkdir -p "$P6/.git/hooks"
printf '#!/bin/sh\nexit 0\n' > "$P6/.git/hooks/pre-push"
chmod +x "$P6/.git/hooks/pre-push"
out3=$( cd "$P6" && bash "$INSTALL" python < /dev/null 2>&1 )
_act5=$(git -C "$P6" config --get core.hooksPath 2>/dev/null || true)
[ -z "$_act5" ] \
  && ok "(16c) case 3: core.hooksPath NOT set (legacy hook not clobbered)" \
  || bad "(16c) case 3 FAILED: core.hooksPath='$_act5' set anyway (legacy hook bypassed)"
[ -f "$P6/.git/hooks/pre-push" ] \
  && ok "(16c) case 3: legacy .git/hooks/pre-push preserved (NOT overwritten)" \
  || bad "(16c) case 3 FAILED: legacy .git/hooks/pre-push REMOVED (T-S2B-B violation)"
echo "$out3" | grep -qi 'existing git hook.*pre-push' \
  && ok "(16c) case 3: printed notice naming the existing pre-push (consumer informed)" \
  || bad "(16c) case 3: no notice printed (silently broken): $(echo "$out3" | grep -i hook | tr '\n' '|')"
rm -rf "$P6"

# ── (16d) A2-2 paired-negative: ANY existing executable hook must keep firing (never-clobber) ──
# git-config(1): once core.hooksPath is set, git looks for hooks in that directory INSTEAD of
# $GIT_DIR/hooks — so activating our rung over a consumer that has .git/hooks/pre-commit (or
# commit-msg, post-checkout, …) silently disables every one of them, contradicting the
# never-clobber contract in 45-python.sh's own docstring. The pre-fix code only ever looked for
# .git/hooks/pre-push, so this arm is RED against it.
# Firing proof goes THROUGH git (a real `git commit`), not a file-existence check — a hook that
# exists but never runs is exactly the defect.
echo ""; echo "  ── (16d) A2-2: existing .git/hooks/pre-commit still fires after install ──"
P7=$(py_fixture); git -C "$P7" init -q
git -C "$P7" config user.email t@example.com; git -C "$P7" config user.name t
mkdir -p "$P7/.git/hooks"
printf '#!/bin/sh\n: > .pre-commit-fired\nexit 0\n' > "$P7/.git/hooks/pre-commit"
chmod +x "$P7/.git/hooks/pre-commit"
out4=$( cd "$P7" && bash "$INSTALL" python < /dev/null 2>&1 )
_act6=$(git -C "$P7" config --get core.hooksPath 2>/dev/null || true)
[ -z "$_act6" ] \
  && ok "(16d) core.hooksPath NOT set over an existing .git/hooks/pre-commit" \
  || bad "(16d) FAILED: core.hooksPath='$_act6' — every existing .git/hooks/* is now dead"
( cd "$P7" && git add -A >/dev/null 2>&1; git commit -q -m probe >/dev/null 2>&1 ); _c_rc=$?
[ -f "$P7/.pre-commit-fired" ] \
  && ok "(16d) existing pre-commit FIRED through git after install (never-clobber contract held)" \
  || bad "(16d) FAILED: pre-commit did NOT fire after install (commit rc=$_c_rc) — silently disabled"
echo "$out4" | grep -qi 'existing git hook' \
  && ok "(16d) printed notice naming the existing hook(s) (consumer informed)" \
  || bad "(16d) no notice printed (silently declined): $(echo "$out4" | grep -i hook | tr '\n' '|')"
[ -f "$P7/.getff/hooks/pre-push" ] \
  && ok "(16d) getff hook body still delivered to .getff/hooks/pre-push" \
  || bad "(16d) getff hook body NOT delivered (declined too hard)"
rm -rf "$P7"

# ── (16e) A2-2 worktree shape: `.git` is a FILE, hooks live in the common dir ──────────────────
# In a linked worktree the literal `-f .git/hooks/pre-push` test is FALSE even when the repo HAS
# that hook, and `git config core.hooksPath` writes the SHARED config — so the pre-fix code
# disabled the main checkout's hooks from inside a worktree. `git rev-parse --git-path hooks`
# is the only correct way to reach the real hook directory. RED against pre-fix code.
echo ""; echo "  ── (16e) A2-2: linked worktree resolves hooks via git rev-parse --git-path ──"
P8M=$(py_fixture); git -C "$P8M" init -q
git -C "$P8M" config user.email t@example.com; git -C "$P8M" config user.name t
git -C "$P8M" add -A >/dev/null 2>&1; git -C "$P8M" commit -q -m init >/dev/null 2>&1
mkdir -p "$P8M/.git/hooks"
printf '#!/bin/sh\nexit 0\n' > "$P8M/.git/hooks/pre-push"; chmod +x "$P8M/.git/hooks/pre-push"
P8=$(mktemp -d)/wt
if git -C "$P8M" worktree add -q "$P8" -b wtprobe >/dev/null 2>&1; then
  [ -f "$P8/.git" ] \
    && ok "(16e) fixture is a real linked worktree (.git is a FILE)" \
    || bad "(16e) fixture is not a linked worktree — arm would be vacuous"
  ( cd "$P8" && bash "$INSTALL" python < /dev/null ) >/dev/null 2>&1
  _act7=$(git -C "$P8" config --get core.hooksPath 2>/dev/null || true)
  [ -z "$_act7" ] \
    && ok "(16e) core.hooksPath NOT set from inside the worktree (shared config untouched)" \
    || bad "(16e) FAILED: core.hooksPath='$_act7' written to the SHARED config — main checkout's pre-push is now dead"
  [ -x "$P8M/.git/hooks/pre-push" ] \
    && ok "(16e) main checkout's .git/hooks/pre-push preserved" \
    || bad "(16e) main checkout's .git/hooks/pre-push removed"
  git -C "$P8M" worktree remove --force "$P8" >/dev/null 2>&1 || true
else
  bad "(16e) could not create the linked-worktree fixture (arm did not run)"
fi
rm -rf "$P8M"

# Self-verifying TEETH assertion: arms (14)-(16) are fail-closed — T14 (a green install with the
# hook delivered-but-never-fired is «coverage insufficient», not «works»). The RED run in arm (15)
# is the mandatory firing proof.
[ "$_s2b_fail" = "0" ] \
  && ok "(14-16) local git rung delivered + activated + integrated — fail-closed arm held GREEN" \
  || bad "(14-16) local git rung delivery/activation issues — see MISSING items above"

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
