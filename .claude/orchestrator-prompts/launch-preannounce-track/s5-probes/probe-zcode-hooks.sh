#!/usr/bin/env bash
# S5 zcode capability probe — launch-preannounce-track.
#
# Probes the two CLAIMED (true) zcode cells of .ai-factory/rule-channel-capabilities.json:
#   - sessionStartHook: true  ("does a session-start hook event exist?")
#   - postToolUseInject: true ("can a hook inject additionalContext after a tool call?")
#
# WHAT THIS PROBE PROVES (executable, deterministic, no model access needed):
#   (1) CONFIG-SCHEMA ACCEPTANCE via the REAL installed zcode CLI (v0.15.0). We feed
#       zcode a project zcode.json and observe its own Zod validation verdict, emitted
#       to zcode's structured JSONL log (~/.zcode/cli/log/zcode-<date>.jsonl). A valid
#       SessionStart/PostToolUse hook config under the `events:` wrapper is ACCEPTED; a
#       bogus event name is REJECTED (proving the acceptance is a strict vocabulary, not
#       permissiveness); the framework shim's current FLAT shape is REJECTED (delivery bug,
#       see the stage report observation).
#   (2) RUNTIME CODE-PATH existence via bundle inspection: runSessionStartHooks /
#       runPostToolUseHooks exist, and the additionalContext-injection switch pushes
#       hook output for BOTH qr.SessionStart AND qr.PostToolUse.
#
# WHAT THIS PROBE DOES NOT PROVE: end-to-end firing (hook script executes + additionalContext
#   reaches the model) requires a headless model turn, which zcode refuses without an operator
#   model-provider config / OAuth ("Error: Model config is missing"). Configuring that is
#   operator-credential state this probe must not touch. Config-acceptance + runtime-path is
#   the honest autonomous ceiling. See s5-stage-report.md.
#
# READ-ONLY on ~/.zcode: this probe only READS the app's own log; all writable state is under
# a namespaced $TMPDIR probe dir, removed on exit.
#
# Re-run: bash probe-zcode-hooks.sh   (exit 0 = all assertions hold)
set -uo pipefail

ZC="/Applications/ZCode.app/Contents/Resources/glm/zcode.cjs"
LOG="$HOME/.zcode/cli/log/zcode-$(date +%Y-%m-%d).jsonl"
NODE="$(command -v node || echo /opt/homebrew/bin/node)"
PASS=0; FAIL=0
ok()  { echo "  PASS: $1"; PASS=$((PASS+1)); }
bad() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

if [ ! -f "$ZC" ]; then echo "SKIP: zcode CLI not found at $ZC (not the operator machine)"; exit 2; fi
echo "== zcode version =="; "$NODE" "$ZC" version 2>/dev/null || "$NODE" "$ZC" --version 2>/dev/null

WORK="$(mktemp -d "${TMPDIR:-/tmp}/s5-zcode-probe.XXXXXX")"
WORK="${WORK//\/\///}"   # collapse any // (a trailing-slash $TMPDIR yields a double slash zcode logs as single)
WTAG="$(basename "$WORK")"
trap 'rm -rf "$WORK"' EXIT
mk() { mkdir -p "$WORK/$1"; ( cd "$WORK/$1" && git init -q 2>/dev/null ); cat > "$WORK/$1/zcode.json"; }

