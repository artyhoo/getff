#!/usr/bin/env bash
# run-rule-tests-firing.test.sh — shim-driven regression home for the firing runner's "fired"
# decision (findings A7-2 / A7-3 / A7-5, ledger-1597): every lane of
# run-rule-tests-firing.sh must decide "fired" from the linter's STRUCTURED diagnostics
# (rule id / diagnostic code in the tool's JSON output), NEVER from the process exit code.
#
# Why shims: the runtime has NO ast-grep / ruff / cargo (the linters install only in CI and
# on consumers), so every arm drives the REAL runner through a fake `ast-grep` / `ruff` /
# `cargo` on PATH that emits a RECORDED diagnostic payload + the exit code named in the
# finding — the firing-harness-as-data pattern (committed fixture + scripted firing stdout,
# SSOT #199's PMD precedent). Real-tool coverage stays with the consumer-layout arms in
# packages/core/hooks/pre-push.consumer-layout.test.ts (green-skip without the tool).
#
# Live-fire contract (mirrors run-generated-rule-mutation.test.sh): every arm RUNS the real
# runner against a fixture consumer tree and asserts its verdict lines + exit code. Nothing
# here greps the runner's source text.
#
# The runner discards tool STDERR (every lane redirects 2>/dev/null), so a shim scripts
# STDOUT + exit code only — stderr could never move a verdict.
#
# Shot model: the runner fires the tool once per sample, in `_emit_samples` order — all
# bad[] first, then good[], per rule — so a one-rule sidecar = shot 1 = bad, shot 2 = good.
# `_shim2` scripts each shot's payload + rc; shots beyond the scripted ones repeat the last.
#
# Portability: bash 3.2-compatible (no mapfile / associative arrays / ${var,,}).
# Requires node on PATH (the runner parses JSON with node, not jq).

set -uo pipefail

TEST_ROOT="$(cd "$(dirname "$0")" && pwd -P)"
# Runner under test — overridable as $1 so a pre-fix variant can be pointed at; CI / sweep
# invoke with NO argument, so the default must resolve to the tracked runner.
RUNNER="${1:-$TEST_ROOT/run-rule-tests-firing.sh}"

PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ok: $1"; }
bad() { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }

SCRATCH="$(cd "$(mktemp -d)" && pwd -P)"
# shellcheck disable=SC2329  # invoked indirectly, via `trap cleanup EXIT`
cleanup() { rm -rf "$SCRATCH"; }
trap cleanup EXIT

assert_rc() { # <label> <expected-rc> <rc-file>
  if [ "$(cat "$3")" = "$2" ]; then ok "$1 (rc=$2)"; else bad "$1 — expected rc=$2, got rc=$(cat "$3")"; fi
}
assert_contains() { # <label> <haystack-file> <needle>
  if grep -qF -- "$3" "$2"; then ok "$1"; else
    bad "$1 — missing: $3"
    echo "      observed: $(grep -m1 -E '✓|✗|❌|⚠' "$2" 2>/dev/null | head -1)"
  fi
}
assert_not_contains() { # <label> <haystack-file> <needle>
  if grep -qF -- "$3" "$2"; then bad "$1 — must NOT contain: $3"; else ok "$1"; fi
}

BIN_DIR="$SCRATCH/bin"
mkdir -p "$BIN_DIR"

# _shim2 <name> <rc1> <out1> <rc2> <out2> — write a fake tool: shot 1 cats <out1> + exits
# <rc1>; shot 2+ cats <out2> + exits <rc2>. The counter file lives in BIN_DIR and is reset
# on every rewrite, so each arm starts from shot 1.
_shim2() {
  local name="$1" rc1="$2" out1="$3" rc2="$4" out2="$5"
  rm -f "$BIN_DIR/.shots-$name"
  cat > "$BIN_DIR/$name" <<EOF
#!/bin/sh
# generated shim — scripted stdout + exit code per invocation shot (see header comment)
SHOTS="$BIN_DIR/.shots-$name"
n=\$(cat "\$SHOTS" 2>/dev/null || echo 0)
n=\$((n + 1))
echo "\$n" > "\$SHOTS"
if [ "\$n" -le 1 ]; then
  [ -s "$out1" ] && cat "$out1"
  exit $rc1
fi
[ -s "$out2" ] && cat "$out2"
exit $rc2
EOF
  chmod +x "$BIN_DIR/$name"
}

