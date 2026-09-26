---
title: end-of-turn-reminder hook
description: When a turn ends, this hook decides whether the answer owed you a plain-words recap — and if it was owed and missing, hands the turn back with the instruction, so the model writes it instead of stopping.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/hooks/ask-question-reminder.sh
  - .claude/hooks/end-of-turn-reminder.sh
  - .claude/hooks/lang/en.sh
  - .claude/rules/autonomous-loop-continuity.md
  - .claude/rules/zcode-parity-doctrine.md
  - .claude/settings.json
  - docs/site/reference/D.json
  - docs/site/reference/D.md
  - docs/site/reference/D/ask-question-reminder.md
  - docs/site/terms.md
  - plugin/hooks/hooks.json
  - setup.d/10-skills.sh
executed:
  - { example: end-of-turn-reminder-already-triggered-stop-is-silent, stack: repo, date: 2026-09-25, result: silent }
  - { example: end-of-turn-reminder-sdk-harness-is-silent-by-design, stack: repo, date: 2026-09-25, result: silent }
  - { example: end-of-turn-reminder-long-markdown-answer-is-blocked-for-a-recap, stack: repo, date: 2026-09-25, result: printed }
  - { example: end-of-turn-reminder-turn-that-already-recapped-is-silent, stack: repo, date: 2026-09-25, result: silent }
docs-refresh: deferred — re-verified 2026-09-25, page authored from the cited sources at this pin; clears at the next refresh of this page
---

# end-of-turn-reminder hook

## Fact card

