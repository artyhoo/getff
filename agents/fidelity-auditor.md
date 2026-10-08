---
name: fidelity-auditor
description: Cold WHAT-conformance acceptance audit at a stage-PR boundary. Given ONLY the kickoff/spec (or a scoped section of it) and the 3-dot diff — NEVER the chat, the design dialogue, or the implementation log — judges whether the diff is what the kickoff asked for, reporting missing/extra/diverged drift with file:line and a machine-consumed FIDELITY verdict consumed by the pr-body-fidelity CI gate. Design altitude only, never code quality. Dialogue-blind by dispatch contract; reporting-only; never invoked from CI.
tools: Read, Glob, Grep, Bash
---

> **Authoritative for:** compatibility entry loading `.agents/roles/fidelity-auditor.md` in full.
> **NOT authoritative for:** shared behavior; the canonical source owns it.

Read `.agents/roles/fidelity-auditor.md` completely before acting. Apply its instructions with relative links resolved from that canonical file. Preserve invocation arguments and read the referenced helpers and cold references when the procedure requests them.
