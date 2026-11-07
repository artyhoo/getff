#!/usr/bin/env bash
# w2-stack-detect-by-files.test.sh — one-button W2 (stack-detect-by-files) paired-negative.
#
# Proves the W2 contract end-to-end, hermetically (no network; every fixture is a few bytes of
# package.json + config-file markers built in a mktemp dir, shaped by the §3.1 measurement of
# real `npm create astro@latest` / `npx sv create` scaffolds):
#
#   DETECTOR — _detect_stack_name (setup.d/lib.sh) names a stack from the project's FILES +
#   manifest keys with framework signals checked BEFORE generic dependency keys, and
#   _name_to_preset projects every name getff has no preset for onto `unknown` (= generic
#   downstream), never onto a preset whose shape the project does not have. The
#   wrong-shape falsifier: a SvelteKit app listing `typescript` is svelte-kit, NOT ts-server
#   (the pre-W2 detector answered ts-server — the RED this stage measured on the live scaffold).
#   The four npm presets keep their exact pre-W2 answers (regression guard), and a bare
#   scripts.astro KEY does not name astro (create-astro writes `"astro": "astro dev"` — the
#   file-only anchor is deliberate, so an astroSCRIPT cannot impersonate the framework).
#
#   GATE    — setup.d/80-rule-bootstrap.sh is gated on project_linter ∈ {eslint, oxlint} AND a
#   drivable scripts.lint, NOT on the stack. Gated-IN (named astro install + eslint config +
#   scripts.lint + seeded artefacts) reaches the dry-run LIVE line keyed by the NAME; each
#   gated-out case names its reason (biome / none / no-scripts.lint / no-package.json) and the
#   reason lands in the NOT-wired summary, not just stdout. A named install reads
#   <name>.{research,selection}.json and IGNORES generic.* artefacts (honest degrade).
#
#   E2E     — install.sh --dry-run on the fixtures: the named auto-detect line, the
#   generic-block detected-name line, the layer-80 reason in the real dispatcher flow, the
#   preset path byte-identical (no W2 line leaks into it), no-package.json → generic + its
#   reason, and --refresh naming the SAME stack a fresh install names (§3.2 consistency).
#
# Arms are independent and each can fail (T1/T14 non-vacuity): the NEG-shaped arms (wrong-shape
# falsifier, generic-artefact ignore, preset-line byte-identity) fail if the detector regresses
# to manifest-key-only or the preset path drifts; the POS-shaped arms fail if the W2 gate or
# name-keying is absent.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# ── fixture helpers ──────────────────────────────────────────────────────────
_mkpkg() { # <dir> <json> — write a fixture package.json
  mkdir -p "$1"
  printf '%s\n' "$2" > "$1/package.json"
}
_seed() { # <dir> <name> — seed <name>.{research,selection}.json (presence is all the layer checks)
  mkdir -p "$1/.ai-factory/rules-research"
  printf '{}\n' > "$1/.ai-factory/rules-research/$2.research.json"
  printf '{}\n' > "$1/.ai-factory/rules-research/$2.selection.json"
}
_detect() { # <dir> → "<name>/<preset>" via the lib.sh SSOT functions
  (
    export PKG_ROOT="$REPO_ROOT" PROJECT_ROOT="$1"
    # shellcheck source=/dev/null
    source "$REPO_ROOT/setup.d/lib.sh" 2>/dev/null || true
    local n; n=$(_detect_stack_name "$1")
    echo "$n/$(_name_to_preset "$n")"
  ) 2>/dev/null
}
_t_det() { # <dir> <expected name/preset> <label>
  local got; got=$(_detect "$1")
  [ "$got" = "$2" ] && ok "det: $3 → $got" || bad "det: $3 → got '$got' want '$2'"
}

# ── DETECTOR arms ────────────────────────────────────────────────────────────
echo "▶ W2 detector — _detect_stack_name / _name_to_preset (lib.sh SSOT)"

A=$(mktemp -d); _mkpkg "$A" '{"name":"a","dependencies":{"astro":"^5.0.0"}}'; touch "$A/astro.config.mjs"
_t_det "$A" "astro/unknown" "astro.config.mjs file names astro (file anchor)"

