<!-- scope: stage kickoff — beta-docs-showcase BS1 (port skeleton). Dispatch input for ONE buildable task in `artyhoo/getff-landing` through aif project `361685f1-6fe0-407d-a492-ebcfa259407f`. The umbrella plan lives in ../beta-docs-showcase/kickoff.md + ../beta-docs-showcase-meta-launch/kickoff.md and is NOT this file's scope. Filename `kickoff-b1.md` = umbrella B, stage 1 (the design's «BS1»): the `kickoff-<letter><digit>` shape is what places it in the stage-kickoff family principle 12's citation gate resolves; `kickoff-bs1.md` would fall outside that family and be silently skipped. No runtime-profile marker is attached, on purpose — see §6. (The literal marker token is deliberately NOT spelled here: `extractProfileHint` scans this header region with a lazy regex, so a kickoff that merely NAMES the token in its header gets a garbage profile hint extracted and the dispatch falls back to ManualBackend — measured 2026-09-02.) -->

# beta-docs-showcase BS1 — port skeleton (full Next + Fumadocs site on a branch)

> **Type:** execution-build, SDD/PAIR, Mode A / autonomous. **Deliverable branch:
> `fumadocs-migration`** in `artyhoo/getff-landing` — the host renames your branch at harvest;
> see §6. **`main` is never touched and this branch never opens a PR against it.**
> **Binding design:** [`docs/superpowers/specs/2026-07-23-beta-docs-showcase-design.md`](../../../docs/superpowers/specs/2026-07-23-beta-docs-showcase-design.md)
> §2 row **BS1**, **§0.2** (URL census), **B-D2** (landing narrative + two-layer panel),
> **B-D3** (blog), **B-D4** (URL stability). On any divergence between this kickoff and the
> spec, **the spec wins** — surface it in the report, never improvise.
> **Umbrella context (read-only):** [`kickoff.md`](kickoff.md) stage 2 +
> [`../beta-docs-showcase-meta-launch/kickoff.md`](../beta-docs-showcase-meta-launch/kickoff.md)
> «Stage 3 — BS1».
> **Stage gate into this stage:** **BS0 GREEN 2026-09-02** — the live gate was quoted against
> the deployed prototype <https://artyhoo.github.io/getff-docs-smoke/> (HTTPS 200, both llms
> routes non-empty and byte-identical to the local build, Orama query on the deployed index
> with a discrimination check, `noindex` in fetched HTML, `.md` twin 200). The Starlight
> rollback (parent D5 falsifier-1) is **not** triggered; B-D6 opens for this stage.
> **Rigor label (effort-worthiness L0):** `build-and-verify`. The deliverable is a branch that
> nothing deploys from — fully reversible, and BS3 is the irreversible step, not this one. The
> rigor lives in the **URL census evidence**, not in extra rounds.
> **You are not starting from zero.** BS0 already built and proved a Fumadocs static-export
> app. Extend it — §2 D1. Re-deriving it from scratch is the wrong answer.

<!-- host-verify: none — this stage authors no executable deliverable in THIS repo. Its deliverable is a branch in `artyhoo/getff-landing` (a repo with no CI, parent §5 governance), and its acceptance commands run inside that repo's container worktree; they are declared in §3 below and their output is quoted in the stage report. -->

## §0 Goal

Stand up the **whole** getff.ai site on Next + Fumadocs + Tailwind v4, on a branch, so that every
URL the live site serves today still resolves — and add the two-layer panel B-D2 specifies. This
is a **port**, not a redesign and not a content stage: the words, assets and routes already exist
on `main`, and your job is to carry them across intact and prove, URL by URL, that nothing was
dropped. A route that quietly disappears is the failure this stage exists to prevent; a
hand-written stand-in for a route the framework was supposed to generate is worse, because it
passes the gate and dies at cutover.

## §1 Do this FIRST — entry re-verification

Facts measured 2026-09-02 from the host and from inside the container. Snapshots: **re-verify,
act on what you find**, and quote command + output for each (T3).

