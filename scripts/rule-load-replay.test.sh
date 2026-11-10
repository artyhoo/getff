#!/usr/bin/env bash
# rule-load-replay.test.sh — plumbing test for scripts/rule-load-replay.sh with a stub `claude`
# and a stub measurement script. No live session, no network, no host corpus: everything lives
# in mktemp. What a live run measures is the host proof of trigger build slice 2, not this test.
set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUT="$HERE/rule-load-replay.sh"
PASS=0; FAIL=0
ok() { PASS=$((PASS + 1)); echo "ok   $1"; }
bad() { FAIL=$((FAIL + 1)); echo "FAIL $1"; }
check() { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 — want [$3] got [$2]"; fi; }

T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
g() { git -C "$T/repo" -c user.name=t -c user.email=t@t "$@"; }

# A fixture "getff": two rules, one path-scoped; the replay's own helper beside it.
mkdir -p "$T/repo/.claude/rules" "$T/repo/scripts"
printf -- '---\npaths:\n  - "src/**"\n---\n# Scoped\n' > "$T/repo/.claude/rules/scoped.md"
printf -- '# Unscoped\n' > "$T/repo/.claude/rules/plain.md"
printf '{}\n' > "$T/repo/.claude/settings.json"
cp "$HERE/exclude-path-scoped-rules.sh" "$T/repo/scripts/"
git init -q "$T/repo"
g add -A && g commit -qm fixture
printf -- '---\npaths:\n  - "src/**"\n---\n<!-- inject: Rule: scoped summary. -->\n# Scoped\n' > "$T/new.md"
cp "$T/repo/.claude/rules/scoped.md" "$T/old.md"
( cd "$T" && diff -u old.md new.md | sed -e 's#^--- old.md.*#--- a/.claude/rules/scoped.md#' \
    -e 's#^+++ new.md.*#+++ b/.claude/rules/scoped.md#' > "$T/rules.patch" )

# Stub claude: records its cwd, argv and the clone's settings, then writes a transcript with
# one native rule load and one loader card, and prints the -p JSON result.
mkdir -p "$T/corpus"
cat > "$T/claude" <<'EOF'
#!/usr/bin/env bash
sid="stub-$(date +%s)-$$"
{ echo "cwd=$PWD"; echo "argv=$*"
  echo "local=$(jq -c . .claude/settings.local.json 2>/dev/null || echo none)"
  echo "project=$(jq -c '.claudeMdExcludes // []' .claude/settings.json)"
  echo "scoped-inject=$(grep -c 'inject:' .claude/rules/scoped.md)"; } > "$STUB_LOG"
d="$STUB_CORPUS/-private-stub-project"; mkdir -p "$d/$sid/subagents"
jq -nc --arg p "$PWD/.claude/rules/scoped.md" \
  '{type:"attachment",attachment:{type:"nested_memory",path:$p,content:{content:"# Scoped"}}}' > "$d/$sid.jsonl"
jq -nc '{type:"attachment",attachment:{type:"hook_additional_context",content:["📎 Path-relevant rule — Rule: scoped summary.\nnot a card line"]}}' >> "$d/$sid.jsonl"
jq -nc '{type:"attachment",attachment:{type:"hook_additional_context",content:["📎 Path-relevant rule — two"]}}' > "$d/$sid/subagents/agent-1.jsonl"
printf '{"session_id":"%s","result":"done"}\n' "$sid"
exit "${STUB_EXIT:-0}"
EOF
chmod +x "$T/claude"
# Stub measurement: asserts the mode and prints the key line over what it was handed.
cat > "$T/measure.sh" <<'EOF'
#!/usr/bin/env bash
[ "${MEASURE_SECTIONS:-}" = native-load ] || { echo "wrong mode" >&2; exit 9; }
n=$(find "$CORPUS_ROOT" -path "$PROJECT_MATCH" -name '*.jsonl' -not -path '*/subagents/*' | wc -l | tr -d ' ')
s=$(find "$CORPUS_ROOT" -path "$PROJECT_MATCH" -name '*.jsonl' -path '*/subagents/*' | wc -l | tr -d ' ')
echo "NATIVE-RULE-LOADS pop=session records=$n paths=$n chars=8"
echo "NATIVE-RULE-LOADS pop=subagent records=0 paths=0 chars=0 subagent-files=$s"
EOF
chmod +x "$T/measure.sh"
export CLAUDE_BIN="$T/claude" MEASURE="$T/measure.sh" CORPUS_ROOT="$T/corpus" \
  STUB_CORPUS="$T/corpus" REPO="$T/repo"

# A: the "before" run — no exclusion, no patch
export STUB_LOG="$T/a.log"
bash "$SUT" --label before --prompt-file "$T/rules.patch" --ref HEAD --out "$T/a" > "$T/a.out" 2>&1
check "A exit" "$?" "0"
check "A local settings" "$(grep '^local=' "$T/a.log")" "local=none"
check "A project settings" "$(grep '^project=' "$T/a.log")" "project=[]"
check "A no patch" "$(grep '^scoped-inject=' "$T/a.log")" "scoped-inject=0"
check "A cwd is the clone" "$(grep -c "^cwd=$T/a/clone" "$T/a.log")" "1"
check "A isolated settings" "$(grep -c -- '--setting-sources project,local' "$T/a.log")" "1"
check "A replay line" "$(grep -c '^REPLAY label=before exclude=none patch=none' "$T/a/summary.txt")" "1"
check "A native key lines" "$(grep -c '^NATIVE-RULE-LOADS ' "$T/a/summary.txt")" "2"
check "A subagent transcript copied" "$(grep -c 'subagent-files=1' "$T/a/summary.txt")" "1"
# codepoints, as jq counts them (wc -m follows the locale and can count bytes)
want_chars=$(jq -rn '["📎 Path-relevant rule — Rule: scoped summary.", "📎 Path-relevant rule — two"] | map(length) | add')
check "A loader cards" "$(grep '^LOADER-CARDS ' "$T/a/summary.txt")" "LOADER-CARDS cards=2 chars=$want_chars"

# B: the "after" run — exclusion in settings.local.json + the rule patch
export STUB_LOG="$T/b.log"
bash "$SUT" --label after --prompt-file "$T/rules.patch" --ref HEAD --exclude local \
  --patch "$T/rules.patch" --out "$T/b" > "$T/b.out" 2>&1
check "B exit" "$?" "0"
check "B local excludes" "$(grep '^local=' "$T/b.log" | sed 's/^local=//' | jq -c '.claudeMdExcludes')" '["**/scoped.md"]'
check "B project untouched" "$(grep '^project=' "$T/b.log")" "project=[]"
check "B patch applied" "$(grep '^scoped-inject=' "$T/b.log")" "scoped-inject=1"
check "B replay line" "$(grep -c '^REPLAY label=after exclude=local patch=rules.patch' "$T/b/summary.txt")" "1"
# the prepared state is committed in the clone, so the run's own diff does not reveal it
check "B setup frozen" "$(git -C "$T/b/clone" status --porcelain | wc -l | tr -d ' ')" "0"
check "B setup commit" "$(git -C "$T/b/clone" log -1 --format=%s)" "replay setup: after"
check "B local settings committed" "$(git -C "$T/b/clone" ls-files .claude/settings.local.json)" ".claude/settings.local.json"

# C: the S-7 cross-check — exclusion in the clone's settings.json
export STUB_LOG="$T/c.log"
bash "$SUT" --label cross --prompt-file "$T/rules.patch" --ref HEAD --exclude project --out "$T/c" >/dev/null 2>&1
check "C exit" "$?" "0"
check "C project excludes" "$(grep '^project=' "$T/c.log")" 'project=["**/scoped.md"]'

# D: the source checkout is never written
check "D source settings" "$(jq -c . "$T/repo/.claude/settings.json")" "{}"
check "D source local" "$([ -e "$T/repo/.claude/settings.local.json" ] && echo present || echo absent)" "absent"
check "D source clean" "$(git -C "$T/repo" status --porcelain | wc -l | tr -d ' ')" "0"

# E: a failing claude is recorded, not fatal
export STUB_LOG="$T/e.log" STUB_EXIT=1
bash "$SUT" --label fails --prompt-file "$T/rules.patch" --ref HEAD --out "$T/e" >/dev/null 2>&1
check "E exit" "$?" "0"
check "E claude exit recorded" "$(grep -c 'claude_exit=1' "$T/e/summary.txt")" "1"
unset STUB_EXIT

# F: argument errors exit 2
bash "$SUT" --prompt-file "$T/rules.patch" >/dev/null 2>&1; check "F no label" "$?" "2"
bash "$SUT" --label x >/dev/null 2>&1; check "F no prompt" "$?" "2"
bash "$SUT" --label 'a b' --prompt-file "$T/rules.patch" >/dev/null 2>&1; check "F bad label" "$?" "2"
bash "$SUT" --label x --prompt-file "$T/rules.patch" --exclude both >/dev/null 2>&1; check "F bad exclude" "$?" "2"

# G: no session id → exit 3
cat > "$T/claude-silent" <<'EOF'
#!/usr/bin/env bash
echo '{}'
EOF
chmod +x "$T/claude-silent"
CLAUDE_BIN="$T/claude-silent" bash "$SUT" --label silent --prompt-file "$T/rules.patch" --ref HEAD --out "$T/g" >/dev/null 2>&1
check "G exit" "$?" "3"

echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
