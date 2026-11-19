# Architecture — server-side TypeScript

> Layer rules and dependency direction. Enforced by `dependency-cruiser`.
> For React/Next.js projects, see `ARCHITECTURE.react-next.md` instead.
>
> Drop into `.ai-factory/ARCHITECTURE.md` and override only what your project needs. For React/Next.js projects, see `ARCHITECTURE.react-next.md`.
>
> **Authoritative for:** hexagonal layer structure and dependency direction template for server-side TypeScript projects (consumer-customisable).
> **NOT authoritative for:** project goal — see consumer's README.md.

## Layer structure (hexagonal / clean)

```text
src/
├── domain/             # Pure business logic. Stdlib + Zod ONLY.
│   ├── entities/
│   ├── value-objects/
│   └── events/
├── application/        # Use cases / orchestration.
│   ├── commands/
│   ├── queries/
│   └── ports/          # Interfaces for external dependencies.
├── infrastructure/     # Implementations of ports.
│   ├── persistence/    # Repository implementations.
│   ├── http/           # External HTTP clients.
│   ├── messaging/      # Queue producers/consumers.
│   ├── clock/          # Time injection.
│   └── random/         # Random injection.
├── web/                # Inbound HTTP layer.
│   ├── handlers/
│   └── contracts/      # Zod schemas for HTTP requests/responses.
└── config/
    └── env.ts          # Zod-validated env parsing.
```

## Dependency rules (enforced by dependency-cruiser)

- `domain/` → nothing project-internal (only stdlib + Zod)
- `application/` → `domain/` only (talks to infra via `application/ports/`)
- `infrastructure/` → `application/ports/` + `domain/`
- `web/` → `application/` + `web/contracts/`
- No cycles between modules
- No cross-feature imports — features go through their `index.ts` only
- No imports from devDependencies in production code

## Test structure

Tests live next to source files (no `__tests__/` folder). Suffix indicates kind:

| Kind               | Suffix            | Example                                        | Run by                                             |
| ------------------ | ----------------- | ---------------------------------------------- | -------------------------------------------------- |
| Unit               | `.unit.ts`        | `src/domain/order.unit.ts`                     | `vitest run`                                       |
| Integration        | `.integration.ts` | `src/infrastructure/order-repo.integration.ts` | `vitest run --config vitest.integration.config.ts` |
| Audit (rule check) | `.audit.ts`       | `tests/audit/agents-md.audit.ts`               | `vitest run`                                       |

Files without these suffixes are not considered tests — meta-tests will flag any that look like tests but aren't named correctly.

## Forbidden patterns

- `enum` declarations — use `as const` objects or `z.enum`.
- `Date.now()`, `new Date()` in `src/` (except `infrastructure/clock/`) — inject Clock.
- `Math.random()` in `src/` (except `infrastructure/random/`) — inject Random.
- Direct `fs`, `http`, `https` imports in `domain/` or `application/`.
- Mutable global state (`let` at module top level outside `config/`).
- Default exports (only named).
- Field injection / service locators.

## Observability requirements

- Every public `application/` command/query opens an OTel span via `tracer.startActiveSpan(...)`.
- Span attributes include: `user.id`, `request.id`, active feature flags, business outcome.
- All errors logged with structured context (never bare error strings).
- Errors set span status with structured `cause`.

## Rules of communication between modules

- Application calls infrastructure **through ports** (interfaces in `application/ports/`).
- Infrastructure implements ports — no direct imports of infra from application.
- Cross-feature communication happens through public `index.ts` (Feature-Sliced Design).
- Domain events emitted by domain layer, consumed by application; infrastructure can publish to external queues.

## Where rules are enforced

| Rule                               | Enforced by                                                                 |
| ---------------------------------- | --------------------------------------------------------------------------- |
| No cycles                          | dependency-cruiser                                                          |
| Layer direction                    | dependency-cruiser                                                          |
| No `as any`                        | ESLint `@typescript-eslint/no-explicit-any` + `audit-ai-docs.sh` probe `R1` |
| No `Date.now()` outside infra      | ESLint `no-restricted-syntax` + `audit-ai-docs.sh` probe `R7`               |
| No forbidden imports               | ESLint `no-restricted-imports` + `audit-ai-docs.sh` probe `R9`              |
| OTel span on application functions | `audit-ai-docs.sh` probe `R8`                                               |
| Tests for new public exports       | `audit-ai-docs.sh` probe `R4`                                               |

See `.ai-factory/RULES.md` for full list R1–R11.
