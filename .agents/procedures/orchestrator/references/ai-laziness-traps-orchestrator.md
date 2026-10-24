# AI Laziness Traps — Orchestrator Edition (T-AO Catalogue)

> **Authoritative for:** T-AO-A through T-AO-L trap catalogue specific to Queue mode / orchestrator sessions. Companion to the project-rule catalogue at `.claude/rules/ai-laziness-traps.md` (T1-T16). That catalogue applies to Workers and Reviewers; this catalogue applies to the Orchestrator session itself, and to patterns that emerge specifically in multi-kickoff autonomous research runs.
>
> **Origin:** Parent autonomous-research-orchestrator session (2026-05-16, state.md at `.claude/orchestrator-prompts/autonomous-research-orchestrator/state.md`). T-AO-A through T-AO-J crystallized during parent run; T-AO-K and T-AO-L added post-run from empirical incidents. Codified in this references/ file per meta-kickoff §5.A.

Per `.claude/rules/ai-laziness-traps.md §3` obligations — kickoff authors MUST enumerate active T-AO numbers and add domain-specific traps. Blanket «see this file» without enumeration = T7 violation.

---

## T-AO-A — Collusion between Worker and Reviewer

**Trigger:** Both Worker and Reviewer are Opus models. They may share model-level biases toward «this looks polished enough».

**Tempted output:** Reviewer returns GO without checking substance — artefact has the right headings and plausible prose but key claims are unverified or acceptance criteria are not actually satisfied.

**Counter:** Orchestrator runs anti-collusion spot-check after EVERY GO verdict (formula: `i = ((artefact_letter_ord + iter_count) * 7 + N) mod N`, where artefact_letter_ord = A→1, B→2, C→3; N = substantive section count; multiplier 7 = prime to spread indices). Orchestrator independently verifies substance of section i against source. If spot-check fails → reject GO, re-dispatch Reviewer with specific finding. Log spot-check details in state.md History.

---

## T-AO-B — Infinite iteration loop

**Trigger:** Reviewer returns REVISE; Worker addresses surface-level concerns; Reviewer returns REVISE again on same fundamental issue.

**Tempted output:** Orchestrator keeps re-dispatching hoping convergence will happen naturally. Context degrades; later iter N output is no better than iter 1.

**Counter:** Iteration cap = MAX_ITERATIONS = 5. If iter 5 returns REVISE → escalate (`ESCALATE:K:max-iterations`) immediately. Between iters: Orchestrator reads both the original REVISE items and the Worker's REVISE-fix summary and confirms the fix actually addresses the HARD-FIX (not a surface rewrite). If two consecutive iters address same HARD-FIX differently but neither resolves → escalate before iter 3.

---

## T-AO-C — File-write delay (Worker gathers in head, dumps at end)

**Trigger:** Worker silently completes all sections in memory, then attempts a bulk Write at end of session. Context exhaustion mid-bulk → output incomplete or truncated; state.md has no interim progress entries.

**Tempted output:** state.md shows no entries for 20 minutes, then suddenly «RESEARCH-COMPLETE» with a partially-written artefact.

**Counter:** Worker prompt mandates write-as-you-go discipline (each section written to file immediately upon completion; state.md appended per section). Orchestrator file-system verify (L2) catches truncated artefacts before Reviewer dispatch: `wc -l` + section count must match expected range from kickoff spec. If state.md has no interim entries → treat as context-exhaustion risk and re-verify file before dispatching Reviewer.

---

## T-AO-D — Scope creep via observations

**Trigger:** Worker, while executing kickoff K, notices a real systemic problem outside K's scope. Worker is tempted to address it inline or recommend it to Orchestrator as «should also do».

**Tempted output:** Worker appends extra sections to artefact K, or returns RESEARCH-COMPLETE with a rider «I also noticed X and fixed it». Orchestrator is tempted to add a new queue item mid-flight.

**Counter:** Worker prompt explicitly lists anti-scope. Orchestrator does NOT add new queue items mid-run without explicit maintainer instruction (CLAUDE.md «no drive-by PRs» atomic-umbrella discipline). Worker may note observations as ATTN bullets in REPORT — but not expand scope. Orchestrator surfaces observations in final summary; maintainer decides whether to schedule follow-up queue.

---

## T-AO-E — Verdict-grade inflation (Reviewer drifts toward GO)

