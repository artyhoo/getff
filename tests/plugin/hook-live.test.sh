#!/usr/bin/env bash
# hook-live.test.sh — spec 2026-09-28 D12: the project copy's liveness marker
# (.claude/hooks/lib/hook-live.sh) and its contract with the plugin side
# (plugin/hooks/lib/live-claim.sh): same key, same directory, one claim per marker.
# Every arm varies ONE input against L1 and states what it expects.
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LIB="$REPO_ROOT/.claude/hooks/lib/hook-live.sh"
CLAIM="$REPO_ROOT/plugin/hooks/lib/live-claim.sh"
PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); echo "  ✓ $1"; }
bad(){ FAIL=$((FAIL+1)); echo "  ✗ $1"; }
TMPD=$(mktemp -d); trap 'chmod -R u+w "$TMPD" 2>/dev/null; rm -rf "$TMPD"' EXIT
export TMPDIR="$TMPD/tmp"; mkdir -p "$TMPDIR"
LIVE="$TMPDIR/getff-hook-live.$(id -u)"
P='{"session_id":"s-1","hook_event_name":"Stop"}'
SHELLS="bash sh"; command -v dash >/dev/null 2>&1 && SHELLS="$SHELLS dash"

# A hook under the strictest mode a real hook uses, loading the lib the way the prelude does.
HOOK="$TMPD/h.sh"
cat > "$HOOK" <<EOF
#!/usr/bin/env bash
set -euo pipefail
. "$LIB"; getff_hook_live h || true
cat
EOF
run() { printf '%s' "$1" | env -u AIF_HOOK_CHANNEL -u ZCODE_PROJECT_DIR "${@:2}" bash "$HOOK"; }
markers() { find "$LIVE" -type f 2>/dev/null | wc -l | tr -d ' '; }

# L1. A plain run: the hook still reads the whole payload, and exactly one marker lands.
OUT=$(run "$P"); rc=$?
[ "$OUT" = "$P" ] && [ "$rc" -eq 0 ] && ok "L1 the hook still reads the whole payload (rc 0)" || bad "L1 payload lost — got '$OUT' rc=$rc"
[ "$(markers)" = 1 ] && ok "L1 one marker per run" || bad "L1 expected 1 marker, got $(markers)"
mode=$(stat -c %a "$LIVE" 2>/dev/null || stat -f %Lp "$LIVE" 2>/dev/null)  # GNU first: GNU `stat -f` is filesystem status and prints to stdout
smode=$(stat -c %a "$LIVE/s-1" 2>/dev/null || stat -f %Lp "$LIVE/s-1" 2>/dev/null)
[ "$mode" = 700 ] && [ "$smode" = 700 ] && ok "L1 base and session directories are mode 700 (H3)" \
  || bad "L1 directory modes base=$mode session=$smode"

# L10. The hook's own stderr still reaches the caller after the lib ran — a gate hook reports
# through stderr with exit 2 (check-doc-authority-header), and the lib's re-opening of stdin
# must not silence it. Varies vs L1: the hook writes to stderr after the lib.
HOOK_ERR="$TMPD/h-err.sh"
cat > "$HOOK_ERR" <<EOF
#!/usr/bin/env bash
set -euo pipefail
. "$LIB"; getff_hook_live h || true
cat >/dev/null
echo "diag-on-stderr" >&2
exit 2
EOF
ERR=$(printf '%s' "$P" | env -u AIF_HOOK_CHANNEL -u ZCODE_PROJECT_DIR bash "$HOOK_ERR" 2>&1 >/dev/null); rc=$?
[ "$ERR" = "diag-on-stderr" ] && [ "$rc" -eq 2 ] && ok "L10 the hook's stderr and exit code survive the lib" \
  || bad "L10 stderr lost after the lib — got '$ERR' rc=$rc"

# K1. The plugin side computes the same key for the same payload, in every shell it runs under.
for SH in $SHELLS; do
  printf '%s' "$P" > "$TMPD/p"
  k=$("$SH" -c '. "$1"; getff_live_key h "$2"' _ "$CLAIM" "$TMPD/p")
  ls "$LIVE/s-1/$k".* >/dev/null 2>&1 && ok "K1 [$SH] plugin key == project key" || bad "K1 [$SH] key mismatch ($k)"
done

