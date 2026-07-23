<!-- bridge: skip -->
# beta-docs-showcase — umbrella B kickoff (post-/arch dispatch form)

> **Type:** umbrella kickoff, operator-opened stage sessions (NOT aif — `bridge: skip` is
> load-bearing: execution targets `~/code/getff-landing`, where runtime-bridge is not
> vendored; see design B-D6). Dispatch = operator opens a CC session per stage with this
> file + the design as inputs.
> **Binding design:** [docs/superpowers/specs/2026-07-23-beta-docs-showcase-design.md](../../../docs/superpowers/specs/2026-07-23-beta-docs-showcase-design.md)
> (B-D1..B-D6, stage table §2, F5 carry §0.3). Parent frame:
> [2026-07-23-beta-program-design.md](../../../docs/superpowers/specs/2026-07-23-beta-program-design.md) §5, D4, D5.
> **Base:** landing repo `main` (`13d7fd5` census at design time — re-verify at stage
> entry); this repo `staging` for the two cross-repo PRs (First-Steps SSOT, issue
> templates).
> **Tier:** umbrella Tier 2; BS1 may run executor-tier/night-mode once BS0 is green (B-D6).

## Stages (one PR per stage; gates + evidence = design §2 table, normative)

1. **BS0 — prototype (mandatory first).** Scratch repo `artyhoo/getff-docs-smoke`:
   Fumadocs + Tailwind v4 skeleton with ONE real ported page, static export, GH Pages,
   `beta.getff.ai` (operator DNS step — flag, don't block: github.io fallback carries the
   domain check to BS3 as OPEN). Prototype is site-wide `noindex` (robots meta +
   robots.txt); teardown of deployment + DNS record happens at BS3 close. Gate evidence:
   deployed-URL fetch, Orama search hit, `curl /llms.txt /llms-full.txt /docs/<page>.md`,
   HTTPS, noindex present in fetched HTML. **FAIL → STOP, Starlight
   rollback (parent D5 falsifier-1), umbrella re-plans — do not «fix forward» past the gate.**
2. **BS1 — port skeleton** on branch `fumadocs-migration`: full Next+Fumadocs app; 5 docs
   pages same slugs; landing rebuilt from `redesign-terminal-gates` assets (branch is the
   asset base, NOT merged to main — design B-D2); consulting; blog + `/rss.xml`;
   sitemap/og/CNAME parity. Gate: static build green + URL census resolves on preview +
   two-layer panel renders.
3. **BS2 — content.** Two-layer showcase + daily-cycle pages, First Steps ×3 (SSOT per
   B-D5: **BS2 is the default skeleton owner** — probe C1 state at entry; consume ONLY if
   C1 already landed the SSOT, author it otherwise), python quickstart, beta page, issue
   templates (PR in `artyhoo/getff` = this framework repo, normal staging flow),
   announcement draft:true, **F5 per-claim ledger** (claim → formula →
   evidence-or-experimental-label; formulas quoted in design §0.3), README honest-claims
   patch PROPOSAL via maintainer handoff (the absorbed U8 scope, parent D1 — README is
   maintainer-owned, never edited directly). Blocked-pending:
   A1 profile names (First Steps), A3 tier-home (Degradations page) — ship the rest,
   fast-follow the blocked three (design R-B3).
4. **BS3 — cutover.** PRE-MERGE gate: **independent cold claims audit PASS** — a
   fresh-session cold agent (`claims-conformance-auditor` once umbrella C ships it; until
   then an equivalent compliance-verifier-class run) re-checks the BS2 ledger
   claim-by-claim; the ledger's author never self-certifies (design §2, review MAJOR-1;
   parent §8 phase-2 gate stays the later backstop). Then: merge → `main`, deploy,
   production URL-census parity, RSS/llms/search live, BS0 scratch teardown, **operator
   visual sign-off (genuine fork)**. Announcement publishes only at parent §7 phase 3,
   not here.

## Per-stage session checklist (governance — parent §5: no CI in the landing repo)

- Re-verify design anchors live at entry (parent R5); pre-dispatch in-flight probe
  (CLAUDE.md operational conventions) incl. sibling umbrellas A/C and the C1 SSOT state.
- PR-based flow in `getff-landing`; the stage checklist IS the review artifact; the
  phase-2 `claims-conformance-auditor` assembly gate is the backstop, not the excuse
  (T-BDS-A below).
- Fumadocs/Next specifics: read CURRENT docs at build time (context7/DeepWiki), never
  training memory (T12).
- Umbrella closure: `done.md` here at BS3 merge (CLAUDE.md umbrella-closure convention).

## AI traps (per [.claude/rules/ai-laziness-traps.md §2-§3](../../rules/ai-laziness-traps.md))

Active traps for this umbrella: T3, T7, T12, T16, T19.

- T3/T19 — every gate claim carries command+output evidence in the stage report; own cold
  QA before handoff (BS0 evidence set is enumerated in the design §2 table).
- T7 — the F5 ledger is claim-by-claim against shipped reality, never a section tick.
- T12 — Fumadocs static-export/blog specifics from CURRENT docs, not memory.
- T16 — Fumadocs is ADOPTED for docs UI only; landing, blog/RSS routes, llms generation
  are OUR code — do not assume upstream modules cover them.
- **T-BDS-A (domain):** «the site looks done because the happy path renders» — every
  public claim is probe-backed or labeled experimental; the assembly-gate auditor is the
  backstop, not the excuse.
- **T-BDS-B (domain):** «URL parity assumed from framework defaults» — the §0.2 census is
  checked URL-by-URL with fetches at BS1 preview AND BS3 production; a framework default
  («Fumadocs serves /docs/*») is not evidence for a specific URL.