**Trigger:** Orchestrator has been waiting for artefact K through multiple REVISE cycles. Reviewer notices the Orchestrator is «patient» and the artefact is «improved». Implicit social pressure toward GO.

**Tempted output:** Reviewer downgrades HARD-FIX items to SOFT after one partial fix. Final REVISE items get silently dropped in subsequent verdict.

**Counter:** Reviewer prompt explicitly states «hard-constraint violation = REVISE regardless of how close output looks». Reviewer must re-list all previous HARD-FIX items in subsequent verdicts and explicitly mark each as RESOLVED or STILL-OPEN. Orchestrator checks that all HARD-FIX items from REVISE-iter-N are explicitly resolved in REVISE-iter-(N+1) verdict before accepting GO.

---

## T-AO-F — Orchestrator-as-decider

**Trigger:** Research artefact surfaces a D-question (design choice, strategic direction) that the kickoff marks as «for maintainer». Orchestrator is tempted to pick an answer autonomously because «the evidence clearly points to X».

**Tempted output:** Orchestrator writes a D-item resolution into state.md or instructs Worker to implement based on Orchestrator's preference. Research artefact includes a committed recommendation framed as a decision.

**Counter:** D-questions and Q-questions remain open in artefact §Dn sections. Orchestrator's role is to ensure they are clearly articulated with both options' downstream consequences, not to pick between them. Final summary surfaces D-items as «MAINTAINER-DECISION-NEEDED» list. The Orchestrator may recommend; it may not decide.

---

## T-AO-G — 1A leakage (executing dialogue-shaped kickoff as research)

