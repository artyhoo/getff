#!/usr/bin/env bash
# pre-merge-local.test.sh — live-fire self-tests for the pre-merge carrier
# (pre-merge-local.sh) and the ci-available probe (ci-available-probe.sh).
#
# T-PMC-D contract: every arm RUNS the real script against a fixture repo and
# asserts its OUTPUT and exit code on a seeded outcome. Nothing here greps the
# scripts' source text — a self-test that cannot fail on a broken carrier
# proves nothing.
#
# Arms (spec §a.6 + kickoff §3):
#   1  three-sha contract — asserted on EVERY carrier arm below (W-1/T-PMC-B)
#   2  seeded failing gate            -> exit 1, FAIL verdict, failed_gates ledgered
#   3  seeded merge conflict          -> exit 2, distinct message + GitHub-runs-nothing warning
#   4  vacuity: declared gate skipped from the run (aggregate still exits 0) -> exit 90
#   5  PASS: log retained OUTSIDE the throwaway worktree; worktree cleaned up
#   6  F2 containment: base already in head -> merge = head (base already contained)
#   7  observability: NDJSON ledger line + copy-paste PR-body block on PASS
#   8  pin mismatch (.nvmrc)          -> exit 3, the pin named
#   9  unresolvable base ref          -> exit 64 (usage class, no verdict)
#   10 lock contention                -> exit 75
#   P1 probe: gh absent               -> exit 3, named
#   P2 probe: quota signature / red-with-steps / green / no-checks -> 4 / 1 / 0 / 2
#   11 python lane: detected from getff-python.yml; pins + gates derived, --no-cache added
#   12 python pin mismatch (ruff stub reports wrong version) -> exit 3, pin named
#   13 seeded python gate red -> exit 1, lane-qualified failed_gates in the ledger
#   14 python vacuity: declared bans gate's --config input missing -> exit 90
#   15 go lane: config resolved, forbidigo args derived, GOLANGCI_LINT_CACHE isolated
#   16 go pin mismatch -> exit 3, named
#   17 cargo lane: denial flags derived; CARGO_TARGET_DIR/RUSTC_WRAPPER unset for the run
#   18 cargo absent on a bare PATH -> exit 3, named
#   19 UI preset: build gate derived from ci.yml ci-success.needs; browser legs NOT
#      COVERED (F3 report-only), never CANNOT-RUN
#   20 multi-lane monorepo (npm + python): every detected lane runs
#
# Environment notes:
# - Fixtures are throwaway git repos (mktemp -d); npm-run-all2 is not
#   installable offline, so fixture PATH prepends a shim that loops the gates
#   via `npm run` — npm prints the SAME "> pkg@version <script>" report
#   headers the production aggregate produces. Arm 4's shim variant silently
#   skips one declared gate while exiting 0 (the #1466 item-1 shape).
# - npm cache is redirected per fixture (container caches can be root-owned).
# - Requires git >= 2.28 (`git init -b`) and npm on PATH.
# - B2 stack-lane arms (11-20) use PATH-shim stub toolchains (ast-grep/ruff/
#   go/golangci-lint/cargo) that report a pinned --version and log gate
#   invocations. They prove the carrier's DETECTION/derivation/exit-code
#   logic on real fixture repos — NOT real toolchain behaviour; real-toolchain
#   runs are the host's opportunistic leg (kickoff §5).

set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
CARRIER="$REPO_ROOT/packages/core/audit-self/pre-merge-local.sh"
PROBE="$REPO_ROOT/packages/core/audit-self/ci-available-probe.sh"

PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

SCRATCH=$(mktemp -d)
cleanup() { rm -rf "$SCRATCH"; }
trap cleanup EXIT

assert_contains() { # <label> <haystack-file> <needle>
  if grep -qF -- "$3" "$2"; then ok "$1"; else bad "$1 — missing: $3"; fi
}
assert_three_shas() { # <label> <output-file>  (arm 1, on every carrier arm)
  _l=$1; _f=$2
  if grep -qE '^head:   [0-9a-f]{40}$' "$_f" && grep -qE '^base:   [0-9a-f]{40}' "$_f" && grep -qE '^merge:  ' "$_f"; then
    ok "$_l — three-sha block (head/base/merge)"
  else
    bad "$_l — three-sha block incomplete (W-1/T-PMC-B violation)"
  fi
}
run_carrier() { # <fixture> <base-ref> ; output -> $OUT, rc -> $RC
  OUT=$(cd "$1" && npm_config_cache="$1/.npm-cache" bash "$CARRIER" "$2" 2>&1); RC=$?
  printf '%s\n' "$OUT" > "$1/.last-out"
}

