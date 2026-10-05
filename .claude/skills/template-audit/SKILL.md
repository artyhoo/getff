---
name: template-audit
description: 'Use when auditing rendered templates via local advisory review. Triggers: template, audit, render, generated docs, AGENTS.md, paraphrase, cue placement, local advisory, template-render, audit-template.'
---

<!-- @harness-posture: portable — prose advisory audit checklist; no harness primitives -->

# template-audit — local advisory skill

> **Authoritative for:** local advisory template audit skill — trigger keywords, two-step procedure, P2/P3/P5 advisory checks, promotion trigger.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Deterministic CI gate — see [template-render.audit.ts](../../../packages/core/audit-self/template-render.audit.ts).

Session-bound advisory audit. **FREE under Claude Code subscription.** No API key. Not blocking.

## Procedure

**Step 1 — Deterministic probes (framework checkout only)**

```bash
npm --prefix packages/core run test:template-render
```

First verify `packages/core/package.json` contains this runner. In a framework checkout, if the runner fails, stop and fix before Step 2. In a consumer, inspect the actual rendered documents and use its delivered checks where available; record the framework runner as unavailable. Do not run a fabricated equivalent or label advisory inspection CI-equivalent.

**Step 2 — LLM advisory checks (session-bound, P2/P3/P5)**

Use the current agent session (no additional API call):

- **P2 — Paraphrase fidelity**: Does rendered `AGENTS.md` convey "every rule is an
  executable test that fails CI"? Or has framing drifted to "guidelines/suggestions"?
- **P3 — Cue placement**: Is the session-bootstrap cue in the first 10 lines of
  rendered `AGENTS.md`?
- **P5 — Synonym coverage**: Does the P1 synonym list in `template-render.audit.ts`
  still match current template phrasing (no synonym drift)?

For P5, if the framework audit source is absent, record the synonym-list comparison as unavailable. Report P2/P3/P5 as **advisory** (not blocking), with observations and unavailable probes distinguished. Record any drift locally; open an external follow-up issue only if authorized.

## Without this skill

An agent treats a visual inspection of rendered consumer documents as a passing framework CI run, even when the runner and synonym source are not installed. Goal phrasing and cue placement can drift without an honest verification record.

## With this skill

The agent runs the real framework probes where available and inspects actual consumer output otherwise. It reports fidelity, cue placement and synonym coverage separately, recording missing probes explicitly instead of turning an advisory review into a false green.

## Promotion trigger

Promote P2/P3/P5 → CI gate when:

- Deterministic CI PASS rate <80% over 30 days, OR
- Consumer reports goal-phrase miss not caught by P1/P4/P6.

Promotion path: re-evaluate Decision 3 in [closed-questions.md §13.27](../../../docs/meta-factory/closed-questions.md).
