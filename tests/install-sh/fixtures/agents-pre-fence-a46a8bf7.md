# AGENTS.md — context for AI coding agents

> Read this file at the start of every session. It points to the source of truth for project rules and workflow.
> Universal format read by Claude Code (CLAUDE.md fallback), Codex CLI, Cursor, Windsurf, Roo Code, and others.

## What this project is

See `.ai-factory/DESCRIPTION.md` for full project context — domain, stack, constraints, non-goals.

## Project rules (enforced by lint, tests, CI, audit-ai-docs)

See `.ai-factory/RULES.md` for full rule list (R1–R20). Quick reference:

- **R1** TypeScript hygiene — no `as any`, no `!`, no `enum`.
- **R2** Validation at boundaries — Zod at every external input.
- **R3** Architectural boundaries — domain → application → infrastructure (one direction).
- **R4** Tests for new public code — every export tested with real assertion.
- **R5** Async correctness — no floating promises.
- **R6** Errors — Error subclasses only, structured.
- **R7** Time/randomness/IO injected via interfaces.
- **R8** Observability — OTel spans on public commands/queries.
- **R9** Imports — banned: lodash, moment, axios.
- **R10** Naming — by location and convention.
- **R11** CI integrity — `ci-success` is required check.

For React/Next projects, also R12–R20 (see `.ai-factory/RULES.react-next.md`).

For microservices, also IR1–IR6 (see `.ai-factory/rules/integration-rules.md`).

## Architecture

See `.ai-factory/ARCHITECTURE.md` for layer structure, dependency direction, forbidden patterns.

For React/Next projects: also `.ai-factory/ARCHITECTURE.react-next.md` (Server vs Client boundary, etc.)

## Workflow

This project uses **AI Factory (aif)** for spec-driven development.

### Required commands

- **`/aif-explore <task>`** — when scope is unclear. Saves research to `.ai-factory/RESEARCH.md`.
- **`/aif-plan <task>`** — for any non-trivial change. Creates branch, writes plan to `.ai-factory/plans/`.
- **`/aif-implement`** — execute plan step by step with checkpoints.
- **`/aif-verify`** — **required before commit.** Runs `best-practices-sidecar`, `review-sidecar`, `docs-auditor` over RULES.md and audit-ai-docs.sh probes.
- **`/aif-fix <error>`** — targeted bug fix. Reads the plan, knows exactly what was intended.
- **`/aif-commit`** — final commit, groups checkpoint commits, pushes.

### Forbidden

- `git commit --no-verify` — bypassing pre-commit/pre-push hooks.
- `git push -f` to `main`.
- Skipping `/aif-verify` before PR.
- Adding rules to AGENTS.md / RULES.md without a measurable check.

## Skills available

The following skills auto-activate on relevant queries:

- **`rules-as-tests`** — five-layer framework (architecture / meta-tests / spec by example / mutation / living docs). Auto-triggers on questions about ESLint, Stryker, Pact, dependency-cruiser, AI-driven code drift.

Add additional project skills here as you create them. Don't list a skill until its file is committed (see ai-traps.md, lesson #2).

## Sub-agents (Claude Code)

Loaded by AI Factory in `.claude/agents/`:

- **`best-practices-sidecar`** — validates code against RULES.md after each `/aif-implement`. Reports violations.
- **`review-sidecar`** — two-AI tautology review. Reads tests as if external reviewer with no memory of how they were written.
- **`docs-auditor`** — runs `scripts/audit-ai-docs.sh` (drift detection + code-vs-docs probes). Interprets PASS/FAIL.

## Test commands

```bash
npm run test                    # vitest run (unit + audit tests)
npm run test:watch              # vitest watch mode
npm run test:coverage           # with coverage thresholds
npm run test:integration        # *.integration.ts files (real DB)
npm run test:mutation           # Stryker incremental
npm run test-storybook          # Storybook test runner (UI projects)
npx playwright test             # E2E (UI projects)
```

## Validate everything

```bash
npm run validate                # lint + typecheck + format:check + arch:check + test
./scripts/audit-ai-docs.sh     # drift + code-vs-docs probes (~10 sec)
```

## Stack constraints (enforced)

- TypeScript strict + `noUncheckedIndexedAccess`.
- Node.js version pinned in `.nvmrc` — CI depends on it.
- ESLint 10 flat config — see `eslint.config.mjs`.
- Mutation kill rate ≥70% on PR diff (Stryker incremental).
- Coverage thresholds per-module (see `vitest.config.ts`).
- Architecture rules in `.dependency-cruiser.cjs` — fail on violation.

## Files NOT to edit without explicit reason

- `.ai-factory/RULES.md` — rules are added/changed via PR with rationale, not silently.
- `.dependency-cruiser.cjs` — same.
- `eslint.config.mjs` — same.
- `.github/workflows/ci.yml` — same.
- `scripts/audit-ai-docs.sh` — additions need a paired negative test (see references/self-testing-docs.md).

## Quick reminders

- **Skills are declared after they exist, not before.** See `references/ai-traps.md` lesson #2.
- **`_comment_TODO` never goes into JSON config files.** Use issue tracker.
- **Trigger keywords are a namespace** — manage them like usernames. See lesson #7.
- **Every rule has a measurable check** — or it's not a rule.

---

For long-form architectural details, see `.ai-factory/ARCHITECTURE.md`.
For current sprint plan, see `.ai-factory/plans/`.
