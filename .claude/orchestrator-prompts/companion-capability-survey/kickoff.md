# KICKOFF — companion-capability adoption survey (R-phase)

> **Type:** R-phase (research → research-patch). **NO code** (T5). Output is a decision-bearing survey with BFR verdicts.
> **Goal:** find capabilities in our companions (Superpowers, Superset, aif-handoff) that we do NOT yet use but that would **improve the quality of our `/meta-orchestrator` working pipeline** — and recommend which to adopt, mapped to the pipeline stage each improves.
> **Base branch:** staging. **Output:** `docs/meta-factory/research-patches/2026-06-DD-companion-capability-survey.md`.
> **Mode:** Mode A (inline Agent on Opus) for the research; verify claims live.

## §0 Why

This session (2026-05-31) surfaced several companion capabilities we aren't using (seed list §2). The maintainer wants a deliberate survey: what across Superpowers / Superset / aif-handoff would make our orchestration pipeline better, and is worth adopting per build-first-reuse — instead of one-off discoveries.

## §1 The lens — map every candidate to a `/meta-orchestrator` pipeline stage
For each capability, state **which stage it improves** and **how**:
- Phase -1 (self-review of own kickoff) · Phase 0 (pre-flight) · Phase 1 (intake) · Phase 2 (plan) · Phase 3 (dispatch / Mode A·B / worktrees) · Phase 4 (control + PR) · Phase 4.5 (pre-PR self-audit) · Queue mode (autonomous multi-kickoff) · the runtime-bridge question-loop (this session's design).
A candidate that maps to no stage and no quality-gap is **out of scope** (note + drop).

## §2 Seed candidates (from 2026-05-31 DeepWiki — RE-VERIFY each against source, do NOT trust this list)
**Superpowers:** `preserving-productive-tensions` (hold multiple valid approaches — maps to Phase 2 + brainstorm/decision discipline); `when-stuck` + problem-solving set (`collision-zone-thinking`, `inversion-exercise`, `meta-pattern-recognition`, `scale-game`, `simplification-cascades` — R-phase/dead-ends); `tracing-knowledge-lineages` (project-history-book, drift-audits); **Brainstorm Visual Companion** (web-UI mockups/diagrams in brainstorming — Phase 2 UX work); `find-skills` + `writing-skills` TDD-for-docs (Claude-A-writes / Claude-B-tests).
**Superset:** `start_agent_session` (terminal/superset-chat — the question-loop auto-open per-umbrella chat); session-persistence daemon (long autonomous runs survive app close); MCP tool surface (task/workspace/device); multi-device/remote; Slack-agent precedent. ⚠ cron/scheduling — DeepWiki found NONE (re-verify); Telegram — NOT confirmed for Superset (only Slack+desktop) — re-verify.
**aif-handoff:** (beyond the bridge) any orchestration/notification/review primitives we don't use yet — survey.

## §3 Method (per phase-research-coverage.md + build-first-reuse-default.md §3)
1. **SSOT consult FIRST** — `docs/meta-factory/prior-art-evaluations.md` already has many companion entries (#43/#44/#61/#62/#65/#82/#83/#86 …). **Do NOT re-evaluate what's already there; EXTEND.** A candidate already verdicted is cited, not re-surveyed.
2. **DeepWiki** (`obra/superpowers`, `superset-sh/superset`, `lee-to/aif-handoff`) ≥3 phrasings per companion; cite. **Re-verify the §2 seed claims** (DeepWiki was wrong once this session — single-session — so source-confirm load-bearing ones).
3. **WebSearch** ≥3 phrasings for any "is there a better approach / best practice" angle.
4. Per candidate: **BFR verdict** (ADOPT / ADOPT-VOCABULARY / ADAPT / REFERENCE / KEEP-NARROW / BUILD / REJECT) + **T16 problem-class match** («their problem: X; our pipeline need: Y; match? evidence») — a capability sounding useful ≠ fitting our pipeline.

## §4 Output (research-patch)
- §1 scope + method; §2 **the table:** `capability | companion | pipeline stage | what it improves | BFR verdict | adopt-now / fast-follow / defer + trigger`; §3 **top 3-5 recommended adopt-now** (highest quality-lift, lowest cost) with rationale; §4 deferred + triggers; §5 SSOT additive rows (new `Trigger to revisit` updates or new entries — append-only per prior-art-evaluations §3); §6 §1.7 forward+backward; `## 🟢 Простыми словами`.
- Verdicts are **recommendations** — maintainer decides adoption (reviewer-discipline §2). Do NOT start adopting in this R-phase.

## §5 AI laziness traps (per `.claude/rules/ai-laziness-traps.md §2` — MANDATORY enumerate + extend)
Active: **T3** (every claim = source file:line / DeepWiki link / command output), **T5** (research-patch only, no adoption code), **T11/T12** (BFR + WebSearch before any «adopt» verdict; don't survey from training-data memory), **T13** (ADOPTED-from-companion ≠ zero-work — verify upstream evidence), **T16** (problem-class match per candidate — the headline trap here: a skill «sounds useful» but must map to a real pipeline gap), **T19** (own cold-QA on the patch before handoff), **T20** (no verdict without a tool call).
Domain-specific: **T-CCS-A** — «tempted to ADOPT a Superpowers skill because it's elegant, without a concrete pipeline gap it closes». Counter: §1 requires naming the stage + the gap; no gap → REJECT/drop, not ADOPT. **T-CCS-B** — «trusting the §2 seed list as fact». Counter: §2 is unverified DeepWiki; re-confirm each against source before it enters the table.

## §6 Read-first
1. `~/.claude/skills/orchestrator/SKILL.md` (+ `references/`) — OUR pipeline stages (the lens of §1).
2. `docs/meta-factory/prior-art-evaluations.md` — SSOT (extend, don't dup).
3. The companions: Superpowers skills (`Skill` list + `find-skills`), `superset-sh/superset` + `obra/superpowers` + `lee-to/aif-handoff` via DeepWiki.
4. `.claude/rules/build-first-reuse-default.md` + `phase-research-coverage.md` + `ai-laziness-traps.md`.
5. Related prior stub: memory `meta_orch_mode_triage_done` → «companion-reuse-deep-dive» (4 sub-waves) — reconcile / supersede / cite, don't duplicate.

## Finish REPORT with
research-patch PR# · the capability×stage×verdict table · top 3-5 adopt-now + rationale · SSOT rows added · §1.7 presence · `## 🟢 Простыми словами`.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
