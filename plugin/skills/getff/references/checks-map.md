# Checks map: what runs where

> Eight levels of protection, from edit-time to production. Each has its own speed, its own area of responsibility and its own fallback.
> Whenever you read any document in the rules-as-tests corpus, come back here to see which level you are on.

This document is the single entry point. The full picture: what runs at which stage, what it does, what it does NOT do, which tool is used, and which corpus document describes it in detail.

> **Authoritative for:** 8-level enforcement-checks map (edit-time → production) — what runs at each level, why, and which corpus doc describes it in depth. Single entry point for navigating the rules-as-tests corpus.
> **NOT authoritative for:** framework's project goal — see [README.md#why-this-exists](https://github.com/artyhoo/getff/blob/main/README.md#why-this-exists). Per-level patterns — see [overview.md](overview.md).

---

## The full picture

```text
EDIT-TIME      PRE-COMMIT     PRE-PUSH       PRE-PR         CI on PR        CI on merge      PRE-DEPLOY     PRODUCTION
────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ms             <5s            10–60s         1–3min         3–10min         10+min           seconds         continuous
─────────       ──────         ──────         ──────         ──────          ──────           ──────          ──────
 IDE LSP        prettier       typecheck      audit-ai-docs  full tests      full mutation    can-i-deploy    SLO
 typecheck      eslint --fix   vitest         sub-agents     coverage        bundle size      error budget    canary
                               related        rules R1..R20  Stryker         security audit   chaos          synthetic
                               depcruise      (+aif-verify)  Storybook+E2E                                    rollback

  local          local          local          local          GitHub         GitHub           CI / Pact      Datadog/
                                                              Actions        Actions          Broker         Honeycomb
                                                                                                              Argo
                                                                                                              Rollouts

      ↑ shift-left ────────────────────────────────────────────→  ↑ shift-right ────────────────────────────→
```

> **This is a generic model of the levels, not an inventory of what getff installs.** Levels 5–8 name
> Stryker, Pact Broker, Datadog and Argo Rollouts — getff installs none of them; you
> set them up yourself if you need them. The same goes for level 3: `tsc --noEmit`, `vitest related` and
> `dependency-cruiser` are what is sensible to keep at pre-push, not what getff writes
> there. **The `.husky/pre-push` hook that getff installs runs getff's own rule
> checks** — rule-glob liveness, lint-staged binary resolution, firing of the
> generated rules and link checking in changed Markdown; your typecheck, tests and
> architecture check you wire in yourself. The section registry is `packages/core/hooks/pre-push.ts`.

Left to right: the closer to production, the more expensive a found bug. The closer to the developer, the faster the feedback. That is why **checks are not spread across the stages at random**: whatever can be caught cheaply and quickly should be caught on the left; whatever needs real traffic moves to the right.

---

## Table of all levels

