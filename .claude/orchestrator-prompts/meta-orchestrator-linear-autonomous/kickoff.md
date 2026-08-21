# KICKOFF — F.3 audit-and-fix umbrella (PR #205 actual vs G binding spec)

> **Type:** audit-and-fix umbrella. Stage 1 = per-item delta audit (Mode A inline, $0); Stage 2 = follow-up PRs fixing each delta (one PR per delta, scoped). Zero-deltas exit = umbrella closes with audit doc as evidence.
> **Origin:** maintainer rescope 2026-05-25 после обнаружения что PR #205 (merged 2026-05-24T21:08:36Z, squash, title «feat(meta-orchestrator): F.3 — UX implementation per G §1.5 12 items») шипнул эти 13 items раньше; этот kickoff был начат в неведении (drafted before discovering #205). Stale implementation version обнаружена → rescope в audit вместо abandon. Maintainer rationale: «мне нужно всё что там [в kickoff'е] сделано» — G binding spec остаётся source-of-truth; #205 = current shipment; дельты идут в follow-up PR'ы.
> **Deliverable:** (1) per-item delta report at [`docs/meta-factory/research-patches/2026-05-25-linear-autonomous-audit.md`](../../../docs/meta-factory/research-patches/2026-05-25-linear-autonomous-audit.md) covering all 13 items (item × spec × actual × delta); (2) follow-up PR(s) fix'ящие каждую обнаруженную дельту, OR documented acceptance rationale per accepted variation. Audit doc is the binding evidence for the umbrella's closure regardless of fix outcome.
> **Base branch:** staging.
> **Authoritative for:** F.3 audit-and-fix umbrella scope, the 13-item binding spec for comparison (§1), the 2-stage methodology (§2), AI-trap inventory active for this umbrella (§3), recursive-self-application rationale (§4).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). G binding spec source-of-truth — see [`docs/meta-factory/research-patches/2026-05-24-meta-orchestrator-refactor-f3-scope.md`](../../../docs/meta-factory/research-patches/2026-05-24-meta-orchestrator-refactor-f3-scope.md) §1.5. AI-laziness trap catalogue — see [`.claude/rules/ai-laziness-traps.md §2`](../../../.claude/rules/ai-laziness-traps.md).

---

## §0 Cold-start verification (BEFORE any audit work)

Per [`feedback_git_fetch_staging_before_drafting`](../../../../../.claude/projects/-Users-art-code-rules-as-tests-aif/memory/feedback_git_fetch_staging_before_drafting.md) — verify the world state:

```bash
# 1. PR #205 is merged (the audit subject must actually exist on staging)
gh pr view 205 --json mergedAt,title
# expected: mergedAt = "2026-05-24T21:08:36Z", title starts with "feat(meta-orchestrator): F.3"

# 2. This kickoff exists on disk (sanity — you are reading it)
ls -la .claude/orchestrator-prompts/meta-orchestrator-linear-autonomous/kickoff.md

# 3. Git tree clean (no in-flight WIP that would contaminate the audit)
git fetch origin staging
git status --short          # expect: clean OR ?? .claude/worktrees/ only
git log --oneline -5        # F.3 squash commit (or its merge) reachable

# 4. Worktree off origin/staging (parallel-subwave-isolation.md §1 — if dispatching Worker)
# Stage 1 (audit) is Mode A inline — no worktree needed. Stage 2 (fix PRs) — one worktree per delta.
```