# L8. A multi-line payload and its trailing newlines survive byte for byte, and the key covers them.
rm -rf "$LIVE"
IN="$(printf '%s\n' "$P" | jq .; printf '\nx')"; IN="${IN%x}"   # multi-line JSON + two trailing newlines
[ "$(run "$IN" | cksum)" = "$(printf '%s' "$IN" | cksum)" ] && ok "L8 payload re-read byte for byte, trailing newlines kept" \
  || bad "L8 payload changed"
printf '%s' "$IN" > "$TMPD/p"
k=$(bash -c '. "$1"; getff_live_key h "$2"' _ "$CLAIM" "$TMPD/p")
ls "$LIVE/s-1/$k".* >/dev/null 2>&1 && ok "K2 key covers the trailing newlines on both sides" || bad "K2 key mismatch"

# E1. End to end: the project copy marks, the plugin side claims once; a second claim fails.
for SH in $SHELLS; do
  rm -rf "$LIVE"; run "$P" >/dev/null
  "$SH" -c '. "$1"; getff_live_claim h "$2"' _ "$CLAIM" "$P" && ok "E1 [$SH] fresh marker is claimed" || bad "E1 [$SH] claim failed"
  "$SH" -c '. "$1"; getff_live_claim h "$2"' _ "$CLAIM" "$P" && bad "E1 [$SH] one marker claimed twice" \
    || ok "E1 [$SH] a claimed marker is gone (second claim fails)"
  [ "$(markers)" = 0 ] && ok "E1 [$SH] a claim leaves no file behind" || bad "E1 [$SH] $(markers) files left after claim"
done

# L2. The plugin twin runs with AIF_HOOK_CHANNEL=plugin and must not mark itself live.
rm -rf "$LIVE"
OUT=$(printf '%s' "$P" | env -u ZCODE_PROJECT_DIR AIF_HOOK_CHANNEL=plugin bash "$HOOK")
[ "$OUT" = "$P" ] && [ ! -d "$LIVE" ] && ok "L2 plugin channel writes no marker" || bad "L2 plugin channel marked"
# L3. ZCode: nothing there ever claims (D6).
OUT=$(printf '%s' "$P" | env -u AIF_HOOK_CHANNEL ZCODE_PROJECT_DIR=/x bash "$HOOK")
[ "$OUT" = "$P" ] && [ ! -d "$LIVE" ] && ok "L3 ZCode writes no marker" || bad "L3 ZCode marked"
# L4. No session_id → no marker, payload intact.
OUT=$(run '{"hook_event_name":"Stop"}')
[ "$OUT" = '{"hook_event_name":"Stop"}' ] && [ "$(markers)" = 0 ] \
  && ok "L4 no session_id → no marker, payload intact" || bad "L4"
# L5. A session_id that would leave the base directory → no marker anywhere.
OUT=$(run '{"session_id":"../x","hook_event_name":"Stop"}')
[ ! -e "$TMPDIR/x" ] && [ ! -e "$LIVE/../x" ] && [ "$(markers)" = 0 ] && ok "L5 unsafe session_id → no marker" || bad "L5 path escape"
# L6. Markers older than 60 s are pruned by the next run of the same session.
mkdir -p "$LIVE/s-1"; chmod 700 "$LIVE" "$LIVE/s-1"; : > "$LIVE/s-1/old.1.1"; touch -t 202001010000 "$LIVE/s-1/old.1.1"
run "$P" >/dev/null
[ ! -e "$LIVE/s-1/old.1.1" ] && [ "$(markers)" = 1 ] && ok "L6 markers older than 60 s are pruned" || bad "L6 stale marker kept"
# L7. No jq → no marker, payload intact.
B="$TMPD/nojq"; mkdir -p "$B"; for t in bash cat env mktemp rm ls id date find mkdir cut sha256sum shasum; do
  p=$(command -v "$t") && ln -sf "$p" "$B/$t"; done