SK=$(mktemp -d); _mkpkg "$SK" '{"name":"sk","dependencies":{"@sveltejs/kit":"^2.0.0"},"devDependencies":{"typescript":"^5.0.0"}}'
_t_det "$SK" "svelte-kit/unknown" "@sveltejs/kit + typescript keys (wrong-shape falsifier: pre-W2 said ts-server)"

SKF=$(mktemp -d); _mkpkg "$SKF" '{"name":"skf","devDependencies":{"typescript":"^5.0.0"}}'; touch "$SKF/svelte.config.js"; mkdir -p "$SKF/src/routes"
_t_det "$SKF" "svelte-kit/unknown" "svelte.config.js + src/routes (files only, no kit key)"

SV=$(mktemp -d); _mkpkg "$SV" '{"name":"sv","dependencies":{"svelte":"^5.0.0"}}'; touch "$SV/svelte.config.js"
_t_det "$SV" "svelte/unknown" "svelte.config.js without routes (plain svelte)"

# the four npm presets: exact pre-W2 answers (regression guard)
NX=$(mktemp -d); _mkpkg "$NX" '{"name":"nx","dependencies":{"next":"15.0.0","react":"^19.0.0","typescript":"^5.0.0"}}'
_t_det "$NX" "react-next/react-next" "next key (preset unchanged)"
TS=$(mktemp -d); _mkpkg "$TS" '{"name":"ts","devDependencies":{"typescript":"^5.0.0"}}'
_t_det "$TS" "ts-server/ts-server" "typescript key (preset unchanged)"
RN=$(mktemp -d); _mkpkg "$RN" '{"name":"rn","dependencies":{"react-native":"0.76.0","typescript":"^5.0.0"}}'
_t_det "$RN" "react-native/react-native" "react-native key (preset unchanged)"
RE=$(mktemp -d); _mkpkg "$RE" '{"name":"re","dependencies":{"react":"^19.0.0"}}'
_t_det "$RE" "react-spa/react-spa" "react key (preset unchanged)"

UN=$(mktemp -d); _mkpkg "$UN" '{"name":"un","dependencies":{"lodash":"4.17.21"}}'
_t_det "$UN" "unknown/unknown" "no known signal"
NOPKG=$(mktemp -d)
_t_det "$NOPKG" "unknown/unknown" "no package.json"
ASK=$(mktemp -d); _mkpkg "$ASK" '{"name":"as","scripts":{"astro":"astro dev"}}'
_t_det "$ASK" "unknown/unknown" "scripts.astro KEY alone does not name astro (measured create-astro shape)"

# ── GATE arms (b1-style sourcing of the layer under --dry-run) ───────────────
echo ""; echo "▶ W2 gate — 80-rule-bootstrap linter+lint-command entry condition"

_run80() { # <project-root> [VAR=value ...] — source the layer in dispatcher scope, capture stdout
  local _pr="$1"; shift
  (
    export PKG_ROOT="$REPO_ROOT" PROJECT_ROOT="$_pr" FULL="1" DRY_RUN="--dry-run"
    export "$@"
    # shellcheck source=/dev/null
    source "$REPO_ROOT/setup.d/lib.sh" 2>/dev/null || true
    # shellcheck source=/dev/null
    source "$REPO_ROOT/setup.d/80-rule-bootstrap.sh" 2>&1
    echo "__NOT_WIRED__"
    printf '%s\n' ${NOT_WIRED[@]+"${NOT_WIRED[@]}"}
  ) 2>&1
}

# gated-IN: named astro install, drivable lint, seeded astro artefacts → the dry-run LIVE line
G1=$(mktemp -d); _mkpkg "$G1" '{"name":"g1","scripts":{"lint":"eslint ."},"dependencies":{"astro":"^5.0.0"}}'
touch "$G1/astro.config.mjs" "$G1/eslint.config.mjs"; _seed "$G1" astro
out=$(_run80 "$G1" STACK_NAME=astro STACK=generic)
if grep -q "would: run rule-bootstrap LIVE" <<<"$out" && ! grep -qF "generated rules — not run" <<<"$out"; then
  ok "gate-in: named astro + eslint + scripts.lint + artefacts → LIVE dry-run"
else
  bad "gate-in: unexpected: $(echo "$out" | tr '\n' '|' | head -c 200)"
