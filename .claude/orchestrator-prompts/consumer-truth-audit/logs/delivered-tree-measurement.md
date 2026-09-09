# Task 4 — DELIVERED per profile, measured on the consumer TREES (not the install logs)
Measured: 2026-09-08T18:20:33Z. Trees: core=/tmp/census-consumer-core-wYlJfn env=/tmp/census-consumer-env-VXYTkl factory=/tmp/census-consumer-factory-Iwbf1j

## M1. The .claude/rules/ question — definitive, all three profiles (gate 6)
```
core-wYlJfn test -d .claude/rules -> ABSENT
core-wYlJfn find . -type d -name rules  -> ./.ai-factory/rules
core-wYlJfn any *rules* file under .claude/ -> ./.claude/agents/rule-researcher.md ./.claude/agents/rule-test-author.md ./.claude/skills/rule-tests ./.claude/skills/rule-research ./.claude/hooks/inject-matching-rule.sh 
env-VXYTkl test -d .claude/rules -> ABSENT
env-VXYTkl find . -type d -name rules  -> ./.ai-factory/rules
env-VXYTkl any *rules* file under .claude/ -> ./.claude/agents/rule-researcher.md ./.claude/agents/rule-test-author.md ./.claude/skills/rule-tests ./.claude/skills/rule-research ./.claude/hooks/inject-matching-rule.sh 
factory-Iwbf1j test -d .claude/rules -> ABSENT
factory-Iwbf1j find . -type d -name rules  -> ./.ai-factory/rules
factory-Iwbf1j any *rules* file under .claude/ -> ./.claude/agents/rule-researcher.md ./.claude/agents/rule-test-author.md ./.claude/skills/rule-tests ./.claude/skills/rule-research ./.claude/hooks/inject-matching-rule.sh 
```

## M2. Consumer tree inventories (file counts by top-level dir)
```
--- core-wYlJfn: total files = 131
     38 .claude
     20 scripts
     17 .git
     15 packages
     13 eslint-rules-local
     11 .ai-factory
      2 .husky
      2 .github
      1 vitest.config.ts
      1 tsconfig.json
      1 tests
      1 stryker.config.json
      1 package.json
      1 eslint.config.mjs
      1 AGENTS.md
      1 .prettierrc.json
      1 .prettierignore
      1 .nvmrc
      1 .lintstagedrc.json
      1 .gitignore
      1 .dependency-cruiser.cjs
--- env-VXYTkl: total files = 205
    107 .claude
     24 scripts
     17 .git
     15 packages
     13 eslint-rules-local
     12 .ai-factory
      2 .husky
      2 .github
      1 vitest.config.ts
      1 tsconfig.json
      1 tests
      1 stryker.config.json
      1 package.json
      1 eslint.config.mjs
      1 AGENTS.md
      1 .prettierrc.json
      1 .prettierignore
      1 .nvmrc
      1 .lintstagedrc.json
      1 .gitignore
      1 .dependency-cruiser.cjs
--- factory-Iwbf1j: total files = 246
    146 .claude
     25 scripts
     17 .git
     15 packages
     13 eslint-rules-local
     13 .ai-factory
      2 .husky
      2 .github
      1 vitest.config.ts
      1 tsconfig.json
      1 tests
      1 stryker.config.json
      1 package.json
      1 eslint.config.mjs
      1 AGENTS.md
      1 .prettierrc.json
      1 .prettierignore
      1 .nvmrc
      1 .lintstagedrc.json
      1 .gitignore
      1 .dependency-cruiser.cjs
```

## M3. Symlink audit (T-CTA-A adjunct: links would hide delivery truth)
```
--- core-wYlJfn symlinks: 0
--- env-VXYTkl symlinks: 0
--- factory-Iwbf1j symlinks: 0
```

## M4. Per-class DELIVERED lists (tree truth)

### skills delivered (dirs under .claude/skills/)
```
--- core-wYlJfn (6 dirs):
ai-doc/ getff/ rule-research/ rule-tests/ template-audit/ tool-bootstrapping/ 
--- env-VXYTkl (11 dirs):
ai-doc/ arch/ getff/ night-mode/ orchestrator/ pipeline/ reviewer/ rule-research/ rule-tests/ template-audit/ tool-bootstrapping/ 
--- factory-Iwbf1j (16 dirs):
ai-doc/ aif-doctor/ arch/ claude-glm-executor-handoff/ dispatcher/ getff/ harvest/ night-mode/ orchestrator/ pipeline/ reviewer/ rule-research/ rule-tests/ story/ template-audit/ tool-bootstrapping/ 
```

