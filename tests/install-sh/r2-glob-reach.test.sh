#!/usr/bin/env bash
# stays-local: its #516 arm catches BSD awk's "newline in string" crash on a multi-line awk -v, which gawk on Linux never shows
# GH #507 (reopen) — R2 actually REACHES a brownfield / monorepo consumer.
#
# #511 wired the check-rule-globs.sh gate, but a live re-verify (timeliner, flat pnpm-monorepo)
# showed the gate fires loudly yet does not protect the consumer. Three gaps, each a silent-
# inertness failure on a real layout:
#   #1 CI-orphan — the gate is wired only into the SHIPPED ci.yml; copy_safe skips a pre-existing
#      ci.yml (brownfield) → the gate runs in NO CI job. FIX: post-install WARN when no workflow
#      under .github/workflows references the gate (non-destructive; consumer owns their CI).
#   #2 false-green vs per-package eslint configs — the gate found the WHOLE tree, ignoring ESLint
#      nearest-config resolution, so planting a boundary file under a shadowing package faked a
#      PASS while R2 stayed dead there. FIX: prune shadowed package subtrees from the root probe +
#      classify each shadowed package's own config (wired→silent / uncertain→WARN / dead→FAIL).
#   #3 globals — the shipped root eslint.config.mjs imports `globals`, absent from the installed
#      dev-deps → ERR_MODULE_NOT_FOUND on a strict (pnpm) install. FIX: add to CORE_DEVDEPS.
#
# PAIRED-NEGATIVE: every behavioral arm has a neg that flips the verdict (so a pass is non-vacuous).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
# shellcheck source=lib/manual-step.sh
. "$REPO_ROOT/tests/install-sh/lib/manual-step.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

install_into() { # $1 dir, $2 stack — clean --force install
  printf '{"name":"t507","version":"0.0.0"}\n' > "$1/package.json"
  ( cd "$1" && git init -q && bash "$REPO_ROOT/install.sh" "$2" --force ) >/dev/null 2>&1
}
# Run the SHIPPED gate (the installed copy, so we test what consumers get). Echoes output; rc via $?.
gate() { ( cd "$1" && ESLINT_CONFIG="$1/eslint.config.mjs" bash "$1/scripts/check-rule-globs.sh" ) 2>&1; }

# ══════════════════════════════════════════════════════════════════════════════
# #2 — false-green vs per-package eslint configs (the SHIPPED gate behaviour)
# ══════════════════════════════════════════════════════════════════════════════
# POS: a shadowing package (own config, no R2) with a PLANTED boundary file no longer fakes green.
T=$(mktemp -d); install_into "$T" ts-server
mkdir -p "$T/apps/api/src/routes"; echo 'export const x=1;' > "$T/apps/api/src/routes/u.ts"
printf 'export default [];\n' > "$T/apps/api/eslint.config.mjs"
OUT=$(gate "$T"); RC=$?
[ "$RC" = "1" ] \
  && ok "#2 POS: planted boundary file under a dead-config package → gate FAILS (false-green removed)" \
  || bad "#2 POS: gate exited $RC (should be 1 — planted file under a shadowing package still fakes a pass)"
grep -q "apps/api: has boundary files but its own ESLint config does NOT wire R2" <<<"$OUT" \
  && ok "#2 POS: names the dead-config package as silently inert" \
  || bad "#2 POS: no per-package inertness message (saw: $(printf '%s' "$OUT" | tail -2 | tr '\n' '|'))"
grep -q "R2 no-unsafe-zod-parse (RULE_GLOBS.boundary): matches ≥1 source file" <<<"$OUT" \
  && bad "#2 POS: still prints the false ✓ for R2 (the green-checkmark lie that the planted file caused)" \
  || ok "#2 POS: no false ✓ for R2 (a shadowed file no longer counts toward root coverage)"

# NEG-a (load-bearing): a package that RE-EXPORTS the root config → uncertain → WARN, never FAIL.
T2=$(mktemp -d); install_into "$T2" ts-server
mkdir -p "$T2/apps/api/src/routes"; echo 'export const x=1;' > "$T2/apps/api/src/routes/u.ts"
printf "import root from '../../eslint.config.mjs';\nexport default root;\n" > "$T2/apps/api/eslint.config.mjs"
OUT2=$(gate "$T2"); RC2=$?
[ "$RC2" = "0" ] \
  && ok "#2 NEG-a: re-export-of-root package does NOT fail the gate (no false-FAIL on a correct monorepo)" \
  || bad "#2 NEG-a: gate exited $RC2 on a re-export package (false-FAIL would break a correctly-wired monorepo)"
grep -q "⚠ apps/api" <<<"$OUT2" \
  && ok "#2 NEG-a: re-export package gets a WARN (unverifiable coverage surfaced, not failed)" \
  || bad "#2 NEG-a: no WARN for the re-export package"

# NEG-b (load-bearing): a package whose own config WIRES R2 → silent (no warn, no fail).
T3=$(mktemp -d); install_into "$T3" ts-server
mkdir -p "$T3/apps/api/src/routes"; echo 'export const x=1;' > "$T3/apps/api/src/routes/u.ts"
printf "import r from './r.ts';\nexport default [{plugins:{'rules-as-tests':r},rules:{'rules-as-tests/no-unsafe-zod-parse':'error'}}];\n" > "$T3/apps/api/eslint.config.mjs"
OUT3=$(gate "$T3"); RC3=$?
if [ "$RC3" = "0" ] && ! grep -q "apps/api" <<<"$OUT3"; then
  ok "#2 NEG-b: a package that wires R2 is silent (no spurious warn/fail)"
else
  bad "#2 NEG-b: rc=$RC3 / unexpected apps/api mention for a package that wires R2"
fi

# NEG-c (load-bearing): a monorepo with NO per-package config → prune must NOT fire (file still counts).
T4=$(mktemp -d); install_into "$T4" ts-server
mkdir -p "$T4/apps/api/src/routes"; echo 'export const x=1;' > "$T4/apps/api/src/routes/u.ts"
OUT4=$(gate "$T4"); RC4=$?
[ "$RC4" = "0" ] \
  && ok "#2 NEG-c: monorepo with NO per-package config → root R2 reaches apps/api (prune only fires on real shadows)" \
  || bad "#2 NEG-c: gate exited $RC4 — prune over-fired on a repo with no per-package configs"

# #1 — CI-orphan WARN completeness (brownfield kept ci.yml → gates unwired in CI) — #521
# ══════════════════════════════════════════════════════════════════════════════
# NO --force: the brownfield scenario is the default skip-if-exists path that LEAVES the consumer's
# own ci.yml in place. </dev/null so the #483 dev-dep [y/N] gate reads empty stdin → defaults "no".
seed_install() { # $1 dir, $2 ci.yml body ("" = greenfield), $3 logfile; returns install rc
  printf '{"name":"t507","version":"0.0.0"}\n' > "$1/package.json"
  if [ -n "$2" ]; then mkdir -p "$1/.github/workflows"; printf '%s\n' "$2" > "$1/.github/workflows/ci.yml"; fi
  ( cd "$1" && git init -q && bash "$REPO_ROOT/install.sh" ts-server </dev/null ) > "$3" 2>&1
}
# Brownfield CI wiring NONE of the 4 gates.
BROWNFIELD_CI=$'name: CI\njobs:\n  build:\n    steps:\n      - run: pnpm turbo run lint typecheck test'
# Brownfield CI wiring ONLY the glob gate (the partial case that proves per-gate accuracy).
PARTIAL_CI=$'name: CI\njobs:\n  build:\n    steps:\n      - run: bash scripts/check-rule-globs.sh\n      - run: pnpm turbo run lint typecheck test'

# ── POS-all: none wired → WARN names all 4 (colon forms are WARN-exclusive; install copy-echoes use
#    hyphenated file names) + the check:lintstaged NOT-wired line names its step; rc=0; consumer ci.yml intact.
P=$(mktemp -d); LOG=$(mktemp); seed_install "$P" "$BROWNFIELD_CI" "$LOG"; RCP=$?
[ "$RCP" = "0" ] && ok "#1 POS-all: install exited 0 (CI-orphan warn never aborts)" || bad "#1 POS-all: install exited $RCP"
grep -q "CI-orphan" "$LOG" \
  && ok "#1 POS-all: CI-orphan WARN fired on brownfield" \
  || bad "#1 POS-all: no CI-orphan WARN (saw: $(grep -i 'workflow\|validate' "$LOG" | head -1))"
for _g in "check:globs" "arch:check" "audit:docs" "check:lintstaged"; do
  grep -q "$_g" "$LOG" \
    && ok "#1 POS-all: WARN names $_g" \
    || bad "#1 POS-all: WARN omits $_g (under-reporting — the #521 bug)"
done
grep -q "run: bash scripts/check-lintstaged-resolves.sh" <<<"$(grep -E '^[[:space:]]*- CI gate check:lintstaged' "$LOG")" \
  && ok "#1 POS-all: the check:lintstaged NOT-wired line names its step" \
  || bad "#1 POS-all: no NOT-wired check:lintstaged line naming its step"
# #521 follow-up: when check:globs is missing, the WARN must explain that a present `lint` step
# does NOT enforce R2/R7/R8 on packages with their own eslint config (nearest-config shadow).
grep -q "nearest-config resolution shadows the root AIF rules" "$LOG" \
  && ok "#1 POS-all: WARN explains lint≠R2/R7/R8 on shadowed packages (check:globs shadowing note)" \
  || bad "#1 POS-all: WARN missing the check:globs shadowing note (lint≠enforcement insight)"
grep -q "turbo run lint" "$P/.github/workflows/ci.yml" \
  && ok "#1 POS-all: pre-existing ci.yml left intact (warn is non-destructive)" \
  || bad "#1 POS-all: install mutated the consumer's ci.yml (must be advisory only)"

# ── POS-partial (load-bearing #521 proof): only globs wired → WARN names the OTHER 3, NOT check:globs.
PP=$(mktemp -d); LOGPP=$(mktemp); seed_install "$PP" "$PARTIAL_CI" "$LOGPP"; RCPP=$?
[ "$RCPP" = "0" ] && ok "#1 POS-partial: install exited 0" || bad "#1 POS-partial: install exited $RCPP"
for _g in "arch:check" "audit:docs" "check:lintstaged"; do
  grep -q "$_g" "$LOGPP" \
    && ok "#1 POS-partial: WARN names still-missing $_g" \
    || bad "#1 POS-partial: WARN omits $_g (per-gate detection failed)"
done
# The already-wired glob gate must NOT be named — proves per-gate accuracy, not a blanket warn.
# "check:globs" (colon) is WARN-exclusive; the install copy-echo says "check-rule-globs.sh" (hyphen).
grep -q "check:globs" "$LOGPP" \
  && bad "#1 POS-partial: WARN names the already-wired check:globs (false positive — not per-gate)" \
  || ok "#1 POS-partial: WARN omits the already-wired check:globs (per-gate accuracy)"
# The shadowing note is conditional on check:globs being MISSING — here it is wired, so no note.
grep -q "nearest-config resolution shadows the root AIF rules" "$LOGPP" \
  && bad "#1 POS-partial: shadowing note printed though check:globs is already wired (should be conditional)" \
  || ok "#1 POS-partial: no shadowing note when check:globs is already wired (note is conditional)"

# ── NEG (load-bearing): greenfield → shipped ci.yml wires ALL 4 → no warn.
N=$(mktemp -d); LOGN=$(mktemp); seed_install "$N" "" "$LOGN"; RCN=$?
[ "$RCN" = "0" ] && ok "#1 NEG: greenfield install exited 0" || bad "#1 NEG: greenfield install exited $RCN"
for _s in "check-rule-globs.sh" "arch:check" "audit-ai-docs.sh" "check-lintstaged-resolves.sh"; do
  grep -q "$_s" "$N/.github/workflows/ci.yml" \
    && ok "#1 NEG: greenfield shipped ci.yml wires $_s" \
    || bad "#1 NEG: greenfield ci.yml missing $_s"
done
grep -q "CI-orphan" "$LOGN" \
  && bad "#1 NEG: CI-orphan warn fired on greenfield (false positive — all gates wired)" \
  || ok "#1 NEG: no CI-orphan warn on greenfield (all gates wired by the shipped ci.yml)"

