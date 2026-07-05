---
description: Doc authority hierarchy — Authoritative-for header spec for canonical docs
paths:
  - ".claude/rules/**"
  - "agents/**"
  - ".claude/skills/**"
  - "packages/core/templates/**"
---

<!-- globs: .claude/rules/**, agents/**, .claude/skills/**, packages/core/templates/** -->
<!-- inject: Rule: every canonical doc must carry an Authoritative-for header. Rule files also need a Class: field. See doc-authority-hierarchy.md §2-§3. -->

# Doc authority hierarchy — discipline rule

> **Class:** A — companion principle test shipped at [packages/core/principles/09-doc-authority-hierarchy.test.ts](../../packages/core/principles/09-doc-authority-hierarchy.test.ts).
> **Fires:** creating/editing any canonical or shipped consumer-facing doc.
> **Authoritative for:** doc-authority-hierarchy discipline rule — §2 doc categorisation, §3 header format spec, §4 four anti-patterns, §5 folder-level authority pattern, §6 promotion / demotion / retirement triggers.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists). Companion principle test — see [packages/core/principles/09-doc-authority-hierarchy.test.ts](../../packages/core/principles/09-doc-authority-hierarchy.test.ts).

> **Origin:** 2026-05-09 goal-hierarchy restructure incident — `EXECUTION-PLAN.md §1` silently re-defined the project's goal as «recursive self-application is the north star», overriding `README.md#why-this-exists`. The drift went uncaught for months because the project had code-level discipline (R1-R20, principles 01-08, build-vs-reuse SSOT, search-coverage rule) but no doc-authority discipline.
>
> **Self-reflection:** the project's own thesis — «documents lie; tests don't» — was scoped to *user code*, never to *its own documentation structure*. Pain-driven discipline accumulation finally surfaced this layer when the drift bit a reviewer cycle. Recursive-self-application gap (anti-pattern `#recursive-self-application-gap` in [phase-research-coverage.md §4](phase-research-coverage.md)) — discipline applied bottom-up to user code, not top-down to own design.
>
> **Companion principle:** [`packages/core/principles/09-doc-authority-hierarchy.test.ts`](../../packages/core/principles/09-doc-authority-hierarchy.test.ts) — executable test enforcing this rule on the canonical doc list.

This rule formalises **doc-authority hierarchy** as a project invariant, parallel to:
- code-level discipline (R1-R20 lint rules)
- decision-level discipline (Prior-art trailers + SSOT)
- search-level discipline ([phase-research-coverage.md](phase-research-coverage.md))

The rule applies to **(a)** canonical project-internal docs and **(b)** shipped consumer-facing artefacts copied to consumer projects via `install.sh` (framework templates, preset rules + arch, sub-agent prompts — see canonical list `REQUIRED_HEADER_DOCS`, defined + exported in the sibling module [`packages/core/principles/09-doc-authority-hierarchy.ts`](../../packages/core/principles/09-doc-authority-hierarchy.ts) and consumed by the [`.test.ts`](../../packages/core/principles/09-doc-authority-hierarchy.test.ts)). Compliance for **runtime-generated** consumer docs (e.g. `RULES.md` produced by AI-driven recipes, not static-copied) remains deferred per [closed-questions.md §13.21](../../docs/meta-factory/closed-questions.md) — that surface is L3 work for Phase 11+.

## §1 Problem this solves

Multi-doc projects accumulate authority drift over time. Operational documents («Phase N plan», «Roadmap», «Architecture decisions») start as scope-bound artifacts but their authors slip into project-wide framings («north star», «central thesis», «main goal»). When two docs describe the same thing differently, downstream readers (humans + AI agents) pattern-match on whichever they read first. AI agents are particularly vulnerable: per [arxiv:2505.02709](https://arxiv.org/html/2505.02709v1), goal drift is caused by pattern-matching on observed authoritative-language in context, not by token-distance forgetting.

The fix is **explicit per-doc authority scope**, declared at the top of every canonical doc:
- *what this doc owns* (Authoritative-for)
- *what falls outside its scope* (NOT authoritative-for, when ambiguity exists)

Conflicting authority claims become detectable at review time and at session-start (Step 0 read).

## §2 When a doc needs Authoritative-for header

**Required for:**
- Project-root docs: `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `INSTALL.md`, `INSTALL-FOR-AI.md`
- Operational reference docs under `docs/meta-factory/*.md` (excluding the transient-by-naming subset below)
- Skill primary docs + cold references: `skills/*/SKILL.md`, `skills/*/references/*.md`
- Hot operational docs: `.claude/session-bootstrap.md`, `.claude/rules/*.md`
- Shipped consumer-facing artefacts copied to consumer projects via `install.sh:89-128`: framework templates under `packages/core/templates/shared/`, preset shared rules + arch under `packages/preset-next-15-canonical/`, sub-agent prompts under `agents/`. Canonical list `REQUIRED_HEADER_DOCS` is defined + exported in the sibling module [`packages/core/principles/09-doc-authority-hierarchy.ts`](../../packages/core/principles/09-doc-authority-hierarchy.ts) (consumed by the [`.test.ts`](../../packages/core/principles/09-doc-authority-hierarchy.test.ts)). Generated-doc compliance trigger ([§13.21](../../docs/meta-factory/closed-questions.md)) — Wave 1 + Wave 2 closure (2026-05-09).

**Folder-level authority (single header in folder README, individual files inherit):**
- `docs/meta-factory/retros/` — closed historical artifacts post-merge; individual files scope-bound by phase ID
- `docs/meta-factory/research-patches/` — one patch per coverage gap, append-only; individual files scope-bound by gap

> **Dynamic enforcement note (2026-07-02):** skill primary docs + cold references under **both** roots (`skills/*` and `.claude/skills/*`: `SKILL.md`, `references/*.md`) are enforced **dynamically** by principle 09 (`enumerateSkillPrimaryDocs` + `REQUIRED_PATH_PATTERNS`, git-aware per the principle-15 pattern) — a new skill is covered the moment it lands, with no static-list edit. Origin: 2026-07-02 delta-audit F2 — `/story` + `/ai-doc` shipped headerless while the static-list-only test stayed green ([research-patches/2026-07-02-doc-audit-delta.md §2](../../docs/meta-factory/research-patches/2026-07-02-doc-audit-delta.md)).

> **Dynamic enforcement note (2026-07-03, M7):** flat rule + agent docs — every `*.md` directly under `.claude/rules/` and `agents/` — are likewise enforced **dynamically** by principle 09 (`enumerateFlatRequiredDocs` + `REQUIRED_PATH_PATTERNS`, git-aware + tracked-only, mirroring the skill mechanism above) — a new rule or agent is covered the moment it lands, with no static-list edit. Origin: M7 drift audit — `kickoff-staging-placement.md`, `recommendation-laziness-discipline.md`, and several `agents/*.md` were required by §2 «Required for» yet absent from the static `REQUIRED_HEADER_DOCS` array, so their header requirement was unenforced while the test stayed green. The static array entries are retained (they double as the `install.sh` SHIPPED_DOCS drift sentinel); the dynamic sweep is the superset that closes the new-file gap.

**Filename-convention authority (no per-file header required — filename itself establishes scope):**
- `docs/meta-factory/PHASE-*-PROMPT.md` and `docs/meta-factory/*-PROMPT.md` (orchestrator/reviewer prompts) — filename indicates phase + transient nature; per-file authority is implicit
- `docs/meta-factory/phase-*-research.md` and `docs/meta-factory/phase-*-entry-research.md` — filename indicates phase entry research scope
- Such filename conventions are **established at the rule level** (this section) rather than at the per-file level. Adding a per-file Authoritative-for header is permitted but not required when the filename is unambiguous about scope. If a transient doc's content unexpectedly extends beyond filename-implied scope, it should grow a per-file header (escape hatch).

**Not required for:**
- Generated artifacts (rules-lock.json, snapshots, fixtures) — they have schema, not prose
- Tests (test names ARE the documentation per «documents lie; tests don't»)
- Code files (TypeScript/JS) — JSDoc comments serve different purpose
- Gitignored dispatch inputs under `.claude/orchestrator-prompts/*/*` — out of project doc surface. **Note the tracked exceptions:** `.gitignore` ignores the directory (`.claude/orchestrator-prompts/*` + `*/*`) but negates back `README.md`, every `*/kickoff.md`, and every `*/done.md` (399 tracked files as of 2026-07-03) — these are **tracked-but-header-exempt** by a deliberate scope decision (they are filename-convention transients, scope-bound by umbrella dir + basename, not authority-bearing canonical docs). This reconciles with [kickoff-staging-placement.md §1](kickoff-staging-placement.md) — kickoffs are *tracked* (read from `staging` by dispatch consumers), yet carry no Authoritative-for header.

## §3 Header format

Insert at the top of the doc, after the title and any existing status block, as a Markdown blockquote:

```markdown
# Doc title