# _sidecar <dest> <rid> <bad-sample> <good-sample> — valid-shape sidecar (one rule, one
# sample per arm), written via node so multi-line samples JSON-escape correctly.
_sidecar() {
  node -e '
    const [dest, rid, bad, good] = process.argv.slice(1);
    const m = { [rid]: { bad: [bad], good: [good] } };
    require("node:fs").writeFileSync(dest, JSON.stringify(m, null, 2) + "\n");
  ' "$1" "$2" "$3" "$4"
}

# _consumer_tree <tag> <backend> <sidecar.json> <rid> — fixture consumer tree (unique per
# arm tag): the sidecar plus every lane's delivered config stub (.getff/astgrep-rules/<rid>.yml,
# .getff/ruff-bans.toml with a `select =` line so the runner's sed-narrow path is exercised,
# .getff/clippy.toml). Prints the tree path. The sidecar must already exist (write it with
# _sidecar FIRST).
_consumer_tree() {
  local tag="$1" backend="$2" sidecar="$3" rid="$4"
  local tree="$SCRATCH/tree-$tag"
  mkdir -p "$tree/.ai-factory/rule-tests" "$tree/.getff/astgrep-rules"
  cp "$sidecar" "$tree/.ai-factory/rule-tests/$backend.json"
  { printf 'id: %s\n' "$rid"
    printf 'language: Python\nseverity: warning\nrule:\n  pattern: yaml.load($X)\n'
  } > "$tree/.getff/astgrep-rules/$rid.yml"
  cat > "$tree/.getff/ruff-bans.toml" <<'TOML'
select = ["E4", "F401"]

[lint.flake8-tidy-imports.banned-api]
"requests".msg = "Use httpx instead."
TOML
  printf 'disallowed-methods = [{ path = "std::env::var", reason = "use a typed config layer" }]\n' \
    > "$tree/.getff/clippy.toml"
  printf '%s' "$tree"
}

# run_firing <tree> <backend> <tag> [cargo-toggle] — invoke the runner the way a consumer
# does (env-clean apart from PATH + the lane toggle), capturing out/err/rc under <tag>.*
run_firing() {
  local tree="$1" backend="$2" tag="$3" toggle="${4:-0}"
  if [ "$toggle" = "1" ]; then
    ( cd "$SCRATCH" && env -i PATH="$BIN_DIR:$PATH" GETFF_PREPUSH_CARGO_FIRE=1 \
        bash "$RUNNER" "$tree" "$backend" ) >"$SCRATCH/$tag.out" 2>"$SCRATCH/$tag.err"
  else
    ( cd "$SCRATCH" && env -i PATH="$BIN_DIR:$PATH" \
        bash "$RUNNER" "$tree" "$backend" ) >"$SCRATCH/$tag.out" 2>"$SCRATCH/$tag.err"
  fi
  echo $? > "$SCRATCH/$tag.rc"
  cat "$SCRATCH/$tag.out" "$SCRATCH/$tag.err" > "$SCRATCH/$tag.all"
}

# ── shared samples ────────────────────────────────────────────────────────────
BAD_PY='import yaml
data = yaml.load(raw)
'
GOOD_PY='import yaml
data = yaml.safe_load(raw)
'

# ── ast-grep lane (A7-2) ──────────────────────────────────────────────────────
# ast-grep exits 0 on a matched warning/hint-severity rule and 8 on unparseable rule YAML,
# so exit code ≠ firing: a firing warning rule was reported broken (false RED) and a broken
# rule file reported every bad[] sample as fired. Diagnostic truth = `scan --json` ruleIds.
SG_RID='no-yaml-load'
SG_FIRE_JSON="$SCRATCH/sg-fire.json"
printf '%s\n' '[{"ruleId":"no-yaml-load","severity":"warning","message":"avoid yaml.load","file":"sample.py"}]' > "$SG_FIRE_JSON"
SG_CLEAN_JSON="$SCRATCH/sg-clean.json"
printf '%s\n' '[]' > "$SG_CLEAN_JSON"
SG_EMPTY="$SCRATCH/sg-empty.json"
: > "$SG_EMPTY"

