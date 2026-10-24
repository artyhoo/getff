# Framework context and vocabulary

> **Authoritative for:** the scoped framework context and vocabulary detail routed from [the skill card](../SKILL.md).
> **NOT authoritative for:** skill activation, shared gates, or project goal; those remain with the card and its declared owners.

## Universal AI angle

The strongest case for this entire framework: **AI agents write plausible-looking code that violates undocumented conventions**. Without this skill's framework, every AI-generated PR risks introducing:

- `as any` / non-null assertions to bypass type errors
- Tautological tests (`expect(x).toBeDefined()` for typed values, `expect(mock).toHaveBeenCalled()` without behavioral assertion)
- Layer violations (controllers reaching into domain, domain importing infrastructure)
- New top-level dependencies (`lodash`, `moment`, `axios`) when the project standardized on alternatives
- `enum` declarations (deprecated in modern TS with `verbatimModuleSyntax`)
- Direct `Date.now()` / `Math.random()` / network in production code
- Missing `await` / floating promises
- Always-passing tests with `try/catch: pass`

Every one of these is caught by a specific automated rule from this skill's templates. There is no "be careful" instruction in `CLAUDE.md` that survives AI-driven development at scale — only enforced rules survive.

## Glossary of key terms

- **Fitness function** — an executable check that the system meets a non-functional requirement (Ford/Parsons/Kua, _Building Evolutionary Architectures_, 2017).
- **Specification by Example** — concrete input/output pairs as the spec (Gojko Adzic, 2011).
- **Living Documentation** — tests as the single source of truth (Cyrille Martraire, 2019).
- **Mutation testing** — introducing artificial bugs to verify tests detect them.
- **Two-AI review** — one model writes code/tests, a different model reviews them without context (Senko Rašić workflow).
- **Consumer-driven contracts (CDC)** — consumer of a service writes the contract; provider verifies it (Pact, Ian Robinson, 2006).
- **Error budget** — the allowed amount of unreliability over a window. SLO = 99.95% → budget = 0.05% over 28 days.
- **Observability 2.0** — wide events with high cardinality replacing static dashboards (Charity Majors, Honeycomb).
- **`can-i-deploy`** — Pact Broker query: "can this version be deployed without breaking deployed consumers?"
- **`/aif-verify`** — a pre-PR command belonging to the EXTERNAL AI Factory tool, which this installer does not bundle. Listed here as vocabulary you may meet in the wild, not as a step in this project's gate; the shipped gate is `./scripts/audit-ai-docs.sh` + pre-push + CI.

## Connecting to broader practice

The framework integrates with:

- **AI Factory (aif)** — a separate Claude Code workflow tool, **not bundled by this installer**. Where a consumer already runs it, its `rules-sidecar` reads our `.ai-factory/RULES.md` and our review content reaches its `review-sidecar` through the `aif-review` skill-context override — that integration seam is why the `.ai-factory/` file convention exists. Using the tool is never a prerequisite for anything this framework enforces.
- **GitHub Actions / GitLab CI** — required `ci-success` job as the merge gate.
- **OpenTelemetry** — instrumentation for shift-right SLOs and observability.
- **OpenSLO + Pyrra/Sloth** — declarative SLOs as code, compiled to Prometheus rules.
- **Pact Broker / Pactflow** — runtime knowledge of which versions are in production, used at build-time via `can-i-deploy`.

Each integration is a separate decision; the framework doesn't require all of them, but it pays off most when 3+ are in place.
