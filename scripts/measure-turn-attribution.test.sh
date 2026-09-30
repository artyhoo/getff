#!/usr/bin/env bash
# measure-turn-attribution.test.sh — acceptance for the §10 NATIVE RULE LOADS arm and the
# MEASURE_SECTIONS=native-load population mode of measure-turn-attribution.sh
# (trigger build, slice 2 kickoff §2.3; the arm reads native `nested_memory` attachments).
#
# Corpus is built in `mktemp -d` from this file's own constants — no host corpus, no network.
# Every asserted number is DERIVED from the fixture text via jq (`$t | length` = codepoints,
# the spec's unit). `wc -m` is deliberately absent: it follows the locale and counts BYTES
# under C/POSIX, which is exactly the unit drift this fixture exists to catch (the non-ASCII
# rule texts make characters ≠ bytes). The two real content shapes are both present:
# Claude Code 2.1.281 writes `.attachment.content` as an OBJECT whose own `content` key holds
# the rule text; 2.1.270 wrote it as a plain STRING. A third record carries an attachment type
# this script has NO arm for (`skill_listing`, live in real transcripts) — §10 must surface it
# on the NATIVE-ATTACHMENT-UNSEEN line instead of letting it vanish silently.
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$DIR/measure-turn-attribution.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
command -v jq >/dev/null 2>&1 || { echo "  · SKIP — jq unavailable"; echo "PASS=0 FAIL=0"; exit 0; }
[ -x "$SCRIPT" ] || { echo "FATAL: $SCRIPT not found"; exit 1; }

expect() { # $1 label  $2 expected  $3 got
  if [ "$2" = "$3" ]; then ok "$1 = $2"; else bad "$1: expected [$2], got [$3]"; fi
}
expect_sub() { # $1 label  $2 fixed string that must appear in $3
  if grep -Fq -- "$2" <<<"$3"; then ok "$1"; else bad "$1: missing [$2]"; fi
}
expect_absent() { # $1 label  $2 fixed string that must NOT appear in $3
  if grep -Fq -- "$2" <<<"$3"; then bad "$1: forbidden string present [$2]"; else ok "$1"; fi
}
expect_rc0()  { if [ "$2" -eq 0 ]; then ok "$1"; else bad "$1: expected exit 0, got $2"; fi; }
expect_rcnz() { if [ "$2" -ne 0 ]; then ok "$1"; else bad "$1: expected non-zero exit, got 0"; fi; }
expect_rc()   { if [ "$2" -eq "$3" ]; then ok "$1"; else bad "$1: expected exit $3, got $2"; fi; }

# ── fixture rule texts (non-ASCII on purpose: characters must differ from bytes) ───────────────
RULE_A='alpha — keep the invariant table in sync; κανόνας πρώτος.'
RULE_B='beta: companion rule for the distinct-paths figure.'
RULE_C='nested CLAUDE.md body — a native load, never a rule load.'
RULE_D='gamma γραμμή: string-shape record written by 2.1.270.'

len_of()   { jq -rn --arg t "$1" '$t | length'; }            # codepoints — the spec unit
bytes_of() { jq -rn --arg t "$1" '$t | utf8bytelength'; }    # bytes — NOT the spec unit

A_LEN=$(len_of "$RULE_A"); B_LEN=$(len_of "$RULE_B")
C_LEN=$(len_of "$RULE_C"); D_LEN=$(len_of "$RULE_D")
A_BYTES=$(bytes_of "$RULE_A"); D_BYTES=$(bytes_of "$RULE_D")