arm_sg_a() { # firing warning-severity rule: bad[] must read as fired RED (the A7-2 false-RED case)
  echo "arm sg-a: exit 0 + warning-severity match on bad[] — must count as FIRED"
  _shim2 ast-grep 0 "$SG_FIRE_JSON" 0 "$SG_CLEAN_JSON"
  _sidecar "$SCRATCH/sg-a.json" "$SG_RID" "$BAD_PY" "$GOOD_PY"
  local tree; tree="$(_consumer_tree sg-a astgrep "$SCRATCH/sg-a.json" "$SG_RID")"
  run_firing "$tree" astgrep "sg-a"
  assert_rc        "sg-a run exits 0 (sound material)" 0 "$SCRATCH/sg-a.rc"
  assert_contains  "sg-a bad sample read as fired RED" "$SCRATCH/sg-a.all" "bad sample fired RED"
  assert_contains  "sg-a good sample clean" "$SCRATCH/sg-a.all" "good sample clean"
}
arm_sg_b() { # same firing JSON on BOTH shots: good[] must read as over-fire (broken material)
  echo "arm sg-b: exit 0 + warning-severity match on good[] — must count as over-fire"
  _shim2 ast-grep 0 "$SG_FIRE_JSON" 0 "$SG_FIRE_JSON"
  _sidecar "$SCRATCH/sg-b.json" "$SG_RID" "$BAD_PY" "$GOOD_PY"
  local tree; tree="$(_consumer_tree sg-b astgrep "$SCRATCH/sg-b.json" "$SG_RID")"
  run_firing "$tree" astgrep "sg-b"
  assert_rc        "sg-b run exits 1 (over-fire is broken material)" 1 "$SCRATCH/sg-b.rc"
  assert_contains  "sg-b bad sample fired RED" "$SCRATCH/sg-b.all" "bad sample fired RED"
  assert_contains  "sg-b good sample read as over-fire" "$SCRATCH/sg-b.all" "FIRED — over-fire"
}
arm_sg_c() { # exit 8 + no diagnostics: broken RULE file → rule invalid, never "fired"
  echo "arm sg-c: exit 8 (unparseable rule YAML) — rule invalid, never fired"
  _shim2 ast-grep 8 "$SG_EMPTY" 8 "$SG_EMPTY"
  _sidecar "$SCRATCH/sg-c.json" "$SG_RID" "$BAD_PY" "$GOOD_PY"
  local tree; tree="$(_consumer_tree sg-c astgrep "$SCRATCH/sg-c.json" "$SG_RID")"
  run_firing "$tree" astgrep "sg-c"
  assert_rc          "sg-c run exits 1 (rule invalid is RED)" 1 "$SCRATCH/sg-c.rc"
  assert_contains    "sg-c verdict is rule invalid" "$SCRATCH/sg-c.all" "rule invalid"
  assert_not_contains "sg-c no sample counted as fired" "$SCRATCH/sg-c.all" "fired RED"
}
arm_sg_d() { # exit 0 + zero diagnostics: good[] clean; the blind bad[] arm stays honestly RED
  echo "arm sg-d: exit 0 + [] — good clean, bad honestly did NOT fire"
  _shim2 ast-grep 0 "$SG_CLEAN_JSON" 0 "$SG_CLEAN_JSON"
  _sidecar "$SCRATCH/sg-d.json" "$SG_RID" "$BAD_PY" "$GOOD_PY"
  local tree; tree="$(_consumer_tree sg-d astgrep "$SCRATCH/sg-d.json" "$SG_RID")"
  run_firing "$tree" astgrep "sg-d"
  assert_rc        "sg-d run exits 1 (bad[] blind = broken material)" 1 "$SCRATCH/sg-d.rc"
  assert_contains  "sg-d good sample clean" "$SCRATCH/sg-d.all" "good sample clean"
  assert_contains  "sg-d bad sample honestly did NOT fire" "$SCRATCH/sg-d.all" "did NOT fire"
}

# ── ruff lane (A7-5) ──────────────────────────────────────────────────────────
# ruff exits 1 for a syntax error in the sample REGARDLESS of the narrowed select (and 2
# for a config error), so exit code ≠ firing: an unparsable bad[] sample was reported as
# firing the code under test — an arm that could never go RED for that sample. Diagnostic
# truth = `check --output-format json` codes; `code: null` = the sample does not parse.
# (The `uvx` invocation branch gets the same flag appended; it is not shimmed — a fake
# `uvx` swallows its args, so the arm could not observe anything the `ruff` arm doesn't.)
RU_RID='TID251'
RU_FIRE_JSON="$SCRATCH/ru-fire.json"
printf '%s\n' '[{"code":"TID251","message":"requests is banned — use httpx","url":"https://docs.astral.sh/ruff/rules/banned-api/","file":"sample.py"}]' > "$RU_FIRE_JSON"
RU_SYNTAX_JSON="$SCRATCH/ru-syntax.json"
printf '%s\n' '[{"code":null,"message":"SyntaxError: unexpected EOF while parsing (sample.py:2)","url":"https://docs.astral.sh/ruff/","file":"sample.py"}]' > "$RU_SYNTAX_JSON"
RU_CLEAN_JSON="$SCRATCH/ru-clean.json"
printf '%s\n' '[]' > "$RU_CLEAN_JSON"
RU_EMPTY="$SCRATCH/ru-empty.json"
: > "$RU_EMPTY"

