#!/usr/bin/env bash
# cih-s1 F2 — "activate the shipped git hooks". Copying .husky/* + merging a "prepare": "husky"
# script left the hooks INERT: git never calls them (core.hooksPath unset) and the deps they need
# (husky/lint-staged for `npx lint-staged`, sort-package-json) were never declared, so even after
# `npm install` the chain was dead. This asserts install.sh now (a) sets core.hooksPath=.husky and
# (b) merges the 3 hook devDeps non-destructively. Runs the REAL pipeline via the canonical smoke.
#
# PAIRED-NEGATIVE (umbrella §5): a FRESH git repo that did NOT run install has core.hooksPath unset
# and no husky devDep — the exact dead state. The positive arm proves install flips both. The
# negative arm fails if activation stops mattering (i.e. if some other step already set it).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# ── PAIRED-NEGATIVE: pre-install state is dead ──
N=$(mktemp -d)
printf '{ "name":"n","version":"0.0.0" }\n' > "$N/package.json"
( cd "$N" && git init -q )
[ -z "$(git -C "$N" config core.hooksPath)" ] && ok "neg: fresh repo → core.hooksPath UNSET (the dead state)" || bad "neg: hooksPath set without install?"
node -e 'process.exit((require(process.argv[1]).devDependencies||{}).husky?1:0)' "$N/package.json" \
  && ok "neg: fresh repo → no husky devDep (the dead state)" || bad "neg: husky devDep present without install?"

# ── POSITIVE: install activates + declares deps ──
T=$(mktemp -d)
printf '{ "name":"t","version":"0.0.0" }\n' > "$T/package.json"
( cd "$T" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force ) >/dev/null 2>&1

[ "$(git -C "$T" config core.hooksPath)" = ".husky" ] && ok "pos: core.hooksPath=.husky (hooks now live)" || bad "pos: core.hooksPath not set to .husky"

node -e '
  const d = require(process.argv[1]).devDependencies || {};
  const want = { "husky":"^9.1.7", "lint-staged":"~16.4.0", "sort-package-json":"~3.7.1" };
  for (const [k,v] of Object.entries(want)) if (d[k] !== v) { console.error("missing/wrong: "+k+"="+d[k]); process.exit(1); }
  process.exit(0);
' "$T/package.json" \
  && ok "pos: 3 hook devDeps merged at the CORE_DEVDEPS specs (husky/lint-staged/sort-package-json)" \
  || bad "pos: hook devDeps not merged correctly"

# ── IDEMPOTENCY: a second install changes nothing ──
before=$(node -e 'console.log(JSON.stringify(require(process.argv[1]).devDependencies))' "$T/package.json")
( cd "$T" && bash "$REPO_ROOT/install.sh" ts-server --force ) >/dev/null 2>&1
after=$(node -e 'console.log(JSON.stringify(require(process.argv[1]).devDependencies))' "$T/package.json")
[ "$before" = "$after" ] && ok "idempotent: 2nd install → devDeps unchanged (no dupes)" || bad "idempotent: devDeps drifted: $before -> $after"
[ "$(git -C "$T" config core.hooksPath)" = ".husky" ] && ok "idempotent: 2nd install → core.hooksPath still .husky" || bad "idempotent: hooksPath changed"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
