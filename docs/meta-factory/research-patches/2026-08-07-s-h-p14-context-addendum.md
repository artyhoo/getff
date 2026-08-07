<!-- scope:arch-v2-context-pipeline-s-h-p14-addendum -->

# S-H — P14 addendum: the operator's `/context` paste (post-merge)

> **Authoritative for:** what the 2026-08-07 operator-supplied `/context` snapshot resolved for
> the P14 price list, the falsification of the 4 B/token conversion, the resident/deferred
> identity, and DECISION-NEEDED #4, #5 and #6.
> **NOT authoritative for:** the price list itself and its recommendations — parent patch
> [`2026-08-07-s-h-harness-remainder-p14.md`](2026-08-07-s-h-harness-remainder-p14.md);
> per-turn attribution and hook firing rates — [`2026-08-07-s-h-turn-attribution-p3d-p11.md`](2026-08-07-s-h-turn-attribution-p3d-p11.md);
> the skills-listing overflow surface (S-I); subtraction maps (S-D′);
> project goal — [README.md#why-this-exists](../../../README.md#why-this-exists).

> **Section numbering is deliberately `§8.x`, continuing the parent patch's sections.** This
> content was authored as the parent's §8 and split out only when the parent reached the repo's
> 600-line markdown gate — fittingly, a document about context cost hitting a document-size
> limit. The numbering is preserved so every `§8.x` cross-reference already written in the
> parent, and in this file, stays valid.

---

## §8 Addendum (2026-08-07, post-merge) — DECISION-NEEDED #3 answered by Option A

The operator ran `/context` and pasted the output, so §0a's Option A is **taken**. This is an
addendum rather than an in-place rewrite on purpose: the measurement history must read «unknown
at stage close → known on 2026-08-07», not as though the split had been available all along.

**Provenance and its limits (T6, before the numbers).** One `/context` snapshot, n=1, from an
**orchestrator seat in a worktree** carrying four injected rule files (`00-rule-index`,
`attention-is-not-a-mechanism`, `build-first-reuse-default`, `ai-laziness-traps`; the other three
of the seven memory files are the two `CLAUDE.md` and `MEMORY.md`). A fresh main-checkout or
subagent seat has a different resident set. All figures are the harness's own estimates at its
own rounding; no tokenizer was run. `Messages 276.4k` is that session's dialogue, **not** resident
load.

### §8.1 The finding that outranks the split: the 4 B/token convention is falsified

The seed's binding conversion — **4 B ≈ 1 token**, applied uniformly across both S-H patches — is
directly checkable for the first time, because `/context` itemises per-file token counts for
files whose byte counts are known. Seven files carry both:

| file | bytes (`wc -c`) | tokens (harness) | B/token |
|---|---:|---:|---:|
| `~/.claude/CLAUDE.md` | 3,198 | 964 | 3.32 |
| `<repo>/CLAUDE.md` | 23,740 | 9.3k | 2.55 |
| `.claude/rules/00-rule-index.md` | 4,030 | 1.7k | 2.37 |
| `.claude/rules/attention-is-not-a-mechanism.md` | 2,629 | 1.1k | 2.39 |
| `.claude/rules/build-first-reuse-default.md` | 12,667 | 4.8k | 2.64 |
| `.claude/rules/ai-laziness-traps.md` | 26,387 | 9.8k | 2.69 |
| `…/memory/MEMORY.md` | 4,505 | 1.8k | 2.50 |
| **aggregate** | **77,156** | **29,464** | **2.62** |

**Measured 2.62 B/token, not 4.** The six ASCII-dominant files — **five repo files plus host-side
`MEMORY.md`**, which is host-side by ownership but ASCII by content — cluster at 2.37-2.69; the
outlier (3.32) is the operator-global `CLAUDE.md`, which is largely Russian — multi-byte UTF-8
inflates bytes per token, which is the expected direction and corroborates rather than
undermines the reading.

**Consequence, flagged and NOT silently applied.** Every `est-tokens` figure derived through
4 B/t in this patch and its sibling is low by ≈**1.53×** (4 / 2.62). Because row 5 (the harness
remainder) is computed **by difference** — seat total minus rows 1-4 — an understated rows 1-4
makes the remainder correspondingly **overstated**. A first-order restatement on the same seat
total gives rows 1-4 = 19,719 × (4 / 2.6187) ≈ **30,120** tok and a remainder of
62,340 − 30,120 = **32,220** tok, i.e. **51.7%, not 68.4%**.

That restatement is **not** written into §2, and the table's figures are left as they were —
**on one reason, not two.** An earlier draft of this section also claimed «the row-1 file set is
the pre-S-G resident set while the ratio was measured on the current one, so the two are not the
same population». **That claim is false and is withdrawn** (cold audit, round 3): concatenating
the five files the ratio was measured on gives **69,453 B**, and row 1's published 17,363
est-tokens is exactly 69,452 B / 4 — the same population, byte for byte. The surviving reason is
the honest one: **re-deriving §2 on a new conversion constant is a re-measurement, which is
beyond an addendum.** A reader adjudicating DECISION-NEEDED #4 should not be handed a
population-mismatch escape that does not exist. **Recorded as a correction owed, not as a
correction made.**

> **DECISION-NEEDED #4 — the conversion constant.** The 4 B/t convention is inherited from the
> S-A seed and is load-bearing for every est figure in this umbrella.
> **Option A** — adopt **2.62 B/token** (or a per-seat re-measurement) as the operative
> conversion and re-derive §2 and the sibling's 4 B/t sites — its **§5, §7 and §8** (the sibling
> runs §0-§8; there is no §9) — in a follow-up stage. Consequence: the
> harness share drops to roughly half, and the repo-owned half becomes correspondingly *more*
> expensive — which changes which levers S-D′ ranks first.
> **Option B** — keep 4 B/t for comparability with S1/S2 figures already published under it, and
> carry this section as the standing caveat. Consequence: every published est figure stays
> internally comparable but is known-low by ~1.5×.
> **Not resolved here.**