fi

# gated-IN without STACK_NAME exported (stand-alone sourcing compat): falls back to $STACK
G2=$(mktemp -d); _mkpkg "$G2" '{"name":"g2","scripts":{"lint":"eslint ."}}'; touch "$G2/eslint.config.mjs"; _seed "$G2" react-next
out=$(_run80 "$G2" STACK=react-next)
grep -q "would: run rule-bootstrap LIVE" <<<"$out" \
  && ok "gate-in: preset install without STACK_NAME keeps the \$STACK key" \
  || bad "gate-in preset: $(echo "$out" | tr '\n' '|' | head -c 200)"

# gated-OUT: eslint config but NO scripts.lint → reason + detected name, in stdout AND NOT-wired
G3=$(mktemp -d); _mkpkg "$G3" '{"name":"g3","dependencies":{"astro":"^5.0.0"}}'
touch "$G3/astro.config.mjs" "$G3/eslint.config.mjs"; _seed "$G3" astro
out=$(_run80 "$G3" STACK_NAME=astro STACK=generic)
if grep -qF "no lint command in package.json (scripts.lint) for the proof to drive" <<<"$out" \
   && grep -qF "detected stack: astro" <<<"$out" \
   && grep -qF "no lint command in package.json (scripts.lint)" <<<"$(sed -n '/^__NOT_WIRED__$/,$p' <<<"$out")"; then
  ok "gate-nolint: eslint config without scripts.lint → reason + name, and the NOT-wired summary carries it"
else
  bad "gate-nolint: $(echo "$out" | tr '\n' '|' | head -c 200)"
fi

# gated-OUT: biome — the reason locates the gap in getff (no GritQL output lane), NOT in Biome
# (operator fork-2 decision 2026-10-06: Biome CAN hold generated rules as GritQL plugins)
G4=$(mktemp -d); _mkpkg "$G4" '{"name":"g4","scripts":{"lint":"biome check ."}}'; touch "$G4/biome.json"
out=$(_run80 "$G4" STACK_NAME=generic STACK=generic)
grep -qF "has no GritQL output lane for Biome" <<<"$out" \
  && ok "gate-biome: getff-side GritQL reason fires" \
  || bad "gate-biome: $(echo "$out" | tr '\n' '|' | head -c 200)"

# gated-OUT: linter none (no script naming one, no config file)
G5=$(mktemp -d); _mkpkg "$G5" '{"name":"g5","version":"0.0.0"}'
out=$(_run80 "$G5" STACK_NAME=generic STACK=generic)
grep -qF "no ESLint or oxlint in this project" <<<"$out" \
  && ok "gate-none: no-linter reason fires" \
  || bad "gate-none: $(echo "$out" | tr '\n' '|' | head -c 200)"

# gated-OUT: no package.json
G6=$(mktemp -d)
out=$(_run80 "$G6" STACK_NAME=generic STACK=generic)
grep -qF "no package.json, so there is no lint command" <<<"$out" \
  && ok "gate-nopkg: no-package reason fires" \
  || bad "gate-nopkg: $(echo "$out" | tr '\n' '|' | head -c 200)"

# name-keyed artefacts: svelte-kit reads svelte-kit.*; a named install ignores generic.*
G7=$(mktemp -d); _mkpkg "$G7" '{"name":"g7","scripts":{"lint":"eslint ."},"dependencies":{"@sveltejs/kit":"^2.0.0"}}'; _seed "$G7" svelte-kit
out=$(_run80 "$G7" STACK_NAME=svelte-kit STACK=generic)
grep -q "would: run rule-bootstrap LIVE" <<<"$out" \
  && ok "name-key: svelte-kit install reads svelte-kit.* artefacts" \
  || bad "name-key svelte-kit: $(echo "$out" | tr '\n' '|' | head -c 200)"
G8=$(mktemp -d); _mkpkg "$G8" '{"name":"g8","scripts":{"lint":"eslint ."},"dependencies":{"astro":"^5.0.0"}}'
touch "$G8/astro.config.mjs"; _seed "$G8" generic
out=$(_run80 "$G8" STACK_NAME=astro STACK=generic)
grep -q "no rules-research artefacts" <<<"$out" \
  && ok "name-key: astro install IGNORES generic.* artefacts (honest degrade)" \
  || bad "name-key generic-ignore: $(echo "$out" | tr '\n' '|' | head -c 200)"

