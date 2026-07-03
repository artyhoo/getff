# Rules — automatically enforced after every /aif-implement

> **Authoritative for:** canonical R1–R11 rule list for the preset-next-15 preset (consumer-customisable). Enforcement is multi-channel (earliest reachable channel wins): edit-time custom ESLint rules, pre-push `audit-ai-docs.sh`, and AI Factory's `rules-sidecar` (which reads this file at `.ai-factory/RULES.md` during `/aif-verify`).
> **NOT authoritative for:** project goal — see consumer's README.md.

These rules are enforced at the **earliest reachable channel**: custom ESLint rules at
edit-time, `audit-ai-docs.sh` + `tsc`/`depcruise`/tests at pre-push, and AI Factory's
`rules-sidecar` (which reads this file) at `/aif-verify`. Each rule has a corresponding
automated check. Bypass via `/aif-rules` (with rationale), never via `--no-verify`.

## Summary table

> Generated from `factory/rules-manifest.json` by `scripts/render-rules.ts`. Do not edit by hand.

<!-- begin: rules-table-generated -->
| Rule | Stack | Check |
|---|---|---|
| **R1 TypeScript hygiene** | ts-server, react-next | `tsc --noEmit && eslint <files>` |
| **R2 Validation at boundaries** | ts-server, react-next | ESLint `rules-as-tests/no-unsafe-zod-parse` |
| **R3 Architectural boundaries** | ts-server, react-next | `npm run arch:check` |
| **R4 Tests for new public code** | ts-server, react-next | `scripts/audit-r4.ts` |
| **R5 Async correctness** | ts-server, react-next | ESLint `@typescript-eslint/no-floating-promises` |
| **R6 Errors** | ts-server, react-next | ESLint `no-throw-literal` |
| **R7 Time, randomness, IO** | ts-server, react-next | ESLint `rules-as-tests/no-direct-time-randomness` |
| **R8 Observability** | ts-server, react-next | ESLint `rules-as-tests/require-otel-span` |
| **R9 Imports / dependencies** | ts-server, react-next | ESLint `no-restricted-imports` |
| **R10 Naming** | ts-server, react-next | Manual review — Naming conventions are too project-specific to formalize reliably; sidecar runs ad-hoc grep on the diff. |
| **R11 CI integrity** | ts-server, react-next | `ci.yml (lint/typecheck/architecture/test/security/audit-ai-docs → ci-success aggregate) + workflow-integrity.yml (branch-protection-assertion)` |
| **R12 Server vs Client Components** | react-next | ESLint `rules-as-tests/no-server-imports-in-client` |
| **R13 Data fetching** | react-next | ESLint `no-restricted-syntax` |
| **R14 Forms** | react-next | ESLint `no-restricted-syntax` |
| **R15 Accessibility** | react-next | ESLint `jsx-a11y/strict` |
| **R16 Performance** | react-next | ESLint `@next/next/no-img-element` |
| **R17 Component tests** | react-next | `scripts/audit-ai-docs.react-next.sh` |
| **R18 TanStack Query / SWR** | react-next | ESLint `no-restricted-syntax` |
| **R19 Styles** | react-next | `depcruise --validate (blocks styled-components/@emotion)` |
| **R20 Server Actions** | react-next | ESLint `no-restricted-syntax` |
| **IR1 API contracts** | microservices | `CI job: zod-to-openapi diff against published OpenAPI` |
| **IR2 Consumer-driven contracts (Pact)** | microservices | `CI: pact-publish + pact-verify + can-i-deploy` |
| **IR3 Event schemas (async messaging)** | microservices | `audit-ai-docs.sh probe — `publish()` calls reference @org/event-schemas` |
| **IR4 Service-to-service auth** | microservices | `depcruise blocks bare fetch() to internal service URLs` |
| **IR5 Observability propagation** | microservices | Manual review — Trace propagation is hard to lint; verify in integration tests + Jaeger/Tempo dashboards. |
| **IR6 Resilience** | microservices | Manual review — Resilience patterns (retry, circuit breaker, timeout) verified by chaos tests in staging. |
<!-- end: rules-table-generated -->

## R1 — TypeScript hygiene

- No `as any` anywhere. If type is genuinely unknown, use `unknown` and narrow.
- No non-null assertions (`!`). Use type guards or proper narrowing.
- No `// @ts-ignore`. Use `// @ts-expect-error` with description (≥10 chars).
- All function signatures fully typed.
- `import type` for type-only imports.

**Check:** `tsc --noEmit && eslint <files>`

### Examples

```ts
// BAD
const x = data as any;
```

```ts
// GOOD
const x = data as unknown as User;
```

## R2 — Validation at boundaries

**Policy:** Zod schema `.parse()` is forbidden in HTTP boundary code. Use `.safeParse()` and branch on `.success`. Stdlib `.parse()` (`JSON.parse`, `Date.parse`, `path.parse`) is **not** flagged — the rule targets Zod schema `.parse()` only.