# ══════════════════════════════════════════════════════════════════════════════
# #3 — globals dev-dep (root eslint imports `globals`)
# ══════════════════════════════════════════════════════════════════════════════
# A non-interactive install defaults the dep-install to No and prints the manual DEVDEPS block;
# DEVDEPS is the single source for both the install command and that echo → globals must appear.
G=$(mktemp -d); LOGG=$(mktemp)
printf '{"name":"t507g","version":"0.0.0"}\n' > "$G/package.json"
( cd "$G" && git init -q && bash "$REPO_ROOT/install.sh" ts-server </dev/null ) > "$LOGG" 2>&1
grep -qw "globals" "$LOGG" \
  && ok "#3: installed dev-dep set includes 'globals' (the eslint.config.mjs import is satisfied)" \
  || bad "#3: 'globals' missing from the installed dev-dep set → ERR_MODULE_NOT_FOUND on strict installs"
# NEG (load-bearing): the predicate is word-bounded — it does not match a list lacking globals.
if grep -qw "globals" <<<"eslint typescript-eslint prettier vitest"; then
  bad "#3 NEG: predicate matched a dep list WITHOUT globals → vacuous"
else
  ok "#3 NEG: predicate rejects a dep list lacking globals (non-vacuous)"
fi

# ══════════════════════════════════════════════════════════════════════════════
# #4 — check:lintstaged wired in BOTH shipped CI templates (#521 Change 1)
# ══════════════════════════════════════════════════════════════════════════════
# `validate` runs 4 gates; the shipped greenfield ci.yml must wire the same 4 so
# {WARN-named} = {greenfield CI} = {validate}. Direct template grep — deterministic.
for _tpl in \
  "$REPO_ROOT/templates/ts-server/github-actions-ci.yml" \
  "$REPO_ROOT/packages/preset-next-15-canonical/templates/github-actions-ci-ui.yml"; do
  grep -q "check-lintstaged-resolves.sh" "$_tpl" \
    && ok "#4: ${_tpl#"$REPO_ROOT"/} wires check:lintstaged" \
    || bad "#4: ${_tpl#"$REPO_ROOT"/} missing check-lintstaged-resolves.sh (validate≠CI drift)"
done
# NEG (non-vacuous): the predicate rejects a body lacking the step.
grep -q "check-lintstaged-resolves.sh" <<<"- run: bash scripts/check-rule-globs.sh" \
  && bad "#4 NEG: predicate matched a body without check:lintstaged → vacuous" \
  || ok "#4 NEG: predicate rejects a template lacking check:lintstaged (non-vacuous)"
# #516 — BSD/macOS awk portability + re-export classifier gap (regressions in #513)
# ══════════════════════════════════════════════════════════════════════════════
# §1 BSD/macOS awk crash: filter_unshadowed passed a MULTI-LINE $SHADOWS via `awk -v`, which
# BSD/macOS awk rejects ("awk: newline in string"). With ≥2 shadowed packages $SHADOWS is multi-
# line, so the filter crashed and emitted NOTHING → the root probe was fed an empty stream → it
# went blind → false-RED on a repo whose root R2 genuinely reaches a root-governed boundary file.
# Latent on gawk/Linux CI (only the BSD/macOS default awk crashes) — this arm catches it on macOS.

# §1 POS (behavioral): ≥2 shadow packages (→ multi-line $SHADOWS) + a ROOT-governed boundary file.
# Gate must PASS — root R2 reaches ./src/routes/x.ts. Pre-fix on BSD awk this FALSE-REDs (rc=1).
T5=$(mktemp -d); install_into "$T5" ts-server
mkdir -p "$T5/src/routes"; echo 'export const x=1;' > "$T5/src/routes/x.ts"   # root-governed boundary file
mkdir -p "$T5/pkg-a" "$T5/pkg-b"                                              # ≥2 shadows → $SHADOWS is multi-line
printf 'export default [];\n' > "$T5/pkg-a/eslint.config.mjs"
printf 'export default [];\n' > "$T5/pkg-b/eslint.config.mjs"
OUT5=$(gate "$T5"); RC5=$?
[ "$RC5" = "0" ] \
  && ok "#516 §1 POS: ≥2 shadow pkgs + root boundary file → gate PASSES (no false-RED from multi-line SHADOWS)" \
  || bad "#516 §1 POS: gate exited $RC5 — root probe went blind on multi-line SHADOWS (BSD-awk -v newline crash)"
grep -q "newline in string" <<<"$OUT5" \
  && bad "#516 §1 POS: awk crashed on multi-line SHADOWS ('newline in string') — filter_unshadowed went blind" \
  || ok "#516 §1 POS: no awk 'newline in string' crash on multi-line SHADOWS"

# §1 NEG (load-bearing): the multi-shadow filter must still PRUNE — not become a blanket passthrough.
# A boundary file living ONLY under a shadow package must NOT count as root coverage, else the
# false-green #513 removed would silently return under multi-shadow inputs. (GH #777: check-rule-globs.sh
# now prunes the vendored framework packages/core/, so the shipped eslint-rules/ no longer fakes a
# root-governed match here — the shadowed-only fixture is genuine again.)
T6=$(mktemp -d); install_into "$T6" ts-server
mkdir -p "$T6/pkg-a/src/routes" "$T6/pkg-b"
echo 'export const x=1;' > "$T6/pkg-a/src/routes/u.ts"          # boundary file ONLY under a shadow pkg
printf 'export default [];\n' > "$T6/pkg-a/eslint.config.mjs"   # dead config (owns boundary → FAIL)
printf 'export default [];\n' > "$T6/pkg-b/eslint.config.mjs"   # 2nd shadow → multi-line $SHADOWS
OUT6=$(gate "$T6"); RC6=$?
grep -q "no root-governed match" <<<"$OUT6" \
  && ok "#516 §1 NEG: multi-shadow filter still prunes — shadowed-only boundary file is not counted as root coverage" \
  || bad "#516 §1 NEG: shadowed-only file faked root coverage (filter became a passthrough): $(printf '%s' "$OUT6" | grep -i 'RULE_GLOBS.boundary' | head -1)"

# §2 re-export classifier gap: a package re-exporting a shared base config FILE whose path contains
# `eslint` and ends in a JS/TS module extension (timeliner's `import base from '@scope/config/eslint/base.mjs'`)
# was classified `dead` → false-FAIL. It MAY inherit R2 → must be `uncertain` (WARN), never FAIL.
T7=$(mktemp -d); install_into "$T7" ts-server
mkdir -p "$T7/apps/api/src/routes"; echo 'export const x=1;' > "$T7/apps/api/src/routes/u.ts"
printf "import base from '@scope/config/eslint/base.mjs';\nexport default [...base];\n" > "$T7/apps/api/eslint.config.mjs"
OUT7=$(gate "$T7"); RC7=$?
[ "$RC7" = "0" ] \
  && ok "#516 §2 POS: re-export of a base.mjs config → uncertain (WARN), no false-FAIL" \
  || bad "#516 §2 POS: gate exited $RC7 — re-export base.mjs config classified dead (false-FAIL)"
grep -q "⚠ apps/api" <<<"$OUT7" \
  && ok "#516 §2 POS: re-export base.mjs config gets a WARN (uncertain coverage surfaced)" \
  || bad "#516 §2 POS: no WARN — re-export base.mjs treated as dead instead of uncertain"

# §2 NEG (load-bearing): a genuinely self-contained dead config (no R2, no extends, no config-FILE
# import — only the typescript-eslint PLUGIN, which has no module extension in its specifier) must
# STILL be classified dead → FAIL. The broadened `uncertain` must not swallow it.
T8=$(mktemp -d); install_into "$T8" ts-server
mkdir -p "$T8/apps/api/src/routes"; echo 'export const x=1;' > "$T8/apps/api/src/routes/u.ts"
printf "import tseslint from 'typescript-eslint';\nexport default tseslint.config({rules:{}});\n" > "$T8/apps/api/eslint.config.mjs"
OUT8=$(gate "$T8"); RC8=$?
[ "$RC8" = "1" ] \
  && ok "#516 §2 NEG: self-contained dead config (typescript-eslint plugin only) still FAILS (not swallowed by uncertain)" \
  || bad "#516 §2 NEG: gate exited $RC8 — broadened uncertain wrongly swallowed a genuinely dead config"

# §1 portability guard (platform-independent — catches a reintroduction on gawk/Linux CI too):
# $SHADOWS can be multi-line; it must never reach awk via `-v` (BSD/macOS awk crashes on the newline).
SRC516="$REPO_ROOT/packages/core/audit-self/check-rule-globs.sh"
grep -Eq 'awk[[:space:]]+-v[[:space:]]+[A-Za-z_]+="\$SHADOWS"' "$SRC516" \
  && bad "#516 §1 guard: \$SHADOWS passed via 'awk -v' (multi-line crashes BSD/macOS awk — use env/ENVIRON)" \
  || ok "#516 §1 guard: \$SHADOWS not passed via 'awk -v' (newline-free → BSD/macOS awk safe)"

# ══════════════════════════════════════════════════════════════════════════════
# 2026-09-28 (Q4.5) — a root eslint.config.mjs the CONSUMER owns
# ══════════════════════════════════════════════════════════════════════════════
# A project that already had an eslint.config.mjs keeps it, and getff's RULE_GLOBS block lands there
# only once the install finds an HTTP boundary (Q4.7, 2026-09-28: getff adds its block to the
# consumer's config; before that it added nothing). The gate used to read a config without the
# block as «no globs found — check the config» and failed validate and the first push on every such
# project. There is no getff glob in such a config to verify: skip it and say why, the way
# check-rule-enforced.sh already does. A config that wires one of R2/R7/R8 keeps the alarm.
own_cfg_dir() { # $1 = eslint.config.mjs body → a project with one source file, gate run from the repo
  local d; d=$(mktemp -d)
  mkdir -p "$d/lib"; echo 'export const x = 1;' > "$d/lib/answer.ts"
  printf '%s\n' "$1" > "$d/eslint.config.mjs"
  printf '%s' "$d"
}
repo_gate() { ( cd "$1" && bash "$REPO_ROOT/packages/core/audit-self/check-rule-globs.sh" ) 2>&1; }

T9=$(own_cfg_dir "import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config(eslint.configs.recommended, tseslint.configs.recommended);")
OUT9=$(repo_gate "$T9"); RC9=$?
[ "$RC9" = "0" ] \
  && ok "own-config POS: a consumer-owned root config (no RULE_GLOBS, no getff rule) → gate exits 0" \
  || bad "own-config POS: gate exited $RC9 on a consumer-owned root config (saw: $(printf '%s' "$OUT9" | tail -2 | tr '\n' '|'))"
grep -q "not wired into eslint.config.mjs" <<<"$OUT9" \
  && ok "own-config POS: the skip names what is not wired and where" \
  || bad "own-config POS: no 'not wired into eslint.config.mjs' report line (a silent skip hides the gap)"

# NEG-a: getff's own config shape with the boundary key gone is still the alarm.
T10=$(own_cfg_dir "const RULE_GLOBS = {
  appCode: ['**/*.{ts,tsx}'],
};
export default [];")
OUT10=$(repo_gate "$T10"); RC10=$?
[ "$RC10" = "1" ] && grep -q "no globs found under RULE_GLOBS.boundary" <<<"$OUT10" \
  && ok "own-config NEG-a: a RULE_GLOBS block without its boundary key still FAILS" \
  || bad "own-config NEG-a: gate exited $RC10 — a broken getff config was skipped as consumer-owned"

# NEG-b: a consumer config that wires the getff rule by hand still FAILS — its globs are not ours
# to read, so the gate cannot call the rule live.
T11=$(own_cfg_dir "import r from './r.mjs';
export default [{ plugins: { 'rules-as-tests': r }, rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } }];")
OUT11=$(repo_gate "$T11"); RC11=$?
[ "$RC11" = "1" ] \
  && ok "own-config NEG-b: a hand-wired getff rule without RULE_GLOBS still FAILS (not skipped)" \
  || bad "own-config NEG-b: gate exited $RC11 — a config that wires the rule was skipped as not wired"

