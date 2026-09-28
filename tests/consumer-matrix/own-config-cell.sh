#!/usr/bin/env bash
# Consumer-matrix OWN-CONFIG CELL: install getff into a project that already owns its toolchain
# configs, then run the whole INSTALL-FOR-AI.md step-4 list (operator decision Q4.3, 2026-09-28).
#
# WHY THIS CELL EXISTS. The sibling fresh-install job (audit-self.yml
# `framework-fresh-install-validate`, fixture `empty-manifest`) installs into an EMPTY package.json.
# There getff's own eslint.config.mjs / tsconfig.json / .prettierignore always land, and they
# ignore everything getff ships — so nothing getff puts in the consumer tree is ever linted or
# type-checked by a config getff does not control. A real project is the opposite case: it
# already HAS an eslint.config.mjs and a tsconfig.json, copy_safe keeps them (the 2026-09-23
# decision: skip + report, never overwrite or merge a consumer's tool config), and from then on
# the CONSUMER's tools check every file getff delivered. Measured 2026-09-28 on
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
# Fail-closed: a missing tool is RED, never SKIP. Deterministic + API-free
# (.claude/rules/no-paid-llm-in-ci.md); the npm registry is the only network it touches, exactly
# like the sibling fresh-install cells.
#
# Usage: STACK=<ts-server|react-next|react-spa|react-native> bash tests/consumer-matrix/own-config-cell.sh
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

WORK="$(mktemp -d "${TMPDIR:-/tmp}/own-config-cell-${STACK}.XXXXXX")"
if [ -z "${CELL_KEEP:-}" ]; then trap 'rm -rf "$WORK"' EXIT; fi
CONSUMER="$WORK/consumer"
LOG="$WORK/install.log"

fail() { echo "" ; echo "✗ FAIL: $*" >&2; exit 1; }
step() { echo ""; echo "── $*"; }

command -v npm >/dev/null 2>&1 || fail "npm unavailable — the cell cannot run; RED never SKIP"
command -v node >/dev/null 2>&1 || fail "node unavailable — the cell cannot run; RED never SKIP"

step "fixture ($STACK): a TypeScript project that owns its eslint + tsconfig (scaffolder-default shape)"
mkdir -p "$CONSUMER/lib" && cd "$CONSUMER"
git init -q -b main
git config user.email ci@example.com
git config user.name CI
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
git add -A
git commit -qm "consumer baseline"
# The consumer's configs, byte for byte: every install below must leave them exactly so.
OWN_CONFIGS="eslint.config.mjs tsconfig.json"
for c in $OWN_CONFIGS; do cp "$c" "$WORK/own-$c.before"; done
configs_changed() { # prints each consumer config an install changed, with its first diff lines
  local c
  for c in $OWN_CONFIGS; do
    cmp -s "$c" "$WORK/own-$c.before" && continue
    echo "the install changed the consumer's own $c:"
    diff "$WORK/own-$c.before" "$c" | head -8 | sed 's/^/    /'
  done
}

step "fixture installs its OWN deps (before getff, as a real project would have them)"
npm install --silent --no-audit --no-fund >"$WORK/own-install.log" 2>&1 \
  || { tail -20 "$WORK/own-install.log"; fail "fixture's own npm install failed"; }
test -x node_modules/.bin/eslint || fail "fixture's own eslint did not land"

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
for bin in eslint tsc vitest; do
  test -x "node_modules/.bin/$bin" \
    || fail "$bin not installed after install.sh --full — the step-4 list below cannot run (false-green guard)"
done
# The premise of this cell: the consumer's configs survived the install — neither replaced nor
# merged into (operator decision 2026-09-23: skip + report, never overwrite or merge).
CHANGED=$(configs_changed)
[ -z "$CHANGED" ] || { echo "$CHANGED"; fail "install.sh changed a config the consumer owns — fixture premise broken"; }

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

step "first commit through the real shipped pre-commit"
run_step "first-commit" bash -c 'git add -A && git commit -qm "install getff"'

step "first push: git runs the shipped pre-push, which must reach the full hook, not the bash fallback"
# A real `git push` to a local bare remote, so git itself invokes the hook with the ref lines on
# stdin — exactly what the consumer's first push does. No network.
git init -q --bare "$WORK/remote.git"
git remote add origin "$WORK/remote.git"
first_push_runs_full_hook() {
  local out rc=0
  out=$(git push -u origin main 2>&1) || rc=$?
  printf '%s\n' "$out"
  [ "$rc" -eq 0 ] || return 1
  # The fallback labels every line it prints with «fallback»; the full hook never does.
  if printf '%s\n' "$out" | grep -q 'fallback'; then
    echo "pre-push fell back to the bash critical-only hook"
    return 1
  fi
}
run_step "first-push" first_push_runs_full_hook

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
    # The generated rules are the consumer's to wire; the second install must not merge them in.
    local changed
    changed=$(configs_changed)
    [ -z "$changed" ] || { echo "$changed"; return 1; }
  }
  run_step "generator" generator_runs_clean
else
  echo ""
  echo "── generator: no committed research pair for $STACK — arm not applicable to this cell"
fi

# Strict the other way: every known-rot entry naming this stack must still reproduce on EVERY step
# it names. One that no longer does was fixed (or moved) — delete it, so the list stays true.
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
