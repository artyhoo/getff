#!/usr/bin/env bash
# Consumer-matrix OWN-CONFIG CELL: install getff into a project that already owns its toolchain
# configs, then run the whole INSTALL-FOR-AI.md step-4 list (operator decision Q4.3, 2026-09-28).
#
# WHY THIS CELL EXISTS. The sibling fresh-install job (audit-self.yml
# `framework-fresh-install-validate`, fixture `empty-manifest`) installs into an EMPTY package.json.
# There getff's own eslint.config.mjs / tsconfig.json / .prettierignore always land, and they
# ignore everything getff ships — so nothing getff puts in the consumer tree is ever linted or
# type-checked by a config getff does not control. A real project is the opposite case: it
# already HAS an eslint.config.mjs and a tsconfig.json, copy_safe keeps them, and from then on
# the CONSUMER's tools check every file getff delivered. getff never edits the tsconfig.json; it
# adds its block to the eslint.config.mjs by insertions only — its rules, and an ignores entry for
# the lintable files it delivered — keeping the original under .ai-factory/before-getff/ (operator
# decision Q4.7, 2026-09-28; before it the install left the config alone and said «add it by
# hand», so getff's rules never ran in such a project). Measured 2026-09-28 on
# create-next-app 16.3.6 + `./setup -y react-next`: the install exited 0 while the consumer's own
# lint, typecheck, test, build and validate all went RED on files getff shipped.
#
# STACK-NEUTRAL BY CONSTRUCTION. The fixture below is the SAME for every stack: a TypeScript
# project in the shape the common scaffolders leave behind — a flat eslint.config.mjs (the
# typescript-eslint getting-started config), a tsconfig.json whose include is the whole tree,
# its own `lint` + `build` scripts, a module and its unit test in a non-`src/` directory, and its
# own .gitignore. STACK only selects which getff preset is installed. There is deliberately no
# create-next-app / create-vite / create-expo-app arm: the class under test is «getff's delivery
# inside a consumer's own tool scope», not one scaffolder's defaults (operator, 2026-09-28: Next
# is only the test subject; getff is a generator for any stack).
#
# WHAT RUNS (INSTALL-FOR-AI.md step 4 + the verify command it hands the user):
#   typecheck · lint · test · build · validate · first commit (through the real shipped
#   pre-commit) · first push to a local bare remote (git runs the real shipped pre-push, which
#   must reach the full hook, not the bash fallback).
# Every step runs even after an earlier one fails, and the cell prints one PASS/FAIL line per step
# before exiting — a single run shows the whole picture instead of the first wall.
#
# GENERATOR ARM (N14 / critical-review S5-9). Runs when a committed research+selection pair exists
# for $STACK (packages/core/synthesizer/fixtures/*.research.json whose "framework" is $STACK) —
# data-driven, never a hard-coded stack. It re-runs the installer with the pair planted, the way
# agents/rule-researcher.md tells an operator to, under an EMPTY npm cache: that is the «clean
# machine» the generator must start on (a warm npx cache hid the missing tsx on the 2026-09-28
# probe). Asserts the generator wrote its lock and did not report failure.
#
# GREEN STAYS GREEN (P2 §5, operator log entry 28 fork 1 = A: the project's own setup wins). Before
# the install the cell runs every script the fixture's package.json has and pushes to a local bare
# remote, recording each exit code. After the install every step that was 0 before must be 0 again
# — known rot does not excuse it. Two more steps must be 0: the commit of the install's own files
# and the commit of a new one-line .ts file.
#
# FIXTURE=vite-shape (P2 §5.4) reproduces create-vite's shape without the scaffolder: oxlint with its
# own .oxlintrc.json, a solution tsconfig.json (`files: []` + references) whose app config has no
# `strict`, no prettier, `lint: oxlint`, `build: tsc -b`, no tests, branch `master`, no origin. It
# asserts the record's EXPECTED armed set by name after the first validate and push (C1: arming
# nothing cannot pass), and one paired negative per blocking channel: a planted non-fixable oxlint
# finding blocks the commit, an unresolvable lint-staged binary blocks the push (check:lintstaged —
# check:globs reads getff's ESLint config, which an oxlint project does not get, so it is not armed
# there), a planted TS2322 fails typecheck.
#
# FIXTURE=red-lint (P5 M7, owed by P2): a TypeScript React project with NO linter, no `strict`, and old
# code getff's rules flag with no autofix (require-error-boundary in src/App.tsx, react/no-array-index-key
# in src/List.tsx). getff fills the empty slot with its own ESLint config, so `lint` is getff's script and
# the arm pass runs it red: the typed rules that need strictNullChecks go off in getff's config
# (99-finalize.sh _pc_null_rules_off), ESLint's bulk suppressions record the rest (_pc_suppress), and
# `npm run lint` is armed. Asserts each of those by name, a new finding still failing the lint and the
# commit, a fixed old finding keeping the lint green, the baseline shrinking through the probe and the
# commit's fold (M2), and the rule table's proof through `npm run lint` (R2). Network: registry ESLint.
# Not here: per-file exemptions in a config the PROJECT owns (lib.sh place_lint_rules returns early on getff's
# own config) — tests/install-sh/synth-wire-consumer-config.test.sh arm R and prove-rules.test.ts cover those.
#
# Fail-closed: a missing tool is RED, never SKIP. Deterministic + API-free
# (.claude/rules/no-paid-llm-in-ci.md); the npm registry is the only network it touches, exactly
# like the sibling fresh-install cells.
#
# Usage: STACK=<ts-server|react-next|react-spa|react-native> [FIXTURE=own-config|vite-shape|red-lint] \
#          bash tests/consumer-matrix/own-config-cell.sh
#        (FRAMEWORK_ROOT defaults to this checkout; CELL_KEEP=1 keeps the work dir for debugging.)
set -euo pipefail

