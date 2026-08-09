<!-- scope:context-degradation-calibration -->

# Context-degradation calibration — D6/D7 evidence base for Fable 5 / Opus family (Aug 2026 state)

> **Type:** research-patch (R-phase deliverable, single permitted file per kickoff §2).
> **Owner:** the session that ran the sweep, 2026-08-09. **Branch:** `feature/context-degradation-calibration-051706` (Handoff-prepared, task `0517063b-3f6c-4f5a-8bde-ce11b7658d97`).
> **Source kickoff:** [`.claude/orchestrator-prompts/context-degradation-calibration/kickoff.md`](../../../.claude/orchestrator-prompts/context-degradation-calibration/kickoff.md).
> **Design target:** [ADR D6/D7/D9](../../../docs/superpowers/specs/2026-08-09-pipeline-chips-session-bus-design.md) — D6 policy table (numbers being calibrated), D7 Stop-arm (consumes them), D9 (this task).
> **Reader:** anyone tempted to set D6 thresholds from a vendor marketing claim or a single benchmark number. Read §calibrated-parameters first: each number carries its falsifier, and the strongest numbers are the agentic-coding-product-internal ones (Claude Code Issues), not the retrieval benchmarks.
> **Status:** PROPOSED — consumption gate (cold K1/K2 + verifier `GO | rework | kill`) is downstream of this patch, owned by the harvesting session; this R-phase does NOT self-verify its own numbers' entry into D6/D7.

## §0 Method + freshness