### agents delivered (.claude/agents/*.md)
```
--- core-wYlJfn (11):
aif-init.md capability-reuse-auditor.md claims-conformance-auditor.md compliance-verifier.md docplan-auditor.md fidelity-auditor.md living-docs-auditor.md memory-codification-auditor.md review-sidecar.md rule-researcher.md rule-test-author.md 
--- env-VXYTkl (11):
aif-init.md capability-reuse-auditor.md claims-conformance-auditor.md compliance-verifier.md docplan-auditor.md fidelity-auditor.md living-docs-auditor.md memory-codification-auditor.md review-sidecar.md rule-researcher.md rule-test-author.md 
--- factory-Iwbf1j (13):
aif-init.md capability-reuse-auditor.md claims-conformance-auditor.md compliance-verifier.md docplan-auditor.md fidelity-auditor.md living-docs-auditor.md memory-codification-auditor.md orchestrator-worker-discipline.md review-sidecar.md reviewer-discipline.md rule-researcher.md rule-test-author.md 
```

### hooks delivered (.claude/hooks/ recursive)
```
--- core-wYlJfn (11):
.claude/hooks/ask-question-reminder.sh .claude/hooks/check-doc-authority-header.sh .claude/hooks/deps-hash-check.sh .claude/hooks/end-of-turn-reminder.sh .claude/hooks/inject-matching-rule.sh .claude/hooks/inject-memory-codification.sh .claude/hooks/inject-output-language.sh .claude/hooks/inject-project-digest.sh .claude/hooks/lang/check-parity.sh .claude/hooks/lang/en.sh .claude/hooks/lang/ru.sh 
--- env-VXYTkl (11):
.claude/hooks/ask-question-reminder.sh .claude/hooks/check-doc-authority-header.sh .claude/hooks/deps-hash-check.sh .claude/hooks/end-of-turn-reminder.sh .claude/hooks/inject-matching-rule.sh .claude/hooks/inject-memory-codification.sh .claude/hooks/inject-output-language.sh .claude/hooks/inject-project-digest.sh .claude/hooks/lang/check-parity.sh .claude/hooks/lang/en.sh .claude/hooks/lang/ru.sh 
--- factory-Iwbf1j (12):
.claude/hooks/ask-question-reminder.sh .claude/hooks/check-doc-authority-header.sh .claude/hooks/deps-hash-check.sh .claude/hooks/end-of-turn-reminder.sh .claude/hooks/inject-matching-rule.sh .claude/hooks/inject-memory-codification.sh .claude/hooks/inject-output-language.sh .claude/hooks/inject-project-digest.sh .claude/hooks/lang/check-parity.sh .claude/hooks/lang/en.sh .claude/hooks/lang/ru.sh .claude/hooks/runtime-bridge-dispatch.sh 
```

### hook checks delivered (packages/core/hooks/ recursive)
```
--- core-wYlJfn (10):
packages/core/hooks/checks/cmd-script-liveness.ts packages/core/hooks/checks/guard-liveness.ts packages/core/hooks/checks/prior-art.ts packages/core/hooks/checks/s17.ts packages/core/hooks/checks/unpinned-tool-install.ts packages/core/hooks/package.json packages/core/hooks/pre-push.fallback.sh packages/core/hooks/pre-push.ts packages/core/hooks/utils/git.ts packages/core/hooks/utils/run-check.ts 
--- env-VXYTkl (10):
packages/core/hooks/checks/cmd-script-liveness.ts packages/core/hooks/checks/guard-liveness.ts packages/core/hooks/checks/prior-art.ts packages/core/hooks/checks/s17.ts packages/core/hooks/checks/unpinned-tool-install.ts packages/core/hooks/package.json packages/core/hooks/pre-push.fallback.sh packages/core/hooks/pre-push.ts packages/core/hooks/utils/git.ts packages/core/hooks/utils/run-check.ts 
--- factory-Iwbf1j (10):
packages/core/hooks/checks/cmd-script-liveness.ts packages/core/hooks/checks/guard-liveness.ts packages/core/hooks/checks/prior-art.ts packages/core/hooks/checks/s17.ts packages/core/hooks/checks/unpinned-tool-install.ts packages/core/hooks/package.json packages/core/hooks/pre-push.fallback.sh packages/core/hooks/pre-push.ts packages/core/hooks/utils/git.ts packages/core/hooks/utils/run-check.ts 
```