| #   | Level                                            | Duration   | Where it runs                       | What it does                                                                                                                                                                         | What it does NOT do                                                         | Source of truth                            |
| --- | ------------------------------------------------ | ---------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | **Edit-time**                                    | instant    | Editor / IDE                        | TypeScript LSP and ESLint LSP highlight errors in the code as you type                                                                                                               | Do not run tests, do no aggregate checks                                    | TS server, eslint daemon                   |
| 2   | **Pre-commit** (lint-staged via Husky)           | <5 s       | Locally, before `git commit`        | `prettier --write` and `eslint --fix --max-warnings=0` on staged files **only**                                                                                                      | Does not run tests, does not typecheck the whole project                    | `.husky/pre-commit` + `.lintstagedrc.json` |
| 3   | **Pre-push** (Husky)                             | 10–60 s    | Locally, before `git push`          | `tsc --noEmit` for the whole project, `vitest related` on changed files, `dependency-cruiser`                                                                                        | Does not run Stryker, does not run the full test suite                      | `.husky/pre-push`                          |
| 4   | **Pre-PR** (`audit-ai-docs.sh` + review-sidecar) | 1–3 min    | Locally, in Claude Code             | `./scripts/audit-ai-docs.sh` + sub-agents (`review-sidecar`, `living-docs-auditor`) check `.ai-factory/RULES.md`, two-AI review (+ the `/aif-verify` wrapper, if you use AI-Factory) | Does not replace CI — only complements it                                   | `audit-ai-docs.sh`, `review-sidecar`       |
| 5   | **CI on PR**                                     | 3–10 min   | GitHub Actions / GitLab CI          | Full suite: unit + integration + Storybook + Playwright (for UI). **Stryker incremental** on the diff. Coverage threshold.                                                           | No full mutation over the whole repo, no chaos engineering                  | `.github/workflows/ci.yml`                 |
| 6   | **CI on merge**                                  | 10+ min    | GitHub Actions, after merge to main | Full mutation sweep, bundle size, security audit (npm audit, gitleaks), build artifacts                                                                                              | Does not deploy to prod right away — the artifact waits for the deploy gate | `.github/workflows/post-merge.yml`         |
| 7   | **Pre-deploy**                                   | seconds    | CI / Pact Broker                    | `can-i-deploy --to production` (for microservices), error budget burn rate check, snapshot signing                                                                                   | Does not run tests — that is already done                                   | `pact-broker can-i-deploy`, SLO server     |
| 8   | **Production**                                   | continuous | Live environment                    | SLO + error budget tracking, synthetic monitoring every 5 min, canary auto-rollback, chaos engineering                                                                               | Does not validate code structure — that is the left side's job              | Datadog/Honeycomb, Argo Rollouts, Gremlin  |

---

## What runs where, by rules-as-tests layer

| Rules as Tests layer   | Level 1 (IDE)                | 2 (pre-commit) | 3 (pre-push)                           | 4 (pre-PR)               | 5 (CI PR)                           | 6 (CI merge)    | 7 (pre-deploy)     | 8 (prod)                         |
| ---------------------- | ---------------------------- | -------------- | -------------------------------------- | ------------------------ | ----------------------------------- | --------------- | ------------------ | -------------------------------- |
| **L1 Architecture**    | ESLint                       | ESLint --fix   | depcruise                              | sub-agent                | full ESLint + depcruise             | bundle size     | —                  | service mesh, network policies   |
| **L2 Meta-tests**      | —                            | —              | vitest related (meta-tests on changed) | sub-agent                | full meta-test run                  | —               | —                  | —                                |
| **L3 Spec by Example** | —                            | —              | vitest related                         | sub-agent                | full it.each suite + property tests | —               | —                  | synthetic e2e                    |
| **L4 Mutation**        | —                            | —              | —                                      | —                        | Stryker incremental                 | Stryker full    | —                  | chaos engineering                |
| **L5 Living Docs**     | TS LSP highlights mismatches | —              | —                                      | sub-agent on JSDoc style | docs CI build                       | OpenAPI publish | —                  | runbooks get updated             |
| **Contracts (Pact)**   | —                            | —              | —                                      | —                        | publish pact contracts              | —               | **`can-i-deploy`** | (Pact Broker tracks)             |
| **Shift-right**        | —                            | —              | —                                      | —                        | —                                   | —               | error budget gate  | SLO + canary + synthetic + chaos |

---

## What must NOT be at each stage

One of the most common anti-patterns: tests go into pre-commit, and a week later the whole team is hitting `--no-verify`. Here are the explicit bans:

### Pre-commit — DO NOT

- Unit tests (even on one file that is already >5 seconds).
- `tsc --noEmit` for the whole project (slow).
- A full `eslint .` (staged only).
- Stryker (never in pre-commit, at all).
- E2E tests.
- npm audit (slow, needs the network).

### Pre-push — DO NOT

- Stryker mutation testing (slow).
- Storybook test runner (needs a build).
- Playwright e2e (needs a running server).
- npm audit (runs in CI, not locally).
- A full coverage sweep.

### CI on PR — NEEDS what is not needed locally

