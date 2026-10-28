#!/usr/bin/env bash
# docs001003-delivery-contract.test.sh — the DOCS001/DOCS003 paired-behavior fixture.
#
# The docs corrections (site pages, INSTALL-FOR-AI, face-facts) claim a specific DELIVERY
# contract. Source-string assertions elsewhere prove the claims are written down; this test
# proves the real installer dispatcher HONORS them, end to end, on real install.sh routes
# with stubbed external tools (no network, no machine-global effects, no real npm/claude).
#
# Control groups (the docs claims each group falsifies):
#   G0  recorder proof — every stub is a real recording script BEFORE any zero-call
#       assertion relies on it: an actual call records + answers its version probe;
#       an uncalled tool leaves no calls file.
#   G1  npm lane via ./setup -y ts-server --profile core — the shipped wrapper IS the
#       documented one-shot route (setup:53: its -y sets the --full carrier; INSTALL-FOR-AI:422
#       names ./setup -y / --full as one full-install path). CORE roster + the two every-lane
#       hooks; NO env/factory roster, NO harvest, NO residue pair, NO ci-sweep script; the
#       project .mcp.json (context7+deepwiki) lands — on the npm lane a --full-carrier effect
#       (setup.d/05-mcp.sh:13 gates the whole layer on FULL) — and the Codex native
#       definitions (.codex/hooks.json) are generated with node on PATH.
#   G2  ./setup -y ts-server --profile env — env roster + the residue pair land; harvest
#       still absent; AIF_HANDOFF_GATE stays unset (an ask row, never install-armed).
#   G3  ./setup -y --profile factory AND legacy ./setup -y --with-aif-suite — factory roster
#       incl. intent, harvest, residue pair, run-local-ci-sweep.sh; gate still unarmed.
#   G4  python/cargo/go lanes at ALL FOUR dispatcher depths (core/env/factory/legacy) —
#       install.sh:733-745 exits the toolchain body BEFORE the npm skills layer: the
#       curated 4-skill/2-agent surface + project .mcp.json + fenced AGENTS.md +
#       .ai-factory/ + lane scripts arrive, and NO npm env/factory roster, residue pair
#       or ci-sweep lands even at factory depth (the flag resolves — "[profile] factory"
#       prints — but cannot reach the npm-gated payload on a thin lane; legacy = no
#       --profile flag, the non-TTY -y default route).
#       Per-route canonical agent contract (DOCS-R4-FIXTURE-DELIVERED-AGENT-EXPECTATION):
#       cargo/go deliver agents/rule-researcher.md byte-identical; python delivers the
#       canonical ROLE .agents/roles/rule-researcher.md through the documented
#       transform_internal_refs link rewrite (45-python.sh:1774 → lib.sh:218-270) —
#       asserted as equality modulo link targets, with zero dangling ](../ refs left.
#   G5  native binding: no node on PATH → the dependency-specific notice
#       'Codex hooks not wired: node is not on PATH' (portable-bindings.sh:404) and NO
#       .codex/hooks.json, install still completes; a consumer's pre-existing custom
#       .claude/settings.json hook definition survives; WITH node, a consumer-owned
#       custom .codex/hooks.json is kept (never clobbered) and the shared adapter still
#       lands (portable-bindings.sh:385-427).
#   G6  global consent via the wrapper (it owns the companion loop — engine.sh; kind=mcp
#       rows are handled inside install.sh's 05-mcp layer): plain ./setup -y makes ZERO
#       machine-global stub calls (claude plugin/mcp, npm -g) and prints the machine-global
#       skip notice (engine.sh:293-295); ./setup -y --global permits exactly the intended
#       stub calls; the project .mcp.json (context7+deepwiki) is written in BOTH arms and a
#       pre-existing custom mcpServer entry survives the additive merge — project wiring is
#       distinct from user-scope registration.
#
# Method (same shape as aif-guided-install-gating.test.sh): the REAL install.sh runs as a
# subprocess inside fresh mktemp fixtures, env -i with a curated PATH of symlinked real tools
# plus recording stubs (npm/claude/python3/cargo/go). Every machine-global effect the installer
# can have lands in $STUB_STATE and is asserted on directly, so "no global effects" is measured.
#
# Scratch contract (R5): fresh unique mktemp root, a distinct unique state/home dir per run,
# NO cleanup trap and NO rm — every scratch dir is kept on disk as run evidence.
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

