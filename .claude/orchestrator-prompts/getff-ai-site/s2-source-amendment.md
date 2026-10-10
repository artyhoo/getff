# SITE-D003 source-placement amendment, round 2

> **Authoritative for:** the bounded SITE-D003 auxiliary source-placement and URL-disposition contract amendment.
> **NOT authoritative for:** project goal, S1 content acceptance, S2 runtime acceptance, main merge or publication; those retain their canonical gates.

Inputs-ref: framework 4849aede80508ebc79e3cccec2398abe0cab5b47; landing bf1ee63a3e49c5bde3632b18652b3845d1d6c1a7. These are contract-review inputs, not prospective cutover pins. Reconcile changed sources before implementation admission.

Authority: delegated operator brief review; chief adjudication of site-decisions-independent-review.md. This amendment supersedes only SITE-D003's unresolved source placement and the contradictory blanket deletion instruction. It preserves URL retention and D14a/D35 for every framework documentation page. No implementation, main merge or publication is approved here.

## Selected source and bounded exception

The single site integration owner authors programme-only prose in ONE landing file, `content/auxiliary/beta.md`. Move retained useful legacy beta prose there before deleting legacy docs. This is a bounded, explicit D35 exception for the non-framework programme surface `/docs/beta`; it is not a new framework page kind, additional framework page population, or permission to author framework docs in landing. D14a's framework source home and D35's docs-quality/refresh ownership remain binding for framework docs.

The prose file owns programme purpose, participation and feedback framing only. Maturity rows, supported installation behavior/commands and current installation links are derived from accepted framework `docs/site/face-facts.json` and canonical pinned pages/nav; they are not independently copied into authored programme prose. Preserve each useful legacy topic as refreshed content or a canonical successor link. If a needed fact is absent from the accepted pin, record a source gap and block that claim; do not invent a landing-side fact copy. Feedback URLs must be checked against the actual accepted repository issue-template surface.

`/docs/reference` has NO authored catalog file. Its page is a deterministic projection of the accepted pinned `docs/site/nav.json` Reference tab and referenced accepted family metadata. Include every accepted Reference family and overview exactly once; include no unaccepted/stub-only destinations. A nav/manifest disagreement is a build failure, not an invitation to maintain a second list. Its title and short navigation framing are renderer labels; all membership comes from the pin.

## Existing loader seam and shared projections

Use the existing `source.config.ts` collection and `lib/source.ts` loader seam. Framework docs still come from the fetched pin. Collect the ONE auxiliary prose source separately from framework docs, and compose its resolved beta page plus the generated Reference index into the ONE normalized source exported by `lib/source.ts`, retaining `/docs` as base URL. Verify the installed Fumadocs source interface before implementing composition; do not invent an API or reimplement a routing system. Detect duplicate URL/slug ownership, including framework collisions, as a build failure.

All declared surfaces consume this normalized source and the same accepted framework pin: HTML catchall, Markdown copy/twins and their `markdownUrl` actions, LLM indexes/full text, search index and docs sitemap. Materialize maturity/install regions and the Reference index once into the resolved page content before projection, so HTML-only injected text cannot disappear from Markdown/LLM/search. Preserve the programme page's existing human URL and .md companion mapping; trailing-slash variants follow the reviewed old-URL map. Auxiliary classification must be explicit in the source metadata and inventory, without claiming a D30 framework kind or admitting it to framework page counts. Both useful retained auxiliary pages belong in the declared LLM/search/sitemap populations; only valid legacy redirect stubs retain R21 exclusions. RSS remains on its existing independent blog source and byte-preservation gate.

## Narrow deletion and authority application

S2 removes obsolete `content/docs/**` only AFTER unique content has been preserved in accepted framework docs or the selected auxiliary source. The selected source is `content/auxiliary/beta.md`, outside that deletion glob; no retained handwritten Reference catalog remains. Remove obsolete handwritten twins only after their dynamic projections/mapped destinations pass the complete old-URL census. Keep search, sitemap and RSS routes under D54. Repointing the main docs collection must not omit the auxiliary collection/normalized-source composition.

Apply `inventory.patch`, `kickoff-s2.patch` and `design-authority.patch` to their pinned paths in a separately reviewed planning/integration commit, together with this amendment at `.claude/orchestrator-prompts/getff-ai-site/s2-source-amendment.md`. Do not add these changes to F1a's16-page implementation diff. The FAQ inventory amendment binds `/docs/faq/` to existing kind `understand`, retains seven topics and records SITE-D002 delegated provenance. It must actually merge to staging before dispatching that writing scope; this packet alone is not staged input. Record this exception beside D35 by a pointer to the accepted amendment, so future readers cannot infer the old blanket statement remains literally unchanged for programme prose.

## Alternatives, falsifier and undo

Alternatives: retire URLs (loses approved useful residue); add programme pages/kinds to framework docs (widens the closed population/quality contract); keep old landing docs/catalog wholesale (duplicates facts); select this narrow auxiliary exception and existing loader composition. The selected option uses the inventory's permitted landing-side alternative and preserves one owner/source for each fact and prose unit.

Wrong if the installed loader cannot compose these sources without a larger interface change, if the pin cannot supply a retained product claim, if the Reference index requires a second catalog, or if any declared projection resolves different content/URLs. In that case return REVISE with pinned interface/source evidence before S2 implementation admission. Undo: supersede this unimplemented packet; after a scoped staging preparation, revert its commit. Preserve legacy source captures and the pre-cutover build/revert receipt.

## Acceptance remains pending

Renewed independent exact-packet review precedes application. Exact implementation-head review must prove source uniqueness, fact/nav pin dependencies, nonvacuous projection parity for both auxiliary routes, duplicate-slug rejection, complete old-URL and Markdown companion coverage, production-config pages-build, freshness/pin behavior, RSS byte equality and green revert rehearsal. Complete accepted S1 remains a predecessor. Normal hooks/CI, D54 KEEP-and-GATE, branch protection/credentials and actual main/publication authorization remain required. Neither this exception nor delegated product-brief approval supplies runtime evidence or waives any boundary.
