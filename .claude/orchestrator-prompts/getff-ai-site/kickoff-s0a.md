# getff-ai-site S0a — source-holes batch + the D29 generator BUILD + `render-face-facts.mjs`

> **Umbrella:** [kickoff.md](kickoff.md) — §2 non-negotiables and §3 name census are binding.
> **Class:** stage kickoff (dispatch input). **Base branch:** `staging`. **Channel:** aif on GLM.
> **Rigor label (effort-worthiness L0):** `research-grade` — this stage changes **source fields
> in shipped framework artefacts** (`maturity.json`, frontmatter descriptions, hook headers) that
> every later page derives from, and it builds the generator whose output the S0b gold cards are
> hand-written against. A wrong source field here is not a doc bug; it is a wrong fact rendered
> on ~125 pages.
> **Authoritative for:** the S0a stage contract — scope, the in-container self-check, the
> `--census`-first obligation, the exit gate, the last acts before commit, and the host-verify
> contract.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> the source-hole **item list**, which is owned by
> [`2026-09-14-getff-ai-face-pages-design.md`](../../../docs/superpowers/specs/2026-09-14-getff-ai-face-pages-design.md)
> §10 item 2 and is never restated here; the generator's design, owned by
> [`2026-09-14-getff-ai-reference-generator-design.md`](../../../docs/superpowers/specs/2026-09-14-getff-ai-reference-generator-design.md).

**Measurement SHA for every `path:line` below:** `origin/staging` =
`15b3ac8bedbf8184a82e4b7ce73d71d6184e8f50`. Every file cited here was read at that one ref.
Pinning every file of one answer to the **same** ref, and saying which, is not a formality — it
is the counter to this umbrella's dominant defect (umbrella kickoff §7, `T-GA-A`).

## §0 Why this stage runs first

S0a is the interval D14d assumed and D36 located: the generator runs in `--write` mode here to
enumerate holes, and the two-way completeness test is **S0a's exit criterion**, not a gate on a
page ([`site-design.md:163`](../../../docs/superpowers/specs/2026-09-13-getff-ai-site-design.md),
D36). Two consequences fix the order and neither is negotiable:

- The **generator cannot be built in a later stage.** S0a's own exit runs it, and S0b hand-writes
  the gold cards AGAINST it (the D24b byte-identity seam)
  — [`roll.md:68`](../../../docs/superpowers/specs/2026-09-14-getff-ai-rollout-and-cutover-design.md), R16.
- **`scripts/render-face-facts.mjs` is S0a work too.** It reads `maturity.json`, created in this
  stage, and writes `docs/site/face-facts.json`, which S0b's face pages need at the pin
  ([`site-design.md:169`](../../../docs/superpowers/specs/2026-09-13-getff-ai-site-design.md), D42).

Measured at the SHA above: `scripts/render-reference.mjs` and `scripts/render-face-facts.mjs`
are **ABSENT** from the repo. That is expected — they are this stage's deliverables — and it is
also why the derived census figures in D29 §0/§5 are labelled PRE-MEASUREMENT (D55,
[`site-design.md:182`](../../../docs/superpowers/specs/2026-09-13-getff-ai-site-design.md)).

## §1 Scope

**In scope, by pointer — never re-enumerated here:**

