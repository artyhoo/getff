<!-- scope: stage kickoff — beta-docs-showcase BS2 (content). Dispatch input for ONE buildable task in `artyhoo/getff-landing` through aif project `361685f1-6fe0-407d-a492-ebcfa259407f`. The umbrella plan lives in ../beta-docs-showcase/kickoff.md + ../beta-docs-showcase-meta-launch/kickoff.md and is NOT this file's scope. Filename `kickoff-b2.md` = umbrella B, stage 2 (the design's «BS2»): the `kickoff-<letter><digit>` shape is what places it in the stage-kickoff family principle 12's citation gate resolves; `kickoff-bs2.md` would fall outside that family and be silently skipped. No runtime-profile marker is attached, on purpose — see §6. (The literal marker token is deliberately NOT spelled here: `extractProfileHint` scans this header region with a lazy regex, so a kickoff that merely NAMES the token in its header gets a garbage profile hint extracted and the dispatch falls back to ManualBackend — measured 2026-09-02.) -->

# beta-docs-showcase BS2 — content (the pages the skeleton was built to carry)

> **Type:** execution-build, SDD/PAIR, Mode A / autonomous. **Deliverable: new commits on top of
> BS1's branch**, harvested by the host onto `fumadocs-migration` in `artyhoo/getff-landing`
> (§6). **`main` is never touched and this branch never opens a PR against it.**
> **Binding design:** [`docs/superpowers/specs/2026-07-23-beta-docs-showcase-design.md`](../../../docs/superpowers/specs/2026-07-23-beta-docs-showcase-design.md)
> §2 row **BS2**, **B-D1** (information architecture — the sidebar tree below is copied from
> it), **B-D2** (the two-layer panel's target pages), **B-D3** (announcement stays a draft),
> **B-D5 as AMENDED 2026-08-08** (First Steps: CONSUME the C1 SSOT, never author), **§0.3**
> (the five F5 claim formulas — every sentence that claims a capability is bound by them).
> On any divergence between this kickoff and the spec, **the spec wins** — surface it in the
> report, never improvise.
> **Umbrella context (read-only):** [`kickoff.md`](kickoff.md) stage 3 +
> [`../beta-docs-showcase-meta-launch/kickoff.md`](../beta-docs-showcase-meta-launch/kickoff.md)
> «Stage 4 — BS2» + its stage gate «Stage 3 (BS1) → Stage 4 (BS2)».
> **Stage gate into this stage:** **BS1 GREEN + harvested 2026-09-02** — `fumadocs-migration`
> @ `87d1a99e` on `origin` of the landing repo; all eleven census URLs fetched individually
> on the preview serve, plus row 12 (FAQ JSON-LD) — [`BS1-REPORT.md`](https://github.com/artyhoo/getff-landing/blob/fumadocs-migration/BS1-REPORT.md)
> on that branch. Rows 5 and 9 of `kickoff-b1.md` were rewritten by getff#1586 after five
> `KICKOFF-AMBIGUOUS` rounds; the lesson that PR carries («an inverted assertion is a new
> claim and needs its own check») is applied to every §3 row below.
> **Rigor label (effort-worthiness L0):** `build-and-verify` for the pages (a branch nothing
> deploys from; BS3 is the irreversible step) — **but the F5 claims ledger is research-grade**:
> it is the artefact a cold auditor judges before cutover, and a wrong claim on the public
> site is the failure the whole umbrella exists to prevent.
> **You are not starting from zero.** BS1 ported the site, the sidebar, the llms routes, the
> blog with draft filtering, the search. You add pages and re-point two links. Re-deriving
> any of BS1's machinery is the wrong answer; rewriting any of BS1's ported prose is scope theft.

<!-- host-verify: none — this stage authors no executable deliverable in THIS repo. Its deliverable is commits on a branch in `artyhoo/getff-landing` (a repo with no CI, parent §5 governance), and its acceptance commands run inside that repo's container worktree; they are declared in §3 below and their output is quoted in the stage report. The one cross-repo artefact (issue templates) is leg B, host-side, §6. -->

## §0 Goal

Give the ported site the content it was built to carry: the two-layer showcase (B-D1's
«Rules from live docs» / «The AI factory» groups with their «Daily cycle» pages, the factory
Overview and «What is getff»), the three First-Steps pages vendored from the framework's SSOT,
a Python quickstart, the beta page, and the announcement post as a **draft** — every capability
sentence on every one of those pages bound to an F5 formula and written down in a **per-claim
ledger** that a cold auditor will check claim-by-claim before BS3. New content only ADDS URLs
(B-D4): nothing BS1 ported moves, and nothing BS1 ported is reworded.

## §1 Do this FIRST — entry re-verification

Facts measured 2026-09-05 from the host and from inside the container. Snapshots: **re-verify,
act on what you find**, and quote command + output for each (T3).

| #   | Fact at authoring                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | How to re-verify                                                                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Container base clone `/home/www/getff-landing` is at `main` = **`b65ff4b`** (= `origin/main`). Your task runs in an isolated per-task worktree branched from it                                                                                                                                                                                                                                                                                                                                                                        | `git -C /home/www/getff-landing log --oneline -1`; `git branch --show-current`                                                                                                        |
| 2   | **BS1's result is reachable inside the container** at ref `feature/beta-docs-showcase-9bd88c` = **`87d1a99`** (the same commit the host pushed as `fumadocs-migration`). Your FIRST commit-affecting action is `git merge --ff-only feature/beta-docs-showcase-9bd88c` — your branch is fresh off `main`, so it fast-forwards; if it does not, STOP and report                                                                                                                                                                         | `git rev-parse --short feature/beta-docs-showcase-9bd88c`; `git merge --ff-only feature/beta-docs-showcase-9bd88c && git log --oneline -1`                                            |
| 3   | **The framework repo is on the same filesystem** at `/home/www/rules-as-tests-aif` (HEAD `f49e35311c` at authoring, 8 commits behind host `staging`). It carries the C1 SSOT `packages/core/templates/shared/first-steps.source.json`, its AI render `AI-USAGE-GUIDE.md`, and `tier-home.md`. Record the HEAD you read — it goes into every provenance header                                                                                                                                                                          | `git -C /home/www/rules-as-tests-aif log --oneline -1`; `ls -la /home/www/rules-as-tests-aif/packages/core/templates/shared/{first-steps.source.json,AI-USAGE-GUIDE.md,tier-home.md}` |
| 4   | No `github.com` egress from the container. The npm registry IS reachable                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `curl -m 6 -sS -o /dev/null -w '%{http_code}' https://github.com`; `npm view fumadocs-core version`                                                                                   |
| 5   | Toolchain `node v22`, `npm 10`, **no pnpm, no bun**. BS1's lockfile pins next 16.3.4 / fumadocs-core 16.15.4 / fumadocs-ui 16.15.4 / fumadocs-mdx 15.4.0 / tailwindcss 4.3.3 — `npm ci`, never `npm i` (a version move here is a finding, not a task)                                                                                                                                                                                                                                                                                  | `node -v`; `npm ci && npm ls --depth=0`                                                                                                                                               |
| 6   | The BS1 tree: docs pages in `content/docs/*.md`, sidebar in `content/docs/meta.json` (flat, four `---Group---` separators), blog in `content/blog/`, panel cards at `app/(site)/page.tsx:80-90` with two `BS2 target:` comments, llms routes `app/llms.txt/route.ts` + `app/llms-full.txt/route.ts`, per-page twins `app/docs/<slug>.md/route.ts` (one file per page — a new page needs a new twin), `draft` filtered in production by `app/(site)/blog/page.tsx:12-15`, `app/rss.xml/route.ts:21-22`, `app/sitemap-0.xml/route.ts:19` | `ls content/docs content/blog app/docs`; `grep -n 'BS2 target' 'app/(site)/page.tsx'`; `grep -rn draft app/`                                                                          |
| 7   | Production census unchanged: the eleven §0.2 URLs answer 200 on getff.ai (host-side snapshot, given). `main` of the landing repo has not moved since 2026-08-17                                                                                                                                                                                                                                                                                                                                                                        | host-side; inside the container re-verify only row 1                                                                                                                                  |
| 8   | The BS1 stage report's parked question 1 (neutral docs theme at cutover) is **open for the operator at BS3** — it is not yours to answer and not a blocker for content                                                                                                                                                                                                                                                                                                                                                                 | `sed -n '/## 6. Parked/,/## 7/p' BS1-REPORT.md`                                                                                                                                       |

## §2 Deliverables

Everything lands as **new files plus the smallest possible edits** to `content/docs/meta.json`,
`app/(site)/page.tsx` (two `href`s), and the llms/twin routes. Slugs below are fixed by this
kickoff (B-D1 names the pages but not their URLs): they are new URLs and never collide with the
census.

### D1 — Sidebar tree = B-D1, verbatim shape

Replace the flat `meta.json` with the B-D1 tree (Fumadocs `meta.json` / folder `meta.json`
terms — read the CURRENT syntax at fumadocs.dev at build time, T12):

```text
Getting Started
  what-is-getff            What is getff                       [new]
  first-steps-core         First Steps — core                  [new; SSOT render]
  first-steps-env          First Steps — env      (experimental) [new; SSOT render]
  first-steps-factory      First Steps — factory  (experimental) [new; SSOT render]
  quickstart-ts            (kept, untouched)
  quickstart-python        Quickstart — Python                 [new]
  quickstart-rust          (kept, untouched)
Rules from live docs      ← badge «beta»
  executable-agents-md     (kept, untouched)
  daily-cycle-rules        Daily cycle — rules                 [new]
  limits                   (kept, untouched)
The AI factory            ← badge «experimental»
  factory-overview         Overview — multi-model pipeline     [new]
  daily-cycle-factory      Daily cycle — factory               [new]
  degradations             Degradations                        [new; render/pointer of tier-home §3]
Reference
  faq                      (kept, untouched)
Beta program
  beta                     Join the beta                       [new]
More
  Home / Blog / Consulting (kept, untouched)
```

Badges: Fumadocs sidebar-badge support **if present at build time** (quote the doc page you
read), else a `(beta)` / `(experimental)` label suffix on the group name — say which in the
report. The public layer names are exactly «Rules from live docs» and «The AI factory»;
«killer» / «environment» are internal jargon and never render (gate row 6 — the only
permitted «environment» is inside the BS1 lede, which you do not touch).

### D2 — First Steps ×3: VENDORED render of the C1 SSOT (B-D5 AMENDED)

Source: `/home/www/rules-as-tests-aif/packages/core/templates/shared/first-steps.source.json`
(`schema: getff.first-steps/v1`, `sequences.{core,env,factory}`, each with `profileFlag` and
ordered `steps[]`). **You do not author steps, reorder steps, rename steps, or soften a step.**
Each of the three pages:

1. Opens with a **provenance header** as an MDX/HTML comment: source path, the framework
   commit you read (§1 row 3), the sequence id, and the regen instruction («re-vendor from the
   source at the current staging HEAD; do not edit by hand»).
2. Honours the SSOT's **render contract** (quoted from the file's `_note`): for every step, in
   order, a line `<!-- step: <id> -->` immediately followed by a line whose first bold span is
   exactly the step's `title`. That is what makes gate row 8 mechanical.
3. Adds human-voiced connective prose (why this step, what you will see) **around** the steps —
   never inside a title, never a new step. Anything a step's `evidence` field cannot support is
   not written.
4. `env` and `factory` pages carry the **experimental** label in their intro (parent §7 maturity
   labels: killer = public beta, environment = experimental).

If a step is unrunnable against what you can see in the framework clone (an `evidence` path
missing), that is a **FINDING for umbrella C**, written in the report — you do not patch the
page around it.

### D3 — The four showcase pages (the «content, not only stack» debt — parent §5)

Each page is one screen, human-voiced, and **every capability sentence is a ledger row** (D7).
Sources are named so the auditor can check them; write from the source, not from memory (T12).

- **`what-is-getff`** — the two layers with honest labels (beta / experimental), one screen,
  ending in two links: the killer layer's daily cycle and the factory overview. Source of truth
  for the layer split: parent spec §1 + design B-D2 copy set (the lede is already on the
  landing — quote it, do not paraphrase it).
- **`daily-cycle-rules`** — how you live with the rules layer day to day. Source:
  `AI-USAGE-GUIDE.md` §3 «Daily cycle» in the framework clone (the AI render of the same
  loop) — re-voice for a human reader, keep the five beats (before edit / while editing /
  before commit / on push / on PR), keep every command spelled exactly as the guide spells it.
- **`factory-overview`** — the multi-model pipeline in one screen: what a task is, plan →
  implement → review tiers, harvest. Sources: `tier-home.md` §2 (tier criteria) and
  `AI-USAGE-GUIDE.md` §3/§5 in the clone. **Experimental** label in the first paragraph.
- **`daily-cycle-factory`** — `/arch → preset → status → harvest` as a day. Sources: the same
  two files plus `AI-USAGE-GUIDE.md` §6a (rendered launch presets). Experimental label.

### D4 — `quickstart-python`

Mirror the shape of `quickstart-ts` (kept page) for the Python toolchain lane. Source of truth:
`INSTALL-FOR-AI.md` «Python toolchain lane (`install.sh python`)» in the framework clone, and
the consumer-matrix W6 cell `tests/consumer-matrix/python-unfamiliar-stack-cell.sh` (what the
matrix actually proves today). **F5 formula (1)**: present tense only for what that cell
demonstrates; anything beyond it is future tense with the word «planned», and goes into the
ledger as `experimental`/`planned`, never as a claim.

### D5 — `degradations` (render/pointer of the A3 SSOT)

`tier-home.md` §3 «Degradation matrix» is the single owner (A3, resolved). This page is a
**pointer with a short rendered summary**: provenance header (path + commit + regen
instruction, as D2), one paragraph on what a degradation is, then the matrix rows rendered
as a table **copied, not rewritten** (row text verbatim), ending with «the authoritative rows
live in your install at `.ai-factory/tier-home.md` §3». Experimental label.

### D6 — `beta` (Join the beta) + the announcement DRAFT

- `beta`: what the beta is (parent §7 phase 3 shape: happy-path from a link → entry command →
  working pipeline), maturity labels per layer, how to give feedback — the feedback channel is
  **GitHub issue templates in `artyhoo/getff`**: link
  `https://github.com/artyhoo/getff/issues/new/choose` (leg B ships the templates host-side,
  §6; the link resolves either way). No dates, no promises about tester count, no entry
  command that does not exist yet (the `npx getff@latest init` entry is **not published** —
  write «the install command will be announced with the beta» and ledger it as `planned`).
- Announcement: `content/blog/<slug>.md` with **`draft: true`** (the schema at
  `source.config.ts:19-27` already defaults `draft` to false — set it explicitly). BS1's
  production filters (§1 row 6) must keep it out of `/blog/`, `/rss.xml` and the sitemap —
  gate row 10 proves it. Copy follows §0.3 formulas; the killer-layer claims use the
  matrix-proven wording, the environment layer reads experimental, «your AGENTS.md becomes
  executable» stays a milestone with our own repo as the demo. It publishes at parent §7
  phase 3 — never in this umbrella.

### D7 — `CLAIMS-LEDGER.md` at the branch root (the F5 per-claim ledger)

One table, one row per **capability claim** on every page you authored or edited (the four
showcase pages, the three First-Steps pages, python, degradations, beta, the announcement, and
the two panel cards' copy on the landing): `page:line` · the sentence verbatim · the §0.3
formula it satisfies (1-5) · evidence (a framework `file:line` at the commit you read, or a
matrix-cell name, or the SSOT step id) **or** the label `experimental` / `planned`. A sentence
that is neither evidenced nor labelled does not ship — cut it or label it. The ledger opens
with the framework commit you read and the date. **Its author never self-certifies** (design
§2, BS3 pre-merge gate): you write it; a cold seat checks it.

### D8 — Landing panel re-pointed + llms/twins/search extended

- `app/(site)/page.tsx`: the left card `href` → `/docs/daily-cycle-rules/`, the right card
  `href` → `/docs/factory-overview/` (B-D2: killer card links killer-layer docs, environment
  card links factory docs). Remove the two `BS2 target:` comments. **No other change** to that
  file.
- A `app/docs/<slug>.md/route.ts` twin for **each** new page, generated from the same source
  exactly as BS1's five (copy the pattern, do not hand-type Markdown).
- `/llms.txt` and `/llms-full.txt` list every new page (they are generated — verify, do not
  edit by hand). The search index contains the new pages (gate row 11).

### D9 — README honest-claims PROPOSAL (parent D1 / absorbed U8)

The framework `README.md` is **maintainer-owned; you never edit it**. Write the proposal as a
section of your stage report: a unified diff against `/home/www/rules-as-tests-aif/README.md`
at the commit you read (§1 row 3), every changed sentence tied to a ledger row or a §0.3
formula. The host relays it to the maintainer (§6 leg B). If you find nothing to change, say
so and say what you checked.

## §3 The gate — run it, quote command + output (T2/T3)

Green when ALL of the following pass inside the container. **Serve the artefact you are
judging**: `rm -rf out .next && npm run build`, copy `out/` to a fresh directory, serve it on a
port nothing else uses, probe that, stop the server afterwards (BS1's lesson).

| #   | Check                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `npm ci && npm run build` (static export) from clean — exit 0, page count printed                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2   | `ls -R out` — paste the route inventory **before** claiming any route exists (T10)                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 3   | The eleven §0.2 census URLs, fetched **individually** (`curl -sSL -o /dev/null -w '%{http_code} %{url_effective}'`) — unchanged from BS1: 200 each. Then the **eleven new URLs** the same way: `/docs/what-is-getff/`, `/docs/first-steps-core/`, `/docs/first-steps-env/`, `/docs/first-steps-factory/`, `/docs/quickstart-python/`, `/docs/daily-cycle-rules/`, `/docs/factory-overview/`, `/docs/daily-cycle-factory/`, `/docs/degradations/`, `/docs/beta/`, and each new `/docs/<slug>.md` twin |
| 4   | Content check on each new page: `<title>` plus a phrase that occurs only on that page (not in a URL, not in a comment)                                                                                                                                                                                                                                                                                                                                                                               |
| 5   | **Ported prose untouched:** for each of BS1's five docs pages and the blog post, `git diff 87d1a99 -- content/docs/<slug>.md content/blog/executable-agents-md.md` → empty. For `app/(site)/page.tsx`, the diff touches exactly two `href` values and removes two comments — paste the diff                                                                                                                                                                                                          |
| 6   | Sidebar: `out/docs/what-is-getff/index.html` (any docs page) contains the group labels «Getting Started», «Rules from live docs», «The AI factory», «Reference», «Beta program», and the two badges/labels; jargon not leaked: `grep -rl killer out/` → 0 files; every `environment` hit in `out/` sits inside the BS1 lede string or a `_next` chunk that carries it — list the files and show the match context (the former «0 anywhere» form was unpassable, getff#1586)                          |
| 7   | Panel: `grep -o 'href="/docs/[a-z-]*/"' out/index.html` shows the two new targets; both resolve to files in `out/`                                                                                                                                                                                                                                                                                                                                                                                   |
| 8   | **First-Steps parity, mechanical:** for each of core/env/factory, extract the ordered `<!-- step: <id> -->` ids from your page source and the ordered `steps[].id` from the SSOT with a one-liner (`jq` / `node -e`), `diff` them → empty ×3; each page's provenance header names the same commit as §1 row 3                                                                                                                                                                                        |
| 9   | **F5 wording sweep** over every authored page and the announcement: `grep -rniE 'cargo-deny                                                                                                                                                                                                                                                                                                                                                                                                          | any AI agent | guarantee | never fails | 100% | production-ready' content/docs/<new>.md content/blog/<announcement>.md` → 0, or each hit has a ledger row labelled and the sentence reads as a label, not a claim. Paste the command and the hits |
| 10  | **Draft stays a draft:** `grep -rl '<announcement-slug>' out/blog out/rss.xml out/sitemap-0.xml` → 0 files; `grep -c '<item>' out/rss.xml` → 1 (still only the 2026-07-10 post)                                                                                                                                                                                                                                                                                                                      |
| 11  | `/llms.txt` and `/llms-full.txt` name all sixteen docs pages (5 kept + 11 new); `node scripts/verify-search.mjs` (BS1's script) returns a new page for a phrase unique to it and nothing for a nonsense token                                                                                                                                                                                                                                                                                        |
| 12  | **Ledger completeness:** `CLAIMS-LEDGER.md` has ≥1 row per authored page (list the page set and the row count per page); every row has a formula number AND (evidence OR label); `grep -c 'experimental\|planned' CLAIMS-LEDGER.md` printed so the auditor sees the label density                                                                                                                                                                                                                    |
| 13  | Every SSOT step's `evidence` path exists in the framework clone (`test -e` loop over the three sequences) — a miss is a FINDING for umbrella C (D2), recorded, not patched                                                                                                                                                                                                                                                                                                                           |

**On any FAIL:** report the failure with its output and **STOP**. Do not fix forward past the
gate, do not soften a claim to make row 9 pass without moving it into the ledger as a label,
do not narrow the URL list.

## §4 Out of scope — and the floors

- **Pushing anything, opening any PR, touching `main`.** Commit locally; the host harvests (§6).
- **Deploying, Pages, DNS, cutover.** BS3's. The neutral-docs-theme question (§1 row 8) is the
  operator's at BS3 — do not «fix» it by re-adding a palette.
- **Editing any BS1-ported page, the lede, the hero, the blog post, the deploy workflow.**
- **Authoring or changing First-Steps steps** — C1 owns the SSOT (B-D5 AMENDED); a defect there
  is a finding routed to umbrella C, and the vendored render still mirrors the source as-is.
- **The framework repo**: no edit to anything under `/home/www/rules-as-tests-aif` — README
  changes are a PROPOSAL (D9); issue templates are leg B, host-side (§6).
- **Publishing the announcement.** `draft: true` until parent §7 phase 3.
- **Inventing an entry command.** `npx getff@latest init` is not published (U10 open).

If you hit a question only the operator can answer, **park it** (aif park/answer) and continue
with parkable-independent work, or exit clean. Do not improvise around a floor.

## §5 AI traps ([.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps for this stage: **T2**, **T3**, **T7**, **T10**, **T12**, **T14**, **T16**, **T17**,
**T18**, **T19**.

- **T2** — designing ≠ auditing. Every §3 row is _run_, not described. «The ledger covers every
  page» is a failure; paste the per-page row counts.
- **T3** — no prose-only findings. Command + output, or `file:line` with the line's content, or
  an explicit `INCONCLUSIVE-…`.
- **T7** — before declaring green, write and run the adversarial counter-prompt: «what would make
  this pass look real when it is not?» (a claim sentence reworded just enough to dodge row 9's
  regex; a First-Steps page whose step comments match but whose bold titles were "improved"; a
  provenance header naming a commit you did not read; a twin route that serves the HTML shell;
  a draft post that leaks through `llms-full.txt`). Check each, report the check.
- **T10** — enumerate before claiming. Row 2 before any route assertion; the SSOT step list
  before any First-Steps page.
- **T12** — Fumadocs `meta.json`/badge syntax, and every framework fact, from the live doc or
  the clone at build time, never memory. BS1's pinned versions are dated 2026-09-02.
- **T14** — coverage bounds the verdict. «Rows pass» plus «all thirteen ran» = green. A skipped
  row = «coverage insufficient to conclude», not green.
- **T16** — Fumadocs is ADOPTED for docs UI only. The ledger, the vendored renders, the twins,
  the llms routes are **our** code and our responsibility; do not report a page property as
  framework-provided without showing where it came from.
- **T17/T18** — nothing is deleted in this stage. If you believe something must go, keep it and
  write a finding.
- **T19** — run your own cold pass over the diff before reporting done: every §2 deliverable
  present, every §3 row with real output next to it, every ledger row pointing at something
  that exists.
- **T-BDS-A (umbrella)** — «the site looks done because the happy path renders». The gate is
  the route set, the content checks, and the ledger — not a screenshot.
- **T-BDS-B (umbrella)** — «URL parity assumed from framework defaults». Row 3 fetches each of
  the twenty-two URLs individually.
- **T-BDS-C (this stage)** — «a claim without a ledger row». The tempting output is a fluent
  page whose best sentence is unevidenced. Counter: D7 — cut it or label it; row 12 counts.

## §6 Dispatch + runtime facts (for the dispatching session, not the worker)

- **Project:** `361685f1-6fe0-407d-a492-ebcfa259407f` (`getff-landing`, rootPath
  `/home/www/getff-landing`, `parallelEnabled: true`). The operator shell exports
  `RUNTIME_BRIDGE_AIF_PROJECT_ID=441c1c0c-…` (**`rules-as-tests-aif`**) — override it
  explicitly on the dispatch command AND on `probe-inflight.sh`, or both talk to the wrong
  project.
- **No `<!-- bridge-profile: -->` marker, deliberately.** All three modes on this project
  resolve to the executor tier (`53eca24c` plan/review, `088182b8` task) per the operator's
  GLM-only directive of 2026-08-17 (umbrella [`kickoff.md`](kickoff.md) tier line; PR #1446;
  [`kickoff.decisions.md`](kickoff.decisions.md) Decision 1). Do not use `--preset aif`.
- **Pre-dispatch probe reads `DONE-UNHARVESTED`** for f1010da4 (BS0) and 9bd88cae (BS1) —
  both are harvested **as branches without PRs, by design** (no PR against landing `main`
  until BS3). Adjudicate as false positives, record the adjudication, do not re-dispatch them.
- **Branch naming.** aif names the worker's branch `feature/beta-docs-showcase-<taskid>`; the
  worker fast-forwards it onto BS1's `feature/beta-docs-showcase-9bd88c` first (§1 row 2).
  **Harvest = fast-forward `fumadocs-migration`** to the worker's head from the host by bundle
  (`git bundle create` → `docker cp` → `git fetch <bundle>` → `git push origin <sha>:fumadocs-migration`);
  a non-fast-forward means the worker did not start from BS1's head — stop and look.
  Every landing-repo `git`/`gh` command runs from the landing clone
  (`/Users/art/code/aif-handoff/projects/getff-landing`), never from the framework checkout
  (finding F8, meta-launch state §7.4). **No PR against landing `main`, ever.**
- **Leg B (host-side, this session, after leg A is dispatched):** (1) issue templates in
  **this** repo — `.github/ISSUE_TEMPLATE/{bug-report.yml,beta-feedback.yml,config.yml}` on a
  normal staging-flow PR (parent §7 phase 3 «issue templates + feedback channel»; B-D6 «BS2's
  two framework-repo PRs ride this repo's normal flow»); (2) relay the D9 README proposal to the
  maintainer as a handoff, never as an edit; (3) carry §1 row 8 (neutral docs theme) into the
  BS3 kickoff as an operator fork.
- **Stage gate out (meta-launch «Stage 4 → Stage 5»):** the issue-templates PR merged
  (`gh pr list --search "is:merged ISSUE_TEMPLATE base:staging"`), the ledger complete
  claim-by-claim, the vendored First-Steps render mirroring the SSOT 1:1 (row 8 is the
  mechanism at this stage; the framework's own parity test covers the AI render).
- **`claim.ts cancel` deletes the task record but does not stop the worker.** Check
  `docker logs aif-handoff-agent-1 | grep 'broadcast.*404'` for an orphan before concluding a
  lane is free.

## §7 Report format

The stage report is `BS2-REPORT.md` at the branch root (next to `BS1-REPORT.md`) — the review
artefact (parent §5 — the landing repo has no CI). It must carry:

1. **§1 entry re-verification** — the eight rows, each with the command you ran and its output,
   including the framework commit you read.
2. **§2 deliverables** — the page set with slugs, the badge decision with the doc page quoted,
   the SSOT sequence ids per First-Steps page, the announcement slug.
3. **§3 gate table** — thirteen rows, each with the actual command and its actual output, and
   the verdict line: `BS2: GREEN — sixteen docs pages build, census + new URLs resolve
individually, ledger complete, draft stays a draft` or `BS2: FAIL — <which row, with output>`.
4. **§5 T7 counter-prompt** — what you wrote, what you ran, what it surfaced.
5. **Findings** — anything the SSOT could not support (row 13), any Fumadocs `meta.json` /
   badge limitation, any claim you wanted to make and could not evidence (these are the
   umbrella's honest-claims output, not failures).
6. **README honest-claims proposal** (D9) — the unified diff, or «no change» with what you
   checked.
7. **Parked questions**, if any — plus the carried-forward §1 row 8.
