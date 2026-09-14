# getff-ai-site S2 — landing cutover

> **Umbrella:** [kickoff.md](kickoff.md) — §2 non-negotiables and §3 name census are binding.
> **Class:** stage kickoff (dispatch input). **Base branch:** `staging` for the framework half;
> the landing PR targets `getff-landing@main`. **Channel:** aif on GLM for the PR contents;
> **operator hands** for branch protection, the secret and the merge.
> **Rigor label (effort-worthiness L0):** `research-grade` — this is the **irreversible** stage.
> One PR deletes the live site's content source, 195 hand-written route twins and the old
> `llms.txt` routes. Every old URL not in the enumerated redirect list 404s for real users the
> moment it merges.
> **Authoritative for:** the S2 stage contract — the KEEP-and-GATE list, the preservation
> obligation, the hand order, the exit gates, the post-merge probe, and the host-verify contract.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> R4–R23 and the cutover row, owned by
> [`2026-09-14-getff-ai-rollout-and-cutover-design.md`](../../../docs/superpowers/specs/2026-09-14-getff-ai-rollout-and-cutover-design.md) `:108`.

**Measurement SHA for every `path:line` below:** `origin/staging` =
`6472bf6f2c7767621e04804894279030bee2cda4`. Every file cited here was read at that one ref.

## §0 What lands, and what must already be in place

**Already in place at this row, both operator hands landing BEFORE this stage** (R14's hand order;
R4: the token «not at S2»; R9: protection is «the last hand before S2»): landing branch protection
with `pages-build` as a required check (R20), and the `LANDING_DISPATCH_TOKEN` secret — S1's exit
gate needs the token live. The trigger-only landing PR of R4 has **already merged**.

**Then ONE landing PR from the S1 branch to `main`**
([`roll.md:108`](../../../docs/superpowers/specs/2026-09-14-getff-ai-rollout-and-cutover-design.md)):
it removes `content/docs/**`, the 195 hand-written `.md` route twins and the old
`llms.txt`/`llms-full.txt` routes; repoints `source.config.ts` at the fetched `docs/site/` tree;
and adds the renderer, `redirects.json`, the enumerated `old-urls.txt`, `framework.pin`, the
`markdownUrl` page actions, and the hero component (D28 §5.9) with its FS8 grep guard, rendering
the S0b-written `docs/site/hero-copy.json` from the pin (R23; D51 (3)). Rehearsal: the **revert
build green** (R15). The operator merges. `deploy.yml` deploys on push. The framework dispatch job
is then exercised by the next promote. `fumadocs-migration` is deleted (R11).

## §1 KEEP and GATE — four routes that are in the removal list by mistake (D54)

[D54](../../../docs/superpowers/specs/2026-09-13-getff-ai-site-design.md) (`site-design.md:181`,
verified first-hand at `getff-landing@c091883`) answers «does the cutover ship a docs site with no
search, no sitemap and no feed?» with **No — and nothing needs re-creating: the four routes are in
the S2 removal list by mistake.**

| Route | Why it survives | What it needs |
|---|---|---|
| `app/api/search/route.ts` | `createFromSource(source)` over the **same** `lib/source.ts` loader the `.md` twins and `llms.txt` already read | keeps working **once the cutover repoints `source.config.ts` at the fetched tree** |
| `app/sitemap-index.xml/route.ts` | imports only `siteOrigin`; **zero** docs dependency — the purest over-inclusion | nothing |
| `app/rss.xml/route.ts` | reads only `blogSource`/`blogSlug`, and S2 never touches the blog | nothing — **and it is a D33 census URL** |
| `app/sitemap-0.xml/route.ts` | reads the docs source and follows it | the same repointing |

**Root cause, recorded so it is not re-introduced:** BU-7's «folded into the S2 removal list»
(`roll.md:228`) leaked the `old-urls.txt` **enumeration** into the S2 contents row as
**deletion**. `roll.md:108` now says KEEP + GATE.

**The D54 gate arm — three assertions, one per kept surface, all post-merge and live:**

