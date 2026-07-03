# Installation guide — rules-as-tests-aif

> **Authoritative for:** human-driven installation paths (A/B/C), per-path step-by-step instructions, version verification procedure, post-install validation steps.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](README.md#why-this-exists). AI-driven installation — see [INSTALL-FOR-AI.md](INSTALL-FOR-AI.md). Quick start (recommended path) — see [README.md#installation](README.md#installation).
> - Tool bootstrapping (MCP/skill seeding at install time): see [INSTALL-FOR-AI.md — Tool bootstrapping](INSTALL-FOR-AI.md#tool-bootstrapping--mcp-and-skill-recommendations-at-install-time).

Three ways to install. Pick one.

---

## Step 0 — Get the framework

```bash
git clone https://github.com/Yhooi2/rules-as-tests-aif /tmp/rules-as-tests-aif
cd /tmp/rules-as-tests-aif
```

(An npm package is not yet published. Use Path B — `install.sh` — as the current install method.)

---

## Path A: AIF extension (recommended once schema lands)

> **Status:** AIF extension format (`extension.json`) is in active development. PR #34 in `lee-to/ai-factory` adds the JSON schema, currently in **Draft**. Until merged and released, this path **may or may not** work depending on your AIF version.

```bash
# In your project, after `ai-factory init`
ai-factory extension add ./path/to/rules-as-tests-aif

# Or from a git URL
ai-factory extension add https://github.com/<org>/rules-as-tests-aif

# Verify
ai-factory extension list
```

If AIF doesn't recognize the manifest format yet, fall back to Path B.

---

## Path B: install.sh (guaranteed to work today)

```bash
# 1. Clone or download the package
git clone https://github.com/<org>/rules-as-tests-aif
# OR: download and unpack the .zip

# 2. cd to your target project
cd /path/to/your-project

# 3. Initialize AI Factory (if not already done)
ai-factory init --agents claude

# 4. Run the installer (one-shot recommended):
/path/to/rules-as-tests-aif/setup -y ts-server       # non-interactive: all layers + dev-deps + companions
/path/to/rules-as-tests-aif/setup -y react-next      # for React/Next
/path/to/rules-as-tests-aif/setup -y react-spa       # for React + Vite SPA
/path/to/rules-as-tests-aif/setup -y react-native    # for React Native / Expo

# Or framework-only (install.sh, interactive stack picker):
/path/to/rules-as-tests-aif/install.sh ts-server

# To overwrite existing files:
/path/to/rules-as-tests-aif/install.sh react-next --force
```

The installer:
- Copies `skills/rules-as-tests/` → `.claude/skills/`
- Copies sub-agents → `.claude/agents/`
- Copies AI Factory templates → `.ai-factory/`
- Copies `audit-ai-docs.sh` → `scripts/`
- Copies stack-specific configs (eslint, vitest, stryker, dependency-cruiser, CI workflow) to project root

By default it **never overwrites** existing files. Use `--force` to overwrite.

Two further opt-in flags (see `install.sh` header for exact semantics): `--full` — also auto-installs the shipped dev-deps via the consumer's package manager (mutating, no prompts; stack arg required); `--wire-ci` — also auto-wires missing CI gates into an existing workflow via `yq` (detect-first). The recommended `./setup -y <stack>` one-shot path already implies `--full` + companions.

---

## Path C: manual copy (full control)

If you want to pick what to install file-by-file:

### C.1 — Sub-agents and skills

```bash
mkdir -p .claude/skills .claude/agents
cp -r path/to/pkg/skills/rules-as-tests .claude/skills/
cp path/to/pkg/agents/*.md .claude/agents/
# Authoring-only tools — not for consumers; remove if you copied them above:
rm -f .claude/agents/manual-rule-liveness-prober.md \
      .claude/agents/shipped-agent-liveness-prober.md \
      .claude/agents/backward-sweep-auditor.md
```

### C.2 — AI Factory project files

```bash
mkdir -p .ai-factory/rules
cp path/to/pkg/packages/core/templates/shared/DESCRIPTION.template.md .ai-factory/
cp path/to/pkg/packages/core/templates/shared/ARCHITECTURE.ts-server.md .ai-factory/
cp path/to/pkg/packages/preset-next-15-canonical/RULES.md .ai-factory/
cp path/to/pkg/packages/core/templates/shared/integration-rules.md .ai-factory/rules/

# For React/Next, also:
cp path/to/pkg/packages/preset-next-15-canonical/templates/ARCHITECTURE.react-next.md .ai-factory/
cp path/to/pkg/packages/preset-next-15-canonical/RULES.react-next.md .ai-factory/
```

### C.3 — audit-ai-docs.sh

```bash
mkdir -p scripts
cp path/to/pkg/scripts/audit-ai-docs.sh scripts/
chmod +x scripts/audit-ai-docs.sh

# For React/Next:
cp path/to/pkg/scripts/audit-ai-docs.react-next.sh scripts/
chmod +x scripts/audit-ai-docs.react-next.sh
```

### C.4 — Configs (project root)

Copy what you don't already have. Don't overwrite without reading first.

```bash
cp path/to/pkg/packages/core/templates/shared/AGENTS.md.template AGENTS.md
cp path/to/pkg/packages/core/templates/shared/.nvmrc .
cp path/to/pkg/packages/core/templates/shared/.lintstagedrc.json .
cp path/to/pkg/packages/core/templates/shared/tsconfig.json .

# For ts-server:
cp path/to/pkg/templates/ts-server/eslint.config.mjs .
cp path/to/pkg/templates/ts-server/vitest.config.ts .
cp path/to/pkg/templates/ts-server/dependency-cruiser.cjs .dependency-cruiser.cjs
cp path/to/pkg/templates/ts-server/stryker.config.json .

# For react-next:
cp path/to/pkg/packages/preset-next-15-canonical/templates/eslint.config.react.mjs eslint.config.mjs
cp path/to/pkg/packages/preset-next-15-canonical/templates/vitest.config.ts .
cp path/to/pkg/packages/preset-next-15-canonical/templates/playwright.config.ts .
cp path/to/pkg/templates/ts-server/dependency-cruiser.cjs .dependency-cruiser.cjs
cp path/to/pkg/templates/ts-server/stryker.config.json .

# Husky hooks:
mkdir -p .husky
cp path/to/pkg/packages/core/templates/shared/husky-pre-commit.sh .husky/pre-commit
cp path/to/pkg/packages/core/templates/shared/husky-pre-push.sh .husky/pre-push
chmod +x .husky/pre-commit .husky/pre-push

# CI workflow:
mkdir -p .github/workflows
cp path/to/pkg/templates/ts-server/github-actions-ci.yml .github/workflows/ci.yml
# Or for React/Next:
cp path/to/pkg/packages/preset-next-15-canonical/templates/github-actions-ci-ui.yml .github/workflows/ci.yml
```

---

## Section 3 — package.json setup

After install, add these scripts to your `package.json`:

```json
{
  "scripts": {
    "lint": "eslint . --max-warnings=0",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:integration": "vitest run -- --include 'src/**/*.integration.{ts,tsx}'",
    "test:mutation": "stryker run",
    "test:mutation:incremental": "stryker run --incremental",
    "arch:check": "depcruise --config .dependency-cruiser.cjs src",
    "arch:graph": "depcruise --config .dependency-cruiser.cjs --output-type dot src | dot -T svg > docs/arch.svg",
    "audit:docs": "./scripts/audit-ai-docs.sh",
    "validate": "npm-run-all2 --parallel typecheck lint format:check arch:check audit:docs test",
    "prepare": "husky"
  }
}
```

For React/Next, also add:

```json
{
  "scripts": {
    "build-storybook": "storybook build",
    "test-storybook": "test-storybook",
    "test:e2e": "playwright test"
  }
}
```

---

## Section 4 — Required npm dev-dependencies

### Server-side TS:

```bash
npm install --save-dev \
  eslint@^9.0.0 typescript-eslint@^8.59.0 @eslint/js@^9.0.0 @typescript-eslint/utils@^8.59.0 \
  globals@^15.14.0 \
  prettier@^3.4.0 eslint-config-prettier@^9.1.0 @vitest/eslint-plugin@^1.0.0 \
  typescript@^5.7.0 \
  vitest@^4.1.5 @vitest/coverage-v8@^4.1.5 \
  @stryker-mutator/core@^8.7.0 @stryker-mutator/vitest-runner@^8.7.0 @stryker-mutator/typescript-checker@^8.7.0 stryker-cli \
  dependency-cruiser@^16.8.0 \
  fast-check@^3.23.0 glob@^11.0.0 tsx@^4.19.0 \
  husky@^9.1.7 lint-staged@^15.2.10 sort-package-json@^2.12.0 \
  npm-run-all2@^7.0.0 \
  @types/node@^22.10.0
```

And the runtime dep that's used everywhere:

```bash
npm install zod@^3.24.0
```

### React/Next.js (in addition to server TS):

```bash
npm install --save-dev \
  @vitejs/plugin-react jsdom \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event \
  @next/eslint-plugin-next \
  eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsx-a11y \
  eslint-plugin-testing-library \
  @playwright/test \
  @storybook/react-vite @storybook/test \
  @storybook/test-runner concurrently wait-on http-server
```

Also: `import 'server-only'` and `import 'client-only'` packages — bundled with Next.js, no install needed.

> **Verification protocol:** these versions were verified as latest stable on May 6, 2026. For your own project, run `npm view <package> version` for each before committing. See `references/checks-map.md` and `SKILL.md` "Verification protocol" section.

---

## Section 5 — Initialize Husky

```bash
npx husky init

# Husky created .husky/pre-commit and .husky/pre-push template hooks.
# Replace them with the ones we copied:
cp path/to/pkg/packages/core/templates/shared/husky-pre-commit.sh .husky/pre-commit
cp path/to/pkg/packages/core/templates/shared/husky-pre-push.sh .husky/pre-push
chmod +x .husky/pre-commit .husky/pre-push
```

---

## Section 6 — Edit project-specific files

After install, fill in placeholders in these files:

### `.ai-factory/DESCRIPTION.template.md` → save as `.ai-factory/DESCRIPTION.md`

Replace `<NAME>`, `<Fastify | Hono | Express>`, etc. with your actual project info.

### `.ai-factory/ARCHITECTURE.ts-server.md` → save as `.ai-factory/ARCHITECTURE.md`

Adjust folder structure and dependency rules to match your project.

### `AGENTS.md`

Already in place but contains generic skill list. Edit to:
- Add your project-specific skills.
- Remove what doesn't apply (e.g., remove R12-R20 references if pure server).

### `scripts/audit-ai-docs.sh`

This is the audit-script with example probes. **Add probes for your project's specific AGENTS.md rules.** Each probe must have a paired negative test (introduce a fake violation, verify it's caught, restore). See `references/self-testing-docs.md`.

---

## Section 7 — Verify the installation

```bash
# Run the full validation
npm run validate

# Test individual layers
npm run lint
npm run typecheck
npm run arch:check
npm run test
npm run audit:docs

# All should PASS. If anything fails, see Troubleshooting below.
```

Try a sample sub-agent invocation in Claude Code:
```text
/aif-verify
```

This should run AI Factory's `rules-sidecar` (validates `.ai-factory/RULES.md`) + our `review-sidecar` + `living-docs-auditor`. Output structured verdict. (R1–R20 are also enforced earlier — edit-time ESLint + pre-push.)

---

## Troubleshooting

### `tsc --noEmit` fails on `verbatimModuleSyntax`

Some legacy code in your project uses runtime-only imports of types. Either:
- Convert to `import type { X } from '...'`
- Set `verbatimModuleSyntax: false` in `tsconfig.json` (less strict, OK for migration)

### `dependency-cruiser` fails with missing tsconfig

Check `.dependency-cruiser.cjs` — it reads `tsConfig: { fileName: 'tsconfig.json' }`. Adjust if your tsconfig is named differently.

### `audit-ai-docs.sh` fails on probe X

The script's probes are project-agnostic examples. **Some probes will fail in your project because your AGENTS.md doesn't have those exact rules.** Edit the script:
- Remove probes that don't apply.
- Add probes for your actual AGENTS.md rules (with paired negative tests).

### Stryker incremental fails on first run

That's expected — incremental mode needs a baseline. First run is full. Subsequent runs use `reports/stryker-incremental.json` cache.

### CI fails on `node-version-file: '.nvmrc'`

Make sure `.nvmrc` is committed (`git add -f .nvmrc`).

---

## What was installed — quick reference

```text
your-project/
├── .claude/
│   ├── skills/rules-as-tests/        ← skill (auto-activates)
│   └── agents/                        ← sub-agents for /aif-verify
├── .ai-factory/
│   ├── DESCRIPTION.template.md       ← edit and save as DESCRIPTION.md
│   ├── ARCHITECTURE.ts-server.md      ← edit and save as ARCHITECTURE.md
│   ├── RULES.md                      ← R1–R11 rules (already filled)
│   ├── RULES.react-next.md           ← R12–R20 (UI projects only)
│   └── rules/integration-rules.md    ← IR1–IR6 (microservices only)
├── scripts/
│   └── audit-ai-docs.sh              ← drift + code-vs-docs probes
├── .github/workflows/ci.yml          ← lint, test, mutation, audit-ai-docs
├── .husky/
│   ├── pre-commit                    ← lint-staged
│   └── pre-push                      ← typecheck + tests + arch + audit
├── eslint.config.mjs                 ← ESLint flat config
├── vitest.config.ts                  ← Vitest with .unit/.audit naming
├── stryker.config.json               ← mutation testing
├── .dependency-cruiser.cjs           ← architecture rules
├── .lintstagedrc.json                ← pre-commit config
├── .nvmrc                            ← Node version pin
├── tsconfig.json                     ← strict TS
├── playwright.config.ts              ← (UI projects only)
└── AGENTS.md                         ← context for AI agents
```

---

## Updating the package

**Path A — selective refresh (recommended):** re-run `install.sh --refresh` to update only framework-owned artefacts (agents, skills, hooks, scripts) while preserving all consumer-authored files.

```bash
# Preview what would change
bash /path/to/rules-as-tests-aif/install.sh --refresh --dry-run

# Apply
bash /path/to/rules-as-tests-aif/install.sh --refresh
```

Consumer-owned files (`AGENTS.md`, `RULES.md`, `eslint.config.mjs`, `ci.yml`, etc.) are never touched. Files with a sibling `.override.md` are also skipped. See [INSTALL-FOR-AI.md §Refreshing framework artefacts](INSTALL-FOR-AI.md#refreshing-framework-artefacts-after-an-upgrade) for the full boundary table.

**Path B (AIF extension):** `ai-factory extension update rules-as-tests-aif`

**Path C (force overwrite):** re-run `./install.sh <stack> --force` to overwrite. **Will overwrite ALL configs including your customizations** — back up first.

**Path D (manual):** cherry-pick what changed.
