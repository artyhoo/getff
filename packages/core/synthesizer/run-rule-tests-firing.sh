#!/usr/bin/env bash
# run-rule-tests-firing.sh — standing firing check for enrichment-sidecar rule-test material.
#
# The consumer-side companion to run-generated-rule-mutation.sh (npm lane). Where the mutation
# runner verifies npm-lane `negative-test` material, THIS runner verifies the NON-npm test
# material that lives in the S2 enrichment sidecar `.ai-factory/rule-tests/<backend>.json`
# (map `ruleId → { bad: string[], good: string[] }`, rule-tests-sidecar.ts). It exists so a
# hash-exempt repair of that material (spec §2) fails at a STANDING channel (pre-push) rather
# than only on an on-demand invocation — README earliest-reachable-channel / attention-is-not-a-
# mechanism.md §1 (`#hope-as-gate`).
#
# Reads from: .ai-factory/rule-tests/{astgrep,ruff,cargo}.json  (per-backend, all optional)
# Delivered to consumers as scripts/run-rule-tests-firing.sh (setup.d/40-configs.sh copy_safe,
# mirroring run-generated-rule-mutation.sh). Framework source: packages/core/synthesizer/.
#
# SINGLE-RULE ISOLATION (binding — spec §2 / T-RTS-C): reported codes alias across rules on ruff
# (TID251/TID253) and cargo (clippy::disallowed_methods), so firing runs one rule + one sample at
# a time in a fresh OS temp dir (mktemp -d — NEVER under the tracked tree). Mirrors the plant+fire
# mechanic of setup.d/45-python.sh:388 (_py_firing_self_check) and setup.d/46-cargo.sh:233.
#
# CONTRACT:
#   - sidecar absent/empty for a backend       → silent no-op for that backend.
#   - all sidecars absent                       → loud no-op, exit 0.
#   - lane tool absent for a present sidecar    → LOUD DEGRADED skip ("a skipped check is NOT
#                                                 green"), exit 0 (a skip must not block a push).
#   - bad[] sample does NOT fire, or good[]     → per-sample loud FAIL; overall exit 1 (RED).
#     sample DOES fire (broken material)
#
# JSON is parsed with `node` (guaranteed — this is a Node project; the pre-push hook itself runs
# under node), NOT jq (no hard jq dependency). Samples travel base64-encoded so multi-line code
# survives the tab-delimited stream unscathed.
#
# exit 0 = all present-lane material fired correctly OR loudly skipped; exit 1 = broken material.
# @cc-only-rationale: local/pre-push firing check, same session-bound axis as the mutation runner.
set -uo pipefail

# Repo root: $1 override (the pre-push section passes it explicitly), else the cwd git runs the
# hook from. Robust across the consumer (scripts/) and framework (packages/core/synthesizer/)
# delivery layouts — the script never derives the root from its own path.
REPO_ROOT="${1:-$PWD}"
# Optional $2 = single-backend filter (astgrep|ruff|cargo). Empty = all lanes. The pre-push
# section invokes one lane at a time (it does the per-lane tool-presence gating); an on-demand
# run with no filter fires every present backend.
ONLY_BACKEND="${2:-}"
RT_DIR="$REPO_ROOT/.ai-factory/rule-tests"
GETFF_DIR="$REPO_ROOT/.getff"
CARGO_TOGGLE="${GETFF_PREPUSH_CARGO_FIRE:-0}"

_overall_fail=0
_any_lane=0
_degraded=0

# One scratch parent for every per-sample plant dir; trap guarantees cleanup even on early exit
# (reviewer minor: per-sample mktemp dirs must not leak). Per-sample dirs live under here.
SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT
_mktemp_sample() { mktemp -d "$SCRATCH/s.XXXXXX"; }

# _degrade <message> — loud DEGRADED skip line + account it (never counted as green — T14).
_degrade() {
  echo "  ⚠ DEGRADED: $1 (a skipped check is NOT green)."
  _degraded=$((_degraded + 1))
}

