# getff-ai-site S0q — quality-layer build (D50)

> **Umbrella:** [kickoff.md](kickoff.md) — §2 non-negotiables and §3 name census are binding.
> **Class:** stage kickoff (dispatch input). **Base branch:** `staging`. **Channel:** aif on GLM,
> **after S0a merges** — region (b) of `terms.md` needs the S0a generator.
> **Rigor label (effort-worthiness L0):** `research-grade` — this stage ships **enforcement
> surfaces** (a pre-push section, a CI arm, a pre-commit section, an ESLint-class form gate) whose
> failure mode is a silent green on every page written afterwards, and it ships the `docs-author`
> skill that ~125 pages are written with.
> **Authoritative for:** the S0q stage contract — scope, the in-container self-check, the
> `docs-card` check's name and shape, the exit gate, the last acts before commit, and the
> host-verify contract.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> the quality contract itself, owned by
> [`2026-09-14-getff-ai-docs-quality-contract-design.md`](../../../docs/superpowers/specs/2026-09-14-getff-ai-docs-quality-contract-design.md);
> the build-vs-reuse verdict — [`build-first-reuse-default.md`](../../rules/build-first-reuse-default.md).

**Measurement SHA for every `path:line` below:** `origin/staging` =
`79fa1b56b748899bc807f23ea8dfba9258e0acc3`. Every file cited here was read at that one ref.

## §0 Why this stage exists and where it sits

D30's build had an owner and **no stage** — two independent cold seats converged on it in the
final pass (TD MAJOR-3 = BU MAJOR-3), and D50 gave it one: **S0q, between S0a and S0b**
([`site-design.md:177`](../../../docs/superpowers/specs/2026-09-13-getff-ai-site-design.md)). The
position is load-bearing in both directions: it builds **after** S0a because region (b) of
`terms.md` needs the S0a generator, and **before** S0b because it *is* D40's prerequisite (2) —
the fixed writing interface the gold session writes against
([`roll.md:106`](../../../docs/superpowers/specs/2026-09-14-getff-ai-rollout-and-cutover-design.md)).

Opus writes D30's plan (P-R) **while S0a runs**, using `superpowers:writing-plans`; aif on GLM
builds it after S0a merges; the result is harvested to a framework PR. Nothing in the landing
repository is touched.

## §1 Scope — D30's build items, by pointer

The item list is owned by
[`qual.md:272`–`:275`](../../../docs/superpowers/specs/2026-09-14-getff-ai-docs-quality-contract-design.md)
and is not re-enumerated here beyond the names needed to write a contract:

1. `scripts/docs-check.mjs` + its pre-commit section + the Vale and lychee pins + the
   `audit-self.yml` job.
2. `scripts/render-terms-style.mjs`.
3. The `docs/site/terms.md` skeleton with its fence — **moved here from the S0a list**, where it
   was a second copy (D50).
4. The `Docs-card:` pre-push section + its `audit-self.yml` arm — **§2 below fixes its name and
   shape**.
5. `docs/site-quality/` — Vale profile, vocabulary, calibration record.
6. Install of the `pfeff/claude-skills` `diataxis` plugin pinned at `657c61c5ca8c`
   (`claude plugin install pfeff/claude-skills`) — **a HOST action, not container work.** It is a
   hand on D31's R14 list; reversible and secret-free, so the umbrella seat may perform it (D50).
   Measured at the SHA above: **ABSENT on this machine.** The container must not attempt it.
7. The `docs-author` skill (a thin project skill wrapping the installed plugin **by pointer**,
   D-Q8 at `qual.md:104`) + the `docs-form-auditor` agent, both per the `ai-doc` discipline.
8. The two SSOT rows (author discipline, D-Q15 at `qual.md:111`).
9. The self-test fixtures `docs-check.mjs` needs, per D30.

## §2 The `Docs-card:` check — name, shape and channel (advisor ruling d65, fork 2)

**The check is named `docs-card`, and the name IS the `SECTIONS` id.** Not a near-miss, not a
second script.

- **One registry entry:** `{ id: 'docs-card', owner: 'maintainer', run: … }` in the `SECTIONS`
  array of `packages/core/hooks/pre-push.ts`. Measured at the SHA above, that array opens at
  `packages/core/hooks/pre-push.ts:2016` (`const SECTIONS: readonly PrePushSection[] = [`) and
  closes at `:2130` (`];`), carrying **28** ids. This entry makes 29.
