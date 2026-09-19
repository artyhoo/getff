#!/usr/bin/env bash
# gh-531-shipped-prettier.test.sh — the shipped surface must be Prettier-clean out-of-box.
#
# Deterministic core (no network): (1) the shipped .prettierignore excludes the GENERATED install
# artifacts (settings.json, the eslint-rules-local barrel) — authored sources are formatted, only
# generated ones are ignored; (2) the stryker packageManager patch is an in-place VALUE replace, not
# a JSON.stringify re-serialize (which would re-expand prettier-collapsed arrays and re-break the
# consumer). Optional end-to-end arm (only when `npx prettier` is reachable): install into a tmp
# consumer and assert `prettier --check .` is green.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

IGN="$REPO_ROOT/packages/core/templates/shared/.prettierignore"

# ── Arm 1: generated install artifacts are ignored (so a consumer's prettier --check . skips them) ──
grep -qx '.claude/settings.json' "$IGN" \
  && ok "shipped .prettierignore excludes generated .claude/settings.json" \
  || bad "shipped .prettierignore missing .claude/settings.json (consumer prettier --check would fail on it)"
grep -qx 'eslint-rules-local/index.mjs' "$IGN" \
  && ok "shipped .prettierignore excludes the generated eslint-rules-local/index.mjs barrel" \
  || bad "shipped .prettierignore missing eslint-rules-local/index.mjs (generated ESM barrel would fail prettier)"
# NEG (load-bearing): authored skill docs must NOT be blanket-ignored (that would be hiding, not fixing)
grep -qE '^\.claude/skills/?\*?\*?$|^\.claude/\*\*?$' "$IGN" \
  && bad "neg: .prettierignore blanket-ignores .claude/skills — authored docs hidden, not formatted" \
  || ok "neg: authored skill docs are NOT blanket-ignored (they are formatted, not hidden)"

# ── Arm 1b (GH #531 reopen — config mismatch): the STATIC template ignores the framework-namespace
# SOURCE a consumer never authors. install.sh ships these formatted to THIS framework's Prettier
# config (printWidth 80, singleQuote, no plugins); a consumer with its OWN .prettierrc rejects the
# same bytes (config mismatch, NOT version skew). Framework CONFIG files are handled CONDITIONALLY
# (Arm 1c), not here — they might be consumer-authored. ──
for p in 'eslint-rules-local/*.ts' 'eslint-rules-local/*.mjs' 'packages/core/hooks/**' 'scripts/audit-r4.ts'; do
  grep -qxF "$p" "$IGN" \
    && ok "shipped .prettierignore excludes vendored source '$p'" \
    || bad "shipped .prettierignore missing vendored source '$p' (consumer prettier --check would fail on it)"
done
# NEG (load-bearing): framework CONFIG files must NOT be statically hard-ignored — a consumer may own
# any of them (copy_safe keeps theirs), and a static line here would hide a consumer-authored config
# (violates the project's "format authored content, don't hide it" rule). They are conditional (Arm 1c).
for p in 'eslint.config.mjs' 'vitest.config.ts' 'tsconfig.json' 'playwright.config.ts' '.dependency-cruiser.cjs' 'stryker.config.json' '.lintstagedrc.json' '.github/workflows/ci.yml' '.github/workflows/workflow-integrity.yml'; do
  grep -qxF "$p" "$IGN" \
    && bad "neg: static .prettierignore hard-ignores config '$p' — would hide a consumer-authored copy (must be conditional)" \
    || ok "neg: config '$p' is NOT statically ignored (handled conditionally — consumer-owned copy stays checked)"
done

# ── Arm 1c (GH #531 reopen): install.sh ignores shipped CONFIGS conditionally — only the ones it
# actually shipped fresh (NOT in SKIPPED), never a copy_safe-kept consumer-authored one.
# S1 migration: ignore_shipped_configs() moved to setup.d/lib.sh; call site moved to setup.d/99-finalize.sh ──
_LIB="$REPO_ROOT/setup.d/lib.sh"
_FINALIZE="$REPO_ROOT/setup.d/99-finalize.sh"
# Prefer lib.sh when present (modular layout), fall back to monolithic install.sh
_ignore_src="${_LIB:-$REPO_ROOT/install.sh}"
[ -f "$_LIB" ] || _ignore_src="$REPO_ROOT/install.sh"
grep -q 'ignore_shipped_configs()' "$_ignore_src" \
  && ok "install.sh defines ignore_shipped_configs (conditional config ignore)" \
  || bad "install.sh missing ignore_shipped_configs (shipped configs never ignored → #531 stays open)"
grep -qF '_prettierignore_in_skipped "$PROJECT_ROOT/$rel" && continue' "$_ignore_src" \
  && ok "ignore_shipped_configs skips consumer-owned configs (in SKIPPED → kept format-checked)" \
  || bad "ignore_shipped_configs does not guard on SKIPPED (would hide consumer-authored configs)"
# Call site: either 99-finalize.sh (modular) or install.sh (monolith)
_call_src="$REPO_ROOT/install.sh"
[ -f "$_FINALIZE" ] && _call_src="$_FINALIZE"
grep -qE '^[[:space:]]*ignore_shipped_configs[[:space:]]*$' "$_call_src" \
  && ok "ignore_shipped_configs is invoked in the install flow (not dead code)" \
  || bad "ignore_shipped_configs defined but never called (dead code → configs not ignored)"

