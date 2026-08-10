<!-- scope:context-degradation-calibration -->

# Context-degradation calibration — D6/D7 evidence base for Fable 5 / Opus family (Aug 2026 state)

> **Type:** research-patch (R-phase deliverable, single permitted file per kickoff §2).
> **Owner:** the session that ran the sweep, 2026-08-09. **Branch:** `feature/context-degradation-calibration-051706` (Handoff-prepared, task `0517063b-3f6c-4f5a-8bde-ce11b7658d97`).
> **Source kickoff:** [`.claude/orchestrator-prompts/context-degradation-calibration/kickoff.md`](../../../.claude/orchestrator-prompts/context-degradation-calibration/kickoff.md).
> **Design target:** [ADR D6/D7/D9](../../../docs/superpowers/specs/2026-08-09-pipeline-chips-session-bus-design.md) — D6 policy table (numbers being calibrated), D7 Stop-arm (consumes them), D9 (this task).
> **Reader:** anyone tempted to set D6 thresholds from a vendor marketing claim or a single benchmark number. Read §calibrated-parameters first: each number carries its falsifier, and the strongest numbers are the agentic-coding-product-internal ones (Claude Code Issues), not the retrieval benchmarks.
> **Status:** PROPOSED — consumption gate (cold K1/K2 + verifier `GO | rework | kill`) is downstream of this patch, owned by the harvesting session; this R-phase does NOT self-verify its own numbers' entry into D6/D7.
> **Revision 2 (2026-08-10, harvesting session):** round-1 cold fidelity audit returned `REVISE` (5 MAJOR). The rework is recorded inline: [§search-coverage](#search-coverage) is new and **falsifies two of this patch's own negative-existence claims**; RQ1 now carries a per-tier disposition; the `T_soft(200k)` direction is **parked** as a §4c fork instead of silently proposed; the unsourced `85%` is demoted to the same INCONCLUSIVE marker as its siblings; four citation dates are corrected. Cross-owner edit per [CLAUDE.md `Artifact Ownership Contract`](../../../CLAUDE.md) — separate atomic commit, rationale in its body.

## §0 Method + freshness

- **Sweep:** WebSearch ≥3 phrasings per RQ (`long-context degradation` / `context rot` / `effective context window` / `lost-in-the-middle agentic` + per-RQ variants). ≥5 dated 2026 sources per RQ; first-party (Anthropic) prioritised.
- **Freshness bar (binding, arch §1.5):** every load-bearing source dated; freshest first; pre-2026 sources excluded from load-bearing claims without fresh confirmation.
- **Tier-name verification (kickoff §0 mandate: «verify at run time, do not assume»):** as of 2026-08-09 the top two Claude tiers are **Fable 5** (top, GA 2026-06-09; suspended 2026-06-12, restored 2026-07-01 — reason not stated by the source, do not attribute one — [Anthropic news](https://www.anthropic.com/news/claude-fable-5-mythos-5)) and **Opus family** (Opus 5 / 4.8, second tier; the Fable 5 suspension did NOT affect Opus, which served as the recommended fallback). 1M-token context GA on Opus 4.6+ and Sonnet 4.6+; premium pricing applies above 200k tokens ([Opus 4.6 release notes](https://www.anthropic.com/news/claude-opus-4-6), [Opus 5 announcement](https://www.anthropic.com/news/claude-opus-5), [Bedrock 1M expansion](https://aws.amazon.com/about-aws/whats-new/2025/08/anthropic-claude-sonnet-bedrock-expanded-context-window/)).
- **T-CDC-A baseline:** long-context benchmarks mostly measure retrieval (needle-in-haystack), NOT agentic-coding quality. Every adopted number below carries its problem-class-match statement per the kickoff's domain trap.

## §findings

### RQ1 — Degradation onset per model tier

**Coverage (restated rev 2 — rev 1's arithmetic did not reconcile with its own table):** 8 rows over
7 distinct sources. First-party 3 (1.1, 1.6, 1.7) · operator-grade 2 (1.2, 1.3) · third-party blog 2
(1.4, 1.5) · peer-reviewed benchmark 2 (1.8, 1.9, added rev 2). Dated **2026**: 6 of 8 — rows 1.8
(2025-11) and the AWS 1M-GA link in §0 (2025-08) are pre-2026 and are therefore directional only,
never threshold sources. 0 `INCONCLUSIVE-needs-human`.

**Per-tier disposition (rev 2 — the RQ1 question is «onset *per model tier*», and rev 1 answered it
for one tier while reporting it answered for both):**

| Tier | Degradation-onset evidence | Disposition |
|---|---|---|
| **Opus family** (Opus 5 / 4.8 / 4.6) | rows 1.1, 1.6 are Opus-4.6-specific; rows 1.2, 1.3 are Claude Code product-internal and apply to whatever model the harness runs | **ANSWERED** — but note 1.2/1.3 are harness-level, i.e. model-agnostic by construction |
| **Fable 5** (top tier) | **none numeric.** A dedicated sweep (4 phrasings, [§search-coverage](#search-coverage) item F) returned only qualitative first- and third-party statements — «more consistent reasoning quality as context grows», «precision drops at the far end of the window» — plus one unattributed «safer working range ≈800k» from a low-trust aggregator, which is not adoptable | **COVERAGE INSUFFICIENT TO CONCLUDE** (T14). Every number in §calibrated-parameters is Opus-family- or harness-derived and is **NOT validated for Fable 5.** Falsifier: a dated 2026 source reporting Fable-5 quality against context fill on an agentic-coding task |

| # | Claim | Source + date | Class | T-CDC-A problem-class match |
|---|---|---|---|---|
| 1.1 | Anthropic itself names "context rot" as the failure mode Opus 4.6 was built to address: «A common complaint about AI models is "context rot," where performance degrades as conversations exceed a certain number of tokens». | [Anthropic Opus 4.6 news](https://www.anthropic.com/news/claude-opus-4-6), 2026-02 (first-party) | First-party acknowledgement | Direct — Anthropic's own agentic-coding product surface |
| 1.2 | Claude Code's auto-compaction trigger is hardcoded at **150,000 tokens** server-side, designed for the default 200k window (~75% utilisation). | [anthropics/claude-code#34202](https://github.com/anthropics/claude-code/issues/34202), 2026 (operator-grade issue) | Product-internal calibration | **STRONG MATCH** — Claude Code IS our problem class (agentic-coding tool). 150k/200k = 75% is a directly transferable operator threshold |
| 1.3 | Practitioner-derived heuristic: «compact at **50–70% to maintain quality**» | [anthropics/claude-code#35296](https://github.com/anthropics/claude-code/issues/35296), 2026 (operator-grade issue) | Practitioner-derived, product-specific | **STRONG MATCH** — same product class, same failure mode |
| 1.4 | "Context rot degrades AI agent quality at **70–80% context fill**" | [MindStudio blog](https://www.mindstudio.ai/blog/context-rot-ai-agents-auto-compact-fix), 2026 (third-party) | Third-party aggregate | PARTIAL — cross-vendor aggregate, includes but is not specific to agentic coding |
| 1.5 | "Models degrade significantly past 500K tokens; context rot zone begins around **512K** for current architectures" | [CodingFleet blog](https://codingfleet.com/blog/context-window-lie-how-well-ai-models-use-1m-tokens-2026/), 2026-05-29 (third-party) | Third-party cross-vendor | **NO MATCH, corrected rev 2** — the article's metric set is MRCR v2 / NIAH-2 / Graphwalks / NoLiMa, i.e. **retrieval**, the same class row 1.6 is demoted for. Rev 1 rated this WEAK and then leaned on it as «the strongest external anchor» for the 1M row; both were wrong. Kept as directional context only |
| 1.6 | Opus 4.6 scored **76%** on the MRCR v2 8-needle 1M variant; **Sonnet 4.5** scores 18.5% on the same variant (not «Opus 4.6's predecessor» — corrected rev 2) | [Anthropic Opus 4.6 news](https://www.anthropic.com/news/claude-opus-4-6), 2026-02-05 (first-party) | First-party benchmark | **NO MATCH** — pure retrieval (needle-in-haystack); adopting this as our handoff threshold is exactly T-CDC-A's trap. Recorded as supportive context only, NOT a load-bearing threshold |
| 1.8 *(rev 2)* | **LoCoBench-Agent** — «the first long-context LLM agent benchmark for software engineering», evaluates agents across **10K–1M tokens**; reports agents «exhibit remarkable long-context robustness» alongside a **comprehension-efficiency trade-off** (thorough exploration raises comprehension, lowers efficiency) | [arXiv 2511.13998](https://arxiv.org/abs/2511.13998), submitted 2025-11 | Peer-reviewed benchmark | **STRONG MATCH on task class** (agentic SWE, not retrieval), **but pre-2026** — enters as directional confirmation, not as a threshold source, per the §0 freshness bar. Its existence falsifies rev 1's «no agentic-coding-specific independent benchmark» claim — see [§search-coverage](#search-coverage) |
| 1.9 *(rev 2)* | **SlopCodeBench** — measures how coding agents degrade over **long-horizon iterative tasks**: structural erosion rises in **77%** of trajectories, verbosity in **75.5%**; agent code is 2.3× more verbose and 2.0× more eroded than 473 human repos; best agent passes **14.8%** of checkpoints; explicit quality guidance cut initial erosion by up to a third but **did not change the degradation rate across turns** | [arXiv 2603.24755](https://arxiv.org/abs/2603.24755), submitted 2026-03-25, rev 2026-05-07 | Peer-reviewed benchmark | **STRONG MATCH on failure mode** (agentic-coding quality decay, not retrieval) — **but the axis is turns/checkpoints, not tokens**, so it cannot be converted into a token threshold. It is the strongest evidence that degradation is real for our class; it is *not* evidence for any particular `T_soft` |
| 1.7 | Fable 5 / Opus 5 both support 1M-token window GA | [Opus 5 announcement](https://www.anthropic.com/news/claude-opus-5), 2026 (first-party) | First-party capability claim | N/A — capacity claim, not quality claim; the existence of a 1M window does not mean quality holds across it |

**Calibration interpretation:** the two strongest problem-class-matched numbers (1.2, 1.3) converge on **~70% of advertised window as the quality-preservation threshold for the 200k window**, with explicit product-internal calibration at 150k = 75%. **Note the tension rev 1 glossed:** 1.2 (150k = 75%) is the point at which the product *force-compacts* — the top of the working range — whereas 1.3 (50–70%) is where practitioners say quality *starts* to go. They are not the same quantity, and reading them as «converging on 75%» conflates a ceiling with a soft threshold. This is the fork parked at [§parked-questions](#parked-questions).

For the 1M window, rev 1 claimed «no agentic-coding-specific independent benchmark confirms quality holds past ~500k». **Rev 2 falsifies that as written** ([§search-coverage](#search-coverage) item A): LoCoBench-Agent (1.8) evaluates agentic SWE to 1M and reports robustness with an efficiency cost, and SlopCodeBench (1.9) measures agentic-coding decay directly. What survives is a **narrower** and still-load-bearing claim: *no dated 2026 source expresses agentic-coding quality as a function of **token fill** past ~500k* — 1.8 predates the freshness bar, 1.9's axis is turns rather than tokens, and 1.5's axis is retrieval. The gap is a **unit** gap, not an absence of literature.

### RQ2 — Task-class variance (mechanical vs judgment)

**Coverage (restated rev 2):** 5 rows. Dated **2026**: 2 (2.3, 2.5) — rows 2.1 (2025-05) and 2.4
(2025-12) are pre-2026 and rev 1 mislabelled both as «2026»; corrected below. T14 applies — coverage
is INSUFFICIENT to conclude a specific delta number, but SUFFICIENT to conclude the direction, and
the direction now has one dated-2026 quantitative anchor (2.5) rather than none.

| # | Claim | Source + date | Class | T-CDC-A match |
|---|---|---|---|---|
| 2.1 | «LLM reasoning ability over code dissociates from recall ability» — reasoning degrades faster than recall as context grows | [arXiv 2505.13353](https://arxiv.org/abs/2505.13353) «Sense and Sensitivity: Examining the Influence of Semantic Recall on Long Context Code Understanding» — **v1 2025-05-19, v2 2025-05-20** (ACL 2026 main; acceptance year ≠ revision date — rev 1 cited this as «2026», corrected rev 2) | Peer-reviewed research | **MATCH on class** — code reasoning over snippets IS our judgment-work class — **but pre-2026**, so under the §0 freshness bar it may not carry a load-bearing claim alone. Its fresh confirmation is row 2.5 |
| 2.2 | «Coding agents work well for new projects or small changes but can reduce productivity in large established codebases» — context-density × task-class interaction | [humanlayer/advanced-context-engineering-for-coding-agents](https://github.com/humanlayer/advanced-context-engineering-for-coding-agents/blob/main/ace-fca.md), 2026 (practitioner) | Practitioner report | **MATCH** — direct agentic-coding observation |
| 2.3 | Mechanical git-tail work (commit / branch / cherry-pick / merge) is routinely delegated to constrained sub-agents that "cannot run git add, commit, push, or merge by design, with their job ending at a reviewed diff" — i.e. the mechanical/judgment boundary is real enough that practitioners build tooling around it | [stevekinney.com — Codex as a worker](https://stevekinney.com/writing/codex-as-a-worker), 2026 | Practitioner pattern | **MATCH** — directly our RQ2 split |
| 2.4 | Addy Osmani's going-into-2026 workflow: «commit often, organize your work with branches, and embrace git» as the control mechanism — git-as-gate is the dominant mechanical-tail discipline | [Addy Osmani — LLM coding workflow](https://medium.com/@addyosmani/my-llm-coding-workflow-going-into-2026-52fe1681325e), **2025-12-19** (rev 1 dated it «2026»; the title's «2026» is its subject, not its date — corrected rev 2) | Practitioner report | **MATCH on class**, pre-2026 → directional only |
| 2.5 *(rev 2)* | Deterministic **read-only pre-execution gates** raise agent task success: GPT-4o-mini 29.6% → **42.0%** (+12.4pp, P=0.0012; replicated +12.3pp, P=0.0008; +19.2pp on the 26 tasks where gates actually fired) and GPT-5.2 61.2% → **71.6%** (+10.4pp, P=0.020, n=5 seeds — authors flag limited replication). The failure mode gates recover is *silent* policy violation — actions that raise no tool error and no self-reported failure | [arXiv 2607.07405](https://arxiv.org/abs/2607.07405) «Reason Less, Verify More», submitted **2026-07-08** | Peer-reviewed, dated 2026 | **MATCH — this is the mechanism RQ2 asserts.** Rev 1 justified «mechanical work tolerates more context» by reasoning alone («Deduced from RQ2»). 2.5 measures the premise: external deterministic gates recover exactly the class of error a degraded model stops catching itself. **Still not a token delta** — it is a success-rate delta at unspecified context fill |

**Calibration interpretation (T14-applied):** Direction confirmed — judgment work degrades faster than mechanical work, because mechanical work has external gates (CI, lint, hooks, review) that catch errors the model can no longer catch itself. As of rev 2 the *mechanism* half of that sentence is measured, not deduced (row 2.5: +10.4pp on a frontier model from read-only gates, against precisely the silent-failure class). **No specific delta number is supportable from the literature** — every source operationalises the differential on a different axis (recall-vs-reasoning dissociation, turns, success rate), and none expresses it as a token threshold. Mark `INCONCLUSIVE-needs-human` for the delta: closing it needs an in-house measurement protocol (see [§closure-proposals](#closure-proposals) item 1), which is a human-owned decision, not a further search.

### RQ3 — Transition practices compared (fresh-session handoff vs auto-compact vs summary-carryover)

**Coverage (restated rev 2):** 9 distinct sources across the three rows — 1 first-party (Anthropic
compaction docs), 2 operator-grade GitHub issues (one of them 2025-12, see the auto-compact row), 4
practitioner blogs, 1 Reddit thread, 1 peer-reviewed 2026 study (added rev 2). Dated **2026**: 8 of 9.
One citation is **unverifiable by our tooling**: the Reddit thread returns HTTP 403 to both `curl` and
an automated fetch — recorded as `INCONCLUSIVE — could not probe (bot-block, not evidence of absence)`;
it is one of three supporting citations on the fresh-session row and carries nothing alone.

| Practice | Quality retention | Token cost | Failure modes | Sources |
|---|---|---|---|---|
| **Fresh-session handoff via residue doc** | Best — intent preserved, debugging context carried forward, no auto-summarisation lossy step | Orchestrator time + new-session bootstrap; reuse cost ~one-time | Handoff doc itself can be lossy if written under fatigue; mitigated by writing early (60–65% fill, not at 0% remaining) | [vincentvandeth — Context Rot in Claude Code](https://vincentvandeth.nl/blog/context-rot-claude-code-automatic-rotation), 2026; [Reddit r/ClaudeCode "Do you compact?"](https://www.reddit.com/r/ClaudeCode/comments/1rfbtyv/do_you_compact_how_many_times/), 2026; [chudi.dev — 3-File System](https://chudi.dev/blog/claude-context-management-dev-docs), 2026 |
| **Auto-compact (Claude Code native)** | Workable but lossy — known to omit error messages, stack traces, debugging information | Lowest incremental — frees 60–70% of window in-place | Summaries omit debugging info, error traces; "loses task-oriented intent and next-step information" | [Anthropic Compaction docs](https://platform.claude.com/docs/en/build-with-claude/compaction), 2026 (first-party); [anthropics/claude-code#13239](https://github.com/anthropics/claude-code/issues/13239), **2025-12-06** (rev 1 dated it «2026» — corrected rev 2); [MindStudio — Context Rot](https://www.mindstudio.ai/blog/context-rot-ai-agents-auto-compact-fix), 2026 |
| **Summary-carryover (synthetic recap)** | **Rev 2 — rev 1's «no source isolates this variant» is FALSIFIED.** A dated-2026 peer-reviewed study isolates exactly this three-way comparison: adaptive self-compaction vs **fixed-interval summarisation** vs no-summarisation. Adaptive «matches or exceeds fixed-interval summarisation at a fraction of the token cost» — up to **+18.1 points** on math and **+5–9** on agentic search over no-summarisation | **30–70% lower** per-question token cost than the fixed-interval baseline | Fixed-interval summarisation is the *worst-timed* variant by construction: firing mid-derivation «discards partial results the model then has to reconstruct, which is the most expensive moment to forget» | [arXiv 2606.23525 «Self-Compacting Language Model Agents»](https://arxiv.org/abs/2606.23525), submitted 2026-06-22, rev 2026-07-10; [Blake Crosley — «Context Compaction Is a Decision, Not a Threshold»](https://blakecrosley.com/blog/agent-context-compaction), 2026-06-23 |

**Concrete operator numbers:**
- Compaction trigger: 70–75% utilisation commonly cited; Claude Code's product-internal 150k/200k = 75% (RQ1 1.2)
- Compaction yield: frees 60–70% of context window (multiple sources)
- Recommended rotation trigger: 60–65% utilisation (NOT 80%+) — Vincent van deth blog, 2026
- Multi-agent cost compounding: "3 agents cost 10x" via context transfer + retries + verification stack — [AugmentCode](https://www.augmentcode.com/guides/multi-agent-cost-compounding), 2026

**Cross-reference to D6 SSOT entries:** SSOT #230 (`mattpocock/skills` handoff = REFERENCE) — confirmed by 2026 sources; the "handoff.json" / "handoff.md" pattern is the dominant practitioner recommendation. SSOT #122 (session-recap family) — confirmed as a family, but **rev 2 withdraws rev 1's ranking claim** («recap is the SECOND-BEST option, behind full fresh-session with residue»): that ranking was asserted against a row rev 1 had itself marked coverage-insufficient. The 2026 evidence now available ranks *timing* (adaptive vs fixed-interval), not *mechanism* (recap vs fresh session) — nothing measured compares a residue-doc handoff head-to-head against a synthetic recap. The honest statement is that the three practices are **unranked against each other**, with one measured sub-result: adaptive beats fixed-interval summarisation on both quality and cost.

**Rev-2 consequence for D6/D7 that is stronger than any threshold here:** the best-supported 2026 finding in RQ3 is that **when to compact is a decision, not a token threshold** — a rubric keyed to «a sub-task resolved / the trajectory is converging» versus «mid-derivation / stuck» outperforms a fixed trigger at 30–70% lower cost, with no fine-tuning. A D6 design whose only control is a `T_soft` number is adopting the *weaker* of the two mechanisms the literature compares. This does not invalidate having thresholds (a hard ceiling is still needed); it means the threshold should be the backstop and the rubric the primary.

### RQ4 — Classifier refinement signals

**Coverage (restated rev 2):** 6 dated 2026 sources. Rev 1 claimed «none directly operationalise a
"mechanical vs judgment tail" classifier» — **FALSIFIED** ([§search-coverage](#search-coverage) item D):
the Self-Compacting rubric *is* a shipped, evaluated classifier for the same decision, expressed in
trajectory-state terms rather than task-type terms — fire when «a sub-task resolved / the trajectory is
converging», hold when «mid-derivation / stuck». It needs no fine-tuning and no external supervision,
and it was evaluated across six benchmarks and seven models. What survives is the narrower claim:
**no source operationalises the classifier over the *counter-based* signals proposed below**, and the
threshold values remain unevidenced (`INCONCLUSIVE-needs-human` — an in-house protocol is required).

**Design consequence (rev 2):** the rubric is evidence that the cheapest discriminating signal may be
*trajectory state*, which signal 4.5 approximates and signals 4.1–4.4 do not. A counter-based classifier
tuned in-house should be benchmarked **against** the rubric, not built as if nothing existed.

Candidate signal classes a session can self-check (each operationalisable in <10ms with no LLM call):

| # | Signal | Mechanical tail indicator | Judgment tail indicator | Operationalisation | Evidence base |
|---|---|---|---|---|---|
| 4.1 | **Tool-call density ratio** = tool_calls / total_turns in last N turns | High (≥0.7?) | Low | Trivial counter maintained per turn | [arXiv 2605.09252](https://arxiv.org/html/2605.09252v1) (tool-call necessity is hidden-state-predictable) + [Apple Reinforced Agent](https://machinelearning.apple.com/research/reinforced-agent-inference-feedback) |
| 4.2 | **Gate-backing ratio** = (CI runs + rule-test fires + lint passes) / total_actions | High | Low | Event counter | RQ2 evidence: external gates are what makes mechanical work tolerant |
| 4.3 | **Decision-vs-action ratio** = (verdicts + forks surfaced) / (commands + edits) | Low | High | Counter on emitted artefacts | [agentpatterns.ai — Auto Model Selection](https://agentpatterns.ai/patterns/agent-design/auto-model-selection/) (task class as routing signal) |
| 4.4 | **External-state-mutation share** = (commits + pushes + PR actions) / total_actions | High | Low | Counter | RQ2 2.4 (git-as-gate pattern — rev 1 cited this as «RQ3 2.4»; the claim lives in RQ2) |
| 4.8 *(rev 2)* | **Trajectory state** — sub-task resolved / converging vs mid-derivation / stuck | Resolved or converging → safe tail | Mid-derivation or stuck → judgment in flight | Model-evaluated rubric, not a counter (the one signal here with published evaluation) | [arXiv 2606.23525](https://arxiv.org/abs/2606.23525), 2026-06-22; [Crosley](https://blakecrosley.com/blog/agent-context-compaction), 2026-06-23 |
| 4.5 | **Recap-marker presence** — did the session recently write or consume a handoff doc? | Recent handoff → likely mechanical tail (post-handoff execution) | No recent handoff → likely still in judgment phase | Boolean check on artefact timestamps | SSOT #230 confirmation (RQ3) |
| 4.6 | **Tool-call error rate** in tail | High + low retry creativity | Low | Counter | Deduced from RQ2: external gates catch what the model can't |
| 4.7 | **Context-fill delta rate** (tokens/turn in recent window) | Spiking → approaching hard limit; classify by 4.1–4.6 | Same | Token-counter delta | [Vincent van deth — context pressure monitoring](https://vincentvandeth.nl/blog/context-rot-claude-code-automatic-rotation), 2026 |

**T14 disclosure:** the signal classes are well-motivated directionally; the threshold values (the "??" marks above) are NOT evidence-backed. An in-house measurement protocol is required before any threshold enters D6 as load-bearing.

## §search-coverage — the 6-item checklist on this patch's negative-existence claims {#search-coverage}

Kickoff §3 is binding: «Negative-existence claims («no eval exists for X») require the 6-item
search-coverage checklist» ([phase-research-coverage.md §1](../../../.claude/rules/phase-research-coverage.md)).
**Rev 1 made four such claims and discharged none** — `grep -niE "6-item|search-coverage"` over rev 1
returned zero hits. This section is the discharge, run 2026-08-10. **Two of the four claims did not
survive it**, which is the §1.4 adversarial check doing exactly what it exists for: an unsearched gap
had been recorded as a measured absence, and D6 would have inherited it.

| item | claim as written in rev 1 | verdict after the sweep |
|---|---|---|
| **A** | «no agentic-coding-specific independent benchmark confirms quality holds past ~500k» (§findings RQ1) | **FALSIFIED as written.** LoCoBench-Agent (10K–1M, agentic SWE) and SlopCodeBench (agentic-coding decay over long-horizon iteration) both exist. Narrowed survivor: no *dated-2026* source expresses agentic-coding quality against **token fill** past ~500k — a unit gap |
| **B** | «No specific delta number is supportable from the literature» (mechanical vs judgment, RQ2) | **HOLDS.** Every source found measures a different axis (recall-vs-reasoning dissociation; turns; success rate). None yields a token delta. Now backed by a positive measurement of the *mechanism* (2.5) rather than by silence |
| **C** | «no practitioner-grade 2026 source isolates this variant» (summary-carryover, RQ3) | **FALSIFIED.** arXiv 2606.23525 (2026-06-22) isolates precisely fixed-interval summarisation vs adaptive vs none, with quality and cost numbers |
| **D** | «none directly operationalise a "mechanical vs judgment tail" classifier» (RQ4) | **FALSIFIED.** The Self-Compacting rubric is an evaluated classifier for the same decision (trajectory-state framing). Narrowed survivor: none operationalises it over the *counter-based* signals proposed here |

**Checklist discharge (the six items, per claim-set above):**

1. **Own-stack sweep.** Claude Code itself is the own-stack dependency in this capability area, and it
   *does* ship a surface here — the 150k server-side auto-compact (1.2) and the `PreCompact` hook are
   product-internal calibration, already the strongest problem-class-matched evidence in RQ1. Recorded
   rather than treated as inert infra (`#own-stack-blind-spot`).
2. **Category sweep.** Categories enumerated beyond «long-context benchmark»: agentic-SWE benchmarks
   (LoCoBench-Agent, SlopCodeBench), context-management method papers (Self-Compacting), agent-eval
   metric frameworks, harness issue trackers, practitioner blogs. Items A/C/D were all falsified by
   categories rev 1 never entered — it searched only the benchmark and blog categories.
3. **Semantic-distance check.** Rev 1's vocabulary was uniformly «context rot / degradation / context
   window». Re-probed one paradigm step out: «coding agents degrade over long-horizon iterative
   tasks», «self-compacting agents», «compaction decision vs threshold», «deterministic gates
   tool-using agents». Every falsifier above came from the re-probed vocabulary, not the original —
   which is the `#semantic-anchor` failure in textbook form.
4. **Adversarial counter-prompt.** Run per claim, in the «if it existed, where would it live?» form:
   *if an agentic-coding long-context benchmark existed, it would be an arXiv SWE-agent paper naming
   context length in its title* → surfaced A's two falsifiers; *if someone had compared recap variants,
   it would be a method paper proposing a better one and benchmarking the baseline* → surfaced C.
5. **Prompt-list ≠ complete.** Kickoff §6(c) sets a **floor** of 5 dated 2026 sources. Rev 1 closed at
   «well over 5» and stopped; items 1–4 above did not hold at that point, so the floor was being used
   as a ceiling (`#prompt-list-anchoring`).
6. **Trigger sweep.** Not applicable to this patch — no `open-questions.md` §13.x trigger is in scope
   for a D6/D7 parameter calibration; the consuming trigger is the design's own consumption gate,
   recorded below.

**Item F — the Fable-5 tier sweep (backs the RQ1 per-tier disposition, not one of the four claims
above).** Four phrasings against Fable-5 long-context quality. Result: qualitative first- and
third-party statements only («more consistent reasoning quality as context grows»; «at the far end of
the window, precision drops»), plus a «safer working range ≈800k» figure from an aggregator with no
stated method — **not adoptable**. Disposition: `COVERAGE INSUFFICIENT TO CONCLUDE`, not «no
degradation».

## §parked-questions {#parked-questions}

Per kickoff §4c (park-don't-guess). Rev 1 recorded «no genuine fork emerged»; rev 2 finds one it had
resolved silently.

**PARK-CDC-1 — which quantity is `T_soft(200k)`?** The two strongest problem-class-matched sources
measure different things, and the design needs one number.

- **Option A — `T_soft(200k)` = 65% (~130k).** Treat 1.3's «compact at 50–70% to maintain quality» as
  the soft threshold. *Consequence:* handoffs fire earlier and more often; matches kickoff §0's
  acceptance mapping («already degraded at ~150k → thresholds drop»); costs more handoff overhead on
  sessions that would have been fine.
- **Option B — `T_soft(200k)` = 75% (~150k).** Treat 1.2's server-side force-compact point as the
  soft threshold. *Consequence:* the soft threshold coincides with the harness's own hard action, so
  D7's handoff arm almost never fires before auto-compact does — the arm becomes decorative, and the
  backstop (D8 PreCompact snapshot) becomes the real mechanism.

Not resolvable from the literature: no source measures our task classes at these fills. The RQ3
finding above is relevant to the choice — if compaction timing becomes rubric-driven, the number
matters less and the fork loses most of its force.

## §calibrated-parameters

Each proposed parameter carries its falsifier per kickoff §4. **All numbers are PROPOSED — consumption gate is downstream.**

### 200k window

| Parameter | Current provisional (D6) | Proposed | Falsifier | Evidence |
|---|---|---|---|---|
| `T_soft(200k)` (quality-preservation threshold) | 70% (~140k) | **PARKED — no single value proposed.** The evidence splits: Option A **65% (~130k)** (mid-point of 1.3's «50–70% to maintain quality») · Option B **75% (~150k)** (1.2's product-internal force-compact point). See [§parked-questions](#parked-questions) PARK-CDC-1 | Option A is wrong if in-house measurement shows judgment quality intact at 150k; Option B is wrong if quality is already degraded at 150k — which is the reading 1.3 supports and which kickoff §0's acceptance maps to «thresholds **drop**» | RQ1 1.2 + 1.3. **Rev 2 correction:** rev 1 proposed 75%, i.e. *above* every figure in its own evidence cell, on evidence its own §findings read as «converge on ~70%». A soft threshold set at the product's force-compact ceiling is not a soft threshold |
| `T_soft(200k)` mechanical-tail uplift | — (D6 has no separate mechanical value) | **`INCONCLUSIVE-needs-human`** — direction only: gated work tolerates more | Wrong if in-house measurement finds gated tails degrade at or before the judgment floor | Direction measured by RQ2 2.5 (+10.4pp frontier-model success from deterministic gates). **Rev 2 correction:** rev 1 printed `85% (~170k)` here as a Proposed value; neither `85%` nor `170k` appears in any cited source, so it was a prose number in a sourced column (kickoff §5 T3/T20) |
| Backstop (D8 PreCompact residue snapshot, pending #108 gate) | PreCompact residue snapshot | Keep as designed | Wrong if the snapshot itself is taken past the degradation onset (snapshot would be of degraded output) | RQ3 (handoff-doc must be written at 60–65% fill, not at 0% remaining) |

### 1M window

| Parameter | Current provisional (D6) | Proposed | Falsifier | Evidence |
|---|---|---|---|---|
| `T_soft(1M)` (operator floor) | 300k | **300k retains** (judgment); **500k** mechanical-tail provisional | Wrong if a 1M-window agentic-coding benchmark lands showing quality degradation onset < 300k for judgment work on Fable 5 / Opus 5 | T-CDC-A: vendor claims «stable to 1M» are NOT agentic-coding-validated. **Rev 2 correction:** rev 1 called RQ1 1.5 «the strongest external anchor» here while rating it WEAK in §findings — and 1.5 is retrieval-benchmark evidence, the class this patch demotes 1.6 for. The honest anchor set is 1.8 (agentic SWE to 1M, robust-with-efficiency-cost, but 2025-11) and 1.9 (agentic decay measured in turns, not tokens); **neither pins a token number**, so 300k/500k remain operator-experience-derived |
| Working ceiling (mechanical tails) | ~500k | **500k retains** as PROVISIONAL ceiling for mechanical-tail work only | Wrong if mechanical-tail quality degrades measurably before 500k under in-house measurement | Coverage INSUFFICIENT (T14); this is operator-experience-derived, not benchmark-derived |

### Per-task-class deltas (RQ2-derived)

| Task class | Delta vs judgment-floor | Evidence strength |
|---|---|---|
| Judgment (design, review, novel debugging) | 0 (baseline) | Direction: RQ2 2.1 (pre-2026, directional) + 2.2; freshly confirmed by 2.5 (2026-07) |
| Mechanical-tail (commit, merge, regen with external gates) | **`INCONCLUSIVE-needs-human`** — direction only, sign positive | Rev 1 printed «+10–15% of window»; that range appears in no cited source. Direction is measured (2.5); the magnitude is not |
| Spec authoring / verdict-issuing | **`INCONCLUSIVE-needs-human`** — direction only, sign negative | Rev 1 printed «−5%»; likewise unsourced. Not isolated in literature |

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
6. **Context-fill delta rate** (4.7 — rev 1 numbered this 4.6; the table has 4.6 = error rate, 4.7 = fill-delta) — token-counter delta, always-available.
7. **Tool-call error rate in tail** (4.6 — same swap corrected) — counter, requires error-class taxonomy.
8. **Trajectory state** (4.8, added rev 2) — *not* a counter and *not* <10ms: it is a model-evaluated rubric. Listed last on cost, first on published evidence.

**Recommended minimal viable classifier (3 signals, all <10ms, no LLM call):** `Recap-marker presence` AND `Tool-call density ratio` AND `Gate-backing ratio`. The conjunction is *proposed* to separate «post-handoff mechanical execution» from «live judgment work»; thresholds to be calibrated in-house. **Rev 2 qualifier:** rev 1 asserted the conjunction «is sufficient» — that is an unmeasured claim about a classifier nobody has run. It is a hypothesis, and the in-house protocol below must test it **against** signal 4.8, which is the only option here with published evaluation. If the rubric wins, the cheap-counter design loses its rationale.

## §self-application (T15)

**At what context size was THIS research session?** The session began with the `/aif-implement` skill prompt (~9k tokens), CLAUDE.md + 4 rule files auto-injected (~25k tokens combined), 2 short plan-file reads (~5k tokens), 9 WebSearch result blocks (~30–40k tokens combined for the richer ones), and this synthesising write. **Estimated session context at the time of this write: ~80–110k tokens** (no transcript marker available; estimate from artefact sizes).

**Did this session's own quality hold?** The adversarial counter-prompt I ran before writing this section:

> "What RQ-class did this audit NOT cover, and what threshold claim did I assert from training-data memory rather than from a 2026 source?"

Running it surfaced three concrete self-corrections applied to this patch:

1. **(T12-fired)** My initial mental draft for the 1M-window `T_soft` leaned on a recollection of "Claude quality holds to ~600k". I had no 2026 source for it. Replaced with the operator-floor retention (300k) and explicitly marked the 500k ceiling as inconclusive pending in-house measurement. *(Rev 2 normalises the token: the kickoff §4 vocabulary is `INCONCLUSIVE-needs-human`; rev 1 coined a third token in that slot, and disposition tokens are what a downstream consumer greps.)*
2. **(T-CDC-A-fired)** Initial draft cited Opus 4.6's "76% long-context benchmark" as a quality signal. The counter-prompt exposed this as a retrieval benchmark — exactly the T-CDC-A trap. Demoted to source 1.6 with explicit "NO MATCH" rating.
3. **(T4-fired)** Initial draft had no §stop-condition-audit. The counter-prompt surfaced this as a missing RQ-class — not a research RQ, but a mandatory process section. Added §stop-condition-audit below.

The session's estimated ~80–110k context is **well below the 140k judgment-floor** proposed above, so per our own calibration this output should be at full quality. The three self-corrections above are consistent with that — the model caught its own pre-deadline drift in the adversarial step. **Falsifier:** if a cold reviewer finds a fourth pre-deadline claim that the counter-prompt missed, that would be evidence of subtle degradation under 100k and would lower the proposed floor.

### Rev 2 — the falsifier fired

A cold fidelity audit and an independent K1/K2 pass found not a fourth claim but **nine**: five
MAJOR (the §3 checklist never discharged; RQ1 reported answered with zero Fable-5 evidence; the
headline threshold moved *against* its own evidence; an unsourced `85%` in a sourced column; a
2025 paper dated 2026) and four MINOR (coined disposition token, coverage arithmetic that did not
reconcile with its own tables, three wrong internal cross-references, a self-declared write outside
the §2 allowlist). A second pass added five more citation-accuracy MINORs, including a 404 anchor
URL and two more 2025-as-2026 dates.

**What that does and does not license as a conclusion.** It does *not* validate «degradation under
100k», and rev 1's falsifier as written is too coarse to carry the inference — a defect count says
nothing about context fill unless the same task is run at a different fill. Two confounds are at
least as plausible: (i) the executor was **GLM-5.2**, not a Claude tier, so nothing here measures the
tiers the patch is about; (ii) seven of the nine are *citation-hygiene* defects — date labels, URL
slugs, cross-references — which are the class a cold reader catches and a fatigued author does not,
at any context size. The one defect that *is* reasoning-shaped is the threshold moving against its
own evidence (PARK-CDC-1).

**The honest self-application finding, then:** a single-session adversarial counter-prompt caught 3
defects; a cold seat that never saw the session caught 9 more on the same artefact. That is evidence
about **counter-prompts versus cold seats**, not about context size — and it is the same result
[`ai-laziness-traps.md` T19](../../../.claude/rules/ai-laziness-traps.md) already records. Rev 1's
self-check was not theatre; it was simply the weaker instrument, and it graded itself «full quality»
on the strength of it (T6/T14: a clean self-audit at low coverage is «coverage insufficient», not
«clean»). **Replacement falsifier for D6:** the proposed floors are wrong if the *same* task class is
run at two controlled fills on a Claude tier and defect rates do not separate — which is
[§closure-proposals](#closure-proposals) item 1, and until it runs, no number here is calibrated.

## §stop-condition-audit (kickoff §6)

**Which stop conditions fired?** Both **(a)** and **(b)** — rev 1 recorded only (a).

- **RQ1: PARTIAL, not «answered».** Answered for the Opus family; `COVERAGE INSUFFICIENT TO CONCLUDE`
  for Fable 5 (see the RQ1 per-tier table). Rev 1 wrote «answered (5 sources, all verified
  mechanically)» for a question posed *per tier*, which is the T14 error the kickoff names.
- **RQ2:** direction answered — and as of rev 2 the mechanism is measured (2.5), not deduced. Delta
  number `INCONCLUSIVE-needs-human`.
- **RQ3:** answered, and rev 2 *upgrades* it: the summary-carryover row is no longer coverage-insufficient.
- **RQ4:** signal classes answered; threshold values `INCONCLUSIVE-needs-human`; rev 2 adds the one
  signal (4.8) that has published evaluation.

Condition **(b)** (§4c fork) **DID fire** — see [§parked-questions](#parked-questions) PARK-CDC-1.
Rev 1 stated «no genuine fork emerged» and then resolved the fork silently by proposing one side of it.
Condition **(c)** (<5 dated 2026 sources) did NOT fire — 16 of the 21 distinct sources now cited carry
a 2026 date, comfortably above the floor. (Kickoff §6(c) is a floor, not a stopping point — see
[§search-coverage](#search-coverage) item 5.)

**Coverage predicates (T6 replacement for "high confidence") — recomputed rev 2, because rev 1's did
not reconcile with its own tables:**

- Distinct URLs cited: **26** after rev 2 (rev 1 cited 21 and claimed «13 sources»).
- Anchor existence status-checked: **24/26 → HTTP 200.** Two return 403 to a scripted client:
  the Medium post, which a rendering fetch *did* resolve (title, author and the 2025-12-19 date all
  confirmed), and the Reddit thread, which no client of ours can reach → `INCONCLUSIVE — could not
  probe (bot-block, not evidence of absence)`. Rev 1's own count was 21 URLs of which one 404'd —
  that anchor's slug is fixed in rev 2 and now resolves.
- Quoted text re-fetched and matched verbatim: **8** load-bearing quotes, 8/8 reproduce.
- Dates verified against the source rather than against its label: **26/26** — this check did not
  exist in rev 1, and it is what caught four mislabelled years (2.1, 2.4, RQ3 #13239, 1.5).
- Claims resting on a *token-fill* measurement for our task class: **0 of 21.** This is the single
  most important predicate in the document, and it did not appear in rev 1 at all.
- Calibration: **NONE.** First run of this methodology; rev 2 is the second pass over the same
  artefact by a different seat, and it changed or qualified 14 statements — so the expected residual
  defect rate on a third pass is not «≥20%», it is **unestimated**, and claiming a figure would repeat
  the rev-1 error.

## §closure-proposals — I-phase candidates, NOT this task's work {#closure-proposals}

These are proposals for LATER I-phase work, surfaced during the R-phase per T5 (do not edit source during R-phase). *(Rev 2: rev 1 headed this «RQ5-derived»; the kickoff defines RQ1–RQ4 only — there is no RQ5.)*

1. **In-house measurement protocol design** — the RQ2 delta gap and RQ4 threshold gaps both require the same artefact: a calibrated in-house harness that runs known tasks at controlled context-fill levels and measures quality. Proposed as a follow-up I-phase task; not this task's scope. **Rev 2 raises its priority:** it is now also the only way to settle PARK-CDC-1 and the only stated falsifier for every number in §calibrated-parameters.
2. **Minimal-viable-classifier prototype** — wire the 3 recommended §classifier-refinement signals into a session-self-check that classifies the current tail as mechanical vs judgment. Threshold values placeholder until #1 lands. **Rev 2 amendment:** benchmark it against signal 4.8 (the published trajectory-state rubric) rather than shipping it unopposed — if the rubric wins, this prototype should not ship at all.
3. **PreCompact residue snapshot timing rule** — the §calibrated-parameters 200k-row backstop depends on the snapshot being taken BEFORE degradation onset. If D8 ships without that timing guarantee, the backstop is of degraded output. Surface as a §4c-style note for the D8 design owner.
4. **Rubric-first compaction control (rev 2, new)** — RQ3's best-supported 2026 finding is that *when* to compact is a decision, not a threshold, and that an adaptive rubric beats fixed-interval summarisation at 30–70% lower cost. D6 as currently drafted is threshold-only. Proposal: treat `T_soft` as the backstop and a trajectory-state rubric as the primary trigger. Owner: the D6/D7 design, not this patch.

## §out-of-scope (per kickoff §2 permitted-files allowlist)

This patch does NOT:
- Edit any source file (R-phase T5).
- Add a new SSOT entry (capability-commit; I-phase work).
- Dispatch the Consumption Gate (owned by the harvesting session).
- Update ADR D6/D7 directly (the design update is a separate owner action post-verdict).
- Touch `.claude/`, `.ai-factory/`, or `packages/`.

*(Rev 2: rev 1's last bullet carved out «beyond the plan file's own checkbox updates», i.e. it declared
writes outside the kickoff §2 one-file allowlist. Those paths are gitignored, so the claim is invisible
to the diff either way and the tracked tree is clean — but an §out-of-scope list must not contain its
own exception. Rev 1 also attributed this section to «per plan §Out-of-scope», a document the kickoff
never names; the governing authority is kickoff §2.)*

---

*Current as of 2026-08-10 (rev 2). Rev 1: 2026-08-09.*
