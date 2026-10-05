---
name: aif-doctor
description: Use when the aif-handoff runtime is misbehaving — a task is stuck or crash-looping, new tasks stay backlog at capacity, the claude runtime is broken. Triggers: aif-doctor, aif health, task stuck, задача висит, runtime broken, рантайм сломан, aif не отвечает, capacity skipping, native binary not installed, why won't my task start. Invokable when the dispatcher is NOT running. NOT for running the dispatch loop (/dispatcher) or planning (/pipeline).
arguments: []
disable-model-invocation: false
model: opus
allowed-tools:
  - Bash(curl *)
  - Bash(docker *)
  - Bash(git *)
  - Bash(bash *)
  - Bash(ls *)
  - Bash(cat *)
  - Bash(grep *)
  - Bash(date *)   # GH #1581: age-threshold arithmetic for the -t --tail log windows (§3.7/§3.8)
  - Bash(awk *)    # GH #1581: age cut on docker logs -t timestamps (§3.7/§3.8)
  - Read
---

> Generated native entry from `.agents/procedures/aif-doctor/SKILL.md`; shared procedure is authored once.
> **Authoritative for:** native Codex discovery and full-source loading for this entry.
> **NOT authoritative for:** the shared procedure; read the linked canonical owner.

Read [the complete canonical procedure](../../../.agents/procedures/aif-doctor/SKILL.md) in full before proceeding. Read [Codex bindings](../../../docs/codex-contributor.md) and apply them to every step. Bind arguments from the operator invocation. Execute each mandatory shell block through the shell tool. Replace `${CLAUDE_SKILL_DIR}` with `.agents/procedures/aif-doctor` when reading a legacy procedure. Model/tool frontmatter grants no authority on this host.
