#!/usr/bin/env bash
# Exercise the public procedure rename through real portable install/refresh seams.
set -euo pipefail
REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/getff-tool-binding.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
consumer="$WORK/outer repository/consumer project with spaces"
mkdir -p "$consumer/nested cwd/deeper" "$WORK/outer repository/.agents/procedures/tool-bootstrapping"
printf 'outer project sentinel\n' > "$WORK/outer repository/.agents/procedures/tool-bootstrapping/SKILL.md"
git init -q "$WORK/outer repository"
deliver() (
  PKG_ROOT="$REPO_ROOT" PROJECT_ROOT="$consumer" PROFILE=core
  FORCE="" DRY_RUN="" REFRESH="${1:-}" WITH_AIF_SUITE=""
  UPSTREAM_BLOB_URL="https://github.com/artyhoo/getff/blob/main"
  SKIPPED=(); SHIPPED_DOCS=(); REFRESH_BASELINE_STAGED=()
  source "$REPO_ROOT/setup.d/lib.sh"
  if [ -n "$REFRESH" ]; then refresh_skill_with_transform tool-bootstrapping
  else copy_skill_with_transform tool-bootstrapping; fi
  install_portable_bindings
  refresh_baseline_flush
) > "$WORK/install.log" 2>&1
verify() {
  node - "$consumer" "$REPO_ROOT" <<'NODE'
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const [suppliedRoot, repo] = process.argv.slice(2), root = fs.realpathSync(suppliedRoot);
const canonical = path.join(root, '.agents/procedures/tool-bootstrapping/SKILL.md');
const text = fs.readFileSync(canonical, 'utf8');
const binding = text.split('<!-- getff:common-invocation-binding -->')[1].split('<!-- /getff:common-invocation-binding -->')[0];
const target = binding.match(/contains `([^`]+)`/)[1];
let resolved = path.join(root, 'nested cwd/deeper');
while (!fs.existsSync(path.join(resolved, target))) {
  const parent = path.dirname(resolved);
  if (parent === resolved) throw Error(`installed common binding cannot resolve ${target}`);
  resolved = parent;
}
if (resolved !== root) throw Error(`bound enclosing repository instead of consumer: ${resolved}`);
if (fs.existsSync(path.join(root, '.agents/procedures/tool-bootstrapping-consumer'))) throw Error('source owner slug leaked into delivery');
for (const host of ['.claude', '.zcode']) {
  if (!fs.readFileSync(path.join(root, host, 'skills/tool-bootstrapping/SKILL.md')).equals(fs.readFileSync(canonical))) throw Error(`${host} binding differs`);
}
for (const resource of ['references/decision-format.md', 'templates/tool-decisions.md.template']) {
  if (!fs.existsSync(path.join(root, '.agents/procedures/tool-bootstrapping', resource))) throw Error(`missing resource ${resource}`);
}
const card = fs.readFileSync(path.join(root, '.agents/skills/tool-bootstrapping/SKILL.md'), 'utf8');
const block = card.match(/```bash\n([\s\S]*?)```/)[1];
const bound = cp.execFileSync('bash', ['-c', block + '\nprintf "%s" "$GETFF_PROJECT_ROOT"'], {cwd:path.join(root, 'nested cwd/deeper'), encoding:'utf8'});
if (fs.realpathSync(bound) !== root) throw Error('Codex discovery and canonical binding disagree');
const missing = cp.spawnSync('bash', ['-c', block], {cwd:path.dirname(path.dirname(root)), encoding:'utf8'});
if (missing.status !== 2 || !missing.stderr.includes('installed procedure root missing')) throw Error('missing installed root did not reject');
const owner = fs.readFileSync(path.join(repo, '.agents/procedures/tool-bootstrapping-consumer/SKILL.md'), 'utf8');
if (!owner.includes('contains `.agents/procedures/tool-bootstrapping-consumer/SKILL.md`')) throw Error('source owner identity changed');
NODE
}
deliver
verify
deliver
verify
deliver --refresh
verify
# An explicit canonical customization remains owned by the consumer on refresh.
printf 'consumer binding customization\n' > "$consumer/.agents/procedures/tool-bootstrapping/SKILL.md"
touch "$consumer/.agents/procedures/tool-bootstrapping.override.md"
deliver --refresh
[ "$(cat "$consumer/.agents/procedures/tool-bootstrapping/SKILL.md")" = 'consumer binding customization' ]
# Consumer-only rewrite must leave source checkout and provenance text unchanged.
(
  PKG_ROOT="$REPO_ROOT" PROJECT_ROOT="$REPO_ROOT" UPSTREAM_BLOB_URL="https://github.com/artyhoo/getff/blob/main"
  source "$REPO_ROOT/setup.d/lib.sh"
  cp "$REPO_ROOT/.agents/procedures/tool-bootstrapping-consumer/SKILL.md" "$WORK/source.md"
  transform_internal_refs "$WORK/source.md"
  grep -q 'contains `.agents/procedures/tool-bootstrapping-consumer/SKILL.md`' "$WORK/source.md"
  PROJECT_ROOT="$consumer"
  printf '\nSource owner: `.agents/procedures/tool-bootstrapping-consumer/SKILL.md`\n' >> "$WORK/source.md"
  transform_internal_refs "$WORK/source.md"
  grep -q 'contains `.agents/procedures/tool-bootstrapping/SKILL.md`' "$WORK/source.md"
  grep -q '^Source owner: `.agents/procedures/tool-bootstrapping-consumer/SKILL.md`' "$WORK/source.md"
  transform_internal_refs "$WORK/source.md"
  grep -q '^Source owner: `.agents/procedures/tool-bootstrapping-consumer/SKILL.md`' "$WORK/source.md"
)
echo 'PASS: public tool-bootstrapping binding resolves real installed resources from nested space cwd; repeat/refresh and source ownership preserved'