# ── DELIVERY arms (40-configs generic carve-out: the proof tooling ships on the same
#    drivability gate layer 80 uses, and never ships to an undrivable project) ──
echo ""; echo "▶ W2 delivery — 40-configs generic carve-out (prove-rules + mutation script)"

_run40() { # <project-root> [VAR=value ...] — source 40-configs in dispatcher scope, print NOT_WIRED
  local _pr="$1"; shift
  (
    export PKG_ROOT="$REPO_ROOT" PROJECT_ROOT="$_pr" STACK="generic" DRY_RUN="" FORCE=""
    export "$@"
    # shellcheck source=/dev/null
    source "$REPO_ROOT/setup.d/lib.sh" 2>/dev/null || true
    # shellcheck source=/dev/null
    source "$REPO_ROOT/setup.d/40-configs.sh" >/dev/null 2>&1
    printf '%s\n' ${NOT_WIRED[@]+"${NOT_WIRED[@]}"}
  )
}

# drivable generic (eslint + scripts.lint): both lane scripts + the plugin dir the
# generated carrier's wrapper imports (#829) ship
D1=$(mktemp -d); _mkpkg "$D1" '{"name":"d1","scripts":{"lint":"eslint ."}}'; touch "$D1/eslint.config.mjs"
_run40 "$D1" STACK_NAME=svelte-kit
if [ -f "$D1/scripts/prove-rules.mjs" ] && [ -f "$D1/scripts/run-generated-rule-mutation.sh" ]; then
  ok "deliver-in: drivable generic (eslint + scripts.lint) gets prove-rules.mjs + run-generated-rule-mutation.sh"
else
  bad "deliver-in: drivable generic missing lane scripts (prove=$([ -f "$D1/scripts/prove-rules.mjs" ] && echo y || echo n) mut=$([ -f "$D1/scripts/run-generated-rule-mutation.sh" ] && echo y || echo n))"
fi
if [ -f "$D1/eslint-rules-local/index.mjs" ] && grep -q "restricted-syntax-audit-exempt" "$D1/eslint-rules-local/index.mjs" \
   && [ -f "$D1/eslint-rules-local/restricted-syntax-audit-exempt.mjs" ]; then
  ok "deliver-in: the eslint-rules-local plugin dir + barrel ship (the wrapper's #829 import resolves)"
else
  bad "deliver-in: plugin dir incomplete (barrel=$([ -f "$D1/eslint-rules-local/index.mjs" ] && echo y || echo n))"
fi

# no lint command (layer-80 G3 shape): the gate that never runs gets no tooling
D2=$(mktemp -d); _mkpkg "$D2" '{"name":"d2","dependencies":{"astro":"^5.0.0"}}'; touch "$D2/astro.config.mjs" "$D2/eslint.config.mjs"
_run40 "$D2" STACK_NAME=astro
[ ! -f "$D2/scripts/prove-rules.mjs" ] && [ ! -f "$D2/scripts/run-generated-rule-mutation.sh" ] && [ ! -e "$D2/eslint-rules-local" ] \
  && ok "deliver-nolint: no scripts.lint → no lane scripts, no plugin dir" \
  || bad "deliver-nolint: tooling shipped to an undrivable project"

# biome (layer-80 G4 shape): not a drivable lane for ESLint-format rules — no tooling
D3=$(mktemp -d); _mkpkg "$D3" '{"name":"d3","scripts":{"lint":"biome check ."}}'; touch "$D3/biome.json"
_run40 "$D3" STACK_NAME=generic
[ ! -f "$D3/scripts/prove-rules.mjs" ] && [ ! -e "$D3/eslint-rules-local" ] \
  && ok "deliver-biome: biome project gets no lane scripts, no plugin dir" \
  || bad "deliver-biome: tooling shipped to a biome project"

# no linter at all (layer-80 G5 shape): no tooling
D4=$(mktemp -d); _mkpkg "$D4" '{"name":"d4","version":"0.0.0"}'
_run40 "$D4" STACK_NAME=generic
[ ! -f "$D4/scripts/prove-rules.mjs" ] && [ ! -e "$D4/eslint-rules-local" ] \
  && ok "deliver-none: no-linter project gets no lane scripts, no plugin dir" \
  || bad "deliver-none: tooling shipped to a no-linter project"

