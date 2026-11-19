#!/usr/bin/env bash
# lint-baseline-pass-unpruned.test.sh — P2 cold review M2. When the install records the existing ESLint
# findings in eslint-suppressions.json (ESLint bulk suppressions), a later fix of one of them leaves a
# suppression that no longer occurs, and a plain `eslint .` then exits 2 («There are suppressions
# left that do not occur anymore»): the armed `npm run lint` in CI turns red because old code got
# better. setup.d/lib.sh lint_script_pass_unpruned adds --pass-on-unpruned-suppressions to getff's
# own ESLint `lint` script, and to nothing else.
#   (A) getff's `eslint …` lint script gains the flag once; a second call does not add it again
#   (B) a lint script that is not ESLint (oxlint) is left as it is
#   (C) the rest of package.json is kept (other scripts, dependencies, the key order)
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
# shellcheck source=setup.d/lib.sh
. "$REPO_ROOT/setup.d/lib.sh"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
script_of() { node -e 'console.log(require(process.argv[1]).scripts[process.argv[2]])' "$1/package.json" "$2"; }

mkdir -p "$T/a"
printf '{\n  "name": "a",\n  "scripts": {\n    "build": "tsc -b",\n    "lint": "eslint . --max-warnings=0"\n  },\n  "devDependencies": {\n    "eslint": "^9.39.0"\n  }\n}\n' > "$T/a/package.json"
lint_script_pass_unpruned "$T/a"
[ "$(script_of "$T/a" lint)" = "eslint . --max-warnings=0 --pass-on-unpruned-suppressions" ] \
  && ok "(A) getff's ESLint lint script gains --pass-on-unpruned-suppressions" \
  || bad "(A) lint: $(script_of "$T/a" lint)"
lint_script_pass_unpruned "$T/a"
[ "$(grep -o -- '--pass-on-unpruned-suppressions' "$T/a/package.json" | wc -l | tr -d ' ')" = 1 ] \
  && ok "(A) a second call does not add the flag again" || bad "(A) flag added twice"
[ "$(script_of "$T/a" build)" = "tsc -b" ] && node -e 'const j=require(process.argv[1]);process.exit(Object.keys(j).join()==="name,scripts,devDependencies"&&j.devDependencies.eslint==="^9.39.0"?0:1)' "$T/a/package.json" \
  && ok "(C) other scripts, dependencies and the key order are kept" || bad "(C) package.json changed beyond the lint script"

mkdir -p "$T/b"
printf '{\n  "name": "b",\n  "scripts": {\n    "lint": "oxlint"\n  }\n}\n' > "$T/b/package.json"
cp "$T/b/package.json" "$T/b.before"
lint_script_pass_unpruned "$T/b"
cmp -s "$T/b/package.json" "$T/b.before" && ok "(B) an oxlint lint script is left byte for byte" || bad "(B) oxlint project changed"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