SB=$(mktemp -d "${TMPDIR:-/tmp}/docs001003-dc.XXXXXX")
echo "scratch root (kept as evidence): $SB"
RUN_SEQ=0
mkdir -p "$SB/bin" "$SB/bin-nonode"

# ── Recording stubs: real scripts consuming their heredoc bodies (stdin), not argv ──
# DOCS-R4-FIXTURE-STUB-RECORDING: the previous mkstub shifted its only argument and
# discarded the stdin body, leaving 1-byte stubs that recorded nothing. Bodies are now
# written with cat from the heredoc — each stub records every invocation and answers
# the probes the installer actually makes.
mkstub() { # mkstub <name>  (body arrives on stdin)
  cat > "$SB/bin/$1"
  chmod +x "$SB/bin/$1"
}
mkstub npm <<'EOF'
#!/bin/sh
echo "npm $*" >> "$STUB_STATE/npm.calls"
case "$1" in
  --version) echo "10.5.0" ;;
  install)
    # The 70-deps CORE_DEVDEPS install is the one stubbed call whose effect the install's
    # self-verify load-probe genuinely consumes: the delivered eslint.config.mjs imports
    # @vitest/eslint-plugin, the single package the repo tree itself lacks (the fixture's
    # node_modules links cover the rest of the chain). Materialize a minimal stand-in INSIDE
    # the fixture-owned node_modules — never through a symlink, never into the repo tree.
    case " $* " in
      *"@vitest/eslint-plugin"*)
        if [ -d "$PWD/node_modules" ] && [ ! -L "$PWD/node_modules" ] \
           && { [ ! -e "$PWD/node_modules/@vitest" ] || [ ! -L "$PWD/node_modules/@vitest" ]; }; then
          mkdir -p "$PWD/node_modules/@vitest/eslint-plugin"
          printf '{"name":"@vitest/eslint-plugin","version":"1.6.20","main":"index.cjs"}\n' \
            > "$PWD/node_modules/@vitest/eslint-plugin/package.json"
          printf 'module.exports = { rules: {}, configs: { recommended: { rules: {} } } };\n' \
            > "$PWD/node_modules/@vitest/eslint-plugin/index.cjs"
        fi
        ;;
    esac
    ;;
esac
exit 0
EOF
mkstub claude <<'EOF'
#!/bin/sh
echo "claude $*" >> "$STUB_STATE/claude.calls"
case "$1" in
  --version) echo "2.0.31 (Claude Code)" ;;
esac
case "$1 $2" in
  "plugin list") echo "(no plugins installed)";;
esac
exit 0
EOF
mkstub python3 <<'EOF'
#!/bin/sh
echo "python3 $*" >> "$STUB_STATE/python3.calls"
case "$1" in --version) echo "Python 3.12.0";; version) echo "Python 3.12.0";; esac
exit 0
EOF
mkstub cargo <<'EOF'
#!/bin/sh
echo "cargo $*" >> "$STUB_STATE/cargo.calls"
case "$1" in --version) echo "cargo 1.77.0";; version) echo "cargo 1.77.0";; esac
exit 0
EOF
mkstub go <<'EOF'
#!/bin/sh
echo "go $*" >> "$STUB_STATE/go.calls"
case "$1" in version) echo "go version go1.22.0 darwin/arm64";; esac
exit 0
EOF

# ── Curated PATH: real local tools, symlinked (env -i means PATH is exactly this dir) ──
for b in bash sh sed grep awk cat cp mv mkdir rm touch tr cut sort head tail date dirname basename git node jq curl chmod ln readlink uname env printf find mktemp xargs diff cmp wc stat; do
  p=$(command -v "$b" 2>/dev/null) || continue
  ln -sf "$p" "$SB/bin/$b"
done
# bin-nonode: the G5 missing-Node arm — the real tools WITHOUT node. Built before the
# stub overwrite below, so its symlinks resolve real binaries; the stubs (regular files)
# are deliberately absent here: the ts-server lane degrades on a missing claude/npm CLI
# exactly like a real machine without them.
for b in bash sh sed grep awk cat cp mv mkdir rm touch tr cut sort head tail date dirname basename git jq curl chmod ln readlink uname env printf find mktemp xargs diff cmp wc stat; do
  p=$(command -v "$b" 2>/dev/null) || continue
  ln -sf "$p" "$SB/bin-nonode/$b"
