---
title: inject-project-digest hook
description: Your project's own one-screen anchor — what this repo is, how it is laid out, which rules are hard — delivered to the main session and to every sub-agent, from one file you edit.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/hooks/inject-project-digest.sh
  - .claude/hooks/inject-session-bootstrap.sh
  - .claude/hooks/inject-subagent-context.sh
  - .claude/hooks/inject-subagent-digest.sh
  - .claude/session-bootstrap.md
  - .claude/settings.json
  - docs/site/reference/D.json
  - docs/site/reference/D.md
  - docs/site/terms.md
  - plugin/hooks/hooks.json
  - packages/core/hooks/inject-project-digest.test.ts
executed:
  - { example: project-digest-on-prompt-submit, stack: repo, date: 2026-09-25, result: printed }
  - { example: project-digest-on-subagent-start, stack: repo, date: 2026-09-25, result: printed }
docs-refresh: deferred — re-verified 2026-09-25, page authored from the cited sources at this pin; clears at the next refresh of this page
---

# inject-project-digest hook

## Fact card

What each row means: [how to read a fact card](../D.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the card quotes the hook's own header line and registration JSON verbatim -->

<!-- getff:begin section=D-card-inject-project-digest plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `inject-project-digest` |
| kind | hook |
| ships-to | framework: react-native, react-next, react-spa, ts-server |
| description | UserPromptSubmit + SubagentStart hook — injects the project digest at both fire-points |
| source | `.claude/hooks/inject-project-digest.sh:2` |
| event | `["SubagentStart","UserPromptSubmit"]` |
| matcher | `[]` |
| delivery | `["@cc-only-rationale","plugin"]` |
<!-- getff:end section=D-card-inject-project-digest -->

<!-- vale on -->

## Explanation

Every session starts ignorant. The usual fix is a README nobody re-reads and a system
prompt nobody owns. This hook offers a third shape: you keep one block — the digest — in
your project's `.claude/session-bootstrap.md`, between two marker lines, and this hook
delivers exactly that block as context at the two moments attention is cheapest: when
you submit a prompt, and when a sub-agent is spawned. One file, one edit, both
audiences.

The digest is yours to write. In the getff repository it is three lines — what the
project is, how the repository maps together, and which pointers are hard commitments.
Here is the hook delivering it on a prompt submit, verbatim:

```bash
printf '%s' '{"prompt":"hi","session_id":"docs-demo-pd-1"}' \
  | bash .claude/hooks/inject-project-digest.sh
```

```text
Project: rules-as-tests-aif — a framework repo that is self-hosting (it enforces its own rules on itself). Goal SSOT: README.md#why-this-exists — never redefine the goal here or in task docs.
Repo map: README.md (goal) → .claude/session-bootstrap.md (this anchor, reading order) → CLAUDE.md (AI-tooling conventions) → .claude/rules/*.md (discipline rules; index: 00-rule-index.md) → docs/meta-factory/prior-art-evaluations.md (build-vs-reuse SSOT) + EXECUTION-PLAN.md → packages/core/ (enforcement machinery: principles meta-tests, synthesizer) → docs/meta-factory/research-patches/ (dated evidence records).
Hard pointers: keep `make self-audit` green (recursive self-application); every capability commit carries a build-vs-reuse verdict (`Prior-art:` trailer); hooks SSOT is `.claude/hooks/*.sh` — ZCode consumes rendered plugin twins, edit the source, never the twin; new research patches require a §1.7 self-review section; staging PRs carry `## Fidelity verdict` + §1.7 Forward/Backward-check sections; agent must not edit `.claude/settings.json`.
```

That is the whole delivery — your block, nothing added. The same block reaches a
sub-agent, wrapped the way a sub-agent requires:

```bash
printf '%s' '{"hook_event_name":"SubagentStart","session_id":"docs-demo-pd-2"}' \
  | bash .claude/hooks/inject-project-digest.sh
```

```json
{
  "hookSpecificOutput": {
    "hookEventName": "SubagentStart",
    "additionalContext": "Project: rules-as-tests-aif — a framework repo that is self-hosting …"
  }
}
```

One hook, two events, two output shapes — that asymmetry belongs to the harness, not to
you: on prompt submit, plain output is injected automatically; at sub-agent start,
context must arrive wrapped as JSON. The hook detects which event fired and answers in
the right shape. Without the JSON tool installed it cannot wrap, so it simply answers in
the plain shape — the case that still works.

Zero-setup is a design goal, and it cuts both ways. No bootstrap file, or an empty
digest block, and the hook is silent — nothing injected, no error, no nag. If you see
nothing, the block between the two markers is where to look.

This is the consumer twin of two framework-internal hooks: the framework's own
repository injects a fixed, framework-shaped digest on prompt submit
(`inject-session-bootstrap`) and a fixed digest to sub-agents (`inject-subagent-digest`);
this hook injects whatever YOUR project wrote, at both fire-points. On a harness without
a sub-agent-start event, the second fire-point is covered by the fallback hook
`inject-subagent-context`, which mirrors this hook's block extraction exactly.

## Evidence

- `.claude/hooks/inject-project-digest.sh:2` is the header the card's description row
  quotes: `# inject-project-digest.sh — UserPromptSubmit + SubagentStart hook — injects the project digest at both fire-points`.
- The one-source design is header lines 15-16: «The shared digest source is the block
  between the markers in .claude/session-bootstrap.md, so the main session AND every
  dispatched subagent get the same project anchor from ONE source of truth».
- Zero-setup exits: line 31 — `[ -f "$DIGEST_FILE" ] || exit 0   # no anchor authored —
  nothing to inject (zero-setup default)`; line 39 — the whitespace-only block check
  `[ -z "$(printf '%s' "$BLOCK" | tr -d '[:space:]')" ] && exit 0`.
- The block extraction is the awk at line 37, matching
  `<!-- digest:start -->` and `<!-- digest:end -->` on their own lines; the demo output
  above is that block read from `.claude/session-bootstrap.md` verbatim.
- Event detection: lines 43-45 read `.hook_event_name` from the payload with jq; line 47
  `if [ "$EVENT" = "SubagentStart" ]` selects the arm.
- The two shapes: line 50 emits
  `{hookSpecificOutput:{hookEventName:"SubagentStart",additionalContext:$ctx}}`; line 53
  `printf '%s\n' "$BLOCK"` is the plain arm, reached also when jq is absent (comment at
  line 52: «UserPromptSubmit (or jq-absent fallback): plain stdout is auto-injected»).
- The env-first root resolution at line 29,
  `REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)"}`, exists for
  the plugin twin: the header block (lines 20-28) explains the subshell/$0 bug it fixed,
  matching the pattern of `inject-session-bootstrap.sh` (issue 1484).
- Registration is plugin-channel only: `plugin/hooks/hooks.json:8` registers the
  UserPromptSubmit arm and `plugin/hooks/hooks.json:195` the SubagentStart arm; the
  project `.claude/settings.json` registers neither (measured:
  `grep -c inject-project-digest .claude/settings.json` prints `0`).
- Family relationships are stated in the hook's own header, lines 5-7: «the
  PROJECT-AGNOSTIC adaptation of the maintainer-only inject-session-bootstrap.sh /
  inject-subagent-digest.sh pair (which hard-code the FRAMEWORK's own goal/invariants
  digest — wrong to inject into a consumer's project)». The mirroring fallback is
  declared in `.claude/hooks/inject-subagent-context.sh:23-26`.
- Paired test: `packages/core/hooks/inject-project-digest.test.ts` (381 lines) — its
  header (lines 1-8) names «the dual-event consumer hook» and its zero-setup contract:
  «empty/absent block -> injects nothing», with both output shapes asserted.
