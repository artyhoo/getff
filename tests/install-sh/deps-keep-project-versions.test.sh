#!/usr/bin/env bash
# deps-keep-project-versions.test.sh — P2 G2 (one-button, operator log entry 28 fork 1 = A: «the
# project's versions and settings are not changed»). Two defects measured on a create-vite project
# (P0/P1 runs, 2026-09-29):
#   - `npm install -D typescript@^5.7.0 @types/node@^22.10.0` rewrote specs the project already
#     declared (~6.0.2 → ^5.9.3, ^24.13.3 → ^22.20.4);
#   - an ERESOLVE (@vitejs/plugin-react 6.1.1 peers vite ^8, the project has vite 6) was retried
#     with --legacy-peer-deps, which installed a tree whose vitest could not load its config.
# Repair (setup.d/70-deps.sh): every package the project already declares is dropped from the
# install and named as kept; an ERESOLVE is parsed, the conflicting package of OURS is dropped and
# the install retried STRICT (at most 3 drops), each drop a NOT wired line quoting npm; a message
# the parser cannot read ends the install as NOT wired with npm's first line. --legacy-peer-deps
# stays only for the arborist crash (a TypeError, not ERESOLVE) and for react-native.
#
# Fixtures (tests/install-sh/fixtures/eresolve/): the two *.npm11.txt files are REAL npm 11.4.2
# output recorded 2026-09-29 with `npm install --dry-run --save-dev <spec>` in a temp project
# (home path shortened to ~/): plugin-react 6.1.1 against a declared vite ^6.0.0, and
# eslint-plugin-react-native-a11y against eslint ^9. truncated-header-only.txt is the first two
# lines of the first one — npm output cut before it names any package.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
FX="$REPO_ROOT/tests/install-sh/fixtures/eresolve"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
TMPS=()
cleanup() { [ "${#TMPS[@]}" -gt 0 ] && rm -rf "${TMPS[@]}"; }
trap cleanup EXIT

# Load lib.sh + the 70-deps helpers only (DEPS_LIB_ONLY stops the layer after its helpers).
load() {
  # shellcheck disable=SC1090
  INSTALL_SH_LIB_ONLY=1 source "$REPO_ROOT/setup.d/lib.sh"
  # shellcheck disable=SC1090
  DEPS_LIB_ONLY=1 source "$REPO_ROOT/setup.d/70-deps.sh"
}

# ── (A) spec → package name ─────────────────────────────────────────────────────────────────────
out=$( load; for s in 'typescript@^5.7.0' '@types/node@^22.10.0' '@vitejs/plugin-react' 'jsdom' 'prettier@3.8.3'; do deps_spec_name "$s"; done | tr '\n' ' ' )
[ "$out" = "typescript @types/node @vitejs/plugin-react jsdom prettier " ] && ok "(A) spec names: $out" || bad "(A) spec names: '$out'"

# ── (B) declared packages are dropped and named as kept ──────────────────────────────────────────
P=$(mktemp -d); TMPS+=("$P")
cat > "$P/package.json" <<'JSON'
{ "name": "p", "version": "0.0.0",
  "dependencies": { "zod": "^4.1.0" },
  "devDependencies": { "typescript": "~6.0.2", "@types/node": "^24.13.3", "vite": "^6.0.0" },
  "peerDependencies": { "react": "^19" },
  "optionalDependencies": { "fsevents": "^2" } }
JSON
out=$( load; PROJECT_ROOT="$P"
  DEVDEPS=( typescript@^5.7.0 @types/node@^22.10.0 vite@^8.0.0 eslint@^9 react fsevents@^2 )
  RUNTIME_DEPS=( zod@^3.24.0 )
  deps_drop_declared
  echo "DEVDEPS=${DEVDEPS[*]}"; echo "RUNTIME_DEPS=${RUNTIME_DEPS[*]-}"; echo "RT_COUNT=${#RUNTIME_DEPS[@]}" ) 2>&1
grep -q '^DEVDEPS=eslint@^9$' <<<"$out" && ok "(B) only the undeclared eslint@^9 stays in DEVDEPS" || bad "(B) DEVDEPS: $(grep '^DEVDEPS' <<<"$out")"
grep -q '^RT_COUNT=0$' <<<"$out" && ok "(B) the declared zod leaves RUNTIME_DEPS empty" || bad "(B) RUNTIME_DEPS: $(grep '^RUNTIME_DEPS' <<<"$out")"
for k in 'typescript ~6.0.2' '@types/node ^24.13.3' 'vite ^6.0.0' 'react ^19' 'fsevents ^2' 'zod ^4.1.0'; do
  grep -qF "kept your $k" <<<"$out" && ok "(B) says «kept your $k»" || bad "(B) no «kept your $k» line"
done

