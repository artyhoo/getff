# Rules — automatically enforced after every /aif-implement

> **Authoritative for:** canonical R1–R11 rule list for the preset-react-spa preset (consumer-customisable). Enforcement is multi-channel (earliest reachable channel wins): edit-time custom ESLint rules, pre-push `audit-ai-docs.sh`, and AI Factory's `rules-sidecar` (which reads this file at `.ai-factory/RULES.md` during `/aif-verify`).
> **NOT authoritative for:** project goal — see consumer's README.md. SPA-specific rules (R-SPA-*) — see `RULES.react-spa.md`.

These rules are enforced at the **earliest reachable channel**: custom ESLint rules at
edit-time, `audit-ai-docs.sh` + `tsc`/tests at pre-push, and AI Factory's
`rules-sidecar` (which reads this file) at `/aif-verify`. Each rule has a corresponding
automated check. Bypass via `/aif-rules` (with rationale), never via `--no-verify`.

## Summary table

| Rule | Check |
|---|---|
| **R1 TypeScript hygiene** | `tsc --noEmit && eslint <files>` |
| **R2 Validation at boundaries** | ESLint `rules-as-tests/no-unsafe-zod-parse` |
| **R3 Architectural boundaries** | `npm run arch:check` (dependency-cruiser + eslint-plugin-boundaries) |
| **R4 Tests for new public code** | `scripts/audit-r4.ts` |
| **R5 Async correctness** | ESLint `@typescript-eslint/no-floating-promises` |
| **R6 Errors** | ESLint `no-throw-literal` |
| **R7 Time, randomness, IO** | ESLint `rules-as-tests/no-direct-time-randomness` (opt-in via `AIF_STRICT_RUNTIME=1`) |
| **R8 Observability** | ESLint `rules-as-tests/require-otel-span` (opt-in via `AIF_STRICT_RUNTIME=1`) |
| **R9 Imports / dependencies** | ESLint `no-restricted-imports` |
| **R10 Naming** | Manual review — sidecar runs ad-hoc grep on the diff |
| **R11 CI integrity** | `ci.yml (lint/typecheck/architecture/test/security/audit-ai-docs → ci-success aggregate)` |

## R1 — TypeScript hygiene
- No `as any` anywhere. If type is genuinely unknown, use `unknown` and narrow.
- No non-null assertions (`!`). Use type guards or proper narrowing.
- No `// @ts-ignore`. Use `// @ts-expect-error` with description (≥10 chars).
- All function signatures fully typed.
- `import type` for type-only imports.

**Check:** `tsc --noEmit && eslint <files>`

## R2 — Validation at boundaries

**Policy:** `.parse() is forbidden` in API boundary code. Use `.safeParse()` and branch on `.success`. A `.parse()` whose argument is a **fully-static literal** (e.g. `ConfigSchema.parse({ port: 3000 })`) is **not** flagged — no external input can flow through it, so a throwing parse is deliberate fail-fast.

**Path-scoped enforcement:** the ESLint rule `rules-as-tests/no-unsafe-zod-parse` is enabled only for these globs (configured in `eslint.config.mjs`):
- `src/features/*/api/**`
- `src/shared/api/**`
- `src/infrastructure/http/**`

**Escape hatch:** add `// audit:exempt` on the same line if `.parse()` is intentional.

**Check:** `npx eslint <changed>` — rule `rules-as-tests/no-unsafe-zod-parse`.

## R3 — Architectural boundaries
- Domain code imports only stdlib and Zod.
- No imports from `infrastructure/` in `application/` (except via `application/ports/`).
- No imports from `infrastructure/` in `features/*/ui/` (presentation layer).
- Features communicate only through their public `index.ts`.

**Check:** `npm run arch:check` (dependency-cruiser + eslint-plugin-boundaries)

## R4 — Tests for new public code
- Every new public export needs at least one test.
- Tests MUST contain at least one real assertion (not `toBeDefined()` for typed values).
- No conditional logic (`if`/`for`/`while`) in test bodies — use `it.each` for variants.

**Check:** `scripts/audit-r4.ts` + `vitest related <changed>`

## R5 — Async correctness
- All Promises either `await`ed or explicitly handled with `.catch()`.
- No floating promises in production code.

**Check:** `eslint --rule '@typescript-eslint/no-floating-promises:error'`

## R6 — Errors
- No `throw 'string'`. Always throw an Error subclass.
- No empty `catch (_)` blocks.

