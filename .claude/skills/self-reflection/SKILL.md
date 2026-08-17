---
name: self-reflection
description: Use when introducing or extending a rule, principle, pattern, methodology, discipline, or process change in this repository. Auto-trigger on «правило», «принцип», «дисциплина», «методология», «процесс», recommend, introduce rule, new principle, discipline change, process rule, meta, recursive, applies to itself, check own work, self-review, forward check, backward check, closing recommendation, discipline-bearing artefact, self-reflection, anti-pattern, or any edit touching `.claude/rules/`, `packages/core/principles/`, `docs/meta-factory/EXECUTION-PLAN.md`, `docs/meta-factory/prior-art-evaluations.md`, `CLAUDE.md`. Do NOT trigger on simple typo fixes, code edits without rule changes, or routine PR work.
---

# Self-reflection — recommendation discipline gate

> **Authoritative for:** skill activation conditions (frontmatter `description`); §1.7 forward+backward checklist summary; output contract for discipline-introducing recommendations; pointers to cold references.
> **NOT authoritative for:** the §1.7 rule itself — see [`.claude/rules/phase-research-coverage.md §1.7`](../../rules/phase-research-coverage.md). Project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).

## Why this skill exists

Three documented occurrences of the same shape in 2026:

1. **PR #16** — `EXECUTION-PLAN §1` silently re-defined the project goal in the doc that was supposed to _prevent_ drift.
2. **Prior session (4 turns)** — research about applying discipline-from-start, with the assistant repeatedly applying «defer until consumer pain» framing — the _opposite_ of project's thesis, in a session whose subject was project's thesis.
3. **2026-05-09 L3 generated-docs research** — recommendation about doc-authority discipline failed forward+backward checks across 6 existing project disciplines; gap surfaced via reviewer pushback, not via own self-audit pass.

Same root cause: **meta-cognitive blindspot** — the agent of analysis is not also the object of analysis. When the assistant reasons about discipline X, attention loads subject domain + prior art + trade-offs but **does not** load «the act of forming this recommendation must itself pass X».

This skill operationalises the fix: before closing any recommendation that introduces or extends a rule/principle/pattern/discipline, **run §1.7 forward+backward** and ship the recommendation only after both sides pass.

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

0. **Defeat restatement first (T21).** A backward-check that recaps _what the PR did_ — naming only the diff's own files — is a restatement, not a sweep ([`#backward-check-restates-not-sweeps`](../../rules/ai-laziness-traps.md), incident PR #857). When the change has parallel/sibling surfaces, dispatch the cold [`agents/backward-sweep-auditor.md`](../../../agents/backward-sweep-auditor.md) with **only the change's class** (never the diff/PR) and author the section in the enumeration format (`Class = X; Surfaces where X occurs: [all, with evidence]; per surface SWEPT-CLEAN | GAP-FOUND`). See [references/backward-checklist.md Step 0](references/backward-checklist.md).
1. **Complete sweep of artefacts under new rule's scope** — not §1.5 floor of «3-5 examples» but the _complete_ set. Use `find` / `grep` against the rule's path scope; verify every match is either in compliance or explicitly exempted.
2. **Exemption mechanism explicit** — glob (`packages/*/fixtures/**`) or sentinel marker (`<!-- fixture: with-drift -->`) — pick one, document in rule body.
3. **Exemption itself has meta-test** — positive: exemption preserves intent (file under exemption with intentionally-invalid content does not break enforcement); mutation: removing exemption breaks intent (without exemption, fixture file makes enforcement fail).

## Self-reflection prompts (post-close, retro time)

Five prompts from [`phase-research-coverage.md §2`](../../rules/phase-research-coverage.md) — apply at retro for any discipline-introducing recommendation:

1. **When you erred — why?** — moment + cognitive shortcut.
2. **Could you have caught it earlier?** — calibration: one-off vs systemic.
3. **How to not skip it?** — map to §1.1-§1.7 or propose new item.
4. **What is the lesson?** — operationalisable form, not "be more careful".
5. **Did the principle apply to its own design choices?** — recursive-self-application audit.

## Anti-patterns

12 named anti-patterns in [`phase-research-coverage.md §4`](../../rules/phase-research-coverage.md). Most relevant to this skill:

- **`#discipline-application-scope-blindness`** — discipline applied to explicit object-under-review but not extended to (a) self-commentary, (b) meta-commentary that lags primary content, (c) claims from collaborators accepted without verification. Sibling of `#recursive-self-application-gap` in the focus-tunnel family (spatial dimension). Promoted from candidate Wave 8 (§13.24).
- **`#recommendation-skips-own-discipline`** — the parent anti-pattern this skill mitigates.
- **`#recursive-self-application-gap`** — discipline applied bottom-up to outputs, not top-down to design. Sibling of `#discipline-application-scope-blindness` (temporal dimension of focus-tunnel family).
- **`#trigger-sweep`** — armed-but-not-fired §13.x triggers; surfaces during forward-check item 5.