done

# ── G0: recorder proof — the stubs must record and answer BEFORE zero-call assertions ──
echo "── G0: recorder proof — stubs actually record calls and answer probes ──"
ST="$SB/state-g0"; mkdir -p "$ST"
if STUB_STATE="$ST" "$SB/bin/npm" --version > "$ST/npm-v.out" 2>&1 && grep -q '^10\.5\.0$' "$ST/npm-v.out"; then
  ok "G0: npm stub answers --version (10.5.0)"
else bad "G0: npm stub version probe failed ($(cat "$ST/npm-v.out" 2>/dev/null | tr '\n' '|'))"; fi
if [ -f "$ST/npm.calls" ] && grep -q -- '--version' "$ST/npm.calls"; then
  ok "G0: recorder positive — npm call recorded in npm.calls"
else bad "G0: recorder positive FAILED — npm.calls missing/empty"; fi
if STUB_STATE="$ST" "$SB/bin/claude" plugin list > "$ST/claude-list.out" 2>&1 && grep -q '(no plugins installed)' "$ST/claude-list.out"; then
  ok "G0: claude stub answers 'plugin list' (empty plugin set)"
else bad "G0: claude stub plugin-list probe failed"; fi
if [ ! -f "$ST/go.calls" ]; then
  ok "G0: recorder negative — go.calls absent without any go invocation"
else bad "G0: recorder negative FAILED — go.calls exists without a go call"; fi