rm -rf "$LIVE"; OUT=$(printf '%s' "$P" | env -u AIF_HOOK_CHANNEL -u ZCODE_PROJECT_DIR PATH="$B" bash "$HOOK")
[ "$OUT" = "$P" ] && [ ! -d "$LIVE" ] && ok "L7 no jq → no marker, payload intact" || bad "L7"
# L9. A base directory that is a symlink (H3) → the project copy writes nothing through it.
rm -rf "$LIVE"; mkdir -p "$TMPD/elsewhere"; ln -s "$TMPD/elsewhere" "$LIVE"
OUT=$(run "$P")
[ "$OUT" = "$P" ] && [ -z "$(ls -A "$TMPD/elsewhere")" ] && ok "L9 symlinked base directory → no marker, payload intact" \
  || bad "L9 wrote through a symlinked base"
rm -f "$LIVE"
# L11. A base directory group or others can write (another user could plant or swap markers)
# → the project copy writes nothing into it; the plugin side refuses it too (run-hook D-loose).
for m in 770 707; do
  rm -rf "$LIVE"; mkdir -p "$LIVE"; chmod "$m" "$LIVE"
  OUT=$(run "$P")
  [ "$OUT" = "$P" ] && [ "$(markers)" = 0 ] && ok "L11 base directory mode $m → no marker, payload intact" \
    || bad "L11 mode $m: out='$OUT' markers=$(markers)"
done
rm -rf "$LIVE"

# L-ro (H2). Every step of the prelude fails open under `set -euo pipefail`.
# (a) An unwritable TMPDIR: the prelude, copied verbatim from a real hook, cannot create the base.
RO="$TMPD/ro"; mkdir -p "$RO"; chmod 500 "$RO"
{ echo '#!/usr/bin/env bash'; echo 'set -euo pipefail'
  sed -n '/^# Liveness marker for the plugin copy/,/getff_hook_live/p' "$REPO_ROOT/.claude/hooks/ask-question-reminder.sh" \
    | sed "s|\$_getff_live_dir/lib/hook-live.sh|$LIB|g; s|_getff_live_dir=\"\$(cd.*|_getff_live_dir=x|"
  echo 'cat; echo; echo AFTER'; } > "$TMPD/ro-hook.sh"
grep -q 'getff_hook_live ask-question-reminder' "$TMPD/ro-hook.sh" || bad "L-ro fixture: prelude not found in the real hook"
OUT=$(printf '%s' "$P" | env -u AIF_HOOK_CHANNEL -u ZCODE_PROJECT_DIR TMPDIR="$RO" bash "$TMPD/ro-hook.sh"); rc=$?
[ "$rc" -eq 0 ] && [ "$OUT" = "$P"$'\n'AFTER ] && [ -z "$(ls -A "$RO")" ] \
  && ok "L-ro(a) unwritable TMPDIR → hook completes, payload intact, no marker" || bad "L-ro(a) rc=$rc out='$OUT'"
# (b) The real ask-question-reminder under its own `set -euo pipefail`, with the marker base
# read-only: output and exit code equal those of the same hook installed without the lib.
aqr_tree() {   # aqr_tree <dir> <with-lib:0|1>
  mkdir -p "$1/.claude/hooks/lib"; cp "$REPO_ROOT/.claude/hooks/ask-question-reminder.sh" "$1/.claude/hooks/"
  cp -R "$REPO_ROOT/.claude/hooks/lang" "$1/.claude/hooks/"
  [ "$2" = 1 ] && cp "$LIB" "$1/.claude/hooks/lib/"
  mkdir -p "$1/tmp/getff-hook-live.$(id -u)"; chmod 500 "$1/tmp/getff-hook-live.$(id -u)"
}
aqr_tree "$TMPD/with" 1; aqr_tree "$TMPD/without" 0
AQ='{"session_id":"s-ro","hook_event_name":"PreToolUse","tool_name":"AskUserQuestion","tool_input":{}}'
W=$(printf '%s' "$AQ" | env -u AIF_HOOK_CHANNEL -u ZCODE_PROJECT_DIR -u AIF_HOOK_LANG TMPDIR="$TMPD/with/tmp" \
  bash "$TMPD/with/.claude/hooks/ask-question-reminder.sh" 2>&1); wrc=$?
N=$(printf '%s' "$AQ" | env -u AIF_HOOK_CHANNEL -u ZCODE_PROJECT_DIR -u AIF_HOOK_LANG TMPDIR="$TMPD/without/tmp" \
  bash "$TMPD/without/.claude/hooks/ask-question-reminder.sh" 2>&1); nrc=$?
