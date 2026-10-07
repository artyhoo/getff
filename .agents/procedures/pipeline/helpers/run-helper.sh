#!/usr/bin/env bash
# run-helper.sh — run a helper as a child, ALWAYS append an END-trailer so a
# background reader can distinguish "finished (rc=N)" from "still running / crashed".
#
# The trailer is appended by THIS parent wrapper, not by the child — so it fires
# even when the child dies mid-output, exits non-zero, or is killed by a timeout
# (a `set -e` abort or SIGKILL inside the child would skip a child-side `echo END`).
#
# Trailer shape (the `=== ` prefix is load-bearing — the candidate parser at
# classify-each-candidate.sh:52 `awk '... && !/^=== /'` strips any `=== … ===`
# line, so the trailer can never become a spurious candidate):
#
#     === <helper-name>: END rc=<exit-code> (lines=<stdout-line-count>) ===
#
# Caveat (T-BGB-A): the trailer proves the child FINISHED and with WHAT exit code,
# NOT that its work was semantically complete (e.g. `gh` may rate-limit, exit 0,
# and emit a partial set). This barrier is a completion signal, not a content-
# completeness guarantee.
#
# @dual-pair: bg-helper-completion-barrier
set -uo pipefail   # deliberately NOT `set -e`: we MUST reach the trailer even on child failure.

name="$(basename "${1:-helper}")"

# Capture the child's stdout + exit status BEFORE anything else can clobber $?.
# MO_HELPER_TIMEOUT (default 120s) guards against a never-arriving END trailer.
# timeout(1) exits with rc=124 on expiry; run-helper still appends the END trailer.
# Portable: GNU `timeout` is absent on stock macOS (and `gtimeout` only if coreutils
# is installed) — degrade gracefully to a direct call when neither exists, rather than
# dying rc=127 ("command not found"). The stall-guard is best-effort, like M5's mkdir-lock.
if command -v timeout >/dev/null 2>&1; then
  out="$(timeout "${MO_HELPER_TIMEOUT:-120}" "$@")"; rc=$?
elif command -v gtimeout >/dev/null 2>&1; then
  out="$(gtimeout "${MO_HELPER_TIMEOUT:-120}" "$@")"; rc=$?
else
  out="$("$@")"; rc=$?   # no timeout binary on this host — run directly (macOS default)
fi

# Count forwarded stdout lines. `grep -c ''` counts lines without miscounting a
# trailing newline; `|| true` keeps the count step from tripping pipefail on
# empty input (grep -c returns 1 when it matches nothing).
lines="$(printf '%s' "$out" | grep -c '' || true)"

# Forward the child's stdout verbatim, THEN the trailer, THEN propagate exit.
printf '%s\n' "$out"
printf '=== %s: END rc=%s (lines=%s) ===\n' "$name" "$rc" "$lines"
exit "$rc"
