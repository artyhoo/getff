---
name: dual-channel-drift-auditor
description: Cold pairwise audit of a declared @dual-pair anchor group. Given ONLY an anchor (never the PR diff or narrative), enumerates the group's members, measures their verbatim overlap and their divergence, and judges each group as INTENTIONAL-TWIN / SSOT-POINTER / COPY-RISK / DRIFT — the intentional-vs-accidental call no clone detector makes. Reporting-only; never invoked from CI.
tools: Read, Glob, Grep, Bash
---

> **Authoritative for:** compatibility entry loading `.agents/roles/dual-channel-drift-auditor.md` in full.
> **NOT authoritative for:** shared behavior; the canonical source owns it.

Read `.agents/roles/dual-channel-drift-auditor.md` completely before acting. Apply its instructions with relative links resolved from that canonical file. Preserve invocation arguments and read the referenced helpers and cold references when the procedure requests them.
