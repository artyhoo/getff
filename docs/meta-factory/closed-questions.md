# Meta-Factory: Closed questions (archive)

> Source: archive split from `open-questions.md` (2026-05-12)
> Companion: [open-questions.md](open-questions.md) (armed/open registry)
>
> **Authoritative for:** archived §13.x entries that have reached terminal status (closed by Wave N / Phase N / etc.). Each entry retains its original §13.N anchor number for backward-link stability.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists). Currently-open questions live in [open-questions.md](open-questions.md).
>
> **Append-only:** entries migrate IN from open-questions on closure; they are not edited, deleted, or renumbered after archival. Status-transition notes may be appended in italic block-quotes.

---

## Closed entries TOC

| Entry | Status | Closed by |
|---|---|---|
| [§13.1 Granularity research, детально](#131-granularity-research-детально--closed-empirically-validated) | Closed | Phase 5/6 empirical validation (closure recorded 2026-05-13) |
| [§13.2 Маркетинг и наименование](#132-маркетинг-и-наименование--closed-wishful-pre-launch) | Closed | 2026-05-13 (wishful, pre-launch) |
| [§13.3 Granularity invariant core](#133-granularity-invariant-core--где-провести-границу) | Closed | Phase 3 empirical closure (2026-05-08) |
| [§13.21 Doc-authority discipline applied to generated user-facing docs](#1321-doc-authority-discipline-applied-to-generated-user-facing-docs-deferred-l3) | Closed | 2026-05-10 (Waves 1–4, PRs #21–#24) |
| [§13.23 Pre-push hook layer for §1.7](#1323-pre-push-hook-layer-for-17--closed-by-wave-7) | Closed | Wave 7 (2026-05-11) |
| [§13.25 Project-Aware Tool Bootstrapping](#1325-project-aware-tool-bootstrapping--closed-by-wave-5-2026-05-11) | Closed | Wave 5 (2026-05-11) |
| [§13.26 AI-doc effectiveness in cold-start context](#1326-ai-doc-effectiveness-in-cold-start-context-closed-2026-05-10) | Closed | 2026-05-10 |
| [§13.27 Functional test for shipped AI-briefing templates](#1327-functional-test-for-shipped-ai-briefing-templates--closed-by-wave-7) | Closed | Wave 7 (2026-05-10/11) |
| [§13.28 Operator-side discipline gap — non-git validation path](#1328-operator-side-discipline-gap--non-git-validation-path--closed-by-wave-7) | Closed | Wave 7 (2026-05-10/11) |
| [§13.29 Substantive compliance verification](#1329-substantive-compliance-verification-deferred--wave-8-research) | Closed | Wave 8 (2026-05-12) |
| [§13.36 TDD-for-Skills extension to .claude/skills/*/SKILL.md](#1336-tdd-for-skills-extension-to-claudeskillsskillmd--resolved-by-principle-15) | Closed | principle 15 / #112 (2026-05-21) |

---

## Archived entries

### 13.1 Granularity research, детально — closed (empirically validated)

**Status:** closed 2026-05-13 by D8 resolution (post-Wave-9 prioritisation session). Empirically validated by Phase 5/6 shipping at the hypothesized granularity.
**Origin:** PROPOSAL.md §13.1 (Phase 1.D split, 2026-05-07). Hypothesis: «один файл = один паттерн» on which one rule can be built — simplifies diff-mode (one file changes → one rule regenerated).

Как именно сегментировать паттерны в research? «Server Actions» — один паттерн или семь подпаттернов (return type, FormData, revalidatePath, error handling, ...)?

Гипотеза: иерархия в `research-cache.json`:
```text
next/16.2.1/
  app-router/
    server-actions/
      return-type.json
      form-data-validation.json
      revalidate-after-mutation.json
    server-components/
      data-fetching.json
      use-cache.json
  build/
    turbopack-vs-webpack.json
```

Granularity ≈ **один файл = один паттерн**, на котором можно построить **одно правило**. Это упрощает diff-режим (изменился один файл → перегенерировано одно правило).

#### Phase 5/6 empirical closure (2026-05-13)

**CLOSED — hypothesis VALIDATED.** Phase 5 (Layer 4 Validator) and Phase 6 (Layer 2 Research Agent) shipped at the hypothesized granularity. Evidence:

- `packages/core/research/store/` contains 9 production research files at **1-pattern-per-file** granularity (next/15.x: 1, next/16.x: 3, next/any: 3, shared: 2). No `server-actions/{return-type, form-data-validation, ...}` sub-pattern split observed; «Server Actions»-style hypothetical 7-sub-pattern explosion did NOT occur.
- [phase-5-research.md:80](phase-5-research.md#L80) explicitly designs `diffResearch(versionA, versionB)` at «pattern-level granularity matches 'one pattern → one rule' from §13.1».
- Trigger-sweep report 2026-05-08 ([research-patches/2026-05-08-trigger-sweep-report.md:22](research-patches/2026-05-08-trigger-sweep-report.md#L22)): «Hypothesis 'one pattern per file' holds; no Server-Actions-style 7-sub-pattern split observed.» Entry was tracked as «STILL ARMED» at the time — that was a tracking lag; the empirical evidence already supported closure.
- [retros/phase-8.8.1-coverage-discipline.md:58](retros/phase-8.8.1-coverage-discipline.md#L58) reaffirmed: «12 research-store files at 1-pattern-per-file granularity; no Server-Actions-style sub-pattern explosion.»

**Closure rationale:** the hypothesis is no longer «open» — it is the de-facto convention shipped by Phase 5 and Phase 6. Future research-store additions follow 1-pattern-per-file by convention. If a future framework genuinely surfaces a Server-Actions-style sub-pattern explosion that breaks the convention, that triggers a re-opening event recorded as a new §13.x entry — not a re-opening of this one.

---

### 13.2 Маркетинг и наименование — closed (wishful, pre-launch)

**Status:** closed 2026-05-13 by D8 resolution (post-Wave-9 prioritisation session). Archived as wishful with no formal trigger; pre-launch positioning concern with 0 consumers.
**Origin:** PROPOSAL.md §13.2 (Phase 1.D split, 2026-05-07).

«AI генерит твои правила» — половина людей не доверяет. Маркетинг должен быть про **self-validating rule generator** с акцентом на validator, не на LLM.

Возможные названия:
- `meta-factory` — про генерацию фабрик
- `rules-foundry` — про литьё правил
- `aif-stack-aware` — расширение AIF
- `rules-as-tests/core` + `rules-as-tests/cli` — продолжение текущего

#### 2026-05-13 archival rationale

Marketing / naming is a pre-launch positioning concern. Project has 0 consumers; consumer-facing materials (public README revision aimed at end-users vs maintainers, demo, launch announcement) are not on the critical path. Wishful-trigger pattern: armed indefinitely with no formal condition for revisit; surfaces cognitive overhead for AI sessions reading the registry, plus risk of premature firing.

**Re-opens naturally when** any of:
- Public-facing material is drafted (consumer-aimed README revision, demo, launch announcement).
- Project name change is proposed as a structural decision (e.g. package rename in registry).
- Third-party material discovers the project under the current name and surfaces naming friction.

When any of the above happens, a new §13.x entry should be opened reflecting then-current state, rather than re-opening this entry — the candidate name list above is a 2026-05-07 snapshot and may not reflect updated positioning thinking by re-open time.

---

### 13.3 Granularity invariant core — где провести границу

R1 (no `as any`) — invariant. R8 (OTel spans) — generated. Где граница?

Гипотеза: правило — invariant если:
- Не зависит от стэка (works on any TS code)
- Защищает фундаментальное свойство языка (типобезопасность, async correctness)
- Не имеет version-specific edge cases

Generated если:
- Завязано на конкретный фреймворк
- Зависит от версии (изменения в API)
- Apply-to пути зависят от структуры проекта

Это **рабочая гипотеза**, нужно валидировать на реальных правилах.

#### Phase 2 empirical update (2026-05-07)

Phase 2 показала: meta-tests **uniformly applicable** ко всем 26 правилам manifest (R1-R20 + IR1-IR6) на manifest level — независимо от классификации invariant/generated. Composite pass rate 100% (26/26 на applicable principles).

**Что Phase 2 НЕ показала:** где конкретно проходит граница invariant ↔ generated. Это финально валидируется только в Phase 3 (monorepo split), когда правила физически разделятся на `packages/core/` (invariant) vs `packages/preset-*/` (generated) и каждый пакет должен пройти standalone test runs (per EXECUTION-PLAN §6 Phase 3 verification).

**Status:** partial closure — manifest-level uniformity подтверждена; physical boundary refinement deferred to Phase 3 retro.

#### Phase 3 empirical closure (2026-05-08)

**CLOSED.** Manifest field `stack` = authoritative invariant marker. Hypothesis validated empirically через Gate 3 ESLint rule allocation (Phase 3 monorepo split):

- `stack: ["ts-server", "react-next"]` (universal) → `packages/core/` (invariant) — 3 rules: R7, R2, R8
- `stack: ["react-next"]` (specific) → `packages/preset-next-15-canonical/` (generated) — 3 rules: R12, R14, R20

Gate 3 allocation matched `stack` field 1:1 без exceptions. Zero hard-to-classify files (REVISE trigger did not fire). Physical split complete: `packages/core/` tests 65/65 pass standalone; `packages/preset-next-15-canonical/` tests 38/38 pass standalone.

**Invariant boundary rule (validated):** rule is invariant IFF `stack` field contains both `["ts-server", "react-next"]`; rule is stack-specific IFF `stack` is a strict subset. This is now the SSOT for future rule classification decisions (Phase 5+).

---

### 13.21 Doc-authority discipline applied to generated user-facing docs (deferred L3)

**Status:** closed 2026-05-10 by [research-patches/2026-05-09-§13.21-l3-revision.md](research-patches/2026-05-09-§13.21-l3-revision.md) — Wave 1 (PR #21) + Wave 2 (PR #22) + Wave 3 (PR #23) + Wave 4 (PR #24) all merged on `main`. Original L1 + L2 in-branch context preserved in the revision plan.
**Origin:** L1 of the goal-hierarchy follow-up shipped `.claude/rules/doc-authority-hierarchy.md` (rule) + `packages/core/principles/09-doc-authority-hierarchy.test.ts` (executable principle). L2 audited all project-internal docs and added Authoritative-for headers to 30 canonical authority-bearing docs. **L3** — applying the same discipline to docs the framework GENERATES for consumer projects — is feature work, not docs-restructure.

**Why deferred:** L3 requires changes across multiple shipped surfaces:
- `templates/shared/AGENTS.md.template` and stack-specific templates under `templates/{ts-server,react-next}/`
- `.ai-factory/` shipped sub-agent prompts (`best-practices-sidecar.md`, `review-sidecar.md`, `docs-auditor.md`)
- Generated artifacts in consumer projects: `RULES.md`, `CLAUDE.md`, `AGENTS.md`, `DESCRIPTION.template.md`, `ARCHITECTURE.*.md`
- `install.sh` step 5 (husky setup) and step 6 (npm-script injection) — extend to write `> **Authoritative for:**` headers into consumer-facing files
- Possibly: `synthesizer/emit.ts` to inject Authoritative-for in generated `RULES.md`

This is feature scope (Phase 9.x or 10.x), not goal-hierarchy fix. Shipping L3 in this branch would conflate documentation discipline (L1 + L2) with installer feature work (L3) — bad atomicity.

**Trigger condition for revisit:** any of —
- A real consumer adopts the framework via `install.sh` AND reports doc-authority drift in their consumer project (i.e. their AI agents read EXECUTION-PLAN-equivalent file as goal source).
- Framework starts generating consumer-facing AI docs programmatically (currently most are static templates copied verbatim — programmatic generation is L3 Synthesizer evolution, Phase 9+).
- Phase 9.x or 10.x feature work explicitly targets template enhancement / installer evolution.

**Promotion path when triggered:**
1. Audit all `templates/` files; add `> **Authoritative for:**` headers per the rule §3 format. Where the template will be filled with project-specific content (e.g. `DESCRIPTION.template.md`), the header points to consumer's `README.md` (not framework's).
2. Audit `.ai-factory/` sub-agent prompts; add headers declaring sub-agent scope (e.g. `> **Authoritative for:** best-practices validation against consumer's `RULES.md`; NOT authoritative for project goal — consumer's own `README.md` owns it`).
3. Update `install.sh` to verify headers in shipped artifacts pre-install (sanity check) AND inject consumer-pointing headers into generated files.
4. Extend `principles/09-doc-authority-hierarchy.test.ts` canonical list with template/`.ai-factory/` files; CI gate flips from project-internal-only to project-internal + shipped-artifact verification.
5. Document the consumer-side convention in `INSTALL-FOR-AI.md` so AI agents installing the framework understand that consumer's `README.md` is the goal source for the consumer project.

**Cross-references:** [.claude/rules/doc-authority-hierarchy.md §2](../../.claude/rules/doc-authority-hierarchy.md) «Not required for: generated user-facing docs» exemption; [packages/core/principles/09-doc-authority-hierarchy.test.ts](../../packages/core/principles/09-doc-authority-hierarchy.test.ts) canonical list (will widen at L3 trigger); [README.md](../../README.md) §«What gets installed automatically» enumerates shipped surfaces.

---

### 13.23 Pre-push hook layer for §1.7 — closed by Wave 7

**Status:** closed 2026-05-11. `.husky/pre-push` section 9 (`s17_check_trailer()`, commit `8982fde`); warn-only calibration 2026-05-11→2026-06-10. _Deferred 2026-05-09 per `2f00e76`._
**Origin:** [`.claude/rules/phase-research-coverage.md §1.7`](../../.claude/rules/phase-research-coverage.md) introduced 4-layer enforcement ladder for `#recommendation-skips-own-discipline`: (1) process rule, (2) [`.claude/skills/self-reflection/`](../../.claude/skills/self-reflection/SKILL.md) assistant-side trigger, (3) [`.github/workflows/discipline-self-check.yml`](../../.github/workflows/discipline-self-check.yml) build-side PR-description gate, (4) `.husky/pre-push` per-commit trailer check. Layers 1-3 ship in branch `process/recommendation-self-discipline`; layer 4 deferred — see «Why deferred».

**Why deferred:** per-commit `Forward-check`/`Backward-check` trailer enforcement is a non-trivial design problem unresolved at bootstrap:

- *Scope predicate.* Not every commit on a branch with rule changes is itself rule-introducing (refactor commits, typo fixes, dependency-update commits inherit the file-glob match). Need a way to distinguish «this commit introduces/extends a rule» from «this commit happens to live on a branch that introduces a rule».
- *Bootstrap chicken-and-egg.* Push range is `<upstream>..HEAD`. The very commit that adds the hook is in that range. Without retroactive amend (forbidden by orchestrator no-amend convention) or explicit bootstrap exemption marker, hook fails on its own introduction commit.
- *Trailer-format interaction.* Existing `Prior-art:` trailer enforced by current pre-push for capability commits. New `§1.7 Forward-check applied:` / `§1.7 Backward-check applied:` trailers — separate stanzas or merged with `Prior-art:`? Order matters for parser; both options have downsides.
- *Discipline-theatre risk.* Without a clean scope predicate the hook is either over-strict (false positives blocking legitimate refactors that touch rule files) or trivially bypassable (loose enough to be theatre). Either failure mode is worse than not having the layer.

3-layer ladder (rule + skill + CI workflow) ships now. The unprotected path is **direct push to remote feature branch without PR** — local push bypasses CI workflow's `discipline-self-check.yml`. This is the documented gap.

**Trigger condition for revisit:** any of —

- A 3rd documented case-study of `#recommendation-skips-own-discipline` originating from the local-push-without-PR gap (i.e., a discipline-bearing change reached `main` without going through the workflow gate).
- Per-commit trailer enforcement design proposal materialises in a separate research session (e.g. mirrors [Conventional Commits](https://www.conventionalcommits.org) + `commit-msg` hook patterns).
- Phase 10+ pre-push surface widening — if `.husky/pre-push` gains other §1.7-adjacent checks (e.g. `principle 09` extension to templates per [§13.21](closed-questions.md#1321-doc-authority-discipline-applied-to-generated-user-facing-docs-deferred-l3) closure), the hook scope already covers discipline files; adding §1.7 trailer check is incremental.

**Promotion path when triggered:**

1. Research session: per-commit §1.7 trailer format compatible with `Prior-art:` trailer; scope predicate for which commits require it; bootstrap exemption mechanism (e.g. first commit on a branch may introduce a new hook without retroactive trailer requirement).
2. Update [`.husky/pre-push`](../../.husky/pre-push) (≤50 LOC) with the new check; place after existing actionlint / zizmor / audit-ai-docs checks.
3. Update [`.claude/skills/self-reflection/SKILL.md`](../../.claude/skills/self-reflection/SKILL.md) ladder description to reflect 4-layer reality (currently documents 3 active layers + 1 deferred).
4. Self-review patch under [`research-patches/`](research-patches/) demonstrating pre-push hook catches the `local-push-bypasses-CI` failure mode.

**Cross-references:** [`.claude/rules/phase-research-coverage.md §1.7`](../../.claude/rules/phase-research-coverage.md) (rule); [`.claude/skills/self-reflection/SKILL.md`](../../.claude/skills/self-reflection/SKILL.md) (layer 2); [`.github/workflows/discipline-self-check.yml`](../../.github/workflows/discipline-self-check.yml) (layer 3); [`research-patches/2026-05-09-recommendation-skips-own-discipline.md`](research-patches/2026-05-09-recommendation-skips-own-discipline.md) (bootstrap exemplar).

---

### 13.25 Project-Aware Tool Bootstrapping — closed by Wave 5 (2026-05-11)

Closed 2026-05-11 by Wave 5 trio (PRs [#34](https://github.com/Yhooi2/rules-as-tests-aif/pull/34) / [#35](https://github.com/Yhooi2/rules-as-tests-aif/pull/35) / [#36](https://github.com/Yhooi2/rules-as-tests-aif/pull/36)). Four atomic commits: `b1e9c5e` — Wave 5.1: tool-bootstrapping skill (`.claude/skills/tool-bootstrapping/` + `skills/tool-bootstrapping/`) + decision-format references + principle 09 REQUIRED_HEADER_DOCS extension + install.sh ship block + SSOT #31-#37; `d496ff7` — Wave 5.2: setup.sh Step 2d — context7 baseline + `.ai-factory/tool-decisions.md` seed; `8758359` — Wave 5.3: deps-hash UserPromptSubmit hook + D4 audit probe + AGENTS.md.template bullet; `18d32c6` — Wave 5 follow-up: SHIPPED_DOCS sync + N3 stat-fallback comment.

**Open structural questions** (historical — resolved by Wave 5):

- **Layering**: where does this rule live? → Resolved: all three surfaces — skill (`.claude/skills/tool-bootstrapping/`), AGENTS.md.template bullet (Wave 5.3), audit probe D4 (Wave 5.3).
- **Memory persistence**: in-session vs file-based? → Resolved: file-based committed — `.ai-factory/tool-decisions.md` seeded by setup.sh Step 2d; deps-hash hook (Wave 5.3) re-prompts on dep changes.
- **«No install without confirmation»**: hard rule vs configurable? → Resolved: soft rule — skill encodes confirmation step; no automated install path shipped.
- **Recursive bootstrap**: how does context7 propose itself? → Resolved: context7 baseline installed by setup.sh Step 2d (precondition satisfied before further MCP/skill proposals).

**Origin:** user-stated frame 2026-05-10, see [research-patch](research-patches/2026-05-10-§13.25-tool-bootstrapping-research.md) §1.

**Cross-references:** [research-patches/2026-05-10-§13.25-tool-bootstrapping-research.md](research-patches/2026-05-10-§13.25-tool-bootstrapping-research.md) — 486-line research artifact; §13.18 (AIF deep alignment — cascade overlap); §13.22 (own-conventions evolution — cascade overlap); §13.27 / §13.28 / §13.8 (Wave 7 sibling closures).

---

### 13.26 AI-doc effectiveness in cold-start context (closed 2026-05-10)

Closed 2026-05-10. Two-deliverable artefact pair: [research-patches/2026-05-10-ai-doc-effectiveness-cold-audit.md](research-patches/2026-05-10-ai-doc-effectiveness-cold-audit.md) (Phase 1 + Phase 2 audit + §4 improvements + §8 honest meta-assessment, frozen post-merge) and [research-patches/2026-05-10-wave-6-review-verdicts.md](research-patches/2026-05-10-wave-6-review-verdicts.md) (§6 D-1..D-6 verdicts + §7 P-3 capability-gate correction MAJOR-1 + Wave 7 feeders + Wave 5 downstream notes). Verdicts: D-1 DEFER→Wave 7, D-2 SHIP indep., D-3 SHIP indep. (NOT mechanical capability commit per MAJOR-1; consult is discipline-recommended), D-4 DEFER, D-5 SHIP→Wave 7 (absorbed in §13.27 O4, no scope expansion), D-6 DEFER. Origin: post-Wave-2 reviewer-Opus described 4 drift moments (methodology elevation; taxonomy mixing; memory-mode goal-without-README; Step 0 skip); audit Phase 1 reproduced D2+D4 in own first-phase work (§8 self-meta). Wave 7 joint closure (§13.27+§13.28+§13.8) next per reversed sequence (commit 5d3d9c0); D-1 → §13.8 Decision-matrix lifecycle-stage row; D-5 → §13.27/O4 probe adaptation (P1/P4/P6 translate; P2/P3/P5 session-local). Cross-refs: §13.21 (parent doc-authority); §13.25 (Wave 5 sequencing); §13.27+§13.28+§13.8 (Wave 7 absorbing D-1+D-5).

---

### 13.27 Functional test for shipped AI-briefing templates — closed by Wave 7

Closed 2026-05-10/11 by sub-wave 7.3 (deterministic CI gate `framework-self-template-render`, commits `f528586`/`29e62d8`/`5afabad`) + 7.3.f (local advisory skill `template-audit`, commit `115b8ec`). LLM-judge re-evaluation trigger per Decision 3: promote LLM-judge → CI when deterministic PASS rate <80% over 30 consecutive days OR Anthropic Claude Code subscription expands to CI compute. _Armed 2026-05-10. Joint closure with §13.28+§13.8 under Wave 7; gated on Wave 6 close. Origin: §13.21 extended principle 09 to shipped templates (header presence) but not functional fitness. Cross-refs: §13.21; §13.26; §13.28 (joint sibling); §13.8 (matrix expansion)._

---

### 13.28 Operator-side discipline gap — non-git validation path — closed by Wave 7

Closed 2026-05-10/11 by sub-wave 7.4.a (`make validate-prompts`, commit `a008255`) + 7.2.b (PostToolUse harness-hook, commit `2e43874`). Both paths A+B per Decision 5; path C (un-gitignore) rejected 2026-05-10. _Armed 2026-05-10. Joint closure with §13.27+§13.8 under Wave 7; gated on Wave 6 close. Sample-size 1 (Wave 6 cold-audit: 6 drafting bugs caught by sceptic-pass); 2nd incident promotes per §13.21 H8. Origin: validate-batch-spec.ts shipped for orchestrator-prompts but directory gitignored — hook dormant. Cross-refs: .husky/pre-push §6; EXECUTION-PLAN Batch 1.C; §13.8; §13.21; §13.23; §13.27 (joint sibling); §13.26._

---

### 13.29 Substantive compliance verification (deferred — Wave 8 research)

**Status:** closed 2026-05-12. Wave 8 umbrella (PRs #38 research, #39 compliance-verifier, #40 D5-inverse-completeness, #41 §1.7-substance-CI, #42 pre-push-substance, #43 prior-art-escape-hatch, this PR Wave 8.5). Five-layer enforcement ladder active. Retroactive sweep → [`research-patches/2026-05-12-wave-8-retroactive-audit.md`](research-patches/2026-05-12-wave-8-retroactive-audit.md). Calibration window through 2026-06-10 for both substance arms.
**Origin:** four incidents — §1.7 PR-section gaming (Waves 5-7, PRs #25-#36 generic «Checked — compliant» bodies), D-3 probe shipped without negative test (PR #37, externally surfaced not auto-detected), 2026-05-09 EXECUTION-PLAN goal drift (canonical-phrase presence passed; semantic equivalence not checked), D-3 enrollment list curated from memory not from grep (2026-05-11, surfaced pre-research; ≥2 active downstream docs containing canonical phrase missing from `DOWNSTREAM_DOCS` — incident-4 evidence at [`research-patches/2026-05-11-d3-downstream-docs-completeness.md`](research-patches/2026-05-11-d3-downstream-docs-completeness.md)).
**Cross-references:** `.claude/orchestrator-prompts/wave-8-substantive-compliance/research.md`; research-patch `research-patches/2026-05-11-§13.29-substantive-compliance-research.md`; incident-4 evidence at [`research-patches/2026-05-11-d3-downstream-docs-completeness.md`](research-patches/2026-05-11-d3-downstream-docs-completeness.md); retroactive audit [`research-patches/2026-05-12-wave-8-retroactive-audit.md`](research-patches/2026-05-12-wave-8-retroactive-audit.md); §13.10 entry #4 (Gate 5 two-AI review — potential cascade overlap); §13.23 (closed Wave 7 — adjacent layer, presence-check not substance-check); §13.27/§13.28 (Wave 7 template-render + harness-hook — adjacent precedent).

---

### 13.36 TDD-for-Skills extension to .claude/skills/*/SKILL.md — resolved by principle 15

> *Migrated from open-questions.md on closure (2026-05-21) to keep the open registry under its 500-line budget. Anchor preserved for backward links.*

Superpowers explicitly applies **TDD discipline** to skill authoring: «NO SKILL WITHOUT A FAILING TEST FIRST»; RED-GREEN-REFACTOR for documentation. ADAPT-candidate for extending our paired-negative-test principle (`packages/core/principles/02-paired-negative-test.test.ts`) to skill files. Surfaced in [companion-target-comparison.md §3.1 + §7 Decision D](research-patches/2026-05-16-companion-target-comparison.md).

**Status:** RESOLVED (2026-05-21) — shipped as [principle 15 — skill paired-negative](../../packages/core/principles/15-skill-paired-negative.test.ts) (#112; SSOT [#55](prior-art-evaluations.md)). A refinement of **candidate mechanism A** below: rather than a companion fixture file, each non-grandfathered `SKILL.md` must carry a body-section paired-negative block (`## Without this skill` / `## With this skill`, both non-trivial and differing — anti-tautology). Grandfather = explicit `EXEMPT_SKILLS` allowlist (the 5 current skills). Principle 02 enforces paired-negative at the rule layer; principle 15 now extends the same idea to the skill layer (ADAPT of Superpowers' «NO SKILL WITHOUT A FAILING TEST», substrate-pure — no dependency). *(Was: ARMED — track without commitment.)*

**Candidate mechanisms (historical):**

- A. Add a principle test — mechanical check that every SKILL.md evidences the failure mode it addresses. *(Shipped, refined: body-section block rather than companion fixture.)*
- B. SKILL.md frontmatter `evidenced-failure:` linking to a research-patch/incident note. *(Not chosen — body-section needs no schema change.)*
- C. Reject — overkill at single-maintainer scale. *(Not chosen.)*

**Origin:** 2026-05-16 companion-target comparison R-phase (ADAPT-candidate per §7 Decision D2); resolved via N2 #5 → principle 15 (2026-05-21). **Cross-references:** [§13.39 Recommendation-moment gate](open-questions.md) (sibling N2/recommendation-discipline family); `packages/core/principles/02-paired-negative-test.test.ts` (rule-layer precedent).