**Path-scoped enforcement:** the ESLint rule `rules-as-tests/no-unsafe-zod-parse` is enabled only for these globs (configured in `eslint.config.mjs`):

- `src/web/handlers/**`
- `src/app/actions/**`
- `src/app/api/**`

**Outside these paths** (e.g. `src/config/env.ts` startup code, tests, scripts) `.parse()` is allowed.

**Other boundaries also require validation** — use `.safeParse()` (no ESLint rule today — manual sidecar check):

- Message queue payloads on consume.
- DB row mappers against domain schemas.

**Escape hatch:** add `// audit:exempt` on the same line if `.parse()` is intentional in a scoped path.

**Check:** `npx eslint <changed>` — rule `rules-as-tests/no-unsafe-zod-parse`.

### Examples

```ts
// BAD
const body = OrderSchema.parse(req.body); // in handler
```

```ts
// GOOD
const r = OrderSchema.safeParse(req.body);
if (!r.success) return reply.code(400).send(r.error.flatten());
```

## R3 — Architectural boundaries

- Domain code imports only stdlib and Zod.
- No imports from `infrastructure/` in `application/` (except via `application/ports/`).
- No imports from `web/` outside `web/`.
- Features (`src/features/<name>/`) communicate only through public `index.ts`.

**Check:** `npm run arch:check` (dependency-cruiser)

### Examples

```ts
// BAD
// in src/domain/order.ts:
import { db } from '../infrastructure/db';
```

```ts
// GOOD
// in src/application/place-order.ts:
import type { OrderRepo } from './ports/order-repo';
```

## R4 — Tests for new public code

- Every new public export needs at least one test.
- Tests MUST contain at least one real assertion (not `toBeDefined()` for typed values).
- No conditional logic (`if`/`for`/`while`) in test bodies — use `it.each` for variants.
- For state machines / numeric thresholds: parameterized tests covering boundaries.
- For pure functions with general invariants: at least one fast-check property.

**Check:** `scripts/audit-r4.ts` (ts-morph) — every export in `src/domain/**/*.ts` has matching `.unit.ts` that references the export name. Plus `vitest related <changed>` for actual test execution.

### Examples

```ts
// BAD
export function isAdult(age: number) {
  return age >= 18;
} // no test
```

```ts
// GOOD
// + isAdult.unit.ts:
it('returns true for >= 18', () => {
  expect(isAdult(18)).toBe(true);
});
```

## R5 — Async correctness

- All Promises either `await`ed or explicitly handled with `.catch()`.
- No floating promises in production code.
- No mixing `await` and `.then()` in the same function.

**Check:** `eslint --rule '@typescript-eslint/no-floating-promises:error'`

### Examples

```ts
// BAD
function send(): void {
  fetch('/x');
}
```

```ts
// GOOD
async function send(): Promise<void> {
  await fetch('/x');
}
```

## R6 — Errors

- No `throw 'string'`. Always throw an Error subclass.
- No empty `catch (_)` blocks.
- Domain errors extend `DomainError`. Infrastructure errors extend `InfraError`.
- All HTTP error responses go through the central error mapper.

**Check:** ESLint rules `no-throw-literal` + `no-useless-catch`.

### Examples

```ts
// BAD
throw 'bad input';
```

```ts
// GOOD
throw new ValidationError('bad input', { cause: err });
```

## R7 — Time, randomness, IO

- No `Date.now()`, `new Date()`, `performance.now()` in `src/` (except `infrastructure/clock/`).
- No `Math.random()` (except `infrastructure/random/`).
- No direct `fs`, `http`, `https` imports outside `infrastructure/`.

**Check:** ESLint rule `rules-as-tests/no-direct-time-randomness` (layout-agnostic globs, ignores `**/infrastructure/**`).

**Opt-in (cih-s3 F7):** deferred by default — R7 needs an injected Clock/Random + an `infrastructure/` layer a fresh skeleton lacks. The shipped `eslint.config.mjs` enables it only when the environment sets `AIF_STRICT_RUNTIME=1`. Turn it on once those primitives exist.

### Examples

```ts
// BAD
const now = Date.now();
```

```ts
// GOOD
const now = clock.now(); // injected from infrastructure/clock
```

## R8 — Observability

- Public application commands/queries open an OTel span via the standard helper.
- Span attributes include: relevant business identifiers and active feature flags.
- Errors set span status with structured cause, never bare error strings.

**Check:** ESLint rule `rules-as-tests/require-otel-span` (layout-agnostic globs, e.g. `**/application/**`, `**/use-cases/**`).

**Opt-in (cih-s3 F7):** deferred by default — R8 needs an OpenTelemetry tracer a fresh skeleton lacks. The shipped `eslint.config.mjs` enables it only when the environment sets `AIF_STRICT_RUNTIME=1`. Turn it on once a tracer is wired.

