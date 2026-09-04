# KICKOFF — R-phase: rule-enforcement channel selection (just-in-time, no-bloat, no-memory)

ROLE: Orchestrator, Queue/Research mode. Read-only research wave → output is a research-patch. NO code edits, NO PRs to source beyond the patch itself.

WORKDIR: /Users/art/code/rules-as-tests-aif (own worktree from origin/main).
PROJECT: rules-as-tests-aif — meta-framework whose goal is «AI agents can't silently bypass codified conventions; every rule = executable artifact failing at the earliest REACHABLE channel». Read README.md#why-this-exists + .claude/rules/build-first-reuse-default.md + .claude/rules/phase-research-coverage.md before dispatch.

## §0 Why this wave (origin)
Session 2026-05-22: the agent repeatedly stumbled over the codified automerge→staging flow despite it being in memory. Root insight (maintainer): «remember reliably» ≠ «put in memory» (memory = stage-0, unreliable). Reliable = force-fed every prompt OR mechanically gated — but always-on injection of every rule bloats context. The open design problem: deliver the RIGHT rule at the RIGHT moment, reliably, without context bloat. Before codifying our own «channel-selection» principle, survey prior art (BFR-default).

## §1 Core question
What is the state of the art for delivering an operating rule to an AI coding agent **at the moment it is relevant** — reliably (not memory-dependent) and without always-on context bloat? Return a build-vs-reuse verdict matrix for our «narrowest-reachable-channel» model.

Draft principle to validate/refute against prior art (do NOT assume correct):
> Persist each rule at the NARROWEST channel that still reliably catches its violation. Channel breadth ∝ how often the rule is relevant. Ladder: mechanical gate (fires on the action, 0 standing cost) > context-triggered injection (scoped to path/tool/task) > always-on prompt digest (reserve for 3-4 sweeping invariants) > memory (last resort, stage-0).

## §2 Surfaces to survey — COMPANION-FIRST (Tier 1 primary; this is **N2b** — an extension of N2 adopt-from-companion to the *rule-delivery axis*, beyond N2's already-resolved vocabulary/worktree tasks — plus N5 give-back, per niche-strategy roadmap §4. Do NOT re-litigate N2's closed tasks; this is the new rule-delivery sub-axis.)
Priority order is load-bearing: research OUR companions FIRST and DEEPEST (per feedback_ai_doc_research_priority_pool + build-first-reuse-default — reuse from allies before generic ecosystem before BUILD). For EACH companion candidate: (a) how does it deliver a rule/convention to the agent — always-on vs CONDITIONAL (path/tool/task-scoped) vs mechanical-gate? (b) our-problem-class match? evidence. (c) BFR verdict. (d) **give-back angle (N5):** does OUR substrate have something they lack on this axis?

