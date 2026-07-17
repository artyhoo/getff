#!/usr/bin/env bash
# @dual-pair: deps-hash-check-dogfood
# spec: packages/core/hooks/deps-hash-check.sh — packages/ copy is the SOURCE shipped by
# install.sh:261; .claude/ copy is this repo's dogfood instance wired in settings.json.
# The two are kept byte-identical; drift is guarded by deps-hash-check.test.ts (#382 §6).
# Consumer-facing UserPromptSubmit hook — DH-S1 multistack (kickoff #1016).
#
# Staleness detector covering three stacks: JS (package.json), python (pyproject.toml),
# rust (Cargo.toml — DETECTION ONLY in DH-S2; this stage ships JS-widen + python). At each
# session start it sha256-hashes the consumer's DECLARED deps per present stack and compares
# against per-stack baselines in .ai-factory/tool-decisions.md; on any mismatch it prints a
# one-line WARN into session context (the harness auto-injects stdout) telling the agent to
# re-run tool-bootstrapping. Non-blocking; always exits 0.
#
# Two-tier extraction ladder (design §1-B):
#   Tier-1 (default, zero deps): bash/awk table-boundary hash of the relevant TOML tables.
#     For python the 6 non-[project] dep tables (design §4 — [project] is C-resolved to Tier-2
#     so its own version/name metadata cannot cry-wolf on every release).
#   Tier-2 (enrichment, only if toolchain present): python → python3 tomllib (≥3.11), which
#     covers [project].dependencies + [project].optional-dependencies precisely (deps-only).
#     3.7-3.10 without tomli → silent Tier-1 degrade (tomli shim is DH-S3). Rust → cargo
#     metadata in DH-S2. tomllib parse failure → empty Tier-2 (Tier-1 hash stands).
#
# Storage (design §1-C): one line per stack — deps-hash-npm / deps-hash-python / deps-hash-cargo.
# Legacy bare deps-hash: is read backward-compat as the npm slot; if BOTH deps-hash: and
# deps-hash-npm: exist, deps-hash-npm: wins (design §3a M1).
#
# Under ZCode, stdout must be strict-JSON {additionalContext} (plain is discarded); _emit_warn
# inlines that so one byte-identical file serves both harnesses. When multiple stacks drift,
# their messages are accumulated into ONE _emit_warn call (two JSON objects on stdout would
# break ZCode's JSON.parse — design §3a M2).
#
# Register in consumer's .claude/settings.json:
#   "UserPromptSubmit": [{"hooks":[{"type":"command","command":"bash .claude/hooks/deps-hash-check.sh"}]}]

set -uo pipefail

# Harness-portable output: CC auto-injects plain stdout; ZCode needs JSON. Inlined (not
# sourced from lib/) because install.sh ships this file standalone to consumers (no lib/).
_emit_warn() {
  if [ -n "${ZCODE_PROJECT_DIR:-}" ] && command -v jq >/dev/null 2>&1; then
    jq -n --arg c "$1" '{hookEventName:"UserPromptSubmit", additionalContext:$c}'
  else
    printf '⚠ %s\n' "$1"
  fi
}

DECISIONS=".ai-factory/tool-decisions.md"

# If no tool-decisions.md exists yet, nothing to compare against.
[ -f "$DECISIONS" ] || exit 0

# Read a stored per-stack baseline. Precedence: <stack-key>: wins over legacy bare deps-hash:
# for the npm slot (design §3a M1). $1 = stack-specific key (e.g. deps-hash-npm), $2 = legacy
# fallback key (empty for non-npm stacks). Echoes the value (possibly empty).
_read_stored() {
  local stack_key="$1" legacy_key="${2:-}"
  local val
  val=$(grep -m1 "^${stack_key}:" "$DECISIONS" 2>/dev/null | sed "s/^${stack_key}:[[:space:]]*//" || true)
  if [ -z "$val" ] && [ -n "$legacy_key" ]; then
    val=$(grep -m1 "^${legacy_key}:" "$DECISIONS" 2>/dev/null | sed "s/^${legacy_key}:[[:space:]]*//" || true)
  fi
  printf '%s' "$val"
}

# sha256 a string ($1), portable across Linux (sha256sum) and macOS (shasum). Echoes sha256-<hex>;
# echoes empty on no hashing tool (the caller treats empty-current as "skip compare" → silent).
_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    printf '%s' "$1" | sha256sum | awk '{printf "sha256-%s", $1}'
  elif command -v shasum >/dev/null 2>&1; then
    printf '%s' "$1" | shasum -a 256 | awk '{printf "sha256-%s", $1}'
  fi
}

# ── JS / npm stack (package.json) ──────────────────────────────────────────
# Widen to 7 fields (kickoff §1 line 30): dependencies, devDependencies, peerDependencies,
# optionalDependencies, overrides, resolutions, pnpm.overrides. Each widened field guarded
# typeof === 'object' (npm allows overrides/resolutions as a STRING — spreading a string
# produces integer-indexed char keys and corrupts the hash; design §3a m1).
_npm_current() {
  [ -f package.json ] || { printf ''; return; }
  command -v node >/dev/null 2>&1 || { printf ''; return; }
  node -e \
    "const p=JSON.parse(require('fs').readFileSync('package.json','utf8')); \
     const o=(v)=>(v&&typeof v==='object')?v:{}; \
     console.log(JSON.stringify({...o(p.dependencies),...o(p.devDependencies),...o(p.peerDependencies),...o(p.optionalDependencies),...o(p.overrides),...o(p.resolutions),...o(p.pnpm&&p.pnpm.overrides)}))" \
    2>/dev/null || printf ''
}