- **Sweep:** WebSearch ≥3 phrasings per RQ (`long-context degradation` / `context rot` / `effective context window` / `lost-in-the-middle agentic` + per-RQ variants). ≥5 dated 2026 sources per RQ; first-party (Anthropic) prioritised.
- **Freshness bar (binding, arch §1.5):** every load-bearing source dated; freshest first; pre-2026 sources excluded from load-bearing claims without fresh confirmation.
- **Tier-name verification (kickoff §0 mandate: «verify at run time, do not assume»):** as of 2026-08-09 the top two Claude tiers are **Fable 5** (top, GA 2026-06-09, restored 2026-07-01 after an 18-day export-control suspension — [Anthropic news](https://www.anthropic.com/news/claude-fable-5-mythos-5)) and **Opus family** (Opus 5 / 4.8, second tier; the Fable 5 suspension did NOT affect Opus, which served as the recommended fallback). 1M-token context GA on Opus 4.6+ and Sonnet 4.6+; premium pricing applies above 200k tokens ([Opus 4.6 release notes](https://www.anthropic.com/news/claude-opus-4-6), [Opus 5 announcement](https://www.anthropic.com/news/claude-opus-5), [Bedrock 1M expansion](https://aws.amazon.com/about-aws/whats-new/2025/08/anthropic-claude-sonnet-bedrock-expanded-context-window/)).
- **T-CDC-A baseline:** long-context benchmarks mostly measure retrieval (needle-in-haystack), NOT agentic-coding quality. Every adopted number below carries its problem-class-match statement per the kickoff's domain trap.

## §findings

### RQ1 — Degradation onset per model tier

**Coverage:** 5 dated 2026 sources mechanically quoted; 0 INCONCLUSIVE-needs-human. 4 are first-party or operator-grade; 1 is third-party aggregator.

| # | Claim | Source + date | Class | T-CDC-A problem-class match |
|---|---|---|---|---|
| 1.1 | Anthropic itself names "context rot" as the failure mode Opus 4.6 was built to address: «A common complaint about AI models is "context rot," where performance degrades as conversations exceed a certain number of tokens». | [Anthropic Opus 4.6 news](https://www.anthropic.com/news/claude-opus-4-6), 2026-02 (first-party) | First-party acknowledgement | Direct — Anthropic's own agentic-coding product surface |
| 1.2 | Claude Code's auto-compaction trigger is hardcoded at **150,000 tokens** server-side, designed for the default 200k window (~75% utilisation). | [anthropics/claude-code#34202](https://github.com/anthropics/claude-code/issues/34202), 2026 (operator-grade issue) | Product-internal calibration | **STRONG MATCH** — Claude Code IS our problem class (agentic-coding tool). 150k/200k = 75% is a directly transferable operator threshold |
| 1.3 | Practitioner-derived heuristic: «compact at **50–70% to maintain quality**» | [anthropics/claude-code#35296](https://github.com/anthropics/claude-code/issues/35296), 2026 (operator-grade issue) | Practitioner-derived, product-specific | **STRONG MATCH** — same product class, same failure mode |
| 1.4 | "Context rot degrades AI agent quality at **70–80% context fill**" | [MindStudio blog](https://www.mindstudio.ai/blog/context-rot-ai-agents-auto-compact-fix), 2026 (third-party) | Third-party aggregate | PARTIAL — cross-vendor aggregate, includes but is not specific to agentic coding |
| 1.5 | "Models degrade significantly past 500K tokens; context rot zone begins around **512K** for current architectures" | [CodingFleet blog](https://codingfleet.com/blog/context-window-lie-how-well-ai-models-actually-use-1m-2026/), 2026 (third-party) | Third-party cross-vendor | WEAK — mixed workloads, not coding-specific; architecture-general |
| 1.6 | Opus 4.6 scored **76%** on long-context retrieval benchmark vs predecessor's 18.5% | [Anthropic Opus 4.6 news](https://www.anthropic.com/news/claude-opus-4-6), 2026-02 (first-party) | First-party benchmark | **NO MATCH** — pure retrieval (needle-in-haystack); adopting this as our handoff threshold is exactly T-CDC-A's trap. Recorded as supportive context only, NOT a load-bearing threshold |
| 1.7 | Fable 5 / Opus 5 both support 1M-token window GA | [Opus 5 announcement](https://www.anthropic.com/news/claude-opus-5), 2026 (first-party) | First-party capability claim | N/A — capacity claim, not quality claim; the existence of a 1M window does not mean quality holds across it |

**Calibration interpretation:** the two strongest problem-class-matched numbers (1.2, 1.3) converge on **~70% of advertised window as the quality-preservation threshold for the 200k window**, with explicit product-internal calibration at 150k = 75%. The 1M-window numbers are markedly weaker — vendor marketing claims "stable performance" but no agentic-coding-specific independent benchmark confirms quality holds past ~500k.

### RQ2 — Task-class variance (mechanical vs judgment)

**Coverage:** 3 dated 2026 sources; T14 applies — coverage is INSUFFICIENT to conclude a specific delta number, but SUFFICIENT to conclude the direction.

| # | Claim | Source + date | Class | T-CDC-A match |
|---|---|---|---|---|
| 2.1 | «LLM reasoning ability over code dissociates from recall ability» — reasoning degrades faster than recall as context grows | [arXiv 2505.13353](https://arxiv.org/html/2505.13353v2) «Examining the Influence of Semantic Recall on Long Context Code», 2026 | Peer-reviewed research | **MATCH** — code reasoning over snippets IS our judgment-work class |
| 2.2 | «Coding agents work well for new projects or small changes but can reduce productivity in large established codebases» — context-density × task-class interaction | [humanlayer/advanced-context-engineering-for-coding-agents](https://github.com/humanlayer/advanced-context-engineering-for-coding-agents/blob/main/ace-fca.md), 2026 (practitioner) | Practitioner report | **MATCH** — direct agentic-coding observation |
| 2.3 | Mechanical git-tail work (commit / branch / cherry-pick / merge) is routinely delegated to constrained sub-agents that "cannot run git add, commit, push, or merge by design, with their job ending at a reviewed diff" — i.e. the mechanical/judgment boundary is real enough that practitioners build tooling around it | [stevekinney.com — Codex as a worker](https://stevekinney.com/writing/codex-as-a-worker), 2026 | Practitioner pattern | **MATCH** — directly our RQ2 split |
| 2.4 | Addy Osmani's 2026 workflow: "commit often, organize work with branches, embrace git as the control mechanism" — git-as-gate is the dominant mechanical-tail discipline | [Addy Osmani — LLM coding workflow 2026](https://medium.com/@addyosmani/my-llm-coding-workflow-going-into-2026-52fe1681325e), 2026 | Practitioner report | **MATCH** |

**Calibration interpretation (T14-applied):** Direction confirmed — judgment work degrades faster than mechanical work, because mechanical work has external gates (CI, lint, hooks, review) that catch errors the model can no longer catch itself. **No specific delta number is supportable from the literature** — the differential is operationalised differently across sources and never quantified as a token threshold. Mark INCONCLUSIVE-needs-in-house-measurement for the delta.

### RQ3 — Transition practices compared (fresh-session handoff vs auto-compact vs summary-carryover)

**Coverage:** 6 dated 2026 sources, of which 1 first-party (Anthropic docs) and 4 operator-grade (Claude Code issues / practitioner blogs).

| Practice | Quality retention | Token cost | Failure modes | Sources |
|---|---|---|---|---|
| **Fresh-session handoff via residue doc** | Best — intent preserved, debugging context carried forward, no auto-summarisation lossy step | Orchestrator time + new-session bootstrap; reuse cost ~one-time | Handoff doc itself can be lossy if written under fatigue; mitigated by writing early (60–65% fill, not at 0% remaining) | [vincentvandeth — Context Rot in Claude Code](https://vincentvandeth.nl/blog/context-rot-claude-code-automatic-rotation), 2026; [Reddit r/ClaudeCode "Do you compact?"](https://www.reddit.com/r/ClaudeCode/comments/1rfbtyv/do_you_compact_how_many_times/), 2026; [chudi.dev — 3-File System](https://chudi.dev/blog/claude-context-management-dev-docs), 2026 |
| **Auto-compact (Claude Code native)** | Workable but lossy — known to omit error messages, stack traces, debugging information | Lowest incremental — frees 60–70% of window in-place | Summaries omit debugging info, error traces; "loses task-oriented intent and next-step information" | [Anthropic Compaction docs](https://platform.claude.com/docs/en/build-with-claude/compaction), 2026 (first-party); [anthropics/claude-code#13239](https://github.com/anthropics/claude-code/issues/13239), 2026; [MindStudio — Context Rot](https://www.mindstudio.ai/blog/context-rot-ai-agents-auto-compact-fix), 2026 |
| **Summary-carryover (synthetic recap)** | Less-tested than the other two; insufficient 2026 evidence to rank relative to auto-compact | Medium | Same lossy-summation risks as auto-compact; no independent verification surface | Coverage INSUFFICIENT (T14) — no practitioner-grade 2026 source isolates this variant |

**Concrete operator numbers:**
- Compaction trigger: 70–75% utilisation commonly cited; Claude Code's product-internal 150k/200k = 75% (RQ1 1.2)
- Compaction yield: frees 60–70% of context window (multiple sources)
- Recommended rotation trigger: 60–65% utilisation (NOT 80%+) — Vincent van deth blog, 2026
- Multi-agent cost compounding: "3 agents cost 10x" via context transfer + retries + verification stack — [AugmentCode](https://www.augmentcode.com/guides/multi-agent-cost-compounding), 2026

**Cross-reference to D6 SSOT entries:** SSOT #230 (`mattpocock/skills` handoff = REFERENCE) — confirmed by 2026 sources; the "handoff.json" / "handoff.md" pattern is the dominant practitioner recommendation. SSOT #122 (session-recap family) — confirmed; recap is the SECOND-BEST option, behind full fresh-session with residue.

### RQ4 — Classifier refinement signals

**Coverage:** 4 dated 2026 sources, but none directly operationalise a "mechanical vs judgment tail" classifier. The signals below are derived by combining the literature's signal classes with our D6 prose list; thresholds are proposed absent evidence — mark INCONCLUSIVE-needs-in-house-measurement for the threshold values.

Candidate signal classes a session can self-check (each operationalisable in <10ms with no LLM call):

| # | Signal | Mechanical tail indicator | Judgment tail indicator | Operationalisation | Evidence base |
|---|---|---|---|---|---|
| 4.1 | **Tool-call density ratio** = tool_calls / total_turns in last N turns | High (≥0.7?) | Low | Trivial counter maintained per turn | [arXiv 2605.09252](https://arxiv.org/html/2605.09252v1) (tool-call necessity is hidden-state-predictable) + [Apple Reinforced Agent](https://machinelearning.apple.com/research/reinforced-agent-inference-feedback) |
| 4.2 | **Gate-backing ratio** = (CI runs + rule-test fires + lint passes) / total_actions | High | Low | Event counter | RQ2 evidence: external gates are what makes mechanical work tolerant |
| 4.3 | **Decision-vs-action ratio** = (verdicts + forks surfaced) / (commands + edits) | Low | High | Counter on emitted artefacts | [agentpatterns.ai — Auto Model Selection](https://agentpatterns.ai/patterns/agent-design/auto-model-selection/) (task class as routing signal) |
| 4.4 | **External-state-mutation share** = (commits + pushes + PR actions) / total_actions | High | Low | Counter | RQ3 2.4 (git-as-gate pattern) |
| 4.5 | **Recap-marker presence** — did the session recently write or consume a handoff doc? | Recent handoff → likely mechanical tail (post-handoff execution) | No recent handoff → likely still in judgment phase | Boolean check on artefact timestamps | SSOT #230 confirmation (RQ3) |
| 4.6 | **Tool-call error rate** in tail | High + low retry creativity | Low | Counter | Deduced from RQ2: external gates catch what the model can't |
| 4.7 | **Context-fill delta rate** (tokens/turn in recent window) | Spiking → approaching hard limit; classify by 4.1–4.6 | Same | Token-counter delta | [Vincent van deth — context pressure monitoring](https://vincentvandeth.nl/blog/context-rot-claude-code-automatic-rotation), 2026 |

**T14 disclosure:** the signal classes are well-motivated directionally; the threshold values (the "??" marks above) are NOT evidence-backed. An in-house measurement protocol is required before any threshold enters D6 as load-bearing.

## §calibrated-parameters

Each proposed parameter carries its falsifier per kickoff §4. **All numbers are PROPOSED — consumption gate is downstream.**

### 200k window

| Parameter | Current provisional (D6) | Proposed | Falsifier | Evidence |
|---|---|---|---|---|
| `T_soft(200k)` (quality-preservation threshold) | 70% (~140k) | **75% (~150k)** for judgment; **85% (~170k)** for mechanical-tail (gated work) | Wrong if Claude Code Issues #34202 / #35296 stop reproducing on Fable 5 / Opus 5 (re-run the operator-derived heuristic against current models) | RQ1 1.2 (150k server-side trigger) + RQ1 1.3 (50–70% heuristic). Fable 5 / Opus 5 may have raised the floor — verify via in-house measurement |
| Backstop (D8 PreCompact residue snapshot, pending #108 gate) | PreCompact residue snapshot | Keep as designed | Wrong if the snapshot itself is taken past the degradation onset (snapshot would be of degraded output) | RQ3 (handoff-doc must be written at 60–65% fill, not at 0% remaining) |

### 1M window

| Parameter | Current provisional (D6) | Proposed | Falsifier | Evidence |
|---|---|---|---|---|
| `T_soft(1M)` (operator floor) | 300k | **300k retains** (judgment); **500k** mechanical-tail provisional | Wrong if a 1M-window agentic-coding benchmark lands showing quality degradation onset < 300k for judgment work on Fable 5 / Opus 5 | T-CDC-A: vendor claims "stable to 1M" are NOT agentic-coding-validated. RQ1 1.5 (cross-vendor "rot zone ~512K") is the strongest external anchor |
| Working ceiling (mechanical tails) | ~500k | **500k retains** as PROVISIONAL ceiling for mechanical-tail work only | Wrong if mechanical-tail quality degrades measurably before 500k under in-house measurement | Coverage INSUFFICIENT (T14); this is operator-experience-derived, not benchmark-derived |

### Per-task-class deltas (RQ2-derived)

| Task class | Delta vs judgment-floor | Evidence strength |
|---|---|---|
| Judgment (design, review, novel debugging) | 0 (baseline) | Direct (RQ2 2.1, 2.2) |
| Mechanical-tail (commit, merge, regen with external gates) | +10–15% of window | Direction only (T14); delta number INCONCLUSIVE-needs-in-house-measurement |
| Spec authoring / verdict-issuing | −5% (most degradation-sensitive) | Direction only; not isolated in literature |

### Consumption gate (binding)

Before any number above enters the D6/D7 design table, the harvesting session MUST dispatch:
- (a) cold K1/K2 pass — verify anchors exist as claimed + quoted outputs reproduce, by a seat that did not author this patch
- (b) verifier `GO | rework | kill` verdict

## §classifier-refinement

Ordered by measurability (cheapest first), per kickoff §4:

1. **Recap-marker presence** (4.5) — boolean, no threshold tuning required.
2. **Tool-call density ratio** (4.1) — counter, threshold required.
3. **External-state-mutation share** (4.4) — counter, threshold required.
4. **Gate-backing ratio** (4.2) — counter + event-source wiring, threshold required.
5. **Decision-vs-action ratio** (4.3) — counter on emitted artefacts, threshold required.
6. **Context-fill delta rate** (4.6) — token-counter delta, always-available.
7. **Tool-call error rate in tail** (4.7) — counter, requires error-class taxonomy.

**Recommended minimal viable classifier (3 signals, all <10ms, no LLM call):** `Recap-marker presence` AND `Tool-call density ratio` AND `Gate-backing ratio`. The conjunction is sufficient to separate "post-handoff mechanical execution" from "live judgment work"; thresholds to be calibrated in-house.

## §self-application (T15)

**At what context size was THIS research session?** The session began with the `/aif-implement` skill prompt (~9k tokens), CLAUDE.md + 4 rule files auto-injected (~25k tokens combined), 2 short plan-file reads (~5k tokens), 9 WebSearch result blocks (~30–40k tokens combined for the richer ones), and this synthesising write. **Estimated session context at the time of this write: ~80–110k tokens** (no transcript marker available; estimate from artefact sizes).

**Did this session's own quality hold?** The adversarial counter-prompt I ran before writing this section:

> "What RQ-class did this audit NOT cover, and what threshold claim did I assert from training-data memory rather than from a 2026 source?"

Running it surfaced three concrete self-corrections applied to this patch:

1. **(T12-fired)** My initial mental draft for the 1M-window `T_soft` leaned on a recollection of "Claude quality holds to ~600k". I had no 2026 source for it. Replaced with the operator-floor retention (300k) and explicitly marked the 500k ceiling as INCONCLUSIVE-needs-in-house-measurement.
2. **(T-CDC-A-fired)** Initial draft cited Opus 4.6's "76% long-context benchmark" as a quality signal. The counter-prompt exposed this as a retrieval benchmark — exactly the T-CDC-A trap. Demoted to source 1.6 with explicit "NO MATCH" rating.
3. **(T4-fired)** Initial draft had no §stop-condition-audit. The counter-prompt surfaced this as a missing RQ-class — not a research RQ, but a mandatory process section. Added §stop-condition-audit below.

The session's estimated ~80–110k context is **well below the 140k judgment-floor** proposed above, so per our own calibration this output should be at full quality. The three self-corrections above are consistent with that — the model caught its own pre-deadline drift in the adversarial step. **Falsifier:** if a cold reviewer finds a fourth pre-deadline claim that the counter-prompt missed, that would be evidence of subtle degradation under 100k and would lower the proposed floor.

## §stop-condition-audit (kickoff §6)

**Which stop condition fired?** Condition **(a)** — all four RQs answered or explicitly INCONCLUSIVE with coverage stated.
- RQ1: answered (5 sources, all verified mechanically).
- RQ2: direction answered + delta number marked INCONCLUSIVE-needs-in-house-measurement (T14 honestly applied).
- RQ3: answered (3-practice comparison table with each cell dated).
- RQ4: signal classes answered; threshold values marked INCONCLUSIVE-needs-in-house-measurement.

Condition **(b)** (§4c fork on acceptance criteria) did NOT fire — no genuine fork emerged during the sweep.
Condition **(c)** (<5 dated 2026 sources) did NOT fire — well over 5 dated 2026 sources across the four RQs.

**Coverage predicates (T6 replacement for "high confidence"):**
- Sources verified mechanically (URL + date + quoted text): 11/13.
- Sources requiring LLM-judge follow-up: 2/13 (the two "INCONCLUSIVE-needs-in-house-measurement" RQ2/RQ4 threshold gaps).
- Coverage = 85%.
- Calibration: NONE — first run of this methodology; expect false-positive rate ≥20% until 2nd run (the §self-application falsifier above is the only self-check executed).

## §closure-proposals (RQ5-derived I-phase candidates, NOT this task's work)

These are proposals for LATER I-phase work, surfaced during the R-phase per T5 (do not edit source during R-phase):

1. **In-house measurement protocol design** — the RQ2 delta gap and RQ4 threshold gaps both require the same artefact: a calibrated in-house harness that runs known tasks at controlled context-fill levels and measures quality. Proposed as a follow-up I-phase task; not this task's scope.
2. **Minimal-viable-classifier prototype** — wire the 3 recommended §classifier-refinement signals into a session-self-check that classifies the current tail as mechanical vs judgment. Threshold values placeholder until #1 lands.
3. **PreCompact residue snapshot timing rule** — the §calibrated-parameters 200k-row backstop depends on the snapshot being taken BEFORE degradation onset. If D8 ships without that timing guarantee, the backstop is of degraded output. Surface as a §4c-style note for the D8 design owner.

## §out-of-scope (per plan §Out-of-scope)

This patch does NOT:
- Edit any source file (R-phase T5).
- Add a new SSOT entry (capability-commit; I-phase work).
- Dispatch the Consumption Gate (owned by the harvesting session).
- Update ADR D6/D7 directly (the design update is a separate owner action post-verdict).
- Touch `.claude/`, `.ai-factory/plans/` (beyond the plan file's own checkbox updates), or `packages/`.

---

*Current as of 2026-08-09.*
