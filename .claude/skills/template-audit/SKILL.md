---
name: template-audit
description: Use when auditing rendered templates via local advisory review. Triggers: template, audit, render, generated docs, AGENTS.md, paraphrase, cue placement, local advisory, template-render, audit-template.
---

# template-audit — local advisory skill

> **Authoritative for:** local advisory template audit skill — trigger keywords, two-step procedure, P2/P3/P5 advisory checks, promotion trigger.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Deterministic CI gate — see [template-render.audit.ts](../../../packages/core/audit-self/template-render.audit.ts).

Session-bound advisory audit. **FREE under Claude Code subscription.** No API key. Not blocking.

## Procedure

**Step 1 — Deterministic probes (CI-equivalent)**

```bash
npm --prefix packages/core run test:template-render
```

If this fails — stop and fix before Step 2.

**Step 2 — LLM advisory checks (session-bound, P2/P3/P5)**

Ask the current Claude session (no API call):

- **P2 — Paraphrase fidelity**: Does rendered `AGENTS.md` convey "every rule is an
  executable test that fails CI"? Or has framing drifted to "guidelines/suggestions"?
- **P3 — Cue placement**: Is the session-bootstrap cue in the first 10 lines of
  rendered `AGENTS.md`?
- **P5 — Synonym coverage**: Does the P1 synonym list in `template-render.audit.ts`
  still match current template phrasing (no synonym drift)?

Report P2/P3/P5 as **advisory** (not blocking). Open follow-up issue if drift detected.

## Promotion trigger

Promote P2/P3/P5 → CI gate when:

- Deterministic CI PASS rate <80% over 30 days, OR
- Consumer reports goal-phrase miss not caught by P1/P4/P6.

Promotion path: re-evaluate Decision 3 in [closed-questions.md §13.27](../../../docs/meta-factory/closed-questions.md).
