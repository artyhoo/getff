# Self-reflection history and enforcement

> **Authoritative for:** the scoped self-reflection history and enforcement detail routed from [the skill card](../SKILL.md).
> **NOT authoritative for:** skill activation, shared gates, or project goal; those remain with the card and its declared owners.

Historical source material preserved from audited SHA `63da1fb35059a892fb634ab02697636dbc1d1976`; dated claims below are not current runtime proof. Apply the card's present routing and verification constraints.

## Why this skill exists

Three documented occurrences of the same shape in 2026:

1. **PR #16** — `EXECUTION-PLAN §1` silently re-defined the project goal in the doc that was supposed to _prevent_ drift.
2. **Prior session (4 turns)** — research about applying discipline-from-start, with the assistant repeatedly applying «defer until consumer pain» framing — the _opposite_ of project's thesis, in a session whose subject was project's thesis.
3. **2026-05-09 L3 generated-docs research** — recommendation about doc-authority discipline failed forward+backward checks across 6 existing project disciplines; gap surfaced via reviewer pushback, not via own self-audit pass.

Same root cause: **meta-cognitive blindspot** — the agent of analysis is not also the object of analysis. When the assistant reasons about discipline X, attention loads subject domain + prior art + trade-offs but **does not** load «the act of forming this recommendation must itself pass X».

This skill operationalises the fix: before closing any recommendation that introduces or extends a rule/principle/pattern/discipline, **run §1.7 forward+backward** and ship the recommendation only after both sides pass.

## §1.7 enforcement layers

5 active layers as of Wave 8.1 (2026-05-12). Previously: 4 active layers as of Wave 7 sub-wave 7.6.c (2026-05-11). §13.23 closure shipped layer 4; §13.29 closure shipped layer 5.

<!-- prettier-ignore -->
| Layer                  | Surface                                                                                                                                                                                                            | Mechanism                                                                                                                                                                                                                                               | Status                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1 — Rule prose         | [`.claude/rules/phase-research-coverage.md §1.7`](../../../rules/phase-research-coverage.md)                                                                                                                          | Documents the forward+backward check requirement; defines scope and output contract                                                                                                                                                                     | **Active**                                                                   |
| 2 — Skill auto-trigger | This SKILL.md (frontmatter `description`)                                                                                                                                                                          | Claude Code auto-loads skill on keywords like `principle`, `discipline`, and their Russian equivalents (frontmatter triggers), etc.; operationalises the forward+backward check protocol                                                                | **Active**                                                                   |
| 3 — CI workflow        | [`.github/workflows/discipline-self-check.yml`](../../../../.github/workflows/discipline-self-check.yml)                                                                                                              | PR-description gate: checks that PRs introducing discipline-bearing artefacts include `### §1.7 Forward-check applied` + `### §1.7 Backward-check applied` sections (≥40 non-whitespace chars each), or a `### §1.7 Skipped: <reason ≥60 chars>` marker | **Active**                                                                   |
| 4 — Pre-push hook      | [`.husky/pre-push` section 9](../../../../.husky/pre-push)                                                                                                                                                            | Push-time trailer check: commits that add a `## §` heading to rule/principles/skills files must carry `§1.7:` trailer (C4 scope predicate + D1 warn-only calibration window through 2026-06-10)                                                         | **Active** (shipped Wave 7 7.6.c)                                            |
| 5 — CI substance arm   | [`.github/workflows/discipline-self-check.yml`](../../../../.github/workflows/discipline-self-check.yml) `verify-pr-body-sections` + `sanity-stub-fails-substance` + `sanity-stub-backward-passes-with-citation` jobs | **Both** Forward-check **and** Backward-check sections must each contain ≥1 file:line citation (regex `[^[:space:]]+\.[a-z]+:[0-9]+`); paired sanity jobs assert the Incident-1 stub fails the regex and a cited Backward-check passes                  | **Active** (Forward shipped Wave 8.1; Backward-check parity arm added later) |

See [closed-questions.md §13.23](../../../../docs/meta-factory/closed-questions.md) for the layer-4 deferral rationale and closure decision. See [closed-questions.md §13.29](../../../../docs/meta-factory/closed-questions.md) + [research-patch 2026-05-11](../../../../docs/meta-factory/research-patches/2026-05-11-§13.29-substantive-compliance-research.md) for the Wave 8.1 substance-arm rationale.

## How this skill itself complies with §1.7

- **Forward-check applied:** R1-R20 N/A (no TS code in this skill); principle 09 — this skill primary doc carries `Authoritative-for` header above; capability-commit gate — `.claude/skills/` outside `packages/` scope per CLAUDE.md hook definition → not capability commit, escape-hatch trailer required (rationale: skill creation, no new capability per CLAUDE.md hook definition); SSOT — references AIF `/aif-evolve` (entry #8) + Cline Memory Bank pattern (entry #9), both already registered; trigger sweep — applied during research, no §13.x cascade; doc-authority — header present, references will too.
- **Backward-check applied:** complete sweep of `.claude/skills/` — directory empty before this commit (this is the first project-internal skill); no existing entries to migrate. Exemption mechanism: skill is itself an exemption from `.claude/skills/*/SKILL.md` from `principle 09` canonical list (project-internal skills have looser authority than shipped `skills/rules-as-tests/`); flagged as open question for follow-up.
- **Self-reflexive trigger applied:** the [bootstrap research-patch](../../../../docs/meta-factory/research-patches/2026-05-09-recommendation-skips-own-discipline.md) walks §1.7 through itself — 6/6 forward + 3/3 backward items independently catch the gap that motivated §1.7.
