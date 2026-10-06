#!/usr/bin/env bash
# Isolated Git fixture: tracked-only payload and equal worktree/index link materialization.
set -euo pipefail
REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/getff-dist-canonical.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
fixture="$WORK/source"
mkdir -p "$fixture/scripts" "$fixture/packages/getff" "$fixture/.agents/procedures/example/helpers" \
  "$fixture/.claude/skills/example" "$fixture/setup.d" "$fixture/agents" "$fixture/skills" "$fixture/templates" "$fixture/packages/core"
cp "$REPO_ROOT/scripts/build-getff-dist.sh" "$fixture/scripts/build-getff-dist.sh"
cp "$REPO_ROOT/packages/getff/package.json" "$fixture/packages/getff/package.json"
cp "$REPO_ROOT/packages/getff/.gitignore" "$fixture/packages/getff/.gitignore"
for file in install.sh setup .prettierrc.json setup.d/test agents/test skills/test templates/test packages/core/test scripts/create-worktree.sh; do
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
# Remove the authored fixture entirely: package helper execution cannot reach it.
rm -rf "$fixture"
[ -f "$WORK/unpacked/package/.agents/procedures/example/SKILL.md" ]
[ "$(bash "$WORK/unpacked/package/.claude/skills/example/helpers/probe.sh")" = HELPER_OK ]
# `grep .`, not `grep -q .`: under pipefail an early-exit grep SIGPIPEs find into rc=141,
# which `if` reads as false — the failing case would hollow-pass. Consuming grep keeps the
# pipeline's status truthful in both branches (rg is likewise not guaranteed on every host).
if find "$WORK/unpacked/package" -type l | grep .; then echo 'FAIL npm payload has a link'; exit 1; fi
echo 'PASS tracked-only canonical roots, npm link materialization, index isolation, drift and standalone helper closure'