- `npm audit --audit-level=high` (security).
- `gitleaks` or `trufflehog` (secret scanning in commits).
- Codecov upload (needs a token).
- Bundle size check (needs a build).
- Stryker incremental on the diff (needs actions/cache).

### Production — does NOT duplicate what is in CI

- SLO/error budget — **not code validation** but behaviour validation.
- Synthetic — not «did the tests pass» but «does the user journey work right now».
- Chaos — not unit tests but a check of the live system.

---

## Which corpus document describes which level

| Level                                                                  | Detailed description in                                                                                                                                                |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — IDE                                                                | Not covered separately — it is an editor feature                                                                                                                       |
| 2 — Pre-commit                                                         | `packages/core/templates/shared/.lintstagedrc.json` + `husky-pre-commit.sh`                                                                                            |
| 3 — Pre-push                                                           | `packages/core/templates/shared/husky-pre-push.sh` (with a fallback for new branches)                                                                                  |
| 4 — Pre-PR (`audit-ai-docs.sh` + review-sidecar / living-docs-auditor) | `./scripts/audit-ai-docs.sh` + our `agents/review-sidecar.md` + `agents/living-docs-auditor.md` (+ AIF `rules-sidecar` / `/aif-verify` wrapper, if you use AI-Factory) |
| 5 — CI on PR                                                           | `templates/ts-server/github-actions-ci.yml` or `packages/preset-next-15-canonical/templates/github-actions-ci-ui.yml`                                                  |
| 6 — CI on merge                                                        | An extension of `github-actions-ci.yml` for the full mutation sweep (see the comments in the file)                                                                     |
| 7 — Pre-deploy / can-i-deploy                                          | `packages/core/templates/shared/integration-rules.md` (IR2 — Pact + can-i-deploy)                                                                                      |
| 8 — Production                                                         | `packages/core/templates/shared/integration-rules.md` (IR5 — observability) — extensions need separate infrastructure (Prometheus, Honeycomb, Argo Rollouts)           |

---

## Anti-patterns of the big picture

1. **Duplicating checks across levels.** If `tsc --noEmit` is already in pre-push, you do not need it in pre-commit. If CI runs the full suite, pre-push should not repeat it. Each check belongs **on one** level (plus CI as insurance against `--no-verify`).

2. **No fallback for `--no-verify`.** Local hooks can be bypassed. So **everything critical must also be in CI**. Pre-commit + pre-push are for feedback speed; CI is for authority.

3. **Pre-PR without CI.** AIF's `/aif-verify` is a powerful local check, but it does not replace CI. External contributors do not have AIF; an AI agent can skip the step. A required check on merge via CI stays mandatory.

4. **Production with no feedback loop into shift-left.** Every prod incident should end with an added test or ESLint rule. Without that, the right side works one way and the left side never learns.

5. **Too much in one level.** If CI on PR takes >10 minutes, developers start merging without waiting. The fix: parallelisation, splitting into critical/non-critical jobs, incremental mode (Stryker, ESLint cache, Vitest related).

6. **Pre-commit longer than 5 seconds.** The team instantly starts hitting `--no-verify`. Lint-staged + only prettier + eslint --fix on staged. Full stop.

7. **`@{push}` without an upstream fallback.** Pre-push on a new branch with no upstream will fail. Fall back to `origin/<default-branch>` via `git symbolic-ref`.

---

## Minimal pipeline for a new project

If you are starting from scratch, here is the minimum that covers 80% of the problems:

| Level          | Concretely                                                             |
| -------------- | ---------------------------------------------------------------------- |
| 2 — pre-commit | `prettier --write` + `eslint --fix` via lint-staged                    |
| 3 — pre-push   | `npm run typecheck` + `vitest related $CHANGED` + `npm run arch:check` |
| 5 — CI on PR   | lint, typecheck, arch, tests with a coverage threshold, build          |
| 7 — pre-deploy | (if microservices) `can-i-deploy --to production`                      |
| 8 — production | one SLO on the critical flow + one synthetic test                      |

That is all. Without this you are flying blind. Beyond it, add gradually as the project grows.

---

## Mature pipeline for a production system

