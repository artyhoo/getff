---
title: inject-subagent-digest hook
description: Every sub-agent you dispatch starts with the project's non-negotiables already in its context — injected at spawn, with zero boilerplate in your dispatch.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/hooks/inject-matching-rule.sh
  - .claude/hooks/inject-session-bootstrap.sh
  - .claude/hooks/inject-subagent-context.sh
  - .claude/settings.json
  - .claude/rules/zcode-parity-doctrine.md
  - docs/site/reference/D/inject-session-bootstrap.md
  - docs/site/reference/D/inject-subagent-context.md
  - docs/site/reference/D.json
  - docs/site/reference/D.md
  - docs/site/terms.md
  - packages/core/hooks/inject-subagent-digest.test.ts
executed:
  - { example: subagent-digest-at-spawn, stack: repo, date: 2026-09-25, result: printed }
docs-refresh: deferred — re-verified 2026-09-25, page authored from the cited sources at this pin; clears at the next refresh of this page
---

# inject-subagent-digest hook

## Fact card

What each row means: [how to read a fact card](../D.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the card quotes the hook's own header line and registration JSON verbatim -->

<!-- getff:begin section=D-card-inject-subagent-digest plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `inject-subagent-digest` |
| kind | hook |
| ships-to | not installed on any lane (no-lane) |
| description | SubagentStart hook — injects the session-bootstrap digest into juniors at spawn |
| source | `.claude/hooks/inject-subagent-digest.sh:2` |
| event | `["SubagentStart"]` |
| matcher | `[]` |
| delivery | `["@cc-only-rationale"]` |
<!-- getff:end section=D-card-inject-subagent-digest -->

<!-- vale on -->

## Explanation

A sub-agent is born knowing nothing. The main session may carry the project's goal and
invariants, but a freshly dispatched junior starts from a blank page — and the obvious
fix, pasting the anchor into every dispatch, is boilerplate that decays. This hook ends
that: at the instant a sub-agent is spawned, it injects the session-bootstrap digest
into that sub-agent's context. Twenty-nine lines of shell; the dispatcher does nothing,
and every junior arrives briefed.

It is a small hook because it refuses to have its own opinion about the text. The
digest is not rewritten here — the hook literally calls the prompt-side injector and
carries whatever that produced:

```bash
printf '%s' '{"session_id":"docs-demo-sd-1"}' \
  | bash .claude/hooks/inject-subagent-digest.sh
```

```text
[session-bootstrap digest — auto-injected at prompt submit]
Goal: AI agents can't silently bypass undocumented conventions. Every rule is an executable artifact that fails at the earliest reachable channel — edit-time → pre-commit → pre-push → CI → production audit. CI = last-resort gate. (README.md#why-this-exists)
Invariants: (1) build-vs-reuse SSOT consult before capability commit + build-first-reuse-default discipline (.claude/rules/build-first-reuse-default.md); (2) recursive self-application green (make self-audit); (3) search-coverage 6-item checklist on negative-existence claims; (4) multi-channel enforcement — every rule fails at earliest reachable channel (CI = last resort).
Step-0 reading order: README.md → .claude/session-bootstrap.md → CLAUDE.md → task-specific docs.
Recommendation discipline (H1): before issuing a verdict/recommendation (ADOPT/BUILD/REJECT/DEFER, «we should X», «use Y», «pick A over B») — (1) cite SSOT/prior-art by ID, (2) give file:line or command-output evidence, (3) state what would falsify it («wrong if …»), (4) for «nothing exists» claims run the 6-item search check. An unbacked verdict is provisional, not load-bearing. This is a reminder, not a gate. (see also .claude/rules/recommendation-laziness-discipline.md + T-trap in ai-laziness-traps.md §2) (.claude/rules/phase-research-coverage.md §1.7)
Full bootstrap + reviewer drift-prevention flowchart: .claude/session-bootstrap.md
[/session-bootstrap digest]
```

That is the text the sub-agent receives — the same digest that arrives in the main
session on every prompt, delivered by
[inject-session-bootstrap](inject-session-bootstrap.md) and shown in full on that page.
One logic, two channels, one source of truth: change the digest in one place and both
audiences move together.

The JSON wrapping is load-bearing, and the header says why in plain terms: at
sub-agent start, plain output is a **silent no-op** — the harness discards it and the
hook fires without delivering anything. A hook that printed its digest unwrapped would
look busy and do nothing; the wrap is what makes the delivery real. The hook also
exits quietly when the digest comes back empty, rather than injecting an empty envelope.

This hook is Claude-Code-only, and that is a statement about harness events, not
preference: the SubagentStart event does not exist on the framework's second harness.
There the role is played by [inject-subagent-context](inject-subagent-context.md), the
pre-dispatch fallback. The two deliver different text on purpose — the CC anchor
delivers this framework digest, the fallback delivers the project digest block — and
that asymmetry is recorded as an accepted, live-verified divergence in the framework's
parity doctrine rather than smoothed over.

## Evidence

- `.claude/hooks/inject-subagent-digest.sh:2` is the header the card's description row
  quotes: `# inject-subagent-digest.sh — SubagentStart hook — injects the session-bootstrap digest into juniors at spawn`.
- The goal and its origin: lines 4-5 — «every dispatched subagent gets the project
  anchor (goal + invariants + H1 recommendation discipline) at spawn with zero
  per-prompt boilerplate. SSOT #108».
- The reuse that prevents drift: line 8 — `# spec: reuses
  .claude/hooks/inject-session-bootstrap.sh as the single digest source (no
  #two-prompts-drift)`; line 23 does it:
  `DIGEST="$(bash "$HOOK_DIR/inject-session-bootstrap.sh" 2>/dev/null || true)"`.
- The silent-no-op warning is header lines 10-15: «SubagentStart is NON-blocking … and
  delivers context via JSON hookSpecificOutput.additionalContext. Plain stdout is a
  SILENT NO-OP here … emitting the wrong format = the hook fires but does nothing»,
  with the mirroring of `inject-matching-rule.sh:125-126` named at line 15.
- jq guard: line 19 — `command -v jq >/dev/null 2>&1 || exit 0   # graceful no-op
  without jq`. Empty digest: line 24 — `[[ -z "$DIGEST" ]] && exit 0`.
- The output: lines 26-27 wrap the digest in
  `{hookSpecificOutput:{hookEventName:"SubagentStart",additionalContext:$ctx}}`.
- Registration: `.claude/settings.json:198` opens the SubagentStart block with the
  command at line 203.
- No plugin twin: the card's delivery row carries only the CC-only marker, and
  `ls plugin/hooks | grep inject-subagent-digest` finds nothing — the SubagentStart
  event is inexpressible on the framework's second harness
  (`.claude/rules/zcode-parity-doctrine.md` §2 row 16 records the classification and
  §4 its rationale, naming row 15's fallback as the replacement).
- The delivery-shape divergence (this hook's inline digest vs the fallback's digest
  block) is recorded in the same doctrine table under «Digest-anchor delivery asymmetry
  — ACCEPTED DIVERGENCE», both arms live-verified.
- Paired test: `packages/core/hooks/inject-subagent-digest.test.ts` — its header
  (lines 1-11) asserts «the injected additionalContext carries the session-bootstrap
  digest verbatim (single source of truth: reuses inject-session-bootstrap.sh — no
  #two-prompts-drift)».