What each row means: [how to read a fact card](../D.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the card quotes the hook's own header line and registration JSON verbatim -->

<!-- getff:begin section=D-card-end-of-turn-reminder plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `end-of-turn-reminder` |
| kind | hook |
| ships-to | framework: react-native, react-next, react-spa, ts-server |
| description | Stop hook — end-of-turn recap + goal-drift verdict reminder |
| source | `.claude/hooks/end-of-turn-reminder.sh:2` |
| event | `["Stop"]` |
| matcher | `[]` |
| delivery | `["@dual-pair:hook-lang-i18n (spec: docs/superpowers/specs/2026-06-01-hook-lang-i18n-design.md)","@cc-only-rationale","plugin"]` |
<!-- getff:end section=D-card-end-of-turn-reminder -->

<!-- vale on -->

## Explanation

Every time a turn ends in your session, this hook reads the final answer and makes a
small judgment: did the turn end the way a careful colleague would — with a short
plain-words recap of where things stand — or did it just stop? A long structural
answer with no recap is *blocked*: the hook returns `decision: "block"` with the
recap instruction as the reason, and the model gets one more turn in which to write
it. On a Stop hook, the `reason` field is what reaches the model; the
`systemMessage` line is for your UI only (lines 1394-1399 — verified against the
hooks docs, with the failed alternative recorded).

The four live runs below tell the whole story. First, a stop the hook itself
already caused is never re-processed — the harness marks it `stop_hook_active`:

```bash
printf '%s' '{"session_id":"docs-demo-eot","stop_hook_active":true,
  "transcript_path":"'$PWD'/node_modules/.cache/eot-demo/t.jsonl"}' \
  | bash .claude/hooks/end-of-turn-reminder.sh
```

```text
(nothing — exit 0)
```

Second, a session driven by the Agent SDK is silent *by design* — the recap is for
a human at a terminal, and in an SDK session the caller's output contract owns the
last message (lines 94-109, where the header records the measured incident that
added the guard). This page's demos ran inside exactly such a harness, so the
guard fired on its own:

```bash
printf '%s' '{"session_id":"docs-demo-eot-2","stop_hook_active":false,
  "transcript_path":"'$PWD'/node_modules/.cache/eot-demo/t.jsonl"}' \
  | bash .claude/hooks/end-of-turn-reminder.sh   # CLAUDE_CODE_ENTRYPOINT=sdk-ts in env
```

```text
(nothing — exit 0)
```

Third — the main case — a long, markdown-dense answer with no recap, in a normal
terminal session (the SDK variable unset). The hook blocks and returns the Branch A
recap instruction; the `systemMessage` glance line shows the session goal it
extracted from the transcript's first user message:

```bash
bash -c 'unset CLAUDE_CODE_ENTRYPOINT
printf "%s" "{\"session_id\":\"docs-demo-eot-3\",\"stop_hook_active\":false,
  \"transcript_path\":\"'$PWD'/node_modules/.cache/eot-demo/t.jsonl\"}" \
  | bash .claude/hooks/end-of-turn-reminder.sh'
```

```text
{
  "decision": "block",
  "reason": "Stop. Before you finish — a recap in plain words, primarily for your own sake.\n\n## 🟢 In plain words — a block of five sections, in this order:\n1. **Where we are.** — always.\n2. **What changed.** — if the answer is long or structural. …",
  "systemMessage": "🎯 Demonstrate the end-of-turn recap hook on a long answer. "
}
```

(The `reason` continues for another ~3 KB — the five-section grammar, the fork-card
spec, sentence-length discipline, the glossary rules. It comes from the English
language pack's `aif_msg_eot_branch_a`; there is nothing hidden in it, it is just
long.) Fourth, the same shape of turn that *already begins with* the recap marker
(`## 🟢 In plain words`) stays silent — re-injecting the instruction over an
existing recap would be noise (lines 1105-1172). That guard's placement is one of
the most-documented lines in the file: an earlier version sat behind other
early-exits and went silent in precisely its motivating case, which the header's
2026-07-24 cold-audit note (lines 122-132) records as the reason several guards now
route every exit through one function.

Which branch fires depends on the turn's shape (lines 1364-1392): a long answer
*and* a trailing question gets the whole-session recap plus the fork-challenge
(Branch C); a long answer alone gets the lighter per-turn recap (Branch A, the demo
above); a bare question with no body gets the fork-challenge only (Branch B); a
turn that created a pull request gets the story recap; short chatter gets silence.

The recap is the default, but it is not the only thing this hook can say — several
optional riders append to the *same* block, never a second one (lines 208-244,
1400-1418): with `AIF_AUTONOMOUS=1`, an in-flight-work probe blocks turn-ends that
would abandon dispatched tasks (the F10 arm); the context arm estimates session
token usage from the transcript and, past a soft floor (300,000 of an assumed
1M-token window — both tunable), suggests a handoff to a fresh session; an optional
handoff-currency gate (armed with `AIF_HANDOFF_GATE=1`) blocks turn-ends whose
context is deep enough that a stale handoff file would be dangerous, unless the
turn's final text carries a `mechanical-tail:` token with a reason; and a glossary
arm can demand the «term (explanation)» form once for a term your prompt just used.
Each rider is off by default; the unarmed hook's output is byte-identical to the
plain recap gate.

Delivery per the card: consumer installs copy and register it
(`setup.d/10-skills.sh:244-267`), the framework registers it at
`.claude/settings.json:193`, the plugin registry at `plugin/hooks/hooks.json:173`.
All prose comes from the `lang/` packs (`AIF_HOOK_LANG`, English fallback). On
ZCode the census classifies it degraded (row 9 of
`.claude/rules/zcode-parity-doctrine.md` §2): the recap branches work, while the
context and gate arms are inert there because synthetic transcripts carry no token
usage. A missing `jq` degrades to a silent exit 0 (lines 12-15) — the same
consumer-safe posture as its question-time companion
[ask-question-reminder](ask-question-reminder.md).

## Evidence

- `.claude/hooks/end-of-turn-reminder.sh:2` is the header the card's description
  row quotes: `# end-of-turn-reminder.sh — Stop hook — end-of-turn recap + goal-drift verdict reminder`.
  Lines 3-9 carry the `@cc-only-rationale` marker and the consumer-delivery note
  (GH #934).
- Block emit: lines 1420-1424 — `{decision: "block", reason: $msg, systemMessage:
  $gl}`; the reason-reaches-model vs systemMessage-UI-only verification is recorded
  at lines 1394-1399.
- Branch selection: the shape function at lines 920-974 (long-text predicate at
  920-925: >500 chars plus a markdown-structure pattern; orchestration mode lowers
  the threshold to 200), the three branches at lines 1383-1392, the story signal at
  lines 750-757.
- Already-recapped guard: line 1110 greps for `$AIF_RECAP_MARKER`; the 2026-07-24
  cold-audit postmortem on its placement is lines 122-132 and 1090-1103.
- SDK guard: lines 94-109 — `CLAUDE_CODE_ENTRYPOINT` prefix-match `sdk-*`, opt-in
  restore via `AIF_EOT_SDK_RECAP=1`; the measured incident (503 of 503 review-gate
  runs parsing null) is lines 95-104.
- stop_hook_active guard: lines 89-92.
- Context arm: floors at lines 421-434 (soft 300,000 / deep 500,000, percentages
  70/90, all env-tunable), window precedence DECLARED > OBSERVED > 1M default at
  lines 391-412, the honest-limit discussion at lines 314-354.
- Handoff-currency gate: armed at line 458 (`AIF_HANDOFF_GATE=1`); the
  `mechanical-tail:` escape with a ≥20-char reason is line 712; the out-of-band
  `/compact` guard (D37) is lines 716-749.
- F10 autonomy arm: `AIF_AUTONOMOUS=1` at line 151, the in-flight probe at
  lines 152-205; the anchor rule `#F10` names this hook in
  `.claude/rules/autonomous-loop-continuity.md`.
- Glossary arm: pending-file contract with the `glossary-inject` UserPromptSubmit
  twin at lines 764-797, thresholds `AIF_GLOSSARY_USES`/`AIF_GLOSSARY_EXPLAINS`
  (defaults 3/5) at lines 838-842.
- Language pack: lines 23-45; the marker and branch messages live in
  `.claude/hooks/lang/en.sh` (`AIF_RECAP_MARKER` at line 16, `aif_msg_eot_branch_a`
  at line 155).
- Registration: `.claude/settings.json:193` (Stop section, no matcher);
  `plugin/hooks/hooks.json:173`; consumer install at `setup.d/10-skills.sh:244-267`
  (copy at 244-245, `register_cc_hook` Stop at 267).
- ZCode: census row 9 (`.claude/rules/zcode-parity-doctrine.md` §2) — degraded;
  the thin-recap branch and its inert context arm are documented at lines
  1186-1219 of the hook.
- Paired test: the header comment at lines 680-683 names
  `end-of-turn-reminder.test.ts` and its two fixture tests
  (`zcode_synthetic_transcript_last_line_extracted_via_role`,
  `cc_transcript_last_line_extracted_via_type`).
