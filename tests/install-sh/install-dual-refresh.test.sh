#!/usr/bin/env bash
# Real installed dual layers: bare refresh updates both, explicit selections stay scoped.
# shellcheck disable=SC2016 # bash -c strings intentionally defer positional argument expansion.
set -uo pipefail
ROOT=${TEST_REPO_ROOT:-$(git -C "$(dirname "$0")" rev-parse --show-toplevel)}
INSTALL_ROOT=${INSTALL_ROOT:-$ROOT}
TMP=$(mktemp -d); trap '[ -n "${KEEP_FIXTURES:-}" ] || rm -rf "$TMP"' EXIT
echo "Fixtures: $TMP"
PASS=0; FAIL=0
check() { if "$@"; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); echo "FAIL: $*"; fi; }
fail() { cat "$TMP/seed.log"; exit 1; }
mkdir "$TMP/bin"
for pm in npm pnpm yarn; do printf '#!/bin/sh\necho called >> "$PM_LOG"\nexit 0\n' > "$TMP/bin/$pm"; chmod +x "$TMP/bin/$pm"; done
export PATH="$TMP/bin:$PATH" PM_LOG="$TMP/pm.log"
unset GETFF_TOOLCHAIN GETFF_TOOLCHAIN_REFRESH PROFILE GETFF_PROFILE
python3 - "$TMP/drive-terminal.py" <<'PY'
import pathlib,sys
pathlib.Path(sys.argv[1]).write_text('''import os,sys,pty,select,time
pid,fd=pty.fork()
if pid==0: os.execvp(sys.argv[1],sys.argv[1:])
out=b""
while True:
 try:
  ready,_,_=select.select([fd],[],[],15)
  if not ready: break
  data=os.read(fd,65536)
  if not data: break
  out+=data
 except OSError: break
done,status=os.waitpid(pid,os.WNOHANG)
for _ in range(50):
 if done: break
 time.sleep(.02);done,status=os.waitpid(pid,os.WNOHANG)
if not done:
 os.kill(pid,9);_,status=os.waitpid(pid,0)
 out+=b"\\nblocked on input\\n"
sys.stdout.buffer.write(out)
sys.exit(os.waitstatus_to_exitcode(status))
''')
PY
seed() {
 local dir=$1 stack=$2
 mkdir -p "$dir"; printf '{"name":"consumer","version":"0.0.0"}\n' > "$dir/package.json"
 printf '[project]\nname="consumer"\nversion="0.0.0"\n' > "$dir/pyproject.toml"
 git -C "$dir" init -q
 (cd "$dir" && bash "$INSTALL_ROOT/install.sh" "$stack" --profile core </dev/null) > "$TMP/seed.log" 2>&1 || fail
 (cd "$dir" && bash "$INSTALL_ROOT/install.sh" python --profile core </dev/null) >> "$TMP/seed.log" 2>&1 || fail
 cp "$dir/scripts/audit-ai-docs.sh" "$dir/npm.expected"
 cp "$dir/.getff/astgrep-rules/getff-no-eval.yml" "$dir/python.expected"
}
tamper() { printf '# stale npm\n' > "$1/scripts/audit-ai-docs.sh"; printf '# stale python\n' > "$1/.getff/astgrep-rules/getff-no-eval.yml"; }
for mode in tty pipe; do
 dir="$TMP/$mode"; seed "$dir" ts-server; tamper "$dir"
 # Arm a real npm check AFTER both installs; refresh must keep its state and stack.
 python3 - "$dir/.ai-factory/tool-decisions.md" <<'PYRECORD'