### principles delivered? (any principles dir/ file)
```
core-wYlJfn (count: 0)
env-VXYTkl (count: 0)
factory-Iwbf1j (count: 0)
```

### MCP + companions delivered (.mcp.json probe + settings.json mcp section)
```
core-wYlJfn .mcp.json: ABSENT
core-wYlJfn .claude/settings.json mcpServers key: 0
core-wYlJfn companions manifest / files mentioning deepwiki+context7: /tmp/census-consumer-core-wYlJfn/.claude/agents/rule-researcher.md /tmp/census-consumer-core-wYlJfn/.claude/skills/rule-research/SKILL.md 
env-VXYTkl .mcp.json: ABSENT
env-VXYTkl .claude/settings.json mcpServers key: 0
env-VXYTkl companions manifest / files mentioning deepwiki+context7: /tmp/census-consumer-env-VXYTkl/.claude/agents/rule-researcher.md /tmp/census-consumer-env-VXYTkl/.claude/skills/orchestrator/references/queue-mode.md /tmp/census-consumer-env-VXYTkl/.claude/skills/orchestrator/references/worker-template.md /tmp/census-consumer-env-VXYTkl/.claude/skills/rule-research/SKILL.md 
factory-Iwbf1j .mcp.json: ABSENT
factory-Iwbf1j .claude/settings.json mcpServers key: 0
factory-Iwbf1j companions manifest / files mentioning deepwiki+context7: /tmp/census-consumer-factory-Iwbf1j/.claude/skills/rule-research/SKILL.md /tmp/census-consumer-factory-Iwbf1j/.claude/skills/orchestrator/references/worker-template.md /tmp/census-consumer-factory-Iwbf1j/.claude/agents/rule-researcher.md /tmp/census-consumer-factory-Iwbf1j/.claude/skills/orchestrator/references/queue-mode.md 
```

## M5. Companions fate — the installer printed '6 companion(s) selected' but no .mcp.json landed
```
$ grep -n 'companion\|05-mcp\|mcp' install-core.log | head -20
36:  ▶ Stack-aware companion selection (detected: ts-server)
43:  6 companion(s) selected for stack 'ts-server'

$ where did 'superpowers'/'ast-grep' land in the factory consumer?
.claude/agents/claims-conformance-auditor.md
.claude/agents/fidelity-auditor.md
.claude/skills/orchestrator/references/discovery.md
.claude/skills/pipeline/lang/ru.sh
.claude/hooks/lang/ru.sh
.claude/skills/pipeline/references/frontier.md
.claude/skills/dispatcher/SKILL.md
.claude/skills/pipeline/SKILL.md
.claude/skills/night-mode/SKILL.md
.claude/skills/rule-tests/SKILL.md

$ companion-related files in consumer .claude:
```

## M6. Delivered checks import closure — do delivered .ts files import non-delivered modules?
```
$ grep -hE '^import|require\(' packages/core/hooks/{pre-push.ts,checks/*.ts,utils/*.ts} in the FACTORY consumer
12:import type { GitProvider } from '../utils/git.ts';
12:import { runCheck } from './run-check.ts';
19:import type { GitProvider } from '../utils/git.ts';
26:import { Linter } from 'eslint';
27:import * as tseslintParser from '@typescript-eslint/parser';
28:import corePlugin from '../../eslint-rules/index.ts';
34:import presetPlugin from '@rules-as-tests/preset-next-15-canonical/eslint-rules';
39:import { runCheck } from '../utils/run-check.ts';
42:import { runCheck, type CheckResult } from './utils/run-check.ts';
43:import { runPriorArtCheck, loadSsotIds } from './checks/prior-art.ts';
44:import { runS17Check } from './checks/s17.ts';
48:} from './checks/unpinned-tool-install.ts';
53:import { runCheck, type CheckResult } from '../utils/run-check.ts';
63:} from './utils/git.ts';

-- delivered files:
packages/core/hooks/checks/cmd-script-liveness.ts packages/core/hooks/checks/guard-liveness.ts packages/core/hooks/checks/prior-art.ts packages/core/hooks/checks/s17.ts packages/core/hooks/checks/unpinned-tool-install.ts packages/core/hooks/package.json packages/core/hooks/pre-push.fallback.sh packages/core/hooks/pre-push.ts packages/core/hooks/utils/git.ts packages/core/hooks/utils/run-check.ts 
```

