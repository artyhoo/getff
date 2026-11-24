#!/usr/bin/env bash
# Isolated Git fixture: tracked-only payload and equal worktree/index link materialization.
set -euo pipefail
REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/getff-dist-canonical.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
fixture="$WORK/source with spaces"
mkdir -p "$fixture/scripts" "$fixture/packages/getff" "$fixture/.agents/procedures/example/helpers" \
  "$fixture/.claude/skills/example" "$fixture/setup.d" "$fixture/agents" "$fixture/skills" "$fixture/templates" "$fixture/packages/core" \
  "$fixture/plugin/hooks/lib" "$fixture/docs/site-quality" "$fixture/packages/getff/bin"
cp "$REPO_ROOT/scripts/build-getff-dist.sh" "$fixture/scripts/build-getff-dist.sh"
cp "$REPO_ROOT/packages/getff/package.json" "$fixture/packages/getff/package.json"
cp "$REPO_ROOT/packages/getff/.gitignore" "$fixture/packages/getff/.gitignore"
for file in README.md LICENSE bin/getff; do
  cp "$REPO_ROOT/packages/getff/$file" "$fixture/packages/getff/$file"
done
exclusions=(
  packages/core/backends/cargo/demo/crate/.gitignore
  packages/core/backends/cargo/fixtures/firing/invalid/.gitignore
  packages/core/backends/cargo/fixtures/firing/valid-clean/.gitignore
  packages/core/backends/cargo/fixtures/firing/valid/.gitignore
  packages/core/synthesizer/fixtures/live-generation/rust/firing/bad/.gitignore
  packages/core/synthesizer/fixtures/live-generation/rust/firing/good/.gitignore
)
for file in "${exclusions[@]}"; do
  mkdir -p "$fixture/$(dirname "$file")"
  cp "$REPO_ROOT/$file" "$fixture/$file"
done
for file in install.sh setup .prettierrc.json setup.d/test agents/test skills/test templates/test packages/core/test scripts/create-worktree.sh plugin/hooks/lib/hook-language.sh docs/site-quality/test; do
  printf 'tracked fixture payload\n' > "$fixture/$file"
done
printf '%s\n' '---' 'name: example' 'description: Example procedure' '---' 'Run helpers/probe.sh.' > "$fixture/.agents/procedures/example/SKILL.md"
printf '#!/usr/bin/env bash\necho HELPER_OK\n' > "$fixture/.agents/procedures/example/helpers/probe.sh"
chmod +x "$fixture/.agents/procedures/example/helpers/probe.sh"
ln -s '../../../.agents/procedures/example/SKILL.md' "$fixture/.claude/skills/example/SKILL.md"
ln -s '../../../.agents/procedures/example/helpers' "$fixture/.claude/skills/example/helpers"
# Directory links are unsupported authored payloads; file compatibility links are tracked.
rm "$fixture/.claude/skills/example/helpers"
mkdir "$fixture/.claude/skills/example/helpers"
ln -s '../../../../.agents/procedures/example/helpers/probe.sh' "$fixture/.claude/skills/example/helpers/probe.sh"
git -C "$fixture" init -q
git -C "$fixture" add .
printf 'must never ship\n' > "$fixture/.agents/procedures/example/untracked-secret.txt"
bash "$fixture/scripts/build-getff-dist.sh" > "$WORK/build.log"
[ ! -e "$fixture/packages/getff/.agents/procedures/example/untracked-secret.txt" ]
[ ! -L "$fixture/packages/getff/.claude/skills/example/SKILL.md" ]
cmp "$fixture/packages/getff/.claude/skills/example/SKILL.md" "$fixture/packages/getff/.agents/procedures/example/SKILL.md"
git -C "$fixture" add packages/getff/MANIFEST.sha256
bash "$fixture/scripts/build-getff-dist.sh" --check-index > "$WORK/index.log"
printf 'worktree-only change\n' >> "$fixture/.agents/procedures/example/SKILL.md"
bash "$fixture/scripts/build-getff-dist.sh" --check-index > "$WORK/index-unchanged.log"
if bash "$fixture/scripts/build-getff-dist.sh" --check > "$WORK/drift.log" 2>&1; then
  echo 'FAIL worktree drift escaped manifest check'; exit 1
fi
git -C "$fixture" checkout -- .agents/procedures/example/SKILL.md
bash "$fixture/scripts/build-getff-dist.sh" --check > "$WORK/check.log"
# An indexed compatibility entry may never pull arbitrary host bytes into a pack.
ln -s "$WORK/host-private.txt" "$fixture/.agents/procedures/example/unsafe.txt"
printf 'host-only bytes\n' > "$WORK/host-private.txt"
git -C "$fixture" add .agents/procedures/example/unsafe.txt
if bash "$fixture/scripts/build-getff-dist.sh" > "$WORK/unsafe.log" 2>&1; then
  echo 'FAIL external tracked symlink escaped the package boundary'; exit 1
