# KICKOFF — pipeline-ux (UX overhaul of /pipeline — kill the noise)

> **Type:** R-phase → I-phase umbrella. Base: staging. Runner: CC (skill-leaning).
> **Absorbs:** the narrower `pipeline-hygiene` umbrella (its digest work = Stage 1 here + T-HYG-A trap).
> **Origin:** 2026-06-03 — operator: «там сейчас пздц творится». Every `/pipeline` invocation dumps walls of raw data + spurious side-effects.

---

## §0 Problem (all evidence from a live 2026-06-03 `/pipeline dispatcher-skill` run)

The `/pipeline` session UX is unusably noisy. Concrete, measured:

- **P1 — 47KB raw dump on EVERY invocation.** `SKILL.md:81` fires `plan-currency-check.sh` as an **unconditional `!`-fence** → renders the full `wave-sequencing-plan.md` (293 lines) + 147-umbrella kickoff-existence list + 147 `UNTRACKED-KICKOFF` lines + 30-PR JSON inline. That is AI-input rendered verbatim to the human. Grew with backlog (tolerable at ~20 umbrellas, now 147).
- **P2 — heavy §2 helper runs in named-mode where §2 is skipped.** `SKILL.md:106` says «§2 runs only in no-argument mode; skip if `<umbrella>` provided» — but the §2 `priority-score.sh` `!`-fence fires anyway (CC fires ALL `!`-blocks at skill-load, before arg-routing). So `/pipeline <umbrella>` pays for the no-arg priority scan it never uses → wasted CPU + heat.
- **P3 — the inline report is a wall.** Per-step narration + 5-column tables + full dependency graph even for a 3-stage sequential umbrella. Operator reaction: «почему столько текста».
- **P4 — spurious aif auto-dispatch every run.** The PostToolUse auto-dispatch hook fires on each meta-launch `kickoff.md` Write → creates an aif task that must be hand-parked every invocation. (Hook artefact, not the skill — but part of the same UX mess.)
- **P5 — 522-line SKILL.md** injected into context every invocation (Stage 4 slimmed 600→522, still heavy).

**Root cause (P1+P2):** CC fires every `!`-fence at skill-load, BEFORE the AI branches on the arg. The «skip in named mode» is prose the AI obeys for *using* output — but the heavy fence already ran. Fix = make the helpers themselves arg-aware (compact / early-exit when an umbrella is passed) + emit a digest, not raw.

---

## §1 Stages

### Stage 0 — R-phase: design the target UX (deliverable `ux-design.md`, no code)
- Define what a `/pipeline <umbrella>` session SHOULD show a human: target ≤~15 visible lines (verdict + dep-graph + action-queue); raw data in a side-file reachable on demand.
- Decide the digest shape for `plan-currency-check.sh` (verdict + counters + real DRIFT lines only).
- Decide named-mode vs no-arg: which helpers each mode actually needs; how to make heavy fences arg-aware (early-exit) since CC fires them unconditionally.
- **BFR (build-first-reuse-default.md §3):** does CC offer a quiet/conditional `!`-fence or collapsible-output primitive? DeepWiki + WebSearch ≥3 phrasings. If yes → ADOPT instead of bash-side guards.
- P4 hook: decide — suppress auto-dispatch on `*-meta-launch/kickoff.md`, or make it opt-in. (Hook scope; may split to its own follow-up PR.)

### Stage 1 — I-phase: helper digests + named-mode guards
- `plan-currency-check.sh`: emit a ≤~10-line digest to stdout (`PLAN: current|N drift` + counters + DRIFT lines); write the full corpus to gitignored `_plan-currency-raw.txt` (AI Reads on demand). **T-HYG-A: a real DRIFT must appear in the digest, not only the side-file.**
- `priority-score.sh` + any heavy fence: early-exit compact when `$1` (umbrella) is non-empty — named mode does not need the full backlog scan.
- Update paired-negative tests to the new digest contract; keep them green.

### Stage 2 — I-phase: trim the inline report (§10 output-format)
- Shorter default report for named-dispatch: verdict line + dep-graph + action-queue, drop per-step narration. Keep P15/P18/P19 anchors. Update `references/output-format.md` + principle 18 substrings in tandem.

### Stage 3 — auto-dispatch hook fix (P4)
- The PostToolUse hook should NOT auto-dispatch `*-meta-launch/kickoff.md` (those are dispatch records, not work to send to aif). Gate or suppress. Separate `.claude/hooks/` artefact — may be its own small PR.