# ── Python stack (pyproject.toml) — two-tier ladder (design §4) ────────────
# Tier-1: bash/awk table-boundary hash of the 6 non-[project] dep tables. [project] is
# deliberately excluded (its metadata would cry-wolf on every release; covered by Tier-2).
_PY_TIER1_AWK='function want(h){if(h=="project.optional-dependencies")return 1;if(h=="dependency-groups")return 1;if(h=="tool.poetry.dependencies")return 1;if(h=="tool.poetry.dev-dependencies")return 1;if(h~/^tool\.poetry\.group\.[^.]+\.dependencies$/)return 1;if(h~/^tool\.hatch\.envs\.[^.]+$/)return 1;return 0}/^\[/{in_t=want(substr($0,2,length($0)-2))}in_t'
# Tier-2: python3 tomllib hashes [project].dependencies + [project].optional-dependencies,
# deps-only, deterministic compact-JSON payload (design §4). ONE try around import+load+print
# so any error (no tomllib, malformed TOML) → empty stdout → Tier-2 contributes "".
_PY_TIER2_SCRIPT='import sys
try:
  import tomllib, json, hashlib
  d=tomllib.load(open(sys.argv[1],"rb"))
  p=d.get("project",{})
  deps=p.get("dependencies",[]);opt=p.get("optional-dependencies",{})
  payload=json.dumps(sorted(deps),separators=(",",":"))+json.dumps([[k,sorted(v)] for k,v in sorted(opt.items())],separators=(",",":"))
  print(hashlib.sha256(payload.encode()).hexdigest())
except Exception:
  pass'

_python_current() {
  [ -f pyproject.toml ] || { printf ''; return; }
  local tier1_hex tier2_hex combined
  # Tier-1 (needs awk — present on every POSIX system the framework supports).
  if command -v awk >/dev/null 2>&1; then
    tier1_hex=$(awk "$_PY_TIER1_AWK" pyproject.toml 2>/dev/null | _sha256_only_hex)
  else
    tier1_hex=""
  fi
  # Tier-2 (only if python3 present; ≥3.11 has tomllib, else the try degrades to empty).
  if command -v python3 >/dev/null 2>&1; then
    tier2_hex=$(python3 -c "$_PY_TIER2_SCRIPT" pyproject.toml 2>/dev/null)
  else
    tier2_hex=""
  fi
  combined="${tier1_hex}${tier2_hex}"
  # Note: an empty extraction (no recognized Tier-1 tables + Tier-2 absent/failed) still
  # hashes to sha256("") under _sha256_only_hex — it is NOT empty here. This guard only fires
  # when BOTH tier hashes are empty, which happens only when no hash tool is on PATH (then
  # _sha256_only_hex emits nothing). In that all-tool-absent case, skip this stack silently.
  [ -n "$combined" ] || { printf ''; return; }
  _sha256 "$combined"
}

# Like _sha256 but echoes the bare hex (no sha256- prefix) — used for the tier sub-hashes
# that get concatenated before the outer sha256.
_sha256_only_hex() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum | awk '{printf "%s", $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 | awk '{printf "%s", $1}'
  fi
}

# ── Drift evaluation + WARN assembly ───────────────────────────────────────
# Per-stack: compute current hash, compare to stored; collect one message per drifted stack.
# Emit ONE combined _emit_warn at the end (ZCode JSON.parse breaks on two objects — §3a M2).
WARN_MSGS=""
_drifted() {
  # $1 = stack label for the WARN, $2 = current hash (sha256-<hex> or empty), $3 = stored
  local label="$1" current="$2" stored="$3"
  [ -n "$current" ] || return 0          # no manifest/tool → this stack contributes nothing
  [ -n "$stored" ] || return 0           # no baseline recorded → nothing to compare
  [ "$current" = "$stored" ] && return 0 # match → silent
  # Drift. Distinguish baselined (sha256-*) from unbaselined (<pending …>) for honest wording
  # (GH #548). Accumulate into WARN_MSGS; emit once at the end.
  local msg
  case "$stored" in
    sha256-*)
      msg="${label} deps changed since last tool-bootstrap"
      ;;
    *)
      msg="${label} tool decisions not yet baselined"
      ;;
  esac
  if [ -z "$WARN_MSGS" ]; then
    WARN_MSGS="$msg"
  else
    WARN_MSGS="${WARN_MSGS}
${msg}"
  fi
}

NPM_STORED=$(_read_stored deps-hash-npm deps-hash)
PY_STORED=$(_read_stored deps-hash-python)
# (deps-hash-cargo is a RESERVED key — not read in DH-S1. The rust stack is DETECT-ONLY and
# lands in DH-S2; until then a stored cargo baseline simply sits unread, so it never drifts.)

# Hash each stack's current deps-extraction before comparing to the stored sha256 baseline.
# (_npm_current/_python_current return either a normalized string (npm: the deps JSON) or a
# sha256-<hex> (python: already combined + outer-hashed); both then go through _sha256 so the
# compare is apples-to-apples with the stored sha256-* baseline. Empty current → silent skip.)
NPM_CURRENT=$(_npm_current)
[ -n "$NPM_CURRENT" ] && NPM_CURRENT=$(_sha256 "$NPM_CURRENT")
_drifted "package.json" "$NPM_CURRENT" "$NPM_STORED"
# _python_current already returns sha256-<hex> (it does its own outer hash over tier1hex+tier2hex).
_drifted "python" "$(_python_current)" "$PY_STORED"

if [ -n "$WARN_MSGS" ]; then
  _emit_warn "${WARN_MSGS} — run /tool-bootstrapping to re-evaluate"
fi

exit 0
