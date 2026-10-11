---
name: claude-glm-executor-handoff
description: "Use when an in-aif Claude coordinator is about to dispatch an executable task to a GLM-5.3 worker (any agent whose frontmatter carries `model: glm-5.3` or a GLM-family model). Triggers: writing a dispatch prompt for a GLM worker inside aif-handoff, GLM executor, implement-worker GLM, cross-model dispatch within aif, planning a handoff to GLM-5.3, parsing a GLM worker's REPORT. NOT for Claude→Claude worker dispatch (use SDD directly)."
---

> Generated native entry from `.agents/procedures/claude-glm-executor-handoff/SKILL.md`; shared procedure is authored once.
> **Authoritative for:** native Codex discovery and full-source loading for this entry.
> **NOT authoritative for:** the shared procedure; read the linked canonical owner.

Read [the complete canonical procedure](../../../.agents/procedures/claude-glm-executor-handoff/SKILL.md) in full before proceeding. Read [Codex bindings](../../../docs/codex-contributor.md) and apply them to every step. Treat explicit `$claude-glm-executor-handoff` or a direct operator request as the host equivalent of legacy `/claude-glm-executor-handoff`; explicit-only policy still forbids self-initiation. Bind arguments from the operator invocation (absent means an empty string, never an invented umbrella). Preserve the invocation cwd and supplied arguments before changing directories; canonical procedure-specific input rules govern relative targets. Bind the nearest project containing this canonical source, never an enclosing Git root, using the executable block below. After binding supplied inputs, execute canonical commands from that root. Execute each mandatory shell block through the shell tool.

```bash
GETFF_PROJECT_ROOT="$PWD"
while [ ! -f "$GETFF_PROJECT_ROOT/.agents/procedures/claude-glm-executor-handoff/SKILL.md" ]; do
  [ "$GETFF_PROJECT_ROOT" != / ] || { printf "%s\n" "getff: installed procedure root missing" >&2; exit 2; }
  GETFF_PROJECT_ROOT="${GETFF_PROJECT_ROOT%/*}"; GETFF_PROJECT_ROOT="${GETFF_PROJECT_ROOT:-/}"
done
GETFF_SKILL_DIR="$GETFF_PROJECT_ROOT/.agents/procedures/claude-glm-executor-handoff"
```

Replace `${CLAUDE_SKILL_DIR}` with `"$GETFF_SKILL_DIR"`; its canonical source is `.agents/procedures/claude-glm-executor-handoff`. Model/tool frontmatter grants no authority on this host.
