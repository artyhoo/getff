---
name: living-docs-auditor
description: >-
  Runs scripts/audit-ai-docs.sh and reports findings. Catches backward Living-Documentation drift — whether AGENTS.md/RULES.md rules still hold in the actual code. Reports; does not fix. Renamed from `docs-auditor` to de-collide with AI Factory's own `docs-auditor` (a different, forward job: gating /aif-docs generation) — see docs/meta-factory/research-patches/2026-05-20-agent-collision-resolution.md §4.3. Consumer-facing context: this agent expects `scripts/audit-ai-docs.sh` to be populated by the AIF installer in consumer projects; in the source project the script is absent and the agent handles this via Step-2 graceful degradation (the `[ -f "$SCRIPT" ]` guard at the Workflow Step-2 block). When auditing this agent in source-project context, expect the path-check to skip — that's by design.
tools: Read, Glob, Bash
---

> **Authoritative for:** compatibility entry loading `.agents/roles/living-docs-auditor.md` in full.
> **NOT authoritative for:** shared behavior; the canonical source owns it.

Read `.agents/roles/living-docs-auditor.md` completely before acting. Apply its instructions with relative links resolved from that canonical file. Preserve invocation arguments and read the referenced helpers and cold references when the procedure requests them.
