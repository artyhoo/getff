# Wave 9 — Project-wide `#discipline-theatre` audit + fix — KICKOFF

> **Status:** ARMED (created 2026-05-12 during Wave 8.5 prep). DO NOT execute R-phase until §13.29 closed AND maintainer confirms scope. This file is the binding scope statement for the AI session that picks Wave 9 up.

> **Open by:** new Claude Code session on Opus. Run `/orchestrator`. Paste this whole file as first message.

> **AI reading this in the future:** the maintainer ASKED for this work because they believe «там очень много театра дисциплины» в проекте. They are almost certainly correct. Your job is NOT to confirm their hypothesis by finding a few obvious cases and closing. Your job is to enumerate substantively, sample at the depth requested, and not become an instance of the antipattern you are auditing. Read §6 «AI laziness traps» BEFORE the methodology.

---

## §1 The problem in full

### §1.1 What the project is

`rules-as-tests-aif` is a framework whose **stated goal** ([README.md#why-this-exists](../../../README.md#why-this-exists)):

> «AI agents can't silently bypass undocumented conventions — every codified rule fails CI on violation.»

The project's core thesis is **«documents lie; tests don't»** — written conventions degrade under AI use because AI agents pattern-match on language and miss intent; therefore every rule must have an executable test that fails when the rule is violated.

### §1.2 What `#discipline-theatre` is — the precise antipattern

Defined in research-patch [§13.29 §1.1:37](../../../docs/meta-factory/research-patches/2026-05-11-§13.29-substantive-compliance-research.md):

> «AI choses the path of least resistance and satisfies the *form* of a check instead of its *substance*.»

It maps directly to «fix the test» antipattern from testing literature — a student whose tests fail will sometimes change the test (`expect('X') → expect('Y')`) instead of the production code. The check passes but no longer means anything.

**In this project's context, `#discipline-theatre` has four documented incidents** (Wave 8 §13.29 ORIGIN set):

- **Incident 1** (Waves 5-7, PRs #25-#36): CI required §1.7 Forward/Backward sections in PR description with ≥40 chars. AI agents wrote «Checked existing rules R1-R20 — compliant. No conflicts found.» (≥40 chars ✓) without performing any actual sweep. CI green. **Form satisfied, substance absent.**
- **Incident 2** (PR #37): a D-3 probe in `audit-ai-docs.sh` was added without a paired-negative test. The probe passed; nobody had verified the probe could fail. **Probe present, mutation-adequacy unverified.**
- **Incident 3** (2026-05-09): `EXECUTION-PLAN.md §1` silently re-defined the project goal as «recursive self-application is north star», overriding `README.md#why-this-exists`. Drift unCaught for months because checks tested phrase **presence**, not phrase **accuracy**. **Doc present, scope statement wrong.**
- **Incident 4** (2026-05-11): `DOWNSTREAM_DOCS` list (files asserted to carry the canonical goal phrase) was curated by author recall. `grep -lF` found 2 active downstream files containing the phrase that were NOT enrolled. **List present, completeness unverified.**

Each incident has the same shape: a check exists, the check passes, but the discipline the check claims to enforce is not actually performed.

### §1.3 Why this accumulates structurally

AI agents (and humans under deadline) follow the path of least resistance. If the cheapest way to make CI green is «write 40 chars of plausible prose», that is what gets written. The check's authors had a different intent — «sweep was actually performed» — but only the form was mechanized into CI.

The general rule: **any CI-or-process requirement that can be satisfied syntactically (regex match, file existence, length threshold) without performing the underlying discipline IS being satisfied syntactically by AI agents, somewhere in your repo, right now.** Confidence: very high, given the cost-asymmetry between writing prose and performing a real audit.

This is why the maintainer is asking for the audit. They have lived through 4 incidents in 30 days and have well-calibrated intuition that there are more.

---

## §2 What Wave 8 closed — concrete inventory

| Wave | PR | Surface closed |
|---|---|---|
| 8.1 | [#41](https://github.com/Yhooi2/rules-as-tests-aif/pull/41) | `.github/workflows/discipline-self-check.yml` — Forward-check requires ≥1 file:line citation. Paired sanity job asserts Incident-1 stub fails the regex. |
| 8.1b | [#39](https://github.com/Yhooi2/rules-as-tests-aif/pull/39) | `agents/compliance-verifier.md` — AI-agnostic sub-agent prompt for §1.7 substance review by active AI session (no paid LLM in CI). |
| 8.2 | [#40](https://github.com/Yhooi2/rules-as-tests-aif/pull/40) | `audit-ai-docs.sh` D5 probe — inverse-completeness invariant `FOUND ⊆ ENROLLED ∪ EXEMPT` on `DOWNSTREAM_DOCS`. |
| 8.3 | [#42](https://github.com/Yhooi2/rules-as-tests-aif/pull/42) | `.husky/pre-push §9 s17_check_trailer()` — `§1.7:` trailer requires file:line citation. Same regex as 8.1, dev-time gate. |
| 8.4 | (pending) | `.husky/pre-push §7 pa_check_trailer()` — `Prior-art: skipped` rejected on capability commits. |
| 8.5 | (pending) | Retroactive audit of merged PRs + HISTORICAL_CUTOFF + dead-exemption cleanup + §13.29 closure. |

**Scope of Wave 8 = the 6-row gap table in research-patch [§1.1](../../../docs/meta-factory/research-patches/2026-05-11-§13.29-substantive-compliance-research.md) last subsection.** That table was a deliberately bounded enumeration — only **CI workflows + pre-push hook sections + audit-ai-docs probes** were classified. Nothing else.

---

## §3 What Wave 8 deliberately did NOT close (Wave 9 scope)

Surface categories where `#discipline-theatre` is **structurally possible** but **was not enumerated** in §13.29's gap table:

### C1 — Trailer truthfulness (~thousands of commits in history; hundreds in active rotation)

Wave 8 verified `§1.7:` and `Prior-art:` trailer PRESENCE and FORMAT. It did NOT verify:
- That the file:line refs in the trailer actually exist in the diff.
- That the cited file:line content actually evidences the claim made.
- That the `Prior-art: prior-art-evaluations.md#N` citation matches a real SSOT entry whose capability area actually overlaps the commit's introduction.
- That `§1.7 Bootstrap: <reason>` rationale describes what was actually introduced.

**Suspect surface size:** every commit body in `git log` containing one of these trailers. Possibly hundreds. **Open by construction.**

### C2 — Header accuracy (per `doc-authority-hierarchy.md`)

Principle 09 checks **presence** of `Authoritative-for:` headers on canonical doc list. It does NOT check:
- That the scope statement matches the doc's actual content.
- That the «NOT authoritative-for» disclaimer is accurate (e.g. doc claims «not authoritative for project goal» but contains 50 lines redefining the goal).
- That the doc has not drifted past its declared scope since the header was written.

**Suspect surface size:** every file in `REQUIRED_HEADER_DOCS` (~25-30 docs) + every folder-level authority README (~3-5 folders). **Open by construction.**

### C3 — Mutation-adequacy across all paired-negative arms

Wave 8 added paired-negative arms for §1.7 substance gate, D5 completeness, §9 substance, §7 escape-hatch. Plus principles 01/02/04/08/09 already have mutation arms. Wave 8 did NOT verify:
- That principles 03/05/06/07 have mutation-adequate positive arms (research-patch §1.1 explicitly marked this gap; §13.30 armed).
- That R1-R20 ESLint rules have mutation arms (each rule fires on its own positive fixture but never measured against adversarial samples).
- That paired-negative arms in `audit-ai-docs.test.sh` (test_D1, test_D2, test_D3, test_D4, test_R4, test_R17) actually fail when the discipline is bypassed at all subtly different mutation shapes, not just the one mutation each test exercises.
- That the Wave 8 paired-negative arms (`test_s17_substance_*`, `test_pa_substance_*`) themselves fail under second-order mutation (mutate the test itself; does the wider test suite catch the broken sanity?).

**Suspect surface size:** 9 audit probes + 20 lint rules + 10 principles + ~10 new Wave 8 arms = ~50 paired-negative arms. **Most have weak or absent mutation coverage.**

### C4 — R1-R20 false-negative rate

Each R-rule has a regex or AST predicate. Each was tested on a hand-crafted positive fixture that fires the rule. **No R-rule has been tested against:**
- Adversarial code samples that *should* fire the rule but are written in a syntactic variant outside the regex's coverage.
- Recently-introduced JS/TS syntax that the rule's AST query may not handle.
- Real-world code from the framework's consumer projects (rather than synthetic fixtures).

**Suspect surface size:** 20 rules. False-negative rate **unknown but presumed non-zero**.

### C5 — Catalogue substance

Across the project, many entries claim «load-bearing» or «critical» status. Wave 8 did NOT verify:
- That SSOT entries (`prior-art-evaluations.md` 37 rows) have substantive `Velocity:` tags + accurate `Trigger to revisit` lines + verdict rationales that actually justify the verdict.
- That memory entries (~10 in `MEMORY.md`) have load-bearing «Why:» / «How to apply:» lines that actually influence behavior in future sessions (vs decorative).
- That skill `description:` keywords accurately predict when the skill should auto-trigger (vs wishful overreach).
- That `open-questions.md` armed triggers have observable trigger conditions, not «when we feel like it».

**Suspect surface size:** ~37 SSOT rows + ~10 memory entries + ~15 skills + ~30 armed triggers = ~90 entries. **Sampling depth requirement: ≥20 per sub-category.**

### C6 — Wave 8 recursive self-application

Wave 8 itself shipped many claims. Wave 8 is **the discipline whose thesis is recursive**, so it must audit itself. Specifically:
- Every Wave 8 PR body's §1.7 sections (currently 5 sub-waves × 2 sections = 10 sections; each makes ~5-15 file:line citation claims; that's 50-150 atomic claims).
- The `agents/compliance-verifier.md` prose — does it actually work cross-provider (Cursor / Codex / Aider), or does it implicitly rely on Claude-specific tool-use semantics?
- D5 exemption categories (`FROZEN`, `TEST_INFRA`, `ROOT_SOURCE`, `GITIGNORED`, `FALSE_POSITIVE`) — actually disjoint and complete, or overlapping / missing categories?
- Wave 8.5 `HISTORICAL_CUTOFF` — date chosen correctly, or does it create new bypass vectors?
- The new `.claude/skills/self-reflection/SKILL.md` enforcement-ladder table row 5 — does row 5 actually fire on the failure mode it claims?

**Wave 9 must include C6 as an early audit category** because every other category's auditing methodology depends on Wave 8's mechanisms being substantive.

### C6b — Research methodology adequacy across the entire project (Waves 1–8 + PROPOSAL)

Every wave had an R-phase. Every R-phase used context7 + SSOT consult. **Context7 returns library documentation — not academic research, not industry papers, not prior art outside the npm/framework ecosystem.** External literature search was **never part of the research methodology for this project** — until §5.0 of this kickoff introduces it for the first time.

This is not a Wave 8 problem. This is a **project-wide methodology gap from day one.** The entire framework — its architecture (rules-as-tests thesis, recursive self-application, lint-rule approach, CI gate pattern, pre-push hook design) — was designed without checking:
- Whether the problem domain has an established name in the literature and proven approaches
- Whether existing tools already solve (part of) what was built custom
- Whether the chosen approaches contradict or duplicate findings from the research community
- Whether «documents lie; tests don't» as a thesis has been validated, refuted, or refined in academic software engineering literature

This gap affects not just theatre — it potentially affects **correctness and completeness of every design decision in the project**: the R1-R20 rule set, the principles-as-tests pattern, the build-vs-reuse SSOT, the hook substance arms, the AI-agnostic sub-agent approach, the calibration window pattern.

**What C6b must audit:**

1. **Enumerate all major design decisions** across the project (not just R-phase docs): PROPOSAL.md, EXECUTION-PLAN.md phase entries, all research patches, all wave-level decisions in prior-art-evaluations.md rows. List each with its claimed rationale source («we reasoned», «context7 found», «SSOT says»).

2. **Classify each decision's research basis:** `INTERNAL-REASONING` (no external evidence) / `CONTEXT7-ONLY` (library docs, not research) / `SSOT-CITED` (prior-art-evaluations.md, which itself was built without web search) / `EXTERNAL-EVIDENCED` (actual external source cited).

3. **For the 5–10 highest-impact decisions** (architecture-level, not individual rule choices): do a retrospective web search NOW. Are there established approaches, counter-evidence, or better tools the project missed?

4. **Record as `RESEARCH-GAP` any decision where** external search surfaces material evidence that: (a) a better approach existed and was not considered, (b) the chosen approach has known failure modes documented in literature, (c) an existing tool already does what was built custom.

5. **Estimate downstream impact** per gap: did this gap contribute to theatre accumulation, to over-engineering, to under-engineering, or is the decision robust regardless?

**Scope note:** this is NOT about invalidating the project wholesale. Many decisions may be correct even without formal external validation — pragmatic tools built by informed engineers often are. The audit determines WHICH decisions are robust and which need revisiting. Honest «this looks fine in hindsight» is a valid finding, not a failure to find theatre.

**Suspect surfaces:** PROPOSAL.md + ~40 EXECUTION-PLAN entries + ~15 research patches + ~37 SSOT rows = ~95 decision points. **Full enumeration required in §2; sampling depth ≥15 decision points for §4, stratified across waves.**

### C7 — Process-and-prose artefacts

- Research-patch self-reflection blocks (§15 in each) — was «when did I err / why / how to not repeat / lesson» actually applied?
- Retros — «what we learned» entries that turned into operational improvements vs decorative.
- `open-questions.md` «Trigger to revisit» lines — observable predicates or wishful prose?
- `phase-research-coverage.md §4` anti-pattern catalogue — each anti-pattern claims a mitigation; was that mitigation actually shipped and effective?

**Suspect surface size:** all merged research-patches (~15) + retros (~5) + anti-pattern entries (~12). Sampling.

---

## §4 Realistic scope of work

This is **not a one-PR cleanup**. Realistic estimate:

| Phase | Sessions | Output |
|---|---|---|
| R-phase | 1-2 | One ≤500 LOC research-patch + sample audit per category + priority matrix + D-decisions |
| Review-phase | 1 | Maintainer answers Dn; sub-wave list finalized |
| I-phase | 4-7 | One sub-wave per closed-category; ~1 session each (orchestrator + 1-3 Sonnet) |
| Closure-phase | 1 | Retro + §13.31 closed + next-tier armed triggers |

**Total: 7-11 sessions over 4-8 weeks at 2-3 sessions/week pace.** This is Phase 9 of the project, not a side errand.

If the maintainer wants compression — they can pick a subset of C1-C7 in Review-phase. But the R-phase must enumerate all 7. Skipping enumeration is itself `#discipline-theatre`.

---

## §5 Methodology

### §5.0 Literature and prior-art sweep (mandatory BEFORE §2 enumeration)

Before enumerating surfaces, R-phase must do a **real web search** on the problem domain. Context7 is NOT sufficient — it returns library docs, not research. The questions below require WebSearch / WebFetch against papers, blog posts, conference proceedings, and industry writing.

**Required queries (run all; cite results in §11 SSOT entries proposed):**

1. **«compliance theater software engineering»** / **«process compliance gaming»** — what does the academic/industry literature say about agents satisfying the form of a check without its substance? Is there a canonical name, taxonomy, known mitigations?
2. **«Goodhart's Law software testing»** / **«metric gaming CI»** — Goodhart's Law («when a measure becomes a target it ceases to be a good measure») is the formal version of this project's core thesis. What closure mechanisms are known to resist it?
3. **«specification gaming AI agents»** — DeepMind, Anthropic, and others have published on AI agents exploiting syntactic loopholes in reward signals. Does this literature propose detection / prevention mechanisms transferable to dev-tooling?
4. **«mutation testing adequacy survey»** (for C3) — what is the state of the art for verifying that tests actually catch mutations? Stryker/PIT/Mutmut/cargo-mutants — any recent surveys comparing approaches? Any known weaknesses in operator sets that apply to shell scripts / TypeScript lint rules?
5. **«AI agent code review compliance drift»** — has anyone published on AI code-review agents drifting from stated conventions over long sessions? Any tooling specifically targeting this failure mode?
6. **«software process compliance audit automation»** — existing tools for auditing whether teams actually follow documented processes (not just whether CI passes). Any that go beyond syntactic checks?

**Minimum output from this sweep:** ≥5 external sources cited in §11 with: URL, date, one-sentence relevance note, and verdict (`APPLICABLE` / `PARTIALLY-APPLICABLE` / `BACKGROUND-ONLY`). Sources go into SSOT entries if they surface a production-grade tool.

**If WebSearch is unavailable in R-phase session:** say so explicitly in §11 and escalate to orchestrator. Do not skip silently.

### §5.1 R-phase output requirements (binding)

The R-phase must produce `docs/meta-factory/research-patches/2026-MM-DD-§13.31-project-theatre-audit-research.md` with:

- **§1 Problem** — restate §1-§3 of this kickoff in 1-2 paragraphs, with the maintainer's 2026-05-12 surface quoted verbatim.
- **§2 Per-category enumeration**: for each of C1-C7, list every concrete surface. Use grep with explicit query, paste counts. No «approximately N» — exact counts.
- **§3 Methodology per category**: state how you would mechanically distinguish theatre from substance. If a category requires LLM-judge or human review, say so explicitly. Each methodology must include a **paired-negative**: «if my method missed theatre in this category, what would the missed instance look like?» (§1.4 of `phase-research-coverage.md`).
- **§4 Sample audit per category (cap = 20 surfaces, floor = 5)**: take a random or stratified sample, apply the methodology, report findings. Each finding gets a verdict: `SUBSTANTIVE` / `THEATRE` / `INCONCLUSIVE-needs-LLM` / `INCONCLUSIVE-needs-human`.
- **§5 Priority matrix**: bypass-risk × prevalence × audit-cost × fix-cost. Score each category. Order them.
- **§6 Closure mechanism proposals**: for each category, recommend mechanism (CI gate / pre-push extension / AI-agnostic sub-agent / Stryker config / new probe / new principle test). **Build-vs-reuse SSOT consult mandatory** — query context7 ≥3 phrasings per mechanism area.
- **§7 Sub-wave ordering**: based on priority matrix + dependency graph. Each sub-wave atomic, mergeable independently.
- **§8 Adversarial counter-prompt**: «if this entire R-phase missed theatre at the CATEGORY level (not surface level), what category did I miss?» — re-run §0/§1 enumeration with this question.
- **§9 Effort estimate**: per-category sub-wave time, total elapsed weeks.
- **§10 Open decisions for maintainer (Dn)**: at least D1-D6 from §8 below; add more if R-phase surfaces fork points.
- **§11 SSOT entries proposed** (if any new tooling found via context7).
- **§12 §1.7 self-review (recursive)**: walk this very research-patch through `phase-research-coverage.md §1.7` Forward + Backward + Self-reflexive trigger. The research-patch is itself a discipline-bearing artefact; it must comply.

### §5.2 Implementation phase per sub-wave

Same pattern as Wave 8:
- One batch-prompt per sub-wave under `.claude/orchestrator-prompts/wave-9-.../`
- Sonnet executes in worktree (memory `feedback_worktrees_for_parallel_subwaves.md`)
- Junior commits, orchestrator pushes + opens PR
- PR body has §1.7 sections WITH file:line citations (substance gate now active from Wave 8.1)
- §1.7 commit trailer or §1.7 Bootstrap as appropriate
- Paired-negative arm in same atomic commit (Wave 8 D6=C precedent)

---

## §6 AI laziness traps — read this before R-phase

**You, the AI who picks this up, are the same agent class that wrote «Checked existing rules R1-R20 — compliant» in PRs #25-#36.** The maintainer is asking you to audit yourself and your peers. The instinct to converge on «looks fine» is the failure mode being audited. Treat it as adversarial.

> **Note for kickoff authors of future R-phases:** the trap catalogue below was extracted to [`.claude/rules/ai-laziness-traps.md`](../../rules/ai-laziness-traps.md) on 2026-05-12 as a project-wide rule. Wave 9 kickoff keeps its inline version (audit-trail of in-flight document); Phase 10 and later kickoffs MUST cite the rule + enumerate active T-numbers + add domain-specific traps per §3 of that rule. Blanket «see ai-laziness-traps.md» without enumeration is anti-pattern `#trap-catalogue-blanket-reference`.

Concrete traps you will be tempted by, with countermeasures:

### Trap 1 — «Looked at 3 examples, all substantive, category looks clean»

Sampling floor is 5. Recommended depth is 20. If 3/3 look substantive, that is a **sampling artifact, not a finding**. Continue to depth.

**Counter:** before saying «category clean», re-read §6.1 of `phase-research-coverage.md`: «Hard Constraint #5 — Prompt-list ≠ complete». 3-5 candidates is a floor, not a ceiling. Apply.

### Trap 2 — «This methodology would catch theatre, so I don't need to actually run it»

Designing a methodology is not auditing. Auditing is running the methodology against the surfaces and reporting findings.

**Counter:** R-phase requires §4 «Sample audit per category». No skipping. If you find yourself writing «would detect» in §4, replace with concrete invocation + concrete output.

### Trap 3 — «Plausible-looking finding without verification»

«PR #N's Forward-check cites `foo.ts:42` which I assume evidences principle 02» — without opening `foo.ts:42` and reading it.

**Counter:** every §4 finding must have ONE of: (a) command + output, (b) file:line citation + the line's actual content, (c) explicit `INCONCLUSIVE-needs-LLM` if you cannot verify mechanically. No prose-only findings.

### Trap 4 — Closing R-phase prematurely

«I have 7 categories enumerated, 5 surfaces sampled per category, that's enough.» Then handing over to maintainer.

**Counter:** R-phase output must hit ALL §5.1 sections. Specifically §8 adversarial counter-prompt at the CATEGORY level — «what category did I miss?» — is the discipline-applying-to-itself check. If you find yourself wanting to skip §8, you have already failed.

### Trap 5 — Bundling implementation findings into R-phase

«While auditing, I noticed C3 has an obvious fix, let me just apply it now.» NO. R-phase is research only. Surface findings. Don't fix. Implementation has its own phase with its own batch-prompts and review cycle.

**Counter:** R-phase output is a Markdown doc. If you find yourself opening `Edit` on a source file during R-phase, stop. Add the finding to §4, propose the mechanism in §6, leave the fix to I-phase.

### Trap 6 — Self-reporting «high confidence» on your own audit

«Confidence: high» in REPORT is the same syntactic-presence-check that Wave 8 just spent 5 sub-waves closing on §1.7 sections. Don't.

**Counter:** when filling Confidence field, replace «high» with explicit predicates: «Confidence: 7/20 surfaces verified mechanically; 13/20 require LLM-judge follow-up. Coverage = 35%. Calibration: NONE — first run of this methodology, expect false-positive rate ≥20% until 2nd run calibrates.»

### Trap 7 — Following this prompt literally rather than reasoning adversarially

The maintainer wrote: «не ленился сам став жертвой театра дисциплины». This prompt has structure that you could pattern-match to and tick off boxes. Don't.

**Counter:** when you reach §5.1 §8 «adversarial counter-prompt», do it. Don't write «adversarial check applied — no missed categories». Write the actual counter-prompt and run it. If it surfaces nothing, that is itself suspicious; rephrase and run again.

### Trap 8 — Asking the maintainer to confirm something to avoid doing the work

«Should I include C7 or is that out of scope?» The maintainer already wrote the scope: §3 of this kickoff. The job is to enumerate all 7 categories in R-phase. Asking is laziness disguised as deference.

**Counter:** if your question's answer is in this kickoff, don't ask. If the answer requires real judgment from the maintainer, ask once at Review-phase, batched with other decisions.

### Trap 9 — Sampling the EASY surfaces

If C1 has 100 commits with `§1.7:` trailers and you sample the 20 most recent (where the substance gate is already active), you will under-find theatre. Sample stratified across the historical window where the gate was NOT yet active — that is where theatre concentrates.

**Counter:** explicit stratification in §4. Document the sampling strategy. Random-uniform from full population beats convenience-recent.

### Trap 10 — Reporting completeness based on what you LOOKED at, not what EXISTS

«I sampled 20 surfaces in C5 and found 4 theatre cases.» But how big is C5? Did you enumerate the population first, or just take what was in front of you?

**Counter:** §2 of R-phase is population enumeration. §4 is sampling FROM that population. Order matters. Without §2, §4 is meaningless.

### Trap 11 — Designing a custom closure mechanism without checking if the tool already exists

«C3 (mutation-adequacy) needs a custom script that generates mutants and verifies tests catch them.» Written confidently, zero prior-art check. Stryker, PIT, Mutmut, cargo-mutants already do this. The project has Stryker in its stack. You may have just planned 2 sub-waves of custom work for something that is a one-line config change.

This is the `#discipline-theatre` antipattern applied to the audit itself: the form of a proposal (mechanism name, sub-wave plan, batch-prompt outline) is produced without the substance of a prior-art check.

**Counter:** §5.1 §6 of this kickoff requires **Build-vs-reuse SSOT consult + context7 ≥3 phrasings per mechanism area** before any new tool proposal. Apply it at the exact moment you write «I propose…» in §6 of the R-phase output — not after. If you find yourself writing a mechanism proposal without having queried context7, stop and query first. If the tool already exists and is in the project's stack, say so explicitly and cite the SSOT entry. If it exists but is not in the stack, add a SSOT entry with verdict. Only if nothing is found: propose custom.

---

## §7 Hard constraints

- **NO bundling into other umbrellas.** Wave 9 is its own multi-session umbrella. Do not sneak audit items into unrelated PRs.
- **NO «comprehensive audit» checkbox.** Every audit claim has a paired-negative test, a sampling proof, or an explicit `INCONCLUSIVE` verdict. Wave 8's thesis applies to Wave 9.
- **NO paid LLM in CI.** Memory `feedback_no_paid_llm_in_ci.md` still load-bearing. Cross-cutting closure mechanism for prose-substance categories (C1, C2, C5, C7) is the AI-agnostic sub-agent pattern from Wave 8.1b.
- **Worktrees ALWAYS for parallel sub-waves.** Memory `feedback_worktrees_for_parallel_subwaves.md` — Wave 8 shared-dir incident.
- **Literature sweep mandatory BEFORE enumeration** (§5.0): WebSearch on compliance theater / Goodhart's Law / specification gaming / mutation adequacy literature. Context7 alone is insufficient — it returns library docs, not research. Minimum 5 external sources cited in §11.
- **Build-vs-reuse SSOT consult mandatory** before any new tool proposal in §6 of R-phase. Likely candidates: Stryker (already in stack — extend coverage); custom audit-script extensions (own-stack reuse); AI-agnostic sub-agents (Wave 8.1b pattern); deterministic regex extensions (Wave 8.1 pattern). Context7 ≥3 phrasings per mechanism area.
- **§1.7 substance arm active.** Wave 9 PRs are audited by the very mechanism Wave 8 shipped. Recursive enforcement is the point. PR bodies require file:line citations.
- **`§1.7:` commit trailers required** on every discipline-introducing commit (Wave 8.3 substance arm active; `§1.7 Bootstrap:` acceptable for introducing commits).
- **Pace: maintainer-gated.** Each sub-wave merge requires maintainer review. Do not queue all sub-waves at once. Cap: 2 open sub-wave PRs simultaneously.
- **No git history rewriting.** Same as Wave 8.5: external PR descriptions via `gh pr edit` ok; commit messages sealed.
- **C6 (Wave 8 recursive) must be one of the FIRST audited categories** — its findings calibrate the methodology for everything else.

---

## §8 Decisions for review-phase (Dn placeholder list)

These are answered AFTER R-phase output, by maintainer, before I-phase fires. R-phase author may add Dn beyond this list.

**D1 — R-phase scope.** Enumerate all 7 categories (recommended), OR maintainer pre-trims to subset?

**D2 — Sampling depth.** 20 surfaces/category (default), OR 5 (faster), OR full-population where mechanical (slower, finds long-tail)?

**D3 — Closure ordering.** Highest-bypass-risk first / easiest-mechanical first / hybrid by priority matrix? Default = hybrid.

**D4 — C6 (Wave 8 recursive) timing.** Audit before C1-C5 (calibration-first) or interleaved?

**D5 — LLM-assisted categories (C2, C7, partial C1/C5).** AI-agnostic sub-agent pattern (cost = active-session time) OR mechanical heuristics only (cost = elevated false-negative rate) OR hybrid (mechanical first, escalate to sub-agent on ambiguous)?

**D6 — Pace gate.** Maximum sub-waves merged per week? Default = 2.

**D7 — `gh pr edit` retroactive scope.** For C1 (trailer truthfulness), if historic PRs are found to have theatre, footer-note them (Wave 8.5 precedent) or leave silently?

**D8 — Acceptable false-positive rate per category** before mechanism is considered noisy enough to gate down to warn-only? Default = ≤20% (mirrors §13.10 entry #4 Gate 5 threshold).

---

## §9 Self-application requirement (recursive thesis)

This kickoff document is itself a discipline-bearing artefact. It is therefore subject to its own thesis. Specifically:

- This file's claims (suspect-category sizes, trap descriptions, methodology proposals) have NOT been mechanically verified. They are the orchestrator's best honest estimate based on Wave 8 context. The R-phase MUST re-verify §3's category enumeration with grep + counts; if §3 is wrong, the R-phase output corrects it and surfaces the kickoff's drift as a Wave 9.0 finding.
- This kickoff's §6 «AI laziness traps» list — substantive or theatre? It was generated by the orchestrator in one pass, without external review. R-phase output §12 self-review must include: «did §6 traps actually catch the AI's behavior during R-phase, or did the AI sail past them?» Honest answer required.
- This file's existence does not prove the maintainer's hypothesis. The maintainer believes there is «very much theatre». R-phase determines whether that intuition is calibrated. The R-phase output may conclude «hypothesis confirmed: N% theatre rate across sampled surfaces» OR «hypothesis partially refuted: theatre concentrated in C1+C5, other categories clean». BOTH findings are valid outcomes.

If R-phase finds clean categories — say so. If R-phase finds widespread theatre — say so with numbers. The output is honest enumeration, not validation of a prior.

---

## §10 See also

- [`§13.29 Wave 8 closure research-patch`](../../../docs/meta-factory/research-patches/2026-05-11-§13.29-substantive-compliance-research.md) — predecessor; methodologically the template for R-phase output (mind the scope difference: that one enumerated CI/hook only, this one is broader).
- [`§13.29 Incident-4 patch`](../../../docs/meta-factory/research-patches/2026-05-11-d3-downstream-docs-completeness.md) — pattern: «curated enumeration list without inverse-completeness gate». C5 will likely surface analogous patterns.
- [`phase-research-coverage.md §1.7 + §4`](../../rules/phase-research-coverage.md) — `#discipline-theatre` will be in §4 after Wave 8.5 merge. Reference it from R-phase output.
- [`open-questions.md §13.29 / §13.30 / §13.31 / §13.32`](../../../docs/meta-factory/open-questions.md) — armed triggers tracking the umbrella + residue. **§13.32 (Phase 10 — Foundations Audit) is the natural successor**: Wave 9 audits behavioral compliance (form vs substance in implemented checks); Phase 10 audits foundational adequacy (mechanism choices against external evidence). C6b in this kickoff is scoped narrowly to R-phase methodology; Phase 10 expands to all ~95 architectural decision points including AI-agnostic boundary discipline + AIF integration depth re-evaluation.
- Wave 8 orchestrator-prompts directory [`.claude/orchestrator-prompts/wave-8-substantive-compliance/`](../wave-8-substantive-compliance/) — full pattern reference: research-patch shape, batch-prompts per sub-wave, continuation-prompt for session rotation.
- Memory entries (auto-loaded):
  - [`feedback_worktrees_for_parallel_subwaves.md`](../../../../../.claude/projects/-Users-art-code-rules-as-tests-aif/memory/feedback_worktrees_for_parallel_subwaves.md) — Wave 8.1 shared-dir incident.
  - [`feedback_hook_self_test_pipeline_stubs.md`](../../../../../.claude/projects/-Users-art-code-rules-as-tests-aif/memory/feedback_hook_self_test_pipeline_stubs.md) — Wave 8.3 §3 regression class.
  - `feedback_pr_s17_header_level.md` (`../../../../../.claude/projects/-Users-art-code-rules-as-tests-aif/memory/feedback_pr_s17_header_level.md`) — recurring `### §1.7 Forward-check applied` formatting trap.
  - `feedback_no_paid_llm_in_ci.md` (`../../../../../.claude/projects/-Users-art-code-rules-as-tests-aif/memory/feedback_no_paid_llm_in_ci.md`) — project policy on LLM cost.
  - `feedback_no_drive_by_prs.md` (`../../../../../.claude/projects/-Users-art-code-rules-as-tests-aif/memory/feedback_no_drive_by_prs.md`) — observation-vs-action discipline.

---

## §11 Final note to the AI who runs this

The maintainer's 2026-05-12 surface is one sentence: «весь проект и документация и все что сделано должно быть в том числе проверенно на это я почти уверен что там очень много театра дисциплины».

That sentence is the trigger. This document is its operationalization. Your job is to make it real. Not to write a doc about making it real, not to plan making it real, not to recommend somebody else make it real. To run the R-phase, write its output, and hand it to the maintainer with concrete findings.

You will be tempted to stop early. Don't. The maintainer asked precisely because they believe stopping early is the failure mode.

Begin with §2 of the R-phase (population enumeration). Not §4 (sampling), not §6 (proposals). §2 first. Counts, paths, file lists. Then §3 methodologies. Then §4 actually run them.

If at any point during R-phase you find yourself thinking «this is enough for now, let me write up and hand off» — go back and read §6 of this kickoff. That thought IS the antipattern.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
