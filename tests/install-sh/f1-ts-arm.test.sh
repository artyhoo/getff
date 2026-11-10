#!/usr/bin/env bash
# cih-s1 F1 — "ship the dispatcher's node arm". The shipped dispatcher
# (packages/core/templates/shared/husky-pre-push.sh) execs
# `node $REPO_ROOT/packages/core/hooks/pre-push.bundle.mjs` when Node≥20 + that file is present,
# else falls to the bash fallback. This test runs the REAL install pipeline and asserts what
# lands under packages/core/hooks/.
#
# HISTORY. Until 2026-09-28 the node arm was pre-push.ts + its complete import closure (#735), a
# {"type":"module"} marker (#532) and the packages/core/eslint-rules barrel, run through tsx. A
# consumer that owns its eslint.config / tsconfig linted and type-checked those files as project
# code and went RED right after install. The hook now ships as ONE prebuilt zero-dependency .mjs
# (scripts/build-runtime-bundles.mjs), so this test asserts the bundle AND the absence of every
# piece of the old closure.
#
# PAIRED-NEGATIVE: the bash fallback must still land (the node arm is additive).
# INSTALL_ROOT overrides the framework tree under test (e.g. a `git archive` of another revision).
set -uo pipefail
REPO_ROOT="${INSTALL_ROOT:-$(git -C "$(dirname "$0")" rev-parse --show-toplevel)}"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

T=$(mktemp -d)
printf '{ "name": "f1t", "version": "0.0.0" }\n' > "$T/package.json"
( cd "$T" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force ) >/dev/null 2>&1

H="$T/packages/core/hooks"
B="$H/pre-push.bundle.mjs"

# The entrypoint the dispatcher execs, byte-identical to the framework's committed bundle.
if [ -f "$B" ] && cmp -s "$B" "$REPO_ROOT/packages/core/hooks/pre-push.bundle.mjs"; then
  ok "pre-push.bundle.mjs shipped, identical to the framework bundle (dispatcher node arm reachable)"
else
  bad "pre-push.bundle.mjs missing or differs from the framework bundle"
fi

# It loads on plain node with nothing else from getff beside it: importing the module resolves
# every static import but does not run the hook. The path travels in the environment, not argv —
# `node -e <code> <path>` puts <path> in process.argv[1], which is exactly what the hook's
# direct-run guard compares against, so the hook would run instead of just loading.
if [ -f "$B" ] && ( cd "$T" && F1_BUNDLE="$B" node -e 'import(process.env.F1_BUNDLE).then(()=>process.exit(0),(e)=>{console.error(e.message);process.exit(1)})' ) >/dev/null 2>&1; then
  ok "the shipped bundle loads on plain node (no tsx, no ERR_MODULE_NOT_FOUND)"
else
  bad "the shipped bundle does not load on plain node"
fi

# PAIRED-NEGATIVE arm — fallback still lands (the node arm is additive, not a replacement).
[ -f "$H/pre-push.fallback.sh" ] && ok "neg: bash fallback still shipped (node arm is additive)" || bad "neg: fallback lost"

# None of the old closure lands: the consumer's own eslint / tsc would check it as project code.
_ts=$(cd "$T" && find packages/core -name '*.ts' 2>/dev/null | sort)
[ -z "$_ts" ] && ok "no TypeScript hook source under packages/core/" || bad "TypeScript hook source shipped:
$_ts"
[ ! -e "$H/package.json" ] && ok "no hooks/package.json type:module marker (a .mjs needs none)" || bad "hooks/package.json still shipped"
[ ! -e "$T/packages/core/eslint-rules" ] && ok "no packages/core/eslint-rules/ barrel copy" || bad "packages/core/eslint-rules/ still shipped"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
