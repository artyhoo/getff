---
title: check-worker-dispatch-channel hook
description: Writing a kickoff that tells the orchestrator to dispatch write Workers through the Agent tool? This gate catches the line while you are still typing the file — the same shared matcher that CI runs, moved to the earliest moment.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/hooks/check-worker-dispatch-channel.sh
  - .claude/hooks/lib/hook-emit.sh
  - .claude/settings.json
  - docs/meta-factory/research-patches/2026-06-27-meta-orch-channel-discipline-mechanism.md
  - docs/site/reference/D.json
  - docs/site/reference/D.md
  - docs/site/terms.md
  - packages/core/hooks/check-worker-dispatch-channel.test.ts
  - packages/core/principles/29-worker-dispatch-channel.bin.ts
  - packages/core/principles/29-worker-dispatch-channel.ts
  - plugin/hooks/hooks.json
executed:
  - { example: worker-dispatch-green-on-a-clean-kickoff, stack: repo, date: 2026-09-25, result: silent }
  - { example: worker-dispatch-red-on-an-agent-tool-write-dispatch, stack: repo, date: 2026-09-25, result: printed }
docs-refresh: deferred — re-verified 2026-09-25, page authored from the cited sources at this pin; clears at the next refresh of this page
---

# check-worker-dispatch-channel hook

## Fact card