### §8.2 What the snapshot resolves — the resident/deferred identity

The reported percentages sum to **105.6%**, which is not an error: the two `(deferred)` rows are
counted in the table but are **not resident** — they are tool schemas held behind `ToolSearch`
and fetched on demand. The identity confirms it exactly:

```text
resident non-message load = 334.6k − 276.4k                       = 58.2k
sum of non-deferred rows  = 5.2 + 5.3 + 8.4 + 1 + 29.4 + 8.9      = 58.2k   ← exact match
deferred, i.e. NOT resident = 42.4 + 15.7                          = 58.1k
```

| resident block | tokens | share of resident |
|---|---:|---:|
| memory files | 29.4k | 50.5% |
| skills listing | 8.9k | 15.3% |
| MCP tool schemas (resident subset) | 8.4k | 14.4% |
| system tools | 5.3k | 9.1% |
| base system prompt | 5.2k | 8.9% |
| custom-agent listing | 1k | 1.7% |

Two readings follow, and only the first is new:

1. **Half the resident load is memory files** — 29.4k of 58.2k. **Of that, repo-owned is 26,700**
   (29,464 − `~/.claude/CLAUDE.md` 964 − `MEMORY.md` 1,800, both host-side: §2 rows 2 and 3),
   i.e. **45.9%** of the resident head, not 50.5% — the distinction matters because only the
   repo-owned part is this project's to change. Within it, two documents carry a third of the
   *entire* resident head: `<repo>/CLAUDE.md` (9.3k) and `.claude/rules/ai-laziness-traps.md`
   (9.8k) = 19.1k. This is the «expensive end» §0.5 says to price first, and it is
   **actionable by this project**, unlike the harness blocks.
2. **`ToolSearch` deferral withholds 58.1k — almost exactly what the entire resident head costs.**
   §3's «preserve what already works» now has its number. **Stated precisely, because the loose
   form is wrong:** making those schemas resident would **double the resident head** (58.2k →
   116.3k); it would *not* halve the budget — on this 1m-window snapshot free space moves
   665.4k → ~607.3k, i.e. **−8.7%**. The head is what the deferral halves, and the head is what
   every seat pays before its first word. On that measure it is still the single most expensive
   regression available in this table.

### §8.3 Which `UNMEASURED` rows this closes — two of four, not four