1. `/api/search` returns **200** and its index names **≥1 post-cutover slug**;
2. `/sitemap-0.xml` returns 200, lists the new IA's pages and contains **NO stubbed URL** (the same
   exclusion rule `llms.txt` follows under R21); and `/sitemap-index.xml` returns 200;
3. `/rss.xml` returns 200 **byte-identical to the pre-cutover capture** taken during the R15
   rehearsal — it is a D33 census URL, so **a stub there is a FAILURE, not a pass** (R21).

**D54 falsifier, verbatim:** `/api/search` returns a body whose entries do not resolve after the
cutover → the loader was **NOT** repointed, and the repointing sentence is missing from the S2
contents row.

## §2 Preservation before deletion (T17/T18 — do this first)

This stage is the umbrella's only genuinely irreversible branch. **Before the destructive PR is
written:**

1. Capture `/rss.xml` byte-for-byte (§1 assertion 3 compares against it).
2. Enumerate the old-URL population from the **live surface** — pages ∪ twins ∪ generated files —
   and commit it as `old-urls.txt`. N ≈ **397** today; the number is fixed at cutover by the
   enumeration command, not by this sentence.
3. Preserve anything in `content/docs/**` or the 195 twins that carries future value and is not
   reproduced by the new tree. Preservation is the **orchestrator's** job before the prompt is
   written; the executor follows scope strictly and will not save it for you.
4. Prove the revert builds (R15) **before** the merge, not after.

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

1. **Re-read this prompt against the cited spec lines** — §0–§2 and §5 — at `origin/staging`, and
   re-read the four route files named in §1 **in the landing repository at its current head**, not
   at `c091883`. D54's verification is dated; the routes may have moved. If any of the four no
   longer matches its description, **STOP and surface** — this is the stage where a stale claim
   deletes a live surface.
2. **Run the §7 `host-verify` contract** and the repo gates that apply to your diff.
3. **Confirm both operator hands are already in place** (protection + secret). If either is
   missing, STOP: R14's hand order is a precondition, not a checklist item.
4. **Emit findings AND dispositions in the task report.** «Self-check: OK» with no enumeration is a
   skipped phase.

## §5 Exit gates, seams, falsifiers, measured

- **Gates:** `pages-build` green under protection; and the **post-merge live probe** — `curl` over
  the WHOLE enumerated old-URL list (pages ∪ twins ∪ generated files) returns 200 as a real page or
  the tier-correct stub (R7/R21), and `/llms.txt`, `/llms-full.txt`, `/docs/manifest.json` return
  200 with `verified-at` = the pinned SHA; plus the **three D54 assertions of §1**. The dispatch
  chain is already proven by the trigger-only PR, so the first promote after cutover only has to
  re-confirm it. `pin-freshness.yml` (R22) is green within 24 h.
- **Seams:** the live-probe command **and its output** pasted into the cutover PR as a post-merge
  comment; the revert-rehearsal output in the PR body.
- **Falsifiers (verbatim):** any old URL 404s live → the enumeration was wrong; **regenerate
  `old-urls.txt` from the live surface rather than appending one row** (a file-shaped URL also needs
  the second stub shape, R7). The next promote does not redeploy → R4's falsifier, and R22 is what
  tells you within a day rather than whenever someone looks.
- **Measured:** the old-URL probe, N/N over the enumerated list (N ≈ 397 today, fixed at cutover by
  the enumeration command); time from promote to live deploy (expected under 15 min); R22's
  first-week red-run count.

## §6 Last acts before commit (non-negotiable 10)

1. Re-run the enumeration and confirm `old-urls.txt` still matches the **live** surface — it has
   been drifting the whole time S1 ran.
2. Confirm the four D54 routes are present in the diff as **kept**, and that the repointing
   sentence for `source.config.ts` is actually in the PR.
3. Confirm both stub shapes exist in the redirect writer, and that the coverage check passes over
   the full enumeration (R7/R21).
4. Confirm the revert build is green (R15) and its output is in the PR body.
5. `bash scripts/check-ask-files.sh` on the framework side — a RED ask file blocks every push.
6. Re-walk **this prompt's own citations** (non-negotiable 11).
7. Capture the diff's **hunk headers** and list, per shifted file, the citations INTO it that now
   sit past a shift point — into the PR body.