**Trigger:** Queue contains a kickoff that requires maintainer dialogue before it can be executed (e.g. kickoff 1B in parent session was blocked on 1A's Q1 answer from maintainer). Orchestrator dispatches it anyway, hoping Worker will navigate the ambiguity.

**Tempted output:** Worker produces a generic research output that ignores the open question. Orchestrator marks it GO. The D-question remains unresolved; the research is therefore invalid.

**Counter:** Pre-dispatch check: if kickoff §hard-constraints lists «requires maintainer dialogue on Dn» → do NOT dispatch. Mark as `DEFERRED:blocked-on-maintainer-dialogue`. Escalate immediately with specific «which D-question needs maintainer input before this can execute» note.

---

## T-AO-H — state.md as theatre

**Trigger:** Orchestrator (or Worker) updates state.md with progress entries without file-system verification. state.md says «§4 complete» but the file on disk has no §4 content yet.

**Tempted output:** Reviewer is dispatched based on state.md claim of completeness; discovers artefact is actually incomplete; returns REVISE; Orchestrator confused because state.md looked fine.

**Counter:** L2 discipline (file-system precedence over state.md). Orchestrator ALWAYS runs `ls -la`, `wc -l`, section-count check before Reviewer dispatch. state.md entries describe what is on disk, not what Worker intends. Orchestrator verifies, logs actual numbers in state.md, then dispatches Reviewer.

---

## T-AO-I — Opus model not actually used

**Trigger:** Task tool dispatch does not explicitly specify model. In some Claude Code configurations, the subagent_type defaults to a smaller model regardless of the Orchestrator's model. Worker runs on Sonnet or Haiku; output is lower quality; Orchestrator assumes it got Opus reasoning.

**Tempted output:** Worker returns a plausible-looking artefact with surface completeness but missed depth (T1 sampling floor hit; T6 self-reported high-confidence without calibration).

**Counter:** In burn mode — per memory `feedback_delegation_model.md`, the Opus quota is shared. Workers in Queue mode run at whatever model the Task tool delivers. In true burn mode where Opus reasoning is required — verify model via `claude --version` and model-param in dispatch prompt. If using headless `claude -p` → explicitly pass `--model claude-opus-4-7` or current Opus model ID. Log verified model in state.md pre-flight.

---

## T-AO-J — Headless-fallback-as-default

**Trigger:** Headless dispatch (`claude -p`) is available and convenient. Orchestrator drifts toward using it for all Workers instead of Task subagent.

**Tempted output:** All queue dispatches go via `claude -p`; Task tool is never used. When headless window expires (~2026-06-16), entire Queue mode breaks with no fallback path exercised.

**Counter:** Task subagent is the PRIMARY dispatch mechanism; headless `claude -p` is the FALLBACK for context-exhausted per-section blocks only. See [[queue-mode.md]] §9. Log dispatch mechanism per artefact in state.md. If headless is used → note reason (context-exhausted, Task unavailable). If Task subagent is not being used at all → review whether actual fallback conditions apply.

---

## T-AO-K — Single-channel verification on Claude Code claims (NEW, 2026-05-16)

**Trigger:** Worker or Reviewer verifies a Claude Code internals claim (hook types, settings, MCP contracts, harness behavior) via DeepWiki only, treating it as sufficient.

**Tempted output:** Claim passes single-source check; artefact marked GO. If DeepWiki's understanding of that Claude Code feature was wrong or outdated, the error propagates into the research output.

**Empirical evidence:** Parent session state.md, line 107 (`.claude/orchestrator-prompts/autonomous-research-orchestrator/state.md`): `«REVIEW-COMPLETE #4 iter 0 verdict: REVISE (1 HARD-FIX: Elicitation hook mischaracterization in §5.2/§7.3/§6 Q2.1/§8.1 — hook is MCP-dialog-only, not general output interception; 4 SOFT items)»`. Research patch #4 (think-time-s17-gate) had correctly cited DeepWiki for Elicitation hook, but DeepWiki's characterization was wrong — the hook is for MCP server elicitation dialogs (structured user input mid-task), NOT general assistant output interception. Reviewer caught it via a second independent DeepWiki query from a different angle. Worked by luck. Without the REVISE cycle, the wrong characterization would have propagated.

**Counter:** For ANY Claude Code internals claim (hooks, settings, harness events, slash commands, SDK behavior, MCP contracts), the FIRST verification channel is the `claude-code-guide` built-in subagent. Second channel: DeepWiki or context7. If both channels agree → claim is verified. If channels diverge → flag as INCONCLUSIVE, do NOT accept either channel's answer, surface as D-item for maintainer. Worker dispatch prompt MUST include `claude-code-guide` invocation instructions. Reviewer dispatch prompt MUST check state.md for evidence that claude-code-guide was used for CC claims.

---

## T-AO-L — Project-specific principle test unknown to Worker (NEW, surfaced 2026-05-16 push incident)

**Trigger:** Worker produces a research-patch or other output type that must satisfy project-local principle tests (e.g. `packages/core/principles/10-research-patch-annotation.test.ts` requires `<!-- scope:<slug> -->` on the first line of every research-patch). Worker doesn't know these tests exist; artefact looks complete; Orchestrator marks GO; pre-push hook blocks push hours or days later.

**Tempted output:** Worker reports RESEARCH-COMPLETE without running `npm run test:principles`. Reviewer doesn't check for principle-test results because state.md has no such log entry. Artefact is technically non-compliant but passes human review.

**Empirical evidence:** 2026-05-16 push incident on branch `docs/aif-ssot-corrections`. Parent session Workers for kickoffs #1 and #3 produced research-patches (`2026-05-16-research-tooling-evaluation.md`, `2026-05-16-§13.33-hook-architecture-research.md`) without `<!-- scope:<slug> -->` annotations on first line, as required by `packages/core/principles/10-research-patch-annotation.test.ts`. Pre-push hook blocked the push 24 hours after the artefacts were GO'd. Manual annotation fix was required before re-push. The failure was silent through the entire research + review cycle because neither Worker nor Reviewer enumerated project-local principle tests for the output type.

**Counter:** Worker dispatch prompt MUST enumerate project-local principle tests relevant to the output type. For research-patch output: `principles/10-research-patch-annotation.test.ts` (first line must be `<!-- scope:<slug> -->`). Worker write-as-you-go discipline MUST include a FINAL step before RESEARCH-COMPLETE: run `cd /Users/art/code/rules-as-tests-aif && npm run test:principles`. If any test fails → fix violation, re-run, do NOT report RESEARCH-COMPLETE until green. Log: `«<ISO timestamp> — #K principles tests green (N tests passed)»`. Reviewer MUST check state.md for this log entry; if missing → REVISE immediately. Reviewer MAY re-run `npm run test:principles` independently for confirmation.

---

## See also

- `.claude/rules/ai-laziness-traps.md` — project-wide T1-T16 catalogue (applies to Workers and Reviewers for content quality)
- [[queue-mode.md]] — §6 anti-collusion spot-check formula, §7 iteration limits, §8 memory-update discipline
- [[glossary.md]] — role definitions (Orchestrator / Worker / Reviewer)
- Parent state.md empirical record: `.claude/orchestrator-prompts/autonomous-research-orchestrator/state.md`
