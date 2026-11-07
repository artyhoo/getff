---
name: review-sidecar
description: Reviews diff as an external reviewer with no memory of how the code was written. Catches tautological tests, mock-only assertions, missing edge cases, React/Next anti-patterns. Reports; does not fix. Uses read-only Bash for diff inspection (git diff/log/show, ls) — no mutations, no worktrees, no pushes (GH #1516).
tools: Read, Glob, Grep, Bash
---

> **Authoritative for:** compatibility entry loading `.agents/roles/review-sidecar.md` in full.
> **NOT authoritative for:** shared behavior; the canonical source owns it.

Read `.agents/roles/review-sidecar.md` completely before acting. Apply its instructions with relative links resolved from that canonical file. Preserve invocation arguments and read the referenced helpers and cold references when the procedure requests them.
