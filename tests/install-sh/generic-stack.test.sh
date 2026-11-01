#!/usr/bin/env bash
# generic-stack.test.sh — P2 G1 (one-button, operator log entry 26 points 2-4): the installer must
# not exit on a project whose stack it does not know. Before this, `install.sh --full` (what
# `./setup -y` runs) exited 1 in three places: no package.json and no toolchain-lane file, a
# package.json with no stack signal, and (interactive) a menu with no way out. Now such a project
# lands on the stack `generic`: the SAME setup.d layer loop, with every npm-bound layer gated off
# and named in the NOT wired summary.
#
# ARMS (hermetic: no network, no package manager is run — generic skips 70-deps):
#   (1) pom.xml + README, `install.sh --full`, no positional → exit 0, stack generic, the
#       stack-free part lands (skills, agents, AGENTS.md, .ai-factory/, audit-ai-docs.sh); nothing
#       npm-bound is created (package.json, .husky/, eslint config, tsconfig, node_modules, CI);
#       every skipped layer is one NOT wired line; the banner names the NOT wired count.
#   (2) a package.json with no stack signal, `--full` → exit 0, stack generic, package.json
#       byte-identical.
#   (3) positional `generic` is a valid stack (exit 0); a misspelt stack still exits 1.
#   (4) `--dry-run` on the pom.xml repo → exit 0, prints the generic line, writes nothing.
#   (5) K5: `--full` on a pyproject.toml repo, no positional → the python lane is claimed and
#       named alpha (before: the offer was declined and the install exited 1).
#   (6) point 3, no prompt under --full: run under a real pty (script(1)) with empty stdin; no
#       prompt text is printed and the run exits 0.
#   (7) `install.sh generic --refresh` over an older delivery → getff's stack-free files (a skill,
#       an agent, a Claude hook, AI-USAGE-GUIDE.md, audit-ai-docs.sh) are the current delivery again;
#       nothing npm-bound is created; each skipped npm-bound refresh arm is one NOT wired line.
#   (8) `--refresh` on (2)'s project (a package.json with no stack signal) → package.json stays
#       byte-identical: the refresh adds no getff npm script the install did not place, and the
#       skipped scripts arm is one NOT wired line.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL="$REPO_ROOT/install.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
TMPS=()
cleanup() { [ "${#TMPS[@]}" -gt 0 ] && rm -rf "${TMPS[@]}"; }
trap cleanup EXIT

# A named framework without a preset still passes its selected tools to later layers.
# Source the real layer, independently of the public archive-manifest preflight.
# Drivable subset (route B): the same two-signal gate as the delivery hunks decides whether
# 40-configs places run-armed.sh / the plugin barrel / the getff-rules workflow.
generic_slot_case() {
  local name="$1" linter="$2" formatter="$3" package="$4" config="$5" body="$6" d ref rc p drivable
  d=$(mktemp -d); TMPS+=("$d")
  ref=$(mktemp -d); TMPS+=("$ref")
  if [ -n "$package" ]; then
    printf '%s\n' "$package" > "$d/package.json"
    printf '{"lockfileVersion":3}\n' > "$d/package-lock.json"
    cp "$d/package.json" "$ref/package.json"
    cp "$d/package-lock.json" "$ref/package-lock.json"
  fi
  if [ -n "$config" ]; then
    printf '%s\n' "$body" > "$d/$config"
    cp "$d/$config" "$ref/$config"
  fi
  drivable=0
  { [ "$linter" = "eslint" ] || [ "$linter" = "oxlint" ]; } && [ -n "$package" ] && drivable=1
  (
    PROJECT_ROOT="$d"; PKG_ROOT="$REPO_ROOT"; STACK=generic
    FORCE=""; DRY_RUN=""; SKIPPED=(); NOT_WIRED=()
    unset LINTER_SLOT FORMATTER_SLOT
    INSTALL_SH_LIB_ONLY=1 source "$REPO_ROOT/setup.d/lib.sh"
    source "$REPO_ROOT/setup.d/40-configs.sh" > "$d/.layer-log" 2>&1 || exit $?
    printf '%s %s\n' "${LINTER_SLOT:-UNSET}" "${FORMATTER_SLOT:-UNSET}" > "$d/.selected-slots"
  ); rc=$?
  [ "$rc" -eq 0 ] && ok "(slots:$name) real generic layer completes" \
    || { bad "(slots:$name) layer exit $rc: $(tail -3 "$d/.layer-log")"; return; }
  [ "$(cat "$d/.selected-slots")" = "$linter $formatter" ] \
    && ok "(slots:$name) shared selection is $linter / $formatter" \
    || bad "(slots:$name) shared selection lost: $(cat "$d/.selected-slots")"
  for p in package.json package-lock.json "$config"; do
    [ -n "$p" ] && [ -f "$ref/$p" ] || continue
    cmp -s "$d/$p" "$ref/$p" && ok "(slots:$name) original $p unchanged" \
      || bad "(slots:$name) original $p changed"
  done
  for p in node_modules .husky tsconfig.json vitest.config.ts .lintstagedrc.json; do
    [ ! -e "$d/$p" ] && ok "(slots:$name) no preset/toolchain $p" \
      || bad "(slots:$name) generic created $p"
  done
  if [ "$drivable" = 1 ]; then
    # route B payloads (F1a/F1b + the accepted plugin set) — present only when drivable
    for p in scripts/run-armed.sh eslint-rules-local/index.mjs .github/workflows/getff-rules.yml; do
      [ -f "$d/$p" ] && ok "(slots:$name) drivable payload: $p" \
        || bad "(slots:$name) drivable payload missing: $p"
    done
    grep -q 'run-armed.sh validate' "$d/.github/workflows/getff-rules.yml" \
      && ok "(slots:$name) workflow gates on run-armed.sh validate" \
      || bad "(slots:$name) workflow lacks the validate gate step"
    grep -q "node-version: '20'" "$d/.github/workflows/getff-rules.yml" \
      && ok "(slots:$name) GETFF-SUBST-NODE pins '20' without .nvmrc" \
      || bad "(slots:$name) node-version substitution missing"
  else
    for p in scripts/run-armed.sh eslint-rules-local .github/workflows scripts/prove-rules.mjs; do
      [ ! -e "$d/$p" ] && ok "(slots:$name) plain generic places no $p" \
        || bad "(slots:$name) plain generic created $p"
    done
  fi
  if [ "$config" != eslint.config.mjs ]; then
    [ ! -e "$d/eslint.config.mjs" ] && ok "(slots:$name) no additional ESLint config" \
      || bad "(slots:$name) ESLint config added beside selected tools"
  fi
  if [ -z "$package" ]; then
    [ ! -e "$d/package.json" ] && ok "(slots:$name) no package.json created" \
      || bad "(slots:$name) package.json created"
  fi
}
generic_slot_case none none none '' '' ''
generic_slot_case eslint eslint none '{"name":"own-eslint","scripts":{"lint":"eslint ."}}' eslint.config.mjs 'export default [];'
generic_slot_case oxlint oxlint none '{"name":"own-oxlint","scripts":{"lint":"oxlint ."}}' .oxlintrc.json '{"rules":{"no-debugger":"warn"}}'
generic_slot_case biome biome biome '{"name":"own-biome","scripts":{"lint":"biome lint ."}}' biome.json '{"formatter":{"enabled":true}}'
generic_slot_case prettier oxlint prettier '{"name":"own-prettier","scripts":{"lint":"oxlint ."}}' .prettierrc.json '{"singleQuote":true}'
generic_slot_case dprint oxlint dprint '{"name":"own-dprint","scripts":{"lint":"oxlint ."}}' dprint.json '{"lineWidth":100}'
if [ "${1:-}" = --generic-slot-regression ]; then
  echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]; exit $?
fi

repo() {  # $1 = kind: java | plainjs | python
  local d; d=$(mktemp -d); TMPS+=("$d")
  ( cd "$d" && git init -q && git config user.email t@t && git config user.name t
    printf '# demo\n' > README.md
    case "$1" in
      java)    printf '<project><modelVersion>4.0.0</modelVersion></project>\n' > pom.xml ;;
      plainjs) printf '{"name":"plain","version":"1.0.0","scripts":{"start":"node index.js"}}\n' > package.json
               printf 'console.log(1)\n' > index.js ;;
      python)  printf '[project]\nname = "demo"\nversion = "0"\n' > pyproject.toml ;;
    esac
    git add -A && git commit -q -m base )
  echo "$d"
}

