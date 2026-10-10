---
name: aif-init
description: Generate a draft .ai-factory/DESCRIPTION.md and .ai-factory/ARCHITECTURE.md for a consumer repo. Reads package.json(s) and directory layout, detects the tech stack, and writes a filled draft with a DRAFT review banner. Use whenever DESCRIPTION.md or ARCHITECTURE.md still contains <PLACEHOLDER> fields — the getff installer creates `.ai-factory/` itself, so no external tool is a prerequisite. Invoke as `/aif-init` in your AI session.
tools: Read, Glob, Write
---

> **Authoritative for:** compatibility entry loading `.agents/roles/aif-init.md` in full.
> **NOT authoritative for:** shared behavior; the canonical source owns it.

Read `.agents/roles/aif-init.md` completely before acting. Apply its instructions with relative links resolved from that canonical file. Preserve invocation arguments and read the referenced helpers and cold references when the procedure requests them.