arm_ru_a() { # real TID251 match (exit 1 + code): bad[] fired RED; good[] clean on a quiet run
  echo "arm ru-a: exit 1 + TID251 on bad[] — fired RED; good[] quiet — clean"
  _shim2 ruff 1 "$RU_FIRE_JSON" 0 "$RU_CLEAN_JSON"
  _sidecar "$SCRATCH/ru-a.json" "$RU_RID" 'import requests
x = requests.get(1)
' 'import httpx
x = httpx.get(1)
'
  local tree; tree="$(_consumer_tree ru-a ruff "$SCRATCH/ru-a.json" "$RU_RID")"
  run_firing "$tree" ruff "ru-a"
  assert_rc        "ru-a run exits 0 (sound material)" 0 "$SCRATCH/ru-a.rc"
  assert_contains  "ru-a bad sample read as fired RED" "$SCRATCH/ru-a.all" "bad sample fired RED"
  assert_contains  "ru-a good sample clean" "$SCRATCH/ru-a.all" "good sample clean"
}
arm_ru_b() { # exit 1 + code:null on BOTH shots: syntax-error sample proves NOTHING (A7-5)
  echo "arm ru-b: exit 1 + code:null (syntax error) — sample invalid on both arms, never fired"
  _shim2 ruff 1 "$RU_SYNTAX_JSON" 1 "$RU_SYNTAX_JSON"
  _sidecar "$SCRATCH/ru-b.json" "$RU_RID" 'import requests
x = requests.get(1)
' 'import httpx
x = httpx.get(1)
'
  local tree; tree="$(_consumer_tree ru-b ruff "$SCRATCH/ru-b.json" "$RU_RID")"
  run_firing "$tree" ruff "ru-b"
  assert_rc          "ru-b run exits 1 (sample invalid is RED)" 1 "$SCRATCH/ru-b.rc"
  assert_contains    "ru-b bad[] sample invalid" "$SCRATCH/ru-b.all" "sample invalid"
  assert_contains    "ru-b good[] sample invalid" "$SCRATCH/ru-b.all" "sample invalid"
  assert_not_contains "ru-b no sample counted as fired" "$SCRATCH/ru-b.all" "fired RED"
}
arm_ru_c() { # exit 2 (config error): the RULE artifact is broken — rule invalid, never fired
  echo "arm ru-c: exit 2 (config error) — rule invalid, never fired"
  _shim2 ruff 2 "$RU_EMPTY" 2 "$RU_EMPTY"
  _sidecar "$SCRATCH/ru-c.json" "$RU_RID" 'import requests
x = requests.get(1)
' 'import httpx
x = httpx.get(1)
'
  local tree; tree="$(_consumer_tree ru-c ruff "$SCRATCH/ru-c.json" "$RU_RID")"
  run_firing "$tree" ruff "ru-c"
  assert_rc          "ru-c run exits 1 (rule invalid is RED)" 1 "$SCRATCH/ru-c.rc"
  assert_contains    "ru-c verdict is rule invalid" "$SCRATCH/ru-c.all" "rule invalid"
  assert_not_contains "ru-c no sample counted as fired" "$SCRATCH/ru-c.all" "fired RED"
}
arm_ru_d() { # exit 0 + zero diagnostics: good[] clean; the blind bad[] arm stays honestly RED
  echo "arm ru-d: exit 0 + [] — good clean, bad honestly did NOT fire"
  _shim2 ruff 0 "$RU_CLEAN_JSON" 0 "$RU_CLEAN_JSON"
  _sidecar "$SCRATCH/ru-d.json" "$RU_RID" 'import requests
x = requests.get(1)
' 'import httpx
x = httpx.get(1)
'
  local tree; tree="$(_consumer_tree ru-d ruff "$SCRATCH/ru-d.json" "$RU_RID")"
  run_firing "$tree" ruff "ru-d"
  assert_rc        "ru-d run exits 1 (bad[] blind = broken material)" 1 "$SCRATCH/ru-d.rc"
  assert_contains  "ru-d good sample clean" "$SCRATCH/ru-d.all" "good sample clean"
  assert_contains  "ru-d bad sample honestly did NOT fire" "$SCRATCH/ru-d.all" "did NOT fire"
}

