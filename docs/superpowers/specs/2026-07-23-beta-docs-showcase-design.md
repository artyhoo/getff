# beta-docs-showcase (umbrella B) — content/IA design

> **Status:** r2 — /arch §2 cold two-altitude review round 1 done (both seats Opus per the
> operator model ladder): bottom-up **GO** (0 BLOCKER/MAJOR; census + cross-refs verified
> against the live clone; 1 MINOR wording fix folded), top-down **REVISE** (2 MAJOR —
> pre-cutover claims gate, SSOT authoring race — + 4 MINOR; all folded in r2, see the
> per-finding markers below). Source prompt: the ARCH-PREP form of
> [beta-docs-showcase/kickoff.md](../../../.claude/orchestrator-prompts/beta-docs-showcase/kickoff.md)
> (rewritten to a dispatch kickoff in this PR).
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

### §0.2 Census (evidence: file paths in the clone, `main` at `13d7fd5`)

- Stack: Astro 7.0.7 + Starlight 0.41.3 (`package.json`), Pagefind search, GH Pages deploy
  from `main` (`.github/workflows/deploy.yml`), CNAME getff.ai.
- **Public URL census (the stability set):** `/`, `/consulting`, `/blog/`,
  `/blog/executable-agents-md`, `/rss.xml` (`src/pages/rss.xml.js`), `/docs/quickstart-ts`,
  `/docs/quickstart-rust`, `/docs/executable-agents-md`, `/docs/faq`, `/docs/limits`,
  `/llms.txt` (static `public/llms.txt`). Sitemap + og-card + favicons exist.
- Hero (deployed): eyebrow «rules as tests», H1 «Docs lie. Tests don't.», terminal panel
  `make self-audit` (`src/pages/index.astro`).
- **Unmerged redesign exists:** branch `redesign-terminal-gates` (origin, 1 commit ahead of
  `main`, `154f2d2`): «terminal-with-gates landing — green/red gate palette, product-first
  hero, mp4 demos». NOT deployed (deploy fires on `main` only). This is a mandatory input
  the ARCH-PREP did not know about — dispositioned in B-D2.
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

- **B-D2 — Landing narrative: keep the hook, reframe around it; the unmerged redesign is
  the asset base.** H1 stays **«Docs lie. Tests don't.»** (deployed brand, matrix-provable,
  the strongest F5-clean claim we own). Eyebrow «rules as tests» → **«AI DX»** (the
  positioning term, parent D4). Subtitle = final tagline (chosen now, D4 candidate 1
  adapted to F5): **«AI DX for your codebase: conventions AI agents can't silently bypass —
  and an AI-run dev environment around them.»** («any AI agent can navigate» from the D4
  candidate is softened: agnosticism is CC+ZCode proven, Cursor docs-verified — «any»
  fails matrix-proven wording until C3 probes cover it. The environment half explicitly
  reads experimental on the panel.) D4 candidate 2 «AI DX on both sides of the keyboard»
  becomes the header of a **two-layer panel** below the hero: left card = Rules from live
  docs (beta badge, links killer-layer docs), right card = The AI factory (experimental
  badge, links factory docs). **`redesign-terminal-gates` is NOT merged to `main`**
  (avoids a double deploy of a stack about to be replaced); its copy, gate palette and mp4
  assets are the design base the BS1 landing rebuild ports (T17/T18: the branch stays in
  git; assets are copied, not linked). *Falsifiers: (1) migration slips >4 weeks past
  kickoff merge → SURFACE to the operator the choice «merge the redesign to `main` now
  (live site gets it, at the cost of two visual overhauls within ~a month once BS3 lands)
  vs keep waiting» — an operator tradeoff, never an automatic merge (r2, top-down
  MINOR-5); (2) operator dislikes the reframed hero at BS3 sign-off → hero copy is a
  1-file revert, layers panel stands.*

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

- **B-D6 — Execution model: in-session per stage, no factory.** Stages run as CC sessions
  (SDD; night-mode allowed for BS1's bulky port) with cwd `~/code/getff-landing`; BS2
  additionally lands two small PRs in `artyhoo/getff` (First-Steps SSOT if C1 hasn't;
  issue templates). The aif factory is NOT used — runtime-bridge is not vendored into the
  landing repo (parent A7 is future work), so the kickoff keeps `<!-- bridge: skip -->`
  and is dispatched by the operator opening stage sessions, not by /pipeline→aif.
  Governance per parent §5: kickoff-encoded per-stage checklists + PR flow in the landing
  repo + the phase-2 assembly gate as backstop. Tier: umbrella = **Tier 2** (IA/claims
  judgment); BS1 alone is Tier-1-shaped (port with a proven skeleton) and may run on the
  executor tier once BS0 is green. *Falsifier: first stage session shows the checklist
  can't carry discipline without hooks → surface to operator; candidate = vendor the
  minimal hook set (parent falsifier: promote claims-check into landing CI).*

## §2 Stage plan (BS0-BS3; one PR per stage in the target repo; each stage re-verifies
anchors live at entry — parent R5)

| Stage | Scope | Gate (evidence per T3/T19: command + output in the stage report) | Deps |
|---|---|---|---|
| **BS0 — prototype** (mandatory, parent D5) | Scratch repo `getff-docs-smoke`: Fumadocs skeleton (2-3 pages incl. ONE real ported page for realistic search), Tailwind v4 co-install probe, static export, GH Pages deploy, `beta.getff.ai` DNS (operator step). Prototype ships site-wide `noindex` (robots meta + robots.txt) — it must never compete with getff.ai in indexes (r2, MINOR-3) | fetched deployed URL; Orama search query returning the ported page; `curl` of `/llms.txt`, `/llms-full.txt`, `/docs/<page>.md`; HTTPS on the subdomain; noindex present in the fetched HTML. **FAIL → STOP: Starlight rollback per parent D5 falsifier-1; umbrella re-plans.** Teardown: scratch deployment + DNS record are removed at BS3 close (tracked in BS3 checklist) | none — startable at kickoff merge |
| **BS1 — port skeleton** | Branch `fumadocs-migration` in `getff-landing`: Next + Fumadocs + Tailwind v4 app; port 5 docs pages (same slugs), landing rebuild from `redesign-terminal-gates` assets (B-D2), consulting, blog + `/rss.xml` (B-D3), sitemap/og/favicons/CNAME parity; deploy workflow updated on the branch, `main` untouched | local `next build` static export green; URL census (§0.2) resolves on preview serve; landing renders the two-layer panel; Fumadocs specifics read from live docs at build (T12) | BS0 green |
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