# _validate_sidecar <file> — mirror of the S2 loader validateRuleTestsSidecar
# (packages/core/synthesizer/rule-tests-sidecar.ts:96-123 — keep in sync). SHAPE, not just parse:
# a malformed OR mis-shaped sidecar is BROKEN MATERIAL, not an absence (BLOCKER: `_emit_samples`
# coerces a missing/typo'd/empty field to zero samples, so a `badd` typo or empty `bad[]` would
# sail through green). Prints the first violation reason to stderr and exits non-zero; exit 0 on a
# fully-valid file. Rules (verbatim from the loader): top = object keyed by ruleId; each entry =
# object with keys ⊆ {bad,good}; `bad` AND `good` present; each = non-empty array of non-empty
# strings. NOT shipped to consumers is the loader itself (packages/core/synthesizer/ is unshipped),
# so the runner re-implements it inline rather than importing it.
_validate_sidecar() {
  node -e '
    const fs = require("node:fs");
    let m;
    try { m = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); }
    catch (e) { console.error("not valid JSON — " + e.message); process.exit(1); }
    const fail = (msg) => { console.error(msg); process.exit(1); };
    if (typeof m !== "object" || m === null || Array.isArray(m)) fail("top level must be an object keyed by ruleId");
    for (const [id, s] of Object.entries(m)) {
      if (typeof s !== "object" || s === null || Array.isArray(s)) fail("entry \"" + id + "\" must be an object { bad: string[], good: string[] }");
      for (const k of Object.keys(s)) if (k !== "bad" && k !== "good") fail("entry \"" + id + "\" has an unexpected key \"" + k + "\" (only \"bad\" and \"good\" are allowed)");
      if (!("bad" in s)) fail("entry \"" + id + "\" is missing \"bad\"");
      if (!("good" in s)) fail("entry \"" + id + "\" is missing \"good\"");
      for (const f of ["bad", "good"]) {
        const v = s[f];
        if (!Array.isArray(v)) fail("entry \"" + id + "\" field \"" + f + "\" must be an array of code samples");
        if (v.length === 0) fail("entry \"" + id + "\" field \"" + f + "\" must be a non-empty array (" + (f === "bad" ? "no violating sample = nothing fires" : "no clean counter-sample = over-firing unproven") + ")");
        for (const x of v) if (typeof x !== "string" || x.length === 0) fail("entry \"" + id + "\" field \"" + f + "\" each sample must be a non-empty string");
      }
    }
    process.exit(0);
  ' "$1"
}

# _fail_shape <lane> <file> <reason> — record a malformed/mis-shaped sidecar as a per-file RED
# (same class as bad-not-firing), never a silent skip.
_fail_shape() {
  echo "  ✗ FAIL [$1] sidecar is not valid rule-test material — broken material ($2)"
  echo "      reason: $3"
  _overall_fail=$((_overall_fail + 1))
}

# _emit_samples <sidecar.json> — stream `<ruleId>\t<bad|good>\t<base64-sample>` lines. Callers
# MUST _validate_sidecar the file first (the shape guard is what makes zero-samples impossible on a
# lane that reaches here); on a malformed file this prints nothing and node exits non-zero.
_emit_samples() {
  node -e '
    const fs = require("node:fs");
    const m = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    for (const [id, s] of Object.entries(m)) {
      for (const b of (s && s.bad)  || []) process.stdout.write(id + "\tbad\t"  + Buffer.from(String(b)).toString("base64") + "\n");
      for (const g of (s && s.good) || []) process.stdout.write(id + "\tgood\t" + Buffer.from(String(g)).toString("base64") + "\n");
    }
  ' "$1"
}

# _verdict <lane> <ruleId> <kind> <fired 0|1> — record + print a per-sample verdict.
# `fired` = 1 when the tool raised a diagnostic on the planted sample.
_verdict() {
  local lane="$1" rid="$2" kind="$3" fired="$4"
  if [ "$kind" = "bad" ]; then
    if [ "$fired" -eq 1 ]; then
      echo "  ✓ [$lane $rid] bad sample fired RED"
    else
      echo "  ✗ FAIL [$lane $rid] bad sample did NOT fire — broken material (the rule is blind to this violation)"
      _overall_fail=$((_overall_fail + 1))
    fi
  else
    if [ "$fired" -eq 1 ]; then
      echo "  ✗ FAIL [$lane $rid] good sample FIRED — over-fire (a conforming sample is flagged)"
      _overall_fail=$((_overall_fail + 1))
    else
      echo "  ✓ [$lane $rid] good sample clean"
    fi
  fi
}

