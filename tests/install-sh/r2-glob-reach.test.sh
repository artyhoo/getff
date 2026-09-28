#!/usr/bin/env bash
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
printf '%s' "$OUT" | grep -q "apps/api: has boundary files but its own ESLint config does NOT wire R2" \
  && ok "#2 POS: names the dead-config package as silently inert" \
  || bad "#2 POS: no per-package inertness message (saw: $(printf '%s' "$OUT" | tail -2 | tr '\n' '|'))"
printf '%s' "$OUT" | grep -q "R2 no-unsafe-zod-parse (RULE_GLOBS.boundary): matches ≥1 source file" \
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
printf '%s' "$OUT2" | grep -q "⚠ apps/api" \
  && ok "#2 NEG-a: re-export package gets a WARN (unverifiable coverage surfaced, not failed)" \
  || bad "#2 NEG-a: no WARN for the re-export package"

# NEG-b (load-bearing): a package whose own config WIRES R2 → silent (no warn, no fail).
T3=$(mktemp -d); install_into "$T3" ts-server
mkdir -p "$T3/apps/api/src/routes"; echo 'export const x=1;' > "$T3/apps/api/src/routes/u.ts"
printf "import r from './r.ts';\nexport default [{plugins:{'rules-as-tests':r},rules:{'rules-as-tests/no-unsafe-zod-parse':'error'}}];\n" > "$T3/apps/api/eslint.config.mjs"
OUT3=$(gate "$T3"); RC3=$?
if [ "$RC3" = "0" ] && ! printf '%s' "$OUT3" | grep -q "apps/api"; then
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
#    hyphenated file names) + paste-block has the check:lintstaged step; rc=0; consumer ci.yml intact.
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
grep -q "run: bash scripts/check-lintstaged-resolves.sh" "$LOG" \
  && ok "#1 POS-all: paste-block includes the check:lintstaged step" \
  || bad "#1 POS-all: paste-block missing the check:lintstaged step"
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
printf '%s' "$OUT5" | grep -q "newline in string" \
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
printf '%s' "$OUT6" | grep -q "no root-governed match" \
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
printf '%s' "$OUT7" | grep -q "⚠ apps/api" \
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
# A project that already had an eslint.config.mjs keeps it (copy_safe skip + report, operator
# decision 2026-09-23), so getff's RULE_GLOBS block and its rules never land there. The gate used
# to read that as «no globs found — check the config» and failed validate and the first push on
# every such project. There is no getff glob in such a config to verify: skip it and say why, the
# way check-rule-enforced.sh already does. A config that DOES carry getff's rules keeps the alarm.
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
printf '%s' "$OUT9" | grep -q "not wired into eslint.config.mjs" \
  && ok "own-config POS: the skip names what is not wired and where" \
  || bad "own-config POS: no 'not wired into eslint.config.mjs' report line (a silent skip hides the gap)"

# NEG-a: getff's own config shape with the boundary key gone is still the alarm.
T10=$(own_cfg_dir "const RULE_GLOBS = {
  appCode: ['**/*.{ts,tsx}'],
};
export default [];")
OUT10=$(repo_gate "$T10"); RC10=$?
[ "$RC10" = "1" ] && printf '%s' "$OUT10" | grep -q "no globs found under RULE_GLOBS.boundary" \
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

# Provenance of the skip message. getff's own react-native config wires none of R2/R7/R8 (the RN
# preset ships zero custom rules) and carries no RULE_GLOBS block, so it takes the same skip — but
# calling it «your own config, the install kept it» is false on a fresh RN install. The baseline
# manifest records what getff delivered; the message must follow it.
T12=$(own_cfg_dir "export default [];")
mkdir -p "$T12/.ai-factory"
printf '{\n  "eslint.config.mjs": "0000000000000000000000000000000000000000000000000000000000000000"\n}\n' \
  > "$T12/.ai-factory/refresh-baseline.json"
OUT12=$(repo_gate "$T12"); RC12=$?
[ "$RC12" = "0" ] && ! printf '%s' "$OUT12" | grep -q "your own config" \
  && printf '%s' "$OUT12" | grep -q "getff placed eslint.config.mjs" \
  && ok "own-config provenance: getff's own marker-less config is skipped as getff's, not called the consumer's" \
  || bad "own-config provenance: rc=$RC12, message misattributes getff's config (saw: $(printf '%s' "$OUT12" | head -1))"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
