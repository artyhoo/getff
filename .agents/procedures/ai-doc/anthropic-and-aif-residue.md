# AIF + Anthropic residue — on-demand reference for ai-doc

> Loaded on demand when making portability (`MAKE-PORTABLE`), Class A/B/C, or description-quality decisions. Not in standing context.

## AIF portability pattern (ai-factory, lee-to)

AI-agnostic skill delivery uses three primitives:

- **`AGENT_REGISTRY`** — maps harness name → skill-invocation syntax (e.g. `claude: "Skill(\"rules-as-tests\")"`, `cursor: "@rules-as-tests"`, `universal: "read .claude/skills/rules-as-tests/SKILL.md"`)
- **`{{config_dir}}/{{skills_dir}}`** template-vars — path-portable; consumer fills at install time
- **`universal` fallback** — plain file-read; works in any harness with no registry entry

When a skill is CC-only today but has a real consumer-need for portability (CLAUDE.md §build-vs-reuse — cite a concrete consumer, not hypothetical), add the `<!-- globs: -->` marker and an AIF registry stub.

## Class A / B / C decision table (project-specific)

| Class | Criterion                                   | What is required                                                                                                                 |
| ----- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **A** | Principle test shipped or actively designed | `packages/core/principles/*.test.ts` references the rule slug; test fires on bypass                                              |
| **B** | Compensating mechanism (no CI test)         | An AI-agnostic agent prompt (`agents/*.md`) or a deterministic grep/bash check covers the enforcement gap; no principle test yet |
| **C** | Prose-only, mechanism deferred              | No script gate; promotion criterion stated in the rule (incident-count threshold or explicit trigger)                            |

**Default for new rules:** start at C; promote to B or A when the enforcement mechanism is built. Do not claim A/B without the artefact existing on disk.

## Anthropic description rules (skill `description:` field)

Per Anthropic official guidance:

- **Third-person, "pushy"** — describe who should invoke this and why, not what the skill does in abstract. E.g. «Use when authoring a rule/skill/doc — applies channel-selection + doc-authority discipline» not «A skill for documentation».
- **≤1024 chars** — the description is loaded at session start as a one-line hint; longer ≠ better.
- **Explain the reason** — «Use when X because Y» beats «Tool for X»; the reason helps the agent's routing decision.
- **Triggers** — include the key words/phrases that should fire the skill (per `using-superpowers` SKILL.md pattern).