FRAMEWORK_ROOT="${FRAMEWORK_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
STACK="${STACK:-${1:-}}"
case "$STACK" in
  ts-server | react-next | react-spa | react-native) ;;
  *)
    echo "✗ own-config-cell: STACK must be one of ts-server|react-next|react-spa|react-native (got '${STACK}')" >&2
    exit 2
    ;;
esac
FIXTURE="${FIXTURE:-own-config}"
case "$FIXTURE" in
  own-config) BRANCH=main; SRC=lib ;;
  vite-shape) BRANCH=master; SRC=src ;;
  red-lint) BRANCH=main; SRC=src ;;
  *)
    echo "✗ own-config-cell: FIXTURE must be own-config|vite-shape|red-lint (got '${FIXTURE}')" >&2
    exit 2
    ;;
esac

WORK="$(mktemp -d "${TMPDIR:-/tmp}/own-config-cell-${STACK}.XXXXXX")"
if [ -z "${CELL_KEEP:-}" ]; then trap 'rm -rf "$WORK"' EXIT; fi
CONSUMER="$WORK/consumer"
LOG="$WORK/install.log"

fail() { echo "" ; echo "✗ FAIL: $*" >&2; exit 1; }
step() { echo ""; echo "── $*"; }

command -v npm >/dev/null 2>&1 || fail "npm unavailable — the cell cannot run; RED never SKIP"
command -v node >/dev/null 2>&1 || fail "node unavailable — the cell cannot run; RED never SKIP"

mkdir -p "$CONSUMER/$SRC" && cd "$CONSUMER"
git init -q -b "$BRANCH"
git config user.email ci@example.com
git config user.name CI
if [ "$FIXTURE" = own-config ]; then
step "fixture ($STACK): a TypeScript project that owns its eslint + tsconfig (scaffolder-default shape)"
# The consumer's configs, kept byte for byte (OWN_KEPT) or only added to (OWN_GROWS, Q4.7).
OWN_KEPT="tsconfig.json"; OWN_GROWS="eslint.config.mjs"; OWN_BINS="eslint tsc vitest"
# The record's expected entries after the first validate and push (C1), `|`-separated.
# typecheck is red on known rot K2 (getff's vitest.config.ts in the whole-tree include), so the
# install records it not-armed; once K2 is fixed and its entry deleted, this line fails until
# typecheck moves to EXPECT_ARMED.
EXPECT_ARMED="npm run lint|npm test|npm run format:check|npm run arch:check|bash scripts/check-lintstaged-resolves.sh"
EXPECT_NOT="npm run typecheck"
# The consumer's OWN toolchain, pinned inside the ranges getff itself installs (setup.d/70-deps.sh
# CORE_DEVDEPS) so the two installs agree and a failure below is about delivered files, never
# about a version fight between the fixture and the installer.
cat > package.json <<'JSON'
{
  "name": "own-config-consumer",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "lint": "eslint .",
    "build": "tsc -p tsconfig.json --noEmit false --outDir dist"
  },
  "devDependencies": {
    "@eslint/js": "^9",
    "eslint": "^9",
    "typescript": "^5.7.0",
    "typescript-eslint": "^8.59"
  }
}
JSON
printf 'node_modules/\ndist/\n.husky/_/\n' > .gitignore
# typescript-eslint's getting-started flat config — no `files` narrowing and no ignores for
# anything the consumer did not author, which is what most scaffolded configs look like.
cat > eslint.config.mjs <<'JS'
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**'] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
);
JS
# Whole-tree include (the create-next-app / tsc --init family): every .ts anywhere in the project,
# including whatever an installer adds later, is type-checked and built.
cat > tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "types": ["node"]
  },
  "include": ["**/*.ts", "**/*.tsx", "**/*.mts"],
  "exclude": ["node_modules", "dist"]
}
JSON
# The consumer's code and its unit test, side by side in a non-src/ directory.
printf 'export function answer(): number {\n  return 42;\n}\n' > lib/answer.ts
cat > lib/answer.test.ts <<'TS'
import { describe, expect, it } from 'vitest';
import { answer } from './answer';

describe('answer', () => {
  it('is 42', () => {
    expect(answer()).toBe(42);
  });
});
TS
# A new finding no autofix removes: tseslint's recommended no-unused-vars (pre-commit negative).
PLANT_LINT='const plantedUnused = 1;\n'; PLANT_LINT_ID='no-unused-vars'
elif [ "$FIXTURE" = vite-shape ]; then
step "fixture ($STACK): create-vite's shape — oxlint, a solution tsconfig, no strict, no prettier, no tests, master"
OWN_KEPT="tsconfig.json tsconfig.app.json"; OWN_GROWS=".oxlintrc.json"; OWN_BINS="oxlint tsc vitest"
# check:globs reads getff's ESLint config (none here, K4); format:check is red on create-vite's
# no-semicolon style under getff's prettier; `npm test` has no tests to run yet (C3).
EXPECT_ARMED="npm run lint|npm run typecheck|npm run arch:check|bash scripts/audit-ai-docs.sh|bash scripts/check-lintstaged-resolves.sh"
EXPECT_NOT="bash scripts/check-rule-globs.sh|npm run format:check|npm test"
# The fold scenario (advisor M4): after validate the developer adds the first test, so `npm test` —
# recorded not-armed «no test files yet» — turns green; the probe arms it in the sidecar and the
# install commit must carry it. From then on it is armed, not not-armed (FOLD_ARMS).
FOLD_FIX_FILE="$SRC/answer.test.ts"; FOLD_ARMS="npm test"
FOLD_FIX_BODY="import { expect, test } from 'vitest';\n\ntest('adds', () => {\n  expect(1 + 1).toBe(2);\n});\n"
cat > package.json <<'JSON'
{
  "name": "vite-shape-consumer",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc -b",
    "lint": "oxlint"
  },
  "devDependencies": {
    "@types/node": "^22",
    "oxlint": "^1.20.0",
    "typescript": "^5.8.0"
  }
}
JSON
printf 'node_modules/\ndist/\n.husky/_/\n' > .gitignore
printf '# vite-shape\n' > README.md
cat > .oxlintrc.json <<'JSON'
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "rules": {
    "react/rules-of-hooks": "error"
  }
}
JSON
cat > tsconfig.json <<'JSON'
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }]
}
JSON
# create-vite's app config: bundler mode and its lint flags, and no `strict`.
cat > tsconfig.app.json <<'JSON'
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM"],
    "module": "esnext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
