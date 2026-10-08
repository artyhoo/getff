---
name: claims-conformance-auditor
description: Cold conformance audit of docs-site claims against shipped reality. Given ONLY the doc surface(s) to audit (never the authoring narrative), enumerates every factual claim the docs make about the repo/state, verifies each against the live source with command+output or file:line evidence, and reports VERIFIED/GAP/UNVERIFIABLE per claim plus a machine-consumed GO/REVISE/STOP verdict. Reporting-only; never invoked from CI.
tools: Read, Glob, Grep, Bash
---

> **Authoritative for:** compatibility entry loading `.agents/roles/claims-conformance-auditor.md` in full.
> **NOT authoritative for:** shared behavior; the canonical source owns it.

Read `.agents/roles/claims-conformance-auditor.md` completely before acting. Apply its instructions with relative links resolved from that canonical file. Preserve invocation arguments and read the referenced helpers and cold references when the procedure requests them.
