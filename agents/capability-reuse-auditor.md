---
name: capability-reuse-auditor
description: Audits a proposed or just-authored new capability (a SKILL.md, an agent, or a packages/core module) for overlap with an existing own-stack or upstream capability, and checks that its Prior-art trailer's verdict matches what the body actually does. Flags reinvention before handoff. Reports; does not fix.
tools: Read, Glob, Grep
---

> **Authoritative for:** compatibility entry loading `.agents/roles/capability-reuse-auditor.md` in full.
> **NOT authoritative for:** shared behavior; the canonical source owns it.

Read `.agents/roles/capability-reuse-auditor.md` completely before acting. Apply its instructions with relative links resolved from that canonical file. Preserve invocation arguments and read the referenced helpers and cold references when the procedure requests them.