JSON
# create-vite's code style: single quotes, no semicolons, .ts extensions in imports.
printf "export function greet(name: string): string {\n  return \`hello \${name}\`\n}\n" > src/greet.ts
printf "import { greet } from './greet.ts'\n\ndocument.title = greet('vite')\n" > src/main.ts
# A new finding no autofix removes: a hook called conditionally (the project's own oxlint rule).
PLANT_LINT='export function usePlanted(on: boolean) {\n  if (on) {\n    usePlantedInner()\n  }\n}\nfunction usePlantedInner() {}\n'
PLANT_LINT_ID='rules-of-hooks'
else
step "fixture ($STACK): a TypeScript React project with NO linter, no strict, and old code getff's rules flag"
# eslint and vitest are getff's here: the project has no linter of its own (GETFF_BINS).
OWN_KEPT="tsconfig.json"; OWN_GROWS=""; OWN_BINS="tsc eslint vitest"; GETFF_BINS="eslint vitest"
# The subject is the lint: getff's ESLint, red on the old code, armed once its baseline is recorded.
# typecheck is green here (no strict, correct types), so it arms and its negative runs.
EXPECT_ARMED="npm run lint|npm run typecheck"
EXPECT_NOT="npm test"
cat > package.json <<'JSON'
{
  "name": "red-lint-consumer",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "react": "^19",
    "react-dom": "^19"
  },
  "devDependencies": {
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "typescript": "^5.8.0"
  }
}
JSON
printf 'node_modules/\ndist/\n.husky/_/\n' > .gitignore
# No `strict`: the typed rules that need strictNullChecks cannot run (_pc_null_rules_off).
cat > tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
JSON
# Old code with findings no autofix removes: an app root with no error boundary, an index as a key.
printf 'export function App() {\n  return <main>Content</main>;\n}\n' > src/App.tsx
printf 'export function List({ items }: { items: string[] }) {\n  return (\n    <ul>\n      {items.map((item, i) => (\n        <li key={i}>{item}</li>\n      ))}\n    </ul>\n  );\n}\n' > src/List.tsx
# The fix of one old finding (M2): the item as the key.
FIX_FILE="$SRC/List.tsx"
FIX_BODY='export function List({ items }: { items: string[] }) {\n  return (\n    <ul>\n      {items.map((item) => (\n        <li key={item}>{item}</li>\n      ))}\n    </ul>\n  );\n}\n'
# A new finding no autofix removes: an explicit any (getff's strictTypeChecked config).
PLANT_LINT='export const planted: any = 1;\n'; PLANT_LINT_ID='no-explicit-any'
fi
git add -A
git commit -qm "consumer baseline"
FIXTURE_SHA=$(git rev-parse HEAD)
# The consumer's configs as they were: OWN_KEPT must stay byte for byte; OWN_GROWS may only GROW —
# every one of its lines still there, whole and in order (Q4.7: insertions only).
for f in $OWN_KEPT $OWN_GROWS; do cp "$f" "$WORK/own-$f.before"; done
configs_changed() { # prints each way an install broke the consumer's configs, with its first diff lines
  local f
  for f in $OWN_KEPT; do
    if ! cmp -s "$f" "$WORK/own-$f.before"; then
      echo "the install changed the consumer's own $f:"
      diff "$WORK/own-$f.before" "$f" | head -8 | sed 's/^/    /'
    fi
  done
  for f in $OWN_GROWS; do
    if ! awk 'NR == FNR { want[++n] = $0; next } i < n && $0 == want[i + 1] { i++ } END { exit !(i == n) }' \
        "$WORK/own-$f.before" "$f"; then
      echo "the install changed or removed a line of the consumer's own $f (only insertions are allowed):"
      diff "$WORK/own-$f.before" "$f" | grep '^<' | head -8 | sed 's/^/    /'
    fi
  done
  return 0
}
# getff's block is in the consumer's eslint.config.mjs, and the original is kept byte for byte.
# The part of the block every npm stack gets is the ignores entry for getff's rule plugin
# (setup.d/40-configs.sh delivers eslint-rules-local/ unconditionally). Which RULES it adds
# depends on the stack and the project — ts-server's only unconditional rule is R2, added once an
# HTTP boundary is found, and this fixture has none — so rules are not asserted here
# (tests/install-sh/synth-wire-consumer-config.test.sh covers them).
# An oxlint project gets no getff ESLint config at all: one linter (P2 G5/K4).
eslint_config_wired() {
  local f kept=""
  if [ "$FIXTURE" = red-lint ]; then
    if [ -f eslint.config.mjs ] && grep -qF 'eslint-rules-local' eslint.config.mjs; then return 0; fi
    echo "the project has no linter, and getff did not fill the slot with its ESLint config"; return 1
  fi
  if [ "$FIXTURE" = vite-shape ]; then
    for f in eslint.config.*; do
      [ -e "$f" ] && { echo "getff placed $f beside the project's oxlint — two linters (K4)"; return 1; }
    done
    return 0
  fi
  grep -qF "'eslint-rules-local/**'" eslint.config.mjs \
    || { echo "the consumer's eslint.config.mjs has no ignores entry for getff's eslint-rules-local/"; return 1; }
  for f in .ai-factory/before-getff/eslint.config.mjs.*; do [ -f "$f" ] && kept="$f"; done
  [ -n "$kept" ] && cmp -s "$kept" "$WORK/own-eslint.config.mjs.before" \
    || { echo "the consumer's original eslint.config.mjs is not kept under .ai-factory/before-getff/"; return 1; }
}

step "fixture installs its OWN deps (before getff, as a real project would have them)"
npm install --silent --no-audit --no-fund >"$WORK/own-install.log" 2>&1 \
  || { tail -20 "$WORK/own-install.log"; fail "fixture's own npm install failed"; }