If reproduction fails (e.g. #205 unmerged, or staging tree dirty) → halt and report. Do NOT begin Stage 1 against an inconsistent reference.

---

## §1 Scope — binding spec for comparison (13 items, verbatim from G §1.5 + principle 18)

The audit (Stage 1) compares each row's **Spec** column against the **actual code on staging post-#205**. Cell content here is the binding requirement; #205's actual content is the comparison subject.

| # | Item ID | File / Surface | Spec (binding) |
|---|---|---|---|
| 1 | M1 — dispatch table «R-phase, single» | `.claude/skills/meta-orchestrator/SKILL.md` §5 | Row «R-phase, single» MUST route to **Mode A inline** (was Queue mode pre-F.3). Worker bias rationale per G §1.5 Item 1. |
| 2 | D3-MAJOR — disable-model-invocation misattribution | `.claude/skills/meta-orchestrator/SKILL.md` §0 | `disable-model-invocation` MUST be described as an **auto-load suppressor**, not a depth/recursion guard. Same correction in any companion doc that references the flag. |
| 3 | M2 — plain-language-tail «injects» terminology | `.claude/skills/meta-orchestrator/references/plain-language-tail.md` | Word «injects» (mechanism-vague) MUST be replaced with «**enforces presence via Stop hook `decision:block`**» (mechanism-specific). |
| 4 | m1 — MINOR dispatch-table missing row | `.claude/skills/meta-orchestrator/SKILL.md` §5 | Add row «**R-phase, multiple sequential → Queue mode**» (gap noted in G §1.5 Item 4). |
| 5 | m2 — MINOR stage-gate hardcoded date | `.claude/skills/meta-orchestrator/SKILL.md` §6 | Remove hardcoded filter `created:>=2026-05-23` (or its equivalent); the stage-gate must not pin to a calendar date. |
| 6 | m3 — MINOR blank line before See also | `.claude/skills/meta-orchestrator/SKILL.md` | Single blank line immediately before `## See also` heading (markdownlint MD022). |
| 7 | F3-S1 — antipatterns in §5 | `.claude/skills/meta-orchestrator/SKILL.md` §5 | Add antipattern entries `#worker-dispatch-via-subagent` AND `#commit-on-behalf-of-worker` (both, named verbatim). |
| 8 | F3-S2 — 3-layer §10 output spec | `.claude/skills/meta-orchestrator/SKILL.md` §10 | §10 Output artifacts MUST describe a **3-layer structure**: Dep graph + Action queue + 1-liner blocks. SKILL.md must remain ≤ 500 lines (G §1.5 Item 8 «substructure header» variant accepted per D-G-2 if 3 layers are conveyed). |
| 9 | F3-S3 — new references/output-format.md | `.claude/skills/meta-orchestrator/references/output-format.md` (NEW FILE) | File created. Contains: grammar + 4 worked examples + ASCII templates + anti-patterns. Carries Authoritative-for header per [`doc-authority-hierarchy.md §3`](../../../.claude/rules/doc-authority-hierarchy.md). |
| 10 | Gap-1 — launch-table-generator `detect_subwaves()` | `.claude/skills/meta-orchestrator/helpers/launch-table-generator.sh` + consumer mirror | Regex MUST NOT misclassify dispatch-table rows as sub-waves. **G §1.5 Falsifier** required smoke-test on **3 distinct kickoffs** (meta-orchestrator-followup-audit + mutation-discipline-umbrella + «wave-X synthetic»). Mechanism choice (Option A keyword filter vs Option B section-scoped vs B5 hybrid) is open — Falsifier passing on 3+ kickoffs is the binding criterion. |
| 11 | §1 Step 2 — REPORT reconciliation | `.claude/skills/meta-orchestrator/SKILL.md` §1 | Add explicit REPORT reconciliation clause (Worker REPORT vs orchestrator's own verification step before claiming sub-wave done). |
| 12 | Mirror sync obligation (cross-cutting) | `skills/meta-orchestrator/**` (consumer mirror) | Every item 1-11 propagated to consumer mirror. Helpers byte-identical (`diff -u` returns 0). SKILL.md mirror may carry condensed §10 per G §1.5 Item 12 escape-hatch. |
| 13 | Principle 18 — structural test | `packages/core/principles/18-meta-orchestrator-output-format.test.ts` (NEW) | Substring + paired-negative test over SKILL.md §10 across both surfaces (authoring + mirror). REFERENCE from principle 12 precedent (`packages/core/principles/12-ai-laziness-traps.test.ts`); no new BUILD without prior-art cite. |

This table is the binding spec. Stage 1 audit produces one row per item: **Item × Spec (above) × Actual on staging × Delta (yes/no/nature/file:line)**.

---

## §2 Two-stage methodology

### Stage 1 — Per-item audit (Mode A inline, ~1-2h, $0)

For EACH of the 13 items in §1:

1. **Re-read the Spec column** in §1 above (verbatim binding requirement).
2. **Fetch actual state on staging:** `gh pr diff 205 -- <file>` to see what #205 changed, PLUS `cat`/`Read` the file's current state on staging (#205 may have been amended by intervening PRs).
3. **Compare and record** in the audit doc: a single row per item with these columns:
   - **Item** (e.g. «10 — Gap-1»)
   - **Spec** (one-line binding requirement)
   - **Actual** (what's on staging right now, with file:line citation)
   - **Delta** (yes/no; if yes: nature of the gap, file:line evidence)
   - **Verdict** (CLEAN / DELTA-FIX-NEEDED / DELTA-ACCEPTED-VARIATION with rationale)

**Known delta seed (do NOT assume only this one exists):** D-G-1 Item 10 — PR #205 shipped Option A keyword filter; G §1.5 strikes Option B section-scoped as the design. Both pass the Falsifier on the kickoffs #205 author smoke-tested; the question for Stage 1 is whether Option A passes the Falsifier on a 3rd kickoff (which G §1.5 mandated). Other items may surface additional deltas — audit ALL 13.

**Audit doc location:** [`docs/meta-factory/research-patches/2026-05-25-linear-autonomous-audit.md`](../../../docs/meta-factory/research-patches/2026-05-25-linear-autonomous-audit.md). Doc inherits folder-level Authoritative-for header from `docs/meta-factory/research-patches/README.md` per [`doc-authority-hierarchy.md §5`](../../../.claude/rules/doc-authority-hierarchy.md).

**Stage 1 gate:** audit doc exists, 13 rows filled, each DELTA-FIX-NEEDED row carries file:line evidence (T3). Maintainer reviews and authorises Stage 2 dispatches.

### Stage 2 — Fix deltas (per-delta follow-up PRs)

Each DELTA-FIX-NEEDED row becomes a small follow-up PR. Scope rules:

- **One delta = one PR.** No bundling unrelated deltas (atomic-PR discipline per [CLAUDE.md «PR strategy»](../../../CLAUDE.md)).
- **PR body MUST contain** §1.7 Forward-check section per [`phase-research-coverage.md §1.7`](../../../.claude/rules/phase-research-coverage.md), citing why the G spec wins (or, for DELTA-ACCEPTED-VARIATION promoted to PR for documentation only, why #205 actual is acceptable).
- **Each PR carries a `See: research-patches/2026-05-25-linear-autonomous-audit.md#item-N`** trailer or in-body link.
- **Mirror sync** preserved per Item 12 — if a fix touches authoring, the consumer mirror is updated in the same PR.
- **Smoke-test evidence** in PR body — never «verified locally» (T3).

**Zero-deltas exit:** if Stage 1 reports 13 CLEAN rows (no DELTA-FIX-NEEDED), Stage 2 is dropped. The audit doc is the umbrella's deliverable; umbrella closes with a memory entry «#205 матчил G §1.5 spec verbatim — dogfood evidence that L3 dup-detect will catch future spec-vs-shipment drift on real data».

**Dramatic-regression escalation:** if any item is shipped «opposite» to spec (e.g. an explicit negation, not a stylistic delta) — halt Stage 2 dispatch, escalate to maintainer before opening any fix PR.

---

## §3 AI-laziness traps active (per [`ai-laziness-traps.md §2-§3`](../../../.claude/rules/ai-laziness-traps.md))

This umbrella enumerates per the §3 obligation; blanket reference would itself be T7 + `#trap-catalogue-blanket-reference`.

- **T3 (plausible-without-verification)** — Stage 1 audit rows must carry file:line evidence per Actual + Delta columns, not prose «I think items 1-12 match the spec». Every CLEAN verdict equally needs a citation (CLEAN ≠ no audit; CLEAN = audited and matched).
- **T13 (trust-ADOPTED-without-confirming-evidence)** — do NOT use PR #205 body's «What changed» summary as the audit's ground truth. The PR body claims what the author intended to ship; Stage 1 must verify what actually landed on staging. Read the code, not the cover letter.
- **T14 (clean-audit-with-low-coverage ≠ category-clean)** — if Stage 1 audits only 8 of 13 items and reports 8 CLEAN, the verdict is «coverage insufficient», not «13 items CLEAN». §2 Stage 1 gate requires all 13 rows filled.
- **T15 (self-application)** — this umbrella audits a prior shipment. Self-application: the umbrella's own audit doc is itself a discipline-bearing artefact and MUST carry an Authoritative-for header (inherited via §5 folder pattern) per [`doc-authority-hierarchy.md §2`](../../../.claude/rules/doc-authority-hierarchy.md).
- **T16 (problem-class-match for acceptance)** — when verdict-ing an item as DELTA-ACCEPTED-VARIATION (rather than DELTA-FIX-NEEDED), the rationale MUST address whether the problem-class the G spec solved is still solved by #205's variant. Example: D-G-1 Item 10 — does Option A's keyword filter handle the SAME 3-kickoff Falsifier class as Option B section-scoped would have? Audit must answer with evidence, not «it looks fine».
- **T19 (own QA before handoff)** — orchestrator runs an own cold-review of the Stage 1 audit doc before declaring it ready for maintainer Stage 2 authorisation; CI does not check audit substance.
- **Domain-specific T-F3-AF-A — «spec-side-is-binding even when shipment is plausible»** — temptation: declare an item CLEAN because #205's shipment «achieves the same goal» as the spec. Counter: spec is binding (maintainer reaffirmed 2026-05-25). If shipment differs from spec, the row is DELTA-FIX-NEEDED or DELTA-ACCEPTED-VARIATION with explicit maintainer-visible rationale — never silently mapped to CLEAN.

---

## §4 Recursive self-application

This audit's findings double as **real-world test data for the L3 dup-detect mechanism** planned in the planner-completeness umbrella (Stage 5.A). Synthetic test data is one falsification surface; an audit of an actually-shipped umbrella against its binding spec is another. If L3 dup-detect later ships and replays this exact comparison, it MUST surface the same deltas this audit surfaces (or strictly more — never fewer, given equal input). This is the dogfood gate: «L3 catches real drift, not just toy fixtures».

The umbrella also self-applies the audit-discipline to itself: this kickoff is being rewritten from a stale «implement F.3» framing into an «audit-and-fix» framing precisely because the same drift the audit looks for (kickoff stating one thing, reality being another) had happened to this kickoff. Codifying the discipline does not exempt its author.

---

## §5 §1.7 forward-check applied

- Complies with [`no-paid-llm-in-ci.md §1`](../../../.claude/rules/no-paid-llm-in-ci.md) — Stage 1 audit is deterministic `gh pr diff` + file Read + manual comparison; no API-billed LLM call in any audit or CI step.
- Complies with [`build-first-reuse-default.md §1`](../../../.claude/rules/build-first-reuse-default.md) — this rescope is **ADOPT** of the existing kickoff (and the G binding spec) as the audit anchor; REUSE not BUILD. No new methodology is invented — `gh pr diff` + per-item compare is the canonical audit shape established by [`channel-earliness-audit`](../../../../.claude/projects/-Users-art-code-rules-as-tests-aif/memory/project_channel_earliness_audit.md) and [`memory_coverage_audit`](../../../../.claude/projects/-Users-art-code-rules-as-tests-aif/memory/project_memory_coverage_audit_kickoff.md) precedents.
- Complies with [`reviewer-discipline.md §2`](../../../.claude/rules/reviewer-discipline.md) — Stage 2 fix decisions per delta surface as DECISION-NEEDED for maintainer (Option Fix vs Option Accept-Variation), not auto-resolved by the audit. Reviewer/orchestrator role separation preserved.
- Complies with [`doc-authority-hierarchy.md §2-§3`](../../../.claude/rules/doc-authority-hierarchy.md) — audit doc carries (inherited) Authoritative-for header via folder-level pattern; this kickoff carries explicit Authoritative-for header above.
- Complies with [`parallel-subwave-isolation.md §1`](../../../.claude/rules/parallel-subwave-isolation.md) — Stage 1 is Mode A inline (no parallel sessions); Stage 2 per-delta PRs each get their own worktree if dispatched in parallel.

**Backward-check applied:** this rescope SUPERSEDES the prior in-place rewrite of this kickoff (the «Item 10 narrow follow-up» framing). That earlier rewrite remains valid for Item 10 specifically — it becomes one of (potentially many) Stage 2 deltas, not the umbrella's whole scope. No other kickoff or rule is silently superseded by this rescope.

---

## §6 Stop conditions

- **F1 (zero-deltas):** Stage 1 audit reports 13/13 CLEAN. Stage 2 dropped. Umbrella closes with audit doc as evidence + a memory entry confirming #205 matched spec verbatim (dogfood data point for L3).
- **F2 (dramatic regression):** any item shipped opposite to spec (explicit negation, not stylistic delta) — halt Stage 2 dispatch, escalate to maintainer BEFORE opening any fix PR.
- **F3 (audit doc gate failure):** Stage 1 produces fewer than 13 rows, or any DELTA-FIX-NEEDED row lacks file:line evidence — orchestrator returns to Stage 1, does not advance to Stage 2.
- **F4 (CI red post-fix):** any Stage 2 PR pushes a fix that turns CI red on staging — fix or revert before next dispatch; do not stack red on red.

---

## §7 Done criteria

The umbrella is done when:

- Audit doc [`docs/meta-factory/research-patches/2026-05-25-linear-autonomous-audit.md`](../../../docs/meta-factory/research-patches/2026-05-25-linear-autonomous-audit.md) merged to staging with 13 item rows.
- Every DELTA-FIX-NEEDED row has either (a) a merged Stage 2 PR fixing it, OR (b) an explicit DELTA-ACCEPTED-VARIATION verdict with maintainer-acknowledged rationale.
- A closing memory entry summarises: «#205 audit complete: N CLEAN / M DELTA-FIX (shipped via PRs #X,Y,Z) / K DELTA-ACCEPTED (rationale in audit §)».
- If F1 applies: no PR needed; audit doc itself is the deliverable.

---

## §8 See also

- **PR being audited:** #205 (squash merged 2026-05-24T21:08:36Z, title «feat(meta-orchestrator): F.3 — UX implementation per G §1.5 12 items»)
- **G binding spec (source-of-truth for the 13 rows in §1):** [`docs/meta-factory/research-patches/2026-05-24-meta-orchestrator-refactor-f3-scope.md`](../../../docs/meta-factory/research-patches/2026-05-24-meta-orchestrator-refactor-f3-scope.md) §1.5 (Items 1-12) + principle 18 deliverable added alongside.
- **Audit doc (Stage 1 output, to be created):** [`docs/meta-factory/research-patches/2026-05-25-linear-autonomous-audit.md`](../../../docs/meta-factory/research-patches/2026-05-25-linear-autonomous-audit.md)
- **Planner-completeness umbrella (L3 dup-detect dogfood consumer of this audit):** Stage 5.A — when L3 ships, replay this 13-item comparison and verify it surfaces ≥ the deltas Stage 1 found.
- **Trap catalogue:** [`.claude/rules/ai-laziness-traps.md §2`](../../../.claude/rules/ai-laziness-traps.md) (T3/T13/T14/T15/T16/T19 active per §3 above + domain-specific T-F3-AF-A).
- **Audit-discipline precedents:** [`feedback_git_fetch_staging_before_drafting`](../../../../../.claude/projects/-Users-art-code-rules-as-tests-aif/memory/feedback_git_fetch_staging_before_drafting.md), [`project_channel_earliness_audit`](../../../../../.claude/projects/-Users-art-code-rules-as-tests-aif/memory/project_channel_earliness_audit.md), [`project_memory_coverage_audit_kickoff`](../../../../../.claude/projects/-Users-art-code-rules-as-tests-aif/memory/project_memory_coverage_audit_kickoff.md).
- **Falsifier-discipline reminder (Item 10 lesson):** [`phase-research-coverage.md §1.7`](../../../.claude/rules/phase-research-coverage.md) — Falsifier in binding spec MUST be operationalised as binding criterion in the implementing PR's checklist; otherwise it's prose-only that can be silently skipped (the exact failure mode the Item 10 delta documents).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