import pathlib,sys,re
p=pathlib.Path(sys.argv[1]);s=p.read_text()
s=re.sub(r'<!-- aif:project-checks:begin -->.*?<!-- aif:project-checks:end -->', '<!-- aif:project-checks:begin -->\nstack: ts-server\narmed:\n- npm run lint\nnot-armed:\n<!-- aif:project-checks:end -->',s,flags=re.S)
p.write_text(s)
PYRECORD
 : > "$PM_LOG"
 if [ "$mode" = tty ]; then
  (cd "$dir" && python3 "$TMP/drive-terminal.py" bash "$INSTALL_ROOT/install.sh" --refresh) > "$TMP/$mode.log" 2>&1; rc=$?
  if [ "$rc" -eq 0 ]; then check true; else check false; fi
 else
  (cd "$dir" && bash "$INSTALL_ROOT/install.sh" --refresh </dev/null) > "$TMP/$mode.log" 2>&1; rc=$?
  if [ "$rc" -eq 0 ]; then check true; else check false; fi
 fi
 check cmp -s "$dir/npm.expected" "$dir/scripts/audit-ai-docs.sh"
 check cmp -s "$dir/python.expected" "$dir/.getff/astgrep-rules/getff-no-eval.yml"
 check test ! -e "$dir/.ai-factory/tier-home.md"
 check test ! -s "$PM_LOG"
 check rg -q '^stack: ts-server$' "$dir/.ai-factory/tool-decisions.md"
 check bash -c 'sed -n "/^armed:/,/^not-armed:/p" "$1" | rg -q "^- npm run lint$"' _ "$dir/.ai-factory/tool-decisions.md"
 check bash -c '! rg -q "What install depth|What stack|blocked on input" "$1"' _ "$TMP/$mode.log"
 tamper "$dir"
 (cd "$dir" && bash "$INSTALL_ROOT/install.sh" ts-server --refresh </dev/null) > "$TMP/explicit.log" 2>&1
 rc=$?
if [ "$rc" -eq 0 ]; then check true; else check false; fi
 check cmp -s "$dir/npm.expected" "$dir/scripts/audit-ai-docs.sh"
 check rg -q 'stale python' "$dir/.getff/astgrep-rules/getff-no-eval.yml"
 tamper "$dir"
 (cd "$dir" && bash "$INSTALL_ROOT/install.sh" python --refresh </dev/null) > "$TMP/explicit-python.log" 2>&1
 rc=$?
if [ "$rc" -eq 0 ]; then check true; else check false; fi
 check rg -q 'stale npm' "$dir/scripts/audit-ai-docs.sh"
 check cmp -s "$dir/python.expected" "$dir/.getff/astgrep-rules/getff-no-eval.yml"
done
# Python + unrelated package.json must not acquire an npm framework layer.
dir="$TMP/pure"; mkdir "$dir"; printf '{}\n' > "$dir/package.json"; printf '[project]\nname="pure"\nversion="0.0.0"\n' > "$dir/pyproject.toml"
(cd "$dir" && bash "$INSTALL_ROOT/install.sh" python --profile core </dev/null && bash "$INSTALL_ROOT/install.sh" --refresh </dev/null) > "$TMP/pure.log" 2>&1
rc=$?
if [ "$rc" -eq 0 ]; then check true; else check false; fi
check test ! -e "$dir/scripts/audit-ai-docs.sh"
# A generic + Python installation stays generic even though Python supplies RULES.md.
dir="$TMP/generic"; seed "$dir" generic; tamper "$dir"
(cd "$dir" && bash "$INSTALL_ROOT/install.sh" --refresh </dev/null) > "$TMP/generic.log" 2>&1
rc=$?
if [ "$rc" -eq 0 ]; then check true; else check false; fi
check cmp -s "$dir/npm.expected" "$dir/scripts/audit-ai-docs.sh"
check test ! -e "$dir/eslint-rules-local"
check test ! -e "$dir/packages/core/hooks/pre-push.bundle.mjs"
# Every previously installed table lane participates; dry-run preserves all bytes.
dir="$TMP/pipe"; touch "$dir/.getff-cargo-install.log" "$dir/.getff-go-install.log"; tamper "$dir"
(cd "$dir" && bash "$INSTALL_ROOT/install.sh" --refresh --dry-run </dev/null) > "$TMP/all.log" 2>&1
rc=$?
if [ "$rc" -eq 0 ]; then check true; else check false; fi
for label in Python Rust/cargo Go; do check rg -q "Refreshing getff $label" "$TMP/all.log"; done
check rg -q 'stale npm' "$dir/scripts/audit-ai-docs.sh"
check rg -q 'stale python' "$dir/.getff/astgrep-rules/getff-no-eval.yml"
# A deleted npm passport must not strand its still-installed enforcement payload.
rm -f "$dir/.ai-factory/ARCHITECTURE.ts-server.md"
(cd "$dir" && bash "$INSTALL_ROOT/install.sh" --refresh --dry-run </dev/null) > "$TMP/no-passport.log" 2>&1
rc=$?
if [ "$rc" -eq 0 ]; then check true; else check false; fi
check rg -q 'stack: ts-server' "$TMP/no-passport.log"
check rg -q '\[dry-run\] would refresh: .*pre-push.bundle.mjs' "$TMP/no-passport.log"
echo "PASS=$PASS FAIL=$FAIL"; test "$FAIL" -eq 0