for bin in $OWN_BINS; do
  case " vitest ${GETFF_BINS:-} " in *" $bin "*) continue ;; esac # getff's, not the fixture's
  test -x "node_modules/.bin/$bin" || fail "fixture's own $bin did not land"
done

step "before the install: every script the fixture has, then a push to a local bare remote"
# Each exit code 0 here must still be 0 after the install (P2 §5: green stays green).
BEFORE_SCRIPTS=$(node -e 'console.log(Object.keys(require("./package.json").scripts || {}).join(" "))')
BEFORE_GREEN=""
for s in $BEFORE_SCRIPTS; do
  if npm run "$s" >"$WORK/before-${s//[^a-z0-9]/-}.log" 2>&1; then
    BEFORE_GREEN="$BEFORE_GREEN $s"; echo "  0   npm run $s"
  else
    echo "  ≠0  npm run $s — red before getff, so not held to green after it"
  fi
done
git init -q --bare "$WORK/before.git"
if git push -q "$WORK/before.git" "HEAD:refs/heads/$BRANCH" >"$WORK/before-push.log" 2>&1; then
  BEFORE_GREEN="$BEFORE_GREEN push"; echo "  0   git push"
else
  echo "  ≠0  git push — red before getff"
fi

step "getff clone: a copy of the framework tree WITHOUT its node_modules (what \`git clone\` gives a user)"
# INSTALL-FOR-AI.md step 3 runs the installer from a fresh clone, whose dependencies were never
# installed. The framework checkout this cell runs from HAS them (CI installs them, so does every
# dev worktree), and anything getff runs out of its own tree — tsx, ajv — would silently resolve
# there (N14: the 2026-09-28 probe died on ERR_MODULE_NOT_FOUND 'ajv' from a real clone). Copy the
# tracked + untracked-not-ignored files, which is the clone's content plus local edits. A tree that
# is not a git checkout (an rsync mirror) is copied whole, minus node_modules and nested worktrees.
GETFF="$WORK/getff"
mkdir -p "$GETFF"
framework_files() {
  if git -C "$FRAMEWORK_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git -C "$FRAMEWORK_ROOT" ls-files -z --cached --others --exclude-standard \
      | while IFS= read -r -d '' f; do if [ -e "$FRAMEWORK_ROOT/$f" ]; then printf '%s\0' "$f"; fi; done
  else
    ( cd "$FRAMEWORK_ROOT" && find . \( -name node_modules -o -name .git -o -path ./.claude/worktrees \) \
        -prune -o \( -type f -o -type l \) -print0 )
  fi
}
( framework_files | ( cd "$FRAMEWORK_ROOT" && tar --null -T - -cf - ) ) | tar -xf - -C "$GETFF" \
  || fail "could not copy the framework tree into $GETFF"
[ ! -e "$GETFF/node_modules" ] || fail "the getff copy has a node_modules — it would not reproduce a clone"
test -f "$GETFF/install.sh" || fail "the getff copy has no install.sh"

step "real installer: install.sh $STACK --full (the framework core of ./setup -y $STACK)"
set +e
bash "$GETFF/install.sh" "$STACK" --full >"$LOG" 2>&1
INSTALL_RC=$?
set -e
tail -25 "$LOG"
[ "$INSTALL_RC" -eq 0 ] || fail "install.sh rc=$INSTALL_RC (log tail above)"
for bin in $OWN_BINS; do
  test -x "node_modules/.bin/$bin" \
    || fail "$bin not installed after install.sh --full — the step-4 list below cannot run (false-green guard)"
done
# The premise of this cell: the consumer's configs survived the install — tsconfig.json untouched,
# eslint.config.mjs only added to, with getff's block in it and the original kept (Q4.7).
CHANGED=$(configs_changed)
[ -z "$CHANGED" ] || { echo "$CHANGED"; fail "install.sh rewrote a config the consumer owns — fixture premise broken"; }
WIRED=$(eslint_config_wired) || { echo "$WIRED"; fail "install.sh did not add getff's block to the consumer's eslint.config.mjs (Q4.7)"; }

# ── KNOWN ROT: preset-template defects this cell SHOWS but does not fail on ──────────────────────
# The entries, their signatures and why they are not patched: tests/consumer-matrix/known-rot.sh
# (operator decision Q4.4). Its matchers are tested on their own:
# tests/install-sh/own-config-known-rot.test.sh.
# shellcheck source=tests/consumer-matrix/known-rot.sh
. "$FRAMEWORK_ROOT/tests/consumer-matrix/known-rot.sh"
ROT_HITS=""

# ── INSTALL-FOR-AI.md step 4, every item, results collected ────────────────────────────────────
RESULTS=()
FAILED=0
expected_not_armed() { # $1 = step label → 0 when EXPECT_NOT lists that step's record command
  local c
  case "$1" in
    test) c="npm test" ;;
    typecheck | lint) c="npm run $1" ;;
    *) return 1 ;;
  esac
  case "|$EXPECT_NOT|" in *"|$c|"*) return 0 ;; esac
  return 1
}
step_log() { echo "$WORK/step-${1//[^a-z0-9]/-}.log"; }
run_step() { # $1 = label; rest = command
  local label="$1"; shift
  local out rc=0 rot
  out=$(step_log "$label")
  "$@" >"$out" 2>&1 || rc=$?
  if [ "$rc" -eq 0 ]; then
    RESULTS+=("PASS  $label")
    return 0
  fi
  rot=$(known_rot_for "$label" "$out")
  # A check the fixture expects the install to record not-armed (EXPECT_NOT) blocks nothing, so
  # its red run is the honest state; the record assert below proves it is recorded that way. Known
  # rot is matched first, so the strict «rot still reproduces» count below stays whole.
  if [ -z "$rot" ] && expected_not_armed "$label"; then
    RESULTS+=("NOT-ARMED  $label  (rc=$rc; expected — the record lists it not-armed)")
    return 0
  fi
  if [ -n "$rot" ]; then
    RESULTS+=("ROT   $label  (rc=$rc, known rot $rot — see KNOWN ROT above; not a new failure)")
    ROT_HITS="$ROT_HITS $rot:$label"
    echo "  ~ $label — known rot $rot:"
  else
    RESULTS+=("FAIL  $label  (rc=$rc)")
    FAILED=1
    echo "  ✗ $label — last lines:"
  fi
  tail -25 "$out" | sed 's/^/      /'
}