**Tier 1 — OUR named companions (PRIMARY, deepest sweep, DeepWiki ≥3 phrasings each):**
1. **Superpowers** (`obra/superpowers`) — skills, `when_to_use`/trigger discipline, 1% rule, hard-gates, hooks. How are rules scoped to the moment?
2. **aif-handoff** (`lee-to/aif-handoff`) — Planner/Implementer/Reviewer, RuntimeAdapter, HANDOFF_MODE, git-isolation. How are constraints delivered per phase/role?
3. **AI Factory / AIF** (`lee-to/ai-factory`) — skill install + scope hierarchy, security-scan gate. Rule delivery + conditional loading?
4. **OhMyOpencode** (`code-yeongyu/oh-my-opencode`, rebranded from `oh-my-openagent`) — its rule/context/agent-config mechanisms (cutting-edge per research-priority-pool; if slug stale, WebFetch its README).
(Add any other companion the README/roadmap names; if a repo can't be resolved on DeepWiki → mark INCONCLUSIVE, fall to WebFetch of its README.)

**Tier 2 — native harness we build ON (Claude Code):** hooks (PreToolUse / UserPromptSubmit / PostToolUse / Stop), CLAUDE.md + @-imports, skills `when_to_use` conditional triggering, output-styles, settings. Which give CONDITIONAL (path/tool/task-scoped) delivery vs static always-on? (This is the substrate; verify what's natively possible before proposing BUILD.)

**Tier 3 — broader ecosystem (CONTEXT only, lighter sweep, counters training-data bias):** Cursor `.cursor/rules` glob-scoped, Cline (rules + Memory Bank), Continue.dev glob rules, guardrails/policy-as-code (NeMo Guardrails, Guardrails AI, OPA/Rego, husky/Lefthook), memory systems (MemGPT/Letta — WHY unreliable for behavioural rules), context-engineering research (just-in-time / progressive disclosure; Anthropic context-engineering guidance; AgentSpec arxiv 2503.18666). WebSearch ≥3 phrasings.
- **Multi-agent orchestration frameworks (most directly-analogous conditional-delivery class — do NOT skip):** LangGraph conditional edges, CrewAI process conditions, AutoGen agent filter functions, Dify/Flowise workflow condition nodes. These are production «fire at the relevant action, not always-on» implementations.
- **From the project's own research-priority-pool (`feedback_ai_doc_research_priority_pool`):** Devin Playbooks; **arxiv:2602.20478 «Codified Context»** (hot/warm/cold three-tier rule architecture — directly the bloat-vs-reliability tradeoff this wave studies; high-priority read).

## §3 Method (MANDATORY — BFR-default §3 + phase-research-coverage §1 checklist — currently 10 items, header still mislabels "6-item")
- **§1.1 own-stack sweep:** enumerate `package.json` deps (husky, remark, tsx, vitest); ask «does any ship conditional rule delivery?» (expected: none — document explicitly; skipping makes any «no analog» claim provisional per §1.5).
- DeepWiki `ask_question` ≥3 phrasings per repo-level candidate.
- WebSearch ≥3 phrasings per domain term («conditional context injection AI agent», «just-in-time rules LLM agent», «scoped agent rules glob», «agent guardrails fire on tool call»).
- context7 EXCLUDED (library-API docs, not «does X solve problem-class Y» — build-first-reuse-default.md §3 caveat).
- **§1.9 SSOT-citation existence check:** any SSOT row you PROPOSE by ID must reference a real next-free ID — verify against prior-art-evaluations.md at run time (current max = 59 → next = 60).
- **§1.10 type-system over prose:** any claim about Claude Code hook payload fields / SDK contracts (e.g. «PostToolUse can block», «UserPromptSubmit injects context») must cite the actual type/doc, not memory — dual-channel verify (claude-code-guide + DeepWiki) per queue-mode §CC-claims.
- **§1.6 trigger sweep:** this is a survey, not a formal phase entry → trigger-sweep waived; note the waiver in §1.7 rather than skipping silently.
- Every factual claim: DeepWiki/WebSearch URL or file:line. No prose-only findings.
- HARD CONSTRAINT: no-paid-llm-in-ci.md — any proposed mechanism deterministic OR AI-agnostic-subagent (no API-billed CI calls).

## §4 Deliverable
ONE research-patch: docs/meta-factory/research-patches/2026-05-22-rule-enforcement-channel-selection.md
**Format = prior-art SURVEY, not a gap-patch** — its sections differ from research-patches/README.md's gap-patch template; the ≤100-LOC cap does NOT apply at survey scale (precedent: `2026-05-16-companion-target-comparison.md` ~338 LOC, `2026-05-21-niche-strategy-and-growth-roadmap.md`). Stay under the 500-line pre-commit hard cap. Use companion-target-comparison.md as the format precedent.
**SSOT verdict mapping** (BFR taxonomy → SSOT enum when proposing rows): BFR REFERENCE→SSOT DEFER; KEEP-NARROW→WATCHLIST; ADOPT→ADOPT; REJECT→REJECT; BUILD→DEFER-with-«build, no upstream» rationale (BUILD is not a native SSOT verdict).
- §Prior-art survey: per-candidate (capability / our-problem-class match evidence / BFR verdict ADOPT|ADOPT-VOCAB|ADAPT|REFERENCE|KEEP-NARROW|BUILD|REJECT).
- §The channel-selection principle: validated / refuted / refined against prior art (adversarially test it).
- §What to ADOPT/REUSE vs the genuine BUILD gap, with integration-cost estimate for BUILD verdicts.
- §Proposed SSOT rows (prior-art-evaluations.md, propose in-text, do NOT write — next free ID).
- §1.7 forward+backward self-reflexive note.
- §Recommended home for codifying our principle (self-reflection skill / new rule / CLAUDE.md) IF prior art confirms BUILD/ADAPT — surfaced, maintainer decides (reviewer-discipline §2).

## §5 AI-laziness traps (per .claude/rules/ai-laziness-traps.md §3 — cite + enumerate + extend)
Active: T1 (sampling floor ≥5, depth ≥ §2 list), T3 (file:line/URL per claim), T4 (no premature closure — this is a pure «when do I stop» wave with no external done-criterion; hit ALL Tier-1 companions + ≥2 Tier-2 + the multi-agent class before declaring done), T7 (run the adversarial counter-prompt), T11 (prior-art BEFORE proposing — the whole point), T12 (don't skip sweep on «I already know Cursor rules»), T13 (ADOPTED ≠ zero-work — verify each upstream solves OUR class), T15 (self-application: does this research persist its OWN finding at the right channel, not memory?), T16 (pattern-match-on-name — CENTRAL).
Domain-specific:
- **T-Ch-A:** tool advertises «rules»/«memory»/«context» → AI assumes CONDITIONAL just-in-time delivery. Counter: verify PATH/TOOL/TASK-SCOPED loading, not static always-on. Write «Conditional? evidence: …» per candidate.
- **T-Ch-B:** «we have a hook» = «solved». Counter: verify the hook fires at the RELEVANT action with zero standing cost, not merely «a hook exists».

## §6 Phase -1
Before dispatch, cold-review THIS kickoff (1× Opus): stale refs, ambiguity, missing constraints, T-enumeration substance. Address BLOCKER/MAJOR, then proceed.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
