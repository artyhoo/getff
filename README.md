# getff — rules as tests

[![License: FSL-1.1-ALv2](https://img.shields.io/badge/license-FSL--1.1--ALv2-blue.svg)](LICENSE.md)
[![Discipline Self-Check](https://github.com/artyhoo/getff/actions/workflows/discipline-self-check.yml/badge.svg?branch=main)](https://github.com/artyhoo/getff/actions/workflows/discipline-self-check.yml)
[![Audit Self](https://github.com/artyhoo/getff/actions/workflows/audit-self.yml/badge.svg?branch=main)](https://github.com/artyhoo/getff/actions/workflows/audit-self.yml)
[![Workflow Integrity](https://github.com/artyhoo/getff/actions/workflows/workflow-integrity.yml/badge.svg?branch=main)](https://github.com/artyhoo/getff/actions/workflows/workflow-integrity.yml)

getff compiles your conventions into native toolchain gates (ESLint/husky for npm, clippy for cargo — cargo-deny dependency bans are on the roadmap). Its own [AGENTS.md](AGENTS.md) is executable — every claim carries a live-fired enforcement status; the gate fails when a claim drifts from reality. Docs lie; tests don't.

**Honest framing:** today the executable AGENTS.md is this repo's own — [open it](AGENTS.md), every statement has an enforcement line. `getff init` (via `./setup`, see [Installation](#installation)) installs the enforcement layer (ESLint/husky/CI gates) into your TypeScript project; generating *your* executable AGENTS.md is the next milestone, not shipped yet.

![Adding `as any` gets blocked at the git hook, before CI even sees it](demo/violation-blocked.gif)
![A rule's own claim drifts from the generated index; the check `make self-audit` runs catches it and names the fix](demo/doc-drift-gate.gif)

## What you get today

After install, your project has:

1. **A skill** (`.claude/skills/getff/`) — auto-activates in Claude Code on questions about lint, tests, CI, mutation testing, contracts, AI-driven code drift.
2. **Sub-agents** (`.claude/agents/`) — 8 shipped by default: `review-sidecar`, `living-docs-auditor`, `compliance-verifier`, `memory-codification-auditor`, `aif-init`, `rule-researcher`, `capability-reuse-auditor`, `docplan-auditor`:
   - `review-sidecar` — two-AI tautology review of tests (our differentiator; no earlier deterministic channel — its cousin Stryker is CI-only).
   - `living-docs-auditor` — runs `audit-ai-docs.sh` and interprets results (backward Living-Documentation drift).
   - the remaining 6 cover §1.7 PR-review substance (`compliance-verifier`), memory-to-repo codification audits (`memory-codification-auditor`), AIF onboarding scaffolds (`aif-init`), live-documentation rule research (`rule-researcher`), build-vs-reuse capability audits (`capability-reuse-auditor`), and DocPlan semantic-grouping judgment for the composition gate (`docplan-auditor`) — see `agents/` for each agent's own description.
   - 2 more agents ship only under `--with-aif-suite` / `--all` (they presuppose the aif-handoff operator runtime, same gate as the operator-suite skills — F7 split): `orchestrator-worker-discipline` + `reviewer-discipline`, with their `aif-orchestrator-discipline` skill-context.
   - R1–R20 code-rule validation is enforced **earlier** (edit-time custom ESLint + pre-push) and via AI Factory's own `rules-sidecar` (which reads your `.ai-factory/RULES.md`) — so we no longer ship a competing `best-practices-sidecar` (C-1 KEEP-AIF, 2026-05-20).
   - **skill-context overrides** (`.ai-factory/skill-context/`) ride AIF's own pipeline instead of colliding agent slots (C-1 follow-up, SSOT #50): `aif-review/SKILL.md` injects our anti-tautology test-review into AIF's `review-sidecar`; `aif-rules-check/SKILL.md` injects the R10-naming + test-existence residue into AIF's `rules-sidecar`.
3. **AI Factory templates** (`.ai-factory/`) — DESCRIPTION, ARCHITECTURE, RULES (R1–R11 + R12–R20 for UI + IR1–IR6 for microservices).
4. **An audit script** (`scripts/audit-ai-docs.sh`) — drift detection + code-vs-docs probes. ~10 sec run. Each probe has a paired negative test (must fail when introduced bug).
5. **Stack configs**:
   - ESLint 10 flat config (typescript-eslint strictTypeChecked + Prettier; for React, also react-hooks + jsx-a11y/strict + @next/next).
   - Vitest 4.x with `.unit.ts` / `.integration.ts` / `.audit.ts` naming and per-module coverage thresholds (90% domain, 85% application).
   - Stryker mutation testing (incremental on PR diff).
   - dependency-cruiser layered architecture rules.
   - Husky pre-commit (lint-staged) + pre-push (typecheck + vitest related + arch + audit-ai-docs).
   - GitHub Actions CI with required `ci-success` job.
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

**Is:** universal satellite for Living Documentation enforcement — neutrally compatible with any companion stack (workflow frameworks, task orchestrators, methodology discipline tools). Focused on R1-R20 rules-as-tests, `audit-ai-docs.sh` drift detection, mutation testing, principle tests, 5-layer framework. One-button install of pre-configured opinionated discipline.

**Isn't:** workflow framework (multiple companions exist — see [companion-target comparison](docs/meta-factory/research-patches/2026-05-16-companion-target-comparison.md) and SSOT #56-#83); task orchestration / swarm coordination (see same SSOT); standalone CI tool. **Not the IDE/CLI runtime our framework deploys into** — Claude Code, Cursor, Codex are *deployment surfaces*, not companions; the framework installs into their workspace via standard project install.

**Reuse stance:** see [`.claude/rules/build-first-reuse-default.md`](.claude/rules/build-first-reuse-default.md). Default = adopt upstream when problem-class matches. Build ourselves only what is structurally missing — currently: Living Documentation, 5-layer framework, methodology discipline, AST-based hooks (shipped Wave 10 / N3 ✅).

**Roadmap signals:** companion-target comparison shipped 2026-05-16 — see [research-patch §3-§4](docs/meta-factory/research-patches/2026-05-16-companion-target-comparison.md). Verdicts: **Superpowers** = 3rd named companion (rules-as-tests alignment confirmed via TDD-for-Skills discipline). **OhMyOpencode** = ADOPT VOCABULARY (SSOT #83) for orchestrator dispatch + verification loop terminology (Atlas + Prometheus naming convention; no runtime dependency). **microsoft/agent-framework** = REFERENCE-only (different lifecycle / problem class). **Cursor / Codex** = framework-consumers (different architectural layer — runtimes we install into, not companions at our framework layer). Future widening pending only if new discipline-framework candidates appear.

## The 5-layer framework

| Layer | What | Tools |
|---|---|---|
| 1 | Architecture / fitness functions | ESLint, dependency-cruiser, ArchUnit |
| 2 | Meta-tests (tests about test suite) | AST scans, eslint-plugin-vitest |
| 3 | Specification by Example | Vitest `it.each`, fast-check property tests |
| 4 | Mutation testing | Stryker incremental |
| 5 | Living documentation | OpenAPI from Zod, ADRs as ArchUnit `because(...)` |

Plus extensions:
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

## Installation

### Quick start — one command (recommended)

```bash
git clone https://github.com/artyhoo/getff /tmp/rt
cd /your/project
bash /tmp/rt/setup ts-server                 # or react-next; omit to get a stack picker
```

`./setup` is the one-click orchestrator (framework + companions + runtime-bridge). Flags:

- `--yes` — non-interactive consumer default: skip the prompts, install missing companions, run the bridge step; ships the curated consumer set only.
- `--all` — everything: `--yes` PLUS the AIF operator suite (6 skills + 2 agents + their skill-context — presupposes the aif-handoff runtime; operator machines).
- `--dry-run` — print the full plan, write nothing.

It runs four steps:

1. **Preflight** — probes for `bash`, `git`, `python3`, `curl`; reports anything missing.
2. **Framework** — runs `install.sh` (file deploy only: skill, sub-agents, AI Factory templates, stack configs, husky hook files, audit script).
3. **Companions** — manifest-driven, detect-first, consent per companion — see below.
4. **Runtime-bridge** — optional guided aif-handoff setup (`[y/N]`, default N) — see [docs/runtime-bridge-setup.md](docs/runtime-bridge-setup.md).

`./setup` deploys files; it does **not** run `npm install`. When it finishes, the installer prints the remaining wiring steps — the exact `npm install -D` dev-dependency list, the `package.json` scripts to add (`INSTALL.md §3`), and `npx husky init`.

> The previous end-to-end wrapper `setup.sh` (`ai-factory init` + `npm install` + husky init + npm scripts via `jq`) has been **retired** (2026-07-10) — `./setup` supersedes it. It also ran an unpinned `npm install -g ai-factory`; companions now install detect-first via the manifest below. If older instructions point you at `bash setup.sh`, use `./setup` instead.

### As a Claude Code plugin (per-harness)

The **soft layer** (skills, sub-agents, session hooks) also ships as a Claude Code plugin from an in-repo marketplace:

```text
/plugin marketplace add artyhoo/getff
/plugin install getff@getff
```

One install and the skills **auto-trigger** (a `SessionStart` hook injects a `using-getff` bootstrap — no manual `Skill` call), the consumer-facing sub-agents resolve, and the path-scoped rule-injector fires on edits.

**The honest boundary (soft vs hard).** A plugin **never** silently mutates your git/CI, so the plugin delivers only the soft layer. The **hard** layer — `.husky` pre-commit/pre-push hooks + the CI workflow that actually *fail the build* — is opt-in via one command:

```text
/getff:install-enforcement
```

It previews the changes (dry-run, writes nothing), asks for `[y/N]`, then fetches the project's own official `install.sh` and wires `.husky` + CI into the current repo. Same installer, reached honestly.

- **OpenCode (and other non-CC harnesses):** the same skills are portable — see [`.opencode/INSTALL.md`](.opencode/INSTALL.md). The one accepted off-CC degradation: `SessionStart` auto-injection does not fire, so the bootstrap skill is read on demand (a documented degradation, not a portability gap).
- **Plugin vs `./setup`:** the plugin is the **soft-layer-first** path (great for "just give me the skills"); `./setup` / `install.sh` is the **full file deploy + hard layer** in one shot. Both reach the same `install.sh` for enforcement.

### Optional companion install (K-1)

Companion installs run as `./setup` step 3, driven by a manifest (`setup.d/companions.manifest`) — one row per companion (detect command, install command, kind), looped by `setup.d/engine.sh`:

- **Detect-first:** a companion that is already present is skipped.
- **Consent per companion (interactive):** `Install <name>? [y/N]` — default is N; no companion is mandatory. When stdin is not a tty (piped / CI), prompts fall through to N automatically.
- **Headless:** `--yes` / `--all` install every missing manifest companion without prompting (for companions the two are equivalent; `--all` additionally ships the AIF operator suite — see Installation flags above); `--dry-run` prints what would be installed.
- **Official installers only, no version pin** — currently Superpowers via `claude plugin install superpowers@claude-plugins-official`, and ast-grep (structural code search: CLI via `npm install -g @ast-grep/cli`, then the official `ast-grep/agent-skill` plugin).
- **External services** (manifest kind `external-service` — the aif-handoff runtime-bridge) are not plain installs; they route to the guided-detect bridge step (`./setup` step 4) instead.

Each `cc-plugin` companion is installed via `claude plugin install` — this is **administrative file-management** (file copy + manifest registration into `~/.claude/`), **not** an API-billed LLM call. Verified VERIFIED-FREE per Stage 2 v3 §4.8.

TaskMaster is no longer an offered companion — its marketplace plugin slug does not resolve, and the install offer was withdrawn in the one-click rework. The `COMPANIONS=...` env var belonged to the retired `setup.sh` wrapper and is gone — use the manifest + flags above.

### What gets installed automatically

After the framework deploy (`./setup` step 2 — or `bash install.sh <stack>` directly), your project has:

| Path | Source | Edit needed? |
|---|---|---|
| `.claude/skills/getff/` | skill + 5 references, on-demand | No — auto-activates in Claude Code |
| `.claude/agents/review-sidecar.md`, `living-docs-auditor.md` | sub-agents for `/aif-verify` (R1–R20 validation is earlier-channel: ESLint + pre-push + AIF `rules-sidecar`) | No |
| `.ai-factory/skill-context/aif-review/SKILL.md`, `aif-rules-check/SKILL.md` | overrides injected into AIF's own sidecars (anti-tautology review + R10/test-existence residue) | No |
| `.ai-factory/RULES.md` | R1-R11 (or +R12-R20 for react-next) | **Yes — review and trim per project** |
| `.ai-factory/DESCRIPTION.template.md` | template with `<PLACEHOLDERS>` | **Yes — fill in, rename to `DESCRIPTION.md`** |
| `.ai-factory/ARCHITECTURE.ts-server.md` | drop-in for canonical hexagonal layout | Maybe — rename to `ARCHITECTURE.md` if your layout matches |
| `AGENTS.md` (root) | from `packages/core/templates/shared/AGENTS.md.template` | **Yes — review** |
| `eslint.config.mjs`, `vitest.config.ts`, `tsconfig.json`, `stryker.config.json`, `.lintstagedrc.json`, `.nvmrc` | stack-specific configs | No — work out of the box |
| `.husky/pre-commit`, `.husky/pre-push` | Husky hooks (lint-staged + typecheck + audit) | No |
| `.github/workflows/ci.yml` | full CI pipeline (lint, typecheck, arch, tests, mutation) | No — works as-is † |
| `scripts/audit-ai-docs.sh` (and `.react-next.sh`) | code-vs-docs probes | No — extend with project-specific probes if useful † |

> **† Layout-honesty caveat.** The shipped audits (`scripts/audit-ai-docs.sh` / `.react-next.sh`, and the `ci.yml` that runs them) assume the canonical `src/` + DDD layout. Several layout-specific probes are hardcoded to that layout, so on a non-`src/` project (`app/`, `lib/`, `apps/*/src/`, or a flat tree) they currently report **PASS while checking zero files** — green that means "the rule could not run on your layout", not "the rule ran and found nothing wrong". Two concrete examples at current HEAD: **R4** (`packages/core/audit-self/audit-ai-docs.ts`, `probeR4`) returns `pass` with `(skipped: no src/domain)` when `src/domain` is absent; **R17** (`audit-ai-docs.react-next.sh`, `for f in $(find src/shared/ui src/features/*/ui …)`) iterates zero times when those dirs don't exist and then unconditionally passes. So "works as-is" is accurate **on** the canonical layout, but a consumer on another layout must not read green from these audits as a real pass — extend or repoint the probes to your own paths first.

**Manual work after install:** the three project-specific items above (DESCRIPTION placeholders, RULES.md trimming, AGENTS.md review), plus the wiring steps the installer prints — `npm install -D` dev-deps, `package.json` scripts (`INSTALL.md §3`), `npx husky init`, and `npx depcruise --init` to generate `.dependency-cruiser.cjs` (the retired `setup.sh` wrapper used to automate these). Typically 5-10 minutes — or zero, if you delegate it to an AI (next section).

### For AI agents — let Claude/Cursor do the install

Paste this into Claude Code, Cursor, or any AI agent with file access in your project's directory:

```text
Install getff into this project.

1. Detect stack: `ts-server` (default) or `react-next` (next.config.* present, or
   "next"/"react" in package.json).
2. Run: bash /path/to/getff/setup <detected>
   (clone the repo to /tmp/rt first if not on disk; the package is at
   github.com/artyhoo/getff — needs SSH/HTTPS access.
   With non-tty stdin the companion/bridge prompts default to N, so this
   deploys the framework files only.)
3. After setup completes, do these in sequence and report results:
   a. Read .ai-factory/DESCRIPTION.template.md, fill in <PROJECT_NAME>,
      stack details, non-goals based on package.json + README.md +
      existing src/ structure. Save as .ai-factory/DESCRIPTION.md.
   b. Read .ai-factory/RULES.md (R1-R11). For each rule, decide: keep,
      adjust, or remove based on project context. Report decisions to me.
      Do not commit removals without asking.
   c. Read AGENTS.md root file, adapt to this project (replace template
      placeholders with concrete paths and conventions).
   d. Complete the wiring steps the installer printed: `npm install -D`
      the listed dev-deps, add the package.json scripts (INSTALL.md §3),
      run `npx husky init` and `npx depcruise --init`.
   e. Run `npm run validate` and report any failures.
   f. Run `npm run audit:docs` and report results.
4. Stop here. Do not start implementing features.
```

Full guide for AI-driven install: see [`INSTALL-FOR-AI.md`](INSTALL-FOR-AI.md).

### Alternative paths

If you already have `ai-factory` set up or want partial install:

```bash
# Path B — only the overlay (you handle ai-factory init + npm yourself):
bash /tmp/rt/install.sh ts-server     # or react-next; --force to overwrite

# Path A — AIF extension (forward-compat, schema landing soon):
ai-factory extension add ./getff

# Path C — cherry-pick configs only (no skill, no sub-agents, no audit):
cp /tmp/rt/templates/ts-server/eslint.config.mjs .
cp /tmp/rt/packages/core/templates/shared/tsconfig.json .
# ... see INSTALL.md §C
```

## What stack does it support?

- **`ts-server`** — Node.js 22.23+ server-only (Fastify, Hono, Express, plain HTTP).
- **`react-next`** — React 19 + Next.js 15 (App Router) + TypeScript.
- **`react-spa`** — React 19 + Vite SPA (Feature-Sliced Design). _Early — ships the `require-error-boundary` rule; the rule-pack is still growing._
- **`react-native`** — React Native / Expo (Expo or bare-RN baseline). _Experimental baseline — stack scaffold + templates; a dedicated rule-pack is not yet shipped._

Pass the stack to `./setup` (or `install.sh`) as a positional argument — `ts-server` / `react-next` / `react-spa` / `react-native` — or omit it to get an interactive picker. All share base configs (tsconfig, husky, lint-staged, RULES R1-R11); the React stacks add R12-R20 + Storybook/Playwright where applicable.

### Multi-toolchain roadmap

The stacks above are all inside the npm toolchain. The framework is being generalized one level up — from `{stack}` to `{toolchain: npm | cargo | go | maven, …, stack}` — via the **Convention Compiler**: a narrow-core intermediate representation plus a per-backend capability matrix (deliberately *not* a union "one IR fits all"). **Rust/cargo is the first non-npm backend.**

This is a **roadmap, not shipped** — no Rust rule-pack exists yet. What is in place today: the design + kickoff ([`docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md`](docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md)), and the trust-tier system's first non-JS provenance adapter (`cargo`, deriving trusted doc-research hosts from `Cargo.toml` metadata — SSOT #197). Live cargo rule-firing needs a Rust toolchain and is not yet verified end-to-end.

## Forward compatibility note on AIF extensions

The AIF `extension.json` schema is **in active development** as of May 2026 (PR #34 in `lee-to/ai-factory`, Draft state). This package ships:

- **`extension.json`** — best-effort manifest matching what's visible in AIF code today
- **`install.sh`** — guaranteed fallback that does not depend on AIF extension support

When the schema finalizes, `extension.json` may need updates. `install.sh` will continue to work regardless.

## Compatibility

The framework is **AI-agnostic by design** — any harness with a CC-compatible hook system works. Per-hook coverage and dogfood depth vary; the doctrine lives at [`.claude/rules/zcode-parity-doctrine.md`](.claude/rules/zcode-parity-doctrine.md).

**Supported today:**
- **Claude Code** — primary dogfood harness; deepest coverage (all 20 hooks).
- **ZCode** — full parity via plugin channel + `_zcode-emit` helper. Three CC-only events (`SubagentStart`, `SubagentStop`, `WorktreeCreate`) have documented fallbacks or accepted CC-only rationale per the doctrine §4.
- **Cursor** — high CC-overlap (native `SubagentStart`/`Stop`, lifecycle hooks). Listed based on docs-verification in the [S8 agnosticism survey](docs/meta-factory/research-patches/2026-07-18-zcode-parity-s8-harness-survey.md); live end-to-end testing is a follow-up.

**Roadmap (FEASIBLE-WITH-WORK — adapter needed):**
- **Codex CLI** — lifecycle hooks present; per-tool matcher adapter needed.
- **Windsurf** — Cascade Hooks present; taxonomy adapter needed.

**Out-of-scope:**
- **Aider** — no hook system (upstream issues `aider#2045`, `aider#2557`).

**Wave B rollout status:** Stages 5 (`warn-subagent-report` ZCode variant), 6 (9-twin migration + generator), 7B (`inject-subagent-context` extension for full `SubagentStart` payload parity), 9C (`end-of-turn-reminder` ZCode multi-turn arm) are decided ([decisions.md](docs/meta-factory/zcode-parity-mega.decisions.md) §Wave A brainstorm resolutions) and implementation-pending. See doctrine §3 for live merge status.

## Verified versions (May 6, 2026)

All versions in `INSTALL.md §4` were verified via `npm view <pkg> version` on installation date. Re-verify before deploying to your project — versions move.

## What's enforced

The complete rule list (R1–R20):

**Base (R1–R11)** — server TS:
- R1 TypeScript hygiene (no `any`, no `!`, no `enum`)
- R2 Validation at boundaries (Zod)
- R3 Architectural boundaries (layered)
- R4 Tests for new public code (real assertions only)
- R5 Async correctness (no floating promises)
- R6 Errors (Error subclasses, no string throw)
- R7 Time/randomness/IO injection
- R8 Observability (OTel spans)
- R9 Imports (banned: lodash, moment, axios)
- R10 Naming conventions
- R11 CI integrity

**React/Next addition (R12–R20)**:
- R12 Server vs Client components
- R13 Data fetching (RSC / Server Actions / TanStack Query)
- R14 Forms (Server Actions with Zod)
- R15 Accessibility (jsx-a11y/strict)
- R16 Performance (next/image, next/link)
- R17 Component tests (Storybook + Vitest + a11y)
- R18 TanStack Query / SWR (typed responses)
- R19 Styles (Tailwind, no CSS-in-JS)
- R20 Server Actions (`'use server'`, return type pattern)

**Microservices (IR1–IR6)**:
- IR1 API contracts (OpenAPI from Zod)
- IR2 Consumer-driven contracts (Pact + can-i-deploy)
- IR3 Event schemas (Zod-validated)
- IR4 Service-to-service auth (mTLS / signed JWT)
- IR5 Distributed tracing (W3C Trace Context)
- IR6 Resilience (timeouts, retries, circuit breakers)

## Lessons learned included

`references/ai-traps.md` ends with 8 real-world lessons from running AI-driven projects:

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

```bash
ai-factory extension update getff                   # Path A
./install.sh <stack> --force                        # Path B (overwrites configs)
# Path C: cherry-pick changes manually
```

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