---

## §1.5 Verification — finds-all / orders / saves / finds-only-new + UX-works (mostly ALREADY tested — REUSE, don't rebuild)

**BFR (`build-first-reuse-default.md §3`, T16): the four core behaviours are LARGELY covered by existing deterministic paired-negative tests. Do NOT «add tests everywhere» — that is duplication / discipline-theatre.** The UX refactor's primary correctness guard is **keeping the existing suite green**: a digest/early-exit change that breaks find/order/save/only-new is a real regression, not a passing UX win.

| Behaviour | Already-tested by (REUSE — keep green) | Gap to ADD |
|---|---|---|
| **finds all** (discovery + drift) | `packages/core/skills/planner-discovery.test.ts` (5 surface types found), `packages/core/skills/plan-currency-check.test.ts` (`UNTRACKED-N` / `UNTRACKED-KICKOFF` + paired-negatives) | the NEW digest must not drop a found item → a **seeded DRIFT appears in the ≤~15-line digest**, not only the side-file (T-HYG-A made executable) |
| **orders / prioritises** | `packages/core/hooks/priority-score-branch-matcher.test.ts` (DONE-tagging only) | **confirm a RANK-ORDER assertion exists; if NOT → ADD one** (fixture with known scores → asserted output order). Likely the real gap. |
| **saves / persists** | `packages/core/hooks/update-cache.test.ts` (symlink-aware, idempotent), `update-delta.test.ts`, `delta-write-from-state.test.ts` | side-file (`_plan-currency-raw.txt`) **write + reload** assertion (new channel introduced in Stage 1) |
| **finds only NEW on re-run** | `packages/core/hooks/delta-diff.test.ts` (NEW/RESOLVED-SINCE-LAST), `packages/core/hooks/done-md-completion-filter.test.ts` (Layer C2/C3 done.md/jaccard → exclude done), `priority-score-branch-matcher.test.ts` (merged PR → DONE) | none — strong; just keep green |
| **UX works** (the noise-fix itself) | — (digest does not exist yet) | NEW deterministic test: a `/pipeline <umbrella>` digest is **≤~15 lines AND a seeded real DRIFT/UNTRACKED is present** — «UX works» = bounded output that still surfaces real signal, **asserted, not eyeballed** |

So the verification work = (1) the digest UX-works test, (2) confirm-or-add the ranking-order test, (3) the side-file persist test, (4) the existing find/order/save/only-new suite stays green across the refactor — **that green IS the proof the UX change didn't break the core**. Cross-link: this completion-detection logic is the same `priority-score.sh` Layer-C that `dispatcher-ux` P1 reuses.

- **Domain trap T-PUX-B (UX win that silently breaks the core):** a digest/early-exit refactor that makes the output pretty while dropping a real DRIFT or mis-ranking. Falsifier: the seeded-DRIFT-in-digest test or the rank-order test goes red — or worse, was never written, so the regression ships invisibly.

## §2 Discipline
- Branch per stage, base staging. Principle tests green (`npm --prefix packages/core run test:principles`). §1.7 PR-body (H3, «applied», ≥40 chars, ≥1 file:line each). `Prior-art: skipped — UX/output-shape fix to existing skill, no new capability`.
- **Traps:** T3 (file:line evidence) · T15 (keep self-tests green) · T19 (own cold-QA before handoff) · T20 (no verdict without evidence-tool).
- **Domain trap T-HYG-A (digest hides a real drift):** never let the compact digest swallow a genuine DRIFT/STALE item — falsifier: a drift visible in the old raw dump but absent from the new digest = regression.

## §3 Anti-scope
- Do NOT change WHAT data is gathered or the routing logic — output shape + when-it-runs only.
- Do NOT touch dispatcher-skill (different umbrella).
- Keep the side-file channel (AI still needs full data on demand).
- Do NOT add npm deps.

## §4 Done =
A `/pipeline <umbrella>` invocation shows ≤~15 lines to the human (verdict + graph + queue), no 47KB dump, no heat from unused helpers, no spurious aif park; full corpus in a side-file; **the §1.5 find/order/save/only-new suite stays green AND a new deterministic «digest ≤~15 lines with a seeded DRIFT visible» test passes (UX works, asserted not eyeballed) + a rank-order test exists**; §1.7 bodies present.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