# the P2 G1 generic note still fires (fork-1: getff places none of ITS configs)
out=$(_run40 "$D1" STACK_NAME=svelte-kit)
grep -qF "not placed: stack «generic» has no getff preset" <<<"$out" \
  && ok "deliver-note: P2 G1 generic configs note unchanged" \
  || bad "deliver-note: P2 G1 note missing"
unset -f _run40 2>/dev/null || true

# ── E2E arms (real install.sh --dry-run on the fixture dirs) ─────────────────
echo ""; echo "▶ W2 e2e — install.sh --dry-run dispatcher flow"

# astro default scaffold (§3.1 measured: no lint command, no eslint config)
out=$(cd "$A" && bash "$REPO_ROOT/install.sh" --dry-run 2>&1); rc=$?
grep -qF "Detected stack astro from the project's files — no getff preset for it → the stack-free part (generic)" <<<"$out" \
  && ok "e2e-astro: named auto-detect line" || bad "e2e-astro: detect line missing"
grep -qF "detected stack: astro (named from the project's files; getff has no preset for it)" <<<"$out" \
  && ok "e2e-astro: generic-block detected-name line" || bad "e2e-astro: name line missing"
grep -qF "generated rules — not run: no ESLint or oxlint in this project" <<<"$out" \
  && ok "e2e-astro: layer-80 'none' reason in dispatcher flow" || bad "e2e-astro: layer-80 reason missing"
[ "$rc" -eq 0 ] && ok "e2e-astro: exit 0" || bad "e2e-astro: exit $rc"

# svelte-kit + eslint add-on (§3.1 measured sv-kit-eslint shape): lint command present → NOT gated out
S=$(mktemp -d); _mkpkg "$S" '{"name":"sv","scripts":{"lint":"eslint .","check":"svelte-kit sync && svelte-check"},"dependencies":{"@sveltejs/kit":"^2.0.0"},"devDependencies":{"eslint":"^9.0.0","typescript":"^5.0.0"}}'
touch "$S/eslint.config.js"
out=$(cd "$S" && bash "$REPO_ROOT/install.sh" --dry-run --full 2>&1); rc=$?
grep -qF "Detected stack svelte-kit from the project's files" <<<"$out" \
  && ok "e2e-svkit: named auto-detect line" || bad "e2e-svkit: detect line missing"
grep -qF "generated rules — not run: no lint command" <<<"$out" \
  && bad "e2e-svkit: WRONGLY gated out (scripts.lint exists)" \
  || ok "e2e-svkit: not gated out (lint command present)"
grep -qF "no rules-research artefacts" <<<"$out" \
  && ok "e2e-svkit: --full artefact degrade fires (none seeded)" || bad "e2e-svkit: artefact degrade missing"
grep -qF "would check svelte-kit rules-research artefacts" <<<"$out" \
  && ok "e2e-svkit: D3 notice names svelte-kit (99-finalize rekey)" || bad "e2e-svkit: D3 notice key wrong"
[ "$rc" -eq 0 ] && ok "e2e-svkit: exit 0" || bad "e2e-svkit: exit $rc"

# ts-server preset: the pre-W2 auto-detect line byte-identical, no W2 line leaks in
out=$(cd "$TS" && bash "$REPO_ROOT/install.sh" --dry-run 2>&1); rc=$?
grep -qF "Auto-detected stack from package.json: ts-server" <<<"$out" \
  && ok "e2e-ts: preset auto-detect line byte-identical" || bad "e2e-ts: preset line changed"
grep -qF "detected stack:" <<<"$out" \
  && bad "e2e-ts: W2 name line leaked into the preset path" \
  || ok "e2e-ts: no W2 name line on the preset path"
[ "$rc" -eq 0 ] && ok "e2e-ts: exit 0" || bad "e2e-ts: exit $rc"

# no package.json → generic (stack-free) + the layer-80 no-package reason
out=$(cd "$NOPKG" && bash "$REPO_ROOT/install.sh" --dry-run 2>&1); rc=$?
grep -qF "stack: generic — stack-free part only" <<<"$out" \
  && ok "e2e-nopkg: generic stack line" || bad "e2e-nopkg: generic line missing"
