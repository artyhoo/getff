# Installation guide for AI agents (Claude Code, Cursor, etc.)

> Paste the prompt below into your AI agent. It will install rules-as-tests-aif on top of AI Factory in your current project, with full transparency about what it's doing.

> **Authoritative for:** AI-driven installation prompt + per-step actions the AI agent must take + transparency expectations (what to report, what to ask for confirmation before).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](README.md#why-this-exists). Human-driven installation — see [INSTALL.md](INSTALL.md).

---

## Step 0 — Get the framework

```bash
git clone https://github.com/Yhooi2/rules-as-tests-aif /tmp/rules-as-tests-aif
cd /tmp/rules-as-tests-aif
```

(An npm package is not yet published. Use Path B — `install.sh` — as the current install method.)

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

**NEVER — refuse if asked, redirect to a senior or to `/aif-rules` discussion:**
- Edit files under `eslint-rules-local/` (these are vendored copies; edit upstream in `templates/shared/eslint-rules/` and reinstall).
- Edit generated `RULES.md` if Phase 2's `rules-manifest.json` exists — regenerate via `packages/core/render/render-rules.ts` instead.
- Pass `--no-verify`, `--no-gpg-sign`, or any hook-skip flag in commits.
- Push to `main` directly or force-push any shared branch.
- Add `// audit:exempt` to silence a rule the agent doesn't understand — investigate first.

---

## Quick install — copy-paste prompt

```text
Install rules-as-tests-aif into this project. Follow these steps exactly:

1. Verify prerequisites:
   - Node.js 20.19+ (`node --version`)
   - npm available
   - git initialized in this project
   - If `ai-factory` CLI is not installed globally → run `npm install -g ai-factory`

2. Detect the project stack by checking:
   - If `next.config.{js,ts,mjs}` exists OR package.json contains "next" → stack = "react-next"
   - Otherwise → stack = "ts-server"
   Show me the detection result and ask if I want to override.

3. Run `ai-factory init --agents claude` ONLY if .ai-factory/ doesn't already exist.
   Show output. If it fails, stop and ask me what to do.

4. From the rules-as-tests-aif package directory, run:
   `bash setup -y <detected-stack>`

   This installs:
   - .claude/agents/{review-sidecar,living-docs-auditor,compliance-verifier,memory-codification-auditor,orchestrator-worker-discipline,aif-init,rule-researcher,capability-reuse-auditor}.md (best-practices-sidecar is KEEP-AIF — not shipped by us; review-sidecar default-skips when AIF's exists)
   - .claude/skills/rules-as-tests/ — skill + 5 reference files in references/
   - .ai-factory/DESCRIPTION.template.md, ARCHITECTURE.ts-server.md, RULES.md, RULES.react-next.md (if applicable)
   - scripts/audit-ai-docs.sh (or .react-next.sh)
   - Configs in project root: eslint.config.mjs, vitest.config.ts, dependency-cruiser.cjs, stryker.config.json, tsconfig.json, .nvmrc, .lintstagedrc.json
   - .husky/pre-commit, .husky/pre-push
   - package.json scripts (lint, typecheck, test, audit:docs, validate, etc.)
   - Dev dependencies via `npm install -D` (~25 packages)

5. After setup completes, do these checks and report results:
   a. `npm run typecheck` — should pass on a fresh project
   b. `npm run lint` — may have warnings on existing code, that's OK
   c. `npm run audit:docs` — should run, may report findings (read them aloud to me)
   d. `ls -la .claude/agents/` — confirm living-docs-auditor.md, compliance-verifier.md, memory-codification-auditor.md, orchestrator-worker-discipline.md, aif-init.md, rule-researcher.md, capability-reuse-auditor.md exist (ours); review-sidecar.md + best-practices-sidecar.md may be AIF's when AIF is installed
   e. `ls -la .ai-factory/` — confirm DESCRIPTION.md (or .template.md), ARCHITECTURE.md, RULES.md exist

6. Read .ai-factory/DESCRIPTION.template.md and tell me which placeholders need filling.
   DO NOT fill them yourself — these are project-specific and require my input.

7. Read .ai-factory/RULES.md (R1-R11) and ask me which rules to keep, adjust, or remove for this project.

8. If stack is react-next, also read .ai-factory/RULES.react-next.md (R12-R20).

9. Stop here. Do NOT start implementing features. The setup is meant to be reviewed before use.

After all this, tell me:
- What was installed (file count, total size)
- Any warnings or errors encountered
- The 3 most important things I should manually edit
- The exact command to verify everything is wired up: `npm run validate && npm run audit:docs`
```

---

## What the AI will produce

After running the prompt, the AI should give you a structured summary like:

```text
✓ Installed: 27 files
  - 3 sub-agents in .claude/agents/
  - 5 reference docs in .ai-factory/references/
  - 1 audit script in scripts/
  - 12 config files in root
  - 2 husky hooks

⚠ Warnings:
  - 2 lint errors in existing src/ — fix before running /aif-verify
  - DESCRIPTION.template.md has 4 placeholders to fill

Manual edits needed (priority order):
  1. .ai-factory/DESCRIPTION.md — replace placeholders for project name, stack, non-goals
  2. .ai-factory/RULES.md — review R1-R11, remove rules that don't fit
  3. scripts/audit-ai-docs.sh — add project-specific probes for your domain rules

To verify: npm run validate && npm run audit:docs
```

---

## If something goes wrong

If the AI reports errors during setup, copy this follow-up prompt:

```text
The setup encountered issues. Please:

1. Show me the full error output (don't summarize, paste raw output).

2. Diagnose the cause:
   - Missing dependency? Permission issue? File conflict?
   - Was ai-factory init successful?
   - Did install.sh complete?

3. Suggest a fix without making changes yet. Wait for my approval.

4. If the fix is non-trivial, suggest rolling back:
   `git restore . && git clean -fd .claude .ai-factory scripts`
   (this assumes nothing else was changed in this session)
```

---

## Manual installation (if AI agents are unavailable)

```bash
# 1. Install AI Factory globally (one-time)
npm install -g ai-factory

# 2. In your project:
cd your-project
ai-factory init --agents claude

# 3. Apply rules-as-tests overlay
unzip path/to/rules-as-tests-aif.zip
cd rules-as-tests-aif
bash setup.sh
# (auto-detects stack; or use --stack=ts-server / --stack=react-next)

# 4. Edit placeholders manually
$EDITOR ../my-project/.ai-factory/DESCRIPTION.template.md
mv ../my-project/.ai-factory/DESCRIPTION.template.md ../my-project/.ai-factory/DESCRIPTION.md

# 5. Verify
cd ../my-project
npm run validate
npm run audit:docs
```

---

## What gets installed — file by file

After successful setup, your project has:

```text
project/
├── AGENTS.md                          ← copied from templates/shared/AGENTS.md.template (edit)
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
│   ├── rules/integration-rules.md     ← only for microservices
│   └── skill-context/
│       ├── aif-review/SKILL.md        ← anti-tautology content for AIF review sidecar
│       └── aif-rules-check/SKILL.md   ← R10-naming + test-existence content for AIF rules-check
├── .claude/
│   ├── agents/                        ← AIF agents + our additions
│   │   ├── best-practices-sidecar.md  ← AIF's (KEEP-AIF); R1–R20 enforced earlier via ESLint+pre-push+AIF rules-sidecar
│   │   ├── review-sidecar.md          ← two-AI review for tautological tests (AIF's kept by default; our content via skill-context — follow-up)
│   │   ├── living-docs-auditor.md     ← ours: runs audit-ai-docs.sh (renamed from docs-auditor to de-collide)
│   │   ├── compliance-verifier.md     ← §1.7 substance review — read in active session before merge
│   │   ├── memory-codification-auditor.md ← ours: durable-convention memory→repo codification audit
│   │   ├── orchestrator-worker-discipline.md ← ours: orchestrator/worker role-separation audit
│   │   ├── aif-init.md                ← ours: aif-handoff bootstrap helper
│   │   ├── rule-researcher.md         ← ours: AI-agnostic live rule-research protocol
│   │   ├── capability-reuse-auditor.md ← ours: source-before-shape reuse/scope audit
│   │   └── (other AIF agents untouched)
│   └── skills/rules-as-tests/
│       ├── SKILL.md                   ← skill, auto-activates on triggers
│       └── references/                ← 5 docs (loaded on-demand)
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

`setup.sh` Step 2d seeds `.ai-factory/tool-decisions.md` with a baseline entry for **context7** (the doc-fetching MCP that powers the `/aif-*` commands) and adds it to your `.mcp.json`. This file is **committed** — it serves as the team-shared record of which tools are accepted, rejected, or pending.

The **`tool-bootstrapping`** skill (auto-loaded via `.claude/skills/tool-bootstrapping/SKILL.md`) extends this at runtime: when your `package.json` deps change, the UserPromptSubmit hook injects a one-line warning prompting re-evaluation. Use `/tool-bootstrapping` to trigger the full AIF `/aif` analysis → proposal → confirmation loop.

Decision persistence schema: `.ai-factory/tool-decisions.md` — see `.claude/skills/tool-bootstrapping/references/decision-format.md` for the `deps-hash` frontmatter, `## Accepted` / `## Rejected` / `## Pending review` sections, and version-drift policy.

---

## Three-layer authority for shipped artefacts

Wave 4 of [§13.21](docs/meta-factory/open-questions.md) defines the authority model for files shipped by `install.sh` (templates, sub-agents, preset rules). Every consumer interaction with a shipped artefact happens at one of three layers:

| Layer | What it is | Who owns it | When AI agents pick it |
|---|---|---|---|
| **1. Framework default** | The file as shipped from the framework (`$PKG_ROOT/...` before copy) — e.g. `packages/core/templates/shared/AGENTS.md.template`. | Framework maintainers. Read-only for consumers; changes flow upstream via PR. | Read during install only (`install.sh` copies it to the consumer). After install, the consumer has a local copy at the destination path; the framework copy is no longer consulted. |
| **2. Consumer in-place edit** (default) | The installed copy edited in the consumer project — e.g. the consumer's own `AGENTS.md` with placeholders filled in. | Consumer. Re-running `install.sh` without `--force` skips existing files, preserving these edits. | This is the file the AI sees during normal work. Default behaviour, no opt-in needed. |
| **3. `<file>.override.md` escape hatch** | A sibling file with the `.override.md` suffix that wholesale-replaces the consumer copy — e.g. `AGENTS.override.md` next to `AGENTS.md`. | Consumer. Lives next to the file it overrides. | If `<file>.override.md` exists, AI agents should read it **instead of** `<file>`. Use only when in-place edits cannot express the divergence. |

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
bash /path/to/rules-as-tests-aif/install.sh --refresh --dry-run

# Apply (overwrites framework-owned files; consumer files untouched)
bash /path/to/rules-as-tests-aif/install.sh --refresh
```

### What `--refresh` updates

Framework-owned artefacts the consumer is **not** expected to edit in place:

- `.claude/agents/*.md` — sub-agent prompts
- `.claude/skills/` — pipeline, dispatcher, aif-doctor, template-audit, rules-as-tests, tool-bootstrapping
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

| Layer | File state | `--refresh` behaviour |
|---|---|---|
| **1. Framework default** | File was never edited by the consumer | Overwrites to latest framework version |
| **2. Consumer in-place edit** | Consumer edited the file directly (no `.override.md`) | **Also overwrites** — Layer-2 in-place edits are not preserved. See note below. |
| **3. `.override.md` escape hatch** | Consumer created `<file>.override.md` sibling | **Skips** — the base file is left untouched |

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

The **harness-hook layer** (5th lifecycle stage) ships as `.claude/settings.json` hooks (`UserPromptSubmit`, `PostToolUse`). This layer is **Claude Code-specific**: hooks are executed by the Claude Code harness and have no equivalent in the current shipped artefacts for Cursor, Cline, or Codex. Cross-editor parity for this layer stays on the WATCHLIST pending cross-editor hook-API convergence — see [prior-art-evaluations.md SSOT #21](docs/meta-factory/prior-art-evaluations.md) (verdict: WATCHLIST — «cross-editor hook-API divergence; revisit when Cursor/Cline ship stable PostToolUse-equivalent»).

**What this means for consumers:**
- If you run Claude Code: `PostToolUse` and `UserPromptSubmit` hooks activate automatically on install.
- If you run Cursor, Cline, or Codex: hooks are inert; you still get layers 1-4 (pre-commit, pre-push, CI, skills). No functionality is lost for those layers.

### Subscription requirement

AI-assisted workflows require a Claude Code subscription:

> **AI-assisted workflows (PostToolUse hook validation, local advisory skills) require Claude Code subscription.** The harness-hook layer and session-bound skills (e.g. `self-reflection`, `rules-as-tests`) run inside your active Claude Code session — covered by the subscription bundle, zero per-token cost. They do not run in CI and do not call the Anthropic API independently. See [docs/meta-factory/research-patches/2026-05-11-llm-usage-audit.md §5](docs/meta-factory/research-patches/2026-05-11-llm-usage-audit.md) for the full cost classification (FREE / PAID-CI / HYBRID / N/A per touchpoint).

Consumers without a Claude Code subscription: deterministic layers (pre-commit, pre-push, CI jobs) work without any subscription. Only session-bound features are affected.

---

## Expected first-run failures (this is OK)

After `bash install.sh` on a fresh project, these checks **fail intentionally** until you populate the project. Do NOT try to "fix" them by suppressing the rule:

| Command | What fails | Why it's OK | What to do |
|---|---|---|---|
| `npm run arch:check` | dependency-cruiser: no `src/domain/` | You haven't built the domain layer yet | Continue with R3 disabled until `src/domain/` exists |
| `npm run audit:docs` | R4: no `src/domain/**/*.ts` exports | No public exports yet | Re-run after first feature lands |
| `npm run validate` | typecheck: no `src/index.ts` | Empty src tree | Re-run after first source files |
| `bash scripts/audit-ai-docs.sh` | R7: no `infrastructure/clock/` | Optional infrastructure | Add when you need time injection |
| `eslint .` (R8) | `require-otel-span` on async exports without spans | OTel not wired yet | Disable R8 in `INSTALL-DECISIONS.md` if OTel isn't planned |

If a check fails for a reason not in this table — **stop and report**, do not silently disable.

---

## Verification checklist (after install)

| Check | Command | Expected |
|---|---|---|
| Skills loaded | open Claude Code, ask "what skills are available?" | Lists `rules-as-tests` (and AIF base skills) |
| Sub-agents loaded | `ls .claude/agents/living-docs-auditor.md` | File exists, ~6KB |
| TypeScript compiles | `npm run typecheck` | Exit 0 |
| Lint runs | `npm run lint` | Exit 0 (warnings OK on existing code) |
| Tests discoverable | `npx vitest run --listFiles` | Shows .unit.ts files (or empty if no tests yet) |
| Audit script runs | `npm run audit:docs` | Exit 0 with PASS/FAIL/WARN output |
| Pre-commit hook | `git commit --allow-empty -m "test"` (in test branch) | Lint-staged runs |
| Pre-push hook | `git push --dry-run` | Typecheck + tests + audit run |
| `/aif-verify` works | in Claude Code: `/aif-verify` | AIF rules-sidecar (reads RULES.md) + review-sidecar + living-docs-auditor produce output |
| Harness hooks active (Claude Code only) | `jq .hooks .claude/settings.json` | `UserPromptSubmit` + `PostToolUse` entries present (sub-wave 7.2.a/b/c) |
