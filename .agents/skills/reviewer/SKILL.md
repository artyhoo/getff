---
name: reviewer
description: Use when the operator or an orchestrator asks for an interactive review with a verdict — «проверь», «ревью», «вердикт», «это правильно?», «оцени результат», «phase N закрыт», review, second opinion, independent review, verify deliverable, "is this correct?" — and the deliverable is a GO/REVISE/STOP verdict or a verified answer, not code. NOT for implementing fixes or writing tests (orchestrator work), and NOT for the cold PR-boundary protocols (agents/fidelity-auditor.md, agents/review-sidecar.md — those are dispatched, not interactive).
---

> Generated native entry from `.agents/procedures/reviewer/SKILL.md`; shared procedure is authored once.
> **Authoritative for:** native Codex discovery and full-source loading for this entry.
> **NOT authoritative for:** the shared procedure; read the linked canonical owner.

Read [the complete canonical procedure](../../../.agents/procedures/reviewer/SKILL.md) in full before proceeding. Read [Codex bindings](../../../docs/codex-contributor.md) and apply them to every step. Treat explicit `$reviewer` or a direct operator request as the host equivalent of legacy `/reviewer`; explicit-only policy still forbids self-initiation. Bind arguments from the operator invocation (absent means an empty string, never an invented umbrella). Preserve the invocation cwd and supplied arguments before changing directories; canonical procedure-specific input rules govern relative targets. Bind the nearest project containing this canonical source, never an enclosing Git root, using the executable block below. After binding supplied inputs, execute canonical commands from that root. Execute each mandatory shell block through the shell tool.

```bash
GETFF_PROJECT_ROOT="$PWD"
while [ ! -f "$GETFF_PROJECT_ROOT/.agents/procedures/reviewer/SKILL.md" ]; do
  [ "$GETFF_PROJECT_ROOT" != / ] || { printf "%s\n" "getff: installed procedure root missing" >&2; exit 2; }
  GETFF_PROJECT_ROOT="${GETFF_PROJECT_ROOT%/*}"; GETFF_PROJECT_ROOT="${GETFF_PROJECT_ROOT:-/}"
done
GETFF_SKILL_DIR="$GETFF_PROJECT_ROOT/.agents/procedures/reviewer"
```

Replace `${CLAUDE_SKILL_DIR}` with `"$GETFF_SKILL_DIR"`; its canonical source is `.agents/procedures/reviewer`. Model/tool frontmatter grants no authority on this host.