# validate_by_lane — `npm run validate` is one npm-run-all2 --parallel call over many lanes, and it
# aborts the others at the first failure, so its log cannot say which lanes are red. On failure
# each lane is run on its own (the typecheck / lint / test steps above are reused), and validate
# counts as known rot only when every red lane is. A validate script of any other shape stays FAIL.
validate_by_lane() {
  local lanes lane log red="" rot rc=0 explained=1
  npm run validate >"$(step_log validate)" 2>&1 || rc=$?
  if [ "$rc" -eq 0 ]; then
    RESULTS+=("PASS  validate")
    return 0
  fi
  lanes=$(node -e 'const s=(require("./package.json").scripts||{}).validate||"";
    const t=s.trim().split(/\s+/); if(!/^npm-run-all2?$|^run-p$/.test(t[0]||"")) process.exit(1);
    console.log(t.slice(1).filter(x=>!x.startsWith("-")).join(" "))') || lanes=""
  if [ -z "$lanes" ]; then
    RESULTS+=("FAIL  validate  (rc=$rc; not an npm-run-all2 lane list, cannot attribute)")
    FAILED=1
    tail -25 "$(step_log validate)" | sed 's/^/      /'
    return 0
  fi
  for lane in $lanes; do
    case "$lane" in
      typecheck | lint | test) log=$(step_log "$lane") ;;
      *) log=$(step_log "validate-$lane"); npm run "$lane" >"$log" 2>&1 && continue ;;
    esac
    case "$lane" in
      typecheck | lint | test)
        case " ${RESULTS[*]} " in *"PASS  $lane "*) continue ;; esac ;;
    esac
    rot=$(known_rot_for "$lane" "$log")
    red="$red $lane${rot:+[$rot]}"
    [ -n "$rot" ] || { explained=0; echo "  ✗ validate lane $lane — last lines:"; tail -25 "$log" | sed 's/^/      /'; }
  done
  if [ -z "$red" ]; then
    RESULTS+=("FAIL  validate  (rc=$rc; every lane passes on its own — the parallel run itself failed)")
    FAILED=1
    tail -25 "$(step_log validate)" | sed 's/^/      /'
  elif [ "$explained" -eq 1 ]; then
    RESULTS+=("ROT   validate  (rc=$rc; red lanes:$red — all known rot)")
  else
    RESULTS+=("FAIL  validate  (rc=$rc; red lanes:$red)")
    FAILED=1
  fi
}

step "step 4: typecheck · lint · test · build · validate"
run_step "typecheck" npm run typecheck
run_step "lint" npm run lint
run_step "test" npm test
run_step "build" npm run build
validate_by_lane
# The fixture's other scripts, each held to its before-install exit code below.
for s in $BEFORE_SCRIPTS; do
  case "$s" in typecheck | lint | test | build | validate) continue ;; esac
  run_step "script:$s" npm run "$s"
done
# validate's probe arms green checks in a per-clone sidecar in the git dir, never in the tracked record.
SIDECAR="$(git rev-parse --absolute-git-dir)/getff-armed.local"
if [ -n "${FOLD_FIX_FILE:-}" ]; then
  printf '%b' "$FOLD_FIX_BODY" > "$FOLD_FIX_FILE"
  bash scripts/run-armed.sh --probe > "$(step_log fold-probe)" 2>&1
fi
SIDE_AT_VALIDATE=$(cat "$SIDECAR" 2>/dev/null || true)

step "first commit through the real shipped pre-commit, then a new one-line .ts file"
run_step "first-commit" bash -c 'git add -A && git commit -qm "install getff"'
# The shipped pre-commit runs lint-staged, then folds the sidecar into the record and stages it: the
# flips the probe made ride this very commit, and the tree is clean after it (advisor M4). A fixture
# with a fold scenario sets FOLD_ARMS: a check its developer turns green after validate.
fold_rode_the_commit() {
  local c miss=""
  if [ -z "${FOLD_ARMS:-}" ]; then echo "this fixture has no fold scenario (nothing it can turn green)"; return 0; fi
  grep -qxF -- "$FOLD_ARMS" <<<"$SIDE_AT_VALIDATE" || { echo "the probe did not arm '$FOLD_ARMS' — the fold is not exercised: $(tail -5 "$(step_log fold-probe)")"; return 1; }
  while IFS= read -r c; do
    git show HEAD:.ai-factory/tool-decisions.md | awk '/^armed:$/{f=1;next} /^[a-z-]+:$/{f=0} f' | grep -qxF -- "- $c" || miss="$miss '$c'"
  done <<< "$SIDE_AT_VALIDATE"
  [ ! -s "$SIDECAR" ] || miss="$miss (sidecar not emptied)"
  git diff --quiet -- .ai-factory/tool-decisions.md || miss="$miss (record left dirty)"
  [ -z "$miss" ] && return 0; echo "not in the committed record:$miss"; return 1
}
run_step "fold: the probe's flips ride the install commit" fold_rode_the_commit
run_step "new-ts-commit" bash -c "printf 'export const answer = 42;\n' > '$SRC/answer42.ts' && git add '$SRC/answer42.ts' && git commit -qm 'add answer42'"

