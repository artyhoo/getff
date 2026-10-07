---
name: self-reflection
description: Use when introducing or extending a rule, principle, pattern, methodology, discipline, or process change in this repository. Auto-trigger on «правило», «принцип», «дисциплина», «методология», «процесс», recommend, introduce rule, new principle, discipline change, process rule, meta, recursive, applies to itself, check own work, self-review, forward check, backward check, closing recommendation, discipline-bearing artefact, self-reflection, anti-pattern, or any edit touching `.claude/rules/`, `packages/core/principles/`, `docs/meta-factory/EXECUTION-PLAN.md`, `docs/meta-factory/prior-art-evaluations.md`, `CLAUDE.md`. Do NOT trigger on simple typo fixes, code edits without rule changes, or routine PR work.
---

<!-- @harness-posture: portable — prose self-application checklist over repo artefacts; no harness primitives -->

# Self-reflection — recommendation discipline gate

> **Authoritative for:** skill activation conditions (frontmatter `description`); §1.7 forward+backward checklist summary; output contract for discipline-introducing recommendations; pointers to cold references.
> **NOT authoritative for:** the §1.7 rule itself — see [`.claude/rules/phase-research-coverage.md §1.7`](../../rules/phase-research-coverage.md). Project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).

Before closing a recommendation that introduces or extends a rule/principle/pattern/discipline, run §1.7 forward+backward and ship it only after both sides pass. Input: the recommendation and its affected class of artifacts. Output: the two evidence-bearing sections below, or an explicit provisional/skipped marker.

## When this skill is relevant

Use when:

- Drafting a new entry in `.claude/rules/`, `packages/core/principles/`, or any discipline-bearing doc.
- Proposing a new SSOT entry in `docs/meta-factory/prior-art-evaluations.md`.
- Recommending a process change to `EXECUTION-PLAN.md` (new gate, supersede, scope change).
- Designing a new skill or sub-agent that codifies process.
- Closing a research session whose deliverable is a methodology / discipline / convention.
- Writing a retro that proposes a follow-up rule.

**Do NOT use when:**

- Fixing a typo or formatting issue.
- Editing test fixtures or snapshot data.
- Implementing a known-spec'd feature without introducing new conventions.
- Routine refactors that don't change rules.

## Output contract

Before closing a recommendation under skill scope — and in any PR description that touches discipline-bearing files — the recommendation must contain two non-empty sections **with the exact `### §1.7` heading prefix the CI gate matches**. [`discipline-self-check.yml`](../../../.github/workflows/discipline-self-check.yml) anchors its `awk` on `^### §1\.7 Forward-check applied` and `^### §1\.7 Backward-check applied`; a heading without the `§1.7` prefix does **not** match and the gate reports the section as missing.

```markdown
### §1.7 Forward-check applied

<which existing disciplines were checked, with results — must cite ≥1 `file.ext:line` reference>

### §1.7 Backward-check applied

<artefacts swept under the new rule's scope, with exemption mechanism + meta-test specification — must ALSO cite ≥1 `file.ext:line` reference>
```

**Each requirement is independently enforced by `discipline-self-check.yml`:**

- **Heading prefix is mandatory.** Use `### §1.7 Forward-check applied` and `### §1.7 Backward-check applied` verbatim. `### Forward-check applied` / `### Backward-check applied` without the `§1.7` prefix fail as "missing section".
- **Body ≥40 non-whitespace chars** per section.
- **≥1 `file.ext:line` citation in BOTH sections** — not just Forward. The substance gate runs the regex `[^[:space:]]+\.[a-z]+:[0-9]+` over each section independently; a Backward-check with prose only (e.g. «all 13 artefacts swept, compliant») fails. Example: `packages/core/principles/02-paired-negative-test.test.ts:82 mutation arm verified`.

