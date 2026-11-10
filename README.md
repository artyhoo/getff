# getff — rules as tests

[![License: FSL-1.1-ALv2](https://img.shields.io/badge/license-FSL--1.1--ALv2-blue.svg)](LICENSE.md)
[![Discipline Self-Check](https://github.com/artyhoo/getff/actions/workflows/discipline-self-check.yml/badge.svg?branch=main)](https://github.com/artyhoo/getff/actions/workflows/discipline-self-check.yml)
[![Audit Self](https://github.com/artyhoo/getff/actions/workflows/audit-self.yml/badge.svg?branch=main)](https://github.com/artyhoo/getff/actions/workflows/audit-self.yml)
[![Workflow Integrity](https://github.com/artyhoo/getff/actions/workflows/workflow-integrity.yml/badge.svg?branch=main)](https://github.com/artyhoo/getff/actions/workflows/workflow-integrity.yml)

getff helps you prepare and maintain a project's engineering foundation for AI-assisted development. It brings together maintained engineering principles, reviewed examples of failures, diagnostics and reusable integrations. Start with the checks that fit your stack, keep the tools that already work for your team and add executable checks for your project's own agreements. Use the core on its own or add skills, MCP tools and workflow support as needed.

A check can catch a covered violation in a command your team already runs and point to what needs to change. The project's rules and review criteria apply whether a person or an agent made the change.

getff is designed to share engineering agreements and common checking mechanisms as your stack and AI tools change. Each integration handles the details of its language, framework, model, provider or coding agent. The applicable project agreements stay in force across those changes. Each supported setup has its own prerequisites and activation steps.

## See the feedback from a check

The TypeScript server template enables ESLint's `@typescript-eslint/no-explicit-any` rule. It flags `export const count: any = 1;`. Letting TypeScript infer the type with `export const count = 1;` passes the same lint command. The pre-commit demo shows how a Git hook rejects a violation. [Pre-commit demo](demo/violation-blocked.gif)

See the checks in this repository’s [AGENTS.md](AGENTS.md) and the [documentation drift demo](demo/doc-drift-gate.gif). [Preview the core profile](#try-it-on-a-typescript-server-project)

## What you get today

A fresh installation on an npm stack can deliver the following. The stack, profile and existing configuration determine which checks can run. Check the installer report for the result on your project.

1. **Skills** (`.claude/skills/`) — on a fresh npm-lane install, 11 skills at the default `env` profile: `ai-doc`, `getff`, `rule-research`, `rule-tests`, `template-audit`, `tool-bootstrapping`, `arch`, `night-mode`, `orchestrator`, `pipeline`, `reviewer`. `getff` auto-activates in Claude Code on questions about lint, tests, CI, mutation testing, contracts, and AI-driven code drift. `--profile factory` adds 6 more skills: `aif-doctor`, `claude-glm-executor-handoff`, `dispatcher`, `harvest`, `intent`, `story`; the handoff-oriented skills use the aif-handoff runtime, while `intent` also works without it in a degraded mode.
2. **Sub-agents** (`.claude/agents/`) — on a fresh npm-lane install, 13 shipped by default: `aif-init`, `capability-reuse-auditor`, `claims-conformance-auditor`, `compliance-verifier`, `docplan-auditor`, `docs-form-auditor`, `fidelity-auditor`, `living-docs-auditor`, `memory-codification-auditor`, `plan-drift-semantic-auditor`, `review-sidecar`, `rule-researcher`, `rule-test-author` (`setup.d/20-agents.sh` skips authoring-only tools and gates the pair below behind `--profile factory`):
   - `review-sidecar` — external diff review for tautological tests, mock-only assertions, missing edge cases, and React/Next anti-patterns.
   - `living-docs-auditor` — runs `audit-ai-docs.sh` and reports backward Living-Documentation drift.
   - `aif-init` drafts project description and architecture files; `capability-reuse-auditor` audits new capabilities for overlap and prior-art consistency; `claims-conformance-auditor` verifies docs-site claims against source; `compliance-verifier` reviews PR forward and backward evidence; `docplan-auditor` judges DocPlan grouping; `docs-form-auditor` audits docs form against the reader-comfort card; `fidelity-auditor` checks a stage diff against its kickoff; `memory-codification-auditor` finds conventions stranded in memory; `plan-drift-semantic-auditor` classifies guarded plan edits; `rule-researcher` researches stack practices into a rule and firing test; `rule-test-author` repairs firing test material for an existing generated rule.
   - 2 more agents ship only under `--profile factory` (or the legacy `--with-aif-suite`, which `./setup --all` sets): `orchestrator-worker-discipline` + `reviewer-discipline`; they presuppose the aif-handoff operator runtime and carry their `aif-orchestrator-discipline` skill-context.
   - The R1–R20 catalog includes default checks, opt-in checks and practices that need review. If you use AI Factory, its `rules-sidecar` also reads `.ai-factory/RULES.md`. [What runs and what needs review](#whats-enforced)
   - **skill-context overrides** (`.ai-factory/skill-context/`) ride AIF's own pipeline instead of colliding agent slots (C-1 follow-up, SSOT #50): `aif-review/SKILL.md` injects our anti-tautology test-review into AIF's `review-sidecar`; `aif-rules-check/SKILL.md` injects the R10-naming + test-existence residue into AIF's `rules-sidecar`.
3. **AI Factory templates** (`.ai-factory/`) — DESCRIPTION, ARCHITECTURE, RULES (R1–R11 + R12–R20 for UI + IR1–IR6 for microservices).
4. **An audit script** (`scripts/audit-ai-docs.sh`) — selected drift and code-vs-docs probes. A probe can report a skip when its project inputs are absent.
5. **Stack configs**:
   - ESLint 9 flat config (typescript-eslint strictTypeChecked + Prettier; for React, also react-hooks + jsx-a11y/strict + @next/next) — `setup.d/70-deps.sh` pins `eslint@^9`; the reason for each pin is the `# why:` comment beside it in `CORE_DEVDEPS`.
   - Vitest 4.x with `.unit.ts` / `.integration.ts` / `.audit.ts` naming and per-module coverage thresholds (90% domain, 85% application).
   - Stryker mutation testing (incremental on PR diff).
   - dependency-cruiser layered architecture rules.
   - Husky pre-commit (lint-staged) + pre-push. The pre-push hook runs getff's own rule checks — rule-glob liveness, lint-staged binary resolution, generated-rule firing, link-check on changed Markdown, un-pinned tool installs — **not** your typecheck or test suite, which stay yours to wire.
   - A GitHub Actions workflow for eligible projects, including a `ci-success` job. An existing workflow needs its own getff wiring. [Check what was connected](#what-gets-installed-automatically)
   - For React/Next: also Playwright (component testing + e2e) and Storybook test-runner.

## Why this exists

> **Authoritative for:** project goal, methodology, design invariants.
> Other docs (`docs/meta-factory/EXECUTION-PLAN.md`, `docs/meta-factory/PROPOSAL.md`, `CLAUDE.md`) subordinate to this section for these definitions. They remain authoritative for their own scope (operational plan, design history, AI-tooling conventions) but cannot redefine the project's goal.

### Goal (user-facing)

AI agents (Claude, Cursor, Copilot, Aider) write plausible-looking code that **reliably violates undocumented conventions**. Without enforced rules:
- `as any` and `!` non-null assertions multiply.
- Tests pass because they're tautological (`expect(x).toBeDefined()` for typed values).
- Layer boundaries leak.
- Conventions in `CLAUDE.md` are forgotten within 3 sessions.

This package operationalizes the principle: **every rule that governs your codebase is an executable artifact** — an ESLint rule, a pre-push check, a principle test, a mutation gate, a drift probe, or a Living Documentation assertion — **that fails when violated, at the earliest reachable channel**:

```text
edit-time → pre-commit → pre-push → CI → production audit
```

**CI is the last-resort gate, not the primary one.** AI cannot silently bypass what fails at any of these channels.

**Practice note:** a small number of rules are currently Class C (prose-only, mechanism deferred). See [research-patches/2026-05-16-readme-absolutism-vs-class-c-practice.md](docs/meta-factory/research-patches/2026-05-16-readme-absolutism-vs-class-c-practice.md). These are tracked and audited; rule files self-describe class via a `> **Class:** A | B | C` line in their header per [.claude/rules/doc-authority-hierarchy.md §3](.claude/rules/doc-authority-hierarchy.md).

### Methodology

Generate enforcement rules from principles, not from copy-pasted presets. Presets become stale as stacks evolve (Next 14 → 15 → 16 in 18 months); principles age more slowly.

The framework validates itself with its own logic — **recursive self-application**. Same precedent as GCC three-stage bootstrap or `rustc` compiling itself: a quality signal that the framework's own claims hold up under its own scrutiny. *Quality signal, not the goal.*

### What must not break (invariants)

- **Build-vs-reuse discipline** — prior-art consult before any capability commit. SSOT: `docs/meta-factory/prior-art-evaluations.md`. Macro-level operating philosophy: `.claude/rules/build-first-reuse-default.md` (default = adopt upstream when problem-class matches; build only when structurally missing). Enforcement: `Prior-art:` commit trailer + pre-push hook.
- **Recursive self-application** — `make self-audit` green = the framework's own conventions don't drift.
- **Search-coverage discipline** — negative-existence claims («no production analog») fail the §1 6-item checklist before shipping as load-bearing. Rule: `.claude/rules/phase-research-coverage.md`.
- **No paid LLM in CI** — no API-billed LLM calls in CI/GH Actions beyond the operator's existing Claude Code subscription. Semantic LLM checks ship as AI-agnostic sub-agent prompts (under `agents/`) read by active AI sessions, not as automated gates with metered API calls. Rationale + escape hatch: [`.claude/rules/no-paid-llm-in-ci.md`](.claude/rules/no-paid-llm-in-ci.md).
- **Multi-channel enforcement** — every rule fails at the earliest reachable channel: edit-time (ESLint) → pre-commit (lint-staged) → pre-push (husky + audit-ai-docs + §1.7) → CI (discipline-self-check) → production (Living Documentation drift). CI is the last-resort gate.

If recursive self-application breaks, the framework becomes documentation that lies about itself — exactly the failure mode it claims to prevent.

## What this project is and isn't

getff helps teams set up and maintain their engineering agreements. The core fits into an existing workflow and retains suitable checks. Add skills, connected tools and workflow procedures where they help. Factory facilities support multi-step work and have their own runtime requirements.

The core addresses architecture, code, tests, documentation and feedback in ordinary AI-assisted work. Decide what applies to the actual project, reuse verified protection and generate a rule and tests for a supported gap. Review still decides whether an agreement fits the project and whether the application meets its intended behavior.

Native checks run in the project's toolchain. Research and generation can require access to sources and an AI tool. Host-specific features require a supported integration and any necessary trust or permissions. [Profiles](#choose-what-to-install) · [Host support](#compatibility)

## The 5-layer framework

| Layer | What | Tools |
|---|---|---|
| 1 | Architecture / fitness functions | ESLint, dependency-cruiser, ArchUnit |
| 2 | Meta-tests (tests about test suite) | AST scans, eslint-plugin-vitest |
| 3 | Specification by Example | Vitest `it.each`, fast-check property tests |
| 4 | Mutation testing | Stryker incremental |
| 5 | Living documentation | OpenAPI from Zod, ADRs as ArchUnit `because(...)` |

Optional mechanisms to select when a project needs them:

- **Pre-PR**: AIF `/aif-verify` with sub-agents.
- **Production**: SLO-as-code (OpenSLO + Pyrra), error budgets, observability 2.0.
- **Between services**: Pact contract testing with `can-i-deploy --to production`.
- **Between code and AI docs**: `audit-ai-docs.sh` with drift detection + code-vs-docs probes.

For details, see `skills/getff/references/`:
- `checks-map.md` — map of all 8 enforcement levels (edit-time → production)
- `overview.md` — 5 layers with patterns and anti-patterns
- `ai-traps.md` — what AI violates most + Lessons learned (real grabli)
- `self-testing-docs.md` — the `audit-ai-docs.sh` pattern with negative tests
- `doc-organization.md` — hot/cold split for AGENTS.md, token economy

## What's in the repo (operator contour)

[What you get today](#what-you-get-today) summarizes the install surface for a consumer project.
This section maps what the framework repo itself runs — the machinery that keeps the five
layers above honest while the framework is being built. Most of it is **not** shipped to
consumers: what ships, and at which tier, is a per-artifact fact, and the authoritative
per-artifact list is generated rather than kept by hand (see the closing note).

| Family | Where | What it is |
|---|---|---|
| **Enforcement machinery** | [`packages/core/principles/`](packages/core/principles/) | Meta-tests about the rules themselves — every rule must carry an executable check and a paired negative test. `make self-audit` runs them; this is recursive self-application in code. |
| **Discipline rules** | [`.claude/rules/`](.claude/rules/), digest [`00-rule-index.md`](.claude/rules/00-rule-index.md) | Prose statutes, each declaring the channel it fires on (edit-time inject, hook, pre-push section, cold agent). The index is generated from the rule files, never hand-edited. |
| **Session hooks** | [`.claude/hooks/`](.claude/hooks/) | Context injected at the moment of work: the rule matching the edited path, the session bootstrap and goal digest, the output language, kickoff traps, sub-agent context. Plus session continuity — a pre-compaction residue snapshot, a handoff-currency gate, and a plain-words session recap. |
| **Seats (skills)** | [`.claude/skills/`](.claude/skills/) | Named roles a session takes: `/pipeline` (what to work on next — priority scoring over a deterministic feed with completion detection), `/arch` (design dialogue), `/orchestrator` and `/dispatcher` (waves, routing, in-flight probing), `/reviewer`, `/night-mode` (autonomous runs), `/harvest` (finished agent branches into PRs), `/story` (plain-words recap), `/rule-research` and `/rule-tests` (a new rule, and the test that proves it fires), `/ai-doc`, `/self-reflection`. |
| **Cold agents** | [`agents/`](agents/) | Read-only reviewers with no memory of how the code was written: backward sweeps over a change's class, §1.7 substance checks, claims conformance, dual-channel drift, liveness probes. Session-read prompts, never metered CI calls. |
| **Advisor mailbox** | [`scripts/check-ask-files.sh`](scripts/check-ask-files.sh) | A seat, not a skill: on a fork it cannot decide, a session files a schema-checked ask instead of guessing. The same script is the emitter and the pre-push validator, so a malformed ask is a red test rather than a lost question. |
| **Generation** | [`packages/core/synthesizer/`](packages/core/synthesizer/), [`packages/core/detector/`](packages/core/detector/) | Declarative markdown compiled into an ESLint rule; stack detection deciding which preset a project gets. |
| **Delivery** | [`install.sh`](install.sh), [`setup.d/`](setup.d/), [`packages/getff/`](packages/getff/), [`plugin/`](plugin/) | The one-command install, the layered installer, the npm tarball with a hash manifest, and the Claude Code / ZCode plugin twins. Byte-identical install snapshots per stack and lane guard all of it. |

The installer roster and the site reference are generated from the project sources. [Install roster](INSTALL-FOR-AI.md) · [Generated reference](docs/site/reference)

## What the checks and tests establish

| What you run | What it establishes |
| --- | --- |
| A check for a project agreement | An executable check rejects a covered violation, such as a forbidden dependency between modules. |
| Tests of that protection | A violating example fails for the intended reason, a valid example passes and the team's normal command invokes the check. |
| Application behavior tests | The application produces the expected business result. Your team defines that behavior, and engineers or a selected workflow can write tests for it. |

## Choose what to install

| Profile | Who it helps | What it adds |
| --- | --- | --- |
| `core` | Teams that want executable project agreements in their existing workflow. | Stack checks and rule authoring tools. Keep your current agent, commands and protections where they fit. |
| `env` | Teams that also want help with research, design, testing and review. | Development and workflow skills. Add selected companion tools where useful. This is the fresh npm install default. |
| `factory` | Maintainers who need to coordinate work across multiple stages and owners. | Operator procedures for planning, execution, handoff and review with traceable progress. Handoff tools require the aif-handoff runtime. |

Use `--profile` to select the depth. The setup wrapper's `--full` flag controls the non-interactive installation path, including dependency installation.

**Skills.** Select and install existing skills suited to the project. If a gap remains, adapt a relevant skill or define a narrowly scoped one as a separate task.

**MCP tools.** Select a server for a resource the project uses. Configure it in the chosen harness, complete the required access and trust steps, then verify a real call to the relevant tool.

**Workflows and interfaces.** Add workflow or factory procedures when the team needs coordination across steps and owners. Memory and bot interfaces are optional integrations where available.

## Try it on a TypeScript server project

From your project root, with Git, Bash, Python 3 and curl available, preview the core profile from a getff checkout. A full TypeScript setup also needs the project's supported Node.js and package manager.

```bash
git clone https://github.com/artyhoo/getff /tmp/getff
bash /tmp/getff/setup --dry-run --profile core ts-server
```

Review the plan. For the interactive installation, repeat the setup command without `--dry-run`. Read the install's `Checked by the install` and `NOT wired` output to see the checks it performed and any setup it could not connect.

## Add checks for your project

When your project needs a new rule, start with the separate research step. Verify that the proposed rule fits your framework version and local policy, and reuse a suitable check if you have one. For a supported rule, getff can turn reviewed research and selection inputs into a check and its tests. [Rule research](.agents/procedures/rule-research/SKILL.md)

## An Astro project (illustration)

Suppose your team upgrades an Astro project and chooses the development environment. Start with the project's actual Astro version, rendering and deployment mode, dependencies and configuration. Use the official guidance for that setup and the team's own policies to decide which requirements apply. Keep the checks that already cover them.

If one applicable, mechanically checkable requirement lacks protection, use reviewed research and selection inputs to produce a rule and valid and violating cases through a supported backend. Run the cases and confirm that the normal project command invokes the rule. Choose an existing skill that helps with the upgrade. If the workflow needs access to a documentation resource, configure a suitable MCP server and verify a real call once the harness trusts it and access is in place.

Astro is the selected first-release direction. The supported versions, modes and environments still need to be specified.

## Find your stack and harness

The existing Codex hook adapter reuses shared getff scripts. Hook activation depends on the setup and trust steps for the host. Preparation, editing and updates can also have different tool and provider requirements. [Codex integration](docs/codex-contributor.md) · [Installation guide](INSTALL.md) · [Harness compatibility](#compatibility)

## Installation

### Quick start — one command (recommended)

From your project root, use setup from a getff checkout to install the maintained baseline. The planned first-run experience connects research, rule generation and verification in one flow. Today, a project without reviewed research and selection files starts with the shipped preset checks. For a project-specific rule, use the [separate research step](#add-checks-for-your-project) and confirm that the resulting rule runs in the project's normal command.

```bash
git clone https://github.com/artyhoo/getff /tmp/getff
bash /tmp/getff/setup ts-server
```

Replace `ts-server` with the [install route](#what-stack-does-it-support) that fits. Setup tries to detect the project when you omit it. Pass an explicit route if the non-interactive installer cannot select one.

`./setup` can install framework files, offer companion tools and guide runtime-bridge setup. Flags:

- `--yes` — use the non-interactive consumer path, including dependency installation on applicable npm projects and project-scope companions.
- `--global` — allow machine-global companions under `--yes`, including user-scope plugins and MCP servers.
- `--all` — use the operator path with global companions and the AIF operator suite. Handoff procedures need a working aif-handoff runtime. To select core depth without the wrapper's companion step, use `install.sh ts-server --full --profile core`.
- `--dry-run` — preview the planned changes without applying them.

For interactive setup, review the prompts for dependencies, companions and runtime setup. The installer can merge applicable `package.json` scripts and activate supported hooks. Read `Checked by the install` and `NOT wired` before relying on a hook, workflow or selected tool. [Companion choices](#optional-companion-install-k-1) · [Runtime bridge](docs/runtime-bridge-setup.md)

### On Windows

For the npm/TypeScript path, install Git for Windows and a supported Node.js version. Python 3 is recommended for the pre-commit JSON and YAML probes. Open Git Bash in your project root and preview the setup from a getff checkout.

```bash
git clone https://github.com/artyhoo/getff /tmp/getff
bash /tmp/getff/setup --dry-run ts-server
```

The Windows verification covered this preview. Review the plan before applying it. [Windows prerequisites](INSTALL.md#prerequisites) · [Windows verification scope](INSTALL.md#what-has-been-measured-and-what-has-not)

### As a Claude Code plugin (per-harness)

Install the Claude Code plugin for skills, sub-agents and session hooks.

```text
/plugin marketplace add artyhoo/getff
/plugin install getff@getff
```

The plugin includes a session bootstrap and path-scoped feedback. Project git hooks and CI use the separate installer. In Claude Code, start that flow with this command.

```text
/getff:install-enforcement
```

It previews changes, asks for consent and invokes the installer. Whether hooks or CI become active depends on the selected path and existing project configuration. Read the result and exercise the relevant command. [Install report and wiring](#what-gets-installed-automatically)

OpenCode can use the portable skills after its own setup. [OpenCode installation](.opencode/INSTALL.md)

### As a ZCode plugin (per-harness)

ZCode installs the same plugin payload from the same GitHub marketplace — one artifact serves both harnesses:

In ZCode: **Settings → Plugin Management → Discover → `+`** (Add marketplace) → enter `artyhoo/getff` → install **Getff** from the `getff` marketplace section. ZCode has no plugin CLI/slash command for this (verified live, ZCode 3.11.2); the `+` dialog accepts the GitHub `owner/repo`, a git URL, or a local directory, and the Discover card's **Get/Install/Update** button installs or refreshes the payload.

What the plugin delivers on ZCode, and the honest boundary:

- **Skills** — the plugin provides the skills and a session bootstrap. Check which hooks the configured host executes.
- **Session hooks** — ZCode runs the plugin's PostToolUse gate hooks **advisory-only** (its schema consumes `additionalContext` for PostToolUse, not `permissionDecision`) — declared loudly by the harness renderer, not silently dropped.
- **Project hooks and CI** — run the project installer separately. Confirm activation through the installer report and the project command.
- **Agents** — ZCode's plugin system records the plugin's sub-agents but does not execute them (known harness limitation, per ZCode's own bundled plugin documentation); their markdown stays readable by any session.
- Per-hook parity detail — what works, what degrades, and why: the [ZCode parity doctrine](.claude/rules/zcode-parity-doctrine.md) §2 census is the SSOT.
- **Language (human-facing output)** — ZCode has no `env`-block mechanism for plugin hooks and a GUI-launched app does not inherit your shell profile, so `AIF_HOOK_LANG` never reaches hooks there (CC reads it from `~/.claude/settings.json` `env`). The plugin's hook wrapper falls back to a file: put one line (e.g. `ru`) in `~/.config/getff/hook-lang` and hook messages + the output-language directive follow it on both harnesses; an explicit env var always wins (incident 2026-09-13: Russian explanations silently degraded to English on ZCode).

### Optional companion install (K-1)

Companion installs run as `./setup` step 3, driven by a manifest (`setup.d/companions.manifest`) — one row per companion (detect command, install command, kind), looped by `setup.d/engine.sh`:

- **Detect-first:** a companion that is already present is skipped.
- **Consent per companion (interactive):** `Install <name>? [y/N]` — default is N; no companion is mandatory. When stdin is not a tty (piped / CI), prompts fall through to N automatically.
- **Headless:** `--yes` / `--all` install missing manifest companions without prompting — project-scope companions under both; `--yes` alone skips machine-global companions with a «NOT wired» notice, while `--all` (= `--yes --global`) allows them and additionally ships the AIF operator suite — see Installation flags above; `--dry-run` prints what would be installed.
- **Official installers only, no version pin** — currently Superpowers via `claude plugin install superpowers@claude-plugins-official`, and ast-grep (structural code search: CLI via `npm install -g @ast-grep/cli`, then the official `ast-grep/agent-skill` plugin).
- **External services** (manifest kind `external-service` — the aif-handoff runtime-bridge) are not plain installs; they route to the guided-detect bridge step (`./setup` step 4) instead.

Each `cc-plugin` companion is installed via `claude plugin install` — this is **administrative file-management** (file copy + manifest registration into `~/.claude/`), **not** an API-billed LLM call. Verified VERIFIED-FREE per Stage 2 v3 §4.8.

TaskMaster is no longer an offered companion — its marketplace plugin slug does not resolve, and the install offer was withdrawn in the one-click rework. The `COMPANIONS=...` env var belonged to the retired `setup.sh` wrapper and is gone — use the manifest + flags above.

### What gets installed automatically

The installer's npm stack paths can place the artifacts below. Other routes have their own toolchains. Keep an existing configuration where it serves the same purpose, and verify which checks run in your workflow.

| Surface | Typical npm delivery | What to verify |
|---|---|---|
| Skills and sub-agents | Profile-specific files under `.claude/`. | Read the [checked roster](#what-you-get-today) and use the appropriate host integration. |
| Project guidance | Starter `AGENTS.md`, rules, architecture and description files under the project or `.ai-factory/`. | Fill in project details and keep the guidance aligned with team decisions. |
| Tool configuration | Applicable ESLint, Vitest, TypeScript, Stryker and lint-staged files. | Check which configuration the project loads and whether the prerequisites are present. |
| Git hooks | Husky hooks on supported npm paths. | Confirm that the hooks run. Custom hook setups and the generic route can leave parts of the wiring inactive. |
| GitHub Actions | A workflow template for eligible single-root projects. | An existing workflow stays in place by default. Missing gates are reported. Wiring them in takes explicit consent or `--wire-ci` where supported. The npm workflow template is skipped for generic and workspace monorepos. |
| Documentation audit | Probes such as `scripts/audit-ai-docs.sh`. | A layout-specific probe can report a skip, for example when `src/domain` is absent. Use a check that fits your layout and confirm that it fires. |

Use the installer report to distinguish delivered files, active checks and follow-up work. To verify protection, run a known violation and a valid correction through the intended local or CI command. [Detailed installation guide](INSTALL.md)

### For AI agents — let Claude/Cursor do the install

The [AI-assisted install guide](INSTALL-FOR-AI.md#quick-install--copy-paste-prompt) gives your agent a checklist for preview, consent, installation and verification. It includes the separate research step when selected. The agent should report each outcome, including any missing source, tool, credential, trust or wiring that prevents completion. [Host support](#compatibility)

### Alternative paths

Run the installer directly for the framework layer, without the wrapper's companion and runtime-bridge steps.

```bash
bash /tmp/getff/install.sh ts-server --profile core
```

Use the installer to deploy the TypeScript ESLint template with its local rule modules and generated index. Install the needed npm dependencies when prompted, then run the project's lint command to confirm the configuration loads. For the AI Factory route, see [extension compatibility](#forward-compatibility-note-on-aif-extensions).

## What stack does it support?

| Install argument | Current coverage |
|---|---|
| `ts-server`, `react-next` | Beta npm presets with delivered TypeScript checks. |
| `react-spa` | Early React and Vite support with a smaller set of active checks. |
| `react-native` | Experimental React Native and Expo scaffold and templates. |
| `python` | Alpha native lane using ast-grep and Ruff. |
| `cargo` | Alpha native Rust lane using Clippy. |
| `go` | Alpha native lane using golangci-lint. Existing linter configuration can require explicit activation for local use. |
| `generic` | Stack-free delivery for projects without a matching preset. Keep your own toolchain and review `NOT wired` for gaps. |

An explicit argument selects the route. Setup tries detection when you omit it. The direct installer's `astro` alias selects generic delivery. The [planned Astro example](#an-astro-project-illustration) illustrates a wider workflow. Each native lane has its own prerequisites and evidence. [Stack maturity and verification scope](packages/core/manifest/maturity.json)

### Multi-toolchain roadmap

The shared core is designed to reuse policy across stack and host integrations. Native toolchains provide their own enforcement. For example, Rust's verified lane uses Clippy. The cargo-deny starter config needs separate wiring, and broader Rust rule generation remains planned. [Convention Compiler design](docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md)

## Forward compatibility note on AIF extensions

The repository includes an [AI Factory extension manifest](extension.json). AI Factory documents extension install and update commands for its own runtime. Check your AI Factory version and the supported extension behavior before choosing that route. The getff setup and installer paths above deliver the framework independently of AI Factory. [Upstream extension guide](https://github.com/lee-to/ai-factory/blob/2.x/docs/extensions.md)

## Compatibility

Project lint, tests and CI use native tools regardless of who wrote the change. Host-specific feedback, skills and agent execution depend on the integration and its active configuration. The same project acceptance criteria apply across supported hosts.

| Host | Integration and evidence boundary |
|---|---|
| Claude Code | Primary project integration and plugin path. The [hook census](.claude/rules/zcode-parity-doctrine.md) records event coverage. |
| ZCode | Plugin with documented event differences. Some hooks provide advisory feedback and plugin sub-agents are readable as Markdown. [ZCode details](#as-a-zcode-plugin-per-harness) |
| Codex CLI | The installer can deliver project-local hooks that reuse shared scripts. Activation requires trust for the project and the exact definitions. Review any `NOT wired` messages. [Codex integration](docs/codex-contributor.md) |
| Cursor | The documented event overlap comes from a survey. End-to-end coverage remains a follow-up. [Harness survey](docs/meta-factory/research-patches/2026-07-18-zcode-parity-s8-harness-survey.md) |
| Other hosts | Run project-native checks through the supported toolchain. Confirm a host-specific binding before relying on its feedback. |

Preparation, development and updates can have different model, tool and provider prerequisites. Confirm the checks and useful feedback on the new path before relying on a changed binding.

## Verified versions (May 6, 2026)

The May 2026 version check is historical. Use the current install guide and installer for your project's requirements. [Current prerequisites](INSTALL.md) · [npm dependency source](setup.d/70-deps.sh)

## What's enforced

The [rule catalog](packages/core/manifest/rules-manifest.json) describes project agreements. An agreement can have a default check, an opt-in check or a review step. Use the installed configuration and a firing test to establish which protection your project has.

| Example | What to expect |
|---|---|
| TypeScript hygiene | The TypeScript server preset rejects explicit `any` through ESLint. See the [tested example](#see-the-feedback-from-a-check). |
| R4, test material for public code | The audit probe looks for a matching test file for domain exports in its supported layout. Review assertions and behavior separately. |
| R7 and R8, runtime discipline | The `ts-server`, `react-next` and `react-spa` presets enable these checks with `AIF_STRICT_RUNTIME=1`. Exercise them when the required infrastructure is in place. |
| R13 and R18, React/Next data handling | The catalog and recipes describe these rules. Check the effective project configuration and prove they fire before relying on them. |
| Integration agreements | API contracts, event schemas and resilience are described in the microservices guidance. Connect and verify the mechanisms that fit the project. |

An installed tool can report a skip when it cannot find the project files it expects. For a coverage claim, check both behavior and invocation. [What the tests establish](#what-the-checks-and-tests-establish)

## Lessons learned included

`references/ai-traps.md` ends with 23 real-world lessons from running AI-driven projects, among them:

1. Dual-remote projects — `.claude/` in `.gitignore` of work-repo (drift symptom)
2. Skills declared early, never created (skill-fantoms)
3. `_comment_TODO` in JSON outlives everything
4. Stale orchestrator-prompts pile up indefinitely
5. AGENTS.md tables drift faster than the body
6. AI silently demotes "MUST" to "should"
7. Trigger overlap between two skills
8. Rules without measurable check decay

Each lesson includes the **rule that came from it** — typically a specific check in `audit-ai-docs.sh`.

## Updating

From the project root, use an updated getff checkout. Preview a selective refresh first, then apply it.

```bash
bash /tmp/getff/install.sh --refresh --dry-run
bash /tmp/getff/install.sh --refresh
```

Refresh updates framework-owned artifacts and keeps the chosen profile unless you explicitly change it. Review `would-flag` in the preview. On apply, refresh can save an in-place edit to `.ai-factory/refresh-conflicts/` and replace the active framework file. For a lasting override, use the documented `.override.md` mechanism where supported. Use `--force` only for an intentional overwrite after previewing and backing up affected files. [Ownership, overrides and recovery](INSTALL-FOR-AI.md#refreshing-framework-artefacts-after-an-upgrade)

## License

**Source-available, not permissively licensed** — said here first, not left for someone else to point out. Licensed under the [Functional Source License, Version 1.1, Apache 2.0 Future License](LICENSE.md)
(FSL-1.1-ALv2). Use, copy, modification, and redistribution are permitted for any
**Permitted Purpose** — internal use, non-commercial education, and non-commercial
research — but **Competing Use** (offering a product or service that substitutes for or
provides substantially the same functionality as this software) is not.

Why FSL instead of MIT/Apache from day one: a single-maintainer project competing against well-funded
forks of its own code has no recourse under a permissive license. FSL keeps the Competing-Use restriction
only while the project needs it — read source, self-host, use internally, all permitted from day one.

Each version automatically converts to [Apache License 2.0](http://www.apache.org/licenses/LICENSE-2.0)
on the **second anniversary** of its release — so this restriction has a hard expiry, not an open-ended one. See [LICENSE.md](LICENSE.md) for full terms.

## Inspirations & sources

This package synthesizes:
- "Rules as Tests" framework — five-layer principle
- Senko Rašić's two-AI review pattern (`review-sidecar`)
- Charity Majors' observability 2.0 (production-side rules)
- Gojko Adzic's Specification by Example (Layer 3)
- Cyrille Martraire's Living Documentation (Layer 5)
- Ian Robinson's Consumer-Driven Contracts (Pact, integration rules)
- Larry Smith's shift-left testing (2001)
- AI documentation drift practices from `ai-docs` skill (real-project applied wisdom)
- Negative test pair pattern as lightweight mutation testing

Full citations in each `references/*.md` file.
