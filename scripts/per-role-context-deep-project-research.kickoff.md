<!-- bridge-profile: Z.AI GLM-5.2 SDK -->
<!-- scope: kickoff — per-role-context DEEP project research. One-shot exhaustive sweep of THIS repo for everything touching per-role context shaping. NOT a duplicate of the prior 3-wave GLM research — that was quick (8 subagents, ~30 file reads). This task goes EXHAUSTIVE: every package, every script, every hook, every CI workflow, every consumer-install surface. Goal: find what GLM missed. Operator-commissioned 2026-07-26. -->

# per-role-context-deep-project-research — kickoff

> **Goal:** exhaustive project sweep for everything touching per-role context — surfaces the prior quick research (3 waves, 8 subagents) did NOT cover in depth. Output is a findings dossier, NOT a recommendation.
>
> **Why this task exists:** a prior GLM research session concluded "no per-role injection exists in this repo" based on `grep -rniE 'subagent_type' .claude/hooks/`. That grep was 1 directory deep. This task sweeps every surface where per-role logic COULD live — `packages/`, `plugin/`, `tests/`, `scripts/`, `.github/`, `setup.d/`, `docs/meta-factory/`, `agents/`, `.claude/skills/**`, `.zcode/skills/**`, `~/.claude/skills/**` — and verifies (or extends) the prior claims with deeper evidence.
>
> **Output:** write `per-role-context-deep-research-report.md` to project root. No code changes. No rule proposals. No recommendation. Pure measurement + extension of the prior claims.

## §0 What this task is NOT

- NOT a duplicate of prior research. Prior = quick grep + 8 subagent reads. This = exhaustive sweep + deeper evidence.
- NOT a spec / design / rule proposal.
- NOT an opinion on whether per-role context is desirable.
- NOT a license to modify `.claude/`, `packages/`, `scripts/`, `plugin/`, or any rule. Read-only.

## §1 Reference: prior research outputs (read these FIRST, do NOT re-derive)

Read end-to-end before sweeping:

1. `docs/meta-factory/research-patches/2026-07-26-per-role-context-shaping-raw-research.md` — the 10 falsifiable claims (C1-C10) this task extends.
2. `docs/superpowers/specs/2026-07-26-per-role-context-candidate-shapes.md` — the 18 candidate shapes (context; not for evaluation here).
3. `docs/superpowers/specs/2026-07-26-per-role-context-inflight-context.md` — in-flight items on this surface.

This task EXTENDS those — finds what they missed, deepens what they asserted.

## §2 Exhaustive sweep targets (cover ALL of these — do not skip)

For EACH target: state what you searched, what you found (file:line), and whether the finding EXTENDS / CONFIRMS / REFUTES a prior claim (cite the claim ID C1-C10).

### S1 — `packages/` runtime-bridge (deepest gap in prior research)

Prior research read `packages/runtime-bridge/src/cli/dispatch.ts` only. Sweep the ENTIRE package:

- `packages/runtime-bridge/src/**/*.ts` — every file. Look for: per-role logic, `subagent_type` handling, role-based dispatch branching, role-based context shaping.
- Specifically: `AifHandoffBackend.ts`, `ManualBackend.ts`, `resolver.ts`, `kickoff.ts`, `idempotency.ts`, `aifWsStatus.ts`. Does any of them vary behavior by role?
- `packages/runtime-bridge/src/cli/*.ts` — does `answer.ts`, `park.ts`, `questions.ts`, `await.ts`, `harvest.ts`, `ensure-parallel.ts`, `openQuestion.ts` carry role information?

Record: which files were read, which (if any) contain per-role logic, which contain role-adjacent logic (model tier, tool surface, etc.) without explicit per-role branching.

### S2 — `plugin/` (the consumer-shipped plugin twin)

The repo ships a `plugin/` directory that mirrors `.claude/hooks/` for consumer install. Sweep:

- `plugin/hooks/*` — are these byte-identical to `.claude/hooks/`? (`diff -r`) If they diverge, where?
- `plugin/agents/*` — what agents ship to consumers? Do any of them carry per-role context shaping that the maintainer-env `.claude/hooks/` doesn't?
- `plugin/skills/*` (if exists) — consumer-shipped skills. Per-role content?

