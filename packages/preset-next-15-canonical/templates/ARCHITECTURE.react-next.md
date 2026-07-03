# Architecture — React 19 + Next.js 15 (App Router)

> Layer rules + Server/Client boundary. Enforced by `dependency-cruiser` + ESLint + `server-only`/`client-only` packages.
>
> **Authoritative for:** Feature-Sliced + hexagonal layer structure with Server/Client boundary for React 19 + Next.js 15 projects (consumer-customisable).
> **NOT authoritative for:** project goal — see consumer's README.md.

## Layer structure (Feature-Sliced + hexagonal)

```text
src/
├── app/                      # Next.js App Router
│   ├── (marketing)/          # Route group: landing, blog
│   ├── (app)/                # Route group: authenticated zone
│   ├── api/                  # Route handlers (server-only)
│   │   └── orders/route.ts
│   └── layout.tsx
├── domain/                   # Pure business types + schemas. Stdlib + Zod.
│   ├── entities/
│   ├── value-objects/
│   └── events/
├── application/              # Use cases. Server-side orchestration.
│   ├── commands/
│   ├── queries/
│   └── ports/
├── infrastructure/           # DB, external APIs, queues. server-only.
│   ├── persistence/
│   ├── http/
│   └── messaging/
├── features/                 # Feature-sliced. Each is self-contained.
│   └── checkout/
│       ├── ui/               # React components (client or server)
│       ├── lib/              # Utilities (universal)
│       ├── api/              # Server Actions / route handlers
│       ├── model/            # Zod schemas / types (universal)
│       └── index.ts          # Public API of the feature
├── shared/                   # Shared layer
│   ├── ui/                   # Reusable UI: Buttons, Inputs, Dialogs (shadcn/ui)
│   ├── lib/                  # cn(), date format helpers, etc.
│   ├── api/                  # fetch wrappers, API clients
│   └── config/
└── config/
    └── env.ts                # Zod-validated process.env
```

## Server vs Client — three zones

```text
┌────────────────────── server-only ──────────────────────┐
│                                                         │
│  domain/, application/, infrastructure/, app/api/       │
│  Contains secrets, DB, fs, network, Node API.           │
│  NEVER reaches the browser.                             │
│  Protected by `import 'server-only'` in entry files.    │
│                                                         │
└─────────────────────────────────────────────────────────┘
              ↓ Server Components by default
┌────────────────────── universal ────────────────────────┐
│                                                         │
│  features/*/model/, features/*/lib/, shared/lib/        │
│  Pure code, runs on server AND client.                  │
│  No window/document/localStorage. No fs/http/secrets.   │
│                                                         │
└─────────────────────────────────────────────────────────┘
              ↓ 'use client' boundary
┌────────────────────── client-only ──────────────────────┐
│                                                         │
│  features/*/ui/ (interactive), shared/ui/               │
│  'use client' directive at top.                         │
│  useState, useEffect, event handlers, browser APIs.     │
│  CANNOT import server-only modules.                     │
│  Marked with `import 'client-only'` if uses browser APIs│
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Server vs Client rules

- **Default = Server Component**. Components are server-side unless marked `'use client'`.
- **`'use client'` only when interactive**: useState/useEffect/useReducer/useRef/onClick/browser API.
- **Server Components don't import Client Components with side effects**. They can _render_ them (children).
- **Client Components don't import server-only modules** — env-secrets, fs, db. Enforced by `server-only` package + ESLint.
- **Route handlers** (`app/api/route.ts`) are server-only.
- **Server Actions** start with `'use server'`. Validated by Zod. Return `{ ok: true, data } | { ok: false, error }`.

## Dependency rules

- `domain/` → stdlib + Zod only
- `application/` → `domain/` + `application/ports/`
- `infrastructure/` → `application/ports/` + `domain/` (server-only)
- `app/api/` → `application/` + `infrastructure/` (server-only)
- `app/(routes)/page.tsx` Server Components → `application/` + `infrastructure/`
- `app/(routes)/page.tsx` Client Components → `features/*/index.ts` + `shared/ui/` only
- `features/<f>/ui/` → its own `model/`, `lib/`, plus `shared/ui/`, `shared/lib/`
- No cross-feature imports outside `features/<other>/index.ts`

## Test structure

```text
src/components/CyberButton/
├── CyberButton.tsx
├── CyberButton.module.css
├── CyberButton.unit.ts            # unit/component test
├── CyberButton.stories.tsx        # Storybook (incl. play functions)
└── CyberButton.e2e.ts             # Playwright (visual + behavioural)

src/hooks/
├── useClock.ts
└── useClock.unit.ts

src/lib/
├── audit-rules.ts
└── audit-rules.audit.ts            # tests of the rule-checker itself
```

| Kind                    | Suffix            | Tool                  |
| ----------------------- | ----------------- | --------------------- |
| Unit / hook test        | `.unit.ts`        | Vitest + jsdom        |
| Integration test        | `.integration.ts` | Vitest                |
| Audit (rule checker)    | `.audit.ts`       | Vitest                |
| Storybook play function | in `.stories.tsx` | Storybook test runner |
| E2E / visual            | `.e2e.ts`         | Playwright            |

## Forbidden patterns

- `<a href="/internal">` — use `<Link>` from `next/link`.
- `<img>` — use `<Image>` from `next/image`.
- `useEffect(() => fetch(...))` for data-fetching — use Server Components or TanStack Query.
- `'use client'` in file with no interactivity.
- Global `<style>` tags — use Tailwind utilities or CSS Modules.
- CSS-in-JS (`styled-components`, `@emotion`) — incompatible with RSC.
- `getServerSideProps` — Pages Router only, not App Router.
- `fireEvent.click(...)` in tests — use `userEvent.click(...)`.
- `screen.getByTestId(...)` when `getByRole(...)` works.

## Observability

- Server Components and Server Actions instrumented with OpenTelemetry.
- Span attributes include: `user.id`, `request.id`, `feature.<name>` for each active feature flag.
- Client-side errors → reported via Sentry / OTel browser SDK.
- Web Vitals reported automatically (Next.js built-in).

## Where rules are enforced

| Rule                                     | Enforced by                                                                               |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| No cycles                                | dependency-cruiser                                                                        |
| Server/Client boundary                   | `server-only`/`client-only` packages + ESLint + `audit-ai-docs.react-next.sh` probe `R12` |
| `<Link>` for internal                    | `@next/next/no-html-link-for-pages` + probe `R16b`                                        |
| `<Image>` for images                     | `@next/next/no-img-element` + probe `R16a`                                                |
| `<button>` not `<div onClick>`           | `jsx-a11y/no-static-element-interactions` + probe `R15`                                   |
| Component has stories                    | probe `R17` (WARN)                                                                        |
| Server Action has 'use server'           | probe `R20`                                                                               |
| Server Action validates FormData via Zod | probe `R14`                                                                               |
| No `screen.debug()`                      | `testing-library/no-debugging-utils` + probe `R20` (subset)                               |
| useEffect deps                           | `react-hooks/exhaustive-deps: 'error'` (manual review)                                    |

See `.ai-factory/RULES.react-next.md` for R12–R20.
