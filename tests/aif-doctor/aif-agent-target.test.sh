#!/usr/bin/env bash
# aif-agent-target.test.sh — the shared «which aif agent container, on which docker context»
# resolver (.claude/skills/aif-doctor/helpers/aif-agent-target.sh), EXECUTED mode: the contract
# harvest.ts reads (stdout «<name><TAB><context>», exit 0 found / 1 ambiguous / 2 none).
#
# Hermetic: docker is a stub FILE reached only through AIF_AGENT_DOCKER, never PATH, so a real
# docker on the runner is never asked. The stub models contexts `cur` (current), `remote`,
# `remote2` and `down` (daemon unreachable); which context runs which agent is set per case
# through STUB_AGENTS («ctx:name …»), which refuse through STUB_DOWN, which hang through STUB_SLOW.
# The sourced mode is driven through the dispatcher probe in
# packages/core/skills/dispatcher/probe-inflight.test.ts (arms f-n).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HELPER="$ROOT/.claude/skills/aif-doctor/helpers/aif-agent-target.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

STUB="$WORK/docker"
cat > "$STUB" <<'EOF'
#!/usr/bin/env bash
# Contexts in STUB_DOWN (default: down) refuse; contexts in STUB_SLOW hang for 5 s.
ctx="${DOCKER_CONTEXT:-cur}"
[ "${1:-}" = "via-ssh" ] && shift
if [ "${1:-}" = "--context" ]; then ctx="$2"; shift 2; fi
case "${1:-}" in
  context)
    if [ "${2:-}" = show ]; then echo cur; else printf 'cur\nremote\nremote2\ndown\n'; fi ;;
  ps)
    case " ${STUB_DOWN-down} " in *" $ctx "*) echo "Cannot connect to the Docker daemon" >&2; exit 1 ;; esac
    case " ${STUB_SLOW:-} " in *" $ctx "*) sleep 5 ;; esac
    names_only=0
    for a in "$@"; do [ "$a" = "--format" ] && names_only=1; done
    [ "$names_only" = 0 ] && [ -n "${STUB_TABLE:-}" ] && echo "CONTAINER ID   IMAGE       COMMAND   CREATED   STATUS   PORTS   NAMES"
    for a in ${STUB_AGENTS:-}; do
      [ "${a%%:*}" = "$ctx" ] || continue
      if [ "$names_only" = 1 ]; then echo "${a#*:}"
      # A user psFormat such as «table {{.Names}}\t{{.Status}}» puts the name first.
      elif [ -n "${STUB_PSFORMAT:-}" ]; then echo "${a#*:}   Up 2 days"
      else echo "0123abcd   aif:latest   \"node\"   2 days ago   Up 2 days      ${a#*:}"
      fi
    done
    exit 0 ;;
esac
EOF
chmod +x "$STUB"

pass=0; fail=0
# check <label> <want-exit> <want-stdout> <want-stderr-substring> [env assignments…]
check() {
  local label="$1" want_rc="$2" want_out="$3" want_err="$4"; shift 4
  local out err rc=0
  out=$(env -u DOCKER_CONTEXT -u DOCKER_HOST AIF_AGENT_DOCKER="$STUB" AIF_AGENT_TIMEOUT_S=5 "$@" \
    bash "$HELPER" 2>"$WORK/err") || rc=$?
  err=$(cat "$WORK/err")
  if [ "$rc" = "$want_rc" ] && [ "$out" = "$want_out" ] && { [ -z "$want_err" ] || [[ "$err" == *"$want_err"* ]]; }; then
    echo "  [PASS] $label"; pass=$((pass + 1))
  else
    echo "  [FAIL] $label — rc=$rc out='$out' err='$err' (want rc=$want_rc out='$want_out' err~'$want_err')"
    fail=$((fail + 1))
  fi
}

TAB=$'\t'
echo "=== aif-agent-target.sh, executed mode ==="
check "one agent on the current context → it, no context" \
  0 "aif-agent-1${TAB}" "" STUB_AGENTS="cur:aif-agent-1 remote:aif-agent-1"
check "a plain docker asks --format, so a custom psFormat cannot hide the name" \
  0 "aif-agent-1${TAB}" "" STUB_PSFORMAT=1 STUB_AGENTS="cur:aif-agent-1"
check "a routed docker gets no --format; the name comes from the table's last column" \
  0 "aif-agent-1${TAB}" "" STUB_TABLE=1 STUB_AGENTS="cur:aif-agent-1" AIF_AGENT_DOCKER="$STUB via-ssh"
check "the current context does not answer in time → exit 1, no agent picked elsewhere" \
  1 "" "the current docker context did not answer within 1s" \
  STUB_SLOW=cur STUB_AGENTS="cur:aif-agent-1 remote:aif-stale-agent-1" AIF_AGENT_TIMEOUT_S=1
check "the current daemon is unreachable, one agent on another context → it and that context" \
  0 "aif-agent-1${TAB}remote" "" STUB_DOWN="cur down" STUB_AGENTS="remote:aif-agent-1"
check "the current daemon is unreachable and nothing elsewhere → exit 2, named as unreachable" \
  2 "" "the current docker context is unreachable; scanned: remote=none remote2=none down=error" \
  STUB_DOWN="cur down" STUB_AGENTS=""
check "none on the current context, one on another → it and that context" \
  0 "aif-agent-1${TAB}remote" "" STUB_AGENTS="remote:aif-agent-1"
check "two on the current context → ambiguous, exit 1, nothing guessed" \
  1 "" "ambiguous-agent: aif-agent-1 aif-e2e-agent-1 on the current docker context" \
  STUB_AGENTS="cur:aif-agent-1 cur:aif-e2e-agent-1"
check "one on each of two other contexts → ambiguous across contexts" \
  1 "" "ambiguous-agent: remote/aif-agent-1 remote2/aif-agent-1 across docker contexts" \
  STUB_AGENTS="remote:aif-agent-1 remote2:aif-agent-1"
check "nothing anywhere → exit 2 and each context's outcome is named" \
  2 "" "no aif agent on the current context; scanned: remote=none remote2=none down=error" STUB_AGENTS=""
check "a caller-pinned DOCKER_CONTEXT stops the scan" \
  2 "" "other contexts not scanned: DOCKER_CONTEXT/DOCKER_HOST pinned" \
  STUB_AGENTS="remote:aif-agent-1" DOCKER_CONTEXT=cur
check "a routing prefix (docker reached through ssh) stops the scan" \
  2 "" "other contexts not scanned: docker is reached through" \
  STUB_AGENTS="remote:aif-agent-1" AIF_AGENT_DOCKER="$STUB via-ssh"

echo "Results: $pass passed, $fail failed (of $((pass + fail)))"
[ "$fail" -eq 0 ]