Examples with case studies (PR #16, defer-until-pain, L3 research): [references/anti-patterns-with-examples.md](references/anti-patterns-with-examples.md).

## §1.7 enforcement layers

5 active layers as of Wave 8.1 (2026-05-12). Previously: 4 active layers as of Wave 7 sub-wave 7.6.c (2026-05-11). §13.23 closure shipped layer 4; §13.29 closure shipped layer 5.

<!-- prettier-ignore -->
| Layer                  | Surface                                                                                                                                                                                                            | Mechanism                                                                                                                                                                                                                                               | Status                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1 — Rule prose         | [`.claude/rules/phase-research-coverage.md §1.7`](../../rules/phase-research-coverage.md)                                                                                                                          | Documents the forward+backward check requirement; defines scope and output contract                                                                                                                                                                     | **Active**                                                                   |
| 2 — Skill auto-trigger | This SKILL.md (frontmatter `description`)                                                                                                                                                                          | Claude Code auto-loads skill on keywords like `principle`, `discipline`, and their Russian equivalents (frontmatter triggers), etc.; operationalises the forward+backward check protocol                                                                | **Active**                                                                   |
| 3 — CI workflow        | [`.github/workflows/discipline-self-check.yml`](../../../.github/workflows/discipline-self-check.yml)                                                                                                              | PR-description gate: checks that PRs introducing discipline-bearing artefacts include `### §1.7 Forward-check applied` + `### §1.7 Backward-check applied` sections (≥40 non-whitespace chars each), or a `### §1.7 Skipped: <reason ≥60 chars>` marker | **Active**                                                                   |
| 4 — Pre-push hook      | [`.husky/pre-push` section 9](../../../.husky/pre-push)                                                                                                                                                            | Push-time trailer check: commits that add a `## §` heading to rule/principles/skills files must carry `§1.7:` trailer (C4 scope predicate + D1 warn-only calibration window through 2026-06-10)                                                         | **Active** (shipped Wave 7 7.6.c)                                            |
| 5 — CI substance arm   | [`.github/workflows/discipline-self-check.yml`](../../../.github/workflows/discipline-self-check.yml) `verify-pr-body-sections` + `sanity-stub-fails-substance` + `sanity-stub-backward-passes-with-citation` jobs | **Both** Forward-check **and** Backward-check sections must each contain ≥1 file:line citation (regex `[^[:space:]]+\.[a-z]+:[0-9]+`); paired sanity jobs assert the Incident-1 stub fails the regex and a cited Backward-check passes                  | **Active** (Forward shipped Wave 8.1; Backward-check parity arm added later) |

See [closed-questions.md §13.23](../../../docs/meta-factory/closed-questions.md) for the layer-4 deferral rationale and closure decision. See [closed-questions.md §13.29](../../../docs/meta-factory/closed-questions.md) + [research-patch 2026-05-11](../../../docs/meta-factory/research-patches/2026-05-11-§13.29-substantive-compliance-research.md) for the Wave 8.1 substance-arm rationale.

## How this skill itself complies with §1.7

- **Forward-check applied:** R1-R20 N/A (no TS code in this skill); principle 09 — this skill primary doc carries `Authoritative-for` header above; capability-commit gate — `.claude/skills/` outside `packages/` scope per CLAUDE.md hook definition → not capability commit, escape-hatch trailer required (rationale: skill creation, no new capability per CLAUDE.md hook definition); SSOT — references AIF `/aif-evolve` (entry #8) + Cline Memory Bank pattern (entry #9), both already registered; trigger sweep — applied during research, no §13.x cascade; doc-authority — header present, references will too.
- **Backward-check applied:** complete sweep of `.claude/skills/` — directory empty before this commit (this is the first project-internal skill); no existing entries to migrate. Exemption mechanism: skill is itself an exemption from `.claude/skills/*/SKILL.md` from `principle 09` canonical list (project-internal skills have looser authority than shipped `skills/rules-as-tests/`); flagged as open question for follow-up.
- **Self-reflexive trigger applied:** the [bootstrap research-patch](../../../docs/meta-factory/research-patches/2026-05-09-recommendation-skips-own-discipline.md) walks §1.7 through itself — 6/6 forward + 3/3 backward items independently catch the gap that motivated §1.7.

## See also

- [`.claude/rules/phase-research-coverage.md §1.7`](../../rules/phase-research-coverage.md) — authoritative rule.
- [`docs/meta-factory/research-patches/2026-05-09-recommendation-skips-own-discipline.md`](../../../docs/meta-factory/research-patches/2026-05-09-recommendation-skips-own-discipline.md) — bootstrap exemplar + T7 self-review.
- [CLAUDE.md `Build-vs-reuse invariant`](../../../CLAUDE.md) — capability-commit gate definition.