# ── astgrep lane ──────────────────────────────────────────────────────────────
# TRUE single-rule isolation: the delivered per-rule config .getff/astgrep-rules/<ruleId>.yml is
# the ONLY rule planted, so any error-severity finding is unambiguously that rule.
_fire_astgrep() {
  local sidecar="$RT_DIR/astgrep.json"
  [ -f "$sidecar" ] || return 0
  _any_lane=1
  local _why
  if ! _why="$(_validate_sidecar "$sidecar" 2>&1)"; then _fail_shape astgrep "$sidecar" "$_why"; return 0; fi
  local sg=""
  if   command -v ast-grep >/dev/null 2>&1; then sg="ast-grep"
  elif command -v sg       >/dev/null 2>&1; then sg="sg"; fi
  if [ -z "$sg" ]; then
    _degrade "ast-grep not on PATH — astgrep rule-test firing NOT proven"
    return 0
  fi
  echo "▶ astgrep firing (single-rule isolation) — $sidecar"
  local rid kind b64 rule_yml t rc
  while IFS=$'\t' read -r rid kind b64; do
    [ -n "$rid" ] || continue
    # Safe-charset guard before building a filesystem path (parity with the ruff lane) — a rogue
    # ruleId with '/' or '..' must never traverse out of the delivered rules dir.
    if ! printf '%s' "$rid" | grep -qE '^[A-Za-z0-9._-]+$'; then
      _degrade "astgrep sidecar key '$rid' is not a safe rule id — firing NOT proven"
      continue
    fi
    rule_yml="$GETFF_DIR/astgrep-rules/$rid.yml"
    if [ ! -f "$rule_yml" ]; then
      _degrade "no delivered rule config .getff/astgrep-rules/$rid.yml — firing NOT proven"
      continue
    fi
    t="$(_mktemp_sample)"
    mkdir -p "$t/rules"
    cp "$rule_yml" "$t/rules/"
    printf 'ruleDirs:\n  - %s\n' "$t/rules" > "$t/sgconfig.yml"
    printf '%s' "$b64" | base64 -d > "$t/sample.py"
    rc=0
    ( cd "$t" && "$sg" scan . ) >/dev/null 2>&1 || rc=$?
    # ast-grep exits non-zero when an error-severity rule matches (same signal
    # _py_firing_self_check relies on); rc != 0 → fired.
    if [ "$rc" -ne 0 ]; then _verdict astgrep "$rid" "$kind" 1; else _verdict astgrep "$rid" "$kind" 0; fi
    rm -rf "$t"
  done < <(_emit_samples "$sidecar")
}

# ── ruff lane ─────────────────────────────────────────────────────────────────
# Isolation at the granularity ruff reports (its custom surface is the CLOSED flake8-tidy-imports
# vocabulary — TID251 banned-api + TID253 banned-module-level-imports). The sidecar key must BE a
# ruff code (the tool-reported id, per rule-tests-sidecar.ts): a temp config selects ONLY that one
# code from the delivered .getff/ruff-bans.toml bans, so other codes cannot mask the verdict. A
# non-code key (e.g. a getff ruleId) is NOT per-rule-isolable from delivered v0 artifacts — loud
# skip rather than a meaningless non-isolated green (T-RTS-C). Promotion trigger: a sidecar that
# carries per-rule ban metadata → true per-getff-rule ruff isolation.
_fire_ruff() {
  local sidecar="$RT_DIR/ruff.json"
  [ -f "$sidecar" ] || return 0
  _any_lane=1
  local _why
  if ! _why="$(_validate_sidecar "$sidecar" 2>&1)"; then _fail_shape ruff "$sidecar" "$_why"; return 0; fi
  local ruff_mode=""
  if   command -v ruff >/dev/null 2>&1; then ruff_mode="ruff"
  elif command -v uvx  >/dev/null 2>&1; then ruff_mode="uvx"; fi
  if [ -z "$ruff_mode" ]; then
    _degrade "ruff not on PATH — ruff rule-test firing NOT proven"
    return 0
  fi
  local bans="$GETFF_DIR/ruff-bans.toml"
  if [ ! -f "$bans" ]; then
    _degrade "no delivered .getff/ruff-bans.toml — ruff firing NOT proven"
    return 0
  fi
  echo "▶ ruff firing (single-code isolation) — $sidecar"
  local rid kind b64 t cfg rc
  while IFS=$'\t' read -r rid kind b64; do
    [ -n "$rid" ] || continue
    if ! printf '%s' "$rid" | grep -qE '^[A-Z]+[0-9]+$'; then
      _degrade "ruff sidecar key '$rid' is not a ruff code — per-rule isolation unsupported in v0"
      continue
    fi
    t="$(_mktemp_sample)"
    cfg="$t/ruff.toml"
    # Narrow select to the one code under test; keep the delivered ban tables verbatim.
    if grep -qE '^[[:space:]]*select[[:space:]]*=' "$bans"; then
      sed -E "s/^[[:space:]]*select[[:space:]]*=.*/select = [\"$rid\"]/" "$bans" > "$cfg"
    else
      { printf 'select = ["%s"]\n' "$rid"; cat "$bans"; } > "$cfg"
    fi
    printf '%s' "$b64" | base64 -d > "$t/sample.py"
    rc=0
    if [ "$ruff_mode" = "uvx" ]; then
      ( cd "$t" && uvx ruff@0.15.21 check --no-cache --config "$cfg" sample.py ) >/dev/null 2>&1 || rc=$?
    else
      ( cd "$t" && ruff check --no-cache --config "$cfg" sample.py ) >/dev/null 2>&1 || rc=$?
    fi
    if [ "$rc" -ne 0 ]; then _verdict ruff "$rid" "$kind" 1; else _verdict ruff "$rid" "$kind" 0; fi
    rm -rf "$t"
  done < <(_emit_samples "$sidecar")
}

