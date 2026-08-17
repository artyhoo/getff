# beta-docs-showcase (umbrella B) — content/IA design

> **Status:** r3 — B-D6 execution model REVISED by operator directive (2026-07-23,
> post-merge of r2 as #1104): CC-subscription limits must not be spent on B → execution
> is **deferred to the aif factory AFTER A7** (beta-delivery-ux S5) makes foreign-project
> dispatch real; new stage BS-pre (factory wiring for `getff-landing`) added; kickoff
> carries the binding Dispatch gate. r2 review history: /arch §2 round 1 — bottom-up
> **GO** (census + cross-refs verified against the live clone; 1 MINOR folded), top-down
> **REVISE** (2 MAJOR — pre-cutover claims gate, SSOT authoring race — + 4 MINOR; all
> folded); round 2 top-down **GO**. Source prompt: the ARCH-PREP form of
> [beta-docs-showcase/kickoff.md](../../../.claude/orchestrator-prompts/beta-docs-showcase/kickoff.md).
> **Date:** 2026-07-23
> **Authoritative for:** umbrella B's content/IA design — current-site census (§0), decisions
> B-D1..B-D6 (§1), stage plan BS0-BS3 (§2), risks (§3).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> The beta-program frame, D1-D9, umbrella A/C — see
> [2026-07-23-beta-program-design.md](2026-07-23-beta-program-design.md) (parent; this spec
> designs WITHIN its §5 pre-seeded verdicts and never reopens D4/D5). Docs-stack verdict +
> falsifiers — parent D5. Claims formulas — operator plan-v2 F5 (quoted verbatim in §0.3, the
> in-repo carry).

## §0 Inputs + current-site census (recon 2026-07-23, local clone `~/code/getff-landing`)

### §0.1 Pre-seeded verdicts (parent §5; designed WITHIN, not re-litigated)

Fumadocs on Next.js, FULL site migration, static export to GH Pages, $0, custom domain
kept, **prototype stage first** (fail → Starlight rollback); AI DX tagline family (final
wording chosen here — §1 B-D2); two-layer showcase (killer = beta, environment =
experimental); simple First Steps per depth profile, ONE source with C1 (two renders);
python quickstart; beta page + GitHub-issues feedback; README edits via maintainer handoff.

### §0.2 Census (evidence: file paths in the clone, `main` at `733197e` — CORRECTED 2026-08-17; the original census read `13d7fd5` off a working copy that had not fetched)

- Stack: Astro 7.0.7 + Starlight 0.41.3 (`package.json`), Pagefind search, GH Pages deploy
  from `main` (`.github/workflows/deploy.yml`), CNAME getff.ai.
- **Public URL census (the stability set):** `/`, `/consulting`, `/blog/`,
  `/blog/executable-agents-md`, `/rss.xml` (`src/pages/rss.xml.js`), `/docs/quickstart-ts`,
  `/docs/quickstart-rust`, `/docs/executable-agents-md`, `/docs/faq`, `/docs/limits`,
  `/llms.txt` (static `public/llms.txt`). Sitemap + og-card + favicons exist.
- Hero (deployed): eyebrow «rules as tests», H1 «Docs lie. Tests don't.», terminal panel
  `make self-audit` (`src/pages/index.astro`).
- **The redesign is MERGED and DEPLOYED — CORRECTED 2026-08-17 (BS-pre measurement).** Branch
  `redesign-terminal-gates` (`154f2d2`) landed on `main` via **PR #2, merged
  2026-07-10T17:35:49Z** — thirteen days *before* this spec was authored;
  **`git fetch origin && git merge-base --is-ancestor 154f2d2 origin/main`** → true,
  `origin/main` = `733197e`, and the repo has had no push since. **The `git fetch` is part of
  the probe, not decoration:** run without it in `~/code/getff-landing` — the working copy this
  umbrella's own docs point at — the same command returns **false**, because that clone's
  `origin/main` is still the stale `13d7fd5`. That is the defect being corrected, so a probe
  that reproduces it would re-instate the error. The original bullet («unmerged, 1 commit ahead, NOT
  deployed») was measured on a local working copy that had never fetched, so it was already
  false at authoring time. Deploy fires on `main` (`.github/workflows/deploy.yml`), so the
  gate palette, product-first hero layout and the mp4 demos
  (`public/demo/{doc-drift-gate,violation-blocked}.mp4`, replacing the previous `.gif`s) are
  **live on getff.ai today**. What the merge did NOT change, verified against the live page:
  the eyebrow «rules as tests» and H1 «Docs lie. Tests don't.» survive on `main` and in the
  served HTML — so the hero bullet above stands, and so does the URL census (the merge
  touched `src/pages/index.astro`, `src/styles/*`, `public/demo/*` and one blog post; it
  added and removed no route).
- Blog: ONE post (`executable-agents-md`, published 2026-07-10, draft:false), RSS live.
- No GitHub issue templates anywhere; feedback target repo = `artyhoo/getff` (the framework
  repo; landing social links point there).
- Content gap (parent §5 recon confirmed): the site mentions neither live rule generation
  nor the environment layer — showcase debt is content, not only stack.

### §0.3 F5 honest-claim formulas (operator plan-v2, 2026-07-10 — composed verbatim from lines 133+143, EN gloss)

Source: `~/Downloads/getff-ultrareview-2026-07-10-v2/УЛЬТРАРЕВЬЮ-И-ПЛАН-РЕДИЗАЙН-getff-v2-2026-07-10.md:133,143`
(operator-machine file; this section is the in-repo carry the stages cite):

> «Клеймы на анонс: rules-can't-lie — matrix-proven; executable-AGENTS.md — "своё репо,
> milestone"; mutation — по статусу ячейки; cargo — "clippy demo, deny roadmap"».

Operational form: (1) capability claims use **matrix-proven wording** — present tense only
for what a matrix cell / probe demonstrates today; (2) «your AGENTS.md becomes executable»
stays a **milestone** promise (our own repo is the demo) until consumer-side is true;
(3) mutation-testing claims follow the actual matrix-cell status; (4) **no cargo-deny
present tense** — «clippy demo, deny roadmap»; (5) everything environment-layer is labeled
**experimental** until the maintainer's README §Why edit lands (parent §1).

## §1 Decisions (each with falsifier)

- **B-D1 — Information architecture: profile-first Getting Started, then two labeled
  layers.** Sidebar tree (Fumadocs `meta.json` terms; slugs preserve the §0.2 census):

  ```text
  Getting Started
    What is getff            (two layers, honest labels, 1 screen)   [new]
    First Steps — core       (install → first rule fires; 5-min)     [new; SSOT render]
    First Steps — env        (+ /arch → in-session task)  [experimental] [new; SSOT render]
    First Steps — factory    (+ one task through the pipeline) [experimental] [new; SSOT render]
    Quickstart — TypeScript  (/docs/quickstart-ts, kept)
    Quickstart — Python                                              [new]
    Quickstart — Rust        (/docs/quickstart-rust, kept)
  Rules from live docs      ← killer layer, badge «beta»
    Executable AGENTS.md, defined (/docs/executable-agents-md, kept)
    Daily cycle — rules      (how you live with it day-to-day)       [new]
    Honest limits            (/docs/limits, kept)
  The AI factory            ← environment layer, badge «experimental»
    Overview — multi-model pipeline                                  [new]
    Daily cycle — factory    (/arch → preset → status → harvest)     [new]
    Degradations             (render/pointer of A3 tier-home SSOT)   [new; blocked on A3]
  Reference
    FAQ                      (/docs/faq, kept)
  Beta program
    Join the beta            (+ feedback channel)                    [new]
  ```

  Public layer names: killer = **«Rules from live docs»**, environment = **«The AI
  factory»** («killer/environment» stay internal jargon and never render). Badges via
  Fumadocs sidebar-badge support if present at build time, else a `(beta)`/`(experimental)`
  label suffix — decided in BS1 from live docs (T12). *Falsifier: card-sorting against real
  tester questions in phase 3 shows profile-first is wrong → resequence Getting Started;
  URLs don't move. Operator note (review r2, top-down MINOR-4): profile-first IA ships
  publicly UNVALIDATED by real users — a deliberate accepted bet, recorded here so it is
  visible, with phase-3 card-sorting as the check.*

- **B-D2 — Landing narrative: keep the hook, reframe around it; the redesign — merged to
  `main` on 2026-07-10 — is the asset base.** H1 stays **«Docs lie. Tests don't.»** (deployed brand, matrix-provable,
  the strongest F5-clean claim we own). Eyebrow «rules as tests» → **«AI DX»** (the
  positioning term, parent D4). Subtitle = final tagline (chosen now, D4 candidate 1
  adapted to F5): **«AI DX for your codebase: conventions AI agents can't silently bypass —
  and an AI-run dev environment around them.»** («any AI agent can navigate» from the D4
  candidate is softened: agnosticism is CC+ZCode proven, Cursor docs-verified — «any»
  fails matrix-proven wording until C3 probes cover it. The environment half explicitly
  reads experimental on the panel.) D4 candidate 2 «AI DX on both sides of the keyboard»
  becomes the header of a **two-layer panel** below the hero: left card = Rules from live
  docs (beta badge, links killer-layer docs), right card = The AI factory (experimental
  badge, links factory docs). **The redesign is on `main` and live — CORRECTED 2026-08-17
  (BS-pre measurement, §0.2).** The original clause read «`redesign-terminal-gates` is NOT
  merged to `main` (avoids a double deploy of a stack about to be replaced)»; it was false
  when written — PR #2 merged it on 2026-07-10, before this spec existed. The double deploy
  the clause tried to avoid has therefore **already happened**, and BS3's cutover is the
  second overhaul, not a hypothetical one. What survives unchanged: its copy, gate palette
  and mp4 assets are the design base the BS1 landing rebuild ports (T17/T18 — assets are
  copied, not linked), except that BS1 now ports them **from `main`**, not from a side
  branch. *Falsifiers: (1) — RETIRED as to its ACTION, and its trigger is
  residue for the design owner: the falsifier asked the operator to choose «merge the redesign
  now vs keep waiting» if the migration slipped >4 weeks; the merge had already been made
  upstream, so there is no choice left to surface (a live claim about a repository's state was
  never re-probed — the exact `#destination-limit-by-inference` shape,
  [destination-environment-verification.md §1b](../../../.claude/rules/destination-environment-verification.md)).
  **What retiring it drops, stated rather than smuggled:** this was B-D2's only calendar-based
  stall detector, so the umbrella can now stall with getff.ai serving the un-reframed hero
  («rules as tests», not the «AI DX» reframe, which ships only at BS3) and nothing on B-D2
  escalating. Replacing it needs a new escalation, which is a design decision — out of scope
  for a factual correction and left to the design owner rather than invented here;
  (2) operator dislikes the reframed hero at BS3 sign-off → hero copy is a 1-file revert,
  layers panel stands.*

