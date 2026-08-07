<!-- scope: stage-scoped dispatch input — S-L of the arch-v2-context-pipeline umbrella (recalculation stage: applies fork #4 = Option A per-seat, designs the fork #5 re-labelling now that its hypothesis is falsified, and re-adjudicates ADR-3's band, which closes fork #6). NO bridge-profile marker — DELIBERATE: this is Tier 2 under the CLAUDE.md task-tier criteria and it did NOT come through /arch, so the D1 plan-complete exception does not apply. The plan itself requires design judgment (the #5 naming rule must be designed from scratch — its inherited hypothesis is measured-false — and the ADR-3 denominator is a choice among four defensible options that disagree in DIRECTION). Project defaults apply: top tier plans, executor tier implements and reviews from below. Host-bound for the same FORK C reason as S-H: the acceptance contract runs scripts/measure-turn-attribution.sh, which reads ~/.claude/projects/**/*.jsonl, and the aif container mounts claude-auth as a named volume, not the host ~/.claude. -->

# arch-v2-context-pipeline S-L — recalculation stage (forks #4, #5, #6)

> **Stage goal:** the S-H measurements shipped with three open forks whose resolutions all move
> the same numbers. This stage applies them **once**, in one place, so that no downstream stage
> ranks anything against a falsified constant. **Design SSOTs (read both, in full):**
> [`2026-08-06-pipeline-token-economy-design.md`](../../../docs/superpowers/specs/2026-08-06-pipeline-token-economy-design.md)
> — §1.5, §3 row P13 (the ranking S-D′ builds), and the binding denominator convention;
> [`2026-07-31-arch-v2-context-pipeline-design.md`](../../../docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md)
> — **ADR-3**, whose 29-39% band this stage re-adjudicates. Umbrella context:
> [`../arch-v2-context-pipeline/kickoff.md`](../arch-v2-context-pipeline/kickoff.md).
>
> **This stage is S-L only.** No subtraction maps (S-D′ owns), no A/B evaluation arm (S-K owns),
> no gate/ceiling edits (S-E owns), no trims (S-G owns, merged). A systemic issue noticed
> mid-stage is a PR-body observation, never an extra PR
> ([CLAUDE.md `PR strategy`](../../../CLAUDE.md)).

**Base:** `origin/staging`. **Mode:** adjudication + doc/script edits, one PR onto staging,
executed on the HOST. **Ordering constraint — binding, and since 2026-08-07 a GATE on S-D′
(operator verdict resolving PR #1255 `DECISION-NEEDED` 1, consumed-deliverable form per the
umbrella §3):** this stage must **merge before S-D′ dispatches**. S-D′ ranks harness-side levers by the P14 price list
([spec `:387`, row P13](../../../docs/superpowers/specs/2026-08-06-pipeline-token-economy-design.md));
a falsified conversion falsifies the *ranking*, which is S-D′'s entire product.

**The deadline is LIVE as of 2026-08-07 — this changed mid-authoring.** An earlier revision of
this kickoff said the deadline was «real but not currently binding, since S-D′ is blocked on the
two-gate `S-E + S-H merged` and S-E is unmerged». Both gates are now satisfied — S-H merged in
#1239 (2026-08-07T00:06Z) and **S-E merged in #1237 (2026-08-07T09:39Z)** — so S-D′ is
dispatchable today and S-L is on the critical path. Verified with
`gh pr view 1237 --json state,mergedAt`, not from the umbrella's prose, which still described the
pre-merge state. **Re-verify at dispatch anyway**; the point of this paragraph is that the answer
moved once already inside a single working session.

## §0 The prerequisite is already met — read it, do not re-run it blind

Fork #5's Option C («measure the gap directly») **has been run**, on the host, 2026-08-07, and its
output is committed at
[`docs/meta-factory/research-patches/2026-08-07-s-l-5c-first-turn-vs-context.md`](../../../docs/meta-factory/research-patches/2026-08-07-s-l-5c-first-turn-vs-context.md).
**Read it in full before anything else.** It is this stage's primary input; §1 below consumes its
findings by name. Its headline, because it changes what this stage must do:

- **The addendum's named falsifier fired.** The ~30.8k `/context`-vs-billing gap was hypothesised
  to be dispatch-prompt content. Measured: the `/orchestrator` injection is **13,523** tokens
  (44% of it), and seats with **no** slash command and **no** dispatch prompt still show a
  **16,196**-token gap. The re-labelling this stage designs therefore has to be designed from
  scratch, not derived from that hypothesis.
- **A second, independent falsification of flat-constant conversion:** a dense markdown table
  measured **1.835 B/token**, below the 2.37-3.32 spread S-H recorded.

**You may re-verify any figure** — every one carries its command and the corpus is on this host.
Re-verification that *contradicts* the patch is a finding, not an error: report it under §3a.

## §1 Deliverables

### 1. Fork #4 — apply Option A in its **per-seat** form, at every consuming site

The 4 B/token convention is falsified. **Do NOT substitute 2.62** — or any other single number —
as the replacement. The measured spread is at least **1.835-3.32** and is driven by content type
and language, not by a global property; Option A's own text offers «2.62 **or a per-seat
re-measurement**» and this stage takes the second branch. Where a direct token count exists
(`/context`, transcript `usage`), **no conversion is needed at all** and the site should stop
converting.

Sites, enumerated with `grep -rn "BYTES_PER_TOKEN\|4 B/tok\|4 bytes per token"` at authoring time
(re-run it — the corpus moves):

| site | what it does | required treatment |
|---|---|---|
| [`scripts/measure-turn-attribution.sh:61`](../../../scripts/measure-turn-attribution.sh) | declares `BYTES_PER_TOKEN=4`, «inherited from the seed (§W1)» | the constant is **live**, not inert — five consumers at `:440`, `:441`, `:446`, `:457`, `:478`. Either take a measured per-content figure, or keep an explicit band and make every derived figure state its direction of error. A silent `4`→`2.62` edit is the failure this row exists to prevent. |
| [`…-s-h-turn-attribution-p3d-p11.md:482`](../../../docs/meta-factory/research-patches/2026-08-07-s-h-turn-attribution-p3d-p11.md) | rests a tolerance claim on the constant | the conclusion survives (a 2% spread is inside the band either way); the **justification** cites a falsified constant. Merged patch — correct by annotation in this stage's own patch, never by editing it. |
| [`…-s-h-turn-attribution-p3d-p11.md:536`](../../../docs/meta-factory/research-patches/2026-08-07-s-h-turn-attribution-p3d-p11.md) | multiplies by it to price the patch's own always-on cost | the figure moves. Same treatment: annotate, do not edit. |

**Escape hatch, explicit:** a site that genuinely cannot get a per-content measurement states
`UNCONVERTED — no direct count channel`, plus the band and the direction of error. Never an
estimate dressed as a measurement (the T-SH-A discipline S-H shipped under).

### 2. Fork #5 — design the re-labelling, from scratch

The hypothesis that would have supplied it is measured-false (§0). What the measurement leaves
you is: two channels that disagree by a **seat-constant** residual (16.2k on one day, ~17.3k on
another), whose composition is dominated by **harness-injected session-start payload** — the skill
listing, the deferred-tool / agent / MCP listings, the hook injects — content that arrives in
every seat regardless of what the operator typed.

Produce a **naming rule**, not a winner, unless the evidence forces a winner:

- Pin the term «harness remainder» to exactly one channel, and give the other channel its own
  name; re-label every figure that used the term ambiguously.
- **Re-adjudicate the direction of the indictment.** The merged addendum's §8.5 is titled «the gap
  indicts the by-difference method» and argues by-difference *overstates*. If the residual is
  genuine recurring per-seat cost that `/context` omits from its total, then `/context`
  **under-reports** and the indictment inverts. Decide this explicitly and show the working — an
  inherited section title is not evidence.
- **`/context` cannot enter a subagent seat.** That was Option B's original argument, and nothing
  measured touches it. The subagent-seat 68.4% figure is **not** re-adjudicated by this stage
  unless you produce a new channel for it; say so either way.

### 3. The decomposition that closes the residual — run it, or report it unmeasurable

The measurement patch deliberately stops short of this (§4 F4, §5). This stage runs it:

- Map each pre-turn payload census row onto the `/context` category that does or does not already
  count it. The load-bearing unknown named in the patch: is `/context`'s `Skills 8.9k` the
  `skill_listing` attachment, or a different accounting of the same content?
- **Reconcile `Messages 1.3k`.** At the moment `/context` was taken, 7,769 chars of payload
  preceded it; 7,769 / 1,300 = 5.98 B/token, outside any observed band. Either `Messages` measures
  something narrower than all message-stream content, or one of the two figures is wrong.
- Decompose `cache_creation` as far as the transcript channel allows. The baseline's 53,127
  exceeds what a 58,437-char census accounts for at any conversion in-band, so it demonstrably
  spans the system-prompt region too. Whatever the channel cannot reach reports
  **`UNMEASURED — channel absent`** (T14), never an estimate.

### 4. Fork #6 — re-adjudicate ADR-3's 29-39% band

Four defensible denominators give 29.99% / 26.6% / 45.9% / 42.8% — inside / below / above / above
(the merged addendum §8.6 tabulates them). #6 could not be settled before #5 because a
by-difference-derived numerator moves with the channel decision. With §1.2 decided, settle it:

- Pick the denominator, or state that ADR-3's band must be restated against a named channel rather
  than a bare «~100k observed session-start total».
- **26,700 is the pre-S-G resident set.** No ranking of the *current* set may be built on it.
- If the numerator itself is conversion-derived, apply §1.1 to it **first**, then compute the
  share. A share computed from a falsified numerator is not a finding.

### 5. Spec annotation — the conversion's reach into P13

Annotate [spec `:387` (P13)](../../../docs/superpowers/specs/2026-08-06-pipeline-token-economy-design.md)
and §1.5 (`:111-122`) with the recalculated conversion and what it does to the S-D′ ranking.
**Scope fence:** the *second* ADR-8 deviation (PR #1251) is also unrecorded in the spec — that is
a **different concern with a different owner** (operator-owned, per the handoff). Surface it as a
PR-body observation; do **not** bundle it. Likewise `calibration.md:43,52` records the pre-descope
ADR-8 owner — that surface belongs to **S-K** (named in S-D′ §6), not here.

**Descopes (encoded, binding):** no subtraction maps; no A/B arm; no gate/ceiling edits even if
the numbers suggest one (surface for S-E's owner); no edits to any merged S-H research patch; no
re-derivation of settled S1/S2 numbers.

## §2 Permitted files

**Worktree isolation first.** Before any edit: `bash scripts/create-worktree.sh s-l`. If it fails,
STOP and report — never proceed in a shared working directory
([parallel-subwave-isolation.md §1](../../rules/parallel-subwave-isolation.md)).

Permitted: `docs/meta-factory/research-patches/*` (this stage's own new patch — the recalculation
and every annotation of a merged patch land **here**, append-only), `scripts/measure-turn-attribution.sh`,
`docs/superpowers/specs/2026-08-06-pipeline-token-economy-design.md` (§1.5 + P13 annotation only),
`.claude/orchestrator-prompts/arch-v2-context-pipeline/kickoff.md` (stage-table row only).

**NOT permitted:** any merged S-H research patch (append-only, read-only for later sessions per
the [CLAUDE.md](../../../CLAUDE.md) Artifact Ownership Contract — the 2026-08-07 patches
`…-s-h-harness-remainder-p14.md`, `…-s-h-p14-context-addendum.md`,
`…-s-h-turn-attribution-p3d-p11.md`, and the `…-s-l-5c-first-turn-vs-context.md` input);
`.claude/orchestrator-prompts/arch-v2-context-pipeline/calibration.md` (S-K); other stage
kickoffs; `.claude/settings.json` / `settings.local.json` (operator-only); `.claude/rules/*`;
`CLAUDE.md`; `packages/*`.

## §3 Acceptance

```bash host-verify
bash scripts/measure-turn-attribution.sh > /tmp/s-l-mta.out
grep -qE '^SESSION-TRANSCRIPTS: [1-9][0-9]*$' /tmp/s-l-mta.out
grep -qE '^SUBAGENT-TRANSCRIPTS: [1-9][0-9]*$' /tmp/s-l-mta.out
npx vitest run packages/core/principles/10-research-patch-annotation.test.ts
```

The script contract is inherited from S-H deliberately: this stage edits the conversion the script
carries, so «it still runs, on a non-empty corpus, in both populations» is exactly the regression
the edit could cause. A run whose subagent count is 0 is a failed run, not a finding.
(Phase -1 fix, 2026-08-07: the inherited `script | grep -q` form is unsatisfiable on the host —
`grep -q` exits at first match, the still-writing script takes SIGPIPE, and the runner's
`pipefail` turns that into exit 141 — so the contract runs the script ONCE into a file and greps
the file. The S-H kickoff (`../arch-v2-context-pipeline-s-h/kickoff.md:110-113`) carries the same
latent form; that stage is closed, so it is noted here, not edited.)

Plus review-time:

- **Every share states its numerator's and denominator's provenance, and the numerator is provably
  a subset of the denominator.** This is the single class that consumed nine REVISE rounds on the
  S-H addendum; it is the first thing a reviewer should check and the most likely reason to
  REVISE. Two live traps carried forward: the harness's total for **74 listed** skill entries is
  not divisible by a byte sum over **129 `SKILL.md` files** (the two largest listed entries have
  no `SKILL.md` at all), and **26,700 is the pre-S-G resident set**.
- **A word substituted for a withdrawn figure keeps that figure's direction.** Replacing «69,300»
  with «substantial» is only legal if «substantial» points the same way.
- Every recalculated row names its channel; unreachable rows read `UNMEASURED — channel absent`
  or `UNCONVERTED — no direct count channel`, never an estimate.
- The #5 re-labelling states what would falsify it.
- The #6 verdict names the denominator it picked **and** the three it rejected, with the direction
  each would have moved the band.
- No hunk touches a merged S-H patch: `git diff --name-only origin/staging..HEAD` shows none of
  the four files named in §2.
- The PR body carries the §1.7 forward+backward self-check and a `Prior-art:` trailer. This stage
  adds no dependency and no `packages/` file, so the correct form is the escape hatch — e.g.
  `Prior-art: skipped — recalculation of existing measurements, no new capability`.

## §3a Fork discipline (host analogue of the park contract)

This stage runs in a host CC session, not in aif — there is no `manualReviewRequired` queue to
park into. The same discipline binds in chat form: on ANY genuine fork (two defensible readings of
a measurement, a denominator whose choice changes a published verdict's direction, a
re-verification that contradicts the §0 input), surface
`DECISION-NEEDED: <one line>. Option A → consequence X. Option B → consequence Y.` to the operator
and continue with the unambiguous remainder. Never pick silently; never manufacture an
observation. **This stage is expected to produce at least one** — it exists because three forks
were surfaced rather than silently picked.

## §4 AI-traps

See [`ai-laziness-traps.md §2`](../../rules/ai-laziness-traps.md) (cited per §3 of that rule).
**Active traps for this stage: T2, T3, T6, T14, T20, T21.**

- **T2** — the decomposition in §1.3 must be **run**. «My mapping would resolve `Messages 1.3k`»
  is the failure; a table of rows with their evidence is the deliverable.
- **T3** — every number carries its command + output or a file:line whose content is quoted. This
  stage's entire product is numbers.
- **T6** — confidence as coverage predicates («k of n census rows mapped to a `/context` category;
  the rest UNMEASURED»), never «high».
- **T14** — a decomposition that cannot reach a row reports *coverage insufficient*, not *clean*.
  §1.3 is written to make this the expected outcome for at least `cache_creation`.
- **T20** — no verdict without quoted evidence. Applies with force to the §1.2 direction call,
  which reverses a published section title.
- **T21** — the backward-check enumeration is **run before the section is written**, not recalled.
  This umbrella has now recorded **three consecutive** instances where the drafted sweep was wrong
  and `grep` overturned it (#1250: 3 of 6 rows; #1251: 5 of 9 surfaces;
  [`…-s-l-5c-first-turn-vs-context.md`](../../../docs/meta-factory/research-patches/2026-08-07-s-l-5c-first-turn-vs-context.md)
  §6: 2 of 6). Delegating the sweep to [`agents/backward-sweep-auditor.md`](../../../agents/backward-sweep-auditor.md)
  is the structural counter; a stronger reminder is not.

**T-SL-A — recalculation-by-constant-swap.** Tempted, on being told «4 is falsified, the measured
aggregate is 2.62», to replace the constant repo-wide and declare fork #4 applied. That reproduces
the exact defect at a new value: a single number standing in for a spread of at least 1.835-3.32
that is driven by content type. Counter: §1.1's table — every site either takes a per-content
measurement, stops converting because a direct count exists, or states the band **and** the
direction of error. A diff whose only change is `4` → `2.62` fails this stage.

**T-SL-B — the share whose numerator escaped its denominator.** Tempted, when a recalculation
moves a numerator, to leave the denominator as published — producing a share that is arithmetically
computable and semantically meaningless (a count over one population divided by a total over
another). Counter: §3's first bullet — state both provenances and prove the subset relation
*before* dividing. Falsifier for this stage's own output: any percentage in the PR whose numerator
and denominator cannot be traced to the same enumerated population.