| row | before | after | basis |
|---|---|---|---|
| 5c — MCP tool schemas (resident subset) | `UNMEASURED — channel absent` | **8.4k** | `/context` «MCP tools» |
| 5e — skills/agents listing, as injected | `UNMEASURED — channel absent` | **8.9k** skills + **1k** custom-agent listing | `/context` «Skills» + «Custom agents» |
| 5d — MCP server instructions | `UNMEASURED — channel absent` | **unchanged** | `/context` does not itemise server instructions apart from tool schemas. Where they are counted is *not* established by the snapshot — asserting a region would be the estimate T-SH-A forbids |
| 9 — agents inventory (17 repo `agents/*.md`) | `UNMEASURED — channel absent` | **unchanged** | different population: `/context`'s «Custom agents» (1k) counts the harness's *registered* agent types — one row, `orchestrator-planner` — not the repo's `agents/` directory |

Rows 5d and 9 stay `UNMEASURED — channel absent` rather than being filled from the nearest
plausible neighbour. Reporting «two of four» where «four of four» was expected is the T-SH-A
obligation working as intended.

**Revised partition:** the price list still holds **14** rows; **11** now carry a named channel,
**2** read `UNMEASURED — channel absent` (5d, 9), and 1 (row 8) is measured source-side with the
injected form still S-I's to publish. Partition **14 / 11 / 2 / 1**, counted from the table.

### §8.4 What S-D′ can now do, and what it still cannot

**Can:** rank the resident head by block, with the repo-owned memory files (**26,700 = 45.9%** —
not the full 29.4k memory category, which includes 2,764 tok of host-side files this project does
not own) as the
top-ranked and *own-able* target — the ordering §0.5 asks for is available for the half that
matters. **Cannot:** treat the absolute figures as final while DECISION-NEEDED #4 **and #5** are
open, or split the MCP server-instruction block. **Should:** read §8.1 and §8.5 before ordering
anything — between them they move the repo-vs-harness balance by more than the width of the
decision, and in the same direction.

### §8.5 The two figures do not reconcile — and the gap indicts the by-difference method

`/context` and the by-difference channel priced **the same session** (`e5a0e586-…`, the seat §1
publishes at 89,019 tok), and they disagree:

| channel | harness-side figure for that seat |
|---|---:|
| by difference (§1/§2): seat total − rows 1-4 | **69,300** tok (77.8%) |
| `/context` categories matching row 5's own definition («base system prompt + tool schemas + MCP + listings»): 5.2 + 5.3 + 8.4 + 1 + 8.9 | **28.8k** |

Neither 28.8k nor 28.8 + 58.1 (adding the deferred schemas back) = 86.9k equals 69,300. The
totals disagree the same way: `/context` puts the whole resident head at **58.2k**, while the
first billed turn bills **89,019** — reproducible as `input_tokens 2 + cache_creation 66,650 +
cache_read 22,367`. **Gap: ~30.8k.**

**What the gap most likely is, stated as a hypothesis and not priced.** §0 defines the
substitute channel as «the resident head **plus its dispatch prompt**» — and rows 1-4 never
subtract that prompt. This session opened with a `/orchestrator` invocation, which injects the
whole SKILL.md body into the first message, so a large first-turn message is expected here.
That is a *plausible* account of ~30.8k; it is **not measured**, and no figure in this patch is
adjusted on it.

**Why this matters more than a bookkeeping note.** If the gap is dispatch-prompt content, then
the by-difference method **systematically overstates the harness remainder**, because everything
it cannot attribute to rows 1-4 lands in row 5 by construction — including message content that
is not resident load at all. The main-seat 77.8% is the most exposed figure; the subagent-seat
68.4% is exposed to the same bias in proportion to its dispatch prompt.

> **DECISION-NEEDED #5 — which channel defines «harness remainder».** Kickoff §3a names «two
> defensible readings of a measurement» a fork; this is one, and it was not visible until the
> `/context` paste gave a second channel to compare against.
> **Option A** — treat `/context` as authoritative for the *resident* split and demote the
> by-difference figures to «seat cost at first turn, dispatch prompt included». Consequence: the
> harness remainder for this seat is ~28.8k resident, not 69,300 — a **2.41×** difference in the
> absolute, but the *share* moves 77.8% → 28.8/58.2 = **49.5%**, i.e. **1.57×**, since the
> denominator must move with the numerator. **The subagent-seat 68.4% is not touched either way**:
> `/context` cannot be run inside a subagent, which is exactly Option B's argument. Under Option A
> the main-seat rankings in §4 are re-derived; the subagent ones are not.
> **Option B** — keep by-difference as authoritative (it is the only channel available for
> *subagent* seats, which `/context` cannot reach) and carry §8.2 as a resident-only cross-check.
> Consequence: the figures stand as published, with a known upward bias of unmeasured size.
> **Option C** — measure the gap directly: bill one seat's first turn *and* run `/context` in it
> before any other message, so the dispatch prompt is isolated. Cost: one interactive session.
> **Not resolved here.** This addendum records the disagreement rather than picking a winner —
> picking one silently would be the failure §3a exists to prevent.

