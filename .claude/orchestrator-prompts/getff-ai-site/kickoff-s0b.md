# getff-ai-site S0b — the gold-pages chip (D40)

> **Umbrella:** [kickoff.md](kickoff.md) — §2 non-negotiables and §3 name census are binding.
> **Class:** stage kickoff (chip prompt). **Base branch:** `staging`. **Channel:** a **NEW clean
> Fable session** — never an aif profile, never the D28 design session, never the seat that wrote
> this file (non-negotiable 6). Fires **after S0q merges**.
> **Rigor label (effort-worthiness L0):** `research-grade` — the gold set is the exemplar the ~105
> S1 RUN pages are written against, and its measured REVISE rate is the denominator of S1's only
> RUN-half falsifier. A gold page that is wrong is wrong ~105 times over.
> **Authoritative for:** the S0b chip contract — venue, fire conditions, scope, the names it
> invokes, the exit gate, the measured numbers it must record, and the host-verify contract that
> **is S0q's exit gate**.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> the page designs, owned by D28 §5–§7 and
> [`2026-09-14-getff-ai-face-pages-design.md`](../../../docs/superpowers/specs/2026-09-14-getff-ai-face-pages-design.md);
> the quality contract, owned by
> [`2026-09-14-getff-ai-docs-quality-contract-design.md`](../../../docs/superpowers/specs/2026-09-14-getff-ai-docs-quality-contract-design.md).

**Measurement SHA for every `path:line` below:** `origin/staging` =
`79fa1b56b748899bc807f23ea8dfba9258e0acc3`. Every file cited here was read at that one ref.

> **Why this prompt is a FILE and not a block inside the umbrella kickoff.** §9's contract is
> S0q's exit gate, and `scripts/host-verify.sh` **concatenates every marked fence in one file**
> (measured: a two-fence fixture lists both commands under one run). Embedded in `kickoff.md`, a
> marked contract here would have fused with the umbrella's own §8 contract and turned it red
> until S0q merged; unmarked, it was invisible to the runner and S0q's exit was uncomputable.
> One artefact, one addressable contract, one command.

## §0 Venue — a fresh Fable session, and why

**Venue: a NEW clean Fable session. Never an aif profile, never the D28 design session, never
the session that dispatched it.** (Non-negotiable 6; P-U verbatim «a CLEAN Fable session»; D39's
amendment and D40.)

The reason is measured, not stylistic: the gold session is the first *stranger* to execute the
D28 §5–§7 and D30 specs, and if a fresh Fable cannot write five gold pages from them, the GLM
conveyor never will — learning that on five pages is the cheapest channel.

## §1 Fire conditions — the three D40 prerequisites, each an artifact event

**Fire the chip only when all three hold:**

1. this umbrella's cold pass returned GO — recorded in [`kickoff.md §6`](kickoff.md);
2. D30's fixed writing interface exists — the card, the six templates, the `terms.md` skeleton and
   the form gate — i.e. **S0q has merged**. This is the one prerequisite with a mechanical
   channel: it is exactly the first six lines of §9, and the contract exits 1 until they pass
   (D50; [`roll.md:106`](../../../docs/superpowers/specs/2026-09-14-getff-ai-rollout-and-cutover-design.md)
   names this «the D40 prerequisite (2) channel»);
3. S0a is merged, **or** its holes are stubbed with G18 tokens
   (D36, [`site-design.md:163`](../../../docs/superpowers/specs/2026-09-13-getff-ai-site-design.md)).

**Prerequisite (3) is a disjunction, so §9 asserts only its first arm** —
`test -f scripts/render-reference.mjs`, the S0a generator's landing on `staging`. If the stubbed
arm is the one taken instead, the operator firing this chip opts that line out explicitly
(`host-verify: none` with a rationale naming the G18 stub set) rather than deleting it. Asserting
the disjunction as a conjunction would make the contract wrong in a case the spec allows.

**Prerequisite (1) has no mechanical arm and is not given a fake one.** «The cold pass returned
GO» is a verdict in prose, not an artefact a `test -e` can see. It is checked by the operator at
fire time — legitimate, because firing this chip is a deliberate operator act and attention may
be the *authority* on a fact it cannot be the *detector* for
([attention-is-not-a-mechanism.md §1](../../rules/attention-is-not-a-mechanism.md)).

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

## §3 PHASE 0 — self-check BEFORE any production work (non-negotiable 8)

This stage has no container, so read non-negotiable 8 at its intent: the phase runs **in this
session, before the first page**, and it is verify-**and-repair**.

1. **Re-read this prompt against the cited spec lines** at `origin/staging`. Every `path:line`
   here was measured at the SHA above; `staging` moves daily. `scripts/check-line-citations.mjs`
   has two arms only — blame-based drift and a blank cited line — so **a citation that was wrong
   when written exits 0 silently** (non-negotiable 11).
