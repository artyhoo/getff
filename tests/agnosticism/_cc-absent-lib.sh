#!/usr/bin/env bash
# CC-absent conformance harness library. Sourced by probes + self-test.
# @cc-only-rationale: N/A — this lib EXISTS to prove portability; it is the test, not a hook.

# Run a command with every CLAUDE_* var unset and `claude` masked off PATH.
# Usage: cc_scrub '<command string>'
cc_scrub() {
  local claude_vars
  claude_vars=$(env | grep -oE '^CLAUDE_[A-Z_]+' || true)
  local unset_args=()
  for v in $claude_vars; do unset_args+=("-u" "$v"); done
  # PATH shim dir whose `claude` is a no-op error, so any accidental shell-out is caught.
  local shim; shim=$(mktemp -d)
  printf '#!/bin/sh\necho "CC INVOKED UNDER SCRUB" >&2; exit 127\n' > "$shim/claude"
  chmod +x "$shim/claude"
  # Bash-3.2-safe empty-array expansion: under `set -uo pipefail` (see harness-self.test.sh),
  # an unguarded `"${unset_args[@]}"` aborts with 'unset_args[@]: unbound variable' when no
  # CLAUDE_* env vars are present to scrub (the common case on a clean host). macOS ships bash
  # 3.2, where empty-array expansion is not implicitly empty under `set -u`. Same class as
  # refresh-covers-full-delivery.test.sh:68 / format-shipped.sh:64 / memory
  # installsh_set_u_empty_array — guard the expansion against the empty case. When unset_args
  # IS empty we still run `env` (with PATH + CC_ABSENT only), preserving the scrub semantics.
  if [ "${#unset_args[@]}" -gt 0 ]; then
    env "${unset_args[@]}" PATH="$shim:$PATH" CC_ABSENT=1 bash -c "$1"
  else
    env PATH="$shim:$PATH" CC_ABSENT=1 bash -c "$1"
  fi
  local rc=$?
  rm -rf "$shim"
  return $rc
}

# Fail (exit 1) if any CC presence signal is detected. Run INSIDE cc_scrub.
assert_cc_absent() {
  [ -n "${CLAUDE_PROJECT_DIR:-}" ] && { echo "CC present: CLAUDE_PROJECT_DIR set" >&2; return 1; }
  [ -n "${CLAUDE_SKILL_DIR:-}" ]   && { echo "CC present: CLAUDE_SKILL_DIR set" >&2; return 1; }
  [ "${CC_ABSENT:-0}" = "1" ] || { echo "CC_ABSENT marker missing — not under scrub" >&2; return 1; }
  return 0
}

# Append a conformance record. Usage: record <surface> <probe> <cmd> <exit> <verdict>
RECORD_FILE="${RECORD_FILE:-/dev/stdout}"
record() { printf '%s\t%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$4" "$5" >> "$RECORD_FILE"; }