grep -qF "no package.json, so there is no lint command" <<<"$out" \
  && ok "e2e-nopkg: layer-80 no-package reason" || bad "e2e-nopkg: layer-80 reason missing"
[ "$rc" -eq 0 ] && ok "e2e-nopkg: exit 0" || bad "e2e-nopkg: exit $rc"

# --refresh names the SAME stack a fresh install names (§3.2 refresh-consistency falsifier)
out=$(cd "$A" && bash "$REPO_ROOT/install.sh" --refresh --dry-run 2>&1); rc=$?
grep -qE "detected stack: astro|Detected stack astro" <<<"$out" \
  && ok "e2e-refresh: refresh names astro (fresh == refresh)" \
  || bad "e2e-refresh: name missing on refresh — $(grep -i 'stack' <<<"$out" | tr '\n' '|')"
[ "$rc" -eq 0 ] && ok "e2e-refresh: exit 0" || bad "e2e-refresh: exit $rc"

# --refresh on a COMPLETED W2 install (the 40-configs carve-out placed eslint-rules-local/): the
# barrel is NOT a ts-server passport (a pre-W2 refresh read it as one and re-detected the
# wrong-shape preset on a drivable generic install — fresh svelte-kit ≠ refresh ts-server). The
# placed answer that IS still a passport: preset installs keep their preset on refresh.
W2=$(mktemp -d)
_mkpkg "$W2" '{"name":"sv","scripts":{"lint":"eslint .","check":"svelte-kit sync && svelte-check"},"dependencies":{"@sveltejs/kit":"^2.0.0"},"devDependencies":{"eslint":"^9.0.0","typescript":"^5.0.0"}}'
touch "$W2/eslint.config.js"
mkdir -p "$W2/eslint-rules-local"; printf 'export {};\n' > "$W2/eslint-rules-local/index.mjs"
out=$(cd "$W2" && bash "$REPO_ROOT/install.sh" --refresh --dry-run 2>&1); rc=$?
_refresh_line=$(grep -F "Refreshing rules-as-tests-aif framework artefacts" <<<"$out" || true)
case "$_refresh_line" in
  *"ts-server"*) bad "e2e-refresh-w2: barrel read as a ts-server passport — $_refresh_line" ;;
  *"stack: generic"*) ok "e2e-refresh-w2: barrel is not a passport — refresh stays generic" ;;
  *) bad "e2e-refresh-w2: refresh stack line missing — $(grep -i 'stack' <<<"$out" | tr '\n' '|')" ;;
esac
grep -qE "detected stack: svelte-kit|Detected stack svelte-kit" <<<"$out" \
  && ok "e2e-refresh-w2: refresh names svelte-kit (fresh == refresh)" \
  || bad "e2e-refresh-w2: name missing on refresh — $(grep -i 'stack' <<<"$out" | tr '\n' '|')"
[ "$rc" -eq 0 ] && ok "e2e-refresh-w2: exit 0" || bad "e2e-refresh-w2: exit $rc"

# the NEG twin: real preset passports STILL prove their preset on refresh (the fix must not have
# over-corrected into reading every refresh as generic)
TSW=$(mktemp -d)
_mkpkg "$TSW" '{"name":"ts","devDependencies":{"typescript":"^5.0.0"}}'
mkdir -p "$TSW/.ai-factory" "$TSW/packages/core/hooks" "$TSW/eslint-rules-local"
touch "$TSW/.ai-factory/ARCHITECTURE.ts-server.md" "$TSW/packages/core/hooks/pre-push.bundle.mjs" "$TSW/eslint-rules-local/index.mjs"
out=$(cd "$TSW" && bash "$REPO_ROOT/install.sh" --refresh --dry-run 2>&1); rc=$?
grep -qF "(stack: ts-server)" <<<"$out" \
  && ok "e2e-refresh-preset: placed ts-server passports keep the preset" \
  || bad "e2e-refresh-preset: preset passports lost — $(grep -i 'Refreshing' <<<"$out")"
[ "$rc" -eq 0 ] && ok "e2e-refresh-preset: exit 0" || bad "e2e-refresh-preset: exit $rc"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