**Check:** ESLint rules `no-throw-literal` + `no-useless-catch`.

## R7 — Time, randomness, IO
- No `Date.now()`, `new Date()`, `performance.now()` in `src/` (except `infrastructure/`).
- No `Math.random()` (except `infrastructure/`).

**Check:** ESLint rule `rules-as-tests/no-direct-time-randomness` (opt-in via `AIF_STRICT_RUNTIME=1`)

## R8 — Observability
- Public application commands/queries open an OTel span via the standard helper.

**Check:** ESLint rule `rules-as-tests/require-otel-span` (opt-in via `AIF_STRICT_RUNTIME=1`)

## R9 — Imports / dependencies
- No `lodash`, `moment`, `axios`, `request`, `node-fetch`. Use native fetch, date-fns, Zod.
- New top-level dependency requires explicit ADR in `docs/adr/`.

**Check:** `eslint --rule 'no-restricted-imports:error'`

## R10 — Naming
- Classes: PascalCase. Functions/variables: camelCase. Constants: SCREAMING_SNAKE.
- Files match exported symbol: `OrderService.ts` exports `OrderService`.

**Check:** Manual review — naming conventions are too project-specific to formalise reliably across stacks. AI Factory's `rules-sidecar` runs an ad-hoc grep against the diff.

## R11 — CI integrity
- `ci.yml` is generated by `/aif-ci` and customized by us.
- The `ci-success` job must remain a required check on main.

**Check:** `ci.yml` aggregate via `ci-success` job (`needs:` all quality jobs).

---

## How violations are handled

1. AI Factory's `rules-sidecar` flags the violation in `/aif-verify` output (and edit-time ESLint / pre-push `audit-ai-docs.sh` flag it earlier).
2. `/aif-fix` is invoked automatically on flagged items.
3. If the rule is genuinely incompatible with the task — `/aif-rules` to discuss updating the rule (with rationale), not to silently bypass it.

## Push channel (pre-push) — thin by contract

The pre-push hook is a **thin** channel for a consumer: it does **not** re-run per-file lint. Per-file lint is enforced at the earliest reachable channel — edit-time ESLint and the pre-commit `lint-staged` gate — so re-running it at push would be a slower, redundant duplicate that also risks blocking a push over a pre-existing issue in an unrelated touched file.

What the push channel *does* run is framework **enforcement-integrity** that per-file pre-commit cannot see: rule-glob liveness (an active rule whose globs match zero files), lint-staged binary resolution, and offline link integrity on Markdown *changed in this push*. **On the TS-core channel** (Node ≥20 with `tsx` resolvable) it does **not** run the framework's workflow-**security** scanners (actionlint / zizmor / action-pinning) over your own workflows, so a clean-tree `git push` is **allowed** and your first `git push` is never blocked over pre-existing `@v6` action refs — that workflow-security linting is **out of the framework's scope** (neither this hook nor any shipped CI template runs it; add it to your own CI if you want it). It *does* apply one narrow, deterministic, no-tool check to your `.github/workflows/*.yml`: the `ci-tool-pinning.md §2` Rule A scan flags an **un-pinned bare** `run: pip install <pkg>` or `npm install -g <pkg>` (fix: add a version pin, e.g. `pip install <pkg>==<ver>`, or the escape hatch `# ci-tool-pin: allow <reason>`). Per §2 that workflow scan runs on framework and consumer repos alike; the framework's shell-script pinning scan stays framework-only, so your own scripts are not gated. A shipped-rule violation is blocked at edit-time + pre-commit + `npx eslint .`, with CI the backstop for a deliberate `git commit --no-verify` bypass. **Reduced-fallback caveat:** if Node <20 or `tsx` is unresolvable (some pnpm-monorepo layouts where `tsx` lives in a sub-package), the hook degrades to a bash critical-only fallback that additionally requires a `Prior-art:` trailer on commits after 2026-05-12 — a framework authoring-discipline gate not yet scoped to a consumer layout (known-open gap), so the thin-channel guarantee above holds on the TS-core channel. (Structure: the owner-tagged section registry in `packages/core/hooks/pre-push.ts`.)

## Rule maintenance

- Each rule has a measurable check. If the check is missing — the rule is a wish, not a rule.
- Rules are added through PR with rationale (which class of bugs it prevents).
- Rules are deleted only with explicit ADR documenting why.
