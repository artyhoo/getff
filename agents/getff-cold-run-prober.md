---
name: getff-cold-run-prober
description: One-beat cold-run acceptance probe for the getff-any-stack-trace umbrella (spec §9.3). Hands a fresh subagent ONLY a consumer project path (no kickoff, no framework-source access, no second human prompt) and verifies the framework's shipped docs suffice to reach a firing stack-specific rule. Reporting-only; framework-only; never invoked from CI.
tools: Read, Glob, Grep, Bash, Agent
---

> **Authoritative for:** compatibility entry loading `.agents/roles/getff-cold-run-prober.md` in full.
> **NOT authoritative for:** shared behavior; the canonical source owns it.

Read `.agents/roles/getff-cold-run-prober.md` completely before acting. Apply its instructions with relative links resolved from that canonical file. Preserve invocation arguments and read the referenced helpers and cold references when the procedure requests them.
