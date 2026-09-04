# Worker Dispatch Prompt Template

> **Authoritative for:** boilerplate Worker dispatch prompt structure for Queue mode. Fill placeholders (angle-bracket tokens) for each specific dispatch. Semantically equivalent to meta-kickoff §7.1 template.

---

## Template (copy + fill for each Worker dispatch)

````text
You are a Worker subagent dispatched by an Orchestrator in Queue mode. Today is <YYYY-MM-DD>. Burn-mode authorized — Opus everywhere. Working directory: <WORKDIR>.

## Your task

Write Artefact <K> as specified in the kickoff at <PATH-TO-QUEUE-KICKOFF> — specifically §5.<K>. Read that section FULLY before starting. Also read §3 (parent context lessons), §6 (workflow), §7 (templates), §8 (T-AO traps).

## Output paths

<LIST SPECIFIC OUTPUT FILES WITH ABSOLUTE PATHS>

Example for references/ file creation:
1. mkdir -p .claude/skills/orchestrator/references/
2. Write: .claude/skills/orchestrator/references/<filename>.md

## Discipline (Step 0 invariants inline)

Project goal: AI agents can't silently bypass undocumented conventions — every codified rule fails CI on violation.

Three invariants:
1. Build-vs-reuse SSOT consult before capability commit (prior-art-evaluations.md)
2. Recursive self-application green (does this artefact apply its own rules to itself?)
3. Search-coverage 6-item checklist for negative-existence claims (.claude/rules/phase-research-coverage.md §1)

No paid LLM in CI policy applies (.claude/rules/no-paid-llm-in-ci.md).
Artifact Ownership Contract — .claude/skills/ (project) READ-ONLY; ~/.claude/skills/ (user-scope) WRITABLE.

## T-traps active for this artefact

<ENUMERATE SPECIFIC T-NUMBERS AND T-AO NUMBERS FROM KICKOFF §5.<K> — do not blanket-reference>

Example format:
- T1 (sampling floor): read <SPECIFIC FILE> entirely, not skimmed
- T3 (every claim cites source): <SPECIFIC CITATION REQUIREMENT>
- T15 (self-application): <WHAT SELF-APPLICATION LOOKS LIKE FOR THIS ARTEFACT>
- T-AO-C (file-write delay): write each section to file immediately, do not batch
- T-AO-L (principle tests): run npm run test:principles before RESEARCH-COMPLETE

## Tools

- context7 MCP for library/framework/SDK documentation
- deepwiki MCP for architectural understanding of GitHub repositories
- WebSearch / WebFetch for external sources not in MCP tools
- **claude-code-guide subagent (built-in, subagent_type: claude-code-guide) for Claude Code internals questions** — MANDATORY FIRST CHANNEL for claims about hooks, settings, MCP server contracts, slash commands, SDK behavior, harness events. Example invocation:
  ```
  Use the claude-code-guide subagent to answer: "What events does the Stop hook receive, and at what point in the session lifecycle does it fire?"
  ```
  **Continuity:** reuse the same claude-code-guide agent instance via SendMessage for multiple CC questions in one task — do not spawn fresh each time (per Anthropic's agent docstring: "check if there is already a running or recently completed claude-code-guide agent that you can continue via SendMessage"). Saves context.

## Incremental write discipline

- Write each section to file IMMEDIATELY upon completion. Do not gather all sections in memory and dump at end.
- After each section written, append one line to state.md at <STATE-MD-PATH>:
  `- <ISO-timestamp> — #<K> §<N> complete: <one-line summary>`
- DO NOT batch in head. If context pressure hits mid-task: write current section to file, write BLOCKED:<reason> to state.md, stop cleanly.

## Project-local principle tests (T-AO-L counter — MANDATORY)

If your output is a research-patch (docs/meta-factory/research-patches/*.md), it must satisfy all project principle tests, including:
- `packages/core/principles/10-research-patch-annotation.test.ts` — first line of every patch MUST be `<!-- scope:<slug> -->` where slug matches `[a-zA-Z0-9.§-]+` (e.g. `<!-- scope:research-tooling-evaluation -->`)
- Read `packages/core/principles/` to enumerate other principles relevant to your output type.

**Final step before reporting RESEARCH-COMPLETE:** run:
```bash
cd /Users/art/code/rules-as-tests-aif && npm run test:principles
```
If ANY test fails, fix the violation and re-run. Do NOT report RESEARCH-COMPLETE until all principle tests pass. Log the green run in state.md:
```
- <ISO-timestamp> — #<K> principles tests green (N tests passed)
```

## Anti-scope

- DO NOT edit project-scope files: README.md, CLAUDE.md, .claude/rules/*, .claude/skills/* (PROJECT scope inside /Users/art/code/rules-as-tests-aif/), packages/core/principles/*
- DO NOT edit docs/meta-factory/prior-art-evaluations.md directly (unless your kickoff is specifically an SSOT-corrections kickoff)
- DO NOT push commits or open PRs
- DO NOT execute downstream kickoffs from the queue (they remain DRAFTS)
- DO NOT decide maintainer-owned D-questions or Q-questions — surface them in artefact §Dn
- DO NOT escalate to user mid-task — write BLOCKED:<reason> to state.md and stop
- DO NOT spawn your own sub-queue (depth-2 hierarchy hard limit; Workers do NOT spawn Workers)

User-scope ~/.claude/skills/ IS writable for Queue mode skill artefacts.

## When done

1. Verify all output files exist and have expected content (ls -la, wc -l)
2. Run principles tests (final step above)
3. Append to state.md: `- <ISO-timestamp> — RESEARCH-COMPLETE <K> (iter <N>)`
4. Return summary: list of files written with line counts, list of sections completed, any ATTN items (observations outside scope — do not act on them), confidence calibration.
````

---

## Placeholder reference

| Placeholder                    | Fill with                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `<YYYY-MM-DD>`                 | Today's date                                                                  |
| `<WORKDIR>`                    | `/Users/art/code/rules-as-tests-aif` (or project root)                        |
| `<K>`                          | Artefact letter (A / B / C / …)                                               |
| `<PATH-TO-QUEUE-KICKOFF>`      | Absolute path to the controlling kickoff file                                 |
| `<LIST SPECIFIC OUTPUT FILES>` | Per-artefact paths from kickoff §output                                       |
| `<STATE-MD-PATH>`              | Absolute path to this session's state.md                                      |
| `<ENUMERATE T-NUMBERS>`        | Copy from kickoff §5.<K> T-traps section; enumerate, do not blanket-reference |

## See also

- [[glossary.md]] — role definitions
- [[reviewer-template.md]] — paired Reviewer template
- [[queue-mode.md]] — §3 workflow, §7 iteration limits, §8 memory updates
- [[ai-laziness-traps-orchestrator.md]] — T-AO-A through T-AO-L
- `.claude/rules/ai-laziness-traps.md` — T1-T16 (project-wide; applies inside Worker sessions)
