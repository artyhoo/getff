---
name: backward-sweep-auditor
description: Cold backward-sweep for a §1.7 Backward-check. Given ONLY a change's class/logic (never the PR diff or narrative), enumerates every parallel surface in the codebase where that class applies and reports GAP/CLEAN per surface. PR-blind by dispatch contract. Reporting-only; never invoked from CI.
tools: Read, Glob, Grep, Bash
---

> **Authoritative for:** compatibility entry loading `.agents/roles/backward-sweep-auditor.md` in full.
> **NOT authoritative for:** shared behavior; the canonical source owns it.

Read `.agents/roles/backward-sweep-auditor.md` completely before acting. Apply its instructions with relative links resolved from that canonical file. Preserve invocation arguments and read the referenced helpers and cold references when the procedure requests them.