# Q4.7 (2026-09-28): the install now ADDS getff's block to a consumer's own config — the stack's
# rules-as-tests rules always, RULE_GLOBS + R2 only once it finds an HTTP boundary. Such a config
# carries getff's rules and no RULE_GLOBS block: still nothing of getff's to glob-check, so skip.
T11b=$(own_cfg_dir "import eslint from '@eslint/js';
import rulesAsTests from './eslint-rules-local/index.mjs';
export default [
  eslint.configs.recommended,
  { plugins: { 'rules-as-tests': rulesAsTests }, rules: { 'rules-as-tests/no-bare-todo': 'error' } },
  { ignores: ['eslint-rules-local/**'] },
];")
OUT11b=$(repo_gate "$T11b"); RC11b=$?
[ "$RC11b" = "0" ] && grep -q "not wired into eslint.config.mjs" <<<"$OUT11b" \
  && ok "own-config Q4.7: getff's block without RULE_GLOBS (no boundary found yet) → skipped, rc 0" \
  || bad "own-config Q4.7: gate exited $RC11b on a consumer config getff wired without a boundary (saw: $(printf '%s' "$OUT11b" | tail -2 | tr '\n' '|'))"
# The skip never hands the consumer a manual step.
if grep -qiE 'by hand|manually' <<<"$(printf '%s\n%s\n' "$OUT9" "$OUT11b")"; then
  bad "own-config Q4.7: the skip asks for a manual edit: $(printf '%s\n%s\n' "$OUT9" "$OUT11b" | grep -iE 'by hand|manually' | head -1)"
else
  ok "own-config Q4.7: the skip names what is not wired, with no manual step"
fi
# eslint.config.js: ESLint loads it before eslint.config.mjs, and the install wires a consumer's own
# one. The gate must read it — not stop with «eslint.config.mjs not found».
T11c=$(mktemp -d); mkdir -p "$T11c/lib"; echo 'export const x = 1;' > "$T11c/lib/answer.ts"
printf 'export default [];\n' > "$T11c/eslint.config.js"
OUT11c=$(repo_gate "$T11c"); RC11c=$?
[ "$RC11c" = "0" ] && grep -q "not wired into eslint.config.js" <<<"$OUT11c" \
  && ok "own-config Q4.7: a consumer's eslint.config.js is the config the gate reads" \
  || bad "own-config Q4.7: gate exited $RC11c on an eslint.config.js project (saw: $(printf '%s' "$OUT11c" | tail -2 | tr '\n' '|'))"
# eslint.config.cjs: getff adds nothing to it; the gate says so and passes (validate stays green).
T11d=$(mktemp -d); mkdir -p "$T11d/lib"; echo 'export const x = 1;' > "$T11d/lib/answer.ts"
printf 'module.exports = [];\n' > "$T11d/eslint.config.cjs"
OUT11d=$(repo_gate "$T11d"); RC11d=$?
[ "$RC11d" = "0" ] && grep -q "eslint.config.cjs is left as it is" <<<"$OUT11d" \
  && ok "own-config Q4.7: an eslint.config.cjs project passes, the gate saying getff added nothing to it" \
  || bad "own-config Q4.7: gate exited $RC11d on an eslint.config.cjs project (saw: $(printf '%s' "$OUT11d" | tail -2 | tr '\n' '|'))"
rm -rf "$T11c" "$T11d"

# A monorepo whose root config is the consumer's own eslint.config.cjs, with a workspace config that
# carries getff's RULE_GLOBS. ESLint lints the workspace with its own config, so the workspace
# configs are the rule layer — as in a monorepo with no root config at all (§807). Reading the
# ESLint lookup order made that .cjs «the root config»; the gate must still check the workspace
# configs under it, not stop at «skipped» (cold-review F3: before the lookup order it recursed).
own_root_mono() { # $1 = yes → apps/api has a routes/ file its boundary glob matches
  local d; d=$(mktemp -d)
  mkdir -p "$d/apps/api/src/lib"
  printf 'module.exports = [];\n' > "$d/eslint.config.cjs"
  printf "const RULE_GLOBS = {\n  boundary: ['**/routes/**/*.{ts,tsx}'],\n};\nexport default [{ files: RULE_GLOBS.boundary, rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } }];\n" \
    > "$d/apps/api/eslint.config.mjs"
  echo 'export const x = 1;' > "$d/apps/api/src/lib/x.ts"
  if [ "$1" = yes ]; then mkdir -p "$d/apps/api/src/routes"; echo 'export const u = 1;' > "$d/apps/api/src/routes/u.ts"; fi
  printf '%s' "$d"
}
T11e=$(own_root_mono no)
OUT11e=$(repo_gate "$T11e"); RC11e=$?
[ "$RC11e" = "1" ] && grep -q "SILENTLY INERT" <<<"$OUT11e" \
  && ok "own-root monorepo: under the consumer's eslint.config.cjs, a workspace boundary glob matching nothing FAILS" \
  || bad "own-root monorepo: gate exited $RC11e — the workspace configs under a consumer's .cjs root were not checked (saw: $(printf '%s' "$OUT11e" | tail -2 | tr '\n' '|'))"
# Paired negative: the same layout with a routes/ file passes, and the pass comes from the workspace check.
T11f=$(own_root_mono yes)
OUT11f=$(repo_gate "$T11f"); RC11f=$?
[ "$RC11f" = "0" ] && grep -q "check-rule-globs: OK" <<<"$OUT11f" \
  && ok "own-root monorepo neg: a workspace boundary glob that matches passes, checked in the workspace" \
  || bad "own-root monorepo neg: gate exited $RC11f or never checked the workspace (saw: $(printf '%s' "$OUT11f" | tail -2 | tr '\n' '|'))"
rm -rf "$T11e" "$T11f"

# The gate reads RULE_GLOBS.boundary the way JavaScript reads it, not only the way getff's template
# lays it out: double-quoted globs (prettier's default quotes) and a one-line object are the same
# config. A consumer's own `boundary: ["…"]` read as «no globs found» and failed every push while the
# install said nothing (second cold review, after #1868).
with_route() { mkdir -p "$1/src/routes"; echo 'export const u = 1;' > "$1/src/routes/u.ts"; printf '%s' "$1"; }
T11g=$(with_route "$(own_cfg_dir "const RULE_GLOBS = {
  boundary: [\"**/routes/**/*.{ts,tsx}\"],
};
export default [{ files: RULE_GLOBS.boundary, rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } }];")")
OUT11g=$(repo_gate "$T11g"); RC11g=$?
[ "$RC11g" = "0" ] && grep -q "R2 no-unsafe-zod-parse (RULE_GLOBS.boundary): matches" <<<"$OUT11g" \
  && ok "RULE_GLOBS reader: double-quoted boundary globs are read" \
  || bad "RULE_GLOBS reader: gate exited $RC11g on double-quoted boundary globs (saw: $(printf '%s' "$OUT11g" | grep -E '⚠|✗' | head -1))"
T11h=$(with_route "$(own_cfg_dir "const RULE_GLOBS = { boundary: ['**/routes/**/*.{ts,tsx}'], appCode: ['**/*.ts'] };
export default [{ files: RULE_GLOBS.boundary, rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } }];")")
OUT11h=$(repo_gate "$T11h"); RC11h=$?
[ "$RC11h" = "0" ] && grep -q "R2 no-unsafe-zod-parse (RULE_GLOBS.boundary): matches" <<<"$OUT11h" \
  && ok "RULE_GLOBS reader: a one-line RULE_GLOBS object is read" \
  || bad "RULE_GLOBS reader: gate exited $RC11h on a one-line RULE_GLOBS (saw: $(printf '%s' "$OUT11h" | grep -E '⚠|✗' | head -1))"
# Paired negative: on one line, the boundary array ends at its own `]` — appCode's '**/*.ts' (which
# matches every file) must not be read as a boundary glob.
T11i=$(own_cfg_dir "const RULE_GLOBS = { boundary: ['**/nowhere/**/*.{ts,tsx}'], appCode: ['**/*.ts'] };
export default [{ files: RULE_GLOBS.boundary, rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } }];")
OUT11i=$(repo_gate "$T11i"); RC11i=$?
[ "$RC11i" = "1" ] && grep -q "SILENTLY INERT" <<<"$OUT11i" \
  && ok "RULE_GLOBS reader neg: a one-line boundary array stops at its own ]" \
  || bad "RULE_GLOBS reader neg: gate exited $RC11i — a glob of the next key was read as a boundary glob"
rm -rf "$T11g" "$T11h" "$T11i"

# A workspace's eslint.config.js is the config ESLint loads there (it comes before .mjs), and the
# install writes R2 and RULE_GLOBS into a consumer's own one. With no root config the gate recursed
# into eslint.config.mjs workspaces only, so a project whose workspace configs are .js stopped with
# «eslint.config.mjs not found» on every push (second cold review, after #1868).
ws_js_mono() { # $1 = yes → apps/api has a routes/ file its boundary glob matches
  local d; d=$(mktemp -d)
  mkdir -p "$d/apps/api/src/lib" "$d/apps/web"
  printf "const RULE_GLOBS = {\n  boundary: ['**/routes/**/*.{ts,tsx}'],\n};\nexport default [{ files: RULE_GLOBS.boundary, rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } }];\n" \
    > "$d/apps/api/eslint.config.js"
  printf 'export default [];\n' > "$d/apps/web/eslint.config.js"
  echo 'export const x = 1;' > "$d/apps/api/src/lib/x.ts"
  if [ "$1" = yes ]; then mkdir -p "$d/apps/api/src/routes"; echo 'export const u = 1;' > "$d/apps/api/src/routes/u.ts"; fi
  printf '%s' "$d"
}
T11j=$(ws_js_mono no)
OUT11j=$(repo_gate "$T11j"); RC11j=$?
[ "$RC11j" = "1" ] && grep -q "SILENTLY INERT" <<<"$OUT11j" \
  && ok "workspace .js: a boundary glob in apps/api/eslint.config.js matching nothing FAILS" \
  || bad "workspace .js: gate exited $RC11j — a workspace eslint.config.js was not checked (saw: $(printf '%s' "$OUT11j" | tail -2 | tr '\n' '|'))"
T11k=$(ws_js_mono yes)
OUT11k=$(repo_gate "$T11k"); RC11k=$?
[ "$RC11k" = "0" ] && grep -q "check-rule-globs: OK" <<<"$OUT11k" \
  && ok "workspace .js neg: a matching boundary glob in apps/api/eslint.config.js passes, checked in the workspace" \
  || bad "workspace .js neg: gate exited $RC11k (saw: $(printf '%s' "$OUT11k" | tail -2 | tr '\n' '|'))"
rm -rf "$T11j" "$T11k"

# Provenance of the skip message. getff's own react-native config wires none of R2/R7/R8 (the RN
# preset ships zero custom rules) and carries no RULE_GLOBS block, so it takes the same skip — but
# calling it «your own config, the install kept it» is false on a fresh RN install. The baseline
# manifest records what getff delivered; the message must follow it.
sha_of() { { sha256sum "$1" 2>/dev/null || shasum -a 256 "$1"; } | awk '{print $1}'; }
manifest_for() { # $1 = dir, $2 = recorded hash for eslint.config.mjs, $3 = rn → getff also placed
  # the react-native sibling eslint.config.rn-common.mjs, as a react-native install does
  mkdir -p "$1/.ai-factory"
  if [ "${3:-}" = rn ]; then
    printf '{\n  "eslint.config.mjs": "%s",\n  "eslint.config.rn-common.mjs": "%s"\n}\n' "$2" "$2" \
      > "$1/.ai-factory/refresh-baseline.json"
  else
    printf '{\n  "eslint.config.mjs": "%s"\n}\n' "$2" > "$1/.ai-factory/refresh-baseline.json"
  fi
}
T12=$(own_cfg_dir "export default [];")
manifest_for "$T12" "$(sha_of "$T12/eslint.config.mjs")"
OUT12=$(repo_gate "$T12"); RC12=$?
[ "$RC12" = "0" ] && ! grep -q "your own config" <<<"$OUT12" \
  && grep -q "getff placed eslint.config.mjs" <<<"$OUT12" \
  && ok "own-config provenance: getff's own marker-less config is skipped as getff's, not called the consumer's" \
  || bad "own-config provenance: rc=$RC12, message misattributes getff's config (saw: $(printf '%s' "$OUT12" | head -1))"

# The same lookup with an ABSOLUTE ESLINT_CONFIG: the manifest key is relative to the project root,
# so a lookup by the path as given would call getff's config the consumer's.
OUT12b=$( cd "$T12" && ESLINT_CONFIG="$T12/eslint.config.mjs" bash "$REPO_ROOT/packages/core/audit-self/check-rule-globs.sh" 2>&1 ); RC12b=$?
[ "$RC12b" = "0" ] && ! grep -q "your own config" <<<"$OUT12b" \
  && grep -q "getff placed" <<<"$OUT12b" \
  && ok "own-config provenance: an absolute ESLINT_CONFIG still finds getff's manifest entry" \
  || bad "own-config provenance: rc=$RC12b, an absolute ESLINT_CONFIG misattributes getff's config (saw: $(printf '%s' "$OUT12b" | head -1))"

