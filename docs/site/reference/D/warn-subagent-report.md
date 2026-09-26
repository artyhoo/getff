---
title: warn-subagent-report hook
description: When a dispatched subagent finishes, this hook reads its final report and warns the orchestrator — out loud, in the model-visible channel — if the canonical sections are missing. It never blocks; it makes incompleteness visible.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/hooks/lib/hook-emit.sh
  - .claude/hooks/warn-subagent-report.sh
  - .claude/rules/attention-is-not-a-mechanism.md
  - .claude/settings.json
  - docs/meta-factory/research-patches/2026-07-24-posttooluse-channel-verification.md
  - docs/site/reference/D.json
  - docs/site/reference/D.md
  - docs/site/reference/D/warn-subagent-report-zcode.md
  - docs/site/terms.md
  - plugin/hooks/warn-subagent-report-zcode
executed:
  - { example: warn-subagent-report-warns-on-a-report-missing-sections, stack: repo, date: 2026-09-25, result: printed }
  - { example: warn-subagent-report-is-silent-on-a-complete-report, stack: repo, date: 2026-09-25, result: silent }
  - { example: warn-subagent-report-noise-guard-ignores-prose-mentions, stack: repo, date: 2026-09-25, result: silent }
docs-refresh: deferred — re-verified 2026-09-25, page authored from the cited sources at this pin; clears at the next refresh of this page
---

# warn-subagent-report hook

## Fact card