SESS_CHARS=$(( A_LEN + A_LEN + B_LEN ))   # alpha loaded twice + beta once
VER281_CHARS="$SESS_CHARS"                # every session rule load is a 2.1.281 record

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# ── record builders (jq guarantees valid JSONL) ────────────────────────────────────────────────
asst() { # v sid ts model i cw cr o
  jq -cn --arg v "$1" --arg s "$2" --arg ts "$3" --arg m "$4" \
    --argjson i "$5" --argjson cw "$6" --argjson cr "$7" --argjson o "$8" \
    '{type:"assistant",version:$v,sessionId:$s,isSidechain:false,timestamp:$ts,
      message:{model:$m,usage:{input_tokens:$i,cache_creation_input_tokens:$cw,
        cache_read_input_tokens:$cr,output_tokens:$o,
        cache_creation:{ephemeral_5m_input_tokens:$cw,ephemeral_1h_input_tokens:0}}}}'
}
asst_tooluse() { # v sid ts model — a turn that also carries a tool_use (counts as an A record)
  jq -cn --arg v "$1" --arg s "$2" --arg ts "$3" --arg m "$4" \
    '{type:"assistant",version:$v,sessionId:$s,isSidechain:false,timestamp:$ts,
      message:{model:$m,content:[{type:"tool_use",id:"tu_1",name:"Bash",input:{command:"ls"}}],
        usage:{input_tokens:11,cache_creation_input_tokens:21,cache_read_input_tokens:6,output_tokens:8,
          cache_creation:{ephemeral_5m_input_tokens:21,ephemeral_1h_input_tokens:0}}}}'
}
tool_result() { # sid ts
  jq -cn --arg s "$1" --arg ts "$2" \
    '{type:"user",version:"2.1.281",sessionId:$s,isSidechain:false,timestamp:$ts,
      message:{content:[{type:"tool_result",tool_use_id:"tu_1",content:"fixture tool output"}]}}'
}
att_rule_obj() { # path text version sid ts — 2.1.281 shape: content is an OBJECT (6 keys)
  jq -cn --arg p "$1" --arg t "$2" --arg v "$3" --arg s "$4" --arg ts "$5" \
    '{type:"attachment",version:$v,sessionId:$s,isSidechain:false,timestamp:$ts,
      attachment:{type:"nested_memory",path:$p,
        content:{content:$t,contentDiffersFromDisk:false,globs:"",path:$p,rawContent:$t,type:"text"}}}'
}
att_rule_str() { # path text version sid ts — 2.1.270 shape: content IS the string
  jq -cn --arg p "$1" --arg t "$2" --arg v "$3" --arg s "$4" --arg ts "$5" \
    '{type:"attachment",version:$v,sessionId:$s,isSidechain:true,timestamp:$ts,
      attachment:{type:"nested_memory",path:$p,content:$t}}'
}
att_hook() { # sid ts — hook INVOCATION attachment; .command set, no nested_memory type
  jq -cn --arg s "$1" --arg ts "$2" \
    '{type:"attachment",version:"2.1.281",sessionId:$s,isSidechain:false,timestamp:$ts,
      attachment:{hookEvent:"PostToolUse",
        command:"bash .claude/hooks/inject-matching-rule.sh",
        stdout:"see .claude/rules/ai-laziness-digest.md"}}'
}
att_unknown() { # sid ts — an attachment shape with NO arm (skill_listing); the silent-drop guard
  jq -cn --arg s "$1" --arg ts "$2" \
    '{type:"attachment",version:"2.1.281",sessionId:$s,isSidechain:false,timestamp:$ts,
      attachment:{type:"skill_listing",skills:[]}}'
}
att_drift() { # sid ts — nested_memory whose content type DRIFTED to an array. The N arm
              # refuses it (its extraction formula would be a jq runtime error on this
              # shape, silently dropping the record below every arm) and the X arm must
              # surface it on the UNSEEN line; it must enter NO §10 total.
  jq -cn --arg s "$1" --arg ts "$2" \
    '{type:"attachment",version:"2.1.281",sessionId:$s,isSidechain:false,timestamp:$ts,
      attachment:{type:"nested_memory",path:"/home/www/repo/.claude/rules/drift.md",
        content:["array","shape"]}}'
}

# ── transcripts ────────────────────────────────────────────────────────────────────────────────
# sess.jsonl (session population, CC 2.1.281): billing turns + tool round-trip + one hook
# attachment + alpha loaded TWICE (records 2, paths 1) + beta once + a nested CLAUDE.md.
TX="$TMP/tx"; mkdir -p "$TX"
S=2.1.281; OLD=2.1.270
{
  asst      "$S" sess-1 "2026-09-30T08:00:01.000Z" claude-sonnet-5 10 20 5 7
  asst_tooluse "$S" sess-1 "2026-09-30T08:00:02.000Z" claude-sonnet-5
  tool_result sess-1 "2026-09-30T08:00:03.000Z"
  att_hook  sess-1 "2026-09-30T08:00:04.000Z"
  att_unknown sess-1 "2026-09-30T08:00:04.500Z"
  att_drift sess-1 "2026-09-30T08:00:04.600Z"
  att_rule_obj "/home/www/repo/.claude/rules/alpha.md" "$RULE_A" "$S" sess-1 "2026-09-30T08:00:05.000Z"
  att_rule_obj "/home/www/repo/.claude/rules/alpha.md" "$RULE_A" "$S" sess-1 "2026-09-30T08:00:06.000Z"
  att_rule_obj "/home/www/repo/.claude/rules/beta.md"  "$RULE_B" "$S" sess-1 "2026-09-30T08:00:07.000Z"
  att_rule_obj "/home/www/repo/CLAUDE.md"              "$RULE_C" "$S" sess-1 "2026-09-30T08:00:08.000Z"
} > "$TX/sess.jsonl"
# sa1.jsonl (subagent population, CC 2.1.270): the STRING content shape.
{
  asst        "$OLD" sess-1-sa "2026-09-30T08:01:01.000Z" claude-sonnet-5 12 22 7 9
  att_rule_str "/home/www/repo/.claude/rules/gamma.md" "$RULE_D" "$OLD" sess-1-sa "2026-09-30T08:01:02.000Z"
} > "$TX/sa1.jsonl"
# sa2.jsonl (subagent population, 2.1.281): billing only, so corpus_full stays UNEQUAL (1+2) and
# the default run's equal-populations guard stays exercisable on corpus-equal (1+1).
{ asst "$S" sess-1-sb "2026-09-30T08:02:01.000Z" claude-sonnet-5 13 23 8 10; } > "$TX/sa2.jsonl"

