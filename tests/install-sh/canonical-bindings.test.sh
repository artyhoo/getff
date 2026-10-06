#!/usr/bin/env bash
# Prove canonical consumer payload, helpers, profile gates and safe legacy upgrade.
set -euo pipefail
REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/getff-canonical-install.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
consumer="$WORK/consumer"
mkdir -p "$consumer/.claude/skills/getff" "$consumer/.claude/hooks"
printf 'consumer customized skill\n' > "$consumer/.claude/skills/getff/SKILL.md"
printf 'consumer-only helper\n' > "$consumer/.claude/skills/getff/own.txt"
printf 'consumer customized hook\n' > "$consumer/.claude/hooks/inject-output-language.sh"
printf 'consumer project anchor\n' > "$consumer/.claude/session-bootstrap.md"

# Exercise the real content layers without unrelated toolchain, companion or CI work.
deliver() (
  PKG_ROOT="$REPO_ROOT" PROJECT_ROOT="$consumer" PROFILE="${1:-core}"
  FORCE="${2:-}" DRY_RUN="${3:-}" REFRESH="${4:-}" WITH_AIF_SUITE=""
  UPSTREAM_BLOB_URL="https://github.com/artyhoo/getff/blob/main"
  SKIPPED=(); SHIPPED_DOCS=(); REFRESH_BASELINE_STAGED=()
  source "$REPO_ROOT/setup.d/lib.sh"
  if [ -n "$REFRESH" ]; then
    for slug in getff tool-bootstrapping $GETFF_SKILLS_CORE; do refresh_skill_with_transform "$slug"; done
  else
    source "$REPO_ROOT/setup.d/10-skills.sh"
    source "$REPO_ROOT/setup.d/20-agents.sh"
  fi
  install_portable_bindings
  refresh_baseline_flush
) > "$WORK/run.log" 2>&1

deliver core
[ "$(cat "$consumer/.claude/skills/getff/SKILL.md")" = 'consumer customized skill' ]
[ -f "$consumer/.claude/skills/getff/own.txt" ]
[ "$(cat "$consumer/.claude/hooks/inject-output-language.sh")" = 'consumer customized hook' ]
[ "$(cat "$consumer/.agents/session-bootstrap.md")" = 'consumer project anchor' ]
[ -f "$consumer/.agents/procedures/getff/SKILL.md" ]
[ -L "$consumer/.claude/skills/ai-doc/SKILL.md" ]
[ -L "$consumer/.zcode/skills/ai-doc/SKILL.md" ]
[ -f "$consumer/.agents/roles/review-sidecar.md" ]
[ -f "$consumer/.agents/skills/review-sidecar/SKILL.md" ]
grep -q "allow_implicit_invocation: false" "$consumer/.agents/skills/review-sidecar/agents/openai.yaml"
[ -f "$consumer/.agents/hooks/lib/hook-live.sh" ]
[ -f "$consumer/.agents/hooks/deps-hash-check.sh" ]
[ ! -e "$consumer/.agents/procedures/arch" ]
[ ! -e "$consumer/.agents/procedures/aif-doctor" ]
grep -q '../../procedures/ai-doc/SKILL.md' "$consumer/.agents/skills/ai-doc/SKILL.md"

# Native delivery must close over its adapter dependencies and protect user config.
[ -f "$consumer/.codex/hooks.json" ]
[ -f "$consumer/scripts/codex-hook-adapter.mjs" ]
[ -f "$consumer/scripts/lib/is-main-entry.mjs" ]
[ -f "$consumer/.agents/hooks/lib/hook-language.sh" ]
node - "$consumer" <<'NODE'
const fs = require('fs'), path = require('path'), root = process.argv[2];
const hooks = JSON.parse(fs.readFileSync(path.join(root, '.codex/hooks.json'))).hooks;
const handlers = Object.values(hooks).flat().flatMap(entry => entry.hooks);
if (!handlers.length) throw Error('consumer native hook registration is empty');
if (handlers.some(h => h.command.includes('.ai-factory/harness-model.json'))) throw Error('consumer hooks require contributor-only assets');
NODE
printf '{"hooks":{},"consumerOwned":true}\n' > "$consumer/.codex/hooks.json"

