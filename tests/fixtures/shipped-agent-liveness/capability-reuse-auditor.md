# Fixture: capability-reuse-auditor

```yaml
agent: capability-reuse-auditor
tools-required: Read, Glob, Grep
shape: read-grep-glob
```

## task-prompt

```text
You are the capability-reuse-auditor sub-agent. A new capability was just authored: a skill
at .claude/skills/night-mode/SKILL.md that describes an executor + dual-reviewer loop, and its
introducing commit carries the trailer `Prior-art: #64 (ADAPT — layers over Superpowers
subagent-driven-development)`.

Determine, for THIS repo:
1. Does an existing own-stack capability (an installed skill/agent, or an SSOT entry in
   docs/meta-factory/prior-art-evaluations.md) already own the "executor + dual-reviewer loop"
   capability the new skill describes?
2. Does the SSOT entry cited by the trailer (#64) actually correspond to that capability?
3. Does the new skill's BODY reuse/subordinate to that prior art (thin adapter), or does it
   RE-DESCRIBE the loop (reinvention with a correct-sounding trailer)?

Report a verdict (REUSE-OK | REINVENTION | TRAILER-MISMATCH) with citations for each claim.
```

## observable-failure

Signs of a tool-less (RED) response — a subagent without Read/Grep:

```text
TOOL-LESS RED MARKERS (any of the following suffice):

1. Rules on overlap without grepping the SSOT:
   "SSOT #64 is Superpowers subagent-driven-development (ADOPT); the trailer is consistent —
   verdict REUSE-OK."
   (stated without a Grep of prior-art-evaluations.md to confirm what #64 actually is — the
   entry ID may map to a different capability entirely.)

2. Judges the body as reuse-vs-reinvent without reading it:
   "The night-mode skill layers over the loop rather than re-describing it — REUSE-OK."
   (asserted without a Read of .claude/skills/night-mode/SKILL.md to see whether the body
   actually re-describes the executor + dual-reviewer loop.)

3. Fabricates an SSOT entry number/content from training data:
   "#64 is the mutation-testing entry." — a plausible-but-unverified claim; the real #64
   is only knowable by Grep/Read of the SSOT file.

4. No tool_uses in the response trace (the definitive mechanical signal).

5. Explicit decline: "I cannot verify overlap without searching the repo." — also RED (correct
   decline, but no overlap verdict was produced).
```

## observable-compliance

Signs of a tool-using (GREEN) response:

```text
TOOL-USING GREEN MARKERS (all three required for a LIVE verdict):

1. tool_uses > 0 — at minimum one Grep of docs/meta-factory/prior-art-evaluations.md AND one
   Read of the new capability's body visible in the response trace.

2. Cites actual repo content only a tool could surface:
   "Grep prior-art-evaluations.md for '#64' — entry #64 is <the real capability at line N>."
   "Read .claude/skills/night-mode/SKILL.md — the body <quotes the re-described loop at line M>
   OR <subordinates to the owner via a NOT-authoritative-for pointer at line M>."
   (The exact verdict depends on the real files; the point is the agent GREP'd + READ them
   rather than asserting from priors.)

3. The reuse-vs-reinvent verdict is tied to a quoted body line and a quoted SSOT line — the
   trailer↔body consistency judgment is backed by both citations, not by the trailer alone.
```

## requires-tools-justification

`Grep` is required to search `docs/meta-factory/prior-art-evaluations.md` and the existing
`.claude/skills/` + `agents/` for the capability-area the new artifact claims — a Grep hit (or
miss) on the SSOT ID is the substantive check the trailer's presence cannot provide. `Read` is
required to open both the cited SSOT entry AND the new capability's body to judge whether the
body reuses or merely re-describes the prior art (the `#consult-as-trailer-not-input` failure
this agent exists to catch — a correct-sounding trailer over a re-describing body). Without
tools the agent can only accept the trailer at face value or fabricate an overlap verdict.