- **B-D3 — Blog: keep, minimal.** The 1 post migrates to fumadocs-mdx blog verbatim; URLs
  `/blog/`, `/blog/executable-agents-md`, `/rss.xml` stay byte-stable as routes (RSS is our
  code on fumadocs-mdx — T16: no upstream blog module is assumed). Phase-3 announcement
  post is DRAFTED in BS2 (draft:true) and published only at parent §7 phase 3 (D2 gate).
  No cadence commitment. *Falsifier: fumadocs-mdx blog cost exceeds a day in BS1 → blog
  stays a 3-file custom Next route (posts are plain MDX either way).*

- **B-D4 — Migration sequencing: prototype in a scratch repo on a subdomain; one
  cutover; zero redirects.** Stage order = BS0 prototype → BS1 port skeleton → BS2 content
  → BS3 cutover (§2). The prototype deploys to a **scratch repo** (`artyhoo/getff-docs-smoke`)
  with GH Pages on **`beta.getff.ai`** (one operator DNS CNAME record) — this proves the
  full chain (static export + Orama search + llms routes + custom domain + HTTPS) without
  touching the live site; the live getff.ai keeps deploying from `main` until BS3. If the
  DNS step is unavailable, the smoke runs on `github.io` and the custom-domain check
  carries to BS3 as an explicitly-open risk (not silently passed). **URL stability rule:**
  every §0.2 census URL keeps working identically after cutover (Fumadocs serves the same
  `/docs/<slug>` shapes; blog/RSS/consulting are ported routes) — **zero redirects**, new
  content only ADDS URLs. `/llms.txt` upgrades from a static file to a generated route
  (+ `/llms-full.txt`, + per-page `.md`) — same URL, richer content. *Falsifier: any census
  URL provably can't keep its shape under static export → a stub page at the old URL
  linking the new one (GH Pages has no server redirects), recorded per URL in BS3's report.*