- **Backed by `packages/core/hooks/checks/docs-card.ts` + `docs-card.test.ts`** — the
  `prior-art.ts` twin, whose registry entry sits at `pre-push.ts:2092`
  (`{ id: 'prior-art', owner: 'maintainer', run: (c) => priorArtSection(c.rb) },`).
- **ONE CI step**, never a second script:
  `PREPUSH_ONLY=docs-card npx tsx packages/core/hooks/pre-push.ts` over the PR range. The
  precedent is measured, not analogised: `.github/workflows/audit-self.yml:1127` is
  `run: PREPUSH_ONLY=prior-art npx tsx packages/core/hooks/pre-push.ts`, its `s17` twin is at
  `:1115`, and the seam's own rationale comment is at `:1056`.
- **The naming rule is measured, not an analogy:** the sibling rule is «id = the trailer it
  checks, lower-kebab» — `prior-art` ↔ `Prior-art:`, so `docs-card` ↔ `Docs-card:`. Sibling ids
  read in place at the SHA above: `line-citations` `pre-push.ts:2034`, `kickoff-portability`
  `:2051`, `unpinned-tool-install` `:2110`, `ask-file-schema` `:2126`.

  **These seven numbers moved once already.** They were true at `6472bf6f2c7`, the SHA this file
  was first pinned to, and every one of them was **+20 wrong** four commits later (PR #1774
  inserted a section above them) — measured,
  not hypothesised. That is trap `T-GA-A` firing on this stage's most-cited file, and no gate
  catches it: `check-line-citations.mjs` has no freshness arm. Re-measure all seven in Phase 0
  with `grep -n "id: '<name>'" packages/core/hooks/pre-push.ts` before you trust one.
- **Do not route this through `prior-art.ts`.** It cannot fire for `docs/site/**` by construction:
  `packages/core/hooks/checks/prior-art.ts:229` is
  `if (!path.startsWith('packages/core/')) continue;` and `:247` is
  `if (!path.startsWith('packages/')) continue;`.
- **`qual.md:274` and the D44 `host-verify` list both gain**
  `test -e packages/core/hooks/checks/docs-card.ts`.

**Builder note — this is a capability commit.** `packages/core/hooks/checks/docs-card.ts` at ≥80
LOC anywhere under `packages/` trips the CLAUDE.md capability-commit definition, so the commit
**must** carry a `Prior-art:` trailer naming a resolvable referent — the `prior-art.ts` precedent
is the obvious one, cited as an artefact path. A referent-free
`Prior-art: consulted — no entry applies` is rejected by the gate and is the `#hope-as-gate` shape
of [`attention-is-not-a-mechanism.md §2`](../../rules/attention-is-not-a-mechanism.md). Its
`docs-card.test.ts` sibling is test material and does not itself trip the detector.

**What the check must detect** (D-Q16, `qual.md:112`): a commit touching `docs/site/**/*.md` prose
without a `Docs-card:` trailer is blocked at pre-push, and the CI arm catches the same over the PR
range — because **aif containers never run the repo's git hooks**, so a pre-push-only gate is
blind to exactly the population that writes most of the pages (`qual.md:377`). Ship the paired
negative: a fixture PR range with one prose commit lacking the trailer must FAIL
(`qual.md:257`).

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

Verify **and repair**, inside the container, before writing a production line:

1. **Re-read this prompt against the cited spec lines** — every `path:line` in §0–§2 and §5. The
   `SECTIONS` bounds and the sibling ids in §2 are the ones most likely to have moved, because
   `pre-push.ts` is edited constantly and **every id added by anyone shifts every id below it**.
   Read them, do not trust them. `scripts/check-line-citations.mjs` will not help: its two arms
   are blame-based drift and a blank cited line, so **a citation wrong when written exits 0
   silently** (non-negotiable 11).
2. **Run the §9 `host-verify` contract** — `bash scripts/host-verify.sh
   .claude/orchestrator-prompts/getff-ai-site/kickoff-s0q.md` — and the repo's gates that apply
   to your diff. The **path** form, never the slug form: `host-verify.sh getff-ai-site` resolves
   to the umbrella's `kickoff.md` alone (`scripts/host-verify.sh:98`) and returns its always-green
   lines, which say nothing about this stage.