# ── cargo lane (A7-3, opt-in GETFF_PREPUSH_CARGO_FIRE=1) ─────────────────────
# `cargo clippy -- -D warnings` exits ≠0 on ANY compile error or unrelated warning (dead_code
# on the private `fn main` every pairedExamples sample carries, E0433 unresolved crate), so
# exit code ≠ firing. Diagnostic truth = `--message-format=json` codes (the identity the TS
# contract extracts, $.message.code.code): the sidecar key IS the clippy code, mirroring
# _cargo_firing_self_check, which "reads the code regardless of warn/deny level". The sidecar
# key for this lane is therefore the clippy lint name itself (`clippy::disallowed_methods`).
CA_RID='clippy::disallowed_methods'
CA_FIRE_NDJSON="$SCRATCH/ca-fire.ndjson"
# Warning-LEVEL ban diagnostic + exit 0 — the honest post-fix invocation (no -D warnings);
# the code carries the firing, exactly as _cargo_firing_self_check reads it.
cat > "$CA_FIRE_NDJSON" <<'NDJSON'
{"reason":"compiler-artifact","package_id":"getff_fire 0.0.0","target":{},"profile":{},"filenames":[]}
{"reason":"compiler-message","package_id":"getff_fire 0.0.0","message":{"rendered":"warning: use of disallowed method `std::env::var`","code":{"code":"clippy::disallowed_methods","explanation":null},"level":"warning","spans":[],"children":[]}}
{"reason":"build-finished","success":false}
NDJSON
CA_CLEAN_NDJSON="$SCRATCH/ca-clean.ndjson"
cat > "$CA_CLEAN_NDJSON" <<'NDJSON'
{"reason":"build-finished","success":true}
NDJSON
CA_E0433_NDJSON="$SCRATCH/ca-e0433.ndjson"
# rustc hard error only — the sample does not COMPILE; it proves nothing in either direction.
cat > "$CA_E0433_NDJSON" <<'NDJSON'
{"reason":"compiler-message","package_id":"getff_fire 0.0.0","message":{"rendered":"error[E0433]: failed to resolve: use of undeclared crate or module `app_config`","code":{"code":"E0433","explanation":null},"level":"error","spans":[],"children":[]}}
{"reason":"build-finished","success":false}
NDJSON
CA_DEADCODE_NDJSON="$SCRATCH/ca-deadcode.ndjson"
# An unrelated warning (dead_code) with no banned-code diagnostic: the ban did NOT fire.
cat > "$CA_DEADCODE_NDJSON" <<'NDJSON'
{"reason":"compiler-message","package_id":"getff_fire 0.0.0","message":{"rendered":"warning: function `f` is never used","code":{"code":"dead_code","explanation":null},"level":"warning","spans":[],"children":[]}}
{"reason":"build-finished","success":true}
NDJSON
CA_NOISE_NDJSON="$SCRATCH/ca-noise.ndjson"
# Heterogeneous NDJSON: non-JSON noise + compiler-artifact + build-finished lines must be
# skipped (parseCodesFromStdout tolerance); the compiler-message carries the firing.
cat > "$CA_NOISE_NDJSON" <<'NDJSON'
   Compiling getff_fire v0.0.0 (noise line — not JSON)
{"reason":"compiler-artifact","package_id":"getff_fire 0.0.0","target":{},"profile":{},"filenames":[]}
{"reason":"compiler-message","package_id":"getff_fire 0.0.0","message":{"rendered":"warning: use of disallowed method `std::env::var`","code":{"code":"clippy::disallowed_methods","explanation":null},"level":"warning","spans":[],"children":[]}}
{"reason":"build-finished","success":false}
NDJSON