# --- Probe A: the framework shim's CURRENT flat shape {hooks:{SessionStart:[...]}} — expect REJECT
mk A <<'JSON'
{ "hooks": {
  "SessionStart": [ { "hooks": [ { "type": "command", "command": "echo a" } ] } ],
  "PostToolUse":  [ { "matcher": "Edit|Write", "hooks": [ { "type": "command", "command": "echo a" } ] } ]
} }
JSON
# --- Probe B: the shape zcode 0.15.0 ACCEPTS {hooks:{events:{SessionStart:[...],PostToolUse:[...]}}}
mk B <<'JSON'
{ "hooks": { "events": {
  "SessionStart": [ { "hooks": [ { "type": "command", "command": "echo b" } ] } ],
  "PostToolUse":  [ { "matcher": "Edit|Write", "hooks": [ { "type": "command", "command": "echo b" } ] } ]
} } }
JSON
# --- Probe C: paired negative — bogus event name under events: — expect REJECT (strict vocabulary)
mk C <<'JSON'
{ "hooks": { "events": {
  "NotARealEvent": [ { "hooks": [ { "type": "command", "command": "echo c" } ] } ]
} } }
JSON

# `plugins list --cwd <dir>` bootstraps + validates the project zcode.json (walk cwd->git-root)
# and emits the verdict to $LOG. It needs no model provider (unlike -p/TUI).
run_probe() { "$NODE" "$ZC" plugins list --cwd "$WORK/$1" >/dev/null 2>&1; }
# unique verdict line for a probe = last $LOG line whose configPath contains this run's
# probe dir. Match on the run-unique mktemp basename ($WTAG) + /<cell>/zcode.json so a
# trailing-slash $TMPDIR or /var vs /private/var realpath form cannot cause a false miss.
verdict() { grep -F "$WTAG/$1/zcode.json" "$LOG" 2>/dev/null | tail -1; }

echo "== running config-acceptance probes (real zcode Zod validation) =="
run_probe A; run_probe B; run_probe C
sleep 1

VA="$(verdict A)"; VB="$(verdict B)"; VC="$(verdict C)"
echo "--- probe A (shim flat shape) verdict line ---"; echo "${VA:-<none>}"
echo "--- probe B (events wrapper)  verdict line ---"; echo "${VB:-<none: config accepted, no invalid event logged>}"
echo "--- probe C (bogus event)     verdict line ---"; echo "${VC:-<none>}"

echo "== assertions =="
echo "$VA" | grep -q 'config.file.invalid' && echo "$VA" | grep -q 'Unrecognized keys' \
  && ok "sessionStartHook/postToolUseInject: framework shim FLAT shape is REJECTED by zcode 0.15.0 (delivery-drift RED)" \
  || bad "expected shim flat shape rejected"
if [ -z "$VB" ]; then
  ok "sessionStartHook + postToolUseInject: 'events'-wrapper config with SessionStart+PostToolUse is ACCEPTED (no config.file.invalid) — events exist as recognized hook primitives"
else
  bad "events-wrapper config was NOT accepted: $VB"
fi
echo "$VC" | grep -q 'Unrecognized key' && echo "$VC" | grep -q 'NotARealEvent' \
  && ok "strict vocabulary: a bogus event under events: is REJECTED — acceptance in probe B is meaningful, not permissive" \
  || bad "expected bogus event rejected (paired negative)"

echo "== runtime code-path evidence (bundle inspection) =="
"$NODE" - "$ZC" <<'JS'
const s=require('fs').readFileSync(process.argv[2],'utf8');
const has=(t)=>s.includes(t);
const checks=[
 ["runSessionStartHooks defined", has("runSessionStartHooks")],
 ["runPostToolUseHooks defined",  has("runPostToolUseHooks")],
 ["additionalContext injected for SessionStart", has("injectHookAdditionalContextIntoMessageHistory(qr.SessionStart")],
 ["additionalContext switch includes PostToolUse", has("case qr.PostToolUse:case qr.PostToolUseFailure:case qr.UserPromptSubmit:case qr.SessionStart:case qr.Stop:")],
];
let bad=0;
for(const [name,v] of checks){ console.log(`  ${v?"PASS":"FAIL"}: runtime — ${name}`); if(!v) bad++; }
process.exit(bad?1:0);
JS
RT=$?
[ "$RT" -eq 0 ] && PASS=$((PASS+4)) || FAIL=$((FAIL+1))

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
