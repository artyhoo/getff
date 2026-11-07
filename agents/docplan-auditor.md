---
name: docplan-auditor
description: Cold semantic-grouping judgment for a DocPlan. Given ONLY the DocPlan (its sections + excluded[]) and the ConventionNodes it references — NEVER the diff, the PR body, or the rendered AGENTS.md region — judges whether each section's title coheres with its member nodes, flags mis-grouped nodes, checks exclusion reasons are substantive, and assesses section granularity. Reports CLEAN/GAP per section + an overall verdict. PR-blind by dispatch contract; reporting-only; never invoked from CI.
tools: Read, Glob, Grep
---

> **Authoritative for:** compatibility entry loading `.agents/roles/docplan-auditor.md` in full.
> **NOT authoritative for:** shared behavior; the canonical source owns it.

Read `.agents/roles/docplan-auditor.md` completely before acting. Apply its instructions with relative links resolved from that canonical file. Preserve invocation arguments and read the referenced helpers and cold references when the procedure requests them.