2. **Run the §9 `host-verify` contract** — `bash scripts/host-verify.sh
   .claude/orchestrator-prompts/getff-ai-site/kickoff-s0b.md` — on the host. The **path** form:
   the slug form resolves to the umbrella's `kickoff.md` alone (`scripts/host-verify.sh:98`) and
   would report that file's lines instead of this contract.
3. **Fix what you find here**, not later; if a declared name is missing, STOP and surface rather
   than substituting a similar one.
4. **Emit findings AND dispositions in the closure note**, so a clean phase is visibly different
   from a skipped one.

## §4 Scope — the GOLD SET ONLY

([`site-design.md:51`](../../../docs/superpowers/specs/2026-09-13-getff-ai-site-design.md),
[`roll.md:105`](../../../docs/superpowers/specs/2026-09-14-getff-ai-rollout-and-cutover-design.md),
D41 at `site-design.md:168`): the 5 trial pages; the **11 face pages** — the pinned seven plus the
four `/docs/quickstart-<stack>/` stack pages (D48, `site-design.md:175`); family 1 (~20 pages)
with its gold cards hand-written against the generator S0a built (D24b seam); the glossary
CONTENT (the skeleton is S0q); the top-level artifacts D25(2) names; and the hero copy as
`docs/site/hero-copy.json` (D51 (3), `site-design.md:178`).

**Every remaining page is S1 RUN, not this chip.**

## §5 Names this chip invokes, by exact name (D44)

`docs-author` (S0q's output, wrapping the pinned `diataxis` plugin by pointer) and
`superpowers:verification-before-completion` (D13 — every example executed before a page is done).
The Opus gold review runs `docs-form-auditor` and
[`agents/claims-conformance-auditor.md`](../../../agents/claims-conformance-auditor.md).

Per D44 (`site-design.md:171`) each of those four names carries one `test -e` line in §9 — a name
invoked but never asserted degrades to silent substitution, which is the `#hope-as-gate` shape
D44 exists to close.

## §6 Exit gate, falsifier, and the numbers this stage MUST record

**Exit:** Opus gold review = GO on the 5 trial pages **before** family 1, then the D22 checkpoint
after family 1 ([`site-design.md:140`](../../../docs/superpowers/specs/2026-09-13-getff-ai-site-design.md)).
Verdict grammar `GO | REVISE | STOP`, `Failure-scenario:` on every round-triggering finding.

**Falsifier (D39 (c)):** the Fable gold session's five trial pages fail the Opus gold review
twice → the writing skill / quality contract (D30) needs work, **not** the seat. S0b does **not**
move to aif on that evidence.

**Measured — a closure note is part of the deliverable, not a courtesy.**
[`roll.md:105`](../../../docs/superpowers/specs/2026-09-14-getff-ai-rollout-and-cutover-design.md)
puts on this stage's row: «REVISE rate for post-compaction pages vs pre-compaction pages (R2). The
numbers land in the S0 closure note and decide how a Fable fallback chip for a GLM family (D41
falsifier a) is cut — one session per family or one across families.» So record, in an **S0
closure note** committed with the gold set:

1. pages written before the session's first compaction, and how many of them took a REVISE;
2. pages written after it, and how many took a REVISE;
3. both rates, and the ratio between them.

**Why it is load-bearing downstream, stated so it is not dropped as bookkeeping:**
[`kickoff-s1.md §6`](kickoff-s1.md) makes S1's only RUN-half falsifier «the RUN REVISE rate
exceeds **the gold pass's** by >2×». Without (2) above that test has no denominator and can never
fire, and the only mechanism that returns a family to Fable stays dead while ~105 pages ship.

## §7 Last acts before commit (non-negotiable 10)

Separate from §3, which ran before this work existed:

1. `bash scripts/host-verify.sh .claude/orchestrator-prompts/getff-ai-site/kickoff-s0b.md` on the
   host, and quote its output in the closure note.
2. Confirm the **S0 closure note** exists and carries all three §6 numbers. An exit reported
   without them is an unmet exit, not a rounding error.
3. Re-walk **this prompt's own citations** one final time (non-negotiable 11) — your own edits may
   have shifted lines in a file this prompt cites.
4. `bash scripts/check-ask-files.sh` — a RED ask file blocks every push.

## §8 Out of scope

Every page outside §4's gold set (that is S1 RUN); the quality contract itself (S0q built it —
use it, do not amend it); the generator (S0a); anything in the landing repository (S2); and the
design specs themselves — a gap in them is surfaced, never edited from here.

## §9 Host-verify contract

This block **is S0q's exit gate** ([`roll.md:106`](../../../docs/superpowers/specs/2026-09-14-getff-ai-rollout-and-cutover-design.md)):
every line below is an S0q or S0a artefact, and the contract exits 1 until they land. Run it on
the host — `bash scripts/host-verify.sh .claude/orchestrator-prompts/getff-ai-site/kickoff-s0b.md`.

