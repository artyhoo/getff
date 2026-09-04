# Rules — automatically enforced after every /aif-implement

> **Authoritative for:** canonical R1–R11 rule list for the preset-react-native preset (consumer-customisable). Enforcement is multi-channel (earliest reachable channel wins): core ESLint rules at edit-time, pre-push `audit-ai-docs.react-native.sh`, and AI Factory's `rules-sidecar` (which reads this file at `.ai-factory/RULES.md` during `/aif-verify`).
> **NOT authoritative for:** project goal — see consumer's README.md.

These rules are enforced at the **earliest reachable channel**: core ESLint rules at edit-time,
`audit-ai-docs.react-native.sh` + `tsc`/tests at pre-push, and AI Factory's `rules-sidecar`
(which reads this file) at `/aif-verify`. Each rule has a corresponding automated check.
Bypass via `/aif-rules` (with rationale), never via `--no-verify`.

## Summary table

| Rule | Stack | Check |
|---|---|---|
| **R1 TypeScript hygiene** | all | `tsc --noEmit && eslint <files>` |
| **R2 Validation at boundaries** | all | ESLint `no-unsafe-zod-parse` or manual |
| **R3 Architectural boundaries** | all | `npm run arch:check` (if dependency-cruiser configured) |
| **R4 Tests for new public code** | all | `scripts/audit-r4.ts` or manual review |
| **R5 Async correctness** | all | ESLint `@typescript-eslint/no-floating-promises` |
| **R6 Errors** | all | ESLint `no-throw-literal` |
| **R7 Time, randomness, IO** | all | ESLint `no-direct-time-randomness` (opt-in) |
| **R8 Observability** | all | ESLint `require-otel-span` (opt-in) |
| **R9 Imports / dependencies** | all | ESLint `no-restricted-imports` |
| **R10 Naming** | all | Manual review |
| **R11 CI integrity** | all | `ci.yml (lint/typecheck/test/security/audit-ai-docs → ci-success aggregate)` |

## R1 — TypeScript hygiene

- No `as any`. If type is genuinely unknown, use `unknown` and narrow.
- No non-null assertions (`!`). Use type guards or proper narrowing.
- No `// @ts-ignore`. Use `// @ts-expect-error` with description (≥10 chars).
- All function signatures fully typed.
- `import type` for type-only imports.

**Check:** `tsc --noEmit && eslint <files>`

## R2 — Validation at boundaries

**Policy:** `.parse()` is forbidden in network/IPC boundary code. Use `.safeParse()` and branch on `.success`. A `.parse()` whose argument is a **fully-static literal** (e.g. `ConfigSchema.parse({ port: 3000 })`) is **not** flagged — no external input can flow through it, so a throwing parse is deliberate fail-fast.

**Check:** ESLint `rules-as-tests/no-unsafe-zod-parse` (where wired) or manual sidecar review.

## R3 — Architectural boundaries

- No circular imports.
- Module boundaries respected per project structure.
- No `../../../` chains across feature boundaries.

**Check:** `npm run arch:check` (dependency-cruiser, if configured).

## R4 — Tests for new public code

- Every new public export needs at least one test.
- Tests contain real assertions (not just `toBeDefined()` for typed values).

**Check:** `scripts/audit-r4.ts` or manual review.

## R5 — Async correctness

- All Promises either `await`ed or explicitly handled with `.catch()`.
- No floating promises.

**Check:** ESLint `@typescript-eslint/no-floating-promises`.

## R6 — Errors

- No `throw 'string'`. Always throw an Error subclass.
- No empty `catch (_)` blocks.

**Check:** ESLint `no-throw-literal` + `no-useless-catch`.

## R7 — Time, randomness, IO

- No `Date.now()`, `new Date()`, `Math.random()` outside the infrastructure layer (opt-in).

**Check:** ESLint `no-direct-time-randomness` when `AIF_STRICT_RUNTIME=1`.

## R8 — Observability

- Public application commands/queries open an OTel span (opt-in).

**Check:** ESLint `require-otel-span` when `AIF_STRICT_RUNTIME=1`.

## R9 — Imports / dependencies

- No `lodash`, `moment`, `axios` without justification.
- New top-level dependency requires explicit rationale.

**Check:** ESLint `no-restricted-imports`.

## R10 — Naming

- Components: PascalCase. Functions/variables: camelCase. Constants: SCREAMING_SNAKE.
- Files match exported symbol.

**Check:** Manual review.

## R11 — CI integrity

- `ci.yml` has a `ci-success` aggregate job that is the only required check.
- Actions pinned to commit SHA (zizmor-enforced).

**Check:** `github-actions-ci-ui.yml` structure review.

---

## How violations are handled

1. AI Factory's `rules-sidecar` flags the violation in `/aif-verify` output.
2. `/aif-fix` is invoked automatically on flagged items.
3. If the rule is genuinely incompatible — `/aif-rules` to discuss updating (with rationale), not to silently bypass.

## Push channel (pre-push) — thin by contract

The pre-push hook is a **thin** channel for a consumer: it does **not** re-run per-file lint. Per-file lint is enforced at the earliest reachable channel — edit-time ESLint and the pre-commit `lint-staged` gate — so re-running it at push would be a slower, redundant duplicate that also risks blocking a push over a pre-existing issue in an unrelated touched file.

What the push channel *does* run is framework **enforcement-integrity** that per-file pre-commit cannot see: rule-glob liveness (an active rule whose globs match zero files), lint-staged binary resolution, and offline link integrity on Markdown *changed in this push*. **On the TS-core channel** (Node ≥20 with `tsx` resolvable) it does **not** run the framework's workflow-**security** scanners (actionlint / zizmor / action-pinning) over your own workflows, so a clean-tree `git push` is **allowed** and your first `git push` is never blocked over pre-existing `@v6` action refs — that workflow-security linting is **out of the framework's scope** (neither this hook nor any shipped CI template runs it; add it to your own CI if you want it). It *does* apply one narrow, deterministic, no-tool check to your `.github/workflows/*.yml`: the `ci-tool-pinning.md §2` Rule A scan flags an **un-pinned bare** `run: pip install <pkg>` or `npm install -g <pkg>` (fix: add a version pin, e.g. `pip install <pkg>==<ver>`, or the escape hatch `# ci-tool-pin: allow <reason>`). Per §2 that workflow scan runs on framework and consumer repos alike; the framework's shell-script pinning scan stays framework-only, so your own scripts are not gated. A shipped-rule violation is blocked at edit-time + pre-commit + `npx eslint .`, with CI the backstop for a deliberate `git commit --no-verify` bypass. **Reduced-fallback caveat:** if Node <20 or `tsx` is unresolvable (some pnpm-monorepo layouts where `tsx` lives in a sub-package), the hook degrades to a bash critical-only fallback that additionally requires a `Prior-art:` trailer on commits after 2026-05-12 — a framework authoring-discipline gate not yet scoped to a consumer layout (known-open gap), so the thin-channel guarantee above holds on the TS-core channel. (Structure: the owner-tagged section registry in `packages/core/hooks/pre-push.ts`.)

## Rule maintenance

- Each rule has a measurable check. If the check is missing — the rule is a wish, not a rule.
- Rules are added through PR with rationale.
- Rules are deleted only with explicit ADR documenting why.
