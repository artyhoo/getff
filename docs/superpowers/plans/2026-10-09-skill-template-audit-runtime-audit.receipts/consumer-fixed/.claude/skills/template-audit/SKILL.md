---
name: template-audit
description: 'Use when auditing rendered templates via local advisory review. Triggers: template, audit, render, generated docs, AGENTS.md, paraphrase, cue placement, local advisory, template-render, audit-template.'
---

<!-- @harness-posture: portable — prose advisory audit checklist; no harness primitives -->

# template-audit — local advisory skill

> **Authoritative for:** local advisory template audit skill — trigger keywords, two-step procedure, P2/P3/P5 advisory checks, promotion trigger.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](https://github.com/artyhoo/getff/blob/main/README.md#why-this-exists). Deterministic CI gate — see [template-render.audit.ts](https://github.com/artyhoo/getff/blob/main/packages/core/audit-self/template-render.audit.ts).

Session-bound advisory audit. **FREE under Claude Code subscription.** No API key. Not blocking.

## Procedure

**Step 1 — Deterministic probes (framework checkout only)**

Bind any supplied relative rendered-document paths to the invocation cwd first.
Resolve the active project root with `git rev-parse --show-toplevel`; use that root
for runner and delivered-check paths, including in a consumer. Checking `scripts/`
from a nested cwd cannot establish that the project has no delivered checks.
First verify
`packages/core/package.json` contains `test:template-render`. If present in the
framework checkout, execute the following command through the shell tool from that
root; reading its declaration is not execution:

```bash
npm --prefix packages/core run test:template-render
```

Preserve the actual command, cwd, shell output and exit status from this invocation.
If it fails, stop before Step 2 and report the failure; fix and rerun only within the
operator's authorized scope. If execution is unavailable, report UNVERIFIED with
the observed tool diagnostic rather than inventing an exit status.

In a consumer, inspect the actual rendered documents and use its delivered checks
where available; record the framework runner as unavailable. Do not run a fabricated
equivalent or label advisory inspection CI-equivalent.

**Step 2 — LLM advisory checks (session-bound, P2/P3/P5)**

Use the current agent session (no additional API call). Inspect the rendered document
path supplied by the operator; otherwise use the consumer's installed `AGENTS.md`.
In a framework checkout, use an actual disposable install output; if none is
available, report the rendered target unavailable. The framework's own `AGENTS.md`
and a template source are not evidence of consumer rendering. A missing supplied
target is unavailable, never permission to silently substitute another file:

- **P2 — Paraphrase fidelity**: Does rendered `AGENTS.md` convey that each rule
  has an executable check that fails at the earliest reachable channel
  (edit-time → pre-commit → pre-push → CI → production audit), with CI as the
  last resort? This is the framework goal from README, not the consumer's product
  goal. Does wording instead reduce enforced rules to guidelines/suggestions?
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

Promotion path: re-evaluate Decision 3 in [closed-questions.md §13.27](https://github.com/artyhoo/getff/blob/main/docs/meta-factory/closed-questions.md).
