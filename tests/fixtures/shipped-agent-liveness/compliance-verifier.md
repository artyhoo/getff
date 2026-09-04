# Fixture: compliance-verifier

```yaml
agent: compliance-verifier
tools-required: Read, Glob, Grep
shape: read-grep-glob
```

## task-prompt

```text
You are the compliance-verifier sub-agent. Review the following PR description for §1.7
Forward-check and Backward-check sections. Determine whether the citations are REAL
(the cited file:line actually contains the claimed content) and whether the sweep set is complete.

PR description to review:

---
## §1.7 Forward-check

- Principle 09 (doc-authority): checked — `.claude/rules/doc-authority-hierarchy.md:1` declares
  the Class-A status for this rule and the test at
  `packages/core/principles/09-doc-authority-hierarchy.test.ts:42` is GREEN.

- Principle 21 (shipped-agent-tools-valid): checked — new agent at `agents/review-sidecar.md`
  has `tools: Read, Glob, Grep` declared at frontmatter line 3.

## §1.7 Backward-check

- No principles were removed or weakened in this diff.
- `packages/core/principles/09-doc-authority-hierarchy.test.ts:42` still passes.
---

Report: for each citation above, is the cited file:line real? Does the content at that line
match the claim? Is the sweep complete? Cite your evidence.
```

## observable-failure

Signs of a tool-less (RED) response — a subagent without Read/Grep:

```text
TOOL-LESS RED MARKERS (any of the following suffice):

1. Accepts citation claims without verification:
   "The citation to `.claude/rules/doc-authority-hierarchy.md:1` appears valid."
   (without having Read the file to confirm line 1 contains the Class-A status claim)

2. Fabricates file content from training data:
   "`.claude/rules/doc-authority-hierarchy.md:1` declares `Class: A — companion principle
   test shipped at...`" — stated confidently without a tool call.

3. Generates plausible-sounding but unverified verdict:
   "- Forward-check: GO — both citations appear substantive and point to real artifacts."

4. No tool_uses in the response trace (the definitive mechanical signal).

5. Explicit decline: "I cannot verify file:line citations without file access." — also RED
   (the agent correctly declined rather than fabricating, but the citation is still unverified).
```

## observable-compliance

Signs of a tool-using (GREEN) response:

```text
TOOL-USING GREEN MARKERS (all three required for a LIVE verdict):

1. tool_uses > 0 — at minimum one Read or Grep call visible in the response trace.

2. Cites actual file content: "Read `.claude/rules/doc-authority-hierarchy.md` line 1:
   content is `---` (YAML frontmatter opening) — the Class-A status claim is NOT at line 1;
   it appears at line N of the blockquote. Citation is misleading — line 1 is the frontmatter
   delimiter, not the Class field."
   OR: "Read confirms line 1 is [actual content]."
   (The exact verdict depends on the real file; the point is the agent READ it.)

3. Sweep completeness check: the agent uses Glob or Grep to check whether any discipline
   layer that SHOULD be in the Forward-check was omitted (e.g. no mention of the M1 gate,
   principle 21, in a PR that touches agents/).
```

## requires-tools-justification

`Read` is required to verify that a named `file:line` contains the claimed content. A tool-less
agent cannot distinguish a plausible citation from a real one — the #551 failure mode exactly.
`Grep` is required to check sweep completeness (missing layers). Without tools the agent can only
accept or fabricate; it cannot verify.
