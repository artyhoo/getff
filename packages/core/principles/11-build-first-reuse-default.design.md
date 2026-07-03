# Principle 11 — build-first reuse-default — DESIGN SKETCH

> **Status:** IMPLEMENTED — see [11-build-first-reuse-default.test.ts](11-build-first-reuse-default.test.ts) (shipped 2026-05-17, atomic commit on branch feat/principle-11-bfr-default)
> **Companion rule:** [.claude/rules/build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md)
> **Slot note 2026-05-16:** originally drafted as principle 10; slot collision with existing `10-research-patch-annotation.test.ts` surfaced in pre-ship review → relocated to slot 11; cascade applied across 1A roadmap (ai-laziness-traps→12, phase-research-coverage→13)

## §1 What this test validates

**Invariant:** every shipped capability artifact has either a Prior-art SSOT entry with explicit BFR-verdict (one of seven from rule §1) OR a documented escape-hatch rationale in commit Prior-art trailer.

**Why this captures the rule:** [`.claude/rules/build-first-reuse-default.md`](../../../.claude/rules/build-first-reuse-default.md) §1 mandates that every capability resolves into one of seven verdicts (ADOPT / ADOPT-VOCABULARY / ADAPT / REFERENCE / KEEP-NARROW / BUILD / REJECT). The test mechanically verifies that no capability ships without verdict-recorded provenance.

**Distinct value vs existing layers (deduplication):**

- [`packages/core/principles/08-prior-art-cited.test.ts`](08-prior-art-cited.test.ts) — verifies that **research files** cite SSOT entries by ID. Scope: `docs/meta-factory/phase-*-research.md`. Does NOT enforce verdict semantics or check capability artifacts directly.
- [`.husky/pre-push`](../../../.husky/pre-push) capability-commit gate — verifies that **each capability commit** carries a Prior-art trailer at push time. Scope: in-flight commit. Does NOT check aggregate state.
- **Principle 11 (this design):** verifies that every **capability artifact already in repo** has a BFR-verdict-bearing SSOT entry OR a non-placeholder Prior-art trailer in its introducing commit. Scope: aggregate state, audits drift across many commits. Catches the failure mode where commit-time hook + research-time principle 08 both passed individually but the **composition** drifted (e.g. trailer rationale is «refactor only» but the commit actually added 90 LOC of new capability).

## §2 What counts as «capability» (mechanically detectable)

A file qualifies as a capability artifact if it matches ANY:

- `packages/core/<subdir>/*.ts` with file size ≥50 LOC where `<subdir>` is new since rule introduction date
- `packages/<other-pkg>/**/*.ts` with file size ≥80 LOC AND not under `__tests__` or `.test.ts` / `.spec.ts`
- `.claude/rules/*.md` (any new rule)
- `.claude/skills/<skill-name>/SKILL.md` (any new skill primary doc)
- `agents/*.md` (any new sub-agent prompt)
- new explicit `package.json` dependency (a dependency key on an added `+` line with no matching removed `-` line, semver-prefix forms `^ ~ >= <= = *`)

This list mirrors the existing capability-detection in `packages/core/hooks/checks/prior-art.ts` (invoked by `.husky/pre-push`; intentionally consistent to avoid two competing definitions).

## §3 Match criterion (file → SSOT entry)

For each capability artifact, the test searches `docs/meta-factory/prior-art-evaluations.md` for:

- **Strong match:** SSOT entry has explicit cite of the artifact's path (e.g. `.claude/rules/build-first-reuse-default.md` mentioned verbatim in SSOT body)
- **Heuristic match:** SSOT entry mentions the artifact's domain-keyword (e.g. SSOT entry «Capability: skill orchestration» matches `.claude/skills/orchestrator/SKILL.md`)

If neither match, the test then looks for an **escape-hatch in the artifact's introducing commit message** — a `Prior-art:` trailer with non-skipped rationale.

## §4 Failure modes

The test fails when:

- **F1.** Capability artifact has neither SSOT entry nor Prior-art trailer
- **F2.** SSOT entry exists but lacks an explicit verdict from §1 of the rule
- **F3.** Prior-art trailer exists but rationale is <20 characters or matches placeholder patterns («TODO», «later», «skipped — refactor only» with no actual refactor scope)

## §5 Open design questions

**Q1 — Handling pre-existing capabilities (created before rule introduction date)?**

Options:

- (a) **Grandfather** — test scans only files newer than rule introduction commit date; pre-existing capabilities exempt
- (b) **Retroactive coverage** — pre-existing capabilities require backfill SSOT entries with «retroactive» marker before test ships
- (c) **Hybrid** — grandfather but with a public list of «retroactive-coverage backlog» that audits over 6 months

Recommended: **(a) grandfather** — pragmatic; aligns with maintainer-individual project scale; avoids 30+ retroactive entries holding up the test landing.

**Q2 — How does the test integrate with the existing pre-push hook?**

The hook already enforces Prior-art trailer presence on capability commits. The principle test is a *complementary* check that runs in CI:

- Pre-push hook: catches commit-time absence of trailer (HOT, fail-fast)
- Principle 11 test: catches *aggregate state* drift — what if trailer was present but rationale was placeholder, or what if file was added under a non-commit-detectable path?

**Q3 — When does the test run?**

- (a) On every `npm test` invocation (highest signal, highest noise — slow because requires file enumeration)
- (b) Only when a capability file changes in the PR diff (medium signal, scoped)
- (c) Nightly full sweep + per-PR change-scoped (matches Stryker incremental pattern)