### Examples

```ts
// BAD
export async function placeOrder(o) {
  return await save(o);
}
```

```ts
// GOOD
export async function placeOrder(o) {
  return tracer.startActiveSpan('placeOrder', () => save(o));
}
```

## R9 — Imports / dependencies

- No `lodash`, `moment`, `axios`, `request`, `node-fetch`. Use native fetch, date-fns, Zod.
- New top-level dependency requires explicit ADR in `docs/adr/`.
- No `* as` star imports except for namespaces (zod, ts).

**Check:** `eslint --rule 'no-restricted-imports:error'` + `git diff package.json` review.

### Examples

```ts
// BAD
import fs from 'fs'; // in src/domain/
```

```ts
// GOOD
// import only from stdlib + zod in domain
```

## R10 — Naming

- Classes: PascalCase. Functions/variables: camelCase. Constants: SCREAMING_SNAKE.
- Files match exported symbol: `OrderService.ts` exports `OrderService`.
- `*Repository` = interface in domain or application; impl in infrastructure.
- `*Service` lives in application or infrastructure, never in domain.
- `*Controller` only in web/.

**Check:** Manual review only — naming conventions are too project-specific to formalise reliably across stacks. AI Factory's `rules-sidecar` runs an ad-hoc grep against the diff (filename ↔ exported symbol; `*Repository`/`*Service`/`*Controller` placement) — this R10 check is delivered to `rules-sidecar` via the `.ai-factory/skill-context/aif-rules-check/SKILL.md` override (C-1 follow-up, SSOT #50), since `audit-ai-docs.sh` includes no probe for R10. If your project has a strict naming scheme, write a project-specific probe and a paired negative test.

### Examples

```ts
// BAD
// file: utils.ts containing only date helpers
```

```ts
// GOOD
// file: date-utils.ts
```

## R11 — CI integrity

- `.github/workflows/ci.yml` is generated by `/aif-ci` and customized by us.
- Any modification requires re-running tests on the change.
- The `ci-success` job must remain a required check on main.
- New jobs are added through PR with explicit rationale.

**Check:** two executable layers, both shipped by `install.sh`:

1. `.github/workflows/ci.yml` — every quality job (`lint`, `typecheck`, `architecture`, `test`, `security`, `audit-ai-docs`) is funnelled into the single required `ci-success` aggregate via `needs:`. `ci-success` is the only context that must be a required check (it always runs and depends on all jobs).
2. `.github/workflows/workflow-integrity.yml` — `branch-protection-assertion` job asserts the `ci-success` gate stays a required status check on the default protected branch. Tri-states: pass when configured-and-present, fail when configured-but-missing, warn-and-pass when no protection is configured (so it never blocks a fresh consumer).

> **Caveat — GitHub Free private repos:** classic branch protection AND rulesets both require GitHub Pro (or Team/Enterprise) on a _private_ repo — or making the repo public. On that plan `branches/*/protection` and `rulesets` return `403 Upgrade to GitHub Pro or make this repository public`, so the warn-and-pass branch is **permanent** and there is no consumer-side remediation. Treat R11 branch-protection as **unavailable** on a GitHub Free private repo, not "not yet adopted" — it activates automatically once the repo moves to a paid plan or becomes public. The `ci-success` aggregate (layer 1) still runs everywhere; only the protection _assertion_ is plan-gated.

Why one aggregate context: `needs:` aggregation works only within one workflow file, and a path-filtered required check (e.g. one scoped to `.github/workflows/**`) never reports on PRs that don't touch that path → the PR deadlocks. Requiring only `ci-success` (which always runs and `needs:` every job) avoids both.

### Examples

```yaml
# BAD
# in .github/workflows/ci.yml:
- uses: actions/checkout@main
```

```yaml
# GOOD
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
```

---

## How violations are handled

1. AI Factory's `rules-sidecar` flags the violation in `/aif-verify` output (and edit-time ESLint / pre-push `audit-ai-docs.sh` flag it earlier).
2. `/aif-fix` is invoked automatically on flagged items.
3. If the rule is genuinely incompatible with the task — `/aif-rules` to discuss
   updating the rule (with rationale), not to silently bypass it.

## Rule maintenance

- Each rule has a measurable check. If the check is missing — the rule is a wish, not a rule. Either implement the check or delete the rule.
- Rules are added through PR with rationale (which class of bugs it prevents).
- Rules are deleted only with explicit ADR documenting why.
- Aim to keep ~10–12 rules **active per validation pass**. The package ships R1–R11 (server) + R12–R20 (UI) + IR1–IR6 (microservices), but in any one project a subset is enabled — adjust `audit-ai-docs.sh` and your ESLint config to skip rules that don't apply. Past ~12 rules in a single pass the AI starts losing focus.
