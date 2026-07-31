<!-- scope: throwaway reachability probe — verifies whether the aif claude adapter exposes MCP tools to a dispatched agent after ~/.claude.json was populated in the container. NOT a deliverable; produces one report, no commits. -->
<!-- host-verify: none — probe kickoff, produces a report not an artefact; nothing to run on the host -->

# mcp-reachability-probe — can a dispatched aif agent call MCP tools?

> **Stage goal:** answer ONE question with evidence: **are MCP tools reachable from inside a
> dispatched aif task?** Do not implement anything. Do not commit. Do not open a PR.

## §0 Dispatch facts

- Tier 0 probe. No `bridge-profile` marker — run on project defaults.
- **Write NOTHING to the repository.** No commits, no file edits. Your entire deliverable is the
  final report text.

## §1 The probe

1. **Enumerate your own tools.** List every tool available to you. State plainly whether any tool
   name contains `mcp`, `deepwiki`, `context7`, or `exa`, and whether a built-in `WebSearch` /
   `WebFetch` exists. Quote the names verbatim.
2. **If a DeepWiki tool exists**, call it once: repo `anthropics/claude-code`, question «Does a
   `skills:` frontmatter field exist for subagents, and what does it do?» Paste the first ~300
   characters of the raw answer verbatim.
3. **If an Exa tool exists**, call `web_search_exa` once with the query «Claude Code subagent skills
   frontmatter preload». Paste the first result's title and URL verbatim.
4. **If a context7 tool exists**, say so and name it; no call needed.
5. **If NONE of them exist**, say exactly that — «no MCP tools are exposed to this seat» — and list
   what you DO have. **Do not simulate, narrate, or reconstruct a result you could not obtain.** A
   negative answer is the correct and useful outcome here; a fabricated positive is the specific
   failure this probe exists to detect.

## §2 Acceptance

The report contains: the tool inventory (verbatim names), and for each of DeepWiki / Exa / context7
either real quoted output or an explicit «tool not available to this seat». Nothing else.

## §3 Park-don't-guess contract (non-negotiable)

**aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity — **do NOT pick.**
Park it as a question (set the task to `manualReviewRequired` / `blocked_external` with the fork
stated as «Option A → consequence X / Option B → consequence Y») and **stop that task.** Proceed only
on the unambiguous parts. Never manufacture a quoted tool output.

## §4 AI-laziness traps

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps: T2, T3, T20.**

- **T2** — «I would be able to call DeepWiki» is not a call. Call it or report it absent.
- **T3** — every claim carries the verbatim tool output or an explicit absence statement.
- **T20** — no verdict about reachability without the tool call (or its documented failure) in the same turn.
- **T-PROBE-A (domain) — «answer from training data instead of the tool».** The probe questions have
  answers a model may believe it knows. Answering them from memory while implying a tool call is the
  exact defect under test. Counter: the acceptance requires the tool NAME you called and its raw output.