[ -n "$N" ] && [ "$W" = "$N" ] && [ "$wrc" = "$nrc" ] \
  && [ -z "$(ls -A "$TMPD/with/tmp/getff-hook-live.$(id -u)")" ] \
  && ok "L-ro(b) real hook, read-only marker base → same output and rc as without the lib, no marker" \
  || bad "L-ro(b) with='$W' rc=$wrc without='$N' rc=$nrc"
# (c) The same real hook with a writable TMPDIR marks and still produces the same output.
chmod 700 "$TMPD/with/tmp/getff-hook-live.$(id -u)"; rm -f "$TMPD/with/tmp/aif-ask-reminded-s-ro"
W=$(printf '%s' "$AQ" | env -u AIF_HOOK_CHANNEL -u ZCODE_PROJECT_DIR -u AIF_HOOK_LANG TMPDIR="$TMPD/with/tmp" \
  bash "$TMPD/with/.claude/hooks/ask-question-reminder.sh" 2>&1)
n=$(find "$TMPD/with/tmp/getff-hook-live.$(id -u)" -type f | wc -l | tr -d ' ')
[ "$W" = "$N" ] && [ "$n" = 1 ] && ok "L-ro(c) real hook, writable base → same output, one marker" || bad "L-ro(c) n=$n out='$W'"

# L-corrupt (review IMPORTANT-1). A truncated lib (a half-written copy, a torn install) is a
# syntax error. A bare `.` of it exits a `set -euo pipefail` hook with rc 2 — a BLOCKING code —
# even inside the prelude's `if`; `command .` turns that into a failed condition, so the hook body
# runs with rc 0 and its normal output. Real hooks, both prelude forms: the old form must go red.
hook_tree() {   # hook_tree <dir> <hook> <lib-mode: none|cut>
  mkdir -p "$1/.claude/hooks/lib" "$1/tmp"; cp "$REPO_ROOT/.claude/hooks/$2.sh" "$1/.claude/hooks/"
  cp -R "$REPO_ROOT/.claude/hooks/lang" "$1/.claude/hooks/"
  cp "$REPO_ROOT/.claude/hooks/lib/residue-dir.sh" "$1/.claude/hooks/lib/" 2>/dev/null || true
  [ "$3" = cut ] && head -c 3000 "$LIB" > "$1/.claude/hooks/lib/hook-live.sh"; return 0
}
hook_run() {   # hook_run <dir> <hook> <payload> — stdout+stderr; rc in $hrc
  HO=$(printf '%s' "$3" | env -u AIF_HOOK_CHANNEL -u ZCODE_PROJECT_DIR -u AIF_HOOK_LANG TMPDIR="$1/tmp" \
    CLAUDE_PROJECT_DIR="$1" bash "$1/.claude/hooks/$2.sh" 2>&1); hrc=$?
}
bash -n "$(head -c 3000 "$LIB" > "$TMPD/cut.sh"; echo "$TMPD/cut.sh")" 2>/dev/null \
  && bad "L-corrupt fixture: the truncated lib still parses — the arm would prove nothing"