What each row means: [how to read a fact card](../D.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the card quotes the hook's own header line and registration JSON verbatim -->

<!-- getff:begin section=D-card-warn-subagent-report plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `warn-subagent-report` |
| kind | hook |
| ships-to | not installed on any lane (no-lane) |
| description | SubagentStop hook — warns when a finishing report misses its canonical sections (non-blocking) |
| source | `.claude/hooks/warn-subagent-report.sh:2` |
| event | `["SubagentStop"]` |
| matcher | `[]` |
| delivery | `["@cc-only-rationale"]` |
<!-- getff:end section=D-card-warn-subagent-report -->

<!-- vale on -->

## Explanation

A dispatched subagent hands its work back as a report, and the orchestrator has to
decide in that moment whether to trust it. The framework's reports therefore have a
canonical shape — `VERIFY:` what you did, `Confidence:` how sure you are, `ATTN:`
what the reader should watch — and this hook checks the shape at the moment the
report lands. Missing sections produce a warning that travels on the
model-visible channel: the orchestrator reads «treat the report as incomplete»
before it acts on the claims.

Deliberately, it only warns. Blocking a finished subagent is a
[gate](../../terms.md#gate), and whether a report is complete enough is a judgment
call the source names as such (`#gate-where-judgment-needed`, lines 4-6) — a
missing section gets surfaced, and the orchestrator decides. Here is the warning,
captured live with its two copies (the JSON the model channel receives, then the
same text on stderr for your transcript):

```bash
printf '%s' '{"session_id":"docs-demo-wsr-1","agent_type":"general-purpose",
  "last_assistant_message":"VERIFY: installed the fix and reran the suite twice.\nAll green locally."}' \
  | bash .claude/hooks/warn-subagent-report.sh
```

```text
{"hookSpecificOutput":{"hookEventName":"SubagentStop","additionalContext":"⚠ SubagentStop: subagent REPORT missing section(s): Confidence,ATTN — treat the report as incomplete; ask the subagent for the missing section(s) before acting on its claims."}}
⚠ SubagentStop: subagent REPORT missing section(s): Confidence,ATTN — treat the report as incomplete; ask the subagent for the missing section(s) before acting on its claims.
```

The dual emit exists because of a measured channel fact: on an exit-0 hook, stderr
reaches only the operator transcript, never the model (lines 8-14, verified in the
2026-07-24 channel research this repo keeps). A warning whose only consumer was a
log line would be exactly the «nobody looked» shape — so the JSON copy is the one
that counts, and the stderr copy is the courtesy.

A complete report stays silent:

```bash
printf '%s' '{"session_id":"docs-demo-wsr-2","agent_type":"general-purpose",
  "last_assistant_message":"VERIFY: installed the fix and reran the suite twice.\nConfidence: 8/10 — reran green twice.\nATTN: the snapshot needs regen on macOS."}' \
  | bash .claude/hooks/warn-subagent-report.sh
```

```text
(nothing — exit 0)
```

And so does anything that was never a report. The noise guard (lines 35-43, 98-106)
requires a REPORT-cue label at the *start of a line* — prose that merely mentions
confidence mid-sentence does not qualify, which is the difference between a guard
and noise:

```bash
printf '%s' '{"session_id":"docs-demo-wsr-3","agent_type":"general-purpose",
  "last_assistant_message":"I have high confidence in my analysis; the commit hash is abc123."}' \
  | bash .claude/hooks/warn-subagent-report.sh
```

```text
(nothing — exit 0)
```

Reading the report takes two paths, in priority order (lines 28-33): the payload's
`last_assistant_message` field directly when present, otherwise the subagent's
transcript file, scanned for the final assistant text. When both yield nothing the
hook exits silently — a genuine nothing-to-scan, not a skipped check.

Delivery per the card: this one is the framework-internal half of the pair. It is
registered only in the project's own settings (`.claude/settings.json:213`) and
carries a plain `@cc-only-rationale` — internal orchestrator machinery, maintainer
environment (line 16). Consumers meet its ZCode-functional twin instead:
[warn-subagent-report-zcode](warn-subagent-report-zcode.md), which anchors the
`@dual-pair: warn-subagent-report` pair and owns the plugin channel. One posture
difference worth noticing: unlike the reminder hooks, a missing `jq` here is a
*loud* skip (lines 60-65) — SubagentStop fires once per finished subagent, so a
«this is a SKIP, not a pass» notice is low-noise and keeps a dead check from
reading as a clean one.

## Evidence

- `.claude/hooks/warn-subagent-report.sh:2` is the header the card's description
  row quotes: `# warn-subagent-report.sh — SubagentStop hook — warns when a finishing report misses its canonical sections (non-blocking)`.
  The WARN-over-block decision with its rationale anchor is lines 3-6.
- Dual-channel emit: `_emit_note` at lines 54-58 — JSON
  `hookSpecificOutput.additionalContext` on stdout plus a stderr copy; the channel
  finding it rests on is lines 8-14, citing
  `docs/meta-factory/research-patches/2026-07-24-posttooluse-channel-verification.md`.
- Required sections: VERIFY (lines 113-115), `Confidence:` (116-118), ATTN
  (119-121), each anchored to line start; the load-bearing-three choice is
  explained at lines 45-47.
- Noise guard: the Explore skip at lines 70-76; `REPORT_CUE_RE` at line 102 with
  the line-start-anchor discussion at lines 38-43 and 99-101.
- Read paths: `last_assistant_message` at line 82, transcript fallback at
  lines 85-93, silent exit when both empty at line 96 («not theatre; capability
  verified above»).
- Loud jq skip: lines 60-65 — «the alternative (silent) makes a skipped
  completeness check read as a pass».
- Registration: `.claude/settings.json:213` (SubagentStop section, no matcher);
  the plugin registry deliberately does not carry this hook — its slot is held by
  the zcode twin (`plugin/hooks/warn-subagent-report-zcode`, registered twice at
  `plugin/hooks/hooks.json:63` and `:165`).
- Pair grammar: the twin's header (lines 4-10) names this file as the SSOT for the
  REPORT grammar — `REPORT_CUE_RE` at line 102 here, section regexes at
  lines 113-121.
- CC-only rationale: line 16 — «internal orchestrator hook, maintainer-env only,
  no portable fire-point».