# ── (1) Java repo, --full, no positional ─────────────────────────────────────────────────────────
J=$(repo java)
out=$( cd "$J" && bash "$INSTALL" --full < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(1) --full on a pom.xml repo exits 0" \
  || bad "(1) exit $rc (tail: $(tail -5 <<<"$out" | tr '\n' '|'))"
grep -q 'stack: generic' <<<"$out" && ok "(1) the stack is named generic" || bad "(1) no 'stack: generic' line"
for p in .claude/skills .claude/agents AGENTS.md .ai-factory/tool-decisions.md .ai-factory/DESCRIPTION.md scripts/audit-ai-docs.sh; do
  [ -e "$J/$p" ] && ok "(1) stack-free part landed: $p" || bad "(1) missing stack-free piece: $p"
done
[ -n "$(ls -A "$J/.claude/skills" 2>/dev/null)" ] && ok "(1) .claude/skills is not empty" || bad "(1) .claude/skills is empty"
for p in package.json .husky node_modules tsconfig.json eslint.config.mjs .lintstagedrc.json .github/workflows vitest.config.ts .ai-factory/RULES.md; do
  [ ! -e "$J/$p" ] && ok "(1) nothing npm-bound created: no $p" || bad "(1) npm-bound piece created on a generic project: $p"
done
for why in 'lint, typecheck and test configs' 'git hooks' 'CI workflow' 'dependencies' 'stack rules'; do
  grep -q "^      - .*$why.*generic" <<<"$out" && ok "(1) NOT wired names the skipped '$why'" \
    || bad "(1) no NOT wired line for '$why' naming generic"
done
grep -Eq '^✅ Installation complete — [0-9]+ item\(s\) NOT wired \(listed above\)\.$' <<<"$out" \
  && ok "(1) the banner names the NOT wired count" || bad "(1) banner: $(grep 'Installation' <<<"$out")"
[ -z "$(git -C "$J" status --porcelain -- pom.xml README.md)" ] && ok "(1) the project's own files are untouched" \
  || bad "(1) the install changed the project's own files"

# ── (2) plain package.json, no stack signal ──────────────────────────────────────────────────────
P=$(repo plainjs)
before=$(shasum "$P/package.json")
out=$( cd "$P" && bash "$INSTALL" --full < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(2) --full on a package.json with no stack signal exits 0" \
  || bad "(2) exit $rc (tail: $(tail -5 <<<"$out" | tr '\n' '|'))"
grep -q 'stack: generic' <<<"$out" && ok "(2) the stack is named generic" || bad "(2) no 'stack: generic' line"
[ "$before" = "$(shasum "$P/package.json")" ] && ok "(2) package.json byte-identical" || bad "(2) package.json was changed"

# ── (3) positional generic / misspelt stack ─────────────────────────────────────────────────────
G=$(repo java)
( cd "$G" && bash "$INSTALL" generic --full < /dev/null >/dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(3) positional 'generic' is accepted" || bad "(3) positional 'generic' exited $rc"
T=$(repo plainjs)
out=$( cd "$T" && bash "$INSTALL" react-sap --full < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 1 ] && grep -q 'Unknown stack: react-sap' <<<"$out" \
  && ok "(3) a misspelt stack still exits 1 (a wrong name is an error, not a stack)" \
  || bad "(3) misspelt stack: exit $rc"

# ── (4) --dry-run ───────────────────────────────────────────────────────────────────────────────
D=$(repo java)
out=$( cd "$D" && bash "$INSTALL" --dry-run < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(4) --dry-run exits 0" || bad "(4) --dry-run exit $rc"
grep -q 'stack: generic — stack-free part only; stack-bound part: not done (the agent researches it)' <<<"$out" \
  && ok "(4) --dry-run names the generic stack and what it leaves undone" || bad "(4) no generic dry-run line"
[ -z "$(git -C "$D" status --porcelain)" ] && ok "(4) --dry-run wrote nothing" || bad "(4) --dry-run wrote: $(git -C "$D" status --porcelain | head -3 | tr '\n' ' ')"

# ── (5) K5: -y claims a detected toolchain lane ──────────────────────────────────────────────────
Y=$(repo python)
out=$( cd "$Y" && bash "$INSTALL" --full < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && [ -f "$Y/sgconfig.yml" ] && ok "(5) --full on pyproject.toml claims the python lane (sgconfig.yml delivered)" \
  || bad "(5) exit $rc, sgconfig.yml $( [ -f "$Y/sgconfig.yml" ] && echo present || echo absent) (tail: $(tail -3 <<<"$out" | tr '\n' '|'))"
grep -q 'Python toolchain lane (alpha)' <<<"$out" && ok "(5) the claimed lane is named alpha" || bad "(5) the lane is not named alpha"

# ── (6) no prompt under --full, at a real pty ────────────────────────────────────────────────────
N=$(repo java)
# script(1) differs: util-linux takes the command via -c (and -e to return its exit code), BSD/macOS
# takes it as trailing arguments and returns its exit code by default.
rcl=0; rcw=0
if grep -q util-linux <<<"$(script -V 2>/dev/null)"; then
  out=$( cd "$N" && script -qec "bash '$INSTALL' --full" /dev/null < /dev/null 2>&1 ); rcl=$?
else
  out=$( cd "$N" && script -q /dev/null bash "$INSTALL" --full < /dev/null 2>&1 ); rcw=$?
fi
{ [ "$rcl" -eq 0 ] && [ "$rcw" -eq 0 ]; } && ok "(6) --full at a pty with empty stdin exits 0" || bad "(6) exit $((rcl+rcw)) at a pty"
grep -Eq 'Choose \[|\[y/N\]|\[Y/n\]' <<<"$out" && bad "(6) a prompt was printed under --full: $(grep -E 'Choose \[|\[y/N\]|\[Y/n\]' <<<"$out" | head -2)" \
  || ok "(6) no prompt printed under --full"

# ── (7) --refresh on generic re-delivers getff's stack-free files, skips the npm-bound arms ────────
# Before: --refresh on generic re-ran the install path, whose copy_safe keeps a file already on disk,
# so a generic project stayed on the skills and hooks of the getff that installed it. An older
# delivery is simulated by rewriting each file (refresh overwrites a diverged file, preserving it).
R=$(repo java)
( cd "$R" && bash "$INSTALL" --full < /dev/null >/dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] || { echo "FAIL: install.sh exited $rc"; exit 1; }
_agent=$(cd "$R" && ls .claude/agents/*.md 2>/dev/null | head -1)
_hook=$(cd "$R" && ls .claude/hooks/*.sh 2>/dev/null | head -1)
_probes=".claude/skills/getff/SKILL.md $_agent $_hook .ai-factory/AI-USAGE-GUIDE.md scripts/audit-ai-docs.sh"
REF=$(mktemp -d); TMPS+=("$REF")  # outside the project: refresh re-creates a skill dir whole
for p in $_probes; do
  mkdir -p "$REF/$(dirname "$p")"; cp "$R/$p" "$REF/$p"; printf 'OLDER GETFF DELIVERY\n' > "$R/$p"
done
out=$( cd "$R" && bash "$INSTALL" generic --refresh < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(7) generic --refresh exits 0" || bad "(7) exit $rc (tail: $(tail -5 <<<"$out" | tr '\n' '|'))"
for p in $_probes; do
  cmp -s "$R/$p" "$REF/$p" && ok "(7) refreshed to the current delivery: $p" \
    || bad "(7) NOT refreshed (still the older delivery): $p"
done
for p in package.json .husky node_modules eslint.config.mjs eslint-rules-local packages/core/hooks/pre-push.bundle.mjs \
         scripts/check-rule-globs.sh scripts/run-armed.sh scripts/fences-fire-fixtures .prettierignore .ai-factory/ARCHITECTURE.md; do
  [ ! -e "$R/$p" ] && ok "(7) refresh created nothing npm-bound: no $p" || bad "(7) refresh created an npm-bound piece on generic: $p"
done
for why in 'check scripts' 'pre-push bundle' 'ESLint rules' 'git hooks' '.prettierignore' 'ARCHITECTURE.md'; do
  grep -q "^      - .*$why.*not refreshed.*generic" <<<"$out" && ok "(7) NOT wired names the skipped refresh arm '$why'" \
    || bad "(7) no NOT wired line for the skipped refresh arm '$why' naming generic"
done

# ── (8) --refresh on a package.json with no stack signal adds no getff script ─────────────────────
# The install places no npm toolchain on generic (setup.d/70-deps.sh returns before the scripts merge),
# so the refresh must not add one either: getff's `validate` runs scripts/run-armed.sh, which generic
# never gets, and its lint / typecheck scripts call tools the project does not have.
out=$( cd "$P" && bash "$INSTALL" --refresh < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(8) --refresh on (2)'s project exits 0" || bad "(8) exit $rc (tail: $(tail -5 <<<"$out" | tr '\n' '|'))"
grep -q 'stack: generic' <<<"$out" && ok "(8) the refresh names the stack generic" || bad "(8) no 'stack: generic' in the refresh output"
[ "$before" = "$(shasum "$P/package.json")" ] && ok "(8) package.json byte-identical after --refresh" \
  || bad "(8) --refresh changed package.json: $(node -e 'console.log(Object.keys(require(process.argv[1]).scripts||{}).join(" "))' "$P/package.json")"
grep -q '^      - .*package.json scripts.*not refreshed.*generic' <<<"$out" \
  && ok "(8) NOT wired names the skipped package.json scripts arm" \
  || bad "(8) no NOT wired line for the skipped package.json scripts arm naming generic"

# ── (9) drivable generic: own eslint + own lint → proofs, run-armed, workflow, hooks ────────────
drivable_fixture() {  # own eslint signal + own lint script; offline: lint runs a shell script
  local d="$1"
  printf '{"name":"own-lint","private":true,"scripts":{"lint":"bash lint.sh"}}\n' > "$d/package.json"
  printf '#!/usr/bin/env bash\nexit 0\n' > "$d/lint.sh"
  printf 'export default [];\n' > "$d/eslint.config.mjs"
  chmod +x "$d/lint.sh"
}
ci_install_step() {  # run the delivered workflow's install step VERBATIM, extracted from its YAML
  local wf="$1"
  awk '/- name: Install dependencies/{f=1;next} f&&/^          /{sub(/^          /,"");print} f&&/^      - /{exit}' "$wf" > "$wf.step.sh"
  ( cd "$(dirname "$wf")/../.." && bash "$(cd "$(dirname "$wf")" && pwd)/$(basename "$wf").step.sh" )
}
D9=$(mktemp -d); TMPS+=("$D9")
drivable_fixture "$D9"
mkdir -p "$D9/node_modules"
( cd "$D9" && git init -q && git config user.email t@t && git config user.name t ) >/dev/null 2>&1
out=$( cd "$D9" && bash "$INSTALL" generic --full < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(9) drivable generic install exits 0" || bad "(9) exit $rc (tail: $(tail -5 <<<"$out" | tr '\n' '|'))"
for p in scripts/run-armed.sh scripts/prove-rules.mjs scripts/run-generated-rule-mutation.sh \
         eslint-rules-local/index.mjs .husky/pre-commit .github/workflows/getff-rules.yml; do
  [ -f "$D9/$p" ] && ok "(9) delivered: $p" || bad "(9) missing: $p"
done
for p in packages/core/hooks/pre-push.bundle.mjs packages/core/hooks/pre-push.fallback.sh \
         .husky/pre-push .lintstagedrc.json tsconfig.json vitest.config.ts; do
  [ ! -e "$D9/$p" ] && ok "(9) route B delivers no $p" || bad "(9) npm-lane piece created: $p"
done
grep -q 'run-armed.sh validate' "$D9/.github/workflows/getff-rules.yml" \
  && ok "(9) workflow gate step runs run-armed.sh validate" || bad "(9) workflow lacks the validate step"
grep -q "node-version: '20'" "$D9/.github/workflows/getff-rules.yml" \
  && ok "(9) GETFF-SUBST-NODE pinned '20' (no .nvmrc)" || bad "(9) node-version substitution missing"
grep -q -- '--probe' "$D9/.husky/pre-commit" && grep -q -- '--fold' "$D9/.husky/pre-commit" \
  && ok "(9) pre-commit is probe→fold (N1), never blocking" || bad "(9) pre-commit content wrong"
[ -x "$D9/.husky/pre-commit" ] && ok "(9) pre-commit executable" || bad "(9) pre-commit not +x"
grep -q 'cache:' "$D9/.github/workflows/getff-rules.yml" \
  && bad "(9) workflow carries a cache: key (must be omitted entirely)" || ok "(9) no cache: key in the workflow"
grep -q 'npm run lint' <<<"$(grep -A2 '^armed:' "$D9/.ai-factory/tool-decisions.md")" \
  && ok "(9) green own lint armed at install (PLACE_LINT_OK path)" || bad "(9) own lint not armed at install"

# ── (10) C1: fresh clone — CI steps verbatim; good0, and the same bad file blocks (bad1) ────────
( cd "$D9" && git add -A && git commit -qm base ) >/dev/null 2>&1
C1C=$(mktemp -d); TMPS+=("$C1C")
git clone -q "$D9" "$C1C" 2>/dev/null
[ ! -f "$(git -C "$C1C" rev-parse --absolute-git-dir)/getff-armed.local" ] \
  && ok "(10) fresh clone starts sidecar-free (record is tracked)" || bad "(10) sidecar leaked into the clone"
( cd "$C1C" && ci_install_step "$C1C/.github/workflows/getff-rules.yml" ) >/dev/null 2>&1
vrc=0; ( cd "$C1C" && bash scripts/run-armed.sh validate ) >/dev/null 2>&1 || vrc=$?
[ "$vrc" -eq 0 ] && ok "(10) good0: fresh-clone install-step + validate exits 0" || bad "(10) good0 validate exit $vrc"
printf '#!/usr/bin/env bash\nexit 1\n' > "$C1C/lint.sh"
vbad=0; vout=$( cd "$C1C" && bash scripts/run-armed.sh validate 2>&1 ) || vbad=$?
[ "$vbad" -eq 1 ] && ok "(10) bad1: the same bad file is rejected at the first blocking channel" \
  || bad "(10) bad1 validate exit $vbad"
grep -q 'npm run lint' <<<"$vout" && ok "(10) the failure names the armed command npm run lint" \
  || bad "(10) failure output does not name npm run lint: $(tail -3 <<<"$vout" | tr '\n' '|')"

# ── (11) C2: lock-less npm — no cache key, npm install arm, good0 holds ─────────────────────────
D11=$(mktemp -d); TMPS+=("$D11")
drivable_fixture "$D11"
mkdir -p "$D11/node_modules"
( cd "$D11" && git init -q && git config user.email t@t && git config user.name t ) >/dev/null 2>&1
out=$( cd "$D11" && bash "$INSTALL" generic --full < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(11) lock-less npm install exits 0" || bad "(11) exit $rc (tail: $(tail -3 <<<"$out" | tr '\n' '|'))"
[ ! -f "$D11/package-lock.json" ] && ok "(11) installer planted no package-lock.json" || bad "(11) package-lock.json created"
( cd "$D11" && git add -A && git commit -qm base ) >/dev/null 2>&1
C2C=$(mktemp -d); TMPS+=("$C2C")
git clone -q "$D11" "$C2C" 2>/dev/null
( cd "$C2C" && ci_install_step "$C2C/.github/workflows/getff-rules.yml" ) >/dev/null 2>&1
vrc=0; ( cd "$C2C" && bash scripts/run-armed.sh validate ) >/dev/null 2>&1 || vrc=$?
[ "$vrc" -eq 0 ] && ok "(11) C2 good0: lock-less npm install arm + validate exits 0" || bad "(11) C2 good0 exit $vrc"

# ── (12) C3: packageManager=pnpm overrides a stale package-lock; no tracked-file mutation ───────
D12=$(mktemp -d); TMPS+=("$D12")
printf '{"name":"pm-override","private":true,"packageManager":"pnpm@9.0.0","scripts":{"lint":"bash lint.sh"}}\n' > "$D12/package.json"
printf '{"lockfileVersion":3,"packages":{}}\n' > "$D12/package-lock.json"
printf 'export default [];\n' > "$D12/eslint.config.mjs"
printf '#!/usr/bin/env bash\nexit 0\n' > "$D12/lint.sh"; chmod +x "$D12/lint.sh"
STUB=$(mktemp -d); TMPS+=("$STUB")
for t in corepack pnpm yarn; do
  printf '#!/usr/bin/env bash\necho "STUB %s $*"\nexit 0\n' "$t" > "$STUB/$t"; chmod +x "$STUB/$t"
done
lock12=$(shasum "$D12/package-lock.json" | cut -d' ' -f1)
out=$( cd "$D12" && bash "$INSTALL" generic --full < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(12) install on packageManager=pnpm exits 0" || bad "(12) exit $rc (tail: $(tail -3 <<<"$out" | tr '\n' '|'))"
[ "$lock12" = "$(shasum "$D12/package-lock.json" | cut -d' ' -f1)" ] \
  && ok "(12) install left the stale package-lock.json byte-identical" || bad "(12) install mutated package-lock.json"
step12=$( cd "$D12" && PATH="$STUB:$PATH" ci_install_step "$D12/.github/workflows/getff-rules.yml" 2>&1 )
grep -q 'own package manager selected: pnpm' <<<"$step12" \
  && ok "(12) ladder selects pnpm (packageManager overrides the npm lock)" \
  || bad "(12) selection: $(grep 'selected' <<<"$step12" | head -1)"
grep -q 'STUB pnpm install' <<<"$step12" && ! grep -q 'STUB pnpm install --frozen' <<<"$step12" \
  && ok "(12) no pnpm-lock ⇒ non-frozen pnpm install; npm never runs" \
  || bad "(12) pnpm arm: $(grep 'STUB' <<<"$step12" | tr '\n' '|')"
[ "$lock12" = "$(shasum "$D12/package-lock.json" | cut -d' ' -f1)" ] \
  && ok "(12) the step never mutates the tracked package-lock.json" || bad "(12) step mutated tracked bytes"

# ── (13) C4: modern Yarn — no-lock under CI=true carries --no-immutable; locked stays frozen ────
D13=$(mktemp -d); TMPS+=("$D13")
printf '{"name":"yarn-nolock","private":true,"packageManager":"yarn@4.5.0","scripts":{"lint":"bash lint.sh"}}\n' > "$D13/package.json"
printf 'export default [];\n' > "$D13/eslint.config.mjs"
printf '#!/usr/bin/env bash\nexit 0\n' > "$D13/lint.sh"; chmod +x "$D13/lint.sh"
out=$( cd "$D13" && bash "$INSTALL" generic --full < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(13) yarn-signalled install exits 0" || bad "(13) exit $rc (tail: $(tail -3 <<<"$out" | tr '\n' '|'))"
wf13="$D13/.github/workflows/getff-rules.yml"
grep -q -- 'yarn install --frozen-lockfile; else yarn install --no-immutable; fi' "$wf13" \
  && ok "(13) delivered YAML: frozen when locked, --no-immutable when not" || bad "(13) yarn arm text wrong in the YAML"
step13=$( cd "$D13" && PATH="$STUB:$PATH" CI=true ci_install_step "$wf13" 2>&1 )
grep -q 'own package manager selected: yarn' <<<"$step13" \
  && ok "(13) ladder selects yarn (packageManager yarn@4)" || bad "(13) selection: $(grep 'selected' <<<"$step13" | head -1)"
grep -q 'STUB yarn install --no-immutable' <<<"$step13" \
  && ok "(13) no-lock arm under CI=true is yarn install --no-immutable" \
  || bad "(13) yarn no-lock arm: $(grep 'STUB yarn' <<<"$step13" | tr '\n' '|')"
yv=$(yarn --version 2>/dev/null || echo none)
case "$yv" in
  4.*)
    D13R=$(mktemp -d); TMPS+=("$D13R")
    cp "$D13/package.json" "$D13/eslint.config.mjs" "$D13/lint.sh" "$D13R/" 2>/dev/null
    yrc=0; ( cd "$D13R" && CI=true yarn install --no-immutable ) >/dev/null 2>&1 || yrc=$?
    [ "$yrc" -eq 0 ] && ok "(13) real yarn $yv: CI=true --no-immutable completes (zero-dep)" \
      || bad "(13) real yarn $yv exit $yrc"
    ;;
  *) echo "  ℹ (13) real-Yarn falsifier not run here: system yarn is '$yv' (not 4.x); the stub arm above binds the delivered command text" ;;
esac
D13L=$(mktemp -d); TMPS+=("$D13L")
cp "$D13/package.json" "$D13/eslint.config.mjs" "$D13/lint.sh" "$D13L/" 2>/dev/null
printf '# yarn lockfile\n' > "$D13L/yarn.lock"
lock13=$(shasum "$D13L/yarn.lock" | cut -d' ' -f1)
outl=$( cd "$D13L" && bash "$INSTALL" generic --full < /dev/null 2>&1 )
wf13l="$D13L/.github/workflows/getff-rules.yml"
[ -f "$wf13l" ] && ok "(13) locked twin delivers its own workflow" || bad "(13) locked twin missing workflow (tail: $(tail -3 <<<"$outl" | tr '\n' '|'))"
step13b=$( cd "$D13L" && PATH="$STUB:$PATH" CI=true ci_install_step "$wf13l" 2>&1 )
grep -q 'STUB yarn install --frozen-lockfile' <<<"$step13b" \
  && ok "(13) locked arm is yarn install --frozen-lockfile" || bad "(13) locked arm: $(grep 'STUB yarn' <<<"$step13b" | tr '\n' '|')"
[ "$lock13" = "$(shasum "$D13L/yarn.lock" | cut -d' ' -f1)" ] \
  && ok "(13) committed yarn.lock untouched" || bad "(13) yarn.lock mutated"

# ── (14) R4 upsert: older record survives; lint-only; two refreshes idempotent; stays generic ──
D14=$(mktemp -d); TMPS+=("$D14")
printf '{"name":"own-lint","private":true,"scripts":{"lint":"bash lint.sh","build":"node build.js","test":"node test.js","typecheck":"tsc --noEmit"}}\n' > "$D14/package.json"
printf '#!/usr/bin/env bash\nexit 0\n' > "$D14/lint.sh"; chmod +x "$D14/lint.sh"
printf 'export default [];\n' > "$D14/eslint.config.mjs"
printf 'export default {}\n' > "$D14/astro.config.mjs"   # preset-less NAME — the accepted own-Astro class
mkdir -p "$D14/.ai-factory"
printf '%s\n' \
  '### How this project checks itself (recorded by install.sh --refresh)' \
  'stack: generic' \
  'linter: eslint' \
  'armed:' \
  '- bash scripts/run-generated-rule-mutation.sh' \
  'not-armed:' \
  '- npm run lint # old reason — kept verbatim' \
  '<!-- aif:project-checks:begin -->' \
  'armed:' \
  '- bash scripts/run-generated-rule-mutation.sh' \
  'not-armed:' \
  '- npm run lint # old reason — kept verbatim' \
  '<!-- aif:project-checks:end -->' > "$D14/.ai-factory/tool-decisions.md"
( cd "$D14" && git init -q && git config user.email t@t && git config user.name t ) >/dev/null 2>&1
rec14="$D14/.ai-factory/tool-decisions.md"; rec14_before=$(cat "$rec14")
out=$( cd "$D14" && bash "$INSTALL" --refresh < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(14) refresh over an older record exits 0" || bad "(14) exit $rc (tail: $(tail -3 <<<"$out" | tr '\n' '|'))"
[ "$(cat "$rec14")" = "$rec14_before" ] \
  && ok "(14) older record byte-stable (lint listed ⇒ no-op; armed lines kept)" \
  || bad "(14) record changed: $(diff <<<"$rec14_before" <(cat "$rec14") | head -4 | tr '\n' '|')"
for pat in 'npm run build' 'npm run test' 'npm run typecheck' 'scripts/check-'; do
  ! grep -q -- "$pat" "$rec14" && ok "(14) scoped upsert added no $pat line" || bad "(14) record gained a $pat line"
done
out2=$( cd "$D14" && bash "$INSTALL" --refresh < /dev/null 2>&1 ); rc2=$?
[ "$rc2" -eq 0 ] && ok "(14) second refresh exits 0" || bad "(14) second refresh exit $rc2 (tail: $(tail -3 <<<"$out2" | tr '\n' '|'))"
grep -q 'stack: generic' <<<"$out2" \
  && ok "(14) refresh keeps stack: generic (preset-less name + barrel, #2047)" \
  || bad "(14) stack lost: $(grep '^stack:' <<<"$out2" | head -1)"
for p in scripts/run-armed.sh .github/workflows/getff-rules.yml .husky/pre-commit eslint-rules-local/index.mjs; do
  [ -f "$D14/$p" ] && ok "(14) capability persists across refreshes: $p" || bad "(14) capability lost: $p"
done

# ── (15) PREP-03: probe→fold at commit stages ONLY the record; WIP untouched; clone persists ───
D15=$(mktemp -d); TMPS+=("$D15")
drivable_fixture "$D15"   # NO node_modules at install ⇒ lint recorded not-armed
( cd "$D15" && git init -q && git config user.email t@t && git config user.name t ) >/dev/null 2>&1
out=$( cd "$D15" && bash "$INSTALL" generic --full < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(15) red-at-install (no node_modules) exits 0" || bad "(15) exit $rc (tail: $(tail -3 <<<"$out" | tr '\n' '|'))"
rec15="$D15/.ai-factory/tool-decisions.md"
grep -q 'npm run lint' <<<"$(grep -A2 '^not-armed:' "$rec15")" \
  && ok "(15) own lint recorded not-armed (honest P2 state)" || bad "(15) lint not recorded not-armed"
mkdir -p "$D15/node_modules"      # the project installs its deps; the next commit probes green
( cd "$D15" && git add -A ) >/dev/null 2>&1   # the delivery is committed ⇒ the record is tracked (fold's cacheinfo arm)
printf 'staged content\n' > "$D15/staged.txt"
( cd "$D15" && git add staged.txt ) >/dev/null 2>&1
printf 'unstaged content\n' > "$D15/unstaged.txt"
( cd "$D15" && git commit -qm wip ) >/dev/null 2>&1
grep -q 'npm run lint' <<<"$(grep -A2 '^armed:' "$rec15")" \
  && ok "(15) commit-time probe armed lint, fold moved it into the record" \
  || bad "(15) lint not armed after the probe→fold commit"
sidecar15="$(git -C "$D15" rev-parse --absolute-git-dir)/getff-armed.local"
{ [ ! -f "$sidecar15" ] || ! grep -q 'npm run lint' "$sidecar15"; } \
  && ok "(15) sidecar carries no lint line left after fold" || bad "(15) sidecar still lists lint"
c15files=$(git -C "$D15" show --name-only --format= HEAD)
grep -q '.ai-factory/tool-decisions.md' <<<"$c15files" && grep -q 'staged.txt' <<<"$c15files" \
  && ok "(15) the commit carried the record AND the user's staged file" \
  || bad "(15) commit contents: $(tr '\n' '|' <<<"$c15files")"
[ "$(cat "$D15/unstaged.txt" 2>/dev/null)" = "unstaged content" ] \
  && ok "(15) unstaged WIP file untouched" || bad "(15) unstaged WIP file lost/changed"
C15C=$(mktemp -d); TMPS+=("$C15C")
git clone -q "$D15" "$C15C" 2>/dev/null
v15=0; ( cd "$C15C" && bash scripts/run-armed.sh validate ) >/dev/null 2>&1 || v15=$?
[ "$v15" -eq 0 ] && ok "(15) fresh clone: tracked record ⇒ armed lint runs green (validate 0)" \
  || bad "(15) fresh-clone validate exit $v15"

# ── (16) M1/M2 (Root 8707663): ownership gates BOTH refresh writes; node pin on every owned write ──
D16=$(mktemp -d); TMPS+=("$D16")
drivable_fixture "$D16"
mkdir -p "$D16/node_modules" "$D16/.husky" "$D16/.github/workflows"
( cd "$D16" && git init -q && git config user.email t@t && git config user.name t ) >/dev/null 2>&1
# consumer-owned active destinations: no @aif-shield marker, no 'generated by getff' header
printf '#!/usr/bin/env sh\necho my own hook\n' > "$D16/.husky/pre-commit"; chmod +x "$D16/.husky/pre-commit"
printf 'name: getff-rules\nrun: echo my own workflow\n' > "$D16/.github/workflows/getff-rules.yml"
pc16=$(cat "$D16/.husky/pre-commit"); wf16=$(cat "$D16/.github/workflows/getff-rules.yml")
( cd "$D16" && git add -A && git commit -qm base ) >/dev/null 2>&1
printf 'staged bytes\n' > "$D16/staged.txt"; ( cd "$D16" && git add staged.txt ) >/dev/null 2>&1
printf 'unstaged bytes\n' > "$D16/unstaged.txt"
out=$( cd "$D16" && bash "$INSTALL" generic --full < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(16) fresh install over consumer-owned hook+workflow exits 0" \
  || bad "(16) fresh exit $rc (tail: $(tail -3 <<<"$out" | tr '\n' '|'))"
[ "$(cat "$D16/.husky/pre-commit")" = "$pc16" ] \
  && ok "(16) M1 fresh: consumer .husky/pre-commit byte-identical" || bad "(16) M1 fresh: pre-commit overwritten"
[ "$(cat "$D16/.github/workflows/getff-rules.yml")" = "$wf16" ] \
  && ok "(16) M1 fresh: consumer getff-rules.yml byte-identical" || bad "(16) M1 fresh: workflow overwritten"
grep -q 'your own .husky/pre-commit is kept' <<<"$out" \
  && ok "(16) M1 fresh: NOT wired names the kept consumer pre-commit" || bad "(16) M1 fresh: no keep note"
for i in 1 2; do
  out=$( cd "$D16" && bash "$INSTALL" --refresh < /dev/null 2>&1 ); rc=$?
  [ "$rc" -eq 0 ] && ok "(16) M1 refresh #$i exits 0" \
    || bad "(16) M1 refresh #$i exit $rc (tail: $(tail -3 <<<"$out" | tr '\n' '|'))"
  [ "$(cat "$D16/.husky/pre-commit")" = "$pc16" ] \
    && ok "(16) M1 refresh #$i: consumer pre-commit still byte-identical" || bad "(16) M1 refresh #$i: pre-commit overwritten"
  [ "$(cat "$D16/.github/workflows/getff-rules.yml")" = "$wf16" ] \
    && ok "(16) M1 refresh #$i: consumer workflow still byte-identical" || bad "(16) M1 refresh #$i: workflow overwritten"
done
grep -q 'kept, not refreshed' <<<"$out" \
  && ok "(16) M1: refresh names the kept consumer destinations" || bad "(16) M1: no consumer-owned keep line in refresh output"
grep -q 'your own .husky/pre-commit is kept' <<<"$out" \
  && ok "(16) M1: refresh NOT wired names the kept pre-commit" || bad "(16) M1: no keep note in refresh output"
[ "$(cat "$D16/staged.txt")" = "staged bytes" ] && [ "$(cat "$D16/unstaged.txt")" = "unstaged bytes" ] \
  && ok "(16) M1: user staged+unstaged bytes preserved across refreshes" || bad "(16) M1: user WIP lost"
grep -q '^staged.txt$' <<<"$( ( cd "$D16" && git diff --cached --name-only ) 2>/dev/null )" \
  && ok "(16) M1: staged file still staged after refresh" || bad "(16) M1: staging clobbered"
# getff-owned twin: same repo, getff's own deliveries — the refresh MUST genuinely rewrite them
rm -f "$D16/.husky/pre-commit" "$D16/.github/workflows/getff-rules.yml"
out=$( cd "$D16" && bash "$INSTALL" generic --full < /dev/null 2>&1 ); rc=$?
wf16g="$D16/.github/workflows/getff-rules.yml"
[ "$rc" -eq 0 ] && ok "(16) getff-owned fresh install exits 0" \
  || bad "(16) owned fresh exit $rc (tail: $(tail -3 <<<"$out" | tr '\n' '|'))"
grep -q '^# generated by getff' "$wf16g" \
  && ok "(16) owned workflow carries the getff identity header" || bad "(16) workflow lacks the identity header"
grep -q '@aif-shield: pre-commit' "$D16/.husky/pre-commit" \
  && ok "(16) owned generic pre-commit carries the identity marker" || bad "(16) pre-commit lacks the identity marker"
for i in 1 2; do
  out=$( cd "$D16" && bash "$INSTALL" --refresh < /dev/null 2>&1 ); rc=$?
  [ "$rc" -eq 0 ] && ok "(16) M2 owned refresh #$i exits 0" \
    || bad "(16) M2 refresh #$i exit $rc (tail: $(tail -3 <<<"$out" | tr '\n' '|'))"
  grep -q "node-version: '20'" "$wf16g" && ! grep -q 'node-version-file' "$wf16g" \
    && ok "(16) M2 refresh #$i: pin '20' present, no dangling .nvmrc ref (no .nvmrc in repo)" \
    || bad "(16) M2 refresh #$i: node pin lost after refresh"
  grep -q 'run-armed.sh validate' "$wf16g" \
    && ok "(16) M2 refresh #$i: the validate gate step is still reachable" || bad "(16) M2 refresh #$i: validate step lost"
  grep -q 'Install dependencies (own package manager' "$wf16g" \
    && ok "(16) M2 refresh #$i: setup-node still reaches the dependency step" || bad "(16) M2 refresh #$i: install step lost"
done
# own-.nvmrc twin: the project's version choice wins on every owned write and is never edited
printf '22.11.0\n' > "$D16/.nvmrc"; nvm16=$(cat "$D16/.nvmrc")
out=$( cd "$D16" && bash "$INSTALL" --refresh < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(16) M2 own-.nvmrc refresh exits 0" \
  || bad "(16) own-.nvmrc refresh exit $rc (tail: $(tail -3 <<<"$out" | tr '\n' '|'))"
grep -q "node-version-file: '.nvmrc'" "$wf16g" && ! grep -q "node-version: '20'" "$wf16g" \
  && ok "(16) M2 own-.nvmrc: node-version-file retained, pin not applied" \
  || bad "(16) M2 own-.nvmrc: substitution clobbered the project's choice"
[ "$(cat "$D16/.nvmrc")" = "$nvm16" ] \
  && ok "(16) M2 own-.nvmrc: the project's .nvmrc byte-identical" || bad "(16) M2 own-.nvmrc: .nvmrc edited"
# delegate-keep twin (R6, Root 68bf3519): marker-bearing (getff-owned metadata) destinations the
# refresh delegate itself KEEPS via a sibling .override.md (Layer 3) must keep their bytes AND
# mode — chmod/pin postprocessing runs only after an ACTUAL owned write, and metadata ownership
# alone is not such a write.
rm -f "$D16/.nvmrc"
printf '# consumer override decision — keep node 16\n' > "$D16/.github/workflows/getff-rules.yml.override.md"
ov16wf=$(cat "$D16/.github/workflows/getff-rules.yml.override.md")
# header-bearing, node-version-file-keeping workflow under Layer 3: reads getff-owned, but the
# delegate must keep it byte-for-byte (Root 68bf3519 failureScenario: the buggy pin rewrote
# exactly this shape, replacing the consumer's node-version-file choice with '20').
printf '# consumer note under override\n' >> "$wf16g"
wf16ov=$(cat "$wf16g")
printf '# my Layer-3 edits under override\n' >> "$D16/.husky/pre-commit"
pc16ov=$(cat "$D16/.husky/pre-commit")
printf '# consumer override — my hook, my mode\n' > "$D16/.husky/pre-commit.override.md"
ov16pc=$(cat "$D16/.husky/pre-commit.override.md")
chmod 0644 "$D16/.husky/pre-commit"
for i in 1 2; do
  out=$( cd "$D16" && bash "$INSTALL" --refresh < /dev/null 2>&1 ); rc=$?
  [ "$rc" -eq 0 ] && ok "(16) R6 override-keep refresh #$i exits 0" \
    || bad "(16) R6 override-keep refresh #$i exit $rc (tail: $(tail -3 <<<"$out" | tr '\n' '|'))"
  [ "$(cat "$wf16g")" = "$wf16ov" ] && grep -q "node-version-file: '.nvmrc'" "$wf16g" \
    && ok "(16) R6 override-keep #$i: kept workflow bytes preserved (Layer-3 node-version-file choice survives)" \
    || bad "(16) R6 override-keep #$i: kept workflow rewritten / node choice discarded"
  ! grep -q "node-version: '20'" "$wf16g" \
    && ok "(16) R6 override-keep #$i: no pin injected into the kept file" \
    || bad "(16) R6 override-keep #$i: node pin applied to a kept file"
  [ "$(cat "$D16/.husky/pre-commit")" = "$pc16ov" ] && [ ! -x "$D16/.husky/pre-commit" ] \
    && ok "(16) R6 override-keep #$i: kept hook bytes AND non-executable mode preserved" \
    || bad "(16) R6 override-keep #$i: kept hook bytes/mode altered"
done
[ "$(cat "$D16/.github/workflows/getff-rules.yml.override.md")" = "$ov16wf" ] \
  && [ "$(cat "$D16/.husky/pre-commit.override.md")" = "$ov16pc" ] \
  && ok "(16) R6 override-keep: both override markers byte-identical" || bad "(16) R6 override-keep: override marker touched"
grep -q 'getff-rules.yml (.override.md — consumer-owned, keeping)' <<<"$out" \
  && ok "(16) R6 override-keep: refresh names the kept workflow (Layer 3)" || bad "(16) R6 override-keep: no workflow keep line"
grep -q 'pre-commit (.override.md — consumer-owned, keeping)' <<<"$out" \
  && ok "(16) R6 override-keep: refresh names the kept hook (Layer 3)" || bad "(16) R6 override-keep: no hook keep line"
# custom/external link twin (R6): a marker-bearing destination that is an external/custom
# compatibility link is delegate-KEPT (refresh_safe link refusal) — nothing may write or chmod
# THROUGH the link into the consumer's target.
rm -f "$D16/.husky/pre-commit.override.md" "$D16/.github/workflows/getff-rules.yml.override.md"
E16=$(mktemp -d); TMPS+=("$E16")
printf '#!/usr/bin/env sh\n# @aif-shield: pre-commit\necho my externally linked hook\n' > "$E16/pc-target.sh"
pc16lk=$(cat "$E16/pc-target.sh"); chmod 0644 "$E16/pc-target.sh"
{ printf '# generated by getff — do not edit by hand\n'; printf 'name: getff-rules\nrun: echo externally linked workflow\n'; } > "$E16/wf-target.yml"
wf16lk=$(cat "$E16/wf-target.yml")
ln -sfn "$E16/pc-target.sh" "$D16/.husky/pre-commit"
ln -sfn "$E16/wf-target.yml" "$D16/.github/workflows/getff-rules.yml"
pc16tgt=$(readlink "$D16/.husky/pre-commit"); wf16tgt=$(readlink "$D16/.github/workflows/getff-rules.yml")
out=$( cd "$D16" && bash "$INSTALL" --refresh < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(16) R6 link-keep refresh exits 0" \
  || bad "(16) R6 link-keep refresh exit $rc (tail: $(tail -3 <<<"$out" | tr '\n' '|'))"
[ -L "$D16/.husky/pre-commit" ] && [ "$(readlink "$D16/.husky/pre-commit")" = "$pc16tgt" ] \
  && ok "(16) R6 link-keep: hook still a link to the same target" || bad "(16) R6 link-keep: hook link replaced"
[ -L "$D16/.github/workflows/getff-rules.yml" ] && [ "$(readlink "$D16/.github/workflows/getff-rules.yml")" = "$wf16tgt" ] \
  && ok "(16) R6 link-keep: workflow still a link to the same target" || bad "(16) R6 link-keep: workflow link replaced"
[ "$(cat "$E16/wf-target.yml")" = "$wf16lk" ] && ! grep -q "node-version: '20'" "$E16/wf-target.yml" \
  && ok "(16) R6 link-keep: no pin written through the link" || bad "(16) R6 link-keep: target rewritten through the link"
[ "$(cat "$E16/pc-target.sh")" = "$pc16lk" ] && [ ! -x "$E16/pc-target.sh" ] \
  && ok "(16) R6 link-keep: hook target bytes and mode preserved (no chmod through the link)" \
  || bad "(16) R6 link-keep: target chmodded/rewritten through the link"
grep -q 'external or custom compatibility link — target left unchanged' <<<"$out" \
  && ok "(16) R6 link-keep: refresh names the delegate link keeps" || bad "(16) R6 link-keep: no link keep line"
# discriminating stale twin (R6 falsifier): a marker-owned STALE destination with NO override
# sibling and NO link MUST genuinely refresh and re-pin — the fix cannot pass by skipping every
# rewrite (chmod too must fire after the actual owned write).
rm -f "$D16/.husky/pre-commit" "$D16/.github/workflows/getff-rules.yml"
{ printf '# generated by getff — do not edit by hand\n'; printf '# STALE-GENERIC-VARIANT (pre-N1 body)\n'; \
  printf 'name: getff-rules\n'; printf "node-version-file: '.nvmrc'\n"; printf 'run: echo stale\n'; } > "$wf16g"
{ printf '#!/usr/bin/env sh\n'; printf '# @aif-shield: pre-commit\n'; printf '# STALE-HOOK-BODY\n'; printf 'echo stale hook\n'; } > "$D16/.husky/pre-commit"
chmod 0644 "$D16/.husky/pre-commit"
out=$( cd "$D16" && bash "$INSTALL" --refresh < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(16) R6 stale-owned refresh exits 0" \
  || bad "(16) R6 stale-owned refresh exit $rc (tail: $(tail -3 <<<"$out" | tr '\n' '|'))"
! grep -q 'STALE-GENERIC-VARIANT' "$wf16g" \
  && ok "(16) R6 stale-owned: stale workflow genuinely rewritten" || bad "(16) R6 stale-owned: stale bytes survived (refresh skipped)"
grep -q "node-version: '20'" "$wf16g" && ! grep -q 'node-version-file' "$wf16g" \
  && ok "(16) R6 stale-owned: rewritten file re-pinned (20, no .nvmrc ref)" \
  || bad "(16) R6 stale-owned: re-pin missing after the owned rewrite"
grep -q 'run-armed.sh validate' "$wf16g" \
  && ok "(16) R6 stale-owned: current template body present" || bad "(16) R6 stale-owned: current body missing"
! grep -q 'STALE-HOOK-BODY' "$D16/.husky/pre-commit" && grep -q '@aif-shield: pre-commit' "$D16/.husky/pre-commit" \
  && ok "(16) R6 stale-owned: stale hook genuinely rewritten (marker retained)" || bad "(16) R6 stale-owned: hook stale bytes survived"
[ -x "$D16/.husky/pre-commit" ] \
  && ok "(16) R6 stale-owned: chmod DID run after the actual owned write" || bad "(16) R6 stale-owned: owned hook left non-executable"
# dispatch record-reader twins (Root 2067-MAPPING-R9-STACK-READER-OWNED-FENCE): the record-first
# --refresh reader must take `stack:` ONLY from the installer-owned
# <!-- aif:project-checks:begin/end --> block of .ai-factory/tool-decisions.md. The writer
# (setup.d/lib.sh record_project_checks) preserves every line outside that fence byte-for-byte,
# so a foreign `stack:` line elsewhere in the same file must never steer dispatch — neither
# before an owned record that says otherwise, nor when there is no owned record at all (the
# promised legacy heuristic fallback).
rec16="$D16/.ai-factory/tool-decisions.md"
grep -q '<!-- aif:project-checks:begin -->' "$rec16" && grep -q '^stack: generic$' "$rec16" \
  && ok "(16) dispatch: fixture record carries the owned fence with stack: generic" \
  || bad "(16) dispatch: fixture record lacks the owned generic record"
_16foreign=$(mktemp); TMPS+=("$_16foreign")
{ printf '%s\n' '### Another tool (foreign section, not getff-owned)' 'stack: ts-server'; cat "$rec16"; } > "$_16foreign"
cat "$_16foreign" > "$rec16"
out=$( cd "$D16" && bash "$INSTALL" --refresh < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(16) dispatch foreign-before-owned refresh exits 0" \
  || bad "(16) dispatch foreign-before-owned refresh exit $rc (tail: $(tail -3 <<<"$out" | tr '\n' '|'))"
grep -q 'stack: generic' <<<"$out" && ! grep -q 'stack: ts-server' <<<"$out" \
  && ok "(16) dispatch foreign-before-owned: the OWNED generic record wins (foreign ts-server ignored; this fixture's heuristics alone would say ts-server)" \
  || bad "(16) dispatch foreign-before-owned: stack resolution: $(grep 'stack:' <<<"$out" | head -1)"
grep -q 'Refresh stack from the installer-owned project-checks record: stack: generic' <<<"$out" \
  && ok "(16) dispatch foreign-before-owned: refresh names the owned record as the source" \
  || bad "(16) dispatch foreign-before-owned: no owned-record source line"
# missing-owned-record twin: no fence at all, one foreign stack line only — the reader must
# fall back to the file heuristics (a preset-less own-Astro name resolves generic), never let
# the foreign line impersonate the record.
D16R=$(mktemp -d); TMPS+=("$D16R")
drivable_fixture "$D16R"
printf 'export default {}\n' > "$D16R/astro.config.mjs"   # preset-less NAME — heuristics resolve generic
mkdir -p "$D16R/.ai-factory"
printf '%s\n' '### Another tool (foreign section, not getff-owned)' 'stack: ts-server' > "$D16R/.ai-factory/tool-decisions.md"
out=$( cd "$D16R" && bash "$INSTALL" --refresh < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(16) dispatch missing-owned-record refresh exits 0" \
  || bad "(16) dispatch missing-owned-record refresh exit $rc (tail: $(tail -3 <<<"$out" | tr '\n' '|'))"
grep -q 'stack: generic' <<<"$out" && ! grep -q 'stack: ts-server' <<<"$out" \
  && ok "(16) dispatch missing-owned-record: heuristic fallback used (generic), foreign line ignored" \
  || bad "(16) dispatch missing-owned-record: stack resolution: $(grep 'stack:' <<<"$out" | head -1)"
[ -f "$D16R/.github/workflows/getff-rules.yml" ] \
  && ok "(16) dispatch missing-owned-record: generic arm delivered the workflow (the npm arm delivers none)" \
  || bad "(16) dispatch missing-owned-record: no workflow delivered — the npm arm ran"
grep -q '^# generated by getff' "$D16R/.github/workflows/getff-rules.yml" \
  && ok "(16) dispatch missing-owned-record: delivered workflow carries the identity header" \
  || bad "(16) dispatch missing-owned-record: workflow lacks the identity header"

# ── (17) R11-KEEP (Root 0494f7b6): no chmod after a delegate keep — fresh hook/runner and refresh
# runner keep literal link, target bytes AND mode; owned writes stay executable ─────────────────
# The three scoped generic callsites (50-hooks F2 fresh hook, 40-configs F1a fresh runner,
# install.sh R1 refresh runner) used to chmod unconditionally after copy_safe/refresh_safe
# returned 0 — but return 0 is not write proof: a kept consumer file, a refused external/custom
# link and an .override.md-backed runner all satisfy the existence checks, and chmod FOLLOWS a
# link into the consumer's target outside the tree (Root failureScenario: a deliberately
# non-executable shared hook gets activated). Same R6 delivery-ownership gate as (16)'s
# hook/workflow arms; the (16) fresh fixture pre-chmods its consumer hook executable, so these
# twins are the mode-discriminating half with deliberately non-executable 0644 consumers.
D17=$(mktemp -d); TMPS+=("$D17")
drivable_fixture "$D17"
mkdir -p "$D17/node_modules" "$D17/.husky" "$D17/scripts"
( cd "$D17" && git init -q && git config user.email t@t && git config user.name t ) >/dev/null 2>&1
# deliberately DISABLED consumer hook: mode 0644 means husky would never run it
printf '#!/usr/bin/env sh\necho my disabled hook\n' > "$D17/.husky/pre-commit"; chmod 0644 "$D17/.husky/pre-commit"
pc17=$(cat "$D17/.husky/pre-commit")
# deliberately non-executable consumer record runner at the F1a destination
printf '#!/usr/bin/env bash\necho my own runner\n' > "$D17/scripts/run-armed.sh"; chmod 0644 "$D17/scripts/run-armed.sh"
ra17=$(cat "$D17/scripts/run-armed.sh")
out=$( cd "$D17" && bash "$INSTALL" generic --full < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(17) fresh install over consumer hook+runner exits 0" \
  || bad "(17) fresh exit $rc (tail: $(tail -3 <<<"$out" | tr '\n' '|'))"
[ "$(cat "$D17/.husky/pre-commit")" = "$pc17" ] && [ ! -x "$D17/.husky/pre-commit" ] \
  && ok "(17) KEEP fresh: consumer hook bytes AND non-executable mode preserved (no activation)" \
  || bad "(17) KEEP fresh: kept hook bytes/mode altered"
[ "$(cat "$D17/scripts/run-armed.sh")" = "$ra17" ] && [ ! -x "$D17/scripts/run-armed.sh" ] \
  && ok "(17) KEEP fresh: consumer runner bytes AND non-executable mode preserved" \
  || bad "(17) KEEP fresh: kept runner bytes/mode altered"
# fresh external-link hook twin: the literal link, its outside target's bytes AND mode survive
E17=$(mktemp -d); TMPS+=("$E17")
D17L=$(mktemp -d); TMPS+=("$D17L")
drivable_fixture "$D17L"
mkdir -p "$D17L/node_modules" "$D17L/.husky"
( cd "$D17L" && git init -q && git config user.email t@t && git config user.name t ) >/dev/null 2>&1
printf '#!/usr/bin/env sh\necho my externally linked hook\n' > "$E17/pc-target.sh"
pc17l=$(cat "$E17/pc-target.sh"); chmod 0644 "$E17/pc-target.sh"
ln -sfn "$E17/pc-target.sh" "$D17L/.husky/pre-commit"
pc17lt=$(readlink "$D17L/.husky/pre-commit")
out=$( cd "$D17L" && bash "$INSTALL" generic --full < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(17) link-keep fresh install exits 0" \
  || bad "(17) link-keep fresh exit $rc (tail: $(tail -3 <<<"$out" | tr '\n' '|'))"
[ -L "$D17L/.husky/pre-commit" ] && [ "$(readlink "$D17L/.husky/pre-commit")" = "$pc17lt" ] \
  && ok "(17) link-keep fresh: hook still the same literal link" || bad "(17) link-keep fresh: link replaced"
[ "$(cat "$E17/pc-target.sh")" = "$pc17l" ] && [ ! -x "$E17/pc-target.sh" ] \
  && ok "(17) link-keep fresh: external target bytes AND mode preserved (no chmod through the link)" \
  || bad "(17) link-keep fresh: target chmodded/rewritten through the link"
grep -q 'external or custom compatibility link — target left unchanged' <<<"$out" \
  && ok "(17) link-keep fresh: install names the delegate link keep" || bad "(17) link-keep fresh: no link keep line"
# owned-write positives + refresh keeps on the runner: F1a fresh delivers the runner and the
# hook EXECUTABLE; a refresh .override.md-kept runner and a refresh external-link runner keep
# bytes/link/mode; an owned refresh re-delivery is executable again.
D17R=$(mktemp -d); TMPS+=("$D17R")
drivable_fixture "$D17R"
mkdir -p "$D17R/node_modules"
( cd "$D17R" && git init -q && git config user.email t@t && git config user.name t ) >/dev/null 2>&1
out=$( cd "$D17R" && bash "$INSTALL" generic --full < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(17) owned fresh install exits 0" \
  || bad "(17) owned fresh exit $rc (tail: $(tail -3 <<<"$out" | tr '\n' '|'))"
[ -x "$D17R/scripts/run-armed.sh" ] \
  && ok "(17) owned fresh: delivered record runner executable (actual owned write)" \
  || bad "(17) owned fresh: delivered runner not +x"
[ -x "$D17R/.husky/pre-commit" ] \
  && ok "(17) owned fresh: delivered hook executable (actual owned write)" \
  || bad "(17) owned fresh: delivered hook not +x"
# refresh keep 1: .override.md-backed runner (Layer 3) — bytes AND mode must survive the refresh
printf '# consumer note under override\n' >> "$D17R/scripts/run-armed.sh"
chmod 0644 "$D17R/scripts/run-armed.sh"
ra17ov=$(cat "$D17R/scripts/run-armed.sh")
printf '# consumer override — my runner, my mode\n' > "$D17R/scripts/run-armed.sh.override.md"
out=$( cd "$D17R" && bash "$INSTALL" --refresh < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(17) override-keep refresh exits 0" \
  || bad "(17) override-keep refresh exit $rc (tail: $(tail -3 <<<"$out" | tr '\n' '|'))"
[ "$(cat "$D17R/scripts/run-armed.sh")" = "$ra17ov" ] && [ ! -x "$D17R/scripts/run-armed.sh" ] \
  && ok "(17) override-keep: kept runner bytes AND non-executable mode preserved" \
  || bad "(17) override-keep: kept runner bytes/mode altered"
grep -q 'run-armed.sh (.override.md — consumer-owned, keeping)' <<<"$out" \
  && ok "(17) override-keep: refresh names the kept runner (Layer 3)" || bad "(17) override-keep: no runner keep line"
# refresh keep 2: external/custom link runner — literal link + outside target bytes AND mode
rm -f "$D17R/scripts/run-armed.sh.override.md" "$D17R/scripts/run-armed.sh"
printf '#!/usr/bin/env bash\necho my externally linked runner\n' > "$E17/ra-target.sh"
ra17l=$(cat "$E17/ra-target.sh"); chmod 0644 "$E17/ra-target.sh"
ln -sfn "$E17/ra-target.sh" "$D17R/scripts/run-armed.sh"
ra17lt=$(readlink "$D17R/scripts/run-armed.sh")
out=$( cd "$D17R" && bash "$INSTALL" --refresh < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(17) link-keep refresh exits 0" \
  || bad "(17) link-keep refresh exit $rc (tail: $(tail -3 <<<"$out" | tr '\n' '|'))"
[ -L "$D17R/scripts/run-armed.sh" ] && [ "$(readlink "$D17R/scripts/run-armed.sh")" = "$ra17lt" ] \
  && ok "(17) link-keep refresh: runner still the same literal link" || bad "(17) link-keep refresh: link replaced"
[ "$(cat "$E17/ra-target.sh")" = "$ra17l" ] && [ ! -x "$E17/ra-target.sh" ] \
  && ok "(17) link-keep refresh: external target bytes AND mode preserved (no chmod through the link)" \
  || bad "(17) link-keep refresh: target chmodded/rewritten through the link"
# refresh positive: after the keeps are gone the owned re-delivery must be executable again —
# the gate may not pass by never chmodding (the (16) stale-owned falsifier shape, runner arm)
rm -f "$D17R/scripts/run-armed.sh"
out=$( cd "$D17R" && bash "$INSTALL" --refresh < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(17) owned re-delivery refresh exits 0" \
  || bad "(17) owned re-delivery refresh exit $rc (tail: $(tail -3 <<<"$out" | tr '\n' '|'))"
[ -x "$D17R/scripts/run-armed.sh" ] \
  && ok "(17) owned re-delivery: refreshed runner executable (chmod DID run after the owned write)" \
  || bad "(17) owned re-delivery: refreshed runner left non-executable"

# ── (18) D1 (fidelity round 1): a forced overwrite of the existing workflow IS an admitted
# owned write — the GETFF-SUBST-NODE pin must follow every admitted write, and only those ──
# The 40-configs fresh arm gated the pin on pre-write destination absence, but copy_safe's
# --force arm overwrites an existing regular destination (setup.d/lib.sh), so
# `generic --full --force` on an existing workflow wrote the template's dangling
# node-version-file: '.nvmrc' and never pinned '20' — setup-node then stops before the
# run-armed.sh validate gate is reachable (M2: substitution follows EVERY actual owned write).
D18=$(mktemp -d); TMPS+=("$D18")
drivable_fixture "$D18"
mkdir -p "$D18/node_modules"
( cd "$D18" && git init -q && git config user.email t@t && git config user.name t ) >/dev/null 2>&1
out=$( cd "$D18" && bash "$INSTALL" generic --full < /dev/null 2>&1 ); rc=$?
wf18="$D18/.github/workflows/getff-rules.yml"
{ [ "$rc" -eq 0 ] && [ -f "$wf18" ]; } && ok "(18) prior generic install delivered the workflow" \
  || bad "(18) prior install exit $rc / workflow missing"
grep -q "node-version: '20'" "$wf18" \
  && ok "(18) prior install pinned '20' (absent-destination write)" \
  || bad "(18) prior install pin missing"
# forced overwrite, no own .nvmrc — the admitted forced write must re-pin
out=$( cd "$D18" && bash "$INSTALL" generic --full --force < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(18) forced overwrite exits 0" \
  || bad "(18) forced exit $rc (tail: $(tail -3 <<<"$out" | tr '\n' '|'))"
grep -q "node-version: '20'" "$wf18" && ! grep -q 'node-version-file' "$wf18" \
  && ok "(18) D1: forced write re-pins '20' (no dangling .nvmrc ref)" \
  || bad "(18) D1: forced write left the dangling node-version-file"
grep -q 'run-armed.sh validate' "$wf18" && grep -q '^# generated by getff' "$wf18" \
  && ok "(18) D1: rewritten workflow keeps the identity header and the validate gate" \
  || bad "(18) D1: rewritten workflow lost header/gate"
# own-.nvmrc forced twin: the project's version choice survives a forced overwrite
printf '22.11.0\n' > "$D18/.nvmrc"; nvm18=$(cat "$D18/.nvmrc")
out=$( cd "$D18" && bash "$INSTALL" generic --full --force < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(18) own-.nvmrc forced overwrite exits 0" \
  || bad "(18) own-.nvmrc forced exit $rc (tail: $(tail -3 <<<"$out" | tr '\n' '|'))"
grep -q "node-version-file: '.nvmrc'" "$wf18" && ! grep -q "node-version: '20'" "$wf18" \
  && ok "(18) own-.nvmrc forced twin: the project's node choice kept, pin not applied" \
  || bad "(18) own-.nvmrc forced twin: choice clobbered"
[ "$(cat "$D18/.nvmrc")" = "$nvm18" ] \
  && ok "(18) own-.nvmrc byte-identical" || bad "(18) .nvmrc edited"
rm -f "$D18/.nvmrc"
# --force --dry-run: no write at all — the bytes on disk stay untouched
wf18sum=$(shasum "$wf18" | cut -d' ' -f1)
out=$( cd "$D18" && bash "$INSTALL" generic --full --force --dry-run < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && [ "$wf18sum" = "$(shasum "$wf18" | cut -d' ' -f1)" ] \
  && ok "(18) forced --dry-run writes nothing (bytes untouched)" \
  || bad "(18) forced --dry-run changed the workflow"
# --force over an external/custom link: the link refusal outranks --force (copy_safe's first
# guard) — nothing may be written or postprocessed through the link into the outside target.
# CODE round (2026-11-01): the target must carry the literal substitutable
# node-version-file: '.nvmrc' line — without it sed has no match, so even a guardless
# postprocess would rewrite identical bytes through the link and the unchanged-byte assertion
# could not discriminate removal of the production link guard (isolated mutation proof:
# old material 5/0 vs repaired material FAIL on the same mutant).
E18=$(mktemp -d); TMPS+=("$E18")
{ printf '# generated by getff — do not edit by hand\n'; printf 'name: getff-rules\n'; printf "node-version-file: '.nvmrc'\n"; printf 'run: echo externally linked workflow\n'; } > "$E18/wf-target.yml"
wf18lk=$(cat "$E18/wf-target.yml"); chmod 0644 "$E18/wf-target.yml"
wf18mode=$(stat -f '%Lp' "$E18/wf-target.yml" 2>/dev/null || stat -c '%a' "$E18/wf-target.yml")
ln -sfn "$E18/wf-target.yml" "$wf18"
wf18tgt=$(readlink "$wf18")
out=$( cd "$D18" && bash "$INSTALL" generic --full --force < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(18) link-keep forced install exits 0" \
  || bad "(18) link-keep forced exit $rc (tail: $(tail -3 <<<"$out" | tr '\n' '|'))"
[ -L "$wf18" ] && [ "$(readlink "$wf18")" = "$wf18tgt" ] \
  && ok "(18) link-keep forced: workflow still the same literal link" \
  || bad "(18) link-keep forced: link replaced"
[ "$(cat "$E18/wf-target.yml")" = "$wf18lk" ] && ! grep -q "node-version: '20'" "$E18/wf-target.yml" \
  && ok "(18) link-keep forced: target bytes preserved, no pin through the link" \
  || bad "(18) link-keep forced: target rewritten through the link"
[ "$(stat -f '%Lp' "$E18/wf-target.yml" 2>/dev/null || stat -c '%a' "$E18/wf-target.yml")" = "$wf18mode" ] \
  && ok "(18) link-keep forced: target mode preserved" \
  || bad "(18) link-keep forced: target mode changed"

# ── (19) K1 (source-intent addendum 2026-11-01): ONLY a recorded generic takes the record
# exception on plain --refresh; every other recorded value runs the original file-based
# classifier chain, and an explicit positional stack outranks the record ──────────────────
D19=$(mktemp -d); TMPS+=("$D19")
drivable_fixture "$D19"   # bare: no preset-less name signal, no legacy classifier passport
mkdir -p "$D19/node_modules"
( cd "$D19" && git init -q && git config user.email t@t && git config user.name t ) >/dev/null 2>&1
out=$( cd "$D19" && bash "$INSTALL" generic --full < /dev/null 2>&1 ); rc=$?
rec19="$D19/.ai-factory/tool-decisions.md"
{ [ "$rc" -eq 0 ] && [ -f "$D19/eslint-rules-local/index.mjs" ]; } \
  && ok "(19) real generic install generated the barrel" \
  || bad "(19) install exit $rc / barrel missing"
grep -q '^stack: generic$' "$rec19" \
  && ok "(19) owned record carries stack: generic" \
  || bad "(19) owned record lacks the generic stack line"
out=$( cd "$D19" && bash "$INSTALL" --refresh < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(19) plain refresh over the owned generic record exits 0" \
  || bad "(19) plain refresh exit $rc (tail: $(tail -3 <<<"$out" | tr '\n' '|'))"
grep -q 'Refresh stack from the installer-owned project-checks record: stack: generic' <<<"$out" \
  && ok "(19) recorded generic takes the exception on plain refresh" \
  || bad "(19) recorded generic did not take the exception"
grep -q 'stack: generic' <<<"$out" && ! grep -q 'stack: ts-server' <<<"$out" \
  && ok "(19) generic route reached (own barrel did not turn the install ts-server)" \
  || bad "(19) stack resolution: $(grep 'stack:' <<<"$out" | head -1)"
# no-owned-value falsifier: drop the owned stack line, append a FOREIGN stack line after the
# fence — the reader must fall back to the ORIGINAL heuristic chain (bare + getff's own
# barrel ⇒ ts-server per #2047), never read the foreign line.
sed -i.bak '/^stack: generic$/d' "$rec19" && rm -f "$rec19.bak"
printf '%s\n' '### Another tool (foreign section, not getff-owned)' 'stack: react-spa' >> "$rec19"
out=$( cd "$D19" && bash "$INSTALL" --refresh < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && grep -q 'stack: ts-server' <<<"$out" && ! grep -q 'Refresh stack from the installer-owned' <<<"$out" \
  && ok "(19) missing owned value: original heuristic chain ran (ts-server per #2047; foreign react-spa ignored)" \
  || bad "(19) missing owned value: resolution $(grep 'stack:' <<<"$out" | head -1) exit $rc"
# discriminating K1 twin: a recorded NON-generic value must NOT gain record-first precedence —
# a real legacy classifier passport (RULES.react-next.md) decides, as it always did.
D19C=$(mktemp -d); TMPS+=("$D19C")
drivable_fixture "$D19C"
mkdir -p "$D19C/.ai-factory"
printf '%s\n' '<!-- aif:project-checks:begin -->' 'stack: ts-server' '<!-- aif:project-checks:end -->' \
  > "$D19C/.ai-factory/tool-decisions.md"
printf '# react-next rules\n' > "$D19C/.ai-factory/RULES.react-next.md"
( cd "$D19C" && git init -q && git config user.email t@t && git config user.name t ) >/dev/null 2>&1
out=$( cd "$D19C" && bash "$INSTALL" --refresh < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(19) recorded-non-generic refresh exits 0" \
  || bad "(19) recorded-non-generic refresh exit $rc (tail: $(tail -3 <<<"$out" | tr '\n' '|'))"
grep -q 'stack: react-next' <<<"$out" && ! grep -q 'stack: ts-server' <<<"$out" \
  && ok "(19) K1: recorded ts-server did NOT outrank the react-next passport (original precedence)" \
  || bad "(19) K1: record-first for a non-generic value: $(grep 'stack:' <<<"$out" | head -1)"
! grep -q 'Refresh stack from the installer-owned project-checks record' <<<"$out" \
  && ok "(19) K1: no record-exception line for a non-generic value" \
  || bad "(19) K1: record exception fired for a non-generic value"
# explicit positional stack outranks the record (addendum §1: the exception applies only to
# plain --refresh with no explicit stack)
out=$( cd "$D19C" && bash "$INSTALL" generic --refresh < /dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(19) positional-over-record refresh exits 0" \
  || bad "(19) positional-over-record refresh exit $rc (tail: $(tail -3 <<<"$out" | tr '\n' '|'))"
grep -q 'stack: generic' <<<"$out" && ! grep -q 'stack: ts-server' <<<"$out" \
  && ! grep -q 'Refresh stack from the installer-owned project-checks record' <<<"$out" \
  && ok "(19) explicit positional generic wins over the recorded ts-server" \
  || bad "(19) positional priority lost: $(grep 'stack:' <<<"$out" | head -1)"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
