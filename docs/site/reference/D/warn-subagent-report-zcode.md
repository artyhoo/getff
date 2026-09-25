---
title: warn-subagent-report-zcode hook
description: The plugin-channel twin of the subagent-report warner — two arms instead of one, because ZCode has no SubagentStop event: it reads the Agent tool's payload the instant it returns, then sweeps the transcript at turn end.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/hooks/warn-subagent-report.sh
  - .claude/rules/zcode-parity-doctrine.md
  - docs/meta-factory/research-patches/2026-07-18-zcode-parity-s4-warn-subagent.md
  - docs/meta-factory/zcode-parity-mega.decisions.md
  - docs/site/reference/D.json
  - docs/site/reference/D.md
  - docs/site/reference/D/warn-subagent-report.md
  - docs/site/terms.md
  - plugin/hooks/_zcode-emit
  - plugin/hooks/hooks.json
  - plugin/hooks/warn-subagent-report-zcode
executed:
  - { example: warn-subagent-report-zcode-arm-a-warns-on-a-missing-section, stack: repo, date: 2026-09-25, result: printed }
  - { example: warn-subagent-report-zcode-dedup-silences-the-second-look, stack: repo, date: 2026-09-25, result: silent }
  - { example: warn-subagent-report-zcode-arm-b-sweeps-the-transcript-at-stop, stack: repo, date: 2026-09-25, result: printed }
docs-refresh: deferred — re-verified 2026-09-25, page authored from the cited sources at this pin; clears at the next refresh of this page
---

# warn-subagent-report-zcode hook

## Fact card

