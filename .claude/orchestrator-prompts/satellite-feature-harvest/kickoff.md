# KICKOFF — satellite-feature-harvest (R-phase, form B: proactive «turn-on/wire» list)

> **Type:** R-phase (research → actionable wire-list research-patch). **NO adoption code** (T5). Output runs every candidate through the §1.1 criteria.
> **Goal (form B, maintainer-confirmed 2026-06-01):** proactively go through every capability reachable from the maintainer's stack — **Claude Code native first**, then companions — and produce a list of «**turn this on / wire this**» that **clearly strengthens the maintainer's whole dev work**, *even without a current pain*. Output: adopt-now / wire-where / defer+trigger / skip.
> **Bidirectional (maintainer refinement 2026-06-01):** the harvest runs BOTH ways — (forward) adopt a companion feature into the work; **(reverse) retire or thin-wrap things WE already built that a companion now does the same or better.** See §2.5.
> **Base branch:** staging. **Output:** `docs/meta-factory/research-patches/2026-06-01-satellite-feature-harvest.md`.
> **Mode:** Mode A (inline Opus, MCP-heavy). Verify every load-bearing claim against source.

## §0 Why this is form B (not «fix my pains», not «another map»)

The full capability map already exists ([#295 inventory](../../../docs/meta-factory/research-patches/2026-05-30-universal-satellite-integration-matrix.md) + [survey](../../../docs/meta-factory/research-patches/2026-06-01-companion-capability-survey.md)) — so this is NOT a re-survey. The maintainer wants the **proactive filter** of that map onto his actual work: not «what hurts» (form A — rejected), not «show me everything» (form C — that's the existing map), but «**what would clearly make my development stronger if I turned it on**».

## §1 The load-bearing filter for form B — the anti-«cool-but-irrelevant» gate

Form B has no pain-gate, so relevance is enforced by the **surface-gate** (§1.1 criterion 1). A capability enters the list ONLY if BOTH hold:

1. **Named surface:** there is a concrete point in the maintainer's actual work cycle where it would sit (orchestration / dispatch / review / planning / the runtime-bridge / actually writing code / session control / …). No surface → **SKIP**.
2. **Clearly better, materially:** it beats the current way *noticeably*, not marginally — it measurably moves at least one of: **speed · quality · autonomy · less manual toil · fewer errors**. Marginal / «nice» → **SKIP**.

«Cool but irrelevant» = fails surface or only-marginal → SKIP. This is the whole guard for B — apply it strictly; the default answer for a flashy-but-unanchored feature is SKIP, not adopt.

## §2 Criteria — `build-first-reuse-default.md §1.1` verbatim (do NOT invent)

Run **every** candidate through the funnel, in order:

0. **Own-stack-first (criterion zero).** Does **Claude Code** ship this natively? Yes → companion is redundant for that need; record + skip the companion. Sweep CC's surface EXPLICITLY first (Stage 1 below).
1. **Surface-gate** = §1 above (the B relevance filter).
2. **Cost-gate (mechanical = capability-commit test).** Cheap (text/skill/rule edit, env-var, config, citation — no dep, no ≥50-80 LOC module, no standing infra) → **ADOPT-NOW** when it passes §1. Expensive (dep / code-module / standing infra) → step 3.
3. **No-pain bar (form-B-specific).** B has no cited-pain requirement, so the bar for *expensive* items is higher: adopt-now only if **materially transformative** at its surface; merely «better» + expensive + no pain → **DEFER** + recorded trigger.
4. **Reuse-gate** before any build (BFR). **Two-axis verdict:** operator (use-maximally) vs shipped (agnostic + graceful degradation). **Where:** [rule-enforcement-channel-selection.md §4](../../rules/rule-enforcement-channel-selection.md).

## §2.5 Reverse sweep — retire / thin-wrap our own things готовое now supersedes

For EACH companion (or CC-native) capability surfaced, also ask the reverse question: **do we already maintain our own parallel implementation of this?** If yes, apply BFR's origin principle («берём готовое; дописываем только недостающее»):

- **Move 1 — our-own fully duplicates готовое → RETIRE ours, ADOPT theirs.** Our parallel impl is `#parallel-evolution-creep` ([build-first-reuse-default.md §4](../../rules/build-first-reuse-default.md)) — pure maintenance debt. This catches what the per-commit gate cannot ([§2 of that rule](../../rules/build-first-reuse-default.md): «3-6 months later the composed result is a parallel implementation upstream does better»).
- **Move 2 — our-own is better ONLY via a thin unique layer → keep the thin layer, drop the duplicated bulk, ride готовое underneath.** BFR verdict **ADAPT** — «дописываем только недостающее».

**Two-axis caveat (load-bearing — do NOT skip):**
- **Operator axis** (maintainer's dev tooling) → retire-and-ride freely.
- **Shipped axis** (artefacts installed into consumers) → Move 1/2 apply **only if готовое is optional + degradable**; making a consumer hard-depend on a companion breaks the agnostic-core invariant ([README.md#why-this-exists](../../../README.md#why-this-exists)). If готовое can't degrade gracefully, **keep ours** — it IS the agnostic core. Falsifier: a `retire-ours` verdict on a shipped artefact with no graceful fallback = a goal change, not an operational call → surface as DECISION-NEEDED, do not decide.

**Scope bound (anti-sprawl):** the reverse sweep is folded INTO the per-capability pass above — only audit our-own parallels that **overlap a capability already surfaced** in this harvest. It is NOT a standalone audit of the entire codebase.

## §3 Shape — 2 stages (own-stack first reframes everything)

**Stage 1 — own-stack sweep (Claude Code native).** Read CC docs; enumerate what CC ships that the maintainer under-uses. Seeds (verify + extend): Remote Control (found this session), hooks, subagents, MCP, skills, worktrees (`claude -w`), background tasks, output styles, plan mode, `/` built-ins. Output: «CC already does X/Y/Z» list. **This list kills any Stage-2 companion candidate CC already covers.**

**Stage 2 — companion harvest.** Extend the existing inventory (cite, do NOT re-derive — T-SFH-B). Run each companion capability through §2, with Stage-1's CC-native list applied as criterion-zero. Companions + seeds: Superpowers (problem-solving suite, brainstorming, writing-plans, tracing-knowledge-lineages, when-stuck, preserving-productive-tensions, find-skills, SDD, requesting-code-review, verification-before-completion); aif-handoff (closure_first, autoQueueMode, manualReviewRequired, @aif/mcp, Telegram-notify); Superset (MCP start_agent_session, multi-device, automations/RRule, session-persistence, Slack); AI Factory (/aif-evolve, skill-context); + amux / Cursor-hooks deltas from #295.

## §4 Anti-loop guards — the 3 failure modes hit THIS session (do not repeat)

The maintainer's explicit requirement: no «another round of empty checks by the wrong criteria». The worker MUST avoid the three concrete misses of 2026-06-01:

1. **own-stack-blindness** — crediting a companion for what CC ships natively (we missed CC Remote Control vs Superset Slack). Counter: Stage 1 first, criterion-zero on every Stage-2 candidate.
2. **one-source-is-enough** — a single WebSearch put «Slack» on Apache-Superset and «nothing exists» where our own BFR was the answer. Counter: ≥2 independent sources / ≥3 phrasings per load-bearing claim; DeepWiki + primary WebFetch for anything that drives a verdict.
3. **re-survey instead of extend** — re-deriving the #295 inventory. Counter: cite + extend; a capability already verdicted in `prior-art-evaluations.md` is cited, not re-evaluated.

## §5 Output (research-patch)

- §1 scope + method (form B, surface-gate filter, own-stack-first, 2 stages, anti-loop).
- §2 Stage-1 result: CC-native «already does» list.
- §3 **the harvest table:** `capability | source | CC-native-redundant? | surface (named) | clearly-better? (which of speed/quality/autonomy/toil/errors) | cost (cheap/expensive) | supersedes-ours? (retire / thin-wrap / none) | §1.1 verdict | operator/shipped | timing (adopt-now / wire-where / defer+trigger / skip) | channel`.
- §4 **adopt-now set** — each with the exact wire target (file/skill/env/setting); the edit itself is deferred to the maintainer (Artifact Ownership Contract).
- §4b **reverse-sweep set** — our-own things to RETIRE (готовое supersedes) or THIN-WRAP (keep delta, drop bulk), each with the two-axis call (operator = act / shipped = DECISION-NEEDED if no graceful degradation).
- §5 defer set (triggers) + skip set (incl. own-stack-redundant + cool-but-irrelevant, named).
- §6 SSOT additive rows/updates (append-only); §7 §1.7 forward+backward; `## 🟢 Простыми словами`.
- Verdicts are **recommendations** — maintainer decides adoption (reviewer-discipline §2). Do NOT adopt in this R-phase.

## §6 AI-laziness traps (per `ai-laziness-traps.md §2` — enumerate + extend)

Active: **T1** (don't stop at first-found — dig deep, the one-search incident), **T3** (claim = source file:line / DeepWiki link / command output), **T5** (research only, no adoption code), **T11/T12** (BFR + ≥2 sources before «adopt»; not from training memory), **T13** (companion ≠ zero-work), **T16** (problem-class match), **T19** (own cold-QA before handoff), **T20** (no verdict without a tool call).
Domain-specific: **T-SFH-A own-stack-blindness** (credit a companion for what CC ships — counter §2.0 + Stage 1). **T-SFH-B re-survey** (re-derive #295 — counter §4.3 extend). **T-SFH-C cool-but-irrelevant** (B-specific: adopt a flashy feature with no named surface or only-marginal gain — counter §1 surface-gate; default = SKIP). **T-SFH-D retire-without-degradation** (reverse-sweep: `retire-ours` on a SHIPPED artefact where готовое can't degrade gracefully → silently makes a consumer hard-depend on a companion = goal change. Counter §2.5 two-axis caveat: shipped-axis retire/thin-wrap only if готовое is optional+degradable, else keep ours / surface DECISION-NEEDED).

## §7 Read-first

1. [`build-first-reuse-default.md §1.1`](../../rules/build-first-reuse-default.md) — THE criteria (own-stack-first + two axes + cost-gate). The lens.
2. [`prior-art-evaluations.md`](../../../docs/meta-factory/prior-art-evaluations.md) — SSOT (extend, don't dup).
3. Existing inventory (§3 Stage 2) — cite + extend.
4. Claude Code docs (Stage 1 own-stack sweep) + companions via DeepWiki.
5. [`phase-research-coverage.md`](../../rules/phase-research-coverage.md) + [`ai-laziness-traps.md`](../../rules/ai-laziness-traps.md).

## Finish REPORT with

research-patch PR# · Stage-1 CC-native list · harvest table · adopt-now set + exact wire targets · skip set (own-stack-redundant + cool-but-irrelevant, named) · defer triggers · SSOT rows · §1.7 presence · `## 🟢 Простыми словами`.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