### §8.6 DECISION-NEEDED #6 — which denominator the repo-owned share is measured against

The repo-owned always-on block has **one measured size and four defensible denominators**, and
they disagree in direction against ADR-3's 29-39% band. Three successive rounds each picked one
and each pick was defective; the fourth response is to stop picking.

| denominator | source | share of 26,700 | vs the 29-39% band |
|---|---|---:|---|
| this seat's first-turn total, 89,019 | parent §1, transcript-billed | **29.99%** | **inside** |
| 60-session median main seat, 100,529 | parent §1, same channel | **26.6%** | below |
| resident head, 58,200 | §8.2, `/context` | **45.9%** | above |
| full-tool subagent seat, 62,340 | parent §2's own denominator | **42.8%** | above |

They are not interchangeable: the first two include a dispatch prompt the third excludes (§8.5),
and the fourth is a different seat class. ADR-3 states its band against «a ~100k observed
session-start total», which most closely matches rows 1-2 — but those two straddle the band edge,
so even that reading does not settle it.

> **DECISION-NEEDED #6.** **Option A** — denominate on the seat's own first-turn total. The share
> is inside the band and ADR-3 needs no correction. **Option B** — denominate on the 60-session
> median, matching ADR-3's «observed» wording most literally. The share is below the band and
> ADR-3 is measured high. **Option C** — denominate on the `/context` resident head, which is the
> only denominator that excludes dispatch-prompt content and is therefore the one a *residency*
> claim should arguably use. The share is above the band and ADR-3 is measured low, in the
> opposite direction from Option B. **Not resolved here** — and note that #6 cannot be settled
> independently of #5 — though the coupling is **not** a single identity, as an earlier draft
> claimed. Option A's denominator differs from Option C's by exactly the gap #5 records
> (89,019 − 58,200 = 30,819); Option B's differs by 42,329 **and** is a 60-session median set
> against a gap measured on one session, so B compounds #5's question with a population change
> rather than restating it.


---

## §1.7 self-reflexive note

