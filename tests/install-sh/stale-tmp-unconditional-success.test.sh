#!/usr/bin/env bash
# stale-tmp-unconditional-success.test.sh — ledger A1-9 (PR #1597 local review).
#
# The A1-8 class (fixed for merge_fenced in PR #1632) had live siblings across the
# installer: `jq/awk … "$f" > "$f.tmp" && mv "$f.tmp" "$f"` followed by an
# UNCONDITIONAL success line. When jq/awk or the redirect fails, `&&` skips the mv,
# the consumer's file keeps its OLD content, a half-written `<f>.tmp` is left in the
# consumer tree — and the installer still prints `✓ … registered/added/replaced`.
# `set -e` does not fire: a failure of the left-hand side of an `&&` list is exempt.
#
# Arm A/B: behavioural paired-negative on the one site callable as a function
# (`register_cc_hook`, setup.d/lib.sh). Arm C: structural anti-drift over every
# installer script, because the other sites live in top-level layer bodies that
# cannot be invoked without a full install; the shape itself is the defect.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

PKG_ROOT="$REPO_ROOT"; PROJECT_ROOT="$REPO_ROOT"; FORCE=""; DRY_RUN=""; UPSTREAM_BLOB_URL=""
SKIPPED=()
INSTALL_SH_LIB_ONLY=1 source "$REPO_ROOT/setup.d/lib.sh"

mk_settings() { printf '{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"consumer-own.sh"}]}]}}\n' > "$1/settings.json"; }

# ── (A) jq failure on the append path — the A1-9 core case ───────────────────
T=$(mktemp -d); mk_settings "$T"
jq() { return 2; }
register_cc_hook "$T/settings.json" "Stop" "bash new-hook.sh" "new-hook" > "$T/out" 2>&1; rc=$?
unset -f jq
out=$(cat "$T/out")
case "$out" in *"registered as a Stop hook"*) bad "A: '✓ … registered' printed despite a failed jq: $out" ;; *) ok "A: no success line when the jq rewrite fails" ;; esac
case "$out" in *"⚠"*) ok "A: a ⚠ warning is emitted instead" ;; *) bad "A: no ⚠ warning: $out" ;; esac
[ -e "$T/settings.json.tmp" ] && bad "A: stale settings.json.tmp left in the consumer tree" || ok "A: no stale .tmp left behind"
grep -qF 'consumer-own.sh' "$T/settings.json" && ok "A: consumer settings.json left intact" || bad "A: consumer settings.json clobbered"
[ "$rc" -eq 0 ] && ok "A: register_cc_hook returns 0 (fail-open, never aborts the install)" || bad "A: rc=$rc"
rm -rf "$T"

# ── (B) paired-positive: a healthy jq still registers + reports success ──────
if command -v jq >/dev/null 2>&1; then
  T=$(mktemp -d); mk_settings "$T"
  register_cc_hook "$T/settings.json" "Stop" "bash new-hook.sh" "new-hook" > "$T/out" 2>&1
  out=$(cat "$T/out")
  case "$out" in *"registered as a Stop hook"*) ok "B: healthy jq still prints the ✓ line" ;; *) bad "B: success line lost on the happy path: $out" ;; esac
  grep -qF 'new-hook.sh' "$T/settings.json" && ok "B: hook appended" || bad "B: hook not appended"
  grep -qF 'consumer-own.sh' "$T/settings.json" && ok "B: consumer hook preserved" || bad "B: consumer hook lost"
  [ -e "$T/settings.json.tmp" ] && bad "B: tmp left behind on the happy path" || ok "B: tmp cleaned up on the happy path"
  rm -rf "$T"
else
  bad "B: jq absent — the paired-positive arm could not be exercised"
fi

# ── (D) A1-9b: the CREATE path (settings.json absent) ────────────────────────
# Same family, opposite failure mode: `jq -n … > "$settings"` is a SIMPLE command, so the
# redirect creates the file BEFORE jq runs and `set -e` DOES fire — the install aborts
# silently (no ✓, no ⚠, no message) leaving a ZERO-BYTE .claude/settings.json in the
# consumer tree. Claude Code rejects an empty settings file, and every later
# `jq -e … "$settings"` in the same install fails to parse it.
T=$(mktemp -d)
jq() { return 2; }
register_cc_hook "$T/settings.json" "Stop" "bash new-hook.sh" "new-hook" > "$T/out" 2>&1; rc=$?
unset -f jq
out=$(cat "$T/out")
case "$out" in *"created with Stop hook"*) bad "D: '✓ … created' printed despite a failed jq: $out" ;; *) ok "D: no success line when the create-path jq fails" ;; esac
case "$out" in *"⚠"*) ok "D: a ⚠ warning is emitted instead" ;; *) bad "D: no ⚠ warning: $out" ;; esac
[ -e "$T/settings.json" ] && bad "D: an empty settings.json was left in the consumer tree ($(wc -c < "$T/settings.json") bytes)" || ok "D: no half-created settings.json left behind"
[ -e "$T/settings.json.tmp" ] && bad "D: stale settings.json.tmp left in the consumer tree" || ok "D: no stale .tmp left behind"
[ "$rc" -eq 0 ] && ok "D: register_cc_hook returns 0 (fail-open, never aborts the install)" || bad "D: rc=$rc"
rm -rf "$T"