# ── (C-E) the ERESOLVE parser on recorded npm output ─────────────────────────────────────────────
out=$( load; deps_eresolve_culprit "$FX/plugin-react-vite6.npm11.txt" eslint@^9 @vitejs/plugin-react jsdom )
[ "$out" = "@vitejs/plugin-react" ] && ok "(C) plugin-react/vite 6: culprit = @vitejs/plugin-react" || bad "(C) culprit '$out'"
out=$( load; deps_eresolve_detail "$FX/plugin-react-vite6.npm11.txt" )
grep -qF 'peer vite@"^8.0.0" from @vitejs/plugin-react@6.1.1' <<<"$out" && grep -qF 'found vite@6.4.3' <<<"$out" \
  && ok "(C) detail quotes npm: $out" || bad "(C) detail '$out'"
out=$( load; deps_eresolve_culprit "$FX/plugin-react-vite6.npm11.txt" eslint@^9 vite@^8.0.0 @vitejs/plugin-react )
[ "$out" = "@vitejs/plugin-react" ] && ok "(C) with both ours, the requester is dropped, not the peer it asks for" || bad "(C) both-ours culprit '$out'"
out=$( load; deps_eresolve_culprit "$FX/rn-a11y-eslint9.npm11.txt" eslint@^9 eslint-plugin-react-native-a11y )
[ "$out" = "eslint-plugin-react-native-a11y" ] && ok "(D) rn-a11y/eslint 9: culprit = eslint-plugin-react-native-a11y" || bad "(D) culprit '$out'"
out=$( load; deps_eresolve_culprit "$FX/truncated-header-only.txt" eslint@^9 @vitejs/plugin-react )
[ -z "$out" ] && ok "(E) a message that names no package gives no culprit" || bad "(E) culprit '$out' from a truncated message"
out=$( load; deps_eresolve_culprit "$FX/plugin-react-vite6.npm11.txt" eslint@^9 jsdom )
[ -z "$out" ] && ok "(E) a conflict with none of OUR packages gives no culprit" || bad "(E) culprit '$out' not in the request"

# ── stub npm: fails with $STUB_FAIL_WITH when the argv holds $STUB_FAIL_IF (a package name) ───────
stub_dir() {
  local d; d=$(mktemp -d); TMPS+=("$d")
  cat > "$d/npm" <<'SH'
#!/usr/bin/env bash
echo "STUB-NPM $*" >> "$STUB_LOG"
if [ -n "${STUB_FAIL_IF:-}" ]; then
  for a in "$@"; do
    case "$a" in "$STUB_FAIL_IF"|"$STUB_FAIL_IF"@*) cat "$STUB_FAIL_WITH" >&2; exit 1 ;; esac
  done
fi
if [ -n "${STUB_ALWAYS_FAIL_WITH:-}" ]; then cat "$STUB_ALWAYS_FAIL_WITH" >&2; exit 1; fi
if [ -n "${STUB_CULPRIT_IS_FIRST:-}" ]; then   # name the first non-flag spec as the culprit
  for a in "$@"; do case "$a" in install|-*) ;; *) n="${a%@*}"; [ -z "$n" ] && n="$a"
    printf 'npm error code ERESOLVE\nnpm error Could not resolve dependency:\nnpm error peer x@"^1" from %s@1.0.0\n' "$n" >&2; exit 1 ;; esac; done
fi
exit 0
SH
  chmod +x "$d/npm"; echo "$d"
}

run_install() {  # prints helper rc, final specs, NOT wired, fail reason; env selects the stub mode
  local P S; P=$(mktemp -d); TMPS+=("$P"); S=$(stub_dir)
  echo '{"name":"p","version":"0.0.0"}' > "$P/package.json"
  export STUB_LOG="$P/npm.log"
  ( load; PROJECT_ROOT="$P"; PATH="$S:$PATH"; NOT_WIRED=(); NPM_PEER_FLAG=""
    deps_npm_install_strict --save-dev "$@"; echo "RC=$?"
    echo "SPECS=${DEPS_NPM_SPECS[*]-}"
    [ "${#NOT_WIRED[@]}" -gt 0 ] && printf 'NOT_WIRED: %s\n' "${NOT_WIRED[@]}"
    echo "REASON=${DEPS_NPM_FAIL_REASON:-}" ) 2>&1
  cat "$STUB_LOG" 2>/dev/null
}

# ── (F) ERESOLVE on one of ours → dropped, strict retry succeeds, named in NOT wired ─────────────
out=$( STUB_FAIL_IF=@vitejs/plugin-react STUB_FAIL_WITH="$FX/plugin-react-vite6.npm11.txt" run_install eslint@^9 @vitejs/plugin-react jsdom )
grep -q '^RC=0$' <<<"$out" && ok "(F) the install succeeds after the drop" || bad "(F) rc: $(grep '^RC' <<<"$out")"
grep -q '^SPECS=eslint@^9 jsdom$' <<<"$out" && ok "(F) the final install is everything but the culprit" || bad "(F) $(grep '^SPECS' <<<"$out")"
grep -q '^STUB-NPM .*--legacy-peer-deps' <<<"$out" && bad "(F) --legacy-peer-deps was used on an ERESOLVE" || ok "(F) no --legacy-peer-deps on an ERESOLVE"
grep -qF 'NOT_WIRED: dev dependency @vitejs/plugin-react — not installed: npm could not fit it next to your packages (npm: peer vite@"^8.0.0" from @vitejs/plugin-react@6.1.1; found vite@6.4.3)' <<<"$out" \
  && ok "(F) NOT wired names the dropped package with npm's reason" || bad "(F) NOT wired: $(grep 'NOT_WIRED' <<<"$out")"