# ── Fixture + runner ──
# Third arg "npm": give the fixture a REAL node_modules directory whose entries are links into
# the repo's node_modules. The recording npm stub cannot really run the CORE_DEVDEPS install
# (70-deps.sh:206-212: eslint, typescript-eslint, @eslint/js, globals, prettier,
# eslint-config-prettier, @vitest/eslint-plugin, ts-morph, tsx …) that a live `./setup -y`
# performs, yet the install's self-verify demands exactly that floor: the eslint-ignores wirer
# resolves ts-morph from the PROJECT root (eslint-wire.sh:32) and the load-probe arm must IMPORT
# the delivered eslint.config.mjs (its import chain is that devdeps list). Per-entry links —
# not one top-level symlink — because the npm stub must be able to materialize the ONE package
# the repo tree itself lacks (@vitest/eslint-plugin) inside the fixture-owned dir; the stub
# never writes into the linked entries, so the scope-symlink deletion hazard does not apply.
new_fixture() { # new_fixture <name> [lane-marker] [npm]
  local fx="$SB/fx-$1"; mkdir -p "$fx/.claude"
  printf '{"name":"delivery-contract-'$1'","version":"0.0.0"}\n' > "$fx/package.json"
  if [ "${3:-}" = npm ]; then
    mkdir -p "$fx/node_modules"
    local e s
    for e in "$REPO_ROOT"/node_modules/* "$REPO_ROOT"/node_modules/.*; do
      case "$(basename "$e")" in .|..) continue ;; esac
      if [ -e "$e" ]; then
        # @scope dirs become REAL fixture dirs with per-child links (never a scope-level
        # symlink): the npm stub must add @vitest/eslint-plugin next to the linked children
        # without ever writing through a link into the repo tree.
        case "$e" in */@*)
          mkdir -p "$fx/node_modules/$(basename "$e")"
          for s in "$e"/*; do [ -e "$s" ] && ln -s "$s" "$fx/node_modules/$(basename "$e")/$(basename "$s")"; done
          ;;
        *) ln -s "$e" "$fx/node_modules/$(basename "$e")" ;;
        esac
      fi
    done
  fi
  case "${2:-}" in
    python) printf '[project]\nname = "delivery-contract-py"\nversion = "0.0.0"\n' > "$fx/pyproject.toml" ;;
    cargo)  printf '[package]\nname = "delivery-contract-cargo"\nversion = "0.0.0"\n' > "$fx/Cargo.toml" ;;
    go)     printf 'module example.com/deliverycontract\n\ngo 1.22\n' > "$fx/go.mod" ;;
  esac
  ( cd "$fx" && git init -q && git config user.email t@t.local && git config user.name T ) >/dev/null 2>&1
  echo "$fx"
}

# run_install <label> <bin-dir> <fixture> [env VAR=V …] -- <install.sh args…>
# Fresh unique state+home per call (R5 no-cleanup contract: no rm, dirs kept as evidence).
run_install() {
  local label="$1" bindir="$2" fixture="$3"; shift 3
  local -a envs=()
  while [ "$1" != "--" ]; do envs+=("$1"); shift; done
  shift
  RUN_SEQ=$((RUN_SEQ+1))
  ST="$SB/state-$label-r$RUN_SEQ"; mkdir -p "$ST"
  # ${envs[@]+"${envs[@]}"} — the bash-3.2 empty-array-under-set-u idiom (same as install.sh's
  # ${_REFRESH_LANES[@]+"${_REFRESH_LANES[@]}"}): an empty env list must expand to nothing.
  ( cd "$fixture" && env -i \
      PATH="$bindir" HOME="$SB/home-$label-r$RUN_SEQ" STUB_STATE="$ST" \
      RUNTIME_BRIDGE_AIF_URL="http://127.0.0.1:59099" \
      AIF_HANDOFF_REPO_URL="https://example.invalid/aif-handoff.git" \
      ${envs[@]+"${envs[@]}"} \
      bash "$REPO_ROOT/install.sh" "$@" -y --force < /dev/null ) > "$ST/install.log" 2>&1
  RC=$?
  [ "$RC" -eq 0 ] || bad "$label: install.sh exited with rc=$RC"
  SET="$fixture/.claude/settings.json"
}

# run_setup <label> <bin-dir> <fixture> [env VAR=V …] -- <setup args…> — the shipped
# one-shot wrapper (repo-root ./setup; the npm package ships it as `setup`). Its -y sets
# the --full carrier itself and it owns the post-install companion loop + runtime-bridge
# step, so the machine-global consent surface is exercised on its real route.
run_setup() {
  local label="$1" bindir="$2" fixture="$3"; shift 3
  local -a envs=()
  while [ "$1" != "--" ]; do envs+=("$1"); shift; done
  shift
  RUN_SEQ=$((RUN_SEQ+1))
  ST="$SB/state-$label-r$RUN_SEQ"; mkdir -p "$ST"
  ( cd "$fixture" && env -i \
      PATH="$bindir" HOME="$SB/home-$label-r$RUN_SEQ" STUB_STATE="$ST" \
      RUNTIME_BRIDGE_AIF_URL="http://127.0.0.1:59099" \
      AIF_HANDOFF_REPO_URL="https://example.invalid/aif-handoff.git" \
      ${envs[@]+"${envs[@]}"]} \
      bash "$REPO_ROOT/setup" "$@" < /dev/null ) > "$ST/install.log" 2>&1
  RC=$?
  SET="$fixture/.claude/settings.json"
}

skills_present() { for s in "$@"; do [ -f "$FIX/.claude/skills/$s/SKILL.md" ] && ok "$LBL: skill $s present" || bad "$LBL: skill $s MISSING"; done; }
skills_absent()  { for s in "$@"; do [ -e "$FIX/.claude/skills/$s" ] && bad "$LBL: skill $s landed (must not)" || ok "$LBL: skill $s absent"; done; }
hook_files()     { for h in "$@"; do [ -f "$FIX/.claude/hooks/$h" ] && ok "$LBL: hook file $h" || bad "$LBL: hook file $h MISSING"; done; }
hook_files_absent() { for h in "$@"; do [ -e "$FIX/.claude/hooks/$h" ] && bad "$LBL: hook file $h landed (must not)" || ok "$LBL: hook file $h absent"; done; }
settings_has()   { grep -q "$1" "$SET" 2>/dev/null && ok "$LBL: settings entry $1" || bad "$LBL: settings entry $1 MISSING"; }
settings_lacks() { grep -q "$1" "$SET" 2>/dev/null && bad "$LBL: settings carries $1 (must not)" || ok "$LBL: settings lacks $1"; }
residue_pair_present() {
  hook_files precompact-residue.sh inject-handoff-on-compact.sh
  settings_has precompact-residue
  settings_has inject-handoff-on-compact
}
residue_pair_absent() {
  hook_files_absent precompact-residue.sh inject-handoff-on-compact.sh
  settings_lacks precompact-residue
  settings_lacks inject-handoff-on-compact
}
gate_unarmed() {
  local found=0
  for f in "$FIX/.claude/settings.json" "$FIX/.claude/settings.local.json"; do
    [ -f "$f" ] && grep -q AIF_HANDOFF_GATE "$f" && found=1
  done
  [ "$found" = 0 ] && ok "$LBL: AIF_HANDOFF_GATE not armed by install" || bad "$LBL: install armed AIF_HANDOFF_GATE"
}
common_agent_surface() { # the curated thin-lane surface (also the npm --full common subset)
  [ -f "$FIX/.mcp.json" ] && grep -q context7 "$FIX/.mcp.json" && grep -q deepwiki "$FIX/.mcp.json" \
    && ok "$LBL: project .mcp.json carries context7+deepwiki" || bad "$LBL: project .mcp.json missing/incomplete"
  [ -f "$FIX/AGENTS.md" ] && grep -q 'getff-framework' "$FIX/AGENTS.md" \
    && ok "$LBL: fenced AGENTS.md delivered" || bad "$LBL: fenced AGENTS.md missing"
  [ -f "$FIX/.ai-factory/AI-USAGE-GUIDE.md" ] && ok "$LBL: .ai-factory/AI-USAGE-GUIDE.md delivered" || bad "$LBL: AI-USAGE-GUIDE.md missing"
  [ -f "$FIX/.ai-factory/DESCRIPTION.md" ] && ok "$LBL: .ai-factory passport materialized" || bad "$LBL: passport missing"
  [ -f "$FIX/.claude/agents/rule-researcher.md" ] && [ -f "$FIX/.claude/agents/rule-test-author.md" ] \
    && ok "$LBL: 2-agent rule pair delivered" || bad "$LBL: agent pair missing"
}
install_shaped() { # install_shaped <calls-file> <regex> — count of machine-global install invocations
  local c=""
  [ -f "$1" ] && c=$(grep -cE "$2" "$1")
  echo "${c:-0}"
}
# Per-route canonical agent contract. cargo/go copy $PKG_ROOT/agents/<name>.md verbatim
# (_lane_deliver_agent_surface); python copies the canonical ROLE .agents/roles/<name>.md
# and rewrites repo-internal refs to upstream blob URLs (transform_internal_refs, the ONLY
# transform _py_agent_copy_or_refresh applies). Normalizing link targets and the documented
# runtime-bridge/tool-bootstrapping rewrites on BOTH sides must therefore yield identical
# bytes — any invented/edited arm (e.g. a fabricated go generation step) shows up as a diff.
agent_norm() { # agent_norm <file> → stdout
  sed -E \
    -e 's#\]\([^)]*\)#](L)#g' \
    -e 's#packages/runtime-bridge/src/#RTB#g' -e 's#\.agents/tools/runtime-bridge/src/#RTB#g' \
    -e 's#packages/runtime-bridge/scripts/bridge-health\.sh#RTB#g' -e 's#\.agents/tools/runtime-bridge/scripts/bridge-health\.sh#RTB#g' \
    -e 's#\.agents/procedures/tool-bootstrapping-consumer/SKILL\.md#TBS#g' -e 's#\.agents/procedures/tool-bootstrapping/SKILL\.md#TBS#g' \
    "$1"
}
py_agent_transformed_ok() { # py_agent_transformed_ok <delivered> <canonical-role>
  local del="$1" can="$2"
  if diff <(agent_norm "$del") <(agent_norm "$can") > "$ST/agent-norm.diff" 2>&1; then
    ok "$LBL: delivered agent = canonical role modulo the documented link transform"
  else
    bad "$LBL: delivered agent diverges beyond the documented transform (head: $(head -4 "$ST/agent-norm.diff" | tr '\n' '|'))"
  fi
  if grep -q '](\.\./' "$del"; then
    bad "$LBL: delivered agent still carries dangling repo-relative refs"
  else
    ok "$LBL: delivered agent has zero dangling repo-relative refs"
  fi
  if grep -q 'blob/main/docs/codex-contributor.md' "$del"; then
    ok "$LBL: canonical preflight ref rewritten to the upstream blob URL"
  else
    bad "$LBL: expected upstream blob URL rewrite of the codex-contributor ref missing"
  fi
}

echo "── G1: ./setup -y ts-server --profile core — CORE roster, no depth payload ──"
FIX=$(new_fixture core "" npm); LBL="G1-core"
run_setup g1 "$SB/bin" "$FIX" -- -y ts-server --profile core
[ "$RC" -eq 0 ] && ok "G1: install rc=0" || bad "G1: install rc=$RC (log tail: $(tail -5 "$ST/install.log" | tr '\n' '|'))"
skills_present getff tool-bootstrapping template-audit ai-doc rule-research rule-tests
skills_absent arch night-mode orchestrator pipeline reviewer dispatcher aif-doctor harvest story claude-glm-executor-handoff intent
hook_files deps-hash-check.sh inject-matching-rule.sh lib/hook-live.sh
settings_has deps-hash-check
settings_has inject-matching-rule
residue_pair_absent
[ -e "$FIX/scripts/run-local-ci-sweep.sh" ] && bad "G1: ci-sweep script landed at core (must not)" || ok "G1: ci-sweep script absent at core"
common_agent_surface
# Codex native definitions — the positive arm (node present → generated + review notice).
[ -f "$FIX/.codex/hooks.json" ] && grep -q deps-hash-check "$FIX/.codex/hooks.json" \
  && ok "G1: .codex/hooks.json generated from registered checks" || bad "G1: .codex/hooks.json missing/incomplete"
grep -q 'Codex hook definitions delivered' "$ST/install.log" \
  && ok "G1: codex definitions delivered notice printed" || bad "G1: codex delivered notice missing"

echo "── G2: ./setup -y ts-server --profile env — env roster + residue pair, harvest still absent ──"
FIX=$(new_fixture env "" npm); LBL="G2-env"
run_setup g2 "$SB/bin" "$FIX" -- -y ts-server --profile env
[ "$RC" -eq 0 ] && ok "G2: install rc=0" || bad "G2: install rc=$RC (log tail: $(tail -5 "$ST/install.log" | tr '\n' '|'))"
skills_present arch night-mode orchestrator pipeline reviewer
skills_absent dispatcher aif-doctor harvest story claude-glm-executor-handoff intent
residue_pair_present
gate_unarmed
common_agent_surface

echo "── G3: ./setup -y --profile factory AND legacy ./setup -y --with-aif-suite — full AIF roster, gate unarmed ──"
for arm in factory suite; do
  FIX=$(new_fixture "g3-$arm" "" npm); LBL="G3-$arm"
  if [ "$arm" = factory ]; then args=(-y ts-server --profile factory)
  else args=(-y ts-server --with-aif-suite); fi
  run_setup "g3-$arm" "$SB/bin" "$FIX" -- "${args[@]}"
  [ "$RC" -eq 0 ] && ok "G3-$arm: install rc=0" || bad "G3-$arm: install rc=$RC (log tail: $(tail -5 "$ST/install.log" | tr '\n' '|'))"
  skills_present dispatcher aif-doctor harvest story claude-glm-executor-handoff intent
  [ -f "$FIX/scripts/run-local-ci-sweep.sh" ] && ok "G3-$arm: run-local-ci-sweep.sh delivered" || bad "G3-$arm: ci-sweep script missing"
  residue_pair_present
  gate_unarmed
  common_agent_surface
done

echo "── G4: python/cargo/go at ALL FOUR depths — early-exit truth (install.sh:733-745) ──"
for lane in python cargo go; do
  for depth in core env legacy factory; do
    FIX=$(new_fixture "g4-$lane-$depth" "$lane"); LBL="G4-$lane-$depth"
    case "$depth" in
      core)   args=("$lane" --profile core) ;;
      env)    args=("$lane" --profile env) ;;
      legacy) args=("$lane") ;;   # no --profile flag: the non-TTY -y default route
      factory) args=("$lane" --profile factory) ;;
    esac
    run_install "g4-$lane-$depth" "$SB/bin" "$FIX" -- "${args[@]}"
    [ "$RC" -eq 0 ] && ok "G4-$lane-$depth: install rc=0" || bad "G4-$lane-$depth: install rc=$RC (log tail: $(tail -5 "$ST/install.log" | tr '\n' '|'))"
    skills_present getff tool-bootstrapping rule-research rule-tests
    # Early-exit truth at EVERY depth: no npm roster skill, no residue pair, no ci-sweep —
    # even where the npm lane at the same depth would deliver them.
    skills_absent template-audit ai-doc night-mode harvest intent
    residue_pair_absent
    [ -e "$FIX/scripts/run-local-ci-sweep.sh" ] && bad "G4-$lane-$depth: ci-sweep script landed on thin lane (must not)" || ok "G4-$lane-$depth: ci-sweep script absent"
    common_agent_surface
    if [ "$depth" = factory ]; then
      grep -q '\[profile\] factory' "$ST/install.log" \
        && ok "G4-$lane-factory: the factory flag resolved (log says [profile] factory)" \
        || bad "G4-$lane-factory: profile line missing — flag not consumed: $(grep '\[profile\]' "$ST/install.log" | head -1)"
      hook_files deps-hash-check.sh inject-matching-rule.sh lib/hook-live.sh
      settings_has deps-hash-check
      settings_has inject-matching-rule
      # Docs-gate scripts are lane-specific truth (INSTALL-FOR-AI.md): python ships its own
      # three runners and NOT the npm audit scripts; cargo/go ship scripts/audit-ai-docs.sh.
      if [ "$lane" = python ]; then
        [ -f "$FIX/scripts/audit-ai-docs.sh" ] && bad "G4-python: audit-ai-docs.sh landed (python ships its own runners)" || ok "G4-python: npm audit script correctly absent"
        for _ps in check-zcode-mirror.sh run-armed.sh run-rule-tests-firing.sh; do
          [ -f "$FIX/scripts/$_ps" ] && ok "G4-python: python runner $_ps delivered" || bad "G4-python: python runner $_ps missing"
        done
      else
        [ -f "$FIX/scripts/audit-ai-docs.sh" ] && ok "G4-$lane: audit-ai-docs.sh delivered" || bad "G4-$lane: audit-ai-docs.sh missing"
      fi
      # Per-route canonical agent contract — delivery invents no per-lane research arm.
      if [ "$lane" = python ]; then
        py_agent_transformed_ok "$FIX/.claude/agents/rule-researcher.md" "$REPO_ROOT/.agents/roles/rule-researcher.md"
      elif cmp -s "$FIX/.claude/agents/rule-researcher.md" "$REPO_ROOT/agents/rule-researcher.md" 2>/dev/null; then
        ok "G4-$lane: delivered rule-researcher.md byte-identical to canonical agents/ file"
      else bad "G4-$lane: delivered rule-researcher.md diverges from canonical agents/ file"; fi
    fi
  done
done

echo "── G5: native binding — missing-Node notice + custom definitions preserved ──"
FIX=$(new_fixture nonode); LBL="G5-nonode"
printf '{"hooks":{"UserPromptSubmit":[{"hooks":[{"type":"command","command":"echo keepme-custom-hook"}]}]}}\n' \
  > "$FIX/.claude/settings.json"
run_install g5n "$SB/bin-nonode" "$FIX" -- ts-server --profile core
[ "$RC" -eq 0 ] && ok "G5: no-node install still completes rc=0" || bad "G5: no-node install rc=$RC (log tail: $(tail -5 "$ST/install.log" | tr '\n' '|'))"
grep -qF 'Codex hooks not wired: node is not on PATH' "$ST/install.log" \
  && ok "G5: dependency-specific missing-node notice printed" \
  || bad "G5: exact missing-node notice absent (log tail: $(tail -5 "$ST/install.log" | tr '\n' '|'))"
[ -e "$FIX/.codex/hooks.json" ] && bad "G5: .codex/hooks.json created without node (must not)" || ok "G5: no .codex/hooks.json without node"
grep -q keepme-custom-hook "$FIX/.claude/settings.json" \
  && ok "G5: consumer custom hook definition preserved" || bad "G5: custom hook definition clobbered"

FIX=$(new_fixture codex-custom); LBL="G5-codex-custom"
mkdir -p "$FIX/.codex"
printf '{"hooks":{"UserPromptSubmit":[{"hooks":[{"type":"command","command":"echo keepme-codex-hook"}]}]}}\n' \
  > "$FIX/.codex/hooks.json"
run_install g5c "$SB/bin" "$FIX" -- ts-server --profile core
[ "$RC" -eq 0 ] && ok "G5: custom-.codex install rc=0" || bad "G5: custom-.codex rc=$RC (log tail: $(tail -5 "$ST/install.log" | tr '\n' '|'))"
grep -q keepme-codex-hook "$FIX/.codex/hooks.json" \
  && ok "G5: consumer-owned .codex/hooks.json preserved (never clobbered)" || bad "G5: consumer .codex definitions clobbered"
grep -q 'consumer-owned definitions or dependencies were kept' "$ST/install.log" \
  && ok "G5: consumer-owned keep notice printed" || bad "G5: consumer-owned keep notice missing"
[ -f "$FIX/scripts/codex-hook-adapter.mjs" ] \
  && ok "G5: shared codex adapter still delivered" || bad "G5: codex adapter missing"

echo "── G6: global consent — plain ./setup -y = ZERO machine-global calls; --global = intended calls ──"
FIX=$(new_fixture consent "" npm); LBL="G6-plain"
printf '{"mcpServers":{"my-custom-server":{"command":"echo","args":["hi"]}}}\n' > "$FIX/.mcp.json"
run_setup g6p "$SB/bin" "$FIX" -- -y ts-server --profile core
[ "$RC" -eq 0 ] && ok "G6: plain -y install rc=0" || bad "G6: plain -y rc=$RC (log tail: $(tail -5 "$ST/install.log" | tr '\n' '|'))"
_claude_installs=$(install_shaped "$ST/claude.calls" 'plugin install|plugin marketplace add|mcp add')
_npm_g=$(install_shaped "$ST/npm.calls" 'install -g|install --global|i -g')
echo "  (recorder traffic, plain arm: claude-lines=$([ -f "$ST/claude.calls" ] && wc -l < "$ST/claude.calls" | tr -d ' ' || echo 0) npm-lines=$([ -f "$ST/npm.calls" ] && wc -l < "$ST/npm.calls" | tr -d ' ' || echo 0))"
[ "$_claude_installs" = 0 ] && [ "$_npm_g" = 0 ] \
  && ok "G6: plain -y made ZERO machine-global stub calls" \
  || bad "G6: plain -y made machine-global calls (claude:$_claude_installs npm-g:$_npm_g)"
grep -qiE 'machine-global|NOT wired|not installed: its install is machine-global' "$ST/install.log" \
  && ok "G6: plain -y prints the project-only / not-wired notice" \
  || bad "G6: no machine-global skip notice in log"
grep -q context7 "$FIX/.mcp.json" && grep -q my-custom-server "$FIX/.mcp.json" \
  && ok "G6: project .mcp.json wired AND pre-existing custom server preserved" || bad "G6: .mcp.json merge lost wiring or custom entry"

FIX=$(new_fixture consent-global "" npm); LBL="G6-global"
run_setup g6g "$SB/bin" "$FIX" -- -y --global ts-server --profile core
[ "$RC" -eq 0 ] && ok "G6: --global install rc=0" || bad "G6: --global rc=$RC (log tail: $(tail -5 "$ST/install.log" | tr '\n' '|'))"
_claude_installs=$(install_shaped "$ST/claude.calls" 'plugin install|plugin marketplace add|mcp add')
[ "$_claude_installs" -ge 2 ] \
  && ok "G6: --global permits the intended plugin/mcp installs ($_claude_installs calls)" \
  || bad "G6: --global made only ${_claude_installs:-0} install calls (expected superpowers + ast-grep at least)"
grep -q 'install -g @ast-grep/cli' "$ST/npm.calls" 2>/dev/null \
  && ok "G6: --global runs the npm -g companion (ast-grep-cli)" || bad "G6: npm -g ast-grep-cli not invoked"
grep -q context7 "$FIX/.mcp.json" \
  && ok "G6: --global also wires the project .mcp.json (project wiring ≠ global registration)" || bad "G6: --global lost the project .mcp.json"

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
