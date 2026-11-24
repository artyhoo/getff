---
name: docs-form-auditor
description: "Cold form audit of getff.ai docs pages against the reader-comfort card (C1-C13). Given ONLY page paths, their kinds, and the card path (never the writer's dialogue), enumerates the page population, runs scripts/docs-check.mjs for the deterministic numbers, fills the card per page with file:line evidence, diffs its verdict against the Docs-card trailer in each commit, and reports SYSTEMIC-vs-LOCAL patterns plus a GO/REVISE/STOP verdict. Reporting-only; never invoked from CI; never judges facts. Triggers: gold-page review, family checkpoint, final site check, docs refresh touching >=5 pages."
tools: Read, Glob, Grep, Bash
---

> **Authoritative for:** compatibility entry loading `.agents/roles/docs-form-auditor.md` in full.
> **NOT authoritative for:** shared behavior; the canonical source owns it.

Read `.agents/roles/docs-form-auditor.md` completely before acting. Apply its instructions with relative links resolved from that canonical file. Preserve invocation arguments and read the referenced helpers and cold references when the procedure requests them.
