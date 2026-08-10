<!-- scope:context-degradation-calibration -->

# Context-degradation calibration — D6/D7 evidence base for Fable 5 / Opus family (Aug 2026 state)

> **Type:** research-patch (R-phase deliverable, single permitted file per kickoff §2).
> **Owner:** the session that ran the sweep, 2026-08-09. **Branch:** `feature/context-degradation-calibration-051706` (Handoff-prepared, task `0517063b-3f6c-4f5a-8bde-ce11b7658d97`).
> **Source kickoff:** [`.claude/orchestrator-prompts/context-degradation-calibration/kickoff.md`](../../../.claude/orchestrator-prompts/context-degradation-calibration/kickoff.md).
> **Design target:** [ADR D6/D7/D9](../../../docs/superpowers/specs/2026-08-09-pipeline-chips-session-bus-design.md) — D6 policy table (numbers being calibrated), D7 Stop-arm (consumes them), D9 (this task).
> **Reader:** anyone tempted to set D6 thresholds from a vendor marketing claim or a single benchmark number. Read §calibrated-parameters first: each number carries its falsifier, and the strongest numbers are the agentic-coding-product-internal ones (Claude Code Issues), not the retrieval benchmarks.
> **Status:** PROPOSED — consumption gate (cold K1/K2 + verifier `GO | rework | kill`) is downstream of this patch, owned by the harvesting session; this R-phase does NOT self-verify its own numbers' entry into D6/D7.
> **Revision 2 (2026-08-10, harvesting session):** round-1 cold fidelity audit returned `REVISE` (5 MAJOR). The rework is recorded inline: [§search-coverage](#search-coverage) is new and **falsifies two of this patch's own negative-existence claims**; RQ1 now carries a per-tier disposition; the `T_soft(200k)` direction is **parked** as a §4c fork instead of silently proposed; the unsourced `85%` is demoted to the same INCONCLUSIVE marker as its siblings; four citation dates are corrected. Cross-owner edit per [CLAUDE.md `Artifact Ownership Contract`](../../../CLAUDE.md) — separate atomic commit, rationale in its body.
> **Revision 4 (2026-08-10, operator-directed):** scope is deliberately narrow — **re-run the Fable-5 / Opus-5 tier sweep only**, land whatever the fresh sources support, and stop. No new audit round was requested and none was run; the numbers below enter under the same downstream consumption gate as rev 3's. What changed: the rev-2 `COVERAGE INSUFFICIENT` disposition on **Fable 5 is now partly discharged** — rows 1.10–1.13 add the first *numeric*, token-axis, 2026-dated evidence for the top tier and for judgment-class degradation, so [§search-coverage](#search-coverage) item F no longer reads «none numeric». Consequence for D6: the `T_soft(1M)` = **300k** floor stops being purely operator-experience-derived and acquires a directional external anchor, and the 500k mechanical ceiling moves from *unbounded-inconclusive* to *bounded* (~600k). No threshold moved.
> **Revision 3 (2026-08-10, same session):** round-2 audit closed all five round-1 MAJORs and found **three new ones, every one introduced by rev 2's own rework** — a ranking withdrawn in prose but left standing in the table it summarises; two *new* negative-existence claims substituted for the falsified ones without the §3 checklist they owe; and three citations with no date at all, sitting under a rev-2 predicate that claimed «26/26 dates verified». All three are closed here. Probing the third turned up a fourth defect nobody had flagged: the `agentpatterns.ai` citation behind signal 4.3 states the **opposite** of the claim it was attached to. The pattern is worth naming — rev 2 was a citation-hygiene pass that introduced citation-hygiene defects, which is the cheapest available evidence for this patch's own subject.

## §0 Method + freshness

- **Sweep:** WebSearch ≥3 phrasings per RQ (`long-context degradation` / `context rot` / `effective context window` / `lost-in-the-middle agentic` + per-RQ variants). **≥5 dated 2026 sources in total** — that is the kickoff §6(c) floor, and it is a floor, not a per-RQ quota (rev 1 wrote «per RQ», which its own per-RQ counts do not meet: RQ2 has 2); first-party (Anthropic) prioritised.
- **Freshness bar (binding, arch §1.5):** every load-bearing source dated; freshest first; pre-2026 sources excluded from load-bearing claims without fresh confirmation.
- **Tier-name verification (kickoff §0 mandate: «verify at run time, do not assume»):** as of 2026-08-09 the top two Claude tiers are **Fable 5** (top, GA 2026-06-09; suspended 2026-06-12, restored 2026-07-01 — reason not stated by the source, do not attribute one — [Anthropic news](https://www.anthropic.com/news/claude-fable-5-mythos-5)) and **Opus family** (Opus 5 / 4.8, second tier; the Fable 5 suspension did NOT affect Opus, which served as the recommended fallback). 1M-token context GA on Opus 4.6+ and Sonnet 4.6+; premium pricing applies above 200k tokens ([Opus 4.6 release notes](https://www.anthropic.com/news/claude-opus-4-6), [Opus 5 announcement](https://www.anthropic.com/news/claude-opus-5), [Bedrock 1M expansion](https://aws.amazon.com/about-aws/whats-new/2025/08/anthropic-claude-sonnet-bedrock-expanded-context-window/)).
- **T-CDC-A baseline:** long-context benchmarks mostly measure retrieval (needle-in-haystack), NOT agentic-coding quality. Every adopted number below carries its problem-class-match statement per the kickoff's domain trap.

## §findings

### RQ1 — Degradation onset per model tier

**Coverage (recounted rev 3 — rev 1's arithmetic did not reconcile with its own table, and rev 2's
restatement did not either; recounted again rev 4 after four rows were added):** **13 rows**
(1.1–1.13) over **12 distinct URLs** — 1.1 and 1.6 cite the same Opus-4.6 page. First-party 3 rows
(1.1, 1.6, 1.7) · operator-grade 2 (1.2, 1.3) · third-party blog 5 (1.4, 1.5, 1.10, 1.12, 1.13) ·
peer-review-track 3 (1.8, 1.9 added rev 2; 1.11 added rev 4). Dated **2026: 12 of 13** — only row 1.8
(2025-11) is pre-2026, and it is directional only, never a threshold source (as is the AWS 1M-GA link
in §0, 2025-08, which is not an RQ1 row). 0 `INCONCLUSIVE-needs-human`.

**Fetch-verification status (rev 4, T3).** Rows 1.10, 1.11, 1.13 were fetched and their figures read
off the page. Row **1.12 was not** — `morphllm.com` returned HTTP 429 — so its band is
search-snippet-level and is labelled as such in the row and everywhere it is used. No rev-4 number is
load-bearing on the unfetched row alone.

**Per-tier disposition (rev 2 — the RQ1 question is «onset *per model tier*», and rev 1 answered it
for one tier while reporting it answered for both):**

| Tier | Degradation-onset evidence | Disposition |
|---|---|---|
| **Opus family** (Opus 5 / 4.8 / 4.6) | rows 1.1, 1.6 are Opus-4.6-specific; rows 1.2, 1.3 are Claude Code product-internal and apply to whatever model the harness runs | **ANSWERED** — but note 1.2/1.3 are harness-level, i.e. model-agnostic by construction |
| **Fable 5** (top tier) | **numeric as of rev 4, from one unreplicated third-party run.** Rev 2 recorded «none numeric»; the rev-4 re-sweep found row **1.10** — Fable-5 accuracy against *token fill* on multi-document synthesis (81.3% at 200k → 64.1% at 800k) plus an «effective reasoning context ~600k» estimate. Rows **1.11** (judgment-class degradation on the token axis, Opus-family model, 2026-dated) and **1.12** (the 300k–400k band) corroborate the shape, not the tier | **PARTLY ANSWERED — bound, not threshold** (T14 still applies to the *value*). The onset shape for Fable 5 is now evidenced; no source pins an onset *token* for **agentic coding** on this tier, so §calibrated-parameters numbers remain Opus-family-/harness-derived and are **still not validated for Fable 5** as thresholds. Residual falsifier unchanged: a dated 2026 source reporting Fable-5 quality against context fill on an **agentic-coding** task |

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
| 1.10 *(rev 4)* | **First numeric Fable-5-specific long-context evidence.** Independent head-to-head vs Gemini 3.5 Pro: Fable 5 «effective reasoning context (our tests)» **~600,000 tokens** (Gemini ~400k); multi-document synthesis **81.3% at 200k → 64.1% at 800k** (−17.2pp); multi-needle, 10 facts scattered through a 500k context, **94.2%**. Also states single-needle recall is ≥99% at 1M for *both* frontier models and «stopped discriminating» | [Contra Collective](https://contracollective.com/blog/claude-fable-5-vs-gemini-3-5-pro-long-context-1m-tokens-2026), 2026-06-13 (third-party, method described) | Third-party benchmark, **unreplicated** | **PARTIAL MATCH** — the axis *is* token fill, and multi-document synthesis (combine ≥3 facts scattered across the window) is judgment-shaped rather than pure retrieval. But it is not agentic coding, and it is a single unreplicated third-party run. Adoptable as a **bound** on the working ceiling, never as a threshold |
| 1.11 *(rev 4)* | **Judgment-class degradation on the token axis, 2026-dated, Opus-family model in scope.** Monitor models (Opus 4.6, GPT-5.4, Gemini 3.1) «miss these actions $2\times$ to $30\times$ more often when they occur after 800K tokens of benign activity than when they occur on their own»; and «agent monitoring benchmarks rarely contain transcripts longer than 100K tokens» while the real task requires classifying transcripts that «often exceed 500K tokens» | [arXiv 2605.12366](https://arxiv.org/abs/2605.12366) «Classifier Context Rot», submitted 2026-05-12 (v1, no revisions) | Peer-review-track | **STRONG MATCH on failure mode + axis** — this is judgment quality as a function of *tokens*, dated 2026, on an Opus-family model. It closes the hole 1.8 and 1.9 left open (1.8 is pre-2026; 1.9's axis is turns). It is **not coding**, and its measured point is 800k — so it evidences that the curve is real and steep, not where it starts |
| 1.12 *(rev 4)* | Third-party synthesis over the Chroma 18-model context-rot corpus: for 1M-window models «a clearly observable effect typically kicks in somewhere around 300,000–400,000 tokens»; distinguishes **positional** degradation (lost-in-the-middle, U-shaped, 20–30 points lower mid-window) from **length** degradation (accuracy falls as input grows with evidence fixed and favourably placed), with drops «sometimes by 30 to 50 percent well before the documented limit» | Morph, `morphllm.com/context-rot` — **snippet-level only; NOT verbatim-verified.** Direct fetch returned **HTTP 429**; the quoted band is as surfaced by WebSearch, and the underlying Chroma study is **2025** | Third-party aggregator, **unverified fetch** | PARTIAL — cross-vendor, mixed task classes, and it re-reports a pre-2026 corpus. **It is the only source in this patch that names a token band coinciding with D6's 300k floor**, which makes it precisely the source not to lean on: aggregator class + failed fetch = directional corroboration, never the anchor. Re-fetch and re-verify before any consumer treats 300k as externally sourced |
| 1.13 *(rev 4)* | **Opus 5's 1M window is capacity, not a quality guarantee — and no onset number is published.** Fetched analysis of the 1M default: it is «both the default and the maximum», long-context surcharge «None», and on quality only «context rot» — as context grows «recall and accuracy can degrade», with **no token threshold stated** and «a 1M window is a **capacity**, not an instruction to fill it». Separately, WebSearch snippets characterise Opus 5 as claiming performance «holds throughout» the window, «directly addressing the 200k-token degradation … on Opus 4.8» — **snippet-level, unverified against any first-party page, and the fetched article explicitly contains no such comparison.** Do not carry that claim forward without a first-party citation | [uxdev.org](https://uxdev.org/blog/claude-opus-5-1m-context-window/), 2026-07-29 (fetched in full) | Third-party analysis | Direct on tier, **zero numeric content.** Confirms the T-CDC-A baseline (vendor capacity ≠ validated quality) rather than moving any threshold |

**Calibration interpretation:** the two strongest problem-class-matched numbers (1.2, 1.3) converge on **~70% of advertised window as the quality-preservation threshold for the 200k window**, with explicit product-internal calibration at 150k = 75%. **Note the tension rev 1 glossed:** 1.2 (150k = 75%) is the point at which the product *force-compacts* — the top of the working range — whereas 1.3 (50–70%) is where practitioners say quality *starts* to go. They are not the same quantity, and reading them as «converging on 75%» conflates a ceiling with a soft threshold. This is the fork parked at [§parked-questions](#parked-questions).

For the 1M window, rev 1 claimed «no agentic-coding-specific independent benchmark confirms quality holds past ~500k». **Rev 2 falsifies that as written** ([§search-coverage](#search-coverage) item A): LoCoBench-Agent (1.8) evaluates agentic SWE to 1M and reports robustness with an efficiency cost, and SlopCodeBench (1.9) measures agentic-coding decay directly. What survives is a **narrower** and still-load-bearing claim: *no dated-2026 source surfaced by this sweep expresses agentic-coding quality as a function of **token fill** past ~500k*. **The three exclusions have three different reasons, and rev 2's «unit gap» label flattened them (rev 3):** 1.8 is excluded on **date** — its unit *is* tokens, it evaluates agentic SWE across 10K–1M; 1.9 on **unit** (turns and checkpoints, not tokens); 1.5 on **class** (retrieval). Naming that matters for the consumption gate, because it exposes a tension the 1M rows do not reconcile: the single best task-class-matched benchmark here reports «remarkable long-context robustness» to 1M, while §calibrated-parameters retains a 500k ceiling. Excluding 1.8 is defensible under the freshness bar; pretending the tension does not exist is not.

**Rev 4 — the narrow claim survives, one word at a time.** The surviving rev-2/3 claim was: *no
dated-2026 source surfaced by this sweep expresses **agentic-coding** quality as a function of **token
fill** past ~500k.* Rows 1.10 and 1.11 satisfy «dated 2026», «token fill», and «past 500k» — 1.10
measures to 800k, 1.11 to 800k — and both measure **judgment-shaped** work. Neither measures
**agentic coding**. So the claim holds only on its last qualifier now, and a consumer should read it
as: the token-axis degradation curve past 500k is evidenced for judgment work on frontier models
including the Opus family; its *coding-specific* shape remains unmeasured on the token axis, which is
exactly the hole 1.9 (turn-axis) leaves. That is a materially weaker gap than rev 3 recorded, and it
narrows the tension flagged above rather than resolving it: 1.8 still reports «remarkable long-context
robustness» to 1M while 1.11 reports 2×–30× degradation past 800k — different task, different year,
both in scope, unreconciled.

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
| **Fresh-session handoff via residue doc** | **UNRANKED (rev 3).** Claimed mechanism: intent preserved, debugging context carried forward, no auto-summarisation lossy step. *No source cited here measures it against the other two rows* — rev 1 rated this «Best», rev 2 withdrew the ranking in the cross-reference paragraph below but left the superlative standing in this cell | Orchestrator time + new-session bootstrap; reuse cost ~one-time | Handoff doc itself can be lossy if written under fatigue; mitigated by writing early (60–65% fill, not at 0% remaining) | [vincentvandeth — Context Rot in Claude Code](https://vincentvandeth.nl/blog/context-rot-claude-code-automatic-rotation), 2026; [Reddit r/ClaudeCode "Do you compact?"](https://www.reddit.com/r/ClaudeCode/comments/1rfbtyv/do_you_compact_how_many_times/), 2026; [chudi.dev — 3-File System](https://chudi.dev/blog/claude-context-management-dev-docs), 2026 |
| **Auto-compact (Claude Code native)** | **UNRANKED (rev 3).** Documented failure mode: omits error messages, stack traces, debugging information (first-party docs + #13239). «Lossy» is a property its own sources state; «workable but» was a comparative against the row above, which nothing measures | Lowest incremental — frees 60–70% of window in-place | Summaries omit debugging info, error traces; "loses task-oriented intent and next-step information" | [Anthropic Compaction docs](https://platform.claude.com/docs/en/build-with-claude/compaction), 2026 (first-party); [anthropics/claude-code#13239](https://github.com/anthropics/claude-code/issues/13239), **2025-12-06** (rev 1 dated it «2026» — corrected rev 2); [MindStudio — Context Rot](https://www.mindstudio.ai/blog/context-rot-ai-agents-auto-compact-fix), 2026 |
| **Summary-carryover (synthetic recap)** | **Rev 2 — rev 1's «no source isolates this variant» is FALSIFIED.** A dated-2026 peer-reviewed study isolates exactly this three-way comparison: adaptive self-compaction vs **fixed-interval summarisation** vs no-summarisation. Adaptive «matches or exceeds fixed-interval summarisation at a fraction of the token cost» — up to **+18.1 points** on math and **+5–9** on agentic search over no-summarisation | **30–70% lower** per-question token cost than the fixed-interval baseline | Fixed-interval summarisation is the *worst-timed* variant by construction: firing mid-derivation «discards partial results the model then has to reconstruct, which is the most expensive moment to forget» | [arXiv 2606.23525 «Self-Compacting Language Model Agents»](https://arxiv.org/abs/2606.23525), submitted 2026-06-22, rev 2026-07-10; [Blake Crosley — «Context Compaction Is a Decision, Not a Threshold»](https://blakecrosley.com/blog/agent-context-compaction), 2026-06-23 |

**Concrete operator numbers:**
- Compaction trigger: 70–75% utilisation commonly cited; Claude Code's product-internal 150k/200k = 75% (RQ1 1.2)
- Compaction yield: frees 60–70% of context window (multiple sources)
- Recommended rotation trigger: 60–65% utilisation (NOT 80%+) — Vincent van deth blog, 2026
- Multi-agent cost compounding: "3 agents cost 10x" via context transfer + retries + verification stack — [AugmentCode](https://www.augmentcode.com/guides/multi-agent-cost-compounding), 2026

**Cross-reference to D6 SSOT entries:** SSOT #230 (`mattpocock/skills` handoff = REFERENCE) — confirmed by 2026 sources; the "handoff.json" / "handoff.md" pattern is the dominant practitioner recommendation. SSOT #122 (session-recap family) — confirmed as a family, but **rev 2 withdraws rev 1's ranking claim** («recap is the SECOND-BEST option, behind full fresh-session with residue»): that ranking was asserted against a row rev 1 had itself marked coverage-insufficient. The 2026 evidence now available ranks *timing* (adaptive vs fixed-interval), not *mechanism* (recap vs fresh session) — **no source surfaced by this sweep** compares a residue-doc handoff head-to-head against a synthetic recap. The honest statement is that the three practices are **unranked against each other**, with one measured sub-result: adaptive beats fixed-interval summarisation on both quality and cost. *(Rev 3 scoping: rev 2 wrote «nothing measured compares…», which is a negative-existence claim and would owe the §3 checklist. Scoped to this sweep's coverage, it owes nothing beyond the coverage statement already given — and the correction is the same one rev 2 was written to make. Whether such a comparison exists is genuinely open.)*

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
| 4.1 | **Tool-call density ratio** = tool_calls / total_turns in last N turns | High (≥0.7?) | Low | Trivial counter maintained per turn | [arXiv 2605.09252](https://arxiv.org/abs/2605.09252) «LLM Agents Already Know When to Call Tools», **v1 2026-05-10 / v2 2026-05-20** — tool necessity is linearly decodable from the pre-generation representation at AUROC 0.89–0.96 + [Apple — «Reinforced Agent: Inference-Time Feedback for Tool-Calling Agents»](https://machinelearning.apple.com/research/reinforced-agent-inference-feedback), **2026-05** (ACL 2026 GEM workshop) |
| 4.2 | **Gate-backing ratio** = (CI runs + rule-test fires + lint passes) / total_actions | High | Low | Event counter | RQ2 evidence: external gates are what makes mechanical work tolerant |
| 4.3 | **Decision-vs-action ratio** = (verdicts + forks surfaced) / (commands + edits) | Low | High | Counter on emitted artefacts | **NO SUPPORTING SOURCE (rev 3).** Rev 1 cited [agentpatterns.ai — Auto Model Selection](https://agentpatterns.ai/patterns/agent-design/auto-model-selection/) (reviewed 2026-08-07) as «task class as routing signal»; probed rev 3, the page states the **opposite** — «Copilot's published criteria are availability, model performance, plan, and admin policy — **not** declared task class or context size». The citation contradicted the claim it was attached to. Signal 4.3 is a proposal with no external support |
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
| **A** | «no agentic-coding-specific independent benchmark confirms quality holds past ~500k» (§findings RQ1) | **FALSIFIED as written.** LoCoBench-Agent (10K–1M, agentic SWE) and SlopCodeBench (agentic-coding decay over long-horizon iteration) both exist. Narrowed survivor (rev 3 wording — «unit gap» was too flat, the three exclusions differ: 1.8 on **date**, 1.9 on **unit**, 1.5 on **class**): no *dated-2026* source expresses agentic-coding quality against **token fill** past ~500k |
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
above).** *Rev 2 result:* four phrasings, qualitative statements only («more consistent reasoning
quality as context grows»; «at the far end of the window, precision drops»), plus a «safer working
range ≈800k» figure from an aggregator with no stated method — not adoptable. Disposition
`COVERAGE INSUFFICIENT TO CONCLUDE`.

***Rev 4 re-sweep — the «none numeric» half of that is now falsified.*** Four fresh phrasings against
Fable-5 and Opus-5 long-context quality (`Fable 5 1M context degradation benchmark 2026`,
`Opus 5 effective context 300k quality degradation agentic coding`,
`Opus 5 context window degradation long context performance`,
`"context rot" 2026 degradation 300k tokens frontier models`) surfaced **three numeric rows the rev-2
sweep missed** — 1.10 (Fable-5 accuracy vs token fill, 2026-06-13), 1.11 (peer-review-track judgment
degradation on the token axis, 2026-05-12), 1.12 (the 300k–400k band, snippet-level) — plus 1.13,
which is numerically empty but kills a claim: **no first-party Opus-5 page verified by this sweep
states a degradation-onset token count**, and the widely-repeated «holds throughout the 1M window»
line traces to search snippets, not to a fetched vendor page.

Two disciplines this re-sweep is deliberately *not* claiming to have satisfied, stated so a consumer
does not over-read it: it was scoped by the operator to a tier sweep, so items 1–5 above were **not
re-run** for the rev-4 rows, and **no cold audit round was run on them** (rev 3's was the last).
Rev-4 rows therefore carry the same PROPOSED status as everything else here and the same downstream
consumption gate — they are evidence added, not evidence adjudicated.

## §parked-questions {#parked-questions}

Per kickoff §4c (park-don't-guess). Rev 1 recorded «no genuine fork emerged»; rev 2 finds one it had
resolved silently.

> **Where the record actually lives (rev 3).** Kickoff §2:55-57 routes a fired PARK to the **park
> payload + the PR's `## Parked questions`** and states that recording one «is not a file write».
> This section is therefore **additive, not the record** — a reader must not treat its presence here
> as the park having been routed. The harvesting session owns putting PARK-CDC-1 into the PR body;
> if it is absent there at merge time, the fork expires with this patch.

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

Not resolvable from the sources surfaced by this sweep — none measures our task classes at these
fills. *(Rev 3 scoping: rev 2 wrote «Not resolvable from the literature», a negative-existence claim
about the whole literature that would owe the §3 checklist. The fork is parked on **this sweep's**
coverage; a later sweep that finds such a measurement resolves it.)* The RQ3
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
| `T_soft(1M)` (operator floor) | 300k | **300k retains** (judgment); **500k** mechanical-tail provisional. *Value unchanged by rev 4 — what changed is that it is no longer evidence-free* | Wrong if a 1M-window agentic-coding benchmark lands showing quality degradation onset < 300k for judgment work on Fable 5 / Opus 5. **Nothing in the rev-4 sweep fires this** — every dated 2026 source places observable onset at or above the 300k band, so the floor reads conservative-safe rather than contradicted | T-CDC-A: vendor claims «stable to 1M» are NOT agentic-coding-validated — and per **1.13** no fetched first-party Opus-5 page states an onset number at all. **Rev 2 correction:** rev 1 called RQ1 1.5 «the strongest external anchor» here while rating it WEAK in §findings — and 1.5 is retrieval-benchmark evidence, the class this patch demotes 1.6 for. **Rev 4 anchor set (directional, not pinning):** 1.11 is the strongest — judgment degradation on the *token* axis, 2026-dated, Opus-family model, 2×–30× more missed detections past 800k; 1.10 shows Fable-5 judgment-shaped accuracy already down 17.2pp between 200k and 800k; 1.12 names 300k–400k as where the effect becomes clearly observable but is **snippet-level and re-reports a 2025 corpus**. 1.8/1.9 stand as before. **No source pins 300k for agentic coding**, so 300k is still operator-experience-derived — now with external evidence pointing the same way, which is a different epistemic state from rev 3's «derived from nothing external» |
| Working ceiling (mechanical tails) | ~500k | **500k retains** as PROVISIONAL ceiling for mechanical-tail work only — **now bounded above rather than open-ended** | Wrong if mechanical-tail quality degrades measurably before 500k under in-house measurement. Rev 4 adds an *upper* falsifier: a ceiling raised past **~600k** contradicts 1.10's effective-reasoning estimate | Coverage still INSUFFICIENT to derive the value (T14) — operator-experience-derived, not benchmark-derived. Rev 4 changes its *status*: 1.10 puts Fable-5 effective reasoning at ~600k and still measures 94.2% on 10-fact/500k multi-needle, so 500k sits just under an independently estimated ceiling instead of floating unbounded. Directional corroboration for keeping it; **not** a licence to raise it |

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

The session's estimated ~80–110k context is **well below the 140k judgment-floor** proposed above, so per our own calibration this output should be at full quality. *(Rev 3: 140k is the **current D6 provisional**, not this patch's proposal — after rev 2 the patch proposes nothing here, it parks a 130k/150k fork. The sentence is left standing as rev 1 wrote it because it is the reasoning being audited below, but the anchor it leans on is no longer the patch's own.)* The three self-corrections above are consistent with that — the model caught its own pre-deadline drift in the adversarial step. **Falsifier:** if a cold reviewer finds a fourth pre-deadline claim that the counter-prompt missed, that would be evidence of subtle degradation under 100k and would lower the proposed floor.

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
Condition **(c)** (<5 dated 2026 sources) did NOT fire — of the **26** distinct URLs now cited, well
over 5 carry a 2026 date, comfortably above the floor. *(Rev 3: rev 2 wrote «16 of the 21», carrying
rev 1's URL count into a rev-2 sentence — the miscount its own next bullet was written to fix.)* (Kickoff §6(c) is a floor, not a stopping point — see
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
- Dates verified against the source rather than against its label: **23/26 (rev 3 correction).** Rev 2
  asserted 26/26; it had in fact checked only the citations it touched. The three it missed —
  `arXiv 2605.09252`, the Apple ML page and `agentpatterns.ai` (signals 4.1 and 4.3) — carried **no
  date at all**, and probing them in rev 3 dated all three *and* found that the `agentpatterns.ai`
  page states the **opposite** of the claim it was cited for. The remaining 3 of 26 are the two
  bot-blocked URLs and the Reddit thread, whose dates rest on the rendering fetch rather than a
  direct read. The check is what caught four mislabelled years (2.1, 2.4, RQ3 #13239, 1.5) plus, in
  rev 3, one mis-attributed source.
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

*Current as of 2026-08-10 (rev 3). Rev 2: 2026-08-10. Rev 1: 2026-08-09.*
