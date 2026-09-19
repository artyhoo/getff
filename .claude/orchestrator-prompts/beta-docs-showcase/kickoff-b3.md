<!-- scope: stage kickoff — beta-docs-showcase BS3 (cutover). Dispatch input for ONE host-side session in the landing clone `/Users/art/code/aif-handoff/projects/getff-landing`, NOT an aif container task (§6 says why). The umbrella plan lives in ../beta-docs-showcase/kickoff.md + ../beta-docs-showcase-meta-launch/kickoff.md and is NOT this file's scope. Filename `kickoff-b3.md` = umbrella B, stage 3 (the design's «BS3»): the `kickoff-<letter><digit>` shape is what places it in the stage-kickoff family principle 12's citation gate resolves; `kickoff-bs3.md` would fall outside that family and be silently skipped. No runtime-profile marker is attached — this stage does not dispatch to aif at all. -->

# beta-docs-showcase BS3 — cutover (the one irreversible step)

> **Type:** execution-build + manual-liveness, **host session (Mode A inline)**, one read-only
> cold Agent for leg A. **Deliverable: `fumadocs-migration` merged into `main` of
> `artyhoo/getff-landing`, deployed, production census green, BS0 prototype torn down.**
> This is the stage that closes the one-way door: after the merge, `getff.ai` serves the new
> site to the public.
> **Binding design:** [`docs/superpowers/specs/2026-07-23-beta-docs-showcase-design.md`](../../../docs/superpowers/specs/2026-07-23-beta-docs-showcase-design.md)
> §2 row **BS3**, review **MAJOR-1** (the ledger's author never self-certifies), **D8** (the
> deploy target), **B-D4** (URL parity). On any divergence between this kickoff and the spec,
> **the spec wins** — surface it in the report, never improvise.
> **Umbrella context (read-only):** [`kickoff.md`](kickoff.md) stage 4 («BS3 — cutover») +
> its per-stage checklist («operator-only steps are PARKED, never improvised»).
> **Stage gate into this stage:** **BS2 GREEN + harvested 2026-09-02** — `fumadocs-migration`
> @ `18e847b3` on `origin` of the landing repo, fast-forwarded from BS1's `87d1a99e`. Cold
> fidelity verdict on that head was **GO** (3 MINOR, no round). The stage report is
> [`BS2-REPORT.md`](https://github.com/artyhoo/getff-landing/blob/fumadocs-migration/BS2-REPORT.md)
> at the branch root; the artefact this stage judges is
> [`CLAIMS-LEDGER.md`](https://github.com/artyhoo/getff-landing/blob/fumadocs-migration/CLAIMS-LEDGER.md)
> (86 rows) next to it.
> **Rigor label (effort-worthiness L0):** **`research-grade`** — the only stage of this umbrella
> that earns it. The merge is irreversible in the sense that matters (the public sees it), the
> surface is consumer-shipped, and a wrong claim on the live site is the exact failure the
> umbrella exists to prevent. Everything BS1/BS2 built was `build-and-verify` precisely so that
> this stage could be the careful one.
> **You are not starting from zero, and you are not improving anything.** BS1 ported the site,
> BS2 wrote the content and the ledger. Your job is to CHECK, then SHIP, then TEAR DOWN. Any
> urge to reword a page, restyle a component, or add a doc is scope theft — write it as a
> finding instead.

<!-- host-verify: none — this stage authors no executable deliverable in THIS repo. Its writes land in `artyhoo/getff-landing` (a repo whose only CI is the Pages deploy workflow) and in the GitHub Pages / DNS control plane of `artyhoo/getff-docs-smoke`. Its acceptance commands are host-side fetches and `gh` calls, declared in §3 and quoted in the stage report. -->

## §0 Goal

Prove the site's claims are true, then make it the public `getff.ai`, then remove the
scaffolding. Three legs, strictly ordered, each gated:

- **Leg A — the pre-merge gate.** An independent cold claims audit of the BS2 ledger. PASS is
  the precondition for leg B existing at all.
- **Leg B — the cutover.** Merge → deploy → production census parity → live RSS / llms / search.
- **Leg C — the teardown.** Retire the BS0 prototype deployment and its DNS record.

The announcement post stays `draft: true`. Publishing it is parent spec §7 **phase 3**, not this
stage. Touching its frontmatter here is a finding against you.

## §1 Do this FIRST — entry re-verification

Facts measured **2026-09-08 from the host**. Snapshots: **re-verify, act on what you find**, and
quote command + output for each (T3). A row that comes back different is a finding, not a
formality — three of these rows are the difference between a cutover and an outage.

| #   | Fact at authoring | How to re-verify |
| --- | --- | --- |
| 1   | Landing clone on the host is `/Users/art/code/aif-handoff/projects/getff-landing`, on `main` = **`b65ff4b`**. Every `git`/`gh` command for the landing repo runs from THERE, never from the framework checkout (BS2 finding F8) | `git -C /Users/art/code/aif-handoff/projects/getff-landing log --oneline -1` |
| 2   | `origin/fumadocs-migration` = **`18e847b3`**; `origin/main` = **`b65ff4b5`** (unmoved since 2026-08-17). The branch is a fast-forward descendant of `main` | `git -C <clone> fetch origin && git -C <clone> rev-parse origin/fumadocs-migration origin/main`; `git -C <clone> merge-base --is-ancestor origin/main origin/fumadocs-migration && echo FF-OK` |
| 3   | **The deploy workflow's config on the branch has never executed.** `.github/workflows/deploy.yml` fires only on `push: branches: [main]`. Its one difference from `main`'s copy is the artifact path: **`./dist` (Astro) → `./out` (Next static export)**. The first real run of the branch's config IS the cutover — §3 row 3 is what removes that blind spot | `diff <(git -C <clone> show origin/main:.github/workflows/deploy.yml) <(git -C <clone> show origin/fumadocs-migration:.github/workflows/deploy.yml)` |
| 4   | `next.config.mjs` on the branch carries `output: 'export'`, `trailingSlash: true`, `images.unoptimized`. Build script is plain `next build`; `postinstall` runs `fumadocs-mdx`. So `npm run build` must produce `out/`, and canonical URLs carry a trailing slash | `git -C <clone> show origin/fumadocs-migration:next.config.mjs`; same for `package.json` |
| 5   | **`public/CNAME` on the branch contains `getff.ai`.** Losing it takes the apex domain down at the first deploy. It is the single highest-cost silent failure in this stage | `git -C <clone> show origin/fumadocs-migration:public/CNAME` |
| 6   | Production today is the OLD Astro site: `https://getff.ai/` → 200, `https://getff.ai/docs/` → **404**. That 404 flipping to 200 is the stage's headline observable | `curl -s -o /dev/null -w '%{http_code}\n' https://getff.ai/ https://getff.ai/docs/` |
| 7   | `https://beta.getff.ai` does **not resolve** (`000`), while the BS0 prototype `https://artyhoo.github.io/getff-docs-smoke/` answers **200**. So leg C's DNS half may already be a no-op and its Pages half is not — measure before acting, and record a no-op as a no-op | `curl -s -o /dev/null -w '%{http_code}\n' -m 8 https://beta.getff.ai https://artyhoo.github.io/getff-docs-smoke/`; `dig +short beta.getff.ai` |
| 8   | `agents/claims-conformance-auditor.md` **exists and ships** in this framework repo (umbrella C delivered it). Leg A uses the real agent — the `kickoff.md` fallback «an equivalent compliance-verifier-class run» is NOT needed and must not be substituted | `ls /Users/art/code/rules-as-tests-aif/agents/claims-conformance-auditor.md` |
| 9   | `CLAIMS-LEDGER.md` at the branch root is ~24 KB / **86 rows**; BS2 reported `0 non-conformant`. That self-report is the thing leg A exists to distrust | `git -C <clone> show origin/fumadocs-migration:CLAIMS-LEDGER.md \| wc -l` |
| 10  | There is **no open PR** in the landing repo and none has ever been opened against `main` — by design (BS2 §6, `kickoff.decisions.md:91`). Leg B opens the first one | `gh pr list --repo artyhoo/getff-landing --state all --json number,baseRefName` |

## §2 Deliverables

### Two operator forks that BS2 carried forward are ALREADY DECIDED — do not re-park them

BS2's report §7 parked two questions «for the operator at BS3». The dispatching session put both
to the operator on 2026-09-08 and resolved them on substance rather than punting a card:

1. **Docs theme at cutover — SHIP AS BUILT.** The branch's ported brand greens
   (`--color-fd-primary`) go live unchanged. Rationale: it is the status quo, it costs nothing,
   and the operator sees it live at the leg-B visual sign-off, where a palette flip is a
   one-line follow-up. Changing the palette *before* anyone has seen it live is strictly worse.
   **Do not touch the palette.** If the operator dislikes it at sign-off, that is a follow-up
   commit, not a reason to hold the cutover.
2. **Left-panel card copy — REWRITE to the F5-4 shape** («clippy demo, deny roadmap») **before
   leg A runs.** Rationale: ledger row 85 labels the current copy `planned`, i.e. the live site
   would assert something that is not yet true; claims honesty is the umbrella's whole point,
   and a cold auditor will almost certainly return this as a GAP and cost a round. Cheaper to
   fix first. This is a one-line copy change in `app/(site)/page.tsx`; update ledger row 85 in
   the same commit so the ledger and the page stay in step.

Both decisions are recorded here so leg A audits the *corrected* surface. Re-parking either one
is a T8 violation (asking a question whose answer is in the kickoff).

### Leg A — independent cold claims audit (pre-merge gate)

Dispatch [`agents/claims-conformance-auditor.md`](../../../agents/claims-conformance-auditor.md)
as a **read-only Agent** over the docs surface. This is the one Agent-tool dispatch this stage
makes, and it is legitimate precisely because the agent is reporting-only — see §4.

**Hand it ONLY the doc surface. Never hand it the authoring narrative.** Concretely: the pages
under `content/docs/`, `content/blog/`, the landing page component, and `CLAIMS-LEDGER.md`, plus
read access to the framework repo at `/Users/art/code/rules-as-tests-aif` so it can verify claims
against live source. **Do not** hand it `BS1-REPORT.md`, `BS2-REPORT.md`, this kickoff, or any
description of what BS2 intended — cold means cold, and a summary of the author's reasoning is
exactly the contamination the MAJOR-1 review finding was about.

Required output: VERIFIED / GAP / UNVERIFIABLE per claim, each with command+output or
`file:line`, plus a GO / REVISE / STOP verdict.

- **GO** → leg B may start.
- **REVISE** → fix the GAPs on the branch, re-harvest, **re-run leg A on the new head**. A GAP
  the fix «obviously» closes still needs the re-run; the audit is the gate, not your confidence.
- **STOP** → halt, report to the operator, do not merge.

Record the audited SHA. An audit of `18e847b3` does not license merging a different commit.

### Leg B — cutover (gated on leg A GO **and** the operator's explicit cutover GO)

1. **Build the production artifact locally first** (§3 row 3). This is the row that converts
   «the branch's workflow config has never run» from a blind spot into a measured fact.
2. Open the first-ever PR against landing `main` from `fumadocs-migration`; merge it as a
   **merge commit, not a squash** — the branch's commit history is the umbrella's audit trail
   and squashing it destroys the BS1/BS2 provenance.
3. The push to `main` fires `deploy.yml`. Watch it; a red deploy is a STOP, and the rollback in
   §4 is armed from that moment.
4. **Production census parity** (§3 row 5) — every URL BS2 verified on preview, re-fetched
   against `https://getff.ai`, individually.
5. Live checks: RSS, `llms.txt`, `llms-full.txt`, search, `draft` containment (§3 rows 6-8).
6. **Operator visual sign-off** — a genuine fork, parked, never improvised. Park it with the
   production URL and the census result; do not declare the stage done without it.

### Leg C — teardown (after leg B is green)

Retire the BS0 prototype: disable GitHub Pages on `artyhoo/getff-docs-smoke` and remove the
`beta.getff.ai` DNS record **if §1 row 7 shows one exists**. DNS is operator-owned — park the
record removal with the exact record to delete; do not improvise registrar changes. Record a
no-op as a no-op with its evidence.

Then write `done.md` for the umbrella (CLAUDE.md umbrella-closure convention) — it is the
`priority-score.sh` C3 fallback and the umbrella does not close without it.

## §3 The gate — run it, quote command + output (T2/T3)

Every row runs. A row you skipped is «coverage insufficient to conclude», never green (T14).

| #   | Check | How |
| --- | --- | --- |
| 1   | Branch is a fast-forward descendant of `main`; audited SHA == merged SHA | `git merge-base --is-ancestor origin/main origin/fumadocs-migration` |
| 2   | Panel copy fixed to F5-4 and ledger row 85 updated in the same commit | `git show --stat <sha>`; grep the page and the ledger row |
| 3   | **Local production build parity:** `npm ci && npm run build` in a clean checkout of the branch produces `out/`; `out/CNAME` contains `getff.ai`; `out/` contains the docs pages as files | `npm ci && npm run build && cat out/CNAME && find out -name '*.html' \| wc -l` |
| 4   | Deploy workflow run for the merge commit concluded `success` | `gh run list --repo artyhoo/getff-landing --branch main --limit 3 --json conclusion,headSha,url` |
| 5   | **Production URL census** — enumerate the URL set from the branch's sitemap and BS2's report §3 (T10: enumerate before claiming), then fetch **each one individually**; no `&&`-chained batch that hides a 404 | `for u in $(...); do printf '%s ' "$u"; curl -s -o /dev/null -w '%{http_code}\n' "$u"; done` |
| 6   | `https://getff.ai/docs/` is 200 (was 404 at §1 row 6) and `https://getff.ai/` still 200 | `curl -s -o /dev/null -w '%{http_code}\n' https://getff.ai/ https://getff.ai/docs/` |
| 7   | `llms.txt` + `llms-full.txt` live and non-empty; search returns a hit for a term unique to a BS2 page | fetch both; exercise search on the live site |
| 8   | **Draft containment on production:** the announcement post appears in NO production surface — not the blog index, not `rss.xml`, not `sitemap`, not `llms-full.txt` | fetch each surface, grep for the announcement slug, expect 0 |
| 9   | Leg A verdict is GO and names the SHA that was merged | quote the auditor's verdict block |
| 10  | BS0 prototype retired: `https://artyhoo.github.io/getff-docs-smoke/` no longer serves (or the operator park is open with evidence) | `curl -s -o /dev/null -w '%{http_code}\n' https://artyhoo.github.io/getff-docs-smoke/` |
| 11  | `beta.getff.ai` DNS state recorded — removed, or measured as never-existing | `dig +short beta.getff.ai` |

Verdict line: `BS3: GREEN — claims audit GO on <sha>, cutover deployed, census N/N, prototype retired`
or `BS3: FAIL — <which row, with output>`.

## §4 Out of scope — and the floors

- **No content edits** beyond the one F5-4 panel line in §2. No new pages, no rewording, no
  restyling, no palette change. Everything else is a finding.
- **No announcement publish.** `draft: true` stays. That is parent §7 phase 3.
- **No framework-repo changes.** If the audit surfaces a framework defect, write it as a finding
  and hand it to the operator — this stage owns the landing repo and the Pages/DNS control plane.
- **No squash merge** into landing `main` (see leg B step 2).
- **Operator floors — park, never improvise:** the cutover GO, the visual sign-off, and any DNS
  record change. A worker that hits one parks it with the fork stated as «Option A → consequence
  X / Option B → consequence Y» and continues park-independent work or exits clean.
- **Rollback, armed from the moment of merge:** if the deploy is red or production regresses,
  `git revert -m 1 <merge-sha>` on `main` and push — the workflow re-fires and restores the Astro
  site. Do this FIRST and diagnose after; the public site is not a debugging surface.
- **The one Agent-tool dispatch is leg A and only leg A.** `claims-conformance-auditor` is
  read-only and reporting-only, which is the documented exception. Dispatching a WRITE task
  through the Agent tool is `#worker-dispatch-via-subagent` (`/pipeline` §5).

## §5 AI traps ([.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps for this stage: **T2**, **T3**, **T7**, **T8**, **T10**, **T14**, **T19**, **T20**.

- **T2** — designing ≠ auditing. Every §3 row is _run_. «The census passes» without the
  per-URL output is a failure.
- **T3** — no prose-only findings. Command + output, or `file:line` with the line's content, or
  an explicit `INCONCLUSIVE-…`.
- **T7** — before declaring green, write and run the adversarial counter-prompt: «what would make
  this cutover look successful when it is not?» Candidates to actually check: the deploy ran
  green but served the PREVIOUS artifact; `out/` built but `CNAME` was dropped so the apex broke
  while `*.github.io` looked fine; the census fetched a cached 200 for a page that 404s on a cold
  edge; search returns hits from the stale index; the draft post is absent from the blog index
  but present in `llms-full.txt`.
- **T8** — the two forks in §2 are ANSWERED. Do not re-ask them. The genuine forks are the
  cutover GO, the visual sign-off, and DNS — those are parked by design, not by hesitation.
- **T10** — §3 row 5 enumerates the URL set from the sitemap BEFORE claiming parity. A census
  against a remembered list is not a census.
- **T14** — coverage bounds the verdict. Eleven rows run and passing = green. Ten run = «coverage
  insufficient», not green.
- **T19** — run your own cold pass before reporting done: every §2 deliverable present, every §3
  row with real output beside it, the rollback command written down and correct.
- **T20** — every verdict in the report carries an evidence-bearing tool call quoted in the same
  breath.
- **T-BDS-A (umbrella)** — «the site looks done because the happy path renders». The gate is the
  route set, the claims audit and the draft containment, never a screenshot.
- **T-BDS-B (umbrella)** — «URL parity assumed from framework defaults». Each URL individually.
- **T-BDS-D (this stage)** — **«the audit is a formality because BS2 said the ledger is clean».**
  The tempting output is a leg-A dispatch shaped to confirm, with the author's reasoning helpfully
  included as context. That contamination is exactly what design review MAJOR-1 forbade. Counter:
  hand the auditor the surface and nothing else, and treat `0 non-conformant` as the claim under
  test rather than the baseline.
- **T-BDS-E (this stage)** — **«irreversible steps feel safe once the checks are green».** The
  merge is a one-way door for the public. Counter: §3 row 3 builds locally first, the rollback in
  §4 is written before the merge, not after the incident.

## §6 Dispatch + runtime facts (for the dispatching session, not the worker)

- **This stage does NOT go to aif, and that is a deliberate departure from BS0/BS1/BS2.** Three
  reasons, the first of them probed against the live container rather than cited from a doc
  ([destination-environment-verification.md §1b](../../rules/destination-environment-verification.md)):

  ```text
  # 2026-09-08, docker exec aif-handoff-agent-1 (container Up 2 days)
  github.com     -> 000   (curl: (35) SSL_ERROR_SYSCALL — TCP never opens)
  api.github.com -> 200
  ```

  (a) `git push` transport to `github.com` is **blocked** from the container, so it cannot land
  the merge; `api.github.com` answers 200, but reaching for it here is precisely the
  pre-push-gate bypass that [egress-no-api-bypass.md §1](../../rules/egress-no-api-bypass.md)
  demotes to break-glass — and §3 of that rule records the block as a **security feature, not a
  defect to fix**. (b) The deploy, the production census and the Pages/DNS teardown are host-side
  by construction. (c) The stage's two hard gates are an operator GO and a human visual sign-off.
  Run it as a **host session (Mode A inline)** in the landing clone, with the single read-only
  Agent for leg A.
- **Pre-dispatch in-flight probe** (CLAUDE.md operational conventions) still applies. Expect the
  known false positive: `probe-inflight.sh` reads `DONE-UNHARVESTED` for `f1010da4` (BS0) and
  `9bd88cae` (BS1), and aif task `5893d3a5` (BS2) sits at `review` because the review profile is
  disabled. All three are **harvested as branches without PRs, by design**. Adjudicate as false
  positives, record the adjudication, do not re-dispatch.
- **Landing-repo commands run from `/Users/art/code/aif-handoff/projects/getff-landing`**, never
  from the framework checkout (BS2 finding F8). Several `feature/beta-docs-showcase-*` branches
  are checked out in worktrees there — do not check out an occupied branch.
- **The framework-side deliverable of this stage is `done.md` only.** Everything else lands in
  the landing repo. `done.md` goes on a normal staging-flow PR in this repo.
- **`npm publish getff` is NOT gated on this stage's kickoff** but IS gated on its outcome: the
  parent spec §8 assembly checklist puts the docs-site claims cross-check (F5) inside the phase-2
  gate, so publication waits for BS3 GREEN.

## §7 Report format

The stage report is `BS3-REPORT.md` at the landing repo root, next to `BS1-REPORT.md` and
`BS2-REPORT.md` — the review artefact (parent §5: the landing repo has no CI beyond the deploy).
It must carry:

1. **§1 entry re-verification** — the ten rows, each with the command you ran and its output.
2. **Leg A** — the auditor's full verdict block, the SHA audited, and the claim-level tallies
   (VERIFIED / GAP / UNVERIFIABLE). If a REVISE round happened, both rounds.
3. **Leg B** — the PR number, the merge SHA, the deploy run URL and conclusion, and the full
   per-URL census output.
4. **Leg C** — prototype and DNS state before and after, with the evidence for each.
5. **§3 gate table** — eleven rows, actual command and actual output each, plus the verdict line.
6. **§5 T7 counter-prompt** — what you wrote, what you ran, what it surfaced.
7. **Findings** — anything the audit could not verify, any claim that had to be softened, any
   framework defect surfaced. These are the umbrella's honest-claims output, not failures.
8. **Parked questions** — the operator forks you hit and how you stated them.
