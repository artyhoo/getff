#!/usr/bin/env bash
# rule-load-adherence.test.sh — plumbing test for scripts/rule-load-adherence.sh with a stub
# replay script. No live session, no network: everything lives in mktemp. Whether the rules are
# followed is the cold judge's call on a live run, not this test's.
set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUT="$HERE/rule-load-adherence.sh"
PASS=0; FAIL=0
ok() { PASS=$((PASS + 1)); echo "ok   $1"; }
bad() { FAIL=$((FAIL + 1)); echo "FAIL $1"; }
check() { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 — want [$3] got [$2]"; fi; }

T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT

# Two tasks with rubrics; one task without a rubric must be refused.
mkdir -p "$T/tasks"
printf 'Task alpha.\n' > "$T/tasks/alpha.task.md"; printf 'Rubric alpha.\n' > "$T/tasks/alpha.rubric.md"
printf 'Task beta.\n' > "$T/tasks/beta.task.md"; printf 'Rubric beta.\n' > "$T/tasks/beta.rubric.md"
printf 'rules patch\n' > "$T/rules.patch"

# Stub replay: records its argv, builds a run directory the way rule-load-replay.sh does
# (clone with a setup commit, result.json, transcript, summary.txt), and makes the session's
# "work" depend on the state so the packet can be checked for blinding.
cat > "$T/replay.sh" <<'EOF'
#!/usr/bin/env bash
argv="$*" out="" label="" state=before
while [ $# -gt 0 ]; do
  case "$1" in --out) out="$2"; shift 2 ;; --label) label="$2"; shift 2 ;;
    --exclude) state=after; shift 2 ;; *) shift ;; esac
done
echo "$label $argv" >> "$STUB_ARGV"
mkdir -p "$out/clone" "$out/transcript/replay-$label"
git -C "$out/clone" init -q
printf 'base\n' > "$out/clone/file.txt"
git -C "$out/clone" add -A
git -C "$out/clone" -c user.name=t -c user.email=t@t commit -qm "replay setup: $label"
printf 'work by %s\n' "$state" >> "$out/clone/file.txt"
printf 'new file\n' > "$out/clone/created.md"
jq -nc --arg r "result from $state" '{session_id:"s1",result:$r}' > "$out/result.json"
jq -nc '{type:"assistant",message:{content:[{type:"tool_use",name:"Read",input:{file_path:"/x/a.md"}},{type:"text",text:"hi"}]}}' > "$out/transcript/replay-$label/s1.jsonl"
jq -nc '{type:"assistant",message:{content:[{type:"tool_use",name:"Grep",input:{pattern:"foo"}}]}}' >> "$out/transcript/replay-$label/s1.jsonl"
chars=100; [ "$state" = after ] && chars=10
{ echo "REPLAY label=$label"; echo "NATIVE-RULE-LOADS pop=session records=1 paths=1 chars=$chars"
  echo "NATIVE-RULE-LOADS pop=subagent records=0 paths=0 chars=0"; echo "LOADER-CARDS cards=1 chars=5"; } > "$out/summary.txt"
EOF
chmod +x "$T/replay.sh"
export REPLAY="$T/replay.sh" STUB_ARGV="$T/argv.log"

# A: run builds two runs per task and a blinded packet
ADHERENCE_KEY=XY bash "$SUT" run --patch "$T/rules.patch" --tasks-dir "$T/tasks" --out "$T/o" > "$T/a.out" 2>&1
check "A exit" "$?" "0"
check "A four runs" "$(wc -l < "$T/argv.log" | tr -d ' ')" "4"
check "A after runs patched" "$(grep -c -- '--exclude local --patch' "$T/argv.log")" "2"
check "A tools allowed" "$(grep -c -- '--allowed-tools Read,Edit,Write,Grep,Glob' "$T/argv.log")" "4"
check "A task copied" "$(cat "$T/o/packet/alpha/task.md")" "Task alpha."
check "A rubric copied" "$(cat "$T/o/packet/alpha/rubric.md")" "Rubric alpha."
check "A X is before" "$(cat "$T/o/packet/alpha/X/result.txt")" "result from before"
check "A Y is after" "$(cat "$T/o/packet/alpha/Y/result.txt")" "result from after"
check "A tools listed" "$(cat "$T/o/packet/alpha/X/tools.txt")" "$(printf 'Read /x/a.md\nGrep foo')"
check "A diff has work" "$(grep -c '^+work by before' "$T/o/packet/alpha/X/diff.patch")" "1"
check "A diff has new file" "$(grep -c '^+++ b/created.md' "$T/o/packet/alpha/X/diff.patch")" "1"
check "A key outside packet" "$(grep -c '^task=alpha X=before Y=after$' "$T/o/key.txt")" "1"
check "A diff excludes the setup" "$(grep -c '^+base' "$T/o/packet/alpha/X/diff.patch")" "0"
check "A packet has no key" "$(find "$T/o/packet" -name 'key*' | wc -l | tr -d ' ')" "0"

# B: the other assignment swaps the variants
ADHERENCE_KEY=YX bash "$SUT" run --patch "$T/rules.patch" --tasks-dir "$T/tasks" --out "$T/o2" >/dev/null 2>&1
check "B X is after" "$(cat "$T/o2/packet/beta/X/result.txt")" "result from after"
check "B key" "$(grep -c '^task=beta X=after Y=before$' "$T/o2/key.txt")" "1"

# C: score unblinds the judge's verdicts and totals them (PASS 2, PARTIAL 1, FAIL 0)
cat > "$T/verdicts.txt" <<'EOF'
noise line
VERDICT task=alpha variant=X grade=PASS evidence="a"
VERDICT task=alpha variant=Y grade=PARTIAL evidence="b"
VERDICT task=beta variant=X grade=FAIL evidence="c"
VERDICT task=beta variant=Y grade=PASS evidence="d"
EOF
bash "$SUT" score "$T/o" "$T/verdicts.txt" > "$T/c.out" 2>&1
check "C exit" "$?" "0"
check "C alpha" "$(grep '^ADHERENCE task=alpha ' "$T/c.out")" "ADHERENCE task=alpha before=PASS after=PARTIAL"
check "C beta" "$(grep '^ADHERENCE task=beta ' "$T/c.out")" "ADHERENCE task=beta before=FAIL after=PASS"
check "C total" "$(grep '^ADHERENCE-TOTAL ' "$T/c.out")" "ADHERENCE-TOTAL before=2 after=3 max=4"
check "C native chars" "$(grep '^NATIVE-CHARS ' "$T/c.out")" "NATIVE-CHARS before=200 after=20"

# D: a missing verdict fails the score
grep -v 'task=beta variant=Y' "$T/verdicts.txt" > "$T/partial.txt"
bash "$SUT" score "$T/o" "$T/partial.txt" >/dev/null 2>&1
check "D missing verdict" "$?" "5"

# E: argument errors exit 2
bash "$SUT" >/dev/null 2>&1; check "E no mode" "$?" "2"
bash "$SUT" run --tasks-dir "$T/tasks" >/dev/null 2>&1; check "E no patch" "$?" "2"
mkdir -p "$T/bad"; printf 'x\n' > "$T/bad/lonely.task.md"
bash "$SUT" run --patch "$T/rules.patch" --tasks-dir "$T/bad" --out "$T/o3" >/dev/null 2>&1
check "E task without rubric" "$?" "2"

echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