fi
git -C "$fixture" rm -q -f .agents/procedures/example/unsafe.txt
bash "$fixture/scripts/build-getff-dist.sh" > "$WORK/rebuild.log"
(cd "$fixture/packages/getff" && npm pack --ignore-scripts --silent --cache "$WORK/npm-cache" --pack-destination "$WORK") > "$WORK/pack.log"
mkdir "$WORK/unpacked"
tar -xzf "$WORK/$(cat "$WORK/pack.log")" -C "$WORK/unpacked"
# Distinct normal lifecycle pack: prepack must finish without recursive npm packing.
mkdir "$WORK/normal" "$fixture/nested cwd"
(cd "$fixture/packages/getff" && npm pack --json --cache "$WORK/npm-cache" --pack-destination "$WORK/normal") > "$WORK/normal.json"
archive="$WORK/normal/$(node -e 'const a=require("fs").readdirSync(process.argv[1]).filter(p=>p.endsWith(".tgz")); if(a.length!==1)throw Error("expected one normal archive"); console.log(a[0])' "$WORK/normal")"
(cd "$fixture/nested cwd" && bash ../scripts/build-getff-dist.sh --check-packed "$archive")
reject() {
  local label="$1" expected="$2"; shift 2
  local status=0
  "$@" > "$WORK/$label.log" 2>&1 || status=$?
  if [ "$status" -ne 1 ] || ! grep -F "$expected" "$WORK/$label.log"; then
    cat "$WORK/$label.log" >&2
    echo "FAIL $label: expected rejection 1 containing $expected, got $status" >&2; exit 1
  fi
  echo "PASS $label rejected"
}
# Mutate actual normal archive bytes, keeping independent fixture expectations unchanged.
node - "$archive" "$WORK" <<'NODE'
const fs = require('fs'), cp = require('child_process'), path = require('path'), crypto = require('crypto'), zlib = require('zlib');
const [archive, work] = process.argv.slice(2);
const helper = '.agents/procedures/example/helpers/probe.sh';
for (const mode of ['missing-runtime','changed-runtime','extra-member','changed-metadata','self-consistent-tamper']) {
  const dir = path.join(work, mode); fs.mkdirSync(dir);
  cp.execFileSync('tar', ['-xzf', archive, '-C', dir]);
  const root = path.join(dir, 'package');
  if (mode === 'missing-runtime') fs.unlinkSync(path.join(root, helper));
  if (mode === 'changed-runtime' || mode === 'self-consistent-tamper') fs.appendFileSync(path.join(root, helper), 'echo TAMPERED\n');
  if (mode === 'extra-member') fs.writeFileSync(path.join(root, 'extra.txt'), 'unexpected\n');
  if (mode === 'changed-metadata') fs.appendFileSync(path.join(root, 'README.md'), 'tampered\n');
  if (mode === 'self-consistent-tamper') {
    const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, helper))).digest('hex');
    const mf = path.join(root, 'MANIFEST.sha256');
    fs.writeFileSync(mf, fs.readFileSync(mf, 'utf8').split('\n').map(line => line.endsWith('  '+helper) ? sha+'  '+helper : line).join('\n'));
  }
  const list = cp.execFileSync('find', ['package', '-type', 'f', '-print0'], {cwd: dir});
  const packed = cp.spawnSync('tar', ['-czf', path.join(work, mode+'.tgz'), '--null', '-T', '-'], {cwd: dir, input: list});
  if (packed.status !== 0) throw new Error(packed.stderr.toString());
}
// Deliberate unsafe archive headers: real gate must reject before extraction.
function header(name, type='0') {
  const b=Buffer.alloc(512); b.write(name); b.write('0000644\0',100); b.write('0000000\0',108); b.write('0000000\0',116);
  b.write('00000000000\0',124); b.write('00000000000\0',136); b.fill(32,148,156); b.write(type,156);
  if(type==='2') b.write('/tmp/getff-never-follow',157);
  b.write('ustar\0',257); b.write('00',263);
  const sum=b.reduce((a,v)=>a+v,0); b.write(sum.toString(8).padStart(6,'0')+'\0 ',148); return b;
}
for (const [mode, headers] of [['duplicate-member',[header('package/README.md'),header('package/README.md')]],['nonregular-member',[header('package/link','2')]],['traversal-member',[header('package/../escape')]]]) {
  fs.writeFileSync(path.join(work,mode+'.tgz'), zlib.gzipSync(Buffer.concat([...headers,Buffer.alloc(1024)])));
}
NODE
for label in missing-runtime changed-runtime extra-member changed-metadata self-consistent-tamper; do
  reject "$label" 'PACKED:' bash "$fixture/scripts/build-getff-dist.sh" --check-packed "$WORK/$label.tgz"
done
for label in duplicate-member nonregular-member traversal-member; do
  reject "$label" 'PACKED:' bash "$fixture/scripts/build-getff-dist.sh" --check-packed "$WORK/$label.tgz"