1. The source-hole item list **owned by** `2026-09-14-getff-ai-face-pages-design.md` §10 item 2
   (D28's §10 is a flat list; «§10.2» means item 2), plus the two items the umbrella places and
   D28 folds by pointer: the D29 generator BUILD and `scripts/render-face-facts.mjs`
   ([`site-design.md:49`](../../../docs/superpowers/specs/2026-09-13-getff-ai-site-design.md),
   the S0a row of the stage skeleton).
2. `packages/core/manifest/maturity.json` + its schema (D32 as amended: per-positional rows +
   `caveat`); the D14d source fields (frontmatter descriptions, `package.json` descriptions,
   fires-at); `setup cargo|go`; the hook headers in the `# <basename> — <one line>` grammar with
   `check-hook-marker.sh` arm 2 and the generator arm F backstop.
3. The D29 generator BUILD — `scripts/render-reference.mjs` with its `--check`, `--write` and
   `--census` modes (`ref-gen.md:112` defines `--census`; arms A–F per its §3).
4. The `scripts/render-face-facts.mjs` BUILD (D42).
5. The `fire-on-your-code` first-steps SSOT step with `renders[1]` re-pointed at
   `/docs/installation/`; the four lineage citations in `skills/getff/references/` (D28 §5.6.2).
6. Twin/baseline regeneration for everything the above touches.

**Explicitly NOT in scope here** (it moved to S0q, where it was a second copy): the
`docs/site/terms.md` skeleton and its fence
([`site-design.md:50`](../../../docs/superpowers/specs/2026-09-13-getff-ai-site-design.md), D50).

**Absence discipline (D36, binding).** Two absences must never be confused:
**absence-by-construction** (the fact does not exist for this member) gets the **G18 token**;
**absence-by-omission** (the source field exists for the family but this member lacks it) **fails
the build**. A literal empty cell is never an outcome, and a placeholder value in `maturity.json`
or any manifest is a **forbidden invented value** — an unknown maturity fact is an operator
question raised in this stage, never a placeholder.

## §2 The eleven non-negotiables — verbatim

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

## §3 PHASE 0 — in-container self-check BEFORE any production work (non-negotiable 8)

**Do this first, inside the container, before writing a single production line.** It is a
verify-**and-repair** phase: what it finds, it fixes here, and what it fixed is reported.

1. **Re-read this prompt against the cited spec lines.** For every `path:line` in §0–§1 and §5,
   open the cited file at `origin/staging` and check that the line still says what this prompt
   claims. Do not trust `scripts/check-line-citations.mjs` for this — it has exactly two arms
   (blame-based drift; blank cited line), so **a citation that was wrong when written returns
   exit 0 with no output** (non-negotiable 11). This walk is the only thing that sees that class.
2. **Run the §9 `host-verify` contract** — `bash scripts/host-verify.sh getff-ai-site` against
   this stage's kickoff — and the repo's own gates that apply to your diff.
3. **Fix what you find here**, not later. If a citation drifted, correct it in the prompt copy you
   work from and report the correction; if a declared name is missing, STOP and surface rather
   than substituting a similar one.
4. **Emit findings AND dispositions in the task report**, so a clean phase is visibly different
   from a skipped one. «Self-check: OK» with no enumeration is a skipped phase.

## §4 Method — `--census` first (non-negotiable 3, D55 verbatim)

> run `scripts/render-reference.mjs --census` as the batch's FIRST act and replace D29's §0/§5
> derived figures in the same batch PR

That clause is D44's D55 amendment, quoted as written
([`site-design.md:171`](../../../docs/superpowers/specs/2026-09-13-getff-ai-site-design.md)).
It has a precondition this stage must honour: the census cannot run before the generator exists,
so the order inside S0a is **build `render-reference.mjs` (TDD) → `--census` as the batch's first
act → source-hole fixes → `--write` for the holes census → replace the derived figures in the
same PR**.

Why it matters, stated so nobody reads a stale number as a threshold: the derived figures
(«31/53 wired», «21 cards», «10 gated», «22 unwired», «13/18 headed», «1/21 hooks», «20 hooks»)
**cannot be recomputed today** — no script implements `--census` and the session that produced
them ran an ad-hoc census never committed (D55). No consumer reads one as a threshold, so they
carry a pre-measurement marker; this stage is their named closer.

**D55 falsifier, carried verbatim:** any D29 §5 batch row or this stage's work that reads a
derived figure as an exit THRESHOLD from the spec rather than from the census output → verdict B
leaves a hole and that row must be rewritten to read the census.

**The generator is built test-first.** `superpowers:test-driven-development` owns the loop
(CLAUDE.md «Skill routing bindings»; never `mattpocock-skills:tdd`), and its arms A–F are
**live-fired** — an arm asserted but never fired RED is `#hope-as-gate`.

## §5 Exit gate, seam, falsifier, measured

The rollout spec's stage table has no S0a row today
([`roll.md:99`](../../../docs/superpowers/specs/2026-09-14-getff-ai-rollout-and-cutover-design.md)
records that as the umbrella owner's open call, and
[`roll.md:146`](../../../docs/superpowers/specs/2026-09-14-getff-ai-rollout-and-cutover-design.md)
carries the stage only as a bullet). **This section is S0a's contract until that row lands** — a
stage whose exit is not contracted anywhere has no contracted exit at all.

- **What happens:** R16 ([`roll.md:68`](../../../docs/superpowers/specs/2026-09-14-getff-ai-rollout-and-cutover-design.md))
  and the R14 «who runs what where» row
  ([`roll.md:137`](../../../docs/superpowers/specs/2026-09-14-getff-ai-rollout-and-cutover-design.md)).
- **Exit:** the ordinary framework PR gates, **plus** the D36 holes census run in `--write` mode
  with arm C green on every family — population ↔ cards 1:1 and zero absence-by-omission
  ([`ref-gen.md:198`](../../../docs/superpowers/specs/2026-09-14-getff-ai-reference-generator-design.md)).
- **Seam:** the `--write` run leaves **zero unfilled holes**, and `docs/site/face-facts.json`
  exists (D42). The D24b byte-identity seam is **NOT** S0a's — it runs at S0b's gold-card PRs,
  because the cards are written against the generator this stage builds.
- **Falsifiers (D36, verbatim):** (a) a page renders a token for a member whose family declares
  that field as sourced → absence-by-omission leaked through the token, arm D is not paired to
  that field; (b) **S0a exits with the completeness test red on any family → the interval was not
  S0a, re-open**; (c) a `maturity.json` row carries a value no operator decision or measurement
  backs → placeholder, delete and ask.
- **Measured:** D36 holes at start vs at exit; the number of S0a PRs; and the merge date, which
  starts the interval `roll.md:106` measures («days between S0a merge and S0q merge»).

## §6 Last acts before commit (non-negotiable 10)

The Phase-0 self-check is **blind to post-build omissions by construction** — it ran before the
work existed. This list is separate and runs last, every commit:

1. `npx tsx scripts/render-reference.mjs --write` — the only channel that FILLS the generated
   fences and derives `sources:` is `.husky/pre-commit`
   ([`ref-gen.md:201`](../../../docs/superpowers/specs/2026-09-14-getff-ai-reference-generator-design.md)),
   and **aif containers do not run the repo's git hooks**, so the container must run it by hand as
   its LAST act before every commit
   ([`roll.md:107`](../../../docs/superpowers/specs/2026-09-14-getff-ai-rollout-and-cutover-design.md), (e)).
   The harvest seat re-runs it **on the host** and amends before opening the PR.
2. Re-run `--census` and confirm the D29 §0/§5 derived figures in the PR match its output. If they
   do not, the figures were edited from memory.
3. Regenerate twins and baselines for everything touched; confirm no generated file is stale.
4. `bash scripts/check-ask-files.sh` — a RED ask file blocks every push.
5. `bash scripts/host-verify.sh getff-ai-site` against this kickoff, on the host, and quote its
   output in the task report.
6. Re-walk **this prompt's own citations** one final time (non-negotiable 11) — your own edits may
   have shifted lines in a file this prompt cites.
7. Capture the diff's **hunk headers** for every file you changed and list, per shifted file, the
   citations INTO it from the five specs that now sit past a shift point. That list goes in the PR
   body. This is the only cheap counter to `T-GA-A`; no gate performs it.

## §7 Out of scope

The quality layer (S0q — `docs-check.mjs`, `render-terms-style.mjs`, `terms.md`, `docs-card`,
`docs/site-quality/`, the `docs-author` skill, the `docs-form-auditor` agent, the `diataxis`
install); any page content (S0b and S1 RUN); anything in the landing repository (S1/S2); and the
`check-docs-refresh.mjs` refresh gate with its channels (S1 BUILD). Do not open PRs outside this
stage's scope and do not edit the design specs — a spec defect is a finding in the task report.

## §8 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps: **T2**, **T3**, **T5**, **T10**, **T14**, **T17**, **T19**, **T21**.

- **T2** — a declared generator arm is not a fired one. Each of arms A–F must have a RED run
  quoted in the report, not a description.
- **T3** — every claim about a source field carries the `path:line` **and** the line's content, or
  an explicit `INCONCLUSIVE-needs-human`.
- **T5** — a source-hole you notice outside this stage's item list is a **finding in the report**,
  never a drive-by edit.
- **T10** — `--census` enumerates the population **before** any coverage claim about holes. This is
  the whole reason it is the batch's first act.
- **T14** — «arm C green on three families» with the other families unrun is «coverage insufficient
  to conclude», not «clean».
- **T17** — before any destructive regeneration (`refresh_safe` payloads replace whole
  directories), preserve content with future value first; the executor will not save it for you.
- **T19** — run your own cold re-read of the diff before harvest; green CI is form, not substance.
- **T21** — the backward-check enumerates **sibling surfaces** where this change-class also holds,
  not the files this PR touched.

**Domain-specific trap — `T-S0A-A` «pre-measurement figure read as a threshold».** D29's §0/§5
derived figures look like measurements and are labelled PRE-MEASUREMENT precisely because they
cannot be recomputed today. The tempting move is to treat «31/53 wired» as the target the census
must reproduce, and to tune the predicate until it does. Counter: the census output is the
measurement and the spec figure is the thing being **replaced**; if they disagree, the spec figure
is what changes. D55's own falsifier says the same in the other direction.

**Domain-specific trap — `T-S0A-B` «placeholder that looks like a fact».** `maturity.json` rows
are the source every later page derives from, and a plausible-looking value fills a gate-shaped
hole with no error anywhere. Counter: D36's closed G18 enum for absence-by-construction, a build
failure for absence-by-omission, and an operator question for an unknown fact — **never** a
free-text reason and never a value.

## §9 Host-verify contract

```bash host-verify
test -f .claude/skills/orchestrator/SKILL.md
test -f .claude/skills/dispatcher/SKILL.md
test -f .claude/skills/harvest/SKILL.md
test -f .claude/skills/claude-glm-executor-handoff/SKILL.md
test -f .claude/skills/reviewer/SKILL.md
test -f agents/fidelity-auditor.md
test -n "$(find "$HOME/.claude/plugins/cache" -type f -name SKILL.md -path '*superpowers*/test-driven-development/*' -print -quit)"
test -f docs/superpowers/specs/2026-09-14-getff-ai-face-pages-design.md
test -f docs/superpowers/specs/2026-09-14-getff-ai-reference-generator-design.md
test -d packages/core/manifest
bash scripts/check-ask-files.sh
```

**This contract is GREEN on the host today, and that is the point.** S0a is the first stage to
dispatch, so its contract must discriminate between «a precondition is missing» and «a later
stage has not run yet»; a red line here is a real stop.

Three deliberate absences, each because the thing is this stage's own **deliverable** and a
contract demanding it would exit 1 before the stage could start: `scripts/render-reference.mjs`,
`scripts/render-face-facts.mjs`, and `packages/core/manifest/maturity.json` — measured at the SHA
above, **none of the three exists**, and `site-design.md:49` says `maturity.json` is «created in
this stage». What the contract asserts instead is `packages/core/manifest/`, the directory the new
manifest and its schema land in beside the existing `rules-manifest.json` (`site-design.md:156`).
The existence of the two scripts is asserted by the S0q and S1 contracts, where it is a genuine
precondition.

*(This paragraph exists because the first draft of this contract asserted `maturity.json` itself
and went RED on the host in this kickoff's own Phase -1 cold review — the exact `T-S0A-A` shape of
reading a stage's output as its input.)*

## §10 D44 — names this stage invokes, measured at `15b3ac8bedb`

`orchestrator` (kickoff + Worker prompts), `dispatcher` (probe-inflight + dispatch), `pipeline`,
`claude-glm-executor-handoff` (every GLM Worker prompt), `harvest` (egress to PR),
`superpowers:test-driven-development` (the generator BUILD with its live-fired arms A–F and every
build script), and at the PR boundary `reviewer` + [`agents/fidelity-auditor.md`](../../../agents/fidelity-auditor.md).
All **PRESENT** at the SHA above — see the umbrella kickoff §3 for the full census, including the
names that are absent until S0q builds them and are therefore checked at **their** stage's
dispatch, never here.
