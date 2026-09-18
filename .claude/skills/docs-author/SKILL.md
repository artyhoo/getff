---
name: docs-author
description: 'Use when writing or editing any getff.ai docs page under docs/site/ (including the glossary terms.md), when picking a page kind or filling the reader-comfort card, or when running a docs refresh over touched pages — to apply the kind registry, the craft contract, and the docs-check done-checklist. Triggers: write a docs page, new page under docs/site, glossary entry, terms.md, docs refresh, gold page, Diátaxis, задокументировать, страница документации.'
---

<!-- @harness-posture: portable — prose-only authoring standard; the deterministic half it invokes (scripts/docs-check.mjs) ships with the framework and degrades to plain-CLI use without the harness -->

> **Authoritative for:** the docs-author skill — the fixed writing interface for the getff.ai
> docs site: the seven-kind registry, the five reader questions, the craft contract, the
> done-checklist, and the refresh mode. Written per the ai-doc discipline
> ([SKILL.md](../ai-doc/SKILL.md): doc-authority header, harness-posture marker).
> **NOT authoritative for:** project goal — see [README.md](../../../README.md#why-this-exists).
> Diátaxis authoring mechanics — the installed `pfeff/claude-skills` `diataxis` plugin (pointer
> below). The quality contract itself —
> [2026-09-14-getff-ai-docs-quality-contract-design.md](../../../docs/superpowers/specs/2026-09-14-getff-ai-docs-quality-contract-design.md)
> (D-Q2, D-Q8, D-Q13). The deterministic gate — `scripts/docs-check.mjs`.

# docs-author — write a getff.ai docs page (thin wrapper)

## Upstream pointer (never restate)

Authoring mechanics come from the installed `pfeff/claude-skills` `diataxis` plugin, pinned at
`657c61c5ca8c`. Invoke it for what Diátaxis itself teaches (kind selection heuristics,
audience-origin fit). This skill carries ONLY the residue the plugin lacks: the kind registry,
the reader-comfort card, the craft contract, the glossary duty, and the done-checklist. If the
plugin is unreachable or has been reshaped, the fallback is vendoring the pinned tree under
`references/upstream/` (MIT) — never restating its content here (that drift is
`#parallel-evolution-creep`).

Install status: the plugin install is a host hand (`claude plugin install pfeff/claude-skills`),
requested for the docs rollout; until it lands, work from the references below plus
`superpowers:writing-plans` conventions — the references are self-sufficient for the
deterministic gates.

## The seven kinds (closed set — the C13 enum source)

One page = one kind = one `kind:` frontmatter value from the registry. The registry is
[references/page-kinds.md](references/page-kinds.md); `docs-check.mjs` reads the same seven
values, so an unregistered kind fails the page at commit time.

| kind              | one line                                                                           |
| ----------------- | ---------------------------------------------------------------------------------- |
| `reference-sheet` | one artifact, bands A/B/C: generated fact card, explanation, evidence              |
| `family-overview` | one generated table, common-case snippets, when NOT to reach for the family        |
| `learn-tutorial`  | numbered steps, real output per step, ends with what you built                     |
| `guide`           | goal in the title, prerequisites, steps, a runnable verify step, variations        |
| `understand`      | pain, mechanism, proof, honest limit — no steps                                    |
| `face-page`       | one of the eleven product faces; skeleton lives in the face-pages spec, judge-only |
| `glossary`        | terms.md only; frontmatter gate applies, no section skeleton                       |

## The five reader questions (why the card exists)

Every criterion on the card serves one of five reader questions: **FIND** (can the reader find
this page and its siblings), **UNDERSTAND** (do they get why before how), **DO** (can they copy
and run everything), **TRUST** (is it true at the pin, are limits stated), **SAME WORDS** (does
it use the glossary's terms). The card maps all thirteen criteria onto these questions:
[references/criteria-card.md](references/criteria-card.md). You fill the card yourself per
commit (the `Docs-card:` trailer); a separate cold auditor diffs its verdict against yours.

## Craft contract (short form; full version with examples in references/craft.md)

- Why before how: the first paragraph says what the reader gets and why it matters, before any
  mechanism.
- Second person, short sentences, plain friendly English; no unexplained acronym on first use.
- Progressive disclosure: the common case first; edge cases and internals after; callouts only
  for warnings.
- Every example is copy-ready, executed at the pin, and shows its real output. An example lives
  once — other pages link, never paste.
- Punctuation serves the reader; when a sentence needs a dash to hold together, split it.
- Terms as defined in the glossary, first mention linked; forbidden synonyms are named there and
  gated by the name rule.

## Glossary duty

The site glossary is [docs/site/terms.md](../../../docs/site/terms.md) — one file, never a copy.
When you coin a term while writing, add it there first (one-sentence definition, owner page,
`Do not use:` list), then use it. Concept entries are hand-written in region (a); artifact-name
entries render into region (b) from the members registry and are never hand-edited.

## Done-checklist (per page, before commit)

1. Every example executed at the pin and its real output pasted into the page.
2. First mentions of glossary terms link to terms.md.
3. `node scripts/docs-check.mjs <page>` exits 0 (run it from the repo root; an escape needs the
   two-comment form with a reason of at least 20 characters).
4. The commit body carries the `Docs-card:` trailer: every criterion id C1 through C13 with
   `PASS`, `FAIL`, or `N/A` — or the escape `Docs-card: skipped — <reason of at least 20
characters>`. Detection lives in the pre-push gate and CI, not in this prose.

The checklist is prose for the writer; its detection is deterministic (the quality spec, D-Q6
and D-Q16). A gate that never went red is a claim — seed a defect once and watch the gate catch
it before trusting a green.

## `refresh` mode (docs-refresh executor)

When a change at the pin alters an existing page's claims (dependency bump, behavior change,
renamed flag), re-run the done-checklist on the touched pages only: re-execute their examples,
re-paste outputs, re-fill the card, and bump the page's freshness marker. The refresh token for
deferred work stays `docs-refresh: deferred` (checked by the refresh gate, not here). Do not
rewrite untouched pages while nearby — scope is the diff, not the neighborhood.

## Without this skill

Pages under `docs/site/` get written against remembered conventions instead of a fixed
interface: the seven-kind registry exists nowhere the writer can load, cards are filled from
memory (or not at all), and the glossary drifts as each page coins its own spelling for the
same idea. The deterministic gates still fire — `docs-check.mjs`, the `Docs-card:` pre-push
section, the CI arm — but they fire as surprises at commit time, on work that has to be
unpicked and redone, instead of as a checklist the writer held from the first line. Worst
case, a writer restates Diátaxis from general knowledge and the site grows a second, drifting
authoring doctrine next to the pinned plugin's.

## With this skill

One load gives the writer the whole interface: the closed kind registry (with each kind's
required sections), the thirteen-criterion card the commit will be judged by, the craft
contract's long form, the glossary duty with its one-home rule, and the done-checklist with
the exact commands to run. The `refresh` mode scopes rework to the touched pages. Diátaxis
mechanics stay with the pinned upstream plugin — this skill carries only the residue the
plugin lacks, so nothing restates and nothing drifts.

## References (loaded on demand)

- [references/page-kinds.md](references/page-kinds.md) — the registry: required sections per
  kind, band order, the face-page pointer, the glossary carve-out.
- [references/criteria-card.md](references/criteria-card.md) — all thirteen criteria, verbatim,
  with their check types.
- [references/craft.md](references/craft.md) — openers, why-before-how, progressive disclosure,
  callouts, the punctuation sentence, worked examples.
- [references/terms.md](references/terms.md) — pointer to the real glossary (never a copy).
- [references/gold/](references/gold/README.md) — frozen gold pages after the Opus GO; empty
  until then.
