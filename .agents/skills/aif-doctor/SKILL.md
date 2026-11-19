---
name: aif-doctor
description: "Use when the aif-handoff runtime is misbehaving — a task is stuck or crash-looping, new tasks stay backlog at capacity, the claude runtime is broken. Triggers: aif-doctor, aif health, task stuck, задача висит, runtime broken, рантайм сломан, aif не отвечает, capacity skipping, native binary not installed, why won't my task start. Invokable when the dispatcher is NOT running. NOT for running the dispatch loop (/dispatcher) or planning (/pipeline)."
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
  - Bash(date *) # GH #1581: age-threshold arithmetic for the -t --tail log windows (§3.7/§3.8)
  - Bash(awk *) # GH #1581: age cut on docker logs -t timestamps (§3.7/§3.8)
  - Read
---

> Generated native entry from `.agents/procedures/aif-doctor/SKILL.md`; shared procedure is authored once.
> **Authoritative for:** native Codex discovery and full-source loading for this entry.
> **NOT authoritative for:** the shared procedure; read the linked canonical owner.

Read [the complete canonical procedure](../../../.agents/procedures/aif-doctor/SKILL.md) in full before proceeding. Read [Codex bindings](../../../docs/codex-contributor.md) and apply them to every step. Treat explicit `$aif-doctor` or a direct operator request as the host equivalent of legacy `/aif-doctor`; explicit-only policy still forbids self-initiation. Bind arguments from the operator invocation (absent means an empty string, never an invented umbrella). Preserve the invocation cwd and supplied arguments before changing directories; canonical procedure-specific input rules govern relative targets. Bind the nearest project containing this canonical source, never an enclosing Git root, using the executable block below. After binding supplied inputs, execute canonical commands from that root. Execute each mandatory shell block through the shell tool.

```bash
GETFF_PROJECT_ROOT="$PWD"
while [ ! -f "$GETFF_PROJECT_ROOT/.agents/procedures/aif-doctor/SKILL.md" ]; do
  [ "$GETFF_PROJECT_ROOT" != / ] || { printf "%s\n" "getff: installed procedure root missing" >&2; exit 2; }
  GETFF_PROJECT_ROOT="${GETFF_PROJECT_ROOT%/*}"; GETFF_PROJECT_ROOT="${GETFF_PROJECT_ROOT:-/}"
done
GETFF_SKILL_DIR="$GETFF_PROJECT_ROOT/.agents/procedures/aif-doctor"
```

Replace `${CLAUDE_SKILL_DIR}` with `"$GETFF_SKILL_DIR"`; its canonical source is `.agents/procedures/aif-doctor`. Model/tool frontmatter grants no authority on this host.
