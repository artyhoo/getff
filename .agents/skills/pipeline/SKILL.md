---
name: pipeline
description: 'Use when you have ≥2 in-flight wave umbrellas with cross-stage dependencies, suspect drift between wave-sequencing-plan.md and live git reality, or need to dispatch the next wave with verified Stage N→N+1 gates. Triggers: pipeline, wave orchestrator, wave plan, stage-gate, umbrella priority, waves parallel/sequential, wave-sequencing-plan drift. Invocation channel: explicit /pipeline only — disable-model-invocation:true is a channel flag and not a permission (§0).'
arguments: [umbrella]
argument-hint: '[umbrella-name]'
disable-model-invocation: true
model: opus
allowed-tools:
  - Bash(git *)
  - Bash(gh *)
  - Bash(ls *)
  - Bash(cat *)
  - Bash(bash .agents/procedures/pipeline/helpers/*.sh *)
  - Read
  - Write
  - Edit
  - Agent
---

> Generated native entry from `.agents/procedures/pipeline/SKILL.md`; shared procedure is authored once.
> **Authoritative for:** native Codex discovery and full-source loading for this entry.
> **NOT authoritative for:** the shared procedure; read the linked canonical owner.

Read [the complete canonical procedure](../../../.agents/procedures/pipeline/SKILL.md) in full before proceeding. Read [Codex bindings](../../../docs/codex-contributor.md) and apply them to every step. Treat explicit `$pipeline` or a direct operator request as the host equivalent of legacy `/pipeline`; explicit-only policy still forbids self-initiation. Bind arguments from the operator invocation (absent means an empty string, never an invented umbrella). Preserve the invocation cwd and supplied arguments before changing directories; canonical procedure-specific input rules govern relative targets. Bind the nearest project containing this canonical source, never an enclosing Git root, using the executable block below. After binding supplied inputs, execute canonical commands from that root. Execute each mandatory shell block through the shell tool.

```bash
GETFF_PROJECT_ROOT="$PWD"
while [ ! -f "$GETFF_PROJECT_ROOT/.agents/procedures/pipeline/SKILL.md" ]; do
  [ "$GETFF_PROJECT_ROOT" != / ] || { printf "%s\n" "getff: installed procedure root missing" >&2; exit 2; }
  GETFF_PROJECT_ROOT="${GETFF_PROJECT_ROOT%/*}"; GETFF_PROJECT_ROOT="${GETFF_PROJECT_ROOT:-/}"
done
GETFF_SKILL_DIR="$GETFF_PROJECT_ROOT/.agents/procedures/pipeline"
```

Replace `${CLAUDE_SKILL_DIR}` with `"$GETFF_SKILL_DIR"`; its canonical source is `.agents/procedures/pipeline`. Model/tool frontmatter grants no authority on this host.