# getff placed a react-native config (its rn-common sibling is in the manifest) and it has been
# edited since. Still a skip, not the full alarm: getff's react-native config never had a
# RULE_GLOBS block, and failing every edit of it would turn check:globs RED on a one-line comment.
# The message says the file was edited.
T13=$(own_cfg_dir "export default [];")
manifest_for "$T13" "0000000000000000000000000000000000000000000000000000000000000000" rn
OUT13=$(repo_gate "$T13"); RC13=$?
[ "$RC13" = "0" ] && grep -q "getff placed eslint.config.mjs and it has been edited since" <<<"$OUT13" \
  && ok "own-config provenance: an edited getff react-native config is skipped and named as edited" \
  || bad "own-config provenance: rc=$RC13, an edited getff react-native config was not reported as edited (saw: $(printf '%s' "$OUT13" | head -1))"
! grep -q "edited since" <<<"$OUT12" \
  && ok "own-config provenance: the unedited getff config is not called edited (the hash is compared)" \
  || bad "own-config provenance: the config as delivered was called edited"

# getff placed a config of a stack whose template HAS a RULE_GLOBS block (no rn-common sibling),
# and an edit removed the block and every getff rule. That is getff's enforcement cut out of
# getff's own file — the bypass this gate exists to catch — so it FAILS, as it did before the
# consumer-owned skip existed; a recorded R2 N/A decision still applies.
T14=$(own_cfg_dir "export default [];")
manifest_for "$T14" "0000000000000000000000000000000000000000000000000000000000000000"
OUT14=$(repo_gate "$T14"); RC14=$?
[ "$RC14" = "1" ] && grep -q "RULE_GLOBS block and its rules-as-tests rules are gone" <<<"$OUT14" \
  && ok "own-config provenance: getff's RULE_GLOBS block cut out of getff's own config FAILS, naming why" \
  || bad "own-config provenance: rc=$RC14, stripping getff's rules out of getff's config passed (saw: $(printf '%s' "$OUT14" | head -2 | tr '\n' '|'))"

# ══════════════════════════════════════════════════════════════════════════════
# cold-review F11 — the install on a consumer config that already sets R2, with no RULE_GLOBS block
# ══════════════════════════════════════════════════════════════════════════════
# NEG-b above: the gate full-alarms such a config — its R2 globs are not getff's to read. The install
# called it «R2 already enforced» and added nothing, so every push failed while the install said
# nothing. Now R2 at 'error' with an HTTP boundary → the install adds RULE_GLOBS (and the scoped R2
# element that uses it) by insertions and the gate passes; R2 at another value, or for some files
# only → RULE_GLOBS alone, the consumer's R2 as it is, the gate passes, and the install asks
# check-rule-enforced.sh whether that R2 is on at 'error' for the boundary code, naming the file where
# it is not (operator decision 2026-09-29); no boundary to scope R2 to → the gate stays red and the
# not-wired summary names it. A recorded R2 N/A (a
# declarative-validation layout) keeps the gate green, and then there is nothing to name. The gate
# reads R7 and R8 the same way: a config that sets R7 alone, with no RULE_GLOBS block, fails it too.
# The wirer needs ts-morph (a --full install puts it in node_modules): borrowed from the framework
# package by package inside a real node_modules, so no install in the fixture writes into the
# framework's tree (synth-wire-consumer-config.test.sh borrow()).
FW_NM="$REPO_ROOT/node_modules"
f11_borrow() {
  local p q
  mkdir -p "$1/node_modules/.bin"
  for p in ts-morph typescript eslint @eslint typescript-eslint @typescript-eslint tsx; do
    [ -e "$FW_NM/$p" ] || continue
    case "$p" in
      @*) mkdir -p "$1/node_modules/$p"
          for q in "$FW_NM/$p"/*; do ln -s "$q" "$1/node_modules/$p/${q##*/}"; done ;;
      *)  ln -s "$FW_NM/$p" "$1/node_modules/$p" ;;
    esac
  done
  # The per-package R2 passes run the wirer through `npx --no-install tsx`; the install asks
  # scripts/check-rule-enforced.sh only when node_modules/.bin/eslint is there.
  [ -e "$FW_NM/.bin/tsx" ] && ln -s "$FW_NM/.bin/tsx" "$1/node_modules/.bin/tsx"
  [ -e "$FW_NM/.bin/eslint" ] && ln -s "$FW_NM/.bin/eslint" "$1/node_modules/.bin/eslint"
  return 0
}
f11_unborrow() {
  find "$1/node_modules" -maxdepth 2 -type l -exec rm -f {} + 2>/dev/null
  rmdir "$1/node_modules/.bin" "$1/node_modules/@eslint" "$1/node_modules/@typescript-eslint" "$1/node_modules" 2>/dev/null; return 0
}
f11_project() { # $1 = rule value, $2 = boundary | none | declarative, $3 = rule (default R2)
  local d rule="${3:-no-unsafe-zod-parse}"; d=$(mktemp -d)
  if [ "$2" = declarative ]; then
    printf '{ "name": "f11", "version": "0.0.0", "dependencies": { "@hono/zod-openapi": "^0.18.0" } }\n' > "$d/package.json"
  else
    printf '{ "name": "f11", "version": "0.0.0" }\n' > "$d/package.json"
  fi
  cat > "$d/eslint.config.mjs" <<JS
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import customRules from './eslint-rules-local/index.mjs';

export default tseslint.config(eslint.configs.recommended, tseslint.configs.recommended, {
  plugins: { 'rules-as-tests': customRules },
  rules: { 'rules-as-tests/$rule': '$1' },
});
JS
  if [ "$2" = boundary ]; then
    mkdir -p "$d/src/routes"
    printf "import { z } from 'zod';\n\nconst User = z.object({ name: z.string() });\n\nexport const create = (body: unknown) => User.parse(body);\n" > "$d/src/routes/users.ts"
  else
    mkdir -p "$d/lib"; echo 'export const x = 1;' > "$d/lib/answer.ts"
  fi
  printf '%s' "$d"
}
f11_install() { # $1 = dir, $2 = log
  f11_borrow "$1"
  ( cd "$1" && git init -q && bash "$REPO_ROOT/install.sh" ts-server </dev/null ) > "$2" 2>&1
  f11_unborrow "$1"
}
f11_not_wired() { awk '/NOT wired, or wired only in part/{on=1; next} on && /^[[:space:]]*$/{exit} on' "$1"; }
# The install asks the gate with AIF_STRICT_RUNTIME=1, which also reads RULE_GLOBS.appCode and .application
# (R7/R8): a line about those says so. f11_push — the summary without them: what a push in the default
# environment fails on; f11_strict — only them.
f11_push() { f11_not_wired "$1" | grep -v 'AIF_STRICT_RUNTIME=1'; }
f11_strict() { f11_not_wired "$1" | grep 'AIF_STRICT_RUNTIME=1'; }
f11_gate() { ( cd "$1" && bash scripts/check-rule-globs.sh ) 2>&1; }
# f11_zod <dir> — the project depends on zod: check-rule-enforced.sh asks ESLint about a boundary file only
# in a package that does (GH #730), so without it the install's ask of that gate checks nothing.
f11_zod() { printf '{ "name": "f11", "version": "0.0.0", "dependencies": { "zod": "^3.23.0" } }\n' > "$1/package.json"; }
# f11_enforced <log> — the not-wired lines about scripts/check-rule-enforced.sh.
f11_enforced() { f11_not_wired "$1" | grep -F 'check-rule-enforced.sh'; }