What each row means: [how to read a fact card](../D.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the card quotes the hook's own header line and registration JSON verbatim -->

<!-- getff:begin section=D-card-check-worker-dispatch-channel plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `check-worker-dispatch-channel` |
| kind | hook |
| ships-to | not installed on any lane (no-lane) |
| description | PostToolUse gate — edit-time channel for #worker-dispatch-via-subagent |
| source | `.claude/hooks/check-worker-dispatch-channel.sh:2` |
| event | `["PostToolUse"]` |
| matcher | `["Edit|Write|MultiEdit"]` |
| delivery | `["@dual-pair:channel-discipline-worker-dispatch","@cc-only-rationale","plugin"]` |
<!-- getff:end section=D-card-check-worker-dispatch-channel -->

<!-- vale on -->

## Explanation

The framework has a rule about how write-Workers get dispatched: not from inside the
orchestrator session through the Agent tool. A dispatched sub-agent cannot be trusted
with shared state the way a fresh session can, and the rule — `#worker-dispatch-via-subagent`
— is normally enforced in CI by principle 29. But CI is late. This hook is the same
check at the moment the kickoff is written: edit an umbrella `kickoff.md`, and every
line you just wrote is tested for one shape — a line that names the Agent-tool
dispatch channel **and** targets a write Worker.

It is deliberately a thin wrapper. The matcher is one shared module, and both this
hook and the CI principle test call it — the hook header names the anti-pattern of two
divergent copies and refuses it. Here it is passing on the framework's real umbrella
kickoff:

```bash
printf '%s' '{"tool_name":"Edit","session_id":"docs-demo-cwd-1",
  "tool_input":{"file_path":"'$PWD'/.claude/orchestrator-prompts/getff-ai-site/kickoff.md"}}' \
  | bash .claude/hooks/check-worker-dispatch-channel.sh
```

```text
(nothing — exit 0)
```

And failing on a line that instructs the anti-pattern — the demo writes one so you
can run it:

```bash
mkdir -p .claude/orchestrator-prompts/tmp-red-wd
printf '%s\n' '# demo kickoff' 'Dispatch the implementation Worker via Agent tool.' \
  > .claude/orchestrator-prompts/tmp-red-wd/kickoff.md
printf '%s' '{"tool_name":"Edit","session_id":"docs-demo-cwd-2",
  "tool_input":{"file_path":"'$PWD'/.claude/orchestrator-prompts/tmp-red-wd/kickoff.md"}}' \
  | bash .claude/hooks/check-worker-dispatch-channel.sh
```

```text
❌ worker-dispatch-channel: .claude/orchestrator-prompts/tmp-red-wd/kickoff.md:2 instructs Agent-tool dispatch of a write Worker
   Dispatch the implementation Worker via Agent tool.
   Rule `#worker-dispatch-via-subagent` (.claude/skills/pipeline/SKILL.md §5): a write-task Worker
   must NOT be dispatched via the Agent tool from the meta-orchestrator session. Use a fresh
   maintainer-opened CC session (paste the §10 1-liner) or dispatch.ts. The Agent tool is ONLY
   for Phase -1 read-only reviewers + read-only research subagents.
   If this line legitimately QUOTES/TEACHES the anti-pattern, append on the same line:
   <!-- channel-discipline: allow <reason> -->
```

Remove the demo directory when you are done. The exit code is 2 — not the matcher's
own exit 1 — because exit 2 is the [channel](../../terms.md#channel) whose message the
model receives on PostToolUse; the source records that a sibling gate was missed by
the original conversion sweep and this hook is the correction.

The matcher discriminates, it does not panic. Four clauses decide a line: it must name
the Agent-tool channel, target a write Worker, carry no read-only context
(`read-only`, `reviewer`, `Phase -1`, `research subagent`), and no escape token. That
last clause is the honest way to let a kickoff *teach* the anti-pattern — a kickoff
section like this very family's guide can quote the bad line, and as long as the line
ends with `<!-- channel-discipline: allow <reason> -->`, the gate stays silent. Same
shape as the `ci-tool-pin: allow` convention.

A dependency miss never reads as a pass: no `jq`, no principle-29 shim, no `tsx` —
each gets a loud «This is a SKIP, not a pass» notice, the shim-miss one announced once
per session and pointing at the CI principle test as the backstop that still gates
every PR. The repo-wide opt-out is `AIF_WORKER_DISPATCH_CHANNEL=0`.

## Evidence

- `.claude/hooks/check-worker-dispatch-channel.sh:2` is the header the card's
  description row quotes: `# check-worker-dispatch-channel.sh — PostToolUse gate — edit-time channel for #worker-dispatch-via-subagent`.
  Line 10 carries `# @dual-pair: channel-discipline-worker-dispatch` and lines 11-16
  give the portability rationale; the pairing spec is named at line 17
  (`docs/meta-factory/research-patches/2026-06-27-meta-orch-channel-discipline-mechanism.md`).
- Registration: `.claude/settings.json:159` reads `"matcher": "Edit|Write|MultiEdit"`
  with the command at line 163; the plugin registry registers it too
  (`plugin/hooks/hooks.json:135`).
- Single shared matcher: lines 5-8 — «Both this hook and principle 29's CI test call
  that one matcher — never two divergent copies (anti-pattern `#two-prompts-drift`)».
  The matcher module is `packages/core/principles/29-worker-dispatch-channel.ts`:
  `CHANNEL_RE` at line 50 (`/Agent[ -]tool|via .*\bAgent\b/`), `WRITE_WORKER_RE` at
  line 53, the read-only exclusions at line 55, the
  `<!-- channel-discipline: allow` escape token at lines 61-66, and the four-clause
  `lineIsViolation` at lines 81-86.
- Scope: the bin shim (`packages/core/principles/29-worker-dispatch-channel.bin.ts:19-22`)
  filters to `.claude/orchestrator-prompts/<one-segment>/kickoff.md` and exits 0 on
  anything else; the hook narrows identically at lines 137-140.
- Exit-2 conversion: lines 174-181 — «Exit 2 is the only PostToolUse channel whose
  stderr reaches the MODEL; exit 1 reaches the operator transcript alone
  (live-verified both directions 2026-07-24) … that 2026-07-24 sweep covered four
  gates and missed this one (#1597 review ledger D-1)». The delegation itself is line
  165.
- Loud dependency skips: line 148 (missing principle-29 shim, once per session,
  «the harness-agnostic backstop is principle 29 in the framework CI») and line 158
  (missing tsx); the comment at lines 108-113 records the pre-fix silent `|| exit 0`.
- Opt-out: line 106, `[[ "${AIF_WORKER_DISPATCH_CHANNEL:-1}" == "0" ]] && exit 0`.
- Wiring honesty: the header (lines 19-30) carries the MAINTAINER WIRING block — the
  hook is wired by hand into settings, and «Until wired, the CI principle test is the
  active backstop (no enforcement gap — it gates every PR; the hook only moves the
  gate earlier, to edit-time)». In this repository it is wired:
  `.claude/settings.json:159-163`.
- Paired test: `packages/core/hooks/check-worker-dispatch-channel.test.ts` — its
  header (lines 1-16) states the contract: «❌ kickoff that instructs Agent-tool
  write-Worker dispatch -> exit 2», with the exit-2-not-1 rationale in the same lines.