If either section is missing, too short, or lacks a `file.ext:line` citation — recommendation is **provisional**, not load-bearing. The assistant must either complete the section or explicitly mark `### §1.7 Skipped: <reason ≥60 chars>` — the rationale must be on the **same line** as the marker and run ≥60 chars after the colon (e.g. «typo fix in already-shipped rule, no scope change, no new convention introduced»).

## §1.7 forward checklist (summary)

Full enumeration: [references/forward-checklist.md](references/forward-checklist.md). Quick form — does the proposed change comply with each currently-active layer?

1. **Code-level (R1-R20)** — TS files in proposal pass strict + dep-cruiser?
2. **Principle-level (01-09)** — any new TS code passes existing principle tests?
3. **Commit-level (capability-commit gate)** — proposal's commits classified per [CLAUDE.md `What is a capability commit`](../../../CLAUDE.md); `Prior-art:` trailer drafted for each capability commit?
4. **Build-vs-reuse SSOT** — load-bearing patterns referenced by proposal are entries in [`prior-art-evaluations.md`](../../../docs/meta-factory/prior-art-evaluations.md); if not, new entry planned in same commit?
5. **Trigger sweep (§1.6)** — `grep -nE "^### 13\." docs/meta-factory/open-questions.md` run; cascade dependencies on the proposal classified?
6. **Doc-authority on artefacts produced** — every new `.md` file claimed by proposal carries compliant `> **Authoritative for:**` header per [`doc-authority-hierarchy.md §3`](../../rules/doc-authority-hierarchy.md)? Files exist in repo, not just claimed in shipping table?

## §1.7 backward checklist (summary)

Full enumeration: [references/backward-checklist.md](references/backward-checklist.md). Quick form:

0. **Defeat restatement first (T21).** A backward-check that recaps _what the PR did_ — naming only the diff's own files — is a restatement, not a sweep ([`#backward-check-restates-not-sweeps`](../../rules/ai-laziness-traps.md), incident PR #857). When the change has parallel/sibling surfaces, dispatch the cold [`agents/backward-sweep-auditor.md`](../../../.agents/roles/backward-sweep-auditor.md) with **only the change's class** (never the diff/PR) and author the section in the enumeration format (`Class = X; Surfaces where X occurs: [all, with evidence]; per surface SWEPT-CLEAN | GAP-FOUND`). See [references/backward-checklist.md Step 0](references/backward-checklist.md).
1. **Complete sweep of artefacts under new rule's scope** — not §1.5 floor of «3-5 examples» but the _complete_ set. Use `find` / `grep` against the rule's path scope; verify every match is either in compliance or explicitly exempted.
2. **Exemption mechanism explicit** — glob (`packages/*/fixtures/**`) or sentinel marker (`<!-- fixture: with-drift -->`) — pick one, document in rule body.
3. **Exemption itself has meta-test** — positive: exemption preserves intent (file under exemption with intentionally-invalid content does not break enforcement); mutation: removing exemption breaks intent (without exemption, fixture file makes enforcement fail).

## Conditional detail

- At post-close retro time, read [retro prompts and anti-patterns](references/retro-prompts.md) and apply all five prompts to a discipline-introducing recommendation. For case studies use [anti-patterns with examples](references/anti-patterns-with-examples.md).
- When investigating why this gate exists, historical enforcement, or the skill's original self-compliance claims, read [origin and enforcement](references/origin-and-enforcement.md). Those dated claims are provenance, not proof of current runtime behavior.

## See also

- [`.claude/rules/phase-research-coverage.md §1.7`](../../rules/phase-research-coverage.md) — authoritative rule.
- [`docs/meta-factory/research-patches/2026-05-09-recommendation-skips-own-discipline.md`](../../../docs/meta-factory/research-patches/2026-05-09-recommendation-skips-own-discipline.md) — bootstrap exemplar + T7 self-review.
- [CLAUDE.md `Build-vs-reuse invariant`](../../../CLAUDE.md) — capability-commit gate definition.