# ── cargo lane (OPT-IN — compile cost) ────────────────────────────────────────
# `cargo clippy` compiles on every invocation, so this lane is OFF by default and gated on
# GETFF_PREPUSH_CARGO_FIRE=1 (D-S5-guards). When enabled it mirrors _cargo_firing_self_check
# (setup.d/46-cargo.sh:233) in single-rule isolation.
_fire_cargo() {
  local sidecar="$RT_DIR/cargo.json"
  [ -f "$sidecar" ] || return 0
  _any_lane=1
  local _why
  if ! _why="$(_validate_sidecar "$sidecar" 2>&1)"; then _fail_shape cargo "$sidecar" "$_why"; return 0; fi
  if [ "$CARGO_TOGGLE" != "1" ]; then
    echo "  ⚠ cargo firing arm is opt-in (compile cost) — set GETFF_PREPUSH_CARGO_FIRE=1 to enable; a skipped check is NOT green."
    _degraded=$((_degraded + 1))
    return 0
  fi
  if ! command -v cargo >/dev/null 2>&1; then
    _degrade "cargo not on PATH — cargo rule-test firing NOT proven"
    return 0
  fi
  echo "▶ cargo firing (single-rule isolation, opt-in) — $sidecar"
  local rid kind b64 clippy_cfg t rc
  clippy_cfg=""
  [ -f "$GETFF_DIR/clippy.toml" ] && clippy_cfg="$GETFF_DIR/clippy.toml"
  while IFS=$'\t' read -r rid kind b64; do
    [ -n "$rid" ] || continue
    if [ -z "$clippy_cfg" ]; then
      _degrade "no delivered .getff/clippy.toml — cargo firing NOT proven"
      continue
    fi
    t="$(_mktemp_sample)"
    mkdir -p "$t/src"
    printf '%s' "$b64" | base64 -d > "$t/src/lib.rs"
    printf '[package]\nname = "getff_fire"\nversion = "0.0.0"\nedition = "2021"\n' > "$t/Cargo.toml"
    cp "$clippy_cfg" "$t/clippy.toml"
    rc=0
    ( cd "$t" && cargo clippy --quiet -- -D warnings ) >/dev/null 2>&1 || rc=$?
    if [ "$rc" -ne 0 ]; then _verdict cargo "$rid" "$kind" 1; else _verdict cargo "$rid" "$kind" 0; fi
    rm -rf "$t"
  done < <(_emit_samples "$sidecar")
}

# ── main ──────────────────────────────────────────────────────────────────────
if [ ! -d "$RT_DIR" ]; then
  echo "rule-tests firing: no .ai-factory/rule-tests/ sidecar dir — nothing to fire (no-op)."
  exit 0
fi

# _wants <backend> — true when the caller asked for this lane (or for all lanes).
_wants() { [ -z "$ONLY_BACKEND" ] || [ "$ONLY_BACKEND" = "$1" ]; }

_wants astgrep && _fire_astgrep
_wants ruff    && _fire_ruff
_wants cargo   && _fire_cargo

if [ "$_any_lane" -eq 0 ]; then
  echo "rule-tests firing: no backend sidecar present — nothing to fire (no-op)."
  exit 0
fi

echo ""
if [ "$_overall_fail" -gt 0 ]; then
  echo "❌ rule-tests firing: $_overall_fail broken sample(s) — repaired material is not sound. Fix the sidecar (never the rule artifact — T-RTS-B) and re-run."
  exit 1
fi
if [ "$_degraded" -gt 0 ]; then
  echo "⚠ rule-tests firing: verified material fired correctly · $_degraded lane(s)/sample(s) NOT proven (tool or config absent) — a skipped check is NOT green; run the DEGRADED item(s) above to prove them."
  exit 0
fi
echo "✓ rule-tests firing: all present-lane sidecar material fired correctly."
exit 0
