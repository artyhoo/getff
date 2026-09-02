<!-- scope: stage kickoff — beta-docs-showcase BS0 (Fumadocs prototype, STOP-gate), LEG A only. Dispatch input for ONE buildable task in `artyhoo/getff-landing` through aif project `361685f1-6fe0-407d-a492-ebcfa259407f`. The umbrella plan lives in ../beta-docs-showcase/kickoff.md + ../beta-docs-showcase-meta-launch/kickoff.md and is NOT this file's scope. Filename `kickoff-b0.md` = umbrella B, stage 0 (the design's «BS0»): the `kickoff-<letter><digit>` shape is what places it in the stage-kickoff family principle 12's citation gate resolves; `kickoff-bs0.md` would fall outside that family and be silently skipped. No runtime-profile marker is attached, on purpose — see §6. (The literal marker token is deliberately NOT spelled here: `extractProfileHint` scans this header region with a lazy regex, so a kickoff that merely NAMES the token in its header gets a garbage profile hint extracted and the dispatch falls back to ManualBackend — measured 2026-09-02.) -->

# beta-docs-showcase BS0 — Fumadocs prototype, leg A (build + in-container gate)

> **Type:** execution-build, SOLO, Mode A / autonomous. **Branch: `bs0-fumadocs-smoke`** in
> `artyhoo/getff-landing`. **`main` is never touched and this branch never opens a PR against it.**
> **Binding design:** [`docs/superpowers/specs/2026-07-23-beta-docs-showcase-design.md`](../../../docs/superpowers/specs/2026-07-23-beta-docs-showcase-design.md)
> §2 row **BS0** + **B-D4**/**B-D5**. On any divergence between this kickoff and the spec, **the spec
> wins** — surface it in the report, never improvise.
> **Umbrella context (read-only):** [`kickoff.md`](kickoff.md) stage 1 +
> [`../beta-docs-showcase-meta-launch/kickoff.md`](../beta-docs-showcase-meta-launch/kickoff.md)
> «Stage 2 — BS0».
> **Stage gate into this stage:** BS-pre GREEN 2026-08-17 (meta-launch §7.4) — satisfied.
> **Rigor label (effort-worthiness L0):** `research-grade`, inherited from the umbrella — BS0's
> verdict decides whether the whole Fumadocs stack survives (parent D5 falsifier-1). Leg A's own
> artefact is a throwaway branch and is fully reversible; the rigor lives in the **evidence**, not
> in extra rounds.
> **Two-leg shape (advisor Decision 2, 2026-09-02).** The scratch repo `artyhoo/getff-docs-smoke`
> named by the design **does not exist** (`gh repo view` → «Could not resolve to a Repository»,
> measured 2026-09-02), the container has no `github.com` route, and creating a public repo under
> the operator's account is an outward-facing act no worker may take. So BS0 splits:
> **leg A (this task)** builds the prototype and proves it in-container; **leg B (host + operator)**
> creates the scratch repo, transplants `smoke/` as its root, enables Pages, and quotes the LIVE
> gate. **Leg A green ≠ BS0 green** — see §3.

<!-- host-verify: none — this stage authors no executable deliverable in THIS repo. Its deliverable is a branch in `artyhoo/getff-landing` (a repo with no CI, parent §5 governance), and its acceptance commands run inside that repo's container worktree; they are declared in §3 below and their output is quoted in the stage report. -->

## §0 Goal

Answer ONE question with evidence: **can a Fumadocs static export actually serve the routes this
project's docs site depends on?** Not «does Fumadocs look nice» — whether `next build` with
`output: 'export'` produces, as real files on disk, the route set the umbrella will later need:
a docs page at a preserved slug, a working client-side search index over real content, `/llms.txt`,
`/llms-full.txt`, and a raw-Markdown twin per docs page. A route the framework cannot produce
statically is the finding this stage exists to surface (risk R-B1). A silent substitute — a
hand-written file where a framework route was claimed, a stub where content was claimed — destroys
the whole point of running BS0 first.

## §1 Do this FIRST — entry re-verification

Facts measured 2026-09-02 from the host. Snapshots: **re-verify, act on what you find**, and quote
command + output for each (T3).

| #   | Fact at authoring                                                                                                                                                         | How to re-check                                                 | If it differs                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Container base clone is `/home/www/getff-landing` at `main` = `733197e`; your task runs in an ISOLATED per-task worktree (`parallelEnabled: true`), not in that clone     | `git -C <your worktree> log --oneline -1`, `git status --short` | If your worktree is dirty at start, or is the base clone itself, **STOP and report** — the base clone carries installer residue (a modified `package.json` + untracked `.ai-factory/`, `.github/workflows/*`) that must never enter your commit |
| 2   | No `github.com` egress from the container; the npm registry IS reachable (`npm view fumadocs-core version` → `16.15.4`) and `https://fumadocs.dev` answers (`HTTP/2 308`) | re-run both                                                     | No registry → **STOP**, report `blocked_external`. No `fumadocs.dev` → still build, but say in the report that T12 could not be satisfied and which facts came from memory                                                                      |
| 3   | Toolchain: `node v22.23.1`, `npm 10.9.8`, **no pnpm, no bun**                                                                                                             | `node -v; npm -v; pnpm -v`                                      | Use `npm` only. Do not install a package manager                                                                                                                                                                                                |
| 4   | `core.hooksPath` is unset in the landing clone → no commit hooks fire                                                                                                     | `git -C <worktree> config core.hooksPath`                       | If set, do NOT unset it globally; report it                                                                                                                                                                                                     |
| 5   | The real page you must port is `src/content/docs/docs/executable-agents-md.md` (41 lines, front-matter `title`/`description`)                                             | `head -6 src/content/docs/docs/executable-agents-md.md`         | If absent, port `src/content/docs/docs/limits.md` instead and say so                                                                                                                                                                            |
| 6   | The existing site is Astro + Starlight; its public slug for that page is `/docs/executable-agents-md`                                                                     | `ls src/content/docs/docs/`                                     | The slug is the contract — preserve it exactly (design §0.2 census)                                                                                                                                                                             |

## §2 Deliverables

Everything lands under a single new top-level directory **`smoke/`**, laid out as the **future root
of the scratch repo** `artyhoo/getff-docs-smoke` — its own `package.json`, its own
`.github/workflows/`, its own `.gitignore`. Leg B then transplants `smoke/` to that repo's root as a
plain copy. **Nothing outside `smoke/` is modified** — not the Astro app, not the root
`package.json`, not `.github/`, not `public/`.

### D1 — Fumadocs + Tailwind v4 skeleton, static export

- Next.js app with Fumadocs, `output: 'export'` (fully static — no server routes, no ISR).
- Tailwind v4 co-installed and actually applied (the design calls this a co-install probe: if
  Tailwind v4 and Fumadocs's styling conflict, that IS the finding — report it, do not paper over it).
- `basePath` driven by an env var, defaulting to the **project-page** form
  (`/getff-docs-smoke`), because leg B's first deployment is `artyhoo.github.io/getff-docs-smoke`.
  The apex `beta.getff.ai` is an operator DNS step deferred to leg B (design: «flag, don't block»).
- **Pin every version you install and quote the pinned versions in the report** (T3). Read the
  Fumadocs API from `https://fumadocs.dev` **at build time**, never from training memory (T12) —
  Fumadocs's static-export and search wiring have changed across minors.

### D2 — Pages: 2-3 total, exactly ONE of them a real port

- The real port: `src/content/docs/docs/executable-agents-md.md` → served at the **same slug**
  `/docs/executable-agents-md`. Content copied faithfully; front-matter translated to whatever
  Fumadocs expects. Real content matters because it is what search is tested against.
- 1-2 trivial pages to give the sidebar and search something to disambiguate against.

### D3 — Search (Orama), proven against real content

Fumadocs's static/client search over the exported build. The acceptance is not «search is
configured» — it is **a query for a phrase that exists only in the ported page returns that page**
(§3). If static export cannot carry a working index, that is a headline finding.

### D4 — llms routes + raw-Markdown twins

- `/llms.txt` and `/llms-full.txt`, both **non-empty** and both generated from the page set (not
  hand-typed placeholders).
- `/docs/<slug>.md` — the raw-Markdown twin of each docs page, as a real file in the export.

### D5 — Site-wide `noindex` (both channels)

`<meta name="robots" content="noindex">` on **every** page AND a `robots.txt` with a
site-wide `Disallow`. The prototype must never compete with getff.ai in search indexes
(design r2 MINOR-3). Both channels are checked in §3 — one without the other fails.

### D6 — Deploy workflow, written but inert here

`smoke/.github/workflows/deploy.yml` that builds and publishes to GitHub Pages, written for the
scratch repo. It sits inside `smoke/` and therefore **does not run** in `getff-landing`
(GitHub only reads workflows from `.github/` at the repo root). Do not add or edit anything under
the landing repo's own root `.github/`.

## §3 The gate — leg A (run it, quote command + output; T2/T3)

Leg A is green when ALL of the following pass **inside the container**, against the exported
`out/` directory served locally (e.g. `npx serve out` or `python3 -m http.server` from `out/`):

| #   | Check                                                                                                                                                                                            | Passing means                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| 1   | `npm run build` (static export)                                                                                                                                                                  | exits 0; `out/` exists                                           |
| 2   | `curl -s -o /dev/null -w '%{http_code}' <base>/docs/executable-agents-md`                                                                                                                        | `200`                                                            |
| 3   | `curl -s <base>/llms.txt \| wc -c` and same for `/llms-full.txt`                                                                                                                                 | both **> 0**, and the bodies name the ported page                |
| 4   | `curl -s <base>/docs/executable-agents-md.md \| head`                                                                                                                                            | raw Markdown of the ported page, not an HTML shell               |
| 5   | `grep -ril 'noindex' out/ \| wc -l` + `curl -s <base>/robots.txt`                                                                                                                                | every generated HTML page carries the meta; robots.txt disallows |
| 6   | Search: locate the generated index in `out/`, then query it for a phrase unique to the ported page (a script that loads the index and asserts the hit is fine — quote the script and its output) | the ported page is returned                                      |

**Reporting rule (binding).** Leg A green means exactly: **«prototype builds; in-container route
gate quoted; deploy pending operator»**. It does **NOT** mean «BS0 green». BS0 → BS1 opens only
after leg B quotes the LIVE gate (deployed URL over HTTPS, Orama query on the deployed site,
`noindex` present in fetched HTML). Writing «BS0 green» in the report on leg A alone is a false
completion claim.

**On any FAIL:** report the failure with its output and **STOP**. Do not fix forward past the gate,
do not substitute a hand-written file for a framework route, do not narrow the gate. A FAIL here is
a legitimate, valuable outcome — it triggers the recorded Starlight rollback (parent D5
falsifier-1), and inventing a pass would retire a stack on a lie.

## §4 Out of scope — and the floors

Do NOT do these. Each is either another stage's or an operator's:

- **Creating `artyhoo/getff-docs-smoke`, enabling Pages on it, or any DNS for `beta.getff.ai`** —
  operator floors. You have no `github.com` route anyway.
- **Pushing anything.** Commit locally on `bs0-fumadocs-smoke`; the host harvests.
- **Touching `main`, or wiring a Pages workflow onto a `getff-landing` branch.** The landing repo's
  Pages is bound to `main:/` with CNAME `getff.ai` (measured 2026-09-02) — a second deployment from
  this repo would displace production. There is nothing to «help» with here.
- **Porting the other four docs pages, the landing, the blog, RSS, sitemap, consulting** — that is
  BS1, on branch `fumadocs-migration`.
- **Content work** (showcase pages, First Steps, ledger) — BS2.
- **Editing anything outside `smoke/`.**

If you hit a question only the operator can answer, **park it** (open-question / park mechanism) and
continue with parkable-independent work, or exit clean. Do not improvise around a floor.

## §5 AI traps ([.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps for this stage: **T2**, **T3**, **T7**, **T12**, **T16**, **T19**.

- **T2** — designing ≠ auditing. Every §3 row is _run_, not described. «Would return 200» is a
  failure; paste the actual status code.
- **T3** — no prose-only findings. Command + output, or `file:line` with the line's content, or an
  explicit `INCONCLUSIVE-…`.
- **T7** — before declaring the gate green, write and run the adversarial counter-prompt: «what
  would make this pass look real when it is not?» (a hand-written `llms.txt`; a `.md` twin that is
  actually an HTML shell; `noindex` on one page only; a search index that matches the title because
  the title is in the URL). Check each, report the check.
- **T12** — Fumadocs/Next/Tailwind specifics from live docs at build time, never memory.
- **T16** — Fumadocs is ADOPTED for the docs UI only. llms routes, the Markdown twins and the
  landing are **our** code — do not assume an upstream module covers them, and do not report a
  route as framework-provided without showing where it came from.
- **T19** — run your own cold pass over the diff before reporting done: does every §2 deliverable
  exist, and does every §3 row have real output next to it?
- **T-BDS-A (umbrella)** — «the site looks done because the happy path renders». The gate is the
  route set, not the screenshot.

## §6 Dispatch + runtime facts (for the dispatching session, not the worker)

- **Project:** `361685f1-6fe0-407d-a492-ebcfa259407f` (`getff-landing`, rootPath
  `/home/www/getff-landing`, `parallelEnabled: true`). The operator shell exports
  `RUNTIME_BRIDGE_AIF_PROJECT_ID=441c1c0c-…` (**`rules-as-tests-aif`**) — dispatching without
  overriding it sends this stage to the wrong project. Override it explicitly on the command.
- **No `<!-- bridge-profile: -->` marker, deliberately.** All three modes on this project resolve to
  the executor tier (`53eca24c` plan/review, `088182b8` task) per the operator's GLM-only directive
  of 2026-08-17 (umbrella [`kickoff.md`](kickoff.md) tier line; PR #1446). A top-tier seat, if a
  stage ever needs one, is a **host-side** session, never an aif dispatch. Related live defect:
  the `aif` mode-override preset still names `Claude Opus (plan+review)`, a **disabled** profile,
  and marker resolution reads an unfiltered profile list — so that marker would dispatch «successfully»
  and then block on runtime auth. Do not attach it.
- **Harvest:** push leg only, and from the host — `harvest.ts … --repo-path /home/www/getff-landing
--host-repo <landing clone>`. `gh pr create` resolves the repo from cwd (finding F8, meta-launch
  §7.2), so any PR command for the landing repo runs from the landing clone, never from the
  framework checkout.

## §7 Report format

The stage report is the review artifact (parent §5 — the landing repo has no CI). It must carry:

1. **§1 entry re-verification** — the six rows, each with the command you ran and its output.
2. **§2 deliverables** — what exists, with pinned versions of every installed package.
3. **§3 gate table** — six rows, each with the actual command and its actual output, and the
   verdict line: `LEG A: GREEN — prototype builds, in-container route gate quoted, deploy pending
operator` or `LEG A: FAIL — <which row, with output>`.
4. **§5 T7 counter-prompt** — what you wrote, what you ran, what it surfaced.
5. **Findings** — anything Fumadocs could not do statically, and any Tailwind-v4 conflict, stated
   plainly. A finding is a success of this stage, not a failure of it.
6. **Parked questions**, if any.