step "first push: git runs the shipped pre-push, which must reach the full hook, not the bash fallback"
# A real `git push` to a local bare remote, so git itself invokes the hook with the ref lines on
# stdin — exactly what the consumer's first push does. No network.
git init -q --bare "$WORK/remote.git"
git remote add origin "$WORK/remote.git"
first_push_runs_full_hook() {
  local out rc=0
  out=$(git push -u origin "$BRANCH" 2>&1) || rc=$?
  printf '%s\n' "$out"
  [ "$rc" -eq 0 ] || return 1
  # The fallback labels every line it prints with «fallback»; the full hook never does.
  if printf '%s\n' "$out" | grep -q 'fallback'; then
    echo "pre-push fell back to the bash critical-only hook"
    return 1
  fi
}
run_step "first-push" first_push_runs_full_hook

step "green stays green: every step that was 0 before the install is 0 after it"
for s in $BEFORE_GREEN; do
  case "$s" in
    push) label=first-push ;;
    typecheck | lint | test | build | validate) label=$s ;;
    *) label="script:$s" ;;
  esac
  printf '%s\n' "${RESULTS[@]}" | grep -qxF "PASS  $label" && continue
  RESULTS+=("FAIL  green stays green: '$s' exited 0 before the install and does not after it (log: $(step_log "$label"))")
  FAILED=1
done

# ── The record: which checks block, by name (C1: arming nothing cannot pass) ───────────────────
# Read after the first validate and push, which arm the project's own scripts once they exit 0 — as
# run-armed.sh reads it: the tracked record plus the per-clone sidecar the push's probe wrote.
record_section() { # $1 = armed | not-armed → its entries, one per line
  awk '/<!-- aif:project-checks:end -->/{f=0} f; /<!-- aif:project-checks:begin -->/{f=1}' .ai-factory/tool-decisions.md \
    | awk -v h="$1:" '/^[a-z-]+:$/{f=($0==h);next} f'
  [ "$1" = armed ] && [ -r "$SIDECAR" ] && sed 's/^/- /' "$SIDECAR"; true
}
record_matches_expected() {
  local c miss="" IFS='|'
  for c in $EXPECT_ARMED ${FOLD_ARMS:-}; do record_section armed | grep -qxF -- "- $c" || miss="$miss armed:'$c'"; done
  for c in $EXPECT_NOT; do
    [ "$c" = "${FOLD_ARMS:-}" ] && continue
    record_section not-armed | grep -qF -- "- $c # " && ! record_section armed | grep -qxF -- "- $c" || miss="$miss not-armed:'$c'"
  done
  case "$FIXTURE" in
    vite-shape) grep -qx 'linter: oxlint' .ai-factory/tool-decisions.md || miss="$miss linter:oxlint" ;;
    red-lint) grep -qx 'linter: eslint' .ai-factory/tool-decisions.md || miss="$miss linter:eslint" ;;
  esac
  [ -z "$miss" ] && return 0
  echo "the record is not the expected one — missing:$miss"
  awk '/<!-- aif:project-checks:end -->/{f=0} f; /<!-- aif:project-checks:begin -->/{f=1}' .ai-factory/tool-decisions.md
  return 1
}
run_step "record: expected armed set" record_matches_expected

# ── Paired negatives: each blocking channel stops a planted defect ─────────────────────────────
# The positive halves are the steps above: new-ts-commit, first-push, typecheck.
negative() { # $1 = label; $2 = what the log must name; rest = the command that must exit non-zero
  local label="$1" want="$2" out rc=0
  shift 2
  out=$(step_log "$label")
  "$@" >"$out" 2>&1 || rc=$?
  if [ "$rc" -ne 0 ] && grep -q -- "$want" "$out"; then
    RESULTS+=("PASS  $label  (blocked, rc=$rc, names $want)")
  else
    RESULTS+=("FAIL  $label  (rc=$rc; a planted defect must be stopped, and the log must name $want)")
    FAILED=1
    tail -25 "$out" | sed 's/^/      /'
  fi
}
undo_planted() { # drops a planted commit and every planted file
  if git log -1 --format=%s | grep -q '^planted:'; then git reset -q --hard HEAD~1; fi
  git reset -q
  rm -f "$SRC"/planted*.ts
  git checkout -q -- .lintstagedrc.json 2>/dev/null || true
}
step "paired negatives: pre-commit, pre-push, typecheck"
plant_commit() { printf '%b' "$PLANT_LINT" > "$SRC/planted.ts" && git add "$SRC/planted.ts" && git commit -qm 'planted: new lint finding'; }
negative "negative: pre-commit" "$PLANT_LINT_ID" plant_commit
undo_planted
# A lint-staged step whose binary does not resolve: check:lintstaged blocks the push.
plant_push() {
  node -e 'const fs = require("fs"); const f = ".lintstagedrc.json"; const j = JSON.parse(fs.readFileSync(f, "utf8"));
    const k = Object.keys(j).find((k) => k.includes("ts")); j[k] = [].concat(j[k], "getff-planted-no-such-bin");
    fs.writeFileSync(f, JSON.stringify(j, null, 2) + "\n")' \
    && git add .lintstagedrc.json && git commit -q --no-verify -m 'planted: unresolvable lint-staged binary' \
    && git push origin "$BRANCH"
}
negative "negative: pre-push" "getff-planted-no-such-bin" plant_push
undo_planted
# Through the record, as validate and CI run it: a typecheck the record left not-armed blocks nothing.
plant_type() { printf "export const planted: number = 'x';\n" > "$SRC/planted-type.ts" && bash scripts/run-armed.sh npm run typecheck; }
case "|$EXPECT_ARMED|" in
  *"|npm run typecheck|"*) negative "negative: typecheck" "TS2322" plant_type ;;
  *) RESULTS+=("SKIP  negative: typecheck  (not armed in this fixture — EXPECT_NOT; nothing to block)") ;;
esac
undo_planted