## M7. Remaining per-profile lists: scripts, .ai-factory, .github, settings registrations
```
--- core-wYlJfn scripts/ (20):
scripts/audit-ai-docs.sh scripts/audit-r4.ts scripts/check-arch-boundaries.sh scripts/check-fences-fire.sh scripts/check-lintstaged-resolves.sh scripts/check-rule-enforced.sh scripts/check-rule-globs.sh scripts/check-shields-up.sh scripts/ci-available-probe.sh scripts/detect-r2-boundary.sh scripts/fences-fire-fixtures/no-unsafe-zod-parse.bad.txt scripts/fences-fire-fixtures/no-unsafe-zod-parse.good.txt scripts/fences-fire-fixtures/no-unsafe-zod-parse.manifest.json scripts/fences-fire-fixtures/require-use-server-directive.bad.txt scripts/fences-fire-fixtures/require-use-server-directive.good.txt scripts/fences-fire-fixtures/require-use-server-directive.manifest.json scripts/pre-merge-local.sh scripts/r2-na-marker.sh scripts/run-generated-rule-mutation.sh scripts/run-rule-tests-firing.sh 
--- core-wYlJfn .ai-factory/ (11):
.ai-factory/AI-USAGE-GUIDE.md .ai-factory/ARCHITECTURE.md .ai-factory/ARCHITECTURE.ts-server.md .ai-factory/DESCRIPTION.md .ai-factory/DESCRIPTION.template.md .ai-factory/RULES.md .ai-factory/refresh-baseline.json .ai-factory/rules/integration-rules.md .ai-factory/skill-context/aif-review/SKILL.md .ai-factory/skill-context/aif-rules-check/SKILL.md .ai-factory/tool-decisions.md 
--- core-wYlJfn .github/workflows/:
ci.yml workflow-integrity.yml 
--- core-wYlJfn settings.json hook registrations:
  UserPromptSubmit: deps-hash-check.sh, inject-output-language.sh", inject-project-digest.sh"
  Stop: end-of-turn-reminder.sh"
  PreToolUse: ask-question-reminder.sh"
  PostToolUse: inject-matching-rule.sh", check-doc-authority-header.sh", inject-memory-codification.sh"
  SubagentStart: inject-project-digest.sh"
  keys: ['hooks']
--- env-VXYTkl scripts/ (24):
scripts/audit-ai-docs.sh scripts/audit-r4.ts scripts/check-arch-boundaries.sh scripts/check-fences-fire.sh scripts/check-lintstaged-resolves.sh scripts/check-rule-enforced.sh scripts/check-rule-globs.sh scripts/check-shields-up.sh scripts/ci-available-probe.sh scripts/create-worktree.sh scripts/detect-r2-boundary.sh scripts/fences-fire-fixtures/no-unsafe-zod-parse.bad.txt scripts/fences-fire-fixtures/no-unsafe-zod-parse.good.txt scripts/fences-fire-fixtures/no-unsafe-zod-parse.manifest.json scripts/fences-fire-fixtures/require-use-server-directive.bad.txt scripts/fences-fire-fixtures/require-use-server-directive.good.txt scripts/fences-fire-fixtures/require-use-server-directive.manifest.json scripts/getff-work.sh scripts/link-coordination.sh scripts/pre-merge-local.sh scripts/r2-na-marker.sh scripts/run-generated-rule-mutation.sh scripts/run-rule-tests-firing.sh scripts/worktree-node-modules.sh 
--- env-VXYTkl .ai-factory/ (12):
.ai-factory/AI-USAGE-GUIDE.md .ai-factory/ARCHITECTURE.md .ai-factory/ARCHITECTURE.ts-server.md .ai-factory/DESCRIPTION.md .ai-factory/DESCRIPTION.template.md .ai-factory/RULES.md .ai-factory/refresh-baseline.json .ai-factory/rules/integration-rules.md .ai-factory/skill-context/aif-review/SKILL.md .ai-factory/skill-context/aif-rules-check/SKILL.md .ai-factory/tier-home.md .ai-factory/tool-decisions.md 
--- env-VXYTkl .github/workflows/:
ci.yml workflow-integrity.yml 
--- env-VXYTkl settings.json hook registrations:
  UserPromptSubmit: deps-hash-check.sh, inject-output-language.sh", inject-project-digest.sh"
  Stop: end-of-turn-reminder.sh"
  PreToolUse: ask-question-reminder.sh"
  PostToolUse: inject-matching-rule.sh", check-doc-authority-header.sh", inject-memory-codification.sh"
  SubagentStart: inject-project-digest.sh"
  keys: ['hooks']
--- factory-Iwbf1j scripts/ (25):
scripts/audit-ai-docs.sh scripts/audit-r4.ts scripts/check-arch-boundaries.sh scripts/check-fences-fire.sh scripts/check-lintstaged-resolves.sh scripts/check-rule-enforced.sh scripts/check-rule-globs.sh scripts/check-shields-up.sh scripts/ci-available-probe.sh scripts/create-worktree.sh scripts/detect-r2-boundary.sh scripts/fences-fire-fixtures/no-unsafe-zod-parse.bad.txt scripts/fences-fire-fixtures/no-unsafe-zod-parse.good.txt scripts/fences-fire-fixtures/no-unsafe-zod-parse.manifest.json scripts/fences-fire-fixtures/require-use-server-directive.bad.txt scripts/fences-fire-fixtures/require-use-server-directive.good.txt scripts/fences-fire-fixtures/require-use-server-directive.manifest.json scripts/getff-work.sh scripts/link-coordination.sh scripts/pre-merge-local.sh scripts/r2-na-marker.sh scripts/run-generated-rule-mutation.sh scripts/run-local-ci-sweep.sh scripts/run-rule-tests-firing.sh scripts/worktree-node-modules.sh 
--- factory-Iwbf1j .ai-factory/ (13):
.ai-factory/AI-USAGE-GUIDE.md .ai-factory/ARCHITECTURE.md .ai-factory/ARCHITECTURE.ts-server.md .ai-factory/DESCRIPTION.md .ai-factory/DESCRIPTION.template.md .ai-factory/RULES.md .ai-factory/refresh-baseline.json .ai-factory/rules/integration-rules.md .ai-factory/skill-context/aif-orchestrator-discipline/SKILL.md .ai-factory/skill-context/aif-review/SKILL.md .ai-factory/skill-context/aif-rules-check/SKILL.md .ai-factory/tier-home.md .ai-factory/tool-decisions.md 
--- factory-Iwbf1j .github/workflows/:
ci.yml workflow-integrity.yml 
--- factory-Iwbf1j settings.json hook registrations:
  UserPromptSubmit: deps-hash-check.sh, inject-output-language.sh", inject-project-digest.sh"
  Stop: end-of-turn-reminder.sh"
  PreToolUse: ask-question-reminder.sh"
  PostToolUse: inject-matching-rule.sh", check-doc-authority-header.sh", inject-memory-codification.sh"
  SubagentStart: inject-project-digest.sh"
  keys: ['hooks']
```

