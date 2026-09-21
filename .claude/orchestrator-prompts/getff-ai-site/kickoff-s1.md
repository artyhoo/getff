# getff-ai-site S1 — conveyor: BUILD then RUN

> **Umbrella:** [kickoff.md](kickoff.md) — §2 non-negotiables and §3 name census are binding.
> **Class:** stage kickoff (dispatch input). **Base branch:** `staging`. **Channel:** aif on GLM,
> **two tasks, one per repository** (R23) — one task cannot write two repos.
> **Rigor label (effort-worthiness L0):** `research-grade` — the RUN half writes **230**
> consumer-facing pages (the enumerated figure from the §2 inventory, which supersedes the
> «~105» estimate) and the BUILD half ships the gates that are the only thing standing
> between a wrong page and publication.
> **Authoritative for:** the S1 stage contract — the BUILD/RUN split, the page inventory
> obligation, the container `--write` arm, the git-hook probe, the exit gates, the last acts
> before commit, and the host-verify contract.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> R6–R23, owned by
> [`2026-09-14-getff-ai-rollout-and-cutover-design.md`](../../../docs/superpowers/specs/2026-09-14-getff-ai-rollout-and-cutover-design.md);
> page content standards, owned by the quality contract.

**Measurement SHA for every `path:line` below:** `origin/staging` =
`d266fdf01ea9a3fa16cccd025f87e96a1d84ecce` (S0b, PR #1817). Every file cited here was re-read at
that one ref. **Re-pinned from `79fa1b56b74`** while landing the §2 inventory: of the five cited
specs only `ref-gen.md` had moved (31 insertions, 31 deletions), and it moved the §5 premise from
true to false — see the §5 correction. That is `T-GA-A` firing exactly as the umbrella predicted,
and it is why non-negotiable 11 is not optional.

## §0 The split, and why RUN cannot start early

S1 has two halves (D41, [`site-design.md:168`](../../../docs/superpowers/specs/2026-09-13-getff-ai-site-design.md);
the stage row is [`roll.md:107`](../../../docs/superpowers/specs/2026-09-14-getff-ai-rollout-and-cutover-design.md)):

- **BUILD** — the gates and the renderer. Labels owned by R16
  ([`roll.md:68`](../../../docs/superpowers/specs/2026-09-14-getff-ai-rollout-and-cutover-design.md)).
- **RUN** — once those gates are green, the conveyor writes every remaining family and every
  remaining non-family page on aif/GLM, few-shot from the S0b gold pages.

RUN is gated on BUILD because the gates ARE the control system: «aif's review loop plus the
deterministic gates» is what replaces a human reading 230 pages. Writing pages before the gates
exist means nothing measured them.

**The generator is NOT in this stage.** S0a built it (umbrella round 2, R16). S1 BUILD keeps
`check-docs-refresh.mjs` + its channels, the R19 assertions, `notify-landing.yml` and
`pin-freshness.yml`, plus the landing renderer and preview.

## §1 Scope

**Framework task (repo `rules-as-tests-aif`):** `scripts/check-docs-refresh.mjs` + its pre-push
section and its `fetch-depth: 0` CI job (R13); the R19 renderability assertions;
`notify-landing.yml`; `pin-freshness.yml` (R22).

**Landing task (repo `getff-landing`):** the fetch script; `framework.pin`; the Mermaid component
+ remark plugin + the pre-render allow-list (R6); the redirect writer with **both** stub shapes +
the coverage check (R7/R21); `pr.yml` / `pages-build` (R20); the `markdownUrl` page actions; the
hero component (D28 §5.9) with its FS8 grep guard, fed by `docs/site/hero-copy.json` from the pin
(R23; D51 (3) at [`site-design.md:178`](../../../docs/superpowers/specs/2026-09-13-getff-ai-site-design.md)).

**Separately, before the cutover:** the `repository_dispatch` trigger goes out as a
**trigger-only landing PR merged before S2** (R4). That is what makes the dispatch chain
rehearsable while the current site is still live.

**Preview:** the full site is built from the pin and published to `artyhoo/getff-docs-smoke`.
Preview config = production **plus `PREVIEW_BASE_PATH` and nothing else** (R8).

**RUN half:** every remaining reference family **and** the non-family pages — Learn, Guides,
Understand — except the hub `/docs/`, which is face page 1 of the pinned seven and belongs to the
gold set, never the conveyor (D41).

## §2 The page inventory — non-negotiable 5, and it blocks dispatchability

D49 ([`site-design.md:176`](../../../docs/superpowers/specs/2026-09-13-getff-ai-site-design.md))
makes the inventory a **kickoff artifact**: no spec enumerates the site by slug. The conveyor plan
(P-R, D19) carries **one** table `slug | kind | stage | writer | provenance`, and the aif batch
prompts are generated **from it**, never from a family name alone.

Its population is three sets:

1. D28 §4 — the pinned seven, rows 2a–d, the five census URLs, the post-census stubs;
2. the D29 reference families;
3. **the Learn / Guides / Understand list.**

**Population 3 is enumerated NOWHERE today.** D41 records only «~15». So the completeness check is
**vacuous on a third of the site** unless the inventory author FIRST writes that list — from the
four sidebar tabs (§1 of the umbrella spec) and D30's `kind:` registry — and **records where each
row came from**. That is non-negotiable 5, and it is a precondition, not a task: *enumerate D49's
third population and record its provenance BEFORE the dispatchability grep can mean anything.*

Three census pages get explicit RUN rows now: `/docs/executable-agents-md/` (the full demo page,
D12), `/docs/limits/` (a real page whose stack table is a `maturity.json` fence region), and
`/docs/faq/`. A slug that fits no registered `kind:` **escalates to D30** for a registered kind —
never an open enum.

**The inventory exists as of 2026-09-21: [`kickoff-s1.inventory.md`](kickoff-s1.inventory.md)**
(a `sidecar` by `classifyKickoffName`, merged to `staging` before this stage's dispatch per
non-negotiable 7). It carries the one table across its three populations, plus a companion table
for non-page URLs — a redirect stub has no `kind:` frontmatter, and forcing it into the page
table would create exactly the open enum D49 forbids. Read it before generating any batch prompt.
**Two findings it produced, which a Worker must not re-derive:** the conveyor's real size is
**230 pages, not «~105»** (§6 there — 219 family members across eleven families, of which only
family B's 18 are written), so at D19's ~20-pages-per-task ceiling the remaining ten families are
ten aif tasks; and `/docs/beta` has **no successor page in any source** and is an open operator
decision (stub target or `retired-urls.txt`), recorded rather than invented.

**D49 falsifiers, verbatim:** (a) a page merged in S1 that is in no inventory row → the batch
prompt was not generated from the inventory; **fix the generation, never the page**; (b) the
Learn/Guides/Understand rows carry no provenance column naming where each slug came from → they
were improvised, and the completeness check cannot see the omission direction at all.

## §3 The eleven non-negotiables — verbatim

1. Regenerate the content brief's pass-F points from D28 §5.8 / §5.9 / §10 / §11.
2. The R2 `no-unsafe-zod-parse` RED step goes in the S0b chip's `host-verify` block.
3. Carry the D55 `--census`-first clause into the S0a stage prompt verbatim.
4. D44's skill list verbatim in EVERY stage prompt, each name re-measured at the SHA the kickoff
   cites — never copied from an earlier kickoff.
5. Enumerate D49's third population and record its provenance BEFORE the dispatchability grep can
   mean anything.
6. **S0b gold pages go as a chip to a NEW clean Fable session — never an aif profile.**
   S0a / S0q / S1 go to aif on GLM.
7. The kickoff must be MERGED to `staging` before any dispatch, then the in-flight probe.
8. **OPERATOR DIRECTIVE — in-container self-check BEFORE execution.** Every stage prompt opens
   with a mandatory verify-and-repair phase running INSIDE the aif container before any
   production work: re-read the prompt against the cited spec lines, RUN the declared
   `host-verify` commands and the repo's gates, FIX what it finds there, and emit findings +
   dispositions in the task report so a clean phase differs visibly from a skipped one.
9. The operator's «го» on the S0a dispatch comes through their chat. Neither this seat nor the
   advisor can supply it.
10. Each stage prompt also carries an explicit «last acts before commit» list, SEPARATE from the
    opening self-check — the in-container self-check is blind to post-build omissions by
    construction, which is exactly how A3 survived.
11. The in-container phase must separately re-walk the prompt's OWN citations against real lines.
    `check-line-citations.mjs` has no freshness arm, so a citation wrong when written passes.

## §4 PHASE 0 — in-container self-check BEFORE any production work (non-negotiable 8)

1. **Re-read this prompt against the cited spec lines** — §0–§2 and §6. `roll.md` is the file most
   likely to have moved; read the cited lines, do not trust them.
   `scripts/check-line-citations.mjs` has no freshness arm, so a citation wrong when written
   exits 0 silently (non-negotiable 11).
2. **Run the §10 `host-verify` contract** — `bash scripts/host-verify.sh
   .claude/orchestrator-prompts/getff-ai-site/kickoff-s1.md` — and the repo gates that apply to
   your diff. The **path** form, never the slug form (see §7 item 6).
3. **Run the git-hook probe of §5 and record it** — it is a Phase-0 deliverable, not a note.
4. **Fix what you find here**, and report findings **with dispositions**. «Self-check: OK» with no
   enumeration is a skipped phase.

## §5 The container `--write` arm and the git-hook probe

**The arm (F2 TD MAJOR-2, [`roll.md:107`](../../../docs/superpowers/specs/2026-09-14-getff-ai-rollout-and-cutover-design.md)
(e)).** **CORRECTED at the re-pin, 2026-09-21 — the premise this section shipped with is false at
current staging.** `--write` is **author-run before commit** and **no pre-commit wiring exists**:
[`ref-gen.md:201`](../../../docs/superpowers/specs/2026-09-14-getff-ai-reference-generator-design.md)
now reads «`.husky/pre-commit` invokes neither generator — the G9 pre-commit decision is not
implemented», corrected there 2026-09-15, and the file confirms it
(`grep -n 'render-reference' .husky/pre-commit` → no match, run on the host 2026-09-21). The
earlier text — «`.husky/pre-commit` is the only channel that FILLS the fences» — was read at
`79fa1b56b74` and is a `T-GA-A` casualty.

Nothing changes about the arm itself; its **reason** changes, and the reason is what a Worker
reasons from. Nothing fills the generated fences or derives `sources:` automatically **anywhere**
(`qual.md:114` D-Q18 — `sources:` is DERIVED by the renderer's `--write`, never authored), and
drift is caught only by `--check` at pre-push and in `audit-self.yml`. So the arm is needed on
every seat, host or container, not because a container skips a hook:

- each container task carries `npx tsx scripts/render-reference.mjs --write` as its **LAST act
  before every commit**;
- the **harvest seat re-runs it on the host** and amends before opening the family PR.

Without the arm, the family PR's `audit-self.yml --check` errors on every page with a fix command
only a host seat can run.

**The probe (required, [`destination-environment-verification.md §1b`](../../rules/destination-environment-verification.md)).**
The arm no longer rests on «aif containers never run the repo's git hooks» — after the correction
above it stands on its own. The probe stays, retargeted: what now depends on that claim is
**pre-push** (`packages/core/hooks/pre-push.ts` referenceRender + faceFactsRender `--check`), the
first channel that can see the drift. If the container does not run it, the harvest seat's host
push is the first detection, and the task report must say so. **That claim has never been probed
at the SHA the spec cites.** A primary-doc
citation is not a probe. So this stage **records a live probe** inside the container, with its
command, its output and its date — for example a commit in a scratch clone plus
`ls -l .git/hooks` and a marker file the `pre-commit` hook would have written. If it cannot be
probed, write `INCONCLUSIVE — could not probe <destination> (<why>)`. **Silence is not an
outcome**, and if the probe shows the hooks DO run, the arm is redundant and R13's second caller
needs re-reading before anything else in this stage is believed.

## §6 Exit gates, seams, falsifiers, measured

- **Gates:** landing `pages-build` green **against the production config** (R20: redirect coverage
  over the enumerated old-URL list, both Mermaid fixtures, `lychee --offline` over `out/`) — and
  **NOT** `render-face-facts --check`, which D42 homes framework-side; the landing keeps only R18's
  Zod backstop. The framework sandbox suite green (three paired D26 cases that actually execute the
  script, R13). D24b byte-identity of the gold cards. One green dispatch → landing deploy through
  the trigger-only PR (R4).
- **Named seat:** Opus final check on the smoke preview = **GO**, its verdict naming **which build
  it read**.
- **Seams:** `packages/core/hooks/check-docs-refresh.test.ts` (or `tests/hooks/*.test.sh`) paired
  cases — **not** `pre-push.test.ts`, which executes nothing (R13); the landing's
  `scripts/check-redirects.mjs` over the enumerated `old-urls.txt`, including the
  census-URLs-must-be-real assertion (R21); **two** Mermaid fixtures — an unsupported type must
  FAIL the build, and a supported type carrying a dropped element must FAIL the pre-render
  allow-list (R6); `lychee --offline` over `out/`; the preview URL quoted in the Opus verdict.
- **Falsifiers (R-row verbatim):** the preview shows a defect the gates passed → **add the missing
  gate before S2, never «we will watch it»**; the smoke build needs a secret or a paid call → the
  design is wrong, stop; the preview build and the production build differ by more than
  `PREVIEW_BASE_PATH` → the seat is certifying an artifact that will not ship (R8).
- **RUN-half falsifier (D41 (a)):** the first GLM family's REVISE rate at the D17c measurement
  exceeds the gold pass's by **>2×** → that family and the next go back to a Fable chip, and the
  measured rate becomes the exchange rate. There is **no fixed exchange rate** between a Fable page
  and a GLM page; it is measured, not priced.
  **Its denominator is an S0b deliverable, so check it exists before trusting this test:** «the
  gold pass's rate» is the number [`kickoff-s0b.md §6`](kickoff-s0b.md) requires in the S0 closure
  note (`roll.md:105`). If that note is missing or carries no rate, this falsifier cannot fire at
  all and the only mechanism returning a family to Fable is dead — **STOP and surface, do not
  substitute a rate of your own**, and do not read the absence as a pass.
- **Measured:** landing build time from a cold checkout (budget: under 10 min on `ubuntu-latest` —
  **measured, not assumed**, and the machine is named because a budget sized to the wrong machine
  is its own anti-pattern); the number of redirect stubs written (must equal the mapping size); and
  the first GLM family's REVISE rate at the D17c batch-0/batch-1 measurement.

## §7 Last acts before commit (non-negotiable 10)

1. `npx tsx scripts/render-reference.mjs --write` — every commit, last act (§5).
2. Confirm every page merged in this batch has a row in [`kickoff-s1.inventory.md`](kickoff-s1.inventory.md).
   A page with no row — or one whose row still carries a `<token>` slug — means the batch prompt was
   not generated from the inventory: **fix the generation, not the page.** A token row is replaced
   with the final slug **in the same commit that writes the page**.
3. Confirm the inventory's Learn/Guides/Understand rows (§4 there) still carry their provenance
   column, and that regenerating its §3 rows from `docs/site/reference/<F>.json` still reproduces
   them — a family whose membership moved leaves the inventory stale.
4. Re-run the paired negatives — both Mermaid fixtures and the redirect coverage check — and quote
   the RED, not just the green.
5. `bash scripts/check-ask-files.sh` — a RED ask file blocks every push.
6. `bash scripts/host-verify.sh .claude/orchestrator-prompts/getff-ai-site/kickoff-s1.md` on the
   host; quote the output. **The path form is load-bearing** — the slug form resolves to the
   umbrella's `kickoff.md` (`scripts/host-verify.sh:98`) and returns its always-green 13 lines,
   so this stage's contract — red by design until its inputs merge (§6) — would never be seen.
7. Re-walk **this prompt's own citations** (non-negotiable 11).
8. Capture the diff's **hunk headers** and list, per shifted file, the citations INTO it that now
   sit past a shift point — into the PR body. No gate performs this.

## §8 Out of scope

The cutover itself (S2 — branch protection, the `LANDING_DISPATCH_TOKEN` secret, the one landing
PR to `main`, the deletions); the gold set (S0b); the quality layer (S0q); the generator and the
source fields (S0a). The hub `/docs/` is **gold, not conveyor** — do not write it here. Do not edit
the design specs; a spec defect is a finding in the task report.

## §9 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps: **T1**, **T2**, **T3**, **T9**, **T10**, **T14**, **T19**, **T21**.

- **T1** — five clean pages in a family is a sampling artifact. The D17c measurement has a declared
  depth; use it.
- **T2** — a redirect coverage check that was written is not one that was fired. Quote the RED run.
- **T3** — every claim about the container's behaviour carries the probe command and its output
  (§5), never a doc citation standing in for a probe.
- **T9** — sample the families where the discipline was weakest, not the most recent three.
- **T10** — the inventory (§2) is the population, and it precedes every coverage claim.
- **T14** — «no findings across two families» at 15% coverage is «coverage insufficient to
  conclude».
- **T19** — own cold re-read of the diff before harvest.
- **T21** — the backward-check enumerates sibling surfaces, not this PR's files.

**Domain-specific trap — `T-S1-A` «the family that was never in the inventory».** The conveyor is
driven by batch prompts, and a family named in a prompt but missing from the inventory produces
pages nothing can check for completeness — the omission direction is invisible by construction.
Counter: prompts are **generated from** the inventory table, and D49's falsifier (a) says to fix
the generation rather than the page.

**Domain-specific trap — `T-S1-B` «the preview that is not the build».** A preview that differs
from production by anything other than `PREVIEW_BASE_PATH` means the Opus GO certifies an artifact
that will never ship — and the difference is invisible in a screenshot. Counter: R8 as written, and
the verdict must name **which build** it read.

**Domain-specific trap — `T-S1-C` «green because nothing ran».** The `fetch-depth: 0` job, the
sandbox D26 cases and `pre-push.test.ts` all look like coverage; R13 records that `pre-push.test.ts`
**executes nothing**. Counter: every seam in §6 names a test that actually invokes the script, and
each must be shown failing once.

## §10 Host-verify contract

```bash host-verify
test -f .claude/skills/orchestrator/SKILL.md
test -f .claude/skills/dispatcher/SKILL.md
test -f .claude/skills/pipeline/SKILL.md
test -f .claude/skills/harvest/SKILL.md
test -f .claude/skills/claude-glm-executor-handoff/SKILL.md
test -f .claude/skills/reviewer/SKILL.md
test -f agents/fidelity-auditor.md
test -f agents/claims-conformance-auditor.md
test -f agents/docs-form-auditor.md
test -f .claude/skills/docs-author/SKILL.md
test -n "$(find "$HOME/.claude/plugins/cache" -type f -name SKILL.md -path '*superpowers*/writing-plans/*' -print -quit)"
test -n "$(find "$HOME/.claude/plugins/cache" -type f -name SKILL.md -path '*superpowers*/executing-plans/*' -print -quit)"
test -n "$(find "$HOME/.claude/plugins/cache" -type f -name SKILL.md -path '*superpowers*/test-driven-development/*' -print -quit)"
test -f scripts/render-reference.mjs
test -f scripts/render-face-facts.mjs
test -f scripts/docs-check.mjs
test -f docs/site/terms.md
test -f docs/site/hero-copy.json
bash scripts/check-ask-files.sh
```

All nineteen lines are **green at the re-pin** — `bash scripts/host-verify.sh
.claude/orchestrator-prompts/getff-ai-site/kickoff-s1.md` → `19/19 passed on Darwin`, run on the
host 2026-09-21. When this contract was authored, four of them (`docs-author`,
`docs-form-auditor`, `docs-check.mjs`, `terms.md`) and both `render-*.mjs` lines were red **and
had to be**: they assert that S0a and S0q have merged, and they now do (#1807, #1817). That is
D44's design working — a contract is evaluated at **its own stage's dispatch**, never at
authoring time, and this stage's dispatch is the first moment it can be green.

## §11 D44 — names this stage invokes, re-measured at `d266fdf01ea`

BUILD: `orchestrator`, `dispatcher`, `pipeline`, `claude-glm-executor-handoff`, `harvest`,
`superpowers:writing-plans` (the conveyor plan, P-R), `superpowers:executing-plans`,
`superpowers:test-driven-development` (every BUILD script) — **all PRESENT** at the SHA above.

RUN: `docs-author` in **EVERY** S1 RUN Worker prompt and in the D26 refresh executor's prompt
(D-Q8 «same skill on every seat», its `refresh` mode) — the conveyor writes 230 pages and the
D17c rate is measured **with** the instrument, never without it. **Re-measured at
`d266fdf01ea`** (non-negotiable 4, never copied from the earlier kickoff): `docs-author` and
`agents/docs-form-auditor.md` are now **PRESENT** — S0q built them and merged them (#1807), so
the earlier «ABSENT today» line is retired. The §10 contract is what turned that from a silent
substitution into a checkable transition.

All ten repo names above were re-measured with `git cat-file -e d266fdf01ea:<path>` on
2026-09-21 — ten PRESENT, zero ABSENT — and the §10 runner confirms them on the host.

Review seats: `reviewer` + [`agents/fidelity-auditor.md`](../../../agents/fidelity-auditor.md) at
the PR boundary; for the S1 close (D22) and the D17c batch measurement, the content auditors
`docs-form-auditor` + [`agents/claims-conformance-auditor.md`](../../../agents/claims-conformance-auditor.md),
floor **5 per kind**.
