# Rule-research LIVE adapter — Phase 1 implementation kickoff

> **Scope:** implement Phase 1 of the rule-research live adapter per the approved design spec. Phase 0 (live-research prototype + design + reviewer pass) is COMPLETE. NOT authoritative for project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).

> **Session type (binding):** an INTERACTIVE Claude Code session in the worktree. Phase-1 code is deterministic ($0, no MCP) — but the ONE optional confidence step (live e2e of the skill) needs context7/deepwiki MCP, so run interactively, NOT aif. Venue decided 2026-06-29 (maintainer): new interactive session.

## §0 Authoritative brief — READ FIRST

[`docs/superpowers/specs/2026-06-29-rule-research-live-adapter-design.md`](../../../docs/superpowers/specs/2026-06-29-rule-research-live-adapter-design.md) is the full, reviewer-passed design (REVISE folded). This kickoff is the thin dispatch pointer; the spec is the brief. Read it whole before acting.

## §1 Where you are

- **Worktree:** `/Users/art/code/rat-rule-research` · **branch:** `feat/rule-research-live-adapter` (off `staging` @ #794) · `node_modules` installed.
- **Phase 0 DONE (this branch):** spec written + committed; reviewer verdict REVISE→fixed (MAJOR-1 `.ai-factory` gitignore / fixture-path); generate-half prototype gate **PROVEN** — a fresh agent-authored `no-head-element` selection → `synthesizeGenerate` + L4 → `declarative`, `ok:true`, fires on `<head />`, clean on `<Head />`. (Prototype was scratch, deleted.)

## §2 First move

1. Read the spec (§0).
2. `Skill('superpowers:writing-plans')` → produce the Phase-1 implementation plan from spec §9.
3. Implement per the plan. The deterministic tail (`generate.ts`/L4/`install.ts`/`buildLock`) is **untouched** — only the research+generate SOURCE changes.

## §3 Phase 1 build list (from spec §9 — full detail there)

1. `FileResearchClient` + `FileGenerateClient` (thin readers; spec §6) — carry `Prior-art:#183`.
2. Wire `rule-bootstrap-cli.ts` (`--from-research` + `--from-selection`; default = stubs) + the **MAJOR-1 manual-drop backstop** (a live candidate routed to `check.type:'manual'` is dropped + logged loudly, never shipped inert).
3. Wire `setup.d/80-rule-bootstrap.sh` — pass the two files when present; degrade + guidance when absent (Decision B; never stub-fallback on the consumer path).
4. `agents/rule-researcher.md` (portable canon, AI-agnostic protocol) + thin `.claude/skills/rule-research/SKILL.md` trigger (`@dual-pair`, `# spec:`). Not capability commits.
5. Deterministic $0 test: committed fixtures under `packages/core/synthesizer/fixtures/` (the `no-head-element` demo; **NOT** `.ai-factory/` — gitignored) flow `--from-research`/`--from-selection` → factory → real `rules-lock.json` in a `mkdtemp` root; a manual candidate is dropped, not shipped. Mirror `rule-bootstrap.test.ts`.

## §4 Hard constraints (full in spec §4–§8, §11–§13)

- **Both ports live** (research + generate) — the honest Done; research-only = T-RBI-A masquerade (spec §4-A).
- **MAJOR-1 L4-expressibility filter** is first-class: the skill/agent proposes a `GenerateCandidate` ONLY for single-file `presence:'forbid' + selector` practices; non-expressible (e.g. `server-only`, cross-file) → research-only finding, NEVER a manual rule (spec §5).
- **Provenance verified-at-author-time:** the agent really fetches the canonical official-doc URL + stores a quoted excerpt; allowlist host-gate is the backstop (spec §7).
- **Portable-first** (Q3): `agents/rule-researcher.md` is canon; CC skill is a thin wrapper (spec §8).
- **$0-in-CI** (principle 17): live MCP only in the human session; tail tested with stubs. **Demo rule = `no-head-element`** (distinct from the stub's `no-img`). **Ledger deferred** (Decision C). **SSOT #183**.

## §5 AI-laziness traps (per [ai-laziness-traps.md §3](../../rules/ai-laziness-traps.md))

Active: **T3** (re-read every spec `file:line` — confirm still fresh vs current `origin/staging`; the spec is grounded at #794, re-verify before building) · **T11/T12** (author `agents/rule-researcher.md` from the proven prototype + real MCP behaviour, NOT from memory) · **T16** (tool-bootstrapping is ADAPT — state the X/Y problem-class match; the propose/gate internals re-derive) · **T15** (self-application: the bridge generates CONSUMER rules, not the framework's own — name it, #798 §10) · **T-RBI-A successor** (the PR/commit body states honestly what is live vs what is still stubbed/CI-only).

## §6 Pre-flight (orchestrator discipline)

- Re-probe in-flight: `gh pr list --head feat/rule-research-live-adapter --state all` + `git log origin/staging..HEAD` — no parallel session on this branch before dispatching Workers.
- Phase -1 self-review applies to any ≥30-line Worker prompt you write.

## §7 Done

Spec §1 Done-state: `./setup --full` on react-next → LIVE research → real `ResearchPlan` + `GenerateSelection` → factory → real `rules-lock.json` with a genuinely-researched executable rule + firing test; `$0`-in-CI; PR → `staging`.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