# make_fixture <lint-script-body> — base advanced after branching, so a REAL
# merge is constructed; prints the fixture dir. Uses the honest shim.
make_fixture() {
  local T
  T=$(mktemp -d)
  cat > "$T/package.json" <<EOF
{
  "name": "fixture-pkg",
  "version": "0.0.0",
  "scripts": {
    "validate": "npm-run-all2 --parallel typecheck lint",
    "typecheck": "echo tc-ok",
    "lint": "$1"
  }
}
EOF
  printf '%s\n' '{"name":"fixture-pkg","version":"0.0.0","lockfileVersion":3,"requires":true,"packages":{"":{"name":"fixture-pkg","version":"0.0.0"}}}' > "$T/package-lock.json"
  mkdir -p "$T/.shim-bin" "$T/.shim-skip"
  printf '%s\n' '#!/usr/bin/env bash' \
    'args=(); for a in "$@"; do case "$a" in --*) ;; *) args+=("$a");; esac; done' \
    'for g in "${args[@]}"; do npm run "$g" || exit 1; done' > "$T/.shim-bin/npm-run-all2"
  printf '%s\n' '#!/usr/bin/env bash' \
    'args=(); for a in "$@"; do case "$a" in --*) ;; *) args+=("$a");; esac; done' \
    'for g in "${args[@]}"; do [ "$g" = lint ] && continue; npm run "$g"; done' > "$T/.shim-skip/npm-run-all2"
  chmod +x "$T/.shim-bin/npm-run-all2" "$T/.shim-skip/npm-run-all2"
  git -C "$T" init -q -b main
  git -C "$T" config user.email t@t; git -C "$T" config user.name T
  git -C "$T" add -A; git -C "$T" commit -qm base
  git -C "$T" checkout -qb feature/x
  echo head-change > "$T/head.txt"; git -C "$T" add -A; git -C "$T" commit -qm headwork
  git -C "$T" checkout -q main
  echo base-change > "$T/base.txt"; git -C "$T" add -A; git -C "$T" commit -qm basework
  git -C "$T" checkout -q feature/x
  echo "$T"
}

echo "== carrier arms =="

# ── arm 5 + 7 + 1: the PASS reference run (log retention, ledger, PR-body) ──
T=$(make_fixture "echo lint-ok")
PATH_SAVE=$PATH; export PATH="$T/.shim-bin:$PATH"
run_carrier "$T" main
[ "$RC" -eq 0 ] && ok "arm5/7: PASS exit 0" || bad "arm5/7: expected exit 0, got $RC"
assert_three_shas "arm1(PASS)" "$T/.last-out"
assert_contains "arm5: LOCAL PRE-MERGE PASS string (§e.1)" "$T/.last-out" "LOCAL PRE-MERGE PASS"
assert_contains "arm5: weaker-evidence sentence (§e.1)" "$T/.last-out" "weaker evidence than CI"
assert_contains "arm7: PR-body citation block (§e.4)" "$T/.last-out" "Local pre-merge run: PASS"
assert_contains "arm5: NOT COVERED list present (§e.2)" "$T/.last-out" "NOT COVERED (CI legs not reproduced locally)"
LEDGER="$T/.git/getff/pre-merge-runs.ndjson"
if [ -f "$LEDGER" ] && tail -n 1 "$LEDGER" | grep -q '"verdict":"PASS"' \
   && tail -n 1 "$LEDGER" | grep -q '"failed_gates":\[\]' \
   && tail -n 1 "$LEDGER" | grep -qE '"(ts|remote|head|base|merge|duration_s)":'; then
  ok "arm7: NDJSON ledger line with §f.1 fields"
else
  bad "arm7: ledger line missing/malformed at $LEDGER"
