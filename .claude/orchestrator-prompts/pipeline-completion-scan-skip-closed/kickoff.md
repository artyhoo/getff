# KICKOFF — pipeline-completion-scan-skip-closed

> **Type:** I-phase-small (Mode A) with a mandatory MEASURE-first step — perf fix to the `/pipeline` priority/completion scan. May spill to a micro-R if the MEASURE step contradicts the premise (§3 AC-0).
> **Deliverable:** the expensive per-umbrella `dup-detect` completion-scan no longer runs over umbrellas already proven closed by a cheap signal (`done.md` / branch-match); priority/completion scoring becomes ~O(open) instead of ~O(all). Correctness of DONE-detection is preserved (paired-negative test).
> **Base branch:** staging (NOT main).
> **Capability-commit?** No — reuses the existing C1/C3 closure signals as a pre-filter; expected < 80 LOC, no new dependency, no new code module. No `Prior-art:` trailer required (refactor/perf of existing capability). The implementer re-confirms this against [CLAUDE.md «What is a capability commit?»](../../../CLAUDE.md) at commit time.

---

## §0 Problem (with file:line evidence)

`/pipeline` (no-arg / integer-arg) priority + completion scoring is pathologically slow on this repo's backlog. Observed 2026-06-17: `priority-score.sh` took **>15 min wall** to emit (it did complete, `rc=0` — slow, not hung).

Root of the cost: the completion classifier runs the **expensive per-umbrella `dup-detect` pass over the FULL umbrella set, including umbrellas already provably closed by a free check.**

Mechanical magnitude (measured 2026-06-17): **162 kickoffs, 136 of them already carry `done.md`** → ~84% of the scanned set is already closed by the cheapest possible signal (a file-existence check), yet still pays the full per-umbrella scan.

---

## §1 Root cause — code trace

