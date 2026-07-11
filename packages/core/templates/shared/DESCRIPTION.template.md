# <PROJECT_NAME>

> Replace placeholders below. This file is loaded by every AI agent at session start.
> Keep ≤150 lines. Cold content goes to `.claude/skills/` and `.claude/rules/`.
>
> **Authoritative for:** consumer-project description template — domain / stack / constraints / non-goals scaffolding.
> **NOT authoritative for:** project goal — see consumer's README.md.

## What it is

<One-paragraph project description. Domain, primary users, core value proposition.>

## Stack

- **Runtime:** Node.js 22.23+
- **Language:** TypeScript 5.7+ (strict + noUncheckedIndexedAccess)
- **Framework:** <Fastify | Hono | Express | Next.js 15 App Router>
- **Database:** <Postgres | MySQL | SQLite> + <Drizzle | Prisma | Kysely>
- **Validation:** Zod (schemas at every external boundary)
- **Tests:** Vitest 4.x (unit + integration), fast-check (property-based), Stryker 8 (mutation incremental)
- **Lint:** ESLint 10 flat config + typescript-eslint/strictTypeChecked + Prettier
- **Architecture:** dependency-cruiser (no-cycles, layered)
- **Pre-commit:** Husky + lint-staged
- **CI:** GitHub Actions
- **Observability:** OpenTelemetry → <Honeycomb | Datadog | Grafana Cloud>
- **<UI only> Storybook 9:** play functions for behavioural tests
- **<UI only> Playwright:** e2e + component testing

## Hard constraints

These are non-negotiable. Enforced by lint/test/CI.

- All external inputs (HTTP body/query, env, message queues, DB rows) parsed via Zod.
- Domain layer (`src/domain/`) imports stdlib + Zod ONLY — no framework, no infrastructure.
- No `as any`, no non-null assertions (`!`), no `enum`.
- All public exports have at least one test.
- Mutation kill rate ≥70% on PR diff (Stryker incremental).
- All time, randomness, IO injected via interfaces — no `Date.now()`/`Math.random()`/`fs.*` in production code.

## Non-goals

<Things explicitly NOT in scope. Helps the AI not over-engineer.>

- Example: no support for offline mode in v1.
- Example: no real-time collaboration features.
- Example: no PostgreSQL replication setup — single-region deployment.

## Source-of-truth pointers

- DB schema: `<prisma/schema.prisma | drizzle/schema.ts>`
- API contract: `openapi/<service-name>.yaml` (auto-generated from Zod via `zod-to-openapi`)
- Architecture decisions: `docs/adr/`
- Rules R1–R20 (enforced): `.ai-factory/RULES.md`
- Layer rules: `.ai-factory/ARCHITECTURE.md`

## Workflow

Before every commit / PR, run the gate this installer ships (unconditional — needs no extra install):

- `./scripts/audit-ai-docs.sh` — drift + code-vs-docs probes.
- the pre-push hook (`.husky/pre-push`) fires on `git push` (typecheck, `vitest related`, dependency-cruiser).
- CI gates the PR (`ci-success` required check) — the last-resort authority, independent of local tooling.

**If you use AI Factory (aif)** (not bundled by this installer) for non-trivial changes:

- `/aif-plan <task>` — create plan + branch
- `/aif-implement` — execute plan step-by-step with checkpoints
- `/aif-verify` — _if you use aif_, runs sub-agents over RULES.md + the audit-ai-docs probes. A convenience wrapper around the gate above, not a substitute for it.
- `/aif-fix <error>` — targeted fix
- `/aif-commit` — final commit + push

Don't bypass the pre-push hook / `./scripts/audit-ai-docs.sh` with `--no-verify`. If a rule is genuinely incompatible — discuss it, don't silently skip.

## NDA / security

<Project-specific security rules. Examples:>
- Never commit `.env*` files except `.env.example`.
- All secrets accessed via the secrets manager, never inline.
- PII fields: <list>. Encrypted at rest + in logs.