done
printf 'unexpected ignore\n' > "$fixture/packages/core/.gitignore"
git -C "$fixture" add packages/core/.gitignore
bash "$fixture/scripts/build-getff-dist.sh" > "$WORK/seventh-build.log"
reject unexpected-seventh-exclusion 'PACKED:' bash "$fixture/scripts/build-getff-dist.sh" --check
git -C "$fixture" rm -q -f packages/core/.gitignore
bash "$fixture/scripts/build-getff-dist.sh" > "$WORK/restore-build.log"
git -C "$fixture" add packages/getff/MANIFEST.sha256
witness="${exclusions[0]}"
cp "$fixture/packages/getff/MANIFEST.sha256" "$WORK/preserved.manifest"
printf 'changed\n' > "$fixture/$witness"
reject source-witness-changed 'SOURCE:' bash "$fixture/scripts/build-getff-dist.sh"
git -C "$fixture" add "$witness"
cp "$REPO_ROOT/$witness" "$fixture/$witness"
reject staged-witness-bad-unstaged-good 'SOURCE:' bash "$fixture/scripts/build-getff-dist.sh" --check-index
git -C "$fixture" add "$witness"
rm "$fixture/$witness"
reject source-witness-missing 'ENOENT' bash "$fixture/scripts/build-getff-dist.sh"
cp "$REPO_ROOT/$witness" "$fixture/$witness"
git -C "$fixture" rm -q -f "$witness"
reject source-witness-untracked 'SOURCE:' bash "$fixture/scripts/build-getff-dist.sh"
cmp "$WORK/preserved.manifest" "$fixture/packages/getff/MANIFEST.sha256"
mkdir -p "$fixture/$(dirname "$witness")"
cp "$REPO_ROOT/$witness" "$fixture/$witness"
git -C "$fixture" add "$witness"
rm "$fixture/$witness"
ln -s '../../fixtures/firing/valid/.gitignore' "$fixture/$witness"
git -C "$fixture" add "$witness"
reject source-witness-symlink 'SOURCE:' bash "$fixture/scripts/build-getff-dist.sh"
reject staged-witness-symlink 'SOURCE:' bash "$fixture/scripts/build-getff-dist.sh" --check-index
rm "$fixture/$witness"
cp "$REPO_ROOT/$witness" "$fixture/$witness"
git -C "$fixture" add "$witness"
# core.symlinks=false can present an index symlink as an ordinary exact-byte file.
# Isolate witness mode from compatibility aliases already exercised above.
# Under false-symlink checkout those aliases otherwise become literal link text.
for file in .claude/skills/example/SKILL.md .claude/skills/example/helpers/probe.sh; do
  alias_blob="$(git -C "$fixture" hash-object -w --stdin < "$fixture/$file")"
  git -C "$fixture" update-index --cacheinfo "100644,$alias_blob,$file"
done
git -C "$fixture" config core.symlinks false
blob="$(printf '/target\n' | git -C "$fixture" hash-object -w --stdin)"
git -C "$fixture" update-index --cacheinfo "120000,$blob,$witness"
git -C "$fixture" checkout-index -f -- "$witness"
[ ! -L "$fixture/$witness" ]
cmp "$REPO_ROOT/$witness" "$fixture/$witness"
reject source-index-symlink-regular-checkout 'SOURCE:' bash "$fixture/scripts/build-getff-dist.sh"
reject staged-index-symlink-regular-checkout 'SOURCE:' bash "$fixture/scripts/build-getff-dist.sh" --check-index
cp "$fixture/.git/index" "$WORK/symlink-mode.index"
git -C "$fixture" update-index --cacheinfo "100644,$blob,$witness"
reject alternate-index-symlink-mode 'SOURCE:' env GIT_INDEX_FILE="$WORK/symlink-mode.index" bash "$fixture/scripts/build-getff-dist.sh" --check-index
# Both regular modes remain valid; physical bytes and ordinary aliases still apply.
git -C "$fixture" update-index --cacheinfo "100755,$blob,$witness"
bash "$fixture/scripts/build-getff-dist.sh" --check-index
git -C "$fixture" update-index --cacheinfo "100644,$blob,$witness"
bash "$fixture/scripts/build-getff-dist.sh" --check-index
bash "$fixture/scripts/build-getff-dist.sh" --check-packed "$archive"
# Remove the authored fixture entirely: package helper execution cannot reach it.
rm -rf "$fixture"
[ -f "$WORK/unpacked/package/.agents/procedures/example/SKILL.md" ]
[ "$(bash "$WORK/unpacked/package/.claude/skills/example/helpers/probe.sh")" = HELPER_OK ]
# `grep .`, not `grep -q .`: under pipefail an early-exit grep SIGPIPEs find into rc=141,
# which `if` reads as false — the failing case would hollow-pass. Consuming grep keeps the
# pipeline's status truthful in both branches (rg is likewise not guaranteed on every host).
if find "$WORK/unpacked/package" -type l | grep .; then echo 'FAIL npm payload has a link'; exit 1; fi
echo 'PASS tracked-only canonical roots, npm link materialization, index isolation, drift and standalone helper closure'
