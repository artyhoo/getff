# Rule-bootstrapping LIVE adapter — agent-driven MCP research → real ResearchPlan (Q1=A)

> Scope: the NEXT slice after the rule-bootstrapping spike (#801). Swap the spike's `stubRuleResearch` for a LIVE, agent-driven research path that uses context7/deepwiki MCP to research a stack's real practices → a validated `ResearchPlan` → the EXISTING deterministic factory/lock tail (untouched). NOT authoritative for project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).

> **Session type (binding):** an INTERACTIVE Claude Code session WITH `context7` + `deepwiki` MCP connected. **NOT an aif dispatch** — live MCP research is agent-session work, and MCP is unavailable inside the aif container (R-phase #798 §2). Do NOT `dispatch.ts` this kickoff.

> **Q1 DECIDED = A (agent-driven)** — maintainer decision 2026-06-28 (the fork #798 §3 parked). The research runs in the consumer's interactive `./setup --full` agent session via a skill, NOT as a TS adapter calling MCP from code (Option B rejected: it would drag an MCP-client dependency duplicating the already-provisioned channel — `#parallel-evolution-creep`, build-first-reuse-default §4).

## §0 What already exists (the spike landed the skeleton — re-confirm each `file:line`)

The spike (#801, on `staging`) built the deterministic SKELETON. The live adapter changes ONLY the research source; everything below is REUSED unchanged:

- **The seam to fill:** `packages/core/synthesizer/rule-research-port.ts` — `RuleResearchClient.research(detection) → ResearchPlan` (the interface); `stubRuleResearch` returns a FIXED `_NEXT_IMAGE_PLAN`. The file header marks itself the plug-in point for the live adapter. **This is what you replace.**
- **The consume contract (REUSE):** an agent-written `ResearchPlan` JSON is validated by `validateResearchPlan` (`packages/core/research/validate-plan.ts`, exported `research/index.ts`) and loaded via the synth CLI's `--from-research <path>` mode (`packages/core/synthesizer/cli.ts:43`). This is the Option-A glue: agent writes findings → file → deterministic tail consumes.
- **The ResearchPlan shape (target the live output at this):** `packages/core/research/types.ts` — `ResearchPlan = { framework, version, patterns: ResearchEntry[], missing, drift }`; `ResearchEntry = { id, summary, bestPractices[], antiPatterns[], provenance: Provenance[] }`.
- **Provenance discipline (REUSE + respect):** `packages/core/research/allowlist.ts` — `ALLOWED_SOURCES` (nextjs.org/vercel.com, react.dev, tailwindcss.com, typescriptlang.org) + `validateProvenance` (https + host-match). Live findings MUST carry allowlist-valid provenance, or the slice deliberately extends the allowlist (a surfaced decision, not a silent edit).
- **The deterministic tail — DO NOT TOUCH:** `packages/core/synthesizer/rule-bootstrap.ts` (`runRuleBootstrap`), `generate.ts` (`synthesizeGenerate`), `generate-cli.ts` (`runGeneratePath`), `validator/validate.ts` (L4), `installer/install.ts` (`install`/`buildLock`). The spike proved these; the live adapter must not change them (only the research input differs).
- **The install gate (REUSE, may extend):** `setup.d/80-rule-bootstrap.sh` — FULL-gated step calling `packages/core/install/rule-bootstrap-cli.ts`. Today the CLI uses `stubRuleResearch`; under A it must consume the agent-written findings instead.
- **The agent-research precedent to ADAPT (not copy):** `.claude/skills/tool-bootstrapping/SKILL.md:19,23` — researches MCPs via context7 → persists `.ai-factory/tool-decisions.md`. The live rule-adapter is its mirror for RULES (the 6-rule loop ADAPTs per #798 §9 T16 — propose/gate internals re-derive).
- **Design basis (read fully):** [docs/meta-factory/research-patches/2026-06-28-rule-bootstrapping.md](../../../docs/meta-factory/research-patches/2026-06-28-rule-bootstrapping.md) (#798) — §3 (Q1, now decided A), §4 (the seam), §5 (rules-decisions ledger), §8 (no-paid-LLM gating), §13 (recommended architecture). The architecture is largely designed there; your job is to VALIDATE it by prototyping the live research, fill the skill-protocol gaps, then implement.

## §1 Phase 0 — brainstorm / R-phase (design + prototype; interactive, MCP-on)

Invoke `superpowers:brainstorming` first. Then:

1. **Prototype the LIVE research (the load-bearing unknown).** Actually run `context7` + `deepwiki` on react-next (e.g. "next/image vs raw img", "no server-only imports in client components"). See what real findings come out. **Map them by hand to the `ResearchEntry`/`ResearchPlan` shape** (`research/types.ts`) and run them through `validateResearchPlan` + `validateProvenance`. Goal: confirm live findings can become a schema-valid, allowlist-valid ResearchPlan — or surface exactly where they don't (that gap reshapes the design). Do NOT design the protocol from memory (T11/T12).
2. **Design the skill** (`.claude/skills/rule-research/` proposed): the research protocol (which MCP per question, query budget, dedupe, provenance→allowlist mapping), the consent/UX (mirror tool-bootstrapping's confirm-bulk + token-economy gate, ADAPTed), and where the `ResearchPlan` file lands (`.ai-factory/rules-research/<stack>.json` proposed).
3. **Decide the genuine forks (surface to maintainer — do NOT guess; reviewer-discipline §2):**
   - Does the `--full` step **spawn** the research agent, or rely on the human's interactive session running the skill then a second `./setup` pass consuming the file via `--from-research`? (#798 §3 Option-A leans interactive-session.)
   - Is the `.ai-factory/rules-decisions.md` ledger (#798 §5) **in this slice** or the slice after?
   - Does this warrant a **new SSOT row** or extend **#183** (whose row already names the live adapter as the next slice)? Likely cite #183; new row only if a distinct capability-class emerges (e.g. the ledger).
4. **Self-review** the design with one cold reviewer before implementing (own-QA-before-handoff).

## §2 Phase 1 — implement (only after Phase-0 design is settled)

- **Build the live `RuleResearchClient`** (replaces `stubRuleResearch` on the `--full` path): under A this is largely "read the agent-written, validated `ResearchPlan` file" + the skill that produces it. Keep the `RuleResearchClient` interface unchanged (the seam holds).
- **Wire the `--full` path** so live research feeds the tail (via `--from-research` or an equivalent in `rule-bootstrap-cli.ts`), leaving `stubRuleResearch` as the CI/test injection.
- **Tests ($0-in-CI):** the MCP research is session-bound and NOT CI-tested (by design). Add a deterministic test that a *sample agent-written* `ResearchPlan` flows `--from-research` → factory → real `rules-lock.json` (mirror the spike's `rule-bootstrap.test.ts`). The live research itself is validated in-session, never in CI.
- **Capability commit:** any new ≥80-LOC TS under `packages/` carries a `Prior-art:` trailer citing **#183** (the live adapter realizes #183's BUILD; re-grep max id, no new row unless a distinct capability lands). The skill markdown is not a capability commit.

## §3 Hard constraints

- **$0-in-CI (principle 17):** live MCP research runs ONLY in the consumer's interactive `./setup --full` session — never in CI, never an API-billed call. The deterministic tail stays CI-safe with stub injection. Re-confirm `tests/agnosticism/probes/paid.sh` stays green.
- **Don't touch the proven tail:** `generate.ts` / L4 / `install.ts` / `buildLock` unchanged — only the research SOURCE changes.
- **Build-first-reuse:** REUSE `--from-research`/`validateResearchPlan`, the allowlist, and the tool-bootstrapping research pattern (ADAPT). Do NOT re-provision MCP in code (that is the rejected Option B).
- **Opted-out path byte-identical:** non-`--full` install unchanged; the live step is FULL-gated like the spike's `setup.d/80-rule-bootstrap.sh`.

## §4 AI-laziness traps (per [ai-laziness-traps.md §3](../../rules/ai-laziness-traps.md))

Active: **T11/T12** (prototype the real MCP research; don't invent the protocol from memory) · **T16** (tool-bootstrapping is ADAPT, not verbatim — rule-synthesis ≠ tool-selection; state the X/Y problem-class match) · **T15** (self-application: does the live adapter generate the framework's OWN rules, or only consumer rules? name it honestly, #798 §10) · **T3** (re-read every `file:line` in §0 — the spike just landed; lines are fresh but verify) · **T-RBI-A successor** — do NOT let a thin prototype masquerade as the full live adapter; the PR/commit body must state honestly what works live vs what's still stubbed.

## §5 Done

`./setup --full` on a react-next consumer runs LIVE context7/deepwiki research → a real (not stubbed) `ResearchPlan` with allowlist-valid provenance → the existing factory → a real `rules-lock.json` carrying a genuinely-researched rule + its guarding test. $0-in-CI preserved (deterministic tail tested with a sample findings file; live research session-only). Capability commit carries `Prior-art:#183`. Commit on a feature branch off `staging`.

## §6 See also

- [docs/meta-factory/research-patches/2026-06-28-rule-bootstrapping.md](../../../docs/meta-factory/research-patches/2026-06-28-rule-bootstrapping.md) — R-phase design (§3 Q1, §4 seam, §5 ledger, §8 gating, §13 architecture).
- `.claude/orchestrator-prompts/rule-bootstrapping-iphase-spike/kickoff.md` — the spike this continues (skeleton + the parked-fork resolution to Option-1 gate placement).
- [.claude/rules/ai-laziness-traps.md](../../rules/ai-laziness-traps.md), [build-first-reuse-default.md](../../rules/build-first-reuse-default.md), [reviewer-discipline.md](../../rules/reviewer-discipline.md), [no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