# ── red-lint (M7): the suppression path end to end, the baseline shrinking (M2), the proof (R2) ──
if [ "$FIXTURE" = red-lint ]; then
  step "red-lint: getff's config, its baseline, the record — then a new finding, a fixed old one, the proof"
  REC=.ai-factory/tool-decisions.md
  sup_count() { node -e 'let n = 0; for (const f of Object.values(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")))) for (const r of Object.values(f)) n += r.count || 0; console.log(n)' "$1"; }
  sup_line() { echo "lint-baseline: eslint-suppressions.json — $1 findings in existing code recorded; new ones still block"; }
  # _pc_null_rules_off: its block in getff's eslint.config.mjs, naming at least one rule.
  null_rules_off() {
    local n
    n=$(awk '/getff \(install\): these typed rules need the strictNullChecks/{f=1} f && /\{ rules: \{/{print; exit}' eslint.config.mjs | grep -o '": "off"' | wc -l | tr -d ' ')
    [ "${n:-0}" -ge 1 ] || { echo "eslint.config.mjs has no getff block turning off the rules that need strictNullChecks"; return 1; }
    echo "$n rule(s) off: they need strictNullChecks, which this tsconfig does not set"
  }
  run_step "red-lint: the strictNullChecks rules are off in getff's config" null_rules_off
  # _pc_suppress: the old findings recorded, the record saying how many.
  baseline_recorded() {
    local n
    [ -f eslint-suppressions.json ] || { echo "no eslint-suppressions.json — the old findings were not recorded"; return 1; }
    n=$(sup_count eslint-suppressions.json)
    [ "$n" -gt 0 ] || { echo "eslint-suppressions.json records no finding"; return 1; }
    grep -qxF -- "$(sup_line "$n")" "$REC" || { echo "the record has no line «$(sup_line "$n")»"; grep '^lint-baseline:' "$REC"; return 1; }
    # Only the project's own code is «existing code»: a file getff delivered is getff's to keep clean
    # (its configs ignore it), never a finding the project inherits. R2 measured 32 of 34 from
    # getff's scripts/prove-rules.mjs before it was ignored.
    local f foreign=""
    while IFS= read -r f; do
      git cat-file -e "$FIXTURE_SHA:$f" 2>/dev/null || foreign="$foreign $f"
    done < <(node -e 'console.log(Object.keys(JSON.parse(require("fs").readFileSync("eslint-suppressions.json", "utf8"))).join("\n"))')
    [ -z "$foreign" ] || { echo "the baseline records files the project did not write:$foreign"; return 1; }
    echo "$n old findings recorded, all in the project's own files"
  }
  run_step "red-lint: the old findings are recorded in eslint-suppressions.json" baseline_recorded
  # A new finding still fails the lint (the commit half is «negative: pre-commit» above).
  plant_lint_only() { printf '%b' "$PLANT_LINT" > "$SRC/planted.ts" && npm run lint; }
  negative "negative: npm run lint, a new finding" "$PLANT_LINT_ID" plant_lint_only
  undo_planted
  # A fixed old finding keeps the lint green (--pass-on-unpruned-suppressions), and the baseline shrinks:
  # the probe measures it into the sidecar, and the next commit's fold brings file and record down (M2).
  SUP_BEFORE=$(sup_count eslint-suppressions.json 2>/dev/null || echo 0)
  printf '%b' "$FIX_BODY" > "$FIX_FILE"
  run_step "red-lint: a fixed old finding keeps npm run lint green" npm run lint
  baseline_shrinks() {
    local after
    bash scripts/run-armed.sh --probe > "$(step_log shrink-probe)" 2>&1
    grep -E "lint baseline eslint-suppressions\.json: $SUP_BEFORE → [0-9]+ findings" "$(step_log shrink-probe)" \
      || { echo "the probe did not shrink the baseline:"; cat "$(step_log shrink-probe)"; return 1; }
    if ! { git add -A && git commit -qm "fix one old finding"; }; then echo "the commit of the fix failed"; return 1; fi
    after=$(git show HEAD:eslint-suppressions.json | sup_count /dev/stdin)
    [ "$after" -lt "$SUP_BEFORE" ] || { echo "committed baseline $after, not below $SUP_BEFORE"; return 1; }
    git show "HEAD:$REC" | grep -qxF -- "$(sup_line "$after")" || { echo "the committed record does not say $after"; return 1; }
    git diff --quiet -- eslint-suppressions.json "$REC" || { echo "the fold left the baseline or the record dirty"; return 1; }
    echo "baseline $SUP_BEFORE → $after, folded into the commit"
  }
  run_step "red-lint: the baseline shrinks through the probe and the commit (M2)" baseline_shrinks
  # R2: the rule table, its proof through the project's own `npm run lint`.
  rule_table_proves() {
    local out rc=0
    out=$(node scripts/prove-rules.mjs --prove 2>&1) || rc=$?
    printf '%s\n' "$out"
    [ "$rc" -eq 0 ] || { echo "prove-rules.mjs --prove exited $rc"; return 1; }
    grep -qE '^bad batch → exit [1-9][0-9]* · good batch → exit 0 ' <<<"$out" \
      || { echo "no proof line «bad batch → exit ≠0 · good batch → exit 0»"; return 1; }
    # getff's config switches the H8 built-ins on for every file: each proves through `npm run lint`.
    local b
    for b in no-empty no-throw-literal; do
      grep -qE "^\| $b \| H8 \| [^|]+ \| [a-z_]+ \| [^|]* \| bad→exit [1-9][0-9]*, its own diagnostic · good→exit 0, clean \|" <<<"$out" \
        || { echo "the row of $b does not show its proof"; return 1; }
    done
  }
  run_step "red-lint: the rule table's proof (R2)" rule_table_proves
  echo "  rule table (R2):"; sed 's/^/      /' "$(step_log "red-lint: the rule table's proof (R2)")"
fi

