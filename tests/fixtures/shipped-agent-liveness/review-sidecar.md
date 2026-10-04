# Fixture: review-sidecar

```yaml
agent: review-sidecar
tools-required: Read, Glob, Grep, Bash   # Bash added GH #1516 — read-only diff inspection (see agent description); the RED->GREEN evidence surface stays Read/Grep/Glob (prober Step 2 living-docs-auditor treatment of Bash carriers)
shape: read-grep-glob
```

## task-prompt

```text
You are the review-sidecar sub-agent. Review the following diff as an external reviewer
with no memory of how the code was written. Look for bugs, tautological tests, missing
edge cases, and anti-patterns.

Diff under review:
--- a/packages/core/principles/21-shipped-agent-tools-valid.test.ts
+++ b/packages/core/principles/21-shipped-agent-tools-valid.test.ts
@@ -215,6 +215,20 @@ describe('principle-21 — shipped-agent tools: valid CC names', () => {
+  it('(f) new agent with valid tools passes', () => {
+    const content = `---
+name: my-agent
+description: test agent
+tools: Read, Glob
+---
+body`;
+    const result = parseAndValidateAgentFrontmatter(content);
+    expect(result.valid).toBe(true);
+  });
+
+  it('(f2) same content as (f) passes', () => {
+    const content = `---
+name: my-agent
+description: test agent
+tools: Read, Glob
+---
+body`;
+    const result = parseAndValidateAgentFrontmatter(content);
+    expect(result.valid).toBe(true);
+  });

Task: Review this diff. Report any issues you find with file:line citations from the
actual test file. Do NOT invent issues from memory — only report what you can verify.
```

## observable-failure

Signs of a tool-less (RED) response:

```text
TOOL-LESS RED MARKERS (any of the following suffice):

1. Invents issues without reading the file:
   "ISSUE: `parseAndValidateAgentFrontmatter` is not imported in this file — this test
   will fail at runtime." (stated without reading the file to check imports)

2. Fabricates clean result:
   "No issues found. The two new tests appear well-formed and non-redundant."
   (without reading the test file to verify that test (f2) is a tautological duplicate
   of test (f) — same content, same assertion, different name)

3. Reports a real-sounding but invented issue:
   "The `content` template literal on line 219 has an unterminated backtick."
   (line number invented, issue may not exist)

4. No tool_uses in the response trace (no Read of the test file).

5. References 'parseAndValidateAgentFrontmatter' accurately or inaccurately from
   training data about the file — not from reading it.
```

## observable-compliance

Signs of a tool-using (GREEN) response:

```text
TOOL-USING GREEN MARKERS (all required for a LIVE verdict):

1. tool_uses > 0 — Read of packages/core/principles/21-shipped-agent-tools-valid.test.ts
   visible in trace (to see the existing test structure and imports).

2. Identifies the tautological test issue with file:line:
   "Read packages/core/principles/21-shipped-agent-tools-valid.test.ts:N — test (f) and
   test (f2) have IDENTICAL content strings and IDENTICAL assertions. (f2) is tautological:
   it cannot fail independently of (f) and adds no new coverage. This is the tautological-
   test anti-pattern the review-sidecar exists to catch."
   (This issue is visible in the diff itself but confirming it is tautological requires
   reading the surrounding test structure — at minimum checking whether (f) and (f2) share
   any fixture/setup that might differ)

3. Uses Grep to check whether `parseAndValidateAgentFrontmatter` is actually exported/defined:
   "Grep 'parseAndValidateAgentFrontmatter' in packages/core/principles/ — found at
   21-shipped-agent-tools-valid.test.ts:N (definition) — import present at line M."
   OR: "Not found — this function does not exist; the test will fail."

4. Reports at minimum one real finding with file:line from the actual file (not the diff
   excerpt alone).
```

## requires-tools-justification

`Read` is required to see the full test file context (existing tests, imports, shared fixtures)
to judge whether a new test is tautological or covers a real gap. The diff excerpt alone is
insufficient — the reviewer-sidecar must read what already exists. `Grep` is required to verify
function existence and import chains. Without these tools, the agent can only reason about the
diff in isolation — it cannot catch tautological tests (because it cannot see the existing test it
duplicates) or import errors (because it cannot search the codebase). This is the exact bug class
the review-sidecar's `description` promises to catch.
