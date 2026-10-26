# Research admission preflight

> **Date:** 2026-10-26.
> **Authoritative for:** the bounded readiness observations and unresolved research route below.
> **NOT authoritative for:** implementation approval, current architecture agreement, runtime adoption or removal of admission checks.

## Inputs and method

Feature: `portable-verified-autonomy`. Research scope: [research specification](../../2026-10-26-portable-verified-autonomy-research-spec.md).
Approved PRD SHA256: `ec33fd3d88ae41fb623b31d4d465d96d2cbe3af63dfc7d815f72c8c684590721`.
Source checkout: `/Users/art/.codex/worktrees/10c1/rules-as-tests-aif`, HEAD `c458396147b48e3b2c14d2a458870c1bc31d4a22`.

Read-only probe `/root/research_route_probe` inspected documented runtime routes and current readiness. No task, configuration change, remote source delivery or GLM launch occurred. The parent independently reproduced the decisive authority check below. Service readiness observations are point-in-time, not promises of availability or subscription eligibility.

## Observations

| ID | Evidence | Interpretation and limit |
| --- | --- | --- |
| A1 | Probe: `GET http://localhost:3009/health` returned `status: "ok"`. `GET /projects` exposed project `441c1c0c-b633-4612-a34c-2cc0c4d0eaf2`, root `/home/www/rules-as-tests-aif`, `parallelEnabled:true`. | AIF is reachable; not missing merely because there is no native AIF tool in this chat. |
| A2 | Probe: enabled project-visible profiles included `Z.AI GLM-5.3 SDK`, ID `53eca24c-a85d-491c-97be-11b1abf38c83`. | An executor profile exists; actual quota, eligibility and successful task execution were not tested. No credentials were printed. |
| A3 | Parent reproduced `current-decisions.mjs --check-plan-prep --feature portable-verified-autonomy --repo-root <checkout> --orch-home <checkout>/.claude/orchestrator-prompts`; exit 2, exact output below. | The current supported feature handoff is held; the approved PRD alone does not satisfy it. |
| A4 | Probe: `AifHandoffBackend.ts:297` calls `enforceKickoffAdmission`; `resultReview.ts:594` calls `selectedAuthority`, which invokes `--check-plan-prep` at `:272–308`. `current-decisions.mjs:486–489,693–701` requires current agreed spec and matching review. | The inspected admission path has no research/implementation discriminator. No separate research exemption was established. |
| A5 | Probe: `docker --context pc ps` found `aif-agent-1`; mount `/home/etot/aif/projects` → `/home/www`. Container path checks found neither the macOS checkout nor the approved PRD snapshot, handoff and dossier at the repository-relative target paths. `AifHandoffBackend.ts:363–391` serializes kickoff content, not linked files. | A later admitted research task needs bounded input delivery and destination digest verification. Host-local links are not sufficient. No delivery occurred. |
| A6 | Probe: task title/description, host/container branch and worktree-name searches found no `portable-verified-autonomy` match. Existing chats were not inspected and full canonical in-flight helper was not run. | Partial collision evidence only; do not label FRESH. Re-run the full supported probe immediately before any actual dispatch. |

```json
{"ok":false,"code":"spec_agreement_missing","reason":"no current operator-agreed spec is recorded for this feature"}
```

## Procedure conflict and proposed disposition

The canonical arch research contour requires research before ideation/design and states “The research runs on the executor tier in aif.” Its current factory admission requires an operator-agreed solution spec first. The selector currently has an approved PRD and `currentSpec:null`. Recording this research scope as a completed solution design would misrepresent its meaning; direct REST dispatch, an invented feature identity, marker removal or legacy classification would evade the existing gate.

**Proposed route, not yet selected:** keep the research scope and evidence/review requirements; obtain the operator's explicit route exception to perform the research in this chat with scoped researchers, verifier distillation and cold K-pass. Preserve AIF and its admission checks. This advances the requested evidence gathering without first adding a coordinator feature to investigate whether more coordinator code is needed. The alternative is an explicitly scoped separate design/fix of research admission; it increases this task's implementation scope and must not be smuggled into research.

Falsifier: a supported existing research-admission route is found in the canonical owners and can be exercised without pretending a solution spec is agreed; then use that route instead. The current inspection establishes a bounded conflict, not a claim that every possible runtime path is absent.

At this preflight's original close the operator had not selected either route. No solution `currentSpec`, new feature selector, runtime claim or launch receipt was written.

## Subsequent operator resolution — 2026-10-26

The operator explicitly requested: write the first specification for research, give it to Sol without AIF, then return to intent and arch. The research specification records this as P9/D7. This selects local collaboration with Sol and supersedes the pending route choice above. The AIF admission hold remains valid for its own path; no gate is changed or bypassed. The research scope is not recorded as the current agreed solution specification. This authorization covers research execution and verification, not product implementation or installation.
