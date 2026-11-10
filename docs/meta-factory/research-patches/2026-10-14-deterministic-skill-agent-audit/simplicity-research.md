# Simplicity, mechanical work and the core — research note

> **Authoritative for:** this dated comparison of the operator's idea with observed getff and companion sources.
> **NOT authoritative for:** an adopted new core rule, an implementation design, deletion authorization or a universal complexity oracle.

## Operator intent

Rules-as-tests is one instance of a wider division of labor: repeatable formal work should run mechanically, leaving model context and judgment for work where they add value. The operator also wants the research to test whether a broad principle of avoiding unnecessary construction belongs in the core. Integration is future work; this session prepares the comparison.

## What already exists in our stack

| Existing owner | Verified content | Boundary |
| --- | --- | --- |
| Base-core **A7**, full inventory `docs/superpowers/specs/2026-09-28-one-button-chain-base-core.md:95` | Mechanically gate detectable conditions; provide context for judgment; use narrow reliable triggers | The shipped status table at `.agents/procedures/getff/references/base-core.md:46` marks this row `not_wired / trigger-to-build`. The idea is codified; broad consumer enforcement is not established |
| Base-core **C2**, full inventory `:131` | One source per fact; generate/pointer docs and check remaining source claims | Current shipped table marks partial coverage; not a universal prose-truth check |
| Base-core **B7**, full inventory `:123` | Formatter ownership, complexity ceilings, shrinking baseline, high-signal review | Narrow code-quality constraints; shipped status `not_wired / generated-pending` |
| Base-core **H2**, full inventory `:216` | Avoid a convenience dependency where the project standardized another | Dependency choice slice, not all architecture |
| Base-core **H6**, full inventory `:220` | Avoid public API inflation | Shipped status `not_wired / trigger-to-build`; no new broad simplicity guarantee |
| Base-core **H12**, full inventory `:226` | Remove orphaned files/exports/dependencies in the relevant change | Shipped status `not_wired / trigger-to-build`; a possible machine-checkable slice |
| Adopted **Superpowers brainstorming**, installed source `.../superpowers/6.4.2/skills/brainstorming/SKILL.md:214` | Remove unnecessary features through YAGNI while developing approaches | Workflow guidance, not a universal structural gate |
| Available own-stack **Matt Pocock codebase-design**, cached source `.../engineering/codebase-design/SKILL.md:61-65` | Small external interface, useful internal depth; deletion counterfactual; evidence that a seam actually varies | Already a strong abstraction-quality candidate in the active skill catalogue; availability alone does not prove every local design contour uses it |
| `.agents/rules/build-first-reuse-default.md:47` | Default adoption/reference; verify actual problem-class match before building | Avoids parallel implementations; stronger than a general “write a script” default |
| `.agents/rules/effort-worthiness.md:22-35` | Evaluate whether process changes move the goal, are substantive/material and cheaper to verify in practice | Guards process/verification complexity, not just production code |

The complete 100-ID full-inventory/status join is preserved in [base-core-index.json](./base-core-index.json). A historical inventory proposal, current delivery status and live rejection of a violation are different evidence levels. Some installed companion paths are outside the repository; a future session must rediscover their active versions rather than assuming this cache remains installed.

## What pstack adds to the discussion

Pinned original: `cursor/plugins@1e5c90a4b6f249917bd21fe361b3a2a7deb741b8`, `pstack/skills/`.

| Principle | Useful emphasis | Applicable limit |
| --- | --- | --- |
| Laziness Protocol, `principle-laziness-protocol/SKILL.md:9-10` | Keep a decision in one home and choose a small sufficient diff | The current upstream leaf has two bullets; the supplied screenshot and richer independent-port leaf are not identical revisions |
| Subtract Before You Add, `principle-subtract-before-you-add/SKILL.md:9-20` | Consider removal first; avoid speculative guards, extra prompts and reference stubs; evolve for observed use | Removal must preserve unique residue, actual consumers and required invariants. This does not override getff's consumer-map requirement |
| Foundational Thinking, `principle-foundational-thinking/SKILL.md:9-21` | Shape data before logic; consolidate structure without abstracting every repeated line; examine concurrent state; build useful foundations incrementally | “First build infrastructure” is justified by real downstream benefit, not hypothetical future users |
| Redesign From First Principles, `principle-redesign-from-first-principles/SKILL.md:9-16` | Evaluate the integrated shape under the new requirement rather than accumulating patches; deliver the change incrementally | A conceptual reconsideration does not automatically authorize a rewrite or work outside accepted scope |
| Build the Lever, `principle-build-the-lever/SKILL.md:8-23` | Re-runnable generators/codemods/checks can replace mechanical agent fan-out; learn one unit and compare generated output against it | First consult existing tools and own seams. A script without a sound oracle can repeat a mistake more reliably |
| Encode Lessons in Structure, `principle-encode-lessons-in-structure/SKILL.md:7-11` | Encode the detectable part of an incident; preserve examples and decision guidance for irreducible judgment | Closely matches getff A7/A17 and attention-is-not-a-mechanism. Reuse the existing owner before adding another principle |