# ── Arm 1d (GH #531 reopen — candidate-list completeness): EVERY framework config install.sh ships
# to a consumer-ownable root or .github/workflows path (except the consumer's own .prettierrc.json)
# MUST appear in ignore_shipped_configs' candidates[]. Otherwise a freshly-shipped config — formatted
# to OUR Prettier style — escapes the conditional ignore and re-breaks #531 (this is exactly how the
# react-next-only playwright.config.ts was missed). Structural guard against future drift.
# S1 migration: candidates[] is now in setup.d/lib.sh; copy_safe calls are spread across setup.d/ layers. ──
# Search candidates in lib.sh (modular) or install.sh (monolith):
_cand_src="$REPO_ROOT/install.sh"
[ -f "$REPO_ROOT/setup.d/lib.sh" ] && _cand_src="$REPO_ROOT/setup.d/lib.sh"
cand_block=$(sed -n '/local candidates=(/,/)/p' "$_cand_src")
# Search copy_safe calls across all layer files (setup.d/) + install.sh fallback:
if [ -d "$REPO_ROOT/setup.d" ]; then
  _search_files="$REPO_ROOT/install.sh $REPO_ROOT/setup.d/"*.sh
else
  _search_files="$REPO_ROOT/install.sh"
fi
# S4 (getff-honest-signals): workflow deliveries moved from copy_safe onto deliver_getff_workflow.
# The verb alternation `(copy_safe|deliver_getff_workflow)` MUST include both verbs, with the
# parentheses — `copy_safe|deliver_getff_workflow [^|]*...` without them would bind the alternation
# wrongly. Bare verb (no env prefix) is correct on BOTH sides here because this gate iterates the
# union (FRESH ∪ REFRESH) — there is no FRESH/REFRESH asymmetry to preserve.
shipped_root=$(grep -ohE '(copy_safe|deliver_getff_workflow) [^|]*"\$PROJECT_ROOT/[^"/]+\.(ts|tsx|mjs|cjs|js|json|yml|yaml)"' \
  $REPO_ROOT/install.sh $REPO_ROOT/setup.d/*.sh 2>/dev/null \
  | sed -E 's#.*"\$PROJECT_ROOT/([^"]+)".*#\1#' | grep -vx '.prettierrc.json' | sort -u)
shipped_wf=$(grep -ohE '(copy_safe|deliver_getff_workflow) [^|]*"\$PROJECT_ROOT/\.github/workflows/[^"]+\.ya?ml"' \
  $REPO_ROOT/install.sh $REPO_ROOT/setup.d/*.sh 2>/dev/null \
  | sed -E 's#.*"\$PROJECT_ROOT/([^"]+)".*#\1#' | sort -u)
# Non-empty guard: without this, the NEXT verb change silently blinds this gate again — exactly as
# S4's copy_safe → deliver_getff_workflow swap did (shipped_wf went 5 → 0 entries, gate stayed 42/0
# green). A derived set with no non-empty guard is a green that can mean "nothing was checked".
[ -n "$shipped_wf" ] || { echo "FATAL: shipped_wf empty — workflow copy verb extraction broke"; exit 1; }
cand_miss=""
for c in $shipped_root $shipped_wf; do
  printf '%s\n' "$cand_block" | grep -qF "\"$c\"" || cand_miss="$cand_miss $c"
done
[ -z "$cand_miss" ] \
  && ok "every shipped consumer-ownable config is in ignore_shipped_configs candidates[] (no drift)" \
  || bad "shipped config(s) MISSING from candidates[] →$cand_miss (fresh-shipped escapes ignore → #531 reopens)"
# NEG (non-vacuity): the guard must actually FLIP when a shipped config is dropped from candidates[].
cand_block_neg=$(printf '%s\n' "$cand_block" | sed 's/"eslint.config.mjs" //')
neg_caught=0
for c in $shipped_root $shipped_wf; do
  printf '%s\n' "$cand_block_neg" | grep -qF "\"$c\"" || neg_caught=1
done
[ "$neg_caught" -eq 1 ] \
  && ok "neg: dropping a config from candidates[] makes the completeness guard fail (non-vacuous)" \
  || bad "neg: completeness guard stayed green with eslint.config.mjs removed → VACUOUS"

# ── Arm 2: stryker packageManager patch preserves formatting (in-place value replace) ──
# S1 migration: patch_stryker_package_manager() is now in setup.d/lib.sh
_stryker_src="$REPO_ROOT/install.sh"
[ -f "$REPO_ROOT/setup.d/lib.sh" ] && _stryker_src="$REPO_ROOT/setup.d/lib.sh"
grep -q 'replace(/("packageManager"' "$_stryker_src" \
  && ok "stryker patch swaps the packageManager VALUE in place (preserves prettier formatting)" \
  || bad "stryker patch is not an in-place value replace (#531 regression risk)"
if grep -A6 'patch_stryker_package_manager' "$_stryker_src" | grep -q 'JSON.stringify(cfg'; then
  bad "neg: stryker patch still uses JSON.stringify (re-expands prettier-collapsed arrays → re-breaks consumer)"
else
  ok "neg: stryker patch no longer JSON.stringify-re-serializes the whole config"
fi

# ── Arm 4 (GH #531 reopen — RC#1): prettier is pinned EXACT on BOTH sides ──
# RC#1: prettier ships formatting changes in minor/patch; a floating version makes a consumer's
# format:check non-deterministic across re-installs. Both the shipped dev-dep and the framework's
# own dogfood script must pin the SAME exact version. `prettier@[0-9.]+` extracts the pin and does
# NOT mis-match `eslint-config-prettier` (no @version on that token).
# (a) install.sh / setup.d/70-deps.sh pins prettier@3.8.3 EXACT.
# S1 migration: CORE_DEVDEPS moved to setup.d/70-deps.sh
_deps_src="$REPO_ROOT/install.sh"
[ -f "$REPO_ROOT/setup.d/70-deps.sh" ] && _deps_src="$REPO_ROOT/setup.d/70-deps.sh"
INSTALL_PIN=$(grep -oE 'prettier@[0-9.]+' "$_deps_src" | head -1)
[ "$INSTALL_PIN" = "prettier@3.8.3" ] \
  && ok "install.sh CORE_DEVDEPS pins prettier EXACT ($INSTALL_PIN)" \
  || bad "install.sh CORE_DEVDEPS does not pin prettier@3.8.3 exact (got: '${INSTALL_PIN:-none}')"
# neg (LOAD-BEARING): a copy where the token is bare `prettier` or caret `prettier@^3` must FLIP
# the exact-pin grep to miss prettier@3.8.3.
TMP_NEG=$(mktemp)
sed 's/prettier@3\.8\.3/prettier/' "$_deps_src" > "$TMP_NEG"
NEG_PIN=$(grep -oE 'prettier@[0-9.]+' "$TMP_NEG" | head -1)
if [ "$NEG_PIN" = "prettier@3.8.3" ]; then
  bad "neg: stripping the pin still matched prettier@3.8.3 → VACUOUS"
else
  ok "neg: un-pinning install.sh (bare prettier) flips the exact-pin grep to miss (non-vacuous)"
fi
rm -f "$TMP_NEG"

# (c) format-shipped.sh uses the PINNED `npx --yes prettier@3.8.3` (positive: the pinned string is
# PRESENT — asserting mere absence of unpinned `npx --yes prettier` would be vacuous, since deleting
# the invocation entirely would satisfy absence).
FMT="$REPO_ROOT/scripts/format-shipped.sh"
[ "$(grep -cE 'npx --yes prettier@3\.8\.3' "$FMT")" -ge 2 ] \
  && ok "format-shipped.sh pins BOTH npx invocations to prettier@3.8.3" \
  || bad "format-shipped.sh does not pin both npx invocations to prettier@3.8.3"
# neg (LOAD-BEARING): a copy with the pin reverted to bare `npx --yes prettier` must FLIP the
# pinned-string grep to miss.
TMP_NEG=$(mktemp)
sed 's/npx --yes prettier@3\.8\.3/npx --yes prettier/' "$FMT" > "$TMP_NEG"
if [ "$(grep -cE 'npx --yes prettier@3\.8\.3' "$TMP_NEG")" -ge 2 ]; then
  bad "neg: un-pinning format-shipped.sh still matched the pinned string → VACUOUS"
else
  ok "neg: reverting format-shipped.sh to bare npx prettier flips the pinned-string grep to miss"
fi
rm -f "$TMP_NEG"

# ── Arm 5 (PART C drift-guard): the TWO pin sites agree on the EXACT version ──
# Project invariants 2 + 4: an executable assertion that install.sh and format-shipped.sh can never
# silently diverge. Extract X from `prettier@X` at both sites; they MUST be equal.
FMT_PIN=$(grep -oE 'prettier@[0-9.]+' "$FMT" | head -1)
if [ -n "$INSTALL_PIN" ] && [ "$INSTALL_PIN" = "$FMT_PIN" ]; then
  ok "drift-guard: install.sh and format-shipped.sh pin the SAME prettier ($INSTALL_PIN == $FMT_PIN)"
else
  bad "drift-guard: pin mismatch — install.sh='${INSTALL_PIN:-}' vs format-shipped.sh='$FMT_PIN'"
fi
# neg (LOAD-BEARING): mutate ONE site's version → the drift-guard equality MUST flip to fail.
TMP_NEG=$(mktemp)
sed 's/npx --yes prettier@3\.8\.3/npx --yes prettier@3.8.0/' "$FMT" > "$TMP_NEG"
NEG_FMT_PIN=$(grep -oE 'prettier@[0-9.]+' "$TMP_NEG" | head -1)
if [ "$INSTALL_PIN" = "$NEG_FMT_PIN" ]; then
  bad "neg: diverging format-shipped.sh to 3.8.0 still matched install.sh → drift-guard VACUOUS"
else
  ok "neg: diverging one site's version (3.8.0) flips the drift-guard equality to fail (non-vacuous)"
fi
rm -f "$TMP_NEG"

# ── Arm 3 (optional, network): a real install must be prettier-clean end-to-end ──
# PIN the consumer-side check to prettier@3.8.3 — without the pin this arm fetches latest and would
# go flaky/false-red the moment npm publishes 3.8.4+ (files are clean under the pinned 3.8.3, the
# version the shipped surface is formatted in). Pinning faithfully models the pinned consumer.
if npx --yes prettier@3.8.3 --version >/dev/null 2>&1; then
  T=$(mktemp -d); printf '{"name":"g531","version":"0.0.0"}\n' > "$T/package.json"
  ( cd "$T" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force ) >/dev/null 2>&1; irc=$?
  # install MUST exit 0 — this --force greenfield path leaves SKIPPED empty, the exact case where an
  # unguarded "${SKIPPED[@]}" expansion aborts install under set -u (bash 3.2). Asserting rc closes
  # the false-green where a crashed install still left files clean under the framework's .prettierrc.
  [ "$irc" -eq 0 ] \
    && ok "greenfield --force install exits 0 (empty SKIPPED handled — no set -u abort)" \
    || bad "greenfield --force install exited $irc (regression — likely empty-array abort under set -u)"
  n=$( ( cd "$T" && npx --yes prettier@3.8.3 --check . 2>&1 ) | grep -cE '^\[warn\]|^\[error\]' )
  [ "$n" -eq 0 ] \
    && ok "end-to-end: fresh ts-server consumer is Prettier-clean (prettier@3.8.3 --check . → 0 issues)" \
    || bad "end-to-end: consumer has $n prettier failures after install (#531 not fully closed)"
  # Arm 3b (GH #1378): the assertion above measures the consumer's DEFAULT run, which honours the
  # .prettierignore managed block — and that block lists every delivered agent + skill doc. A green
  # there means "hidden", not "conformant". Re-measure the same tree with the ignore neutralised, so
  # the delivered post-transform bytes are judged on their own. transform_internal_refs() rewrites
  # refs AFTER the copy; a rewrite inside a table cell re-pads the table, and capability-reuse-
  # auditor.md shipped dirty that way while this arm stayed green. Deterministic companion:
  # tests/install-sh/delivered-prettier-conformance.test.sh (source-side, with the paired negative).
  d=$( ( cd "$T" && npx --yes prettier@3.8.3 --list-different --ignore-path /dev/null \
         '.claude/skills/**/*.md' '.claude/agents/**/*.md' 2>/dev/null ) | grep -c . )
  [ "$d" -eq 0 ] \
    && ok "end-to-end: delivered .claude/skills + .claude/agents are Prettier-CONFORMANT, not merely ignored" \
    || bad "end-to-end: $d delivered skill/agent doc(s) fail prettier under the shipped config (#1378 open)"
else
  echo "  · end-to-end arm skipped (npx prettier@3.8.3 unreachable) — deterministic arms above still hold"
fi

# ── Arm 6 (GH #531 reopen — config mismatch, the BROWNFIELD case Arm 3 structurally cannot reach):
# a consumer with its OWN stricter .prettierrc (printWidth 100) KEEPS that config (copy_safe skips
# it), so the vendored framework files — formatted to the framework's printWidth-80 config — fail
# `prettier --check .` unless ignored. Arm 3 above uses a GREENFIELD consumer (no competing
# .prettierrc) and therefore cannot catch this. This arm models the real reopener (timeliner).
#
# TWO blind spots fixed 2026-08-17 after the .claude/vendor/runtime-bridge/** gap shipped past a
# green arm (7 files flagged in a real brownfield consumer):
#   (a) PROFILE — this arm used to run `install.sh ts-server` with no --profile. Redirected (non-TTY)
#       that resolves to `[profile] core`, and setup.d/55-runtime-bridge-vendor.sh is factory-ONLY
#       (its gate at :65 returns early), so `.claude/vendor/` was never created in the fixture at
#       all. Measured: the pre-fix fixture had no .claude/vendor directory. This was the PRIMARY
#       reason the gap was invisible — dropping the *.md blanket alone would NOT have caught it.
#       `--profile factory` is therefore load-bearing here, not a widening.
#   (b) *.md BLANKET — the fixture .prettierignore used to carry `*.md`, which hid the vendored
#       README.md (1 of the 7). Removed: the shipped .md family is covered by its own managed block
#       (#884, Arm 9), so a real md escape must FAIL this arm rather than be masked by fixture noise.
# `</dev/null` because PROFILE=factory reaches the guided aif-handoff install offer (install.sh:1153).
if npx --yes prettier@3.8.3 --version >/dev/null 2>&1; then
  TB=$(mktemp -d)
  printf '{"name":"g531b","version":"0.0.0"}\n' > "$TB/package.json"
  printf '{"singleQuote":true,"printWidth":100,"trailingComma":"es5"}\n' > "$TB/.prettierrc.json"
  # Pre-existing brownfield .prettierignore (the merge target). Ignore ONLY the test scaffolding the
  # harness minified (root package.json / .prettierrc.json) — everything install.sh ships, .md
  # included, stays under assertion.
  printf '%s\n' '/package.json' '/.prettierrc.json' > "$TB/.prettierignore"
  ( cd "$TB" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --profile factory </dev/null ) >/dev/null 2>&1
  # Guard: the factory-only vendor drop MUST actually be present, else the vendor assertions below
  # are vacuously green exactly as they were before this fix (profile regression sentinel).
  [ -d "$TB/.claude/vendor/runtime-bridge" ] \
    && ok "brownfield fixture installs at PROFILE=factory (the .claude/vendor/ drop is present)" \
    || bad "brownfield fixture has no .claude/vendor/runtime-bridge — profile gate regressed, vendor assertions VACUOUS"
  nb=$( ( cd "$TB" && npx --yes prettier@3.8.3 --check . 2>&1 ) | grep -cE '^\[warn\]|^\[error\]' )
  [ "$nb" -eq 0 ] \
    && ok "brownfield: consumer w/ own printWidth-100 .prettierrc is Prettier-clean ($nb issues — vendored source ignored)" \
    || bad "brownfield: $nb prettier failures under the consumer's own config (#531 config-mismatch NOT closed)"
  # NEG (LOAD-BEARING, non-vacuity, environment-INDEPENDENT): plant grossly-dirty content (a long
  # minified line prettier reformats under ANY config — printWidth 80/100/default) at one path each
  # AIF block covers: packages/core/hooks/** (static SOURCE block), vitest.config.ts (shipped-config
  # block), and .claude/vendor/runtime-bridge/** (the vendor-drop block this fix adds).
  # WITH the blocks all three are skipped; after removing the blocks all three MUST be flagged.
  # This avoids depending on the vendored files' subtle printWidth-80↔100 reflow, which a CI runner's
  # prettier config resolution can mask (observed: CI saw 0 reflow failures where local saw 14).
  dirt='export const z = {a:1,b:2,c:3,d:4,e:5,f:6,g:7,h:8,i:9,j:10,k:11,l:12,m:13,n:14,o:15,p:16,q:17,r:18,s:19,t:20};'
  mkdir -p "$TB/packages/core/hooks" "$TB/.claude/vendor/runtime-bridge/src"
  printf '%s\n' "$dirt" > "$TB/packages/core/hooks/_neg_probe.ts"
  printf '%s\n' "$dirt" > "$TB/vitest.config.ts"
  printf '%s\n' "$dirt" > "$TB/.claude/vendor/runtime-bridge/src/_neg_probe.ts"
  probe_re='_neg_probe\.ts|vitest\.config\.ts'
  flagged_with=$( ( cd "$TB" && npx --yes prettier@3.8.3 --check . 2>&1 ) | grep -cE "$probe_re" )
  [ "$flagged_with" -eq 0 ] \
    && ok "with AIF blocks: planted dirt under packages/core/hooks/, .claude/vendor/runtime-bridge/ + vitest.config.ts is skipped (all three blocks ignore)" \
    || bad "with AIF blocks: planted dirt flagged ($flagged_with) — a managed block is not covering its path"
  printf '%s\n' '/package.json' '/.prettierrc.json' > "$TB/.prettierignore"   # remove ALL AIF blocks
  flagged_without=$( ( cd "$TB" && npx --yes prettier@3.8.3 --check . 2>&1 ) | grep -cE "$probe_re" )
  [ "$flagged_without" -ge 3 ] \
    && ok "neg: removing the AIF blocks flags all three planted-dirty files ($flagged_without — ignore is non-vacuous)" \
    || bad "neg: planted dirt still not flagged after removing blocks ($flagged_without/3) → ignore VACUOUS"
else
  echo "  · brownfield arm skipped (npx prettier@3.8.3 unreachable)"
fi

# ── Arm 7 (GH #531 reopen — the consumer-OWNED config case the cold-review flagged): a consumer that
# already has its OWN eslint.config.mjs keeps it (copy_safe skips), so install must NOT ignore it —
# hiding a consumer-authored config would be over-reach. Proves ignore_shipped_configs is CONDITIONAL
# (only ignores what it shipped fresh), not a blanket static ignore. ──
if npx --yes prettier@3.8.3 --version >/dev/null 2>&1; then
  TC=$(mktemp -d)
  printf '{"name":"g531c","version":"0.0.0"}\n' > "$TC/package.json"
  printf '{"singleQuote":true,"printWidth":100}\n' > "$TC/.prettierrc.json"
  printf '%s\n' '*.md' '/package.json' '/.prettierrc.json' > "$TC/.prettierignore"
  # consumer's OWN eslint.config.mjs, deliberately NOT prettier-clean (one long minified line >100c)
  printf 'export default [{ rules: { "no-a": "error", "no-b": "error", "no-c": "error", "no-d": "error", "no-e": "error", "no-f": "error" } }];\n' > "$TC/eslint.config.mjs"
  ( cd "$TC" && git init -q && bash "$REPO_ROOT/install.sh" ts-server ) >/dev/null 2>&1
  # (1) consumer's own config kept (copy_safe skipped it — non-force)
  grep -q '"no-a"' "$TC/eslint.config.mjs" \
    && ok "consumer-owned eslint.config.mjs kept (copy_safe skipped without --force)" \
    || bad "consumer-owned eslint.config.mjs was overwritten (copy_safe must skip existing without --force)"
  # (2) it is NOT in .prettierignore → stays format-checked, not hidden
  grep -qxF 'eslint.config.mjs' "$TC/.prettierignore" \
    && bad "consumer-owned eslint.config.mjs was ignored — hides the consumer's authored config (over-reach)" \
    || ok "consumer-owned eslint.config.mjs is NOT ignored (stays format-checked — no over-hide)"
  # (3) prettier --check still SEES the dirty consumer config (genuinely checked, not vacuously absent).
  # Capture into a var first: `prettier --check` exits 1 when it finds issues, and piping it straight
  # into the conditional would trip `set -o pipefail` (the pipeline inherits prettier's exit 1).
  out7=$( cd "$TC" && npx --yes prettier@3.8.3 --check . 2>&1 )
  printf '%s\n' "$out7" | grep -q 'eslint.config.mjs' \
    && ok "prettier --check still flags the consumer's own dirty eslint.config.mjs (kept under check)" \
    || bad "prettier --check does NOT see the consumer's eslint.config.mjs (it was hidden after all)"
else
  echo "  · consumer-owned-config arm skipped (npx prettier@3.8.3 unreachable)"
fi

# ── Arm 8 (GH #884 — .ai-factory doc family, config-mismatch via EMBEDDED CODE-FENCE): a
# react-native install ships .ai-factory/ARCHITECTURE.react-native.md, which embeds a JS code
# fence. Prettier reflows FENCED CODE by printWidth (markdown PROSE/TABLES do not — proseWrap
# defaults to "preserve"), so a consumer's own printWidth:100 .prettierrc reflows the fence and
# `prettier --check .` goes RED. Arm 6 above structurally cannot catch this: it blanket-excludes
# `*.md` from its own assertion (isolating the non-md vendored surface only) AND installs
# ts-server, which never ships ARCHITECTURE.react-native.md at all (preset-specific file). This
# arm is the md-family counterpart, modeling the actual #884 reopener (timeliner, react-native
# preset). ──
if npx --yes prettier@3.8.3 --version >/dev/null 2>&1; then
  TRN=$(mktemp -d)
  printf '{"name":"g884","version":"0.0.0"}\n' > "$TRN/package.json"
  printf '{"singleQuote":true,"printWidth":100,"trailingComma":"es5"}\n' > "$TRN/.prettierrc.json"
  # NO --force: copy_safe must take the skip-if-exists path so the consumer's pre-existing
  # .prettierrc.json (printWidth:100) survives install — --force would overwrite it with the
  # framework's own singleQuote-only config, silently defeating this arm's whole premise.
  ( cd "$TRN" && git init -q && bash "$REPO_ROOT/install.sh" react-native </dev/null ) >/dev/null 2>&1
  RNMD="$TRN/.ai-factory/ARCHITECTURE.react-native.md"
  [ -f "$RNMD" ] \
    && ok "#884 pos: react-native install ships .ai-factory/ARCHITECTURE.react-native.md" \
    || bad "#884 pos: .ai-factory/ARCHITECTURE.react-native.md not shipped (test setup broken)"

  # SOFT sanity, NOT load-bearing: the real shipped content is clean under the consumer's config
  # today. TWO separate CI runs on this PR showed prettier's markdown-embedded-code-fence reflow
  # is unreliable on the runner used here — not just the subtle printWidth 80-vs-100 threshold
  # Arm 6's own comment above already flags, but even a GROSSLY-minified planted fence (the exact
  # technique Arm 6 uses successfully on a plain .ts FILE) failed to reflow at all when embedded
  # inside a markdown fence on this runner, with AND without the ignore entry. Root cause not
  # pinned down (network/npx-cache/markdown-parser difference are candidates, none confirmed) —
  # not worth the dig when Arm 9 below already gives a fully reliable, environment-independent
  # non-vacuity proof for the SAME claim via pure text grep (no prettier invocation at all). Do
  # NOT re-add a prettier-behavioral neg here; extend Arm 9's population set instead if more
  # coverage is needed.
  n884=$( ( cd "$TRN" && npx --yes prettier@3.8.3 --check .ai-factory/ARCHITECTURE.react-native.md 2>&1 ) | grep -c '\[warn\]' )
  [ "$n884" -eq 0 ] \
    && ok "#884: ARCHITECTURE.react-native.md is Prettier-clean under consumer's printWidth-100 config" \
    || bad "#884: ARCHITECTURE.react-native.md is NOT clean under consumer's printWidth-100 config (#884 not closed)"
else
  echo "  · #884 arm skipped (npx prettier@3.8.3 unreachable)"
fi

# ── Arm 9 (GH #884 — population-completeness guard, mirrors Arm 1d for the .ai-factory doc family):
# EVERY framework-shipped .ai-factory/**/*.md doc (a copy_safe target under $PROJECT_ROOT/.ai-
# factory/) MUST appear in the static managed .prettierignore block — else a FUTURE preset's
# ARCHITECTURE/DESCRIPTION/rules doc silently escapes the ignore the same way
# ARCHITECTURE.react-native.md did (Arm 8), reopening #884 one preset at a time. Excludes the
# already-separately-covered RULES.*.md family (generated tables, own comment block, Arm F15) and
# skill-context/*/SKILL.md docs (not yet observed to embed printWidth-sensitive code fences —
# tracked open, not blanket-ignored, per the "format authored content, don't hide it" default). ──
_ign_884="$REPO_ROOT/packages/core/templates/shared/.prettierignore"
shipped_aif_md=$(grep -ohE 'copy_safe "\$PKG_ROOT/[^"]+" "\$PROJECT_ROOT/\.ai-factory/[^"]+\.md"' "$REPO_ROOT"/setup.d/*.sh 2>/dev/null \
  | sed -E 's#.*"\$PROJECT_ROOT/(\.ai-factory/[^"]+)".*#\1#' \
  | grep -vE '^\.ai-factory/RULES(\.[a-z-]+)?\.md$|^\.ai-factory/skill-context/' \
  | sort -u)
[ -n "$shipped_aif_md" ] \
  && ok "#884 population: discovered $(printf '%s\n' "$shipped_aif_md" | wc -l | tr -d ' ') shipped .ai-factory/*.md doc(s) to check" \
  || bad "#884 population: discovery found ZERO .ai-factory/*.md copy_safe targets (grep pattern broken?)"
aif_miss=""
for f in $shipped_aif_md; do
  grep -qxF "$f" "$_ign_884" || aif_miss="$aif_miss $f"
done
[ -z "$aif_miss" ] \
  && ok "#884 population: every shipped .ai-factory/*.md doc is in the static .prettierignore managed block" \
  || bad "#884 population: doc(s) MISSING from .prettierignore →$aif_miss (config-mismatch escapes ignore)"

# neg (LOAD-BEARING, non-vacuity): the completeness guard must actually FLIP when a real entry is
# dropped from the managed block — proves it isn't vacuously green from a broken discovery regex.
_ign_884_neg=$(grep -vxF '.ai-factory/DESCRIPTION.template.md' "$_ign_884")
neg884_caught=0
for f in $shipped_aif_md; do
  printf '%s\n' "$_ign_884_neg" | grep -qxF "$f" || neg884_caught=1
done
[ "$neg884_caught" -eq 1 ] \
  && ok "#884 neg: dropping DESCRIPTION.template.md from the block flips the population guard to fail (non-vacuous)" \
  || bad "#884 neg: dropping an entry did not flip the population guard → VACUOUS"

# ── Arm 10 (vendor-drop population-completeness guard, mirrors Arm 1d/Arm 9 for `.claude/vendor/`):
# EVERY framework vendor drop — a `$PROJECT_ROOT/.claude/vendor/<name>` destination any setup.d
# layer copies into — MUST have a covering `<path>/**` line in the static managed .prettierignore
# block. Without this, a FUTURE vendor drop escapes the ignore exactly as runtime-bridge did:
# shipped formatted to the framework's printWidth-80 config, RED under a consumer's own
# .prettierrc, zero consumer edit. Arm 6 catches it only end-to-end (needs npx + a full install);
# this arm is the deterministic, network-free structural guard. ──
_ign_v="$REPO_ROOT/packages/core/templates/shared/.prettierignore"
# Discovery is the DESTINATION path, not the source dir: layer 55 does a wholesale `cp -r` into
# VENDOR_DST rather than per-file copy_safe, so the Arm 9 copy_safe-target regex cannot see it.
shipped_vendor=$(grep -ohE '\$PROJECT_ROOT/\.claude/vendor/[A-Za-z0-9._-]+' \
  "$REPO_ROOT"/setup.d/*.sh "$REPO_ROOT/install.sh" 2>/dev/null \
  | sed -E 's#.*/\.claude/vendor/#.claude/vendor/#' | sort -u)
# Non-empty guard (the Arm 1d shipped_wf lesson): a derived set with no non-empty guard turns a
# broken/renamed destination variable into a silent green meaning "nothing was checked".
[ -n "$shipped_vendor" ] || { echo "FATAL: shipped_vendor empty — vendor-destination extraction broke"; exit 1; }
ok "vendor population: discovered $(printf '%s\n' "$shipped_vendor" | wc -l | tr -d ' ') vendor drop(s) to check"
vendor_miss=""
for v in $shipped_vendor; do
  grep -qxF "$v/**" "$_ign_v" || vendor_miss="$vendor_miss $v"
done
[ -z "$vendor_miss" ] \
  && ok "vendor population: every shipped .claude/vendor/ drop has a '/**' line in the managed block" \
  || bad "vendor population: drop(s) MISSING from .prettierignore →$vendor_miss (config-mismatch escapes ignore)"
# neg (LOAD-BEARING, non-vacuity): dropping the real entry from the block MUST flip the guard.
_ign_v_neg=$(grep -vxF '.claude/vendor/runtime-bridge/**' "$_ign_v")
negv_caught=0
for v in $shipped_vendor; do
  printf '%s\n' "$_ign_v_neg" | grep -qxF "$v/**" || negv_caught=1
done
[ "$negv_caught" -eq 1 ] \
  && ok "vendor neg: dropping runtime-bridge from the block flips the population guard to fail (non-vacuous)" \
  || bad "vendor neg: dropping an entry did not flip the population guard → VACUOUS"

# ── Arm 11 (the discipline distinction PR #1413 made explicit): ignoring a VENDORED file the
# consumer never authors is the correct #531 remedy; ignoring one to HIDE a genuine
# non-conformance is not. So every ignored vendor drop must ALSO be format-checked at its
# framework SOURCE — i.e. appear in scripts/format-shipped.sh's PATHSPECS. This is the invariant
# every pre-existing entry of the "Vendored framework SOURCE" block already satisfies
# (packages/core/hooks/** and packages/core/eslint-rules/** are PATHSPECS entries; shipped
# scripts/audit-r4.ts comes from packages/core/probes/). runtime-bridge was the lone violator. ──
_fmt_v="$REPO_ROOT/scripts/format-shipped.sh"
grep -qE '^[[:space:]]*packages/runtime-bridge/vendor[[:space:]]*$' "$_fmt_v" \
  && ok "vendor source is format-checked at the framework (packages/runtime-bridge/vendor in PATHSPECS — ignored, not hidden)" \
  || bad "packages/runtime-bridge/vendor absent from format-shipped.sh PATHSPECS — the ignore would HIDE unformatted shipped bytes"

# ── Arm 12 (#1597 ledger C14 follow-up): Arm 11 proves the vendor drop is FORMAT-checked. It
# says nothing about whether the drop is still the same CODE as the source it was copied from.
# packages/runtime-bridge/vendor/src is `prettier(packages/runtime-bridge/src)` by construction,
# and nothing enforced that: an edit to src/ never re-vendored left every consumer running older
# logic with all gates green (the parity had to be checked BY HAND while fixing ledger A6-3 /
# A5-3 / K-2 / K-3 / A5-6). format-shipped.sh Phase 3 owns it now; these arms prove the check is
# real and, critically, that it does NOT fire on the formatting difference that is by design. ──
if npx --yes prettier@3.8.3 --version >/dev/null 2>&1; then
  _p3_src="$REPO_ROOT/packages/runtime-bridge/src/idempotency.ts"
  _p3_bak=$(mktemp)
  cp "$_p3_src" "$_p3_bak"

  # POS: clean tree passes (and the phase is actually reached — see the vacuity guard below).
  ( cd "$REPO_ROOT" && bash scripts/format-shipped.sh --check ) >/dev/null 2>&1     && ok "vendor parity: the tracked tree is in parity (vendor == prettier(src))"     || bad "vendor parity: the tracked tree FAILS its own parity check — vendor drifted from src"

  # NEG (load-bearing): a real CONTENT change in src with no re-vendor must go RED. Without this
  # the POS arm above is satisfied by a check that never looks at anything.
  perl -pi -e "s|'/tmp/runtime-bridge-dedup\.jsonl'|'/tmp/_neg_probe_drift.jsonl'|" "$_p3_src"
  _p3_out=$( cd "$REPO_ROOT" && bash scripts/format-shipped.sh --check 2>&1 )
  printf '%s' "$_p3_out" | grep -q 'DRIFT .*vendor/src/idempotency\.ts' \
    && ok "vendor parity neg: a content edit to src/ with no re-vendor is caught (non-vacuous)" \
    || bad "vendor parity neg: planted src drift NOT caught → the parity check is VACUOUS"
  cp "$_p3_bak" "$_p3_src"

  # NEG-2 (the false-positive arm, equally load-bearing): src is deliberately NOT prettier-formatted,
  # so a check that compared raw bytes would flag all 19 files forever and be turned off within a day.
  # Reflowing a signature in src changes no code and MUST stay green.
  perl -0pi -e "s|export function resolveDedupPath\(env: NodeJS\.ProcessEnv = process\.env\): string \{|export function resolveDedupPath(\n  env: NodeJS.ProcessEnv = process.env,\n): string {|" "$_p3_src"
  if ! cmp -s "$_p3_bak" "$_p3_src"; then
    ( cd "$REPO_ROOT" && bash scripts/format-shipped.sh --check ) >/dev/null 2>&1 \
      && ok "vendor parity: a FORMATTING-only reflow of src stays green (no false positive)" \
      || bad "vendor parity: reflowing src went RED — the check compares bytes, not content; unusable"
  else
    bad "vendor parity: the reflow probe did not modify src — arm is VACUOUS, update the pattern"
  fi
  cp "$_p3_bak" "$_p3_src"
  rm -f "$_p3_bak"

  # The vendor drop's OTHER pair: the bash hook twin, byte-identical (no prettier in the loop).
  # It was the one remaining ungated copy of this class (#1597 ledger addendum D-5) — the backward
  # sweep for the parity rule found it, so Phase 3 closes it in the same pass.
  _hv="$REPO_ROOT/packages/runtime-bridge/vendor/hooks/runtime-bridge-dispatch.sh"
  _hv_bak=$(mktemp)
  cp "$_hv" "$_hv_bak"
  printf '\n# _neg_probe twin drift\n' >> "$_hv"
  _hv_out=$( cd "$REPO_ROOT" && bash scripts/format-shipped.sh --check 2>&1 )
  printf '%s' "$_hv_out" | grep -q 'dispatch hook has drifted' \
    && ok "hook twin neg: vendor/hooks ↔ .claude/hooks drift is caught (D-5 gap closed, non-vacuous)" \
    || bad "hook twin neg: planted twin drift NOT caught → the twin is still ungated"
  # Change-scoped reality: a commit staging ONLY the .claude/hooks half must still wake the phase.
  _hv_scoped=$( cd "$REPO_ROOT" && bash scripts/format-shipped.sh --check .claude/hooks/runtime-bridge-dispatch.sh 2>&1 )
  printf '%s' "$_hv_scoped" | grep -q 'dispatch hook has drifted' \
    && ok "hook twin: a filter naming only the .claude/hooks half still runs the parity phase" \
    || bad "hook twin: filtering to the .claude/hooks half skipped the phase — pre-commit blind spot"
  cp "$_hv_bak" "$_hv"
  rm -f "$_hv_bak"
  cmp -s "$_hv" "$REPO_ROOT/.claude/hooks/runtime-bridge-dispatch.sh" \
    && ok "hook twin: restored — the tracked pair is byte-identical" \
    || bad "hook twin: the probe left the pair drifted (restore failed)"

  # Vacuity sentinel: every arm above is meaningless if Phase 3 was never wired in.
  grep -q 'Phase 3: vendored-copy' "$_fmt_v" \
    && ok "vendor parity: Phase 3 is present in format-shipped.sh (arms above are non-vacuous)" \
    || bad "format-shipped.sh has no Phase 3 vendor-parity block — the arms above prove nothing"
else
  echo "  ⊝ SKIP Arm 12: prettier@3.8.3 unavailable (offline)"
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
