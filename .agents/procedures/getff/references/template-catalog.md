# Template catalog

> **Authoritative for:** the scoped template catalog detail routed from [the skill card](../SKILL.md).
> **NOT authoritative for:** skill activation, shared gates, or project goal; those remain with the card and its declared owners.

## Templates ready to copy

The table lists framework source templates, not evidence of consumer delivery. In the framework checkout, read these source paths. In a consumer, resolve the actual delivered files at the project root and under `.ai-factory/` before selecting a config. Delivery depends on the stack and profile: `generic` installs no stack configs, and an existing consumer-owned config may be preserved. If a listed config is absent, report that prerequisite as missing; do not treat the catalog or an installation-complete message as proof of enforcement. Apply the skill's verification protocol to any config you publish.

| File                                                                                                                    | Purpose                                                                         |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `templates/ts-server/eslint.config.mjs`                                                                                 | Server-side TS: typescript-eslint strict + Prettier + custom rules              |
| `packages/preset-next-15-canonical/templates/eslint.config.react.mjs`                                                   | React/Next.js: above + react-hooks + jsx-a11y/strict + @next/next               |
| `packages/core/templates/shared/tsconfig.json`                                                                          | Strict TypeScript with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| `templates/ts-server/dependency-cruiser.mjs`                                                                            | Architectural rules: layering, no-cycles, no-cross-feature-imports              |
| `templates/ts-server/stryker.config.json`                                                                               | Mutation testing with incremental mode, thresholds 60/70/85                     |
| `templates/ts-server/vitest.config.ts` (or `packages/preset-next-15-canonical/templates/vitest.config.ts`)              | Test runner with per-module coverage thresholds                                 |
| `packages/core/templates/shared/.lintstagedrc.json`                                                                     | Pre-commit: prettier + eslint --fix on staged only                              |
| `packages/core/templates/shared/husky-pre-commit.sh`                                                                    | Pre-commit hook entry                                                           |
| `packages/core/templates/shared/husky-pre-push.sh`                                                                      | Pre-push hook with upstream-fallback (works on new branches)                    |
| `packages/core/templates/shared/.nvmrc`                                                                                 | Pinned Node version (CI depends on it)                                          |
| `packages/preset-next-15-canonical/RULES.md`                                                                            | Drop-in for `.ai-factory/RULES.md` — rules R1–R11                               |
| `packages/preset-next-15-canonical/RULES.react-next.md`                                                                 | Extension R12–R20 for React/Next.js stack                                       |
| `templates/ts-server/github-actions-ci.yml` (or `packages/preset-next-15-canonical/templates/github-actions-ci-ui.yml`) | Full CI workflow: lint, typecheck, arch, test, mutation incremental             |