deliver core
[ "$(cat "$consumer/.claude/skills/getff/SKILL.md")" = 'consumer customized skill' ]
[ -f "$consumer/.claude/skills/getff/own.txt" ]
grep -q consumerOwned "$consumer/.codex/hooks.json"
grep -q 'Codex hooks not wired: consumer-owned' "$WORK/run.log"
# Explicit legacy ownership remains honored by refresh as well as canonical links.
touch "$consumer/.claude/skills/getff.override.md"
deliver core '' '' --refresh
[ "$(cat "$consumer/.claude/skills/getff/SKILL.md")" = 'consumer customized skill' ]
[ -f "$consumer/.claude/skills/getff/own.txt" ]
grep -q consumerOwned "$consumer/.codex/hooks.json"
grep -q 'Codex hooks not wired: consumer-owned' "$WORK/run.log"

deliver env
[ -f "$consumer/.agents/procedures/arch/SKILL.md" ]
grep -q "allow_implicit_invocation: false" "$consumer/.agents/skills/pipeline/agents/openai.yaml"
[ ! -e "$consumer/.agents/procedures/aif-doctor" ]
deliver factory
[ -x "$consumer/.agents/procedures/aif-doctor/helpers/heal.sh" ]
[ -L "$consumer/.claude/skills/aif-doctor/helpers/heal.sh" ]
[ -L "$consumer/.zcode/skills/aif-doctor/helpers/heal.sh" ]
# Native aliases and their helper closure resolve wholly within the delivered tree.
node - "$consumer" <<'NODE'
const fs=require('fs'), p=require('path'), root=fs.realpathSync(process.argv[2]);
function walk(dir) { for (const e of fs.readdirSync(dir,{withFileTypes:true})) {
 const file=p.join(dir,e.name);
 if(e.isDirectory()) walk(file);
 else if(e.isSymbolicLink()) {const resolved=fs.realpathSync(file); if(!resolved.startsWith(root+p.sep)) throw Error(file+' escapes payload');}
}}
walk(root);
NODE
fingerprint() {
  node - "$consumer" <<'NODE'
const fs=require('fs'),p=require('path'),c=require('crypto'),h=c.createHash('sha256');
function walk(d){for(const n of fs.readdirSync(d).sort()){const f=p.join(d,n),s=fs.lstatSync(f);h.update(f);if(s.isDirectory())walk(f);else h.update(s.isSymbolicLink()?fs.readlinkSync(f):fs.readFileSync(f));}}
walk(process.argv[2]);console.log(h.digest('hex'));
NODE
}
before="$(fingerprint)"
deliver factory --force --dry-run
[ "$(fingerprint)" = "$before" ]
# Lanes with no delivered hook population must not suggest trust as sufficient.
consumer="$WORK/no-hooks"
mkdir -p "$consumer"
(
  PKG_ROOT="$REPO_ROOT" PROJECT_ROOT="$consumer" DRY_RUN="" FORCE="" REFRESH=""
  REFRESH_BASELINE_STAGED=(); SKIPPED=()
  source "$REPO_ROOT/setup.d/lib.sh"
  install_codex_consumer_bindings
) > "$WORK/no-hooks.log" 2>&1
grep -q 'Codex hooks not wired: no supported registered consumer checks' "$WORK/no-hooks.log"
! grep -q 'Codex hook definitions delivered;' "$WORK/no-hooks.log"

# Dry-run is deterministic: the same command twice must diff equal (L1 acceptance (a),
# framework-self-detect CI). The portable .md transform and the session-bootstrap seed
# both materialized through random mktemp scratch files whose names copy_safe's dry-run
# echo printed — two runs never matched (caught live by the self-application CI).
consumer_dry="$WORK/consumer-dry"
mkdir -p "$consumer_dry"
run_dry() (
  PKG_ROOT="$REPO_ROOT" PROJECT_ROOT="$consumer_dry" PROFILE=core FORCE='' DRY_RUN='--dry-run' REFRESH='' WITH_AIF_SUITE=''
  UPSTREAM_BLOB_URL='https://github.com/artyhoo/getff/blob/main'
  SKIPPED=(); SHIPPED_DOCS=(); REFRESH_BASELINE_STAGED=()
  source "$REPO_ROOT/setup.d/lib.sh"
  source "$REPO_ROOT/setup.d/10-skills.sh"
  source "$REPO_ROOT/setup.d/20-agents.sh"
  install_portable_bindings
  refresh_baseline_flush
) > "$1" 2>&1
run_dry "$WORK/dry1.log"
run_dry "$WORK/dry2.log"
diff -q "$WORK/dry1.log" "$WORK/dry2.log"
! grep -qE 'getff-(portable|bootstrap)\.[A-Za-z0-9]' "$WORK/dry1.log"
echo 'PASS canonical binding payload, profiles, helpers, customized upgrade, repeat install, refresh ownership and dry-run determinism'
