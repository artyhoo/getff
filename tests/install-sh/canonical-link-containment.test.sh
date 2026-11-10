#!/usr/bin/env bash
# Native file links may load common sources; they never authorize an external write.
set -euo pipefail
REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/getff-link-containment.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
PROJECT_ROOT="$WORK/consumer" PKG_ROOT="$WORK/source"
FORCE=--force DRY_RUN='' REFRESH='' UPSTREAM_BLOB_URL=https://example.test/blob/main
SKIPPED=(); REFRESH_BASELINE_STAGED=()
mkdir -p "$PROJECT_ROOT/.agents/roles" "$PROJECT_ROOT/.claude/agents" "$PKG_ROOT/.agents/procedures/demo"
source "$REPO_ROOT/setup.d/lib.sh"
canonical="$PROJECT_ROOT/.agents/roles/demo.md"
printf '[Docs](../../docs/guide.md)\n' > "$canonical"
cp "$canonical" "$WORK/external.md"
external="$PROJECT_ROOT/.claude/agents/external.md"
ln -s "$WORK/external.md" "$external"
cp "$WORK/external.md" "$WORK/before.md"
transform_internal_refs "$external" > "$WORK/transform.log"
cmp "$WORK/external.md" "$WORK/before.md"
printf 'incoming changed body\n' > "$WORK/incoming.md"
copy_safe "$WORK/incoming.md" "$external" > "$WORK/force.log"
refresh_safe "$WORK/incoming.md" "$external" > "$WORK/refresh.log"
cmp "$WORK/external.md" "$WORK/before.md"
# Equal bytes cannot bless a consumer's external native link as our managed alias.
_portable_alias "$canonical" "$external" > "$WORK/alias.log"
[ "$(readlink "$external")" = "$WORK/external.md" ]
internal="$PROJECT_ROOT/.claude/agents/demo.md"
ln -s '../../.agents/roles/demo.md' "$internal"
refresh_safe "$WORK/before.md" "$internal" > "$WORK/internal.log"
transform_internal_refs "$internal"
[ -L "$internal" ]
grep -q 'https://example.test/blob/main/docs/guide.md' "$canonical"
# A canonical source-fixture alias is supported when explicitly post-processing it.
source_body="$PKG_ROOT/.agents/procedures/demo/SKILL.md"
printf '[Docs](../../../docs/source.md)\n' > "$source_body"
ln -s "$source_body" "$WORK/source-entry.md"
transform_internal_refs "$WORK/source-entry.md"
grep -q 'https://example.test/blob/main/docs/source.md' "$source_body"
# Repeating a forced install materializes the bootstrap, never its native source link.
mkdir -p "$PKG_ROOT/.claude/templates"
printf 'starter bootstrap\n' > "$PKG_ROOT/.claude/templates/session-bootstrap.md"
printf 'consumer bootstrap\n' > "$PROJECT_ROOT/.agents/session-bootstrap.md"
ln -s '../.agents/session-bootstrap.md' "$PROJECT_ROOT/.claude/session-bootstrap.md"
GETFF_SKILLS_CORE='' GETFF_SKILLS_ENV='' GETFF_SKILLS_FACTORY=''
install_portable_bindings > "$WORK/bootstrap-repeat.log"
[ ! -L "$PROJECT_ROOT/.agents/session-bootstrap.md" ]
grep -q '^consumer bootstrap$' "$PROJECT_ROOT/.agents/session-bootstrap.md"
# A foreign native bootstrap stays consumer-owned without an external canonical link.
rm "$PROJECT_ROOT/.claude/session-bootstrap.md" "$PROJECT_ROOT/.agents/session-bootstrap.md"
ln -s "$WORK/external.md" "$PROJECT_ROOT/.claude/session-bootstrap.md"
install_portable_bindings > "$WORK/bootstrap-external.log"
[ "$(readlink "$PROJECT_ROOT/.claude/session-bootstrap.md")" = "$WORK/external.md" ]
[ ! -L "$PROJECT_ROOT/.agents/session-bootstrap.md" ]
grep -q '^starter bootstrap$' "$PROJECT_ROOT/.agents/session-bootstrap.md"
cmp "$WORK/external.md" "$WORK/before.md"
# A symlinked common directory does not turn an external tree into consumer scope.
PROJECT_ROOT="$WORK/alternate-consumer"
mkdir -p "$PROJECT_ROOT" "$WORK/outside-common/roles"
printf '[Docs](../../docs/external.md)\n' > "$WORK/outside-common/roles/demo.md"
cp "$WORK/outside-common/roles/demo.md" "$WORK/outside-before.md"
ln -s "$WORK/outside-common" "$PROJECT_ROOT/.agents"
ln -s '.agents/roles/demo.md' "$PROJECT_ROOT/native.md"
transform_internal_refs "$PROJECT_ROOT/native.md" > "$WORK/directory-link.log"
cmp "$WORK/outside-common/roles/demo.md" "$WORK/outside-before.md"
_portable_alias "$PROJECT_ROOT/.agents/roles/demo.md" "$PROJECT_ROOT/new-native.md" > "$WORK/directory-alias.log"
[ ! -e "$PROJECT_ROOT/new-native.md" ]
echo 'PASS external native targets retained through transform/force/refresh/alias; managed common aliases still refresh and transform'