arm_ca_a() { # warning-level banned-code diagnostic, exit 0: fired from the CODE, not the rc
  echo "arm ca-a: warning-level clippy::disallowed_methods + rc 0 — fired"
  _shim2 cargo 0 "$CA_FIRE_NDJSON" 0 "$CA_CLEAN_NDJSON"
  _sidecar "$SCRATCH/ca-a.json" "$CA_RID" 'fn f() {
    let _ = std::env::var("HOME");
}
' 'fn f() {
    let _ = std::env::args();
}
'
  local tree; tree="$(_consumer_tree ca-a cargo "$SCRATCH/ca-a.json" "$CA_RID")"
  run_firing "$tree" cargo "ca-a" 1
  assert_rc        "ca-a run exits 0 (sound material)" 0 "$SCRATCH/ca-a.rc"
  assert_contains  "ca-a bad sample read as fired RED" "$SCRATCH/ca-a.all" "bad sample fired RED"
  assert_contains  "ca-a good sample clean" "$SCRATCH/ca-a.all" "good sample clean"
}
arm_ca_b() { # E0433-only compile error + rc≠0 on BOTH shots: sample invalid, never fired (A7-3)
  echo "arm ca-b: rc≠0 + E0433 only — sample invalid on both arms, never fired"
  _shim2 cargo 1 "$CA_E0433_NDJSON" 1 "$CA_E0433_NDJSON"
  _sidecar "$SCRATCH/ca-b.json" "$CA_RID" 'fn f() {
    let _ = std::env::var("HOME");
}
' 'fn f() {
    let _ = std::env::args();
}
'
  local tree; tree="$(_consumer_tree ca-b cargo "$SCRATCH/ca-b.json" "$CA_RID")"
  run_firing "$tree" cargo "ca-b" 1
  assert_rc          "ca-b run exits 1 (sample invalid is RED)" 1 "$SCRATCH/ca-b.rc"
  assert_contains    "ca-b bad[] sample invalid" "$SCRATCH/ca-b.all" "sample invalid"
  assert_contains    "ca-b good[] sample invalid" "$SCRATCH/ca-b.all" "sample invalid"
  assert_not_contains "ca-b no sample counted as fired" "$SCRATCH/ca-b.all" "fired RED"
}
arm_ca_c() { # dead_code-only warning + rc 0: the ban did NOT fire — good[] clean (test-fixtures scenario)
  echo "arm ca-c: dead_code-only warning + rc 0 — good clean, bad honestly did NOT fire"
  _shim2 cargo 0 "$CA_DEADCODE_NDJSON" 0 "$CA_DEADCODE_NDJSON"
  _sidecar "$SCRATCH/ca-c.json" "$CA_RID" 'fn f() {
    let _ = std::env::var("HOME");
}
' 'fn f() {
    let _ = std::env::args();
}
'
  local tree; tree="$(_consumer_tree ca-c cargo "$SCRATCH/ca-c.json" "$CA_RID")"
  run_firing "$tree" cargo "ca-c" 1
  assert_rc        "ca-c run exits 1 (bad[] blind = broken material)" 1 "$SCRATCH/ca-c.rc"
  assert_contains  "ca-c good sample clean (dead_code is not the ban firing)" "$SCRATCH/ca-c.all" "good sample clean"
  assert_contains  "ca-c bad sample honestly did NOT fire" "$SCRATCH/ca-c.all" "did NOT fire"
}
arm_ca_d() { # non-JSON noise + compiler-artifact/build-finished lines skipped; code still read
  echo "arm ca-d: heterogeneous NDJSON — noise skipped, compiler-message still read"
  _shim2 cargo 0 "$CA_NOISE_NDJSON" 0 "$CA_CLEAN_NDJSON"
  _sidecar "$SCRATCH/ca-d.json" "$CA_RID" 'fn f() {
    let _ = std::env::var("HOME");
}
' 'fn f() {
    let _ = std::env::args();
}
'
  local tree; tree="$(_consumer_tree ca-d cargo "$SCRATCH/ca-d.json" "$CA_RID")"
  run_firing "$tree" cargo "ca-d" 1
  assert_rc        "ca-d run exits 0 (noise tolerated, code read)" 0 "$SCRATCH/ca-d.rc"
  assert_contains  "ca-d bad sample fired RED despite noise lines" "$SCRATCH/ca-d.all" "bad sample fired RED"
  assert_contains  "ca-d good sample clean" "$SCRATCH/ca-d.all" "good sample clean"
}

[ -f "$RUNNER" ] || { echo "runner not found: $RUNNER" >&2; exit 2; }
arm_sg_a
arm_sg_b
arm_sg_c
arm_sg_d
arm_ru_a
arm_ru_b
arm_ru_c
arm_ru_d
arm_ca_a
arm_ca_b
arm_ca_c
arm_ca_d

echo
echo "run-rule-tests-firing.test.sh: PASS=$PASS FAIL=$FAIL (lanes exercised via shim: astgrep, ruff, cargo)"
[ "$FAIL" -eq 0 ] || exit 1
exit 0