# ── (G) an unparsable ERESOLVE → no retry, NOT wired with npm's first line ───────────────────────
out=$( STUB_ALWAYS_FAIL_WITH="$FX/truncated-header-only.txt" run_install eslint@^9 @vitejs/plugin-react )
grep -q '^RC=1$' <<<"$out" && ok "(G) an unparsable ERESOLVE fails the install (no silent pass)" || bad "(G) rc: $(grep '^RC' <<<"$out")"
grep -q '^STUB-NPM .*--legacy-peer-deps' <<<"$out" && bad "(G) --legacy-peer-deps was used" || ok "(G) no --legacy-peer-deps"
grep -qF 'REASON=could not resolve, npm said: ERESOLVE unable to resolve dependency tree' <<<"$out" \
  && ok "(G) the reason quotes npm's first ERESOLVE line" || bad "(G) $(grep '^REASON' <<<"$out")"
[ "$(grep -c '^STUB-NPM' <<<"$out")" -eq 1 ] && ok "(G) npm ran once" || bad "(G) npm ran $(grep -c '^STUB-NPM' <<<"$out") times"

# ── (H) the arborist TypeError crash keeps its --legacy-peer-deps retry ─────────────────────────
CR=$(mktemp); TMPS+=("$CR")
printf "npm error Cannot read properties of null (reading 'edgesOut')\n" > "$CR"
out=$( STUB_FAIL_IF=eslint STUB_FAIL_WITH="$CR" run_install eslint@^9 jsdom )
grep -qE '^STUB-NPM install --save-dev eslint@\^9 jsdom --legacy-peer-deps$' <<<"$out" \
  && ok "(H) the arborist crash is retried with --legacy-peer-deps" || bad "(H) no legacy retry: $(grep STUB-NPM <<<"$out" | tr '\n' '|')"

# ── (I) bounded: at most 3 drops, then NOT wired ─────────────────────────────────────────────────
out=$( STUB_CULPRIT_IS_FIRST=1 run_install a@1 b@1 c@1 d@1 e@1 )
grep -q '^RC=1$' <<<"$out" && ok "(I) a fourth conflict ends the install" || bad "(I) rc: $(grep '^RC' <<<"$out")"
[ "$(grep -c '^STUB-NPM' <<<"$out")" -eq 4 ] && ok "(I) npm ran 4 times (1 + 3 strict retries)" || bad "(I) npm ran $(grep -c '^STUB-NPM' <<<"$out") times"
grep -qF 'REASON=npm still could not resolve after dropping 3 packages' <<<"$out" && ok "(I) the reason says the bound was hit" || bad "(I) $(grep '^REASON' <<<"$out")"

# ── (J) the whole layer: install.sh ts-server --full with a logging stub npm ─────────────────────
# The project declares typescript ~6.0.2 and zod ^4. §7 of the layer writes getff's own
# husky/lint-staged/sort-package-json into package.json BEFORE the install — those are ours and
# must still be installed (they were dropped as «declared» by the first cut of this fix).
J=$(mktemp -d); TMPS+=("$J"); S=$(stub_dir)
( cd "$J" && git init -q && git config user.email t@t && git config user.name t
  printf '{"name":"j","version":"0.0.0","dependencies":{"zod":"^4.1.0"},"devDependencies":{"typescript":"~6.0.2"}}\n' > package.json
  git add -A && git commit -q -m base )
export STUB_LOG="$J.npm.log"; : > "$STUB_LOG"
out=$( cd "$J" && PATH="$S:$PATH" bash "$REPO_ROOT/install.sh" ts-server --full < /dev/null 2>&1 )
dev=$(grep '^STUB-NPM install --save-dev ' "$STUB_LOG" | head -1)
[ -n "$dev" ] && ok "(J) the dev install ran" || bad "(J) no dev install in the npm log: $(tr '\n' '|' < "$STUB_LOG")"
grep -Eq ' typescript@' <<<"$dev" && bad "(J) typescript was re-installed over the project's ~6.0.2" || ok "(J) typescript is not in the install"
grep -Eq ' lint-staged@' <<<"$dev" && ok "(J) getff's own lint-staged is still installed" || bad "(J) lint-staged missing from: $dev"
grep -Eq '^STUB-NPM install( --save)? zod' "$STUB_LOG" && bad "(J) zod was re-installed over the project's ^4.1.0" || ok "(J) zod is not re-installed"
grep -qF 'kept your typescript ~6.0.2' <<<"$out" && ok "(J) the install says it kept typescript ~6.0.2" || bad "(J) no «kept your typescript» line"
[ "$(node -e 'const p=require(process.argv[1]);console.log(p.devDependencies.typescript+" "+p.dependencies.zod)' "$J/package.json")" = "~6.0.2 ^4.1.0" ] \
  && ok "(J) package.json keeps typescript ~6.0.2 and zod ^4.1.0 (the §7 merge adds only absent keys)" || bad "(J) package.json specs changed"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