Recommended (REVISED per [research-patches/2026-05-16-principle-11-q1q5-evidence.md §2.3](../../../docs/meta-factory/research-patches/2026-05-16-principle-11-q1q5-evidence.md)): **(a) On every `npm test` invocation** — aligns with all 10 existing principle tests (01-10), which run on every test invocation. Original Q3 recommendation (option c, nightly + per-PR scoped) was CONTRADICTED by evidence probes:

- **No nightly CI infrastructure exists** in this repo — zero `schedule:` triggers in `.github/workflows/*.yml`
- **No Stryker incremental pattern** in the config our CI uses (`packages/core/stryker.config.mjs` has no `incremental: true`)
- `templates/ts-server/stryker.config.json:38` ships `incremental: true` for **consumer projects**, not for our own discipline rollout

Performance budget per Q4 below confirms (a) viable at current scale (~43 capabilities = sub-second).

**Q4 — Performance budget?**

Test enumerates capability files + reads SSOT + reads each capability's introducing commit. For ~50 capabilities (current state — empirically 43 per [Track 5 §2.1](../../../docs/meta-factory/research-patches/2026-05-16-principle-11-q1q5-evidence.md)) — expected ~1-2 sec. For 500+ — needs caching layer. **Reach out to maintainer when capability count crosses 150** (early warning before 200 hard threshold).

**Q5 — Should the test produce «warning» or «failure» on first-rollout?**

Recommended (REVISED per [research-patches/2026-05-16-principle-11-q1q5-evidence.md §2.5](../../../docs/meta-factory/research-patches/2026-05-16-principle-11-q1q5-evidence.md)): **hard-fail from day one.** Aligns with principles 08, 09 precedent (companion principle tests for `prior-art-cited` and `doc-authority-hierarchy` both shipped as hard-fail, no grace period). Grandfather mechanism (Q1) already exempts pre-rule-introduction files cleanly — no false positives at ship time. Reduces operational complexity (no time-aware logic in test code).

Original Q5 recommendation (2-week warning → hard fail) was based on assumed `phase-research-coverage.md` rollout pattern; evidence shows that rule rolled out via continuous iterative refinement, NOT phased warning-then-fail. Sibling principle tests are the closer precedent for ship discipline.

If maintainer prefers safety: 2-week warning acceptable, but document tradeoff in commit message body.

## §6 Implementation outline (TypeScript scaffolding)

```typescript
// packages/core/principles/11-build-first-reuse-default.test.ts
// NOT YET IMPLEMENTED — design sketch only (markdown design doc above)

import { describe, it, expect } from 'vitest';
// import { enumerateCapabilityFiles, readSSOT, readCommitTrailer } from utils;

describe('Principle 11: build-first reuse-default', () => {
  // F1: Every capability artifact has SSOT entry OR Prior-art trailer
  it('rejects capability artifacts with no provenance evidence', async () => {
    // Pseudo-code:
    // 1. enumerate capability files matching §2 list
    // 2. filter to post-rule-introduction-date (Q1 grandfather)
    // 3. for each file:
    //    a. check SSOT for strong/heuristic match (§3)
    //    b. if no SSOT match, check git log for Prior-art trailer with non-placeholder rationale (§4 F3 rules)
    //    c. fail if neither present
  });

  // F2: SSOT entries have explicit verdicts
  it('rejects SSOT entries lacking verdict field', () => {
    // 1. parse SSOT entries
    // 2. for each entry, check verdict matches one of seven rule §1 verdicts
    // 3. fail if entry has no verdict OR verdict not in allowed set
  });

  // F3: Prior-art trailer rationale ≥20 chars and non-placeholder
  it('rejects placeholder Prior-art trailers', () => {
    // 1. for each capability commit (via git log)
    // 2. extract Prior-art trailer
    // 3. verify rationale >=20 chars
    // 4. fail on patterns: 'TODO', 'later', 'skipped' without follow-up scope
  });
});
```

## §7 Self-application check

Did this design sketch itself follow rule §1 + §3 mechanism?

- ✅ **Upstream survey for «macro-scope discipline principle tests»:** DeepWiki probes 2026-05-13 confirmed no upstream candidate at this granularity.
- ✅ **Verdict for principle test 11 itself:** BUILD — confirmed gap; no upstream candidate exists. Documented in this sketch + research-patch §3.
- ✅ **Self-application of test:** principle 11 will eventually catch principle 11's own «is this build-first-reuse-default test correctly documented in SSOT?» — recursive check requires SSOT entry for principle test ITSELF when shipped.
- ✅ **Slot collision corrected:** pre-ship review 2026-05-16 caught the slot-10 conflict; design sketch now correctly numbered 11.

## §8 See also

- [.claude/rules/build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md) — companion prose rule
- [.husky/pre-push](../../../.husky/pre-push) — predecessor commit-time gate (Prior-art trailer enforcement)
- [docs/meta-factory/prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md) — SSOT register
- [08-prior-art-cited.test.ts](08-prior-art-cited.test.ts) — sibling principle test for research-files SSOT citation
- [docs/meta-factory/research-patches/2026-05-16-1a-drafts-substantive-review.md](../../../docs/meta-factory/research-patches/2026-05-16-1a-drafts-substantive-review.md) — pre-ship review documenting slot reassignment
