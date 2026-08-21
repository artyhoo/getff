# R-phase kickoff — H10 verdict-as-tool-call gate (recommendation-gate, deferred from D6)

> **Status:** PLANNED, not dispatched. Created 2026-05-21 as the H10 arm of the recommendation-gate D6 decision (maintainer chose: ship H1 now, reject H2, **defer H10 to this research R-phase**). Dispatch when the maintainer decides to invest in a HOT structural gate beyond the H1 reminder (PR #117).
>
> **Run Phase -1 self-review on THIS kickoff before dispatch** (it's ≥30 lines + a research delegation). Not done yet — do it at dispatch time.

## Origin / evidence base (read first)

- `research/recommendation-gate-iterative` branch — rounds 3/4/5 (full dry-run + §5 decision surface). Especially **round-5 §5.1** (D6 framing, H10 = option a/c) and **round-4 §4.x** (adversarial-gap findings).
- D6 decision realised in **PR #117** (H1 shipped, H2 rejected, H10 deferred here).
- `2026-05-16-§17-think-time-gate.md §2.3` (H10 original spec) + `§4 H10` (fabrication-bypass caveat).

## What H10 is

Verdict-as-tool-call: the AI cannot emit a verdict/recommendation as prose. It must call `issue_verdict(...)` whose schema enforces `ssot_id`, `evidence[]`, `adversarial_falsification`, `external_search_summary` **at call-time, before the verdict prose exists**. HOT, in-dialogue. Prior-art verdict (provisional): BUILD — no production analog found in a 5-phrasing search. FP rate 0%, catch ~56%.

## Research questions (R-phase deliverable = a Markdown decision doc, NO implementation)

1. **Re-verify the BUILD verdict adversarially** (round-4 found R2c lacked falsification). Run the 6-item search-coverage check (`phase-research-coverage.md §1`): DeepWiki + WebSearch ≥3 phrasings each — does a production «structured-recommendation / verdict-as-tool-call gate» exist (MCP tool-call enforcement, structured-output schemas for agent decisions, etc.)? If yes → BUILD becomes ADAPT/ADOPT. **No-paid-LLM: DeepWiki/WebSearch only.**
2. **Fabrication-bypass** (`§17-think-time-gate §4 H10`): the schema enforces *structure*, not *truth* — the AI can fill `evidence[]` / `ssot_id` with plausible fabrications. Is H10 then theatre? What deterministic post-check (e.g. the §1.9 SSOT-existence grep, file:line existence check) could pair with the schema to close this? Does pairing make H10 worth the build over H1+existing checks?
3. **Schema boundary** (§5.2.2): do intermediate «shortlist / examine» meta-decisions require `issue_verdict`, or only final ADOPT/DEFER/BUILD/REJECT verdicts? Decide the `verdict_type` enum scope before any build.
4. **Build-cost vs headroom (the kill-question).** H10 = HIGH build (custom MCP server, dialogue restructure) for a single maintainer (BFR §2). Baseline groundedness is already ~0.75 (#97/#98) — **small headroom**. Quantify: what measurable lift over H1-alone would justify the MCP build? Is there longitudinal evidence (the H1 reminder + #98 detector accruing) that should gate the H10 go/no-go?
5. **Go/no-go recommendation** with explicit falsifier, surfaced as decision-needed (reviewer-discipline — do NOT pick; maintainer decides).

## Constraints

- **No-paid-LLM-in-CI** — an MCP `issue_verdict` server is session-local (not CI, not paid-API) → allowed, but confirm it never calls a billed API. Research itself: DeepWiki/WebSearch/deterministic only.
- **BFR / single-maintainer maintenance budget** — HIGH-build BUILD verdicts need a load-bearing-gap justification, not «we can».
- **Consolidation (§5.3 decided): keep SEPARATE** from the autonomous-self-audit R-phase — bounded done-criterion.

## T-traps active (per `.claude/rules/ai-laziness-traps.md §2` — enumerate at dispatch)

- **T11/T12** — re-search before re-asserting BUILD (don't inherit the unfalsified R2c verdict).
- **T16** — «verdict-as-tool-call» problem-class match: does an upstream «structured agent decision» tool actually solve OUR recommendation-discipline problem, or just share the name?
- **T2** — design ≠ validate; if recommending BUILD, state the measurable lift threshold, not «would help».
- **T15** — self-application: would H10 have gated this very kickoff's own go/no-go recommendation?

## Out of scope

No implementation, no MCP server code, no `settings.json` edit. Markdown decision doc only. Dispatch decision (now vs await H1/detector longitudinal data) is itself a maintainer call.

<!-- host-verify: none — R-phase research kickoff: the deliverable is a markdown decision doc, NO implementation (own §research-questions) — no executable artifact to verify on the host -->