fi
MERGE_SHA_LOG=$(ls "$T/.git/getff/pre-merge-logs"/*.log 2>/dev/null | head -1)
[ -n "$MERGE_SHA_LOG" ] && ok "arm5: PASS log retained outside the worktree ($(basename "$MERGE_SHA_LOG"))" \
  || bad "arm5: no retained log under .git/getff/pre-merge-logs/"
if [ -z "$(ls -A "$T/.git/getff/pre-merge-worktrees" 2>/dev/null)" ]; then
  ok "arm5: throwaway worktree cleaned up"
else
  bad "arm5: worktree residue left behind"
fi
# arm 1 sharp edge: on a REAL merge (base advanced), merge sha must differ
# from the head sha — the verified sha is the merge result, not the head.
HEAD_SHA=$(git -C "$T" rev-parse HEAD)
if grep -q "base already contained" "$T/.last-out"; then
  bad "arm1: unexpected containment on advanced-base fixture"
elif grep -q "^merge:  $HEAD_SHA" "$T/.last-out"; then
  bad "arm1: verified sha equals head sha on a real merge (#1466 defect shape)"
else
  ok "arm1: real-merge run gates a merge sha distinct from head"
fi
export PATH=$PATH_SAVE

# ── arm 2: seeded failing gate -> 1 ──
T=$(make_fixture "exit 1")
PATH_SAVE=$PATH; export PATH="$T/.shim-bin:$PATH"
run_carrier "$T" main
[ "$RC" -eq 1 ] && ok "arm2: failing gate -> exit 1" || bad "arm2: expected 1, got $RC"
assert_three_shas "arm1(FAIL)" "$T/.last-out"
assert_contains "arm2: FAIL verdict names the merge result" "$T/.last-out" "gate(s) red on the merge result"
tail -n 1 "$T/.git/getff/pre-merge-runs.ndjson" | grep -q '"verdict":"FAIL"' \
  && ok "arm2: FAIL ledgered" || bad "arm2: FAIL not ledgered"
export PATH=$PATH_SAVE

# ── arm 3: seeded conflict -> 2 ──
T=$(make_fixture "echo lint-ok")
echo conflict-line > "$T/shared.txt"; git -C "$T" add -A; git -C "$T" commit -qm headconf
git -C "$T" checkout -q main
echo different-line > "$T/shared.txt"; git -C "$T" add -A; git -C "$T" commit -qm baseconf
git -C "$T" checkout -q feature/x
PATH_SAVE=$PATH; export PATH="$T/.shim-bin:$PATH"
run_carrier "$T" main
[ "$RC" -eq 2 ] && ok "arm3: conflict -> exit 2" || bad "arm3: expected 2, got $RC"
assert_three_shas "arm1(CONFLICT)" "$T/.last-out"
assert_contains "arm3: merge: CONFLICT display (§a.2)" "$T/.last-out" "merge:  CONFLICT"
assert_contains "arm3: GitHub-runs-nothing warning (§e.3)" "$T/.last-out" "GitHub runs no pull_request workflow at all in this state"
assert_contains "arm3: conflicted file named" "$T/.last-out" "conflicted: shared.txt"
export PATH=$PATH_SAVE

# ── arm 4: vacuity -> 90 (shim skips 'lint', aggregate exits 0) ──
T=$(make_fixture "echo lint-ok")
PATH_SAVE=$PATH; export PATH="$T/.shim-skip:$PATH"
run_carrier "$T" main
[ "$RC" -eq 90 ] && ok "arm4: declared gate never reported -> exit 90" || bad "arm4: expected 90, got $RC"
assert_three_shas "arm1(VACUITY)" "$T/.last-out"
assert_contains "arm4: never-reported gate named" "$T/.last-out" "never reported: lint"
export PATH=$PATH_SAVE

# ── arm 6: F2 containment ──
T=$(make_fixture "echo lint-ok")
BRANCH_BASE=$(git -C "$T" rev-parse HEAD~1)
PATH_SAVE=$PATH; export PATH="$T/.shim-bin:$PATH"
run_carrier "$T" "$BRANCH_BASE"
[ "$RC" -eq 0 ] && ok "arm6: containment proceeds (F2), exit per gates" || bad "arm6: expected 0, got $RC"
assert_three_shas "arm1(F2)" "$T/.last-out"
assert_contains "arm6: merge = head (base already contained)" "$T/.last-out" "merge = head (base already contained)"
HEAD_NOW=$(git -C "$T" rev-parse HEAD)
if grep -q "^merge:  $HEAD_NOW" "$T/.last-out"; then
  ok "arm6: merge equals HEAD (correct under F2), three shas intact"
else
  bad "arm6: merge display does not carry the head sha"
fi
grep -q "^head:   $HEAD_NOW" "$T/.last-out" && ok "arm6: head sha reported" || bad "arm6: head sha missing"
export PATH=$PATH_SAVE

# ── arm 8: pin mismatch -> 3 ──
T=$(make_fixture "echo lint-ok")
echo 42 > "$T/.nvmrc"; git -C "$T" add -A; git -C "$T" commit -qm pin
PATH_SAVE=$PATH; export PATH="$T/.shim-bin:$PATH"
run_carrier "$T" main
if [ "$RC" -eq 3 ]; then
  ok "arm8: node/.nvmrc major mismatch -> exit 3"
  assert_contains "arm8: the pin named" "$T/.last-out" ".nvmrc"
  assert_three_shas "arm1(CANNOT-RUN)" "$T/.last-out"
else
  # host node major == 42 only in a fixture universe; treat 0 as env-unreachable
  bad "arm8: expected 3, got $RC (host node major == 42?)"
fi
export PATH=$PATH_SAVE

# ── arm 9: unresolvable base -> 64, no verdict/ledger ──
T=$(make_fixture "echo lint-ok")
PATH_SAVE=$PATH; export PATH="$T/.shim-bin:$PATH"
run_carrier "$T" no-such-ref
[ "$RC" -eq 64 ] && ok "arm9: unresolvable base -> exit 64 (usage class)" || bad "arm9: expected 64, got $RC"
[ -f "$T/.git/getff/pre-merge-runs.ndjson" ] && bad "arm9: usage error must not ledger" || ok "arm9: no ledger line for usage error"
export PATH=$PATH_SAVE

# ── arm 10: lock contention -> 75 ──
T=$(make_fixture "echo lint-ok")
mkdir -p "$T/.git/getff/pre-merge-carrier.lock"
PATH_SAVE=$PATH; export PATH="$T/.shim-bin:$PATH"
run_carrier "$T" main
[ "$RC" -eq 75 ] && ok "arm10: held lock -> exit 75" || bad "arm10: expected 75, got $RC"
export PATH=$PATH_SAVE

echo "== B2 lane arms =="

# make_stack_fixture <workflow-filename> — workflow YAML on stdin; base advanced
# after branching (real merge), no package.json (stack-only lane); prints dir.
make_stack_fixture() {
  local T
  T=$(mktemp -d)
  mkdir -p "$T/.github/workflows"
  cat > "$T/.github/workflows/$1"
  git -C "$T" init -q -b main
  git -C "$T" config user.email t@t; git -C "$T" config user.name T
  git -C "$T" add -A; git -C "$T" commit -qm base
  git -C "$T" checkout -qb feature/x
  echo head-change > "$T/head.txt"; git -C "$T" add -A; git -C "$T" commit -qm headwork
  git -C "$T" checkout -q main
  echo base-change > "$T/base.txt"; git -C "$T" add -A; git -C "$T" commit -qm basework
  git -C "$T" checkout -q feature/x
  echo "$T"
}

# make_py_stubs <dir> <ast-grep-ver> <ruff-ver> — stubs report the given pinned
# version, log gate invocations, exit rc from <dir>/py-gate-rc (missing -> 0).
make_py_stubs() {
  local D=$1
  mkdir -p "$D/.stub-bin"
  cat > "$D/.stub-bin/ast-grep" <<EOF
#!/usr/bin/env bash
if [ "\$1" = "--version" ]; then echo "@ast-grep/cli $2"; exit 0; fi
echo "ast-grep \$*" >> "$D/py-gates.log"
[ -f "$D/py-gate-rc" ] && exit "\$(cat "$D/py-gate-rc")"
exit 0
EOF
  cat > "$D/.stub-bin/ruff" <<EOF
#!/usr/bin/env bash
if [ "\$1" = "--version" ]; then echo "ruff $3"; exit 0; fi
echo "ruff \$*" >> "$D/py-gates.log"
[ -f "$D/py-gate-rc" ] && exit "\$(cat "$D/py-gate-rc")"
exit 0
EOF
  chmod +x "$D/.stub-bin/ast-grep" "$D/.stub-bin/ruff"
}

# make_go_stubs <dir> <go-ver> <golangci-ver>
make_go_stubs() {
  local D=$1
  mkdir -p "$D/.stub-bin"
  cat > "$D/.stub-bin/go" <<EOF
#!/usr/bin/env bash
if [ "\$1" = version ]; then echo "go version go$2 linux/arm64"; exit 0; fi
echo "go \$*" >> "$D/go-gates.log"
exit 0
EOF
  cat > "$D/.stub-bin/golangci-lint" <<EOF
#!/usr/bin/env bash
if [ "\$1" = "--version" ]; then echo "golangci-lint has version $3 built with go$2"; exit 0; fi
echo "golangci-lint \$* [GOLANGCI_LINT_CACHE=\${GOLANGCI_LINT_CACHE:-UNSET}]" >> "$D/go-gates.log"
[ -f "$D/go-gate-rc" ] && exit "\$(cat "$D/go-gate-rc")"
exit 0
EOF
  chmod +x "$D/.stub-bin/go" "$D/.stub-bin/golangci-lint"
}

# make_cargo_stub <dir>
make_cargo_stub() {
  local D=$1
  mkdir -p "$D/.stub-bin"
  cat > "$D/.stub-bin/cargo" <<EOF
#!/usr/bin/env bash
if [ "\$1" = clippy ] && [ "\$2" = "--version" ]; then echo "clippy 0.1.84 (00000000 2026-01-01)"; exit 0; fi
echo "cargo \$* [CARGO_TARGET_DIR=\${CARGO_TARGET_DIR:-UNSET} RUSTC_WRAPPER=\${RUSTC_WRAPPER:-UNSET}]" >> "$D/cargo-gates.log"
[ -f "$D/cargo-gate-rc" ] && exit "\$(cat "$D/cargo-gate-rc")"
exit 0
EOF
  chmod +x "$D/.stub-bin/cargo"
}

# The python workflow mirrors the LIVE template's own shapes (measured
# 2026-08-19): pin lines npm install -g @ast-grep/cli@0.44.1 / pip install
# ruff==0.15.21; gates ast-grep scan / ruff check . / ruff check . --config
# .getff/ruff-bans.toml --no-cache (templates/python/github-actions-ci.yml:46,49,66,72,83).
PYWF=$(cat <<'WF'
name: getff-python
on: [push]
jobs:
  astgrep:
    name: ast-grep structural rules (getff)
    runs-on: ubuntu-latest
    steps:
      - name: Install ast-grep (pinned)
        run: npm install -g @ast-grep/cli@0.44.1
      - name: ast-grep scan (getff rules)
        run: ast-grep scan
  getff-ruff:
    name: ruff fast-path lint (getff)
    runs-on: ubuntu-latest
    steps:
      - name: Install ruff (pinned)
        run: pip install ruff==0.15.21
      - name: ruff check (discovered config)
        run: ruff check .
      - name: ruff check (getff bans — isolated --config)
        run: ruff check . --config .getff/ruff-bans.toml --no-cache
WF
)

# ── arm 11 + 1: python lane detected via its wired surface; gates + pins derived ──
T=$(printf '%s\n' "$PYWF" | make_stack_fixture getff-python.yml)
mkdir -p "$T/.getff"; echo 'select = ["DTZ005"]' > "$T/.getff/ruff-bans.toml"
git -C "$T" add -A; git -C "$T" commit -qm banscfg
make_py_stubs "$T" 0.44.1 0.15.21
PATH_SAVE=$PATH; export PATH="$T/.stub-bin:$PATH"
run_carrier "$T" main
[ "$RC" -eq 0 ] && ok "arm11: python lane detected via getff-python.yml -> exit 0" || bad "arm11: expected 0, got $RC"
assert_three_shas "arm11(python-PASS)" "$T/.last-out"
assert_contains "arm11: stack-only tree carries no npm NOT-COVERED trio" "$T/.last-out" "(none — every gate of the detected lane workflows ran locally)"
grep -qF 'ruff check . --no-cache' "$T/py-gates.log" \
  && ok "arm11: discovered-config ruff gate gained --no-cache (§b.1)" \
  || bad "arm11: plain ruff gate missing --no-cache (log: $(cat "$T/py-gates.log" 2>/dev/null))"
grep -qF 'ruff check . --config .getff/ruff-bans.toml --no-cache' "$T/py-gates.log" \
  && ok "arm11: bans gate ran against the present config" || bad "arm11: bans gate not run"
tail -n 1 "$T/.git/getff/pre-merge-runs.ndjson" | grep -q '"verdict":"PASS"' \
  && ok "arm11: python-lane PASS ledgered" || bad "arm11: ledger missing/malformed"
export PATH=$PATH_SAVE

# ── arm 12: ruff pin mismatch -> exit 3, the pin named ──
T=$(printf '%s\n' "$PYWF" | make_stack_fixture getff-python.yml)
mkdir -p "$T/.getff"; echo 'select = ["DTZ005"]' > "$T/.getff/ruff-bans.toml"
git -C "$T" add -A; git -C "$T" commit -qm banscfg
make_py_stubs "$T" 0.44.1 9.9.9
PATH_SAVE=$PATH; export PATH="$T/.stub-bin:$PATH"
run_carrier "$T" main
[ "$RC" -eq 3 ] && ok "arm12: ruff pin mismatch -> exit 3" || bad "arm12: expected 3, got $RC"
assert_contains "arm12: the pin named" "$T/.last-out" "ruff==0.15.21"
assert_contains "arm12: never a silent run under a different version" "$T/.last-out" "never a silent run under a different version"
assert_three_shas "arm12(python-CANNOT-RUN)" "$T/.last-out"
export PATH=$PATH_SAVE

# ── arm 13: seeded python gate red -> exit 1, lane-qualified failed_gates ──
T=$(printf '%s\n' "$PYWF" | make_stack_fixture getff-python.yml)
mkdir -p "$T/.getff"; echo 'select = ["DTZ005"]' > "$T/.getff/ruff-bans.toml"
git -C "$T" add -A; git -C "$T" commit -qm banscfg
make_py_stubs "$T" 0.44.1 0.15.21
echo 1 > "$T/py-gate-rc"
PATH_SAVE=$PATH; export PATH="$T/.stub-bin:$PATH"
run_carrier "$T" main
[ "$RC" -eq 1 ] && ok "arm13: seeded python gate red -> exit 1" || bad "arm13: expected 1, got $RC"
assert_contains "arm13: FAIL verdict names the merge result" "$T/.last-out" "gate(s) red on the merge result"
tail -n 1 "$T/.git/getff/pre-merge-runs.ndjson" | grep -qF '"python:' \
  && ok "arm13: lane-qualified failed_gates ledgered" || bad "arm13: failed_gates not lane-qualified in ledger"
assert_three_shas "arm13(python-FAIL)" "$T/.last-out"
export PATH=$PATH_SAVE

# ── arm 14: python vacuity — bans config missing -> declared gate never ran -> 90 ──
T=$(printf '%s\n' "$PYWF" | make_stack_fixture getff-python.yml)
make_py_stubs "$T" 0.44.1 0.15.21
PATH_SAVE=$PATH; export PATH="$T/.stub-bin:$PATH"
run_carrier "$T" main
[ "$RC" -eq 90 ] && ok "arm14: declared bans gate missing its --config input -> exit 90" || bad "arm14: expected 90, got $RC"
assert_contains "arm14: never-reported gate named with lane prefix" "$T/.last-out" "never reported: python:ruff check"
assert_three_shas "arm14(python-VACUITY)" "$T/.last-out"
tail -n 1 "$T/.git/getff/pre-merge-runs.ndjson" | grep -q '"verdict":"VACUITY"' \
  && ok "arm14: VACUITY ledgered" || bad "arm14: VACUITY not ledgered"
export PATH=$PATH_SAVE

# ── arm 15 + 1: go lane — config resolved, args derived, cache isolated ──
GOWF=$(cat <<'WF'
name: getff-go
on: [push]
jobs:
  getff-golangci:
    name: golangci-lint bans (getff)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-go@v5
        with:
          go-version: '1.22.0'
      - run: go install github.com/golangci/golangci-lint/cmd/golangci-lint@v1.55.2
      - run: golangci-lint run --enable forbidigo --config .golangci.yml ./...
WF
)
T=$(printf '%s\n' "$GOWF" | make_stack_fixture getff-go.yml)
printf '%s\n' 'run:' '  timeout: 5m' > "$T/.golangci.yml"
git -C "$T" add -A; git -C "$T" commit -qm gocfg
make_go_stubs "$T" 1.22.0 1.55.2
PATH_SAVE=$PATH; export PATH="$T/.stub-bin:$PATH"
run_carrier "$T" main
[ "$RC" -eq 0 ] && ok "arm15: go lane detected via getff-go.yml -> exit 0" || bad "arm15: expected 0, got $RC"
assert_three_shas "arm15(go-PASS)" "$T/.last-out"
grep -qF 'golangci-lint run --enable forbidigo ./... --config .golangci.yml' "$T/go-gates.log" \
  && ok "arm15: forbidigo args derived from the workflow (config re-resolved)" \
  || bad "arm15: golangci-lint invocation wrong (log: $(cat "$T/go-gates.log" 2>/dev/null))"
grep -qF "GOLANGCI_LINT_CACHE=$T/.git/getff/pre-merge-golangci-cache" "$T/go-gates.log" \
  && ok "arm15: GOLANGCI_LINT_CACHE isolated to a throwaway dir (§b.1)" \
  || bad "arm15: GOLANGCI_LINT_CACHE not isolated"
grep -q "GOLANGCI_LINT_CACHE isolated" "$T"/.git/getff/pre-merge-logs/*.log \
  && ok "arm15: isolation noted in the retained run log" || bad "arm15: isolation note missing from run log"
export PATH=$PATH_SAVE

# ── arm 16: go pin mismatch -> exit 3, named ──
T=$(printf '%s\n' "$GOWF" | make_stack_fixture getff-go.yml)
make_go_stubs "$T" 9.9.9 1.55.2
PATH_SAVE=$PATH; export PATH="$T/.stub-bin:$PATH"
run_carrier "$T" main
[ "$RC" -eq 3 ] && ok "arm16: go pin mismatch -> exit 3" || bad "arm16: expected 3, got $RC"
assert_contains "arm16: the pin named" "$T/.last-out" "pins go-version 1.22.0"
assert_three_shas "arm16(go-CANNOT-RUN)" "$T/.last-out"
export PATH=$PATH_SAVE

# ── arm 17 + 1: cargo lane — denial flags derived; env unset for the run only ──
CARGOWF=$(cat <<'WF'
name: getff-cargo
on: [push]
jobs:
  getff-clippy:
    name: clippy bans (getff)
    runs-on: ubuntu-latest
    steps:
      - name: Add clippy component
        run: rustup component add clippy
      - name: cargo clippy (getff bans)
        run: cargo clippy --all-targets -- -D clippy::disallowed_methods -D clippy::disallowed_types -D clippy::disallowed_macros
WF
)
T=$(printf '%s\n' "$CARGOWF" | make_stack_fixture getff-cargo.yml)
make_cargo_stub "$T"
PATH_SAVE=$PATH; export PATH="$T/.stub-bin:$PATH"
export CARGO_TARGET_DIR=/tmp/arm17-should-not-leak
export RUSTC_WRAPPER=arm17-sccache
run_carrier "$T" main
[ "$RC" -eq 0 ] && ok "arm17: cargo lane detected via getff-cargo.yml -> exit 0 (unpinned: presence check only)" || bad "arm17: expected 0, got $RC"
assert_three_shas "arm17(cargo-PASS)" "$T/.last-out"
grep -qF -- 'cargo clippy --all-targets -- -D clippy::disallowed_methods -D clippy::disallowed_types -D clippy::disallowed_macros' "$T/cargo-gates.log" \
  && ok "arm17: denial flags derived from the consumer's workflow" \
  || bad "arm17: clippy invocation wrong (log: $(cat "$T/cargo-gates.log" 2>/dev/null))"
grep -qF 'CARGO_TARGET_DIR=UNSET' "$T/cargo-gates.log" && grep -qF 'RUSTC_WRAPPER=UNSET' "$T/cargo-gates.log" \
  && ok "arm17: CARGO_TARGET_DIR/RUSTC_WRAPPER unset for the carrier's run only (§b.1)" \
  || bad "arm17: env isolation failed (host values leaked into the gate run)"
unset CARGO_TARGET_DIR RUSTC_WRAPPER
export PATH=$PATH_SAVE

# ── arm 18: cargo absent (bare PATH) -> exit 3, named ──
T=$(printf '%s\n' "$CARGOWF" | make_stack_fixture getff-cargo.yml)
mkdir -p "$T/.bare-bin"
for b in git bash grep sed head tr date mkdir rm rmdir wc cat ls; do
  ln -s "$(command -v "$b")" "$T/.bare-bin/$b"
done
OUT=$(cd "$T" && PATH="$T/.bare-bin" /bin/bash "$CARRIER" main 2>&1); RC=$?
printf '%s\n' "$OUT" > "$T/.last-out"
[ "$RC" -eq 3 ] && ok "arm18: cargo absent on a bare PATH -> exit 3" || bad "arm18: expected 3, got $RC"
assert_contains "arm18: cargo named as the missing tool" "$T/.last-out" "cargo is required by getff-cargo.yml"
assert_three_shas "arm18(cargo-CANNOT-RUN)" "$T/.last-out"

# ── arm 19 + 1: UI preset — build gate derived; browser legs NOT COVERED (F3) ──
make_ui_fixture() {
  local T
  T=$(mktemp -d)
  cat > "$T/package.json" <<'EOF'
{
  "name": "fixture-pkg",
  "version": "0.0.0",
  "scripts": {
    "validate": "npm-run-all2 --parallel typecheck lint",
    "typecheck": "echo tc-ok",
    "lint": "echo lint-ok",
    "build": "echo ui-build-ok",
    "build-storybook": "echo sb-build-ok",
    "test-storybook": "echo sb-test-ok",
    "test-e2e": "echo e2e-ok"
  }
}
EOF
  printf '%s\n' '{"name":"fixture-pkg","version":"0.0.0","lockfileVersion":3,"requires":true,"packages":{"":{"name":"fixture-pkg","version":"0.0.0"}}}' > "$T/package-lock.json"
  mkdir -p "$T/.shim-bin" "$T/.github/workflows"
  printf '%s\n' '#!/usr/bin/env bash' \
    'args=(); for a in "$@"; do case "$a" in --*) ;; *) args+=("$a");; esac; done' \
    'for g in "${args[@]}"; do npm run "$g" || exit 1; done' > "$T/.shim-bin/npm-run-all2"
  chmod +x "$T/.shim-bin/npm-run-all2"
  cat > "$T/.github/workflows/ci.yml" <<'EOF'
name: CI
on: [push]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: npm run lint
  ci-success:
    if: always()
    needs: [lint, typecheck, build, test-storybook, test-e2e, security, codecov]
    runs-on: ubuntu-latest
    steps:
      - run: echo ok
EOF
  git -C "$T" init -q -b main
  git -C "$T" config user.email t@t; git -C "$T" config user.name T
  git -C "$T" add -A; git -C "$T" commit -qm base
  git -C "$T" checkout -qb feature/x
  echo head-change > "$T/head.txt"; git -C "$T" add -A; git -C "$T" commit -qm headwork
  git -C "$T" checkout -q main
  echo base-change > "$T/base.txt"; git -C "$T" add -A; git -C "$T" commit -qm basework
  git -C "$T" checkout -q feature/x
  echo "$T"
}
T=$(make_ui_fixture)
PATH_SAVE=$PATH; export PATH="$T/.shim-bin:$PATH"
run_carrier "$T" main
[ "$RC" -eq 0 ] && ok "arm19: UI preset lane (validate + derived build) -> exit 0" || bad "arm19: expected 0, got $RC"
assert_three_shas "arm19(ui-PASS)" "$T/.last-out"
assert_contains "arm19: test-storybook leg NOT COVERED (F3 report-only)" "$T/.last-out" "test-storybook (browser-dependent: built Storybook served on port 6006)"
assert_contains "arm19: test-e2e leg NOT COVERED (F3 report-only)" "$T/.last-out" "test-e2e (playwright; browser-dependent)"
grep -q "ui-build-ok" "$T"/.git/getff/pre-merge-logs/*.log \
  && ok "arm19: build gate ran (derived from ci.yml ci-success.needs)" || bad "arm19: build gate never ran"
export PATH=$PATH_SAVE

# ── arm 20 + 1: multi-lane monorepo (npm + python) — every detected lane runs ──
T=$(make_fixture "echo lint-ok")
mkdir -p "$T/.github/workflows"
printf '%s\n' "$PYWF" > "$T/.github/workflows/getff-python.yml"
mkdir -p "$T/.getff"; echo 'select = ["DTZ005"]' > "$T/.getff/ruff-bans.toml"
git -C "$T" add -A; git -C "$T" commit -qm pywf
make_py_stubs "$T" 0.44.1 0.15.21
PATH_SAVE=$PATH; export PATH="$T/.shim-bin:$T/.stub-bin:$PATH"
run_carrier "$T" main
[ "$RC" -eq 0 ] && ok "arm20: multi-lane tree (npm + python) both green -> exit 0" || bad "arm20: expected 0, got $RC"
assert_contains "arm20: both lanes named in the verdict" "$T/.last-out" "npm python"
[ -s "$T/py-gates.log" ] && ok "arm20: python lane ran alongside the npm lane" || bad "arm20: python gates never ran"
assert_three_shas "arm20(multi-PASS)" "$T/.last-out"
export PATH=$PATH_SAVE

echo "== probe arms =="

# ── P1: gh absent -> 3 ──
P=$(mktemp -d); git -C "$P" init -q; git -C "$P" remote add origin git@github.com:acme/widget.git
git -C "$P" config user.email t@t; git -C "$P" config user.name T
echo x > "$P/f"; git -C "$P" add -A; git -C "$P" commit -qm c1
mkdir -p "$P/p1bin"; ln -s "$(command -v git)" "$P/p1bin/git"
OUT=$(cd "$P" && PATH="$P/p1bin" /bin/bash "$PROBE" HEAD 2>&1); RC=$?
[ "$RC" -eq 3 ] && ok "P1: gh absent -> exit 3" || bad "P1: expected 3, got $RC"
case "$OUT" in *"gh (GitHub CLI) is required"*) ok "P1: gh named as the missing tool";; *) bad "P1: gh not named";; esac

# make_gh_shim <fixture-dir> <tsv-lines...>  — simulates gh INCLUDING --jq
make_gh_shim() {
  local dir=$1; shift
  mkdir -p "$dir/.ghbin"
  {
    echo '#!/usr/bin/env bash'
    echo 'case "$2" in'
    for entry in "$@"; do
      printf '%s\n' "$entry"
    done
    echo '  *) echo "unexpected gh call: $*" >&2; exit 1 ;;'
    echo 'esac'
  } > "$dir/.ghbin/gh"
  chmod +x "$dir/.ghbin/gh"
}

# ── P2a: the quota signature -> 4 ──
make_gh_shim "$P" \
  '  repos/acme/widget/check-runs/9001/annotations) printf "%s\n" "The runner has received a job, but billing quota is exhausted" ;;' \
  '  repos/acme/widget/check-runs/9001) printf "%s\n" "[0,2]" ;;' \
  '  */check-runs) printf "9001\tlint\tcompleted\tfailure\t15368\n9002\tcodecov\tcompleted\tsuccess\t9999\n" ;;'