```bash host-verify
test -f scripts/docs-check.mjs
test -f scripts/render-terms-style.mjs
test -f docs/site/terms.md
test -d docs/site-quality
test -f .claude/skills/docs-author/SKILL.md
test -f agents/docs-form-auditor.md
test -f agents/claims-conformance-auditor.md
test -n "$(find "$HOME/.claude/plugins/cache" -type d -name diataxis -print -quit)"
test -n "$(find "$HOME/.claude/plugins/cache" -type f -name SKILL.md -path '*superpowers*/verification-before-completion/*' -print -quit)"
test -f scripts/render-reference.mjs
npx vitest run packages/core/eslint-rules/no-unsafe-zod-parse.test.ts
FENCES_FIRE_STRICT=1 bash packages/core/audit-self/check-fences-fire.sh
```

The last two lines are **non-negotiable 2**: the R2 `no-unsafe-zod-parse` RED step belongs in this
chip's `host-verify` block and nowhere else. It is there because the npm quick-start page this
chip writes instructs a reader to make that rule go RED
([`face.md:160`](../../../docs/superpowers/specs/2026-09-14-getff-ai-face-pages-design.md)) — a
gold page must not promise a RED that does not fire. **Mind the two homes of that script:** in
this source repo it is `packages/core/audit-self/check-fences-fire.sh`; the
`scripts/check-fences-fire.sh` the page shows the reader is the **consumer** path AIF installs.
Citing the source path to a reader would be wrong, and citing the consumer path in this contract
would exit 1 forever. **`FENCES_FIRE_STRICT=1` is load-bearing, not decoration:** unset, the
script degrades a missing `tsx`/`eslint` to a SKIP and still exits 0
([`check-fences-fire.sh:34-38`](../../../packages/core/audit-self/check-fences-fire.sh)) — measured
in this very worktree, whose `node_modules/.bin` is empty, where the bare line reported
`PASS=0 FAIL=0 SKIP=1` and the runner scored it a PASS. A line that reports PASS having proved
nothing is `#contract-that-cannot-fail`
([`destination-environment-verification.md §4`](../../../.claude/rules/destination-environment-verification.md));
strict mode turns "the firing proof did not run" into a loud exit 1, whose remedy is to provision
the worktree (`bash scripts/worktree-node-modules.sh`), not to look away.

`test -f scripts/render-reference.mjs` is §1 prerequisite (3), first arm. The two `find` lines are
the plugin-cache form: a plugin skill has no repo path, so presence is asserted where the cache
actually is.

## §10 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps: **T2**, **T3**, **T5**, **T13**, **T14**, **T19**, **T21**.

- **T2** — a page that *describes* a command is not a page whose command was run. Every executable
  step in a gold page is executed at write time and its real output pasted, never paraphrased.
- **T3** — every claim about a source field carries the `path:line` **and** that line's content, or
  an explicit `INCONCLUSIVE-needs-human`.
- **T5** — a defect you notice outside the gold set is a **finding in the report**, never a
  drive-by edit; the gold set is §4 and nothing else.
- **T13** — the upstream `diataxis` plugin is installed by S0q, not audited by it. Adopting its
  quadrant vocabulary does not transfer its validation to our pages.
- **T14** — «four gold pages clean» with the other page kinds unwritten is «coverage insufficient
  to conclude», not «the gold set is clean».
- **T19** — run your own cold re-read of the diff before harvest; green CI is form, not substance.
- **T21** — the backward-check enumerates **sibling surfaces** where this change-class also holds,
  not the files this chip touched.

**Domain-specific trap — `T-S0B-A` «a page that promises a RED that does not fire».** The
quick-start page instructs its reader to make `no-unsafe-zod-parse` go RED. The tempting move is
to write those steps from the rule's *name* and its test file, because both are right there and
both look like evidence. They are not: the reader runs the prose, not the test. Counter — this is
why §9 carries the vitest line **and** why the vitest line is not sufficient on its own: execute
the page's steps as written, in order, in a clean checkout, and paste what the reader will
actually see. A green `no-unsafe-zod-parse.test.ts` with a mis-worded step is the exact shape of
a gold page that lies.

**Domain-specific trap — `T-S0B-B` «gold by self-assessment».** «Gold» is this chip's acceptance
word, and the author who just wrote a page is the worst-placed reader of it. The tempting move is
to declare the gold set met because it reads well to its writer. Counter: `docs-form-auditor` and
`claims-conformance-auditor` are the **detection** layer and both are named in §9 for that reason;
author judgement is merge authority at most, never detection
([attention-is-not-a-mechanism.md §1](../../rules/attention-is-not-a-mechanism.md)).

## §11 D44 — names this stage invokes, measured at `79fa1b56b74`

`docs-author` (**ABSENT until S0q merges** — that absence is the gate, not a defect),
`superpowers:verification-before-completion` (PRESENT), `docs-form-auditor` (**ABSENT until S0q
merges**), `claims-conformance-auditor` (PRESENT), and the `diataxis` plugin (**ABSENT** — hand
(0), R14, an operator install). Each carries its own `test -e` line in §9; see the umbrella
kickoff §3 for the full census.