**Not a commit act, and not yours:** the merge. The operator merges the cutover PR.

## §7 Host-verify contract

```bash host-verify
test -f .claude/skills/orchestrator/SKILL.md
test -f .claude/skills/dispatcher/SKILL.md
test -f .claude/skills/harvest/SKILL.md
test -f .claude/skills/claude-glm-executor-handoff/SKILL.md
test -f .claude/skills/reviewer/SKILL.md
test -f agents/fidelity-auditor.md
test -f agents/claims-conformance-auditor.md
test -f docs/superpowers/specs/2026-09-14-getff-ai-rollout-and-cutover-design.md
test -f scripts/render-face-facts.mjs
test -f docs/site/hero-copy.json
bash scripts/check-ask-files.sh
```

`docs/site/hero-copy.json` is S0b's output and `scripts/render-face-facts.mjs` is S0a's: both lines
are red until those stages merge, and that is the point — the hero component this PR ships reads
`hero-copy.json` from the pin, so a cutover that runs before S0b would ship a component with no
props.

## §8 Out of scope

Writing or editing page content of any kind; the framework-side generator, quality layer and
conveyor (S0a/S0q/S1); and the two operator hands, which are hands, not tasks. Do not merge the
cutover PR, do not change branch protection, do not touch the secret. Do not edit the design specs;
a spec defect is a finding in the task report.

## §9 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps: **T3**, **T10**, **T14**, **T17**, **T18**, **T19**, **T21**.

- **T3** — every claim about a landing route carries the file and the line that decides it, read at
  the landing repo's **current** head.
- **T10** — the old-URL enumeration is the population; a redirect-coverage claim before it is
  meaningless.
- **T14** — «the twenty URLs I checked all resolved» at N ≈ 397 is «coverage insufficient to
  conclude». The probe is N/N or it is not a gate.
- **T17** — preservation happens **before** the destructive prompt is written (§2).
- **T18** — deletion is the irreversible branch and keeping is reversible. Verify the redundancy
  empirically before removing anything not on the list.
- **T19** — own cold re-read of the deletion list before handoff; this is the diff where a
  green CI says least.
- **T21** — the backward-check enumerates sibling surfaces, not this PR's files.

**Domain-specific trap — `T-S2-A` «the over-inclusive removal list».** D54 exists because a
removal list built from an *enumeration* (which URLs must redirect) was read as a *deletion* list
(which routes must go), and four working surfaces were nearly deleted — one of them a census URL
that must serve real content. Counter: every entry on the removal list names the file **and the
reason it must go**; a route whose only reason is «it was on the list» comes off the list.

**Domain-specific trap — `T-S2-B` «the stub that passes the probe».** A redirect stub returns 200,
so a probe that only checks status codes reports a green site while a census URL serves a stub.
Counter: R21's exclusion rule and §1 assertion 3 — `/rss.xml` must be **byte-identical to the
pre-cutover capture**, and `/sitemap-0.xml` must contain **no** stubbed URL.

**Domain-specific trap — `T-S2-C` «dated verification read as current state».** D54's route
findings were verified first-hand at `getff-landing@c091883`. That is a measurement with a date,
not a standing fact, and this stage deletes things on the strength of it. Counter: Phase 0 re-reads
all four routes at the landing repo's current head and STOPs on any mismatch
([`destination-environment-verification.md §1b`](../../rules/destination-environment-verification.md)
— a claim about live state carries a probe and a date, or it carries nothing).

## §10 D44 — names this stage invokes, measured at `6472bf6f2c7`

`orchestrator`, `dispatcher`, `pipeline`, `claude-glm-executor-handoff`, `harvest`, and at the PR
boundary `reviewer` + [`agents/fidelity-auditor.md`](../../../agents/fidelity-auditor.md) and
[`agents/claims-conformance-auditor.md`](../../../agents/claims-conformance-auditor.md) — all
**PRESENT** at the SHA above. No writing skill is invoked in S2: this stage ships no page content.