All 8 levels are on and complement each other:

| Level | What is added on top of the minimum                                                                       |
| ----- | --------------------------------------------------------------------------------------------------------- |
| 2     | + commitlint + sort-package-json                                                                          |
| 3     | + dependency-cruiser strict + meta-tests on critical directories                                          |
| 4     | + `audit-ai-docs.sh` + review-sidecar / living-docs-auditor (AIF `/aif-verify` only if you run AIF)       |
| 5     | + Stryker incremental + Storybook test-runner + Playwright + bundle size + Codecov                        |
| 6     | + Stryker full nightly + npm audit + gitleaks + OpenAPI publish                                           |
| 7     | + Pact `can-i-deploy` + error budget burn rate check                                                      |
| 8     | + a full SLO stack (Pyrra/Sloth) + Argo Rollouts canary + Datadog Synthetic + quarterly chaos engineering |

This is a path. Do not try to stand everything up in a week. Each level is a separate investment that pays off at scale.

---

## Cheat sheet: which tool at which level

| Tool                               | Level                                 |
| ---------------------------------- | ------------------------------------- |
| TypeScript LSP                     | 1                                     |
| Prettier                           | 2                                     |
| ESLint (--fix)                     | 2                                     |
| ESLint (--max-warnings=0)          | 5                                     |
| `tsc --noEmit`                     | 3, 5                                  |
| `vitest related`                   | 3                                     |
| `vitest run --coverage`            | 5                                     |
| Vitest property-based (fast-check) | 5                                     |
| Storybook test-runner              | 5                                     |
| Playwright                         | 5 (e2e in CI) + 8 (synthetic in prod) |
| Stryker `--incremental`            | 5                                     |
| Stryker full                       | 6                                     |
| dependency-cruiser                 | 3, 5                                  |
| `audit-ai-docs.sh` (shipped gate)  | 4                                     |
| AIF `/aif-verify` (external, opt.) | 4                                     |
| AIF sub-agents                     | 4                                     |
| commitlint                         | 2                                     |
| Husky                              | 2, 3                                  |
| lint-staged                        | 2                                     |
| npm audit                          | 5, 6                                  |
| gitleaks / trufflehog              | 5, 6                                  |
| Codecov                            | 5                                     |
| Pact `can-i-deploy`                | 7                                     |
| OpenSLO + Pyrra/Sloth              | 8                                     |
| Datadog Synthetic / Checkly        | 8                                     |
| Argo Rollouts / Flagger            | 7→8 (gate + execution)                |
| Gremlin / LitmusChaos              | 8                                     |
| OpenTelemetry SDK                  | 8                                     |

---

## How this maps to the components of this package

This document is a navigation map. Each component of the package covers its own part:

- **`skills/getff/SKILL.md`** + `references/overview.md` — the general 5-layer framework (applies to levels 4, 5).
- **`templates/ts-server/`** — configs for the server-side TS stack (levels 2, 3, 5, 6).
- **`packages/preset-next-15-canonical/templates/`** — React/Next.js configs (levels 2, 3, 5, 6).
- **`agents/review-sidecar.md`** + **`living-docs-auditor.md`** (ours) + AIF's own **`rules-sidecar`** (reads `RULES.md`) — sub-agents for level 4. At this level `./scripts/audit-ai-docs.sh` + our sub-agents always run; `/aif-verify` is an AI-Factory wrapper on top of them, if you use it. (`best-practices-sidecar` is AIF's — KEEP-AIF; R-rule residue rides the `aif-rules-check` skill-context.)
- **`scripts/audit-ai-docs.sh`** — code-vs-docs probes (level 4 + 5).
- **`packages/core/templates/shared/integration-rules.md`** — IR1-IR6 for levels 5 (Pact CI), 7 (can-i-deploy), 8 (observability propagation).
- **`references/self-testing-docs.md`** — code-vs-docs probes in detail, as an extension of the framework to the AI documentation itself.

If you are a developer reading any of the documents listed and you have lost your bearings, come back here to see where you are.