What each row means: [how to read a fact card](../D.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the card quotes the hook's own header line and registration JSON verbatim -->

<!-- getff:begin section=D-card-warn-subagent-report-zcode plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `warn-subagent-report-zcode` |
| kind | hook |
| ships-to | plugin |
| description | ZCode-functional twin of .claude/hooks/warn-subagent-report.sh |
| source | `plugin/hooks/warn-subagent-report-zcode:2` |
| event | `["PostToolUse","Stop"]` |
| matcher | `["Agent|Task"]` |
| delivery | `["@dual-pair:warn-subagent-report","plugin"]` |
<!-- getff:end section=D-card-warn-subagent-report-zcode -->

<!-- vale on -->

## Explanation

ZCode has no SubagentStop event, so the report-completeness warning from
[warn-subagent-report](warn-subagent-report.md) needs a different fire-point there.
This twin replaces the one event with two it does have: **Arm A** fires the moment
the Agent tool returns and reads the tool's payload directly — up to 120 KB of
result text, far more than the CC payload carries — and **Arm B** fires at turn end
and sweeps the transcript for any Agent result it has not yet judged, catching
payloads that were truncated or skipped. The same REPORT grammar decides both:
a line starting `VERIFY:` (its `## VERIFY` heading form counts too), `Confidence:`,
`ATTN:`, or `Commit:` marks a report, and a report missing any of the three
required sections — VERIFY, Confidence, ATTN — gets the warning.

Arm A, live (the payload here is deliberately minimal — a `VERIFY:` line and
nothing else):

```bash
printf '%s' '{"hook_event_name":"PostToolUse","session_id":"docs-demo-wsz-1",
  "tool_input":"VERIFY: installed the fix and reran the suite twice.\nAll green locally."}' \
  | bash plugin/hooks/warn-subagent-report-zcode
```

```text
⚠ PostToolUse:Agent: subagent REPORT missing section(s): Confidence,ATTN
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "⚠ PostToolUse:Agent: subagent REPORT missing section(s): Confidence,ATTN"
  }
}
```

The stderr line is for your terminal; the JSON is the model channel. Each harness
gets its own shape — under ZCode the same warning wraps as strict JSON through the
shared `_zcode-emit` helper, under CC it passes through `jq -Rs` as above
(`_warn`, lines 50-64). That channel split is itself a recorded fix: an earlier
single emit path sent the warning to stderr on *both* harnesses, meaning no model
anywhere ever read it (the A3-1 note at lines 37-49).

Judge the same payload twice and the second look stays silent — every judged
result is recorded under a key that prefers the payload's `toolCallId` and falls
back to a content hash (lines 96-127). The record lives in
`${TMPDIR}/warn-subagent-zcode-<session>.lst`, so this demo follows the one above
in the same shell:

```bash
printf '%s' '{"hook_event_name":"PostToolUse","session_id":"docs-demo-wsz-1",
  "tool_input":"VERIFY: installed the fix and reran the suite twice.\nAll green locally."}' \
  | bash plugin/hooks/warn-subagent-report-zcode
```

```text
(nothing — exit 0)
```

Arm B reads a transcript file for `tool_result` entries, applies the same grammar,
and skips anything Arm A already recorded — the demo transcript carries one
half-report that Arm A never saw:

```bash
printf '%s\n' '{"message":{"content":[{"type":"tool_result","tool_use_id":"call-9","content":"VERIFY: half a report"}]}}' \
  > node_modules/.cache/eot-demo/t3.jsonl
printf '%s' '{"hook_event_name":"Stop","session_id":"docs-demo-wsz-3",
  "transcript_path":"'$PWD'/node_modules/.cache/eot-demo/t3.jsonl"}' \
  | bash plugin/hooks/warn-subagent-report-zcode
```

```text
⚠ Stop: subagent REPORT missing section(s): Confidence,ATTN
{
  "hookSpecificOutput": {
    "hookEventName": "Stop",
    "additionalContext": "⚠ Stop: subagent REPORT missing section(s): Confidence,ATTN"
  }
}
```

(The demo recreates its fixture inline; delete the cache directory when done.) The
sweep is bounded — the newest 500 candidate lines by default (`AIF_WSR_MAX_LINES`)
— because the header's A3-2 note (lines 221-226) records the measurement that
killed the unbounded form: 12.99 seconds per Stop event and a timeout kill on
every turn of a long session.

Two design facts make this twin more than a copy. The REPORT grammar is *mirrored
verbatim*, not shared: extensionless plugin hooks are standalone scripts, so the
twin's header (lines 4-10) names the CC source file as the grammar's SSOT and
cites it by line number. And the two-arm shape is a recorded decision, not an
accident: the operator fork chose the 4D hybrid (real-time arm + completeness arm)
over Stop-only, PostToolUse-only, and CC-only alternatives
(`docs/meta-factory/zcode-parity-mega.decisions.md` §Fork 2, evidence base in the
s4 research patch). In the parity census this is row 19, classified `parity` via
the 4D hybrid — the CC SubagentStop capability and its ZCode replacement are the
same discipline on two fire-points.

## Evidence

- `plugin/hooks/warn-subagent-report-zcode:2` is the header the card's description
  row quotes: `# warn-subagent-report-zcode — ZCode-functional twin of .claude/hooks/warn-subagent-report.sh`.
- Arm dispatch: lines 309-315 — `.hook_event_name` selects `_arm_a_post` or
  `_arm_b_stop`; unknown events exit 0 (WARN never blocks).
- Arm A payload read: lines 141-158 — `.tool_input` first (the R4 primary path),
  schema-drift fallbacks `.tool_result.content[].text` / `.tool_response` /
  `.tool_result` after a type check.
- Arm B sweep: transcript read at lines 202-231, the one-jq-process extraction with
  NUL-delimited records at lines 270-283, aggregation of multiple missing-section
  signatures at lines 285-294, the `stop_hook_active` guard at lines 196-199.
- Grammar SSOT: the mirror note at line 67 — «Mirrors
  .claude/hooks/warn-subagent-report.sh:74-97 VERBATIM (grammar SSOT)» — directly
  above `_required_sections_check` (lines 73-94, returns 0/1/2); the CC file owns
  `REPORT_CUE_RE` (line 102) and the section regexes (lines 113-121).
- Dedup: `_dedup_key` at lines 99-107 (`toolCallId` → `tool_call_id` → sha256 →
  cksum), session state file at lines 111-127; Arm A records judged keys at
  line 182 so Arm B skips them (line 263).
- Channel fix: `_warn` at lines 50-64; the A3-1 rationale (stderr-reaches-no-model
  measurement, per the 2026-07-24 channel research) at lines 37-49.
- Bounded sweep: `AIF_WSR_MAX_LINES` default 500 at lines 227-228; the A3-2
  measurement (12.99 s, 2004 jq spawns, 60 s timeout kills) at lines 221-226.
- jq guard: line 131 — silent exit 0 without jq, the consumer-safe pattern shared
  with the CC source's reminders.
- Registration: `plugin/hooks/hooks.json:63` (PostToolUse, matcher `Agent|Task`)
  and `:165` (Stop, no matcher) — the two arms are two registrations of one
  script.
- Decision record: `docs/meta-factory/zcode-parity-mega.decisions.md` §Fork 2
  (ADOPT 4D; 4A latency penalty, 4B completeness gap, 4C parity break rejected);
  evidence `docs/meta-factory/research-patches/2026-07-18-zcode-parity-s4-warn-subagent.md`
  (R1-R5), summarised in the twin's header lines 17-23.
- Census row 19 (`.claude/rules/zcode-parity-doctrine.md` §2): `parity` (4D hybrid
  variant) — «works via 4D hybrid (#1046): PostToolUse:Agent real-time arm + Stop
  completeness arm deliver the report the SubagentStop event would have carried»;
  the doctrine's §3 Stage-5 row records the closing note «ZCode has 120KB payload
  vs CC 4KB — ZCode is better».
