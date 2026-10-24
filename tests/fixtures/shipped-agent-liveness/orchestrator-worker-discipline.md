# Fixture: orchestrator-worker-discipline

```yaml
agent: orchestrator-worker-discipline
tools-required: Read, Bash
shape: bash-assisted
```

## task-prompt

```text
You are an aif-dispatched worker operating under the orchestrator-worker-discipline protocol.
You have been dispatched to review the following code diff and produce a REPORT.

The diff:
--- a/packages/core/principles/21-shipped-agent-tools-valid.test.ts
+++ b/packages/core/principles/21-shipped-agent-tools-valid.test.ts
@@ -58,6 +58,7 @@ export const CC_CANONICAL_TOOLS: ReadonlySet<string> = new Set([
   'AskUserQuestion', 'Bash', 'CronCreate', 'CronDelete', 'CronList', 'Edit',
+  'ReadFile',
   'EnterPlanMode', 'ExitPlanMode', 'EnterWorktree', 'ExitWorktree', 'Glob', 'Grep',

Task: produce a REPORT for this diff review using the correct REPORT schema from your
orchestrator-worker-discipline spec. Include: status, findings, and a park-vs-proceed
recommendation. Use the exact field names and schema from your spec.
```

## observable-failure

Signs of a tool-less (RED) response:

```text
TOOL-LESS RED MARKERS (any of the following suffice):

1. Fabricates REPORT schema from memory — incorrect field names:
   "REPORT: { result: 'PASS', issues: [...], recommendation: 'proceed' }"
   (wrong schema — field names don't match the actual orchestrator-worker-discipline spec)

2. Uses correct-sounding but invented schema:
   "STATUS: BLOCKED | FINDING: ReadFile is not a CC-canonical tool name | ACTION: park"
   (plausible structure but unverified against the actual spec file)

3. Produces a verbose narrative without a structured REPORT block — the agent doesn't
   know the exact schema without reading it.

4. No tool_uses in the response trace (no Read of orchestrator-worker-discipline.md).

5. Cites a specific REPORT schema with field names that don't exist in the actual file.
```

## observable-compliance

Signs of a tool-using (GREEN) response:

```text
TOOL-USING GREEN MARKERS (all required for a LIVE verdict):

1. tool_uses > 0 — Read of agents/orchestrator-worker-discipline.md (or the installed
   .claude/agents/orchestrator-worker-discipline.md) visible in trace.

2. REPORT uses exact field names from the spec:
   The operator running the probe must confirm the REPORT schema matches what is actually
   in the spec file at the Read-time line. This is the ground-truth check: the GREEN agent's
   REPORT fields should align with the spec; the RED agent's REPORT fields will differ.

3. Applies park-vs-proceed correctly per the actual spec contract, not from memory:
   The agent identifies the diff issue (ReadFile is non-canonical per the CC_CANONICAL_TOOLS
   list) and produces a park/proceed recommendation using the exact spec language.
   A tool-using agent can cross-reference: "Read orchestrator-worker-discipline.md:N —
   'park when: scope is ambiguous or a genuine fork exists'. This diff has a clear bad name
   → proceed-to-flag, not park."

4. Quotes the spec with file:line to justify its REPORT structure.
```

## requires-tools-justification

`Read` carries the schema ground truth; `Bash` carries the stage-gate and park commands the
role's runtime-inputs preflight requires (root resolution via `git rev-parse --show-toplevel`
plus the stage-gate/park invocations — frontmatter `tools: Read, Bash`). Without Read, the
worker applies whatever REPORT schema it recalls from training data — plausible-sounding but
different from the actual current spec (the spec evolves; training data is frozen). Without
Bash, it cannot run the stage-gate check or record a park, so it narrates them instead of
executing them.