OUT=$(cd "$P" && PATH="$P/.ghbin:$PATH" bash "$PROBE" HEAD 2>&1); RC=$?
[ "$RC" -eq 4 ] && ok "P2a: quota signature -> exit 4 (CI UNAVAILABLE)" || bad "P2a: expected 4, got $RC"
case "$OUT" in *"CI UNAVAILABLE (Actions quota/billing)"*) ok "P2a: UNAVAILABLE named";; *) bad "P2a: UNAVAILABLE not named";; esac
case "$OUT" in *"billing quota is exhausted"*) ok "P2a: annotation names the true cause";; *) bad "P2a: annotation cause missing";; esac

# ── P2b: first-party failure WITH steps -> 1 (not the signature) ──
make_gh_shim "$P" \
  '  repos/acme/widget/check-runs/7001) printf "%s\n" "[1,90]" ;;' \
  '  */check-runs) printf "7001\tlint\tcompleted\tfailure\t15368\n" ;;'
OUT=$(cd "$P" && PATH="$P/.ghbin:$PATH" bash "$PROBE" HEAD 2>&1); RC=$?
[ "$RC" -eq 1 ] && ok "P2b: real red (steps ran) -> exit 1" || bad "P2b: expected 1, got $RC"

# ── P2c: all green -> 0 ──
make_gh_shim "$P" \
  '  */check-runs) printf "1\tlint\tcompleted\tsuccess\t15368\n" ;;'
OUT=$(cd "$P" && PATH="$P/.ghbin:$PATH" bash "$PROBE" HEAD 2>&1); RC=$?
[ "$RC" -eq 0 ] && ok "P2c: all success -> exit 0" || bad "P2c: expected 0, got $RC"

# ── P2d: no check-runs -> 2 (pending / no-workflow-state) ──
make_gh_shim "$P" \
  '  */check-runs) : ;;'
OUT=$(cd "$P" && PATH="$P/.ghbin:$PATH" bash "$PROBE" HEAD 2>&1); RC=$?
[ "$RC" -eq 2 ] && ok "P2d: no check-runs -> exit 2" || bad "P2d: expected 2, got $RC"
case "$OUT" in *"MERGE CONFLICT looks exactly like this"*) ok "P2d: conflict-state hint present";; *) bad "P2d: conflict hint missing";; esac

echo ""
echo "Result: $PASS pass / $FAIL fail"
[ "$FAIL" -eq 0 ]