# ── Generator arm (N14 / S5-9), data-driven on the committed research pairs ────────────────────
RESEARCH=""
for f in "$FRAMEWORK_ROOT"/packages/core/synthesizer/fixtures/*.research.json; do
  [ -f "$f" ] || continue
  if node -e 'const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.exit(j.framework===process.argv[2]?0:1)' "$f" "$STACK"; then
    RESEARCH="$f"
    break
  fi
done
if [ -n "$RESEARCH" ]; then
  SELECTION="${RESEARCH%.research.json}.selection.json"
  step "generator: committed pair $(basename "$RESEARCH") → re-run install.sh --full on an EMPTY npm cache"
  test -f "$SELECTION" || fail "research fixture $RESEARCH has no sibling selection file"
  mkdir -p .ai-factory/rules-research
  cp "$RESEARCH" ".ai-factory/rules-research/$STACK.research.json"
  cp "$SELECTION" ".ai-factory/rules-research/$STACK.selection.json"
  generator_runs_clean() {
    local cache rc=0
    cache="$(mktemp -d "$WORK/npm-cache.XXXXXX")"
    npm_config_cache="$cache" bash "$GETFF/install.sh" "$STACK" --full >"$WORK/install-pass2.log" 2>&1 || rc=$?
    # The generator's own output: from its banner line up to the next installer section (▶).
    awk '/\[80-rule-bootstrap\]/{on=1} on&&/^▶/{exit} on' "$WORK/install-pass2.log" | head -60
    [ "$rc" -eq 0 ] || { echo "install.sh pass 2 rc=$rc"; return 1; }
    if grep -q 'rule generation FAILED' "$WORK/install-pass2.log"; then
      echo "the installer reported: rule generation FAILED"
      return 1
    fi
    ls .ai-factory/synthesizer-output/rules-lock.*.json >/dev/null 2>&1 \
      || { echo "no rules-lock.*.json written under .ai-factory/synthesizer-output/"; return 1; }
    # Every selected rule is generated and proven through the project's own lint (P6 F1, 2026-09-30: on
    # create-vite's shape the generator made 0 of 6; then 3 JSX rules were written as .ts samples and
    # read not_wired). The rule table's getff:G<n> rows are the generated rules.
    local want got table prc=0
    want=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).rules.length)' "$SELECTION")
    table=$(node scripts/prove-rules.mjs --prove 2>&1) || prc=$?
    got=$(grep -c '^| getff:G' <<<"$table" || true)
    [ "$got" -eq "$want" ] || { echo "$table"; echo "generated rules in the table: $got, selected: $want"; return 1; }
    if grep '^| getff:G' <<<"$table" | grep -q 'no diagnostic'; then
      echo "$table"; echo "a generated rule is silent on its own bad example"; return 1
    fi
    grep -q 'good batch → exit 0 ' <<<"$table" || { echo "$table"; echo "the good batch did not pass the project's lint"; return 1; }
    [ "$prc" -eq 0 ] || { echo "$table"; echo "prove-rules --prove exited $prc"; return 1; }
    # The second install adds the generated rules to the consumer's config the same way: insertions
    # only, tsconfig.json untouched.
    local changed
    changed=$(configs_changed)
    [ -z "$changed" ] || { echo "$changed"; return 1; }
  }
  run_step "generator" generator_runs_clean
else
  echo ""
  echo "── generator: no committed research pair for $STACK — arm not applicable to this cell"
fi

# ── getff's writes stay in the project's prettier style (P6 F8, 2026-09-30) ─────────────────────
# Every file the installs added or changed, except one whose fixture version was already out of style (the
# project's own debt), passes the project's own prettier — the files getff WRITES (.oxlintrc.json edits, the
# research pair, the generator's output), not only the ones it copies. Measured on create-vite's shape before
# the fix: .oxlintrc.json, the two research files and 7 generator outputs failed, so format:check could never arm.
if [ -x node_modules/.bin/prettier ]; then
  getff_writes_formatted() {
    local f dirty="" base
    while IFS= read -r f; do
      [ -f "$f" ] || continue
      if git cat-file -e "$FIXTURE_SHA:$f" 2>/dev/null; then
        base=$(git show "$FIXTURE_SHA:$f" | node_modules/.bin/prettier --stdin-filepath "$f" 2>/dev/null) || continue
        [ "$base" = "$(git show "$FIXTURE_SHA:$f")" ] || continue   # out of style before the install
      fi
      node_modules/.bin/prettier --check -- "$f" >/dev/null 2>&1 || dirty="$dirty $f"
    done < <( { git diff --name-only "$FIXTURE_SHA"; git ls-files --others --exclude-standard; } | sort -u \
                | grep -E '\.(json|[cm]?[jt]sx?|ya?ml|css|md)$' )
    [ -z "$dirty" ] || { echo "files getff wrote that fail the project's prettier:$dirty"; return 1; }
  }
  run_step "getff's writes pass the project's prettier" getff_writes_formatted
fi

# Strict the other way: every known-rot entry naming this stack must still reproduce on EVERY step
# it names. One that no longer does was fixed (or moved) — delete it, so the list stays true. The
# entries were measured on the own-config fixture (its whole-tree tsconfig type-checks getff's
# vitest.config.ts; vite-shape's `include: ["src"]` does not), so only that fixture holds them.
[ "$FIXTURE" = own-config ] || ROT_ENTRIES=""
for e in $ROT_ENTRIES; do
  id=${e%%:*}; steps=${e#*:}; steps=${steps%%:*}; stacks=${e##*:}
  case ",$stacks," in *",$STACK,"*) ;; *) continue ;; esac
  for s in ${steps//,/ }; do
    case " $ROT_HITS " in
      *" $id:$s "*) ;;
      *)
        RESULTS+=("FAIL  known rot $id no longer reproduces on '$s' — delete or narrow its KNOWN ROT entry")
        FAILED=1
        ;;
    esac
  done
done

echo ""
echo "══ own-config cell ($STACK) ══"
printf '  %s\n' "${RESULTS[@]}"
if [ -n "$ROT_HITS" ]; then
  echo "  known rot shown, not failed (Q4.4 — handed to the one-button design session):$ROT_HITS"
fi
if [ "$FAILED" -ne 0 ]; then
  [ -n "${CELL_KEEP:-}" ] && echo "  (work dir kept: $WORK)"
  fail "own-config cell ($STACK): a step of the INSTALL-FOR-AI.md step-4 list is RED on a project that owns its configs"
fi
echo "✓ own-config cell ($STACK): every step green${ROT_HITS:+, apart from the known rot listed above}"