# ── (D2) paired-positive: a healthy jq still creates the file + reports success ──
if command -v jq >/dev/null 2>&1; then
  T=$(mktemp -d)
  register_cc_hook "$T/settings.json" "Stop" "bash new-hook.sh" "new-hook" > "$T/out" 2>&1
  out=$(cat "$T/out")
  case "$out" in *"created with Stop hook"*) ok "D2: healthy jq still prints the ✓ create line" ;; *) bad "D2: create success line lost: $out" ;; esac
  grep -qF 'new-hook.sh' "$T/settings.json" && ok "D2: hook written into the new settings.json" || bad "D2: hook missing from the created file"
  [ -e "$T/settings.json.tmp" ] && bad "D2: tmp left behind on the happy path" || ok "D2: tmp cleaned up on the happy path"
  rm -rf "$T"
else
  bad "D2: jq absent — the create-path paired-positive arm could not be exercised"
fi

# ── (E) A1-9c: the multi-stack _ws_placed counter must count PLACEMENTS ──────
# setup.d/40-configs.sh feeds an aggregate loud-fail gate (`if [ "$_ws_placed" -eq 0 ]`)
# from a counter incremented right after copy_safe with no check that the config landed.
# The block is sliced out of the layer body (it lives inside a `while read` loop that needs
# a full install) and driven with copy_safe shadowed to place nothing.
_slice_case_block() {
  awk '/^    case "\$_ws_stack" in$/ {inb=1} inb {print} inb && /^    fi$/ {exit}' \
    "$REPO_ROOT/setup.d/40-configs.sh"
}
_run_counter() {  # $1 = stack, $2 = copy_safe behaviour (place|nothing)
  local _ws_stack="$1" _mode="$2"
  local _ws_abs _ws_dir="pkg/app" _ws_unknown_report="" _ws_placed=0 DRY_RUN=""
  _ws_abs=$(mktemp -d)
  printf '{"name":"x"}\n' > "$_ws_abs/package.json"
  if [ "$_mode" = "place" ]; then
    copy_safe() { printf '// cfg\n' > "$2"; }
  else
    copy_safe() { :; }   # delivery silently placed nothing
  fi
  # shellcheck disable=SC1090
  for _ in 1; do eval "$(_slice_case_block)"; done >/dev/null 2>&1
  unset -f copy_safe
  rm -rf "$_ws_abs"
  printf '%s' "$_ws_placed"
}
for _st in ts-server react-next react-spa react-native; do
  got=$(_run_counter "$_st" nothing)
  [ "$got" = "0" ] && ok "E: $_st — a delivery that placed no config is not counted (_ws_placed=$got)" \
                   || bad "E: $_st — counter reports $got placements with no eslint.config.mjs on disk"
  got=$(_run_counter "$_st" place)
  [ "$got" = "1" ] && ok "E: $_st — a real placement is still counted (_ws_placed=$got)" \
                   || bad "E: $_st — real placement not counted (_ws_placed=$got)"
done

