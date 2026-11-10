#!/usr/bin/env bash
# Exercise the real runner with an unavailable completion ordinal on both progress channels.
set -uo pipefail
unset PC_LOCAL PC_LOCAL_WHY INSTALL_SH_HEAVY_RUNNER INSTALL_SH_QUARANTINE
exec 3>&-
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bin" "$TMP/suite"
cat >"$TMP/bin/mkdir" <<'SH'
#!/bin/bash
case "${1:-}" in */seq/3) exit 1 ;; esac
exec /bin/mkdir "$@"
SH
chmod +x "$TMP/bin/mkdir"
for i in 1 2 3; do printf '#!/bin/bash\necho fixture-%s\n' "$i" >"$TMP/suite/t$i.test.sh"; done
fails=0
require() {
  if "$@"; then return; fi
  printf 'FAIL: %s\n' "$*"
  fails=$((fails + 1))
}
for channel in fd3 stderr; do
  if [ "$channel" = fd3 ]; then
    PATH="$TMP/bin:$PATH" INSTALL_SH_JOBS=1 bash "$HERE/run-install-sh-suite.sh" "$TMP/suite" >"$TMP/out" 2>"$TMP/err" 3>"$TMP/progress"
  else
    PATH="$TMP/bin:$PATH" INSTALL_SH_JOBS=1 bash "$HERE/run-install-sh-suite.sh" "$TMP/suite" >"$TMP/out" 2>"$TMP/progress" 3>&-
  fi
  rc=$?
  require test "$rc" -eq 0
  require grep -qF '3/3 passed' "$TMP/out"
  require grep -qF '3/3 done' "$TMP/progress"
  require grep -qF 'progress ordinal unavailable' "$TMP/progress"
  require test "$(grep -cF '4/3 done' "$TMP/progress")" -eq 0
done
# Completion is independent of success; the receipt verdict must still fail the suite.
printf '#!/bin/bash\nexit 7\n' >"$TMP/suite/t3.test.sh"
PATH="$TMP/bin:$PATH" INSTALL_SH_JOBS=1 bash "$HERE/run-install-sh-suite.sh" "$TMP/suite" >"$TMP/out" 2>"$TMP/progress" 3>&-
rc=$?
require test "$rc" -eq 1
require grep -qF '3/3 done' "$TMP/progress"
require grep -qF 't3.test.sh(rc=7)' "$TMP/out"
# A missing receipt must never contribute to the parent's completion count.
printf '#!/bin/bash\nkill -9 $PPID\n' >"$TMP/suite/t3.test.sh"
PATH="$TMP/bin:$PATH" INSTALL_SH_JOBS=1 bash "$HERE/run-install-sh-suite.sh" "$TMP/suite" >"$TMP/out" 2>"$TMP/progress" 3>&-
rc=$?
require test "$rc" -eq 1
require grep -qF '2/3 done' "$TMP/progress"
require test "$(grep -cF '3/3 done' "$TMP/progress")" -eq 0
require grep -qF 'NO RESULT' "$TMP/out"
if [ "$fails" -gt 0 ]; then printf 'run-install-sh-progress: %s FAIL\n' "$fails"; exit 1; fi
echo 'run-install-sh-progress: PASS (fd3, stderr, failed and missing receipts)'