1. [`helpers/priority-score.sh:126-129`](../../skills/pipeline/helpers/priority-score.sh) — **before** the per-umbrella loop, calls `dup-detect.sh --all` **once** to pre-fetch the C2 jaccard data for **every** umbrella.
2. [`helpers/dup-detect.sh:138`](../../skills/pipeline/helpers/dup-detect.sh) — `--all` loops every umbrella through `check_umbrella` (Signal 1 xref grep + **Signal 2 jaccard tokenise+`comm` over ~50 PR titles** + Signal 3 deliverable token-compare). The per-umbrella CPU is dominated by Signal 2. (Signal 3's heavy `git ls-tree` is already hoisted to `precompute_deliverables` at [`dup-detect.sh:130`](../../skills/pipeline/helpers/dup-detect.sh) — that prior optimisation is NOT the remaining gap.)
3. [`helpers/priority-score.sh:189-231`](../../skills/pipeline/helpers/priority-score.sh) — the **cheap** closure layers run **after** the bulk scan, in first-match order C1 (branch, jq over pre-fetched JSON) → C2 (lookup into the bulk dup-detect output) → **C3 (`done.md` file existence, [`:222`](../../skills/pipeline/helpers/priority-score.sh))**. So an umbrella with `done.md` is classified DONE for free at C3 — but its Signal-2 jaccard was already computed in step 1, wastefully.
4. [`helpers/dup-detect.sh:73-127`](../../skills/pipeline/helpers/dup-detect.sh) `check_umbrella` has **no `done.md` / closure awareness** at all — no short-circuit.

**Net:** the cheap closure signal (C3 `done.md`, partly C1 branch) should *gate* the expensive C2 pass. Today the order is inverted — the expensive pass feeds the cheap filter.

---

## §2 Scope + fix-space (design fork — surface, do not pre-decide)

The fix must remove already-closed umbrellas from the **input** of the expensive scan, without changing **which** umbrellas end up classified DONE, and without breaking `dup-detect.sh`'s other caller.

**Hard constraint — two independent callers of `dup-detect.sh`:**
- **Caller A (completion-detection, C2):** `priority-score.sh:126` — here "closed" IS the thing being detected, so skipping closed umbrellas is correct.
- **Caller B (standalone dedup, §2.5 Step 2 of [SKILL.md](../../skills/pipeline/SKILL.md)):** asks "does this NEW candidate overlap recently-merged work?" — here closed-ness is NOT the filter. `dup-detect.sh` today accepts only `--all` or a single `<name>` (no candidate-list / skip flag — [`dup-detect.sh:132-141`](../../skills/pipeline/helpers/dup-detect.sh)).

→ The fix MUST NOT bake "skip done.md" into `dup-detect`'s core semantics (would silently break Caller B). Three legitimate shapes (implementer + maintainer pick — this is a genuine fork, reviewer must not decide it silently per [reviewer-discipline.md §2](../../rules/reviewer-discipline.md)):

- **(a) Orchestration-side (leaning recommendation):** in `priority-score.sh`, compute the cheap closed-set first (C3 `done.md` scan + C1 branch-match — both already available, zero new gh), then restrict the expensive C2 pass to the open survivors. Needs a way to pass dup-detect a candidate subset (new opt-in surface on dup-detect, used only by Caller A).
- **(b) Opt-in flag on dup-detect:** `MO_SKIP_CLOSED=1` (or an exclude-list arg) consulted only when set; Caller B never sets it. Keeps the filter logic in dup-detect but off-by-default.
- **(c) Reorder + lazy C2 in priority-score:** evaluate C3/C1 per-umbrella first; only consult C2 for not-yet-DONE umbrellas. Requires C2 to be queryable per-umbrella cheaply (today it's bulk-precomputed) — assess whether per-open-umbrella `dup-detect <name>` calls re-running `precompute_deliverables` each time is cheaper than one `--all` over the open subset (it may NOT be — measure).

Leaning **(a)** on the dual-caller constraint (keeps dup-detect's two callers cleanly separated), but this is a fork for the maintainer/implementer, not a reviewer call.

---

## §3 Acceptance criteria

- **AC-0 (MEASURE-first — gates everything else):** before writing the fix, time the expensive pass on the **full** set vs an **open-only** prototype and record both numbers in the PR body, e.g. `time MO_… dup-detect.sh --all` (162) vs the same restricted to the ~26 open umbrellas. **If the delta is NOT the dominant cost** (i.e. the real cost is umbrella-invariant — `precompute_deliverables` `git ls-tree`, or the `gh pr list` fetches at [`priority-score.sh:116/135`](../../skills/pipeline/helpers/priority-score.sh)) → **STOP, do not ship the reorder**, re-scope as a micro-R and surface to maintainer. (Counters T-PCS-A.)
- **AC-1:** already-closed umbrellas (provable via cheap C3 `done.md` or C1 branch-match) are excluded from the expensive C2/dup-detect scan input.
- **AC-2 (correctness invariant — paired-negative, mandatory):** an umbrella closed **only** by C2 jaccard (no `done.md`, no branch-match) is **still** classified `status=DONE` after the fix; an open umbrella stays open. Add a paired-negative test fixture proving the optimisation does not change DONE-membership (per `~/.claude/rules/testing.md` «Негативные тесты» (operator-global rule)).
- **AC-3:** Caller B (standalone `dup-detect.sh <name>` / `--all` for §2.5 dedup) behaviour is unchanged — its existing test stays green; if shape (b), the skip path is off unless `MO_SKIP_CLOSED` is set.
- **AC-4:** deterministic, no new dependency, no paid LLM ([no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md)); helper self-tests under `packages/core/hooks/` (or wherever the existing dup-detect / priority-score tests live) updated + green.
- **AC-5:** re-run `/pipeline` (no-arg) after the fix and record the new wall-time vs the >15 min baseline in the PR body (evidence, not assertion — per H1 / [phase-research-coverage.md §1.7](../../rules/phase-research-coverage.md)).

---

## §4 Anti-scope

- Do NOT rewrite the C1/C2/C3 completion-detection algorithm — only change WHICH umbrellas the expensive layer is fed.
- Do NOT touch the synthetic-candidate discovery ([`priority-score-synthetic.sh`](../../skills/pipeline/helpers/priority-score-synthetic.sh)) unless AC-0 measurement implicates it (then surface, re-scope).
- Do NOT add a candidate-skip to `dup-detect`'s default path (breaks Caller B).
- Do NOT add npm deps or any gh call inside the per-umbrella loop (the W3 single-fetch design at [`priority-score.sh:135`](../../skills/pipeline/helpers/priority-score.sh) must be preserved).

---

## §5 AI-traps active (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md) for the full catalogue.

**Active canonical traps for this umbrella:** **T2**, **T3**, **T11**, **T12**, **T15**, **T16**.

- **T2** (designing ≠ doing) — proposing a reorder is not the fix; the fix is measured + tested. AC-0/AC-5 force real invocation + numbers.
- **T3** (no prose-only findings) — every claim carries file:line or command output; §1 trace + AC measurements.
- **T11 / T12** (don't build custom / don't skip the measure because "obviously jaccard is the cost") — reuse the existing C1/C3 signals; MEASURE before assuming where the cost is (AC-0). The "Signal-3 is slow" framing in chat was loose — Signal 3's heavy part is already hoisted; verify the real hot path, don't pattern-match the label.
- **T15** (self-application) — the optimisation to the completion-detection machinery must not break the completion detection it speeds up (AC-2 paired-negative is the recursive guard).
- **T16** (pattern-matching-on-name) — `dup-detect` is NOT only a "completion detector"; it has a second caller (standalone dedup) with different semantics. Don't assume one fix fits both (AC-3).

**Domain-specific traps (this umbrella, NOT in the canonical catalogue):**

- **T-PCS-A — «reorder without timing»:** assume the closed-umbrella jaccard is the bottleneck and ship the skip-closed reorder without AC-0 measurement → mis-targeted fix if the dominant cost is umbrella-invariant (`precompute_deliverables` `git ls-tree`, or the `gh` fetches). Counter: AC-0 is a hard gate — measure full vs open-only first; STOP if the delta isn't the cost.
- **T-PCS-B — «skip-closed leaks into the dedup caller»:** implement skip-closed inside `dup-detect`'s default path → silently breaks Caller B (§2.5 standalone dedup needs closed umbrellas to detect overlap with merged work). Counter: AC-3 — fix orchestration-side or behind an opt-in flag Caller B never sets.

> Blanket «see ai-laziness-traps.md» without the enumeration + domain traps above would itself be a T7 violation. Enumeration done above.

---

## §6 Recursive self-application

This kickoff was authored to scope a fix to the `/pipeline` skill's own helpers and must itself pass `principle 12` (AI-laziness-traps citation/enumeration) — it carries §5 above. The fix's AC-2 paired-negative is the self-application guard (the optimisation must not regress the detection it optimises). Verify principle 12 before merge:

```bash
npx vitest run packages/core/principles/12-ai-laziness-traps.test.ts | tail -5
```

---

## §7 §1.7 self-reflexive note

- **Forward-check:** complies with [no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md) (deterministic bash + file checks, zero API calls — AC-4); [build-first-reuse-default.md §1](../../rules/build-first-reuse-default.md) (**REUSE** — the cheap closed-set is the already-shipped C3 `done.md` + C1 branch signals; no new capability, expected < 80 LOC → not a capability commit); [reviewer-discipline.md §2](../../rules/reviewer-discipline.md) (§2 fix-shape is a genuine fork → surfaced, not decided here).
- **Backward-check:** supersedes nothing. Extends the prior perf work (`precompute_deliverables` hoist, memory `feedback_aif_harvest_egress_gotchas` neighbour / PR #471 «hoist Signal-3 deliverable scan out of dup-detect») — that hoisted the umbrella-invariant cost; this skips the per-umbrella cost for already-closed umbrellas. The two are orthogonal layers of the same bottleneck.

---

## §8 Stop conditions

- AC-0 measurement shows the closed-umbrella scan is NOT the dominant cost → STOP, re-scope as micro-R, surface to maintainer.
- AC-2 paired-negative cannot be made to pass without weakening DONE-detection → STOP, surface (correctness > speed).
- Any temptation to edit `~/.claude/skills/orchestrator/` (global, agent-uncommittable) → STOP.

---

## §9 Dispatch note (staging-placement discipline)

Per [.claude/rules/kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md): this kickoff must be **merged to `staging`** before any `/pipeline pipeline-completion-scan-skip-closed` dispatch — a dispatch session runs on `staging` and cannot see a kickoff that lives only on this feature branch. Sequence: author (this PR) → squash-merge to staging → only then dispatch.

---

## §10 See also

- [`helpers/priority-score.sh`](../../skills/pipeline/helpers/priority-score.sh) — completion classifier (C1/C2/C3) + the `dup-detect --all` pre-fetch.
- [`helpers/dup-detect.sh`](../../skills/pipeline/helpers/dup-detect.sh) — the expensive per-umbrella scan; the dual-caller surface.
- [`.claude/skills/pipeline/SKILL.md §2 / §2.5`](../../skills/pipeline/SKILL.md) — the two callers (completion-filter vs standalone dedup).
- [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md) · [reviewer-discipline.md §2](../../rules/reviewer-discipline.md) · [no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md) · [build-first-reuse-default.md](../../rules/build-first-reuse-default.md).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