3. **Fix what you find here.** If `SECTIONS` moved, correct the numbers in your working copy of
   this prompt and report the correction. If `docs-card` already exists, STOP and surface — a
   second implementation is `#sync-by-copy-paste`, not progress.
4. **Emit findings AND dispositions in the task report.** «Self-check: OK» with no enumeration is
   a skipped phase.

## §5 Exit gate, seam, falsifier, measured

- **Exit — one command, and it is not this stage's own contract:**

  ```text
  bash scripts/host-verify.sh .claude/orchestrator-prompts/getff-ai-site/kickoff-s0b.md
  ```

  Every S0q `test -e` line of the **S0b chip's `host-verify` contract** must pass on the host —
  that is D40 prerequisite (2)'s channel, and the chip exits 1 until it does
  ([`roll.md:106`](../../../docs/superpowers/specs/2026-09-14-getff-ai-rollout-and-cutover-design.md);
  D50 at `site-design.md:177`; D44's channel clause at `site-design.md:171`). Plus the ordinary
  framework PR gates. The chip's contract lives in its own file
  ([`kickoff-s0b.md §9`](kickoff-s0b.md)) precisely so this line is a command a person can run:
  `host-verify.sh` collects only fences marked `host-verify` and concatenates every such fence in
  one file, so while the contract sat inside the umbrella `kickoff.md` this exit was computable by
  no command at all.
- **Seam:** the S0b chip prompt's contract, run on the host **before** the chip starts; and
  `scripts/docs-check.mjs`'s own self-test fixtures per D30.
- **Falsifiers (D50, verbatim):** S0q merged and the chip's `host-verify` still red → **a name in
  D30's build drifted from the D44 list; fix the list, never the check.** The S0b chip starts
  before S0q merges → the stage order was ignored, not the gate.
- **Measured:** days between the S0a merge and the S0q merge (the S0b chip waits on it); the
  number of D30 build items that needed a second harvest round.

## §6 Last acts before commit (non-negotiable 10)

Separate from Phase 0, which ran before this work existed:

1. Run **both** contracts by path and quote both outputs — this stage's and the chip's, because
   S0q is the stage whose exit is measured on another prompt's contract and checking only your own
   is the omission this list exists for:

   ```text
   bash scripts/host-verify.sh .claude/orchestrator-prompts/getff-ai-site/kickoff-s0q.md
   bash scripts/host-verify.sh .claude/orchestrator-prompts/getff-ai-site/kickoff-s0b.md
   ```

   Never the slug form: `host-verify.sh getff-ai-site` resolves to the umbrella's `kickoff.md`
   alone (`scripts/host-verify.sh:98`) and reports neither of these two.
2. Fire the `docs-card` paired negative: a fixture PR range with one prose commit lacking
   `Docs-card:` must FAIL, and the same range with the trailer must PASS. A gate that has never
   gone RED is a claim, not a gate.
3. Confirm the capability-commit `Prior-art:` trailer is present on the `checks/docs-card.ts`
   commit and names a referent a reader can open.
4. Regenerate hook twins and any generated barrel the new check touches; a generated barrel drops
   project entries on regeneration, so diff it rather than trusting it.
5. `bash scripts/check-ask-files.sh` — a RED ask file blocks every push.
6. Re-walk **this prompt's own citations** (non-negotiable 11); your own `SECTIONS` insertion has
   just shifted every id below it, including the ones §2 cites.
7. Capture the diff's **hunk headers** and list, per shifted file, the citations INTO it from the
   five specs and from these five kickoff files that now sit past a shift point. Put that list in
   the PR body. No gate performs this.

## §7 Out of scope

Anything S0a owns (`maturity.json`, the source fields, `render-reference.mjs`,
`render-face-facts.mjs`); any page **content** — the `terms.md` **skeleton** is yours, the
glossary **content** is S0b's (D20/D50); the conveyor and the landing (S1/S2). The `diataxis`
plugin install is a **host hand**, not container work — request it, do not attempt it. Do not edit
the design specs; a spec defect is a finding in the task report.

## §8 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps: **T2**, **T3**, **T11**, **T13**, **T15**, **T19**, **T21**.

- **T2** — a gate that was designed is not a gate that was run. Every new channel has a quoted RED.
- **T3** — every claim about `pre-push.ts` or `audit-self.yml` carries the line **and its content**.
- **T11** — `docs-check.mjs`, the Vale profile and the trailer gate are capability proposals: the
  build-vs-reuse SSOT consult happens **before** the body is written, not as a trailer afterwards
  ([`source-before-shape.md §4`](../../rules/source-before-shape.md), `#consult-as-trailer-not-input`).
- **T13** — `docs-author` wraps an ADOPTED upstream plugin. Confirm the upstream's problem class
  matches ours before treating its validation as transferring (T16's operational form).
- **T15** — the auditor's first invocation is on the gold pages' own `Docs-card:` trailers
  (`qual.md:250`); the quality layer must pass its own gates.
- **T19** — own cold re-read of the diff before harvest.
- **T21** — the backward-check enumerates sibling **enforcement surfaces** (every other
  `SECTIONS` id with a CI arm), not the files this PR touched.

**Domain-specific trap — `T-S0Q-A` «the second implementation».** The `Docs-card:` gate needs a
pre-push section AND a CI arm, and the path of least resistance is a standalone script called from
both, which immediately becomes two grammars that disagree
([`dual-implementation-discipline.md §8`](../../rules/dual-implementation-discipline.md),
`#sync-by-copy-paste`). Counter: **one** `SECTIONS` entry, and the CI arm re-enters the same code
through `PREPUSH_ONLY` — the seam `audit-self.yml:1127` already demonstrates.

**Domain-specific trap — `T-S0Q-B` «the id that just misses».** `docs_card`, `docscard`,
`doc-card` and `docs-card-check` all look fine in a diff and silently break the
«id = trailer, lower-kebab» rule that lets a reader find the check from the trailer and vice
versa — and `PREPUSH_ONLY=<wrong-id>` runs **nothing** while exiting 0, which is a green CI arm
that checks nothing. Counter: the id is `docs-card`, spelled once, and the CI arm's first run must
be shown to actually execute the section (quote its output, not its exit code).

## §9 Host-verify contract

```bash host-verify
test -f .claude/skills/orchestrator/SKILL.md
test -f .claude/skills/dispatcher/SKILL.md
test -f .claude/skills/pipeline/SKILL.md
test -f .claude/skills/harvest/SKILL.md
test -f .claude/skills/claude-glm-executor-handoff/SKILL.md
test -f .claude/skills/reviewer/SKILL.md
test -f agents/fidelity-auditor.md
test -n "$(find "$HOME/.claude/plugins/cache" -type f -name SKILL.md -path '*superpowers*/writing-plans/*' -print -quit)"
test -n "$(find "$HOME/.claude/plugins/cache" -type f -name SKILL.md -path '*superpowers*/executing-plans/*' -print -quit)"
test -n "$(find "$HOME/.claude/plugins/cache" -type f -name SKILL.md -path '*superpowers*/test-driven-development/*' -print -quit)"
test -f docs/superpowers/specs/2026-09-14-getff-ai-docs-quality-contract-design.md
test -f packages/core/hooks/pre-push.ts
test -f packages/core/hooks/checks/prior-art.ts
test -f scripts/render-reference.mjs
bash scripts/check-ask-files.sh
```

`scripts/render-reference.mjs` is a genuine precondition here — S0q builds after S0a merges, and
region (b) of `terms.md` reads the generator. If that line exits 1, **S0a has not merged** and this
stage must not start.

## §10 D44 — names this stage invokes, measured at `79fa1b56b74`

`orchestrator`, `dispatcher`, `pipeline`, `claude-glm-executor-handoff`, `harvest`,
`superpowers:writing-plans` (the Opus plan, P-R), `superpowers:executing-plans`,
`superpowers:test-driven-development` (every build script — CLAUDE.md «Skill routing bindings»),
and at the PR boundary `reviewer` + [`agents/fidelity-auditor.md`](../../../agents/fidelity-auditor.md).
All **PRESENT** at the SHA above. `docs-author` and `agents/docs-form-auditor.md` are this stage's
**outputs**, so they are absent at its dispatch by construction and are asserted by the S0b chip's
contract instead — see the umbrella kickoff §3 and §5.