## M8. LAYERS.md — BY-DESIGN citation candidates (verbatim lines)
```
4:> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../README.md#why-this-exists). Layer *content* for `05-mcp` / `15-companions-stack` — those are defined in S2/S3. Profile *semantics* (which depth ships which artefacts) — see [`docs/meta-factory/research-patches/2026-07-25-beta-a-s1-inventory.md`](../docs/meta-factory/research-patches/2026-07-25-beta-a-s1-inventory.md) §2 (the binding per-profile payload inventory).
8:> **Byte-identical invariant:** all layers collectively produce a filesystem tree byte-identical to the monolithic `install.sh` for all 4 stacks (`ts-server`, `react-next`, `react-spa`, `react-native`), greenfield **and** brownfield. Proven by `tests/install-sh/byte-identical.test.sh` (golden baselines under `tests/install-sh/baselines/<stack>/`). The `core` profile (default) preserves this invariant — verified by the snapshot suite (13/13 baselines pass after the `--profile` flag landed).
10:> **Profile model (beta-delivery-ux S1, A1):** layers may gate content on `${PROFILE:-core}`. Three monotonic depths: `core` (today's default, no AIF runtime) → `env` (core + multi-model contour surface as placeholders, no AIF runtime) → `factory` (env + the AIF operator suite + runtime-bridge wiring + GLM one-button placeholder). The `factory` gate in 10-skills + 20-agents replaces the pre-profile `WITH_AIF_SUITE` flag (the legacy flag still works — install.sh resolution routes it to `PROFILE=factory`). The `env` depth is `core`-equivalent on today's payload; the contour surface it adds ships via OTHER stages (S2/S3/S4/S5), not via this stage's setup.d edits.
23:| 10 | `10-skills.sh` | §1 Skills (`skills/` → `.claude/skills/`) + §1b deps-hash-check CC hook | (none — first content layer) | Done — F7 split now gated on `PROFILE=factory` OR legacy `WITH_AIF_SUITE` (kickoff §2 re-triage) |
25:| 20 | `20-agents.sh` | §2 Sub-agents (`agents/` → `.claude/agents/`) + §3c skill-context overrides | `SHIPPED_DOCS` global (set in dispatcher) | Done — orchestrator-worker + reviewer-discipline + aif-orchestrator-discipline skill-context gated on `PROFILE=factory` OR legacy `WITH_AIF_SUITE` |
27:| 40 | `40-configs.sh` | §4 enforcement scripts + §5a shared templates + §5b' ESLint rules + barrel-gen + §6a stack configs | 30-templates (`.ai-factory/` exists) | Done |
28:| 45 | `45-python.sh` | Python toolchain delivery (ast-grep rules + `sgconfig.yml` + ruff config) with augment-first collision policy; **INERT on the npm flow** — runs only when `GETFF_TOOLCHAIN=python` (env-var contract; S2 wires the `./setup python` entry) | lib.sh (`copy_safe`/`mkdir_safe` in scope), `packages/core/templates/python/**` (S1 Task 4) | **Done (S1 Task 5)** — inert until S2 sets `GETFF_TOOLCHAIN`; npm byte-identical unaffected (guarded no-op) |
29:| 46 | `46-cargo.sh` | Rust/cargo toolchain delivery (`clippy.toml` bans + `[lints.clippy]` deny reference + `deny.toml` cargo-deny surface + `getff-cargo.yml` CI gate + cargo rules-lock) with augment-first collision policy; **INERT on the npm flow** — runs only when `GETFF_TOOLCHAIN=cargo` (`install.sh cargo` sets it) | lib.sh (`copy_safe`/`refresh_safe` in scope), `packages/core/templates/cargo/**` | **Done (ecosystem-wiring W4)** — inert until `GETFF_TOOLCHAIN=cargo`; npm/python byte-identical unaffected (guarded no-op) |
30:| 50 | `50-hooks.sh` | §5c `.husky/` hooks cluster + `core.hooksPath` activation | 40-configs (`tsconfig.json` etc. written) | Done |
31:| 55 | `55-runtime-bridge-vendor.sh` | §5d vendored runtime-bridge subset (dispatch CLI + PostToolUse hook) — **factory-only** per spec A7 | 10-skills (`.claude/` exists), 50-hooks (hook dir exists) | Done (S5 A7) — vendor COPY + hook idempotent with `setup-runtime-bridge.sh` (install-time vs runtime split) |
62:| `PROFILE` | dispatcher (flag resolution; `core` default for non-TTY) | 10 (F7 split), 20 (agents F7) — beta-delivery-ux S1 |
79:| `transform_internal_refs` | `<file>` | Rewrites `](../../../{docs,packages}/…)`, `](../../../README.md…)`, `](../../install.sh…)`, and `.claude/rules/` refs (`](../../rules/…)` skill shape + `](../.claude/rules/…)` agent shape — rules/ is not shipped) in-place to `$UPSTREAM_BLOB_URL/…` GitHub blob URLs. Leaves genuinely consumer-resolvable refs (e.g. `hooks/`) intact. |
81:| `refresh_safe` | `<src> <dst>` | Overwrites `<dst>` unless a sibling `<dst%.md>.override.md` exists (Layer-3 consumer ownership signal). Used by `--refresh` path. |
83:| `_prettierignore_in_skipped` | `<needle>` | Returns 0 if `<needle>` is already in the consumer's `.prettierignore` (used by `merge_prettierignore`). |
```

## M9. MATRIX SUMMARY — HAS × DELIVERED (tree truth; complements of the delivered lists)

| class | HAS (framework) | DELIVERED core | DELIVERED env | DELIVERED factory | never delivered (complement) |
|---|---|---|---|---|---|
| skills (16 tracked families + root getff) | 17 sources | 6 | 11 | 16 | self-reflection (tracked, 0 profiles) |
| agents | 20 | 11 | 11 | 13 | 7: adapter-jig-reviewer, backward-sweep-auditor, dispatch-input-checker, dual-channel-drift-auditor, getff-cold-run-prober, manual-rule-liveness-prober, shipped-agent-liveness-prober |
| discipline rules (.claude/rules/) | 30 | **0 — ABSENT** | **0 — ABSENT** | **0 — ABSENT** | all 30; citation: setup.d/LAYERS.md:79 «rules/ is not shipped» + transform_internal_refs rewrite |
| hooks (.claude/hooks/) | 25 | 11 | 11 | 12 | 13 (adopt-orchestrator-prompts, check-doc-authority, check-hook-marker, check-kickoff-traps, check-worker-dispatch-channel, inject-session-bootstrap, inject-subagent-context, inject-subagent-digest, lib/hook-emit.sh, precompact-residue, validate-prompt, warn-subagent-report, worktree-setup) |
| hook checks (checks/*.ts, 13 prod) | 13 prod + 12 test | 5 prod, 0 test | 5 prod, 0 test | 5 prod, 0 test | 8 prod (guard-liveness-fullsweep, pr-body-fidelity-bin, pr-body-fidelity, pr-body-prior-art-bin, pr-stale-revert-bin, pr-stale-revert, registry, skill-core-edit-scope) + all 12 tests |
| principles | 47 | 0 | 0 | 0 | all 47 (meta-tests are factory CI) |
| templates → .ai-factory/ | 5 dirs + root templates/ts-server | 11 files | 12 (+tier-home) | 13 (+orchestrator-discipline ctx) | cargo/go/python stack configs (INERT on npm flow — LAYERS.md:29-30) |
| lint bundles | eslint-rules 19 files; astgrep 4 yml; clippy; golangci; ruff | eslint-rules-local 13 + packages/core/eslint-rules 5 + ts configs | same | same | astgrep/clippy/golangci/ruff (stack lanes: python/cargo/go — GETFF_TOOLCHAIN-gated) |
| MCP config | setup.d/05-mcp.sh (context7 → .mcp.json) | none | none | none | .mcp.json ABSENT all profiles — 05-mcp.sh:13 self-gates on FULL; plain --profile run never writes it |
| companions (manifest 6 for ts-server) | 6 | 0 | 0 | 0 | selection-only display (15-companions-stack.sh:58-65); installs are consent-gated in interactive setup wrapper |
| CI workflows | ts-server: ci.yml + workflow-integrity.yml (+ cargo/go/python lanes) | 2 | 2 | 2 | repo .github/workflows/ 13 files are factory's own CI, not consumer cargo |
| scripts | 62 | 20 | 24 | 25 | 37+ factory-internal (measurement/triage/CI plumbing) |

### settings.json registrations (all profiles identical):
UserPromptSubmit: deps-hash-check.sh + inject-output-language.sh + inject-project-digest.sh; Stop: end-of-turn-reminder.sh; PreToolUse: ask-question-reminder.sh; PostToolUse: inject-matching-rule.sh + check-doc-authority-header.sh + inject-memory-codification.sh; SubagentStart: inject-project-digest.sh

### Defect-class candidates carried into WORKS (Task 5):
1. guard-liveness.ts:34 imports @rules-as-tests/preset-next-15-canonical/eslint-rules — undelivered, undeclared, not in the documented npm install line → full-mode pre-push module-load failure (consumer).
2. inject-matching-rule.sh delivered + registered, but its rule corpus (.claude/rules/, 30 files) is not shipped → capability no-op in consumer (verify at WORKS).
3. runtime-bridge-dispatch.sh delivered (factory) but sources lib/hook-emit.sh which is NOT delivered (verify guard).
4. deps-hash-check.sh delivered; verifies against .ai-factory/refresh-baseline.json (95 files) — run to confirm it passes severed.