# F11e naming, on canned gate output (cold review 2026-09-29). With the root config the consumer's own and
# no RULE_GLOBS in it, check-rule-enforced.sh asks each workspace config, labelling its lines «root config»
# and its files from that workspace: they are named by the workspace, not as the consumer's root config.
# A package an R2 pass or F11 already named is not named twice. A failed run's verdict line is a FAILED
# line even when a later workspace passed.
# (read -d '', not $(cat <<…): bash 3.2 misparses an apostrophe in a heredoc inside $(…).)
IFS= read -r -d '' F11E_OUT <<'OUT' || true
check-rule-enforced: eslint.config.mjs is your own config with no RULE_GLOBS block — checking the workspace configs under it, which ESLint uses for their own files.
check-rule-enforced: checking apps/api/eslint.config.mjs
▶ check-rule-enforced: verifying R2 (rules-as-tests/no-unsafe-zod-parse) is actually APPLIED to boundary files (via eslint --print-config)
  ✗ root config: R2 (rules-as-tests/no-unsafe-zod-parse) is NOT in the resolved ESLint config for src/routes/a.ts — SILENTLY INERT here (verified from the package's own cwd, as `turbo run lint` resolves it).
     Wire 'rules-as-tests/no-unsafe-zod-parse' into the eslint config governing root config (or re-export the root config that wires it).
check-rule-enforced: FAILED — R2 is not applied to ≥1 boundary file (silent inertness).
check-rule-enforced: checking apps/web/eslint.config.mjs
  ✗ root config: R2 (rules-as-tests/no-unsafe-zod-parse) is only 'warn' in the resolved ESLint config for src/routes/b.ts — a warning fails no build unless every lint run passes --max-warnings=0.
check-rule-enforced: FAILED — R2 is not applied to ≥1 boundary file (silent inertness).
check-rule-enforced: checking apps/ok/eslint.config.mjs
  ✓ root config: R2 applied to src/routes/c.ts (severity: error)
check-rule-enforced: OK
OUT
F11E_NOTES=$(
  # shellcheck disable=SC1090
  INSTALL_SH_LIB_ONLY=1 source "$REPO_ROOT/setup.d/lib.sh"
  eval "$(sed -n -e '/^_f11_note() {/,/^}/p' -e '/^_f11e_named() {/,/^}/p' -e '/^_f11e_describe() {/,/^}/p' \
    -e '/^_f11e_name_failures() {/,/^}/p' -e '/^_f11e_verdict() {/,/^}/p' "$REPO_ROOT/setup.d/99-finalize.sh")"
  PROJECT_ROOT=$(mktemp -d); mkdir -p "$PROJECT_ROOT/apps/api" "$PROJECT_ROOT/apps/web" "$PROJECT_ROOT/apps/ok"
  _root_eslint=eslint.config.mjs
  NOT_WIRED=("R2 (rules-as-tests/no-unsafe-zod-parse) in apps/web/eslint.config.mjs — the config sets it itself; getff does not change a setting of yours")
  _f11e_name_failures "$F11E_OUT" && echo "NAMED" || echo "NONE"
  echo "VERDICT $(_f11e_verdict "$F11E_OUT" 1)"
  printf 'NOTE %s\n' "${NOT_WIRED[@]}"
  rm -rf "$PROJECT_ROOT"
)
grep -qx 'NAMED' <<<"$F11E_NOTES" || bad "F11e naming: the ✗ lines were not read (saw: $(tr '\n' '|' <<<"$F11E_NOTES"))"
[ "$(grep -c '^NOTE apps/api: R2 (rules-as-tests/no-unsafe-zod-parse) is NOT in the resolved ESLint config for apps/api/src/routes/a\.ts — scripts/check-rule-enforced\.sh fails on this project$' <<<"$F11E_NOTES")" -eq 1 ] \
  && ok "F11e naming: a workspace config the gate recursed into is named by its dir, its file from the project root" \
  || bad "F11e naming: apps/api's miss not named once by its workspace (notes: $(grep '^NOTE' <<<"$F11E_NOTES" | tr '\n' '|'))"
grep -q '^NOTE .*your own config' <<<"$F11E_NOTES" \
  && bad "F11e naming: a workspace config's line was blamed on the consumer's root config: $(grep '^NOTE .*your own config' <<<"$F11E_NOTES" | head -1)" \
  || ok "F11e naming: no workspace line is blamed on the consumer's root config"
[ "$(grep -c '^NOTE .*apps/web' <<<"$F11E_NOTES")" -eq 1 ] \
  && ok "F11e naming: apps/web, which an R2 pass already named, is not named again" \
  || bad "F11e naming: apps/web named $(grep -c '^NOTE .*apps/web' <<<"$F11E_NOTES") times (notes: $(grep '^NOTE' <<<"$F11E_NOTES" | tr '\n' '|'))"
grep -q '^VERDICT check-rule-enforced: FAILED' <<<"$F11E_NOTES" \
  && ok "F11e naming: the verdict of a failed run is its FAILED line, though the last workspace passed" \
  || bad "F11e naming: verdict of a failed run: $(grep '^VERDICT' <<<"$F11E_NOTES")"

# The same for a run with no workspace configs (second cold review 2026-09-29): a line labelled with a package
# dir is that package's; one an R2 pass («R2 (…) in <dir> — ») or F11 («<dir>: has boundary files …») already
# named is not named again; a line about no config (a stale R2 N/A marker) is named as the gate words it.
IFS= read -r -d '' F11E_ROOT_OUT <<'OUT' || true
▶ check-rule-enforced: verifying R2 (rules-as-tests/no-unsafe-zod-parse) is actually APPLIED to boundary files (via eslint --print-config)
  ✗ apps/api: R2 (rules-as-tests/no-unsafe-zod-parse) is NOT in the resolved ESLint config for apps/api/src/routes/a.ts — SILENTLY INERT here (verified from the package's own cwd, as `turbo run lint` resolves it).
  ✗ apps/web: R2 (rules-as-tests/no-unsafe-zod-parse) is only 'warn' in the resolved ESLint config for apps/web/src/routes/b.ts — a warning fails no build unless every lint run passes --max-warnings=0.
  ✗ apps/lib: R2 (rules-as-tests/no-unsafe-zod-parse) is NOT in the resolved ESLint config for apps/lib/src/routes/c.ts — SILENTLY INERT here (verified from the package's own cwd, as `turbo run lint` resolves it).
  ✗ check-rule-enforced: R2 marked N/A in .ai-factory/r2-decisions.md but a parse boundary now exists — wire R2 or update the decision.
check-rule-enforced: FAILED — R2 is not applied to ≥1 boundary file (silent inertness).
OUT
F11E_ROOT_NOTES=$(
  # shellcheck disable=SC1090
  INSTALL_SH_LIB_ONLY=1 source "$REPO_ROOT/setup.d/lib.sh"
  eval "$(sed -n -e '/^_f11_note() {/,/^}/p' -e '/^_f11e_named() {/,/^}/p' -e '/^_f11e_describe() {/,/^}/p' \
    -e '/^_f11e_name_failures() {/,/^}/p' "$REPO_ROOT/setup.d/99-finalize.sh")"
  PROJECT_ROOT=$(mktemp -d); mkdir -p "$PROJECT_ROOT/apps/api" "$PROJECT_ROOT/apps/web" "$PROJECT_ROOT/apps/lib"
  _root_eslint=eslint.config.mjs
  NOT_WIRED=("R2 (rules-as-tests/no-unsafe-zod-parse) in apps/web — the config sets it itself; getff does not change a setting of yours"
    "apps/lib: has boundary files but its own ESLint config does NOT wire R2 (rules-as-tests/no-unsafe-zod-parse)")
  _f11e_name_failures "$F11E_ROOT_OUT" >/dev/null
  printf 'NOTE %s\n' "${NOT_WIRED[@]}"
  rm -rf "$PROJECT_ROOT"
)
[ "$(grep -c '^NOTE apps/api: R2 (rules-as-tests/no-unsafe-zod-parse) is NOT in the resolved ESLint config for apps/api/src/routes/a\.ts — scripts/check-rule-enforced\.sh fails on this project$' <<<"$F11E_ROOT_NOTES")" -eq 1 ] \
  && ok "F11e naming: in a run with no workspace configs, a package's line is named by its dir" \
  || bad "F11e naming: apps/api's miss not named once (notes: $(grep '^NOTE' <<<"$F11E_ROOT_NOTES" | tr '\n' '|'))"
[ "$(grep -c '^NOTE .*apps/web' <<<"$F11E_ROOT_NOTES")" -eq 1 ] && [ "$(grep -c '^NOTE .*apps/lib' <<<"$F11E_ROOT_NOTES")" -eq 1 ] \
  && ok "F11e naming: a package an R2 pass («in <dir> — ») or F11 («<dir>: has boundary files») named is not named again" \
  || bad "F11e naming: apps/web or apps/lib named twice (notes: $(grep '^NOTE' <<<"$F11E_ROOT_NOTES" | tr '\n' '|'))"
grep -qx 'NOTE check-rule-enforced: R2 marked N/A in \.ai-factory/r2-decisions\.md but a parse boundary now exists — scripts/check-rule-enforced\.sh fails on this project' <<<"$F11E_ROOT_NOTES" \
  && ok "F11e naming: a line about no config (a stale R2 N/A marker) is named as the gate words it" \
  || bad "F11e naming: the stale-marker line went unnamed (notes: $(grep '^NOTE' <<<"$F11E_ROOT_NOTES" | tr '\n' '|'))"

# F11e run (second cold review 2026-09-29): the install asks the gate through _f11e_run, which runs it in a
# process group of its own. Whatever ends the ask — the limit, a signal to the install, a signal that ends the
# gate — ends every process the gate started, so none is left running and the install never waits on one.
# The fake gate starts a child that would outlive any test; the child's command line carries a marker, a path
# in this run's own temp dir, so a run beside it (another worktree's pre-push) never matches it.
F11E_T=$(mktemp -d); F11E_MARK="$F11E_T/child-mark"
cat > "$F11E_T/gate.sh" <<GATE
node -e 'setTimeout(() => {}, 900000)' "$F11E_MARK" &
wait
GATE
printf 'echo "gate: answered"\nexit 3\n' > "$F11E_T/quick.sh"
f11e_fns() { eval "$(sed -n -e '/^_f11e_run() {/,/^}/p' -e '/^_f11e_limit() {/,/^}/p' "$REPO_ROOT/setup.d/99-finalize.sh")"; }
# f11e_ask <gate> <limit> <out> — the ask as the install makes it (inside $(…), which waits for every writer
# of its output), in the background: its output and exit code land in <out>.
f11e_ask() { ( f11e_fns; o=$(_f11e_run "$1" "$2" 2>&1); r=$?; printf '%s\nrc=%s\n' "$o" "$r" > "$3" ) & F11E_JOB=$!; }
f11e_ends_within() { local i=0; while kill -0 "$1" 2>/dev/null; do [ "$i" -ge $(($2 * 10)) ] && return 1; sleep 0.1; i=$((i + 1)); done; }
f11e_child_up() { local i=0; until pgrep -f "$F11E_MARK" >/dev/null; do [ "$i" -ge 100 ] && return 1; sleep 0.1; i=$((i + 1)); done; }
f11e_left() { pgrep -f "$F11E_MARK" >/dev/null || pgrep -f "$F11E_T/gate.sh" >/dev/null; }
f11e_sweep() { pkill -KILL -f "$F11E_MARK" 2>/dev/null; pkill -KILL -f "$F11E_T/gate.sh" 2>/dev/null; wait "$F11E_JOB" 2>/dev/null; return 0; }

f11e_ask "$F11E_T/quick.sh" 30 "$F11E_T/quick.out"
f11e_ends_within "$F11E_JOB" 20 && grep -qx 'gate: answered' "$F11E_T/quick.out" && grep -qx 'rc=3' "$F11E_T/quick.out" \
  && ok "F11e run: a gate that answers in time passes on its output and its exit code" \
  || bad "F11e run: a quick gate's answer was lost ($(tr '\n' '|' 2>/dev/null < "$F11E_T/quick.out"))"
f11e_sweep

f11e_ask "$F11E_T/gate.sh" 1 "$F11E_T/limit.out"
f11e_ends_within "$F11E_JOB" 20 && ! f11e_left && grep -qx 'rc=124' "$F11E_T/limit.out" \
  && ok "F11e run: at the limit the gate and the child it started are stopped, and the ask ends (exit 124)" \
  || bad "F11e run: at the limit the ask did not end, or left the gate or its child running ($(tr '\n' '|' 2>/dev/null < "$F11E_T/limit.out"))"
f11e_sweep

f11e_ask "$F11E_T/gate.sh" 60 "$F11E_T/term.out"
if f11e_child_up; then
  kill -TERM "$(ps -o ppid= -p "$(pgrep -f "$F11E_T/gate.sh" | head -1)" | tr -d ' ')"
  f11e_ends_within "$F11E_JOB" 10 && ! f11e_left && grep -qx 'rc=143' "$F11E_T/term.out" \
    && ok "F11e run: a signal to the ask stops the gate and its child too, and the ask ends by that signal" \
    || bad "F11e run: after SIGTERM to the ask, the gate or its child is still running, or the ask did not end by the signal ($(tr '\n' '|' 2>/dev/null < "$F11E_T/term.out"))"
else bad "F11e run: the fake gate's child never started — the signal arm is vacuous"; fi
f11e_sweep

f11e_ask "$F11E_T/gate.sh" 60 "$F11E_T/quit.out"
if f11e_child_up; then
  kill -QUIT "$(ps -o ppid= -p "$(pgrep -f "$F11E_T/gate.sh" | head -1)" | tr -d ' ')"
  f11e_ends_within "$F11E_JOB" 10 && ! f11e_left && grep -qx 'rc=131' "$F11E_T/quit.out" \
    && ok "F11e run: Ctrl-\\ (SIGQUIT) to the ask stops the gate and its child too" \
    || bad "F11e run: after SIGQUIT to the ask, the gate or its child is still running, or the ask did not end by the signal ($(tr '\n' '|' 2>/dev/null < "$F11E_T/quit.out"))"
else bad "F11e run: the fake gate's child never started — the SIGQUIT arm is vacuous"; fi
f11e_sweep

f11e_ask "$F11E_T/gate.sh" 60 "$F11E_T/kill.out"
if f11e_child_up; then
  kill -KILL "$(pgrep -f "$F11E_T/gate.sh" | head -1)"
  f11e_ends_within "$F11E_JOB" 10 && ! f11e_left && grep -qx 'rc=137' "$F11E_T/kill.out" \
    && ok "F11e run: a gate ended by a signal takes its child with it, and the ask exits 128 + that signal" \
    || bad "F11e run: after the gate was killed, its child is still running, or the ask's exit code hides the signal ($(tr '\n' '|' 2>/dev/null < "$F11E_T/kill.out"))"
else bad "F11e run: the fake gate's child never started — the killed-gate arm is vacuous"; fi
f11e_sweep

# The limit is a whole number of seconds. Anything else — 0 among it — falls back to the default, and a value
# past what a JavaScript timer holds is capped: either would otherwise fire at once and stop a gate that was
# never asked. Leading zeros are read away (third cold review 2026-09-29).
F11E_LIMITS=$( f11e_fns; for v in 30 '' soon 12.5 999999999999 0 00 010 000001; do printf '%s=%s\n' "$v" "$(_f11e_limit "$v" 2>&1)"; done )
[ "$F11E_LIMITS" = "$(printf '30=30\n=120\nsoon=120\n12.5=120\n999999999999=99999\n0=120\n00=120\n010=10\n000001=1')" ] \
  && ok "F11e limit: a whole number is kept (leading zeros read away); anything else, 0 too, is the default 120 s; a huge value is capped at 99999 s" \
  || bad "F11e limit: AIF_F11E_TIMEOUT_S read as $(tr '\n' '|' <<<"$F11E_LIMITS")"
rm -rf "$F11E_T"

if [ ! -f "$FW_NM/ts-morph/package.json" ]; then
  bad "F11: ts-morph is not installed in the framework (run npm install first) — the F11 arms would be vacuous"
else
  # error + boundary → RULE_GLOBS added, the gate passes.
  T15=$(f11_project error boundary); f11_install "$T15" "$T15.log"
  grep -q '^const RULE_GLOBS = {' "$T15/eslint.config.mjs" \
    && ok "F11 error: RULE_GLOBS is added to a config that sets R2 to 'error' itself" \
    || bad "F11 error: no RULE_GLOBS block added (install said: $(grep -E 'R2|synth-wire' "$T15.log" | head -3 | tr '\n' '|'))"
  grep -q "'rules-as-tests/no-unsafe-zod-parse': 'error'" "$T15/eslint.config.mjs" \
    && ok "F11 error: the consumer's own R2 setting is still there" || bad "F11 error: the consumer's own R2 setting is gone"
  OUT15=$(f11_gate "$T15"); RC15=$?
  [ "$RC15" = "0" ] && ok "F11 error: check:globs passes after the install" \
    || bad "F11 error: check:globs exited $RC15 after the install (saw: $(printf '%s' "$OUT15" | tail -2 | tr '\n' '|'))"
  grep -q 'RULE_GLOBS' <<<"$(f11_push "$T15.log")" \
    && bad "F11 error: the not-wired summary names RULE_GLOBS, though it was added" || ok "F11 error: nothing about RULE_GLOBS in the not-wired summary"
  # The install ran without AIF_STRICT_RUNTIME, and the wirer adds RULE_GLOBS.boundary alone: a push with
  # AIF_STRICT_RUNTIME=1 fails on appCode AND application — each named, once, as a strict-mode failure.
  OUT15S=$( cd "$T15" && AIF_STRICT_RUNTIME=1 bash scripts/check-rule-globs.sh 2>&1 ); RC15S=$?
  [ "$RC15S" = "1" ] || bad "F11 error strict: check:globs with AIF_STRICT_RUNTIME=1 exited $RC15S — the arms below assume it is red on appCode and application"
  for _k in appCode application; do
    _n=$(f11_strict "$T15.log" | grep 'check-rule-globs.sh' | grep -c "RULE_GLOBS\.$_k")
    [ "$_n" -eq 1 ] \
      && ok "F11 error strict: the summary names RULE_GLOBS.$_k once, as failing with AIF_STRICT_RUNTIME=1" \
      || bad "F11 error strict: RULE_GLOBS.$_k named $_n times (gate: $(printf '%s' "$OUT15S" | grep -E '⚠|✗' | tr '\n' '|'); summary: $(f11_not_wired "$T15.log" | tr '\n' '|'))"
  done

  # warn + boundary → getff does not change the consumer's setting: it declares RULE_GLOBS alone, so
  # check:globs passes, and check-rule-enforced.sh — for which a 'warn' is not applied — is named once,
  # with the boundary file (operator decision 2026-09-29).
  T16=$(f11_project warn boundary); f11_zod "$T16"; f11_install "$T16" "$T16.log"
  grep -q "'rules-as-tests/no-unsafe-zod-parse': 'warn'" "$T16/eslint.config.mjs" \
    && grep -q '^export const RULE_GLOBS = {' "$T16/eslint.config.mjs" && ! grep -q 'files: RULE_GLOBS\.boundary' "$T16/eslint.config.mjs" \
    && ok "F11 warn: the consumer's 'warn' is kept, RULE_GLOBS is declared, and getff adds no R2 element" \
    || bad "F11 warn: the config's R2 setting was changed, an R2 element added, or no RULE_GLOBS declared (install said: $(grep -E 'R2|synth-wire' "$T16.log" | head -3 | tr '\n' '|'))"
  OUT16=$(f11_gate "$T16"); RC16=$?
  [ "$RC16" = "0" ] && ok "F11 warn: check:globs passes after the install" \
    || bad "F11 warn: check:globs exited $RC16 after the install (saw: $(printf '%s' "$OUT16" | grep -E '⚠|✗' | tr '\n' '|'))"
  grep -q 'RULE_GLOBS' <<<"$(f11_push "$T16.log")" \
    && bad "F11 warn: the summary names RULE_GLOBS, though it was added: $(f11_push "$T16.log" | grep RULE_GLOBS | head -1)" \
    || ok "F11 warn: nothing about RULE_GLOBS in the not-wired summary"
  [ "$(f11_enforced "$T16.log" | grep -c "only 'warn'.*src/routes/users\.ts")" -eq 1 ] \
    && ok "F11 warn: the summary names, once, that R2 is only 'warn' for src/routes/users.ts (check-rule-enforced.sh)" \
    || bad "F11 warn: check-rule-enforced.sh fails on this project while the summary does not name it once (summary: $(f11_not_wired "$T16.log" | tr '\n' '|'))"

  # error + no boundary (layout ambiguous) → nothing to scope R2 to: the gate stays red, the summary says why.
  T17=$(f11_project error none); f11_install "$T17" "$T17.log"
  OUT17=$(f11_gate "$T17"); RC17=$?
  [ "$RC17" = "1" ] || bad "F11 ambiguous: check:globs exited $RC17 — the arm below assumes the gate is red here"
  grep -q 'RULE_GLOBS' <<<"$(f11_not_wired "$T17.log" | grep 'eslint.config.mjs')" \
    && ok "F11 ambiguous: the not-wired summary names RULE_GLOBS for eslint.config.mjs (the gate is red on it)" \
    || bad "F11 ambiguous: check:globs fails every push while the install says nothing (summary: $(f11_not_wired "$T17.log" | tr '\n' '|'))"

  # Paired negative: a declarative-validation layout records R2 N/A, the gate is green, nothing to name.
  T18=$(f11_project error declarative); f11_install "$T18" "$T18.log"
  OUT18=$(f11_gate "$T18"); RC18=$?
  [ "$RC18" = "0" ] || bad "F11 N/A: check:globs exited $RC18 on a recorded R2 N/A (saw: $(printf '%s' "$OUT18" | tail -2 | tr '\n' '|'))"
  grep -q 'RULE_GLOBS' <<<"$(f11_push "$T18.log")" \
    && bad "F11 N/A: the summary names RULE_GLOBS though the recorded R2 N/A keeps the gate green" \
    || ok "F11 N/A: nothing about RULE_GLOBS when a recorded R2 N/A keeps the gate green"

  # R7 alone, no RULE_GLOBS, no boundary: the gate reads it as it reads R2 — red, and named.
  T19=$(f11_project error none no-direct-time-randomness); f11_install "$T19" "$T19.log"
  OUT19=$(f11_gate "$T19"); RC19=$?
  [ "$RC19" = "1" ] || bad "F11 R7: check:globs exited $RC19 — the arm below assumes the gate is red here"
  grep -q 'RULE_GLOBS' <<<"$(f11_not_wired "$T19.log" | grep 'eslint.config.mjs')" \
    && ok "F11 R7: the not-wired summary names RULE_GLOBS for a config that sets R7 alone (the gate is red on it)" \
    || bad "F11 R7: check:globs fails every push while the install says nothing (summary: $(f11_not_wired "$T19.log" | tr '\n' '|'))"

  # error for some files only + boundary: a RULE_GLOBS.boundary element at 'error' would reach the files the
  # consumer's own files: leaves out, so getff declares RULE_GLOBS alone and check:globs passes. The
  # boundary code lies outside that files:, and the summary names it: check-rule-enforced.sh, asked by the
  # install, finds R2 NOT in the resolved config of src/routes/users.ts — which is also the proof that no
  # element of getff's widened R2 there (it would have made that gate pass).
  T20=$(f11_project error boundary); f11_zod "$T20"
  perl -0pi -e "s/\{\n  plugins:/{\n  files: ['src\/api\/**'],\n  plugins:/" "$T20/eslint.config.mjs"
  grep -q "files: \['src/api/\*\*'\]," "$T20/eslint.config.mjs" || bad "F11 scoped: the fixture has no files: on the consumer's R2 element"
  f11_install "$T20" "$T20.log"
  grep -q "files: \['src/api/\*\*'\]," "$T20/eslint.config.mjs" && grep -q '^export const RULE_GLOBS = {' "$T20/eslint.config.mjs" \
    && ! grep -q 'files: RULE_GLOBS\.boundary' "$T20/eslint.config.mjs" \
    && ok "F11 scoped: RULE_GLOBS is declared, the consumer's files: is kept, and no element of getff's widens R2 past it" \
    || bad "F11 scoped: getff changed the consumer's R2 scope, added an R2 element, or declared no RULE_GLOBS"
  OUT20=$(f11_gate "$T20"); RC20=$?
  [ "$RC20" = "0" ] && ok "F11 scoped: check:globs passes after the install" \
    || bad "F11 scoped: check:globs exited $RC20 after the install (saw: $(printf '%s' "$OUT20" | grep -E '⚠|✗' | tr '\n' '|'))"
  grep -q 'NOT in the resolved ESLint config for src/routes/users\.ts' <<<"$(f11_enforced "$T20.log")" \
    && ok "F11 scoped: the summary names src/routes/users.ts, the boundary file the consumer's R2 does not reach" \
    || bad "F11 scoped: check-rule-enforced.sh fails on this project while the summary does not name the file (summary: $(f11_not_wired "$T20.log" | tr '\n' '|'))"

  # Paired negative: R2 scoped the consumer's way over all of src/ reaches the boundary code — RULE_GLOBS
  # alone again, both gates pass, and the summary names neither. The install's ask of check-rule-enforced.sh
  # ran and passed (its verdict line is in the log), so the silence is not a gate that was never asked.
  T30=$(f11_project error boundary); f11_zod "$T30"
  perl -0pi -e "s/\{\n  plugins:/{\n  files: ['src\/**\/*.ts'],\n  plugins:/" "$T30/eslint.config.mjs"
  grep -q "files: \['src/\*\*/\*\.ts'\]," "$T30/eslint.config.mjs" || bad "F11 scoped-reach: the fixture has no files: on the consumer's R2 element"
  f11_install "$T30" "$T30.log"
  OUT30=$(f11_gate "$T30"); RC30=$?
  [ "$RC30" = "0" ] && grep -q '^export const RULE_GLOBS = {' "$T30/eslint.config.mjs" \
    && ok "F11 scoped-reach: RULE_GLOBS is declared and check:globs passes" \
    || bad "F11 scoped-reach: check:globs exited $RC30, or no RULE_GLOBS declared (saw: $(printf '%s' "$OUT30" | grep -E '⚠|✗' | tr '\n' '|'))"
  grep -q 'check-rule-enforced: OK' "$T30.log" \
    && ok "F11 scoped-reach: the install asked check-rule-enforced.sh, and it passed" \
    || bad "F11 scoped-reach: no passing check-rule-enforced.sh run in the install log — the arm below would be vacuous"
  grep -qE 'RULE_GLOBS|check-rule-enforced' <<<"$(f11_push "$T30.log")" \
    && bad "F11 scoped-reach: the summary names a gate that passes: $(f11_push "$T30.log" | grep -E 'RULE_GLOBS|check-rule-enforced' | head -1)" \
    || ok "F11 scoped-reach: nothing about RULE_GLOBS or check-rule-enforced.sh in the summary"
  # The gate also prints OK when it skips (no zod, no boundary file), so its verdict alone does not show
  # that ESLint was asked about the boundary file: ask the gate again and read its per-file line.
  f11_borrow "$T30"
  OUT30E=$( cd "$T30" && bash scripts/check-rule-enforced.sh 2>&1 ); RC30E=$?
  f11_unborrow "$T30"
  [ "$RC30E" = "0" ] && grep -q 'R2 applied to src/routes/users\.ts (severity: error)' <<<"$OUT30E" \
    && ok "F11 scoped-reach: check-rule-enforced.sh asked ESLint about src/routes/users.ts and found R2 at 'error'" \
    || bad "F11 scoped-reach: the gate exited $RC30E without asking about src/routes/users.ts ($(printf '%s' "$OUT30E" | tr '\n' '|'))"

  # R2 scoped the consumer's way to one boundary token's code, the first the gate reads (handlers), and
  # missing another's (routes): the first boundary file alone read green here (cold review 2026-09-29).
  # The install names the file R2 misses.
  T31=$(f11_project error boundary); f11_zod "$T31"
  perl -0pi -e "s/\{\n  plugins:/{\n  files: ['src\/handlers\/**'],\n  plugins:/" "$T31/eslint.config.mjs"
  mkdir -p "$T31/src/handlers"
  printf "import { z } from 'zod';\n\nconst Pay = z.object({ sum: z.number() });\n\nexport const pay = (body: unknown) => Pay.parse(body);\n" > "$T31/src/handlers/pay.ts"
  f11_install "$T31" "$T31.log"
  T31_NAMED=$(f11_enforced "$T31.log")
  [ "$(grep -c 'NOT in the resolved ESLint config for src/routes/users\.ts' <<<"$T31_NAMED")" -eq 1 ] \
    && ! grep -q 'src/handlers/pay\.ts' <<<"$T31_NAMED" \
    && ok "F11 partial reach: the summary names src/routes/users.ts, which R2 misses, and not the handlers file it reaches" \
    || bad "F11 partial reach: R2 reaching only the handlers code went unnamed, or named the wrong file (summary: $(f11_not_wired "$T31.log" | tr '\n' '|'))"

  # The ask runs eslint --print-config on the consumer's config, whose load can outlast any wait: it runs
  # under a limit, and the install goes on and says so (cold review 2026-09-29). The config below loads
  # slowly only for that ask (the install sets AIF_F11E_LIMIT for it), not for the wirer's own probe.
  T32=$(f11_project error boundary); f11_zod "$T32"
  { printf '%s\n' "if (process.env.AIF_F11E_LIMIT) await new Promise((r) => setTimeout(r, 20000));"
    cat "$T32/eslint.config.mjs"; } > "$T32/cfg.tmp" && mv "$T32/cfg.tmp" "$T32/eslint.config.mjs"
  ( export AIF_F11E_TIMEOUT_S=3; f11_install "$T32" "$T32.log" )
  grep -q 'asked scripts/check-rule-enforced.sh — no answer within 3 s, and the install did not wait longer' "$T32.log" \
    && grep -q 'scripts/check-rule-enforced.sh did not finish within 3 s on this project' <<<"$(f11_not_wired "$T32.log")" \
    && ok "F11 limit: a gate run that outlasts the limit is stopped, and the summary says the install could not ask" \
    || bad "F11 limit: no limit on the ask, or it went unnamed (log: $(grep -F 'check-rule-enforced' "$T32.log" | tr '\n' '|'))"
  # The gate runs as bash "$T32/scripts/…" and its eslint as node "$T32/node_modules/.bin/eslint": both carry the path.
  pgrep -f "$T32/" >/dev/null \
    && bad "F11 limit: the gate or an eslint it started is still running after the limit: $(pgrep -fl "$T32/" | head -2 | tr '\n' '|')" \
    || ok "F11 limit: nothing of the stopped gate run (the gate, its eslint) is left running"

  # A RULE_GLOBS of the consumer's with no boundary array, no custom rule, no boundary code: the gate reads
  # RULE_GLOBS.boundary wherever RULE_GLOBS appears and fails — the summary names it (cold-review, after #1868).
  T21=$(f11_project error none)
  cat > "$T21/eslint.config.mjs" <<'JS'
const RULE_GLOBS = { appCode: ['**/*.ts'] };

export default [{ files: RULE_GLOBS.appCode, rules: { 'no-console': 'error' } }];
JS
  f11_install "$T21" "$T21.log"
  OUT21=$(f11_gate "$T21"); RC21=$?
  [ "$RC21" = "1" ] || bad "F11 no-boundary-array: check:globs exited $RC21 — the arm below assumes the gate is red here"
  grep -q 'RULE_GLOBS' <<<"$(f11_not_wired "$T21.log" | grep 'eslint.config.mjs')" \
    && ok "F11 no-boundary-array: the not-wired summary names RULE_GLOBS for eslint.config.mjs (the gate is red on it)" \
    || bad "F11 no-boundary-array: check:globs fails every push while the install says nothing (summary: $(f11_not_wired "$T21.log" | tr '\n' '|'))"

  # The consumer's own RULE_GLOBS.boundary, well formed, whose globs match no source file, and no
  # boundary code for the install to add: the gate fails on it (matches ZERO). The install decides by
  # running the gate, not by a copy of its greps — a boundary array present read as «fine» (second
  # cold review, after #1868).
  T22=$(f11_project error none)
  cat > "$T22/eslint.config.mjs" <<'JS'
const RULE_GLOBS = {
  boundary: ['**/nowhere/**/*.{ts,tsx}'],
};

export default [{ files: RULE_GLOBS.boundary, rules: { 'no-console': 'error' } }];
JS
  f11_install "$T22" "$T22.log"
  OUT22=$(f11_gate "$T22"); RC22=$?
  [ "$RC22" = "1" ] || bad "F11 zero-match: check:globs exited $RC22 — the arm below assumes the gate is red here"
  grep -q 'matches' <<<"$(f11_not_wired "$T22.log" | grep 'eslint.config.mjs' | grep 'RULE_GLOBS')" \
    && ok "F11 zero-match: the not-wired summary names RULE_GLOBS.boundary matching no source file (the gate is red on it)" \
    || bad "F11 zero-match: check:globs fails every push while the install says nothing (summary: $(f11_not_wired "$T22.log" | tr '\n' '|'))"

  # The same config with double-quoted globs that DO match: the gate reads them and passes, so the
  # summary says nothing about RULE_GLOBS.
  T23=$(f11_project error boundary)
  cat > "$T23/eslint.config.mjs" <<'JS'
const RULE_GLOBS = {
  boundary: ["**/routes/**/*.{ts,tsx}"],
};

export default [{ files: RULE_GLOBS.boundary, rules: { "no-console": "error" } }];
JS
  f11_install "$T23" "$T23.log"
  OUT23=$(f11_gate "$T23"); RC23=$?
  [ "$RC23" = "0" ] && ok "F11 double-quoted: check:globs passes on the consumer's double-quoted RULE_GLOBS.boundary" \
    || bad "F11 double-quoted: check:globs exited $RC23 (saw: $(printf '%s' "$OUT23" | grep -E '⚠|✗' | head -1))"
  grep -q 'RULE_GLOBS' <<<"$(f11_push "$T23.log")" \
    && bad "F11 double-quoted: the summary names RULE_GLOBS though the gate passes: $(f11_push "$T23.log" | grep RULE_GLOBS | head -1)" \
    || ok "F11 double-quoted: nothing about RULE_GLOBS in the summary when the gate passes"

  # A monorepo whose root and workspace configs are both the consumer's own: the root pass adds
  # RULE_GLOBS, then Layer 2 adds R2 to apps/api's config. The install asks the gate once every R2
  # pass has run — asked in between, it named apps/api as failing the gate that then passed on every
  # push (third cold review, after #1868).
  T24=$(mktemp -d)
  printf '{ "name": "mono", "version": "0.0.0", "private": true, "dependencies": { "zod": "^3.0.0" } }\n' > "$T24/package.json"
  mkdir -p "$T24/apps/api/src/routes" "$T24/src/lib"
  for c in "$T24/eslint.config.mjs" "$T24/apps/api/eslint.config.mjs"; do
    printf "import eslint from '@eslint/js';\nimport tseslint from 'typescript-eslint';\n\nexport default tseslint.config(eslint.configs.recommended, tseslint.configs.recommended);\n" > "$c"
  done
  printf '{ "name": "api", "version": "0.0.0", "dependencies": { "zod": "^3.0.0" } }\n' > "$T24/apps/api/package.json"
  printf "import { z } from 'zod';\n\nconst User = z.object({ name: z.string() });\n\nexport const create = (body: unknown) => User.parse(body);\n" > "$T24/apps/api/src/routes/users.ts"
  echo 'export const x = 1;' > "$T24/src/lib/x.ts"
  f11_install "$T24" "$T24.log"
  grep -q 'no-unsafe-zod-parse' "$T24/apps/api/eslint.config.mjs" \
    || bad "F11 monorepo: no R2 in apps/api/eslint.config.mjs — the arm below assumes Layer 2 added it (install said: $(grep -E 'R2' "$T24.log" | head -3 | tr '\n' '|'))"
  OUT24=$(f11_gate "$T24"); RC24=$?
  [ "$RC24" = "0" ] || bad "F11 monorepo: check:globs exited $RC24 — the arm below assumes it passes after the install (saw: $(printf '%s' "$OUT24" | grep -E '⚠|✗' | head -1))"
  # F11's own wording only: a monorepo gets no ci.yml, so 60-ci.sh names each CI gate, check:globs
  # among them, as not in a workflow (#1878) — a line about CI, not about the gate failing.
  grep -qE 'check-rule-globs\.sh(, which runs on every push| fails on)' <<<"$(f11_push "$T24.log")" \
    && bad "F11 monorepo: the summary says check-rule-globs.sh fails, though it passes after the install: $(f11_push "$T24.log" | grep -E 'check-rule-globs\.sh(, which runs on every push| fails on)' | head -1)" \
    || ok "F11 monorepo: the install asks the gate after every R2 pass — nothing about a gate that passes"

  # A recorded R2 N/A that no longer holds (an earlier install wrote it; the project now has boundary
  # code): the re-install drops the block (#1895, 60-ci.sh _r2_na_strip), so the gate judges the wired
  # globs and passes, and the summary names no «marked N/A» — nor hands on the gate's own advice to
  # change the decision (third cold review, after #1868). Without the drop the gate fails «marked N/A».
  T25=$(f11_project error boundary); mkdir -p "$T25/.ai-factory"
  printf '# Tool decisions\n\n<!-- aif:r2-na:begin -->\n### R2 N/A (recorded by an earlier install)\n<!-- aif:r2-na:end -->\n' > "$T25/.ai-factory/tool-decisions.md"
  f11_install "$T25" "$T25.log"
  OUT25=$(f11_gate "$T25"); RC25=$?
  grep -qF '<!-- aif:r2-na:begin -->' "$T25/.ai-factory/tool-decisions.md" \
    && bad "F11 stale N/A: the re-install left the R2 N/A block that no longer holds" \
    || ok "F11 stale N/A: the re-install removed the R2 N/A block that no longer holds"
  [ "$RC25" = "0" ] && ! grep -q 'marked N/A' <<<"$OUT25" \
    && ok "F11 stale N/A: check:globs passes once the stale N/A is gone" \
    || bad "F11 stale N/A: check:globs exited $RC25 after the install (saw: $(grep -E '⚠|✗' <<<"$OUT25" | tr '\n' '|'))"
  grep -q 'marked N/A' <<<"$(f11_not_wired "$T25.log")" \
    && bad "F11 stale N/A: the summary names a «marked N/A» the install removed: $(f11_not_wired "$T25.log" | grep 'marked N/A' | head -1)" \
    || ok "F11 stale N/A: the summary names no «marked N/A»"
  grep -qiE 'update the decision|widen' <<<"$(f11_not_wired "$T25.log")" \
    && bad "F11 stale N/A: the summary hands on the gate's advice as a step: $(f11_not_wired "$T25.log" | grep -iE 'update the decision|widen' | head -1)" \
    || ok "F11 stale N/A: no step handed on from the gate's output"

  # With AIF_STRICT_RUNTIME=1 the gate reads R7's RULE_GLOBS.appCode too: a consumer's RULE_GLOBS with a
  # boundary array and no appCode fails on appCode, and the summary names appCode — not a missing
  # boundary array the config has (third cold review, after #1868).
  T26=$(f11_project error boundary)
  cat > "$T26/eslint.config.mjs" <<'JS'
const RULE_GLOBS = {
  boundary: ['**/routes/**/*.{ts,tsx}'],
};

export default [{ files: RULE_GLOBS.boundary, rules: { 'no-console': 'error' } }];
JS
  export AIF_STRICT_RUNTIME=1
  f11_install "$T26" "$T26.log"
  OUT26=$(f11_gate "$T26"); RC26=$?
  unset AIF_STRICT_RUNTIME
  [ "$RC26" = "1" ] || bad "F11 strict: check:globs exited $RC26 with AIF_STRICT_RUNTIME=1 — the arm below assumes the gate is red on appCode"
  grep -q 'RULE_GLOBS\.appCode' <<<"$(f11_not_wired "$T26.log" | grep 'check-rule-globs.sh')" \
    && ok "F11 strict: the summary names RULE_GLOBS.appCode the gate fails on" \
    || bad "F11 strict: check:globs fails on RULE_GLOBS.appCode while the summary does not name it (summary: $(f11_not_wired "$T26.log" | tr '\n' '|'))"
  grep -q 'no boundary array' <<<"$(f11_not_wired "$T26.log")" \
    && bad "F11 strict: the summary says the config has no boundary array, though it has one: $(f11_not_wired "$T26.log" | grep 'no boundary array' | head -1)" \
    || ok "F11 strict: nothing about a missing boundary array the config has"

  # A gate that fails with no failure line the install can read (a consumer's own scripts/check-rule-globs.sh,
  # which copy_safe keeps; a crash): under install.sh's `set -euo pipefail` the empty grep in the fallback
  # used to end the install there, silently, before the NOT wired summary (fourth cold review).
  T27=$(f11_project error none); mkdir -p "$T27/scripts"
  printf '#!/usr/bin/env bash\necho "check-rule-globs: something else went wrong"\nexit 2\n' > "$T27/scripts/check-rule-globs.sh"
  f11_install "$T27" "$T27.log"
  grep -q 'exits 2' <<<"$(f11_not_wired "$T27.log" | grep 'check-rule-globs.sh')" \
    && ok "F11 no failure line: the install goes on and the summary says the gate exits 2" \
    || bad "F11 no failure line: the install stopped in the F11 check, or its summary does not name the gate's exit (tail: $(tail -3 "$T27.log" | tr '\n' '|'))"

  # With AIF_STRICT_RUNTIME=1, a RULE_GLOBS.appCode that matches nothing is named as such — without the
  # clause about R2's boundary, which matches and is not what the gate fails on (fourth cold review).
  T28=$(f11_project error none)
  cat > "$T28/eslint.config.mjs" <<'JS'
const RULE_GLOBS = {
  boundary: ['**/lib/**/*.ts'],
  appCode: ['**/nowhere/**/*.ts'],
  application: ['**/lib/**/*.ts'],
};

export default [{ files: RULE_GLOBS.boundary, rules: { 'no-console': 'error' } }];
JS
  export AIF_STRICT_RUNTIME=1
  f11_install "$T28" "$T28.log"
  OUT28=$(f11_gate "$T28"); RC28=$?
  unset AIF_STRICT_RUNTIME
  [ "$RC28" = "1" ] || bad "F11 strict zero-match: check:globs exited $RC28 — the arm below assumes the gate is red on appCode"
  grep -q 'RULE_GLOBS\.appCode matches none' <<<"$(f11_not_wired "$T28.log")" \
    && ok "F11 strict zero-match: the summary names RULE_GLOBS.appCode matching no source file" \
    || bad "F11 strict zero-match: the summary does not name RULE_GLOBS.appCode (summary: $(f11_not_wired "$T28.log" | tr '\n' '|'))"
  grep -q 'RULE_GLOBS\.boundary' <<<"$(f11_not_wired "$T28.log" | grep 'RULE_GLOBS\.appCode')" \
    && bad "F11 strict zero-match: the appCode line explains it by R2's boundary: $(f11_not_wired "$T28.log" | grep 'RULE_GLOBS\.appCode' | head -1)" \
    || ok "F11 strict zero-match: the appCode line says nothing about R2's boundary"

  # A root config of the consumer's with no RULE_GLOBS block and no getff custom rule: the gate reads the
  # workspace configs under it instead (_own_root_without_globs). A workspace RULE_GLOBS.boundary that
  # matches nothing fails every push; no R2 pass names it (no boundary code, so none ran) — the install
  # asks the gate whatever the root config says, and names the workspace config (F5, fourth cold review).
  f11_ws_project() { # $1 = the workspace's boundary glob
    local d; d=$(mktemp -d)
    printf '{ "name": "f11ws", "version": "0.0.0" }\n' > "$d/package.json"
    printf "export default [{ rules: { 'no-console': 'error' } }];\n" > "$d/eslint.config.mjs"
    mkdir -p "$d/packages/lib/src"
    echo 'export const x = 1;' > "$d/packages/lib/src/x.ts"
    cat > "$d/packages/lib/eslint.config.mjs" <<JS
const RULE_GLOBS = {
  boundary: ['$1'],
  appCode: ['**/src/**/*.ts'],
  application: ['**/src/**/*.ts'],
};

export default [{ files: RULE_GLOBS.boundary, rules: { 'no-console': 'error' } }];
JS
    printf '%s' "$d"
  }
  T29=$(f11_ws_project '**/nowhere/**/*.ts'); f11_install "$T29" "$T29.log"
  OUT29=$(f11_gate "$T29"); RC29=$?
  [ "$RC29" = "1" ] || bad "F11 workspace: check:globs exited $RC29 — the arm below assumes it is red on packages/lib (saw: $(printf '%s' "$OUT29" | grep -E '⚠|✗' | head -1))"
  grep -q 'RULE_GLOBS\.boundary' <<<"$(f11_push "$T29.log" | grep 'check-rule-globs.sh' | grep 'packages/lib/eslint.config.mjs')" \
    && ok "F11 workspace: the summary names packages/lib's RULE_GLOBS.boundary the gate fails on" \
    || bad "F11 workspace: check:globs fails every push on packages/lib while the summary does not name it (summary: $(f11_not_wired "$T29.log" | tr '\n' '|'))"
  # Paired negative: the same layout with a boundary glob that matches — the gate is green, strict or not.
  T29N=$(f11_ws_project '**/src/**/*.ts'); f11_install "$T29N" "$T29N.log"
  OUT29N=$( cd "$T29N" && AIF_STRICT_RUNTIME=1 bash scripts/check-rule-globs.sh 2>&1 ); RC29N=$?
  [ "$RC29N" = "0" ] || bad "F11 workspace green: check:globs exited $RC29N — the arm below assumes it passes (saw: $(printf '%s' "$OUT29N" | grep -E '⚠|✗' | head -1))"
  grep -qE 'check-rule-globs\.sh(, which runs on every push| fails on|.*AIF_STRICT_RUNTIME=1)' <<<"$(f11_not_wired "$T29N.log")" \
    && bad "F11 workspace green: the summary says the gate fails, though it passes: $(f11_not_wired "$T29N.log" | grep 'check-rule-globs.sh' | head -1)" \
    || ok "F11 workspace green: nothing about a gate that passes"

  # A recorded R2 N/A that no longer holds AND two packages whose own configs do not wire R2 over their
  # boundary files: the re-install drops the N/A (#1895, 60-ci.sh _r2_na_strip), so the gate fails on the
  # two packages alone, and the summary names each once and no «marked N/A» (F5, fourth cold review: the
  # gate's first line alone was named). Without the drop the gate fails «marked N/A» here too.
  # The strict run F11 asks prints four failure lines, in this order: apps/api and apps/web (each already
  # named by its own R2 pass, so F11 skips them), then RULE_GLOBS.appCode and .application (named by F11
  # alone). A loop that stopped at its first line would name neither key: F5's mixed multi-line case.
  T30=$(f11_project error boundary); mkdir -p "$T30/.ai-factory" "$T30/apps/web/src/routes" "$T30/apps/api/src/routes"
  printf '# Tool decisions\n\n<!-- aif:r2-na:begin -->\n### R2 N/A (recorded by an earlier install)\n<!-- aif:r2-na:end -->\n' > "$T30/.ai-factory/tool-decisions.md"
  printf 'export default [];\n' > "$T30/apps/web/eslint.config.mjs"
  echo 'export const page = 1;' > "$T30/apps/web/src/routes/page.ts"
  printf 'export default [];\n' > "$T30/apps/api/eslint.config.mjs"
  echo 'export const handler = 1;' > "$T30/apps/api/src/routes/users.ts"
  f11_install "$T30" "$T30.log"
  OUT30=$(f11_gate "$T30"); RC30=$?
  [ "$RC30" = "1" ] || bad "F11 N/A dropped, two packages left: check:globs exited $RC30 — the arm below assumes it is red"
  grep -q 'apps/web: has boundary files' <<<"$OUT30" && grep -q 'apps/api: has boundary files' <<<"$OUT30" \
    && ! grep -q 'marked N/A' <<<"$OUT30" \
    && ok "F11 N/A dropped, two packages left: the gate fails on apps/web and apps/api alone" \
    || bad "F11 N/A dropped, two packages left: expected the gate to fail on apps/web and apps/api and not on the N/A the install removed (saw: $(grep -E '⚠|✗' <<<"$OUT30" | tr '\n' '|'))"
  grep -q 'marked N/A' <<<"$(f11_push "$T30.log" | grep 'check-rule-globs.sh')" \
    && bad "F11 N/A dropped, two packages left: the summary names a «marked N/A» the install removed (summary: $(f11_not_wired "$T30.log" | tr '\n' '|'))" \
    || ok "F11 N/A dropped, two packages left: the summary names no «marked N/A»"
  for _p in apps/web apps/api; do
    # Both forms count: the earlier pass's «in <pkg>/eslint.config.…» AND F11's own «<pkg>: has boundary
    # files» line — a skip that stopped firing (setup.d/99-finalize.sh:107-109) names the package twice.
    _n=$(f11_push "$T30.log" | grep -cE "$_p(/|: )")
    [ "$_n" -eq 1 ] \
      && ok "F11 N/A dropped, two packages left: $_p is named once" \
      || bad "F11 N/A dropped, two packages left: $_p is named $_n times (summary: $(f11_not_wired "$T30.log" | tr '\n' '|'))"
  done
  # The mixed order holds only while the strict run lists a package line before the first key line; the
  # key arms below then read past two lines F11 skips.
  OUT30S=$( cd "$T30" && env -u ESLINT_CONFIG AIF_STRICT_RUNTIME=1 bash scripts/check-rule-globs.sh 2>&1 )
  _pkg_at=$(awk '/: has boundary files but its own ESLint config does NOT wire R2/ { print NR; exit }' <<<"$OUT30S")
  _key_at=$(awk '/no globs found under RULE_GLOBS\.(appCode|application)/ { print NR; exit }' <<<"$OUT30S")
  [ -n "$_pkg_at" ] && [ -n "$_key_at" ] && [ "$_pkg_at" -lt "$_key_at" ] \
    && ok "F11 N/A dropped, two packages left: the strict gate lists the package lines before the key lines" \
    || bad "F11 N/A dropped, two packages left: expected a package line before the first key line (gate: $(grep -E '⚠|✗' <<<"$OUT30S" | tr '\n' '|'))"
  for _k in appCode application; do
    _n=$(f11_strict "$T30.log" | grep 'check-rule-globs.sh' | grep -c "RULE_GLOBS\.$_k")
    [ "$_n" -eq 1 ] \
      && ok "F11 N/A dropped, two packages left: RULE_GLOBS.$_k, after the lines F11 skips, is named once" \
      || bad "F11 N/A dropped, two packages left: RULE_GLOBS.$_k named $_n times (gate: $(grep -E '⚠|✗' <<<"$OUT30S" | tr '\n' '|'); summary: $(f11_not_wired "$T30.log" | tr '\n' '|'))"
  done
  grep -iqE 'Add the rules-as-tests plugin|re-export the root|update the decision' <<<"$(f11_not_wired "$T30.log")" \
    && bad "F11 N/A dropped, two packages left: the summary hands on the gate's advice as a step: $(f11_not_wired "$T30.log" | grep -iE 'Add the|re-export|update the decision' | head -1)" \
    || ok "F11 N/A dropped, two packages left: no step handed on from the gate's output"
  # Every summary line F11 can now copy from the gate (strict, workspace, each failure line) against the
  # shared manual-step predicate — not a wording list of this file's own.
  for _l in "$T15" "$T16" "$T24" "$T25" "$T29" "$T30"; do f11_not_wired "$_l.log"; done > "$T30.summary"
  if asks_by_hand "$T30.summary"; then
    bad "F11: a NOT wired line hands the reader a step: $(manual_step_lines "$T30.summary" | head -1)"
  else
    ok "F11: no NOT wired line hands the reader a step (shared manual-step predicate)"
  fi

  if grep -qiE 'by hand|manually' <<<"$(cat "$T15.log" "$T16.log" "$T17.log" "$T18.log" "$T19.log" "$T20.log" "$T21.log" "$T22.log" "$T23.log" "$T24.log" "$T25.log" "$T26.log" "$T27.log" "$T28.log" "$T29.log" "$T29N.log" "$T30.log" | grep -iE 'eslint|R2|RULE_GLOBS')"; then
    bad "F11: the install asks for a manual edit: $(cat "$T15.log" "$T16.log" "$T17.log" "$T18.log" "$T19.log" "$T20.log" "$T21.log" "$T22.log" "$T23.log" "$T24.log" "$T25.log" "$T26.log" "$T27.log" "$T28.log" "$T29.log" "$T29N.log" "$T30.log" | grep -iE 'by hand|manually' | head -1)"
  else
    ok "F11: no install output asks for a manual ESLint edit"
  fi
  rm -rf "$T15" "$T16" "$T17" "$T18" "$T19" "$T20" "$T21" "$T22" "$T23" "$T24" "$T25" "$T26" "$T27" "$T28" "$T29" "$T29N" "$T30" \
    "$T15.log" "$T16.log" "$T17.log" "$T18.log" "$T19.log" "$T20.log" "$T21.log" "$T22.log" "$T23.log" "$T24.log" "$T25.log" "$T26.log" "$T27.log" "$T28.log" "$T29.log" "$T29N.log" "$T30.log" "$T30.summary"
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