# The control needs a bash where a bare `.` of a syntax error aborts a `set -e` hook. bash 3.2 (the
# macOS /bin/bash) does, with rc 2; the bash 5 on the Linux CI runner reports the error and returns
# non-zero from `.`, so the old form is harmless there and the control has nothing to tell apart.
old_form_fatal=0
bash -c 'set -euo pipefail; if true && . "$1"; then :; fi; exit 0' _ "$TMPD/cut.sh" >/dev/null 2>&1 || old_form_fatal=1
for pair in "end-of-turn-reminder|{\"session_id\":\"s-c\",\"hook_event_name\":\"Stop\",\"stop_hook_active\":false}" \
  "ask-question-reminder|{\"session_id\":\"s-c\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"AskUserQuestion\",\"tool_input\":{}}"; do
  h=${pair%%|*}; pl=${pair#*|}
  rm -rf "$TMPD/cn" "$TMPD/cc" "$TMPD/co"
  hook_tree "$TMPD/cn" "$h" none; hook_tree "$TMPD/cc" "$h" cut; hook_tree "$TMPD/co" "$h" cut
  sed -i.bak 's|&& command \. "\$_getff_live_dir/lib/hook-live.sh"|\&\& . "$_getff_live_dir/lib/hook-live.sh"|' "$TMPD/co/.claude/hooks/$h.sh"
  hook_run "$TMPD/cn" "$h" "$pl"; N=$HO; nrc=$hrc
  hook_run "$TMPD/cc" "$h" "$pl"; C=$HO; crc=$hrc
  hook_run "$TMPD/co" "$h" "$pl"; orc=$hrc
  [ "$crc" = 0 ] && [ "$nrc" = 0 ] && [ "$C" = "$N" ] && [ -z "$(find "$TMPD/cc/tmp" -path '*getff-hook-live*' -type f)" ] \
    && ok "L-corrupt $h: truncated lib → rc 0, same output as without the lib, no marker" \
    || bad "L-corrupt $h: rc=$crc (no-lib rc=$nrc) out='$C' vs '$N'"
  if ! grep -q '&& \. "\$_getff_live_dir/lib/hook-live.sh"' "$TMPD/co/.claude/hooks/$h.sh"; then
    bad "L-corrupt $h control: the sed did not produce the old bare-\`.\` prelude"
  elif [ "$old_form_fatal" = 0 ]; then
    ok "L-corrupt $h control: n/a on $(bash -c 'echo "$BASH_VERSION"') — a sourced syntax error is not fatal here (rc $orc)"
  elif [ "$orc" != 0 ]; then
    ok "L-corrupt $h control: the old bare-\`.\` prelude dies on the same lib (rc $orc)"
  else bad "L-corrupt $h control: old-form fixture did not fail (rc $orc) — the arm does not discriminate"; fi
done

# S1. The project lib never ships in the plugin: a plugin copy that found it could mark itself.
[ ! -e "$REPO_ROOT/plugin/hooks/lib/hook-live.sh" ] && ok "S1 plugin/hooks/lib/hook-live.sh does not exist" \
  || bad "S1 hook-live.sh ships in the plugin"

# P1. Every shared hook the installer delivers carries the prelude with its OWN name, declares the
# lib in its @plugin-yield-deps closure (so the manifest hashes it), and marks before it reads
# stdin. The population is read from the installer, not hand-listed.
HOOKS=$(sed -nE "s/.*register_cc_hook \"\\\$SETTINGS\" \"[A-Za-z]+\" '[^']+' \"([a-z0-9-]+)\".*/\1/p" \
  "$REPO_ROOT/setup.d/10-skills.sh" | sort -u | grep -vx deps-hash-check)
# The loader registers through register_imr_hooks (setup.d/lib.sh), not a literal
# register_cc_hook line the parse above can read.
if grep -qE '^[[:space:]]*register_imr_hooks "\$SETTINGS"' "$REPO_ROOT/setup.d/10-skills.sh"; then
  HOOKS=$(printf '%s\ninject-matching-rule\n' "$HOOKS" | sed '/^$/d' | sort -u)
fi
n=0
for h in $HOOKS; do
  f="$REPO_ROOT/.claude/hooks/$h.sh"; n=$((n+1))
  pl=$(grep -n "getff_hook_live $h || true" "$f" | head -n 1 | cut -d: -f1)
  rd=$(grep -nE '^[^#]*\$\(cat( 2>/dev/null)?( \|\| true)?\)' "$f" | head -n 1 | cut -d: -f1)
  if [ -z "$pl" ]; then bad "P1 $h: no prelude calling getff_hook_live $h"
  elif [ -n "$rd" ] && [ "$pl" -ge "$rd" ]; then bad "P1 $h: prelude (line $pl) after the first stdin read (line $rd)"
  elif ! grep -qE '^# @plugin-yield-deps:.* lib/hook-live\.sh( |$)|^# @plugin-yield-deps: lib/hook-live\.sh( |$)' "$f"; then
    bad "P1 $h: lib/hook-live.sh missing from @plugin-yield-deps"
  elif ! grep -qF "  $h.sh:lib/hook-live.sh" "$REPO_ROOT/plugin/hooks/lib/source-sha256.txt"; then
    bad "P1 $h: the manifest does not hash lib/hook-live.sh for it"
  else ok "P1 $h: prelude before stdin read, lib declared and hashed"; fi
done
[ "$n" -ge 7 ] && ok "P1 floor: $n installer hooks checked (≥7)" || bad "P1 only $n installer hooks found"

echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" = 0 ]