- **B-D5 — First Steps single source: SSOT in the framework repo, vendored render here;
  BS2 is the DEFAULT skeleton owner.** The three First-Steps sequences (core/env/factory)
  live as ONE source in `artyhoo/getff` — which IS this framework repo (its `origin`;
  local name `rules-as-tests-aif`), NOT a third repo: the SSOT PR rides the normal
  staging flow and disciplines here (r2 — this also closes the top-down MINOR-6
  write-rights question). C1 renders the AI Usage Guide from the same source (parent §5
  «one source of truth, two renders»); the site carries a **vendored render** with a
  provenance header (source path + commit + regen instruction); drift backstop =
  `claims-conformance-auditor` at the parent §8 assembly gate (the landing repo builds NO
  CI, per parent §5 governance). **Authoring-race closure (r2, top-down MAJOR-2): the
  skeleton has ONE named default owner — BS2.** At BS2 entry the session probes C1's
  state (pre-dispatch in-flight probe): if C1 has already authored the SSOT, BS2 consumes
  it; in every other case (not started, in-flight-but-unlanded) BS2 authors the skeleton
  and C1 consumes — «whichever starts first» ordering is retired as under-determined.
  Exact home + format are proposed in BS2's SSOT PR; C-side review of that PR is the
  coordination point. *Falsifier: two-render drift found twice by the auditor → promote a
  deterministic vendor-sync check into the landing repo (parent §5 falsifier).*
  **AMENDED 2026-08-08 (C1 authored it; awaiting maintainer sign-off — see the
  beta-ai-docs-agnosticism S1 PR).** The default-owner rule above settles an authoring
  RACE. It did not consider the case that actually occurred: **B-D6 defers umbrella B's
  execution until after A7**, so BS2 had no schedule, and following B-D5 literally would
  have blocked C1's First-Steps deliverable behind an umbrella with no start date. C1
  probed at S1 entry per the rule's own instruction — `grep -rn "First Steps"
  --include="*.md" .` surfaced no source doc, and `gh pr list --state all --search
  beta-docs-showcase` returned only the design/kickoff PRs #1103/#1104/#1105 — confirming
  BS2 had landed nothing. **C1 therefore authored the SSOT**, at
  `packages/core/templates/shared/first-steps.source.json` (JSON, so neither markdown
  render can be mistaken for the source), with the AI render in
  `packages/core/templates/shared/AI-USAGE-GUIDE.md` §2 and a parity gate at
  `packages/core/audit-self/first-steps-parity.test.ts` comparing the ordered step list
  per depth. **BS2's role is now CONSUME, not author:** vendor the human render from that
  source with the provenance header B-D5 already requires, and change no step without
  surfacing it to C. The «exact home + format proposed in BS2's SSOT PR» clause is
  discharged by this stage's PR, which is the coordination point in its place. Everything
  else in B-D5 — SSOT in the framework repo, vendored render on the site, the
  `claims-conformance-auditor` drift backstop, the falsifier — is unchanged.

- **B-D6 (r3) — Execution model: aif factory AFTER A7; deferred, never CC-in-session.**
  Operator directive (2026-07-23): B must not consume CC-subscription limits, so the r2
  «operator-opened in-session sessions» model is RETIRED. B executes through the aif
  factory once parent A7 (beta-delivery-ux S5 — foreign-project dispatch: runtime-bridge
  subset vendored into the consumer repo, per-project dedup-log) is merged; **umbrella B
  is its first consumer**. New stage **BS-pre** instantiates A7 for `~/code/getff-landing`
  (vendor bridge subset, aif project with landing container base,
  `RUNTIME_BRIDGE_AIF_PROJECT_ID`, per-mode defaults — **all three modes on the executor tier;
  «Plan→top» RETIRED 2026-08-17 by operator directive**, no Claude runtime inside aif, GLM only.
  The tier criteria are untouched; the aif runtime-profile config, which owns which model fills
  which tier, simply holds no Claude profile any more — a top-tier seat is a host-side CC session,
  never an aif dispatch) and smokes ONE no-op task end-to-end. The kickoff carries a binding **Dispatch gate**
  (A7-merged probe + BS-pre green) — until it passes, B is blocked-pending-neighbor and
  nobody opens CC stage sessions for it. Operator-only steps (BS0 DNS, BS3 sign-off) are
  parked via runtime-bridge park/answer. BS2's two framework-repo PRs (First-Steps SSOT,
  issue templates) ride this repo's normal aif flow. `<!-- bridge: skip -->` stays: this
  repo's auto-dispatch targets THIS repo's project; B dispatches via
  `/pipeline beta-docs-showcase` against the landing-side wiring. Governance per parent
  §5 unchanged (checklists + PR flow + assembly-gate backstop). Tier: umbrella **Tier 2**
  (factory defaults); BS1 is Tier-1-shaped — executor-tier line via bridge-profile marker
  on its stage dispatch. *Falsifiers: (1) A7 slips long enough to make B the critical
  path of the parent release frame (§7 phase 2 needs the site) → operator re-opens the
  in-session option as an explicit priority call; (2) A7's shipped form can't wire a
  non-Node-identical repo like the landing → STOP, surface — that finding feeds A7, B
  does not fork a parallel wiring.*

## §2 Stage plan (BS0-BS3; one PR per stage in the target repo; each stage re-verifies
anchors live at entry — parent R5)

| Stage | Scope | Gate (evidence per T3/T19: command + output in the stage report) | Deps |
|---|---|---|---|
| **BS-pre — factory wiring** (r3, B-D6) | Instantiate A7 for `~/code/getff-landing`: vendor runtime-bridge subset via the A7 mechanism (never a parallel reimplementation), aif project with landing container base, env + per-mode defaults | ONE no-op smoke task dispatched → completed → harvested in `getff-landing`; wiring facts recorded in the stage report | **A7 merged** (beta-delivery-ux S5) — hard blocked-pending-neighbor; operator env/key steps parked |
| **BS0 — prototype** (mandatory, parent D5) | Scratch repo `getff-docs-smoke`: Fumadocs skeleton (2-3 pages incl. ONE real ported page for realistic search), Tailwind v4 co-install probe, static export, GH Pages deploy, `beta.getff.ai` DNS (operator step). Prototype ships site-wide `noindex` (robots meta + robots.txt) — it must never compete with getff.ai in indexes (r2, MINOR-3) | fetched deployed URL; Orama search query returning the ported page; `curl` of `/llms.txt`, `/llms-full.txt`, `/docs/<page>.md`; HTTPS on the subdomain; noindex present in the fetched HTML. **FAIL → STOP: Starlight rollback per parent D5 falsifier-1; umbrella re-plans.** Teardown: scratch deployment + DNS record are removed at BS3 close (tracked in BS3 checklist) | BS-pre (r3) |
| **BS1 — port skeleton** | Branch `fumadocs-migration` in `getff-landing`: Next + Fumadocs + Tailwind v4 app; port 5 docs pages (same slugs), landing rebuild from the redesign assets, which live on `main` since PR #2 (B-D2 as corrected 2026-08-17; the port also needs `@fontsource/jetbrains-mono`, the one dependency that merge added and the §0.2 Stack bullet does not name), consulting, blog + `/rss.xml` (B-D3), sitemap/og/favicons/CNAME parity; deploy workflow updated on the branch, `main` untouched | local `next build` static export green; URL census (§0.2) resolves on preview serve; landing renders the two-layer panel; Fumadocs specifics read from live docs at build (T12) | BS0 green |
| **BS2 — content** | Two-layer showcase pages (both «Daily cycle» pages, factory Overview, «What is getff»), First Steps ×3 (B-D5), python quickstart, beta page, issue templates (PR in `artyhoo/getff`), announcement draft (draft:true), **F5 claim pass: per-claim ledger** (claim → formula → evidence-or-experimental-label); README honest-claims **patch PROPOSAL** routed via maintainer handoff (Artifact Ownership) — the U8 scope parent D1 absorbed into B | ledger complete over every public capability claim on the site (T7: claim-by-claim, not a section tick); First-Steps human render mirrors the SSOT 1:1; python quickstart wording matches the live matrix state | BS1; First Steps blocked-pending A1 profile names; Degradations page blocked-pending A3; C1 coordination probe |
| **BS3 — cutover** | Merge `fumadocs-migration` → `main`; deploy; production parity census; announcement stays draft; BS0 scratch teardown | **pre-merge: independent cold claims audit PASS** — a fresh-session cold agent (`claims-conformance-auditor` once umbrella C ships it; until then an equivalent compliance-verifier-class run over the BS2 ledger, claim-by-claim against shipped reality) — the F5 ledger's author never self-certifies the cutover (r2, top-down MAJOR-1; the parent §8 phase-2 assembly gate remains the SECOND, later backstop); every §0.2 URL returns 200 with expected content on getff.ai; `/rss.xml` validates; llms routes live; search live; **operator visual sign-off on the landing (genuine fork — look & feel is operator judgment)** | BS2; cold claims audit PASS; operator GO |

Rollback: `main` history keeps the Starlight site at every stage until BS3's merge; BS3
itself is revertable by a single `git revert` of the merge (static hosting, no data).

## §3 Risks

- **R-B1 — Fumadocs static-export specifics drift from D5 evidence** (Orama pre-render,
  llms routes): absorbed by BS0 being FIRST and cheap (scratch repo); its failure triggers
  the recorded Starlight rollback, not improvisation.
- **R-B2 — claim drift between BS2 and fast-moving track-1** (python lane, matrix cells):
  BS2 ledger snapshots evidence at authoring; the parent §8 assembly gate re-checks at
  phase 2 — wording follows matrix-proven formulas so cells can only get greener.
- **R-B3 — cross-repo coordination (C1 SSOT, A1 names, A3 home)** stalls BS2: the blocked
  items are exactly three sidebar entries; BS2 can ship everything else and leave the three
  as a fast-follow PR within the stage (partial-stage exit recorded in the report).
- **R-B4 — operator DNS/domain steps** (beta subdomain, cutover apex): both are single
  human actions flagged in stage checklists as non-derivable (parent objective 3 posture).

## §4 §1.7 self-reflexive note

Forward: complies with parent D3 (Lego — B touches no A/C surface; coordination is
probe-based), D5 (prototype-first honored as BS0), kickoff-staging-placement (kickoff
merges to staging before any stage session opens), no-paid-llm-in-ci (no CI added
anywhere; the auditor is a session agent), ai-doc/doc-authority (this spec carries the
header block). Backward: supersedes the ARCH-PREP form of
`beta-docs-showcase/kickoff.md` (rewritten to a dispatch kickoff in the same PR);
contradicts no parent decision — B-D2 softens a D4 *candidate wording* under D4's own
«claims stay inside F5» constraint, which D4 explicitly subordinates wording to. The
`redesign-terminal-gates` disposition (B-D2) is new information the parent spec lacked;
it narrows nothing the parent decided.
