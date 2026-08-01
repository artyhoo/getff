<!-- scope: stage B token-economy research — BFR-disciplined candidate survey against the §2 measured profile; zero-build; Opus distillation seat owns ranking. -->

# Token-economy stage B — candidate survey against the measured profile

> **Stage goal (kickoff §0):** BFR-disciplined survey of candidate mechanisms for reducing
> token/context spend on the expensive model tiers, each evaluated against the **measured** cost
> profile inlined in
> [`token-economy-research-s-b/kickoff.md §2`](../../../.claude/orchestrator-prompts/token-economy-research-s-b/kickoff.md).
> **Zero build** — no tool installed, wired, or adopted under any outcome.
> **Consumer of this output:** the Opus distillation seat merges stage A + stage B into the single
> patch the operator reads. This file is raw material, not a ranking — **K6 adjudication and the
> final ranking are NOT this stage's** (kickoff §0/§4).
> **Measured headline (kickoff §2.1, single aggregator run 2026-08-01T01:00:50Z, 247 transcripts):**
> cache READ 53.3% · cache WRITE 32.2% · output 14.0% · uncached input 0.5% → **85.5% of weighted
> cost is context re-submission, not generation.** Every candidate below names which §2.1 row it
> attacks before its estimate (kickoff trap T-TokenB-B).
> **Funnel design:** [`2026-08-01-token-economy-research-design.md`](../../superpowers/specs/2026-08-01-token-economy-research-design.md)
> (GLM gather → Opus distill → Fable decide).
> **Parallel stage:** [`token-economy-research-s-a`](../../../.claude/orchestrator-prompts/token-economy-research-s-a/kickoff.md)
> owns always-on attribution; cite `PENDING-STAGE-A` where its numbers are needed.

## W1 — Own-stack enumeration (own-stack-first, criterion zero)

Per [`build-first-reuse-default.md §1.1`](../../../.claude/rules/build-first-reuse-default.md) the
harness this project already runs is checked before any external candidate. Source-cited, not
recalled. Each item carries an `arch-v2 overlap:` label per kickoff W1 item 4.

1. **Progressive disclosure already shipped.**
   - `.claude/rules/00-rule-index.md` — the digest pattern: one summary line per rule in a
     rendered index table; full rule text lives in `.claude/rules/<name>.md` and is loaded only
     when its `paths:` glob matches an edited file (auto-load via the CC rules convention). Hot
     index + cold full-text.
   - Skill `SKILL.md` hot + `references/` cold split — e.g. `.claude/skills/aif-implement/SKILL.md`
     stays lean and references `references/IMPLEMENTATION-GUIDE.md` and `references/LOGGING-GUIDE.md`
     (opt-in reads, not resident).
   - `claudeMdExcludes` at `.claude/settings.json:214` — 7 entries today (`egress-no-api-bypass`,
     `memory-codification`, `recommendation-laziness-discipline`, `reviewer-discipline`,
     `autonomous-loop-continuity`, `git-conflict-merge-forward`, `cold-seat-economy`): these rules
     are excluded from the CLAUDE.md auto-injection channel. **Stage A carries a pre-found finding
     that the exclusion only partially evicts** (the rules remain project-instructions via CC's
     parallel rules auto-load, a different channel from CLAUDE.md) → attribution =
     `PENDING-STAGE-A`; this stage does **not** re-derive it.
   - **`arch-v2 overlap:`** disclosure artefact enumeration is stage A's W4
     ([`token-economy-research-s-a/kickoff.md:122`](../../../.claude/orchestrator-prompts/token-economy-research-s-a/kickoff.md));
     arch-v2 S-C will give the BFR verdict on L2 population mechanisms. This stage's candidate 2
     (T3 below) feeds mechanism options INTO that verdict — it does not duplicate the enumeration.

2. **Seat/dispatch economy already measured** — cite, do not re-measure.
   [`cold-seat-economy.md §3`](../../../.claude/rules/cold-seat-economy.md) (`:56` section header)
   table:
   | run | tokens | tool calls | wall clock |
   |---|---|---|---|
   | fresh agent (top tier), full fidelity audit | 185,239 | 19 | 174 s |
   | resumed agent (top tier), narrow scope | 164,995 | 8 | 144 s |
   | fresh agent (executor tier), narrow 4-file review | 177,105 | 7 | 137 s |
   | fresh agent (executor tier), inputs inlined, zero tools | 85,855 | 0 | 16 s |
   The load-bearing lever: **inline inputs in the dispatch prompt** (zero tool-reading turns) ≈
   half the tokens of file-reading variants. Turn count dominates cost; input narrowness alone
   saves little. Watch-list mechanism in
   [`agents/fidelity-auditor.md`](../../../agents/fidelity-auditor.md).
   - **`arch-v2 overlap:`** dispatch-input economy IS arch-v2 S-B's surface
     ([`calibration.md`](../../../.claude/orchestrator-prompts/arch-v2-context-pipeline/calibration.md)
     — the shadow-A/B ledger). This stage does not propose new dispatch choreography; any
     candidate that overlaps seat-economy (T4 native sub-agent isolation) is labelled against it.

3. **Model-cost routing** — [`CLAUDE.md «Task-tier routing»`](../../../CLAUDE.md): Tier 0 (≤~5
   lines, senior edits directly) / Tier 1 (bulky-simple, `bridge-profile` marker → executor tier
   runs the whole pipeline) / Tier 2 (bulky-complex, top tier plans). This very stage is Tier 1
   via the `Z.AI GLM-5.2 SDK` marker — an in-flight example of routing context-heavy-but-judgment-light
   work to the cheaper tier.
   - **`arch-v2 overlap:`** none — tier routing is the harness/operator axis this research runs on,
     not an arch-v2 stage. A budget gate (S-E) would operate on the OUTPUT of this routing, not
     replace it.

4. **The in-flight arch-v2-context-pipeline umbrella.**
   [`kickoff.md:6`](../../../.claude/orchestrator-prompts/arch-v2-context-pipeline/kickoff.md)
   goal verbatim: *«context is the one convention this project never made executable — budget
   asserted by nobody, every role loaded identically»*. The umbrella owns (§1 stage table):
   - **S-A** `/arch` v2 rewrite + L1 attribution plumbing;
   - **S-B** dispatch-input contract v2 + shadow-A/B calibration ledger (the
     [`calibration.md`](../../../.claude/orchestrator-prompts/arch-v2-context-pipeline/calibration.md)
     read for this section);
   - **S-C** L2 population table + 5-option BFR verdict (null option live);
   - **S-D** L2 build — whatever S-C selects;
   - **S-E** L1 budget gate at pre-push/CI + `InstructionsLoaded` blocking verification;
   - **S-F** small-fixes queue.
   **What the umbrella owns:** L1 measurement/attribution/budget-gating, L2 per-role context
   verdict, dispatch-input reality-check choreography. **What it does NOT own:** external candidate
   surveys (RTK and siblings) and native-harness feature adoption verdicts — exactly stage B's
   scope. The token-economy research (stages A+B) feeds evidence INTO S-E's budget gate and S-C's
   L2 verdict; it does not duplicate them.