> **Status:** ...                   ← existing status block (if any)
> **Date:** ...
>
> **Authoritative for:** <one-sentence scope statement>.
> **NOT authoritative for:** <when ambiguity exists — what falls outside>; see [<canonical doc>](path).
```

**Scope statement style:**
- Specific, not «everything related to X»
- Names the artifact type (e.g. «phase 9 acceptance criteria», «6-layer architecture description», «build-vs-reuse SSOT register»)
- Mentions canonical authority for what's NOT in scope (e.g. «NOT authoritative for project goal — see [README.md#why-this-exists](../../README.md#why-this-exists)»)

**Examples** (from goal-hierarchy restructure, 2026-05-09):

| Doc | Authoritative for | NOT authoritative for |
|---|---|---|
| README.md `§Why this exists` | project goal, methodology, design invariants | (root authority — owns what others delegate to) |
| CLAUDE.md | AI-tooling conventions, capability-commit gates, build-vs-reuse discipline, Artifact Ownership Contract | project goal — see README#why-this-exists |
| EXECUTION-PLAN.md | phase scope, sequencing, acceptance criteria, operational decisions | project goal — see README#why-this-exists |
| PROPOSAL.md | design history and original architectural proposal (Phase 0.5 – 1.D snapshot, May 2026) — **FROZEN** | current goal hierarchy (see README); do not retroactively rewrite |
| .claude/session-bootstrap.md | operational restatement of goal + invariants for AI session start | (delegates upward — operational artifact) |

**Rule-files Class field (`.claude/rules/*.md`):**

In addition to the Authoritative-for header, rule files under `.claude/rules/*.md` carry a `> **Class:**` line declaring their executable-artifact status — `A` (principle test shipped or actively designed) / `B` (compensating mechanism without test) / `C` (prose-only, mechanism deferred with explicit promotion criterion). The field documents the gap between [README.md#why-this-exists](../../README.md#why-this-exists) absolutism («every rule = executable artifact») and current practice per [research-patches/2026-05-16-readme-absolutism-vs-class-c-practice.md](../../docs/meta-factory/research-patches/2026-05-16-readme-absolutism-vs-class-c-practice.md). Class field placed as first line of the blockquote header, before Authoritative-for.

## §4 Anti-patterns

- **`#operational-doc-redefines-goal`** — operational doc (EXECUTION-PLAN, ROADMAP, phase prompt) introduces «north star» / «central thesis» / «main goal» language. Authority creep — surface as a coverage-gap patch.
- **`#missing-authority-header`** — canonical doc has no Authoritative-for declaration. Default-implicit authority leaves scope ambiguous; future readers (and AI agents) pattern-match on whatever language sounds authoritative.
- **`#contradicting-authority-claims`** — two docs claim authority for the same scope without subordination marker. Resolve by promoting one to authoritative + adding subordinate marker to the other.
- **`#frozen-doc-still-edited`** — doc marked FROZEN (e.g. PROPOSAL.md) receives substantive content edits beyond its scope. Frozen docs may receive ONLY: (a) authority-header updates, (b) typo fixes, (c) link repairs. Substantive content updates require either un-freezing (with rationale) or moving content to a current authoritative doc.

## §5 Folder-level authority pattern

For directories with many small files of similar shape (retros, research-patches, orchestrator-prompts), require **one** `README.md` at the folder root declaring scope:

```markdown
# <Folder name>

> **Authoritative for:** <category description, one sentence>. Individual files are scope-bound by their <key dimension — phase ID / gap ID / etc.>.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](path-up-to-root).
> **Append-only:** ...  ← if applicable
```

Individual files in such folders inherit folder authority and do **not** need their own Authoritative-for header. They MAY include a one-line scope marker at the top (e.g. «Scope: Phase 8 retro»).

## §6 Promotion / demotion / retirement

- **Promotion to mandatory CI gate:** when 3 cross-doc authority drift incidents are surfaced via reviewer cycles within a 6-month window. Promotion path: principle 09 test + (optionally) custom pre-push hook checking that designated authority-bearing docs have valid headers.
- **Widening scope to generated docs:** when [closed-questions.md §13.21](../../docs/meta-factory/closed-questions.md) trigger fires (templates layer L3 work).
- **Retirement:** if no authority drift incident occurs for 12 consecutive months AND principle 09 test reports zero violations across the same window, the rule may be archived to prose guidance in CLAUDE.md (parallel to phase-research-coverage rule §retirement criteria).

## See also

- [packages/core/principles/09-doc-authority-hierarchy.ts](../../packages/core/principles/09-doc-authority-hierarchy.ts) — shared module: `REQUIRED_HEADER_DOCS` + the dynamic enumerators (`enumerateSkillPrimaryDocs`, `enumerateFlatRequiredDocs`) + `REQUIRED_PATH_PATTERNS`.
- [packages/core/principles/09-doc-authority-hierarchy.test.ts](../../packages/core/principles/09-doc-authority-hierarchy.test.ts) — executable principle (consumes the module above).
- [.claude/session-bootstrap.md](../session-bootstrap.md) — Step 0 file linking to README as canonical goal source.
- [CLAUDE.md `Artifact Ownership Contract`](../../CLAUDE.md) — read-only / read-write boundaries per agent class.
- [docs/meta-factory/closed-questions.md §13.21](../../docs/meta-factory/closed-questions.md) — generated-doc compliance trigger (deferred L3 work; closed 2026-05-10, archived).
- [docs/meta-factory/closed-questions.md](../../docs/meta-factory/closed-questions.md) — archive of closed §13.x entries (added 2026-05-12).
- [.claude/rules/phase-research-coverage.md §4 anti-patterns](phase-research-coverage.md) — `#recursive-self-application-gap` related anti-pattern in the focus-tunnel family.
