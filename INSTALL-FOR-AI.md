# Installation guide for AI agents (Claude Code, Cursor, etc.)

> Paste the prompt below into your AI agent. It will install getff in your current project (AI Factory is an optional companion, not a prerequisite), with full transparency about what it's doing.

> **Authoritative for:** AI-driven installation prompt + per-step actions the AI agent must take + transparency expectations (what to report, what to ask for confirmation before).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](README.md#why-this-exists). Human-driven installation — see [INSTALL.md](INSTALL.md). Life after install — see the installed `.ai-factory/AI-USAGE-GUIDE.md` (First Steps per depth, daily cycle, degradations).

> **Which harnesses this covers — read this before you read either claim below.** Two different altitudes are in play, and they are not in conflict. **Installation itself and layers 1-4** (custom ESLint rules, pre-commit, pre-push, CI) are harness-agnostic: any AI agent on any harness can run the prompt below, and every one of those gates works afterwards — which is what "Claude Code, Cursor, etc." in the title means. **The 5th layer** — harness hooks in `.claude/settings.json` — is Claude Code-specific and is inert elsewhere, which is what the "Harness-hook layer" section further down means. Neither statement is wrong; they describe different layers. The per-layer breakdown is in that section.

---

## Step 0 — Get the framework

```bash
git clone https://github.com/artyhoo/getff /tmp/getff
cd /tmp/getff
```

> **npm path — deferred, not dropped.** `npx getff@latest init` is the designed entry point, but it is **not live**: nothing is published under the `@getff` scope today, so do not write that command into any install script or tell a consumer to run it. **Owner:** release-frame phase 2, after the R1 name freeze. **Trigger:** the package is published under the frozen name — this section then replaces the clone above. Until then the clone plus `setup` / `install.sh` below is the only path that resolves.

---

## Permissions for the AI agent installing this package

**ALWAYS — proceed without asking the user:**

- Run `bash setup -y <stack>` (preferred one-shot: all layers + dev-deps + companions) or `bash install.sh <stack>` (framework-only).
- Fill `<PLACEHOLDER>` markers in `DESCRIPTION.template.md` and `ARCHITECTURE.ts-server.md`.
- Run `npm run validate` (or the project's equivalent) and `bash scripts/audit-ai-docs.sh`.

**ASK FIRST — pause and report your reasoning before acting:**

- Removing or skipping any rule R1–R20 (e.g. R8 OTel because the project doesn't use OpenTelemetry yet).
- Modifying `.ai-factory/RULES.md` or any file under `.ai-factory/` after install.
- Adding a new rule R21+ — propose it in `INSTALL-DECISIONS.md` first.
- Disabling a probe in `audit-ai-docs.sh`.

**NEVER — refuse if asked; redirect to a senior, or open a rule-change discussion on a PR:**

- Edit files under `eslint-rules-local/` (these are vendored copies; edit upstream in `packages/core/eslint-rules/` (shared/generic rules) or `packages/preset-<stack>/eslint-rules/` (stack-specific rules) and reinstall).
- Edit generated `RULES.md` if Phase 2's `rules-manifest.json` exists — regenerate via `packages/core/render/render-rules.ts` instead.
- Pass `--no-verify`, `--no-gpg-sign`, or any hook-skip flag in commits.
- Push to `main` directly or force-push any shared branch.
- Add `// audit:exempt` to silence a rule the agent doesn't understand — investigate first.

---

## Quick install — copy-paste prompt

```text
Install getff into this project. Follow these steps exactly:

1. Verify prerequisites:
   - Node.js 22.23+ (`node --version`)
   - npm available
   - git initialized in this project

2. Detect the project stack by checking:
   - If `next.config.{js,ts,mjs}` exists OR package.json contains "next" → stack = "react-next"
   - Otherwise → stack = "ts-server"
   Show me the detection result and ask if I want to override.

3. From THIS project's directory (not the framework checkout — the installer
   refuses to run inside the package directory itself), run:
   `bash /tmp/getff/setup -y <detected-stack>`
   (adjust the path if Step 0 cloned the framework elsewhere)

   `-y` installs the curated consumer set at `env` depth — the right default. Use
   `bash /tmp/getff/setup --all <detected-stack>` INSTEAD only if I explicitly
   tell you this machine runs the aif-handoff operator runtime: --all
   additionally ships the AIF operator suite (7 skills + 2 agents +
   skill-context) at `factory` depth that dead-ends without that runtime.
   Equivalent new-syntax forms: `install.sh <stack> --profile factory` (recommended for
   new installs) or `install.sh <stack> --with-aif-suite` (legacy escape). When unsure, use -y
   (i.e. env). Pass `--profile core` for the rules-only depth below the default. See
   "Install depth profiles" below for the full core/env/factory breakdown.

   This installs (verified against a real default install, 2026-08-17):
   - .claude/agents/ — 10 files: aif-init, capability-reuse-auditor, compliance-verifier, docplan-auditor, fidelity-auditor, living-docs-auditor, memory-codification-auditor, review-sidecar, rule-researcher, rule-test-author (best-practices-sidecar is KEEP-AIF — not shipped by us; review-sidecar default-skips when AIF's exists; orchestrator-worker-discipline + reviewer-discipline appear only at --profile factory / --with-aif-suite / --all)
   - .claude/skills/ — 11 dirs at the default `env` depth: the 6-dir core set — getff (+ 5 reference files in references/), tool-bootstrapping, rule-research, rule-tests, ai-doc, template-audit — plus the operator contour arch, night-mode, orchestrator, pipeline, reviewer. `--profile core` ships the 6 core dirs only. NOTE the directory is `getff`, not `rules-as-tests` — see "Names you will see" below
   - .ai-factory/tier-home.md — the tier-routing criteria (env+ only; absent at `--profile core`)
   - .ai-factory/DESCRIPTION.template.md + DESCRIPTION.md, ARCHITECTURE.ts-server.md + ARCHITECTURE.md, RULES.md, RULES.react-next.md (if applicable), AI-USAGE-GUIDE.md, tool-decisions.md, skill-context/{aif-review,aif-rules-check}/
   - AGENTS.md — written as a `getff:begin section=getff-framework` fenced block, so a root AGENTS.md another tool already generates is extended, never replaced
   - scripts/audit-ai-docs.sh (or .react-next.sh) + the check-\* gate scripts
   - Configs in project root: eslint.config.mjs, vitest.config.ts, dependency-cruiser.cjs, stryker.config.json, tsconfig.json, .nvmrc, .lintstagedrc.json
   - .husky/pre-commit, .husky/pre-push
   - package.json scripts (lint, typecheck, test, audit:docs, validate, etc.)
   - Dev dependencies via `npm install -D` (~25 packages)

4. After setup completes, do these checks and report results:
   a. `npm run typecheck` — should pass on a fresh project
   b. `npm run lint` — may have warnings on existing code, that's OK
   c. `npm run audit:docs` — should run, may report findings (read them aloud to me)
   d. `ls -la .claude/agents/` — confirm the 10 files listed above exist; orchestrator-worker-discipline.md + reviewer-discipline.md appear only after --profile factory / --with-aif-suite / --all
   e. `ls -la .ai-factory/` — confirm DESCRIPTION.md, ARCHITECTURE.md, RULES.md, AI-USAGE-GUIDE.md exist

5. Read .ai-factory/DESCRIPTION.md and tell me which placeholders need filling.
   DO NOT fill them yourself — these are project-specific and require my input.

6. Read .ai-factory/RULES.md (R1-R11) and ask me which rules to keep, adjust, or remove for this project.

7. If stack is react-next, also read .ai-factory/RULES.react-next.md (R12-R20).

8. Stop here. Do NOT start implementing features. The setup is meant to be reviewed before use.

After all this, tell me:
- What was installed (file count, total size)
- Any warnings or errors encountered
- The 3 most important things I should manually edit
- The exact command to verify everything is wired up: `npm run validate && npm run audit:docs`
```

---

## Names you will see — one project, several spellings

These are the SAME project seen through different naming layers. None is a typo, and **none of them is being renamed here** — the name freeze is a separate, later step, so do not "fix" any of them:

| Where it appears                   | Spelling                             | Why                                                                                                                                    |
| ---------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Repository + install source        | `getff` (`github.com/artyhoo/getff`) | the project name                                                                                                                       |
| npm scope                          | `@getff`                             | reserved for the npm path that is **not live yet** (see Step 0)                                                                        |
| Installed skill directory          | `.claude/skills/getff/`              | the consumer-facing skill's own name                                                                                                   |
| Managed markers in generated files | `rules-as-tests-aif`                 | the historical package id, kept so managed blocks already written into a consumer's `.prettierignore` keep matching (`setup.d/lib.sh`) |

If a doc or script sends you to `.claude/skills/rules-as-tests/`, it is stale: the installed directory is `.claude/skills/getff/`.

---

## Install depth profiles (`--profile core | env | factory`)

Pick a depth instead of assembling flags. Three monotonic depths, default `env` (raised from `core` 2026-08-17 — `env` needs nothing external, so gating it was a decision rather than a necessity):

| Profile         | What ships                                                                                                                                                                    | When to pick                                                                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core`          | Rules + tests + guard hooks + killer payload. No operator contour, no AIF operator runtime.                                                                                   | Consumer projects that want the rules-as-tests discipline without any aif-handoff runtime.                                                                        |
| `env` (default) | core + the operator working contour: /arch, /orchestrator, /pipeline, /reviewer, night-mode/SDD, and the tier-routing criteria at `.ai-factory/tier-home.md`. No AIF runtime. | The default. Nothing at this depth needs anything external — verified by a real install whose delivered tree is link-clean — so it ships unless you ask for less. |
| `factory`       | env + the AIF operator suite (dispatcher / harvest / aif-doctor + runtime-bridge wiring + GLM one-button placeholder) — full aif-handoff runtime stack.                       | Operator machines running the aif-handoff runtime. The legacy `--with-aif-suite` and `--all` flags are factory-equivalent escapes.                                |

**Selection surfaces:**

- `--profile <name>` flag (agents / CI — flag-first; case-insensitive). Mutually-aware with `--with-aif-suite`: if both are passed and disagree → WARN + `--profile` wins.
- TTY menu (interactive; non-TTY defaults to `core` with a one-line notice — never blocks CI / `</dev/null`).
- This `INSTALL-FOR-AI.md` section is the AI-dialog smart default (see "AI-dialog smart default" below).

**AI-dialog smart default (the AI reading this section picks):**

- Default → `core`. Recommend `core` when the consumer hasn't mentioned aif-handoff, /arch, or multi-model workflows.
- Pick `env` if the consumer's stated goal includes /arch, multi-model contour, or status/night-mode features — and explicitly NOT aif-handoff runtime.
- Pick `factory` ONLY if the consumer explicitly runs the aif-handoff operator runtime today (or asks for the dispatcher / harvest / aif-doctor surface). When unsure, fall back to `core` — `--profile` upgrades are stateless-regen (below), so starting shallow is reversible-by-deepening.

**Stateless-regen upgrade path (NOT additive-components):**

Re-run with a deeper profile to upgrade — the deeper payload arrives, the shallower artefacts stay byte-identical. **Use the installer, not `--refresh`, to change depth:** `--refresh` re-syncs framework-owned artefacts and (since #1312 / #1334) honours the resolved `--profile` on every arm it owns, but it never runs the install-only steps — so a `--refresh`-only "upgrade" still leaves a partly-upgraded project and exits 0.

```bash
bash /tmp/getff/setup -y <stack>                    # core
bash /tmp/getff/install.sh <stack> --profile env     # → env (env-only artefacts ADDED)
bash /tmp/getff/install.sh <stack> --profile factory # → factory (AIF suite + aif-handoff row ADDED)
```

Measured on a `core` consumer (2026-08-09): plain `--profile env` → `tier-home.md` YES, `.claude/skills/arch/` YES, and every pre-existing core artefact byte-identical except `.prettierignore`, whose managed block gains the newly-shipped paths.

Every depth-gated `--refresh` arm now follows ONE rule (#1312 / #1334): **the delivery site's own profile predicate, OR the artefact is already on disk** (presence = prior opt-in). Re-measured on a fresh `core` consumer 2026-08-17 — the gate is `tests/install-sh/consumer-upgrade-path.test.sh` TESTs 8-11:

- bare `--refresh` and `--refresh --profile core` → none of the deeper artefacts arrive: the four worktree scripts (`create-worktree.sh`, `worktree-node-modules.sh`, `link-coordination.sh`, `getff-work.sh`), `.claude/skills/arch`, `.claude/skills/pipeline`, `.ai-factory/tier-home.md` all stay absent. Before #1334 the four scripts landed on every `--refresh` regardless of profile, contradicting the `PROFILE=core → skip` decision at `setup.d/85-worktree-scripts.sh:19-22`.
- `--refresh --profile env` → every env-depth artefact arrives; the factory-only set (`dispatcher`, `claude-glm-executor-handoff`, `.claude/agents/reviewer-discipline.md`, `.claude/vendor/runtime-bridge/`, `.claude/hooks/runtime-bridge-dispatch.sh`) stays absent.
- a bare `--refresh` on an already-deeper project keeps that depth fresh — no `--profile` to repeat, which is the point of the presence half.

The vendored runtime-bridge payload (`setup.d/55-runtime-bridge-vendor.sh`, factory depth) now follows that uniform shape too — both halves, the `.claude/vendor/runtime-bridge/` payload and the `.claude/hooks/runtime-bridge-dispatch.sh` dispatch hook, now refresh on the `factory | --with-aif-suite | already-on-disk` gate, so a factory consumer receives vendor fixes without re-running the installer. Still install-only, and the reason a depth change is an installer re-run rather than a `--refresh`: dev-deps, CI wiring and the consumer-editable config seeds are install-path steps by design.

Downgrades are NOT auto — per inventory §5.3, a downgrade is `git rm` the deeper-only artefacts manually. The `--refresh` path keeps refreshing whatever's already on disk (prior opt-in), so a deeper install survives a shallower refresh.

**Backward compatibility:**

- `--with-aif-suite` — explicit escape; routes to `factory`-depth skill scope (today's behavior preserved).
- `--all` — legacy alias for `--full --with-aif-suite`; now also sets `PROFILE=factory` for downstream consistency.
- Every flag that worked before still works. Profiles are an additive surface over the existing flag machinery, not a replacement.

See also: per-profile payload inventory at `docs/meta-factory/research-patches/2026-07-25-beta-a-s1-inventory.md` §2.

### GLM executor one-button (factory profile ONLY)

If the consumer chose `--profile factory` (or `--with-aif-suite` / `--all`), the GLM executor tier wires with ONE human-entered key. Run:

```bash
bash /tmp/getff/scripts/getff-glm-onebutton.sh detect
```

- If output is `GLM_PROFILE: present` → GLM is already wired; skip to the next section.
- If output is `GLM_PROFILE: missing` → run `bash /tmp/getff/scripts/getff-glm-onebutton.sh explain`, read the printed explanation aloud to the consumer (z.ai Coding Plan, the env-file path), and WAIT for the consumer to paste the key into `${XDG_CONFIG_HOME:-$HOME/.config}/getff/glm.env`.
- After the consumer confirms the paste → run `bash /tmp/getff/scripts/getff-glm-onebutton.sh provision`. The helper provisions the runtime profile, sets per-mode defaults via the aif project config, wires the env-file into the aif deployment's process env (best-effort: writes a marker-bearing `docker-compose.override.yml` when the canonical aif-handoff checkout is detected at `$AIF_HANDOFF_CHECKOUT`; otherwise prints a key-reachability instruction for you to apply — §7b), validates the route via the aif bridge, and then makes **one real model call** through the profile it just created — so `DONE` means the key was accepted by the vendor, not merely that it was found. Tell the consumer three things about that step before running it, because all three touch their machine or their bill: (1) the call is billed to their z.ai plan and is **not** token-scale — aif injects project context, so a one-word prompt measured **$0.117** on the reference host, and it is billed on every `provision` run; (2) if the aif deployment is detected, the helper runs `docker compose up -d` against it, which restarts their aif services; (3) each run leaves a chat session titled «getff GLM provisioning proof» in their aif project, which they may delete afterwards. Report the `GLM_PROVISION: DONE` or `GLM_PROVISION: FAILED` output verbatim; a `FAILED step-D` line means the key resolved but the vendor rejected it, or the §7b wiring has not landed in the aif process env yet. If the helper falls back to the instruction form, read it aloud to the consumer — they must apply it before validation can succeed.
- If the consumer declines the z.ai plan → factory profile runs at env-level until GLM is wired; record the decline in your install summary.

The installer NEVER reads the key value — only the env-var name `ANTHROPIC_AUTH_TOKEN`. If you find yourself printing or logging the key value, STOP.

---

## What the AI will produce

After running the prompt, the AI owes you a structured summary containing exactly these four things — counts come from the install output, never from this doc:

1. **What landed** — the file count and the per-directory breakdown the installer printed (`.claude/agents/`, `.claude/skills/`, `.ai-factory/`, `scripts/`, root configs, `.husky/`).
2. **Warnings and errors** — verbatim, not summarised. Pre-existing lint errors in your `src/` are normal on a brownfield repo.
3. **Manual edits needed, in priority order** — typically `.ai-factory/DESCRIPTION.md` placeholders first, then a pass over `.ai-factory/RULES.md` to drop rules that do not fit, then project-specific probes in `scripts/audit-ai-docs.sh`.
4. **The verification command** — `npm run validate && npm run audit:docs`.

---

## If something goes wrong

If the AI reports errors during setup, copy this follow-up prompt:

```text
The setup encountered issues. Please:

1. Show me the full error output (don't summarize, paste raw output).

2. Diagnose the cause:
   - Missing dependency? Permission issue? File conflict?
   - Did install.sh complete?

3. Suggest a fix without making changes yet. Wait for my approval.

4. If the fix is non-trivial, suggest rolling back:
   `git restore . && git clean -fd .claude .ai-factory scripts`
   (this assumes nothing else was changed in this session)
```

---

## Manual installation (if AI agents are unavailable)

Human-driven installation is **`INSTALL.md`'s** job, not this doc's (see the authority header at the top). It carries the full step-by-step: Path B (`install.sh`, guaranteed to work today), Path C (manual copy, full control), the per-stack invocations and every opt-in flag. This section used to restate an abridged copy of Path B, which is exactly how the two drift apart.

---

## Python toolchain lane (`install.sh python`)

The stacks above (`ts-server` / `react-next` / `react-spa` / `react-native`) are all **npm**
toolchains and require a `package.json`. A **Python** consumer takes a separate lane — a pure-bash
delivery that ships a pre-rendered lint bundle (ast-grep structural rules + a ruff fast-path) into
the repo, with **no Node dependency on the consumer machine**.

**How an AI agent (or consumer) runs it — no `package.json`, no npm:**

```bash
# From the Python project's root (it has pyproject.toml, no package.json):
bash /tmp/getff/install.sh python          # explicit lane — always wins over auto-detect
# or `bash /tmp/getff/setup python`. Auto-detect: pyproject.toml present + no package.json → OFFER.
# Re-sync framework-owned artefacts after an upgrade: add --refresh.
```

**What lands (fresh consumer):**

```text
project/
├── sgconfig.yml                          ← ast-grep project config (resolves .getff/astgrep-rules)
├── ruff.toml                             ← ruff fast-path config (TID251/TID253 import bans + DTZ005 naive-datetime built-in)
├── .getff/
│   ├── astgrep-rules/*.yml               ← getff structural rules (no-eval, no-os-system,
│   │                                       no-datetime[.datetime].now) — framework-owned
│   └── ruff-bans.toml                    ← stable getff-bans config the CI gate points --config at
├── .github/workflows/getff-python.yml    ← pinned CI gate (getff-namespaced — never your ci.yml)
└── .getff-python-install.log             ← delivery audit trail (every action + degrade path)
```

**Firing proof (the «works», not just «installed»):** the install ends with a self-check that plants
a violating `.py` **in an OS temp dir only** (never your tracked tree), runs the delivered ast-grep
rules + ruff config against it, and asserts **both fire RED** — then removes it. A tool that is absent
degrades **loudly** (prints the exact manual command), never silently green
([attention-is-not-a-mechanism.md §1](.claude/rules/attention-is-not-a-mechanism.md)). A green install
that never proved firing is not done.

**CI gate:** `getff-python.yml` runs two jobs — `ast-grep scan` and `ruff check` — as **failing**
gates on push / PR. Tool installs are **version-pinned** ([ci-tool-pinning.md](.claude/rules/ci-tool-pinning.md)
Rule A): `@ast-grep/cli@0.44.1` + `ruff==0.15.21`, matching what the getff framework CI itself fires.
The ruff job runs twice: once on your discovered config, once with `--config .getff/ruff-bans.toml`
so the getff import bans fire **regardless** of any ruff config you already have.

**Collision policy (augment-first — never a silent clobber):** on a fresh dir the whole files are
written; a pre-existing `sgconfig.yml` gets our `ruleDirs` entry **structurally merged** (or a loud
refuse with manual instructions if the shape is unprovable); a pre-existing `ruff.toml` **or**
`pyproject.toml [tool.ruff]` is **never** overwritten — getff ships a non-discovered `getff-ruff.toml`
reference copy plus printed `extend`/merge instructions, and always writes the isolated
`.getff/ruff-bans.toml` so the bans still enforce; a re-run is byte-idempotent (zero config diff).
Every degrade path is printed **and** logged to `.getff-python-install.log`.

**Scope note:** the Python lane ships a curated starter rule-set (not live-researched rules);
mypy / import-linter backends are out of scope for this lane. The rule-research **loop** is
in scope and documented under [`/rule-research` python arm](agents/rule-researcher.md)
(author an `AstgrepResearchedPractice` JSON → `npx tsx rule-bootstrap-cli.ts --from-practice`
→ `_py_join_researched_rules` joins it on the next install / `--refresh`). **Generation needs
Node** — the python-lane install itself stays Node-free; only researching + rendering a new
rule requires a Node-capable environment (the framework checkout you cloned for `install.sh`
already has it — `npx tsx` is the standard CLI invocation pattern). See `## F-A verdict` in the
PR body that shipped this clause for the bundle-vs-declare measurement behind this decision
(S3 of the `getff-any-stack-trace` umbrella; spec §12).

---

## Python Tier-1 source trust (LG-S4)

Researched python rules can derive Tier-1 documentation-source trust from an
installed package's own metadata **when a root-local virtualenv is present**
(`<root>/.venv/` or `<root>/venv/`). A system-installed python (no project-local
venv) yields Tier-0 trust only — no regression, but no Tier-1 derivation. Only a
venv **inside** the project root is read (realpath-contained); an out-of-tree or
symlink-escaping venv is refused, never guessed.

Supported `pyproject.toml` forms (single-line, fail-closed on others):

- PEP 621 `[project] dependencies = ["..."]`
- PEP 621 `[project.optional-dependencies]`
- Poetry `[tool.poetry.dependencies]` and `[tool.poetry.group.<g>.dependencies]`

Known limitations (dropped, fail-closed — documented gaps):

- Multi-line arrays and multi-line inline tables are not parsed.
- Quoted-key Poetry deps (`"odd-pkg" = "^1.0"`) are not matched.
- Legacy setuptools parenthesized and URL `@` PEP 508 forms are not parsed.

> **Note:** this adapter is shipped but **unwired** in LG-S4 (no production caller
> threads it yet — same state as the cargo adapter); wiring python + cargo is a
> future umbrella, tracked mechanically by the `ecosystem-unwired-debt` tripwire.

---

## What gets installed — file by file

After successful setup, your project has:

```text
project/
├── AGENTS.md                          ← our fenced `getff:begin section=getff-framework` block;
│                                        content outside the fence is yours and is preserved
├── CLAUDE.md                          ← optional, points to AGENTS.md
├── .nvmrc                             ← Node version pin (CI depends on this)
├── tsconfig.json                      ← strict TypeScript settings
├── eslint.config.mjs                  ← (or eslint.config.react.mjs for UI)
├── vitest.config.ts                   ← unit/integration/audit test discovery
├── stryker.config.json                ← mutation testing
├── .dependency-cruiser.cjs            ← architectural rules
├── .lintstagedrc.json                 ← pre-commit formatter
├── playwright.config.ts               ← only for react-next
├── .husky/
│   ├── pre-commit                     ← runs lint-staged
│   └── pre-push                       ← typecheck + tests + audit-ai-docs
├── .github/workflows/ci.yml           ← full CI pipeline
├── .ai-factory/
│   ├── DESCRIPTION.md                 ← edit this (project description)
│   ├── ARCHITECTURE.md                ← edit this (layer rules)
│   ├── RULES.md                       ← R1-R11 (review and adjust)
│   ├── RULES.react-next.md            ← R12-R20 (only react-next)
│   ├── AI-USAGE-GUIDE.md              ← lifecycle past install: First Steps per depth, daily cycle, degradations
│   ├── tool-decisions.md              ← accepted/rejected MCP + skill decisions (committed)
│   ├── tier-home.md                   ← ONLY at --profile env / factory: tier criteria + degradation matrix
│   ├── rules/integration-rules.md     ← only for microservices
│   └── skill-context/
│       ├── aif-review/SKILL.md        ← anti-tautology content for AIF review sidecar
│       ├── aif-rules-check/SKILL.md   ← R10-naming + test-existence content for AIF rules-check
│       └── aif-orchestrator-discipline/ ← ONLY at --profile factory
├── .claude/
│   ├── agents/                        ← 10 files at every depth: aif-init, capability-reuse-auditor,
│   │                                    compliance-verifier, docplan-auditor, fidelity-auditor,
│   │                                    living-docs-auditor, memory-codification-auditor,
│   │                                    review-sidecar, rule-researcher, rule-test-author.
│   │                                    (+ orchestrator-worker-discipline, reviewer-discipline at
│   │                                    --profile factory. best-practices-sidecar is AIF's, not ours.)
│   └── skills/                        ← 6 dirs at every depth: getff, tool-bootstrapping,
│       │                                rule-research, rule-tests, ai-doc, template-audit.
│       │                                (+ arch, night-mode, orchestrator, pipeline, reviewer
│       │                                at env; + dispatcher, harvest, aif-doctor, story,
│       │                                claude-glm-executor-handoff at factory.)
│       └── getff/references/          ← 5 docs, loaded on demand
│           ├── checks-map.md
│           ├── overview.md
│           ├── ai-traps.md
│           ├── self-testing-docs.md
│           └── doc-organization.md
└── scripts/
    └── audit-ai-docs.sh              ← (or .react-next.sh) — code-vs-docs probes
```

---

## Tool bootstrapping — MCP and skill recommendations at install time

`install.sh` seeds `.ai-factory/tool-decisions.md` (the `30-templates` layer) with a baseline entry recommending **context7** (the doc-fetching MCP that `/rule-research` uses to read live library documentation when it bootstraps stack-specific rules), and the `05-mcp` layer merges a context7 server entry into your `.mcp.json` on the full install path (`./setup -y` / `--full`). This file is **committed** — it serves as the team-shared record of which tools are accepted, rejected, or pending.

The **`tool-bootstrapping`** skill (auto-loaded via `.claude/skills/tool-bootstrapping/SKILL.md`) extends this at runtime: when your `package.json` deps change, the UserPromptSubmit hook injects a one-line warning prompting re-evaluation. Use `/tool-bootstrapping` to trigger the full AIF `/aif` analysis → proposal → confirmation loop.

Decision persistence schema: `.ai-factory/tool-decisions.md` — see `.claude/skills/tool-bootstrapping/references/decision-format.md` for the `deps-hash` frontmatter, `## Accepted` / `## Rejected` / `## Pending review` sections, and version-drift policy.

---

## Three-layer authority for shipped artefacts

Wave 4 of [§13.21](docs/meta-factory/open-questions.md) defines the authority model for files shipped by `install.sh` (templates, sub-agents, preset rules). Every consumer interaction with a shipped artefact happens at one of three layers:

| Layer                                    | What it is                                                                                                                               | Who owns it                                                                                       | When AI agents pick it                                                                                                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Framework default**                 | The file as shipped from the framework (`$PKG_ROOT/...` before copy) — e.g. `packages/core/templates/shared/AGENTS.md.template`.         | Framework maintainers. Read-only for consumers; changes flow upstream via PR.                     | Read during install only (`install.sh` copies it to the consumer). After install, the consumer has a local copy at the destination path; the framework copy is no longer consulted. |
| **2. Consumer in-place edit** (default)  | The installed copy edited in the consumer project — e.g. the consumer's own `AGENTS.md` with placeholders filled in.                     | Consumer. Re-running `install.sh` without `--force` skips existing files, preserving these edits. | This is the file the AI sees during normal work. Default behaviour, no opt-in needed.                                                                                               |
| **3. `<file>.override.md` escape hatch** | A sibling file with the `.override.md` suffix that wholesale-replaces the consumer copy — e.g. `AGENTS.override.md` next to `AGENTS.md`. | Consumer. Lives next to the file it overrides.                                                    | If `<file>.override.md` exists, AI agents should read it **instead of** `<file>`. Use only when in-place edits cannot express the divergence.                                       |

### When to use which layer

- **Default → Layer 2.** Edit the file in place, commit it, move on. Most consumers stop here.
- **Layer 3** only when:
  - The consumer's pre-existing `<file>` predates framework adoption and has structural divergence too large for in-place merging.
  - The consumer wants to swap the framework's conventions wholesale (e.g. a different rule-numbering scheme in `AGENTS.md`) while keeping the framework-shipped baseline as historical reference.
- **Layer 1 is never edited by consumers.** Modifications travel upstream as PRs to the framework repo.

### `<file>.override.md` convention

- **Location:** same directory as the file being overridden.
- **Naming:** base name + `.override.md` suffix. Examples: `AGENTS.override.md` next to `AGENTS.md`; `RULES.override.md` next to `RULES.md`.
- **Resolution rule for AI agents:** if `<file>.override.md` exists, read it instead of `<file>`. The framework-shipped file remains on disk for historical reference but contributes nothing to the agent's working context.
- **Prose-only convention in this Wave.** No lint rule, no install-time check enforces the precedence. Promotion to enforcement is triggered by **the 2nd consumer reporting a manual-override conflict** (e.g. an agent partially honoured both files and produced contradictory guidance). At that point a follow-up wave introduces a check (e.g. an `audit-ai-docs.sh` probe) that fails if both files exist and disagree.

### Prior art

Vocabulary adopted from three production patterns (see [prior-art-evaluations.md](docs/meta-factory/prior-art-evaluations.md) entries #11, #12, #15):

- **ESLint shareable config `extends:`** (entry #11) — canonical "framework default + consumer override" composition; the consumer's `eslint.config.mjs` extends a shareable preset and last-write-wins for any rule.
- **Tailwind CSS `presets`** (entry #12) — same compose-then-extend semantics; the consumer extends a preset and overrides locally.
- **Codex `AGENTS.override.md`** (entry #15) — direct precedent for the `.override.md` suffix + wholesale-replacement primitive in cumulative-inheritance AI-doc ecosystems.

The three-layer model maps onto these patterns: Layer 1 ≈ the shareable preset, Layer 2 ≈ the consumer's local config (the canonical extension point), Layer 3 ≈ the override primitive for wholesale replacement when in-place extension is insufficient.

---

## Refreshing framework artefacts after an upgrade

When the framework ships a fix (e.g. a corrected `agents/*.md`, an updated hook, or a revised skill), consumers who installed before the fix need a safe way to pull in the change without losing their own customisations.

**Use `install.sh --refresh`** — an opt-in, stateless re-sync that overwrites the framework-owned set and respects the three-layer authority model:

```bash
# Preview what would change (writes nothing)
bash /path/to/getff/install.sh --refresh --dry-run

# Apply (overwrites framework-owned files; consumer files untouched)
bash /path/to/getff/install.sh --refresh
```

### What `--refresh` updates

Framework-owned artefacts the consumer is **not** expected to edit in place:

- `.claude/agents/*.md` — sub-agent prompts
- `.claude/skills/` — the 6-dir core set (getff, tool-bootstrapping, rule-research, rule-tests, ai-doc, template-audit), refreshed at every depth. The deeper tiers follow the profile-OR-presence rule above: the env+ contour surface — 5 skills (`arch`, `night-mode`, `orchestrator`, `pipeline`, `reviewer`) — under `--profile env`/`factory`; the AIF operator suite — 5 skills (dispatcher, aif-doctor, harvest, story, claude-glm-executor-handoff) + 2 agents (orchestrator-worker-discipline, reviewer-discipline) + their aif-orchestrator-discipline skill-context — under `--profile factory` (or the legacy `--with-aif-suite` / `--all` escapes). Either tier also keeps refreshing when already present on disk (prior opt-in), and is never created on a shallower profile.
- `.claude/hooks/deps-hash-check.sh` — session hook
- `scripts/*.sh`, `scripts/audit-r4.ts` — audit gate scripts
- `packages/core/hooks/` — TS pre-push pipeline
- `.ai-factory/skill-context/*/SKILL.md` — AIF skill-context overrides

### What `--refresh` never touches

Consumer-authored files are **never** in the refresh set — they are not framework-owned:

- `AGENTS.md`, `.ai-factory/RULES.md`, `.ai-factory/ARCHITECTURE.*.md` (filled in by you)
- `eslint.config.mjs`, `vitest.config.ts`, `tsconfig.json`, `.prettierrc.json`
- `.github/workflows/ci.yml`, `.prettierignore`
- Any file with a sibling `.override.md` (Layer 3 — you have taken ownership)

### How the three-layer model and `--refresh` interact

| Layer                              | File state                                            | `--refresh` behaviour                                                           |
| ---------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| **1. Framework default**           | File was never edited by the consumer                 | Overwrites to latest framework version                                          |
| **2. Consumer in-place edit**      | Consumer edited the file directly (no `.override.md`) | **Also overwrites** — Layer-2 in-place edits are not preserved. See note below. |
| **3. `.override.md` escape hatch** | Consumer created `<file>.override.md` sibling         | **Skips** — the base file is left untouched                                     |

> **Note on Layer-2 edits:** `--refresh` is stateless (no hash stamp) and cannot distinguish a consumer-edited Layer-2 file from an unedited one. If you have edited a framework-owned file in place **without** using `.override.md`, run `--dry-run` first and rescue any customisations before applying. The recommended divergence path is to move your edits into `<file>.override.md` before refreshing — then `--refresh` is always safe to run.

### Refresh-safe divergence workflow

To diverge from a framework file AND keep `--refresh` safe:

1. Create `<file>.override.md` next to the file (e.g. `agents/review-sidecar.override.md`).
2. Put your custom content in that file.
3. Instruct AI agents to read `<file>.override.md` instead of `<file>` (Layer-3 resolution rule).
4. Run `--refresh` freely — the base file will be updated to the latest version; your override is untouched.

---

## Harness-hook layer and AI-assisted workflow requirements

### Editor coupling (Claude Code only)

This is the second altitude flagged at the top of this doc: it scopes the **5th** layer, not the install or layers 1-4.

The **harness-hook layer** (5th lifecycle stage) ships as `.claude/settings.json` hooks (`UserPromptSubmit`, `PostToolUse`). This layer is **Claude Code-specific**: hooks are executed by the Claude Code harness and have no equivalent in the current shipped artefacts for Cursor, Cline, or Codex. Cross-editor parity for this layer stays on the WATCHLIST pending cross-editor hook-API convergence — see [prior-art-evaluations.md SSOT #21](docs/meta-factory/prior-art-evaluations.md) (verdict: WATCHLIST — «cross-editor hook-API divergence; revisit when Cursor/Cline ship stable PostToolUse-equivalent»).

**Per layer, what a non-Claude-Code harness actually gets:**

| Layer                                           | Claude Code                       | Cursor / Cline / Codex / Aider / Windsurf                                               |
| ----------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------- |
| 1-3 — custom ESLint rules, pre-commit, pre-push | works                             | works — nothing harness-specific                                                        |
| 4 — CI (`ci-success`)                           | works                             | works — runs on the runner, not the editor                                              |
| 4 — skills (`.claude/skills/*`)                 | auto-activate on relevant queries | present on disk; do **not** auto-activate — read the `SKILL.md` when the topic comes up |
| 5 — harness hooks (`.claude/settings.json`)     | activate automatically on install | inert; nothing above is affected                                                        |

So the title's "Claude Code, Cursor, etc." (install + layers 1-4) and this section's "Claude Code-specific" (layer 5) are both true at their own altitude.

### Subscription requirement

AI-assisted workflows require a Claude Code subscription:

> **AI-assisted workflows (PostToolUse hook validation, local advisory skills) require Claude Code subscription.** The harness-hook layer and session-bound skills (e.g. `self-reflection`, `rules-as-tests`) run inside your active Claude Code session — covered by the subscription bundle, zero per-token cost. They do not run in CI and do not call the Anthropic API independently. See [docs/meta-factory/research-patches/2026-05-11-llm-usage-audit.md §5](docs/meta-factory/research-patches/2026-05-11-llm-usage-audit.md) for the full cost classification (FREE / PAID-CI / HYBRID / N/A per touchpoint).

Consumers without a Claude Code subscription: deterministic layers (pre-commit, pre-push, CI jobs) work without any subscription. Only session-bound features are affected.

---

## Expected first-run failures (this is OK)

After `bash install.sh` on a fresh project, these checks **fail intentionally** until you populate the project. Do NOT try to "fix" them by suppressing the rule:

| Command                         | What fails                                         | Why it's OK                            | What to do                                                 |
| ------------------------------- | -------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------- |
| `npm run arch:check`            | dependency-cruiser: no `src/domain/`               | You haven't built the domain layer yet | Continue with R3 disabled until `src/domain/` exists       |
| `npm run audit:docs`            | R4: no `src/domain/**/*.ts` exports                | No public exports yet                  | Re-run after first feature lands                           |
| `npm run validate`              | typecheck: no `src/index.ts`                       | Empty src tree                         | Re-run after first source files                            |
| `bash scripts/audit-ai-docs.sh` | R7: no `infrastructure/clock/`                     | Optional infrastructure                | Add when you need time injection                           |
| `eslint .` (R8)                 | `require-otel-span` on async exports without spans | OTel not wired yet                     | Disable R8 in `INSTALL-DECISIONS.md` if OTel isn't planned |

If a check fails for a reason not in this table — **stop and report**, do not silently disable.

---

## Verification checklist (after install)

| Check                                   | Command                                               | Expected                                                                                       |
| --------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Skills loaded                           | `ls .claude/skills/`                                  | Lists `getff`, `tool-bootstrapping`, `rule-research`, `rule-tests`, `ai-doc`, `template-audit` |
| Sub-agents loaded                       | `ls .claude/agents/living-docs-auditor.md`            | File exists, ~6KB                                                                              |
| TypeScript compiles                     | `npm run typecheck`                                   | Exit 0                                                                                         |
| Lint runs                               | `npm run lint`                                        | Exit 0 (warnings OK on existing code)                                                          |
| Tests discoverable                      | `npx vitest run --listFiles`                          | Shows .unit.ts files (or empty if no tests yet)                                                |
| Audit script runs                       | `npm run audit:docs`                                  | Exit 0 with PASS/FAIL/WARN output                                                              |
| Pre-commit hook                         | `git commit --allow-empty -m "test"` (in test branch) | Lint-staged runs                                                                               |
| Pre-push hook                           | `git push --dry-run`                                  | Typecheck + tests + audit run                                                                  |
| A rule provably fires                   | `bash scripts/check-fences-fire.sh`                   | Planted bad input goes RED — the install is proven, not just present                           |
| Harness hooks active (Claude Code only) | `jq .hooks .claude/settings.json`                     | `UserPromptSubmit` + `PostToolUse` entries present (sub-wave 7.2.a/b/c)                        |

---

## After install — continue into `/rule-research` in the same session

The install prompt above ends with "Stop here. Do NOT start implementing features" — that
injunction applies to **feature implementation**. It does **not** end the session: the same
agent that just installed the framework proceeds directly into `/rule-research` to bootstrap
stack-specific rules from live documentation, in the same session, before reporting back to
the operator. The rule-research loop is part of the install — the framework's thesis is that
rules are tested for firing at delivery time, not shipped pre-baked; researched rules are how
that thesis extends beyond the curated starter set the installer delivered.

**How the agent continues** (per stack):

- **npm lanes** (`ts-server` / `react-next` / `react-spa` / `react-native`) — read
  `agents/rule-researcher.md` for the author → render → join → lock sequence (the
  `AstgrepResearchedPractice` arm covers ast-grep structural rules; the ESLint arm covers L4
  single-token-diff candidates via `./setup --full`).
- **python lane** — read `agents/rule-researcher.md` python arm. Generation needs Node
  (`npx tsx …` from the framework checkout); the python install itself stays Node-free (the
  fork F-A resolution cited at the python-segment scope note above).
- **cargo lane** — `agents/rule-researcher.md` rust arm points at the clippy bridge. The
  pre-rendered clippy-bans delivery lane (`setup.d/46-cargo.sh`, W4 / #1080, activated by
  `GETFF_TOOLCHAIN=cargo`) has landed; the research/join seam (a `--from-rust-practice` CLI arm
  - `_cargo_join_researched_rules` consumer-side helper) is the honest residual gap, named as a
    widening stage in the rust arm — NOT a silent promise that the full loop is closed.

**Stopping rule:** research is skipped **only** on an explicit operator opt-out. The shape of
the opt-out (an env var, a prompt at install time, or a documented sentence the agent reads)
is intentionally not fixed by this doc — three candidate consumer contracts exist and the
choice is itself an operator decision. **Surface it explicitly at first contact; do NOT
silently assume a shape.** (Parked per `getff-any-stack-trace` S3 §4; spec §6.1 fixes that an
opt-out exists, not what it is.) Until the operator settles the shape, the safe behaviour is
to **prompt the operator before continuing past install** — that is one of the three candidate
shapes and it satisfies «explicit opt-out» by construction (the operator says no out loud).