| #   | Fact at authoring                                                                                                                                                                                                                                                                                                                                                                                 | How to re-check                                                                                                                                                                       | If it differs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Container base clone `/home/www/getff-landing` is at `main` = **`b65ff4b`** (= `origin/main`). Your task runs in an **isolated per-task worktree** (`parallelEnabled: true`), not in that clone                                                                                                                                                                                                   | `git -C <your worktree> log --oneline -1`; `git status --short`                                                                                                                       | **A fresh task worktree is NOT clean, and that is normal** — it carries untracked `.ai-factory/` and `AGENTS.md`, which aif puts in every worktree. Those are not dirt and are not a STOP. **STOP and report** only if (a) a **tracked** file shows `M`/`D` in `git status --short`, or (b) your worktree path IS the base clone `/home/www/getff-landing` — that clone additionally carries a modified `package.json` plus ~16 untracked installer entries (`.husky/`, `eslint.config.mjs`, `packages/`, `scripts/`, `.github/workflows/ci.yml` …) which must never enter your commit. Either way: **never `git add -A`** — stage explicit paths |
| 2   | **The BS0 skeleton is reachable inside the container** at ref `feature/beta-docs-showcase-f1010d` (`93948f8`), directory `smoke/`, 24 files                                                                                                                                                                                                                                                       | `git -C <worktree> ls-tree --name-only feature/beta-docs-showcase-f1010d` → must list `smoke/`; `git -C <worktree> ls-tree -r --name-only feature/beta-docs-showcase-f1010d -- smoke` | **Do not look for `origin/bs0-fumadocs-smoke`** — that branch was pushed from the host and the container has no fetch route, so the remote-tracking ref does not exist here. The local `feature/…-f1010d` ref is the same commit. If it is missing too, **STOP and report**: rebuilding the skeleton from scratch is not the fallback, it is a different stage                                                                                                                                                                                                                                                                                    |
| 3   | No `github.com` egress from the container. The npm registry IS reachable and `https://fumadocs.dev` answers                                                                                                                                                                                                                                                                                       | `npm view fumadocs-core version`; `curl -sI https://fumadocs.dev`                                                                                                                     | No registry → **STOP**, report `blocked_external`. No `fumadocs.dev` → still build, but say in the report that T12 could not be satisfied and which facts came from memory                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 4   | Toolchain `node v22.23.1`, `npm 10.9.8`, **no pnpm, no bun**                                                                                                                                                                                                                                                                                                                                      | `node -v; npm -v; pnpm -v`                                                                                                                                                            | Use `npm` only. Do not install a package manager                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 5   | The five docs pages to port live at `src/content/docs/docs/{quickstart-ts,quickstart-rust,executable-agents-md,faq,limits}.md` (44/46/41/106/32 lines; front-matter `title` + `description`)                                                                                                                                                                                                      | `wc -l src/content/docs/docs/*.md`                                                                                                                                                    | Port whatever is actually there; report any count that differs. The **slugs** are the contract, not the line counts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 6   | The redesign assets are on `main` (PR #2, merged 2026-07-10): `public/demo/{doc-drift-gate,violation-blocked}.mp4` + `.poster.webp`, `src/styles/global.css` (497 lines, gate palette), `src/pages/index.astro` (270 lines, hero + terminal panel). `main` also carries `public/{CNAME,robots.txt,llms.txt,og-card.png,favicon-16.png,favicon-32.png,apple-touch-icon.png,logo.png,logo-512.png}` | `ls -la public public/demo; wc -l src/styles/global.css src/pages/index.astro`                                                                                                        | These are **copied, never linked** (B-D2, T17/T18). If one is missing, report it — do not substitute a placeholder asset silently                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 7   | **Production already 301-normalizes extensionless URLs to a trailing slash** — measured on the live site 2026-09-02 from the host: `/docs/faq` → 301 → `/docs/faq/` → 200, and the same for `/consulting`, `/blog/executable-agents-md` and all four other `/docs/*`. `/`, `/blog/`, `/rss.xml`, `/llms.txt`, `/sitemap-index.xml` answer 200 directly                                            | host-side only (`curl -sSL -w '%{http_code} %{url_effective}' https://getff.ai<path>`); the container has no route to getff.ai, so treat this row as **given**                        | This is the row that stops you from "fixing" a non-bug: `trailingSlash: true` (required per §2 D1) reproduces today's production behaviour **exactly**. B-D4's «zero redirects» forbids changing a URL's **shape**, not the trailing-slash normalization the live site already performs. Do **not** add stub pages, and do **not** drop `trailingSlash`                                                                                                                                                                                                                                                                                           |

## §2 Deliverables

Everything lands at the **repository root** of your branch: this branch's root IS the new site.
The Astro app is replaced, not kept alongside — the two cannot share a root `package.json`.

### D1 — The app: BS0's skeleton, lifted to the root and de-smoked

Copy `smoke/**` from ref `feature/beta-docs-showcase-f1010d` (§1 row 2) to the repo root, then
`git rm` the Astro app (`astro.config.mjs`, `src/`, and the Astro entries in the root
`package.json`/`package-lock.json`). **Preservation before deletion is mandatory (T17/T18):** every
page's words, the hero markup, the styles and the blog post must exist in their new home _in the
same commit_ that removes the Astro original. Nothing is truly lost either way — `main` is
untouched and holds all of it — but a commit that deletes before porting is not reviewable.

**Prove the text survived BEFORE you `git rm` anything (§3 row 11).** For each of the five docs
pages and the blog post, diff the ported body against the Astro original with front-matter and
markup stripped — e.g. `diff <(sed '1,/^---$/d;1,/^---$/d' <original>) <(… <ported>)`, or any
comparison that comes out empty on an intact port. The census gate checks that a URL resolves and
that one distinctive phrase is present; it would pass a page that silently lost a paragraph, and
`docs/faq.md` is 106 lines. Deletion is the irreversible half of this stage — measure first.

BS0's skeleton already implements four findings that cost a stage to learn; **keep all four**:
`trailingSlash: true`; the per-page Markdown twin emitted as a physical file from the same source
via a literal route segment (`app/docs/<slug>.md/route.ts` + `getLLMText`) because `rewrites()` has
no static equivalent; `lib/site.ts` with **explicit** `api`/`from` (fumadocs-core's default reads
Vite's `import.meta.env.BASE_URL`, undefined under Next); and search wired through
`provider/next` + `createFromSource` from `search/server` (`oramaStaticClient` is a deprecated
alias for ZBSearch). **Confirm each against live fumadocs.dev at build time (T12)** — a rename
since 2026-09-02 is itself a finding worth a line in the report.

**Five carry-overs that are correct for a scratch prototype and WRONG here. Each is a
production incident if it survives to BS3:**

1. **`robots.txt` says `Disallow: /`** and every page carries `<meta name="robots" content="noindex">`.
   Both must go. Restore `main`'s production `public/robots.txt` verbatim (`User-agent: *` /
   `Allow: /` / `Sitemap: https://getff.ai/sitemap-index.xml`). Shipping the prototype's robots
   rules to `main` at cutover would de-index getff.ai.
2. **`basePath` defaults to `/getff-docs-smoke`.** The target is the apex domain — no basePath.
   Update `lib/site.ts` to match, or search fetches will point at a path that no longer exists.
3. **`turbopack.root` is pinned to the smoke directory** (it was working around the parent repo's
   `package-lock.json`). At the root that pin is either wrong or unnecessary — re-point or drop it,
   and say which in the report.
4. **`package.json` is named `getff-docs-smoke`.** Rename; keep the repo's existing name.
5. **`smoke/.github/workflows/deploy.yml` was written for the scratch repo.** It is superseded by
   D8 — do not leave two deploy workflows.

Tailwind v4 stays (BS0's co-install probe passed). Pin every version you install and quote the
pinned set in the report (T3). The port also needs **`@fontsource/jetbrains-mono`** — a dependency
PR #2 added that the spec's Stack bullet does not name.

### D2 — Five docs pages, same slugs

`/docs/quickstart-ts`, `/docs/quickstart-rust`, `/docs/executable-agents-md`, `/docs/faq`,
`/docs/limits`. Content copied **faithfully** — same prose, same links, same code blocks; only
front-matter is translated to what Fumadocs expects. **Do not rewrite, tighten or "improve" a
sentence.** Sidebar grouping follows B-D1's Getting started / Concepts / Reference shape for the
pages that exist today; the pages B-D1 marks `[new]` belong to BS2 and are **not** created here.

### D3 — Landing, rebuilt from the redesign assets — with the two-layer panel

Port `src/pages/index.astro` (270 lines) to the Next app: hero, the `make self-audit` terminal
panel, the gate palette from `src/styles/global.css`, the mp4 demos with their poster images, the
CTA row, the fineprint, and the `SoftwareApplication` structured data. **B-D2's copy changes, and
only these:**

- H1 stays **«Docs lie. Tests don't.»** (deployed brand, matrix-provable).
- Eyebrow «rules as tests» → **«AI DX»**.
- Subtitle/lede becomes, verbatim: **«AI DX for your codebase: conventions AI agents can't
  silently bypass — and an AI-run dev environment around them.»**
- Below the hero, a **two-layer panel** headed **«AI DX on both sides of the keyboard»**: left card
  = **«Rules from live docs»** with a **beta** badge; right card = **«The AI factory»** with an
  **experimental** badge. («killer»/«environment» are internal jargon and must never render.)

**Write no new capability claims.** The wording above is the approved set; the F5 per-claim ledger
is BS2's deliverable, and a claim invented here would enter the site unledgered. **The panel's
target pages do not exist yet** — they are BS2's. Point each card at a page that exists today
(e.g. the docs quickstart, or the GitHub repo) and leave a comment naming the BS2 target. A dead
internal link is a gate failure (§3 row 6); an invented BS2 page is scope theft.

### D4 — Consulting page

`/consulting` ported from `src/pages/consulting.astro` (25 lines), content unchanged.

### D5 — Blog + `/rss.xml` (B-D3)

The one post (`src/content/blog/executable-agents-md.md`, `pubDate: 2026-07-10`, `draft: false`)
migrates verbatim. Routes `/blog/`, `/blog/executable-agents-md`, `/rss.xml` stay byte-stable **as
routes**. **T16: RSS is our code.** Fumadocs ships no blog module — port the logic from
`src/pages/rss.xml.js` (22 lines) and `src/pages/blog/*.astro` rather than assuming an upstream
feature exists. `/rss.xml` must be a real file in `out/` and must parse as XML.

### D6 — llms routes + per-page Markdown twins

`/llms.txt` **upgrades from a static file to a generated route** (B-D4: same URL, richer content),
plus `/llms-full.txt` and a `/docs/<slug>.md` twin for **each** of the five pages. All generated
from the page set — never hand-typed. Keep `main`'s `public/llms.txt` content as the shape
reference for what the generated `/llms.txt` should say.

### D7 — Parity assets

`public/CNAME` (`getff.ai`) — **must be present in `out/`**, or cutover loses the custom domain.
Favicons, `og-card.png`, `logo*.png`, `apple-touch-icon.png`, the `demo/` mp4s and posters, and the
production `robots.txt`. A **sitemap** must be generated; `main`'s `robots.txt` points at
`/sitemap-index.xml`, so either emit that exact path or update the `Sitemap:` line to match what
you emit — the two must agree, and say in the report which you chose.

### D8 — Deploy workflow, updated on the branch

Update the repo-root `.github/workflows/deploy.yml` for the Next static export: the build output
becomes **`./out`** (it is `./dist` today), keep the pinned action SHAs and the Node 22 setup, and
leave the `on: push: branches: [main]` trigger **unchanged** — it is what keeps this workflow inert
until BS3's cutover. Do not add a trigger for this branch: a second Pages deployment from this repo
would displace production.

## §3 The gate — run it, quote command + output (T2/T3)

Green when ALL of the following pass inside the container.

**Serve the artefact you are judging.** BS0's first verification pass returned six greens against
a server left running from an earlier build. Copy `out/` to a fresh directory, serve it on a port
nothing else is using, probe that, and stop the server afterwards.

| #   | Check                                                                                                                                                                                                                                                                                                              | Passing means                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `npm run build` (static export)                                                                                                                                                                                                                                                                                    | exits 0; `out/` exists                                                                                                                                                                                                                                 |
| 2   | `ls -R out` — paste the route inventory **before** claiming any route exists (T10)                                                                                                                                                                                                                                 | the inventory is in the report                                                                                                                                                                                                                         |
| 3   | Every §0.2 census URL fetched **individually** — `/`, `/consulting`, `/blog/`, `/blog/executable-agents-md`, `/rss.xml`, `/docs/quickstart-ts`, `/docs/quickstart-rust`, `/docs/executable-agents-md`, `/docs/faq`, `/docs/limits`, `/llms.txt` — with `curl -sSL -o /dev/null -w '%{http_code} %{url_effective}'` | **final status 200** for all eleven. A 301 to the trailing-slash form is expected and correct (§1 row 7). A framework default is never evidence for a URL (T-BDS-B)                                                                                    |
| 4   | Content check on each of those eleven, not just status: `<title>` plus a phrase that occurs only on that page                                                                                                                                                                                                      | the page actually rendered. **Do not be fooled by `grep 404`:** Next serialises its not-found template into every page's RSC payload, so `404: This page could not be found.` appears inside healthy pages. Discriminate on `<title>` and body content |
| 5   | Two-layer panel: `grep` the built `out/index.html` for «AI DX on both sides of the keyboard», «Rules from live docs», «The AI factory», the two badges, and the B-D2 subtitle verbatim; confirm «killer»/«environment» appear **nowhere** in `out/`                                                                | the panel renders with the approved copy and no internal jargon leaked                                                                                                                                                                                 |
| 6   | Internal links on the landing resolve: extract every root-relative `href` from `out/index.html` and check each has a corresponding file in `out/`                                                                                                                                                                  | zero dead internal links                                                                                                                                                                                                                               |
| 7   | `/llms.txt` and `/llms-full.txt` non-empty and naming the ported pages; `curl` each `/docs/<slug>.md` twin                                                                                                                                                                                                         | five real Markdown bodies, not HTML shells (`grep -c '<!DOCTYPE\|<html'` → 0)                                                                                                                                                                          |
| 8   | `/rss.xml` parses as XML and contains the post                                                                                                                                                                                                                                                                     | RSS survived the port                                                                                                                                                                                                                                  |
| 9   | **Anti-carry-over:** `grep -ril 'noindex' out/ \| wc -l` → **0**; `cat out/robots.txt` → the production `Allow: /` form; `cat out/CNAME` → `getff.ai`; `grep -r 'getff-docs-smoke' out/ .` → nothing outside `package-lock.json` history                                                                           | none of D1's five carry-overs survived                                                                                                                                                                                                                 |
| 10  | Search: query the built index for a phrase unique to one of the five pages, and a nonsense token                                                                                                                                                                                                                   | the right page comes back; the nonsense token returns nothing (a search that matches everything is not a search)                                                                                                                                       |
| 11  | **Text fidelity, run BEFORE the `git rm` (D1):** for each of the five docs pages and the blog post, an empty diff between the ported body and the Astro original, front-matter and markup stripped                                                                                                                 | no paragraph was silently dropped in the port. Row 3 proves the URL exists and row 4 proves it rendered; only this row proves it still says the same thing                                                                                             |

**On any FAIL:** report the failure with its output and **STOP**. Do not fix forward past the gate,
do not hand-write a file where a framework route was claimed, do not narrow the census.

## §4 Out of scope — and the floors

- **Pushing anything, opening any PR, touching `main`.** Commit locally; the host harvests (§6).
- **Deploying, enabling Pages, or any DNS.** `beta.getff.ai` stays open and non-blocking; the
  github.io fallback carries the domain check to BS3. You have no `github.com` route anyway.
- **BS2's content**: two-layer showcase pages, daily-cycle pages, factory Overview, «What is
  getff», First Steps ×3, python quickstart, beta page, issue templates, the F5 ledger, the
  announcement post. D3 builds the **panel**; the pages it will eventually link to are BS2's.
- **README of the framework repo** — maintainer-owned, never edited (Artifact Ownership Contract).
- **Rewriting ported prose.** This is a port.

If you hit a question only the operator can answer, **park it** and continue with
parkable-independent work, or exit clean. Do not improvise around a floor.

## §5 AI traps ([.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps for this stage: **T2**, **T3**, **T7**, **T10**, **T12**, **T14**, **T16**, **T17**,
**T18**, **T19**.

- **T2** — designing ≠ auditing. Every §3 row is _run_, not described. «Would return 200» is a
  failure; paste the actual status code.
- **T3** — no prose-only findings. Command + output, or `file:line` with the line's content, or an
  explicit `INCONCLUSIVE-…`.
- **T7** — before declaring green, write and run the adversarial counter-prompt: «what would make
  this pass look real when it is not?» (a census URL serving Next's 404 template with status 200;
  a `.md` twin that is an HTML shell; `/rss.xml` that is a 0-byte file; a search index that hits
  because the phrase is in the URL; a panel that greps green because the words are in a comment).
  Check each, report the check.
- **T10** — enumerate before claiming. §3 row 2 comes before every route assertion.
- **T12** — Fumadocs/Next/Tailwind specifics from live docs at build time, never memory. The four
  BS0 findings in D1 are dated 2026-09-02 — confirm, do not assume.
- **T14** — coverage bounds the verdict. «Rows pass» plus «all eleven ran» = green. «Rows pass» plus
  «two rows skipped» = «coverage insufficient to conclude», not green. Say which of the ten ran.
- **T16** — Fumadocs is ADOPTED for the docs UI only. The landing, blog, RSS, llms routes, the
  Markdown twins and the sitemap are **our** code. Do not report a route as framework-provided
  without showing where it came from.
- **T17/T18** — preserve before destructive. The Astro app is deleted in this stage; every word,
  asset and route it carried must land in its new home in the same commit. Verify empirically
  (the §3 census AND row 11's text diff) before deleting, not after.
- **T19** — run your own cold pass over the diff before reporting done: does every §2 deliverable
  exist, and does every §3 row have real output next to it?
- **T-BDS-A (umbrella)** — «the site looks done because the happy path renders». The gate is the
  route set plus content checks, not a screenshot.
- **T-BDS-B (umbrella)** — «URL parity assumed from framework defaults». Row 3 fetches each of the
  eleven URLs individually. «Fumadocs serves `/docs/*`» is not evidence for `/docs/faq`.

## §6 Dispatch + runtime facts (for the dispatching session, not the worker)

- **Project:** `361685f1-6fe0-407d-a492-ebcfa259407f` (`getff-landing`, rootPath
  `/home/www/getff-landing`, `parallelEnabled: true`). The operator shell exports
  `RUNTIME_BRIDGE_AIF_PROJECT_ID=441c1c0c-…` (**`rules-as-tests-aif`**) — dispatching without
  overriding it sends this stage to the wrong project. Override it explicitly on the command,
  and on `probe-inflight.sh` too, or the probe answers about a different repository.
- **No `<!-- bridge-profile: -->` marker, deliberately.** All three modes on this project resolve
  to the executor tier (`53eca24c` plan/review, `088182b8` task) per the operator's GLM-only
  directive of 2026-08-17 (umbrella [`kickoff.md`](kickoff.md) tier line; PR #1446, and
  [`kickoff.decisions.md`](kickoff.decisions.md) Decision 1). A top-tier seat, if a stage needs
  one, is a **host-side** session, never an aif dispatch.
- **Branch naming.** aif names the worker's branch `feature/beta-docs-showcase-<taskid>`; the
  worker cannot and must not rename it. The design's `fumadocs-migration` is achieved **at
  harvest**, by pushing the container commit to that ref from the host — exactly how BS0's
  `bs0-fumadocs-smoke` came to exist.
- **Harvest:** push leg only, from the host, by bundle (`git bundle create` → `docker cp` →
  `git fetch <bundle>` → push). `gh pr create` resolves the repo from cwd (finding F8, meta-launch
  §7.2), so every landing-repo `git`/`gh` command runs from the landing clone, never from the
  framework checkout. **No PR against landing `main`, ever.**
- **`claim.ts cancel` deletes the task record but does not stop the worker** — it runs to
  completion and holds the lane. If a new task sits in `backlog` with apparent free capacity,
  check `docker logs aif-handoff-agent-1 | grep 'broadcast.*404'` for an orphan before concluding
  anything.

## §7 Report format

The stage report is the review artifact (parent §5 — the landing repo has no CI). It must carry:

1. **§1 entry re-verification** — the seven rows, each with the command you ran and its output.
2. **§2 deliverables** — what exists, with pinned versions of every installed package, and an
   explicit line per D1 carry-over (1-5) saying how it was removed.
3. **§3 gate table** — eleven rows, each with the actual command and its actual output, and the
   verdict line: `BS1: GREEN — static export builds, census resolves URL-by-URL, panel renders`
   or `BS1: FAIL — <which row, with output>`.
4. **§5 T7 counter-prompt** — what you wrote, what you ran, what it surfaced.
5. **Findings** — anything Fumadocs could not do statically, any Tailwind-v4 conflict, any drift
   from the four BS0 findings, any census URL whose shape could not be preserved. A finding is a
   success of this stage, not a failure of it.
6. **Parked questions**, if any.