Immutable source links: [Laziness](https://github.com/cursor/plugins/blob/1e5c90a4b6f249917bd21fe361b3a2a7deb741b8/pstack/skills/principle-laziness-protocol/SKILL.md), [Subtract](https://github.com/cursor/plugins/blob/1e5c90a4b6f249917bd21fe361b3a2a7deb741b8/pstack/skills/principle-subtract-before-you-add/SKILL.md), [Foundations](https://github.com/cursor/plugins/blob/1e5c90a4b6f249917bd21fe361b3a2a7deb741b8/pstack/skills/principle-foundational-thinking/SKILL.md), [Redesign](https://github.com/cursor/plugins/blob/1e5c90a4b6f249917bd21fe361b3a2a7deb741b8/pstack/skills/principle-redesign-from-first-principles/SKILL.md), [Lever](https://github.com/cursor/plugins/blob/1e5c90a4b6f249917bd21fe361b3a2a7deb741b8/pstack/skills/principle-build-the-lever/SKILL.md), [Lessons](https://github.com/cursor/plugins/blob/1e5c90a4b6f249917bd21fe361b3a2a7deb741b8/pstack/skills/principle-encode-lessons-in-structure/SKILL.md).

## A candidate meaning to discuss, not a ratified rule

Prefer the simplest structure that completely satisfies the accepted behavior and its required invariants. Before adding a layer, repeated decision or speculative mechanism, check whether removal, an existing capability or a better data/interface shape solves the problem. Evaluate complexity at callers, verification, operation and maintenance as well as inside the implementation.

This possible umbrella meaning has residue beyond a cyclomatic ceiling: it addresses unnecessary protocols, wrappers, prompt templates, state registries and cross-module coordination. Its relationship with the available Matt Pocock deep-module discipline and already adopted procedure owners must be resolved before another owner is introduced.

## Mechanical slices and semantic remainder

| Slice | Machine can establish | Judgment it cannot establish by itself |
| --- | --- | --- |
| Unused code/dependencies | Declared tool's unused-symbol/file/dependency result | Whether reflection, dynamic loading, delivery or an external consumer makes the item necessary |
| Public surface growth | Added exports/parameters/schema fields against a baseline | Whether the additional interface solves accepted behavior more clearly |
| Repeated decisions | Exact duplicate expressions/configuration and related mutation locations | Whether the decisions are semantically equivalent and need one owner |
| Procedural duplication | Same invocation recipe and repeated report arithmetic | Whether exceptions, different host contracts or authority require distinct carriers |
| Complexity metrics | Cycles, dependency edges, cyclomatic values, repeated pass-through forms | Whole-system conceptual burden and whether an abstraction earns its keep |
| Script extraction | Stable input/output identity, adverse controls and repeat execution | Whether the formalized rule captures the right goal and improves net work |

No line-count threshold alone implements simplicity. A module can use more internal code while making every caller simpler. A short script can hide an unsafe transition or a false-positive oracle.

## Concrete discussion examples from this source audit

- Repeated root/argument/exit instructions in 19 skills can reuse existing bindings. A second generic root-discovery engine would add an owner without a demonstrated need.
- Exact-report serialization can be shared across reviewers while each role retains its domain judgment and cold-input contract. Combining all reviewers into one model prompt would obscure those differences.
- HTTP success and valid health JSON are distinct mechanical conditions. Adding the missing exact-status assertion improves correctness; calling it “another unnecessary guard” would abandon the accepted contract.
- Ruff/cargo diagnostic aliases require real per-rule isolation. A smaller universal diagnostic-code wrapper can make the source shorter while making verification unsound.
- Running a known source checker once and returning focused failures can save repeated model work. Running it for every unrelated tool event would add latency and output noise.

## Future evaluation questions

1. Should the broad simplicity criterion be a named core principle, a refinement of existing owners, or only an adopted companion procedure? No decision is made here.
2. Which existing artifacts actually need a new carrier or oracle? Avoid calling a present-but-not-wired principle absent.
3. Can repeated mechanical operations use existing helper seams without a new orchestration framework or another registry?
4. What baseline will demonstrate reduced model input, repeated calls, error rate and maintenance burden while preserving semantic acceptance?
5. Which deletions need consumer maps and residue preservation? Research findings do not authorize those deletions.

### §1.7 Forward-check applied

This note cites existing core A7/B7/C2/H2/H6/H12 owners and adopted companion sources before describing a candidate. Existing reuse default `.agents/rules/build-first-reuse-default.md:47` and attention/judgment boundary `.agents/rules/attention-is-not-a-mechanism.md:20` stand. No new rule, runtime check, capability dependency or implementation was authored. Candidate wording and carrier choice remain discussion material.

### §1.7 Backward-check applied

Class = simplicity/mechanical-work conventions across core inventory, operator rules, adopted skills and external principles. Swept the full 100-ID inventory/status join and relevant own-stack owners, rather than using exact-name absence as proof. Related slices and delivery limitations are listed above; full external principle mapping is prepared in the companion research. No surface is declared compliant with a newly deployed rule, and no artifact is removed.