mkcorpus() { # $1 name, then transcript filenames; prints the corpus dir
  local d="$TMP/corpus-$1"; mkdir -p "$d"
  shift
  local f
  for f in "$@"; do
    if [ "$f" = "sess.jsonl" ]; then
      cp "$TX/$f" "$d/sess.jsonl"
    else
      mkdir -p "$d/proj/subagents"; cp "$TX/$f" "$d/proj/subagents/$f"
    fi
  done
  printf '%s' "$d"
}
CORPUS_FULL=$(mkcorpus full sess.jsonl sa1.jsonl sa2.jsonl)
CORPUS_EQUAL=$(mkcorpus equal sess.jsonl sa1.jsonl)
CORPUS_SESSION=$(mkcorpus session sess.jsonl)
CORPUS_SUB=$(mkcorpus sub sa1.jsonl)
CORPUS_EMPTY="$TMP/corpus-empty"; mkdir -p "$CORPUS_EMPTY"

run_measure() { # $1 corpus dir  $2 mode ("" = default)
  if [ -n "$2" ]; then
    OUT=$(MEASURE_SECTIONS="$2" CORPUS_ROOT="$1" PROJECT_MATCH='*' bash "$SCRIPT" 2>&1)
  else
    OUT=$(CORPUS_ROOT="$1" PROJECT_MATCH='*' bash "$SCRIPT" 2>&1)
  fi
  RC=$?
}
sec10() { sed -n '/^=== §10 NATIVE RULE LOADS ===$/,/^=== END OF RUN ===$/p' <<<"$1"; }

echo "▶ fixture self-checks (the fixture must keep its discriminating power)"
expect "alpha chars != bytes (non-ASCII present)" "differs" \
  "$([ "$A_LEN" -ne "$A_BYTES" ] && echo differs || echo same)"
expect "gamma chars != bytes (non-ASCII present)" "differs" \
  "$([ "$D_LEN" -ne "$D_BYTES" ] && echo differs || echo same)"
# T-TB2-A: a wrong-field read (.attachment.content | length on the OBJECT shape) returns the
# KEY COUNT (6), a plausible-looking total. The fixture only catches that trap while len(A) != 6.
TRAP_LEN=$(att_rule_obj /p "$RULE_A" 2.1.281 s t | jq -r '.attachment.content | length')
expect "object-shape wrong-field read yields the key count (the T-TB2-A trap)" "6" "$TRAP_LEN"
expect "fixture alpha length differs from the trap value" "differs" \
  "$([ "$A_LEN" -ne "$TRAP_LEN" ] && echo differs || echo same)"

echo "▶ §10 exact values (MEASURE_SECTIONS=native-load, corpus-full 1 session + 2 subagents)"
run_measure "$CORPUS_FULL" native-load
expect_rc0 "native-load over an unequal corpus exits 0" "$RC"
expect_absent "§1 computation is skipped in native-load mode" "=== §1 BILLING" "$OUT"
expect_absent "§9 computation is skipped in native-load mode" "=== §9 BOOTSTRAP" "$OUT"
expect_sub "§10 present in native-load mode" "=== §10 NATIVE RULE LOADS ===" "$OUT"
SESS_KEY="NATIVE-RULE-LOADS pop=session records=3 paths=2 chars=$SESS_CHARS"
SUB_KEY="NATIVE-RULE-LOADS pop=subagent records=1 paths=1 chars=$D_LEN"
expect_sub "session rule-load key line" "$SESS_KEY" "$OUT"
expect_sub "subagent rule-load key line" "$SUB_KEY" "$OUT"
expect_sub "session non-rule line (CLAUDE.md out of rule totals)" \
  "NATIVE-MEMORY-NONRULE pop=session records=1 paths=1 chars=$C_LEN" "$OUT"
expect_sub "subagent non-rule line (zero reported as 0)" \
  "NATIVE-MEMORY-NONRULE pop=subagent records=0 paths=0 chars=0" "$OUT"