### S3 — `packages/core/` (the consumer install composition layer)

- `packages/core/composition/**` — the Convention IR + composition logic that generates stack-specific rules at install time. Does it have a per-role concept?
- `packages/core/hooks/**` — test fixtures for the hook surface. Any per-role test that prior research missed?
- `packages/core/templates/**` — generator templates. Per-role content?

### S4 — `tests/` (test coverage of per-role surfaces)

- `tests/**` — any test that exercises per-role context, subagent dispatch with role, hook behavior by role?
- `tests/aif-doctor/**` (if exists) — the doctor's classification logic; does it mention role?
- `tests/install-sh/baselines/**` — baseline fingerprints. Any per-role delta?

### S5 — `scripts/` (deeper than prior research)

Prior research checked `scripts/inject-*.sh`, `scripts/render-*.mjs`, `scripts/task-brief`, `scripts/review-package`, `scripts/host-verify.sh`. Sweep the REST:

- `scripts/*.sh` — every script not yet read. Any per-role logic?
- `scripts/*.mjs` — render scripts. `render-harness-config.mjs` was mentioned in passing; read it fully. `render-rule-index.mjs` — does it carry role metadata?
- `scripts/setup-*.sh`, `scripts/install-*.sh`, `scripts/build-*.sh` — install/build machinery. Per-role install paths?

### S6 — `.github/` (CI surface)

- `.github/workflows/**` — every workflow. Does any job branch by role? Does any job inject role-specific context?
- `.github/actions/**` — composite actions. Per-role content?

### S7 — `setup.d/` (companion install manifest)

- `setup.d/**` — companion install engine. Per-role install logic?
- Cited by `companion-install-principle.md` rule but not deeply audited in prior research.

### S8 — `agents/` (agent prompt files — extend prior research)

Prior research read `agents/fidelity-auditor.md`, `agents/orchestrator-worker-discipline.md`, `agents/backward-sweep-auditor.md`. Sweep ALL of `agents/*.md`:

- For EACH agent: is its context payload role-specific? (Probably yes — but is the per-role-ness *deliberate* or accidental?)
- Is there a role taxonomy in `agents/` that prior research missed?
- Are there agents that SHOULD have per-role trim but don't?

### S9 — `.claude/skills/**` AND `.zcode/skills/**` AND `~/.claude/skills/**`

Prior research read 3 wrapper skills (arch/pipeline/dispatcher). Sweep ALL skills:

- `.claude/skills/*/SKILL.md` — every skill. Per-role context?
- `.zcode/skills/*/SKILL.md` — every skill (this is the parallel tree).
- `~/.claude/skills/*/SKILL.md` — global skills (operator-local). Per-role content?
- Specifically check: `night-mode`, `harvest`, `orchestrator`, `claude-glm-executor-handoff`, `night-mode`, `aif-doctor`, `story`, `template-audit`, `tool-bootstrapping`, `rule-research`, `rule-tests`, `pipeline`, `dispatcher`, `arch`. (Prior research touched some; read all.)

### S10 — `docs/meta-factory/` (prior-art SSOT + execution plan)

- `docs/meta-factory/prior-art-evaluations.md` — full read. Find any prior-art entry that touches per-role context, role-based dispatch, context isolation, progressive disclosure. Prior research's negative-existence claim (12-phrase grep, zero matches) — re-verify with a DEEPER grep (more phrases, semantic match).
- `docs/meta-factory/EXECUTION-PLAN.md` — does it carry role taxonomy?
- `docs/meta-factory/open-questions.md` — any open question about per-role context?
- `docs/meta-factory/research-patches/*.md` — sweep ALL patches for per-role context mentions.

### S11 — `.claude/rules/*.md` (extend prior research)

Prior research checked for `role-context-budget` rule synonyms (12-phrase grep). Sweep DEEPER:

- Re-grep with semantic phrases: `per role`, `role-specific`, `worker only`, `reviewer only`, `planner only`, `brainstormer`, `implementer`, `subagent context`, `dispatch context`, `kickoff role`, `role marker`, `role tag`, `role prime`.
- For each rule that mentions any role name (worker/reviewer/planner/etc.): is the mention role-shaping, or just role-naming?

