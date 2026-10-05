# <PROJECT_NAME>

> Replace placeholders below. This file is loaded by every AI agent at session start.
> Keep ≤150 lines. Cold content goes to `.claude/skills/` and `.claude/rules/`.
>
> **Authoritative for:** consumer-project description template — domain / stack / constraints / non-goals scaffolding.
> **NOT authoritative for:** project goal — see consumer's README.md.

## What it is

<One-paragraph project description. Domain, primary users, core value proposition.>

## Stack

Replace these npm starter defaults with the actual installed stack and tools, including Python native tooling where applicable.

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

The following are npm starter examples. Replace every example and default with this project's actual stack, validation, test and native gate constraints; they are not mandatory Python policies.

After replacing the examples, record which constraints the installed lint/test/CI gates actually enforce.

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
- Installed rule list (npm R1–R20 or lane-native rules): `.ai-factory/RULES.md`
- Layer rules: `.ai-factory/ARCHITECTURE.md`

## Workflow

Before every commit / PR, run the gates for the layer actually installed. Toolchain lanes use the native checks in `.ai-factory/AI-USAGE-GUIDE.md` §2.4 when that guide is delivered (Python); cargo/Go use the delivered native configs and install log. Missing tools or kept hooks mean enforcement is not proven. The following audit and Husky gates belong to npm stack layers:

- `./scripts/audit-ai-docs.sh` — drift + code-vs-docs probes.
- the pre-push hook (`.husky/pre-push`) fires on `git push` — getff's own rule checks (rule-glob liveness, lint-staged resolution, generated-rule firing, command/script check liveness, changed-Markdown links), not your typecheck or tests.
- CI gates the PR (`ci-success` required check) — the last-resort authority, independent of local tooling.

For the lifecycle past install — First Steps per install depth, the daily cycle, and what degrades when a capability is absent — see `.ai-factory/AI-USAGE-GUIDE.md`.

Don't bypass an installed native or npm gate with `--no-verify`. If a rule is genuinely incompatible — discuss it, don't silently skip.

## NDA / security

<Project-specific security rules. Examples:>
- Never commit `.env*` files except `.env.example`.
- All secrets accessed via the secrets manager, never inline.
- PII fields: <list>. Encrypted at rest + in logs.