# ── (F) A1-9d: copy_safe's ✓ + baseline staging must follow the COPY, not the ambient set -e ──
# copy_safe's write path ran `cp -r` and then UNCONDITIONALLY printed ✓ and staged the baseline.
# install.sh's ambient set -e was the only thing keeping that ✓ honest (a failing cp aborted the
# install with cp's own stderr). Any set -e-EXEMPT caller — `copy_safe … || true`, `if copy_safe …`,
# or the existing `[ -f … ] && copy_safe …` guards (10-skills.sh, 40-configs.sh, install.sh) — and
# the ✓ prints and the baseline records a hash for a file that was never delivered; the next
# --refresh reports the phantom as «kept». Same technique as arms D/E: condition-context call +
# shadowed tool.
# The shadow leaves a PARTIAL destination on disk before failing: refresh_baseline_stage stages
# only existing -f/-d targets, so a cp failing with nothing on disk stages nothing and the
# «baseline staged for an undelivered file» claim would be untestable without bytes on disk.
echo ""
echo "  ── F: a failed cp in a set -e-exempt caller ──"
T=$(mktemp -d); mkdir -p "$T/src-dir"
printf 'payload\n' > "$T/src-dir/payload.txt"
cp() { mkdir -p "$3"; printf 'partial\n' > "$3/partial-file"; return 1; }   # interrupted-copy mimic
REFRESH_BASELINE_STAGED=()
if copy_safe "$T/src-dir" "$T/dst-dir" > "$T/out" 2> "$T/err"; then f_rc=0; else f_rc=$?; fi
unset -f cp
out=$(cat "$T/out"); err=$(cat "$T/err")
case "$out" in *"✓"*) bad "F: ✓ printed for a copy that failed: $out" ;; *) ok "F: no ✓ when the copy fails" ;; esac
case "$err" in *"⚠"*) ok "F: a ⚠ warning is emitted on stderr" ;; *) bad "F: no ⚠ on stderr: '$err'" ;; esac
case "$err" in *"$T/dst-dir"*) ok "F: the ⚠ names the undelivered destination" ;; *) bad "F: the warning does not name the destination: '$err'" ;; esac
[ "${#REFRESH_BASELINE_STAGED[@]}" -eq 0 ] \
  && ok "F: nothing staged into the refresh baseline for the failed copy" \
  || bad "F: baseline staged ${#REFRESH_BASELINE_STAGED[@]} entries for an undelivered file: ${REFRESH_BASELINE_STAGED[*]:-none}"
[ ! -e "$T/dst-dir" ] && ok "F: no partial destination left on disk" \
                      || bad "F: partial destination left on disk: $(ls "$T/dst-dir" 2>/dev/null | tr '\n' ' ')"
[ "$f_rc" -eq 0 ] && ok "F: copy_safe returns 0 (fail-open, never aborts the install)" || bad "F: rc=$f_rc"
rm -rf "$T"

# ── (F2) paired-positive: a healthy cp still delivers, prints ✓, stages the baseline ──
echo "  ── F2: healthy cp paired-positive ──"
T=$(mktemp -d)
printf 'payload\n' > "$T/src.txt"
REFRESH_BASELINE_STAGED=()
if copy_safe "$T/src.txt" "$T/dst.txt" > "$T/out" 2> "$T/err"; then f_rc=0; else f_rc=$?; fi
out=$(cat "$T/out")
case "$out" in *"$T/dst.txt"*) ok "F2: the ✓ line still prints on the happy path" ;; *) bad "F2: success line lost on the happy path: '$out'" ;; esac
[ -f "$T/dst.txt" ] && ok "F2: the file is delivered" || bad "F2: file NOT delivered on the happy path"
[ "${#REFRESH_BASELINE_STAGED[@]}" -eq 1 ] && [ "${REFRESH_BASELINE_STAGED[0]}" = "$T/dst.txt" ] \
  && ok "F2: the delivery is staged into the refresh baseline" \
  || bad "F2: baseline staging lost on the happy path (staged: ${REFRESH_BASELINE_STAGED[*]:-none})"
[ "$f_rc" -eq 0 ] && ok "F2: rc=0 on the happy path" || bad "F2: rc=$f_rc on the happy path"
rm -rf "$T"

# ── (C) structural anti-drift: the raw shape is gone from every installer script ──
# A logical line (continuations joined) that redirects into a *.tmp and then `&& mv` is only
# honest when the whole && list is an if/while CONDITION — otherwise the next statement runs
# regardless. `set -e` will not save it: a failing left-hand side of an && list is exempt.
hits=$(cd "$REPO_ROOT" && for f in install.sh setup.d/*.sh; do
  awk -v F="$f" '
    { line = line $0
      if (sub(/\\$/, "", line)) next
      # `; then` can only terminate an if/elif condition in bash, so it is a sound
      # (and quoting-proof) marker that the whole && list is the tested command.
      if (line ~ /> *"[^"]*\.tmp" *&& *mv/ && line !~ /;[[:space:]]*then[[:space:]]*$/)
        print F ":" NR ": " line
      line = "" }' "$f"
done)
if [ -n "$hits" ]; then
  bad "C: '> \"…tmp\" && mv' outside an if/while condition still present:"; printf '%s\n' "$hits" | sed 's/^/      /'
else
  ok "C: every '> \"…tmp\" && mv' in install.sh + setup.d/*.sh guards its success path"
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