### S12 — `CLAUDE.md` AND `~/.claude/CLAUDE.md` AND `MEMORY.md`

- `CLAUDE.md` — the project's session-start canonical doc. Per-role content?
- `~/.claude/CLAUDE.md` — operator-global. Per-role content?
- `MEMORY.md` — operator memory. Per-role content?
- The «Artifact Ownership Contract» cited in prior research — read it fully. Does it carry per-role discipline beyond the 2026-05-09 incident?

## §3 Specific questions to answer (load-bearing for the fabla)

For each, give a yes/no/PARTIAL answer with file:line evidence:

1. **Q1.** Does the repo have ANY mechanism (hook, script, rule, agent prompt, CI job, install path) that branches behavior by agent role? (Prior research said NO. Verify with the exhaustive sweep.)
2. **Q2.** If Q1 is NO: is there any **partially-built** per-role machinery that was started but not finished? (e.g. `subagent_type` preservation in `inject-subagent-context.sh:62` — are there OTHER partial implementations?)
3. **Q3.** Does the 6-block input contract (`.zcode/skills/claude-glm-executor-handoff/SKILL.md:52-71`) have any sibling/parallel implementation elsewhere in the repo?
4. **Q4.** Is there a per-role concept in `packages/core/composition/` that the maintainer-env hooks don't expose?
5. **Q5.** Are there any 2-altitude review patterns (like `/arch §2`) elsewhere — e.g. in `agents/`, in `night-mode`, in `harvest` — that prescribe different context payloads per seat?
6. **Q6.** Re-verify the negative-existence claim: NO SSOT prior-art entry for per-role context shaping. Run the deeper grep from §S10.
7. **Q7.** What's in `MEMORY.md` and `~/.claude/CLAUDE.md` related to roles that prior research missed (it only read the project `CLAUDE.md` Artifact Ownership Contract)?

## §4 Output format

Write `per-role-context-deep-research-report.md` to project root:

```markdown
# Per-role context — DEEP project research report

**Sweep date:** <timestamp>
**Sweeper:** aif-handoff container (live Claude Code runtime)
**Scope:** exhaustive — 12 surfaces (S1-S12), all of packages/, plugin/, tests/, scripts/, .github/, setup.d/, agents/, .claude/skills/**, .zcode/skills/**, ~/.claude/skills/**, docs/meta-factory/, .claude/rules/, CLAUDE.md, ~/.claude/CLAUDE.md, MEMORY.md.

## Findings by surface (S1-S12)

### S1 — packages/runtime-bridge
<files read, per-role logic found or not, claim extension/confimation/refutation>

### S2 — plugin/
...

### S3-S12 — ...

## Answers to load-bearing questions (Q1-Q7)

| Q | Prior claim | Deep-sweep finding | Verdict |
|---|---|---|---|
| Q1 | "no per-role branching" | ... | CONFIRMED/REFUTED/EXTENDED |
| Q2 | (not asked) | ... | ... |
| ... | ... | ... | ... |

## What prior research missed

<highest-value section — list everything the deep sweep found that the prior 3-wave research did not>

## What prior research got right

<confirmed prior claims — quick list>

## Surprises / anomalies

<anything unexpected>
```

## §5 Constraints

- **Read-only.** No code/rule/doc modifications.
- **Exhaustive but time-boxed.** If a surface is huge (e.g. `tests/` has thousands of files), sample systematically and state the sampling method. Don't grind.
- **No recommendations.** This task reports findings. The fabla decides.
- **Cite file:line for every claim.** No prose-only assertions (T3 trap).
- **Self-application.** This task's own artifacts (this kickoff, the report) are part of the surface — note their existence but don't audit yourself.

## §6 See also

- The 3 prior research outputs (§1).
- The parallel runtime-probe task (P1-P6) — verify the live runtime behavior; this task verifies the source-code surface exhaustively.
- The parallel cold-review task — reviews the prior 3 deliverables for overreach/errors.
