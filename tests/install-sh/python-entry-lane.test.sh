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
if [ ! -e "$P/eslint.config.mjs" ] && [ ! -e "$P/.husky" ] && [ ! -e "$P/.ai-factory" ]; then
  ok "(1) NO npm artefacts (eslint.config.mjs / .husky / .ai-factory) — npm layer loop never ran"
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

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