expect_sub "session version split (2.1.281)" \
  "version=2.1.281 records=3 chars=$VER281_CHARS" "$OUT"
expect_sub "subagent version split (2.1.270)" \
  "version=2.1.270 records=1 chars=$D_LEN" "$OUT"
expect_sub "unseen attachment shapes surfaced and typed (skill_listing + content drift)" \
  "NATIVE-ATTACHMENT-UNSEEN pop=session records=2 types=nested_memory,skill_listing" "$OUT"
expect_sub "unseen attachment line: zero reported as 0" \
  "NATIVE-ATTACHMENT-UNSEEN pop=subagent records=0 types=-" "$OUT"
SEC="$(sec10 "$OUT")"
expect_sub "top-file line: alpha at 2x chars" "$(( A_LEN + A_LEN )) .claude/rules/alpha.md" "$SEC"
expect_sub "top-file line: beta at its chars" "$B_LEN .claude/rules/beta.md" "$SEC"
expect_sub "top-file line: gamma at its chars" "$D_LEN .claude/rules/gamma.md" "$SEC"
expect_absent "top-file paths are repo-relative (raw prefix trimmed)" "/home/www/repo" "$SEC"
expect_absent "rule text is never printed (alpha)" "${RULE_A:0:12}" "$SEC"
expect_absent "rule text is never printed (gamma)" "${RULE_D:0:12}" "$SEC"
# The drifted nested_memory carries a RULE path — it must not enter the rule totals (the
# session key line above staying records=3/chars=$SESS_CHARS is that assert) nor the top list.
expect_absent "content-shape drift stays out of the §10 totals (drift.md absent)" \
  "drift.md" "$SEC"

echo "▶ population mode over single-population corpora"
run_measure "$CORPUS_SESSION" native-load
expect_rc0 "session-only corpus exits 0 in native-load mode" "$RC"
expect_sub "session-only: session key line keeps its values" "$SESS_KEY" "$OUT"
expect_sub "session-only: subagent population reported as 0" \
  "NATIVE-RULE-LOADS pop=subagent records=0 paths=0 chars=0" "$OUT"
run_measure "$CORPUS_SUB" native-load
expect_rc0 "subagent-only corpus exits 0 in native-load mode" "$RC"
expect_sub "subagent-only: session population reported as 0" \
  "NATIVE-RULE-LOADS pop=session records=0 paths=0 chars=0" "$OUT"
expect_sub "subagent-only: subagent key line keeps its values" "$SUB_KEY" "$OUT"
run_measure "$CORPUS_EQUAL" native-load
expect_rc0 "equal populations (1+1) are legal in native-load mode" "$RC"

echo "▶ empty corpus still fails loudly"
run_measure "$CORPUS_EMPTY" native-load
expect_rcnz "native-load over an empty corpus exits non-zero" "$RC"

echo "▶ MEASURE_SECTIONS value validation (a typo must not silently run the full mode)"
run_measure "$CORPUS_FULL" native_load
expect_rc "unknown MEASURE_SECTIONS value exits 2 before any corpus work" "2" "$RC"
expect_sub "unknown-value FATAL names the variable and the value" \
  "FATAL: unknown MEASURE_SECTIONS value: native_load" "$OUT"
expect_sub "unknown-value FATAL names the supported states" \
  "supported: unset (full §0-§10 run) or native-load (§0 + §10 only)" "$OUT"
expect_absent "unknown value never falls through to §10" "=== §10 NATIVE RULE LOADS ===" "$OUT"

echo "▶ default mode unchanged (guards kept, §0-§9 headers kept, §10 added)"
run_measure "$CORPUS_SESSION" ""
expect_rcnz "zero population still exits non-zero in default mode" "$RC"
run_measure "$CORPUS_EQUAL" ""
expect_rcnz "equal populations still exit non-zero in default mode" "$RC"
run_measure "$CORPUS_FULL" ""
expect_rc0 "default mode over the unequal corpus exits 0" "$RC"
for h in "§0 CORPUS" "§1 BILLING" "§2 PER-MODEL" "§3 TURN-COUNT" "§4 TOOL-CALL" \
         "§5 TOOL-RESULT" "§6 PER-TURN" "§7 TOOL-OUTPUT" "§8 HOOK INJECTION" \
         "§9 BOOTSTRAP-INJECTOR" "§10 NATIVE RULE LOADS" "END OF RUN"; do
  expect_sub "default run prints === $h" "=== $h" "$OUT"
done
expect_sub "default run: §8 still sees the hook attachment" "inject-matching-rule.sh" "$OUT"
expect_sub "default run: STREAM-RECORDS counted" "STREAM-RECORDS:" "$OUT"

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