**Forward-check.** [`attention-is-not-a-mechanism.md §1`](../../../.claude/rules/attention-is-not-a-mechanism.md):
this addendum adds no check, so it introduces no bare-attention gate; the four obligations it
creates (DECISION-NEEDED #3 answered; #4, #5 and #6 open) are operator decisions with named options
and consequences, not «someone should look at the numbers».
[`ai-laziness-traps.md §2`](../../../.claude/rules/ai-laziness-traps.md): **T3** — every figure
carries its command or its source line in the pasted snapshot, and the ~30.8k gap is labelled a
hypothesis twice rather than priced; **T6** — coverage is stated as predicates (n=1, one seat
class, harness-reported rounding, no tokenizer) before any number; **T14** — rows 5d and 9 report
insufficient coverage instead of being filled from the nearest plausible neighbour; **T20** — the
one claim that outran its evidence («deferral roughly doubles the usable budget») was caught by a
cold seat and restated to what the snapshot bounds. **T-SH-A** (the stage's own trap) is the
governing one and held: the paste answered two rows and the other two stayed `UNMEASURED`.
[`no-paid-llm-in-ci.md`](../../../.claude/rules/no-paid-llm-in-ci.md): measurement is a shell
concatenation plus an operator-pasted harness report; no LLM is in any loop.

**Backward-check.** Class of this change = *a post-merge artefact that revises figures already
published in a merged research patch*. Enumerated surfaces where that class occurs, verdicted per
surface:

- **The parent patch** `2026-08-07-s-h-harness-remainder-p14.md` — **SWEPT**: every section whose
  evidentiary basis this paste moved now carries a marker (§0 supersession note, §0a ANSWERED,
  §2 headline warning + per-row seat annotations on 5c/5e, §4 R1 PERFORMED / R4 CHALLENGED /
  R5 REVERSED, §6 revised partition, §7 T-SH-A revision **and all four backward-check surfaces
  whose basis this paste moved — ADR-3, the spec P14 row, the S-I kickoff and
  `measure-always-on.sh` — re-adjudicated**).

  **The sweep method failed, five rounds running, and this note is not exempt.** Each round's
  fixes were driven by the previous review's *list*, so each round re-failed on whatever that
  list omitted: R4 missed at round 2 and caught at round 3; R2 missed at round 3 and caught at
  round 4; `measure-always-on.sh` missed at round 4 and caught at round 5. That is
  [`ai-laziness-traps.md` T21](../../../.claude/rules/ai-laziness-traps.md) in its own-work form —
  and an earlier draft of this paragraph *named* T21 while doing it, which a cold seat caught.
  **Stated plainly rather than dressed up: this round's sweep was list-driven too.** Its hunks map
  one-to-one onto round 5's findings. The counter T21 actually prescribes — a cold agent handed
  only the change *class* — is what the five audit rounds have been doing; the author-side sweep
  never became class-driven, and saying so is more useful to the next reader than a claim that it
  did.

  A second method finding, from the same five rounds: **three successive attempts to restate the
  ADR-3 comparison each produced a defective replacement figure** (cross-seat, then
  cross-denominator, then ratio-transferred-across-populations). The root cause was not
  carelessness at any one site — it was that the comparison has one measured numerator and four
  defensible denominators. The resolution was to **withdraw the verdict rather than repair it a
  fourth time** (DECISION-NEEDED #6, §8.6 above).

  **A third, recorded because the two records of this round disagreed.** The commit message for
  this round claimed the class sweep found a site «not only the one the audit named»; the
  paragraph above claimed the sweep was purely list-driven. **The commit message is the accurate
  one on that point:** the §7 S-I re-adjudication carried the withdrawn share and was found by
  the author's own grep for the *class*, not by any review naming it. So the honest summary is:
  the sweep was list-driven for five rounds and became class-driven for exactly one item — which
  is progress worth naming precisely, not a claim that the method changed.
- **The sibling patch** `2026-08-07-s-h-turn-attribution-p3d-p11.md` — **GAP-FOUND, not edited.**
  It uses the same 4 B/t constant at its §5, §7 and §8, so §8.1's falsification applies to it
  identically and its FORK-E est-token figures are low by the same ≈1.53×. Not corrected here:
  re-deriving it is the same re-measurement §8.1 declines for §2, and DECISION-NEEDED #4 must
  settle the constant first. Named in #4's Option A as required scope.
- **`docs/superpowers/specs/2026-08-06-pipeline-token-economy-design.md`** (the `[W]`/`[H]`/`[D]`
  tag convention and the P14 row) — **GAP-FOUND, out of permitted set**: the spec declares the
  tags non-convertible, and this addendum shows the *conversion constant underneath one of them*
  is itself wrong; that is a spec-level correction, and the spec is round-capped and
  operator-owned. Surfaced via #4, not edited.
- **`docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md`** ADR-3 — **GAP-FOUND,
  out of permitted set**: the repo-owned share measures below its 29-39% band under both
  conversions (§7 re-verdict in the parent). Not edited; ADR-3 is spec.
- **`docs/meta-factory/research-patches/2026-08-01-token-economy-s-a-profile.md`** — **NOT SWEPT,
  by ownership**: a closed historical artefact whose authoring session owns it; the parent patch
  already records its superseded rows and this addendum adds nothing to that verdict.
- **`.claude/settings.json` / `.claude/settings.local.json`** — **NOT SWEPT, deliberately**:
  operator-only and agent-uncommittable. The `/context` snapshot names their effects; nothing here
  applies one.

**Self-application (T15).** This patch measures resident context cost, and its own residency is
zero — it carries no `paths:` frontmatter and lives under `research-patches/`, a directory in no
resident set. It was nonetheless *created by* the cost it studies: it exists as a separate file
because the parent hit the 600-line markdown gate, i.e. a document about document cost was itself
split by a size discipline. Applying its own §8.2 reading to itself: the lever it identifies —
repo-owned memory files at 45.9% of the resident head — does not touch this file, and adding it
to any always-on channel would be the error it warns against.
