<!-- bridge: skip -->
# beta-docs-encyclopedia — umbrella E kickoff

> **Type:** umbrella kickoff, **factory-dispatched** through aif project `361685f1-6fe0-407d-a492-ebcfa259407f` (`artyhoo/getff-landing`, container base `/home/www/getff-landing`). `bridge: skip` is load-bearing: this repo's auto-dispatch hook targets this repo's own aif project; every E-stage task is created on the getff-landing project explicitly (see [`kickoff-e1.md`](kickoff-e1.md) §6). **Spawned by operator dispatch 2026-09-11**, one day after BS3 GREEN (cutover merge `8104eabf`, umbrella closed in getff#1711): the site is LIVE, so every stage below works against a published surface — landing `main` changes only through reviewed PRs, and no stage ever publishes silently.
> **Parent frame:** [`docs/superpowers/specs/2026-07-23-beta-program-design.md`](../../../docs/superpowers/specs/2026-07-23-beta-program-design.md) §5-§8 — the docs-claims assembly gate (row F5) is this umbrella's ancestry. `npm publish getff` (phase 2) and the announcement publish (phase 3) stay parked there, not here.
> **Rigor label (effort-worthiness L0):** `research-grade` at the umbrella level — the output is consumer-shipped claims on the live public site, exactly the class a wrong claim cannot be retracted from (caches, `llms.txt`, mirrors). Per-stage labels live in each stage kickoff (E1: `build-and-verify` branch carrying research-grade census input).

<!-- host-verify: none — umbrella/dispatch kickoff: it authors no executable deliverable in this repo. Each stage's acceptance commands are declared and quoted in that stage kickoff's own §3 gate table (E1: landing-repo reads and diffs, run inside the aif container). -->

## §0 Goal — two questions, answered by execution

1. **Freshness.** Is every claim the live site makes about the framework still true at the
   CURRENT staging HEAD? The BS3 audit went GO on landing `b782f51` against framework pin
   `94a3a9efcd`. Staging has moved (35 commits at authoring time) and a pin is not a license
   for forever: drift gets re-measured (E1), fixed (E2+), and cold-audited (E-final) — never
   waved through.
2. **Coverage.** Is every capability the installer actually ships documented on the site?
   The operator's verdict on 2026-09-11: no — the product has outgrown "rules as tests" into
   a full multi-harness factory (skills, hooks, scripts, rule/test generation, the AI-doc
   system, harness agnosticity), and the site documents only the showcase slice. Every gap
   gets a **raw draft page on the live site**, enumerated from the implementation, never
   from the existing docs.

**Raw-first is the umbrella's contract with the operator (2026-09-11):** draft pages land
raw — factual, anchored, plain is fine. Polish, UX, restyle and sellability work is a
LATER, operator-owned pass outside this umbrella. A stage that polishes instead of
enumerating has stolen scope; a draft blocked on prettiness is a violated stage.

## §1 Stage table

| Stage | Shape | Type | Gate out |
| --- | --- | --- | --- |
| E1 — census + drift | ONE aif task, read-only | enumerate every shipped capability per family (§2) against the implementation; re-measure drift of the existing site claims; re-measure the 7 known defects | census GREEN; the MISSING set explicit (it scopes E2+) |
| E2..E5 — family drafts | ONE aif task per family, parallelizable once E1 is harvested (project has `parallelEnabled: true`; isolate per the parallel-subwave rule) | raw reference pages per the §2 schema under `content/docs/reference/`; fix E1's drift GAPs in the EXISTING pages, sentence-level | build green; census-coverage: every family item documented or drafted or a recorded finding; a ledger row for every new claim |
| E6 — cold audit + closure | cold auditor ([`agents/claims-conformance-auditor.md`](../../../agents/claims-conformance-auditor.md)) + host session | full claims audit over every new/changed page at a fresh pin; REVISE loop; PRs merged; `done.md` on staging | GO + umbrella closed |

Stage kickoffs are authored at their dispatch time — [`kickoff-e1.md`](kickoff-e1.md) is the
only one that exists at spawn. An E2+ kickoff instantiates §2 below with its family's census
facts: it adds §1 entry facts, never new scope, and inherits §3 floors unchanged.

## §2 The raw-page contract (binding for every E2+ page)

### Families (E1 may refine boundaries, never shrink the union)

- **A — Skills:** every skill the installer ships, per tier arm (core / env+ / factory+),
  from `setup.d/10-skills.sh` and the template payload — what each does, how it works, which
  satellites it uses and adapts, and what it adds over them.
- **B — Hooks:** every shipped hook and its channel(s) — edit-time injectors, pre-commit,
  pre-push, end-of-turn — including per-lane hook delivery (the python local rung, the
  npm-only `scripts/` asymmetry).
- **C — Scripts:** every consumer-reachable script and what it probes.
- **D — Rules & test generation:** the rules-as-tests core — rule authoring, Convention IR,
  backend renders, firing tests / principle tests / mutation gates: how a rule becomes an
  executable artifact at each channel.
- **E — Enforcement backends:** every backend the renderer emits (npm-eslint, ruff, clippy,
  astgrep, the cargo-deny starter, deferred mypy) with the honest FF7001/FF7002 routing
  vocabulary the framework itself prints.
- **F — Installer lanes:** npm / python / cargo / go — what each lane actually delivers
  (hooks, scripts, templates) and what it does not.
- **G — AI-doc system:** AGENTS.md/CLAUDE.md discipline, the doc-authority hierarchy,
  `getff:begin` generated regions and their renderers, the `.ai-factory/` payload
  (AI-USAGE-GUIDE, tier-home, the first-steps SSOT), session bootstrap.
- **H — Harness agnosticity:** CC/ZCode parity (hook twins, dual-implementation
  discipline), the off-CC AGENTS.md, runtime profiles and presets, the runtime-bridge
  (dispatch + review-state return channel), the aif factory loop (dispatcher/harvest).
- **I — Plugin surface:** the `getff` plugin — its skills, marketplace install, the
  install-enforcement bridge and its per-stack options.

### Page schema (verbatim shape for every draft page)

```markdown
---
title: <Item>
description: <one factual line, no claims beyond the page's evidence>
---
<!-- provenance: framework @ <commit-read> <date> · raw draft (beta-docs-encyclopedia) —
     polish pass pending; re-derive from the anchors below, do not hand-edit prose -->

# <Item>

**Status:** <label: shipped-beta | experimental | planned | lane-partial …> ·
**Ships to:** <lanes / tier arms> · **Fires at:** <channel(s)>

## What it is

## How it works

## Satellites & companions

<!-- what upstream/peer capability it USES, what it ADAPTS, what it ADDS over them -->

## Anchors

<!-- the file:line list, each anchor with its line's content quoted at authoring time -->
```

### Rules that bind the drafts

1. Enumerate from the implementation — E1's census is the scope SSOT. A page drafted from
   another page or from memory is a stage failure (T12).
2. Every capability sentence gets a CLAIMS-LEDGER row (evidence anchor) or an explicit
   `experimental`/`planned` label — the D7 discipline, unchanged from BS2.
3. New pages wire the BS1 machinery: the `app/docs/<slug>.md` twin, `llms.txt` /
   `llms-full.txt` inclusion, the search index — verified by the stage gate, not assumed.
4. Drift fixes in EXISTING pages are minimal sentence-level corrections of the false claim;
   everything beyond that sentence belongs to the operator's polish pass.

## §3 Floors and parks (umbrella-level, inherited by every stage)

- **No framework-repo changes.** Framework defects are findings (the BS3 precedent): the 7
  known defects get re-measured and folded into E1's report; fixing them is a separate
  operator dispatch.
- **Landing `main` only via reviewed PRs** (merge-commit — the post-cutover convention of
  PRs #5-#9). Workers commit on task branches; the host harvests and opens the PRs.
- **The announcement stays `draft: true`** (parent §7 phase 3). Touching its frontmatter is
  a finding against the stage.
- **No styling / UX / restyle work anywhere in this umbrella** — the §0 raw-first contract.
- **The dynamic-docs rule** (change something → immediately update the docs) is a FUTURE
  rule the operator wants AFTER this umbrella lands and the docs are verified; E6's
  `done.md` records it as the proposed next step. It is not built, gated, or prototyped
  here.
- **Operator parks:** the visual sign-off (open since BS3 leg B step 6), `npm publish`
  (parent §8 phase 2), the announcement publish (parent §7 phase 3).

## §4 Known inputs — re-measure, never rediscover

- The BS3 audit: GO on `b782f51` against framework pin `94a3a9efcd`; 133 VERIFIED / 0 GAP /
  8 UNVERIFIABLE. Dispositions in landing `CLAIMS-LEDGER.md` §BS3 rounds 2-9.
- The drift window `94a3a9efcd..1c9d711cee` (35 commits at authoring). Load-bearing for
  site claims: #1694 runtime-bridge review-state, #1702 bootstrap digest block, #1707
  merge policy, #1708-#1710 zcode-parity, #1712 closure sweep.
- The 7 framework defects in landing `BS3-REPORT.md` §Findings: 4 stale
  `first-steps.source.json` texts; `AI-USAGE-GUIDE.md:195-196` + `DESCRIPTION.template.md:61`
  (the consumer pre-push triad); `root-agents-demo.test.ts:145-146` (stale `!CI` comment);
  the "nothing queued" phantom in the run-pipeline SSOT; `tier-home.md` §3 stale CLAUDE.md
  quotes; the `Type:` vocabulary fork.
- The landing surface set (the docs pages, blog, landing/consulting page components, llms
  routes, frontmatter `description` fields) — the `BS3-GAPS.md` census table is the
  enumeration template.

## §5 Umbrella traps (in addition to each stage's T-list)

- **T-ENC-A — «documented because mentioned»:** an item counts as covered only when a
  page's SENTENCE documents the behavior and that sentence survives checking — a title or a
  matching word is not coverage. E1's census gate enforces this; E6 audits it cold.
- **T-ENC-B — «census from the docs»:** the inventory is enumerated from the implementation
  (setup manifests, hook directories, template payloads) and THEN cross-checked against the
  site — never derived from the site. A census that starts from the site inherits the
  site's blind spots.
- **T-ENC-C — «polish creep»:** a draft task drifts into styling, rewording, or improving
  existing pages beyond drift fixes. Counter: the §0 raw-first contract and the §3 floor;
  the polish pass is the operator's, later.
