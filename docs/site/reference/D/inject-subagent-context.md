---
title: inject-subagent-context hook
description: When your harness has no sub-agent-start event, this hook catches the dispatch itself and appends your project's anchor to the sub-agent's prompt — so juniors get their bearings even where the graceful event does not exist.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/hooks/inject-project-digest.sh
  - .claude/hooks/inject-subagent-context.sh
  - .claude/hooks/inject-subagent-digest.sh
  - .claude/settings.json
  - docs/site/reference/D.json
  - docs/site/reference/D.md
  - docs/site/terms.md
  - plugin/hooks/hooks.json
  - packages/core/hooks/inject-subagent-context.test.ts
  - .claude/rules/zcode-parity-doctrine.md
  - docs/site/reference/D/inject-project-digest.md
  - docs/site/reference/D/inject-subagent-digest.md
executed:
  - { example: subagent-context-on-claude-code, stack: repo, date: 2026-09-25, result: silent }
  - { example: subagent-context-on-a-harness-without-subagent-start, stack: repo, date: 2026-09-25, result: printed }
docs-refresh: deferred — re-verified 2026-09-25, page authored from the cited sources at this pin; clears at the next refresh of this page
---

# inject-subagent-context hook

## Fact card

What each row means: [how to read a fact card](../D.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the card quotes the hook's own header line and registration JSON verbatim -->

<!-- getff:begin section=D-card-inject-subagent-context plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `inject-subagent-context` |
| kind | hook |
| ships-to | not installed on any lane (no-lane) |
| description | SubagentStart fallback — digest injection for harnesses without the SubagentStart event (zcode) |
| source | `.claude/hooks/inject-subagent-context.sh:2` |
| event | `["PreToolUse"]` |
| matcher | `["Agent|Task"]` |
| delivery | `["@cc-only-rationale","plugin"]` |
<!-- getff:end section=D-card-inject-subagent-context -->

<!-- vale on -->

## Explanation

The family's cleanest way to brief a sub-agent is the SubagentStart event
([inject-subagent-digest](inject-subagent-digest.md) does exactly that). Not every
harness has that event. This hook is the fallback for the ones that do not: instead of
a lifecycle event, it watches for the moment a sub-agent is about to be dispatched —
the pre-tool-use moment of the dispatch call itself — and rewrites the sub-agent's
prompt to carry your project's anchor at the end.

On Claude Code, which has the real event, the hook deliberately says nothing. Here it
is running on Claude Code — and doing nothing is the correct behaviour:

```bash
printf '%s' '{"tool_name":"Task","session_id":"docs-demo-sc-1",
  "tool_input":{"prompt":"do the thing","subagent_type":"Explore"}}' \
  | bash .claude/hooks/inject-subagent-context.sh
```

```text
(nothing — exit 0)
```

The gate is an environment check, not a product sniff: the hook speaks only when the
harness has set its own project-directory variable and there is no SubagentStart event
to do the job. Set that variable and the same dispatch produces a rewritten prompt. Here
is the sub-agent's resulting prompt, printed in full:

```bash
printf '%s' '{"tool_name":"Task","session_id":"docs-demo-sc-2",
  "tool_input":{"prompt":"do the thing","subagent_type":"Explore"}}' \
  | ZCODE_PROJECT_DIR="$PWD" bash .claude/hooks/inject-subagent-context.sh \
  | jq -r '.hookSpecificOutput.updatedInput.prompt'
```

```text
do the thing

---
[subagent context anchor]
Project: rules-as-tests-aif — a framework repo that is self-hosting (it enforces its own rules on itself). Goal SSOT: README.md#why-this-exists — never redefine the goal here or in task docs.
Repo map: README.md (goal) → .claude/session-bootstrap.md (this anchor, reading order) → CLAUDE.md (AI-tooling conventions) → .claude/rules/*.md (discipline rules; index: 00-rule-index.md) → docs/meta-factory/prior-art-evaluations.md (build-vs-reuse SSOT) + EXECUTION-PLAN.md → packages/core/ (enforcement machinery: principles meta-tests, synthesizer) → docs/meta-factory/research-patches/ (dated evidence records).
Hard pointers: keep `make self-audit` green (recursive self-application); every capability commit carries a build-vs-reuse verdict (`Prior-art:` trailer); hooks SSOT is `.claude/hooks/*.sh` — ZCode consumes rendered plugin twins, edit the source, never the twin; new research patches require a §1.7 self-review section; staging PRs carry `## Fidelity verdict` + §1.7 Forward/Backward-check sections; agent must not edit `.claude/settings.json`.
```

The anchor block is the same digest block [inject-project-digest](inject-project-digest.md)
reads — the hook's header calls this payload parity, not just role parity: same source
file, same marker extraction, same stay-silent-on-empty rule.

Two care points the hook takes that are worth knowing:

- **It returns the dispatch untouched except for the prompt.** The rewritten dispatch
  carries every original field — the sub-agent type, the description, the rest — because
  the harness re-validates the rewritten input and silently reverts to the original if a
  required field is missing. Only the prompt gains the anchor block.
- **It refuses to act on a malformed dispatch.** If the prompt field is missing or not a
  string, the hook exits silently rather than let the rewrite throw — the outcome is the
  same as the harness reverting, without the noise.

One degradation is declared rather than hidden: on such a harness the anchor is
one-shot — it arrives as the first part of the sub-agent's prompt, not as persistent
context across the sub-agent's whole life. The header calls this «the best-available
mechanism» and says so in exactly those words. The harness difference is settled
doctrine in this framework: the CC anchor delivers the framework digest inline, this one
delivers the project block — an accepted divergence, both arms verified live end-to-end.

## Evidence

- `.claude/hooks/inject-subagent-context.sh:2` is the header the card's description row
  quotes: `# inject-subagent-context.sh — SubagentStart fallback — digest injection for harnesses without the SubagentStart event (zcode)`.
- Registration: `.claude/settings.json:94` reads `"matcher": "Agent|Task"` with the
  command at line 98; the plugin registry registers it at `plugin/hooks/hooks.json:52`.
- The CC-silence gate: line 33 defines `_is_zcode() { [ -n "${ZCODE_PROJECT_DIR:-}" ]; }`
  and line 34 is `_is_zcode || exit 0   # CC: the SubagentStart primary handles digest
  injection; stay silent here`.
- Guards, in order: line 35 `command -v jq >/dev/null 2>&1 || exit 0`; line 41
  `case "$TOOL_NAME" in Agent | Task) ;; *) exit 0 ;; esac` (comment lines 39-40: the
  matcher already restricts this, but «never act on another tool if the matcher is ever
  broadened»).
- Env-first root, lines 43-45, with the comment naming the plugin-twin breakage it
  avoids: «`$0`-relative breaks when invoked as a plugin twin». Mirrors
  `inject-project-digest.sh:29`.
- Payload parity is declared at lines 23-26: «mirrors the SubagentStart arm of
  .claude/hooks/inject-project-digest.sh — same digest source … same awk pipeline, same
  no-op-on-empty semantics».
- The type guard is lines 72-73:
  `PROMPT_TYPE="$(printf '%s' "$INPUT" | jq -r '.tool_input.prompt | type' …)"` then
  `[[ "$PROMPT_TYPE" == "string" ]] || exit 0`; the comment above (lines 67-71) explains
  that jq's `+` would otherwise throw and the digest would be silently undelivered.
- The rewrite is lines 74-76 — `updatedInput:(.tool_input | .prompt = (.prompt +
  "\n\n---\n[subagent context anchor]\n" + $d))` — and the comment at lines 62-65
  explains why the FULL tool_input is echoed back («the host re-validates updatedInput …
  and silently reverts to the original if a required field … is missing»).
- The declared degradation is header lines 17-21: «on zcode the digest is one-shot — it
  becomes the subagent's FIRST user message via updatedInput.prompt, not a
  persistent-lifecycle context as on CC».
- The harness split is doctrine: `.claude/rules/zcode-parity-doctrine.md` §2 row 15
  records this hook as live-verified end-to-end (2026-09-10) and notes the digest source
  follows the session's working tree; the accepted CC-vs-fallback delivery divergence
  (inline digest vs digest block) is recorded in the same table under «Digest-anchor
  delivery asymmetry — ACCEPTED DIVERGENCE».
- The twin is hand-maintained: line 32 reads `# @plugin-transform: manual — plugin twin
  carries a 4-line TWIN DIVERGENCE comment block + extensionless sibling call`.
- Paired test: `packages/core/hooks/inject-subagent-context.test.ts` — its header
  (lines 1-9) states the architecture («PRIMARY: SubagentStart … BACKUP (this hook):
  PreToolUse:Agent + updatedInput») and asserts the CC-silent and zcode-active cases.
